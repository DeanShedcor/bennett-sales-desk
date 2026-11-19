// Fix 7 + unfinished sale: a new sale starts blank; an unfinished sale is kept. node fix05.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const load = async () => { await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400); };
  await load();
  ok('Home has no resume card before any sale', !(await p.locator('#sale-draft').count()));
  await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1800);
  const rows = await p.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount]));
  ok('New sale: the base price, Basic electrical and fuel are charged, nothing else', rows.length === 3 && rows[0][1] === 5158 && rows.some((r) => /Basic electrical/.test(r[0]) && r[1] === 205) && rows.some((r) => /Fuel/.test(r[0])), JSON.stringify(rows));
  const bar = await p.locator('.quoteaside').innerText();
  ok('Blank start: the bar says "Set a budget", not under/over budget', /Set a budget/.test(bar) && !/under budget|over budget/.test(bar), bar.slice(0, 300));
  ok('New sale: the bar says Basic electrical', /Basic electrical/.test(bar) && !/None electrical/.test(bar));
  ok('Blank start: no customer name is filled in', (await p.evaluate(() => S.customer)) === '');
  if (PIC) { await p.waitForTimeout(4200); await p.evaluate(() => { S.expanded = true; refreshSummary(); }); await p.waitForTimeout(500); await p.screenshot({ path: PIC + '-blank.png' }); await p.evaluate(() => { S.expanded = false; refreshSummary(); }); }
  // go three steps in, change the size, then leave
  for (let i = 0; i < 3; i++) { await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(350); }
  await p.evaluate(() => change('size', '12x20')); await p.waitForTimeout(300);
  await p.evaluate(() => go('home')); await p.waitForTimeout(500);
  let card = await p.locator('#sale-draft').innerText().catch(() => '');
  ok('Home shows "Pick up where you left off" with the building and step', /Pick up where you left off/i.test(card) && /12x20 Basic Utility/.test(card) && /Step 4 of 8/.test(card), card);
  if (PIC) { await p.waitForTimeout(4200); await p.screenshot({ path: PIC + '-resume.png', clip: { x: 0, y: 150, width: 1360, height: 720 } }); }
  await load();
  card = await p.locator('#sale-draft').innerText().catch(() => '');
  ok('After a refresh the card is still there', /12x20 Basic Utility/.test(card), card);
  await p.click('#sale-draft button:has-text("Resume")'); await p.waitForTimeout(1500);
  ok('Resume returns to the same step and building', await p.evaluate(() => S.page === 'configure' && S.step === 3 && S.c.size === '12x20'));
  // starting a brand new sale does not wipe the kept one until it is touched
  await p.evaluate(() => go('home')); await p.waitForTimeout(300);
  await p.click('#sale-draft button:has-text("Start over")'); await p.waitForTimeout(300);
  ok('Start over removes the card', !(await p.locator('#sale-draft').count()));
  await load();
  ok('…and it stays gone after a refresh', !(await p.locator('#sale-draft').count()));
  // a quote clears the draft, and the quote form starts unsigned
  await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
  for (let i = 0; i < 7; i++) { await p.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(300); }
  await p.locator('.summaryactions button:has-text("Create quote")').click(); await p.waitForTimeout(500);
  ok('Quote form: customer and signature start empty', (await p.inputValue('#qcustomer')) === '' && (await p.inputValue('#qsign')) === '');
  await p.locator('.modal button:has-text("Sign")').first().click(); await p.waitForTimeout(300);
  ok('Quote form: cannot issue without a customer and a signer', await p.locator('#qcustomer').count() === 1 && await p.evaluate(() => S.quotes.length === 0));
  if (PIC) await p.screenshot({ path: PIC + '-quote.png', clip: { x: 330, y: 150, width: 700, height: 620 } });
  await p.fill('#qcustomer', 'Jamie Sample'); await p.fill('#qsign', 'Riley Desk');
  await p.locator('.modal button:has-text("Sign")').first().click(); await p.waitForTimeout(600);
  ok('Quote issues once both are typed', await p.evaluate(() => S.quotes.length === 1 && S.quotes[0].signature.includes('Riley Desk')));
  await p.evaluate(() => go('home')); await p.waitForTimeout(400);
  ok('A quoted sale leaves no resume card', !(await p.locator('#sale-draft').count()));
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
