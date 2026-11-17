// Whole-app batch 2: phone sizes, Firefly tours and rest spot, smarter answers, one count, keyboard and notices.
// node fix16.js <url> [part...]   parts: sizes tours rest answers counts keys (default: all)
const { chromium } = require('playwright');
const { SCREENS, ARGS } = require('./phone-parts/lib');
const tours = require('./phone-parts/tours');
const L = process.argv[2] || 'http://localhost:8765/', parts = process.argv.slice(3), want = (n) => !parts.length || parts.includes(n);
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + String(d || '').slice(0, 400))); };
const errs = [];
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const open = async (phone) => { const p = await (await b.newContext(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1360, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2200); return p; };

  if (want('sizes')) {
    const p = await open(true);
    await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(4300);
    const by = {}; const worst = [];
    for (const [name, fn] of SCREENS) {
      try { await p.evaluate(fn); } catch (e) { continue; }
      await p.waitForTimeout(450);
      const d = await p.evaluate(() => {
        const vis = (e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true }) && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
        const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], summary')].filter(vis).filter((e) => !e.closest('#ff-root') && !e.disabled);
        const box = (e) => { const l = /^(checkbox|radio)$/.test(e.type) ? e.closest('label') : null; const r = (l || e).getBoundingClientRect(); return Math.min(r.width, r.height); };
        const lab = (e) => (e.innerText || e.getAttribute('aria-label') || e.title || e.placeholder || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 22);
        const small = els.filter((e) => box(e) < 43.5);
        const app = document.getElementById('app'), walk = document.createTreeWalker(app, NodeFilter.SHOW_TEXT); let n, chars = 0, tiny = 0; const ex = [];
        while ((n = walk.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const e = n.parentElement; if (!vis(e) || e.closest('svg')) continue; const f = parseFloat(getComputedStyle(e).fontSize); chars += t.length; if (f < 13.6) { tiny += t.length; ex.length < 3 && ex.push(t.slice(0, 20) + ' ' + f); } }
        const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]), select, textarea')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15.9).length;
        return { side: document.body.dataset.side, n: els.length, small: small.length, ex: small.slice(0, 4).map((e) => lab(e) + ' ' + Math.round(box(e))), chars, tiny, tex: ex, fields, sw: document.documentElement.scrollWidth };
      });
      const s = (by[d.side] = by[d.side] || { controls: 0, under44: 0, chars: 0, under14: 0, smallFields: 0, sideways: 0 });
      s.controls += d.n; s.under44 += d.small; s.chars += d.chars; s.under14 += d.tiny; s.smallFields += d.fields; if (d.sw > 391) s.sideways++;
      if (d.small || d.tiny || d.fields || d.sw > 391) worst.push(`${name}: ${d.small} small taps ${d.ex.join(' | ')}; ${d.tiny} small chars ${d.tex.join(' | ')}; ${d.fields} small fields; width ${d.sw}`);
    }
    console.table(by);
    const t = Object.values(by).reduce((a, s) => ({ c: a.c + s.controls, u: a.u + s.under44, ch: a.ch + s.chars, t: a.t + s.under14, f: a.f + s.smallFields, w: a.w + s.sideways }), { c: 0, u: 0, ch: 0, t: 0, f: 0, w: 0 });
    console.log(`phone: ${t.u} of ${t.c} controls under 44 px; ${t.t} of ${t.ch} characters under 14 px; ${t.f} small fields`);
    ok('Phone: all five sides were measured', Object.keys(by).length === 5 && t.c > 1000, JSON.stringify(Object.keys(by)));
    ok('Phone: nothing you tap is under 44 px', t.u === 0, worst.join(' || '));
    ok('Phone: no reading text under 14 px', t.t === 0, worst.join(' || '));
    ok('Phone: typing boxes use 16 px text (no iPhone zoom)', t.f === 0, worst.join(' || '));
    ok('Phone: no sideways scrolling on any screen', t.w === 0, worst.join(' || '));
    const chev = await p.evaluate(() => { openSale('AA-20411'); const c = document.querySelector('#app .chev'); return c ? getComputedStyle(c, '::before').content : ''; });
    ok('Phone: a step tracker reads "Step N of M: name"', /Step \d of \d: /.test(chev), chev);
    await p.close();
  }

  if (want('tours')) {
    for (const kind of ['phone', 'desk']) {
      const r = await tours.run(L, kind);
      console.log(`${kind}: ${r.total} tour steps, ${r.bad.length} problems, ${r.finished} of ${r.tours} tours finished`);
      ok(`Tours (${kind}): all ${r.tours} tours run to the end`, r.finished === r.tours && r.total === 44, `${r.finished}/${r.tours}, ${r.total} steps`);
      ok(`Tours (${kind}): every step has its control, with the card and its buttons on screen`, r.bad.length === 0, r.bad.join(' || '));
      errs.push(...r.errs);
    }
  }

  if (want('rest')) {
    for (const phone of [true, false]) {
      const p = await open(phone), kind = phone ? 'phone' : 'computer';
      await p.evaluate(() => { ffSetOn(true); }); await p.waitForTimeout(500);
      const hits = [];
      for (const [name, fn] of SCREENS) {
        try { await p.evaluate(fn); } catch (e) { continue; }
        await p.waitForTimeout(900);
        const c = await p.evaluate(() => { const bug = document.getElementById('ff-bug'); if (!bug || !bug.getClientRects().length) return null; const r = bug.getBoundingClientRect(); return { on: ahCovers(r.left, r.top, r.width), at: [Math.round(r.left), Math.round(r.top)], inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
        if (c && (c.on || !c.inView)) hits.push(`${name} at ${c.at}${c.inView ? '' : ' OFF SCREEN'}`);
      }
      ok(`Firefly (${kind}): rests on no button on any screen`, hits.length === 0, hits.join(' | '));
      await p.evaluate(() => { go('home'); window.scrollTo(0, 600); }); await p.waitForTimeout(600);
      ok(`Firefly (${kind}): still clear after scrolling`, await p.evaluate(() => { const r = document.getElementById('ff-bug').getBoundingClientRect(); return !ahCovers(r.left, r.top, r.width); }));
      if (phone) {
        await p.evaluate(() => { localStorage.removeItem('firefly:dragtip'); go('home'); }); await p.waitForTimeout(300);
        const first = await p.evaluate(() => ahDragTip()); await p.waitForTimeout(200);
        const tip = await p.evaluate(() => (document.getElementById('ah-dragtip') || {}).innerText || '');
        ok('Firefly: shows once that it can be dragged', first === true && /Drag me/.test(tip), tip);
        const r = await p.evaluate(() => { const e = document.getElementById('ah-dragtip').getBoundingClientRect(); return e.left >= 0 && e.right <= innerWidth && e.top >= 0 && e.bottom <= innerHeight; });
        ok('Firefly: the drag tip is fully on the phone screen', r);
        await p.evaluate(() => document.getElementById('ah-dragtip')?.remove());
        ok('Firefly: the drag tip does not come back a second time', (await p.evaluate(() => ahDragTip())) === false);
      } else {
        // a dragged spot is kept when it is clear
        await p.evaluate(() => { go('home'); FF.pos = [600, 500]; ffHome(); ahRest(); }); await p.waitForTimeout(300);
        const at = await p.evaluate(() => { const r = document.getElementById('ff-bug').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), ahCovers(r.left, r.top, r.width)]; });
        ok('Firefly: a spot the person dragged it to is kept, or moved only as far as needed to clear a button', at[2] === false && Math.abs(at[0] - 600) < 120 && Math.abs(at[1] - 500) < 200, JSON.stringify(at));
      }
      await p.close();
    }
  }

  if (want('answers')) {
    const p = await open(false);
    const ans = (q) => p.evaluate((q) => { const a = ahAnswer(q); return { kind: a.kind, title: a.title, text: a.text, article: a.article || '', tour: a.tour || '', go: a.go || '' }; }, q);
    const cases = [
      ['how do I turn you off', (a) => a.kind === 'app' && /Turn Firefly off/.test(a.title) && /Show Firefly/.test(a.text)],
      ['turn off firefly', (a) => /Turn Firefly off/.test(a.title)],
      ['help', (a) => a.kind === 'app' && /What I can do/.test(a.title)],
      ['what can you do', (a) => /What I can do/.test(a.title)],
      ['show me around', (a) => /look around/i.test(a.title) && /ffAround/.test(a.go)],
      ['how do I add a user', (a) => /Add a person/.test(a.title) && /Users and permissions/.test(a.text)],
      ['how do I start a sale', (a) => /Start a sale/.test(a.title) && /go\('start'\)/.test(a.go)],
      ['how do I undo a move', (a) => /Undo a move/.test(a.title) && /10 seconds/.test(a.text)],
      ['how do I change a price', (a) => /Change a price/.test(a.title) && /Undo this publish/.test(a.text)],
      ['how do I cancel a load on the road', (a) => /Cancel a load/.test(a.title) && /on the road/.test(a.text)],
      ['how do I hide a lot from someone', (a) => /Limit a person/.test(a.title)],
      ['how do I find a serial number', (a) => /serial/i.test(a.title)],
      ['how do I take a payment', (a) => /Take a payment/.test(a.title)],
      ['how do I print a quote', (a) => /Print/.test(a.title)],
      ['who approves delivery fees', (a) => /delivery fee/i.test(a.title) && /Logistics/.test(a.text)],
      ['how long is the drive to Lexington', (a) => /Lexington/.test(a.title) && /194 road miles/.test(a.text)],
      ['move a building to the next phase', (a) => /next step/.test(a.title)],
      ['inspect a building', (a) => a.tour === 'qc-inspect'],
      ['how do I schedule a delivery', (a) => a.tour === 'logi-load'],
      ['warrenty', (a) => a.article === 'warranty'],
      ['delivry fee', (a) => a.article === 'delivery-distance' && /free within 50 miles/.test(a.text)],
      ['how much is delivery', (a) => a.article === 'delivery-distance'],
      ['14x40', (a) => /14 × 40: yes/.test(a.title) && /\$/.test(a.text)],
      ['99x99', (a) => /not a size we sell/.test(a.title)],
      ['sales tax', (a) => /Sales tax/.test(a.title) && !/CRM/.test(a.title + a.text)],
      ['fuel surcharge', (a) => /Fuel/.test(a.title) && /\$0\.30 per sq ft/.test(a.text)],
      ['can a shed go on a slope', (a) => a.article === 'set-height'],
      ['how long until my shed is built', (a) => a.article === 'lead-times'],
      ['do I need a permit', (a) => /permit/i.test(a.title) && !/Steel|Electrical/.test(a.title)],
      ['how far is delivery free', (a) => a.article === 'delivery-distance'],
      ['what does the warranty cover', (a) => a.article === 'warranty'],
      ['lost keys', (a) => a.article === 'lost-keys'],
      ['insulation', (a) => a.article === 'materials'],
      ['wind rating', (a) => a.article === 'wind-anchors'],
      ['where is my commission', (a) => a.kind === 'unknown' && /don’t know that yet/.test(a.title)],
      ['purple elephant parade policy', (a) => a.kind === 'unknown' && /don’t know that yet/.test(a.title)],
      ['colors', (a) => a.kind === 'unknown'],
    ];
    let right = 0; const wrong = [];
    for (const [q, test] of cases) { const a = await ans(q); if (test(a)) right++; else wrong.push(`"${q}" -> ${a.kind} ${a.title} [${a.article}${a.tour}]`); }
    console.log(`answers: ${right} of ${cases.length} questions right`);
    ok(`Answers: ${cases.length} everyday questions get the right answer, or a plain "I don’t know that yet"`, right === cases.length, wrong.join(' || '));
    // the same answer in three places
    for (const q of ['how do I turn you off', 'delivry fee', 'purple elephant parade policy']) {
      const want = await ans(q);
      await p.evaluate((q) => { ffSetOn(true); ffAsk(q); }, q); await p.waitForTimeout(300);
      const ff = await p.evaluate(() => ({ title: FF.answer.title, shown: document.getElementById('ff-panel').innerText }));
      await p.evaluate(() => { ffClose(); go('home'); }); await p.waitForTimeout(300);
      await p.fill('.ta-askbar input[name=q]', q); await p.press('.ta-askbar input[name=q]', 'Enter'); await p.waitForTimeout(400);
      const sheet = await p.evaluate(() => ({ title: (document.querySelector('#ah-answer strong') || {}).innerText || '', text: (document.querySelector('#ah-answer p') || {}).innerText || '' }));
      await p.evaluate(() => taCloseAnswers()); await p.waitForTimeout(200);
      await p.evaluate((q) => taOpenAnswers(q), q); await p.waitForTimeout(300);
      const sheet2 = await p.evaluate(() => (document.querySelector('#ah-answer strong') || {}).innerText || '');
      await p.evaluate(() => taCloseAnswers());
      ok(`Same answer in Firefly, the Home ask bar and Answers: "${q}"`, ff.title === want.title && sheet.title === want.title && sheet2 === want.title && ff.shown.includes(want.text.slice(0, 40)) && sheet.text.includes(want.text.slice(0, 40)), JSON.stringify([want.title, ff.title, sheet.title, sheet2]));
    }
    // the buttons on an answer work
    await p.evaluate(() => { go('home'); taOpenAnswers('how do I add a user'); }); await p.waitForTimeout(300);
    await p.click('#ah-answer button:has-text("Open Users")'); await p.waitForTimeout(400);
    ok('Answers: the button on an answer takes you there', await p.evaluate(() => S.page === 'of-users' && !document.getElementById('ta-sheet')));
    await p.evaluate(() => { ffAsk('how do I turn you off'); }); await p.waitForTimeout(300);
    await p.click('#ff-panel .ff-ans button:has-text("Open my settings")'); await p.waitForTimeout(300);
    ok('Firefly: "how do I turn you off" leads to the box that turns it off', await p.evaluate(() => !!document.getElementById('ff-on') && FF.view === 'settings'));
    await p.evaluate(() => { adView('u9'); }).catch(() => {});
    await p.evaluate(() => { const u = AD.users.find((x) => adAccess(x, 'users') === 'none' && x.status === 'active'); if (u) adView(u.id); }); await p.waitForTimeout(300);
    const denied = await ans('how do I add a user');
    ok('Answers: a person without access is told so, with no button', /cannot open that part/.test(denied.text) && !denied.go, JSON.stringify(denied));
    await p.evaluate(() => adView('u1'));
    ok('Answers: the old search still lists articles for a topic word', (await p.evaluate(() => taSearch('warranty').map((a) => a.id)))[0] === 'warranty');
    await p.close();
  }

  if (want('counts')) {
    const p = await open(false);
    await p.evaluate(() => { ffSetOn(true); }); await p.waitForTimeout(400);
    const nums = () => p.evaluate(() => ({ bell: document.getElementById('ta-bell-count').hidden ? 0 : +document.getElementById('ta-bell-count').textContent, ff: document.querySelector('#ff-bug .ff-n').hidden ? 0 : +document.querySelector('#ff-bug .ff-n').textContent, news: ahNews() }));
    const seen = [];
    for (const pg of ['home', 'office', 'prod', 'qc', 'logi']) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(350); const n = await nums(); seen.push(`${pg} bell ${n.bell} firefly ${n.ff}`); if (n.bell !== n.ff || n.bell !== n.news) seen.push('MISMATCH ' + pg); }
    console.log('counts:', seen.join(' · '));
    ok('The bell and Firefly show the same number on all five sides', !seen.some((x) => /MISMATCH/.test(x)) && seen.length === 5, seen.join(' · '));
    ok('There is news to count on at least one side', /bell [1-9]/.test(seen.join(' ')), seen.join(' · '));
    await p.evaluate(() => go('home')); await p.waitForTimeout(300);
    const before = await nums();
    await p.evaluate(() => taOpenNotices()); await p.waitForTimeout(300); await p.locator('.modal button:has-text("Mark all read")').click(); await p.waitForTimeout(300); await p.evaluate(() => closeModal()); await p.waitForTimeout(300);
    const after = await nums();
    ok('Reading the bell clears Firefly too', before.bell > 0 && after.bell === 0 && after.ff === 0, JSON.stringify([before, after]));
    await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
    const b2 = await nums();
    await p.evaluate(() => ffOpen()); await p.waitForTimeout(300);
    const during = await nums();
    await p.evaluate(() => ffClose()); await p.waitForTimeout(300);
    const a2 = await nums();
    ok('Closing "Today" in Firefly leaves the news unread, on the bell too', b2.bell > 0 && during.bell === b2.bell && a2.bell === b2.bell && a2.ff === b2.ff, JSON.stringify([b2, during, a2]));
    await p.evaluate(() => { taNotify({ to: 'logi', title: 'Test news', body: 'One new thing' }); }); await p.waitForTimeout(300);
    const a3 = await nums();
    ok('A new piece of news shows on both at once', a3.bell === a2.bell + 1 && a3.ff === a2.ff + 1, JSON.stringify(a3));
    await p.close();
  }

  if (want('keys')) {
    const p = await open(false);
    await p.evaluate(() => { ffSetOn(true); go('home'); document.activeElement.blur(); window.scrollTo(0, 0); }); await p.waitForTimeout(300);
    await p.keyboard.press('Tab');
    const first = await p.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.innerText, top: document.activeElement.getBoundingClientRect().top }));
    ok('Keyboard: the first Tab stop is "Skip to the page", and it shows when focused', first.id === 'ah-skip' && /Skip to the page/.test(first.text) && first.top >= 0, JSON.stringify(first));
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok('Keyboard: Enter on it moves to the page', await p.evaluate(() => document.activeElement.id === 'app'));
    await p.keyboard.press('Tab');
    ok('Keyboard: the next Tab lands inside the page, past the menus', await p.evaluate(() => !!document.activeElement.closest('#app')), await p.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
    const nameless = [];
    for (const [name, fn] of SCREENS) {
      try { await p.evaluate(fn); } catch (e) { continue; } await p.waitForTimeout(300);
      const r = await p.evaluate(() => [...document.querySelectorAll('button, [role=button], a[href]')].filter((e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true }) && e.getClientRects().length).filter((e) => !((e.innerText || '').trim() || e.getAttribute('aria-label') || e.title || e.querySelector('img[alt]:not([alt=""])'))).map((e) => String(e.className).slice(0, 20) + ':' + String(e.getAttribute('onclick')).slice(0, 30)));
      if (r.length) nameless.push(name + ' ' + r.slice(0, 2).join(','));
    }
    ok('Keyboard: every button on every screen has a name', nameless.length === 0, nameless.join(' | '));
    const sides = [];
    for (const [pg, side] of [['home', 'sales'], ['office', 'office'], ['prod', 'prod'], ['qc', 'qc'], ['logi', 'logi']]) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(250); const on = await p.evaluate(() => [...document.querySelectorAll('.topbar [data-side-btn], .previewstrip [data-side-btn]')].filter((b) => b.getClientRects().length && b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.sideBtn)); if (!(on.length >= 1 && on.every((x) => x === side))) sides.push(pg + ':' + on.join(',')); }
    ok('The side switch says which side is chosen', sides.length === 0, sides.join(' | '));
    // notices: one at a time, Firefly's switch on top
    await p.evaluate(() => { go('home'); taOpenNotices(); }); await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const mod = document.querySelector('.modal'); const rows = [...mod.querySelectorAll('.ta-notice')]; const box = mod.querySelector('#ff-on-bell'); const list = mod.querySelector('.ta-notices'); return { rows: rows.length, clear: rows.filter((r) => [...r.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Clear')).length, open: rows.filter((r) => [...r.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Open')).length, boxFirst: !!box && !!(box.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING), title: mod.querySelector('h2').innerText }; });
    ok('News: Firefly’s on/off box is at the top of the list', m.boxFirst, JSON.stringify(m));
    ok('News: every item can be cleared by itself', m.rows >= 2 && m.clear === m.rows, JSON.stringify(m));
    ok('News: every item on the Sales desk can be opened', m.open === m.rows, JSON.stringify(m));
    await p.click('.modal .ta-notice >> nth=0 >> button:has-text("Clear")'); await p.waitForTimeout(300);
    ok('News: Clear removes just that one', (await p.evaluate(() => document.querySelectorAll('.modal .ta-notice').length)) === m.rows - 1);
    const target = await p.evaluate(() => document.querySelector('.modal .ta-notice strong').innerText);
    await p.click('.modal .ta-notice >> nth=0 >> button:has-text("Open")'); await p.waitForTimeout(400);
    ok('News: Open closes the list and goes to what it is about', await p.evaluate(() => !document.querySelector('.modal') && S.page !== 'home'), target + ' -> ' + (await p.evaluate(() => S.page)));
    await p.evaluate(() => { go('home'); taOpenNotices(); }); await p.waitForTimeout(300);
    await p.uncheck('#ff-on-bell'); await p.waitForTimeout(300);
    ok('News: the box turns Firefly off', await p.evaluate(() => document.getElementById('ff-root').hidden === true));
    await p.evaluate(() => { closeModal(); taOpenNotices(); }); await p.waitForTimeout(300);
    await p.check('#ff-on-bell'); await p.waitForTimeout(300);
    ok('News: and back on', await p.evaluate(() => document.getElementById('ff-root').hidden === false));
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
