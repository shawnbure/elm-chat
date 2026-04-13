import { AES_GCM_NONCE_BYTES, HKDF_INFO, KEY_VERSION, ROOM_SECRET_BYTES } from "@elm-chat/shared";

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
