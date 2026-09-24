# Recovery and Accessibility Test Matrix

Use two ordinary browser profiles and synthetic, low-risk content. Record the
browser, operating system, date, and result. A visible message is evidence of
local display only; it is not proof that another participant received it.

## Automated gates

| Area | Expected result | Gate |
| --- | --- | --- |
| Reconnect backoff | Attempts wait 0.5, 1, 2, 4, and 8 seconds, then stop | `tests/recovery-state.test.ts` |
| Replay after refresh | A verified event ID remains rejected after the guard is reconstructed | `tests/recovery-state.test.ts` and `npm run check:message-protocol` |
| Corrupt or blocked storage | The tab keeps in-memory protection and does not crash | `tests/recovery-state.test.ts` |
| Sender and room binding | Changed sender, room, target, payload, or signature fails verification | `npm run check:message-protocol` |
| Membership rotation | Pairwise-wrapped epoch secrets decrypt only with the intended peer context | `npm run check:message-protocol` |
| Relay admission | Unjoined sockets, duplicate identities, and unsigned events are rejected | `tests/room-security.test.ts` |

## Manual mobile and network matrix

| Scenario | Steps | Pass condition |
| --- | --- | --- |
| Background and foreground | Join on mobile, background for 30 seconds, return | Status announces reconnect if needed; sending stays disabled until the current room key is ready |
| Offline and online | Disable networking, attempt a send, restore networking | No false delivery claim; bounded reconnect begins; a later send works after `Connected` returns |
| Wi-Fi to cellular | Change networks during an open room | At most one active session remains; membership changes rotate the room key; status settles at `Connected` |
| Repeated flaps | Toggle offline/online six times | Backoff remains bounded; UI does not claim delivery for unsent content; no reconnect storm continues after the fifth failed attempt |
| Expiry while reconnecting | Disconnect until the room idle or maximum deadline passes, then reconnect | Closed-room screen is shown and replay, identity, and key state for the ended room is cleared |
| Invite lifecycle | Exercise unused, claimed in another tab, consumed, expired, and revoked links | Each state is distinct; a consumed or revoked invite cannot admit a new session |
| Text interruption | Disconnect immediately before and after Send | Locally shown content says delivery is pending or failed unless a signed event was placed on the open socket |
| File interruption | Interrupt offer, request, middle chunk, and completion | Receiver times out or shows failure; incomplete bytes never become a download; retry requires a new request or re-share |
| Participant removal | Remove one participant while messages and a file are active | Removed client is closed; remaining clients disable sending until a fresh epoch key arrives; removed client cannot authenticate new-epoch content |

## Accessibility matrix

| Check | Pass condition |
| --- | --- |
| Keyboard only | Create, invite, write, attach, download, remove, and destroy actions are reachable in a logical order with visible focus |
| Screen reader | Connection changes use a polite live region; errors use `role="alert"`; the conversation uses `role="log"` and announces additions |
| Focus after terminal state | The replacement room-gone, invalid-invite, or removed screen exposes its heading and primary next action without hidden controls remaining active |
| Reduced motion | With `prefers-reduced-motion: reduce`, no essential state depends on animation and scrolling remains usable |
| Zoom and reflow | At 200% zoom and a 320 CSS pixel viewport, controls do not overlap and message/file actions remain reachable |
| Color and text | Connected, failed, expired, and removed states retain text labels and do not rely on color alone |

## Release record

Do not mark this matrix complete from automated checks alone. Add a dated row to
the release or pull request notes for each manually tested browser and device.
Any failed row should link to a GitHub issue with reproduction steps.
