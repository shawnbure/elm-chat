import {
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  ROOM_ID_BYTES,
  type CreateRoomRequest,
  type CreateRoomResponse
} from "@elm-chat/shared";
import { RoomDurableObject } from "../../../durable-objects/room/src/room";
import { reviewRoomCreation, type AntiAbuseEnv } from "./anti-abuse";

export { RoomDurableObject };

type Env = {
  ASSETS: Fetcher;
  ROOM_OBJECT: DurableObjectNamespace<RoomDurableObject>;
  TURNSTILE_SECRET?: string;
} & AntiAbuseEnv;

function json(payload: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  // Strict, third-party-free policy on every route: no external scripts, no
  // analytics beacons, no trackers anywhere in the app.
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' https: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
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

async function safeJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function buildRoomUrl(request: Request, roomId: string): string {
  const url = new URL(request.url);
  return `${url.origin}/c/${roomId}`;
}

async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  remoteIp: string | null
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) {
    form.append("remoteip", remoteIp);
  }
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      return false;
    }
    const outcome = (await response.json()) as { success?: boolean };
    return outcome.success === true;
  } catch {
    return false;
  }
}

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const body = await safeJson<CreateRoomRequest>(request).catch(() => ({} as CreateRoomRequest));

  // Abuse prevention: when a Turnstile secret is configured, require a valid
  // token. Without a secret (e.g. local dev) creation stays open.
  if (env.TURNSTILE_SECRET) {
    const passed = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      body.turnstileToken,
      request.headers.get("CF-Connecting-IP")
    );
    if (!passed) {
      return json({ error: "Bot verification failed. Please try again." }, 403);
    }
  }

  const antiAbuseDecision = await reviewRoomCreation(request, body, env);
  if (!antiAbuseDecision.allowed) {
    const headers = new Headers();
    if (antiAbuseDecision.retryAfterSeconds) {
      headers.set("retry-after", String(antiAbuseDecision.retryAfterSeconds));
    }
    return json(
      { error: antiAbuseDecision.message ?? "Room creation was blocked." },
      antiAbuseDecision.status ?? 403,
      headers
    );
  }

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

const GITHUB_REPO = "shawnbure/elm-chat";
const GITHUB_STATS_TTL_MS = 60 * 60 * 1000;

// Cached in the isolate so repeated visitors don't each trigger a GitHub call.
let githubStatsCache: { at: number; stars: number | null; forks: number | null } | null = null;

// Server-side proxy for the repo's star/fork counts. Fetched from GitHub by the
// Worker, so visitors' browsers never contact GitHub — keeping the landing page
// free of third-party requests and tracking.
async function handleGithubStats(): Promise<Response> {
  const now = Date.now();
  if (!githubStatsCache || now - githubStatsCache.at > GITHUB_STATS_TTL_MS) {
    let stars: number | null = null;
    let forks: number | null = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
        headers: {
          "user-agent": "elm-chat",
          accept: "application/vnd.github+json"
        }
      });
      if (res.ok) {
        const data = (await res.json()) as { stargazers_count?: number; forks_count?: number };
        stars = typeof data.stargazers_count === "number" ? data.stargazers_count : null;
        forks = typeof data.forks_count === "number" ? data.forks_count : null;
      }
    } catch {
      // Fall through to nulls; the client hides counts it cannot load.
    }
    // Keep a short TTL on failures so a transient error doesn't stick for an hour.
    githubStatsCache = { at: stars === null ? now - GITHUB_STATS_TTL_MS + 5 * 60 * 1000 : now, stars, forks };
  }

  return json({
    repo: GITHUB_REPO,
    stars: githubStatsCache.stars,
    forks: githubStatsCache.forks
  });
}

function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    return handleCreateRoom(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/stars") {
    return handleGithubStats();
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

    // Every route runs through the Worker (run_worker_first) so security
    // headers apply consistently, including the landing page.
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
