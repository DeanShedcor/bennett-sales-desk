/* turbo-plant.js: what the Production side and Plant QC take from Turbo Assist.

   Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does. Everything
   here is something its Manufacturing front already does (Build pipeline, Builder Assistant, QC
   Dashboard), drawn on this preview's screens. Each piece wraps a screen or an action that is
   already there; none of the older files change.

   Production
   - Plant serials: a building has no serial until it leaves Order received; then it gets the
     plant's code, a dash and a five-digit number (`formatPlantSerial`, "{prefix}{seq:05d}").
     The order number stays as the record's id and shows beside the serial.
   - The unit page gains Build specs, Bill of materials, Issue material and Ship from plant.
   - Production loads gain the footage note, Close (free letter) and letter reuse.
   - Phase settings: the nine phases with their Initial, Build complete and Pay trigger flags.
   - Inventory request from the board.
   Plant QC
   - Final QC: ready for final certification, initials on the sign-off, sending an item back.
   - Up to three photos on a failure, severity, tags, the corrective action, the failure email.
   - The QC Dashboard on the Report screen, and a serial lookup every side can call.

   Made-up here: the serial counter's starting number, what the plant has on hand, the people.
   Left out on purpose: costs, vendor names and pay amounts.
   Loaded after turbo.js (taTip, taNotify, taNotesFor). */

const TP_SEQ_START = 1840; /* sample counter: the first serial issued here is ORB-01841 */
const TP = {
  booting: true,
  serials: {}, /* record id -> plant serial */
  seq: {}, /* plant id -> last number issued */
  started: {}, /* record id -> when it left Order received in this tab */
  lastPhase: {}, /* record id -> phase at the last sync */
  shipped: {}, /* record id -> when it left the board with Logistics */
  pay: {}, /* record id -> [{ phase, at }] : entered a pay-trigger phase */
  issued: {}, /* record id -> [{ name, qty, unit, at, note }] */
  consumed: {}, /* record id -> when final QC issued its recipe materials */
  requests: [], /* inventory requests sent from the board */
  reqSeq: 1041,
  closedLoads: [],
  /* What Turbo Assist stores on each phase (DEFAULT_BUILD_PIPELINE_PHASES). The pay trigger
     defaults to the build-complete phase when none is flagged (pickDefaultPayTriggerPhaseId). */
  phases: [
    ['order_received', 'Order received', 10], ['order_approved', 'Order approved', 20], ['flooring', 'Flooring', 30], ['walls', 'Walls', 40], ['ceiling_finish', 'Ceiling / finish', 50],
    ['paint', 'Paint', 60], ['roofing', 'Roofing', 70], ['final_qa', 'Final QA', 80], ['build_complete', 'Build complete', 90],
  ].map(([key, name, seq], i, all) => ({ key, name, seq, initial: i === 0, complete: i === all.length - 1, pay: i === all.length - 1, tag: 'phase:' + key })),
  /* Plant QC settings Turbo Assist keeps per org. */
  qc: { photos: true, notes: true, consume: true, subject: 'QC failure · {{serial}} · {{plant}} · {{customer}}' },
  dash: { view: 'table', win: 'today', page: 0, q: '', q2: '', open: { final: true, awaiting: true, failures: true, reports: false } },
  /* Material names and categories from Turbo Assist's material list. What is on hand is made up. */
  mats: [
    ['LUM-01', '2x4x72 (6) - Precut Stud', 'Lumber', 'each', 1840], ['LUM-02', '2x4x96 (8) - Precut Stud', 'Lumber', 'each', 920], ['LUM-03', '2x4x144 - Pressure Treated', 'Lumber', 'each', 310], ['LUM-04', '2X6X93 - Pressure Treated', 'Lumber', 'each', 260], ['LUM-05', '1x4x96 (8) - Precut', 'Lumber', 'each', 540],
    ['FLO-01', "4x6 - 8' Notched 4x6 Runners", 'Floor', 'each', 96], ['FLO-02', 'Underlayment', 'Floor', 'each', 40],
    ['WAL-01', "9'x150' House Wrap", 'Walls', 'each', 18], ['WAL-02', 'SilverTech Tape (linear ft)', 'Walls', 'ft', 2400], ['WAL-03', "10' Starter Strip", 'Walls', 'each', 150],
    ['ROO-01', 'Hurricane Ties', 'Roof', 'each', 3200], ['ROO-02', '3x4 Truss Assembly Plates', 'Roof', 'each', 5100], ['ROO-03', 'Black Roof & Flashing Sealant', 'Roof', 'each', 64], ['ROO-04', 'Pewter Gray 3-Tab Shingles', 'Roof', 'each', 120],
    ['WIN-01', '2x3 Window White', 'Window', 'each', 85], ['WIN-02', '3x3 Window White', 'Window', 'each', 42], ['WIN-03', '10x29 White Insulated Transom', 'Window', 'each', 30],
    ['DOO-01', 'Door Bumpers', 'Door hardware', 'each', 400], ['DOO-02', 'Sill Pans', 'Door hardware', 'each', 75], ['DOO-03', "6' Rails (Pair)", 'Door hardware', 'each', 38],
    ['ELE-01', '60W Light Bulb', 'Electrical', 'each', 210], ['ELE-02', '15A 125V Hinged Plugs', 'Electrical', 'each', 130], ['ELE-03', 'Clear Electrical Cover', 'Electrical', 'each', 95],
    ['PAI-01', 'Painters Tape - 1 Roll', 'Paint', 'each', 160], ['PAI-02', 'Chip Brushes', 'Paint', 'each', 300], ['PAI-03', 'Roller Nap 9 in.', 'Paint', 'each', 88],
    ['MET-01', '10.6 ft Metal Ridge Cap', 'Metal', 'each', 54], ['MET-02', '10.6 ft Metal Rake', 'Metal', 'each', 112],
  ].map(([code, name, cat, unit, on]) => ({ code, name, cat, unit, on })),
};
const tpBaseUnits = prUnits; /* the board's own list, before the serial is added to it */
/* A screen that is listed by reference in OPS_SCREENS or QC_SCREENS is wrapped there too, so the
   shell draws the wrapped one. */
const tpStamp = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tpNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const tpPlural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/* Put `add` in front of a marker in a screen's HTML; the last one when `last` is set. Left alone when the marker is missing. */
function tpBefore(html, marker, add, last = false) {
  const at = last ? html.lastIndexOf(marker) : html.indexOf(marker);
  return at < 0 ? html : html.slice(0, at) + add + html.slice(at);
}

/* ---------- Plant serials ---------- */
/* The plant's short code. The repo's docs use ORB for Orangeburg; a plant added later takes the first three letters of its town. */
function tpPlantCode(plant) {
  return (plant.code || (plant.id === 'orangeburg' ? 'ORB' : String(plant.town || plant.name).replace(/[^A-Za-z]/g, '').slice(0, 3))).toUpperCase();
}
/* formatPlantSerial: "{prefix}{seq:05d}" with the default prefix "{plant_code}-". */
const tpFormatSerial = (code, seq) => `${code}-${String(seq).padStart(5, '0')}`;
const tpSerial = (id) => TP.serials[id] || '';
const tpShown = (id) => tpSerial(id) || id;
const tpPlantOf = (u) => lotPlant(lotById(u.lotId)) || PLANTS[0];
function tpEnterPhase(u, phase, at) {
  if (!TP.phases[phase]?.pay) return;
  const list = (TP.pay[u.id] ||= []);
  if (!list.some((x) => x.phase === phase)) list.push({ phase, at });
}
/* Runs before every screen is drawn. A building that has left Order received gets its serial
   (Turbo Assist: leaving the initial phase starts the build and issues the serial); a building
   that has gone with Logistics is marked shipped; entering a pay-trigger phase is recorded. */
function tpSync() {
  const units = tpBaseUnits(), seed = TP.booting, now = Date.now(), ids = new Set(units.map((u) => u.id));
  /* Oldest first, in whole hours so the order is the same on every load, then by id. */
  const age = (u) => Math.round((now - u.since) / 36e5);
  const fresh = units.filter((u) => u.phase >= 1 && !TP.serials[u.id]).sort((a, b) => age(b) - age(a) || (a.id < b.id ? -1 : 1));
  for (const u of fresh) {
    /* One counter per plant. The sample plant starts part-way; a plant added later starts at 00001. */
    const plant = tpPlantOf(u), n = (TP.seq[plant.id] = (TP.seq[plant.id] ?? (plant.id === PLANTS[0].id ? TP_SEQ_START : 0)) + 1), serial = (TP.serials[u.id] = tpFormatSerial(tpPlantCode(plant), n));
    if (seed) continue;
    TP.started[u.id] = now;
    (PR.hist[u.id] ||= []).push({ from: 0, to: u.phase, at: now, note: `Build started — serial ${serial} assigned` });
    taNotify({ to: 'prod', title: `Build started — serial ${serial} assigned`, body: `${u.name} for ${u.customer || 'the ' + lotById(u.lotId).town + ' lot'} left Order received.`, go: `prOpen('${u.id}')` });
  }
  for (const u of units) {
    const was = TP.lastPhase[u.id];
    if (was !== u.phase) tpEnterPhase(u, u.phase, seed ? u.since : now);
    TP.lastPhase[u.id] = u.phase;
  }
  for (const id of Object.keys(TP.lastPhase)) {
    if (ids.has(id) || TP.shipped[id]) continue;
    const lg = typeof lgUnit === 'function' && lgUnit(id);
    if (lg && lg.at !== 'plant') {
      TP.shipped[id] = now;
      if (!seed) taNotify({ to: 'prod', title: `${tpShown(id)} shipped from plant`, body: 'It left with Logistics, so it is off the board.', go: "go('prod')" });
    }
  }
}
prUnits = function () {
  const out = tpBaseUnits();
  for (const u of out) {
    u.plantSerial = tpSerial(u.id);
    if (u.plantSerial) u.serial = `${u.plantSerial} · ${u.id}`;
  }
  return out;
};
{
  const drawScreen = render;
  render = function () {
    tpSync();
    drawScreen();
  };
}
/* The checklist asks the inspector to read the serial off the building: that is the plant serial. */
QC_CONFIG.specific['Is the serial number verified?'] = (b) => `Does the serial number on the building read ${tpShown(b.serial)}?`;
QC_CONFIG.specific['Is the serial number written on the top plate above the door?'] = (b) => `Is ${tpShown(b.serial)} written on the top plate above the door?`;

/* ---------- Build specs and the bill of materials ----------
   Each number comes from a rule in the repo:
   - floor: 2x4 at 16 in on center; width 10 and wider includes the 2x6 joists; joists =
     ceil(L × 12 / 16) + 1 (scripts/rectify-floor-joist-base.ts, scripts/fix-floor-joist-counts.ts)
   - band boards around the whole floor, 4x8 floor panels = W × L / 32, two pull boards, four
     runner tracks on 12 to 16 wide (scripts/generate-missing-floors-csv.ts)
   - studs = 2 × (ceil(L × 12 / oc) + 1 + ceil(W × 12 / oc) + 1), wood at 16 in, Silver Bullet at
     24 in; plates = 3 × the perimeter; nails (scripts/generate-walls-x6-csv.ts)
   - a lofted barn under 16 ft long includes a 4 ft loft, 16 ft and longer an 8 ft loft; loft
     joists at 24 in on center, both ends counted (server/mfg-domain/loftWidthVariant.ts)
   Heights and the series facts are from the knowledge base articles the tips open. */
const TP_RUNNERS = { 12: [12], 16: [16], 20: [20], 24: [12, 12], 28: [12, 16], 32: [16, 16], 36: [20, 16], 40: [20, 20], 44: [20, 12, 12], 48: [16, 16, 16], 52: [20, 16, 16], 56: [20, 20, 16], 60: [20, 20, 20] };
const TP_PLATES = { 6: [8], 8: [8], 10: [10], 12: [12], 14: [16], 16: [16], 20: [10, 10], 24: [12, 12], 28: [12, 16], 32: [16, 16], 36: [12, 12, 12], 40: [16, 16, 8], 44: [16, 16, 12], 48: [16, 16, 16], 52: [16, 16, 12, 8], 56: [16, 16, 16, 8], 60: [16, 16, 16, 12] };
const TP_PLATE_NAME = { 8: '2x4x96 (8) - Precut Stud', 10: '2x4x120 (10) - Precut Stud', 12: '2x4x144 (12) - Precut Stud', 16: '2x4x196 (16) - Precut Stud' };
function tpSpecs(u) {
  const [w, l] = String(u.size).split('x').map(Number), c = u.c || {};
  const bullet = c.style === 'Silver Bullet', lofted = c.style === 'Lofted', lowWall = c.style === 'Low-Wall Barn', oc = bullet ? 24 : 16;
  const along = (ft) => Math.ceil((ft * 12) / oc) + 1;
  const oc12 = !!(c.floor || (typeof activePackage === 'function' && activePackage(c)?.floor));
  const ser = typeof series === 'function' ? series(c) : 'Basic', loft = lofted ? (l < 16 ? 4 : 8) : 0;
  return {
    w, l, bullet, lofted, lowWall, series: ser,
    joistSize: w >= 10 ? '2x6' : '2x4', joistOc: oc12 ? 12 : 16, joists: oc12 ? null : Math.ceil((l * 12) / 16) + 1,
    band: 2 * (w + l), panels: (w * l) / 32, tracks: w >= 12 && w <= 16 ? 4 : null,
    studOc: oc, studs: 2 * (along(l) + along(w)), plates: 6 * (w + l), wall: lowWall ? 'About 4 ft' : '6 ft',
    loft, loftJoists: loft ? loft / 2 + 1 : 0, loftPanels: loft ? (loft * w) / 32 : 0,
    shield: ser === 'Classic' || ser === 'Elite',
  };
}
/* What the knowledge base says this building cannot be, or needs. */
function tpRuleFlags(u) {
  const s = tpSpecs(u), c = u.c || {}, barn = s.lofted || s.lowWall, doors = [c.door, ...(c.extraDoors || [])].join(' '), out = [];
  /* The owner's rule: a barn can have a roll-up or garage door, so there is no warning for one. */
  if (barn && c.package === 'Dormer Package') out.push(['bad', 'Dormers are not built on a barn', 'roof-rules']);
  if (s.w >= 16) out.push(['todo', '16 wide: built on site, not delivered', 'size-limits']);
  else if (s.w === 14) out.push(['wait', '14 wide: custom order, needs a transport permit', 'size-limits']);
  if (s.l > 40) out.push(['todo', 'Longer than the 40 ft we routinely deliver', 'size-limits']);
  return out;
}
function tpBom(u) {
  if (u.phase === 0) return [];
  const s = tpSpecs(u), out = [], add = (part, label, qty, unit) => out.push({ part, label, qty, unit, role: 'structural' });
  const runners = s.tracks && TP_RUNNERS[s.l];
  if (runners) Object.entries(runners.reduce((m, ft) => ((m[ft] = (m[ft] || 0) + 1), m), {})).sort((a, b) => b[0] - a[0]).forEach(([ft, n]) => add('Floor', `4x6 - ${ft}' Notched 4x6 Runners`, 4 * n, 'each'));
  else add('Floor', '4x6 notched pressure-treated runners', null, 'each');
  add('Floor', `${s.joistSize} pressure-treated floor joists, ${s.joistOc} in on center`, s.joists, 'each');
  add('Floor', `${s.joistSize} pressure-treated band boards`, s.band, 'ft');
  add('Floor', '4x8 floor panels', s.panels, 'sheets');
  add('Floor', '2x4x72 (6) - Precut Stud, pull boards', 2, 'each');
  add('Walls', s.lowWall ? 'Wall studs, short wall' : '2x4x72 (6) - Precut Stud', s.studs, 'each');
  const sides = [TP_PLATES[s.w], TP_PLATES[s.l]];
  if (sides[0] && sides[1]) {
    const count = {};
    sides.forEach((pieces) => pieces.forEach((ft) => (count[ft] = (count[ft] || 0) + 6)));
    Object.entries(count).sort((a, b) => b[0] - a[0]).forEach(([ft, n]) => add('Walls', `${TP_PLATE_NAME[ft]}, plates`, n, 'each'));
  } else add('Walls', 'Top and bottom plates, 2x4', s.plates, 'ft');
  add('Walls', '3" Galvanized Nail', s.studs * 7, 'each');
  if (s.bullet) add('Walls', 'Metal siding screws', Math.round(((25 * (s.w + s.l) - 40) / 250) * 100) / 100, 'bags');
  else add('Walls', '2" Galvanized Nail', 25 * (s.w + s.l) - 40, 'each');
  if (s.loft) {
    add('Loft', `Loft joists, ${s.loft} ft loft`, s.loftJoists, 'each');
    add('Loft', '4x8 loft floor panels', s.loftPanels, 'sheets');
  }
  return out;
}
function tpSpecPanel(u) {
  const s = tpSpecs(u), flags = tpRuleFlags(u), row = (k, v) => odRow(k, v);
  return `<section class="panel tp-specs"><div class="panelhead"><h2>Build specs</h2><span class="od-tag">${esc(u.size.replace('x', ' × '))} · ${esc(s.series)}</span></div>
    ${flags.length ? `<div class="ops-flags tp-rules">${flags.map(([state, text, tip]) => `<span class="ops-flag ${state}">${esc(text)} ${taTip(tip, 'Why?')}</span>`).join('')}</div>` : ''}
    ${row('Floor joists', `${s.joistSize} pressure treated, ${s.joistOc} in on center${s.joists ? ` · <b>${s.joists}</b> joists` : ' · count from the recipe'}`)}
    ${row('Runners', `4x6 notched, pressure treated${s.tracks ? ` · ${s.tracks} tracks` : ''}`)}
    ${row('Floor panels', `<b>${tpNum(s.panels)}</b> sheets of 4x8`)}
    ${row('Wall studs', `${s.studOc} in on center · <b>${s.studs}</b> studs`)}
    ${row('Plates', `<b>${s.plates}</b> ft · three around the building`)}
    ${row('Sidewall height', s.wall)}
    ${s.lofted ? row('Peak', 'About 10 ft inside · 11 ft 4 in outside') : ''}
    ${s.loft ? row('Loft', `${s.loft} ft loft · <b>${s.loftJoists}</b> joists at 24 in on center`) : ''}
    ${row('Radiant barrier', s.shield ? 'TechShield on walls and ceiling' : 'None on this series')}
    <p class="tp-tips">${taTip('roof-rules', 'Heights, lofts and doors')} ${taTip('materials', 'TechShield and insulation')} ${taTip('size-limits', 'Delivery size limits')}</p>
    <p class="source">Worked out from the framing rules in Turbo Assist’s recipe scripts and the knowledge base. The unit’s own recipe is the final word.</p></section>`;
}
function tpBomPanel(u) {
  const lines = tpBom(u), parts = [...new Set(lines.map((x) => x.part))];
  return `<section class="panel tp-bom"><div class="panelhead"><h2>Bill of materials</h2><span class="pill ${TP.consumed[u.id] ? 'good' : 'ghost'}">${TP.consumed[u.id] ? 'Issued at final QC' : 'Framing'}</span></div>
    ${lines.length ? parts.map((p) => `<h4>${p}</h4><ul class="tp-lines">${lines.filter((x) => x.part === p).map((x) => `<li><span class="grow">${esc(x.label)}</span><b>${x.qty == null ? 'from the recipe' : `×${tpNum(x.qty)} ${x.unit}`}</b><i>${x.role}</i></li>`).join('')}</ul>`).join('') : '<p class="of-soft">No recipe lines on this unit.</p>'}
    <p class="source">${lines.length ? 'The framing lines, figured from the size by the rules in Turbo Assist’s recipe scripts. Siding, roofing, paint and options come from the unit’s recipe in Turbo Assist. No costs are shown here.' : 'Turbo Assist resolves the recipe when the build starts.'}</p>
    <p class="tp-consume">${TP.consumed[u.id] ? `Consumed when this building reached final QC · ${tpStamp(TP.consumed[u.id])}` : TP.qc.consume ? 'Materials consumption is on. Final QA issues recipe materials.' : 'Materials consumption is off. Final QA does not issue recipe materials.'}</p></section>`;
}
function tpIssuePanel(u) {
  const list = TP.issued[u.id] || [], cats = [...new Set(TP.mats.map((m) => m.cat))], can = u.phase >= 1;
  return `<section class="panel tp-issue"><h2>Issue material</h2>
    ${can ? `<div class="tp-issuerow"><label>Material<select id="tp-mat"><option value="">Select…</option>${cats.map((c) => `<optgroup label="${esc(c)}">${TP.mats.filter((m) => m.cat === c).map((m) => `<option value="${m.code}">${esc(m.name)} · ${tpNum(m.on)} ${m.unit} on hand</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label class="tp-qty">Qty<input id="tp-qty" type="number" min="0" step="any" inputmode="decimal"></label><button type="button" class="primary small" onclick="tpIssue('${u.id}')">Issue</button></div>
      <p class="lg-bad" id="tp-isserr" hidden></p>` : '<p class="of-soft">Material is issued once the build has started.</p>'}
    ${list.length ? `<ul class="tp-lines">${list.slice().reverse().slice(0, 8).map((x) => `<li><span class="grow">${esc(x.name)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span><b>${tpNum(x.qty)} ${x.unit}</b></li>`).join('')}</ul>${list.length > 8 ? `<p class="source">${list.length - 8} earlier lines not shown.</p>` : ''}` : ''}
    <p class="source">What is on hand is made up. The names and categories are from Turbo Assist’s material list.</p></section>`;
}
function tpIssue(id) {
  const code = $('#tp-mat').value, qty = parseFloat($('#tp-qty').value), err = $('#tp-isserr'), m = TP.mats.find((x) => x.code === code);
  const fail = (text) => ((err.textContent = text), (err.hidden = false));
  if (!m) return fail('Pick a material');
  if (!qty || qty <= 0) return fail('Enter a quantity');
  if (m.on < qty) return fail(`Insufficient on-hand quantity (${tpNum(m.on)} available, ${tpNum(qty)} requested).`);
  m.on = Math.round((m.on - qty) * 100) / 100;
  (TP.issued[id] ||= []).push({ name: m.name, qty, unit: m.unit, at: Date.now(), note: '' });
  render();
  toast(`Issued ${tpNum(qty)} ${m.unit} of ${m.name}.`);
}
/* Ship from plant. In Turbo Assist the button takes a built unit off the board. Here a building
   leaves the board when Logistics takes it, so the section shows where that hand-off stands. */
function tpShipPanel(u) {
  const lg = typeof lgUnit === 'function' && lgUnit(u.id), built = u.phase === PR_DONE, sale = u.src === 'sale' ? u.ref : null;
  const load = lg && lg.loadId && typeof lgLoad === 'function' ? lgLoad(lg.loadId) : null;
  const where = !built ? 'The build has to be complete, with plant QC’s sign-off, before it can ship.'
    : load ? `On Logistics load ${esc(load.id)}${load.date && typeof lgDay === 'function' ? ' · ' + esc(lgDay(load.date)) : ''}. It leaves the board when the truck leaves.`
    : lg ? 'Logistics can put it on a load now.'
    : sale ? 'Built and signed off. The office releases it for delivery, then Logistics can move it.' : 'Built and signed off. It shows on the Logistics board as soon as that side is opened.';
  const act = !built ? '<button type="button" class="primary" disabled>Finish build first</button>'
    : lg ? `<button type="button" class="primary" onclick="${load && typeof lgOpen === 'function' ? `lgOpen('${load.id}')` : "go('logi')"}">Ship from plant ${icon('arrow', 16)}</button>`
    : sale && typeof ofOpen === 'function' ? `<button type="button" class="secondary" onclick="ofOpen('${u.id}')">Open it in the Office ${icon('arrow', 16)}</button>` : `<button type="button" class="primary" onclick="go('logi')">Ship from plant ${icon('arrow', 16)}</button>`;
  return `<section class="panel tp-ship"><div class="panelhead"><h2>Ship from plant</h2><span class="pill ${built ? 'good' : 'ghost'}">${built ? 'Built' : 'Not built yet'}</span></div>
    <p class="of-soft">Marks the unit shipped and takes it off the active Kanban. Logistics / delivery can be scheduled later.</p><p>${where}</p><div class="actions">${act}</div></section>`;
}
function tpPayLine(u) {
  const list = TP.pay[u.id] || [];
  return list.length ? `<span class="ops-flag wait">On the labor pay list since ${tpStamp(list[0].at)}</span>` : '';
}
{
  const unitPage = OPS_SCREENS['pr-unit'];
  OPS_SCREENS['pr-unit'] = prUnitPage = function () {
    const html = unitPage(), u = prUnit(PR.id);
    if (!u) {
      const when = TP.shipped[PR.id], lg = typeof lgUnit === 'function' && lgUnit(PR.id);
      return when || lg ? html + `<section class="panel tp-ship" style="margin-top:16px"><div class="panelhead"><h2>Ship from plant</h2><span class="pill good">Shipped</span></div><p>${esc(tpShown(PR.id))} · Shipped${when ? ' ' + tpStamp(when) : ''}. Delivery is not required to leave the board.</p><div class="actions">${button('Open Logistics ' + icon('arrow', 16), "go('logi')", 'secondary')}</div></section>` : html;
    }
    const extra = `<div class="od-grid tp-unitx"><div class="od-col">${tpSpecPanel(u)}${tpShipPanel(u)}</div><div class="od-col">${tpBomPanel(u)}${tpIssuePanel(u)}</div></div>`;
    let out = tpBefore(html, '<details class="ops-notes"', extra);
    out = out.replace(/<li><b>Not drawn here<\/b>[^<]*<\/li>/, '');
    /* Turbo Assist's own line under the load picker, and the pay list flag. */
    if (!prLoadOf(u.id)) out = out.replace('</select></label>\n        <div class="actions">', '</select></label><p class="tp-hint">Not assigned. Ops assigns a letter before sending the load to the plant.</p>\n        <div class="actions">');
    const pay = tpPayLine(u);
    return pay ? out.replace('<div class="ops-flags">', '<div class="ops-flags">' + pay) : out;
  };
}

/* ---------- The board ---------- */
PR_PATHS.splice(3, 0, 'Finance'); /* Turbo Assist's filter row: All sale paths, Stock, Cash, Finance, RTO */
const TP_PATH_LONG = { Stock: 'Inventory (no sale yet)', Cash: 'Cash sale', Finance: 'Finance', RTO: 'Rent-to-own' };
{
  const card = prCard;
  prCard = function (u) {
    const html = card(u);
    return u.plantSerial ? html.replace(`<small class="serial">${esc(u.serial)}</small>`, `<small class="serial"><span class="tp-serial">${esc(u.plantSerial)}</span> · ${esc(u.id)}</small>`) : html;
  };
  const cols = prBoardCols;
  prBoardCols = function () {
    return cols().replace(/<header><strong>([^<]+)<\/strong>/g, (all, name) => {
      const p = TP.phases.find((x) => x.name === name), marks = p ? [p.initial && 'initial', p.complete && 'build complete', p.pay && 'pay'].filter(Boolean) : [];
      return marks.length ? `<header><strong>${name}<small class="tp-mark">${marks.join(' · ')}</small></strong>` : all;
    });
  };
  const board = OPS_SCREENS.prod;
  OPS_SCREENS.prod = prBoard = function () {
    let html = board();
    html = html.replace(/(<div class="today ops-tiles)(">[\s\S]*?)(<\/div>\s*<div class="qc-filter">)/, (all, a, b, c) => `${a} tp-tiles${b}<button type="button" class="tp-reqtile" onclick="tpRequestForm()" title="Request materials without leaving the board"><strong>+</strong><span>Inventory request</span></button>${c}`);
    html = tpBefore(html, '<div class="qc-filter">', `<div class="tp-boardlinks"><button type="button" class="chipbtn" onclick="go('pr-phases')">${icon('sliders', 16)} Phase settings</button><span>${TP.qc.consume ? 'Materials consumption is on. Final QA issues recipe materials.' : 'Materials consumption is off. Final QA does not issue recipe materials.'}</span></div>`);
    if (TP.requests.length) html = tpBefore(html, '<div id="pr-cols">', `<section class="panel tp-reqs"><div class="panelhead"><h2>Inventory requests <small>sent to purchasing</small></h2></div>${TP.requests.slice().reverse().map((r) => `<div class="tp-req"><strong>${esc(r.po)}</strong><span class="grow">${r.items.map((x) => `${tpNum(x.qty)} ${esc(x.unit)} ${esc(x.name)}`).join(' · ')}${r.note ? `${r.items.length ? ' · ' : ''}${esc(r.note)}` : ''}</span><small>${tpStamp(r.at)}</small></div>`).join('')}</section>`);
    return html.replace(/<li>The order number shown as the serial\.[^<]*<\/li>/, '');
  };
  const rows = prRosterRows;
  prRosterRows = function () {
    const by = Object.fromEntries(prUnits().map((u) => [u.id, u]));
    return rows().replace(/<article class="ops-row">[\s\S]*?<\/article>/g, (row) => {
      const u = by[(/prOpen\('([^']+)'\)/.exec(row) || [])[1]];
      if (!u) return row;
      const plant = tpPlantOf(u), started = TP.started[u.id], done = u.phase === PR_DONE && u.qc?.signoff?.at;
      return row.replace('</p><div class="ops-flags">', `</p><p class="tp-rosterx">${TP_PATH_LONG[u.path] || esc(u.path)} · Plant ${tpPlantCode(plant)} · ${esc(plant.name)}${started ? ` · build started ${tpStamp(started)}` : ''}${done ? ` · build completed ${tpStamp(done)}` : ''}</p><div class="ops-flags">${tpPayLine(u)}`);
    });
  };
}

/* ---------- Inventory request (the "+" tile on Turbo Assist's board) ---------- */
function tpRequestForm() {
  const opts = TP.mats.map((m) => `<option value="${m.code}">${esc(m.name)}</option>`).join('');
  modal('Inventory request', `<p class="source">Stays on the build pipeline.</p>
    <label class="field">Plant<select id="tp-rq-plant">${PLANTS.map((p) => `<option value="${p.id}">${tpPlantCode(p)} · ${esc(p.name)}</option>`).join('')}</select></label>
    <label class="field">Note<textarea id="tp-rq-note" rows="2" placeholder="We're out of siding / need a pallet before Friday"></textarea></label>
    <div class="tp-rqitems">${[0, 1].map((i) => `<div class="tp-issuerow"><label>Item<select id="tp-rq-m${i}"><option value="">None</option>${opts}</select></label><label class="tp-qty">Qty<input id="tp-rq-q${i}" type="number" min="0" step="any" inputmode="decimal"></label></div>`).join('')}</div>
    <p class="lg-bad" id="tp-rq-err" hidden></p>
    <div class="actions">${button('Send request', 'tpRequestSend()')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function tpRequestSend() {
  const note = $('#tp-rq-note').value.trim(), err = $('#tp-rq-err'), items = [];
  for (const i of [0, 1]) {
    const m = TP.mats.find((x) => x.code === $('#tp-rq-m' + i).value), qty = parseFloat($('#tp-rq-q' + i).value);
    if (m && qty > 0) items.push({ name: m.name, unit: m.unit, qty });
  }
  if (!$('#tp-rq-plant').value) return (err.textContent = 'Select a plant.'), (err.hidden = false);
  if (!note && !items.length) return (err.textContent = 'Add a note or at least one item.'), (err.hidden = false);
  const po = 'PO-' + ++TP.reqSeq;
  TP.requests.push({ po, plant: $('#tp-rq-plant').value, note, items, at: Date.now() });
  closeModal();
  render();
  toast(`Sent inventory request ${po}. Purchasing will review.`);
}

/* ---------- Production loads ----------
   Turbo Assist: a letter from A to ZZ, open → dispatched → closed, and closing frees the letter. */
function tpNextCode() {
  const used = new Set(PR.loads.map((l) => l.id));
  for (let i = 0; i < 702; i++) if (!used.has(prCode(i))) return prCode(i);
  return null;
}
prLoadNew = function () {
  const code = tpNextCode();
  if (!code) return toast('All load codes A–ZZ are in use. Close a finished load to reuse a letter.');
  PR.loads.push({ id: code, alias: '', units: [], state: 'open', made: Date.now(), footage: '' });
  prLoadForm(code);
  toast(`Opened load ${code}`);
};
{
  const form = prLoadForm;
  prLoadForm = function (code) {
    form(code);
    const l = prLoad(code), fields = document.querySelector('.modal .fields');
    if (l && fields) fields.insertAdjacentHTML('beforeend', `<label class="tp-wide">Footage notes<input id="tp-footage" maxlength="80" value="${esc(l.footage || '')}" placeholder="Ops footage (freeform)"></label>`);
  };
  const save = prLoadSave;
  prLoadSave = function (code) {
    const l = prLoad(code), el = document.getElementById('tp-footage');
    if (l && el) l.footage = el.value.trim();
    save(code);
  };
  const dispatch = prLoadDispatch;
  prLoadDispatch = function (code) {
    const l = prLoad(code);
    if (!l) return;
    if (l.state !== 'open') return toast(`Load ${code} is already ${l.state}.`);
    if (!l.units.length) return toast(`Load ${code} has no units assigned.`);
    dispatch(code);
    /* The note Turbo Assist writes on each move. */
    for (const id of l.units) for (const h of PR.hist[id] || []) if (h.note === `Load ${code} sent to the floor`) h.note = `Load ${code} sent to plant`;
    toast(`Load ${code} sent to plant`);
  };
  const loadCard = prLoadCard;
  prLoadCard = function (l) {
    const meta = `<p class="tp-loadmeta">Status in Turbo Assist: ${l.state}${l.footage ? ` · Footage: ${esc(l.footage)}` : ''}</p>`;
    let html = tpBefore(loadCard(l), '<div class="pr-loadbar">', meta);
    if (l.state === 'dispatched') html = html.replace(/<\/div><\/article>$/, `<button type="button" class="secondary small" onclick="tpLoadClose('${l.id}')">Close (free letter)</button></div></article>`);
    return html;
  };
  const strip = prLoadStrip;
  prLoadStrip = function () {
    /* A load whose buildings have all gone with Logistics leaves the strip; it still holds its letter until it is closed. */
    const done = PR.loads.filter((l) => prLoadDone(l)), closed = TP.closedLoads;
    const more = `${done.map((l) => `<p class="tp-loaddone"><span class="lg-code">${esc(l.id)}</span><span class="grow"><strong>${l.alias ? esc(l.alias) : 'Load ' + esc(l.id)}</strong> · dispatched · every building has gone with Logistics</span><button type="button" class="secondary small" onclick="tpLoadClose('${l.id}')">Close (free letter)</button></p>`).join('')}
      ${closed.length ? `<details class="tp-closed"><summary>${tpPlural(closed.length, 'closed load')}</summary>${closed.slice().reverse().map((l) => `<p>Load ${esc(l.id)}${l.alias ? ' · ' + esc(l.alias) : ''} · ${tpPlural(l.units.length, 'building')} · closed ${tpStamp(l.closedAt)}</p>`).join('')}</details>` : ''}`;
    return strip().replace(/<\/section>$/, more + '</section>');
  };
}
function tpLoadClose(code) {
  const l = prLoad(code);
  if (!l) return toast(`Load ${code} is already closed.`);
  l.state = 'closed';
  l.closedAt = Date.now();
  PR.loads = PR.loads.filter((x) => x !== l);
  TP.closedLoads.push(l);
  render();
  toast(`Load ${code} closed — letter is free`);
}

/* ---------- Phase settings ---------- */
function tpPayToggle(i) {
  const p = TP.phases[i];
  p.pay = !p.pay;
  render();
  toast(p.pay ? `${p.name} is a pay trigger now.` : `${p.name} is no longer a pay trigger.`);
}
function tpPhasesPage() {
  const units = prUnits(), onList = Object.keys(TP.pay).length;
  return `<button class="link backlink" onclick="go('prod')">${icon('back', 18)} Board</button>
  ${head('Production · ' + esc(PLANTS[0].name), 'Phase settings', 'The nine phases a building moves through, and what Turbo Assist keeps on each one.')}
  <section class="panel tp-phases">${TP.phases.map((p, i) => `<div class="tp-phase"><span class="tp-updown"><button type="button" disabled title="Move earlier" aria-label="Move earlier">↑</button><button type="button" disabled title="Move later" aria-label="Move later">↓</button></span>
    <div class="grow"><strong>${p.name}</strong><span class="tp-badges">${p.initial ? '<span class="pill blue">Initial</span>' : ''}${p.complete ? '<span class="pill good">Build complete</span>' : ''}${p.pay ? '<span class="pill amber">Pay trigger</span>' : ''}</span>
      <small><code>${p.key}</code> · seq ${p.seq} · ${tpPlural(units.filter((u) => u.phase === i).length, 'building')} here now · moved by anyone tagged <code>${p.tag}</code></small></div>
    <button type="button" class="secondary small" onclick="tpPayToggle(${i})">${p.pay ? 'Clear pay trigger' : 'Set pay trigger'}</button></div>`).join('')}</section>
  <div class="grid2" style="margin-top:20px">
    <section class="panel"><h2>Who may move a building</h2><ul class="tp-ul"><li>A floor worker moves a building only into or out of a phase they are tagged for.</li><li>A supervisor or the plant manager moves any phase.</li><li>With no phase tag, the board is view only.</li></ul><p class="source">This preview has no logins: the plant manager moves every building.</p></section>
    <section class="panel"><h2>Pay trigger</h2><p>Moving a building into a pay-trigger phase puts it on the labor pay list. More than one phase can be flagged. When none is, Turbo Assist uses the build-complete phase.</p><p><strong>${tpPlural(onList, 'building')}</strong> on the labor pay list in this preview.</p><p class="source">Pay amounts and rates are not shown here.</p></section>
  </div>
  <p class="lede-small" style="margin-top:16px">Turbo Assist’s Phase settings can also rename a phase (“Save name”), move it (“Move earlier”, “Move later”), choose which phase is first (“Set initial”) and which finishes the build (“Set build complete”), remove one (“Remove”) and add one (“Add phase”). This preview keeps the nine phases fixed, so those are switched off here.</p>
  ${opsNotes([
    ['Phase settings', 'Build pipeline → Phase settings (<code>ManufacturingBuildPipelinePhaseEditor</code>). Exactly one Initial and one Build complete phase are required.'],
    ['Pay trigger', '<code>is_pay_trigger</code> on the phase (“Set pay trigger” / “Clear pay trigger”); the default is picked by <code>pickDefaultPayTriggerPhaseId</code>. The pay list itself is <code>listLaborPayList</code>.'],
    ['Who may move', 'Phase tags like <code>phase:flooring</code> (<code>canMoveUnitToPhase</code>): “Locked — you can’t move a unit out of … into …” when the tag is missing.'],
  ], ['The count of buildings on the pay list. Turbo Assist’s list also carries the payout, which stays out of this public preview.'])}`;
}
OPS_SCREENS['pr-phases'] = tpPhasesPage;
{
  const detail = opsDetail;
  opsDetail = function (page) {
    return page === 'pr-phases' ? ['prod', 'Board', 'Phase settings'] : detail(page);
  };
}

/* ---------- Plant QC: final QC ---------- */
const TP_SEVERITY = ['Informational', 'Minor', 'Moderate', 'Major', 'Critical']; /* SEVERITIES */
const TP_TAGS = ['QC failure', 'Build book candidate', 'Good example', 'Bad example', 'Spec candidate', 'Rework', 'Cosmetic', 'Structural', 'Recurring', 'Training approved', 'Training excluded']; /* STARTER_TAGS */
const tpInitialsOf = (name) => String(name || '').split(/\s+/).map((w) => w[0] || '').join('');
/* normalizeFinalQcInitials: letters only, upper case, two to four of them. */
function tpInitials(value) {
  const letters = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length < 2 || letters.length > 4 ? null : letters;
}
const tpSignoffText = (initials) => `Final QC Passed - Checked by ${initials}`; /* finalQcSignoff */
/* The part of the building, from Turbo Assist's starter list: Floor, Wall, Roof, Door, Window, Loft (STARTER_COMPONENT_NAMES). */
function tpPart(r) {
  const text = `${r.item} ${ITEM[r.itemId]?.area || ''}`.toLowerCase();
  return /loft/.test(text) ? 'Loft' : /window/.test(text) ? 'Window' : /door/.test(text) ? 'Door' : /roof/.test(text) ? 'Roof' : /floor|runner|joist/.test(text) ? 'Floor' : 'Wall';
}
/* The words Turbo Assist uses for one checklist item at final QC. */
function tpResultLabel(b, id) {
  const r = b.results[QC]?.answers?.[id], open = Q.rework.some((x) => x.serial === b.serial && x.itemId === id && x.step < 2);
  if (open) return 'Open failure';
  return r === 'fail' || Q.rework.some((x) => x.serial === b.serial && x.itemId === id) ? 'Failed, then fixed' : r === 'na' ? 'Not applicable' : r === 'pass' ? 'Passed' : 'Not marked';
}
/* ... and for one section. */
function tpSectionLabel(b, s) {
  const r = b.results[QC];
  if (!r) return 'Not submitted';
  const open = openRework(b).filter((x) => ITEM[x.itemId]?.section === s.section).length, any = Q.rework.some((x) => x.serial === b.serial && ITEM[x.itemId]?.section === s.section);
  return open ? `Submitted · ${open} open ${open === 1 ? 'failure' : 'failures'}` : any ? 'Submitted · failures corrected' : 'Passed';
}
/* ... and for the whole report, as the history list words it. */
function tpReportLabel(b) {
  const st = qcStatus(b), n = openRework(b).length;
  return st === 'Ready to ship' ? 'Ready for delivery' : n ? `${n} uncorrected` : st === 'Needs sign-off' ? 'Waiting on final QC' : st === 'In QA' ? 'Not submitted' : st === 'On hold' ? 'On hold' : 'Awaiting QC';
}
function tpBounce(b) {
  if (!b.readyFinal) return;
  (b.readyHistory ||= []).push(b.readyFinal);
  delete b.readyFinal;
}
function tpReadyFinal(serial) {
  const b = build(serial);
  if (!b || b.stage === LAST) return toast('Final QC already passed this building.');
  if (b.results[QC]?.result !== 'pass') return toast('Submit the inspection before marking it ready for final certification.');
  if (openRework(b).length) return toast('Fix the open failures before this can be ready for final certification.');
  b.readyFinal = { by: me().name, at: Date.now() };
  record(serial, QC, 'QC marked this building ready for final QC.');
  taNotify({ to: 'qc', title: `Ready for final certification · ${tpShown(serial)}`, body: `${tpShown(serial)} is ready for final certification. Marked by ${me().name}.`, go: `Q.signSerial='${serial}';go('qc-signoff')` });
  render();
  toast(`Ready for final certification · ${me().name}.`);
}
function tpFinalState(b) {
  const n = openRework(b).length, r = b.results[QC];
  if (b.stage === LAST) return b.signoff?.text || 'Final QC passed this building. It is ready to ship.';
  if (n) return `${n} open ${n === 1 ? 'failure' : 'failures'}. QC fixes them, then marks the building ready for final certification again.`;
  if (r?.result === 'pass') return b.readyFinal ? `Ready for final certification · ${b.readyFinal.by}.` : 'QC passed this building. It is waiting on final QC.';
  return 'The inspection is not finished.';
}
function tpFinalPanel(b) {
  const r = b.results[QC], signed = b.stage === LAST, canFail = !signed && r?.result === 'pass' && !openRework(b).length;
  /* Every item in Turbo Assist's words, once there is item detail to show (a sample record has none). */
  const detail = !!r?.answers || Q.rework.some((x) => x.serial === b.serial);
  const sections = !detail ? '' : CHECK[QC].map((s) => {
    const items = s.items.filter((i) => !skipReason(b, i));
    if (!items.length) return '';
    return `<details class="tp-sec"><summary><strong>${esc(s.section)}</strong><span>${tpSectionLabel(b, s)}</span></summary><ul>${items.map((i) => `<li><span class="grow">${esc(askText(b, i))}</span><b class="tp-res ${tpResultLabel(b, i.id).split(/[ ,]/)[0].toLowerCase()}">${tpResultLabel(b, i.id)}</b></li>`).join('')}</ul></details>`;
  }).join('');
  return `<section class="panel tp-final" style="margin-top:20px"><div class="panelhead"><h2>Final QC</h2><span class="pill ${signed ? 'good' : openRework(b).length ? 'red' : 'amber'}">${tpReportLabel(b)}</span></div>
    <p class="muted">Fail anything that still needs work. That sends the building back to QC and keeps who marked it ready for certification. Final QC Pass signs the building and tells delivery.</p>
    <p class="tp-state">${esc(tpFinalState(b))}</p>
    ${b.readyHistory?.length ? `<p class="source">Ready for final certification was recorded for ${b.readyHistory.map((m) => esc(m.by)).join(', ')}.</p>` : ''}
    ${sections ? `<details class="tp-all"><summary>Every item, as final QC sees it</summary><div class="tp-seclist">${sections}</div></details>` : ''}
    ${canFail ? `<div class="actions">${button('Fail an item again', `tpFinalFailForm('${b.serial}')`, 'secondary')}</div>` : ''}
    <p class="source">In Turbo Assist only someone with the final QC role can pass a building. This preview has no logins.</p></section>`;
}
function tpFinalFailForm(serial) {
  const b = build(serial), groups = CHECK[QC].map((s) => [s.section, s.items.filter((i) => !skipReason(b, i))]).filter(([, items]) => items.length);
  modal('Send it back to QC', `<p class="muted">Fail anything that still needs work. That sends the building back to QC and keeps who marked it ready for certification.</p>
    <label class="field">Which item<select id="tp-ff-item">${groups.map(([name, items]) => `<optgroup label="${esc(name)}">${items.map((i) => `<option value="${i.id}">${esc(askText(b, i))}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label class="field">What kind of problem<select id="tp-ff-defect">${QC_CONFIG.defectTypes.map((d) => `<option>${esc(d)}</option>`).join('')}</select></label>
    <label class="field">What still needs work<textarea id="tp-ff-note" rows="2" placeholder="Where it is and what to fix"></textarea></label>
    <div class="actions">${button('Fail this item', `tpFinalFail('${serial}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function tpFinalFail(serial) {
  const b = build(serial), id = $('#tp-ff-item').value, it = ITEM[id], note = $('#tp-ff-note').value.trim(), defect = $('#tp-ff-defect').value;
  if (!b || !it) return;
  if (TP.qc.notes && !note) return toast('Add a note: what still needs work.');
  Q.rework.push({ id: 'RW-' + ++Q.rwSeq, serial, stage: QC, itemId: id, item: it.text, ask: askText(b, it), defect, note, photo: null, assigned: null, step: 0, openedAt: Date.now(), by: me().name, final: true, tags: ['QC failure'] });
  b.results[QC] = { ...b.results[QC], result: 'fail', firstPass: false };
  if (b.results[QC].answers) b.results[QC].answers[id] = 'fail';
  tpBounce(b);
  record(serial, QC, `Final QC failed: ${askText(b, it)} (${defect}). Sent back to QC`);
  dealerNote(b, 'final QC sent it back to be fixed');
  taNotify({ to: 'qc', title: `QC sent back · ${tpShown(serial)}`, body: `Final QC sent ${tpShown(serial)} back to be fixed. ${note || it.text}`, go: `openBuild('${serial}')` });
  closeModal();
  render();
  toast(`Final QC sent ${tpShown(serial)} back to be fixed.`);
}
/* What a final QC pass sets off: the sign-off line, the board's history, the materials, and a
   notice to each side that acts on it. */
function tpAfterFinalQc(b, initials) {
  const id = b.serial, at = b.signoff.at, text = tpSignoffText(initials), shown = tpShown(id), signer = b.signoff.by;
  Object.assign(b.signoff, { initials, text });
  record(id, QC, text, at);
  (PR.hist[id] ||= []).push({ from: PR_QA, to: PR_DONE, at, note: text });
  if (TP.qc.consume && !TP.consumed[id]) {
    const u = prUnit(id);
    if (u) {
      TP.consumed[id] = at;
      for (const x of tpBom(u)) if (x.qty != null) (TP.issued[id] ||= []).push({ name: x.label, qty: x.qty, unit: x.unit, at, note: 'Consumed when this building reached final QC.' });
    }
  }
  const sale = S.sales.find((s) => s.id === (b.saleId || id)), body = `${shown} passed final QC and is ready for delivery. Final QC by ${signer}.`, title = `Ready for delivery · ${shown}`;
  taNotify({ to: 'prod', title: `${shown} marked build complete`, body: `${text}. The office releases it and Logistics moves it.`, go: `prOpen('${id}')` });
  taNotify({ to: 'office', title, body, saleId: sale?.id, go: sale ? `ofOpen('${sale.id}')` : "go('of-requests')" });
  taNotify({ to: 'logi', title, body, go: "go('logi')" });
  if (sale) taNotify({ to: 'sales', title, body, saleId: sale.id, go: `openSale('${sale.id}')` });
}
{
  const sign = doSignoff;
  doSignoff = function () {
    const b = build(Q.signSerial), field = document.getElementById('tp-initials');
    const initials = tpInitials(field ? field.value : tpInitialsOf(me().name));
    if (field && !initials) return toast('Sign with two to four initials.');
    const before = b && b.stage === LAST;
    sign();
    if (!b || before || b.stage !== LAST) return;
    tpAfterFinalQc(b, initials || tpInitials(tpInitialsOf(me().name) + 'QC') || 'QC');
    render(); /* the screen was drawn before the sign-off line was added */
  };
  const ask = signModal;
  signModal = function () {
    ask();
    document.querySelector('.modal .actions')?.insertAdjacentHTML('beforebegin', `<label class="field tp-initials">Sign final QC with my initials<input id="tp-initials" maxlength="4" autocomplete="off" placeholder="Initials" value="${esc(tpInitialsOf(me().name).slice(0, 4))}" oninput="this.value=this.value.toUpperCase()"></label>`);
  };
  const detail = signDetail;
  signDetail = function (b) {
    const html = detail(b), ps = tpSerial(b.serial);
    const out = tpBefore(html, '<section class="panel" style="margin-top:20px">', tpFinalPanel(b), true);
    return ps ? out.replace(`<p class="lede">${esc(b.serial)} · `, `<p class="lede">${esc(ps)} · ${esc(b.serial)} · `) : out;
  };
  const passed = passedPanel;
  passedPanel = function (b) {
    const line = b.readyFinal ? `<p class="tp-state">Ready for final certification · ${esc(b.readyFinal.by)}.</p>` : `<div class="actions">${button('Ready for final certification', `tpReadyFinal('${b.serial}')`, 'secondary')}</div>`;
    return tpBefore(passed(b), '<p><button class="link" onclick="reopenModal()">', line);
  };
  const again = reopen;
  reopen = function () {
    const b = build(Q.serial);
    if (b) tpBounce(b);
    again();
  };
  const page = QC_SCREENS['qc-inspect'];
  QC_SCREENS['qc-inspect'] = inspect = function () {
    const html = page(), b = build(Q.serial), ps = b && tpSerial(b.serial);
    return ps ? html.replace(`<p class="lede">${esc(b.serial)} · `, `<p class="lede">${esc(ps)} · ${esc(b.serial)} · `) : html;
  };
  const card = floorCard;
  floorCard = function (b) {
    const ps = tpSerial(b.serial);
    return ps ? card(b).replace(`<h3>${esc(b.serial)}</h3>`, `<h3>${esc(b.serial)}</h3><small class="serial tp-ps">Plant serial ${esc(ps)}</small>`) : card(b);
  };
}

/* ---------- Plant QC: a failure ----------
   Up to three photos (QC_FAIL_PHOTO_CAP), an optional severity, and the two org settings that
   decide whether a photo and a note are required. */
missing = function (a, id) {
  if (a?.r !== 'fail') return [];
  return [!a.defect && 'a defect type', TP.qc.notes && !(a.note || '').trim() && 'a note', TP.qc.photos && needsPhoto(id) && !a.photo && 'a photo'].filter(Boolean);
};
function tpSetSeverity(id, n) {
  const a = draftOf(build(Q.serial)).answers[id];
  a.severity = a.severity === TP_SEVERITY[n] ? null : TP_SEVERITY[n];
  render();
}
/* Photos are shrunk the way Turbo Assist shrinks them: 1280 px on the long edge, JPEG at 0.75. */
function tpAddPhoto(id, input) {
  const file = input.files?.[0], serial = Q.serial;
  if (!file) return;
  const a = draftOf(build(serial)).answers[id];
  if ((a.photo ? 1 : 0) + (a.more?.length || 0) >= 3) return toast('3 photos');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      (a.more ||= []).push(c.toDataURL('image/jpeg', 0.75));
      if (S.page === 'qc-inspect' && Q.serial === serial) render();
    };
    img.onerror = () => toast('That file is not a photo. Try again.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function tpDropPhoto(id, k) {
  draftOf(build(Q.serial)).answers[id].more.splice(k, 1);
  render();
}
{
  const form = failForm;
  failForm = function (i, a) {
    const more = a.more || [], count = (a.photo ? 1 : 0) + more.length;
    const extra = `<div class="tp-sev"><small>How bad is it? Optional.</small><div class="chiprow">${TP_SEVERITY.map((s, n) => `<button class="chipbtn${a.severity === s ? ' on' : ''}" aria-pressed="${a.severity === s}" onclick="tpSetSeverity('${i.id}',${n})">${s}</button>`).join('')}</div></div>
      ${a.photo ? `<div class="qc-photo tp-photos">${more.map((src, k) => `<span class="tp-ph"><img src="${src}" alt="Failure photo ${k + 2}"><button type="button" class="link inline" onclick="tpDropPhoto('${i.id}',${k})">Remove</button></span>`).join('')}
        ${count < 3 ? `<label class="secondary small">${icon('plus', 16)} Add photo<input id="more-${i.id}" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onchange="tpAddPhoto('${i.id}',this)"></label><small>${count} of 3 photos</small>` : '<small>3 photos</small>'}</div>` : ''}
      ${!TP.qc.photos && needsPhoto(i.id) ? '<small>Failure photos are optional right now.</small>' : ''}`;
    return tpBefore(form(i, a), '<span class="qc-missing"', extra);
  };
  const row = itemRow;
  itemRow = function (i, a) {
    const word = { pass: 'Passed', fail: 'Failed', na: 'Not applicable' }[a?.r];
    return word ? row(i, a).replace('</p>', ` <span class="tp-res ${a.r === 'pass' ? 'passed' : a.r === 'fail' ? 'failed' : 'not'}">${word}</span></p>`) : row(i, a);
  };
  const finish = finishInspection;
  finishInspection = function () {
    const b = build(Q.serial);
    if (!b) return finish();
    const ans = draftOf(b).answers, keep = {};
    for (const [id, a] of Object.entries(ans)) if (a?.r === 'fail') (a.note = a.note || ''), (keep[id] = { severity: a.severity || null, more: (a.more || []).slice() });
    const had = new Set(Q.rework.map((r) => r.id));
    finish();
    let added = 0;
    for (const r of Q.rework) if (!had.has(r.id) && r.serial === b.serial && keep[r.itemId]) Object.assign(r, { severity: keep[r.itemId].severity, photos: keep[r.itemId].more, tags: ['QC failure'] }), added++;
    if (!added) return;
    tpBounce(b);
    render(); /* the failures were drawn before their severity and photos were attached */
  };
}
/* The correction: what was done, on top of who did it. */
{
  const who = fixedModal;
  fixedModal = function (id) {
    who(id);
    document.querySelector('.modal .qc-pick')?.insertAdjacentHTML('beforebegin', `<label class="field">Corrective action<textarea id="tp-fix" rows="2" placeholder="What was done to correct this"></textarea></label>`);
  };
  const fixed = markFixed;
  markFixed = function (id, n) {
    const text = document.getElementById('tp-fix')?.value.trim();
    if (text) rw(id).fix = text;
    fixed(id, n);
  };
}
function tpTagsForm(id) {
  const r = rw(id), on = r.tags || ['QC failure'];
  modal('Tags on this failure', `<p class="muted">${esc(r.item)}</p><div class="chiprow tp-tagpick">${TP_TAGS.map((t) => `<button type="button" class="chipbtn${on.includes(t) ? ' on' : ''}" aria-pressed="${on.includes(t)}" onclick="this.classList.toggle('on');this.setAttribute('aria-pressed',this.classList.contains('on'))">${t}</button>`).join('')}</div>
    <p class="source">One failure can carry several tags. “Build book candidate” means suggested for the build book, not approved.</p>
    <div class="actions">${button('Save tags', `tpTagsSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function tpTagsSave(id) {
  rw(id).tags = [...document.querySelectorAll('.tp-tagpick .chipbtn.on')].map((b) => b.textContent);
  closeModal();
  render();
}
/* renderQcFailureSubject: a missing value prints as a dash. */
function tpSubject(template, f) {
  const out = (String(template).trim() || 'QC failure · {{serial}} · {{plant}} · {{customer}}').replace(/\{\{\s*(serial|plant|customer|model|item|category|date)\s*\}\}/gi, (m, key) => String(f[key.toLowerCase()] || '').trim() || '—');
  return out.replace(/\s+/g, ' ').trim() || 'QC failure';
}
function tpMailFields(r) {
  const b = build(r.serial);
  return { serial: tpShown(r.serial), plant: PLANTS[0].name, customer: b?.customer || '', model: b ? `${b.size} ${b.style}` : '', item: r.item, category: ITEM[r.itemId]?.section || '', date: new Date(r.openedAt).toLocaleDateString('en-US') };
}
function tpMail(id) {
  const r = rw(id), f = tpMailFields(r), tags = [['{{serial}}', 'Serial number'], ['{{plant}}', 'Plant'], ['{{customer}}', 'Customer name'], ['{{model}}', 'Model'], ['{{item}}', 'Failed item'], ['{{category}}', 'Section'], ['{{date}}', 'Date']];
  modal('Failure email', `<p class="source">Turbo Assist can email the people on the QC failure list when an item fails. Nothing is sent from this preview.</p>
    <label class="field">Subject line<input id="tp-subj" maxlength="200" value="${esc(TP.qc.subject)}" oninput="TP.qc.subject=this.value;document.getElementById('tp-subj-out').textContent=tpSubject(this.value,tpMailFields(rw('${id}')))"></label>
    <p class="tp-mailout"><small>This failure would go out as</small><strong id="tp-subj-out">${esc(tpSubject(TP.qc.subject, f))}</strong></p>
    <div class="tp-tags">${tags.map(([t, l]) => `<span><code>${t}</code> ${l}</span>`).join('')}</div>
    <div class="actions">${button('Use the standard subject', `TP.qc.subject='QC failure · {{serial}} · {{plant}} · {{customer}}';tpMail('${id}')`, 'secondary')}${button('Done', 'closeModal()')}</div>`);
}
{
  const card = reworkCard;
  reworkCard = function (r, withBuilding = false) {
    const tags = r.tags || ['QC failure'], state = r.step === 0 ? 'Open failure' : r.step === 1 ? 'Correction submitted' : 'Failed, then fixed';
    const extra = `<div class="tp-rwx"><div class="pillrow"><span class="pill ${r.step === 0 ? 'red' : 'amber'}">${state}</span>${r.severity ? `<span class="pill ${/Major|Critical/.test(r.severity) ? 'red' : 'ghost'}">${r.severity}</span>` : ''}<span class="pill ghost">${tpPart(r)}</span>${r.final ? '<span class="pill blue">Failed again at final QC</span>' : ''}${tags.map((t) => `<span class="pill ghost">${esc(t)}</span>`).join('')}</div>
      ${r.fix ? `<p class="tp-fix"><b>Corrective action.</b> ${esc(r.fix)}</p>` : ''}
      ${r.photos?.length ? `<div class="qc-photo tp-photos">${r.photos.map((src, k) => `<img src="${src}" alt="Failure photo ${k + 2}">`).join('')}<small>Failure images (${r.photos.length + (r.photo ? 1 : 0)})</small></div>` : ''}
      <p class="tp-rwlinks"><button type="button" class="link inline" onclick="tpTagsForm('${r.id}')">Tags</button><button type="button" class="link inline" onclick="tpMail('${r.id}')">Failure email</button></p></div>`;
    return tpBefore(card(r, withBuilding), '<div class="actions">', extra, true);
  };
  const queue = reworkQueue;
  reworkQueue = function () {
    const open = Q.rework.filter((r) => r.step < 2).length;
    return tpBefore(queue(), '<div class="today">', `<p class="tp-queue"><strong>Correction checklist.</strong> Only the open failures from the original report. Describe the correction and add a new photo.${open ? '' : ' <b>Nothing left to correct.</b>'}</p>`);
  };
}

/* ---------- Serial status, for every side ----------
   The sentences are Turbo Assist's (serialQcStatusLabel). Looks the serial, order number or
   record id up across the board, plant QC, Logistics and the lot. */
function taSerialStatus(value) {
  const raw = String(value ?? '').trim(), key = raw.toLowerCase();
  if (!key) return { found: false, text: 'Enter a serial.' };
  const same = (x) => String(x || '').toLowerCase() === key;
  const idOf = Object.keys(TP.serials).find((id) => same(TP.serials[id]));
  const units = prUnits(), u = units.find((x) => same(x.id) || x.id === idOf), b = Q.builds.find((x) => same(x.serial) || x.serial === idOf);
  const lg = typeof LG !== 'undefined' ? LG.units.find((x) => same(x.id) || x.id === idOf) : null, sale = S.sales.find((s) => (same(s.id) || s.id === idOf) && !['Quote issued', 'Cancelled'].includes(s.status));
  const lot = typeof lots !== 'undefined' ? lots.find((x) => same(x.id)) : null, stock = S.stock.find((r) => same(r.id) || r.id === idOf);
  const id = u?.id || b?.serial || lg?.id || sale?.id || lot?.id || stock?.id;
  if (!id) return { found: false, text: `No building is filed under ${raw}.` };
  const serial = tpShown(id), where = u ? phaseNames[u.phase] : 'not on a production phase';
  const inspection = b ? (b.stage === LAST ? 'passed' : openRework(b).length ? 'failures' : b.results[QC]?.result === 'pass' ? 'awaiting_final' : started(b) ? 'open' : 'none') : !u && (lg || lot || sale?.status === 'Delivered') ? 'passed' : 'none';
  const text = {
    passed: `${serial} passed final QC and is ready for delivery. Pipeline: ${where}.`,
    awaiting_final: `${serial} finished inspection and is waiting on final QC. Pipeline: ${where}.`,
    failures: `${serial} has open QC failures. Pipeline: ${where}.`,
    open: `${serial} has an inspection in progress. Pipeline: ${where}.`,
    none: `${serial} is in production and has not started QC. Pipeline: ${where}.`,
  }[inspection];
  return { found: true, text, serial, id, phase: u ? phaseNames[u.phase] : '', inspection, onBoard: !!u, inQc: !!b };
}
/* Logistics can ask plant QC for an update on one serial; QC gets it as a notice. */
function taQcStatusAsk(value, who = 'Logistics') {
  const r = taSerialStatus(value);
  if (!r.found) return toast(r.text);
  taNotify({ to: 'qc', title: `QC status requested · ${r.serial}`, body: `${who} asked for a status update on ${r.serial}. ${r.text}`, go: r.inQc ? `openBuild('${r.id}')` : "go('qc')" });
  toast(`Plant QC has been asked about ${r.serial}.`);
}
/* A small lookup box any screen can drop in. */
function taSerialBox(key = 'tp') {
  return `<section class="panel tp-lookup"><div class="panelhead"><h2>Look up a serial</h2><span class="pill ghost">Any building, any side</span></div>
    <form class="tp-lookrow" onsubmit="event.preventDefault();tpLookup('${key}')"><input id="${key}-serial" class="search" type="search" autocomplete="off" aria-label="Serial or order number" placeholder="Serial or order number, like ORB-01841"><button class="secondary" type="submit">Check</button></form>
    <div id="${key}-result" class="tp-lookres" aria-live="polite"></div></section>`;
}
function tpLookup(key) {
  const value = document.getElementById(key + '-serial').value, r = taSerialStatus(value), el = document.getElementById(key + '-result');
  const safe = String(r.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  el.innerHTML = `<p class="${r.found ? 'tp-found' : 'tp-none'}">${esc(r.text)}</p>${r.found ? `<div class="actions">${r.inQc ? button('Open in Plant QC', `openBuild('${safe}')`, 'secondary small') : ''}${r.onBoard ? button('Open in Production', `prOpen('${safe}')`, 'secondary small') : ''}${document.body.dataset.side === 'logi' ? button('Ask plant QC for an update', `taQcStatusAsk('${safe}')`, 'secondary small') : ''}</div>` : ''}`;
}
{
  const home = QC_SCREENS.qc;
  QC_SCREENS.qc = floor = function () {
    return tpBefore(home(), '<div id="floorlist">', taSerialBox('tp'));
  };
}

/* ---------- Plant QC: the QC Dashboard, on the Report screen ---------- */
const tpDay = (t) => new Date(t).toISOString().slice(0, 10);
const tpUtcMidnight = (now) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
/* qcFailureTrends: the last 7 UTC days, the 7 before, and failures per inspected unit. */
function tpTrends(stamps, now = new Date()) {
  const today = tpUtcMidnight(now), DAY = 864e5, perDay = Array.from({ length: 7 }, (_, i) => ({ day: tpDay(today - (6 - i) * DAY), count: 0 }));
  const index = new Map(perDay.map((row, i) => [row.day, i])), priorStart = today - 13 * DAY, lastStart = today - 6 * DAY, units = new Set();
  let prior = 0;
  for (const s of stamps) {
    if (!(s.at >= priorStart)) continue;
    const slot = index.get(tpDay(s.at));
    if (slot != null) (perDay[slot].count += 1), units.add(s.serial);
    else if (s.at < lastStart) prior += 1;
  }
  const last = perDay.reduce((t, r) => t + r.count, 0);
  return { last, prior, perDay, perUnit: units.size ? Math.round((last / units.size) * 10) / 10 : null };
}
/* qcFailureLeaders: the top three items and groups for today, this week (from Monday) or this month. A tie for first is not a leader. */
function tpLeaders(stamps, win, now = new Date()) {
  const today = tpUtcMidnight(now), d = new Date(today), dow = d.getUTCDay();
  const start = win === 'today' ? today : win === 'month' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) : today - (dow === 0 ? 6 : dow - 1) * 864e5, end = today + 864e5;
  const modes = new Map(), groups = new Map();
  for (const s of stamps) {
    if (!(s.at >= start && s.at < end)) continue;
    if (s.item) modes.set(s.item, (modes.get(s.item) || 0) + 1);
    if (s.group) groups.set(s.group, (groups.get(s.group) || 0) + 1);
  }
  const rank = (m) => {
    const ordered = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { rows: ordered.slice(0, 3), hasLeader: ordered.length === 1 || (ordered.length > 1 && ordered[0][1] > ordered[1][1]) };
  };
  const a = rank(modes), g = rank(groups);
  return { modes: a.rows, groups: g.rows, hasLeader: a.hasLeader || g.hasLeader };
}
const tpStamps = () => allDefects().map((d) => ({ at: d.openedAt, serial: d.serial, item: d.item, group: d.section, style: d.style, closedAt: d.closedAt }));
const tpModel = (b) => `${b.style} · ${b.size}`;
function tpAwaitingRows() {
  const q = TP.dash.q.trim().toLowerCase();
  const rows = Q.builds.filter((b) => ['Ready for QA', 'In QA'].includes(qcStatus(b))).map((b) => ({ b, stage: qcStatus(b) === 'In QA' ? 'Not submitted' : 'Final QA', open: qcStatus(b) === 'In QA' }))
    .filter((r) => !q || `${tpShown(r.b.serial)} ${r.b.serial} ${tpModel(r.b)} ${r.stage}`.toLowerCase().includes(q));
  return rows.length ? rows.map(({ b, stage, open }) => `<div class="tp-drow"><span class="grow"><strong>${esc(tpShown(b.serial))}</strong> · ${esc(tpModel(b))}</span><span>${stage}</span><button type="button" class="secondary small" onclick="openBuild('${b.serial}')">${open ? 'Open' : 'Inspect'}</button></div>`).join('') : '<p>Nothing is waiting.</p>';
}
function tpReportRows() {
  const q = TP.dash.q2.trim().toLowerCase();
  const rows = Q.builds.filter((b) => b.results[QC] && openRework(b).length).filter((b) => !q || `${tpShown(b.serial)} ${b.serial} ${tpModel(b)}`.toLowerCase().includes(q));
  return rows.length ? rows.map((b) => `<div class="tp-drow bad"><span class="grow"><strong>${esc(tpShown(b.serial))}</strong> · ${esc(tpModel(b))} · ${openRework(b).length} open · ${when(b.results[QC].at)}</span><button type="button" class="secondary small" onclick="openBuild('${b.serial}')">Correct</button></div>`).join('') : '<p>No submitted report has an open failure.</p>';
}
function tpFailTable() {
  const all = tpFailRows(), size = 8, pages = Math.max(1, Math.ceil(all.length / size)), page = Math.min(TP.dash.page, pages - 1), rows = all.slice(page * size, page * size + size);
  if (!all.length) return '<p>No QC failures yet.</p>';
  return `<div class="tp-tablewrap"><table class="tp-table"><thead><tr><th>Group</th><th>Item</th><th>Serial</th><th>Model</th><th>Inspector</th><th>When</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${esc(r.serial)}</td><td>${esc(r.model)}</td><td>${esc(r.by)}</td><td>${when(r.at)}</td><td><span class="pill ${r.open ? 'red' : 'ghost'}">${r.open ? 'Open' : 'Corrected'}</span></td></tr>`).join('')}</tbody></table></div>
    <div class="tp-pager"><button type="button" class="secondary small" ${page ? '' : 'disabled'} onclick="TP.dash.page=${page - 1};tpDashRedraw()">Newer</button><span>Page ${page + 1} of ${pages} · ${tpPlural(all.length, 'failure')}</span><button type="button" class="secondary small" ${page < pages - 1 ? '' : 'disabled'} onclick="TP.dash.page=${page + 1};tpDashRedraw()">Older</button></div>`;
}
function tpFailRows() {
  const live = Q.rework.map((r) => ({ group: ITEM[r.itemId]?.area || 'Other', item: r.item, serial: tpShown(r.serial), model: tpModel(build(r.serial)), by: r.by, at: r.openedAt, open: r.step < 2 }));
  const old = Q.defects.map((d) => ({ group: d.section, item: d.item, serial: d.serial, model: d.style, by: 'Sample record', at: d.openedAt, open: false }));
  return live.concat(old).sort((a, b) => b.at - a.at);
}
function tpFailStats() {
  const stamps = tpStamps(), t = tpTrends(stamps), delta = t.last - t.prior, lead = tpLeaders(stamps, TP.dash.win), today = t.perDay[6].day;
  const cell = (row) => {
    const d = new Date(row.day + 'T00:00:00Z'), part = (o) => d.toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
    return `<div class="tp-daycell${row.day === today ? ' tp-now' : ''}"><small>${part({ weekday: 'short' })}</small><strong>${d.getUTCDate()}</strong><small>${part({ month: 'short' })}</small><b>${row.count}</b><small>${row.count === 1 ? 'failure' : 'failures'}</small></div>`;
  };
  const list = (title, rows) => `<div><h4>${title}</h4>${rows.length ? `<ol>${rows.map(([label, n]) => `<li>${esc(label)} · ${n}</li>`).join('')}</ol>` : '<p>None in this period.</p>'}</div>`;
  return `<p class="tp-trend">${t.last} in the last 7 days${delta === 0 ? '' : delta > 0 ? ` · ${delta} more than the 7 days before` : ` · ${Math.abs(delta)} fewer than the 7 days before`}${t.perUnit != null ? ` · ${t.perUnit} per inspected unit` : ''}</p>
    <div class="tp-week"><p><strong>Last 7 days</strong></p><div class="tp-days">${t.perDay.map(cell).join('')}</div></div>
    <div class="chiprow" role="tablist" aria-label="Failure leaders">${[['today', 'Today'], ['week', 'This week'], ['month', 'This month']].map(([id, label]) => `<button type="button" role="tab" aria-selected="${TP.dash.win === id}" class="chipbtn${TP.dash.win === id ? ' on' : ''}" onclick="TP.dash.win='${id}';tpDashRedraw()">${label}</button>`).join('')}</div>
    ${lead.hasLeader ? `<div class="grid2 tp-leaders">${list('Failure modes', lead.modes)}${list('Failure groups', lead.groups)}</div>` : '<p class="tp-noleader">No statistical Failure Leaders</p>'}`;
}
function tpDashRedraw() {
  const el = document.getElementById('tp-failures');
  if (el) el.innerHTML = tpFailBody();
}
function tpFailBody() {
  return `<div class="chiprow" role="tablist" aria-label="Failure view">${[['table', 'Table'], ['stats', 'Statistics']].map(([id, label]) => `<button type="button" role="tab" aria-selected="${TP.dash.view === id}" class="chipbtn${TP.dash.view === id ? ' on' : ''}" onclick="TP.dash.view='${id}';tpDashRedraw()">${label}</button>`).join('')}</div>
    ${TP.dash.view === 'table' ? tpFailTable() : tpFailStats()}`;
}
function tpDashboard() {
  const fold = (key, title, body) => `<details class="tp-fold" ${TP.dash.open[key] ? 'open' : ''} ontoggle="TP.dash.open.${key}=this.open"><summary><h3>${title}</h3></summary>${body}</details>`;
  const finalRows = Q.builds.filter((b) => qcStatus(b) === 'Needs sign-off');
  const reports = Q.builds.filter((b) => b.results[QC] && openRework(b).length), defects = reports.reduce((t, b) => t + openRework(b).length, 0);
  return `<section class="panel tp-dash"><div class="panelhead"><h2>QC Dashboard</h2><span class="pill ghost">From Turbo Assist</span></div>
    <p class="muted">What is waiting, what failed, and which submitted reports still need a correction.</p>
    ${fold('final', `Awaiting final QC <small>${finalRows.length}</small>`, `<p>Inspections with nothing left to fix. Final QC can fail an item again or pass the building.</p>${finalRows.length ? finalRows.map((b) => `<div class="tp-drow"><span class="grow"><strong>${esc(tpShown(b.serial))}</strong> · ${esc(tpModel(b))}${b.readyFinal ? ` · ready for final certification · ${esc(b.readyFinal.by)}` : ''}</span><button type="button" class="secondary small" onclick="Q.signSerial='${b.serial}';go('qc-signoff')">Open</button></div>`).join('') : '<p>Nothing is waiting on final QC.</p>'}`)}
    ${fold('awaiting', `Awaiting QC <small>${Q.builds.filter((b) => ['Ready for QA', 'In QA'].includes(qcStatus(b))).length}</small>`, `<p>Open inspections, units in Final QA, and ShedSuite buildings that are still at the plant with no QC session.</p>
      <label class="searchbar tp-filter">${icon('orders', 16)}<input class="search" type="search" placeholder="Filter serial, model, or stage" aria-label="Filter serial, model, or stage" value="${esc(TP.dash.q)}" oninput="TP.dash.q=this.value;document.getElementById('tp-awaiting').innerHTML=tpAwaitingRows()"></label><div id="tp-awaiting">${tpAwaitingRows()}</div>`)}
    ${fold('failures', 'Failures', `<div id="tp-failures">${tpFailBody()}</div>`)}
    ${fold('reports', `Open reports <small>${reports.length}</small>`, `<p>${reports.length} submitted ${reports.length === 1 ? 'report' : 'reports'} still have uncorrected failures · ${defects} open ${defects === 1 ? 'defect' : 'defects'}</p>
      <label class="searchbar tp-filter">${icon('orders', 16)}<input class="search" type="search" placeholder="Filter serial or model" aria-label="Filter serial or model" value="${esc(TP.dash.q2)}" oninput="TP.dash.q2=this.value;document.getElementById('tp-reports').innerHTML=tpReportRows()"></label><div id="tp-reports">${tpReportRows()}</div>`)}
    <div class="tp-qcset"><h3>QC settings</h3>
      <label class="checkrow"><input type="checkbox" id="tp-set-photos" ${TP.qc.photos ? 'checked' : ''} onchange="TP.qc.photos=this.checked;render()"> Failure photos required</label>
      <label class="checkrow"><input type="checkbox" id="tp-set-notes" ${TP.qc.notes ? 'checked' : ''} onchange="TP.qc.notes=this.checked;render()"> Failure notes required</label>
      <label class="checkrow"><input type="checkbox" id="tp-set-consume" ${TP.qc.consume ? 'checked' : ''} onchange="TP.qc.consume=this.checked;render()"> Final QA issues recipe materials</label>
      <p class="source">A failure takes up to three photos either way. Questions where a photo proves nothing stay optional.</p></div></section>`;
}
{
  const page = report;
  report = function () {
    return tpBefore(page(), '<div class="qc-filter">', tpDashboard());
  };
  const about = QC_SCREENS['qc-notes'];
  QC_SCREENS['qc-notes'] = qcNotes = function () {
    const add = `<section class="panel"><h2>From Turbo Assist</h2><ul>
        <li>The plant serial on each building: the plant’s code, a dash and five digits, issued when the building leaves Order received.</li>
        <li>Final QC: QC marks a passed building ready for final certification; final QC signs with two to four initials (“Final QC Passed - Checked by RC”) or fails an item again and sends it back.</li>
        <li>A failure: up to three photos, an optional severity, tags, the part of the building, and the corrective action when it is fixed.</li>
        <li>The QC Dashboard on the Report screen: awaiting QC, awaiting final QC, failures with the 7-day trend and the failure leaders, and open reports.</li>
        <li>The serial lookup on the Buildings screen, with Turbo Assist’s own sentences.</li>
        <li>The failure email’s subject line, shown for any failure. Nothing is sent.</li>
      </ul></section>
      <section class="panel"><h2>Different from Turbo Assist</h2><ul>
        <li>Turbo Assist ships with no checklist wording: each plant writes its own sections and items. The questions here stay the plant’s current checklist.</li>
        <li>Turbo Assist answers Pass, Fail or N/A. This preview asks Yes, No or N/A and shows Turbo Assist’s word beside the answer.</li>
        <li>A final QC pass in Turbo Assist stamps the build complete and holds the card on Final QA until delivery. Here it moves to Build complete.</li>
        <li>Defect types, crews, holds and the assigned crew are only in this preview.</li>
        <li>Turbo Assist’s walk-around notes are not here: spoken notes on a building, good examples and standards for the build book, a photo on a passed item, and submitting one section at a time.</li>
      </ul></section>`;
    const html = about(), at = html.lastIndexOf('</div>');
    return at < 0 ? html : html.slice(0, at) + add + html.slice(at);
  };
  const notes = OPS_SCREENS['pr-notes'];
  OPS_SCREENS['pr-notes'] = prNotesPage = function () {
    const add = `<section class="panel"><h2>Added from Turbo Assist</h2><ul>
        <li>Plant serials, issued when a building leaves Order received.</li>
        <li>On each building: build specs from Turbo Assist’s framing rules, the bill of materials, issuing material, and Ship from plant.</li>
        <li>Loads: the footage note, closing a load to free its letter, and the next free letter for a new load.</li>
        <li>Phase settings, with the pay trigger. The inventory request from the board.</li>
      </ul></section>`;
    const html = notes().replace('<li>The order number stands in for the plant’s serial number.</li>', '<li>Plant serials are made up: the counter starts at a sample number. What the plant has on hand is made up too.</li>')
      .replace('Crews, stations, due dates, materials and labor pay.', 'Crews, stations, due dates, purchasing and labor pay amounts.');
    const at = html.lastIndexOf('</div>');
    return at < 0 ? html : html.slice(0, at) + add + html.slice(at);
  };
}

/* ---------- Product notes ---------- */
taNotesFor('prod', [
  ['Plant serial', 'Leaving the initial phase starts the build and issues the serial (<code>transitionUnitPhase</code> → <code>issueSerialForBuildStart</code>, <code>formatPlantSerial</code>): “Build started — serial … assigned”.'],
  ['Inventory request', 'The “+ Inventory request” tile (<code>PlantMaterialRequestPopover</code>): “Sent inventory request … Purchasing will review.”'],
  ['Load letters', '<code>nextAvailableProductionLoadCode</code>: the first letter no open or dispatched load holds. “Close (free letter)” runs <code>closeOrgProductionLoad</code>: “Load … closed — letter is free”.'],
  ['Sending a load', '<code>dispatchOrgProductionLoad</code> moves each unit still in Order received or Order approved to the first shop phase with the note “Load … sent to plant”. Turbo Assist’s button reads “Send to plant”.'],
  ['Column marks', '“initial”, “build complete” and “pay” on a column come from the phase’s flags (<code>BuildPipelineColumn</code>).'],
], [
  'Changing a load after it is sent. Turbo Assist only lets open loads take units.',
  'The office’s approval is what moves a building out of Order received here. In Turbo Assist the plant moves the card.',
  'Searching for several things at once with commas, which Turbo Assist’s search allows, is not here.',
]);
taNotesFor('pr-unit', [
  ['Bill of materials', 'The drawer’s “Bill of materials” reads the unit’s recipe lines; “No recipe lines on this unit.” when there are none.'],
  ['Issue material', '“Issue material” (<code>createManufacturingMaterialIssuance</code>): “Pick a material”, “Enter a quantity”, and “Insufficient on-hand quantity (… available, … requested).” when the plant is short.'],
  ['Ship from plant', '<code>BuildPipelineUnitShipSection</code> and <code>unitCanShipFromPlant</code>: the button reads “Finish build first” until the build is complete.'],
  ['Materials at final QC', '<code>consumeUnitOnFinalQc</code>: “Consumed when this building reached final QC.”'],
], [
  'Build specs as a panel. Turbo Assist keeps these rules in its recipes; the numbers here are figured from the same rules.',
  'Ship from plant opens Logistics. In Turbo Assist the button itself takes the unit off the board.',
]);
taNotesFor('pr-list', [['Sale path and plant', 'The roster’s longer labels (“Inventory (no sale yet)”, “Cash sale”, “Finance”, “Rent-to-own”) and the plant as code and name.']], []);

/* ---------- Start ---------- */
tpSync();
/* Everything there when the page has finished loading counts as sample data, so no notices fire
   for it. The timer lets the files loaded after this one finish their own start-up first. */
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  tpSync();
  TP.booting = false;
  const hours = (h) => Date.now() - h * 36e5, ready = build('SAMPLE-1232-1008');
  if (ready && !ready.readyFinal && qcStatus(ready) === 'Needs sign-off') ready.readyFinal = { by: 'Sample record', at: hours(2) };
  const seed = (n) => taNotify(n);
  if (tpSerial('SAMPLE-1220-3001')) seed({ to: 'prod', at: hours(20), title: `Build started — serial ${tpSerial('SAMPLE-1220-3001')} assigned`, body: '12x20 Classic Utility for the Lexington lot left Order received.', go: "prOpen('SAMPLE-1220-3001')" });
  seed({ to: 'prod', at: hours(30), title: 'Load A sent to plant', body: 'Florence and Lugoff: 2 buildings started in Flooring.', go: "go('prod')" });
  if (tpSerial('SAMPLE-1428-1012')) seed({ to: 'prod', at: hours(3), title: `${tpSerial('SAMPLE-1428-1012')} marked build complete`, body: 'Final QC passed it. The office releases it and Logistics moves it.', go: "prOpen('SAMPLE-1428-1012')" });
  if (ready) seed({ to: 'qc', at: hours(2), title: `Ready for final certification · ${tpShown('SAMPLE-1232-1008')}`, body: `${tpShown('SAMPLE-1232-1008')} is ready for final certification. Marked by Sample record.`, go: "Q.signSerial='SAMPLE-1232-1008';go('qc-signoff')" });
  if (build('SAMPLE-1224-1005')) seed({ to: 'qc', at: hours(5), title: `QC status requested · ${tpShown('SAMPLE-1224-1005')}`, body: `Logistics asked for a status update on ${tpShown('SAMPLE-1224-1005')}. ${taSerialStatus('SAMPLE-1224-1005').text}`, go: "openBuild('SAMPLE-1224-1005')" });
  render();
}, 0));
