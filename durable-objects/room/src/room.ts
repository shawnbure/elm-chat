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
  type ServerEvent
} from "@elm-chat/shared";
import { DurableObject } from "cloudflare:workers";
import { roomExpiryReason } from "./expiry";

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
  GROWTH?: AnalyticsEngineDataset;
  ROOM_OBJECT: DurableObjectNamespace<RoomDurableObject>;
}

const ROOM_META_KEY = "room:meta";
const INVITES_KEY = "room:invites";
const DEFAULT_INVITE_TTL_MS = 10 * 60 * 1000;
const JOIN_TIMEOUT_MS = 15 * 1000;

type InviteAdmission =
  | { ok: true; invite?: RoomInvite; newlyClaimed: boolean }
  | { ok: false; code: string; message: string; closeReason: string };

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
      const creatorToken = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]+)$/i)?.[1] ?? "";
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

      if (await this.expireIfDue() || !this.roomMeta || this.roomMeta.status !== "open") {
        return jsonResponse({ error: "Room is unavailable." }, 410);
      }

      if (this.openWebSockets().length >= MAX_CONNECTIONS_PER_ROOM) {
        return jsonResponse({ error: "Room is full." }, 409);
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        sessionId: "",
        creator: false,
        identityKey: "",
        connectedAt: Date.now()
      } satisfies AttachmentRecord);
      await this.scheduleNextAlarm();
      return wsResponse(client);
    }

    return jsonResponse({ error: "Not found." }, 404);
  }

  async alarm(): Promise<void> {
    await this.storageReady;
    if (await this.expireIfDue()) return;
    const now = Date.now();
    for (const socket of this.openWebSockets()) {
      const attachment = socket.deserializeAttachment() as AttachmentRecord | null;
      if (attachment?.sessionId === "" && attachment.connectedAt + JOIN_TIMEOUT_MS <= now) {
        socket.close(4408, "join timeout");
      }
    }
    await this.scheduleNextAlarm();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.storageReady;
    if (await this.expireIfDue()) return;
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
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      ws.send(JSON.stringify(errorEvent("invalid_event", "Message must be a room event.")));
      return;
    }

    const attachment = ws.deserializeAttachment() as AttachmentRecord | null;
    if (parsed.type !== "join" && !attachment?.sessionId) {
      ws.send(JSON.stringify(errorEvent("join_required", "Join before sending room events.")));
      ws.close(4403, "join required");
      return;
    }

    switch (parsed.type) {
      case "join":
        await this.handleJoin(ws, parsed);
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
      await this.scheduleNextAlarm();
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

    if (
      !existing ||
      existing.connectedAt + JOIN_TIMEOUT_MS <= Date.now() ||
      typeof payload.sessionId !== "string" ||
      !payload.sessionId ||
      typeof payload.identityKey !== "string" ||
      !payload.identityKey
    ) {
      ws.send(JSON.stringify(errorEvent("invalid_join", "Join was invalid or timed out.")));
      ws.close(4408, "invalid join");
      return;
    }

    const creator = payload.creatorToken === this.roomMeta.creatorToken;
    const admission = await this.reserveInviteForJoin(creator, payload);
    if (!admission.ok) {
      ws.send(JSON.stringify(errorEvent(admission.code, admission.message)));
      ws.close(4403, admission.closeReason);
      return;
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

    if (admission.invite && !admission.invite.consumedAt) {
      const admittedAt = Date.now();
      admission.invite.admittedAt = admittedAt;
      admission.invite.consumedAt = admittedAt;
      admission.invite.consumedBySessionId = payload.sessionId;
      this.invites.set(admission.invite.token, admission.invite);
      await this.persistInvites();
      if (admission.newlyClaimed) {
        this.env.GROWTH?.writeDataPoint({
          indexes: ["invite_redeemed"],
          blobs: [""],
          doubles: [1]
        });
      }
    }

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

  private async reserveInviteForJoin(
    creator: boolean,
    payload: JoinPayload
  ): Promise<InviteAdmission> {
    if (creator) {
      return { ok: true, newlyClaimed: false };
    }

    const invite = payload.inviteToken ? this.invites.get(payload.inviteToken) : undefined;
    const now = Date.now();
    if (!invite || invite.revokedAt || invite.expiresAt <= now) {
      return {
        ok: false,
        code: "invite_required",
        message: "A valid one-time invite is required.",
        closeReason: "invite required"
      };
    }

    if (invite.consumedAt) {
      if (invite.consumedBySessionId === payload.sessionId) {
        return { ok: true, invite, newlyClaimed: false };
      }
      return {
        ok: false,
        code: "invite_used",
        message: "This one-time invite has already admitted another session.",
        closeReason: "invite used"
      };
    }

    if (invite.claimedAt) {
      if (invite.claimedBySessionId === payload.sessionId) {
        return { ok: true, invite, newlyClaimed: false };
      }
      return {
        ok: false,
        code: "invite_claimed",
        message: "This one-time invite is already being used by another session.",
        closeReason: "invite claimed"
      };
    }

    invite.claimedAt = now;
    invite.claimedBySessionId = payload.sessionId;
    this.invites.set(invite.token, invite);
    await this.persistInvites();
    return { ok: true, invite, newlyClaimed: true };
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

  private async expireIfDue(): Promise<boolean> {
    if (!this.roomMeta || this.roomMeta.status !== "open") return false;
    const reason = roomExpiryReason(this.roomMeta, Date.now(), this.connectedSessionIds().length);
    if (!reason) return false;
    await this.transitionRoom("expired", reason);
    return true;
  }

  private async markRoomActivity(): Promise<void> {
    if (!this.roomMeta || this.roomMeta.status !== "open") {
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
        : undefined,
      ...this.openWebSockets()
        .map((socket) => socket.deserializeAttachment() as AttachmentRecord | null)
        .filter((attachment): attachment is AttachmentRecord => attachment?.sessionId === "")
        .map((attachment) => attachment.connectedAt + JOIN_TIMEOUT_MS)
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
      this.sendIfOpen(socket, payload);
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
        this.sendIfOpen(socket, payload);
      }
    }
  }

  private sendIfOpen(socket: WebSocket, payload: string): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      socket.send(payload);
    } catch {
      // A peer can close between the readyState check and send. Its close
      // callback will update presence, so one failed broadcast should not fail
      // the room event that triggered it.
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
    for (const socket of this.openWebSockets()) {
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

  private openWebSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((socket) => socket.readyState === WebSocket.OPEN);
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
