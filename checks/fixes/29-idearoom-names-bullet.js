// Shingle colors, the full Silver Bullet, the Deluxe Porch from 12 x 16, and names changed to
// IdeaRoom's words. node 29-idearoom-names-bullet.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
// Silver Bullet starting totals read from IdeaRoom on Nov 19, 2026 (fuel in, to the dollar)
const BULLET = { '6x8': 3091, '8x8': 3327, '8x10': 3773, '8x12': 4198, '8x16': 5163, '10x10': 4091, '10x12': 4191, '10x16': 5000, '10x20': 5862, '10x24': 6576, '12x12': 4893, '12x14': 5468, '12x16': 5499, '12x20': 6377, '12x24': 7118, '12x28': 8197, '12x32': 10177, '12x36': 10930, '12x40': 11588, '14x20': 11562, '14x24': 12856, '14x28': 13993, '14x32': 14982, '14x36': 15804, '14x40': 16479 };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.evaluate(() => begin()); await p.waitForTimeout(1500);
    await p.evaluate(() => { change('size', '12x16'); change('electrical', 'None'); S.completed = steps.length - 1; }); await p.waitForTimeout(300);
    return p;
  };
  const shot = async (p, name, sel) => { if (!PIC) return; await p.waitForTimeout(4300); if (sel) await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-${name}.png`, timeout: 60000 }).catch(() => console.log('picture skipped: ' + name)); };
  const set = (p, o) => p.evaluate((o) => { for (const [k, v] of Object.entries(o)) change(k, v, true); }, o);
  const rows = (p) => p.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount, r.source || '']));
  const find = (r, re) => r.find((x) => re.test(x[0]));
  const total = (p) => p.evaluate(() => amount());
  const step = async (p, name) => { await p.evaluate((n) => goStep(steps.indexOf(n)), name); await p.waitForTimeout(400); };

  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);

    /* ---------- shingle color ---------- */
    await set(p, { roof: 'Shingles' });
    await step(p, 'Colors');
    const names = await p.locator('#im-shingles .finish-swatch').allInnerTexts();
    ok(`${tag}: a shingle roof asks its color, with IdeaRoom's seven names`, names.map((x) => x.trim()).join('|') === 'Charcoal|Shakewood|Weathered Wood|Barkwood|Hickory|Slate|Pewter Gray', names.join('|'));
    ok(`${tag}: it starts on Charcoal and costs nothing more`, await p.evaluate(() => S.c.shingleColor === 'Charcoal' && !breakdown(S.c).some((x) => /shingle color/i.test(x.name))) && /costs nothing more/.test(await p.locator('#roof-shingle-note').innerText()));
    const before = await total(p);
    await p.locator('#im-shingles .finish-swatch:has-text("Hickory")').click(); await p.waitForTimeout(500);
    ok(`${tag}: the color picked is kept, shown as picked, and the price does not move`, await p.evaluate(() => S.c.shingleColor === 'Hickory' && document.querySelector('#im-shingles [data-finish-name="Hickory"]').getAttribute('aria-pressed') === 'true') && (await total(p)) === before);
    ok(`${tag}: the order and the build sheet name the shingle color`, await p.evaluate(() => included(S.c).includes('Hickory shingles') && bsLayout(S.c).notes.includes('Shingle color: Hickory.')));
    ok(`${tag}: the 3D model's roof takes the shingle color`, await p.evaluate(() => typeof shingleColors === 'object' && /^#[0-9a-f]{6}$/.test(shingleColors.Hickory)));
    if (!phone) await shot(p, 'shingle-colors', '#im-shingles');
    await set(p, { roof: 'Metal' });
    ok(`${tag}: back on a metal roof no shingle color is kept`, await p.evaluate(() => !S.c.shingleColor && !included(S.c).some((x) => /shingles$/.test(x))));

    /* ---------- Deluxe Porch from 12 x 16 ---------- */
    await step(p, 'Package');
    const dl = await p.evaluate(() => { const e = [...document.querySelectorAll('.choice')].find((x) => x.innerText.includes('Deluxe Porch')); return { dis: e.disabled, t: e.innerText }; });
    ok(`${tag}: a 12 × 16 can pick the Deluxe Porch`, !dl.dis, dl.t);
    await set(p, { package: 'Deluxe Porch' });
    ok(`${tag}: …and it stays picked at $2,330.00`, await p.evaluate(() => S.c.package === 'Deluxe Porch' && breakdown(S.c).some((x) => /^Deluxe Porch - /.test(x.name) && x.amount === 2330)));
    await set(p, { size: '12x14' });
    ok(`${tag}: a 12 × 14 still cannot have it`, await p.evaluate(() => S.c.package !== 'Deluxe Porch'));
    await set(p, { size: '12x16' }); await set(p, { package: 'Standard Storage' });

    /* ---------- Silver Bullet ---------- */
    await set(p, { style: 'Silver Bullet' });
    ok(`${tag}: a Silver Bullet comes in 25 sizes, 6 to 14 ft wide`, await p.evaluate(() => availableSizes('Silver Bullet').length === 25 && Object.keys(sizeLengths['Silver Bullet']).join() === '6,8,10,12,14'));
    await step(p, 'Size');
    ok(`${tag}: the Size step asks 6 ft or 7 ft walls, with the 7 ft price`, /6 ft Side Wall\s*Included\s*7 ft Side Wall\s*\+\$96\.00/.test(await p.locator('#im-wall').innerText()), await p.locator('#im-wall').innerText());
    ok(`${tag}: a 12 × 16 starts on the 7 ft wall, at $0.50 a sq ft`, await p.evaluate(() => S.c.wallHeight === 7 && breakdown(S.c).some((x) => x.name === '7 ft Side Wall · tall wall siding' && x.amount === 96)));
    await p.locator('#im-wall button:has-text("6 ft")').click(); await p.waitForTimeout(300);
    ok(`${tag}: picking 6 ft takes the $96.00 off and is kept when the size changes`, await p.evaluate(() => { const a = !breakdown(S.c).some((x) => /7 ft Side Wall/.test(x.name)); change('size', '12x20'); return a && S.c.wallHeight === 6; }));
    if (!phone) await shot(p, 'bullet-wall', '#im-wall');
    await p.evaluate(() => { change('style', 'Utility', true); change('style', 'Silver Bullet', true); });
    if (!phone) {
      let bad = [];
      for (const [size, want] of Object.entries(BULLET)) {
        const got = await p.evaluate((size) => { change('style', 'Utility', true); change('style', 'Silver Bullet', true); change('size', size); change('electrical', 'None'); return [S.c.size, Math.round(amount())]; }, size);
        if (got[0] !== size || got[1] !== want) bad.push(`${size}: ${got} not ${want}`);
      }
      ok('All 25 Silver Bullet starting totals are IdeaRoom’s, to the dollar', !bad.length, bad.join('; '));
    }
    await p.evaluate(() => { change('style', 'Utility', true); change('style', 'Silver Bullet', true); change('size', '10x12'); change('electrical', 'None'); });
    const sb = await total(p);
    await step(p, 'Colors');
    ok(`${tag}: Colors says color is one charge: $210.00 standard, $300.00 premium on a 10 × 12`, /\$1\.75 a sq ft \(\$210\.00\)/.test(await p.locator('#im-color-note').innerText()) && /\$2\.50 a sq ft \(\$300\.00\)/.test(await p.locator('#im-color-note').innerText()));
    await p.evaluate(() => document.querySelector('[data-finish-key="roofColor"][data-finish-name="Black"]').click()); await p.waitForTimeout(500);
    let r = await rows(p);
    ok(`${tag}: a standard roof color adds $210.00`, (await total(p)) === sb + 210 && !!find(r, /^Colored metal · standard color \(Black roof\)$/), JSON.stringify(r));
    await p.evaluate(() => document.querySelector('[data-finish-key="color"][data-finish-name="Tan"]').click()); await p.waitForTimeout(500);
    r = await rows(p);
    ok(`${tag}: adding a premium siding color makes it $300.00 in all, not $510.00`, (await total(p)) === sb + 300 && find(r, /^Colored metal · premium color/)?.[1] === 300 && r.filter((x) => /Colored metal|metal siding ·/.test(x[0])).length === 1, JSON.stringify(r));
    ok(`${tag}: the note on screen follows the pick`, /Colored metal: \+\$300\.00/.test(await p.locator('#im-color-note').innerText()));
    await p.evaluate(() => document.querySelector('[data-finish-key="color"][data-finish-name="Galvalume"]').click()); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('[data-finish-key="roofColor"][data-finish-name="Galvalume"]').click()); await p.waitForTimeout(400);
    ok(`${tag}: plain Galvalume on both costs nothing more`, (await total(p)) === sb);
    ok(`${tag}: pine finish trim shows +$213.00 on a 10 × 12`, /Pine finish trim\s*\+\$213\.00/.test(await p.locator('#im-trim').innerText()));
    await p.locator('#im-trim button:has-text("Pine finish trim")').click(); await p.waitForTimeout(400);
    ok(`${tag}: picking it adds $213.00, and the plant is told`, (await total(p)) === sb + 213 && await p.evaluate(() => included(S.c).includes('Pine finish metal trim') && bsLayout(S.c).notes.includes('Metal trim: pine finish.')));
    if (!phone) await shot(p, 'bullet-colors', '#im-trim');
    if (phone) await shot(p, 'phone-bullet', '#im-trim');
    await set(p, { size: '14x20' });
    ok(`${tag}: on a 14 × 20 pine finish trim is $490.00, and the total is IdeaRoom's $12,052`, find(await rows(p), /^Pine finish metal trim$/)?.[1] === 490 && Math.round(await total(p)) === 12052);
    ok(`${tag}: a Silver Bullet has no Copper Penny charge or note`, !(await p.locator('#ix-copper').count()));
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await set(p, { style: 'Utility' });
    ok(`${tag}: leaving Silver Bullet clears its wall, trim and roof color`, await p.evaluate(() => !S.c.bulletTrim && !S.c.bulletWallSet && !breakdown(S.c).some((x) => /Pine|Colored metal|tall wall/.test(x.name))));

    /* ---------- names ---------- */
    await set(p, { size: '12x16' });
    await step(p, 'Style');
    const st = await p.locator('.stylecard strong').allInnerTexts();
    ok(`${tag}: the style card says “Craftsman Studio”`, st.includes('Craftsman Studio') && !st.includes('Studio'), st.join('|'));
    ok(`${tag}: a studio is named “12x16 Basic Craftsman Studio”`, await p.evaluate(() => label({ ...S.c, style: 'Studio' }) === '12x16 Basic Craftsman Studio' && S.c.style === 'Utility'));
    await step(p, 'Size');
    ok(`${tag}: the wall choice reads “Sidewall Height”, “6 ft Side Wall”, “7 ft Side Wall”`, /Sidewall Height/.test(await p.locator('.fields:has(select[onchange*="wallHeight"])').innerText()) && /6 ft Side Wall/.test(await p.locator('select[onchange*="wallHeight"]').innerText()) && /7 ft Side Wall · no charge/.test(await p.locator('select[onchange*="wallHeight"]').innerText()));
    await step(p, 'Electrical');
    const el = await p.locator('#app button.choice strong:first-of-type').allInnerTexts();
    ok(`${tag}: the electrical choices are named “… Package”`, ['Lights Only Package', 'Basic Electrical Package', 'Expanded Electrical Package', 'Utility Electrical Package'].every((n) => el.includes(n)), el.join('|'));
    await set(p, { electrical: 'Basic' });
    ok(`${tag}: the price line and the order say “Basic Electrical Package”`, await p.evaluate(() => breakdown(S.c).some((x) => x.name === 'Basic Electrical Package' && x.amount === 205) && included(S.c).includes('Basic Electrical Package') && S.c.electrical === 'Basic'));
    await set(p, { electrical: 'None', package: 'Side Porch' });
    await p.evaluate(() => { S.c.porchSide = 'Right'; render(); });
    ok(`${tag}: a side porch is named with its side: “Side Porch - Right”`, await p.evaluate(() => breakdown(S.c).some((x) => x.name === 'Side Porch - Right' && x.amount === 1510) && included(S.c)[0] === 'Side Porch - Right' && S.c.package === 'Side Porch'));
    await set(p, { package: 'Standard Storage' });
    await step(p, 'Exterior');
    const ex = await p.locator('#app').innerText();
    ok(`${tag}: the siding choices show IdeaRoom's full names in small print`, ex.includes('LP 3/8" 8" OC Groove') && ex.includes('LP Smartside 8" Lap with 7/16" Tech Shield'));
    ok(`${tag}: roll-up doors are named “Rollup Door”`, await p.evaluate(() => ['6x7', '8x7', '9x7'].every((s) => doorName(s + ' Rollup Door') === s + ' Rollup Door') && !doorOptions.some((d) => /Roll-up Door/.test(d[1] || ''))));
    await p.evaluate(() => { S.c.buildOnSite = true; render(); });
    r = await rows(p);
    ok(`${tag}: the build on site line is named “Build on Site Surcharge” and names permits`, r.at(-1)[0] === 'Build on Site Surcharge · customer is responsible for permits' && Math.abs(r.at(-1)[1] - 0.4 * r.slice(0, -1).reduce((t, x) => t + x[1], 0)) < 0.006, JSON.stringify(r.at(-1)));
    await p.evaluate(() => { S.c.buildOnSite = false; render(); });
    if (!phone) { await step(p, 'Electrical'); await shot(p, 'names-electrical'); }
    await p.close();
  }
  ok('No page errors', !errs.length, errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
