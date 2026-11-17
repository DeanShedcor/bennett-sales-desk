// Fix 14: Logistics batch 2. node fix14.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + String(d || '').slice(0, 500))); };
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
  const quiet = (p) => p.evaluate(() => { const t = document.getElementById('toast'); if (t) { t.hidden = true; t.textContent = ''; } document.getElementById('pg-undo')?.remove(); });
  const shot = async (p, name, clip) => { if (!PIC) return; await quiet(p); await p.waitForTimeout(250); await p.screenshot({ path: `${PIC}${name}.png`, ...(clip ? { clip } : {}) }); };
  const app = (p) => p.locator('#app').innerText();
  const modalText = (p) => p.locator('.modal').innerText().catch(() => '');
  /* a fresh plant load on a company trailer, a weekday when its lots are open */
  const mkLoad = (p, n = 2, rigPick = '(r) => r.haul && r.carrierId === "house"') => p.evaluate(([n, rigPick]) => {
    const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).sort((a, b) => a.len - b.len).slice(0, n).map((u) => u.id);
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids);
    const rig = LG.rigs.find(eval(rigPick));
    load.rigId = rig.id; load.driver = rig.driver;
    let d = lgAddDays(lgToday(), 3);
    while (load.stops.some((x) => !lotDay(lgStopLot(x), d).open) || LG.loads.some((l) => l !== load && l.rigId === rig.id && l.date === d && l.state !== 'cancelled')) d = lgAddDays(d, 1);
    load.date = d;
    return load.id;
  }, [n, rigPick]);

  /* ---------- 1. Live arrival times ---------- */
  let p = await open(false);
  const live = await p.evaluate(() => {
    const road = LG.loads.find((l) => l.state === 'in_transit' && l.stops.some((x) => x.done));
    const pl = dtPlan(road), d0 = new Date(road.startedAt); d0.setHours(0, 0, 0, 0);
    const m = (t) => (t - d0) / 60000, s0 = pl.stops.find((s) => s.stop.done), next = pl.stops.find((s) => !s.stop.done);
    lgOpen(road.id);
    return { id: road.id, live: pl.live, startOk: Math.abs(pl.start - m(road.startedAt)) < 0.01, arrOk: Math.abs(s0.arrive - m(s0.stop.arrived)) < 0.01, leaveOk: Math.abs(s0.leave - m(s0.stop.done)) < 0.01,
      nextFromReal: next ? next.arrive >= s0.leave : true, nextClock: next ? dtClock(next.arrive) : '', left: dtClock(pl.start), planned: DT.set.leave };
  });
  await p.waitForTimeout(400);
  let page = await app(p);
  ok('1 a load on the road has a live plan', live.live === true, JSON.stringify(live));
  ok('1 the plan starts at the real time the truck left', live.startOk);
  ok('1 a finished stop shows its real arrive and leave times', live.arrOk && live.leaveOk);
  ok('1 the next stop counts from the last real stop', live.nextFromReal);
  const panel = await p.locator('.dt-panel').innerText();
  ok('1 the Drive time panel says Live, "Left" and "Got there … left …"', /Live/.test(panel) && /Left /.test(panel) && /Got there .* · left /.test(panel) && /Should get there about|Running late/.test(panel), panel);
  ok('1 the stop card’s arrival uses the live time', !live.nextClock || page.includes(`Arrives about ${live.nextClock}`), live.nextClock);
  await p.evaluate(() => document.querySelector('.dt-panel').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -90));
  await shot(p, 'live-times');
  /* a second load on the same trailer the same day */
  const second = await p.evaluate(() => {
    const first = LG.loads.find((l) => l.state === 'in_transit' && l.stops.some((x) => x.done));
    const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).sort((a, b) => a.len - b.len).slice(0, 1).map((u) => u.id);
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids);
    load.rigId = first.rigId; load.driver = first.driver; load.date = first.date;
    const end = dtPlan(first).end, pl = dtPlan(load);
    lgOpen(load.id);
    const out = { id: load.id, start: pl.start, end, firstName: lgLoadName(first), usual: DT.set.leave };
    return out;
  });
  await p.waitForTimeout(300);
  ok('1 a second load on the same trailer that day leaves after the first is back', second.start >= second.end, JSON.stringify(second));
  const after = await p.locator('.dt-panel').innerText();
  ok('1 …and the panel says why', new RegExp(`This trailer is on ${second.firstName} first`).test(after), after.slice(0, 300));
  const typed = await p.evaluate((id) => { const l = lgLoad(id); l.leave = '05:00'; const w = lgChecks(l).filter((c) => /not back from/.test(c.text)).map((c) => c.text); delete l.leave; return w; }, second.id);
  ok('1 a typed leave time before the trailer is back is a warning', typed.length === 1, typed.join('|'));
  await p.evaluate((id) => { lgCancel(id); }, second.id); await p.waitForTimeout(200);

  /* ---------- 2. Calendar ---------- */
  const calId = await mkLoad(p, 2);
  const cal = await p.evaluate((id) => {
    const load = lgLoad(id), lot = lgStopLot(load.stops[0]);
    /* move it to a day the first lot is closed */
    let d = lgAddDays(lgToday(), 1);
    while (lotDay(lot, d).open) d = lgAddDays(d, 1);
    const week = Math.floor((new Date(d + 'T12:00:00') - new Date(lgToday() + 'T12:00:00')) / 864e5 / 7);
    load.date = d; LG.week = week; go('lg-cal');
    const day = [...document.querySelectorAll('.lg-day')].find((x) => x.querySelector(`.lg-chip[onclick="lgOpen('${id}')"]`));
    const loadsThatDay = LG.loads.filter((l) => l.date === d && l.state !== 'cancelled').length, buildings = LG.loads.filter((l) => l.date === d && l.state !== 'cancelled').reduce((t, l) => t + lgLoadUnits(l).length, 0);
    const chip = day.querySelector(`.lg-chip[onclick="lgOpen('${id}')"]`);
    return { d, town: lot.town, count: day.querySelector('.lgx-daycount').innerText, loadsThatDay, buildings, chip: chip.innerText, shut: chip.classList.contains('lgp-shut'), move: !!day.querySelector('.lgp-move'), plan: [dtClock(dtPlan(load).start), dtClock(dtPlan(load).end)] };
  }, calId);
  await p.waitForTimeout(300);
  ok('2 the day counts loads, not buildings', new RegExp(`^${cal.loadsThatDay} load`).test(cal.count.trim()) && cal.buildings > cal.loadsThatDay && !/Scheduled: 0|In transit/.test(cal.count), JSON.stringify(cal));
  ok('2 the card shows when it leaves and gets back', cal.chip.includes(`Leaves ${cal.plan[0]} · back ${cal.plan[1]}`), cal.chip);
  ok('2 a load with a stop at a closed lot is marked', cal.shut && cal.chip.includes(cal.town) && /lots? (is|are) closed this day/.test(cal.chip), cal.chip);
  ok('2 the card offers "Move … to another day"', cal.move);
  await p.evaluate(() => document.querySelector('.lgp-shut').scrollIntoView({ block: 'center' }));
  await shot(p, 'calendar');
  /* move it: a closed day asks for a reason; an open day does not */
  await p.click(`.lgp-move[onclick="lgpMoveForm('${calId}')"]`); await p.waitForTimeout(200);
  const openDay = await p.evaluate((id) => { const l = lgLoad(id); let d = lgAddDays(lgToday(), 2); while (l.stops.some((x) => !lotDay(lgStopLot(x), d).open) || LG.loads.some((o) => o !== l && o.rigId === l.rigId && o.date === d && o.state !== 'cancelled')) d = lgAddDays(d, 1); return d; }, calId);
  await p.fill('#lgp-day', openDay); await p.click('.modal button:has-text("Move it")'); await p.waitForTimeout(300);
  const moved = await p.evaluate((id) => ({ date: lgLoad(id).date, log: lgLoad(id).log.map((e) => e.text).join('|'), modal: !!document.querySelector('.modal') }), calId);
  ok('2 moving to an open day moves it at once and writes it in the history', moved.date === openDay && /Moved from/.test(moved.log) && !moved.modal, JSON.stringify(moved));
  await p.evaluate((id) => lgpMoveForm(id), calId); await p.waitForTimeout(200);
  await p.fill('#lgp-day', cal.d); await p.click('.modal button:has-text("Move it")'); await p.waitForTimeout(300);
  let mt = await modalText(p);
  ok('2 moving to a day with warnings asks why', /has \d+ warning/.test(mt) && /Why is it OK to move it anyway/.test(mt), mt);
  await p.click('.modal button:has-text("Move it")'); await p.waitForTimeout(200);
  ok('2 …and will not move without a reason', await p.evaluate((id) => lgLoad(id).date, calId) === openDay);
  await p.fill('#lgp-why', 'The lot said someone will be there'); await p.click('.modal button:has-text("Move it")'); await p.waitForTimeout(300);
  ok('2 …with a reason it moves and keeps the reason', await p.evaluate(([id, d]) => lgLoad(id).date === d && /Reason: The lot said/.test(lgLoad(id).log.map((e) => e.text).join('|')), [calId, cal.d]));
  await p.evaluate((id) => { LG.week = 0; lgCancel(id); }, calId); await p.waitForTimeout(200);

  /* ---------- 3. One permit block ---------- */
  const wideId = await p.evaluate(() => {
    const w = LG.units.find((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid >= 14);
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [w.id]);
    const rig = LG.rigs.find((r) => r.haul && r.carrierId === 'house' && r.feet >= w.len);
    load.rigId = rig.id; load.driver = rig.driver;
    let d = lgAddDays(lgToday(), 4); while (load.stops.some((x) => !lotDay(lgStopLot(x), d).open) || LG.loads.some((l) => l !== load && l.rigId === rig.id && l.date === d && l.state !== 'cancelled')) d = lgAddDays(d, 1);
    load.date = d; lgOpen(load.id); return load.id;
  });
  await p.waitForTimeout(400);
  let permit = await p.evaluate(() => ({ ticks: [...document.querySelectorAll('#app input[type=checkbox]')].filter((x) => /Permit confirmed/.test(x.closest('label')?.innerText || '')).length, old: /Permit confirmed for the wide load/.test(document.querySelector('#app').innerText), block: document.querySelector('.lgp-permit')?.innerText || '', flagBtn: /This load needs a permit|does not need a permit/.test([...document.querySelectorAll('#app button')].map((x) => x.innerText).join('|')) }));
  ok('3 a wide load has one "Permit confirmed" tick, in the permit block', permit.ticks === 1 && !permit.old && /Needs a permit/i.test(permit.block) && /Permit confirmed/.test(permit.block) && /Permit notes/.test(permit.block), JSON.stringify(permit));
  ok('3 there is no separate permit button', !permit.flagBtn);
  await p.evaluate(() => document.querySelector('.lgp-permit').scrollIntoView({ block: 'center' }));
  await shot(p, 'permit');
  await p.check('.lgp-permit input[type=checkbox]'); await p.waitForTimeout(200);
  ok('3 ticking it clears the permit warning', await p.evaluate((id) => lgLoad(id).permit === true && !lgChecks(lgLoad(id)).some((c) => /Permit confirmed/.test(c.text)), wideId));
  await p.evaluate((id) => lgCancel(id), wideId);
  const narrowId = await mkLoad(p, 1);
  await p.evaluate((id) => lgOpen(id), narrowId); await p.waitForTimeout(300);
  ok('3 a normal load starts with one tick: "This load needs a permit"', await p.evaluate(() => /This load needs a permit/.test(document.querySelector('.lgp-permit').innerText) && document.querySelectorAll('.lgp-permit input[type=checkbox]').length === 1));
  await p.check('.lgp-permit input[type=checkbox]'); await p.waitForTimeout(200);
  ok('3 …ticking it brings the confirm tick and the notes, and a warning until confirmed', await p.evaluate((id) => document.querySelectorAll('.lgp-permit input[type=checkbox]').length === 2 && /Permit notes/.test(document.querySelector('.lgp-permit').innerText) && lgChecks(lgLoad(id)).some((c) => /needs a permit/i.test(c.text)), narrowId));

  /* ---------- 4. Hauler area warning ---------- */
  const areaId = await p.evaluate(() => {
    const u = LG.units.find((x) => x.leg === 'plant-lot' && !x.loadId && x.at === 'plant' && x.wid < 14 && lotById(x.lotId).state === 'SC');
    const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [u.id]), rig = LG.rigs.find((r) => r.haul && r.carrierId === 'house');
    load.rigId = rig.id; load.driver = rig.driver;
    let d = lgAddDays(lgToday(), 3); while (load.stops.some((x) => !lotDay(lgStopLot(x), d).open) || LG.loads.some((l) => l !== load && l.date === d && l.state !== 'cancelled')) d = lgAddDays(d, 1);
    load.date = d; lgOpen(load.id); return load.id;
  });
  await p.waitForTimeout(300);
  const area = await p.evaluate((id) => {
    const load = lgLoad(id); load.permitReq = false;
    const before = lgChecks(load).filter((c) => c.area).length, hauler = LG.rigs.find((r) => r.carrierId === 'hauler-b'), lot = lgStopLot(load.stops[0]);
    load.rigId = hauler.id; load.driver = hauler.driver;
    const warns = lgChecks(load).filter((c) => c.area).map((c) => c.text);
    render();
    return { before, warns, state: lot.state, town: lot.town, bar: document.querySelector('.ops-bar').innerText, covers: lgCarrier('hauler-b').covers };
  }, areaId);
  ok('4 a company trailer gives no area warning', area.before === 0);
  ok('4 a Georgia-only hauler on a load outside Georgia is warned', area.state !== 'GA' ? area.warns.length === 1 && /covers Georgia lots/.test(area.warns[0]) && area.warns[0].includes(area.town) : area.warns.length === 0, JSON.stringify(area));
  ok('4 …and it counts as a warning that needs a typed reason', /warning/.test(area.bar) && /Schedule with a reason/.test(area.bar), area.bar);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.lg-check')].find((x) => /covers Georgia/.test(x.innerText)); c?.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(300);
  await shot(p, 'hauler-area');
  await p.evaluate(([a, b]) => { lgCancel(a); lgCancel(b); }, [areaId, narrowId]);

  /* ---------- 6. Service jobs ---------- */
  ok('6 Service jobs is in the Logistics menu', await p.evaluate(() => { const b = document.querySelector('[data-nav="lg-service"]'); return !!b && b.offsetParent !== null && b.innerText.trim() === 'Service jobs'; }));
  await p.click('[data-nav="lg-service"]'); await p.waitForTimeout(400);
  page = await app(p);
  ok('6 the menu item lights up and the page has no "back to Dispatch"', await p.evaluate(() => document.querySelector('[data-nav="lg-service"]').classList.contains('active') && !document.querySelector('#app .backlink')));
  ok('6 no system words on the page', !/Request: Pending|Manufacturing auto|kind: other|capacity not on file|internal upgrade|No check-in|Unscheduled|Service rigs/.test(page), (page.match(/.{0,30}(Request: Pending|Manufacturing auto|kind: other|capacity not on file|internal upgrade|No check-in|Unscheduled|Service rigs).{0,30}/) || [''])[0]);
  ok('6 plain words in their place', /Waiting for a yes or no/.test(page) && /Asked for by:/.test(page) && /Service trucks/.test(page), page.slice(0, 600));
  await shot(p, 'service', { x: 0, y: 0, width: 1360, height: 820 });
  for (const tab of ['plan', 'set', 'done']) { await p.evaluate((t) => { LGX.jobTab = t; render(); }, tab); await p.waitForTimeout(150); page = await app(p); ok(`6 tab "${tab}" has no system words`, !/Request: |From: |En route|On site|No check-in|Unscheduled|In progress|rig\b/.test(page.replace(/Service trucks[\s\S]*$/, '')), (page.match(/.{0,30}(Request: |From: |En route|On site|No check-in|Unscheduled|In progress|rig\b).{0,30}/) || [''])[0]); }

  /* ---------- 8. Small slips ---------- */
  await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
  page = await app(p);
  ok('8 nothing on the board is "ready 24+ hours"', !/ready (2[4-9]|[3-9]\d) hours/.test(page), (page.match(/ready \d+ hours/g) || []).join(','));
  const late = await p.evaluate(() => { const b = document.querySelector('.lgp-late'); return b ? { tag: b.tagName, text: b.innerText } : null; });
  ok('8 the late chip is a button', late && late.tag === 'BUTTON', JSON.stringify(late));
  if (late) { await p.click('.lgp-late'); await p.waitForTimeout(250); mt = await modalText(p); ok('8 …and it opens the list of late buildings', /past the usual delivery time/.test(mt) && /it was due by/.test(mt) && /(Open (Load|Delivery)|Find it on the board)/.test(mt), mt); await p.evaluate(() => closeModal()); }
  const slip = await p.evaluate(() => {
    const load = LG.loads.find((l) => l.state === 'planned' && l.kind === 'haul') || LG.loads.find((l) => ['planned', 'scheduled'].includes(l.state));
    lgCancelForm(load.id); const title = document.querySelector('.modal h2').innerText; closeModal();
    /* a load to a lot on a day it is closed */
    const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).slice(0, 1).map((u) => u.id), l2 = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids), lot = lgStopLot(l2.stops[0]);
    let d = lgAddDays(lgToday(), 1); while (lotDay(lot, d).open) d = lgAddDays(d, 1);
    l2.rigId = LG.rigs.find((r) => r.haul && r.carrierId === 'house').id; l2.date = d;
    const closed = lgChecks(l2).map((c) => c.text).filter((t) => /closed|appointment/i.test(t));
    lgCancel(l2.id);
    return { title, name: lgLoadName(load), closed };
  });
  ok('8 "Cancel Load AC?" keeps the load’s name as written', slip.title === `Cancel ${slip.name}?`, slip.title);
  ok('8 a closed-day warning writes the day with a capital', slip.closed.length && slip.closed.every((t) => !/\b(sun|mon|tues|wednes|thurs|fri|satur)days?\b/.test(t)), slip.closed.join('|'));
  /* home stop: miles once */
  const homeMiles = await p.evaluate(() => { const l = LG.loads.find((x) => x.kind === 'home' && x.from.type === 'lot' && ['planned', 'scheduled'].includes(x.state)); if (!l) return null; const html = lgStopCard(l, 0, false).replace(/<[^>]+>/g, ' '); return (html.match(/\d+ mi from/g) || []).length; });
  ok('8 a home stop says its miles once', homeMiles === null || homeMiles === 1, String(homeMiles));
  /* drive-time table and settings */
  await p.evaluate(() => go('lg-fleet')); await p.waitForTimeout(300);
  page = await app(p);
  ok('8 the longest day is a setting', /Longest day, leaving to back/.test(page));
  ok('8 the leave-time box is wide enough to read', await p.evaluate(() => { const i = document.querySelector('.dt-fields input[type=time]'); return i.getBoundingClientRect().width >= 130; }));
  await p.evaluate(() => dtTable()); await p.waitForTimeout(250);
  await p.locator('.dt-pair input').nth(2).fill('200'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  let row = await p.evaluate(() => document.querySelectorAll('.dt-pair')[2].innerText);
  ok('8 a typed drive time keeps the road time in view', /your time 3 h 20 min/.test(row) && /road time/.test(row) && /by car/.test(row) && /Use the road time/.test(row), row);
  await p.locator('.dt-pair').nth(2).locator('.lgp-useroad').click(); await p.waitForTimeout(300);
  row = await p.evaluate(() => document.querySelectorAll('.dt-pair')[2].innerText);
  ok('8 "Use the road time" goes back to it', !/your time/.test(row) && /road time/.test(row), row);
  await p.evaluate(() => closeModal());
  const wideNote = await p.evaluate(() => { const w = LG.units.find((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid >= 14); const l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [w.id]); l.rigId = LG.rigs.find((r) => r.haul && r.carrierId === 'house').id; l.date = lgAddDays(lgToday(), 5); const t = dtPanel(l).replace(/<[^>]+>/g, ' '); lgCancel(l.id); return t; });
  ok('8 a wide load’s note says the wide-load percent, not "15% for a loaded truck"', /% for a wide load/.test(wideNote) && !/15% for a loaded truck/.test(wideNote), wideNote.slice(-300));
  /* one "View as" */
  await p.evaluate(() => go('lg-loads')); await p.waitForTimeout(300);
  page = await app(p);
  ok('8 the Loads screen has no "View as" switch of its own', await p.evaluate(() => !document.querySelector('.lgx-viewas')) && /You see every load/.test(page));
  await p.click('.lgp-viewline button:has-text("an outside hauler")'); await p.waitForTimeout(400);
  page = await app(p);
  ok('8 the gear’s "Viewing as" is what changes: now an outside hauler', await p.evaluate(() => adMe().roles.includes('third_party_hauler_subcoordinator')) && /hauler’s view/i.test(page) && /You can look, not change/.test(page), page.slice(0, 300));
  ok('8 the hauler’s view uses plain words', !/PLANT ORIGIN|plant origin|dealer holding|end customer|your carrier scope/i.test(page) && /Pick up at the plant|No loads right now/i.test(page), (page.match(/.{0,30}(plant origin|dealer holding|end customer|carrier scope).{0,30}/i) || [''])[0]);
  await p.click('.lgp-viewline button:has-text("Go back to my own view")'); await p.waitForTimeout(400);
  ok('8 "Go back to my own view" returns', await p.evaluate(() => AD.me === 'u1' && /You see every load/.test(document.querySelector('#app').innerText)));
  await p.click('.lgp-viewline button:has-text("a driver")'); await p.waitForTimeout(400);
  ok('8 as a driver, Loads points to the driver’s day', await p.evaluate(() => adMe().roles.includes('driver') && /driver’s view/i.test(document.querySelector('#app').innerText)));
  await p.evaluate(() => adView('u1')); await p.waitForTimeout(300);

  /* ---------- 9. Run sheet ---------- */
  const rsId = await mkLoad(p, 3);
  await p.evaluate((id) => lgOpen(id), rsId); await p.waitForTimeout(400);
  ok('9 the load page’s button says "Run sheet"', await p.evaluate(() => [...document.querySelectorAll('.lgx-acts button')].some((x) => x.innerText.trim() === 'Run sheet') && /Run sheet, permit and miles/.test(document.querySelector('.lgx-record').innerText)));
  await p.click('.lgx-acts button:has-text("Run sheet")'); await p.waitForTimeout(350);
  const rs = await p.evaluate((id) => {
    const load = lgLoad(id), t = document.querySelector('.lgp-rs').innerText, units = lgLoadUnits(load);
    const order = load.stops.map((x) => t.indexOf(lgStopLot(x).town + ' lot'));
    return { t, stops: load.stops.length, items: document.querySelectorAll('.lgp-rs-stops > li').length, ordered: order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), serials: units.every((u) => t.includes(u.id)), sizes: units.every((u) => t.includes(`${u.wid}x${u.len}`)),
      phones: load.stops.every((x) => t.includes(lgStopLot(x).phone)), hours: load.stops.every((x) => t.includes(lotDay(lgStopLot(x), load.date).text)), trailer: t.includes(lgRig(load.rigId).name), day: new Date(load.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
  }, rsId);
  ok('9 one sheet with every stop in order, plus the start and the way back', rs.items === rs.stops + 2 && rs.ordered, JSON.stringify({ items: rs.items, stops: rs.stops, ordered: rs.ordered }));
  ok('9 each stop has an arrival time, the lot’s hours and its phone', (rs.t.match(/Get there about/g) || []).length === rs.stops && rs.hours && rs.phones, rs.t.slice(0, 500));
  ok('9 every building is listed with its serial and size', rs.serials && rs.sizes);
  ok('9 the trailer and a plain date are on it', rs.trailer && rs.t.includes(rs.day) && !/\d{4}-\d\d-\d\dT/.test(rs.t) && !/dealer holding|State: /.test(rs.t), rs.day);
  ok('9 Turbo Assist’s version is hidden until builder notes are on', !/Turbo Assist’s version/.test([...await p.locator('.modal button').allInnerTexts()].join('|')));
  await shot(p, 'run-sheet');
  await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate((id) => { const orig = window.print; let called = 0; window.print = () => called++; lgpRunSheetPrint(id); window.print = orig; const box = document.getElementById('lgp-print'); return { called, printing: document.body.classList.contains('lgp-printing'), shown: getComputedStyle(box).display !== 'none', appHidden: getComputedStyle(document.querySelector('#app')).display === 'none' || getComputedStyle(document.querySelector('main') || document.querySelector('#app')).display === 'none', text: box.innerText.length }; }, rsId);
  await p.emulateMedia({ media: 'screen' });
  ok('9 Print prints only the run sheet', pr.called === 1 && pr.printing && pr.shown && pr.appHidden && pr.text > 200, JSON.stringify(pr));
  await p.evaluate(() => { document.body.classList.remove('lgp-printing'); closeModal(); S.sfNotes = true; });
  await p.evaluate((id) => lgxManifest(id), rsId); await p.waitForTimeout(250);
  await p.click('.modal button:has-text("Turbo Assist’s version")'); await p.waitForTimeout(250);
  mt = await modalText(p);
  ok('9 with builder notes on, Turbo Assist’s own manifest is one click away', /DELIVERY ROUTE MANIFEST/.test(mt), mt.slice(0, 200));
  await p.evaluate((id) => { closeModal(); S.sfNotes = false; lgCancel(id); }, rsId);

  /* ---------- 7. Damage needs proof ---------- */
  const dmg = await p.evaluate(() => {
    const road = LG.loads.find((l) => l.state === 'in_transit'), i = road.stops.findIndex((x) => !x.done);
    if (!road.stops[i].arrived) lgArrive(road.id, i);
    lgOpen(road.id); lgDropForm(road.id, i);
    return { id: road.id, i, isLot: lgStopIsLot(road.stops[i]) };
  });
  await p.waitForTimeout(300);
  if (dmg.isLot) {
    await p.fill('#lg-by', 'Sample Receiver');
    await p.selectOption('#lg-cond', 'Damage noted'); await p.waitForTimeout(150);
    mt = await modalText(p);
    ok('7 marking damage says what is needed', /Damage needs two things/.test(mt) && /What is damaged \(needed\)/.test(mt) && /Photo of the damage \(needed\)/.test(mt), mt);
    await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(200);
    ok('7 damage with no note and no photo is refused', await p.evaluate(([id, i]) => !lgLoad(id).stops[i].done && !!document.querySelector('.modal'), [dmg.id, dmg.i]));
    await p.fill('#lg-dropnote', 'Dent in the back wall'); await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(200);
    ok('7 damage with a note and no photo is refused', await p.evaluate(([id, i]) => !lgLoad(id).stops[i].done, [dmg.id, dmg.i]));
    await shot(p, 'damage');
    await p.setInputFiles('#lg-photo', { name: 'damage.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(300);
    ok('7 damage with a note and a photo goes through', await p.evaluate(([id, i]) => !!lgLoad(id).stops[i].done && /Damage noted · Dent in the back wall/.test(lgLoad(id).stops[i].proof.note) && lgLoad(id).stops[i].proof.photo === 'damage.png', [dmg.id, dmg.i]));
  } else ok('7 (the sample road load’s next stop is a lot)', false, 'next stop is not a lot');
  /* good condition still needs neither */
  const good = await p.evaluate(() => { const ids = LG.units.filter((u) => u.leg === 'plant-lot' && !u.loadId && u.at === 'plant' && u.wid < 14).slice(0, 1).map((u) => u.id), l = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, ids); l.rigId = LG.rigs.find((r) => r.haul).id; l.date = lgToday(); l.state = 'in_transit'; l.startedAt = Date.now() - 36e5; lgArrive(l.id, 0); lgDropForm(l.id, 0); return l.id; });
  await p.waitForTimeout(200); await p.fill('#lg-by', 'Sample Receiver'); await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(250);
  ok('7 "Good · no damage" still needs no note or photo', await p.evaluate((id) => !!lgLoad(id).stops[0].done, good));
  await p.close();

  /* ---------- 5. Phone map ---------- */
  p = await open(true);
  await p.evaluate(() => go('lg-places')); await p.waitForTimeout(500);
  const map = await p.evaluate(() => {
    const hits = [...document.querySelectorAll('.lgp-hit')].map((c) => c.getBoundingClientRect()), list = document.querySelector('.lgp-maplist');
    return { n: hits.length, min: Math.min(...hits.map((r) => Math.min(r.width, r.height))), listShown: !!list && getComputedStyle(list).display !== 'none', towns: LOTS.every((l) => list.innerText.includes(l.town)), btnMin: Math.min(...[...list.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height)), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  ok('5 phone: every lot and plant has a tap area of at least 44 px', map.n >= 23 && map.min >= 44, JSON.stringify(map));
  ok('5 phone: the lots are listed by name under the map, in buttons at least 48 px tall', map.listShown && map.towns && map.btnMin >= 48, JSON.stringify(map));
  ok('5 phone: no sideways scroll', map.sw <= map.cw + 1);
  /* a tap a little off a dot picks the nearest lot */
  const tap = await p.evaluate(() => { const lot = LOTS.find((l) => l.id === 'brunswick'), svg = document.querySelector('.lg-map'), pt = svg.createSVGPoint(); const [x, y] = lgXY(lot); pt.x = x + 14; pt.y = y + 12; const s = pt.matrixTransform(svg.getScreenCTM()); return { x: s.x, y: s.y }; });
  await p.evaluate(() => document.querySelector('.lg-map').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const tap2 = await p.evaluate(() => { const lot = LOTS.find((l) => l.id === 'brunswick'), svg = document.querySelector('.lg-map'), pt = svg.createSVGPoint(); const [x, y] = lgXY(lot); pt.x = x + 14; pt.y = y + 12; const s = pt.matrixTransform(svg.getScreenCTM()); return { x: s.x, y: s.y }; });
  await p.touchscreen.tap(tap2.x, tap2.y); await p.waitForTimeout(350);
  ok('5 phone: a tap near a dot picks that lot', await p.evaluate(() => LG.place === 'lot:brunswick'), await p.evaluate(() => LG.place));
  await p.evaluate(() => document.querySelector('.lg-map').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -70)); await p.waitForTimeout(200);
  await shot(p, 'map-phone');
  await p.locator('.lgp-lotlist button', { hasText: 'Florence' }).click(); await p.waitForTimeout(350);
  ok('5 phone: picking a town from the list opens that lot', await p.evaluate(() => LG.place === 'lot:florence' && /Florence/.test(document.querySelector('.lg-places .stack').innerText)));
  await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
  ok('6 phone: Service jobs is a full-size button on Dispatch', await p.evaluate(() => { const b = document.querySelector('.lgp-servicebtn'); return !!b && b.getBoundingClientRect().height >= 48; }));
  await p.evaluate(() => go('lg-cal')); await p.waitForTimeout(300);
  ok('2 phone: the calendar has no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await p.close();

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
