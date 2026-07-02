# Contributing to elm.chat

Thank you for considering a contribution. elm.chat is an open effort to build genuinely private, ephemeral messaging with as little server trust as possible. High standards are welcome — this is security-sensitive software, and thoughtful scrutiny is a feature, not a nuisance.

## Ways to contribute

You don't have to write code to help:

- **Cryptographic review** — audit the key exchange, message encryption, and secret handling. Challenge our assumptions.
- **Protocol design** — transcript sync, deduplication, peer authentication, replay resistance.
- **Threat modeling** — poke holes in `docs/threat-model.md`. Adversarial thinking is the point.
- **Mobile-first UX** — the app should be usable under stress, on a phone, one-handed.
- **Accessibility** — screen-reader support, keyboard nav, high-contrast, reduced motion.
- **Documentation** — clarify, correct, and expand the docs.
- **Bug reports** — file precise, reproducible issues.

See [good first issues](docs/GOOD-FIRST-ISSUES.md) for scoped starting points.

## Ground rules

1. **Privacy is the product.** If a change improves convenience but expands retention, logging, observability, or recoverable history, it will be challenged hard. Justify any new data that touches the server.
2. **No new telemetry on room contents.** Aggregate, content-free counters on public surfaces (landing/invite pages) are fine; anything that could deanonymize participants or reconstruct a transcript is not.
3. **Small, reviewable PRs.** One concern per pull request. Large refactors should start as an issue for discussion.
4. **Explain the security implications.** Every PR description should answer: does this change what the server can see, retain, or reconstruct?

## Development setup

Prerequisites: Node.js + npm, and a Cloudflare account only if you want to deploy.

```bash
git clone https://github.com/shawnbure/elm-chat.git
cd elm-chat
npm install
npm run build   # once, creates apps/web/dist which wrangler dev expects
npm run dev     # runs the Worker + Vite dev server together
```

Open `http://localhost:3000`, create a room, then open the invite link in a second tab to see live encrypted chat. See `README.md` for VS Code run/debug configs and Turnstile setup.

## Pull request checklist

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.
- [ ] The PR is scoped to a single concern.
- [ ] The description states any change to what the server can see, log, or retain.
- [ ] New user-facing strings are clear and calm (this app is often used under stress).
- [ ] No secrets, keys, or `.env` files committed.

## Reporting security issues

**Do not open a public issue for a vulnerability.** Follow the process in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the project's [GNU AGPL-3.0](LICENSE). This keeps every public deployment — including modified ones — open to its users, which is the whole point of a trust-minimizing tool.

## Code of conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Be rigorous with ideas and kind to people.
