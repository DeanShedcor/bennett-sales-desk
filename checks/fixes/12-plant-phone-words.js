// Plant batch 2: phone board with the work first and a step bar, faster failing, a photo on "Who fixed it?",
// bigger buttons and text, two names for the last step, plain shop words, material used from the list,
// clean samples, the list of buildings, counts that add up, the QC report, undo on "Send to the floor".
// node fix12.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (kind = 'desk') => {
    const vp = kind === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : kind === 'tablet' ? { viewport: { width: 820, height: 1180 }, hasTouch: true } : { viewport: { width: 1360, height: 1000 } };
    const p = await (await b.newContext({ ...vp, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300);
    return p;
  };
  const w = (p, ms = 350) => p.waitForTimeout(ms);
  const app = (p) => p.locator('#app').innerText();
  const said = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  const quiet = (p) => p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.visibility = 'hidden'; document.getElementById('pg-undo')?.remove(); });
  const shot = async (p, name, opt) => { if (!PIC) return; await quiet(p); await w(p, 250); await p.screenshot({ path: `${PIC}-${name}.png`, ...(opt || {}) }); };
  /* visible buttons, chips, selects and text boxes under 48 px; text under 13 px */
  const small = (p) => p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const low = [...document.querySelectorAll('#app button, #app select, #app input:not([type=checkbox]):not([type=radio]):not([type=file]), #app summary, .modal button, .modal select')].filter(vis).filter((e) => e.getBoundingClientRect().height < 47.5).map((e) => `${Math.round(e.getBoundingClientRect().height)} ${e.tagName} ${(e.textContent || e.placeholder || '').trim().slice(0, 24)}`);
    const tiny = [];
    for (const e of document.querySelectorAll('#app *, .modal *')) { if (!vis(e)) continue; let t = false; for (const n of e.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) t = true; if (t && parseFloat(getComputedStyle(e).fontSize) < 12.95) tiny.push(`${getComputedStyle(e).fontSize} ${e.textContent.trim().slice(0, 20)}`); }
    return { low: [...new Set(low)], tiny: [...new Set(tiny)] };
  });

  /* ---------- 1. Phone board ---------- */
  {
    const p = await open('phone');
    await p.evaluate(() => { opsSide('prod'); go('prod'); }); await w(p, 700);
    const y = await p.evaluate(() => ({ chip: document.querySelector('.pr-pick .chipbtn').getBoundingClientRect().top + scrollY, card: document.querySelector('.pr-col.sel .pr-card')?.getBoundingClientRect().top + scrollY, loads: getComputedStyle(document.querySelector('.pr-loads')).display, tiles: getComputedStyle(document.querySelector('.ops-tiles')).display }));
    ok('1 phone board: the steps start on the first screen', y.chip < 700, y);
    ok('1 phone board: the first building is within about one screen', y.card < 900, y);
    ok('1 phone board: loads and the counts are folded away', y.loads === 'none' && y.tiles === 'none', y);
    const t = await app(p);
    ok('1 phone board: the intro no longer says to drag', /Tap a building to open it and move it/.test(t) && !/Drag a card/.test(t), t.slice(0, 200));
    await shot(p, 'board-phone');
    await p.click('.pp-morebtn'); await w(p);
    ok('1 phone board: the button brings loads, requests and settings back', await p.evaluate(() => getComputedStyle(document.querySelector('.pr-loads')).display !== 'none' && /Hide loads/.test(document.querySelector('.pp-morebtn').textContent)));
    await p.click('.pp-morebtn'); await w(p);
    await p.evaluate(() => prOpen(prUnits().find((u) => u.phase === 3).id)); await w(p, 700);
    const s = await p.evaluate(() => ({ bar: document.querySelector('.of-top .pp-step')?.innerText, barShown: getComputedStyle(document.querySelector('.of-top .pp-step')).display, strip: getComputedStyle(document.querySelector('.of-top .chev')).display }));
    ok('1 building page on a phone: "Step 4 of 9 · Walls" with a bar, no sideways strip', /Step 4 of 9 · Walls/.test(s.bar || '') && s.barShown !== 'none' && s.strip === 'none', s);
    await shot(p, 'step-bar-phone');
    await p.evaluate(() => { opsSide('qc'); go('qc'); }); await w(p, 700);
    const q = await p.evaluate(() => [...document.querySelectorAll('.qc-card')].slice(0, 12).map((c) => ({ t: c.querySelector('.pp-step')?.innerText, strip: getComputedStyle(c.querySelector('.chev')).display })));
    ok('1 QC cards on a phone: "N of 5 groups checked" with a bar', q.length > 5 && q.every((x) => /of 5 groups checked|Signed off/.test(x.t || '') && x.strip === 'none'), q.slice(0, 3));
    ok('1 a QC card with a failure says how many groups failed', q.some((x) => /· \d failed/.test(x.t || '')), q.map((x) => x.t));
    await p.close();
    const d = await open();
    await d.evaluate(() => { opsSide('prod'); go('prod'); }); await w(d, 600);
    ok('1 computer board keeps the counts, loads and the nine-box strip', await d.evaluate(() => getComputedStyle(document.querySelector('.pr-loads')).display !== 'none' && getComputedStyle(document.querySelector('.pp-morebtn')).display === 'none'));
    await d.close();
  }

  /* ---------- 2 and 3. Failing an item, and "Who fixed it?" ---------- */
  {
    const p = await open('phone');
    await p.evaluate(() => { opsSide('qc'); go('qc'); const x = Q.builds.find((y) => qcStatus(y) === 'Ready for QA'); openBuild(x.serial); }); await w(p, 700);
    const id = await p.evaluate(() => { const b = build(Q.serial); const i = itemsFor(b).find((x) => /square/i.test(x.text || askText(b, x))) || itemsFor(b)[0]; answer(i.id, 'fail'); return i.id; }); await w(p, 500);
    const f = await p.evaluate((id) => { const row = document.getElementById('row-' + id); return { q: row.querySelector('p').innerText, types: [...row.querySelectorAll('.qc-fail > .chiprow .chipbtn')].map((x) => x.textContent), sev: [...row.querySelectorAll('.tp-sev .chipbtn')].map((x) => x.textContent), quick: [...row.querySelectorAll('.pp-quick .chipbtn')].map((x) => x.textContent), miss: row.querySelector('.qc-missing').textContent }; }, id);
    ok('2 a floor question offers only the problem types that fit (no Electrical, no Silicone)', f.types.length >= 3 && f.types.length <= 7 && !f.types.includes('Electrical') && !f.types.includes('Silicone missing') && !f.types.includes('Paperwork or serial'), f);
    ok('2 three or four one-tap notes for the question', f.quick.length >= 3 && f.quick.length <= 4, f.quick);
    ok('2 fewer "how bad" chips', f.sev.length === 3, f.sev);
    ok('2 before a tap, a note is still needed', /a note/.test(f.miss), f.miss);
    await p.evaluate((id) => document.querySelector(`#row-${id} .pp-quick .chipbtn`).click(), id); await w(p, 400);
    const g = await p.evaluate((id) => ({ note: draftOf(build(Q.serial)).answers[id].note, miss: document.querySelector(`#row-${id} .qc-missing`).textContent, on: document.querySelector(`#row-${id} .pp-quick .chipbtn`).className }), id);
    ok('2 one tap fills the note, so typing is not needed', g.note && !/a note/.test(g.miss) && /on/.test(g.on), g);
    await p.evaluate((id) => document.getElementById('row-' + id).scrollIntoView({ block: 'start' }), id); await p.evaluate(() => scrollBy(0, -70));
    await shot(p, 'fail-phone');
    const elec = await p.evaluate(() => { const b = build(Q.serial); const i = itemsFor(b).find((x) => /electric|outlet|light/i.test(askText(b, x))); if (!i) return null; answer(i.id, 'fail'); return i.id; }); await w(p, 400);
    if (elec) ok('2 an electrical question does offer Electrical', await p.evaluate((id) => [...document.querySelectorAll(`#row-${id} .qc-fail > .chiprow .chipbtn`)].some((x) => x.textContent === 'Electrical'), elec));
    /* who fixed it */
    await p.evaluate(() => go('qc-rework')); await w(p, 600);
    await p.locator('button:has-text("Mark as fixed")').first().click(); await w(p, 400);
    const m = await p.locator('.modal').innerText();
    ok('3 "Who fixed it?" has a photo button and says what is needed', /Take a photo of the fix/.test(m) && /What we need: type what was done, or take a photo/.test(m), m);
    await shot(p, 'fixed-photo-phone');
    await p.locator('.modal .qc-pick button').first().click(); await w(p, 300);
    ok('3 with nothing typed and no photo it does not close', await p.locator('.modal .qc-pick').count() === 1 && /Type what was done, or take a photo/.test(await said(p)), await said(p));
    await p.setInputFiles('#pp-fixfile', { name: 'fix.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }); await w(p, 500);
    ok('3 a photo shows as added', /Photo added/.test(await p.locator('.modal').innerText()));
    await p.locator('.modal .qc-pick button').first().click(); await w(p, 400);
    ok('3 with a photo it is marked fixed and the photo is kept', await p.evaluate(() => Q.rework.some((r) => r.step === 1 && r.fixPhoto)) && /Photo of the fix/.test(await app(p)));
    await p.close();
  }

  /* ---------- 4. Sizes, on a phone and a tablet ---------- */
  for (const kind of ['phone', 'tablet']) {
    const p = await open(kind);
    const bad = { low: [], tiny: [] };
    const look = async (name) => { await w(p, 600); const r = await small(p); r.low.forEach((x) => bad.low.push(name + ': ' + x)); r.tiny.forEach((x) => bad.tiny.push(name + ': ' + x)); };
    await p.evaluate(() => { opsSide('prod'); go('prod'); }); await look('board');
    if (kind === 'phone') { await p.click('.pp-morebtn'); await look('board+more'); }
    await p.evaluate(() => go('pr-list')); await look('list');
    await p.evaluate(() => go('pr-phases')); await look('steps');
    await p.evaluate(() => prOpen(prUnits().find((u) => u.phase === 3).id)); await look('building');
    await p.evaluate(() => { opsSide('qc'); go('qc'); }); await look('qc');
    await p.evaluate(() => go('qc-rework')); await look('rework');
    await p.evaluate(() => go('qc-signoff')); await look('signoff');
    await p.evaluate(() => go('qc-report')); await look('report');
    await p.evaluate(() => { const x = Q.builds.find((y) => qcStatus(y) === 'Ready for QA'); openBuild(x.serial); }); await look('inspect');
    ok(`4 ${kind}: every button, chip and box on the plant sides is at least 48 px tall`, !bad.low.length, bad.low.slice(0, 12));
    ok(`4 ${kind}: no text on the plant sides is under 13 px`, !bad.tiny.length, bad.tiny.slice(0, 12));
    await p.close();
  }

  /* ---------- 5 and 6. Names and words ---------- */
  {
    const p = await open();
    const seen = {};
    const grab = async (name) => { await w(p, 600); seen[name] = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('.ops-notes, script, style, .sf-hook, .sf-only').forEach((x) => x.remove()); return c.innerText; }); };
    await p.evaluate(() => { opsSide('prod'); go('prod'); }); await grab('board');
    await shot(p, 'board-totals', { clip: { x: 0, y: 150, width: 1360, height: 560 } });
    await p.evaluate(() => go('pr-list')); await grab('list');
    await p.evaluate(() => go('pr-phases')); await grab('steps');
    await shot(p, 'words', { clip: { x: 0, y: 150, width: 1360, height: 700 } });
    await p.evaluate(() => prOpen(prUnits().find((u) => u.phase === 3).id)); await grab('building');
    await p.evaluate(() => prOpen(prUnits().find((u) => u.phase === PR_QA).id)); await grab('building at QC');
    await p.evaluate(() => { opsSide('qc'); go('qc'); }); await grab('qc');
    await shot(p, 'names', { clip: { x: 0, y: 150, width: 1360, height: 760 } });
    await p.evaluate(() => go('qc-rework')); await grab('rework');
    await p.evaluate(() => go('qc-signoff')); await grab('signoff');
    await p.evaluate(() => go('qc-report')); await grab('report');
    await p.evaluate(() => { const x = Q.builds.find((y) => qcStatus(y) === 'Needs sign-off'); Q.signSerial = x.serial; go('qc-signoff'); }); await grab('sign detail');
    await p.evaluate(() => { opsSide('sales'); go('orders'); }); await grab('sales orders');
    await p.evaluate(() => { opsSide('office'); }); await grab('office');
    await p.evaluate(() => { opsSide('logi'); }); await grab('logistics');
    const all = Object.entries(seen);
    const hits = (re) => all.filter(([, t]) => re.test(t)).map(([n, t]) => `${n}: ${(t.match(new RegExp('.{0,30}' + re.source + '.{0,30}')) || [''])[0].replace(/\n/g, ' ')}`);
    for (const [label, re] of [['Final QA', /Final QA/], ['Ready for QA', /Ready for QA/], ['In QA', /\bIn QA\b/], ['a bare QA', /\bQA\b/], ['Needs sign-off', /Needs sign-off/], ['final certification', /final certification/i], ['final QC', /final QC/i],
      ['Kanban', /Kanban/i], ['(free letter)', /free letter/], ['Ops assigns', /Ops assigns/], ['build pipeline', /build pipeline/i], ['Insufficient', /Insufficient/], ['Status in Turbo Assist', /Status in Turbo Assist/], ['ShedSuite', /ShedSuite/], ['Sold in this tab', /Sold in this tab/], ['pay trigger', /pay.trigger/i], ['STRUCTURAL', /STRUCTURAL/], ['transition note', /transition note/i], ['recipe materials', /recipe materials/], ['code words', /order_received|seq \d\d|phase:/]])
      ok(`5/6 no screen says "${label}"`, !hits(re).length, hits(re).slice(0, 4));
    ok('5 the plant screens say "QC check" and "Final sign-off"', /QC check/.test(seen.board) && /QC check/.test(seen.qc) && /final sign-off/i.test(seen.qc) && /Final sign-off/.test(seen.signoff), seen.signoff.slice(0, 200));
    ok('5 the QC tab is still called Plant QC', /Plant QC/.test(seen.board));
    ok('6 the board says when materials are counted, in plain words', /Materials are counted as used when a building gets its final sign-off/.test(seen.board));
    ok('6 step settings: "Pay the crew at this step" and a building count, no code', /Pay the crew at this step/.test(seen.steps) && /buildings? here now/.test(seen.steps) && /First step/.test(seen.steps), seen.steps.slice(0, 400));
    await p.evaluate(() => { opsSide('prod'); S.sfNotes = true; go('pr-phases'); }); await w(p, 500);
    ok('6 with builder notes on, the code words come back', /order_received/.test(await app(p)));
    await p.evaluate(() => { S.sfNotes = false; });
    /* one next button after a pass */
    const one = await p.evaluate(() => { opsSide('qc'); const x = Q.builds.find((y) => qcStatus(y) === 'Needs sign-off'); openBuild(x.serial); return x.serial; }); await w(p, 600);
    const btns = await p.evaluate(() => [...document.querySelectorAll('#app button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()).filter((t) => /sign-off|certif/i.test(t)));
    ok('5 after a pass there is one next button, to the final sign-off', btns.length === 1 && /final sign-off/i.test(btns[0]), btns);
    await p.close();
  }

  /* ---------- 7. Materials ---------- */
  {
    const p = await open();
    await p.evaluate(() => { opsSide('prod'); prOpen(prUnits().find((u) => u.phase === 3).id); }); await w(p, 700);
    const before = await p.evaluate(() => ({ use: document.querySelectorAll('.tp-bom button').length, stud: TP.mats.find((m) => m.code === 'LUM-01').on, role: document.querySelector('.tp-bom li i') ? 1 : 0, id: PR.id }));
    ok('7 each materials line with a quantity has a "Use" button, and no code-word column', before.use >= 8 && !before.role, before);
    await p.locator('.tp-bom li:has-text("Precut Stud") button').first().click(); await w(p, 400);
    const mid = await p.evaluate(() => ({ list: (TP.issued[PR.id] || []).map((x) => [x.name, x.qty]), stud: TP.mats.find((m) => m.code === 'LUM-01').on, used: document.querySelectorAll('.tp-bom .pp-used').length, back: [...document.querySelectorAll('.tp-bom button')].filter((x) => /Take back/.test(x.textContent)).length }));
    ok('7 "Use" records the line with its quantity filled in and takes it from stock', mid.list.length === 1 && mid.list[0][1] > 0 && mid.used === 1 && mid.back === 1 && mid.stud < before.stud, mid);
    await shot(p, 'issue-material', { clip: { x: 660, y: 150, width: 700, height: 760 } });
    if (PIC) { await p.evaluate(() => document.querySelector('.tp-bom').scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -90)); await shot(p, 'issue-material'); }
    await p.locator('.tp-bom button:has-text("Take back")').first().click(); await w(p, 400);
    ok('7 "Take back" removes it and puts the stock back', await p.evaluate((n) => (TP.issued[PR.id] || []).length === 0 && TP.mats.find((m) => m.code === 'LUM-01').on === n, before.stud));
    await p.selectOption('#tp-mat', 'ROO-01'); await p.fill('#tp-qty', '12'); await p.click('.tp-issue button:has-text("Issue"), .tp-issue button.primary'); await w(p, 400);
    ok('7 material not on the list can still be used, and taken back', await p.evaluate(() => (TP.issued[PR.id] || []).length === 1 && TP.mats.find((m) => m.code === 'ROO-01').on === 3188) && await p.locator('.tp-issue button:has-text("Take back")').count() === 1);
    await p.locator('.tp-issue button:has-text("Take back")').click(); await w(p, 300);
    ok('7 taking that back restores its stock', await p.evaluate(() => TP.mats.find((m) => m.code === 'ROO-01').on === 3200));
    await p.close();
  }

  /* ---------- 8, 9. Samples, the list, the building page ---------- */
  {
    const p = await open();
    await p.evaluate(() => { opsSide('prod'); go('pr-list'); }); await w(p, 600);
    const order = await p.evaluate(() => { const by = Object.fromEntries(prUnits().map((u) => [u.id, u.phase])); return [...document.querySelectorAll('#pr-rows .ops-row')].map((r) => by[(/prOpen\('([^']+)'\)/.exec(r.innerHTML) || [])[1]]); });
    const firstDone = order.indexOf(8);
    ok('9 the list shows unfinished buildings first, finished ones last', firstDone > 0 && order.slice(firstDone).every((x) => x === 8) && order.slice(0, firstDone).every((x) => x < 8), order);
    await p.locator('.pp-steps .chipbtn:has-text("Walls")').click(); await w(p, 400);
    ok('9 the step filter shows one step', await p.evaluate(() => { const by = Object.fromEntries(prUnits().map((u) => [u.id, u.phase])); const r = [...document.querySelectorAll('#pr-rows .ops-row')].map((x) => by[(/prOpen\('([^']+)'\)/.exec(x.innerHTML) || [])[1]]); return r.length > 0 && r.every((x) => x === 3); }));
    await shot(p, 'units', { clip: { x: 0, y: 150, width: 1360, height: 700 } });
    await p.evaluate(() => { PP.roster = null; prOpen(prUnits().find((u) => u.phase === 3 && !(PR.hist[u.id] || []).length).id); }); await w(p, 600);
    const pg = await p.evaluate(() => ({ t: document.getElementById('app').innerText, packetY: [...document.querySelectorAll('#app h2')].find((h) => /Plant packet/.test(h.textContent)).getBoundingClientRect().left, moveY: [...document.querySelectorAll('#app h2')].find((h) => /Move to the next step/.test(h.textContent)).getBoundingClientRect().left, mark: getComputedStyle(document.querySelector('.pp-nothing .of-mark')).visibility }));
    ok('8 a sample building part-way through says when it came to its step, not "No moves yet"', /Came to Walls/.test(pg.t) && !/No moves yet/.test(pg.t));
    ok('9 build details come before the move buttons and history', pg.packetY < pg.moveY, [pg.packetY, pg.moveY]);
    ok('9 "Special instructions: None" has no empty circle', pg.mark === 'hidden');
    ok('9 windows say they are windows', /2 × 3 ft Standard window/.test(pg.t), (pg.t.match(/.{0,40}2 × 3 ft.{0,40}/) || [''])[0]);
    await p.evaluate(() => prOpen(prUnits().find((u) => u.phase === PR_DONE).id)); await w(p, 600);
    const done = await app(p);
    ok('8 a finished building says "Finished" with a date, not days at this step', /Finished [A-Z][a-z]{2} \d/.test(done) && !/days at this step/.test(done.split('\n').slice(0, 12).join(' ')), done.slice(0, 300));
    await p.evaluate(() => { opsSide('qc'); const x = Q.builds.find((y) => qcStatus(y) === 'Needs sign-off'); Q.signSerial = x.serial; go('qc-signoff'); }); await w(p, 600);
    const sd = await app(p);
    ok('8 the building ready for final sign-off shows its answers, not "No item detail"', !/No item detail/.test(sd) && /\d+ yes/.test(sd), sd.slice(0, 400));
    await p.close();
  }

  /* ---------- 10. Counts, tiles, search, report ---------- */
  {
    const p = await open();
    await p.evaluate(() => { opsSide('prod'); go('prod'); }); await w(p, 600);
    const t = await p.evaluate(() => [...document.querySelectorAll('.pp-tile')].map((x) => [x.querySelector('span').textContent, +x.querySelector('strong').textContent]));
    ok('10 the counts add up to the number on the board', t.length === 5 && t.slice(0, 4).reduce((s, x) => s + x[1], 0) === t[4][1] && /Not started yet/.test(t[0][0]), t);
    await p.locator('.pp-tile:has-text("Being built")').click(); await w(p, 400);
    ok('10 pressing a count filters the board', await p.evaluate(() => { const n = document.querySelectorAll('#pr-cols .pr-card').length; return n > 0 && n === prUnits().filter((u) => u.phase >= 2 && u.phase < PR_QA).length; }));
    await p.locator('.pp-tile:has-text("All on the board")').click(); await w(p, 300);
    await p.fill('.pp-board .search', 'zzzz'); await w(p, 400);
    const none = await p.evaluate(() => ({ t: document.getElementById('pr-cols').innerText, cols: document.querySelectorAll('#pr-cols .pr-col').length }));
    ok('10 a search with no match shows one "Nothing found" line', /Nothing found/.test(none.t) && none.cols === 0 && !/Empty/.test(none.t), none);
    await p.evaluate(() => { PR.q = ''; opsSide('qc'); go('qc-report'); }); await w(p, 600);
    const rep = await app(p);
    ok('10 the QC report keeps only the numbers', /Buildings inspected/.test(rep) && !/Work waiting|QC settings|Failure photos required/.test(rep) && /on the Buildings screen now/.test(rep), rep.slice(0, 400));
    await p.evaluate(() => go('qc')); await w(p, 600);
    const home = await app(p);
    ok('10 the work list and the QC rules are on Buildings', /Work waiting/.test(home) && /QC rules/.test(home), home.slice(-600));
    await p.evaluate(() => { document.querySelector('.pp-rules').open = true; }); await w(p, 200);
    ok('10 the QC rules still switch, with the Settings check', await p.locator('.pp-rules input[type=checkbox]').count() === 3);
    await p.close();
  }

  /* ---------- 11. Undo on "Send to the floor" ---------- */
  {
    const p = await open();
    await p.evaluate(() => { opsSide('prod'); go('prod'); }); await w(p, 600);
    const was = await p.evaluate(() => { const l = PR.loads.find((x) => x.state === 'open' && x.units.length); return { id: l.id, phases: l.units.map((id) => prUnit(id).phase) }; });
    await p.locator(`.pr-load:has(.lg-code:text-is("${was.id}")) button:has-text("Send to the floor")`).click(); await w(p, 500);
    const sent = await p.evaluate((id) => { const l = PR.loads.find((x) => x.id === id); return { state: l.state, phases: l.units.map((u) => prUnit(u).phase), undo: !!document.getElementById('pg-undo') }; }, was.id);
    ok('11 "Send to the floor" starts the load and offers Undo', sent.state === 'dispatched' && sent.undo && sent.phases.some((x, i) => x !== was.phases[i]), sent);
    await p.click('#pg-undo button'); await w(p, 500);
    const back = await p.evaluate((id) => { const l = PR.loads.find((x) => x.id === id); return { state: l.state, phases: l.units.map((u) => prUnit(u).phase) }; }, was.id);
    ok('11 Undo puts the load and its buildings back', back.state === 'open' && JSON.stringify(back.phases) === JSON.stringify(was.phases), back);
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
