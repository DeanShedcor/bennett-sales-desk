const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await p.goto(URL);
  await p.waitForTimeout(1500);
  console.log('boot side', await p.evaluate(() => document.body.dataset.side), 'kb', await p.evaluate(() => TA_KB.length), 'divisors', await p.evaluate(() => JSON.stringify(divisors)));
  for (const q of ['how far is delivery free', 'biggest building we deliver', 'is there interest on rent to own', 'blocking height', 'roll up door on a barn', 'warranty', 'anchors', 'first payment due', 'lost keys', 'techshield', 'permit steel', 'xyzzy nothing']) {
    console.log(q.padEnd(34), '->', await p.evaluate((q) => taSearch(q).slice(0, 3).map((a) => a.id).join(', '), q));
  }
  await p.click('#ta-ans-btn');
  await p.waitForTimeout(300);
  console.log('front rows', await p.$$eval('#ta-ans-body .ta-row', (e) => e.length), 'chips', await p.$$eval('.ta-ask .chipbtn', (e) => e.map((x) => x.textContent)));
  await p.screenshot({ path: 'shots/ans-front.png' });
  await p.fill('#ta-ans-q', 'how far is delivery free');
  await p.waitForTimeout(200);
  console.log('best:', await p.$eval('.ta-best strong', (e) => e.textContent));
  await p.screenshot({ path: 'shots/ans-search.png' });
  await p.click('.ta-best button');
  await p.waitForTimeout(200);
  console.log('article h2:', await p.$eval('.ta-article h2', (e) => e.textContent), '| flag:', await p.$eval('.ta-article .notice', (e) => e.textContent.slice(0, 80)).catch(() => 'none'));
  await p.screenshot({ path: 'shots/ans-article.png' });
  await p.evaluate(() => { TA.ans.id = null; TA.ans.q = ''; document.querySelector('[data-topic="Advertising and routing"]').click(); });
  await p.waitForTimeout(150);
  console.log('staff-only rows', await p.$$eval('#ta-ans-body .ta-row', (e) => e.length));
  await p.click('#ta-ans-body .ta-row');
  await p.waitForTimeout(150);
  console.log('locked article:', await p.$eval('.ta-article', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 200)));
  await p.click('[data-tab="practice"]');
  await p.waitForTimeout(150);
  console.log('practice personas', await p.$$eval('.ta-persona strong', (e) => e.map((x) => x.textContent)));
  await p.keyboard.press('Escape');
  console.log('closed', await p.$('#ta-sheet') === null);
  // notices
  await p.evaluate(() => { taNotify({ to: 'sales', title: 'Test notice', body: 'Body text', go: "go('orders')" }); taNotify({ to: 'office', title: 'Office only', body: 'x' }); });
  console.log('bell sales', await p.$eval('#ta-bell-count', (e) => e.hidden + ':' + e.textContent));
  await p.click('#ta-bell'); await p.waitForTimeout(200);
  console.log('notice modal', await p.$eval('.modal', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 200)));
  await p.click('.ta-notice button'); await p.waitForTimeout(200);
  console.log('after open page', await p.evaluate(() => S.page), 'bell', await p.$eval('#ta-bell-count', (e) => e.hidden));
  for (const side of ['office', 'prod', 'qc', 'logi']) {
    await p.evaluate((s) => go(s), side); await p.waitForTimeout(250);
    console.log(side, 'bell', await p.$eval('#ta-bell-count', (e) => e.hidden + ':' + e.textContent), 'answers btn visible', await p.$eval('#ta-ans-btn', (e) => e.offsetWidth > 0));
    await p.click('#ta-ans-btn'); await p.waitForTimeout(150);
    console.log('   suggest', await p.$$eval('#ta-ans-body .ta-row strong', (e) => e.map((x) => x.textContent.slice(0, 30)).join(' / ')), '| tabs', await p.$$eval('.ta-tabs button', (e) => e.length));
    await p.keyboard.press('Escape');
  }
  console.log('rto calc 24mo $6018:', await p.evaluate(() => JSON.stringify(taRtoCalc(24, 6018))), '| chart rows', await p.evaluate(() => taRtoChart(24, 6018).length));
  // top bar widths
  for (const w of [1600, 1360, 1180, 1000, 800, 390, 360]) {
    await p.setViewportSize({ width: w, height: 800 });
    for (const pg of ['home', 'office', 'prod', 'qc', 'logi']) {
      await p.evaluate((x) => go(x), pg); await p.waitForTimeout(120);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bar: document.querySelector('.topbar-in').scrollWidth, barw: document.querySelector('.topbar-in').clientWidth, wraps: [...document.querySelectorAll('.topnav button')].some((b) => b.offsetHeight > 44) }));
      if (o.sw > o.cw || o.bar > o.barw + 1 || o.wraps) console.log('  OVERFLOW', w, pg, JSON.stringify(o));
    }
    await p.screenshot({ path: `shots/bar-${w}.png`, clip: { x: 0, y: 0, width: w, height: 130 } });
  }
  console.log('ERRORS', errs.length, errs.slice(0, 10));
  await b.close();
})();
