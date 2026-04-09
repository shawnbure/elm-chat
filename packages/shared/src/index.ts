export const ROOM_SECRET_BYTES = 32;
export const ROOM_ID_BYTES = 16;
export const AES_GCM_NONCE_BYTES = 12;
export const KEY_VERSION = "v1";
export const HKDF_INFO = `ephem-chat:${KEY_VERSION}:room-key`;
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_MAX_ROOM_AGE_MS = 24 * 60 * 60 * 1000;
export const DISCONNECT_GRACE_MS = 2 * 60 * 1000;
export const DEFAULT_DISAPPEAR_AFTER_READ_SECONDS = 30;
export const MAX_MESSAGE_BYTES = 4 * 1024;
export const MAX_MESSAGES_BUFFERED = 200;
export const MAX_CONNECTIONS_PER_ROOM = 2;

export type RoomStatus = "open" | "expired" | "destroyed";
export type MessageState = "sent" | "delivered" | "read" | "expired" | "deleted";

export interface CreateRoomRequest {
  turnstileToken?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  roomUrl: string;
  websocketPath: string;
  createdAt: number;
  expiresAt: number;
  inactivityTimeoutMs: number;
  maxAgeMs: number;
  disappearAfterReadSeconds: number;
  creatorToken: string;
}

export interface RoomMetadata {
  roomId: string;
  createdAt: number;
  expiresAt: number;
  inactivityTimeoutMs: number;
  maxAgeMs: number;
  disappearAfterReadSeconds: number;
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
  expiresAfterReadSeconds: number;
}

export interface StoredMessage {
  envelope: EncryptedMessageEnvelope;
  state: MessageState;
  deliveredAt?: number;
  readAt?: number;
  disappearAt?: number;
}

export interface PresenceSnapshot {
  count: number;
  connectedSessionIds: string[];
}

export interface JoinPayload {
  type: "join";
  sessionId: string;
  creatorToken?: string;
}

export interface SendPayload {
  type: "send";
  envelope: EncryptedMessageEnvelope;
}

export interface ReadPayload {
  type: "read";
  messageId: string;
  readerSessionId: string;
}

export interface DestroyPayload {
  type: "destroy";
  creatorToken: string;
}

export interface PingPayload {
  type: "ping";
}

export type ClientEvent = JoinPayload | SendPayload | ReadPayload | DestroyPayload | PingPayload;

export interface JoinedEvent {
  type: "joined";
  room: RoomMetadata;
  sessionId: string;
  creator: boolean;
  pending: StoredMessage[];
  presence: PresenceSnapshot;
}

export interface PresenceEvent {
  type: "presence";
  presence: PresenceSnapshot;
}

export interface MessageEvent {
  type: "message";
  envelope: EncryptedMessageEnvelope;
}

export interface MessageStateEvent {
  type: "message_state";
  messageId: string;
  state: MessageState;
  readAt?: number;
  disappearAt?: number;
  deliveredAt?: number;
}

export interface RoomStateEvent {
  type: "room_state";
  status: RoomStatus;
  expiresAt: number;
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
  | MessageEvent
  | MessageStateEvent
  | RoomStateEvent
  | ErrorEventPayload;

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

