// Logistics: loads planned ahead, breaking a load apart and pairing it again, and what fits a trailer.
// node 22-load-plan.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} go('logi'); }); await p.waitForTimeout(4400);
    return p;
  };
  const w = (p, ms = 350) => p.waitForTimeout(ms);
  const noSide = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const modalText = (p) => p.locator('.modal').innerText().catch(() => '');
  const why = async (p, text) => { await p.fill('#lp-why', text); await p.click('.modal button:has-text("Add it anyway")'); await w(p); };

  for (const phone of [false, true]) {
    const T = phone ? 'Phone' : 'Computer';
    const p = await open(phone);

    // ---------- 1. Planned ahead ----------
    let sect = await p.locator('.lp-plans').innerText();
    ok(`${T}: Dispatch lists the loads planned ahead, A and B`, /Planned load A/.test(sect) && /Planned load B/.test(sect) && /Planned ahead, before the plant builds/.test(await p.locator('#lg-list').innerText()), sect.slice(0, 200));
    ok(`${T}: each building on a plan reads "Not built yet" with its step at the plant`, (sect.match(/Not built yet/g) || []).length >= 4 && /Planned, not built yet/.test(sect), sect.slice(0, 300));
    ok(`${T}: the sample plan A already has a trailer, a day and a fit label`, /Trailer 1 · aiming for /.test(sect) && /Tight, check first/.test(sect), sect.slice(0, 200));
    ok(`${T}: the board does not run past the edge of the screen`, await noSide(p));
    if (PIC && !phone) { const y = await p.evaluate(() => document.querySelector('.lp-head').getBoundingClientRect().top + scrollY - 20); await p.evaluate((y) => window.scrollTo(0, y), y); await w(p); await p.screenshot({ path: `${PIC}-planned.png`, clip: { x: 0, y: 0, width: 1360, height: 520 } }); await p.evaluate(() => window.scrollTo(0, 0)); }

    await p.click('.lp-plan[data-plan="B"] button:has-text("Open the plan")'); await w(p);
    let m = await modalText(p);
    ok(`${T}: the plan opens with its buildings, a trailer picker and a day`, /Planned load B/.test(m) && /Buildings on this plan/.test(m) && await p.locator('#lp-plan-rig').count() === 1 && await p.locator('#lp-plan-day').count() === 1, m.slice(0, 200));
    ok(`${T}: the plan has the three filter buttons`, /Show only what fits/.test(m) && /Show what might fit/.test(m) && /Show all/.test(m));
    // a trailer that is too short asks for a reason
    await p.selectOption('#lp-plan-rig', 'rig-4'); await w(p);
    m = await modalText(p);
    ok(`${T}: a trailer the plan will not fit asks for a typed reason`, /Will not fit/.test(m) && /too long: 36 ft on a 30 ft trailer/.test(m) && await p.locator('#lp-why').count() === 1, m.slice(0, 200));
    await p.click('.modal button:has-text("Add it anyway")'); await w(p);
    ok(`${T}: no reason, no change`, await p.evaluate(() => !prLoad('B').planRig) && await p.locator('#lp-why').count() === 1);
    await p.click('.modal button:has-text("Go back")'); await w(p);
    await p.evaluate(() => lpPlanOpen('B')); await w(p);
    await p.selectOption('#lp-plan-rig', 'rig-3'); await w(p);
    const day = await p.evaluate(() => lgAddDays(lgToday(), 2));
    await p.fill('#lp-plan-day', day); await p.dispatchEvent('#lp-plan-day', 'change'); await w(p);
    m = await modalText(p);
    ok(`${T}: a 36 ft trailer for 36 ft of buildings reads "Tight, check first"`, await p.evaluate((d) => prLoad('B').planRig === 'rig-3' && prLoad('B').planDay === d, day) && /Tight, check first\s+Fills the trailer/.test(m), m.slice(0, 400));
    ok(`${T}: the plan keeps a history of what was set`, /History/.test(m) && /Trailer: Trailer 3/.test(m) && /Aiming for/.test(m));
    // the filter on buildings that could be added
    const pool = () => p.evaluate(() => [...document.querySelectorAll('#lp-plan-pool .lp-row .lp-fit')].map((x) => x.dataset.fit));
    const all = await pool();
    await p.click('.modal .lp-filters button:has-text("Show only what fits")'); await w(p);
    const fits = await pool();
    ok(`${T}: "Show only what fits" hides what will not fit on the planned trailer`, all.includes('no') && !fits.includes('no') && !fits.includes('tight') && fits.length < all.length, `${all} | ${fits}`);
    ok(`${T}: when nothing is left the list offers "Show all"`, fits.length > 0 || /Show all \d+/.test(await modalText(p)));
    await p.click('.modal .lp-filters button:has-text("Show all")'); await w(p);
    if (PIC && !phone) await p.screenshot({ path: `${PIC}-plan.png` });
    if (PIC && phone) await p.screenshot({ path: `${PIC}-phone.png` });
    ok(`${T}: the plan fits the screen`, await p.evaluate(() => { const r = document.querySelector('.modal').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && document.querySelector('.modal').scrollWidth <= document.querySelector('.modal').clientWidth + 1; }));
    // adding one that will not fit needs a reason
    const firstNo = await p.evaluate(() => [...document.querySelectorAll('#lp-plan-pool .lp-row')].findIndex((r) => r.querySelector('.lp-fit').dataset.fit === 'no'));
    await p.locator('#lp-plan-pool .lp-row').nth(firstNo).locator('button:has-text("Add")').click(); await w(p);
    ok(`${T}: adding a building that will not fit asks why`, await p.locator('#lp-why').count() === 1 && await p.evaluate(() => prLoad('B').units.length === 2));
    await why(p, 'Swapping to a longer trailer');
    ok(`${T}: with a reason it goes on, and the reason is in the history`, await p.evaluate(() => prLoad('B').units.length === 3) && /though it will not fit\. Reason: Swapping to a longer trailer/.test(await modalText(p)));
    // move it to a new planned load, then break that plan apart
    await p.locator('#lp-plan-units .lp-row').nth(2).locator('button:has-text("Move")').click(); await w(p);
    m = await modalText(p);
    ok(`${T}: Move lists the other planned loads with a fit label, and offers a new one`, /Planned load A/.test(m) && /Will not fit|Tight|Fits/.test(m) && /Start planned load C with it/.test(m), m.slice(0, 300));
    await p.click('.modal button:has-text("Start planned load C with it")'); await w(p);
    ok(`${T}: the building moves to a new planned load C`, await p.evaluate(() => prLoad('C')?.units.length === 1 && prLoad('B').units.length === 2) && /Planned load C/.test(await modalText(p)));
    await p.click('.modal button:has-text("Break this plan apart")'); await w(p);
    ok(`${T}: breaking a plan apart asks first`, /Break planned load C apart\?/.test(await modalText(p)));
    await p.click('.modal button:has-text("Break it apart")'); await w(p);
    ok(`${T}: the plan is gone and its letter is free again`, await p.evaluate(() => !prLoad('C') && tpNextCode() === 'C'));
    // "Plan a load ahead" starts the next letter
    await p.click('button:has-text("Plan a load ahead")'); await w(p);
    ok(`${T}: "Plan a load ahead" starts planned load C`, /Planned load C/.test(await modalText(p)) && /Nothing on it yet/.test(await modalText(p)));
    await p.click('.modal button:has-text("Remove this plan")'); await w(p);

    // the calendar and the plant
    await p.evaluate(() => go('lg-cal')); await w(p, 500);
    const chip = await p.locator('.lg-chip.lp-ahead').allInnerTexts();
    ok(`${T}: the calendar shows the planned loads on the day they aim for`, chip.some((t) => /^B/.test(t) && /Trailer 3/.test(t) && /Planned, not built yet/.test(t)), JSON.stringify(chip));
    ok(`${T}: the calendar does not run past the edge of the screen`, await noSide(p));
    await p.evaluate(() => { LG.tab = 'planned'; go('lg-loads'); }); await w(p, 500);
    ok(`${T}: the Loads screen lists the planned-ahead loads on the Planned tab`, /Planned load B/.test(await p.locator('#app').innerText()) && /Loads being put together/.test(await p.locator('#app').innerText()));
    await p.evaluate(() => go('prod')); await w(p, 600);
    const plant = await p.locator('.pr-loads').innerText().catch(() => '');
    ok(`${T}: the plant's load card shows the trailer and day Logistics planned`, /Logistics plan: Trailer 3 · aiming for /.test(plant), plant.slice(0, 300));

    // ---------- 2. The letter stays ----------
    await p.evaluate(() => { const u = prUnit('SAMPLE-1220-3001'); lgAddUnit({ id: u.id, name: u.name, size: u.size, kind: 'stock', lotId: u.lotId, plantId: PLANTS[0].id, leg: 'plant-lot', sample: true }); go('logi'); }); await w(p, 500);
    sect = await p.locator('.lp-plan[data-plan="B"]').innerText();
    ok(`${T}: when one building is built the plan says "1 of 2 built" and "Built, ready to go"`, /1 of 2 built/.test(sect) && /Built, ready to go/.test(sect) && /Not built yet/.test(sect) && /Build this load/.test(sect), sect);
    await p.click('.lp-plan[data-plan="B"] button:has-text("Build this load")'); await w(p, 600);
    let st = await p.evaluate(() => { const l = lgLoad(LG.loadId); return { id: l.id, origin: l.origin, rig: l.rigId, date: l.date, log: l.log.map((e) => e.text).join(' | '), page: S.page }; });
    ok(`${T}: the built building leaves early on B-L1, and the rest of B waits`, st.id === 'B-L1' && st.origin === 'B' && /Broke out of B into B-L1\./.test(st.log) && /still being built/.test(st.log) && st.page === 'lg-load', JSON.stringify(st));
    ok(`${T}: the load carries the trailer and the day from the plan`, st.rig === 'rig-3' && st.date === day && /Planned ahead for Trailer 3/.test(st.log), JSON.stringify(st));
    await p.evaluate(() => { const u = prUnit('SAMPLE-1016-3002'); lgAddUnit({ id: u.id, name: u.name, size: u.size, kind: 'stock', lotId: u.lotId, plantId: PLANTS[0].id, leg: 'plant-lot', sample: true }); lgFromProd('B'); }); await w(p, 600);
    st = await p.evaluate(() => ({ id: LG.loadId, open: prLoadsOpen().map((l) => l.id), next: lgxNextSplit('B') }));
    ok(`${T}: when the last building is built it ships as load B, and the plan leaves the list`, st.id === 'B' && !st.open.includes('B') && st.next === 'B-L2', JSON.stringify(st));

    // ---------- 4. What fits, on a load ----------
    await p.evaluate(() => { const l = LG.loads.find((x) => x.id === 'AD'); lgOpen(l.id); }); await w(p, 600);
    let txt = await p.locator('#app').innerText();
    ok(`${T}: the load page has the three filter buttons over "Add buildings"`, /Add buildings/.test(txt) && await p.locator('.lp-filters').count() >= 1 && /Pick a trailer first/.test(txt));
    await p.evaluate(() => { LG.pick = ['SAMPLE-1012-2112']; lgNewLoad(); lgSet(LG.loadId, 'rigId', 'rig-1'); LG.more = true; render(); }); await w(p, 500);
    const cand = () => p.evaluate(() => [...document.querySelectorAll('.lg-cand')].map((r) => [r.querySelector('.lp-fit')?.dataset.fit, r.querySelector('.lp-why')?.textContent || '']));
    let c = await cand();
    ok(`${T}: every building that could be added says Fits, Tight or Will not fit, with the reason`, c.length > 0 && c.every((x) => ['yes', 'tight', 'no'].includes(x[0])) && c.some((x) => x[0] === 'tight' && /Fills the trailer/.test(x[1])) && c.some((x) => x[0] === 'yes'), JSON.stringify(c));
    await p.evaluate(() => { LG.more = true; lpSetFilter('fits', null); }); await w(p);
    c = await cand();
    ok(`${T}: "Show only what fits" leaves only buildings that fit`, c.length > 0 && c.every((x) => x[0] === 'yes'), JSON.stringify(c));
    await p.evaluate(() => lpSetFilter('might', null)); await w(p);
    c = await cand();
    ok(`${T}: "Show what might fit" adds the tight ones and still hides what will not fit`, c.every((x) => x[0] !== 'no') && c.some((x) => x[0] === 'tight'), JSON.stringify(c));
    await p.evaluate(() => { lpSetFilter('all', null); const id = LG.loadId; lgRemove(id, 'SAMPLE-1012-2112'); lgLoad(id).state = 'cancelled'; lgOpen('AD'); lgSet('AD', 'rigId', 'rig-1'); }); await w(p, 500);
    const rigs = await p.locator('.lp-rigs').innerText();
    ok(`${T}: "Which trailers fit this load" counts fit, tight and will not fit`, /Which trailers fit this load/.test(rigs) && /\d+ fit · \d+ tight · \d+ will not fit/.test(rigs), rigs.slice(0, 120));
    await p.evaluate(() => { LP.rigsOpen = true; render(); }); await w(p);
    const rr = await p.evaluate(() => [...document.querySelectorAll('.lp-rigs .lp-row')].map((r) => [r.querySelector('strong').textContent, r.querySelector('.lp-fit').dataset.fit, r.querySelector('.lp-why')?.textContent || '', r.innerText.includes('Picked')]));
    ok(`${T}: each trailer has a label and a reason; the 30 ft trailer will not fit 32 ft of buildings`, rr.length === 6 && rr.some((x) => x[0] === 'Trailer 4' && x[1] === 'no' && /too long: 32 ft on a 30 ft trailer/.test(x[2])) && rr.some((x) => x[0] === 'Trailer 1' && x[3]), JSON.stringify(rr));
    ok(`${T}: the trailer picker shows the label beside each trailer`, /Trailer 4 · 30 ft.*will not fit/.test(await p.evaluate(() => document.querySelector('.lg-setup select').textContent)));
    if (PIC && !phone) { await p.locator('.lp-rigs').scrollIntoViewIfNeeded(); await w(p); await p.screenshot({ path: `${PIC}-fit.png` }); }
    // a trailer that will not fit
    await p.locator('.lp-rigs .lp-row', { hasText: 'Trailer 4' }).locator('button').click(); await w(p);
    ok(`${T}: picking a trailer the load will not fit asks why`, /Use Trailer 4 anyway\?/.test(await modalText(p)) && await p.evaluate(() => lgLoad('AD').rigId === 'rig-1'));
    await p.click('.modal button:has-text("Go back")'); await w(p);
    // a building that will not fit
    const noRow = await p.evaluate(() => [...document.querySelectorAll('.lg-cand')].findIndex((r) => r.querySelector('.lp-fit')?.dataset.fit === 'no'));
    await p.locator('.lg-cand').nth(noRow).locator('button:has-text("Add")').click(); await w(p);
    ok(`${T}: adding a building that will not fit asks why, and adds nothing yet`, /anyway\?/.test(await modalText(p)) && await p.evaluate(() => lgLoadUnits(lgLoad('AD')).length === 2));
    await why(p, 'Short overhang at the back, flagged');
    st = await p.evaluate(() => { const l = lgLoad('AD'); return { n: lgLoadUnits(l).length, over: l.over?.reason, log: l.log.map((e) => e.text).join(' | ') }; });
    ok(`${T}: with a reason it is added and the reason stays in the load's history`, st.n === 3 && st.over === 'Short overhang at the back, flagged' && /Added though it will not fit\..*Reason: Short overhang/.test(st.log), JSON.stringify(st));

    // ---------- 3. Break apart, and pair again ----------
    ok(`${T}: the load has a "Break this load apart" button`, await p.locator('button.lp-break').count() === 1);
    await p.click('button.lp-break'); await w(p);
    m = await modalText(p);
    ok(`${T}: breaking apart lists the buildings and says they keep the letter`, /Break load AD apart\?/.test(m) && /All 3 buildings go back to the board/.test(m) && /keep the letter AD/.test(m) && /AD-L1/.test(m), m.slice(0, 300));
    if (PIC && !phone) await p.screenshot({ path: `${PIC}-split.png` });
    await p.fill('#lp-break-why', 'One building is not ready'); await p.click('.modal button:has-text("Break it apart")'); await w(p, 600);
    st = await p.evaluate(() => { const l = lgLoad('AD'); return { state: l.state, log: l.log[l.log.length - 1].text, page: S.page, loose: LG.units.filter((u) => u.origin === 'AD' && !u.loadId).length }; });
    ok(`${T}: the load is broken apart and its 3 buildings need a load again`, st.state === 'cancelled' && /Broken apart: One building is not ready\. 3 buildings back on the board\./.test(st.log) && st.page === 'logi' && st.loose === 3, JSON.stringify(st));
    txt = await p.locator('#lg-list').innerText();
    ok(`${T}: on the board they say "Was on load AD" and offer "Put with a load"`, (txt.match(/Was on load AD/g) || []).length >= 2 && /Put with a load/.test(txt));
    const loose = await p.evaluate(() => LG.units.filter((u) => u.origin === 'AD' && !u.loadId && u.at === 'plant').map((u) => u.id));
    await p.evaluate((id) => lpPairForm(id), loose[0]); await w(p);
    m = await modalText(p);
    ok(`${T}: "Put with a load" lists the open loads with a fit label and offers the next load under the letter`, /Put this building with a load/.test(m) && /was on load AD/.test(m) && /Load B/.test(m) && /Fits|Tight, check first|Will not fit/.test(m) && /Start load AD-L1 with it/.test(m), m.slice(0, 400));
    if (PIC && !phone) await p.screenshot({ path: `${PIC}-repair.png` });
    await p.click('.modal button:has-text("Start load AD-L1 with it")'); await w(p, 600);
    st = await p.evaluate(() => { const l = lgLoad(LG.loadId); return { id: l.id, origin: l.origin, n: lgLoadUnits(l).length, log: l.log.map((e) => e.text).join(' | ') }; });
    ok(`${T}: a new load from a loose building keeps the letter: AD-L1`, st.id === 'AD-L1' && st.origin === 'AD' && st.n === 1 && /Put together under load AD: now AD-L1\./.test(st.log), JSON.stringify(st));
    await p.evaluate(() => go('logi')); await w(p);
    await p.evaluate((id) => lpPairForm(id), loose[1]); await w(p);
    ok(`${T}: the new load AD-L1 comes first, marked "same letter"`, /Load AD-L1 · same letter/.test((await p.locator('.modal .lp-row').first().innerText())));
    await p.click('.modal button:has-text("Put on AD-L1")'); await w(p);
    if (await p.locator('#lp-why').count()) await why(p, 'Checked by hand');
    ok(`${T}: the second building joins AD-L1`, await p.evaluate(() => lgLoadUnits(lgLoad('AD-L1')).length === 2));
    await p.evaluate((id) => { LG.pick = [id]; lgNewLoad(); }, loose[2]); await w(p, 500);
    ok(`${T}: the next load made under the letter is AD-L2`, await p.evaluate(() => LG.loadId === 'AD-L2'));
    // a scheduled load needs a reason; a load on the road uses the on-the-road cancel
    await p.evaluate(() => lpBreakForm('AC')); await w(p);
    await p.click('.modal button:has-text("Break it apart")'); await w(p);
    ok(`${T}: a scheduled load cannot be broken apart without a typed reason`, await p.evaluate(() => lgLoad('AC').state === 'scheduled') && /is scheduled for/.test(await modalText(p)));
    await p.evaluate(() => closeModal()); await w(p);
    await p.evaluate(() => lpBreakForm('AB')); await w(p);
    m = await modalText(p);
    ok(`${T}: a load on the road asks with the on-the-road warning and a typed reason`, /on the road\?/.test(m) && /The truck has left/.test(m) && await p.locator('#lgg-cancel-why').count() === 1, m.slice(0, 200));
    await p.fill('#lgg-cancel-why', 'The truck broke down'); await p.click('.modal button:has-text("Cancel this load")'); await w(p, 500);
    ok(`${T}: the building still on that trailer keeps the letter AB`, await p.evaluate(() => lgLoad('AB').state === 'cancelled' && LG.units.some((u) => u.origin === 'AB' && !u.loadId)));
    // a driver cannot change plans
    await p.evaluate(() => { const d = AD.users.find((u) => u.roles.includes('driver')); if (d) adView(d.id); go('logi'); }); await w(p, 500);
    ok(`${T}: a driver does not get "Plan a load ahead" or "Put with a load"`, !(await p.locator('button:has-text("Plan a load ahead")').count()) && !(await p.locator('.lp-pairbtn').count()));
    ok(`${T}: no sideways scroll at the end`, await noSide(p));
    await p.close();
  }
  // the explainer page
  { const p = await open(false);
    await p.evaluate(() => go('lg-notes')); await p.waitForTimeout(500);
    const t = await p.locator('#app').innerText();
    ok('Explainer page: says how Turbo Assist does it, what was added here, and the open questions', /Planned loads, breaking a load apart, and what fits/.test(t) && /still to be accepted/.test(t) && /Height and weight/.test(t) && /Questions for Turbo Assist/.test(t));
    await p.close(); }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
