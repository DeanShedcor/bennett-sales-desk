// Electrical placement question. node fix17.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer';
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); }); await p.waitForTimeout(300);
    await p.evaluate(() => { S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    ok(`${tag}: a new building starts with Basic electrical picked, placement not answered`, await p.evaluate(() => S.c.electrical === 'Basic' && !S.c.elecPlace));
    await p.evaluate(() => change('electrical', 'None')); await p.waitForTimeout(300);
    const E = await p.evaluate(() => steps.indexOf('Electrical'));
    const cont = () => p.locator('.summaryactions button:has-text("Continue")').click();
    for (let i = 0; i < E; i++) { await cont(); await p.waitForTimeout(300); }
    ok(`${tag}: reached the Electrical step`, await p.evaluate((E) => S.step === E, E));
    ok(`${tag}: no electrical, no question`, !(await p.locator('#ep-card').count()));
    await cont(); await p.waitForTimeout(300);
    ok(`${tag}: with no electrical, Continue moves on`, await p.evaluate((E) => S.step === E + 1, E));
    await p.evaluate((E) => goStep(E), E); await p.waitForTimeout(300);
    await p.evaluate(() => change('electrical', 'Basic')); await p.waitForTimeout(400);
    const txt = await p.locator('#ep-card').innerText();
    ok(`${tag}: choosing a package asks the question with Yes and Edit floor plan`, /Do you want the default electrical package placement installed\?/.test(txt) && /Yes/.test(txt) && /Edit floor plan/.test(txt), txt);
    if (PIC) { await p.waitForTimeout(4200); await p.locator('#ep-card').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-ask${phone ? '-phone' : ''}.png` }); }
    await cont(); await p.waitForTimeout(400);
    ok(`${tag}: Continue is blocked until one is pressed`, await p.evaluate((E) => S.step === E, E));
    await p.evaluate((E) => goStep(E + 1), E); await p.waitForTimeout(300);
    ok(`${tag}: jumping to a later step is blocked too`, await p.evaluate((E) => S.step === E, E));
    await p.evaluate(() => whenBuildReady(quoteForm)); await p.waitForTimeout(300);
    ok(`${tag}: the finish buttons are blocked too`, !(await p.locator('#qcustomer').count()) && await p.evaluate((E) => S.step === E, E));
    await p.waitForTimeout(4300);
    await p.click('#ep-card button:has-text("Yes")'); await p.waitForTimeout(400);
    ok(`${tag}: Yes records the default placement`, await p.evaluate(() => S.c.elecPlace === 'default') && /Default electrical placement will be installed/.test(await p.locator('#ep-card').innerText()));
    if (PIC && !phone) { await p.waitForTimeout(4200); await p.locator('#ep-card').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${PIC}-yes.png` }); }
    await cont(); await p.waitForTimeout(300);
    ok(`${tag}: after Yes, Continue moves on`, await p.evaluate((E) => S.step === E + 1, E));
    await p.evaluate(() => change('electrical', 'Expanded')); await p.waitForTimeout(300);
    ok(`${tag}: changing the package asks again`, await p.evaluate(() => !S.c.elecPlace));
    await p.evaluate(() => goStep(steps.length - 1)); await p.waitForTimeout(400);
    ok(`${tag}: and sends the salesperson back to the question`, await p.evaluate((E) => S.step === E, E) && await p.locator('#ep-card.ask').count() === 1);
    await p.waitForTimeout(4300);
    await p.click('#ep-card button:has-text("Edit floor plan")'); await p.waitForTimeout(700);
    ok(`${tag}: Edit floor plan opens the floor plan`, await p.evaluate(() => document.body.classList.contains('bs-open')));
    if (PIC && !phone) await p.screenshot({ path: `${PIC}-plan.png` });
    await p.evaluate(() => closeBuildSheet()); await p.waitForTimeout(400);
    ok(`${tag}: coming back records "placed on the floor plan"`, await p.evaluate(() => S.c.elecPlace === 'edited') && /placed on the floor plan/.test(await p.locator('#ep-card').innerText()));
    await cont(); await p.waitForTimeout(300);
    ok(`${tag}: after editing, Continue moves on`, await p.evaluate((E) => S.step === E + 1, E));
    ok(`${tag}: the choice is listed with what is included`, await p.evaluate(() => included(S.c).some((x) => /Electrical placed on the floor plan/.test(x))));
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
