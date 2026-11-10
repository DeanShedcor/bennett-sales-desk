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
      <div class="eyebrow">Statesboro · Sales desk</div>
      <h1>From the first hello <br>to their backyard.</h1>
      <p>The right building. A clear price. One next step.</p>
      <div class="home-actions">
        <button type="button" class="primary big" onclick="S.saleLead=null;go('start')">Start a sale ${icon('arrow')}</button>
        <button type="button" class="ghostbtn big" onclick="go('orders')">${icon('orders')} Look up an order</button>
      </div>
    </div>
    <img class="shed-hero" src="./shed-hero.png" alt="White Bennett building with a covered porch beneath a spreading oak" width="1600" height="901" fetchpriority="high">
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
    )}</div>`
  );
}

function lot() {
  return (
    head(
      'MY LOT · STATESBORO',
      'Find the one they came for.',
      'Source-reference listing and synthetic units. Availability below is simulated.'
    ) +
    `<label class="searchbar">${icon('orders')}<input id="lot-search" class="search" aria-label="Search lot" placeholder="Search size, style or serial" oninput="filterLot(this.value)"></label><div class="cards" id="lotcards">${lotCards('')}</div>`
  );
}

function lotCards(q) {
  return (
    lots
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => (u.id + u.name).toLowerCase().includes(q.toLowerCase()))
      .map(
        ({ u, i }) =>
          `<section class="card lotcard">${modelMarkup(u.c, true)}<div class="lotcard-head"><span class="pill ${u.status === 'Available' ? 'good' : 'amber'}">${u.status} · simulated</span><strong class="price">${money(u.price)}</strong></div><h3>${u.name}</h3><small class="serial">${u.id}</small><p class="source">${u.source}</p>${button(
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

function modelMarkup(c, small = false, interactive = !small) {
  const variants = bennettModels[c.style];
  if (!variants) return '';
  const index = c.siding === 'Lap' ? 2 : c.shield || c.siding === 'Silvertech groove' ? 1 : 0;
  const packageModel = {
    'Side Porch': '08-side-porch',
    'End Porch': '09-end-porch',
    'Deluxe Porch': '10-deluxe-porch',
    'Dormer Package': '12-dormer-package',
    'Garage Package': '11-garage-package'
  }[c.package];
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
  )} 3D reference model" loading="eager" interaction-prompt="none" shadow-intensity="0.9" shadow-softness="0.9" ${
    interactive
      ? 'camera-controls auto-rotate auto-rotate-delay="1200" rotation-per-second="14deg" touch-action="pan-y"'
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

const electricalChoices = [
  ['Minimal', '1 LED light, 1 switch, and 1 external drop-cord adapter.', 'minimal', '+$50'],
  ['Basic', '1 LED light, 1 switch, 1 receptacle, and 1 external drop-cord adapter.', 'basic', '+$100'],
  ['Expanded', '1 LED light, 1 switch, 3 receptacles, and 1 external drop-cord adapter.', 'expanded', '+$200'],
  ['Utility', '1 LED light, 1 switch, 3 receptacles, and a six-space breaker box.', 'utility', '+$555']
];

function stepBody() {
  const c = S.c;
  switch (S.step) {
    case 0:
      return [
        'Start with how they’ll use it.',
        `<div class="choicegrid">${Object.keys(descriptions)
          .map(
            (s) =>
              `<button class="choice stylecard${c.style === s ? ' selected' : ''}" aria-pressed="${c.style === s}" onclick="change('style','${s}')">${modelMarkup({ ...c, style: s }, true)}<strong>${s === 'Lofted' ? 'Lofted Barn' : s}</strong><small>${descriptions[s]}</small></button>`
          )
          .join('')}</div>`
      ];
    case 1:
      return [
        'Give their plans some room.',
        sizeGroups() +
          wallHeightMarkup(c) +
          '<p class="draft-note">Sizes follow IdeaRoom. Pricing uses the existing preview estimates. Sizes without a sample adjustment show the base estimate.</p>'
      ];
    case 2:
      return ['Choose a building package.', packageChoices()];
    case 3:
      return ['Choose their colors.', `<div class="colors">${colorsMarkup()}</div>`];
    case 4:
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
    case 5:
      return ['Light, access and finishing touches.', openingsMarkup()];
    case 6:
      return [
        'Power for what comes next.',
        choice('electrical', 'None', 'No electrical package', 'Keep the building unpowered.', 'Included') +
          electricalChoices
            .map(([id, text, art, price]) =>
              choice('electrical', id, id + ' electrical', `<span class="electrical-description">${text}</span><img class="electrical-art" src="./${art}-tile.svg" alt="" width="184" height="46">`, price)
            )
            .join('') +
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

function configure() {
  if (S.step !== 1) S.sizeWidth = null;
  const stage = `<div class="cfg-stage"><div class="stage">${modelMarkup(S.c)}<div class="stage-cap"><strong>${label(S.c)}</strong><span>${icon('rotate', 14)} Drag to rotate</span></div></div></div>`;
  let options;
  let stepsNav = '';
  if (S.path === 'lot') {
    options = `<span class="pill">Specific unit · fixed configuration</span><h1>${label(S.c)}</h1><p class="serial">${lots[S.lot].id}</p><section class="panel"><h2>Already included</h2><ul class="included">${included(S.c)
      .map((item) => `<li>${icon('check', 16)}${esc(item)}</li>`)
      .join('')}</ul><p class="notice">The public source unit includes front/back 4 ft lofts, a 2x3 white window and Basic electrical. Geometry is illustrative. This preview never reserves the real listing.</p></section>`;
  } else {
    const [title, body] = stepBody();
    const last = S.step === steps.length - 1;
    stepsNav = `<nav class="steps" aria-label="Configuration progress">${steps
      .map(
        (s, i) =>
          `<button class="${S.step === i ? 'active' : i < S.completed || i < S.step ? 'done' : ''}" aria-current="${S.step === i ? 'step' : 'false'}" ${i > S.completed ? 'disabled' : ''} onclick="S.step=${i};render()"><span class="step-number">${i + 1}</span><span class="step-label">${s}</span></button>`
      )
      .join('')}</nav>`;
    options = `<div class="eyebrow">Step ${S.step + 1} of ${steps.length} · ${series()} series</div><h1>${title}</h1>${body}
      <div class="actions">${S.step ? button(icon('back', 18) + ' Back', 'S.step--;render()', 'secondary') : ''}${button(
        (last ? (S.path === 'site' ? 'Request a site review ' : 'Review and create quote ') : 'Continue ') + icon('arrow'),
        last ? 'quoteForm()' : 'S.step++;S.completed=Math.max(S.completed,S.step);render();scrollTo(0,0)',
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

function refreshSummary() {
  const el = $('.quoteaside');
  if (el) el.outerHTML = summary();
}

function summary() {
  const n = amount();
  const site = S.path === 'site';
  const totalLabel = site ? 'Reference estimate' : 'Building total';
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
          ? button('Request a site review', 'startSiteReview()')
          : button('Finalize sale', 'finalizeForm()', 'ghostbtn') + button('Create quote ' + icon('arrow', 18), 'quoteForm()')
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
