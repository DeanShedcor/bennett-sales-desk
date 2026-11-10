/* views.js: screens, layout and boot.
   State, pricing, catalog rules and the sale flow live in core.js. */

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  lot: '<path d="M2.5 20.5h19"/><path d="M5 20.5V10l7-5 7 5v10.5"/><path d="M10 20.5v-6h4v6"/>',
  orders: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  chart: '<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-7"/>',
  restock: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  chevron: '<path d="m6 15 6-6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  build: '<path d="M14 6 18 2l4 4-4 4z"/><path d="m16 8-11 11a2 2 0 0 1-3-3L13 5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  rotate: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.500"/>'
};
function icon(name, size = 20) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/* ---------- Shell helpers ---------- */

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

function go(page) {
  S.page = page;
  render();
  scrollTo(0, 0);
}

function head(kicker, title, lede = '') {
  return `<header class="pagehead"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div><span class="pill ghost">Bennett sells · ShedCor builds</span></header>`;
}

/* Production stage tracker: nine ShedCor phases, current one named. */
function stageTrack(stage) {
  return `<div class="track" role="img" aria-label="Stage ${stage + 1} of ${phaseNames.length}: ${phaseNames[stage]}">${phaseNames
    .map((_, i) => `<i class="${i < stage ? 'done' : i === stage ? 'now' : ''}"></i>`)
    .join('')}</div><div class="track-label"><strong>${phaseNames[stage]}</strong><span>Stage ${stage + 1} of ${phaseNames.length}</span></div>`;
}

const sampleBuilds = [
  { title: 'Taylor Reed', tag: 'Sample order', sub: '10x16 Classic Utility · ShedCor', stage: 3 },
  {
    title: 'THIS IS A TEST',
    tag: 'Source test unit',
    sub: 'pre-build:9cebedca · ShedCor · Orangeburg',
    stage: 0,
    note: 'Read-only source record verified in the earlier app review. No customer identity copied.'
  }
];
function sampleBuildRows(count = sampleBuilds.length) {
  return sampleBuilds
    .slice(0, count)
    .map(
      (b) =>
        `<div class="buildrow"><div class="buildrow-head"><strong>${b.title}</strong><span class="pill ghost">${b.tag}</span></div><small>${b.sub}</small>${stageTrack(b.stage)}${b.note ? `<p class="source">${b.note}</p>` : ''}</div>`
    )
    .join('');
}

/* ---------- Home ---------- */

function leadRows() {
  return leadData
    .slice(0, S.tiles.leadCount)
    .map(
      (l, i) =>
        `<button class="listrow" onclick="lead(${i})"><span class="initial">${l.initial}</span><span class="grow"><strong>${l.name}</strong><small>${l.need}</small></span><span class="pill blue">${l.source}</span><span class="rowarrow">${icon('arrow', 18)}</span></button>`
    )
    .join('');
}

function salesRows(arr = S.sales) {
  return arr
    .map(
      (s) =>
        `<button class="listrow" onclick="openSale('${s.id}')"><span class="grow"><strong>${esc(s.customer)} · ${s.id}</strong><small>${label(s.c)}</small><span class="pillrow"><span class="pill">${s.status}</span><span class="pill blue">${s.fulfillment}</span></span></span><span class="rowarrow">${icon('arrow', 18)}</span></button>`
    )
    .join('');
}

/* Home hero: a golden-hour field painted behind the building cut-out. The drawing uses the
   photo's own pixel grid (1600 x 901) so its horizon lines up with the photo at any size. */
function heroScene() {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let woods = '';
  for (let x = -3300; x < 2400; x += 120 + rand() * 150) {
    const w = 230 + rand() * 190, h = w * (0.2 + rand() * 0.07), flip = rand() > 0.5;
    const left = Math.round(x), top = Math.round(606 - h);
    woods += `<use href="#sc-oak" width="${Math.round(w)}" height="${Math.round(h)}" transform="translate(${flip ? left + Math.round(w) : left} ${top})${flip ? ' scale(-1 1)' : ''}"/>`;
  }
  let blooms = '';
  const petals = ['#e08fb0', '#f2c14e', '#f6e7c3', '#d977a0'];
  for (let i = 0; i < 46; i++) {
    const x = -900 + rand() * 3200, y = 900 + rand() * 330;
    blooms += `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${Math.round(7 + rand() * 12)}" fill="${petals[i % 4]}" opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`;
  }
  return `<div class="scene">
    <svg class="scene-bg" viewBox="-3200 -700 5600 2000" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d6189"/><stop offset=".5" stop-color="#7f9fbb"/><stop offset=".82" stop-color="#d3cdb6"/><stop offset="1" stop-color="#f3d8a2"/></linearGradient>
        <radialGradient id="sc-sun" gradientUnits="userSpaceOnUse" cx="1560" cy="585" r="1300"><stop offset="0" stop-color="#ffe6b0" stop-opacity=".95"/><stop offset=".3" stop-color="#ffcf8a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
        <linearGradient id="sc-field" gradientUnits="userSpaceOnUse" x1="0" y1="590" x2="0" y2="1300"><stop offset="0" stop-color="#bdb16c"/><stop offset=".12" stop-color="#9e9550"/><stop offset=".3" stop-color="#857c3b"/><stop offset=".62" stop-color="#756d33"/><stop offset="1" stop-color="#595326"/></linearGradient>
        <symbol id="sc-oak" viewBox="70 20 1440 250" preserveAspectRatio="none"><image href="./shed-hero.png" width="1600" height="901"/></symbol>
        <pattern id="sc-turf" width="520" height="84" patternUnits="userSpaceOnUse"><g id="sc-turf-tile"><svg width="260" height="42" viewBox="335 802 260 42" preserveAspectRatio="none"><image href="./shed-hero.png" width="1600" height="901"/></svg></g><use href="#sc-turf-tile" transform="translate(520 0) scale(-1 1)"/><use href="#sc-turf-tile" transform="translate(0 84) scale(1 -1)"/><use href="#sc-turf-tile" transform="translate(520 84) scale(-1 -1)"/></pattern>
        <linearGradient id="sc-near" gradientUnits="userSpaceOnUse" x1="0" y1="610" x2="0" y2="760"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
        <mask id="sc-nearmask" maskUnits="userSpaceOnUse" x="-3200" y="590" width="5600" height="710"><rect x="-3200" y="590" width="5600" height="710" fill="url(#sc-near)"/></mask>
        <filter id="sc-haze" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="2.200"/><feColorMatrix type="matrix" values="0.62 0.1 0 0 0.16  0.08 0.62 0 0 0.17  0.05 0.1 0.5 0 0.14  0 0 0 1 0"/></filter>
        <filter id="sc-turfsoft" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="1.300"/></filter>
        <filter id="sc-soft" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="sc-softer" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="26"/></filter>
        <filter id="sc-bloom" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
        <filter id="sc-grass" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.045" numOctaves="4" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.14  0 0 0 0 0.04  1.5 1.2 0 0 -0.95"/></filter>
        <filter id="sc-light" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.02" numOctaves="3" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.55  0 1.6 0.8 0 -1.05"/></filter>
      </defs>
      <rect x="-3200" y="-700" width="5600" height="1300" fill="url(#sc-sky)"/>
      <rect x="-3200" y="-700" width="5600" height="1300" fill="url(#sc-sun)"/>
      <g fill="#fff1d6" opacity=".55" filter="url(#sc-softer)"><ellipse cx="250" cy="150" rx="520" ry="34"/><ellipse cx="-700" cy="330" rx="700" ry="40"/><ellipse cx="1750" cy="60" rx="460" ry="30"/><ellipse cx="1050" cy="345" rx="360" ry="22"/><ellipse cx="-1900" cy="120" rx="600" ry="36"/></g>
      <path d="M-3200 610V548C-2700 505-2250 562-1650 536S-650 500 0 548 900 520 1400 552 2100 522 2400 546V610Z" fill="#8d9d92" filter="url(#sc-soft)"/>
      <path d="M-3200 615V572C-2500 548-2000 588-1300 566S-200 556 400 580 1500 566 2400 578V615Z" fill="#818a5c" filter="url(#sc-soft)"/>
      <g filter="url(#sc-haze)">${woods}</g>
      <rect x="-3200" y="590" width="5600" height="710" fill="url(#sc-field)"/>
      <g mask="url(#sc-nearmask)"><rect x="-3200" y="590" width="5600" height="710" fill="url(#sc-turf)" filter="url(#sc-turfsoft)" opacity=".9"/></g>
      <rect x="-3200" y="590" width="5600" height="710" filter="url(#sc-grass)" opacity=".55"/>
      <rect x="-3200" y="590" width="5600" height="710" filter="url(#sc-light)" opacity=".4"/>
      <ellipse cx="1300" cy="640" rx="1500" ry="60" fill="#ffe9ad" opacity=".35" filter="url(#sc-softer)"/>
      <g filter="url(#sc-bloom)">${blooms}</g>
    </svg>
    <img class="shed-halo" src="./shed-hero.png" alt="" aria-hidden="true">
    <img class="shed-hero" src="./shed-hero.png" alt="White Bennett building with a covered porch beneath a spreading oak" width="1600" height="901" fetchpriority="high">
  </div>`;
}

function home() {
  const available = lots.filter((u) => u.status === 'Available').length;
  const building = S.sales.length || sampleBuilds.length;
  const today = [
    ['user', leadData.length, 'new leads', "document.getElementById('leads-panel')?.scrollIntoView({behavior:'smooth',block:'start'})"],
    ['receipt', receiptReviewCount(), 'receipts to review', "go('receipts')"],
    ['build', building, 'builds in progress', "go('orders')"],
    ['lot', available, 'available on the lot', "go('lot')"]
  ];
  const rows = [1, 2, 3]
    .map((n) => `<option ${S.tiles.leadCount === n ? 'selected' : ''}>${n}</option>`)
    .join('');
  return `<section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">${LOT_LOCATION} · Sales desk</div>
      <h1>From the first hello <br>to their backyard.</h1>
      <p>The right building. A clear price. One next step.</p>
      <div class="home-actions">
        <button type="button" class="primary big" onclick="S.saleLead=null;go('start')">Start a sale ${icon('arrow')}</button>
        <button type="button" class="ghostbtn big" onclick="go('orders')">${icon('orders')} Look up an order</button>
      </div>
    </div>
    ${heroScene()}
  </section>
  <div class="today" aria-label="Today at a glance">${today
    .map(
      ([ic, n, text, fn]) =>
        `<button type="button" class="kpi" onclick="${fn}">${icon(ic, 22)}<strong>${n}</strong><span>${text}</span></button>`
    )
    .join('')}</div>
  <div class="grid2 homegrid">
    ${
      S.tiles.leads
        ? `<section class="panel" id="leads-panel"><div class="panelhead"><h2>Incoming leads</h2><button class="chipbtn" onclick="go('receipts')">${icon('receipt', 16)} IdeaRoom receipts <span class="count">${receiptReviewCount()}</span></button></div>${leadRows()}</section>`
        : ''
    }
    ${
      S.tiles.builds
        ? `<section class="panel"><div class="panelhead"><h2>Buildings in progress</h2><button class="link" onclick="go('orders')">All orders ${icon('arrow', 16)}</button></div>${salesRows(S.sales.slice(-S.tiles.buildCount)) || sampleBuildRows(S.tiles.buildCount)}</section>`
        : ''
    }
  </div>
  <div class="homefoot">
    <div class="tours"><span><strong>New here?</strong> Walk the two demo journeys.</span>
      <button type="button" class="chipbtn" onclick="journey(1)">Custom build at $300/mo</button>
      <button type="button" class="chipbtn" onclick="journey(2)">Lot sale and restock</button>
    </div>
    <details class="customize" ${S.tiles.open ? 'open' : ''} ontoggle="S.tiles.open=this.open"><summary>Customize this page</summary>
      <div class="customize-body">
        <label class="checkrow"><input id="tile-leads" type="checkbox" ${S.tiles.leads ? 'checked' : ''} onchange="S.tiles.leads=this.checked;render()"> Incoming leads</label>
        <label class="checkrow"><input id="tile-builds" type="checkbox" ${S.tiles.builds ? 'checked' : ''} onchange="S.tiles.builds=this.checked;render()"> Buildings in progress</label>
        <label class="inlinefield">Rows <select id="tile-rows" onchange="S.tiles.leadCount=+this.value;S.tiles.buildCount=+this.value;render()">${rows}</select></label>
      </div>
    </details>
  </div>`;
}

function receiptInbox() {
  const pending = receiptReviewCount();
  return (
    `<button class="link backlink" onclick="go('home')">${icon('back', 16)} Sales home</button>` +
    head(
      'IDEAROOM RECEIPTS',
      `${pending} need review.`,
      'Sample receipts. Automatic matching requires both email and phone to identify exactly one active lead at this dealer.'
    ) +
    '<div class="stack">' +
    ideaRoomReceipts
      .map((r) => {
        const match = receiptMatch(r),
          manual = reviewedReceipts.get(r.id),
          lead = manual || match.lead;
        const state = manual ? 'Manually matched' : lead ? 'Auto matched' : 'Needs review';
        const review = lead
          ? `<p class="matched">${icon('check', 16)} Attached to ${esc(lead.name)}</p>`
          : `<p class="notice">${match.reason}</p><form class="attachform" onsubmit="attachReceipt(event,'${r.id}')"><label class="field">Choose an active lead<select id="lead-${r.id}" name="lead" required><option value="">Select a lead</option>${receiptLeads
              .map((l) => `<option value="${l.id}">${esc(l.name)} · ${esc(l.email)}</option>`)
              .join('')}</select></label><button class="secondary" type="submit">Attach to lead</button></form>`;
        return `<section class="panel receipt"><div class="panelhead"><h3>${r.id} · ${r.build}</h3><span class="pill ${lead ? '' : 'amber'}">${state}</span></div><p class="muted">${esc(r.email.trim() || 'Email missing')} · ${esc(r.phone || 'Phone missing')}</p>${review}</section>`;
      })
      .join('') +
    '</div>'
  );
}

/* ---------- Start a sale / lot ---------- */

/* Carport drawing for the Steel Structure card: a simple three-quarter view built from one
   corner point plus width, depth and height offsets. */
function carportArt() {
  const at = (w, d, h) => [60 + w * 90 + d * 110, 128 + w * 12 - d * 34 - h * 62];
  const pt = (w, d, h) => at(w, d, h).map((n) => n.toFixed(1)).join(',');
  const peak = (d) => { const [x, y] = at(0.5, d, 1); return x.toFixed(1) + ',' + (y - 22).toFixed(1); };
  const post = (w, d) => `<path d="M${pt(w, d, 0)}L${pt(w, d, 1)}"/>`;
  let ribs = '';
  for (let i = 1; i < 10; i++) ribs += `<path d="M${peak(i / 10)}L${pt(1, i / 10, 1)}"/>`;
  return `<svg class="carport-art" viewBox="0 0 320 170" role="img" aria-label="Steel carport">
    <ellipse cx="165" cy="128" rx="128" ry="26" fill="#0c1a28" opacity=".1"/>
    <polygon points="${pt(0, 0, 0)} ${pt(1, 0, 0)} ${pt(1, 1, 0)} ${pt(0, 1, 0)}" fill="#dfe4e8" stroke="#c3ccd4"/>
    <g stroke="#55626e" stroke-width="3.500" stroke-linecap="round">${post(0, 1)}${post(0, 0.5)}${post(0, 0)}</g>
    <polygon points="${pt(0, 0, 1)} ${peak(0)} ${peak(1)} ${pt(0, 1, 1)}" fill="#8f9ba5"/>
    <polygon points="${peak(0)} ${pt(1, 0, 1)} ${pt(1, 1, 1)} ${peak(1)}" fill="#c3cbd1"/>
    <g stroke="#98a4ad" stroke-width="1.200">${ribs}</g>
    <polygon points="${pt(0, 0, 1)} ${peak(0)} ${pt(1, 0, 1)}" fill="#aab4bc" stroke="#2f3b46" stroke-width="2.500" stroke-linejoin="round"/>
    <path d="M${pt(1, 0, 1)}L${pt(1, 1, 1)}M${peak(0)}L${peak(1)}" stroke="#2f3b46" stroke-width="2.500" stroke-linecap="round" fill="none"/>
    <g stroke="#2f3b46" stroke-width="4" stroke-linecap="round">${post(1, 1)}${post(1, 0.5)}${post(1, 0)}</g>
  </svg>`;
}

function start() {
  const lead = leadData[S.saleLead];
  const card = (model, title, text, cta, fn) =>
    `<section class="card startcard">${model}<h2>${title}</h2><p class="muted">${text}</p><button type="button" class="primary" onclick="${fn}">${cta} ${icon('arrow', 18)}</button></section>`;
  return (
    head('START A SALE', 'Choose their starting point.') +
    (lead
      ? `<section class="panel leadcontext"><span class="initial">${lead.initial}</span><div class="grow"><strong>${esc(lead.name)}</strong><p>${esc(lead.need)}</p></div><span class="pill blue">${esc(lead.source)}</span></section>`
      : '') +
    `<div class="cards startgrid">${card(
      modelMarkup(sourceUnit.c, true),
      'Sell from my lot',
      'A specific serial and its existing features travel with the sale.',
      'Browse my lot',
      "begin('lot')"
    )}${card(
      modelMarkup(defaults, true),
      'Configure a new building',
      'One choice at a time, with a running price and monthly budget.',
      'Start configuring',
      'begin()'
    )}${card(
      modelMarkup({ ...defaults, style: 'Studio', color: 'Sage Green' }, true),
      'Build on site',
      'Design a shed for on-site construction and save it for a site review.',
      'Configure an on-site build',
      "begin('site')"
    )}<section class="card startcard"><div class="reference-model mini">${carportArt()}</div><h2>Steel Structure</h2><p class="muted">Carports, garages and steel buildings are designed and quoted in the steel builder. It opens in a new tab.</p><a class="primary" href="https://steel.buybennett.com" target="_blank" rel="noopener">Open the steel builder ${icon('arrow', 18)}</a></section></div>`
  );
}

function lot() {
  return (
    head(
      `MY LOT · ${LOT_LOCATION.toUpperCase()}`,
      'Find the one they came for.',
      `${lots.length} buildings copied from the buybennett.com listing on ${LOT_LISTING_DATE}. Availability here is simulated, so confirm a building is still on the lot before quoting.`
    ) +
    `<label class="searchbar">${icon('orders')}<input id="lot-search" class="search" aria-label="Search lot" placeholder="Search size, style, color or serial" oninput="filterLot(this.value)"></label><div class="cards" id="lotcards">${lotCards('')}</div>`
  );
}

/* Real listing photo, resized by the listing site's image service. Falls back to the 3D
   reference model where the photo cannot load. */
function unitPhoto(u, i, width = 640) {
  const src = `https://shedcor.shedsuite.com/_next/image?url=${encodeURIComponent(u.photo)}&w=${width}&q=75`;
  return `<div class="unitphoto"><img src="${esc(src)}" alt="${esc(u.name)}" loading="lazy" onerror="this.parentNode.outerHTML=modelMarkup(lots[${i}].c,true)"></div>`;
}

function lotCards(q) {
  return (
    lots
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => [u.id, u.name, u.c.size, u.colors.siding, u.condition].join(' ').toLowerCase().includes(q.toLowerCase()))
      .map(
        ({ u, i }) =>
          `<section class="card lotcard">${unitPhoto(u, i)}<div class="lotcard-head"><span class="pillrow"><span class="pill ${u.status === 'Available' ? 'good' : 'amber'}">${u.status}</span><span class="pill ${u.condition === 'used' ? 'amber' : 'ghost'}">${u.condition === 'used' ? 'Pre-owned' : 'New'}</span></span></div><div class="lotpay"><strong class="price">${money(payment(u.price, 60))}<small>/mo</small></strong><span>60-month rent-to-own, before tax</span></div><h3>${esc(u.name)}</h3><small class="serial">${u.id}</small><p class="lotfacts">${u.c.size.replace('x', ' × ')} ft · ${esc(u.colors.siding)} siding · ${esc(u.colors.trim)} trim<br>Cash price <strong>${money(u.price)}</strong></p>${button(
            (u.status === 'Available' ? 'Choose this unit ' : 'View sales record ') + icon('arrow', 18),
            `pickLot(${i})`
          )}<button class="link" onclick="S.shown.push({unit:'${u.id}',date:new Date().toISOString()});toast('Shown-to-customer event recorded separately from quotes')">Mark as shown to customer</button>${
            u.status === 'Pending' ? button('Order another for stock', `restock(${i})`, 'secondary') : ''
          }</section>`
      )
      .join('') || '<p class="empty">No matching units.</p>'
  );
}

/* ---------- Configurator ---------- */

/* Top-view layout of a porch package, with the front of the building at the bottom.
   Left and right are as you face the front. Shapes are drawn right-handed and flipped for Left. */
function porchPlan(name, side = 'Left', large = false) {
  const sided = name === 'Side Porch' || name === 'Deluxe Porch';
  const wide = name === 'Middle Porch' || name === 'Side Porch';
  const [x0, y0, x1, y1] = wide ? [12, 14, 108, 74] : [30, 8, 90, 80];
  const shapes = {
    'Middle Porch': [[[12, 14], [108, 14], [108, 74], [78, 74], [78, 54], [42, 54], [42, 74], [12, 74]], [53, 54, 67, 54]],
    'Side Porch': [[[12, 14], [108, 14], [108, 54], [60, 54], [60, 74], [12, 74]], [77, 54, 91, 54]],
    'End Porch': [[[30, 8], [90, 8], [90, 62], [30, 62]], [53, 62, 67, 62]],
    'Deluxe Porch': [[[30, 8], [90, 8], [90, 26], [72, 26], [72, 50], [60, 62], [30, 62]], [62.5, 59.5, 69.5, 52.5]]
  };
  if (!shapes[name]) return '';
  const fx = (x) => (sided && side === 'Left' ? 120 - x : x);
  const [room, door] = shapes[name];
  let planks = '';
  for (let y = y0 + 5; y < y1; y += 5) planks += `M${x0} ${y}H${x1}`;
  return `<svg class="porchplan${large ? ' large' : ''}" viewBox="0 0 120 96" role="img" aria-label="${name}${sided ? ' on the ' + side.toLowerCase() : ''}, top view">
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="1.5" fill="#b78d60"/>
    <path d="${planks}" stroke="#8f6c47" stroke-width=".6"/>
    <polygon points="${room.map(([x, y]) => fx(x) + ',' + y).join(' ')}" fill="#f1e4c8" stroke="#1f2a35" stroke-width="3" stroke-linejoin="miter"/>
    <path d="M${fx(door[0])} ${door[1]}L${fx(door[2])} ${door[3]}" stroke="#ffffff" stroke-width="3.400"/>
    <text x="60" y="92" text-anchor="middle">Front</text>${
      large ? `<text x="${wide ? 6 : 22}" y="48" text-anchor="middle" transform="rotate(-90 ${wide ? 6 : 22} 48)">Left</text><text x="${wide ? 114 : 98}" y="48" text-anchor="middle" transform="rotate(90 ${wide ? 114 : 98} 48)">Right</text>` : ''
    }
  </svg>`;
}

function modelMarkup(c, small = false, interactive = !small) {
  const variants = bennettModels[c.style];
  if (!variants) return '';
  const index = c.siding === 'Lap' ? 2 : c.shield || c.siding === 'Silvertech groove' ? 1 : 0;
  const packageModel = {
    'Middle Porch': '08-side-porch',
    'End Porch': '09-end-porch',
    'Deluxe Porch': '10-deluxe-porch',
    'Dormer Package': '12-dormer-package',
    'Garage Package': '11-garage-package'
  }[c.package];
  const porchSide = c.porchSide || 'Left';
  if (c.package === 'Side Porch')
    return `<div class="reference-model planstage${small ? ' mini' : ''}">${porchPlan('Side Porch', porchSide, !small)}${
      small ? '' : '<p class="plan-note">Top view of the Side Porch layout. A 3D model for this package is not available yet.</p>'
    }</div>`;
  /* The deluxe porch model wraps the right side; the left-hand version is its mirror image. */
  const mirrored = c.package === 'Deluxe Porch' && porchSide === 'Left';
  const baseModel = packageModel || variants[index] || variants[0];
  const shutterModels = [
    '01-basic-utility', '02-classic-utility', '03-elite-utility', '04-basic-lofted-barn',
    '05-classic-lofted-barn', '06-elite-lofted-barn', '07-studio', '08-side-porch', '09-end-porch',
    '10-deluxe-porch', '11-garage-package', '12-dormer-package', '14-greenhouse', '21-craftsman-shake'
  ];
  const wantsShutters =
    (c.shutters && Number(c.windows) > 0) || (activePackage(c) && c.package === 'Dormer Package');
  const model = wantsShutters && shutterModels.includes(baseModel) ? baseModel + '-shutters' : baseModel;
  return `<div class="reference-model${small ? ' mini' : ''}"><model-viewer data-finish-config="${esc(
    JSON.stringify(c)
  )}" src="./${model}.glb" alt="${esc(
    packageModel ? c.package : c.style
  )} 3D reference model" loading="eager" interaction-prompt="none" ${mirrored ? 'scale="-1 1 1" ' : ''}shadow-intensity="0.9" shadow-softness="0.9" ${
    interactive
      ? 'camera-controls touch-action="pan-y"'
      : 'camera-orbit="40deg 75deg auto"'
  } onload="applyModelColors(this)"></model-viewer></div>`;
}

function sizeGroups() {
  const table = sizeLengths[S.c.style] || sizeLengths.standard;
  const [selectedWidth] = S.c.size.split('x');
  const width = table[S.sizeWidth] ? String(S.sizeWidth) : selectedWidth;
  const tabs = Object.keys(table)
    .map(
      (w) =>
        `<button type="button" role="tab" aria-selected="${w === width}" class="seg${w === width ? ' on' : ''}" onclick="S.sizeWidth='${w}';document.querySelector('.sizepick').outerHTML=sizeGroups()"><strong>${w} ft</strong><small>${w === selectedWidth ? 'selected' : table[w].length + ' lengths'}</small></button>`
    )
    .join('');
  const chips = table[width]
    .map((length) => {
      const size = width + 'x' + length;
      const on = S.c.size === size;
      return `<button type="button" class="sizechip${on ? ' selected' : ''}" aria-pressed="${on}" onclick="change('size','${size}')"><strong>${width} × ${length}</strong><small>${width * length} sq ft</small></button>`;
    })
    .join('');
  return `<div class="sizepick"><h3>Width</h3><div class="segrow" role="tablist" aria-label="Building width">${tabs}</div><h3>Length</h3><div class="sizegrid">${chips}</div></div>`;
}

/* Quantity stepper. `action` reads the new quantity from this.value. */
function openingQuantity(label, quantity, max, action) {
  const btn = (value, ic, disabled, aria) =>
    `<button type="button" value="${value}" ${disabled ? 'disabled' : ''} aria-label="${aria}" onclick="${action}">${icon(ic, 16)}</button>`;
  return `<span class="stepper" role="group" aria-label="${label}"><span class="stepper-label">${label}</span>${btn(
    quantity - 1, 'minus', quantity <= 1, 'One fewer'
  )}<output>${quantity}</output>${btn(quantity + 1, 'plus', quantity >= max, 'One more')}</span>`;
}

function windowCard(w, i) {
  const group = windowGroup(w);
  const spec = windowSpec(w);
  const count = windowItems(S.c).filter((other) => sameWindow(w, other)).length;
  const tile = (on, fn, thumb, name, price = '') =>
    `<button type="button" class="optile${on ? ' selected' : ''}" aria-pressed="${on}" onclick="${fn}">${thumb}<strong>${name}</strong>${price ? `<small>${price}</small>` : ''}</button>`;
  const types = Object.entries(windowCatalog)
    .map(([id, s]) =>
      tile(spec === s, `updateWindows(${i},&quot;option&quot;,&quot;${id}&quot;)`, windowThumb(s[2]), s[0], '+' + money(s[1]))
    )
    .join('');
  const groups = ['Single', 'Double', 'Triple']
    .map((name, j) =>
      tile(group === j + 1, `updateWindows(${i},&quot;group&quot;,${j + 1})`, windowThumb(['single', 'double', 'triple'][j]), name)
    )
    .join('');
  const addons = [
    ['shutters', '3 Board Shutters', '3-board-shutters', 60],
    ['flower', 'Flower Box', 'flower-box', 80 * group],
    ['transom', 'Transom Above Window', 'transom-above-window', 80 * group]
  ]
    .map(([key, name, asset, amount]) =>
      tile(Boolean(w[key]), `updateWindows(${i},&quot;${key}&quot;,${!w[key]})`, windowThumb(asset), name, '+' + money(amount))
    )
    .join('');
  return `<fieldset class="opening-tile"><legend>Window ${i + 1}</legend>
    <div class="opening-head">${openingQuantity('Quantity', count, 10 - S.c.windows + count, `updateWindows(${i},&quot;quantity&quot;,+this.value)`)}<strong class="opening-sum">+${money(windowPrice(w) * count)}</strong><button type="button" class="remove-opening" aria-label="Remove window ${i + 1}" onclick="updateWindows(${i},&quot;remove&quot;)">Remove</button></div>
    <h4>Type and size</h4><div class="optgrid five">${types}</div>
    ${w.option === 'Octagon' ? '' : `<h4>Grouping</h4><div class="optgrid three">${groups}</div><h4>Add-ons</h4><div class="optgrid three">${addons}</div>`}
  </fieldset>`;
}

function openingsMarkup() {
  const bundled = packageOpenings(S.c).length > 0;
  const includedMarkup = includedOpeningsMarkup(S.c);
  if (S.c.catalogOptions && S.c.style === 'Silver Bullet')
    return includedMarkup + '<p class="source">Metal sheds offer electrical packages. Openings are set by building width.</p>';
  const windows = windowItems(S.c);
  const cards = windows
    .map((w, i) => (windows.findIndex((other) => sameWindow(w, other)) === i ? windowCard(w, i) : ''))
    .join('');
  const extra = (S.c.extraDoors || [])
    .map((d, i, doors) =>
      doors.indexOf(d) !== i
        ? ''
        : `<div class="doorrow">${doorTileThumbnail(d)}<span class="grow"><strong>${esc(doorName(d))}</strong><small>${doorPriceLabel(d, true)} each</small></span>${openingQuantity(
            'Quantity', doors.filter((other) => other === d).length, 10, `setDoorQuantity(${i},this.value)`
          )}<button type="button" class="remove-opening" aria-label="Remove added door ${i + 1}" onclick="removeAddedDoor(${i})">Remove</button></div>`
    )
    .join('');
  return `${includedMarkup}<section class="panel openings"><div class="panelhead"><h3>${bundled ? 'Additional windows' : 'Windows'}</h3><button class="secondary" ${windows.length >= 10 ? 'disabled' : ''} onclick="updateWindows(-1)">${icon('plus', 16)} Add a window</button></div>${cards || '<p class="empty">No windows added.</p>'}<p class="source">Window options and prices are the same across shed sizes. Prices are based on IdeaRoom. Confirm placement for the selected build.</p></section>
  <section class="panel openings"><div class="panelhead"><h3>${bundled ? 'Additional doors' : 'Doors'}</h3><button class="secondary" onclick="openDoorPicker(true)">${icon('plus', 16)} Add a door</button></div>
  ${bundled ? '' : `<div class="doorrow">${doorTileThumbnail(S.c.door)}<span class="grow"><strong>${esc(doorName(S.c.door))}</strong><small>Main door · ${doorPriceLabel(S.c.door, false)}</small></span><button class="secondary" onclick="openDoorPicker(false)">Change</button></div>`}
  ${extra}
  <div class="door-color-choices">${doorFinishChoices()}</div>
  ${
    usesWoodOptions(S.c)
      ? `<label class="field">Custom door dimensions<input id="custom-door" maxlength="120" placeholder="Width × height and door type" value="${esc(S.c.customDoor)}" oninput="setCatalogText('customDoor',this.value)"></label><p class="source">Custom dimensions are saved for fit and price confirmation.</p>`
      : ''
  }
  <p class="source">Door add-on prices are from IdeaRoom on a 12 × 16 Basic Utility. Main-door changes use the difference from the included double shed door. Confirm fit and any unpriced option. The 3D model shows reference openings.</p></section>`;
}

/* Extra lights, switches and receptacles on top of the electrical package. */
const ELECTRICAL_EXTRAS = [
  ['extraLights', 'Extra light', 'Overhead LED light with bulb'],
  ['extraSwitches', 'Extra switch', 'Wall switch'],
  ['extraReceptacles', 'Extra receptacle', 'Outlet']
];

function electricalExtrasMarkup() {
  const off = S.c.electrical === 'None';
  const rows = ELECTRICAL_EXTRAS.map(([key, name, hint]) => {
    const qty = off ? 0 : Number(S.c[key]) || 0;
    const price = electricalExtraPrices[key];
    const btn = (value, ic, disabled, aria) =>
      `<button type="button" ${disabled ? 'disabled' : ''} aria-label="${aria}" onclick="setElectricalExtra('${key}',${value})">${icon(ic, 16)}</button>`;
    return `<div class="extrarow"><span class="grow"><strong>${name}</strong><small>${hint} · ${price === null ? 'price to confirm' : '+' + money(price) + ' each'}</small></span><span class="stepper" role="group" aria-label="${name} quantity">${btn(qty - 1, 'minus', off || qty <= 0, 'One fewer')}<output>${qty}</output>${btn(qty + 1, 'plus', off || qty >= 10, 'One more')}</span></div>`;
  }).join('');
  return `<section class="panel elec-extras"><div class="panelhead"><h3>Add extras</h3>${off ? '<span class="pill amber">Choose a package first</span>' : ''}</div>${rows}<p class="source">Extras are recorded on the quote. An item marked price to confirm is not added to the total, and the quote is flagged for review until its price is set.</p></section>`;
}

/* Updates only the extras panel and the price bar, so the 3D model is not reloaded. */
function setElectricalExtra(key, value) {
  S.c[key] = Math.max(0, Math.min(10, Math.floor(Number(value) || 0)));
  const panel = $('.elec-extras');
  if (panel) panel.outerHTML = electricalExtrasMarkup();
  refreshSummary();
}

const electricalChoices = [
  ['Minimal', '1 LED light, 1 switch, and 1 external drop-cord adapter.', 'minimal', '+$50'],
  ['Basic', '1 LED light, 1 switch, 1 receptacle, and 1 external drop-cord adapter.', 'basic', '+$100'],
  ['Expanded', '1 LED light, 1 switch, 3 receptacles, and 1 external drop-cord adapter.', 'expanded', '+$200'],
  ['Utility', '1 LED light, 1 switch, 3 receptacles, and a six-space breaker box.', 'utility', '+$555']
];

function stepBody() {
  const c = S.c;
  /* Steps are matched by name, so the order is set only by the `steps` list in core.js. */
  switch (steps[S.step]) {
    case 'Style':
      return [
        'Start with how they’ll use it.',
        `<div class="choicegrid">${Object.keys(descriptions)
          .map(
            (s) =>
              `<button class="choice stylecard${c.style === s ? ' selected' : ''}" aria-pressed="${c.style === s}" onclick="change('style','${s}')">${modelMarkup({ ...c, style: s }, true)}<strong>${s === 'Lofted' ? 'Lofted Barn' : s}</strong><small>${descriptions[s]}</small></button>`
          )
          .join('')}</div>`
      ];
    case 'Size':
      return [
        'Give their plans some room.',
        sizeGroups() +
          wallHeightMarkup(c) +
          '<p class="draft-note">Sizes follow IdeaRoom. Pricing uses the existing preview estimates. Sizes without a sample adjustment show the base estimate.</p>'
      ];
    case 'Package':
      return ['Choose a building package.', packageChoices()];
    case 'Colors':
      return ['Choose their colors.', `<div class="colors">${colorsMarkup()}</div>`];
    case 'Exterior':
      return [
        'The look comes first. Series follows.',
        c.style === 'Silver Bullet'
          ? '<p class="notice">Silver Bullet uses ribbed metal siding in this demo. Wood siding choices are omitted.</p>'
          : ['Greenhouse', 'Low-Wall Barn'].includes(c.style)
            ? '<p class="notice">Dedicated style package. Series rules and exact material options need confirmation.</p>'
            : '<div class="smart-side-tile">' +
              choice('siding', 'Basic groove', 'LP Smart Side', 'LP 3/8-inch groove · Basic or Classic with TechShield<img class="siding-thumb" src="./smartside-grooved-panel.png" alt="Vertical grooves on LP Smart Side" loading="lazy">', 'Included') +
              `<label class="techshield-addon"><input id="techshield" type="checkbox" ${c.shield ? 'checked' : ''} onchange="change('shield',this.checked)"> <span>Add TechShield (free upgrade to 7/16" thickness)</span> <strong>+$325 sample</strong></label></div>` +
              choice('siding', 'Lap', 'LP Smart Side Lap Siding', 'Elite series · supported by catalog rule<img class="siding-thumb" src="./smartside-lap-siding.png" alt="Horizontal courses on LP Smart Side Lap Siding" loading="lazy">', '+$1,050 sample')
      ];
    case 'Openings':
      return ['Light, access and finishing touches.', openingsMarkup()];
    case 'Electrical':
      return [
        'Power for what comes next.',
        choice('electrical', 'None', 'No electrical package', 'Keep the building unpowered.', 'Included') +
          electricalChoices
            .map(([id, text, art, price]) =>
              choice('electrical', id, id + ' electrical', `<span class="electrical-description">${text}</span><img class="electrical-art" src="./${art}-tile.svg" alt="" width="184" height="46">`, price)
            )
            .join('') +
          electricalExtrasMarkup() +
          '<p class="notice">Prices observed in IdeaRoom on a 12 × 16 Basic Utility. Have a licensed electrician inspect or connect the building. <a href="https://www.buybennett.com/packages" target="_blank" rel="noopener">Bennett electrical package chart</a></p>'
      ];
    default: {
      if (c.catalogOptions && c.style === 'Silver Bullet')
        return ['Make it theirs.', '<p class="notice">Galvanized steel roof and standard floor included.</p>'];
      const greenhouse = c.style === 'Greenhouse';
      const roofArt = (name) => `<img class="roof-art" src="./${name}.svg" alt="" width="104" height="62">`;
      return [
        'Make it theirs.',
        '<h3>Roof</h3>' +
          choice('roof', 'Metal', greenhouse ? 'Clear greenhouse roof' : 'Metal roof', 'Continue without a paid roof upgrade.' + (greenhouse ? '' : roofArt('metal')), 'Included') +
          (greenhouse
            ? ''
            : choice('roof', 'Shingles', 'Architectural shingles', 'IdeaRoom Basic Utility pricing reference' + roofArt('shingles'), shinglePrice(c) === null ? 'Price to confirm' : '+' + money(shinglePrice(c)))) +
          '<h3>Floor</h3>' +
          (activePackage(c)?.floor
            ? '<p class="checkrow static"><strong>12-inch-on-center floor joists</strong> · Included in Garage Package</p>'
            : usesWoodOptions(c)
              ? `<label class="checkrow boxed"><input id="floor-joists" type="checkbox" ${c.floor ? 'checked' : ''} onchange="change('floor',this.checked)"> <span>12-inch-on-center floor joists</span> <strong>+$375 sample</strong></label>`
              : '') +
          '<p class="source">The reference Utility already has 2×6 joists at 16 inches on center. Upgrade applicability and load ratings need catalog confirmation.</p>'
      ];
    }
  }
}

/* Move to a configurator step and return to the top of the page. Called through window so an
   inline handler cannot pick up the button's own scrollTo. */
function goStep(step) {
  S.step = step;
  S.completed = Math.max(S.completed, step);
  render();
  window.scrollTo(0, 0);
}

function configure() {
  if (S.step !== 1) S.sizeWidth = null;
  const stage = `<div class="cfg-stage"><div class="stage">${modelMarkup(S.c)}<div class="stage-cap"><strong>${label(S.c)}</strong><span>${icon('rotate', 14)} Drag to rotate</span></div></div></div>`;
  let options;
  let stepsNav = '';
  if (S.path === 'lot') {
    const u = lots[S.lot];
    options = `<span class="pillrow"><span class="pill">Specific unit · fixed configuration</span><span class="pill ${u.condition === 'used' ? 'amber' : 'ghost'}">${u.condition === 'used' ? 'Pre-owned' : 'New'}</span></span><h1>${esc(u.name)}</h1><p class="serial">${u.id} · ${label(S.c)}</p>${unitPhoto(u, S.lot, 1080)}<section class="panel"><h2>On this building</h2><ul class="included">${[u.colors.siding + ' siding', u.colors.trim + ' trim', u.colors.roof + ' roof', ...u.features]
      .map((item) => `<li>${icon('check', 16)}${esc(item)}</li>`)
      .join('')}</ul><p class="notice">Copied from the buybennett.com listing on ${LOT_LISTING_DATE}. The photo shows the actual building, and the 3D model is a reference for its style and colors. Confirm it is still on the lot before quoting.</p></section>`;
  } else {
    const [title, body] = stepBody();
    const last = S.step === steps.length - 1;
    stepsNav = `<nav class="steps" aria-label="Configuration progress">${steps
      .map(
        (s, i) =>
          `<button class="${S.step === i ? 'active' : i < S.completed || i < S.step ? 'done' : ''}" aria-current="${S.step === i ? 'step' : 'false'}" ${i > S.completed ? 'disabled' : ''} onclick="goStep(${i})"><span class="step-number">${i + 1}</span><span class="step-label">${s}</span></button>`
      )
      .join('')}</nav>`;
    options = `<div class="eyebrow">Step ${S.step + 1} of ${steps.length} · ${series()} series</div><h1>${title}</h1>${body}
      <div class="actions">${S.step ? button(icon('back', 18) + ' Back', 'goStep(S.step-1)', 'secondary') : ''}${button(
        (last ? (S.path === 'site' ? 'Request a site review ' : 'Review and create quote ') : 'Continue ') + icon('arrow'),
        last ? 'quoteForm()' : 'goStep(S.step+1)',
        last ? 'primary big' : 'primary big continue-step'
      )}</div>`;
  }
  return `<button class="link backlink" onclick="go('start')">${icon('back', 16)} Sale options</button><div class="workspace"><section class="cfg">${stepsNav}${stage}<div class="cfg-options">${options}</div></section>${summary()}</div>`;
}

/* ---------- Deal bar (price, monthly payment, actions) ---------- */

function budgetStatus(n = amount(), long = false) {
  if (!S.budget) return '';
  const monthly = S.budgetMode === 'monthly';
  const diff = S.budget - (monthly ? payment(n, S.term) : n);
  const ok = diff >= 0;
  const text = `${money(Math.abs(diff))} ${ok ? 'under' : 'over'}`;
  return long
    ? `<p class="budgetline ${ok ? 'good' : 'bad'}"><strong>${text}</strong> their ${monthly ? `${S.term}-month payment` : 'building'} budget of ${money(S.budget)}${monthly ? '/mo' : ''}</p>`
    : `<button type="button" class="budget ${ok ? 'good' : 'bad'}" onclick="S.expanded=true;refreshSummary()" title="Edit budget">${icon(ok ? 'check' : 'alert', 14)} ${text} budget</button>`;
}

/* A custom build can be quoted or sold only after every configurator step has been confirmed.
   Lot buildings are fixed, and a quote under revision was already complete, so both are ready. */
function stepsLeft() {
  if (S.path === 'lot' || S.activeQuote || S.completed >= steps.length - 1) return [];
  return steps.slice(S.completed);
}

function whenBuildReady(action) {
  const left = stepsLeft();
  if (!left.length) return action();
  const next = S.completed;
  modal(
    'Finish the building first',
    `<p>A quote or sale needs every choice confirmed so the price and the building are right. ${left.length === 1 ? 'One step is' : left.length + ' steps are'} still to go:</p>
    <ol class="stepsleft">${steps
      .map((name, i) => `<li class="${i < next ? 'done' : ''}">${icon(i < next ? 'check' : 'lock', 16)}<span>${name}</span><small>${i < next ? 'Done' : i === next ? 'Up next' : 'Not started'}</small></li>`)
      .join('')}</ol>
    <div class="actions">${button('Go to ' + steps[next] + ' ' + icon('arrow', 18), `closeModal();goStep(${next})`)}${button('Close', 'closeModal()', 'secondary')}</div>`
  );
}

function refreshSummary() {
  const el = $('.quoteaside');
  if (el) el.outerHTML = summary();
}

function summary() {
  const n = amount();
  const site = S.path === 'site';
  const totalLabel = site ? 'Reference estimate' : 'Building total';
  const locked = stepsLeft().length > 0;
  const lockedClass = locked ? ' locked' : '';
  const review = catalogReviewItems(S.c);
  const items = S.path === 'lot' ? [{ name: lots[S.lot].name + ' · exact unit', amount: n }] : breakdown();
  const termButtons = (cls, detail) =>
    [24, 36, 48, 60]
      .map(
        (t) =>
          `<button type="button" class="${cls}${t === S.term ? ' active' : ''}" aria-pressed="${t === S.term}" onclick="S.term=${t};refreshSummary()">${detail ? `<small>${t} months</small><strong>${money(payment(n, t))}</strong><small>/mo + tax</small>` : t}</button>`
      )
      .join('');
  return `<aside class="quoteaside${S.expanded ? ' open' : ''}" aria-label="Price and next steps">
    <div class="deal-drawer" ${S.expanded ? '' : 'hidden'}><div class="deal-drawer-in">
      <section>
        <h3>Rent-to-own estimate</h3>
        <div class="terms">${termButtons('term', true)}</div>
        <p class="source">Divisors inferred from public payments. Estimates, not approved terms.</p>
        <h3>Their budget</h3>
        <div class="fields budgetfields"><label>Budget type<select id="budget-mode" onchange="S.budgetMode=this.value;S.budget=this.value==='monthly'?300:7000;refreshSummary()"><option value="monthly" ${S.budgetMode === 'monthly' ? 'selected' : ''}>Monthly limit</option><option value="total" ${S.budgetMode === 'total' ? 'selected' : ''}>Total budget</option></select></label><label>Limit ($)<input id="budget-limit" type="number" min="0" inputmode="numeric" value="${S.budget}" onchange="S.budget=Math.max(0,+this.value);refreshSummary()"></label></div>
        ${budgetStatus(n, true)}
      </section>
      <section>
        <h3>What’s in the price</h3>
        <ul class="pricelines">${items.map((i) => `<li><span>${esc(i.name)}</span><strong>${money(i.amount)}</strong></li>`).join('')}<li class="sum"><span>${totalLabel}</span><strong>${money(n)}</strong></li></ul>
        <p class="source">${S.path === 'lot' ? 'Unit price snapshot' : 'Reference base + sample options'} · before tax / final delivery. Preview only. No live order or payment.</p>
        ${reviewItemsMarkup(S.c)}
      </section>
    </div></div>
    <div class="deal-main">
      <button type="button" class="deal-toggle" aria-label="${S.expanded ? 'Hide' : 'Show'} price details" aria-expanded="${Boolean(S.expanded)}" onclick="S.expanded=!S.expanded;refreshSummary()">
        <span class="deal-name"><strong>${label(S.c)}</strong><small>${esc(S.c.color)} · ${esc(S.c.package || 'Standard Storage')} · ${S.c.electrical} electrical</small></span>
        <span class="deal-more"><span>${S.expanded ? 'Hide' : 'Price'} details</span> ${icon('chevron', 16)}</span>
      </button>
      <div class="deal-terms" role="group" aria-label="Rent-to-own term in months"><small>Months</small><div>${termButtons('', false)}</div></div>
      <div class="deal-monthly"><small>${S.term}-mo rent-to-own</small><strong>${money(payment(n, S.term))}<span>/mo</span></strong></div>
      <div class="deal-total"><small>${totalLabel}</small><strong>${money(n)}</strong></div>
      <div class="deal-flags">${budgetStatus(n)}${review.length ? `<button type="button" class="budget warn" onclick="S.expanded=true;refreshSummary()">${icon('alert', 14)} ${review.length} to confirm</button>` : ''}</div>
      <div class="summaryactions">${
        site
          ? button((locked ? icon('lock', 16) + ' ' : '') + 'Request a site review', 'whenBuildReady(startSiteReview)', 'primary' + lockedClass)
          : button((locked ? icon('lock', 16) + ' ' : '') + 'Finalize sale', 'whenBuildReady(finalizeForm)', 'ghostbtn' + lockedClass) +
            button((locked ? icon('lock', 16) + ' ' : '') + 'Create quote ' + (locked ? '' : icon('arrow', 18)), 'whenBuildReady(quoteForm)', 'primary' + lockedClass)
      }</div>
    </div>
  </aside>`;
}

/* ---------- Orders / stock ---------- */

function orders() {
  return (
    head('ORDER LOOKUP', 'Find the sale. See the next handoff.', 'Sale and fulfillment statuses stay separate.') +
    `<label class="searchbar">${icon('orders')}<input id="order-search" class="search" aria-label="Search orders" placeholder="Search customer, order or serial" oninput="filterOrders(this.value)"></label>
    <section class="panel" id="orderresults">${
      salesRows() ||
      `<div class="emptystate"><strong>No sales in this session yet.</strong><p>Quotes and finalized sales show up here with their review and fulfillment status.</p><button type="button" class="primary" onclick="S.saleLead=null;go('start')">Start a sale ${icon('arrow', 18)}</button></div>`
    }</section>
    <h2 class="sectionhead">In production at ShedCor</h2>
    <section class="panel">${sampleBuildRows()}</section>`
  );
}

function stockList() {
  return (
    head('MANAGER', 'Stock requests', 'Separate from customer sales and approvals.') +
    (S.stock
      .map(
        (r) =>
          `<section class="panel"><div class="panelhead"><h2>${r.id} · ${label(r.c)}</h2><span class="pill">${r.status}</span></div><p>Destination: ${r.location}<br>Evidence: ${r.evidence.join(', ') || 'None attached'}</p>${button('Return to pending sale', `openSale('${S.sales.find((s) => s.lot === r.lot)?.id || ''}')`, 'secondary')}</section>`
      )
      .join('') ||
      `<section class="panel"><div class="emptystate"><strong>No stock requests yet.</strong><p>When a lot unit sells, order its replacement from the sale record or the lot card so the lot stays ready.</p><button type="button" class="primary" onclick="go('lot')">Go to my lot ${icon('arrow', 18)}</button></div></section>`)
  );
}

/* ---------- Render + boot ---------- */

const NAV_GROUP = {
  home: 'home', receipts: 'home', lot: 'lot', orders: 'orders', sale: 'orders', quote: 'orders',
  performance: 'performance', matches: 'performance', stock: 'stock', restock: 'stock'
};

function render() {
  const screens = {
    home, receipts: receiptInbox, start, lot, configure,
    quote: () => quoteView(false), customer: () => quoteView(true),
    sale, orders, restock: stockForm, stock: stockList, performance: performanceScreen, notes
  };
  $('#app').innerHTML = (screens[S.page] || (() => ''))();
  document.body.dataset.page = S.page;
  document.querySelectorAll('[data-nav]').forEach((b) => {
    const on = NAV_GROUP[S.page] === b.dataset.nav;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

loadHash();
