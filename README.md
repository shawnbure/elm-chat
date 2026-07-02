# elm.chat

`elm.chat` is an open effort to build a messaging system for people who need privacy by default, operational simplicity, and as little server trust as possible.

This repository is for builders, reviewers, security researchers, and contributors who want to help push the project toward a genuinely minimal-footprint private communication model.

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

A WebRTC peer-to-peer scaffold exists in the codebase but is **intentionally disabled**. Relaying encrypted payloads through the Durable Object is a deliberate choice: it keeps every participant's IP address private from other room members (naive WebRTC would leak peer IPs via ICE), needs no TURN server, and works reliably on mobile and restrictive networks. The trade-off is that the honest-but-curious server relays ciphertext and can observe connection metadata (timing, sizes, presence). `stun.cloudflare.com` and the `/api/turn-credentials` endpoint are referenced only by the dormant WebRTC path and are not used by the shipping app.

The long-term direction still includes an optional direct-peer transport for participants who accept the IP-exposure trade-off, plus message authentication using the ephemeral identity keys already exchanged on join.

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

## Free Cloudflare Setup

You can stand this project up on a free Cloudflare developer account.

High-level setup:

1. Create a Cloudflare account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Install Node.js and npm.
3. Install Wrangler:
   `npm install -g wrangler`
4. Authenticate Wrangler:
   `wrangler login`
5. Clone this repository.
6. Install dependencies:
   `npm install`
7. Build the web app:
   `npm run build`
8. Deploy the Worker:
   `cd workers/api && npx wrangler deploy`

On free tier expectations:

- keep rooms short-lived
- keep storage minimal
- expect usage ceilings
- prefer aggressive cleanup and self-destruction policies

That matches the philosophy of the project anyway.

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

## Disclaimer

Do not market or rely on this project as a completed high-assurance safety tool until its protocol, implementation, and operational guarantees have been independently reviewed and tested under realistic threat conditions.

![elm.chat room interface](docs/images/chat-room-a.jpg)
![elm.chat room interface alternate](docs/images/chat-room-b.jpg)
![elm.chat room conversation view](docs/images/chat-room-c.jpg)
