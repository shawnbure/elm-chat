# Text Message Protocol v2

This document describes the text-message wire format added for issue #100. It is
an implementation design, not an independent security review.

## Threat Model and Scope

The relay sees room metadata, session IDs, ciphertext, timing, and sizes. It does
not receive the URL-fragment room secret in normal operation. AES-GCM
authenticates each text message to a holder of the room key and detects changes
to protected fields. It does not prove which human or device sent a message:
every participant who has the shared room secret can construct a valid envelope.
The relay may still suppress, delay, or reorder messages. File offers, file
requests, file metadata, and file transfer controls are outside v2's text-message
authentication boundary.

## Envelope and Associated Data

`protocolVersion` is exactly `2`. The random `messageId` and
`senderSessionId` are UUID-shaped strings, `sentAt` is a safe integer Unix
millisecond timestamp, and `expiresAfterReadSeconds` is null or a nonnegative
safe integer. The sender encrypts UTF-8 text with AES-GCM-256 and a fresh random
96-bit nonce. The 128-bit GCM tag is included in base64url `ciphertext`.

Associated data is the UTF-8 encoding of this JSON array, in this exact order:

```json
["elm-chat-message",2,"<roomId>","<messageId>","<senderSessionId>",1730000000000,420]
```

The recipient reconstructs it from the envelope and its own room URL, then
authenticates before displaying or expiring the text. A direct live relay also
requires the relay's `fromSessionId` to equal the envelope's sender ID. A
peer-supplied transcript can contain messages from other senders, so sync
authenticates each envelope individually without that live-sender check.
The constant `elm-chat-message` is the authenticated message-type domain
separator. There is no sender sequence number: a random message ID plus a
per-page accepted-ID ledger is the replay scheme. Reusing an ID, even with
different authenticated ciphertext, is rejected in that ledger. This permits
arbitrary out-of-order delivery but cannot detect missing messages.

This is a wire-format break from older clients. v2 receivers reject envelopes
without `protocolVersion: 2`; older clients cannot decrypt v2 text. Room key
derivation remains `KEY_VERSION = v1`. There is no silent downgrade path.
Participants should reload to the same client version if messages fail.

## Replay and Ordering

A browser tab tracks accepted message IDs for its current room component,
including expired messages and locally sent messages. The ledger survives
WebSocket reconnects and rejects duplicates from live relays or transcript sync.
Up to 10,000 IDs are kept; after that, new text fails closed for that page
session. Concurrent copies of an ID share a pending slot. A failed
authentication releases the slot so a valid later copy can still be accepted.
Out-of-order messages are allowed; the UI sorts by `sentAt` for display.

Refresh or tab close loses the ledger and in-memory transcript. Peer-supplied
sync after refresh may deliver an old, still unexpired message again. The relay
does not hold a durable replay ledger or transcript, and peer-supplied history
is neither complete nor authoritative. A recipient's clock controls expiry;
clock skew can change when a valid message is hidden. Room destruction ends
relay admission, but does not erase endpoint copies.

The Durable Object checks max-age and idle deadlines on WebSocket admission
and before handling each WebSocket event, in addition to its alarm. This closes
the gap where an overdue room could relay another event before its alarm ran.
It does not authenticate a peer's device or revoke plaintext already received.

There is one shared room key for the room's lifetime. No key rotation or
forward secrecy is provided. A new room and secret create a new key scope;
the room ID in associated data prevents ciphertext reuse across rooms.

## Test Vector and Adversarial Checks

`npm run check:message-protocol` constructs a deterministic independent
AES-GCM vector using a zero 256-bit key, zero 96-bit nonce, the associated-data
array above, and plaintext `vector`. The expected base64url ciphertext with
the GCM tag is `uMIjSSISvl9PtXjhyDcP6DaCSjcCZA`. The test pins that value and
verifies that the client accepts it. The same check rejects changed ciphertext,
each protected metadata field, a different room ID, and protocol v1. It also
exercises the browser receive path: direct-relay sender mismatch, transcript
sender tampering, duplicate delivery after reconnect, ID reuse, expiry,
concurrent duplicates, out-of-order IDs, retry after failed authentication,
and the replay-ledger cap. A new ledger accepting the same authenticated
envelope documents the refresh/state-loss limit. Decryption under a new room
key fails. Deadline-boundary checks cover max-age and idle expiry decisions.
These are automated checks, not a substitute for separate protocol review.

A separate review of the protocol, client event handling, transcript sync,
Durable Object deadline checks, and endpoint assumptions is still recommended
before relying on the documented room-key and live-page replay model. The
maintainer waived that review as a prerequisite for closing issue #100; the
automated checks and maintainer testing do **not** constitute an independent
security audit. File-event authentication, sender identity, and replay controls
across refresh need their own design and implementation; they are not claims
made by text protocol v2.
