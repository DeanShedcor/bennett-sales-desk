// Fix 3: the invoice adds up. node fix03.js <url> [pic]
const { chromium } = require('playwright');
const mk = require('../helpers/make-sale');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
const num = (s) => Number(String(s).replace(/[^0-9.\-−]/g, '').replace('−', '-'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const type of ['Cash purchase', 'Rent-to-own']) {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(400);
    await mk(p, type);
    if (type === 'Rent-to-own') { await p.evaluate(() => { closeModal(); go('order'); }); await p.waitForTimeout(400); }
    await p.evaluate(() => { const s = sfSale(); ofSiteForm(s.id); }); await p.waitForTimeout(200);
    await p.fill('#of-site-miles', '72'); await p.selectOption('#of-site-access', 'Clear access'); await p.check('#of-site-nogate'); await p.selectOption('#of-site-ground', 'Level');
    await p.click('.modal button:has-text("Save")'); await p.waitForTimeout(300);
    await p.evaluate(() => orderDoc('invoice')); await p.waitForTimeout(400);
    const d = await p.evaluate(() => ({
      lines: [...document.querySelectorAll('.modal .od-lines tbody tr')].map((tr) => [tr.children[0].childNodes[0].textContent.trim(), tr.children[2].textContent.trim()]),
      totals: [...document.querySelectorAll('.modal .od-totals .od-kv')].map((e) => [e.children[0].textContent.trim(), e.children[1].textContent.trim()]),
      total: sfSale().total,
    }));
    const T = Object.fromEntries(d.totals), tag = type === 'Cash purchase' ? 'Cash' : 'RTO';
    const priced = d.lines.filter((x) => x[1] !== 'Included'), sumLines = Math.round(priced.reduce((t, x) => t + num(x[1]), 0) * 100) / 100;
    ok(`${tag}: the priced lines add up to the subtotal`, sumLines === num(T['Subtotal · building and options']), `${sumLines} vs ${T['Subtotal · building and options']} ${JSON.stringify(d.lines)}`);
    ok(`${tag}: the fuel surcharge shows its price`, d.lines.some((x) => /Fuel surcharge/.test(x[0]) && x[1] === '$48.00'), JSON.stringify(d.lines));
    ok(`${tag}: nothing reads "None" or "No …" as an included item`, !d.lines.some((x) => /^(No|None) /.test(x[0])), JSON.stringify(d.lines));
    ok(`${tag}: delivery is listed once, in the totals`, T['Delivery'] === '$100.00' && !d.lines.some((x) => /^Delivery/.test(x[0])), JSON.stringify(d.totals));
    if (type === 'Cash purchase') {
      ok('Cash: Total before sales tax = subtotal + delivery', num(T['Total before sales tax']) === num(T['Subtotal · building and options']) + 100, JSON.stringify(d.totals));
      ok('Cash: sales tax line says the office adds it', T['Sales tax'] === 'Added by the office');
      ok('Cash: balance = total − due today', num(T['Balance after today’s payment, before sales tax']) === num(T['Total before sales tax']) - num(T['Amount due today']), JSON.stringify(d.totals));
      await p.evaluate(() => { closeModal(); const s = sfSale(); s.money = s.money || {}; });
      if (PIC) { await p.waitForTimeout(4300); await p.evaluate(() => orderDoc('invoice')); await p.waitForTimeout(400); const r = await p.evaluate(() => { const m = document.querySelector('.modal'); m.querySelector('.od-totals').scrollIntoView({ block: 'end' }); const q = m.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }); await p.waitForTimeout(300); await p.screenshot({ path: PIC + '.png', clip: { x: r.x, y: Math.max(0, r.y), width: r.w, height: Math.min(r.h, 1000 - Math.max(0, r.y)) } }); }
    } else {
      ok('RTO: Total price = subtotal + delivery', num(T['Total price']) === num(T['Subtotal · building and options']) + 100, JSON.stringify(d.totals));
      ok('RTO: the monthly payment line is still there', 'Monthly payment before taxes' in T && 'Amount due today' in T, JSON.stringify(d.totals));
    }
    await p.close();
  }
  // the fixed sample invoice is left alone
  const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 } })).newPage();
  await p.goto(L); await p.waitForTimeout(2200);
  const sample = await p.evaluate(() => { const s = S.sales.find((x) => x.invoice); if (!s) return null; S.activeSale = s.id; orderDoc('invoice'); return [...document.querySelectorAll('.modal .od-totals .od-kv')].map((e) => e.children[0].textContent.trim()); });
  ok('The sample order’s fixed invoice is unchanged', sample && sample[0] === 'Subtotal', JSON.stringify(sample));
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
