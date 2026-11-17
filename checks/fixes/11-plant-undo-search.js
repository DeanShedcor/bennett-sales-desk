// Plant batch 1: loads ask first and can be opened again, undo on moves, send back from the QC check,
// settings permission, failures shown to the crew, plant serial first, one search, no empty loads,
// "Yes to the other N" asks first, note box first and who moved it.
// node fix11.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async () => {
    const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300);
    return p;
  };
  const w = (p, ms = 300) => p.waitForTimeout(ms);
  const said = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  const mtext = (p) => p.locator('.modal').innerText().catch(() => '');
  const quiet = async (p) => { await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; }); };
  const shot = async (p, name, opt) => { if (!PIC) return; await quiet(p); await w(p, 200); await p.screenshot({ path: `${PIC}-${name}.png`, ...(opt || {}) }); };

  /* ---------- Loads ---------- */
  {
    const p = await open();
    await p.evaluate(() => go('prod')); await w(p);
    await p.locator('.pr-load:has-text("Florence and Lugoff") button:has-text("Close")').click(); await w(p);
    let m = await mtext(p);
    ok('1 closing a load with unfinished buildings asks first', /Close load A\?/.test(m) && /2 of its 2 buildings are not finished yet/.test(m), m);
    await shot(p, 'load-ask', { clip: { x: 230, y: 120, width: 900, height: 560 } });
    await p.click('.modal button:has-text("Keep it open")'); await w(p);
    ok('1 "Keep it open" leaves the load on the board', await p.evaluate(() => PR.loads.some((l) => l.id === 'A') && !TP.closedLoads.length));
    await p.locator('.pr-load:has-text("Florence and Lugoff") button:has-text("Close")').click(); await w(p);
    await p.click('.modal button:has-text("Close the load")'); await w(p);
    ok('1 "Close the load" closes it', await p.evaluate(() => !PR.loads.some((l) => l.id === 'A') && TP.closedLoads.length === 1 && TP.closedLoads[0].closedBy === 'Super user A'));
    ok('2 closing a load offers Undo', await p.locator('#pg-undo').count() === 1);
    await p.click('#pg-undo button'); await w(p);
    ok('2 Undo puts the closed load back as it was', await p.evaluate(() => { const l = PR.loads.find((x) => x.id === 'A'); return !!l && l.state === 'dispatched' && l.units.length === 2 && !TP.closedLoads.length; }));
    await p.evaluate(() => tpLoadClose('A', true)); await w(p);
    await p.click('.pg-closed summary'); await w(p);
    const row = await p.locator('.pg-closedrow').first().innerText();
    ok('2 the closed list names the load, who closed it, and offers "Open again"', /Florence and Lugoff/.test(row) && /closed/.test(row) && /Super user A/.test(row) && /Open again/.test(row), row);
    await p.click('.pg-closedrow button:has-text("Open again")'); await w(p);
    ok('2 "Open again" brings a closed load back', await p.evaluate(() => PR.loads.some((l) => l.id === 'A' && l.state === 'dispatched')) && /open again/.test(await said(p)));
    // remove
    await p.locator('.pr-load:has-text("North Carolina run") button:has-text("Change")').click(); await w(p);
    await p.click('.modal button:has-text("Remove this load")'); await w(p);
    m = await mtext(p);
    ok('1 removing a load asks first, in plain words', /Remove load B\?/.test(m) && /will not be on a load any more/.test(m) && /marked removed/.test(m), m);
    await p.click('.modal button:has-text("Keep the load")'); await w(p);
    ok('1 "Keep the load" keeps it', await p.evaluate(() => PR.loads.some((l) => l.id === 'B')));
    await p.evaluate(() => prLoadForm('B')); await w(p);
    await p.click('.modal button:has-text("Remove this load")'); await w(p);
    await p.click('.modal button:has-text("Remove the load")'); await w(p);
    ok('1 a removed load is kept in the closed list, marked removed', await p.evaluate(() => { const l = TP.closedLoads.find((x) => x.id === 'B'); return !PR.loads.some((x) => x.id === 'B') && !!l && l.removed && l.units.length === 2; }));
    const flags = await p.evaluate(() => prFlags(prUnit('SAMPLE-1220-3001')).replace(/<[^>]+>/g, ' '));
    ok('1 its buildings say they lost their load', /Load B was removed\. Not on a load\./.test(flags) && await p.evaluate(() => PR.hist['SAMPLE-1220-3001'].some((h) => /Load B was removed/.test(h.note) && h.who === 'Super user A')), flags);
    await p.evaluate(() => { pgUndoClear(); PG.closedOpen = true; render(); }); await w(p);
    const rrow = await p.locator('.pg-closedrow:has-text("North Carolina run")').innerText();
    ok('1 the closed list shows it as Removed', /Removed/.test(rrow) && /removed/.test(rrow), rrow);
    await p.locator('.pg-closedrow:has-text("North Carolina run") button').click(); await w(p);
    ok('2 a removed load can be opened again with its buildings', await p.evaluate(() => { const l = PR.loads.find((x) => x.id === 'B'); return !!l && l.state === 'open' && l.units.length === 2 && !l.removed && !PG.lost['SAMPLE-1220-3001']; }));
    // no empty loads
    const before = await p.evaluate(() => PR.loads.length);
    await p.click('button:has-text("New load")'); await w(p);
    ok('9 "New load" opens the form and says to press Save', /Production load C/.test(await mtext(p)) && /then press Save/.test(await said(p)), await said(p));
    await p.click('.modal button:has-text("Close")'); await w(p);
    await p.evaluate(() => render()); await w(p);
    ok('9 closing the form leaves no empty load behind', await p.evaluate((n) => PR.loads.length === n && !PR.loads.some((l) => !l.units.length), before) && !/0 of 0/.test(await p.locator('.pr-loads').innerText()));
    await p.click('button:has-text("New load")'); await w(p);
    await p.locator('.pr-picklist input[type=checkbox]:not(:checked)').first().check(); await w(p, 150);
    await p.click('.modal button:has-text("Save the load")'); await w(p);
    ok('9 the load exists, and shows on the board, once Save is pressed', await p.evaluate((n) => PR.loads.length === n + 1 && PR.loads.every((l) => !l.draft && l.units.length), before) && /Load C/.test(await p.locator('.pr-loads').innerText()));
    await p.close();
  }

  /* ---------- Moves: note first, who, undo, send back ---------- */
  {
    const p = await open();
    await p.evaluate(() => prOpen('SAMPLE-1228-3007')); await w(p);
    ok('11 the note box sits above the move buttons', await p.evaluate(() => { const n = document.querySelector('#pr-note'), m = document.querySelector('.pr-move'); return !!n && !!m && !!(n.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING); }) && /Note for the next crew/.test(await p.locator('#app').innerText()));
    await p.fill('#pr-note', 'Paint is in bay 2');
    await p.locator('.pr-move button.primary').click(); await w(p);
    ok('3 a move shows Undo', await p.evaluate(() => prUnit('SAMPLE-1228-3007').phase === 5) && await p.locator('#pg-undo').count() === 1 && /Undo/.test(await p.locator('#pg-undo').innerText()));
    const hist = await p.locator('.pg-hist .log').first().innerText();
    ok('11 history says who made the move', /Super user A/.test(hist) && /Ceiling \/ finish → Paint/.test(hist) && /Paint is in bay 2/.test(hist), hist);
    await p.evaluate(() => window.scrollTo(0, 0));
    await shot(p, 'undo-move');
    await p.click('#pg-undo button'); await w(p);
    ok('3 Undo puts the building back', await p.evaluate(() => prUnit('SAMPLE-1228-3007').phase === 4) && /Put back in Ceiling \/ finish/.test(await said(p)) && await p.locator('#pg-undo').count() === 0);
    ok('3 the undo is written in the history', /Undo: moved by mistake/.test(await p.locator('.pg-hist .log').first().innerText()));
    await p.locator('.pr-move button.primary').click(); await w(p, 10700);
    ok('3 Undo goes away after 10 seconds', await p.locator('#pg-undo').count() === 0 && await p.evaluate(() => prUnit('SAMPLE-1228-3007').phase === 5));
    // into the QC check and back out with Undo
    await p.evaluate(() => prOpen('SAMPLE-1216-3009')); await w(p);
    await p.locator('.pr-move button.primary').click(); await w(p);
    ok('3 a move to the QC check puts it on the Plant QC list', await p.evaluate(() => !!build('SAMPLE-1216-3009') && prUnit('SAMPLE-1216-3009').phase === PR_QA));
    await p.click('#pg-undo button'); await w(p);
    ok('3 Undo takes it back off the Plant QC list', await p.evaluate(() => !build('SAMPLE-1216-3009') && prUnit('SAMPLE-1216-3009').phase === PR_QA - 1));
    // send back, from Production
    await p.evaluate(() => prOpen('SAMPLE-810-1007')); await w(p);
    ok('4 a building at the QC check offers "Send back to Roofing" on its Production page', await p.locator('#app button:has-text("Send back to Roofing")').count() === 1);
    await p.click('#app button:has-text("Send back to Roofing")'); await w(p);
    const m = await mtext(p);
    ok('4 the question is in plain words and asks why', /Send it back to Roofing\?/.test(m) && /by mistake/.test(m) && /Why is it going back\?/.test(m), m);
    await shot(p, 'send-back', { clip: { x: 230, y: 120, width: 900, height: 620 } });
    await p.click('.modal button:has-text("Send back to Roofing")'); await w(p);
    ok('4 it will not go back without a reason', /Say why/.test(await said(p)) && await p.evaluate(() => !!build('SAMPLE-810-1007')));
    await p.click('.modal .chipbtn:has-text("Moved here by mistake")'); await w(p, 100);
    await p.click('.modal button:has-text("Send back to Roofing")'); await w(p);
    ok('4 sent back: it is in Roofing and off the Plant QC list', await p.evaluate(() => { const u = prUnit('SAMPLE-810-1007'); return !!u && u.phase === PR_QA - 1 && !u.qc && !build('SAMPLE-810-1007'); }));
    ok('4 both histories record it, with the name and the reason', await p.evaluate(() => PR.hist['SAMPLE-810-1007'].some((h) => /Sent back from the QC check: Moved here by mistake/.test(h.note) && h.who === 'Super user A') && Q.log.some((l) => l.serial === 'SAMPLE-810-1007' && /Sent back to Roofing: Moved here by mistake/.test(l.text) && l.who === 'Super user A')));
    ok('4 it can be moved to the QC check again afterwards', await p.evaluate(() => { OG.live = true; prMove('SAMPLE-810-1007', PR_QA); OG.live = false; return !!build('SAMPLE-810-1007'); }));
    // send back, from Plant QC
    await p.evaluate(() => openBuild('SAMPLE-1024-1011')); await w(p);
    ok('4 Plant QC offers it too', /Here by mistake\?/.test(await p.locator('#app').innerText()) && await p.locator('#app button:has-text("Send back to Roofing")').count() === 1);
    await p.click('#app button:has-text("Send back to Roofing")'); await w(p);
    await p.fill('#pg-why', 'Floor was never squared'); await p.click('.modal button:has-text("Send back to Roofing")'); await w(p);
    ok('4 from Plant QC it lands back on the Buildings list, and open failures are closed as sent back', await p.evaluate(() => S.page === 'qc' && !build('SAMPLE-1024-1011') && Q.rework.filter((r) => r.serial === 'SAMPLE-1024-1011').every((r) => r.step === 2 && r.sentBack)));
    ok('4 a signed-off building cannot be sent back', await p.evaluate(() => { prOpen('SAMPLE-1428-1012'); return !/Send back to Roofing/.test(document.querySelector('#app').innerText) && pgBack('SAMPLE-1428-1012', 'x') === false; }));
    ok('4 someone without Production edit access does not get the button in Plant QC', await p.evaluate(() => { adView('u10'); openBuild('SAMPLE-1016-1001'); const t = document.querySelector('#app').innerText; adView('u1'); return !/Send back to Roofing/.test(t); }));
    await p.close();
  }

  /* ---------- Settings permission ---------- */
  {
    const p = await open();
    await p.evaluate(() => go('pr-phases')); await w(p);
    await p.locator('.tp-phase:has-text("Flooring") button:has-text("Pay the crew at this step")').click(); await w(p);
    let m = await mtext(p);
    ok('5 changing a pay step asks first', /Pay the crew when a building reaches Flooring\?/.test(m) && /written down with your name/.test(m), m);
    await p.click('.modal button:has-text("No, leave it")'); await w(p);
    ok('5 "No, leave it" changes nothing', await p.evaluate(() => !TP.phases[2].pay && !PG.log.length));
    await p.locator('.tp-phase:has-text("Flooring") button:has-text("Pay the crew at this step")').click(); await w(p);
    await p.click('.modal button:has-text("Yes, change it")'); await w(p);
    ok('5 "Yes, change it" changes it and writes down who', await p.evaluate(() => TP.phases[2].pay && PG.log[0].what === 'Pay step: Flooring' && PG.log[0].from === 'off' && PG.log[0].to === 'on' && PG.log[0].who === 'Super user A' && OG.log[0] === PG.log[0]));
    ok('5 the page lists the change', /Changes to pay steps/.test(await p.locator('#app').innerText()) && /Pay step: Flooring: off → on/.test(await p.locator('.pg-log').innerText()));
    await p.evaluate(() => { OP.setTab = 'all'; go('of-settings'); }); await w(p);
    ok('5 the Office’s Settings history lists it too', /Pay step: Flooring: off → on/.test(await p.locator('#app').innerText()));
    await p.evaluate(() => { adView('u9'); go('pr-phases'); }); await w(p);
    const t = await p.locator('#app').innerText();
    ok('5 a floor user with no Settings access sees no pay buttons, and is told why', !/Pay the crew at this step|Stop paying at this step/.test(t) && /Only a person with Settings access can change pay steps/.test(t), t.slice(0, 300));
    await shot(p, 'settings-locked', { clip: { x: 0, y: 0, width: 1360, height: 760 } });
    ok('5 and cannot change one another way', await p.evaluate(() => { tpPayToggle(3, true); return !TP.phases[3].pay; }) && /Only a person with Settings access/.test(await said(p)));
    await p.evaluate(() => { adView('u1'); PP.rulesOpen = true; go('qc'); }); await w(p);
    await p.click('#tp-set-photos'); await w(p);
    m = await mtext(p);
    ok('5 changing a QC rule asks first', /Turn off “Failure photos required”\?/.test(m) && /with no photo/.test(m), m);
    await p.click('.modal button:has-text("Close")'); await w(p);
    ok('5 closing the question leaves the rule on and the tick back', await p.evaluate(() => TP.qc.photos === true && document.getElementById('tp-set-photos').checked));
    await p.click('#tp-set-photos'); await w(p);
    await p.click('.modal button:has-text("Yes, change it")'); await w(p);
    ok('5 saying yes changes the rule and writes down who', await p.evaluate(() => TP.qc.photos === false && PG.log[0].what === 'QC rule: Failure photos required' && PG.log[0].who === 'Super user A') && /QC rule: Failure photos required: on → off/.test(await p.locator('.tp-qcset').innerText()));
    await p.evaluate(() => { adView('u10'); PP.rulesOpen = true; go('qc'); }); await w(p);
    ok('5 a QC inspector with no Settings access cannot change QC rules', await p.evaluate(() => document.getElementById('tp-set-notes').disabled && /Only a person with Settings access can change these/.test(document.querySelector('.tp-qcset').innerText) && (pgQcSet('notes', false, true), TP.qc.notes === true)));
    await p.evaluate(() => adView('u1'));
    await p.close();
  }

  /* ---------- What QC found, serial first, one search, Yes to the rest ---------- */
  {
    const p = await open();
    await p.evaluate(() => prOpen('SAMPLE-1024-1011')); await w(p);
    const f = await p.locator('.pg-fails').innerText().catch(() => '');
    ok('6 a building in rework shows what QC found on its Production page', /What the QC check found/.test(f) && /2 to fix/.test(f) && /floor square/i.test(f) && /electrical/i.test(f) && /Found by/.test(f), f);
    ok('6 each failure shows the item, the problem type and the note', await p.locator('.pg-fail').count() === 2 && await p.locator('.pg-fail .pill.red').count() === 2 && await p.evaluate(() => [...document.querySelectorAll('.pg-fail p')].every((x) => x.textContent.trim().length > 3)));
    await p.evaluate(() => document.querySelector('.pg-fails').scrollIntoView({ block: 'start' })); await p.evaluate(() => window.scrollBy(0, -90));
    await shot(p, 'failures');
    await p.evaluate(() => { go('prod'); PR.q = 'SAMPLE-1024-1011'; render(); }); await w(p);
    const card = await p.locator('.pr-card').first().innerText();
    ok('6 its board card carries a red count', /2 to fix/.test(card) && await p.locator('.pr-card .pg-fixcount.bad').count() === 1, card);
    ok('6 a failure with a photo shows the photo', await p.evaluate(() => { const r = Q.rework.find((x) => x.serial === 'SAMPLE-1024-1011'); r.photo = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; prOpen('SAMPLE-1024-1011'); return document.querySelectorAll('.pg-photos img').length === 1; }));
    // serial first
    await p.evaluate(() => { PR.q = ''; go('qc'); }); await w(p);
    const heads = await p.locator('.qc-card h3').allInnerTexts();
    ok('7 QC Buildings leads every card with the plant serial', heads.length > 5 && heads.every((h) => /^ORB-\d{5}$/.test(h.trim())), heads.slice(0, 4));
    ok('7 the order number comes second', /Order SAMPLE-/.test(await p.locator('.qc-card').first().innerText()) && !(await p.locator('.qc-card .tp-ps').count()));
    await shot(p, 'serial-first', { clip: { x: 0, y: 0, width: 1360, height: 900 } });
    await p.evaluate(() => go('qc-rework')); await w(p);
    const rw = await p.locator('.qc-bline strong').allInnerTexts();
    ok('7 Rework leads with the plant serial', rw.length > 0 && rw.every((h) => /^ORB-/.test(h.trim())), rw);
    await p.evaluate(() => { Q.signSerial = null; go('qc-signoff'); }); await w(p);
    const so = await p.locator('.qc-signrow .grow > strong').allInnerTexts();
    ok('7 Sign-off leads with the plant serial', so.length > 0 && so.every((h) => /^ORB-/.test(h.trim())), so);
    await p.evaluate(() => openBuild('SAMPLE-1012-1006')); await w(p);
    ok('7 an inspection’s heading leads with the plant serial, order number second', /ORB-01864 · order SAMPLE-1012-1006/.test(await p.locator('#app').innerText()));
    ok('7 the Report leads with the plant serial', await p.evaluate(() => { go('qc'); const t = document.querySelector('.tp-dash').innerText; return /ORB-\d{5}/.test(t) && !/^SAMPLE-/m.test(t); }));
    // one search
    await p.evaluate(() => go('qc')); await w(p);
    ok('8 the second "Look up a serial" box is gone from QC Buildings', await p.locator('.tp-lookup').count() === 0 && /serial number, order number or customer/.test(await p.getAttribute('#floor-search', 'placeholder')));
    await p.fill('#floor-search', 'orb-01851'); await w(p);
    ok('8 the search finds a building by plant serial', await p.locator('.qc-card').count() === 1 && /ORB-01851/.test(await p.locator('.qc-card h3').innerText()));
    await shot(p, 'search', { clip: { x: 0, y: 0, width: 1360, height: 820 } });
    await p.fill('#floor-search', 'SAMPLE-1012-1006'); await w(p);
    ok('8 by order number', await p.locator('.qc-card').count() === 1 && /SAMPLE-1012-1006/.test(await p.locator('.qc-card').innerText()));
    await p.fill('#floor-search', 'taylor reed'); await w(p);
    ok('8 by customer', await p.locator('.qc-card').count() === 1 && /Taylor Reed/.test(await p.locator('.qc-card').innerText()));
    await p.fill('#floor-search', 'ORB-01859'); await w(p);
    const none = await p.locator('#floorlist').innerText();
    ok('8 a building that is not at the QC check yet: the search says where it is', /No buildings match/.test(none) && /ORB-01859/.test(none) && /Open in Production/.test(none), none);
    ok('8 the serial lookup still works for the other sides', await p.evaluate(() => typeof taSerialBox === 'function' && taSerialStatus('ORB-01859').found === true));
    ok('8 a person limited to some lots still sees only their buildings while typing', await p.evaluate(() => { const u = AD.users.find((x) => x.status === 'active' && adLimited(x) && adAccess(x, 'qc') !== 'none'); if (!u) return 'no such sample person'; adView(u.id); Q.f.q = ''; const all = Q.builds.length, mine = Q.builds.filter(adSeesRec).length, shown = (floorList().match(/class="card qc-card"/g) || []).length; adView('u1'); return mine < all ? shown === mine : true; }));
    // yes to the rest
    await p.evaluate(() => { Q.f.q = ''; openBuild('SAMPLE-1220-1002'); }); await w(p);
    const btn = p.locator('.qc-rest button').first(), label = await btn.innerText(), n = Number((/other (\d+)/.exec(label) || [])[1]);
    await btn.click(); await w(p);
    const m = await mtext(p);
    ok('10 "Yes to the other N" asks first and lists the items', new RegExp(`Pass the other ${n} items in this group\\?`).test(m) && /Only do this if you looked at every one/.test(m) && (await p.locator('.modal .pg-list li').count()) === n, m.slice(0, 200));
    await shot(p, 'yes-rest', { clip: { x: 230, y: 60, width: 900, height: 800 } });
    await p.click('.modal button:has-text("No, go back")'); await w(p);
    ok('10 "No, go back" answers nothing', await p.evaluate(() => !Object.values(draftOf(build('SAMPLE-1220-1002')).answers).some((a) => a.r)));
    await btn.click(); await w(p);
    await p.click(`.modal button:has-text("Yes, pass all ${n}")`); await w(p);
    ok('10 saying yes marks them all Yes', await p.evaluate((n) => Object.values(draftOf(build('SAMPLE-1220-1002')).answers).filter((a) => a.r === 'pass').length === n, n) && await p.locator('#pg-undo').count() === 1);
    await p.click('#pg-undo button'); await w(p);
    ok('10 Undo within 10 seconds takes them back', await p.evaluate(() => !Object.values(draftOf(build('SAMPLE-1220-1002')).answers).some((a) => a.r) && !(draftOf(build('SAMPLE-1220-1002')).bulk || []).length) && /Taken back/.test(await said(p)));
    ok('every new plant button is at least 48 px tall', await p.evaluate(() => { openBuild('SAMPLE-1220-1002'); const one = document.querySelector('#app .pg-btn'); pgBackAsk('SAMPLE-1220-1002'); const hs = [...document.querySelectorAll('.pg-btn')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height); closeModal(); return !!one && hs.length >= 4 && hs.every((h) => h >= 48) ? true : JSON.stringify(hs); }) === true);
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
