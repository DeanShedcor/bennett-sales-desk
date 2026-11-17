const { chromium, devices } = require('playwright');
const D = process.cwd() + '/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.argv[2] || 'http://localhost:8765/'); await p.waitForTimeout(1200);
  const overflow = async (name) => {
    const o = await p.evaluate(() => {
      const w = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('#app *, .topbar *, .previewstrip *, .tabbar *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') bad.push(el.tagName + '.' + String(el.className).slice(0, 30) + ' ' + Math.round(r.right)); });
      return { scroll: document.documentElement.scrollWidth, w, bad: bad.slice(0, 5) };
    });
    console.log(name.padEnd(22), 'scrollWidth', o.scroll, 'of', o.w, o.bad.length ? 'OVERFLOW ' + o.bad.join(' | ') : 'ok');
  };
  const shots = [
    ['ph-office', () => go('office')], ['ph-of-order', () => ofOpen('AA-20411')], ['ph-of-order-approved', () => ofOpen('RAV-5538')], ['ph-of-pay', () => go('of-pay')], ['ph-of-requests', () => go('of-requests')], ['ph-of-settings', () => go('of-settings')],
    ['ph-logi', () => go('logi')], ['ph-load-AD', () => lgOpen('AD')], ['ph-load-AC', () => lgOpen('AC')], ['ph-drive', () => go('lg-drive')], ['ph-cal', () => go('lg-cal')], ['ph-places', () => go('lg-places')], ['ph-fleet', () => go('lg-fleet')], ['ph-loads', () => go('lg-loads')],
    ['ph-desk-order', () => openSale('AA-20411')], ['ph-home', () => go('home')], ['ph-qc', () => go('qc')], ['ph-prod', () => go('prod')], ['ph-prod-unit', () => prOpen('GRV-0020')], ['ph-prod-list', () => go('pr-list')],
  ];
  for (const [name, fn] of shots) {
    await p.evaluate(fn); await p.waitForTimeout(350);
    await overflow(name);
    await p.screenshot({ path: D + name + '.png', fullPage: false });
  }
  await p.evaluate(() => ofOpen('AA-20411')); await p.waitForTimeout(300);
  await p.screenshot({ path: D + 'ph-of-order-full.png', fullPage: true });
  await p.evaluate(() => lgOpen('AD')); await p.waitForTimeout(300);
  await p.screenshot({ path: D + 'ph-load-AD-full.png', fullPage: true });
  console.log('tabbar buttons visible (logi):', await p.evaluate(() => { go('logi'); return [...document.querySelectorAll('.tabbar button')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()); }));
  console.log('tabbar buttons visible (office):', await p.evaluate(() => { go('office'); return [...document.querySelectorAll('.tabbar button')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()); }));
  console.log('strip switch:', await p.evaluate(() => [...document.querySelectorAll('.sideswitch.strip button')].map((x) => x.innerText + (getComputedStyle(x).backgroundColor !== 'rgba(0, 0, 0, 0)' ? '*' : ''))));
  console.log('errors', errs);
  await b.close();
})();
