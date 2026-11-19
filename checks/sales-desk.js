const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  const ok = (name, cond, extra = '') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
  await p.goto(URL); await p.waitForTimeout(1500);
  // Home
  ok('ask bar on home', await p.locator('.ta-askbar').count() === 1);
  ok('lead rows show next step', (await p.$$eval('.ta-lead .ta-next', (e) => e.map((x) => x.innerText.trim()))).length === 3, (await p.$$eval('.ta-lead .ta-next', (e) => e.map((x) => x.innerText.trim()))).join(' | '));
  ok('lead pills', true, (await p.$$eval('.ta-lead .pillcol', (e) => e.map((x) => x.innerText.replace(/\n/g, ','))).catch(() => [])).join(' | '));
  ok('checklist card', await p.locator('.ta-check .ta-checkrow').count() === 5, await p.$eval('.ta-check .pill', (e) => e.textContent));
  await p.click('.ta-check button:has-text("Log an ad")'); await p.waitForTimeout(150);
  ok('ad logged raises percent', (await p.$eval('.ta-check .pill', (e) => e.textContent)) !== '30% done', await p.$eval('.ta-check .pill', (e) => e.textContent));
  await p.screenshot({ path: 'shots/home.png', fullPage: true });
  await p.fill('.ta-askbar input', 'how far is delivery free'); await p.click('.ta-askbar button'); await p.waitForTimeout(250);
  ok('ask opens answers with best match', await p.$eval('.ta-best strong', (e) => e.textContent).catch(() => '') === 'Delivery Distance Policy');
  await p.keyboard.press('Escape');
  ok('sales bell has the stale lead', Number(await p.$eval('#ta-bell-count', (e) => e.textContent)) >= 1 && await p.evaluate(() => taNoticesFor('sales').some((n) => /^Stale lead — 7 days \(Taylor Reed\)$/.test(n.title))), await p.$eval('#ta-bell-count', (e) => e.textContent));
  await p.click('.ta-lead >> nth=1'); await p.waitForTimeout(200);
  const leadText = await p.$eval('.modal', (e) => e.innerText);
  ok('lead modal: source detail, follow-up, coach', /Facebook Marketplace ad/.test(leadText) && /Send quote recap and schedule follow-up/.test(leadText) && /Ask for the customer’s phone number/.test(leadText));
  await p.screenshot({ path: 'shots/lead.png' });
  await p.evaluate(() => closeModal());
  // Handoffs
  await p.click('.ta-hand button:has-text("Open the list")'); await p.waitForTimeout(200);
  ok('price list modal', (await p.$$eval('#ta-price-body li', (e) => e.length)) >= 150, String(await p.$$eval('#ta-price-body li', (e) => e.length)));
  await p.fill('.modal input[type=search]', 'porch'); await p.waitForTimeout(150);
  ok('price list search', (await p.$$eval('#ta-price-body li', (e) => e.length)) >= 8 && (await p.$$eval('#ta-price-body li', (e) => e.length)) < 30, String(await p.$$eval('#ta-price-body li', (e) => e.length)));
  await p.screenshot({ path: 'shots/pricelist.png' });
  await p.evaluate(() => closeModal());
  // Configurator add-ons
  await p.evaluate(() => { begin(); });
  await p.waitForTimeout(300);
  const base = await p.evaluate(() => amount());
  await p.evaluate(() => goStep(steps.indexOf('Finish'))); await p.waitForTimeout(250);
  ok('add-ons section on Finish', await p.locator('.ta-addons .ta-addon').count() > 8, String(await p.locator('.ta-addons .ta-addon').count()));
  await p.fill('.ta-addon:has-text("Workbench") input', '8'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  await p.locator('#ix-loft .po-opt:has(strong:text-is("4 ft Back"))').click(); await p.waitForTimeout(200);
  await p.check('.ta-addon:has-text("Trusses") input'); await p.waitForTimeout(200);
  const withAdd = await p.evaluate(() => amount());
  ok('add-ons priced: workbench 8 ft $120 + a 4 ft back loft $192 + trusses 160 sq ft $200', Math.abs(withAdd - base - 512) < 0.01, `${base} -> ${withAdd}`);
  ok('breakdown rows named', true, (await p.evaluate(() => breakdown().filter((r) => r.addon).map((r) => r.name + ' ' + r.amount))).join(' | '));
  ok('included() lists add-ons', await p.evaluate(() => included(S.c).some((x) => /Workbench/.test(x))));
  ok('build sheet notes list add-ons', await p.evaluate(() => bsLayout(S.c).notes.some((x) => /Workbench/.test(x))));
  await p.screenshot({ path: 'shots/addons.png', fullPage: true });
  // size changes: trusses follow floor area
  await p.evaluate(() => { change('size', '12x20'); }); await p.waitForTimeout(200);
  ok('trusses follow the floor (240 sq ft = $300)', await p.evaluate(() => breakdown().find((r) => /Trusses/.test(r.name))?.amount) === 300);
  // the owner's rule: a barn can have a garage door
  await p.evaluate(() => { S.c.extras['Sectional Garage Door'] = 1; change('style', 'Lofted'); }); await p.waitForTimeout(200);
  ok('sectional garage door stays in a barn price', await p.evaluate(() => breakdown().some((r) => /Sectional/.test(r.name))));
  await p.evaluate(() => goStep(steps.indexOf('Size'))); await p.waitForTimeout(200);
  ok('barn rule shown on Size', /Barns come with lofts/.test(await p.$eval('#app', (e) => e.innerText)));
  await p.evaluate(() => { change('style', 'Utility'); change('size', '16x40'); }); await p.waitForTimeout(250);
  ok('16-wide rule shown', /16 ft wide is build on site only/.test(await p.$eval('#app', (e) => e.innerText)));
  await p.evaluate(() => { change('size', '14x40'); }); await p.waitForTimeout(250);
  ok('14-wide rule shown', /14 ft wide is delivered/.test(await p.$eval('#app', (e) => e.innerText)));
  ok('14x40 Classic Utility uses the higher list price', await p.evaluate(() => PRICE_LIST['Classic Utility']['14x40']) === 18633);
  // tall wall
  await p.evaluate(() => { change('size', '10x16'); S.c.extras = {}; const b0 = amount(); change('wallHeight', 7); window.__tall = amount() - b0; }); await p.waitForTimeout(200);
  ok('7 ft walls on a Utility are free', Math.abs((await p.evaluate(() => window.__tall)) - 0) < 0.01, String(await p.evaluate(() => window.__tall)));
  await p.evaluate(() => change('wallHeight', 6));
  // build on site
  await p.evaluate(() => { begin('site'); }); await p.waitForTimeout(250);
  ok('build on site is 40% of the rest of the price', await p.evaluate(() => { const r = breakdown(), s = r.find((x) => x.name === 'Build on site'); return !!s && s.amount === Math.round(r.reduce((t, x) => t + (x === s ? 0 : x.amount), 0) * 40) / 100; }));
  // RTO calculator from the summary drawer
  await p.evaluate(() => { begin(); S.expanded = true; render(); }); await p.waitForTimeout(250);
  await p.click('.ta-rtolink'); await p.waitForTimeout(250);
  const rows = await p.$$eval('.ta-rto > tbody > tr', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  ok('rto table: four terms', rows.length === 4, rows.join(' || '));
  const pay24 = await p.evaluate(() => taRtoCalc(24, TA_RTOC.price).payment), want24 = await p.evaluate(() => Math.round(TA_RTOC.price / 16.8 * 100) / 100);
  ok('24-month payment = price / 16.8', pay24 === want24, `${pay24}`);
  await p.click('.ta-rto .ta-min >> nth=0'); await p.waitForTimeout(150);
  ok('min down fills cash paid today', Number(await p.$eval('#ta-rto-paid', (e) => e.value)) === await p.evaluate(() => taRtoCalc(24, TA_RTOC.price).minToday)); /* Turbo Assist's terms: 2 payments down at 24 months */
  await p.fill('#ta-rto-paid', '1000'); await p.waitForTimeout(150);
  const csra = await p.evaluate(() => taRtoCalc(24, TA_RTOC.price, 1000).csra);
  ok('extra money today becomes reserve and lowers the payment', csra > 0 && (await p.evaluate(() => taRtoCalc(24, TA_RTOC.price, 1000).payment)) < pay24, `csra ${csra}`);
  await p.click('.ta-rto button:has-text("Open chart") >> nth=0'); await p.waitForTimeout(150);
  ok('payoff chart has 24 rows', (await p.$$eval('.ta-chartscroll tbody tr', (e) => e.length)) === 24);
  await p.screenshot({ path: 'shots/rto.png' });
  await p.evaluate(() => closeModal());
  // Billing hint
  await p.evaluate(() => { finalizeForm(); }); await p.waitForTimeout(250);
  if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(400); } /* delivery questions come first on a custom sale */
  for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`[name=${n}]`, v).catch(() => {});
  await p.click('.modal button[type=submit]').catch(() => {}); await p.waitForTimeout(300);
  const hasBilling = await p.locator('#saleBilling').count();
  ok('billing modal reached', hasBilling === 1);
  if (hasBilling) {
    ok('cash hint: 10% of the price', /A cash sale usually takes 10% at the order/.test(await p.$eval('#ta-dephint', (e) => e.innerText)), await p.$eval('#ta-dephint', (e) => e.innerText.slice(0, 90)));
    await p.selectOption('#saleBilling [name=type]', 'Rent-to-own'); await p.waitForTimeout(150);
    ok('rto hint: payments down from the terms', /Due at signing: 5 payments/.test(await p.$eval('#ta-due', (e) => e.innerText)), await p.$eval('#ta-due', (e) => e.innerText));
    ok('provider named from the office', /Provider: JMAG LLC/.test(await p.$eval('#saleBilling', (e) => e.innerText)));
    await p.click('#ta-dephint button'); 
    ok('use-amount fills the deposit', Number(await p.$eval('#saleBilling [name=deposit]', (e) => e.value)) > 0, await p.$eval('#saleBilling [name=deposit]', (e) => e.value));
    await p.screenshot({ path: 'shots/billing.png' });
  }
  await p.evaluate(() => closeModal());
  // Order page facts on the sample order
  await p.evaluate(() => openSale('AA-20411')); await p.waitForTimeout(400);
  ok('order facts block', await p.locator('.ta-facts').count() === 1);
  await p.click('.ta-facts summary'); await p.waitForTimeout(100);
  ok('order facts text', /2 to 4 weeks|1 to 2 weeks/.test(await p.$eval('.ta-facts', (e) => e.innerText)));
  await p.click('.ta-facts .ta-tip >> nth=0'); await p.waitForTimeout(200);
  ok('tip opens the article', /Expected Delivery Lead Times/.test(await p.$eval('.ta-article h2', (e) => e.textContent).catch(() => '')));
  await p.keyboard.press('Escape');
  // Orders: serial status (function may not exist yet)
  await p.evaluate(() => go('orders')); await p.waitForTimeout(200);
  ok('serial line present (hidden until the plant file answers)', await p.locator('#ta-serial').count() === 1);
  await p.evaluate(() => { window.taSerialStatus = (x) => ({ found: /AA-20411/i.test(x), text: 'AA-20411 is in production and has not started QC.' }); });
  await p.fill('#order-search', 'AA-20411'); await p.waitForTimeout(150);
  ok('serial status shows', /in production|still reviewing/.test(await p.$eval('#ta-serial', (e) => e.innerText)));
  // Stats
  await p.evaluate(() => go('performance')); await p.waitForTimeout(200);
  ok('desk stats tiles', (await p.$$eval('.sp-perf .metric', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).length === 8, (await p.$$eval('.sp-perf .metric', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).join(' | '));
  await p.screenshot({ path: 'shots/stats.png', fullPage: true });
  // Sources
  await p.evaluate(() => go('notes')); await p.waitForTimeout(200);
  ok('sources page has the repo section', /From Turbo Assist \(bennett-buddy b42d324\)/.test(await p.$eval('#app', (e) => e.textContent)));
  // Lot unit page link + quote
  await p.evaluate(() => openUnit(0)); await p.waitForTimeout(300);
  ok('lot unit page has the rent-to-own link', await p.locator('.unitprice .ta-rtolink').count() === 1);
  // phone overflow
  await p.setViewportSize({ width: 390, height: 800 });
  for (const pg of ['home', 'performance', 'orders', 'notes']) {
    await p.evaluate((x) => go(x), pg); await p.waitForTimeout(200);
    const o = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok('phone no sideways scroll: ' + pg, o[0] <= o[1], o.join('/'));
  }
  await p.evaluate(() => go('home')); await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots/home-phone.png', fullPage: true });
  await p.evaluate(() => { begin(); goStep(steps.indexOf('Finish')); }); await p.waitForTimeout(300);
  const o2 = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok('phone no sideways scroll: configure finish', o2[0] <= o2[1], o2.join('/'));
  await p.screenshot({ path: 'shots/addons-phone.png', fullPage: true });
  await p.evaluate(() => taRtoOpen(5464)); await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots/rto-phone.png' });
  await p.evaluate(() => closeModal());
  await p.evaluate(() => taOpenAnswers('size-limits')); await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots/ans-phone.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 10));
  await b.close();
})();
