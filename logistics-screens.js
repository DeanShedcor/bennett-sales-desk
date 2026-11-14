/* logistics-screens.js: the Logistics screens. Records, rules and actions are in logistics.js. */

const lgAgo = (t) => {
  const h = Math.max(0, Math.round((Date.now() - t) / 36e5));
  return h < 1 ? 'under an hour' : h < 48 ? lgPlural(h, 'hour') : lgPlural(Math.round(h / 24), 'day');
};
const lgSample = (x) => (x.sample ? '<span class="pill ghost">Sample</span>' : '');
const lgMatch = (u) => !LG.q.trim() || `${u.id} ${u.name} ${u.customer} ${lotById(u.lotId).town}`.toLowerCase().includes(LG.q.trim().toLowerCase());
const lgMapLink = (text) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text);

/* ---------- One building ---------- */
function lgUnitRow(u, mode) {
  const lot = lotById(u.lotId), hold = lgHold(u), home = u.leg && u.leg !== 'plant-lot', probs = home ? lgSiteProblems(u) : [], s = lgSale(u), siteOpen = home ? lgSiteOpen(u) : '';
  const flags = [
    u.kind === 'stock' ? '<span class="ops-flag">Inventory for the lot</span>' : `<span class="ops-flag wait">Customer · ${esc(u.customer)}</span>`,
    u.leg && u.kind === 'order' ? `<span class="ops-flag ${u.leg === 'plant-lot' ? '' : 'wait'}">${u.leg === 'plant-lot' ? 'Through the lot' : LG_LEG[u.leg]}</span>` : '',
    lgWide(u) ? `<span class="ops-flag todo">Wide load · ${u.wid} ft</span>` : '',
    hold ? `<span class="ops-flag bad">${esc(hold)}</span>` : home && s ? `<span class="ops-flag ok">${esc(ofPayRule(s).text)}</span>` : '',
    home ? `<span class="ops-flag ${siteOpen ? 'todo' : 'ok'}">${siteOpen ? (/^ask/.test(siteOpen) ? 'Site questions not asked' : 'Site not confirmed yet') : 'Site confirmed'}</span>` : '',
    ...probs.map((p) => `<span class="ops-flag todo">${esc(p)}</span>`),
  ].join('');
  const act = mode === 'pick'
    ? `<label class="lg-tick"><input type="checkbox" ${LG.pick.includes(u.id) ? 'checked' : ''} onchange="lgTogglePick('${u.id}',this.checked)" aria-label="Pick ${esc(u.name)} for a load"><span>Pick</span></label>`
    : mode === 'home' ? `<button type="button" class="primary small" ${hold ? 'disabled' : ''} onclick="lgNewHome('${u.id}')">Schedule delivery</button>` : '';
  const more = mode === 'pick' && u.kind === 'order' && (s || u.site) ? `<button type="button" class="link" onclick="lgSwitchPath('${u.id}')">${u.leg === 'plant-lot' ? 'Send plant to home instead' : 'Send through the lot instead'}</button>` : '';
  const site = home ? `<button type="button" class="link" onclick="lgSiteForm('${u.id}')">${siteOpen ? 'Confirm the site' : 'Site answers'}</button>` : '';
  return `<article class="ops-row lg-unit${LG.pick.includes(u.id) ? ' picked' : ''}"><span class="lg-size"><b>${u.wid} × ${u.len}</b><small>${u.len} ft long</small></span>
    <div class="grow"><div class="ops-rowtop"><strong>${esc(u.name.replace(u.size, '').trim())}</strong><span class="serial">${esc(u.id)}</span>${lgSample(u)}</div>
    <p class="ops-rowsub">To ${esc(lgDest(u))} · ready ${lgAgo(u.readyAt)}</p><div class="ops-flags">${flags}</div></div>
    <div class="ops-rowacts">${more}${site}${act}</div></article>`;
}
function lgLoadRow(load) {
  const units = lgLoadUnits(load), rig = lgRig(load.rigId), miles = lgMiles(load).total, blocked = load.state === 'planned' ? lgBlocked(load) : [];
  const path = [load.from.type === 'plant' ? lgOrigin(load).town + ' plant' : lgOrigin(load).town + ' lot', ...load.stops.map((x) => (lgStopIsLot(x) ? lgStopLot(x).town : lgStopUnits(x)[0].customer))].join(' → ');
  const doneStops = load.stops.filter((x) => x.done).length;
  const flag = load.state === 'planned' ? (blocked.length ? `<span class="ops-flag todo">${esc(blocked[0].text)}</span>` : '<span class="ops-flag ok">Ready to schedule</span>')
    : load.state === 'in_transit' ? `<span class="ops-flag wait">${doneStops} of ${load.stops.length} stops done</span>` : '';
  return `<article class="ops-row"><span class="lg-code${load.kind === 'home' ? ' home' : ''}">${esc(load.id)}</span><div class="grow"><div class="ops-rowtop"><strong>${lgLoadName(load)}</strong><span class="serial">${rig ? esc(rig.name) + (load.driver && load.driver !== rig.name ? ' · ' + esc(load.driver) : '') : 'No trailer yet'}</span><span class="pill ${LG_STATE_PILL[load.state]}">${LG_STATE[load.state]}</span>${lgSample(load)}</div>
    <p class="ops-rowsub">${load.date ? lgDay(load.date) + (load.window !== 'Date only' ? ', ' + esc((load.windowNote || load.window).toLowerCase()) : '') : 'No day yet'} · ${esc(path)}</p>
    <div class="ops-flags"><span class="ops-flag">${lgPlural(units.length, 'building')} · ${lgFeet(load)}${rig?.feet ? ' of ' + rig.feet : ''} ft</span><span class="ops-flag">about ${miles} mi</span>${flag}</div></div>
    <button type="button" class="secondary small" onclick="lgOpen('${load.id}')">Open ${icon('arrow', 16)}</button></article>`;
}

/* ---------- Dispatch board ---------- */
function lgBoardList() {
  const ready = LG.units.filter((u) => u.leg && !u.loadId && lgMatch(u)), show = (k) => LG.tile === 'all' || LG.tile === k;
  const atPlant = ready.filter((u) => u.at === 'plant'), atLot = ready.filter((u) => u.at === 'lot');
  const loads = LG.loads.filter((l) => ['planned', 'scheduled', 'in_transit'].includes(l.state) && (!LG.q.trim() || lgLoadUnits(l).some(lgMatch) || l.id.toLowerCase() === LG.q.trim().toLowerCase()));
  /* Buildings at the plant, grouped by the lot they head for, nearest first. */
  const groups = new Map();
  atPlant.forEach((u) => groups.set(u.lotId, [...(groups.get(u.lotId) || []), u]));
  const byLot = [...groups.entries()].map(([id, list]) => ({ lot: lotById(id), list, miles: milesBetween(plantById(list[0].plantId), lotById(id)) })).sort((a, b) => a.miles - b.miles);
  const plantHtml = byLot.map((g) => `<div class="lg-group"><h3>${esc(lotTown(g.lot))} <small>about ${g.miles} mi from the plant · ${lgPlural(g.list.length, 'building')} · ${g.list.reduce((t, u) => t + u.len, 0)} ft</small></h3>
    <div class="ops-list">${g.list.sort((a, b) => a.readyAt - b.readyAt).map((u) => lgUnitRow(u, 'pick')).join('')}</div></div>`).join('');
  const sec = (k, title, n, body) => (show(k) && n ? `<h2 class="sectionhead qc-group">${title} <small>${n}</small></h2>${body}` : '');
  const order = { in_transit: 0, scheduled: 1, planned: 2 };
  const fees = lgFeeList().filter((s) => !LG.q.trim() || `${s.customer} ${s.id} ${saleLot(s).town}`.toLowerCase().includes(LG.q.trim().toLowerCase()));
  const feeRow = (s) => `<article class="ops-row"><span class="lg-size"><b>${ofDelivery(s).miles}</b><small>miles</small></span><div class="grow"><div class="ops-rowtop"><strong>${esc(s.customer)}</strong><span class="serial">${esc(s.id)}</span>${lgSample(s)}</div>
    <p class="ops-rowsub">${esc(label(s.c))} · from the ${esc(saleLot(s).town)} lot · ${esc(siteLine(s))}</p><div class="ops-flags"><span class="ops-flag todo">Past ${OF.set.overTo} miles: the fee is yours to approve</span></div></div>
    <button type="button" class="primary small" onclick="lgFeeForm('${s.id}')">Set the fee</button></article>`;
  const html = [
    LG.tile === 'all' && fees.length ? `<h2 class="sectionhead qc-group">Delivery fees to approve <small>${fees.length}</small></h2><div class="ops-list">${fees.map(feeRow).join('')}</div>` : '',
    sec('road', 'On the road now', loads.filter((l) => l.state === 'in_transit').length, `<div class="ops-list">${loads.filter((l) => l.state === 'in_transit').map(lgLoadRow).join('')}</div>`),
    sec('plant', 'At the plant, ready to load', atPlant.length, plantHtml),
    sec('lot', 'At a lot, waiting for home delivery', atLot.length, `<div class="ops-list">${atLot.sort((a, b) => a.readyAt - b.readyAt).map((u) => lgUnitRow(u, 'home')).join('')}</div>`),
    sec('loads', 'Loads planned and scheduled', loads.filter((l) => l.state !== 'in_transit').length, `<div class="ops-list">${loads.filter((l) => l.state !== 'in_transit').sort((a, b) => order[a.state] - order[b.state] || (a.date || '9').localeCompare(b.date || '9')).map(lgLoadRow).join('')}</div>`),
  ].join('');
  return html || `<div class="panel emptystate"><strong>Nothing here</strong><p>No building or load matches.</p>${button('Show everything', "LG.tile='all';LG.q='';render()", 'secondary')}</div>`;
}
function lgBoard() {
  const ready = LG.units.filter((u) => u.leg && !u.loadId), live = LG.loads.filter((l) => ['planned', 'scheduled'].includes(l.state)), road = LG.loads.filter((l) => l.state === 'in_transit');
  const kpi = (k, n, text) => `<button type="button" class="kpi" aria-pressed="${LG.tile === k}" onclick="LG.tile=LG.tile==='${k}'?'all':'${k}';render()"><strong>${n}</strong><span>${text}</span></button>`;
  const picked = LG.pick.map(lgUnit).filter((u) => u && !u.loadId), feet = picked.reduce((t, u) => t + u.len, 0);
  return `${head('Logistics · ' + PLANTS.length + (PLANTS.length === 1 ? ' plant' : ' plants') + ' · ' + LOTS.length + ' lots', 'What has to move.', 'Finished buildings go from the plant to the lots on a trailer load, and from there to the customer. Some go straight from the plant to the customer.')}
  <div class="today ops-tiles">
    ${kpi('plant', ready.filter((u) => u.at === 'plant').length, 'at the plant, ready to load')}
    ${kpi('lot', ready.filter((u) => u.at === 'lot').length, 'at a lot, for home delivery')}
    ${kpi('loads', live.length, 'loads planned or scheduled')}
    ${kpi('road', road.length, 'on the road now')}
  </div>
  <div class="qc-filter"><label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search serial, customer or lot" aria-label="Search serial, customer or lot" value="${esc(LG.q)}" oninput="LG.q=this.value;$('#lg-list').innerHTML=lgBoardList()"></label></div>
  <div id="lg-list">${lgBoardList()}</div>
  ${picked.length ? `<div class="ops-bar"><div class="grow"><strong>${lgPlural(picked.length, 'building')} picked · ${feet} ft</strong><small>${picked.map((u) => `${u.size} to ${lotById(u.lotId).town}`).join(' · ')}</small></div><button type="button" class="ops-quiet" onclick="LG.pick=[];render()">Clear</button><button type="button" class="primary" onclick="lgNewLoad()">Build a load ${icon('arrow', 18)}</button></div>` : ''}
  ${opsNotes([
    ['Ready to load', 'A unit can be routed once it is built and flagged ready to deliver (<code>assertUnitEligibleForLogisticsRoute</code>).'],
    ['The board', 'Logistics → Routes: the queue and the dispatch board (<code>LogisticsRoutesDispatchBoard</code>), where a planned delivery is dragged onto a rig.'],
    ['Build a load', 'A shipment for the plant load (<code>mintShipmentForProductionLoad</code>, codes like “AC”) with one route per building (<code>createOrgRoute</code>).'],
    ['Schedule delivery', 'A route from the lot to the customer: stops <code>dealer_holding</code> → <code>end_customer</code>.'],
    ['Plant to lot · plant to home · lot to home', 'Turbo Logistics has no leg field: the stops say it (<code>plant_origin</code>, <code>dealer_holding</code>, <code>end_customer</code>).'],
  ], ['Picking several buildings and seeing their total length against a trailer.', 'Switching a building between through the lot and plant to home.', 'Holding a home delivery until the payment rule is met.', 'Logistics approving the delivery fee past ' + OF.set.overTo + ' miles.', 'Confirming the delivery-site answers with the customer before a delivery is scheduled.'])}`;
}

/* ---------- One load ---------- */
/* The trailer, drawn to scale: the cab on the left, the last stop's building at the front. */
function lgTrailer(load) {
  const rig = lgRig(load.rigId), feet = lgFeet(load), cap = rig?.feet || 0, total = Math.max(cap, feet, 1);
  const blocks = load.stops.map((stop, i) => ({ stop, i })).reverse().flatMap(({ stop, i }) => lgStopUnits(stop).map((u) => `<span class="lg-block ${lgStopIsLot(stop) ? 'lot' : 'home'}${stop.done ? ' gone' : ''}" style="width:${(u.len / total) * 100}%" title="${esc(u.name)} for ${esc(lgDest(u))}"><b>${u.wid}×${u.len}</b><small>Stop ${i + 1}</small></span>`));
  const free = cap - feet;
  return `<div class="lg-trailer"><span class="lg-cab">${icon('truck', 22)}</span><div class="lg-deck${cap && feet > cap ? ' over' : ''}">${blocks.join('')}${free > 0 ? `<span class="lg-free" style="width:${(free / total) * 100}%">${free} ft free</span>` : ''}${cap && feet > cap ? `<i class="lg-limit" style="left:${(cap / total) * 100}%"></i>` : ''}</div></div>
    <p class="lg-capline">${cap ? `<strong>${feet} ft</strong> of buildings on a ${cap} ft trailer${free < 0 ? ` · <b>${-free} ft too long</b>` : free === 0 ? ' · full' : ''}` : `<strong>${feet} ft</strong> of buildings · pick a trailer to check the fit`} <span>Front of the trailer on the left. The last stop’s building loads first.</span></p>`;
}
function lgStopCard(load, i, big) {
  const stop = load.stops[i], isLot = lgStopIsLot(stop), lot = lgStopLot(stop), units = lgStopUnits(stop), miles = lgMiles(load).legs[i], editable = ['planned', 'scheduled'].includes(load.state);
  const next = load.state === 'in_transit' && load.stops.findIndex((x) => !x.done) === i, u = units[0], s = isLot ? null : lgSale(u), site = isLot ? null : lgSite(u);
  const day = isLot && load.date && editable ? lotDay(lot, load.date) : null;
  const addr = isLot ? placeAddress(lot) : s ? [orderInvoice(s).shipTo.street, orderInvoice(s).shipTo.city].filter(Boolean).join(', ') : '';
  const where = isLot ? `${esc(placeAddress(lot))} · ${esc(lot.phone)}` : `${site && site.miles !== '' && site.miles != null ? site.miles + ' mi from' : 'Near'} the ${esc(lot.town)} lot${addr ? ' · ' + esc(addr) : ''}`;
  const pay = s ? ofPayRule(s) : null;
  const lines = [
    day ? `<small class="${day.open ? '' : 'lg-bad'}">${esc(day.text)} on ${lgDay(load.date)}</small>` : '',
    !isLot && site ? `<small>${esc([site.access, site.noGate ? 'no gate' : site.gate ? site.gate + ' ft opening' : '', site.ground, site.notes].filter(Boolean).join(' · '))}</small>` : '',
    !isLot && !stop.done ? `<small class="${lgSiteOpen(u) ? 'lg-bad' : 'lg-good'}">${lgSiteOpen(u) ? 'Site: ' + esc(lgSiteOpen(u)) : 'Site confirmed with the customer ' + lgStamp(site.confirmed)}</small>` : '',
    pay ? `<small class="${pay.ok ? '' : 'lg-bad'}">${esc(pay.text)}${stop.collected ? ` · driver collected ${money(stop.collected)}` : ''}</small>` : '',
    s && load.state === 'scheduled' ? `<small>${s.toldCustomer ? 'The customer has been told the day' : 'The salesperson tells the customer the day · not ticked yet'}</small>` : '',
    stop.done ? `<small class="lg-good">${isLot ? 'Unloaded' : 'Delivered'} ${lgStamp(stop.done)} · ${isLot ? 'received' : 'signed'} by ${esc(stop.proof?.by || '')}${stop.proof?.note ? ' · ' + esc(stop.proof.note) : ''}${stop.proof?.photo ? ' · photo ' + esc(stop.proof.photo) : ''}</small>` : stop.arrived ? `<small>Arrived ${lgStamp(stop.arrived)}</small>` : '',
  ].join('');
  const acts = next
    ? (stop.arrived ? `<button type="button" class="primary${big ? ' big' : ' small'}" onclick="lgDropForm('${load.id}',${i})">${isLot ? 'Unload here' : 'Deliver here'}</button>` : `<button type="button" class="primary${big ? ' big' : ' small'}" onclick="lgArrive('${load.id}',${i})">Arrived</button>`)
    : editable && !big && load.stops.length > 1 ? `<span class="lg-updown"><button type="button" class="chipbtn" ${i ? '' : 'disabled'} onclick="lgMoveStop('${load.id}',${i},-1)" aria-label="Move this stop earlier">↑</button><button type="button" class="chipbtn" ${i < load.stops.length - 1 ? '' : 'disabled'} onclick="lgMoveStop('${load.id}',${i},1)" aria-label="Move this stop later">↓</button></span>` : '';
  return `<div class="lg-stop${stop.done ? ' done' : next ? ' now' : ''}"><span class="lg-stopn">${stop.done ? icon('check', 16) : i + 1}</span><div class="grow">
    <strong>${isLot ? esc(lot.town) + ' lot' : esc(u.customer) + ' · customer delivery'}</strong><small>${where} · about ${miles} mi from ${i ? 'the stop before' : load.from.type === 'plant' ? 'the plant' : 'the lot'}</small>${lines}
    <ul class="lg-stopunits">${units.map((x) => `<li><b>${x.wid} × ${x.len}</b> ${esc(x.name.replace(x.size, '').trim())} <span class="serial">${esc(x.id)}</span>${x.kind === 'order' && isLot ? ` <span class="ops-flag wait">for ${esc(x.customer)}</span>` : ''}${lgWide(x) ? ' <span class="ops-flag todo">Wide</span>' : ''}${editable && !big ? ` <button type="button" class="of-x" aria-label="Take ${esc(x.name)} off this load" onclick="lgRemove('${load.id}','${x.id}')">×</button>` : ''}</li>`).join('')}</ul></div>
    <div class="lg-stopacts">${acts}${!isLot && editable && !big ? `<button type="button" class="${lgSiteOpen(u) ? 'primary' : 'secondary'} small" onclick="lgSiteForm('${u.id}')">${lgSiteOpen(u) ? 'Confirm the site' : 'Site answers'}</button>` : ''}${addr || isLot ? `<a class="chipbtn" target="_blank" rel="noopener" href="${lgMapLink(isLot ? placeAddress(lot) : addr)}">${icon('pin', 16)} Directions</a>` : ''}</div></div>`;
}
/* Buildings that could ride along: the same stops first, then the same area, oldest first. */
function lgCandidates(load) {
  const rig = lgRig(load.rigId), free = rig?.feet ? rig.feet - lgFeet(load) : null, origin = lgOrigin(load), spots = load.stops.map(lgSpot);
  const pool = LG.units.filter((u) => u.leg && !u.loadId && (load.kind === 'haul' ? u.at === 'plant' && u.plantId === load.from.id : u.at === 'lot' && u.lotId === load.from.id && u.leg === 'lot-home'));
  return pool.map((u) => {
    const lot = lotById(u.lotId), near = spots.length ? Math.min(...spots.map((sp) => milesBetween(sp.p, lot) || 0)) : milesBetween(origin, lot);
    return { u, near, same: load.stops.some((x) => x.key === lgStopKey(u)), fits: free == null ? null : u.len <= free, hold: lgHold(u) };
  }).sort((a, b) => b.same - a.same || a.near - b.near || a.u.readyAt - b.u.readyAt);
}
function lgLoadPage() {
  const load = lgLoad(LG.loadId);
  if (!load) return `<button class="link backlink" onclick="go('logi')">${icon('back', 18)} Dispatch</button><div class="panel emptystate"><strong>Choose a load</strong><p>Pick one from the board.</p></div>`;
  const rig = lgRig(load.rigId), units = lgLoadUnits(load), miles = lgMiles(load), checks = lgChecks(load), stops = checks.filter((c) => c.level === 'stop'), id = load.id;
  const editable = ['planned', 'scheduled'].includes(load.state), at = { planned: 0, scheduled: 1, in_transit: 2, delivered: 4, cancelled: 0 }[load.state];
  const cands = editable ? lgCandidates(load) : [], free = rig?.feet ? rig.feet - lgFeet(load) : null, wide = units.some(lgWide);
  const rigs = LG.rigs;
  const doneStops = load.stops.filter((x) => x.done).length, nextI = load.stops.findIndex((x) => !x.done), nextStop = load.stops[nextI];
  const setup = `<section class="panel"><div class="panelhead"><h2>Trailer and day</h2>${rig ? `<span class="pill blue">${esc(lgCarrier(rig.carrierId)?.name || '')}</span>` : ''}</div>
    <div class="fields lg-setup"><label>Trailer<select ${editable ? '' : 'disabled'} onchange="lgSet('${id}','rigId',this.value)"><option value="">Choose a trailer</option>${rigs.map((r) => `<option value="${r.id}" ${load.rigId === r.id ? 'selected' : ''}>${esc(r.name)} · ${r.feet ? r.feet + ' ft' : 'no length on file'}${r.haul && r.home ? '' : r.home ? ' · home deliveries' : ' · plant hauls'}</option>`).join('')}</select></label>
    <label>Driver<input ${editable ? '' : 'disabled'} maxlength="40" value="${esc(load.driver)}" onchange="lgSet('${id}','driver',this.value.trim())" placeholder="Made-up name in this preview"></label>
    <label>Day<input type="date" ${editable ? '' : 'disabled'} min="${lgToday()}" value="${load.date}" onchange="lgSet('${id}','date',this.value)"></label>
    <label>Time<select ${editable ? '' : 'disabled'} onchange="lgSet('${id}','window',this.value)">${LG_WINDOWS.map((w) => `<option ${load.window === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
    ${/Specific/.test(load.window) ? `<label>${load.window === 'Specific time' ? 'What time' : 'Between'}<input ${editable ? '' : 'disabled'} maxlength="30" value="${esc(load.windowNote)}" onchange="lgSet('${id}','windowNote',this.value.trim())" placeholder="${load.window === 'Specific time' ? 'Example: 10:30 AM' : 'Example: 10 AM to noon'}"></label>` : ''}</div>
    ${wide ? `<label class="checkrow lg-permit"><input type="checkbox" ${load.permit ? 'checked' : ''} ${editable ? '' : 'disabled'} onchange="lgSet('${id}','permit',this.checked)"> Permit confirmed for the wide load${lgStates(load).length > 1 ? ` (${lgStates(load).join(', ')})` : ''}</label>` : ''}
    ${lgTrailer(load)}</section>`;
  const stopPanel = `<section class="panel"><div class="panelhead"><h2>Stops, in drop order</h2><span class="od-tag">about ${miles.total} mi to the last stop</span></div>
    <div class="lg-stop origin"><span class="lg-stopn">${icon(load.from.type === 'plant' ? 'build' : 'lot', 16)}</span><div class="grow"><strong>Start: ${esc(lgOriginName(load))}</strong><small>${esc(placeAddress(lgOrigin(load)))}</small></div></div>
    ${load.stops.map((_, i) => lgStopCard(load, i)).join('') || '<p class="empty">No buildings on this load yet. Add some below.</p>'}</section>`;
  const checkPanel = load.state === 'delivered' || load.state === 'cancelled' ? '' : `<section class="panel"><div class="panelhead"><h2>Checks</h2><span class="pill ${stops.length ? 'red' : checks.some((c) => c.level === 'warn') ? 'amber' : 'good'}">${stops.length ? lgPlural(stops.length, 'thing') + ' to fix' : checks.some((c) => c.level === 'warn') ? 'Look these over' : 'All clear'}</span></div>
    ${checks.map((c) => `<div class="lg-check ${c.level}"><span>${c.level === 'stop' ? '!' : c.level === 'warn' ? '!' : 'i'}</span><p>${esc(c.text)}</p></div>`).join('') || '<p class="lg-good">Nothing stands in the way.</p>'}</section>`;
  const addPanel = !editable ? '' : `<section class="panel"><div class="panelhead"><h2>Add buildings</h2><span class="od-tag">${free == null ? 'No trailer picked' : free > 0 ? free + ' ft free' : free === 0 ? 'Trailer is full' : -free + ' ft over'}</span></div>
    <p class="lede-small">${load.kind === 'haul' ? 'Ready at the plant. Buildings for the same stops come first, then the same area, then the ones that have waited longest.' : `Sold buildings waiting at the ${esc(lgOrigin(load).town)} lot.`}</p>
    ${cands.slice(0, LG.more ? 99 : 6).map(({ u, near, same, fits, hold }) => `<div class="lg-cand"><span class="lg-size sm"><b>${u.wid} × ${u.len}</b></span><div class="grow"><strong>${esc(u.name.replace(u.size, '').trim())}</strong><small>To ${esc(lgDest(u))}${same ? ' · same stop' : load.stops.length ? ` · about ${near} mi from a stop on this load` : ''}${u.leg === 'plant-home' ? ' · plant to home' : ''}</small>
      <span class="ops-flags">${fits === false ? `<span class="ops-flag bad">${u.len - free} ft too long</span>` : fits ? '<span class="ops-flag ok">Fits</span>' : ''}${hold ? `<span class="ops-flag bad">${esc(hold)}</span>` : ''}${lgWide(u) ? '<span class="ops-flag todo">Wide</span>' : ''}</span></div>
      <button type="button" class="secondary small" onclick="lgAdd('${id}','${u.id}')">Add</button></div>`).join('') || '<p class="empty">Nothing else is ready from here.</p>'}
    ${cands.length > 6 ? `<button type="button" class="link" onclick="LG.more=!LG.more;render()">${LG.more ? 'Show fewer' : `Show all ${cands.length}`}</button>` : ''}</section>`;
  const bar = load.state === 'planned'
    ? `<div class="ops-bar"><div class="grow"><strong>${stops.length ? `${lgPlural(stops.length, 'thing')} to fix before scheduling` : 'Ready to schedule'}</strong><small>${stops.length ? esc(stops[0].text) : `${lgDay(load.date)} · ${esc(rig.name)}${load.driver ? ' · ' + esc(load.driver) : ''}`}</small></div><button type="button" class="ops-quiet" onclick="lgCancelForm('${id}')">Cancel</button><button type="button" class="primary" ${stops.length ? 'disabled' : ''} onclick="lgSchedule('${id}')">Schedule</button></div>`
    : load.state === 'scheduled'
      ? `<div class="ops-bar"><div class="grow"><strong>Scheduled for ${lgDay(load.date)}</strong><small>${esc(rig?.name || '')}${load.driver ? ' · ' + esc(load.driver) : ''}${stops.length ? ' · ' + esc(stops[0].text) : ''}</small></div><button type="button" class="ops-quiet" onclick="lgCancelForm('${id}')">Cancel</button><button type="button" class="primary" ${stops.length ? 'disabled' : ''} onclick="lgStart('${id}')">Start the run</button></div>`
      : load.state === 'in_transit' && nextStop
        ? `<div class="ops-bar"><div class="grow"><strong>On the road · ${doneStops} of ${load.stops.length} stops done</strong><small>Next: ${lgStopIsLot(nextStop) ? esc(lgStopLot(nextStop).town) + ' lot' : esc(lgStopUnits(nextStop)[0].customer)}</small></div>${nextStop.arrived ? `<button type="button" class="primary" onclick="lgDropForm('${id}',${nextI})">${lgStopIsLot(nextStop) ? 'Unload here' : 'Deliver here'}</button>` : `<button type="button" class="primary" onclick="lgArrive('${id}',${nextI})">Arrived</button>`}</div>` : '';
  return `<button class="link backlink" onclick="go('${LG.back}')">${icon('back', 18)} ${lgDetailNav()[1]}</button>
  ${head(`${load.kind === 'haul' ? 'Plant load' : 'Home delivery'} · from ${esc(lgOriginName(load))}`, lgLoadName(load), `${lgPlural(units.length, 'building')} · ${lgPlural(load.stops.length, 'stop')}${units.length ? ` · about ${miles.total} miles to the last stop` : ''}`)}
  <section class="panel of-top"><div class="pillrow"><span class="pill ${LG_STATE_PILL[load.state]}">${LG_STATE[load.state]}</span>${load.date ? `<span class="pill">${lgDay(load.date)}${load.window !== 'Date only' ? ' · ' + esc(load.windowNote || load.window) : ''}</span>` : ''}${lgSample(load)}</div>
    ${load.state === 'cancelled' ? '' : chevronTrack(['Planned', 'Scheduled', 'On the road', 'Delivered'], at)}</section>
  <div class="od-grid"><div class="od-col">${setup}${stopPanel}</div><div class="od-col">${checkPanel}${addPanel}
    <section class="panel"><h2>History</h2>${load.log.slice().reverse().map((e) => `<div class="log"><small>${lgStamp(e.at)}</small><br>${esc(e.text)}</div>`).join('')}</section></div></div>
  ${bar}
  ${opsNotes([
    ['Trailer', 'A rig (<code>logi_carrier_rigs</code>): designation, usual driver, capacity in linear feet, and two flags, plant haul and home delivery. Assigned with <code>assignOrgRouteToRig</code>.'],
    ['Checks about the rig', 'Turbo Logistics’ own warnings (<code>buildRigAssignmentWarnings</code>): not flagged for the kind of run, no capacity on file, a unit longer than the rig, another route that day. They warn; they do not block.'],
    ['Day and time', '<code>updateOrgRoute</code>: delivery date and a window label (Date only, Morning, Afternoon, Specific window, Specific time). Permit required is a manual flag.'],
    ['Stops and their order', '<code>addStopToRoute</code>, <code>reorderOrgRouteStops</code>. Lot drops first, the customer last, as the plan says.'],
    ['Schedule · Start the run · Delivered', 'Route states planned → scheduled → in transit → delivered (<code>transitionOrgRouteState</code>). Scheduling tells the salesperson to relay the day (<code>notifyRouteDeliveryStateTransition</code>).'],
    ['Arrived · Unload here', 'The driver stamps the stop (<code>stampDriverStop</code>) and fills the proof form in FastField: photo, GPS and signature. Turbo Ops owns that form and files it to the deal paperwork.'],
    ['Take a building off', 'Splitting a unit from its shipment, with a reason (<code>splitUnitFromShipment</code>).'],
    ['Miles', '<code>computeOrgRouteMileage</code> measures real road miles. The miles here are rough.'],
    ['Not drawn here', 'Turbo Logistics can email or download a route manifest for a hauler without an account (<code>emailLogisticsRouteManifest</code>).'],
  ], [
    'Adding up every building’s length against the trailer, and stopping a load that is too long. Turbo Logistics checks one unit at a time.',
    'The trailer drawing and the loading order.',
    'Warnings for a lot that is closed that day, a wide load, crossing a state line, and the delivery site.',
    'Stopping a home delivery until Logistics has confirmed the site answers with the customer.',
    'Suggesting buildings for the same area.',
    'The driver taking the final payment at delivery.',
    'Signing on this screen. In Turbo Logistics the proof form opens in FastField.',
  ])}`;
}

/* ---------- Every load ---------- */
function lgLoads() {
  const tabs = ['planned', 'scheduled', 'in_transit', 'delivered', 'cancelled'], rows = LG.loads.filter((l) => l.state === LG.tab).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.made - a.made);
  return `${head('Logistics', 'Every load.', 'Plant loads and home deliveries, by where they stand.')}
  <div class="chiprow ops-tabs">${tabs.map((k) => `<button type="button" class="chipbtn${LG.tab === k ? ' on' : ''}" onclick="LG.tab='${k}';render()">${LG_STATE[k]} <span class="ops-n">${LG.loads.filter((l) => l.state === k).length}</span></button>`).join('')}</div>
  <div class="ops-list">${rows.map(lgLoadRow).join('') || `<div class="panel emptystate"><strong>No loads ${LG_STATE[LG.tab].toLowerCase()}</strong><p>Build one from the dispatch board.</p>${button('Dispatch', "go('logi')", 'secondary')}</div>`}</div>
  ${opsNotes([['The tabs', 'Route states: <code>planned</code>, <code>scheduled</code>, <code>in_transit</code>, <code>delivered</code>, <code>cancelled</code>.'], ['Load codes', 'Shipment codes minted for a plant load (<code>mintShipmentForProductionLoad</code>).']], ['A home delivery listed beside plant loads with its own number.'])}`;
}

/* ---------- Calendar ---------- */
function lgCalendar() {
  const today = lgToday(), days = Array.from({ length: 7 }, (_, i) => lgAddDays(today, LG.week * 7 + i));
  const cell = (iso) => {
    const loads = LG.loads.filter((l) => l.date === iso && l.state !== 'cancelled'), d = new Date(iso + 'T12:00:00');
    const shut = LOTS.filter((l) => !lotDay(l, iso).open);
    return `<div class="lg-day${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}"><div class="lg-dayhead"><strong>${d.toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
      ${loads.map((l) => `<button type="button" class="lg-chip ${l.state}${l.kind === 'home' ? ' home' : ''}" onclick="lgOpen('${l.id}')"><b>${esc(l.id)}</b><span>${esc(lgRig(l.rigId)?.name || 'No trailer')}</span><small>${l.stops.map((x) => (lgStopIsLot(x) ? lgStopLot(x).town : lgStopUnits(x)[0].customer)).map(esc).join(' → ')}</small><em>${LG_STATE[l.state]}</em></button>`).join('') || '<p class="lg-none">Nothing scheduled</p>'}
      <details class="lg-shut"><summary>${shut.length === LOTS.length ? 'Every lot closed' : shut.length ? lgPlural(shut.length, 'lot') + ' closed' : 'Every lot open'}</summary>${shut.length && shut.length < LOTS.length ? `<p>${shut.map((l) => esc(l.town) + (lotDay(l, iso).appt ? ' (appointment)' : '')).join(', ')}</p>` : ''}</details></div>`;
  };
  const idle = LG.rigs.filter((r) => !LG.loads.some((l) => l.rigId === r.id && days.includes(l.date) && l.state !== 'cancelled'));
  return `${head('Logistics', 'The next seven days.', 'Every load on its day, and which lots are closed. A lot that is closed cannot sign for a building.')}
  <div class="lg-weeknav"><button type="button" class="chipbtn" onclick="LG.week--;render()">${icon('back', 16)} Earlier</button><button type="button" class="chipbtn${LG.week ? '' : ' on'}" onclick="LG.week=0;render()">Next 7 days</button><button type="button" class="chipbtn" onclick="LG.week++;render()">Later ${icon('arrow', 16)}</button>
    <strong>${lgDay(days[0])} to ${lgDay(days[6])}</strong></div>
  <div class="lg-week">${days.map(cell).join('')}</div>
  <p class="lede-small" style="margin-top:16px">${idle.length ? `No load in these seven days: ${idle.map((r) => esc(r.name)).join(', ')}.` : 'Every trailer has a load in these seven days.'}</p>
  ${opsNotes([['Loads by day', 'Logistics → Calendar (<code>LogisticsCalendarPanel</code>): week and month grids of routes by delivery date.']], ['Which lots are closed each day (from buybennett.com).', 'Which trailers have no load this week.'])}`;
}

/* ---------- Locations ---------- */
/* A rough map: three state outlines, every lot as a dot, each plant as a square. */
const LG_OUTLINE = {
  SC: [[-83.11, 35], [-82.78, 35.07], [-82.35, 35.2], [-81.04, 35.15], [-81.03, 35.05], [-80.93, 35.11], [-80.78, 34.94], [-80.8, 34.82], [-79.67, 34.8], [-78.55, 33.86], [-79.19, 33.17], [-79.95, 32.61], [-80.67, 32.22], [-80.87, 32.03], [-81.12, 32.11], [-81.28, 32.56], [-81.5, 33.01], [-81.94, 33.36], [-82.25, 33.75], [-82.6, 34.03], [-82.9, 34.48], [-83.34, 34.7]],
  NC: [[-84.32, 35], [-83.11, 35], [-82.78, 35.07], [-82.35, 35.2], [-81.04, 35.15], [-81.03, 35.05], [-80.93, 35.11], [-80.78, 34.94], [-80.8, 34.82], [-79.67, 34.8], [-78.55, 33.86], [-77.96, 33.84], [-77.25, 34.55], [-76.5, 34.72], [-75.53, 35.22], [-75.87, 36.55], [-80.3, 36.55], [-81.68, 36.59], [-81.74, 36.39], [-82.03, 36.12], [-82.6, 36], [-83.26, 35.72], [-84.02, 35.41]],
  GA: [[-85.61, 34.98], [-84.32, 34.99], [-83.11, 35], [-83.34, 34.7], [-82.9, 34.48], [-82.6, 34.03], [-82.25, 33.75], [-81.94, 33.36], [-81.5, 33.01], [-81.28, 32.56], [-81.12, 32.11], [-80.87, 32.03], [-81.13, 31.71], [-81.42, 30.72], [-82.21, 30.57], [-84.86, 30.71], [-85, 31], [-85.14, 32.26], [-85.18, 32.87]],
};
const LG_LABEL = { conover: 'l', statesville: 'tl', mocksville: 't', salisbury: 'r', lexington: 'r', 'forest-city': 'l', 'boiling-springs': 'l', 'west-union': 'r', lancaster: 'r', lugoff: 'r', florence: 'r', conway: 'b', longs: 't', graniteville: 'l', orangeburg: 'l', 'moncks-corner': 'l', 'moncks-corner-2': 'r', cottageville: 'l', ravenel: 'r', statesboro: 'l', vidalia: 'l', brunswick: 'l' };
const lgXY = (p) => [(p.lon + 84.5) * 83.3 + (p.id === 'moncks-corner-2' ? 9 : 0), (36.85 - p.lat) * 100];
function lgMap(load) {
  const sel = LG.place, pts = (list) => list.map(([lon, lat]) => lgXY({ lon, lat }).map((n) => n.toFixed(1)).join(',')).join(' ');
  const count = (lot) => LG.units.filter((u) => u.lotId === lot.id && u.leg && u.at !== 'home').length;
  const spokes = LOTS.map((l) => {
    const [x1, y1] = lgXY(lotPlant(l)), [x2, y2] = lgXY(l);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  const dots = LOTS.map((l) => {
    let [x, y] = lgXY(l);
    if (PLANTS.some((p) => p.lat === l.lat && p.lon === l.lon)) x -= 14; /* a lot at the plant's own address sits beside it */
    const n = count(l), side = LG_LABEL[l.id] || 'r', open = lotDay(l, lgToday()).open;
    const [tx, ty, anchor] = side === 'l' ? [x - 9, y + 3.5, 'end'] : side === 't' ? [x, y - 9, 'middle'] : side === 'tl' ? [x + 3, y - 9, 'end'] : side === 'b' ? [x, y + 16, 'middle'] : [x + 9, y + 3.5, 'start'];
    return `<g class="lg-dot${sel === 'lot:' + l.id ? ' on' : ''}${open ? '' : ' shut'}" onclick="LG.place='lot:${l.id}';render()" role="button" tabindex="0" aria-label="${esc(lotTown(l))}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${n ? 7.5 : 5}"/>${n ? `<text class="n" x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" text-anchor="middle">${n}</text>` : ''}<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}">${esc(l.town)}</text></g>`;
  }).join('');
  const plants = PLANTS.map((p) => {
    const [x, y] = lgXY(p);
    return `<g class="lg-plant${sel === 'plant:' + p.id ? ' on' : ''}" onclick="LG.place='plant:${p.id}';render()" role="button" tabindex="0" aria-label="${esc(p.name)}"><rect x="${(x - 8).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="16" height="16" rx="3"/></g>`;
  }).join('');
  return `<svg class="lg-map" viewBox="0 0 600 645" role="img" aria-label="Map of the plant and the ${LOTS.length} lots in South Carolina, North Carolina and Georgia">
    ${Object.entries(LG_OUTLINE).map(([st, list]) => `<polygon class="lg-state" points="${pts(list)}"/>`).join('')}
    <text class="lg-statename" x="150" y="555">Georgia</text><text class="lg-statename" x="480" y="150">North Carolina</text><text class="lg-statename" x="236" y="266">South Carolina</text>
    <g class="lg-spokes">${spokes}</g>${dots}${plants}</svg>
    <p class="lg-legend"><span><i class="sq"></i> Plant</span><span><i></i> Lot</span><span><i class="num">2</i> Buildings headed there</span><span><i class="shut"></i> Closed today</span></p>`;
}
function lgPlaceCard() {
  const [type, id] = (LG.place || 'plant:' + PLANTS[0].id).split(':');
  if (type === 'plant') {
    const p = plantById(id), served = LOTS.filter((l) => lotPlant(l).id === p.id), yard = LG.units.filter((u) => u.plantId === p.id && u.at === 'plant' && u.leg);
    return `<section class="panel"><div class="panelhead"><h2>${esc(p.name)}</h2><span class="pill blue">Plant</span></div>
      <p>${esc(placeAddress(p))}</p>
      <div class="qc-facts"><span>Builds for <strong>${lgPlural(served.length, 'lot')}</strong></span><span>In the yard, ready <strong>${lgPlural(yard.length, 'building')}</strong></span><span>Farthest lot <strong>${served.length ? 'about ' + Math.max(...served.map((l) => milesBetween(p, l))) + ' mi' : 'none'}</strong></span></div>
      <div class="actions"><a class="secondary small" target="_blank" rel="noopener" href="${lgMapLink(placeAddress(p))}">${icon('pin', 16)} Directions</a>${button('Dispatch board', "go('logi')", 'secondary small')}</div>
      ${p.added ? '<p class="source">Added in this preview. Its spot on the map is near the lot you chose.</p>' : ''}</section>`;
  }
  const l = lotById(id), p = lotPlant(l), today = lotDay(l, lgToday()), units = LG.units.filter((u) => u.lotId === l.id && u.leg);
  const coming = units.filter((u) => u.at !== 'lot'), here = units.filter((u) => u.at === 'lot');
  return `<section class="panel"><div class="panelhead"><h2>${esc(dealerName(l))}</h2><span class="pill ${today.open ? 'good' : 'red'}">${today.open ? 'Open today' : today.appt ? 'Appointment only today' : 'Closed today'}</span></div>
    <p>${esc(placeAddress(l))}${l.note ? ' · ' + esc(l.note) : ''}<br><a href="tel:${l.phone.replace(/\D/g, '')}">${esc(l.phone)}</a></p>
    <p class="lg-hours">${esc(lotWeek(l))}</p>
    <div class="qc-facts"><span>About <strong>${milesBetween(p, l)} mi</strong> from the ${esc(p.town)} plant</span><span>Headed here <strong>${lgPlural(coming.length, 'building')}</strong></span><span>Here, for home delivery <strong>${here.length}</strong></span></div>
    ${PLANTS.length > 1 ? `<label class="ops-select">Built at<select onchange="lgServe('${l.id}',this.value)">${PLANTS.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}, ${esc(x.town)} · about ${milesBetween(x, l)} mi</option>`).join('')}</select></label>` : ''}
    ${units.length ? `<ul class="lg-stopunits">${units.map((u) => `<li><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} <span class="serial">${esc(u.id)}</span> <span class="ops-flag">${u.at === 'lot' ? 'at the lot' : u.at === 'road' ? 'on the road' : lgOnLoad(u) ? 'on ' + lgLoadName(lgOnLoad(u)).toLowerCase() : 'at the plant'}</span></li>`).join('')}</ul>` : ''}
    <div class="actions"><a class="secondary small" target="_blank" rel="noopener" href="${lgMapLink(placeAddress(l))}">${icon('pin', 16)} Directions</a></div></section>`;
}
function lgPlaces() {
  const byState = ['SC', 'NC', 'GA'].map((st) => [st, LOTS.filter((l) => l.state === st).sort((a, b) => milesBetween(lotPlant(a), a) - milesBetween(lotPlant(b), b))]);
  return `${head('Logistics', `${PLANTS.length === 1 ? 'One plant' : PLANTS.length + ' plants'}, ${LOTS.length} lots.`, 'Every Bennett lot, how far it is from the plant that builds for it, and when it is open to receive a building.')}
  <div class="grid2 lg-places"><section class="panel">${lgMap()}</section><div class="stack">${lgPlaceCard()}
    <section class="panel"><div class="panelhead"><h2>Plants</h2>${button(icon('plus', 16) + ' Add a plant', 'lgPlantForm()', 'secondary small')}</div>
      ${PLANTS.map((p) => `<button type="button" class="listrow" onclick="LG.place='plant:${p.id}';render()"><span class="grow"><strong>${esc(p.name)} · ${esc(p.town)}, ${esc(p.state)}</strong><small>${esc(placeAddress(p))} · builds for ${lgPlural(LOTS.filter((l) => lotPlant(l).id === p.id).length, 'lot')}</small></span><span class="rowarrow">${icon('arrow', 18)}</span></button>`).join('')}</section></div></div>
  ${byState.map(([st, list]) => `<h2 class="sectionhead qc-group">${STATE_NAME[st]} <small>${lgPlural(list.length, 'lot')}</small></h2><div class="lg-lots">${list.map((l) => {
    const d = lotDay(l, lgToday()), n = LG.units.filter((u) => u.lotId === l.id && u.leg).length;
    return `<button type="button" class="lg-lot${LG.place === 'lot:' + l.id ? ' on' : ''}" onclick="LG.place='lot:${l.id}';render();scrollTo(0,0)"><strong>${esc(l.town)}</strong><small>${esc(l.street)} · ${esc(l.phone)}</small><span class="ops-flags"><span class="ops-flag">about ${milesBetween(lotPlant(l), l)} mi</span><span class="ops-flag ${d.open ? 'ok' : 'bad'}">${d.open ? 'Open today' : d.appt ? 'Appointment today' : 'Closed today'}</span>${n ? `<span class="ops-flag wait">${lgPlural(n, 'building')} to move</span>` : ''}</span></button>`;
  }).join('')}</div>`).join('')}
  <p class="lede-small" style="margin-top:20px">Addresses, phone numbers and open days are from the lot pages on buybennett.com. Miles are rough, measured from town to town.</p>
  ${opsNotes([['Which plant builds for a lot', '<code>resolveDealerPlant</code>: the lot’s own setting, then its dealer, then the organisation’s default plant.'], ['Miles', '<code>computeOrgRouteMileage</code> uses real road miles.'], ['A map', 'Logistics → Map (<code>LogisticsMapPanel</code>) shows a route’s stops on Google Maps with directions.']], ['This sketch map of every lot and plant, with the buildings headed to each.', 'Adding a plant on this screen.', 'Lot open days. Turbo Assist’s location list is out of date against the website: it still has Newberry, Greenwood, Goldsboro and Wilson, and lacks Moncks Corner II, Statesville, Salisbury and Mocksville.'])}`;
}

/* ---------- Trailers and haulers ---------- */
function lgFleet() {
  const today = lgToday();
  const card = (r) => {
    const now = LG.loads.find((l) => l.rigId === r.id && (l.state === 'in_transit' || (l.state === 'scheduled' && l.date === today))), next = LG.loads.filter((l) => l.rigId === r.id && l.state === 'scheduled' && l.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `<section class="panel lg-rig"><div class="panelhead"><h2>${esc(r.name)}</h2><span class="pill ${lgCarrier(r.carrierId)?.kind === 'in_house' ? 'blue' : ''}">${esc(lgCarrier(r.carrierId)?.name || '')}</span></div>
      <div class="lg-rigfeet"><b>${r.feet || '—'}</b><span>${r.feet ? 'ft trailer' : 'no length on file'}</span></div>
      <div class="ops-flags"><span class="ops-flag ${r.haul ? 'ok' : ''}">${r.haul ? icon('check', 14) : ''} Plant hauls${r.haul ? '' : ': no'}</span><span class="ops-flag ${r.home ? 'ok' : ''}">${r.home ? icon('check', 14) : ''} Home deliveries${r.home ? '' : ': no'}</span></div>
      <p class="ops-rowsub">Usual driver: ${esc(r.driver || 'not set')}</p>
      <p class="ops-rowsub">${now ? `Today: <button type="button" class="link inline" onclick="lgOpen('${now.id}')">${lgLoadName(now)}</button> · ${LG_STATE[now.state].toLowerCase()}` : next ? `Next: <button type="button" class="link inline" onclick="lgOpen('${next.id}')">${lgLoadName(next)}</button> · ${lgDay(next.date)}` : 'Nothing scheduled'}</p>
      <div class="actions">${button('Change', `lgRigForm('${r.id}')`, 'secondary small')}</div></section>`;
  };
  return `${head('Logistics', 'Trailers and haulers.', 'Each trailer has its own length. A load is checked against the trailer it rides on.')}
  <div class="cards lg-rigs">${LG.rigs.map(card).join('')}<button type="button" class="lg-addrig" onclick="lgRigForm('')">${icon('plus', 22)}<strong>Add a trailer</strong></button></div>
  <div class="grid2" style="margin-top:20px">
    <section class="panel"><div class="panelhead"><h2>Who hauls</h2>${button(icon('plus', 16) + ' Add a hauler', 'lgCarrierForm()', 'secondary small')}</div>
      ${LG.carriers.map((c) => `<div class="od-doc"><div class="grow"><strong>${esc(c.name)}</strong><small>${{ in_house: 'Company drivers', contracted: 'Outside hauler, contracted', freelance: 'Outside hauler, freelance' }[c.kind] || esc(c.kind)} · ${esc(c.covers)} · ${lgPlural(LG.rigs.filter((r) => r.carrierId === c.id).length, 'trailer')}</small></div></div>`).join('')}
      <p class="source">Drivers and haulers here are made up.</p></section>
    <section class="panel"><h2>Rules</h2>
      <div class="of-inline"><label>Flag a building as a wide load at (ft wide)<input type="number" min="8" max="20" step="1" value="${LG.set.wideFt}" onchange="LG.set.wideFt=Math.max(8,Number(this.value)||14);render()" inputmode="numeric"></label></div>
      <p class="source">A flagged load asks the dispatcher to confirm the permit before it can be scheduled without a warning.</p>
      <h3>Home deliveries</h3><p class="of-soft">${OF.set.driverPay ? 'Drivers may take the final payment at delivery.' : 'A cash building is paid in full before it goes to a home.'} The office sets this (Office → Settings).</p></section>
  </div>
  ${opsNotes([['Trailers', 'Rigs (<code>logi_carrier_rigs</code>): <code>capacity_value</code> in linear feet, <code>supports_plant_haul</code>, <code>supports_home_delivery</code>, <code>standard_driver_name</code>.'], ['Who hauls', 'Carriers (<code>logi_carriers</code>): contracted, freelance, dealer’s own, in house, with coverage areas.']], ['A wide-load width that flags a load. Turbo Logistics has a manual “permit required” tick only.'])}`;
}

/* ---------- Driver's day ---------- */
function lgDrive() {
  const busy = LG.rigs.filter((r) => LG.loads.some((l) => l.rigId === r.id && ['scheduled', 'in_transit'].includes(l.state)));
  const rig = lgRig(LG.rig) && busy.includes(lgRig(LG.rig)) ? lgRig(LG.rig) : busy.find((r) => LG.loads.some((l) => l.rigId === r.id && l.state === 'in_transit')) || busy[0];
  const loads = rig ? LG.loads.filter((l) => l.rigId === rig.id && ['scheduled', 'in_transit'].includes(l.state)).sort((a, b) => (a.state === 'in_transit' ? -1 : 0) - (b.state === 'in_transit' ? -1 : 0) || a.date.localeCompare(b.date)) : [];
  const one = (load) => {
    const units = lgLoadUnits(load);
    return `<section class="panel lg-run"><div class="panelhead"><h2>${lgLoadName(load)}</h2><span class="pill ${LG_STATE_PILL[load.state]}">${load.state === 'scheduled' ? lgDay(load.date) : LG_STATE[load.state]}</span></div>
      <p class="ops-rowsub">From ${esc(lgOriginName(load))} · ${lgPlural(units.length, 'building')} · ${lgFeet(load)} ft · about ${lgMiles(load).total} mi${load.window !== 'Date only' ? ' · ' + esc((load.windowNote || load.window).toLowerCase()) : ''}</p>
      ${lgTrailer(load)}
      ${load.state === 'scheduled' ? `<div class="actions">${button('Start the run', `lgStart('${load.id}')`, 'primary big')}${button('Load details', `lgOpen('${load.id}')`, 'secondary')}</div>` : ''}
      ${load.stops.map((_, i) => lgStopCard(load, i, true)).join('')}</section>`;
  };
  return `${head('Logistics · driver', 'Driver’s day.', 'What one driver sees on a phone: the load, each stop in order, and one button at a time.')}
  ${busy.length ? `<div class="chiprow ops-tabs">${busy.map((r) => `<button type="button" class="chipbtn${rig === r ? ' on' : ''}" onclick="LG.rig='${r.id}';render()">${esc(r.name)}${r.driver && r.driver !== r.name ? ' · ' + esc(r.driver) : ''}</button>`).join('')}</div>` : ''}
  ${loads.map(one).join('') || `<div class="panel emptystate"><strong>No runs scheduled</strong><p>A load shows here once it is scheduled with a trailer.</p>${button('Dispatch', "go('logi')", 'secondary')}</div>`}
  ${opsNotes([
    ['This screen', 'The driver app (<code>DriverAppShell</code>, “Today’s stops”): each route and its stops, with Maps, Call and the FastField form for the stop.'],
    ['Arrived', 'The Arrived and Departed stamps on a stop (<code>stampDriverStop</code>). It works offline and syncs.'],
    ['Unload here · Deliver here', 'The stop’s FastField form: photo, GPS and signature. Turbo Ops owns the form; the submission marks the delivery paperwork received.'],
  ], ['Signing on this screen instead of in FastField.', 'The lot signing for inventory it receives.', 'The driver taking the final payment before the customer signs.', 'The trailer drawing with the loading order.'])}`;
}

function lgNotesPage() {
  return `<button class="link backlink" onclick="go('logi')">${icon('back', 18)} Dispatch</button>
  ${head('Logistics', 'What is real and what is not.', 'This side is a working picture of dispatch. It shows the steps and the rules; it keeps nothing.')}
  <div class="grid2">
    <section class="panel"><h2>Matches Turbo Logistics</h2><ul>
      <li>A building becomes routable once it is built and marked ready to deliver.</li>
      <li>A plant load is a shipment with a code; each building on it is a route with its own stops.</li>
      <li>Stops are the plant, the lot, and the customer. Lot drops come off first and the customer’s building last.</li>
      <li>A rig has a capacity in feet and two flags: plant hauls and home deliveries.</li>
      <li>A route goes planned, scheduled, in transit, delivered. It can be cancelled before it is delivered.</li>
      <li>When a delivery is scheduled, the salesperson is told to pass the day to the customer. No text goes to the customer.</li>
      <li>Turbo Logistics already has a dispatch board, a calendar, a map of a route’s stops and a driver app with Arrived and Departed stamps. Proof of delivery is a FastField form.</li>
    </ul></section>
    <section class="panel"><h2>Only in this preview</h2><ul>
      <li>Adding every building’s length against the trailer, and stopping a load that is too long.</li>
      <li>Warnings for a closed lot, a wide load, a state line, a tight gate or a slope.</li>
      <li>Through the lot or plant to home as a choice on the building.</li>
      <li>Holding a home delivery until the payment rule is met, and the driver taking payment.</li>
      <li>Site questions asked at the sale and confirmed by Logistics before scheduling; Logistics approving the fee past ${OF.set.overTo} miles.</li>
      <li>The lot signing for buildings; the customer signing on the driver’s screen instead of in FastField.</li>
      <li>Lot open days on the calendar, the sketch map of every lot, and adding a plant.</li>
    </ul></section>
    <section class="panel"><h2>Sample data</h2><ul>
      <li>Trailers, drivers, haulers, buildings and loads are made up. So is every customer.</li>
      <li>The ${LOTS.length} lots, their addresses and open days are from buybennett.com. The plant is at ${esc(placeAddress(PLANTS[0]))}.</li>
      <li>Miles are rough, measured town to town.</li>
    </ul></section>
    <section class="panel"><h2>Not built</h2><ul>
      <li>Real maps, road miles and drive times.</li>
      <li>Texts or emails to anyone.</li>
      <li>Permits and escorts beyond a tick box.</li>
      <li>Saving. Reloading the page starts over.</li>
    </ul></section>
  </div>`;
}

const LOGI_SCREENS = { logi: lgBoard, 'lg-load': lgLoadPage, 'lg-loads': lgLoads, 'lg-cal': lgCalendar, 'lg-places': lgPlaces, 'lg-fleet': lgFleet, 'lg-drive': lgDrive, 'lg-notes': lgNotesPage };
