// Option prices, extra charges and named lofts the owner set to match the IdeaRoom designer.
// node 28-idearoom-options.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
// Loft prices read from IdeaRoom on Nov 19, 2026: [style, size, package, loft, price]
const LOFT_READ = [
  ['Utility', '8x12', '', '4 ft Front', 192], ['Utility', '8x12', '', '8 ft Back', 384], ['Utility', '8x12', '', 'U-Shaped Loft', 384], ['Utility', '8x12', '', '8 ft Front & Back', null],
  ['Utility', '10x16', '', '4 ft Front & Back', 384], ['Utility', '10x16', '', '8 ft Front & Back', 768], ['Utility', '10x16', '', 'U-Shaped Loft', 480],
  ['Utility', '12x16', '', '4 ft Back', 192], ['Utility', '12x16', '', 'U-Shaped Loft', 480],
  ['Utility', '12x24', '', '8 ft Front', 384], ['Utility', '12x24', '', 'U-Shaped Loft', 672], ['Utility', '14x28', '', 'U-Shaped Loft', 768], ['Utility', '14x28', '', '4 ft Front', 192],
  ['Silver Bullet', '10x12', '', '4 ft Front', 192], ['Silver Bullet', '10x12', '', 'U-Shaped Loft', 384], ['Silver Bullet', '12x16', '', '8 ft Front & Back', 768], ['Silver Bullet', '12x16', '', 'U-Shaped Loft', 480],
  ['Lofted', '8x12', '', '4 ft Front', 0], ['Lofted', '8x12', '', '4 ft Front & Back', 192], ['Lofted', '8x12', '', '8 ft Back', 192], ['Lofted', '8x12', '', 'U-Shaped Loft', null],
  ['Lofted', '10x16', '', '4 ft Front & Back', 0], ['Lofted', '10x16', '', '8 ft Front', 0], ['Lofted', '10x16', '', '8 ft Front & Back', 384], ['Lofted', '10x16', '', 'U-Shaped Loft', 192],
  ['Lofted', '12x24', '', 'U-Shaped Loft', 384], ['Lofted', '14x28', '', 'U-Shaped Loft', 480], ['Lofted', '14x28', '', '8 ft Front & Back', 384],
  ['Utility', '12x16', 'End Porch', '8 ft Front & Back', 768], ['Utility', '12x24', 'End Porch', 'U-Shaped Loft', 672],
  ['Utility', '12x16', 'Garage Package', '4 ft Back', 192], ['Utility', '12x24', 'Garage Package', '8 ft Back', 384], ['Utility', '12x24', 'Garage Package', '4 ft Front', null], ['Utility', '12x24', 'Garage Package', 'U-Shaped Loft', null],
  ['Lofted', '12x16', 'End Porch', '8 ft Back', 0], ['Lofted', '12x24', 'End Porch', 'U-Shaped Loft', 384], ['Lofted', '12x24', 'End Porch', '4 ft Front', null],
  ['Lofted', '12x16', 'Garage Package', 'U-Shaped Loft', 192], ['Lofted', '12x24', 'Garage Package', '4 ft Back', 0],
  ['Low-Wall Barn', '10x12', '', '4 ft Back', 192], ['Low-Wall Barn', '12x16', '', '4 ft Back', 192], ['Low-Wall Barn', '8x12', '', '4 ft Back', 192], ['Low-Wall Barn', '12x16', '', '4 ft Front', null],
];
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
  const shot = async (p, name, sel) => { if (!PIC) return; await p.waitForTimeout(4300); if (sel) await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300); await p.screenshot({ path: `${PIC}-${name}.png`, timeout: 60000 }).catch((e) => console.log('picture skipped: ' + name)); };
  const set = (p, o) => p.evaluate((o) => { for (const [k, v] of Object.entries(o)) change(k, v); }, o);
  const rows = (p) => p.evaluate(() => breakdown(S.c).map((r) => [r.name, r.amount, r.source || '']));
  const find = (r, re) => r.find((x) => re.test(x[0]));
  const total = (p) => p.evaluate(() => amount());
  const step = async (p, name) => { await p.evaluate((n) => goStep(steps.indexOf(n)), name); await p.waitForTimeout(400); };
  const sums = (p) => p.evaluate(() => Math.abs(breakdown(S.c).reduce((t, x) => t + x.amount, 0) - amount()) < 0.011);

  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);
    const base = await total(p);

    /* ---------- prices that changed ---------- */
    await step(p, 'Exterior');
    ok(`${tag}: the shingle choice shows +$375.00`, /\+\$375\.00/.test(await p.locator('#roof-pick button:has-text("Architectural shingles")').innerText()));
    await p.locator('#roof-pick button:has-text("Architectural shingles")').click(); await p.waitForTimeout(300);
    ok(`${tag}: shingles add $375.00`, (await total(p)) === base + 375 && find(await rows(p), /^Architectural shingles$/)?.[1] === 375);
    await set(p, { roof: 'Metal' });
    await step(p, 'Finish');
    ok(`${tag}: “Wrapped shingles” is no longer a second way to add shingles`, !/Wrapped shingles/.test(await p.locator('#app').innerText()));
    await step(p, 'Size');
    ok(`${tag}: 12-inch floor joists show +$268.80 on a 12 × 16 ($1.40 a sq ft)`, /\+\$268\.80/.test(await p.locator('label:has(#floor-joists)').innerText()), await p.locator('label:has(#floor-joists)').innerText());
    await p.check('#floor-joists'); await p.waitForTimeout(300);
    ok(`${tag}: …and add $268.80`, Math.abs((await total(p)) - base - 268.8) < 0.006 && /\$1\.40 per sq ft/.test(find(await rows(p), /floor joists/)?.[2] || ''));
    await p.uncheck('#floor-joists'); await p.waitForTimeout(300);
    ok(`${tag}: a Utility's 7 ft wall says “no charge”`, /7 ft Side Wall · no charge/.test(await p.locator('select[onchange*="wallHeight"]').innerText()));
    await set(p, { wallHeight: 7 });
    ok(`${tag}: 7 ft walls on a Utility add nothing and no line`, (await total(p)) === base && !find(await rows(p), /7 ft Side Wall|Permitting/));
    await set(p, { style: 'Lofted' }); await set(p, { wallHeight: 6 });
    const lbase = await total(p);
    ok(`${tag}: a lofted barn's 7 ft wall shows +$1,124.80 on a 12 × 16`, /7 ft Side Wall · \+\$1,124\.80/.test(await p.locator('select[onchange*="wallHeight"]').innerText()) && /\$1,000\.00 permitting fee/.test(await p.locator('#ix-wall-note').innerText()));
    await set(p, { wallHeight: 7 });
    let r = await rows(p);
    ok(`${tag}: it adds $124.80 for the wall and a $1,000.00 “Permitting fee” line`, (await total(p)) === lbase + 1124.8 && find(r, /^7 ft Side Wall$/)?.[1] === 124.8 && find(r, /^Permitting fee/)?.[1] === 1000, JSON.stringify(r));
    if (!phone) await shot(p, 'lofted-wall', '#ix-wall-note');
    await set(p, { package: 'End Porch' });
    r = await rows(p);
    ok(`${tag}: a lofted porch with 7 ft walls gets the wall and the fee only, no extra door and window charge`, find(r, /^Permitting fee/)?.[1] === 1000 && r.reduce((t, x) => t + x[1], 0) === lbase + 1124.8 + 1510, JSON.stringify(r));
    await set(p, { package: 'Garage Package' });
    await set(p, { wallHeight: 6 });
    ok(`${tag}: a lofted Garage Package can stay on 6 ft walls, so the fee is not forced`, await p.evaluate(() => S.c.wallHeight === 6 && !breakdown(S.c).some((x) => /Permitting/.test(x.name))));
    await set(p, { package: 'Standard Storage' }); await set(p, { style: 'Utility' }); await set(p, { wallHeight: 6 });

    /* vinyl */
    await set(p, { siding: 'Lap' });
    await step(p, 'Exterior');
    const vb = await total(p);
    ok(`${tag}: the box is named “Vinyl siding”, shows +$450.00 and says the door changes`, /Vinyl siding/.test(await p.locator('label.aw-vinyl').innerText()) && /\+\$450\.00/.test(await p.locator('label.aw-vinyl').innerText()) && /double door changes to a double fiberglass door \(\+\$300\.00\)/.test(await p.locator('label.aw-vinyl').innerText()), await p.locator('label.aw-vinyl').innerText());
    await p.check('#aw-vinyl'); await p.waitForTimeout(400);
    r = await rows(p);
    ok(`${tag}: vinyl siding adds $750.00 in all: $450.00 and a $300.00 double fiberglass door`, (await total(p)) === vb + 750 && find(r, /^Vinyl siding$/)?.[1] === 450 && find(r, /^Double fiberglass door · comes with vinyl siding$/)?.[1] === 300 && await p.evaluate(() => S.c.door === 'Double Solid Fiberglass Door'), JSON.stringify(r));
    if (!phone) await shot(p, 'vinyl', 'label.aw-vinyl');
    await p.evaluate(() => selectDoor('Single', false)); await p.waitForTimeout(300);
    ok(`${tag}: the main door cannot be changed while vinyl siding is on, and a message says why`, await p.evaluate(() => S.c.door === 'Double Solid Fiberglass Door' && /Take vinyl siding off to change the main door/.test(document.getElementById('toast')?.textContent || '')));
    await p.uncheck('#aw-vinyl'); await p.waitForTimeout(400);
    ok(`${tag}: taking vinyl off puts the double shed door back and the price back`, (await total(p)) === vb && await p.evaluate(() => S.c.door === 'Double' && !S.c.vinylDoorWas));
    await p.check('#aw-vinyl'); await p.waitForTimeout(300); await set(p, { siding: 'Basic groove' });
    ok(`${tag}: changing away from lap siding takes vinyl and its door off`, await p.evaluate(() => S.c.door === 'Double' && !S.c.extras?.['Vinyl Wrap'] && !breakdown(S.c).some((x) => /Vinyl|fiberglass/i.test(x.name))));

    /* ---------- new charges ---------- */
    await step(p, 'Style');
    ok(`${tag}: Rush order is a tick box on the Style step, +$250.00`, /Rush order/.test(await p.locator('#ix-rush-box').innerText()) && /\+\$250\.00/.test(await p.locator('#ix-rush-box').innerText()));
    await p.check('#ix-rush'); await p.waitForTimeout(300);
    ok(`${tag}: ticking it adds $250.00`, (await total(p)) === base + 250 && find(await rows(p), /^Rush order$/)?.[1] === 250);
    await step(p, 'Openings');
    ok(`${tag}: Ridge vent is on Openings at $20.00 a foot: +$320.00 on a 16 ft long building`, /\+\$320\.00/.test(await p.locator('#ix-ridge-box').innerText()));
    await p.check('#ix-ridgeVent'); await p.waitForTimeout(300);
    ok(`${tag}: ticking it adds $320.00`, (await total(p)) === base + 570 && find(await rows(p), /^Ridge vent · 16 ft$/)?.[1] === 320);
    await set(p, { size: '12x12' });
    ok(`${tag}: on a 12 ft long building the ridge vent is $240.00`, find(await rows(p), /^Ridge vent · 12 ft$/)?.[1] === 240);
    await set(p, { size: '12x16' });
    await step(p, 'Colors');
    ok(`${tag}: Paint sample is on Colors, +$25.00`, /\+\$25\.00/.test(await p.locator('#ix-paint-box').innerText()));
    await p.check('#ix-paintSample'); await p.waitForTimeout(300);
    ok(`${tag}: ticking it adds $25.00`, (await total(p)) === base + 595 && find(await rows(p), /^Paint sample$/)?.[1] === 25);
    ok(`${tag}: Colors says a Copper Penny roof adds $225.00`, /Copper Penny metal roof adds \$225\.00/.test(await p.locator('#ix-copper').innerText()));
    await p.locator('[data-finish-key="roofColor"][data-finish-name="Copper Penny"]').first().click(); await p.waitForTimeout(400);
    ok(`${tag}: picking Copper Penny adds $225.00 and says so`, (await total(p)) === base + 820 && find(await rows(p), /^Copper Penny metal roof$/)?.[1] === 225 && /Copper Penny roof: \+\$225\.00/.test(await p.locator('#ix-copper').innerText()));
    if (!phone) await shot(p, 'colors', '#ix-paint-box');
    await set(p, { roofColor: 'Charcoal' });
    ok(`${tag}: another roof color takes the $225.00 off`, (await total(p)) === base + 595);
    ok(`${tag}: the lines add up to the total`, await sums(p));
    await set(p, { style: 'Greenhouse' });
    ok(`${tag}: a greenhouse has no rush order, ridge vent or paint sample`, await p.evaluate(() => !S.c.rush && !S.c.ridgeVent && !S.c.paintSample && !breakdown(S.c).some((x) => /Rush|Ridge|Paint sample/.test(x.name))));
    await set(p, { style: 'Studio' }); await step(p, 'Openings');
    ok(`${tag}: a studio is not offered a ridge vent`, !(await p.locator('#ix-ridgeVent').count()));
    await set(p, { style: 'Utility' }); await set(p, { size: '12x16' });

    /* ---------- doors ---------- */
    await step(p, 'Openings');
    ok(`${tag}: a double shed door alone asks no handle or swing question`, !(await p.locator('#ix-doors').count()));
    await p.evaluate(() => { S.c.extraDoors = ['Single', 'Fiberglass Door', 'Fiberglass Door']; render(); }); await p.waitForTimeout(400);
    const dt = await p.locator('#ix-doors').innerText();
    ok(`${tag}: a single shed door asks which side the handle is on, and nothing about swing`, await p.evaluate(() => { const d = [...document.querySelectorAll('.ix-door')].find((e) => /^Shed Door|Single/.test(e.querySelector('strong').textContent)); return !!d && /Which side is the handle on/.test(d.innerText) && !/Which way does it open/.test(d.innerText); }), dt);
    ok(`${tag}: a fiberglass door asks the handle side and which way it opens`, await p.evaluate(() => { const d = [...document.querySelectorAll('.ix-door')].find((e) => /Fiberglass Door × 2/.test(e.querySelector('strong').textContent)); return !!d && /Which side is the handle on/.test(d.innerText) && /Swings in\s*No charge/.test(d.innerText) && /Swings out\s*\+\$100\.00 a door/.test(d.innerText); }), dt);
    const db = await total(p);
    await p.locator('.ix-door:has-text("Fiberglass Door") button:has-text("Swings out")').click(); await p.waitForTimeout(300);
    r = await rows(p);
    ok(`${tag}: two out-swing fiberglass doors add $200.00`, (await total(p)) === db + 200 && find(r, /^Out-swing door · Fiberglass Door × 2$/)?.[1] === 200, JSON.stringify(r));
    ok(`${tag}: an out-swing door warns of 2 more weeks`, /adds 2 weeks to the wait/.test(await p.locator('#ix-doors').innerText()));
    await p.locator('.ix-door:has-text("Fiberglass Door") button:has-text("Left")').click(); await p.waitForTimeout(300);
    ok(`${tag}: the handle side and swing are on the order and the build sheet`, await p.evaluate(() => included(S.c).includes('Fiberglass Door: handle on the left, swings out') && bsLayout(S.c).notes.includes('Fiberglass Door: handle on the left, swings out.') && !bsLayout(S.c).notes.some((n) => /not on the order/.test(n) && /handle/.test(n))));
    ok(`${tag}: the handle buttons are big enough to press`, await p.evaluate(() => [...document.querySelectorAll('.ix-ask .seg')].every((e) => e.getBoundingClientRect().height >= 44)));
    await shot(p, phone ? 'phone-doors' : 'doors', '#ix-doors');
    await p.evaluate(() => { S.c.extraDoors = ['Single']; change('color', S.c.color); }); await p.waitForTimeout(300);
    ok(`${tag}: taking the fiberglass doors off takes the out-swing charge off`, (await total(p)) === db - 650 && await p.evaluate(() => !S.c.doorOpts?.['Fiberglass Door']));
    await p.evaluate(() => { S.c.extraDoors = []; S.c.rush = S.c.ridgeVent = S.c.paintSample = false; render(); });

    /* ---------- lofts ---------- */
    await step(p, 'Finish');
    const lt = await p.locator('#ix-loft').innerText();
    ok(`${tag}: the Finish step has a Loft list with seven named lofts and “No loft”`, (await p.locator('#ix-loft .po-opt').count()) === 8 && /No loft/.test(lt) && /4 ft Front\s/.test(lt) && /U-Shaped Loft/.test(lt), lt);
    ok(`${tag}: nobody types loft square feet any more`, !(await p.locator('#ix-loft input').count()) && !/Additional loft|U-shaped loft\s*\$6/.test(await p.locator('.ta-addons').innerText()));
    const fb = await total(p);
    await p.locator('#ix-loft .po-opt:has(strong:text-is("8 ft Back"))').click(); await p.waitForTimeout(300);
    ok(`${tag}: an 8 ft back loft adds $384.00 as a named line`, (await total(p)) === fb + 384 && find(await rows(p), /^Loft: 8 ft Back$/)?.[1] === 384);
    ok(`${tag}: the loft is on the order and the build sheet`, await p.evaluate(() => included(S.c).includes('Loft: 8 ft Back') && bsLayout(S.c).notes.includes('Loft: 8 ft Back.')));
    if (!phone) await shot(p, 'loft', '#ix-loft');
    if (phone) await shot(p, 'phone-loft', '#ix-loft');
    await p.locator('#ix-loft .po-opt:has(strong:text-is("No loft"))').click(); await p.waitForTimeout(300);
    ok(`${tag}: “No loft” takes it off`, (await total(p)) === fb && await p.evaluate(() => !S.c.loft));
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

    if (!phone) {
      let bad = [];
      for (const [style, size, pk, loft, want] of LOFT_READ) {
        const got = await p.evaluate(([style, size, pk, loft]) => { change('package', 'Standard Storage'); change('style', style); change('size', size); if (pk) change('package', pk); if (S.c.package !== (pk || 'Standard Storage')) return 'package ' + S.c.package; ixLoft(loft); const row = breakdown(S.c).find((x) => /^Loft: /.test(x.name)); const offered = !!S.c.loft && included(S.c).some((x) => x.startsWith('Loft: ' + loft)); return offered ? (row ? row.amount : 0) : null; }, [style, size, pk, loft]);
        if (got !== want) bad.push(`${style} ${size} ${pk} ${loft}: ${got} not ${want}`);
        await p.evaluate(() => ixLoft(null));
      }
      ok(`All ${LOFT_READ.length} loft prices read from IdeaRoom come out the same here (null = not offered)`, !bad.length, bad.join('; '));
      await p.evaluate(() => { change('package', 'Standard Storage'); change('style', 'Lofted'); change('size', '12x16'); goStep(steps.indexOf('Finish')); }); await p.waitForTimeout(400);
      const bt = await p.locator('#ix-loft').innerText();
      ok('A lofted barn shows the lofts that come with it as “Included”', /4 ft Front\s*A 4 ft loft over the front · comes with the barn\s*Included/.test(bt) && /8 ft Front & Back[\s\S]*\+\$384\.00/.test(bt), bt);
      await shot(p, 'loft-barn', '#ix-loft');
      await p.evaluate(() => ixLoft('8 ft Back'));
      ok('An included loft adds no line but is written for the plant', await p.evaluate(() => !breakdown(S.c).some((x) => /^Loft/.test(x.name)) && included(S.c).includes('Loft: 8 ft Back (comes with the barn)') && bsLayout(S.c).notes.includes('Loft: 8 ft Back.')));
      await p.evaluate(() => { ixLoft('U-Shaped Loft'); change('size', '12x12'); });
      await p.waitForTimeout(300);
      ok('A loft that no longer fits after a size change is taken off, with a message', await p.evaluate(() => !S.c.loft && /does not fit this building/.test(document.getElementById('toast')?.textContent || '')));
      for (const st of ['Studio', 'Greenhouse']) { await p.evaluate((st) => { change('style', st); goStep(steps.indexOf('Finish')); }, st); await p.waitForTimeout(300); ok(`A ${st.toLowerCase()} has no loft list`, !(await p.locator('#ix-loft').count())); }
      await p.evaluate(() => { change('style', 'Utility'); change('size', '12x16'); change('package', 'Dormer Package'); goStep(steps.indexOf('Finish')); }); await p.waitForTimeout(300);
      ok('A Dormer Package building has no loft list', !(await p.locator('#ix-loft').count()));

      /* an older sale with typed square feet */
      await p.evaluate(() => { change('package', 'Standard Storage'); S.c.extras = { 'Additional Loft (PER SQ FT)': 40 }; goStep(steps.indexOf('Finish')); }); await p.waitForTimeout(400);
      ok('An older sale with typed loft square feet still shows it and still prices it ($160.00)', await p.evaluate(() => breakdown(S.c).some((x) => /Additional loft · 40 sq ft/.test(x.name) && x.amount === 160)) && (await p.locator('#ix-old-loft').count()) === 1 && (await p.locator('.ta-addon:has-text("Additional loft") input').inputValue()) === '40');
      await p.evaluate(() => { S.c.extras = {}; render(); });

      /* build on site takes 40% of the new charges too; the invoice and order carry them */
      await p.evaluate(() => { change('roof', 'Shingles'); ixTick('rush', true); S.c.buildOnSite = true; render(); });
      r = await rows(p);
      ok('Build on site is still last and is 40% of everything else, new charges included', /^Build on Site Surcharge/.test(r.at(-1)[0]) && Math.abs(r.at(-1)[1] - 0.4 * r.slice(0, -1).reduce((t, x) => t + x[1], 0)) < 0.006 && !!find(r, /^Rush order$/) && !!find(r, /^Architectural shingles$/), JSON.stringify(r));
      await p.evaluate(() => { S.c.buildOnSite = false; change('roof', 'Metal'); });
      const old = await p.evaluate(() => { const s = ofSale('STB-3102'); return { total: s.total, list: ofListPrice(s) }; });
      ok('A sample order sold before the change still matches its own prices', old.total === old.list, JSON.stringify(old));
      await p.locator('.deal-details').click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(600);
      ok('The price details list the rush order', /Rush order/.test(await p.evaluate(() => summary())) && /\$250\.00/.test(await p.evaluate(() => summary())));
      await shot(p, 'price-details');
    }
    await p.close();
  }
  ok('No page errors', !errs.length, errs.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
