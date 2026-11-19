// Prices the owner set to match the IdeaRoom designer: every starting price, build on site,
// the Full Side Porch, and porches on lofted barns. node 27-idearoom-prices.js <url> [pic]
// 27-idearoom-read.json holds the 434 starting prices read from IdeaRoom on Nov 19, 2026.
const { chromium } = require('playwright');
const READ = require('./27-idearoom-read.json');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    return p;
  };
  const design = async (p) => { await p.evaluate(() => begin()); await p.waitForTimeout(1500); };
  const shot = async (p, name, sel) => { if (!PIC) return; await p.waitForTimeout(600); if (sel) await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-${name}.png` }); };
  const set = (p, o) => p.evaluate((o) => { for (const [k, v] of Object.entries(o)) change(k, v); }, o);
  const rows = (p) => p.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount, r.source || '']));
  const row = async (p, re) => (await rows(p)).find((r) => new RegExp(re).test(r[0]));

  const p = await open(false);

  /* ---------- 1. starting prices ---------- */
  const lists = await p.evaluate(() => ({ now: JSON.parse(JSON.stringify(PRICE_LIST)), ta: PRICE_LIST_TA }));
  let n = 0, bad = [];
  for (const [m, sizes] of Object.entries(READ)) for (const [s, v] of Object.entries(sizes)) { n++; if (lists.now[m]?.[s] !== v) bad.push(`${m} ${s}: ${lists.now[m]?.[s]} not ${v}`); }
  ok(`All ${n} starting prices read from IdeaRoom are the app's starting prices`, n === 434 && !bad.length, bad.slice(0, 5).join('; '));
  n = 0; bad = [];
  for (const [m, sizes] of Object.entries(lists.now)) for (const [s, v] of Object.entries(sizes)) { n++; const want = Math.floor(lists.ta[m][s] * 1.05 + 0.5 + 1e-9); if (v !== want || !Number.isInteger(v)) bad.push(`${m} ${s}: ${v} not ${want}`); }
  ok(`Every one of the ${n} starting prices is the Turbo Assist list plus 5%, to the dollar`, n > 400 && !bad.length, bad.slice(0, 5).join('; '));
  ok('The list as Jordan keeps it is still there to compare (12 × 16 Basic Utility $5,870)', lists.ta['Basic Utility']['12x16'] === 5870 && lists.now['Basic Utility']['12x16'] === 6164);

  await design(p);
  await set(p, { size: '12x16', electrical: 'None' });
  let r = await rows(p);
  ok('A 12 × 16 Basic Utility starts at $6,164.00', r[0][0] === '12x16 Basic Utility base price' && r[0][1] === 6164, JSON.stringify(r[0]));
  ok('The price line says it matches IdeaRoom', /Matches IdeaRoom/.test(r[0][2]) && /plus 5%/.test(r[0][2]), r[0][2]);
  ok('With fuel the total is $6,221.60, IdeaRoom’s $6,222', await p.evaluate(() => amount() === 6221.6));
  await p.locator('.deal-details').click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500);
  ok('The price details show $6,164.00', /\$6,164\.00/.test(await p.evaluate(() => summary())));
  await shot(p, 'base-price');
  await p.locator('.deal-details').click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300);
  const WANT = [['Utility', 'Basic groove', '10x16', 5416], ['Utility', 'Basic groove', '8x12', 3995], ['Utility', 'Silvertech groove', '12x16', 6777], ['Utility', 'Lap', '12x24', 9860], ['Lofted', 'Basic groove', '12x16', 6489], ['Lofted', 'Silvertech groove', '12x24', 9461], ['Lofted', 'Lap', '14x28', 16907], ['Low-Wall Barn', 'Basic groove', '10x12', 4085], ['Greenhouse', 'Basic groove', '10x16', 9293]];
  bad = [];
  for (const [style, siding, size, want] of WANT) {
    await set(p, { style }); await set(p, { size }); await set(p, { siding });
    const got = (await rows(p))[0];
    if (got[1] !== want) bad.push(`${style} ${siding} ${size}: ${JSON.stringify(got)} not ${want}`);
  }
  ok('Nine styles and sizes picked in the designer show IdeaRoom’s starting price', !bad.length, bad.join('; '));
  await set(p, { style: 'Utility' }); await set(p, { size: '14x28' }); await set(p, { siding: 'Silvertech groove' });
  ok('Classic Utility 14 × 28 uses the higher of the two list prices: $14,219.00', (await rows(p))[0][1] === 14219, JSON.stringify((await rows(p))[0]));
  ok('A size IdeaRoom does not sell is still the list plus 5% (6 × 8 Basic Utility $3,258)', lists.now['Basic Utility']['6x8'] === 3258);

  /* ---------- 2. build on site ---------- */
  await p.evaluate(() => { localStorage.removeItem('sales:draft'); go('start'); }); await p.waitForTimeout(300);
  await design(p);
  await set(p, { size: '12x16' }); await set(p, { electrical: 'None' });
  const before = await p.evaluate(() => amount());
  await p.evaluate(() => { S.c.buildOnSite = true; render(); }); await p.waitForTimeout(300);
  r = await rows(p);
  ok('Build on site on a 12 × 16 Basic Utility is $2,488.64, IdeaRoom’s $2,488', /^Build on Site Surcharge/.test(r.at(-1)[0]) && r.at(-1)[1] === 2488.64, JSON.stringify(r.at(-1)));
  ok('It is 40% of everything else, fuel included', Math.abs(r.at(-1)[1] - 0.4 * before) < 0.006 && await p.evaluate((b) => Math.abs(amount() - b * 1.4) < 0.011, before));
  ok('The line says the customer is responsible for permits', /customer is responsible for permits/i.test(r.at(-1)[2]) && /40%/.test(r.at(-1)[2]));
  await set(p, { package: 'End Porch' });
  r = await rows(p);
  const rest = r.slice(0, -1).reduce((t, x) => t + x[1], 0);
  ok('A package and its options are inside the 40% (porch: $3,092.64)', /^Build on Site Surcharge/.test(r.at(-1)[0]) && r.at(-1)[1] === 3092.64 && Math.abs(rest * 0.4 - r.at(-1)[1]) < 0.006, JSON.stringify(r));
  await set(p, { electrical: 'Basic' });
  r = await rows(p);
  ok('Adding electrical moves the build on site line with it', r.at(-1)[1] === Math.round((r.slice(0, -1).reduce((t, x) => t + x[1], 0)) * 40) / 100 && r.at(-1)[1] === 3174.64, JSON.stringify(r.at(-1)));
  ok('The lines still add up to the total', await p.evaluate(() => Math.abs(breakdown(S.c).reduce((t, x) => t + x.amount, 0) - amount()) < 0.011));
  await p.locator('.deal-details').click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500);
  ok('The price details show the build on site line', /Build on Site Surcharge/.test(await p.evaluate(() => summary())) && /\$3,174\.64/.test(await p.evaluate(() => summary())));
  await shot(p, 'build-on-site');
  await p.locator('.deal-details').click({ timeout: 3000 }).catch(() => {});
  await p.evaluate(() => { S.c.buildOnSite = false; change('package', 'Standard Storage'); go('start'); }); await p.waitForTimeout(400);
  const startText = await p.evaluate(() => document.body.innerText);
  ok('The start page says build on site adds 40% and names permits', /Build on site adds 40% to the price\. The customer is responsible for permits\./.test(startText), startText.slice(0, 300));
  ok('Nothing says 30 cents a square foot for build on site any more', !/\$0\.30 per sq ft of floor/.test(startText));
  await p.evaluate(() => begin('site')); await p.waitForTimeout(1200);
  const site = await p.evaluate(() => ({ path: S.path, on: S.c && S.c.buildOnSite, page: S.page }));
  if (site.on) {
    await set(p, { size: '16x32', electrical: 'None' });
    r = await rows(p);
    ok('A 16 × 32 started as build on site comes to IdeaRoom’s $20,680', r[0][1] === 14618 && Math.round(await p.evaluate(() => amount())) === 20680, JSON.stringify(r));
  } else ok('The build on site road sets the building as build on site', false, JSON.stringify(site));

  /* ---------- 3. Full Side Porch ---------- */
  await p.evaluate(() => { localStorage.removeItem('sales:draft'); go('start'); }); await p.waitForTimeout(300);
  await design(p);
  bad = [];
  for (const [size, want] of [['12x12', 2160], ['12x16', 2600], ['12x24', 3480], ['12x28', 3920], ['10x20', 3040]]) {
    await set(p, { size }); await set(p, { package: 'Full Side Porch' });
    const got = await row(p, '^Full Side Porch$');
    if (!got || got[1] !== want) bad.push(`${size}: ${JSON.stringify(got)} not ${want}`);
  }
  ok('Full Side Porch is $840 plus $110 a foot of length (12, 16, 24, 28 ft read from IdeaRoom)', !bad.length, bad.join('; '));
  await set(p, { size: '12x16' });
  await p.evaluate(() => goStep(steps.indexOf('Package'))); await p.waitForTimeout(500);
  const tile = await p.evaluate(() => [...document.querySelectorAll('.choice')].find((e) => /Full Side Porch/.test(e.innerText))?.innerText || '');
  ok('Its tile shows +$2,600.00 on a 16 ft long building, not “Price to confirm”', /\+\$2,600\.00/.test(tile) && !/confirm|Ask the office/i.test(tile), tile);
  ok('The price is in the total (porch, its 24 ft railing, base, fuel, electrical)', await p.evaluate(() => amount() === 6164 + 57.6 + 2600 + 960 + 205), String(await p.evaluate(() => amount())));
  await shot(p, 'full-side-porch', '#po-box');

  /* ---------- 4. porches on a lofted barn ---------- */
  await set(p, { package: 'Standard Storage' }); await set(p, { style: 'Lofted' }); await set(p, { size: '12x24' });
  await p.evaluate(() => goStep(steps.indexOf('Package'))); await p.waitForTimeout(400);
  for (const pk of ['Middle Porch', 'Deluxe Porch']) {
    const t = await p.evaluate((pk) => { const e = [...document.querySelectorAll('.choice')].find((x) => x.innerText.includes(pk)); return e ? { dis: e.disabled, text: e.innerText } : null; }, pk);
    ok(`A 12 × 24 lofted barn can pick a ${pk}`, t && !t.dis && !/Not on a lofted barn/.test(t.text), JSON.stringify(t));
    await p.evaluate((pk) => [...document.querySelectorAll('.choice')].find((x) => x.innerText.includes(pk)).click(), pk); await p.waitForTimeout(500);
    ok(`…and it stays picked, with its price (${pk})`, await p.evaluate((pk) => S.c.package === pk && S.c.style === 'Lofted' && breakdown(S.c).some((x) => x.name.startsWith(pk) && x.amount === (pk === 'Middle Porch' ? 1680 : 2330)), pk));
  }
  ok('A lofted Deluxe Porch asks high or low porch ceiling, like the end porch', (await p.locator('#po-loft .po-opt').count()) === 2 && await p.evaluate(() => S.c.porchLoft === 'High'));
  await p.click('#po-loft .po-opt:has-text("Low ceiling")'); await p.waitForTimeout(300);
  ok('The ceiling picked is kept and listed for the plant', await p.evaluate(() => S.c.porchLoft === 'Low' && included(S.c).some((x) => /Porch ceiling: low ceiling/.test(x))));
  ok('Lofted 12 × 24 with a Deluxe Porch: $8,558 + $2,330 + fuel + electrical', await p.evaluate(() => amount() === 8558 + 2330 + 86.4 + 205), String(await p.evaluate(() => amount())));
  await shot(p, 'lofted-deluxe', '#po-box');
  await p.evaluate(() => goStep(0)); await p.waitForTimeout(4500);
  await shot(p, 'lofted-deluxe-model');
  await p.evaluate(() => goStep(steps.indexOf('Package'))); await p.waitForTimeout(300);
  await set(p, { package: 'Middle Porch' });
  ok('A lofted Middle Porch asks no ceiling question', !(await p.locator('#po-loft').count()) && await p.evaluate(() => !S.c.porchLoft));
  await set(p, { package: 'Deluxe Porch' }); await set(p, { size: '10x16' });
  ok('The size rules still hold on a lofted barn: no Deluxe Porch on a 10 wide', await p.evaluate(() => S.c.package !== 'Deluxe Porch'));
  await set(p, { style: 'Utility' }); await set(p, { size: '12x24' }); await set(p, { package: 'Deluxe Porch' });
  ok('A utility Deluxe Porch asks no ceiling question', !(await p.locator('#po-loft').count()) && await p.evaluate(() => S.c.package === 'Deluxe Porch' && !S.c.porchLoft));

  /* ---------- what must not move ---------- */
  ok('The sample order AA-20411 keeps its total ($14,869.00)', await p.evaluate(() => (typeof SAMPLE_ORDER !== 'undefined' ? SAMPLE_ORDER.total : (S.orders || []).find((o) => o.id === 'AA-20411')?.total ?? ofSale('AA-20411')?.total) === 14869));
  const old = await p.evaluate(() => { const s = ofSale('STB-3102'); return { total: s.total, list: ofListPrice(s), base: breakdown(s.c)[0].amount, now: PRICE_LIST['Basic Lofted']['10x16'] }; });
  ok('A sample order sold before the change still matches the prices it was sold at', old.list === old.total && old.base === 5510 && old.now === 5786, JSON.stringify(old));
  const unit = await p.evaluate(() => { const l = lots[0]; return { name: l.name, price: l.price }; });
  await p.evaluate(() => openUnit(0)); await p.waitForTimeout(600);
  ok('A building on a lot keeps its listed price', new RegExp('\\$' + Math.floor(unit.price).toLocaleString('en-US')).test(await p.evaluate(() => document.body.innerText)), JSON.stringify(unit));
  await p.evaluate(() => { go('start'); }); await design(p);
  await set(p, { size: '12x16' });
  const rto = await p.evaluate(() => { const t = amount(), r = taRtoCalc(36, t), old = taRtoCalc(36, 5870 + 57.6 + 205); return { t, pay: r && (r.monthly ?? r.payment ?? r.month), old: old && (old.monthly ?? old.payment ?? old.month), keys: r && Object.keys(r) }; });
  ok('Rent-to-own is worked out from the new total', rto.t === 6426.6 && rto.pay > rto.old, JSON.stringify(rto));
  await p.evaluate(() => { location.hash = '#office/pricing'; }); await p.waitForTimeout(1200);
  const office = await p.evaluate(() => document.body.innerText);
  ok('Office pricing shows the new starting prices', /6,?164/.test(office) || await p.evaluate(() => adNow('Basic Utility', '12x16') === 6164), office.slice(0, 200));

  /* ---------- phone ---------- */
  const q = await open(true);
  await design(q);
  await set(q, { size: '12x16' }); await set(q, { package: 'Full Side Porch' });
  await q.evaluate(() => goStep(steps.indexOf('Package'))); await q.waitForTimeout(500);
  ok('Phone: Full Side Porch shows its price', /\+\$2,600\.00/.test(await q.evaluate(() => [...document.querySelectorAll('.choice')].find((e) => /Full Side Porch/.test(e.innerText))?.innerText || '')));
  ok('Phone: the total has the new starting price', await q.evaluate(() => amount() === 6164 + 57.6 + 2600 + 960 + 205));
  ok('Phone: no sideways scroll', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await shot(q, 'phone', '#po-box');

  ok('No page errors', !errs.length, errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
