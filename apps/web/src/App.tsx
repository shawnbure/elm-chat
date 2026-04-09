import {
  decryptText,
  deriveRoomKey,
  encryptText,
  generateMessageId,
  generateRoomSecret,
  generateSessionId
} from "@elm-chat/crypto";
import {
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type EncryptedMessageEnvelope,
  type MessageState,
  type PresenceSnapshot,
  type RoomMetadata,
  type ServerEvent,
  type StoredMessage
} from "@elm-chat/shared";
import { startTransition, useEffect, useRef, useState, type CSSProperties } from "react";

type View = "landing" | "room";

type UiMessage = {
  id: string;
  senderSessionId: string;
  plaintext: string;
  sentAt: number;
  state: MessageState;
  deliveredAt?: number;
  readAt?: number;
  disappearAt?: number;
};

type ActionFeedback = "idle" | "success";
type DurationUnit = "minutes" | "hours" | "days";
type DurationDraft = {
  amount: string;
  unit: DurationUnit;
  indefinite: boolean;
};

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

function creatorTokenKey(roomId: string): string {
  return `elm-chat:creator:${roomId}`;
}

function sessionKey(roomId: string): string {
  return `elm-chat:session:${roomId}`;
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

async function createRoom(body: CreateRoomRequest): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error("Failed to create room.");
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

function wsUrl(path: string): string {
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  return url.toString();
}

function messageStatus(message: UiMessage): string {
  if (message.state === "expired") {
    return "Disappeared";
  }
  if (message.state === "read" && message.disappearAt) {
    return `Read • vanishes in ${formatRelativeDuration(message.disappearAt)}`;
  }
  if (message.state === "read") {
    return "Read";
  }
  if (message.disappearAt) {
    return `Vanishes in ${formatRelativeDuration(message.disappearAt)}`;
  }
  if (message.state === "delivered") {
    return "Delivered";
  }
  if (message.state === "deleted") {
    return "Deleted";
  }
  return "Sent";
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

function bubbleStyle(sessionId: string, mine: boolean): CSSProperties {
  const color = colorFromSessionId(sessionId);
  return {
    "--bubble-accent": color,
    "--bubble-surface": mine ? color : `color-mix(in srgb, ${color}, white 88%)`,
    "--bubble-surface-border": `color-mix(in srgb, ${color}, white 58%)`,
    "--bubble-text": mine ? "#fffaf3" : "var(--ink)"
  } as CSSProperties;
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

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);
      const secret = generateRoomSecret();
      const room = await createRoom({
        disappearAfterReadSeconds: parseDurationDraft(
          messageDuration,
          7,
          "minutes",
          "seconds"
        ),
        inactivityTimeoutMs: parseDurationDraft(roomDuration, 10, "minutes", "milliseconds"),
        maxAgeMs: null
      });
      localStorage.setItem(creatorTokenKey(room.roomId), room.creatorToken);
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
          <p className="eyebrow">elm chat</p>
          <h1>Private chat that feels current, fast, and disposable.</h1>
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
              <div className="setting-controls">
                <input
                  className="setting-input"
                  disabled={messageDuration.indefinite}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    setMessageDuration((current) => ({ ...current, amount: event.target.value }))
                  }
                  type="number"
                  value={messageDuration.amount}
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
                      setMessageDuration((current) => ({
                        ...current,
                        indefinite: event.target.checked
                      }))
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
              <div className="setting-controls">
                <input
                  className="setting-input"
                  disabled={roomDuration.indefinite}
                  inputMode="numeric"
                  min="1"
                  onChange={(event) =>
                    setRoomDuration((current) => ({ ...current, amount: event.target.value }))
                  }
                  type="number"
                  value={roomDuration.amount}
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
                      setRoomDuration((current) => ({
                        ...current,
                        indefinite: event.target.checked
                      }))
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
  const [room, setRoom] = useState<RoomMetadata | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [presence, setPresence] = useState<PresenceSnapshot>({ count: 0, connectedSessionIds: [] });
  const [now, setNow] = useState(Date.now());
  const [roomNotice, setRoomNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<ActionFeedback>("idle");
  const [destroyFeedback, setDestroyFeedback] = useState<ActionFeedback>("idle");
  const [destroying, setDestroying] = useState(false);
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem(sessionKey(roomId));
    if (stored) {
      return stored;
    }
    const next = generateSessionId();
    sessionStorage.setItem(sessionKey(roomId), next);
    return next;
  });
  const creatorToken = localStorage.getItem(creatorTokenKey(roomId)) ?? "";
  const socketRef = useRef<WebSocket | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    if (!roomSecret) {
      setError("Missing room secret in the URL fragment.");
      return;
    }

    let active = true;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    async function bootstrap() {
      try {
        const [metadata, key] = await Promise.all([loadRoom(roomId), deriveRoomKey(roomSecret)]);
        if (!active) {
          return;
        }
        roomKeyRef.current = key;
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
          socket.send(
            JSON.stringify({
              type: "join",
              sessionId,
              creatorToken: creatorToken || undefined
            })
          );
        });

        socket.addEventListener("close", () => {
          setConnection((current) => (room?.status === "open" ? "Disconnected" : "Closed"));
        });

        socket.addEventListener("error", () => {
          setConnection("Error");
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(String(event.data)) as ServerEvent;
          if (payload.type === "joined") {
            startTransition(() => {
              setRoom(payload.room);
              setPresence(payload.presence);
              setReady(true);
            });

            for (const pending of payload.pending) {
              await decryptAndAddMessage(pending);
            }
            return;
          }

          if (payload.type === "presence") {
            startTransition(() => setPresence(payload.presence));
            return;
          }

          if (payload.type === "message") {
            await decryptAndAddMessage({ envelope: payload.envelope, state: "delivered" });
            return;
          }

          if (payload.type === "message_state") {
            startTransition(() => {
              setMessages((current) =>
                current.map((message) =>
                  message.id === payload.messageId
                    ? {
                        ...message,
                        state: payload.state,
                        deliveredAt: payload.deliveredAt ?? message.deliveredAt,
                        readAt: payload.readAt ?? message.readAt,
                        disappearAt: payload.disappearAt ?? message.disappearAt,
                        plaintext: payload.state === "expired" ? "" : message.plaintext
                      }
                    : message
                )
              );
            });
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
            return;
          }

          if (payload.type === "error") {
            setError(payload.message);
          }
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to join room.");
      }
    }

    async function decryptAndAddMessage(stored: StoredMessage) {
      if (!roomKeyRef.current) {
        return;
      }

      try {
        const plaintext = await decryptText(
          roomKeyRef.current,
          stored.envelope.ciphertext,
          stored.envelope.nonce
        );

        startTransition(() => {
          setMessages((current) =>
            upsertMessage(current, {
              id: stored.envelope.messageId,
              senderSessionId: stored.envelope.senderSessionId,
              plaintext,
              sentAt: stored.envelope.sentAt,
              state: stored.state,
              deliveredAt: stored.deliveredAt,
              readAt: stored.readAt,
              disappearAt: stored.disappearAt
            })
          );
        });

        if (stored.envelope.senderSessionId !== sessionId && stored.state !== "read") {
          socketRef.current?.send(
            JSON.stringify({
              type: "read",
              messageId: stored.envelope.messageId,
              readerSessionId: sessionId
            })
          );
        }
      } catch {
        setError("Could not decrypt a message. Check that you opened the full capability link.");
      }
    }

    void bootstrap();

    return () => {
      active = false;
      window.clearInterval(tick);
      socketRef.current?.close();
    };
  }, [creatorToken, roomId, roomSecret, sessionId]);

  useEffect(() => {
    if (copyFeedback !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => setCopyFeedback("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  useEffect(() => {
    if (destroyFeedback !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => setDestroyFeedback("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [destroyFeedback]);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !roomKeyRef.current || !room || room.status !== "open") {
      return;
    }

    const encrypted = await encryptText(roomKeyRef.current, trimmed);
    const envelope: EncryptedMessageEnvelope = {
      messageId: generateMessageId(),
      senderSessionId: sessionId,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      sentAt: Date.now(),
      expiresAfterReadSeconds: room.disappearAfterReadSeconds ?? DEFAULT_DISAPPEAR_AFTER_READ_SECONDS
    };

    socketRef.current?.send(JSON.stringify({ type: "send", envelope }));
    setDraft("");
    startTransition(() => {
      setMessages((current) =>
        upsertMessage(current, {
          id: envelope.messageId,
          senderSessionId: sessionId,
          plaintext: trimmed,
          sentAt: envelope.sentAt,
          state: "sent"
        })
      );
    });
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopyFeedback("success");
  }

  async function handleDestroy() {
    if (!creatorToken) {
      return;
    }
    try {
      setDestroying(true);
      setDestroyFeedback("idle");
      const next = await destroyRoom(roomId, creatorToken);
      setRoom(next);
      setRoomNotice("Destroying room for everyone...");
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
      ? `Messages vanish after ${formatRelativeDuration(now + room.disappearAfterReadSeconds * 1000)}.`
      : "Messages stay until someone destroys the room.";
  const roomPolicyLabel =
    typeof room?.inactivityTimeoutMs === "number"
      ? `Room self-destructs after ${formatRelativeDuration(now + room.inactivityTimeoutMs)} of inactivity.`
      : "Room stays open until someone destroys it.";

  return (
    <main className="room-shell">
      <header className="room-header">
        <div>
          <p className="eyebrow">elm chat room</p>
          <h1>Room {roomId.slice(0, 8)}</h1>
        </div>
        <div className="room-meta">
          <span>{connection}</span>
          <span>{presentCount} present</span>
        </div>
      </header>

      <section className="room-banner">
        <p>{messagePolicyLabel}</p>
        <div className="banner-stats">
          <span>{roomPolicyLabel}</span>
          <span>Status: {room?.status ?? "loading"}</span>
        </div>
      </section>

      <section className="room-banner participant-banner">
        <p>Each chatter gets a color. No usernames, just a consistent hue across their messages.</p>
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
              </span>
            ))
          )}
        </div>
      </section>

      <section className="room-actions">
        <button
          className={`secondary-button ${copyFeedback === "success" ? "button-success" : ""}`}
          onClick={handleCopyLink}
        >
          {copyFeedback === "success" ? "Link copied" : "Copy link"}
        </button>
        <button
          className={`secondary-button ${destroyFeedback === "success" ? "button-success" : ""}`}
          disabled={!creatorToken || destroying || room?.status !== "open"}
          onClick={handleDestroy}
        >
          {destroying ? "Destroying..." : destroyFeedback === "success" ? "Room destroyed" : "Destroy room"}
        </button>
      </section>

      {roomNotice ? <p className="room-notice">{roomNotice}</p> : null}
      {error ? <p className="error-text room-error">{error}</p> : null}

      <section className="chat-log">
        {!ready ? <p className="system-line">Deriving key and joining room...</p> : null}
        {messages.length === 0 && ready ? (
          <p className="system-line">{messagePolicyLabel}</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderSessionId === sessionId;
          return (
            <article
              className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"} ${message.state === "expired" ? "bubble-expired" : ""}`}
              key={message.id}
              style={bubbleStyle(message.senderSessionId, mine)}
            >
              <span className="bubble-author">{mine ? "You" : "Guest"}</span>
              <p>{message.state === "expired" ? "Message disappeared." : message.plaintext}</p>
              <footer>
                <span>{formatClock(message.sentAt)}</span>
                <span>{messageStatus(message)}</span>
              </footer>
            </article>
          );
        })}
      </section>

      <form className="composer" onSubmit={handleSend}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={room?.status === "open" ? "Write a message" : roomNotice ?? "Room is closed"}
          disabled={room?.status !== "open"}
          rows={3}
        />
        <button className="primary-button" disabled={!draft.trim() || room?.status !== "open"}>
          Send encrypted
        </button>
      </form>
    </main>
  );
}
