// Office batch 3: ask-first steps, pricing tabs on a phone, signed-order price lock, read-only can look, reopen,
// one name per step, counts and filters, people checks, settings sections, lot prices, small polish.
// node fix10.js <url> [picture prefix]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d === undefined ? '' : typeof d === 'string' ? d : JSON.stringify(d)))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (phone) => {
    const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(L); await p.waitForTimeout(2200);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300);
    return p;
  };
  const said = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
  const txt = (p, sel = '#app') => p.locator(sel).first().innerText().catch(() => '');
  const w = (p, ms = 300) => p.waitForTimeout(ms);
  const shot = async (p, name, sel, pad = 14) => {
    if (!PIC) return;
    await w(p, 4300);
    const vw = p.viewportSize().width, vh = p.viewportSize().height;
    if (!sel) return p.screenshot({ path: `${PIC}-${name}.png` });
    await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), sel); await w(p);
    const q = await p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, sel);
    if (!q) return p.screenshot({ path: `${PIC}-${name}.png` });
    const x = Math.max(0, q.x - pad), y = Math.max(0, q.y - pad);
    await p.screenshot({ path: `${PIC}-${name}.png`, clip: { x, y, width: Math.min(vw - x, q.w + pad * 2), height: Math.min(vh - y, q.h + pad * 2) } });
  };

  // ---------- 1. Ask first, ask why, keep the record ----------
  {
    const p = await open();
    await p.evaluate(() => go('office')); await w(p);
    const before = await p.evaluate(() => { const s = ofSale('FLO-2121'); return { n: s.money.payments.length }; });
    await p.locator('#of-list button:has-text("Not received")').last().click(); await w(p);
    let m = await txt(p, '.modal');
    ok('1 “Not received” asks first', /Mark this payment not received\?/.test(m) && /not erased/.test(m), m.slice(0, 200));
    await p.click('.modal button:has-text("Mark not received")'); await w(p);
    ok('1 it will not go on without a reason', /Type the reason first/.test(await said(p)) && await p.locator('.modal').count() === 1);
    await shot(p, 'ask-first', '.modal');
    await p.fill('#op-why', 'Not in the bank deposit'); await p.click('.modal button:has-text("Mark not received")'); await w(p);
    const after = await p.evaluate(() => { const s = ofAll().find((x) => x.money?.dropped?.length); return s ? { id: s.id, n: s.money.payments.length, gone: s.money.dropped[0], log: s.events.at(-1).text } : null; });
    ok('1 the payment is kept, marked not received with the reason', after && after.gone.reason === 'Not in the bank deposit' && /not received: Not in the bank deposit/.test(after.log), after);
    await p.evaluate((id) => ofOpen(id), after.id); await w(p);
    ok('1 the order’s Money box still shows it, crossed out', /not received: Not in the bank deposit/.test(await txt(p)));
    // decline a change order and a stock order
    await p.evaluate(() => go('of-requests')); await w(p);
    await p.locator('.ops-row:has-text("Change order") button:has-text("Decline")').first().click(); await w(p);
    m = await txt(p, '.modal');
    ok('1 “Decline” on a change order asks first and asks why', /Decline change order/.test(m) && await p.locator('#op-why').count() === 1, m.slice(0, 160));
    await p.fill('#op-why', 'Already built'); await p.click('.modal button:has-text("Decline it")'); await w(p);
    await p.locator('.ops-row:has-text("Stock order") button:has-text("Decline")').first().click(); await w(p);
    await p.fill('#op-why', 'Lot is full'); await p.click('.modal button:has-text("Decline it")'); await w(p);
    const dec = await p.evaluate(() => ({ ch: S.changes.filter((c) => c.declined).map((c) => c.declineReason), st: S.stock.filter((r) => r.status === 'Declined').map((r) => r.declined.reason), n: S.stock.length }));
    ok('1 both are kept with their reasons (the stock order is not erased)', dec.ch[0] === 'Already built' && dec.st[0] === 'Lot is full' && dec.n === 5, dec);
    const page = await txt(p);
    ok('1 Requests shows a Declined list with the reasons', /Declined\s*2 kept/.test(page) && /Why: Already built/.test(page) && /Why: Lot is full/.test(page), page.slice(0, 300));
    // accept an owner's removal
    await p.evaluate(() => go('of-users')); await w(p);
    await p.click('button:has-text("Accept removal")'); await w(p);
    m = await txt(p, '.modal');
    ok('1 “Accept removal” asks first', /for good\?/.test(m) && /not erased/.test(m), m.slice(0, 160));
    await p.fill('#op-why', 'Left the company for good'); await p.click('.modal button:has-text("Remove for good")'); await w(p);
    const u = await p.evaluate(() => { const u = AD.users.find((x) => x.id === 'u5'); return { status: u.status, why: u.removal?.finalReason, kept: AD.users.includes(u) }; });
    ok('1 the owner is kept, marked deleted, with the reason', u.status === 'deleted' && u.why === 'Left the company for good' && u.kept, u);
    await p.close();
  }

  // ---------- 2, 10, 11. Model pricing ----------
  {
    const p = await open(true);
    await p.evaluate(() => { go('of-settings'); }); await w(p);
    await p.evaluate(() => go('of-prices')); await w(p);
    let fit = await p.evaluate(() => { const t = document.querySelector('.ad-tabs'); return { sw: t.scrollWidth, cw: t.clientWidth, right: Math.max(...[...t.children].map((c) => c.getBoundingClientRect().right)), page: document.documentElement.scrollWidth }; });
    ok('2 phone: every pricing tab is on the screen', fit.sw <= fit.cw + 1 && fit.right <= 390 && fit.page <= 390, fit);
    ok('11 the back arrow says where it goes (Settings)', await p.evaluate(() => opsDetail('of-prices')[0] === 'of-settings' && opsDetail('of-prices')[1] === 'Settings' && /Back to Settings/.test(document.querySelector('#app .backlink')?.textContent || 'Back to Settings')));
    const cell = p.locator('.ad-cell input').first();
    ok('11 prices show with a $ and commas', /^\d{1,3},\d{3}$/.test(await cell.inputValue()) && await p.locator('.ad-cell .op-dollar').count() > 0, await cell.inputValue());
    await cell.fill('$3,500'); await cell.dispatchEvent('change'); await w(p);
    const d1 = await p.evaluate(() => AD.draft.map((d) => [d.old, d.new]));
    ok('11 a price typed as “$3,500” is understood', d1.length === 1 && d1[0][1] === 3500, d1);
    let page = await txt(p);
    ok('2 a bar says “1 change waiting” with Review', /1 change waiting/.test(page) && await p.locator('.op-waiting button:has-text("Review")').count() === 1, page.slice(0, 200));
    await shot(p, 'pricing-phone');
    await p.click('.op-waiting button:has-text("Review")'); await w(p);
    page = await txt(p);
    ok('11 the draft says “1 price changed”', /\b1 price changed/.test(page) && !/1 prices changed/.test(page), page.slice(0, 200));
    await p.click('button:has-text("Throw the draft away")'); await w(p);
    ok('11 “Throw the draft away” asks first', /Throw the draft away\?/.test(await txt(p, '.modal')) && await p.evaluate(() => AD.draft.length === 1));
    await p.click('.modal button:has-text("Keep the draft")'); await w(p);
    ok('11 keeping the draft keeps it', await p.evaluate(() => AD.draft.length === 1));
    await p.close();
  }
  {
    const p = await open();
    await p.evaluate(() => { OG.live = true; go('of-users'); go('of-prices'); AD.tab = 'lot'; AD.lot = 'statesboro'; AD.model = 'Basic Utility'; render(); }); await w(p);
    ok('11 from Users the back arrow says Users and permissions', /Back to Users and permissions/.test(await txt(p)));
    ok('10 with no lot prices it says every lot is on the main list', /Every lot sells at the main list price/.test(await txt(p)));
    const main = await p.evaluate(() => PRICE_LIST['Basic Utility']['10x16']);
    await p.evaluate((main) => { adPrice({ kind: 'lot', lot: 'statesboro', model: 'Basic Utility', size: '10x16' }, main + 142); AD.tab = 'draft'; render(); }, main); await w(p);
    await p.click('.ad-prices .ad-tools button:has-text("Publish")'); await w(p, 500);
    await p.evaluate(() => { AD.tab = 'lot'; render(); }); await w(p);
    let page = await txt(p);
    ok('10 the list names the lot, its price, the main price and the gap', /Lots with their own prices\s*1/i.test(page) && /Statesboro/.test(page) && /\$142\.00 more/.test(page) && /main list/.test(page), page.slice(0, 400));
    ok('10 the lot’s own price is marked on its cell', await p.locator('.ad-cell.op-owncell').count() === 1 && /this lot’s own price/.test(await txt(p, '.ad-cell.op-owncell')));
    await shot(p, 'lot-prices', '.ad-prices');
    await p.click('.op-ownlist button:has-text("Back to the main list")'); await w(p);
    ok('10 “Back to the main list” puts the change in the draft', await p.evaluate((main) => AD.draft.length === 1 && AD.draft[0].new === main, main));
    await p.evaluate(() => { AD.tab = 'draft'; render(); }); await w(p);
    await p.click('.ad-prices .ad-tools button:has-text("Publish")'); await w(p, 500);
    ok('10 once published the lot is back on the main list', await p.evaluate(() => !AD.over.statesboro || !('Basic Utility|10x16' in AD.over.statesboro)));
    page = await txt(p);
    await p.locator('.op-setlines summary').first().click(); await w(p);
    ok('10 the Published list opens to show old and new prices', await p.locator('.op-setlines').count() === 2 && /\$5,300\.00|\$5,158\.00/.test(await txt(p, '.op-setlines')), (await txt(p, '.op-setlines')).slice(0, 200));
    await p.close();
  }

  // ---------- 3. A signed order's price changes ----------
  {
    const p = await open();
    await p.evaluate(() => { ofOpen('GRV-0020'); }); await w(p);
    const was = await p.evaluate(() => ({ signed: !!ofSale('GRV-0020').signed.invoice, total: ofTotals(ofSale('GRV-0020')).total }));
    await p.locator('button:has-text("Add $")').first().click(); await w(p);
    let m = await txt(p, '.modal');
    ok('3 adding fuel to a signed order asks first', was.signed && /already signed this price/.test(m) && /signed again/.test(m), m.slice(0, 200));
    await p.click('.modal button:has-text("Leave the price alone")'); await w(p);
    ok('3 leaving it alone changes nothing', await p.evaluate((t) => ofTotals(ofSale('GRV-0020')).total === t && !!ofSale('GRV-0020').signed.invoice, was.total));
    await p.locator('button:has-text("Add $")').first().click(); await w(p);
    await p.click('.modal button:has-text("Add it and ask for a new signature")'); await w(p);
    const st = await p.evaluate(() => { const s = ofSale('GRV-0020'); return { signed: !!s.signed.invoice, resign: s.office.resign, total: ofTotals(s).total, can: ofCanRelease(s), note: /needs a new signature/.test(s.events.at(-1).text) }; });
    ok('3 the signature comes off and the order needs a new one', !st.signed && st.resign && st.total > was.total, st);
    ok('3 it is written in the history, and the order cannot be released until it is signed', st.note && st.can.ok === false && /sign the invoice again/.test(st.can.why), st);
    let page = await txt(p);
    ok('3 the order page says “Needs a new signature”', /Needs a new signature/.test(page), page.slice(0, 200));
    await shot(p, 'needs-signature', '.of-check.bad');
    await p.evaluate(() => { OF.tab = 'approved'; go('of-orders'); }); await w(p);
    ok('3 the order list flags it too', /Needs a new signature/.test(await txt(p, '.ops-row:has-text("GRV-0020")')));
    // a discount on another signed order (a form, so it is told after)
    await p.evaluate(() => ofOpen('LUG-0320')); await w(p);
    await p.click('button:has-text("Add a discount")'); await w(p);
    await p.fill('#of-disc-amount', '50'); await p.fill('#of-disc-purpose', 'Military'); await p.click('.modal button:has-text("Save")').catch(async () => { await p.locator('.modal .actions button').first().click(); }); await w(p);
    const d = await p.evaluate(() => { const s = ofSale('LUG-0320'); return { signed: !!s.signed.invoice, resign: !!s.office.resign, n: s.money.discounts.length }; });
    ok('3 a discount on a signed order also takes the signature off', d.n >= 1 && !d.signed && d.resign, d);
    ok('3 …and says so', /sign the invoice again/.test(await said(p)), await said(p));
    // the Sales desk can get it signed again
    await p.evaluate(() => { openSale('LUG-0320'); }); await w(p, 500);
    const step = await txt(p, '.sf-step:has-text("Customer signs the invoice")');
    ok('3 the Sales desk’s invoice step opens again with “Sign again”', /Sign again/.test(step) && /changed the price/.test(step), step);
    await p.close();
  }

  // ---------- 4. Read-only can look ----------
  {
    const p = await open();
    await p.evaluate(() => { const u = AD.users.find((x) => x.id === 'u8'); u.access.office = 'read'; adView('u8'); ofOpen('STB-3102'); }); await w(p);
    ok('4 viewing as a person with Office read only', /Office: Read only/.test(await txt(p, '#ad-bar')), await txt(p, '#ad-bar'));
    await p.click('#app button:has-text("Invoice")'); await w(p);
    ok('4 a read-only person can open the invoice', await p.locator('.modal .od-paper').count() === 1, await said(p));
    await p.evaluate(() => closeModal());
    await p.click('#app button:has-text("Terms")'); await w(p);
    ok('4 …and the terms', await p.locator('.modal').count() === 1);
    await p.evaluate(() => closeModal());
    const n0 = await p.evaluate(() => ofSale('STB-3102').events.length);
    await p.click('#app button:has-text("Place on hold")'); await w(p);
    ok('4 a button that changes something is still blocked', await p.locator('.modal').count() === 0 && /can look here but not change/.test(await said(p)) && await p.evaluate((n) => ofSale('STB-3102').events.length === n, n0), await said(p));
    await p.close();
  }

  // ---------- 5. Reopen a cancelled order ----------
  {
    const p = await open();
    await p.evaluate(() => { OG.live = false; ofOpen('STB-3102'); ofCancelForm('STB-3102'); }); await w(p);
    await p.fill('#of-cancel-reason', 'Customer Cancelled'); await p.click('.modal button:has-text("Cancel the order")'); await w(p);
    let page = await txt(p);
    ok('5 a cancelled order offers Reopen', await p.evaluate(() => ofStage(ofSale('STB-3102')) === 'cancelled') && await p.locator('button:has-text("Reopen this order")').count() === 1, page.slice(0, 200));
    const money = await txt(p, 'section.panel:has(h2:text-is("Money"))');
    ok('5 its Money box has no money buttons except the refund', !/Record a payment|Add a discount|Add a delivery charge|Add \$/.test(money) && /Mark refunded|No money to give back/.test(money), money.slice(-400));
    await shot(p, 'reopen', '.of-banner');
    await p.click('button:has-text("Reopen this order")'); await w(p);
    await p.click('.modal button:has-text("Reopen the order")'); await w(p);
    ok('5 reopening needs a reason', /Type the reason first/.test(await said(p)));
    await p.fill('#op-why', 'Customer changed their mind'); await p.click('.modal button:has-text("Reopen the order")'); await w(p);
    const r = await p.evaluate(() => { const s = ofSale('STB-3102'); return { stage: ofStage(s), kept: s.office.cancels?.length, log: s.events.at(-1).text }; });
    ok('5 it goes back to “To review”, and the cancel is kept in its history', r.stage === 'review' && r.kept === 1 && /reopened the order: Customer changed their mind/.test(r.log), r);
    await p.close();
  }

  // ---------- 6. One name per step ----------
  {
    const p = await open();
    await p.evaluate(() => ofOpen('STB-3102')); await w(p);
    let page = await txt(p);
    ok('6 no “Pending Review” or “Accepted” on a review order', !/Pending Review|\bAccepted\b/.test(page) && /To review/.test(page), (page.match(/.{0,40}(Pending Review|Accepted).{0,40}/) || [''])[0]);
    ok('6 no system words on the order page', !/inventory host|IdeaRoom doc|Completed in the POS|Order intake|Submitted to administrator/.test(page), (page.match(/.{0,40}(inventory host|IdeaRoom doc|Completed in the POS|Order intake|Submitted to administrator).{0,40}/) || [''])[0]);
    ok('6 plain names instead', /How the order came in/.test(page) && /Entered at the Sales desk/.test(page) && /Order form/.test(page), page.slice(0, 100));
    ok('6 signatures fold away under “Who signed what”, so paperwork is not listed twice', await p.locator('details.op-fold summary:has-text("Who signed what")').count() === 1 && !(await p.locator('details.op-fold').first().evaluate((e) => e.open)));
    await p.evaluate(() => ofOpen('AA-20411')); await w(p);
    page = await txt(p);
    ok('6 the sample order says where it came from in plain words', /From the lot’s sales system/.test(page) && !/inventory host/.test(page));
    await p.evaluate(() => ofOpen('GRV-0020')); await w(p);
    page = await txt(p);
    ok('6 an approved order says Approved everywhere', /Approved/.test(page) && !/\bAccepted\b/.test(page), (page.match(/.{0,40}Accepted.{0,40}/) || [''])[0]);
    await shot(p, 'names', '.to-intake');
    await p.close();
  }

  // ---------- 7. Counts and filters ----------
  {
    const p = await open();
    await p.evaluate(() => go('office')); await w(p);
    const c = await p.evaluate(() => ({ tile: document.querySelector('.ops-tiles .kpi strong').textContent, head: [...document.querySelectorAll('#of-list h2')].find((h) => /^To review/.test(h.textContent))?.querySelector('small').textContent, heads: [...document.querySelectorAll('#of-list h2')].map((h) => h.textContent.trim()) }));
    ok('7 the To do tile and the “To review” heading show the same number', c.tile === c.head, c);
    ok('7 the order waiting on the rent-to-own company is in that list, flagged', !c.heads.some((h) => /Waiting on the RTO company/.test(h)) && /Waiting on the rent-to-own company/.test(await txt(p, '#of-list')), c.heads);
    await shot(p, 'todo', '.ops-tiles', 200);
    const reqBefore = await p.evaluate(() => document.querySelectorAll('#of-list .ops-row:has(button[onclick^="opDecline"])').length);
    await p.selectOption('.qc-filter select', 'statesboro'); await w(p);
    const reqAfter = await p.evaluate(() => ({ rows: document.querySelectorAll('#of-list .ops-row:has(button[onclick^="opDecline"])').length, tile: [...document.querySelectorAll('.ops-tiles .kpi')].at(-1).querySelector('strong').textContent }));
    ok('7 the lot filter also filters requests (and their tile)', reqBefore >= 3 && reqAfter.rows === 0 && reqAfter.tile === '0', { reqBefore, reqAfter });
    await p.evaluate(() => { OF.lot = 'All'; OF.q = 'zzzz'; render(); }); await w(p);
    let page = await txt(p, '#of-list');
    ok('7 an empty search says “Nothing found” in plain words', /Nothing found/.test(page) && /No order or request matches this lot and search/.test(page), page);
    await p.evaluate(() => { OF.q = 'zzzz'; OF.tab = 'review'; go('of-orders'); }); await w(p);
    page = await txt(p, '#of-orders');
    ok('7 Orders says “Nothing found”, not “No to review orders”', /Nothing found/.test(page) && !/No to review orders/.test(page), page);
    await p.evaluate(() => { OF.q = ''; go('of-requests'); }); await w(p);
    ok('7 Requests has a search box and a lot filter', await p.locator('#app .qc-filter .search').count() === 1 && await p.locator('#app .qc-filter select').count() === 1);
    await p.fill('#app .qc-filter .search', 'STOCK-4'); await w(p);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#app .ops-row')].filter((r) => r.querySelector('button[onclick^="opDecline"]')).map((r) => r.querySelector('strong').textContent));
    ok('7 typing in Requests filters the requests and keeps the cursor in the box', rows.length === 1 && /STOCK-4/.test(rows[0]) && await p.evaluate(() => document.activeElement?.classList.contains('search')), rows);
    await p.fill('#app .qc-filter .search', 'zzzz'); await w(p);
    ok('7 Requests says “Nothing found” when nothing matches', /Nothing found/.test(await txt(p)));
    await p.close();
  }

  // ---------- 8. People ----------
  {
    const p = await open();
    await p.evaluate(() => go('of-users')); await w(p);
    const n = await p.evaluate(() => AD.users.length);
    const tryAdd = async (name, email) => { await p.evaluate(() => { closeModal(); adAddForm(); }); await w(p, 150); await p.fill('#ad-n', name); await p.fill('#ad-e', email); await p.click('.modal button:has-text("Send the invitation")'); await w(p, 200); return said(p); };
    ok('8 no email is refused', /Type the person’s email/.test(await tryAdd('Jamie Pike', '')));
    ok('8 a bad email is refused', /does not look right/.test(await tryAdd('Jamie Pike', 'jamie.pike@')));
    ok('8 an email someone already has is refused', /already has that email/.test(await tryAdd('Jamie Pike', 'SAM.LEE@example.com')));
    ok('8 the same name twice is refused', /already a Sam Lee/.test(await tryAdd('Sam Lee', 'sam.lee2@example.com')));
    ok('8 nobody was added by the refused tries', await p.evaluate((n) => AD.users.length === n, n));
    const good = await tryAdd('Jamie Pike', 'jamie.pike@example.com');
    ok('8 a good name and email is invited', /Jamie Pike is invited/.test(good) && await p.evaluate((n) => AD.users.length === n + 1, n), good);
    await p.evaluate(() => { const u = AD.users.at(-1); adRole(u.id, 'sales_rep', true); adLevel(u.id, 'office', 'read'); adLot(u.id, 'all', false); go('of-users'); }); await w(p);
    let card = await txt(p, '.op-access');
    ok('8 Users has an access history: who changed whose access, and when', /Access history/.test(card) && /Jamie Pike · Invited as Team member/.test(card) && /Jamie Pike · Job roles: none → Sales rep/.test(card) && /Changed by Super user A/.test(card), card.slice(0, 500));
    await shot(p, 'new-user', '.op-access');
    await p.evaluate(() => adOpen(AD.users.at(-1).id)); await w(p);
    ok('8 a person’s page lists the changes made to them', /Changes to this person/.test(await txt(p, '.op-access')) && /Access:/.test(await txt(p, '.op-access')));
    // a team member given Edit on Users can change team members, not owners
    await p.evaluate(() => { const u = AD.users.find((x) => x.id === 'u8'); u.access.users = 'edit'; adView('u8'); go('of-users'); }); await w(p);
    ok('8 a team member with Edit on Users gets “Add a person”', await p.locator('#app button:has-text("Add a person")').count() === 1);
    const tm = await p.evaluate(() => { const before = AD.users.find((x) => x.id === 'u7').title; adSet('u7', 'title', 'Senior salesperson'); const owner = AD.users.find((x) => x.id === 'u3').title; adSet('u3', 'title', 'Hacked'); adSet('u7', 'kind', 'owner'); return { before, team: AD.users.find((x) => x.id === 'u7').title, owner: AD.users.find((x) => x.id === 'u3').title === owner, kind: AD.users.find((x) => x.id === 'u7').kind }; });
    ok('8 …can change a team member, but not an owner, and cannot make an owner', tm.team === 'Senior salesperson' && tm.owner && tm.kind === 'user', tm);
    await p.close();
  }

  // ---------- 9. Settings ----------
  {
    const p = await open();
    await p.evaluate(() => { OG.live = false; go('of-settings'); }); await w(p);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.op-settabs button')].map((b) => b.textContent));
    ok('9 Settings is split into four sections', JSON.stringify(tabs) === JSON.stringify(['Prices and fees', 'Getting paid', 'Paperwork and people', 'History']), tabs);
    const vis = () => p.evaluate(() => [...document.querySelectorAll('#app section.panel')].filter((s) => !s.hidden && s.offsetParent).map((s) => s.querySelector('h2')?.textContent));
    let v = await vis();
    ok('9 only the open section shows', JSON.stringify(v) === JSON.stringify(['Fuel surcharge', 'Delivery', 'Discounts']), v);
    let page = await txt(p);
    ok('9 the out-of-date lines are gone', !/How it works today/.test(page) && !/This preview has no logins/.test(page), (page.match(/.{0,40}(How it works today|no logins).{0,40}/) || [''])[0]);
    ok('9 every number has a Save button, and the page says how saving works', await p.locator('#app .of-inline .op-save:visible').count() >= 3 && /Change a number and press Save/.test(page));
    await shot(p, 'settings', '.op-settabs', 420);
    const free = p.locator('#app input[onchange^="ofSetNum(\'freeMiles\'"]');
    await free.fill('40'); await p.locator('#app .of-inline .op-save:visible').first().click(); await w(p);
    ok('9 pressing Save asks “Save this change?” like every other setting', /Save this change\?/.test(await txt(p, '.modal')), await txt(p, '.modal'));
    await p.click('.modal button:has-text("Do not change it")'); await w(p);
    await p.click('.op-settabs button:has-text("Getting paid")'); await w(p);
    v = await vis();
    ok('9 “Getting paid” shows cash sales and rent-to-own', JSON.stringify(v) === JSON.stringify(['Cash sales', 'Rent-to-own companies', 'Rent-to-own terms']), v);
    await p.click('button:has-text("Driver can take it")'); await w(p);
    ok('9 the driver-payment switch asks first too', /Save this change\?/.test(await txt(p, '.modal')) && await p.evaluate(() => OF.set.driverPay === false));
    await p.click('.modal button:has-text("Save the change")'); await w(p);
    await p.click('.op-settabs button:has-text("Paperwork and people")'); await w(p);
    page = await txt(p);
    ok('9 “Who can do what” points to Users and permissions', /set under Users and permissions/.test(page) && !/no logins/.test(page));
    await p.click('.op-settabs button:has-text("History")'); await w(p);
    page = await txt(p, '.og-history');
    ok('9 the history records the change in plain words', /Final payment: before delivery → the driver can take it/.test(page) && !/price divided by/.test(page), page.slice(0, 300));
    // 11: company bills in the menu
    ok('11 Company bills is in the Office menu', await p.locator('nav button[data-nav="of-bills"]:visible').count() === 1);
    await p.click('nav button[data-nav="of-bills"]'); await w(p);
    ok('11 …and opens the bills page', /bills/i.test(await txt(p, '#app h1')) && await p.evaluate(() => S.page === 'of-bills'));
    await p.evaluate(() => go('of-settings')); await w(p);
    await p.click('.op-settabs button:has-text("Prices and fees")'); await w(p);
    const x = await p.evaluate(() => { const b = document.querySelector('#app .chipbtn .of-x'); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    ok('11 the × on a discount purpose is a proper button (32 px or more)', x.w >= 32 && x.h >= 32, x);
    await p.close();
  }

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
