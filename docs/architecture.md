# Architecture

## Overview

This MVP is a capability-link, ephemeral group messaging system built on Cloudflare-native infrastructure:

- `apps/web`: React single-page app for room creation, join flow, local crypto, and chat UI.
- `workers/api`: Cloudflare Worker serving the SPA, room APIs, and WebSocket upgrade routing.
- `durable-objects/room`: one Durable Object per room for presence, encrypted message relay, expiry, and destroy state.
- `packages/shared`: shared types, constants, and protocol envelopes.
- `packages/crypto`: browser-side key derivation and AES-GCM helpers using Web Crypto.

## Request Flow

1. The landing page generates a 256-bit `room_secret` in the browser.
2. `POST /api/rooms` creates a random `roomId` plus room metadata and bootstraps the per-room Durable Object.
3. The browser redirects to `/c/:roomId#<room_secret>`.
4. On the room page, the client derives `K_room` via HKDF and opens a WebSocket to `/api/rooms/:roomId/ws`.
5. The Worker forwards the WebSocket upgrade to the room Durable Object.
6. The Durable Object relays encrypted envelopes only. The client decrypts locally.
7. Read acknowledgements trigger the disappearance timer and server-side ciphertext purge.

## Security Boundaries

- The URL fragment carries the room secret and is not sent to the Worker in normal HTTP requests.
- The Worker and Durable Object see `roomId`, session identifiers, ciphertext envelopes, and lifecycle metadata only.
- The server never stores plaintext message bodies.
- The creator receives a random `creatorToken` used only for the destroy action.

## Durable Object Model

Each room is bound to a single Durable Object instance derived with `getByName(roomId)`.

Responsibilities:

- enforce the room participant cap
- track joins, disconnects, and presence
- relay encrypted envelopes over WebSockets
- persist minimal ciphertext buffers and message state
- expire messages after read
- expire or destroy rooms and close connected sockets

Current group-chat cap: 16 concurrent participants per room.

## Storage Strategy

The MVP uses Durable Object storage only:

- room metadata under a single key
- session records under `session:*`
- encrypted message buffers under `message:*`

This keeps deployment cheap and avoids introducing D1/KV until cross-room querying or external revocation becomes necessary.

## Abuse Hooks

The code includes clear insertion points for:

- Turnstile verification during room creation
- IP-based room creation throttling
- message payload size limits
- buffered message caps per room
- WebSocket participant caps

## Production Follow-Ups

- replace placeholder rate limiting with Cloudflare-native enforcement
- add log redaction and structured logging sinks
- add a cryptographic sender-auth layer if multi-device or stronger impersonation resistance is required
- add key version negotiation and ratcheting for forward secrecy beyond static room-key encryption
