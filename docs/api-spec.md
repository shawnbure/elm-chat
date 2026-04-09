# API Spec

## `POST /api/rooms`

Creates a new room and bootstraps its Durable Object.

Request body:

```json
{
  "turnstileToken": "optional-placeholder"
}
```

Response `201`:

```json
{
  "roomId": "random-room-id",
  "roomUrl": "https://app.example.com/c/random-room-id",
  "websocketPath": "/api/rooms/random-room-id/ws",
  "createdAt": 1744150000000,
  "expiresAt": 1744236400000,
  "inactivityTimeoutMs": 1800000,
  "maxAgeMs": 86400000,
  "disappearAfterReadSeconds": 30,
  "creatorToken": "creator-only-destroy-capability"
}
```

Notes:

- the browser appends `#<room_secret>` locally
- the room secret is never posted to the server

## `GET /api/rooms/:roomId`

Returns current room status and lifecycle metadata.

Response `200`:

```json
{
  "roomId": "random-room-id",
  "createdAt": 1744150000000,
  "expiresAt": 1744236400000,
  "inactivityTimeoutMs": 1800000,
  "maxAgeMs": 86400000,
  "disappearAfterReadSeconds": 30,
  "status": "open",
  "participantCount": 1,
  "creatorJoined": true,
  "lastActivityAt": 1744150200000
}
```

## `GET /api/rooms/:roomId/ws`

Upgrades to a WebSocket and hands the connection to the room Durable Object.

Client events:

```json
{ "type": "join", "sessionId": "uuid", "creatorToken": "optional" }
{ "type": "send", "envelope": { "messageId": "uuid", "senderSessionId": "uuid", "ciphertext": "base64url", "nonce": "base64url", "sentAt": 1744150200000, "expiresAfterReadSeconds": 30 } }
{ "type": "read", "messageId": "uuid", "readerSessionId": "uuid" }
{ "type": "destroy", "creatorToken": "creator-only-token" }
{ "type": "ping" }
```

Server events:

```json
{ "type": "joined", "room": {}, "sessionId": "uuid", "creator": true, "pending": [], "presence": { "count": 1, "connectedSessionIds": ["uuid"] } }
{ "type": "presence", "presence": { "count": 2, "connectedSessionIds": ["uuid-1", "uuid-2"] } }
{ "type": "message", "envelope": { "messageId": "uuid", "senderSessionId": "uuid", "ciphertext": "base64url", "nonce": "base64url", "sentAt": 1744150200000, "expiresAfterReadSeconds": 30 } }
{ "type": "message_state", "messageId": "uuid", "state": "read", "readAt": 1744150210000, "disappearAt": 1744150240000 }
{ "type": "room_state", "status": "destroyed", "expiresAt": 1744236400000, "reason": "destroyed" }
{ "type": "error", "code": "room_full", "message": "Room already has two participants." }
```

## `POST /api/rooms/:roomId/destroy`

Destroys a room irrecoverably when the caller provides the creator token.

Request body:

```json
{
  "creatorToken": "creator-only-destroy-capability"
}
```

