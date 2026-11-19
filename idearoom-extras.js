/* idearoom-extras.js: option prices, extra charges and named lofts the owner set to match the
   IdeaRoom designer (Nov 19, 2026). Prices and rules only, as facts. No IdeaRoom code or pictures.

   Prices that changed
   - Architectural shingles: $375 (the list's "Shingles (Wrapped)" line), was $250.
   - Floor joists 12 in. apart: $1.40 a sq ft (the list's "2x6 Floor Joists Upgrade 12" OC"), was $0.75.
   - 7 ft walls on a Utility: no charge, was $0.65 a sq ft.
   - 7 ft walls on a lofted barn: $0.65 a sq ft plus a $1,000 permitting fee.
   - Vinyl siding: $450, and the double door becomes a double fiberglass door (+$300). Net $750.
   New charges
   - Rush order $250 (Style step). Ridge vent $20 a foot of length (Openings). Paint sample $25
     (Colors). Copper Penny metal roof +$225. Out-swing door +$100 a door, and which side the
     handle is on (Openings).
   Lofts
   - Picked by name on the Finish step. The app works out the price. Typed square feet from an older
     sale still show and still price.

   Turbo Assist has no record yet for: rush order, ridge vent, paint sample, the Copper Penny charge,
   out-swing, handle side, the permitting fee, a named loft. Each is "a feature the product still has
   to accept" and is on the list of questions for Jordan.

   Hooks: shinglePrice(), breakdown(), floorJoistMarkup(), wallHeightMarkup(), taAddonSet(),
   taAddonsMarkup(), taAddonRows(), selectDoor(), stepBody(), change(), included(), bsLayout().
   Loaded after porch-rails.js and before idearoom-match.js (build on site is worked out last). */
{
  const SRC = 'Matches IdeaRoom';
  const tl = (name, fallback) => (typeof taListPrice === 'function' ? taListPrice(name) : null) ?? fallback;
  const dims = (c) => String(c.size).split('x').map(Number);
  const lengthOf = (c) => dims(c)[1];
  const sqft = (c) => dims(c)[0] * dims(c)[1];
  const cents = (n) => Math.round(n * 100) / 100;
  const pkgDoors = (c) => (typeof packageOpenings === 'function' ? packageOpenings(c).length > 0 : false);

  /* ---------- prices that changed ---------- */
  const SHINGLES = 'Shingles (Wrapped)', JOISTS = '2x6 Floor Joists Upgrade 12" OC (Per SQ Ft)';
  const joistRate = () => tl(JOISTS, 1.4);
  const PERMIT_FEE = 1000;
  shinglePrice = function (c) {
    return c.style === 'Greenhouse' || c.style === 'Silver Bullet' ? null : tl(SHINGLES, 375);
  };
  {
    const base = floorJoistMarkup;
    floorJoistMarkup = function (c) {
      return base(c).replace(/<strong>\+\$[\d,.]+<\/strong>/, `<strong>+${money(cents(sqft(c) * joistRate()))}</strong>`);
    };
  }
  const tallRate = (c) => (c.style === 'Lofted' ? tl('Lofted High Walls', 0.65) : 0);
  if (typeof wallHeightMarkup === 'function') {
    const base = wallHeightMarkup;
    wallHeightMarkup = function (c) {
      let html = base(c);
      if (!html) return html;
      if (c.style === 'Utility') html = html.replace('>7 ft</option>', '>7 ft · no charge</option>');
      if (c.style === 'Lofted') {
        html = html.replace('>7 ft</option>', `>7 ft · +${money(cents(sqft(c) * tallRate(c)) + PERMIT_FEE)}</option>`);
        html += `<p class="source" id="ix-wall-note">7 ft walls on a lofted barn cost ${money(tallRate(c))} a sq ft plus a ${money(PERMIT_FEE)} permitting fee.</p>`;
      }
      return html;
    };
  }

  /* ---------- vinyl siding brings a double fiberglass door ---------- */
  const VINYL = 'Vinyl Wrap', VINYL_DOOR = 'Double Solid Fiberglass Door';
  const vinylOn = (c) => !!c.extras?.[VINYL];
  function vinylTidy(c) {
    if (!c) return;
    if (vinylOn(c) && !pkgDoors(c)) {
      if (c.door !== VINYL_DOOR) { c.vinylDoorWas = c.door; c.door = VINYL_DOOR; }
      if (typeof allDoorsWhiteOnly === 'function' && allDoorsWhiteOnly(c)) c.doorColor = 'White';
    } else if (c.vinylDoorWas) {
      if (c.door === VINYL_DOOR) c.door = c.vinylDoorWas;
      delete c.vinylDoorWas;
    }
  }
  if (typeof taAddonSet === 'function') {
    const base = taAddonSet;
    taAddonSet = function (name, value) {
      if (name === VINYL) {
        S.c.extras ||= {};
        if (value) S.c.extras[VINYL] = 1; else delete S.c.extras[VINYL];
        vinylTidy(S.c);
        if (value && S.c.door === VINYL_DOOR) toast('Vinyl siding comes with a double fiberglass door. The main door was changed.');
        return render();
      }
      return base.apply(this, arguments);
    };
  }
  {
    const base = selectDoor;
    selectDoor = function (value, adding) {
      if (!adding && vinylOn(S.c) && !pkgDoors(S.c)) {
        closeModal();
        return toast('Vinyl siding comes with a double fiberglass door. Take vinyl siding off to change the main door.');
      }
      return base.apply(this, arguments);
    };
  }

  /* ---------- doors: handle side and swing ---------- */
  const ONE_LEAF = ['Single', 'Shed Door w/Transom', 'Fiberglass Door', '36" 9 Lite Door', '36" 15 Lite Door', '36" Full Lite Door', '36" Half Lite Door'];
  const CAN_SWING_OUT = ['Fiberglass Door', '36" 9 Lite Door', '36" 15 Lite Door', '36" Full Lite Door', '36" Half Lite Door', 'Double 9 Lite Door', 'Double 15 Lite Door', 'Double Solid Fiberglass Door', 'Double Full Lite Door'];
  const OUT_PRICE = 100;
  const doorsOf = (c) => [...(pkgDoors(c) ? [] : [c.door]), ...(c.extraDoors || [])].filter(Boolean);
  const doorKinds = (c) => [...new Set(doorsOf(c))].filter((d) => ONE_LEAF.includes(d) || CAN_SWING_OUT.includes(d));
  const doorOpt = (c, kind) => {
    const o = c.doorOpts?.[kind] || {};
    return { handle: ONE_LEAF.includes(kind) ? (o.handle === 'Left' ? 'Left' : 'Right') : null, swing: CAN_SWING_OUT.includes(kind) ? (o.swing === 'Out' ? 'Out' : 'In') : null };
  };
  const doorWords = (c, kind) => {
    const o = doorOpt(c, kind);
    return [o.handle && `handle on the ${o.handle.toLowerCase()}`, o.swing && (o.swing === 'Out' ? 'swings out' : 'swings in')].filter(Boolean).join(', ');
  };
  const doorLines = (c) => doorKinds(c).map((k) => `${doorName(k)}: ${doorWords(c, k)}`);
  window.ixDoorSet = function (kind, key, value) {
    const c = S.c;
    c.doorOpts ||= {};
    c.doorOpts[kind] = { ...c.doorOpts[kind], [key]: value };
    render();
  };
  function doorsTidy(c) {
    if (!c?.doorOpts) return;
    const kinds = doorKinds(c);
    for (const k of Object.keys(c.doorOpts)) if (!kinds.includes(k)) delete c.doorOpts[k];
    if (!Object.keys(c.doorOpts).length) delete c.doorOpts;
  }
  const seg = (on, click, text, small) => `<button type="button" class="seg${on ? ' on' : ''}" aria-pressed="${on}" onclick="${click}"><strong>${text}</strong>${small ? `<small>${small}</small>` : ''}</button>`;
  function doorsMarkup(c) {
    const kinds = doorKinds(c);
    if (!kinds.length) return '';
    return `<div class="ix-doors" id="ix-doors"><h4>Door handle and swing</h4>${kinds.map((k) => {
      const o = doorOpt(c, k), n = doorsOf(c).filter((d) => d === k).length, key = esc(JSON.stringify(k));
      return `<div class="ix-door"><strong>${esc(doorName(k))}${n > 1 ? ` × ${n}` : ''}</strong>${
        o.handle ? `<div class="ix-ask"><span>Which side is the handle on?</span><div class="segrow">${seg(o.handle === 'Right', `ixDoorSet(${key},'handle','Right')`, 'Right')}${seg(o.handle === 'Left', `ixDoorSet(${key},'handle','Left')`, 'Left')}</div></div>` : ''}${
        o.swing ? `<div class="ix-ask"><span>Which way does it open?</span><div class="segrow">${seg(o.swing === 'In', `ixDoorSet(${key},'swing','In')`, 'Swings in', 'No charge')}${seg(o.swing === 'Out', `ixDoorSet(${key},'swing','Out')`, 'Swings out', `+${money(OUT_PRICE)} a door`)}</div></div>${o.swing === 'Out' ? '<p class="notice">An out-swing door adds 2 weeks to the wait.</p>' : ''}` : ''}</div>`;
    }).join('')}</div>`;
  }

  /* ---------- tick boxes: rush order, ridge vent, paint sample ---------- */
  const TICKS = {
    rush: { name: 'Rush order', price: () => 250, note: 'Moves the order up in line.', ok: (c) => c.style !== 'Greenhouse', step: 'Style' },
    ridgeVent: { name: 'Ridge vent', price: (c) => 20 * lengthOf(c), note: (c) => `A vent along the top of the roof. ${money(20)} a foot of length, ${lengthOf(c)} ft.`, ok: (c) => ['Utility', 'Lofted', 'Silver Bullet', 'Low-Wall Barn'].includes(c.style), step: 'Openings' },
    paintSample: { name: 'Paint sample', price: () => 25, note: 'A sample of the color for the customer to look at first.', ok: (c) => c.style !== 'Greenhouse', step: 'Colors' },
  };
  const tickOn = (c, k) => !!c[k] && TICKS[k].ok(c);
  window.ixTick = function (key, on) {
    if (on) S.c[key] = true; else delete S.c[key];
    render();
  };
  const tickMarkup = (c, k) => {
    const t = TICKS[k];
    if (!t.ok(c)) return '';
    const note = typeof t.note === 'function' ? t.note(c) : t.note;
    return `<label class="checkrow boxed ix-tick${tickOn(c, k) ? ' on' : ''}"><input id="ix-${k}" type="checkbox" ${tickOn(c, k) ? 'checked' : ''} onchange="ixTick('${k}',this.checked)"> <span>${t.name}<small>${esc(note)}</small></span> <strong>+${money(t.price(c))}</strong></label>`;
  };
  const COPPER = 'Copper Penny', COPPER_PRICE = 225;
  const copperOn = (c) => c.roof === 'Metal' && c.roofColor === COPPER && c.style !== 'Greenhouse';
  const copperWords = (c) => (copperOn(c) ? `<strong>Copper Penny roof: +${money(COPPER_PRICE)}.</strong> It is on the price.` : `A Copper Penny metal roof adds ${money(COPPER_PRICE)}. The other roof colors cost nothing more.`);

  /* ---------- lofts by name ---------- */
  /* [name, price on a utility, where it sits]. Read from IdeaRoom at 8, 10, 12 and 14 ft wide and
     12 to 28 ft long: the 4 ft and 8 ft lofts are flat prices; the U-shaped loft follows the length. */
  const LOFTS = [
    ['4 ft Front', () => 192, 'A 4 ft loft over the front'],
    ['4 ft Back', () => 192, 'A 4 ft loft over the back'],
    ['4 ft Front & Back', () => 384, 'A 4 ft loft at each end'],
    ['8 ft Front', () => 384, 'An 8 ft loft over the front'],
    ['8 ft Back', () => 384, 'An 8 ft loft over the back'],
    ['8 ft Front & Back', () => 768, 'An 8 ft loft at each end'],
    ['U-Shaped Loft', (c) => 96 + 24 * lengthOf(c), 'A loft around three walls'],
  ];
  const OLD_LOFTS = ['Additional Loft (PER SQ FT)', 'U Loft (per SQ FT)'];
  function loftList(c) {
    const L = lengthOf(c), pk = c.package || 'Standard Storage', barn = c.style === 'Lofted';
    if (!['Utility', 'Lofted', 'Silver Bullet', 'Low-Wall Barn'].includes(c.style) || pk === 'Dormer Package') return [];
    let names = LOFTS.map((l) => l[0]);
    if (c.style === 'Low-Wall Barn') names = ['4 ft Back'];
    else if (pk === 'Garage Package') names = barn ? ['4 ft Back', '8 ft Back', 'U-Shaped Loft'] : ['4 ft Back', '8 ft Back'];
    else if (barn && /Porch/.test(pk)) names = ['4 ft Back', '8 ft Back', 'U-Shaped Loft'];
    return names.filter((n) => (n !== '8 ft Front & Back' || L >= 16) && (n !== 'U-Shaped Loft' || L >= (barn ? 16 : 12)) && (!/^8 ft/.test(n) || L >= 12));
  }
  /* A lofted barn comes with loft: one 4 ft loft on a barn shorter than 16 ft, 8 ft of loft from 16 ft. */
  const barnCredit = (c) => (lengthOf(c) >= 16 ? 384 : 192);
  function loftPrice(c, name) {
    const l = LOFTS.find((x) => x[0] === name);
    if (!l) return null;
    if (c.style !== 'Lofted') return l[1](c);
    return name === 'U-Shaped Loft' ? 24 * (lengthOf(c) - 8) : Math.max(0, l[1](c) - barnCredit(c));
  }
  const loftOf = (c) => (c.loft && loftList(c).includes(c.loft) ? c.loft : null);
  window.ixLoft = function (name) {
    if (name) S.c.loft = name; else delete S.c.loft;
    render();
  };
  function loftMarkup(c) {
    const list = loftList(c);
    if (!list.length) return '';
    const cur = loftOf(c), barn = c.style === 'Lofted';
    const opt = (on, click, name, note, price) => `<button type="button" class="po-opt${on ? ' on' : ''}" aria-pressed="${on}" onclick="${click}"><span class="po-dot" aria-hidden="true"></span><span class="grow"><strong>${esc(name)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</span><em>${price}</em></button>`;
    return `<div class="po-box ix-loft" id="ix-loft"><h3>Loft</h3><div class="po-list">${
      opt(!cur, 'ixLoft(null)', barn ? 'No loft picked' : 'No loft', barn ? 'The plant builds the loft that comes with the barn.' : '', '') +
      list.map((n) => {
        const p = loftPrice(c, n), l = LOFTS.find((x) => x[0] === n);
        return opt(cur === n, `ixLoft(${esc(JSON.stringify(n))})`, n, l[2] + (barn && p === 0 ? ' · comes with the barn' : ''), p == null ? 'Ask the office' : p === 0 ? (barn ? 'Included' : money(0)) : '+' + money(p));
      }).join('')}</div><p class="source">Pick the loft by name. The app works out the price, so nobody has to measure square feet.${barn ? ' A lofted barn comes with loft, so some choices cost nothing.' : ''}</p></div>`;
  }
  /* The two typed loft lines leave the list unless an older sale already has one. */
  if (typeof taAddon === 'function') {
    const hide = [...OLD_LOFTS, SHINGLES];
    const base = taAddonsMarkup;
    taAddonsMarkup = function (c) {
      const saved = hide.map((n) => [taAddon(n), taAddon(n)?.[3]]);
      saved.forEach(([a, was], i) => { if (a) a[3] = (x) => was(x) && !!x.extras?.[hide[i]]; });
      try { return base(c); } finally { saved.forEach(([a, was]) => { if (a) a[3] = was; }); }
    };
    const baseRows = taAddonRows;
    taAddonRows = function (c) {
      return baseRows(c).map((row) => (row.addon === VINYL || /^Vinyl wrap$/i.test(row.name) ? { ...row, name: 'Vinyl siding' } : row));
    };
  }

  /* ---------- keeping it in step ---------- */
  function tidy(c) {
    const said = [];
    if (!c) return said;
    vinylTidy(c);
    doorsTidy(c);
    if (c.loft && !loftList(c).includes(c.loft)) { said.push(`The “${c.loft}” loft does not fit this building, so it was taken off.`); delete c.loft; }
    for (const k of Object.keys(TICKS)) if (c[k] && !TICKS[k].ok(c)) delete c[k];
    return said;
  }
  {
    const base = change;
    change = function (key, value, resolve) {
      base(key, value, resolve);
      const said = tidy(S.c);
      if (key === 'roofColor') { /* a color pick redraws only the swatches, so the note is set by hand */
        const note = document.getElementById('ix-copper');
        if (note) { note.className = copperOn(S.c) ? 'notice' : 'source'; note.innerHTML = copperWords(S.c); }
      }
      if (said.length) toast(said.join(' '));
      if (said.length || ['style', 'size', 'package', 'siding'].includes(key)) render();
    };
    const baseRender = render;
    let seen = null;
    render = function () {
      try { if (S.page === 'configure' && S.path !== 'lot' && S.c !== seen) { seen = S.c; const said = tidy(S.c); if (said.length) setTimeout(() => toast(said.join(' ')), 0); } } catch (e) {}
      return baseRender.apply(this, arguments);
    };
  }

  /* ---------- the price ---------- */
  {
    const base = breakdown;
    breakdown = function (c = S.c) {
      const rows = base(c);
      const fuel = rows.find((r) => r.name === 'Fuel surcharge');
      const add = (row, afterRe) => {
        const at = afterRe ? rows.findIndex((r) => afterRe.test(r.name)) : -1;
        rows.splice(at >= 0 ? at + 1 : rows.length, 0, row);
      };
      for (const r of rows) {
        if (r.name === '12-inch-on-center floor joists') Object.assign(r, { amount: cents(sqft(c) * joistRate()), source: `${SRC} · ${money(joistRate())} per sq ft of floor` });
        if (r.name === 'Architectural shingles') r.source = SRC;
        if (r.name === VINYL_DOOR + ' · main door substitution' && vinylOn(c)) Object.assign(r, { name: 'Double fiberglass door · comes with vinyl siding', source: `${SRC} · in place of the double shed door` });
      }
      const tall = rows.findIndex((r) => r.name === '7 ft sidewalls (tall wall)');
      if (tall >= 0 && c.style === 'Utility') rows.splice(tall, 1);
      else if (tall >= 0 && c.style === 'Lofted') rows.splice(tall + 1, 0, { name: 'Permitting fee · 7 ft sidewalls on a lofted barn', amount: PERMIT_FEE, source: SRC });
      if (copperOn(c)) add({ name: 'Copper Penny metal roof', amount: COPPER_PRICE, source: SRC });
      for (const k of doorKinds(c)) {
        if (doorOpt(c, k).swing !== 'Out') continue;
        const n = doorsOf(c).filter((d) => d === k).length;
        add({ name: `Out-swing door · ${doorName(k)}${n > 1 ? ` × ${n}` : ''}`, amount: OUT_PRICE * n, source: `${SRC} · ${money(OUT_PRICE)} a door` });
      }
      const loft = loftOf(c), lp = loft ? loftPrice(c, loft) : null;
      if (loft && lp > 0) add({ name: `Loft: ${loft}`, amount: lp, source: SRC });
      if (loft && lp == null) add({ name: `Loft: ${loft}`, amount: 0, needed: true, source: 'Ask the office for the price' });
      if (tickOn(c, 'ridgeVent')) add({ name: `Ridge vent · ${lengthOf(c)} ft`, amount: TICKS.ridgeVent.price(c), source: `${SRC} · ${money(20)} a foot of length` });
      if (tickOn(c, 'paintSample')) add({ name: 'Paint sample', amount: 25, source: SRC });
      if (tickOn(c, 'rush')) add({ name: 'Rush order', amount: 250, source: SRC });
      /* the fuel line stays where the desk put it; a fuel charge that follows the price is redone in idearoom-match.js */
      void fuel;
      return rows;
    };
  }

  /* ---------- the steps ---------- */
  {
    const base = stepBody;
    stepBody = function () {
      const out = base(), c = S.c;
      if (!Array.isArray(out) || S.path === 'lot' || !c) return out;
      const step = steps[S.step];
      let html = out[1];
      if (step === 'Style' && TICKS.rush.ok(c)) html += `<div class="ix-box" id="ix-rush-box">${tickMarkup(c, 'rush')}</div>`;
      if (step === 'Openings') {
        const dm = doorsMarkup(c), at = html.indexOf('<div class="aw-doors"');
        if (dm) html = at >= 0 ? html.slice(0, at) + dm + html.slice(at) : html + dm;
        html += `<div class="ix-box" id="ix-ridge-box">${tickMarkup(c, 'ridgeVent')}</div>`;
      }
      if (step === 'Exterior') {
        html = html.replace('<span>Add vinyl wrap</span>', `<span>Vinyl siding<small>The double door changes to a double fiberglass door (+${money(doorPrices[VINYL_DOOR] - doorPrices.Double)}).</small></span>`).replace('<span>Add vinyl wrap <small>', '<span>Vinyl siding <small>');
      }
      if (step === 'Colors') {
        if (c.style !== 'Greenhouse' && c.roof === 'Metal') html += `<p class="${copperOn(c) ? 'notice' : 'source'}" id="ix-copper">${copperWords(c)}</p>`;
        html += `<div class="ix-box" id="ix-paint-box">${tickMarkup(c, 'paintSample')}</div>`;
      }
      if (step === 'Finish') {
        const lm = loftMarkup(c), at = html.indexOf('<h3>Add from the price list</h3>');
        if (lm) html = at >= 0 ? html.slice(0, at) + lm + html.slice(at) : html + lm;
        if (OLD_LOFTS.some((n) => c.extras?.[n])) html = html.replace('<div class="ta-addons">', '<p class="notice" id="ix-old-loft">This sale has a loft typed in square feet from before. It still counts. To use a named loft, set the square feet to 0 and pick one above.</p><div class="ta-addons">');
      }
      return [out[0], html];
    };
  }

  /* ---------- what the quote, the order and the plant read ---------- */
  function extraNotes(c) {
    const out = [];
    if (tickOn(c, 'rush')) out.push('Rush order');
    const loft = loftOf(c);
    if (loft) out.push(`Loft: ${loft}${c.style === 'Lofted' && loftPrice(c, loft) === 0 ? ' (comes with the barn)' : ''}`);
    if (tickOn(c, 'ridgeVent')) out.push(`Ridge vent · ${lengthOf(c)} ft`);
    if (Number(c.wallHeight) === 7 && c.style === 'Lofted') out.push('Permitting fee for 7 ft sidewalls');
    if (vinylOn(c)) out.push('Vinyl siding');
    out.push(...doorLines(c));
    if (tickOn(c, 'paintSample')) out.push('Paint sample');
    return out;
  }
  window.ixNotes = extraNotes;
  {
    const base = included;
    included = function (c) {
      const list = base(c), mine = extraNotes(c);
      return [...list.filter((x) => !mine.includes(x) && !(vinylOn(c) && /^Vinyl wrap$/i.test(x))), ...mine];
    };
    if (typeof bsLayout === 'function') {
      const sheet = bsLayout;
      bsLayout = function (c) {
        const lay = sheet(c), lines = doorLines(c), add = [];
        if (tickOn(c, 'rush')) add.push('RUSH ORDER.');
        const loft = loftOf(c);
        if (loft) add.push(`Loft: ${loft}.`);
        if (tickOn(c, 'ridgeVent')) add.push(`Ridge vent along the roof, ${lengthOf(c)} ft.`);
        if (vinylOn(c)) add.push('Vinyl siding, with a double fiberglass door.');
        const notes = lay.notes.flatMap((n) => (n === 'Door swing and handle side are not on the order.' ? (lines.length ? lines.map((l) => l + '.') : []) : [n.replace(/^Vinyl wrap: /i, 'Vinyl siding: ')]));
        return { ...lay, notes: [...add, ...notes] };
      };
    }
  }

  /* ---------- the explainer page ---------- */
  try {
    AW_REAL.sales.push('Lofts are picked by name on the Finish step. Rush order, ridge vent, paint sample, out-swing doors and the door handle side can be put on a sale.');
    AW_OPEN.push(['Shingles', 'Architectural shingles are $375.00, the same as IdeaRoom and the list’s “Shingles (Wrapped)” line. The list’s “Shingle Roof” line says $250.00. Which is the customer’s price?']);
    AW_OPEN.push(['Floor joists 12 in. apart', '$1.40 a sq ft, the same as IdeaRoom (the list’s “2x6 Floor Joists Upgrade 12" OC”). The list also has a $0.75 line. Which one?']);
    AW_OPEN.push(['7 ft walls', 'No charge on a Utility. On a lofted barn, $0.65 a sq ft plus a $1,000.00 permitting fee. Both follow IdeaRoom; the list has $0.65 a sq ft for each and no fee.']);
    AW_OPEN.push(['Vinyl siding', '$450.00, and the double door becomes a double fiberglass door for $300.00 more, the same as IdeaRoom. IdeaRoom also limits the colors to its vinyl colors; this app does not yet.']);
    AW_OPEN.push(['New charges', 'Rush order $250.00, ridge vent $20.00 a foot, paint sample $25.00, Copper Penny roof $225.00, out-swing door $100.00, and the door handle side. Turbo Assist has no record for these yet: a feature the product still has to accept.']);
    AW_OPEN.push(['Lofts by name', 'A 4 ft loft is $192.00, an 8 ft loft $384.00, a U-shaped loft $96.00 plus $24.00 a foot of length. A lofted barn gets $192.00 off under 16 ft long and $384.00 off from 16 ft. A Low-Wall Barn can have a 4 ft back loft for $192.00.']);
  } catch (e) {}
}
