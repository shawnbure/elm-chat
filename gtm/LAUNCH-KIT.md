# elm.chat — Launch Kit

Copy-paste-ready assets for the coordinated launch. Order of operations and timing are in `LAUNCH-RUNBOOK.md`. Everything here leads with the reframe from the growth plan: **elm.chat is a disposable room you share a link to — not a network you have to join.**

---

## 1. Show HN (the anchor — highest value)

**Where:** https://news.ycombinator.com/submit · **When:** Tue–Thu, ~8:00–9:30am ET. Be at your keyboard all day to reply.

**Title options** (pick one; keep it plain — HN punishes hype):
1. `Show HN: elm.chat – E2E-encrypted chat rooms that self-destruct (Cloudflare DOs)`
2. `Show HN: Disposable, end-to-end encrypted chat with no accounts and no history`
3. `Show HN: elm.chat – one-click-deployable ephemeral messenger on Cloudflare`

**URL:** link to the live app (or the GitHub repo — repo tends to draw the HN crowd better for open-source).

**First comment (post immediately after submitting):**

> Hi HN — I built elm.chat because every "private" messenger still ends up as a permanent archive somewhere. This one is designed to leave as little behind as possible:
>
> - Rooms are end-to-end encrypted in the browser; the room secret lives in the URL fragment and doesn't normally reach the server.
> - No accounts, no contact list, no persistent transcript. Rooms self-destruct on a timer or on demand.
> - Access is via single-use invite links the creator issues and can revoke.
> - It runs entirely on Cloudflare Workers + a Durable Object per room, so there's no server to babysit — and you can one-click deploy your own instance (Durable Objects get provisioned for you).
>
> It's AGPL-3.0, so any modified public instance has to share its source with users — which matters for a tool whose whole pitch is "don't trust the operator more than you must."
>
> I'd genuinely value scrutiny on the crypto and the threat model (docs in the repo). It is **not** yet independently audited, and I'm not marketing it to at-risk users until it is. Repo: https://github.com/shawnbure/elm-chat
>
> What would you want to see before you'd trust something like this?

**Pre-drafted replies to the 5 questions you'll get:**

- *"How is this different from Signal?"* → Signal is a durable, account-based network for your ongoing relationships. elm.chat is the opposite end: a throwaway room for a single conversation you specifically don't want to persist — closer to a self-destructing PrivateBin with live chat than to a messenger you'd replace Signal with.
- *"The secret is in the URL fragment — isn't that leaky?"* → The fragment isn't sent in HTTP requests, so it doesn't reach the server in normal use. Risks that remain: browser history, referrer leakage if you're not careful, and shoulder-surfing. Documented in the threat model — feedback welcome.
- *"What stops abuse if it's anonymous and ephemeral?"* → Cloudflare Turnstile gates room creation; there's a published acceptable-use policy; and by design there's very little to retain. Self-hosters own their instance's moderation. It's a real tension and I don't claim it's solved.
- *"Is it audited?"* → No. That's the top priority and I'm explicit about not overclaiming until it is. This launch is partly to recruit reviewers.
- *"Why Cloudflare / vendor lock-in?"* → It lets a solo project run a global real-time app with no servers, and Durable Objects map cleanly to 'one coordinator per room.' It's AGPL and the protocol is documented, so a non-Cloudflare backend is a welcome contribution.

---

## 2. Product Hunt

**Name:** elm.chat
**Tagline (60 char max):** `Encrypted chat rooms that self-destruct — no signup, no trace`
**Description:**

> elm.chat is the fastest way to have a conversation that doesn't stick around. Spin up an end-to-end encrypted room, share a single-use invite link, and let it self-destruct on your schedule — minutes, hours, or the moment you're done. No accounts. No contact list. No archive. It's open source (AGPL-3.0) and runs on Cloudflare, so you can one-click deploy your own instance in about a minute.

**First comment (maker):**

> Hey Product Hunt 👋 I kept noticing that "private" chat apps still leave a permanent trail — on a server, in a backup, somewhere. elm.chat is my attempt at the opposite: a room you create, use, and let vanish, with the encryption happening in your browser and the server knowing as little as possible. It's fully open source and self-hostable. I'd love your feedback on where it should go next — especially from anyone who's had to have a conversation they wished they could truly delete afterward.

**Gallery shot list** (reuse `docs/images/`): 1) landing page with the vanish/self-destruct controls, 2) a live room with color-identity chips, 3) the "share invite" flow, 4) the "room self-destructed" screen, 5) a slide reading "no accounts · no archive · no trace."

**Hero asset — lead with this:** the two-user demo GIF at `gtm/assets/elm-chat-demo.gif` (already embedded at the top of the README). Use it as the first PH gallery item, in the Show HN first comment if a visual is allowed, and in the build-in-public thread. It shows create → single-use invite → join → encrypted chat → messages vanish → self-destruct + "make your own" footer in one loop. *Note: it contains a demo password on screen — fake, but confirm you're comfortable with the wording before posting.*

**Alt platforms to hit the same week:** Peerlist, Uneed, Fazier, Tiny Startups, DevHunt (dev-tool focused). Multi-platform launches convert meaningfully better than PH alone.

---

## 3. Reddit (tailor per sub — never cross-post identical text)

**r/selfhosted** — *Title:* `elm.chat: self-hostable, ephemeral E2E chat on Cloudflare Workers (one-click deploy, AGPL)`
> Built a disposable encrypted chat that runs entirely on Cloudflare Workers + Durable Objects — no VPS, no database to babysit. One-click "Deploy to Cloudflare" forks it into your account and provisions the Durable Objects automatically. Rooms self-destruct, secrets stay client-side, AGPL-3.0. Repo + threat model in comments. Would love feedback from people who self-host privacy tools.

**r/privacy** — *Title:* `Open-source ephemeral messenger: no accounts, no archive, secret stays in the URL fragment`
> Sharing an open-source project (not selling anything — it's free and AGPL). It's an E2E-encrypted chat where rooms self-destruct and there's no persistent transcript on the server. I'm explicitly **not** claiming it's audit-grade yet; posting here because this community is the best at finding the holes. Threat model and known-limitations are in the repo. What would you attack first?

**r/opensource** — *Title:* `elm.chat — AGPL ephemeral chat; looking for contributors (crypto review, mobile UX, protocol)`
> Lead with the "help wanted" areas and good-first-issues; this sub rewards genuine contribution asks over launches.

**r/crypto / r/cryptography** — only post if you want deep protocol scrutiny; lead with the design doc, not the product. Expect (and welcome) harsh feedback.

**Reddit rules of engagement:** read each sub's self-promotion rules first, post as a builder asking for feedback (not an ad), reply to every comment, never link the same text twice.

---

## 4. awesome-list PRs (evergreen backlinks + credibility)

Submit small PRs adding one entry each:
- `awesome-selfhosted` (Communication → Chat/IRC): `elm.chat - Ephemeral, end-to-end encrypted chat rooms that self-destruct; runs on Cloudflare Workers. (AGPL-3.0)`
- `awesome-privacy` (Encrypted Messaging or Ephemeral): similar one-liner.
- PrivacyGuides / privacytools community forum: introduce it as a project seeking review (follow their submission criteria — they require maturity, so frame as "in development, seeking review").

---

## 5. Build-in-public social thread (X / Bluesky / Mastodon)

**Opening post:**
> I built a chat app designed to forget you.
> No account. No contact list. No message history on the server.
> You spin up a room, share a one-time link, and it self-destructs when you're done.
> Open source, self-hostable in one click. 🧵

**Thread beats:** (2) why permanent chat archives are a liability, (3) how the room secret stays in the URL fragment, (4) the Cloudflare Durable Object architecture in one diagram, (5) the one-click deploy, (6) "it's AGPL so every public fork stays open," (7) "not audited yet — come break it," link.

---

## 6. Press pitch (send AFTER audit progress — see runbook)

**Subject:** `An open-source messenger designed to leave no trace — and to prove it`

> Hi [Name],
>
> Most "private" chat apps still keep a copy of your conversation somewhere. I built elm.chat to do the opposite: end-to-end encrypted rooms that self-destruct, with no accounts, no contact graph, and no server-side transcript. It's fully open source under AGPL — meaning even a modified public version has to show its users the code — and anyone can self-host it in one click.
>
> [If applicable:] It's currently undergoing independent cryptographic review; happy to share the process and findings.
>
> There's a bigger story here about who gets to retain your conversations by default. Happy to walk you through it or get you set up in a room to try it live.
>
> Repo: https://github.com/shawnbure/elm-chat

**Targets:** 404 Media, The Verge, TechCrunch, Ars Technica, The Register, plus privacy newsletters (e.g., the ones from EFF, Access Now community). Personalize each — no blast.
