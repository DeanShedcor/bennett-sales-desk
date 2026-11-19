// A salesperson's feedback: building details in three groups, a one-page flyer with a QR code,
// roll-up doors on barns, and the roof picked on Exterior before Colors.
// node 24-salesperson-feedback.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); localStorage.removeItem('sales:flyer-name'); window.__printed = 0; window.print = () => { window.__printed++; }; }); await p.waitForTimeout(300);
    return p;
  };
  const noSide = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const at = async (p, n) => { await p.evaluate((n) => goStep(steps.indexOf(n)), n); await p.waitForTimeout(450); };
  const start = async (p) => { await p.evaluate(() => { S.saleLead = null; go('start'); }); await p.waitForTimeout(300); await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1400); };

  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);

    // ---------- 1: building details ----------
    const U = await p.evaluate(() => lots.findIndex((u) => u.features.some((f) => /standard siding color$/i.test(f))));
    await p.evaluate((i) => { S.unit = i; go('unit'); }, U); await p.waitForTimeout(700);
    const det = await p.evaluate(() => { const s = document.querySelector('.lot-details'); return { h: s?.querySelector('h2')?.textContent, groups: [...s.querySelectorAll('.lot-group')].map((g) => [g.querySelector('h3').textContent, [...g.querySelectorAll('li')].map((li) => li.textContent.trim())]), old: /On this building/.test(document.querySelector('#app').innerText) }; });
    const u = await p.evaluate((i) => ({ colors: lots[i].colors, features: lots[i].features, id: lots[i].id, url: lots[i].url, price: lots[i].price, name: lots[i].name }), U);
    ok(`${tag}: the heading reads "Building details", not "On this building"`, det.h === 'Building details' && !det.old, JSON.stringify(det.h));
    ok(`${tag}: three groups in order: Colors, Package, Options`, det.groups.map((g) => g[0]).join() === 'Colors,Package,Options', JSON.stringify(det.groups.map((g) => g[0])));
    ok(`${tag}: Colors lists siding, trim and roof by name`, det.groups[0][1].join('|') === `Siding: ${u.colors.siding}|Trim: ${u.colors.trim}|Roof: ${u.colors.roof}`, JSON.stringify(det.groups[0]));
    ok(`${tag}: Package holds only the package lines`, det.groups[1][1].length > 0 && det.groups[1][1].every((x) => /package/i.test(x)), JSON.stringify(det.groups[1]));
    ok(`${tag}: Options holds no package line and no repeated color line`, det.groups[2][1].length > 0 && !det.groups[2][1].some((x) => /package|standard siding color/i.test(x)), JSON.stringify(det.groups[2]));
    ok(`${tag}: nothing else was dropped`, det.groups[1][1].length + det.groups[2][1].length === u.features.length - 1, `${det.groups[1][1].length}+${det.groups[2][1].length} of ${u.features.length}`);
    const bare = await p.evaluate(() => { const i = lots.findIndex((u) => !u.features.some((f) => /package/i.test(f))); if (i < 0) return null; S.unit = i; go('unit'); return [...document.querySelectorAll('.lot-details .lot-group')][1].innerText; });
    ok(`${tag}: a building with no package says "No package"`, bare === null || /No package/i.test(bare), bare);
    await p.evaluate((i) => { S.unit = i; go('unit'); }, U); await p.waitForTimeout(600);
    ok(`${tag}: no sideways scroll on the building page`, await noSide(p));
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.locator('.lot-details').scrollIntoViewIfNeeded(); await p.locator('.lot-details').screenshot({ path: `${PIC}-details.png` }); }

    // ---------- 2: the flyer ----------
    ok(`${tag}: the building page has a "Print flyer" button`, await p.locator('.unitactions-row button:has-text("Print flyer")').count() === 1);
    if (PIC && !phone) { await p.locator('.unitactions-row').scrollIntoViewIfNeeded(); await p.locator('.unitactions').screenshot({ path: `${PIC}-flyer-button.png` }); }
    await p.locator('.unitactions-row button:has-text("Print flyer")').click(); await p.waitForTimeout(700);
    const fl = await p.evaluate(() => { const f = document.querySelector('.modal .flyer'); if (!f) return null; const t = (s) => f.querySelector(s)?.innerText || ''; return { top: t('.fl-top'), det: [...f.querySelectorAll('.fl-groups h3')].map((h) => h.textContent), detText: t('.fl-details'), rto: [...f.querySelectorAll('.fl-rto tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())), rtoNote: t('.fl-rto p'), foot: t('.fl-contact'), qr: !!f.querySelector('.fl-qr svg'), qrText: t('.fl-qr'), img: f.querySelector('.fl-photo img')?.getAttribute('src') || '' }; });
    ok(`${tag}: the flyer opens with the name, the size and the price on top`, fl && fl.top.includes(u.name.replace(/ x /g, 'x').slice(0, 5)) && /sq ft/.test(fl.top) && fl.top.includes(await p.evaluate((n) => money(n), u.price)), fl && fl.top);
    ok(`${tag}: it has the building's photo`, fl && fl.img.length > 20, fl && fl.img);
    ok(`${tag}: then Building details in the same three groups`, fl && fl.det.join() === 'Colors,Package,Options' && fl.detText.includes('Siding: ' + u.colors.siding) && !/standard siding color/i.test(fl.detText), fl && fl.detText);
    const want = await p.evaluate((i) => [24, 36, 48, 60].map((t) => [money(payment(lots[i].price, t)), money(spDueAtSigning(lots[i], t).amount)]), U);
    ok(`${tag}: the rent-to-own table shows all four terms`, fl && fl.rto[0].slice(1).join() === '24,36,48,60', fl && JSON.stringify(fl.rto[0]));
    ok(`${tag}: each term shows the same monthly payment and due at signing as the app`, fl && fl.rto[1].slice(1).join() === want.map((x) => x[0]).join() && fl.rto[2].slice(1).join() === want.map((x) => x[1]).join(), fl && JSON.stringify(fl.rto) + JSON.stringify(want));
    ok(`${tag}: it is marked as an estimate before tax`, fl && /Estimate, before tax/.test(fl.rtoNote), fl && fl.rtoNote);
    const lot = await p.evaluate(() => LOTS.find((l) => l.id === DESK_LOT));
    ok(`${tag}: the bottom has the lot's name, address and phone`, fl && fl.foot.includes(lot.town) && fl.foot.includes(lot.street) && fl.foot.includes(lot.zip) && fl.foot.includes(lot.phone), fl && fl.foot);
    ok(`${tag}: and the salesperson's name`, fl && fl.foot.includes(await p.evaluate(() => adMe().name)), fl && fl.foot);
    const link = await p.evaluate((i) => lotFlyerLink(lots[i]), U);
    ok(`${tag}: the QR link is the building's own listing with the flyer tag`, link.startsWith(u.url) && /[?&]utm_source=flyer&utm_medium=qr&utm_campaign=moncks-corner&utm_content=/.test(link) && link.endsWith(encodeURIComponent(u.id)), link);
    ok(`${tag}: the flyer shows a QR code with "Scan to see this building online"`, fl && fl.qr && /Scan to see this building online/.test(fl.qrText));
    ok(`${tag}: a building with no online page gets no QR code`, await p.evaluate((i) => { const v = { ...lots[i], url: '' }; return lotFlyerLink(v) === '' && !/fl-qr/.test(lotFlyerHtml(v)); }, U));
    await p.fill('#fl-name', 'Riley Desk'); await p.waitForTimeout(300);
    ok(`${tag}: typing a name changes the name on the flyer`, /Ask for Riley Desk/.test(await p.locator('.modal .fl-contact').innerText()));
    ok(`${tag}: no sideways scroll with the flyer open`, await noSide(p));
    if (PIC && phone) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-phone.png` }); }
    await p.locator('.modal button:has-text("Print flyer")').click(); await p.waitForTimeout(900);
    ok(`${tag}: Print flyer sends the page to the printer`, await p.evaluate(() => window.__printed === 1 && document.body.classList.contains('fl-printing') && /Riley Desk/.test(document.querySelector('#fl-print').innerText)));
    if (!phone) {
      await p.emulateMedia({ media: 'print' });
      const shown = await p.evaluate(() => [...document.body.children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id || e.tagName));
      ok('On paper only the flyer shows', shown.join() === 'fl-print', shown.join());
      const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      ok('The flyer prints on one page', pages === 1, String(pages));
      if (PIC) { require('fs').writeFileSync(`${PIC}-flyer.pdf`, pdf); }
      // the building with the most lines still fits one page
      await p.emulateMedia({ media: 'screen' });
      const big = await p.evaluate(() => { let k = 0; lots.forEach((u, i) => { if (u.features.length > lots[k].features.length) k = i; }); document.body.classList.remove('fl-printing'); closeModal(); S.unit = k; go('unit'); lotFlyer(k); lotFlyerPrint(k); return k; });
      await p.waitForTimeout(800); await p.emulateMedia({ media: 'print' });
      const pdf2 = await p.pdf({ preferCSSPageSize: true, printBackground: true });
      ok('The building with the most options still prints on one page', (pdf2.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1, String(big));
      await p.emulateMedia({ media: 'screen' });
    }
    await p.evaluate(() => { document.body.classList.remove('fl-printing'); closeModal(); }); await p.waitForTimeout(300);

    // ---------- 3: barns and roll-up doors ----------
    await start(p);
    await p.evaluate(() => change('style', 'Lofted')); await p.waitForTimeout(400);
    await at(p, 'Size');
    const rule = await p.evaluate(() => [...document.querySelectorAll('.ta-rule')].map((e) => e.innerText).join(' '));
    ok(`${tag}: a barn no longer says "No roll-up door"`, !/No roll-up/i.test(rule) && /A barn can have a roll-up door/.test(rule) && /No dormer on a barn/.test(rule), rule);
    await at(p, 'Package');
    ok(`${tag}: a barn can take the Garage Package`, await p.evaluate(() => { const b = [...document.querySelectorAll('#app button.choice')].find((x) => /Garage Package/.test(x.textContent)); return !!b && !b.disabled; }));
    await at(p, 'Openings');
    ok(`${tag}: a barn is offered the sectional garage door`, /Sectional garage door/i.test(await p.locator('#app').innerText()));
    if (PIC && !phone) { await p.waitForTimeout(4300); await at(p, 'Size'); await p.locator('.ta-rule').last().scrollIntoViewIfNeeded(); await p.screenshot({ path: `${PIC}-barn-rollup.png` }); }
    ok(`${tag}: Plant gives no "barn takes no roll-up" warning`, await p.evaluate(() => { const u = { c: { ...S.c, style: 'Lofted', package: 'Garage Package', door: '8x7 Roll-up Door' } }; try { return !tpRuleFlags(u).some((f) => /roll-up|garage/i.test(f[1])); } catch (e) { return 'err ' + e.message; } }) === true);
    ok(`${tag}: Plant still warns about a dormer on a barn`, await p.evaluate(() => { const u = { c: { ...S.c, style: 'Lofted', package: 'Dormer Package' } }; try { return tpRuleFlags(u).some((f) => /Dormers/i.test(f[1])); } catch (e) { return false; } }));
    ok(`${tag}: the Turbo Assist article is flagged with the owner's rule`, await p.evaluate(() => /owner says a barn can have a roll-up/i.test(TA_KB.find((a) => a.id === 'roof-rules').flag || '')));
    await p.evaluate(() => taOpenAnswers('roof-rules')); await p.waitForTimeout(500);
    ok(`${tag}: and the flag shows when the article is opened`, /owner says a barn can have a roll-up/i.test(await p.evaluate(() => document.body.innerText)));
    await p.evaluate(() => { document.querySelector('.ta-sheet-back')?.click(); try { closeModal(); } catch (e) {} }); await p.waitForTimeout(300);
    await p.evaluate(() => go('notes')); await p.waitForTimeout(400);
    ok(`${tag}: the explainer page lists it as an open question`, /Roll-up doors on barns/.test(await p.locator('#app').innerText()) && /Flyer and the QR code/.test(await p.locator('#app').innerText()));

    // ---------- 4: the roof is picked on Exterior ----------
    await start(p);
    ok(`${tag}: the steps still run Exterior, then Colors`, await p.evaluate(() => steps.indexOf('Exterior') + 1 === steps.indexOf('Colors')));
    await at(p, 'Exterior');
    const ext = await p.evaluate(() => { const r = document.querySelector('#roof-pick'); return r ? [...r.querySelectorAll('button.choice')].map((x) => x.innerText.split('\n')[0]) : null; });
    ok(`${tag}: Exterior offers Metal roof and Architectural shingles`, ext && ext.join() === 'Metal roof,Architectural shingles', JSON.stringify(ext));
    ok(`${tag}: the roof choice sits after the siding and the vinyl box`, await p.evaluate(() => { const r = document.querySelector('#roof-pick'), v = document.querySelector('#aw-vinyl'); return !!v && !!(v.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.locator('#roof-pick').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-roofing-exterior.png` }); }
    const before = await p.evaluate(() => amount());
    await p.locator('#roof-pick button:has-text("Architectural shingles")').click(); await p.waitForTimeout(400);
    ok(`${tag}: picking shingles sets the roof and adds its price`, await p.evaluate((b) => S.c.roof === 'Shingles' && amount() > b, before));
    await at(p, 'Colors');
    ok(`${tag}: with shingles, Colors shows no metal roof colors`, await p.locator('#roof-shingle-note').count() === 1 && !(await p.locator('h3:has-text("Metal roof color")').count()));
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.locator('#roof-shingle-note').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-colors-roof.png` }); }
    await at(p, 'Exterior');
    await p.locator('#roof-pick button:has-text("Metal roof")').click(); await p.waitForTimeout(400);
    await at(p, 'Colors');
    ok(`${tag}: with metal, Colors shows the metal roof colors`, await p.locator('h3:has-text("Metal roof color")').count() === 1 && !(await p.locator('#roof-shingle-note').count()));
    await at(p, 'Finish');
    ok(`${tag}: the last step no longer asks about the roof`, !(await p.locator('#app button.choice:has-text("Metal roof")').count()) && !(await p.locator('#app button.choice:has-text("Architectural shingles")').count()));
    ok(`${tag}: the last step still has its options list and finish buttons`, /Complete the sale/.test(await p.locator('.summaryactions').innerText()) && (await p.locator('#app').innerText()).length > 200);
    ok(`${tag}: Silver Bullet has one roof, so no roof choice`, await p.evaluate(() => roofChoiceMarkup({ ...S.c, style: 'Silver Bullet' }) === ''));
    ok(`${tag}: a greenhouse shows its clear roof and no shingles`, await p.evaluate(() => { const h = roofChoiceMarkup({ ...S.c, style: 'Greenhouse' }); return /Clear greenhouse roof/.test(h) && !/shingles/i.test(h); }));
    // a kept sale picks back up with its roof
    await at(p, 'Exterior');
    await p.locator('#roof-pick button:has-text("Architectural shingles")').click(); await p.waitForTimeout(300);
    await at(p, 'Colors'); await p.evaluate(() => go('home')); await p.waitForTimeout(400);
    await p.click('#sale-draft button:has-text("Resume")'); await p.waitForTimeout(1200);
    ok(`${tag}: a kept sale picks up on Colors with the shingle roof`, await p.evaluate(() => steps[S.step] === 'Colors' && S.c.roof === 'Shingles'));
    ok(`${tag}: no sideways scroll in the designer`, await noSide(p));
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
