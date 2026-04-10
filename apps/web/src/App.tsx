import {
  createIdentityKeyPair,
  decryptText,
  deriveRoomKey,
  encryptText,
  exportIdentityPublicKey,
  generateMessageId,
  generateRoomSecret,
  generateSessionId
} from "@elm-chat/crypto";
import {
  DEFAULT_STUN_ICE_SERVERS,
  DEFAULT_DISAPPEAR_AFTER_READ_SECONDS,
  MAX_TRANSCRIPT_SYNC_MESSAGES,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type EncryptedMessageEnvelope,
  type PeerDataEvent,
  type PeerDescriptor,
  type PeerSignal,
  type PresenceSnapshot,
  type RoomMetadata,
  type ServerEvent,
} from "@elm-chat/shared";
import { startTransition, useEffect, useRef, useState, type CSSProperties } from "react";

type View = "landing" | "room";

type UiMessage = {
  id: string;
  senderSessionId: string;
  plaintext: string;
  sentAt: number;
  expiresAt?: number;
};

type PeerLink = {
  peer: PeerDescriptor;
  pc: RTCPeerConnection;
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
          <div className="hero-links" aria-label="Learn about elm chat">
            <a className="hero-link" href={whyUseUrl} rel="noreferrer" target="_blank">
              Why use this?
            </a>
            <a className="hero-link" href={articleUrl} rel="noreferrer" target="_blank">
              Read the article
            </a>
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
  const identityKeyRef = useRef<string>("");
  const joinedRef = useRef(false);
  const chatLogRef = useRef<HTMLElement | null>(null);
  const peersRef = useRef(new Map<string, PeerLink>());
  const messageRef = useRef(new Map<string, EncryptedMessageEnvelope>());
  const shouldRequestSyncRef = useRef(false);

  function sendPeerData(payload: PeerDataEvent) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN && joinedRef.current) {
      socket.send(JSON.stringify({ type: "peer_data", data: payload }));
      return true;
    }
    return false;
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
              creatorToken: creatorToken || undefined
            })
          );
        });

        socket.addEventListener("close", () => {
          joinedRef.current = false;
          setConnection((current) => (room?.status === "open" ? "Disconnected" : "Closed"));
          closeAllPeerLinks();
        });

        socket.addEventListener("error", () => {
          setConnection("Error");
        });

        socket.addEventListener("message", async (event) => {
          const payload = JSON.parse(String(event.data)) as ServerEvent;
          if (payload.type === "joined") {
            joinedRef.current = true;
            startTransition(() => {
              setRoom(payload.room);
              setPresence(payload.presence);
              setReady(true);
            });
            shouldRequestSyncRef.current = payload.peers.length > 0;
            for (const peer of payload.peers) {
              ensurePeer(peer, sessionId < peer.sessionId);
            }
            if (payload.peers.length > 0) {
              socket.send(JSON.stringify({ type: "peer_data", data: { type: "sync_request" } }));
            }
            return;
          }

          if (payload.type === "presence") {
            startTransition(() => setPresence(payload.presence));
            return;
          }

          if (payload.type === "peer_joined") {
            ensurePeer(payload.peer, sessionId < payload.peer.sessionId);
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
            const link = peersRef.current.get(payload.sessionId);
            if (link) {
              link.pc.close();
              peersRef.current.delete(payload.sessionId);
            }
            return;
          }

          if (payload.type === "signal") {
            await handleIncomingSignal(payload.fromSessionId, payload.signal);
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
            closeAllPeerLinks();
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

    function closeAllPeerLinks() {
      for (const link of peersRef.current.values()) {
        link.pc.close();
      }
      peersRef.current.clear();
    }

    function ensurePeer(peer: PeerDescriptor, initiator: boolean): PeerLink {
      const existing = peersRef.current.get(peer.sessionId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: DEFAULT_STUN_ICE_SERVERS });
      const link: PeerLink = {
        pc,
        peer
      };
      peersRef.current.set(peer.sessionId, link);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        socketRef.current?.send(
          JSON.stringify({
            type: "signal",
            toSessionId: peer.sessionId,
            signal: {
              type: "ice",
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            }
          })
        );
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          const stale = peersRef.current.get(peer.sessionId);
          if (stale?.pc === pc) {
            peersRef.current.delete(peer.sessionId);
          }
        }
      };

      if (initiator) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.send(
            JSON.stringify({
              type: "signal",
              toSessionId: peer.sessionId,
              signal: {
                type: "offer",
                sdp: offer.sdp ?? ""
              }
            })
          );
        })();
      }

      return link;
    }

    async function handleIncomingSignal(fromSessionId: string, signal: PeerSignal) {
      const knownPeer =
        peersRef.current.get(fromSessionId)?.peer ??
        ({
          sessionId: fromSessionId,
          creator: false,
          connectedAt: Date.now(),
          identityKey: ""
        } satisfies PeerDescriptor);
      const link = ensurePeer(knownPeer, false);

      if (signal.type === "offer") {
        await link.pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
        const answer = await link.pc.createAnswer();
        await link.pc.setLocalDescription(answer);
        socketRef.current?.send(
          JSON.stringify({
            type: "signal",
            toSessionId: fromSessionId,
            signal: {
              type: "answer",
              sdp: answer.sdp ?? ""
            }
          })
        );
        return;
      }

      if (signal.type === "answer") {
        await link.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
        return;
      }

      await link.pc.addIceCandidate({
        candidate: signal.candidate,
        sdpMid: signal.sdpMid ?? null,
        sdpMLineIndex: signal.sdpMLineIndex ?? null
      });
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
              expiresAt
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

      if (payload.type === "peer_destroy") {
        setRoomNotice("A connected peer destroyed this room.");
        setConnection("Closed");
        closeAllPeerLinks();
      }
    }

    void bootstrap();

    return () => {
      active = false;
      window.clearInterval(tick);
      closeAllPeerLinks();
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
      setMessages((current) => current.filter((message) => !message.expiresAt || message.expiresAt > now));
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
      expiresAfterReadSeconds: room.disappearAfterReadSeconds ?? DEFAULT_DISAPPEAR_AFTER_READ_SECONDS
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
          expiresAt
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
      sendPeerData({ type: "peer_destroy" });
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
      ? `Messages vanish after ${formatStaticDuration(room.disappearAfterReadSeconds)}.`
      : "Messages stay until someone destroys the room.";
  const roomPolicyLabel =
    typeof room?.inactivityTimeoutMs === "number"
      ? `Room self-destructs after ${formatStaticDuration(Math.floor(room.inactivityTimeoutMs / 1000))} of inactivity.`
      : "Room stays open until someone destroys it.";

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
            <button
              className={`secondary-button ${copyFeedback === "success" ? "button-success" : ""}`}
              onClick={handleCopyLink}
            >
              {copyFeedback === "success" ? "Copied" : "Copy link"}
            </button>
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
                <p>{message.plaintext}</p>
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
