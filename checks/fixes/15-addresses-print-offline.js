// Whole-app batch 1: addresses and Back, printing, lighter load, pop-ups, logo and gear, no yellow
// top buttons, offline copy, run sheet for a driver. node fix15.js <url> [pic prefix]
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3], T = process.cwd() + '/tmp15/';
fs.mkdirSync(T, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const quiet = (p) => p.evaluate(() => { try { ffSetOn(false); } catch (e) {} });
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const errs = [];
  const open = async (opts = {}, url = L) => {
    const ctx = await b.newContext({ ...(opts.phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: opts.dsf || 1 }), ...(opts.noSw ? { serviceWorkers: 'block' } : {}) });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    if (opts.watch) opts.watch(p);
    await p.goto(url); await p.waitForTimeout(2200); if (!opts.loud) { await quiet(p); await p.waitForTimeout(300); }
    return p;
  };
  const st = (p) => p.evaluate(() => ({ hash: location.hash, page: S.page, side: document.body.dataset.side }));

  /* ---------- 1. Addresses, Back, refresh, links ---------- */
  {
    const p = await open();
    ok('1 Home has its own address', (await st(p)).hash === '#sales', await st(p));
    const ids = await p.evaluate(() => { go('logi'); const o = { sale: S.sales[0].id, load: LG.loads[0].id, unit: prUnits()[0].id, serial: Q.builds[0].serial, lot: lots[0].id, user: AD.users[1].id }; go('home'); return o; });
    const walk = [
      ['sales', "go('orders')", '#sales/orders', 'orders'], ['sales', "openUnit(0)", '#sales/unit/' + encodeURIComponent(ids.lot), 'unit'],
      ['office', "go('of-orders')", '#office/orders', 'of-orders'], ['office', `ofOpen('${ids.sale}')`, '#office/order/' + ids.sale, 'of-order'],
      ['prod', "go('pr-list')", '#plant/list', 'pr-list'], ['prod', `prOpen('${ids.unit}')`, '#plant/unit/' + encodeURIComponent(ids.unit), 'pr-unit'],
      ['qc', "go('qc-rework')", '#qc/rework', 'qc-rework'],
      ['logi', "go('lg-cal')", '#logistics/cal', 'lg-cal'], ['logi', `lgOpen('${ids.load}')`, '#logistics/load/' + ids.load, 'lg-load'],
    ];
    for (const [side, fn, hash, page] of walk) {
      await p.evaluate(fn); await p.waitForTimeout(250);
      const s = await st(p);
      ok(`1 ${side}: ${page} is at ${hash}`, s.hash === hash && s.page === page && s.side === side, s);
    }
    // Back walks the screens backwards and never leaves the app
    const back = [];
    for (let i = 0; i < 4; i++) { await p.goBack(); await p.waitForTimeout(300); back.push((await p.evaluate(() => (typeof S === 'object' ? S.page : 'LEFT THE APP')))); }
    ok('1 Back goes back one screen at a time', JSON.stringify(back) === JSON.stringify(['lg-cal', 'qc-rework', 'pr-unit', 'pr-list']), back);
    await p.goForward(); await p.waitForTimeout(300);
    ok('1 Forward works too', (await st(p)).page === 'pr-unit');
    await p.reload(); await p.waitForTimeout(2200);
    let s = await st(p);
    ok('1 A refresh stays on the same side and screen', s.page === 'pr-unit' && s.side === 'prod' && s.hash === '#plant/unit/' + encodeURIComponent(ids.unit), s);
    ok('1 …and shows that building', (await p.locator('#app').innerText()).includes(ids.unit) || (await p.evaluate(() => PR.id)) === ids.unit);
    await p.close();
    // links open the screen they name, on every side
    for (const [name, hash, page, side, has] of [
      ['a load', '#logistics/load/' + ids.load, 'lg-load', 'logi', 'Load ' + ids.load], ['an Office order', '#office/order/' + ids.sale, 'of-order', 'office', ids.sale],
      ['a plant building', '#plant/unit/' + encodeURIComponent(ids.unit), 'pr-unit', 'prod', null], ['a QC check', '#qc/inspect/' + encodeURIComponent(ids.serial), 'qc-inspect', 'qc', null],
      ['a lot building', '#sales/unit/' + encodeURIComponent(ids.lot), 'unit', 'sales', null], ['a list screen', '#logistics/fleet', 'lg-fleet', 'logi', 'Trailers'], ['a person', '#office/user/' + ids.user, 'of-user', 'office', null],
    ]) {
      const q = await open({}, L + hash); const t = await st(q), text = await q.locator('#app').innerText();
      ok(`1 A link to ${name} opens it`, t.page === page && t.side === side && (!has || text.includes(has)), { t, text: text.slice(0, 80) });
      if (PIC && name === 'a load') { await q.waitForTimeout(4300); await q.screenshot({ path: PIC + '-address.png', clip: { x: 0, y: 0, width: 1360, height: 760 } }); fs.writeFileSync(PIC + '-address.txt', 'This screen was opened straight from the link ' + L + hash + '\n'); }
      await q.close();
    }
    for (const [name, hash, page] of [['a load that is gone', '#logistics/load/ZZZ', 'lg-loads'], ['an order that is gone', '#office/order/NOPE-1', 'of-orders'], ['a sale that is gone', '#sales/sale/BEN-9999', 'orders'], ['an unknown screen', '#office/nothing', 'office'], ['nonsense', '#what/ever', 'home']]) {
      const q = await open({ loud: true }, L + hash); const t = await st(q);
      const toast = await q.locator('#toast').innerText().catch(() => '');
      ok(`1 A link to ${name} lands on a list, with no error`, t.page === page && (!/gone/.test(name) || /not here any more/.test(toast)), { t, toast });
      await q.close();
    }
    // a sale being designed: the address survives a refresh through the kept sale
    const d = await open();
    await d.click('button:has-text("Start a sale"):visible'); await d.waitForTimeout(300);
    await d.click('button:has-text("Start configuring")'); await d.waitForTimeout(1500);
    await d.locator('.summaryactions button:has-text("Continue")').click(); await d.waitForTimeout(300);
    await d.locator('.summaryactions button:has-text("Continue")').click(); await d.waitForTimeout(300);
    ok('1 The designer has an address', (await st(d)).hash === '#sales/configure');
    await d.reload(); await d.waitForTimeout(2600);
    s = await d.evaluate(() => ({ page: S.page, step: S.step }));
    ok('1 Refreshing mid-sale picks the sale back up', s.page === 'configure' && s.step === 2, s);
    await d.close();
    const q = await open({}, L + '#sales/configure');
    ok('1 A designer link with no kept sale opens Start a sale', (await st(q)).page === 'start', await st(q));
    await q.close();
  }

  /* ---------- 2. Printing ---------- */
  {
    const p = await open();
    await p.evaluate(() => { window.print = () => {}; });
    const ink = async (name) => {
      await p.pdf({ path: T + name + '.pdf', format: 'Letter' });
      for (const f of fs.readdirSync(T)) if (f.startsWith(name + '-')) fs.unlinkSync(T + f);
      execSync(`pdftoppm -r 40 -png -f 1 -l 1 ${T}${name}.pdf ${T}${name}`);
      const f = fs.readdirSync(T).find((x) => x.startsWith(name + '-') && x.endsWith('.png'));
      return Number(execSync(`python3 -W ignore ${__dirname}/ink.py ${T}${f}`).toString().trim());
    };
    const sale = await p.evaluate(() => S.sales[0].id), load = await p.evaluate(() => { go('logi'); return LG.loads.find((l) => l.status !== 'cancelled' && lgLoadUnits ? true : true).id; });
    for (const [name, fn] of [['Office To do', "go('office')"], ['an Office order', `ofOpen('${sale}')`], ['the Production board', "go('prod')"], ['the Units list', "go('pr-list')"], ['Plant QC', "go('qc')"], ['a load', `lgOpen('${load}')`], ['the calendar', "go('lg-cal')"], ['Model pricing', "go('of-prices')"], ['Sales orders', "go('orders')"]]) {
      await p.evaluate(fn); await p.waitForTimeout(400);
      const v = await ink(name.replace(/\W/g, ''));
      ok(`2 ${name} prints with real content`, v > 1.5, v + '% ink');
      if (PIC && name === 'Office To do') execSync(`pdftoppm -r 110 -png -f 1 -l 1 ${T}OfficeTodo.pdf ${PIC}-print && mv ${PIC}-print-1.png ${PIC}-print.png`);
    }
    // bars, the guide and messages never print
    await p.evaluate(() => { try { ffSetOn(true); } catch (e) {} go('office'); toast('A message'); }); await p.waitForTimeout(300);
    await p.emulateMedia({ media: 'print' });
    const shown = await p.evaluate(() => ['.topbar', '.previewstrip', '.tabbar', '#toast', '#ff-root', '.as-first'].filter((s) => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none'; }));
    ok('2 Top bars, the tab bar, Firefly and messages do not print', shown.length === 0, shown);
    const anim = await p.evaluate(() => { const a = document.getElementById('app'); const cs = getComputedStyle(a); return [cs.animationName, cs.opacity]; });
    ok('2 The opening animation is off on paper', anim[0] === 'none' && anim[1] === '1', anim);
    await p.emulateMedia({ media: 'screen' }); await quiet(p);
    // the invoice, a quote and the run sheet keep printing
    await p.evaluate((id) => { S.activeSale = id; orderDoc('invoice'); }, sale); await p.waitForTimeout(300);
    await p.emulateMedia({ media: 'print' });
    ok('2 The invoice still prints', await p.evaluate(() => { const e = document.querySelector('.modal .od-paper'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 200; }));
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => closeModal());
    await p.evaluate((id) => { go('logi'); lgpRunSheetPrint(id); }, load); await p.waitForTimeout(300);
    await p.emulateMedia({ media: 'print' });
    const rs = await p.evaluate(() => { const box = document.getElementById('lgp-print'); return { shown: getComputedStyle(box).display !== 'none', text: box.innerText.length, app: getComputedStyle(document.getElementById('app')).display }; });
    ok('2 The run sheet still prints, alone', rs.shown && rs.text > 200 && rs.app === 'none', rs);
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => document.body.classList.remove('lgp-printing'));
    await p.close();
  }

  /* ---------- 3. Lighter first load ---------- */
  {
    const sizes = {};
    const p = await open({ noSw: true, watch: (pg) => pg.on('response', async (r) => { try { const u = new URL(r.url()); if (u.origin === new URL(L).origin) sizes[u.pathname.split('/').pop() || 'index'] = (await r.body()).length; } catch (e) {} }) });
    await p.waitForTimeout(1500);
    const total = Object.values(sizes).reduce((a, x) => a + x, 0);
    console.log('     biggest: ' + Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + Math.round(v / 1024)).join(', '));
    console.log('     first load: ' + Object.keys(sizes).length + ' files, ' + Math.round(total / 1024) + ' KB; shed-hero.webp ' + Math.round((sizes['shed-hero.webp'] || 0) / 1024) + ' KB');
    ok('3 The Home picture is the small WebP, not the 3 MB PNG', sizes['shed-hero.webp'] > 50000 && sizes['shed-hero.webp'] < 500000 && !('shed-hero.png' in sizes), sizes['shed-hero.webp']);
    const wire = await p.evaluate(() => { const r = performance.getEntriesByType('resource').concat(performance.getEntriesByType('navigation')).filter((e) => e.name.startsWith(location.origin)); return { files: r.length, kb: Math.round(r.reduce((t, e) => t + (e.transferSize || 0), 0) / 1024) }; });
    console.log('     over the wire: ' + wire.files + ' files, ' + wire.kb + ' KB');
    /* Unpacked sizes here; the old first load was 6,570 KB unpacked (4,663 KB over the wire), 3,131 KB of it the PNG. */
    ok('3 First load is about 2.8 MB lighter (under 4.1 MB unpacked, was 6.6 MB)', total < 4.1 * 1024 * 1024, Math.round(total / 1024) + ' KB');
    ok('3 The picture still shows on Home', await p.evaluate(() => { const i = document.querySelector('img.shed-hero:not(.hr-open):not(.hr-plan):not(.hr-model)') || document.querySelector('img.shed-hero'); return !!i && i.complete && i.naturalWidth > 1000; }));
    await p.close();
    const seen = [];
    const q = await open({ noSw: true, watch: (pg) => pg.on('request', (r) => seen.push(r.url())) }, L + '#office');
    ok('3 Opening the Office does not download the Sales picture', !seen.some((u) => /shed-hero\.(webp|png)/.test(u)) && (await st(q)).page === 'office', seen.filter((u) => /hero/.test(u)));
    await q.close();
  }

  /* ---------- 4. Pop-ups ---------- */
  {
    const p = await open();
    const openList = async () => { await p.evaluate(() => taPriceList()); await p.waitForTimeout(250); };
    const has = () => p.locator('.modal-back').count();
    await openList();
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok('4 Esc closes a pop-up', (await has()) === 0);
    await openList();
    await p.mouse.click(8, 500); await p.waitForTimeout(150);
    ok('4 A tap outside closes a pop-up', (await has()) === 0);
    await openList();
    await p.locator('.modal').click({ position: { x: 30, y: 120 } }); await p.waitForTimeout(150);
    ok('4 A tap inside does not close it', (await has()) === 1);
    const inside = [];
    for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); inside.push(await p.evaluate(() => !!document.activeElement.closest('.modal'))); }
    ok('4 Tab stays inside the pop-up (25 presses)', inside.every(Boolean), inside.filter((x) => !x).length + ' landed outside');
    await p.keyboard.press('Shift+Tab');
    ok('4 Shift+Tab stays inside too', await p.evaluate(() => !!document.activeElement.closest('.modal')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    // typed, unsaved input asks first
    await p.evaluate(() => { go('office'); ofOpen(S.sales[0].id); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = ofSale(OF.id); ofSiteForm(s.id); }); await p.waitForTimeout(250);
    await p.fill('#of-site-miles', '33');
    await p.mouse.click(8, 500); await p.waitForTimeout(200);
    const t1 = await p.locator('#toast').innerText().catch(() => '');
    ok('4 With something typed, the first tap outside keeps the pop-up and says why', (await has()) === 1 && /not saved/.test(t1), t1);
    await p.mouse.click(8, 500); await p.waitForTimeout(200);
    ok('4 …and a second tap closes it', (await has()) === 0);
    await p.evaluate(() => { const s = ofSale(OF.id); ofSiteForm(s.id); }); await p.waitForTimeout(250);
    await p.fill('#of-site-miles', '34');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok('4 Esc with something typed asks first', (await has()) === 1);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok('4 …and Esc again closes it', (await has()) === 0);
    await p.close();
    const ph = await open({ phone: true });
    await ph.evaluate(() => taPriceList()); await ph.waitForTimeout(300);
    const tall = await ph.evaluate(() => document.querySelector('.modal').scrollHeight);
    await ph.evaluate(() => { document.querySelector('.modal').scrollTop = 3000; }); await ph.waitForTimeout(300);
    const r = await ph.evaluate(() => { const c = [...document.querySelectorAll('.modal > .row:first-child button')].find((x) => /Close/.test(x.textContent)); const q = c.getBoundingClientRect(); const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return { y: q.y, bottom: q.bottom, onTop: top === c || c.contains(top) }; });
    ok('4 Phone: Close stays in view on a tall pop-up', tall > 3000 && r.y >= 0 && r.bottom < 844 && r.onTop, { tall, r });
    if (PIC) { await ph.waitForTimeout(4200); await ph.screenshot({ path: PIC + '-popup-phone.png' }); }
    await ph.locator('.modal > .row:first-child button:has-text("Close")').tap(); await ph.waitForTimeout(200);
    ok('4 Phone: the pinned Close works', (await ph.locator('.modal-back').count()) === 0);
    await ph.close();
  }

  /* ---------- 5. Logo and gear ---------- */
  {
    const p = await open();
    for (const [page, home] of [['lg-cal', 'logi'], ['of-pay', 'office'], ['pr-list', 'prod'], ['qc-report', 'qc'], ['orders', 'home']]) {
      await p.evaluate((x) => go(x), page); await p.waitForTimeout(200);
      await p.click('.topbar .brand'); await p.waitForTimeout(250);
      ok(`5 The logo on ${page} opens that side's first screen`, (await st(p)).page === home, await st(p));
    }
    await p.evaluate(() => go('lg-fleet')); await p.waitForTimeout(200);
    await p.click('#ad-gear'); await p.waitForTimeout(300);
    let text = await p.locator('#app').innerText();
    ok('5 The gear from Logistics offers a way back', (await st(p)).page === 'of-users' && /Back to Logistics/.test(text), text.slice(0, 80));
    await p.click('.as-back'); await p.waitForTimeout(300);
    ok('5 …and it goes back to the screen you were on', (await st(p)).page === 'lg-fleet', await st(p));
    await p.evaluate(() => go('office')); await p.click('#ad-gear'); await p.waitForTimeout(300);
    ok('5 From the Office the gear shows no back link', !(await p.locator('.as-back').count()));
    await p.close();
    const ph = await open({ phone: true });
    const g = await ph.evaluate(() => { const e = document.getElementById('ad-gear'); const r = e.getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none', w: r.width, right: r.right, sw: document.documentElement.scrollWidth }; });
    ok('5 Phone: the gear is in the top bar', g.shown && g.w > 20 && g.right <= 390 && g.sw <= 390, g);
    await ph.tap('#ad-gear'); await ph.waitForTimeout(300);
    ok('5 Phone: the gear opens Users', (await st(ph)).page === 'of-users');
    await ph.close();
  }

  /* ---------- 6. No yellow top-bar buttons ---------- */
  {
    for (const phone of [false, true]) {
      const p = await open({ phone }), tag = phone ? 'phone' : 'computer';
      const seen = [];
      for (const page of ['home', 'office', 'prod', 'qc', 'logi']) {
        await p.evaluate((x) => go(x), page); await p.waitForTimeout(200);
        const n = await p.evaluate(() => [...document.querySelectorAll('.topcta')].filter((e) => getComputedStyle(e).display !== 'none' && e.offsetParent !== null).length);
        if (n) seen.push(page);
      }
      ok(`6 No yellow button in the top bar on any side (${tag})`, seen.length === 0, seen);
      await p.evaluate(() => go('office')); await p.waitForTimeout(200);
      await p.locator('#app button:has-text("Review the next order"):visible').first().click(); await p.waitForTimeout(300);
      ok(`6 Office first screen still has "Review the next order" (${tag})`, (await st(p)).page === 'of-order');
      await p.evaluate(() => go('qc')); await p.waitForTimeout(200);
      await p.locator('#app button:has-text("Check the next building"):visible').first().click(); await p.waitForTimeout(300);
      ok(`6 Plant QC first screen still has "Check the next building" (${tag})`, (await st(p)).page === 'qc-inspect', await st(p));
      await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
      const before = await p.evaluate(() => LG.loads.length);
      await p.locator('#app button:has-text("Build a load"):visible').first().click(); await p.waitForTimeout(300);
      ok(`6 Logistics first screen still has "Build a load" (${tag})`, (await st(p)).page === 'lg-load' || (await p.evaluate(() => LG.loads.length)) > before || (await p.locator('.modal').count()) > 0, await st(p));
      if (PIC && !phone) { await p.evaluate(() => { closeModal(); go('logi'); }); await p.waitForTimeout(4300); await p.screenshot({ path: PIC + '-topbar.png', clip: { x: 0, y: 0, width: 1360, height: 420 } }); }
      await p.close();
    }
  }

  /* ---------- 7. Works without a signal ---------- */
  {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: PIC ? 2 : 1 });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2500);
    const ready = await p.evaluate(async () => { const reg = await navigator.serviceWorker.ready; for (let i = 0; i < 80 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 250)); const names = await caches.keys(); const n = names.length ? (await (await caches.open(names[0])).keys()).length : 0; return { active: !!reg.active, controlled: !!navigator.serviceWorker.controller, names, n }; });
    ok('7 The app stores a copy of itself on the device', ready.active && ready.controlled && ready.n > 40, ready);
    await p.evaluate(() => go('lg-cal')); await p.waitForTimeout(300);
    await ctx.setOffline(true);
    await p.reload().catch((e) => errs.push('offline reload: ' + e.message)); await p.waitForTimeout(2500);
    const off = await p.evaluate(() => ({ app: typeof S === 'object' ? S.page : 'NO APP', text: document.getElementById('app')?.innerText.length || 0, side: document.body.dataset.side })).catch(() => ({ app: 'NO PAGE' }));
    ok('7 With no signal, a refresh still opens the app on the same screen', off.app === 'lg-cal' && off.text > 200, off);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} go('home'); }); await p.waitForTimeout(600);
    const offHome = await p.evaluate(() => ({ text: document.getElementById('app').innerText.length, hero: (() => { const i = document.querySelector('img.shed-hero'); return !!i; })() }));
    ok('7 With no signal, moving between sides works', offHome.text > 200 && (await st(p)).side === 'sales', offHome);
    await p.evaluate(() => go('office')); await p.waitForTimeout(400);
    ok('7 …the Office opens with no signal', (await p.locator('#app').innerText()).length > 200);
    if (PIC) { await p.waitForTimeout(4200); await p.evaluate(() => { const n = document.createElement('div'); n.textContent = 'Network is OFF in this test browser'; n.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99;background:#0c1a28;color:#fff;padding:10px 16px;border-radius:10px;font:600 15px Inter,sans-serif'; document.body.appendChild(n); }); await p.screenshot({ path: PIC + '-offline.png', clip: { x: 0, y: 0, width: 1360, height: 760 } }); }
    await ctx.setOffline(false);
    // a new version replaces the kept one: index.html is always asked from the network first
    const strat = await p.evaluate(async () => { const t = await (await fetch('./sw.js', { cache: 'no-store' })).text(); return { pageFirst: /navigate/.test(t) && /fetch\(req\)/.test(t), versioned: /searchParams\.has\('v'\)/.test(t) }; });
    ok('7 The page itself is fetched fresh when there is a signal; versioned files come from the copy', strat.pageFirst && strat.versioned, strat);
    await ctx.close();
  }

  /* ---------- 8. Run sheet for a driver ---------- */
  {
    const p = await open();
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    const who = await p.evaluate(() => { go('logi'); const d = AD.users.find((u) => u.kind === 'driver' || /driver/i.test(u.title || '')); return d && { id: d.id, name: d.name, level: adAccess(d, 'logi') }; });
    ok('8 The sample people include a driver who is read-only in Logistics', !!who && who.level === 'read', who);
    await p.evaluate((id) => { adView(id); go('lg-drive'); }, who.id); await p.waitForTimeout(400);
    const load = await p.evaluate((name) => { const mine = LG.loads.filter((l) => l.driver === name || (lgRig(l.rig) || {}).driver === name); const l = mine.find((x) => lgLoadUnits(x).length) || LG.loads.find((x) => lgLoadUnits(x).length && x.status !== 'cancelled'); return l && l.id; }, who.name);
    await p.evaluate((id) => lgOpen(id), load); await p.waitForTimeout(400);
    ok('8 The driver is read-only on the load page', (await p.evaluate(() => document.body.dataset.adRead)) === '1');
    await p.locator('#app button:has-text("Run sheet"), #app button:has-text("Manifest")').first().click(); await p.waitForTimeout(400);
    const sheet = await p.locator('.modal').innerText().catch(() => '');
    ok('8 The driver can open the run sheet', /Run sheet/i.test(sheet) && /Stop|Back at/.test(sheet), sheet.slice(0, 120));
    await p.locator('.modal button:has-text("Print")').click(); await p.waitForTimeout(300);
    ok('8 …and print it', (await p.evaluate(() => window.__printed)) === 1);
    await p.evaluate(() => document.body.classList.remove('lgp-printing'));
    const emailBtn = p.locator('.modal button:has-text("Email it")');
    if (await emailBtn.count()) { await emailBtn.click(); await p.waitForTimeout(250); const t = await p.locator('#toast').innerText().catch(() => ''); ok('8 …but still cannot email it or change the load', /can look here but not change/.test(t), t); }
    await p.close();
  }

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 4));
  await b.close();
})();
