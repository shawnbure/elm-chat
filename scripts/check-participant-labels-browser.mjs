// Real local relay acceptance. Numbered labels are compared within each tab only.
import assert from 'node:assert/strict';
import net from 'node:net';
let browser;
let proxy;
let forwarding = true;
const pipes = new Set();
const contexts = [];
const rooms = [];
let phase = 'configuration';
let pageErrors = 0;
const check = value => assert.ok(value, 'Acceptance assertion failed');
async function step(name, run) {
  phase = name;
  await run(); check(pageErrors === 0); console.log(`PASS ${name}`);
}
try {
  const origin = new URL(process.env.TEST_ORIGIN || 'http://127.0.0.1:5210');
  check(origin.protocol === 'http:' && origin.hostname === '127.0.0.1');
  check(!origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === '/');
  const selectedLocale = process.env.TEST_LOCALE;
  check(selectedLocale === undefined || ['en', 'es'].includes(selectedLocale));
  proxy = net.createServer(client => {
    if (!forwarding) return client.destroy();
    const upstream = net.connect({ host: '127.0.0.1', port: Number(origin.port || 80) });
    const pair = { client, upstream };
    pipes.add(pair);
    const dispose = () => { client.destroy(); upstream.destroy(); pipes.delete(pair); };
    client.on('error', dispose); upstream.on('error', dispose);
    client.on('close', dispose); upstream.on('close', dispose);
    client.pipe(upstream); upstream.pipe(client);
  });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
  const guestOrigin = new URL(`http://127.0.0.1:${proxy.address().port}`);
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ready = page => page.locator('.composer textarea:not([disabled])').waitFor();
  async function newPage(locale, allowedOrigin = origin) {
    const context = await browser.newContext({ locale: locale === 'es' ? 'es-ES' : 'en-US', serviceWorkers: 'block' });
    contexts.push(context); context.setDefaultTimeout(20000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== allowedOrigin.origin || ['/api/stars', '/api/community'].includes(url.pathname)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', () => { pageErrors++; });
    return page;
  }
  async function chips(page) {
    return page.locator('.participant-chip:not(.participant-chip-self)').evaluateAll(nodes => nodes.map(node => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('button').forEach(button => button.remove());
      return clone.textContent.trim();
    }));
  }
  const bubble = (page, text) => page.locator('.bubble').filter({ has: page.locator('p', { hasText: text }) });
  async function message(from, to, text) {
    await ready(from); await from.locator('.composer textarea').fill(text);
    await from.locator('.composer button[type=submit]').click();
    await bubble(to, text).waitFor(); check(await bubble(to, text).count() === 1);
    return (await bubble(to, text).locator('.bubble-author').textContent()).trim();
  }
  for (const locale of selectedLocale ? [selectedLocale] : ['en', 'es']) {
    const words = locale === 'en' ? {
      create: 'Create private conversation', destroy: 'Destroy', gone: 'Room gone', removed: 'You were removed from this room',
      present: count => `${count} present`, remove: label => `Remove ${label}`, label: /^Guest [1-9]\d*$/,
      note: 'Labels are temporary and local to this tab.', download: name => `Download ${name}`, save: name => `Save file ${name}`
    } : {
      create: 'Crear conversación privada', destroy: 'Destruir', gone: 'Sala desaparecida', removed: 'Se te ha retirado de esta sala',
      present: count => `${count} presentes`, remove: label => `Eliminar a ${label}`, label: /^Invitado [1-9]\d*$/,
      note: 'Las etiquetas son temporales y locales a esta pestaña.', download: name => `Descargar ${name}`, save: name => `Guardar archivo ${name}`
    };
    const creator = await newPage(locale);
    const guestA = await newPage(locale, guestOrigin);
    const guestB = await newPage(locale);
    const room = { creator, destroy: words.destroy, destroyed: false };
    rooms.push(room);
    let roomId, labelA, labelB;
    let sockets = 0, closes = 0;
    guestA.on('websocket', socket => { sockets++; socket.on('close', () => { closes++; }); });
    async function present(pages, count) {
      for (const page of pages) { await page.getByText(words.present(count), { exact: true }).waitFor(); await ready(page); }
    }
    async function invite(page, throughProxy = false) {
      const responsePromise = creator.waitForResponse(response => new URL(response.url()).pathname === `/api/rooms/${roomId}/invites` && response.request().method() === 'POST');
      await creator.locator('.room-actions button').first().click();
      const response = await responsePromise; check(response.ok());
      const record = await response.json();
      const url = new URL(creator.url());
      url.search = new URLSearchParams({ invite: record.token }).toString();
      if (throughProxy) url.host = guestOrigin.host;
      await page.goto(url.href);
    }
    const textA = 'Synthetic label guest alpha';
    const textB = 'Synthetic label guest beta';
    await step(`${locale} three independent participants and distinct author labels`, async () => {
      await creator.goto(origin.href);
      await creator.getByRole('button', { name: words.create, exact: true }).click(); await ready(creator);
      roomId = new URL(creator.url()).pathname.split('/').pop(); check(Boolean(roomId));
      await invite(guestA, true); await present([creator, guestA], 2);
      labelA = await message(guestA, creator, textA);
      await invite(guestB); await present([creator, guestA, guestB], 3);
      labelB = await message(guestB, creator, textB);
      check(words.label.test(labelA) && words.label.test(labelB) && labelA !== labelB);
      const labels = await chips(creator); check(labels.length === 2 && labels.includes(labelA) && labels.includes(labelB));
      for (const label of [labelA, labelB]) check(await creator.getByRole('button', { name: words.remove(label), exact: true }).count() === 1);
      for (const page of [creator, guestA, guestB]) {
        await page.getByText(words.note, { exact: true }).waitFor();
        const localLabels = await chips(page);
        check(localLabels.length === 2 && new Set(localLabels).size === 2 && localLabels.every(label => words.label.test(label)));
      }
      await creator.setViewportSize({ width: 390, height: 844 });
      const fitsViewport = element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth;
      };
      check(await creator.locator('.participant-label-note').evaluate(fitsViewport));
      check(await creator.locator('.participant-strip').evaluate(fitsViewport));
      // Narrow layouts intentionally scroll the strip horizontally. Focusing
      // each removal control must bring it into the visible viewport.
      for (const label of [labelA, labelB]) {
        const control = creator.getByRole('button', { name: words.remove(label), exact: true });
        await control.focus();
        check(await control.evaluate(fitsViewport));
        check(await control.evaluate(element => {
          const button = element.getBoundingClientRect();
          const strip = element.closest('.participant-strip').getBoundingClientRect();
          return button.left >= strip.left && button.right <= strip.right;
        }));
      }
      await creator.setViewportSize({ width: 1280, height: 720 });
      // The creator may have a different ordinal in each guest's tab.
      const creatorText = 'Synthetic label creator';
      const creatorLabelA = await message(creator, guestA, creatorText);
      await bubble(guestB, creatorText).waitFor();
      const creatorLabelB = (await bubble(guestB, creatorText).locator('.bubble-author').textContent()).trim();
      check((await chips(guestA)).includes(creatorLabelA) && (await chips(guestB)).includes(creatorLabelB));
    });
    await step(`${locale} file author matches participant and downloaded bytes`, async () => {
      const filename = 'participant-label-smoke.txt';
      const content = 'Synthetic participant label file\n';
      await guestA.locator('input[type=file]').setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(content) });
      const fileBubble = creator.locator('.bubble-theirs').filter({ hasText: filename });
      await fileBubble.waitFor(); check(await fileBubble.count() === 1);
      check((await fileBubble.locator('.bubble-author').textContent()).trim() === labelA);
      await creator.getByRole('button', { name: words.download(filename), exact: true }).click();
      const save = creator.getByRole('link', { name: words.save(filename), exact: true }); await save.waitFor();
      const downloading = creator.waitForEvent('download'); await save.click();
      const download = await downloading; const stream = await download.createReadStream(); check(Boolean(stream));
      const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      check(Buffer.concat(chunks).toString('utf8') === content); await download.delete();
    });
    await step(`${locale} same-session reconnect preserves tab-local labels`, async () => {
      const guestLabels = (await chips(guestA)).slice().sort();
      const beforeSockets = sockets, beforeCloses = closes;
      await guestA.evaluate(id => {
        window.__labelsDocument = crypto.randomUUID();
        window.__labelsSession = sessionStorage.getItem(`elm-chat:session:${id}`);
      }, roomId);
      const sentinel = await guestA.evaluate(() => window.__labelsDocument);
      check(await guestA.evaluate(() => Boolean(window.__labelsSession)));
      forwarding = false;
      for (const { client, upstream } of pipes) { client.destroy(); upstream.destroy(); }
      const deadline = Date.now() + 10000;
      while (closes === beforeCloses && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      check(closes > beforeCloses);
      await creator.getByText(words.present(2), { exact: true }).waitFor();
      await guestA.locator('.composer textarea:disabled').waitFor();
      check((await bubble(creator, textA).locator('.bubble-author').textContent()).trim() === labelA);
      check(!(await chips(creator)).includes(labelA));
      forwarding = true;
      await present([creator, guestA, guestB], 3); check(sockets > beforeSockets);
      check(await guestA.evaluate(() => window.__labelsDocument) === sentinel);
      check(await guestA.evaluate(id => sessionStorage.getItem(`elm-chat:session:${id}`) === window.__labelsSession, roomId));
      check(JSON.stringify((await chips(guestA)).slice().sort()) === JSON.stringify(guestLabels));
      check((await chips(creator)).includes(labelA));
      check(await message(guestA, creator, 'Synthetic label after reconnect') === labelA);
    });
    await step(`${locale} keyboard removal targets labeled guest and retains old authors`, async () => {
      const remove = creator.getByRole('button', { name: words.remove(labelB), exact: true });
      await remove.focus(); check(await remove.evaluate(element => document.activeElement === element));
      await remove.press('Enter');
      await guestB.getByRole('heading', { name: words.removed, exact: true }).waitFor();
      check(await guestB.locator('.composer').count() === 0);
      await present([creator, guestA], 2);
      const labels = await chips(creator); check(labels.length === 1 && labels[0] === labelA);
      check((await bubble(creator, textB).locator('.bubble-author').textContent()).trim() === labelB);
      check(await message(guestA, creator, 'Synthetic remaining guest') === labelA);
    });
    await step(`${locale} new session does not reuse departed label`, async () => {
      const guestC = await newPage(locale);
      await invite(guestC); await present([creator, guestA, guestC], 3);
      const labelC = await message(guestC, creator, 'Synthetic replacement guest');
      check(words.label.test(labelC) && labelC !== labelA && labelC !== labelB);
      check((await chips(creator)).includes(labelC));
      check((await bubble(creator, textB).locator('.bubble-author').textContent()).trim() === labelB);
      for (const page of [creator, guestA, guestC]) check(await page.locator('.room-error').count() === 0);
      await creator.getByRole('button', { name: words.destroy, exact: true }).click();
      for (const page of [creator, guestA, guestC]) {
        await page.getByRole('heading', { name: words.gone, exact: true }).waitFor();
        check(await page.locator('.participant-chip').count() === 0 && await page.locator('.composer').count() === 0);
      }
      room.destroyed = true;
    });
  }
  console.log('PASS real local participant labels; no capability artifacts saved');
} catch {
  console.error(`FAIL ${phase}; raw diagnostics suppressed`); process.exitCode = 1;
} finally {
  forwarding = true;
  for (const room of rooms) {
    if (!room.destroyed) {
      try { await room.creator.getByRole('button', { name: room.destroy, exact: true }).click({ timeout: 2000 }); } catch { /* Own local state may be removed after stopping the server. */ }
    }
  }
  let cleanupFailed = false;
  for (const context of contexts) { try { await context.close(); } catch { cleanupFailed = true; } }
  try { await browser?.close(); } catch { cleanupFailed = true; } finally {
    for (const { client, upstream } of pipes) { client.destroy(); upstream.destroy(); }
    if (proxy?.listening) {
      try { await new Promise((resolve, reject) => proxy.close(error => error ? reject(error) : resolve())); } catch { cleanupFailed = true; }
    }
  }
  if (cleanupFailed) { console.error('FAIL cleanup; raw diagnostics suppressed'); process.exitCode = 1; }
}
