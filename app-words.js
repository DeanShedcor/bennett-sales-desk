/* app-words.js: one set of words, one way to write things, one search, and pages that say what is
   real. Whole-app batch 3 of the owner's review (Nov 2026).

   1. The pages that explain the preview are short, in plain words and up to date on every side.
   2. One name for each thing across the five sides (the settled list is AW_NAMES below).
   3. One way to write a date ("Nov 14", "Sat, Nov 14"), a building size ("10x16") and a monthly
      payment ("$300 a month"): fmtDate(), fmtSize(), fmtMonthly() are the shared helpers, and the
      same rules tidy text that older layers wrote another way.
   4. One search in the top bar on every side: orders, customers, buildings at the plant and on the
      lot, loads and people. It follows the person's lots and sides.
   5. QC page titles read like the other sides' titles; main buttons are one size (app-words.css).
   6. The wall strips on build sheet 2 draw the placed options; the QC change-order page follows
      the person's lots.
   Words are put right as the page is drawn, the same way plant-polish.js does it, so older checks
   that read the old words can switch this off with PP.raw.
   Turbo Assist has its own global search (GlobalSearch in the app shell); this is the preview's
   picture of it. Loaded last. */

/* ---------- 3. One way to write things ---------- */
const AW_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const AW_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/* "Nov 14"; the year only when it is not this year; the weekday when asked for. */
function fmtDate(value, opt = {}) {
  const d = value instanceof Date ? value : new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value);
  if (isNaN(d)) return String(value ?? '');
  const out = `${opt.weekday ? AW_DAY[d.getDay()] + ', ' : ''}${AW_MON[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? out : `${out}, ${d.getFullYear()}`;
}
/* "10x16" for a building. */
const fmtSize = (value) => String(value?.size ?? value ?? '').replace(/(\d+)\s*[x×]\s*(\d+)/, '$1x$2');
/* "$300 a month". */
const fmtMonthly = (n) => `${money(n)} a month`;

/* Door, window and roll-up sizes keep their "×" so they do not read as a building. */
const AW_OPENING = new Set(['2x2', '2x3', '3x3', '3x4', '4x4', '6x7', '8x7', '9x7', '10x7', '6x6', '4x6', '2x6', '2x4']);
function awFormats(text) {
  let out = text;
  if (/\d/.test(out)) {
    const year = new Date().getFullYear();
    out = out
      /* 11/06/2026 and 2026-10-28 (with or without a clock time behind it) */
      .replace(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g, (m, mo, d, y) => (+mo >= 1 && +mo <= 12 && +d <= 31 ? fmtDate(new Date(+y, +mo - 1, +d)) : m))
      .replace(/\b(20\d{2})-(\d{2})-(\d{2})(?:T[\d:.]+Z?)?/g, (m, y, mo, d) => (+mo >= 1 && +mo <= 12 ? fmtDate(new Date(+y, +mo - 1, +d)) : m))
      /* "Nov 10, 2026" in the year we are in */
      .replace(new RegExp(`\\b((?:${AW_MON.join('|')})[a-z]* \\d{1,2}), ${year}\\b`, 'g'), '$1')
      /* building sizes */
      .replace(/(?<![×x]\s?)\b(\d{1,2})\s?[×x]\s?(\d{1,2})\b(?!\s?(?:ft\b|in\b|-|′|'|"|[×x]))/g, (m, a, b) => (AW_OPENING.has(`${a}x${b}`) ? m : `${a}x${b}`))
      /* monthly payments */
      .replace(/(\$[\d,]+(?:\.\d{2})?)\s?\/\s?(?:mo|month)\b\.?/g, '$1 a month')
      .replace(/(\$[\d,]+(?:\.\d{2})?) per month\b/g, '$1 a month');
  }
  return out;
}

/* ---------- 2. One word list ---------- */
const AW_NAMES = [
  ['Performance', 'not Stats'], ['Locations', 'not Places'], ['Change orders', 'not Changes'], ['All buildings', 'not Units'],
  ['Production', 'the side; “the plant” is the place'], ['the office', 'not admin or administrator'], ['Send to the office', 'not Submit for admin review'],
  ['Order AA-20411', 'not Invoice AA-20411 as a title'], ['rent-to-own', 'RTO only where space is tight'], ['QC check', 'the check'], ['Final sign-off', 'the last step'],
];
PP_WORDS.push(
  [/Submit for admin review/g, 'Send to the office'], [/Submitted for admin review/g, 'Sent to the office'], [/Submit sale for review/g, 'Send the sale to the office'],
  [/before admin review/g, 'before it goes to the office'], [/at admin review/g, 'when the office checks it'], [/for admin review/g, 'for the office to check'],
  [/Admin review/g, 'Office check'], [/admin review/g, 'office check'], [/Submitted to administrator/g, 'Sent to the office'],
  [/approved by an admin\b/g, 'approved by the office'], [/\ban admin\b/g, 'the office'], [/\bthe admin\b/g, 'the office'], [/\badministrator\b/g, 'the office'],
  [/\bInvoice ((?:AA|BEN|GRV|FLO|SB|MC|SAMPLE)[-A-Z0-9]*-\d+)/g, 'Order $1'],
  /* left over from earlier batches */
  [/Published range: ([^.]*?) ft\./g, 'Comes in sizes $1.'],
  [/Prices observed in IdeaRoom on a 12 × 16 Basic Utility\. /g, ''],
  [/Have a licensed electrician inspect or connect the building\./g, 'A licensed electrician should check the building and hook it up.'],
  [/Order intake placed on hold/g, 'The office put this order on hold'], [/Order intake hold released/g, 'The office took this order off hold'],
  [/Order intake approved/g, 'The office approved this order'], [/Order intake cancelled/g, 'The office cancelled this order'], [/Order intake/g, 'New order'],
  [/Ready for QC today/g, 'Ready for its QC check today'], [/Ready for QC (\d+ days?)/g, 'Waiting $1 for its QC check'],
  [/price divided by ([\d.]+)/g, 'the price split into $1 parts'],
  [/Synced from Turbo Assist/g, 'From Turbo Assist'], [/\bPOS\b/g, 'sales desk'],
  [/Published ranges are a guide; confirm the exact size and package price before quoting\./g, 'These sizes are a guide. Ask the office about the exact size and price before you quote.'],
  [/Admin, owner or trainer/g, 'Office lead, owner or trainer'], [/Admin or owner only/g, 'Office lead or owner only']
);
Object.assign(PP_EXACT, { Admin: 'Office', Stats: 'Performance', Places: 'Locations', Changes: 'Change orders', Units: 'All buildings', '/mo': ' a month', '/mo + tax': ' a month + tax', '/month': ' a month' });

/* Titles on the QC side read like the other sides' titles. */
const AW_QC_TITLES = { Buildings: 'Buildings to check.', Rework: 'What needs fixing.', 'Final sign-off': 'Ready for final sign-off.', Report: 'How the QC checks are going.', 'Change orders': 'Changes to orders.', 'What is real and what is not': 'What is real and what is not.' };
const AW_TIGHT = '.pill, .chip, .to-chip, th, .seg, .kpi, .tabbar, nav, .statusgrid, .ops-chip, button, option, .eyebrow';
const AW_SKIP = 'script, style, textarea, code, .ops-notes, .sf-hook, .sf-only, [data-pp-raw], .aw-raw';
function awWord(text, p) {
  let out = awFormats(text);
  if (/\bRTO\b/.test(out) && !p.closest(AW_TIGHT)) out = out.replace(/^(\s*)RTO\b/, '$1Rent-to-own').replace(/([.!?]\s+)RTO\b/g, '$1Rent-to-own').replace(/\bRTO\b/g, 'rent-to-own');
  if (p.tagName === 'H1' && document.body.dataset.side === 'qc' && Object.hasOwn(AW_QC_TITLES, out.trim())) out = out.replace(out.trim(), AW_QC_TITLES[out.trim()]);
  /* A tablet has no mouse to drag with either. */
  if (matchMedia('(hover: none)').matches) out = out.replace('Drag a card to its next step, or open it to move it with a note.', 'Tap a building to open it and move it.');
  return out;
}
function awFixNode(n) {
  const p = n.parentElement;
  if (PP.raw || !p || p.closest(AW_SKIP) || p.closest('#aw-results')) return;
  const next = awWord(n.nodeValue, p);
  if (next !== n.nodeValue) n.nodeValue = next;
}
function awFixTree(root) {
  if (root.nodeType === 3) return awFixNode(root);
  if (PP.raw || root.nodeType !== 1 || root.closest?.(AW_SKIP)) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (walk.nextNode()) list.push(walk.currentNode);
  list.forEach(awFixNode);
}
new MutationObserver((list) => {
  for (const m of list) {
    if (m.type === 'characterData') awFixNode(m.target);
    else m.addedNodes.forEach(awFixTree);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

/* ---------- 1. The pages that explain the preview ---------- */
const AW_REAL = {
  all: [
    'Every screen has its own web address, so the Back button works and a link to an order, a building or a load can be sent.',
    'The app keeps a copy on the phone or computer, so it opens with no signal once it has been opened before.',
    'Firefly, the guide, shows a new person around and answers how-to questions. It can be switched off.',
    'One search in the top bar finds orders, customers, buildings, loads and people.',
  ],
  sales: [
    'Prices come from Turbo Assist’s price list. The fuel surcharge is $0.30 for each square foot of floor.',
    'A new sale starts blank. A sale left half way can be picked up again from Home.',
    'With electrical, the salesperson says where it goes: the default spots, or on the floor plan.',
    'A workbench, shelving, a loft or a partition wall must be placed on the floor plan, so the builder knows where it goes.',
    'Once the invoice is signed, the delivery answers are locked. Changing them takes the signature off, and the customer signs again.',
    'The invoice lists every price, one delivery line, the total and what is still owed.',
  ],
  office: [
    'Users and permissions: each person has a job, sides they can look at or change, and lots they can see.',
    'Model pricing: prices go to a draft first, Publish shows what will change, and a published set can be undone.',
    'Windows, doors and electrical on the Sales desk follow the same price list.',
    'Settings ask before they save, show a before-and-after example, and keep a history of who changed what.',
    'A cash order needs sales tax, or a tax-exempt tick, before it can be approved.',
  ],
  prod: [
    'Every move to the next step can be undone for 10 seconds, and history says who moved it.',
    'A building that fails its QC check shows the crew what to fix, with the note and the photo.',
    'The floor plan shows where the customer wants the electrical, the workbench and the shelves.',
    'Pay steps and QC rules can only be changed by someone with Settings access.',
  ],
  qc: [
    'Yes, No and N/A are big enough for a gloved hand. Answers are kept if you leave and come back.',
    'A failed item offers only the problems that fit, with one-tap notes.',
    'Final sign-off waits until every failure is closed and every change order is seen.',
    'One search finds a building by plant serial, order number or customer.',
  ],
  logi: [
    'Road miles and drive times between the plant and every lot are stored in the app. No map service is called.',
    'Drive time is planned from the time the customer was promised.',
    'A load with a warning can still be scheduled, but only with a typed reason.',
    'The run sheet lists every stop in order with times, lot hours and phone numbers.',
    'The last miles to a customer’s home are still an estimate.',
  ],
};
const AW_PRETEND = [
  'Nothing is saved to a server. Orders, payments, prices and people start over when the page is refreshed.',
  'Nobody signs in. The gear lets anyone view the app as any person, so permissions here only show how they will work.',
  'No text, email or payment is really sent. Customers and orders are made up.',
  'A real ID or Social Security number must never be typed. Only the last 4 digits and the photo’s file name are kept.',
];
const AW_OPEN = [
  ['7 ft walls on a Garage Package building', 'The price list says $0.65 for each square foot of floor ($104 on a 10x16). The owner’s example showed $258 on a 10x16. Which is right?'],
  ['60-month rent-to-own', 'Turbo Assist has terms for 24, 36 and 48 months. The 60-month numbers here follow the same pattern and need to be confirmed.'],
  ['Delivery charge past the free miles', 'This preview charges $100 up to 100 miles. Turbo Assist only says a fee may apply past 50 miles.'],
  ['Putting a building on hold at the plant', 'It works here with a reason. Turbo Assist has no matching step yet.'],
];
const AW_BACK = { sales: ['home', 'Home'], office: ['office', 'To do'], prod: ['prod', 'Board'], qc: ['qc', 'Buildings'], logi: ['logi', 'Dispatch'] };
function awExplain(side, older) {
  const [page, name] = AW_BACK[side], li = (x) => `<li>${x}</li>`;
  return `<button class="link backlink" onclick="go('${page}')">${icon('back', 18)} ${name}</button>
  ${head(typeof TA_SIDE_NAME === 'object' ? TA_SIDE_NAME[side] : 'Preview', 'What is real and what is not.', 'This is a working picture of the job. It shows the steps and the rules. It does not keep anything.')}
  <div class="grid2 aw-explain">
    <section class="panel"><h2>What works here today</h2><ul>${[...AW_REAL[side], ...AW_REAL.all].map(li).join('')}</ul></section>
    <section class="panel"><h2>What is still pretend</h2><ul>${AW_PRETEND.map(li).join('')}</ul></section>
  </div>
  <section class="panel aw-open"><h2>Open questions for Turbo Assist’s builder</h2>
    <div class="aw-qs">${AW_OPEN.map(([t, x]) => `<div><strong>${t}</strong><p>${x}</p></div>`).join('')}</div></section>
  <details class="ops-notes aw-older"><summary>The longer notes for the builder</summary><div class="aw-raw">${older}</div></details>`;
}
{
  const strip = (html) => String(html).replace(/^[\s\S]*?<\/header>/, ''); /* the older page without its own back link and title */
  const salesNotes = notes;
  notes = function () { return awExplain('sales', strip(salesNotes())); };
  for (const [key, side] of [['of-notes', 'office'], ['pr-notes', 'prod'], ['lg-notes', 'logi']]) {
    const base = OPS_SCREENS[key];
    if (base) OPS_SCREENS[key] = function () { return awExplain(side, strip(base())); };
  }
  if (typeof QC_SCREENS === 'object' && QC_SCREENS['qc-notes']) {
    const base = QC_SCREENS['qc-notes'];
    QC_SCREENS['qc-notes'] = function () { return awExplain('qc', strip(base())); };
  }
}

/* ---------- 4. One search ---------- */
const awCan = (key) => typeof adAccess !== 'function' || adAccess(adMe(), key) !== 'none';
const awHas = (q, ...parts) => parts.some((p) => p && String(p).toLowerCase().includes(q));
/* Run with the lists already cut down to this person's lots (admin.js: adScoped). */
let awFind = function (raw) {
  const q = raw.trim().toLowerCase(), groups = [];
  if (q.length < 2) return groups;
  const side = document.body.dataset.side, lotOk = (id) => !id || typeof adLotOk !== 'function' || adLotOk(id);
  const add = (title, rows) => rows.length && groups.push({ title, rows: rows.slice(0, 6), more: Math.max(0, rows.length - 6) });
  /* Orders and customers */
  if (awCan('sales') || awCan('office')) {
    const useOffice = typeof ofOpen === 'function' && awCan('office') && (side === 'office' || !awCan('sales'));
    add('Orders and customers', S.sales.filter((s) => awHas(q, s.id, s.customer, s.customerInfo?.phone, s.customerInfo?.email)).map((s) => ({
      main: `${s.customer || 'No name yet'} · order ${s.id}`, sub: `${s.c ? label(s.c) : ''}${s.status ? ' · ' + s.status : ''}`, where: useOffice ? 'Office' : 'Sales desk',
      go: useOffice ? `ofOpen('${s.id}')` : `openSale('${s.id}')`,
    })));
  }
  /* Buildings at the plant, by plant serial, order number or customer */
  if ((awCan('prod') || awCan('qc')) && typeof prUnits === 'function') {
    const serial = (u) => (typeof tpShown === 'function' ? tpShown(u.plantSerial || u.serial || '') : u.plantSerial || u.serial || '');
    add('Buildings at the plant', prUnits().filter((u) => lotOk(u.lotId) && awHas(q, serial(u), u.id, u.ref, u.customer, u.name)).map((u) => ({
      main: `${serial(u) || u.id} · ${u.name || u.size || ''}`, sub: `${u.customer ? u.customer + ' · ' : ''}order ${u.id}`, where: 'Production',
      go: awCan('prod') ? `PR.id='${u.id}';PR.back='prod';go('pr-unit')` : `go('qc')`,
    })));
  }
  /* Buildings on the lot */
  if (awCan('sales') && typeof lots !== 'undefined')
    add('Buildings on the lot', lots.map((l, i) => [l, i]).filter(([l]) => awHas(q, l.id, l.name, l.c && label(l.c), l.c?.color)).map(([l, i]) => ({
      main: l.name || (l.c ? label(l.c) : l.id), sub: `${l.status || 'On the lot'} · ${l.id}`, where: 'Sales desk', go: `S.unit=${i};go('unit')`,
    })));
  /* Loads */
  if (awCan('logi') && typeof LG === 'object')
    add('Loads and deliveries', LG.loads.filter((l) => awHas(q, l.id, lgLoadName(l), l.driver, ...l.stops.map((s) => (typeof lgStopName === 'function' ? lgStopName(s) : s.name)), ...lgLoadUnits(l).flatMap((u) => [u.id, u.customer]))).map((l) => ({
      main: lgLoadName(l), sub: `${l.date ? fmtDate(l.date, { weekday: true }) : 'No day yet'}${l.driver ? ' · ' + l.driver : ''}`, where: 'Logistics', go: `lgOpen('${l.id}')`,
    })));
  /* People */
  if (awCan('users') && typeof AD === 'object')
    add('People', AD.users.filter((u) => u.status !== 'removed' && awHas(q, u.name, u.email, u.title)).map((u) => ({
      main: u.name, sub: [u.title, u.email].filter(Boolean).join(' · '), where: 'Users', go: `AD.open='${u.id}';go('of-user')`,
    })));
  return groups;
};
if (typeof adScoped === 'function') awFind = adScoped(awFind);
function awSearchOpen() {
  modal('Search', `<label class="searchbar aw-searchbar">${icon('orders', 18)}<input class="search" id="aw-q" type="search" autocomplete="off" placeholder="Order number, customer, serial, load or person" aria-label="Search the whole app" oninput="awSearchDraw(this.value)"></label>
    <div id="aw-results" aria-live="polite"><p class="muted">Type a name, an order number, a plant serial or a load.</p></div>`);
  document.querySelector('.modal')?.classList.add('aw-search');
  setTimeout(() => document.getElementById('aw-q')?.focus(), 30);
}
function awSearchDraw(raw) {
  const box = document.getElementById('aw-results');
  if (!box) return;
  const q = raw.trim();
  if (q.length < 2) return (box.innerHTML = '<p class="muted">Type a name, an order number, a plant serial or a load.</p>');
  const groups = awFind(q);
  const ask = typeof taOpenAnswers === 'function' ? `<button type="button" class="link aw-ask" onclick="closeModal();taOpenAnswers(${JSON.stringify(q).replace(/"/g, '&quot;')})">Look in Answers for “${esc(q)}”</button>` : '';
  box.innerHTML = groups.length
    ? groups.map((g) => `<section class="aw-group"><h3>${g.title} <small>${g.rows.length + g.more}</small></h3>${g.rows.map((r) => `<button type="button" class="aw-row" onclick="closeModal();${r.go}"><span class="grow"><strong>${esc(fmtSize(r.main))}</strong><small>${esc(r.sub)}</small></span><span class="aw-where">${r.where}</span></button>`).join('')}${g.more ? `<p class="muted">${g.more} more. Type more to narrow it down.</p>` : ''}</section>`).join('') + ask
    : `<div class="emptystate"><strong>Nothing found</strong><p>No order, customer, building, load or person matches “${esc(q)}”.</p></div>${ask}`;
}
document.querySelector('.topbar-right')?.insertAdjacentHTML('afterbegin', `<button type="button" class="ta-topbtn" id="aw-search" onclick="awSearchOpen()" aria-label="Search the whole app">${icon('orders', 18)}<span>Search</span></button>`);

/* ---------- 6. Leftovers ---------- */
/* The wall strips on sheet 2 draw the placed options too. */
if (typeof bsStrip === 'function') {
  const baseStrip = bsStrip;
  bsStrip = function (lay, w, scale) {
    const mine = lay.items.filter((x) => x.kind === 'fix' && x.placed && x.fw === w.i);
    if (!mine.length) return baseStrip(lay, w, scale);
    const drawn = mine.map((it) => {
      const across = it.fix === 'loft' || it.fix === 'uloft';
      const at = across ? 0 : it.fix === 'wall' ? Math.max(0, it.at - 0.17) : it.at, len = across ? w.len : it.fix === 'wall' ? 0.34 : it.len || it.w || 1;
      const where = across ? `overhead, ${bsFeet(it.depth)} deep` : it.fix === 'wall' ? `starts at ${bsFeet(it.at)}, runs ${bsFeet(it.depth)} into the building` : `${bsFeet(at)} to ${bsFeet(at + len)}`;
      return { ...it, kind: 'fixstrip', wi: w.i, at, w: len, high: across, name: `${it.name} (${where})` };
    });
    return baseStrip({ ...lay, items: [...lay.items, ...drawn] }, w, scale);
  };
}
/* The QC side's change-order page follows the person's lots. */
if (typeof changeOrders === 'function' && typeof QC_SCREENS === 'object') {
  QC_SCREENS['qc-changes'] = function () {
    if (typeof adLimited !== 'function' || !adLimited() || typeof ofMine !== 'function') return changeOrders();
    const all = S.changes;
    S.changes = all.filter((c) => ofMine(c));
    try { return changeOrders(); } finally { S.changes = all; }
  };
}

/* ---------- 7. Door options live with the doors ----------
   The owner asked (Nov 2026) for the sectional garage door, the taller wood door and the custom wood
   door to move from the add-ons list on the last step to the door part of the Openings step.
   Where: inside the Doors box, under the list of doors and above the door colors, as "More door
   options". Prices, the price lines and the rules (no sectional door on a barn; wood doors only on
   wood buildings) are unchanged: they are still TA_ADDONS and c.extras, priced by taAddonRows(). */
const AW_DOORS = [
  ['Sectional Garage Door', 'Sectional garage door', 'A garage door that rolls up in panels.'],
  ['84" Wood Door (upcharge from std door)', 'Taller wood door, 84 in.', 'Adds to the standard door price.'],
  ['Custom Wood Doors', 'Custom wood door', 'A wood door built to the size the customer wants.'],
];
if (typeof TA_ADDONS !== 'undefined') {
  for (const [name, label] of AW_DOORS) { const a = taAddon(name); if (a) a[1] = label; }
  const isDoor = (name) => AW_DOORS.some((d) => d[0] === name);
  /* Off the last step's list... */
  const baseAddons = taAddonsMarkup;
  taAddonsMarkup = function (c) {
    const held = TA_ADDONS.filter((a) => isDoor(a[0]) || a[0] === 'Vinyl Wrap').map((a) => [a, a[3]]); /* vinyl wrap lives on the Exterior step (part 8) */
    for (const [a] of held) a[3] = () => false;
    try { return baseAddons(c); } finally { for (const [a, test] of held) a[3] = test; }
  };
  /* ...and into the Doors box on the Openings step. */
  const hasRollUp = (c) => c.package === 'Garage Package' || [c.door, ...(c.extraDoors || [])].some((d) => /roll/i.test(typeof doorName === 'function' ? doorName(d) : String(d)));
  function awDoorOptions(c) {
    const list = AW_DOORS.filter(([name]) => taAddon(name)?.[3](c));
    if (!list.length) return '';
    return `<div class="aw-doors" id="aw-doors"><h4>More door options</h4>${list.map(([name, label, about]) => {
      const q = Number(c.extras?.[name]) || 0, price = taListPrice(name), arg = esc(JSON.stringify(name));
      const note = name === 'Sectional Garage Door' && hasRollUp(c) ? '<small class="aw-doornote">This building already has a roll-up door. Add this only if the customer wants both.</small>' : '';
      return `<div class="doorrow aw-doorrow${q ? ' on' : ''}"><span class="grow"><strong>${esc(label)}</strong><small>${about} ${price == null ? 'Ask the office for the price.' : money(price) + ' each'}</small>${note}</span>${q ? `<strong class="ta-sum">+${money(price * q)}</strong>` : ''}<span class="stepper" role="group" aria-label="${esc(label)}: how many"><span class="stepper-label">How many</span><button type="button" ${q <= 0 ? 'disabled' : ''} aria-label="One fewer ${esc(label)}" onclick="taAddonSet(${arg},${q - 1})">${icon('minus', 16)}</button><output>${q}</output><button type="button" ${q >= 10 ? 'disabled' : ''} aria-label="One more ${esc(label)}" onclick="taAddonSet(${arg},${q + 1})">${icon('plus', 16)}</button></span></div>`;
    }).join('')}</div>`;
  }
  const baseOpenings = openingsMarkup;
  openingsMarkup = function () {
    const html = baseOpenings(), block = S.path === 'lot' ? '' : awDoorOptions(S.c);
    if (!block) return html;
    const at = html.indexOf('<div class="door-color-choices">');
    return at < 0 ? html + `<section class="panel openings">${block}</section>` : html.slice(0, at) + block + html.slice(at);
  };
}

/* ---------- 8. Vinyl wrap lives with the siding ----------
   The owner asked (Nov 2026) for Exterior to come before Colors (the `steps` list in core.js) and
   for vinyl wrap to leave the last step's list and sit under the lap siding choice on the Exterior
   step, as a tick box with its fee. Neither the price list nor the knowledge base ties vinyl wrap
   to one kind of siding, so it can be ticked with either siding on a wood building (the same rule
   it had before). The price and the price line are unchanged (c.extras, taAddonRows). */
if (typeof TA_ADDONS !== 'undefined') {
  const baseStep = stepBody;
  stepBody = function () {
    const out = baseStep(), c = S.c, a = taAddon('Vinyl Wrap');
    if (!Array.isArray(out) || steps[S.step] !== 'Exterior' || S.path === 'lot' || !a || !a[3](c) || !out[1].includes('smartside-lap-siding.png')) return out;
    const on = !!c.extras?.['Vinyl Wrap'], price = taListPrice('Vinyl Wrap');
    const box = `<label class="techshield-addon aw-vinyl${on ? ' on' : ''}"><input id="aw-vinyl" type="checkbox" ${on ? 'checked' : ''} onchange="taAddonSet('Vinyl Wrap',this.checked)"> <span>Add vinyl wrap</span> <strong>${price == null ? 'Ask the office for the price' : '+' + money(price)}</strong></label>`;
    /* Straight after the lap siding choice, which is the last choice card on this step. */
    const at = out[1].indexOf('</button>', out[1].indexOf('smartside-lap-siding.png'));
    return [out[0], at < 0 ? out[1] + box : out[1].slice(0, at + 9) + box + out[1].slice(at + 9)];
  };
}
