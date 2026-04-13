export const ROOM_SECRET_BYTES = 32;
export const ROOM_ID_BYTES = 16;
export const AES_GCM_NONCE_BYTES = 12;
export const KEY_VERSION = "v1";
export const HKDF_INFO = `elm-chat:${KEY_VERSION}:room-key`;
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
export const DEFAULT_MAX_ROOM_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_DISAPPEAR_AFTER_READ_SECONDS = 7 * 60;
export const MAX_CONNECTIONS_PER_ROOM = 16;
export const MAX_TRANSCRIPT_SYNC_MESSAGES = 200;
export type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export const DEFAULT_STUN_ICE_SERVERS: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_CHUNK_BYTES = 16 * 1024;

export type RoomStatus = "open" | "expired" | "destroyed";

export interface CreateRoomRequest {
  disappearAfterReadSeconds?: number | null;
  inactivityTimeoutMs?: number | null;
  maxAgeMs?: number | null;
  turnstileToken?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  roomUrl: string;
  websocketPath: string;
  createdAt: number;
  expiresAt: number | null;
  inactivityTimeoutMs: number | null;
  maxAgeMs: number | null;
  disappearAfterReadSeconds: number | null;
  creatorToken: string;
}

export interface TurnCredentialsResponse {
  iceServers: IceServer[];
  ttlSeconds: number;
}

export interface RoomMetadata {
  roomId: string;
  createdAt: number;
  expiresAt: number | null;
  inactivityTimeoutMs: number | null;
  maxAgeMs: number | null;
  disappearAfterReadSeconds: number | null;
  status: RoomStatus;
  participantCount: number;
  creatorJoined: boolean;
  lastActivityAt: number;
  destroyedAt?: number;
}

export interface EncryptedMessageEnvelope {
  messageId: string;
  senderSessionId: string;
  ciphertext: string;
  nonce: string;
  sentAt: number;
  expiresAfterReadSeconds: number | null;
  signature?: string;
}

export interface PeerDescriptor {
  sessionId: string;
  creator: boolean;
  connectedAt: number;
  identityKey: string;
}

export interface PresenceSnapshot {
  count: number;
  connectedSessionIds: string[];
}

export type PeerSignal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | {
      type: "ice";
      candidate: string;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
    };

export interface JoinPayload {
  type: "join";
  sessionId: string;
  identityKey: string;
  creatorToken?: string;
  inviteToken?: string;
}

export interface SignalPayload {
  type: "signal";
  toSessionId: string;
  signal: PeerSignal;
}

export interface PeerDataRelayPayload {
  type: "peer_data";
  toSessionId?: string;
  data: PeerDataEvent;
}

export interface DestroyPayload {
  type: "destroy";
  creatorToken: string;
}

export interface PingPayload {
  type: "ping";
}

export interface KickParticipantPayload {
  type: "kick_participant";
  creatorToken: string;
  targetSessionId: string;
}

export type ClientEvent =
  | JoinPayload
  | SignalPayload
  | PeerDataRelayPayload
  | KickParticipantPayload
  | DestroyPayload
  | PingPayload;

export interface JoinedEvent {
  type: "joined";
  room: RoomMetadata;
  sessionId: string;
  creator: boolean;
  peers: PeerDescriptor[];
  presence: PresenceSnapshot;
}

export interface PresenceEvent {
  type: "presence";
  presence: PresenceSnapshot;
}

export interface PeerJoinedEvent {
  type: "peer_joined";
  peer: PeerDescriptor;
}

export interface PeerLeftEvent {
  type: "peer_left";
  sessionId: string;
}

export interface SignalEvent {
  type: "signal";
  fromSessionId: string;
  signal: PeerSignal;
}

export interface PeerDataRelayEvent {
  type: "peer_data";
  fromSessionId: string;
  data: PeerDataEvent;
}

export interface RoomStateEvent {
  type: "room_state";
  status: RoomStatus;
  expiresAt: number | null;
  reason?: string;
}

export interface ParticipantKickedEvent {
  type: "participant_kicked";
  sessionId: string;
  reason?: string;
}

export interface ErrorEventPayload {
  type: "error";
  code: string;
  message: string;
}

export type ServerEvent =
  | JoinedEvent
  | PresenceEvent
  | PeerJoinedEvent
  | PeerLeftEvent
  | SignalEvent
  | PeerDataRelayEvent
  | ParticipantKickedEvent
  | RoomStateEvent
  | ErrorEventPayload;

export interface RoomInvite {
  token: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
  consumedBySessionId?: string;
  revokedAt?: number;
}

export interface TranscriptSyncRequest {
  type: "sync_request";
}

export interface TranscriptSyncResponse {
  type: "sync_response";
  messages: EncryptedMessageEnvelope[];
}

export interface PeerChatMessage {
  type: "chat_message";
  envelope: EncryptedMessageEnvelope;
}

export interface PeerDestroyMessage {
  type: "peer_destroy";
}

export interface PeerFileAnnouncement {
  type: "file_offer";
  fileId: string;
  senderSessionId: string;
  name: string;
  mimeType: string;
  size: number;
  sentAt: number;
  expiresAfterReadSeconds: number | null;
}

export interface PeerFileRequest {
  type: "file_request";
  fileId: string;
}

export interface PeerFileChunk {
  type: "file_chunk";
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  ciphertext: string;
  nonce: string;
}

export interface PeerFileComplete {
  type: "file_complete";
  fileId: string;
}

export type PeerDataEvent =
  | TranscriptSyncRequest
  | TranscriptSyncResponse
  | PeerChatMessage
  | PeerDestroyMessage
  | PeerFileAnnouncement
  | PeerFileRequest
  | PeerFileChunk
  | PeerFileComplete;

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
