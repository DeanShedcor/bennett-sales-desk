/* core.js: state, catalog data, pricing, quote and sale flow.
   Screens and layout live in views.js. */

const $ = (s) => document.querySelector(s),
  money = (n) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" }),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    ),
  clone = (x) => JSON.parse(JSON.stringify(x));
const defaults = {
  style: "Utility",
  size: "10x16",
  siding: "Basic groove",
  shield: false,
  color: "Blue",
  roof: "Metal",
  windows: 0,
  windowType: "Standard",
  shutters: false,
  door: "Double",
  electrical: "Basic",
  floor: false,
};
let S = {
  page: "home",
  c: clone(defaults),
  step: 0,
  completed: 0,
  path: "custom",
  lot: null,
  term: 60,
  budget: 300,
  budgetMode: "monthly",
  customer: "Alex Morgan",
  quotes: [],
  sales: [],
  stock: [],
  activeQuote: null,
  activeSale: null,
  tiles: { leads: true, builds: true, leadCount: 3, buildCount: 3 },
  shown: [],
  expanded: false,
  filter: { days: 90, location: "All", rep: "All", style: "All" },
  stockDraft: null,
};
const sourceUnit = {
  id: "BS-LB-NP-1016-080226-059157",
  name: "10x16 Basic Lofted",
  price: 6018,
  location: "Statesboro",
  source: "Public listing snapshot",
  url: "https://shedcor.shedsuite.com/shop-inventory/535726",
  c: { ...defaults, style: "Lofted", color: "Clay", windows: 1, electrical: "Basic", size: "10x16" },
  status: "Available",
};
/* Buildings on the lot come from inventory.js. */
const lots = LOT_LISTING.trim().split("\n").map(unitFromListing);
const leadData = [
  { name: "Alex Morgan", source: "Facebook", need: "10x16 workshop · $300/month", initial: "AM" },
  {
    name: "Jamie Ellis",
    source: "Marketplace",
    need: "Interested in the lofted unit on your lot",
    initial: "JE",
  },
  { name: "Taylor Reed", source: "Google Ads", need: "Backyard greenhouse · compare sizes", initial: "TR" },
];
const phaseNames = [
  "Order received",
  "Order approved",
  "Flooring",
  "Walls",
  "Ceiling / finish",
  "Paint",
  "Roofing",
  "Final QA",
  "Build complete",
];
const history = [
  {
    id: "H101",
    date: "2026-10-28",
    location: "Statesboro",
    region: "Georgia",
    rep: "Sam Lee",
    style: "Lofted",
    size: "10x16",
    siding: "Basic groove",
    color: "Clay",
    price: 6018,
    options: "1 Standard window; Basic electrical; Double door; Metal roof",
    days: 23,
    status: "Processed",
    received: "2026-10-05",
  },
  {
    id: "H102",
    date: "2026-10-12",
    location: "Statesboro",
    region: "Georgia",
    rep: "Casey Park",
    style: "Lofted",
    size: "10x16",
    siding: "Basic groove",
    color: "Clay",
    price: 6018,
    options: "1 Standard window; Basic electrical; Double door; Metal roof",
    days: 36,
    status: "Processed",
    received: "2026-09-06",
  },
  {
    id: "H103",
    date: "2026-09-20",
    location: "Statesboro",
    region: "Georgia",
    rep: "Sam Lee",
    style: "Utility",
    size: "10x16",
    siding: "Basic groove",
    color: "Blue",
    price: 5464,
    options: "0 Standard window; None electrical; Double door; Metal roof",
    days: 61,
    status: "Processed",
    received: "2026-07-21",
  },
  {
    id: "H104",
    date: "2026-10-21",
    location: "Vidalia",
    region: "Georgia",
    rep: "Avery Gray",
    style: "Lofted",
    size: "10x16",
    siding: "Basic groove",
    color: "Clay",
    price: 6018,
    options: "1 Standard window; Basic electrical; Double door; Metal roof",
    days: 18,
    status: "Processed",
    received: "2026-10-03",
  },
  {
    id: "H105",
    date: "2026-10-09",
    location: "Vidalia",
    region: "Georgia",
    rep: "Avery Gray",
    style: "Utility",
    size: "10x20",
    siding: "Lap",
    color: "Sage",
    price: 7600,
    options: "2 Insulated window; Workshop electrical; Double door; Shingles roof",
    days: 47,
    status: "Processed",
    received: "2026-08-23",
  },
  {
    id: "H106",
    date: "2026-10-15",
    location: "Statesboro",
    region: "Georgia",
    rep: "Casey Park",
    style: "Greenhouse",
    size: "10x16",
    siding: "Basic groove",
    color: "Sage",
    price: 8200,
    options: "Greenhouse package",
    days: 54,
    status: "Pending",
    received: "2026-09-10",
  },
  {
    id: "H107",
    date: "2026-11-03",
    location: "Vidalia",
    region: "Georgia",
    rep: "Avery Gray",
    style: "Silver Bullet",
    size: "10x16",
    siding: "Metal",
    color: "Slate",
    price: 4900,
    options: "Metal package",
    days: 75,
    status: "On hand",
    received: "2026-08-20",
  },
];
const descriptions = {
  Utility: "A straightforward gable roof and versatile storage space.",
  Lofted: "A gambrel roof creates overhead room. Front and rear lofts are included in this demo package.",
  Studio: "A clean, single-slope roof for a workspace or backyard retreat.",
  Greenhouse: "A clear polycarbonate roof and generous windows for natural light.",
  "Low-Wall Barn": "A gambrel roof with shorter sidewalls and a lower profile.",
  "Silver Bullet": "Ribbed metal siding and a silver finish for a simple, durable appearance.",
};
const steps = ["Style", "Size", "Package", "Openings", "Colors", "Exterior", "Electrical", "Finish"];
function series(c = S.c) {
  return ["Greenhouse", "Low-Wall Barn", "Silver Bullet"].includes(c.style)
    ? c.style
    : c.siding === "Lap"
      ? "Elite"
      : c.shield || c.siding === "Silvertech groove"
        ? "Classic"
        : "Basic";
}
function label(c) {
  return `${c.size} ${series(c)} ${["Greenhouse", "Low-Wall Barn", "Silver Bullet"].includes(c.style) ? "" : c.style}`.trim();
}
/* Package prices from the Bennett configurator (12 × 16 Basic Utility). Minimal is the old name for Lights Only. */
const electricalPrices = { "Lights Only": 175, Minimal: 175, Basic: 205, Expanded: 305, Utility: 555, Workshop: 650 };
/* Extra electrical items beyond the package: $50 for each extra light, switch or receptacle.
   A null price would record the item on the quote but leave it out of the total. */
const electricalExtraPrices = { extraLights: 50, extraSwitches: 50, extraReceptacles: 50 };
const electricalExtraNames = { extraLights: "extra light", extraSwitches: "extra switch", extraReceptacles: "extra receptacle" };
function electricalExtras(c) {
  if (!c.electrical || c.electrical === "None") return [];
  return Object.keys(electricalExtraPrices)
    .map((key) => ({ key, qty: Number(c[key]) || 0, price: electricalExtraPrices[key] }))
    .filter((e) => e.qty > 0)
    .map((e) => ({ ...e, label: `${e.qty} ${electricalExtraNames[e.key]}${e.qty > 1 ? "s" : ""}` }));
}
const referencePackagePrices = {
  "End Porch": 1510,
  "Middle Porch": 1680,
  "Side Porch": 1510,
  "Deluxe Porch": 2330,
  "Dormer Package": 1485,
  "Garage Package": 1370,
};
/* Dormer options and prices observed in the Bennett configurator on a 12 × 16 Basic Utility. */
const dormerOptions = [
  { length: 8, gable: false, label: "8 ft dormer", price: 1485 },
  { length: 12, gable: false, label: "12 ft dormer", price: 1685 },
  { length: 12, gable: true, label: "12 ft gable dormer", price: 2105 },
];
function dormerOption(c) {
  if (c.dormerGable) return dormerOptions[2];
  return dormerOptions.find((o) => !o.gable && o.length === (c.dormerLength || 8)) || dormerOptions[0];
}
function packageReference(c, name = c.package) {
  if (name === "Dormer Package") return dormerOption(c).price;
  return referencePackagePrices[name] ?? null;
}
function packageAmount(c, name = c.package) {
  if (c.style !== "Utility" || series(c) !== "Basic" || c.roof !== "Metal") return null;
  return packageReference(c, name);
}
function packageBreakdown(c) {
  const amount = packageAmount(c);
  return amount === null
    ? []
    : [{ name: c.package, amount, source: "IdeaRoom 12 × 16 Basic Utility with metal roof reference" }];
}
function shinglePrice(c) {
  if (c.style !== "Utility" || series(c) !== "Basic" || (c.package && c.package !== "Standard Storage"))
    return null;
  const [width, length] = c.size.split("x").map(Number);
  return width >= 16 || length > 40 ? 525 : 375;
}
function roofBreakdown(c) {
  const amount = shinglePrice(c);
  return c.roof === "Shingles" && amount !== null
    ? [{ name: "Architectural shingles", amount, source: "IdeaRoom Basic Utility size comparisons" }]
    : [];
}
function breakdown(c = S.c) {
  let base = 5416,
    sz = { "8x12": -1250, "10x12": -700, "10x16": 0, "10x20": 1100, "12x16": 758 }[c.size] ?? 0,
    st =
      {
        Utility: 0,
        Lofted: 600,
        Studio: 900,
        Greenhouse: 2300,
        "Low-Wall Barn": -450,
        "Silver Bullet": -500,
      }[c.style] || 0;
  return [
    {
      name: `${c.size} ${c.style} base package`,
      amount: base + sz + st,
      source:
        c.style === "Utility" && ["10x16", "12x16"].includes(c.size)
          ? "Public builder reference"
          : "Sample base adjustment",
    },
    { name: "Fuel surcharge", amount: 48, source: "Public 10x16 builder reference; confirm applicability" },
    ...packageBreakdown(c),
    ...bulletColorBreakdown(c),
    ...(c.siding === "Silvertech groove"
      ? [
          {
            name: "Classic / Silvertech groove",
            amount: 362,
            source: "Verified 10x16 Utility difference; other models sample",
          },
        ]
      : []),
    ...(c.siding === "Lap"
      ? [
          {
            name: "LP Smart Side Lap Siding / Elite package",
            amount: 1050,
            source: "Sample price; series rule verified in app",
          },
        ]
      : []),
    ...(c.shield
      ? [{ name: "TechShield radiant barrier", amount: 325, source: "Sample price & eligibility" }]
      : []),
    ...windowItems(c).map((w) => ({
      name: windowLabel(w),
      amount: windowPrice(w),
      source: "IdeaRoom 12 × 16 Basic Utility reference",
    })),
    ...doorBreakdown(c),
    ...(Object.hasOwn(electricalPrices, c.electrical)
      ? [
          {
            name: `${c.electrical} electrical package`,
            amount: electricalPrices[c.electrical],
            source:
              c.electrical === "Workshop"
                ? "Legacy sample price"
                : "IdeaRoom 12 × 16 Basic Utility reference",
          },
        ]
      : []),
    ...electricalExtras(c)
      .filter((e) => e.price !== null)
      .map((e) => ({ name: e.label, amount: e.price * e.qty, source: "Per-item price" })),
    ...roofBreakdown(c),
    ...(c.floor && !activePackage(c)?.floor
      ? [{ name: "12-inch-on-center floor joists", amount: 375, source: "App catalog upgrade; sample price" }]
      : []),
  ];
}
function amount() {
  return S.path === "lot" ? lots[S.lot].price : breakdown().reduce((a, b) => a + b.amount, 0);
}
const divisors = { 24: 16.8, 36: 21.6, 48: 24.6, 60: 27.2 };
function payment(n, term) {
  return Math.round((n / divisors[term]) * 100) / 100;
}

function closeModal() {
  $(".modal-back")?.remove();
}
function modal(title, body) {
  closeModal();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="modal-back"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="row"><h2>${title}</h2><button class="chipbtn" onclick="closeModal()">Close ×</button></div>${body}</section></div>`,
  );
}

function button(t, fn, cls = "primary") {
  return `<button type="button" class="${cls}" onclick="${fn}">${t}</button>`;
}
function begin(which = "custom") {
  if (S.page !== "start") S.saleLead = null;
  S.path = which;
  S.c = clone(defaults);
  if (which !== "lot") {
    S.c.catalogOptions = true;
    S.c.buildOnSite = which === "site";
    S.c.sampleWindow = true;
    S.c.windows = 1;
    S.c.windowItems = [{ option: "2x3 Standard", type: "Standard", shutters: false }];
  }
  S.customer = (S.page === "start" ? leadData[S.saleLead]?.name : null) || "Alex Morgan";
  S.step = 0;
  S.completed = 0;
  S.lot = null;
  S.activeSale = null;
  S.activeQuote = null;
  go(which === "lot" ? "lot" : "configure");
}
function journey(n) {
  if (n === 1) {
    begin();
    S.budget = 300;
    S.term = 60;
    render();
    toast("Journey 1: configure, issue a signed quote, then open the customer view.");
  } else {
    begin("lot");
    toast("Journey 2: choose a building from the lot, then finalize its sale.");
  }
}

function leadEmail(l) {
  return l.name.toLowerCase().replace(" ", ".") + "@example.com";
}
function lead(i) {
  const l = leadData[i];
  modal(
    l.name,
    `<span class="pill blue">${l.source} · sample lead</span><p style="margin-top:20px">${l.need}</p><p class="muted">Fictional contact: ${leadEmail(l)}</p>${button("Start a sale", `closeModal();S.saleLead=${i};go('start')`)} `,
  );
}

const receiptLeads = [
  { id: "L1", name: "Alex Morgan", email: "alex@example.com", phone: "9125550101" },
  { id: "L2", name: "Taylor Reed", email: "taylor@example.com", phone: "9125550102" },
  { id: "L3", name: "Casey Brooks", email: "shared@example.com", phone: "9125550103" },
  { id: "L4", name: "Jamie Brooks", email: "shared@example.com", phone: "9125550103" },
];
const ideaRoomReceipts = [
  { id: "IR-101", build: "10 × 16 Basic Utility", email: " ALEX@example.com ", phone: "+1 (912) 555-0101" },
  { id: "IR-102", build: "12 × 16 Classic Lofted Barn", email: "taylor@example.com", phone: "" },
  {
    id: "IR-103",
    build: "10 × 20 Utility with Side Porch",
    email: "shared@example.com",
    phone: "912-555-0103",
  },
  { id: "IR-104", build: "8 × 12 Greenhouse", email: "rep@example.com", phone: "9125550199" },
  { id: "IR-105", build: "10 × 12 Silver Bullet", email: "visitor@example.com", phone: "9125550105" },
];
const reviewedReceipts = new Map();
function receiptPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
function receiptMatch(receipt) {
  const email = receipt.email.trim().toLowerCase(),
    phone = receiptPhone(receipt.phone);
  if (email === "rep@example.com" || phone === "9125550199") return { reason: "Staff contact details" };
  if (!email || !phone) return { reason: "Missing email or phone" };
  const matches = receiptLeads.filter((lead) => lead.email === email && lead.phone === phone);
  return matches.length === 1
    ? { lead: matches[0] }
    : { reason: matches.length ? "Multiple matching leads" : "No matching lead" };
}
function receiptReviewCount() {
  return ideaRoomReceipts.filter((r) => !receiptMatch(r).lead && !reviewedReceipts.has(r.id)).length;
}

function attachReceipt(event, id) {
  event.preventDefault();
  const receipt = ideaRoomReceipts.find((r) => r.id === id),
    lead = receiptLeads.find((l) => l.id === new FormData(event.currentTarget).get("lead"));
  if (receipt && lead && !receiptMatch(receipt).lead && !reviewedReceipts.has(id)) {
    reviewedReceipts.set(id, lead);
    render();
  }
}

function filterLot(q) {
  $("#lotcards").innerHTML = lotCards(q);
}
function pickLot(i) {
  const u = lots[i];
  if (u.status !== "Available") {
    const sale = S.sales.find((s) => s.lot === i);
    if (sale) openSale(sale.id);
    else toast("This sample unit is on hold. Choose another.");
    return;
  }
  S.lot = i;
  S.path = "lot";
  S.c = clone(u.c);
  S.activeSale = null;
  S.activeQuote = null;
  go("configure");
}
function choice(key, value, name, desc, price = "") {
  return `<button class="choice ${(key === "package" ? S.c.package || "Standard Storage" : S.c[key]) === value ? "selected" : ""}" aria-pressed="${S.c[key] === value}" onclick='change(${JSON.stringify(key)},${JSON.stringify(value)})'><span class="radio"></span><span class="grow"><strong>${name}</strong><small>${desc}</small></span><strong>${price}</strong></button>`;
}
const sizeLengths = {
  standard: {
    8: [8, 10, 12, 16],
    10: [10, 12, 16, 20, 24],
    12: [12, 14, 16, 20, 24, 28, 32, 36, 40],
    14: [12, ...evenLengths(16, 52), 56, 60],
    16: [...evenLengths(20, 52), 56, 60],
  },
  Studio: { 8: [8, 10, 12, 16], 10: [10, 12, 16, 20, 24], 12: [12, 14, 16, 20, 24] },
  "Silver Bullet": { 10: [12, 16, 20, 24], 12: [12, 14, 16, 20, 24, 28] },
  "Low-Wall Barn": { 8: [8, 10, 12, 16], 10: [12, 16, 20], 12: [16, 20] },
  Greenhouse: { 8: [12, 16], 10: [12, 16, 20] },
};
function evenLengths(first, last) {
  return Array.from({ length: (last - first) / 2 + 1 }, (_, i) => first + i * 2);
}
function availableSizes(style) {
  return Object.entries(sizeLengths[style] || sizeLengths.standard).flatMap(([width, lengths]) =>
    lengths.map((length) => width + "x" + length),
  );
}
function change(key, value, resolve = false) {
  if (key === "doorColor" && allDoorsWhiteOnly(S.c)) return;
  let next = { ...S.c, [key]: value };
  if (key === "style" && value === "Silver Bullet" && S.c.style !== value) next.color = "Galvalume";
  if (
    key === "style" &&
    S.c.style === "Silver Bullet" &&
    value !== S.c.style &&
    !Object.hasOwn(paintColors, next.color)
  )
    next.color = "Blue";
  if (
    key === "color" &&
    next.style === "Silver Bullet" &&
    value !== "Galvalume" &&
    !Object.hasOwn(bulletStandard, value) &&
    !Object.hasOwn(bulletPremium, value)
  )
    return;
  if (key === "style" && !packagesFor(value).some(([name]) => name === next.package))
    next.package = "Standard Storage";
  if (key === "shield" && next.siding === "Silvertech groove") next.siding = "Basic groove";
  if (key === "style" && !availableSizes(value).includes(next.size)) next.size = "10x16";
  let conflicts = [];
  if (key === "style" && ["Greenhouse", "Silver Bullet", "Low-Wall Barn"].includes(value)) {
    if (next.shield) conflicts.push("TechShield");
    if (value === "Greenhouse" && next.roof === "Shingles") conflicts.push("shingles");
    if (value === "Silver Bullet" && next.siding !== "Metal")
      conflicts.push("wood siding and incompatible door, window, and floor add-ons");
    if (value === "Greenhouse" && next.shutters) conflicts.push("shutters");
  }
  if (key === "windows" && value === 0 && next.shutters) conflicts.push("shutters");
  if (conflicts.length && !resolve) {
    modal(
      "Keep what works. Resolve the rest.",
      `<p>This sample compatibility rule affects <strong>${conflicts.join(", ")}</strong>. Your color, size and other compatible choices stay selected.</p><p class="notice">Demo rule only. Jordan must confirm the production compatibility matrix.</p>${button("Apply change & remove affected options", `closeModal();change('${key}',${JSON.stringify(value).replace(/"/g, "&quot;")},true)`)} ${button("Keep current choices", "closeModal()", "secondary")}`,
    );
    return;
  }
  if (resolve) {
    if (conflicts.includes("TechShield")) next.shield = false;
    if (conflicts.includes("shingles")) next.roof = "Metal";
    if (conflicts.includes("shutters")) next.shutters = false;
  }
  if (key === "style" && value === "Silver Bullet") next.siding = "Metal";
  if (key === "style" && value !== "Silver Bullet" && next.siding === "Metal") next.siding = "Basic groove";
  if (key === "style" && value === "Greenhouse") {
    next.siding = "Basic groove";
    next.windows = 4;
  }
  syncPackageSelection(S.c, next, key);
  S.c = next;
  if (
    S.page === "configure" &&
    S.path !== "lot" &&
    ["Colors", "Openings"].includes(steps[S.step]) &&
    ["color", "roofColor", "trimColor", "doorColor", "doorTrimColor"].includes(key)
  ) {
    document
      .querySelectorAll(".finish-swatch")
      .forEach((swatch) =>
        swatch.setAttribute(
          "aria-pressed",
          String(S.c[swatch.dataset.finishKey] === swatch.dataset.finishName),
        ),
      );
    document
      .querySelectorAll(".workspace > section model-viewer")
      .forEach((viewer) => updateModelColors(viewer, S.c));
    syncDoorThumbnails();
    const accent = document.querySelector(".accent-sample");
    if (accent) accent.outerHTML = accentSample(S.c);
    document.querySelector(".quoteaside").outerHTML = summary();
    return;
  }
  render();
  if (
    (key === "style" && steps[S.step] === "Style") ||
    (key === "size" && steps[S.step] === "Size") ||
    (key === "electrical" && steps[S.step] === "Electrical")
  ) {
    const button = document.querySelector(".workspace section .actions > button.primary");
    if (button) {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      button.scrollIntoView({ block: "center", behavior: reduced ? "instant" : "smooth" });
      if (!reduced)
        button.animate(
          [
            { transform: "rotate(0)" },
            { transform: "rotate(-4deg)" },
            { transform: "rotate(4deg)" },
            { transform: "rotate(0)" },
          ],
          { duration: 430, delay: 300 },
        );
    }
  }
}

const ideaRoomDoors = [
  ["Single", "Shed Door"],
  ["Double", "Double Shed Door"],
  ["Shed Door w/Transom"],
  ["Double Shed Door w/ Transom"],
  ["Fiberglass Door"],
  ['36" 9 Lite Door'],
  ['36" 15 Lite Door'],
  ['36" Full Lite Door', null, "Allow 2 additional weeks"],
  ["Double 9 Lite Door"],
  ["Double 15 Lite Door"],
  ["Double Solid Fiberglass Door"],
  ["Double Full Lite Door", null, "Allow 2 additional weeks"],
];
function windowItems(c) {
  return c.windowItems?.length === c.windows
    ? c.windowItems.map((w) => ({ ...w, shutters: c.shutters && w.shutters }))
    : Array.from({ length: c.windows }, () => ({ type: c.windowType, shutters: c.shutters }));
}
function updateWindows(index, key, value) {
  S.c.sampleWindow = false;
  const items = windowItems(S.c);
  if (index === -1) {
    if (items.length >= 10) return;
    items.push({ type: "Standard", shutters: false });
  } else {
    const matches = items.filter((w) => sameWindow(w, items[index]));
    if (key === "remove" || key === "quantity") {
      const count =
        key === "remove"
          ? 0
          : Math.max(1, Math.min(10 - items.length + matches.length, Math.floor(Number(value) || 1)));
      const next = items.filter((w) => !matches.includes(w));
      next.splice(index, 0, ...Array.from({ length: count }, () => ({ ...items[index] })));
      items.splice(0, items.length, ...next);
    } else
      for (const w of matches) {
        w[key] = value;
        if (key === "option" && value === "Octagon")
          Object.assign(w, { group: 1, shutters: false, flower: false, transom: false });
      }
  }
  Object.assign(S.c, {
    windowItems: items,
    windows: items.length,
    windowType: items[0]?.type || "Standard",
    shutters: items.some((w) => w.shutters),
  });
  render();
}

const windowCatalog = {
  "2x3 Standard": ["2 × 3 ft Standard", 105, "2x3-window"],
  "3x3 Standard": ["3 × 3 ft Standard", 135, "3x3-window"],
  "2x3 Insulated": ["2 × 3 ft Insulated", 260, "2x3-insulated-window"],
  "3x3 Insulated": ["3 × 3 ft Insulated", 260, "3x3-insulated-window"],
  Octagon: ["Octagon Gable Window", 125, "octagon-gable-window"],
};
function windowSpec(w) {
  return (
    windowCatalog[w.option] ||
    windowCatalog[(w.size || "2x3") + " " + w.type] ||
    windowCatalog["2x3 Standard"]
  );
}
function windowGroup(w) {
  return w.option === "Octagon" ? 1 : Number(w.group) || 1;
}
function windowPrice(w) {
  const count = windowGroup(w);
  return (
    windowSpec(w)[1] * count +
    (w.option === "Octagon"
      ? 0
      : (w.shutters ? 60 : 0) + (w.flower ? 80 * count : 0) + (w.transom ? 80 * count : 0))
  );
}
function windowLabel(w) {
  return (
    windowSpec(w)[0] +
    (windowGroup(w) > 1 ? " × " + windowGroup(w) : "") +
    (w.option === "Octagon"
      ? ""
      : (w.shutters ? " · 3 Board Shutters" : "") +
        (w.flower ? " · Flower Box" : "") +
        (w.transom ? " · Transom Above Window" : ""))
  );
}
function windowThumb(name) {
  return (
    '<img class="window-thumb" src="./' + name + '.svg" alt="" width="42" height="42">'
  );
}
function sameWindow(a, b) {
  return (
    windowSpec(a) === windowSpec(b) &&
    windowGroup(a) === windowGroup(b) &&
    ["shutters", "flower", "transom"].every((key) => Boolean(a[key]) === Boolean(b[key]))
  );
}

function windowQuantity(w, i) {
  const count = windowItems(S.c).filter((other) => sameWindow(w, other)).length;
  return openingQuantity(
    "Quantity",
    count,
    10 - S.c.windows + count,
    "updateWindows(" + i + ",&quot;quantity&quot;,+this.value)",
  );
}
function setDoorQuantity(index, count) {
  const doors = S.c.extraDoors || [],
    value = doors[index];
  if (!value) return;
  const first = doors.indexOf(value),
    next = doors.filter((d) => d !== value);
  next.splice(first, 0, ...Array(Math.max(0, Math.min(10, Math.floor(Number(count) || 0)))).fill(value));
  S.c.extraDoors = next;
  render();
}
function doorQuantityControl() {
  return (
    '<label>Quantity <select id="door-add-quantity">' +
    Array.from({ length: 10 }, (_, i) => "<option>" + (i + 1) + "</option>").join("") +
    '</select></label><p class="source">Choose a quantity, then select a door. Prices shown are per door.</p>'
  );
}

const doorOptions = ideaRoomDoors.concat([
  ['36" Half Lite Door', '36" Half Lite Door · availability to confirm'],
  ...["6x7", "8x7", "9x7"].map((s) => [s + " Rollup Door", s + " Roll-up Door"]),
]);
const doorPrices = {
  Single: 150,
  Double: 300,
  "Shed Door w/Transom": 225,
  "Double Shed Door w/ Transom": 450,
  "Fiberglass Door": 325,
  '36" 9 Lite Door': 420,
  '36" 15 Lite Door': 630,
  '36" Full Lite Door': 730,
  "Double 9 Lite Door": 1150,
  "Double 15 Lite Door": 1250,
  "Double Solid Fiberglass Door": 600,
  "Double Full Lite Door": 1350,
  "6x7 Rollup Door": 730,
  "8x7 Rollup Door": 850,
  "9x7 Rollup Door": 940,
};
function doorAmount(value, adding) {
  return Object.hasOwn(doorPrices, value) ? doorPrices[value] - (adding ? 0 : doorPrices.Double) : null;
}
function doorPriceLabel(value, adding) {
  const amount = doorAmount(value, adding);
  return amount === null
    ? "Price to confirm"
    : amount === 0
      ? "Included"
      : (amount < 0 ? "−" : "+") + money(Math.abs(amount));
}
function doorBreakdown(c) {
  const rows = [];
  const main = packageOpenings(c).length ? null : doorAmount(c.door, false);
  if (main !== null && main !== 0)
    rows.push({
      name: doorName(c.door) + " · main door substitution",
      amount: main,
      source: "Estimated difference from IdeaRoom add-on prices",
    });
  if (!packageOpenings(c).length && c.door === "Extra side door")
    rows.push({ name: "Additional side door", amount: 325, source: "Legacy sample price" });
  for (const door of c.extraDoors || []) {
    const amount = doorAmount(door, true);
    if (amount !== null)
      rows.push({ name: doorName(door), amount, source: "IdeaRoom 12 × 16 Basic Utility reference" });
  }
  return rows;
}
function doorName(value) {
  return doorOptions.find((d) => d[0] === value)?.[1] || value;
}
function doorThumbnail(value) {
  const name =
    value === "Single"
      ? "shed-door"
      : value === "Double"
        ? "double-shed-door"
        : value
            .toLowerCase()
            .replace('36"', "36-inch")
            .replace(/w\/\s*/, "with ")
            .replace("rollup", "roll-up")
            .replaceAll(" ", "-");
  return colorDoorThumbnail(name, value, S.c);
}
function doorTileThumbnail(value) {
  return doorOptions.some(([id]) => id === value)
    ? '<img data-door-thumbnail="' +
        esc(value) +
        '" src="' +
        doorThumbnail(value) +
        '" alt="' +
        esc(doorName(value)) +
        '" width="36" height="40">'
    : "";
}
function openDoorPicker(adding) {
  modal(
    adding ? "Add a door" : "Change main door",
    `${adding ? doorQuantityControl() : ""}<div class="choicegrid door-picker">${doorOptions.map(([value, label, note]) => `<button class="choice" onclick='selectDoor(${JSON.stringify(value)},${adding})'><img class="door-thumb" data-door-thumbnail="${esc(value)}" src="${doorThumbnail(value)}" alt="" width="48" height="48"><span><strong>${esc(label || value)}</strong><small>${esc([note, whiteOnlyDoor(value) ? "White only" : null].filter(Boolean).join(" · "))}</small><small>${doorPriceLabel(value, adding)}</small></span></button>`).join("")}${usesWoodOptions(S.c) ? '<button class="choice" onclick="addCustomDoor()"><span><strong>Custom door or opening</strong><small>Enter the size and type after selecting</small><small>Price to confirm</small></span></button>' : ""}</div>`,
  );
}
function selectDoor(value, adding) {
  if (adding) {
    const count = Math.max(
      1,
      Math.min(10, Math.floor(Number(document.getElementById("door-add-quantity")?.value) || 1)),
    );
    const doors = S.c.extraDoors || [];
    const remaining = Math.max(0, 10 - doors.filter((d) => d === value).length);
    S.c.extraDoors = [...doors, ...Array(Math.min(count, remaining)).fill(value)];
  } else S.c.door = value;
  if (allDoorsWhiteOnly(S.c)) S.c.doorColor = "White";
  closeModal();
  render();
}
function removeAddedDoor(i) {
  setDoorQuantity(i, 0);
}
const buildingPackages = [
  ["Standard Storage", "Normal shed with no building package."],
  [
    "Dormer Package",
    "Utility roof with an 8 ft dormer, a 12 ft dormer or a 12 ft gable dormer. Published range: 8 × 12 to 14 × 40 ft.",
  ],
  [
    "Garage Package",
    "Roll-up garage access on Utility or Lofted Barn. Published range: 10 × 12 to 14 × 40 ft.",
  ],
  ["End Porch", "Covered porch at the end. Utility or Lofted Barn. Published range: 8 × 8 to 14 × 40 ft."],
  [
    "Middle Porch",
    "Covered porch set into the middle of the long side. Utility or Lofted Barn. Published range: 8 × 12 to 14 × 40 ft.",
  ],
  [
    "Side Porch",
    "Covered corner porch at the left or right end of the long side. Utility or Lofted Barn. Published range: 8 × 12 to 14 × 40 ft.",
  ],
  [
    "Deluxe Porch",
    "Wraparound porch across the front and along the left or right side. Utility or Lofted Barn. Published range: 10 × 20 to 14 × 40 ft.",
  ],
];
function packagesFor(style) {
  return buildingPackages.filter(
    ([name]) =>
      name === "Standard Storage" || style === "Utility" || (style === "Lofted" && name !== "Dormer Package"),
  );
}
function packageChoices() {
  const eligible = packagesFor(S.c.style);
  return (
    buildingPackages
      .filter((row) => row[0] === "Dormer Package" || eligible.includes(row))
      .map(([name, description]) => {
        if (name === "Dormer Package" && S.c.style !== "Utility")
          return '<button class="choice" type="button" disabled><span class="grow"><strong>Dormer Package</strong><small>Available on Utility. Choose Utility in the Style step.</small></span></button>';
        if (!fitsPackage(name, S.c.size))
          return (
            '<button class="choice" type="button" disabled><span class="grow"><strong>' +
            name +
            "</strong><small>" +
            description +
            " Choose a size in the published range.</small></span></button>"
          );
        const preview = { ...S.c, package: name, catalogOptions: true };
        const details = packageFeatures(preview).map(esc).join(" · ");
        return choice(
          "package",
          name,
          name,
          description + (details ? "<br>Includes " + details : "") + porchPlan(name, S.c.porchSide || "Left"),
          name === "Standard Storage"
            ? "Included"
            : "+" +
                money(packageReference(S.c, name)) +
                (packageAmount(S.c, name) === null ? " reference · confirm" : ""),
        );
      })
      .join("") +
    packageVariantMarkup(S.c) +
    '<p class="draft-note">Bennett lists metal roofing or architectural shingles for these packages. Published ranges are a guide; confirm the exact size and package price before quoting. Package add-on prices for Basic Utility with a metal roof stay the same across shed sizes. Prices marked reference · confirm are shown for comparison and excluded from the estimate. <a href="https://www.buybennett.com/packages" target="_blank" rel="noopener">Bennett package guide</a></p>'
  );
}
const paintColors = {
  Blue: "#303d4d",
  Brown: "#5c493b",
  "Alpine Grey": "#c9cbcb",
  "Dovetail Grey": "#918c85",
  "Web Grey": "#606569",
  Bronze: "#514e45",
  Clay: "#aa9a88",
  Black: "#292929",
  "Origami White": "#faf9f5",
  "Navajo White": "#e9dfc8",
  Red: "#73332a",
  "Sage Green": "#75725e",
};
const stainColors = {
  Butternut: "#aa7449",
  "Chestnut Brown": "#714737",
  Mahogany: "#733c36",
  Redwood: "#9c4d36",
  "Barnwood Gray / Driftwood": "#81786b",
  Ebony: "#363332",
};
const metalRoofColors = {
  Galvalume: "#a7a9a7",
  Brown: "#62493c",
  "Copper Penny": "#ac704f",
  White: "#eeeae1",
  Black: "#27292c",
  Charcoal: "#4b5258",
  Red: "#8d3e36",
  "Burnished Slate": "#585149",
  "Light Stone": "#c7bda8",
  Green: "#46594a",
};
function finishSwatches(key, colors, texture) {
  return (
    '<div class="finish-swatches">' +
    Object.entries(colors)
      .map(
        ([name, hex]) =>
          '<button class="finish-swatch" data-finish-key="' +
          key +
          '" data-finish-name="' +
          esc(name) +
          '" aria-pressed="' +
          (S.c[key] === name) +
          "\" onclick='change(" +
          JSON.stringify(key) +
          "," +
          JSON.stringify(name) +
          ')\'><span aria-hidden="true" class="finish-sample ' +
          texture +
          '" style="--finish:' +
          hex +
          '"></span><span>' +
          esc(name) +
          "</span></button>",
      )
      .join("") +
    "</div>"
  );
}
const bulletStandard = {
  Black: "#111216",
  "Light Stone": "#beb59e",
  "Alamo White": "#f4f5f4",
  "Pewter Gray": "#7e7b75",
  Clay: "#a19888",
  "Gallery Blue": "#1d486b",
};
const bulletPremium = {
  Tan: "#cfb189",
  Charcoal: "#747477",
  "Burnished Slate": "#4d3c30",
  Red: "#b93b2c",
  Green: "#335037",
  "Crimson Red": "#af1f23",
  Gray: "#a8adaf",
  Burgundy: "#810320",
  "Forest Green": "#172c0b",
  Blue: "#2c415e",
  Brown: "#795018",
  Copper: "#b88137",
  "Bright White": "#fff",
};
function bulletColorAmount(size, premium) {
  const [width, length] = size.split("x").map(Number);
  return width * length * (premium ? 2.5 : 1.75);
}
function bulletColorBreakdown(c) {
  if (c.style !== "Silver Bullet" || !availableSizes("Silver Bullet").includes(c.size)) return [];
  const standard = Object.hasOwn(bulletStandard, c.color),
    premium = Object.hasOwn(bulletPremium, c.color);
  if (!standard && !premium) return [];
  return [
    {
      name: (premium ? "Premium" : "Standard") + " metal siding · " + c.color,
      amount: bulletColorAmount(c.size, premium),
      source: "IdeaRoom Silver Bullet size comparison",
    },
  ];
}
function doorFinishChoices() {
  const doors = [...(packageOpenings(S.c).length ? [] : [S.c.door]), ...(S.c.extraDoors || [])];
  if (!doors.length) return "";
  if (allDoorsWhiteOnly(S.c))
    return '<h4>Door color</h4><p class="draft-note">36-inch and garage doors are available in white only.</p>';
  const preview = [...new Set(doors)]
    .filter((d) => !whiteOnlyDoor(d))
    .map((d) => "<div>" + doorTileThumbnail(d) + "<span>" + esc(doorName(d)) + "</span></div>")
    .join("");
  return (
    '<details class="door-color-editor"><summary>Door color</summary><div class="door-color-edit-preview">' +
    preview +
    "</div>" +
    (doors.some(whiteOnlyDoor)
      ? '<p class="source">36-inch and garage doors stay white. These colors apply to the other doors.</p>'
      : "") +
    finishSwatches("doorColor", paintColors, "grooved") +
    "<details><summary>Urethane Colors</summary>" +
    finishSwatches("doorColor", stainColors, "woodgrain") +
    "</details></details>"
  );
}
function colorsMarkup() {
  if (S.c.style === "Silver Bullet")
    return (
      "<h3>Metal siding</h3><h4>Default</h4>" +
      finishSwatches("color", { Galvalume: "#a7a9a7" }, "ribbed") +
      "<h4>Standard colors · +" +
      money(bulletColorAmount(S.c.size, false)) +
      "</h4>" +
      finishSwatches("color", bulletStandard, "ribbed") +
      "<h4>Premium colors · +" +
      money(bulletColorAmount(S.c.size, true)) +
      "</h4>" +
      finishSwatches("color", bulletPremium, "ribbed") +
      "<h3>Metal roof color</h3>" +
      finishSwatches("roofColor", metalRoofColors, "ribbed") +
      '<p class="source">IdeaRoom metal siding palette. Swatches are approximate. Siding surcharges follow IdeaRoom for the selected building size.</p>'
    );
  const wood = !["Greenhouse", "Silver Bullet"].includes(S.c.style);
  const siding = wood
    ? "<h3>Wood siding</h3>" +
      finishSwatches("color", paintColors, "grooved") +
      "<details><summary>Urethane Colors</summary>" +
      finishSwatches("color", stainColors, "woodgrain") +
      "</details>"
    : "";
  const roof =
    S.c.style === "Greenhouse"
      ? "<p>Clear greenhouse roof.</p>"
      : "<h3>Metal roof color</h3>" + finishSwatches("roofColor", metalRoofColors, "ribbed");
  const trim = wood
    ? "<details><summary>Building trim and door trim</summary>" +
      [
        ["trimColor", "Building trim"],
        ["doorTrimColor", "Door trim"],
      ]
        .map(([key, label]) =>
          key === "doorColor"
            ? doorFinishChoices()
            : "<h4>" +
              label +
              "</h4>" +
              finishSwatches(key, paintColors, "grooved") +
              "<details><summary>Urethane Colors</summary>" +
              finishSwatches(key, stainColors, "woodgrain") +
              "</details>",
        )
        .join("") +
      "</details>"
    : "";
  return (
    siding +
    roof +
    trim +
    paintOptionsMarkup(S.c) +
    '<p class="source">Color names from <a href="https://idearoom-shedcor.buybennett.com/" target="_blank" rel="noopener">IdeaRoom</a> and Bennett’s finish guide. Samples are approximate. Selections update the 3D model and are recorded in the quote. Confirm color availability for the build.</p>'
  );
}

function included(c) {
  const doors = [...(packageOpenings(c).length ? [] : [c.door]), ...(c.extraDoors || [])];
  return [
    c.package || "Standard Storage",
    ...catalogFeatures(c),
    c.style === "Lofted"
      ? "Gambrel roof + front/rear lofts"
      : c.style === "Low-Wall Barn"
        ? "Gambrel roof + short sidewalls"
        : c.style === "Greenhouse"
          ? "Clear polycarbonate roof + screened windows"
          : c.style === "Silver Bullet"
            ? "Metal siding + metal roof"
            : c.style === "Studio"
              ? "Single-slope roof"
              : "Gable roof",
    `${c.color} siding · ${c.trimColor || "Origami White"} trim`,
    ...(c.roofColor && c.roof === "Metal" ? [c.roofColor + " metal roof"] : []),
    ...doors.filter(whiteOnlyDoor).map((d) => doorName(d) + " · White"),
    ...(c.doorColor && doors.some((d) => !whiteOnlyDoor(d)) ? [c.doorColor + " other doors"] : []),
    ...(c.doorTrimColor ? [c.doorTrimColor + " door trim"] : []),
    ...doors.map(doorName),
    ...windowItems(c).map(windowLabel),
    `${c.electrical} electrical`,
    ...electricalExtras(c).map((e) => e.label),
    c.shutters ? "Window shutters" : "No shutters",
    c.shield ? "TechShield selected" : "Standard roof package",
  ];
}
function quoteForm() {
  if (S.path === "site") {
    startSiteReview();
    return;
  }
  modal(
    "Issue a customer quote",
    `<p>Save this configuration and its reference estimate. Revisions create a new version.</p>${reviewItemsMarkup(S.c)}<div class="fields"><label>Fictional customer<input id="qcustomer" value="${esc(S.customer)}"></label><label>Valid for (days)<input id="qdays" type="number" min="1" max="90" value="14"></label><label>Manager signature<input id="qsign" placeholder="Type demo manager name" value="Morgan Bennett"></label><label>Payment preference<select id="qterm"><option value="cash">Cash purchase</option>${[24, 36, 48, 60].map((t) => `<option value="${t}" ${t === S.term ? "selected" : ""}>${t}-month RTO estimate</option>`).join("")}</select></label></div><p class="notice">Typed signature is a preview mark only, not an executed agreement.</p>${button("Sign & issue quote", "issueQuote()")}`,
  );
}
function issueQuote() {
  let name = $("#qcustomer").value.trim(),
    sign = $("#qsign").value.trim(),
    days = +$("#qdays").value;
  if (!name || !sign || days < 1 || days > 90) {
    toast("Enter a customer, signature and 1–90 days.");
    return;
  }
  let parent = S.activeQuote,
    now = new Date(),
    q = {
      id: "Q" + String(S.quotes.length + 1).padStart(3, "0"),
      leadIndex: S.saleLead,
      version: parent ? (S.quotes.find((q) => q.id === parent)?.version || 1) + 1 : 1,
      parent,
      customer: name,
      signature: sign,
      issued: now.toISOString(),
      expires: new Date(now.getTime() + days * 86400000).toISOString(),
      c: clone(S.c),
      total: amount(),
      items:
        S.path === "lot"
          ? [
              {
                name: lots[S.lot].name + " · exact unit package",
                amount: amount(),
                source: lots[S.lot].source,
              },
            ]
          : clone(breakdown()),
      term: $("#qterm").value,
      path: S.path,
      lot: S.lot,
      accepted: false,
      deposit: false,
      rto: false,
      expiredDemo: false,
    };
  S.quotes.push(q);
  S.activeQuote = q.id;
  S.customer = name;
  closeModal();
  ensureSale(q);
  go("quote");
}
function ensureSale(q) {
  let s = S.sales.find((s) => s.id === q.saleId);
  if (!s) {
    s = {
      id: "BEN-" + String(S.sales.length + 2041),
      customer: q.customer,
      leadIndex: q.leadIndex,
      c: clone(q.c),
      total: q.total,
      path: q.path,
      lot: q.lot,
      status: "Quote issued",
      fulfillment: "Not submitted",
      events: [],
      accepted: false,
      deposit: false,
      rto: false,
      quoteId: q.id,
    };
    S.sales.push(s);
    q.saleId = s.id;
  }
  s.events.push({
    text: "Quote " + q.id + " v" + q.version + " issued",
    time: new Date().toLocaleTimeString(),
  });
  S.activeSale = s.id;
  return s;
}
function currentQ() {
  return S.quotes.find((q) => q.id === S.activeQuote);
}
function expiry(q) {
  return q.expiredDemo || new Date(q.expires) < new Date();
}
function quoteLink(q) {
  const payload = { ...q, events: undefined };
  return (
    location.href.split("#")[0] +
    "#quote=" +
    encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))
  );
}
function qrMarkup(q) {
  try {
    let code = qrcode(0, "L");
    code.addData(quoteLink(q));
    code.make();
    return code.createSvgTag({ cellSize: 2, margin: 4, scalable: true });
  } catch {
    return "<small>Quote payload too large for QR. Use the exact-quote link.</small>";
  }
}
function quoteView(customer = false) {
  let q = currentQ();
  if (!q) return "<p>No issued quote yet.</p>";
  let expired = expiry(q),
    needsReview = catalogReviewItems(q.c).length > 0;
  return `<div class="detail" style="max-width:900px"><div class="no-print actions">${button("← Sales record", `openSale('${q.saleId}')`, "secondary")}${button("Print quote", "window.print()", "secondary")}${!customer ? button("Open as customer", "go('customer')") + button("Revise · keep original", `revise('${q.id}')`, "secondary") + button("Preview text/email", "shareQuote()", "secondary") : ""}</div><article class="quote-paper"><div class="quotehead"><div><div class="eyebrow">BENNETT BUILDINGS · CUSTOMER QUOTE</div><h1>A building for ${esc(q.customer)}.</h1><span class="pill ${expired ? "red" : ""}">${expired ? "Expired" : q.accepted ? "Accepted · simulation" : needsReview ? "Estimate · review required" : "Issued"} · ${q.id} · version ${q.version}</span></div><div><strong>${money(q.total)}</strong><br><small>Before tax and final delivery</small></div></div>${modelMarkup(q.c)}<h2 style="margin-top:20px">${label(q.c)}</h2><p>${included(q.c).map(esc).join(" · ")}</p>${reviewItemsMarkup(q.c)}<div class="terms">${[24, 36, 48, 60].map((t) => `<div><small>${t}-month RTO estimate</small><strong>${money(payment(q.total, t))}/mo</strong><small>+ tax · estimated total ${money(payment(q.total, t) * t)}</small></div>`).join("")}</div><p class="source">Estimated with divisors inferred from a public Statesboro listing; deposit, taxes, eligibility and contract terms need confirmation. Not a finance offer.</p><table><thead><tr><th>Building & options</th><th>Amount</th></tr></thead><tbody>${q.items.map((i) => `<tr><td>${esc(i.name)}<br><small>${esc(i.source)}</small></td><td>${money(i.amount)}</td></tr>`).join("")}<tr><th>Building total</th><th>${money(q.total)}</th></tr></tbody></table><div class="signature">${esc(q.signature)}</div><strong>${needsReview ? "Reference estimate dated " + new Date(q.issued).toLocaleDateString("en-US") + "." : "This quote is good until " + new Date(q.expires).toLocaleDateString("en-US") + "."}</strong><p class="source">Manager signature · demonstration only</p><div class="row"><div class="qr">${qrMarkup(q)}</div><div class="grow"><a href="${quoteLink(q)}" onclick="event.preventDefault();go('customer')">Reopen this exact issued configuration & price ↗</a><p class="source">The link contains the immutable quote snapshot. The QR encodes that same link. In a local HTML file it works on this computer; another device needs the HTML hosted at a reachable address. No hosting is configured.</p></div></div></article><section class="panel no-print" style="margin-top:20px"><h2>${customer ? "Your next steps" : "Customer action preview"}</h2>${expired ? `<p class="notice">This quote has expired. Its original configuration and price remain unchanged.</p>${button("Request an updated quote", "quoteAction('updated')")}` : needsReview ? `<p>Confirm the listed options and pricing with the dealer before accepting.</p>${button("Request an updated quote", "quoteAction('updated')")}` : `<div class="actions">${button(q.accepted ? "Accepted ✓" : "Accept quote", "quoteAction('accepted')")}${button(q.deposit ? "Deposit simulated ✓" : "Pay deposit · simulate", "depositForm()", "secondary")}${button(q.rto ? "RTO form simulated ✓" : "Start rent-to-own application", "rtoForm()", "secondary")}</div>`}<p class="source">All actions are simulations and appear separately in the rep’s record. No funds, legal acceptance or credit application is transmitted.</p><button class="link" onclick="currentQ().expiredDemo=!currentQ().expiredDemo;render()">${expired ? "Restore valid demo state" : "Demonstrate expired quote"}</button></section>${
    !customer
      ? `<section class="panel no-print" style="margin-top:15px"><h3>Issued versions</h3>${S.quotes
          .filter((v) => v.customer === q.customer)
          .map(
            (v) =>
              `<button class="chipbtn" onclick="S.activeQuote='${v.id}';render()">${v.id} · v${v.version} · ${money(v.total)}</button>`,
          )
          .join(" ")}</section>`
      : ""
  }</div>`;
}
function revise(id) {
  let q = S.quotes.find((q) => q.id === id);
  S.c = clone(q.c);
  S.path = q.path;
  if (S.path !== "lot" && !S.c.catalogOptions) {
    S.c.catalogOptions = true;
    const previous = clone(q.c);
    if (S.c.style === "Silver Bullet" && !availableSizes(S.c.style).includes(S.c.size)) S.c.size = "10x16";
    syncPackageSelection(previous, S.c, "size");
  }
  S.lot = q.lot;
  S.customer = q.customer;
  S.saleLead = q.leadIndex;
  S.activeQuote = id;
  S.step = 1;
  S.completed = 5;
  go("configure");
}
function shareQuote() {
  let q = currentQ();
  modal(
    "Text & email preview",
    `<p><strong>To:</strong> ${esc(q.customer)} · fictional recipient</p><textarea rows="5" readonly>Hi ${esc(q.customer)}, your Bennett quote ${q.id} is ready: ${money(q.total)} before tax and final delivery. Good until ${new Date(q.expires).toLocaleDateString()}. Open your exact quote using the link below.</textarea><p><a href="${quoteLink(q)}" onclick="event.preventDefault();closeModal();go('customer')">Open exact quote</a></p><p class="notice">Nothing is sent. Real SMS/email delivery, secure customer links and cross-device access require hosting and integrations.</p>${button("Copy quote link", "navigator.clipboard?.writeText(quoteLink(currentQ())).then(()=>toast('Link copied')).catch(()=>toast('Select and copy the quote link manually'))", "secondary")}`,
  );
}
function quoteAction(key) {
  let q = currentQ();
  if ((expiry(q) || catalogReviewItems(q.c).length) && key !== "updated") return;
  let s = S.sales.find((s) => s.id === q.saleId);
  if (!s) s = ensureSale(q);
  if (key === "updated") {
    s.events.push({ text: "Customer requested an updated quote", time: new Date().toLocaleTimeString() });
    toast("Update request recorded in this preview");
    return;
  }
  q[key] = true;
  s[key] = true;
  s.events.push({
    text: {
      accepted: "Customer accepted quote · simulated",
      deposit: "Deposit collection simulated · no charge",
      rto: "RTO application simulated · review required",
    }[key],
    time: new Date().toLocaleTimeString(),
  });
  render();
}
function depositForm() {
  modal(
    "Simulate deposit collection",
    `<h2>${money(currentQ().total * 0.1)} sample deposit</h2><p>Demonstrates a 10% cash-purchase deposit. RTO deposits depend on term and provider.</p><p class="notice">No card fields, payment processor or money movement. This button only records a simulated deposit event.</p>${button("Record simulated deposit", "closeModal();quoteAction('deposit')")}`,
  );
}
function rtoForm() {
  modal(
    "Rent-to-own application · simulation",
    `<p>Use the sample details below. No sensitive identity documents are collected.</p><div class="fields"><label>Applicant<input value="${esc(currentQ().customer)}" readonly></label><label>Delivery address<input value="100 Demo Lane, Statesboro, GA" readonly></label></div><p><label><input id="rtoMismatch" type="checkbox"> Demonstrate identity / delivery discrepancy</label></p><p class="notice">Jordan’s approved forms, provider terms and secure identity workflow must replace this screen.</p>${button("Submit simulated application", "let mismatch=$('#rtoMismatch').checked;closeModal();quoteAction('rto');let s=S.sales.find(s=>s.id===currentQ().saleId);s.discrepancy=mismatch;toast('Sample application recorded for human review')")}`,
  );
}
function customerField(label, name, value = "", type = "text", required = true) {
  return `<label class="field">${label}${required ? "" : " (optional)"}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
}
function customerAddress(prefix, title, details) {
  return `<h3>${title}</h3>${customerField("Street address", prefix + "Street", details[prefix + "Street"])}${customerField("Apartment or suite", prefix + "Unit", details[prefix + "Unit"], "text", false)}${customerField("City", prefix + "City", details[prefix + "City"])}${customerField("State", prefix + "State", details[prefix + "State"])}${customerField("ZIP code", prefix + "Zip", details[prefix + "Zip"])}`;
}
function finalizeForm(details) {
  if (catalogReviewItems(S.c).length) {
    quoteForm();
    return;
  }
  if (!details) {
    reviewBilling = null;
    reviewChecklist = [];
  }
  const sale = S.sales.find((s) => s.id === S.activeSale);
  const lead = leadData[sale ? sale.leadIndex : S.saleLead];
  const [firstName, ...lastName] = (S.customer || "").trim().split(/\s+/);
  const d = details || {
    firstName,
    lastName: lastName.join(" "),
    email: lead?.name === S.customer ? leadEmail(lead) : "",
    same: true,
  };
  modal(
    "Customer Information",
    `<p class="source">Preview only · use fictional information.</p>
 <form id="customerInfo" onsubmit="event.preventDefault();reviewSale()">
 ${customerField("First name", "firstName", d.firstName)}${customerField("Last name", "lastName", d.lastName)}
 ${customerField("Email address", "email", d.email, "email")}${customerField("Phone number", "phone", d.phone, "tel")}
 ${customerAddress("billing", "Billing address", d)}
 <label class="field"><input type="checkbox" name="same" ${d.same ? "checked" : ""} onchange="this.form.elements.deliveryFields.hidden=this.checked;this.form.elements.deliveryFields.disabled=this.checked"> Delivery address same as billing</label>
 <fieldset name="deliveryFields" ${d.same ? "hidden disabled" : ""}>${customerAddress("delivery", "Delivery address", d)}</fieldset>
 <div class="actions"><button class="primary" type="submit">Continue →</button></div></form>`,
  );
}
let reviewCustomer;
function reviewSale() {
  const form = $("#customerInfo");
  const details = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(details)) details[key] = details[key].trim();
  if (
    [...form.querySelectorAll("input[required]")].some(
      (input) => !input.matches(":disabled") && !input.value.trim(),
    )
  ) {
    toast("Complete the required customer fields.");
    return;
  }
  details.same = form.elements.same.checked;
  reviewCustomer = details;
  openBilling();
}
let reviewBilling,
  reviewChecklist = [];
const rtoChecklist = [
  ["Applicant and ID", "Sample applicant · date of birth and ID details simulated"],
  ["ID photo or scan", "Required in ShedSuite · sample ID status only"],
  ["Employment and co-signer", "Sample employer · co-signer if applicable"],
  ["Two references", "Sample names, relationships, phones and states"],
  ["Monthly payment due day", "Sample due day · 15th"],
  ["Delivery property", "Sample site · customer owns the property"],
];
function openBilling() {
  const activeQuote = S.quotes.find((q) => q.id === S.activeQuote);
  const term = reviewBilling?.term || Number(activeQuote?.term) || S.term || 60;
  const rto = reviewBilling?.type === "Rent-to-own";
  modal(
    "Billing",
    `<p class="source">Preview estimates · tax and delivery to be confirmed.</p>
 <p><strong>Building subtotal</strong> ${money(amount())}</p>
 <form id="saleBilling" onsubmit="event.preventDefault();continueBilling(this)">
 <label class="field">Sale type<select name="type" onchange="this.form.elements.rtoTerms.hidden=this.value!=='Rent-to-own'"><option>Cash purchase</option><option ${rto ? "selected" : ""}>Rent-to-own</option></select></label>
 <fieldset name="rtoTerms" ${rto ? "" : "hidden"}><legend>Rent-to-own estimate</legend><p>Provider: Sample RTO provider</p><label class="field">Term<select name="term">${[24, 36, 48, 60].map((n) => `<option value="${n}" ${n === term ? "selected" : ""}>${n} months · ${money(payment(amount(), n))}/mo before tax</option>`).join("")}</select></label><p>Amount due at signing: pending provider confirmation</p></fieldset>
 <label class="field">Simulated deposit ($)<input name="deposit" type="number" min="0" max="${amount()}" step="0.01" value="${reviewBilling?.deposit || 0}" required></label>
 <p class="source">Deposit entry is a demo amount. Final balance depends on taxes, delivery and applicable terms.</p>
 <div class="actions">${button("← Customer Information", "finalizeForm(reviewCustomer)", "secondary")}<button class="primary" type="submit">Continue →</button></div></form>`,
  );
}
function continueBilling(form) {
  const { type, term, deposit } = form.elements;
  const isRto = type.value === "Rent-to-own";
  reviewBilling = {
    type: type.value,
    term: isRto ? Number(term.value) : null,
    deposit: Number(deposit.value),
  };
  if (isRto) openRtoChecklist();
  else showSaleReview();
}
function openRtoChecklist() {
  modal(
    "Rent-to-own checklist",
    `<p class="notice">Simulation only. Use the sample checklist to demonstrate the provider handoff.</p>
 <form onsubmit="event.preventDefault();reviewChecklist=new FormData(this).getAll('checks');showSaleReview()">
 ${rtoChecklist.map(([title, description], i) => `<p><label><input type="checkbox" name="checks" value="${i}" ${reviewChecklist.includes(String(i)) ? "checked" : ""}> <strong>${title}</strong><br><small>${description}</small></label></p>`).join("")}
 <div class="actions">${button("← Billing", "openBilling()", "secondary")}<button class="primary" type="submit">Continue to review →</button></div></form>`,
  );
}
function showSaleReview() {
  const details = reviewCustomer;
  const billing = reviewBilling;
  const rto = billing.type === "Rent-to-own";
  modal(
    "Finalize sale · submit for review",
    `<p><strong>${esc(details.firstName + " " + details.lastName)}</strong><br>${esc(details.email)} · ${esc(details.phone)}</p><p>${details.same ? "Delivery address matches billing." : "Separate delivery address provided."}</p>
 <p><strong>${billing.type}</strong> · ${money(amount())} building subtotal<br>Simulated deposit: ${money(billing.deposit)}${rto ? `<br>${billing.term} months · ${money(payment(amount(), billing.term))}/mo before tax<br>RTO checklist: ${reviewChecklist.length} of ${rtoChecklist.length} reviewed` : `<br>Remaining building subtotal: ${money(amount() - billing.deposit)}`}</p>
 <p class="notice">This submits only to the preview’s simulated review queue.</p><div class="actions">${button(rto ? "← RTO checklist" : "← Billing", rto ? "openRtoChecklist()" : "openBilling()", "secondary")}${button("Submit sale for review", "submitSale()")}</div>`,
  );
}
function submitSale() {
  if (!reviewCustomer || !reviewBilling) return;
  let name = reviewCustomer.firstName + " " + reviewCustomer.lastName;
  if (S.path === "lot" && lots[S.lot]?.status !== "Available") {
    toast("This unit is no longer available in the demo.");
    return;
  }
  let type = reviewBilling.type,
    s = S.sales.find((s) => s.id === S.activeSale && s.status === "Quote issued");
  if (!s) {
    s = {
      id: "BEN-" + String(S.sales.length + 2041),
      customer: name,
      c: clone(S.c),
      total: amount(),
      path: S.path,
      lot: S.lot,
      events: [],
      accepted: false,
      deposit: false,
      rto: false,
    };
    S.sales.push(s);
  }
  s.customer = name;
  s.customerInfo = reviewCustomer;
  s.billing = { ...reviewBilling, checklist: type === "Rent-to-own" ? [...reviewChecklist] : [] };
  reviewCustomer = null;
  s.type = type;
  s.status = "Submitted · Awaiting review";
  s.fulfillment = "Review pending";
  s.events.push({ text: "Submitted to administrator · simulated", time: new Date().toLocaleTimeString() });
  if (s.path === "lot") lots[s.lot].status = "Pending";
  S.activeSale = s.id;
  closeModal();
  go("sale");
}
function openSale(id) {
  S.activeSale = id;
  go("sale");
}
function sale() {
  let s = S.sales.find((s) => s.id === S.activeSale);
  if (!s) return "<p>Choose a sales record.</p>";
  if (s.path === "site") return siteReviewRecord(s);
  return (
    head(s.id, esc(s.customer), label(s.c)) +
    `<div class="grid2"><section class="panel">${modelMarkup(s.c)}<div class="statusgrid"><div><small>Sale status</small><strong>${s.status}</strong></div><div><small>Fulfillment</small><strong>${s.fulfillment}</strong></div><div><small>Building total</small><strong>${money(s.total)}</strong></div></div><h3 style="margin-top:25px">Customer actions</h3><p>Acceptance: <strong>${s.accepted ? "Simulated ✓" : "Not recorded"}</strong><br>Deposit: <strong>${s.deposit ? "Simulated ✓" : "Not recorded"}</strong><br>RTO application: <strong>${s.rto ? "Simulated ✓" : "Not recorded"}</strong></p>${s.quoteId ? button("Open issued quote", `S.activeQuote='${s.quoteId}';go('quote')`, "secondary") : ""}${s.status === "Quote issued" ? button("Finalize this sale", `S.c=clone(S.sales.find(x=>x.id===S.activeSale).c);S.path='${s.path}';S.lot=${s.lot};S.customer=${JSON.stringify(s.customer).replace(/"/g, "&quot;")};finalizeForm()`) : ""}${s.path === "lot" ? `<div class="actions">${button("Matching sales history", `matchHistory(${s.lot})`, "secondary")}${button("Order another for stock", `restock(${s.lot})`)}</div>` : ""}</section><section class="panel"><h2>Administrator handoff</h2><p class="source">Simple simulation · full administrator dashboard deferred</p>${s.status.includes("Submitted") || s.status === "Correction requested" ? `<p>Check selected options, paperwork, identity and delivery details.</p>${s.discrepancy ? '<p class="notice">Identity / delivery discrepancy flagged. Human review required before approval.</p>' : ""}<div class="actions">${button("Request correction", "reviewAction('correction')", "secondary")}${button("Simulate approval", "reviewAction('approve')")}</div>${s.status === "Correction requested" ? button("Resolve & resubmit", "reviewAction('resubmit')", "secondary") : ""}` : `<p>${s.status === "Processed · Sold" ? "Review complete. Manufacturing or logistics owns the next handoff." : "Submit the sale to demonstrate administrator review."}</p>`}<h3>Record history</h3>${s.events
      .slice()
      .reverse()
      .map((e) => `<div class="log"><small>${e.time}</small><br>${esc(e.text)}</div>`)
      .join("")}</section></div>`
  );
}
function reviewAction(action) {
  let s = S.sales.find((s) => s.id === S.activeSale);
  if (action === "correction") {
    s.status = "Correction requested";
    s.fulfillment = "On hold for correction";
    s.events.push({
      text: "Administrator requested option / delivery details correction",
      time: new Date().toLocaleTimeString(),
    });
  }
  if (action === "resubmit") {
    s.discrepancy = false;
    s.status = "Submitted · Awaiting review";
    s.fulfillment = "Review pending";
    s.events.push({
      text: "Rep corrected sample details and resubmitted",
      time: new Date().toLocaleTimeString(),
    });
  }
  if (action === "approve") {
    if (s.discrepancy || s.status === "Correction requested") {
      toast("Resolve the flagged discrepancy/correction before approval.");
      return;
    }
    if (s.type === "Rent-to-own" && !s.rto) {
      modal(
        "RTO paperwork needs review",
        `<p>No simulated RTO application is recorded.</p>${button("Record sample paperwork review & approve", "closeModal();S.sales.find(s=>s.id===S.activeSale).rto=true;reviewAction('approve')")}`,
      );
      return;
    }
    s.status = "Processed · Sold";
    s.fulfillment = s.path === "lot" ? "Awaiting delivery scheduling" : "In building queue";
    if (s.path === "lot") lots[s.lot].status = "Sold";
    s.events.push({
      text:
        s.path === "lot"
          ? "Approved; dedicated logistics person owns delivery scheduling"
          : "Approved; handed to ShedCor building queue · simulation",
      time: new Date().toLocaleTimeString(),
    });
  }
  render();
}

function filterOrders(q) {
  $("#orderresults").innerHTML =
    salesRows(
      S.sales.filter((s) =>
        (s.customer + s.id + label(s.c) + (lots[s.lot]?.id || "")).toLowerCase().includes(q.toLowerCase()),
      ),
    ) || "<p>No matching orders.</p>";
}
function exactRows(i, days = 90) {
  const u = lots[i],
    cut = new Date("2026-11-03T12:00:00Z").getTime() - days * 86400000;
  return history.filter(
    (h) =>
      h.status === "Processed" &&
      h.location === u.location &&
      new Date(h.date).getTime() >= cut &&
      h.style === u.c.style &&
      h.size === u.c.size &&
      h.siding === u.c.siding &&
      h.color === u.c.color &&
      h.price === u.price &&
      h.options ===
        `${u.c.windows} ${u.c.windowType} window; ${u.c.electrical} electrical; ${u.c.door} door; ${u.c.roof} roof`,
  );
}
function recordsTable(rows) {
  return `<div class="scrolltable"><table><thead><tr><th>Record</th><th>Location / rep</th><th>Configuration</th><th>Price</th><th>Days on lot</th><th>Status</th></tr></thead><tbody>${rows.map((h) => `<tr><td><button class="link" onclick="historyDetail('${h.id}')">${h.id}</button><br>${h.date}</td><td>${h.location}<br>${h.rep}</td><td>${h.size} ${h.style}<br>${h.siding} · ${h.color}</td><td>${money(h.price)}</td><td>${h.days}</td><td>${h.status}</td></tr>`).join("")}</tbody></table></div>`;
}
function historyDetail(id) {
  let h = history.find((h) => h.id === id);
  modal(
    "Sample sales record " + id,
    `<p>${h.location} · ${h.rep}<br>Received ${h.received} · processed/date ${h.date}</p><h3>${h.size} ${h.style}</h3><p>${h.siding} · ${h.color}<br>${h.options}</p><p>${money(h.price)} · ${h.days} days on lot · ${h.status}</p><small>Fictional evidence record for interaction testing.</small>`,
  );
}
function matchHistory(i, days = 90) {
  let rows = exactRows(i, days),
    median = rows.length
      ? rows
          .map((r) => r.days)
          .sort((a, b) => a - b)
          .reduce((a, b) => a + b, 0) / rows.length
      : 0;
  go("matches");
  $("#app").innerHTML =
    head(
      "MATCHING SALES · SAMPLE EVIDENCE",
      "Does this configuration sell here?",
      "Exact match includes style, size, siding, color, price and listed options.",
    ) +
    `<section class="panel"><div class="row"><h2>${lots[i].name} · ${lots[i].location}</h2><label>Window <select onchange="matchHistory(${i},+this.value)">${[30, 60, 90].map((d) => `<option value="${d}" ${days === d ? "selected" : ""}>${d} days</option>`).join("")}</select></label></div><p><strong>${rows.length} processed exact matches</strong> · Typical days on lot (mean): <strong>${median.toFixed(1)}</strong></p>${recordsTable(rows)}<p class="source">As of Nov 3, 2026. Synthetic history; associations do not explain demand or rep behavior.</p>${button("Order replacement with this evidence", `restock(${i},${days})`)}</section>`;
}
function restock(i, days = 90) {
  S.stockDraft = {
    lot: i,
    c: clone(lots[i].c),
    location: lots[i].location,
    days,
    evidence: exactRows(i, days).map((h) => h.id),
  };
  go("restock");
}
function stockForm() {
  let d = S.stockDraft;
  if (!d) return "<p>Select a lot unit first.</p>";
  let rows = exactRows(d.lot, d.days);
  return (
    head(
      "MANAGER · INDEPENDENT STOCK REQUEST",
      "Keep the lot ready for the next customer.",
      "This request is separate from the pending customer sale.",
    ) +
    `<div class="grid2"><section class="panel">${modelMarkup(d.c)}<div class="fields"><label>Destination lot<select onchange="S.stockDraft.location=this.value"><option>${LOT_LOCATION}</option><option>Statesboro</option><option>Vidalia</option></select></label><label>Size<select onchange="S.stockDraft.c.size=this.value;render()">${[...new Set([d.c.size, "10x12", "10x16", "10x20"])].map((x) => `<option ${x === d.c.size ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Color<select onchange="S.stockDraft.c.color=this.value;render()">${[...new Set([d.c.color, "Clay", "Blue", "Sage", "Slate"])].map((x) => `<option ${x === d.c.color ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Electrical<select onchange="S.stockDraft.c.electrical=this.value;render()">${[...new Set([d.c.electrical, "None", "Basic", "Workshop"])].map((x) => `<option ${x === d.c.electrical ? "selected" : ""}>${x}</option>`).join("")}</select></label></div><p>Prefilled from ${lots[d.lot].id}. Any edits affect only this stock request.</p>${button("Submit stock request · simulate", "submitStock()")}</section><section class="panel"><h2>Evidence attached to the original match</h2><p>${rows.length} processed exact matches · ${d.days}-day window</p>${recordsTable(rows)}<label><input id="attachEvidence" type="checkbox" checked> Attach these record IDs</label><p class="notice">If you edit the replacement, this evidence still describes the original configuration; it does not become an exact-match forecast.</p><h3>Open policy</h3><p>Pending units are shown as Pending and cannot be sold again in this preview. Jordan must confirm whether they remain publicly visible or reservable.</p></section></div>`
  );
}
function submitStock() {
  let d = S.stockDraft,
    r = {
      id: "STOCK-" + (S.stock.length + 1),
      ...clone(d),
      evidence: $("#attachEvidence").checked ? d.evidence : [],
      status: "Submitted · simulated",
    };
  S.stock.push(r);
  go("stock");
  toast("Independent stock request submitted. Customer sale unchanged.");
}

function performanceScreen() {
  const f = S.filter,
    cut = new Date("2026-11-03T12:00:00Z").getTime() - f.days * 86400000,
    rows = history.filter(
      (h) =>
        (f.location === "All" || h.location === f.location) &&
        (f.rep === "All" || h.rep === f.rep) &&
        (f.style === "All" || h.style === f.style) &&
        new Date(h.date).getTime() >= cut,
    );
  let sold = rows.filter((h) => h.status === "Processed"),
    pending = rows.filter((h) => h.status === "Pending"),
    hand = rows.filter((h) => h.status !== "Processed");
  return (
    head(
      "BENNETT INVENTORY PERFORMANCE",
      "What moves. What waits. What gets offered.",
      "Synthetic evidence, traceable to the records below. Compare patterns—not presumed causes.",
    ) +
    `<section class="panel"><div class="fields"><label>Location / region<select onchange="S.filter.location=this.value;render()">${["All", "Statesboro", "Vidalia"].map((x) => `<option ${x === f.location ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Salesperson<select onchange="S.filter.rep=this.value;render()">${["All", "Sam Lee", "Casey Park", "Avery Gray"].map((x) => `<option ${x === f.rep ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Style<select onchange="S.filter.style=this.value;render()">${["All", ...Object.keys(descriptions)].map((x) => `<option ${x === f.style ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Time window<select onchange="S.filter.days=+this.value;render()">${[30, 60, 90].map((d) => `<option value="${d}" ${d === f.days ? "selected" : ""}>${d} days</option>`).join("")}</select></label></div><p class="source">All = Georgia sample region. Window filters record activity dates; received count uses received dates in that same window.</p><div class="metricrow"><div class="metric">Received<strong>${rows.filter((h) => new Date(h.received).getTime() >= cut).length}</strong></div><div class="metric">Processed sales<strong>${sold.length}</strong></div><div class="metric">Pending<strong>${pending.length}</strong></div><div class="metric">Still on hand incl. pending<strong>${hand.length}</strong></div></div><p>Mean days on lot for processed sales: <strong>${sold.length ? (sold.reduce((a, h) => a + h.days, 0) / sold.length).toFixed(1) : "—"}</strong></p>${recordsTable(rows)}<details style="margin-top:20px"><summary>Compare attributes: size, siding, color, price range and options</summary><input class="search" aria-label="Filter attributes" placeholder="Search 10x16, Clay, electrical, or a price" oninput="document.querySelectorAll('#attrrows tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(this.value.toLowerCase()))"><div class="scrolltable"><table><tbody id="attrrows">${rows.map((r) => `<tr><td>${r.id}</td><td>${r.size}</td><td>${r.siding}</td><td>${r.color}</td><td>${money(r.price)} · ${r.price < 6000 ? "Under $6k" : "$6k–$10k"}</td><td>${r.options}</td></tr>`).join("")}</tbody></table></div></details></section><section class="panel" style="margin-top:20px"><h2>This preview session · separate activity cohort</h2><div class="metricrow"><div class="metric">Issued quote versions<strong>${S.quotes.length}</strong></div><div class="metric">Quotes → processed sales<strong>${S.sales.filter((s) => s.quoteId && s.status === "Processed · Sold").length}</strong></div><div class="metric">Shown to customer<strong>${S.shown.length}</strong></div><div class="metric">Stock requests<strong>${S.stock.length}</strong></div></div><p class="source">Shown events are not quotes. Quote revisions are counted as versions; conversion counts distinct processed sales with an issued quote.</p>${S.quotes.map((q) => `<button class="chipbtn" onclick="S.activeQuote='${q.id}';go('quote')">${q.id} · ${esc(q.customer)}</button>`).join(" ")}${S.shown.map((e, i) => `<p class="source">Shown event ${i + 1}: ${e.unit} · ${e.date}</p>`).join("")}</section>`
  );
}
function notes() {
  return (
    head("SOURCES & OPEN DECISIONS", "Grounded where verified. Explicit where simulated.") +
    `<section class="panel notes"><h2>Public references checked</h2><ul><li><a target="_blank" href="https://www.buybennett.com/">buybennett.com</a> links its official builder and inventory. Photos and model views informed our original animated geometry; no photos are embedded.</li><li><a target="_blank" href="https://idearoom-shedcor.buybennett.com/">Official builder</a>: 10x16 Basic Utility base $5,416 + $48 fuel = $5,464. Classic Utility base $5,778 + $48 = $5,826. Default double shed door, two vents, 2×6 joists at 16 inches on center. Other combinations/options here remain samples.</li><li><a target="_blank" href="https://shedcor.shedsuite.com/shop-inventory/535726">Statesboro unit BS-LB-NP-1016-080226-059157</a>: $6,018, Clay siding, Burnished Slate roof, Origami White trim, one 2x3 white window, front/back 4 ft lofts, Basic electrical. This is a reference snapshot, never a live reservation.</li><li>Its public monthly payments were $358.21 / $278.61 / $244.63 / $221.25 for 24 / 36 / 48 / 60 months, before tax. These match price ÷ 16.8 / 21.6 / 24.6 / 27.2 after rounding. <strong>Divisors are inferred, not explicitly published or contract-verified.</strong> Applicability by state, provider and deposits remains open.</li><li><a target="_blank" href="https://www.buybennett.com/greenhouses">Greenhouse reference</a>: clear polycarbonate roof, screened windows and listed 8x12, 8x16, 10x12, 10x16 and 10x20 sizes. Our models illustrate the forms without claiming construction accuracy.</li></ul><h2>Verified from the earlier read-only app review</h2><p>Bennett intake routes to ShedCor. The catalog explicitly describes lap siding on Classic as creating Elite and a Classic-to-Basic siding change. Named upgrades include floor joists, tall walls and porches. Recipe applications require confirmation. The production stages and source test unit are reused.</p><h2>Jordan’s remaining decisions</h2><ol><li>Approve full retail price book, fuel/tax/delivery treatment, state-specific RTO divisors, deposit, CSRA, eligibility and rounding. Only selected public price references are verified here.</li><li>Confirm TechShield eligibility; complete size/style/roof/opening compatibility. Our conflict rules are demonstrations. Metal and greenhouse packages retain their own identities.</li><li>Provide authoritative lot availability and pending/reservation policy, inventory photos/models, production model dimensions and color palette.</li><li>Connect versioned quote storage, secure hosted links/QR access, SMS/email delivery, manager authority, quote expiry policy and real electronic signatures.</li><li>Integrate payments, RTO provider forms and secure human identity/address review. No sensitive identity or card data belongs in this HTML demo.</li><li>Connect administrator approval, ShedCor build queue, dedicated logistics scheduling and independent stock-request approval.</li><li>Define exact-match criteria, reporting cohorts, receipt dates, quote conversion attribution and shown-to-customer tracking. All performance records here are fictional.</li></ol><p class="notice">Offline HTML preview. All customer details, sales history and actions are fictional/simulated. No live app records are written. Data lasts for the current page session; issued snapshot links preserve configuration and price when reopened in this same HTML.</p><p class="source">QR generator: qrcode-generator by Kazuhiko Arase (MIT), embedded for offline use. Model renderer is original illustrative geometry.</p></section>`
  );
}

function loadHash() {
  if (location.hash.startsWith("#quote=")) {
    try {
      const q = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(location.hash.slice(7))))));
      if (!q.c || !Number.isFinite(q.total) || !Array.isArray(q.items)) throw Error();
      S.quotes.push(q);
      S.activeQuote = q.id;
      S.page = "customer";
      ensureSale(q);
    } catch {
      toast("This quote link could not be read.");
    }
  }
  render();
}
window.addEventListener("hashchange", loadHash);

/* 3D reference models per style: [Basic, Classic, Elite] variants where they exist. */
const bennettModels = {
  Utility: ["01-basic-utility", "02-classic-utility", "03-elite-utility"],
  Lofted: ["04-basic-lofted-barn", "05-classic-lofted-barn", "06-elite-lofted-barn"],
  Studio: ["07-studio"],
  Greenhouse: ["14-greenhouse"],
  "Low-Wall Barn": ["20-mini-barn"],
  "Silver Bullet": ["13-metal-shed"],
};
