import {
  decryptText,
  deriveRoomKey,
  encryptText,
  generateMessageId,
  generateRoomSecret,
  generateSessionId
} from "@ephem/crypto";
import {
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  type CreateRoomResponse,
  type EncryptedMessageEnvelope,
  type MessageState,
  type RoomMetadata,
  type ServerEvent,
  type StoredMessage
} from "@ephem/shared";
import { startTransition, useEffect, useRef, useState } from "react";

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
  return `ephem:creator:${roomId}`;
}

function sessionKey(roomId: string): string {
  return `ephem:session:${roomId}`;
}

async function createRoom(): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({})
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
    return `Read • disappears in ${formatRelativeDuration(message.disappearAt)}`;
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

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);
      const secret = generateRoomSecret();
      const room = await createRoom();
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
          <p className="eyebrow">Private by capability</p>
          <h1>Open a conversation with a link. Leave no inbox behind.</h1>
          <p className="lede">
            Two people. Browser-only encryption. Ciphertext relay. Messages that vanish after they are read.
          </p>
          <div className="hero-actions">
            <button className="primary-button" disabled={creating} onClick={handleCreate}>
              {creating ? "Creating room..." : "Create private conversation"}
            </button>
            <p className="helper-text">Room secret stays in the URL fragment and never reaches the server.</p>
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
              <span>Retention</span>
              <strong>Read, then disappear</strong>
            </div>
            <div>
              <span>Transport</span>
              <strong>Workers + Durable Object</strong>
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
  const [presence, setPresence] = useState(0);
  const [now, setNow] = useState(Date.now());
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
          setConnection("Disconnected");
        });

        socket.addEventListener("error", () => {
          setConnection("Error");
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(String(event.data)) as ServerEvent;
          if (payload.type === "joined") {
            startTransition(() => {
              setRoom(payload.room);
              setPresence(payload.presence.count);
              setReady(true);
            });

            for (const pending of payload.pending) {
              await decryptAndAddMessage(pending);
            }
            return;
          }

          if (payload.type === "presence") {
            startTransition(() => setPresence(payload.presence.count));
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
      expiresAfterReadSeconds:
        room.disappearAfterReadSeconds ?? DEFAULT_DISAPPEAR_AFTER_READ_SECONDS
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
  }

  async function handleDestroy() {
    if (!creatorToken) {
      return;
    }
    try {
      const next = await destroyRoom(roomId, creatorToken);
      setRoom(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to destroy room.");
    }
  }

  const roomExpiresAt = room?.expiresAt ?? now;

  return (
    <main className="room-shell">
      <header className="room-header">
        <div>
          <p className="eyebrow">ephem room</p>
          <h1>Encrypted room {roomId.slice(0, 8)}</h1>
        </div>
        <div className="room-meta">
          <span>{connection}</span>
          <span>{presence}/2 present</span>
        </div>
      </header>

      <section className="room-banner">
        <p>Messages are encrypted in this browser, relayed as ciphertext, and set to vanish after read.</p>
        <div className="banner-stats">
          <span>Room expires in {formatRelativeDuration(roomExpiresAt)}</span>
          <span>Status: {room?.status ?? "loading"}</span>
        </div>
      </section>

      <section className="room-actions">
        <button className="secondary-button" onClick={handleCopyLink}>
          Copy link
        </button>
        <button className="secondary-button" disabled={!creatorToken} onClick={handleDestroy}>
          Destroy room
        </button>
      </section>

      {error ? <p className="error-text room-error">{error}</p> : null}

      <section className="chat-log">
        {!ready ? <p className="system-line">Deriving key and joining room...</p> : null}
        {messages.length === 0 && ready ? (
          <p className="system-line">No messages yet. Anything sent here disappears after it is read.</p>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderSessionId === sessionId;
          return (
            <article
              className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"} ${message.state === "expired" ? "bubble-expired" : ""}`}
              key={message.id}
            >
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
          placeholder={room?.status === "open" ? "Write a message" : "Room is closed"}
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

