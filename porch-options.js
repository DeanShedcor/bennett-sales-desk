/* porch-options.js: porch railing by name, a deeper end porch, a full side porch, and which
   buildings can have which porch.

   A salesperson asked (Nov 2026) for railing to work the way the IdeaRoom configurator words it,
   so nobody has to work out feet. The owner said: match it exactly. The names and prices below were
   read off that page as a reference; nothing else of it is used.

   Railing. The typed "Porch railing, feet" box on the last step is gone. On the Package step, under
   the porch, the salesperson picks a railing by name. Each choice is a set number of feet, kept on
   the building as Turbo Assist's add-on line 'Porch Railing (Per Linear Ft)' (c.extras), so the
   price is still feet times the published rate ($40.00 a foot) and Office price changes follow.
   The choice itself is c.railing, the railing color c.railColor (asked only with a railing).
   Deeper end porch. 4 ft or 8 ft (c.porchDepth). 8 ft adds the gap between the price list's
   "8' End Porch Package" and "End Porch Package" ($170.00).
   Lofted end porch. High ceiling with no loft over the porch, or low ceiling with a loft over it
   (c.porchLoft). Turbo Assist has no record of this; a feature the product still has to accept.
   Full Side Porch. A new package. The price list has no line for it, so its price is "to confirm".
   Rules. No Deluxe Porch on a building 10 ft wide or narrower. A lofted barn can have an End, Side
   or Full Side porch only. Only the Deluxe Porch comes with railing.
   Loaded last; wraps change(), packageVariantMarkup(), taAddonRows(), breakdown(), included(). */
{
  const RAIL_LINE = 'Porch Railing (Per Linear Ft)';
  /* [name, feet, note]. The first one is what a new porch starts on. */
  const RAILS = {
    'End Porch': [['No railing', 0], ['Side railing only', 8], ['Door on the right', 14], ['Door on the left', 14], ['Door in the center', 16]],
    'Middle Porch': [['No railing', 0], ['Door on the right', 4], ['Door on the left', 4]],
    'Side Porch': [['No railing', 0], ['Side railing only', 8]],
    'Deluxe Porch': [['Standard railing', 0, 'In the package'], ['Extended railing', 4], ['No railing', 0, 'No money back']],
    'Full Side Porch': [['Standard railing', 24], ['No railing', 0]],
  };
  const LOFTS = [['High', 'High ceiling', 'No loft over the porch'], ['Low', 'Low ceiling', 'A loft over the porch']];
  const isPorch = (c) => !!RAILS[c.package];
  const rate = () => (typeof taListPrice === 'function' ? taListPrice(RAIL_LINE) : null) ?? 40;
  const depthPrice = () => {
    const a = typeof taListPrice === 'function' ? taListPrice("8' End Porch Package") : null, b = typeof taListPrice === 'function' ? taListPrice('End Porch Package') : null;
    return a != null && b != null && a > b ? a - b : 170;
  };
  const widthOf = (c) => Number(String(c.size).split('x')[0]), lengthOf = (c) => Number(String(c.size).split('x')[1]);

  /* What the building has, always a real choice for its porch. */
  const railOf = (c) => { const list = RAILS[c.package]; return list ? list.find((r) => r[0] === c.railing) || list[0] : null; };
  const railColorOf = (c) => (c.railColor === 'Black' ? 'Black' : 'White');
  const hasRail = (c) => { const r = railOf(c); return !!r && r[0] !== 'No railing'; };
  const deepOk = (c) => lengthOf(c) >= 12;
  const depthOf = (c) => (c.package === 'End Porch' && Number(c.porchDepth) === 8 && deepOk(c) ? 8 : 4);
  const loftAsked = (c) => c.package === 'End Porch' && c.style === 'Lofted';
  const loftOf = (c) => (loftAsked(c) ? LOFTS.find((l) => l[0] === c.porchLoft) || LOFTS[0] : null);

  /* Why this building cannot have this porch, in plain words. Empty when it can. */
  function porchBlocked(name, c) {
    if (name === 'Deluxe Porch' && widthOf(c) <= 10) return 'Not on a building 10 ft wide or narrower. Pick 12 ft wide or more on the Size step.';
    if (c.style === 'Lofted' && (name === 'Middle Porch' || name === 'Deluxe Porch')) return 'Not on a lofted barn. A lofted barn can have an End Porch, a Side Porch or a Full Side Porch.';
    return '';
  }
  window.porchBlocked = porchBlocked;

  /* Keep the building's porch facts in step with its package. Says what it changed. */
  function tidy(c) {
    const said = [];
    if (!c || !c.catalogOptions && !isPorch(c)) return said;
    if (RAILS[c.package] && porchBlocked(c.package, c)) {
      said.push(`This building cannot have a ${c.package}, so the package was set back to Standard Storage.`);
      c.package = 'Standard Storage';
    }
    if (!isPorch(c)) {
      for (const k of ['railing', 'railColor', 'porchDepth', 'porchLoft']) delete c[k];
      if (c.extras) delete c.extras[RAIL_LINE];
      return said;
    }
    const r = railOf(c);
    if (c.railing && c.railing !== r[0]) said.push(`Porch railing set back to “${r[0]}” for this porch.`);
    c.railing = r[0];
    c.extras ||= {};
    if (r[1] > 0) c.extras[RAIL_LINE] = r[1];
    else delete c.extras[RAIL_LINE];
    if (hasRail(c)) c.railColor = railColorOf(c);
    else delete c.railColor;
    if (c.package !== 'End Porch') { delete c.porchDepth; delete c.porchLoft; }
    else {
      if (Number(c.porchDepth) === 8 && !deepOk(c)) said.push('The porch was set back to 4 ft deep. An 8 ft porch needs a building 12 ft long or longer.');
      c.porchDepth = depthOf(c);
      if (loftAsked(c)) c.porchLoft = loftOf(c)[0];
      else delete c.porchLoft;
    }
    return said;
  }
  const tidyAndSay = (c) => { const said = tidy(c); if (said.length) toast(said.join(' ')); return said.length; };

  /* What the plant and the order read, in words. */
  function porchNotes(c) {
    if (!isPorch(c)) return [];
    const r = railOf(c), out = [];
    if (c.package === 'End Porch') out.push(`Porch ${depthOf(c)} ft deep`);
    const loft = loftOf(c);
    if (loft) out.push(`Porch ceiling: ${loft[1].toLowerCase()} (${loft[2].toLowerCase()})`);
    out.push(`Porch railing: ${r[0]}${r[1] ? ` · ${r[1]} ft` : ''}${r[2] === 'In the package' ? ' (in the package)' : ''}`);
    if (hasRail(c)) out.push(`${railColorOf(c)} railing`);
    return out;
  }
  window.porchNotes = porchNotes;

  /* ---------- the price ---------- */
  if (typeof taAddonRows === 'function') {
    /* Off the last step's list: it is picked by name on the Package step now. */
    const a = taAddon(RAIL_LINE);
    if (a) {
      const was = a[3];
      a[3] = (c) => was(c) && isPorch(c) && railOf(c)[1] > 0 && Number(c.extras?.[RAIL_LINE]) === railOf(c)[1];
    }
    const baseAddons = taAddonsMarkup;
    taAddonsMarkup = function (c) {
      if (!a) return baseAddons(c);
      const test = a[3];
      a[3] = () => false;
      try { return baseAddons(c); } finally { a[3] = test; }
    };
    const baseRows = taAddonRows;
    taAddonRows = function (c) {
      return baseRows(c).map((row) => (row.addon === RAIL_LINE ? { ...row, name: `Porch railing: ${railOf(c)[0]} · ${railOf(c)[1]} ft`, source: `${PRICE_LIST_SOURCE} · ${railOf(c)[1]} ft at ${money(rate())} a ft` } : row));
    };
  }
  {
    const base = breakdown;
    breakdown = function (c = S.c) {
      const rows = base(c);
      if (depthOf(c) !== 8) return rows;
      const row = { name: '8 ft deep end porch', amount: depthPrice(), source: (typeof PRICE_LIST_SOURCE === 'string' ? PRICE_LIST_SOURCE : 'Price list') + ' · 8 ft end porch package less the end porch package' };
      const at = rows.findIndex((r) => r.name === 'End Porch');
      const fuel = rows.find((r) => r.name === 'Fuel surcharge');
      if (at >= 0) rows.splice(at + 1, 0, row);
      else rows.splice(fuel ? rows.indexOf(fuel) : rows.length, 0, row);
      if (fuel && !fuel.needed && typeof ofFuelFor === 'function') {
        const amount = ofFuelFor(c, rows.reduce((t, r) => t + (r === fuel ? 0 : r.amount), 0));
        if (amount != null) fuel.amount = amount;
      }
      return rows;
    };
  }
  /* The package's own words follow the depth; the quote, order and invoice list the choices. */
  {
    const base = activePackage;
    activePackage = function (c) {
      const d = base(c);
      return d && depthOf(c) === 8 ? { ...d, porch: d.porch.replace('4-ft', '8-ft') } : d;
    };
    const baseIncluded = included;
    included = function (c) {
      const list = baseIncluded(c);
      if (!isPorch(c)) return list;
      /* the railing with feet is already listed as a price line; do not say it twice */
      const notes = porchNotes(c).filter((n) => !(/^Porch railing: /.test(n) && railOf(c)[1] > 0 && list.some((x) => /^Porch railing: /.test(x))));
      return [...list, ...notes];
    };
  }

  /* ---------- the Package step ---------- */
  const opt = (on, click, name, note, price, id) =>
    `<button type="button" class="po-opt${on ? ' on' : ''}" ${id ? `id="${id}" ` : ''}aria-pressed="${on}" onclick="${click}"><span class="po-dot" aria-hidden="true"></span><span class="grow"><strong>${esc(name)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</span><em>${price}</em></button>`;
  function porchMarkup(c) {
    if (!isPorch(c)) return '';
    const r = railOf(c), per = rate();
    let html = '<div class="po-box" id="po-box">';
    if (c.package === 'End Porch') {
      html += `<h3>How deep is the porch?</h3><div class="po-list" id="po-depth">${
        opt(depthOf(c) === 4, "porchSet('porchDepth',4)", '4 ft porch', '', 'Included') +
        (deepOk(c)
          ? opt(depthOf(c) === 8, "porchSet('porchDepth',8)", '8 ft porch', '', '+' + money(depthPrice()))
          : `<button type="button" class="po-opt" disabled><span class="po-dot" aria-hidden="true"></span><span class="grow"><strong>8 ft porch</strong><small>Needs a building 12 ft long or longer.</small></span></button>`)
      }</div>`;
      if (loftAsked(c))
        html += `<h3>Porch ceiling</h3><div class="po-list" id="po-loft">${LOFTS.map((l) => opt(loftOf(c)[0] === l[0], `porchSet('porchLoft','${l[0]}')`, l[1], l[2], '')).join('')}</div>`;
    }
    html += `<h3>Porch railing</h3><div class="po-list" id="po-rail">${RAILS[c.package]
      .map((x) => opt(x[0] === r[0], `porchSet('railing',${esc(JSON.stringify(x[0]))})`, x[0], x[2] || (x[1] ? `${x[1]} ft of railing` : ''), x[1] ? '+' + money(x[1] * per) : x[2] === 'In the package' ? 'Included' : money(0)))
      .join('')}</div>`;
    if (hasRail(c))
      html += `<h3>Railing color</h3><div class="segrow po-color" id="po-color">${['White', 'Black'].map((k) => `<button type="button" class="seg${railColorOf(c) === k ? ' on' : ''}" aria-pressed="${railColorOf(c) === k}" onclick="porchSet('railColor','${k}')"><strong>${k} railing</strong></button>`).join('')}</div>`;
    html += `<p class="source">Railing is priced by the foot from the price list (${money(per)} a foot). Each choice is a set number of feet, so nobody has to measure.</p></div>`;
    return html;
  }
  window.porchSet = function (key, value) {
    S.c[key] = value;
    tidy(S.c);
    render();
  };
  {
    const base = packageVariantMarkup;
    packageVariantMarkup = function (c) { return base(c) + porchMarkup(c); };
  }

  /* ---------- keeping it in step ---------- */
  {
    const base = change;
    change = function (key, value, resolve) {
      const before = S.c.package;
      base(key, value, resolve);
      if (!['package', 'style', 'size'].includes(key)) return;
      const hadRail = S.c.railing;
      if (S.c.package !== before) delete S.c.railing; /* a new porch starts on its own first choice */
      const said = tidy(S.c);
      if (S.c.package !== before && hadRail && isPorch(S.c) && hadRail !== S.c.railing) said.push(`Porch railing set to “${S.c.railing}” for this porch.`);
      if (said.length) toast(said.join(' '));
      render();
    };
  }
  /* A kept sale, or an older one with typed feet, is brought in line when it is picked up. */
  if (typeof window.saleDraftResume === 'function') {
    const base = window.saleDraftResume;
    window.saleDraftResume = function () {
      base.apply(this, arguments);
      try { if (tidyAndSay(S.c)) render(); } catch (e) {}
    };
  }
  {
    const base = render;
    let seen = null;
    render = function () {
      /* quiet: only when a building reaches the designer by another road (a quote reopened, a lot unit) */
      try { if (S.page === 'configure' && S.path !== 'lot' && S.c !== seen) { seen = S.c; tidy(S.c); } } catch (e) {}
      return base.apply(this, arguments);
    };
  }

  /* ---------- the explainer page ---------- */
  try {
    AW_REAL.sales.push('Porch railing is picked by name on the Package step. The app sets the feet and the price.');
    AW_OPEN.push(['Porch railing rate', 'Every railing choice is a set number of feet at $40.00 a foot (Turbo Assist’s “Porch Railing (Per Linear Ft)”). Is $40.00 still the rate?']);
    AW_OPEN.push(['Deluxe Porch with no railing', 'Taking the railing off a Deluxe Porch gives no money back, the same as IdeaRoom. Is that right?']);
    AW_OPEN.push(['Railing with the door in the center', 'It costs $80.00 more than door on the left or right (16 ft against 14 ft). Confirm.']);
    AW_OPEN.push(['Full Side Porch price', 'The price list has no line for a Full Side Porch package, so its price says “to confirm” and is left out of the total. Its railing is 24 ft ($960.00).']);
    AW_OPEN.push(['Lofted end porch ceiling', 'High ceiling (no loft over the porch) or low ceiling (loft over it) is asked on a lofted barn. Turbo Assist has no place for the answer yet.']);
  } catch (e) {}
}
