/* office-link.js: the Office's lists and the other sides agree.

   1. Option prices. Windows, doors, electrical, packages and the other options the Sales desk
      charges now read the same published list as Model pricing > Options and packages. A lot's own
      price and a price set to go live on a date work for options the way they do for buildings.
      Turbo Assist: the org's price book through `resolve_pricing`; this is the preview's copy.
   2. The rent-to-own Money box shows the damage waiver, so the first payment adds up.
   3. A person limited to some lots sees only those lots in Requests, returns, change orders, the
      heading, the lot picker, the bell and Plant QC. Turbo Assist: `organization_members` roles and
      the lot/plant assignment; hiding other lots' rows is a feature the product still has to accept.
   Loaded after admin.js and office-guards.js. */

/* ---------- 1. One price list ---------- */
/* A lot's own price on an option is stored beside its building prices, under "item|<name>". The
   pricing page reaches list items through PRICE_LIST.item, so its draft, publish, set-a-date and
   undo code handles them exactly as it handles a building size. */
Object.defineProperty(PRICE_LIST, 'item', {
  enumerable: false,
  get() {
    const out = {};
    for (const { x } of adItems()) out[x.name] = x.price;
    return out;
  },
});
/* Today's price for a list item at the lot being priced (the desk's lot unless the office is
   working on another lot's order). */
function plPrice(name) {
  const item = adItem(name);
  if (!item) return null;
  return AD.over[AD.lotCtx || DESK_LOT]?.['item|' + name] ?? item.price;
}

/* The Sales desk's own option names, and the list item each one is priced from. */
const PL_WINDOWS = { '2x3 Standard': '2x3 window - White', '3x3 Standard': '3x3 Window - White', '2x3 Insulated': '2x3 White Insulated Window', '3x3 Insulated': '3x3 White Insulated Window', Octagon: '18x18 Octagonal Window' };
const PL_WINDOW_EXTRAS = { shutters: 'Shutters (1 set per window)', flower: 'Flower Boxes', transom: 'Transom Window' };
const PL_DOORS = {
  Single: "Single Wood Door 4' Wide", Double: 'Double Wood Door', 'Shed Door w/Transom': 'Transom Single Door', 'Double Shed Door w/ Transom': 'Transom Double Door',
  'Fiberglass Door': 'Solid Fiberglass Door Left Hand In Swing Short', '36" 9 Lite Door': '9 Lite Fiberglass Door Right Hand Out Swing Short', '36" 15 Lite Door': '15 Lite Left Hand Inswing Short',
  'Double 9 Lite Door': '9 Lite French Door', 'Double 15 Lite Door': '15 Lite Fiberglass French Door Right Side Active In Swing', 'Double Solid Fiberglass Door': 'Solid Fiberglass French Door', 'Double Full Lite Door': 'Full Lite French Door',
  '6x7 Rollup Door': '6x7 Roll Up', '8x7 Rollup Door': '8x7 Roll Up', '9x7 Rollup Door': '9x7 Roll Up',
};
const PL_ELECTRICAL = { 'Lights Only': 'Light Only', Minimal: 'Light Only', Basic: 'Basic Package', Expanded: 'Expanded Package', Utility: 'Utility Package' };
const PL_ELECTRICAL_EXTRAS = { extraLights: 'Extra (high) Electrical Receptacle/Switch/Light', extraSwitches: 'Extra (low) Electrical Receptacle/Switch/Light', extraReceptacles: 'Additional Outlet' };
const PL_PACKAGES = { 'End Porch': 'End Porch Package', 'Middle Porch': 'Middle Porch Package', 'Side Porch': 'Side Porch Package', 'Deluxe Porch': 'Deluxe Porch Package' };
const PL_DORMERS = ['8ft Dormer Package', '12ft Dormer Package', '12ft Gable Dormer Package'];
/* Priced straight from the list by name elsewhere (prices.js and turbo-sales.js). */
const PL_BY_NAME = ['Shingle Roof', 'Floor Joists 12" On Center (per sq. ft. of floor)', 'Accent Gable', 'Custom color', 'Dual Color Per Sq Ft', 'Door Accent Color (Single Door)', 'Doors Accent Color (Double Doors)', 'Single Fiberglass Door Accent Color',
  '8x7 Rollup Garage Package', '9x7 Rollup Garage Package', 'Greenhouse Electrical', 'Build On Site', 'High Wall Utility per SQ FT', 'Lofted High Walls'];
/* Colors of one window the desk does not ask about: it charges the White price. */
const PL_SAME_AS = { '2x3 Window - Black': '2x3 window - White', '2x3 Window - Brown': '2x3 window - White', '3x3 Window - Black': '3x3 Window - White', '3x3 Window - Brown': '3x3 Window - White' };
/* On the desk, but with no line on the list: these keep their fixed price. */
const PL_DESK_ONLY = ['Workshop electrical package', '36 in full-lite door', 'Extra side door'];
const PL_SOLD = new Set([...Object.values(PL_WINDOWS), ...Object.values(PL_WINDOW_EXTRAS), ...Object.values(PL_DOORS), ...Object.values(PL_ELECTRICAL), ...Object.values(PL_ELECTRICAL_EXTRAS), ...Object.values(PL_PACKAGES), ...PL_DORMERS, ...PL_BY_NAME, ...(typeof TA_ADDONS !== 'undefined' ? TA_ADDONS.map((a) => a[0]) : [])]);

/* Copy the list's prices into the desk's own price tables, for the lot being priced. */
function plSync() {
  const set = (obj, key, name) => { const p = plPrice(name); if (p != null) obj[key] = p; };
  for (const [k, name] of Object.entries(PL_WINDOWS)) if (windowCatalog[k]) set(windowCatalog[k], 1, name);
  for (const [k, name] of Object.entries(PL_DOORS)) set(doorPrices, k, name);
  for (const [k, name] of Object.entries(PL_ELECTRICAL)) set(electricalPrices, k, name);
  for (const [k, name] of Object.entries(PL_ELECTRICAL_EXTRAS)) set(electricalExtraPrices, k, name);
  for (const [k, name] of Object.entries(PL_PACKAGES)) set(referencePackagePrices, k, name);
  PL_DORMERS.forEach((name, i) => set(dormerOptions[i], 'price', name));
  /* The Electrical step's cards carry their price as words. */
  for (const row of electricalChoices) if (PL_ELECTRICAL[row[0]] && electricalPrices[row[0]] != null) row[3] = '+' + money(electricalPrices[row[0]]).replace(/\.00$/, '');
}
/* A window's price: the window, plus shutters, a flower box or a transom, each from the list. */
windowPrice = function (w) {
  const count = windowGroup(w), x = (k, fallback) => plPrice(PL_WINDOW_EXTRAS[k]) ?? fallback;
  return windowSpec(w)[1] * count + (w.option === 'Octagon' ? 0 : (w.shutters ? x('shutters', 60) : 0) + (w.flower ? x('flower', 80) * count : 0) + (w.transom ? x('transom', 80) * count : 0));
};
plSync();
/* The office prices an order at the lot that sold it. */
if (typeof ofListPrice === 'function') {
  const inner = ofListPrice;
  ofListPrice = function (s) {
    AD.lotCtx = saleLot(s).id;
    plSync();
    try {
      return inner(s);
    } finally {
      AD.lotCtx = null;
      plSync();
    }
  };
}

/* The pricing page says which rows the desk sells, in plain words. */
function plNote(name) {
  if (PL_SOLD.has(name)) return '';
  if (PL_SAME_AS[name]) return ' <em class="ad-nolink">The Sales desk charges the White window price</em>';
  return ' <em class="ad-nolink">Not sold on the Sales desk yet</em>';
}
{
  const baseItems = adItemsTab;
  adItemsTab = function () {
    return `<p class="ad-hint">A price you publish here is the price the Sales desk charges on the next quote. On the Sales desk but not on this list yet, so their prices stay as they are: ${PL_DESK_ONLY.join(', ')}.</p>` + baseItems();
  };
}
/* A lot's own price on an option or package (the Lot prices tab). */
function plLotItems(lot) {
  const q = (AD.lotQ || '').trim().toLowerCase(), list = adItems().filter(({ x }) => PL_SOLD.has(x.name) && (!q || x.name.toLowerCase().includes(q)));
  return `<details class="ad-lotitems" ${AD.lotItemsOpen ? 'open' : ''} ontoggle="AD.lotItemsOpen=this.open"><summary>Options and packages at ${esc(lotById(lot).town)}</summary>
    <p>Give this lot its own price on a window, a door, a package or anything else the Sales desk sells. Everything you leave alone stays on the main list.</p>
    <label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search options and packages" value="${esc(AD.lotQ || '')}" onchange="AD.lotQ=this.value;render()"></label>
    <div class="ad-grid wide">${list.map(({ x }) => adPriceInput({ kind: 'lot', lot, model: 'item', size: x.name }, adNow('item', x.name, lot), esc(x.name) + (x.unit && x.unit !== 'each' ? ` · per ${x.unit}` : ''))).join('') || '<p class="muted">Nothing matches.</p>'}</div></details>`;
}

/* ---------- 2. The damage waiver in the rent-to-own Money box ---------- */
{
  const baseMoney = ofMoneyPanel;
  ofMoneyPanel = function (s) {
    const html = baseMoney(s), inv = orderInvoice(s);
    if (inv.monthly == null || inv.waiver == null) return html;
    const tax = inv.taxes ? inv.taxes.reduce((t, x) => t + x[1], 0) : null;
    const rows = odRow('Damage waiver, each month', money(inv.waiver)) + (tax != null ? odRow('First payment: monthly payment, tax and waiver', money(Math.round((inv.monthly + tax + inv.waiver) * 100) / 100), 'strong') : '');
    return html.replace(/(<div class="od-kv[^"]*"><span>Monthly payment, before tax<\/span><strong>[^<]*<\/strong><\/div>)/, '$1' + rows);
  };
}

/* ---------- 3. Each person sees only their lots, everywhere ---------- */
let PL_ALL_SALES = S.sales;
const plLotByTown = (t) => LOTS.find((l) => l.town === t || lotTown(l) === t || `Bennett Buildings of ${l.town}` === t)?.id || null;
function plBuildLot(b) {
  const s = PL_ALL_SALES.find((x) => x.id === b.order);
  return s ? saleLot(s).id : plLotByTown(b.dealer) || DESK_LOT;
}
/* Which lot a record belongs to: a notice, a return, a change order, a stock order or a QC building. */
function adRecLot(x) {
  if ('to' in x && 'title' in x) { /* a notice: only one tied to an order has a lot */
    const s = x.saleId && PL_ALL_SALES.find((y) => y.id === x.saleId);
    return s ? saleLot(s).id : null;
  }
  if ('where' in x && 'serial' in x) return plLotByTown(x.where) || DESK_LOT; /* a return */
  if ('done' in x && 'order' in x) { /* a change order */
    const s = PL_ALL_SALES.find((y) => y.id === x.order), b = !s && typeof Q !== 'undefined' && Q.builds.find((y) => y.order === x.order);
    return s ? saleLot(s).id : b ? plBuildLot(b) : DESK_LOT;
  }
  if ('dealer' in x) return plBuildLot(x); /* a QC building */
  if ('location' in x) return plLotByTown(x.location) || DESK_LOT; /* a stock order */
  return null;
}
function adSeesRec(x) {
  if (!adLimited()) return true;
  const lot = adRecLot(x);
  return lot == null || adLotOk(lot);
}
/* The words on a scoped screen: the heading and the lot picker name only this person's lots. */
function adScopeText(html) {
  if (!adLimited()) return html;
  const mine = LOTS.filter((l) => adLotOk(l.id)), n = mine.length, say = `${n} ${n === 1 ? 'lot' : 'lots'}`, ok = new Set(mine.map((l) => l.id));
  return html
    .replace(/<option value="([a-z0-9-]+)"[^>]*>[^<]*<\/option>/g, (m, id) => (lotById(id) && !ok.has(id) ? '' : m))
    .replace(/<option value="All">All \d+ lots<\/option>/g, `<option value="All">My ${say}</option>`)
    .replace(/\ball \d+ lots\b/g, `my ${say}`).replace(/\bAll \d+ lots\b/g, `My ${say}`);
}
/* Plant QC: only buildings headed to their lots, and the rework that belongs to those buildings. */
for (const page of Object.keys(QC_SCREENS)) {
  const draw = QC_SCREENS[page];
  QC_SCREENS[page] = function (...args) {
    if (!adLimited()) return draw.apply(this, args);
    const builds = Q.builds, rework = Q.rework;
    Q.builds = builds.filter(adSeesRec);
    const mine = new Set(Q.builds.map((b) => b.serial));
    Q.rework = rework.filter((r) => mine.has(r.serial));
    try {
      const out = draw.apply(this, args);
      return typeof out === 'string' ? adScopeText(out) : out;
    } finally {
      Object.assign(Q, { builds, rework });
    }
  };
}
{
  const drawn = render;
  render = function () {
    if (!AD.scope) PL_ALL_SALES = S.sales;
    plSync();
    drawn.apply(this, arguments);
  };
}
