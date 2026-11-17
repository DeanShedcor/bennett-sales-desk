// Other paths: lot sale with driver payment; plant to home on a plant haul; cancel; requests; settings; add a plant; over-length load.
const { chromium } = require('playwright');
const D = process.cwd() + '/';
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text())); /* a picture that cannot load is not a fault in the app */
  await p.goto(url); await p.waitForTimeout(1200); await p.evaluate(() => { if (typeof OP !== 'undefined') OP.setTab = 'all'; if (typeof OG !== 'undefined') { OG.live = true; ofAll().forEach((s) => { if (!ofRto(s) && !s.invoice) ofRec(s).taxExempt = { by: 'check', at: 1 }; }); } });
  const log = (...a) => console.log(...a);
  const toastText = () => p.evaluate(() => document.getElementById('toast').textContent);
  const sign = async () => { await p.waitForSelector('#sf-pad'); const box = await p.locator('#sf-pad').boundingBox(); await p.mouse.move(box.x + 40, box.y + 100); await p.mouse.down(); await p.mouse.move(box.x + 300, box.y + 60, { steps: 12 }); await p.mouse.up(); await p.check('#sf-agree'); await p.click('#sf-sign'); await p.waitForTimeout(300); };
  const lchecks = () => p.$$eval('.lg-check', (els) => els.map((e) => e.className.replace('lg-check ', '') + ': ' + e.innerText.replace(/\n+/g, ' ').slice(0, 150)).join('\n'));

  // ---- Settings: fuel surcharge drives the desk price
  await p.evaluate(() => { S.c = { ...clone(defaults), size: '10x12' }; S.path = 'custom'; });
  const before = await p.evaluate(() => ({ total: amount(), fuel: breakdown().find((r) => r.name === 'Fuel surcharge') }));
  await p.evaluate(() => go('of-settings')); await p.fill('#of-fuel', '1'); await p.click('button:has-text("Save")'); await p.waitForTimeout(200);
  const pct = await p.evaluate(() => ({ total: amount(), fuel: breakdown().find((r) => r.name === 'Fuel surcharge') }));
  log('FUEL before:', JSON.stringify(before), '\nFUEL 1% of price:', JSON.stringify(pct), '| toast:', await toastText(), '| example:', await p.textContent('.of-example'));
  await p.click('.of-seg button:has-text("By square foot")'); await p.fill('#of-fuel', '0.30'); await p.click('button:has-text("Save")'); await p.waitForTimeout(200);
  log('FUEL by sq ft ($0.30, 10x12 = 120 sq ft):', await p.evaluate(() => JSON.stringify(breakdown().find((r) => r.name === 'Fuel surcharge'))));
  await p.click('.of-seg button:has-text("By linear foot")'); await p.fill('#of-fuel', '4'); await p.click('button:has-text("Save")'); await p.waitForTimeout(200);
  log('FUEL by linear ft ($4, 10x12 = 12 ft long):', await p.evaluate(() => JSON.stringify(breakdown().find((r) => r.name === 'Fuel surcharge'))));
  await p.click('.of-seg button:has-text("Flat amount")'); await p.fill('#of-fuel', '55'); await p.click('button:has-text("Save")'); await p.waitForTimeout(200);
  const after = await p.evaluate(() => ({ total: amount(), fuel: breakdown().find((r) => r.name === 'Fuel surcharge') }));
  log('FUEL flat $55:', JSON.stringify(after), '| history rows:', await p.locator('.qc-log li').count());
  await p.evaluate(() => { S.page = 'configure'; S.step = steps.length - 1; S.completed = 7; render(); });
  await p.waitForTimeout(300);
  log('desk summary shows STILL NEEDED:', await p.evaluate(() => summary().includes('STILL NEEDED')), '| fuel line:', await p.evaluate(() => (summary().match(/<li[^>]*><span>Fuel surcharge[\s\S]*?<\/li>/) || ['none'])[0].replace(/<[^>]+>/g, ' ')));
  await p.evaluate(() => go('of-settings')); await p.waitForTimeout(150);
  await p.screenshot({ path: D + 'paths-settings.png', fullPage: true });

  // ---- Lot sale, cash, driver takes the final payment
  await p.evaluate(() => { OF.set.driverPay = true; });
  const lotIdx = await p.evaluate(() => lots.findIndex((u) => u.status === 'Available'));
  await p.evaluate((i) => { pickLot(i); }, lotIdx); await p.waitForTimeout(300);
  await p.evaluate(() => { setDelivery('miles', 64); setDelivery('access', 'Clear access'); setDelivery('noGate', true); setDelivery('ground', 'Level'); S.customer = 'Lot Buyer'; finalizeForm(); });
  await p.waitForTimeout(200);
  if (await p.locator('.modal:has-text("Before you complete the sale")').count()) await p.click('.modal button:has-text("Complete the sale")');
  log('\nLOT SALE modal:', await p.textContent('.modal h2').catch(() => 'none'));
  for (const [n, v] of Object.entries({ firstName: 'Lot', lastName: 'Buyer', email: 'lot@example.com', phone: '(843) 555-0188', billingStreet: '9 Test Ln', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
  await p.click('#customerInfo button[type=submit]');
  log('seeFirst hidden for a lot sale:', await p.locator('#saleBilling [name=seeFirst]').count() === 0);
  await p.fill('#saleBilling [name=deposit]', '400'); await p.click('#saleBilling button[type=submit]');
  await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(500);
  if (await p.locator('.modal').count()) { log('modal after create:', await p.textContent('.modal h2')); await p.click('.modal button:has-text("Close")').catch(() => {}); }
  const lid = await p.evaluate(() => S.activeSale);
  for (const k of ['invoice', 'terms', 'delivery']) { await p.click(`.sf-step button[onclick="sfSignDoc('${k}')"]`); await sign(); }
  await p.click('button:has-text("Send to the office")'); await p.waitForTimeout(200);
  log('lot order', lid, await p.evaluate((id) => { const s = ofSale(id); return `${s.status} | path ${s.path} | site ${JSON.stringify(s.site)} | fuel ${s.money.fuel}`; }, lid));
  await p.evaluate((id) => ofOpen(id), lid); await p.waitForTimeout(200);
  log('office checks:\n' + await p.$$eval('.of-check', (els) => els.map((e) => e.className.replace('of-check ', '') + ': ' + e.innerText.replace(/\n+/g, ' | ').slice(0, 140)).join('\n')));
  log('delivery row:', await p.evaluate(() => [...document.querySelectorAll('.od-kv')].find((e) => e.textContent.startsWith('Delivery'))?.innerText.replace(/\n/g, ' ')));
  await p.click('button:has-text("Confirm received")'); await p.waitForTimeout(150);
  if (await p.locator('.og-exempt input').count()) { await p.locator('.og-exempt input').check(); await p.waitForTimeout(150); } /* new rule: tax before approve */
  await p.click('.ops-bar .primary'); await p.waitForTimeout(250);
  log('approved:', await p.evaluate((id) => ofSale(id).status + ' | lot unit: ' + lots[ofSale(id).lot].status, lid), '| totals', await p.evaluate((id) => JSON.stringify(ofTotals(ofSale(id))), lid));
  log('release bar:', await p.$eval('.ops-bar', (e) => e.innerText.replace(/\n+/g, ' | ')));
  await p.click('.ops-bar .primary'); await p.waitForTimeout(250);
  await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
  log('logi row:', await p.$eval(`.lg-unit:has-text("${lid}")`, (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 300)));
  await p.click(`.lg-unit:has-text("${lid}") .primary`); await p.waitForTimeout(250);
  const h = await p.evaluate(() => LG.loadId);
  const day = await p.evaluate(() => { let d = lgAddDays(lgToday(), 2); while (!lotDay(lotById('moncks-corner'), d).open) d = lgAddDays(d, 1); return d; });
  await p.selectOption('.lg-setup select >> nth=0', 'rig-3'); await p.fill('.lg-setup input[type=date]', day); await p.dispatchEvent('.lg-setup input[type=date]', 'change'); await p.waitForTimeout(150);
  log('home load checks:\n' + (await lchecks()));
  await p.click('.lg-stop button:has-text("Confirm the site")'); await p.click('.modal button:has-text("Confirmed with the customer")'); await p.waitForTimeout(200);
  await p.evaluate(() => { LG.set.tell = 'auto'; });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200);
  log('auto tell: last event:', await p.evaluate((id) => ofSale(id).events.slice(-1)[0].text, lid), '| told:', await p.evaluate((id) => lgToldOf(lgUnit(id)), lid));
  await p.evaluate(() => { LG.set.tell = 'logistics'; });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); await p.click('.ops-bar .primary'); await p.waitForTimeout(200); await p.click('.ops-bar .primary'); await p.waitForTimeout(300);
  log('collect modal:', await p.textContent('.modal h2'));
  log('driver may take:', await p.$$eval('#lg-col-method option', (els) => els.map((e) => e.textContent)));
  await p.selectOption('#lg-col-method', 'Card'); await p.waitForTimeout(150);
  log('card:', await p.textContent('#lg-col-fee'), '| amount field:', await p.inputValue('#lg-col-amount'));
  await p.screenshot({ path: D + 'paths-collect.png' });
  await p.click('.modal button:has-text("Payment taken")'); await p.waitForTimeout(300);
  await sign();
  log('messages sent:', await p.evaluate((id) => Object.keys(lgUnit(id).msgs || {}).join(', '), lid), '| fees:', await p.evaluate((id) => JSON.stringify(ofSale(id).money.fees), lid), '| balance:', await p.evaluate((id) => ofTotals(ofSale(id)).balance + ' pending ' + ofTotals(ofSale(id)).pending, lid));
  log('LOT SALE DELIVERED:', await p.evaluate((id) => { const s = ofSale(id); return `${s.status} | payments ${JSON.stringify(s.money.payments.map((x) => [x.amount, x.method, x.confirmed]))} | lot unit ${lots[s.lot].status}`; }, lid));
  await p.evaluate(() => go('of-pay')); await p.waitForTimeout(200);
  log('office payments to confirm:', await p.$$eval('#of-pay .ops-row', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 120))));
  await p.screenshot({ path: D + 'paths-pay.png', fullPage: true });

  // ---- Plant to home on a plant haul with a lot drop (sample RAV-5538, rent-to-own approved)
  await p.evaluate(() => ofOpen('RAV-5538')); await p.waitForTimeout(200);
  log('\nRAV hint:', await p.$eval('.of-hint', (e) => e.innerText));
  await p.click('.of-seg button:has-text("Plant to home")'); await p.waitForTimeout(150);
  await p.click('.ops-bar .primary'); await p.waitForTimeout(250);
  await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
  await p.click('.lg-unit:has-text("RAV-5538") .lg-tick'); await p.click('.lg-unit:has-text("SAMPLE-1020-2111") .lg-tick'); await p.waitForTimeout(150);
  await p.click('.ops-bar .primary'); await p.waitForTimeout(250);
  const L = await p.evaluate(() => LG.loadId);
  log('load', L, 'stops:', await p.evaluate((l) => lgLoad(l).stops.map((s) => s.key).join(' > '), L));
  await p.selectOption('.lg-setup select >> nth=0', 'rig-1'); await p.waitForTimeout(150);
  const d2 = await p.evaluate(() => { let d = lgAddDays(lgToday(), 1); while (!lotDay(lotById('ravenel'), d).open) d = lgAddDays(d, 1); return d; });
  await p.fill('.lg-setup input[type=date]', d2); await p.dispatchEvent('.lg-setup input[type=date]', 'change'); await p.waitForTimeout(150);
  log('rig 1 (no home flag):\n' + (await lchecks()));
  // move the customer stop first -> order warning
  await p.click('.lg-updown button >> nth=1'); await p.waitForTimeout(150);
  log('after moving customer first:\n' + (await lchecks()));
  await p.click('.lg-updown button >> nth=1'); await p.waitForTimeout(150);
  // over length: add a 24 ft building to a 36 ft load on a 40 ft trailer
  await p.click('.lg-cand:has-text("12 × 24") button').catch(() => log('no 12x24 candidate'));
  await p.waitForTimeout(150);
  log('over length:\n' + (await lchecks()), '| schedule disabled:', await p.isDisabled('.ops-bar .primary'));
  log('too long is a warning now; the reason is typed when the load is scheduled (fix13.js covers it):', await p.locator('.lg-check button:has-text("Override")').count() === 0);
  await p.screenshot({ path: D + 'paths-overlength.png', fullPage: true });
  await p.evaluate((l) => { const load = lgLoad(l); const extra = lgLoadUnits(load).find((u) => u.size === '12x24'); if (extra) lgRemove(l, extra.id); }, L); await p.waitForTimeout(150);
  await p.selectOption('.lg-setup select >> nth=0', 'rig-3'); await p.waitForTimeout(150);
  log('rig 3:\n' + (await lchecks()));
  await p.click('.lg-stop button:has-text("Confirm the site")'); await p.click('.modal button:has-text("Confirmed with the customer")'); await p.waitForTimeout(200);
  log('rig 3 after site confirm:\n' + (await lchecks()));
  await p.screenshot({ path: D + 'paths-planthome.png', fullPage: true });
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200);
  log('RAV after schedule:', await p.evaluate(() => { const s = ofSale('RAV-5538'); return s.fulfillment + ' | deliverOn ' + s.deliverOn; }), '| start disabled:', await p.isDisabled('.ops-bar .primary'));
  await p.click('.lg-stop button:has-text("Customer told")'); await p.waitForTimeout(200);
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // start
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // arrived at lot
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // unload
  await p.fill('#lg-by', 'Lot Staff'); await p.click('.modal button:has-text("Unloaded and signed for")'); await p.waitForTimeout(250);
  await p.click('.ops-bar .primary'); await p.waitForTimeout(200); // arrived at home
  await p.click('.ops-bar .primary'); await p.waitForTimeout(300); // deliver -> receipt
  await sign();
  log('RAV DELIVERED:', await p.evaluate(() => { const s = ofSale('RAV-5538'); return s.status + ' | ' + s.fulfillment; }), '| load', await p.evaluate((l) => lgLoad(l).state, L), '| stock unit:', await p.evaluate(() => JSON.stringify({ at: lgUnit('SAMPLE-1020-2111').at, leg: lgUnit('SAMPLE-1020-2111').leg })));

  // ---- Over 100 miles: Logistics approves the delivery fee (sample GRV-0020, 118 miles)
  await p.evaluate(() => { LG.tile = 'all'; LG.q = ''; go('logi'); }); await p.waitForTimeout(200);
  log('\nFEES to approve:', await p.$$eval('#lg-list h2', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')).filter((x) => /fees/i.test(x))), '| office delivery:', await p.evaluate(() => ofDelivery(ofSale('GRV-0020')).text));
  await p.click('.ops-row:has-text("GRV-0020") button:has-text("Set the fee")'); await p.fill('#lg-fee', '250'); await p.fill('#lg-fee-note', 'second driver'); await p.click('.modal button:has-text("Approve the fee")'); await p.waitForTimeout(200);
  log('after approval:', await p.evaluate(() => ofDelivery(ofSale('GRV-0020')).text + ' | fees ' + JSON.stringify(ofSale('GRV-0020').money.fees) + ' | total ' + ofTotals(ofSale('GRV-0020')).total), '| left to approve:', await p.evaluate(() => lgFeeList().length));

  // ---- Two RTO companies: declined by one, sent to the other
  await p.evaluate(() => go('of-settings')); await p.fill('#of-rtoco', 'Second Sample RTO'); await p.click('.of-inline:has(#of-rtoco) button'); await p.waitForTimeout(200);
  await p.evaluate(() => ofOpen('LEX-1634')); await p.waitForTimeout(200);
  await p.click('button:has-text("They declined")'); await p.waitForTimeout(150);
  log('\nRTO after decline:', await p.$eval('.of-check.bad', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 200)));
  await p.click('button:has-text("Send to another company")'); await p.waitForTimeout(150);
  await p.click('.of-check button.primary'); await p.waitForTimeout(150);
  await p.click('button:has-text("They approved")'); await p.waitForTimeout(150);
  log('RTO second try:', await p.evaluate(() => JSON.stringify(ofSale('LEX-1634').office.rtoCo.company) + ' ' + ofSale('LEX-1634').office.rtoCo.state + ' | contract names ' + ofSale('LEX-1634').rtoApp.provider), '| left:', await p.evaluate(() => ofLeft(ofSale('LEX-1634')).length));
  // ---- A lot whose manager can schedule
  await p.evaluate(() => { LG.place = 'lot:moncks-corner'; go('lg-places'); }); await p.waitForTimeout(200);
  await p.check('.lg-mgr input'); await p.waitForTimeout(200);
  log('manager lot:', await p.evaluate(() => lotById('moncks-corner').managerSchedules), '| toast:', await toastText());

  // ---- Requests: change order with a price change; stock order
  await p.evaluate(() => { S.activeSale = 'GRV-0020'; S.changes.push({ id: 'CO-9', order: 'GRV-0020', what: 'Add a window', reason: 'Customer asked', done: 1, log: [new Date().toISOString()] }); go('of-requests'); });
  await p.waitForTimeout(200);
  const tot0 = await p.evaluate(() => ofSale('GRV-0020').total);
  const n = await p.evaluate(() => S.changes.findIndex((c) => c.id === 'CO-9'));
  await p.fill('#of-delta-' + n, '180'); await p.click(`.ops-row:has-text("CO-9") .primary`); await p.waitForTimeout(200);
  log('\nCHANGE approved: total', tot0, '->', await p.evaluate(() => ofSale('GRV-0020').total), '| done', await p.evaluate(() => S.changes.find((c) => c.id === 'CO-9').done), '| toast', await toastText());
  const st0 = await p.evaluate(() => S.stock.filter((r) => (r.stage || 0) === 0).length);
  await p.click('.ops-row:has-text("Stock order") .primary'); await p.waitForTimeout(200);
  log('STOCK waiting', st0, '->', await p.evaluate(() => S.stock.filter((r) => (r.stage || 0) === 0).length));
  await p.screenshot({ path: D + 'paths-requests.png', fullPage: true });

  // ---- Cancel an order under review, with money on it
  await p.evaluate(() => ofOpen('FLO-2121')); await p.waitForTimeout(150);
  await p.click('button:has-text("Confirm received")'); await p.waitForTimeout(100);
  await p.click('button:has-text("Cancel this order")'); await p.fill('#of-cancel-reason', 'Customer changed their mind'); await p.click('.modal button:has-text("Cancel the order")'); await p.waitForTimeout(200);
  log('\nCANCELLED:', await p.evaluate(() => ofSale('FLO-2121').status), '| refunds tab:', await p.evaluate(() => { OF.payTab = 'refunds'; go('of-pay'); return document.querySelectorAll('#of-pay .ops-row').length; }));

  // ---- Add a plant
  await p.evaluate(() => go('lg-places')); await p.click('button:has-text("Add a plant")');
  await p.fill('#lg-pl-name', 'ShedCor plant 2'); await p.fill('#lg-pl-street', '100 Sample Industrial Dr'); await p.fill('#lg-pl-town', 'Statesville'); await p.selectOption('#lg-pl-state', 'NC'); await p.fill('#lg-pl-zip', '28625'); await p.selectOption('#lg-pl-near', 'statesville');
  await p.click('.modal button:has-text("Add the plant")'); await p.waitForTimeout(300);
  log('\nPLANTS:', await p.evaluate(() => PLANTS.map((x) => x.name + ' (' + LOTS.filter((l) => lotPlant(l).id === x.id).length + ' lots)').join(', ')), '| toast', await toastText());
  log('h1:', await p.textContent('h1'));
  await p.screenshot({ path: D + 'paths-plants.png', fullPage: true });
  await p.evaluate(() => go('logi')); await p.waitForTimeout(200);
  log('board head:', await p.$eval('.eyebrow', (e) => e.innerText));
  console.log('errors:', errs.length, errs.slice(0, 8));
  await b.close();
})();
