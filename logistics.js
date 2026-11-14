/* logistics.js: the Logistics side. Moving finished buildings from the plant to the lots and to
   customers' homes.

   Two authorities. This preview decides how the screens look and the order the dispatcher works in.
   Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does: this side is
   drawn as Turbo Logistics, where a route carries one building through its stops, a shipment
   groups the buildings on one plant load, and a rig is the truck and trailer. Every control names
   the function it would call; what exists only here is listed on the notes page.

   How a building moves:
   - Inventory goes from the plant to its lot on a load with other buildings.
   - A customer's building goes through the lot (the customer can see it, or still owes money) or
     plant to home (no need to see it, or it is settled). The office or Logistics decides.
   - A plant load can also drop a customer's building in the same area as a lot.
   - A lot sale goes from the lot to the customer's home.

   This file holds the records, the rules and the actions. The screens are in logistics-screens.js.
   Nothing is saved: a reload starts over. Loaded after office.js. */

const LG = {
  units: [], loads: [], rigs: [], carriers: [],
  loadId: null, back: 'logi', tile: 'all', q: '', pick: [], tab: 'scheduled', week: 0, place: null, rig: null,
  seq: 0, homeSeq: 11,
  set: { wideFt: 14 }, /* buildings this wide or wider are flagged as wide loads */
};
const LG_STATE = { planned: 'Being planned', scheduled: 'Scheduled', in_transit: 'On the road', delivered: 'Delivered', cancelled: 'Cancelled' };
const LG_STATE_PILL = { planned: 'amber', scheduled: 'blue', in_transit: 'amber', delivered: 'good', cancelled: 'ghost' };
const LG_WINDOWS = ['Date only', 'Morning', 'Afternoon', 'Specific window', 'Specific time'];
const LG_LEG = { 'plant-lot': 'Plant to lot', 'plant-home': 'Plant to home', 'lot-home': 'Lot to home' };

const lgIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lgToday = () => lgIso(new Date());
const lgAddDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return lgIso(d);
};
const lgDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const lgStamp = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const lgUnit = (id) => LG.units.find((u) => u.id === id);
const lgLoad = (id) => LG.loads.find((l) => l.id === id);
const lgRig = (id) => LG.rigs.find((r) => r.id === id);
const lgCarrier = (id) => LG.carriers.find((c) => c.id === id);
const lgSale = (u) => (u.saleId ? S.sales.find((s) => s.id === u.saleId) : null);
const lgSite = (u) => lgSale(u)?.site || u.site || null;
const lgOnLoad = (u) => (u.loadId ? lgLoad(u.loadId) : null);
const lgNote = (load, text) => load.log.push({ at: Date.now(), text });
const lgPlural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* ---------- Buildings ----------
   at: where the building is (plant, lot, road, home).  leg: the move it still needs
   (plant-lot, plant-home, lot-home), or null once it is where it belongs. */
function lgAddUnit(u) {
  const [wid, len] = u.size.split('x').map(Number);
  const unit = { at: 'plant', loadId: null, sample: false, customer: '', readyAt: Date.now(), trips: [], ...u, wid, len };
  LG.units.push(unit);
  return unit;
}
/* Pull in what the other sides have finished: a building plant QC signed off is inventory for
   its lot; a customer's order arrives when the office releases it. */
function lgSync() {
  /* An order the office cancelled leaves the board, unless it is already on a load. */
  LG.units = LG.units.filter((u) => u.loadId || !u.leg || lgSale(u)?.status !== 'Cancelled');
  if (typeof Q !== 'undefined')
    for (const b of Q.builds) {
      if (b.stage !== LAST || lgUnit(b.serial) || (b.saleId && S.sales.some((s) => s.id === b.saleId))) continue;
      const lot = lotByDealer(b.dealer) || lotById(DESK_LOT);
      lgAddUnit({ id: b.serial, name: `${b.size} ${b.style}`, size: b.size, kind: b.customer ? 'order' : 'stock', customer: b.customer || '', lotId: lot.id, plantId: lotPlant(lot).id, leg: 'plant-lot', sample: /^SAMPLE/.test(b.serial), readyAt: b.signoff?.at || Date.now() });
    }
  for (const s of S.sales) {
    if (!s.office?.released || s.status !== 'Processed · Sold' || lgUnit(s.id)) continue;
    const lot = saleLot(s), lotSale = s.path === 'lot';
    lgAddUnit({ id: s.id, name: label(s.c), size: s.c.size, kind: 'order', saleId: s.id, customer: s.customer, lotId: lot.id, plantId: lotPlant(lot).id,
      at: lotSale ? 'lot' : 'plant', leg: lotSale ? 'lot-home' : s.office.path === 'home' ? 'plant-home' : 'plant-lot', sample: !!s.sample, readyAt: s.office.released.at });
  }
}
/* Why a building cannot go to a home yet. The lot leg never waits on money. */
function lgHold(u) {
  const s = lgSale(u);
  if (!s || u.leg === 'plant-lot' || !u.leg) return null;
  const pay = ofPayRule(s);
  return pay.ok ? null : pay.text;
}
/* What is wrong at the delivery site, for a building headed to a home. */
function lgSiteProblems(u) {
  const d = lgSite(u), out = [];
  if (!d) return out;
  if (!d.noGate && d.gate !== '' && d.gate != null) {
    if (d.gate <= u.wid) out.push(`The opening is ${d.gate} ft and the building is ${u.wid} ft wide`);
    else if (d.gate < u.wid + 2) out.push(`Tight: a ${u.wid} ft building through a ${d.gate} ft opening`);
  }
  if (d.ground === 'Needs leveling') out.push('The site needs leveling first');
  if (d.access && d.access !== 'Clear access') out.push(d.access);
  return out;
}
/* The site answers are asked at the sale and gone over again by Logistics before the delivery is
   scheduled. Returns what is still open: the questions themselves, then the confirmation. */
function lgSiteOpen(u) {
  const d = lgSite(u), gaps = siteMissing(d);
  return gaps.length ? `ask the delivery-site questions (${gaps.join(', ')})` : d.confirmed ? '' : 'confirm the site answers with the customer';
}
function lgSiteForm(unitId) {
  const u = lgUnit(unitId), s = lgSale(u);
  siteForm(s ? { sale: s } : { unit: u }, true);
}
/* Past the mileage the agreement prices, Logistics approves the fee for that delivery. */
const lgFeeList = () => S.sales.filter((s) => ['review', 'hold', 'approved'].includes(ofStage(s)) && ofDelivery(s).over && !ofDelivery(s).approved);
function lgFeeForm(id) {
  const s = ofSale(id), d = ofDelivery(s), lot = saleLot(s);
  modal('Approve a delivery fee', `<p><strong>${esc(s.customer)}</strong> · ${esc(label(s.c))} · ${esc(id)}</p>
    <p>${d.miles} miles from the ${esc(lot.town)} lot. Delivery is free within ${FREE_DELIVERY_MILES} miles and ${money(OF.set.overFee)} up to ${OF.set.overTo}; past that, Logistics sets the fee for the trip.</p>
    <label class="field">Delivery fee ($)<input id="lg-fee" type="number" min="0" step="1" inputmode="decimal" placeholder="For the whole delivery"></label>
    <label class="field">Note (optional)<input id="lg-fee-note" maxlength="100" placeholder="Example: second driver, escort, overnight"></label>
    <p class="source">The fee goes on the order as a delivery line. The office and the salesperson see it at once.</p>
    <div class="actions">${button('Approve the fee', `lgFeeSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgFeeSave(id) {
  const s = ofSale(id), amount = Math.round(Number($('#lg-fee').value) * 100) / 100, note = $('#lg-fee-note').value.trim(), d = ofDelivery(s);
  if (!(amount >= 0) || $('#lg-fee').value.trim() === '') return toast('Type the fee.');
  ofRec(s);
  s.money.fees = s.money.fees.filter((f) => f.by !== 'Logistics');
  s.money.fees.push({ name: `Delivery · ${d.miles} miles${note ? ' · ' + note : ''}`, amount, auto: true, by: 'Logistics' });
  ofLog(s, `Logistics approved a ${money(amount)} delivery fee for ${d.miles} miles${note ? ' (' + note + ')' : ''}`);
  closeModal();
  render();
  toast(`${money(amount)} delivery fee approved.`);
}
const lgWide = (u) => u.wid >= LG.set.wideFt;
/* Where a building is headed on its next move, in words. */
function lgDest(u) {
  const lot = lotById(u.lotId), site = lgSite(u);
  if (u.leg === 'plant-lot') return `${lot.town} lot`;
  const miles = site && site.miles !== '' && site.miles != null ? `${site.miles} mi from` : 'near';
  return `${u.customer || 'Customer'} · ${miles} the ${lot.town} lot`;
}

/* ---------- Loads ----------
   A plant haul carries several buildings: Turbo Logistics calls the group a shipment (code "AC")
   and each building on it a route with its own stops. A home delivery is one route from a lot. */
function lgCode() {
  const n = LG.seq++;
  return String.fromCharCode(65 + (Math.floor(n / 26) % 26)) + String.fromCharCode(65 + (n % 26));
}
const lgStopKey = (u) => (u.leg === 'plant-lot' ? 'lot:' + u.lotId : 'home:' + u.id);
const lgStopIsLot = (stop) => stop.key.startsWith('lot:');
const lgStopLot = (stop) => (lgStopIsLot(stop) ? lotById(stop.key.slice(4)) : lotById(lgUnit(stop.key.slice(5)).lotId));
const lgStopUnits = (stop) => stop.units.map(lgUnit);
const lgLoadUnits = (load) => load.stops.flatMap(lgStopUnits);
const lgFeet = (load) => lgLoadUnits(load).reduce((t, u) => t + u.len, 0);
const lgOrigin = (load) => (load.from.type === 'plant' ? plantById(load.from.id) : lotById(load.from.id));
const lgOriginName = (load) => (load.from.type === 'plant' ? `${lgOrigin(load).name}, ${lgOrigin(load).town}` : `${lgOrigin(load).town} lot`);
const lgLoadName = (load) => (load.kind === 'haul' ? `Load ${load.id}` : `Delivery ${load.id}`);

function lgMakeLoad(kind, from, unitIds = []) {
  const load = { id: kind === 'haul' ? lgCode() : 'H' + ++LG.homeSeq, kind, from, rigId: null, driver: '', date: '', window: 'Date only', windowNote: '', state: 'planned', stops: [], permit: false, log: [], made: Date.now() };
  LG.loads.push(load);
  unitIds.forEach((id) => lgPut(load, id, true));
  lgOrderStops(load);
  lgNote(load, `${kind === 'haul' ? 'Load' : 'Delivery'} started`);
  return load;
}
function lgPut(load, unitId, quiet) {
  const u = lgUnit(unitId), key = lgStopKey(u);
  if (!u || u.loadId) return;
  let stop = load.stops.find((x) => x.key === key);
  if (!stop) load.stops.push((stop = { key, units: [], arrived: null, done: null, proof: null }));
  stop.units.push(u.id);
  u.loadId = load.id;
  if (!quiet) lgNote(load, `Added ${u.name} for ${lgDest(u)}`);
}
function lgTake(load, unitId) {
  const u = lgUnit(unitId);
  for (const stop of load.stops) stop.units = stop.units.filter((id) => id !== unitId);
  load.stops = load.stops.filter((x) => x.units.length);
  u.loadId = null;
  lgNote(load, `Took off ${u.name}`);
}
/* Miles between two points on a run. A home is its selling lot plus the miles the customer gave. */
function lgSpot(stop) {
  if (lgStopIsLot(stop)) return { p: lgStopLot(stop), extra: 0 };
  const u = lgUnit(stop.key.slice(5)), site = lgSite(u);
  return { p: lotById(u.lotId), extra: Number(site?.miles) || 0 };
}
const lgBetween = (a, b) => (milesBetween(a.p, b.p) || 0) + a.extra + b.extra;
/* Miles for each stop from the one before, and the total to the last stop. */
function lgMiles(load) {
  let at = { p: lgOrigin(load), extra: 0 }, total = 0;
  const legs = load.stops.map((stop) => {
    const next = lgSpot(stop), m = lgBetween(at, next);
    at = next;
    total += m;
    return m;
  });
  return { legs, total };
}
/* Drop order: lots first, nearest next each time, then customers. The customer's building loads
   at the front of the trailer so it comes off last. */
function lgOrderStops(load) {
  const order = (list, from) => {
    const out = [];
    let at = from;
    while (list.length) {
      list.sort((a, b) => lgBetween(at, lgSpot(a)) - lgBetween(at, lgSpot(b)));
      const next = list.shift();
      out.push(next);
      at = lgSpot(next);
    }
    return out;
  };
  const start = { p: lgOrigin(load), extra: 0 }, lots = order(load.stops.filter(lgStopIsLot), start);
  const homes = order(load.stops.filter((x) => !lgStopIsLot(x)), lots.length ? lgSpot(lots[lots.length - 1]) : start);
  load.stops = [...lots, ...homes];
}
const lgStates = (load) => [...new Set([lgOrigin(load).state, ...load.stops.map((x) => lgStopLot(x).state)])];

/* ---------- The checks on a load ----------
   stop: cannot be scheduled.  warn: look before scheduling.  The first five are Turbo Logistics'
   own rig warnings, word for word (buildRigAssignmentWarnings). */
function lgChecks(load) {
  const out = [], rig = lgRig(load.rigId), units = lgLoadUnits(load), feet = lgFeet(load), add = (level, text, turbo) => out.push({ level, text, turbo });
  if (!units.length) add('stop', 'Add a building.');
  if (!rig) add('stop', 'Pick a trailer.');
  if (rig) {
    const homes = load.stops.filter((x) => !lgStopIsLot(x)).length;
    if (load.kind === 'haul' && !rig.haul) add('warn', 'Rig is not flagged for plant-haul capability.', true);
    if (homes && !rig.home) add('warn', 'Rig is not flagged for home-delivery capability.', true);
    if (!rig.feet) add('warn', 'Rig has no capacity on file — verify load fit manually.', true);
    else {
      for (const u of units) if (u.len > rig.feet) add('warn', `Unit needs ~${u.len} linear feet; rig capacity is ${rig.feet}.`, true);
      if (feet > rig.feet) add('stop', `Too long: ${feet} ft of buildings on a ${rig.feet} ft trailer. Take one off or pick a longer trailer.`);
    }
    if (load.date) {
      const same = LG.loads.filter((l) => l !== load && l.rigId === rig.id && l.date === load.date && !['cancelled', 'delivered'].includes(l.state)).length;
      if (same) add('warn', `Rig already has ${same} other route(s) on this delivery date.`, true);
    }
  }
  if (!load.date) add('stop', 'Pick a day.');
  else if (load.state === 'planned' && load.date < lgToday()) add('stop', 'That day has passed.');
  if (load.date && ['planned', 'scheduled'].includes(load.state))
    for (const stop of load.stops.filter(lgStopIsLot)) {
      const lot = lgStopLot(stop), day = lotDay(lot, load.date);
      if (!day.open) add('warn', `${lot.town} lot: ${day.text.toLowerCase()}${day.appt ? ' · call ahead' : ''}.`);
    }
  const wide = units.filter(lgWide);
  if (wide.length && !load.permit) add('warn', `${lgPlural(wide.length, 'building')} ${LG.set.wideFt} ft wide or wider: confirm the permit and escort, then tick “Permit confirmed”.`);
  const states = lgStates(load);
  if (states.length > 1) add('info', `This run crosses state lines: ${states.join(' → ')}.`);
  const firstHome = load.stops.findIndex((x) => !lgStopIsLot(x)), lastLot = load.stops.map(lgStopIsLot).lastIndexOf(true);
  if (firstHome >= 0 && lastLot > firstHome) add('warn', 'A customer delivery comes before a lot drop. Lot drops usually come off first, with the customer’s building at the front of the trailer.');
  for (const u of units) if (lgSale(u)?.status === 'Cancelled') add('stop', `${u.customer}: the office cancelled this order. Take the building off the load.`);
  for (const stop of load.stops.filter((x) => !lgStopIsLot(x)))
    for (const u of lgStopUnits(stop)) {
      const hold = lgHold(u), site = lgSiteOpen(u);
      if (hold) add('stop', `${u.customer}: ${hold}.`);
      if (site && ['planned', 'scheduled'].includes(load.state)) add('stop', `${u.customer}: ${site}.`);
      for (const p of lgSiteProblems(u)) add('warn', `${u.customer}: ${p}.`);
    }
  return out;
}
const lgBlocked = (load) => lgChecks(load).filter((c) => c.level === 'stop');

/* ---------- Actions ---------- */
function lgOpen(id) {
  LG.loadId = id;
  if (S.page !== 'lg-load') LG.back = typeof opsSide === 'function' && opsSide(S.page) === 'logi' ? S.page : 'logi';
  go('lg-load');
}
function lgDetailNav() {
  const load = lgLoad(LG.loadId), names = { logi: 'Dispatch', 'lg-loads': 'Loads', 'lg-cal': 'Calendar', 'lg-drive': 'Drive', 'lg-places': 'Locations' };
  return [LG.back, names[LG.back] || 'Dispatch', load ? lgLoadName(load) : 'Load'];
}
/* A new plant load: with the ticked buildings when there are any. */
function lgNewLoad() {
  const picked = LG.pick.map(lgUnit).filter((u) => u && !u.loadId && u.at === 'plant' && u.leg);
  const plant = picked[0]?.plantId || PLANTS[0].id;
  const empty = !picked.length && LG.loads.find((l) => l.kind === 'haul' && l.state === 'planned' && !l.stops.length && l.from.id === plant);
  const load = empty || lgMakeLoad('haul', { type: 'plant', id: plant }, picked.filter((u) => u.plantId === plant).map((u) => u.id));
  LG.pick = [];
  lgOpen(load.id);
}
/* A home delivery from a lot, for one building. */
function lgNewHome(unitId) {
  const u = lgUnit(unitId);
  if (!u || u.loadId) return;
  const load = lgMakeLoad('home', { type: 'lot', id: u.lotId }, [u.id]);
  lgOpen(load.id);
}
function lgTogglePick(id, on) {
  LG.pick = LG.pick.filter((x) => x !== id);
  if (on) LG.pick.push(id);
  render();
}
function lgAdd(loadId, unitId) {
  const load = lgLoad(loadId);
  lgPut(load, unitId);
  lgOrderStops(load);
  render();
}
function lgRemove(loadId, unitId) {
  lgTake(lgLoad(loadId), unitId);
  render();
}
function lgMoveStop(loadId, i, by) {
  const load = lgLoad(loadId), j = i + by;
  if (j < 0 || j >= load.stops.length) return;
  [load.stops[i], load.stops[j]] = [load.stops[j], load.stops[i]];
  lgNote(load, 'Stop order changed');
  render();
}
function lgSet(loadId, key, value) {
  const load = lgLoad(loadId);
  load[key] = value;
  if (key === 'rigId') load.driver = lgRig(value)?.driver || '';
  render();
}
/* A building can leave the plant path it was given: straight to the customer, or through the lot. */
function lgSwitchPath(unitId) {
  const u = lgUnit(unitId), s = lgSale(u);
  if (!u || u.loadId || u.at !== 'plant' || u.kind !== 'order') return;
  if (u.leg === 'plant-lot' && lgHoldFor(u, 'plant-home')) return toast(lgHoldFor(u, 'plant-home') + '.');
  u.leg = u.leg === 'plant-lot' ? 'plant-home' : 'plant-lot';
  if (s) {
    s.office.path = u.leg === 'plant-home' ? 'home' : 'lot';
    ofLog(s, `Logistics changed the path: ${u.leg === 'plant-home' ? 'plant to home' : 'through the lot'}`);
  }
  render();
  toast(u.leg === 'plant-home' ? 'Now plant to home.' : 'Now through the lot.');
}
function lgHoldFor(u, leg) {
  const s = lgSale(u);
  if (!s || leg === 'plant-lot') return null;
  const pay = ofPayRule(s);
  return pay.ok ? null : pay.text;
}
/* Schedule: the day is set and the people who sold the buildings are told. */
function lgSchedule(id) {
  const load = lgLoad(id), stops = lgBlocked(load);
  if (stops.length) return toast(stops[0].text);
  load.state = 'scheduled';
  lgNote(load, `Scheduled for ${lgDay(load.date)}${load.window !== 'Date only' ? ' · ' + (load.windowNote || load.window).toLowerCase() : ''} with ${lgRig(load.rigId).name}`);
  for (const u of lgLoadUnits(load)) {
    const s = lgSale(u);
    if (!s) continue;
    if (u.leg === 'plant-lot') ofLog(s, `Logistics: leaves the plant for the ${lotById(u.lotId).town} lot ${lgDay(load.date)}`);
    else {
      s.deliverOn = load.date;
      s.toldCustomer = false;
      ofLog(s, `Logistics: delivery scheduled for ${lgDay(load.date)} · relay the date to your customer (no automatic customer text)`);
    }
  }
  render();
  toast(`${lgLoadName(load)} scheduled for ${lgDay(load.date)}.`);
}
function lgStart(id) {
  const load = lgLoad(id);
  if (load.state !== 'scheduled') return;
  load.state = 'in_transit';
  load.startedAt = Date.now();
  lgLoadUnits(load).forEach((u) => (u.at = 'road'));
  lgNote(load, `${load.driver || 'The driver'} left ${lgOriginName(load)}`);
  render();
  toast('On the road.');
}
function lgCancelForm(id) {
  const load = lgLoad(id);
  modal(`Cancel ${lgLoadName(load).toLowerCase()}?`, `<p>Its ${lgPlural(lgLoadUnits(load).length, 'building')} go back to the board, ready for another load.</p>
    <div class="actions">${button('Cancel it', `lgCancel('${id}')`)}${button('Keep it', 'closeModal()', 'secondary')}</div>`);
}
function lgCancel(id) {
  const load = lgLoad(id);
  for (const u of lgLoadUnits(load)) {
    u.loadId = null;
    const s = lgSale(u);
    if (s && s.deliverOn && u.leg !== 'plant-lot') (s.deliverOn = null), ofLog(s, 'Logistics cancelled the scheduled delivery · a new date will follow');
  }
  load.state = 'cancelled';
  lgNote(load, 'Cancelled');
  closeModal();
  go(LG.back);
  toast('Cancelled. The buildings are back on the board.');
}
function lgArrive(id, i) {
  const load = lgLoad(id), stop = load.stops[i];
  stop.arrived = Date.now();
  lgNote(load, `Arrived at ${lgStopIsLot(stop) ? 'the ' + lgStopLot(stop).town + ' lot' : lgStopUnits(stop)[0].customer + '’s site'}`);
  render();
}
/* Unloading at a stop. A lot signs for its buildings; a customer pays what is owed (when drivers
   may take payment) and signs for theirs. */
function lgDropForm(id, i) {
  const load = lgLoad(id), stop = load.stops[i], units = lgStopUnits(stop);
  if (lgStopIsLot(stop)) {
    const lot = lgStopLot(stop);
    return modal(`Unload at the ${esc(lot.town)} lot`, `<ul class="lg-droplist">${units.map((u) => `<li><strong>${esc(u.name)}</strong><span>${esc(u.id)}${u.kind === 'order' ? ' · for ' + esc(u.customer) : ' · inventory'}</span></li>`).join('')}</ul>
      <label class="field">Received by (name at the lot)<input id="lg-by" maxlength="60" autocomplete="off" placeholder="Made-up name in this preview"></label>
      <label class="field">Condition<select id="lg-cond"><option>Good · no damage</option><option>Damage noted</option></select></label>
      <label class="field">Notes (optional)<input id="lg-dropnote" maxlength="160"></label>
      <label class="field">Photo on the lot (optional)<input id="lg-photo" type="file" accept="image/*" capture="environment"></label>
      <div class="actions">${button('Unloaded and signed for', `lgDropSave('${id}',${i})`)}${button('Not yet', 'closeModal()', 'secondary')}</div>`);
  }
  const u = units[0], s = lgSale(u);
  if (s) {
    const pay = ofPayRule(s), t = ofTotals(s);
    if (!pay.ok) return modal('Do not unload yet', `<p><strong>${esc(u.customer)}</strong>: ${esc(pay.text)}.</p><p>Call the office before the building comes off the trailer.</p><div class="actions">${button('OK', 'closeModal()', 'secondary')}</div>`);
    if (pay.collect && !stop.collected)
      return modal(`Collect ${money(t.balance)} first`, `<p><strong>${esc(u.customer)}</strong> owes ${money(t.balance)} on ${esc(u.name)}. Take the payment, then the customer signs.</p>
        <div class="fields"><label>Amount collected ($)<input id="lg-col-amount" type="number" min="0.01" step="0.01" value="${t.balance}" inputmode="decimal"></label>
        <label>How it was paid<select id="lg-col-method"><option>Cash</option><option>Check</option><option>Card</option><option>Money order</option></select></label></div>
        <p class="source">Preview only: nothing is charged. The office confirms the payment afterwards.</p>
        <div class="actions">${button('Payment taken · go to the signature', `lgCollect('${id}',${i})`)}${button('Not yet', 'closeModal()', 'secondary')}</div>`);
    S.activeSale = s.id;
    LG.signing = { id, i };
    return sfReceipt();
  }
  modal(`Deliver to ${esc(u.customer)}`, `<p><strong>${esc(u.name)}</strong> · set and blocked where the customer asked.</p>
    <label class="field">Signed for by<input id="lg-by" maxlength="60" autocomplete="off" value="${esc(u.customer)}"></label>
    <label class="field">Notes (optional)<input id="lg-dropnote" maxlength="160"></label>
    <label class="field">Photo of the building in place (optional)<input id="lg-photo" type="file" accept="image/*" capture="environment"></label>
    <p class="source">A sample customer, so there is no order to sign. A real order opens the delivery receipt for the customer’s signature.</p>
    <div class="actions">${button('Delivered and signed for', `lgDropSave('${id}',${i})`)}${button('Not yet', 'closeModal()', 'secondary')}</div>`);
}
function lgCollect(id, i) {
  const load = lgLoad(id), stop = load.stops[i], s = lgSale(lgStopUnits(stop)[0]);
  const amount = Math.round(Number($('#lg-col-amount').value) * 100) / 100, method = $('#lg-col-method').value;
  if (!(amount > 0)) return toast('Type the amount collected.');
  s.money.payments.push({ amount, method: `Driver · ${method.toLowerCase()}`, at: Date.now(), confirmed: false, by: 'Driver' });
  stop.collected = amount;
  ofLog(s, `Driver collected ${money(amount)} (${method.toLowerCase()}) at delivery · the office confirms it`);
  lgNote(load, `Collected ${money(amount)} from ${s.customer}`);
  closeModal();
  lgDropForm(id, i);
}
function lgDropSave(id, i) {
  const by = ($('#lg-by')?.value || '').trim();
  if (!by) return toast('Type who signed for it.');
  const photo = $('#lg-photo')?.files?.[0]?.name || '';
  lgDropDone(id, i, { by, note: `${$('#lg-cond') ? $('#lg-cond').value : ''}${$('#lg-dropnote')?.value.trim() ? ' · ' + $('#lg-dropnote').value.trim() : ''}`.replace(/^ · /, ''), photo });
  closeModal();
  render();
}
/* A stop is finished: the buildings are where the stop put them. */
function lgDropDone(id, i, proof, quiet) {
  const load = lgLoad(id), stop = load.stops[i], lot = lgStopLot(stop);
  stop.arrived ||= Date.now();
  stop.done = Date.now();
  stop.proof = proof;
  for (const u of lgStopUnits(stop)) {
    const s = lgSale(u);
    u.trips.push({ load: load.id, leg: u.leg, at: stop.done });
    u.loadId = null;
    if (lgStopIsLot(stop)) {
      u.at = 'lot';
      u.leg = u.kind === 'order' ? 'lot-home' : null;
      u.readyAt = stop.done;
      if (s) ofLog(s, `Logistics: arrived at the ${lot.town} lot · received by ${proof.by}`);
    } else {
      u.at = 'home';
      u.leg = null;
    }
  }
  lgNote(load, lgStopIsLot(stop) ? `Unloaded at the ${lot.town} lot · received by ${proof.by}${proof.note ? ' · ' + proof.note : ''}` : `Delivered to ${lgStopUnits(stop)[0].customer} · signed by ${proof.by}`);
  if (load.stops.every((x) => x.done)) {
    load.state = 'delivered';
    load.doneAt = Date.now();
    lgNote(load, 'Every stop done');
    if (!quiet) toast(`${lgLoadName(load)} is delivered.`);
  }
}
/* A real customer signs the delivery receipt on the order (sale-flow.js). When they have, the stop is done. */
{
  const deskSign = sfSign;
  sfSign = function (kind) {
    const s = sfSale(), was = s?.status, at = LG.signing;
    deskSign(kind);
    if (kind !== 'receipt' || !s || s.status !== 'Delivered' || was === 'Delivered') return;
    const u = lgUnit(s.id), load = at ? lgLoad(at.id) : u && lgOnLoad(u);
    if (load) {
      const i = at ? at.i : load.stops.findIndex((x) => x.units.includes(s.id));
      if (i >= 0 && !load.stops[i].done) lgDropDone(load.id, i, { by: s.signatures?.receipt?.name || s.customer, note: '', photo: '' });
    }
    LG.signing = null;
    render();
  };
}

/* ---------- What the other sides see ---------- */
/* Where a released order is, in one line: the Sales desk and the Office both show it. */
function lgSaleLine(s) {
  const u = lgUnit(s.id);
  if (!u) return 'Released · on the Logistics board';
  const load = lgOnLoad(u), lot = lotById(u.lotId);
  if (!u.leg) return u.at === 'home' ? 'Delivered' : `At the ${lot.town} lot`;
  if (!load) return u.at === 'lot' ? `At the ${lot.town} lot · ${lgHold(u) || 'ready for home delivery'}` : `Ready at the plant · ${u.leg === 'plant-home' ? 'plant to home' : 'through the ' + lot.town + ' lot'}`;
  if (load.state === 'planned') return `On ${lgLoadName(load).toLowerCase()} · no day yet`;
  if (load.state === 'scheduled') return u.leg === 'plant-lot' ? `Leaves for the ${lot.town} lot ${lgDay(load.date)}` : `Delivery scheduled ${lgDay(load.date)}`;
  return load.state === 'in_transit' ? 'On the road' : 'With Logistics';
}
function lgOpenSale(id) {
  lgSync();
  const u = lgUnit(id), load = u && (lgOnLoad(u) || lgLoad(u.trips[u.trips.length - 1]?.load));
  if (load) return lgOpen(load.id);
  LG.tile = 'all';
  LG.q = id;
  go('logi');
}
/* Once the office releases an order, its status line comes from Logistics. */
if (typeof syncDealer === 'function') {
  const others = syncDealer;
  syncDealer = function () {
    others();
    lgSync();
    for (const s of S.sales) if (s.office?.released && s.status === 'Processed · Sold') s.fulfillment = lgSaleLine(s);
  };
}

/* Plant QC signs a building off: say where it goes next. */
if (typeof doSignoff === 'function') {
  const qcSign = doSignoff;
  doSignoff = function () {
    const serial = Q.signSerial;
    qcSign();
    const b = build(serial);
    if (!b || b.stage !== LAST) return;
    const sale = S.sales.find((s) => s.id === b.saleId);
    toast(sale ? `${serial} signed off. The office can release it for delivery.` : `${serial} signed off. It is on the Logistics board, ready to load.`);
  };
}

/* ---------- Trailers, haulers and plants ---------- */
function lgRigForm(id) {
  const r = lgRig(id) || { name: '', feet: 40, haul: true, home: false, driver: '', carrierId: LG.carriers[0].id };
  modal(id ? 'Change this trailer' : 'Add a trailer', `<div class="fields"><label>Name<input id="lg-rig-name" maxlength="40" value="${esc(r.name)}" placeholder="Example: Rig 5"></label>
    <label>Trailer length (ft)<input id="lg-rig-feet" type="number" min="0" max="80" step="1" value="${r.feet || ''}" inputmode="numeric"></label>
    <label>Usual driver<input id="lg-rig-driver" maxlength="40" value="${esc(r.driver)}" placeholder="Made-up name in this preview"></label>
    <label>Who runs it<select id="lg-rig-carrier">${LG.carriers.map((c) => `<option value="${c.id}" ${r.carrierId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
    <label class="checkrow"><input id="lg-rig-haul" type="checkbox" ${r.haul ? 'checked' : ''}> Plant hauls: several buildings from the plant to the lots</label>
    <label class="checkrow"><input id="lg-rig-home" type="checkbox" ${r.home ? 'checked' : ''}> Home deliveries: can set a building in a customer’s yard</label>
    <div class="actions">${button('Save', `lgRigSave('${id || ''}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgRigSave(id) {
  const name = $('#lg-rig-name').value.trim();
  if (!name) return toast('Give the trailer a name.');
  const data = { name, feet: Number($('#lg-rig-feet').value) || 0, driver: $('#lg-rig-driver').value.trim(), carrierId: $('#lg-rig-carrier').value, haul: $('#lg-rig-haul').checked, home: $('#lg-rig-home').checked };
  if (id) Object.assign(lgRig(id), data);
  else LG.rigs.push({ id: 'rig-' + (LG.rigs.length + 1) + '-' + Date.now().toString(36), ...data });
  closeModal();
  render();
  toast('Saved.');
}
function lgCarrierForm() {
  modal('Add a hauler', `<div class="fields"><label>Name<input id="lg-car-name" maxlength="50" placeholder="Made-up name in this preview"></label>
    <label>Kind<select id="lg-car-kind"><option value="contracted">Outside hauler, contracted</option><option value="freelance">Outside hauler, freelance</option><option value="in_house">Company drivers</option></select></label></div>
    <label class="field">Where they deliver<input id="lg-car-covers" maxlength="80" placeholder="Example: North Carolina lots"></label>
    <div class="actions">${button('Save', 'lgCarrierSave()')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgCarrierSave() {
  const name = $('#lg-car-name').value.trim();
  if (!name) return toast('Give the hauler a name.');
  LG.carriers.push({ id: 'car-' + Date.now().toString(36), name, kind: $('#lg-car-kind').value, covers: $('#lg-car-covers').value.trim() || 'Not set' });
  closeModal();
  render();
}
function lgPlantForm() {
  modal('Add a plant', `<div class="fields"><label>Name<input id="lg-pl-name" maxlength="40" placeholder="Example: ShedCor plant 2"></label>
    <label>Street address<input id="lg-pl-street" maxlength="60"></label>
    <label>City<input id="lg-pl-town" maxlength="40"></label>
    <label>State<select id="lg-pl-state">${['SC', 'NC', 'GA'].map((x) => `<option>${x}</option>`).join('')}</select></label>
    <label>ZIP<input id="lg-pl-zip" maxlength="10" inputmode="numeric"></label>
    <label>Nearest Bennett lot<select id="lg-pl-near">${LOTS.map((l) => `<option value="${l.id}">${esc(lotTown(l))}</option>`).join('')}</select></label></div>
    <p class="source">The nearest lot places the plant on the map in this preview and gives rough miles. Turbo Logistics measures real road miles from the address.</p>
    <label class="checkrow"><input id="lg-pl-take" type="checkbox" checked> Serve every lot that is closer to this plant than to its current one</label>
    <div class="actions">${button('Add the plant', 'lgPlantSave()')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgPlantSave() {
  const name = $('#lg-pl-name').value.trim(), town = $('#lg-pl-town').value.trim(), near = lotById($('#lg-pl-near').value);
  if (!name || !town) return toast('A plant needs a name and a city.');
  const plant = { id: 'plant-' + Date.now().toString(36), name, town, state: $('#lg-pl-state').value, street: $('#lg-pl-street').value.trim(), zip: $('#lg-pl-zip').value.trim(), lat: near.lat + 0.03, lon: near.lon + 0.03, added: true };
  /* Lots keep the plant they have unless the new one is closer and the box is ticked. */
  const before = new Map(LOTS.map((l) => [l.id, lotPlant(l).id]));
  PLANTS.push(plant);
  for (const l of LOTS) {
    const closer = milesBetween(plant, l) < milesBetween(plantById(before.get(l.id)), l);
    l.plant = $('#lg-pl-take').checked && closer ? plant.id : before.get(l.id);
  }
  closeModal();
  LG.place = 'plant:' + plant.id;
  render();
  toast(`${name} added. ${LOTS.filter((l) => l.plant === plant.id).length} lots are served from it.`);
}
function lgServe(lotId, plantId) {
  lotById(lotId).plant = plantId;
  render();
  toast(`${lotById(lotId).town} is now served from ${plantById(plantId).town}.`);
}

/* ---------- Sample data: made-up drivers, haulers, buildings and loads ---------- */
(function seedLogistics() {
  LG.carriers = [
    { id: 'house', name: 'Bennett drivers', kind: 'in_house', covers: 'Every lot' },
    { id: 'hauler-a', name: 'Sample Hauling Co.', kind: 'contracted', covers: 'North Carolina lots' },
    { id: 'hauler-b', name: 'Sample Shed Movers', kind: 'contracted', covers: 'Georgia lots' },
  ];
  LG.rigs = [
    { id: 'rig-1', name: 'Rig 1', feet: 40, haul: true, home: false, driver: 'Marcus Bell', carrierId: 'house' },
    { id: 'rig-2', name: 'Rig 2', feet: 40, haul: true, home: false, driver: 'Dee Alvarez', carrierId: 'house' },
    { id: 'rig-3', name: 'Rig 3', feet: 36, haul: true, home: true, driver: 'Theo Grant', carrierId: 'house' },
    { id: 'rig-4', name: 'Rig 4', feet: 30, haul: false, home: true, driver: 'Nia Foster', carrierId: 'house' },
    { id: 'rig-5', name: 'Hauler A', feet: 40, haul: true, home: false, driver: 'Sample Hauling Co.', carrierId: 'hauler-a' },
    { id: 'rig-6', name: 'Hauler B', feet: 32, haul: false, home: true, driver: 'Sample Shed Movers', carrierId: 'hauler-b' },
  ];
  const plant = PLANTS[0].id, hours = (h) => Date.now() - h * 36e5;
  const stock = (n, size, style, lot, waited) => lgAddUnit({ id: `SAMPLE-${size.replace('x', '')}-${n}`, name: `${size} ${style}`, size, kind: 'stock', lotId: lot, plantId: plant, leg: 'plant-lot', sample: true, readyAt: hours(waited) });
  const order = (n, size, style, lot, customer, leg, miles, extra = {}) => lgAddUnit({ id: `SAMPLE-${size.replace('x', '')}-${n}`, name: `${size} ${style}`, size, kind: 'order', customer, lotId: lot, plantId: plant, leg, at: leg === 'lot-home' ? 'lot' : 'plant', sample: true, readyAt: hours(30),
    site: { miles, access: 'Clear access', gate: '', noGate: true, ground: 'Level', notes: '', askedBy: 'Salesperson', askedAt: hours(200), confirmed: null, ...extra } });

  /* In the plant yard, signed off and waiting for a load. */
  stock(2101, '12x24', 'Classic Utility', 'florence', 52);
  stock(2102, '10x16', 'Basic Lofted Barn', 'florence', 30);
  stock(2104, '10x20', 'Basic Utility', 'longs', 75);
  stock(2107, '10x16', 'Classic Utility', 'salisbury', 28);
  stock(2108, '14x24', 'Classic Lofted Barn', 'statesboro', 96);
  stock(2109, '10x12', 'Silver Bullet', 'brunswick', 50);
  stock(2110, '12x16', 'Basic Studio', 'moncks-corner', 20);
  stock(2111, '10x20', 'Classic Utility', 'ravenel', 44);
  stock(2112, '10x12', 'Basic Utility', 'cottageville', 26);
  /* At a lot, sold, waiting for the trip to the customer's home. */
  order(2120, '12x16', 'Classic Utility', 'florence', 'Jamie Calloway', 'lot-home', 22);
  order(2121, '10x16', 'Basic Utility', 'statesboro', 'Reese Langford', 'lot-home', 16, { gate: 9, noGate: false, access: 'Tight access' });

  /* Yesterday: delivered to Lugoff. */
  const done = lgMakeLoad('haul', { type: 'plant', id: plant }, [stock(2090, '12x20', 'Classic Utility', 'lugoff', 120).id, stock(2091, '10x16', 'Basic Utility', 'lugoff', 110).id]);
  Object.assign(done, { rigId: 'rig-1', driver: 'Marcus Bell', date: lgAddDays(lgToday(), -1), window: 'Morning', state: 'delivered', sample: true, startedAt: hours(30), doneAt: hours(27) });
  done.stops[0].arrived = hours(28);
  lgDropDone(done.id, 0, { by: 'Lot staff (sample)', note: 'Good · no damage', photo: '' }, true);
  done.stops[0].done = hours(27);
  done.log = [{ at: hours(50), text: 'Load started' }, { at: hours(49), text: `Scheduled for ${lgDay(done.date)} · morning with Rig 1` }, { at: hours(30), text: 'Marcus Bell left ShedCor plant, Orangeburg' }, { at: hours(27), text: 'Unloaded at the Lugoff lot · received by Lot staff (sample) · Good · no damage' }, { at: hours(27), text: 'Every stop done' }];

  /* Today: on the road, first drop made. */
  const road = lgMakeLoad('haul', { type: 'plant', id: plant }, [stock(2094, '12x24', 'Elite Utility', 'graniteville', 70).id, stock(2095, '10x16', 'Basic Lofted Barn', 'west-union', 66).id]);
  Object.assign(road, { rigId: 'rig-2', driver: 'Dee Alvarez', date: lgToday(), window: 'Morning', state: 'in_transit', sample: true, startedAt: hours(3) });
  lgLoadUnits(road).forEach((u) => (u.at = 'road'));
  road.stops[0].arrived = hours(1.6);
  lgDropDone(road.id, 0, { by: 'Lot staff (sample)', note: 'Good · no damage', photo: '' }, true);
  road.stops[0].done = hours(1.3);
  road.log = [{ at: hours(26), text: 'Load started' }, { at: hours(25), text: `Scheduled for ${lgDay(road.date)} · morning with Rig 2` }, { at: hours(3), text: 'Dee Alvarez left ShedCor plant, Orangeburg' }, { at: hours(1.3), text: 'Unloaded at the Graniteville lot · received by Lot staff (sample) · Good · no damage' }];

  /* Scheduled: a full 40 ft trailer for two North Carolina lots, on the next day both are open. */
  const nc = lgMakeLoad('haul', { type: 'plant', id: plant }, [stock(2105, '12x32', 'Classic Lofted Barn', 'lexington', 60).id, stock(2106, '8x8', 'Basic Utility', 'mocksville', 58).id]);
  let day = lgAddDays(lgToday(), 1);
  while (!lotDay(lotById('lexington'), day).open || !lotDay(lotById('mocksville'), day).open) day = lgAddDays(day, 1);
  Object.assign(nc, { rigId: 'rig-5', driver: 'Sample Hauling Co.', date: day, window: 'Date only', state: 'scheduled', sample: true });
  nc.log = [{ at: hours(20), text: 'Load started' }, { at: hours(19), text: `Scheduled for ${lgDay(day)} with Hauler A` }];

  /* Being planned: a lot drop at Conway with a customer delivery in the same area. */
  const plan = lgMakeLoad('haul', { type: 'plant', id: plant }, [stock(2103, '12x20', 'Elite Utility', 'conway', 40).id, order(2122, '10x12', 'Basic Utility', 'conway', 'Jesse Tatum', 'plant-home', 12).id]);
  plan.sample = true;
  plan.log = [{ at: hours(2), text: 'Load started' }];

  /* A home delivery from the Lugoff lot, scheduled for the next day the lot is open. */
  const home = lgMakeLoad('home', { type: 'lot', id: 'lugoff' }, [order(2123, '10x12', 'Basic Utility', 'lugoff', 'Harper Dunmore', 'lot-home', 8, { confirmed: hours(5) }).id]);
  let hday = lgAddDays(lgToday(), 1);
  while (!lotDay(lotById('lugoff'), hday).open) hday = lgAddDays(hday, 1);
  Object.assign(home, { rigId: 'rig-4', driver: 'Nia Foster', date: hday, window: 'Afternoon', state: 'scheduled', sample: true });
  home.log = [{ at: hours(5), text: 'Delivery started' }, { at: hours(4), text: `Scheduled for ${lgDay(hday)} · afternoon with Rig 4` }];
})();
