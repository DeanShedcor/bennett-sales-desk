/* idearoom-more.js: three more things the owner set to match the IdeaRoom designer (Nov 19, 2026).
   Prices and rules only, as facts. No IdeaRoom code or pictures; the color samples are our own.

   1. Shingle color. With a shingle roof the Colors step asks the color: seven names, no charge.
   2. Silver Bullet. All 25 sizes. A 6 ft or 7 ft wall (7 ft is $0.50 a sq ft, and is where every
      size starts except 6 × 8, 8 × 8, 8 × 10 and 8 × 12, as in IdeaRoom). Colored metal on the roof
      as well as the siding: one charge for the building, $1.75 a sq ft for a standard color, $2.50
      for a premium color, whichever is higher. Pine finish trim: the price list's line for the
      size, and $1.75 a sq ft on a 14 ft wide (read from IdeaRoom at 14 × 20 and 14 × 40).
   3. The Deluxe Porch starts at 12 × 16 (catalog-options.js).

   Hooks: sizeLengths, colorsMarkup(), stepBody(), breakdown(), change(), included(), bsLayout().
   Loaded after idearoom-extras.js and before idearoom-match.js. */
const shingleColors = { Charcoal: '#3f4144', Shakewood: '#8b7355', 'Weathered Wood': '#6f675c', Barkwood: '#5b4b3e', Hickory: '#7c5f40', Slate: '#59646d', 'Pewter Gray': '#8c8f91' };
{
  const SRC = 'Matches IdeaRoom';
  const tl = (name, fallback) => (typeof taListPrice === 'function' ? taListPrice(name) : null) ?? fallback;
  const dims = (c) => String(c.size).split('x').map(Number);
  const sqft = (c) => dims(c)[0] * dims(c)[1];
  const cents = (n) => Math.round(n * 100) / 100;
  const bullet = (c) => c.style === 'Silver Bullet';

  /* ---------- 1. shingle color ---------- */
  const shingled = (c) => c.roof === 'Shingles' && !['Greenhouse', 'Silver Bullet'].includes(c.style);
  const shingleOf = (c) => (shingled(c) ? (shingleColors[c.shingleColor] ? c.shingleColor : 'Charcoal') : null);
  window.shingleOf = shingleOf;

  /* ---------- 2. Silver Bullet ---------- */
  sizeLengths['Silver Bullet'] = { 6: [8], 8: [8, 10, 12, 16], 10: [10, 12, 16, 20, 24], 12: [12, 14, 16, 20, 24, 28, 32, 36, 40], 14: [20, 24, 28, 32, 36, 40] };
  const startsTall = (c) => { const [w, l] = dims(c); return w >= 10 || l >= 16; };
  const bulletWall = (c) => (Number(c.wallHeight) === 6 || Number(c.wallHeight) === 7 ? Number(c.wallHeight) : startsTall(c) ? 7 : 6);
  const wallRate = () => tl('Bullet Tall Wall Siding', 0.5);
  const tier = (name) => (Object.hasOwn(bulletPremium, name) ? 2 : Object.hasOwn(bulletStandard, name) ? 1 : 0);
  const rates = () => [0, tl('Colored Bullet', 1.75), tl('Colored Bullet Custom', 2.5)];
  const colorTier = (c) => Math.max(tier(c.color), tier(c.roofColor));
  const colorAmount = (c, t = colorTier(c)) => cents(sqft(c) * rates()[t]);
  const pineOn = (c) => bullet(c) && c.bulletTrim === 'Pine';
  const pinePrice = (c) => tl(`Pine Finish Metal Trim ${c.size}`, null) ?? cents(sqft(c) * rates()[1]);
  window.ixBullet = function (key, value) {
    const c = S.c;
    if (key === 'wallHeight') { c.wallHeight = value; c.bulletWallSet = true; }
    if (key === 'bulletTrim') { if (value) c.bulletTrim = value; else delete c.bulletTrim; }
    render();
  };
  function tidy(c) {
    if (!c) return;
    if (bullet(c)) {
      if (!c.bulletWallSet || ![6, 7].includes(Number(c.wallHeight))) c.wallHeight = startsTall(c) ? 7 : 6;
      if (c.roofColor !== 'Galvalume' && !tier(c.roofColor)) c.roofColor = 'Galvalume';
    } else {
      if (c.bulletWallSet) { delete c.bulletWallSet; delete c.wallHeight; }
      delete c.bulletTrim;
      if (c.roofColor && !Object.hasOwn(metalRoofColors, c.roofColor)) delete c.roofColor;
    }
    if (shingled(c)) c.shingleColor = shingleOf(c);
    else delete c.shingleColor;
  }
  {
    const base = change;
    change = function (key, value, resolve) {
      const was = S.c.style;
      base(key, value, resolve);
      if (key === 'style' && value === 'Silver Bullet' && was !== value) { delete S.c.bulletWallSet; S.c.roofColor = 'Galvalume'; }
      if (key === 'size' && bullet(S.c) && !S.c.bulletWallSet) delete S.c.wallHeight;
      tidy(S.c);
      if (['style', 'size', 'roof'].includes(key) || (bullet(S.c) && ['color', 'roofColor'].includes(key))) render();
    };
    const baseRender = render;
    let seen = null;
    render = function () {
      try { if (S.page === 'configure' && S.path !== 'lot' && S.c !== seen) { seen = S.c; tidy(S.c); } } catch (e) {}
      return baseRender.apply(this, arguments);
    };
  }
  {
    const base = colorsMarkup;
    colorsMarkup = function () {
      const c = S.c;
      if (!bullet(c)) return base();
      const [, std, prem] = rates(), now = colorTier(c);
      const group = (key, title) => `<h3>${title}</h3><h4>No color · included</h4>${finishSwatches(key, { Galvalume: '#a7a9a7' }, 'ribbed')}<h4>Standard colors</h4>${finishSwatches(key, bulletStandard, 'ribbed')}<h4>Premium colors</h4>${finishSwatches(key, bulletPremium, 'ribbed')}`;
      const seg = (on, click, text, small) => `<button type="button" class="seg${on ? ' on' : ''}" aria-pressed="${on}" onclick="${click}"><strong>${text}</strong><small>${small}</small></button>`;
      return `<p class="${now ? 'notice' : 'source'}" id="im-color-note">${now ? `<strong>Colored metal: +${money(colorAmount(c))}.</strong> ` : ''}Color is one charge for the whole building: ${money(std)} a sq ft (${money(colorAmount(c, 1))}) with a standard color, ${money(prem)} a sq ft (${money(colorAmount(c, 2))}) with a premium color on the roof or the siding. Plain Galvalume costs nothing more.</p>` +
        group('color', 'Metal siding') + group('roofColor', 'Metal roof') +
        `<h3>Metal trim</h3><div class="segrow im-trim" id="im-trim">${seg(!pineOn(c), "ixBullet('bulletTrim',null)", 'Standard trim', 'Included')}${seg(pineOn(c), "ixBullet('bulletTrim','Pine')", 'Pine finish trim', '+' + money(pinePrice(c)))}</div>` +
        '<p class="source">Color samples are close, not exact.</p>';
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
      if (step === 'Size' && bullet(c)) {
        const h = bulletWall(c), price = cents(sqft(c) * wallRate());
        const seg = (on, v, text, small) => `<button type="button" class="seg${on ? ' on' : ''}" aria-pressed="${on}" onclick="ixBullet('wallHeight',${v})"><strong>${text}</strong><small>${small}</small></button>`;
        const box = `<div class="im-wall" id="im-wall"><h3>Sidewall Height</h3><div class="segrow">${seg(h === 6, 6, '6 ft Side Wall', 'Included')}${seg(h === 7, 7, '7 ft Side Wall', '+' + money(price))}</div><p class="source">A 7 ft wall is ${money(wallRate())} a sq ft. ${startsTall(c) ? 'This size starts on the 7 ft wall.' : 'This size starts on the 6 ft wall.'}</p></div>`;
        const at = html.indexOf('<p class="draft-note">');
        html = at >= 0 ? html.slice(0, at) + box + html.slice(at) : html + box;
      }
      if (step === 'Colors' && shingled(c)) {
        const pick = `<p class="source" id="roof-shingle-note"><strong>Architectural shingles.</strong> Pick the shingle color. It costs nothing more. To change the roof, go back to Exterior.</p><div id="im-shingles">${finishSwatches('shingleColor', shingleColors, 'shingle')}</div>`;
        html = html.replace(/<p class="notice" id="roof-shingle-note">[\s\S]*?<\/p>/, pick).replace('<h3>Roof color</h3>', '<h3>Shingle color</h3>');
      }
      return [out[0], html];
    };
  }

  /* ---------- the price ---------- */
  {
    const base = breakdown;
    breakdown = function (c = S.c) {
      let rows = base(c);
      if (window.irOld || !bullet(c)) return rows;
      rows = rows.filter((r) => !/^(Standard|Premium) metal siding · /.test(r.name));
      const fuel = rows.findIndex((r) => r.name === 'Fuel surcharge'), add = [];
      if (bulletWall(c) === 7) add.push({ name: '7 ft sidewalls · tall wall siding', amount: cents(sqft(c) * wallRate()), source: `${SRC} · ${money(wallRate())} per sq ft of floor` });
      const t = colorTier(c);
      if (t) add.push({ name: `Colored metal · ${t === 2 ? 'premium' : 'standard'} color (${[tier(c.color) ? c.color + ' siding' : '', tier(c.roofColor) ? c.roofColor + ' roof' : ''].filter(Boolean).join(', ')})`, amount: colorAmount(c), source: `${SRC} · ${money(rates()[t])} per sq ft, one charge for the building` });
      if (pineOn(c)) add.push({ name: 'Pine finish metal trim', amount: pinePrice(c), source: tl(`Pine Finish Metal Trim ${c.size}`, null) != null ? `${PRICE_LIST_SOURCE} · the line for a ${c.size.replace('x', ' × ')}` : `${SRC} · ${money(rates()[1])} per sq ft` });
      rows.splice(fuel >= 0 ? fuel + 1 : rows.length, 0, ...add);
      return rows;
    };
  }

  /* ---------- what the quote, the order and the plant read ---------- */
  {
    const base = included;
    included = function (c) {
      const list = base(c), add = [];
      if (shingled(c)) add.push(`${shingleOf(c)} shingles`);
      if (bullet(c)) { add.push(`${bulletWall(c)} ft sidewalls`); if (pineOn(c)) add.push('Pine finish metal trim'); }
      return [...list, ...add];
    };
    if (typeof bsLayout === 'function') {
      const sheet = bsLayout;
      bsLayout = function (c) {
        const lay = sheet(c), add = [];
        if (shingled(c)) add.push(`Shingle color: ${shingleOf(c)}.`);
        if (bullet(c)) { add.push(`Sidewalls: ${bulletWall(c)} ft.`); if (pineOn(c)) add.push('Metal trim: pine finish.'); }
        return add.length ? { ...lay, notes: [...add, ...lay.notes] } : lay;
      };
    }
  }

  try {
    AW_REAL.sales.push('A shingle roof asks its color. A Silver Bullet comes in 25 sizes, with a 6 ft or 7 ft wall, colored metal and pine finish trim.');
    AW_OPEN.push(['Shingle colors', 'Charcoal, Shakewood, Weathered Wood, Barkwood, Hickory, Slate and Pewter Gray, the names in IdeaRoom. Turbo Assist has no place for the shingle color yet: a feature the product still has to accept.']);
    AW_OPEN.push(['Silver Bullet', '7 ft walls are $0.50 a sq ft and most sizes start on them. Color is one charge, $1.75 or $2.50 a sq ft. Pine finish trim uses the list’s line for the size, and $1.75 a sq ft on a 14 ft wide. Other trim colors are not asked here. Whether pine trim adds to the color charge or shares it was not read.']);
    AW_OPEN.push(['Deluxe Porch size', 'The Deluxe Porch starts at 12 × 16, the same as IdeaRoom. It used to start at 12 × 20.']);
  } catch (e) {}
}
