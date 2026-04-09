# Room Lifecycle

## Creation

- the browser generates a random 256-bit room secret
- the Worker creates a random room ID and creator token
- the Worker bootstraps a per-room Durable Object
- the client navigates to `/c/:roomId#<room_secret>`

## Join

- each browser tab generates a random session ID
- the client derives the room key locally with HKDF
- the client joins the room over WebSocket
- the Durable Object allows up to 16 simultaneous participants

## Active Messaging

- senders encrypt plaintext with AES-GCM in the browser
- the server relays ciphertext envelopes only
- unread ciphertext can be buffered temporarily in Durable Object storage
- delivery is marked once at least one other participant connection is present

## Read And Disappear

- when a non-sender participant decrypts and acknowledges a message, it enters `read`
- the Durable Object sets `disappearAt = readAt + expiresAfterReadSeconds`
- both clients can render the live countdown
- when the timer elapses, the Durable Object purges ciphertext and emits `expired`

## Expiry

Rooms close automatically when:

- they exceed the 24-hour max age
- they sit idle for 30 minutes
- both participants disconnect and the grace window expires

## Manual Destroy

- the creator uses the creator token returned at room creation
- the Worker forwards the destroy request to the Durable Object
- the Durable Object marks the room as `destroyed`, closes sockets, and refuses future joins
