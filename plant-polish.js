/* plant-polish.js: Plant batch 2 from the review (Production and Plant QC).

   Written for a reader with a 5th grade education and no technical knowledge.
   1. Phone board: the steps and buildings come first; loads, requests and settings sit behind a button.
      The nine-box strip becomes "Step 4 of 9 · Walls" with a bar on a phone.
   2. Failing an item: only the problem types that fit, one-tap notes, typing optional after one.
   3. "Who fixed it?" has the photo button its text promises, and says what is needed.
   4. Bigger buttons and text on the plant sides (plant-polish.css).
   5. Two names for the last step: "QC check" and "Final sign-off", on every side.
   6. Plain shop words. Code words show only with "Show builder notes" on.
   7. "Use" beside each line of the materials list, and a used line can be taken back.
   8. Sample buildings no longer contradict themselves.
   9. The list of buildings has a step filter, unfinished first; build details come first on a building.
   10. The board's counts add up and filter the board; the QC report keeps only numbers.
   11. Sending a whole load to the floor can be undone.
   Turbo Assist functions these sit on are named beside each part. Loaded after plant-guards.js. */

const PP = { more: false, tile: null, roster: null, fixPhoto: null, raw: false }; /* raw: older checks that read Turbo Assist's own words switch this file off */
const ppPhone = () => matchMedia('(max-width: 680px)').matches;

/* ---------- 5 and 6. One set of plain words, on every side ----------
   The screens are built by many layers, so the words are put right as the page is drawn. Builder notes,
   code and typed text are left alone. */
const PP_WORDS = [
  [/Materials consumption is on\. Final QA issues recipe materials\./g, 'Materials are counted as used when a building gets its final sign-off.'],
  [/Materials consumption is off\. Final QA does not issue recipe materials\./g, 'Materials are not being counted right now.'],
  [/Final QA issues recipe materials/g, 'Count materials as used at the final sign-off'],
  [/Issued at final QC/g, 'Counted at final sign-off'],
  [/Consumed when this building reached final QC/g, 'Counted as used at the final sign-off'],
  [/Final QA belongs to Plant QC: a building there moves to Build complete when QC signs it off\./g, 'A building at the QC check moves to Build complete after its final sign-off.'],
  [/Final QA hands the building to Plant QC\./g, 'The next step is the QC check.'],
  [/Open inspections, units in Final QA, and ShedSuite buildings that are still at the plant with no QC session\./g, 'Buildings that are waiting for their QC check.'],
  [/Ready for QA or in QA/g, 'Waiting for or in the QC check'],
  [/ready for final certification/g, 'ready for final sign-off'], [/Ready for final certification/g, 'Ready for final sign-off'],
  [/Awaiting final QC/g, 'Waiting on final sign-off'], [/Awaiting QC/g, 'Waiting on the QC check'],
  [/waiting on final QC/g, 'waiting on final sign-off'], [/Waiting on final QC/g, 'Waiting on final sign-off'],
  [/Final QC Pass/g, 'Final sign-off'], [/\bfinal QC\b/g, 'final sign-off'], [/\bFinal QC\b/g, 'Final sign-off'],
  [/Needs sign-off/g, 'Ready for final sign-off'], [/Open for sign-off/g, 'Open for final sign-off'], [/Go to sign-off/g, 'Go to final sign-off'],
  [/Waiting on sign-off/g, 'Waiting on final sign-off'], [/waiting on sign-off/g, 'waiting on final sign-off'],
  [/Continue QA/g, 'Keep checking'], [/Start QA/g, 'Start QC check'],
  [/Ready for QA/g, 'Ready for QC check'], [/\bIn QA\b/g, 'In QC check'], [/Final QA/g, 'QC check'],
  [/\bIn QC\b(?! check)/g, 'At the QC check'], [/\bQA\b/g, 'QC check'],
  [/Close \(free letter\)/g, 'Close this load'],
  [/Optional transition note/g, 'Note for the next crew (you can skip this)'],
  [/Not assigned\. Ops assigns a letter before sending the load to the plant\./g, 'Not on a load yet. The office puts it on one.'],
  [/Marks the unit shipped and takes it off the active Kanban\. Logistics \/ delivery can be scheduled later\./g, 'When it ships, it comes off this board. Delivery can be set up later.'],
  [/\bPlant Kanban\b/g, 'plant board'], [/\bKanban\b/g, 'board'], [/\bBuild pipeline\b/g, 'Build steps'], [/\bbuild pipeline\b/g, 'build steps'],
  [/Ops footage \(freeform\)/g, 'Feet on the trailer'], [/Ops footage/g, 'Feet on the trailer'],
  [/Insufficient on-hand quantity \(([^)]*) available, ([^)]*) requested\)\./g, 'Not enough in stock. There are $1 and you asked for $2.'],
  [/\s*Status in Turbo Assist: \w+(?: · )?/g, ''],
  [/Load (\w+) closed — letter is free/g, 'Load $1 is closed.'],
  [/Sold in this tab/g, 'Sold today on the Sales desk'],
  [/Set pay trigger/g, 'Pay the crew at this step'], [/Clear pay trigger/g, 'Stop paying at this step'],
  [/pay-trigger phase/g, 'pay step'], [/Pay trigger/g, 'Pay step'], [/pay trigger/g, 'pay step'],
  [/from the recipe/g, 'see the build sheet'], [/No recipe lines on this unit\./g, 'No materials list for this building yet.'],
  [/Phase settings/g, 'Step settings'], [/Move phase/g, 'Move to the next step'], [/in this phase/g, 'at this step'], [/\bby phase\b/g, 'by step'], [/its next phase/g, 'its next step'],
  [/The nine phases a building moves through, and what Turbo Assist keeps on each one\./g, 'The nine steps a building goes through.'],
  [/A floor worker moves a building only into or out of a phase they are tagged for\./g, 'A floor worker can move a building only at their own step.'],
  [/With no phase tag, the board is view only\./g, 'Someone with no step can look but cannot move a building.'],
  [/This preview has no logins: the plant manager moves every building\./g, ''],
  [/Moving a building into a pay step puts it on the labor pay list\. More than one phase can be flagged\. When none is, Turbo Assist uses the build-complete phase\./g, 'When a building reaches a pay step, the crew’s pay for it is counted. You can pick more than one step. If you pick none, pay is counted at Build complete.'],
  [/On board\b/g, 'On the board'],
  [/QC Dashboard/g, 'Work waiting'], [/Corrective action/g, 'What was done to fix it'],
  [/a defect type/g, 'what is wrong'], [/defect type/g, 'problem type'], [/\bdefects\b/g, 'problems'], [/\bdefect\b/g, 'problem'],
  [/(\d × \d ft (?:Standard|Insulated))(?! window)/g, '$1 window'],
  [/Bill of materials/g, 'Materials list'], [/Issue material/g, 'Use other material'],
];
const PP_EXACT = { Initial: 'First step', INITIAL: 'FIRST STEP', initial: 'first step', STRUCTURAL: '', Structural: '', 'Sign-off': 'Final sign-off', 'All sign-offs': 'All final sign-offs', 'build complete · pay': 'last step · pay step', Framing: 'Framing' };
const PP_SKIP = 'script, style, textarea, code, .ops-notes, .sf-hook, .sf-only, [data-pp-raw]';
function ppWord(text) {
  const trimmed = text.trim();
  if (Object.hasOwn(PP_EXACT, trimmed)) return text.replace(trimmed, PP_EXACT[trimmed]);
  let out = text;
  for (const [re, to] of PP_WORDS) out = out.replace(re, to);
  if (ppPhone()) out = out.replace('Drag a card to its next step, or open it to move it with a note.', 'Tap a building to open it and move it.');
  return out;
}
function ppFixNode(n) {
  const p = n.parentElement;
  if (PP.raw || !p || p.closest(PP_SKIP) || (p.tagName === 'OPTION' && !p.hasAttribute('value'))) return;
  const next = ppWord(n.nodeValue);
  if (next !== n.nodeValue) n.nodeValue = next;
}
function ppFixTree(root) {
  if (root.nodeType === 3) return ppFixNode(root);
  if (PP.raw || root.nodeType !== 1 || root.closest?.(PP_SKIP)) return;
  /* A step box writes "Final" and "QA" on two lines. */
  for (const s of root.querySelectorAll ? root.querySelectorAll('.chev i > span') : []) if (s.textContent === 'FinalQA') s.innerHTML = 'QC<br>check';
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  while (walk.nextNode()) list.push(walk.currentNode);
  list.forEach(ppFixNode);
  for (const el of root.querySelectorAll ? [root, ...root.querySelectorAll('[placeholder], [aria-label], [title]')] : [])
    for (const a of ['placeholder', 'aria-label', 'title']) {
      const v = el.getAttribute?.(a);
      if (v && !el.closest(PP_SKIP)) { const w = ppWord(v); if (w !== v) el.setAttribute(a, w); }
    }
}
new MutationObserver((list) => {
  for (const m of list) {
    if (m.type === 'characterData') ppFixNode(m.target);
    else m.addedNodes.forEach(ppFixTree);
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

/* 4. Text on the plant sides is never smaller than 13 px on a phone or tablet. */
let ppSizing = 0;
function ppSizes() {
  ppSizing = 0;
  const side = document.body.dataset.side;
  if ((side !== 'prod' && side !== 'qc') || !matchMedia('(max-width: 1200px)').matches) return;
  for (const root of document.querySelectorAll('#app, .modal'))
    for (const el of root.querySelectorAll('*')) {
      if (el.dataset.ppSized || !el.childNodes.length) continue;
      let text = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { text = true; break; }
      if (!text) continue;
      el.dataset.ppSized = '1';
      if (parseFloat(getComputedStyle(el).fontSize) < 13) el.style.fontSize = '13px';
    }
}
new MutationObserver(() => { if (!ppSizing) ppSizing = requestAnimationFrame(ppSizes); }).observe(document.documentElement, { childList: true, subtree: true });

/* Step settings: the code words (Turbo Assist's phase keys and tags) show only with builder notes on. */
{
  const base = OPS_SCREENS['pr-phases'];
  OPS_SCREENS['pr-phases'] = tpPhasesPage = function () {
    let html = base();
    if (!S.sfNotes && !PP.raw) html = html.replace(/<small><code>[^<]*<\/code> · seq \d+ · ([^<]*?) · moved by anyone tagged <code>[^<]*<\/code><\/small>/g, '<small>$1</small>');
    return html;
  };
}

/* ---------- 10. The board: counts that add up and filter; one "Nothing found" ---------- */
const PP_TILES = [
  ['wait', 'Not started yet', (u) => u.phase < 2],
  ['work', 'Being built', (u) => u.phase >= 2 && u.phase < PR_QA],
  ['qc', 'QC check', (u) => u.phase === PR_QA],
  ['done', 'Build complete', (u) => u.phase === PR_DONE],
];
{
  const baseCols = prBoardCols;
  prBoardCols = function () {
    if (PP.raw) return baseCols();
    const tile = PP_TILES.find((t) => t[0] === PP.tile), real = prUnits;
    let html;
    if (tile) prUnits = () => real().filter(tile[2]);
    try { html = baseCols(); } finally { prUnits = real; }
    if (!/class="pr-card/.test(html) && (PR.q.trim() || tile))
      return html.replace(/<div class="pr-board">[\s\S]*$/, '<div class="panel emptystate pp-none"><strong>Nothing found</strong><p>No building fits that search. Try another word, or clear the search.</p></div>');
    return html;
  };
  const baseBoard = OPS_SCREENS.prod;
  OPS_SCREENS.prod = prBoard = function () {
    if (PP.raw) return baseBoard();
    const all = prUnits(), tiles = PP_TILES.map(([k, text, ok]) => `<button type="button" class="kpi pp-tile${PP.tile === k ? ' on' : ''}" aria-pressed="${PP.tile === k}" onclick="PP.tile=PP.tile==='${k}'?null:'${k}';render()"><strong>${all.filter(ok).length}</strong><span>${text}</span></button>`).join('')
      + `<button type="button" class="kpi pp-tile${PP.tile ? '' : ' on'}" aria-pressed="${!PP.tile}" onclick="PP.tile=null;render()"><strong>${all.length}</strong><span>All on the board</span></button>`;
    let html = baseBoard();
    /* Turbo Assist's four counts (BuildPipelineOverviewStats) leave out buildings that have not started. */
    html = html.replace(/(<div class="today ops-tiles[^"]*">)[\s\S]*?(<button type="button" class="tp-reqtile")/, `$1${tiles}$2`);
    return `<div class="pp-board${PP.more ? ' more' : ''}">${html}</div>`;
  };
}

/* ---------- 11. Sending a whole load to the floor can be undone ---------- */
{
  const base = prLoadDispatch;
  prLoadDispatch = function (code) {
    const l = prLoad(code);
    const snap = l && { state: l.state, at: l.dispatchedAt, units: l.units.map((id) => { const u = prUnit(id); return u && { id, phase: u.phase, since: PR.since[id], hist: (PR.hist[id] || []).length, ref: u.ref, src: u.src, plantPhase: u.ref?.plantPhase, fulfillment: u.ref?.fulfillment, stage: u.ref?.stage, refPhase: u.ref?.phase }; }).filter(Boolean) };
    base(code);
    if (!snap || l.state === snap.state || typeof pgUndoBar !== 'function') return;
    pgUndoBar(`Load ${code} was sent to the floor.`, () => {
      l.state = snap.state;
      l.dispatchedAt = snap.at;
      for (const x of snap.units) {
        if (PR.hist[x.id]) PR.hist[x.id].length = x.hist;
        if (x.since === undefined) delete PR.since[x.id]; else PR.since[x.id] = x.since;
        if (x.src === 'sale') (x.ref.plantPhase = x.plantPhase), (x.ref.fulfillment = x.fulfillment);
        else if (x.src === 'stock') (x.ref.plantPhase = x.plantPhase), (x.ref.stage = x.stage);
        else if (x.src === 'sample') x.ref.phase = x.refPhase;
        if (typeof TP !== 'undefined') TP.lastPhase[x.id] = x.phase;
      }
      render();
      toast(`Load ${code} is back to being planned.`);
    });
  };
}

/* ---------- 9. The list of buildings: a step filter, unfinished first ---------- */
{
  const baseRows = prRosterRows;
  prRosterRows = function () {
    if (PP.raw) return baseRows();
    const html = baseRows(), by = Object.fromEntries(prUnits().map((u) => [u.id, u]));
    const rows = (html.match(/<article class="ops-row">[\s\S]*?<\/article>/g) || []).map((row) => ({ row, u: by[(/prOpen\('([^']+)'\)/.exec(row) || [])[1]] })).filter((x) => x.u);
    if (!rows.length) return html;
    const keep = rows.filter((x) => PP.roster == null || x.u.phase === PP.roster)
      .sort((a, b) => (a.u.phase === PR_DONE) - (b.u.phase === PR_DONE) || b.u.phase - a.u.phase || a.u.since - b.u.since);
    return keep.map((x) => x.row).join('') || '<div class="panel emptystate"><strong>Nothing found</strong><p>No building is at that step right now.</p></div>';
  };
  const baseRoster = OPS_SCREENS['pr-list'];
  OPS_SCREENS['pr-list'] = prRoster = function () {
    if (PP.raw) return baseRoster();
    const list = prUnits();
    const chips = `<div class="chiprow pp-steps" role="group" aria-label="Show one step"><button type="button" class="chipbtn${PP.roster == null ? ' on' : ''}" onclick="PP.roster=null;render()">All steps</button>${phaseNames.map((n, i) => `<button type="button" class="chipbtn${PP.roster === i ? ' on' : ''}" onclick="PP.roster=${i};render()">${n} <span class="ops-n">${list.filter((u) => u.phase === i).length}</span></button>`).join('')}</div>`;
    return baseRoster().replace('One line per building, furthest along first.', 'One line per building. Buildings still being built come first.').replace('<div class="ops-list" id="pr-rows">', chips + '<div class="ops-list" id="pr-rows">');
  };
}

/* ---------- 7. Use material straight from the materials list; take a used line back ----------
   Turbo Assist: the unit drawer's "Issue material" (issueMaterialToUnit). Taking a line back is a
   feature the product still has to accept. */
function ppMatFor(label) {
  const key = String(label).toLowerCase();
  return TP.mats.find((m) => key.includes(m.name.toLowerCase().split(' - ')[0]) || m.name.toLowerCase().includes(key));
}
function ppUseLine(id, k) {
  const u = prUnit(id), x = u && tpBom(u)[k];
  if (!x || x.qty == null) return;
  const m = ppMatFor(x.label);
  if (m && m.on < x.qty) return toast(`Not enough in stock. There are ${tpNum(m.on)} and this needs ${tpNum(x.qty)}.`);
  if (m) m.on = Math.round((m.on - x.qty) * 100) / 100;
  (TP.issued[id] ||= []).push({ name: x.label, qty: x.qty, unit: x.unit, at: Date.now(), note: '', bom: k, code: m?.code });
  render();
  toast(`Marked as used: ${tpNum(x.qty)} ${x.unit} of ${x.label}.`);
}
function ppTakeBack(id, n) {
  const list = TP.issued[id] || [], x = list[n];
  if (!x) return;
  const m = x.code && TP.mats.find((y) => y.code === x.code);
  if (m) m.on = Math.round((m.on + x.qty) * 100) / 100;
  list.splice(n, 1);
  render();
  toast(`Taken back: ${tpNum(x.qty)} ${x.unit} of ${x.name}.`);
}
{
  const baseBom = tpBomPanel;
  tpBomPanel = function (u) {
    if (PP.raw) return baseBom(u);
    const lines = tpBom(u), used = TP.issued[u.id] || [], can = u.phase >= 1 && !TP.consumed[u.id];
    let k = -1;
    return baseBom(u).replace(/<li><span class="grow">([\s\S]*?)<\/span><b>([\s\S]*?)<\/b><i>[\s\S]*?<\/i><\/li>/g, (all, label, qty) => {
      k++;
      const x = lines[k], n = used.findIndex((y) => y.bom === k);
      const act = !x || x.qty == null || !can ? '' : n >= 0 ? `<span class="pp-used">${icon('check', 14)} Used</span><button type="button" class="secondary small" onclick="ppTakeBack('${u.id}',${n})">Take back</button>` : `<button type="button" class="primary small" onclick="ppUseLine('${u.id}',${k})">Use ${qty.replace('×', '')}</button>`;
      return `<li><span class="grow">${label}</span><b>${qty}</b>${act}</li>`;
    }).replace('<p class="source">The framing lines,', '<p class="pp-how">Tap “Use” beside a line when the crew takes that material. Tap “Take back” if it was a mistake.</p><p class="source">The framing lines,');
  };
  const baseIssue = tpIssue;
  tpIssue = function (id) {
    const code = document.getElementById('tp-mat')?.value, before = (TP.issued[id] || []).length;
    baseIssue(id);
    const list = TP.issued[id] || [];
    if (list.length > before) list[list.length - 1].code = code;
  };
  const basePanel = tpIssuePanel;
  tpIssuePanel = function (u) {
    if (PP.raw) return basePanel(u);
    const list = TP.issued[u.id] || [], shown = list.slice().reverse().slice(0, 8);
    let n = -1;
    return basePanel(u).replace(/<li><span class="grow">([\s\S]*?)<\/span><b>([\s\S]*?)<\/b><\/li>/g, (all, name, qty) => {
      n++;
      const at = list.indexOf(shown[n]);
      return at < 0 || TP.consumed[u.id] ? all : `<li><span class="grow">${name}</span><b>${qty}</b><button type="button" class="secondary small" onclick="ppTakeBack('${u.id}',${at})">Take back</button></li>`;
    }).replace('<label>Material<select', '<label>Something not on the list above<select');
  };
}

/* ---------- 8 and 9. A building's page ---------- */
{
  const base = OPS_SCREENS['pr-unit'];
  OPS_SCREENS['pr-unit'] = prUnitPage = function () {
    let html = base();
    const u = prUnit(PR.id);
    if (!u || PP.raw) return html;
    /* A sample building that started part-way has no moves on record: say when it got here. */
    html = html.replace('<p class="empty">No moves yet.</p>', u.phase > 0 ? `<div class="log"><small>${prStamp(u.since)}</small><br>Came to ${phaseNames[u.phase]}</div>` : '<p class="empty">Not started yet.</p>');
    if (u.phase === PR_DONE) html = html.replace(`<span class="pill">${prAgo(u.since)} in this phase</span>`, `<span class="pill">Finished ${prStamp(u.since)}</span>`);
    const step = `<div class="pp-step" role="img" aria-label="Step ${u.phase + 1} of ${phaseNames.length}: ${esc(phaseNames[u.phase])}"><strong>Step ${u.phase + 1} of ${phaseNames.length} · ${phaseNames[u.phase]}</strong><i><b style="width:${Math.round(((u.phase + 1) / phaseNames.length) * 100)}%"></b></i></div>`;
    return html.replace('<span class="chev long"', step + '<span class="chev long"').replace('<div class="od-grid"><div class="od-col">', '<div class="od-grid pp-detailsfirst"><div class="od-col">');
  };
}

/* ---------- 1. QC cards on a phone: "3 of 5 groups checked · 1 failed" ---------- */
{
  const base = floorCard;
  floorCard = function (b) {
    if (PP.raw) return base(b);
    const states = AREAS.map((a) => areaState(b, a)), done = states.filter((x) => x === 'done').length, bad = states.filter((x) => x === 'failed').length;
    const text = b.stage === LAST ? 'Signed off. Ready to ship.' : `${done} of ${AREAS.length} groups checked${bad ? ` · ${bad} failed` : ''}`;
    const bar = `<div class="pp-step${bad ? ' bad' : ''}"><strong>${text}</strong><i><b style="width:${b.stage === LAST ? 100 : Math.round(((done + bad) / AREAS.length) * 100)}%"></b></i></div>`;
    return base(b).replace('<span class="chev long"', bar + '<span class="chev long"');
  };
}

/* ---------- 2. Failing an item: fewer choices, one-tap notes ----------
   Turbo Assist: the inspection's failure form (defect type, severity, note, photos). The short lists
   and the one-tap notes are a feature the product still has to accept. */
const PP_TYPES = {
  Flooring: ['Gap or poor fit', 'Wrong size or position', 'Wood quality', 'Shiners or nails', 'Damage or rust'],
  Walls: ['Gap or poor fit', 'Wrong size or position', 'Wood quality', 'Shiners or nails', 'Missing item or option'],
  Paint: ['Paint or finish flaw', 'Wrong color', 'Silicone missing', 'Gap or poor fit'],
  Roofing: ['Roof screws or metal', 'Gap or poor fit', 'Silicone missing', 'Damage or rust'],
};
const PP_LAST = ['Missing item or option', 'Damage or rust', 'Wrong size or position', 'Paint or finish flaw', 'Paperwork or serial'];
const PP_QUICK = {
  Flooring: ['Not square', 'Wrong spacing', 'Loose or squeaks', 'Board is damaged'],
  Walls: ['In the wrong place', 'Wrong size', 'Not nailed tight', 'Gap showing'],
  Paint: ['Missed a spot', 'Runs or drips', 'Wrong color', 'Needs another coat'],
  Roofing: ['Screw missed the frame', 'Metal is bent or scratched', 'Edge could leak', 'Trim is loose'],
};
const PP_QUICK_LAST = ['It is missing', 'It is damaged', 'It does not work', 'It is the wrong one'];
function ppTypesFor(i) {
  const area = ITEM[i.id]?.area, text = askText(build(Q.serial), i).toLowerCase();
  const set = new Set(PP_TYPES[area] || PP_LAST);
  if (/electric|outlet|light|plug|switch|breaker/.test(text)) set.add('Electrical');
  if (/window|door/.test(text)) { set.add('Wrong size or position'); set.add('Silicone missing'); }
  if (/serial|paper|sticker|decal|tag/.test(text)) set.add('Paperwork or serial');
  if (/color|paint|stain/.test(text)) { set.add('Wrong color'); set.add('Paint or finish flaw'); }
  if (/roof|metal|shingle/.test(text)) set.add('Roof screws or metal');
  return set;
}
function ppQuick(id, n) {
  const a = draftOf(build(Q.serial)).answers[id], i = ITEM[id], list = PP_QUICK[i?.area] || PP_QUICK_LAST, text = list[n];
  a.quick = a.quick === text ? null : text;
  if (a.quick && (!(a.note || '').trim() || list.includes(a.note))) a.note = a.quick;
  else if (!a.quick && list.includes(a.note)) a.note = '';
  render();
}
{
  const baseForm = failForm;
  failForm = function (i, a) {
    if (PP.raw) return baseForm(i, a);
    const ok = ppTypesFor(i), quick = PP_QUICK[ITEM[i.id]?.area] || PP_QUICK_LAST;
    if (a.defect) ok.add(a.defect);
    let html = baseForm(i, a);
    html = html.replace(/<button class="chipbtn[^"]*" aria-pressed="[^"]*" onclick="setDefect\('[^']*',\d+\)">([^<]*)<\/button>/g, (all, name) => (ok.has(name.replace(/&amp;/g, '&')) ? all : ''));
    html = html.replace(/<button class="chipbtn[^"]*" aria-pressed="[^"]*" onclick="tpSetSeverity\('[^']*',\d+\)">(Informational|Moderate)<\/button>/g, (all) => (a.severity && all.includes(`>${a.severity}<`) ? all : ''));
    const taps = `<div class="pp-quick"><h4>Tap what fits, or type a note</h4><div class="chiprow">${quick.map((q, n) => `<button type="button" class="chipbtn${a.quick === q ? ' on' : ''}" aria-pressed="${a.quick === q}" onclick="ppQuick('${i.id}',${n})">${q}</button>`).join('')}</div></div>`;
    return html.replace('<label class="field">Note for the crew fixing it', taps + '<label class="field">Note for the crew fixing it (you can skip this if you tapped one)');
  };
}

/* ---------- 3. "Who fixed it?": the photo its text promises ----------
   Turbo Assist: the correction step of a failed report (a corrective action and a new photo). */
function ppFixPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    PP.fixPhoto = reader.result;
    const box = document.getElementById('pp-fixshot');
    if (box) box.innerHTML = `<img src="${PP.fixPhoto}" alt="Photo of the fix"><span>Photo added</span>`;
  };
  reader.readAsDataURL(file);
}
{
  const baseWho = fixedModal;
  fixedModal = function (id) {
    PP.fixPhoto = null;
    baseWho(id);
    if (PP.raw) return;
    document.querySelector('.modal .qc-pick')?.insertAdjacentHTML('beforebegin', `<div class="pp-fixphoto"><label class="secondary">${icon('plus', 18)} Take a photo of the fix<input id="pp-fixfile" type="file" accept="image/*" capture="environment" onchange="ppFixPhoto(this)"></label><div id="pp-fixshot"></div></div>
      <p class="pp-need"><strong>What we need:</strong> type what was done, or take a photo. Then tap who fixed it.</p>`);
  };
  const baseFixed = markFixed;
  markFixed = function (id, n) {
    const text = document.getElementById('tp-fix')?.value.trim();
    if (typeof pgAsks === 'function' && pgAsks() && document.getElementById('pp-fixfile') && !text && !PP.fixPhoto) return toast('Type what was done, or take a photo, first.');
    if (PP.fixPhoto) rw(id).fixPhoto = PP.fixPhoto;
    PP.fixPhoto = null;
    baseFixed(id, n);
  };
  const baseCard = reworkCard;
  reworkCard = function (r, withBuilding = false) {
    const html = baseCard(r, withBuilding);
    return r.fixPhoto ? html.replace(/<\/div>\s*$/, `<p class="pp-fixed"><img src="${r.fixPhoto}" alt="Photo of the fix">Photo of the fix</p></div>`) : html;
  };
}

/* ---------- 10. The QC report keeps the numbers; the work list and the rules live on Buildings ---------- */
{
  const split = () => {
    const box = document.createElement('div');
    try { box.innerHTML = QC_SCREENS['qc-report']({ ppFull: true }); } catch (e) { return { dash: '', rules: '' }; }
    const dash = box.querySelector('.tp-dash'), rules = dash?.querySelector('.tp-qcset');
    rules?.remove();
    return { dash: dash ? dash.outerHTML : '', rules: rules ? rules.outerHTML : '' };
  };
  const baseReport = QC_SCREENS['qc-report'];
  QC_SCREENS['qc-report'] = function (opt) {
    const html = baseReport.call(this);
    if (opt?.ppFull || PP.raw || typeof html !== 'string') return html;
    const box = document.createElement('div');
    box.innerHTML = html;
    const dash = box.querySelector('.tp-dash');
    if (!dash) return html;
    dash.outerHTML = '<p class="pp-moved">Looking for the work list or the QC rules? They are on the Buildings screen now.</p>';
    return box.innerHTML;
  };
  const baseHome = QC_SCREENS.qc;
  QC_SCREENS.qc = function (...args) {
    const html = baseHome.apply(this, args);
    if (PP.raw || typeof html !== 'string') return html;
    const x = split();
    const extra = `${x.dash}<details class="panel pp-rules" ${PP.rulesOpen ? 'open' : ''} ontoggle="PP.rulesOpen=this.open"><summary><h2>QC rules</h2></summary>${x.rules}</details>`;
    return /<p class="lede-small"/.test(html) ? html.replace(/<p class="lede-small"(?![\s\S]*<p class="lede-small")/, extra + '<p class="lede-small"') : html + extra;
  };
}

/* ---------- 8. Sample buildings: a passed inspection has its answers ---------- */
function ppSeedAnswers() {
  try {
    for (const b of Q.builds) {
      const r = b.results?.[QC];
      if (!r || r.answers) continue;
      const open = new Set(openRework(b).map((x) => x.itemId)), ans = {};
      for (const s of CHECK[QC]) for (const i of s.items) if (!skipReason(b, i)) ans[i.id] = open.has(i.id) ? 'fail' : 'pass';
      r.answers = ans;
    }
  } catch (e) {}
}
ppSeedAnswers();

/* ---------- 1 and 9. After the page is drawn ---------- */
{
  const drawn = render;
  render = function () {
    drawn.apply(this, arguments);
    if (PP.raw) return;
    try {
      const app = document.getElementById('app');
      for (const el of document.body.children) if (el.id !== 'app') ppFixTree(el); /* menus and tab bars drawn before this file loaded */
      /* Phone board: everything except the heading, the search, the steps and the buildings goes behind a button. */
      const board = app.querySelector('.pp-board');
      if (board) {
        for (const el of board.children) {
          const keep = el.matches('.pagehead, #pr-cols, .qc-filter, details.ops-notes, .pp-morebtn');
          el.classList.toggle('pp-extra', !keep);
        }
        if (!board.querySelector('.pp-morebtn'))
          board.querySelector('.qc-filter')?.insertAdjacentHTML('afterend', `<button type="button" class="secondary pp-morebtn" aria-expanded="${PP.more}" onclick="PP.more=!PP.more;render()">${PP.more ? 'Hide' : 'Show'} loads, requests and settings</button>`);
      }
      /* "Special instructions: None" is not a job left to do. */
      for (const row of app.querySelectorAll('.od-doc, .of-check')) if (/Special instructions/.test(row.textContent) && /None on this order/.test(row.textContent)) row.classList.add('pp-nothing');
    } catch (e) {}
  };
}
