const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  let bad = 0, seen = 0;
  for (const w of [390, 360, 768, 1360]) {
    const p = await b.newPage({ viewport: { width: w, height: 820 } });
    p.on('pageerror', (e) => errs.push(w + ' PAGEERROR ' + e.message));
    p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push(w + ' CONSOLE ' + m.text()));
    await p.goto(URL); await p.waitForTimeout(1500);
    const steps = [
      ['home', () => go('home')], ['lot', () => go('lot')], ['unit', () => openUnit(0)], ['start', () => go('start')], ['orders', () => go('orders')], ['sale', () => openSale('AA-20411')], ['performance', () => go('performance')], ['stock', () => go('stock')], ['notes', () => go('notes')],
      ['configure-finish', () => { begin(); goStep(steps.indexOf('Finish')); }], ['configure-size', () => goStep(steps.indexOf('Size'))],
      ['office', () => go('office')], ['of-orders', () => go('of-orders')], ['of-order', () => ofOpen('AA-20411')], ['of-order2', () => ofOpen('RAV-5538')], ['of-pay', () => go('of-pay')], ['of-requests', () => go('of-requests')], ['of-settings', () => go('of-settings')], ['of-bills', () => go('of-bills')], ['of-notes', () => go('of-notes')],
      ['prod', () => go('prod')], ['pr-list', () => go('pr-list')], ['pr-unit', () => prOpen(prUnits().find((u) => u.phase >= 2)?.id)], ['pr-phases', () => go('pr-phases')], ['pr-notes', () => go('pr-notes')],
      ['qc', () => go('qc')], ['qc-rework', () => go('qc-rework')], ['qc-signoff', () => go('qc-signoff')], ['qc-report', () => go('qc-report')], ['qc-changes', () => go('qc-changes')],
      ['logi', () => go('logi')], ['lg-loads', () => go('lg-loads')], ['lg-load', () => lgOpen('AC')], ['lg-load2', () => lgOpen('H12')], ['lg-cal', () => go('lg-cal')], ['lg-places', () => go('lg-places')], ['lg-fleet', () => go('lg-fleet')], ['lg-drive', () => go('lg-drive')], ['lg-service', () => go('lg-service')], ['lg-notes', () => go('lg-notes')],
    ];
    for (const [name, fn] of steps) {
      try { await p.evaluate(fn); } catch (e) { console.log('STEP ERROR', w, name, String(e.message).slice(0, 160)); bad++; continue; }
      await p.waitForTimeout(180);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, len: document.getElementById('app').innerText.length, bar: document.querySelector('.topbar-in').scrollWidth > document.querySelector('.topbar-in').clientWidth + 1 }));
      seen++;
      if (o.sw > o.cw || o.len < 40 || o.bar) { bad++; console.log('PROBLEM', w, name, JSON.stringify(o)); }
    }
    // overlays
    for (const [name, fn] of [['answers', () => taOpenAnswers('size-limits')], ['notices', () => { taCloseAnswers(); taOpenNotices(); }], ['pricelist', () => { closeModal(); taPriceList(); }], ['rto', () => { closeModal(); taRtoOpen(6018); }]]) {
      await p.evaluate(fn); await p.waitForTimeout(150);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      seen++;
      if (o.sw > o.cw) { bad++; console.log('PROBLEM overlay', w, name, JSON.stringify(o)); }
    }
    await p.evaluate(() => closeModal());
    await p.close();
  }
  console.log(`sweep: ${seen} screens checked at 4 widths, ${bad} problems, errors ${errs.length}`, errs.slice(0, 6));
  await b.close();
})();
