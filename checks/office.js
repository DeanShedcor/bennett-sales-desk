// Walks every Office control added from Turbo Assist (turbo-office.js) and prints PASS / FAIL lines.
// Usage: node turbo-office-test.js [url]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  let p, errs = [], pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  → ' + extra : ''}`); };
  const fresh = async (width = 1360) => {
    if (p) await p.close();
    p = await b.newPage({ viewport: { width, height: 900 } });
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
    await p.goto(URL); await p.waitForTimeout(1300); await p.evaluate(() => { if (typeof OP !== 'undefined') OP.setTab = 'all'; if (typeof OG !== 'undefined') { OG.live = true; ofAll().forEach((s) => { if (!ofRto(s) && !s.invoice) ofRec(s).taxExempt = { by: 'check', at: 1 }; }); } });
  };
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const toast = () => ev(() => document.getElementById('toast').textContent);
  const wait = (ms = 200) => p.waitForTimeout(ms);
  const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // ---------- A. Boot ----------
  await fresh();
  await ev(() => go('office')); await wait();
  const chips = await p.$$eval('.to-sum', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  ok('A1 summary chips on the Office home', chips.length === 5, chips.join(' | '));
  ok('A2 one overdue paperwork item at load (VID-3107 order form)', /^1 overdue paperwork item$/.test(chips[0]), chips[0]);
  ok('A3 four website lots are not in Turbo Assist’s list', /^4 lots not in Turbo Assist$/.test(chips[3]), chips[3]);
  const bell = await p.$eval('#ta-bell-count', (e) => (e.hidden ? 0 : Number(e.textContent)));
  ok('A4 the Office bell has seeded notices', bell >= 2, 'count ' + bell);
  await p.click('#ta-bell'); await wait();
  const notices = await p.$$eval('.ta-notice strong', (els) => els.map((e) => e.textContent));
  ok('A5 notices: a resubmitted order and a bill due soon', notices.some((t) => /^Held order intake resubmitted \(Entered at the Sales desk\)$/.test(t)) && notices.some((t) => / due soon$/.test(t)), notices.join(' | '));
  await ev(() => closeModal());
  await p.click('.to-sum >> nth=0'); await wait();
  ok('A6 the overdue list names the order', /Toni Marsh · VID-3107/.test(await p.textContent('.modal')), (await p.textContent('.modal')).replace(/\s+/g, ' ').slice(0, 160));
  await ev(() => closeModal());
  await p.click('.to-sum >> nth=3'); await wait();
  const lotsText = (await p.textContent('.modal')).replace(/\s+/g, ' ');
  ok('A7 the lots list shows both sides', /Mocksville, NC/.test(lotsText) && /Moncks Corner II, SC/.test(lotsText) && /Newberry, SC/.test(lotsText) && /Wilson, NC/.test(lotsText), lotsText.slice(60, 330));
  await ev(() => closeModal());
  await p.click('.to-digest > summary'); await wait(100);
  const digest = (await p.textContent('.to-digest')).replace(/\s+/g, ' ');
  ok('A8 daily ownership digest lines', /Daily ownership digest — /.test(digest) && /Prior-day sales: \d+ orders? submitted/.test(digest) && /Month-to-date leaderboard/.test(digest) && /email reply is not required in v1\./.test(digest), digest.slice(0, 210));

  // ---------- B. Tax off: nothing changes ----------
  const offSame = await ev(() => S.sales.filter(ofStage).every((s) => JSON.stringify(ofTotals(s)) === JSON.stringify(TO.baseTotals(s)) && orderInvoice(s).taxes == (s.invoice ? s.invoice.taxes : null)));
  ok('B1 with no percent typed, every order’s totals and invoice are unchanged', offSame);

  // ---------- K. Paperwork rules ----------
  const keys = await ev(() => ({ cashCustom: toManifestKeys({ deal_type: 'shed', deal_payment: 'cash', deal_order_type: 'custom_order' }), rtoCustom: toManifestKeys({ deal_type: 'shed', deal_payment: 'rto', deal_order_type: 'custom_order' }), cashInv: toManifestKeys({ deal_type: 'shed', deal_payment: 'cash', deal_order_type: 'inventory' }), steel: toManifestKeys({ deal_type: 'steel', deal_payment: 'finance' }) }));
  ok('K1 rule set: cash custom order', keys.cashCustom.join() === 'order_form,deposit_receipt,waivers', keys.cashCustom.join());
  ok('K2 rule set: rent-to-own custom order', keys.rtoCustom.join() === 'order_form,rto_contract,waivers', keys.rtoCustom.join());
  ok('K3 rule set: cash sale from inventory adds the happy sheet', keys.cashInv.join() === 'order_form,deposit_receipt,happy_sheet,waivers', keys.cashInv.join());
  ok('K4 rule set: financed steel', keys.steel.join() === 'order_form,rto_contract,steel_supplemental,waivers', keys.steel.join());
  await ev(() => ofOpen('CNW-0934')); await wait(300);
  await ev(() => document.querySelectorAll('details.op-fold').forEach((d) => (d.open = true))); /* signatures fold away now */
  let docs = await p.$$eval('.to-paper .to-doc', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')));
  ok('K5 order page lists the paperwork with a status', docs.some((d) => /^Deposit receipt .*No deposit recorded \| Missing$/.test(d)) && docs.some((d) => /^Order form .* \| Received$/.test(d)), docs.slice(0, 3).join(' || ').slice(0, 260));
  ok('K6 signatures use Turbo Sign’s words', docs.some((d) => /^Invoice \| Customer: signed .* \| signed$/.test(d)) && docs.some((d) => /^Delivery receipt \| Customer: pending \| draft$/.test(d)));
  ok('K7 filed under Pending', /Filed under Pending \/ Drew Ellison · CNW-0934/.test(await p.textContent('.to-paper')));
  const intake = (await p.textContent('.to-intake')).replace(/\s+/g, ' ');
  ok('K8 order intake panel: source, sale path, status, five checks', /To review/.test(intake) && /Entered at the Sales desk/.test(intake) && /Cash sale/.test(intake) && /4 of 5 pass/.test(intake), intake.slice(0, 200));
  await ev(() => ofOpen('VID-3107')); await wait(300);
  docs = await p.$$eval('.to-paper .to-doc', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')));
  ok('K9 a missing order form past its due day is flagged overdue', docs.some((d) => /^Order form .*was due .* \| Missing · overdue$/.test(d)), docs[0].slice(0, 170));
  await ev(() => ofOpen('AA-20411')); await wait(300);
  ok('K10 the order with a POS invoice came in from the inventory host', /From the lot’s sales system/.test(await p.textContent('.to-intake')));
  const notes = await ev(() => { document.querySelector('.ops-notes').open = true; return document.querySelector('.ops-notes').innerText; });
  ok('K11 product notes name the Turbo Assist functions', /evaluateManifestItemKeys/.test(notes) && /notifyIntakeResubmitted/.test(notes) && /readyToDeliverBlockedReason/.test(notes) && /buildManufacturingAutoDescription/.test(notes));

  // ---------- C. Tax on, cash ----------
  await ev(() => ofOpen('CNW-0934')); await wait(300);
  const before = await ev(() => { const s = ofSale('CNW-0934'); return { t: ofTotals(s), rule: ofPayRule(s).text }; });
  await p.fill('.to-taxin input', '7'); await p.dispatchEvent('.to-taxin input', 'change'); await wait(300);
  const after = await ev(() => { const s = ofSale('CNW-0934'); return { t: ofTotals(s), rule: ofPayRule(s).text, inv: orderInvoice(s).taxes, panel: document.querySelector('.to-taxrow').closest('.panel').innerText.replace(/\n+/g, ' | ') }; });
  const expTax = Math.round(before.t.total * 7) / 100;
  ok('C1 cash: tax is 7% of the order total', after.t.tax === expTax && before.t.total === after.t.total, `${after.t.tax} on ${after.t.total}`);
  ok('C2 cash: the balance owed now includes the tax', Math.abs(after.t.balance - (before.t.balance + expTax)) < 0.006, `${before.t.balance} → ${after.t.balance}`);
  ok('C3 cash: the pay rule text carries the new balance', after.rule.includes(money(after.t.balance)) && !after.rule.includes(money(before.t.balance)), after.rule);
  ok('C4 cash: Money panel shows the tax and the total with tax', after.panel.includes('Order total with tax | ' + money(after.t.totalWithTax)) && after.panel.includes(money(expTax)) && /no lookup/.test(after.panel), after.panel.slice(0, 330));
  ok('C5 cash: the invoice carries the tax line', after.inv && after.inv[0][0] === 'Sales tax (7%) · typed by the office' && after.inv[0][1] === expTax, JSON.stringify(after.inv));
  const collect = await ev(() => { OF.set.driverPay = true; const s = ofSale('CNW-0934'), r = ofPayRule(s); OF.set.driverPay = false; return { collect: r.collect, text: r.text, fee: lgCardFee(ofTotals(s).balance) }; });
  ok('C6 cash: what a driver collects includes the tax', Math.abs(collect.collect - after.t.balance) < 0.006, `${collect.text} · card fee ${collect.fee}`);
  await ev(() => ofDoc('CNW-0934', 'invoice')); await wait(300);
  const invText = (await p.textContent('.modal .od-totals')).replace(/\s+/g, ' ');
  ok('C7 cash invoice document shows the tax line and a total with tax, with no monthly wording', invText.includes('Sales tax (7%) · typed by the office' + money(expTax)) && !/monthly/i.test(invText) && invText.includes('Total' + money(after.t.totalWithTax)), invText.slice(0, 230));
  await ev(() => closeModal());
  ok('C8 history records who typed the tax', await ev(() => ofSale('CNW-0934').events.some((e) => /Office typed the sales tax: 7%/.test(e.text))));
  await p.fill('.to-taxin input', '40'); await p.dispatchEvent('.to-taxin input', 'change'); await wait(250);
  ok('C9 a percent over 15 is refused', /from 0 to 15/.test(await toast()) && (await ev(() => ofSale('CNW-0934').office.taxPct)) === 7, await toast());
  await p.fill('.to-taxin input', ''); await p.dispatchEvent('.to-taxin input', 'change'); await wait(250);
  const cleared = await ev(() => { const s = ofSale('CNW-0934'); return JSON.stringify(ofTotals(s)) === JSON.stringify(TO.baseTotals(s)) && orderInvoice(s).taxes == null; });
  ok('C10 clearing the percent puts everything back', cleared);

  // ---------- D. Tax on, rent-to-own ----------
  await ev(() => ofOpen('LEX-1634')); await wait(300);
  const rBefore = await ev(() => ofTotals(ofSale('LEX-1634')));
  await p.fill('.to-taxin input', '6'); await p.dispatchEvent('.to-taxin input', 'change'); await wait(300);
  const rAfter = await ev(() => { const s = ofSale('LEX-1634'); return { t: ofTotals(s), inv: orderInvoice(s), dep: [...document.querySelectorAll('.of-check')].map((e) => e.innerText.replace(/\n+/g, ' | ')).find((x) => /First payment received/.test(x)), panel: document.querySelector('.to-taxrow').closest('.panel').innerText.replace(/\n+/g, ' | ') }; });
  ok('D1 rent-to-own: the monthly payment carries the tax', Math.abs(rAfter.t.monthlyWithTax - Math.round(rBefore.monthly * 106) / 100) < 0.011 && rAfter.t.balance === 0, `${rBefore.monthly} → ${rAfter.t.monthlyWithTax}`);
  ok('D2 rent-to-own: Money panel shows the monthly payment with tax', rAfter.panel.includes('Monthly payment with tax | ' + money(rAfter.t.monthlyWithTax)), rAfter.panel.slice(0, 300));
  { /* Turbo Assist's terms ask for several payments down (4 at 48 months), so the amount is that many payments with tax. */
    const n = Number((rAfter.dep.match(/(\d+) payments? down/) || [, 1])[1]), asked = Number((rAfter.dep.match(/\(\$([\d,.]+)\)/) || [, '0'])[1].replace(/,/g, ''));
    ok('D3 rent-to-own: the down payment asked for includes the tax', Math.abs(asked - rAfter.t.monthlyWithTax * n) < 0.05, `${rAfter.dep} :: ${n} x ${rAfter.t.monthlyWithTax}`);
  }
  await p.fill('.to-taxin input', ''); await p.dispatchEvent('.to-taxin input', 'change'); await wait(250);

  // ---------- E. Rent-to-own terms ----------
  await ev(() => go('of-settings')); await wait(300);
  const payBefore = await ev(() => ({ p48: payment(8835, 48), lot: typeof lotPay === 'function' ? lotPay({ price: 6018 }) : null }));
  const d48 = p.locator('.to-term:has(legend:text-is("48 months")) input[type=number]').first();
  await d48.fill('30'); await d48.dispatchEvent('change'); await wait(300);
  const payAfter = await ev(() => ({ p48: payment(8835, 48), div: divisors[48], term: taRtoTerm(48).divisor }));
  ok('E1 changing the 48-month divisor changes the desk’s payment', payAfter.div === 30 && Math.abs(payAfter.p48 - 294.5) < 0.006 && payBefore.p48 !== payAfter.p48, `${payBefore.p48} → ${payAfter.p48}`);
  ok('E2 a divisor of zero is refused', await (async () => { await d48.fill('0'); await d48.dispatchEvent('change'); await wait(250); return /more than 0/.test(await toast()) && (await ev(() => divisors[48])) === 30; })(), await toast());
  await p.click('button:has-text("Put Turbo Assist’s numbers back")'); await wait(300);
  const turbo = await ev(() => ({ d: [24, 36, 48, 60].map((m) => divisors[m]), down: TA.rto.terms.map((t) => t.down), p36: payment(6018, 36) }));
  ok('E3 Turbo Assist’s defaults: 16.8, 25.2, 33.6 and 2, 3, 4 payments down; 60 months left alone', turbo.d.join() === '16.8,25.2,33.6,42' && turbo.down.join() === '2,3,4,5', `${turbo.d.join(' ')} · down ${turbo.down.join(' ')} · 36 mo on $6,018 = ${turbo.p36}`);
  await ev(() => ofOpen('LEX-1634')); await wait(300);
  const short = await p.$$eval('.of-check', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')).find((x) => /First payment received/.test(x)));
  ok('E4 a first payment short of the term’s down payments is flagged', /under the 4 payments down a 48-month term asks for/.test(short), short);
  ok('E5 the flag does not block approval by itself', await ev(() => !ofLeft(ofSale('LEX-1634')).some((c) => c.key === 'deposit')));
  await ev(() => ofPayForm('LEX-1634')); await wait(200);
  const suggest = await p.inputValue('#of-pay-amount');
  ok('E6 Record a payment suggests what is still short', Number(suggest) > 0 && /asks for 4 payments down/.test(await p.textContent('.modal')), 'suggested ' + suggest);
  await ev(() => closeModal());
  await ev(() => go('of-settings')); await wait(250);
  const sel = p.locator('.to-term:has(legend:text-is("24 months")) select');
  await sel.selectOption('percent'); await wait(250);
  ok('E7 Down Type can be a percentage', await ev(() => taRtoTerm(24).downType === 'percent' && taRtoTerm(24).down === 0.1));
  await p.click('button:has-text("Undo my changes")'); await wait(300);
  const back = await ev(() => ({ d: [24, 36, 48, 60].map((m) => divisors[m]), down: TA.rto.terms.map((t) => t.down + t.downType) }));
  ok('E8 Back to the listing numbers restores the table', back.d.join() === '16.8,25.2,33.6,42' && back.down.join() === '2payments,3payments,4payments,5payments', back.d.join(' '));

  // ---------- L. Fuel suggestion ----------
  const fuelBefore = await ev(() => ({ set: ofFuelSet(), text: document.querySelector('.to-suggest').innerText }));
  /* The owner turned the fuel surcharge on, so it is already set when the page opens. */
  ok('L1 the fuel surcharge is already set, and the card still names $0.30 a square foot', fuelBefore.set && /\$0\.30 a square foot/.test(fuelBefore.text), fuelBefore.text.slice(0, 200));
  if (await p.locator('button:has-text("Use $0.30 per sq ft")').count()) await p.click('button:has-text("Use $0.30 per sq ft")'); /* already in use since the owner turned it on */ await wait(300);
  const fuel = await ev(() => { const c = clone(defaults), row = breakdown(c).find((r) => r.name === 'Fuel surcharge'); return { method: OF.set.fuel.method, v: OF.set.fuel.perSqFt, amount: row.amount, size: c.size }; });
  ok('L2 pressing it sets $0.30 a square foot ($48 on a 10 × 16)', fuel.method === 'size' && fuel.v === 0.3 && fuel.size === '10x16' && fuel.amount === 48, JSON.stringify(fuel));

  // ---------- F. Hold and resubmit notices ----------
  await fresh();
  await ev(() => ofOpen('AA-20411')); await wait(300);
  await p.click('.ops-bar button:has-text("Place on hold")'); await wait(200);
  ok('F1 the hold box uses the review screen’s prompt', (await p.getAttribute('#of-hold-reason', 'placeholder')) === 'Ask the submitter to clarify the spec or fix data.');
  await p.fill('#of-hold-reason', 'Delivery address needs a gate code');
  await p.click('.modal button:has-text("Place on hold")'); await wait(300);
  const held = await ev(() => ({ status: ofSale('AA-20411').status, n: TA.notices.filter((x) => x.to === 'sales').map((x) => x.title + ' :: ' + x.body), log: ofSale('AA-20411').events.slice(-2).map((e) => e.text) }));
  ok('F2 placing a hold notifies the salesperson, word for word', held.status === 'Correction requested' && held.n.includes('Order intake placed on hold (From the lot’s sales system) :: Your order intake submission was placed on hold. Reason: "Delivery address needs a gate code". Revise the order and resubmit to return it to the review queue.'), held.n.join(' || ').slice(0, 200));
  ok('F3 the history says the salesperson was notified', held.log.join(' | ').includes('The salesperson was notified in the app'), held.log.join(' | '));
  await ev(() => go('home')); await wait(250);
  ok('F4 the Sales desk bell shows it', (await p.$eval('#ta-bell-count', (e) => (e.hidden ? 0 : Number(e.textContent)))) >= 1);
  await p.click('#ta-bell'); await wait(200);
  await p.click('.ta-notice:has-text("The office put this order on hold") button:has-text("Open")'); await wait(400);
  ok('F5 opening the notice goes to the order on the desk', (await ev(() => S.page + ' ' + S.activeSale)) === 'sale AA-20411');
  const officeBefore = await ev(() => TA.notices.filter((x) => x.to === 'office').length);
  await p.click('button:has-text("Send to the office")'); await wait(400);
  const re = await ev(() => ({ status: ofSale('AA-20411').status, n: TA.notices.filter((x) => x.to === 'office').map((x) => x.title + ' :: ' + x.body), first: ofSale('AA-20411').office.firstSubmitted, ev: toIntakeEvents(ofSale('AA-20411')).map((e) => e.type) }));
  ok('F6 submitting again notifies the office with the reason it gave', re.status === 'Submitted · Awaiting review' && re.n.length === officeBefore + 1 && re.n.includes('Held order intake resubmitted (From the lot’s sales system) :: An order intake you placed on hold has been resubmitted and is back in the review queue. Your hold reason was: "Delivery address needs a gate code". Open the Order Intake panel to review the revised submission.'), re.n.slice(-1)[0].slice(0, 160));
  ok('F7 the intake record reads submitted, on hold, resubmitted', re.ev.join() === 'submitted,on_hold,merged' && !!re.first, re.ev.join());
  // an approved order returned to hold
  await ev(() => ofOpen('STB-3102')); await wait(300);
  await p.click('.ops-bar button:has-text("Approve")'); await wait(400);
  const appr = await ev(() => ({ status: ofSale('STB-3102').status, log: ofSale('STB-3102').events.slice(-2).map((e) => e.text), after: document.querySelector('.od-col .panel').innerText }));
  ok('F8 approving a custom order logs Submit to build’s own line', appr.status === 'Processed · Sold' && appr.log.includes('Plant packet complete. Submitted to build (Order approved).'), appr.log.join(' | '));
  ok('F9 the accepted order shows the ready-to-deliver reason and the accept note', /Ready to deliver is available after the plant finishes this unit \(Build complete \/ Ship from plant\)\. Use Submit to build for paperwork\./.test(appr.after) && /The building and its serial are kept for the next approval\./.test(appr.after));
  await p.click('.ops-bar button:has-text("Return to hold")'); await wait(200);
  ok('F10 Return to hold uses its own prompt', (await p.getAttribute('#of-hold-reason', 'placeholder')) === 'What needs to change before this can be re-accepted?');
  await p.fill('#of-hold-reason', 'Wrong roof color on the order'); await p.click('.modal button:has-text("Place on hold")'); await wait(300);
  const ret = await ev(() => ({ ev: toIntakeEvents(ofSale('STB-3102')).map((e) => e.type), sales: TA.notices.filter((x) => x.to === 'sales' && x.saleId === 'STB-3102').length, log: ofSale('STB-3102').events.slice(-1)[0].text, text: document.querySelector('.to-intake').innerText.replace(/\n+/g, ' | ') }));
  ok('F11 the intake record shows Returned to hold; another lot’s notice stays off this desk', ret.ev.join() === 'submitted,accepted,returned_to_hold' && ret.sales === 0 && /The salesperson at Statesboro was notified in the app/.test(ret.log) && /Put back on hold: Wrong roof color on the order/.test(ret.text), ret.ev.join() + ' · ' + ret.log);

  // ---------- G. Cancel reasons ----------
  await ev(() => ofOpen('CNW-0934')); await wait(300);
  await p.click('button:has-text("Cancel this order")'); await wait(200);
  const picks = await p.$$eval('.to-cancelpick button', (els) => els.map((e) => e.textContent));
  ok('G1 the cancel box offers Turbo Assist’s two reasons', picks.join() === 'RTO Rejected,Customer Cancelled', picks.join());
  await p.click('.to-cancelpick button:has-text("Customer Cancelled")');
  ok('G2 a quick pick fills the reason, which can still be edited', (await p.inputValue('#of-cancel-reason')) === 'Customer Cancelled');
  await p.fill('#of-cancel-reason', 'Customer Cancelled: moving out of state');
  await p.click('.modal button:has-text("Cancel the order")'); await wait(300);
  const can = await ev(() => ({ status: ofSale('CNW-0934').status, kind: ofSale('CNW-0934').office.cancel.kind, folder: toFolder(ofSale('CNW-0934')), tab: document.querySelector('.to-intake .pill').textContent, signs: toSignRows(ofSale('CNW-0934')).map((d) => d.status).join() }));
  ok('G3 cancelled: filed under Cancelled / Customer Cancelled / year', can.status === 'Cancelled' && can.kind === 'customer_cancelled' && /^Cancelled \/ Customer Cancelled \/ \d{4} \/ Drew Ellison · CNW-0934$/.test(can.folder) && can.tab === 'Cancelled', can.folder);
  await ev(() => { ofCancelForm('LEX-1634'); document.querySelector('.to-cancelpick button').click(); ofCancelSave('LEX-1634'); });
  ok('G4 RTO Rejected files under its own folder', /^Cancelled \/ RTO Rejected \//.test(await ev(() => toFolder(ofSale('LEX-1634')))), await ev(() => toFolder(ofSale('LEX-1634'))));

  // ---------- H. Release ----------
  await ev(() => { ofPath('RAV-5538', 'home'); ofOpen('RAV-5538'); }); await wait(300);
  await p.click('.ops-bar button:has-text("Release to Logistics")'); await wait(400);
  const rel = await ev(() => ({ released: !!ofSale('RAV-5538').office.released, log: ofSale('RAV-5538').events.slice(-2).map((e) => e.text) }));
  ok('H1 releasing logs the ready-to-deliver line', rel.released && rel.log.includes('Marked ready to deliver. Logistics can pick up this deal when the building is finished.'), rel.log.join(' | '));
  await ev(() => ofOpen('GRV-0020')); await wait(300);
  ok('H2 an order still at the plant shows why it cannot be released', /Ready to deliver is available after the plant finishes this unit/.test(await p.textContent('.od-col .panel')));

  // ---------- I. Returns ----------
  await ev(() => { window.__jobs = []; window.taServiceAdd = (x) => { window.__jobs.push(x); return { id: 'J1' }; }; const s = ofSale('RAV-5538'); s.status = 'Delivered'; s.fulfillment = 'Delivered'; s.deliveredAt = odToday(); (s.signed ||= {}).receipt = odToday(); ofOpen('RAV-5538'); });
  await wait(300);
  ok('I1 a delivered order is filed under Delivered / RTO / year / month', /^Delivered \/ RTO \/ \d{4} \/ \d{2} \/ Avery Quinn · RAV-5538$/.test(await ev(() => toFolder(ofSale('RAV-5538')))), await ev(() => toFolder(ofSale('RAV-5538'))));
  await p.click('button:has-text("Record a return or repossession")'); await wait(200);
  ok('I2 the form names the service job before saving', /Repossessed unit — internal upgrade for RAV-5538/.test(await p.textContent('.modal')));
  await p.click('.modal [data-rga="returned"]'); await wait(100);
  ok('I3 choosing Returned changes the job name', (await p.textContent('#to-rga-job')) === 'Returned unit — internal upgrade for RAV-5538');
  await p.click('.modal [data-rga="repossessed"]');
  await p.fill('#to-rga-note', 'Picked up by the RTO company');
  await p.click('.modal button:has-text("Save")'); await wait(300);
  const rga = await ev(() => ({ jobs: window.__jobs, rga: ofSale('RAV-5538').office.rga, row: TO.returns[0], panel: document.querySelector('.od-col .panel').innerText.replace(/\n+/g, ' | '), toast: document.getElementById('toast').textContent }));
  ok('I4 a repossession opens a service job through taServiceAdd', rga.jobs.length === 1 && rga.jobs[0].title === 'Repossessed unit — internal upgrade for RAV-5538' && rga.jobs[0].serial === 'RAV-5538' && rga.jobs[0].kind === 'repossessed' && rga.jobs[0].from === 'office' && rga.jobs[0].saleId === 'RAV-5538', JSON.stringify(rga.jobs[0]));
  ok('I5 the order shows it and the toast points to Logistics', rga.rga.status === 'repossessed' && /Repossessed unit · /.test(rga.panel) && /service job opened: Repossessed unit — internal upgrade for RAV-5538/.test(rga.panel) && /Logistics side/.test(rga.toast), rga.toast);
  await ev(() => { window.__svc = window.taServiceAdd; window.taServiceAdd = undefined; const s = ofSale('LUG-0320'); s.status = 'Delivered'; s.fulfillment = 'Delivered'; s.deliveredAt = odToday(); toReturnForm('LUG-0320'); });
  await wait(200);
  ok('I6 a cash order defaults to Returned', (await p.textContent('#to-rga-job')) === 'Returned unit — internal upgrade for LUG-0320');
  await p.click('.modal button:has-text("Save")'); await wait(300);
  ok('I7 without the Logistics helper the return is still recorded', (await ev(() => TO.returns[0].kind + ' ' + TO.returns[0].job)) === 'returned false' && /Turbo Service opens the job/.test(await toast()), await toast());
  await ev(() => { if (window.__svc) window.taServiceAdd = window.__svc; });
  await ev(() => go('of-requests')); await wait(300);
  const rows = await p.$$eval('.ops-list .ops-row', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ')).filter((t) => /internal upgrade|inventory under this serial/.test(t)));
  ok('I8 Requests lists the returns', rows.length === 4 && rows.some((r) => /^LUG-0320/.test(r)) && rows.some((r) => /^RAV-5538/.test(r)), rows.map((r) => r.slice(0, 50)).join(' || '));
  await p.fill('#to-entry-what', '10x16 Lofted Barn'); await p.click('button:has-text("Issue the serial")'); await wait(300);
  ok('I9 a repo brought in gets the next REPO- serial', (await ev(() => TO.returns[0].serial)) === 'REPO-0042' && /REPO-0042/.test(await toast()), await toast());
  await p.click('.to-entry .of-seg button:has-text("Cash purchase")'); await wait(200);
  await p.click('button:has-text("Issue the serial")'); await wait(200);
  ok('I10 the description is required', /Say what the building is/.test(await toast()));
  await p.fill('#to-entry-what', '8x12 Basic Utility'); await p.selectOption('#to-entry-lot', 'conway'); await p.click('button:has-text("Issue the serial")'); await wait(300);
  ok('I11 a cash purchase gets the next CASH- serial at the chosen lot', (await ev(() => TO.returns[0].serial + ' ' + TO.returns[0].where)) === 'CASH-0013 Conway, SC', await ev(() => TO.returns[0].serial + ' ' + TO.returns[0].where));

  // ---------- J. Company bills ----------
  await ev(() => go('office')); await wait(250);
  await p.click('.to-sum:has-text("due soon")'); await wait(300);
  ok('J1 the bills page opens from the Office home and lights its menu item', (await ev(() => S.page)) === 'of-bills' && (await p.$$eval('.ops-list .ops-row', (e) => e.length)) === 5 && (await p.locator('[data-nav="of-bills"].active').count()) >= 1);
  const billText = (await p.textContent('.ops-list')).replace(/\s+/g, ' ');
  ok('J2 a readable due rule gets a reminder; text-only and ended bills do not', /Due soon/.test(billText) && /Office manager is reminded/.test(billText) && /No reminder: the due rule is only text/.test(billText) && /No reminders while ended/.test(billText));
  await p.click('button:has-text("Add a bill")'); await wait(200);
  await p.fill('#to-b-provider', 'Sample Gas Works'); await p.selectOption('#to-b-sub', 'gas'); await p.fill('#to-b-lead', '91'); await p.click('button:has-text("Save the bill")'); await wait(200);
  ok('J3 days ahead past 90 is refused', /whole number from 0 to 90/.test(await toast()), await toast());
  const dueRule = await ev(() => { const d = new Date(Date.now() + 2 * 864e5); return toOrdinal(Math.min(d.getDate(), 28)) + ' of each month'; });
  await p.fill('#to-b-lead', '6'); await p.fill('#to-b-due', dueRule); await p.fill('#to-b-amount', '88.40');
  const nBefore = await ev(() => TA.notices.filter((x) => x.to === 'office').length);
  await p.click('button:has-text("Save the bill")'); await wait(300);
  const bill = await ev(() => ({ n: TO.bills.length, last: TO.bills[TO.bills.length - 1], notice: TA.notices.filter((x) => x.to === 'office').slice(-1)[0], count: TA.notices.filter((x) => x.to === 'office').length }));
  ok('J4 a new bill due inside its reminder window sends “… due soon”', bill.n === 6 && bill.last.sub === 'gas' && bill.count === nBefore + 1 && bill.notice.title === 'Sample Gas Works due soon' && bill.notice.body === `${dueRule}. 6 day(s) ahead.`, bill.notice.title + ' :: ' + bill.notice.body);
  await p.click('.ops-row:has-text("Sample Gas Works") button:has-text("Mark ended")'); await wait(250);
  ok('J5 an ended bill stops reminding', (await ev(() => TO.bills[TO.bills.length - 1].status)) === 'ended' && /No reminders while ended/.test(await p.textContent('.ops-row:has-text("Sample Gas Works")')));

  // ---------- Paperwork: waive, and a sale from inventory ----------
  await ev(() => {
    const s = ofSale('FLO-2121'); s.signed.terms = null; ofOpen('FLO-2121');
  });
  await wait(300);
  await p.click('.to-paper .to-doc:has-text("Extra waivers") button:has-text("Waive")'); await wait(250);
  ok('K12 a missing waiver can be waived, and it is logged', /Waived/.test(await p.textContent('.to-paper .to-doc:has-text("Extra waivers")')) && (await ev(() => ofSale('FLO-2121').events.slice(-1)[0].text)) === 'Extra waivers: waived by the office');
  const inv = await ev(() => { const s = ofSale('FLO-2121'); s.path = 'lot'; const k = toPaperItems(s).map((x) => x.key + ':' + x.status); s.path = 'custom'; return k; });
  ok('K13 a sale from inventory asks for the happy sheet at delivery', inv.includes('happy_sheet:missing'), inv.join());

  // ---------- N. 390 px: nothing scrolls sideways ----------
  await fresh(390);
  const wide = [];
  // Same scan as phone.js: the page must not scroll sideways, and no element may reach past the screen edge.
  const check = async (name) => {
    const o = await ev(() => {
      const w = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('#app *, .topbar *, .previewstrip *, .tabbar *, .modal *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') bad.push(el.tagName + '.' + String(el.className).slice(0, 24) + ' ' + Math.round(r.right)); });
      return { sw: document.documentElement.scrollWidth, cw: w, bad: bad.slice(0, 3) };
    });
    if (o.sw > o.cw || o.bad.length) wide.push(`${name} ${o.sw} ${o.bad.join(',')}`);
  };
  for (const pg of ['office', 'of-orders', 'of-pay', 'of-requests', 'of-settings', 'of-notes', 'of-bills']) { await ev((x) => go(x), pg); await wait(700); await check(pg); }
  await ev(() => { TO.billForm = true; render(); }); await wait(300); await check('of-bills form');
  await ev(() => { document.querySelector('.to-digest') && (TO.digestOpen = true); go('office'); }); await wait(700); await check('office digest open');
  for (const id of ['AA-20411', 'STB-3102', 'LEX-1634', 'CNW-0934', 'VID-3107', 'GRV-0020', 'RAV-5538']) {
    // the detail screen slides in for a moment; measure after it has settled
    await ev((id) => { ofSale(id).office.taxPct = ofSale(id).invoice ? null : 7.25; ofOpen(id); document.querySelector('.to-five') && (document.querySelector('.to-five').open = true); }, id); await wait(700); await check('order ' + id);
  }
  for (const [name, fn] of [['overdue list', () => toOverdueList()], ['lots list', () => toLotsList()], ['return form', () => toReturnForm('RAV-5538')], ['cancel form', () => ofCancelForm('STB-3102')], ['pay form', () => ofPayForm('LEX-1634')], ['notices', () => taOpenNotices()]]) {
    await ev(fn); await wait(200);
    const o = await ev(() => { const m = document.querySelector('.modal'); return m ? m.scrollWidth - m.clientWidth : 0; });
    if (o > 1) wide.push(`${name} modal +${o}`);
    await check(name); await ev(() => closeModal());
  }
  ok('N1 nothing scrolls sideways at 390 px on any Office screen or box', wide.length === 0, wide.join(' | '));

  ok('Z no page errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
