# How I built an end-to-end encrypted, self-destructing chat on Cloudflare Durable Objects

*Draft for dev.to / Hashnode / personal blog. Aim: rank for "Cloudflare Durable Objects chat" and "ephemeral encrypted chat," and recruit contributors. ~1,200 words. Add your own voice and a diagram before publishing.*

---

Every "private" messenger I've used still ends up storing my conversation somewhere — on a server, in a backup, in a data-broker's lake eventually. I wanted the opposite: a room you create, use, and let vanish, where the infrastructure knows as little as physically possible. That became [elm.chat](https://github.com/shawnbure/elm-chat), and it's open source under AGPL-3.0. Here's how it's built and what I got wrong along the way.

## The design constraint that drove everything

The rule I held myself to: **if a feature improves convenience but expands what the server can retain, log, or reconstruct, it has to justify itself hard.** That single constraint explains almost every architectural decision below.

Concretely, the goals were: no accounts, no contact graph, no persistent server-side transcript, end-to-end encryption, and rooms that self-destruct on purpose.

## Why Cloudflare Workers + Durable Objects

A real-time chat needs somewhere to coordinate live participants. The classic answer is a stateful server (or a Redis pub/sub behind stateless nodes). For a solo, no-budget project that wanted to be globally fast, that's a lot to run and secure.

Cloudflare **Durable Objects** turned out to be an almost perfect fit, because the primitive maps directly onto the domain: **one Durable Object instance per room.** Each room gets a single-threaded coordinator that handles join/presence, relays encrypted events over a WebSocket, enforces the room's policy, and — critically — self-destructs on a timer or on demand. There's no shared database of messages because there's no message database at all. The Worker serves the static client and the API; the Durable Object is the volatile coordination envelope for a single conversation.

The bonus: because it's all Cloudflare, anyone can fork the repo and click "Deploy to Cloudflare" to get their own instance with the Durable Objects provisioned automatically. Self-hosting a real-time app usually means a VPS and a weekend; here it's about a minute.

## Keeping the secret out of the server: the URL fragment

The encryption keys never need to reach the server, so they don't. The room secret lives in the **URL fragment** (`https://elm.chat/c/<room>#<secret>`). Fragments aren't included in HTTP requests, so in normal use the secret stays in the browser. The client uses it to encrypt and decrypt messages locally; the Durable Object only ever relays ciphertext.

This is a deliberately old trick (PrivateBin and others use it) and it comes with honest caveats I document in the threat model: browser history can retain the fragment, referrer headers need care, and a shoulder-surfer or a compromised device sees everything. Client-side crypto protects the transport and the operator — not the endpoints. Being loud about those limits matters more than the marketing.

## Access: single-use invites instead of a forever-link

Early on, a room was one shareable link. That's convenient and wrong: a forwarded or leaked link works forever. Now the creator issues **single-use invite links** that expire and can be revoked, and the creator can remove connected participants. It's a meaningful improvement, though not a cure — if an invite is intercepted before the intended person redeems it, the first redeemer still gets in. Again: documented, not hidden.

## What "self-destruct" actually means

Two independent policies: **message vanish** (messages disappear after minutes/hours/days or never) and **room self-destruct** (the whole room dies after inactivity, a max lifetime, or an explicit "Destroy"). The Durable Object enforces both with alarms and drops everyone when the room ends. The intent is that a room behaves "more like a volatile coordination envelope than a permanent database row."

## Things I got wrong (and fixed, and haven't)

- **White screen of death for peer login** — a race in how peers hydrated room state. Fixed, but it taught me how much of "private" UX is really about graceful failure on flaky mobile networks.
- **Message-expiry + invite-reload bugs** — expiry and invite consumption interacted in ways I didn't anticipate. Real ephemeral state is harder to reason about than persistent state, because "gone" has to be correct too.
- **Still open:** transcript sync/dedup when a new participant joins, stronger peer authentication, metadata minimization at the transport layer, and — the big one — **no independent cryptographic audit yet.** I'm explicit about not marketing this to at-risk users until that exists.

## Why AGPL

For a tool whose entire pitch is "don't trust the operator more than you must," the license has to enforce that. AGPL-3.0's Section 13 says: if you run a *modified* version as a network service, you must offer your users the source. So every public deployment — including forks — stays inspectable. That's not incidental to the product; it *is* the product.

## Come break it

The most valuable thing anyone can do is attack the assumptions: review the crypto, poke the threat model, find the metadata leaks. There's a [SECURITY.md](https://github.com/shawnbure/elm-chat/blob/main/SECURITY.md) for private disclosure and a set of [good first issues](https://github.com/shawnbure/elm-chat/blob/main/docs/GOOD-FIRST-ISSUES.md) if you'd rather build. If you've ever wanted a conversation you could truly let disappear, I'd love your help making this one trustworthy enough to be that.

Repo: **https://github.com/shawnbure/elm-chat** · Try it live and deploy your own from the README's one-click button.
