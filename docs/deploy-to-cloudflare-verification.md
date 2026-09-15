# Deploy-to-Cloudflare Verification

Use this checklist after changing Wrangler configuration, workspace scripts, static assets, room lifecycle code, or Durable Object bindings.

## Local preflight

1. Run `npm install` from the repository root.
2. Run `npm run check:wrangler-configs`.
3. Run `npm run check:growth-privacy`.
4. Run `npm run typecheck`.
5. Run `npm run build`.

The root `wrangler.jsonc` is the public Deploy-to-Cloudflare entry point. It must keep the Worker script, static assets, and `RoomDurableObject` binding aligned with `workers/api/wrangler.jsonc`.

## Manual deploy path

1. Log in with `npx wrangler login`.
2. If the Cloudflare user can access more than one account, set `ELM_CHAT_CLOUDFLARE_ACCOUNT_ID`.
3. Run `npm run deploy`.
4. Open the printed `*.workers.dev` URL.
5. Create a room, create a single-use invite, open the invite in a second browser or private window, exchange one low-risk text message, exchange one small file, then destroy the room.
6. Run `npm run self-host:smoke-report -- --path manual` and fill in the redacted evidence block.

## Deploy button path

1. Open the README Deploy-to-Cloudflare link.
2. Confirm Cloudflare detects the repository root and `wrangler.jsonc`.
3. Confirm the build command is `npm run build`.
4. Confirm the deploy command is `npm run deploy`.
5. Deploy and run the same two-browser room test from the manual path.
6. Run `npm run self-host:smoke-report -- --path deploy-button` from a checkout at the tested commit, then fill in the redacted evidence block.

If Cloudflare shows `No Wrangler configuration detected`, stop and file an issue before deploying. That means Cloudflare is not using the reviewed Worker, static assets, and Durable Object configuration.

## Optional Turnstile path

Turnstile is off unless both keys are configured. To verify the optional gate:

1. Set `VITE_TURNSTILE_SITE_KEY` for the web build.
2. Set the Worker `TURNSTILE_SECRET` with `npx wrangler secret put TURNSTILE_SECRET`.
3. Deploy.
4. Confirm room creation succeeds with a valid challenge and fails when the Worker receives an invalid token.

Self-hosted instances do not send analytics to elm.chat. A successful self-host verification should be reported manually in the GitHub discussion linked from the README.

## Redacted report template

Generate a fresh template with:

```bash
npm run self-host:smoke-report -- --path manual
```

Use `--path deploy-button` for the one-click flow. Add `--origin https://example.workers.dev --public-origin true` only if the tester wants the generated origin to appear in the report. Otherwise, leave origins redacted.

The report separates deployment, two-browser lifecycle, post-destroy reconnect, and known-limit review. A pass in one category does not imply the others passed, and no smoke test should be described as a security audit.
