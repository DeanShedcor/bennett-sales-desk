// The porch railing that was picked is drawn on the 3D model, the floor plan and the porch tile,
// and left off when none was picked. node 26-porch-rails-drawn.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
// [package, size, railing, runs drawn, feet drawn, where the main door should be: 'low' | 'high' | 'mid' | '']
const CASES = [
  ['End Porch', '12x16', 'No railing', 0, 0, ''],
  ['End Porch', '12x16', 'Side railing only', 2, 8, ''],
  ['End Porch', '12x16', 'Door on the right', 3, 14, 'high'],
  ['End Porch', '12x16', 'Door on the left', 3, 14, 'low'],
  ['End Porch', '12x16', 'Door in the center', 4, 16, 'mid'],
  ['Middle Porch', '12x24', 'No railing', 0, 0, ''],
  ['Middle Porch', '12x24', 'Door on the right', 1, 4, 'high'],
  ['Middle Porch', '12x24', 'Door on the left', 1, 4, 'low'],
  ['Side Porch', '12x24', 'No railing', 0, 0, ''],
  ['Side Porch', '12x24', 'Side railing only', 2, 8, ''],
  ['Deluxe Porch', '12x28', 'Standard railing', 2, 8, ''],
  ['Deluxe Porch', '12x28', 'Extended railing', 3, 12, ''],
  ['Deluxe Porch', '12x28', 'No railing', 0, 0, ''],
  ['Full Side Porch', '12x24', 'Standard railing', 4, 24, ''],
  ['Full Side Porch', '12x24', 'No railing', 0, 0, ''],
];
// read in the page: what the plan, the model and the screen say about the railing
const READ = () => {
  const lay = bsLayout(S.c), sh = lay.sh, hex = S.c.railColor === 'Black' ? [29, 29, 31] : [243, 242, 238];
  const m = p3Mesh(S.c);
  let painted = 0;
  for (let i = 0; i < m.rgb.length; i += 3) if (Math.round(m.rgb[i] * 255) === hex[0] && Math.round(m.rgb[i + 1] * 255) === hex[1] && Math.round(m.rgb[i + 2] * 255) === hex[2]) painted++;
  const door = lay.items.find((x) => x.key === 'd0'), w = door && sh.walls[door.wi];
  const mid = door ? (door.at + door.w / 2) / w.len : null;
  return {
    runs: sh.rails.length, feet: sh.railFeet || 0, tris: m.pos.length / 9, painted, blocked: !!lay.railBlocked,
    door: mid == null ? '' : mid < 0.42 ? 'low' : mid > 0.58 ? 'high' : 'mid',
    notDrawnNote: lay.notes.some((n) => /^Porch railing: .*not drawn on this sheet/.test(n)),
    tile: document.querySelector('.porchplan .pp-rails')?.dataset.rail || '',
    posts: sh.posts.length, plan: (bsPlan(lay).match(/class="bs-rails"/g) || []).length, key: /porch railing<\/text>/.test(bsPlan(lay)),
  };
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.setDefaultTimeout(120000); /* the software 3D drawing can be slow on a busy machine */
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    return p;
  };
  const set = (p, pkg, size, rail, more = {}) => p.evaluate(([pkg, size, rail, more]) => {
    change('style', more.style || 'Utility'); change('size', size); change('package', pkg);
    if (more.porchSide) change('porchSide', more.porchSide);
    if (more.porchDepth) porchSet('porchDepth', more.porchDepth);
    porchSet('railing', rail);
    if (more.color && S.c.railing !== 'No railing') porchSet('railColor', more.color);
    goStep(steps.indexOf('Package'));
  }, [pkg, size, rail, more]);
  const view = async (p, name, yaw = -1.0, zoom = 1.15) => {
    if (!PIC) return;
    await p.evaluate(([yaw, zoom]) => { P3.angles.stage = { yaw, pitch: 0.32 }; P3.zoom.stage = zoom; p3Paint(true); window.scrollTo(0, 0); }, [yaw, zoom]);
    await p.waitForTimeout(4300);
    await p.locator('canvas.p3d').first().screenshot({ path: `${PIC}-${name}.png` });
  };
  /* press a button by its words, without waiting for the page to hold still */
  const tap = (pg, sel, words) => pg.evaluate(([sel, words]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(words)); if (!e) throw new Error('no button: ' + sel + ' ' + words); e.click(); }, [sel, words]);
  const NAMES = { 'End Porch|No railing': 'end-none', 'End Porch|Side railing only': 'end-side-only', 'End Porch|Door on the right': 'end-door-right', 'End Porch|Door on the left': 'end-door-left', 'End Porch|Door in the center': 'end-door-center', 'Middle Porch|Door on the left': 'middle', 'Side Porch|Side railing only': 'side', 'Deluxe Porch|Standard railing': 'deluxe-standard', 'Deluxe Porch|Extended railing': 'deluxe-extended', 'Full Side Porch|Standard railing': 'full-side' };

  // ---------- computer: every porch, every railing ----------
  const p = await open(false);
  const bare = {};
  for (const [pkg, size, rail, runs, feet, door] of CASES) {
    await set(p, pkg, size, rail, { porchSide: 'Right' }); await p.waitForTimeout(350);
    const r = await p.evaluate(READ), tag = `${pkg}, ${rail}`;
    if (rail === 'No railing') bare[pkg] = r.tris;
    if (!runs) {
      ok(`${tag}: no railing on the plan, the model or the tile`, r.runs === 0 && r.painted === 0 && r.plan === 0 && !r.tile && !r.key, JSON.stringify(r));
    } else {
      ok(`${tag}: ${runs} run${runs > 1 ? 's' : ''} of railing, ${feet} ft, on the floor plan`, r.runs === runs && r.feet === feet && r.plan === 1 && r.key, JSON.stringify(r));
      ok(`${tag}: the 3D model has the railing, in the railing color`, r.painted > 100, JSON.stringify(r));
      ok(`${tag}: the porch tile shows it, and the build sheet no longer says “not drawn”`, r.tile === rail && !r.notDrawnNote, JSON.stringify(r));
      ok(`${tag}: no door is behind the railing`, !r.blocked, JSON.stringify(r));
    }
    if (door) ok(`${tag}: the door is placed to match`, r.door === door, r.door);
    if (rail === 'Door in the center') ok(`${tag}: a post each side of the way in (4 posts)`, r.posts === 4, String(r.posts));
    if (NAMES[`${pkg}|${rail}`]) await view(p, NAMES[`${pkg}|${rail}`], /End|Deluxe/.test(pkg) ? -1.0 : -0.42, /End/.test(pkg) ? 1.25 : 1.15);
  }
  // a railing adds to the model, and taking it off takes it away again
  for (const [pkg, size, rail] of [['End Porch', '12x16', 'Door in the center'], ['Deluxe Porch', '12x28', 'Standard railing'], ['Full Side Porch', '12x24', 'Standard railing']]) {
    await set(p, pkg, size, rail, { porchSide: 'Right' }); await p.waitForTimeout(250);
    const withRail = (await p.evaluate(READ)).tris;
    await p.evaluate(() => porchSet('railing', 'No railing')); await p.waitForTimeout(250);
    const without = (await p.evaluate(READ)).tris;
    ok(`${pkg}: the model is bigger with the railing and back to bare without it`, withRail > without + 200 && (pkg === 'End Porch' ? true : without === bare[pkg]), `${withRail} vs ${without} vs ${bare[pkg]}`);
  }

  // color
  await set(p, 'End Porch', '12x16', 'Door in the center', { color: 'Black' }); await p.waitForTimeout(300);
  let r = await p.evaluate(READ);
  ok('Black railing: the model’s railing is black', r.painted > 100 && await p.evaluate(() => bsShape(S.c).railHex === '#1d1d1f'), JSON.stringify(r));
  await view(p, 'black', -1.0, 1.25);
  await tap(p, '#po-color button', 'White'); await p.waitForTimeout(400);
  ok('Pressing White railing turns it white on the model', await p.evaluate(() => bsShape(S.c).railHex === '#f3f2ee') && (await p.evaluate(READ)).painted > 100);
  // pressing a choice on the screen redraws the model
  const k1 = await p.evaluate(() => Object.values(P3.views).map((v) => JSON.stringify(v.c.railing)).join());
  await tap(p, '#po-rail .po-opt', 'No railing'); await p.waitForTimeout(500);
  const k2 = await p.evaluate(() => Object.values(P3.views).map((v) => JSON.stringify(v.c.railing)).join());
  ok('Pressing “No railing” on the screen updates the model on the page', k1 !== k2 && /No railing/.test(k2) && (await p.evaluate(READ)).painted === 0, `${k1} -> ${k2}`);

  // an 8 ft deep porch: the side rails follow the deeper porch
  await set(p, 'End Porch', '12x20', 'Side railing only', { porchDepth: 8 }); await p.waitForTimeout(300);
  ok('8 ft deep end porch: the side rails are 8 ft long each', await p.evaluate(() => { const sh = bsShape(S.c); return sh.minX === 8 && sh.rails.length === 2 && sh.rails.every(([a, b]) => Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 8) < 0.01); }));
  ok('…and the build sheet says the feet drawn differ from the feet sold', await p.evaluate(() => bsLayout(S.c).notes.some((n) => /Porch railing: 8 ft sold, 16 ft drawn/.test(n))));
  await view(p, 'end-8ft', -1.0, 1.2);

  // left and right porches mirror
  await set(p, 'Side Porch', '12x24', 'Side railing only', { porchSide: 'Left' }); await p.waitForTimeout(250);
  ok('Side porch on the left: the railing is at the left end', await p.evaluate(() => bsShape(S.c).rails.every(([a, b]) => Math.max(a[0], b[0]) <= 8.01)));
  await set(p, 'Side Porch', '12x24', 'Side railing only', { porchSide: 'Right' }); await p.waitForTimeout(250);
  ok('Side porch on the right: the railing is at the right end', await p.evaluate(() => bsShape(S.c).rails.every(([a, b]) => Math.min(a[0], b[0]) >= 15.99)));
  await set(p, 'Deluxe Porch', '12x28', 'Extended railing', { porchSide: 'Left', color: 'Black' }); await p.waitForTimeout(250);
  ok('Deluxe porch on the left: the railing flips with the porch', await p.evaluate(() => { const sh = bsShape(S.c); return sh.rails.length === 3 && sh.rails.some(([a, b]) => a[1] === 12 && b[1] === 12 && a[0] === 0) && sh.rails.some(([a, b]) => a[1] === 0 && b[1] === 0 && a[0] === 8); }));
  await view(p, 'deluxe-left-black', -1.0, 1.15);

  // other sizes still draw, and say so when the feet differ
  for (const [pkg, size, rail] of [['End Porch', '8x12', 'Door in the center'], ['End Porch', '10x16', 'Door on the right'], ['End Porch', '14x28', 'Door on the left'], ['Deluxe Porch', '14x32', 'Extended railing'], ['Full Side Porch', '10x12', 'Standard railing'], ['Full Side Porch', '14x40', 'Standard railing'], ['Middle Porch', '10x16', 'Door on the right']]) {
    await set(p, pkg, size, rail, { porchSide: 'Left' }); await p.waitForTimeout(250);
    r = await p.evaluate(READ);
    ok(`${size} ${pkg}, ${rail}: draws with no door behind the railing`, r.runs > 0 && r.painted > 100 && !r.blocked, JSON.stringify(r));
  }
  // lofted barn
  await set(p, 'End Porch', '12x20', 'Door on the left', { style: 'Lofted', color: 'Black' }); await p.waitForTimeout(300);
  r = await p.evaluate(READ);
  ok('Lofted barn end porch: the railing is drawn', await p.evaluate(() => S.c.style === 'Lofted') && r.runs === 3 && r.painted > 100, JSON.stringify(r));
  await view(p, 'lofted', -1.0, 1.2);

  // a door dragged behind the railing is called out
  await set(p, 'End Porch', '12x16', 'Door on the right'); await p.waitForTimeout(250);
  await p.evaluate(() => { const lay = bsLayout(S.c), d = lay.items.find((x) => x.key === 'd0'); S.c.sheet = { pos: { d0: { wall: d.wi, at: 1 } }, ok: null }; });
  ok('A door moved behind the railing is called out on the build sheet', await p.evaluate(() => bsLayout(S.c).notes.some((n) => /A door is behind the porch railing/.test(n))));
  await p.evaluate(() => { delete S.c.sheet; });

  // the floor plan editor and the printed plan
  await set(p, 'End Porch', '12x16', 'Door in the center', { color: 'White' }); await p.waitForTimeout(300);
  await p.evaluate(() => openBuildSheet('cfg', true)); await p.waitForTimeout(1200);
  ok('The floor plan editor draws the railing', await p.evaluate(() => { const g = document.querySelector('.bs-rails'); return !!g && g.dataset.rail === 'Door in the center' && g.dataset.feet === '16' && g.getBoundingClientRect().width > 20; }));
  ok('The build sheet’s porch notes still name the railing', /Porch railing: Door in the center/.test(await p.evaluate(() => document.body.innerText)));
  if (PIC) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-floorplan.png` }); }
  await p.evaluate(() => closeBuildSheet()); await p.waitForTimeout(400);
  await p.evaluate(() => porchSet('railing', 'No railing')); await p.waitForTimeout(300);
  await p.evaluate(() => openBuildSheet('cfg', true)); await p.waitForTimeout(900);
  ok('With no railing the floor plan editor draws none', !(await p.locator('.bs-rails').count()));
  await p.evaluate(() => closeBuildSheet()); await p.waitForTimeout(400);

  // buildings with no railing choice are drawn as before
  ok('Lot buildings: none gets a railing drawn', await p.evaluate(() => lots.every((u) => { try { return !u.c || bsShape(u.c).rails.length === 0; } catch (e) { return false; } })));
  ok('The sample order draws with no railing and no error', await p.evaluate(() => S.sales.every((s) => { try { if (!s.c || !s.c.size) return true; const sh = bsShape(s.c); p3Mesh(s.c); return s.c.railing ? true : sh.rails.length === 0; } catch (e) { return false; } })));
  ok('A building with no package has no railing', await p.evaluate(() => { change('package', 'Standard Storage'); return bsShape(S.c).rails.length === 0 && !S.c.railing; }));
  // a kept sale picks its railing back up
  await set(p, 'End Porch', '12x16', 'Door on the left', { color: 'Black' }); await p.waitForTimeout(400);
  await p.evaluate(() => go('home')); await p.waitForTimeout(400);
  await p.goto(L); await p.waitForTimeout(2200);
  await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300);
  await tap(p, '#sale-draft button', 'Resume'); await p.waitForTimeout(1500);
  r = await p.evaluate(READ);
  ok('A kept sale comes back with its railing drawn', r.runs === 3 && r.painted > 100 && await p.evaluate(() => S.c.railColor === 'Black'), JSON.stringify(r));
  await p.evaluate(() => localStorage.removeItem('sales:draft'));
  // the order made from it keeps the railing on its build sheet plan
  await p.close();

  // ---------- a new building starts with Basic electrical ----------
  {
    const e = await open(false);
    const start = await e.evaluate(() => ({ el: S.c.electrical, rows: breakdown(S.c).map((r) => [r.name, r.amount]), place: S.c.elecPlace || '', windows: S.c.windows, bar: document.querySelector('.deal-name small').textContent }));
    ok('A new building starts with the Basic electrical package picked', start.el === 'Basic', JSON.stringify(start));
    ok('…its price is in the starting total, and nothing else is added', start.rows.length === 3 && start.rows.some((r) => r[0] === 'Basic Electrical Package' && r[1] > 0) && start.windows === 0, JSON.stringify(start.rows));
    ok('…the bar under the building says “Basic electrical”', /Basic electrical/.test(start.bar), start.bar);
    ok('…and where it goes is not answered for the salesperson', start.place === '');
    for (const st of ['Lofted', 'Studio', 'Greenhouse', 'Silver Bullet', 'Low-Wall Barn']) {
      const got = await e.evaluate((st) => { go('start'); begin('custom'); if (!bennettModels[st]) return 'skip'; change('style', st); return S.c.electrical; }, st);
      ok(`A new ${st} keeps Basic electrical picked`, got === 'Basic' || got === 'skip', String(got));
    }
    await e.evaluate(() => { try { closeModal(); } catch (x) {} go('start'); begin('custom'); go('configure'); }); await e.waitForTimeout(600);
    const E = await e.evaluate(() => steps.indexOf('Electrical'));
    await e.evaluate((E) => { for (let i = 1; i <= E; i++) goStep(i); }, E); await e.waitForTimeout(500);
    ok('The Electrical step shows Basic picked and asks where it goes', await e.evaluate((E) => S.step === E && !!document.querySelector('#ep-card.ask') && /Do you want the default electrical package placement installed\?/.test(document.querySelector('#ep-card').textContent), E));
    if (PIC) { await e.waitForTimeout(4300); await e.evaluate(() => window.scrollTo(0, 0)); await e.waitForTimeout(300); await e.screenshot({ path: `${PIC}-electrical-default.png` }); }
    await e.evaluate((E) => goStep(E + 1), E); await e.waitForTimeout(400);
    ok('Continue is blocked until Yes or Edit floor plan is pressed', await e.evaluate((E) => S.step === E, E));
    await tap(e, '#ep-card button', 'Yes'); await e.waitForTimeout(400);
    await e.evaluate((E) => goStep(E + 1), E); await e.waitForTimeout(400);
    ok('After Yes, the sale moves on', await e.evaluate((E) => S.step === E + 1 && S.c.elecPlace === 'default', E));
    await e.evaluate((E) => { goStep(E); change('electrical', 'None'); }, E); await e.waitForTimeout(400);
    ok('The salesperson can still pick “No electrical package”', await e.evaluate(() => S.c.electrical === 'None' && !breakdown(S.c).some((r) => /electrical/i.test(r.name)) && !document.querySelector('#ep-card')));
    ok('A lot building is not changed by the new default', await e.evaluate(() => { const before = JSON.stringify(lots.map((u) => u.c && u.c.electrical)); begin('lot'); return JSON.stringify(lots.map((u) => u.c && u.c.electrical)) === before; }));
    await e.close();
  }

  // ---------- phone ----------
  const q = await open(true);
  await set(q, 'End Porch', '12x16', 'Door on the right', { color: 'White' }); await q.waitForTimeout(500);
  r = await q.evaluate(READ);
  ok('Phone: the railing is on the model and the plan', r.runs === 3 && r.painted > 100 && r.plan === 1, JSON.stringify(r));
  ok('Phone: no sideways scroll', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await tap(q, '#po-rail .po-opt', 'Door in the center'); await q.waitForTimeout(500);
  r = await q.evaluate(READ);
  ok('Phone: tapping another railing redraws it', r.runs === 4 && r.door === 'mid', JSON.stringify(r));
  await q.evaluate(() => openBuildSheet('cfg', true)); await q.waitForTimeout(1200);
  ok('Phone: the floor plan editor draws the railing', await q.locator('.bs-rails').count() >= 1);
  ok('Phone: no sideways scroll in the editor', await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await q.evaluate(() => closeBuildSheet()); await q.waitForTimeout(400);
  if (PIC) { await q.evaluate(() => { P3.angles.stage = { yaw: -1.0, pitch: 0.32 }; p3Paint(true); window.scrollTo(0, 0); }); await q.waitForTimeout(4300); await q.screenshot({ path: `${PIC}-phone.png` }); }
  await q.close();

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
