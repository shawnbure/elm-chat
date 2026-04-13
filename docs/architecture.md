# Architecture

## Overview

`elm-chat` is now a peer-to-peer room application with a signaling-only server path:

- `apps/web`: React SPA for room creation, browser crypto, WebRTC transport, transcript sync, and chat UI.
- `workers/api`: Cloudflare Worker serving the SPA, room APIs, and WebSocket upgrade routing.
- `durable-objects/room`: one Durable Object per room for membership, signaling relay, presence, expiry, and destroy state.
- `packages/shared`: shared protocol contracts for room lifecycle, signaling, and peer data events.
- `packages/crypto`: browser-side HKDF + AES-GCM helpers using Web Crypto.

## Transport Model

The server no longer relays or stores chat messages.

1. The landing page generates a random `room_secret` in the browser.
2. `POST /api/rooms` creates room metadata plus a per-room signaling Durable Object.
3. The browser navigates to `/c/:roomId#<room_secret>`.
4. The client derives `K_room` locally from the fragment secret.
5. The client opens a WebSocket to the room Durable Object, but only for:
   - room join
   - peer presence
   - SDP offer / answer relay
   - ICE candidate relay
   - room destroy
   - keepalive pings
6. Peer browsers establish direct `RTCDataChannel` links to each other.
7. Encrypted message envelopes move only across peer data channels.
8. When a new participant joins, they request transcript sync from connected peers.

## Data Placement

### Server-side

Persisted in Durable Object storage:

- room metadata
- creator destroy capability
- expiry configuration

Not persisted server-side:

- plaintext messages
- ciphertext messages
- file contents
- transcript history

Session membership is kept in memory on the Durable Object while sockets are connected.

### Client-side

Each connected participant keeps the current encrypted transcript in memory and can replay it to newly connected peers. If no connected peer still holds a message, that message is gone.

## Peer Mesh Rules

- Each room participant gets a WebSocket signaling session plus zero or more peer data channels.
- The lexicographically smaller `sessionId` offers first to avoid symmetric-offer glare in normal join flow.
- Existing peers respond to `sync_request` with their local encrypted transcript, capped to the most recent `MAX_TRANSCRIPT_SYNC_MESSAGES`.
- Transcript collation on join is client-side and de-duplicates by `messageId`.

## Security Boundaries

- The URL fragment contains the room secret and is not sent to the server in standard HTTP requests.
- The Worker and Durable Object see room IDs, session IDs, peer signaling metadata, and lifecycle state only.
- Peers exchange encrypted envelopes over data channels even though WebRTC already encrypts transport.
- There is no server-side transcript recovery path.

## File Transfer Direction

The current codebase defines the peer-data protocol in a way that allows direct file offer / transfer events, but full file transfer UX is not implemented yet.

The intended model is:

- files move over peer data channels or negotiated out-of-band peer transfer paths
- the server acts only as signaling / room coordination
- no storage bucket is used by default for sensitive rooms

## Safety Constraints

This design improves ephemerality and reduces server visibility, but it does not eliminate:

- device compromise
- malicious room participants
- screenshots or copied plaintext
- traffic analysis against peers
- TURN-provider metadata exposure when relay is required

For high-risk deployments, TURN, mobile network behavior, denial-of-service handling, and peer authentication need explicit operational review.
