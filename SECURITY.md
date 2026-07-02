# Security Policy

elm.chat is privacy- and safety-critical software. We take vulnerabilities seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately through one of:

- GitHub's **[Private vulnerability reporting](https://github.com/shawnbure/elm-chat/security/advisories/new)** (preferred — go to the repo's Security tab → "Report a vulnerability").
- Email the maintainer directly (see the GitHub profile for contact).

Please include:

- a description of the issue and its impact,
- steps to reproduce (proof-of-concept if possible),
- affected component(s) and version/commit,
- any suggested mitigation.

## What to expect

- **Acknowledgement** within 72 hours.
- An initial assessment and severity rating within 7 days.
- Coordinated disclosure: we'll agree on a timeline and credit you (if you wish) in the advisory and release notes.

## Scope

In scope:

- the encryption / key-exchange / secret-handling code (`packages/crypto`, room secret in URL fragment),
- the Worker API and Durable Object room logic (metadata leakage, access control, invite handling),
- the web client (XSS, secret exposure, storage of sensitive material),
- anything that lets the server, an attacker, or a third party read, retain, or reconstruct message content or deanonymize participants.

Out of scope (known and documented — see `docs/threat-model.md`):

- compromise of a participant's own device (screenshots, clipboard, malware),
- a participant voluntarily forwarding plaintext, screenshots, or the room secret,
- transport-level metadata that is inherent to any networked system,
- social engineering of participants.

## A note on claims

Per the project's own disclaimer: elm.chat should **not** be marketed or relied upon as a completed high-assurance safety tool until its protocol, implementation, and operational guarantees have been independently reviewed under realistic threat conditions. Security reports that move us toward that bar are exactly what we want.
