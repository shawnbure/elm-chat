# Changelog

All notable changes to elm.chat are documented here.

## Unreleased

### Added

- English and Spanish localization for the interactive landing, invite, room,
  connection, file-transfer, and destruction states, selected from browser
  language preferences with English fallback.
- Message protocol v3 with signed peer events, tab-scoped replay persistence,
  membership key epochs, authenticated file controls, whole-file integrity,
  cancellation, timeout, and bounded recovery behavior.
- A recovery and accessibility test matrix plus automated reconnect, replay,
  identity-binding, unsigned-event, and key-wrap regression coverage.
- A same-origin, cached GitHub activity panel for recent fixes and open requests.
- A privacy guard for hosted aggregate growth events and a redacted self-host
  smoke-report generator covering deployment and the two-browser lifecycle.
- Updated landing-page and room screenshots captured from the current build.

### Changed

- Tightened invite admission, creator-capability checks, room deadline
  enforcement, closed-room behavior, and regression coverage.
- Added bounded WebSocket reconnect feedback and clearer invite, participant,
  file-transfer, and room-destruction states.
- Removed website voting controls; project activity links now lead to the
  corresponding GitHub issue for discussion and reactions.
- Expanded public security copy to distinguish first-party aggregate counters
  on hosted elm.chat from the analytics-free public self-host configuration.

### Security status

elm.chat still has not completed an independent security audit. Protocol v3
authenticates admitted browser sessions, not real-world people; peer transcript
sync cannot prove completeness; key rotation cannot erase content already held
by an endpoint. The relay can observe ordinary connection metadata, and
participants or compromised endpoints can retain plaintext and files.

## [0.1.2] - 2026-08-05

This maintenance release makes the public Cloudflare self-host path work from
the repository root and reduces friction in the invite handoff.

### Added

- A root `wrangler.jsonc`, root build and deploy commands, and an automated
  drift check so Cloudflare's deploy flow can detect the npm-workspaces project.
- Privacy-safe aggregate counters for successful invite-share handoffs and
  fixed-source discovery paths. Independent deployments omit elm.chat's
  optional growth-measurement binding.
- A provider-neutral engineering article and reproducible test matrix for
  treating deletion as a distributed-systems contract.

### Changed

- The native share sheet is now used when available, with clipboard fallback
  and clearer completion feedback for copied invitation links.
- The client handles already-closed WebSockets more defensively during room
  teardown and refresh flows.
- Repository self-hosting actions now pass through one fixed, aggregate counter
  before redirecting to the unchanged official Cloudflare deployment flow.

### Security status

elm.chat has not completed an independent security audit. Message
authentication and replay/duplicate protection remain unfinished. The
Cloudflare relay can observe ordinary connection metadata, and participants or
compromised devices can retain message or file copies. This release is not an
anonymity system, high-risk source channel, compliance product, or
production-ready financial communications system.

## [0.1.1] - 2026-08-03

This release makes the early-stage project's operating boundaries easier to
inspect and improves the path from an invited conversation to creating a new
room.

### Added

- A public [security status and limitations](https://elm.chat/security-and-limitations)
  page covering the current audit, authentication, replay, relay-metadata, and
  endpoint-copy boundaries.
- A public [independent-review request](https://github.com/shawnbure/elm-chat/issues/56)
  for protocol, browser-client, relay, and lifecycle feedback. Suspected
  vulnerabilities still belong in private GitHub security reports.
- A [press and media kit](https://elm.chat/press), public-interest and technical
  articles, practical temporary-handoff guides, and a 12-entry
  [RSS feed](https://elm.chat/feed.xml).
- Structured metadata, prerendered article pages, sitemap generation, and
  IndexNow support for the public documentation and guides.

### Changed

- The invited-participant “make your own” action now opens a new tab, preserving
  the active room instead of navigating away from the conversation.
- Contributor and self-hosting routes are easier to find from the repository
  and public documentation.

### Security status

elm.chat has not completed an independent security audit. Message
authentication and replay/duplicate protection remain unfinished. The
Cloudflare relay can observe ordinary connection metadata, and participants or
compromised devices can retain message or file copies. This release is not an
anonymity system, high-risk source channel, compliance product, or
production-ready financial communications system.

## [0.1.0] - 2026-07-28

- First tagged public release.
- Browser-side encryption for messages and files.
- Single-use and revocable invitations.
- Manual and timed room destruction.
- Account-free rooms with no server-persisted transcript.
- One Cloudflare Durable Object per live room and an AGPL-3.0 self-hosting path.

[0.1.2]: https://github.com/shawnbure/elm-chat/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/shawnbure/elm-chat/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/shawnbure/elm-chat/releases/tag/v0.1.0
