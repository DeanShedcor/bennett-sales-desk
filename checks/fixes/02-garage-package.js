// Fix 2: Garage Package is $1,280; a 10-wide swaps the 8x7 for a 6x7. node fix02.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(L); await p.waitForTimeout(2200);
  await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400);
  await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1800);
  const rows = () => p.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount]));
  const sum = (r) => r.reduce((a, x) => a + x[1], 0);
  const find = (r, re) => r.find((x) => re.test(x[0]));
  const plain = await rows();
  await p.evaluate(() => change('package', 'Garage Package')); await p.waitForTimeout(300);
  const g = await rows();
  ok('10x16: package line is $1,280', find(g, /8 × 7 Garage Package/)?.[1] === 1280, JSON.stringify(g));
  ok('10x16: 6 × 7 Rollup Door +$730', find(g, /^6 × 7 Rollup Door$/)?.[1] === 730);
  ok('10x16: 8 × 7 Rollup Door (Credit) −$850', find(g, /8 × 7 Rollup Door \(Credit\)/)?.[1] === -850);
  ok('10x16: a garage now costs more than the plain shed', sum(g) > sum(plain), `${sum(plain)} -> ${sum(g)}`);
  ok('10x16: the package sets 7 ft sidewalls, at no charge on a Utility', (await p.evaluate(() => S.c.wallHeight)) === 7 && !find(g, /7 ft sidewalls/) && !find(plain, /7 ft sidewalls/), JSON.stringify(g));
  await p.evaluate(() => change('wallHeight', 6)); await p.waitForTimeout(300);
  ok('The wall height stays 7 ft with the package', (await p.evaluate(() => S.c.wallHeight)) === 7);
  const total = await p.evaluate(() => document.body.innerText.match(/BUILDING TOTAL\s*\$([\d,.]+)/i)?.[1]);
  ok('10x16: the bar total matches the lines', Number((total || '').replace(/,/g, '')) === sum(g), `${total} vs ${sum(g)}`);
  for (let i = 0; i < 2; i++) { await p.locator('button:has-text("Continue"):visible').first().click(); await p.waitForTimeout(350); }
  const step = await p.locator('#app').innerText();
  ok('Step 3 shows +$1,280.00 on the package, not $0', /Garage Package[\s\S]{0,400}\+\$1,280\.00/.test(step) && !/\$0\.00 reference/.test(step));
  ok('Step 3 explains the 6 × 7 swap on a 10-wide', /10-wide building cannot fit/.test(step));
  if (PIC) {
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Price details/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(700);
    await p.screenshot({ path: PIC + '.png' });
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Price details/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(300);
  }
  await p.evaluate(() => change('size', '12x16')); await p.waitForTimeout(300);
  let w = await rows();
  ok('12x16: $1,280 with the standard 8 × 7 and no swap lines', find(w, /8 × 7 Garage Package/)?.[1] === 1280 && !find(w, /Rollup Door/), JSON.stringify(w));
  await p.evaluate(() => change('garageDoorWidth', 9)); await p.waitForTimeout(200); w = await rows();
  ok('12x16 with 9 × 7: $1,370', find(w, /9 × 7 Garage Package/)?.[1] === 1370 && !find(w, /Rollup Door/));
  await p.evaluate(() => change('garageDoorWidth', 6)); await p.waitForTimeout(200); w = await rows();
  ok('12x16 with 6 × 7 chosen: package + swap lines', find(w, /8 × 7 Garage Package/)?.[1] === 1280 && find(w, /^6 × 7 Rollup Door$/)?.[1] === 730 && find(w, /Credit/)?.[1] === -850);
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
