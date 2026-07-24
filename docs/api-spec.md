# API Spec

All API responses are sent with `no-store` caching and hardening headers (`Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a strict `Content-Security-Policy`).

## `POST /api/rooms`

Creates a room and bootstraps its Durable Object.

Request body (all fields optional):

```json
{
  "disappearAfterReadSeconds": 420,
  "inactivityTimeoutMs": 600000,
  "maxAgeMs": null,
  "turnstileToken": "optional-turnstile-token"
}
```

- A `null` duration means "indefinite" (no message expiry / no idle timeout).
- If the Worker has `TURNSTILE_SECRET` configured, `turnstileToken` is required and verified; otherwise it is ignored.
- If the Worker has `ANTI_ABUSE_SERVICE_URL` configured, the Worker calls the optional anti-abuse service before creating the room. See [Optional Anti-Abuse Service](anti-abuse-service.md).

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
  "creatorToken": "creator-only-capability"
}
```

Response `403` when Turnstile is enabled and verification fails:

```json
{ "error": "Bot verification failed. Please try again." }
```

Response `403` or `429` when the optional anti-abuse service denies room creation:

```json
{ "error": "Room creation was blocked by the anti-abuse service." }
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

## `POST /api/rooms/:roomId/destroy`

Creator-only. Marks the room destroyed and disconnects everyone.

```json
{ "creatorToken": "creator-only-capability" }
```

## Invites

One-time invites let non-creators join. All three routes are creator-only.

- `POST /api/rooms/:roomId/invites` — body `{ "creatorToken": "...", "ttlMs": 600000 }`, returns the created invite (`201`).
- `GET  /api/rooms/:roomId/invites?creatorToken=...` — lists invites.
- `POST /api/rooms/:roomId/invites/revoke` — body `{ "creatorToken": "...", "token": "invite-token" }`; revokes and disconnects the consuming participant if connected.

Invite shape:

```json
{
  "token": "invite-token",
  "createdAt": 1744150000000,
  "expiresAt": 1744150600000,
  "consumedAt": 1744150100000,
  "consumedBySessionId": "uuid",
  "revokedAt": null
}
```

An invite link is `/(c)/:roomId?invite=<token>#<room_secret>`.

## `GET /api/rooms/:roomId/ws`

Upgrades to the room WebSocket. This carries both control and **relayed encrypted content** (see Peer Data Protocol).

### Client → server events

```json
{ "type": "join", "sessionId": "uuid", "identityKey": "base64url-ecdsa-pubkey", "creatorToken": "optional", "inviteToken": "optional" }
{ "type": "peer_data", "toSessionId": "uuid-or-omitted", "data": { /* see Peer Data Protocol */ } }
{ "type": "kick_participant", "creatorToken": "creator-only", "targetSessionId": "uuid" }
{ "type": "destroy", "creatorToken": "creator-only" }
{ "type": "ping" }
```

- `peer_data` with `toSessionId` omitted is broadcast to all other participants; with `toSessionId` set it is relayed to that one session.

### Server → client events

```json
{ "type": "joined", "room": { /* metadata */ }, "sessionId": "uuid", "creator": true,
  "peers": [{ "sessionId": "uuid-2", "creator": false, "connectedAt": 1744150200000, "identityKey": "base64url" }],
  "presence": { "count": 2, "connectedSessionIds": ["uuid", "uuid-2"] } }
{ "type": "presence", "presence": { "count": 2, "connectedSessionIds": ["uuid-1", "uuid-2"] } }
{ "type": "peer_joined", "peer": { "sessionId": "uuid-3", "creator": false, "connectedAt": 1744150300000, "identityKey": "base64url" } }
{ "type": "peer_left", "sessionId": "uuid-2" }
{ "type": "peer_data", "fromSessionId": "uuid-2", "data": { /* see Peer Data Protocol */ } }
{ "type": "participant_kicked", "sessionId": "uuid", "reason": "kicked" }
{ "type": "room_state", "status": "destroyed", "expiresAt": null, "reason": "destroyed" }
{ "type": "error", "code": "invite_required", "message": "A valid one-time invite is required." }
```

## Peer Data Protocol

These events are the end-to-end encrypted payloads carried inside `peer_data`. They are **relayed through the Durable Object** (broadcast, or targeted via `toSessionId`); the server forwards ciphertext and cannot read them.

```json
{ "type": "chat_message", "envelope": { "messageId": "uuid", "senderSessionId": "uuid", "ciphertext": "base64url", "nonce": "base64url", "sentAt": 1744150200000, "expiresAfterReadSeconds": 420 } }
{ "type": "sync_request" }
{ "type": "sync_response", "messages": [ /* array of envelopes, capped to MAX_TRANSCRIPT_SYNC_MESSAGES */ ] }
{ "type": "peer_destroy" }

{ "type": "file_offer", "fileId": "uuid", "senderSessionId": "uuid", "name": "example.pdf", "mimeType": "application/pdf", "size": 12345, "sentAt": 1744150200000, "expiresAfterReadSeconds": 420 }
{ "type": "file_request", "fileId": "uuid" }
{ "type": "file_chunk", "fileId": "uuid", "chunkIndex": 0, "totalChunks": 4, "ciphertext": "base64url", "nonce": "base64url" }
{ "type": "file_complete", "fileId": "uuid" }
```

**File flow:** the sender broadcasts a `file_offer`; a recipient sends a targeted `file_request`; the sender streams encrypted `file_chunk`s (targeted) followed by `file_complete`; the recipient decrypts, reassembles, and offers a download. File contents are never stored server-side and vanish on the room's message policy.
