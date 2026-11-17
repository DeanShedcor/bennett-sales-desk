// turbo-logi-test.js: every new Logistics control from turbo-logi.js, with PASS / FAIL lines.
// Run: node turbo-logi-test.js [url]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await p.goto(URL);
  /* Logistics batch 1 (fix13.js covers it): this older suite reads Turbo Logistics' own words and skips the ask-first steps. */
  await p.waitForFunction(() => typeof PP !== 'undefined' && typeof OG !== 'undefined'); await p.evaluate(() => { PP.raw = true; OG.live = true; });
  await p.waitForTimeout(1500);
  let fails = 0, passes = 0;
  const ok = (name, cond, detail = '') => { cond ? passes++ : fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? '\n      got: ' + String(detail).slice(0, 600) : ''}`); };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const toast = () => ev(() => document.getElementById('toast').textContent);
  const wait = (ms = 200) => p.waitForTimeout(ms);
  const lastNotice = (to) => ev((to) => { const n = taNoticesFor(to)[0]; return n ? { title: n.title, body: n.body, go: n.go || '' } : null; }, to);
  const sec = (t) => console.log('\n== ' + t);

  // ---------------------------------------------------------------- seeds
  sec('Seeded notices');
  const seedSales = await ev(() => taNoticesFor('sales').filter((n) => /SAMPLE-1016-2080/.test(n.title)).map((n) => [n.title, n.body]));
  ok('Sales bell holds the three sample delivery notices', seedSales.length === 3, JSON.stringify(seedSales));
  ok('  delivered wording is Turbo Logistics’ own', seedSales.some(([t, x]) => t === 'Delivery completed — SAMPLE-1016-2080' && x === 'Delivery for SAMPLE-1016-2080 is marked delivered. Confirm with your customer and close the loop on any remaining paperwork.'), JSON.stringify(seedSales));
  const seedLogi = await ev(() => taNoticesFor('logi').map((n) => n.title));
  ok('Logistics bell holds sample notices', seedLogi.length >= 3, JSON.stringify(seedLogi));
  ok('No "Ready to load" notice fires just from opening the page', !seedLogi.some((t) => /^Ready to load/.test(t)), JSON.stringify(seedLogi));
  ok('The sample delivery H10 is delivered and off the board', await ev(() => lgLoad('H10')?.state === 'delivered' && !lgUnit('SAMPLE-1016-2080').leg));

  // ---------------------------------------------------------------- notices, one run for each "who tells the customer" setting
  sec('Notices to the Sales desk');
  await ev(() => go('logi'));
  const mkHome = (n, opts = {}) => ev(({ n, opts }) => {
    const now = Date.now(), id = 'TEST-1012-90' + n;
    lgAddUnit({ id, name: '10x12 Basic Utility', size: '10x12', kind: 'order', customer: 'Test Buyer ' + n, lotId: opts.lot || DESK_LOT, plantId: PLANTS[0].id, leg: 'lot-home', at: 'lot', sample: true, readyAt: now, soldAt: now, inStock: true,
      site: { miles: 10, access: 'Clear access', gate: '', noGate: true, ground: 'Level', notes: '', askedBy: 'Salesperson', askedAt: now, confirmed: now } });
    lgNewHome(id);
    const load = lgLoad(LG.loadId), lot = lotById(opts.lot || DESK_LOT);
    let d = lgAddDays(lgToday(), 1 + Number(n));
    while (!lotDay(lot, d).open) d = lgAddDays(d, 1);
    lgSet(load.id, 'rigId', 'rig-4'); lgSet(load.id, 'date', d); lgSet(load.id, 'window', 'Morning');
    return { id, load: load.id, day: d };
  }, { n, opts });
  const eta = (load) => ev((l) => lgxWhen(lgLoad(l)), load);
  const nextOpen = (load, from) => ev(({ load, from }) => { let d = lgAddDays(from, 1); while (!lotDay(lotById(lgLoad(load).from.id), d).open) d = lgAddDays(d, 1); return d; }, { load, from });

  // A. Logistics tells the customer (how it works today)
  await ev(() => { LG.set.tell = 'logistics'; lotById(DESK_LOT).managerSchedules = false; });
  const A = await mkHome(1);
  const before = await ev(() => taNoticesFor('sales').length);
  await ev((l) => lgSchedule(l), A.load); await wait();
  let n = await lastNotice('sales'), e = await eta(A.load);
  ok('A scheduled: title', n.title === `Delivery scheduled — ${A.id}`, n.title);
  ok('A scheduled: body, Logistics tells the customer', n.body === `A delivery for ${A.id} has been scheduled. Window: ${e}. Driver: Nia Foster. Logistics tells the customer the day.`, n.body);
  ok('A scheduled: exactly one new notice', (await ev(() => taNoticesFor('sales').length)) === before + 1);
  await ev((id) => lgTold(id), A.id);
  ok('A customer told, run can start', await ev((l) => lgBlocked(lgLoad(l)).length === 0, A.load), await ev((l) => JSON.stringify(lgBlocked(lgLoad(l))), A.load));
  const A2 = await nextOpen(A.load, A.day);
  await ev(({ l, d }) => lgSet(l, 'date', d), { l: A.load, d: A2 }); await wait();
  n = await lastNotice('sales'); e = await eta(A.load);
  ok('A day changed: ETA title', n.title === `Delivery ETA updated — ${A.id}`, n.title);
  ok('A day changed: ETA body', n.body === `The delivery window for ${A.id} changed to ${e}. Driver: Nia Foster. Logistics tells the customer the new day.`, n.body);
  ok('A day changed: the customer has to be told again', await ev((id) => !lgToldOf(lgUnit(id)), A.id));
  ok('A day changed: the load is blocked until they are told', await ev((l) => lgBlocked(lgLoad(l)).some((c) => /tell the customer the day/.test(c.text)), A.load));
  await ev(({ l }) => lgSet(l, 'window', 'Afternoon'), { l: A.load }); await wait();
  n = await lastNotice('sales');
  ok('A time of day changed: another ETA notice with the new time', n.title === `Delivery ETA updated — ${A.id}` && / · Afternoon\./.test(n.body), n.body);
  await ev((id) => lgTold(id), A.id);
  await ev((l) => lgStart(l), A.load); await wait();
  n = await lastNotice('sales'); e = await eta(A.load);
  ok('A started: in transit title and body', n.title === `Delivery in transit — ${A.id}` && n.body === `The truck for ${A.id} is now in transit. ETA: ${e}. Driver: Nia Foster. Update your customer with the ETA when they ask.`, n.title + ' :: ' + n.body);
  await ev((l) => { lgArrive(l, 0); lgDropDone(l, 0, { by: 'Test Buyer 1', note: '', photo: '' }); render(); }, A.load); await wait();
  n = await lastNotice('sales');
  ok('A delivered: title and body', n.title === `Delivery completed — ${A.id}` && n.body === `Delivery for ${A.id} is marked delivered. Confirm with your customer and close the loop on any remaining paperwork.`, n.title + ' :: ' + n.body);
  const ln = await lastNotice('logi');
  ok('A delivered: the Logistics bell hears the driver finished', /^Delivered to Test Buyer 1 — Delivery H\d+$/.test(ln.title) && /Every stop is done\.$/.test(ln.body), ln.title + ' :: ' + ln.body);

  // B. The lot's manager tells the customer: Turbo Logistics' own last sentence
  await ev(() => { LG.set.tell = 'logistics'; lotById(DESK_LOT).managerSchedules = true; });
  const B = await mkHome(2);
  await ev((l) => lgSchedule(l), B.load); await wait();
  n = await lastNotice('sales'); e = await eta(B.load);
  ok('B manager lot scheduled: Turbo’s relay sentence word for word', n.body === `A delivery for ${B.id} has been scheduled. Window: ${e}. Driver: Nia Foster. Relay the schedule to your customer — do not expect an automatic customer text.`, n.body);
  const B2 = await nextOpen(B.load, B.day);
  await ev(({ l, d }) => lgSet(l, 'date', d), { l: B.load, d: B2 }); await wait();
  n = await lastNotice('sales'); e = await eta(B.load);
  ok('B manager lot day changed: relay the updated ETA', n.body === `The delivery window for ${B.id} changed to ${e}. Driver: Nia Foster. Relay the updated ETA to your customer.`, n.body);
  await ev(() => { lotById(DESK_LOT).managerSchedules = false; });

  // C. Automatic text and email
  await ev(() => { LG.set.tell = 'auto'; });
  const C = await mkHome(3);
  await ev((l) => lgSchedule(l), C.load); await wait();
  n = await lastNotice('sales'); e = await eta(C.load);
  ok('C automatic scheduled: the customer got a text and email', n.body === `A delivery for ${C.id} has been scheduled. Window: ${e}. Driver: Nia Foster. The customer got the day by text and email.`, n.body);
  const C2 = await nextOpen(C.load, C.day);
  await ev(({ l, d }) => lgSet(l, 'date', d), { l: C.load, d: C2 }); await wait();
  n = await lastNotice('sales'); e = await eta(C.load);
  ok('C automatic day changed: new day went by text and email', n.body === `The delivery window for ${C.id} changed to ${e}. Driver: Nia Foster. The customer got the new day by text and email.`, n.body);
  ok('C automatic day changed: still counted as told', await ev((id) => lgToldOf(lgUnit(id)), C.id));
  await ev((l) => lgStart(l), C.load); await wait();
  n = await lastNotice('sales');
  ok('C automatic started: the customer gets a text when the driver is on the way', / The customer gets a text when the driver is on the way\.$/.test(n.body), n.body);
  await ev(() => { LG.set.tell = 'logistics'; });

  // D. Another lot's sample customer does not reach this desk
  const cnt = await ev(() => taNoticesFor('sales').length);
  const D = await mkHome(4, { lot: 'florence' });
  await ev((l) => lgSchedule(l), D.load); await wait();
  ok('D another lot’s customer: no notice on this desk', (await ev(() => taNoticesFor('sales').length)) === cnt);

  // E. A customer's building reaches the lot on a plant haul
  const E = await ev(() => {
    const id = 'TEST-1012-9005', now = Date.now();
    lgAddUnit({ id, name: '10x12 Basic Utility', size: '10x12', kind: 'order', customer: 'Test Buyer 5', lotId: DESK_LOT, plantId: PLANTS[0].id, leg: 'plant-lot', at: 'plant', sample: true, readyAt: now, soldAt: now });
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [id]);
    let d = lgAddDays(lgToday(), 1);
    while (!lotDay(lotById(DESK_LOT), d).open) d = lgAddDays(d, 1);
    Object.assign(load, { rigId: 'rig-1', driver: 'Marcus Bell', date: d });
    lgSchedule(load.id); lgStart(load.id); lgArrive(load.id, 0); lgDropDone(load.id, 0, { by: 'Lot Staff', note: '', photo: '' }); render();
    return { id, load: load.id, state: load.state };
  });
  n = await lastNotice('sales');
  ok('E lot leg: "At the lot" notice', n.title === `At the lot — ${E.id}` && /is at the Moncks Corner lot, received by Lot Staff\. It is ready for home delivery\.$/.test(n.body), n.title + ' :: ' + n.body);
  ok('E lot leg: no "delivery scheduled" for the ride to the lot', !(await ev((id) => taNoticesFor('sales').some((x) => x.title === 'Delivery scheduled — ' + id), E.id)));

  // ---------------------------------------------------------------- manifest
  sec('Manifest');
  await ev(() => lgOpen('AD')); await wait();
  ok('Manifest button on the load page', (await p.locator('.lgx-record button:has-text("Manifest")').count()) === 1);
  await p.click('.lgx-record button:has-text("Manifest")'); await wait();
  let lines = (await p.textContent('#lgx-manifest')).split('\n');
  const expect1 = ['DELIVERY ROUTE MANIFEST', null, 'Route: AD · building 1 of 2', 'Unit: SAMPLE-1220-2103', 'State: planned', 'Capacity: 20 linear ft', '', 'STOPS (in order):', '1. plant origin — 3145 Magnolia St, Orangeburg, SC 29115', '2. dealer holding — 934 E Highway 501, Conway, SC 29526', '   Contact: Bennett Buildings of Conway', '   Phone: 843-331-3408'];
  ok('Manifest, building 1, line for line', expect1.every((x, i) => (x === null ? /^Generated: \d{4}-\d\d-\d\dT[\d:.]+Z$/.test(lines[i]) : lines[i] === x)), JSON.stringify(lines.slice(0, 13)));
  const second = lines.slice(lines.indexOf('-'.repeat(44)) + 2);
  ok('Manifest, building 2: customer stop prints "Address on file", contact and site notes', second[2] === 'Route: AD · building 2 of 2' && second.includes('2. end customer — Address on file') && second.includes('   Contact: Jesse Tatum') && second.includes('   Notes: Clear access · no gate · Level'), JSON.stringify(second));
  await ev(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await p.click('.modal button:has-text("Print")'); await wait(100);
  ok('Print: the page holds only the manifest text for printing', (await ev(() => window.__printed === 1 && document.body.classList.contains('lgx-printing') && document.getElementById('lgx-print').textContent.startsWith('DELIVERY ROUTE MANIFEST'))));
  await ev(() => dispatchEvent(new Event('afterprint')));
  ok('Print: the page comes back afterwards', await ev(() => !document.body.classList.contains('lgx-printing')));
  await p.click('.modal button:has-text("Email manifest")'); await wait();
  ok('Email manifest: Turbo’s form', (await p.textContent('.modal h2')) === 'Email route manifest' && /Sends a PDF snapshot \(stops, contacts, notes\) to the hauler\. Paper-trail fallback when they won’t use a login\./.test(await p.textContent('.modal')) && (await p.getAttribute('#lgx-mail', 'placeholder')) === 'dispatcher@hauler.example');
  await p.fill('#lgx-mail', 'not-an-email'); await p.click('.modal button:has-text("Send email")'); await wait(100);
  ok('Email manifest: a bad address is refused', (await toast()) === 'Type a valid email address.' && (await p.locator('.modal').count()) === 1, await toast());
  await p.fill('#lgx-mail', 'dispatcher@hauler.example'); await p.click('.modal button:has-text("Send email")'); await wait();
  ok('Email manifest: "Manifest emailed to …", and it is on the load’s history', /^Manifest emailed to dispatcher@hauler\.example\./.test(await toast()) && (await ev(() => lgLoad('AD').log.some((x) => /Manifest emailed to dispatcher@hauler\.example/.test(x.text)))), await toast());
  // with a trailer, a day, a driver and a permit
  await p.selectOption('.lg-setup select >> nth=0', 'rig-3'); await wait(100);
  const adDay = await ev(() => { let d = lgAddDays(lgToday(), 2); while (!lotDay(lotById('conway'), d).open) d = lgAddDays(d, 1); return d; });
  await p.fill('.lg-setup input[type=date]', adDay); await p.dispatchEvent('.lg-setup input[type=date]', 'change'); await wait(100);
  await p.selectOption('.lg-setup select >> nth=1', 'Morning'); await wait(100);

  // ---------------------------------------------------------------- permit
  sec('Permit');
  ok('Not flagged: no badge, button says "Flag permit required"', (await p.locator('.lgx-badge').count()) === 0 && (await p.locator('.lgx-permit button').textContent()) === 'Flag permit required');
  await p.click('.lgx-permit button'); await wait();
  ok('Flagged: badge "Permit required", button says "Clear permit flag"', (await p.textContent('.lgx-badge')) === 'Permit required' && (await p.locator('.lgx-permit button').textContent()) === 'Clear permit flag');
  ok('Flagged without a wide building: a warning asks to confirm the permit', await ev(() => lgChecks(lgLoad('AD')).some((c) => c.level === 'warn' && /^Permit required is flagged/.test(c.text))));
  await p.fill('.lgx-record input[placeholder^="Example: SC oversize"]', 'SC oversize permit, escort from the state line'); await p.dispatchEvent('.lgx-record input[placeholder^="Example: SC oversize"]', 'change'); await wait();
  await p.check('.lgx-record .lg-permit input'); await wait();
  ok('Permit confirmed: the warning is gone', await ev(() => !lgChecks(lgLoad('AD')).some((c) => /^Permit required is flagged/.test(c.text)) && lgLoad('AD').permit === true));
  await p.click('.lgx-record button:has-text("Manifest")'); await wait();
  lines = (await p.textContent('#lgx-manifest')).split('\n');
  ok('Manifest now carries carrier, day, driver, rig and the permit', ['Carrier: Bennett drivers', `Scheduled: ${await eta('AD')}`, 'Driver: Theo Grant', 'Rig: Trailer 3', 'Permits: permit required; SC oversize permit, escort from the state line'].every((x) => lines.includes(x)) && /· Morning$/.test(await eta('AD')), JSON.stringify(lines.slice(0, 12)));
  await ev(() => closeModal());
  await p.click('.lgx-permit button'); await wait();
  ok('Cleared: badge gone', (await p.locator('.lgx-badge').count()) === 0 && (await ev(() => lgLoad('AD').permitReq === false)));
  // the wide-load tick that was already there still works by itself
  const W = await ev(() => { const l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ['SAMPLE-1424-2108']); lgOpen(l.id); return l.id; }); await wait();
  ok('Wide load: the earlier warning is unchanged', await ev((l) => lgChecks(lgLoad(l)).some((c) => /14 ft wide or wider: confirm the permit and escort, then tick “Permit confirmed”\./.test(c.text)), W));
  ok('Wide load: one "Permit confirmed" tick, the earlier one', (await p.locator('.lg-permit input').count()) === 1);
  await p.check('.lg-permit input'); await wait();
  ok('Wide load: ticking it clears the warning, as before', await ev((l) => !lgChecks(lgLoad(l)).some((c) => /14 ft wide or wider/.test(c.text)), W));
  await ev((l) => lgCancel(l), W);

  // ---------------------------------------------------------------- split
  sec('Split a load');
  await ev(() => lgOpen('AD')); await wait();
  await p.click('.lgx-record button:has-text("Break out buildings")'); await wait();
  ok('Split form names the next code', /AD-L1/.test(await p.textContent('.modal')) && (await p.getAttribute('#lgx-split-reason', 'placeholder')) === 'Customer ready / finished early');
  await p.click('.modal button:has-text("Split to AD-L1")'); await wait(100);
  ok('Split: nothing ticked is refused', (await toast()) === 'Tick the buildings to break out.');
  await p.check('.lgx-split input >> nth=0'); await p.check('.lgx-split input >> nth=1');
  await p.click('.modal button:has-text("Split to AD-L1")'); await wait(100);
  ok('Split: every building ticked is refused', (await toast()) === 'Leave at least one building on this load.');
  await p.uncheck('.lgx-split input >> nth=0');
  await p.fill('#lgx-split-reason', 'Customer ready');
  await p.click('.modal button:has-text("Split to AD-L1")'); await wait();
  const sp = await ev(() => { const a = lgLoad('AD'), n = lgLoad('AD-L1'); return { toast: document.getElementById('toast').textContent, a: lgLoadUnits(a).map((u) => u.id), n: n && lgLoadUnits(n).map((u) => u.id), aStops: a.stops.map((s) => s.units.length), nState: n?.state, nFrom: n?.splitFrom, nOrigin: n?.origin, reason: n?.splitReason, loadIdOf: lgUnit('SAMPLE-1012-2122').loadId, aState: a.state }; });
  ok('Split: "Broke out of AD into AD-L1."', sp.toast === 'Broke out of AD into AD-L1.', JSON.stringify(sp));
  ok('Split: the chosen building is on AD-L1, planned, with the reason', JSON.stringify(sp.n) === '["SAMPLE-1012-2122"]' && sp.nState === 'planned' && sp.nFrom === 'AD' && sp.nOrigin === 'AD' && sp.reason === 'Customer ready' && sp.loadIdOf === 'AD-L1', JSON.stringify(sp));
  ok('Split: the original load keeps its other building and has no empty stop', JSON.stringify(sp.a) === '["SAMPLE-1220-2103"]' && JSON.stringify(sp.aStops) === '[1]' && sp.aState === 'planned', JSON.stringify(sp));
  ok('Split: the original can still be scheduled (no blocking check left)', await ev(() => lgBlocked(lgLoad('AD')).length === 0), await ev(() => JSON.stringify(lgBlocked(lgLoad('AD')))));
  ok('Split: no second split offered on a one-building load', (await p.locator('.lgx-record button:has-text("Break out buildings")').count()) === 0);
  const sp2 = await ev(() => {
    const l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ['SAMPLE-1224-2101', 'SAMPLE-1016-2102', 'SAMPLE-1020-2104']);
    lgOpen(l.id); lgxSplitForm(l.id); document.querySelector('.lgx-split input').checked = true; lgxSplit(l.id);
    lgxSplitForm(l.id); document.querySelector('.lgx-split input').checked = true; lgxSplit(l.id);
    return { id: l.id, codes: LG.loads.filter((x) => x.splitFrom === l.id).map((x) => x.id), left: lgLoadUnits(l).length };
  });
  ok('Split twice: codes go -L1 then -L2', JSON.stringify(sp2.codes) === JSON.stringify([sp2.id + '-L1', sp2.id + '-L2']) && sp2.left === 1, JSON.stringify(sp2));
  await ev(() => go('lg-loads')); await wait();
  await ev(() => { LG.tab = 'planned'; render(); }); await wait();
  const rowText = await p.$$eval('.ops-row', (els) => els.map((x) => x.innerText.replace(/\n+/g, ' | ')));
  ok('Loads list: "Split from AD" on the new load and "Split off" on the original', rowText.some((t) => /Load AD-L1/.test(t) && /Split from AD · Customer ready/.test(t)) && rowText.some((t) => /Load AD \|/.test(t) && /Split off: AD-L1/.test(t)), JSON.stringify(rowText));

  // ---------------------------------------------------------------- sizes from the knowledge base
  sec('16 ft wide refused, 14 × 40 accepted');
  const Z = await ev(() => {
    const mk = (id, size, extra = {}) => lgAddUnit({ id, name: size + ' Basic Utility', size, kind: 'stock', lotId: 'florence', plantId: PLANTS[0].id, leg: 'plant-lot', sample: true, ...extra });
    mk('TEST-1624-9101', '16x24'); mk('TEST-1440-9102', '14x40'); mk('TEST-1244-9103', '12x44');
    const l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ['TEST-1624-9101']);
    return { id: l.id, on: lgLoadUnits(l).length, u16: lgUnit('TEST-1624-9101').loadId };
  });
  ok('16 ft wide: cannot be put on a new load', Z.on === 0 && Z.u16 === null, JSON.stringify(Z));
  await ev((l) => lgAdd(l, 'TEST-1624-9101'), Z.id); await wait(100);
  ok('16 ft wide: "Add" is refused with the reason', (await toast()) === '16 ft wide buildings are built on site. This one cannot ride on a load.' && (await ev(() => lgUnit('TEST-1624-9101').loadId === null)), await toast());
  await ev(() => { LG.q = 'TEST-1624'; LG.tile = 'all'; go('logi'); }); await wait();
  await p.click('.lg-unit:has-text("TEST-1624-9101") .lg-tick'); await wait();
  ok('16 ft wide: "Pick" on the board is refused', (await ev(() => !LG.pick.includes('TEST-1624-9101'))) && (await toast()) === '16 ft wide buildings are built on site. This one cannot ride on a load.');
  ok('16 ft wide: the row says "Built on site · no trailer load"', /Built on site · no trailer load/.test(await p.textContent('.lg-unit:has-text("TEST-1624-9101")')));
  await p.click('.lg-unit:has-text("TEST-1624-9101") button:has-text("Add a build crew job")'); await wait();
  ok('16 ft wide: a build crew job is added and shows on the row', (await ev(() => LGX.jobs.some((j) => j.buildOnSite && j.serial === 'TEST-1624-9101' && j.request === 'pending'))) && /Build crew job SV-\d+/.test(await p.textContent('.lg-unit:has-text("TEST-1624-9101")')));
  await ev((l) => { LG.q = ''; lgAdd(l, 'TEST-1440-9102'); lgOpen(l); }, Z.id); await wait();
  const c14 = await ev((l) => ({ on: lgLoadUnits(lgLoad(l)).map((u) => u.id), checks: lgChecks(lgLoad(l)).map((c) => c.level + ': ' + c.text) }), Z.id);
  ok('14 × 40: accepted on the load', JSON.stringify(c14.on) === '["TEST-1440-9102"]', JSON.stringify(c14));
  ok('14 × 40: only the wide-load permit warning, no size stop', c14.checks.some((t) => /^warn: 1 building 14 ft wide or wider/.test(t)) && !c14.checks.some((t) => /built on site|longer than 40 ft/.test(t)), JSON.stringify(c14.checks));
  await ev((l) => { lgRemove(l, 'TEST-1440-9102'); lgAdd(l, 'TEST-1244-9103'); }, Z.id); await wait();
  ok('12 × 44: a warning that it is longer than 40 ft', await ev((l) => lgChecks(lgLoad(l)).some((c) => c.level === 'warn' && /^12 × 44: longer than 40 ft\. The largest building delivered is 14 × 40/.test(c.text)), Z.id));
  await ev((l) => lgCancel(l), Z.id);

  // ---------------------------------------------------------------- lead times
  sec('Usual delivery time');
  await ev(() => { LG.q = ''; LG.tile = 'all'; go('logi'); }); await wait();
  ok('A late customer building is flagged on the board', /Late · usual delivery was by /.test(await p.textContent('.lg-unit:has-text("SAMPLE-1016-2121")')));
  ok('A building inside the usual time shows the date', /Usual delivery by /.test(await p.textContent('.lg-unit:has-text("SAMPLE-1216-2120")')) && !/Late/.test(await p.textContent('.lg-unit:has-text("SAMPLE-1216-2120")')));
  ok('Inventory for a lot carries no delivery date', !/Usual delivery|Late ·/.test(await p.textContent('.lg-unit:has-text("SAMPLE-1012-2112")')));
  ok('The board counts late customer buildings', /customer buildings? past the usual delivery time/.test(await p.textContent('.lgx-strip')));
  const lateLoad = await ev(() => { lgNewHome('SAMPLE-1016-2121'); return LG.loadId; }); await wait();
  ok('The load warns that the customer is past the usual time', await ev((l) => lgChecks(lgLoad(l)).some((c) => c.level === 'warn' && /^Reese Langford: past the usual delivery time \(in stock: 1 to 2 weeks\)\. It was due by /.test(c.text)), lateLoad));
  ok('The stop card shows the late line', /Late: usual delivery was by .* \(in stock: 1 to 2 weeks\)/.test(await p.textContent('.lg-stop:has-text("Reese Langford")')));

  // ---------------------------------------------------------------- site questions
  sec('Delivery-site questions');
  await p.click('.lg-stop button:has-text("Confirm the site")'); await wait();
  ok('Logistics sees the knowledge-base help in the site form', /never more than 16 in\. there/.test(await p.textContent('.modal .lgx-siterule')) && /septic or sprinkler lines/.test(await p.textContent('.modal .lgx-siterule')));
  await p.click('.modal .lgx-siterule .ta-tip >> nth=1'); await wait(300);
  ok('The Blocking link opens the knowledge-base article', (await p.textContent('.ta-article h2').catch(() => '')) === 'Installation — Set Height, Blocking, and Site Conditions');
  await ev(() => { taCloseAnswers(); closeModal(); });
  await ev((l) => lgCancel(l), lateLoad);

  // ---------------------------------------------------------------- states, stops, windows, miles
  sec('States, stops, time and miles');
  await ev(() => lgOpen('H12')); await wait();
  let panel = await p.innerText('.lgx-record');
  ok('Scheduled load: real state and what can come next', /records this load as Scheduled\. From here it can become On the road or Cancelled\. It cannot go back to Planned yet\./.test(panel), panel.slice(0, 300));
  ok('Time of day explained', /Time: Afternoon, which sorts at 1:00 PM on the day’s list\./.test(panel));
  ok('Stops listed by Turbo’s kinds, with what each needs', /Lot \/ dealer holding Lugoff lot/.test(panel.replace(/\n/g, ' ')) && /Customer site Harper Dunmore/.test(panel.replace(/\n/g, ' ')) && /Needs the customer’s contact/.test(panel), panel);
  ok('Stop card: kind and proof form', /Customer site · proof here: the FastField delivery form/.test(await p.textContent('.lg-stop:has-text("Harper Dunmore")')));
  ok('Miles in the panel, and the trailer’s day', /8\.0 mi \(estimate\) to the last stop\. Trailer 4: .* 16 mi round trip/.test(panel.replace(/\n/g, ' ')), panel.replace(/\n/g, ' ').slice(300, 700));
  await ev(() => lgOpen('AA')); await wait();
  panel = await p.innerText('.lgx-record');
  ok('Delivered load: final', /records this load as Delivered\. That is final: a delivered or cancelled load is not reopened\./.test(panel));
  ok('Done stop: arrived, departed, proof on file', /Lot \/ dealer holding · arrived .* departed .* · proof on file/.test(await p.textContent('.lg-stop.done')));
  const emptyLoad = await ev(() => { LG.pick = []; lgNewLoad(); return LG.loadId; }); await wait();
  ok('Empty load: Turbo’s "add at least two stops" sentence', /Add at least two stops with addresses to calculate miles\./.test(await p.innerText('.lgx-record')));
  await ev((l) => { lgAddUnit({ id: 'TEST-1012-9201', name: '10x12 Basic Utility', size: '10x12', kind: 'order', customer: 'No Miles Buyer', lotId: 'florence', plantId: PLANTS[0].id, leg: 'plant-home', at: 'plant', sample: true, site: { miles: '', access: '', gate: '', noGate: false, ground: '', notes: '' } }); lgAdd(l, 'TEST-1012-9201'); }, emptyLoad); await wait();
  ok('A customer stop with no miles on file: "could not be located on the map"', /One or more stop addresses could not be located on the map\./.test(await p.innerText('.lgx-record')));
  await ev((l) => lgCancel(l), emptyLoad);
  await ev(() => lgOpen('AC')); await wait();
  ok('Rules from the knowledge base, with the fee difference stated', await ev(() => { const t = document.querySelector('.lgx-rules').textContent; return /The largest building delivered is 14 × 40/.test(t) && /\$100 for 50 to 60 miles and manager approval past 60; this preview keeps the rule the owner set/.test(t) && /free to 50 miles, \$100\.00 for 51 to 100/.test(t); }), await ev(() => document.querySelector('.lgx-rules').textContent.slice(-400)));
  ok('Product notes name the Turbo Logistics functions', /manifestSnapshotToTextLines/.test(await p.textContent('.ops-notes')) && /splitUnitFromShipment/.test(await p.textContent('.ops-notes')) && /notifyRouteDeliveryEtaUpdate/.test(await p.textContent('.ops-notes')));

  // ---------------------------------------------------------------- carriers and rigs
  sec('Trailers and haulers');
  await ev(() => go('lg-fleet')); await wait();
  let fleet = (await p.innerText('#app')).replace(/\n+/g, ' | ');
  ok('Hauler kinds in Turbo’s words', /In-house: company drivers, our fleet · 4 trailers/.test(fleet) && /Contracted: an outside hauler, a standing partner · 1 trailer/.test(fleet), fleet.slice(fleet.indexOf('Who hauls'), fleet.indexOf('Who hauls') + 500));
  ok('Insurance soon: "(in 12d)"', /Insurance: \w{3} \d{1,2}, \d{4} \(in 12d\)/.test(fleet));
  ok('Insurance past: "(expired 5d ago)"', /Insurance: \w{3} \d{1,2}, \d{4} \(expired 5d ago\)/.test(fleet));
  ok('Contract soon: "(in 20d)"; a far date shows plain', /Contract: \w{3} \d{1,2}, \d{4} \(in 20d\)/.test(fleet) && /Contract: \w{3} \d{1,2}, \d{4} \|/.test(fleet));
  ok('Coverage and capacity in linear feet', /Coverage: North Carolina lots · Capacity: 40 linear ft/.test(fleet));
  ok('Trailer cards: capacity unit and today’s miles', /Capacity: 40 linear feet · Today \d+ mi round trip/.test(fleet) && /Capacity: 30 linear feet/.test(fleet), fleet.slice(0, 600));
  await p.click('button:has-text("Add a hauler")'); await wait();
  ok('Hauler form offers the five kinds', JSON.stringify(await p.$$eval('#lg-car-kind option', (o) => o.map((x) => x.value))) === '["contracted","freelance","dealer_byo","in_house","other"]');
  await p.fill('#lg-car-name', 'Test Freight'); await p.selectOption('#lg-car-kind', 'freelance'); await p.fill('#lgx-car-cap', '-5');
  await p.click('.modal button:has-text("Save")'); await wait(100);
  ok('Hauler form: capacity must be a positive number', (await toast()) === 'Capacity (linear feet) must be a positive number.');
  await p.fill('#lgx-car-cap', '53'); await p.fill('#lg-car-covers', 'Upstate SC, Western NC');
  await p.fill('#lgx-car-ins', await ev(() => lgAddDays(lgToday(), 3)));
  await p.click('.modal button:has-text("Save")'); await wait();
  fleet = (await p.innerText('#app')).replace(/\n+/g, ' | ');
  ok('New hauler shows kind, coverage, capacity and the date badge', /Test Freight \| Freelance: an outside hauler, hired per job · 0 trailers \| Coverage: Upstate SC, Western NC · Capacity: 53 linear ft \| Insurance: \w{3} \d{1,2}, \d{4} \(in 3d\)/.test(fleet), fleet.slice(fleet.indexOf('Test Freight'), fleet.indexOf('Test Freight') + 260));
  const hb = await ev(() => { const l = lgMakeLoad('home', { type: 'lot', id: 'statesboro' }, ['SAMPLE-1016-2121']); lgSet(l.id, 'rigId', 'rig-6'); return { id: l.id, checks: lgChecks(l).map((c) => c.level + ': ' + c.text) }; });
  ok('A load on a hauler whose insurance has ended is warned', hb.checks.some((t) => /^warn: Sample Shed Movers: the insurance on file ended /.test(t)), JSON.stringify(hb.checks));
  await ev((l) => { lgCarrier('hauler-b').active = false; return l; }, hb.id);
  ok('An inactive hauler is warned', await ev((l) => lgChecks(lgLoad(l)).some((c) => /^Sample Shed Movers is marked inactive/.test(c.text)), hb.id));
  await ev((l) => { lgCarrier('hauler-b').active = true; lgCancel(l); }, hb.id);
  await ev(() => { go('lg-fleet'); lgRigForm('rig-3'); }); await wait();
  ok('Trailer form: the nine capacity units', JSON.stringify(await p.$$eval('#lgx-rig-unit option', (o) => o.map((x) => x.textContent))) === '["linear feet","lb","kg","cu ft","cu m","pallets","units","gal","L"]');
  ok('Trailer form: the two kinds of work are still there', (await p.locator('#lg-rig-haul').count()) === 1 && (await p.locator('#lg-rig-home').count()) === 1);
  await p.selectOption('#lgx-rig-unit', 'pallets'); await p.click('.modal button:has-text("Save")'); await wait();
  ok('A trailer measured in pallets: length is checked by hand', /36 pallets, so length is checked by hand/.test(await p.innerText('#app')) && (await ev(() => lgRig('rig-3').feet === 0 && lgRig('rig-3').capacityUnit === 'pallets')));
  await ev(() => lgRigForm('rig-3')); await wait();
  await p.selectOption('#lgx-rig-unit', 'linear_feet'); await p.fill('#lg-rig-feet', '36'); await p.click('.modal button:has-text("Save")'); await wait();
  ok('Back to linear feet: the trailer is 36 ft again', await ev(() => lgRig('rig-3').feet === 36 && lgRig('rig-3').capacityUnit === 'linear_feet'));

  // ---------------------------------------------------------------- map, calendar, who sees what, notes
  sec('Map, calendar, sign-ins, notes');
  await ev(() => go('lg-places')); await wait();
  const pins = await p.$$eval('.lgx-pin', (els) => els.map((x) => x.getAttribute('class').replace('lgx-pin ', '') + ':' + x.textContent));
  ok('Map: a tag for each load, in the four pin states', ['in_transit:AB', 'pickup:AC', 'staged:H12', 'delivered:AA', 'delivered:H10'].every((x) => pins.includes(x)), JSON.stringify(pins));
  ok('Map: legend with Turbo’s pin names', /In transit\s*Staged at dealer\s*Delivered\s*At pickup/.test(await p.textContent('.lgx-pinlegend')), await p.textContent('.lgx-pinlegend'));
  await p.dispatchEvent('.lgx-pin.in_transit', 'click'); await wait();
  ok('Map: tapping a tag opens the load', (await ev(() => S.page === 'lg-load' && LG.loadId === 'AB')));
  await ev(() => { LG.week = 0; go('lg-cal'); }); await wait();
  const want = await ev(() => { const n = { scheduled: 0, in_transit: 0, delivered: 0 }; for (const l of LG.loads.filter((x) => x.date === lgToday() && x.state !== 'cancelled')) for (const s of l.stops) { const st = l.state === 'in_transit' && s.done ? 'delivered' : l.state; if (st in n) n[st] += s.units.length; } return `Scheduled: ${n.scheduled}In transit: ${n.in_transit}Delivered: ${n.delivered}`; });
  const counts = await p.$$eval('.lgx-daycount', (els) => els.map((x) => x.textContent));
  ok('Calendar: seven day counts; today counts the dropped building as delivered', counts.length === 7 && counts[0].startsWith(want) && /In transit: 1Delivered: 1/.test(counts[0]), JSON.stringify(counts.slice(0, 2)) + ' want ' + want);
  ok('Calendar: an empty day says "No deliveries"', counts.some((t) => /No deliveries$/.test(t)));
  await ev(() => { LG.tab = 'scheduled'; go('lg-loads'); }); await wait();
  ok('Loads: coordinator sees the tabs and Open buttons', (await p.locator('.ops-tabs').count()) === 1 && (await p.locator('.ops-row button:has-text("Open")').count()) > 0);
  await p.selectOption('.lgx-viewas select', 'hauler:hauler-a'); await wait();
  let hv = (await p.innerText('#app')).replace(/\n+/g, ' | ');
  ok('Hauler’s view: "View-only · your carrier scope", its own load only, nothing to open', /View-only · your carrier scope/.test(hv) && /STOP 1 · PLANT ORIGIN/i.test(hv) && /STOP 2 · DEALER HOLDING/i.test(hv) && /Bennett Buildings of Lexington/.test(hv) && !/Load AB|Harper Dunmore/.test(hv) && (await p.locator('.ops-row').count()) === 0 && (await p.locator('.lgx-hauler a:has-text("Maps")').count()) === 3, hv.slice(0, 500));
  await p.selectOption('.lgx-viewas select', 'hauler:hauler-b'); await wait();
  ok('Hauler with nothing assigned: Turbo’s sentence', /No active routes assigned to Sample Shed Movers\./.test(await p.innerText('#app')));
  await p.selectOption('.lgx-viewas select', 'driver'); await wait();
  await p.click('.panel .actions button >> nth=0'); await wait();
  ok('Driver’s view leads to the driver’s day', await ev(() => S.page === 'lg-drive'));
  ok('Driver’s day: stop kind and proof on each stop', (await p.locator('.lg-run .lgx-kind').count()) > 0);
  await ev(() => { LGX.viewAs = 'coordinator'; go('lg-notes'); }); await wait();
  const notes = await p.locator('#app').evaluate((e) => e.textContent);
  ok('Notes: what was taken from Turbo Logistics and what is planned there', /Taken from Turbo Logistics/.test(notes) && /Planned in Turbo Logistics, not built yet/.test(notes) && /A tracking page for the customer/.test(notes) && /Reopening a load as planned/.test(notes));

  // ---------------------------------------------------------------- service jobs
  sec('Service jobs');
  const sv = await ev(() => {
    const a = taServiceAdd({ title: 'Test warranty visit', serial: 'SAMPLE-1216-2120', kind: 'warranty', from: 'sales' });
    const r1 = taServiceAdd({ serial: 'SAMPLE-1016-2121', kind: 'repo', from: 'office' }), r2 = taServiceAdd({ serial: 'SAMPLE-1016-2121', kind: 'repossessed', from: 'office' });
    const ret = taServiceAdd({ serial: 'SAMPLE-1012-2122', kind: 'returned', from: 'office' });
    return { a: { id: a.id, queue: a.queue, request: a.request, origin: a.origin, where: a.where, customer: a.customer }, r1: { id: r1.id, title: r1.title, queue: r1.queue, origin: r1.origin, request: r1.request }, same: r1 === r2, ret: ret.title, bell: taNoticesFor('logi')[0].title };
  });
  ok('taServiceAdd: a warranty request from Sales waits for approval', /^SV-\d+$/.test(sv.a.id) && sv.a.queue === 'warranty' && sv.a.request === 'pending' && sv.a.origin === 'sales' && sv.a.customer === 'Jamie Calloway' && sv.a.where === 'Florence lot area', JSON.stringify(sv.a));
  ok('taServiceAdd: a repossessed unit gets Turbo’s title and the Internal upgrade queue', sv.r1.title === 'Repossessed unit — internal upgrade for SAMPLE-1016-2121' && sv.r1.queue === 'internal_upgrade' && sv.r1.origin === 'manufacturing_auto', JSON.stringify(sv.r1));
  ok('taServiceAdd: one open request for a unit', sv.same);
  ok('taServiceAdd: a returned unit', sv.ret === 'Returned unit — internal upgrade for SAMPLE-1012-2122', sv.ret);
  ok('taServiceAdd: the Logistics bell hears about it', /^Service request — /.test(sv.bell), sv.bell);
  await ev(() => go('logi')); await wait();
  await p.click('.lgx-strip button:has-text("Service jobs")'); await wait();
  ok('Dispatch opens Service jobs, with a way back', (await ev(() => S.page === 'lg-service')) && (await p.locator('button.backlink:has-text("Dispatch")').count()) === 1);
  let st = (await p.innerText('#app')).replace(/\n+/g, ' | ');
  ok('Request states in Turbo’s words', /Request: Pending/.test(st) && /Request: Needs info/.test(st) && /From: Sales/.test(st) && /From: Manufacturing auto/.test(st), st.slice(0, 700));
  await p.click('.lgx-job:has-text("Test warranty visit") button:has-text("Approve")'); await wait();
  ok('Approve: the job is Unscheduled, under "To schedule"', (await ev(() => LGX.jobTab === 'plan')) && /Request: Approved \| Unscheduled/.test((await p.innerText('.lgx-job:has-text("Test warranty visit")')).replace(/\n+/g, ' | ')));
  const vis = await ev(() => LGX.jobs.find((j) => j.title === 'Set anchors on a return trip').date);
  await p.click('.lgx-job:has-text("Test warranty visit") button:has-text("Schedule")'); await wait();
  await p.fill('#lgx-job-date', vis); await p.selectOption('#lgx-job-rig', 'srv-1'); await p.click('.modal button:has-text("Schedule")'); await wait();
  let row = (await p.innerText('.lgx-job:has-text("Test warranty visit")')).replace(/\n+/g, ' | ');
  ok('Scheduled on a busy rig with no capacity on file: Turbo’s two warnings', /Scheduled \| No check-in/.test(row) && /Rig has no capacity on file — verify equipment fit manually\./.test(row) && new RegExp(`Rig already has 2 other event\\(s\\) on ${vis}\\.`).test(row), row);
  ok('Spray foam on the wrong rig: Turbo’s warning', /Event offering expects a spray foam rig; assigned rig is other\./.test(await p.innerText('.lgx-job:has-text("Spray foam insulation")')));
  await ev(() => { const j = LGX.jobs.find((x) => x.title === 'Test warranty visit'); lgxJobSet(j.id, { rigId: '' }, 'Rig removed'); }); await wait();
  ok('No rig: "Route has no rig assigned"', /Route has no rig assigned — set a rig before dispatching stops\./.test(await p.innerText('.lgx-job:has-text("Test warranty visit")')));
  const steps = [];
  for (let i = 0; i < 5; i++) { await p.click('.lgx-job:has-text("Test warranty visit") button:has-text("Check in")'); await wait(150); steps.push(await ev(() => { const j = LGX.jobs.find((x) => x.title === 'Test warranty visit'); return j.checkIn + '/' + j.status; })); }
  ok('Check-in steps in order, ending Complete', JSON.stringify(steps) === '["confirmed/scheduled","day_before/scheduled","en_route/scheduled","on_site/in_progress","complete/complete"]', JSON.stringify(steps));
  ok('Finished job is under "Finished"', (await ev(() => LGX.jobTab === 'done')) && /Complete \| Complete/.test((await p.innerText('.lgx-job:has-text("Test warranty visit")')).replace(/\n+/g, ' | ')));
  await ev(() => { LGX.jobTab = 'review'; render(); }); await wait();
  await p.click('.lgx-job:has-text("Repair: replace a damaged trim board") button:has-text("Decline")'); await wait();
  ok('Decline: the request is Declined', await ev(() => LGX.jobs.find((x) => /trim board/.test(x.title)).request === 'declined'));
  ok('Product notes on Service name Turbo Service', /buildServiceDispatchWarnings/.test(await p.textContent('.ops-notes')));

  // ---------------------------------------------------------------- phone
  sec('Phone, 390 px wide');
  await p.setViewportSize({ width: 390, height: 800 });
  // Nothing may reach past the right edge: the page must not scroll sideways, and no element may be cut
  // off, except inside a row that is meant to scroll and the map's state outlines (both were there before).
  const over = async (name) => {
    await wait(200);
    const o = await ev(() => {
      const w = document.documentElement.clientWidth, bad = [];
      const scrolls = (el) => { for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) { const st = getComputedStyle(x); if (/auto|scroll/.test(st.overflowX) || /auto|scroll/.test(st.overflow)) return true; } return false; };
      document.querySelectorAll('#app *, .modal *, .topbar *, .previewstrip *, .tabbar *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= w + 1 || getComputedStyle(el).position === 'fixed') return;
        if (el.closest('.lg-map') && !el.closest('.lgx-pins')) return;
        if (scrolls(el)) return;
        bad.push(el.tagName + '.' + (el.getAttribute('class') || '') + ' ' + Math.round(r.right));
      });
      const m = document.querySelector('.modal');
      return { sw: document.documentElement.scrollWidth, cw: w, m: m ? m.scrollWidth - m.clientWidth : 0, bad: bad.slice(0, 6) };
    });
    ok(`fits the phone: ${name}`, o.sw <= o.cw && o.m <= 0 && !o.bad.length, JSON.stringify(o));
  };
  for (const pg of ['logi', 'lg-loads', 'lg-cal', 'lg-places', 'lg-fleet', 'lg-drive', 'lg-notes', 'lg-service']) { await ev((x) => go(x), pg); await over(pg); }
  for (const tab of ['review', 'plan', 'set', 'done']) { await ev((t) => { LGX.jobTab = t; go('lg-service'); }, tab); await over('lg-service · ' + tab); }
  for (const v of ['hauler:hauler-a', 'hauler:hauler-b', 'driver']) { await ev((x) => { LGX.viewAs = x; go('lg-loads'); }, v); await over('lg-loads as ' + v); }
  await ev(() => { LGX.viewAs = 'coordinator'; });
  for (const id of ['AD', 'AD-L1', 'AC', 'AB', 'AA', 'H12', 'H10']) { await ev((x) => { lgOpen(x); const d = document.querySelector('.lgx-rules'); if (d) d.open = true; }, id); await over('load ' + id); }
  await ev(() => { lgOpen('AC'); lgxManifest('AC'); }); await over('manifest');
  await ev(() => lgxManifestEmail('AC')); await over('email manifest');
  const canSplit = await ev(() => { closeModal(); const l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ['SAMPLE-1016-2107', 'SAMPLE-1012-2109']); lgOpen(l.id); return l.id; });
  await over('a load that can be split');
  await ev((x) => lgxSplitForm(x), canSplit); await over('split form');
  await ev(() => { closeModal(); go('lg-fleet'); lgCarrierForm('hauler-a'); }); await over('hauler form');
  await ev(() => { closeModal(); lgRigForm('rig-1'); }); await over('trailer form');
  await ev(() => { closeModal(); go('lg-service'); LGX.jobTab = 'plan'; render(); lgxJobPlanForm(LGX.jobs.find((j) => j.status === 'unscheduled').id); }); await over('schedule a job');
  await ev(() => { closeModal(); go('logi'); lgSiteForm('SAMPLE-1216-2120'); }); await over('site form');
  await ev(() => { closeModal(); go('logi'); taOpenNotices(); }); await over('notifications');
  await ev(() => closeModal());

  console.log(`\n${fails ? 'FAILED' : 'ALL PASSED'}: ${passes} passed, ${fails} failed. Console errors: ${errs.length}`, errs.slice(0, 8));
  await b.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
