import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const react = readFileSync("apps/web/src/MarketingPage.tsx", "utf8");
const prerender = readFileSync("apps/web/scripts/prerender-marketing.mjs", "utf8");
const built = readFileSync("apps/web/dist/security-and-limitations/index.html", "utf8");
const currentClaim = "Text protocol v2 authenticates to the shared room key and rejects duplicates in a live page session.";
const staleClaim = "Message authentication and replay/duplicate protections are not implemented yet.";

for (const [name, content] of [["React", react], ["prerender source", prerender], ["built article", built]]) {
  assert.ok(content.includes(currentClaim), `${name} is missing the current security claim`);
  assert.ok(!content.includes(staleClaim), `${name} contains an outdated security claim`);
}
console.log("Published security copy matches the browser source.");
