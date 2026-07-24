# Architecture

## Overview

`elm-chat` is a disposable, end-to-end encrypted room application. A single Cloudflare Worker serves the app and API; one Durable Object per room coordinates live transport. All message and file content is encrypted in the browser under a room key derived from a secret that never leaves the URL fragment.

- `apps/web`: React SPA — room creation, browser crypto, chat + file UI, transport client.
- `workers/api`: Cloudflare Worker — serves the SPA, room + invite APIs, Turnstile verification, and WebSocket routing.
- `workers/anti-abuse`: optional separate Cloudflare Worker — metadata-only room-creation checks for operators who enable `ANTI_ABUSE_SERVICE_URL`.
- `durable-objects/room`: one Durable Object per room — membership, presence, encrypted-payload relay, invites, expiry, and destroy state.
- `packages/shared`: shared protocol contracts for room lifecycle, transport events, and peer data events.
- `packages/crypto`: browser-side HKDF + AES-GCM + ECDSA helpers over Web Crypto.

## Transport Model (encrypted relay)

Content is end-to-end encrypted in the browser and **relayed — never stored —** through the room's Durable Object over a single WebSocket. The server forwards ciphertext and cannot read it.

1. The landing page generates a random 256-bit `room_secret` in the browser.
2. `POST /api/rooms` creates room metadata plus the per-room Durable Object. Room creation can be optionally gated by an invisible Turnstile challenge and, if configured by the operator, the separate anti-abuse service.
3. The browser navigates to `/c/:roomId#<room_secret>`.
4. The client derives `K_room` locally from the fragment secret with HKDF-SHA-256.
5. The client opens one WebSocket to the room Durable Object, used for:
   - room join and presence
   - encrypted chat message relay
   - encrypted file transfer relay
   - transcript sync between participants
   - participant removal (kick) and room destroy
   - keepalive pings
6. The Durable Object relays each encrypted envelope to other participants — either broadcast to everyone else, or targeted to a single `sessionId` (used for file chunks and per-peer transcript sync).
7. When a new participant joins, they request transcript sync from connected peers; peers reply with their local encrypted history (relayed), capped to `MAX_TRANSCRIPT_SYNC_MESSAGES`.

### Why relay instead of peer-to-peer

elm-chat does **not** use WebRTC peer-to-peer transport, and it contacts **no STUN or TURN servers**. Relaying encrypted payloads through the Durable Object is a deliberate choice for this threat model:

- **Peer IP addresses stay private.** With relay, participants never connect directly, so no room member learns another member's IP. WebRTC would expose peer IPs to everyone in the room via ICE candidates — a regression for a coercion/surveillance threat model where an invitee may be hostile.
- **No TURN dependency, works everywhere.** Direct P2P fails on symmetric NAT, mobile carriers, and restrictive networks without a TURN relay. Relaying through the Worker is reliable globally.

The trade-off is that the honest-but-curious server relays ciphertext and observes connection metadata (timing, sizes, presence). Direct peer transport (with its IP-exposure trade-off) remains a possible future option, but is not part of the current implementation.

## Data Placement

### Server-side (Durable Object storage, persisted)

- room metadata (policy, status, timestamps)
- creator destroy capability (creator token)
- one-time invites

### Relayed but never persisted server-side

- encrypted chat message envelopes
- encrypted file chunks
- transcript sync payloads

### Not visible to the server at all

- plaintext of any kind
- the room secret (kept in the URL fragment)
- other participants' IP addresses (peers never connect directly to each other)

### Client-side

Each connected participant keeps the current encrypted transcript in memory and can replay it to newly connected peers. A file being sent is held in memory by the sender until a peer requests it or it expires. If no connected peer still holds a message or file, it is gone.

## Encryption

- **Room key:** HKDF-SHA-256 over the fragment secret → AES-GCM-256.
- **Messages:** AES-GCM per message with a random 96-bit nonce; transmitted as a base64url envelope.
- **Files:** chunked at `FILE_CHUNK_BYTES` (64 KiB). Each chunk is AES-GCM-encrypted with its own nonce, streamed over the relay to the requesting peer, then reassembled and decrypted by the recipient. Max size `MAX_FILE_BYTES` (25 MiB).
- **Identity keys:** each client generates an ephemeral ECDSA P-256 keypair and shares the public key on join. This is reserved for future message authentication and is not yet used to verify messages.

## Membership & Relay Rules

- The set of connected participants is derived from **live WebSocket attachments**, not an in-memory map. This survives Durable Object hibernation, so targeted relays (file chunks, per-peer sync) keep working after the object sleeps and wakes.
- Broadcasts (chat, presence, peer join/leave) go to all other participants; targeted relays go to one `sessionId`.
- Room capacity is capped at `MAX_CONNECTIONS_PER_ROOM`.
- Transcript collation on join de-duplicates by `messageId`.

## Access Control

- The creator holds the creator token (stored in the browser's `localStorage`) and can issue single-use invites, revoke invites, and remove participants.
- Non-creators must present a valid one-time invite to join. The session that consumes an invite may reconnect (e.g. a page reload), but the invite cannot be reused by a different session, and revoking it disconnects the consuming participant.

## Abuse Prevention

- Optional Cloudflare Turnstile (invisible) on room creation. The client runs the challenge when a site key is configured; the Worker verifies the token when `TURNSTILE_SECRET` is set. It stays fully inert (open creation) when unconfigured, so local dev and unconfigured deploys keep working.
- Optional separate anti-abuse Worker on room creation. The main Worker calls it only when `ANTI_ABUSE_SERVICE_URL` is configured. It receives a signed metadata-only event and can deny room creation before a room Durable Object is bootstrapped. It receives no room secret, invite token, plaintext, ciphertext, file content, or transcript. See [Optional Anti-Abuse Service](anti-abuse-service.md).

## Safety Constraints

Relaying encrypted content reduces what the server can read, but it does not eliminate:

- device compromise
- malicious room participants (anyone who decrypts can copy plaintext)
- screenshots or copied plaintext
- traffic analysis against the relay (message timing and size are observable)

The server still relays ciphertext and observes connection metadata. For high-risk deployments, denial-of-service handling, message authentication, and mobile-network reliability need explicit operational review.
