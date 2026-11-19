/* idearoom-match.js: prices the owner set to match the IdeaRoom designer (Nov 19, 2026).

   The owner compared this app with the IdeaRoom designer the lots use today and chose IdeaRoom's
   number wherever the two differed. Only prices and rules are taken, as facts. No IdeaRoom code or
   pictures are used.

   1. Starting prices. IdeaRoom's price for every style and size is Turbo Assist's list plus 5%,
      to the nearest dollar. That held at all 434 sizes read from IdeaRoom, so every size here is
      the list price times 1.05. The list as Jordan keeps it stays in PRICE_LIST_TA.
   2. Build on site. 40% of everything else on the price, fuel included, in place of $0.30 a sq ft.
   3. Full Side Porch. $840 plus $110 for each foot of the building's length.
   Each one differs from Jordan's price list and is on the list of questions for him.

   Hooks: PRICE_LIST (prices.js), breakdown(), packageReference(), ofFuelFor() (office.js).
   Loaded last. */
{
  /* ---------- 1. starting prices ---------- */
  const UP = 105; /* percent of the Turbo Assist list */
  window.PRICE_LIST_TA = {};
  for (const [model, sizes] of Object.entries(PRICE_LIST)) {
    window.PRICE_LIST_TA[model] = { ...sizes };
    for (const size of Object.keys(sizes)) sizes[size] = Math.floor((Math.round(sizes[size] * 100) * UP) / 10000 + 0.5);
  }
  const BASE_SOURCE = 'Matches IdeaRoom · Turbo Assist price list plus 5%';

  /* ---------- 2. build on site ---------- */
  const SITE_PART = 0.4;
  window.buildOnSiteShare = SITE_PART;

  /* A sample order that was sold before these prices came in keeps the prices it was sold at, so the
     office's "price matches the price list" check and its invoice lines still agree with its total. */
  const soldBefore = (c) => { try { return (S.sales || []).some((s) => s.sample && s.c === c); } catch (e) { return false; } };
  window.irOld = false;
  function atOldPrices(fn) {
    const now = {};
    for (const [model, sizes] of Object.entries(PRICE_LIST)) { now[model] = { ...sizes }; Object.assign(sizes, window.PRICE_LIST_TA[model]); }
    window.irOld = true;
    try { return fn(); } finally {
      window.irOld = false;
      for (const [model, sizes] of Object.entries(PRICE_LIST)) Object.assign(sizes, now[model]);
    }
  }
  {
    const base = breakdown;
    breakdown = function (c = S.c) {
      if (window.irOld) return base(c);
      if (soldBefore(c)) return atOldPrices(() => base(c));
      const rows = base(c);
      for (const r of rows) if (/ base price$/.test(r.name) && r.source === PRICE_LIST_SOURCE) r.source = BASE_SOURCE;
      const site = rows.find((r) => r.name === 'Build on site');
      const fuel = rows.find((r) => r.name === 'Fuel surcharge');
      /* a fuel charge that follows the price is worked out before the 40%, as IdeaRoom does */
      if (fuel && !fuel.needed && typeof ofFuelFor === 'function' && typeof OF !== 'undefined' && OF.set?.fuel?.method === 'percent') {
        const amount = ofFuelFor(c, rows.reduce((t, r) => t + (r === fuel || r === site ? 0 : r.amount), 0));
        if (amount != null) fuel.amount = amount;
      }
      if (!site) return rows;
      const rest = rows.reduce((t, r) => t + (r === site || r.needed ? 0 : Number(r.amount) || 0), 0);
      site.amount = Math.round(rest * SITE_PART * 100) / 100;
      site.name = 'Build on site';
      site.source = 'Matches IdeaRoom · 40% of the rest of the price. The customer is responsible for permits.';
      /* last on the list, so it reads as a charge on everything above it */
      rows.splice(rows.indexOf(site), 1);
      rows.push(site);
      return rows;
    };
  }

  /* ---------- 3. Full Side Porch ---------- */
  const FULL_SIDE = [840, 110];
  {
    const base = packageReference;
    packageReference = function (c, name = c.package) {
      if (name === 'Full Side Porch' && !window.irOld) return FULL_SIDE[0] + FULL_SIDE[1] * Number(String(c.size).split('x')[1]);
      return base(c, name);
    };
  }

  /* ---------- the explainer page ---------- */
  try {
    AW_REAL.sales.push('Starting prices, build on site and the Full Side Porch match the IdeaRoom designer.');
    AW_OPEN.push(['Starting prices', 'Every starting price is Turbo Assist’s list plus 5%, the same as IdeaRoom (a 12 × 16 Basic Utility is $6,164.00; the list says $5,870.00). Which one is current?']);
    AW_OPEN.push(['Build on site', 'Build on site adds 40% of the rest of the price, the same as IdeaRoom. Turbo Assist’s list says $0.30 a sq ft. Which is right?']);
    AW_OPEN.push(['Full Side Porch price', 'A Full Side Porch is $840.00 plus $110.00 for each foot of length, the same as IdeaRoom. The price list has no line for it. Its railing is 24 ft ($960.00).']);
  } catch (e) {}
}
