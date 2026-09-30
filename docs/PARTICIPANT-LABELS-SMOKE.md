# Real local participant label acceptance

This opt-in browser test uses the built application served by a local Worker and Durable Object, with three independent participant contexts. It runs one room in English and another in Spanish. Room HTTP responses, WebSocket frames, admission, crypto, and participant removal are real. A byte-transparent loopback TCP proxy lets the test disconnect and reconnect one guest without reloading that page.

From the repository root, install dependencies, build, and start your own isolated local server:

```sh
npm ci
npm run build --workspace @elm-chat/web
WRANGLER_SEND_METRICS=false npx wrangler dev --config wrangler.jsonc --local \
  --ip 127.0.0.1 --port 5210 --inspector-port 9310 \
  --persist-to .wrangler/participant-label-smoke --log-level none
```

In another terminal, run using your external Playwright and Chrome installations, or omit the overrides for Playwright's normal module/browser resolution:

```sh
TEST_ORIGIN=http://127.0.0.1:5210 \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_PATH='/absolute/path/to/Chrome' \
node scripts/check-participant-labels-browser.mjs
```

Use `TEST_LOCALE=en` or `TEST_LOCALE=es` for one locale; the default runs both. Invalid locales or origins fail before browser/proxy work. The server must be a bare HTTP `127.0.0.1` origin with no credentials, path, query, or fragment. The script blocks external traffic and unrelated public feed requests, but never substitutes room API or WebSocket responses. It allocates an additional ephemeral loopback proxy port automatically.

Each locale verifies:

1. Creator plus two independent guests have distinct numbered remote labels. Guest messages decrypted at the creator use the matching participant labels. Creator messages use the corresponding local label in each guest's tab. The explanatory tab-local note and distinct localized removal accessible names are present. In a 390-pixel desktop viewport, the note and scrolling participant strip fit horizontally, and focusing either removal control brings it into view.
2. A guest file's author matches that guest's participant label. Its actual downloaded bytes match the tiny synthetic source file.
3. Cutting the first guest's TCP pipes causes an observed WebSocket close, creator presence loss, chip removal, and a disabled guest composer. The old message author label remains. Reconnection uses a new socket in the same document/session, preserves labels in both viewing tabs, and permits a newly decrypted message with the same author label.
4. Focusing the creator's removal control and pressing Enter removes the second guest's actual browser context. The first guest remains connected and can send. The removed guest's old message keeps its original author label.
5. A newly admitted third guest gets a label different from both earlier guests in the creator's tab. Existing departed-author messages retain their label.
6. Destroying the room removes the participant UI and composer in the remaining contexts.

The last two checks are reported together as one phase, so the script emits five phase passes per locale, ten by default. Labels are compared within a viewing tab: it intentionally does not assume the same ordinal identifies the same session in other tabs. Contexts identify the expected removal target; label equality across clients is not used as an identity proof.

The script stores no capability artifacts, screenshots, room URLs, keys, IDs, or message logs. It prints fixed phase names, suppresses raw failure details, destroys created rooms where possible, and closes contexts, browser, sockets, and proxy listener even after failures. A temporary download is read and deleted. Stop the separately started server and remove only its dedicated local state directory when finished.

This is desktop browser acceptance, not a screen-reader speech test, mobile test, identity verification, or privacy/security audit. Keyboard activation is tested after programmatic focus; exhaustive Tab order and post-removal focus recovery are not asserted. Expiry, transcript-only sender discovery, reload label resets, locale switching within one mounted tab, and absence of new persistence are covered by separate source/unit review where applicable. This test checks the destroyed UI, not internal registry erasure directly.
