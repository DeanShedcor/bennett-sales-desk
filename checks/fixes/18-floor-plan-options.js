// Options on the floor plan (workbench, shelving, partition wall, loft, framed opening). node fix18.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
const BENCH = 'Workbench (per LF)', SHELF = 'Three Tier Shelving (per LF)', WALL = 'Partition Wall (per linear foot)', LOFT = 'Additional Loft (PER SQ FT)', ULOFT = 'U Loft (per SQ FT)', FRAME = 'Custom Frame Out';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const quiet = (p) => p.evaluate(() => { const t = document.getElementById('toast'); if (t) { t.className = t.className.replace('show', ''); t.textContent = ''; } });
  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer';
    const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    const load = async () => { await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300); };
    await load();
    await p.evaluate(() => { localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    await p.evaluate(() => { change('size', '12x20'); for (let i = 1; i < steps.length; i++) goStep(i); }); await p.waitForTimeout(500);
    const F = await p.evaluate(() => steps.indexOf('Finish'));
    ok(`${tag}: on the Finish step with no options there is no card`, await p.evaluate((F) => S.step === F, F) && !(await p.locator('#fp-ask').count()));
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: with no options the quote form opens as before`, await p.locator('#qcustomer').count() === 1);
    await p.evaluate(() => closeModal());

    // add the options: one through the screen's own box, the rest directly
    const box = await p.evaluate((n) => 'ta-x-' + TA_ADDONS.findIndex((a) => a[0] === n), BENCH);
    await p.fill('#' + box, '6'); await p.locator('#' + box).dispatchEvent('change'); await p.waitForTimeout(400);
    await p.evaluate(([s, w, l, f]) => { taAddonSet(s, 8); taAddonSet(w, 5); taAddonSet(l, 48); taAddonSet(f, 1); }, [SHELF, WALL, LOFT, FRAME]); await p.waitForTimeout(500);
    let card = await p.locator('#fp-ask').innerText();
    ok(`${tag}: the card says the builder needs to know where these go, and lists each one`, /The builder needs to know where these go/.test(card) && /Workbench · 6 ft/.test(card) && /Shelving · 8 ft/.test(card) && /Partition wall · 5 ft/.test(card) && /Loft · 48 sq ft/.test(card) && /Framed opening/.test(card) && /5 are left/.test(card) && /Edit floor plan/.test(card), card);
    ok(`${tag}: every piece starts not placed`, await p.evaluate(() => fpPieces(S.c).length === 5 && fpLeft(S.c).length === 5));
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.locator('#fp-ask').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const r = await p.locator('#fp-ask').boundingBox(); await p.screenshot({ path: PIC + '-card.png', clip: { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 20), width: Math.min(1100, r.width + 40), height: r.height + 40 } }); }

    // blocked every way
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: Create quote is blocked`, !(await p.locator('#qcustomer').count()));
    const toast = await p.locator('#toast').innerText().catch(() => '');
    ok(`${tag}: the message says what to place`, /Place the workbench.*on the floor plan first/i.test(toast), toast);
    if (PIC && !phone) { await p.locator('#fp-ask').scrollIntoViewIfNeeded(); await p.screenshot({ path: PIC + '-blocked.png' }); }
    await p.evaluate(() => whenBuildReady(finalizeForm)); await p.waitForTimeout(300);
    ok(`${tag}: Complete the sale is blocked`, !(await p.locator('.modal').count()));
    await p.evaluate(() => quoteForm()); await p.waitForTimeout(300);
    ok(`${tag}: the step's own "Review and create quote" button is blocked`, !(await p.locator('#qcustomer').count()));
    await p.evaluate((F) => goStep(F - 2), F); await p.waitForTimeout(200);
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(400);
    ok(`${tag}: from an earlier step it sends the salesperson to the card`, await p.evaluate((F) => S.step === F, F) && await p.locator('#fp-ask.ask').count() === 1);
    await p.waitForTimeout(4300);

    // the editor
    await p.click('#fp-ask button:has-text("Edit floor plan")'); await p.waitForTimeout(800);
    let tray = await p.locator('#fp-tray').innerText();
    ok(`${tag}: the floor plan opens with "Still to place: 5 of 5"`, /Still to place: 5 of 5/.test(tray), tray);
    const geo = await p.evaluate(() => {
      const sh = bsShape(S.c), g = bsEdGeom(sh), out = { Sc: g.Sc };
      for (const k of ['xb', 'xs', 'xw', 'xl', 'xf0']) { const el = document.querySelector(`#bs-edsvg g[data-key="${k}"] polygon:not([fill="none"]), #bs-edsvg g[data-key="${k}"] line`); const r = el && el.getBBox(); out[k] = r ? [r.width, r.height] : null; }
      return out;
    });
    const near = (a, b) => Math.abs(a - b) < 1.5;
    ok(`${tag}: the workbench is drawn 6 ft long and 2 ft deep`, geo.xb && near(geo.xb[0], 6 * geo.Sc) && near(geo.xb[1], 2 * geo.Sc), geo);
    ok(`${tag}: the shelving is drawn 8 ft long and 1.5 ft deep`, geo.xs && near(geo.xs[0], 8 * geo.Sc) && near(geo.xs[1], 1.5 * geo.Sc), geo);
    ok(`${tag}: the partition wall runs 5 ft into the building`, geo.xw && near(Math.max(...geo.xw), 5 * geo.Sc), geo);
    ok(`${tag}: the loft covers 48 sq ft (12 ft across, 4 ft deep)`, geo.xl && near(Math.max(...geo.xl), 12 * geo.Sc) && near(Math.min(...geo.xl), 4 * geo.Sc), geo);
    ok(`${tag}: the framed opening is on the plan`, !!geo.xf0);
    if (PIC && phone) { await p.waitForTimeout(300); await quiet(p); await p.screenshot({ path: PIC + '-plan-phone.png' }); }

    // drag the workbench to the right side wall
    const from = await p.evaluate(() => { const r = document.querySelector('#bs-edsvg g[data-key="xb"] circle').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const to = await p.evaluate(() => { const sh = bsShape(S.c), g = bsEdGeom(sh), m = document.getElementById('bs-edsvg').getScreenCTM(); const x = g.X0 + 10 * g.Sc, y = g.Y0 + (sh.W - 0.5) * g.Sc; return [x * m.a + m.e, y * m.d + m.f]; });
    await p.evaluate(([x, y]) => window.scrollBy(0, 0), from);
    await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 6 }); await p.mouse.move(to[0], to[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500);
    const bench = await p.evaluate(() => ({ pos: S.c.sheet?.pos?.xb, left: fpLeft(S.c).map((x) => x.key) }));
    ok(`${tag}: dragging the workbench to another wall places it there`, bench.pos && bench.pos.wall === 2 && !bench.left.includes('xb'), bench);
    tray = await p.locator('#fp-tray').innerText();
    ok(`${tag}: the tray counts down to 4 of 5`, /Still to place: 4 of 5/.test(tray), tray);

    // the buttons: tap a chip, "This spot is right", nudge, pick a wall
    await p.click('#fp-tray .fp-chip:has-text("Shelving")'); await p.waitForTimeout(400);
    const info = await p.locator('#bs-edinfo').innerText();
    ok(`${tag}: tapping a chip picks that piece and offers "This spot is right"`, /Shelving · 8 ft/.test(info) && /This spot is right/.test(info) && /Not placed yet/i.test(info), info);
    const hh = await p.evaluate(() => Math.min(...[...document.querySelectorAll('.fp-chip, .fp-here')].map((e) => e.getBoundingClientRect().height)));
    ok(`${tag}: the chips and the button are at least 48 px tall`, hh >= 47.5, hh);
    await p.click('.fp-here'); await p.waitForTimeout(400);
    ok(`${tag}: "This spot is right" places it`, await p.evaluate(() => !fpLeft(S.c).some((x) => x.key === 'xs')));
    const before = await p.evaluate(() => S.c.sheet.pos.xs.at);
    await p.evaluate(() => { BS.sel = 'xs'; bsEdNudge(1); }); await p.waitForTimeout(300);
    ok(`${tag}: "+ 1 ft" moves it one foot`, await p.evaluate((b) => Math.abs(S.c.sheet.pos.xs.at - b - 1) < 0.01, before));
    if (PIC && !phone) { await quiet(p); await p.evaluate(() => { document.getElementById('bsheet').scrollTop = 0; }); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-plan.png' }); }
    await p.evaluate(() => { BS.sel = 'xl'; bsEdToWall(3); }); await p.waitForTimeout(300);
    ok(`${tag}: picking a wall places the loft across it`, await p.evaluate(() => S.c.sheet.pos.xl?.wall === 3 && !fpLeft(S.c).some((x) => x.key === 'xl')));
    // not through a door; warning when in the way of one
    const door = await p.evaluate(() => { const lay = bsLayout(S.c), d = lay.items.find((x) => x.kind === 'door'); bsEdPlace('xf0', d.wi, d.at); const f = bsLayout(S.c).items.find((x) => x.key === 'xf0'); return { d: [d.wi, d.at, d.at + d.w], f: [f.fw, f.at, f.at + f.len], placed: f.placed }; });
    ok(`${tag}: a piece cannot be put through a door opening`, door.f[0] !== door.d[0] || door.f[2] <= door.d[1] + 0.01 || door.f[1] >= door.d[2] - 0.01, door);
    await p.evaluate(() => { fpHere('xf0'); }); await p.waitForTimeout(300);
    const warn = await p.evaluate(() => { bsEdPlace('xw', 0, 1); const it = bsLayout(S.c).items.find((x) => x.key === 'xw'); BS.sel = 'xw'; bsRender(); return { warn: it.warn, card: document.getElementById('bs-edinfo').innerText }; });
    ok(`${tag}: a wall in the way of the door gets a plain warning`, warn.warn.some((t) => /in the way of the .*door/i.test(t)) && /Move it so the door can open/.test(warn.card), warn);
    await p.evaluate(() => { bsEdPlace('xw', 0, 12); bsRender(); }); await p.waitForTimeout(300);
    tray = await p.locator('#fp-tray').innerText();
    ok(`${tag}: when all five are placed the tray turns to "All placed"`, /All placed/.test(tray) && await p.evaluate(() => fpLeft(S.c).length === 0), tray);
    if (PIC && !phone) { await quiet(p); await p.evaluate(() => { BS.sel = null; bsRender(); document.getElementById('bsheet').scrollTop = 0; }); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-placed.png' }); }
    const sheet = await p.evaluate(() => document.querySelector('.bs-pages').innerText);
    ok(`${tag}: the build sheet lists the pieces and where they go`, /Inside options/i.test(sheet) && /Workbench · 6 ft/.test(sheet) && /Shelving · 8 ft/.test(sheet) && /runs 5′|runs 5 ft|into the building/.test(sheet) && !/not placed/i.test(sheet), sheet.slice(0, 600));
    ok(`${tag}: the printed plan draws each piece`, await p.evaluate(() => document.querySelectorAll('.bs-pages .fp-piece').length >= 5));
    await p.evaluate(() => closeBuildSheet()); await p.waitForTimeout(500);
    card = await p.locator('#fp-ask').innerText();
    ok(`${tag}: back on the Finish step the card is green: "All placed on the floor plan"`, /All placed on the floor plan/.test(card) && await p.locator('#fp-ask.done').count() === 1, card);
    ok(`${tag}: what is included says the pieces are on the floor plan`, await p.evaluate(() => included(S.c).some((x) => /placed on the floor plan/.test(x))));
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: now the quote form opens`, await p.locator('#qcustomer').count() === 1);
    await p.evaluate(() => closeModal());

    // a new amount, a new size
    await p.evaluate((n) => taAddonSet(n, 7), BENCH); await p.waitForTimeout(400);
    let left = await p.evaluate(() => fpLeft(S.c).map((x) => x.key));
    ok(`${tag}: a new amount makes only that piece "not placed yet" again`, left.length === 1 && left[0] === 'xb', left);
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: and the sale is blocked again`, !(await p.locator('#qcustomer').count()));
    await p.evaluate(() => { fpOpen(); fpHere('xb'); closeBuildSheet(); }); await p.waitForTimeout(400);
    ok(`${tag}: placing it again clears it`, await p.evaluate(() => fpLeft(S.c).length === 0));
    await p.evaluate(() => change('size', '12x24')); await p.waitForTimeout(400);
    ok(`${tag}: a new building size asks for every piece to be placed again`, await p.evaluate(() => fpLeft(S.c).length === 5));
    await p.evaluate(() => { change('size', '12x20'); }); await p.waitForTimeout(300);
    ok(`${tag}: going back to the size they were placed for keeps the spots`, await p.evaluate(() => fpLeft(S.c).length === 0));

    // with electrical: one visit answers both; Yes stays for the electrical part only
    await p.evaluate(([b]) => { change('electrical', 'Basic'); taAddonSet(b, 6); }, [BENCH]); await p.waitForTimeout(400);
    ok(`${tag}: with electrical added, both questions are open`, await p.evaluate(() => !S.c.elecPlace && fpLeft(S.c).length === 1));
    await p.evaluate(() => { fpOpen(); fpHere('xb'); closeBuildSheet(); }); await p.waitForTimeout(500);
    ok(`${tag}: one visit to the floor plan answers the electrical question too`, await p.evaluate(() => S.c.elecPlace === 'edited' && fpLeft(S.c).length === 0));
    await p.evaluate(([b]) => { elecPlaceAgain(); elecPlaceDefault(); taAddonSet(b, 5); }, [BENCH]); await p.waitForTimeout(400);
    ok(`${tag}: "Yes" covers the electrical only; the workbench still has to be placed`, await p.evaluate(() => S.c.elecPlace === 'default' && fpLeft(S.c).length === 1));
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: so the sale is still blocked`, !(await p.locator('#qcustomer').count()));
    await p.evaluate(() => { fpOpen(); fpHere('xb'); closeBuildSheet(); }); await p.waitForTimeout(400);
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    if (!phone) {
      // the draft keeps the pieces
      await p.evaluate(() => go('home')); await p.waitForTimeout(400);
      await load();
      await p.click('#sale-draft button:has-text("Resume")'); await p.waitForTimeout(1500);
      ok('The kept sale comes back with every piece still placed', await p.evaluate(() => fpPieces(S.c).length === 5 && fpLeft(S.c).length === 0 && S.c.sheet.pos.xs.wall != null));
      // a U-shaped loft
      await p.evaluate(([u]) => taAddonSet(u, 80), [ULOFT]); await p.waitForTimeout(300);
      ok('A U-shaped loft joins the list and needs placing', await p.evaluate(() => fpLeft(S.c).map((x) => x.key).join() === 'xu'));
      await p.evaluate(() => { fpOpen(); fpHere('xu'); }); await p.waitForTimeout(400);
      ok('The U-shaped loft is drawn as a band with two arms', await p.evaluate(() => document.querySelectorAll('#bs-edsvg g[data-key="xu"] polygon[fill^="url"]').length === 3));
      await p.evaluate(([u]) => { closeBuildSheet(); taAddonSet(u, 0); }, [ULOFT]); await p.waitForTimeout(400);
      // the quote, then the order
      await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(400);
      await p.fill('#qcustomer', 'Jamie Sample'); await p.fill('#qsign', 'Riley Desk');
      await p.locator('.modal button:has-text("Sign")').first().click(); await p.waitForTimeout(700);
      const q = await p.evaluate(() => { const q = S.quotes[S.quotes.length - 1]; return { pos: Object.keys(q.c.sheet?.pos || {}), text: document.getElementById('app').innerText }; });
      ok('The quote carries the spots and says the pieces are placed on the floor plan', q.pos.includes('xb') && q.pos.includes('xs') && /placed on the floor plan/.test(q.text), q.pos);
      // a fresh sale through to the order
      await p.evaluate(() => { S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
      await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
      await p.evaluate(([b, s]) => { change('size', '12x20'); for (let i = 1; i < steps.length; i++) goStep(i); taAddonSet(b, 6); taAddonSet(s, 8); }, [BENCH, SHELF]); await p.waitForTimeout(500);
      await p.evaluate(() => { fpOpen(); fpHere('xb'); fpHere('xs'); closeBuildSheet(); }); await p.waitForTimeout(500);
      await p.locator('#app button:has-text("Complete the sale"):visible').first().click(); await p.waitForTimeout(700);
      if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(500); }
      for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
      await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
      await p.selectOption('#saleBilling [name=type]', 'Cash purchase'); await p.waitForTimeout(300);
      await p.fill('#saleBilling [name=deposit]', '600');
      await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(500);
      await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(900);
      const ord = await p.evaluate(() => { const s = sfSale(); return s ? { id: s.id, pos: Object.keys(s.c.sheet?.pos || {}), left: fpLeft(s.c).length } : null; });
      ok('The order carries the placed pieces', ord && ord.pos.includes('xb') && ord.pos.includes('xs') && ord.left === 0, ord);
      await p.waitForTimeout(4300);
      await p.evaluate((id) => openBuildSheet(id), ord.id); await p.waitForTimeout(700);
      const plant = await p.evaluate(() => ({ text: document.querySelector('.bs-pages').innerText, drawn: document.querySelectorAll('.bs-pages .fp-piece').length }));
      ok('The build sheet the plant opens draws and lists the workbench and shelving', plant.drawn >= 2 && /Workbench · 6 ft/.test(plant.text) && /Shelving · 8 ft/.test(plant.text) && /Inside options/i.test(plant.text), plant.text.slice(0, 400));
      if (PIC) { await p.evaluate(() => { const el = document.querySelector('.bs-pages .bs-page'); document.getElementById('bsheet').scrollTop = el.offsetTop - 60; }); await p.waitForTimeout(400); await p.screenshot({ path: PIC + '-plant.png' }); }
      await p.evaluate(() => bsConfirm()); await p.waitForTimeout(300);
      ok('With every piece placed, the layout can be confirmed on the order', await p.evaluate(() => !!sfSale().c.sheet.ok));
      await p.evaluate(([b]) => { const s = sfSale(); s.c.extras[b] = 9; s.c.sheet.ok = null; bsConfirm(); }, [BENCH]); await p.waitForTimeout(300);
      ok('If a piece has no spot, the layout cannot be confirmed', await p.evaluate(() => !sfSale().c.sheet.ok && BS.edit === true && BS.sel === 'xb'));
      await p.evaluate(() => closeBuildSheet());
    }
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
