# Hide conversation on this screen

**Hide conversation** replaces the room interface with a neutral panel and **Show conversation**. It conceals message text, filenames and file actions, the composer and its draft, Find, participants, room code, invite links, and room actions. Hiding also closes Find and clears its query/selection.

This is a local display choice, not a lock or authentication. Anyone using the browser can reveal it, and it does not prevent screenshots, endpoint copies, or inspection. There is no new storage, protocol event, analytics event, clipboard erasure, or transcript snapshot. The existing draft and message state remain in memory under existing policies.

Keyboard/pointer activation transfers focus from Hide to Show and back to Hide. Escape does not reveal the room. The concealed subtree uses `hidden` and `display: none`, so it is unavailable visually, in sequential keyboard navigation, and in the accessibility tree. The display change does not unmount the room state or transport hooks. Incoming messages do not reveal it. A visibility action can hand off focus once; later message/connection updates do not do so.

Messages and files continue to expire while hidden, including object URL cleanup. Reveal shows only surviving content. Connection interruption leaves concealment active. Terminal or revoked-room screens take precedence and cannot reveal previous content. Pending sends follow the existing submission/draft safeguards; hiding neither sends nor cancels a draft, and completion must preserve text edited during the pending operation.

English/Spanish labels follow the existing locale. Automated visual/role/focus checks are not proof of actual screen-reader speech; mobile and spoken screen-reader behavior require separate verification.

To verify locally, build and start a Worker on free ports with isolated state:

```sh
npm ci
npm run build
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID WRANGLER_SEND_METRICS=false \
  npx wrangler dev --config wrangler.jsonc --local --ip 127.0.0.1 \
  --port 54561 --inspector-port 54562 --persist-to /tmp/elm-hide-test --log-level none
```

The opt-in browser fixture requires separately installed Playwright and Chrome (omit path overrides to use normal Playwright resolution and its installed browser). Run both `TEST_LOCALE=en-US` and `TEST_LOCALE=es-ES`:

```sh
TEST_ORIGIN=http://127.0.0.1:54561 TEST_LOCALE=en-US \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_PATH=/absolute/path/to/Chrome \
node scripts/check-hide-conversation-browser.mjs
```

The Hide fixture uses real local Worker/Durable Object HTTP/WebSocket traffic and native crypto. Its pending-send case deliberately holds one completed encryption result to check the newer draft while concealed; that timing is injected. It checks English/Spanish keyboard/pointer actions, visible text and Chrome accessibility-tree structure, focus, cleared Find, incoming messages, pending send, actual reconnect after a deliberate client socket close, guest removal, room destruction, and message/offered-file expiry. The expiry case does not download a Blob and does not independently prove object URL cleanup. Agent3 contributed this fixture; final independent nonauthor review is recorded separately.

The existing `check-conversation-find-browser.mjs` runs both languages against the same build for compatibility. `check-composer-send-races.mjs` provides ten deterministic send cases with synthetic room transport/native crypto; it is separate from actual local transport evidence. Stop the Worker and remove its isolated state after tests.
