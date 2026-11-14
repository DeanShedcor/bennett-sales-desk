/* production.js: the Production side. The plant's board for the nine build phases.

   Two authorities. This preview decides how the board looks and the order the plant works in.
   Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does: this side is
   drawn as its Manufacturing → Build pipeline → Plant Kanban. Same nine phases in the same order,
   the same four counts, a building moved one phase at a time with an optional note, the plant
   packet on each building, and a history of every move. Every control names the function it
   would call; what exists only here is listed on the notes page.

   What is on the board:
   - Customer orders the office approved (and, in the first column, the ones it is still reviewing).
   - The lots' stock orders, once the office approves them.
   - Sample stock builds, so the middle of the line is not empty.
   - Buildings that are with plant QC (Final QA) or signed off (Build complete), until they leave.
   Moving a building to Final QA hands it to the Plant QC side. QC's sign-off is what puts it in
   Build complete, and from there the office releases it and Logistics moves it.

   Nothing is saved: a reload starts over. Loaded after logistics-screens.js. */

const PR = { id: null, back: 'prod', path: 'All', q: '', tile: 'all', phase: null, since: {}, hist: {}, holds: {}, samples: [] };
const PR_QA = phaseNames.indexOf('Final QA'), PR_DONE = phaseNames.length - 1;
const PR_HOLDS = ['Waiting on materials', 'Waiting on a change order', 'Waiting on the customer', 'Equipment down'];
const PR_PATHS = ['All sale paths', 'Stock', 'Cash', 'RTO'];
const prAgo = (t) => {
  const h = Math.max(0, Math.round((Date.now() - t) / 36e5));
  return h < 1 ? 'under an hour' : h < 48 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.round(h / 24)} days`;
};
const prStamp = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* ---------- Every building on the board, from wherever it lives ----------
   src: sale (a customer's order), stock (a lot's stock order), sample (a made-up stock build),
   qc (a sample building that only the Plant QC side knows). */
function prUnits() {
  const out = [], seen = new Set();
  const qcOf = (id) => (typeof build === 'function' ? build(id) : null);
  const gone = (id) => { const u = typeof lgUnit === 'function' && lgUnit(id); return !!u && u.at !== 'plant'; };
  const withQc = (b, phase) => (b ? (b.stage === LAST ? PR_DONE : PR_QA) : phase);
  const add = (u) => (seen.add(u.id), out.push({ hold: PR.holds[u.id] || null, since: PR.since[u.id] || u.at0 || Date.now(), ...u }));

  for (const s of S.sales) {
    const stage = typeof ofStage === 'function' ? ofStage(s) : null;
    if (['lot', 'site', 'stock'].includes(s.path) || !['review', 'hold', 'approved'].includes(stage) || gone(s.id)) continue;
    const b = qcOf(s.id), phase = stage !== 'approved' ? 0 : withQc(b, Math.max(1, Math.min(s.plantPhase ?? 1, PR_QA - 1)));
    add({ id: s.id, src: 'sale', ref: s, serial: stage === 'approved' ? s.id : '', name: label(s.c), size: s.c.size, c: s.c, customer: s.customer, lotId: saleLot(s).id, path: ofRto(s) ? 'RTO' : 'Cash', phase, qc: b, sample: !!s.sample,
      wait: stage === 'review' ? 'With the office for review' : stage === 'hold' ? 'On hold by the office' : '', at0: s.office?.approved?.at || Date.parse(s.submittedAt || '') || Date.now() });
  }
  S.stock.forEach((r) => {
    if (r.status !== 'Pending' || gone(r.id)) return;
    const b = qcOf(r.id), stage = r.stage || 0, phase = stage === 0 ? 0 : withQc(b, Math.max(1, Math.min(r.plantPhase ?? (stage >= 2 ? 3 : 1), PR_QA - 1)));
    add({ id: r.id, src: 'stock', ref: r, serial: stage ? r.id : '', name: label(r.c), size: r.c.size, c: r.c, customer: '', lotId: DESK_LOT, path: 'Stock', phase, qc: b, sample: !!r.sample,
      wait: stage === 0 ? 'With the office for approval' : '', at0: Date.parse(r.date || '') || Date.now() });
  });
  for (const x of PR.samples) {
    if (gone(x.id)) continue;
    const b = qcOf(x.id);
    add({ id: x.id, src: 'sample', ref: x, serial: x.id, name: `${x.size} ${x.style}`, size: x.size, c: x.c, customer: '', lotId: x.lot, path: 'Stock', phase: withQc(b, x.phase), qc: b, sample: true, at0: x.at0 });
  }
  if (typeof Q !== 'undefined')
    for (const b of Q.builds) {
      if (seen.has(b.serial) || gone(b.serial)) continue;
      const lot = lotByDealer(b.dealer) || lotById(DESK_LOT);
      add({ id: b.serial, src: 'qc', ref: b, serial: b.serial, name: `${b.size} ${b.style}`, size: b.size, c: b.c, customer: b.customer || '', lotId: lot.id, path: b.customer ? 'Cash' : 'Stock', phase: withQc(b, PR_QA), qc: b, sample: /^SAMPLE/.test(b.serial),
        at0: b.signoff?.at || Date.now() - (b.days_in_stage || 0) * 864e5 - 4 * 36e5 });
    }
  return out;
}
const prUnit = (id) => prUnits().find((u) => u.id === id);
const prChanges = (u) => S.changes.filter((c) => c.order === u.id && !c.declined);
const prMatch = (u) => (PR.path === 'All' || PR.path === 'All sale paths' || u.path === PR.path) && (!PR.q.trim() || `${u.serial} ${u.id} ${u.name} ${u.customer} ${lotById(u.lotId).town}`.toLowerCase().includes(PR.q.trim().toLowerCase()))
  && (PR.tile === 'all' || (PR.tile === 'hold' && u.hold) || (PR.tile === 'change' && prChanges(u).some((c) => c.done === 2)));
/* Why a building cannot move to a phase, or '' when it can. */
function prBlock(u, to) {
  if (u.phase === 0) return u.wait ? `${u.wait}. It comes to the plant when the office approves it.` : 'The office has not approved this order yet.';
  if (u.qc) return u.phase === PR_DONE ? 'Signed off by plant QC. The office releases it and Logistics moves it.' : 'Plant QC has this building. QC’s sign-off moves it to Build complete.';
  if (to < 1 || to > PR_QA) return 'A building moves between Order approved and Final QA.';
  if (to === u.phase) return 'It is already in that phase.';
  if (u.hold) return 'On hold. Take it off hold before moving it.';
  if (to > u.phase && prChanges(u).some((c) => c.done === 2)) return 'An approved change order is waiting. Acknowledge it before moving on.';
  return '';
}

/* ---------- Actions ---------- */
function prOpen(id) {
  PR.id = id;
  if (S.page !== 'pr-unit') PR.back = typeof opsSide === 'function' && opsSide(S.page) === 'prod' ? S.page : 'prod';
  go('pr-unit');
}
/* Final QA: the building goes on the Plant QC list. A customer's order does this itself (qc-app.js). */
function prToQc(u) {
  if (typeof Q === 'undefined' || build(u.id)) return;
  const c = u.c, b = { serial: u.id, order: u.id, customer: u.customer || '', c, size: u.size, style: u.name.replace(u.size, '').trim(), dealer: dealerName(lotById(u.lotId)),
    siding_color: c.color, trim_color: c.trimColor || 'Origami White', roof: c.roof === 'Metal' ? (c.roofColor ? c.roofColor + ' metal' : 'Metal') : 'Architectural shingles',
    stage: 0, days_in_stage: 0, results: {}, superseded: [], attempts: {}, hold: null, model_image: null };
  Q.builds.push(b);
  record(b.serial, QC, 'Build complete and ready for QA (moved to Final QA on the Production board)', Date.now(), 'Production');
  if (typeof captureThumb === 'function') captureThumb(b);
}
function prMove(id, to, note = '') {
  const u = prUnit(id);
  if (!u) return;
  const why = prBlock(u, to);
  if (why) return toast(why);
  (PR.hist[id] ||= []).push({ from: u.phase, to, at: Date.now(), note: String(note || '').trim() });
  PR.since[id] = Date.now();
  if (u.src === 'sale') {
    const s = u.ref;
    s.plantPhase = to;
    s.fulfillment = phaseNames[to];
    ofLog(s, `Plant: ${phaseNames[to]}${note ? ' · ' + String(note).trim() : ''}`);
    if (to === PR_QA && !s.built) {
      s.built = odToday();
      ofLog(s, 'Plant: ready for final QA · on the Plant QC list');
      if (typeof syncSales === 'function') syncSales();
    }
  } else if (u.src === 'stock') {
    u.ref.plantPhase = to;
    u.ref.stage = to >= 2 ? 2 : 1;
    if (to === PR_QA) prToQc(u);
  } else if (u.src === 'sample') {
    u.ref.phase = to;
    if (to === PR_QA) prToQc(u);
  }
  render();
  toast(to === PR_QA ? `${u.serial || u.id} is with Plant QC now.` : `Moved to ${phaseNames[to]}`);
}
function prStep(id, by) {
  const u = prUnit(id), note = document.getElementById('pr-note')?.value || '';
  if (u) prMove(id, u.phase + by, note);
}
/* Drag a card onto a phase, as on Turbo Assist's board. */
function prDrag(event, id) {
  event.dataTransfer.setData('text/plain', id);
  event.dataTransfer.effectAllowed = 'move';
}
function prDrop(event, phase) {
  event.preventDefault();
  event.currentTarget.classList.remove('over');
  const id = event.dataTransfer.getData('text/plain');
  if (id) prMove(id, phase);
}
function prHoldForm(id) {
  const u = prUnit(id);
  modal('Put this building on hold', `<p><strong>${esc(u.serial || u.id)}</strong> · ${esc(u.name)} · ${phaseNames[u.phase]}</p>
    <div class="of-feepick">${PR_HOLDS.map((r) => `<button type="button" class="chipbtn" onclick="$('#pr-hold').value=this.textContent">${r}</button>`).join('')}</div>
    <label class="field">Reason<input id="pr-hold" maxlength="120" placeholder="What it is waiting on"></label>
    <p class="source">It stays in its phase and cannot move until the hold comes off. The lot and the office see the reason.</p>
    <div class="actions">${button('Put on hold', `prHoldSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function prHoldSave(id) {
  const reason = $('#pr-hold').value.trim(), u = prUnit(id);
  if (!reason) return toast('A hold needs a reason.');
  PR.holds[id] = { reason, at: Date.now() };
  (PR.hist[id] ||= []).push({ from: u.phase, to: u.phase, at: Date.now(), note: `On hold: ${reason}` });
  if (u.src === 'sale') (u.ref.fulfillment = `${phaseNames[u.phase]} · on hold at the plant`), ofLog(u.ref, `Plant: on hold in ${phaseNames[u.phase]} · ${reason}`);
  closeModal();
  render();
  toast('On hold.');
}
function prHoldOff(id) {
  const u = prUnit(id);
  delete PR.holds[id];
  (PR.hist[id] ||= []).push({ from: u.phase, to: u.phase, at: Date.now(), note: 'Hold lifted' });
  if (u.src === 'sale') (u.ref.fulfillment = phaseNames[u.phase]), ofLog(u.ref, 'Plant: hold lifted');
  render();
  toast('Hold lifted.');
}
function prAck(n) {
  advanceChange(n);
}
function prSheet(id) {
  const u = prUnit(id);
  openBuildSheet(u.src === 'sale' ? u.id : u.qc ? 'qc:' + u.id : 'pr:' + u.id);
}
function prInvoice(id) {
  S.activeSale = id;
  orderDoc('invoice');
}

/* ---------- Screens ---------- */
const prSample = (u) => (u.sample ? '<span class="pill ghost">Sample</span>' : '');
const prFor = (u) => (u.customer ? `${esc(u.customer)} · ${esc(lotById(u.lotId).town)}` : `Stock · ${esc(lotById(u.lotId).town)}`);
function prFlags(u) {
  const ch = prChanges(u), ack = ch.filter((c) => c.done === 2).length, asked = ch.filter((c) => c.done === 1).length;
  return [
    u.wait ? `<span class="ops-flag wait">${esc(u.wait)}</span>` : '',
    u.hold ? `<span class="ops-flag bad">On hold · ${esc(u.hold.reason)}</span>` : '',
    ack ? `<span class="ops-flag todo">Change order to acknowledge</span>` : '',
    asked ? `<span class="ops-flag">Change asked · with the office</span>` : '',
    u.qc && u.phase === PR_QA ? `<span class="ops-flag ${/rework|hold/i.test(qcStatus(u.qc)) ? 'bad' : 'wait'}">QC: ${esc(qcStatus(u.qc))}</span>` : '',
    u.phase === PR_DONE ? '<span class="ops-flag ok">Plant finished</span>' : '',
    u.src === 'sale' && !u.c.sheet?.ok ? '<span class="ops-flag todo">Floor plan not confirmed</span>' : '',
  ].join('');
}
function prCard(u) {
  const move = !u.qc && u.phase > 0;
  return `<article class="pr-card${u.hold ? ' hold' : ''}${move ? '' : ' fixed'}" ${move ? `draggable="true" ondragstart="prDrag(event,'${u.id}')"` : ''} onclick="prOpen('${u.id}')" onkeydown="if(event.key==='Enter')prOpen('${u.id}')" tabindex="0" role="button" aria-label="${esc(u.name)}, ${phaseNames[u.phase]}">
    <b>${esc(u.size.replace('x', ' × '))}</b><span class="pr-style">${esc(u.name.replace(u.size, '').trim())}</span>
    <small class="serial">${esc(u.serial || 'No serial yet')}</small><small>${prFor(u)}</small>
    <small class="pr-age">${prAgo(u.since)} here</small><div class="ops-flags">${prFlags(u)}</div></article>`;
}
function prBoardCols() {
  const list = prUnits().filter(prMatch);
  const sel = PR.phase != null ? PR.phase : (phaseNames.map((_, i) => i).find((i) => i >= 1 && i < PR_QA && list.some((u) => u.phase === i)) ?? 1);
  return `<div class="chiprow pr-pick">${phaseNames.map((n, i) => `<button type="button" class="chipbtn${sel === i ? ' on' : ''}" onclick="PR.phase=${i};render()">${n} <span class="ops-n">${list.filter((u) => u.phase === i).length}</span></button>`).join('')}</div>
  <div class="pr-board">${phaseNames.map((name, i) => {
    const cards = list.filter((u) => u.phase === i).sort((a, b) => a.since - b.since), drop = i >= 1 && i <= PR_QA;
    return `<section class="pr-col${sel === i ? ' sel' : ''}${i === 0 || i >= PR_QA ? ' edge' : ''}" ${drop ? `ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="prDrop(event,${i})"` : ''}>
      <header><strong>${name}</strong><span>${cards.length}</span></header>${cards.slice(0, (i === 0 || i >= PR_QA) && !PR.all ? 5 : 99).map(prCard).join('') || `<p class="pr-empty">${i === 0 ? 'No new orders' : 'Empty'}</p>`}${(i === 0 || i >= PR_QA) && !PR.all && cards.length > 5 ? `<button type="button" class="link pr-more" onclick="PR.all=true;render()">+${cards.length - 5} more</button>` : ''}</section>`;
  }).join('')}</div>`;
}
function prBoard() {
  const all = prUnits(), n = (f) => all.filter(f).length, holds = n((u) => u.hold), acks = n((u) => prChanges(u).some((c) => c.done === 2));
  const kpi = (v, text) => `<div class="kpi"><strong>${v}</strong><span>${text}</span></div>`;
  const chip = (k, text) => `<button type="button" class="chipbtn${PR.tile === k ? ' on' : ''}" onclick="PR.tile=PR.tile==='${k}'?'all':'${k}';render()">${text}</button>`;
  return `${head('Production · ' + esc(PLANTS[0].name) + ', ' + esc(PLANTS[0].town), 'What is being built.', 'Every building on the plant, by phase. Drag a card to its next phase, or open it to move it with a note.')}
  <div class="today ops-tiles">${kpi(n((u) => u.phase >= 2 && u.phase < PR_QA), 'In progress')}${kpi(n((u) => u.phase === PR_QA), 'Final QA')}${kpi(n((u) => u.phase === PR_DONE), 'Build complete')}${kpi(all.length, 'On board')}</div>
  <div class="qc-filter"><label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search serial, customer, location…" aria-label="Search serial, customer or location" value="${esc(PR.q)}" oninput="PR.q=this.value;$('#pr-cols').innerHTML=prBoardCols()"></label>
    <div class="chiprow">${PR_PATHS.map((p) => `<button type="button" class="chipbtn${(PR.path === 'All' ? 'All sale paths' : PR.path) === p ? ' on' : ''}" onclick="PR.path='${p}';render()">${p}</button>`).join('')}${holds ? chip('hold', `On hold <span class="ops-n">${holds}</span>`) : ''}${acks ? chip('change', `Change orders to acknowledge <span class="ops-n">${acks}</span>`) : ''}</div></div>
  <div id="pr-cols">${prBoardCols()}</div>
  <p class="lede-small" style="margin-top:16px">Final QA belongs to Plant QC: a building there moves to Build complete when QC signs it off. Then the office releases it and Logistics takes it off the board.</p>
  ${opsNotes([
    ['The board', 'Manufacturing → Build pipeline → Plant Kanban (<code>ManufacturingBuildPipelineBoard</code>): the nine phases of <code>DEFAULT_BUILD_PIPELINE_PHASES</code>, in order. Phases can be edited per plant (“Phase settings”).'],
    ['The four counts', '“In progress”, “Final QA”, “Build complete”, “On board” (<code>BuildPipelineOverviewStats</code>).'],
    ['Filters and search', '“All sale paths”, “Stock”, “Cash”, “Finance”, “RTO”, and “Search serial, customer, location…”.'],
    ['Dragging a card', '<code>dropOnPhase</code> → <code>transitionUnitPhase</code>. The server does not force the order, so a drag can skip a phase or go back.'],
    ['Order received', 'A unit the office has accepted waits here until the plant packet is complete (<code>submitDealToBuild</code>), which moves it to Order approved and issues its serial (<code>issueSerialForBuildStart</code>).'],
    ['Not drawn here', 'Production loads (<code>mfg_production_loads</code>, “New load”): Turbo Assist groups units into a load before they are built, and Logistics makes the shipment from it.'],
  ], [
    'Orders still with the office shown in Order received, so the plant can see what is coming.',
    'A hold with a reason on a building. Turbo Assist has a unit status “on hold” but no hold button on the board.',
    'Change orders on the card, and stopping a building until the plant acknowledges one.',
    'The order number shown as the serial. Turbo Assist issues a plant serial when the build starts: the plant’s code, a dash and a five-digit number.',
  ])}`;
}
function prRoster() {
  const list = prUnits().filter(prMatch).sort((a, b) => b.phase - a.phase || a.since - b.since);
  return `${head('Production', 'Every building.', 'One line per building, furthest along first.')}
  <div class="qc-filter"><label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search serial, customer, location…" aria-label="Search serial, customer or location" value="${esc(PR.q)}" oninput="PR.q=this.value;$('#pr-rows').innerHTML=prRosterRows()"></label>
    <div class="chiprow">${PR_PATHS.map((p) => `<button type="button" class="chipbtn${(PR.path === 'All' ? 'All sale paths' : PR.path) === p ? ' on' : ''}" onclick="PR.path='${p}';render()">${p}</button>`).join('')}</div></div>
  <div class="ops-list" id="pr-rows">${prRosterRows()}</div>
  ${opsNotes([['This list', 'Build pipeline → Units (<code>ManufacturingUnitsRoster</code>).']], [])}`;
}
function prRosterRows() {
  const list = prUnits().filter(prMatch).sort((a, b) => b.phase - a.phase || a.since - b.since);
  return list.map((u) => `<article class="ops-row"><span class="lg-size"><b>${esc(u.size.replace('x', ' × '))}</b><small>${esc(u.path)}</small></span><div class="grow"><div class="ops-rowtop"><strong>${esc(u.name.replace(u.size, '').trim())}</strong><span class="serial">${esc(u.serial || 'No serial yet')}</span><span class="pill ${u.phase === PR_DONE ? 'good' : u.phase === 0 ? '' : 'blue'}">${phaseNames[u.phase]}</span>${prSample(u)}</div>
    <p class="ops-rowsub">${prFor(u)} · ${prAgo(u.since)} in this phase</p><div class="ops-flags">${prFlags(u)}</div></div>
    <button type="button" class="secondary small" onclick="prOpen('${u.id}')">Open ${icon('arrow', 16)}</button></article>`).join('') || '<div class="panel emptystate"><strong>No buildings match</strong><p>Nothing fits that search and filter.</p></div>';
}
function prUnitPage() {
  const u = prUnit(PR.id);
  if (!u) return `<button class="link backlink" onclick="go('prod')">${icon('back', 18)} Board</button><div class="panel emptystate"><strong>This building has left the plant</strong><p>It is with Logistics now, or it was delivered.</p>${button('Board', "go('prod')", 'secondary')}</div>`;
  const id = u.id, lot = lotById(u.lotId), ch = prChanges(u), hist = PR.hist[id] || [], s = u.src === 'sale' ? u.ref : null;
  const back = u.phase - 1, next = u.phase + 1, whyBack = prBlock(u, back), whyNext = prBlock(u, next), stuck = u.phase === 0 || !!u.qc;
  const notes = s ? [s.site?.notes, s.siteNotes].filter(Boolean).join(' · ') : '';
  const movePanel = `<section class="panel"><div class="panelhead"><h2>Move phase</h2><span class="pill ${u.hold ? 'red' : 'blue'}">${u.hold ? 'On hold' : phaseNames[u.phase]}</span></div>
    ${stuck ? `<p class="of-soft">${esc(prBlock(u, next))}</p>${u.qc ? `<div class="actions">${button('Open it in Plant QC ' + icon('arrow', 16), `openBuild('${id}')`, 'secondary')}</div>` : s && typeof ofOpen === 'function' ? `<div class="actions">${button('Open it in the Office ' + icon('arrow', 16), `ofOpen('${id}')`, 'secondary')}</div>` : ''}`
      : `<div class="pr-move"><button type="button" class="secondary" ${whyBack ? 'disabled' : ''} onclick="prStep('${id}',-1)">← ${back >= 1 ? phaseNames[back] : 'Back'}</button><button type="button" class="primary" ${whyNext ? 'disabled' : ''} onclick="prStep('${id}',1)">${phaseNames[next]} →</button></div>
        ${whyNext ? `<p class="lg-bad">${esc(whyNext)}</p>` : next === PR_QA ? '<p class="of-soft">Final QA hands the building to Plant QC.</p>' : ''}
        <label class="field">Optional transition note<input id="pr-note" maxlength="120" placeholder="Anything the next crew should know"></label>
        <div class="actions">${u.hold ? button('Take off hold', `prHoldOff('${id}')`, 'secondary small') : button('Put on hold', `prHoldForm('${id}')`, 'secondary small')}</div>
        ${u.hold ? `<p class="of-soft">On hold since ${prStamp(u.hold.at)}: ${esc(u.hold.reason)}</p>` : ''}`}</section>`;
  const packet = `<section class="panel"><h2>Plant packet</h2>
    ${ofCheckRow({ state: 'ok', title: 'Order form', text: s ? `Invoice ${esc(orderInvoice(s).number)} · ${esc(s.type || '')}` : u.src === 'stock' ? `Stock order ${esc(id)} from the ${esc(lot.town)} lot` : `Stock build for the ${esc(lot.town)} lot`, act: s ? `<button type="button" class="secondary small" onclick="prInvoice('${id}')">Invoice</button>` : '' })}
    ${ofCheckRow({ state: !s || u.c.sheet?.ok ? 'ok' : 'todo', title: 'Floor plan', text: s ? (u.c.sheet?.ok ? `Confirmed with the customer ${prStamp(u.c.sheet.ok)}` : 'Not confirmed with the customer yet') : 'Standard layout for this model', act: `<button type="button" class="secondary small" onclick="prSheet('${id}')">Build sheet</button>` })}
    ${ofCheckRow({ state: notes ? 'ok' : 'info', title: 'Special instructions', text: notes ? esc(notes) : 'None on this order' })}
    <p class="of-inc">${included(u.c).filter(Boolean).map(esc).join(' · ')}</p></section>`;
  const changes = ch.length ? `<section class="panel"><div class="panelhead"><h2>Change orders</h2><span class="pill ${ch.some((c) => c.done === 2) ? 'amber' : 'ghost'}">${ch.some((c) => c.done === 2) ? 'Acknowledge' : ch.some((c) => c.done === 1) ? 'With the office' : 'Acknowledged'}</span></div>
    ${ch.map((c) => ofCheckRow({ state: c.done >= 3 ? 'ok' : c.done === 2 ? 'todo' : 'wait', title: `Change order ${esc(c.id)}`, text: `${esc(c.what)}${c.reason ? ' · ' + esc(c.reason) : ''} · ${c.done >= 3 ? 'acknowledged by the plant' : c.done === 2 ? 'approved by the office · the plant has to acknowledge it' : 'waiting on the office'}`, act: c.done === 2 ? `<button type="button" class="primary small" onclick="prAck(${S.changes.indexOf(c)})">Acknowledge</button>` : '' })).join('')}</section>` : '';
  return `<button class="link backlink" onclick="go('${PR.back}')">${icon('back', 18)} ${PR.back === 'pr-list' ? 'Every building' : 'Board'}</button>
  ${head(`Production · for ${esc(lotTown(lot))}`, esc(u.serial || 'No serial yet'), `${esc(u.name)} · ${u.customer ? esc(u.customer) : 'stock for the lot'} · ${esc(u.path)}`)}
  <section class="panel of-top"><div class="pillrow"><span class="pill ${u.phase === PR_DONE ? 'good' : 'blue'}">${phaseNames[u.phase]}</span><span class="pill">${prAgo(u.since)} in this phase</span>${prSample(u)}</div>
    ${chevronTrack(phaseNames, u.phase === PR_DONE ? phaseNames.length : u.phase, !!u.hold)}<div class="ops-flags">${prFlags(u)}</div></section>
  <div class="od-grid"><div class="od-col">${movePanel}${changes}
    <section class="panel"><h2>History</h2>${hist.slice().reverse().map((h) => `<div class="log"><small>${prStamp(h.at)}</small><br>${h.from === h.to ? esc(h.note) : `${phaseNames[h.from]} → ${phaseNames[h.to]}${h.note ? ' · ' + esc(h.note) : ''}`}</div>`).join('') || '<p class="empty">No moves yet.</p>'}</section>
  </div><div class="od-col">${packet}
    <section class="panel"><div class="panelhead"><h2>Building</h2><span class="od-tag">${esc(u.name)}</span></div>${modelMarkup(u.c, true)}
      <div class="qc-facts"><span>For <strong>${u.customer ? esc(u.customer) : 'stock'}</strong></span><span>Lot <strong>${esc(lotTown(lot))}</strong></span><span>About <strong>${milesBetween(lotPlant(lot), lot)} mi</strong> from the plant</span></div></section>
  </div></div>
  ${opsNotes([
    ['Move phase', 'The unit drawer’s “Move phase”: “← previous” and “next →” with an “Optional transition note” (<code>BuildPipelineUnitDetailDrawer</code> → <code>transitionUnitPhase</code>).'],
    ['History', '<code>mfg_unit_phase_history</code>: from, to, who, when and the note (<code>BuildPipelineUnitDetailHistory</code>).'],
    ['Plant packet', '<code>DEFAULT_PLANT_PACKET_SLOTS</code>: Order form and Floor plan are required, Special instructions is optional.'],
    ['Final QA', 'Builder Assistant’s Final QC marks the unit ready to ship (<code>markReadyToShipFromFinalQc</code>); entering Build complete runs <code>completeBuiltUnitBuild</code>.'],
    ['Not drawn here', 'The drawer’s load assignment, “Ship from plant” and “Bill of materials” sections.'],
  ], ['Put on hold, with a reason.', 'Acknowledging a change order here. Turbo Assist stores no change orders yet.', 'Who moved it: there are no logins, so history has no names.'])}`;
}
function prNotesPage() {
  return `<button class="link backlink" onclick="go('prod')">${icon('back', 18)} Board</button>
  ${head('Production', 'What is real and what is not.', 'This side is a working picture of the plant’s board. It shows the phases and the rules; it keeps nothing.')}
  <div class="grid2">
    <section class="panel"><h2>Matches Turbo Assist</h2><ul>
      <li>The nine phases, in order: ${phaseNames.join(', ')}.</li>
      <li>A board with a column per phase, cards that drag, and the counts In progress, Final QA, Build complete and On board.</li>
      <li>Moving a building one phase forward or back with an optional note, and a history of every move.</li>
      <li>The plant packet: order form, floor plan, special instructions.</li>
      <li>Final QA belongs to QC. QC’s pass is what finishes the build.</li>
    </ul></section>
    <section class="panel"><h2>Only in this preview</h2><ul>
      <li>Orders the office is still reviewing shown in the first column.</li>
      <li>Holds with a reason.</li>
      <li>Change orders on the building, and the plant acknowledging them.</li>
      <li>A lot’s stock order running through the plant, plant QC and Logistics to the lot.</li>
    </ul></section>
    <section class="panel"><h2>Sample data</h2><ul>
      <li>Buildings marked Sample are made up. So is every customer.</li>
      <li>The order number stands in for the plant’s serial number.</li>
    </ul></section>
    <section class="panel"><h2>Not built</h2><ul>
      <li>Production loads: grouping buildings into a trailer load before they are built.</li>
      <li>Crews, stations, due dates, materials and labor pay.</li>
      <li>Logins: anyone can move anything.</li>
      <li>Saving. Reloading the page starts over.</li>
    </ul></section>
  </div>`;
}

/* ---------- The other sides ---------- */
/* The build sheet for a building that only this side knows. */
{
  const sheetOrder = bsOrder;
  bsOrder = function (key) {
    if (!String(key).startsWith('pr:')) return sheetOrder(key);
    const u = prUnit(key.slice(3));
    return u && { c: u.c, serial: u.serial, id: u.src === 'stock' ? u.id : '', customer: u.customer || '', dealer: dealerName(lotById(u.lotId)) };
  };
}
/* A lot's stock order: the Restock page shows where it is instead of stand-in buttons, and it is
   marked received when Logistics unloads it at the lot. */
{
  const deskRestock = restockPage;
  restockPage = function () {
    return deskRestock().replace(/<button type="button" class="chipbtn" onclick="advanceStock\((\d+)\)">[^<]*<\/button>/g, (_, n) => {
      const r = S.stock[Number(n)], u = prUnits().find((x) => x.id === r.id), lg = typeof lgUnit === 'function' && lgUnit(r.id);
      const where = (r.stage || 0) === 0 ? 'Waiting on the office' : lg && lg.at !== 'plant' ? 'On its way to the lot' : u ? `At the plant: ${phaseNames[u.phase]}` : 'With the plant';
      return `<span class="pill blue">${where}</span>${u && u.phase > 0 ? `<button type="button" class="link" onclick="prOpen('${r.id}')">Open in Production</button>` : ''}`;
    });
  };
  const logiDrop = lgDropDone;
  lgDropDone = function (id, i, proof, quiet) {
    const ids = lgLoad(id).stops[i].units.slice();
    logiDrop(id, i, proof, quiet);
    for (const r of S.stock) if (ids.includes(r.id) && lgUnit(r.id)?.at === 'lot') (r.status = 'Received'), (r.stage = STOCK_STAGES.length - 1);
  };
}

/* ---------- Sample stock builds, so the line has work on it ---------- */
(function seedProduction() {
  const hours = (h) => Date.now() - h * 36e5;
  const make = (n, size, style, lot, phase, here, extra = {}) => {
    const row = { size, style, siding_color: extra.color || 'Clay', trim_color: 'Origami White', roof: extra.roof || 'Charcoal metal', order_options: { windows: 1, electrical: 'Basic', door: 'Double' } };
    const c = typeof sampleConfig === 'function' ? sampleConfig(row) : { ...clone(defaults), size };
    const id = `SAMPLE-${size.replace('x', '')}-${n}`;
    PR.samples.push({ id, size, style, lot, phase, c, at0: hours(here) });
    PR.hist[id] = Array.from({ length: phase - 1 }, (_, k) => ({ from: k + 1, to: k + 2, at: hours(here + (phase - 1 - k) * 22), note: '' }));
    if (extra.hold) PR.holds[id] = { reason: extra.hold, at: hours(here - 2) }, PR.hist[id].push({ from: phase, to: phase, at: hours(here - 2), note: `On hold: ${extra.hold}` });
  };
  make(3001, '12x20', 'Classic Utility', 'lexington', 1, 20, { color: 'Dovetail Grey' });
  make(3002, '10x16', 'Basic Lofted Barn', 'mocksville', 1, 26, { color: 'Red' });
  make(3003, '12x24', 'Elite Utility', 'florence', 2, 9, { color: 'Sage Green', roof: 'Architectural shingles' });
  make(3004, '10x12', 'Basic Utility', 'conway', 2, 30, { color: 'Blue' });
  make(3005, '14x32', 'Classic Lofted Barn', 'statesboro', 3, 52, { color: 'Clay', hold: 'Waiting on materials' });
  make(3006, '10x16', 'Classic Utility', 'lugoff', 3, 14, { color: 'Navajo White' });
  make(3007, '12x28', 'Classic Utility', 'boiling-springs', 4, 18, { color: 'Web Grey' });
  make(3008, '10x20', 'Basic Lofted Barn', 'salisbury', 5, 7, { color: 'Brown' });
  make(3009, '12x16', 'Basic Studio', 'ravenel', 6, 11, { color: 'Alpine Grey' });
})();

const PROD_SCREENS = { prod: prBoard, 'pr-list': prRoster, 'pr-unit': prUnitPage, 'pr-notes': prNotesPage };
