// Real local Worker/DO smoke: no room HTTP or WebSocket responses are mocked.
import assert from 'node:assert/strict';

let phase = 'configuration';
let browser;
let pageErrors = 0;

const contexts = [];
let origin;
const check = (condition) => assert.ok(condition, 'Smoke assertion failed');
async function step(name, run) {
  phase = name;
  await run();
  check(pageErrors === 0);
  console.log(`PASS ${name}`);
}

try {
  origin = new URL(process.env.TEST_ORIGIN || 'http://127.0.0.1:5210');
  check(origin.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(origin.hostname));
  check(!origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === '/');
  check(['en-US', 'es-ES'].includes(process.env.TEST_LOCALE || 'en-US'));
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  async function page() {
    const context = await browser.newContext({ locale: contexts.length === 0 ? 'en-US' : (process.env.TEST_LOCALE || 'en-US'), serviceWorkers: 'block' });
    contexts.push(context);
    await context.addInitScript(() => {
      const NativeWebSocket=window.WebSocket;
      window.WebSocket=class extends NativeWebSocket { constructor(...args) { super(...args); window.__hideSocket=this; } };
    });
    context.setDefaultTimeout(20000);
    // Abort only off-origin and unrelated public feed requests; never replace a response.
    // Feed endpoints would otherwise fetch public GitHub data from the local Worker.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin.origin || ['/api/stars', '/api/community'].includes(url.pathname)) return route.abort();
      return route.continue();
    });
    const result = await context.newPage();
    result.on('pageerror', () => { pageErrors += 1; });
    return result;
  }
  const creator = await page();
  const guest = await page();
  const ready = async p => { await p.locator('.composer textarea:not([disabled])').waitFor(); };
  let roomId;
  async function invite() {
    const responsePromise = creator.waitForResponse(r =>
      new URL(r.url()).pathname === `/api/rooms/${roomId}/invites` && r.request().method() === 'POST');
    await creator.getByRole('button',{name:/^(Invite one person|Send invite)$/}).click();
    const response = await responsePromise;
    check(response.ok());
    const record = await response.json();
    const url = new URL(creator.url());
    url.search = new URLSearchParams({ invite: record.token }).toString();
    // Only the in-memory browser handoff receives this URL; never print it.
    return url.href;
  }
  await step('create room through local Worker', async () => {
    await creator.goto(origin.href);
    await creator.getByRole('button', { name: 'Create private conversation', exact: true }).click();
    await ready(creator);
    roomId = new URL(creator.url()).pathname.split('/').pop();
    check(Boolean(roomId));
  });
  await step('admit independent guest and establish both keys', async () => {
    await guest.goto(await invite());
    for (const p of [creator, guest]) {
      await p.getByText(p === creator || process.env.TEST_LOCALE !== 'es-ES' ? '2 present' : '2 presentes', { exact: true }).waitFor();
      await ready(p);
    }
  });

  const es=process.env.TEST_LOCALE==='es-ES';
  const hide=guest.getByRole('button',{name:es?'Ocultar conversación':'Hide conversation',exact:true});
  const show=guest.getByRole('button',{name:es?'Mostrar conversación':'Show conversation',exact:true});
  const composer=guest.locator('.composer textarea');
  const find=guest.getByRole('button',{name:es?'Buscar en la conversación':'Find in conversation',exact:true});
  const search=guest.getByRole('searchbox');
  const focused=locator=>locator.evaluate(el=>el===document.activeElement);
  async function send(text) {
    await creator.locator('.composer textarea').fill(text);
    await creator.locator('.composer button[type=submit]').click();
    await guest.locator('.bubble p').filter({hasText:text}).waitFor();
  }
  async function concealed(page,locale=es) {
    await page.locator('.concealed-conversation').waitFor();
    check(await page.locator('main.room-content').getAttribute('hidden')!==null);
    check(!await page.locator('main.room-content').isVisible());
    check(await page.getByRole('heading',{name:locale?'Conversación oculta':'Conversation hidden',exact:true}).count()===1);
    check(await page.getByRole('textbox').count()===0);
    check(await page.getByRole('searchbox').count()===0);
    const client=await page.context().newCDPSession(page);
    try {
      const {nodes}=await client.send('Accessibility.getFullAXTree');
      const names=nodes.filter(node=>!node.ignored).map(node=>node.name?.value||'').join('\n');
      for(const marker of ['Hidden synthetic message','conceal-file.txt','Hidden synthetic draft','needle-private']) check(!names.includes(marker));
      check(!names.includes('Invite one person')&&!names.includes('Copy invite link'));
    } finally {await client.detach();}
    const visible=await page.locator('body').innerText();
    for(const marker of ['Hidden synthetic message','conceal-file.txt','Hidden synthetic draft','needle-private']) check(!visible.includes(marker));
  }
  await send('Hidden synthetic message');
  await creator.locator('input[type=file]').setInputFiles({name:'conceal-file.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic')});
  await guest.locator('.file-card').waitFor();
  await composer.fill('Hidden synthetic draft');
  await find.click();await search.fill('needle-private');
  for(const action of ['Enter','Space','pointer']) await step(`Hide/Show ${action} visual, AX and focus`,async()=>{
    await hide.focus(); if(action==='pointer')await hide.click();else await hide.press(action);
    await concealed(guest);check(await focused(show));
    await guest.keyboard.press('Tab');check(!await guest.evaluate(()=>document.querySelector('main.room-content').contains(document.activeElement)));
    await show.focus();await show.press('Escape');check(await show.isVisible());
    if(action==='pointer')await show.click();else await show.press(action);
    await composer.waitFor();check(await focused(hide));
    check(await composer.inputValue()==='Hidden synthetic draft');
    check(await search.count()===0);
    await find.click();check(await search.inputValue()==='');
    await search.press('Escape');
  });
  await step('creator invite controls concealed from visual and accessibility trees',async()=>{
    await creator.getByRole('button',{name:'Hide conversation',exact:true}).click();
    await concealed(creator,false);
    await creator.getByRole('button',{name:'Show conversation',exact:true}).click();
  });
  await step('incoming message does not reveal hidden view',async()=>{
    await hide.click();await concealed(guest);
    await creator.locator('.composer textarea').fill('Incoming while concealed');await creator.locator('.composer button[type=submit]').click();
    await guest.locator('.bubble p').filter({hasText:'Incoming while concealed'}).waitFor({state:'attached'});
    await concealed(guest);check(await focused(show));
    await show.click();await guest.locator('.bubble p').filter({hasText:'Incoming while concealed'}).waitFor();
  });
  await step('connection interruption preserves concealment and focus through rejoin',async()=>{
    await hide.click();await concealed(guest);
    await guest.evaluate(()=>{window.__oldHideSocket=window.__hideSocket;window.__hideSocket.close(1000,'Synthetic local interruption');});
    await guest.waitForFunction(()=>window.__hideSocket!==window.__oldHideSocket&&window.__hideSocket.readyState===WebSocket.OPEN&&Boolean(document.querySelector('.composer textarea:not([disabled])')),{},{timeout:20000});
    await concealed(guest);check(await focused(show));
    await show.click();check(await composer.inputValue()==='Hidden synthetic draft');
  });
  await step('pending send preserves newer hidden draft without reveal',async()=>{
    await guest.evaluate(()=>{
      const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);let armed=true;
      crypto.subtle.encrypt=async(...args)=>{const result=await encrypt(...args);if(armed){armed=false;await new Promise(resolve=>window.__releaseHideSend=resolve);}return result;};
    });
    await composer.fill('Pending conceal send');await guest.locator('.composer button[type=submit]').click();
    await guest.waitForFunction(()=>typeof window.__releaseHideSend==='function');
    await composer.fill('Hidden synthetic draft newer');await hide.click();await concealed(guest);
    await guest.evaluate(()=>window.__releaseHideSend());
    await creator.locator('.bubble p').filter({hasText:'Pending conceal send'}).waitFor();
    await concealed(guest);check(await focused(show));await show.click();
    check(await composer.inputValue()==='Hidden synthetic draft newer');
  });
  await step('terminal room takes precedence over hidden view',async()=>{
    await hide.click();await creator.getByRole('button',{name:'Destroy',exact:true}).click();
    await guest.locator('.composer').waitFor({state:'detached'});
    check(await guest.locator('.concealed-conversation').count()===0);check(await show.count()===0);
  });
  await step('real message and file expiry continue while hidden',async()=>{
    await creator.goto(origin.href);await creator.getByRole('spinbutton',{name:'Message vanish duration',exact:true}).fill('0.1');
    await creator.getByRole('button',{name:'Create private conversation',exact:true}).click();await ready(creator);
    roomId=new URL(creator.url()).pathname.split('/').pop();await guest.goto(await invite());await ready(guest);
    await send('Hidden synthetic message expiring');
    await creator.locator('input[type=file]').setInputFiles({name:'conceal-file.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic')});
    await guest.locator('.file-card').waitFor();await hide.click();
    await guest.waitForFunction(()=>document.querySelectorAll('.bubble').length===0,{},{timeout:12000});
    await concealed(guest);await show.click();check(await guest.locator('.bubble').count()===0);
    await creator.getByRole('button',{name:'Destroy',exact:true}).click();
  });
  await step('guest removal overrides concealment without restoring old content',async()=>{
    await creator.goto(origin.href);
    await creator.getByRole('button',{name:'Create private conversation',exact:true}).click();await ready(creator);
    roomId=new URL(creator.url()).pathname.split('/').pop();await guest.goto(await invite());await ready(guest);
    await send('Hidden synthetic message before removal');await hide.click();await concealed(guest);
    await creator.locator('.participant-kick').click();
    await guest.locator('.composer').waitFor({state:'detached'});
    check(await guest.locator('.concealed-conversation').count()===0);check(await show.count()===0);
    check(!(await guest.locator('body').innerText()).includes('Hidden synthetic message before removal'));
    await creator.getByRole('button',{name:'Destroy',exact:true}).click();
  });
  console.log('PASS Hide conversation; real local transport, injected encryption hold and client socket interruption, AX structure only; no screen-reader speech claim');
} catch(error) {
  console.error(`FAIL ${phase} (${error?.name||'Error'}); raw diagnostics suppressed`);process.exitCode=1;
} finally {
  for(const context of contexts)try{await context.close();}catch{console.error('FAIL context cleanup');process.exitCode=1;}
  try{await browser?.close();}catch{console.error('FAIL browser cleanup');process.exitCode=1;}
}
