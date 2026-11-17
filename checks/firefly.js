const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; let pass = 0, fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
  const ev = (f, a) => p.evaluate(f, a), w = (ms = 300) => p.waitForTimeout(ms), panel = () => p.$eval('#ff-panel', (e) => e.innerText);
  await p.goto(URL); await w(1600);
  ok('one bug, visible, not open', await p.locator('#ff-bug').count() === 1 && await p.isVisible('#ff-bug') && !(await p.isVisible('#ff-panel')));
  ok('no welcome under automation', await p.locator('#ff-welcome').count() === 0);
  await p.click('#ff-bug'); await w(450);
  ok('click opens the panel', await p.isVisible('#ff-panel'));
  ok('panel: needs you, next step, ask', /NEEDS YOU/i.test(await panel()) && /NEXT STEP/i.test(await panel()) && await p.locator('#ff-q').count() === 1, (await panel()).replace(/\n+/g, ' | ').slice(0, 200));
  await p.screenshot({ path: 'r1-panel.png' });
  await p.keyboard.press('Escape'); await w();
  ok('Esc closes', !(await p.isVisible('#ff-panel')));
  await p.click('#ff-bug'); await w(450); await p.mouse.click(300, 500); await w();
  ok('a click outside closes', !(await p.isVisible('#ff-panel')));
  // Ask
  await ev(() => ffAsk('How do I sell a building from the lot?')); await w();
  ok('how do I… answers in the panel, no tour starts', /Start a sale, then Browse my lot/.test(await panel()) && await ev(() => !FF.tour) && await p.locator('#ff-panel button:has-text("Take a tour")').count() === 1);
  await ev(() => ffAsk('how far is delivery free')); await w();
  ok('a policy question answers from the knowledge base', /50 miles/.test(await panel()) && await p.locator('#ff-panel button:has-text("Read the article")').count() === 1);
  await ev(() => ffAsk('what else can Firefly do')); await w();
  ok('catalog opens, lists tours', /Getting started/.test(await panel()) && (await p.$$eval('.ff-tours > div', (e) => e.length)) === 9, String(await p.$$eval('.ff-tours > div', (e) => e.length)));
  await p.screenshot({ path: 'r2-catalog.png' });
  await ev(() => ffAsk('open payments')); await w();
  ok('“open payments” offers to take me there', /Take me there/.test(await panel()));
  await ev(() => ffAsk('zzz qqq blorp')); await w();
  ok('no answer: says so and offers to flag it', /don’t know that yet/.test(await panel()));
  // tours, each driven like a person
  const run = async (id, shot) => {
    await ev((id) => ffTourStart(id), id); await w(500);
    const steps = await ev((id) => ffTour(id).steps.length, id); let seenTargets = 0;
    for (let i = 0; i < steps; i++) {
      await w(1100);
      const st = await ev(() => { const t = ffTour(FF.tour); if (!t) return null; const s = t.steps[FF.step], el = ffEl(s.sel); return { i: FF.step, has: !!el, until: !!s.until, hands: s.hands, ring: document.getElementById('ff-ring')?.style.display !== 'none', title: s.title }; });
      if (!st) break;
      if (st.has && st.ring) seenTargets++;
      if (shot && st.i === shot[0]) await p.screenshot({ path: shot[1] });
      if (st.until) { await ev(() => { const s = ffTour(FF.tour).steps[FF.step]; ffEl(s.sel).click(); }); await w(700); }
      else await p.click('#ff-card .ff-go');
    }
    await w(400);
    const done = await ev((id) => !FF.tour && FF.done[id] === true, id);
    ok(`tour ${id}: ${steps} steps, every target found, finishes`, done && seenTargets === steps, `${seenTargets}/${steps}`);
    await ev(() => ffClose());
  };
  await run('welcome');
  await run('sales-lot', [0, 'r3-tour-step.png']);
  ok('the tour did not start a sale', await ev(() => S.page) === 'unit');
  await run('sales-configure'); await run('sales-order'); await run('office-approve', [4, 'r4-tour-office.png']);
  ok('the tour did not approve the order', await ev(() => ofStage(ofSale(OF.id))) === 'review');
  await run('office-prices'); await run('logi-load'); await run('prod-board'); await run('qc-inspect');
  await ev(() => { go('home'); ffOpen(); FF.view = 'catalog'; ffDraw(); }); await w();
  ok('getting started shows 9 of 9', /9 of 9/.test(await panel()));
  await p.screenshot({ path: 'r5-all-done.png' });
  // walk me through → starts; stop
  await ev(() => ffAsk('walk me through approving an order')); await w(500);
  ok('“walk me through” starts the tour', await ev(() => FF.tour) === 'office-approve' && await p.isVisible('#ff-card'));
  await p.keyboard.press('Escape'); await w();
  ok('Esc stops a tour', await ev(() => !FF.tour) && await p.locator('#ff-ring').count() === 0);
  // access: a salesperson sees only sales tours; denial
  await ev(() => { adView('u6'); go('home'); ffAsk('what can firefly do'); }); await w();
  const names = await p.$$eval('.ff-tours b', (e) => e.map((x) => x.textContent));
  ok('a lot manager’s catalog leaves out tours they cannot run', names.length < 9 && !names.some((n) => /approve|production board|Plant QC/i.test(n)), names.join(' / '));
  await ev(() => ffAsk('walk me through approving an order')); await w();
  ok('asking for a tour they cannot run gets a plain no', /cannot open Office/.test(await panel()) && await ev(() => !FF.tour));
  ok('impersonation cue in the panel', /Viewing as Sam Lee/.test(await panel()) && await p.locator('.ff-tabs button:has-text("Assistant")').count() === 0);
  await ev(() => { adView('u5'); go('home'); }); await w();
  ok('hidden for someone locked out', !(await p.isVisible('#ff-bug')));
  await ev(() => { adView('u1'); go('home'); }); await w();
  // intents
  ok('critical when an order is on hold', await ev(() => { const s = S.sales.find(deskSale); const was = s.status; s.status = 'Correction requested'; render(); const i = document.getElementById('ff-root').dataset.intent; s.status = was; render(); return i; }) === 'critical');
  ok('focus (calm) in the configurator', await ev(() => { begin(); return document.getElementById('ff-root').dataset.intent; }) === 'focus');
  await ev(() => go('home'));
  // settings: assist off hides Ask; dock in bell; off checkbox
  await ev(() => { ffOpen(); ffView('settings'); }); await w();
  await p.screenshot({ path: 'r6-settings.png' });
  await p.click('.ff-seg button:has-text("Off")'); await ev(() => ffView('main')); await w();
  ok('assist Off hides Ask, keeps the handle', await p.locator('#ff-q').count() === 0 && await p.isVisible('#ff-bug'));
  ok('assist Off refuses voice', await ev(() => ffTalk()) === false);
  await ev(() => { ffSet('assist', 'standard'); ffSet('home', 'bell'); ffClose(); }); await w();
  ok('docked: bug hidden, bell glows', !(await p.isVisible('#ff-bug')) && await p.$eval('#ta-bell', (e) => e.classList.contains('ff-bell')));
  await p.click('#ta-bell'); await w(450);
  ok('the bell opens the same panel', await p.isVisible('#ff-panel') && await p.locator('.modal').count() === 0);
  await p.screenshot({ path: 'r7-bell.png' });
  await ev(() => { ffSet('home', 'float'); ffClose(); }); await w();
  await p.click('#ta-bell'); await w();
  ok('floating: the bell is plain notifications, with the switch', await p.locator('.modal').count() === 1 && await p.locator('#ff-on-bell').count() === 1);
  await p.uncheck('#ff-on-bell'); await w();
  ok('the checkbox turns Firefly off everywhere', !(await p.isVisible('#ff-bug')) && await ev(() => FF.on) === false);
  await ev(() => { closeModal(); go('office'); }); await w();
  ok('still off on another side', !(await p.isVisible('#ff-bug')));
  await p.reload(); await w(1600);
  ok('off is remembered after a reload', await ev(() => FF.on) === false && !(await p.isVisible('#ff-bug')));
  await p.click('#ta-bell'); await w(); await p.check('#ff-on-bell'); await w();
  ok('and it comes back from the bell', await p.isVisible('#ff-bug'));
  await ev(() => closeModal());
  // personal assistant
  await ev(() => { ffOpen(); ffView('pa'); ffAssist('note call the Florence lot about the 12x24'); }); await w();
  ok('assistant asks before acting', await p.locator('#ff-panel button:has-text("Yes, do it")').count() === 1 && await ev(() => FF.notes.length) === 0);
  await p.click('#ff-panel button:has-text("Yes, do it")'); await w();
  ok('after a yes the note is kept', await ev(() => FF.notes[0]) === 'call the Florence lot about the 12x24');
  await p.screenshot({ path: 'r8-assistant.png' });
  // welcome + show me around
  await ev(() => { ffClose(); go('home'); ffWelcome(true); }); await w(500);
  ok('welcome card', await p.isVisible('#ff-welcome') && /I’m Firefly/.test(await p.$eval('#ff-welcome', (e) => e.innerText)));
  await p.screenshot({ path: 'r9-welcome.png' });
  await p.click('#ff-welcome button:has-text("Not now")'); await w();
  await ev(() => ffAround()); await w(600);
  ok('show me around points at something real', await p.locator('.ff-spot').count() === 1);
  await w(9000);
  // drag
  const box = await p.$eval('#ff-bug', (e) => { const r = e.getBoundingClientRect(); return [r.x + 28, r.y + 28]; });
  await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(400, 400, { steps: 12 }); await w(300); await p.mouse.up(); await w(300);
  const at = await p.$eval('#ff-bug', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; });
  ok('dragging moves it and does not open it', Math.abs(at[0] - 372) < 40 && Math.abs(at[1] - 372) < 200 && !(await p.isVisible('#ff-panel')), at.join(','));
  // phone
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await ph.goto(URL); await ph.waitForTimeout(1600);
  await ph.evaluate(() => ffOpen()); await ph.waitForTimeout(400);
  let o = await ph.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.getElementById('ff-panel').getBoundingClientRect().right]);
  ok('phone: panel fits', o[0] <= o[1] && o[2] <= 390, o.join('/'));
  await ph.screenshot({ path: 'r10-phone-panel.png' });
  await ph.evaluate(() => ffTourStart('sales-lot')); await ph.waitForTimeout(700);
  o = await ph.evaluate(() => { const c = document.getElementById('ff-card').getBoundingClientRect(); return [c.left, c.right, document.documentElement.scrollWidth]; });
  ok('phone: tour card fits', o[0] >= 0 && o[1] <= 390 && o[2] <= 390, o.join('/'));
  await ph.screenshot({ path: 'r11-phone-tour.png' });
  console.log(`\n${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 5));
  await b.close();
})();
