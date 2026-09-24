import { AES_GCM_NONCE_BYTES, HKDF_INFO, KEY_VERSION, MESSAGE_PROTOCOL_VERSION, PEER_EVENT_PROTOCOL_VERSION, ROOM_SECRET_BYTES, type AuthenticatedPeerEvent, type EncryptedMessageEnvelope, type PeerDataEvent } from "@elm-chat/shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4 || 4)) % 4);
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function generateRoomSecret(): string {
  return toBase64Url(randomBytes(ROOM_SECRET_BYTES));
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function generateMessageId(): string {
  return crypto.randomUUID();
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return toBase64Url(bytes);
}

export function base64UrlToBytes(value: string): Uint8Array {
  return fromBase64Url(value);
}

export async function deriveRoomKey(secret: string): Promise<CryptoKey> {
  const secretBytes = fromBase64Url(secret);
  if (secretBytes.byteLength < ROOM_SECRET_BYTES) {
    throw new Error("Room secret is too short.");
  }

  const ikm = await crypto.subtle.importKey("raw", toArrayBuffer(secretBytes), "HKDF", false, [
    "deriveKey"
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array([]),
      info: encoder.encode(HKDF_INFO)
    },
    ikm,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; nonce: string; keyVersion: string }> {
  return encryptBytes(key, encoder.encode(plaintext));
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ ciphertext: string; nonce: string; keyVersion: string }> {
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce)
    },
    key,
    toArrayBuffer(plaintext)
  );

  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    nonce: toBase64Url(nonce),
    keyVersion: KEY_VERSION
  };
}

export async function decryptText(
  key: CryptoKey,
  ciphertext: string,
  nonce: string
): Promise<string> {
  const plaintext = await decryptBytes(key, ciphertext, nonce);
  return decoder.decode(plaintext);
}

export async function decryptBytes(
  key: CryptoKey,
  ciphertext: string,
  nonce: string
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromBase64Url(nonce))
    },
    key,
    toArrayBuffer(fromBase64Url(ciphertext))
  );

  return new Uint8Array(plaintext);
}

type MessageContext = Pick<EncryptedMessageEnvelope,
  "protocolVersion" | "messageId" | "senderSessionId" | "sentAt" | "expiresAfterReadSeconds" | "keyEpoch">;

function messageAssociatedData(roomId: string, context: MessageContext): Uint8Array {
  if (
    context.protocolVersion !== MESSAGE_PROTOCOL_VERSION ||
    !roomId ||
    typeof context.messageId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(context.messageId) ||
    typeof context.senderSessionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(context.senderSessionId) ||
    !Number.isSafeInteger(context.sentAt) ||
    !Number.isSafeInteger(context.keyEpoch) || context.keyEpoch < 1 ||
    (context.expiresAfterReadSeconds !== null &&
      (!Number.isSafeInteger(context.expiresAfterReadSeconds) ||
        context.expiresAfterReadSeconds < 0))
  ) {
    throw new Error("Unsupported or malformed message envelope.");
  }
  return encoder.encode(JSON.stringify([
    "elm-chat-message",
    MESSAGE_PROTOCOL_VERSION,
    roomId,
    context.messageId,
    context.senderSessionId,
    context.sentAt,
    context.expiresAfterReadSeconds,
    context.keyEpoch
  ]));
}

export async function encryptMessage(
  key: CryptoKey,
  roomId: string,
  context: MessageContext,
  plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(messageAssociatedData(roomId, context))
    },
    key,
    toArrayBuffer(encoder.encode(plaintext))
  );
  return { ciphertext: toBase64Url(new Uint8Array(ciphertext)), nonce: toBase64Url(nonce) };
}

export async function decryptMessage(
  key: CryptoKey,
  roomId: string,
  envelope: EncryptedMessageEnvelope
): Promise<string> {
  const nonce = fromBase64Url(envelope.nonce);
  if (nonce.byteLength !== AES_GCM_NONCE_BYTES) {
    throw new Error("Malformed message nonce.");
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: toArrayBuffer(messageAssociatedData(roomId, envelope))
    },
    key,
    toArrayBuffer(fromBase64Url(envelope.ciphertext))
  );
  return decoder.decode(plaintext);
}

export async function createIdentityKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );
}

export async function exportIdentityPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(new Uint8Array(exported));
}

export async function exportIdentityPrivateKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importIdentityPrivateKey(key: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    key,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

export async function importIdentityPublicKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64Url(encoded)),
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    false,
    ["verify"]
  );
}

export async function createAgreementKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
}

export async function exportAgreementPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(new Uint8Array(exported));
}

export async function exportAgreementPrivateKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importAgreementPrivateKey(key: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", key, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
}

async function importAgreementPublicKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64Url(encoded)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function derivePairwiseKey(
  privateKey: CryptoKey,
  publicKey: string,
  context: string
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: await importAgreementPublicKey(publicKey) },
    privateKey,
    256
  );
  const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode(context) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapRoomSecret(
  privateKey: CryptoKey,
  recipientPublicKey: string,
  roomId: string,
  keyEpoch: number,
  senderSessionId: string,
  targetSessionId: string,
  roomSecret: string
): Promise<{ ciphertext: string; nonce: string }> {
  const context = `elm-chat-key-rotation:1:${roomId}:${keyEpoch}:${senderSessionId}:${targetSessionId}`;
  const key = await derivePairwiseKey(privateKey, recipientPublicKey, context);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce), additionalData: toArrayBuffer(encoder.encode(context)) },
    key,
    toArrayBuffer(fromBase64Url(roomSecret))
  );
  return { ciphertext: toBase64Url(new Uint8Array(ciphertext)), nonce: toBase64Url(nonce) };
}

export async function unwrapRoomSecret(
  privateKey: CryptoKey,
  senderPublicKey: string,
  roomId: string,
  keyEpoch: number,
  senderSessionId: string,
  targetSessionId: string,
  ciphertext: string,
  nonce: string
): Promise<string> {
  const context = `elm-chat-key-rotation:1:${roomId}:${keyEpoch}:${senderSessionId}:${targetSessionId}`;
  const key = await derivePairwiseKey(privateKey, senderPublicKey, context);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64Url(nonce)), additionalData: toArrayBuffer(encoder.encode(context)) },
    key,
    toArrayBuffer(fromBase64Url(ciphertext))
  );
  return toBase64Url(new Uint8Array(plaintext));
}

export async function signPayload(key: CryptoKey, payload: Uint8Array): Promise<string> {
  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    key,
    toArrayBuffer(payload)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyPayload(
  key: CryptoKey,
  payload: Uint8Array,
  signature: string
): Promise<boolean> {
  return crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    key,
    toArrayBuffer(fromBase64Url(signature)),
    toArrayBuffer(payload)
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Peer event contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("Peer event contains an unsupported value.");
}

export function peerEventSigningBytes(
  event: Omit<AuthenticatedPeerEvent, "signature">
): Uint8Array {
  if (
    event.protocolVersion !== PEER_EVENT_PROTOCOL_VERSION ||
    !event.roomId ||
    !/^[0-9a-f-]{36}$/i.test(event.eventId) ||
    !/^[0-9a-f-]{36}$/i.test(event.senderSessionId) ||
    (event.targetSessionId !== null && !/^[0-9a-f-]{36}$/i.test(event.targetSessionId)) ||
    !Number.isSafeInteger(event.sentAt) ||
    !event.payload ||
    typeof event.payload.type !== "string"
  ) {
    throw new Error("Malformed authenticated peer event.");
  }
  return encoder.encode(canonicalJson([
    "elm-chat-peer-event",
    event.protocolVersion,
    event.roomId,
    event.eventId,
    event.senderSessionId,
    event.targetSessionId,
    event.sentAt,
    event.payload
  ]));
}

export async function createAuthenticatedPeerEvent(
  key: CryptoKey,
  roomId: string,
  senderSessionId: string,
  targetSessionId: string | null,
  payload: PeerDataEvent,
  sentAt = Date.now(),
  eventId = generateMessageId()
): Promise<AuthenticatedPeerEvent> {
  const unsigned = {
    protocolVersion: PEER_EVENT_PROTOCOL_VERSION,
    roomId,
    eventId,
    senderSessionId,
    targetSessionId,
    sentAt,
    payload
  } as const;
  return { ...unsigned, signature: await signPayload(key, peerEventSigningBytes(unsigned)) };
}

export async function verifyAuthenticatedPeerEvent(
  key: CryptoKey,
  event: AuthenticatedPeerEvent
): Promise<boolean> {
  const { signature, ...unsigned } = event;
  return verifyPayload(key, peerEventSigningBytes(unsigned), signature);
}

export async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return toBase64Url(new Uint8Array(digest));
}
