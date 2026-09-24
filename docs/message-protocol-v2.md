# Message and Peer Event Protocol v3

This document describes the protocol introduced by issues #106–#109. The
filename is retained so existing documentation links continue to work. This is
an implementation design, not an independent security review.

## Threat model and scope

The relay sees room IDs, session IDs, event types, targets, ciphertext sizes,
timing, presence, and membership changes. It does not normally receive the URL
fragment secret, epoch secrets, plaintext, or files. The relay can suppress,
delay, reorder, or selectively deliver events.

Each tab session has an ephemeral ECDSA P-256 signing key and ECDH P-256 key
agreement key. The Durable Object binds both public keys to the admitted
session. This authenticates an event to that browser session. It does not prove
a person's legal or real-world identity, make a participant trustworthy, or
prevent an endpoint from retaining content.

## Signed peer envelope

Every chat, sync, file, teardown, and key-rotation payload is carried in a
versioned `AuthenticatedPeerEvent` containing:

- protocol version, room ID, random event ID, sender session ID
- optional target session ID and send timestamp
- the complete typed payload
- an ECDSA SHA-256 signature

The signature input is deterministic canonical JSON with the domain separator
`elm-chat-peer-event`. The receiver requires the room, relay sender for direct
events, target, admitted public key, version, and signature to agree. The relay
also rejects structural sender, room, and target mismatches before forwarding.
There is no silent downgrade path.

## Text envelope and key epochs

`protocolVersion` is exactly `3`. Text uses AES-GCM-256 with a fresh 96-bit
nonce. Associated data is the UTF-8 form of this exact array order:

```json
["elm-chat-message",3,"<roomId>","<messageId>","<senderSessionId>",1730000000000,420,2]
```

The final number is `keyEpoch`. Changes to the room, ID, sender, time, expiry,
epoch, nonce, or ciphertext fail authentication. The signed peer envelope adds
sender-session authentication around the shared epoch-key authentication.

A deterministic connected leader creates a fresh random 256-bit secret whenever
the Durable Object reports a membership-version change. It wraps that secret
separately for every remaining participant using ephemeral P-256 ECDH, HKDF
SHA-256, and AES-GCM with room, epoch, sender, and recipient context. The server
relays wrapped secrets but cannot derive them. Sending is disabled until the
current epoch is installed. Old epoch keys remain only in endpoint memory so
already received history can still be read; rotation cannot erase content or
keys already copied by a removed endpoint.

## Replay and transcript sync

Verified message IDs and signed event IDs are stored in a bounded,
versioned `sessionStorage` ledger. It contains IDs and expiry times only: no
plaintext, ciphertext, room secret, capability token, signature key, or file
content. The ledger survives refresh and WebSocket reconnect in the same tab,
rejects concurrent duplicates, prunes expired IDs, fails closed at 10,000 live
entries, tolerates corrupt or unavailable storage, and is cleared when the room
ends or the participant is removed.

Transcript sync is peer supplied, capped, signed, and individually verified.
It remains incomplete by design: peers can omit or reorder history, and elm.chat
does not claim server-backed recovery or proof of completeness.

## File transfer

File offers, requests, chunks, completion, cancellation, and their metadata are
inside signed peer envelopes. The receiver enforces the 25 MiB declaration,
64 KiB chunk ceiling, expected chunk count, sender, epoch, chunk indices, and
memory bound. The sender observes WebSocket backpressure. An interrupted
transfer times out after 30 seconds. A download is created only after every
chunk decrypts and the reconstructed byte count and SHA-256 digest match the
signed offer and completion event.

## Automated adversarial checks

`npm run check:message-protocol` pins the v3 AES-GCM vector, verifies signed
events and pairwise epoch wrapping, and rejects changed ciphertext, metadata,
room, epoch, payload, signature context, and rotation context. It also covers
duplicates, concurrency, out-of-order delivery, failed verification retry,
expiry garbage collection, persistent replay state, corrupt storage, and key
mismatch.

`npm test` covers room admission, session-to-key binding, unsigned relay
rejection, bounded reconnect state, and replay behavior. The
[recovery and accessibility matrix](RECOVERY-ACCESSIBILITY-TEST-MATRIX.md)
lists the real browser and assistive-technology checks still required for a
release record.

These checks are not an independent security audit. Independent review remains
open in GitHub issue #56.
