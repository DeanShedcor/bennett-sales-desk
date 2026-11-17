const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } });
  const errs = []; let pass = 0, fail = 0;
  p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
  const ev = (f, a) => p.evaluate(f, a), w = (ms = 250) => p.waitForTimeout(ms), txt = () => p.$eval('#app', (e) => e.innerText);
  await p.goto(process.argv[2] || 'http://localhost:8765/'); await w(1500);
  const all = await ev(() => { go('of-orders'); return document.querySelectorAll('#app .ops-row').length; });
  await ev(() => { adUser('u8').lots = ['florence']; adView('u8'); go('of-orders'); }); await w();
  const rows = await p.$$eval('#app .ops-row', (e) => e.map((x) => x.innerText.split('\n')[0]));
  ok('office reviewer for Florence sees only Florence orders', rows.length >= 1 && rows.length < all && rows.every((r) => /Robin Hale/.test(r)), `${all} -> ${rows.join(' | ')}`);
  await ev(() => go('office')); await w();
  ok('office home counts are theirs only', !/Dana Whitfield|Morgan Avery/.test(await txt()) && /Robin Hale/.test(await txt()));
  ok('the bar says which lots', /sees only Florence/.test(await p.$eval('#ad-bar', (e) => e.innerText)));
  ok('nothing was removed from the records', await ev(() => S.sales.length) >= all);
  await ev(() => go('logi')); await w();
  ok('their logistics view (read only) holds no other lot’s customer', !/Kelly Ardmore|Dana Whitfield/.test(await txt()));
  // dispatcher limited to Lexington
  const loadsAll = await ev(() => { adView('u1'); go('lg-loads'); return LG.loads.length; });
  await ev(() => { adUser('u11').lots = ['lexington']; adView('u11'); go('lg-loads'); }); await w();
  const t = await txt();
  ok('dispatcher for Lexington sees the Lexington load and not home deliveries elsewhere', /Lexington/.test(t) && !/H12/.test(t), String(loadsAll));
  await ev(() => lgOpen('AC')); await w();
  ok('a load to their lot opens whole', /Mocksville/.test(await txt()) && errs.length === 0);
  await ev(() => go('logi')); await w();
  ok('records untouched after drawing', await ev(() => LG.loads.length) === loadsAll);
  // plant person sees every lot the plant builds for
  await ev(() => { adView('u9'); go('prod'); }); await w();
  const prPlant = await ev(() => document.querySelectorAll('.pr-card').length);
  await ev(() => { adUser('u9').lots = ['graniteville']; go('prod'); }); await w();
  const prLot = await ev(() => document.querySelectorAll('.pr-card').length);
  ok('plant manager on the plant sees the whole board; on one lot, only that lot', prPlant > prLot && prLot >= 1, `${prPlant} vs ${prLot}`);
  // sales rep of another lot
  await ev(() => { adView('u7'); go('home'); }); await w();
  ok('a salesperson from another lot does not see this lot’s desk', /This Sales desk is the Moncks Corner lot/.test(await txt()));
  await ev(() => { adView('u6'); go('home'); }); await w();
  ok('the Moncks Corner lot manager does', /From the first hello/.test(await txt()));
  await ev(() => { adView('u3'); go('of-orders'); }); await w();
  ok('an owner sees every lot', await ev(() => document.querySelectorAll('#app .ops-row').length) === all);
  console.log(`\n${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 4));
  await b.close();
})();
