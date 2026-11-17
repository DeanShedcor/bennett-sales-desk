// Batch 7: plain Performance, one down payment, sales words, short lot list, delivery first. node fix07.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400); return p;
  };
  const quiet = (p) => p.waitForTimeout(4300);
  const wide = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  /* B1 Performance */
  for (const phone of [false, true]) {
    const p = await open(phone), tag = phone ? 'Phone' : 'Computer';
    await p.evaluate(() => go('performance')); await p.waitForTimeout(500);
    const t = await p.locator('#app').innerText();
    ok(`${tag} Performance: no lab words`, !/synthetic|cohort|presumed|evidence|Georgia|Statesboro|Vidalia|processed/i.test(t), (t.match(/.{0,30}(synthetic|cohort|presumed|evidence|Georgia|Statesboro|Vidalia|processed).{0,30}/i) || [''])[0]);
    ok(`${tag} Performance: one date picker`, (await p.locator('#app select').evaluateAll((s) => s.filter((x) => /days|months/.test(x.textContent)).length)) === 1 && !/Time window/.test(t));
    ok(`${tag} Performance: names this lot`, /MONCKS CORNER/i.test(t) && /Buildings on this lot/.test(t) && /Sales at this desk/.test(t));
    ok(`${tag} Performance: no sideways scroll and no table`, (await wide(p)) <= 0 && !(await p.locator('#app table').count()), String(await wide(p)));
    const before = await p.locator('.sp-perfrow').count();
    await p.selectOption('#sp-perf-days', '30'); await p.waitForTimeout(300);
    ok(`${tag} Performance: the picker changes the list`, (await p.locator('.sp-perfrow').count()) <= before && (await p.evaluate(() => S.filter.days === 30 && S.taStatDays === 30)));
    if (!phone) { await p.selectOption('#sp-perf-days', '90'); await p.waitForTimeout(200); await p.locator('.sp-perfrow').first().click(); await p.waitForTimeout(300);
      const m = await p.locator('.modal').innerText(); ok('Performance: a building opens in plain words', /Days on the lot/.test(m) && !/Fictional evidence|interaction testing/.test(m), m.slice(0, 200)); await p.evaluate(() => closeModal());
      if (PIC) { await quiet(p); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: PIC + '-performance.png', clip: { x: 0, y: 150, width: 1360, height: 850 } }); } }
    await p.close();
  }

  /* B2 One down payment */
  {
    const p = await open(false);
    const i = await p.evaluate(() => lots.findIndex((u) => u.status === 'Available'));
    await p.evaluate((i) => openUnit(i), i); await p.waitForTimeout(600);
    const page = await p.locator('.unitprice').innerText();
    const due = num((page.match(/Due at signing\s*\$[\d,.]+/) || [''])[0]);
    const want = await p.evaluate((i) => taRtoCalc(S.term, lots[i].price).minToday, i);
    ok('Lot building: shows "Due at signing" from the office terms', due === want && !/Down payment\s*\$/.test(page), `${due} vs ${want} :: ${page.slice(0, 200)}`);
    if (PIC) { await quiet(p); const r = await p.locator('.unitprice').boundingBox(); await p.evaluate((y) => window.scrollTo(0, y), Math.max(0, r.y - 200)); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '-downpayment.png', clip: { x: 0, y: 60, width: 1360, height: 800 } }); await p.evaluate(() => window.scrollTo(0, 0)); }
    // through to billing for the same building
    await p.evaluate((i) => { pickLot(i); }, i); await p.waitForTimeout(300);
    await p.evaluate(() => { setDelivery('miles', 10); setDelivery('access', 'Clear access'); setDelivery('noGate', true); setDelivery('ground', 'Level'); finalizeForm(); }); await p.waitForTimeout(300);
    if (await p.locator('.modal:has-text("Before you complete the sale")').count()) await p.click('.modal button:has-text("Complete the sale")');
    ok('Lot sale: the delivery pop-up is not shown again (it already asked)', !(await p.locator('#sp-site-miles').count()) && (await p.locator('#customerInfo').count()) === 1);
    for (const [n, v] of Object.entries({ firstName: 'Lot', lastName: 'Buyer', email: 'lot@example.com', phone: '(843) 555-0188', billingStreet: '9 Test Ln', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
    await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(300);
    await p.selectOption('#saleBilling [name=type]', 'Rent-to-own'); await p.waitForTimeout(200);
    await p.selectOption('#saleBilling [name=term]', String(await p.evaluate(() => S.term))).catch(() => {});
    await p.waitForTimeout(200);
    const bill = await p.locator('#ta-due').innerText();
    ok('Billing: the same amount is due at signing', num((bill.match(/\$[\d,.]+/) || [''])[0]) === want, `${bill} vs ${want}`);
    await p.close();
  }

  /* B3 Sales words + B5 delivery first */
  {
    const p = await open(false);
    await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1600);
    let all = '';
    for (let i = 0; i < 8; i++) {
      await p.evaluate(() => { S.expanded = true; refreshSummary(); }); await p.waitForTimeout(150);
      all += '\n' + await p.locator('#app').innerText();
      if (i === 2 && PIC) { await p.evaluate(() => { S.expanded = false; refreshSummary(); }); await quiet(p); await p.screenshot({ path: PIC + '-designer-words.png' }); }
      if (i < 7) { await p.evaluate(() => { S.expanded = false; refreshSummary(); }); await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(300); }
    }
    const bad = all.match(/.{0,40}(reference · confirm|supported by catalog rule|demo package|free upgrade|Reference estimate|Price to confirm|Reference base|sample options|Preview only\. No live order).{0,40}/i);
    ok('Designer: no builder wording on any of the 8 steps', !bad, bad && bad[0]);
    ok('Designer: plain wording is there instead', /Ask the office for the price/.test(all) && /Tax and delivery are added later/.test(all) && /TechShield heat barrier/.test(all));
    await p.evaluate(() => { S.expanded = false; refreshSummary(); });
    await p.locator('.summaryactions button:has-text("Complete the sale")').click(); await p.waitForTimeout(600);
    ok('Custom sale: the delivery questions come first', (await p.locator('#sp-site-miles').count()) === 1 && !(await p.locator('#customerInfo').count()), await p.locator('.modal h2').innerText().catch(() => 'no modal'));
    await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(300);
    ok('Custom sale: cannot go on with questions unanswered', (await p.locator('#sp-site-miles').count()) === 1);
    await p.fill('#sp-site-miles', '72'); await p.waitForTimeout(150);
    ok('Custom sale: the charge shows as the miles are typed', /\$100\.00/.test(await p.locator('#sp-site-fee').innerText()), await p.locator('#sp-site-fee').innerText());
    await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level');
    if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-delivery-first.png', clip: { x: 230, y: 60, width: 900, height: 880 } }); }
    await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(500);
    let m = await p.locator('.modal').innerText();
    ok('Customer form: shows the delivery charge', (await p.locator('#customerInfo').count()) === 1 && /Delivery\.\s*\$100\.00 for 72 miles/.test(m), m.slice(0, 200));
    ok('Customer form: plain field names', !/Fictional|Simulated/.test(m));
    for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
    await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
    m = await p.locator('.modal').innerText();
    ok('Billing: shows the delivery charge and plain money words', /Delivery\.\s*\$100\.00/.test(m) && /taken today/.test(m) && !/Simulated deposit|demo amount|Preview estimates/.test(m), m.slice(0, 300));
    await p.selectOption('#saleBilling [name=type]', 'Cash purchase'); await p.fill('#saleBilling [name=deposit]', '520');
    await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(500);
    m = await p.locator('.modal').innerText();
    const building = await p.evaluate(() => amount());
    ok('Review: building and delivery together is shown', new RegExp('Building and delivery together:\\s*\\$' + (building + 100).toLocaleString('en-US', { minimumFractionDigits: 2 }).replace(/[.$]/g, '\\$&')).test(m), m.slice(0, 400));
    ok('Review: no longer says the questions are still to ask', !/delivery-site questions/.test(m));
    await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(800);
    const row = p.locator('.sf-step:has-text("Delivery site questions")').first();
    const rt = await row.innerText();
    ok('Order page: the delivery step arrives answered', /72 mi from the lot/.test(rt) && /Change/.test(rt) && (await row.locator('.od-check.on').count()) === 1, rt);
    ok('Order: the $100 delivery charge is on the order', await p.evaluate(() => sfSale().money.fees.some((f) => /^Delivery · 72 miles/.test(f.name) && f.amount === 100)));
    // the lock after signing still works
    await p.click(`.sf-step button[onclick="sfSignDoc('invoice')"]`); await p.waitForSelector('#sf-pad');
    const box = await p.locator('#sf-pad').boundingBox(); await p.mouse.move(box.x + 40, box.y + 100); await p.mouse.down(); await p.mouse.move(box.x + 300, box.y + 60, { steps: 12 }); await p.mouse.up();
    await p.check('#sf-agree'); await p.click('#sf-sign'); await p.waitForTimeout(400);
    ok('Order page: the answers lock once the invoice is signed', /Locked: the invoice is signed/.test(await row.innerText()) && (await row.locator('button:has-text("Unsign and change")').count()) === 1);
    // a second sale starts with no answers carried over
    await p.evaluate(() => { go('home'); }); await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1200);
    ok('A new sale starts with no delivery answers', await p.evaluate(() => !S.sitePre));
    await p.close();
  }

  /* B4 My lot */
  {
    const p = await open(true);
    await p.evaluate(() => go('lot')); await p.waitForTimeout(700);
    const rows = await p.locator('.sp-lotrow').count();
    const first = await p.locator('.sp-lotrow').first().boundingBox();
    ok('Phone My lot: opens as a short list', rows > 5 && (await p.locator('.lotcard').count()) === 0, String(rows));
    ok('Phone My lot: several buildings fit on one screen', first && first.height <= 110, JSON.stringify(first));
    let t = await p.locator('#app').innerText();
    ok('Phone My lot: build age and lot value are hidden', !/days ago|lot value|average days since built/i.test(t), (t.match(/.{0,30}(days ago|lot value|average days).{0,20}/i) || [''])[0]);
    ok('Phone My lot: no sideways scroll', (await wide(p)) <= 0);
    if (PIC) { await quiet(p); const y = await p.evaluate(() => document.querySelector('.sp-lottools').getBoundingClientRect().top + scrollY - 150); await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(400); await p.screenshot({ path: PIC + '-mylot-phone.png' }); await p.evaluate(() => window.scrollTo(0, 0)); }
    await p.locator('.sp-lottools button:has-text("Staff details")').click(); await p.waitForTimeout(300);
    t = await p.locator('#app').innerText();
    ok('Staff details brings lot value back', /lot value/.test(t));
    await p.locator('.sp-lottools button:has-text("Photos")').click(); await p.waitForTimeout(400);
    ok('Photos brings the cards back', (await p.locator('.lotcard').count()) > 5 && /days ago/.test(await p.locator('#app').innerText()));
    await p.locator('.sp-lottools button:has-text("Short list")').click(); await p.waitForTimeout(300);
    await p.locator('.sp-lotrow').first().click(); await p.waitForTimeout(500);
    ok('Tapping a row opens the building', await p.evaluate(() => S.page === 'unit' || S.page === 'sale'));
    await p.close();
    const c = await open(false);
    await c.evaluate(() => go('lot')); await c.waitForTimeout(600);
    ok('Computer My lot: still opens as photo cards, with build age hidden', (await c.locator('.lotcard').count()) > 5 && !/Built \d+ days ago/.test(await c.locator('#app').innerText()));
    await c.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
