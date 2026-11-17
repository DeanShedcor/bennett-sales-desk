const { chromium } = require('playwright');
const D = process.cwd() + '/';
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1360, height: 950 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text()));
  await p.goto(url); await p.waitForTimeout(1300);
  const log = (...a) => console.log(...a), toastText = () => p.evaluate(() => document.getElementById('toast').textContent);
  await p.evaluate(() => go('prod')); await p.waitForTimeout(400);
  log('side:', await p.evaluate(() => document.body.dataset.side), '| stats:', await p.$$eval('.ops-tiles .kpi', (els) => els.map((e) => e.innerText.replace(/\n/g, ' '))));
  log('columns:', await p.$$eval('.pr-col', (els) => els.map((e) => e.querySelector('header').innerText.replace(/\n/g, ' ') + ' [' + e.querySelectorAll('.pr-card').length + ' shown]')));
  await p.screenshot({ path: D + 'prod-board.png', fullPage: true });
  // open a sample, move forward with a note, back, hold, unhold
  await p.click('.pr-card:has-text("SAMPLE-1220-3001")'); await p.waitForTimeout(300);
  log('unit:', await p.$eval('.pagehead', (e) => e.innerText.replace(/\n+/g, ' | ').slice(0, 130)));
  await p.fill('#pr-note', 'Floor joists 12 in on center'); await p.click('.pr-move .primary'); await p.waitForTimeout(200);
  log('after next:', await toastText(), '| phase', await p.evaluate(() => phaseNames[prUnit('SAMPLE-1220-3001').phase]));
  await p.click('.pr-move .secondary'); await p.waitForTimeout(200);
  log('after back:', await p.evaluate(() => phaseNames[prUnit('SAMPLE-1220-3001').phase]));
  await p.click('button:has-text("Put on hold")'); await p.click('.of-feepick button:has-text("Waiting on materials")'); await p.click('.modal button:has-text("Put on hold")'); await p.waitForTimeout(200);
  log('on hold: next disabled', await p.isDisabled('.pr-move .primary'), '|', await p.textContent('.lg-bad'));
  await p.click('button:has-text("Take off hold")'); await p.waitForTimeout(200);
  log('history:', await p.$$eval('.od-col .log', (els) => els.map((e) => e.innerText.replace(/\n+/g, ' ').slice(0, 80))));
  await p.screenshot({ path: D + 'prod-unit.png', fullPage: true });
  // build sheet for a production-only building
  await p.click('button:has-text("Build sheet")'); await p.waitForTimeout(500);
  log('build sheet open:', await p.locator('#bsheet').count(), '| title:', (await p.textContent('#bsheet .bs-bar strong')).slice(0, 60));
  await p.click('#bsheet .bs-bar button:has-text("Back")'); await p.waitForTimeout(300);
  // drag a card on the board to Final QA
  await p.evaluate(() => go('prod')); await p.waitForTimeout(300);
  const dt = await p.evaluateHandle(() => new DataTransfer());
  await p.dispatchEvent('.pr-card:has-text("SAMPLE-1216-3009")', 'dragstart', { dataTransfer: dt });
  await p.dispatchEvent('.pr-col >> nth=7', 'drop', { dataTransfer: dt });
  await p.waitForTimeout(300);
  log('drag to Final QA:', await toastText(), '| phase', await p.evaluate(() => phaseNames[prUnit('SAMPLE-1216-3009').phase]), '| in QC:', await p.evaluate(() => !!build('SAMPLE-1216-3009') && qcStatus(build('SAMPLE-1216-3009'))));
  // change order blocks moving on until acknowledged (sample customer order GRV-0020 at Walls)
  await p.evaluate(() => { S.changes.push({ id: 'CO-7', order: 'GRV-0020', what: 'Add a window', reason: 'Customer asked', done: 2, log: [new Date().toISOString(), new Date().toISOString()] }); prOpen('GRV-0020'); });
  await p.waitForTimeout(300);
  log('change order: next disabled', await p.isDisabled('.pr-move .primary'), '|', await p.textContent('.lg-bad'));
  await p.click('button:has-text("Acknowledge")'); await p.waitForTimeout(200);
  log('after acknowledge: next disabled', await p.isDisabled('.pr-move .primary'));
  // a lot's stock order: office approves, plant builds, QC signs off, Logistics delivers, the lot receives
  const stock = await p.evaluate(() => S.stock.find((r) => (r.stage || 0) === 0).id);
  await p.evaluate(() => go('of-requests')); await p.click(`.ops-row:has-text("${stock}") .primary`); await p.waitForTimeout(200);
  log('\nSTOCK', stock, 'after office approval -> phase', await p.evaluate((id) => phaseNames[prUnit(id).phase], stock));
  for (let i = 0; i < 6; i++) await p.evaluate((id) => prMove(id, prUnit(id).phase + 1), stock);
  log('at', await p.evaluate((id) => phaseNames[prUnit(id).phase], stock), '| QC build:', await p.evaluate((id) => qcStatus(build(id)), stock), '| desk restock says:', await p.evaluate((id) => { go('stock'); const row = [...document.querySelectorAll('.stockrow')].find((r) => r.textContent.includes(id)); return row.querySelector('.stockactions').innerText.replace(/\n+/g, ' | '); }, stock));
  await p.evaluate((id) => { const b = build(id); b.results[QC] = { result: 'pass', firstPass: true, by: 'Test', at: Date.now() }; b.attempts[QC] = 1; Q.signSerial = id; doSignoff(); }, stock);
  await p.waitForTimeout(200);
  log('signed off:', await toastText(), '| board phase', await p.evaluate((id) => phaseNames[prUnit(id).phase], stock));
  await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
  log('on the Logistics board:', await p.evaluate((id) => { const u = lgUnit(id); return u && `${u.name} ${u.kind} to ${u.lotId} ${u.leg}`; }, stock));
  await p.evaluate((id) => { const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [id]); load.rigId = 'rig-1'; load.driver = 'Marcus Bell'; let d = lgAddDays(lgToday(), 1); while (!lotDay(lotById('moncks-corner'), d).open) d = lgAddDays(d, 1); load.date = d; lgSchedule(load.id); lgStart(load.id); lgArrive(load.id, 0); lgDropDone(load.id, 0, { by: 'Lot staff', note: 'Good', photo: '' }); go('prod'); }, stock);
  await p.waitForTimeout(300);
  log('after delivery: stock row', await p.evaluate((id) => JSON.stringify((({ status, stage }) => ({ status, stage }))(S.stock.find((r) => r.id === id))), stock), '| still on the production board:', await p.evaluate((id) => !!prUnit(id), stock));
  // roster, notes, phone
  for (const pg of ['pr-list', 'pr-notes']) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(250); log(pg, 'len', await p.$eval('#app', (e) => e.innerText.length)); }
  console.log('errors:', errs.length, errs.slice(0, 6));
  await b.close();
})();
