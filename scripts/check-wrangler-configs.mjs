import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootConfigPath = resolve("wrangler.jsonc");
const workspaceConfigPath = resolve("workers/api/wrangler.jsonc");

function readJsonc(path) {
  const source = readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(source);
}

function normalize(config, path) {
  const normalized = structuredClone(config);
  delete normalized.$schema;
  // GROWTH is optional in code and intentionally production-only. Cloudflare's
  // deploy button does not list Analytics Engine among auto-provisioned resources.
  delete normalized.analytics_engine_datasets;
  normalized.main = resolve(dirname(path), normalized.main);
  normalized.assets.directory = resolve(dirname(path), normalized.assets.directory);
  return normalized;
}

assert.deepEqual(
  normalize(readJsonc(rootConfigPath), rootConfigPath),
  normalize(readJsonc(workspaceConfigPath), workspaceConfigPath),
  "Root and workspace Wrangler configurations have drifted"
);

const rootConfig = readJsonc(rootConfigPath);
const workspaceConfig = readJsonc(workspaceConfigPath);

assert.equal(
  rootConfig.analytics_engine_datasets,
  undefined,
  "Root deploy-button config must not require an Analytics Engine dataset"
);
assert.deepEqual(
  workspaceConfig.analytics_engine_datasets,
  [{ binding: "GROWTH", dataset: "elm_chat_growth" }],
  "Workspace config must retain the production growth dataset"
);

console.log("Wrangler runtime configurations match; production analytics exception verified.");
