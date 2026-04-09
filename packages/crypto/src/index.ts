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
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce)
    },
    key,
    encoder.encode(plaintext)
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
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromBase64Url(nonce))
    },
    key,
    toArrayBuffer(fromBase64Url(ciphertext))
  );

  return decoder.decode(plaintext);
}
