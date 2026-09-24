# Contributor Starting Points

The earlier starter list is largely complete: elm.chat now has the invite-recipient
“make your own room” path, robots and social metadata, Spanish room-shell
localization, a self-host smoke report, and message protocol v3.

Current public help-wanted work:

- [Independent security review wanted: protocol, browser client, and room lifecycle](https://github.com/shawnbure/elm-chat/issues/56)
- Review the completed [signed-event, replay, key-rotation, transfer, and recovery roadmap](../README.md#security-work-that-still-matters) from issues #106–#110 and report a narrowly reproduced defect.

The independent review can be taken in one bounded slice:

1. **Text protocol:** review associated-data fields, ordering, duplicate handling,
   reconnect behavior, and downgrade assumptions in
   [`message-protocol-v2.md`](message-protocol-v2.md).
2. **File protocol:** review request authorization, chunk encryption, metadata
   exposure, size limits, interruption behavior, and recipient-side assembly.
3. **Room lifecycle:** test invitation admission, participant removal, idle and
   maximum deadlines, manual destruction, and stale-client behavior.
4. **Browser boundary:** document where secrets and plaintext can remain after
   refresh, tab close, download, clipboard use, or browser recovery.

Please comment on the issue with the slice you plan to review before starting,
so work is not duplicated. Use [private vulnerability reporting](../SECURITY.md)
for exploitable or sensitive findings.

## Proposing a smaller first contribution

If the review request is too broad, open an issue before writing code and define:

- the exact behavior or failure case;
- the files and protocol boundary involved;
- how the change will be tested;
- which privacy or security claim it affects; and
- what remains explicitly out of scope.

Small documentation, regression-test, accessibility, and localization fixes are
welcome when they preserve the published security limits. See
[`CONTRIBUTING.md`](../CONTRIBUTING.md) for the development and review workflow.
