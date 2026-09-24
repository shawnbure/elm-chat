import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";

globalThis.crypto ??= webcrypto;

async function load(entry) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    alias: { "@elm-chat/shared": "./packages/shared/src/index.ts" }
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const { createAgreementKeyPair, createAuthenticatedPeerEvent, createIdentityKeyPair, deriveRoomKey,
  encryptMessage, decryptMessage, exportAgreementPublicKey, exportIdentityPublicKey,
  generateRoomSecret, importIdentityPublicKey, unwrapRoomSecret,
  verifyAuthenticatedPeerEvent, wrapRoomSecret } =
  await load("packages/crypto/src/index.ts");
const { ReplayGuard } = await load("apps/web/src/replay.ts");
const { InvalidMessageEnvelopeError, receiveTextMessage } =
  await load("apps/web/src/message-receive.ts");
const { roomExpiryReason } = await load("durable-objects/room/src/expiry.ts");
const { resolveLocale, translate } = await load("apps/web/src/localization.ts");

const key = await deriveRoomKey(generateRoomSecret());
const context = {
  protocolVersion: 3,
  messageId: "11111111-1111-4111-8111-111111111111",
  senderSessionId: "22222222-2222-4222-8222-222222222222",
  sentAt: 1730000000000,
  expiresAfterReadSeconds: 420,
  keyEpoch: 1
};
const encrypted = await encryptMessage(key, "room-a", context, "hello");
const envelope = { ...context, ...encrypted };
assert.equal(await decryptMessage(key, "room-a", envelope), "hello");

async function rejected(candidate, roomId = "room-a") {
  await assert.rejects(() => decryptMessage(key, roomId, candidate));
}

await rejected({ ...envelope, ciphertext: encrypted.ciphertext.slice(0, -2) + "AA" });
for (const field of ["messageId", "senderSessionId", "sentAt", "expiresAfterReadSeconds", "keyEpoch"]) {
  await rejected({ ...envelope, [field]: field === "sentAt" ? context.sentAt + 1 :
    field === "expiresAfterReadSeconds" ? 421 :
    field === "keyEpoch" ? 2 :
    field === "messageId" ? "33333333-3333-4333-8333-333333333333" :
    "44444444-4444-4444-8444-444444444444" });
}
await rejected(envelope, "room-b");
await rejected({ ...envelope, protocolVersion: 1 });

// An independently constructed v2 vector verifies the wire format and AAD order.
const rawKey = await crypto.subtle.importKey(
  "raw", new Uint8Array(32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
);
const nonce = new Uint8Array(12);
const aad = new TextEncoder().encode(JSON.stringify([
  "elm-chat-message", 3, "room-a", context.messageId, context.senderSessionId,
  context.sentAt, context.expiresAfterReadSeconds, context.keyEpoch
]));
const vector = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv: nonce, additionalData: aad },
  rawKey,
  new TextEncoder().encode("vector")
);
assert.equal(Buffer.from(vector).toString("base64url"), "uMIjSSISxzrpMjPkJkKgqLjaw0p9IQ");
assert.equal(await decryptMessage(rawKey, "room-a", {
  ...context,
  nonce: Buffer.from(nonce).toString("base64url"),
  ciphertext: Buffer.from(vector).toString("base64url")
}), "vector");

const guard = new ReplayGuard(3);
let verified = 0;
const accept = (id) => guard.accept(id, async () => { verified += 1; });
assert.equal(await accept("one"), true);
assert.equal(await accept("one"), false); // duplicate after transport reconnect
assert.equal(await accept("three"), true);
assert.equal(await accept("two"), true); // out of order is allowed
assert.equal(verified, 3);
await assert.rejects(() => accept("four"), /limit/);
const concurrent = new ReplayGuard();
let release;
const held = concurrent.accept("same", () => new Promise((resolve) => { release = resolve; }));
assert.equal(await concurrent.accept("same", async () => {}), false);
release();
assert.equal(await held, true);
assert.equal(await concurrent.accept("same", async () => {}), false);
await assert.rejects(() => concurrent.accept("retry", async () => { throw new Error("bad"); }));
assert.equal(await concurrent.accept("retry", async () => {}), true);

// Exercise the same receive path used by the browser, including relay identity,
// expiry, reconnect, refresh/state loss, and a new room key.
const received = new ReplayGuard();
const liveContext = { ...context, messageId: "66666666-6666-4666-8666-666666666666", sentAt: Date.now() };
const liveEnvelope = { ...liveContext, ...await encryptMessage(key, "room-a", liveContext, "hello") };
assert.deepEqual(await receiveTextMessage(key, "room-a", liveEnvelope, received,
  context.senderSessionId, liveContext.sentAt), { plaintext: "hello", expiresAt: liveContext.sentAt + 420000 });
assert.equal(await receiveTextMessage(key, "room-a", liveEnvelope, received,
  context.senderSessionId, liveContext.sentAt), null); // WebSocket reconnect, same page
await assert.rejects(() => receiveTextMessage(key, "room-a", envelope,
  new ReplayGuard(), "33333333-3333-4333-8333-333333333333", context.sentAt),
  InvalidMessageEnvelopeError); // direct cross-session relay
await assert.rejects(() => receiveTextMessage(key, "room-a",
  { ...envelope, senderSessionId: "33333333-3333-4333-8333-333333333333" },
  new ReplayGuard(), undefined, context.sentAt)); // transcript sender tampering
await assert.rejects(() => receiveTextMessage(key, "room-b", envelope,
  new ReplayGuard(), undefined, context.sentAt)); // cross-room transcript
const rotatedKey = await deriveRoomKey(generateRoomSecret());
await assert.rejects(() => receiveTextMessage(rotatedKey, "room-a", envelope,
  new ReplayGuard(), undefined, context.sentAt));
const expired = new ReplayGuard();
assert.equal(await receiveTextMessage(key, "room-a", envelope, expired,
  undefined, context.sentAt + 420001), null);
assert.deepEqual(await receiveTextMessage(key, "room-a", envelope, expired,
  undefined, context.sentAt),
  { plaintext: "hello", expiresAt: context.sentAt + 420000 }); // expired IDs are garbage-collected
const state = new Map();
const replayStorage = {
  getItem: (id) => state.get(id) ?? null,
  setItem: (id, value) => state.set(id, value),
  removeItem: (id) => state.delete(id)
};
const beforeRefresh = new ReplayGuard(10, replayStorage, "room-a");
assert.equal(await beforeRefresh.accept("refresh-id", null, async () => {}), true);
assert.equal(await new ReplayGuard(10, replayStorage, "room-a")
  .accept("refresh-id", null, async () => {}), false);
state.set("corrupt", "not-json");
assert.equal(await new ReplayGuard(10, replayStorage, "corrupt").accept("fresh", async () => {}), true);
const sameIdNewCiphertext = { ...liveContext,
  ...await encryptMessage(key, "room-a", liveContext, "different text") };
assert.equal(await receiveTextMessage(key, "room-a", sameIdNewCiphertext,
  received, undefined, context.sentAt), null); // message ID reuse is rejected

const identity = await createIdentityKeyPair();
const identityPublic = await exportIdentityPublicKey(identity.publicKey);
const signed = await createAuthenticatedPeerEvent(
  identity.privateKey,
  "room-a",
  context.senderSessionId,
  null,
  { type: "chat_message", envelope },
  context.sentAt,
  "55555555-5555-4555-8555-555555555555"
);
assert.equal(await verifyAuthenticatedPeerEvent(
  await importIdentityPublicKey(identityPublic), signed
), true);
assert.equal(await verifyAuthenticatedPeerEvent(
  await importIdentityPublicKey(identityPublic),
  { ...signed, roomId: "room-b" }
), false);

const agreementA = await createAgreementKeyPair();
const agreementB = await createAgreementKeyPair();
const agreementAPublic = await exportAgreementPublicKey(agreementA.publicKey);
const agreementBPublic = await exportAgreementPublicKey(agreementB.publicKey);
const nextRoomSecret = generateRoomSecret();
const wrappedSecret = await wrapRoomSecret(
  agreementA.privateKey, agreementBPublic, "room-a", 2,
  context.senderSessionId, "33333333-3333-4333-8333-333333333333", nextRoomSecret
);
assert.equal(await unwrapRoomSecret(
  agreementB.privateKey, agreementAPublic, "room-a", 2,
  context.senderSessionId, "33333333-3333-4333-8333-333333333333",
  wrappedSecret.ciphertext, wrappedSecret.nonce
), nextRoomSecret);
await assert.rejects(() => unwrapRoomSecret(
  agreementB.privateKey, agreementAPublic, "room-a", 3,
  context.senderSessionId, "33333333-3333-4333-8333-333333333333",
  wrappedSecret.ciphertext, wrappedSecret.nonce
));
assert.equal(await verifyAuthenticatedPeerEvent(
  await importIdentityPublicKey(identityPublic),
  { ...signed, payload: { type: "file_request", fileId: "changed" } }
), false);
const lifecycle = { expiresAt: 2000, inactivityTimeoutMs: 500, lastActivityAt: 1000 };
assert.equal(roomExpiryReason(lifecycle, 1499, 1), null);
assert.equal(roomExpiryReason(lifecycle, 1500, 1), "inactive");
assert.equal(roomExpiryReason(lifecycle, 1500, 0), "join-timeout");
assert.equal(roomExpiryReason(lifecycle, 2000, 1), "max-age");

assert.equal(resolveLocale(["es-MX", "en-US"]), "es");
assert.equal(resolveLocale(["fr-FR"]), "en");
assert.equal(translate("es", "destroyed").includes("desconectadas"), true);
assert.equal(translate("en", "roomExpires", { duration: "2m" }), "Room self-destructs in 2m.");

console.log("Message protocol and localization checks passed.");
