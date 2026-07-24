import { DurableObject } from "cloudflare:workers";

type Env = {
  RATE_LIMITER: DurableObjectNamespace<RateLimitBucket>;
  SHARED_SECRET?: string;
  ROOM_CREATES_PER_HOUR?: string;
  BLOCKED_COUNTRIES?: string;
};

type RoomCreationEvent = {
  version: 1;
  event: "room_create";
  occurredAt: number;
  clientFingerprint: string;
  country: string | null;
  colo: string | null;
  userAgentFamily: string | null;
  roomPolicy: {
    disappearAfterReadSeconds?: number | null;
    inactivityTimeoutMs?: number | null;
    maxAgeMs?: number | null;
  };
};

type RateLimitCheck = {
  key: string;
  limit: number;
  windowMs: number;
  now: number;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const DEFAULT_ROOM_CREATES_PER_HOUR = 30;
const ROOM_CREATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_EVENT_AGE_MS = 5 * 60 * 1000;

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("content-type", "application/json; charset=utf-8");
  nextHeaders.set("cache-control", "no-store");
  nextHeaders.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload), { status, headers: nextHeaders });
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function blockedCountries(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean)
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let result = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return result === 0;
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function verifySignature(request: Request, rawBody: string, secret: string): Promise<boolean> {
  const signature = request.headers.get("x-elm-chat-signature") ?? "";
  const expected = `sha256=${await hmacSha256(secret, rawBody)}`;
  return constantTimeEqual(signature, expected);
}

async function checkRateLimit(env: Env, key: string, limit: number, now: number): Promise<Response> {
  if (limit === 0) {
    return json({ action: "allow" });
  }

  const stub = env.RATE_LIMITER.getByName("room-create");
  const response = await stub.fetch("https://rate-limit.local/check", {
    method: "POST",
    body: JSON.stringify({
      key,
      limit,
      windowMs: ROOM_CREATE_WINDOW_MS,
      now
    } satisfies RateLimitCheck)
  });

  if (response.status === 429) {
    const payload = (await response.json().catch(() => ({}))) as { retryAfterSeconds?: number };
    return json(
      {
        action: "deny",
        reason: "Too many rooms have been created from this client recently.",
        retryAfterSeconds: payload.retryAfterSeconds
      },
      200
    );
  }

  if (!response.ok) {
    return json({ action: "deny", reason: "Rate limit check failed." }, 200);
  }

  return json({ action: "allow" });
}

async function handleRoomCreation(request: Request, env: Env): Promise<Response> {
  if (!env.SHARED_SECRET) {
    return json({ error: "SHARED_SECRET is required." }, 500);
  }

  const rawBody = await request.text();
  if (!(await verifySignature(request, rawBody, env.SHARED_SECRET))) {
    return json({ error: "Invalid signature." }, 401);
  }

  const event = JSON.parse(rawBody) as RoomCreationEvent;
  if (
    event.version !== 1 ||
    event.event !== "room_create" ||
    !event.clientFingerprint ||
    Math.abs(Date.now() - event.occurredAt) > MAX_EVENT_AGE_MS
  ) {
    return json({ action: "deny", reason: "Invalid anti-abuse event." }, 200);
  }

  if (event.country && blockedCountries(env.BLOCKED_COUNTRIES).has(event.country.toUpperCase())) {
    return json({ action: "deny", reason: "Room creation is unavailable from this location." }, 200);
  }

  const limit = parseNonNegativeInteger(env.ROOM_CREATES_PER_HOUR, DEFAULT_ROOM_CREATES_PER_HOUR);
  return checkRateLimit(env, event.clientFingerprint, limit, Date.now());
}

export class RateLimitBucket extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/check") {
      return json({ error: "Not found." }, 404);
    }

    const body = (await request.json()) as RateLimitCheck;
    if (!body.key || body.limit < 1 || body.windowMs < 1 || body.now < 1) {
      return json({ error: "Invalid rate limit check." }, 400);
    }

    const current = await this.ctx.storage.get<RateLimitRecord>(body.key);
    const resetAt = current && current.resetAt > body.now ? current.resetAt : body.now + body.windowMs;
    const count = current && current.resetAt > body.now ? current.count + 1 : 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - body.now) / 1000));

    await this.ctx.storage.put(body.key, { count, resetAt } satisfies RateLimitRecord);

    if (count > body.limit) {
      return json({ allowed: false, retryAfterSeconds }, 429);
    }

    return json({ allowed: true, remaining: body.limit - count, resetAt });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/room-creation") {
      try {
        return await handleRoomCreation(request, env);
      } catch {
        return json({ error: "Anti-abuse service error." }, 500);
      }
    }
    return json({ error: "Not found." }, 404);
  }
};
