import type { CreateRoomRequest } from "@elm-chat/shared";

type AntiAbuseHookPayload = {
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

type AntiAbuseHookResponse = {
  action?: "allow" | "deny";
  reason?: string;
  retryAfterSeconds?: number;
};

export type AntiAbuseDecision = {
  allowed: boolean;
  status?: number;
  message?: string;
  retryAfterSeconds?: number;
};

export type AntiAbuseEnv = {
  ANTI_ABUSE_SERVICE_URL?: string;
  ANTI_ABUSE_SHARED_SECRET?: string;
  ANTI_ABUSE_TIMEOUT_MS?: string;
  ANTI_ABUSE_FAIL_CLOSED?: string;
  ANTI_ABUSE_REQUIRED?: string;
};

const DEFAULT_SERVICE_TIMEOUT_MS = 1500;

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function userAgentFamily(request: Request): string | null {
  const ua = request.headers.get("User-Agent");
  if (!ua) {
    return null;
  }
  return ua.split(/[ /;]/, 1)[0]?.slice(0, 64) || null;
}

function cfMetadata(request: Request): { country: string | null; colo: string | null } {
  const cf = (request as Request & { cf?: { country?: unknown; colo?: unknown } }).cf;
  return {
    country: typeof cf?.country === "string" ? cf.country : null,
    colo: typeof cf?.colo === "string" ? cf.colo : null
  };
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

async function clientFingerprint(request: Request, secret: string): Promise<string> {
  const material = `${request.headers.get("CF-Connecting-IP") ?? "unknown"}\n${
    request.headers.get("User-Agent") ?? ""
  }`;
  return hmacSha256(secret, material);
}

export async function reviewRoomCreation(
  request: Request,
  body: CreateRoomRequest,
  env: AntiAbuseEnv
): Promise<AntiAbuseDecision> {
  const checkRequested = body.antiAbuseCheck === true || env.ANTI_ABUSE_REQUIRED === "true";
  if (!checkRequested) {
    return { allowed: true };
  }

  if (!env.ANTI_ABUSE_SERVICE_URL) {
    return { allowed: true };
  }

  if (!env.ANTI_ABUSE_SHARED_SECRET) {
    return {
      allowed: false,
      status: 500,
      message: "Anti-abuse service is configured without ANTI_ABUSE_SHARED_SECRET."
    };
  }

  const timeoutMs = parseNonNegativeInteger(env.ANTI_ABUSE_TIMEOUT_MS, DEFAULT_SERVICE_TIMEOUT_MS);
  const now = Date.now();
  const { country, colo } = cfMetadata(request);
  const payload: AntiAbuseHookPayload = {
    version: 1,
    event: "room_create",
    occurredAt: now,
    clientFingerprint: await clientFingerprint(request, env.ANTI_ABUSE_SHARED_SECRET),
    country,
    colo,
    userAgentFamily: userAgentFamily(request),
    roomPolicy: {
      disappearAfterReadSeconds: body.disappearAfterReadSeconds,
      inactivityTimeoutMs: body.inactivityTimeoutMs,
      maxAgeMs: body.maxAgeMs
    }
  };
  const payloadText = JSON.stringify(payload);
  const signature = await hmacSha256(env.ANTI_ABUSE_SHARED_SECRET, payloadText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(env.ANTI_ABUSE_SERVICE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-elm-chat-signature": `sha256=${signature}`
      },
      body: payloadText,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`anti-abuse service returned ${response.status}`);
    }

    const outcome = (await response.json()) as AntiAbuseHookResponse;
    if (outcome.action === "deny") {
      return {
        allowed: false,
        status: 403,
        message: outcome.reason || "Room creation was blocked by the anti-abuse service.",
        retryAfterSeconds: outcome.retryAfterSeconds
      };
    }
    return { allowed: true };
  } catch {
    if (env.ANTI_ABUSE_FAIL_CLOSED === "true") {
      return {
        allowed: false,
        status: 503,
        message: "Anti-abuse checks are temporarily unavailable."
      };
    }
    return { allowed: true };
  } finally {
    clearTimeout(timeout);
  }
}
