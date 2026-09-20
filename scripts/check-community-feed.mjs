import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["workers/api/src/community.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false
});
const { shapeCommunityFeed } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const issue = (number, date, extra = {}) => ({
  number,
  title: `Issue ${number}`,
  created_at: date,
  closed_at: date,
  state_reason: "completed",
  ...extra
});
const days = [1, 2, 3, 4, 5, 6].map((day) => `2026-09-0${day}T00:00:00Z`);
const feed = shapeCommunityFeed(
  [...days.map((day, i) => issue(i + 1, day)), issue(99, days[5], { pull_request: {} })],
  [...days.map((day, i) => issue(i + 1, day)), issue(99, days[5], { state_reason: "not_planned" })]
);
assert.deepEqual(feed.requests.map((item) => item.number), [6, 5, 4, 3, 2]);
assert.deepEqual(feed.fixes.map((item) => item.number), [6, 5, 4, 3, 2]);
assert.equal(feed.requests[0].url, "https://github.com/shawnbure/elm-chat/issues/6");
assert.deepEqual(shapeCommunityFeed([], []).requests, []);
console.log("Community feed checks passed.");
