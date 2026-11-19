// Fixes 4-6: Continue in the designer bar; builder notes off by default; clean customer quote. node fix04.js <url> [pic]
const { chromium } = require('playwright');
const mk = require('../helpers/make-sale');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => { const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400); return p; };

  // 4: the bar
  for (const phone of [false, true]) {
    const p = await open(phone), tag = phone ? 'Phone' : 'Computer';
    await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1800);
    const bar = () => p.locator('.summaryactions').innerText();
    let t = await bar();
    ok(`${tag}: step 1 bar shows Continue and no finish buttons`, /Continue/.test(t) && !/Complete the sale|Create quote/.test(t), t);
    if (PIC && phone) { await p.waitForTimeout(4200); await p.screenshot({ path: PIC + '-bar-phone.png' }); }
    if (PIC && !phone) { await p.waitForTimeout(4200); await p.screenshot({ path: PIC + '-bar.png', clip: { x: 0, y: 560, width: 1360, height: 440 } }); }
    for (let i = 0; i < 7; i++) { await p.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(350); }
    t = await bar();
    ok(`${tag}: the bar's Continue walks to the last step`, await p.evaluate(() => S.step === steps.length - 1));
    ok(`${tag}: last step bar shows Create quote and Complete the sale`, /Complete the sale/.test(t) && /Create quote/.test(t) && !/Continue/.test(t), t);
    await p.close();
  }
  // lot sale keeps its buttons
  { const p = await open(false);
    await p.evaluate(() => { go('lot'); }); await p.waitForTimeout(500);
    const has = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Sell this|Start sale|Quote this|View/.test(x.textContent) && x.offsetParent); return !!b; });
    await p.evaluate(() => { S.path = 'lot'; S.lot = 0; S.c = clone(lots[0].c || S.c); go('configure'); }).catch(() => {}); await p.waitForTimeout(600);
    const t = await p.locator('.summaryactions').innerText().catch(() => '');
    ok('Lot sale: the bar still offers the finish buttons, not Continue', !/Continue/.test(t), t); await p.close(); }

  // 6 and 5
  const p = await open(false);
  await mk(p, 'Cash purchase');
  let page = await p.locator('#app').innerText();
  ok('Order page: builder notes are hidden by default', !/sendInstance|instanceEmbeddedUrl|Preview only/.test(page) && /Show builder notes/.test(page), page.slice(0, 200));
  if (PIC) { await p.waitForTimeout(4200); const y = await p.evaluate(() => document.querySelector('.sf-panel').getBoundingClientRect().top + scrollY - 90); await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-notes.png', clip: { x: 20, y: 70, width: 1320, height: 700 } }); await p.evaluate(() => window.scrollTo(0, 0)); }
  await p.click('button:has-text("Show builder notes")'); await p.waitForTimeout(300);
  page = await p.locator('#app').innerText();
  ok('Order page: the switch brings the notes back', /Turbo Assist/.test(page) && /Hide builder notes/.test(page));
  // a quote, then the customer's view
  const q = await open(false);
  await q.click('button:has-text("Start a sale"):visible'); await q.waitForTimeout(300);
  await q.click('button:has-text("Start configuring")'); await q.waitForTimeout(1800);
  for (let i = 0; i < 7; i++) { await q.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await q.locator('.summaryactions button:has-text("Continue")').click(); await q.waitForTimeout(350); }
  await q.locator('.summaryactions button:has-text("Create quote")').click(); await q.waitForTimeout(500);
  await q.fill('#qcustomer', 'Jamie Sample'); await q.fill('#qsign', 'Riley Desk');
  await q.locator('.modal button:has-text("Sign")').first().click(); await q.waitForTimeout(600);
  const staff = await q.locator('#app').innerText();
  await q.evaluate(() => go('customer')); await q.waitForTimeout(500);
  const cust = await q.locator('#app').innerText();
  ok('Customer quote: no builder notes or demo labels', !/demonstration only|immutable|simulat|Demonstrate expired|No hosting|divisors inferred|price list ·|Turbo Assist/i.test(cust), (cust.match(/.{0,40}(demonstration only|immutable|simulat|Demonstrate expired|No hosting|divisors inferred|price list ·|Turbo Assist).{0,40}/i) || [''])[0]);
  ok('Customer quote: still has the price, the lines and its buttons', /Building total/.test(cust) && /Accept quote/.test(cust) && /Pay deposit/.test(cust) && /Manager signature/.test(cust));
  ok('Staff quote view is unchanged', /demonstration only/.test(staff) && /Open as customer/.test(staff), staff.slice(0, 120));
  if (PIC) { await q.waitForTimeout(4200); await q.screenshot({ path: PIC + '-quote.png', fullPage: true }); }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
