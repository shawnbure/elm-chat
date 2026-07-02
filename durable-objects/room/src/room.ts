import {
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  MAX_CONNECTIONS_PER_ROOM,
  type ClientEvent,
  type CreateRoomResponse,
  type ErrorEventPayload,
  type JoinPayload,
  type KickParticipantPayload,
  type ParticipantKickedEvent,
  type PeerDataRelayEvent,
  type PeerDataRelayPayload,
  type PeerDescriptor,
  type PeerJoinedEvent,
  type PeerLeftEvent,
  type PresenceEvent,
  type PresenceSnapshot,
  type RoomInvite,
  type RoomMetadata,
  type RoomStateEvent,
  type ServerEvent,
  type SignalEvent,
  type SignalPayload
} from "@elm-chat/shared";
import { DurableObject } from "cloudflare:workers";

type RoomStorage = RoomMetadata & {
  creatorToken: string;
};

// Stored on each accepted WebSocket via serializeAttachment. This survives
// Durable Object hibernation, so it — not an in-memory map — is the source of
// truth for who is connected. An empty sessionId marks a socket that has been
// accepted but has not completed a join yet.
type AttachmentRecord = {
  sessionId: string;
  creator: boolean;
  identityKey: string;
  connectedAt: number;
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
const INVITES_KEY = "room:invites";
const DEFAULT_INVITE_TTL_MS = 10 * 60 * 1000;

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
  return { type: "error", code, message };
}

async function safeJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export class RoomDurableObject extends DurableObject<Env> {
  private roomMeta: RoomStorage | null = null;
  private invites = new Map<string, RoomInvite>();
  private storageReady: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storageReady = this.ctx.blockConcurrencyWhile(async () => {
      this.roomMeta = (await this.ctx.storage.get<RoomStorage>(ROOM_META_KEY)) ?? null;
      this.invites = new Map((await this.ctx.storage.get<[string, RoomInvite][]>(INVITES_KEY)) ?? []);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.storageReady;

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/internal/bootstrap") {
      return this.bootstrapRoom(await safeJson<RoomBootstrap>(request));
    }

    if (request.method === "GET" && url.pathname === "/internal/metadata") {
      return this.handleMetadata();
    }

    if (request.method === "POST" && url.pathname === "/internal/destroy") {
      const payload = await safeJson<{ creatorToken: string }>(request);
      return this.destroyRoom("destroyed", payload.creatorToken);
    }

    if (request.method === "POST" && url.pathname === "/internal/invites/create") {
      const payload = await safeJson<{ creatorToken: string; ttlMs?: number }>(request);
      return this.createInvite(payload.creatorToken, payload.ttlMs);
    }

    if (request.method === "GET" && url.pathname === "/internal/invites") {
      const creatorToken = url.searchParams.get("creatorToken") ?? "";
      return this.listInvites(creatorToken);
    }

    if (request.method === "POST" && url.pathname === "/internal/invites/revoke") {
      const payload = await safeJson<{ creatorToken: string; token: string }>(request);
      return this.revokeInvite(payload.creatorToken, payload.token);
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
      server.serializeAttachment({
        sessionId: "",
        creator: false,
        identityKey: "",
        connectedAt: 0
      } satisfies AttachmentRecord);
      await this.markRoomActivity();
      return wsResponse(client);
    }

    return jsonResponse({ error: "Not found." }, 404);
  }

  async alarm(): Promise<void> {
    await this.storageReady;
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      return;
    }

    const now = Date.now();
    const idleFor = now - this.roomMeta.lastActivityAt;

    if (typeof this.roomMeta.expiresAt === "number" && now >= this.roomMeta.expiresAt) {
      await this.transitionRoom("expired", "max-age");
      return;
    }

    if (
      typeof this.roomMeta.inactivityTimeoutMs === "number" &&
      idleFor >= this.roomMeta.inactivityTimeoutMs
    ) {
      await this.transitionRoom(
        "expired",
        this.connectedSessionIds().length === 0 ? "join-timeout" : "inactive"
      );
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
      case "signal":
        await this.handleSignal(ws, parsed);
        break;
      case "peer_data":
        await this.handlePeerData(ws, parsed);
        break;
      case "destroy":
        await this.destroyRoom("destroyed", parsed.creatorToken);
        break;
      case "kick_participant":
        await this.kickParticipant(ws, parsed);
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

    await this.markRoomActivity();
    this.broadcast({
      type: "peer_left",
      sessionId: attachment.sessionId
    } satisfies PeerLeftEvent);
    await this.broadcastPresence();
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
      maxAgeMs: bootstrap.maxAgeMs ?? null,
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

    const connectedIds = new Set(this.connectedSessionIds());
    if (connectedIds.size >= MAX_CONNECTIONS_PER_ROOM && !connectedIds.has(payload.sessionId)) {
      ws.send(JSON.stringify(errorEvent("room_full", "Room is at capacity.")));
      ws.close(4409, "room full");
      return;
    }

    const creator = payload.creatorToken === this.roomMeta.creatorToken;
    if (!creator) {
      const invite = payload.inviteToken ? this.invites.get(payload.inviteToken) : undefined;
      const now = Date.now();
      // The session that already consumed this invite may reconnect (e.g. a page
      // reload) as long as the invite has not been revoked. A brand-new session
      // must present an invite that is unrevoked, unconsumed, and unexpired.
      const isReconnectingConsumer =
        !!invite && !invite.revokedAt && invite.consumedBySessionId === payload.sessionId;
      if (!isReconnectingConsumer) {
        if (!invite || invite.revokedAt || invite.consumedAt || invite.expiresAt <= now) {
          ws.send(JSON.stringify(errorEvent("invite_required", "A valid one-time invite is required.")));
          ws.close(4403, "invite required");
          return;
        }
        invite.consumedAt = now;
        invite.consumedBySessionId = payload.sessionId;
        this.invites.set(invite.token, invite);
        await this.persistInvites();
      }
    }

    const session: AttachmentRecord = {
      sessionId: payload.sessionId,
      creator,
      connectedAt: Date.now(),
      identityKey: payload.identityKey
    };
    ws.serializeAttachment(session satisfies AttachmentRecord);

    if (creator) {
      this.roomMeta.creatorJoined = true;
    }
    this.roomMeta.participantCount = this.connectedSessionIds().length;
    this.roomMeta.lastActivityAt = Date.now();
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);

    const peers = this.connectedSessions()
      .filter((peer) => peer.sessionId !== payload.sessionId)
      .sort((left, right) => left.connectedAt - right.connectedAt)
      .map((peer) => this.describePeer(peer));

    ws.send(
      JSON.stringify({
        type: "joined",
        room: this.publicMetadata(this.roomMeta),
        sessionId: payload.sessionId,
        creator,
        peers,
        presence: this.presenceSnapshot()
      } satisfies ServerEvent)
    );

    this.broadcastToOtherParticipants(payload.sessionId, {
      type: "peer_joined",
      peer: this.describePeer(session)
    } satisfies PeerJoinedEvent);

    await this.broadcastPresence();
    await this.markRoomActivity();
  }

  private async handleSignal(ws: WebSocket, payload: SignalPayload): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      ws.send(JSON.stringify(errorEvent("room_unavailable", "Room is unavailable.")));
      return;
    }

    const attachment = ws.deserializeAttachment() as AttachmentRecord | null;
    if (!attachment?.sessionId) {
      ws.send(JSON.stringify(errorEvent("join_required", "Join before sending peer signals.")));
      return;
    }

    if (!this.isConnected(payload.toSessionId)) {
      ws.send(JSON.stringify(errorEvent("peer_missing", "Peer is no longer connected.")));
      return;
    }

    this.broadcastToSessions([payload.toSessionId], {
      type: "signal",
      fromSessionId: attachment.sessionId,
      signal: payload.signal
    } satisfies SignalEvent);
    await this.markRoomActivity();
  }

  private async handlePeerData(ws: WebSocket, payload: PeerDataRelayPayload): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      ws.send(JSON.stringify(errorEvent("room_unavailable", "Room is unavailable.")));
      return;
    }

    const attachment = ws.deserializeAttachment() as AttachmentRecord | null;
    if (!attachment?.sessionId) {
      ws.send(JSON.stringify(errorEvent("join_required", "Join before relaying peer data.")));
      return;
    }

    const event = {
      type: "peer_data",
      fromSessionId: attachment.sessionId,
      data: payload.data
    } satisfies PeerDataRelayEvent;

    if (payload.toSessionId) {
      if (!this.isConnected(payload.toSessionId)) {
        ws.send(JSON.stringify(errorEvent("peer_missing", "Peer is no longer connected.")));
        return;
      }
      this.broadcastToSessions([payload.toSessionId], event);
    } else {
      this.broadcastToOtherParticipants(attachment.sessionId, event);
    }

    await this.markRoomActivity();
  }

  private async kickParticipant(ws: WebSocket, payload: KickParticipantPayload): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
      ws.send(JSON.stringify(errorEvent("room_unavailable", "Room is unavailable.")));
      return;
    }
    if (payload.creatorToken !== this.roomMeta.creatorToken) {
      ws.send(JSON.stringify(errorEvent("unauthorized", "Only the creator can kick participants.")));
      return;
    }
    const target = payload.targetSessionId;
    if (!this.isConnected(target)) {
      ws.send(JSON.stringify(errorEvent("peer_missing", "Participant is no longer connected.")));
      return;
    }
    await this.disconnectSession(target, "removed-by-creator", "kicked");
  }

  private async createInvite(creatorToken: string, ttlMs?: number): Promise<Response> {
    if (!this.roomMeta) {
      return jsonResponse({ error: "Room not found." }, 404);
    }
    if (creatorToken !== this.roomMeta.creatorToken) {
      return jsonResponse({ error: "Unauthorized." }, 403);
    }
    const now = Date.now();
    const token = crypto.randomUUID();
    const invite: RoomInvite = {
      token,
      createdAt: now,
      expiresAt: now + Math.max(60_000, ttlMs ?? DEFAULT_INVITE_TTL_MS)
    };
    this.invites.set(token, invite);
    await this.persistInvites();
    return jsonResponse(invite, 201);
  }

  private listInvites(creatorToken: string): Response {
    if (!this.roomMeta) {
      return jsonResponse({ error: "Room not found." }, 404);
    }
    if (creatorToken !== this.roomMeta.creatorToken) {
      return jsonResponse({ error: "Unauthorized." }, 403);
    }
    return jsonResponse(
      [...this.invites.values()].sort((left, right) => right.createdAt - left.createdAt)
    );
  }

  private async revokeInvite(creatorToken: string, token: string): Promise<Response> {
    if (!this.roomMeta) {
      return jsonResponse({ error: "Room not found." }, 404);
    }
    if (creatorToken !== this.roomMeta.creatorToken) {
      return jsonResponse({ error: "Unauthorized." }, 403);
    }
    const invite = this.invites.get(token);
    if (!invite) {
      return jsonResponse({ error: "Invite not found." }, 404);
    }
    invite.revokedAt = Date.now();
    this.invites.set(token, invite);
    await this.persistInvites();
    if (invite.consumedBySessionId && this.isConnected(invite.consumedBySessionId)) {
      await this.disconnectSession(invite.consumedBySessionId, "invite-revoked", "invite revoked");
    }
    return jsonResponse(invite);
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

    const candidates = [
      this.roomMeta.expiresAt,
      typeof this.roomMeta.inactivityTimeoutMs === "number"
        ? this.roomMeta.lastActivityAt + this.roomMeta.inactivityTimeoutMs
        : undefined
    ].filter((value): value is number => typeof value === "number");

    if (candidates.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(Math.min(...candidates));
  }

  private async persistInvites(): Promise<void> {
    await this.ctx.storage.put(INVITES_KEY, [...this.invites.entries()]);
  }

  private async broadcastPresence(): Promise<void> {
    if (!this.roomMeta) {
      return;
    }

    this.roomMeta.participantCount = this.connectedSessionIds().length;
    await this.ctx.storage.put(ROOM_META_KEY, this.roomMeta);
    this.broadcast({
      type: "presence",
      presence: this.presenceSnapshot()
    } satisfies PresenceEvent);
  }

  private async disconnectSession(
    targetSessionId: string,
    reason: string,
    closeReason: string
  ): Promise<void> {
    this.broadcastToSessions([targetSessionId], {
      type: "participant_kicked",
      sessionId: targetSessionId,
      reason
    } satisfies ParticipantKickedEvent);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as AttachmentRecord | null;
      if (attachment?.sessionId === targetSessionId) {
        socket.close(4403, closeReason);
      }
    }
    this.broadcast({
      type: "peer_left",
      sessionId: targetSessionId
    } satisfies PeerLeftEvent);
    await this.broadcastPresence();
    await this.markRoomActivity();
  }

  private broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  private broadcastToOtherParticipants(senderSessionId: string, event: ServerEvent): void {
    const targets = this.connectedSessionIds().filter((sessionId) => sessionId !== senderSessionId);
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
    const ids = this.connectedSessionIds();
    return {
      count: ids.length,
      connectedSessionIds: ids
    };
  }

  // Source of truth for connected participants, derived from live WebSockets so
  // it survives Durable Object hibernation. Deduplicated by session id.
  private connectedSessions(): AttachmentRecord[] {
    const seen = new Set<string>();
    const sessions: AttachmentRecord[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as AttachmentRecord | null;
      if (attachment?.sessionId && !seen.has(attachment.sessionId)) {
        seen.add(attachment.sessionId);
        sessions.push(attachment);
      }
    }
    return sessions;
  }

  private connectedSessionIds(): string[] {
    return this.connectedSessions().map((session) => session.sessionId);
  }

  private isConnected(sessionId: string): boolean {
    return this.connectedSessions().some((session) => session.sessionId === sessionId);
  }

  private describePeer(peer: AttachmentRecord): PeerDescriptor {
    return {
      sessionId: peer.sessionId,
      creator: peer.creator,
      connectedAt: peer.connectedAt,
      identityKey: peer.identityKey
    };
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
