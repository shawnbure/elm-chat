# elm.chat

`elm.chat` is an open effort to build a messaging system for people who need privacy by default, operational simplicity, and as little server trust as possible.

This repository is for builders, reviewers, security researchers, and contributors who want to help push the project toward a genuinely minimal-footprint private communication model.

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
- `Copy link` and `Destroy` controls
- a single composer for fast message entry
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

The project is currently centered around:

- a Cloudflare Worker frontend and API layer
- a Cloudflare Durable Object per room
- encrypted room secrets kept in the URL fragment so they do not reach the server in normal requests
- encrypted message payloads handled in the browser
- a disposable room lifecycle instead of permanent conversation storage

The long-term direction is stronger than the current implementation. The architectural target is:

1. socket-based live coordination for reliability
2. client-aggregated transcript recovery
3. no persistent server-side message archive
4. peer-assisted synchronization when new participants join
5. direct encrypted file exchange where practical

If you are contributing, treat the phrases "footprint-less", "log-less", and "no-server" as the product standard we are aiming toward, not as a slogan.

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

## What We Need Help With

There is a lot of room for serious contribution.

Priority contribution areas:

- cryptographic review
- protocol design
- transcript sync and deduplication
- mobile-first UX
- accessibility under stress
- secure file transfer
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
- [docs/truly-private-messaging.md](docs/truly-private-messaging.md)

## Disclaimer

Do not market or rely on this project as a completed high-assurance safety tool until its protocol, implementation, and operational guarantees have been independently reviewed and tested under realistic threat conditions.
