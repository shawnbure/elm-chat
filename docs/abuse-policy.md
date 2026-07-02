# Acceptable Use & Abuse Policy

elm.chat provides private, ephemeral, end-to-end encrypted rooms. Privacy exists to protect people — not to shield abuse. This policy explains what is not allowed, how the design limits our ability (and anyone's) to see content, and how to report a problem.

## What is not allowed

Do not use elm.chat to:

- create, share, or solicit child sexual abuse material (CSAM) or any content that sexualizes minors;
- coordinate violence, terrorism, or credible threats against people;
- traffic humans, weapons, or controlled substances;
- distribute malware or conduct attacks against others;
- harass, stalk, dox, or impersonate;
- infringe others' intellectual property.

## What we can and cannot see

By design, elm.chat minimizes what the server can observe:

- message content is **end-to-end encrypted** in the browser;
- the **room secret lives in the URL fragment** and does not normally reach the server;
- rooms are **short-lived and self-destruct**; there is no persistent transcript archive on the server.

This means that for most reports we **cannot** read message content or reconstruct a conversation, even if asked — that is the point of the tool. What we can act on are abuse vectors we control: bot-driven room creation (mitigated by Cloudflare Turnstile), and publicly advertised rooms or invite links that are reported to us.

## Reporting abuse

If you encounter content or behavior that violates this policy:

- **On the public instance:** email the maintainer (contact on the GitHub profile) with the room code and/or invite link and a description. Because rooms self-destruct, report quickly — the room may already be gone.
- **CSAM:** we report to the appropriate authorities (e.g., NCMEC in the US) and cooperate with lawful requests to the extent technically possible.

## For self-hosters

If you deploy your own instance (via the Deploy to Cloudflare button or a fork), **you are the operator** and are responsible for its acceptable use, abuse handling, and compliance with local law. We strongly recommend: keep Turnstile enabled, keep room/message lifetimes short, publish your own contact for reports, and do not advertise the instance for illegal use.

## Enforcement

On instances we operate, we may block room creation from abusive sources, cooperate with lawful legal process, and remove publicly advertised invite links that violate this policy. We cannot retroactively access content that the architecture prevents us from seeing.

*This policy will evolve as the project matures. It is not legal advice.*
