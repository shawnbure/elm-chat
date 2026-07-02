---
title: "How to Send a Password Securely (Without Emailing or Texting It)"
description: "Emailing or texting a password leaves it sitting in inboxes and chat logs forever. Here's how to share a password, API key, or secret so it disappears after it's read."
target_keywords: ["send password securely", "share password safely", "how to send a password", "send api key securely", "one time secret"]
canonical_cta: "https://elm.chat"
---

# How to Send a Password Securely (Without Emailing or Texting It)

You need to give someone a password, an API key, a Wi-Fi code, a recovery phrase, or a client's login. The tempting options — email, Slack, iMessage, a text — all share one flaw: **the secret keeps existing** in inboxes, chat histories, backups, and screenshots long after the moment has passed. Anyone who later accesses that account or device can read it.

Here's how to do it properly, and why "it disappears after reading" is the feature that matters.

## Why email and text are the wrong tools

- **They persist.** A password sent over email or chat lives in at least two accounts indefinitely, plus server backups.
- **They're searchable.** "password" in an inbox search is a goldmine for anyone who gets in.
- **They're forwardable.** One thread gets forwarded and your secret spreads silently.
- **They're often unencrypted at rest** on the provider's servers.

Rotating the password afterward helps, but people rarely do, and some secrets (a recovery phrase, an SSN) can't simply be rotated.

## The right pattern: share it through something ephemeral

The safe pattern has three properties:

1. **End-to-end encrypted** — the service transporting the secret can't read it.
2. **Self-destructing** — the secret is destroyed after it's read or after a short timer.
3. **No account required** — you shouldn't have to create a profile just to hand someone a string once.

Classic "one-time secret" tools (PrivateBin, One-Time Secret, Yopass) do the one-way version well: you paste a secret, get a link, and it burns after one view.

## When you need a conversation, not just a drop

Sometimes handing over a secret involves back-and-forth: "which environment is this for?", "it's not working," "here's a second key." A one-way paste can't do that. That's where an **ephemeral, end-to-end encrypted chat room** fits: you and the recipient can talk, share the secret and any files, confirm it worked — and then the whole room self-destructs, leaving nothing behind.

### How to do it with elm.chat

1. Open [elm.chat](https://elm.chat) and create a room. Set messages to vanish (say, 15 minutes) and the room to self-destruct after it's idle.
2. Send the recipient a **single-use invite link** — one link, one person, and you can revoke it.
3. Share the password (and any files — they're encrypted and stream peer-to-peer). Confirm it worked.
4. Hit **Destroy**, or just let the room expire. No transcript is left on the server.

The room secret stays in your browser's URL fragment and doesn't normally reach the server, message content is encrypted in the browser, and there's no account tying the exchange to your identity. It's open source (AGPL-3.0) and you can even [self-host your own instance](https://github.com/shawnbure/elm-chat) if you want full control.

## A few habits that matter regardless of tool

- Share the secret only when the recipient is ready to use it, then destroy the room.
- Prefer single-use links over reusable ones.
- Rotate credentials after sharing when you can.
- Remember that a screenshot or a compromised device defeats any tool — the endpoints are always the weak point.

---

> **Need to hand off a password right now?** [Create a private, self-destructing room on elm.chat →](https://elm.chat) No signup. It vanishes when you're done.
