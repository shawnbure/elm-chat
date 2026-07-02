# Good First Issues

Scoped starting points for new contributors. Copy any of these into a GitHub Issue (Issues → New) and add the `good first issue` label. Each is intentionally small and reviewable. Ordered roughly easiest → harder.

---

### 1. Add a "Create your own room" callout on the invite/room-gone screens
**Type:** UX / growth · **Difficulty:** easy
When a guest lands on an expired or used invite, or a room self-destructs, show a calm one-line prompt linking to `/` ("This secure room was made with elm.chat — create your own, free, no signup"). No tracking. This is the project's main organic-growth surface.

### 2. Add a `robots.txt` and basic Open Graph / meta tags
**Type:** SEO / polish · **Difficulty:** easy
The landing page should have a title, description, OG image, and Twitter card so shared links render nicely. Keep it content-free about any room.

### 3. Copy-to-clipboard confirmation for invite links
**Type:** UX · **Difficulty:** easy
Ensure "Share invite" and "Copy my link" show a clear, timed confirmation and are keyboard-accessible with `aria-live`.

### 4. Respect `prefers-reduced-motion`
**Type:** accessibility · **Difficulty:** easy
Audit `styles.css` for animations/transitions and gate non-essential motion behind the media query.

### 5. Keyboard & screen-reader pass on the composer and room controls
**Type:** accessibility · **Difficulty:** medium
Verify focus order, labels, and `aria-*` on the composer, Share/Destroy buttons, and participant strip. Document findings.

### 6. Visible countdown for message vanish / room self-destruct
**Type:** UX · **Difficulty:** medium
Show a live countdown (or relative "vanishes in ~3m") so users understand the ephemeral policy at a glance.

### 7. Graceful reconnect on WebSocket drop
**Type:** reliability · **Difficulty:** medium
When the room socket drops (mobile network flap), attempt bounded reconnection with clear UI state instead of a dead room.

### 8. Configurable invite TTL in the UI
**Type:** feature · **Difficulty:** medium
Let the creator choose invite lifetime when issuing a one-time invite (default short). Enforce server-side.

### 9. Add "Deploy to Cloudflare" end-to-end test / docs verification
**Type:** infra / docs · **Difficulty:** medium
Verify the one-click deploy provisions the Durable Object correctly on a fresh account; document any manual steps.

### 10. Threat-model diagram
**Type:** docs / security · **Difficulty:** medium
Produce a clear diagram of trust boundaries (client, Worker, Durable Object, URL fragment) for `docs/threat-model.md`.

### 11. Metadata-minimization audit of the Worker
**Type:** security · **Difficulty:** hard
Enumerate everything the Worker/Durable Object can observe per room (IPs, timing, sizes) and propose reductions. Write it up as a doc + issues.

### 12. Independent review of the crypto package
**Type:** security · **Difficulty:** hard
Review `packages/crypto` key exchange and message encryption against the stated threat model. File findings via SECURITY.md, not public issues.
