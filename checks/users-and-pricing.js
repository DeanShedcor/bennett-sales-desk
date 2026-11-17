const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } });
  const errs = []; let pass = 0, fail = 0;
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
  const rows = () => p.$$eval('.ops-row', (e) => e.map((x) => x.innerText).join(' | ')); const ev = (f, a) => p.evaluate(f, a), w = (ms = 200) => p.waitForTimeout(ms), txt = () => p.$eval('#app', (e) => e.innerText), toast = () => p.$eval('#toast', (e) => e.textContent);
  await p.goto(URL); await w(1500);
  await p.click('#ad-gear'); await w();
  ok('gear opens Users and permissions', /Users and permissions/.test(await txt()) && await ev(() => S.page) === 'of-users');
  ok('super user sees the waiting owner removal', /Waiting on a super user/.test(await txt()) && /Morgan Ellis/.test(await txt()));
  ok('no view-as bar for the default super user', await p.locator('#ad-bar').count() === 0);
  await p.screenshot({ path: 'shots/ad-users.png' });
  // owner view
  await ev(() => adView('u3')); await w();
  ok('an owner does not see the removed owner', !/Morgan Ellis/.test(await rows()) && !/Waiting on a super user/.test(await txt()));
  ok('view-as bar shows', /Viewing as Jo Carver/.test(await p.$eval('#ad-bar', (e) => e.innerText)));
  await ev(() => adAddForm()); await w();
  ok('an owner cannot add a super user', (await p.$$eval('#ad-k option', (e) => e.map((x) => x.value))).join() === 'user,owner');
  await p.fill('#ad-n', 'Test Person'); await p.fill('#ad-e', 'test.person@example.com'); await p.fill('#ad-t', 'Salesperson'); await p.selectOption('#ad-r', 'sales_rep'); await p.selectOption('#ad-l', 'conway'); await p.click('.modal button:has-text("Send the invitation")'); await w();
  const nid = await ev(() => AD.open);
  ok('new person is invited with the role access', await ev((id) => adUser(id).status + adFromRoles(adUser(id), 'sales') + adUser(id).lots.join(), nid) === 'invitededitconway');
  await p.click('button:has-text("Mark as joined")'); await w();
  await p.click('.ad-sec:has-text("Office") .ad-seg button:has-text("Read only")'); await w();
  ok('one section changed for one person', await ev((id) => adAccess(adUser(id), 'office') + adAccess(adUser(id), 'sales') + adAccess(adUser(id), 'pricing'), nid) === 'readeditnone', await p.$eval('.ad-sec:has-text("Office") small', (e) => e.textContent));
  await p.screenshot({ path: 'shots/ad-user.png', fullPage: true });
  // owner removes an owner: two-step
  await ev(() => adOpen('u4')); await w(); await p.click('button:has-text("Remove this person")'); await w();
  await p.fill('#ad-why', 'Test reason'); await p.click('.modal button:has-text("Remove")'); await w();
  ok('owner removed by an owner: pending, gone from the owner’s list', await ev(() => adUser('u4').status) === 'pending' && !/Lee Harmon/.test(await rows()));
  ok('office bell told', await ev(() => taNoticesFor('office').some((n) => /Owner removal waiting on a super user — Lee Harmon/.test(n.title))));
  await ev(() => adView('u4')); await w();
  ok('the removed owner is locked out and told why', /Your access is under review/.test(await txt()));
  await ev(() => go('home')); await w();
  ok('locked out on every side', /Your access is under review/.test(await txt()));
  await ev(() => { adView('u3'); adDecide('u4', true); }); await w();
  ok('an owner cannot accept the removal', await ev(() => adUser('u4').status) === 'pending');
  await ev(() => { adView('u2'); go('of-users'); }); await w();
  ok('the other super user sees it', /Lee Harmon/.test(await txt()));
  await p.click('.ops-row:has-text("Lee Harmon") button:has-text("Restore")'); await w();
  ok('super user restores', await ev(() => adUser('u4').status) === 'active');
  await p.click('.ops-row:has-text("Morgan Ellis") button:has-text("Accept removal")'); await w(); await p.fill('#op-why', 'Left the company'); await p.click('.modal button:has-text("Remove for good")'); await w();
  ok('super user accepts: deleted', await ev(() => adUser('u5').status) === 'deleted');
  // only super adds super
  await ev(() => { adView('u3'); adSet('u6', 'kind', 'super'); }); await w();
  ok('owner cannot make a super user', await ev(() => adUser('u6').kind) === 'user');
  ok('owner cannot edit a super user', await ev(() => adMayEdit(adUser('u1'))) === false);
  await ev(() => { adView('u1'); adSet('u6', 'kind', 'super'); }); await w();
  ok('super user can', await ev(() => adUser('u6').kind) === 'super');
  await ev(() => adSet('u6', 'kind', 'user'));
  ok('one super user cannot demote another alone (new rule)', await ev(() => adUser('u6').kind) === 'super');
  await ev(() => { adUser('u6').kind = 'user'; render(); });
  // read-only enforcement: Casey Park (sales rep): sales edit only
  await ev(() => { adView('u7'); go('office'); }); await w();
  ok('no access screen for a section with None', /has no access to Office/.test(await txt()));
  ok('side buttons hidden for None', await p.$$eval('.sideswitch.strip [data-side-btn]', (e) => e.filter((x) => !x.hidden).map((x) => x.dataset.sideBtn).join()) === 'sales');
  // Riley Brooks: office edit, payments edit (changed), sales read, logi read
  await ev(() => { adView('u8'); go('home'); }); await w();
  ok('read only is flagged', await ev(() => document.body.dataset.adRead) === '1');
  await p.click('.home-actions .primary'); await w();
  ok('navigation still works read-only', await ev(() => S.page) === 'start');
  await ev(() => go('home')); await w(); await p.click('.ta-check button:has-text("Log an ad")'); await w();
  ok('an action is blocked read-only', /can look here but not change/.test(await toast()) && await ev(() => TA_CHECK.ads) === 2);
  await ev(() => go('office')); await w();
  ok('edit where they have edit', await ev(() => document.body.dataset.adRead) === '' );
  await ev(() => go('of-prices')); await w();
  ok('pricing closed to them', /has no access to Model pricing/.test(await txt()));
  // Sam Lee: pricing read
  await ev(() => { adView('u6'); go('of-prices'); }); await w();
  ok('pricing read only: inputs disabled', await p.$$eval('.ad-cell input', (e) => e.every((x) => x.disabled)));
  // pricing as super
  await ev(() => { adView('u1'); go('of-prices'); }); await w();
  const before = await ev(() => PRICE_LIST['Basic Utility']['10x16']);
  await p.fill('.ad-cell:has-text("10x16") input', String(before + 100)); await p.keyboard.press('Tab'); await w();
  ok('typing a price goes to the draft, not live', await ev(() => AD.draft.length) === 1 && await ev(() => PRICE_LIST['Basic Utility']['10x16']) === before);
  await p.fill('#ad-by', '3'); await p.click('button:has-text("Add to the draft")'); await w();
  const n = await ev(() => AD.draft.length);
  ok('3% on a model fills the draft, rounded to $5', n === 64 && await ev(() => AD.draft.every((d) => d.new % 5 === 0)), String(n));
  await p.screenshot({ path: 'shots/ad-prices.png' });
  await ev(() => { AD.tab = 'draft'; render(); }); await w();
  const tomorrow = await ev(() => new Date(Date.now() + 864e5).toLocaleDateString('en-CA'));
  await p.fill('#ad-when', tomorrow); await p.click('.ad-tools button:has-text("Publish")'); await w(); await p.click('.modal .actions button.primary'); await w();
  ok('publish on a later date: scheduled, still not live', await ev(() => AD.sched.length) === 1 && await ev(() => PRICE_LIST['Basic Utility']['10x16']) === before, await toast());
  await p.screenshot({ path: 'shots/ad-draft.png' });
  await p.click('button:has-text("Make it live now")'); await w();
  const after = await ev(() => PRICE_LIST['Basic Utility']['10x16']);
  ok('live on the day: the list changes', after === Math.round((before + 100) * 1.03 / 5) * 5, `${before} -> ${after}`);
  await ev(() => { begin(); }); await w(300);
  ok('the Sales desk follows', await ev(() => breakdown()[0].amount) === after);
  // options
  await ev(() => { go('of-prices'); AD.tab = 'items'; render(); }); await w();
  await p.fill('.ad-cell:has-text("Workbench") input', '18'); await p.keyboard.press('Tab'); await w();
  await ev(() => { AD.tab = 'draft'; render(); }); await w(); await p.click('.ad-tools button:has-text("Publish")'); await w(); await p.click('.modal .actions button.primary'); await w();
  ok('an option price publishes today', await ev(() => taListPrice('Workbench (per LF)')) === 18);
  // lot price
  await ev(() => { AD.tab = 'lot'; AD.lot = 'moncks-corner'; AD.model = 'Basic Utility'; render(); }); await w();
  await p.fill('.ad-cell:has-text("10x16") input', '5000'); await p.keyboard.press('Tab'); await w();
  await ev(() => { AD.tab = 'draft'; render(); }); await w(); await p.click('.ad-tools button:has-text("Publish")'); await w(); await p.click('.modal .actions button.primary'); await w();
  await ev(() => begin()); await w(300);
  ok('a lot price wins at that lot', await ev(() => breakdown()[0].amount) === 5000 && await ev(() => PRICE_LIST['Basic Utility']['10x16']) === after);
  ok('another lot stays on the main list', await ev(() => { AD.lotCtx = 'conway'; const v = breakdown()[0].amount; AD.lotCtx = null; return v; }) === after);
  // sheet
  const csv = await ev(() => adSheetCsv());
  ok('sheet has Turbo Assist’s columns and every row', csv.startsWith('product_line,width_ft,length_ft,msrp,new_msrp,lot,notes') && csv.split('\n').length > 560, String(csv.split('\n').length));
  const filled = csv.split('\n').map((l) => l.startsWith('Elite Lofted,12,24,') ? l.replace(/^(Elite Lofted,12,24,[\d.]+),/, '$1,9999') : l.startsWith('Vinyl Wrap,') ? l.replace(/^(Vinyl Wrap,,,[\d.]+),/, '$1,475') : l).join('\n') + '\nBasic Utility,8,12,0,3999,Conway,\nNo Such Model,9,9,0,100,,\n';
  const res = await ev((t) => adSheetLoad(t), filled); await w();
  ok('a filled-in sheet reads into the draft', res.read === 3 && res.bad.length === 1 && await ev(() => AD.draft.length) === 3, JSON.stringify(res));
  ok('sheet lot row became a lot price', await ev(() => AD.draft.some((d) => d.kind === 'lot' && d.lot === 'conway' && d.new === 3999)));
  await ev(() => { AD.draft = []; render(); });
  // phone
  await p.setViewportSize({ width: 390, height: 800 });
  for (const [name, f] of [['users', () => go('of-users')], ['user', () => adOpen('u8')], ['prices', () => { AD.tab = 'grid'; go('of-prices'); }], ['items', () => { AD.tab = 'items'; render(); }], ['sheet', () => { AD.tab = 'sheet'; render(); }], ['settings', () => go('of-settings')], ['viewas', () => { adView('u8'); go('home'); }]]) {
    await ev(f); await w(250);
    const o = await ev(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok('phone fits: ' + name, o[0] <= o[1], o.join('/'));
  }
  await p.screenshot({ path: 'shots/ad-phone.png' });
  console.log(`\n${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 5));
  await b.close();
})();
