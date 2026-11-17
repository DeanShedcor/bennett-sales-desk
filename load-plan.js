/* load-plan.js: Logistics plans loads ahead, breaks them apart, puts them back together, and says what fits.

   What changes on the screen:
   1. Planned ahead. A load the plant has not built yet shows in Logistics with its letter, a trailer
      and a target day. Each building reads "Not built yet" or "Built, ready to go". It shows on the
      Dispatch board, the Loads screen, the Calendar, and on the plant's own load card.
   2. The letter stays. The load Logistics ships carries the plant's letter (B). A building that leaves
      early goes on B-L1, the next on B-L2. A building taken off a load remembers its letter.
   3. Break a load apart. Every building goes back to "needs a load". "Put with a load" pairs a loose
      building with another load, or starts the next load under its letter.
   4. What fits. Every building and every trailer in a picker says "Fits", "Tight, check first" or
      "Will not fit", with the reason. Three buttons filter the list. Adding something that will not
      fit needs a typed reason, kept in the load's history.

   Turbo Assist (bennett-buddy, read at commit b42d324), the functions these sit on:
   - A planned load: mfg_production_loads (a letter A to ZZ, nextAvailableProductionLoadCode). Sending
     it to the plant makes the Logistics shipment with the same letter (mintShipmentForProductionLoad,
     stampUnitsOntoShipment). A unit can be routed once it is built (assertUnitEligibleForLogisticsRoute).
   - The letter and the -L codes: logisticsShipmentCodes.ts (nextLogisticsSplitCode). A break-out is
     splitUnitFromShipment, which writes "Broke out of AC into AC-L1."
   - Fit: buildRigAssignmentWarnings (no capacity on file, unit longer than the rig, haul flags).
   Features the product still has to accept: a trailer and a target day on a planned load; breaking
   a whole load apart in one step; putting loose buildings back together under the letter; total
   length across the trailer; "tight" under 2 ft to spare. Height and weight are not checked: neither
   Turbo Assist nor this preview keeps them. Loaded last; wraps the Logistics globals. */

const LP = { filter: 'all', code: null, next: null, rigsOpen: false };
const LP_FILTERS = [['fits', 'Show only what fits'], ['might', 'Show what might fit'], ['all', 'Show all']];
const LP_LABEL = { yes: 'Fits', tight: 'Tight, check first', no: 'Will not fit', unknown: 'Pick a trailer first' };
const LP_CLASS = { yes: 'ok', tight: 'todo', no: 'bad', unknown: '' };
const LP_SPARE = 2; /* less than this many feet to spare reads "tight" */
const lpAsks = () => !(typeof OG !== 'undefined' && OG.live) && !(typeof PP !== 'undefined' && PP.raw);
const lpCan = () => !(typeof lgpRole === 'function' && lgpRole());
const lpLetter = (code) => /^[A-Z]{1,2}$/.test(code || '');
const lpDims = (size) => { const [wid, len] = String(size).split('x').map(Number); return { wid, len }; };
const lpShow = (level) => LP.filter === 'all' || level === 'yes' || level === 'unknown' || (LP.filter === 'might' && level === 'tight');

/* ---------- 4. What fits ----------
   units: anything with wid, len and (when known) leg. kind: 'haul' leaves the plant, 'home' leaves a lot. */
function lpFit(units, rig, kind) {
  if (!rig) return { level: 'unknown', why: ['No trailer picked yet.'] };
  const feet = units.reduce((t, u) => t + u.len, 0), no = [], tight = [];
  if (!rig.feet) tight.push('This trailer has no length on file. Check by hand.');
  else {
    const long = units.filter((u) => u.len > rig.feet).sort((a, b) => b.len - a.len)[0];
    if (long) no.push(`Too long: a ${long.len} ft building on a ${rig.feet} ft trailer.`);
    else if (feet > rig.feet) no.push(`${units.length === 2 ? 'Both together are' : 'Together they are'} too long: ${feet} ft on a ${rig.feet} ft trailer.`);
    else if (units.length && rig.feet - feet < LP_SPARE) tight.push(rig.feet === feet ? 'Fills the trailer. No room to spare.' : `Only ${rig.feet - feet} ft to spare.`);
  }
  if (kind === 'haul' && rig.haul === false) tight.push('This trailer is not set up for plant loads.');
  if (units.some((u) => u.leg && u.leg !== 'plant-lot') && rig.home === false) tight.push('This trailer is not set up for home deliveries.');
  const wide = units.filter((u) => u.wid >= LG.set.wideFt).sort((a, b) => b.wid - a.wid)[0];
  if (wide) tight.push(`${wide.wid} ft wide: needs a permit.`);
  return no.length ? { level: 'no', why: [...no, ...tight] } : tight.length ? { level: 'tight', why: tight } : { level: 'yes', why: [`${feet} of ${rig.feet} ft used.`] };
}
const lpChip = (f) => `<span class="ops-flag ${LP_CLASS[f.level]} lp-fit" data-fit="${f.level}">${LP_LABEL[f.level]}</span>`;
const lpWhy = (f) => (f.level === 'yes' || f.level === 'unknown' ? '' : `<span class="lp-why">${esc(f.why.join(' '))}</span>`);
const lpFilters = (again) => `<div class="chiprow lp-filters" role="group" aria-label="What to show">${LP_FILTERS.map(([k, t]) => `<button type="button" class="chipbtn${LP.filter === k ? ' on' : ''}" aria-pressed="${LP.filter === k}" onclick="lpSetFilter('${k}',${again ? `'${again}'` : 'null'})">${t}</button>`).join('')}</div>`;
function lpSetFilter(k, again) {
  LP.filter = k;
  if (again && typeof window[again.split(':')[0]] === 'function') return window[again.split(':')[0]](...again.split(':').slice(1));
  render();
}
/* A typed reason before something that will not fit goes on. */
function lpWhyForm(title, f, onSave) {
  LP.onWhy = onSave;
  modal(title, `<p class="notice">${icon('alert', 16)} <b>Will not fit.</b> ${esc(f.why.join(' '))}</p>
    <label class="field">Why is it going on anyway?<input id="lp-why" maxlength="140" placeholder="Example: 4 ft hangs off the back, flagged"></label>
    <p class="source">The reason stays in the load’s history and shows to the driver.</p>
    <div class="actions">${button('Go back', 'closeModal()', 'secondary')}${button('Add it anyway', 'lpWhySave()')}</div>`);
  document.getElementById('lp-why')?.focus();
}
function lpWhySave() {
  const reason = $('#lp-why').value.trim();
  if (reason.length < 3) return toast('Type a reason first.');
  const fn = LP.onWhy;
  LP.onWhy = null;
  closeModal();
  fn(reason);
}

/* Adding a building and picking a trailer both ask when it will not fit. */
{
  const baseAdd = lgAdd;
  lgAdd = function (loadId, unitId, why) {
    const load = lgLoad(loadId), u = lgUnit(unitId), rig = load && lgRig(load.rigId);
    const f = load && u && rig ? lpFit([...lgLoadUnits(load), u], rig, load.kind) : null;
    if (f && f.level === 'no' && lpAsks() && why == null) return lpWhyForm(`Add this ${u.wid} × ${u.len} anyway?`, f, (reason) => lgAdd(loadId, unitId, reason));
    baseAdd(loadId, unitId);
    if (why && load) {
      load.over = { reason: why, at: Date.now() };
      lgNote(load, `Added though it will not fit. ${f.why[0]} Reason: ${why}`);
      render();
    }
  };
  const baseSet = lgSet;
  lgSet = function (loadId, key, value, why) {
    const load = lgLoad(loadId), rig = key === 'rigId' && value ? lgRig(value) : null;
    const f = load && rig && lgLoadUnits(load).length ? lpFit(lgLoadUnits(load), rig, load.kind) : null;
    if (f && f.level === 'no' && lpAsks() && why == null) {
      render(); /* put the picker back on the trailer it had */
      return lpWhyForm(`Use ${rig.name} anyway?`, f, (reason) => lgSet(loadId, key, value, reason));
    }
    baseSet(loadId, key, value);
    if (why && load) {
      load.over = { reason: why, at: Date.now() };
      lgNote(load, `${rig.name} picked though the load will not fit. ${f.why[0]} Reason: ${why}`);
      render();
    }
  };
  /* The list of buildings to add follows the filter. */
  const baseCands = lgCandidates;
  lgCandidates = function (load) {
    const rig = lgRig(load.rigId), on = lgLoadUnits(load), all = baseCands(load).map((c) => ({ ...c, fit: lpFit([...on, c.u], rig, load.kind) }));
    LP.hidden = all.filter((c) => !lpShow(c.fit.level)).length;
    return all.filter((c) => lpShow(c.fit.level));
  };
}

/* ---------- 2. The letter stays ---------- */
const lpOrigin = (u) => u.origin || (typeof prLoadOf === 'function' && prLoadOf(u.id)?.id) || '';
const lpLoadOrigin = (load) => (load.kind === 'haul' && /^[A-Z]{1,2}(-L[1-9][0-9]*)?$/.test(load.id) ? lgxOrigin(load) : '');
{
  /* A new code skips every code in use, by a Logistics load or a planned load. */
  const baseCode = lgCode;
  lgCode = function () {
    if (LP.next) { const c = LP.next; LP.next = null; return c; }
    const used = new Set([...LG.loads.map((l) => l.id), ...(typeof PR !== 'undefined' ? PR.loads.map((l) => l.id) : [])]);
    let c = baseCode();
    for (let i = 0; i < 700 && used.has(c); i++) c = baseCode();
    return c;
  };
  if (typeof tpNextCode === 'function') {
    const baseNext = tpNextCode;
    tpNextCode = function () {
      const used = new Set([...PR.loads.map((l) => l.id), ...LG.loads.filter((l) => l.kind === 'haul').map((l) => lgxOrigin(l))]);
      for (let i = 0; i < 702; i++) if (!used.has(prCode(i))) return prCode(i);
      return baseNext();
    };
  }
  /* A building taken off a load remembers the load's letter. */
  const baseTake = lgTake;
  lgTake = function (load, unitId) {
    const u = lgUnit(unitId), o = lpLoadOrigin(load);
    if (u && o) u.origin = o;
    return baseTake(load, unitId);
  };
  /* Shipping what the plant planned: the load takes the plant's letter. If part of the plan is still
     being built, the built ones break out to the next -L code and the rest keep the letter. */
  const baseProd = lgFromProd;
  lgFromProd = function (code) {
    const l = prLoad(code);
    if (!l) return baseProd(code);
    const ready = l.units.map(lgUnit).filter((u) => u && u.at === 'plant' && u.leg && !u.loadId);
    if (!ready.length) return baseProd(code);
    const waiting = l.units.filter((id) => !lgUnit(id)).length, whole = !waiting && !lgLoad(code);
    const id = whole ? code : lgxNextSplit(code);
    LP.next = id;
    baseProd(code);
    LP.next = null;
    const load = lgLoad(id);
    if (!load) return;
    load.origin = code;
    ready.forEach((u) => (u.origin = code));
    if (!whole) lgNote(load, `Broke out of ${code} into ${id}.${waiting ? ` ${lgPlural(waiting, 'building')} on ${code} ${waiting === 1 ? 'is' : 'are'} still being built.` : ''}`);
    const rig = l.planRig && lgRig(l.planRig);
    if (rig) (load.rigId = rig.id), (load.driver = rig.driver || '');
    if (l.planDay && l.planDay >= lgToday()) load.date = l.planDay;
    if (rig || load.date) lgNote(load, `Planned ahead${rig ? ' for ' + rig.name : ''}${load.date ? ' on ' + lgDay(load.date) : ''}`);
    lpLog(l, `${lgPlural(ready.length, 'built building')} shipped as load ${id}`);
    render();
  };
  /* A new load from loose buildings that were on a load before takes the next code under that letter. */
  const baseNew = lgNewLoad;
  lgNewLoad = function () {
    const picked = LG.pick.map(lgUnit).filter((u) => u && !u.loadId && u.at === 'plant' && u.leg), first = picked.find((u) => lpOrigin(u));
    if (!first) return baseNew();
    const origin = lpOrigin(first), id = lgxNextSplit(origin), others = [...new Set(picked.map(lpOrigin).filter((o) => o && o !== origin))];
    LP.next = id;
    baseNew();
    LP.next = null;
    const load = lgLoad(id);
    if (!load) return;
    load.origin = origin;
    lgNote(load, `Put together under load ${origin}: now ${id}.${others.length ? ` Also holds buildings that were on ${others.join(', ')}.` : ''}`);
    for (const u of lgLoadUnits(load)) { const s = lgSale(u); if (s) ofLog(s, `Logistics: moved to load ${id}.`); }
    render();
  };
}

/* ---------- 3. Break a load apart, and put buildings back together ---------- */
function lpBreakForm(id) {
  const load = lgLoad(id);
  if (!load) return;
  if (load.state === 'in_transit') return lggRoadCancelForm(id);
  const units = lgLoadUnits(load), o = lpLoadOrigin(load), must = load.state === 'scheduled';
  modal(`Break ${load.kind === 'haul' ? 'load' : 'delivery'} ${esc(load.id)} apart?`, `<p>${units.length === 1 ? 'Its building goes' : `All ${units.length} buildings go`} back to the board and ${units.length === 1 ? 'needs' : 'need'} a load again.${o ? ` ${units.length === 1 ? 'It keeps' : 'They keep'} the letter <b>${esc(o)}</b>, so the next load made from ${units.length === 1 ? 'it' : 'them'} is ${esc(lgxNextSplit(o))}.` : ''}</p>
    ${must ? `<p class="notice">${icon('alert', 16)} This load is scheduled for <b>${lgDay(load.date)}</b>. Breaking it apart takes it off the calendar.</p>` : ''}
    <ul class="lp-list">${units.map((u) => `<li><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · to ${esc(lgDest(u))}</li>`).join('')}</ul>
    <label class="field">${must ? 'Why is it being broken apart?' : 'Why? (you can leave this empty)'}<input id="lp-break-why" maxlength="140" placeholder="Example: one building is not ready"></label>
    <div class="actions">${button('Keep it', 'closeModal()', 'secondary')}${button('Break it apart', `lpBreak('${id}')`)}</div>`);
}
function lpBreak(id) {
  const load = lgLoad(id), reason = $('#lp-break-why').value.trim();
  if (!load || !['planned', 'scheduled'].includes(load.state)) return closeModal();
  if (load.state === 'scheduled' && reason.length < 3) return toast('Type a reason first.');
  const units = lgLoadUnits(load), o = lpLoadOrigin(load);
  for (const u of units) {
    u.loadId = null;
    if (o) u.origin = o;
    const s = lgSale(u);
    if (s && s.deliverOn && u.leg !== 'plant-lot') (s.deliverOn = null), ofLog(s, 'Logistics broke the load apart · a new day will follow');
  }
  load.state = 'cancelled';
  load.broken = { at: Date.now(), reason };
  lgNote(load, `Broken apart${reason ? ': ' + reason : ''}. ${lgPlural(units.length, 'building')} back on the board.`);
  closeModal();
  LG.tile = 'all';
  go('logi');
  toast(`${lgLoadName(load)} broken apart. ${lgPlural(units.length, 'building')} ${units.length === 1 ? 'needs' : 'need'} a load.`);
}
{
  /* On the road, the existing typed-reason cancel does the work; the buildings keep the letter. */
  const baseRoad = lggRoadCancel;
  lggRoadCancel = function (id) {
    const load = lgLoad(id), left = load && load.state === 'in_transit' ? load.stops.filter((x) => !x.done).flatMap(lgStopUnits) : [], o = load ? lpLoadOrigin(load) : '';
    baseRoad(id);
    if (load && load.state === 'cancelled' && o) left.forEach((u) => (u.origin = o));
  };
}
/* Loads a loose building could join. */
function lpPairLoads(u) {
  return LG.loads.filter((l) => ['planned', 'scheduled'].includes(l.state) && l.kind === 'haul' && l.from.type === 'plant' && l.from.id === u.plantId)
    .map((l) => ({ l, fit: lpFit([...lgLoadUnits(l), u], lgRig(l.rigId), 'haul'), same: lpOrigin(u) && lpLoadOrigin(l) === lpOrigin(u) }))
    .sort((a, b) => b.same - a.same || (a.l.date || '9').localeCompare(b.l.date || '9'));
}
function lpPairForm(unitId) {
  const u = lgUnit(unitId);
  if (!u || u.loadId) return;
  const o = lpOrigin(u), all = lpPairLoads(u), rows = all.filter((x) => lpShow(x.fit.level)), next = o ? lgxNextSplit(o) : '';
  modal('Put this building with a load', `<p><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · to ${esc(lgDest(u))}${o ? ` · was on load <b>${esc(o)}</b>` : ''}</p>
    ${lpFilters('lpPairForm:' + unitId)}
    <div class="lp-rows">${rows.map(({ l, fit, same }) => {
      const rig = lgRig(l.rigId);
      return `<div class="lp-row"><span class="lg-code">${esc(l.id)}</span><div class="grow"><strong>${lgLoadName(l)}${same ? ' · same letter' : ''}</strong>
        <small>${rig ? esc(rig.name) + ' · ' + (rig.feet ? `${lgFeet(l)} of ${rig.feet} ft used` : 'no length on file') : 'No trailer yet'} · ${l.date ? lgDay(l.date) : 'no day yet'} · ${lgPlural(lgLoadUnits(l).length, 'building')}</small>
        <span class="ops-flags">${lpChip(fit)}${lpWhy(fit)}</span></div>
        <button type="button" class="secondary small" onclick="lpPair('${u.id}','${l.id}')">Put on ${esc(l.id)}</button></div>`;
    }).join('') || `<p class="empty">${all.length ? `No open load fits this building. <button type="button" class="link inline" onclick="lpSetFilter('all','lpPairForm:${unitId}')">Show all ${all.length}</button>` : 'No open load leaves from this plant yet.'}</p>`}</div>
    <div class="actions">${button('Close', 'closeModal()', 'secondary')}${button(next ? `Start load ${next} with it` : 'Start a new load with it', `lpPairNew('${u.id}')`)}</div>
    ${S.sfNotes ? '<p class="source">Turbo Logistics moves one unit to the next -L code (<code>splitUnitFromShipment</code>, <code>nextLogisticsSplitCode</code>). Joining an existing load is a feature the product still has to accept.</p>' : ''}`);
}
function lpPair(unitId, loadId, why) {
  const u = lgUnit(unitId), load = lgLoad(loadId), rig = load && lgRig(load.rigId);
  if (!u || !load || u.loadId) return closeModal();
  const f = rig ? lpFit([...lgLoadUnits(load), u], rig, load.kind) : null;
  if (f && f.level === 'no' && lpAsks() && why == null) return lpWhyForm(`Put this ${u.wid} × ${u.len} on ${load.id} anyway?`, f, (reason) => lpPair(unitId, loadId, reason));
  const o = lpOrigin(u);
  closeModal();
  lgAdd(loadId, unitId, why || '');
  if (o && o !== lpLoadOrigin(load)) lgNote(load, `${u.name} was on load ${o}.`);
  const s = lgSale(u);
  if (s) ofLog(s, `Logistics: moved to load ${load.id}.`);
  render();
  toast(`${u.wid} × ${u.len} is on ${lgLoadName(load)}.`);
}
function lpPairNew(unitId) {
  closeModal();
  LG.pick = [unitId];
  lgNewLoad();
}
{
  /* A loose building that was on a load says so, and offers the pairing. */
  const baseRow = lgUnitRow;
  lgUnitRow = function (u, mode) {
    let html = baseRow(u, mode);
    if (mode !== 'pick' || u.loadId || !lpCan()) return html;
    if (u.origin) html = lgxIntoFlags(html, `<span class="ops-flag lp-was">Was on load ${esc(u.origin)}</span>`);
    return lgxAfter(html, '<div class="ops-rowacts">', `<button type="button" class="link lp-pairbtn" onclick="lpPairForm('${u.id}')">Put with a load</button>`);
  };
  /* The load's panel: Break this load apart. */
  const basePanel = lgxLoadPanel;
  lgxLoadPanel = function (load) {
    let html = basePanel(load);
    if (!lpAsks() || !lpCan() || !lgLoadUnits(load).length || !['planned', 'scheduled', 'in_transit'].includes(load.state)) return html;
    const at = html.indexOf('<div class="actions lgx-acts">'), end = at < 0 ? -1 : html.indexOf('</div>', at);
    if (end < 0) return html;
    return html.slice(0, end) + `<button type="button" class="secondary small lp-break" onclick="lpBreakForm('${load.id}')">${icon('rotate', 16)} Break this load apart</button>` + html.slice(end);
  };
}

/* ---------- 1. Planned ahead ---------- */
const lpLog = (l, text) => (l.plog ||= []).push({ at: Date.now(), text });
const lpPlans = () => (typeof prLoadsOpen === 'function' ? prLoadsOpen() : []);
/* Each building on a planned load, and where it stands. */
function lpPlanUnits(l) {
  return l.units.map((id) => {
    const g = lgUnit(id), p = g ? null : prUnit(id);
    if (g) {
      const built = g.at === 'plant' && !g.loadId && g.leg;
      return { id, size: g.size, wid: g.wid, len: g.len, lotId: g.lotId, name: g.name, customer: g.customer, leg: g.leg, status: built ? 'built' : 'gone', text: built ? 'Built, ready to go' : g.loadId ? `Left on load ${g.loadId}` : 'Already moved' };
    }
    if (!p) return null;
    return { id, size: p.size, ...lpDims(p.size), lotId: p.lotId, name: p.name, customer: p.customer, status: 'building', text: 'Not built yet', step: p.phase === PR_DONE ? 'waiting on the office' : phaseNames[p.phase].toLowerCase() };
  }).filter(Boolean);
}
const lpPlanLive = (l) => lpPlanUnits(l).filter((u) => u.status !== 'gone');
const lpPlanFit = (l, extra = []) => lpFit([...lpPlanLive(l), ...extra], lgRig(l.planRig), 'haul');
function lpPlanState(l) {
  const live = lpPlanLive(l), built = live.filter((u) => u.status === 'built').length;
  return !live.length ? ['ghost', 'Nothing on it yet'] : built === live.length ? ['good', 'Built, ready to go'] : built ? ['amber', `${built} of ${live.length} built`] : ['amber', 'Planned, not built yet'];
}
function lpPlanRow(l) {
  const units = lpPlanUnits(l), live = units.filter((u) => u.status !== 'gone'), ready = live.filter((u) => u.status === 'built'), rig = lgRig(l.planRig), fit = lpPlanFit(l), [cls, state] = lpPlanState(l);
  return `<article class="ops-row lp-plan" data-plan="${esc(l.id)}"><span class="lg-code">${esc(l.id)}</span><div class="grow"><div class="ops-rowtop"><strong>Planned load ${esc(l.id)}${l.alias ? ' · ' + esc(l.alias) : ''}</strong><span class="pill ${cls}">${state}</span></div>
    <p class="ops-rowsub">${rig ? esc(rig.name) : 'No trailer yet'} · ${l.planDay ? 'aiming for ' + lgDay(l.planDay) : 'no day yet'} · ${lgPlural(live.length, 'building')} · ${live.reduce((t, u) => t + u.len, 0)}${rig?.feet ? ' of ' + rig.feet : ''} ft</p>
    <div class="ops-flags">${rig && live.length ? lpChip(fit) : ''}${units.map((u) => `<span class="ops-flag ${u.status === 'built' ? 'ok' : u.status === 'gone' ? '' : 'todo'}">${esc(u.size)} to ${esc(lotById(u.lotId).town)}: ${esc(u.text)}${u.step ? ' · ' + esc(u.step) : ''}</span>`).join('')}</div></div>
    <div class="ops-rowacts"><button type="button" class="secondary small" onclick="lpPlanOpen('${l.id}')">Open the plan</button>${ready.length && lpCan() ? `<button type="button" class="primary small" onclick="lgFromProd('${l.id}')">Build this load</button>` : ''}</div></article>`;
}
function lpPlanNew() {
  const code = tpNextCode();
  if (!code) return toast('Every letter from A to ZZ is in use. Close a finished load at the plant to free one.');
  const l = { id: code, alias: '', units: [], state: 'open', made: Date.now(), footage: '' };
  PR.loads.push(l);
  lpLog(l, 'Planned ahead by Logistics');
  lpPlanOpen(code);
}
/* Orders the plant has approved and not finished, not on a planned load yet. */
function lpPlanPool(l) {
  const plant = PLANTS[0], rig = lgRig(l.planRig), on = lpPlanLive(l);
  return prUnits().filter((u) => u.phase >= 1 && u.phase < PR_QA && !prLoadOf(u.id)).map((u) => ({ u, d: lpDims(u.size) }))
    .map(({ u, d }) => ({ u, d, fit: lpFit([...on, d], rig, 'haul'), miles: milesBetween(plant, lotById(u.lotId)) || 0 })).sort((a, b) => a.miles - b.miles);
}
function lpPlanOpen(code) {
  const l = prLoad(code);
  if (!l) return closeModal();
  LP.code = code;
  const units = lpPlanUnits(l), live = units.filter((u) => u.status !== 'gone'), ready = live.filter((u) => u.status === 'built'), fit = lpPlanFit(l), [cls, state] = lpPlanState(l), can = lpCan();
  const pool = lpPlanPool(l), shown = pool.filter((x) => lpShow(x.fit.level));
  modal(`Planned load ${esc(code)}`, `<div class="lp-planhead"><span class="pill ${cls}">${state}</span>${l.state === 'open' ? '<span class="od-tag">Not sent to the plant floor yet</span>' : '<span class="od-tag">The plant is building it</span>'}</div>
    <p>A load planned before the plant builds it. Pick the trailer and the day you are aiming for. When the buildings are built, the load ships as <b>${esc(code)}</b>.</p>
    <div class="fields lp-planset"><label>Trailer<select id="lp-plan-rig" ${can ? '' : 'disabled'} onchange="lpPlanSet('${code}','planRig',this.value)"><option value="">Choose a trailer</option>${LG.rigs.map((r) => {
      const f = live.length ? lpFit(live, r, 'haul') : null;
      return `<option value="${r.id}" ${l.planRig === r.id ? 'selected' : ''}>${esc(r.name)} · ${r.feet ? r.feet + ' ft' : 'no length on file'}${f ? ' · ' + LP_LABEL[f.level].toLowerCase() : ''}</option>`;
    }).join('')}</select></label>
    <label>Day we are aiming for<input type="date" id="lp-plan-day" ${can ? '' : 'disabled'} min="${lgToday()}" value="${esc(l.planDay || '')}" onchange="lpPlanSet('${code}','planDay',this.value)"></label></div>
    ${l.planRig && live.length ? `<p class="lp-fitline">${lpChip(fit)} ${esc(fit.why.join(' '))}</p>` : ''}
    <h3>Buildings on this plan</h3>
    <div class="lp-rows" id="lp-plan-units">${units.map((u) => `<div class="lp-row"><span class="lg-size sm"><b>${u.wid} × ${u.len}</b></span><div class="grow"><strong>${esc(u.name.replace(u.size, '').trim())}</strong><small>To ${esc(lotById(u.lotId).town)}${u.customer ? ' · ' + esc(u.customer) : ''}</small>
      <span class="ops-flags"><span class="ops-flag ${u.status === 'built' ? 'ok' : u.status === 'gone' ? '' : 'todo'} lp-status">${esc(u.text)}</span>${u.step ? `<span class="ops-flag">At the plant: ${esc(u.step)}</span>` : ''}</span></div>
      ${can && u.status !== 'gone' ? `<div class="lp-rowacts"><button type="button" class="link" onclick="lpPlanMoveForm('${code}','${u.id}')">Move</button><button type="button" class="secondary small" onclick="lpPlanTake('${code}','${u.id}')">Take off</button></div>` : ''}</div>`).join('') || '<p class="empty">No buildings yet. Add some below.</p>'}</div>
    ${can ? `<h3>Add a building that is not built yet</h3>${lpFilters('lpPlanOpen:' + code)}
    <div class="lp-rows" id="lp-plan-pool">${shown.map(({ u, d, fit: f, miles }) => `<div class="lp-row"><span class="lg-size sm"><b>${d.wid} × ${d.len}</b></span><div class="grow"><strong>${esc(u.name.replace(u.size, '').trim())}</strong><small>To ${esc(lotById(u.lotId).town)} · about ${miles} mi · at the plant: ${phaseNames[u.phase].toLowerCase()}</small>
      <span class="ops-flags">${lpChip(f)}${lpWhy(f)}</span></div><button type="button" class="secondary small" onclick="lpPlanAdd('${code}','${u.id}')">Add</button></div>`).join('') || `<p class="empty">${pool.length ? `Nothing left fits this trailer. <button type="button" class="link inline" onclick="lpSetFilter('all','lpPlanOpen:${code}')">Show all ${pool.length}</button>` : 'Every approved order is already on a planned load.'}</p>`}</div>` : ''}
    ${l.plog?.length ? `<h3>History</h3><ul class="lp-list">${l.plog.slice().reverse().map((e) => `<li>${esc(e.text)} <small>${lgStamp(e.at)}</small></li>`).join('')}</ul>` : ''}
    <div class="actions">${button('Close', 'closeModal()', 'secondary')}${can && live.length ? button('Break this plan apart', `lpPlanBreakForm('${code}')`, 'secondary') : can ? button('Remove this plan', `lpPlanBreak('${code}')`, 'secondary') : ''}${can && ready.length ? button(ready.length === live.length ? `Ship load ${code}` : `Ship the ${ready.length} built now`, `closeModal();lgFromProd('${code}')`) : ''}</div>
    ${S.sfNotes ? '<p class="source">A production load (<code>mfg_production_loads</code>, letters A to ZZ). Sending it to the plant makes the Logistics shipment with the same letter (<code>mintShipmentForProductionLoad</code>). A building can go on a route once it is built (<code>assertUnitEligibleForLogisticsRoute</code>). The trailer and the day on a plan are features the product still has to accept.</p>' : ''}`);
}
function lpPlanSet(code, key, value, why) {
  const l = prLoad(code);
  if (!l || !lpCan()) return;
  const rig = key === 'planRig' && value ? lgRig(value) : null, f = rig && lpPlanLive(l).length ? lpFit(lpPlanLive(l), rig, 'haul') : null;
  if (f && f.level === 'no' && lpAsks() && why == null) return lpWhyForm(`Plan ${rig.name} anyway?`, f, (reason) => lpPlanSet(code, key, value, reason));
  l[key] = value;
  if (rig?.feet) l.trailer = rig.feet;
  lpLog(l, key === 'planRig' ? (rig ? `Trailer: ${rig.name}${why ? ` though it will not fit. Reason: ${why}` : ''}` : 'Trailer cleared') : value ? `Aiming for ${lgDay(value)}` : 'Day cleared');
  render();
  lpPlanOpen(code);
}
function lpPlanAdd(code, unitId, why) {
  const l = prLoad(code), u = prUnit(unitId);
  if (!l || !u || !lpCan()) return;
  const f = lpPlanFit(l, [lpDims(u.size)]);
  if (f.level === 'no' && lpAsks() && why == null) return lpWhyForm(`Add this ${u.size.replace('x', ' × ')} anyway?`, f, (reason) => lpPlanAdd(code, unitId, reason));
  prLoadAssign(unitId, code);
  lpLog(l, `Added ${u.name} for ${lotById(u.lotId).town}${why ? ` though it will not fit. Reason: ${why}` : ''}`);
  lpPlanOpen(code);
}
function lpPlanTake(code, unitId) {
  const l = prLoad(code), u = lpPlanUnits(l).find((x) => x.id === unitId);
  if (!l || !u || !lpCan()) return;
  l.units = l.units.filter((id) => id !== unitId);
  const g = lgUnit(unitId);
  if (g) g.origin = code;
  lpLog(l, `Took off ${u.name}`);
  render();
  lpPlanOpen(code);
  toast(`${u.wid} × ${u.len} is off planned load ${code}.`);
}
/* Move one building to another planned load, or to a new one. */
function lpPlanMoveForm(code, unitId) {
  const l = prLoad(code), u = lpPlanUnits(l).find((x) => x.id === unitId), next = tpNextCode();
  if (!u) return;
  const rows = lpPlans().filter((x) => x !== l).map((x) => ({ x, fit: lpPlanFit(x, [u]) })), shown = rows.filter((r) => lpShow(r.fit.level));
  modal(`Move this building off plan ${esc(code)}`, `<p><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · to ${esc(lotById(u.lotId).town)} · ${esc(u.text)}</p>
    ${lpFilters(`lpPlanMoveForm:${code}:${unitId}`)}
    <div class="lp-rows">${shown.map(({ x, fit }) => `<div class="lp-row"><span class="lg-code">${esc(x.id)}</span><div class="grow"><strong>Planned load ${esc(x.id)}${x.alias ? ' · ' + esc(x.alias) : ''}</strong><small>${lgRig(x.planRig) ? esc(lgRig(x.planRig).name) : 'No trailer yet'} · ${x.planDay ? lgDay(x.planDay) : 'no day yet'} · ${lgPlural(lpPlanLive(x).length, 'building')}</small>
      <span class="ops-flags">${lpChip(fit)}${lpWhy(fit)}</span></div><button type="button" class="secondary small" onclick="lpPlanMove('${code}','${unitId}','${x.id}')">Move to ${esc(x.id)}</button></div>`).join('') || `<p class="empty">${rows.length ? `No other plan fits it. <button type="button" class="link inline" onclick="lpSetFilter('all','lpPlanMoveForm:${code}:${unitId}')">Show all ${rows.length}</button>` : 'There is no other planned load yet.'}</p>`}</div>
    <div class="actions">${button('Back', `lpPlanOpen('${code}')`, 'secondary')}${next ? button(`Start planned load ${next} with it`, `lpPlanMove('${code}','${unitId}','')`) : ''}</div>`);
}
function lpPlanMove(code, unitId, to, why) {
  const l = prLoad(code), u = lpPlanUnits(l).find((x) => x.id === unitId);
  if (!l || !u || !lpCan()) return;
  let dest = to ? prLoad(to) : null;
  if (to && dest) {
    const f = lpPlanFit(dest, [u]);
    if (f.level === 'no' && lpAsks() && why == null) return lpWhyForm(`Move this ${u.wid} × ${u.len} to ${to} anyway?`, f, (reason) => lpPlanMove(code, unitId, to, reason));
  } else {
    const next = tpNextCode();
    if (!next) return toast('Every letter from A to ZZ is in use.');
    dest = { id: next, alias: '', units: [], state: l.state, made: Date.now(), footage: '' };
    PR.loads.push(dest);
    lpLog(dest, `Started from planned load ${code}`);
  }
  l.units = l.units.filter((id) => id !== unitId);
  dest.units.push(unitId);
  lpLog(l, `Moved ${u.name} to planned load ${dest.id}`);
  lpLog(dest, `Took ${u.name} from planned load ${code}${why ? ` though it will not fit. Reason: ${why}` : ''}`);
  if (!l.units.length) PR.loads = PR.loads.filter((x) => x !== l);
  render();
  lpPlanOpen(dest.id);
  toast(`${u.wid} × ${u.len} moved to planned load ${dest.id}.`);
}
function lpPlanBreakForm(code) {
  const l = prLoad(code), live = lpPlanLive(l);
  modal(`Break planned load ${esc(code)} apart?`, `<p>${live.length === 1 ? 'Its building comes' : `All ${live.length} buildings come`} off the plan. The plant keeps building ${live.length === 1 ? 'it' : 'them'}. ${live.length === 1 ? 'It needs' : 'They need'} a load again, and the letter ${esc(code)} is free for another plan.</p>
    <ul class="lp-list">${live.map((u) => `<li><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · to ${esc(lotById(u.lotId).town)} · ${esc(u.text)}</li>`).join('')}</ul>
    <div class="actions">${button('Keep it', `lpPlanOpen('${code}')`, 'secondary')}${button('Break it apart', `lpPlanBreak('${code}')`)}</div>`);
}
function lpPlanBreak(code) {
  const l = prLoad(code);
  if (!l || !lpCan()) return closeModal();
  const n = lpPlanLive(l).length;
  for (const id of l.units) { const g = lgUnit(id); if (g && !g.loadId) g.origin = code; }
  PR.loads = PR.loads.filter((x) => x !== l);
  closeModal();
  render();
  toast(n ? `Planned load ${code} broken apart. ${lgPlural(n, 'building')} ${n === 1 ? 'needs' : 'need'} a load.` : `Planned load ${code} removed.`);
}

/* ---------- Where the plans show ---------- */
{
  const lpHead = () => `<h2 class="sectionhead qc-group lp-head">Planned ahead, before the plant builds <small>${lpPlans().length}</small>${lpCan() ? `<button type="button" class="secondary small lp-new" onclick="lpPlanNew()">${icon('plus', 16)} Plan a load ahead</button>` : ''}</h2>`;
  const lpSection = () => {
    const plans = lpPlans();
    return `${lpHead()}<div class="ops-list lp-plans">${plans.map(lpPlanRow).join('') || '<p class="of-soft lp-noplans">No load is planned ahead. Plan one, and the plant builds its buildings together.</p>'}</div>`;
  };
  /* Dispatch: in place of the older "Planned at the plant" rows, which only showed finished buildings. */
  const baseList = lgBoardList;
  lgBoardList = function () {
    let html = baseList();
    if (!lpAsks()) return html;
    const at = html.indexOf('<h2 class="sectionhead qc-group">Planned at the plant ');
    if (at >= 0) {
      const end = html.indexOf('<h2 class="sectionhead', at + 10);
      html = html.slice(0, at) + (end < 0 ? '' : html.slice(end));
    }
    if (!['all', 'plant'].includes(LG.tile) || LG.q.trim()) return html;
    return /class="panel emptystate"/.test(html) && !/ops-row/.test(html) ? lpSection() : lpSection() + html;
  };
  /* Loads: on the Planned tab, above the loads. */
  const loads = OPS_SCREENS['lg-loads'];
  OPS_SCREENS['lg-loads'] = function () {
    const html = loads();
    if (!lpAsks() || LG.tab !== 'planned' || (typeof LGX !== 'undefined' && LGX.viewAs !== 'coordinator')) return html;
    const at = html.indexOf('<div class="ops-list">');
    return at < 0 ? html : html.slice(0, at) + lpSection() + '<h2 class="sectionhead qc-group lp-head2">Loads being put together</h2>' + html.slice(at);
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-loads'] = OPS_SCREENS['lg-loads'];
  /* Calendar: a plan sits on the day it is aiming for. */
  const cal = OPS_SCREENS['lg-cal'];
  OPS_SCREENS['lg-cal'] = function () {
    const html = cal();
    if (!lpAsks()) return html;
    const days = Array.from({ length: 7 }, (_, i) => lgAddDays(lgToday(), LG.week * 7 + i)), parts = html.split(/<div class="lg-day(?=[ "])/);
    if (parts.length !== 8) return html;
    return parts.map((part, i) => {
      if (!i) return part;
      const plans = lpPlans().filter((l) => l.planDay === days[i - 1] && lpPlanLive(l).length);
      if (!plans.length) return part;
      const chips = plans.map((l) => `<button type="button" class="lg-chip planned lp-ahead" onclick="lpPlanOpen('${l.id}')"><b>${esc(l.id)}</b><span>${esc(lgRig(l.planRig)?.name || 'No trailer')}</span><small>${[...new Set(lpPlanLive(l).map((u) => lotById(u.lotId).town))].map(esc).join(' → ')}</small><em>${lpPlanState(l)[1]}</em></button>`).join('');
      const at = part.indexOf('<details class="lg-shut">');
      return at < 0 ? part : part.slice(0, at).replace('<p class="lg-none">Nothing scheduled</p>', '') + chips + part.slice(at);
    }).join('<div class="lg-day');
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-cal'] = OPS_SCREENS['lg-cal'];
  /* The plant's own load card shows what Logistics planned. */
  if (typeof prLoadCard === 'function') {
    const card = prLoadCard;
    prLoadCard = function (l) {
      const html = card(l), rig = typeof lgRig === 'function' ? lgRig(l.planRig) : null;
      if (!rig && !l.planDay) return html;
      return html.replace('<div class="pr-loadbar">', `<p class="lp-plantline">Logistics plan: ${rig ? esc(rig.name) : 'no trailer yet'} · ${l.planDay ? 'aiming for ' + lgDay(l.planDay) : 'no day yet'}</p><div class="pr-loadbar">`);
    };
  }

  /* ---------- The load page: fit labels, the filter, and which trailers fit ---------- */
  const page = OPS_SCREENS['lg-load'];
  OPS_SCREENS['lg-load'] = function () {
    let html = page();
    const load = lgLoad(LG.loadId);
    if (!load || !lpAsks() || !['planned', 'scheduled'].includes(load.state) || !lpCan()) return html;
    const rig = lgRig(load.rigId), on = lgLoadUnits(load), id = load.id;
    /* Each building that could be added says whether it fits. */
    html = html.replace(/<span class="ops-flags">((?:(?!<span class="ops-flags">)[\s\S])*?)<\/span><\/div>\s*<button type="button" class="secondary small" onclick="lgAdd\('([^']*)','([^']*)'\)">Add<\/button>/g, (m, flags, lid, uid) => {
      const u = lgUnit(uid);
      if (!u) return m;
      const f = lpFit([...on, u], rig, load.kind), rest = flags.replace(/<span class="ops-flag bad">\d+ ft over if added<\/span>/, '').replace('<span class="ops-flag ok">Fits</span>', '');
      return `<span class="ops-flags">${lpChip(f)}${rest}${lpWhy(f)}</span></div>\n      <button type="button" class="secondary small" onclick="lgAdd('${lid}','${uid}')">Add</button>`;
    });
    /* The filter buttons, under the panel's first line. */
    const lede = html.search(/<p class="lede-small">(Ready at the plant\. Buildings|Sold buildings waiting)/), stop = lede < 0 ? -1 : html.indexOf('</p>', lede);
    if (stop >= 0) html = html.slice(0, stop + 4) + lpFilters('') + html.slice(stop + 4);
    if (LP.hidden) html = html.replace('<p class="empty">Nothing else is ready from here.</p>', `<p class="empty">Nothing here fits this trailer. <button type="button" class="link inline" onclick="lpSetFilter('all',null)">Show all ${LP.hidden}</button></p>`);
    /* Which trailers fit, under the trailer picker. */
    if (on.length) {
      html = html.replace(/<option value="([^"]+)"(\s*selected)?\s*>([^<]*)<\/option>/g, (m, rid, sel, text) => {
        const r = lgRig(rid);
        return r ? `<option value="${rid}"${sel || ''}>${text} · ${LP_LABEL[lpFit(on, r, load.kind).level].toLowerCase()}</option>` : m;
      });
      const set = html.indexOf('<div class="fields lg-setup">'), end = set < 0 ? -1 : html.indexOf('</div>', set);
      if (end >= 0) {
        const rows = LG.rigs.map((r) => ({ r, f: lpFit(on, r, load.kind) })), shown = rows.filter((x) => lpShow(x.f.level));
        const list = `<details class="lp-rigs" ${LP.rigsOpen ? 'open' : ''} ontoggle="LP.rigsOpen=this.open"><summary><b>Which trailers fit this load</b><span>${rows.filter((x) => x.f.level === 'yes').length} fit · ${rows.filter((x) => x.f.level === 'tight').length} tight · ${rows.filter((x) => x.f.level === 'no').length} will not fit</span></summary>
          ${lpFilters('')}<div class="lp-rows">${shown.map(({ r, f }) => `<div class="lp-row"><div class="grow"><strong>${esc(r.name)}</strong><small>${r.feet ? r.feet + ' ft' : 'no length on file'}${r.driver ? ' · ' + esc(r.driver) : ''}</small><span class="ops-flags">${lpChip(f)}${lpWhy(f)}</span></div>
          ${load.rigId === r.id ? '<span class="pill blue">Picked</span>' : `<button type="button" class="secondary small" onclick="lgSet('${id}','rigId','${r.id}')">Use this trailer</button>`}</div>`).join('') || '<p class="empty">No trailer fits this load. Show all to pick one anyway.</p>'}</div></details>`;
        html = html.slice(0, end + 6) + list + html.slice(end + 6);
      }
    }
    return html;
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-load'] = OPS_SCREENS['lg-load'];

  /* The explainer page: what is real, what is pretend, and the questions. */
  const notes = OPS_SCREENS['lg-notes'];
  if (notes) {
    OPS_SCREENS['lg-notes'] = function () {
      return notes() + `<section class="panel lp-notes"><div class="panelhead"><h2>Planned loads, breaking a load apart, and what fits</h2></div>
        <p><b>How Turbo Assist does it today.</b> A load is planned before the plant builds it and gets a letter (A, B, up to ZZ). When the load is sent to the plant, Logistics gets a load with the same letter. A building that is built early can leave on its own: it moves to the letter plus “-L1”, then “-L2”. Turbo Assist warns when a building is longer than the trailer, when a trailer has no length on file, and when a trailer is not set up for that kind of trip.</p>
        <p><b>Added here, still to be accepted.</b> A trailer and a target day on a planned load. Breaking a whole load apart in one step. Putting loose buildings back together under their letter. Counting all the buildings together against the trailer length. Calling it “tight” under ${LP_SPARE} ft to spare.</p>
        <p><b>Not checked.</b> Height and weight. Neither Turbo Assist nor this preview keeps a height or weight for a building, or a limit for a trailer.</p>
        <p><b>Questions for Turbo Assist’s builder.</b></p><ul class="lp-list"><li>Should a planned load carry a trailer and a target day before it is built?</li><li>When a building that was broken out joins other buildings, which code does the new load take? Here: the next “-L” code under the letter of the first building picked.</li><li>Should a whole load break apart in one step?</li><li>Is “all the buildings together are longer than the trailer” a stop or a warning? Are there width, height or weight limits, or an allowed overhang?</li></ul>
        ${S.sfNotes ? '<p class="source"><code>mfg_production_loads</code>, <code>mintShipmentForProductionLoad</code>, <code>stampUnitsOntoShipment</code>, <code>assertUnitEligibleForLogisticsRoute</code>, <code>splitUnitFromShipment</code>, <code>nextLogisticsSplitCode</code>, <code>buildRigAssignmentWarnings</code>, <code>readRigHaulFlags</code>.</p>' : ''}</section>`;
    };
    if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-notes'] = OPS_SCREENS['lg-notes'];
  }
}

/* The sample plan the plant already sent to the floor has a trailer and a day, so the screens show one. */
(function lpSeed() {
  if (typeof PR === 'undefined') return;
  const sent = PR.loads.find((l) => l.state === 'dispatched'), open = PR.loads.find((l) => l.state === 'open');
  let day = lgAddDays(lgToday(), 3);
  if (sent) Object.assign(sent, { planRig: 'rig-1', planDay: day, plog: [{ at: sent.made, text: 'Planned ahead' }, { at: sent.dispatchedAt || sent.made, text: 'Sent to the plant floor' }] });
  if (open) open.plog = [{ at: open.made, text: 'Planned ahead' }];
})();
