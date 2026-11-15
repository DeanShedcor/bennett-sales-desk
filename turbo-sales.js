/* turbo-sales.js: what the Sales desk takes from Turbo Assist (bennett-buddy b42d324).

   Each block names the Turbo Assist function it stands on.
   - Leads on Home: the real source labels (salesDeskLead.ts SOURCE_LABEL), interest level and
     timeline (src/types/lead.ts), the default first follow-up (leadDefaultFollowUpPolicy.ts), the
     coach's questions (coachManager.ts) and stale-lead reminders (leadFollowupHygiene.ts).
     Legacy keeps leads and follow-ups; the desk shows them and starts the sale.
   - Today's checklist: SALES_CHECKLIST_ITEMS (server/admin-handlers/salesChecklistConstants.ts),
     six ads a day. Legacy keeps the checklist and the ads log.
   - The price list: every option and package in docs/kb/cogs_raw/Current Prices.csv, read only,
     and the add-ons the configurator did not have yet. Legacy keeps the price book
     (resolve_pricing).
   - Rent-to-own: the same table and arithmetic as the RTO term calculator
     (SalesConsoleRtoCalculatorSection.tsx) over the office's terms.
   - Order facts: lead times, warranty and payment rules from the knowledge base, one tap from the
     article.
   - Stats: the counts the shipped Sales Desk shows (SalesDeskPerformance.tsx).
   Loaded after turbo.js; wraps the Sales desk's functions. */

/* ---------- Leads ---------- */
const TA_LEAD = {
  source: { facebook: 'Facebook', google: 'Google', shedsforsale_com: 'Sheds for Sale', drive_by: 'Drive-by', word_of_mouth: 'Word of mouth', referral: 'Referral', bdc_call: 'Call', other: 'Other' },
  interest: { hot: 'Hot', warm: 'Warm', cold: 'Cold' },
  pill: { hot: 'red', warm: 'amber', cold: 'blue' },
  timeline: { this_week: 'This week', this_month: 'This month', '1-3_months': '1–3 months', '3-6_months': '3–6 months', '6+_months': '6+ months', unknown: 'Unknown' },
  /* DEFAULT_LEAD_DEFAULT_FOLLOW_UP_POLICY: the first follow-up a new lead gets, by interest. */
  followUp: { hot: ['Call customer and confirm next step', 12], warm: ['Send quote recap and schedule follow-up', 24], cold: ['Send light follow-up and keep warm', 24] },
  stale: [3, 7, 14], /* DEFAULT_LEAD_HYGIENE_CADENCE_DAYS */
};
/* The three sample leads, filled out the way Turbo Assist records a lead. All made up. */
Object.assign(leadData[0], { source: 'Facebook', sourceKey: 'facebook', detail: 'Facebook ad', interest: 'hot', timeline: 'this_week', product: 'Portable building', size: '10x16', budget: '$300/month', phone: '(843) 555-0142', firstName: 'Alex', touched: 0 });
Object.assign(leadData[1], { source: 'Facebook', sourceKey: 'facebook', detail: 'Facebook Marketplace ad', interest: 'warm', timeline: 'this_month', product: 'Lofted barn on the lot', size: '', budget: '', phone: '', firstName: 'Jamie', touched: 2 });
Object.assign(leadData[2], { source: 'Google', sourceKey: 'google', detail: 'Google ad', interest: 'cold', timeline: 'unknown', product: 'Greenhouse', size: '', budget: '', phone: '(843) 555-0117', firstName: 'Taylor', touched: 8 });

/* What the coach would have the salesperson ask (coachManager.ts), for what the lead is missing. */
function taLeadAsk(l) {
  return [
    !l.phone && 'Ask for the customer’s phone number.',
    !l.firstName && 'Ask for the customer’s first name.',
    !l.sourceKey && 'Ask how they found Bennett Buildings. Facebook, Google, drive-by, or referral.',
    (!l.timeline || l.timeline === 'unknown') && 'Ask when they want to buy. This week, this month, or later.',
  ].filter(Boolean);
}
/* Highest reminder day the lead has passed without a touch: 3, 7 or 14. */
const taLeadStale = (l) => TA_LEAD.stale.filter((d) => (l.touched || 0) >= d).pop() || 0;
function taLeadNext(l) {
  const [action, hours] = TA_LEAD.followUp[l.interest] || TA_LEAD.followUp.warm;
  return { action, hours, due: l.touched ? `due ${l.touched} day${l.touched === 1 ? '' : 's'} ago` : `due in ${hours} hours` };
}
leadRows = function () {
  return leadData
    .slice(0, S.tiles.leadCount)
    .map((l, i) => {
      const next = taLeadNext(l), stale = taLeadStale(l);
      return `<button class="listrow ta-lead" onclick="lead(${i})"><span class="initial">${l.initial}</span><span class="grow"><strong>${esc(l.name)}</strong><small>${esc(l.need)}</small>
        <small class="ta-next ${l.touched ? 'late' : ''}">${icon('arrow', 13)} ${esc(next.action)} · ${next.due}</small></span>
        <span class="pillcol"><span class="pill ${TA_LEAD.pill[l.interest]}">${TA_LEAD.interest[l.interest]}</span><span class="pill blue">${esc(l.source)}</span>${stale ? `<span class="pill amber">Stale · ${stale} days</span>` : ''}</span><span class="rowarrow">${icon('arrow', 18)}</span></button>`;
    })
    .join('');
};
lead = function (i) {
  const l = leadData[i], next = taLeadNext(l), ask = taLeadAsk(l), stale = taLeadStale(l);
  const row = (k, v) => `<div class="od-kv"><span>${k}</span><strong>${v ? esc(v) : '<span class="muted">Not recorded</span>'}</strong></div>`;
  modal(
    esc(l.name),
    `<div class="pillrow"><span class="pill ${TA_LEAD.pill[l.interest]}">${TA_LEAD.interest[l.interest]}</span><span class="pill blue">${esc(l.source)}</span><span class="pill ghost">Sample lead</span>${stale ? `<span class="pill amber">Stale lead · ${stale} days</span>` : ''}</div>
    <p style="margin-top:14px">${esc(l.need)}</p>
    <div class="ta-leadfacts">${row('Lead source', l.source)}${row('Lead source detail', l.detail)}${row('Interest level', TA_LEAD.interest[l.interest])}${row('Ready to buy', TA_LEAD.timeline[l.timeline])}${row('Product', l.product)}${row('Size', l.size.replace('x', ' × '))}${row('Stated budget', l.budget)}${row('Phone', l.phone)}${row('Email', leadEmail(l))}</div>
    <div class="ta-rule">${icon('arrow', 16)}<span><strong>Next follow-up:</strong> ${esc(next.action)} · ${next.due}. A ${TA_LEAD.interest[l.interest].toLowerCase()} lead gets this first step ${next.hours} hours after it comes in.</span></div>
    ${ask.length ? `<div class="ta-rule ask">${icon('help', 16)}<span><strong>Still to ask.</strong> ${ask.map(esc).join(' ')}</span></div>` : ''}
    <p class="source">Turbo Assist keeps the lead, its follow-ups and the reminders at 3, 7 and 14 days without a touch (Leads). The desk shows the lead and starts the sale. ${taTip('ta-navigation-lead-workspace', 'How leads work')}</p>
    ${button('Start a sale', `closeModal();S.saleLead=${i};go('start')`)} `
  );
};

/* ---------- Today's checklist (Legacy keeps it; the desk shows it) ---------- */
const TA_CHECK = {
  goal: 6, /* SALES_ADS_DAILY_SUBITEMS */
  ads: 2,
  done: { office_tidy: true },
  items: [
    ['ad_logged', 'Log your ads for today', 'Each ad you save in Ads Assistant counts toward today.', 'computed'],
    ['office_tidy', 'Tidy / clean your office', 'Quick reset so the space is ready for customers and the team.', 'manual'],
    ['bathroom_clean', 'Clean restroom / bathroom', '', 'manual'],
    ['notifications_inbox', 'Clear notifications that need you', 'Inbox, SMS, app alerts — anything waiting for a yes/no or follow-up.', 'manual'],
    ['location_walkthrough', 'Walk the location', 'Trash pickup, inventory staging, obvious repairs or safety issues.', 'manual'],
  ],
};
function taCheckPct() {
  const manual = TA_CHECK.items.filter((x) => x[3] === 'manual'), slots = TA_CHECK.goal + manual.length;
  return Math.round(((Math.min(TA_CHECK.ads, TA_CHECK.goal) + manual.filter((x) => TA_CHECK.done[x[0]]).length) / slots) * 100);
}
function taCheckCard() {
  const c = TA_CHECK, pct = taCheckPct();
  return `<section class="panel ta-check"><div class="panelhead"><h2>Today’s checklist</h2><span class="pill ${pct === 100 ? 'good' : 'amber'}">${pct}% done</span></div>
    <div class="ta-bar" role="img" aria-label="${pct} percent of today’s checklist done"><i style="width:${pct}%"></i></div>
    ${c.items
      .map(([id, name, hint, kind]) =>
        kind === 'computed'
          ? `<div class="ta-checkrow"><span class="ta-dots" aria-hidden="true">${Array.from({ length: c.goal }, (_, i) => `<i class="${i < c.ads ? 'on' : ''}"></i>`).join('')}</span><span class="grow"><strong>${esc(name)} <span class="pill ${c.ads >= c.goal ? 'good' : 'amber'}">${c.ads >= c.goal ? 'Goal met' : 'Behind goal'}</span></strong><small>${c.ads} of ${c.goal} logged today · ${esc(hint)}</small></span><button type="button" class="secondary small" onclick="taLogAd()" ${c.ads >= c.goal ? 'disabled' : ''}>Log an ad</button></div>`
          : `<label class="ta-checkrow"><input type="checkbox" ${c.done[id] ? 'checked' : ''} onchange="TA_CHECK.done['${id}']=this.checked;render()"><span class="grow"><strong>${esc(name)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</span></label>`
      )
      .join('')}
    <p class="source">Turbo Assist keeps this list and the ads log (the daily checklist and Ads Assistant). Six ads a day, Monday through Saturday. ${taTip('ta-notifications-and-checklist', 'About the checklist')} ${taTip('ads-daily', 'Ad rules')}</p></section>`;
}
/* One more ad in today's log. Hitting the goal is one of Turbo Assist's achievements
   (achievementCatalog.ts, "Daily goal met"); the label beside the count is its ads verdict
   (adsActivityVerdict.ts: "Behind goal", "Goal met"). */
function taLogAd() {
  TA_CHECK.ads = Math.min(TA_CHECK.goal, TA_CHECK.ads + 1);
  render();
  if (TA_CHECK.ads === TA_CHECK.goal) toast('Daily goal met: six ads logged today.');
}
/* What Legacy keeps. The desk points to each one instead of building a second copy. */
function taHandoffCard() {
  const row = (name, text, action, label) => `<div class="ta-hand"><span class="grow"><strong>${name}</strong><small>${text}</small></span><button type="button" class="secondary small" onclick="${action}">${label}</button></div>`;
  return `<section class="panel"><div class="panelhead"><h2>Also in Turbo Assist</h2><span class="pill ghost">The desk hands these off</span></div>
    ${row('Product and policy answers', `${TA_KB.length} articles: delivery, sizes, materials, payments, steel.`, 'taOpenAnswers()', 'Open Answers')}
    ${row('The price list', `${TA_PRICE_OPTIONS.length} options and ${TA_PRICE_PACKAGES.length} packages, retail prices.`, 'taPriceList()', 'Open the list')}
    ${row('Rent-to-own calculator', 'Payment, money down and payoff by term.', 'taRtoOpen(5464)', 'Open')}
    ${row('Practice a sale', 'Four customers to practice with: price, first-time, timing, experienced.', "taOpenAnswers();TA.ans.tab='practice';taAnsBody()", 'See them')}
    ${row('Leads, follow-ups and ads', 'The lead editor, reminders and the ads log stay in Turbo Assist.', "taOpenAnswers('ta-overview-turbo-assist')", 'How it fits')}</section>`;
}
{
  const deskHome = home;
  home = function () {
    const ask = `<form class="ta-askbar" onsubmit="event.preventDefault();taOpenAnswers(this.q.value.trim()||undefined)"><label class="searchbar">${icon('help', 20)}<input name="q" class="search" type="search" aria-label="Ask a product or policy question" placeholder="Ask a question: how far is delivery free? can a barn have a roll-up door?"></label><button type="submit" class="secondary">Ask</button></form>`;
    return deskHome()
      .replace('<div class="grid2 homegrid">', ask + '<div class="grid2 homegrid">')
      .replace('<div class="homefoot">', `<div class="grid2 homegrid ta-homegrid">${taCheckCard()}${taHandoffCard()}</div><div class="homefoot">`);
  };
}

/* Start a sale: the knowledge base beside the two starting points that raise the most questions. */
{
  const deskStart = start;
  start = function () {
    return deskStart()
      .replace('save it for a site review.</p>', `save it for a site review. Any size can be built on site; 16 ft wide and buildings past 14 × 40 have to be. The price list adds ${money(taListPrice('Build On Site'))} per sq ft of floor.</p><p class="ta-from">${taTip('build-on-site', 'When to build on site')}</p>`)
      .replace('It opens in a new tab.</p>', `It opens in a new tab.</p><p class="ta-from">${taTip('steel-overview', 'Steel basics')} ${taTip('steel-sizes', 'Sizes')} ${taTip('steel-permits', 'Permits')}</p>`);
  };
}

/* ---------- The price list (Legacy keeps the price book; this is its read-only face) ---------- */
const taUnit = (o) => (o.unit === 'each' ? '' : o.unit === 'sq ft' ? ' per sq ft' : ' per ft');
let taPriceQ = '';
function taPriceBody() {
  const q = taPriceQ.trim().toLowerCase(), hit = (name) => !q || name.toLowerCase().includes(q);
  const line = (name, price, extra = '') => `<li><span>${esc(name)}</span><strong>${price < 0 ? '−' : ''}${money(Math.abs(price))}${extra}</strong></li>`;
  const groups = [...new Set(TA_PRICE_OPTIONS.map((o) => o.group))];
  const sections = [
    ['Packages', TA_PRICE_PACKAGES.filter((p) => hit(p.name)).map((p) => line(p.name, p.price))],
    ...groups.map((g) => [g, TA_PRICE_OPTIONS.filter((o) => o.group === g && hit(o.name)).map((o) => line(o.name, o.price, taUnit(o)))]),
    ...[...new Set(TA_PRICE_EXTRA.map((x) => x.kind))].map((k) => [k + ' · only in the IdeaRoom price sheet', TA_PRICE_EXTRA.filter((x) => x.kind === k && hit(x.name)).map((x) => line(x.name, x.price))]),
  ].filter(([, rows]) => rows.length);
  return sections.length ? sections.map(([name, rows]) => `<h3>${esc(name)} · ${rows.length}</h3><ul class="pricelines">${rows.join('')}</ul>`).join('') : '<p class="muted">Nothing in the list matches.</p>';
}
function taPriceList() {
  taPriceQ = '';
  modal(
    'The price list',
    `<p class="source">Retail prices (MSRP) from Turbo Assist’s price list, read only. Building prices by size are already in the configurator. Tax is not included; delivery inside the free miles is.</p>
    <label class="searchbar">${icon('orders', 18)}<input class="search" type="search" aria-label="Search the price list" placeholder="Search: porch, loft, fiberglass, dormer" oninput="taPriceQ=this.value;document.getElementById('ta-price-body').innerHTML=taPriceBody()"></label>
    <div id="ta-price-body" class="ta-pricebody">${taPriceBody()}</div>
    ${TA_PRICE_DUPES.length ? `<p class="notice">${icon('alert', 16)} The list prices ${TA_PRICE_DUPES.length} sizes twice (14-wide Classic Utility). This preview uses the higher price, the one IdeaRoom is loaded with.</p>` : ''}`
  );
  $('.modal')?.classList.add('wide');
}
/* The list has 14-wide Classic Utility twice. IdeaRoom's sheet and the "next size up" rows agree
   with the first, higher price, so the desk uses that one. */
TA_PRICE_DUPES.forEach((d) => {
  if (PRICE_LIST[d.model]?.[d.size] != null) PRICE_LIST[d.model][d.size] = Math.max(d.first, d.second);
});

/* ---------- Add-ons from the price list the configurator did not have ---------- */
/* [price-list name, name on screen, how it is counted, who may have it]. Windows, doors, colors,
   packages, floor joists and electrical already have their own steps, so they are not repeated. */
const taBarn = (c) => c.style === 'Lofted' || c.style === 'Low-Wall Barn';
const TA_ADDONS = [
  ['Additional Loft (PER SQ FT)', 'Additional loft', 'sq ft', (c) => c.style !== 'Greenhouse'],
  ['U Loft (per SQ FT)', 'U-shaped loft', 'sq ft', (c) => c.style !== 'Greenhouse'],
  ['Three Tier Shelving (per LF)', 'Three-tier shelving', 'ft', () => true],
  ['Workbench (per LF)', 'Workbench', 'ft', () => true],
  ['Partition Wall (per linear foot)', 'Partition wall', 'ft', () => true],
  ['Trusses 16" On Center (per sq. ft. of floor)', 'Trusses 16 in. on center', 'floor', (c) => usesWoodOptions(c)],
  ['6" Overhang on Gable Ends', '6 in. overhang on the gable ends', 'each', (c) => usesWoodOptions(c) && c.style !== 'Studio'],
  ['Custom Frame Out', 'Custom frame-out for an opening', 'count', () => true],
  ['Stone Veneer (Per LF)', 'Stone veneer', 'ft', (c) => usesWoodOptions(c)],
  ['Vinyl Wrap', 'Vinyl wrap', 'each', (c) => usesWoodOptions(c)],
  ['Shingles (Wrapped)', 'Wrapped shingles', 'each', (c) => usesWoodOptions(c) && c.roof === 'Shingles'],
  ['Porch Railing (Per Linear Ft)', 'Porch railing', 'ft', (c) => /Porch/.test(c.package || '')],
  ['Additional Side Porch Per Linear Ft', 'Additional side porch', 'ft', (c) => /Side Porch|Deluxe Porch/.test(c.package || '')],
  ['Dormer Accent Wall', 'Dormer accent wall', 'each', (c) => c.package === 'Dormer Package'],
  /* The knowledge base: no roll-up or garage door on a barn. */
  ['Sectional Garage Door', 'Sectional garage door', 'count', (c) => usesWoodOptions(c) && !taBarn(c)],
  ['84" Wood Door (upcharge from std door)', '84 in. wood door (upcharge)', 'count', (c) => usesWoodOptions(c)],
  ['Custom Wood Doors', 'Custom wood door', 'count', (c) => usesWoodOptions(c)],
  ['Greenhouse Irrigation', 'Greenhouse irrigation', 'each', (c) => c.style === 'Greenhouse'],
  ['Greenhouse Hose Connection Package', 'Greenhouse hose connection', 'each', (c) => c.style === 'Greenhouse'],
];
const taListPrice = (name) => (TA_PRICE_OPTIONS.find((o) => o.name === name) || TA_PRICE_PACKAGES.find((o) => o.name === name))?.price ?? null;
const taAddon = (name) => TA_ADDONS.find((a) => a[0] === name);
const taAddonQty = (c, name) => {
  const a = taAddon(name), q = c.extras?.[name];
  return !a || !q ? 0 : a[2] === 'floor' || a[2] === 'each' ? (a[2] === 'floor' ? floorArea(c) : 1) : Number(q) || 0;
};
/* The add-ons on a building that still apply to it, as price lines. */
function taAddonRows(c) {
  return Object.keys(c.extras || {})
    .map((name) => {
      const a = taAddon(name), qty = taAddonQty(c, name), price = taListPrice(name);
      if (!a || !qty || price == null || !a[3](c)) return null;
      const kind = a[2], per = kind === 'each' || kind === 'count' ? ' each' : kind === 'ft' ? ' per ft' : ' per sq ft';
      return {
        name: kind === 'each' ? a[1] : kind === 'count' ? `${a[1]} × ${qty}` : `${a[1]} · ${qty} ${kind === 'ft' ? 'ft' : 'sq ft'}`,
        amount: Math.round(price * qty * 100) / 100,
        source: `${PRICE_LIST_SOURCE} · ${money(price)}${per}`,
        addon: name,
      };
    })
    .filter(Boolean);
}
function taAddonSet(name, value) {
  const c = S.c;
  c.extras ||= {};
  if (!value || Number(value) <= 0) delete c.extras[name];
  else c.extras[name] = value === true ? 1 : Math.round(Number(value));
  render();
}
function taAddonsMarkup(c) {
  const list = TA_ADDONS.filter((a) => a[3](c));
  if (!list.length) return '';
  const area = floorArea(c);
  return `<h3>Add from the price list</h3><p class="draft-note">Options the price list has that the steps above do not. Each adds its own line to the price.</p><div class="ta-addons">${list
    .map(([name, label, kind]) => {
      const price = taListPrice(name), q = c.extras?.[name], on = !!q, id = 'ta-x-' + TA_ADDONS.findIndex((a) => a[0] === name);
      const per = kind === 'sq ft' ? ' per sq ft' : kind === 'ft' ? ' per ft' : kind === 'floor' ? ' per sq ft of floor' : ' each';
      const control =
        kind === 'each' || kind === 'floor'
          ? `<label class="ta-toggle"><input id="${id}" type="checkbox" ${on ? 'checked' : ''} onchange="taAddonSet(${esc(JSON.stringify(name))},this.checked)"> <span>${on ? 'Added' : 'Add'}</span></label>`
          : `<label class="ta-qty"><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${on ? q : ''}" placeholder="0" aria-label="${esc(label)}: ${kind === 'count' ? 'how many' : kind}" onchange="taAddonSet(${esc(JSON.stringify(name))},this.value)"><span>${kind === 'count' ? 'qty' : kind}</span></label>`;
      const sum = on ? money(price * taAddonQty(c, name)) : '';
      return `<div class="ta-addon${on ? ' on' : ''}"><span class="grow"><strong>${esc(label)}</strong><small>${money(price)}${per}${kind === 'floor' ? ` · ${area} sq ft` : ''}</small></span>${sum ? `<strong class="ta-sum">+${sum}</strong>` : ''}${control}</div>`;
    })
    .join('')}</div><p class="source">Prices from Turbo Assist’s price list. ${button('See the whole price list', 'taPriceList()', 'link inline')}</p>`;
}
/* What the knowledge base says about the size and style on the screen. */
function taSizeRules(c) {
  const [w, l] = c.size.split('x').map(Number), out = [];
  if (w >= 16) out.push(`16 ft wide is build on site only. It cannot be delivered. ${S.path === 'site' ? '' : 'Start it as “Build on site” instead. '}${taTip('size-limits', 'Size and delivery limits')}`);
  else if (w === 14) out.push(`14 ft wide is delivered, as a custom order and a wide load with a permit. Lots do not usually stock it. ${taTip('size-limits', 'Size and delivery limits')}`);
  if (w < 16 && l > 40) out.push(`Longer than 40 ft is past the largest building we deliver (14 × 40). Plan it as build on site. ${taTip('build-on-site', 'Build on site')}`);
  if (taBarn(c)) out.push(`Barns come with lofts: 4 ft on buildings 12 ft and shorter, 8 ft on 16 ft and longer. No roll-up door or dormer on a barn. ${taTip('roof-rules', 'Roof and door rules')}`);
  return out.map((t) => `<p class="ta-rule">${icon('help', 16)}<span>${t}</span></p>`).join('');
}
{
  const deskStep = stepBody;
  stepBody = function () {
    const out = deskStep(), step = steps[S.step], c = S.c;
    if (S.path === 'lot' || !Array.isArray(out)) return out;
    if (step === 'Size') out[1] += taSizeRules(c);
    else if (step === 'Style') out[1] += `<p class="ta-rule">${icon('help', 16)}<span>Every wood series (Basic, Classic, Elite) comes in Utility, Barn and Studio roofs. Classic and Elite add the TechShield radiant barrier. ${taTip('siding-tiers', 'Series')} ${taTip('roof-styles', 'Roof styles')}</span></p>`;
    else if (step === 'Electrical') out[1] += `<p class="ta-rule">${icon('help', 16)}<span>Packages are plug-in, for storage use. The customer’s electrician brings it to local code; we do not pull permits or hook up service. ${taTip('electrical', 'Electrical packages')}</span></p>`;
    else if (step === 'Finish') out[1] += taAddonsMarkup(c) + (c.style === 'Greenhouse' ? `<p class="ta-rule">${icon('help', 16)}<span>The greenhouse exhaust fan is in the base price, not an add-on. ${taTip('greenhouse', 'Greenhouse')}</span></p>` : '');
    return out;
  };
}
/* The price: add-ons, tall walls and build on site, each at the list's price. */
{
  const deskBreakdown = breakdown;
  breakdown = function (c = S.c) {
    const rows = deskBreakdown(c), area = floorArea(c), extra = [];
    const tall = c.style === 'Lofted' ? 'Lofted High Walls' : c.style === 'Utility' ? 'High Wall Utility per SQ FT' : null;
    if (usesWoodOptions(c) && Number(c.wallHeight) === 7 && tall) extra.push({ name: '7 ft sidewalls (tall wall)', amount: Math.round(area * taListPrice(tall) * 100) / 100, source: `${PRICE_LIST_SOURCE} · ${money(taListPrice(tall))} per sq ft of floor` });
    if (c.buildOnSite) extra.push({ name: 'Build on site', amount: Math.round(area * taListPrice('Build On Site') * 100) / 100, source: `${PRICE_LIST_SOURCE} · ${money(taListPrice('Build On Site'))} per sq ft of floor` });
    extra.push(...taAddonRows(c));
    if (!extra.length) return rows;
    rows.push(...extra);
    /* A percent fuel surcharge follows the price, add-ons included. */
    const fuel = rows.find((r) => r.name === 'Fuel surcharge');
    if (fuel && !fuel.needed && typeof ofFuelFor === 'function') {
      const amount = ofFuelFor(c, rows.reduce((t, r) => t + (r === fuel ? 0 : r.amount), 0));
      if (amount != null) fuel.amount = amount;
    }
    return rows;
  };
}
/* The quote's "what is included" line and the plant's build sheet both list the add-ons. */
{
  const deskIncluded = included;
  included = function (c) {
    return [...deskIncluded(c), ...taAddonRows(c).map((r) => r.name)];
  };
  const sheetLayout = bsLayout;
  bsLayout = function (c) {
    const lay = sheetLayout(c), rows = taAddonRows(c);
    if (rows.length) lay.notes = [...lay.notes, ...rows.map((r) => `${r.name}: on the order, not drawn on this sheet.`)];
    return lay;
  };
}

/* ---------- Rent-to-own: the office's terms, Turbo Assist's arithmetic ---------- */
const TA_RTOC = { price: 0, paid: 0, tax: 0, open: null };
const taPayments = (n) => `${n} payment${n === 1 ? '' : 's'}`;
function taRtoTable() {
  const s = TA_RTOC;
  const rows = TA.rto.terms
    .map((t) => {
      const c = taRtoCalc(t.months, s.price, s.paid, s.tax), chart = s.open === t.months ? taRtoChart(t.months, s.price, s.paid, s.tax) : null;
      return `<tr><td><strong>${t.months} Mo</strong></td><td data-l="Required down payments">${t.downType === 'payments' ? taPayments(t.down) : (t.down * 100).toFixed(1) + '%'} <button type="button" class="ta-min" title="Set cash paid today to the least this term takes" onclick="TA_RTOC.paid=${c.minToday};document.getElementById('ta-rto-paid').value=${c.minToday};taRtoDraw()">${money(c.minToday)}</button></td><td data-l="Reserve (CSRA)">${money(c.csra)}</td><td data-l="Payment estimate"><strong>${money(c.payment)}</strong></td><td><button type="button" class="secondary small" onclick="TA_RTOC.open=${s.open === t.months ? 'null' : t.months};taRtoDraw()">${s.open === t.months ? 'Hide chart' : 'Open chart'}</button></td></tr>${
        chart
          ? `<tr class="ta-chart"><td colspan="5"><p class="source">${t.epo == null ? 'The office has not set a payoff percent for this term yet (Office, Settings). ' : `Paying the contract off early costs ${Math.round(t.epo * 100)}% of what is left on it. `}Total paid does not reflect the reserve.</p><div class="ta-chartscroll"><table><thead><tr><th>Payments made</th><th>Total paid</th><th>Remaining contract</th><th>Payoff amount</th><th>Total if paid out</th></tr></thead><tbody>${chart
              .map((r) => `<tr><td>${r.made}</td><td>${money(r.totalPaid)}</td><td>${money(r.remaining)}</td><td>${r.payoff == null ? '—' : money(r.payoff)}</td><td>${r.totalIfPaidOut == null ? '—' : money(r.totalIfPaidOut)}</td></tr>`)
              .join('')}</tbody></table></div></td></tr>`
          : ''
      }`;
    })
    .join('');
  return `<table class="ta-rto"><thead><tr><th>Term</th><th>Required down payments</th><th>Reserve (CSRA)</th><th>Payment estimate</th><th>Payoff chart</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function taRtoDraw() {
  const el = $('#ta-rto-table');
  if (el) el.innerHTML = taRtoTable();
}
function taRtoOpen(price) {
  Object.assign(TA_RTOC, { price: Math.round(Number(price) * 100) / 100 || 0, paid: 0, tax: TA.rto.taxPct, open: null });
  modal(
    'Rent-to-own estimate',
    `<p class="notice">All numbers are estimates and should not be construed as final authoritative figures.</p>
    <div class="fields ta-rtofields"><label>Cash price<input type="number" min="0" step="0.01" value="${TA_RTOC.price}" oninput="TA_RTOC.price=+this.value||0;taRtoDraw()"></label><label>Cash paid today<input id="ta-rto-paid" type="number" min="0" step="0.01" value="0" oninput="TA_RTOC.paid=+this.value||0;taRtoDraw()"></label><label>Tax %<input type="number" min="0" step="0.01" value="${TA_RTOC.tax}" oninput="TA_RTOC.tax=+this.value||0;taRtoDraw()"></label></div>
    <div id="ta-rto-table" class="ta-rtowrap">${taRtoTable()}</div>
    <p class="source">The office sets the terms (Office, Settings, Rent-to-own terms). Money paid today above the required down payments goes to the customer’s reserve with the RTO company and lowers the price the payment is figured on. The amount under “Required down payments” is the least to pay today; tap it to fill it in.</p>
    <ul class="ta-rtofacts"><li>No interest. It is a month-to-month lease that can end in ownership. ${taTip('rto-overview', 'Rent-to-own overview')}</li><li>90 days same as cash while the account stays current.</li><li>The first regular payment is due about 30 days after delivery. ${taTip('rto-timing', 'Payment timing')}</li><li>The deposit can be cash, card or a certified check. Nothing is scheduled until it and the paperwork are in. ${taTip('rto-rules', 'Rules for staff')}</li></ul>`
  );
  $('.modal')?.classList.add('wide');
}
const taRtoLink = (price, text = 'Money down and payoff by term') => `<button type="button" class="link inline ta-rtolink no-print" onclick="taRtoOpen(${price})">${text} ${icon('arrow', 14)}</button>`;
{
  const deskSummary = summary;
  summary = function () {
    return deskSummary().replace('<p class="source">Divisors inferred from public payments. Estimates, not approved terms.</p>', `<p class="source">Monthly math uses the office’s rent-to-own terms. Estimates, not approved terms. ${taRtoLink(amount())}</p>`);
  };
  const deskUnit = unitPage;
  unitPage = function () {
    const u = lots[S.unit], html = deskUnit();
    return u ? html.replace('<p class="source">Payments are estimates, not approved terms.', `<p class="source">${taRtoLink(u.price)}<br>A building on the lot is usually delivered within 1 to 2 weeks of the sale. ${taTip('lead-times', 'Lead times')}<br>Payments are estimates, not approved terms.`) : html;
  };
  const deskQuote = quoteView;
  quoteView = function (customer = false) {
    const q = currentQ(), html = deskQuote(customer);
    if (!q) return html;
    const custom = q.c && !(S.sales.find((s) => s.id === q.saleId)?.path === 'lot');
    return html.replace(
      '<p class="source">Estimated with divisors inferred',
      `<p class="ta-quotefacts"><strong>Good to know.</strong> ${custom ? 'A custom order usually takes 2 to 4 weeks from the order to delivery.' : 'A building on the lot is usually delivered within 1 to 2 weeks.'} Delivery is free within ${FREE_DELIVERY_MILES} miles of the lot. Wood buildings carry the limited lifetime warranty; a greenhouse has its own. Rent-to-own has no interest and 90 days same as cash.${customer ? '' : ` ${taRtoLink(q.total)}`}</p><p class="source">Estimated with divisors inferred`
    );
  };
}
/* Billing: what rent-to-own takes at signing comes from the office's terms; a cash sale shows its usual deposit. */
{
  const deskBilling = openBilling;
  openBilling = function () {
    deskBilling();
    const form = $('#saleBilling');
    if (!form) return;
    const el = form.elements, total = amount(), pct = typeof OF === 'object' ? OF.set.depositPct : 10;
    const provider = (typeof OF === 'object' && OF.set.rtoCos[0]) || TA.rto.provider;
    const fs = el.rtoTerms;
    fs.innerHTML = fs.innerHTML.replace('Provider: Sample RTO provider', `Provider: ${esc(provider)}`).replace('<p>Amount due at signing: pending provider confirmation</p>', '<p id="ta-due"></p>');
    form.querySelector('[name=deposit]').closest('label').insertAdjacentHTML('afterend', `<p class="ta-dephint" id="ta-dephint"></p>`);
    const hint = () => {
      const rto = el.type.value === 'Rent-to-own', c = rto ? taRtoCalc(Number(el.term.value), total) : null, want = rto ? c.minToday : Math.round(total * pct) / 100;
      if ($('#ta-due')) $('#ta-due').innerHTML = rto ? `Due at signing: ${taPayments(c.downPayments)} · <strong>${money(c.minToday)}</strong>, from the office’s rent-to-own terms.` : '';
      $('#ta-dephint').innerHTML = `${rto ? `Rent-to-own takes ${taPayments(c.downPayments)} at the order: ${money(want)}.` : `A cash sale usually takes ${pct}% at the order: ${money(want)}. The balance is due before delivery is scheduled.`} <button type="button" class="link inline" onclick="this.form.elements.deposit.value=${want}">Use ${money(want)}</button> ${taTip('down-payment', 'Deposit rules')}`;
    };
    el.type.addEventListener('change', hint);
    el.term.addEventListener('change', hint);
    hint();
  };
}

/* ---------- The order page: answers that fit this order ---------- */
function taOrderFacts(s) {
  const lot = s.path === 'lot', rto = s.type === 'Rent-to-own', done = ['Delivered', 'Cancelled'].includes(s.status), c = s.c;
  if (done) return '';
  const wood = typeof usesWoodOptions === 'function' ? usesWoodOptions(c) || c.style === 'Silver Bullet' : true;
  const facts = [
    [lot ? 'A building on the lot is usually delivered within 1 to 2 weeks of the sale.' : 'A custom order usually takes 2 to 4 weeks from the order to delivery. Weather and special options can add time.', 'lead-times', 'Lead times'],
    [rto ? 'Rent-to-own: the first regular payment is due about 30 days after delivery. 90 days same as cash.' : 'Cash: the balance is due before delivery is scheduled.', rto ? 'rto-timing' : 'down-payment', rto ? 'Payment timing' : 'Deposit rules'],
    [wood ? 'Limited lifetime warranty on this series.' : 'A greenhouse has its own warranty, not the limited lifetime one.', 'warranty', 'Warranty'],
    ['The crew levels the building on block: about 2 in. at the high point, never more than 16 in. They do not regrade the yard.', 'set-height', 'Blocking'],
    ['Anchors are not included. They are priced separately.', 'wind-anchors', 'Anchors and wind'],
  ];
  return `<details class="ops-notes ta-facts" ${S.taFacts ? 'open' : ''} ontoggle="S.taFacts=this.open"><summary>Answers for this order: lead time, payments, warranty, set-up</summary><ul>${facts.map(([t, id, label]) => `<li>${esc(t)} ${taTip(id, label)}</li>`).join('')}</ul></details>`;
}
{
  const deskOrder = orderPage;
  orderPage = function () {
    const s = S.sales.find((x) => x.id === S.activeSale), html = deskOrder();
    return s && s.status !== 'Quote issued' ? html.replace('<div class="od-grid">', taOrderFacts(s) + '<div class="od-grid">') : html;
  };
}

/* ---------- Orders: where is this building? (the plant's serial status) ---------- */
{
  const deskOrders = orders;
  orders = function () {
    return deskOrders().replace('</label>', '</label><div id="ta-serial" class="ta-serial" hidden></div>');
  };
  const deskFilter = filterOrders;
  filterOrders = function (q) {
    deskFilter(q);
    const el = $('#ta-serial'), text = String(q || '').trim();
    if (!el) return;
    const r = text.length >= 5 && typeof taSerialStatus === 'function' ? taSerialStatus(text) : null;
    el.hidden = !r || !r.found;
    if (r?.found) el.innerHTML = `${icon('build', 18)}<span><strong>Plant status.</strong> ${esc(r.text)}</span>`;
  };
}

/* ---------- Stats: the counts the shipped Sales Desk shows ---------- */
function taDeskStats() {
  const days = S.taStatDays || 90, cut = Date.now() - days * 864e5;
  const mine = S.sales.filter(deskSale).filter((s) => s.status !== 'Quote issued' && (!s.submittedAt || Date.parse(s.submittedAt) >= cut));
  const closed = mine.filter((s) => ['Delivered', 'Cancelled'].includes(s.status)).length, onLot = lots.filter((u) => u.status === 'Available').length;
  const quoted = S.sales.filter((s) => s.quoteId && s.status !== 'Quote issued').length;
  const tile = (label, value) => `<div class="metric">${label}<strong>${value}</strong></div>`;
  return `<section class="panel ta-stats"><div class="panelhead"><h2>This desk</h2><label class="inlinefield">Time window <select onchange="S.taStatDays=+this.value;render()">${[30, 60, 90, 365].map((d) => `<option value="${d}" ${d === days ? 'selected' : ''}>${d} days</option>`).join('')}</select></label></div>
    <div class="metricrow">${tile('Opened', mine.length)}${tile('Closed', closed)}${tile('Open', mine.length - closed)}${tile('On the lot', onLot)}</div>
    <p class="eyebrow" style="margin-top:16px">This session</p>
    <div class="metricrow">${tile('Issued quote versions', S.quotes.length)}${tile('Quotes to closed sales', quoted)}${tile('Shown to customer', S.shown.length)}${tile('Stock requests', S.stock.length)}</div>
    <p class="source">These are the counts Turbo Assist’s Sales Desk shows under Stats. There, quote versions have no record yet; this preview counts the quotes issued in this visit.</p></section>`;
}
{
  const deskStats = performanceScreen;
  performanceScreen = function () {
    const html = deskStats(), at = html.indexOf('<section class="panel">');
    return at < 0 ? html + taDeskStats() : html.slice(0, at) + taDeskStats() + html.slice(at);
  };
}

/* ---------- Sources page: what came from Turbo Assist's repo ---------- */
{
  const deskNotes = notes;
  notes = function () {
    return (
      deskNotes() +
      `<section class="panel notes"><h2>From Turbo Assist (bennett-buddy ${TA.commit})</h2><ul>
      <li><strong>Knowledge base.</strong> ${TA_KB.length} articles open from Answers on every side: delivery and lead times, size limits, roof and door rules, set height and blocking, materials, wind and anchors, down payments, rent-to-own, steel, the CRM, and how Turbo Assist itself works. ${TA_KB_STAFF_ONLY.length} more are listed by title only, because the repo marks them for inside the company.</li>
      <li><strong>Price list.</strong> All ${TA_PRICE_OPTIONS.length} options and ${TA_PRICE_PACKAGES.length} packages, plus ${TA_PRICE_EXTRA.length} retail prices that are only in the sheet IdeaRoom is loaded from (Studio Greenhouse, doghouse upgrades, credits for leaving a door or window out). Add-ons the configurator lacked are now on its last step.</li>
      <li><strong>Rent-to-own.</strong> The calculator uses Turbo Assist’s arithmetic and columns. The term numbers are the office’s to set (Office, Settings).</li>
      <li><strong>Leads and the daily checklist.</strong> The real source names, interest levels, timelines, first follow-up by interest, reminders at 3, 7 and 14 days, and the five checklist items with six ads a day.</li>
      <li><strong>Left out on purpose.</strong> The owners’ names, pay and commission plans, cost and wholesale numbers, vendor prices, haul rates, production pay, and the staff contacts list. This page is public.</li>
      <li><strong>Where the repo and this preview differ.</strong> The knowledge base says $100 for 50 to 60 miles and manager approval past 60; this preview charges what the owner confirmed ($100 for 51 to 100, Logistics approves past 100). The repo’s lot list is older than buybennett.com. Its built-in rent-to-own defaults for 36 and 48 months do not match the public listing payments, and it has no 60-month term.</li>
      </ul></section>`
    );
  };
}

/* A stale-lead reminder, worded the way Turbo Assist titles it. */
leadData.forEach((l, i) => {
  const d = taLeadStale(l);
  if (d) taNotify({ to: 'sales', title: `Stale lead — ${d} day${d === 1 ? '' : 's'} (${l.name})`, body: `No touch on this lead for ${l.touched} days. ${taLeadNext(l).action}.`, go: `lead(${i})`, at: Date.now() - 3 * 3600e3 });
});
