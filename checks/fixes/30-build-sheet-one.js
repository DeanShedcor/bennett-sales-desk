// One build sheet with every measurement on the drawing, and a separate electrical sheet.
// node 30-build-sheet-one.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (typeof d === 'string' ? d : JSON.stringify(d) || ''))); };

// the buildings to draw: [name, setup, has electrical]
const place = () => { const lay = bsLayout(S.c); S.c.sheet ||= { pos: {}, ok: null }; for (const it of lay.items) if (it.kind === 'fix') S.c.sheet.pos[it.key] = { wall: it.fw, at: it.at, q: it.q, sz: it.sz }; };
const SHAPES = [
  ['small', () => { change('style', 'Utility', true); change('size', '8x12'); change('package', 'Standard Storage'); S.c.windows = 0; S.c.electrical = 'Basic'; S.c.elecPlace = 'default'; }, true],
  ['loaded', () => {
    change('style', 'Utility', true); change('size', '12x24'); change('package', 'End Porch'); porchSet('railing', 'Door on the right');
    S.c.windows = 2; S.c.windowItems = null; S.c.extraDoors = ['6x7 Rollup Door'];
    S.c.extras ||= {}; S.c.extras['Workbench (per LF)'] = 8; S.c.extras['Three Tier Shelving (per LF)'] = 6;
    S.c.loft = '4 ft Back'; S.c.electrical = 'Basic'; S.c.elecPlace = 'default'; S.c.wallHeight = 7;
  }, true],
  ['lofted', () => { change('style', 'Lofted', true); change('size', '12x28'); change('package', 'Deluxe Porch'); porchSet('railing', 'Standard railing'); S.c.windows = 0; S.c.electrical = 'Expanded'; S.c.extraLights = 1; S.c.elecPlace = 'edited'; }, true],
  ['bullet', () => { change('style', 'Silver Bullet', true); change('size', '10x16'); S.c.electrical = 'Basic'; }, true],
  ['nopower', () => { change('style', 'Utility', true); change('size', '10x16'); change('package', 'Standard Storage'); S.c.windows = 2; S.c.electrical = 'None'; }, false],
  ['side', () => { change('style', 'Utility', true); change('size', '14x40'); change('package', 'Side Porch'); porchSet('railing', 'Side railing only'); S.c.windows = 2; S.c.extraDoors = ['6x7 Rollup Door']; S.c.electrical = 'Utility'; S.c.extraLights = 3; }, true],
  ['middle', () => { change('style', 'Utility', true); change('size', '12x24'); change('package', 'Middle Porch'); S.c.windows = 0; S.c.electrical = 'Basic'; }, true],
  ['garage', () => { change('style', 'Utility', true); change('size', '12x20'); change('package', 'Garage Package'); S.c.windows = 2; S.c.electrical = 'Expanded'; }, true],
  ['fullside', () => { change('style', 'Utility', true); change('size', '12x24'); change('package', 'Full Side Porch'); porchSet('railing', 'Standard railing'); S.c.windows = 0; S.c.loft = '4 ft Front & Back'; S.c.electrical = 'Basic'; }, true],
  ['uloft', () => { change('style', 'Utility', true); change('size', '10x20'); change('package', 'Standard Storage'); S.c.windows = 2; S.c.loft = 'U-Shaped Loft'; S.c.extras ||= {}; S.c.extras['Partition Wall (per linear foot)'] = 6; S.c.electrical = 'None'; }, false],
];
// read in the page: what each printed page holds
const READ = () => [...document.querySelectorAll('.bs-page')].map((pg) => {
  const fit = pg.querySelector('.bs-fit'), svg = pg.querySelector('.b1-plan svg');
  const texts = [...svg.querySelectorAll('text')].map((t) => ({ t: t.textContent.trim(), r: t.getBoundingClientRect(), key: !!t.closest('.b1-key') }));
  /* labels on the drawing that sit on top of each other (a 1.5 px touch is let go) */
  const hits = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i].r, b = texts[j].r, m = 1.5;
    if (a.left < b.right - m && a.right > b.left + m && a.top < b.bottom - m && a.bottom > b.top + m) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 3 && h > 4) hits.push(`${texts[i].t} / ${texts[j].t}`);
    }
  }
  const box = svg.getBoundingClientRect();
  return {
    sheet: pg.dataset.sheet, text: pg.innerText.replace(/\s+/g, ' '), svgText: texts.map((x) => x.t), hits,
    out: texts.filter((x) => x.r.left < box.left - 1 || x.r.right > box.right + 1 || x.r.top < box.top - 1 || x.r.bottom > box.bottom + 1).map((x) => x.t),
    zoom: parseFloat(fit.style.zoom) || 1, tall: fit.getBoundingClientRect().height, room: (pg.getBoundingClientRect().width * 753) / 1056,
    starts: texts.filter((x) => x.t === 'START').length, ends: texts.filter((x) => /^\d.* END$/.test(x.t)).length, walls: bsLayout(BS.key === 'cfg' ? S.c : bsOrder(BS.key).c).sh.walls.length,
    closeUps: texts.filter((x) => / close-up$/.test(x.t)).map((x) => x.t), pieces: svg.querySelectorAll('.fp-piece').length, lofts: svg.querySelectorAll('.b1-loft').length,
  };
});
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1300 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1200);
    return p;
  };

  /* ---------- how a measurement is written ---------- */
  { const p = await open();
    const f = await p.evaluate(() => [11.5, 12, 0.5, 20, 6 + 11 / 12, 3 + 11.25 / 12, 0, 4 + 5.625 / 12].map(b1Feet));
    ok('Measurements are written the short way: 11\' 6", 12\', 6"', f.join('|') === ['11\' 6"', "12'", '6"', "20'", '6\' 11"', '3\' 11¼"', "0'", '4\' 5⅝"'].join('|'), f.join('|'));
    await p.context().close(); }

  /* ---------- every shape ---------- */
  const seen = {};
  for (const [name, setup, power] of SHAPES) {
    const p = await open();
    await p.evaluate(setup); await p.evaluate(place);
    await p.evaluate(() => openBuildSheet('cfg')); await p.waitForTimeout(700);
    const pages = await p.evaluate(READ), build = pages[0], elec = pages[1];
    seen[name] = pages;
    ok(`${name}: ${power ? 'a build sheet and an electrical sheet' : 'one build sheet and no electrical sheet'}`, pages.length === (power ? 2 : 1) && build.sheet === 'build' && (!power || elec.sheet === 'electrical'), pages.map((x) => x.sheet));
    ok(`${name}: the build sheet says its page count and ${power ? 'points to the electrical sheet' : 'says there is no electrical'}`, new RegExp(`Page ?1 of ${power ? 2 : 1}`, 'i').test(build.text) && (power ? /See the Electrical sheet/.test(build.text) : /No electrical on this building/.test(build.text)), build.text.slice(0, 200));
    const all = pages.flatMap((x) => x.svgText).join(' | ') + ' ' + pages.map((x) => x.text).join(' ');
    ok(`${name}: no measurement is written the long way or with a dash`, !/\d ft\b/.test(all.replace(/4-ft composite/g, '')) && !/\d'-\d/.test(all) && !/\d+\.\d+ ?(ft|')/.test(all), (all.match(/.{20}(\d ft\b|\d'-\d).{10}/) || [''])[0]);
    ok(`${name}: nothing says "see the list", and there is no wall-by-wall list on the build sheet`, !/see the list/i.test(all) && !/Wall by wall/i.test(build.text));
    ok(`${name}: every wall has its tape on the drawing (a START and an END), or shows its length`, build.starts === build.ends && build.starts >= 3 && build.starts + build.svgText.filter((t) => /^\d+'( \d+[^ ]*")?$/.test(t)).length >= build.walls - 0, { starts: build.starts, ends: build.ends, walls: build.walls });
    ok(`${name}: no two labels on the build drawing sit on top of each other`, !build.hits.length, build.hits.slice(0, 6));
    ok(`${name}: no label runs off the drawing`, !build.out.length && (!elec || !elec.out.length), [...build.out, ...(elec ? elec.out : [])].slice(0, 6));
    ok(`${name}: the build sheet has no plugs, switches, lights or prices on it`, !build.svgText.some((t) => /^(Plug|Switch|LIGHT)/.test(t)) && !/\$\d/.test(build.text), build.svgText.filter((t) => /^(Plug|Switch|LIGHT)/.test(t)));
    ok(`${name}: each sheet fits one page and shrinks no more than a little`, pages.every((x) => x.tall <= x.room + 1 && x.zoom >= 0.93), pages.map((x) => ({ zoom: x.zoom, tall: Math.round(x.tall), room: Math.round(x.room) })));
    ok(`${name}: a sign-off line is on every sheet`, pages.every((x) => /Built by.*Date.*Checked by.*Date/.test(x.text)));
    if (power) {
      ok(`${name}: the electrical sheet counts what to install and lists where each one goes`, /What to install/i.test(elec.text) && /light.? on the ceiling/.test(elec.text) && /Where each one goes/i.test(elec.text) && /to the middle of the box|Ceiling/.test(elec.text), elec.text.slice(0, 300));
      ok(`${name}: the electrical drawing shows the light and has no door or window names`, elec.svgText.some((t) => /^LIGHT/.test(t)) && !elec.svgText.some((t) => /^(Window|Door|Roll-up|Double door)/.test(t)), elec.svgText.slice(0, 12));
      ok(`${name}: no two labels on the electrical drawing sit on top of each other`, !elec.hits.length, elec.hits.slice(0, 6));
    }
    await p.emulateMedia({ media: 'print' });
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const count = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(`${name}: it prints on ${power ? 'two pages, one sheet each' : 'one page'}`, count === (power ? 2 : 1), count);
    await p.emulateMedia({ media: 'screen' });
    if (PIC && ['small', 'loaded', 'lofted', 'bullet', 'side', 'fullside', 'middle'].includes(name)) {
      const pg = p.locator('.bs-page');
      await pg.nth(0).screenshot({ path: `${PIC}-${name}-build.png` });
      if (power) await pg.nth(1).screenshot({ path: `${PIC}-${name}-electrical.png` });
    }
    await p.context().close();
  }

  /* ---------- what is on particular sheets ---------- */
  { const t = seen.loaded[0];
    ok('Loaded 12x24: windows and the roll-up door carry their size, wide x tall', t.svgText.filter((x) => x === "Window 2' x 3'").length >= 2 && t.svgText.includes("Roll-up door 6' x 7'") && /Sizes are wide x tall/i.test(t.text), t.svgText.filter((x) => /Window|door/i.test(x)));
    ok('Loaded 12x24: the workbench and shelving say their length, depth and where they start', t.svgText.includes("WORKBENCH 8' long, 2' deep") && t.svgText.includes('SHELVING 6\' long, 1\' 6" deep') && t.svgText.filter((x) => /^starts at the front end$/.test(x)).length === 2, t.svgText.filter((x) => /WORK|SHELV|starts/.test(x)));
    ok('Loaded 12x24: the named loft is drawn with its depth', t.lofts === 1 && t.svgText.includes('LOFT (overhead)') && t.svgText.includes("4' deep, across the back"), t.svgText.filter((x) => /LOFT|deep/.test(x)));
    ok('Loaded 12x24: the side column has the size, wall height, porch and railing', /12' wide, 24' long/.test(t.text) && /Side walls 7' tall/.test(t.text) && /Porch railing: Door on the right · 14'/.test(t.text) && /Workbench: 8' long, 2' deep/.test(t.text), t.text.slice(0, 500));
    ok('Loaded 12x24: the tape on the long wall reads from START to 20\' END', t.svgText.includes("20' END") && t.svgText.includes('2\' 6"') && t.svgText.includes('17\' 6"'), t.svgText.slice(0, 30));
    const e = seen.loaded[1];
    ok('Loaded 12x24: the electrical sheet says the customer wants the standard spots', /The customer wants the standard spots/.test(e.text) && /1 light on the ceiling/.test(e.text) && /1 plug \(outlet\)/.test(e.text) && /1 drop-cord hookup/.test(e.text), e.text.slice(0, 300)); }
  { const t = seen.lofted[0];
    ok('Lofted Deluxe Porch: the angled wall has a lettered close-up with its own tape', t.closeUps.includes('ANGLED WALL close-up') && t.svgText.filter((x) => x === 'A').length === 2, { closeUps: t.closeUps });
    ok('Lofted Deluxe Porch: the electrical sheet says the salesperson placed each one', /The salesperson put each one on the floor plan/.test(seen.lofted[1].text) && /2 lights on the ceiling/.test(seen.lofted[1].text)); }
  ok('Silver Bullet: it is named, and the roll-up door has its size', /Silver Bullet/.test(seen.bullet[0].text) && /Metal building/.test(seen.bullet[0].text) && seen.bullet[0].svgText.some((x) => /^6' x \d'$|Roll-up door/.test(x)), seen.bullet[0].svgText.slice(0, 20));
  ok('Full Side Porch: a loft at each end is drawn, inside the building', seen.fullside[0].lofts === 2 && seen.fullside[0].svgText.includes("4' deep, across the left end") && seen.fullside[0].svgText.includes("4' deep, across the right end"), seen.fullside[0].svgText.filter((x) => /LOFT|deep/.test(x)));
  ok('U-shaped loft: it is drawn, and the sheet says to check its size', seen.uloft[0].svgText.includes('U-SHAPED LOFT (overhead)') && /U-shaped loft: the order gives no sizes/.test(seen.uloft[0].text) && seen.uloft[0].svgText.includes("PARTITION WALL 6' long"), seen.uloft[0].svgText.filter((x) => /LOFT|PART/.test(x)));
  ok('Middle Porch: the short porch walls show their length', seen.middle[0].svgText.filter((x) => x === "4'").length >= 2, seen.middle[0].svgText.filter((x) => /^\d+'$/.test(x)));

  /* ---------- the floor plan editor still feeds the sheet ---------- */
  { const p = await open();
    await p.evaluate(() => { change('style', 'Utility', true); change('size', '10x16'); S.c.windows = 1; S.c.electrical = 'Basic'; openBuildSheet('cfg', true); }); await p.waitForTimeout(500);
    const before = await p.evaluate(() => [...document.querySelectorAll('.b1-plan')[0].querySelectorAll('text')].map((t) => t.textContent));
    await p.evaluate(() => { const it = bsLayout(S.c).items.find((x) => x.key === 'w0'); bsEdPlace('w0', it.wi, it.at + 2); bsRender(); }); await p.waitForTimeout(400);
    const after = await p.evaluate(() => [...document.querySelectorAll('.b1-plan')[0].querySelectorAll('text')].map((t) => t.textContent));
    ok('Moving a window in the floor plan editor changes the numbers on the build sheet', before.join() !== after.join() && after.includes("Window 2' x 3'"), { before: before.slice(0, 12), after: after.slice(0, 12) });
    await p.evaluate(() => bsConfirm()); await p.waitForTimeout(400);
    ok('Confirming the layout shows "Checked" on both sheets', await p.evaluate(() => [...document.querySelectorAll('.bs-page')].every((x) => /Layout\s*Checked/i.test(x.innerText) && !/NOT CHECKED YET/.test(x.innerText))));
    ok('The older two-page sheet is still there for anything that needs it', await p.evaluate(() => typeof bsPagesOld === 'function' && /Sheet 2 of 2/.test(bsPagesOld(bsOrder('cfg')))));
    await p.context().close(); }

  /* ---------- on a phone ---------- */
  { const p = await open(true);
    await p.evaluate(SHAPES[1][1]); await p.evaluate(place);
    await p.evaluate(() => openBuildSheet('cfg')); await p.waitForTimeout(800);
    const ph = await p.evaluate(() => ({ pages: document.querySelectorAll('.bs-page').length, wide: Math.max(...[...document.querySelectorAll('.bs-page')].map((x) => x.getBoundingClientRect().right)), view: innerWidth, side: document.documentElement.scrollWidth }));
    ok('Phone: both sheets show, scaled to the screen, with no sideways scroll', ph.pages === 2 && ph.wide <= ph.view + 1 && ph.side <= ph.view + 1, ph);
    if (PIC) await p.screenshot({ path: `${PIC}-phone.png` });
    await p.context().close(); }

  ok('No page errors', !errs.length, errs.slice(0, 3));
  console.log(`\n${pass} passed, ${fail} failed, errors ${errs.length} ${JSON.stringify(errs.slice(0, 3))}`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
