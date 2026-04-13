# Room Lifecycle

## Creation

- the browser generates a random 256-bit room secret
- the Worker creates a room ID and creator token
- the Worker bootstraps a signaling Durable Object
- the client navigates to `/c/:roomId#<room_secret>`

## Join

- each tab generates a random session ID
- the client derives the room key locally with HKDF
- the client joins the room over WebSocket for signaling only
- the Durable Object returns currently connected peers
- the browser starts WebRTC peer connections to those peers

## Active Messaging

- senders encrypt plaintext in the browser
- encrypted envelopes move over peer data channels only
- each connected participant keeps transcript state in local memory
- the server does not persist message history

## Transcript Collation

- when a new participant connects, they ask peers for transcript sync
- connected peers respond with their current encrypted history
- the new participant de-duplicates by `messageId` and decrypts locally
- if no connected peer still has a message, it is gone

## Expiry

- message expiry is enforced locally by peers using the room policy
- room expiry is enforced by the signaling Durable Object using lifecycle metadata
- if the room expires or is destroyed, the server closes signaling sockets and peers shut down their mesh

## Manual Destroy

- the creator uses the creator token returned at room creation
- the Worker forwards the destroy request to the Durable Object
- the Durable Object marks the room as destroyed and closes signaling sockets
- connected peers also receive a direct `peer_destroy` control event when possible
