// The designer's bottom bar: a green Price details button by the total, everything one height.
// node 23-price-bar.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (opt) => {
    const p = await (await b.newContext(opt)).newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(500);
    return p;
  };
  const box = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), b: Math.round(r.bottom), r: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width), cut: e.scrollWidth > e.clientWidth + 1 }; }, s);
  const noSide = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  for (const w of [1194, 1366, 1600]) {
    const p = await open({ viewport: { width: w, height: 820 }, deviceScaleFactor: w === 1194 ? 2 : 1 });
    const more = await box(p, '.deal-details .deal-more'), months = await box(p, '.deal-terms > div'), m1 = await box(p, '.deal-terms > div button'), total = await box(p, '.deal-total'), bud = await box(p, '.deal-flags .budget'), cont = await box(p, '.bar-continue'), sub = await box(p, '.deal-name small');
    ok(`${w}: Price details is its own button, right after the building total`, more && total && more.l >= total.r && bud && more.r <= bud.l, JSON.stringify({ more, total, bud }));
    ok(`${w}: the button is green with white capital words on two lines`, await p.evaluate(() => { const e = document.querySelector('.deal-more'), s = getComputedStyle(e), t = getComputedStyle(e.querySelector('span')); return s.backgroundColor === 'rgb(31, 157, 85)' && s.color === 'rgb(255, 255, 255)' && t.textTransform === 'uppercase' && t.textAlign === 'center' && e.querySelector('span').getBoundingClientRect().height > 24; }));
    ok(`${w}: the month boxes show, and each is a square as tall as the button`, months && m1 && m1.h === 48 && m1.w === 48 && more.h === 48, JSON.stringify({ m1, more }));
    ok(`${w}: the button, months, budget and Continue are one height on one line`, [more, months, bud, cont].every((x) => x && x.h === 48 && x.b === more.b), JSON.stringify({ more, months, bud, cont }));
    ok(`${w}: the picked month is yellow`, await p.evaluate(() => getComputedStyle(document.querySelector('.deal-terms button.active')).backgroundColor !== 'rgb(255, 255, 255)' && document.querySelector('.deal-terms button.active').textContent.trim() === String(S.term)));
    ok(`${w}: the line under the building name is not cut short`, sub && !sub.cut, JSON.stringify(sub));
    ok(`${w}: nothing runs past the edge of the screen`, await noSide(p) && cont.r <= w);
    if (PIC && w === 1194) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-bar.png`, clip: { x: 0, y: 690, width: w, height: 130 } }); await p.screenshot({ path: `${PIC}-page.png` }); }
    await p.click('.deal-details'); await p.waitForTimeout(400);
    ok(`${w}: pressing it opens the price lines and the button reads HIDE DETAILS`, await p.evaluate(() => S.expanded === true && !!document.querySelector('.deal-drawer .pricelines') && /Hide details/i.test(document.querySelector('.deal-details').textContent)));
    if (PIC && w === 1194) await p.screenshot({ path: `${PIC}-open.png` });
    await p.click('.deal-details'); await p.waitForTimeout(400);
    ok(`${w}: pressing it again closes them`, await p.evaluate(() => !S.expanded && /Price details/i.test(document.querySelector('.deal-details').textContent)));
    await p.click('.deal-terms button:has-text("36")'); await p.waitForTimeout(300);
    ok(`${w}: picking 36 months still changes the payment, and the button is still in place`, await p.evaluate(() => S.term === 36 && /36/.test(document.querySelector('.deal-monthly small').textContent) && document.querySelectorAll('.deal-details').length === 1));
    await p.click('.deal-toggle'); await p.waitForTimeout(300);
    ok(`${w}: pressing the building name still opens the price lines too`, await p.evaluate(() => S.expanded === true));
    await p.evaluate(() => { S.expanded = false; goStep(steps.length - 1); }); await p.waitForTimeout(500);
    const last = await box(p, '.summaryactions');
    ok(`${w}: on the last step the finish buttons fit`, await noSide(p) && last && last.r <= w && await p.evaluate(() => document.querySelectorAll('.deal-details').length === 1), JSON.stringify(last));
    { const nm = await box(p, '.deal-name strong'); ok(`${w}: on the last step the building's name is still readable`, nm && !nm.cut, JSON.stringify(nm)); }
    if (PIC && w === 1194) await p.screenshot({ path: `${PIC}-last.png`, clip: { x: 0, y: 690, width: w, height: 130 } });
    await p.close();
  }
  for (const w of [1000, 1100]) {
    const p = await open({ viewport: { width: w, height: 800 } });
    const more = await box(p, '.deal-details .deal-more'), cont = await box(p, '.bar-continue');
    ok(`${w}: the green button shows and nothing runs past the edge`, more && more.h === 48 && cont && cont.r <= w && await noSide(p), JSON.stringify({ more, cont }));
    await p.evaluate(() => goStep(steps.length - 1)); await p.waitForTimeout(500);
    const last = await box(p, '.summaryactions');
    ok(`${w}: on the last step the finish buttons fit`, await noSide(p) && last && last.r <= w, JSON.stringify(last));
    if (PIC && w === 1000) await p.screenshot({ path: `${PIC}-1000.png`, clip: { x: 0, y: 660, width: w, height: 140 } });
    await p.close();
  }
  { const p = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const more = await box(p, '.deal-more');
    ok('Phone: the bar keeps its own layout, with a green Price details button', more && !(await p.locator('.deal-details').count()) && await p.evaluate(() => getComputedStyle(document.querySelector('.deal-more')).backgroundColor === 'rgb(31, 157, 85)'), JSON.stringify(more));
    ok('Phone: no sideways scroll', await noSide(p));
    ok('Phone: the button says PRICE DETAILS', await p.evaluate(() => { const e = document.querySelector('.deal-more span'); return e.offsetParent !== null && /price details/i.test(e.textContent); }));
    await p.locator('.deal-toggle').click(); await p.waitForTimeout(400);
    ok('Phone: pressing it opens the price lines', await p.evaluate(() => S.expanded === true));
    await p.evaluate(() => { S.expanded = false; refreshSummary(); }); await p.waitForTimeout(300);
    if (PIC) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-phone.png` }); }
    await p.close(); }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
