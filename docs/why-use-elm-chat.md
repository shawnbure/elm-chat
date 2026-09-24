# Why Use elm.chat?

`elm.chat` is for conversations that should be easy to start, hard to collect, and easy to leave behind.

![Current elm.chat landing page](images/landing-page-2026-09.png)

It is useful when you want:

- a private room without creating an account
- a one-time invite instead of a permanent open room link
- messages that vanish
- rooms that self-destruct
- no usernames in the conversation
- encrypted text and files without a persisted server-side transcript

## In Plain Language

Most chat apps are built to remember everything.

They keep history, profiles, device sync, archives, and metadata trails. That can be convenient, but it also means more information exists for longer in more places.

`elm.chat` takes the opposite approach.

It is designed for people who want a short, low-risk exchange without turning that conversation into another long-lived server archive.

That might mean:

- a temporary troubleshooting session
- a low-risk credential or file handoff between people who can verify each other
- short-lived event or project coordination
- a conversation whose required outcome belongs in another governed system

## What Makes It Different

- One-time invites: the creator issues single-use invites instead of sharing one reusable room link with everyone.
- Color identity: participants are identified by color, not usernames.
- Message vanish controls: set when messages disappear before anyone joins.
- Room self-destruct: set when an idle room dies automatically.
- Browser encryption: AES-GCM text and file content is relayed as ciphertext.
- Protocol v3: text metadata is authenticated to the current room-key epoch; every peer event is signed by its admitted ephemeral session key; bounded replay IDs survive refresh in the same tab.
- Disposable mindset: rooms are meant to be temporary, not lifelong archives.
- Creator controls: the creator can revoke invites and remove participants.
- Resilient room UI: explicit connection state and bounded WebSocket reconnect.
- English and Spanish room controls selected from browser language preferences.

## Who It Is For

`elm.chat` is for ordinary, low-risk conversations between people who already know and trust one another and want less server-side retention.

It is early-stage, has not completed an independent security audit, and is not designed for anonymous sources, whistleblowers, regulated data, production financial workflows, or people facing a high-risk adversary.

## The Point

The point is simple:

Not every conversation should become a permanent database record.

If you want an account-free room that starts fast, relays encrypted content, and disappears on purpose, `elm.chat` is exploring that boundary in public.

## What Still Requires Care

The app can reduce exposure. It cannot remove all risk.

You should still assume:

- a leaked invite is dangerous until it expires or is used
- a compromised phone or laptop can still expose the conversation
- participants can still copy, screenshot, or re-share what they see
- the relay can observe connection metadata such as IP addresses, timing, sizes, and presence
- ephemeral session keys do not prove a person's real-world identity, and peer transcript sync cannot prove completeness
- short room lifetimes and active room destruction are part of staying safe

![Current elm.chat room with invite and expiry controls](images/chat-room-2026-09.png)
