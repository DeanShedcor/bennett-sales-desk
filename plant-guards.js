/* plant-guards.js: the plant asks before big things, lets a slip be taken back, and shows the crew
   what QC found. Production and Plant QC.

   What it adds, in the order the owner asked for it (Nov 16, 2026):
   1. Closing a load with unfinished buildings, or removing a load, asks first. A removed load is
      kept in the closed list, marked removed, and its buildings say they are not on a load.
   2. A closed or removed load can be opened again from the closed list.
   3. Every phase move shows "Undo" for 10 seconds.
   4. "Send back to Roofing", with a reason, for a building that reached the QC check by mistake.
   5. Pay steps and QC rules need Settings access, ask first, and are written down with a name.
   6. A building in rework shows what QC found on its Production page, and a count on its card.
   7. The plant serial leads on every Plant QC screen; the order number comes second.
   8. One search on QC Buildings finds a serial, an order number or a customer.
   9. "New load" makes the load only when Save is pressed.
   10. "Yes to the other N" asks first, and can be undone for 10 seconds.
   11. The note box sits above the move buttons, and history says who made each move.

   Turbo Assist (bennett-buddy, read at commit b42d324): a phase move is `transitionUnitPhase`, the
   history is `mfg_unit_phase_history` (it has a "who"), loads are `mfg_production_loads`, pay steps
   are `is_pay_trigger` on the phase. Undo, "Send back", "Open again" for a load, the ask-first
   steps and the Settings lock are features the product still has to accept.
   Loaded after office-polish.js; wraps the plant's functions. */

const PG = { undo: null, timer: null, lost: {}, back: {}, log: [], bootAt: Date.now(), opening: false, pendingQc: false, closedOpen: false };
const pgAsks = () => !(typeof OG !== 'undefined' && OG.live); /* checks that are not about these questions switch them off */
const pgWho = () => (typeof adMe === 'function' ? adMe().name : 'Plant');
const pgLead = () => typeof adCan !== 'function' || adCan('prod', 'edit');
const pgCanSet = () => typeof adCan !== 'function' || adCan('settings', 'edit');
const pgBefore = () => phaseNames[PR_QA - 1]; /* the phase just before the QC check */
function pgLog(what, from, to) {
  const row = { what, from, to, who: pgWho(), at: Date.now() };
  PG.log.unshift(row);
  if (typeof OG !== 'undefined') OG.log.unshift(row); /* the Office's Settings history lists it too */
}
const pgLogList = (rows) => (rows.length ? `<ul class="qc-log pg-log">${rows.slice(0, 8).map((x) => `<li><strong>${esc(x.what)}: ${esc(x.from)} → ${esc(x.to)}</strong><small>${esc(x.who)} · ${tpStamp(x.at)}</small></li>`).join('')}</ul>` : '');

/* ---------- Undo, for 10 seconds ---------- */
function pgUndoClear() {
  clearTimeout(PG.timer);
  PG.undo = null;
  document.getElementById('pg-undo')?.remove();
}
function pgUndoBar(text, fn) {
  pgUndoClear();
  if (!pgAsks()) return;
  PG.undo = fn;
  document.body.insertAdjacentHTML('beforeend', `<div class="pg-undo" id="pg-undo" role="status"><span>${esc(text)}</span><button type="button" onclick="pgUndoGo()">Undo</button><i></i></div>`);
  PG.timer = setTimeout(pgUndoClear, 10000);
}
function pgUndoGo() {
  const fn = PG.undo;
  pgUndoClear();
  if (fn) fn();
}

/* ---------- Who made each move ---------- */
/* Anything written to a building's history since the page opened gets the name of the person using the app. */
function pgStamp() {
  const who = pgWho();
  for (const list of Object.values(PR.hist)) for (const h of list) if (!h.who && h.at >= PG.bootAt) h.who = who;
}
const pgPayTrim = (id, to) => {
  if (!TP.pay[id]) return;
  TP.pay[id] = TP.pay[id].filter((x) => x.phase <= to);
  if (!TP.pay[id].length) delete TP.pay[id];
};
/* Put a building that is still on the floor into a phase, without the usual checks. */
function pgSetPhase(id, to, note, since) {
  const u = prUnit(id);
  if (!u) return;
  const from = u.phase;
  if (u.src === 'sale') (u.ref.plantPhase = to), (u.ref.fulfillment = phaseNames[to]), ofLog(u.ref, `Plant: back to ${phaseNames[to]} · ${note}`);
  else if (u.src === 'stock') (u.ref.plantPhase = to), (u.ref.stage = to >= 2 ? 2 : 1);
  else if (u.src === 'sample') u.ref.phase = to;
  (PR.hist[id] ||= []).push({ from, to, at: Date.now(), note, who: pgWho() });
  PR.since[id] = since || Date.now();
  TP.lastPhase[id] = to;
  pgPayTrim(id, to);
}

/* ---------- 4. Send a building back from the QC check ---------- */
/* The building leaves the Plant QC list and goes back to the phase before it. QC's history is
   kept; open failures are closed as "sent back", and the check starts over when it returns. */
function pgBack(id, reason, opt = {}) {
  const u = prUnit(id), b = typeof build === 'function' ? build(id) : null;
  if (!u || !b || b.stage === LAST) return false;
  const to = opt.to ?? PR_QA - 1, at = Date.now(), who = pgWho();
  Q.builds = Q.builds.filter((x) => x !== b);
  delete Q.drafts[b.serial + '|' + QC];
  for (const r of Q.rework) if (r.serial === b.serial && r.step < 2) Object.assign(r, { step: 2, closedAt: at, closedBy: `${who} (sent back to ${phaseNames[to]})`, sentBack: true });
  record(b.serial, QC, `Sent back to ${phaseNames[to]}: ${reason}`, at, who);
  (PG.back[id] ||= []).push({ at, reason, who });
  if (u.src === 'sale') (u.ref.built = null), (u.ref.plantPhase = to), (u.ref.fulfillment = phaseNames[to]), ofLog(u.ref, `Plant: sent back to ${phaseNames[to]} · ${reason}`);
  else if (u.src === 'stock') (u.ref.plantPhase = to), (u.ref.stage = 2);
  else if (u.src === 'sample') u.ref.phase = to;
  else if (u.src === 'qc') PR.samples.push({ id, size: b.size, style: b.style, lot: u.lotId, phase: to, c: b.c, at0: at });
  (PR.hist[id] ||= []).push({ from: PR_QA, to, at, note: opt.undo ? `Undo: ${reason}` : `Sent back from the QC check: ${reason}`, who });
  PR.since[id] = opt.since || at;
  TP.lastPhase[id] = to;
  pgPayTrim(id, to);
  if (Q.serial === id) Q.serial = null;
  if (Q.signSerial === id) Q.signSerial = null;
  return true;
}
const PG_WHY = ['Moved here by mistake', 'It is not finished yet', 'Wrong building'];
function pgBackAsk(id) {
  const u = prUnit(id), to = pgBefore();
  if (!u) return;
  modal(`Send it back to ${to}?`, `<p><strong>${esc(u.serial || u.id)}</strong> · ${esc(u.name)}</p>
    <p>Use this when a building was moved to the QC check by mistake. It goes back to ${to} so the crew can finish it. The QC check starts over when it comes back.</p>
    <div class="of-feepick">${PG_WHY.map((r) => `<button type="button" class="chipbtn pg-btn" onclick="$('#pg-why').value=this.textContent">${r}</button>`).join('')}</div>
    <label class="field">Why is it going back?<input id="pg-why" maxlength="120" placeholder="Pick one above, or type the reason"></label>
    <div class="actions">${button(`Send back to ${to}`, `pgBackGo('${id}')`, 'primary pg-btn')}${button('Leave it here', 'closeModal()', 'secondary pg-btn')}</div>`);
}
function pgBackGo(id) {
  const reason = $('#pg-why').value.trim(), to = pgBefore();
  if (!reason) return toast('Say why it is going back.');
  if (!pgBack(id, reason)) return toast('This building has already been signed off, so it cannot go back.');
  closeModal();
  if (QC_SCREENS[S.page]) go('qc');
  else render();
  toast(`Sent back to ${to}.`);
}

/* ---------- 3. Undo on every phase move, and who moved it ---------- */
{
  const baseMove = prMove;
  prMove = function (id, to, note = '') {
    const u = prUnit(id), n = (PR.hist[id] || []).length;
    const before = u && { phase: u.phase, since: PR.since[id] };
    baseMove(id, to, note);
    if (!u || (PR.hist[id] || []).length === n) return; /* it did not move */
    pgStamp();
    pgUndoBar(to === PR_QA ? `Sent to the QC check.` : `Moved to ${phaseNames[to]}.`, () => {
      if (to === PR_QA) pgBack(id, 'moved by mistake', { undo: true, to: before.phase, since: before.since });
      else pgSetPhase(id, before.phase, 'Undo: moved by mistake', before.since);
      render();
      toast(`Put back in ${phaseNames[before.phase]}.`);
    });
  };
}

/* ---------- 1, 2, 9. Loads: ask first, keep removed loads, open again, no empty loads ---------- */
const pgLoadLine = (u) => `<li><strong>${esc(u.size.replace('x', ' × '))}</strong> ${esc(u.name.replace(u.size, '').trim())} · ${phaseNames[u.phase]}</li>`;
{
  const baseClose = tpLoadClose;
  tpLoadClose = function (code, sure) {
    const l = prLoad(code);
    if (!l) return baseClose(code);
    const open = l.units.map(prUnit).filter((u) => u && u.phase < PR_DONE);
    if (pgAsks() && !sure && open.length)
      return modal(`Close load ${esc(code)}?`, `<p><strong>${open.length} of its ${tpPlural(l.units.length, 'building')} ${open.length === 1 ? 'is' : 'are'} not finished yet.</strong></p>
        <ul class="pg-list">${open.map(pgLoadLine).join('')}</ul>
        <p>Closing takes the load off the board. The buildings stay where they are. You can open the load again under “Closed loads”.</p>
        <div class="actions">${button('Close the load', `tpLoadClose('${code}',true)`, 'primary pg-btn')}${button('Keep it open', 'closeModal()', 'secondary pg-btn')}</div>`);
    closeModal();
    Object.assign(l, { prevState: l.state, closedBy: pgWho() });
    baseClose(code);
    pgUndoBar(`Load ${code} closed.`, () => pgLoadReopen(TP.closedLoads.indexOf(l)));
  };
  const baseDrop = prLoadDrop;
  prLoadDrop = function (code, sure) {
    const l = prLoad(code);
    if (!l || !l.units.length || l.draft) return baseDrop(code); /* "Cancel" on a load that was never saved */
    if (pgAsks() && !sure)
      return modal(`Remove load ${esc(code)}?`, `<p>Its ${tpPlural(l.units.length, 'building')} stay${l.units.length === 1 ? 's' : ''} at the plant, but ${l.units.length === 1 ? 'it' : 'they'} will not be on a load any more.</p>
        <ul class="pg-list">${l.units.map(prUnit).filter(Boolean).map(pgLoadLine).join('')}</ul>
        <p>The load is kept under “Closed loads”, marked removed, so you can bring it back.</p>
        <div class="actions">${button('Remove the load', `prLoadDrop('${code}',true)`, 'primary pg-btn')}${button('Keep the load', 'closeModal()', 'secondary pg-btn')}</div>`);
    const at = Date.now(), who = pgWho();
    Object.assign(l, { removed: true, prevState: l.state, state: 'removed', closedAt: at, closedBy: who });
    for (const id of l.units) {
      const u = prUnit(id);
      PG.lost[id] = { code, at };
      if (u) (PR.hist[id] ||= []).push({ from: u.phase, to: u.phase, at, note: `Load ${code} was removed. This building is not on a load now.`, who });
    }
    PR.loads = PR.loads.filter((x) => x !== l);
    TP.closedLoads.push(l);
    closeModal();
    render();
    toast(`Load ${code} removed. Its buildings are not on a load now.`);
    pgUndoBar(`Load ${code} removed.`, () => pgLoadReopen(TP.closedLoads.indexOf(l)));
  };
  /* "New load": nothing is made until Save. Closing the pop-up any other way leaves no load behind. */
  const baseNew = prLoadNew;
  prLoadNew = function () {
    const had = new Set(PR.loads);
    PG.opening = true;
    try { baseNew(); } finally { PG.opening = false; }
    const l = PR.loads.find((x) => !had.has(x));
    if (!l) return;
    l.draft = true;
    toast(`Pick the buildings for load ${l.id}, then press Save.`);
  };
  const baseSave = prLoadSave;
  prLoadSave = function (code) {
    const l = prLoad(code), picked = document.querySelectorAll('.pr-picklist input:checked').length;
    if (l && picked) delete l.draft; /* it is a real load from here on, so the board shows it */
    baseSave(code);
    if (l && l.units.length) for (const id of l.units) delete PG.lost[id];
  };
  const baseClosePop = closeModal;
  closeModal = function () {
    baseClosePop();
    if (PG.opening) return;
    if (PR.loads.some((l) => l.draft && !l.units.length)) PR.loads = PR.loads.filter((l) => !(l.draft && !l.units.length));
    if (PG.pendingQc) (PG.pendingQc = false), render(); /* a QC rule question was closed without an answer: put the tick back */
  };
  const baseStrip = prLoadStrip;
  prLoadStrip = function () {
    const all = PR.loads;
    PR.loads = all.filter((l) => !l.draft);
    let html;
    try { html = baseStrip(); } finally { PR.loads = all; }
    const closed = TP.closedLoads;
    if (!closed.length) return html;
    const list = `<details class="tp-closed pg-closed" ${PG.closedOpen ? 'open' : ''} ontoggle="PG.closedOpen=this.open"><summary>Closed loads <small>${closed.length}</small></summary>${closed.map((l, i) => [l, i]).reverse().map(([l, i]) => `<p class="pg-closedrow"><span class="lg-code">${esc(l.id)}</span><span class="grow"><strong>${l.alias ? esc(l.alias) : 'Load ' + esc(l.id)}</strong> · ${tpPlural(l.units.length, 'building')} · ${l.removed ? 'removed' : 'closed'} ${tpStamp(l.closedAt)}${l.closedBy ? ' by ' + esc(l.closedBy) : ''}</span>${l.removed ? '<span class="pill red">Removed</span>' : ''}<button type="button" class="secondary small pg-btn" onclick="pgLoadReopen(${i})">Open again</button></p>`).join('')}</details>`;
    return /<details class="tp-closed">[\s\S]*?<\/details>/.test(html) ? html.replace(/<details class="tp-closed">[\s\S]*?<\/details>/, list) : html.replace(/<\/section>$/, list + '</section>');
  };
}
function pgLoadReopen(i) {
  const l = TP.closedLoads[i];
  if (!l) return;
  TP.closedLoads.splice(i, 1);
  let moved = '';
  if (PR.loads.some((x) => x.id === l.id)) {
    const code = tpNextCode();
    if (!code) return TP.closedLoads.splice(i, 0, l), toast('Every load letter is in use. Close a finished load first.');
    moved = ` Letter ${l.id} was taken, so it is load ${code} now.`;
    l.id = code;
  }
  l.units = l.units.filter((id) => !prLoadOf(id)); /* a building put on another load since stays there */
  for (const id of l.units) delete PG.lost[id];
  l.state = l.prevState && !['closed', 'removed'].includes(l.prevState) ? l.prevState : 'dispatched';
  delete l.removed;
  delete l.closedAt;
  delete l.closedBy;
  PR.loads.push(l);
  PG.closedOpen = false;
  render();
  toast(`Load ${l.id} is open again.${moved}`);
}

/* ---------- 5. Pay steps and QC rules: Settings access, ask first, write it down ---------- */
{
  const basePay = tpPayToggle;
  tpPayToggle = function (i, sure) {
    const p = TP.phases[i];
    if (!pgCanSet()) return toast('Only a person with Settings access can change pay steps.');
    if (pgAsks() && !sure)
      return modal(p.pay ? `Stop paying on ${p.name}?` : `Pay the crew when a building reaches ${p.name}?`, `<p>${p.pay ? `Buildings that reach ${p.name} will no longer go on the labor pay list.` : `Every building that moves into ${p.name} will go on the labor pay list.`}</p>
        <p class="source">This change is written down with your name.</p>
        <div class="actions">${button('Yes, change it', `tpPayToggle(${i},true)`, 'primary pg-btn')}${button('No, leave it', 'closeModal()', 'secondary pg-btn')}</div>`);
    closeModal();
    const was = p.pay;
    basePay(i);
    pgLog(`Pay step: ${p.name}`, was ? 'on' : 'off', p.pay ? 'on' : 'off');
    render();
  };
  const basePhases = OPS_SCREENS['pr-phases'];
  OPS_SCREENS['pr-phases'] = tpPhasesPage = function () {
    let html = basePhases();
    if (!pgCanSet())
      html = html.replace(/<button type="button" class="secondary small" onclick="tpPayToggle\(\d+\)">[^<]*<\/button>/g, '')
        .replace('<section class="panel tp-phases">', `<p class="pg-locked">${icon('lock', 16)} Only a person with Settings access can change pay steps. Ask the office if one needs to change.</p><section class="panel tp-phases">`);
    const rows = PG.log.filter((x) => x.what.startsWith('Pay step'));
    return rows.length ? html.replace('<div class="grid2" style="margin-top:20px">', `<section class="panel" style="margin-top:20px"><h2>Changes to pay steps</h2>${pgLogList(rows)}</section><div class="grid2" style="margin-top:20px">`) : html;
  };
}
const PG_QC_RULES = {
  photos: ['Failure photos required', 'Inspectors must add a photo when they fail an item.', 'Inspectors will be able to fail an item with no photo.'],
  notes: ['Failure notes required', 'Inspectors must write a note when they fail an item.', 'Inspectors will be able to fail an item with no note.'],
  consume: ['Final QA issues recipe materials', 'Materials are counted as used when a building passes its last check.', 'Materials will not be counted as used when a building passes its last check.'],
};
function pgQcSet(key, el, sure) {
  const on = typeof el === 'boolean' ? el : el.checked, [name, onText, offText] = PG_QC_RULES[key];
  if (!pgCanSet()) return render(), toast('Only a person with Settings access can change QC rules.');
  if (pgAsks() && !sure) {
    modal(`${on ? 'Turn on' : 'Turn off'} “${name}”?`, `<p>${on ? onText : offText}</p><p class="source">This change is written down with your name.</p>
      <div class="actions">${button('Yes, change it', `pgQcSet('${key}',${on},true)`, 'primary pg-btn')}${button('No, leave it', 'closeModal()', 'secondary pg-btn')}</div>`);
    PG.pendingQc = true;
    return;
  }
  PG.pendingQc = false;
  closeModal();
  const was = TP.qc[key];
  TP.qc[key] = on;
  if (was !== on) pgLog(`QC rule: ${name}`, was ? 'on' : 'off', on ? 'on' : 'off');
  render();
  toast(`${name}: ${on ? 'on' : 'off'}.`);
}

/* ---------- 6. What QC found, shown to the crew ---------- */
function pgFailPanel(u) {
  const open = u.qc ? openRework(u.qc) : [];
  if (!open.length) return '';
  return `<section class="panel pg-fails"><div class="panelhead"><h2>What the QC check found</h2><span class="pill red">${open.length} to fix</span></div>
    <p class="of-soft">Fix ${open.length === 1 ? 'this' : 'these'}, then tell QC. The building cannot pass until ${open.length === 1 ? 'it is' : 'each one is'} fixed and checked again.</p>
    ${open.map((r) => {
      const photos = [r.photo, ...(r.photos || [])].filter(Boolean);
      return `<div class="pg-fail"><div class="buildrow-head"><strong class="grow">${esc(r.ask || askText(u.qc, ITEM[r.itemId] || { text: r.item }))}</strong><span class="pill red">${esc(r.defect)}</span></div>
        <p>${r.note ? esc(r.note) : 'No note was written.'}</p>
        ${photos.length ? `<div class="pg-photos">${photos.map((src, k) => `<img src="${src}" alt="Photo ${k + 1} of the problem">`).join('')}</div>` : '<small>No photo on this one.</small>'}
        <small>Found by ${esc(r.by)} · ${age(r.openedAt)} ago · ${r.step === 1 ? `Fixed${r.fixedBy ? ' by ' + esc(r.fixedBy) : ''}. Waiting for QC to look again.` : r.assigned ? `Crew: ${esc(r.assigned)}` : 'No crew picked yet'}</small></div>`;
    }).join('')}
    <div class="actions">${button('Open it in Plant QC ' + icon('arrow', 16), `openBuild('${u.id}')`, 'secondary pg-btn')}</div></section>`;
}
{
  const baseFlags = prFlags;
  prFlags = function (u) {
    let html = baseFlags(u);
    const n = u.qc && u.phase === PR_QA ? openRework(u.qc).length : 0, lost = PG.lost[u.id];
    if (n) html = `<span class="ops-flag bad pg-fixcount">${n} to fix</span>` + html;
    if (lost && !prLoadOf(u.id)) html += `<span class="ops-flag todo">Load ${esc(lost.code)} was removed. Not on a load.</span>`;
    return html;
  };
  /* 11. The note box first, and a history that says who. 4. Send back. 6. What QC found. */
  const baseUnit = OPS_SCREENS['pr-unit'];
  OPS_SCREENS['pr-unit'] = prUnitPage = function () {
    pgStamp();
    let html = baseUnit();
    const u = prUnit(PR.id);
    if (!u) return html;
    const note = /<label class="field">Optional transition note<input id="pr-note"[^>]*><\/label>/.exec(html);
    if (note) html = html.replace(note[0], '').replace('<div class="pr-move">', `<label class="field pg-note">Note for the next crew (you can skip this)<input id="pr-note" maxlength="120" placeholder="Anything the next crew should know"></label><div class="pr-move">`);
    const hist = PR.hist[u.id] || [];
    html = html.replace(/<section class="panel"><h2>History<\/h2>[\s\S]*?<\/section>/, `<section class="panel pg-hist"><h2>History</h2>${hist.slice().reverse().map((h) => `<div class="log"><small>${prStamp(h.at)}${h.who ? ' · ' + esc(h.who) : ''}</small><br>${h.from === h.to ? esc(h.note) : `${phaseNames[h.from]} → ${phaseNames[h.to]}${h.note ? ' · ' + esc(h.note) : ''}`}</div>`).join('') || '<p class="empty">No moves yet.</p>'}</section>`);
    html = html.replace('<li>Who moved it: there are no logins, so history has no names.</li>', '<li>Who moved it: the name of the person the app is being viewed as.</li><li>Undo on a move, “Send back” from the QC check, and opening a closed load again.</li>');
    if (u.qc && u.phase === PR_QA && pgLead())
      html = html.replace(/(<button[^>]*onclick="openBuild\('[^']*'\)"[^>]*>Open it in Plant QC[\s\S]*?<\/button>)/, `$1${button(`Send back to ${pgBefore()}`, `pgBackAsk('${u.id}')`, 'secondary pg-btn')}`);
    const fails = pgFailPanel(u);
    return fails ? html.replace('<div class="od-grid"><div class="od-col">', `<div class="od-grid"><div class="od-col">${fails}`) : html;
  };
}

/* ---------- 10. "Yes to the other N": ask first, then 10 seconds to take it back ---------- */
{
  const baseRest = yesToRest;
  yesToRest = function (n, sure) {
    const b = build(Q.serial), d = draftOf(b), s = CHECK[QC][n];
    const left = s.items.filter((i) => !skipReason(b, i) && !d.answers[i.id]?.r);
    if (!left.length) return;
    if (pgAsks() && !sure)
      return modal(`Pass the other ${left.length} ${left.length === 1 ? 'item' : 'items'} in this group?`, `<p>Group: <strong>${esc(s.section)}</strong></p>
        <ul class="pg-list">${left.map((i) => `<li>${esc(askText(b, i))}</li>`).join('')}</ul>
        <p>${left.length === 1 ? 'It' : 'Each one'} will be marked Yes. Only do this if you looked at ${left.length === 1 ? 'it' : 'every one'}.</p>
        <div class="actions">${button(left.length === 1 ? 'Yes, pass it' : `Yes, pass all ${left.length}`, `yesToRest(${n},true)`, 'primary pg-btn')}${button('No, go back', 'closeModal()', 'secondary pg-btn')}</div>`);
    const hadBulk = (d.bulk || []).includes(s.section);
    closeModal();
    baseRest(n);
    pgUndoBar(`${left.length} ${left.length === 1 ? 'item' : 'items'} marked Yes.`, () => {
      for (const i of left) if (d.answers[i.id]?.r === 'pass') delete d.answers[i.id].r;
      if (!hadBulk) d.bulk = (d.bulk || []).filter((x) => x !== s.section);
      render();
      toast('Taken back. Those items have no answer now.');
    });
  };
}

/* ---------- 7. Plant serial first on every Plant QC screen ---------- */
function pgSerialFirst(html) {
  if (typeof html !== 'string') return html;
  html = html.replace(/<small class="serial tp-ps">[^<]*<\/small>/g, '');
  const ids = Object.keys(TP.serials).filter((id) => html.includes(id)).sort((a, b) => b.length - a.length);
  for (const raw of ids) {
    const ps = esc(TP.serials[raw]), id = esc(raw), re = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html
      .replace(new RegExp(`<h3>${re}</h3>`, 'g'), `<h3>${ps}</h3><small class="serial pg-order">Order ${id}</small>`)
      .replace(new RegExp(`<strong>${re}</strong>`, 'g'), `<strong>${ps}</strong> <small class="pg-order">Order ${id}</small>`)
      .replace(new RegExp(`>${re}( ·|,)`, 'g'), `>${ps} · order ${id}$1`)
      .split(`>${ps} · ${id} · `).join(`>${ps} · order ${id} · `);
  }
  return html;
}

/* ---------- 8. One search on QC Buildings ---------- */
{
  const baseList = floorList;
  floorList = function () {
    const typed = Q.f.q, q = typed.trim().toLowerCase(), all = Q.builds;
    let pool = typeof adLimited === 'function' && adLimited() && typeof adSeesRec === 'function' ? all.filter(adSeesRec) : all;
    if (q) pool = pool.filter((b) => `${b.serial} ${tpSerial(b.serial)} ${b.order || ''} ${b.customer || ''} ${b.size} ${b.style}`.toLowerCase().includes(q));
    Q.builds = pool;
    Q.f.q = '';
    let html;
    try { html = baseList(); } finally { Q.builds = all; Q.f.q = typed; }
    if (q && !pool.length) {
      /* Not on the QC list: say where the building is, as the old "Look up a serial" box did. */
      const r = taSerialStatus(typed), safe = String(r.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (r.found) html = html.replace('<p>Nothing fits that search and those filters.</p>', `<p class="pg-where">${esc(r.text)}</p><div class="actions">${r.inQc ? button('Open in Plant QC', `openBuild('${safe}')`, 'secondary pg-btn') : ''}${r.onBoard ? button('Open in Production', `prOpen('${safe}')`, 'secondary pg-btn') : ''}</div>`);
    }
    return pgSerialFirst(html);
  };
  for (const page of Object.keys(QC_SCREENS)) {
    const draw = QC_SCREENS[page];
    QC_SCREENS[page] = function (...args) {
      let html = draw.apply(this, args);
      if (typeof html !== 'string') return html;
      if (page === 'qc')
        html = html.replace(/<section class="panel tp-lookup">[\s\S]*?<\/section>/, '')
          .replace('placeholder="Search by serial or customer" aria-label="Search by serial or customer"', 'placeholder="Search by serial number, order number or customer" aria-label="Search by serial number, order number or customer"');
      if (page === 'qc-report') {
        const lock = !pgCanSet();
        for (const key of Object.keys(PG_QC_RULES)) html = html.replace(`onchange="TP.qc.${key}=this.checked;render()"`, `onchange="pgQcSet('${key}',this)"${lock ? ' disabled' : ''}`);
        const rows = PG.log.filter((x) => x.what.startsWith('QC rule'));
        html = html.replace('<div class="tp-qcset"><h3>QC settings</h3>', `<div class="tp-qcset"><h3>QC settings</h3>${lock ? `<p class="pg-locked">${icon('lock', 16)} Only a person with Settings access can change these.</p>` : ''}`)
          .replace('<p class="source">A failure takes up to three photos either way.', `${pgLogList(rows)}<p class="source">A failure takes up to three photos either way.`);
      }
      if (page === 'qc-inspect') {
        const b = Q.serial && build(Q.serial);
        if (b && b.stage !== LAST && pgLead() && prUnit(b.serial))
          html = html.replace('<h2 class="sectionhead">History</h2>', `<section class="panel pg-backbox"><div class="grow"><strong>Here by mistake?</strong><span>If this building is not finished, send it back to the crew.</span></div>${button(`Send back to ${pgBefore()}`, `pgBackAsk('${b.serial}')`, 'secondary pg-btn')}</section><h2 class="sectionhead">History</h2>`);
      }
      return pgSerialFirst(html);
    };
  }
}

/* A new name in a building's history the moment the screen is drawn. */
{
  const drawn = render;
  render = function () {
    pgStamp();
    drawn.apply(this, arguments);
  };
}
