/* turbo-plant-test.js: every control turbo-plant.js adds to Production and Plant QC.
   Usage: node turbo-plant-test.js [url]   (default http://localhost:8772/index.html) */
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
const SHOTS = process.cwd() + '/shots/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
let fails = 0, passes = 0;
const check = (name, ok, detail = '') => { ok ? passes++ : fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  ·  ' + String(detail).slice(0, 220) : ''}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await p.goto(URL); await p.waitForTimeout(1500); await p.evaluate(() => { if (typeof PP !== 'undefined') PP.raw = true; if (typeof OG !== 'undefined') { OG.live = true; ofAll().forEach((s) => { if (!ofRto(s) && !s.invoice) ofRec(s).taxExempt = { by: 'check', at: 1 }; }); } });
  const ev = (fn, arg) => p.evaluate(fn, arg), toastText = () => ev(() => document.getElementById('toast').textContent), wait = (ms = 250) => p.waitForTimeout(ms);
  const text = async (sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
  const spec = (label) => ev((label) => { const row = [...document.querySelectorAll('.tp-specs .od-kv')].find((r) => r.querySelector('span').textContent === label); return row ? row.querySelector('strong').textContent.replace(/\s+/g, ' ').trim() : null; }, label);
  const bom = (needle) => ev((needle) => { const li = [...document.querySelectorAll('.tp-bom .tp-lines li')].find((r) => r.textContent.includes(needle)); return li ? li.querySelector('b').textContent.trim() : null; }, needle);

  console.log('\n== 1. Plant serials ==');
  const boot = await ev(() => { const units = prUnits(); return { issued: Object.values(TP.serials), past: units.filter((u) => u.phase >= 1).length, zeroWith: units.filter((u) => u.phase === 0 && (u.serial || u.plantSerial)).length, withAll: units.filter((u) => u.phase >= 1).every((u) => u.plantSerial && u.serial === u.plantSerial + ' · ' + u.id) }; });
  check('every serial reads ORB- and five digits', boot.issued.length > 0 && boot.issued.every((s) => /^ORB-\d{5}$/.test(s)), boot.issued.slice(0, 3).join(', '));
  check('serials are unique', new Set(boot.issued).size === boot.issued.length, boot.issued.length + ' issued');
  check('one serial per building past Order received', boot.issued.length === boot.past && boot.withAll, `${boot.issued.length} serials, ${boot.past} buildings`);
  check('no serial while still in Order received', boot.zeroWith === 0);
  await ev(() => go('prod')); await wait(400);
  check('Order received cards say "No serial yet"', (await p.$$eval('.pr-col >> nth=0 >> .pr-card .serial', (els) => els.map((e) => e.textContent))).every((t) => t === 'No serial yet'));
  check('a card shows the serial and the record id', /ORB-\d{5} · SAMPLE-1220-3001/.test(await text('.pr-card:has-text("SAMPLE-1220-3001") .serial')));
  check('no notices fired for sample data at load', (await ev(() => taNoticesFor('prod').length)) === 3 && (await ev(() => taNoticesFor('qc').length)) === 2, 'prod 3 seeded, qc 2 seeded');

  check('serial format: plant code, dash, five digits, wider past 99999', await ev(() => tpFormatSerial('ORB', 1) === 'ORB-00001' && tpFormatSerial('ORB', 1841) === 'ORB-01841' && tpFormatSerial('ORB', 123456) === 'ORB-123456'));
  check('plant codes: ORB for Orangeburg, first three letters for a plant added later', await ev(() => tpPlantCode(PLANTS[0]) === 'ORB' && tpPlantCode({ id: 'lexington-plant', name: 'Lexington plant', town: 'Lexington' }) === 'LEX' && tpPlantCode({ id: 'x', town: 'St. George', code: 'stg' }) === 'STG'));
  // build start: the office approves a lot's stock order
  const stock = await ev(() => S.stock.find((r) => (r.stage || 0) === 0).id);
  const before = await ev((id) => ({ serial: tpSerial(id), max: Math.max(...Object.values(TP.serials).map((s) => Number(s.slice(4)))) }), stock);
  await ev(() => go('of-requests')); await wait(300);
  await p.click(`.ops-row:has-text("${stock}") .primary`); await wait(300);
  const after = await ev((id) => ({ serial: tpSerial(id), notice: taNoticesFor('prod')[0]?.title, hist: (PR.hist[id] || []).map((h) => h.note), phase: prUnit(id).phase }), stock);
  check('stock order had no serial before approval', before.serial === '');
  check('approval starts the build and issues the next serial', after.serial === 'ORB-' + String(before.max + 1).padStart(5, '0'), `${stock} -> ${after.serial}`);
  check('Production bell: "Build started — serial … assigned"', after.notice === `Build started — serial ${after.serial} assigned`, after.notice);
  check('history carries the same line', after.hist.includes(`Build started — serial ${after.serial} assigned`));
  await ev((id) => prOpen(id), stock); await wait(300);
  check('unit page head shows serial · id', (await text('.pagehead h1')) === `${after.serial} · ${stock}`, await text('.pagehead h1'));

  console.log('\n== 2. Build specs, by hand ==');
  // 12x20 wood: joists ceil(20*12/16)+1 = 16; studs 2*((15+1)+(9+1)) = 52; plates 6*(12+20) = 192; panels 240/32 = 7.5
  await ev(() => prOpen('SAMPLE-1220-3001')); await wait(300);
  check('12x20: 2x6 joists at 16 in, 16 of them', /^2x6 pressure treated, 16 in on center · 16 joists$/.test(await spec('Floor joists')), await spec('Floor joists'));
  check('12x20: 52 studs at 16 in', (await spec('Wall studs')) === '16 in on center · 52 studs', await spec('Wall studs'));
  check('12x20: 192 ft of plates', (await spec('Plates')).startsWith('192 ft'), await spec('Plates'));
  check('12x20: 7.5 floor panels', (await spec('Floor panels')) === '7.5 sheets of 4x8', await spec('Floor panels'));
  check('12x20: four runner tracks, 6 ft wall, TechShield (Classic)', (await spec('Runners')).endsWith('4 tracks') && (await spec('Sidewall height')) === '6 ft' && (await spec('Radiant barrier')) === 'TechShield on walls and ceiling');
  check('12x20 bill: runners 4 x 20 ft', (await bom("4x6 - 20' Notched 4x6 Runners")) === '×4 each', await bom("4x6 - 20' Notched 4x6 Runners"));
  check('12x20 bill: plates 6 x 12 ft and 12 x 10 ft (192 ft)', (await bom('2x4x144 (12) - Precut Stud, plates')) === '×6 each' && (await bom('2x4x120 (10) - Precut Stud, plates')) === '×12 each');
  check('12x20 bill: nails 52*7 = 364 and 25*32-40 = 760', (await bom('3" Galvanized Nail')) === '×364 each' && (await bom('2" Galvanized Nail')) === '×760 each');
  check('12x20 bill: band boards 64 ft, 2 pull boards', (await bom('band boards')) === '×64 ft' && (await bom('pull boards')) === '×2 each');
  // 10x16 lofted barn: joists ceil(12)+1 = 13; studs 2*((12+1)+(8+1)) = 44; plates 156; panels 5; 16 ft long -> 8 ft loft, 5 joists
  await ev(() => prOpen('SAMPLE-1016-3002')); await wait(300);
  check('10x16 lofted: 13 joists, 44 studs, 156 ft plates, 5 panels', (await spec('Floor joists')).endsWith('13 joists') && (await spec('Wall studs')).endsWith('44 studs') && (await spec('Plates')).startsWith('156 ft') && (await spec('Floor panels')) === '5 sheets of 4x8', [await spec('Floor joists'), await spec('Wall studs'), await spec('Plates')].join(' | '));
  check('10x16 lofted: 8 ft loft with 5 joists, peak heights, no TechShield (Basic)', (await spec('Loft')) === '8 ft loft · 5 joists at 24 in on center' && (await spec('Peak')) === 'About 10 ft inside · 11 ft 4 in outside' && (await spec('Radiant barrier')) === 'None on this series', await spec('Loft'));
  check('10x16 bill: loft panels 8*10/32 = 2.5', (await bom('4x8 loft floor panels')) === '×2.5 sheets', await bom('4x8 loft floor panels'));
  // 14x32 lofted: joists ceil(24)+1 = 25; studs 2*((24+1)+(11+1)) = 74; plates 276; panels 14
  await ev(() => prOpen('SAMPLE-1432-3005')); await wait(300);
  check('14x32 lofted: 25 joists, 74 studs, 276 ft plates, 14 panels', (await spec('Floor joists')).endsWith('25 joists') && (await spec('Wall studs')).endsWith('74 studs') && (await spec('Plates')).startsWith('276 ft') && (await spec('Floor panels')) === '14 sheets of 4x8', [await spec('Floor joists'), await spec('Wall studs'), await spec('Plates')].join(' | '));
  check('14x32: flagged as 14 wide with a link to the article', (await text('.tp-rules')).includes('14 wide: custom order, needs a transport permit') && (await p.locator('.tp-rules .ta-tip').count()) === 1);
  // 10x12 Silver Bullet: studs at 24 in: 2*((6+1)+(5+1)) = 26; joists ceil(9)+1 = 10
  await ev(() => prOpen('STOCK-5')); await wait(300);
  check('10x12 Silver Bullet: 26 studs at 24 in, 10 joists, screws in bags', (await spec('Wall studs')) === '24 in on center · 26 studs' && (await spec('Floor joists')).endsWith('10 joists') && (await bom('Metal siding screws')) === '×2.04 bags', [await spec('Wall studs'), await bom('Metal siding screws')].join(' | '));
  // 8x12: narrower than 10 ft keeps 2x4 joists: ceil(9)+1 = 10; studs 2*((9+1)+(6+1)) = 34
  await ev(() => prOpen('SAMPLE-812-1003')); await wait(300);
  check('8x12: 2x4 joists (10), 34 studs, no runner count', (await spec('Floor joists')) === '2x4 pressure treated, 16 in on center · 10 joists' && (await spec('Wall studs')).endsWith('34 studs') && (await spec('Runners')) === '4x6 notched, pressure treated', await spec('Floor joists'));
  await ev(() => prOpen('STB-3102')); await wait(300);
  check('a building still in Order received: "No recipe lines on this unit."', (await text('.tp-bom')).includes('No recipe lines on this unit.') && (await text('.tp-issue')).includes('Material is issued once the build has started.'));

  console.log('\n== 3. Issue material, Ship from plant ==');
  await ev(() => prOpen('SAMPLE-1220-3001')); await wait(300);
  await p.click('.tp-issue button:has-text("Issue")'); await wait(100);
  check('no material picked: "Pick a material"', (await text('#tp-isserr')) === 'Pick a material');
  await p.selectOption('#tp-mat', 'ROO-01'); await p.click('.tp-issue button:has-text("Issue")'); await wait(100);
  check('no quantity: "Enter a quantity"', (await text('#tp-isserr')) === 'Enter a quantity');
  await p.selectOption('#tp-mat', 'ROO-01'); await p.fill('#tp-qty', '24'); await p.click('.tp-issue button:has-text("Issue")'); await wait(300);
  check('issuing takes it off what is on hand and lists it', (await ev(() => TP.mats.find((m) => m.code === 'ROO-01').on)) === 3176 && (await text('.tp-issue .tp-lines')).includes('Hurricane Ties') && (await text('.tp-issue .tp-lines')).includes('24 each'), await toastText());
  await p.selectOption('#tp-mat', 'FLO-02'); await p.fill('#tp-qty', '41'); await p.click('.tp-issue button:has-text("Issue")'); await wait(150);
  check('more than is on hand is refused in Turbo Assist\'s words', (await text('#tp-isserr')) === 'Insufficient on-hand quantity (40 available, 41 requested).' && (await ev(() => TP.mats.find((m) => m.code === 'FLO-02').on)) === 40, await text('#tp-isserr'));
  check('Ship from plant: "Finish build first", disabled', await p.isDisabled('.tp-ship button:has-text("Finish build first")'));
  check('Ship from plant carries Turbo Assist\'s sentence', (await text('.tp-ship')).includes('Marks the unit shipped and takes it off the active Kanban. Logistics / delivery can be scheduled later.'));
  await ev(() => prOpen('SAMPLE-1428-1012')); await wait(300);
  check('a built building: Ship from plant is live and opens Logistics', !(await p.isDisabled('.tp-ship button:has-text("Ship from plant")')));
  await p.click('.tp-ship button:has-text("Ship from plant")'); await wait(300);
  check('... on the Logistics side', (await ev(() => document.body.dataset.side)) === 'logi', await ev(() => S.page));
  check('unassigned building shows Turbo Assist\'s load hint', await ev(() => { prOpen('SAMPLE-1012-3004'); return document.querySelector('.tp-hint')?.textContent === 'Not assigned. Ops assigns a letter before sending the load to the plant.'; }));

  console.log('\n== 4. Board: moves, loads, phases, inventory request ==');
  await ev(() => prOpen('SAMPLE-1012-3004')); await wait(200);
  await p.fill('#pr-note', 'Checked the square'); await p.click('.pr-move .primary'); await wait(250);
  check('move toast: "Moved to Walls"', (await toastText()) === 'Moved to Walls', await toastText());
  await ev(() => go('prod')); await wait(300);
  check('filter row: All sale paths, Stock, Cash, Finance, RTO', (await p.$$eval('.qc-filter .chiprow .chipbtn', (els) => els.slice(0, 5).map((e) => e.textContent.trim()))).join('|') === 'All sale paths|Stock|Cash|Finance|RTO');
  check('column marks: initial on Order received, build complete · pay on Build complete', (await text('.pr-col >> nth=0 >> header .tp-mark')) === 'initial' && (await text('.pr-col >> nth=8 >> header .tp-mark')) === 'build complete · pay');
  check('four counts unchanged, plus the Inventory request tile', (await p.locator('.ops-tiles .kpi').count()) === 4 && (await p.locator('.ops-tiles .tp-reqtile').count()) === 1);
  // loads: send B, real toast and note
  await p.click('.pr-load:has-text("North Carolina run") button:has-text("Send to the floor")'); await wait(300);
  check('dispatch toast: "Load B sent to plant"', (await toastText()) === 'Load B sent to plant', await toastText());
  check('each building moved to the first shop phase with Turbo Assist\'s note', await ev(() => ['SAMPLE-1220-3001', 'SAMPLE-1016-3002'].every((id) => prUnit(id).phase === 2 && PR.hist[id].some((h) => h.note === 'Load B sent to plant') && !PR.hist[id].some((h) => /sent to the floor/.test(h.note)))));
  check('load card shows the real status word', (await text('.pr-load:has-text("North Carolina run") .tp-loadmeta')) === 'Status in Turbo Assist: dispatched');
  await ev(() => prLoadDispatch('B')); await wait(100);
  check('sending it twice: "Load B is already dispatched."', (await toastText()) === 'Load B is already dispatched.', await toastText());
  // new load: next free letter is C, footage note
  await p.click('button:has-text("New load")'); await wait(300);
  check('new load toast says to pick buildings and press Save', (await toastText()) === 'Pick the buildings for load C, then press Save.', await toastText());
  check('load form has the Footage notes field', (await p.getAttribute('#tp-footage', 'placeholder')) === 'Ops footage (freeform)');
  await p.locator('.pr-pickrow input').first().check(); await p.fill('#pr-alias', 'Coast run'); await p.fill('#tp-footage', '28 ft so far'); await p.click('.modal button:has-text("Save the load")'); await wait(300);
  check('footage note saved and shown on the card', (await ev(() => prLoad('C').footage)) === '28 ft so far' && (await text('.pr-load:has-text("Coast run") .tp-loadmeta')) === 'Status in Turbo Assist: open · Footage: 28 ft so far');
  // close A: letter is free, the next new load reuses A
  await p.click('.pr-load:has-text("Florence and Lugoff") button:has-text("Close (free letter)")'); await wait(300);
  check('close toast: "Load A closed — letter is free"', (await toastText()) === 'Load A closed — letter is free', await toastText());
  check('closed load left the strip and is listed as closed', (await ev(() => !prLoad('A') && TP.closedLoads.length === 1 && TP.closedLoads[0].state === 'closed')) && /^Closed loads\s*1$/.test((await text('.tp-closed summary')).trim()));
  await ev(() => tpLoadClose('A')); await wait(100);
  check('closing it again: "Load A is already closed."', (await toastText()) === 'Load A is already closed.');
  await p.click('button:has-text("New load")'); await wait(300);
  check('the freed letter is reused for the next new load', (await toastText()) === 'Pick the buildings for load A, then press Save.' && (await ev(() => PR.loads.map((l) => l.id).join(''))) === 'BCA', await ev(() => PR.loads.map((l) => l.id + ':' + l.state).join(' ')));
  await p.click('.modal button:has-text("Cancel")'); await wait(200);
  check('cancelling the empty new load frees the letter again', await ev(() => !prLoad('A') && tpNextCode() === 'A'));
  check('all 702 letters taken: Turbo Assist\'s error', await ev(() => { const keep = PR.loads; PR.loads = Array.from({ length: 702 }, (_, i) => ({ id: prCode(i), units: [], state: 'open' })); prLoadNew(); const t = document.getElementById('toast').textContent; PR.loads = keep; return t === 'All load codes A–ZZ are in use. Close a finished load to reuse a letter.'; }));
  check('a load with no buildings cannot be sent', await ev(() => { PR.loads.push({ id: 'ZZ', alias: '', units: [], state: 'open' }); prLoadDispatch('ZZ'); const t = document.getElementById('toast').textContent; PR.loads = PR.loads.filter((l) => l.id !== 'ZZ'); return t === 'Load ZZ has no units assigned.'; }));
  // phases
  await ev(() => go('prod')); await wait(200);
  await p.click('button:has-text("Phase settings")'); await wait(300);
  check('Phase settings page: nine phases, Initial, Build complete, Pay trigger', (await ev(() => S.page)) === 'pr-phases' && (await p.locator('.tp-phase').count()) === 9 && (await text('.tp-phase >> nth=0')).includes('Initial') && (await text('.tp-phase >> nth=8')).includes('Build complete') && (await text('.tp-phase >> nth=8')).includes('Pay trigger'));
  check('reordering is switched off (Move earlier / Move later disabled)', (await p.locator('.tp-updown button[disabled]').count()) === 18 && (await p.getAttribute('.tp-updown button >> nth=0', 'title')) === 'Move earlier');
  const payBefore = await ev(() => Object.keys(TP.pay).length);
  await p.click('.tp-phase:has-text("Ceiling / finish") button:has-text("Set pay trigger")'); await wait(250);
  check('Set pay trigger flips to Clear pay trigger', (await text('.tp-phase:has-text("Ceiling / finish") > button.secondary')) === 'Clear pay trigger');
  check('a building already sitting in that phase is not added', (await ev(() => Object.keys(TP.pay).length)) === payBefore);
  await ev(() => prMove('SAMPLE-1012-3004', 4)); await wait(250);
  check('moving a building into the pay-trigger phase puts it on the pay list', await ev(() => (TP.pay['SAMPLE-1012-3004'] || []).some((x) => x.phase === 4)));
  await ev(() => prOpen('SAMPLE-1012-3004')); await wait(250);
  check('... and the building shows it', (await text('.of-top .ops-flags')).includes('On the labor pay list since'));
  await ev(() => go('prod')); await wait(250);
  check('the board column shows "pay"', (await text('.pr-col >> nth=4 >> header .tp-mark')) === 'pay');
  await ev(() => { go('pr-phases'); }); await wait(200);
  await p.click('.tp-phase:has-text("Ceiling / finish") button:has-text("Clear pay trigger")'); await wait(200);
  check('Clear pay trigger turns it off again', await ev(() => !TP.phases[4].pay));
  // inventory request
  await ev(() => go('prod')); await wait(200);
  await p.click('.tp-reqtile'); await wait(250);
  check('Inventory request form: "Stays on the build pipeline."', (await text('.modal')).includes('Stays on the build pipeline.') && (await p.getAttribute('#tp-rq-note', 'placeholder')) === "We're out of siding / need a pallet before Friday");
  await p.click('.modal button:has-text("Send request")'); await wait(100);
  check('empty request: "Add a note or at least one item."', (await text('#tp-rq-err')) === 'Add a note or at least one item.');
  await p.fill('#tp-rq-note', 'Need a pallet before Friday'); await p.selectOption('#tp-rq-m0', 'LUM-01'); await p.fill('#tp-rq-q0', '400'); await p.click('.modal button:has-text("Send request")'); await wait(300);
  check('sent: "Sent inventory request PO-1042. Purchasing will review."', (await toastText()) === 'Sent inventory request PO-1042. Purchasing will review.', await toastText());
  check('the request is listed on the board', (await text('.tp-reqs')).includes('PO-1042') && (await text('.tp-reqs')).includes('400 each 2x4x72 (6) - Precut Stud'));
  await ev(() => go('pr-list')); await wait(300);
  check('Units list: longer sale-path label and the plant as code and name', (await text('.ops-row:has-text("SAMPLE-1220-3001") .tp-rosterx')).startsWith('Inventory (no sale yet) · Plant ORB · ShedCor plant'), await text('.ops-row:has-text("SAMPLE-1220-3001") .tp-rosterx'));
  await p.screenshot({ path: SHOTS + 't-units.png', fullPage: true });

  console.log('\n== 5. A customer order: build start to final QC, three notices ==');
  const ORDER = 'AA-20411';
  const cleared = await ev((id) => {
    const s = ofSale(id);
    for (let guard = 0; guard < 8 && ofLeft(s).length; guard++)
      for (const c of ofLeft(s)) {
        if (c.key === 'deposit') { const i = s.money.payments.findIndex((x) => !x.confirmed); if (i >= 0) ofConfirmPay(id, i); else s.money.payments.push({ amount: 500, method: 'Card', at: Date.now(), confirmed: true }); }
        else if (c.key === 'rto') { const r = s.office.rtoCo; if (!r) ofRtoSend(id); else if (r.state === 'sent') ofRtoAnswer(id, true); }
        else if (c.key.startsWith('disc')) ofDiscountOk(id, Number(c.key.slice(4)));
      }
    return ofLeft(s).map((c) => c.key);
  }, ORDER);
  check('office checks cleared for the sample order', cleared.length === 0, cleared.join(','));
  const n0 = await ev(() => ({ sales: taNoticesFor('sales').length, office: taNoticesFor('office').length, logi: taNoticesFor('logi').length, prod: taNoticesFor('prod').length }));
  await ev((id) => { go('office'); ofApprove(id); }, ORDER); await wait(300);
  const orderSerial = await ev((id) => tpSerial(id), ORDER);
  check('office approval issues the order\'s plant serial', /^ORB-\d{5}$/.test(orderSerial) && (await ev(() => taNoticesFor('prod')[0].title)) === `Build started — serial ${orderSerial} assigned`, orderSerial);
  await ev((id) => { for (let i = 0; i < 6; i++) prMove(id, prUnit(id).phase + 1); }, ORDER); await wait(400);
  check('moved through the plant to Final QA and onto the Plant QC list', await ev((id) => prUnit(id).phase === PR_QA && !!build(id) && qcStatus(build(id)) === 'Ready for QA', ORDER));
  check('the QC question asks for the plant serial', await ev((id) => askText(build(id), Object.values(ITEM).find((i) => i.text === 'Is the serial number verified?')) === `Does the serial number on the building read ${tpSerial(id)}?`, ORDER));
  await ev((id) => { openBuild(id); const b = build(id); for (const i of itemsFor(b)) draftOf(b).answers[i.id] = { r: 'pass' }; render(); }, ORDER); await wait(300);
  check('answered items show Turbo Assist\'s word "Passed"', (await p.locator('.qc-item .tp-res.passed').count()) === (await p.locator('.qc-item').count()) && (await text('.qc-item .tp-res >> nth=0')) === 'Passed');
  check('lede shows plant serial, then the order number', (await text('.pagehead .lede')).startsWith(`${orderSerial} · order ${ORDER} · `), await text('.pagehead .lede'));
  await p.click('.qc-bar .primary'); await wait(300);
  check('inspection passed: waiting on sign-off', (await ev((id) => qcStatus(build(id)), ORDER)) === 'Needs sign-off');
  // QC marks it ready for final certification
  check('passed panel offers "Ready for final certification"', (await p.locator('button:has-text("Ready for final certification")').count()) === 1);
  await p.click('button:has-text("Ready for final certification")'); await wait(300);
  check('marked ready: line on the panel, history, and a Plant QC notice', (await text('.tp-state')) === 'Ready for final certification · Riley Carter.' && (await ev((id) => Q.log.some((l) => l.serial === id && l.text === 'QC marked this building ready for final QC.'), ORDER)) && (await ev(() => taNoticesFor('qc')[0].title)) === `Ready for final certification · ${orderSerial}`, await ev(() => taNoticesFor('qc')[0].body));
  // final QC fails an item again
  await ev((id) => { Q.signSerial = id; go('qc-signoff'); }, ORDER); await wait(300);
  check('Final QC panel: Turbo Assist\'s sentence and state', (await text('.tp-final')).includes('Fail anything that still needs work. That sends the building back to QC and keeps who marked it ready for certification. Final QC Pass signs the building and tells delivery.') && (await text('.tp-final .tp-state')) === 'Ready for final certification · Riley Carter.' && (await text('.tp-final .panelhead .pill')) === 'Waiting on final QC');
  const listed = await ev((id) => { document.querySelector('.tp-all').open = true; const r = [...document.querySelectorAll('.tp-sec li .tp-res')].map((x) => x.textContent); return { n: r.length, want: itemsFor(build(id)).length, other: [...new Set(r.filter((x) => x !== 'Passed'))] }; }, ORDER);
  check('every item listed as "Passed"', listed.n === listed.want && listed.n > 20 && !listed.other.length, JSON.stringify(listed));
  await p.click('button:has-text("Fail an item again")'); await wait(250);
  await p.click('.modal button:has-text("Fail this item")'); await wait(150);
  check('failing without a note is refused while notes are required', (await toastText()) === 'Add a note: what still needs work.' && (await p.locator('.modal').count()) === 1);
  const failItem = await ev(() => document.getElementById('tp-ff-item').value);
  await p.fill('#tp-ff-note', 'Trim gap above the door'); await p.click('.modal button:has-text("Fail this item")'); await wait(300);
  check('sent back: in rework, ready mark kept in history, notice "QC sent back · serial"', (await ev((id) => qcStatus(build(id)) === 'In rework' && !build(id).readyFinal && build(id).readyHistory.length === 1, ORDER)) && (await ev(() => taNoticesFor('qc')[0].title)) === `QC sent back · ${orderSerial}` && (await toastText()) === `Final QC sent ${orderSerial} back to be fixed.`, await ev(() => taNoticesFor('qc')[0].body));
  check('sign-off is blocked and the panel says so in Turbo Assist\'s words', (await text('.tp-final .tp-state')) === '1 open failure. QC fixes them, then marks the building ready for final certification again.' && (await text('.tp-final .panelhead .pill')) === '1 uncorrected' && (await p.locator('button:has-text("Sign off as")').count()) === 0);
  check('that item now reads "Open failure", its section "Submitted · 1 open failure"', await ev((item) => { document.querySelector('.tp-all').open = true; const secs = [...document.querySelectorAll('.tp-sec')]; const sec = secs.find((s) => s.querySelector('summary span').textContent === 'Submitted · 1 open failure'); return !!sec && [...sec.querySelectorAll('.tp-res')].filter((x) => x.textContent === 'Open failure').length === 1; }, failItem));
  // the correction
  await ev((id) => openBuild(id), ORDER); await wait(300);
  check('rework card: "Open failure", the part of the building, "Failed again at final QC", tag "QC failure"', (await text('.qc-rework .tp-rwx .pillrow')).startsWith('Open failure') && (await text('.qc-rework .tp-rwx .pillrow')).includes('Failed again at final QC') && (await text('.qc-rework .tp-rwx .pillrow')).includes('QC failure'), await text('.qc-rework .tp-rwx .pillrow'));
  await p.click('.qc-rework button:has-text("Mark as fixed")'); await wait(250);
  check('fix form asks "What was done to correct this"', (await p.getAttribute('#tp-fix', 'placeholder')) === 'What was done to correct this');
  await p.fill('#tp-fix', 'Re-set the trim and sealed it'); await p.click('.modal .qc-pick button >> nth=1'); await wait(300);
  check('corrective action kept on the failure, state "Correction submitted"', (await text('.qc-rework .tp-fix')) === 'Corrective action. Re-set the trim and sealed it' && (await text('.qc-rework .tp-rwx .pillrow')).startsWith('Correction submitted'));
  // tags and the failure email
  await p.click('.qc-rework button:has-text("Tags")'); await wait(200);
  check('eleven starter tags, "QC failure" on', (await p.locator('.tp-tagpick .chipbtn').count()) === 11 && (await p.$$eval('.tp-tagpick .chipbtn.on', (e) => e.map((x) => x.textContent))).join() === 'QC failure');
  await p.click('.tp-tagpick .chipbtn:has-text("Cosmetic")'); await p.click('.modal button:has-text("Save tags")'); await wait(250);
  check('tags saved on the failure', (await text('.qc-rework .tp-rwx .pillrow')).includes('Cosmetic'));
  await p.click('.qc-rework button:has-text("Failure email")'); await wait(250);
  check('failure email subject: "QC failure · serial · plant · customer"', (await text('#tp-subj-out')) === `QC failure · ${orderSerial} · ShedCor plant · Morgan Avery`, await text('#tp-subj-out'));
  await p.fill('#tp-subj', 'Failed: {{item}} / {{category}} / {{model}} / {{nothing}}'); await wait(150);
  check('subject tags fill in live; an unknown tag is left alone', /^Failed: .+ \/ .+ \/ \d+x\d+ .+ \/ \{\{nothing\}\}$/.test(await text('#tp-subj-out')), await text('#tp-subj-out'));
  check('a missing value prints as a dash', await ev(() => tpSubject('QC failure · {{serial}} · {{plant}} · {{customer}}', { serial: 'ORB-00001', plant: 'ShedCor plant', customer: '' }) === 'QC failure · ORB-00001 · ShedCor plant · —'));
  check('seven tags listed with their labels', (await p.locator('.tp-tags span').count()) === 7 && (await text('.tp-tags')).includes('{{category}} Section'));
  await p.click('.modal button:has-text("Use the standard subject")'); await wait(200); await p.click('.modal button:has-text("Done")'); await wait(200);
  await p.click('.qc-rework button:has-text("Re-inspection passed")'); await wait(300);
  check('re-inspection passed: back to waiting on sign-off', (await ev((id) => qcStatus(build(id)), ORDER)) === 'Needs sign-off');
  // final QC pass, with initials
  await ev((id) => { Q.signSerial = id; go('qc-signoff'); }, ORDER); await wait(300);
  check('the fixed item reads "Failed, then fixed", its section "Submitted · failures corrected"', await ev(() => { document.querySelector('.tp-all').open = true; return [...document.querySelectorAll('.tp-sec li .tp-res')].filter((x) => x.textContent === 'Failed, then fixed').length === 1 && [...document.querySelectorAll('.tp-sec summary span')].some((x) => x.textContent === 'Submitted · failures corrected'); }));
  check('state without a ready mark: "QC passed this building. It is waiting on final QC."', (await text('.tp-final .tp-state')) === 'QC passed this building. It is waiting on final QC.');
  await p.click('button:has-text("Sign off as")'); await wait(250);
  check('sign-off asks for initials, filled in from the name', (await p.inputValue('#tp-initials')) === 'RC' && (await text('.modal .tp-initials')).startsWith('Sign final QC with my initials'));
  await p.fill('#tp-initials', 'x'); await p.click('.modal button:has-text("Yes, sign it off")'); await wait(200);
  check('one initial is refused', (await toastText()) === 'Sign with two to four initials.' && (await ev((id) => qcStatus(build(id)), ORDER)) === 'Needs sign-off' && (await p.locator('.modal').count()) === 1);
  await p.fill('#tp-initials', 'a.b'); await p.click('.modal button:has-text("Yes, sign it off")'); await wait(400);
  const signed = await ev((id) => { const b = build(id); return { status: qcStatus(b), text: b.signoff.text, initials: b.signoff.initials, log: Q.log.filter((l) => l.serial === id).map((l) => l.text), hist: PR.hist[id].at(-1), phase: prUnit(id).phase }; }, ORDER);
  check('signed: "Final QC Passed - Checked by AB"', signed.status === 'Ready to ship' && signed.text === 'Final QC Passed - Checked by AB' && signed.initials === 'AB' && signed.log.includes('Final QC Passed - Checked by AB'), signed.text);
  check('the board moves it to Build complete with that line in its history', signed.phase === 8 && signed.hist.note === 'Final QC Passed - Checked by AB' && signed.hist.to === 8);
  const n1 = await ev(() => ({ sales: taNoticesFor('sales'), office: taNoticesFor('office'), logi: taNoticesFor('logi'), prod: taNoticesFor('prod') }));
  const want = `Ready for delivery · ${orderSerial}`, body = `${orderSerial} passed final QC and is ready for delivery. Final QC by Riley Carter.`;
  check('notice to the Office', n1.office.length === n0.office + 1 && n1.office[0].title === want && n1.office[0].body === body, n1.office[0]?.title);
  check('notice to Logistics', n1.logi.length === n0.logi + 1 && n1.logi[0].title === want && n1.logi[0].body === body, n1.logi[0]?.title);
  check('notice to the Sales desk (its own lot\'s order)', n1.sales.length === n0.sales + 1 && n1.sales[0].title === want && n1.sales[0].go === `openSale('${ORDER}')`, n1.sales[0]?.title);
  check('Production bell: "serial marked build complete"', n1.prod[0].title === `${orderSerial} marked build complete`, n1.prod[0].title);
  check('signed panel shows the sign-off line', (await text('.tp-final .tp-state')) === 'Final QC Passed - Checked by AB' && (await text('.tp-final .panelhead .pill')) === 'Ready for delivery');
  await ev((id) => prOpen(id), ORDER); await wait(300);
  check('materials were issued at final QC', (await text('.tp-bom')).includes('Consumed when this building reached final QC') && (await ev((id) => TP.issued[id].length > 5 && TP.issued[id].every((x) => x.note === 'Consumed when this building reached final QC.'), ORDER)));
  check('the order is on the labor pay list (Build complete is the pay trigger)', await ev((id) => (TP.pay[id] || []).some((x) => x.phase === 8), ORDER));
  check('a sample record signed off earlier keeps Turbo Assist\'s plain sentence', await ev(() => tpFinalState(build('SAMPLE-1428-1012')) === 'Final QC passed this building. It is ready to ship.'));
  check('signing off without the form uses the signer\'s initials', await ev(() => { const b = build('SAMPLE-1232-1008'); Q.signSerial = b.serial; doSignoff(); return b.signoff.text === 'Final QC Passed - Checked by RC'; }));
  check('a stock building notifies the Office and Logistics, not the Sales desk', await ev(() => taNoticesFor('office')[0].title === 'Ready for delivery · ' + tpSerial('SAMPLE-1232-1008') && taNoticesFor('logi')[0].title === taNoticesFor('office')[0].title && !taNoticesFor('sales').some((n) => n.title.includes(tpSerial('SAMPLE-1232-1008')))));
  check('ready-for-certification errors are Turbo Assist\'s', await ev(() => { const out = []; tpReadyFinal('SAMPLE-1428-1012'); out.push(document.getElementById('toast').textContent); tpReadyFinal('SAMPLE-1016-1001'); out.push(document.getElementById('toast').textContent); tpReadyFinal('SAMPLE-1024-1011'); out.push(document.getElementById('toast').textContent); return out.join(' | '); }) === 'Final QC already passed this building. | Submit the inspection before marking it ready for final certification. | Submit the inspection before marking it ready for final certification.');

  console.log('\n== 6. A failure: photos, severity, required settings ==');
  await ev(() => openBuild('SAMPLE-1016-1001')); await wait(300);
  const item = await ev(() => { const b = build('SAMPLE-1016-1001'); return itemsFor(b).find((i) => needsPhoto(i.id)).id; });
  await p.click(`#row-${item} .qc-ans button.fail`); await wait(250);
  check('"No" shows Turbo Assist\'s word "Failed" and the severity choices', (await text(`#row-${item} .tp-res`)) === 'Failed' && (await p.$$eval(`#row-${item} .tp-sev .chipbtn`, (e) => e.map((x) => x.textContent))).join('|') === 'Informational|Minor|Moderate|Major|Critical');
  await p.click(`#row-${item} .qc-ans button.na`); await wait(200);
  check('"N/A" shows "Not applicable"', (await text(`#row-${item} .tp-res`)) === 'Not applicable');
  await p.click(`#row-${item} .qc-ans button.fail`); await wait(200);
  await p.click(`#row-${item} .tp-sev .chipbtn:has-text("Major")`); await wait(200);
  check('needs a defect type, a note and a photo while both are required', (await text(`#miss-${item}`)) === 'Still needed: a defect type, a note, a photo.', await text(`#miss-${item}`));
  check('no "Add photo" until the first photo is in', (await p.locator(`#more-${item}`).count()) === 0);
  await p.setInputFiles(`#photo-${item}`, { name: 'one.png', mimeType: 'image/png', buffer: PNG }); await wait(500);
  check('first photo in: "1 of 3 photos" and Add photo', (await text(`#row-${item} .tp-photos`)).includes('1 of 3 photos') && (await p.locator(`#more-${item}`).count()) === 1);
  await p.setInputFiles(`#more-${item}`, { name: 'two.png', mimeType: 'image/png', buffer: PNG }); await wait(500);
  await p.setInputFiles(`#more-${item}`, { name: 'three.png', mimeType: 'image/png', buffer: PNG }); await wait(500);
  check('three photos is the cap: "3 photos", no more Add photo', (await ev((id) => { const a = draftOf(build('SAMPLE-1016-1001')).answers[id]; return (a.photo ? 1 : 0) + a.more.length; }, item)) === 3 && (await text(`#row-${item} .tp-photos`)).endsWith('3 photos') && (await p.locator(`#more-${item}`).count()) === 0);
  check('a fourth is refused', await ev((id) => { const a = draftOf(build('SAMPLE-1016-1001')).answers[id]; tpAddPhoto(id, { files: [new Blob(['x'])] }); return a.more.length === 2 && document.getElementById('toast').textContent === '3 photos'; }, item));
  // settings
  await ev(() => go('qc-report')); await wait(300);
  await p.uncheck('#tp-set-notes'); await wait(200);
  check('Failure notes required off: a note is no longer needed', await ev((id) => missing(draftOf(build('SAMPLE-1016-1001')).answers[id], id).join() === 'a defect type', item));
  await p.uncheck('#tp-set-photos'); await wait(200);
  check('Failure photos required off: a photo is no longer needed', await ev((id) => { const a = { r: 'fail', defect: 'Gap or poor fit' }; return missing(a, id).length === 0; }, item));
  await p.check('#tp-set-photos'); await wait(150);
  // finish the inspection: every other question Yes, this one No with no note
  await ev((id) => { const b = build('SAMPLE-1016-1001'), d = draftOf(b); for (const i of itemsFor(b)) if (i.id !== id) d.answers[i.id] = { r: 'pass' }; d.answers[id].defect = 'Gap or poor fit'; openBuild(b.serial); }, item); await wait(300);
  await p.click('.qc-bar .primary'); await wait(400);
  const rwk = await ev(() => { const r = Q.rework.filter((x) => x.serial === 'SAMPLE-1016-1001').at(-1); return r && { severity: r.severity, photos: (r.photos || []).length, note: r.note, tags: r.tags, status: qcStatus(build(r.serial)) }; });
  check('sent to rework with no note, no crash; severity and extra photos carried over', !!rwk && rwk.status === 'In rework' && rwk.severity === 'Major' && rwk.photos === 2 && rwk.note === '' && rwk.tags.join() === 'QC failure', JSON.stringify(rwk));
  check('rework card shows the severity and "Failure images (3)"', (await text('.qc-rework .tp-rwx')).includes('Major') && (await text('.qc-rework .tp-rwx')).includes('Failure images (3)'));
  await ev(() => { TP.qc.notes = true; go('qc-rework'); }); await wait(300);
  check('Rework screen names the Correction checklist', (await text('.tp-queue')).startsWith('Correction checklist. Only the open failures from the original report.'));
  check('with nothing open it says "Nothing left to correct."', await ev(() => { const keep = Q.rework; Q.rework = keep.map((r) => ({ ...r, step: 2, closedAt: Date.now(), closedBy: 'Test' })); const html = reworkQueue(); Q.rework = keep; return html.includes('<b>Nothing left to correct.</b>'); }));

  console.log('\n== 7. QC Dashboard against the sample data ==');
  await ev(() => go('qc-report')); await wait(300);
  const dash = await ev(() => {
    const st = (b) => qcStatus(b), day = (t) => new Date(t).toISOString().slice(0, 10), now = new Date(), today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const all = allDefects(), days = Array.from({ length: 7 }, (_, i) => day(today - (6 - i) * 864e5)), prior = Array.from({ length: 7 }, (_, i) => day(today - (13 - i) * 864e5));
    const perDay = days.map((d) => all.filter((x) => day(x.openedAt) === d).length), last = perDay.reduce((a, b) => a + b, 0), before = all.filter((x) => prior.includes(day(x.openedAt))).length;
    const units = new Set(all.filter((x) => days.includes(day(x.openedAt))).map((x) => x.serial)).size;
    const month = all.filter((x) => x.openedAt >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) && x.openedAt < today + 864e5), count = (key) => Object.entries(month.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const reports = Q.builds.filter((b) => b.results[QC] && openRework(b).length);
    return { final: Q.builds.filter((b) => st(b) === 'Needs sign-off').length, awaiting: Q.builds.filter((b) => ['Ready for QA', 'In QA'].includes(st(b))).length, perDay, last, before, perUnit: units ? Math.round((last / units) * 10) / 10 : null, items: count('item'), groups: count('section'), total: all.length, reports: reports.length, defects: reports.reduce((t, b) => t + openRework(b).length, 0) };
  });
  check('Awaiting final QC count', (await text('.tp-fold >> nth=0 >> summary h3')) === `Awaiting final QC ${dash.final}`, await text('.tp-fold >> nth=0 >> summary h3'));
  check('Awaiting QC count and rows', (await text('.tp-fold >> nth=1 >> summary h3')) === `Awaiting QC ${dash.awaiting}` && (await p.locator('#tp-awaiting .tp-drow').count()) === dash.awaiting);
  check('an inspection in progress reads "Not submitted" with "Open"; the rest "Final QA" with "Inspect"', await ev(() => [...document.querySelectorAll('#tp-awaiting .tp-drow')].every((r) => { const stage = r.children[1].textContent, btn = r.querySelector('button').textContent; return (stage === 'Not submitted' && btn === 'Open') || (stage === 'Final QA' && btn === 'Inspect'); })));
  await p.fill('.tp-fold >> nth=1 >> input', 'zzz-nothing'); await wait(150);
  check('filter with no match: "Nothing is waiting."', (await text('#tp-awaiting')) === 'Nothing is waiting.');
  await p.fill('.tp-fold >> nth=1 >> input', ''); await wait(150);
  check('Failures table: first page of 8, newest first, total matches', (await p.locator('.tp-table tbody tr').count()) === Math.min(8, dash.total) && (await text('.tp-pager span')) === `Page 1 of ${Math.ceil(dash.total / 8)} · ${dash.total} failures`, await text('.tp-pager span'));
  check('table columns: Group, Item, Serial, Model, Inspector, When, Status', (await p.$$eval('.tp-table th', (e) => e.map((x) => x.textContent))).join('|') === 'Group|Item|Serial|Model|Inspector|When|Status');
  await p.click('#tp-failures button:has-text("Statistics")'); await wait(250);
  const delta = dash.last - dash.before;
  const trend = `${dash.last} in the last 7 days${delta === 0 ? '' : delta > 0 ? ` · ${delta} more than the 7 days before` : ` · ${Math.abs(delta)} fewer than the 7 days before`}${dash.perUnit != null ? ` · ${dash.perUnit} per inspected unit` : ''}`;
  check('trend sentence', (await text('.tp-trend')) === trend, await text('.tp-trend'));
  check('seven day cells with the right counts', (await p.$$eval('.tp-daycell b', (e) => e.map((x) => Number(x.textContent)))).join() === dash.perDay.join(), dash.perDay.join());
  await p.click('#tp-failures button:has-text("This month")'); await wait(250);
  const leadItems = dash.items.length === 1 || (dash.items.length > 1 && dash.items[0][1] > dash.items[1][1]), leadGroups = dash.groups.length === 1 || (dash.groups.length > 1 && dash.groups[0][1] > dash.groups[1][1]);
  if (leadItems || leadGroups) {
    check('This month: top three failure modes', (await p.$$eval('.tp-leaders > div >> nth=0 >> li', (e) => e.map((x) => x.textContent))).join('|') === dash.items.slice(0, 3).map(([l, n]) => `${l} · ${n}`).join('|'), dash.items.slice(0, 3).map(([l, n]) => `${l} · ${n}`).join(' | '));
    check('This month: top three failure groups', (await p.$$eval('.tp-leaders > div >> nth=1 >> li', (e) => e.map((x) => x.textContent))).join('|') === dash.groups.slice(0, 3).map(([l, n]) => `${l} · ${n}`).join('|'), dash.groups.slice(0, 3).map(([l, n]) => `${l} · ${n}`).join(' | '));
  } else check('This month has a tie for first: "No statistical Failure Leaders"', (await text('.tp-noleader')) === 'No statistical Failure Leaders');
  check('tie rule: a tie for first is not a leader; one entry is', await ev(() => { const t = Date.now(), s = (item, group) => ({ at: t, item, group }); const tie = tpLeaders([s('A', 'G1'), s('B', 'G2')], 'today'), one = tpLeaders([s('A', 'G1')], 'today'), lead = tpLeaders([s('A', 'G1'), s('A', 'G1'), s('B', 'G2')], 'today'), none = tpLeaders([], 'today'); return !tie.hasLeader && one.hasLeader && lead.hasLeader && lead.modes[0][0] === 'A' && lead.modes[0][1] === 2 && !none.hasLeader; }));
  check('leader windows: week starts Monday, month on the 1st', await ev(() => { const now = new Date(Date.UTC(2026, 10, 15, 15)); /* Sunday 15 Nov 2026 */ const s = (iso, item) => ({ at: Date.parse(iso), item, group: 'G' }); const stamps = [s('2026-11-15T10:00:00Z', 'today'), s('2026-11-09T10:00:00Z', 'monday'), s('2026-11-08T23:00:00Z', 'lastweek'), s('2026-11-01T00:00:00Z', 'first'), s('2026-10-31T23:00:00Z', 'october')]; const names = (w) => tpLeaders(stamps, w, now).modes.map((x) => x[0]).sort().join(); const month = tpLeaders(stamps.concat(s('2026-11-02T00:00:00Z', 'a'), s('2026-11-02T00:00:00Z', 'b')), 'month', now); return names('today') === 'today' && names('week') === 'monday,today' && !tpLeaders(stamps, 'month', now).modes.some((x) => x[0] === 'october') && month.modes.length === 3; }));
  check('trend maths: last 7 days, the 7 before, per inspected unit', await ev(() => { const now = new Date(Date.UTC(2026, 10, 15, 15)), s = (iso, serial) => ({ at: Date.parse(iso), serial }); const t = tpTrends([s('2026-11-15T01:00:00Z', 'A'), s('2026-11-15T02:00:00Z', 'A'), s('2026-11-09T00:00:00Z', 'B'), s('2026-11-08T23:59:00Z', 'C'), s('2026-11-02T00:00:00Z', 'D'), s('2026-11-01T23:59:00Z', 'E')], now); return t.last === 3 && t.prior === 2 && t.perUnit === 1.5 && t.perDay.length === 7 && t.perDay[6].count === 2 && t.perDay[0].day === '2026-11-09' && t.perDay[0].count === 1; }));
  await ev(() => { TP.dash.open.reports = true; go('qc-report'); }); await wait(300);
  check('Open reports sentence and rows', (await text('.tp-fold >> nth=3 >> p >> nth=0')) === `${dash.reports} submitted ${dash.reports === 1 ? 'report' : 'reports'} still have uncorrected failures · ${dash.defects} open ${dash.defects === 1 ? 'defect' : 'defects'}` && (await p.locator('#tp-reports .tp-drow').count()) === dash.reports, await text('.tp-fold >> nth=3 >> p >> nth=0'));
  check('dashboard title and subtitle are Turbo Assist\'s', (await text('.tp-dash h2')) === 'QC Dashboard' && (await text('.tp-dash > .muted')) === 'What is waiting, what failed, and which submitted reports still need a correction.');
  check('the old report is still below it', (await text('#app')).includes('Failures by part of the building') && (await p.locator('.today .kpi').count()) === 4);
  await p.screenshot({ path: SHOTS + 't-dashboard.png', fullPage: true });

  console.log('\n== 8. Serial status ==');
  const S_ = await ev(() => { const s = (id) => tpSerial(id) || id; return {
    empty: taSerialStatus('  ').text, missing: taSerialStatus('ZZZ-99999'),
    passed: [taSerialStatus('SAMPLE-1428-1012').text, `${s('SAMPLE-1428-1012')} passed final QC and is ready for delivery. Pipeline: Build complete.`],
    passedBySerial: [taSerialStatus(tpSerial('SAMPLE-1428-1012').toLowerCase()).text, `${s('SAMPLE-1428-1012')} passed final QC and is ready for delivery. Pipeline: Build complete.`],
    failures: [taSerialStatus('SAMPLE-1024-1011').text, `${s('SAMPLE-1024-1011')} has open QC failures. Pipeline: Final QA.`],
    open: [taSerialStatus('SAMPLE-1012-1006').text, `${s('SAMPLE-1012-1006')} has an inspection in progress. Pipeline: Final QA.`],
    none: [taSerialStatus('sample-1228-3007').text, `${s('SAMPLE-1228-3007')} is in production and has not started QC. Pipeline: ${phaseNames[prUnit('SAMPLE-1228-3007').phase]}.`],
    waiting: (() => { const b = build('SAMPLE-1220-1002'); b.results[QC] = { result: 'pass', firstPass: true, by: 'Test', at: Date.now() }; return [taSerialStatus('SAMPLE-1220-1002').text, `${s('SAMPLE-1220-1002')} finished inspection and is waiting on final QC. Pipeline: Final QA.`]; })(),
    yard: [taSerialStatus('SAMPLE-1224-2101').text, 'SAMPLE-1224-2101 passed final QC and is ready for delivery. Pipeline: not on a production phase.'],
    lot: taSerialStatus(lots[0].id), received: taSerialStatus('STOCK-4').text, shape: Object.keys(taSerialStatus('SAMPLE-1428-1012')).sort().join(),
  }; });
  check('nothing typed: "Enter a serial."', S_.empty === 'Enter a serial.');
  check('unknown: "No building is filed under ZZZ-99999."', S_.missing.found === false && S_.missing.text === 'No building is filed under ZZZ-99999.');
  for (const [k, label] of [['passed', 'passed final QC'], ['passedBySerial', 'found by plant serial, any letter case'], ['failures', 'open QC failures'], ['open', 'inspection in progress'], ['none', 'in production, not started QC'], ['waiting', 'waiting on final QC'], ['yard', 'finished stock not on a phase']])
    check(`sentence: ${label}`, S_[k][0] === S_[k][1], S_[k][0]);
  check('a building on the lot is found', S_.lot.found && /passed final QC and is ready for delivery\. Pipeline: not on a production phase\.$/.test(S_.lot.text), S_.lot.text);
  check('an order still in Order received', /is in production and has not started QC\. Pipeline: Order received\.$/.test(S_.received), S_.received);
  check('result has found and text (plus serial, id, phase)', /found/.test(S_.shape) && /text/.test(S_.shape), S_.shape);
  await ev(() => go('qc')); await wait(300);
  // Plant batch 1 (Nov 16): the second "Look up a serial" box is gone from QC Buildings; the one search covers it.
  check('QC Buildings has one search and no lookup box', (await p.locator('.tp-lookup').count()) === 0 && (await p.locator('#floor-search').count()) === 1);
  await p.fill('#floor-search', 'SAMPLE-1024-1011'); await wait(200);
  check('the search finds the building by its order number', (await p.locator('.qc-card').count()) === 1);
  await p.fill('#floor-search', 'STOCK-4'); await wait(200);
  check('a building not at QC yet: the search says where it is', (await text('#floorlist .pg-where')) === S_.notStarted || /Order received/.test(await text('#floorlist .pg-where')), await text('#floorlist'));
  await p.fill('#floor-search', ''); await wait(150);
  check('Logistics can ask plant QC for an update', await ev(() => { const n = taNoticesFor('qc').length; taQcStatusAsk('SAMPLE-1024-1011'); const top = taNoticesFor('qc')[0]; return taNoticesFor('qc').length === n + 1 && top.title === 'QC status requested · ' + tpSerial('SAMPLE-1024-1011') && top.body.startsWith('Logistics asked for a status update on ' + tpSerial('SAMPLE-1024-1011') + '. '); }));

  console.log('\n== 9. Shipped from plant, notes pages ==');
  const ship = await ev(() => { const id = 'SAMPLE-1428-1012'; lgSync(); const load = lgMakeLoad('haul', { type: 'plant', id: PLANTS[0].id }, [id]); load.rigId = 'rig-1'; load.driver = 'Test Driver'; let d = lgAddDays(lgToday(), 1); while (!lotDay(lotById(lgUnit(id).lotId), d).open) d = lgAddDays(d, 1); load.date = d; lgSchedule(load.id); for (const u of load.stops.flatMap((s) => s.units)) lgUnit(u).told = true; lgStart(load.id); render(); return { state: lgLoad(load.id).state, at: lgUnit(id).at, onBoard: !!prUnit(id), shipped: !!TP.shipped[id], notice: taNoticesFor('prod')[0].title, want: tpSerial(id) + ' shipped from plant' }; });
  check('when the truck leaves, the building is off the board and marked shipped', ship.state === 'in_transit' && !ship.onBoard && ship.shipped && ship.notice === ship.want, JSON.stringify(ship));
  await ev(() => { PR.id = 'SAMPLE-1428-1012'; go('pr-unit'); }); await wait(300);
  check('its page: "Shipped … Delivery is not required to leave the board."', (await text('.tp-ship')).includes('Delivery is not required to leave the board.') && (await text('.tp-ship .pill')) === 'Shipped');
  await ev(() => go('pr-notes')); await wait(250);
  check('Production notes page lists what was added', (await text('#app')).includes('Added from Turbo Assist') && (await text('#app')).includes('Plant serials are made up') && !(await text('#app')).includes('The order number stands in for'));
  await ev(() => go('qc-notes')); await wait(250);
  check('Plant QC notes page lists what was added and what differs', (await text('#app')).includes('From Turbo Assist') && (await text('#app')).includes('Different from Turbo Assist'));
  await ev(() => { S.opsNotes = true; go('prod'); }); await wait(300);
  check('board product notes name the Turbo Assist functions, without the old serial line', (await text('.ops-notes')).includes('issueSerialForBuildStart') && (await text('.ops-notes')).includes('closeOrgProductionLoad') && !(await text('.ops-notes')).includes('The order number shown as the serial'));
  await ev(() => prOpen('SAMPLE-1016-3006')); await wait(300);
  check('unit product notes: "Not drawn here" is gone, the new sections are named', !(await text('.ops-notes')).includes('Not drawn here') && (await text('.ops-notes')).includes('unitCanShipFromPlant') && (await text('.ops-notes')).includes('consumeUnitOnFinalQc'));
  await ev(() => { S.opsNotes = false; });

  console.log('\n== 10. Phone width (390 px): no sideways scroll ==');
  await p.setViewportSize({ width: 390, height: 844 });
  const wide = async (name) => { await wait(250); const o = await ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); check(`390 px: ${name}`, o.sw <= o.cw, `${o.sw} of ${o.cw}`); };
  for (const pg of ['prod', 'pr-list', 'pr-phases', 'pr-notes', 'qc', 'qc-rework', 'qc-signoff', 'qc-report', 'qc-changes', 'qc-notes']) { await ev((x) => { Q.signSerial = null; go(x); }, pg); await wide(pg); }
  await p.screenshot({ path: SHOTS + 't-phone-report.png', fullPage: true });
  await ev(() => { TP.dash.view = 'stats'; go('qc-report'); }); await wide('qc-report, statistics');
  await ev(() => prOpen('SAMPLE-1016-3006')); await wide('pr-unit, in production');
  await p.screenshot({ path: SHOTS + 't-phone-unit.png', fullPage: true });
  await ev(() => prOpen('AA-20411')); await wide('pr-unit, built customer order');
  await ev(() => prOpen('STB-3102')); await wide('pr-unit, Order received');
  await ev(() => openBuild('SAMPLE-1016-1001')); await wide('qc-inspect, in rework');
  await ev(() => openBuild('SAMPLE-1220-1002')); await wide('qc-inspect, passed');
  await ev(() => { const b = build('SAMPLE-810-1007'); openBuild(b.serial); const i = itemsFor(b).find((x) => needsPhoto(x.id)); answer(i.id, 'fail'); }); await wide('qc-inspect, a failure being written up');
  await p.screenshot({ path: SHOTS + 't-phone-fail.png', fullPage: false });
  await ev(() => { Q.signSerial = 'AA-20411'; go('qc-signoff'); document.querySelector('.tp-all').open = true; }); await wide('qc-signoff detail, signed');
  await ev(() => { Q.signSerial = 'SAMPLE-1220-1002'; go('qc-signoff'); }); await wide('qc-signoff detail, waiting');
  await p.click('button:has-text("Sign off as")'); await wide('sign-off form with initials'); await ev(() => closeModal());
  await ev(() => { go('prod'); tpRequestForm(); }); await wide('inventory request form'); await ev(() => closeModal());
  await ev(() => { go('prod'); prLoadForm('B'); }); await wide('load form with footage note'); await ev(() => closeModal());
  await ev(() => { go('qc-rework'); tpMail(Q.rework[0].id); }); await wide('failure email'); await ev(() => closeModal());
  await ev(() => { tpTagsForm(Q.rework[0].id); }); await wide('tags'); await ev(() => closeModal());
  await ev(() => { go('qc'); }); await p.fill('#floor-search', 'STOCK-4'); await wait(200); await wide('search that says where a building is'); await p.fill('#floor-search', ''); await wait(100);
  await p.setViewportSize({ width: 1360, height: 950 });

  check('no console or page errors', errs.length === 0, errs.slice(0, 4).join(' || '));
  console.log(`\n${passes} passed, ${fails} failed`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL  the walk stopped: ' + e.message.split('\n')[0]); process.exit(1); });
