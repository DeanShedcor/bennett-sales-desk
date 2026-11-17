// One custom cash order through all four sides: desk -> office -> plant -> QC -> office -> logistics (through the lot) -> office (final payment) -> logistics (home) -> delivered.
const { chromium } = require('playwright');
const D = process.cwd() + '/';
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/', type = process.argv[3] || 'Cash purchase';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto(url); await p.waitForTimeout(1200);
  const log = (...a) => console.log(...a);
  const state = () => p.evaluate(() => { const s = S.sales.find((x) => x.id === S.activeSale); return s ? `${s.status} | ${s.fulfillment}` : 'no sale'; });
  const panel = () => p.evaluate(() => [...document.querySelectorAll('.sf-step')].map((e) => (e.querySelector('.od-check.on') ? '[x] ' : '[ ] ') + e.querySelector('strong').textContent + ' — ' + (e.querySelector('small')?.textContent || '').slice(0, 70)).join('\n'));
  const sign = async () => {
    await p.waitForSelector('#sf-pad');
    const box = await p.locator('#sf-pad').boundingBox();
    await p.mouse.move(box.x + 40, box.y + 100); await p.mouse.down(); await p.mouse.move(box.x + 300, box.y + 60, { steps: 12 }); await p.mouse.up();
    await p.check('#sf-agree'); await p.click('#sf-sign'); await p.waitForTimeout(300);
  };
  const toastText = () => p.evaluate(() => document.getElementById('toast').textContent);

  // 1. Desk: build and complete the sale with a discount
  await p.evaluate(() => { S.c = { ...clone(defaults), size: '10x12', windows: 1 }; S.path = 'custom'; S.customer = 'Jamie Sample'; S.page = 'configure'; S.step = steps.length - 1; S.completed = 7; render(); finalizeForm(); });
  await p.waitForTimeout(200);
  if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(400); } /* delivery questions come first on a custom sale */
  if (await p.locator('.modal:has-text("Before you complete the sale")').count()) await p.click('.modal button:has-text("Complete the sale")');
  for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
  await p.click('#customerInfo button[type=submit]');
  log('billing extras present:', await p.locator('#saleBilling [name=discount]').count(), await p.locator('#saleBilling [name=seeFirst]').count());
  await p.selectOption('#saleBilling [name=type]', type);
  await p.fill('#saleBilling [name=deposit]', '450');
  await p.fill('#saleBilling [name=discount]', '300');
  await p.click('#saleBilling button[type=submit]');
  log('discount without purpose blocked:', (await toastText()));
  await p.fill('#saleBilling [name=purpose]', 'Military');
  await p.selectOption('#saleBilling [name=seeFirst]', 'yes');
  await p.click('#saleBilling button[type=submit]');
  log('review modal:', (await p.textContent('.modal')).replace(/\s+/g, ' ').slice(0, 330));
  await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(500);
  if (type === 'Rent-to-own') {
    const next = async () => { await p.click('#rtoForm button[type=submit]'); await p.waitForTimeout(200); };
    await next();
    await p.fill('[name=dl]', 'TEST000'); await p.fill('[name=dob]', '1990-01-01'); await p.fill('[name=ssn]', '0000');
    await p.setInputFiles('[name=idPhoto]', { name: 'test-id.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') }); await next();
    await p.fill('[name=employer]', 'Retired'); await next(); await next();
    for (const r of [1, 2]) { await p.fill(`[name=r${r}name]`, 'Ref ' + r); await p.fill(`[name=r${r}phone]`, '555-0100'); await p.fill(`[name=r${r}rel]`, 'Friend'); }
    await next(); await next(); await next();
  }
  const id = await p.evaluate(() => S.activeSale);
  log('\nORDER', id, await state());
  log('money on order:', await p.evaluate(() => JSON.stringify(S.sales.find((x) => x.id === S.activeSale).money)));
  log('invoice lines:', await p.evaluate(() => orderInvoice(S.sales.find((x) => x.id === S.activeSale)).lines.map((l) => l[0] + ' ' + l[2]).join(' ; ').slice(0, 300)));
  log('submit disabled before site questions:', await p.isDisabled('button:has-text("Send to the office")'));
  await p.click('.sf-step:has-text("Delivery site questions") button'); await p.waitForTimeout(200);
  await p.fill('#of-site-miles', '72'); await p.selectOption('#of-site-access', 'Clear access'); await p.check('#of-site-nogate'); await p.click('.modal button:has-text("Save")'); await p.waitForTimeout(200);
  log('partial site save toast:', await toastText());
  await p.click('.sf-step:has-text("Delivery site questions") button'); await p.selectOption('#of-site-ground', 'Level'); await p.click('.modal button:has-text("Save")'); await p.waitForTimeout(200);
  log('site step:', await p.$eval('.sf-step:has-text("Delivery site questions")', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 200)));
  log('fees after site:', await p.evaluate(() => JSON.stringify(S.sales.find((x) => x.id === S.activeSale).money.fees)), '| invoice delivery:', await p.evaluate(() => orderInvoice(S.sales.find((x) => x.id === S.activeSale)).delivery));
  for (const k of ['invoice', 'terms', 'delivery']) { await p.click(`.sf-step button[onclick="sfSignDoc('${k}')"]`); await sign(); }
  log(await panel());
  log('submit disabled before floor plan:', await p.isDisabled('button:has-text("Send to the office")'));
  await p.click('.sf-step button:has-text("Open floor plan")'); await p.waitForTimeout(400);
  await p.click('#bsheet button:has-text("Confirm layout")'); await p.waitForTimeout(300);
  await p.click('.sf-guide .primary'); await p.waitForTimeout(400);
  log('submit disabled after floor plan:', await p.isDisabled('button:has-text("Send to the office")'));
  await p.click('button:has-text("Send to the office")'); await p.waitForTimeout(300);
  log('SUBMITTED:', await state());
  await p.screenshot({ path: D + 'chain-1-desk-submitted.png', fullPage: true });

  // 2. Office: review
  await p.click('button:has-text("Office: review this order")'); await p.waitForTimeout(300);
  log('\nOFFICE page:', await p.evaluate(() => S.page), '| side:', await p.evaluate(() => document.body.dataset.side));
  const checks = () => p.$$eval('.od-col:first-child .of-check', (els) => els.map((e) => e.className.replace('of-check ', '') + ': ' + e.innerText.replace(/\n+/g, ' | ').slice(0, 120)).join('\n'));
  log(await checks());
  log('approve disabled:', await p.isDisabled('.ops-bar .primary'));
  // hold round trip
  await p.click('.ops-bar .ops-quiet'); await p.fill('#of-hold-reason', 'Test hold reason'); await p.click('.modal button:has-text("Place on hold")'); await p.waitForTimeout(200);
  log('HELD:', await state());
  await p.evaluate((id) => openSale(id), id); await p.waitForTimeout(300);
  log('desk shows hold banner:', await p.locator('.of-banner.hold').count(), '|', (await p.textContent('.of-banner.hold')).slice(0, 90));
  await p.click('button:has-text("Send to the office")'); await p.waitForTimeout(200);
  log('RESUBMITTED:', await state(), '| hold cleared:', await p.evaluate((id) => !ofSale(id).office.hold && ofSale(id).office.holds.length, id));
  await p.evaluate((id) => ofOpen(id), id); await p.waitForTimeout(200);
  await p.click('button:has-text("Confirm received")'); await p.waitForTimeout(150);
  await p.click('button:has-text("OK the discount")'); await p.waitForTimeout(150);
  if (type !== 'Rent-to-own') { await p.locator('.og-exempt input').check(); await p.waitForTimeout(200); }
  if (type === 'Rent-to-own') { await p.click('button:has-text("Send to JMAG LLC")'); await p.waitForTimeout(150); await p.click('button:has-text("They approved")'); await p.waitForTimeout(150); }
  log(await checks());
  await p.screenshot({ path: D + 'chain-2-office-ready.png', fullPage: true });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  log('APPROVED:', await state(), '| toast:', await toastText());

  // 3. Production stand-in from the office page
  await p.click('button:has-text("Open it on the Production board")'); await p.waitForTimeout(300);
  log('PRODUCTION page:', await p.evaluate(() => S.page + ' side ' + document.body.dataset.side), '|', await p.$eval('.pagehead', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 120)));
  let n = 0;
  while (await p.locator('.pr-move .primary:not([disabled])').count() && n++ < 12) { await p.fill('#pr-note', n === 1 ? 'Test note' : ''); await p.click('.pr-move .primary'); await p.waitForTimeout(120); }
  log('moves made:', n - 1, '| history rows:', await p.locator('.od-col .log').count(), '| move panel now:', (await p.$eval('.od-col .panel', (e) => e.innerText.replace(/\n+/g, ' | '))).slice(0, 160));
  log('BUILT:', await state(), '| in QC:', await p.evaluate((id) => !!build(id) && qcStatus(build(id)), id));

  // 4. Plant QC: answer everything Yes, finish, sign off
  await p.evaluate((id) => openBuild(id), id); await p.waitForTimeout(300);
  log('QC side:', await p.evaluate(() => document.body.dataset.side + ' ' + S.page));
  const answered = await p.evaluate(() => { let n = 0; document.querySelectorAll('.qc-ans').forEach((g) => { const y = g.querySelector('button.pass, button:first-child'); }); return n; });
  // use the app's own answer function for speed
  const qcInfo = await p.evaluate((id) => { const b = build(id); const items = itemsFor(b); return { n: items.length, fns: ['answer', 'setAnswer', 'ans'].filter((f) => typeof window[f] === 'function') }; }, id);
  log('QC questions:', qcInfo.n, qcInfo.fns);
  // click every first answer button (Yes) on the page, tile by tile
  for (let round = 0; round < 12; round++) {
    const left = await p.$$eval('.qc-ans', (els) => els.filter((g) => !g.querySelector('button.on')).length);
    if (!left) break;
    await p.$$eval('.qc-ans', (els) => els.forEach((g) => { if (!g.querySelector('button.on')) g.querySelector('button').click(); }));
    await p.waitForTimeout(150);
  }
  log('QC bar:', await p.$eval('.qc-bar', (e) => e.innerText.replace(/\n+/g, ' | ')).catch(() => 'none'));
  await p.screenshot({ path: D + 'chain-3-qc.png', fullPage: false });
  await p.click('.qc-bar .primary').catch(() => {}); await p.waitForTimeout(300);
  if (await p.locator('.modal').count()) { log('QC modal:', (await p.textContent('.modal')).replace(/\s+/g, ' ').slice(0, 160)); await p.click('.modal .primary').catch(() => {}); await p.waitForTimeout(300); }
  log('QC status now:', await p.evaluate((id) => qcStatus(build(id)), id));
  await p.evaluate((id) => { Q.signSerial = id; go('qc-signoff'); }, id); await p.waitForTimeout(200);
  if (await p.locator('button:has-text("Sign off as")').count()) { await p.click('button:has-text("Sign off as")'); await p.click('.modal button:has-text("Yes, sign it off")'); await p.waitForTimeout(300); }
  log('QC signed:', await p.evaluate((id) => qcStatus(build(id)), id), '| toast:', await toastText());

  // 5. Office: release
  await p.evaluate((id) => ofOpen(id), id); await p.waitForTimeout(300);
  log('\nRELEASE bar:', await p.$eval('.ops-bar', (e) => e.innerText.replace(/\n+/g, ' | ')));
  log('path hint:', await p.$eval('.of-hint', (e) => e.innerText));
  if (type !== 'Rent-to-own') {
    await p.click('.of-seg button:has-text("Plant to home")'); await p.waitForTimeout(150);
    log('plant-to-home with balance -> bar:', await p.$eval('.ops-bar', (e) => e.innerText.replace(/\n+/g, ' | ')), '| disabled:', await p.isDisabled('.ops-bar .primary'));
  }
  await p.click('.of-seg button:has-text("Through the lot")'); await p.waitForTimeout(150);
  await p.screenshot({ path: D + 'chain-4-office-release.png', fullPage: true });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  log('RELEASED:', await state(), '| toast:', await toastText());

  // 6. Logistics: plant load with a Moncks Corner stock building
  await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
  log('on board:', await p.evaluate((id) => { const u = lgUnit(id); return u && `${u.name} | ${u.leg} | at ${u.at} | lot ${u.lotId}`; }, id));
  await p.click(`.lg-unit:has-text("${id}") .lg-tick`); await p.waitForTimeout(150);
  await p.click('.lg-unit:has-text("SAMPLE-1216-2110") .lg-tick'); await p.waitForTimeout(150);
  log('pick bar:', await p.$eval('.ops-bar', (e) => e.innerText.replace(/\n+/g, ' | ')));
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  const loadId = await p.evaluate(() => LG.loadId);
  log('LOAD', loadId, await p.$eval('.pagehead', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 150)));
  const lchecks = () => p.$$eval('.lg-check', (els) => els.map((e) => e.className.replace('lg-check ', '') + ': ' + e.innerText.replace(/\n+/g, ' ').slice(0, 130)).join('\n'));
  await p.selectOption('.lg-setup select >> nth=0', 'rig-4'); await p.waitForTimeout(150);
  log('with 30 ft home rig:\n' + (await lchecks()));
  await p.selectOption('.lg-setup select >> nth=0', 'rig-1'); await p.waitForTimeout(150);
  const day = await p.evaluate(() => { let d = lgAddDays(lgToday(), 1); while (!lotDay(lotById('moncks-corner'), d).open) d = lgAddDays(d, 1); return d; });
  await p.fill('.lg-setup input[type=date]', day); await p.dispatchEvent('.lg-setup input[type=date]', 'change'); await p.waitForTimeout(150);
  log('with rig 1 and', day, ':\n' + (await lchecks()));
  await p.screenshot({ path: D + 'chain-5-load.png', fullPage: true });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  if (await p.locator('#lgg-why').count()) { await p.fill('#lgg-why', 'Checked by the dispatcher'); await p.click('.modal button:has-text("Schedule it")'); await p.waitForTimeout(300); } // a load with warnings asks why
  log('SCHEDULED load:', await p.evaluate((l) => lgLoad(l).state, loadId), '| order:', await state());
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200);
  if (await p.locator('.modal button:has-text("Start the run")').count()) { await p.click('.modal button:has-text("Start the run")'); await p.waitForTimeout(300); } // Start the run asks first
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // Arrived
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // Unload here
  await p.fill('#lg-by', 'Lot Staff'); await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(300);
  log('load state:', await p.evaluate((l) => lgLoad(l).state, loadId), '| unit:', await p.evaluate((id) => { const u = lgUnit(id); return `${u.leg} at ${u.at} hold: ${lgHold(u)}`; }, id), '| order:', await state());

  // 7. Home delivery is held until paid (cash) -> office records the final payment
  await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
  log('home row:', await p.$eval(`.lg-unit:has-text("${id}")`, (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 260)));
  if (type !== 'Rent-to-own') {
    log('schedule disabled while unpaid:', await p.isDisabled(`.lg-unit:has-text("${id}") .primary`));
    await p.evaluate((id) => ofOpen(id), id); await p.waitForTimeout(200);
    await p.click('button:has-text("Record a payment")'); await p.waitForTimeout(150);
    log('suggested amount:', await p.inputValue('#of-pay-amount'));
    await p.click('.modal button:has-text("Save the payment")'); await p.waitForTimeout(200);
    log('after final payment:', await toastText(), '|', await p.evaluate((id) => JSON.stringify(ofTotals(ofSale(id))), id));
    await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
  }
  // 8. Logistics: home delivery
  await p.click(`.lg-unit:has-text("${id}") .primary`); await p.waitForTimeout(300);
  const hid = await p.evaluate(() => LG.loadId);
  await p.selectOption('.lg-setup select >> nth=0', 'rig-4');
  await p.fill('.lg-setup input[type=date]', day); await p.dispatchEvent('.lg-setup input[type=date]', 'change'); await p.waitForTimeout(150);
  log('\nHOME', hid, 'checks:\n' + (await lchecks()), '| schedule disabled:', await p.isDisabled('.ops-bar .primary'));
  await p.click('.lg-stop button:has-text("Confirm the site")'); await p.waitForTimeout(200);
  log('confirm modal:', (await p.textContent('.modal .notice')).slice(0, 120));
  await p.click('.modal button:has-text("Confirmed with the customer")'); await p.waitForTimeout(200);
  log('after confirm:\n' + (await lchecks()));
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  if (await p.locator('#lgg-why').count()) { await p.fill('#lgg-why', 'Checked by the dispatcher'); await p.click('.modal button:has-text("Schedule it")'); await p.waitForTimeout(300); } // a load with warnings asks why
  log('order after scheduling:', await state(), '| deliverOn', await p.evaluate((id) => ofSale(id).deliverOn, id));
  await p.evaluate((id) => openSale(id), id); await p.waitForTimeout(300);
  log(await panel());
  log('desk has a Customer told button (should not: Logistics tells them):', await p.locator('.sf-step button:has-text("Customer told")').count());
  await p.screenshot({ path: D + 'chain-6-desk-scheduled.png', fullPage: true });
  await p.evaluate((h) => lgOpen(h), hid); await p.waitForTimeout(200);
  log('start disabled until the customer is told:', await p.isDisabled('.ops-bar .primary'), '|', await lchecks());
  await p.click('.lg-stop button:has-text("See the message")'); await p.waitForTimeout(150);
  log('message:', (await p.textContent('.lg-msg p')).slice(0, 170));
  await p.click('.modal button:has-text("Close")');
  await p.click('.lg-stop button:has-text("Customer told")'); await p.waitForTimeout(200);
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // start
  if (await p.locator('.modal button:has-text("Start the run")').count()) { await p.click('.modal button:has-text("Start the run")'); await p.waitForTimeout(300); } // Start the run asks first
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // arrived
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300); // deliver here -> receipt
  log('receipt modal:', (await p.textContent('.modal h2')));
  await sign();
  log('\nDELIVERED:', await state(), '| load:', await p.evaluate((h) => lgLoad(h).state, hid), '| unit:', await p.evaluate((id) => JSON.stringify({ at: lgUnit(id).at, leg: lgUnit(id).leg }), id));
  await p.evaluate((id) => openSale(id), id); await p.waitForTimeout(300);
  log(await panel());
  await p.screenshot({ path: D + 'chain-7-desk-delivered.png', fullPage: true });
  log('office stage:', await p.evaluate((id) => ofStage(ofSale(id)), id));
  console.log('errors:', errs.length, errs.slice(0, 8));
  await b.close();
})();
