# API Spec

## `POST /api/rooms`

Creates a room and bootstraps its signaling Durable Object.

Response `201`:

```json
{
  "roomId": "random-room-id",
  "roomUrl": "https://app.example.com/c/random-room-id",
  "websocketPath": "/api/rooms/random-room-id/ws",
  "createdAt": 1744150000000,
  "expiresAt": null,
  "inactivityTimeoutMs": 600000,
  "maxAgeMs": null,
  "disappearAfterReadSeconds": 420,
  "creatorToken": "creator-only-destroy-capability"
}
```

## `GET /api/rooms/:roomId`

Returns room lifecycle metadata only.

Response `200`:

```json
{
  "roomId": "random-room-id",
  "createdAt": 1744150000000,
  "expiresAt": null,
  "inactivityTimeoutMs": 600000,
  "maxAgeMs": null,
  "disappearAfterReadSeconds": 420,
  "status": "open",
  "participantCount": 2,
  "creatorJoined": true,
  "lastActivityAt": 1744150200000
}
```

## `GET /api/rooms/:roomId/ws`

Upgrades to a WebSocket used only for signaling and room control.

### Client events

```json
{ "type": "join", "sessionId": "uuid", "creatorToken": "optional" }
{
  "type": "signal",
  "toSessionId": "uuid",
  "signal": { "type": "offer", "sdp": "..." }
}
{
  "type": "signal",
  "toSessionId": "uuid",
  "signal": { "type": "answer", "sdp": "..." }
}
{
  "type": "signal",
  "toSessionId": "uuid",
  "signal": {
    "type": "ice",
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
{ "type": "destroy", "creatorToken": "creator-only-token" }
{ "type": "ping" }
```

### Server events

```json
{
  "type": "joined",
  "room": {},
  "sessionId": "uuid",
  "creator": true,
  "peers": [{ "sessionId": "uuid-2", "creator": false, "connectedAt": 1744150200000 }],
  "presence": { "count": 2, "connectedSessionIds": ["uuid", "uuid-2"] }
}
{ "type": "presence", "presence": { "count": 2, "connectedSessionIds": ["uuid-1", "uuid-2"] } }
{ "type": "peer_joined", "peer": { "sessionId": "uuid-3", "creator": false, "connectedAt": 1744150300000 } }
{ "type": "peer_left", "sessionId": "uuid-2" }
{ "type": "signal", "fromSessionId": "uuid-2", "signal": { "type": "offer", "sdp": "..." } }
{ "type": "room_state", "status": "destroyed", "expiresAt": null, "reason": "destroyed" }
{ "type": "error", "code": "peer_missing", "message": "Peer is no longer connected." }
```

## Peer Data Channel Protocol

These events move directly between browsers, not through the server:

```json
{ "type": "chat_message", "envelope": { "messageId": "uuid", "senderSessionId": "uuid", "ciphertext": "base64url", "nonce": "base64url", "sentAt": 1744150200000, "expiresAfterReadSeconds": 420 } }
{ "type": "sync_request" }
{ "type": "sync_response", "messages": [{ "messageId": "uuid", "senderSessionId": "uuid", "ciphertext": "base64url", "nonce": "base64url", "sentAt": 1744150200000, "expiresAfterReadSeconds": 420 }] }
{ "type": "peer_destroy" }
{ "type": "file_offer", "fileId": "uuid", "name": "example.pdf", "mimeType": "application/pdf", "size": 12345 }
```
