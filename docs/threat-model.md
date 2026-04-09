# Threat Model

## Assets

- room capability URL
- room secret in the fragment
- derived room encryption key
- ciphertext message envelopes
- creator destroy capability

## Trust Assumptions

- clients run over HTTPS/WSS only
- the browser Web Crypto API is trustworthy
- Cloudflare infrastructure is honest-but-curious for the MVP
- users protect the capability link out of band

## Primary Threats

### Link leakage

If the full capability URL is copied into insecure channels, anyone with the link can decrypt room traffic. Mitigations:

- room secret stays in the fragment
- strict `Referrer-Policy: no-referrer`
- no analytics or third-party scripts on room pages

### Server compromise or insider access

The Worker and Durable Object may be able to inspect metadata and ciphertext, but not plaintext. Mitigations:

- client-side HKDF + AES-GCM only
- no plaintext persistence
- server stores only ciphertext envelopes and lifecycle metadata

### Room ID guessing

An attacker who guesses a live room ID can join transport but still cannot decrypt without the fragment secret. Mitigations:

- room IDs are random and non-sequential
- room secrets are independently generated at 256 bits
- rooms are short-lived

### Replay / stale ciphertext

Replayed ciphertext could confuse clients. Current mitigations:

- unique message IDs
- message state tracking in the Durable Object

Future hardening:

- explicit duplicate rejection
- monotonic counters or ratchets

### Creator token theft

The creator token allows room destruction. Mitigations:

- random token generated server-side
- stored hashed in the Durable Object
- never embedded in the shared capability URL

## Not Fully Solved In MVP

- authenticated sender identity beyond possession of a session connection
- malicious recipients taking screenshots or copying plaintext after decryption
- stronger metadata protection such as IP obfuscation or traffic-shape padding
- multi-device state continuity

