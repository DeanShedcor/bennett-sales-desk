/* prices.js: retail prices (MSRP) from Turbo Assist's price list.

   Source: bennett-buddy commit b42d324, docs/kb/cogs_raw/Current Prices.csv, read only. In the
   shipped app the live price comes from the org's price book through `resolve_pricing`; this file
   is the preview's copy of that list, so the desk shows the same numbers. When Jordan's list
   changes, regenerate PRICE_LIST from that file.

   What it replaces in the preview:
   - The base price: one exact price per style, series (Basic / Classic / Elite) and size, in place
     of the old flat base plus size and style adjustments.
   - Series upgrades: Classic (TechShield or Silvertech groove) and Elite (lap siding) are the
     series' own prices, so the old +$325 / +$362 / +$1,050 sample add-ons are gone.
   - Floor joists 12 in on center at $0.75 per sq ft of floor; shingle roof $250; accent gable
     $100; custom color $100; door accent color $50 single, $90 double, $130 fiberglass;
     double full-lite door $1,250; garage package by roll-up width (8 × 7 $1,280, 9 × 7 $1,370);
     porch and dormer packages on every style that offers them; greenhouse electrical $660.
   Already the same in both and left as they were: windows, shutters, flower boxes, transoms, doors,
   roll-ups, porch and dormer package prices, electrical packages and extras, Silver Bullet colors.
   Two-tone siding is $1.50 per sq ft of building, width × length (a 10 × 16 is 160 sq ft).
   The fuel surcharge changes sale to sale: it stays out of the total and shows a red STILL NEEDED
   until Turbo Assist supplies it for the sale.
   Not in Jordan's list, left as before: the 36 in full-lite door, the extra side door, the Workshop
   electrical package and a 6 × 7 garage package.
   Loaded right after views.js; wraps the Sales desk's price functions. */

const PRICE_LIST_SOURCE = 'Turbo Assist price list';
const PRICE_LIST = {"Basic Lofted":{"8x8":3424.0,"8x12":4031.0,"8x16":4772.0,"10x12":4631.0,"10x16":5510.0,"10x20":6170.0,"10x24":7030.0,"12x16":6180.0,"12x20":7190.0,"12x24":8150.0,"12x28":9260.0,"12x32":10240.0,"12x36":11360.0,"12x40":12540.0,"14x20":11448.0,"14x24":12378.0,"14x28":13708.0,"14x32":14748.0,"14x36":16198.0,"14x40":17818.0,"8x10":4031.0,"10x10":4631.0,"12x12":5254.0,"12x14":6180.0,"14x12":8567.0,"14x16":10133.0,"14x18":11448.0,"14x22":12378.0,"14x26":13708.0,"14x30":14748.0,"14x34":16198.0,"14x38":17818.0,"14x42":18713.0,"14x44":18713.0,"14x46":19604.0,"14x48":19604.0,"14x50":21387.0,"14x52":21387.0,"14x56":23143.0,"14x60":23957.0,"16x20":10950.0,"16x22":11754.0,"16x24":11754.0,"16x26":13016.0,"16x28":13016.0,"16x30":14682.0,"16x32":14682.0,"16x34":16119.0,"16x36":16119.0,"16x38":17115.0,"16x40":17115.0,"16x42":18602.0,"16x44":18602.0,"16x46":19937.0,"16x48":19937.0,"16x50":21707.0,"16x52":21707.0,"16x56":23624.0,"16x60":24504.0},"Basic Utility":{"8x8":3274.0,"8x12":3805.0,"8x16":4456.0,"10x12":4360.0,"10x16":5158.0,"10x20":5970.0,"10x24":6620.0,"12x16":5870.0,"12x20":6940.0,"12x24":7780.0,"12x28":8920.0,"12x32":9750.0,"12x36":10940.0,"12x40":12090.0,"14x20":11448.0,"14x24":12378.0,"14x28":13508.0,"14x32":14748.0,"14x36":15878.0,"14x40":16998.0,"8x10":3805.0,"10x10":4360.0,"12x12":4875.0,"12x14":5870.0,"14x12":8378.0,"14x16":9914.0,"14x18":11448.0,"14x22":12378.0,"14x26":13508.0,"14x30":14748.0,"14x34":15878.0,"14x38":16998.0,"14x42":17851.0,"14x44":17851.0,"14x46":19083.0,"14x48":19083.0,"14x50":20602.0,"14x52":20602.0,"14x56":22375.0,"14x60":23190.0,"16x20":10375.0,"16x22":11517.0,"16x24":11517.0,"16x26":12707.0,"16x28":12707.0,"16x30":13922.0,"16x32":13922.0,"16x34":15359.0,"16x36":15359.0,"16x38":16409.0,"16x40":16409.0,"16x42":17537.0,"16x44":17537.0,"16x46":18887.0,"16x48":18887.0,"16x50":20548.0,"16x52":20548.0,"16x56":22548.0,"16x60":23337.0,"6x4":2652.0,"6x6":2934.0,"6x8":3103.0,"6x10":3320.0,"6x12":3426.0},"Classic Lofted":{"8x8":3659.0,"8x12":4326.0,"8x16":5059.0,"10x12":4949.0,"10x16":5870.0,"10x20":6727.0,"10x24":7832.0,"12x16":6854.0,"12x20":7902.0,"12x24":9010.0,"12x28":10569.0,"12x32":11197.0,"12x36":12346.0,"12x40":13654.0,"14x20":12272.0,"14x24":13877.0,"14x28":14572.0,"14x32":16026.0,"14x36":17411.0,"14x40":18976.0,"8x10":4326.0,"10x10":4949.0,"12x12":5737.0,"12x14":6854.0,"14x12":9180.0,"14x16":10919.0,"14x18":12272.0,"14x22":13877.0,"14x26":14572.0,"14x30":16026.0,"14x34":17411.0,"14x38":18976.0,"14x42":20536.0,"14x44":20536.0,"14x46":21549.0,"14x48":21549.0,"14x50":23524.0,"14x52":23524.0,"14x56":25466.0,"14x60":26397.0,"16x20":12044.0,"16x22":12973.0,"16x24":12973.0,"16x26":14392.0,"16x28":14392.0,"16x30":16247.0,"16x32":16247.0,"16x34":17856.0,"16x36":17856.0,"16x38":18991.0,"16x40":18991.0,"16x42":20654.0,"16x44":20654.0,"16x46":22153.0,"16x48":22153.0,"16x50":24121.0,"16x52":24121.0,"16x56":26245.0,"16x60":27255.0},"Classic Utility":{"8x8":3455.0,"8x12":4055.0,"8x16":4714.0,"10x12":4645.0,"10x16":5503.0,"10x20":6430.0,"10x24":7312.0,"12x16":6454.0,"12x20":7452.0,"12x24":8420.0,"12x28":9629.0,"12x32":10577.0,"12x36":11556.0,"12x40":12814.0,"14x20":11112.0,"14x24":11918.0,"14x28":12881.0,"14x32":14100.0,"14x36":15301.0,"14x40":16300.0,"8x10":4055.0,"10x10":4645.0,"12x12":5273.0,"12x14":6454.0,"14x12":8977.0,"14x16":10685.0,"14x18":11432.0,"14x22":12377.0,"14x26":13542.0,"14x30":15046.0,"14x34":16531.0,"14x38":17746.0,"14x42":19610.0,"14x44":19610.0,"14x46":20990.0,"14x48":20990.0,"14x50":22679.0,"14x52":22679.0,"14x56":24642.0,"14x60":25574.0,"16x20":11426.0,"16x22":12718.0,"16x24":12718.0,"16x26":14061.0,"16x28":14061.0,"16x30":15431.0,"16x32":15431.0,"16x34":17039.0,"16x36":17039.0,"16x38":18234.0,"16x40":18234.0,"16x42":19509.0,"16x44":19509.0,"16x46":21024.0,"16x48":21024.0,"16x50":22875.0,"16x52":22875.0,"16x56":25089.0,"16x60":26002.0},"Elite Lofted":{"8x8":3611.0,"8x12":4337.0,"8x16":5392.0,"10x12":5296.0,"10x16":6138.0,"10x20":7290.0,"10x24":8802.0,"12x16":7664.0,"12x20":8892.0,"12x24":10140.0,"12x28":11559.0,"12x32":12687.0,"12x36":14256.0,"12x40":14994.0,"14x20":13772.0,"14x24":14797.0,"14x28":16102.0,"14x32":17736.0,"14x36":19101.0,"14x40":20236.0,"8x10":4337.0,"10x10":5296.0,"12x12":6255.0,"12x14":7664.0,"14x12":10067.0,"14x16":12008.0,"14x18":13772.0,"14x22":14797.0,"14x26":16102.0,"14x30":17736.0,"14x34":19101.0,"14x38":20236.0,"14x42":22485.0,"14x44":22485.0,"14x46":23543.0,"14x48":23543.0,"14x50":25769.0,"14x52":25769.0,"14x56":27956.0,"14x60":28915.0,"16x20":13506.0,"16x22":14437.0,"16x24":14437.0,"16x26":15967.0,"16x28":15967.0,"16x30":18022.0,"16x32":18022.0,"16x34":19779.0,"16x36":19779.0,"16x38":20962.0,"16x40":20962.0,"16x42":22785.0,"16x44":22785.0,"16x46":24409.0,"16x48":24409.0,"16x50":26602.0,"16x52":26602.0,"16x56":28986.0,"16x60":30017.0},"Elite Utility":{"8x8":3451.0,"8x12":4147.0,"8x16":5032.0,"10x12":4906.0,"10x16":5868.0,"10x20":7080.0,"10x24":8122.0,"12x16":7114.0,"12x20":8262.0,"12x24":9390.0,"12x28":10629.0,"12x32":11927.0,"12x36":13036.0,"12x40":14244.0,"14x20":12862.0,"14x24":13977.0,"14x28":15332.0,"14x32":17086.0,"14x36":18841.0,"14x40":20206.0,"8x10":4147.0,"10x10":4906.0,"12x12":5853.0,"12x14":7114.0,"14x12":9821.0,"14x16":11724.0,"14x18":12862.0,"14x22":13977.0,"14x26":15332.0,"14x30":17086.0,"14x34":18841.0,"14x38":20206.0,"14x42":21360.0,"14x44":21360.0,"14x46":22865.0,"14x48":22865.0,"14x50":24745.0,"14x52":24745.0,"14x56":26956.0,"14x60":27915.0,"16x20":12756.0,"16x22":14129.0,"16x24":14129.0,"16x26":15564.0,"16x28":15564.0,"16x30":17031.0,"16x32":17031.0,"16x34":18788.0,"16x36":18788.0,"16x38":20042.0,"16x40":20042.0,"16x42":21396.0,"16x44":21396.0,"16x46":23039.0,"16x48":23039.0,"16x50":25090.0,"16x52":25090.0,"16x56":27582.0,"16x60":28494.0},"Silver Bullet":{"10x12":3900.0,"10x16":4640.0,"10x20":5430.0,"10x24":6080.0,"12x16":5090.0,"12x20":5890.0,"12x24":6560.0,"12x28":7550.0,"6x8":2930.0,"8x8":3150.0,"8x10":3570.0,"8x12":3970.0,"8x16":4820.0,"10x10":3820.0,"12x12":4550.0,"12x14":5080.0,"12x32":9400.0,"12x36":10080.0,"12x40":10670.0,"14x20":10798.0,"14x24":11988.0,"14x28":13028.0,"14x32":13928.0,"14x36":14668.0,"14x40":15268.0},"Craftsman Utility":{"10x12":3750.0,"10x16":4230.0},"Basic Studio":{"8x8":3200.0,"8x12":3460.0,"8x16":4360.0,"10x12":4190.0,"10x16":5250.0,"10x20":6280.0,"10x24":6980.0,"12x16":6170.0,"12x20":7250.0,"12x24":8110.0,"8x10":3460.0,"10x10":4190.0,"12x12":5258.0,"12x14":6170.0},"Classic Studio":{"8x8":3471.0,"8x12":4097.0,"8x16":4752.0,"10x12":4716.0,"10x16":5808.0,"10x20":6860.0,"10x24":7752.0,"12x16":6834.0,"12x20":7882.0,"12x24":8890.0,"8x10":4097.0,"10x10":4716.0,"12x12":5721.0,"12x14":6834.0},"Elite Studio":{"8x8":3661.0,"8x12":4447.0,"8x16":5372.0,"10x12":5246.0,"10x16":6218.0,"10x20":7430.0,"10x24":8512.0,"12x16":7454.0,"12x20":8662.0,"12x24":9850.0,"8x10":4447.0,"10x10":5246.0,"12x12":6473.0,"12x14":7454.0},"Low Wall":{"8x8":2800.0,"8x10":3040.0,"8x12":3270.0,"8x16":3930.0,"10x12":3890.0,"10x16":4650.0,"10x20":5400.0,"12x16":5480.0,"12x20":6390.0},"Greenhouse":{"8x12":6095.0,"8x16":7495.0,"10x12":7195.0,"10x16":8850.0,"10x20":10725.0}};

/* The price list's name for a building: "Basic Utility", "Elite Lofted", "Low Wall", ... */
function priceListName(c, ser = series(c)) {
  if (c.style === 'Low-Wall Barn') return 'Low Wall';
  if (c.style === 'Greenhouse' || c.style === 'Silver Bullet') return c.style;
  return `${ser} ${c.style}`;
}
function priceListBase(c, ser) {
  return PRICE_LIST[priceListName(c, ser)]?.[c.size] ?? null;
}
const floorArea = (c) => c.size.split('x').map(Number).reduce((a, b) => a * b, 1);

/* Prices that were already in the preview as constants. */
doorPrices['Double Full Lite Door'] = 1250;
shinglePrice = function (c) {
  return c.style === 'Greenhouse' || c.style === 'Silver Bullet' ? null : 250;
};
{
  const salesPackageReference = packageReference;
  packageReference = function (c, name = c.package) {
    if (name === 'Garage Package') return { 8: 1280, 9: 1370 }[c.garageDoorWidth || 6] ?? null;
    return salesPackageReference(c, name);
  };
}
/* The list prices packages on any building that offers them, not only a Basic Utility. */
packageAmount = function (c, name = c.package) {
  return packageReference(c, name);
};

/* The price breakdown: the list's base price first, then the options. */
{
  const salesBreakdown = breakdown;
  const SERIES_ROWS = new Set(['Classic / Silvertech groove', 'LP Smart Side Lap Siding / Elite package', 'TechShield radiant barrier']);
  breakdown = function (c = S.c) {
    const rows = salesBreakdown(c).filter((r) => !SERIES_ROWS.has(r.name));
    const base = priceListBase(c);
    if (base != null) rows[0] = { name: `${label(c)} base price`, amount: base, source: PRICE_LIST_SOURCE };
    for (const r of rows) {
      if (r.name === '12-inch-on-center floor joists') Object.assign(r, { amount: Math.round(floorArea(c) * 0.75 * 100) / 100, source: PRICE_LIST_SOURCE + ' · $0.75 per sq ft of floor' });
      if (r.name === 'Architectural shingles') r.source = PRICE_LIST_SOURCE;
      if (r.name === c.package && packageAmount(c) != null) r.source = PRICE_LIST_SOURCE;
      if (c.style === 'Greenhouse' && /electrical package$/.test(r.name)) Object.assign(r, { name: 'Greenhouse electrical package', amount: 660, source: PRICE_LIST_SOURCE });
      if (/IdeaRoom/.test(r.source) && r.name !== 'Fuel surcharge') r.source = PRICE_LIST_SOURCE;
      /* The fuel surcharge changes sale to sale, so no fixed number goes in the total. Turbo Assist has
         to supply it for each sale; until then the line is flagged STILL NEEDED. */
      if (r.name === 'Fuel surcharge') Object.assign(r, { amount: 0, needed: true, source: 'Changes sale to sale · still needed from Turbo Assist' });
    }
    if (typeof usesWoodOptions === 'function' && usesWoodOptions(c)) {
      if (c.accentColor && c.accentArea !== 'lower') rows.push({ name: 'Accent gable · ' + c.accentColor, amount: 100, source: PRICE_LIST_SOURCE });
      /* Two-tone: $1.50 per sq ft of building, width × length (a 10 × 16 is 160 sq ft, $240). */
      if (c.accentColor && c.accentArea === 'lower') rows.push({ name: 'Two-tone siding · ' + c.accentColor, amount: Math.round(floorArea(c) * 1.5 * 100) / 100, source: PRICE_LIST_SOURCE + ' · $1.50 per sq ft of building' });
      if (c.customPaint) rows.push({ name: 'Custom color · ' + c.customPaint, amount: 100, source: PRICE_LIST_SOURCE });
    }
    if (c.doorColor && c.doorColor !== c.color && !packageOpenings(c).length && !(typeof allDoorsWhiteOnly === 'function' && allDoorsWhiteOnly(c)))
      rows.push({ name: 'Door accent color · ' + c.doorColor, amount: /fiberglass/i.test(c.door) ? 130 : /double/i.test(c.door) ? 90 : 50, source: PRICE_LIST_SOURCE });
    return rows;
  };
}
/* Accent gable and two-tone siding are both priced now. */
{
  const salesReview = catalogReviewItems;
  catalogReviewItems = function (c) {
    return salesReview(c).filter((x) => x !== 'Accent finish availability and price');
  };
}

/* Price labels written into the page: the series upgrades and floor joists. */
{
  const seriesStep = (c, ser) => {
    const a = priceListBase(c, ser), b = priceListBase(c, 'Basic');
    return a != null && b != null ? '+' + money(a - b) : 'Price to confirm';
  };
  const salesStep = stepBody;
  stepBody = function () {
    const [title, body] = salesStep();
    return [title, body
      .replace('+$325 sample', seriesStep(S.c, 'Classic'))
      .replace('+$1,050 sample', seriesStep(S.c, 'Elite'))
      .replace('IdeaRoom Basic Utility pricing reference', 'Turbo Assist price list')
      .replace('Package add-on prices for Basic Utility with a metal roof stay the same across shed sizes. Prices marked reference · confirm are shown for comparison and excluded from the estimate.', 'Package prices come from Turbo Assist’s price list and stay the same across sizes. A price marked reference · confirm is not in that list and is left out of the estimate.')];
  };
  const salesJoists = floorJoistMarkup;
  floorJoistMarkup = function (c) {
    return salesJoists(c).replace('+$375 sample', '+' + money(Math.round(floorArea(c) * 0.75 * 100) / 100));
  };
}
/* The price details footnote names where the numbers come from. */
{
  const salesSummary = summary;
  summary = function () {
    return sfFuelFlag(salesSummary().replace('Reference base + sample options', 'Base and options from Turbo Assist’s price list'));
  };
  const salesQuote = quoteView;
  quoteView = function (customer) {
    return sfFuelFlag(salesQuote(customer));
  };
}
/* A big red STILL NEEDED in place of the fuel surcharge's dollar amount, for Jordan to notice. */
const STILL_NEEDED = '<strong class="still-needed" title="The fuel surcharge changes sale to sale. Turbo Assist has to supply it for each sale.">STILL NEEDED</strong>';
function sfFuelFlag(html) {
  return html
    .replace(/<li><span>Fuel surcharge<\/span><strong>[^<]*<\/strong><\/li>/, `<li class="needed-line"><span>Fuel surcharge<small>Changes sale to sale</small></span>${STILL_NEEDED}</li>`)
    .replace(/(<td>Fuel surcharge<br><small>[^<]*<\/small><\/td><td>)[^<]*(<\/td>)/, `$1${STILL_NEEDED}$2`);
}
