# Optional Anti-Abuse Service

elm-chat can call a separate anti-abuse service before creating a room. This is optional and disabled unless the main Worker is configured with `ANTI_ABUSE_SERVICE_URL`.

The service is intentionally separate from the encrypted chat relay:

- it runs as its own Cloudflare Worker;
- it has its own Durable Object namespace;
- it receives no room secret, invite token, message plaintext, ciphertext, file content, or room transcript;
- it receives a keyed client fingerprint, coarse Cloudflare location metadata, user-agent family, and the requested room lifetime policy;
- the main app continues to work without it.

This is an anti-spam and abuse-friction layer, not content moderation. It cannot see encrypted messages and cannot prove what people will say after a room is created.

## Deploy the service

```sh
cd workers/anti-abuse
npx wrangler secret put SHARED_SECRET
npx wrangler deploy
```

Optional vars for `workers/anti-abuse/wrangler.jsonc` or the Cloudflare dashboard:

- `ROOM_CREATES_PER_HOUR` — max room creations per client fingerprint per hour. Defaults to `30`; set `0` to disable rate limiting.
- `BLOCKED_COUNTRIES` — comma-separated ISO country codes to deny at room creation, for operators who need regional restrictions.

## Connect elm-chat to it

Configure the main `workers/api` deployment:

```sh
cd workers/api
npx wrangler secret put ANTI_ABUSE_SHARED_SECRET
```

Then set:

- `ANTI_ABUSE_SERVICE_URL` — for example `https://elm-chat-anti-abuse.example.workers.dev/room-creation`.
- `ANTI_ABUSE_TIMEOUT_MS` — optional timeout; defaults to `1500`.
- `ANTI_ABUSE_FAIL_CLOSED` — set to `true` if room creation should fail when the service is unavailable. By default, elm-chat fails open so a broken optional service does not break chat creation.

`ANTI_ABUSE_SHARED_SECRET` in the main Worker must match `SHARED_SECRET` in the anti-abuse Worker.

## Request Contract

The main Worker sends:

```json
{
  "version": 1,
  "event": "room_create",
  "occurredAt": 1744150000000,
  "clientFingerprint": "hmac-sha256-base64url",
  "country": "US",
  "colo": "PHX",
  "userAgentFamily": "Mozilla",
  "roomPolicy": {
    "disappearAfterReadSeconds": 420,
    "inactivityTimeoutMs": 600000,
    "maxAgeMs": null
  }
}
```

The request includes `x-elm-chat-signature: sha256=<hmac>`, where the HMAC is over the raw JSON body.

The service returns:

```json
{ "action": "allow" }
```

or:

```json
{
  "action": "deny",
  "reason": "Too many rooms have been created from this client recently.",
  "retryAfterSeconds": 3600
}
```

The main Worker turns a deny decision into a room-creation failure before any room Durable Object is bootstrapped.
