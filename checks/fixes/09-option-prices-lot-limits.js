// Office batch 2: option prices follow the published list; Turbo Assist's RTO terms; damage waiver line; lot limits everywhere.
// node fix09.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => { const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} if (typeof OP !== 'undefined') OP.setTab = 'all'; }); await p.waitForTimeout(400); return p; };
  const quiet = (p) => p.waitForTimeout(4300);

  /* ---------- 1. option prices ---------- */
  {
    const p = await open(), ev = (f, a) => p.evaluate(f, a);
    // a building with a window, a fiberglass side door and Basic electrical
    const build = () => ev(() => { begin('custom'); S.c.windows = 1; S.c.windowItems = [{ option: '2x3 Standard', type: 'Standard', shutters: false }]; S.c.electrical = 'Basic'; S.c.extraDoors = ['Fiberglass Door']; render(); return breakdown(S.c).map((r) => [r.name, r.amount]); });
    const find = (rows, re) => (rows.find((x) => re.test(x[0])) || [])[1];
    const publish = (changes, date) => ev(([changes, date]) => { go('of-prices'); for (const [d, v] of changes) adPrice(d, v, true); AD.tab = 'draft'; render(); if (date) document.getElementById('ad-when').value = date; OG.live = true; try { adPublish(); } finally { OG.live = false; } }, [changes, date]);
    let r = await build();
    ok('before: window $105, fiberglass door $325, Basic electrical $205', find(r, /2 × 3 ft Standard/) === 105 && find(r, /Fiberglass/) === 325 && find(r, /Basic electrical/) === 205, r);
    await publish([[{ kind: 'item', name: '2x3 window - White' }, 605], [{ kind: 'item', name: 'Solid Fiberglass Door Left Hand In Swing Short' }, 425], [{ kind: 'item', name: 'Basic Package' }, 705]]);
    r = await build();
    ok('published window price reaches a new quote ($605)', find(r, /2 × 3 ft Standard/) === 605, r);
    ok('published door price reaches a new quote ($425)', find(r, /Fiberglass/) === 425, r);
    ok('published electrical price reaches a new quote ($705)', find(r, /Basic electrical/) === 705, r);
    const total = r.reduce((t, x) => t + x[1], 0);
    ok('the designer’s total uses the new prices', await ev(() => amount()) === total, total);
    // the designer's own cards show the new price
    await ev(() => { go('configure'); goStep(steps.indexOf('Electrical')); }); await p.waitForTimeout(500);
    const card = await p.locator('#app').innerText();
    ok('the Electrical step shows $705 on the Basic package', /\$705/.test(card), card.match(/Basic[\s\S]{0,80}/)?.[0]);
    if (PIC) { // pricing page and the quote, side by side
      await ev(() => { S.expanded = true; refreshSummary(); }); await quiet(p);
      await p.screenshot({ path: PIC + '-quote-half.png', clip: { x: 680, y: 560, width: 680, height: 440 } });
      await ev(() => { S.expanded = false; go('of-prices'); AD.tab = 'items'; AD.q = 'window'; render(); }); await p.waitForTimeout(500);
      await ev(() => { const el = [...document.querySelectorAll('.ad-cell')].find((x) => /2x3 window - White/.test(x.textContent)); el.style.cssText += 'outline:4px solid #e11d48;outline-offset:3px;'; el.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
      await p.screenshot({ path: PIC + '-list-half.png', clip: { x: 0, y: 280, width: 680, height: 440 } });
      const fs = require('fs'), m = await b.newPage({ viewport: { width: 1370, height: 500 }, deviceScaleFactor: 2 });
      const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
      await m.setContent(`<body style="margin:0;font:600 18px system-ui;background:#0c1a28;color:#fff"><div style="display:flex;gap:10px"><div><div style="padding:14px 16px">Model pricing: 2x3 window published at $605</div><img src="${img(PIC + '-list-half.png')}" style="width:680px;height:440px;display:block"></div><div><div style="padding:14px 16px">Sales desk: the next quote charges $605</div><img src="${img(PIC + '-quote-half.png')}" style="width:680px;height:440px;display:block"></div></div></body>`);
      await m.screenshot({ path: PIC + '-option-price.png' }); await m.close();
      await ev(() => { AD.q = ''; });
    }
    // a quote already written keeps its prices: checked through a stored quote's items
    // rows the desk does not sell are marked
    await ev(() => { go('of-prices'); AD.tab = 'items'; AD.q = ''; render(); }); await p.waitForTimeout(300);
    const items = await p.locator('#app').innerText();
    ok('rows the desk does not sell say so', /Not sold on the Sales desk yet/.test(items) && /charges the White window price/.test(items));
    const marked = await ev(() => [...document.querySelectorAll('.ad-cell')].filter((x) => /Not sold on the Sales desk yet/.test(x.textContent)).map((x) => x.textContent.slice(0, 40)));
    ok('a sold row (Basic Package, 2x3 white window, 6x7 Roll Up) is not marked', !marked.some((x) => /^Basic Package|^2x3 window - White|^6x7 Roll Up/.test(x)), marked.slice(0, 5));
    ok('the page names the desk options that are not on the list', /Workshop electrical package/.test(items));
    // a lot's own price on an option
    await publish([[{ kind: 'lot', lot: 'statesboro', model: 'item', size: '2x3 window - White' }, 150]]);
    r = await build();
    ok('another lot’s own window price does not change this desk ($605 still)', find(r, /2 × 3 ft Standard/) === 605, r);
    await publish([[{ kind: 'lot', lot: 'moncks-corner', model: 'item', size: '2x3 window - White' }, 99]]);
    r = await build();
    ok('this lot’s own window price wins at this desk ($99)', find(r, /2 × 3 ft Standard/) === 99, r);
    ok('the office prices another lot’s order with that lot’s price', await ev(() => { AD.lotCtx = 'statesboro'; plSync(); const v = windowCatalog['2x3 Standard'][1]; AD.lotCtx = null; plSync(); return v; }) === 150);
    await ev(() => { go('of-prices'); AD.tab = 'lot'; AD.lot = 'moncks-corner'; AD.lotItemsOpen = true; render(); }); await p.waitForTimeout(300);
    const lotTab = await p.locator('#app').innerText();
    ok('the Lot prices tab lists the lot’s own option price', /Options and packages at Moncks Corner/.test(lotTab) && /2x3 window - White[\s\S]{0,30}\$99/i.test(lotTab), lotTab.match(/has its own price[^\n]*/)?.[0]);
    // undo the newest publish puts the lot price back
    await ev(() => { AD.tab = 'draft'; render(); }); await p.waitForTimeout(200);
    const undo = p.locator('button:has-text("Undo this publish")').first();
    if (await undo.count()) { await undo.click(); await p.waitForTimeout(300); const go2 = p.locator('.modal button', { hasText: /Undo|Put/ }).first(); if (await go2.count()) await go2.click(); await p.waitForTimeout(300); }
    r = await build();
    ok('"Undo this publish" takes the lot’s option price off again ($605)', find(r, /2 × 3 ft Standard/) === 605, r);
    // a price set to go live on a later date
    const later = await ev(() => { const d = new Date(Date.now() + 5 * 864e5); return d.toLocaleDateString('en-CA'); });
    await publish([[{ kind: 'item', name: 'Expanded Package' }, 999]], later);
    ok('a future-dated option price is waiting, not live', await ev(() => AD.sched.length === 1 && electricalPrices.Expanded) === 305);
    await ev(() => adGoLive(AD.sched[0].id)); await p.waitForTimeout(200);
    ok('when its day comes the Sales desk charges it ($999)', await ev(() => { plSync(); return electricalPrices.Expanded; }) === 999);
    // the Garage Package through the list
    const garage = async (size) => ev((size) => { begin('custom'); change('size', size); change('package', 'Garage Package'); return breakdown(S.c).map((r) => [r.name, r.amount]); }, size);
    r = await garage('10x16');
    ok('Garage Package on a 10-wide: $1,280, 6 × 7 +$730, 8 × 7 credit −$850, 7 ft wall at no charge', find(r, /8 × 7 Garage Package/) === 1280 && find(r, /^6 × 7 Rollup Door$/) === 730 && find(r, /Credit/) === -850 && find(r, /7 ft sidewalls/) == null, r);
    await publish([[{ kind: 'item', name: '8x7 Rollup Garage Package' }, 1300], [{ kind: 'item', name: '6x7 Roll Up' }, 750], [{ kind: 'item', name: '8x7 Roll Up' }, 870], [{ kind: 'item', name: '9x7 Rollup Garage Package' }, 1400]]);
    r = await garage('10x16');
    ok('…and those four amounts follow the published list', find(r, /8 × 7 Garage Package/) === 1300 && find(r, /^6 × 7 Rollup Door$/) === 750 && find(r, /Credit/) === -870, r);
    r = await ev(() => { begin('custom'); change('size', '12x16'); change('package', 'Garage Package'); change('garageDoorWidth', 9); return breakdown(S.c).map((r) => [r.name, r.amount]); });
    ok('9 × 7 Garage Package follows the list ($1,400)', find(r, /9 × 7 Garage Package/) === 1400, r);
    // the price sheet takes a lot name on an option row
    const sheet = await ev(() => adSheetLoad('product_line,width_ft,length_ft,msrp,new_msrp,lot,notes\nBasic Package,,,705,715,Florence,\n'));
    ok('the price sheet reads an option row for one lot', sheet.read === 1 && sheet.bad.length === 0 && await ev(() => AD.draft.some((d) => d.kind === 'lot' && d.lot === 'florence' && d.size === 'Basic Package' && d.new === 715)), sheet);
    await ev(() => { AD.draft = []; });
    await p.close();
  }

  /* ---------- 2. rent-to-own terms ---------- */
  {
    const p = await open(), ev = (f, a) => p.evaluate(f, a);
    const t = await ev(() => TA.rto.terms.map((x) => [x.months, x.divisor, x.down, x.epo]));
    ok('terms are Turbo Assist’s: 24/16.8/2, 36/25.2/3, 48/33.6/4', JSON.stringify(t.slice(0, 3)) === JSON.stringify([[24, 16.8, 2, 0.62], [36, 25.2, 3, 0.58], [48, 33.6, 4, 0.55]]), t);
    ok('60 months follows the same rule (42, 5 down)', t[3][1] === 42 && t[3][2] === 5, t[3]);
    ok('the Sales desk payment uses them ($6,018 at 36 months = $238.81)', await ev(() => payment(6018, 36)) === 238.81, await ev(() => payment(6018, 36)));
    await ev(() => { go('of-settings'); }); await p.waitForTimeout(500);
    const card = await p.locator('.to-wide', { hasText: 'Rent-to-own terms' }).innerText();
    ok('the card uses plain words, not Divisor / Down Type / Balloon Pmts', /Divide the price by/.test(card) && /Money down is/.test(card) && /One big last payment/.test(card) && !/Divisor|Down Type|Down Value|Balloon/.test(card), card.match(/Divisor|Down Type|Down Value|Balloon[^\n]*/)?.[0]);
    ok('the card says where the numbers come from', /copied from Turbo Assist/.test(card) && !/public lot listing/.test(card));
    ok('every line of the comparison table says Same', (card.match(/\bSame\b/g) || []).length >= 3 && !/\d here/.test(card.split('side by side')[1].split('60')[0]), card.split('side by side')[1]?.slice(0, 300));
    if (PIC) { await quiet(p); const box = await p.locator('.to-wide', { hasText: 'Rent-to-own terms' }).boundingBox(); await p.evaluate((y) => window.scrollTo(0, y - 80), box.y + (await p.evaluate(() => scrollY))); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-rto-terms.png', clip: { x: 20, y: 70, width: 1320, height: 860 } }); }
    await p.close();
  }

  /* ---------- 3. damage waiver ---------- */
  {
    const p = await open(), ev = (f, a) => p.evaluate(f, a);
    const id = await ev(() => S.sales.find((s) => s.invoice && s.invoice.waiver != null)?.id);
    await ev((id) => ofOpen(id), id); await p.waitForTimeout(500);
    const money = await p.locator('.panel', { hasText: 'Cash price of the building' }).first().innerText();
    const num = (re) => Number((money.match(re) || [])[1]?.replace(/,/g, ''));
    const monthly = num(/Monthly payment, before tax\s*\$([\d,.]+)/), tax = num(/Sales tax, monthly[^\n$]*\s*\$([\d,.]+)/), waiver = num(/Damage waiver, each month\s*\$([\d,.]+)/), first = num(/First payment: monthly payment, tax and waiver\s*\$([\d,.]+)/);
    ok('the Money box shows the $9.99 damage waiver', waiver === 9.99, money);
    ok('monthly + tax + waiver equals the first payment shown', Math.abs(monthly + tax + waiver - first) < 0.005 && first === 605.84, { monthly, tax, waiver, first });
    if (PIC) { await quiet(p); await p.locator('.panel', { hasText: 'Cash price of the building' }).first().scrollIntoViewIfNeeded(); await ev(() => window.scrollBy(0, -100)); await p.waitForTimeout(300); const box = await p.locator('.panel', { hasText: 'Cash price of the building' }).first().boundingBox(); await p.screenshot({ path: PIC + '-waiver.png', clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(box.width + 20, 1100), height: Math.min(box.height + 20, 1000 - Math.max(0, box.y - 10)) } }); }
    await p.close();
  }

  /* ---------- 4. lot limits everywhere ---------- */
  {
    const p = await open(), ev = (f, a) => p.evaluate(f, a);
    // records at this desk's lot (Moncks Corner) and at another lot
    await ev(() => {
      S.stock.push({ id: 'STOCK-91', name: '10x12 Basic Utility', total: 4000, stage: 0, status: 'Pending', date: new Date().toISOString(), location: 'Moncks Corner', evidence: [], c: JSON.parse(JSON.stringify(defaults)) });
      S.stock.push({ id: 'STOCK-92', name: '12x16 Basic Lofted', total: 6000, stage: 0, status: 'Pending', date: new Date().toISOString(), location: 'Statesboro', evidence: [], c: JSON.parse(JSON.stringify(defaults)) });
      TO.returns.unshift({ kind: 'returned', serial: 'ORB-09901', at: Date.now(), what: '10x16 Utility', where: 'Moncks Corner, SC', title: '', note: '', job: false });
      TO.returns.unshift({ kind: 'returned', serial: 'ORB-09902', at: Date.now(), what: '10x16 Utility', where: 'Statesboro, GA', title: '', note: '', job: false });
    });
    const sample = await ev(() => { const s = S.sales[0]; return { id: s.id, lot: saleLot(s).id }; });
    await ev((sid) => { taNotify({ to: 'office', title: 'Notice for another lot', body: 'x', saleId: sid, at: Date.now() }); taNotify({ to: 'office', title: 'Notice for everyone', body: 'x', at: Date.now() }); }, sample.id);
    const all = await ev(() => { adView('u1'); go('of-requests'); return document.getElementById('app').innerText; });
    ok('super user sees both stock orders in Requests', /STOCK-91/.test(all) && /STOCK-92/.test(all), all.slice(0, 200));
    // an office person limited to Statesboro and Vidalia
    await ev(() => { const u = adUser('u8'); u.lots = ['statesboro', 'vidalia']; adView('u8'); go('of-requests'); }); await p.waitForTimeout(400);
    let t = await p.locator('#app').innerText();
    ok('limited person: Requests shows only their lots’ stock orders', /STOCK-92/.test(t) && !/STOCK-91/.test(t), t.match(/STOCK-\d+/g));
    ok('limited person: the heading says "my 2 lots", not all 22', /my 2 lots/i.test(t) && !/all 22 lots/i.test(t), t.slice(0, 120));
    const co = await ev(() => S.changes.filter((c) => !c.declined && c.done >= 1 && c.done <= 2).map((c) => c.id));
    ok('limited person: other lots’ change orders are hidden', !co.some((id) => new RegExp(id + '\\b').test(t)) || co.length === 0, { co, shown: t.match(/CO-\d+/g) });
    await ev(() => go('office')); await p.waitForTimeout(400);
    t = await p.locator('#app').innerText();
    ok('limited person: To do hides the other lot’s stock order too', !/STOCK-91/.test(t), t.match(/STOCK-\d+/g));
    const opts = await ev(() => [...document.querySelectorAll('.ops-select select option')].map((o) => o.textContent));
    ok('limited person: the lot picker offers only their lots', opts.length === 3 && /My 2 lots/.test(opts[0]) && opts.slice(1).every((o) => /Statesboro|Vidalia/.test(o)), opts);
    if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-lot-limit-office.png', clip: { x: 0, y: 150, width: 1360, height: 560 } }); }
    await ev(() => go('of-orders')); await p.waitForTimeout(300);
    const ret = await ev(() => { go('of-payments'); return null; });
    const pages = await ev(() => { const out = {}; for (const pg of Object.keys(OPS_SCREENS).filter((k) => k.startsWith('of'))) { try { out[pg] = /ORB-0990[12]/.test(OPS_SCREENS[pg]() || '') ? (OPS_SCREENS[pg]().match(/ORB-0990\d/g) || []).join(',') : ''; } catch (e) { out[pg] = ''; } } return out; });
    const shown = Object.values(pages).filter(Boolean).join(',');
    ok('limited person: returns list shows only their lots', /ORB-09902/.test(shown) && !/ORB-09901/.test(shown), pages);
    const bell = await ev(() => taNoticesFor('office').map((n) => n.title));
    ok('limited person: the bell drops a notice tied to another lot’s order, keeps a general one', (sample.lot === 'statesboro' || sample.lot === 'vidalia' || !bell.includes('Notice for another lot')) && bell.includes('Notice for everyone'), { bell, sample });
    // Plant QC
    const qcAll = await ev(() => { adView('u1'); go('qc'); return Q.builds.map((b) => [b.serial, b.dealer]); });
    const towns = [...new Set(qcAll.map((x) => x[1].replace('Bennett Buildings of ', '')))];
    await ev(() => { const u = adUser('u10'); u.lots = ['statesboro']; adView('u10'); go('qc'); }); await p.waitForTimeout(500);
    const qcText = await p.locator('#app').innerText();
    const mineQc = qcAll.filter((x) => /Statesboro/.test(x[1])).map((x) => x[0]), otherQc = qcAll.filter((x) => !/Statesboro/.test(x[1])).map((x) => x[0]);
    ok('Plant QC, limited to Statesboro: no other lot’s buildings are listed', otherQc.length > 0 && !otherQc.some((s) => qcText.includes(s)), { towns, shown: (qcText.match(/SAMPLE-[\d-]+/g) || []).slice(0, 6) });
    ok('Plant QC, limited to Statesboro: their own buildings (if any) are listed', mineQc.every((s) => qcText.includes(s)), mineQc);
    await ev(() => { adUser('u10').lots = ['moncks-corner']; go('qc'); }); await p.waitForTimeout(500);
    const qc2 = await p.locator('#app').innerText(), mc = qcAll.filter((x) => /Moncks Corner$/.test(x[1])).map((x) => x[0]);
    ok('Plant QC, limited to Moncks Corner: sees that lot’s buildings and not the rest', mc.length > 0 && mc.some((s) => qc2.includes(s)) && !qcAll.filter((x) => !/Moncks Corner$/.test(x[1])).some((x) => qc2.includes(x[0])), { mc: mc.length, all: qcAll.length });
    if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-lot-limit-qc.png', clip: { x: 0, y: 150, width: 1360, height: 700 } }); }
    ok('after the screens are drawn the full lists are untouched', await ev(() => Q.builds.length) === qcAll.length && await ev(() => S.stock.length) >= 2);
    await ev(() => { adUser('u10').lots = ['plant:orangeburg']; go('qc'); }); await p.waitForTimeout(300);
    ok('a person given the plant sees every building it builds', (await ev(() => QC_SCREENS.qc())).split('qc-card').length > 3);
    // read-only on Production and Plant QC cannot change anything
    await ev(() => { const u = adUser('u10'); u.access = { qc: 'read', prod: 'read' }; adView('u10'); go('qc'); }); await p.waitForTimeout(400);
    const snap = () => ev(() => JSON.stringify(Q.builds) + Q.log.length + JSON.stringify(Q.rework));
    const before = await snap();
    await p.locator('#app button', { hasText: /Start QC check|Keep checking/ }).first().click(); await p.waitForTimeout(400);
    for (const name of ['Yes', 'No', 'N/A']) { const x = p.locator('#app button', { hasText: new RegExp('^' + name + '$') }).first(); if (await x.count()) { await x.click({ force: true }).catch(() => {}); await p.waitForTimeout(120); } }
    ok('read-only on Plant QC: a building opens to look at, but Yes / No / N/A change nothing', await ev(() => S.page) === 'qc-inspect' && (await snap()) === before);
    await ev(() => go('prod')); await p.waitForTimeout(400);
    const prBefore = await ev(() => JSON.stringify(prUnits().map((u) => [u.id, u.phase])) + JSON.stringify(PR.loads) + JSON.stringify(PR.holds));
    for (const name of ['Put on hold', 'New load', 'Close this load', 'Send to the floor']) { const x = p.locator('#app button', { hasText: name }).first(); if (await x.count()) { await x.click({ force: true }).catch(() => {}); await p.waitForTimeout(150); await ev(() => closeModal()); } }
    ok('read-only on Production: hold, new load, close and send do nothing', await ev(() => JSON.stringify(prUnits().map((u) => [u.id, u.phase])) + JSON.stringify(PR.loads) + JSON.stringify(PR.holds)) === prBefore);
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
