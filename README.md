# elm.chat

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shawnbure/elm-chat)
![Stars](https://img.shields.io/github/stars/shawnbure/elm-chat?style=social)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Instant chat. Private, secure, fast and disposable.** End-to-end encrypted rooms that self-destruct. No accounts, no archive, no trace.

`elm.chat` is an open effort to build a messaging system for people who need privacy by default, operational simplicity, and as little server trust as possible.

This repository is for builders, reviewers, security researchers, and contributors who want to help push the project toward a genuinely minimal-footprint private communication model.

## Run your own in one click

elm.chat is Cloudflare-native, so you can fork and self-host a full private instance in about a minute — Cloudflare clones the repo into your account and provisions the Durable Objects for you:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shawnbure/elm-chat)

Prefer to do it by hand? See [Deploy to Cloudflare](#deploy-to-cloudflare) below. Want to contribute instead of just run it? Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [good first issues](docs/GOOD-FIRST-ISSUES.md).

![elm.chat landing page](docs/images/landing-page.jpg)

## What People See

The product is intentionally small and direct.

On the landing screen, a visitor sees:

- the core message: `Instant chat. Private, secure, fast and disposable.`
- a message vanish control with minutes, hours, days, or indefinite
- a room self-destruct control with minutes, hours, days, or indefinite
- a `Create private conversation` action
- a note that the room secret stays in the URL fragment and does not normally reach the server
- a quick summary panel for access, message policy, and room policy

Inside a room, people see:

- a short room code
- the configured vanish and self-destruct rules
- live presence count
- color identity chips instead of usernames
- encrypted message bubbles keyed by participant color
- creator-only `Share invite` and `Destroy` controls
- single-use invite links instead of a permanent reusable room invite
- creator ability to revoke invites and remove participants
- a single composer for fast message entry
- encrypted file sharing that streams over the encrypted relay and vanishes on the same policy as messages
- a room that is meant to disappear instead of becoming a permanent archive

The interface is meant to feel immediate, readable, and disposable. It should communicate privacy without turning the user experience into a configuration maze.

## Intent

The intent of this application is straightforward:

- footprint-less
- log-less
- no-server transcript authority
- no man in the middle with readable content
- no readable content in the middle
- end-to-end encryption
- disposable rooms that die on purpose

Those are the design goals. They matter because a private chat app should not ask users to trust infrastructure any more than absolutely necessary.

This project is trying to move toward a system where:

- the server coordinates live transport but is not the source of truth for message history
- clients hold the transcript
- rooms are short-lived and aggressively self-destruct
- capability links and end-to-end encryption reduce account, identity, and metadata exposure

## Current Direction

The shipping implementation is built around:

- a Cloudflare Worker serving the app and API, plus one Durable Object per room
- room secrets kept in the URL fragment so they do not reach the server in normal requests
- end-to-end encrypted message payloads (AES-GCM under a room key derived in the browser)
- **encrypted content relayed — never stored — through the room's Durable Object over a single WebSocket**, so the server only ever sees ciphertext
- end-to-end encrypted, chunked file sharing over that same relay
- creator-issued single-use invite links, invite revocation, and participant removal
- optional invisible Cloudflare Turnstile on room creation (inert until keys are configured)
- a disposable room lifecycle (idle + max-age self-destruct, manual destroy) instead of permanent storage

### Why relay instead of peer-to-peer

elm-chat does not use WebRTC peer-to-peer transport, and it contacts no STUN or TURN servers. Relaying encrypted payloads through the Durable Object is a deliberate choice: it keeps every participant's IP address private from other room members (naive WebRTC would leak peer IPs via ICE), needs no TURN server, and works reliably on mobile and restrictive networks. The trade-off is that the honest-but-curious server relays ciphertext and can observe connection metadata (timing, sizes, presence).

The long-term direction may add an optional direct-peer transport for participants who accept the IP-exposure trade-off, plus message authentication using the ephemeral identity keys already exchanged on join.

If you are contributing, treat the phrases "footprint-less", "log-less", and "no-server" as the product standard we are aiming toward, not as a slogan. See [docs/architecture.md](docs/architecture.md) and [docs/threat-model.md](docs/threat-model.md) for the precise current model.

## What This Is For

`elm.chat` exists for people who want a conversation without turning that conversation into a permanent asset for a platform, an attacker, a data broker, or a hostile authority.

That includes:

- privacy-minded people who simply do not want everything archived forever
- people discussing personal, legal, medical, financial, or sensitive life matters
- workers reporting abuse or misconduct
- journalists and sources
- organizers and activists
- people living under surveillance, suppression, or coercion

The point is not just to encrypt messages. The point is to reduce what can be retained, reconstructed, or stolen later.

## Why Cloudflare

Cloudflare is useful here because it lets a small project run a globally distributed real-time application without maintaining servers.

For this project specifically, Cloudflare provides:

- Workers for the HTTP edge runtime
- Durable Objects for per-room coordination and lifecycle control
- static asset hosting for the client app
- a free entry point for developers who want to experiment or contribute

As of April 10, 2026, Cloudflare documents that:

- Durable Objects are available on the Workers Free plan
- the Workers Free plan includes limited daily usage
- SQLite-backed Durable Objects are the supported backend on the free tier

Official references:

- [Cloudflare Durable Objects overview](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## Deploy to Cloudflare

This is the complete, end-to-end guide to running your own elm.chat instance on Cloudflare. The whole app is a single Cloudflare Worker: it serves the static React app **and** the API, and coordinates each room with a Durable Object. There is no separate database, server, or STUN/TURN service to run.

### What you need

- A **Cloudflare account** (the free plan is enough) — [sign up](https://dash.cloudflare.com/sign-up).
- **Node.js 18+** and npm.
- **Git**.

No paid add-ons are required. SQLite-backed Durable Objects (what this project uses) are available on the Workers Free plan.

### Option A — one click

1. Click **[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/shawnbure/elm-chat)**.
2. Authorize Cloudflare to create a fork in your GitHub account and connect it to Workers Builds.
3. When prompted for build settings, set the **build command** to `npm install && npm run build` and leave the Wrangler config path as `workers/api/wrangler.jsonc`. (The build step compiles the React app into `apps/web/dist`, which the Worker serves.)
4. Deploy. Cloudflare provisions the Worker and the Durable Object namespace for you.

If the hosted build fails for any reason, use Option B — it is the fully tested path.

### Option B — manual deploy with Wrangler (recommended)

```bash
# 1. Clone and install
git clone https://github.com/shawnbure/elm-chat.git
cd elm-chat
npm install

# 2. Authenticate Wrangler (opens a browser)
npx wrangler login

# 3. (If your Cloudflare login has more than one account) pick the target.
#    This project-scoped variable maps to Wrangler's account for deploys,
#    so it won't clobber CLOUDFLARE_ACCOUNT_ID for your other projects.
export ELM_CHAT_CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# 4. Build the web app and deploy the Worker + Durable Object (one command)
npm run deploy
```

`npm run deploy` (run from the repo root) builds `apps/web/dist` and then deploys the Worker. On success, Wrangler prints your live URL, e.g. `https://elm-chat.<your-subdomain>.workers.dev`. Open it, click **Create private conversation**, and you have a working room.

Notes:

- **Choosing an account.** `wrangler.jsonc` intentionally does **not** hardcode an `account_id`, so it deploys to whatever account you logged in with. If your login has access to more than one account, set **`ELM_CHAT_CLOUDFLARE_ACCOUNT_ID`** (find the id under **Workers & Pages → Account details** in the dashboard). The `deploy` script maps it to the `CLOUDFLARE_ACCOUNT_ID` Wrangler expects, so it stays scoped to this project. If you already export the standard `CLOUDFLARE_ACCOUNT_ID`, that is used as a fallback.
- **workers.dev subdomain.** The first time you deploy to an account, Cloudflare may ask you to register a free `*.workers.dev` subdomain (in the dashboard under **Workers & Pages**). Do that once, then re-run `npm run deploy`.
- **Durable Object migration.** The `migrations` block in `wrangler.jsonc` creates the `RoomDurableObject` SQLite class automatically on first deploy — no manual step.
- **Renaming.** To run multiple instances or avoid a name clash, change `"name"` in `workers/api/wrangler.jsonc` before deploying.
- **Redeploying after changes.** Just run `npm run deploy` again — it rebuilds `apps/web/dist` before deploying.

### Optional — custom domain

To serve the app from your own domain instead of `*.workers.dev`:

1. Add the domain to your Cloudflare account (it must use Cloudflare DNS).
2. In the dashboard: **Workers & Pages → your Worker → Settings → Domains & Routes → Add custom domain**, or add a `routes` entry to `wrangler.jsonc` and redeploy. Cloudflare provisions the TLS certificate automatically.

### Optional — abuse protection (Turnstile)

Room creation can be gated by an invisible Cloudflare Turnstile challenge. It is off until you add keys, so the steps above work without it. See [Abuse Prevention (Turnstile)](#abuse-prevention-turnstile) below for the two-step setup.

### Verify it works

1. Open your deployed URL and create a room.
2. Copy the room link (it contains a `#secret` fragment) and open it in a second browser or an incognito window to confirm two participants can exchange encrypted messages and files.
3. Optional: watch live logs with `npx wrangler tail` from `workers/api`.

### Free-tier expectations

- keep rooms short-lived
- keep storage minimal
- expect daily usage ceilings on the free plan
- prefer aggressive message expiry and room self-destruct
- large or frequent file transfers consume more of your Workers/Durable Object budget, since file chunks are relayed through the Worker

That matches the philosophy of the project anyway.

### Troubleshooting

- **`Missing entry-point` / assets error on deploy** — you didn't build first. Run `npm run build` from the repo root, then `wrangler deploy` from `workers/api`.
- **`More than one account available`** — set `ELM_CHAT_CLOUDFLARE_ACCOUNT_ID` (see above), then re-run `npm run deploy`.
- **`workers.dev` URL returns 404 or won't register** — register your workers.dev subdomain in the dashboard, then redeploy.
- **Room says "Room not found" right after creating it** — you're pointing the web app at a different Worker than the one that created the room (usually a stale local dev setup). In production this is one Worker, so it does not occur.

## Local Development

The app runs as two processes in development:

- the Cloudflare Worker + Durable Object under `wrangler dev` on `http://localhost:8799` (a dedicated port set in `workers/api/wrangler.jsonc` so it never collides with other Cloudflare projects that default to `8787`)
- the Vite dev server (React app, hot reload) on `http://localhost:3000`

Vite proxies `/api` (including the room WebSocket) to the Worker, so the app behaves exactly like production, where a single Worker serves both the static assets and the API.

First-time setup:

1. `npm install`
2. `npm run build` once (creates `apps/web/dist`, which `wrangler dev` expects)

Then, to run everything with one command:

```
npm run dev
```

Open `http://localhost:3000`. Create a room, then open the copied link (or an invite link) in a second browser/tab to see live encrypted chat between participants.

### Running from VS Code

Two entry points are provided in `.vscode/`:

- **Run without a debugger** — open the Command Palette → `Tasks: Run Task` → `dev` (also bound to the default build task, `Cmd/Ctrl+Shift+B`). This starts both servers and opens elm.chat in your **default browser**.
- **Run with the debugger** — press `F5` and pick `Debug: elm.chat (Chrome)` or `Debug: elm.chat (Edge)`. This starts both servers and launches the chosen browser attached to the VS Code debugger, so breakpoints in the React/TypeScript source work. (VS Code's JavaScript debugger supports Chrome and Edge only; for other browsers use the no-debugger task above.)

## Abuse Prevention (Turnstile)

Room creation can be gated by [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/), a privacy-preserving bot check with no cookies, no cross-site tracking, and no persistent user identity. It is optional and stays off until you configure keys, so local dev and unconfigured deploys keep working.

To enable it:

1. In the Cloudflare dashboard, create a Turnstile widget (Managed or Invisible mode) for your domain. You get a **site key** (public) and a **secret key** (private).
2. Give the web build the site key:
   `VITE_TURNSTILE_SITE_KEY=<site-key> npm run build`
   (or add it to a `.env` file under `apps/web`).
3. Give the Worker the secret:
   `cd workers/api && npx wrangler secret put TURNSTILE_SECRET`

With both set, the landing page runs an invisible challenge before creating a room, and the Worker rejects room creation unless the token verifies. With neither set, creation is open.

## Durable Object Lifecycle

Each room is coordinated by a dedicated Durable Object instance.

That object is responsible for:

- join and presence coordination
- live room event transport
- room policy enforcement
- timed expiration
- explicit destroy actions

The room is not meant to become a permanent mailbox.

The intended room behavior is:

- create fast
- coordinate live participants
- self-destruct on inactivity or explicit destroy
- leave as little behind as possible

In practical terms, a room should act more like a volatile coordination envelope than a permanent database row.

## Access Model

Room access is no longer meant to rely on a broad reusable room link.

The current direction is:

- the creator opens the room
- the creator issues a one-time invite
- one invite is intended for one participant
- invites expire
- invites can be revoked
- the creator can remove connected participants from the room

This is a better model than a permanent share link because a forwarded or stale invite should stop being useful quickly.

## Security Posture

This project should be judged against real adversarial conditions, not casual product marketing language.

Contributors should think in terms of:

- hostile infrastructure assumptions
- metadata minimization
- replay resistance
- transcript authority
- peer authentication
- safe room destruction
- low-friction mobile use under pressure

If a feature improves convenience but expands retention, logging, observability, or recoverable history, it should be challenged hard.

## What Still Matters After Single-Use Invites

Single-use invites are a meaningful improvement, but they do not solve every problem.

Risks that still remain:

- if an invite is intercepted before the intended recipient redeems it, the first redeemer can still get in
- if a device is compromised, screenshots, clipboard history, browser history, or malware can still expose the conversation
- if a participant forwards plaintext, screenshots, or the room secret after joining, the protocol cannot stop human leakage
- metadata still exists at the transport and endpoint level even when message content is encrypted
- if the creator leaves a room open too long, exposure time grows even if invites are single-use

Best practices after this change:

- issue invites only when the recipient is ready to use them
- keep invite lifetime short
- revoke unused invites quickly
- remove participants when they no longer need access
- keep message expiry and room self-destruct aggressive
- destroy the room as soon as the conversation is done
- treat every endpoint as a possible weak point

## What We Need Help With

There is a lot of room for serious contribution.

Priority contribution areas:

- cryptographic review
- protocol design
- transcript sync and deduplication
- mobile-first UX
- accessibility under stress
- file-transfer hardening (large files, resumability, backpressure)
- WebSocket auto-reconnect and resync
- traffic and metadata minimization
- operational hardening
- documentation and threat modeling

If you want to contribute, open issues, propose design changes, audit assumptions, and submit patches. High standards are welcome.

## Invitation

This project is for people everywhere who believe private communication should be normal, understandable, and technically defensible.

If you are a developer, designer, cryptographer, security researcher, or careful critic, contribute. Help make this amazing. Help make it safer. Help make it harder to abuse, harder to surveil, and easier to trust.

## Repository Notes

Recommended reading in this repository:

- [docs/architecture.md](docs/architecture.md)
- [docs/threat-model.md](docs/threat-model.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/room-lifecycle.md](docs/room-lifecycle.md)
- [docs/why-use-elm-chat.md](docs/why-use-elm-chat.md)
- [docs/truly-private-messaging.md](docs/truly-private-messaging.md)

## License

elm.chat is free software licensed under the **[GNU Affero General Public License v3.0](LICENSE)**. AGPL is chosen deliberately: because this is a trust-minimizing tool, anyone who runs a *modified public* instance must make their modified source available to that instance's users (see Section 13 of the license). That keeps every deployment — including forks — honest and inspectable, which is the entire point of a private messenger.

If you deploy a modified version as a network service, you must offer its users access to the corresponding source. Contributions are accepted under the same license; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Acceptable use

Privacy protects people; it is not a shield for abuse. See [docs/abuse-policy.md](docs/abuse-policy.md) for what is not allowed, what the architecture does and does not let anyone see, and how to report a problem. Self-hosters are the operators of their own instances and are responsible for acceptable use and local-law compliance.

## Disclaimer

Do not market or rely on this project as a completed high-assurance safety tool until its protocol, implementation, and operational guarantees have been independently reviewed and tested under realistic threat conditions.

![elm.chat room interface](docs/images/chat-room-a.jpg)
![elm.chat room interface alternate](docs/images/chat-room-b.jpg)
![elm.chat room conversation view](docs/images/chat-room-c.jpg)
