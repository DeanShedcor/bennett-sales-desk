// Office batch 1: payments lock, safe publish, settings limits + confirm + history, money limits, tax before approve, super users.
// node fix08.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async () => {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} if (typeof OP !== 'undefined') OP.setTab = 'all'; }); await p.waitForTimeout(300);
    return p;
  };
  const said = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  const quiet = async (p) => { await p.waitForTimeout(4300); };
  const shot = async (p, name, sel, pad = 14) => {
    if (!PIC) return;
    await quiet(p);
    const r = await p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, sel);
    await p.waitForTimeout(300);
    if (!r) return p.screenshot({ path: `${PIC}-${name}.png` });
    const q = await p.evaluate((sel) => { const q = document.querySelector(sel).getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, sel);
    const x = Math.max(0, q.x - pad), y = Math.max(0, q.y - pad);
    await p.screenshot({ path: `${PIC}-${name}.png`, clip: { x, y, width: Math.min(1360 - x, q.w + pad * 2), height: Math.min(1000 - y, q.h + pad * 2) } });
  };

  // ---------- 1. Payments lock ----------
  {
    const p = await open();
    const info = await p.evaluate(() => {
      const u = AD.users.find((x) => x.id === 'u8'); delete u.access.payments; /* Office reviewer: Payments read only */
      const s = ofAll().find((x) => x.money?.payments.some((q) => !q.confirmed));
      const cash = ofAll().find((x) => ofStage(x) === 'review' && !ofRto(x));
      adView('u8'); go('office');
      return { level: adAccess(adMe(), 'payments'), id: s?.id, i: s ? s.money.payments.findIndex((q) => !q.confirmed) : -1, n: s?.money.payments.length, cash: cash?.id };
    });
    await p.waitForTimeout(400);
    ok('1 the test person has Payments read only and Office edit', info.level === 'read' && !!info.id, info);
    const sel = 'button[onclick^="ofConfirmPay("], button[onclick^="ofDropPay("], button[onclick^="ofPayForm("]';
    const btn = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((x) => [x.textContent.trim(), x.disabled]), sel);
    ok('1 To do: every payment button is greyed out', btn.length > 0 && btn.every((x) => x[1]), btn);
    ok('1 To do: the screen says "Payments: read only"', /Payments: read only/.test(await p.locator('#app').innerText()));
    await p.evaluate(({ id, i }) => ofConfirmPay(id, i), info); await p.waitForTimeout(200);
    ok('1 Confirm received does nothing for this person', await p.evaluate(({ id, i }) => !ofSale(id).money.payments[i].confirmed, info), await said(p));
    await p.evaluate(({ id, i }) => ofDropPay(id, i), info);
    ok('1 Not received does not delete the payment', await p.evaluate(({ id, n }) => ofSale(id).money.payments.length === n, info));
    await shot(p, 'payments-lock', '#app .ops-list, #app');
    await p.evaluate((id) => ofOpen(id), info.id); await p.waitForTimeout(400);
    const money = await p.evaluate(() => [...document.querySelectorAll('button[onclick^="ofPayForm("], button[onclick^="ofConfirmPay("]')].map((x) => [x.textContent.trim(), x.disabled]));
    ok('1 Order page: the payment buttons in the Money box are greyed out', money.length > 0 && money.every((x) => x[1]), money);
    await p.evaluate((id) => ofPayForm(id), info.id); await p.waitForTimeout(200);
    ok('1 Record a payment does not open', !(await p.locator('#of-pay-amount').count()));
    ok('1 The amounts are still shown', /\$\d/.test(await p.locator('#app').innerText()));
    await p.evaluate(() => { adView('u1'); }); await p.waitForTimeout(300);
    const back = await p.evaluate(() => [...document.querySelectorAll('button[onclick^="ofPayForm("], button[onclick^="ofConfirmPay("]')].map((x) => x.disabled));
    ok('1 A person with Payments edit still has live buttons', back.length > 0 && back.every((x) => !x), back);
    await p.close();
  }

  // ---------- 2. Publish prices safely ----------
  {
    const p = await open();
    const made = await p.evaluate(() => {
      go('of-prices');
      const sizes = Object.keys(PRICE_LIST['Basic Utility']);
      sizes.forEach((s, i) => { const now = PRICE_LIST['Basic Utility'][s]; adPrice({ kind: 'shed', model: 'Basic Utility', size: s }, i === 0 ? Math.round(now * 0.5) : i === 1 ? Math.round(now * 1.3) : now + 20, true); });
      Object.keys(PRICE_LIST['Basic Lofted']).forEach((s) => adPrice({ kind: 'shed', model: 'Basic Lofted', size: s }, PRICE_LIST['Basic Lofted'][s] + 10, true));
      AD.tab = 'draft'; render();
      return { n: AD.draft.length, first: sizes[0], was: PRICE_LIST['Basic Utility'][sizes[0]] };
    });
    await p.waitForTimeout(400);
    ok('2 the draft has more than 60 changes for this check', made.n > 60, made.n);
    const list = await p.evaluate(() => ({ li: document.querySelectorAll('.ad-changes li').length, big: document.querySelectorAll('.ad-changes li.og-big').length, text: document.querySelector('#app').innerText }));
    ok('2 every changed price is listed', list.li === made.n && !/more not shown/.test(list.text), list.li);
    ok('2 changes over 15% are flagged in red, in words too', list.big === 2 && /Big change/.test(list.text) && /by more than 15%/.test(list.text), list.big);
    await p.click('.ad-tools button:has-text("Publish")'); await p.waitForTimeout(300);
    const sum = await p.locator('.modal').innerText();
    ok('2 Publish asks first, with the count', /Publish these prices\?/.test(sum) && new RegExp(`${made.n} prices change`).test(sum), sum.slice(0, 200));
    ok('2 the summary shows the biggest raises and cuts', /Biggest raises/i.test(sum) && /Biggest cuts/i.test(sum) && /down 50%/.test(sum) && /up 30%/.test(sum), sum);
    ok('2 nothing is live while the question is open', await p.evaluate((m) => PRICE_LIST['Basic Utility'][m.first] === m.was && AD.log.length === 0, made));
    await shot(p, 'publish', '.modal');
    await p.click('.modal button:has-text("Go back")'); await p.waitForTimeout(200);
    ok('2 Go back keeps the draft and the old prices', await p.evaluate((m) => AD.draft.length === m.n && PRICE_LIST['Basic Utility'][m.first] === m.was, made));
    await p.click('.ad-tools button:has-text("Publish")'); await p.waitForTimeout(200);
    await p.click(`.modal button:has-text("Publish ${made.n} prices")`); await p.waitForTimeout(400);
    ok('2 confirming puts the prices live', await p.evaluate((m) => PRICE_LIST['Basic Utility'][m.first] === Math.round(m.was * 0.5) && AD.log.length === 1 && AD.draft.length === 0, made));
    ok('2 the published set has "Undo this publish"', await p.locator('.ad-set button:has-text("Undo this publish")').count() === 1);
    await shot(p, 'undo-publish', '#app .panel:has(.ad-set)');
    await p.click('.ad-set button:has-text("Undo this publish")'); await p.waitForTimeout(300);
    ok('2 Undo asks first', /Undo this publish\?/.test(await p.locator('.modal').innerText()) && await p.evaluate((m) => PRICE_LIST['Basic Utility'][m.first] !== m.was, made));
    await p.click('.modal button:has-text("Put the old prices back")'); await p.waitForTimeout(400);
    ok('2 Undo puts the old prices back', await p.evaluate((m) => PRICE_LIST['Basic Utility'][m.first] === m.was && PRICE_LIST['Basic Lofted'][Object.keys(PRICE_LIST['Basic Lofted'])[0]] === AD.log[0].changes.find((d) => d.model === 'Basic Lofted').old, made));
    const after = await p.locator('#app').innerText();
    ok('2 the set is marked as put back, with who did it', /Put back to the old prices by Super user A/.test(after) && !(await p.locator('.ad-set button:has-text("Undo this publish")').count()), after.slice(-300));
    await p.close();
  }

  // ---------- 3 and 6. Settings limits, confirm, history ----------
  {
    const p = await open();
    await p.evaluate(() => go('of-settings')); await p.waitForTimeout(400);
    ok('6 the Settings page has a history card', /Settings history/.test(await p.locator('#app').innerText()));
    await p.fill('#of-fuel', '30'); await p.click('button[onclick="ofSetFuel()"]'); await p.waitForTimeout(300);
    ok('3 fuel typed as 30 is refused', await p.evaluate(() => OF.set.fuel.perSqFt === 0.3) && /too high/.test(await said(p)) && !(await p.locator('.modal').count()), await said(p));
    await p.fill('#of-fuel', '0.35'); await p.click('button[onclick="ofSetFuel()"]'); await p.waitForTimeout(300);
    const ask = await p.locator('.modal').innerText().catch(() => '');
    ok('3 a normal change asks first', /Save this change\?/.test(ask) && /Fuel surcharge/.test(ask), ask.slice(0, 200));
    ok('3 the question shows a before-and-after example', /Now/.test(ask) && /After/.test(ask) && /\$48\.00/.test(ask) && /\$56\.00/.test(ask), ask);
    ok('3 nothing is saved while the question is open', await p.evaluate(() => OF.set.fuel.perSqFt === 0.3 && OG.log.length === 0));
    await shot(p, 'settings-confirm', '.modal');
    await p.click('.modal button:has-text("Do not change it")'); await p.waitForTimeout(300);
    ok('3 "Do not change it" leaves the setting alone', await p.evaluate(() => OF.set.fuel.perSqFt === 0.3 && document.getElementById('of-fuel').value === '0.3'));
    await p.fill('#of-fuel', '0.35'); await p.click('button[onclick="ofSetFuel()"]'); await p.waitForTimeout(200);
    await p.click('.modal button:has-text("Save the change")'); await p.waitForTimeout(400);
    ok('3 "Save the change" saves it', await p.evaluate(() => OF.set.fuel.perSqFt === 0.35));
    let hist = await p.locator('.og-history').innerText();
    ok('6 the history shows who, the old value and the new value', /Fuel surcharge/.test(hist) && /\$0\.30 per sq ft/.test(hist) && /\$0\.35 per sq ft/.test(hist) && /Super user A/.test(hist), hist);
    // one click on Flat amount no longer drops fuel to $0 silently
    await p.click('.of-seg button:has-text("Flat amount")'); await p.waitForTimeout(300);
    ok('3 switching to "Flat amount" asks first and shows fuel would be not set', /Save this change\?/.test(await p.locator('.modal').innerText().catch(() => '')) && /Not set/.test(await p.locator('.modal').innerText()) && await p.evaluate(() => OF.set.fuel.method === 'size'));
    await p.click('.modal button:has-text("Do not change it")'); await p.waitForTimeout(200);
    // delivery
    const r1 = await p.evaluate(() => { const el = { value: '40' }; ofSetNum('overTo', el, 0, 1000); return { v: OF.set.overTo, m: document.querySelector('.modal') ? 1 : 0 }; });
    ok('3 "past that, up to" cannot be set below the free miles', r1.v === 100 && r1.m === 0 && /more than/.test(await said(p)), [r1, await said(p)]);
    const r2 = await p.evaluate(() => { const el = { value: '150' }; ofSetNum('freeMiles', el, 0, 500); return { v: FREE_DELIVERY_MILES, m: document.querySelector('.modal') ? 1 : 0 }; });
    ok('3 free miles cannot pass the charge miles', r2.v === 50 && r2.m === 0, r2);
    // rent-to-own
    const r3 = await p.evaluate(() => { toRtoSet(36, 'divisor', '1'); return { d: taRtoTerm(36).divisor, m: document.querySelector('.modal') ? 1 : 0 }; });
    ok('3 a rent-to-own divisor of 1 is refused', r3.d !== 1 && r3.m === 0 && /10 to 40/.test(await said(p)), [r3, await said(p)]);
    const was36 = await p.evaluate(() => taRtoTerm(36).divisor);
    await p.evaluate(() => toRtoSet(36, 'divisor', '22')); await p.waitForTimeout(300);
    const rq = await p.locator('.modal').innerText().catch(() => '');
    ok('3 a rent-to-own change asks first and shows the new monthly payment', /Rent-to-own, 36 months/.test(rq) && /Monthly payment, 36 months/.test(rq) && await p.evaluate((w) => taRtoTerm(36).divisor === w, was36), rq.slice(0, 300));
    await p.click('.modal button:has-text("Save the change")'); await p.waitForTimeout(400);
    ok('3 saving the rent-to-own change works', await p.evaluate(() => taRtoTerm(36).divisor === 22 && divisors[36] === 22));
    await p.evaluate(() => { adView('u4'); go('of-settings'); OF.set.driverPay = true; render(); }); await p.waitForTimeout(300);
    hist = await p.locator('.og-history').innerText();
    ok('6 a change made by another person carries their name', /Final payment/.test(hist) && /Lee Harmon/.test(hist) && /Rent-to-own, 36 months/.test(hist), hist.slice(0, 400));
    await shot(p, 'history', '.og-history');
    await p.close();
  }

  // ---------- 4 and 5. Money limits and tax ----------
  {
    const p = await open();
    const id = await p.evaluate(() => { const s = ofAll().find((x) => ofStage(x) === 'review' && !ofRto(x) && !x.invoice && ofTotals(x).balance > 500); go('office'); ofOpen(s.id); return s.id; });
    await p.waitForTimeout(400);
    const t0 = await p.evaluate((id) => { const s = ofSale(id), t = ofTotals(s); return { bal: t.balance, total: t.total, pays: s.money.payments.length, disc: s.money.discounts.length, left: ofLeft(s).map((c) => c.key) }; }, id);
    ok('5 a cash order waiting for review lists Sales tax as still needed', t0.left.includes('tax'), t0.left);
    const page = await p.locator('#app').innerText();
    ok('5 "Before you approve" shows the Sales tax line', /Before you approve/.test(page) && /Sales tax/.test(page) && /mark the order tax exempt/.test(page));
    await p.evaluate(() => { const h = [...document.querySelectorAll('#app .panel h2')].find((e) => /Before you approve/.test(e.textContent)); if (h) h.closest('.panel').id = 'shot-tax'; });
    await shot(p, 'tax', '#shot-tax');
    await p.evaluate((id) => ofApprove(id), id); await p.waitForTimeout(200);
    ok('5 the order cannot be approved without it', await p.evaluate((id) => ofStage(ofSale(id)) === 'review', id));
    await p.evaluate((id) => toSetTax(id, '7'), id); await p.waitForTimeout(300);
    ok('5 typing the tax percent clears the line', await p.evaluate((id) => !ofLeft(ofSale(id)).some((c) => c.key === 'tax'), id));
    await p.evaluate((id) => toSetTax(id, ''), id); await p.waitForTimeout(200);
    ok('5 clearing it brings the line back', await p.evaluate((id) => ofLeft(ofSale(id)).some((c) => c.key === 'tax'), id));
    await p.locator('.og-exempt input').check(); await p.waitForTimeout(300);
    ok('5 ticking "Tax exempt" clears the line too', await p.evaluate((id) => !ofLeft(ofSale(id)).some((c) => c.key === 'tax') && !!ofSale(id).office.taxExempt, id));
    ok('5 a rent-to-own order is not asked for it', await p.evaluate(() => { const s = ofAll().find((x) => ofRto(x) && !x.invoice); return !s || !ofChecks(s).some((c) => c.key === 'tax'); }));
    // money boxes
    const t1 = await p.evaluate((id) => { const t = ofTotals(ofSale(id)); return { bal: t.balance, pays: ofSale(id).money.payments.length }; }, id);
    await p.evaluate((id) => ofPayForm(id), id); await p.waitForTimeout(200);
    await p.fill('#of-pay-amount', '99999999'); await p.click('.modal button:has-text("Save the payment")'); await p.waitForTimeout(300);
    const warn = await p.locator('.modal').innerText();
    ok('4 a payment far above the balance is not saved on the first press', await p.evaluate(({ id, n }) => ofSale(id).money.payments.length === n, { id, n: t1.pays }) && /more than what is owed/.test(warn), warn.slice(0, 300));
    await shot(p, 'money-limit', '.modal');
    await p.fill('#of-pay-amount', '100'); await p.click('.modal button:has-text("Save the payment")'); await p.waitForTimeout(300);
    ok('4 a normal payment saves straight away', await p.evaluate(({ id, n }) => ofSale(id).money.payments.length === n + 1, { id, n: t1.pays }));
    await p.evaluate((id) => ofPayForm(id), id); await p.waitForTimeout(200);
    await p.fill('#of-pay-amount', '50000'); await p.click('.modal button:has-text("Save the payment")'); await p.waitForTimeout(200);
    await p.click('.modal button:has-text("Save the payment")'); await p.waitForTimeout(300);
    ok('4 pressing Save again after the warning does save it', await p.evaluate(({ id, n }) => ofSale(id).money.payments.length === n + 2, { id, n: t1.pays }));
    await p.evaluate((id) => ofDiscountForm(id), id); await p.waitForTimeout(200);
    await p.fill('#of-disc-amount', '50000'); await p.fill('#of-disc-purpose', 'Military'); await p.click('.modal button:has-text("Add the discount")'); await p.waitForTimeout(300);
    ok('4 a discount above the price is refused', await p.evaluate(({ id, n }) => ofSale(id).money.discounts.length === n && ofTotals(ofSale(id)).total > 0, { id, n: t0.disc }) && /cannot be more than the price/.test(await said(p)), await said(p));
    await p.fill('#of-disc-amount', '50'); await p.click('.modal button:has-text("Add the discount")'); await p.waitForTimeout(300);
    ok('4 a normal discount still works', await p.evaluate(({ id, n }) => ofSale(id).money.discounts.length === n + 1, { id, n: t0.disc }));
    await p.close();
  }

  // ---------- 7. Super users ----------
  {
    const p = await open();
    await p.evaluate(() => go('of-users')); await p.waitForTimeout(300);
    await p.evaluate(() => adSet('u2', 'kind', 'owner')); await p.waitForTimeout(200);
    ok('7 one super user cannot demote the other', await p.evaluate(() => adUser('u2').kind === 'super') && /has to agree/.test(await said(p)), await said(p));
    await p.evaluate(() => adRemoveForm('u2')); await p.waitForTimeout(200);
    const form = await p.locator('.modal').innerText();
    ok('7 the remove form says the other super user has to agree', /cannot remove another alone/.test(form) && /Super user B agrees/.test(form), form);
    await p.click('.modal button:has-text("Ask to remove")'); await p.waitForTimeout(200);
    ok('7 a blank reason is refused', await p.evaluate(() => adUser('u2').status === 'active') && /reason/.test(await said(p)), await said(p));
    await p.fill('#ad-why', 'Sample reason for the check'); await p.click('.modal button:has-text("Ask to remove")'); await p.waitForTimeout(400);
    ok('7 with a reason the super user is locked out and waiting, not deleted', await p.evaluate(() => adUser('u2').status === 'pending'));
    const row = await p.locator('.ops-row:has-text("Super user B")').first().innerText();
    ok('7 the list says it is waiting for the other super user to agree', /Waiting for Super user B to agree/.test(row) && /Cancel the removal/.test(row) && !/Accept removal/.test(row), row);
    await shot(p, 'superuser', '#app');
    await p.evaluate(() => adDecide('u2', true)); await p.waitForTimeout(200);
    ok('7 the one who asked cannot accept their own request', await p.evaluate(() => adUser('u2').status === 'pending'), await said(p));
    await p.evaluate(() => adSet('u1', 'kind', 'user')); await p.waitForTimeout(200);
    ok('7 the last working super user cannot be demoted', await p.evaluate(() => adUser('u1').kind === 'super') && /at least one super user/.test(await said(p)), await said(p));
    await p.evaluate(() => adView('u2')); await p.waitForTimeout(400);
    const lock = await p.locator('#app').innerText();
    ok('7 the removed super user sees why, and can answer', /Your access is on hold/.test(lock) && /Sample reason for the check/.test(lock) && /Do not remove me/.test(lock) && /I agree to be removed/.test(lock), lock);
    await p.click('#app button:has-text("Do not remove me")'); await p.waitForTimeout(300);
    ok('7 "Do not remove me" restores the account', await p.evaluate(() => adUser('u2').status === 'active' && !adUser('u2').removal));
    await p.evaluate(() => { adView('u1'); adRemoveForm('u2'); }); await p.waitForTimeout(200);
    await p.fill('#ad-why', 'Sample reason two'); await p.click('.modal button:has-text("Ask to remove")'); await p.waitForTimeout(300);
    await p.evaluate(() => adView('u2')); await p.waitForTimeout(300);
    await p.click('#app button:has-text("I agree to be removed")'); await p.waitForTimeout(300);
    ok('7 agreeing makes the removal final', await p.evaluate(() => adUser('u2').status === 'deleted'));
    await p.evaluate(() => { adView('u1'); go('of-users'); adRemoveForm('u1'); }); await p.waitForTimeout(200);
    await p.evaluate(() => adSet('u1', 'kind', 'owner')); await p.waitForTimeout(200);
    ok('7 the only super user left cannot be demoted or removed', await p.evaluate(() => adUser('u1').kind === 'super' && adUser('u1').status === 'active'));
    // an owner's removal still works the old way
    const own = await p.evaluate(() => { adView('u3'); adRemoveForm('u4'); document.getElementById('ad-why').value = ''; adRemove('u4'); return adUser('u4').status; });
    ok('7 an owner removing an owner still waits on a super user', own === 'pending', own);
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
