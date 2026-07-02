# elm.chat — Automation Playbook

*What I (your Cowork agent) can do for you directly, what needs one click from you, and what only you can do. Companion to `GROWTH-PLAN.md`.*

The honest framing: I can do the **making, drafting, scheduling, and repo work** end-to-end. I can't *be* an account (post as you, sign up on your behalf, or click "publish" on external sites) unless you connect a tool or drive a browser session with me. So the model is: **I produce everything; you approve/click; recurring work runs on a schedule.** Here's the full map.

---

## Tier 1 — I can do this now, in the repo (just say go)

These are code/content changes in your connected folder. I write them; you review the diff and push.

1. **`LICENSE`** — add the license you choose (AGPL-3.0 or MIT). *Blocks your fork/contribute goal until it exists.*
2. **Contributor on-ramp** — `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (responsible-disclosure policy — important for a crypto tool), `.github/ISSUE_TEMPLATE/`, PR template.
3. **"Good first issues"** — draft 8–12 well-scoped tickets from your README's "What We Need Help With" list, ready to paste into GitHub Issues.
4. **Deploy to Cloudflare button** — add to README with the correct config so one click clones + provisions Durable Objects on a visitor's account (Loop 2).
5. **README glow-up** — badges (license, stars, build), the demo GIF slot, tightened top-of-fold pitch.
6. **Loop 1 invite-footer** — implement the "created with elm.chat — make your own" line on the invite/landing surface and the "room gone → start new" screen. (I'll write the code; it touches `apps/web`.)
7. **Privacy-safe analytics** — wire in Cloudflare Web Analytics or Plausible (no cookies, on-brand).
8. **SEO landing pages** — build the comparison/how-to pages (§Loop 3) as static routes with live "create a room" CTAs.
9. **A one-page abuse/reporting policy** — needed before press (see Growth Plan §7).

## Tier 2 — I draft it fully; you paste/publish (5-min click)

External platforms I can't post to directly, but I'll hand you copy-paste-ready assets:

10. **Show HN post** — title options (title is 80% of the outcome), body, and a pre-written comment answering the top 5 questions you'll get. Plus the ideal day/time.
11. **Product Hunt kit** — tagline, description, first comment, gallery shot list, and the alt-platform versions (Peerlist, Uneed, etc.).
12. **Reddit posts** — tailored, non-spammy versions for r/privacy, r/selfhosted, r/opensource, r/crypto, each leading with the right angle.
13. **awesome-list PRs** — the exact entry text + which repos to PR (awesome-privacy, awesome-selfhosted, PrivacyGuides).
14. **Blog post** — "How I built an E2E ephemeral chat on Cloudflare Durable Objects" (ranks well, recruits contributors). Full draft.
15. **Launch-day runbook** — hour-by-hour checklist so the multi-channel launch is coordinated, not scattered.
16. **Press pitch** — a tight email pitch + target list (404 Media, The Verge, TechCrunch, etc.) timed to the audit.

## Tier 3 — Recurring, on autopilot (scheduled tasks I set up)

I can create scheduled tasks that run without you. Candidates:

17. **Weekly content engine** — every Monday I draft the week's SEO page + 3 short-form video scripts + a build-in-public thread, and drop them in a `growth/` folder for your approval.
18. **Daily launch-window monitor** (launch week) — each morning I check your Show HN/PH threads and draft replies to new comments for you to post.
19. **Weekly metrics digest** — I pull your analytics + GitHub stars/forks and email you a K-factor readout with "what to do next."
20. **Competitor/mention watch** — weekly scan for new "self-destructing chat" search trends, competitor launches, and anyone mentioning elm.chat, so you can engage.

*(These use the scheduling system. I'll wire up whichever you want.)*

## Tier 4 — Needs you to connect a tool, then I run it

21. **Actual social posting.** There's no social-posting connector in the registry today, so two options: **(a)** connect **Claude in Chrome** and I'll drive your browser to post to X/Bluesky/Reddit with your approval on each; or **(b)** I keep drafting + scheduling and you paste. I recommend (a) for X/Bluesky build-in-public cadence.
22. **GitHub automation.** If you connect a GitHub tool, I can open the issues, apply labels, and manage the PR templates directly instead of handing you text.
23. **Email outreach** (campus profs, digital-security orgs, press). If you connect Gmail, I draft + queue; you approve sends. Otherwise I hand you the drafts.

## Tier 5 — Only you can do (I'll prep everything up to the click)

- Choosing the license (legal decision — see below).
- Final "publish" on Show HN / Product Hunt (their ToS require the human account holder).
- `git push` to your repo and Cloudflare deploys (your credentials).
- Any claim about security guarantees to at-risk users — human judgment call.
- Recruiting/managing real campus ambassadors (relationships).

---

## The one decision blocking Tier 1: your license

Your repo has **no LICENSE file**, which under default copyright law means *no one may legally fork, modify, or contribute* — directly contradicting your stated goal. Pick one and I'll add it immediately:

- **AGPL-3.0** — anyone who runs a *modified public* instance must publish their changes. Best for a privacy/trust project: prevents a company from taking your code, running a secretly-weakened version, and keeping it closed. Slightly scares off corporate adopters.
- **MIT** — do anything, just keep the copyright notice. Maximum adoption and forks; you lose the copyleft protection.
- **MPL-2.0** — middle ground (file-level copyleft).

For elm.chat specifically, **AGPL-3.0** aligns with "you should not have to trust infrastructure" — but it's your call.

---

## Suggested first move

Fastest path to momentum, in order:
1. You pick a license → I ship all of **Tier 1** (repo becomes forkable, self-hostable, launch-ready).
2. I draft the full **Tier 2** launch kit.
3. We set the launch date, I set up **Tier 3** schedules, and you connect **Claude in Chrome / GitHub** if you want me posting and filing issues directly.

Tell me the license and which tier to start with, and I'll begin.
