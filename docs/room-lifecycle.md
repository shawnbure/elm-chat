# Room Lifecycle

## Creation

- the browser generates a random 256-bit room secret
- the Worker creates a room ID and creator token (optionally after an invisible Turnstile check)
- the Worker bootstraps the room's Durable Object
- the client navigates to `/c/:roomId#<room_secret>` and stores the creator token in `localStorage`

## Join

- each tab generates a random session ID (kept in `sessionStorage`) and an ephemeral ECDSA identity keypair
- the client derives the room key locally with HKDF
- the client opens the room WebSocket and sends `join` with its session ID, identity public key, and either the creator token or a one-time invite token
- the socket has 15 seconds to join; before admission it counts toward room capacity but cannot refresh the room's inactivity deadline
- the creator joins with the creator token; everyone else must present a valid, unconsumed, unrevoked invite
- before admitting a guest, the Durable Object marks the invite as claimed by that session; after the session attachment and room metadata are durable, it marks the invite admitted/consumed
- the session that consumed an invite may reconnect (e.g. reload) with the same invite; a different session cannot reuse it
- if admission fails after claiming but before it becomes durable, the invite stays visibly claimed until it expires instead of being silently reused
- the Durable Object returns currently connected peers and presence

## Active Messaging

- senders encrypt plaintext in the browser (AES-GCM under the room key)
- encrypted envelopes are relayed through the Durable Object to other participants
- each connected participant also keeps transcript state in local memory
- the server relays ciphertext but never persists message history

## File Sharing

- the sender picks a file (up to 25 MiB), which stays in the sender's browser memory
- a `file_offer` is broadcast; recipients see an "incoming file" card
- on download, the recipient sends a `file_request`; the sender streams AES-GCM-encrypted 64 KiB chunks (relayed, targeted to the requester), then `file_complete`
- the recipient decrypts, reassembles, and downloads; file contents are never stored server-side and expire on the room's message policy

## Transcript Collation

- when a new participant connects, they ask peers for transcript sync
- connected peers respond with their current encrypted history (relayed)
- the new participant de-duplicates by `messageId` and decrypts locally
- if no connected peer still has a message, it is gone

## Participant Removal

- the creator can remove a participant (`kick_participant`); the target receives `participant_kicked` and is disconnected
- revoking a consumed invite also disconnects the participant who used it

## Expiry

- message expiry is enforced locally by each client using the room policy
- room expiry is enforced by the Durable Object using lifecycle metadata (idle timeout and/or max age), via an alarm and on-path checks before WebSocket admission or event handling
- if the room expires or is destroyed, the Durable Object closes all sockets and broadcasts `room_state`

## Manual Destroy

- the creator uses the creator token returned at room creation
- the Worker forwards the destroy request to the Durable Object
- the Durable Object marks the room destroyed and closes all sockets
- connected clients also receive a `peer_destroy` relayed control event where possible
