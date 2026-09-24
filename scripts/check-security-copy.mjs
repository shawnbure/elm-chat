import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const react = readFileSync("apps/web/src/MarketingPage.tsx", "utf8");
const prerender = readFileSync("apps/web/scripts/prerender-marketing.mjs", "utf8");
const built = readFileSync("apps/web/dist/security-and-limitations/index.html", "utf8");
const builtPress = readFileSync("apps/web/dist/press/index.html", "utf8");
const currentClaim = "Protocol v3 signs peer events with admitted ephemeral session keys, rotates room keys on membership changes, and retains bounded replay IDs across refresh in the same tab.";
const staleClaim = "Message authentication and replay/duplicate protections are not implemented yet.";
const nameClaim = "ELM stands for Ephemeral Logless Messaging.";

for (const [name, content] of [["React", react], ["prerender source", prerender], ["built article", built]]) {
  assert.ok(content.includes(currentClaim), `${name} is missing the current security claim`);
  assert.ok(!content.includes(staleClaim), `${name} contains an outdated security claim`);
}
for (const [name, content] of [["React press kit", react], ["prerender source", prerender], ["built press kit", builtPress]]) {
  assert.ok(content.includes(nameClaim), `${name} is missing the ELM name explanation`);
}
console.log("Published security copy matches the browser source.");
