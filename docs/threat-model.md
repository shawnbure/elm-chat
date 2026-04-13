# Threat Model

## Assets

- room capability URL
- room secret in the fragment
- derived room encryption key
- peer session IDs
- encrypted transcript held by connected peers
- creator destroy capability

## Security Goal

Minimize server-side visibility and persistence so the application can be used with lower central trust than a store-and-forward chat service.

## Trust Assumptions

- browsers provide correct Web Crypto and WebRTC implementations
- users verify and protect capability links out of band
- connected peers are not automatically trusted with plaintext once they decrypt
- the signaling Worker / Durable Object is honest-but-curious, not trusted with content

## Primary Threats

### Link leakage

Anyone with the full capability URL can derive the room key and impersonate a participant.

Current mitigations:

- room secret stays in the fragment
- strict `Referrer-Policy: no-referrer`
- no third-party analytics on room pages

### Server compromise or insider access

The signaling layer can see peer metadata but should not see transcript content.

Current mitigations:

- server only handles room lifecycle and peer signaling
- no server-side transcript persistence
- peers exchange encrypted envelopes directly

Residual risk:

- signaling metadata still reveals room activity and participant timing

### Peer compromise

Any connected peer can exfiltrate plaintext after local decryption.

Not solved by this design:

- screenshots
- copy / paste
- malicious local extensions
- infected devices

### Connectivity coercion and relay visibility

Peer-to-peer systems may need TURN relays when direct connectivity fails. Relay operators can still observe metadata such as byte volume and timing even if they cannot decrypt payloads.

Operational requirement:

- use short-lived TURN credentials
- separate TURN operations from transcript storage
- assume relay metadata is observable

### Transcript loss

Because the server does not persist messages, transcript continuity depends on connected peers retaining encrypted history in memory.

Consequence:

- if no connected peer still has a message, it cannot be recovered

This is intentional for ephemerality, but it is a usability and reliability tradeoff.

### Traffic analysis

An adversary observing network patterns may infer room activity, peer presence, or message bursts without decrypting content.

Not solved in the current implementation:

- timing obfuscation
- packet padding
- cover traffic

## Non-Goals In Current Build

- strong anonymous routing
- deniable messaging
- authenticated human identity
- forward secrecy beyond a shared static room key
- verified peer device trust

## High-Risk Use Warning

This architecture is safer than the previous ciphertext-buffering relay, but it is not yet sufficient to claim strong protection for people under severe repression. A production-safe deployment still needs:

- audited TURN strategy
- stronger peer authentication or device continuity model
- replay / duplicate protections beyond message ID de-duplication
- mobile network failure testing
- clear user education about participant trust and device compromise
