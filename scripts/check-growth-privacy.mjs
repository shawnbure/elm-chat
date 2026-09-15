import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const clientPath = resolve("apps/web/src/growth.ts");
const workerPath = resolve("workers/api/src/index.ts");
const rootConfigPath = resolve("wrangler.jsonc");
const productionConfigPath = resolve("workers/api/wrangler.jsonc");

const clientSource = readFileSync(clientPath, "utf8");
const workerSource = readFileSync(workerPath, "utf8");
const rootConfig = readFileSync(rootConfigPath, "utf8");
const productionConfig = readFileSync(productionConfigPath, "utf8");

const allowedPayloadKeys = new Set(["event", "source"]);
const forbiddenFields = [
  "roomId",
  "roomSecret",
  "inviteToken",
  "creatorToken",
  "participantId",
  "sessionId",
  "identityKey",
  "ip",
  "ipAddress",
  "message",
  "plaintext",
  "ciphertext",
  "filename",
  "fileName",
  "content"
];

function assertClientPayloadShape(payload) {
  const keys = Object.keys(payload);
  assert(
    keys.every((key) => allowedPayloadKeys.has(key)),
    `Growth payload contains unsupported keys: ${keys.join(", ")}`
  );
  for (const field of forbiddenFields) {
    assert(!(field in payload), `Growth payload must not include ${field}`);
  }
}

assert.match(
  clientSource,
  /JSON\.stringify\(\{\s*event,\s*source\s*\}\)/,
  "Browser growth payload must remain limited to event and source"
);

assertClientPayloadShape({ event: "marketing_page_viewed", source: "direct" });
for (const field of forbiddenFields) {
  assert.throws(
    () => assertClientPayloadShape({ event: "marketing_page_viewed", source: "direct", [field]: "x" }),
    new RegExp(field),
    `Fixture with ${field} should be rejected`
  );
}

const growthRouteMatch = workerSource.match(
  /if \(request\.method === "POST" && url\.pathname === "\/api\/growth"\) \{[\s\S]*?\n  \}\n\n  if \(request\.method === "POST" && url\.pathname === "\/api\/rooms"\)/
);
assert(growthRouteMatch, "Could not locate /api/growth route");
const growthRouteSource = growthRouteMatch[0];

assert.match(
  growthRouteSource,
  /safeJson<\{\s*event\?: string;\s*source\?: string\s*\}>/,
  "/api/growth must parse only event/source from request bodies"
);
for (const field of forbiddenFields) {
  assert(
    !growthRouteSource.includes(field),
    `/api/growth route must not reference forbidden field ${field}`
  );
}

const recordGrowthMatch = workerSource.match(
  /function recordGrowth\(env: Env, event: GrowthEvent, source = ""\): void \{[\s\S]*?\n\}/
);
assert(recordGrowthMatch, "Could not locate recordGrowth");
const recordGrowthSource = recordGrowthMatch[0];

assert.match(recordGrowthSource, /indexes:\s*\[event\]/, "Growth index must be the event name only");
assert.match(recordGrowthSource, /blobs:\s*\[source\]/, "Growth blob must be the enumerated source only");
assert.match(recordGrowthSource, /doubles:\s*\[1\]/, "Growth double must be an aggregate count only");
for (const field of forbiddenFields) {
  assert(
    !recordGrowthSource.includes(field),
    `recordGrowth must not reference forbidden field ${field}`
  );
}

assert(
  !rootConfig.includes("analytics_engine_datasets") && !rootConfig.includes('"GROWTH"'),
  "Deploy-button self-host config must not require the GROWTH Analytics Engine binding"
);
assert(
  productionConfig.includes('"binding": "GROWTH"') &&
    productionConfig.includes('"dataset": "elm_chat_growth"'),
  "Production config must keep the explicit hosted growth dataset binding"
);

console.log("Growth measurement privacy guard passed.");
