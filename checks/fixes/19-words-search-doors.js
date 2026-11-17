// Whole-app batch 3: explainers, word list, formats, one search, test words, same look, leftovers.
// node fix19.js <url> [pic prefix]
const { chromium } = require('playwright');
/* The owner's and the builder's first names must never show on a screen. They are spelled in pieces here so this public file does not carry them either. */
const FIRST_NAMES = new RegExp('\\b(' + ['Jor' + 'dan', 'De' + 'an'].join('|') + ')\\b');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + String(d || '').slice(0, 400))); };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const SCREENS = [
  ['home', () => go('home')], ['lot', () => go('lot')], ['unit', () => openUnit(0)], ['start', () => go('start')], ['orders', () => go('orders')], ['sale', () => openSale('AA-20411')], ['performance', () => go('performance')], ['stock', () => go('stock')],
  ['configure-style', () => { begin(); }], ['configure-package', () => goStep(steps.indexOf('Package'))], ['configure-openings', () => goStep(steps.indexOf('Openings'))], ['configure-exterior', () => goStep(steps.indexOf('Exterior'))], ['configure-colors', () => goStep(steps.indexOf('Colors'))], ['configure-size', () => goStep(steps.indexOf('Size'))], ['configure-electrical', () => goStep(steps.indexOf('Electrical'))], ['configure-finish', () => goStep(steps.indexOf('Finish'))], ['notes', () => go('notes')],
  ['office', () => go('office')], ['of-orders', () => go('of-orders')], ['of-order', () => ofOpen('AA-20411')], ['of-order2', () => ofOpen('RAV-5538')], ['of-pay', () => go('of-pay')], ['of-requests', () => go('of-requests')], ['of-settings', () => go('of-settings')], ['of-notes', () => go('of-notes')], ['of-users', () => go('of-users')], ['of-prices', () => go('of-prices')], ['of-bills', () => go('of-bills')],
  ['prod', () => go('prod')], ['pr-list', () => go('pr-list')], ['pr-unit', () => prOpen(prUnits().find((u) => u.phase >= 2)?.id)], ['pr-phases', () => go('pr-phases')], ['pr-notes', () => go('pr-notes')],
  ['qc', () => go('qc')], ['qc-rework', () => go('qc-rework')], ['qc-signoff', () => go('qc-signoff')], ['qc-report', () => go('qc-report')], ['qc-changes', () => go('qc-changes')], ['qc-notes', () => go('qc-notes')],
  ['logi', () => go('logi')], ['lg-loads', () => go('lg-loads')], ['lg-load', () => lgOpen('AC')], ['lg-load2', () => lgOpen('H12')], ['lg-cal', () => go('lg-cal')], ['lg-places', () => go('lg-places')], ['lg-fleet', () => go('lg-fleet')], ['lg-drive', () => go('lg-drive')], ['lg-service', () => go('lg-service')], ['lg-notes', () => go('lg-notes')],
];
// words and formats that must not be on screen (builder notes are left out of the read)
const BANNED = [
  ['a slash date', /\b\d{1,2}\/\d{1,2}\/20\d{2}\b/], ['a computer date', /\b20\d{2}-\d{2}-\d{2}\b/], ['"/mo"', /\$[\d,.]+ ?\/ ?mo\b/], ['a spaced building size', /\b(?:8|10|12|14|16) ?× ?(?:1[0-9]|[2-6][0-9])\b(?! ?ft)/],
  ['a test word', /THIS IS A TEST|pre-build:/], ['a first name of the owner or the builder', FIRST_NAMES], ['"admin"', /admin review|administrator|\ban admin\b/i],
  ['an old tab name', /(^|\n)(Stats|Places|Units|Changes)(\n|$)/], ['"Kanban"', /Kanban/i], ['"Published range"', /Published range/], ['"observed in IdeaRoom"', /observed in IdeaRoom/], ['"Order intake"', /Order intake/], ['"Ready for QC 2 days"', /Ready for QC \d/],
];
const readScreen = () => {
  const out = [];
  for (const root of document.querySelectorAll('#app, .modal, .tabbar, nav')) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const n = walk.currentNode, p = n.parentElement; if (!p || p.closest('.ops-notes, .aw-raw, .sf-hook, .sf-only, script, style, code') || !p.offsetParent) continue; out.push(n.nodeValue); }
  }
  return out.join('\n');
};
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const errs = [];
  const open = async (phone) => { const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2300); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); }); await p.waitForTimeout(300); return p; };

  // ---------- 2, 3, 5: words and formats on every screen ----------
  for (const phone of [false, true]) {
    const p = await open(phone), tag = phone ? 'Phone' : 'Computer', hits = [];
    for (const [name, fn] of SCREENS) {
      try { await p.evaluate(fn); } catch (e) { hits.push(`${name}: could not open (${String(e.message).slice(0, 80)})`); continue; }
      await p.waitForTimeout(260);
      const text = await p.evaluate(readScreen);
      for (const [what, re] of BANNED) { const m = text.match(re); if (m) hits.push(`${name}: ${what} “${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')}”`); }
    }
    ok(`${tag}: no banned word or format on any of ${SCREENS.length} screens`, !hits.length, hits.slice(0, 8).join(' || '));
    if (!phone) {
      await p.evaluate(() => { go('home'); taOpenNotices(); }); await p.waitForTimeout(300);
      const bell = await p.evaluate(readScreen); ok('Bell list: no banned word or format', !BANNED.some(([, re]) => re.test(bell)), bell.slice(0, 300));
      await p.evaluate(() => closeModal());
    }
    await p.close();
  }
  const p = await open(false);
  ok('fmtDate: this year has no year', await p.evaluate(() => fmtDate(new Date(new Date().getFullYear(), 10, 14)) === 'Nov 14' && fmtDate(new Date(new Date().getFullYear(), 10, 14), { weekday: true }) === `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(new Date().getFullYear(), 10, 14).getDay()]}, Nov 14`));
  ok('fmtDate: another year keeps its year', await p.evaluate(() => fmtDate(new Date(2024, 2, 5)) === 'Mar 5, 2024'));
  ok('fmtSize and fmtMonthly', await p.evaluate(() => fmtSize('10 × 16') === '10x16' && fmtSize({ size: '12x20' }) === '12x20' && fmtMonthly(300) === '$300.00 a month'));
  ok('Door and window sizes keep their ×', await p.evaluate(() => awFormats('2 × 3 ft Standard window and a 6 × 7 Rollup Door on a 10 × 16') === '2 × 3 ft Standard window and a 6 × 7 Rollup Door on a 10x16' && awFormats('1 × 2×3 window') === '1 × 2×3 window'), await p.evaluate(() => awFormats('2 × 3 ft Standard window and a 6 × 7 Rollup Door on a 10 × 16') + ' | ' + awFormats('1 × 2×3 window')));
  ok('Dates and monthly payments are rewritten', await p.evaluate(() => awFormats('Signed 11/06/' + new Date().getFullYear() + ' · $241.58/mo · 2024-10-28') === 'Signed Nov 6 · $241.58 a month · Oct 28, 2024'), await p.evaluate(() => awFormats('Signed 11/06/' + new Date().getFullYear() + ' · $241.58/mo · 2024-10-28')));
  // settled names
  await p.evaluate(() => openSale('AA-20411')); await p.waitForTimeout(400);
  let t = await p.locator('#app').innerText();
  ok('Order page: "Send to the office", not "admin review"', /Send to the office|Sent to the office|office check/i.test(t) && !/admin/i.test(t), (t.match(/.{0,30}admin.{0,30}/i) || [''])[0]);
  ok('Order page title says Order, not Invoice', !/(^|\n)Invoice AA-20411/.test(t));
  if (PIC) { await p.waitForTimeout(4200); await p.screenshot({ path: PIC + '-words.png', clip: { x: 0, y: 60, width: 1360, height: 760 } }); }
  // phone tab names
  const ph = await open(true);
  const tabs = async (pg) => { await ph.evaluate((pg) => go(pg), pg); await ph.waitForTimeout(300); return ph.evaluate(() => [...document.querySelectorAll('.tabbar button')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()).join('|')); };
  t = await tabs('home'); ok('Phone Sales tab says Performance', /Performance/.test(t) && !/Stats/.test(t), t);
  t = await tabs('prod'); ok('Phone Production tab says All buildings', /All buildings/.test(t) && !/Units/.test(t), t);
  t = await tabs('qc'); ok('Phone QC tab says Change orders', /Change orders/.test(t) && !/(^|\|)Changes(\||$)/.test(t), t);
  ok('Phone tab bar does not scroll sideways with the longer names', await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  // ---------- 1: explainer pages ----------
  for (const [pg, side] of [['notes', 'Sales desk'], ['of-notes', 'Office'], ['pr-notes', 'Production'], ['qc-notes', 'Plant QC'], ['lg-notes', 'Logistics']]) {
    await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(350);
    const x = await p.evaluate(readScreen);
    ok(`${side} explainer: what works, what is pretend, open questions`, /What works here today/.test(x) && /What is still pretend/.test(x) && /Open questions for Turbo Assist’s builder/.test(x) && /Nothing is saved to a server/.test(x) && /Nobody signs in/.test(x), x.slice(0, 200));
    ok(`${side} explainer: names the two open questions`, /7 ft walls on a Garage Package/.test(x) && /\$0\.65/.test(x) && /\$258/.test(x) && /60-month rent-to-own/.test(x));
    ok(`${side} explainer: no first names`, !FIRST_NAMES.test(await p.locator('#app').innerText()));
  }
  await p.evaluate(() => go('notes')); await p.waitForTimeout(300);
  t = await p.evaluate(readScreen);
  ok('Sales explainer is up to date (fuel, floor plan, invoice lock, addresses, offline, Firefly)', /\$0\.30/.test(t) && /floor plan/.test(t) && /signature off/.test(t) && /web address/.test(t) && /no signal/.test(t) && /Firefly/.test(t));
  await p.evaluate(() => go('lg-notes')); await p.waitForTimeout(300); t = await p.evaluate(readScreen);
  ok('Logistics explainer says road miles are stored', /Road miles and drive times[^.]*stored/.test(t) && !/miles are rough/i.test(t));
  await p.evaluate(() => go('of-notes')); await p.waitForTimeout(300); t = await p.evaluate(readScreen);
  ok('Office explainer covers users, pricing with undo, and tax', /Users and permissions/.test(t) && /undone/.test(t) && /sales tax/i.test(t));
  if (PIC) { await p.evaluate(() => go('notes')); await p.waitForTimeout(4300); await p.screenshot({ path: PIC + '-explainer.png' }); }

  // ---------- 4: one search ----------
  for (const pg of ['home', 'office', 'prod', 'qc', 'logi']) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(250); ok(`Search button in the top bar on ${pg}`, await p.locator('#aw-search').isVisible()); }
  const find = async (page, q) => { await page.evaluate(() => { closeModal(); awSearchOpen(); }); await page.waitForTimeout(150); await page.fill('#aw-q', q); await page.waitForTimeout(300); return page.locator('#aw-results').innerText(); };
  await p.evaluate(() => go('home'));
  t = await find(p, 'morgan');
  ok('Search "morgan": orders, the plant and people, in groups', /ORDERS AND CUSTOMERS/i.test(t) && /Morgan Avery · order AA-20411/.test(t) && /BUILDINGS AT THE PLANT/i.test(t) && /PEOPLE/i.test(t), t);
  if (PIC) { await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-search.png', clip: { x: 200, y: 60, width: 960, height: 820 } }); }
  await p.locator('#aw-results .aw-row').first().click(); await p.waitForTimeout(400);
  ok('Picking an order opens it', await p.evaluate(() => S.page === 'sale' && S.activeSale === 'AA-20411') && /order\/AA-20411|sale\/AA-20411/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => S.page + ' ' + location.hash));
  t = await find(p, 'ORB-018');
  ok('Search finds a building by plant serial', /BUILDINGS AT THE PLANT/i.test(t) && /ORB-018\d\d/.test(t), t);
  await p.locator('#aw-results .aw-row').first().click(); await p.waitForTimeout(400);
  ok('…and opens it on Production', await p.evaluate(() => S.page === 'pr-unit' && document.body.dataset.side === 'prod'));
  t = await find(p, 'load a');
  ok('Search finds loads', /LOADS AND DELIVERIES/i.test(t) && /Load A/.test(t), t);
  await p.locator('#aw-results .aw-row').first().click(); await p.waitForTimeout(400);
  ok('…and opens the load on Logistics', await p.evaluate(() => S.page === 'lg-load' && document.body.dataset.side === 'logi'));
  t = await find(p, 'zzzz-nothing');
  ok('No match says "Nothing found" in plain words', /Nothing found/.test(t) && /No order, customer, building, load or person/.test(t), t);
  t = await find(p, 'riley');
  ok('Search finds people for someone with Users access', /PEOPLE/i.test(t) && /Riley Brooks/.test(t), t);
  // side access and lot limits
  await p.evaluate(() => { closeModal(); adView('u12'); go('logi'); }); await p.waitForTimeout(300); // a driver
  t = await find(p, 'riley');
  ok('A driver does not see People', !/PEOPLE/i.test(t), t);
  t = await find(p, 'morgan');
  ok('A driver does not see orders or plant buildings', !/ORDERS AND CUSTOMERS|BUILDINGS AT THE PLANT/i.test(t), t);
  const all = await p.evaluate(() => { closeModal(); adView('u1'); return awFind('flo').reduce((n, g) => n + g.rows.length + g.more, 0) + '|' + awFind('rav').reduce((n, g) => n + g.rows.length + g.more, 0); });
  const lim = await p.evaluate(() => { adUser('u8').lots = ['florence']; adView('u8'); const a = awFind('flo').filter((g) => /Orders/.test(g.title)).reduce((n, g) => n + g.rows.length, 0), b = awFind('rav').filter((g) => /Orders|plant/.test(g.title)).reduce((n, g) => n + g.rows.length, 0); adUser('u8').lots = 'all'; adView('u1'); return a + '|' + b; });
  ok('A person limited to one lot finds that lot’s orders and not another lot’s', +lim.split('|')[0] >= 1 && +lim.split('|')[1] === 0, `everyone ${all} limited ${lim}`);
  // phone
  await ph.evaluate(() => go('office')); await ph.waitForTimeout(300);
  ok('Phone: the Search button shows and is at least 44 px', await ph.evaluate(() => { const r = document.getElementById('aw-search').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.left >= 0; }), await ph.evaluate(() => JSON.stringify(document.getElementById('aw-search').getBoundingClientRect())));
  ok('Phone: the top bar does not scroll sideways', await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.querySelector('.topbar-in').scrollWidth <= document.querySelector('.topbar-in').clientWidth + 1));
  t = await find(ph, 'morgan');
  ok('Phone: search works and rows are big enough to tap', /Morgan Avery/.test(t) && await ph.evaluate(() => [...document.querySelectorAll('.aw-row')].every((r) => r.getBoundingClientRect().height >= 44)));
  if (PIC) await ph.screenshot({ path: PIC + '-search-phone.png' });
  await ph.evaluate(() => closeModal());
  // each side's own filter boxes are still there
  await p.evaluate(() => { closeModal(); go('of-orders'); }); await p.waitForTimeout(300);
  ok('The Office keeps its own filter box', await p.locator('#app input[type=search]').count() >= 1);

  // ---------- 6: same look ----------
  const heads = {};
  for (const pg of ['orders', 'office', 'prod', 'qc', 'logi']) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(300); heads[pg] = await p.evaluate(() => { const h = document.querySelector('.pagehead h1'); const cs = getComputedStyle(h); return { size: cs.fontSize, weight: cs.fontWeight, family: cs.fontFamily.split(',')[0], text: h.innerText }; }); }
  const hv = Object.values(heads);
  ok('Page titles are the same size, weight and font on all five sides', hv.every((h) => h.size === hv[0].size && h.weight === hv[0].weight && h.family === hv[0].family), JSON.stringify(heads));
  ok('QC titles read like the other sides’ titles', /\.$/.test(heads.qc.text) && /\.$/.test(heads.office.text), JSON.stringify(heads));
  if (PIC) { const a = await p.evaluate(() => { go('office'); return 1; }); await p.waitForTimeout(4300); const s1 = await p.screenshot({ clip: { x: 0, y: 150, width: 1360, height: 230 } }); await p.evaluate(() => go('qc')); await p.waitForTimeout(500); const s2 = await p.screenshot({ clip: { x: 0, y: 150, width: 1360, height: 230 } });
    const m = await b.newPage({ viewport: { width: 1360, height: 470 }, deviceScaleFactor: 2 }); await m.setContent(`<body style="margin:0;background:#888;display:grid;gap:10px"><img style="width:1360px;display:block" src="data:image/png;base64,${s1.toString('base64')}"><img style="width:1360px;display:block" src="data:image/png;base64,${s2.toString('base64')}"></body>`); await m.screenshot({ path: PIC + '-headings.png' }); await m.close(); }
  const small = [];
  for (const pg of ['home', 'orders', 'office', 'of-orders', 'of-pay', 'prod', 'qc', 'logi', 'lg-loads']) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(300); const x = await p.evaluate(() => [...document.querySelectorAll('#app button.primary')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)).filter((h) => h < 44)); if (x.length) small.push(`${pg}: ${x.join(',')}`); }
  ok('Main buttons are at least 44 px tall on every side', !small.length, small.join(' | '));

  // ---------- 7: floor plan leftovers ----------
  await p.evaluate(() => { adView('u1'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
  await p.evaluate(() => { change('size', '12x20'); goStep(steps.indexOf('Finish')); taAddonSet('Workbench (per LF)', 6); taAddonSet('Three Tier Shelving (per LF)', 8); taAddonSet('Additional Loft (PER SQ FT)', 48); render(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { openBuildSheet('cfg', true); const lay = bsLayout(S.c); for (const it of lay.items.filter((x) => x.kind === 'fix')) bsEdPlace(it.key, it.fw, it.at); bsRender(); }); await p.waitForTimeout(500);
  ok('All three pieces are placed', await p.evaluate(() => fpLeft(S.c).length === 0 && fpPieces(S.c).length === 3), await p.evaluate(() => JSON.stringify(fpPieces(S.c))));
  const strips = await p.evaluate(() => { const lay = bsLayout(S.c); return lay.sh.walls.map((w) => bsStrip(lay, w, 20)).join('\n'); });
  ok('Wall strips draw the workbench, the shelving and the loft', /Workbench · 6 ft: /.test(strips) && /Shelving · 8 ft: /.test(strips) && /Loft · 48 sq ft \(overhead/.test(strips), strips.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500));
  const sheet2 = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = bsPages(bsOrder('cfg')); return d.querySelectorAll('.bs-page')[1].textContent.replace(/\s+/g, ' '); });
  ok('The printed sheet 2 shows the pieces on their walls and no longer says "not drawn on this sheet"', /Workbench · 6 ft: /.test(sheet2) && /Shelving · 8 ft: /.test(sheet2) && /Loft · 48 sq ft \(overhead/.test(sheet2) && !/not drawn on this sheet/.test(sheet2), sheet2.slice(0, 700));
  const clear = await p.evaluate(() => { const lay = bsLayout(S.c); const svg = bsPlan(lay); const tags = lay.sh.walls.map((w) => w.tagAt).filter(Boolean); const nums = [...svg.matchAll(/<g class="fp-piece">[\s\S]*?<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]); return { n: nums.length, near: nums.filter((q) => tags.some((t) => Math.hypot(t[0] - q[0], t[1] - q[1]) < 18)).length }; });
  ok('On the printed plan no piece number sits under a wall letter', clear.n === 3 && clear.near === 0, JSON.stringify(clear));
  if (PIC) { await p.evaluate(() => { BS.edit = false; bsRender(); }); await p.waitForTimeout(500); const y = await p.evaluate(() => { const e = document.querySelector('#bsheet .bs-wall'); e.scrollIntoView({ block: 'start' }); return 1; }); await p.waitForTimeout(400); await p.screenshot({ path: PIC + '-wall-strips.png' }); }
  await p.evaluate(() => closeBuildSheet());

  // ---------- 8: small leftovers ----------
  await p.evaluate(() => { go('home'); }); await p.waitForTimeout(300);
  const before = await p.evaluate(() => ahNews());
  await p.evaluate(() => taOpenNotices()); await p.waitForTimeout(300);
  ok('Opening the bell does not mark the news read', before > 0 && await p.evaluate(() => ahNews()) === before, `before ${before}`);
  ok('The bell list has "Mark all read" and a "Mark read" on each new item', /Mark all read/.test(await p.locator('.modal').innerText()) && await p.locator('.modal button:has-text("Mark read")').count() === before);
  await p.locator('.modal button:has-text("Mark read")').first().click(); await p.waitForTimeout(300);
  ok('"Mark read" reads one item', await p.evaluate(() => ahNews()) === before - 1);
  await p.locator('.modal button:has-text("Mark all read")').click(); await p.waitForTimeout(300);
  ok('"Mark all read" reads the rest, on the bell and on Firefly', await p.evaluate(() => ahNews()) === 0 && await p.evaluate(() => document.getElementById('ta-bell-count').hidden));
  await p.evaluate(() => closeModal());
  const chAll = await p.evaluate(() => { adView('u1'); go('qc-changes'); return document.querySelectorAll('#app .changes > *').length; });
  const chLim = await p.evaluate(() => { const lots = [...new Set(S.changes.map((c) => (typeof ofSale === 'function' && ofSale(c.order) ? saleLot(ofSale(c.order))?.id : null)).filter(Boolean))]; adUser('u10').lots = ['plant:none', 'no-such-lot']; adView('u10'); go('qc-changes'); const n = document.querySelectorAll('#app .changes > *').length; adUser('u10').lots = ['plant:orangeburg']; adView('u1'); return n + '|' + lots.join(','); });
  ok('Plant QC’s change-order page follows the person’s lots', chAll > 0 && +chLim.split('|')[0] < chAll, `all ${chAll} limited ${chLim}`);
  if (PIC) { await p.evaluate(() => { go('lg-loads'); }); await p.waitForTimeout(4300); await p.screenshot({ path: PIC + '-dates.png', clip: { x: 0, y: 60, width: 1360, height: 700 } }); }
  ok('No sideways scroll on the phone', await ph.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  // ---------- 9: door options live with the doors ----------
  for (const page of [p, ph]) {
    const tag = page === ph ? 'Phone' : 'Computer';
    await page.evaluate(() => { try { closeModal(); closeBuildSheet(); } catch (e) {} adView('u1'); localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await page.waitForTimeout(300);
    await page.click('button:has-text("Start configuring")'); await page.waitForTimeout(1500);
    await page.evaluate(() => goStep(steps.indexOf('Finish'))); await page.waitForTimeout(400);
    let x = await page.locator('#app').innerText();
    ok(`${tag}: the three door options are gone from the last step's add-ons`, !/Sectional garage door|84 in\.|Custom wood door/i.test(x) && /Workbench/.test(x), (x.match(/.{0,30}(Sectional garage door|84 in\.|Custom wood door).{0,30}/i) || [''])[0]);
    await page.evaluate(() => goStep(steps.indexOf('Openings'))); await page.waitForTimeout(400);
    x = await page.locator('#aw-doors').innerText();
    ok(`${tag}: they sit in the Doors box under "More door options", with prices`, /MORE DOOR OPTIONS/i.test(x) && /Sectional garage door[\s\S]*\$1,740\.00 each/.test(x) && /Taller wood door, 84 in\.[\s\S]*Adds to the standard door price\.[\s\S]*\$250\.00 each/.test(x) && /Custom wood door[\s\S]*\$250\.00 each/.test(x), x);
    ok(`${tag}: the block is inside the Doors panel, above the door colors`, await page.evaluate(() => { const d = document.getElementById('aw-doors'), panel = d.closest('.panel.openings'), col = panel.querySelector('.door-color-choices'); return /Doors/.test(panel.querySelector('h3').textContent) && !!(d.compareDocumentPosition(col) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    const before = await page.evaluate(() => breakdown(S.c).reduce((t, r) => t + r.amount, 0));
    await page.locator('#aw-doors button[aria-label="One more Sectional garage door"]').click(); await page.waitForTimeout(300);
    await page.locator('#aw-doors button[aria-label="One more Custom wood door"]').click(); await page.waitForTimeout(300);
    await page.locator('#aw-doors button[aria-label="One more Custom wood door"]').click(); await page.waitForTimeout(300);
    const rows = await page.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount]));
    ok(`${tag}: the stepper adds them to the price (1 sectional, 2 custom)`, rows.some((r) => /Sectional garage door × 1/.test(r[0]) && r[1] === 1740) && rows.some((r) => /Custom wood door × 2/.test(r[0]) && r[1] === 500) && Math.abs(rows.reduce((t, r) => t + r[1], 0) - before - 2240) < 0.01, JSON.stringify(rows));
    ok(`${tag}: steppers are at least 44 px and the screen does not scroll sideways`, await page.evaluate(() => [...document.querySelectorAll('#aw-doors .stepper button')].every((e) => e.getBoundingClientRect().width >= 44 && e.getBoundingClientRect().height >= 44) && document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    if (PIC && page === p) { await page.waitForTimeout(4300); await page.locator('#aw-doors').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: PIC + '-doors.png' }); }
    if (PIC && page === ph) { await page.locator('#aw-doors').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: PIC + '-doors-phone.png' }); }
    await page.locator('#aw-doors button[aria-label="One fewer Custom wood door"]').click(); await page.waitForTimeout(300);
    ok(`${tag}: the minus button takes one off`, await page.evaluate(() => S.c.extras['Custom Wood Doors'] === 1));
    if (page === p) {
      ok('The sectional garage door is a piece to place on the floor plan', await page.evaluate(() => fpPieces(S.c).some((x) => /Sectional garage door/.test(x.name) && !x.placed)));
      await page.evaluate(() => whenBuildReady(quoteForm)); await page.waitForTimeout(300);
      ok('…and the sale waits until it is placed', !(await page.locator('#qcustomer').count()));
      await page.evaluate(() => { closeModal(); openBuildSheet('cfg', true); const lay = bsLayout(S.c); const it = lay.items.find((i) => i.kind === 'fix'); bsEdPlace(it.key, it.fw, it.at); bsRender(); return 1; }); await page.waitForTimeout(400);
      ok('Placed, it is drawn 8 ft wide on a wall', await page.evaluate(() => { const it = bsLayout(S.c).items.find((i) => i.kind === 'fix'); return it.placed && Math.abs(it.len - 8) < 0.01; }));
      await page.evaluate(() => closeBuildSheet());
      await page.evaluate(() => { change('package', 'Garage Package'); goStep(steps.indexOf('Openings')); }); await page.waitForTimeout(400);
      ok('With a Garage Package, a note warns about doubling up (it does not block)', /already has a roll-up door/.test(await page.locator('#aw-doors').innerText()) && await page.locator('#aw-doors button[aria-label="One more Sectional garage door"]').isEnabled());
      await page.evaluate(() => { change('package', ''); change('style', 'Lofted'); goStep(steps.indexOf('Openings')); }); await page.waitForTimeout(400);
      const barn = await page.locator('#aw-doors').innerText().catch(() => '');
      ok('On a barn the sectional garage door is not offered', !/Sectional garage door/.test(barn) && /Custom wood door/.test(barn), barn);
      ok('The sale draft keeps the door options', await page.evaluate(() => { go('home'); const d = JSON.parse(localStorage.getItem('sales:draft') || 'null'); return !!d && d.c.extras['Custom Wood Doors'] === 1; }));
    }
  }
  // ---------- 10: Exterior before Colors; vinyl wrap under lap siding ----------
  ok('Step order: Style, Size, Package, Openings, Exterior, Colors, Electrical, Finish', await p.evaluate(() => steps.join(',') === 'Style,Size,Package,Openings,Exterior,Colors,Electrical,Finish'), await p.evaluate(() => steps.join(',')));
  for (const page of [p, ph]) {
    const tag = page === ph ? 'Phone' : 'Computer';
    await page.evaluate(() => { try { closeModal(); closeBuildSheet(); } catch (e) {} adView('u1'); localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await page.waitForTimeout(300);
    await page.click('button:has-text("Start configuring")'); await page.waitForTimeout(1500);
    const seen = [];
    for (let i = 0; i < 7; i++) { seen.push(await page.evaluate(() => steps[S.step])); await page.locator('.summaryactions button:has-text("Continue")').click(); await page.waitForTimeout(300); }
    seen.push(await page.evaluate(() => steps[S.step]));
    ok(`${tag}: Continue walks the steps in the new order`, seen.join(',') === 'Style,Size,Package,Openings,Exterior,Colors,Electrical,Finish', seen.join(','));
    let x = await page.locator('#app').innerText();
    ok(`${tag}: vinyl wrap is gone from the last step's list`, !/Vinyl wrap/i.test(x), (x.match(/.{0,30}Vinyl wrap.{0,30}/i) || [''])[0]);
    await page.evaluate(() => goStep(steps.indexOf('Exterior'))); await page.waitForTimeout(400);
    ok(`${tag}: the step bar shows Exterior right before Colors`, await page.evaluate(() => { const l = [...document.querySelectorAll('.steps .step-label')].map((e) => e.textContent.trim()); return l.indexOf('Exterior') + 1 === l.indexOf('Colors') && l.indexOf('Exterior') === 4; }), await page.evaluate(() => [...document.querySelectorAll('.steps button')].map((e) => e.textContent.trim()).join('|')));
    ok(`${tag}: a vinyl wrap box with its fee sits right under the lap siding choice`, await page.evaluate(() => { const v = document.querySelector('label.aw-vinyl'), prev = v && v.previousElementSibling; return !!v && /Add vinyl wrap/.test(v.textContent) && /\+\$450\.00/.test(v.textContent) && !!prev && /Lap Siding/.test(prev.textContent) && v.getBoundingClientRect().height >= 44; }), await page.locator('#app').innerText());
    ok(`${tag}: without lap siding it is greyed and says "Only with lap siding"`, await page.isDisabled('#aw-vinyl') && /Only with lap siding/.test(await page.locator('label.aw-vinyl').innerText()));
    await page.evaluate(() => change('siding', 'Lap')); await page.waitForTimeout(400);
    ok(`${tag}: with lap siding it can be ticked`, await page.isEnabled('#aw-vinyl') && !/Only with lap siding/.test(await page.locator('label.aw-vinyl').innerText()));
    const before = await page.evaluate(() => breakdown(S.c).reduce((t, r) => t + r.amount, 0));
    await page.check('#aw-vinyl'); await page.waitForTimeout(300);
    const rows = await page.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount]));
    ok(`${tag}: ticking it adds the $450 line to the price`, rows.some((r) => /Vinyl wrap/i.test(r[0]) && r[1] === 450) && Math.abs(rows.reduce((t, r) => t + r[1], 0) - before - 450) < 0.01 && await page.isChecked('#aw-vinyl'), JSON.stringify(rows));
    if (PIC && page === p) { await page.waitForTimeout(4300); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: PIC + '-exterior.png' }); }
    await page.evaluate(() => change('siding', 'Basic groove')); await page.waitForTimeout(400);
    ok(`${tag}: changing away from lap siding unticks it and takes the price off`, await page.evaluate(() => !S.c.extras?.['Vinyl Wrap'] && !breakdown(S.c).some((r) => /Vinyl wrap/i.test(r.name))) && await page.isDisabled('#aw-vinyl') && !(await page.isChecked('#aw-vinyl')));
    ok(`${tag}: …and a plain message says so`, /Vinyl wrap was taken off\. It only goes with lap siding\./.test(await page.evaluate(() => document.getElementById('toast')?.textContent || '')), await page.evaluate(() => document.getElementById('toast')?.textContent || ''));
    ok(`${tag}: no sideways scroll on the Exterior step`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  }
  // a kept sale comes back on the same named step
  await p.evaluate(() => { goStep(steps.indexOf('Colors')); change('color', 'Clay'); go('home'); }); await p.waitForTimeout(400);
  ok('The resume card names the step by name', /Step 6 of 8 · Colors/.test(await p.locator('#sale-draft').innerText().catch(() => '')), await p.locator('#sale-draft').innerText().catch(() => ''));
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('sales:draft')); d.step = 4; localStorage.setItem('sales:draft', JSON.stringify(d)); go('orders'); go('home'); }); await p.waitForTimeout(300);
  await p.click('#sale-draft button:has-text("Resume")'); await p.waitForTimeout(1200);
  ok('Resume lands on Colors even if the saved number points elsewhere', await p.evaluate(() => S.page === 'configure' && steps[S.step] === 'Colors'));
  await p.evaluate(() => { localStorage.setItem('sales:draft', JSON.stringify({ c: S.c, step: 5, completed: 5, path: 'custom', at: Date.now() })); go('home'); }); await p.waitForTimeout(300);
  ok('An older kept sale with only a number still opens', /Step 6 of 8/.test(await p.locator('#sale-draft').innerText().catch(() => '')));
  // the electrical question still guards its own step in the new order
  await p.evaluate(() => { localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
  await p.evaluate(() => { goStep(steps.indexOf('Electrical')); change('electrical', 'Basic'); }); await p.waitForTimeout(300);
  await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(300);
  ok('The electrical question still stops Continue on the Electrical step', await p.evaluate(() => steps[S.step] === 'Electrical' && !S.c.elecPlace));
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 4));
  await b.close();
})();
