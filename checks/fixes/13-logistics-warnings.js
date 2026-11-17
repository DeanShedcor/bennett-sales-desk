// Fix 13: Logistics batch 1. node fix13.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + String(d || '').slice(0, 400))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} go('logi'); }); await p.waitForTimeout(500);
    return p;
  };
  const quiet = (p) => p.evaluate(() => { const t = document.getElementById('toast'); if (t) { t.hidden = true; t.textContent = ''; } });
  const shot = async (p, name, clip) => { if (!PIC) return; await quiet(p); await p.waitForTimeout(250); await p.screenshot({ path: `${PIC}${name}.png`, ...(clip ? { clip } : {}) }); };
  const app = (p) => p.locator('#app').innerText();
  const modalText = (p) => p.locator('.modal').innerText().catch(() => '');

  /* ---------- 1. Warnings need a typed reason ---------- */
  let p = await open(false);
  const made = await p.evaluate(() => {
    const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).sort((a, b) => a.len - b.len).slice(0, 2).map((u) => u.id);
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids);
    const rig = LG.rigs.find((r) => !r.haul && r.home); /* a trailer for home deliveries only */
    load.rigId = rig.id; load.driver = rig.driver;
    let d = lgAddDays(lgToday(), 2);
    while (new Date(d + 'T12:00:00').getDay() === 0 || load.stops.some((x) => !lotDay(lgStopLot(x), d).open)) d = lgAddDays(d, 1);
    load.date = d;
    lgOpen(load.id);
    return { id: load.id, feet: lgFeet(load), cap: rig.feet, warns: lgChecks(load).filter((c) => c.level === 'warn').map((c) => c.text), stops: lgBlocked(load).map((c) => c.text) };
  });
  await p.waitForTimeout(400);
  let bar = await p.locator('.ops-bar').innerText();
  ok('1 a load with warnings and nothing to fix', made.warns.length >= 1 && !made.stops.length, JSON.stringify(made));
  ok('1 the bar says the warning count, not "Ready to schedule"', new RegExp(`^${made.warns.length} warning`).test(bar.trim()) && !/Ready to schedule/.test(bar), bar);
  ok('1 the button reads "Schedule with a reason"', /Schedule with a reason/.test(bar));
  ok('6 the trailer check is in plain words', made.warns.some((t) => /This trailer is for home deliveries only/.test(t)) && !made.warns.some((t) => /Rig is not flagged|capability/.test(t)), made.warns.join(' | '));
  await p.click('.ops-bar button.primary'); await p.waitForTimeout(300);
  let m = await modalText(p);
  ok('1 pressing it asks why, and lists the warnings', /Why is it OK to schedule it anyway/.test(m) && made.warns.every((t) => m.includes(t)), m);
  await p.click('.modal button:has-text("Schedule it")'); await p.waitForTimeout(300);
  ok('1 an empty reason is refused', await p.evaluate((id) => lgLoad(id).state === 'planned', made.id) && (await p.locator('#lgg-why').count()) === 1);
  await p.fill('#lgg-why', 'Checked with the driver, short trip');
  await shot(p, 'fix13-warnings-reason');
  await p.click('.modal button:has-text("Schedule it")'); await p.waitForTimeout(500);
  const after = await p.evaluate((id) => ({ state: lgLoad(id).state, log: lgLoad(id).log.map((e) => e.text).join(' || ') }), made.id);
  ok('1 with a reason the load is scheduled', after.state === 'scheduled', after.state);
  ok('1 the reason is kept in the history', /Reason: Checked with the driver, short trip/.test(after.log) && /Scheduled with \d+ warning/.test(after.log), after.log);
  ok('1 the history shows on the page', /Checked with the driver, short trip/.test(await app(p)));
  // a too-long load is a warning that needs a reason, with no separate Override button
  const long = await p.evaluate(() => {
    const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).sort((a, b) => b.len - a.len).slice(0, 2).map((u) => u.id);
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids);
    const rig = LG.rigs.filter((r) => r.haul && r.feet).sort((a, b) => a.feet - b.feet)[0];
    rig.feet = lgFeet(load) - 4; load.rigId = rig.id;
    let d = lgAddDays(lgToday(), 3);
    while (load.stops.some((x) => !lotDay(lgStopLot(x), d).open)) d = lgAddDays(d, 1);
    load.date = d; lgOpen(load.id);
    return { id: load.id, over: lgChecks(load).find((c) => c.key === 'over'), blocked: lgBlocked(load).length };
  });
  await p.waitForTimeout(300);
  ok('1 too long is a warning now, and does not block', long.over && long.over.level === 'warn' && long.blocked === 0 && /Too long: \d+ ft of buildings on a \d+ ft trailer\. Take one off or pick a longer trailer\./.test(long.over.text), JSON.stringify(long));
  ok('1 no separate Override button', (await p.locator('button:has-text("Override")').count()) === 0 && /Schedule with a reason/.test(await p.locator('.ops-bar').innerText()));
  await p.evaluate(() => go('lg-loads')); await p.waitForTimeout(300);
  await p.evaluate(() => { LG.tab = 'planned'; render(); }); await p.waitForTimeout(300);
  ok('1 the Loads list says "1 warning" style, not "Ready to schedule", for that load', /\d+ warnings?/.test(await p.locator(`.ops-row:has-text("Load ${long.id}")`).innerText()));
  ok('7 the tab says "Planned", not "Being planned"', /Planned/.test(await app(p)) && !/Being planned/.test(await app(p)));

  /* ---------- 2. Plan from the promise ---------- */
  await p.evaluate(() => lgOpen('H12')); await p.waitForTimeout(400);
  let plan = await p.evaluate(() => { const l = lgLoad('H12'), q = dtPlan(l); return { win: l.window, start: q.start, arrive: q.stops[0].arrive, flag: q.stops[0].flag, warn: lgChecks(l).filter((c) => c.promise).length }; });
  ok('2 an afternoon delivery arrives in the afternoon', plan.win === 'Afternoon' && plan.arrive >= 12 * 60 && plan.arrive <= 17 * 60 && !plan.flag && plan.warn === 0, JSON.stringify(plan));
  let dt = await p.locator('.dt-panel').innerText();
  ok('2 the panel says the time comes from the promise', /as the customer was told/.test(dt) && !/Arrives about 7:\d\d AM/.test(await app(p)), dt.slice(0, 300));
  await shot(p, 'fix13-promised-time', await p.evaluate(() => { const r = document.querySelector('.dt-panel').getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - 90); const q = document.querySelector('.dt-panel').getBoundingClientRect(); return { x: Math.max(0, q.x - 12), y: Math.max(0, q.y - 12), width: Math.min(1360 - Math.max(0, q.x - 12), q.width + 24), height: Math.min(1000 - Math.max(0, q.y - 12), q.height + 24) }; }));
  await p.evaluate(() => lgSet('H12', 'window', 'Morning')); await p.waitForTimeout(300);
  plan = await p.evaluate(() => { const q = dtPlan(lgLoad('H12')); return { arrive: q.stops[0].arrive, flag: q.stops[0].flag }; });
  ok('2 changed to morning, it arrives in the morning', plan.arrive >= 8 * 60 && plan.arrive <= 12 * 60 && !plan.flag, JSON.stringify(plan));
  await p.evaluate(() => { lgSet('H12', 'window', 'Specific time'); lgSet('H12', 'windowNote', '10:30 AM'); }); await p.waitForTimeout(300);
  plan = await p.evaluate(() => dtPlan(lgLoad('H12')).stops[0].arrive);
  ok('2 a set time of 10:30 AM is met', Math.abs(plan - 630) <= 5, plan);
  await p.evaluate(() => { lgSet('H12', 'window', 'Afternoon'); dtLeave('H12', '07:00'); }); await p.waitForTimeout(300);
  let checks = await p.evaluate(() => lgChecks(lgLoad('H12')).filter((c) => c.promise).map((c) => c.text));
  ok('2 leaving at 7:00 for an afternoon promise warns', checks.length === 1 && /but the customer was told the afternoon/.test(checks[0]), checks.join('|'));
  ok('2 the warning is on the page', /but the customer was told the afternoon/.test(await app(p)));
  await p.click('.dt-panel button:has-text("Use the promised time")'); await p.waitForTimeout(300);
  ok('2 "Use the promised time" puts it back', await p.evaluate(() => !lgLoad('H12').leave && lgChecks(lgLoad('H12')).filter((c) => c.promise).length === 0));
  ok('2 a plant load to the lots still leaves at the usual time', await p.evaluate(() => dtPlan(lgLoad('AC')).start === 7 * 60));

  /* ---------- 3. Start the run asks; cancel on the road ---------- */
  const day = await p.evaluate(() => new Date(lgLoad('H12').date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }));
  const early = await p.evaluate(() => lgLoad('H12').date !== lgToday());
  await p.click('.ops-bar button:has-text("Start the run")'); await p.waitForTimeout(300);
  m = await modalText(p);
  ok('3 Start the run asks first', await p.evaluate(() => lgLoad('H12').state === 'scheduled') && /Start/.test(m), m);
  ok('3 it says the load is set for another day', !early || (m.includes(`This is set for ${day}. Start it now?`) && /Today is/.test(m)), m);
  await shot(p, 'fix13-start-ask');
  await p.click('.modal button:has-text("Not yet")'); await p.waitForTimeout(200);
  ok('3 "Not yet" leaves it scheduled', await p.evaluate(() => lgLoad('H12').state === 'scheduled'));
  await p.click('.ops-bar button:has-text("Start the run")'); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("Start the run")'); await p.waitForTimeout(400);
  ok('3 confirming starts it', await p.evaluate(() => lgLoad('H12').state === 'in_transit'));
  const pageRoad = await app(p);
  ok('7 the page says "On the road", never "In transit"', /On the road/.test(pageRoad) && !/In transit/i.test(pageRoad.replace(/Product notes[\s\S]*$/, '')), (pageRoad.match(/.{0,40}in transit.{0,40}/i) || [''])[0]);
  bar = await p.locator('.ops-bar').innerText();
  ok('3 a load on the road has "Cancel load"', /Cancel (load|delivery)/.test(bar), bar);
  await p.click('.ops-bar button:has-text("Cancel delivery")'); await p.waitForTimeout(300);
  await shot(p, 'fix13-cancel-road');
  await p.click('.modal button:has-text("Cancel this delivery")'); await p.waitForTimeout(300);
  ok('3 cancelling on the road needs a reason', await p.evaluate(() => lgLoad('H12').state === 'in_transit'));
  await p.fill('#lgg-cancel-why', 'Truck broke down'); await p.click('.modal button:has-text("Cancel this delivery")'); await p.waitForTimeout(400);
  const cancelled = await p.evaluate(() => { const l = lgLoad('H12'), u = LG.units.find((x) => x.id === 'SAMPLE-1012-2123'); return { state: l.state, log: l.log.map((e) => e.text).join('|'), unit: [u.loadId, u.at] }; });
  ok('3 with a reason it is cancelled and the building goes back', cancelled.state === 'cancelled' && /Cancelled on the road: Truck broke down/.test(cancelled.log) && cancelled.unit[0] === null && cancelled.unit[1] === 'lot', JSON.stringify(cancelled));
  // on its own day the question is the plain one
  await p.evaluate(() => { lgLoad('AC').date = lgToday(); lgOpen('AC'); }); await p.waitForTimeout(300);
  await p.click('.ops-bar button:has-text("Start the run")'); await p.waitForTimeout(300);
  m = await modalText(p);
  ok('3 on its own day it still asks, in plain words', /Start this run now\?/.test(m) && !/This is set for/.test(m), m);
  await p.click('.modal button:has-text("Not yet")'); await p.waitForTimeout(200);

  /* ---------- 4. Same miles everywhere ---------- */
  const mi = await p.evaluate(() => ({ AB: lggMiles(lgLoad('AB')).text, AC: lggMiles(lgLoad('AC')).text, rt: lggMiles(lgLoad('AB')).round }));
  ok('4 miles are written out and round trip', /^\d+ mi out · \d+ round trip$/.test(mi.AB), mi.AB);
  await p.evaluate(() => go('logi')); await p.waitForTimeout(400);
  let board = await app(p);
  ok('4 Dispatch: the load row shows both numbers', board.includes(mi.AB) && !/about \d+ mi\b(?! from)/.test(board), (board.match(/.{0,30}about \d+ mi\b(?! from).{0,30}/) || [''])[0]);
  ok('4 Dispatch: the trailer’s day is the round trip', new RegExp(`Trailer 2: Today ${mi.rt} mi round trip`).test(board), (board.match(/Trailer 2: [^\n]*/) || [''])[0]);
  await shot(p, 'fix13-miles', { x: 0, y: 150, width: 1360, height: 640 });
  await p.evaluate(() => go('lg-fleet')); await p.waitForTimeout(400);
  const fleet = await app(p);
  ok('4 Trailers: the same day number', new RegExp(`Today ${mi.rt} mi round trip`).test(fleet), (fleet.match(/Today [^\n]*/) || [''])[0]);
  ok('7 Trailers are called trailers', /Trailer 1/.test(fleet) && !/\bRig \d/.test(fleet), (fleet.match(/.{0,30}Rig \d.{0,30}/) || [''])[0]);
  await p.evaluate(() => lgOpen('AB')); await p.waitForTimeout(400);
  let pg = await app(p);
  ok('4 Load page: heading, stops and the miles line all agree', pg.split(mi.AB).length >= 4 && !/miles to the last stop|mi to the last stop/.test(pg), String(pg.split(mi.AB).length));
  ok('4 Drive time shows the same round trip', new RegExp(`${mi.rt} mi\\s*round trip`).test(await p.locator('.dt-panel').innerText()));
  await p.evaluate(() => go('lg-drive')); await p.waitForTimeout(400);
  ok('4 Driver’s day shows both numbers', /\d+ mi out · \d+ round trip/.test(await app(p)) && !/about \d+ mi\b(?! from)/.test(await app(p)));

  /* ---------- 5. Stale wording ---------- */
  await p.evaluate(() => go('lg-notes')); await p.waitForTimeout(300);
  let notes = await app(p);
  ok('5 "What is real" no longer calls the miles rough or road miles not built', !/Miles are rough|Real maps, road miles and drive times/.test(notes) && /Road miles and drive times[^.]*stored in the app/.test(notes));
  await p.evaluate(() => go('lg-places')); await p.waitForTimeout(300);
  ok('5 Locations no longer says the miles are rough', !/rough/i.test(await app(p)) && /road miles, saved in the app/.test(await app(p)));
  await p.evaluate(() => lgOpen('AC')); await p.waitForTimeout(400);
  let rec = await p.locator('.lgx-record').innerText();
  ok('5 a plant load no longer says "(estimate)" or names Google', !/\(estimate\)|Google|straight-line/.test(rec) && /road miles, saved in the app/.test(rec), rec.slice(0, 300));
  await p.evaluate(() => lgOpen('H10')); await p.waitForTimeout(300);
  ok('5 "estimate" stays for the last miles to a home', /last miles to a customer’s home are an estimate/.test(await p.locator('.lgx-record').innerText()));

  /* ---------- 6. Plain record panel ---------- */
  await p.evaluate(() => lgOpen('AC')); await p.waitForTimeout(300);
  rec = await p.locator('.lgx-record').innerText();
  ok('6 no system wording by default', !/Turbo Logistics records this load|sorts at|Pipeline:|dealer holding|It cannot go back to/i.test(rec), (rec.match(/.{0,40}(Turbo Logistics records|sorts at|Pipeline:|dealer holding).{0,40}/i) || [''])[0]);
  const serials = await p.evaluate(() => [...document.querySelectorAll('.lgx-qc li')].map((li) => { const s = li.querySelector('.serial').textContent; return li.textContent.split(s).length - 1; }));
  ok('6 each serial is printed once in the QC lines', serials.length > 0 && serials.every((n) => n === 1), JSON.stringify(serials));
  await shot(p, 'fix13-record-panel', await p.evaluate(() => { const e = document.querySelector('.lgx-record'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 90); const q = e.getBoundingClientRect(); return { x: Math.max(0, q.x - 12), y: Math.max(0, q.y - 12), width: q.width + 24, height: Math.min(1000 - Math.max(0, q.y - 12), q.height + 24) }; }));
  await p.evaluate(() => { S.sfNotes = true; render(); }); await p.waitForTimeout(300);
  ok('6 builder notes bring Turbo Logistics’ record back', /How Turbo Logistics records this load/.test(await p.locator('.lgx-record').innerText()) && /Turbo Logistics records this load as/.test(await p.locator('.lgx-record').innerText()));
  await p.evaluate(() => { S.sfNotes = false; render(); }); await p.waitForTimeout(300);

  /* ---------- 8. Take off, with Undo ---------- */
  ok('8 "Take off" buttons, no small ×', (await p.locator('.lgg-take').count()) === 2 && (await p.locator('.lg-stop .of-x').count()) === 0);
  const h = await p.locator('.lgg-take').first().evaluate((e) => e.getBoundingClientRect().height);
  ok('8 the button is full size', h >= 36, h);
  await p.locator('.lgg-take').first().click(); await p.waitForTimeout(400);
  ok('8 pressing it takes the building off', await p.evaluate(() => lgLoadUnits(lgLoad('AC')).length === 1));
  ok('8 an Undo shows', (await p.locator('#pg-undo').count()) === 1 && /taken off/.test(await p.locator('#pg-undo').innerText()));
  await shot(p, 'fix13-take-off', { x: 0, y: 380, width: 1360, height: 620 });
  await p.click('#pg-undo button'); await p.waitForTimeout(400);
  ok('8 Undo puts it back on the same stop', await p.evaluate(() => lgLoadUnits(lgLoad('AC')).length === 2 && lgLoad('AC').stops.length === 2 && lgLoadUnits(lgLoad('AC')).every((u) => u.loadId === 'AC')));

  /* ---------- 10. Driver's day ---------- */
  ok('10 Driver’s day is in the computer menu', await p.locator('.topbar nav button[data-nav="lg-drive"]').isVisible().catch(() => false) || await p.locator('button[data-nav="lg-drive"]:visible').count() > 0);
  await p.click('button[data-nav="lg-drive"]:visible'); await p.waitForTimeout(400);
  ok('10 the menu opens Driver’s day', await p.evaluate(() => S.page === 'lg-drive') && /Driver’s day/.test(await app(p)));
  ok('10 a lot stop has a Call button', (await p.locator('.lg-run a[href^="tel:"]').count()) >= 1 && /Call/.test(await p.locator('.lg-run a[href^="tel:"]').first().innerText()));
  ok('10 the office sees every driver’s tab', (await p.locator('.ops-tabs .chipbtn').count()) >= 1);
  await p.evaluate(() => { lgLoad('AC').rigId = 'rig-1'; lgLoad('AC').driver = 'Marcus Bell'; adView('u12'); }); await p.waitForTimeout(400);
  await p.evaluate(() => go('lg-drive')); await p.waitForTimeout(400);
  let mine = await app(p);
  ok('10 a driver sees only their own day', /you see only your own day/.test(mine) && (await p.locator('.ops-tabs .chipbtn').count()) === 0 && /Load AC/.test(mine) && !/Load AB/.test(mine), mine.slice(0, 300));
  await p.evaluate(() => { lgLoad('AC').rigId = 'rig-3'; render(); }); await p.waitForTimeout(300);
  ok('10 with nothing on their trailer it says so', /Nothing for you yet/.test(await app(p)) && !/Load AB/.test(await app(p)));
  await p.close();

  /* ---------- Phone ---------- */
  p = await open(true);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.tabbar button[data-for="logi"]')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()));
  ok('7 phone tabs say Locations and Driver’s day', tabs.includes('Locations') && tabs.includes('Driver’s day') && !tabs.includes('Places') && !tabs.includes('Drive'), tabs.join(','));
  const tabFit = await p.evaluate(() => { const b = document.querySelector('.tabbar button[data-nav="lg-drive"]'), r = b.getBoundingClientRect(), s = b.querySelector('span').getBoundingClientRect(); return s.left >= r.left - 1 && s.right <= r.right + 1 && document.documentElement.scrollWidth <= innerWidth; });
  ok('7 the longer tab name fits', tabFit);
  await p.evaluate(() => lgOpen('AC')); await p.waitForTimeout(500);
  const order = await p.evaluate(() => { const top = (sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; return e ? e.getBoundingClientRect().top + scrollY : null; }; const heads = [...document.querySelectorAll('#app h2')]; const at = (t) => top(heads.find((x) => x.textContent.trim() === t)); return { stops: at('Stops, in drop order'), dt: top('.dt-panel'), checks: at('Checks'), add: at('Add buildings') ?? top('.lgg-fold'), rec: top('.lgx-record') }; });
  ok('9 on a phone Drive time comes right after the stops', order.dt > order.stops && order.dt < order.checks && order.dt < order.rec && (order.add == null || order.dt < order.add), JSON.stringify(order));
  await p.evaluate(() => { document.querySelector('.dt-panel').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }); await p.waitForTimeout(300);
  await shot(p, 'fix13-drive-phone');
  await p.evaluate(() => { const l = lgLoad('AC'); lgRig(l.rigId).feet = lgFeet(l); render(); }); await p.waitForTimeout(400);
  const fold = await p.evaluate(() => { const d = document.querySelector('.lgg-fold details'); return d ? { open: d.open, text: d.querySelector('summary').textContent, rows: d.querySelectorAll('.lg-cand').length } : null; });
  ok('9 "Add buildings" is folded when the trailer is full', fold && !fold.open && /The trailer is full/.test(fold.text), JSON.stringify(fold));
  await p.click('.lgg-fold summary'); await p.waitForTimeout(200);
  ok('9 it opens when tapped', await p.evaluate(() => document.querySelector('.lgg-fold details').open));
  const th = await p.locator('.lgg-take').first().evaluate((e) => e.getBoundingClientRect().height);
  ok('8 on a phone "Take off" is at least 44 px tall', th >= 44, th);
  await p.evaluate(() => go('lg-drive')); await p.waitForTimeout(500);
  ok('10 phone: Call sits beside Directions', await p.evaluate(() => { const c = document.querySelector('.lg-run a[href^="tel:"]'); return !!c && /Directions/.test(c.previousElementSibling?.textContent || ''); }));
  await p.evaluate(() => { const c = document.querySelector('.lg-run a[href^="tel:"]'); c.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
  await shot(p, 'fix13-driver-day-phone');
  ok('no sideways scroll on the phone', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.close();

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
