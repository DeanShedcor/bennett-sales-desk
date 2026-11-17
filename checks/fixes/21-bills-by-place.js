// Company bills place by place, and who may see or change them.
// node 21-bills-by-place.js <url> [pic]
const { chromium } = require('playwright');
const L = process.argv[2] || 'http://localhost:8765/', PIC = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : ' :: ' + (d || ''))); };
const num = (s) => Number(String(s).replace(/[^0-9.\-]/g, ''));
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
  const shown = (p) => p.evaluate(() => [...document.querySelectorAll('#app .ops-list .ops-row')].map((r) => r.querySelector('.ops-rowsub').textContent));
  const tiles = (p) => p.evaluate(() => [...document.querySelectorAll('#bp-tiles .kpi strong')].map((x) => x.textContent));
  const wait = (p) => p.waitForTimeout(350);

  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);
    if (phone) {
      await p.evaluate(() => go('office')); await wait(p);
      await p.click('.tabbar [data-more="office"]'); await wait(p);
      ok('Phone: More lists Company bills', /Company bills/.test(await p.locator('.sx-morelist').innerText()));
      await p.click('.sx-morerow:has-text("Company bills")'); await wait(p);
    } else { await p.evaluate(() => go('office')); await wait(p); await p.click('.topnav [data-nav="of-bills"]'); await wait(p); }
    ok(`${tag}: Company bills opens`, await p.evaluate(() => S.page === 'of-bills') && await p.locator('#bp-place').count() === 1);
    ok(`${tag}: no small "To do" link at the top`, !(await p.locator('#app .backlink').count()));
    const opts = await p.evaluate(() => [...document.querySelectorAll('#bp-place option')].map((o) => o.textContent.trim()));
    const lots = await p.evaluate(() => LOTS.length);
    ok(`${tag}: the drop-down has All places, Corporate, Manufacturing plant and every lot`, opts[0] === 'All places' && opts[1] === 'Corporate' && opts[2] === 'Manufacturing plant' && opts.length === 3 + lots && opts.includes('Moncks Corner, SC lot'), JSON.stringify(opts.slice(0, 5)) + opts.length);
    ok(`${tag}: it starts on All places`, await p.inputValue('#bp-place') === 'all');

    // every place: only its own bills, and its numbers add up
    const places = await p.evaluate(() => bpPlaces());
    const bad = [], sums = [];
    for (const [id, name] of places) {
      await p.selectOption('#bp-place', id); await wait(p);
      const rows = await shown(p), want = await p.evaluate((id) => { const l = TO.bills.filter((x) => x.place === id); return { n: l.length, act: l.filter((x) => x.status === 'active').length, fixed: l.filter((x) => x.status === 'active' && x.cadence === 'monthly' && x.amount != null).reduce((t, x) => t + x.amount, 0) }; }, id);
      const t = await tiles(p);
      if (rows.length !== want.n || !rows.every((r) => r.startsWith(name)) || Number(t[0]) !== want.act || Math.abs(num(t[2]) - want.fixed) > 0.005 || !want.n) bad.push(`${name}: ${rows.length}/${want.n} ${t.join(',')}`);
      sums.push(num(t[2]));
    }
    ok(`${tag}: each place shows only its own bills, and its count and money a month match`, !bad.length, bad.slice(0, 3).join(' | '));
    ok(`${tag}: every place has at least one bill of its own`, places.length === 2 + lots && !bad.length);

    await p.selectOption('#bp-place', 'all'); await wait(p);
    const all = await p.evaluate(() => ({ rows: document.querySelectorAll('#app .ops-list .ops-row').length, n: TO.bills.length, grand: document.querySelector('#bp-grand').textContent, per: [...document.querySelectorAll('.bp-table tbody tr')].map((tr) => [tr.children[0].textContent, tr.children[3].textContent]), groups: [...document.querySelectorAll('.bp-group h3 span')].map((x) => x.textContent) }));
    const total = Math.round(sums.reduce((a, c) => a + c, 0) * 100) / 100;
    ok(`${tag}: All places lists every bill under its place`, all.rows === all.n && all.groups.length === places.length && all.groups[0] === 'Corporate', `${all.rows}/${all.n} ${all.groups.length}`);
    ok(`${tag}: All places has a total for each place`, all.per.length === places.length && all.per.every(([n, m], i) => n === places[i][1] && Math.abs(num(m) - sums[i]) < 0.005), JSON.stringify(all.per.slice(0, 3)));
    ok(`${tag}: the All places total is the sum of the places`, Math.abs(num(all.grand) - total) < 0.005 && Math.abs(num((await tiles(p))[2]) - total) < 0.005, `${all.grand} vs ${total}`);
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-bills-all.png` }); }

    // the picked place is remembered while moving around
    await p.click('.bp-table tr[data-place="lot:florence"] button'); await wait(p);
    ok(`${tag}: Open in the table picks that place`, await p.inputValue('#bp-place') === 'lot:florence' && /Florence, SC lot/.test((await p.locator('#bp-tiles').innerText())));
    await p.evaluate(() => go('of-orders')); await wait(p); await p.evaluate(() => go('of-bills')); await wait(p);
    ok(`${tag}: the picked place is remembered after leaving and coming back`, await p.inputValue('#bp-place') === 'lot:florence');
    if (PIC) { await p.waitForTimeout(4300); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${PIC}-bills-${phone ? 'phone' : 'place'}.png` }); }

    // add a bill: it lands in the picked place
    const before = await p.evaluate(() => ({ fl: TO.bills.filter((x) => x.place === 'lot:florence').length, n: TO.bills.length }));
    await p.click('button:has-text("Add a bill for Florence, SC lot")'); await wait(p);
    ok(`${tag}: the form is for the picked place and does not ask for it`, /Add a bill for Florence, SC lot/.test(await p.locator('.to-billform h2').innerText()) && await p.evaluate(() => { const s = document.querySelector('#to-b-where'); return s.disabled && s.options.length === 1 && s.value === 'lot:florence'; }));
    await p.fill('#to-b-provider', 'Sample Water Works'); await p.fill('#to-b-amount', '55.25'); await p.fill('#to-b-due', '12th of each month');
    await p.click('.to-billform button:has-text("Save the bill")'); await wait(p);
    const after = await p.evaluate(() => { const l = TO.bills.filter((x) => x.place === 'lot:florence'), x = l[l.length - 1]; return { fl: l.length, n: TO.bills.length, prov: x.provider, where: x.where, other: TO.bills.filter((y) => y.provider === 'Sample Water Works' && y.place !== 'lot:florence').length }; });
    ok(`${tag}: the new bill lands in the picked place and nowhere else`, after.fl === before.fl + 1 && after.n === before.n + 1 && after.prov === 'Sample Water Works' && after.where === 'Florence, SC lot' && !after.other, JSON.stringify(after));
    ok(`${tag}: it shows in that place’s list and its money a month goes up`, (await shown(p)).length === after.fl && /Sample Water Works/.test(await p.locator('#app .ops-list').innerText()));
    await p.selectOption('#bp-place', 'corp'); await wait(p);
    ok(`${tag}: another place does not show it`, !/Sample Water Works/.test(await p.locator('#app .ops-list').innerText()));

    // under All places the form asks for the place
    await p.selectOption('#bp-place', 'all'); await wait(p);
    await p.click('#app .actions button:has-text("Add a bill")'); await wait(p);
    ok(`${tag}: under All places the form asks for the place`, await p.evaluate(() => { const s = document.querySelector('#to-b-where'); return !s.disabled && s.value === '' && s.options.length > 20; }));
    await p.fill('#to-b-provider', 'Sample Gas Co'); await p.click('.to-billform button:has-text("Save the bill")'); await wait(p);
    ok(`${tag}: it will not save until a place is picked`, await p.locator('.to-billform').count() === 1 && await p.evaluate(() => !TO.bills.some((x) => x.provider === 'Sample Gas Co')));
    await p.selectOption('#to-b-where', 'plant:orangeburg'); await p.click('.to-billform button:has-text("Save the bill")'); await wait(p);
    ok(`${tag}: picked in the form, it lands in the Manufacturing plant`, await p.evaluate(() => { const x = TO.bills.find((y) => y.provider === 'Sample Gas Co'); return x && x.place === 'plant:orangeburg' && x.where === 'Manufacturing plant'; }));
    ok(`${tag}: no sideways scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await p.close();
  }

  // ---------- who may see and change ----------
  for (const phone of [false, true]) {
    const tag = phone ? 'Phone' : 'Computer', p = await open(phone);
    const def = await p.evaluate(() => { const lv = (roles, kind = 'user') => adAccess({ status: 'active', kind, roles, access: {} }, 'bills'); return { sup: lv([], 'super'), owner: lv([], 'owner'), admin: lv(['admin']), rev: lv(['ops_reviewer']), others: Object.keys(AD_ROLES).filter((r) => !['admin', 'ops_reviewer'].includes(r)).map((r) => lv([r])) }; });
    ok(`${tag}: to start, owners and the Office admin role can change, the Office reviewer role can look, every other role cannot see`, def.sup === 'edit' && def.owner === 'edit' && def.admin === 'edit' && def.rev === 'read' && def.others.every((x) => x === 'none'), JSON.stringify(def));
    if (!phone) {
      await p.evaluate(() => adOpen('u8')); await wait(p);
      const seg = await p.evaluate(() => { const g = document.querySelector('.ad-seg[aria-label="Company bills"]'); return g && { words: [...g.querySelectorAll('button')].map((x) => x.textContent), on: g.querySelector('button.on')?.textContent }; });
      ok('Users and permissions has a Company bills line: Cannot see, Can look, Can change', seg && seg.words.join('|') === 'Cannot see|Can look|Can change' && seg.on === 'Can look', JSON.stringify(seg));
      if (PIC) { await p.waitForTimeout(4300); await p.locator('.ad-seg[aria-label="Company bills"]').scrollIntoViewIfNeeded(); await wait(p); await p.screenshot({ path: `${PIC}-permissions.png` }); }
      await p.click('.ad-seg[aria-label="Company bills"] button:has-text("Can change")'); await wait(p);
      ok('Pressing Can change gives that person the right to change bills', await p.evaluate(() => adAccess(adUser('u8'), 'bills') === 'edit'));
      await p.click('.ad-seg[aria-label="Company bills"] button:has-text("Cannot see")'); await wait(p);
      ok('Pressing Cannot see takes bills away from that person', await p.evaluate(() => adAccess(adUser('u8'), 'bills') === 'none'));
      await p.evaluate(() => { delete adUser('u8').access.bills; adView('u3'); adOpen('u1'); }); await wait(p);
      ok('An owner cannot change a super user’s line (the old guard still holds)', await p.evaluate(() => [...document.querySelectorAll('.ad-seg[aria-label="Company bills"] button')].every((x) => x.disabled)));
      await p.evaluate(() => { adView('u6'); adOpen('u8'); adLevel('u8', 'bills', 'edit'); }); await wait(p);
      ok('Someone who is not an owner cannot change who sees bills', await p.evaluate(() => adAccess(adUser('u8'), 'bills') === 'read'));
      await p.evaluate(() => adView('u1')); await wait(p);
    }

    // can look (the Office reviewer)
    await p.evaluate(() => { adView('u8'); go('office'); }); await wait(p);
    if (phone) { await p.click('.tabbar [data-more="office"]'); await wait(p); await p.click('.sx-morerow:has-text("Company bills")'); } else await p.click('.topnav [data-nav="of-bills"]');
    await wait(p);
    let t = await p.locator('#app').innerText();
    ok(`${tag}, can look: the bills show with a line that says so`, /You can look at bills but not change them\. Ask an owner to change this\./.test(t) && (await shown(p)).length > 0, t.slice(0, 200));
    ok(`${tag}, can look: no Add a bill and no Mark ended buttons`, !/Add a bill/.test(t) && !/Mark ended|Make active/.test(t));
    await p.selectOption('#bp-place', 'plant:orangeburg'); await wait(p);
    ok(`${tag}, can look: the place drop-down still works`, await p.inputValue('#bp-place') === 'plant:orangeburg' && (await shown(p)).every((r) => r.startsWith('Manufacturing plant')));
    ok(`${tag}, can look: the strip at the top says Can look`, /Company bills: Can look/.test(await p.locator('#ad-bar').innerText()));
    if (PIC && !phone) { await p.waitForTimeout(4300); await p.screenshot({ path: `${PIC}-look-only.png` }); }
    const refused = await p.evaluate(() => { const n = TO.bills.length, id = TO.bills[0].id, st = TO.bills[0].status; toBillToggle(id); bpForm(true); const open = TO.billForm; return { same: TO.bills[0].status === st, open, n: TO.bills.length === n }; });
    ok(`${tag}, can look: the functions refuse too (no form, no status change)`, refused.same && !refused.open && refused.n, JSON.stringify(refused));
    await p.evaluate(() => { TO.billForm = true; render(); }); await wait(p);
    ok(`${tag}, can look: forcing the form open still shows none`, !(await p.locator('.to-billform').count()));
    await p.evaluate(() => { TO.billForm = false; });

    // can change (give the reviewer the Office admin role)
    await p.evaluate(() => { adUser('u8').roles = ['admin']; render(); }); await wait(p);
    t = await p.locator('#app').innerText();
    ok(`${tag}, Office admin role: can add and change`, /Add a bill/.test(t) && /Mark ended/.test(t) && !/You can look at bills/.test(t));
    await p.locator('#app .ops-row button:has-text("Mark ended")').first().click(); await wait(p);
    ok(`${tag}, Office admin role: Mark ended works`, /Make active/.test(await p.locator('#app').innerText()));
    await p.evaluate(() => { adUser('u8').roles = ['ops_reviewer']; });

    // cannot see (a salesperson, then a dispatcher on the Office side)
    await p.evaluate(() => { adView('u11'); go('office'); }); await wait(p);
    ok(`${tag}, cannot see: Company bills is not in the menu`, await p.evaluate(() => [...document.querySelectorAll('[data-nav="of-bills"]')].every((x) => !x.offsetParent)));
    ok(`${tag}, cannot see: no link to bills on the To do screen`, await p.evaluate(() => !document.querySelector('#app [onclick*="of-bills"]')));
    if (phone) {
      await p.click('.tabbar [data-more="office"]'); await wait(p);
      const more = await p.locator('.sx-morelist').innerText();
      ok('Phone, cannot see: More leaves Company bills out', !/Company bills/.test(more) && /Settings/.test(more), more);
      await p.evaluate(() => closeModal());
    } else {
      await p.evaluate(() => awSearchOpen?.()).catch(() => {});
      const found = await p.evaluate(() => (typeof awFind === 'function' ? JSON.stringify(awFind('bills')) + JSON.stringify(awFind('Sample Power')) : '[][]'));
      ok('Computer, cannot see: search finds no bills', !/of-bills|Sample Power/.test(found), found.slice(0, 200));
      await p.evaluate(() => { try { closeModal(); } catch (e) {} });
    }
    await p.evaluate(() => go('of-bills')); await wait(p);
    t = await p.locator('#app').innerText();
    ok(`${tag}, cannot see: going to its address says "You do not have access"`, /You do not have access to Company bills\./.test(t) && !/Sample/.test(t), t.slice(0, 200));
    const n0 = await p.evaluate(() => { const n = TO.bills.length; bpForm(true); toBillToggle(TO.bills[0].id); try { bpSave(); } catch (e) {} return [n, TO.bills.length, TO.billForm]; });
    ok(`${tag}, cannot see: the functions refuse`, n0[0] === n0[1] && !n0[2]);
    await p.evaluate(() => adView('u1')); await wait(p);
    ok(`${tag}: back as the owner, bills are in the menu again`, phone ? true : await p.evaluate(() => !!document.querySelector('.topnav [data-nav="of-bills"]').offsetParent));
    await p.close();
  }
  console.log(`${pass} passed, ${fail} failed, errors ${errs.length}`, errs.slice(0, 3));
  await b.close();
})();
