// Porch railing by name, a deeper end porch, a full side porch, and which buildings can have which
// porch. node 25-porch-railing.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
const WANT = {
  'End Porch': [['No railing', 0], ['Side railing only', 320], ['Door on the right', 560], ['Door on the left', 560], ['Door in the center', 640]],
  'Middle Porch': [['No railing', 0], ['Door on the right', 160], ['Door on the left', 160]],
  'Side Porch': [['No railing', 0], ['Side railing only', 320]],
  'Deluxe Porch': [['Standard railing', 0], ['Extended railing', 160], ['No railing', 0]],
  'Full Side Porch': [['Standard railing', 960], ['No railing', 0]],
};
const START = { 'End Porch': 'No railing', 'Middle Porch': 'No railing', 'Side Porch': 'No railing', 'Deluxe Porch': 'Standard railing', 'Full Side Porch': 'Standard railing' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    await p.evaluate(() => { change('size', '12x20'); goStep(steps.indexOf('Package')); }); await p.waitForTimeout(400);
    return p;
  };
  const pick = async (p, pk) => { await p.evaluate((pk) => change('package', pk), pk); await p.waitForTimeout(350); };
  const rail = (p) => p.evaluate(() => [...document.querySelectorAll('#po-rail .po-opt')].map((e) => [e.querySelector('strong').textContent.trim(), e.querySelector('em').textContent.trim(), e.classList.contains('on')]));
  const num = (s) => (/Included/.test(s) ? 0 : Number(String(s).replace(/[^0-9.]/g, '')));
  const shot = async (p, name, sel) => { if (!PIC) return; await p.waitForTimeout(4300); if (sel) await p.locator(sel).scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-${name}.png` }); };

  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);
    for (const [pk, want] of Object.entries(WANT)) {
      await pick(p, pk);
      const got = await rail(p);
      ok(`${tag}: ${pk} shows its own railing choices, in order, with their prices`, JSON.stringify(got.map((g) => [g[0], num(g[1])])) === JSON.stringify(want), JSON.stringify(got));
      ok(`${tag}: ${pk} starts on “${START[pk]}”`, got.find((g) => g[2])?.[0] === START[pk], JSON.stringify(got));
      if (!phone) {
        /* every choice: the total moves by exactly its price, and the price line names it with its feet */
        const base = await p.evaluate(() => amount() - (breakdown(S.c).find((r) => /^Porch railing/.test(r.name))?.amount || 0));
        let good = true, why = '';
        for (const [name, price] of want) {
          await p.locator(`#po-rail .po-opt:has(strong:text-is("${name}"))`).click(); await p.waitForTimeout(250);
          const r = await p.evaluate(() => ({ total: amount(), row: breakdown(S.c).find((x) => /^Porch railing/.test(x.name)), sum: breakdown(S.c).reduce((t, x) => t + x.amount, 0), railing: S.c.railing }));
          const rowOk = price ? r.row && r.row.amount === price && r.row.name === `Porch railing: ${name} · ${price / 40} ft` : !r.row;
          if (r.total !== base + price || !rowOk || r.railing !== name || Math.abs(r.sum - r.total) > 0.01) { good = false; why += JSON.stringify([name, r, base]); }
        }
        ok(`${tag}: ${pk}: each choice adds exactly its price, as a named line with the feet`, good, why);
      }
    }
    ok(`${tag}: nobody types railing feet any more`, !(await p.locator('#po-box input').count()) && await p.evaluate(() => { goStep(steps.length - 1); return !/Porch railing/.test(document.querySelector('.ta-addons')?.innerText || ''); }));
    await p.evaluate(() => goStep(steps.indexOf('Package'))); await p.waitForTimeout(300);

    /* railing color only with a railing */
    await pick(p, 'End Porch');
    ok(`${tag}: with no railing, no railing color is asked`, !(await p.locator('#po-color').count()) && await p.evaluate(() => !S.c.railColor));
    await p.locator('#po-rail .po-opt:has(strong:text-is("Door in the center"))').click(); await p.waitForTimeout(300);
    ok(`${tag}: with a railing, White or Black railing is asked`, (await p.locator('#po-color button').allInnerTexts()).join('|') === 'White railing|Black railing' && await p.evaluate(() => S.c.railColor === 'White'));
    await p.click('#po-color button:has-text("Black")'); await p.waitForTimeout(300);
    ok(`${tag}: the color picked is kept`, await p.evaluate(() => S.c.railColor === 'Black' && included(S.c).includes('Black railing')));

    /* depth */
    const before = await p.evaluate(() => amount());
    await p.click('#po-depth .po-opt:has-text("8 ft porch")'); await p.waitForTimeout(300);
    ok(`${tag}: an 8 ft deep end porch adds $170.00 as its own line`, await p.evaluate((before) => amount() === before + 170 && breakdown(S.c).some((r) => r.name === '8 ft deep end porch' && r.amount === 170) && S.c.porchDepth === 8, before));
    ok(`${tag}: the railing price does not change with the depth`, await p.evaluate(() => breakdown(S.c).find((r) => /^Porch railing/.test(r.name)).amount === 640));
    if (!phone) await shot(p, 'end-porch', '#po-color');
    if (phone) await shot(p, 'phone', '#po-rail');
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    ok(`${tag}: the order's list names the depth, the railing with its feet, and the color`, await p.evaluate(() => { const i = included(S.c); return i.includes('Porch 8 ft deep') && i.filter((x) => /^Porch railing: Door in the center · 16 ft/.test(x)).length === 1 && i.includes('8-ft composite porch, painted posts'); }), await p.evaluate(() => JSON.stringify(included(S.c))));
    await p.evaluate(() => change('size', '12x12')); await p.waitForTimeout(300);
    await p.evaluate(() => change('size', '10x10')); await p.waitForTimeout(400);
    ok(`${tag}: a building under 12 ft long goes back to a 4 ft porch, and 8 ft is greyed with the reason`, await p.evaluate(() => S.c.package === 'End Porch' && S.c.porchDepth === 4 && !breakdown(S.c).some((r) => r.name === '8 ft deep end porch') && /12 ft long or longer/.test(document.querySelector('#po-depth .po-opt:disabled')?.innerText || '')));
    await p.evaluate(() => change('size', '12x20')); await p.waitForTimeout(300);

    /* changing the porch resets the railing */
    await pick(p, 'Side Porch');
    ok(`${tag}: changing the porch starts its railing over`, await p.evaluate(() => S.c.railing === 'No railing' && !S.c.extras?.['Porch Railing (Per Linear Ft)'] && !S.c.railColor && !S.c.porchDepth));
    await pick(p, 'Standard Storage');
    ok(`${tag}: with no porch there are no porch questions and no railing line`, !(await p.locator('#po-box').count()) && await p.evaluate(() => !S.c.railing && !breakdown(S.c).some((r) => /railing|deep end porch/i.test(r.name))));

    /* rules */
    await pick(p, 'Deluxe Porch');
    ok(`${tag}: Deluxe Porch says its railing is in the package; the others do not`, await p.evaluate(() => /standard railing/.test(packageDetails['Deluxe Porch'].porch) && ['End Porch', 'Middle Porch', 'Side Porch', 'Full Side Porch'].every((k) => !/railing/.test(packageDetails[k].porch))));
    if (!phone) await shot(p, 'deluxe', '#po-rail');
    await p.evaluate(() => change('size', '10x20')); await p.waitForTimeout(500);
    const dl = await p.evaluate(() => ({ pkg: S.c.package, txt: [...document.querySelectorAll('.choice')].find((e) => /Deluxe Porch/.test(e.innerText))?.innerText, dis: [...document.querySelectorAll('.choice')].find((e) => /Deluxe Porch/.test(e.innerText))?.disabled }));
    ok(`${tag}: no Deluxe Porch on a 10 wide: the package is taken off and the choice is greyed with the reason`, dl.pkg === 'Standard Storage' && dl.dis && /10 ft wide or narrower/.test(dl.txt), JSON.stringify(dl));
    await p.evaluate(() => change('size', '12x20')); await p.waitForTimeout(300);
    await pick(p, 'Full Side Porch');
    ok(`${tag}: Full Side Porch can be picked; its package price is to be confirmed and is not in the total`, await p.evaluate(() => S.c.package === 'Full Side Porch' && !breakdown(S.c).some((r) => r.name === 'Full Side Porch') && /Ask the office for the price|Price to confirm/.test([...document.querySelectorAll('.choice')].find((e) => /Full Side Porch/.test(e.innerText)).innerText) && catalogReviewItems(S.c).some((x) => /package price/i.test(x))));
    ok(`${tag}: Full Side Porch draws on the plan with its porch`, await p.evaluate(() => { const l = bsLayout(S.c); return !!l.sh.deck && l.sh.walls.length === 4 && !!document.querySelector('.porchplan'); }));
    if (!phone) await shot(p, 'full-side', '#po-rail');
    await p.evaluate(() => { openBuildSheet('cfg', true); }); await p.waitForTimeout(900);
    const spec = await p.evaluate(() => document.querySelector('.bs-spec')?.innerText || '');
    ok(`${tag}: the build sheet names the railing, its feet and its color`, /Porch railing: Standard railing · 24 ft/.test(spec) && /White railing/.test(spec), spec.slice(0, 600));
    await p.evaluate(() => closeBuildSheet()); await p.waitForTimeout(400);

    /* lofted barn */
    await pick(p, 'Middle Porch');
    await p.evaluate(() => { goStep(0); change('style', 'Lofted'); goStep(steps.indexOf('Package')); }); await p.waitForTimeout(600);
    const lo = await p.evaluate(() => ({ pkg: S.c.package, ch: [...document.querySelectorAll('.choice')].map((e) => [e.querySelector('strong').textContent.trim(), e.disabled, e.innerText]) }));
    const by = Object.fromEntries(lo.ch.map((c) => [c[0], c]));
    ok(`${tag}: switching to a lofted barn takes a Middle Porch off`, lo.pkg === 'Standard Storage', lo.pkg);
    ok(`${tag}: a lofted barn is offered End, Side and Full Side porches only; Middle and Deluxe are greyed with the reason`, !by['End Porch'][1] && !by['Side Porch'][1] && !by['Full Side Porch'][1] && by['Middle Porch'][1] && by['Deluxe Porch'][1] && /Not on a lofted barn/.test(by['Middle Porch'][2]) && /Not on a lofted barn/.test(by['Deluxe Porch'][2]), JSON.stringify(lo.ch.map((c) => c.slice(0, 2))));
    await pick(p, 'End Porch');
    ok(`${tag}: a lofted end porch asks high ceiling (no loft) or low ceiling (with a loft)`, /High ceiling\s*No loft over the porch\s*Low ceiling\s*A loft over the porch/.test(await p.locator('#po-loft').innerText()) && await p.evaluate(() => S.c.porchLoft === 'High'));
    await p.click('#po-loft .po-opt:has-text("Low ceiling")'); await p.waitForTimeout(300);
    ok(`${tag}: the ceiling picked is written on the order`, await p.evaluate(() => S.c.porchLoft === 'Low' && included(S.c).includes('Porch ceiling: low ceiling (a loft over the porch)')));
    ok(`${tag}: the lofted end porch has the same five railing choices`, JSON.stringify((await rail(p)).map((g) => [g[0], num(g[1])])) === JSON.stringify(WANT['End Porch']));
    if (!phone) await shot(p, 'lofted', '#po-loft');
    await pick(p, 'Side Porch');
    ok(`${tag}: a utility end porch question does not follow to another porch`, await p.evaluate(() => !S.c.porchLoft) && !(await p.locator('#po-loft').count()));
    await p.close();
  }

  /* a kept sale from before, with typed feet and a porch a lofted barn can no longer have */
  { const p = await open(false);
    await p.evaluate(() => { localStorage.setItem('sales:draft', JSON.stringify({ c: { ...S.c, style: 'Lofted', size: '12x20', package: 'Deluxe Porch', catalogOptions: true, extras: { 'Porch Railing (Per Linear Ft)': 37 } }, step: 2, stepName: 'Package', completed: 2, path: S.path, customer: '', term: 60, budget: 0, at: Date.now() })); go('home'); }); await p.waitForTimeout(500);
    await p.click('#sale-draft button:has-text("Resume")'); await p.waitForTimeout(1500);
    ok('An older kept sale opens with no error, its package set back and the typed feet gone', await p.evaluate(() => S.page === 'configure' && S.c.package === 'Standard Storage' && !S.c.extras?.['Porch Railing (Per Linear Ft)'] && !breakdown(S.c).some((r) => /railing/i.test(r.name))), await p.evaluate(() => JSON.stringify([S.page, S.c.package, S.c.extras])));
    await p.close(); }

  /* a real order: the invoice and the order name the railing */
  { const p = await open(false);
    await pick(p, 'End Porch');
    await p.locator('#po-rail .po-opt:has(strong:text-is("Door on the left"))').click(); await p.waitForTimeout(300);
    await p.click('#po-depth .po-opt:has-text("8 ft porch")'); await p.waitForTimeout(300);
    const total = await p.evaluate(() => amount());
    await p.evaluate(() => goStep(steps.length - 1)); await p.waitForTimeout(500);
    await p.locator('#app button:has-text("Complete the sale"):visible').first().click(); await p.waitForTimeout(700);
    if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', '20'); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(500); }
    for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
    await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
    await p.selectOption('#saleBilling [name=type]', 'Cash purchase'); await p.waitForTimeout(300);
    await p.fill('#saleBilling [name=deposit]', '552');
    await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(500);
    await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(800);
    ok('The order is made with the railing and the deeper porch in its price', await p.evaluate((total) => { const s = sfSale(); return !!s && s.c.railing === 'Door on the left' && s.c.porchDepth === 8 && Math.abs(s.total - total) < 0.01; }, total), await p.evaluate(() => JSON.stringify([sfSale()?.total, sfSale()?.c.railing])));
    await p.evaluate(() => orderDoc('invoice')); await p.waitForTimeout(500);
    const inv = await p.evaluate(() => [...document.querySelectorAll('.modal .od-lines tbody tr')].map((tr) => [tr.children[0].childNodes[0].textContent.trim(), tr.children[2].textContent.trim()]));
    ok('The invoice lists “Porch railing: Door on the left · 14 ft” at $560.00', inv.some((x) => x[0] === 'Porch railing: Door on the left · 14 ft' && x[1] === '$560.00'), JSON.stringify(inv));
    ok('The invoice lists the 8 ft deep end porch at $170.00', inv.some((x) => x[0] === '8 ft deep end porch' && x[1] === '$170.00'), JSON.stringify(inv));
    ok('The invoice names the railing color', inv.some((x) => x[0] === 'White railing'), JSON.stringify(inv));
    if (PIC) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-invoice.png` }); }
    await p.close(); }

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
