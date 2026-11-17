const { chromium } = require('playwright');
const D = process.cwd() + '/';
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 960 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text()));
  await p.goto(url); await p.waitForTimeout(1300);
  const log = (...a) => console.log(...a), toastText = () => p.evaluate(() => document.getElementById('toast').textContent);
  await p.evaluate(() => go('prod')); await p.waitForTimeout(400);
  log('loads strip:', await p.$$eval('.pr-load', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 170))));
  await p.screenshot({ path: D + 'prodloads-board.png' });
  // send load B to the floor
  await p.click('.pr-load:has-text("North Carolina run") button:has-text("Send to the floor")'); await p.waitForTimeout(300);
  log('dispatch B:', await toastText(), '| phases:', await p.evaluate(() => ['SAMPLE-1220-3001', 'SAMPLE-1016-3002'].map((id) => phaseNames[prUnit(id).phase]).join(', ')), '| state:', await p.evaluate(() => prLoad('B').state));
  // a new load, over the trailer, then trimmed
  await p.click('button:has-text("New load")'); await p.waitForTimeout(300);
  log('picker rows:', await p.locator('.pr-pickrow').count(), '| sum:', await p.textContent('#pr-sum'));
  const boxes = p.locator('.pr-pickrow input');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  log('3 picked:', await p.textContent('#pr-sum'), '| class:', await p.getAttribute('#pr-sum', 'class'));
  await boxes.nth(2).uncheck();
  await p.fill('#pr-alias', 'Lowcountry run'); await p.click('.modal button:has-text("Save the load")'); await p.waitForTimeout(300);
  log('saved:', await toastText(), '| loads now:', await p.evaluate(() => PR.loads.map((l) => `${l.id}:${l.alias}:${l.units.length}:${l.state}`).join(' ; ')));
  // card shows its load; the unit page select
  const firstC = await p.evaluate(() => prLoad('C').units[0]);
  await p.evaluate((id) => prOpen(id), firstC); await p.waitForTimeout(300);
  log('unit page load select:', await p.$eval('.pr-loadsel select', (e) => e.options[e.selectedIndex].text));
  await p.selectOption('.pr-loadsel select', ''); await p.waitForTimeout(200);
  log('after unassign: load C units', await p.evaluate(() => prLoad('C')?.units.length));
  // finish load A's buildings and let Logistics ship the group
  await p.evaluate(() => {
    for (const id of prLoad('A').units) {
      while (prUnit(id).phase < PR_QA) prMove(id, prUnit(id).phase + 1);
      const b = build(id); b.results[QC] = { result: 'pass', firstPass: true, by: 'Test', at: Date.now() }; b.attempts[QC] = 1; Q.signSerial = id; doSignoff();
    }
    LG.tile = 'all'; go('logi');
  });
  await p.waitForTimeout(400);
  log('\nLogistics sections:', await p.$$eval('#lg-list h2', (els) => els.map((e) => e.innerText.replace(/\n/g, ' '))));
  log('planned row:', await p.$eval('.ops-row:has-text("Production load A")', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 260)));
  await p.screenshot({ path: D + 'prodloads-logi.png' });
  await p.click('.ops-row:has-text("Production load A") button:has-text("Build this load")'); await p.waitForTimeout(300);
  const L = await p.evaluate(() => LG.loadId);
  log('logistics load', L, ':', await p.evaluate((l) => { const x = lgLoad(l); return `prod ${x.prod} | ${lgFeet(x)} ft | stops ${x.stops.map((s) => s.key).join(' > ')}`; }, L), '| pill:', await p.$$eval('.of-top .pill', (els) => els.map((e) => e.innerText)));
  log('production load A done for the plant:', await p.evaluate(() => prLoadDone(prLoad('A'))), '| still in strip:', await p.evaluate(() => prLoadsOpen().some((l) => l.id === 'A')));
  console.log('errors:', errs.length, errs.slice(0, 6));
  await b.close();
})();
