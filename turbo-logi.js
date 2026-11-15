/* turbo-logi.js: what the Logistics side takes from Turbo Assist.

   Turbo Assist (bennett-buddy, read at commit b42d324) is the functionality authority: Turbo
   Logistics already has the notices, the manifest, the permit flag, split loads, carrier and rig
   records, map pins, a hauler's view and a service board. This file draws those on the screens
   logistics.js and logistics-screens.js already have. It only adds: no button, label, state or
   check from those files is renamed or removed. The one form it takes over is "Add a hauler",
   which keeps its name and fields and gains the rest of what Turbo Logistics keeps on a carrier.

   The owner's answers still win where they differ from the repo: free to 50 miles, $100 for 51
   to 100, and past 100 Logistics approves a fee; 14 ft and wider is a wide load; the dispatcher
   can override trailer fit; who tells the customer is the setting on the Trailers screen.

   Sample drivers, haulers, service jobs and customers are made up. No haul rate, cost or pay
   figure is here. Loaded last, after turbo.js. */

/* ---------- Turbo Logistics' own words ---------- */
const LGX = { viewAs: 'coordinator', jobs: [], jobSeq: 100, jobTab: 'review', srigs: [] };
/* ROUTE_STATE_LABELS and VALID_TRANSITIONS (logisticsRoutesShared.ts, routesStateService.ts). */
const LGX_STATE = { planned: 'Planned', scheduled: 'Scheduled', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled' };
const LGX_NEXT = { planned: ['scheduled', 'cancelled'], scheduled: ['in_transit', 'cancelled'], in_transit: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
/* ORIGIN_STOP_KIND_FILTER_LABELS: the three stop kinds a building's route uses. */
const LGX_STOP_KIND = { plant_origin: 'Plant', dealer_holding: 'Lot / dealer holding', end_customer: 'Customer site', service: 'Service', other: 'Other' };
/* scheduledForPicker.ts: where each kind of time sorts in the day. */
const LGX_WINDOW_AT = { 'Date only': 'sorts at 8:00 AM, the start of the day', Morning: 'sorts at 9:00 AM', Afternoon: 'sorts at 1:00 PM', 'Specific window': 'sorts at the start of the window', 'Specific time': 'sorts at that time' };
/* CARRIER_KIND_LABELS and what the carriers form says each one means. */
const LGX_CARRIER_KIND = { contracted: 'Contracted', freelance: 'Freelance', dealer_byo: 'Dealer BYO', in_house: 'In-house', other: 'Other' };
const LGX_CARRIER_MEANS = { contracted: 'an outside hauler, a standing partner', freelance: 'an outside hauler, hired per job', dealer_byo: 'the dealer hauls its own', in_house: 'company drivers, our fleet', other: 'anyone else' };
/* RIG_CAPACITY_UNIT_LABELS. Sheds use linear feet; the other units are for other trades. */
const LGX_UNIT = { linear_feet: 'linear feet', pounds: 'lb', kilograms: 'kg', cubic_feet: 'cu ft', cubic_meters: 'cu m', pallets: 'pallets', count: 'units', gallons: 'gal', liters: 'L' };
/* MAP_PIN_KIND_LABELS. */
const LGX_PIN = { in_transit: 'In transit', staged: 'Staged at dealer', delivered: 'Delivered', pickup: 'At pickup' };
/* Turbo Service (serviceShared.ts, seed_service_pilot.sql). */
const LGX_QUEUE = { repair: 'Repair', warranty: 'Warranty service', new_service: 'New service', internal_upgrade: 'Internal upgrade' };
const LGX_REQ = { pending: 'Pending', needs_info: 'Needs info', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled' };
const LGX_EVT = { unscheduled: 'Unscheduled', scheduled: 'Scheduled', in_progress: 'In progress', complete: 'Complete', cancelled: 'Cancelled' };
const LGX_CHECKIN = { none: 'No check-in', confirmed: 'Confirmed', day_before: 'Day before', en_route: 'En route', on_site: 'On site', complete: 'Complete' };
const LGX_CHECKIN_ORDER = ['confirmed', 'day_before', 'en_route', 'on_site', 'complete'];
const LGX_ORIGIN = { sales: 'Sales', opportunity: 'Opportunity', opportunity_subscriber: 'Subscriber opportunity', manufacturing_auto: 'Manufacturing auto', service_internal: 'Internal', personal_assistant: 'Personal Assistant' };
/* The knowledge base's usual time from the sale to delivery (article lead-times). */
const LGX_LEAD = { stock: { days: 14, words: 'in stock: 1 to 2 weeks' }, custom: { days: 28, words: 'custom order: 2 to 4 weeks' } };

/* ---------- Small helpers ---------- */
const lgxTip = (id, text) => (typeof taTip === 'function' ? taTip(id, text) : '');
const lgxTell = (n) => (typeof taNotify === 'function' ? taNotify(n) : null);
const lgxEditable = (load) => ['planned', 'scheduled'].includes(load.state);
const lgxDays = (isoA, isoB) => Math.round((new Date(isoA + 'T12:00:00') - new Date(isoB + 'T12:00:00')) / 864e5);
const lgxDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const lgxTime = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
/* The day and time of a load, the way a person says it: "Tue, Nov 17 · Morning". */
const lgxWhen = (load) => (load.date ? lgDay(load.date) + (load.window !== 'Date only' ? ' · ' + (load.windowNote || load.window) : '') : '');
/* Put extra HTML just before (or just after) a marker. A marker that is gone leaves the page whole. */
function lgxBefore(html, marker, extra) {
  const i = html.indexOf(marker);
  return i < 0 ? html + extra : html.slice(0, i) + extra + html.slice(i);
}
function lgxAfter(html, marker, extra) {
  const i = html.indexOf(marker);
  return i < 0 ? html + extra : html.slice(0, i + marker.length) + extra + html.slice(i + marker.length);
}
/* Add flags to the first flag row in a piece of HTML. */
function lgxIntoFlags(html, extra) {
  const i = html.indexOf('<div class="ops-flags">'), j = i < 0 ? -1 : html.indexOf('</div>', i);
  return !extra || j < 0 ? html : html.slice(0, j) + extra + html.slice(j);
}
/* A date that ends: "Nov 27, 2026 (in 12d)" or "(expired 5d ago)", as the carriers list words it
   (classifyExpiry, 30 days is "soon"). */
function lgxExpiry(iso) {
  if (!iso) return { kind: 'none', label: '' };
  const d = lgxDays(iso, lgToday()), shown = lgxDate(iso);
  if (d < 0) return { kind: 'expired', label: `${shown} (expired ${-d}d ago)` };
  if (d <= 30) return { kind: 'soon', label: `${shown} (in ${d}d)` };
  return { kind: 'ok', label: shown };
}
/* When a customer's building is usually delivered by, counted from the day of the sale. */
function lgxLead(u) {
  if (!u || u.kind !== 'order' || u.at === 'home') return null;
  const s = lgSale(u), sold = s ? Date.parse(s.submittedAt || '') : u.soldAt || u.site?.askedAt;
  if (!sold) return null;
  const rule = LGX_LEAD[(s ? s.path === 'lot' : u.inStock) ? 'stock' : 'custom'];
  const by = lgIso(new Date(sold + rule.days * 864e5)), late = lgToday() > by;
  return { by, late, rule, text: late ? `Late: usual delivery was by ${lgDay(by)} (${rule.words})` : `Usual delivery by ${lgDay(by)} (${rule.words})` };
}
/* 16 ft wide and wider is built on site: it never rides on a load (article size-limits). */
const lgxOnSite = (u) => !!u && u.wid >= 16;
const LGX_ONSITE_SAYS = '16 ft wide buildings are built on site. This one cannot ride on a load.';

/* ---------- Miles ----------
   Turbo Logistics measures a route with Google's Distance Matrix and falls back to straight-line
   miles (computeOrgRouteMileage). When it cannot measure, it says why; the same sentences here. */
function lgxMiles(load) {
  if (!load.stops.length) return { miles: null, reason: 'Add at least two stops with addresses to calculate miles.' };
  const lost = load.stops.some((x) => {
    if (lgStopIsLot(x)) return false;
    const site = lgSite(lgUnit(x.key.slice(5)));
    return !site || site.miles === '' || site.miles == null;
  });
  if (lost) return { miles: null, reason: 'One or more stop addresses could not be located on the map.' };
  return { miles: lgMiles(load).total, reason: null };
}
/* One trailer's miles for one day, worded as the dispatch board words it (formatRigDayMiles). */
function lgxRigDay(rigId, iso) {
  const loads = LG.loads.filter((l) => l.rigId === rigId && l.date === iso && l.state !== 'cancelled' && l.stops.length);
  let total = 0, skipped = 0;
  for (const l of loads) {
    const m = lgxMiles(l);
    if (m.miles == null) skipped++;
    else total += m.miles;
  }
  const today = iso === lgToday(), word = today ? 'Today' : lgDay(iso);
  const text = !loads.length ? '' : skipped === loads.length ? `${word}: miles not available` : `${word}${today ? '' : ':'} ${total.toFixed(1)} mi${skipped ? ` · ${skipped} unmeasured` : ''}`;
  return { loads, total, skipped, text };
}

/* ---------- Notices to the salesperson ----------
   Turbo Logistics tells the salesperson, in the app, each time a customer's delivery is scheduled,
   starts, finishes or changes its time (notifyRouteDeliveryStateTransition,
   notifyRouteDeliveryEtaUpdate). The titles and first sentences are its own. Its last sentence
   asks the salesperson to pass the news on; here that sentence follows who tells the customer:
   the lot's manager (Turbo's words), Logistics, or the automatic text and email. */
function lgxDeskNotice(u, kind, load, at) {
  if (u.kind !== 'order') return null;
  const s = lgSale(u), lot = lotById(u.lotId);
  if (!s && u.lotId !== DESK_LOT) return null; /* a sample customer of another lot is not this desk's */
  const unit = u.id, eta = lgxWhen(load), driver = (load.driver || '').trim();
  const who = LG.set.tell === 'auto' ? 'auto' : lot.managerSchedules ? 'manager' : 'logistics';
  const mid = (word) => (eta ? ` ${word}: ${eta}.` : '') + (driver ? ` Driver: ${driver}.` : '');
  const text = {
    scheduled: [`Delivery scheduled — ${unit}`, `A delivery for ${unit} has been scheduled.` + mid('Window') +
      { manager: ' Relay the schedule to your customer — do not expect an automatic customer text.', logistics: ' Logistics tells the customer the day.', auto: ' The customer got the day by text and email.' }[who]],
    in_transit: [`Delivery in transit — ${unit}`, `The truck for ${unit} is now in transit.` + mid('ETA') +
      (who === 'auto' ? ' The customer gets a text when the driver is on the way.' : ' Update your customer with the ETA when they ask.')],
    delivered: [`Delivery completed — ${unit}`, `Delivery for ${unit} is marked delivered. Confirm with your customer and close the loop on any remaining paperwork.`],
    eta: [`Delivery ETA updated — ${unit}`, `The delivery window for ${unit} changed to ${eta}.` + (driver ? ` Driver: ${driver}.` : '') +
      { manager: ' Relay the updated ETA to your customer.', logistics: ' Logistics tells the customer the new day.', auto: ' The customer got the new day by text and email.' }[who]],
    /* Only in this preview: the building reached the lot on the way to the customer. */
    lot: [`At the lot — ${unit}`, `${unit} is at the ${lot.town} lot${load.stops.find((x) => x.units.includes(u.id))?.proof?.by ? ', received by ' + load.stops.find((x) => x.units.includes(u.id)).proof.by : ''}. ${lgHold(u) ? lgHold(u) + '.' : 'It is ready for home delivery.'}`],
  }[kind];
  return lgxTell({ to: 'sales', kind: 'logistics_delivery_update', title: text[0], body: text[1], saleId: s?.id, serial: unit, go: s ? `openSale('${s.id}')` : '', ...(at ? { at } : {}) });
}
{
  const baseSchedule = lgSchedule;
  lgSchedule = function (id) {
    const load = lgLoad(id), was = load?.state;
    baseSchedule(id);
    if (load && was !== 'scheduled' && load.state === 'scheduled') lgLoadUnits(load).filter((u) => u.leg !== 'plant-lot').forEach((u) => lgxDeskNotice(u, 'scheduled', load));
  };
  const baseStart = lgStart;
  lgStart = function (id) {
    const load = lgLoad(id), was = load?.state;
    baseStart(id);
    if (load && was !== 'in_transit' && load.state === 'in_transit') lgLoadUnits(load).filter((u) => u.leg !== 'plant-lot').forEach((u) => lgxDeskNotice(u, 'in_transit', load));
  };
  /* A stop is finished. production.js already wraps this; this wraps that. */
  const baseDone = lgDropDone;
  lgDropDone = function (id, i, proof, quiet) {
    const load = lgLoad(id), stop = load?.stops[i], isLot = stop && lgStopIsLot(stop), units = stop ? lgStopUnits(stop) : [];
    baseDone(id, i, proof, quiet);
    if (!stop || quiet) return;
    units.filter((u) => u.kind === 'order').forEach((u) => lgxDeskNotice(u, isLot ? 'lot' : 'delivered', load));
    const next = load.stops.find((x) => !x.done), where = isLot ? `the ${lgStopLot(stop).town} lot` : units[0].customer;
    lgxTell({ to: 'logi', title: `${isLot ? 'Unloaded at' : 'Delivered to'} ${where} — ${lgLoadName(load)}`, serial: units[0].id,
      body: `${load.driver || 'The driver'} finished stop ${i + 1} of ${load.stops.length}: ${lgPlural(units.length, 'building')}, ${isLot ? 'received' : 'signed'} by ${proof?.by || 'the customer'}. ${next ? 'Next: ' + (lgStopIsLot(next) ? 'the ' + lgStopLot(next).town + ' lot' : lgStopUnits(next)[0].customer) + '.' : 'Every stop is done.'}`, go: `lgOpen('${load.id}')` });
  };
  /* The day or time of a scheduled load changes: the ETA notice goes out, and a new day has to
     reach the customer again. */
  const baseSet = lgSet;
  lgSet = function (loadId, key, value) {
    const load = lgLoad(loadId), watch = load && ['scheduled', 'in_transit'].includes(load.state) && ['date', 'window', 'windowNote'].includes(key), before = watch ? lgxWhen(load) : null, day = load?.date;
    baseSet(loadId, key, value);
    if (!watch || !load.date || lgxWhen(load) === before) return;
    lgNote(load, `Time changed to ${lgxWhen(load)}`);
    for (const u of lgLoadUnits(load).filter((x) => x.leg !== 'plant-lot')) {
      const s = lgSale(u), auto = LG.set.tell === 'auto';
      if (load.date !== day) {
        if (auto) {
          u.msgAuto = true;
          (u.msgs ||= {}).set = Date.now();
          u.told = { how: 'auto', at: Date.now() };
        } else u.told = null;
        if (s) {
          s.deliverOn = load.date;
          s.toldCustomer = auto;
          ofLog(s, `Logistics: delivery moved to ${lgDay(load.date)}${auto ? ' · the customer got a text and an email' : ' · the customer has to be told the new day'}`);
        }
      }
      lgxDeskNotice(u, 'eta', load);
    }
    render();
  };
}
/* The Logistics bell hears when a building lands on the board. Only in this preview: Turbo
   Logistics shows it in the queue without a notice. The sentence for a released order is the one
   Turbo Ops writes on the deal's timeline. */
{
  lgSync(); /* what is already finished goes on the board first, without a notice */
  const baseSync = lgSync;
  lgSync = function () {
    const had = new Set(LG.units.map((u) => u.id));
    baseSync();
    for (const u of LG.units) {
      if (had.has(u.id) || typeof TA === 'undefined') continue;
      const told = TA.notices.some((n) => n.to === 'logi' && Date.now() - n.at < 60000 && (n.saleId === u.id || n.serial === u.id || `${n.title} ${n.body}`.includes(u.id)));
      if (told) continue; /* another side already said so */
      if (u.saleId) lgxTell({ to: 'logi', title: `Ready to deliver — ${u.id}`, body: `Marked ready to deliver. Logistics can pick up this deal when the building is finished. ${u.name} for ${u.customer}, ${u.leg === 'lot-home' ? 'at the ' + lotById(u.lotId).town + ' lot' : u.leg === 'plant-home' ? 'plant to home' : 'through the ' + lotById(u.lotId).town + ' lot'}.`, saleId: u.id, serial: u.id, go: `lgOpenSale('${u.id}')` });
      else lgxTell({ to: 'logi', title: `Ready to load — ${u.id}`, body: `Plant QC signed off ${u.name}. It is in the yard, ready to load for the ${lotById(u.lotId).town} lot.`, serial: u.id, go: `LG.q='${u.id}';LG.tile='all';go('logi')` });
    }
  };
}

/* ---------- Checks from the knowledge base and the carrier's record ---------- */
{
  const baseChecks = lgChecks;
  lgChecks = function (load) {
    const out = baseChecks(load), units = lgLoadUnits(load), rig = lgRig(load.rigId), car = rig && lgCarrier(rig.carrierId), open = lgxEditable(load);
    const add = (level, text) => out.push({ level, text, lgx: true });
    for (const u of units) {
      const size = `${u.wid} × ${u.len}`;
      if (lgxOnSite(u)) add('stop', `${size} ${u.customer ? 'for ' + u.customer : u.id}: 16 ft wide buildings are built on site. Take it off the load.`);
      else if (u.len > 40) add('warn', `${size}: longer than 40 ft. The largest building delivered is 14 × 40; a bigger one is built on site unless ownership approves the haul.`);
    }
    if (load.permitReq && !load.permit && !units.some(lgWide)) add('warn', 'Permit required is flagged: confirm the permit, then tick “Permit confirmed”.');
    if (car && open) {
      const on = load.date || lgToday();
      if (car.active === false) add('warn', `${car.name} is marked inactive. Turbo Logistics leaves an inactive carrier out of the picker.`);
      if (car.insuranceEnds && on > car.insuranceEnds) add('warn', `${car.name}: the insurance on file ended ${lgDay(car.insuranceEnds)}${load.date ? ', before this run' : ''}.`);
      if (car.contractEnds && on > car.contractEnds) add('warn', `${car.name}: the contract on file ended ${lgDay(car.contractEnds)}${load.date ? ', before this run' : ''}.`);
    }
    if (open)
      for (const u of units) {
        const lead = lgxLead(u);
        if (lead?.late) add('warn', `${u.customer}: past the usual delivery time (${lead.rule.words}). It was due by ${lgDay(lead.by)}.`);
      }
    return out;
  };
  /* A 16 ft wide building is refused wherever a building joins a load. */
  const basePick = lgTogglePick;
  lgTogglePick = function (id, on) {
    if (on && lgxOnSite(lgUnit(id))) return toast(LGX_ONSITE_SAYS), render();
    basePick(id, on);
  };
  const baseAdd = lgAdd;
  lgAdd = function (loadId, unitId) {
    if (lgxOnSite(lgUnit(unitId))) return toast(LGX_ONSITE_SAYS);
    baseAdd(loadId, unitId);
  };
  const baseHome = lgNewHome;
  lgNewHome = function (unitId) {
    if (lgxOnSite(lgUnit(unitId))) return toast(LGX_ONSITE_SAYS);
    baseHome(unitId);
  };
  const basePut = lgPut;
  lgPut = function (load, unitId, quiet) {
    if (lgxOnSite(lgUnit(unitId))) return;
    basePut(load, unitId, quiet);
  };
}

/* ---------- Manifest ----------
   One manifest per building, line for line the way Turbo Logistics prints a route
   (manifestSnapshotToTextLines). It emails it to a hauler who has no login
   (emailLogisticsRouteManifest); here nothing is sent. */
function lgxManifestLines(load, u) {
  const rig = lgRig(load.rigId), car = rig && lgCarrier(rig.carrierId), units = lgLoadUnits(load), origin = lgOrigin(load), stop = load.stops.find((x) => x.units.includes(u.id));
  const permits = [...(load.permitReq || lgWide(u) ? ['permit required'] : []), ...(load.permitNotes ? [load.permitNotes] : [])];
  const notes = [load.over ? `Trailer length overridden: ${load.over.reason}` : '', load.splitFrom ? `Split from ${load.splitFrom}${load.splitReason ? ': ' + load.splitReason : ''}` : ''].filter(Boolean).join(' · ');
  const lines = ['DELIVERY ROUTE MANIFEST', `Generated: ${new Date().toISOString()}`, `Route: ${load.id} · building ${units.indexOf(u) + 1} of ${units.length}`, `Unit: ${u.id}`, `State: ${load.state}`];
  if (car) lines.push(`Carrier: ${car.name}`);
  if (load.date) lines.push(`Scheduled: ${lgxWhen(load)}`);
  if (load.driver) lines.push(`Driver: ${load.driver}`);
  if (rig) lines.push(`Rig: ${rig.name}`);
  lines.push(`Capacity: ${u.len} linear ft`);
  if (permits.length) lines.push(`Permits: ${permits.join('; ')}`);
  if (notes) lines.push(`Route notes: ${notes}`);
  lines.push('', 'STOPS (in order):');
  const stops = [load.from.type === 'plant' ? { kind: 'plant_origin', address: placeAddress(origin) } : { kind: 'dealer_holding', address: placeAddress(origin), contact: dealerName(origin), phone: origin.phone }];
  if (stop && lgStopIsLot(stop)) {
    const lot = lgStopLot(stop);
    stops.push({ kind: 'dealer_holding', address: placeAddress(lot), contact: dealerName(lot), phone: lot.phone });
  } else if (stop) {
    const s = lgSale(u), st = s ? orderInvoice(s).shipTo : null, site = lgSite(u);
    stops.push({ kind: 'end_customer', address: st ? [st.street, st.city].filter(Boolean).join(', ') : '', contact: u.customer, phone: st?.phone || '', window: load.window !== 'Date only' ? load.windowNote || load.window : '',
      notes: site ? [site.access, site.noGate ? 'no gate' : site.gate ? site.gate + ' ft opening' : '', site.ground, site.notes].filter(Boolean).join(' · ') : '' });
  }
  stops.forEach((x, i) => {
    lines.push(`${i + 1}. ${x.kind.replace(/_/g, ' ')} — ${x.address || 'Address on file'}`);
    if (x.contact) lines.push(`   Contact: ${x.contact}`);
    if (x.phone) lines.push(`   Phone: ${x.phone}`);
    if (x.window) lines.push(`   Window: ${x.window}`);
    if (x.notes) lines.push(`   Notes: ${x.notes}`);
  });
  return lines;
}
const lgxManifestText = (load) => lgLoadUnits(load).map((u) => lgxManifestLines(load, u).join('\n')).join('\n\n' + '-'.repeat(44) + '\n\n');
function lgxManifest(id) {
  const load = lgLoad(id), n = lgLoadUnits(load).length;
  modal(`Manifest · ${lgLoadName(load)}`, `<p class="source">${n === 1 ? 'One manifest' : 'One manifest for each of the ' + n + ' buildings'}, in the layout Turbo Logistics prints for a hauler. A stop with no address on record prints “Address on file”.</p>
    <pre class="lgx-manifest" id="lgx-manifest">${esc(lgxManifestText(load))}</pre>
    <div class="actions">${button('Print', `lgxManifestPrint('${id}')`, 'secondary')}${button('Email manifest', `lgxManifestEmail('${id}')`, 'secondary')}${button('Close', 'closeModal()', 'secondary')}</div>`);
  $('.modal')?.classList.add('wide');
}
/* Printing: the page prints only the manifest, then comes back. */
function lgxManifestPrint(id) {
  let box = $('#lgx-print');
  if (!box) document.body.insertAdjacentHTML('beforeend', '<pre id="lgx-print"></pre>'), (box = $('#lgx-print'));
  box.textContent = lgxManifestText(lgLoad(id));
  document.body.classList.add('lgx-printing');
  const done = () => document.body.classList.remove('lgx-printing');
  addEventListener('afterprint', done, { once: true });
  setTimeout(done, 60000);
  print();
}
function lgxManifestEmail(id) {
  const load = lgLoad(id), car = lgCarrier(lgRig(load.rigId)?.carrierId);
  modal('Email route manifest', `<p>Sends a PDF snapshot (stops, contacts, notes) to the hauler. Paper-trail fallback when they won’t use a login.</p>
    <label class="field">Hauler email<input id="lgx-mail" type="email" maxlength="80" autocomplete="off" placeholder="dispatcher@hauler.example" value="${esc(car?.email || '')}"></label>
    <p class="source">Preview only: nothing is sent, and the made-up haulers here have made-up addresses.</p>
    <div class="actions">${button('Send email', `lgxManifestSend('${id}')`)}${button('Back to the manifest', `lgxManifest('${id}')`, 'secondary')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgxManifestSend(id) {
  const to = $('#lgx-mail').value.trim(), load = lgLoad(id);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return toast('Type a valid email address.');
  lgNote(load, `Manifest emailed to ${to} (preview: nothing is sent)`);
  closeModal();
  render();
  toast(`Manifest emailed to ${to}. Preview: nothing is sent.`);
}

/* ---------- Permit ----------
   Turbo Logistics keeps one manual flag on a route, "Permit required" (LogisticsRoutePermitControl),
   and free-text permit notes on the unit. This sits beside the wide-load tick that was already here. */
function lgxPermit(id, on) {
  const load = lgLoad(id);
  load.permitReq = !!on;
  lgNote(load, on ? 'Permit required flagged' : 'Permit flag cleared');
  render();
}
function lgxPermitNotes(id, text) {
  const load = lgLoad(id);
  load.permitNotes = text.trim();
  if (load.permitNotes) lgNote(load, `Permit notes: ${load.permitNotes}`);
  render();
}

/* ---------- Split a load ----------
   Turbo Logistics breaks a finished building out of load AC into AC-L1, then AC-L2, so the rest
   of AC ships later (splitUnitFromShipment, nextLogisticsSplitCode). */
const lgxOrigin = (load) => load.origin || load.id;
const lgxCanSplit = (load) => load.kind === 'haul' && load.state === 'planned' && lgLoadUnits(load).length > 1 && /^[A-Z]{1,2}(-L[1-9][0-9]*)?$/.test(load.id);
function lgxNextSplit(origin) {
  const used = new Set(LG.loads.map((l) => /^([A-Z]{1,2})-L([1-9][0-9]*)$/.exec(l.id)).filter((m) => m && m[1] === origin).map((m) => Number(m[2])));
  let n = 1;
  while (used.has(n)) n++;
  return `${origin}-L${n}`;
}
function lgxSplitForm(id) {
  const load = lgLoad(id), code = lgxNextSplit(lgxOrigin(load));
  modal(`Break out of load ${esc(load.id)}`, `<p>Tick the buildings that should go now. They move to a new load, <strong>${code}</strong>, and the rest of ${esc(load.id)} ships later.</p>
    <div class="lgx-split">${lgLoadUnits(load).map((u) => `<label class="checkrow"><input type="checkbox" value="${esc(u.id)}"> <span><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · to ${esc(lgDest(u))} <span class="serial">${esc(u.id)}</span></span></label>`).join('')}</div>
    <label class="field">Reason<input id="lgx-split-reason" maxlength="100" placeholder="Customer ready / finished early"></label>
    <div class="actions">${button(`Split to ${code}`, `lgxSplit('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgxSplit(id) {
  const load = lgLoad(id), ids = [...document.querySelectorAll('.lgx-split input:checked')].map((x) => x.value), reason = $('#lgx-split-reason').value.trim();
  if (!ids.length) return toast('Tick the buildings to break out.');
  if (ids.length >= lgLoadUnits(load).length) return toast('Leave at least one building on this load.');
  const code = lgxNextSplit(lgxOrigin(load)), line = `Broke out of ${load.id} into ${code}.`, moved = ids.map(lgUnit);
  load.over = null;
  ids.forEach((u) => lgTake(load, u));
  const next = { id: code, kind: 'haul', from: { ...load.from }, rigId: null, driver: '', date: '', window: 'Date only', windowNote: '', state: 'planned', stops: [], permit: false, log: [], made: Date.now(),
    origin: lgxOrigin(load), splitFrom: load.id, splitReason: reason, sample: load.sample, prod: load.prod };
  LG.loads.push(next);
  ids.forEach((u) => lgPut(next, u, true));
  lgOrderStops(next);
  lgNote(load, line + (reason ? ' ' + reason : ''));
  lgNote(next, line + (reason ? ' ' + reason : ''));
  for (const u of moved) {
    const s = lgSale(u);
    if (s) ofLog(s, 'Logistics: ' + line);
  }
  closeModal();
  render();
  toast(line);
}

/* ---------- One building, one stop, one load row ---------- */
{
  const baseUnitRow = lgUnitRow;
  lgUnitRow = function (u, mode) {
    let html = baseUnitRow(u, mode);
    const lead = lgxLead(u), job = LGX.jobs.find((j) => j.buildOnSite && j.serial === u.id && !['complete', 'cancelled'].includes(j.status));
    html = lgxIntoFlags(html, [
      lgxOnSite(u) ? '<span class="ops-flag bad">Built on site · no trailer load</span>' : u.len > 40 ? '<span class="ops-flag todo">Longer than 40 ft</span>' : '',
      lead ? `<span class="ops-flag ${lead.late ? 'bad' : ''}">${esc(lead.late ? `Late · usual delivery was by ${lgDay(lead.by)}` : `Usual delivery by ${lgDay(lead.by)}`)}</span>` : '',
      job ? `<span class="ops-flag wait">Build crew job ${esc(job.id)}</span>` : '',
    ].join(''));
    if (lgxOnSite(u) && !job) html = lgxAfter(html, '<div class="ops-rowacts">', `<button type="button" class="secondary small" onclick="lgxBuildJob('${u.id}')">Add a build crew job</button>`);
    return html;
  };
  const baseLoadRow = lgLoadRow;
  lgLoadRow = function (load) {
    let html = baseLoadRow(load);
    if (load.id.length > 3) html = html.replace('class="lg-code', () => 'class="lg-code lgx-long');
    const splits = LG.loads.filter((l) => l.splitFrom === load.id);
    return lgxIntoFlags(html, [
      load.splitFrom ? `<span class="ops-flag">Split from ${esc(load.splitFrom)}${load.splitReason ? ' · ' + esc(load.splitReason) : ''}</span>` : '',
      splits.length ? `<span class="ops-flag">Split off: ${splits.map((l) => esc(l.id)).join(', ')}</span>` : '',
      load.permitReq ? '<span class="ops-flag todo">Permit required</span>' : '',
    ].join(''));
  };
  /* A stop on the load page and on the driver's day: its kind, its proof and its stamps. */
  const baseStop = lgStopCard;
  lgStopCard = function (load, i, big) {
    const stop = load.stops[i], isLot = lgStopIsLot(stop), u = lgStopUnits(stop)[0], lead = !isLot && !stop.done ? lgxLead(u) : null;
    const kind = LGX_STOP_KIND[isLot ? 'dealer_holding' : 'end_customer'];
    const lines = `<small class="lgx-kind">${kind} · ${stop.done ? `arrived ${lgxTime(stop.arrived)}, departed ${lgxTime(stop.done)} · proof on file` : 'proof here: the FastField delivery form'}</small>${lead && !big ? `<small class="${lead.late ? 'lg-bad' : ''}">${esc(lead.text)}</small>` : ''}`;
    return lgxBefore(baseStop(load, i, big), '<ul class="lg-stopunits">', lines);
  };
}
/* A 16 ft wide building goes to the crew that builds on site, as a service job. Only in this preview. */
function lgxBuildJob(unitId) {
  const u = lgUnit(unitId);
  const job = taServiceAdd({ title: `Build on site — ${u.name}${u.customer ? ' for ' + u.customer : ''}`, serial: u.id, kind: 'service', from: 'logistics', saleId: u.saleId });
  job.buildOnSite = true;
  render();
  toast(`${job.id} added to Service jobs.`);
}

/* ---------- The load page: manifest, permit and record ---------- */
function lgxRules() {
  return `<details class="lgx-rules"><summary>Delivery rules from the knowledge base</summary><ul>
    <li>The largest building delivered is 14 × 40. 16 ft wide is built on site only. 14 ft wide can be delivered and needs a permit, so it is ordered for a customer and not stocked. ${lgxTip('size-limits', 'Size limits')}</li>
    <li>What stops a delivery: narrow streets or gates, low trees or power lines, tight turns, soft or wet yards, septic or sprinkler lines. Concrete is best, gravel is fine, soft ground after rain is a risk. ${lgxTip('size-limits', 'Site access')}</li>
    <li>Blocking: about 2 in. at the highest point of the ground, never more than 16 in. there. The crew levels with block and does not regrade. Extra blocking is quoted and paid before delivery. ${lgxTip('set-height', 'Blocking')}</li>
    <li>Anchors are not included. They are priced separately and can be set on a return trip; a trip fee may apply. ${lgxTip('wind-anchors', 'Anchors')} ${lgxTip('anchors', 'Anchor price')}</li>
    <li>A delivery tried against the driver’s advice that cannot be finished can carry a redelivery fee, and the customer pays for recovery and yard repair. ${lgxTip('size-limits', 'Who pays')}</li>
    <li>Usual time from the sale to delivery: in stock 1 to 2 weeks, custom order 2 to 4 weeks. ${lgxTip('lead-times', 'Lead times')}</li>
    <li>Delivery fee here: free to ${FREE_DELIVERY_MILES} miles, ${money(OF.set.overFee)} for ${FREE_DELIVERY_MILES + 1} to ${OF.set.overTo}, and past ${OF.set.overTo} Logistics approves the fee. The lead-times article says $100 for 50 to 60 miles and manager approval past 60; this preview keeps the rule the owner set.</li></ul></details>`;
}
function lgxLoadPanel(load) {
  const id = load.id, open = lgxEditable(load), units = lgLoadUnits(load), rig = lgRig(load.rigId), car = rig && lgCarrier(rig.carrierId), wide = units.some(lgWide);
  const next = LGX_NEXT[load.state].map((k) => LGX_STATE[k]), m = lgxMiles(load), day = rig && load.date ? lgxRigDay(rig.id, load.date) : null, splits = LG.loads.filter((l) => l.splitFrom === id);
  const fromPlant = load.from.type === 'plant';
  const stopRows = [`<li><b>${LGX_STOP_KIND[fromPlant ? 'plant_origin' : 'dealer_holding']}</b> ${esc(lgOriginName(load))}<small>${fromPlant ? 'Start of the run. No one has to receive here.' : 'Start of the run. The lot is on record.'}</small></li>`,
    ...load.stops.map((stop) => {
      const isLot = lgStopIsLot(stop), u = lgStopUnits(stop)[0], s = isLot ? null : lgSale(u), has = isLot || (s && orderInvoice(s).shipTo.phone);
      return `<li><b>${LGX_STOP_KIND[isLot ? 'dealer_holding' : 'end_customer']}</b> ${isLot ? esc(lgStopLot(stop).town) + ' lot' : esc(u.customer)}<small>${isLot ? 'Needs the lot that receives it: on record.' : has ? 'Needs the customer’s contact: on record.' : 'Needs the customer’s contact: a sample customer has none.'} Proof: ${stop.done ? 'captured ' + lgStamp(stop.done) : 'awaiting the FastField form'}.</small></li>`;
    })].join('');
  const permit = `<h3>Permit</h3><div class="lgx-permit">${load.permitReq ? '<span class="lgx-badge">Permit required</span>' : ''}${open ? `<button type="button" class="secondary small" onclick="lgxPermit('${id}',${!load.permitReq})">${load.permitReq ? 'Clear permit flag' : 'Flag permit required'}</button>` : ''}${!load.permitReq && !open ? '<span class="of-soft">Not flagged.</span>' : ''}</div>
    ${load.permitReq ? `<label class="field">Permit notes<input maxlength="100" ${open ? '' : 'disabled'} value="${esc(load.permitNotes || '')}" placeholder="Example: SC oversize permit, escort from the state line" onchange="lgxPermitNotes('${id}',this.value)"></label>` : ''}
    ${load.permitReq && !wide ? `<label class="checkrow lg-permit"><input type="checkbox" ${load.permit ? 'checked' : ''} ${open ? '' : 'disabled'} onchange="lgSet('${id}','permit',this.checked)"> Permit confirmed</label>` : ''}
    <p class="source">${wide ? `This load has a building ${LG.set.wideFt} ft wide or wider, the permit case. ` : ''}The flag and the notes print on the manifest. ${lgxTip('size-limits', '14 ft wide and permits')}</p>`;
  const miles = `<h3>Miles</h3><p>${m.miles == null ? esc(m.reason) : `<span class="lgx-pill">${m.miles.toFixed(1)} mi (estimate)</span> to the last stop.`}${day?.text ? ` ${esc(rig.name)}: <b>${esc(day.text)}</b>${day.loads.length > 1 ? ` across ${day.loads.length} loads` : ''}.` : ''}</p>
    <p class="source">Turbo Logistics measures driving miles with Google’s Distance Matrix and falls back to straight-line miles; it totals each trailer’s day on the dispatch board.</p>`;
  const carrier = car ? `<h3>Who hauls it</h3><p><b>${esc(car.name)}</b> · ${LGX_CARRIER_KIND[car.kind] || esc(car.kind)}${LGX_CARRIER_MEANS[car.kind] ? ', ' + LGX_CARRIER_MEANS[car.kind] : ''}${car.areas?.length ? ` · covers ${esc(car.areas.join(', '))}` : ''}</p>${lgxCarrierDates(car)}` : '';
  const quality = units.map((u) => (typeof taSerialStatus === 'function' ? taSerialStatus(u.id) : null)).map((r, i) => (r && r.found ? `<li><span class="serial">${esc(units[i].id)}</span> ${esc(r.text)}</li>` : '')).join('');
  return `<section class="panel lgx-record"><div class="panelhead"><h2>Manifest, permit and record</h2><span class="pill">${LGX_STATE[load.state]}</span></div>
    <div class="actions lgx-acts">${units.length ? `<button type="button" class="secondary small" onclick="lgxManifest('${id}')">${icon('receipt', 16)} Manifest</button>` : ''}${lgxCanSplit(load) ? `<button type="button" class="secondary small" onclick="lgxSplitForm('${id}')">${icon('rotate', 16)} Break out buildings</button>` : ''}</div>
    <p>Turbo Logistics records this load as <b>${LGX_STATE[load.state]}</b>. ${next.length ? `From here it can become ${next.join(' or ')}.` : 'That is final: a delivered or cancelled load is not reopened.'}${['scheduled', 'in_transit'].includes(load.state) ? ' It cannot go back to Planned yet.' : ''}</p>
    ${load.splitFrom ? `<p>Split from <button type="button" class="link inline" onclick="lgOpen('${esc(load.splitFrom)}')">load ${esc(load.splitFrom)}</button>${load.splitReason ? ': ' + esc(load.splitReason) : ''}.</p>` : ''}
    ${splits.length ? `<p>Split off from this load: ${splits.map((l) => `<button type="button" class="link inline" onclick="lgOpen('${esc(l.id)}')">${esc(l.id)}</button>`).join(', ')}.</p>` : ''}
    ${load.date ? `<p class="source">Time: ${esc(load.windowNote || load.window)}, which ${LGX_WINDOW_AT[load.window]} on the day’s list.</p>` : ''}
    ${permit}${miles}${carrier}
    <h3>Stops as Turbo Logistics records them</h3><ol class="lgx-stops">${stopRows}</ol>
    ${quality ? `<h3>Plant QC</h3><ul class="lgx-qc">${quality}</ul>` : ''}
    ${lgxRules()}</section>`;
}
function lgxCarrierDates(car) {
  const row = (name, iso) => {
    const x = lgxExpiry(iso);
    return x.kind === 'none' ? '' : `<span class="ops-flag ${x.kind === 'expired' ? 'bad' : x.kind === 'soon' ? 'todo' : ''}">${name}: ${esc(x.label)}</span>`;
  };
  const flags = row('Insurance', car.insuranceEnds) + row('Contract', car.contractEnds) + (car.active === false ? '<span class="ops-flag bad">Inactive</span>' : '');
  return flags ? `<div class="ops-flags">${flags}</div>` : '';
}
{
  const basePage = lgLoadPage;
  lgLoadPage = function () {
    const html = basePage(), load = lgLoad(LG.loadId);
    return load ? lgxBefore(html, '<section class="panel"><h2>History</h2>', lgxLoadPanel(load)) : html;
  };
}

/* ---------- Dispatch board ---------- */
{
  const baseBoard = lgBoard;
  lgBoard = function () {
    const open = LGX.jobs.filter((j) => !['complete', 'cancelled'].includes(j.status || '') && !['declined', 'cancelled'].includes(j.request)).length;
    const today = LG.rigs.map((r) => ({ r, d: lgxRigDay(r.id, lgToday()) })).filter((x) => x.d.text);
    const late = LG.units.filter((u) => u.leg && lgxLead(u)?.late).length;
    return lgxBefore(baseBoard(), '<div id="lg-list">', `<div class="lgx-strip"><button type="button" class="chipbtn" onclick="go('lg-service')">${icon('build', 16)} Service jobs <span class="count">${open}</span></button>
      ${late ? `<span class="ops-flag bad">${lgPlural(late, 'customer building')} past the usual delivery time</span>` : ''}
      ${today.map((x) => `<span class="ops-flag">${esc(x.r.name)}: ${esc(x.d.text)}</span>`).join('')}</div>`);
  };
}

/* ---------- Every load: who can see what ----------
   Three sign-ins in Turbo Logistics: the coordinator sees everything, a driver sees the driver
   screen only, and an outside hauler sees its own carrier's routes, view only. */
function lgxHaulerView(car) {
  const rigs = LG.rigs.filter((r) => r.carrierId === car.id).map((r) => r.id);
  const loads = LG.loads.filter((l) => rigs.includes(l.rigId) && ['planned', 'scheduled', 'in_transit'].includes(l.state)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const stopLine = (n, kind, address, extra = '') => `<li><small>Stop ${n} · ${kind.replace(/_/g, ' ')}</small><span>${esc(address || 'Address on file')}</span>${extra}</li>`;
  const one = (load) => {
    const origin = lgOrigin(load), fromPlant = load.from.type === 'plant';
    return `<section class="panel lgx-hauler"><div class="panelhead"><h2>${esc(lgLoadUnits(load).map((u) => u.id).join(', '))} · ${load.date ? esc(lgxWhen(load)) : 'Unscheduled'}</h2><span class="pill">${load.state.replace(/_/g, ' ')}</span></div>
      <ol>${stopLine(1, fromPlant ? 'plant_origin' : 'dealer_holding', placeAddress(origin), `<a class="chipbtn" target="_blank" rel="noopener" href="${lgMapLink(placeAddress(origin))}">${icon('pin', 14)} Maps</a>`)}
      ${load.stops.map((stop, i) => {
        const isLot = lgStopIsLot(stop), lot = lgStopLot(stop), u = lgStopUnits(stop)[0], s = isLot ? null : lgSale(u), st = s ? orderInvoice(s).shipTo : null, addr = isLot ? placeAddress(lot) : st ? [st.street, st.city].filter(Boolean).join(', ') : '';
        return stopLine(i + 2, isLot ? 'dealer_holding' : 'end_customer', addr, `<em>${isLot ? esc(dealerName(lot)) : esc(u.customer)}</em>${addr ? `<a class="chipbtn" target="_blank" rel="noopener" href="${lgMapLink(addr)}">${icon('pin', 14)} Maps</a>` : ''}${isLot ? `<a class="chipbtn" href="tel:${lot.phone.replace(/\D/g, '')}">${icon('phone', 14)} Call</a>` : ''}`);
      }).join('')}</ol></section>`;
  };
  return loads.map(one).join('') || `<div class="panel emptystate"><strong>No active routes assigned to ${esc(car.name)}.</strong><p>A load shows here once it rides on one of this hauler’s trailers.</p></div>`;
}
function lgxViewBar() {
  const outside = LG.carriers.filter((c) => ['contracted', 'freelance'].includes(c.kind));
  return `<div class="lgx-viewas"><label>View as<select onchange="LGX.viewAs=this.value;render()">
    <option value="coordinator" ${LGX.viewAs === 'coordinator' ? 'selected' : ''}>Logistics coordinator · sees every load</option>
    ${outside.map((c) => `<option value="hauler:${c.id}" ${LGX.viewAs === 'hauler:' + c.id ? 'selected' : ''}>Outside hauler · ${esc(c.name)} · view only</option>`).join('')}
    <option value="driver" ${LGX.viewAs === 'driver' ? 'selected' : ''}>Driver · sees the driver’s day only</option></select></label>
    <small>${LGX.viewAs === 'coordinator' ? 'The coordinator plans, schedules and changes every load.' : LGX.viewAs === 'driver' ? 'A driver signs in to the driver’s screen and nothing else.' : 'View-only · your carrier scope'}</small></div>`;
}
{
  const baseLoads = lgLoads;
  lgLoads = function () {
    const car = LGX.viewAs.startsWith('hauler:') ? lgCarrier(LGX.viewAs.slice(7)) : null;
    if (car) return `${head('Logistics · hauler’s view', esc(car.name.replace(/\.$/, '')) + '.', 'What an outside hauler sees when it signs in: only the loads on its own trailers, and nothing it can change.')}${lgxViewBar()}${lgxHaulerView(car)}${opsNotes([], [])}`;
    if (LGX.viewAs === 'driver') {
      const busy = LG.rigs.filter((r) => LG.loads.some((l) => l.rigId === r.id && ['scheduled', 'in_transit'].includes(l.state)));
      return `${head('Logistics · driver’s view', 'A driver sees the driver’s day.', 'No list of every load, no trailers, no map of the lots: today’s stops, in order.')}${lgxViewBar()}
        <div class="panel"><p>Pick a driver to see that day.</p><div class="actions">${busy.map((r) => `<button type="button" class="secondary small" onclick="LG.rig='${r.id}';go('lg-drive')">${esc(r.name)}${r.driver && r.driver !== r.name ? ' · ' + esc(r.driver) : ''}</button>`).join('') || '<span class="of-soft">No run is scheduled.</span>'}</div></div>${opsNotes([], [])}`;
    }
    return lgxBefore(baseLoads(), '<div class="chiprow ops-tabs">', lgxViewBar());
  };
}

/* ---------- Calendar: the count for each day ---------- */
{
  const baseCal = lgCalendar;
  lgCalendar = function () {
    const days = Array.from({ length: 7 }, (_, i) => lgAddDays(lgToday(), LG.week * 7 + i));
    let k = 0;
    return baseCal().replace(/<div class="lg-dayhead">.*?<\/div>/g, (m) => {
      /* Turbo Logistics counts routes, one per building: a building already dropped from a load
         that is still on the road counts as delivered. */
      const iso = days[k++], n = { scheduled: 0, in_transit: 0, delivered: 0 };
      let routes = 0;
      for (const l of iso ? LG.loads.filter((x) => x.date === iso && x.state !== 'cancelled') : [])
        for (const stop of l.stops) {
          const state = l.state === 'in_transit' && stop.done ? 'delivered' : l.state;
          routes += stop.units.length;
          if (state in n) n[state] += stop.units.length;
        }
      return m + `<div class="lgx-daycount"><span>Scheduled: ${n.scheduled}</span><span>In transit: ${n.in_transit}</span><span>Delivered: ${n.delivered}</span><em>${routes ? lgPlural(routes, 'building') : 'No deliveries'}</em></div>`;
    });
  };
}

/* ---------- Map: where each load is ---------- */
function lgxPins() {
  const pins = [];
  for (const load of LG.loads) {
    if (load.state === 'cancelled' || !load.stops.length) continue;
    if (load.state === 'delivered' && Date.now() - (load.doneAt || 0) > 3 * 864e5) continue;
    const origin = lgOrigin(load), arrived = load.stops.filter((x) => x.arrived);
    const kind = load.state === 'delivered' ? 'delivered' : load.state === 'in_transit' ? 'in_transit' : load.from.type === 'lot' ? 'staged' : 'pickup';
    const place = kind === 'delivered' ? lgStopLot(load.stops[load.stops.length - 1]) : kind === 'in_transit' && arrived.length ? lgStopLot(arrived[arrived.length - 1]) : origin;
    pins.push({ load, kind, place });
  }
  return pins;
}
{
  const baseMap = lgMap;
  lgMap = function (load) {
    const seen = {}, step = matchMedia('(max-width: 680px)').matches ? 22 : 15; /* tags are drawn larger on a phone */
    const marks = lgxPins().map(({ load: l, kind, place }) => {
      const [x, y] = lgXY(place), n = (seen[place.id] = (seen[place.id] || 0) + 1), w = 9 + l.id.length * 6.6, px = x + 8, py = y - 24 + 15 - n * step;
      return `<g class="lgx-pin ${kind}" onclick="lgOpen('${esc(l.id)}')" role="button" tabindex="0" aria-label="${esc(lgLoadName(l))}: ${LGX_PIN[kind]}"><rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${w.toFixed(1)}" height="13" rx="4"/><text x="${(px + w / 2).toFixed(1)}" y="${(py + 9.6).toFixed(1)}" text-anchor="middle">${esc(l.id)}</text></g>`;
    }).join('');
    const html = baseMap(load).replace('</svg>', () => `<g class="lgx-pins">${marks}</g></svg>`);
    return html + `<p class="lg-legend lgx-pinlegend">${Object.entries(LGX_PIN).map(([k, name]) => `<span><i class="lgx-key ${k}"></i> ${name}</span>`).join('')}<span>Each tag is a load. Tap one to open it.</span></p>`;
  };
}

/* ---------- Trailers and haulers ---------- */
function lgxCarrierPanel() {
  const row = (c) => {
    const rigs = LG.rigs.filter((r) => r.carrierId === c.id).length;
    return `<div class="od-doc lgx-carrier"><div class="grow"><strong>${esc(c.name)}</strong>
      <small>${LGX_CARRIER_KIND[c.kind] || esc(c.kind)}${LGX_CARRIER_MEANS[c.kind] ? ': ' + LGX_CARRIER_MEANS[c.kind] : ''} · ${lgPlural(rigs, 'trailer')}</small>
      <small>Coverage: ${esc(c.areas?.length ? c.areas.join(', ') : c.covers || 'not set')}${c.capacity ? ` · Capacity: ${c.capacity} linear ft` : ''}</small>${lgxCarrierDates(c)}</div>
      <button type="button" class="secondary small" onclick="lgCarrierForm('${c.id}')">Change</button></div>`;
  };
  return `<section class="panel"><div class="panelhead"><h2>Who hauls</h2>${button(icon('plus', 16) + ' Add a hauler', 'lgCarrierForm()', 'secondary small')}</div>
    ${LG.carriers.map(row).join('')}
    <p class="source">Drivers and haulers here are made up. A date within 30 days shows “(in N d)”; a date that has passed shows “(expired N d ago)” and warns on that hauler’s loads.</p></section>`;
}
{
  const baseFleet = lgFleet;
  lgFleet = function () {
    let html = baseFleet();
    const a = html.indexOf('<section class="panel"><div class="panelhead"><h2>Who hauls</h2>'), b = html.indexOf('<section class="panel"><h2>Rules</h2>');
    if (a >= 0 && b > a) html = html.slice(0, a) + lgxCarrierPanel() + '\n    ' + html.slice(b);
    /* Each trailer card: how its capacity is measured, and today's miles. */
    let at = 0;
    for (const r of LG.rigs) {
      const i = html.indexOf('<p class="ops-rowsub">Usual driver: ', at), j = i < 0 ? -1 : html.indexOf('</p>', i);
      if (j < 0) break;
      const day = lgxRigDay(r.id, lgToday()), unit = r.capacityUnit && r.capacityUnit !== 'linear_feet' ? `${r.capValue || ''} ${LGX_UNIT[r.capacityUnit]}, so length is checked by hand` : r.feet ? `${r.feet} ${LGX_UNIT.linear_feet}` : 'none on file';
      const line = `<p class="ops-rowsub lgx-rigline">Capacity: ${esc(unit)}${day.text ? ` · <b>${esc(day.text)}</b>` : ''}</p>`;
      html = html.slice(0, j + 4) + line + html.slice(j + 4);
      at = j + 4 + line.length;
    }
    return html;
  };
}
/* The hauler form, with what Turbo Logistics keeps on a carrier. Replaces the shorter form. */
lgCarrierForm = function (id) {
  const c = lgCarrier(id) || { name: '', kind: 'contracted', areas: [], capacity: '', insuranceEnds: '', contractEnds: '', email: '', active: true };
  modal(id ? 'Change this hauler' : 'Add a hauler', `<div class="fields"><label>Name<input id="lg-car-name" maxlength="50" value="${esc(c.name)}" placeholder="Made-up name in this preview"></label>
    <label>Kind<select id="lg-car-kind">${Object.keys(LGX_CARRIER_KIND).map((k) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${LGX_CARRIER_KIND[k]}: ${LGX_CARRIER_MEANS[k]}</option>`).join('')}</select></label>
    <label>Capacity (linear ft)<input id="lgx-car-cap" type="number" min="0" step="1" inputmode="numeric" value="${c.capacity || ''}" placeholder="Example: 53"></label>
    <label>Dispatch email (made up)<input id="lgx-car-mail" type="email" maxlength="80" value="${esc(c.email || '')}" placeholder="dispatch@example.com"></label>
    <label>Insurance expires<input id="lgx-car-ins" type="date" value="${esc(c.insuranceEnds || '')}"></label>
    <label>Contract expires<input id="lgx-car-con" type="date" value="${esc(c.contractEnds || '')}"></label></div>
    <label class="field">Where they deliver (comma-separated)<input id="lg-car-covers" maxlength="80" value="${esc((c.areas || []).join(', '))}" placeholder="Example: North Carolina lots, Georgia lots"></label>
    <label class="checkrow"><input id="lgx-car-on" type="checkbox" ${c.active === false ? '' : 'checked'}> Active: can be booked on a load</label>
    <div class="actions">${button('Save', `lgCarrierSave('${id || ''}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
};
lgCarrierSave = function (id) {
  const name = $('#lg-car-name').value.trim(), cap = $('#lgx-car-cap').value.trim();
  if (!name) return toast('Give the hauler a name.');
  if (cap !== '' && !(Number(cap) > 0)) return toast('Capacity (linear feet) must be a positive number.');
  const areas = $('#lg-car-covers').value.split(',').map((x) => x.trim()).filter(Boolean);
  const data = { name, kind: $('#lg-car-kind').value, areas, covers: areas.join(', ') || 'Not set', capacity: cap === '' ? null : Number(cap), insuranceEnds: $('#lgx-car-ins').value, contractEnds: $('#lgx-car-con').value, email: $('#lgx-car-mail').value.trim(), active: $('#lgx-car-on').checked };
  if (id) Object.assign(lgCarrier(id), data);
  else LG.carriers.push({ id: 'car-' + Date.now().toString(36), ...data });
  closeModal();
  render();
  toast('Saved.');
};
/* The trailer form gains the unit its capacity is measured in. */
{
  const baseRigForm = lgRigForm;
  lgRigForm = function (id) {
    baseRigForm(id);
    const r = lgRig(id);
    $('.modal .actions')?.insertAdjacentHTML('beforebegin', `<label class="field">Capacity is measured in<select id="lgx-rig-unit">${Object.keys(LGX_UNIT).map((k) => `<option value="${k}" ${(r?.capacityUnit || 'linear_feet') === k ? 'selected' : ''}>${LGX_UNIT[k]}</option>`).join('')}</select></label>
      <p class="source">Sheds use linear feet, and a load is checked against the trailer in feet. Any other unit turns that check off for this trailer.</p>`);
    if (r?.capacityUnit && r.capacityUnit !== 'linear_feet' && $('#lg-rig-feet')) $('#lg-rig-feet').value = r.capValue || '';
  };
  const baseRigSave = lgRigSave;
  lgRigSave = function (id) {
    const unit = $('#lgx-rig-unit')?.value || 'linear_feet', n = LG.rigs.length, name = $('#lg-rig-name')?.value.trim();
    baseRigSave(id);
    if (!name) return;
    const r = id ? lgRig(id) : LG.rigs.length > n ? LG.rigs[LG.rigs.length - 1] : null;
    if (!r) return;
    r.capacityUnit = unit;
    if (unit === 'linear_feet') r.capValue = null;
    else (r.capValue = r.feet || r.capValue || 0), (r.feet = 0);
    render();
  };
}

/* ---------- The delivery-site questions: what the knowledge base says ---------- */
if (typeof siteForm === 'function') {
  const baseSite = siteForm;
  siteForm = function (holder, confirm) {
    baseSite(holder, confirm);
    if (document.body.dataset.side !== 'logi' || $('.modal .ta-rule')) return;
    $('.modal .actions')?.insertAdjacentHTML('beforebegin', `<div class="ta-rule lgx-siterule">${icon('help', 16)}<div>
      <p><b>What stops a delivery.</b> Narrow streets or gates, low trees or power lines, tight turns, soft or wet yards, septic or sprinkler lines. Concrete is best, gravel is fine, soft ground after rain is a risk. ${lgxTip('size-limits', 'Site access')}</p>
      <p><b>Blocking.</b> About 2 in. at the highest point of the ground, never more than 16 in. there. The crew levels with block and does not regrade; “Needs leveling” is the customer’s to fix first. Extra blocking is quoted and paid before delivery. ${lgxTip('set-height', 'Blocking')}</p>
      <p><b>Anchors</b> are not included and can be set on a return trip. <b>Against the driver’s advice</b>, a delivery that cannot be finished can carry a redelivery fee. ${lgxTip('wind-anchors', 'Anchors')}</p></div></div>`);
  };
}

/* ---------- Service jobs ----------
   Turbo Service schedules traveling labor: repairs, warranty visits, anchoring on a return trip,
   getting a repossessed building ready to sell again. A request is approved, becomes a job, is
   scheduled on a service rig and checked in on the way. Sample jobs here are made up. */
const lgxJob = (id) => LGX.jobs.find((j) => j.id === id);
const lgxSrig = (id) => LGX.srigs.find((r) => r.id === id);
/* buildServiceDispatchWarnings and buildRouteRigWarnings, word for word. */
function lgxJobWarnings(job) {
  const rig = lgxSrig(job.rigId), out = [];
  if (!rig) return job.status === 'scheduled' ? ['Route has no rig assigned — set a rig before dispatching stops.'] : out;
  if (rig.capacity == null || !rig.unit) out.push('Rig has no capacity on file — verify equipment fit manually.');
  const expects = job.offering === 'spray_foam' ? 'spray_foam' : null;
  if (expects && rig.kind !== expects) out.push(`Event offering expects a ${expects.replace(/_/g, ' ')} rig; assigned rig is ${rig.kind.replace(/_/g, ' ')}.`);
  const peers = LGX.jobs.filter((j) => j !== job && j.rigId === rig.id && j.date && j.date === job.date && ['scheduled', 'in_progress'].includes(j.status)).length;
  if (peers) out.push(`Rig already has ${peers} other event(s) on ${job.date || 'this date'}.`);
  return out;
}
/* Any side can ask for a service job. A repossessed or returned building asks by itself, with
   the title Turbo Assist gives it, and goes to the Internal upgrade queue. */
function taServiceAdd(o = {}) {
  const kind = String(o.kind || 'service').toLowerCase(), auto = /repo|return/.test(kind), serial = o.serial || '';
  const open = auto && LGX.jobs.find((j) => j.serial === serial && j.origin === 'manufacturing_auto' && !['complete', 'cancelled'].includes(j.status || '') && !['declined', 'cancelled'].includes(j.request));
  if (open) return open; /* one open request for a unit, as in Turbo Service */
  const u = serial ? lgUnit(serial) : null, s = o.saleId ? S.sales.find((x) => x.id === o.saleId) : null, lot = u ? lotById(u.lotId) : s && typeof saleLot === 'function' ? saleLot(s) : null;
  const job = { id: 'SV-' + ++LGX.jobSeq, title: o.title || (auto ? `${/repo/.test(kind) ? 'Repossessed unit' : 'Returned unit'} — internal upgrade for ${serial || 'the unit'}` : 'Service request'),
    queue: auto ? 'internal_upgrade' : /warrant/.test(kind) ? 'warranty' : /repair/.test(kind) ? 'repair' : 'new_service', origin: auto ? 'manufacturing_auto' : o.from === 'sales' ? 'sales' : 'service_internal',
    request: 'pending', status: null, checkIn: 'none', serial, saleId: o.saleId || null, customer: s?.customer || u?.customer || '', where: o.where || (lot ? `${lot.town} lot area` : 'Location to confirm'),
    date: '', rigId: '', offering: o.offering || null, note: o.note || '', from: o.from || '', at: Date.now(), log: [] };
  job.log.push({ at: Date.now(), text: `Requested${o.from ? ' from the ' + o.from + ' side' : ''}` });
  LGX.jobs.push(job);
  lgxTell({ to: 'logi', title: `Service request — ${job.title}`, body: `${LGX_QUEUE[job.queue]} queue · ${job.where}${serial ? ' · ' + serial : ''}. It waits for approval under Service jobs.`, serial, saleId: job.saleId, go: "LGX.jobTab='review';go('lg-service')" });
  return job;
}
function lgxJobSet(id, patch, text) {
  const job = lgxJob(id);
  Object.assign(job, patch);
  job.log.push({ at: Date.now(), text });
  render();
  toast(text + '.');
}
const lgxJobApprove = (id) => (lgxJobSet(id, { request: 'approved', status: 'unscheduled' }, 'Request approved'), (LGX.jobTab = 'plan'), render());
const lgxJobInfo = (id) => lgxJobSet(id, { request: 'needs_info' }, 'Sent back for more information');
const lgxJobDecline = (id) => lgxJobSet(id, { request: 'declined' }, 'Request declined');
function lgxJobPlanForm(id) {
  const job = lgxJob(id);
  modal('Schedule this job', `<p><strong>${esc(job.title)}</strong> · ${esc(job.where)}</p>
    <div class="fields"><label>Day<input id="lgx-job-date" type="date" min="${lgToday()}" value="${esc(job.date || lgAddDays(lgToday(), 2))}"></label>
    <label>Service rig<select id="lgx-job-rig"><option value="">No rig yet</option>${LGX.srigs.map((r) => `<option value="${r.id}" ${job.rigId === r.id ? 'selected' : ''}>${esc(r.name)} · ${esc(r.tech)}</option>`).join('')}</select></label></div>
    <p class="source">A service rig is not a delivery trailer: it carries tools and a technician. Warnings about the rig show on the job after it is saved.</p>
    <div class="actions">${button('Schedule', `lgxJobPlan('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function lgxJobPlan(id) {
  const date = $('#lgx-job-date').value, rigId = $('#lgx-job-rig').value;
  if (!date) return toast('Pick a day.');
  closeModal();
  LGX.jobTab = 'set';
  lgxJobSet(id, { date, rigId, status: 'scheduled' }, `Scheduled for ${lgDay(date)}${rigId ? ' with ' + lgxSrig(rigId).name : ''}`);
}
function lgxJobCheckIn(id) {
  const job = lgxJob(id), next = LGX_CHECKIN_ORDER[LGX_CHECKIN_ORDER.indexOf(job.checkIn) + 1];
  if (!next) return;
  lgxJobSet(id, { checkIn: next, ...(next === 'on_site' ? { status: 'in_progress' } : next === 'complete' ? { status: 'complete' } : {}) }, `Check-in: ${LGX_CHECKIN[next]}`);
  if (next === 'complete') (LGX.jobTab = 'done'), render();
}
const lgxJobCancel = (id) => lgxJobSet(id, { status: 'cancelled' }, 'Job cancelled');
function lgxJobRow(job) {
  const rig = lgxSrig(job.rigId), warns = ['scheduled', 'in_progress'].includes(job.status) ? lgxJobWarnings(job) : [], nextIn = LGX_CHECKIN_ORDER[LGX_CHECKIN_ORDER.indexOf(job.checkIn) + 1];
  const acts = job.request === 'pending' || job.request === 'needs_info'
    ? `<button type="button" class="primary small" onclick="lgxJobApprove('${job.id}')">Approve</button>${job.request === 'pending' ? `<button type="button" class="secondary small" onclick="lgxJobInfo('${job.id}')">Needs info</button>` : ''}<button type="button" class="secondary small" onclick="lgxJobDecline('${job.id}')">Decline</button>`
    : job.status === 'unscheduled' ? `<button type="button" class="primary small" onclick="lgxJobPlanForm('${job.id}')">Schedule</button>`
    : job.status === 'scheduled' || job.status === 'in_progress' ? `${nextIn ? `<button type="button" class="primary small" onclick="lgxJobCheckIn('${job.id}')">Check in: ${LGX_CHECKIN[nextIn]}</button>` : ''}${job.status === 'scheduled' ? `<button type="button" class="secondary small" onclick="lgxJobPlanForm('${job.id}')">Change</button><button type="button" class="secondary small" onclick="lgxJobCancel('${job.id}')">Cancel</button>` : ''}` : '';
  return `<article class="ops-row lgx-job"><span class="lg-code lgx-long">${esc(job.id)}</span><div class="grow"><div class="ops-rowtop"><strong>${esc(job.title)}</strong>${job.sample ? '<span class="pill ghost">Sample</span>' : ''}</div>
    <p class="ops-rowsub">${LGX_QUEUE[job.queue]} · ${esc(job.where)}${job.customer ? ' · ' + esc(job.customer) : ''}${job.serial ? ` · <span class="serial">${esc(job.serial)}</span>` : ''}${job.date ? ' · ' + lgDay(job.date) : ''}${rig ? ' · ' + esc(rig.name) + ', ' + esc(rig.tech) : ''}</p>
    <div class="ops-flags"><span class="ops-flag ${job.request === 'approved' ? 'ok' : job.request === 'declined' ? 'bad' : 'todo'}">Request: ${LGX_REQ[job.request]}</span>${job.status ? `<span class="ops-flag ${job.status === 'complete' ? 'ok' : job.status === 'cancelled' ? '' : 'wait'}">${LGX_EVT[job.status]}</span>` : ''}
      ${job.status && job.status !== 'unscheduled' ? `<span class="ops-flag">${LGX_CHECKIN[job.checkIn]}</span>` : ''}<span class="ops-flag">From: ${LGX_ORIGIN[job.origin]}</span>${warns.map((w) => `<span class="ops-flag todo">${esc(w)}</span>`).join('')}</div>
    ${job.note ? `<p class="ops-rowsub">${esc(job.note)}</p>` : ''}</div><div class="ops-rowacts">${acts}</div></article>`;
}
function lgxService() {
  const groups = { review: (j) => ['pending', 'needs_info'].includes(j.request), plan: (j) => j.request === 'approved' && j.status === 'unscheduled', set: (j) => ['scheduled', 'in_progress'].includes(j.status), done: (j) => ['complete', 'cancelled'].includes(j.status) || ['declined', 'cancelled'].includes(j.request) };
  const names = { review: 'To review', plan: 'To schedule', set: 'Scheduled', done: 'Finished' }, rows = LGX.jobs.filter(groups[LGX.jobTab]).sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || b.at - a.at);
  return `<button class="link backlink" onclick="go('logi')">${icon('back', 18)} Dispatch</button>
  ${head('Logistics · service', 'Service jobs.', 'Work that travels to a building after it is built: repairs, warranty visits, anchoring on a return trip, getting a repossessed building ready to sell again.')}
  <div class="chiprow ops-tabs">${Object.keys(names).map((k) => `<button type="button" class="chipbtn${LGX.jobTab === k ? ' on' : ''}" onclick="LGX.jobTab='${k}';render()">${names[k]} <span class="ops-n">${LGX.jobs.filter(groups[k]).length}</span></button>`).join('')}</div>
  <div class="ops-list">${rows.map(lgxJobRow).join('') || `<div class="panel emptystate"><strong>Nothing ${names[LGX.jobTab].toLowerCase()}</strong><p>A request shows here when a side asks for a visit.</p></div>`}</div>
  <div class="grid2" style="margin-top:20px"><section class="panel"><h2>Service rigs</h2>${LGX.srigs.map((r) => `<div class="od-doc"><div class="grow"><strong>${esc(r.name)}</strong><small>${esc(r.tech)} · kind: ${esc(r.kind.replace(/_/g, ' '))} · capacity ${r.capacity == null ? 'not on file' : r.capacity + ' ' + esc(r.unit)}</small></div></div>`).join('')}<p class="source">Made-up rigs and technicians.</p></section>
    <section class="panel"><h2>How a job moves</h2><ol class="lgx-steps"><li><b>Request</b>: ${Object.values(LGX_REQ).join(', ')}.</li><li><b>Job</b>: ${Object.values(LGX_EVT).join(', ')}.</li><li><b>Check-in</b> with the customer: ${LGX_CHECKIN_ORDER.map((k) => LGX_CHECKIN[k]).join(', ')}.</li></ol>
      <p class="source">Anchoring on a return trip can carry a trip fee. ${lgxTip('wind-anchors', 'Anchors')} Lost keys are a repair request for a new lockset. ${lgxTip('lost-keys', 'Lost keys')}</p></section></div>
  ${opsNotes([], [])}`;
}

/* ---------- The notes page: what came from Turbo Assist, and what is planned there ---------- */
{
  const baseNotes = lgNotesPage;
  lgNotesPage = function () {
    const html = baseNotes(), i = html.lastIndexOf('</div>');
    const extra = `<section class="panel"><h2>Taken from Turbo Logistics</h2><ul>
        <li>The four in-app notices to the salesperson: scheduled, in transit, delivered, time changed.</li>
        <li>The route manifest, printed line for line, and “Email manifest” for a hauler with no login.</li>
        <li>The “Permit required” flag and permit notes, beside the wide-load tick.</li>
        <li>Load codes that split: AC, then AC-L1, AC-L2.</li>
        <li>Carrier kinds, coverage, capacity, insurance and contract end dates; rig capacity units.</li>
        <li>Map pins: In transit, Staged at dealer, Delivered, At pickup.</li>
        <li>The count of scheduled, in transit and delivered for each day.</li>
        <li>Three sign-ins: coordinator, driver, and an outside hauler who sees only its own loads.</li>
        <li>The reasons miles cannot be measured, and each trailer’s miles for the day.</li>
        <li>Service jobs with Turbo Service’s request, job and check-in steps.</li>
        <li>Delivery rules from the knowledge base: sizes, site access, blocking, anchors, lead times.</li>
      </ul></section>
      <section class="panel"><h2>Planned in Turbo Logistics, not built yet</h2><ul>
        <li><b>A tracking page for the customer</b> with the ETA, the driver and the status. Here: the four automatic texts and emails stand in for it; there is no page.</li>
        <li><b>The customer rescheduling, sending a photo of the site and flagging a locked gate, narrow drive or low wires.</b> Here: staff ask the site questions at the sale and Logistics confirms them.</li>
        <li><b>Each organisation choosing when and who gets told</b>, including a 48-hour wait before a customer sees a change. Here: one setting, Logistics, the lot’s manager or automatic messages.</li>
        <li><b>Route suggestions a person accepts or rejects.</b> Here: “Add buildings” lists what fits the same stops and area, by a simple rule.</li>
        <li><b>Speaking the day’s plan and committing it in one step.</b> Not here.</li>
        <li><b>Looking up permits by state.</b> Not here: the flag is set by hand in both.</li>
        <li><b>Reopening a load as planned.</b> Turbo Logistics has the button words but no such step yet. Not here.</li>
      </ul><p class="source">Built in Turbo Logistics and not here: the driver’s screen keeps a copy for when there is no signal (“Sync now”), and miles are real driving miles.</p></section>
      <section class="panel"><h2>Kept in other parts of Turbo Assist</h2><ul>
        <li><b>Haul rates.</b> One rule for a group of buildings or for one product, by a flat amount, by square foot or by length, with one rate for the plant haul and one for the lot haul. It belongs to pricing and holds money figures, so no rate is shown here.</li>
        <li><b>The proof form.</b> Turbo Ops owns the FastField form a driver fills in at a stop and files it with the order’s paperwork.</li>
        <li><b>Whether a building may be routed.</b> Turbo Ops marks the order ready to deliver once the plant has finished it; until then Turbo Logistics answers “Building is not finished. Logistics can route after build complete.”</li>
      </ul></section>`;
    return i < 0 ? html + extra : html.slice(0, i) + extra + html.slice(i);
  };
}

/* ---------- Screens, back button and product notes ---------- */
Object.assign(OPS_SCREENS, { logi: lgBoard, 'lg-load': lgLoadPage, 'lg-loads': lgLoads, 'lg-cal': lgCalendar, 'lg-places': lgPlaces, 'lg-fleet': lgFleet, 'lg-notes': lgNotesPage, 'lg-service': lgxService });
{
  const baseDetail = opsDetail;
  opsDetail = function (page) {
    return page === 'lg-service' ? ['logi', 'Dispatch', 'Service jobs'] : baseDetail(page);
  };
}
if (typeof taNotesFor === 'function') {
  taNotesFor('logi', [
    ['Service jobs', 'Turbo Service’s board and inbound requests (<code>service_requests</code>, <code>service_events</code>), opened from here.'],
    ['Each trailer’s miles today', 'The dispatch board’s daily total per rig (<code>useRigDayMileage</code>, <code>formatRigDayMiles</code>).'],
    ['A notice when an order is released', 'The words are the deal timeline line Turbo Ops writes (<code>readyToDeliverTimelineBody</code>). A unit must be built and marked ready to deliver before it can be routed (<code>assertUnitEligibleForLogisticsRoute</code>).'],
  ], ['“Usual delivery by” and “Late” on a customer’s building, counted from the sale with the knowledge base’s lead times.', 'Refusing a 16 ft wide building on a load, and sending it to a build crew job.', 'A bell notice to Logistics when a building lands on the board or a driver finishes a stop.']);
  taNotesFor('lg-load', [
    ['Manifest · Email manifest', '<code>manifestSnapshotToTextLines</code> prints the header and “STOPS (in order)”; <code>emailLogisticsRouteManifest</code> sends the PDF to a hauler-provided address. One manifest per route, so one per building.'],
    ['Flag permit required · Clear permit flag', '<code>LogisticsRoutePermitControl</code> sets <code>permit_required</code> with <code>updateLogisticsRoute</code>; permit notes ride on the unit.'],
    ['Break out buildings', '<code>splitUnitFromShipment</code> moves one unit to the next code (<code>nextLogisticsSplitCode</code>: AC-L1, AC-L2) and writes “Broke out of AC into AC-L1.” on the deal.'],
    ['Notices to the salesperson', '<code>notifyRouteDeliveryStateTransition</code> (scheduled, in transit, delivered) and <code>notifyRouteDeliveryEtaUpdate</code> (time changed), kind <code>logistics_delivery_update</code>.'],
    ['States', '<code>VALID_TRANSITIONS</code>: planned to scheduled or cancelled; scheduled to in transit or cancelled; in transit to delivered or cancelled. Delivered and cancelled are final.'],
    ['Stops', 'Kinds <code>plant_origin</code>, <code>dealer_holding</code>, <code>end_customer</code>. A lot stop needs the receiving lot and a customer stop needs the customer’s contact (<code>logi_stops_recipient_shape_chk</code>). Arrived and departed stamps and the proof (<code>evidence_completed_at</code>) are on each stop.'],
    ['Time', '<code>scheduledForPicker</code>: Morning sorts at 9:00, Afternoon at 13:00, Date only at 8:00, a window at its start.'],
    ['Miles', '<code>computeOrgRouteMileage</code>: Google Distance Matrix, then straight-line. Its three “cannot measure” sentences are used here word for word.'],
  ], ['Picking several buildings for one split load; Turbo Logistics breaks out one unit at a time.', 'The day printed beside the time on the manifest and in the notices. Turbo Logistics prints “Morning” alone when a time of day is set.', 'A warning when the hauler’s insurance or contract on file has ended, or the hauler is inactive.', 'A warning past 40 ft and a stop for 16 ft wide, from the knowledge base.', 'The notice “At the lot” when a customer’s building reaches the lot.', 'When the day of a scheduled delivery changes, the customer has to be told again.']);
  taNotesFor('lg-loads', [['View as', 'Roles <code>logistics_coordinator</code> (also “dispatcher”), <code>driver</code> and <code>third_party_hauler_subcoordinator</code>. The hauler’s screen is <code>HaulerAppShell</code>: “View-only · your carrier scope”.'], ['Codes like AC-L1', '<code>logi_shipments.code</code> allows one or two letters and an optional -L number.']], ['Switching sign-ins on this screen; in Turbo Assist each person has one.']);
  taNotesFor('lg-cal', [['The count on each day', '<code>LogisticsCalendarWeekGrid</code>: “Scheduled”, “In transit”, “Delivered” for each day, counted in routes (one per building).']], []);
  taNotesFor('lg-places', [['The tags on the map', '<code>classifyRouteMapPin</code> and <code>MAP_PIN_KIND_LABELS</code>: In transit, Staged at dealer, Delivered, At pickup.']], ['One tag for a whole load; Turbo Logistics pins each building’s route.']);
  taNotesFor('lg-fleet', [
    ['Hauler kinds and dates', '<code>CARRIER_KIND_LABELS</code> (Contracted, Freelance, Dealer BYO, In-house, Other), <code>coverage_areas</code>, <code>capacity_linear_feet</code>, <code>insurance_expires_at</code>, <code>contract_expires_at</code>, <code>is_active</code>; <code>classifyExpiry</code> words the dates.'],
    ['Capacity is measured in', '<code>RIG_CAPACITY_UNIT_LABELS</code>. Only linear feet is compared with a building’s length (<code>buildRigAssignmentWarnings</code>).'],
    ['Today’s miles on a trailer', '<code>formatRigDayMiles</code>: “Today 135.0 mi · 1 unmeasured”.'],
  ], ['A hauler’s made-up dispatch email, used to fill in “Email manifest”.']);
  taNotesFor('lg-drive', [['Stop kind and proof on each stop', 'The driver’s card shows “Stop N · kind”, Maps, Call and FastField, with Arrived and Departed (<code>DriverStopCard</code>).']], []);
  taNotesFor('lg-service', [
    ['Request, job and check-in', '<code>REQUEST_STATUS_LABELS</code>, <code>EVENT_STATUS_LABELS</code>, <code>CHECK_IN_LABELS</code> in Turbo Service. Queues Repair, Warranty service, New service and Internal upgrade are the ones seeded for Bennett and ShedCor.'],
    ['A repossessed or returned building', 'Turbo Manufacturing opens the request by itself: “Repossessed unit — internal upgrade for {serial}” (<code>buildManufacturingAutoDescription</code>), one open request per unit.'],
    ['Warnings about the rig', '<code>buildServiceDispatchWarnings</code> and <code>buildRouteRigWarnings</code>, word for word.'],
  ], ['Service jobs opened from Logistics. In Turbo Assist, Service is its own part of the app.', 'A build-on-site job for a 16 ft wide building.', 'Checking in by pressing one button for each step.']);
}

/* ---------- Sample records: made-up haulers' details, lead times, one delivery, service jobs ---------- */
(function seedTurboLogistics() {
  const plus = (n) => lgAddDays(lgToday(), n), hours = (h) => Date.now() - h * 36e5;
  const set = (id, data) => lgCarrier(id) && Object.assign(lgCarrier(id), data);
  set('house', { areas: ['South Carolina', 'North Carolina', 'Georgia'], capacity: null, insuranceEnds: plus(210), contractEnds: '', email: '', active: true });
  set('hauler-a', { areas: ['North Carolina lots'], capacity: 40, insuranceEnds: plus(12), contractEnds: plus(190), email: 'dispatch@sample-hauling.example', active: true });
  set('hauler-b', { areas: ['Georgia lots'], capacity: 32, insuranceEnds: plus(-5), contractEnds: plus(20), email: 'dispatch@sample-shed-movers.example', active: true });
  LG.rigs.forEach((r) => (r.capacityUnit ||= 'linear_feet'));
  /* When each sample customer bought, so the usual delivery time can be shown. One is late. */
  const sold = (id, days, inStock) => lgUnit(id) && Object.assign(lgUnit(id), { soldAt: hours(days * 24), inStock });
  sold('SAMPLE-1216-2120', 6, true);
  sold('SAMPLE-1016-2121', 16, true);
  sold('SAMPLE-1012-2122', 15, false);
  sold('SAMPLE-1012-2123', 9, true);

  /* One finished home delivery from this desk's own lot, so the Sales desk has its notices. */
  const uid = 'SAMPLE-1016-2080';
  if (!lgUnit(uid) && !lgLoad('H10')) {
    const lot = lotById(DESK_LOT);
    let day = plus(-1);
    for (let i = 0; i < 7 && !lotDay(lot, day).open; i++) day = lgAddDays(day, -1);
    const at = (clock) => new Date(`${day}T${clock}:00`).getTime(), set2 = new Date(`${lgAddDays(day, -2)}T15:05:00`).getTime();
    const u = lgAddUnit({ id: uid, name: '10x16 Basic Utility', size: '10x16', kind: 'order', customer: 'Casey Whitlow', lotId: DESK_LOT, plantId: lotPlant(lot).id, leg: null, at: 'home', sample: true, readyAt: set2, inStock: true, soldAt: set2 - 5 * 864e5,
      site: { miles: 11, access: 'Clear access', gate: '', noGate: true, ground: 'Level', notes: '', askedBy: 'Salesperson', askedAt: set2 - 5 * 864e5, confirmed: set2 } });
    u.trips = [{ load: 'H10', leg: 'lot-home', at: at('10:35') }];
    u.told = { how: 'Logistics', at: set2 + 20 * 60e3 };
    const load = { id: 'H10', kind: 'home', from: { type: 'lot', id: DESK_LOT }, rigId: 'rig-4', driver: 'Nia Foster', date: day, window: 'Morning', windowNote: '', state: 'delivered', permit: false, sample: true, made: set2 - 36e5, startedAt: at('09:10'), doneAt: at('10:35'),
      stops: [{ key: 'home:' + uid, units: [uid], arrived: at('10:02'), done: at('10:35'), proof: { by: 'Casey Whitlow', note: '', photo: '' } }],
      log: [{ at: set2 - 36e5, text: 'Delivery started' }, { at: set2, text: `Scheduled for ${lgDay(day)} · morning with Rig 4` }, { at: at('09:10'), text: `Nia Foster left ${lot.town} lot` }, { at: at('10:35'), text: 'Delivered to Casey Whitlow · signed by Casey Whitlow' }, { at: at('10:35'), text: 'Every stop done' }] };
    LG.loads.push(load);
    lgxDeskNotice(u, 'scheduled', load, set2);
    lgxDeskNotice(u, 'in_transit', load, at('09:10'));
    lgxDeskNotice(u, 'delivered', load, at('10:35'));
  }
  /* What the Logistics bell would already hold this morning. */
  const road = LG.loads.find((l) => l.state === 'in_transit' && l.stops.some((x) => x.done)), done = LG.loads.find((l) => l.id === 'AA' && l.state === 'delivered');
  if (done) lgxTell({ to: 'logi', title: `Unloaded at the ${lgStopLot(done.stops[0]).town} lot — ${lgLoadName(done)}`, body: `${done.driver} finished stop 1 of 1: ${lgPlural(done.stops[0].units.length, 'building')}, received by ${done.stops[0].proof?.by}. Every stop is done.`, go: `lgOpen('${done.id}')`, at: done.doneAt || hours(27) });
  if (road) {
    const first = road.stops.find((x) => x.done), next = road.stops.find((x) => !x.done);
    lgxTell({ to: 'logi', title: `Unloaded at the ${lgStopLot(first).town} lot — ${lgLoadName(road)}`, body: `${road.driver} finished stop 1 of ${road.stops.length}: ${lgPlural(first.units.length, 'building')}, received by ${first.proof?.by}. ${next ? 'Next: the ' + lgStopLot(next).town + ' lot.' : ''}`, go: `lgOpen('${road.id}')`, at: first.done || hours(1.3) });
  }
  if (typeof lgFeeList === 'function')
    for (const s of lgFeeList().slice(0, 1)) lgxTell({ to: 'logi', title: `Delivery fee to approve — ${s.id}`, body: `${s.customer} is ${ofDelivery(s).miles} miles from the ${saleLot(s).town} lot. Past ${OF.set.overTo} miles the fee is yours to set.`, saleId: s.id, go: "LG.tile='all';LG.q='';go('logi')", at: hours(6) });

  /* Service: two made-up rigs and five made-up jobs, one in each state worth seeing. */
  LGX.srigs = [
    { id: 'srv-1', name: 'Service truck 1', kind: 'other', capacity: null, unit: null, tech: 'Rowan Pike' },
    { id: 'srv-2', name: 'Spray foam rig', kind: 'spray_foam', capacity: 2, unit: 'units', tech: 'Indy Marsh' },
  ];
  const job = (o) => LGX.jobs.push({ id: 'SV-' + ++LGX.jobSeq, checkIn: 'none', status: null, serial: '', saleId: null, customer: '', date: '', rigId: '', offering: null, note: '', from: '', sample: true, at: hours(o.ago || 20), log: [{ at: hours(o.ago || 20), text: 'Requested' }], ...o });
  let visit = plus(2);
  for (let i = 0; i < 7 && [0, 6].includes(new Date(visit + 'T12:00:00').getDay()); i++) visit = lgAddDays(visit, 1);
  job({ title: 'Set anchors on a return trip', queue: 'new_service', origin: 'sales', request: 'approved', status: 'scheduled', checkIn: 'confirmed', serial: uid, customer: 'Casey Whitlow', where: `${lotById(DESK_LOT).town} lot area`, date: visit, rigId: 'srv-1', note: 'Anchors were not on the order. A trip fee may apply.', ago: 26 });
  job({ title: 'Spray foam insulation · 12 × 24', queue: 'new_service', origin: 'opportunity', request: 'approved', status: 'scheduled', offering: 'spray_foam', customer: 'Morgan Tisdale', where: 'Florence lot area', date: visit, rigId: 'srv-1', note: 'Booked on the service truck: it should ride on the spray foam rig.', ago: 30 });
  job({ title: 'Warranty: double door will not latch', queue: 'warranty', origin: 'sales', request: 'pending', serial: 'SAMPLE-1220-1877', customer: 'Blake Arrington', where: 'Florence lot area', ago: 5 });
  job({ title: 'Repair: replace a damaged trim board', queue: 'repair', origin: 'service_internal', request: 'needs_info', where: 'Conway lot · inventory', note: 'Which building? The request has no serial.', ago: 50 });
  job({ title: 'Repossessed unit — internal upgrade for SAMPLE-1012-1702', queue: 'internal_upgrade', origin: 'manufacturing_auto', request: 'approved', status: 'unscheduled', serial: 'SAMPLE-1012-1702', where: 'Statesboro lot', note: 'Clean, repair and photograph it before it is listed again.', ago: 70 });
})();
