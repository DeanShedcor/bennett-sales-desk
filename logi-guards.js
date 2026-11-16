/* logi-guards.js: Logistics, first batch from the review.

   What changes on the screen:
   1. A load with warnings says "3 warnings" in its bar, and scheduling it needs a typed reason.
      Nothing is a hard stop (the owner's choice); the reason is kept in the load's history.
   2. (in drive.js) Drive time leaves early enough to reach the customer when promised.
   3. "Start the run" always asks first, and says so when the load is set for another day.
      A load that is on the road can be cancelled with a reason.
   4. Miles read the same everywhere: "193 mi out · 376 round trip". A trailer's day is the round trip.
   5. (in the screens) The wording that still called the miles rough is corrected.
   6. The load's record panel and its checks use plain words. Turbo Logistics' own wording shows
      only with builder notes on.
   7. One word for each thing: Planned, On the road, trailer, Locations, Driver's day.
      "Load" is a truck leaving the plant with buildings for the lots. "Delivery" is a building going
      to a customer's home. "Run" is kept only for the driver's button, "Start the run".
   8. Taking a building off a load is a full-size "Take off" button with a 10-second Undo.
   9. Drive time sits right under the stops, and "Add buildings" folds away when the trailer is full.
   10. Driver's day has a Call button, is in the computer menu, and a driver sees only their own day.

   Turbo Logistics functions these sit on are named beside each part. Older checks that read Turbo's
   own words switch the plain words off with PP.raw, and the ask-first steps off with OG.live.
   Loaded after drive.js. */

const LGG = { undo: null };
const lggRaw = () => typeof PP !== 'undefined' && PP.raw;
const lggAsks = () => !(typeof OG !== 'undefined' && OG.live);
const lggCut = (html, from, to) => {
  const a = html.indexOf(from), b = a < 0 ? -1 : html.indexOf(to, a);
  return b < 0 ? null : [a, b + to.length];
};

/* ---------- 7. One word for each thing ---------- */
LG_STATE.planned = 'Planned';
if (typeof LGX_STATE === 'object') LGX_STATE.in_transit = 'On the road';
for (const r of LG.rigs) r.name = r.name.replace(/^Rig (\d+)$/, 'Trailer $1');
for (const l of LG.loads) for (const e of l.log) e.text = e.text.replace(/\bRig (\d+)\b/g, 'Trailer $1');
if (typeof PP_WORDS === 'object') PP_WORDS.push([/\bRig (\d+)\b/g, 'Trailer $1'], [/\bin transit\b/g, 'on the road'], [/\bIn transit\b/g, 'On the road'], [/\bBeing planned\b/g, 'Planned']);

/* ---------- 4. Same miles everywhere ----------
   Out is the miles to the last stop. Round trip adds the drive back. Both come from the drive-time plan,
   so every screen agrees. Turbo Logistics: computeOrgRouteMileage (to the last stop only). */
function lggMiles(load) {
  if (!load.stops.length) return null;
  const p = dtPlan(load);
  return { out: Math.round(p.out), round: Math.round(p.miles), text: `${Math.round(p.out)} mi out · ${Math.round(p.miles)} round trip` };
}
/* One trailer's day counts each load there and back. */
lgxRigDay = function (rigId, iso) {
  const loads = LG.loads.filter((l) => l.rigId === rigId && l.date === iso && l.state !== 'cancelled' && l.stops.length);
  let total = 0, skipped = 0;
  for (const l of loads) {
    if (lgxMiles(l).miles == null) skipped++;
    else total += lggMiles(l).round;
  }
  const today = iso === lgToday(), word = today ? 'Today' : lgDay(iso);
  const text = !loads.length ? '' : skipped === loads.length ? `${word}: miles not known yet` : `${word}${today ? '' : ':'} ${total} mi round trip${skipped ? ` · ${skipped} not measured` : ''}`;
  return { loads, total, skipped, text };
};

/* ---------- 6. Checks in plain words ---------- */
const LGG_CHECK_WORDS = [
  [/^Rig is not flagged for plant-haul capability\.$/, 'This trailer is for home deliveries only. It is not set up for plant loads.'],
  [/^Rig is not flagged for home-delivery capability\.$/, 'This trailer is for plant loads only. It is not set up for home deliveries.'],
  [/^Rig has no capacity on file — verify load fit manually\.$/, 'This trailer has no length saved. Check by hand that the buildings fit.'],
  [/^Unit needs ~(\d+) linear feet; rig capacity is (\d+)\.$/, 'One building is $1 ft long. The trailer is only $2 ft.'],
  [/^Rig already has (\d+) other route\(s\) on this delivery date\.$/, (m, n) => `This trailer already has ${n} other ${n === '1' ? 'load' : 'loads'} that day.`],
  [/ is marked inactive\. Turbo Logistics leaves an inactive carrier out of the picker\.$/, ' is turned off. Pick another hauler.'],
  [/^Permit required is flagged: confirm the permit, then tick “Permit confirmed”\.$/, 'This load needs a permit. Get the permit, then tick “Permit confirmed”.'],
  [/^Too long: (\d+) ft of buildings on a (\d+) ft trailer\. Take one off, pick a longer trailer, or override with a reason\.$/, 'Too long: $1 ft of buildings on a $2 ft trailer. Take one off or pick a longer trailer.'],
  [/^This run crosses state lines: /, 'This trip crosses state lines: '],
];
{
  const base = lgChecks;
  lgChecks = function (load) {
    const out = base(load);
    if (lggRaw()) return out;
    for (const c of out) {
      for (const [re, to] of LGG_CHECK_WORDS) if (re.test(c.text)) { c.text = c.text.replace(re, to); break; }
      /* 1. Too long is a warning like the others now: the reason is typed when the load is scheduled. */
      if (c.key === 'over') c.level = 'warn';
    }
    return out;
  };
}

/* ---------- 1. Warnings need a typed reason ----------
   Turbo Logistics warns and lets the coordinator go on (buildRigAssignmentWarnings). Asking for a
   reason and keeping it in the history is a feature the product still has to accept. */
const lggWarns = (load) => lgChecks(load).filter((c) => c.level === 'warn');
const lggSig = (list) => list.map((c) => c.text).join('|');
const lggReasonOk = (load, warns = lggWarns(load)) => !warns.length || (load.why && load.why.sig === lggSig(warns));
function lggWhyForm(id) {
  const load = lgLoad(id), warns = lggWarns(load);
  modal(`Schedule with ${lgPlural(warns.length, 'warning')}?`, `<p><strong>${lgLoadName(load)}</strong> has ${warns.length === 1 ? 'a warning' : 'warnings'}:</p>
    <ul class="lgg-warnlist">${warns.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>
    <label class="field">Why is it OK to schedule it anyway?<input id="lgg-why" maxlength="160" placeholder="Example: two drivers will share the driving"></label>
    <p class="source">Your reason is saved in this load’s history. If the load changes, you will be asked again.</p>
    <div class="actions">${button('Go back', 'closeModal()', 'secondary')}${button('Schedule it', `lggWhySave('${id}')`)}</div>`);
  document.getElementById('lgg-why')?.focus();
}
function lggWhySave(id) {
  const load = lgLoad(id), warns = lggWarns(load), reason = $('#lgg-why').value.trim();
  if (reason.length < 3) return toast('Type a reason first.');
  load.why = { reason, at: Date.now(), sig: lggSig(warns) };
  lgNote(load, `Scheduled with ${lgPlural(warns.length, 'warning')} (${warns.map((c) => c.text).join(' ')}) Reason: ${reason}`);
  closeModal();
  lgSchedule(id);
}
{
  const base = lgSchedule;
  lgSchedule = function (id) {
    const load = lgLoad(id);
    if (load && load.state === 'planned' && !lggRaw() && lggAsks() && !lgBlocked(load).length && !lggReasonOk(load)) return lggWhyForm(id);
    return base(id);
  };
}

/* ---------- 3. Start the run asks first; a load on the road can be cancelled ----------
   Turbo Logistics: transitionOrgRouteState (scheduled → in transit, in transit → cancelled). */
function lggStartForm(id) {
  const load = lgLoad(id), today = lgToday(), other = load.date && load.date !== today;
  const long = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const homes = lgLoadUnits(load).filter((u) => u.leg !== 'plant-lot');
  modal(other ? `This is set for ${new Date(load.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}. Start it now?` : 'Start this run now?', `
    ${other ? `<p class="notice">${icon('alert', 16)} ${lgLoadName(load)} is set for <b>${long(load.date)}</b>. Today is ${long(today)}.</p>` : ''}
    <p><strong>${lgLoadName(load)}</strong> · ${esc(lgRig(load.rigId)?.name || '')}${load.driver ? ' · ' + esc(load.driver) : ''} · ${lgPlural(lgLoadUnits(load).length, 'building')}, leaving ${esc(lgOriginName(load))}.</p>
    <p>Starting means the truck is leaving now. ${homes.length ? 'The salesperson is told the truck is on the way' + (homes.some((u) => u.msgAuto) ? ', and the customer gets a message.' : '.') : 'The lots are waiting for it.'} You cannot put it back to “Scheduled” after this.</p>
    <div class="actions">${button('Not yet', 'closeModal()', 'secondary')}${button('Start the run', `closeModal();lgStart('${id}',true)`)}</div>`);
}
{
  const base = lgStart;
  lgStart = function (id, sure) {
    const load = lgLoad(id);
    if (load && load.state === 'scheduled' && !sure && lggAsks()) return lggStartForm(id);
    return base(id);
  };
}
function lggRoadCancelForm(id) {
  const load = lgLoad(id), left = load.stops.filter((x) => !x.done).flatMap(lgStopUnits), done = load.stops.filter((x) => x.done).length;
  modal(`Cancel ${lgLoadName(load)} on the road?`, `<p>The truck has left. ${done ? `${lgPlural(done, 'stop')} already done will stay done. ` : ''}The ${lgPlural(left.length, 'building')} still on the trailer ${left.length === 1 ? 'goes' : 'go'} back to ${esc(lgOriginName(load))}, ready for another load.</p>
    <label class="field">Why is it being cancelled?<input id="lgg-cancel-why" maxlength="160" placeholder="Example: the truck broke down"></label>
    <div class="actions">${button('Keep it going', 'closeModal()', 'secondary')}${button(load.kind === 'haul' ? 'Cancel this load' : 'Cancel this delivery', `lggRoadCancel('${id}')`)}</div>`);
  document.getElementById('lgg-cancel-why')?.focus();
}
function lggRoadCancel(id) {
  const load = lgLoad(id), reason = $('#lgg-cancel-why').value.trim();
  if (!load || load.state !== 'in_transit') return closeModal();
  if (reason.length < 3) return toast('Type a reason first.');
  for (const stop of load.stops.filter((x) => !x.done))
    for (const u of lgStopUnits(stop)) {
      u.loadId = null;
      u.at = load.from.type === 'plant' ? 'plant' : 'lot';
      const s = lgSale(u);
      if (s && u.leg !== 'plant-lot') (s.deliverOn = null), ofLog(s, `Logistics cancelled the delivery on the road: ${reason} · a new day will follow`);
    }
  load.state = 'cancelled';
  lgNote(load, `Cancelled on the road: ${reason}`);
  closeModal();
  go(LG.back);
  toast('Cancelled. The buildings are back on the board.');
}

/* ---------- 8. Take off, with Undo ----------
   Turbo Logistics: splitUnitFromShipment. The 10-second Undo is a feature the product still has to accept. */
function lggTake(loadId, unitId) {
  const load = lgLoad(loadId), u = lgUnit(unitId);
  if (!load || !u) return;
  const keep = { stops: JSON.parse(JSON.stringify(load.stops)), over: load.over, why: load.why, loadId: u.loadId, log: load.log.length };
  lgRemove(loadId, unitId);
  lgNote(load, `${u.name} taken off`);
  const back = () => {
    load.stops = keep.stops;
    load.over = keep.over;
    load.why = keep.why;
    u.loadId = keep.loadId;
    load.log.length = keep.log;
    render();
    toast(`${u.name} is back on ${lgLoadName(load)}.`);
  };
  if (typeof pgUndoBar === 'function' && lggAsks()) pgUndoBar(`${u.wid} × ${u.len} taken off ${lgLoadName(load)}`, back);
  render();
}

/* ---------- Rows and cards ---------- */
{
  const baseRow = lgLoadRow;
  lgLoadRow = function (load) {
    let html = baseRow(load);
    const m = lggMiles(load);
    if (m) html = html.replace(/<span class="ops-flag">about [\d.]+ mi<\/span>/, `<span class="ops-flag">${m.text}</span>`);
    if (!lggRaw() && load.state === 'planned') {
      const warns = lggWarns(load);
      if (warns.length) html = html.replace('<span class="ops-flag ok">Ready to schedule</span>', `<span class="ops-flag todo">${lgPlural(warns.length, 'warning')}</span>`);
    }
    return html;
  };
  const baseStop = lgStopCard;
  lgStopCard = function (load, i, big) {
    let html = baseStop(load, i, big);
    if (lggRaw()) return html;
    /* 6. The stop's line in plain words: when the truck got there and left. Turbo's stop kind and form name show with builder notes on. */
    if (!S.sfNotes) html = html.replace(/<small class="lgx-kind">[^<]*?(?:arrived ([^,<]*), departed ([^·<]*) · proof on file|proof here: the FastField delivery form)<\/small>/, (m, a, d) => (a ? `<small class="lgx-kind">Got there ${a} · left ${d.trim()}</small>` : ''));
    /* 8. A full-size button in place of the small × */
    html = html.replace(/ <button type="button" class="of-x" aria-label="Take ([^"]*) off this load" onclick="lgRemove\('([^']*)','([^']*)'\)">×<\/button>/g, ' <button type="button" class="secondary small lgg-take" aria-label="Take $1 off this load" onclick="lggTake(\'$2\',\'$3\')">Take off</button>');
    /* 10. Call, beside Directions */
    const stop = load.stops[i], isLot = lgStopIsLot(stop), s = isLot ? null : lgSale(lgStopUnits(stop)[0]);
    const phone = isLot ? lgStopLot(stop).phone : s ? orderInvoice(s).shipTo.phone : '';
    if (phone && big && !html.includes('href="tel:')) {
      const call = `<a class="chipbtn lgg-call" href="tel:${String(phone).replace(/\D/g, '')}">${icon('phone', 14)} Call</a>`, at = html.lastIndexOf('</a>');
      html = at < 0 ? html : html.slice(0, at + 4) + call + html.slice(at + 4);
    }
    return html;
  };
}

/* ---------- 6. The load's record panel, in plain words ----------
   Turbo Logistics' own record (route state, stop kinds, the time's sort order) shows with builder notes on. */
{
  const system = lgxLoadPanel;
  lgxLoadPanel = function (load) {
    if (lggRaw()) return system(load);
    const id = load.id, open = lgxEditable(load), units = lgLoadUnits(load), rig = lgRig(load.rigId), car = rig && lgCarrier(rig.carrierId), wide = units.some(lgWide);
    const m = lgxMiles(load), mi = lggMiles(load), day = rig && load.date ? lgxRigDay(rig.id, load.date) : null, splits = LG.loads.filter((l) => l.splitFrom === id);
    const homes = load.stops.some((x) => !lgStopIsLot(x));
    const permit = `<h3>Permit</h3><div class="lgx-permit">${load.permitReq ? '<span class="lgx-badge">Needs a permit</span>' : ''}${open ? `<button type="button" class="secondary small" onclick="lgxPermit('${id}',${!load.permitReq})">${load.permitReq ? 'This load does not need a permit' : 'This load needs a permit'}</button>` : ''}${!load.permitReq && !open ? '<span class="of-soft">No permit needed.</span>' : ''}</div>
      ${load.permitReq ? `<label class="field">Permit notes<input maxlength="100" ${open ? '' : 'disabled'} value="${esc(load.permitNotes || '')}" placeholder="Example: SC oversize permit, escort from the state line" onchange="lgxPermitNotes('${id}',this.value)"></label>` : ''}
      ${load.permitReq && !wide ? `<label class="checkrow lg-permit"><input type="checkbox" ${load.permit ? 'checked' : ''} ${open ? '' : 'disabled'} onchange="lgSet('${id}','permit',this.checked)"> Permit confirmed</label>` : ''}
      <p class="source">${wide ? `A building ${LG.set.wideFt} ft wide or wider needs a permit to go on the road. ` : ''}The permit notes print on the manifest. ${lgxTip('size-limits', '14 ft wide and permits')}</p>`;
    const miles = `<h3>Miles</h3><p>${m.miles == null || !mi ? 'Miles are not known yet. Add the stops and the delivery answers first.' : `<span class="lgx-pill">${mi.text}</span>`}${day?.text ? ` ${esc(rig.name)}: <b>${esc(day.text)}</b>${day.loads.length > 1 ? ` on ${day.loads.length} loads` : ''}.` : ''}</p>
      <p class="source">Miles between the plant and the lots are road miles, saved in the app.${homes ? ' The last miles to a customer’s home are an estimate, from the miles on the delivery answers.' : ''}</p>`;
    const carrier = car ? `<h3>Who hauls it</h3><p><b>${esc(car.name)}</b> · ${LGX_CARRIER_KIND[car.kind] || esc(car.kind)}${LGX_CARRIER_MEANS[car.kind] ? ', ' + LGX_CARRIER_MEANS[car.kind] : ''}${car.areas?.length ? ` · covers ${esc(car.areas.join(', '))}` : ''}</p>${lgxCarrierDates(car)}` : '';
    /* Each building's QC line once: the serial is not printed a second time inside its own sentence. */
    const quality = units.map((u) => {
      const r = typeof taSerialStatus === 'function' ? taSerialStatus(u.id) : null;
      if (!r || !r.found) return '';
      const text = r.text.replace(u.id, '').replace(/\s*Pipeline: [^.]*\./, '').replace(/^[\s:·,.-]+/, '').replace(/\s{2,}/g, ' ').trim();
      return `<li><span class="serial">${esc(u.id)}</span> ${esc(text.charAt(0).toUpperCase() + text.slice(1))}</li>`;
    }).join('');
    const notes = S.sfNotes ? `<details class="lgg-system" open><summary>How Turbo Logistics records this load</summary>${system(load).replace(/^<section class="panel lgx-record">/, '<div class="lgg-systembody">').replace(/<\/section>$/, '</div>')}</details>` : '';
    return `<section class="panel lgx-record"><div class="panelhead"><h2>Manifest, permit and miles</h2></div>
      <div class="actions lgx-acts">${units.length ? `<button type="button" class="secondary small" onclick="lgxManifest('${id}')">${icon('receipt', 16)} Manifest</button>` : ''}${lgxCanSplit(load) ? `<button type="button" class="secondary small" onclick="lgxSplitForm('${id}')">${icon('rotate', 16)} Move some buildings to a new load</button>` : ''}</div>
      ${load.splitFrom ? `<p>Split from <button type="button" class="link inline" onclick="lgOpen('${esc(load.splitFrom)}')">load ${esc(load.splitFrom)}</button>${load.splitReason ? ': ' + esc(load.splitReason) : ''}.</p>` : ''}
      ${splits.length ? `<p>Split off from this load: ${splits.map((l) => `<button type="button" class="link inline" onclick="lgOpen('${esc(l.id)}')">${esc(l.id)}</button>`).join(', ')}.</p>` : ''}
      ${permit}${miles}${carrier}
      ${quality ? `<h3>Plant QC</h3><ul class="lgx-qc">${quality}</ul>` : ''}
      ${lgxRules()}${notes}</section>`;
  };
}

/* ---------- The load page: the bar, where things sit ---------- */
{
  const page = OPS_SCREENS['lg-load'];
  OPS_SCREENS['lg-load'] = function () {
    let html = page();
    const load = lgLoad(LG.loadId);
    if (!load) return html;
    const id = load.id, mi = lggMiles(load);
    /* 4. The same miles in the heading and over the stops */
    if (mi) html = html.replace(/ · about [\d.]+ miles to the last stop/, ` · ${mi.text}`).replace(/<span class="od-tag">about [\d.]+ mi to the last stop<\/span>/, `<span class="od-tag">${mi.text}</span>`);
    /* 9. Drive time right under the stops */
    const dt = lggCut(html, '<section class="panel dt-panel">', '</section>');
    if (dt) {
      const panel = html.slice(dt[0], dt[1]);
      html = html.slice(0, dt[0]) + html.slice(dt[1]);
      const stops = lggCut(html, '<section class="panel"><div class="panelhead"><h2>Stops, in drop order</h2>', '</section>');
      html = stops ? html.slice(0, stops[1]) + panel + html.slice(stops[1]) : html;
    }
    if (lggRaw()) return html;
    /* 9. "Add buildings" folds away when the trailer is full */
    const rig = lgRig(load.rigId), free = rig?.feet ? rig.feet - lgFeet(load) : null;
    const add = lggCut(html, '<section class="panel"><div class="panelhead"><h2>Add buildings</h2>', '</section>');
    if (add && free != null && free <= 0) {
      const inner = html.slice(add[0], add[1]).replace(/^<section class="panel"><div class="panelhead"><h2>Add buildings<\/h2>.*?<\/div>/s, '').replace(/<\/section>$/, '');
      html = html.slice(0, add[0]) + `<section class="panel lgg-fold"><details><summary><b>Add buildings</b><span>${free === 0 ? 'The trailer is full' : `The trailer is ${-free} ft over`} · show anyway</span></summary>${inner}</details></section>` + html.slice(add[1]);
    }
    /* 1. The reason is typed when the load is scheduled, so the separate Override button goes */
    html = html.replace(/<button type="button" class="secondary small" onclick="lgOverForm\('[^']*'\)">Override<\/button>/g, '');
    /* 1 and 3. The bar */
    const bar = lggCut(html, '<div class="ops-bar">', '</button></div>');
    if (bar && load.state === 'planned') {
      const stops = lgBlocked(load), warns = lggWarns(load), ok = lggReasonOk(load, warns);
      if (!stops.length && warns.length)
        html = html.slice(0, bar[0]) + `<div class="ops-bar lgg-warnbar"><div class="grow"><strong>${lgPlural(warns.length, 'warning')}</strong><small>${esc(warns[0].text)}${warns.length > 1 ? ` · and ${warns.length - 1} more` : ''}${ok ? ` · reason given: ${esc(load.why.reason)}` : ''}</small></div><button type="button" class="ops-quiet" onclick="lgCancelForm('${id}')">Cancel</button><button type="button" class="primary" onclick="lgSchedule('${id}')">${ok ? 'Schedule' : 'Schedule with a reason'}</button></div>` + html.slice(bar[1]);
    }
    if (bar && load.state === 'in_transit')
      html = html.slice(0, bar[1]).replace(/(<div class="ops-bar"><div class="grow">.*?<\/small><\/div>)/s, `$1<button type="button" class="ops-quiet" onclick="lggRoadCancelForm('${id}')">${load.kind === 'haul' ? 'Cancel load' : 'Cancel delivery'}</button>`) + html.slice(bar[1]);
    return html;
  };
}

/* ---------- 10. Driver's day ----------
   Turbo Logistics: the driver app (DriverAppShell) shows the signed-in driver's own stops. */
{
  const lggDriver = () => {
    const me = typeof adMe === 'function' ? adMe() : null;
    return me && (me.roles || []).includes('driver') ? me : null;
  };
  const base = OPS_SCREENS['lg-drive'] || lgDrive;
  const screen = function () {
    const me = lggDriver();
    if (me) {
      const mine = LG.rigs.find((r) => r.driver === me.name);
      if (mine) LG.rig = mine.id;
    }
    let html = base();
    /* 4. the same miles */
    for (const l of LG.loads.filter((x) => ['scheduled', 'in_transit'].includes(x.state))) {
      const mi = lggMiles(l);
      if (mi) html = html.replace(`${lgFeet(l)} ft · about ${lgMiles(l).total} mi`, `${lgFeet(l)} ft · ${mi.text}`);
    }
    if (me) {
      const mine = LG.rigs.find((r) => r.driver === me.name), has = mine && LG.loads.some((l) => l.rigId === mine.id && ['scheduled', 'in_transit'].includes(l.state));
      html = html.replace(/<div class="chiprow ops-tabs">.*?<\/div>/s, `<p class="lgg-mine">${esc(me.name)}${mine ? ' · ' + esc(mine.name) : ''} · you see only your own day.</p>`);
      if (!has) {
        const from = html.indexOf('<section class="panel lg-run">'), to = html.indexOf('<details class="ops-notes"');
        const empty = `<div class="panel emptystate"><strong>Nothing for you yet</strong><p>${mine ? 'A load shows here once it is scheduled on your trailer.' : 'No trailer has your name on it yet. Ask the office.'}</p></div>`;
        if (from >= 0 && to > from) html = html.slice(0, from) + empty + html.slice(to);
      }
    }
    return html;
  };
  OPS_SCREENS['lg-drive'] = screen;
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-drive'] = screen;
}

/* The hauler's view writes the state in Turbo's lower-case words; use the one name for each. */
{
  const base = lgxHaulerView;
  lgxHaulerView = function (car) {
    const html = base(car);
    return lggRaw() ? html : html.replace(/<span class="pill">(planned|scheduled|in transit)<\/span>/g, (m, k) => `<span class="pill">${LG_STATE[k.replace(' ', '_')]}</span>`);
  };
}

if (typeof taNotesFor === 'function') taNotesFor('lg-load', [['Warnings', '<code>buildRigAssignmentWarnings</code> warns and lets the coordinator go on.'], ['Start the run · Cancel on the road', '<code>transitionOrgRouteState</code>: scheduled → in transit, and in transit → cancelled.']], ['A typed reason before a load with warnings is scheduled, kept in its history.', 'Asking before the run starts.', 'Leaving early enough to reach the customer when promised, and a warning when the truck would miss that time.', 'Miles shown as out and round trip.', 'Undo after a building is taken off.']);
