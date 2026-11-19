/* idearoom-names.js: names changed to IdeaRoom's words where both designers had the same thing under
   two names (the owner, Nov 19, 2026). Only the words on screen and on paper change; what is kept
   on the sale (c.style "Studio", c.electrical "Basic", c.package "Side Porch") stays as it was, so
   Turbo Assist's own names for the plant do not move.

   Old -> new
   - Studio -> Craftsman Studio (Basic / Classic / Elite Craftsman Studio)
   - Lights Only electrical -> Lights Only Package; Basic / Expanded / Utility electrical ->
     Basic / Expanded / Utility Electrical Package
   - Sidewall height 6 ft / 7 ft -> Sidewall Height: 6 ft Side Wall / 7 ft Side Wall
   - Side Porch, Deluxe Porch -> Side Porch - Left / Right, Deluxe Porch - Left / Right
   - 6x7 / 8x7 / 9x7 Roll-up Door -> Rollup Door
   - Build on site (price line) -> Build on Site Surcharge · customer is responsible for permits
   - Siding: IdeaRoom's full siding names are shown in small print under ours
   Kept as ours: "ft" in place of the ' mark, "Lofted Barn", "Greenhouse" (IdeaRoom's "Greenhouse
   Utility" waits for a Greenhouse Studio), and the short "Basic electrical" on the bottom bar.

   Hooks: label(), breakdown(), included(), stepBody(), doorOptions. Loaded last. */
{
  const ELEC = { 'Lights Only': 'Lights Only Package', Minimal: 'Lights Only Package', Basic: 'Basic Electrical Package', Expanded: 'Expanded Electrical Package', Utility: 'Utility Electrical Package', Workshop: 'Workshop Electrical Package' };
  const sided = (c) => (c.package === 'Side Porch' || c.package === 'Deluxe Porch' ? `${c.package} - ${c.porchSide === 'Right' ? 'Right' : 'Left'}` : null);
  window.SITE_LINE = 'Build on Site Surcharge · customer is responsible for permits';

  for (const d of doorOptions) if (/ Roll-up Door$/.test(d[1] || '')) d[1] = d[1].replace(' Roll-up Door', ' Rollup Door');

  {
    const base = label;
    label = function (c) { return base(c).replace(/ Studio$/, ' Craftsman Studio'); };
  }
  {
    const base = breakdown;
    breakdown = function (c = S.c) {
      const rows = base(c), side = sided(c);
      for (const r of rows) {
        if (r.name === 'Build on site') r.name = window.SITE_LINE;
        else if (r.name === '7 ft sidewalls (tall wall)') r.name = '7 ft Side Wall';
        else if (r.name === '7 ft sidewalls · tall wall siding') r.name = '7 ft Side Wall · tall wall siding';
        else if (r.name === 'Permitting fee · 7 ft sidewalls on a lofted barn') r.name = 'Permitting fee · 7 ft Side Wall on a lofted barn';
        else if (side && r.name === c.package) r.name = side;
        else if (/ electrical package$/.test(r.name) && ELEC[r.name.replace(/ electrical package$/, '')]) r.name = ELEC[r.name.replace(/ electrical package$/, '')];
      }
      return rows;
    };
  }
  {
    const base = included;
    included = function (c) {
      const side = sided(c);
      return base(c).map((x, i) => (i === 0 && side && x === c.package ? side
        : x === `${c.electrical} electrical` && ELEC[c.electrical] ? ELEC[c.electrical]
        : /^(\d)-ft sidewalls$/.test(x) ? x.replace(/^(\d)-ft sidewalls$/, '$1 ft Side Wall')
        : /^(\d) ft sidewalls$/.test(x) ? x.replace(/^(\d) ft sidewalls$/, '$1 ft Side Wall') : x))
        .filter((x) => !(side && /^Porch on the (left|right)$/.test(x)));
    };
  }
  {
    const base = stepBody;
    stepBody = function () {
      const out = base();
      if (!Array.isArray(out)) return out;
      const step = steps[S.step];
      let html = out[1];
      if (step === 'Style') html = html.replace('<strong>Studio</strong>', '<strong>Craftsman Studio</strong>');
      if (step === 'Size') html = html.replace('<label>Sidewall height<select', '<label>Sidewall Height<select').replace(/>6 ft<\/option>/, '>6 ft Side Wall</option>').replace(/>7 ft( · [^<]*)?<\/option>/, (m, more) => `>7 ft Side Wall${more || ''}</option>`);
      if (step === 'Electrical') for (const [id, name] of Object.entries(ELEC)) html = html.replace(`<strong>${id} electrical</strong>`, `<strong>${name}</strong>`);
      if (step === 'Exterior') html = html.replace('<small>LP 3/8-inch groove · Basic or Classic with TechShield', '<small>LP 3/8" 8" OC Groove · Basic, or Classic with TechShield').replace('<small>Elite series · supported by catalog rule', '<small>LP Smartside 8" Lap with 7/16" Tech Shield · Elite series');
      return [out[0], html];
    };
  }
  try { AW_REAL.sales.push('Names follow IdeaRoom: Craftsman Studio, Electrical Package, Side Wall, Side Porch - Left or Right, Rollup Door, Build on Site Surcharge.'); } catch (e) {}
}
