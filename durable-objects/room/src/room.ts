import {
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  DEFAULT_MAX_ROOM_AGE_MS,
  DISCONNECT_GRACE_MS,
  MAX_CONNECTIONS_PER_ROOM,
  MAX_MESSAGES_BUFFERED,
  MAX_MESSAGE_BYTES,
  type ClientEvent,
  type CreateRoomResponse,
  type EncryptedMessageEnvelope,
  type ErrorEventPayload,
  type JoinPayload,
  type MessageEvent,
  type MessageState,
  type MessageStateEvent,
  type PresenceEvent,
  type PresenceSnapshot,
  type RoomMetadata,
  type RoomStateEvent,
  type SendPayload,
  type ServerEvent,
  type StoredMessage
} from "@ephem/shared";
import { DurableObject } from "cloudflare:workers";

type RoomStorage = RoomMetadata & {
  creatorToken: string;
};

type SessionRecord = {
  sessionId: string;
  creator: boolean;
  connectedAt: number;
  lastSeenAt: number;
};

type AttachmentRecord = {
  sessionId: string;
};

type RoomBootstrap = Pick<
  CreateRoomResponse,
  | "roomId"
  | "createdAt"
  | "expiresAt"
  | "inactivityTimeoutMs"
  | "maxAgeMs"
  | "disappearAfterReadSeconds"
  | "creatorToken"
>;

export interface Env {
  ROOM_OBJECT: DurableObjectNamespace<RoomDurableObject>;
}

const ROOM_META_KEY = "room:meta";
const SESSION_PREFIX = "session:";
const MESSAGE_PREFIX = "message:";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function wsResponse(client: WebSocket): Response {
  return new Response(null, {
    status: 101,
    webSocket: client
  } as ResponseInit & { webSocket: WebSocket });
}

function errorEvent(code: string, message: string): ErrorEventPayload {
  return {
    type: "error",
    code,
    message
  };
}

async function safeJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export class RoomDurableObject extends DurableObject<Env> {
  private roomMeta: RoomStorage | null = null;
  private sessions = new Map<string, SessionRecord>();
  private storageReady: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storageReady = this.ctx.blockConcurrencyWhile(async () => {
      this.roomMeta = (await this.ctx.storage.get<RoomStorage>(ROOM_META_KEY)) ?? null;

      const storedSessions = await this.ctx.storage.list<SessionRecord>({
        prefix: SESSION_PREFIX
      });
      for (const session of storedSessions.values()) {
        this.sessions.set(session.sessionId, session);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.storageReady;

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/internal/bootstrap") {
      const bootstrap = await safeJson<RoomBootstrap>(request);
      return this.bootstrapRoom(bootstrap);
    }

    if (request.method === "GET" && url.pathname === "/internal/metadata") {
      return this.handleMetadata();
    }

    if (request.method === "POST" && url.pathname === "/internal/destroy") {
      const payload = await safeJson<{ creatorToken: string }>(request);
      return this.destroyRoom("destroyed", payload.creatorToken);
    }

    if (request.method === "GET" && url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return jsonResponse({ error: "Expected WebSocket upgrade." }, 400);
      }

      if (!this.roomMeta || this.roomMeta.status !== "open") {
        return jsonResponse({ error: "Room is unavailable." }, 410);
      }

      if (this.connectedSessionIds().length >= MAX_CONNECTIONS_PER_ROOM) {
        return jsonResponse({ error: "Room is full." }, 409);
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ sessionId: "" satisfies string } as AttachmentRecord);
      await this.markRoomActivity();
      return wsResponse(client);
    }

    return jsonResponse({ error: "Not found." }, 404);
  }

  async alarm(): Promise<void> {
    await this.storageReady;
    await this.expireMessages();

    if (!this.roomMeta) {
      return;
    }

    const now = Date.now();
    if (this.roomMeta.status !== "open") {
      return;
    }

    const noSockets = this.connectedSessionIds().length === 0;
    const idleFor = now - this.roomMeta.lastActivityAt;

    if (now >= this.roomMeta.expiresAt) {
      await this.transitionRoom("expired", "max-age");
      return;
    }

    if (noSockets && idleFor >= DISCONNECT_GRACE_MS) {
      await this.transitionRoom("expired", "grace-timeout");
      return;
    }

    if (idleFor >= this.roomMeta.inactivityTimeoutMs) {
      await this.transitionRoom("expired", "inactive");
      return;
    }

    await this.scheduleNextAlarm();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.storageReady;
    if (typeof message !== "string") {
      ws.send(JSON.stringify(errorEvent("binary_not_supported", "Binary payloads are not supported.")));
      return;
    }

    let parsed: ClientEvent;
    try {
      parsed = JSON.parse(message) as ClientEvent;
    } catch {
      ws.send(JSON.stringify(errorEvent("invalid_json", "Message must be valid JSON.")));
      return;
    }

    switch (parsed.type) {
      case "join":
        await this.handleJoin(ws, parsed);
        break;
      case "send":
        await this.handleSend(ws, parsed);
        break;
      case "read":
        await this.handleRead(parsed.messageId, parsed.readerSessionId);
        break;
      case "destroy":
        await this.destroyRoom("destroyed", parsed.creatorToken);
        break;
      case "ping":
        await this.markRoomActivity();
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.storageReady;
    const attachment = ws.deserializeAttachment() as AttachmentRecord | null;
    if (!attachment?.sessionId) {
      return;
    }

    const record = this.sessions.get(attachment.sessionId);
    if (record) {
      record.lastSeenAt = Date.now();
      this.sessions.set(record.sessionId, record);
      await this.ctx.storage.put(`${SESSION_PREFIX}${record.sessionId}`, record);
    }

    await this.markRoomActivity();
    await this.broadcastPresence();
    await this.scheduleNextAlarm();
  }

  private async bootstrapRoom(bootstrap: RoomBootstrap): Promise<Response> {
    if (this.roomMeta) {
      return jsonResponse({ error: "Room already initialized." }, 409);
    }

    const meta: RoomStorage = {
      roomId: bootstrap.roomId,
      createdAt: bootstrap.createdAt,
      expiresAt: bootstrap.expiresAt,
      inactivityTimeoutMs: bootstrap.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS,
      maxAgeMs: bootstrap.maxAgeMs ?? DEFAULT_MAX_ROOM_AGE_MS,
      disappearAfterReadSeconds:
        bootstrap.disappearAfterReadSeconds ?? DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
      status: "open",
      participantCount: 0,
      creatorJoined: false,
      lastActivityAt: bootstrap.createdAt,
      creatorToken: bootstrap.creatorToken
    };

    this.roomMeta = meta;
    await this.ctx.storage.put(ROOM_META_KEY, meta);
    await this.scheduleNextAlarm();

    return jsonResponse(this.publicMetadata(meta), 201);
  }

  private handleMetadata(): Response {
    if (!this.roomMeta) {
      return jsonResponse({ error: "Room not found." }, 404);
    }

    return jsonResponse(this.publicMetadata(this.roomMeta));
  }

  private async handleJoin(ws: WebSocket, payload: JoinPayload): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      ws.send(JSON.stringify(errorEvent("room_unavailable", "Room is unavailable.")));
      ws.close(4404, "room unavailable");
      return;
    }

    const existing = ws.deserializeAttachment() as AttachmentRecord | null;
    if (existing?.sessionId) {
      ws.send(JSON.stringify(errorEvent("already_joined", "Session already joined.")));
      return;
    }

    const joinedIds = new Set(this.connectedSessionIds());
    if (joinedIds.size >= MAX_CONNECTIONS_PER_ROOM && !joinedIds.has(payload.sessionId)) {
      ws.send(JSON.stringify(errorEvent("room_full", "Room already has two participants.")));
      ws.close(4409, "room full");
      return;
    }

    const creator = payload.creatorToken
      ? payload.creatorToken === this.roomMeta.creatorToken
      : false;

    const session: SessionRecord = {
      sessionId: payload.sessionId,
      creator,
      connectedAt: Date.now(),
      lastSeenAt: Date.now()
    };
    this.sessions.set(payload.sessionId, session);
    await this.ctx.storage.put(`${SESSION_PREFIX}${payload.sessionId}`, session);
    ws.serializeAttachment({ sessionId: payload.sessionId } satisfies AttachmentRecord);

    if (creator) {
      this.roomMeta.creatorJoined = true;
    }
    this.roomMeta.participantCount = this.sessions.size;
    this.roomMeta.lastActivityAt = Date.now();
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);

    const pending = await this.getPendingMessagesFor(payload.sessionId);
    const joinedEvent: ServerEvent = {
      type: "joined",
      room: this.publicMetadata(this.roomMeta),
      sessionId: payload.sessionId,
      creator,
      pending,
      presence: this.presenceSnapshot()
    };
    ws.send(JSON.stringify(joinedEvent));

    for (const stored of pending) {
      if (stored.state === "sent") {
        await this.updateMessageState(stored.envelope.messageId, "delivered", {
          deliveredAt: Date.now()
        });
      }
    }

    await this.broadcastPresence();
    await this.markRoomActivity();
  }

  private async handleSend(ws: WebSocket, payload: SendPayload): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      ws.send(JSON.stringify(errorEvent("room_unavailable", "Room is unavailable.")));
      return;
    }

    const attachment = ws.deserializeAttachment() as AttachmentRecord | null;
    if (!attachment?.sessionId) {
      ws.send(JSON.stringify(errorEvent("join_required", "Join before sending messages.")));
      return;
    }

    const envelope = payload.envelope;
    const payloadBytes = new TextEncoder().encode(envelope.ciphertext).byteLength;
    if (payloadBytes > MAX_MESSAGE_BYTES) {
      ws.send(JSON.stringify(errorEvent("payload_too_large", "Message is too large.")));
      return;
    }

    const messages = await this.listMessages();
    if (messages.length >= MAX_MESSAGES_BUFFERED) {
      ws.send(JSON.stringify(errorEvent("buffer_full", "Message buffer is full.")));
      return;
    }

    const stored: StoredMessage = {
      envelope,
      state: "sent"
    };

    await this.ctx.storage.put(`${MESSAGE_PREFIX}${envelope.messageId}`, stored);
    await this.markRoomActivity();
    await this.broadcastToOtherParticipants(attachment.sessionId, {
      type: "message",
      envelope
    } satisfies MessageEvent);

    if (this.otherConnectedSessionIds(attachment.sessionId).length > 0) {
      await this.updateMessageState(envelope.messageId, "delivered", {
        deliveredAt: Date.now()
      });
    }
  }

  private async handleRead(messageId: string, readerSessionId: string): Promise<void> {
    const key = `${MESSAGE_PREFIX}${messageId}`;
    const stored = await this.ctx.storage.get<StoredMessage>(key);
    if (!stored || stored.state === "expired" || stored.state === "deleted") {
      return;
    }

    if (stored.envelope.senderSessionId === readerSessionId) {
      return;
    }

    const readAt = Date.now();
    const disappearAt = readAt + stored.envelope.expiresAfterReadSeconds * 1000;
    await this.updateMessageState(messageId, "read", {
      readAt,
      disappearAt
    });
    await this.scheduleNextAlarm();
  }

  private async updateMessageState(
    messageId: string,
    state: MessageState,
    extra: Pick<StoredMessage, "readAt" | "disappearAt" | "deliveredAt"> = {}
  ): Promise<void> {
    const key = `${MESSAGE_PREFIX}${messageId}`;
    const stored = await this.ctx.storage.get<StoredMessage>(key);
    if (!stored) {
      return;
    }

    const next: StoredMessage = {
      ...stored,
      state,
      ...extra
    };
    await this.ctx.storage.put(key, next);

    const stateEvent: MessageStateEvent = {
      type: "message_state",
      messageId,
      state,
      deliveredAt: next.deliveredAt,
      readAt: next.readAt,
      disappearAt: next.disappearAt
    };
    this.broadcast(stateEvent);
  }

  private async getPendingMessagesFor(sessionId: string): Promise<StoredMessage[]> {
    const messages = await this.listMessages();
    return messages.filter((stored) => stored.envelope.senderSessionId !== sessionId);
  }

  private async listMessages(): Promise<StoredMessage[]> {
    const stored = await this.ctx.storage.list<StoredMessage>({
      prefix: MESSAGE_PREFIX
    });
    return [...stored.values()].sort((left, right) => left.envelope.sentAt - right.envelope.sentAt);
  }

  private async expireMessages(): Promise<void> {
    const messages = await this.listMessages();
    const now = Date.now();
    for (const stored of messages) {
      if (stored.disappearAt && stored.disappearAt <= now) {
        await this.ctx.storage.delete(`${MESSAGE_PREFIX}${stored.envelope.messageId}`);
        this.broadcast({
          type: "message_state",
          messageId: stored.envelope.messageId,
          state: "expired"
        } satisfies MessageStateEvent);
      }
    }
  }

  private async destroyRoom(reason: string, creatorToken: string): Promise<Response> {
    if (!this.roomMeta) {
      return jsonResponse({ error: "Room not found." }, 404);
    }

    if (creatorToken !== this.roomMeta.creatorToken) {
      return jsonResponse({ error: "Unauthorized." }, 403);
    }

    await this.transitionRoom("destroyed", reason);
    return jsonResponse(this.publicMetadata(this.roomMeta));
  }

  private async transitionRoom(status: "expired" | "destroyed", reason: string): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      return;
    }

    this.roomMeta.status = status;
    this.roomMeta.destroyedAt = Date.now();
    this.roomMeta.lastActivityAt = Date.now();
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);
    await this.ctx.storage.deleteAlarm();

    this.broadcast({
      type: "room_state",
      status,
      expiresAt: this.roomMeta.expiresAt,
      reason
    } satisfies RoomStateEvent);

    for (const socket of this.ctx.getWebSockets()) {
      socket.close(4000, status);
    }
  }

  private async markRoomActivity(): Promise<void> {
    if (!this.roomMeta) {
      return;
    }

    this.roomMeta.lastActivityAt = Date.now();
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);
    await this.scheduleNextAlarm();
  }

  private async scheduleNextAlarm(): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      return;
    }

    const messages = await this.listMessages();
    const nextMessageExpiry = messages
      .map((message) => message.disappearAt)
      .filter((value): value is number => typeof value === "number")
      .sort((left, right) => left - right)[0];

    const candidates = [
      this.roomMeta.expiresAt,
      this.roomMeta.lastActivityAt + this.roomMeta.inactivityTimeoutMs,
      this.connectedSessionIds().length === 0
        ? this.roomMeta.lastActivityAt + DISCONNECT_GRACE_MS
        : undefined,
      nextMessageExpiry
    ].filter((value): value is number => typeof value === "number");

    const nextAlarmAt = Math.min(...candidates);
    await this.ctx.storage.setAlarm(nextAlarmAt);
  }

  private broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  private async broadcastPresence(): Promise<void> {
    if (!this.roomMeta) {
      return;
    }
    this.roomMeta.participantCount = this.sessions.size;
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);

    this.broadcast({
      type: "presence",
      presence: this.presenceSnapshot()
    } satisfies PresenceEvent);
  }

  private async broadcastToOtherParticipants(
    senderSessionId: string,
    event: ServerEvent
  ): Promise<void> {
    const targets = this.otherConnectedSessionIds(senderSessionId);
    this.broadcastToSessions(targets, event);
  }

  private broadcastToSessions(sessionIds: string[], event: ServerEvent): void {
    const payload = JSON.stringify(event);
    const allowed = new Set(sessionIds);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as AttachmentRecord | null;
      if (attachment?.sessionId && allowed.has(attachment.sessionId)) {
        socket.send(payload);
      }
    }
  }

  private presenceSnapshot(): PresenceSnapshot {
    return {
      count: this.connectedSessionIds().length,
      connectedSessionIds: this.connectedSessionIds()
    };
  }

  private connectedSessionIds(): string[] {
    return this.ctx
      .getWebSockets()
      .map((socket) => (socket.deserializeAttachment() as AttachmentRecord | null)?.sessionId ?? "")
      .filter(Boolean);
  }

  private otherConnectedSessionIds(senderSessionId: string): string[] {
    return this.connectedSessionIds().filter((sessionId) => sessionId !== senderSessionId);
  }

  private publicMetadata(meta: RoomStorage): RoomMetadata {
    return {
      roomId: meta.roomId,
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
      inactivityTimeoutMs: meta.inactivityTimeoutMs,
      maxAgeMs: meta.maxAgeMs,
      disappearAfterReadSeconds: meta.disappearAfterReadSeconds,
      status: meta.status,
      participantCount: this.connectedSessionIds().length,
      creatorJoined: meta.creatorJoined,
      lastActivityAt: meta.lastActivityAt,
      destroyedAt: meta.destroyedAt
    };
  }
}
