import {
  createIdentityKeyPair,
  decryptBytes,
  decryptText,
  deriveRoomKey,
  encryptBytes,
  encryptText,
  exportIdentityPublicKey,
  generateMessageId,
  generateRoomSecret,
  generateSessionId
} from "@elm-chat/crypto";
import {
  FILE_CHUNK_BYTES,
  MAX_FILE_BYTES,
  MAX_TRANSCRIPT_SYNC_MESSAGES,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type EncryptedMessageEnvelope,
  type PeerDataEvent,
  type PeerFileChunk,
  type PresenceSnapshot,
  type RoomInvite,
  type RoomMetadata,
  type ServerEvent,
} from "@elm-chat/shared";
import { startTransition, useEffect, useRef, useState, type CSSProperties } from "react";

type View = "landing" | "room";

type FileTransferState =
  | "offered"
  | "requesting"
  | "transferring"
  | "ready"
  | "sent"
  | "error";

type UiFile = {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  state: FileTransferState;
  progress: number;
  url?: string;
  outgoing: boolean;
};

type UiMessage = {
  id: string;
  senderSessionId: string;
  sentAt: number;
  expiresAt?: number;
  kind: "text" | "file";
  plaintext?: string;
  file?: UiFile;
};

type IncomingFile = {
  name: string;
  mimeType: string;
  size: number;
  totalChunks: number;
  received: number;
  chunks: (Uint8Array | undefined)[];
  senderSessionId: string;
};

type ActionFeedback = "idle" | "success";
type DurationUnit = "minutes" | "hours" | "days";
type DurationDraft = {
  amount: string;
  unit: DurationUnit;
  indefinite: boolean;
};

type DurationKind = "message" | "room";

function roomPathname(): { view: View; roomId?: string } {
  const match = window.location.pathname.match(/^\/c\/([^/]+)$/);
  if (match) {
    return { view: "room", roomId: match[1] };
  }
  return { view: "landing" };
}

function formatRelativeDuration(target: number): string {
  const deltaSeconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const minutes = Math.floor(deltaSeconds / 60);
  const seconds = deltaSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function formatStaticDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return "0s";
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const GITHUB_URL = "https://github.com/shawnbure/elm-chat";

function formatCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  const thousands = value / 1000;
  return `${thousands.toFixed(thousands < 10 ? 1 : 0).replace(/\.0$/, "")}k`;
}

function creatorTokenKey(roomId: string): string {
  return `elm-chat:creator:${roomId}`;
}

function sessionKey(roomId: string): string {
  return `elm-chat:session:${roomId}`;
}

function safeStorageGet(storage: "local" | "session", key: string): string | null {
  try {
    const target = storage === "local" ? window.localStorage : window.sessionStorage;
    return target.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: "local" | "session", key: string, value: string): void {
  try {
    const target = storage === "local" ? window.localStorage : window.sessionStorage;
    target.setItem(key, value);
  } catch {
    // Private browsing and restrictive browser contexts can block storage access.
  }
}

function durationUnitLabel(unit: DurationUnit): string {
  switch (unit) {
    case "minutes":
      return "minutes";
    case "hours":
      return "hours";
    case "days":
      return "days";
  }
}

function durationToMs(amount: number, unit: DurationUnit): number {
  switch (unit) {
    case "minutes":
      return amount * 60 * 1000;
    case "hours":
      return amount * 60 * 60 * 1000;
    case "days":
      return amount * 24 * 60 * 60 * 1000;
  }
}

function durationToSeconds(amount: number, unit: DurationUnit): number {
  return Math.floor(durationToMs(amount, unit) / 1000);
}

function formatSelectedDuration(amount: string, unit: DurationUnit, indefinite: boolean): string {
  if (indefinite) {
    return "Indefinite";
  }
  const value = Number(amount) || 0;
  const label = durationUnitLabel(unit);
  return `${value} ${label}`;
}

function parseDurationDraft(
  draft: DurationDraft,
  fallbackValue: number,
  fallbackUnit: DurationUnit,
  kind: "seconds" | "milliseconds"
): number | null {
  if (draft.indefinite) {
    return null;
  }

  const parsed = Number(draft.amount);
  const safeAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
  const unit = draft.unit || fallbackUnit;
  return kind === "seconds"
    ? durationToSeconds(safeAmount, unit)
    : durationToMs(safeAmount, unit);
}

function toggleIndefiniteDuration(
  current: DurationDraft,
  checked: boolean,
  fallbackAmount: string
): DurationDraft {
  if (checked) {
    return {
      ...current,
      indefinite: true,
      amount: ""
    };
  }

  return {
    ...current,
    indefinite: false,
    amount: current.amount || fallbackAmount
  };
}

let turnstileScriptPromise: Promise<void> | null = null;
let turnstileWidgetId: string | undefined;
let turnstilePendingResolve: ((token: string | undefined) => void) | null = null;

function resolveTurnstile(token: string | undefined): void {
  const resolve = turnstilePendingResolve;
  turnstilePendingResolve = null;
  resolve?.(token);
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("challenge script failed to load"));
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

// Runs an invisible Turnstile challenge when a site key is configured. Returns
// the token, or undefined when Turnstile is not configured (local dev) or the
// challenge could not run — the server decides whether a token is required.
async function getTurnstileToken(): Promise<string | undefined> {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return undefined;
  }
  try {
    await loadTurnstileScript();
  } catch {
    return undefined;
  }
  const turnstile = window.turnstile;
  if (!turnstile) {
    return undefined;
  }
  return new Promise<string | undefined>((resolve) => {
    turnstilePendingResolve = resolve;
    let container = document.getElementById("turnstile-holder");
    if (!container) {
      container = document.createElement("div");
      container.id = "turnstile-holder";
      container.style.position = "fixed";
      container.style.bottom = "-9999px";
      container.style.left = "-9999px";
      document.body.appendChild(container);
    }
    try {
      if (turnstileWidgetId === undefined) {
        turnstileWidgetId = turnstile.render(container, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => resolveTurnstile(token),
          "error-callback": () => resolveTurnstile(undefined),
          "timeout-callback": () => resolveTurnstile(undefined),
          "expired-callback": () => resolveTurnstile(undefined)
        });
      } else {
        turnstile.reset(turnstileWidgetId);
      }
      turnstile.execute(turnstileWidgetId, { sitekey: siteKey });
    } catch {
      resolveTurnstile(undefined);
    }
    // Never let a stuck challenge block room creation indefinitely.
    window.setTimeout(() => resolveTurnstile(undefined), 8000);
  });
}

async function createRoom(body: CreateRoomRequest): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? "Failed to create room.");
  }
  return response.json();
}

async function loadRoom(roomId: string): Promise<RoomMetadata> {
  const response = await fetch(`/api/rooms/${roomId}`);
  if (!response.ok) {
    throw new Error("Room not found.");
  }
  return response.json();
}

async function destroyRoom(roomId: string, creatorToken: string): Promise<RoomMetadata> {
  const response = await fetch(`/api/rooms/${roomId}/destroy`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ creatorToken })
  });
  if (!response.ok) {
    throw new Error("Failed to destroy room.");
  }
  return response.json();
}

async function createInvite(roomId: string, creatorToken: string, ttlMs = 10 * 60 * 1000): Promise<RoomInvite> {
  const response = await fetch(`/api/rooms/${roomId}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creatorToken, ttlMs })
  });
  if (!response.ok) {
    throw new Error("Failed to create invite.");
  }
  return response.json();
}

async function listInvites(roomId: string, creatorToken: string): Promise<RoomInvite[]> {
  const response = await fetch(`/api/rooms/${roomId}/invites?creatorToken=${encodeURIComponent(creatorToken)}`);
  if (!response.ok) {
    throw new Error("Failed to load invites.");
  }
  return response.json();
}

async function revokeInvite(roomId: string, creatorToken: string, token: string): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}/invites/revoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creatorToken, token })
  });
  if (!response.ok) {
    throw new Error("Failed to revoke invite.");
  }
}

async function copyText(value: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function wsUrl(path: string): string {
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  return url.toString();
}

function messageStatus(message: UiMessage): string {
  if (message.expiresAt) {
    return `Vanishes in ${formatRelativeDuration(message.expiresAt)}`;
  }
  return "Peer-to-peer";
}

function upsertMessage(messages: UiMessage[], next: UiMessage): UiMessage[] {
  const existingIndex = messages.findIndex((message) => message.id === next.id);
  if (existingIndex === -1) {
    return [...messages, next].sort((left, right) => left.sentAt - right.sentAt);
  }

  const copy = [...messages];
  copy[existingIndex] = {
    ...copy[existingIndex],
    ...next
  };
  return copy;
}

function colorFromSessionId(sessionId: string): string {
  let hash = 0;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash = (hash * 31 + sessionId.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  const saturation = 62 + (hash % 12);
  const lightness = 48 + (hash % 10);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function inviteColor(invite: RoomInvite): string {
  return colorFromSessionId(invite.consumedBySessionId ?? invite.token);
}

function bubbleStyle(sessionId: string, mine: boolean): CSSProperties {
  const color = colorFromSessionId(sessionId);
  return {
    "--bubble-accent": color,
    "--bubble-surface": mine ? color : `color-mix(in srgb, ${color}, white 88%)`,
    "--bubble-surface-border": `color-mix(in srgb, ${color}, white 58%)`,
    "--bubble-text": mine ? "#fffaf3" : "var(--ink)"
  } as CSSProperties;
}

function inviteAccentStyle(invite: RoomInvite): CSSProperties | undefined {
  const color = inviteColor(invite);
  return {
    "--invite-accent": color,
    "--invite-surface": `color-mix(in srgb, ${color}, white 84%)`,
    "--invite-border": `color-mix(in srgb, ${color}, white 56%)`
  } as CSSProperties;
}

function buildInviteUrl(roomId: string, inviteToken: string, roomSecret: string): string {
  return `${window.location.origin}/c/${roomId}?invite=${encodeURIComponent(inviteToken)}#${roomSecret}`;
}

function roomStateMessage(status: RoomMetadata["status"], reason?: string): string {
  if (status === "destroyed") {
    return "This room was destroyed and everyone was disconnected.";
  }

  switch (reason) {
    case "join-timeout":
      return "This room self-destructed because nobody joined before the room timeout.";
    case "inactive":
      return "This room self-destructed after the configured idle timeout.";
    case "max-age":
      return "This room reached its maximum lifetime and self-destructed.";
    default:
      return "This room is no longer available.";
  }
}

// Privacy-safe growth callout: shown on the end-of-room screens a link
// recipient reaches. No tracking, no telemetry — just a way for a first-time
// visitor to learn they can spin up their own room. elm.chat's main organic loop.
function MakeYourOwnCallout() {
  return (
    <p className="make-your-own">
      This secure room was made with elm.chat.{" "}
      <a className="make-your-own-link" href="/">
        Create your own &mdash; free, no signup.
      </a>
    </p>
  );
}

function InvalidInviteScreen() {
  return (
    <main className="room-shell room-shell-centered">
      <section className="access-screen" aria-live="polite">
        <p className="eyebrow">elm chat</p>
        <h1 className="access-title">Link no longer valid</h1>
        <p className="access-copy">
          This one-time invite has already been used, expired, or is no longer available.
        </p>
        <a className="secondary-button access-home-link" href="/">
          Back to home
        </a>
        <MakeYourOwnCallout />
      </section>
    </main>
  );
}

function RemovedFromRoomScreen() {
  return (
    <main className="room-shell room-shell-centered">
      <section className="access-screen" aria-live="polite">
        <p className="eyebrow">elm chat</p>
        <h1 className="access-title">You were removed from this room</h1>
        <p className="access-copy">The room creator ended your access to this conversation.</p>
        <a className="secondary-button access-home-link" href="/">
          Back to home
        </a>
        <MakeYourOwnCallout />
      </section>
    </main>
  );
}

function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="currentColor" height={size} viewBox="0 0 16 16" width={size}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function FileCard({ file, onDownload }: { file: UiFile; onDownload: () => void }) {
  const percent = Math.round((file.progress ?? 0) * 100);
  return (
    <div className="file-card">
      <div className="file-card-head">
        <span className="file-icon" aria-hidden="true">
          &#128206;
        </span>
        <div className="file-meta">
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatBytes(file.size)}</span>
        </div>
      </div>
      {file.outgoing ? (
        <span className="file-status">Shared &mdash; peers can download</span>
      ) : file.state === "offered" ? (
        <button className="secondary-button file-action" onClick={onDownload} type="button">
          Download
        </button>
      ) : file.state === "requesting" || file.state === "transferring" ? (
        <div className="file-progress">
          <div className="file-progress-track">
            <div className="file-progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <span className="file-progress-label">{percent}%</span>
        </div>
      ) : file.state === "ready" && file.url ? (
        <a className="secondary-button file-action" download={file.name} href={file.url}>
          Save file
        </a>
      ) : file.state === "error" ? (
        <span className="file-status file-status-error">Transfer failed &mdash; ask for a re-share</span>
      ) : null}
    </div>
  );
}

function InviteCheckingScreen() {
  return (
    <main className="room-shell room-shell-centered">
      <section className="access-screen" aria-live="polite">
        <p className="eyebrow">elm chat</p>
        <h1 className="access-title">Checking invite</h1>
        <p className="access-copy">Verifying this one-time invite and joining the room.</p>
        <MakeYourOwnCallout />
      </section>
    </main>
  );
}

function RoomGoneScreen({ reason }: { reason?: string }) {
  return (
    <main className="room-shell room-shell-centered">
      <section className="access-screen" aria-live="polite">
        <p className="eyebrow">elm chat</p>
        <h1 className="access-title">Room gone</h1>
        <p className="access-copy">
          {reason ?? "This conversation self-destructed. Nothing was kept."}
        </p>
        <a className="primary-button access-home-link" href="/">
          Start a new one &rarr;
        </a>
        <MakeYourOwnCallout />
      </section>
    </main>
  );
}

export function App() {
  const route = roomPathname();
  return route.view === "room" && route.roomId ? (
    <RoomPage roomId={route.roomId} />
  ) : (
    <LandingPage />
  );
}

function LandingPage() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghStats, setGhStats] = useState<{ stars: number | null; forks: number | null }>({
    stars: null,
    forks: null
  });
  const whyUseUrl =
    "https://github.com/shawnbure/elm-chat/blob/main/docs/why-use-elm-chat.md";
  const articleUrl =
    "https://github.com/shawnbure/elm-chat/blob/main/docs/truly-private-messaging.md";
  const [messageDuration, setMessageDuration] = useState<DurationDraft>({
    amount: "7",
    unit: "minutes",
    indefinite: false
  });
  const [roomDuration, setRoomDuration] = useState<DurationDraft>({
    amount: "10",
    unit: "minutes",
    indefinite: false
  });

  useEffect(() => {
    let active = true;
    fetch("/api/stars")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data) {
          setGhStats({ stars: data.stars ?? null, forks: data.forks ?? null });
        }
      })
      .catch(() => {
        // Non-fatal: counts simply stay hidden if the lookup fails.
      });
    return () => {
      active = false;
    };
  }, []);

  // Cookieless Cloudflare Web Analytics, loaded on the landing surface only.
  // Room pages never render LandingPage, so they stay free of any third-party
  // beacon. Inert until VITE_CF_ANALYTICS_TOKEN is configured at build time.
  useEffect(() => {
    const token = import.meta.env.VITE_CF_ANALYTICS_TOKEN;
    if (!token || document.getElementById("cf-analytics-beacon")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "cf-analytics-beacon";
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.head.appendChild(script);
  }, []);

  function updateDurationIndefinite(kind: DurationKind, checked: boolean) {
    if (kind === "message") {
      setMessageDuration((current) => toggleIndefiniteDuration(current, checked, "7"));
      return;
    }
    setRoomDuration((current) => toggleIndefiniteDuration(current, checked, "10"));
  }

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);
      const secret = generateRoomSecret();
      const turnstileToken = await getTurnstileToken();
      const room = await createRoom({
        disappearAfterReadSeconds: parseDurationDraft(
          messageDuration,
          7,
          "minutes",
          "seconds"
        ),
        inactivityTimeoutMs: parseDurationDraft(roomDuration, 10, "minutes", "milliseconds"),
        maxAgeMs: null,
        turnstileToken
      });
      safeStorageSet("local", creatorTokenKey(room.roomId), room.creatorToken);
      window.location.assign(`${room.roomUrl}#${secret}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create room.");
      setCreating(false);
    }
  }

  return (
    <main className="landing-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-links" aria-label="Learn about elm chat">
            <a className="hero-link" href={whyUseUrl} rel="noreferrer" target="_blank">
              Why use this?
            </a>
            <a className="hero-link" href={articleUrl} rel="noreferrer" target="_blank">
              Read the article
            </a>
          </div>
          <p className="eyebrow">elm chat</p>
          <h1>Instant chat. Private, secure, fast and disposable.</h1>
          <p className="lede">
            Encrypted link-based chat with color identity, no usernames, and room rules you set before anyone joins.
          </p>
          <div className="creation-panel">
            <div className="setting-row">
              <div>
                <span className="setting-label">Message vanish</span>
                <p className="setting-note">
                  {formatSelectedDuration(
                    messageDuration.amount,
                    messageDuration.unit,
                    messageDuration.indefinite
                  )}
                </p>
              </div>
              <div
                className={`setting-controls ${messageDuration.indefinite ? "setting-controls-disabled" : ""}`}
              >
                <input
                  className="setting-input"
                  disabled={messageDuration.indefinite}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    setMessageDuration((current) => ({ ...current, amount: event.target.value }))
                  }
                  type="number"
                  value={messageDuration.indefinite ? "" : messageDuration.amount}
                />
                <select
                  className="setting-select"
                  disabled={messageDuration.indefinite}
                  onChange={(event) =>
                    setMessageDuration((current) => ({
                      ...current,
                      unit: event.target.value as DurationUnit
                    }))
                  }
                  value={messageDuration.unit}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
                <label className="toggle-pill">
                  <input
                    checked={messageDuration.indefinite}
                    onChange={(event) =>
                      updateDurationIndefinite("message", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Indefinite</span>
                </label>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <span className="setting-label">Room self-destruct</span>
                <p className="setting-note">
                  {roomDuration.indefinite
                    ? "Only manual destroy"
                    : `${formatSelectedDuration(roomDuration.amount, roomDuration.unit, false)} idle`}
                </p>
              </div>
              <div
                className={`setting-controls ${roomDuration.indefinite ? "setting-controls-disabled" : ""}`}
              >
                <input
                  className="setting-input"
                  disabled={roomDuration.indefinite}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    setRoomDuration((current) => ({ ...current, amount: event.target.value }))
                  }
                  type="number"
                  value={roomDuration.indefinite ? "" : roomDuration.amount}
                />
                <select
                  className="setting-select"
                  disabled={roomDuration.indefinite}
                  onChange={(event) =>
                    setRoomDuration((current) => ({
                      ...current,
                      unit: event.target.value as DurationUnit
                    }))
                  }
                  value={roomDuration.unit}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
                <label className="toggle-pill">
                  <input
                    checked={roomDuration.indefinite}
                    onChange={(event) =>
                      updateDurationIndefinite("room", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Indefinite</span>
                </label>
              </div>
            </div>
          </div>
          <div className="hero-actions">
            <button className="primary-button" disabled={creating} onClick={handleCreate}>
              {creating ? "Creating room..." : "Create private conversation"}
            </button>
            <p className="helper-text">
              Room secret stays in the URL fragment and never reaches the server.
            </p>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
        <div className="hero-panel">
          <div className="signal-grid" />
          <div className="hero-panel-top">
          <a className="github-cta" href={GITHUB_URL} rel="noreferrer" target="_blank">
            <GithubMark size={22} />
            <span className="github-cta-copy">
              <strong>Star us on GitHub</strong>
              <span>Open source. Audit the code, fork it, run your own.</span>
            </span>
            <span className="github-cta-stats" aria-label="GitHub stars and forks">
              {ghStats.stars !== null ? (
                <span className="github-stat">
                  <span aria-hidden="true">★</span> {formatCount(ghStats.stars)}
                </span>
              ) : null}
              {ghStats.forks !== null ? (
                <span className="github-stat">
                  <span aria-hidden="true">⑂</span> {formatCount(ghStats.forks)}
                </span>
              ) : null}
            </span>
          </a>
          <div className="github-links" aria-label="Project source">
            <a className="github-mini" href={GITHUB_URL} rel="noreferrer" target="_blank">
              <GithubMark size={13} /> View source
            </a>
            <a className="github-mini" href={`${GITHUB_URL}/fork`} rel="noreferrer" target="_blank">
              Fork me
            </a>
            <a className="github-mini" href={`${GITHUB_URL}/blob/main/apps/web/src/App.tsx`} rel="noreferrer" target="_blank">
              Read my code
            </a>
          </div>
          </div>
          <div className="hero-metrics">
            <div>
              <span>Access</span>
              <strong>Secret link only</strong>
            </div>
            <div>
              <span>Message policy</span>
              <strong>
                {messageDuration.indefinite
                  ? "Manual cleanup"
                  : formatSelectedDuration(messageDuration.amount, messageDuration.unit, false)}
              </strong>
            </div>
            <div>
              <span>Room policy</span>
              <strong>{roomDuration.indefinite ? "No idle timeout" : "Idle self-destruct"}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function RoomPage({ roomId }: { roomId: string }) {
  const roomSecret = window.location.hash.replace(/^#/, "");
  const inviteToken = new URLSearchParams(window.location.search).get("invite") ?? "";
  const storedCreatorToken = safeStorageGet("local", creatorTokenKey(roomId)) ?? "";
  const isInviteGuest = Boolean(inviteToken && !storedCreatorToken);
  const [room, setRoom] = useState<RoomMetadata | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [presence, setPresence] = useState<PresenceSnapshot>({ count: 0, connectedSessionIds: [] });
  const [now, setNow] = useState(Date.now());
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<ActionFeedback>("idle");
  const [destroyFeedback, setDestroyFeedback] = useState<ActionFeedback>("idle");
  const [inviteFeedback, setInviteFeedback] = useState<ActionFeedback>("idle");
  const [destroying, setDestroying] = useState(false);
  const [inviteAccess, setInviteAccess] = useState<"checking" | "granted" | "invalid">(
    isInviteGuest ? "checking" : "granted"
  );
  const [removedFromRoom, setRemovedFromRoom] = useState(false);
  const [sessionId] = useState(() => {
    const stored = safeStorageGet("session", sessionKey(roomId));
    if (stored) {
      return stored;
    }
    const next = generateSessionId();
    safeStorageSet("session", sessionKey(roomId), next);
    return next;
  });
  const creatorToken = storedCreatorToken;
  const socketRef = useRef<WebSocket | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);
  const identityKeyRef = useRef<string>("");
  const joinedRef = useRef(false);
  // Mirror of the latest room status so the socket close handler (captured once
  // by the connection effect) can distinguish a live-room drop from an
  // already-closed room without reading a stale `room` value.
  const roomStatusRef = useRef<RoomMetadata["status"] | null>(null);
  const chatLogRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef(new Map<string, EncryptedMessageEnvelope>());
  const shouldRequestSyncRef = useRef(false);
  // Files being served by this client (we are the sender), kept in memory so we
  // can stream chunks on demand when a peer requests them.
  const outgoingFilesRef = useRef(new Map<string, File>());
  // Files being received by this client, accumulating decrypted chunks.
  const incomingFilesRef = useRef(new Map<string, IncomingFile>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Object URLs created for received files, revoked on expiry/unmount.
  const objectUrlsRef = useRef(new Set<string>());

  function sendPeerData(payload: PeerDataEvent, toSessionId?: string) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN && joinedRef.current) {
      socket.send(JSON.stringify({ type: "peer_data", toSessionId, data: payload }));
      return true;
    }
    return false;
  }

  async function refreshInvites() {
    if (!creatorToken) {
      return;
    }
    try {
      const nextInvites = await listInvites(roomId, creatorToken);
      setInvites(nextInvites);
    } catch {
      // Keep the last known invite state if the refresh fails.
    }
  }

  function updateFileMessage(fileId: string, patch: Partial<UiFile>) {
    startTransition(() => {
      setMessages((current) =>
        current.map((message) =>
          message.kind === "file" && message.file?.fileId === fileId
            ? { ...message, file: { ...message.file, ...patch } }
            : message
        )
      );
    });
  }

  async function waitForSocketDrain() {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    const maxBuffer = 4 * 1024 * 1024;
    while (socket.bufferedAmount > maxBuffer && socket.readyState === WebSocket.OPEN) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
  }

  // Sender side: stream an outgoing file to the requesting peer as encrypted chunks.
  async function serveFile(fileId: string, requesterSessionId: string) {
    const file = outgoingFilesRef.current.get(fileId);
    const key = roomKeyRef.current;
    if (!file || !key) {
      return;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const totalChunks = Math.max(1, Math.ceil(buffer.byteLength / FILE_CHUNK_BYTES));
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * FILE_CHUNK_BYTES;
      const slice = buffer.subarray(start, Math.min(start + FILE_CHUNK_BYTES, buffer.byteLength));
      const { ciphertext, nonce } = await encryptBytes(key, slice);
      await waitForSocketDrain();
      const delivered = sendPeerData(
        { type: "file_chunk", fileId, chunkIndex: index, totalChunks, ciphertext, nonce },
        requesterSessionId
      );
      if (!delivered) {
        return;
      }
    }
    sendPeerData({ type: "file_complete", fileId }, requesterSessionId);
  }

  // Receiver side: decrypt and store an incoming chunk, updating transfer progress.
  async function receiveChunk(payload: PeerFileChunk) {
    const key = roomKeyRef.current;
    if (!key) {
      return;
    }
    let entry = incomingFilesRef.current.get(payload.fileId);
    if (!entry) {
      entry = {
        name: "file",
        mimeType: "application/octet-stream",
        size: 0,
        totalChunks: payload.totalChunks,
        received: 0,
        chunks: [],
        senderSessionId: ""
      };
      incomingFilesRef.current.set(payload.fileId, entry);
    }
    if (entry.chunks.length !== payload.totalChunks) {
      entry.chunks = new Array<Uint8Array | undefined>(payload.totalChunks);
      entry.received = 0;
      entry.totalChunks = payload.totalChunks;
    }
    if (!entry.chunks[payload.chunkIndex]) {
      try {
        entry.chunks[payload.chunkIndex] = await decryptBytes(key, payload.ciphertext, payload.nonce);
        entry.received += 1;
      } catch {
        updateFileMessage(payload.fileId, { state: "error" });
        return;
      }
    }
    updateFileMessage(payload.fileId, {
      state: "transferring",
      progress: entry.totalChunks ? entry.received / entry.totalChunks : 0
    });
  }

  // Receiver side: reassemble a completed file into a downloadable blob URL.
  function finalizeIncoming(fileId: string) {
    const entry = incomingFilesRef.current.get(fileId);
    if (!entry) {
      return;
    }
    if (entry.totalChunks === 0 || entry.received < entry.totalChunks) {
      updateFileMessage(fileId, { state: "error" });
      return;
    }
    const parts = entry.chunks.filter((chunk): chunk is Uint8Array => Boolean(chunk));
    const blob = new Blob(parts as BlobPart[], { type: entry.mimeType });
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    incomingFilesRef.current.delete(fileId);
    updateFileMessage(fileId, { state: "ready", progress: 1, url });
  }

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || !room || room.status !== "open") {
      return;
    }
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is larger than the ${formatBytes(MAX_FILE_BYTES)} limit.`);
        continue;
      }
      const fileId = generateMessageId();
      const sentAt = Date.now();
      const mimeType = file.type || "application/octet-stream";
      const expiresAfterReadSeconds = room.disappearAfterReadSeconds ?? null;
      const expiresAt =
        typeof expiresAfterReadSeconds === "number"
          ? sentAt + expiresAfterReadSeconds * 1000
          : undefined;
      outgoingFilesRef.current.set(fileId, file);
      setError(null);
      startTransition(() => {
        setMessages((current) =>
          upsertMessage(current, {
            id: fileId,
            senderSessionId: sessionId,
            sentAt,
            expiresAt,
            kind: "file",
            file: {
              fileId,
              name: file.name,
              mimeType,
              size: file.size,
              state: "sent",
              progress: 1,
              outgoing: true
            }
          })
        );
      });
      const delivered = sendPeerData({
        type: "file_offer",
        fileId,
        senderSessionId: sessionId,
        name: file.name,
        mimeType,
        size: file.size,
        sentAt,
        expiresAfterReadSeconds
      });
      if (!delivered) {
        setError("File shared locally, but delivery to other participants is not ready yet.");
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRequestFile(fileId: string, senderSessionId: string) {
    updateFileMessage(fileId, { state: "transferring", progress: 0 });
    const requested = sendPeerData({ type: "file_request", fileId }, senderSessionId);
    if (!requested) {
      updateFileMessage(fileId, { state: "error" });
      setError("Could not reach the sender to start the download.");
    }
  }

  useEffect(() => {
    if (!roomSecret) {
      setError("Missing room secret in the URL fragment.");
      return;
    }

    let active = true;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    async function bootstrap() {
      try {
        const [metadata, key, identityKeys] = await Promise.all([
          loadRoom(roomId),
          deriveRoomKey(roomSecret),
          createIdentityKeyPair()
        ]);
        if (!active) {
          return;
        }
        roomKeyRef.current = key;
        identityKeyRef.current = await exportIdentityPublicKey(identityKeys.publicKey);
        setRoom(metadata);
        if (metadata.status !== "open") {
          setReady(true);
          setConnection("Closed");
          setRoomNotice(roomStateMessage(metadata.status));
          return;
        }

        const socket = new WebSocket(wsUrl(`/api/rooms/${roomId}/ws`));
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          setConnection("Connected");
          joinedRef.current = false;
          socket.send(
            JSON.stringify({
              type: "join",
              sessionId,
              identityKey: identityKeyRef.current,
              creatorToken: creatorToken || undefined,
              inviteToken: inviteToken || undefined
            })
          );
        });

        socket.addEventListener("close", (closeEvent) => {
          joinedRef.current = false;
          if (isInviteGuest && inviteAccess !== "granted" && closeEvent.code === 4403) {
            setInviteAccess("invalid");
            setError(null);
            setRoom(null);
            setRoomNotice(null);
            setReady(true);
            return;
          }
          setConnection(roomStatusRef.current === "open" ? "Disconnected" : "Closed");
        });

        socket.addEventListener("error", () => {
          setConnection("Error");
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(String(event.data)) as ServerEvent;
          if (payload.type === "joined") {
            joinedRef.current = true;
            startTransition(() => {
              setInviteAccess("granted");
              setRoom(payload.room);
              setPresence(payload.presence);
              setReady(true);
            });
            if (creatorToken) {
              void refreshInvites();
            }
            shouldRequestSyncRef.current = payload.peers.length > 0;
            if (payload.peers.length > 0) {
              socket.send(JSON.stringify({ type: "peer_data", data: { type: "sync_request" } }));
            }
            return;
          }

          if (payload.type === "presence") {
            startTransition(() => setPresence(payload.presence));
            if (creatorToken) {
              void refreshInvites();
            }
            return;
          }

          if (payload.type === "peer_joined") {
            startTransition(() =>
              setPresence((current) => ({
                count: current.connectedSessionIds.includes(payload.peer.sessionId)
                  ? current.count
                  : current.count + 1,
                connectedSessionIds: current.connectedSessionIds.includes(payload.peer.sessionId)
                  ? current.connectedSessionIds
                  : [...current.connectedSessionIds, payload.peer.sessionId]
              }))
            );
            if (creatorToken) {
              void refreshInvites();
            }
            if (messageRef.current.size > 0) {
              socket.send(
                JSON.stringify({
                  type: "peer_data",
                  toSessionId: payload.peer.sessionId,
                  data: {
                    type: "sync_response",
                    messages: [...messageRef.current.values()]
                      .sort((left, right) => left.sentAt - right.sentAt)
                      .slice(-MAX_TRANSCRIPT_SYNC_MESSAGES)
                  }
                })
              );
            }
            return;
          }

          if (payload.type === "peer_left") {
            startTransition(() =>
              setPresence((current) => {
                const nextIds = current.connectedSessionIds.filter((id) => id !== payload.sessionId);
                return {
                  count: nextIds.length,
                  connectedSessionIds: nextIds
                };
              })
            );
            if (creatorToken) {
              void refreshInvites();
            }
            return;
          }

          if (payload.type === "peer_data") {
            await handlePeerData(payload.fromSessionId, JSON.stringify(payload.data));
            return;
          }

          if (payload.type === "room_state") {
            startTransition(() => {
              setRoom((current) =>
                current
                  ? {
                      ...current,
                      status: payload.status
                    }
                  : current
              );
              setRoomNotice(roomStateMessage(payload.status, payload.reason));
              setDestroying(false);
              setDestroyFeedback(payload.status === "destroyed" ? "success" : "idle");
              setConnection("Closed");
            });
            sendPeerData({ type: "peer_destroy" });
            return;
          }

          if (payload.type === "participant_kicked") {
            if (payload.sessionId === sessionId) {
              setRemovedFromRoom(true);
              setRoomNotice(null);
              setError(null);
              setConnection("Closed");
              joinedRef.current = false;
              socket.close();
            }
            if (creatorToken) {
              void refreshInvites();
            }
            return;
          }

          if (payload.type === "error") {
            if (payload.message === "A valid one-time invite is required.") {
              setInviteAccess("invalid");
              setError(null);
              setRoom(null);
              setRoomNotice(null);
              setReady(true);
              socket.close(4403, "invalid-invite");
              return;
            }
            if (payload.code === "peer_missing") {
              return;
            }
            setError(payload.message);
          }
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Failed to join room.";
        if (message === "Room not found.") {
          setNotFound(true);
          setReady(true);
          return;
        }
        setError(message);
      }
    }

    async function addEnvelope(envelope: EncryptedMessageEnvelope) {
      if (messageRef.current.has(envelope.messageId)) {
        return;
      }

      const expiresAt =
        typeof envelope.expiresAfterReadSeconds === "number"
          ? envelope.sentAt + envelope.expiresAfterReadSeconds * 1000
          : undefined;
      if (typeof expiresAt === "number" && expiresAt <= Date.now()) {
        return;
      }

      messageRef.current.set(envelope.messageId, envelope);
      if (!roomKeyRef.current) {
        return;
      }

      try {
        const plaintext = await decryptText(roomKeyRef.current, envelope.ciphertext, envelope.nonce);

        startTransition(() => {
          setMessages((current) =>
            upsertMessage(current, {
              id: envelope.messageId,
              senderSessionId: envelope.senderSessionId,
              plaintext,
              sentAt: envelope.sentAt,
              expiresAt,
              kind: "text"
            })
          );
        });
      } catch {
        setError("Could not decrypt a message. Check that you opened the full capability link.");
      }
    }

    async function handlePeerData(peerId: string, raw: string) {
      const payload = JSON.parse(raw) as PeerDataEvent;
      if (payload.type === "chat_message") {
        await addEnvelope(payload.envelope);
        return;
      }

      if (payload.type === "sync_request") {
        const transcript = [...messageRef.current.values()]
          .sort((left, right) => left.sentAt - right.sentAt)
          .slice(-MAX_TRANSCRIPT_SYNC_MESSAGES);
        socketRef.current?.send(
          JSON.stringify({
            type: "peer_data",
            toSessionId: peerId,
            data: { type: "sync_response", messages: transcript }
          })
        );
        return;
      }

      if (payload.type === "sync_response") {
        shouldRequestSyncRef.current = false;
        for (const envelope of payload.messages) {
          await addEnvelope(envelope);
        }
        return;
      }

      if (payload.type === "file_offer") {
        const expiresAt =
          typeof payload.expiresAfterReadSeconds === "number"
            ? payload.sentAt + payload.expiresAfterReadSeconds * 1000
            : undefined;
        if (typeof expiresAt === "number" && expiresAt <= Date.now()) {
          return;
        }
        incomingFilesRef.current.set(payload.fileId, {
          name: payload.name,
          mimeType: payload.mimeType || "application/octet-stream",
          size: payload.size,
          totalChunks: 0,
          received: 0,
          chunks: [],
          senderSessionId: payload.senderSessionId
        });
        startTransition(() => {
          setMessages((current) =>
            upsertMessage(current, {
              id: payload.fileId,
              senderSessionId: payload.senderSessionId,
              sentAt: payload.sentAt,
              expiresAt,
              kind: "file",
              file: {
                fileId: payload.fileId,
                name: payload.name,
                mimeType: payload.mimeType || "application/octet-stream",
                size: payload.size,
                state: "offered",
                progress: 0,
                outgoing: false
              }
            })
          );
        });
        return;
      }

      if (payload.type === "file_request") {
        void serveFile(payload.fileId, peerId);
        return;
      }

      if (payload.type === "file_chunk") {
        await receiveChunk(payload);
        return;
      }

      if (payload.type === "file_complete") {
        finalizeIncoming(payload.fileId);
        return;
      }

      if (payload.type === "peer_destroy") {
        setRoomNotice("A connected peer destroyed this room.");
        setConnection("Closed");
      }
    }

    void bootstrap();

    return () => {
      active = false;
      window.clearInterval(tick);
      socketRef.current?.close();
    };
  }, [creatorToken, inviteToken, roomId, roomSecret, sessionId]);

  useEffect(() => {
    if (copyFeedback !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => setCopyFeedback("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  useEffect(() => {
    if (inviteFeedback !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => setInviteFeedback("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [inviteFeedback]);

  useEffect(() => {
    if (destroyFeedback !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => setDestroyFeedback("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [destroyFeedback]);

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (!chatLog) {
      return;
    }
    window.requestAnimationFrame(() => {
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  }, [ready, messages.length, roomNotice]);

  useEffect(() => {
    if (!ready || room?.status !== "open") {
      return;
    }
    const interval = window.setInterval(() => {
      socketRef.current?.send(JSON.stringify({ type: "ping" }));
    }, 15000);
    return () => window.clearInterval(interval);
  }, [ready, room?.status]);

  useEffect(() => {
    startTransition(() => {
      setMessages((current) =>
        current.filter((message) => {
          const keep = !message.expiresAt || message.expiresAt > now;
          if (!keep && message.kind === "file") {
            if (message.file?.url) {
              URL.revokeObjectURL(message.file.url);
              objectUrlsRef.current.delete(message.file.url);
            }
            outgoingFilesRef.current.delete(message.id);
            incomingFilesRef.current.delete(message.id);
          }
          return keep;
        })
      );
    });
    for (const [messageId, envelope] of messageRef.current.entries()) {
      const expiresAt =
        typeof envelope.expiresAfterReadSeconds === "number"
          ? envelope.sentAt + envelope.expiresAfterReadSeconds * 1000
          : undefined;
      if (typeof expiresAt === "number" && expiresAt <= now) {
        messageRef.current.delete(messageId);
      }
    }
  }, [now]);

  useEffect(() => {
    void refreshInvites();
  }, [creatorToken, roomId]);

  useEffect(() => {
    roomStatusRef.current = room?.status ?? null;
  }, [room?.status]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !roomKeyRef.current || !room || room.status !== "open") {
      return;
    }

    const encrypted = await encryptText(roomKeyRef.current, trimmed);
    const sentAt = Date.now();
    const expiresAt =
      typeof room.disappearAfterReadSeconds === "number"
        ? sentAt + room.disappearAfterReadSeconds * 1000
        : undefined;
    const envelope: EncryptedMessageEnvelope = {
      messageId: generateMessageId(),
      senderSessionId: sessionId,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      sentAt,
      expiresAfterReadSeconds: room.disappearAfterReadSeconds ?? null
    };

    messageRef.current.set(envelope.messageId, envelope);
    setDraft("");
    setError(null);
    startTransition(() => {
      setMessages((current) =>
        upsertMessage(current, {
          id: envelope.messageId,
          senderSessionId: sessionId,
          plaintext: trimmed,
          sentAt,
          expiresAt,
          kind: "text"
        })
      );
    });

    if (!joinedRef.current || socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("Message saved locally, but room transport is not ready yet.");
      return;
    }

    if (!sendPeerData({ type: "chat_message", envelope })) {
      setError("Message saved locally, but delivery to other participants failed.");
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();
    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    form.requestSubmit();
  }

  async function handleCopyLink() {
    if (await copyText(window.location.href)) {
      setCopyFeedback("success");
      setError(null);
      return;
    }
    setError("Clipboard access is blocked in this browser context. Copy the link manually from the address bar.");
  }

  async function handleShareInvite() {
    if (!creatorToken) {
      return;
    }
    try {
      const invite = await createInvite(roomId, creatorToken);
      setInvites((current) => [invite, ...current]);
      const inviteUrl = buildInviteUrl(roomId, invite.token, roomSecret);
      if (await copyText(inviteUrl)) {
        setInviteFeedback("success");
        setError(null);
        return;
      }
      setInviteFeedback("idle");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create invite.");
    }
  }

  async function handleCopyInvite(token: string) {
    if (await copyText(buildInviteUrl(roomId, token, roomSecret))) {
      setInviteFeedback("success");
      setError(null);
      return;
    }
    setError("Clipboard access is blocked in this browser context. Copy the invite URL manually.");
  }

  async function handleRevokeInvite(token: string) {
    if (!creatorToken) {
      return;
    }
    try {
      await revokeInvite(roomId, creatorToken, token);
      setInvites((current) =>
        current.map((invite) =>
          invite.token === token ? { ...invite, revokedAt: Date.now() } : invite
        )
      );
      setRoomNotice("Invite removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke invite.");
    }
  }

  function handleKickParticipant(targetSessionId: string) {
    if (!creatorToken || targetSessionId === sessionId) {
      return;
    }
    socketRef.current?.send(
      JSON.stringify({
        type: "kick_participant",
        creatorToken,
        targetSessionId
      })
    );
  }

  async function handleDestroy() {
    if (!creatorToken) {
      return;
    }
    try {
      setDestroying(true);
      setDestroyFeedback("idle");
      const next = await destroyRoom(roomId, creatorToken);
      sendPeerData({ type: "peer_destroy" });
      setRoomNotice(null);
      setRoom(next);
    } catch (cause) {
      setDestroying(false);
      setError(cause instanceof Error ? cause.message : "Failed to destroy room.");
    }
  }

  const presentCount = presence.count;
  const sortedPresenceIds = [...presence.connectedSessionIds].sort((left, right) =>
    left === sessionId ? -1 : right === sessionId ? 1 : left.localeCompare(right)
  );
  const messagePolicyLabel =
    typeof room?.disappearAfterReadSeconds === "number"
      ? `Messages vanish after ${formatStaticDuration(room.disappearAfterReadSeconds)}.`
      : "Messages stay until someone destroys the room.";
  const roomPolicyLabel =
    typeof room?.inactivityTimeoutMs === "number"
      ? `Room self-destructs after ${formatStaticDuration(Math.floor(room.inactivityTimeoutMs / 1000))} of inactivity.`
      : "Room stays open until someone destroys it.";
  const isCreator = Boolean(creatorToken);

  if (removedFromRoom) {
    return <RemovedFromRoomScreen />;
  }

  if (inviteAccess === "invalid") {
    return <InvalidInviteScreen />;
  }

  if (notFound) {
    return <RoomGoneScreen reason="This room no longer exists. It may have already self-destructed." />;
  }

  if (ready && room && room.status !== "open") {
    return <RoomGoneScreen reason={roomNotice ?? roomStateMessage(room.status)} />;
  }

  if (isInviteGuest && (inviteAccess !== "granted" || !room || !ready)) {
    return <InviteCheckingScreen />;
  }

  return (
    <main className="room-shell">
      <header className="room-header">
        <div className="room-title">
          <p className="eyebrow">elm chat</p>
          <h1>{roomId.slice(0, 8)}</h1>
          <p className="room-subtitle">
            {messagePolicyLabel} {roomPolicyLabel}
          </p>
        </div>
        <div className="room-toolbar">
          <div className="room-meta">
            <span>{connection}</span>
            <span>{presentCount} present</span>
          </div>
          <div className="room-actions">
            {isCreator ? (
              <button
                className={`secondary-button ${inviteFeedback === "success" ? "button-success" : ""}`}
                onClick={handleShareInvite}
              >
                {inviteFeedback === "success" ? "Invite copied" : "Share invite"}
              </button>
            ) : (
              <button
                className={`secondary-button ${copyFeedback === "success" ? "button-success" : ""}`}
                onClick={handleCopyLink}
              >
                {copyFeedback === "success" ? "Copied" : "Copy my link"}
              </button>
            )}
            <button
              className={`secondary-button ${destroyFeedback === "success" ? "button-success" : ""}`}
              disabled={!creatorToken || destroying || room?.status !== "open"}
              onClick={handleDestroy}
            >
              {destroying ? "Destroying..." : destroyFeedback === "success" ? "Destroyed" : "Destroy"}
            </button>
          </div>
        </div>
      </header>

      <section className="room-strip">
        <div className="participant-strip" aria-label="Participants">
          {sortedPresenceIds.length === 0 ? (
            <span className="participant-empty">Waiting for someone to join.</span>
          ) : (
            sortedPresenceIds.map((id) => (
              <span
                className={`participant-chip ${id === sessionId ? "participant-chip-self" : ""}`}
                key={id}
                style={{ "--participant-color": colorFromSessionId(id) } as CSSProperties}
              >
                <span className="participant-dot" />
                {id === sessionId ? "You" : "Guest"}
                {isCreator && id !== sessionId ? (
                  <button
                    className="participant-kick"
                    onClick={() => handleKickParticipant(id)}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>
        <div className="banner-stats">
          <span>{room?.status ?? "loading"}</span>
        </div>
      </section>

      {roomNotice ? <p className="room-notice">{roomNotice}</p> : null}
      {error ? <p className="error-text room-error">{error}</p> : null}
      {isCreator && invites.length > 0 ? (
        <section className="invite-panel">
          <span className="eyebrow">invites</span>
          {invites.slice(0, 4).map((invite) => (
            <div className="invite-row" key={invite.token} style={inviteAccentStyle(invite)}>
              <span>
                {invite.revokedAt
                  ? "revoked"
                  : invite.consumedAt
                    ? "used"
                    : `expires in ${formatRelativeDuration(invite.expiresAt)}`}
              </span>
              <div className="invite-actions">
                {!invite.revokedAt && !invite.consumedAt ? (
                  <button className="secondary-button invite-copy" onClick={() => handleCopyInvite(invite.token)} type="button">
                    Copy
                  </button>
                ) : null}
                {!invite.revokedAt ? (
                  <button className="secondary-button invite-revoke" onClick={() => handleRevokeInvite(invite.token)} type="button">
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="chat-stage">
        <section className="chat-log" ref={chatLogRef}>
        <div className="chat-thread">
          {!ready ? <p className="system-line">Deriving key and joining room...</p> : null}
          {messages.length === 0 && ready ? (
            <p className="system-line">{messagePolicyLabel}</p>
          ) : null}
          {messages.map((message) => {
            const mine = message.senderSessionId === sessionId;
            return (
              <article
                className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"}`}
                key={message.id}
                style={bubbleStyle(message.senderSessionId, mine)}
              >
                <span className="bubble-author">{mine ? "You" : "Guest"}</span>
                {message.kind === "file" && message.file ? (
                  <FileCard
                    file={message.file}
                    onDownload={() =>
                      handleRequestFile(message.file!.fileId, message.senderSessionId)
                    }
                  />
                ) : (
                  <p>{message.plaintext}</p>
                )}
                <footer>
                  <span>{formatClock(message.sentAt)}</span>
                  <span>{messageStatus(message)}</span>
                </footer>
              </article>
            );
          })}
        </div>
        </section>
      </section>

      <form className="composer" onSubmit={handleSend}>
        <button
          aria-label="Attach file"
          className="secondary-button composer-attach"
          disabled={room?.status !== "open"}
          onClick={() => fileInputRef.current?.click()}
          title="Attach an encrypted file"
          type="button"
        >
          &#128206;
        </button>
        <input
          hidden
          multiple
          onChange={(event) => void handleAttachFiles(event.target.files)}
          ref={fileInputRef}
          type="file"
        />
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={room?.status === "open" ? "Write a message" : roomNotice ?? "Room is closed"}
          disabled={room?.status !== "open"}
          rows={3}
        />
        <button className="primary-button" type="submit" disabled={!draft.trim() || room?.status !== "open"}>
          Send encrypted
        </button>
      </form>
    </main>
  );
}
