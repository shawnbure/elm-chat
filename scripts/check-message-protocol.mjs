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

const { deriveRoomKey, encryptMessage, decryptMessage, generateRoomSecret } =
  await load("packages/crypto/src/index.ts");
const { ReplayGuard } = await load("apps/web/src/replay.ts");
const { resolveLocale, translate } = await load("apps/web/src/localization.ts");

const key = await deriveRoomKey(generateRoomSecret());
const context = {
  protocolVersion: 2,
  messageId: "11111111-1111-4111-8111-111111111111",
  senderSessionId: "22222222-2222-4222-8222-222222222222",
  sentAt: 1730000000000,
  expiresAfterReadSeconds: 420
};
const encrypted = await encryptMessage(key, "room-a", context, "hello");
const envelope = { ...context, ...encrypted };
assert.equal(await decryptMessage(key, "room-a", envelope), "hello");

async function rejected(candidate, roomId = "room-a") {
  await assert.rejects(() => decryptMessage(key, roomId, candidate));
}

await rejected({ ...envelope, ciphertext: encrypted.ciphertext.slice(0, -2) + "AA" });
for (const field of ["messageId", "senderSessionId", "sentAt", "expiresAfterReadSeconds"]) {
  await rejected({ ...envelope, [field]: field === "sentAt" ? context.sentAt + 1 :
    field === "expiresAfterReadSeconds" ? 421 :
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
  "elm-chat-message", 2, "room-a", context.messageId, context.senderSessionId,
  context.sentAt, context.expiresAfterReadSeconds
]));
const vector = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv: nonce, additionalData: aad },
  rawKey,
  new TextEncoder().encode("vector")
);
assert.equal(Buffer.from(vector).toString("base64url"), "uMIjSSISvl9PtXjhyDcP6DaCSjcCZA");
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

assert.equal(resolveLocale(["es-MX", "en-US"]), "es");
assert.equal(resolveLocale(["fr-FR"]), "en");
assert.equal(translate("es", "destroyed").includes("desconectadas"), true);
assert.equal(translate("en", "roomExpires", { duration: "2m" }), "Room self-destructs in 2m.");

console.log("Message protocol and localization checks passed.");
