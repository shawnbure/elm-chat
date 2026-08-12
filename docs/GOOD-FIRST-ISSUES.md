# Good First Issues

Scoped starting points for new contributors. Copy any of these into a GitHub Issue (Issues → New) and add the `good first issue` label. Each is intentionally small and reviewable. Ordered roughly easiest → harder.

---

### 1. Add a "Create your own room" callout on the invite/room-gone screens
**Type:** UX / growth · **Difficulty:** easy
When a guest lands on an expired or used invite, or a room self-destructs, show a calm one-line prompt linking to `/` ("This secure room was made with elm.chat — create your own, free, no signup"). No tracking. This is the project's main organic-growth surface.

### 2. Add a `robots.txt` and basic Open Graph / meta tags
**Type:** SEO / polish · **Difficulty:** easy
The landing page should have a title, description, OG image, and Twitter card so shared links render nicely. Keep it content-free about any room.

### 3. Metadata-minimization audit of the Worker
**Type:** security · **Difficulty:** hard
Enumerate everything the Worker/Durable Object can observe per room (IPs, timing, sizes) and propose reductions. Write it up as a doc + issues.

### 4. Independent review of the crypto package
**Type:** security · **Difficulty:** hard
Review `packages/crypto` key exchange and message encryption against the stated threat model. File findings via SECURITY.md, not public issues.
