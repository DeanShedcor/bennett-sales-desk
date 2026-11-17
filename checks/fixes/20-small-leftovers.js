// Four small leftovers: the Logistics top bar on a tablet, Firefly and the news, a build sheet label
// that said the spot twice, and a "More" tab on a phone. node 20-small-leftovers.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (opt, firefly) => { const p = await (await b.newContext(opt)).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(L); await p.waitForTimeout(2200); if (!firefly) await p.evaluate(() => { try { ffSetOn(false); } catch (e) {} }); await p.waitForTimeout(300); return p; };
  const SIDES = { sales: 'home', office: 'office', prod: 'prod', qc: 'qc', logi: 'logi' };
  const wide = () => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, bar: document.querySelector('.topbar-in').scrollWidth - document.querySelector('.topbar-in').clientWidth });

  // ---------- 1: no sideways scroll at tablet widths, on any side ----------
  for (const w of [900, 981, 1000, 1024, 1060, 1100]) {
    const p = await open({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 1000 ? 2 : 1 });
    const bad = [];
    for (const [side, pg] of Object.entries(SIDES)) { await p.evaluate((pg) => go(pg), pg); await p.waitForTimeout(300); const r = await p.evaluate(wide); if (r.over > 0 || r.bar > 0) bad.push(`${side} ${r.over}/${r.bar}`); }
    ok(`${w} wide: no side runs past the edge of the screen`, !bad.length, bad.join(' | '));
    if (w === 1000) {
      await p.evaluate(() => go('logi')); await p.waitForTimeout(400);
      const nav = await p.evaluate(() => { const r = document.querySelector('.topbar-right').getBoundingClientRect(); return { right: Math.round(r.right), n: [...document.querySelectorAll('.topnav button')].filter((x) => x.offsetParent).length, small: [...document.querySelectorAll('.topnav button')].filter((x) => x.offsetParent).map((x) => parseFloat(getComputedStyle(x).fontSize)).filter((f) => f < 13).length }; });
      ok('1000 wide, Logistics: all seven screens are in the top bar and the buttons on the right are on screen', nav.n === 7 && nav.right <= 1000 && !nav.small, JSON.stringify(nav));
      if (PIC) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-topbar-1000.png`, clip: { x: 0, y: 0, width: 1000, height: 420 } }); }
    }
    await p.close();
  }
  { const p = await open({ viewport: { width: 1360, height: 900 } });
    await p.evaluate(() => go('logi')); await p.waitForTimeout(300);
    ok('Computer, Logistics: the top bar is unchanged (normal size buttons)', await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.topnav button[data-for="logi"]')).paddingLeft) > 6));
    await p.close(); }

  // ---------- 4: the "More" tab on a phone ----------
  const MORE = { office: ['office', [['of-settings', 'Settings'], ['of-bills', 'Company bills']], 'of-pay'], logi: ['logi', [['lg-fleet', 'Trailers'], ['lg-service', 'Service jobs']], 'lg-loads'] };
  for (const [tag, opt] of [['Phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }], ['Small tablet', { viewport: { width: 820, height: 1000 }, deviceScaleFactor: 1 }]]) {
    const p = await open(opt);
    for (const [side, [home, list, other]] of Object.entries(MORE)) {
      await p.evaluate((pg) => go(pg), home); await p.waitForTimeout(400);
      const tabs = await p.evaluate(() => [...document.querySelectorAll('.tabbar button')].filter((x) => x.offsetParent).map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
      ok(`${tag}, ${side}: the bottom bar has six buttons and the last is More`, tabs.length === 6 && tabs[5] === 'More', JSON.stringify(tabs));
      const fit = await p.evaluate(() => [...document.querySelectorAll('.tabbar button')].filter((x) => x.offsetParent).every((x) => x.scrollWidth <= x.clientWidth + 1) && document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      ok(`${tag}, ${side}: every tab's word fits and nothing scrolls sideways`, fit);
      ok(`${tag}, ${side}: More is not lit on the first screen`, !(await p.locator('.tabbar [data-more]:visible').getAttribute('class')).includes('active'));
      for (const [page, name] of list) {
        await p.locator('.tabbar [data-more]:visible').click(); await p.waitForTimeout(300);
        const rows = await p.locator('.modal .sx-morerow strong').allInnerTexts();
        ok(`${tag}, ${side}: More lists ${list.map((x) => x[1]).join(' and ')}`, rows.join('|') === list.map((x) => x[1]).join('|'), rows.join('|'));
        if (PIC && tag === 'Phone' && side === 'logi' && page === 'lg-service') { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-phone-tabs.png` }); }
        await p.locator(`.modal .sx-morerow:has-text("${name}")`).click(); await p.waitForTimeout(500);
        const at = await p.evaluate(() => ({ page: S.page, modal: !!document.querySelector('.modal'), h1: document.querySelector('#app h1')?.innerText || '', lit: document.querySelector('.tabbar [data-more].active')?.dataset.more || '', cur: document.querySelector('.tabbar [aria-current="page"]')?.innerText.trim() || '', over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        ok(`${tag}, ${side}: pressing ${name} opens that screen, with More lit`, at.page === page && !at.modal && at.h1.length > 3 && at.lit === side && at.cur === 'More' && at.over <= 0, JSON.stringify(at));
        if (PIC && tag === 'Phone' && page === 'of-bills') { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-phone-bills.png` }); }
      }
      await p.evaluate((pg) => go(pg), other); await p.waitForTimeout(300);
      ok(`${tag}, ${side}: going to another screen turns More off`, await p.evaluate(() => !document.querySelector('.tabbar [data-more].active')));
    }
    await p.close();
  }
  { const p = await open({ viewport: { width: 1360, height: 900 } });
    await p.evaluate(() => go('office')); await p.waitForTimeout(300);
    const top = await p.evaluate(() => ({ tabbar: getComputedStyle(document.querySelector('.tabbar')).display, nav: [...document.querySelectorAll('.topnav button')].filter((x) => x.offsetParent).map((x) => x.innerText.trim()) }));
    ok('Computer: no bottom bar, and the top menu still lists Company bills and Settings', top.tabbar === 'none' && top.nav.includes('Company bills') && top.nav.includes('Settings'), JSON.stringify(top));
    await p.close(); }

  // ---------- 2: Firefly's Today list and the news ----------
  for (const [tag, opt] of [['Computer', { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 }], ['Phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    const p = await open(opt, true);
    await p.evaluate(() => { ffSetOn(true); document.getElementById('ff-welcome')?.remove(); go('office'); }); await p.waitForTimeout(500);
    const before = await p.evaluate(() => ahNews());
    await p.evaluate(() => { FF.view = 'main'; ffOpen(); }); await p.waitForTimeout(500);
    const shown = await p.evaluate(() => { const news = taNoticesFor('office').filter((n) => !n.read).map((n) => n.title); return [...document.querySelectorAll('#ff-root .ff-item b')].map((e) => e.textContent).filter((t) => news.includes(t)).length; });
    ok(`${tag}: Office has news, and Firefly's Today list shows some of it`, before > 0 && shown > 0, `news ${before}, shown ${shown}`);
    if (PIC && tag === 'Computer') { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-firefly.png` }); }
    await p.evaluate(() => ffClose()); await p.waitForTimeout(400);
    ok(`${tag}: closing Firefly's Today list does not mark the news read`, await p.evaluate(() => ahNews()) === before, `before ${before}, after ${await p.evaluate(() => ahNews())}`);
    await p.evaluate(() => ffOpen()); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    ok(`${tag}: closing it with the Escape key does not either`, await p.evaluate(() => !FF.open && ahNews()) === before);
    ok(`${tag}: the count on Firefly still shows the news`, await p.evaluate(() => (document.querySelector('#ff-bug .ff-n')?.textContent || '')) === String(before));
    await p.evaluate(() => ffOpen()); await p.waitForTimeout(400);
    const title = await p.evaluate(() => { const news = taNoticesFor('office').filter((n) => !n.read).map((n) => n.title); const b = [...document.querySelectorAll('#ff-root button.ff-item')].find((e) => news.includes(e.querySelector('b').textContent)); const t = b?.querySelector('b').textContent; b?.click(); return t || ''; });
    await p.waitForTimeout(500);
    const after = await p.evaluate((t) => ({ n: ahNews(), read: TA.notices.find((x) => x.title === t)?.read === true, open: FF.open }), title);
    ok(`${tag}: pressing one piece of news marks only that one read`, !!title && after.n === before - 1 && after.read && !after.open, JSON.stringify({ title, before, after }));
    await p.close();
  }

  // ---------- 3: the wall strip label says the spot once ----------
  { const p = await open({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
    await p.evaluate(() => { localStorage.removeItem('sales:draft'); S.saleLead = null; go('start'); }); await p.waitForTimeout(300);
    await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1500);
    await p.evaluate(() => { change('size', '12x20'); goStep(steps.indexOf('Finish')); taAddonSet('Workbench (per LF)', 6); taAddonSet('Three Tier Shelving (per LF)', 8); taAddonSet('Additional Loft (PER SQ FT)', 48); taAddonSet('Partition Wall (per linear foot)', 6); render(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { openBuildSheet('cfg', true); const lay = bsLayout(S.c); for (const it of lay.items.filter((x) => x.kind === 'fix')) bsEdPlace(it.key, it.fw, it.at); bsRender(); }); await p.waitForTimeout(500);
    const labels = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = bsPages(bsOrder('cfg')); return [...d.querySelectorAll('.bs-page')[1].querySelectorAll('.bs-wall text')].map((e) => e.textContent.trim()).filter((t) => /: /.test(t) && !/HOOK TAPE/.test(t)); });
    const twice = labels.filter((t) => { const m = t.match(/\d+'-\d+[^ ]*" to \d+'-\d+[^ ]*"/g) || []; return m.length > 1; });
    ok('Build sheet page 2: no wall strip label says its spot twice', labels.length >= 4 && !twice.length, JSON.stringify(twice.length ? twice : labels));
    ok('The workbench and shelving labels read "name: start to end"', labels.some((t) => /^Workbench · 6 ft: \d+'-\d+" to \d+'-\d+"$/.test(t)) && labels.some((t) => /^Shelving · 8 ft: \d+'-\d+" to \d+'-\d+"$/.test(t)), JSON.stringify(labels));
    ok('The loft and the inside wall still say how deep they go', labels.some((t) => /^Loft · 48 sq ft \(overhead, .* deep\): /.test(t)) && labels.some((t) => /^Partition wall · 6 ft: starts at .*, runs .* into the building$/.test(t)), JSON.stringify(labels));
    if (PIC) { await p.evaluate(() => { BS.edit = false; bsRender(); }); await p.waitForTimeout(600); await p.evaluate(() => document.querySelector('#bsheet .bs-wall').scrollIntoView({ block: 'start' })); await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-buildsheet-label.png` }); }
    await p.close(); }

  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
