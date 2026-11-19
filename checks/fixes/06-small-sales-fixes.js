// Fix 6: eight small Sales desk fixes. node fix06.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => { const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2200); await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400); return p; };
  const quiet = async (p) => { await p.waitForTimeout(4300); };
  const toCustomer = async (p) => {
    await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1600);
    for (let i = 0; i < 7; i++) { await p.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(300); }
    await p.locator('.summaryactions button:has-text("Complete the sale")').click(); await p.waitForTimeout(600);
    if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(400); } /* delivery questions come first on a custom sale */
  };
  const fillCustomer = async (p, over = {}) => { for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461', ...over })) await p.fill(`#customerInfo [name=${n}]`, v); };

  /* 1. typed entries */
  let p = await open(false);
  await toCustomer(p);
  await fillCustomer(p, { phone: 'abc' }); await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(300);
  ok('1 phone "abc" is refused with a message', await p.locator('#customerInfo').count() === 1 && /10-digit phone/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')));
  await fillCustomer(p, { billingState: 'ZZ' }); await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(300);
  ok('1 state "ZZ" is refused', /two letters/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')));
  if (PIC) { await quiet(p); await p.locator('.sp-fielderror').scrollIntoViewIfNeeded(); await p.waitForTimeout(200); const r = await p.locator('.modal').boundingBox(); await p.screenshot({ path: PIC + '-entries.png', clip: { x: r.x, y: Math.max(0, r.y), width: r.width, height: Math.min(r.height, 1000 - Math.max(0, r.y)) } }); }
  await fillCustomer(p, { billingZip: 'abcde' }); await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(300);
  ok('1 ZIP "abcde" is refused', /5-digit ZIP/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')));
  await fillCustomer(p, { billingState: 'sc' }); await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
  ok('1 good entries go on to Billing', await p.locator('#saleBilling').count() === 1);
  await p.fill('#saleBilling [name=deposit]', '0'); await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(300);
  ok('1 a $0 deposit asks "Take no money today?"', /Take no money today\?/.test(await p.locator('.sp-zero').innerText().catch(() => '')) && await p.locator('#saleBilling').count() === 1);
  if (PIC) { await quiet(p); const r = await p.locator('.modal').boundingBox(); await p.screenshot({ path: PIC + '-zero.png', clip: { x: r.x, y: Math.max(0, r.y), width: r.width, height: Math.min(r.height, 1000 - Math.max(0, r.y)) } }); }
  await p.fill('#saleBilling [name=discount]', '5000'); await p.fill('#saleBilling [name=purpose]', 'Military'); await p.fill('#saleBilling [name=deposit]', '552');
  await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(300);
  ok('1 a deposit above the discounted price is refused', /more than the building costs/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')) && await p.locator('#saleBilling').count() === 1);
  await p.fill('#saleBilling [name=discount]', ''); await p.fill('#saleBilling [name=purpose]', ''); await p.fill('#saleBilling [name=deposit]', '0');
  await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(300);
  await p.click('.sp-zero button:has-text("Yes, take no money today")'); await p.waitForTimeout(400);
  ok('1 "Yes, take no money today" continues', /Create the order/.test(await p.locator('.modal').innerText()));
  await p.close();

  /* 2. RTO identity, on a phone */
  p = await open(true);
  await toCustomer(p); await fillCustomer(p); await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
  await p.selectOption('#saleBilling [name=type]', 'Rent-to-own'); await p.fill('#saleBilling [name=deposit]', '552'); await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(400);
  await p.locator('.modal button:has-text("Create the order")').click(); await p.waitForTimeout(900);
  if (!(await p.locator('#rtoForm').count())) { await p.evaluate(() => rtoApply(0)); await p.waitForTimeout(300); }
  await p.click('#rtoForm button[type=submit]'); await p.waitForTimeout(300);
  const order = await p.evaluate(() => { const f = document.getElementById('rtoForm'), n = f.querySelector('.notice'), d = f.querySelector('.fields'); return { above: !!(n.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING), text: n.textContent, top: n.getBoundingClientRect().top, label: f.elements.ssn.closest('label').textContent, max: f.elements.ssn.maxLength }; });
  ok('2 the warning is kept and sits above the fields', order.above && /do not type a real license or Social Security number/.test(order.text), JSON.stringify(order));
  ok('2 the warning is on the first phone screen', order.top < 844, String(order.top));
  ok('2 only the last 4 digits are asked for', /Last 4 digits/.test(order.label) && order.max === 4, order.label);
  if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-rto.png' }); }
  await p.fill('#rtoForm [name=dl]', 'SAMPLE'); await p.fill('#rtoForm [name=dob]', '2020-01-01'); await p.fill('#rtoForm [name=ssn]', '12');
  await p.setInputFiles('#rtoForm [name=idPhoto]', { name: 'sample-id.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await p.evaluate(() => { document.getElementById('rtoForm').noValidate = true; }); await p.click('#rtoForm button[type=submit]'); await p.waitForTimeout(300);
  ok('2 a 2-digit entry is refused', await p.evaluate(() => RTOF.step === 1) && /last 4 digits only/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')));
  await p.fill('#rtoForm [name=ssn]', '0000'); await p.click('#rtoForm button[type=submit]'); await p.waitForTimeout(300);
  ok('2 a 2020 birth date is refused', await p.evaluate(() => RTOF.step === 1) && /at least 18/.test(await p.locator('.sp-fielderror').innerText().catch(() => '')));
  await p.fill('#rtoForm [name=dob]', '1980-05-05'); await p.click('#rtoForm button[type=submit]'); await p.waitForTimeout(300);
  ok('2 good answers go on, keeping only the last 4 and the photo name', await p.evaluate(() => RTOF.step === 2 && RTOF.a.ssn4 === '0000' && RTOF.a.idPhoto === 'sample-id.png' && RTOF.a.dobGiven === true && !('dob' in RTOF.a) && !('ssn' in RTOF.a) && !('dl' in RTOF.a)), await p.evaluate(() => JSON.stringify(RTOF.a)));
  await p.close();

  /* 3 and 8. Restock */
  p = await open(false);
  await p.evaluate(() => go('stock')); await p.waitForTimeout(500);
  const both = await p.evaluate(() => { const hold = new Set(restockWarnings().map((g) => kindKey(g.c))); return restockSuggestions().filter((g) => hold.has(kindKey(g.c))).length; });
  const names = await p.evaluate(() => [...document.querySelectorAll('#app .grid2 .panel')].map((s) => [...s.querySelectorAll('.advicerow strong')].map((e) => e.textContent)));
  ok('8 no model is under both "Order more" and "Hold off"', both === 0 && !names[0].some((n) => names[1].includes(n)) && names[0].length > 0, JSON.stringify(names));
  const rowsTxt = await p.evaluate(() => [...document.querySelectorAll('.stockrow')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  const walls = rowsTxt.find((t) => /At the plant: Walls/.test(t)) || '';
  ok('3 an order the plant is building cannot be cancelled here', /The plant has started building it/.test(walls) && !/Cancel order/.test(walls), walls);
  const n0 = await p.evaluate(() => S.stock.length);
  await p.locator('.stockrow button:has-text("Cancel order")').first().click(); await p.waitForTimeout(300);
  ok('3 Cancel order asks first', /Cancel this stock order\?/.test(await p.locator('.modal').innerText().catch(() => '')) && await p.evaluate((n) => S.stock.length === n, n0));
  if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-restock.png', clip: { x: 0, y: 150, width: 1360, height: 760 } }); }
  await p.click('.modal button:has-text("Keep the order")'); await p.waitForTimeout(200);
  ok('3 "Keep the order" keeps it', await p.evaluate((n) => S.stock.length === n, n0));
  await p.locator('.stockrow button:has-text("Cancel order")').first().click(); await p.waitForTimeout(200);
  await p.click('.modal button:has-text("Cancel the order")'); await p.waitForTimeout(300);
  ok('3 "Cancel the order" removes it', await p.evaluate((n) => S.stock.length === n - 1, n0));

  /* 4. New sale in the menu */
  const nav = p.locator('.topnav button:has-text("New sale")');
  const st = await nav.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, vis: e.offsetParent !== null }; });
  ok('4 "New sale" is in the Sales menu on Restock, and is not yellow', st.vis && !/255, 183, 3/.test(st.bg), JSON.stringify(st));
  if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-menu.png', clip: { x: 0, y: 0, width: 1360, height: 170 } }); }
  await nav.click(); await p.waitForTimeout(400);
  ok('4 it opens Start a sale and lights up', await p.evaluate(() => S.page === 'start') && await nav.evaluate((e) => e.classList.contains('active')));
  await p.evaluate(() => go('office')); await p.waitForTimeout(400);
  ok('4 it is not shown on the Office side', !(await nav.isVisible()));
  await p.evaluate(() => go('home')); await p.waitForTimeout(300);

  /* 5. tap to call and email */
  await p.evaluate(() => lead(0)); await p.waitForTimeout(300);
  const links = await p.evaluate(() => [...document.querySelectorAll('.modal .ta-leadfacts a')].map((a) => a.getAttribute('href')));
  ok('5 a lead’s phone and email are links', links.some((h) => /^tel:\d{10}$/.test(h)) && links.some((h) => /^mailto:.+@/.test(h)), JSON.stringify(links));
  await p.evaluate(() => lead(1)); await p.waitForTimeout(200);
  ok('5 a lead with no phone still reads "Not recorded"', /Phone\s*Not recorded/.test(await p.locator('.modal .ta-leadfacts').innerText()));
  await p.evaluate(() => closeModal());

  /* 6. order lookup */
  await p.evaluate(() => go('orders')); await p.waitForTimeout(400);
  let page = await p.locator('#app').innerText();
  ok('6 no test records on the Orders page', !/THIS IS A TEST|pre-build:/i.test(page));
  await p.fill('#order-search', 'AA-20411'); await p.waitForTimeout(400);
  page = await p.locator('#app').innerText();
  const line = await p.locator('#ta-serial').innerText().catch(() => '');
  ok('6 the plant line agrees with "Awaiting review"', /Awaiting review/.test(page) && !/is in production/.test(line) && /still reviewing/.test(line), line);
  const vis = await p.evaluate(() => ({ cards: [...document.querySelectorAll('#orderresults .listrow, #orderresults button')].filter((e) => e.offsetParent).length, builds: [...document.querySelectorAll('.sp-builds .buildrow')].filter((e) => e.offsetParent).length, head: [...document.querySelectorAll('.sectionhead')].filter((e) => /In production/.test(e.textContent) && e.offsetParent).length, co: [...document.querySelectorAll('.changesummary .advicerow')].filter((e) => e.offsetParent).map((e) => e.textContent) }));
  ok('6 a search hides the cards that do not match', vis.builds === 0 && vis.head === 0 && vis.co.every((t) => /AA-20411/i.test(t)), JSON.stringify(vis));
  if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-lookup.png', clip: { x: 0, y: 150, width: 1360, height: 600 } }); }
  await p.fill('#order-search', ''); await p.waitForTimeout(300);
  ok('6 clearing the search brings everything back', await p.evaluate(() => [...document.querySelectorAll('.sp-builds .buildrow')].filter((e) => e.offsetParent).length >= 2));
  await p.fill('#order-search', 'GRV-0020'); await p.waitForTimeout(300);
  ok('6 an approved order still shows its plant status', !(await p.locator('#ta-serial').isHidden()) && !/still reviewing/.test(await p.locator('#ta-serial').innerText()));
  await p.close();

  /* 7. a quote says Quote */
  p = await open(false);
  await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1600);
  for (let i = 0; i < 7; i++) { await p.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await p.locator('.summaryactions button:has-text("Continue")').click(); await p.waitForTimeout(300); }
  await p.locator('.summaryactions button:has-text("Create quote")').click(); await p.waitForTimeout(500);
  await p.fill('#qcustomer', 'Jamie Sample'); await p.fill('#qsign', 'Riley Desk');
  await p.locator('.modal button:has-text("Sign")').first().click(); await p.waitForTimeout(600);
  await p.evaluate(() => openSale(S.sales[S.sales.length - 1].id)); await p.waitForTimeout(500);
  page = await p.locator('#app').innerText();
  ok('7 the record is titled Quote, not Invoice', /^\s*QUOTE /mi.test(page.split('\n').find((l) => /BEN-|Q\d/.test(l)) || '') && !/^\s*INVOICE BEN/mi.test(page), page.slice(0, 160));
  const pos = await p.evaluate(() => { const n = document.querySelector('.sp-next'), g = document.querySelector('.od-grid'), h = [...document.querySelectorAll('.od-grid h2')].find((e) => /Review and history/.test(e.textContent)); return { next: !!n && /Finalize this sale/.test(n.textContent), before: !!n && !!(n.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING), inHistory: !!h && /Finalize this sale/.test(h.closest('section').textContent), count: [...document.querySelectorAll('#app button')].filter((e) => /Finalize this sale/.test(e.textContent)).length }; });
  ok('7 "Finalize this sale" sits at the top, once', pos.next && pos.before && !pos.inHistory && pos.count === 1, JSON.stringify(pos));
  if (PIC) { await quiet(p); await p.screenshot({ path: PIC + '-quote.png', clip: { x: 0, y: 150, width: 1360, height: 640 } }); }
  await p.click('.sp-next button:has-text("Finalize this sale")'); await p.waitForTimeout(500);
  /* a custom sale now asks the delivery questions first, then the customer's details */
  if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(400); }
  ok('7 the button opens Customer Information', await p.locator('#customerInfo').count() === 1);
  await p.close();

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
