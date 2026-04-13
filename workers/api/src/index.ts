import {
  DEFAULT_STUN_ICE_SERVERS,
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  ROOM_ID_BYTES,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type TurnCredentialsResponse
} from "@elm-chat/shared";
import { RoomDurableObject } from "../../../durable-objects/room/src/room";

export { RoomDurableObject };

type Env = {
  ASSETS: Fetcher;
  ROOM_OBJECT: DurableObjectNamespace<RoomDurableObject>;
  TURN_SECRET?: string;
  TURN_URLS?: string;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "default-src 'self'; connect-src 'self' https: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_BYTES);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function parseTurnUrls(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function safeJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function buildRoomUrl(request: Request, roomId: string): string {
  const url = new URL(request.url);
  return `${url.origin}/c/${roomId}`;
}

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const body = await safeJson<CreateRoomRequest>(request).catch(() => ({} as CreateRoomRequest));

  // Abuse-prevention hook: verify Turnstile token here.
  const now = Date.now();
  const roomId = randomRoomId();
  const creatorToken = randomToken();
  const disappearAfterReadSeconds =
    body.disappearAfterReadSeconds === undefined
      ? DEFAULT_DISAPPEAR_AFTER_READ_SECONDS
      : body.disappearAfterReadSeconds;
  const inactivityTimeoutMs =
    body.inactivityTimeoutMs === undefined ? DEFAULT_INACTIVITY_TIMEOUT_MS : body.inactivityTimeoutMs;
  const maxAgeMs = body.maxAgeMs === undefined ? null : body.maxAgeMs;
  const expiresAt = typeof maxAgeMs === "number" ? now + maxAgeMs : null;
  const response: CreateRoomResponse = {
    roomId,
    roomUrl: buildRoomUrl(request, roomId),
    websocketPath: `/api/rooms/${roomId}/ws`,
    createdAt: now,
    expiresAt,
    inactivityTimeoutMs,
    maxAgeMs,
    disappearAfterReadSeconds,
    creatorToken
  };

  const stub = env.ROOM_OBJECT.getByName(roomId);
  await stub.fetch("https://room/internal/bootstrap", {
    method: "POST",
    body: JSON.stringify(response)
  });

  return json(response, 201);
}

async function handleGetRoom(roomId: string, env: Env): Promise<Response> {
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch("https://room/internal/metadata");
}

async function handleDestroyRoom(request: Request, roomId: string, env: Env): Promise<Response> {
  const { creatorToken } = await safeJson<{ creatorToken: string }>(request);
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch("https://room/internal/destroy", {
    method: "POST",
    body: JSON.stringify({ creatorToken })
  });
}

async function handleRoomWebSocket(request: Request, roomId: string, env: Env): Promise<Response> {
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch("https://room/ws", request);
}

async function handleCreateInvite(request: Request, roomId: string, env: Env): Promise<Response> {
  const payload = await safeJson<{ creatorToken: string; ttlMs?: number }>(request);
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch("https://room/internal/invites/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function handleListInvites(request: Request, roomId: string, env: Env): Promise<Response> {
  const creatorToken = new URL(request.url).searchParams.get("creatorToken") ?? "";
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch(`https://room/internal/invites?creatorToken=${encodeURIComponent(creatorToken)}`);
}

async function handleRevokeInvite(request: Request, roomId: string, env: Env): Promise<Response> {
  const payload = await safeJson<{ creatorToken: string; token: string }>(request);
  const stub = env.ROOM_OBJECT.getByName(roomId);
  return stub.fetch("https://room/internal/invites/revoke", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function handleTurnCredentials(env: Env): Promise<Response> {
  const ttlSeconds = 600;
  const iceServers = [...DEFAULT_STUN_ICE_SERVERS];
  const turnUrls = parseTurnUrls(env.TURN_URLS);

  if (env.TURN_SECRET && turnUrls.length > 0) {
    const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}:${crypto.randomUUID()}`;
    const credential = await hmacSha1Base64(env.TURN_SECRET, username);
    iceServers.push({
      urls: turnUrls,
      username,
      credential
    });
  }

  return json({
    iceServers,
    ttlSeconds
  } satisfies TurnCredentialsResponse);
}

function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    return handleCreateRoom(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/turn-credentials") {
    return handleTurnCredentials(env);
  }

  const revokeMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/invites\/revoke$/);
  if (revokeMatch && request.method === "POST") {
    return handleRevokeInvite(request, revokeMatch[1], env);
  }

  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(destroy|ws|invites))?$/);
  if (!match) {
    return Promise.resolve(json({ error: "Not found." }, 404));
  }

  const roomId = match[1];
  const action = match[2];

  if (request.method === "GET" && !action) {
    return handleGetRoom(roomId, env);
  }

  if (request.method === "POST" && action === "destroy") {
    return handleDestroyRoom(request, roomId, env);
  }

  if (action === "invites" && request.method === "POST") {
    return handleCreateInvite(request, roomId, env);
  }

  if (action === "invites" && request.method === "GET") {
    return handleListInvites(request, roomId, env);
  }
  if (request.method === "GET" && action === "ws") {
    return handleRoomWebSocket(request, roomId, env);
  }

  return Promise.resolve(json({ error: "Method not allowed." }, 405));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        const response = await routeApi(request, env);
        return isWebSocketUpgrade(request) ? response : withSecurityHeaders(response);
      } catch {
        return withSecurityHeaders(json({ error: "Internal error." }, 500));
      }
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
