/* logi-polish.js: Logistics, second batch from the review.

   What changes on the screen:
   1. Once a truck is rolling, its times count from when it really left and from each stop it has
      finished. A second load on the same trailer the same day starts when the first one is back.
   2. The calendar counts loads, marks a load that has a stop at a lot that is closed that day, shows
      "Leaves 7:00 AM · back 4:34 PM" on each card, and can move a load to another day.
   3. A load's permit is handled in one block: needs a permit, permit confirmed, permit notes.
   4. A warning when a hauler is put on a load with a stop outside the area it covers.
   5. On a phone the map has a list of the lots under it, and a tap picks the nearest lot.
   6. Service jobs are in the menu, in plain words.
   7. "Damage noted" on the unload form needs a note and a photo.
   8. Small slips: wording, the late chip opens a list, a typed drive time keeps the road time in
      view, and the Loads screen follows the gear's "Viewing as" instead of its own switch.
   9. A run sheet for the hauler: every stop in order on one sheet. Turbo Logistics prints one manifest
      per building (server/logi-services/routeManifestService.ts, manifestSnapshotToTextLines); the
      run sheet is a proposal for it. Turbo's own version stays reachable with builder notes on.

   Older checks that read Turbo's own words switch all of this off with PP.raw.
   Loaded after logi-guards.js. */

const LGP = { busy: new Set(), turn: 15, prev: null };
const lgpOn = () => !lggRaw();
const lgpCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- 1. Live arrival times ----------
   Turbo Logistics stamps Arrived and Departed on a stop (stampDriverStop) but has no arrival times.
   Counting the rest of the day from those stamps is a feature the product still has to accept. */
{
  const base = dtPlan;
  dtPlan = function (load) {
    const p = base(load);
    if (!lgpOn() || !load.startedAt || !['in_transit', 'delivered'].includes(load.state)) return p;
    const d0 = new Date(load.startedAt);
    d0.setHours(0, 0, 0, 0);
    const m = (t) => (t - d0.getTime()) / 60000, now = m(Date.now()), day = new Date(load.startedAt).getDay(), iso = lgIso(new Date(load.startedAt));
    let t = m(load.startedAt);
    p.start = t;
    p.live = true;
    for (const s of p.stops) {
      const st = s.stop;
      s.flag = null;
      s.wait = 0;
      s.late = false;
      if (st.done) (s.arrive = m(st.arrived || st.done)), (s.leave = m(st.done)), (s.real = 'done');
      else if (st.arrived) (s.arrive = m(st.arrived)), (s.leave = Math.max(now, s.arrive) + s.unload), (s.real = 'here');
      else {
        s.due = t + s.leg.min;
        s.late = load.state === 'in_transit' && now > s.due + 10;
        s.arrive = s.late ? now : s.due;
        if (s.isLot) {
          const lot = lgStopLot(st), d = lotDay(lot, iso), h = lot.hours[day];
          if (d.open && Array.isArray(h)) {
            if (s.arrive < h[0] * 60) (s.wait = h[0] * 60 - s.arrive), (s.flag = { level: 'info', text: `gets there ${dtLong(s.wait)} before the lot opens at ${clock(h[0])}` });
            else if (s.arrive + s.unload > h[1] * 60) s.flag = { level: 'warn', text: s.arrive > h[1] * 60 ? `gets there after the lot closes at ${clock(h[1])}` : `still unloading when the lot closes at ${clock(h[1])}` };
          }
        } else if (p.promise && (s.arrive < p.promise.from - 15 || s.arrive > p.promise.to + 15)) s.flag = { level: 'warn', promise: true, text: `gets there about ${dtClock(s.arrive)}, but the customer was told ${p.promise.words}` };
        s.leave = s.arrive + s.wait + s.unload;
      }
      t = s.leave;
    }
    p.end = t + p.back.min;
    p.day = p.end - p.start;
    return p;
  };

  /* A second load on the same trailer the same day leaves when the first one is back. */
  const ownStart = dtStart;
  const lgpRank = (l) => (l.state === 'delivered' ? 0 : l.state === 'in_transit' ? 1 : 2);
  window.lgpBefore = function (load) {
    if (!load.rigId || !load.date || !load.stops.length) return null;
    const mine = ownStart(load), r = lgpRank(load);
    const earlier = LG.loads.filter((l) => l !== load && l.rigId === load.rigId && l.date === load.date && l.state !== 'cancelled' && l.stops.length && !LGP.busy.has(l.id)).filter((l) => {
      const lr = lgpRank(l), ls = ownStart(l);
      return lr < r || (lr === r && (ls < mine || (ls === mine && l.id < load.id)));
    });
    if (!earlier.length) return null;
    LGP.busy.add(load.id);
    try {
      return earlier.map((l) => ({ load: l, end: dtPlan(l).end })).sort((a, b) => b.end - a.end)[0];
    } finally {
      LGP.busy.delete(load.id);
    }
  };
  dtStart = function (load) {
    const own = ownStart(load);
    if (!lgpOn() || load.leave || load.startedAt || LGP.busy.has(load.id)) return own;
    const prev = lgpBefore(load);
    return prev ? Math.max(own, Math.ceil((prev.end + LGP.turn) / 5) * 5) : own;
  };

  const basePanel = dtPanel;
  dtPanel = function (load) {
    if (!load.stops.length || !lgpOn()) return basePanel(load);
    const p = dtPlan(load), from = lgOriginName(load), home = load.from.type === 'plant' ? 'the plant' : 'the lot';
    if (!p.live) {
      const prev = !load.leave ? lgpBefore(load) : null, pushed = prev && p.start > ownStart(load);
      const html = basePanel(load);
      return pushed ? html.replace('<ol class="dt-line">', `<p class="lgp-after">${icon('truck', 16)} This trailer is on ${lgLoadName(prev.load)} first. It is back about ${dtClock(prev.end)}, so this load leaves at ${dtClock(p.start)}.</p><ol class="dt-line">`) : html;
    }
    const done = p.stops.filter((s) => s.real === 'done').length;
    const row = (s) => {
      if (s.real === 'done') return `<li class="done"><time>${dtClock(s.arrive)}</time><div><b>${esc(s.name)}</b><small>Got there ${dtClock(s.arrive)} · left ${dtClock(s.leave)}</small></div></li>`;
      if (s.real === 'here') return `<li class="now"><time>${dtClock(s.arrive)}</time><div><b>${esc(s.name)}</b><small>Got there ${dtClock(s.arrive)} · unloading now · should leave about ${dtClock(s.leave)}</small></div></li>`;
      return `<li class="drive"><time></time><div><small>${dtLong(s.leg.min)} · ${Math.round(s.leg.miles)} mi</small></div></li>
        <li class="${s.late ? 'warn' : s.flag ? s.flag.level : ''}"><time>${dtClock(s.arrive)}</time><div><b>${esc(s.name)}</b><small>${s.late ? `Running late: it was due about ${dtClock(s.due)}` : `Should get there about ${dtClock(s.arrive)}`} · unload ${s.n} building${s.n === 1 ? '' : 's'}: ${dtLong(s.unload)}${s.hours ? ' · ' + esc(s.hours) : ''}</small>${s.flag ? `<small class="dt-flag">${esc(lgpCap(s.flag.text))}</small>` : ''}</div></li>`;
    };
    return `<section class="panel dt-panel lgp-live"><div class="panelhead"><h2>Drive time</h2><span class="pill blue">${load.state === 'delivered' ? 'Real times' : 'Live'}</span></div>
      <div class="dt-top"><div class="dt-sum"><span><b>${dtClock(p.start)}</b>left</span><span><b>${done} of ${p.stops.length}</b>stops done</span><span><b>${Math.round(p.miles)} mi</b>round trip</span><span><b>${dtClock(p.end)}</b>${load.state === 'delivered' ? 'about back at ' : 'back at '}${home}</span></div></div>
      <ol class="dt-line"><li class="go"><time>${dtClock(p.start)}</time><div><b>Left ${esc(from)}</b><small>The real time the truck left</small></div></li>
        ${p.stops.map(row).join('')}
        <li class="drive"><time></time><div><small>${dtLong(p.back.min)} · ${Math.round(p.back.miles)} mi back, empty</small></div></li>
        <li class="go"><time>${dtClock(p.end)}</time><div><b>Back at ${esc(from)}</b><small>About ${dtLong(p.day)} from leaving to back</small></div></li></ol>
      <p class="source">These times count from when the truck really left and from each stop it has finished. The stops still to come use the saved road times.</p></section>`;
  };

  /* A typed leave time that is before the trailer is back from its first load is a warning. */
  const baseChecks = lgChecks;
  lgChecks = function (load) {
    const out = baseChecks(load);
    if (!lgpOn()) return out;
    for (const c of out) c.text = c.text.replace(/\b(sun|mon|tues|wednes|thurs|fri|satur)day(s?)\b/g, (m) => lgpCap(m));
    if (!['planned', 'scheduled'].includes(load.state) || !load.stops.length) return out;
    if (load.leave) {
      const prev = lgpBefore(load), mine = ownStart(load);
      if (prev && mine < prev.end) out.push({ level: 'warn', text: `This trailer is not back from ${lgLoadName(prev.load)} until about ${dtClock(prev.end)}. This load is set to leave at ${dtClock(mine)}.` });
    }
    /* 4. Where a hauler delivers. Turbo Logistics keeps coverage areas on a carrier (logi_carriers) and does not check them. */
    const car = lgCarrier(lgRig(load.rigId)?.carrierId), covers = car ? lgpCovers(car) : null;
    if (covers) {
      const outside = [...new Set(load.stops.map((x) => lgStopLot(x)).filter((lot) => !covers.states.includes(lot.state)).map((lot) => `${lot.town}, ${STATE_NAME[lot.state]}`))];
      if (outside.length) out.push({ level: 'warn', text: `${car.name} covers ${covers.words}. ${outside.join(' and ')} ${outside.length === 1 ? 'is' : 'are'} outside that.`, area: true });
    }
    return out;
  };
}
/* The states a hauler covers, read from its coverage words. "Every lot" or nothing set means anywhere. */
function lgpCovers(car) {
  const words = (car.areas?.length ? car.areas.join(', ') : car.covers || '').trim();
  if (!words || /every|all lots|anywhere|not set/i.test(words)) return null;
  const states = Object.entries(STATE_NAME).filter(([st, name]) => new RegExp(`\\b(${name}|${st})\\b`).test(words)).map(([st]) => st);
  return states.length ? { states, words } : null;
}

/* ---------- 2. Calendar ----------
   Turbo Logistics: LogisticsCalendarPanel counts routes, one per building. Counting loads, the times on
   a card and moving a load from here are features the product still has to accept. */
{
  const base = OPS_SCREENS['lg-cal'];
  OPS_SCREENS['lg-cal'] = function () {
    let html = base();
    if (!lgpOn()) return html;
    const days = Array.from({ length: 7 }, (_, i) => lgAddDays(lgToday(), LG.week * 7 + i));
    let k = 0;
    html = html.replace(/<div class="lgx-daycount">.*?<\/div>/gs, () => {
      const loads = LG.loads.filter((l) => l.date === days[k] && l.state !== 'cancelled');
      k++;
      const n = (st) => loads.filter((l) => l.state === st).length, parts = [['planned', 'Planned'], ['scheduled', 'Scheduled'], ['in_transit', 'On the road'], ['delivered', 'Delivered']].filter(([st]) => n(st)).map(([st, name]) => `<span>${name}: ${n(st)}</span>`).join('');
      return `<div class="lgx-daycount lgp-daycount"><em>${loads.length ? lgPlural(loads.length, 'load') : 'No loads'}</em>${parts}</div>`;
    });
    html = html.replace(/<button type="button" class="lg-chip ([^"]*)" onclick="lgOpen\('([^']*)'\)">(.*?)<\/button>/gs, (m, cls, id, inner) => {
      const load = lgLoad(id);
      if (!load || !load.stops.length) return m;
      const p = dtPlan(load), shut = load.stops.filter(lgStopIsLot).map(lgStopLot).filter((lot) => !lotDay(lot, load.date).open);
      const times = load.state === 'delivered' ? `Left ${dtClock(p.start)} · done` : p.live ? `Left ${dtClock(p.start)} · back about ${dtClock(p.end)}` : `Leaves ${dtClock(p.start)} · back ${dtClock(p.end)}`;
      const flag = shut.length && ['planned', 'scheduled'].includes(load.state) ? `<i class="lgp-shutflag">${icon('alert', 14)} ${esc(shut.map((l) => l.town).join(' and '))} ${shut.length === 1 ? 'lot is' : 'lots are'} closed this day</i>` : '';
      const move = ['planned', 'scheduled'].includes(load.state) ? `<button type="button" class="link lgp-move" onclick="lgpMoveForm('${id}')">Move ${esc(id)} to another day</button>` : '';
      return `<button type="button" class="lg-chip ${cls}${flag ? ' lgp-shut' : ''}" onclick="lgOpen('${id}')">${inner}<i class="lgp-times">${times}</i>${flag}</button>${move}`;
    });
    return html.replace('Every load on its day, and which lots are closed.', 'Every load on its day, when it leaves and gets back, and which lots are closed.');
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-cal'] = OPS_SCREENS['lg-cal'];
}
function lgpMoveForm(id) {
  const load = lgLoad(id);
  modal(`Move ${lgLoadName(load)} to another day`, `<p>It is set for <b>${lgDay(load.date)}</b>.</p>
    <label class="field">New day<input id="lgp-day" type="date" min="${lgToday()}" value="${load.date}"></label>
    <p class="source">The checks run again for the new day. ${lgLoadUnits(load).some((u) => u.leg !== 'plant-lot') && load.state === 'scheduled' ? 'The customer has to be told the new day.' : ''}</p>
    <div class="actions">${button('Keep the day', 'closeModal()', 'secondary')}${button('Move it', `lgpMove('${id}')`)}</div>`);
}
function lgpMove(id, sure) {
  const load = lgLoad(id), day = sure ? LGP.moveTo : $('#lgp-day').value, old = load.date;
  if (!day || day < lgToday()) return toast('Pick today or a later day.');
  if (day === old) return closeModal();
  load.date = day;
  const warns = lggWarns(load);
  if (warns.length && !sure) {
    load.date = old;
    LGP.moveTo = day;
    modal(`${lgDay(day)} has ${lgPlural(warns.length, 'warning')}`, `<p>Moving <strong>${lgLoadName(load)}</strong> to ${lgDay(day)} gives ${warns.length === 1 ? 'this warning' : 'these warnings'}:</p>
      <ul class="lgg-warnlist">${warns.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>
      <label class="field">Why is it OK to move it anyway?<input id="lgp-why" maxlength="160" placeholder="Example: the lot said someone will be there"></label>
      <div class="actions">${button('Go back', `lgpMoveForm('${id}')`, 'secondary')}${button('Move it', `lgpMove('${id}',true)`)}</div>`);
    return document.getElementById('lgp-why')?.focus();
  }
  if (sure && warns.length) {
    const reason = ($('#lgp-why')?.value || '').trim();
    if (reason.length < 3) return (load.date = old), toast('Type a reason first.');
    load.why = { reason, at: Date.now(), sig: lggSig(warns) };
    lgNote(load, `Moved with ${lgPlural(warns.length, 'warning')}. Reason: ${reason}`);
  }
  load.date = old;
  closeModal();
  lgSet(id, 'date', day); /* Turbo Logistics: updateOrgRoute; a scheduled load tells the salesperson the day changed */
  if (load.state === 'scheduled')
    for (const u of lgLoadUnits(load).filter((x) => x.leg !== 'plant-lot')) {
      const s = lgSale(u), auto = LG.set.tell === 'auto';
      u.told = auto ? { how: 'auto', at: Date.now() } : null;
      if (s) (s.deliverOn = day), (s.toldCustomer = auto), ofLog(s, `Logistics moved the delivery to ${lgDay(day)}${auto ? '' : ' · Logistics tells the customer the new day'}`);
    }
  lgNote(load, `Moved from ${lgDay(old)} to ${lgDay(day)}`);
  render();
  toast(`${lgLoadName(load)} moved to ${lgDay(day)}.`);
}

/* ---------- 3. One permit block ----------
   Turbo Logistics: one manual flag, "Permit required" (LogisticsRoutePermitControl), and permit notes. */
function lgpPermitBlock(load) {
  const id = load.id, open = lgxEditable(load), wide = lgLoadUnits(load).some(lgWide), needs = wide || load.permitReq;
  return `<h3>Permit</h3><div class="lgp-permit">
    ${wide ? `<p><span class="lgx-badge">Needs a permit</span> A building ${LG.set.wideFt} ft wide or wider needs a permit to go on the road${lgStates(load).length > 1 ? ` (${lgStates(load).join(', ')})` : ''}.</p>`
      : `<label class="checkrow"><input type="checkbox" ${load.permitReq ? 'checked' : ''} ${open ? '' : 'disabled'} onchange="lgxPermit('${id}',this.checked)"> This load needs a permit</label>`}
    ${needs ? `<label class="checkrow lg-permit"><input type="checkbox" ${load.permit ? 'checked' : ''} ${open ? '' : 'disabled'} onchange="lgSet('${id}','permit',this.checked)"> Permit confirmed: we have it</label>
      <label class="field">Permit notes<input maxlength="100" ${open ? '' : 'disabled'} value="${esc(load.permitNotes || '')}" placeholder="Example: SC oversize permit, escort from the state line" onchange="lgxPermitNotes('${id}',this.value)"></label>` : '<p class="of-soft">No permit needed.</p>'}
    <p class="source">${needs ? 'The permit notes print on the run sheet. ' : ''}${lgxTip('size-limits', '14 ft wide and permits')}</p></div>`;
}
{
  const base = lgxLoadPanel;
  lgxLoadPanel = function (load) {
    let html = base(load);
    if (!lgpOn()) return html;
    const cut = lggCut(html, '<h3>Permit</h3>', '<h3>Miles</h3>');
    if (cut) html = html.slice(0, cut[0]) + lgpPermitBlock(load) + '<h3>Miles</h3>' + html.slice(cut[1]);
    /* 9. the run sheet takes the manifest's place */
    return html.replace('<h2>Manifest, permit and miles</h2>', '<h2>Run sheet, permit and miles</h2>').replace(/(onclick="lgxManifest\('[^']*'\)">.*?) Manifest<\/button>/s, '$1 Run sheet</button>');
  };
  /* A permit that was asked for and not confirmed is a warning, wide or not. */
  const baseChecks = lgChecks;
  lgChecks = function (load) {
    const out = baseChecks(load);
    if (lgpOn()) for (const c of out) c.text = c.text.replace(/confirm the permit and escort, then tick “Permit confirmed”\.$/, 'get the permit, then tick “Permit confirmed”.');
    return out;
  };
}

/* ---------- The load page ---------- */
{
  const page = OPS_SCREENS['lg-load'];
  OPS_SCREENS['lg-load'] = function () {
    let html = page();
    if (!lgpOn()) return html;
    /* 3. the tick lives in the permit block now */
    html = html.replace(/<label class="checkrow lg-permit"><input type="checkbox"[^>]*> Permit confirmed for the wide load[^<]*<\/label>/, '');
    return html;
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-load'] = OPS_SCREENS['lg-load'];
}

/* ---------- 5. The map on a phone ----------
   A tap anywhere near a dot picks the nearest lot or plant, so every dot is easy to hit, and the lots are
   listed under the map. Turbo Logistics: LogisticsMapPanel (Google Maps). */
function lgpTap(ev) {
  const svg = ev.currentTarget.ownerSVGElement || ev.currentTarget, pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const at = pt.matrixTransform(svg.getScreenCTM().inverse());
  const all = [...LOTS.map((l) => ({ key: 'lot:' + l.id, xy: lgXY(l) })), ...PLANTS.map((p) => ({ key: 'plant:' + p.id, xy: lgXY(p) }))];
  const near = all.map((x) => ({ key: x.key, d: Math.hypot(x.xy[0] - at.x, x.xy[1] - at.y) })).sort((a, b) => a.d - b.d)[0];
  if (!near) return;
  ev.stopPropagation();
  LG.place = near.key;
  render();
}
{
  const base = lgMap;
  lgMap = function (load) {
    let html = base(load);
    if (!lgpOn()) return html;
    const hits = [...LOTS, ...PLANTS].map((p) => {
      const [x, y] = lgXY(p);
      return `<circle class="lgp-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="44" onclick="lgpTap(event)"/>`;
    }).join('');
    /* under the dots and tags, so a tap right on a load's tag still opens the load */
    html = html.replace('<g class="lg-spokes">', `<g class="lgp-hits">${hits}</g><g class="lg-spokes">`);
    const today = lgToday();
    const list = ['SC', 'NC', 'GA'].map((st) => `<h3>${STATE_NAME[st]}</h3><div class="lgp-lotlist">${LOTS.filter((l) => l.state === st).sort((a, b) => a.town.localeCompare(b.town)).map((l) => `<button type="button" class="${LG.place === 'lot:' + l.id ? 'on' : ''}" onclick="LG.place='lot:${l.id}';render();document.querySelector('.lg-places .stack')?.scrollIntoView({block:'start'})"><b>${esc(l.town)}</b><small>${lotDay(l, today).open ? 'Open today' : 'Closed today'}</small></button>`).join('')}</div>`).join('');
    return html + `<div class="lgp-maplist"><p><b>Pick a lot</b> Tap the map, or pick a town here.</p>${list}</div>`;
  };
}

/* ---------- 6. Service jobs: in the menu, in plain words ----------
   Turbo Service: the request, job and check-in steps (service_requests, service_events). The words here
   are this preview's; Turbo's own words show with PP.raw. */
const LGP_JOB_WORDS = [
  [/Request: Pending/g, 'Waiting for a yes or no'], [/Request: Needs info/g, 'Waiting for more details'], [/Request: Approved/g, 'Approved'], [/Request: Declined/g, 'Turned down'], [/Request: Cancelled/g, 'Cancelled'],
  [/From: Manufacturing auto/g, 'Asked for by: the system, when the building came back'], [/From: Sales/g, 'Asked for by: Sales'], [/From: Internal/g, 'Asked for by: our service team'], [/From: (Subscriber opportunity|Opportunity|Personal Assistant)/g, 'Asked for by: $1'],
  [/>Unscheduled</g, '>No day picked yet<'], [/>In progress</g, '>Being worked on<'], [/>Complete</g, '>Done<'],
  [/>No check-in</g, '>Customer not called yet<'], [/>Confirmed</g, '>Customer said yes<'], [/>Day before</g, '>Called the day before<'], [/>En route</g, '>On the way<'], [/>On site</g, '>At the building<'],
  [/Check in: Confirmed/g, 'Customer said yes'], [/Check in: Day before/g, 'Called the day before'], [/Check in: En route/g, 'On the way'], [/Check in: On site/g, 'At the building'], [/Check in: Complete/g, 'Job done'],
  [/>Needs info</g, '>Ask for more details<'], [/>Decline</g, '>Turn down<'],
  [/Internal upgrade ·/g, 'Fix up to sell again ·'], [/New service ·/g, 'New job ·'], [/Warranty service ·/g, 'Warranty visit ·'],
  [/(Repossessed|Returned) unit — internal upgrade for ([^<]*)/g, (m, kind, serial) => `${kind === 'Repossessed' ? 'Building taken back' : 'Building returned'}: fix it up to sell again (${serial})`],
  [/Route has no rig assigned — set a rig before dispatching stops\./g, 'No service truck picked yet.'], [/Rig has no capacity on file — verify equipment fit manually\./g, 'This service truck has no size saved. Check by hand that the gear fits.'],
  [/Event offering expects a ([a-z ]+) rig; assigned rig is ([a-z ]+)\./g, 'This job needs a $1 truck. The one picked is a $2 truck.'], [/Rig already has (\d+) other event\(s\) on [^<.]*\./g, 'This truck already has $1 other job that day.'],
  [/<h2>Service rigs<\/h2>/g, '<h2>Service trucks</h2>'], [/ · kind: ([a-z ]+) · capacity not on file/g, (m, k) => ` · ${k === 'other' ? 'service' : k} truck · no size saved`], [/ · kind: ([a-z ]+) · capacity ([^<]*)/g, (m, k, c) => ` · ${k === 'other' ? 'service' : k} truck · holds ${c}`],
  [/Made-up rigs and technicians\./g, 'Made-up trucks and workers.'],
  [/<li><b>Request<\/b>: [^<]*<\/li><li><b>Job<\/b>: [^<]*<\/li><li><b>Check-in<\/b> with the customer: [^<]*<\/li>/g, '<li><b>Someone asks</b> for a visit. Logistics says yes, asks for more details, or turns it down.</li><li><b>Pick a day</b> and a service truck.</li><li><b>Call the customer</b>: they say yes, a call the day before, on the way, at the building, done.</li>'],
  [/Service rig</g, 'Service truck<'], [/>No rig yet</g, '>No truck yet<'],
];
{
  const base = OPS_SCREENS['lg-service'];
  OPS_SCREENS['lg-service'] = function () {
    let html = base();
    if (!lgpOn()) return html;
    for (const [re, to] of LGP_JOB_WORDS) html = html.replace(re, to);
    html = html.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(/\brig(s?)\b/g, 'truck$1').replace(/\bRig(s?)\b/g, 'Truck$1') + '<');
    return html.replace(/<button class="link backlink" onclick="go\('logi'\)">.*?<\/button>/s, '');
  };
  /* Service jobs is its own menu entry now, not a page under Dispatch. */
  const baseDetail = opsDetail;
  opsDetail = function (page) {
    return page === 'lg-service' && lgpOn() ? null : baseDetail(page);
  };
  const baseForm = lgxJobPlanForm;
  lgxJobPlanForm = function (id) {
    baseForm(id);
    if (!lgpOn()) return;
    const m = document.querySelector('.modal');
    if (m) m.innerHTML = m.innerHTML.replace('Service rig<', 'Service truck<').replace('No rig yet', 'No truck yet').replace('A service rig is not a delivery trailer: it carries tools and a technician. Warnings about the rig show on the job after it is saved.', 'A service truck is not a delivery trailer. It carries tools and a worker.');
  };
}

/* ---------- 7. Damage needs proof ----------
   Turbo Ops owns the proof form (FastField). Asking for a note and a photo when damage is marked is a
   feature the product still has to accept. */
{
  const baseForm = lgDropForm;
  lgDropForm = function (id, i) {
    const out = baseForm(id, i), cond = document.getElementById('lg-cond');
    if (cond && lgpOn()) {
      cond.setAttribute('onchange', 'lgpDamage()');
      cond.closest('label').insertAdjacentHTML('afterend', '<p class="notice lgp-damage" id="lgp-damage" hidden></p>');
    }
    return out;
  };
  const baseSave = lgDropSave;
  lgDropSave = function (id, i) {
    if (lgpOn() && $('#lg-cond')?.value === 'Damage noted') {
      const note = ($('#lg-dropnote')?.value || '').trim(), photo = $('#lg-photo')?.files?.[0];
      if (note.length < 3 || !photo) return lgpDamage(), toast(note.length < 3 && !photo ? 'Damage needs a note and a photo.' : note.length < 3 ? 'Say what is damaged.' : 'Take a photo of the damage.');
    }
    return baseSave(id, i);
  };
}
function lgpDamage() {
  const bad = $('#lg-cond')?.value === 'Damage noted', box = $('#lgp-damage');
  if (box) (box.hidden = !bad), (box.textContent = bad ? 'Damage needs two things before you can finish: a note saying what is damaged, and a photo.' : '');
  const set = (sel, a, b) => {
    const label = document.querySelector(sel)?.closest('label'), node = label?.firstChild;
    if (node && node.nodeType === 3) node.textContent = bad ? a : b;
  };
  set('#lg-dropnote', 'What is damaged (needed)', 'Notes (optional)');
  set('#lg-photo', 'Photo of the damage (needed)', 'Photo on the lot (optional)');
}

/* ---------- 8. Small slips ---------- */
/* "Cancel load ad?" */
lgCancelForm = function (id) {
  const load = lgLoad(id);
  modal(`Cancel ${lgLoadName(load)}?`, `<p>Its ${lgPlural(lgLoadUnits(load).length, 'building')} go back to the board, ready for another load.</p>
    <div class="actions">${button('Cancel it', `lgCancel('${id}')`)}${button('Keep it', 'closeModal()', 'secondary')}</div>`);
};
/* The red "past the usual delivery time" chip opens the list of those buildings. */
function lgpLate() {
  const late = LG.units.filter((u) => u.leg && lgxLead(u)?.late);
  modal(`${lgPlural(late.length, 'customer building')} past the usual delivery time`, `<p>These were promised sooner than they are moving. Get each one on a load.</p>
    ${late.map((u) => {
      const lead = lgxLead(u), on = lgOnLoad(u);
      return `<div class="od-doc"><div class="grow"><strong>${esc(u.name)} · ${esc(u.customer)}</strong><small><span class="serial">${esc(u.id)}</span> · to ${esc(lgDest(u))} · it was due by ${lgDay(lead.by)}</small></div>${on ? `<button type="button" class="secondary small" onclick="closeModal();lgOpen('${on.id}')">Open ${lgLoadName(on)}</button>` : `<button type="button" class="secondary small" onclick="closeModal();LG.q='${esc(u.id)}';go('logi')">Find it on the board</button>`}</div>`;
    }).join('')}
    <div class="actions">${button('Close', 'closeModal()', 'secondary')}</div>`);
}
{
  const board = OPS_SCREENS.logi;
  OPS_SCREENS.logi = function () {
    const html = board();
    if (!lgpOn()) return html;
    return html.replace(/<span class="ops-flag bad">(\d+ customer buildings? past the usual delivery time)<\/span>/, '<button type="button" class="ops-flag bad lgp-late" onclick="lgpLate()">$1 · show</button>')
      .replace(/<button type="button" class="chipbtn" onclick="go\('lg-service'\)">/, '<button type="button" class="chipbtn lgp-servicebtn" onclick="go(\'lg-service\')">');
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS.logi = OPS_SCREENS.logi;
  /* A home stop said its miles twice when it is the first stop from the lot. */
  const baseStop = lgStopCard;
  lgStopCard = function (load, i, big) {
    let html = baseStop(load, i, big);
    if (!lgpOn()) return html;
    if (!lgStopIsLot(load.stops[i]) && i === 0 && load.from.type === 'lot') html = html.replace(/ · about [\d.]+ mi from the lot<\/small>/, '</small>');
    return html;
  };
}
/* The drive-time table: a typed time no longer hides the road time, and one button goes back to it. */
dtTable = function (fromId) {
  const places = [...PLANTS, ...LOTS], from = places.find((p) => dtId(p) === (fromId || dtFrom)) || PLANTS[0];
  dtFrom = dtId(from);
  const name = (p) => (PLANTS.includes(p) ? p.name : lotTown(p));
  const rows = places.filter((p) => p !== from).map((p) => ({ p, row: dtRow(from, p) })).sort((a, b) => a.row.miles - b.row.miles);
  const road = (row) => (row.car != null ? `road time ${dtLong(row.car * dtSlow(DT.set.mph))} · ${dtLong(row.car)} by car` : `estimate ${dtLong((row.miles / DT.set.mph) * 60)}`);
  modal('Drive-time table', `<label class="field">From<select onchange="dtTable(this.value)">${places.map((p) => `<option value="${dtId(p)}" ${p === from ? 'selected' : ''}>${esc(name(p))}</option>`).join('')}</select></label>
    <p class="source">Minutes for a loaded truck: the road’s car time plus ${DT.set.truckPct}%. If your drivers know a trip takes longer or shorter, type their time. It is used from then on, both ways. The road time stays in view, and “Use the road time” goes back to it.</p>
    <div class="dt-table">${rows.map(({ p, row }) => `<div class="dt-pair${row.min != null ? ' typed' : row.car != null ? ' real' : ''}"><span class="grow"><b>${esc(name(p))}</b><small>${Math.round(row.miles)} mi · ${row.min != null ? `<b>your time ${dtLong(row.min)}</b> · ` : ''}${road(row)}</small>${row.min != null ? `<button type="button" class="link lgp-useroad" onclick="dtReal('${dtId(from)}','${dtId(p)}','')">Use the road time</button>` : ''}</span><label><input type="number" min="1" max="900" step="1" placeholder="${Math.round(row.car != null ? row.car * dtSlow(DT.set.mph) : (row.miles / DT.set.mph) * 60)}" value="${row.min ?? ''}" aria-label="Your drivers’ minutes to ${esc(name(p))}" onchange="dtReal('${dtId(from)}','${dtId(p)}',this.value)"> min</label></div>`).join('')}</div>`);
};

/* One "Viewing as": the Loads screen follows the gear's choice instead of its own switch.
   Turbo Logistics roles: logistics_coordinator, driver, third_party_hauler_subcoordinator (HaulerAppShell). */
if (typeof AD === 'object' && !AD.users.some((u) => u.roles.includes('third_party_hauler_subcoordinator')))
  AD.users.push({ id: 'u14', name: 'Jesse Pruitt', email: 'jesse.pruitt@example.com', title: 'Outside hauler', kind: 'user', roles: ['third_party_hauler_subcoordinator'], lots: 'all', access: {}, status: 'active', carrierId: 'hauler-a' });
const lgpRole = () => {
  const me = typeof adMe === 'function' ? adMe() : null, roles = me?.roles || [];
  return !me ? null : roles.includes('third_party_hauler_subcoordinator') ? 'hauler' : roles.includes('driver') ? 'driver' : null;
};
function lgpViewAs(id) {
  if (id) LGP.prev = AD.me;
  adView(id || LGP.prev || 'u1');
}
{
  const base = OPS_SCREENS['lg-loads'];
  OPS_SCREENS['lg-loads'] = function () {
    if (!lgpOn() || typeof adMe !== 'function') return base();
    const me = adMe(), role = lgpRole(), outside = LG.carriers.filter((c) => ['contracted', 'freelance'].includes(c.kind));
    LGX.viewAs = role === 'driver' ? 'driver' : role === 'hauler' ? 'hauler:' + (lgCarrier(me.carrierId) ? me.carrierId : outside[0]?.id) : 'coordinator';
    const driver = AD.users.find((u) => u.roles.includes('driver')), hauler = AD.users.find((u) => u.roles.includes('third_party_hauler_subcoordinator'));
    const line = role
      ? `<p class="lgp-viewline">${icon('user', 16)} You are looking at this as <b>${esc(me.name)}</b>, ${role === 'driver' ? 'a driver' : 'an outside hauler'}. ${role === 'hauler' ? 'You can look, not change, and you see only your own loads.' : ''} <button type="button" class="link inline" onclick="adView('${LGP.prev || 'u1'}')">Go back to my own view</button></p>`
      : `<p class="lgp-viewline">You see every load. To see what others see: ${driver ? `<button type="button" class="link inline" onclick="lgpViewAs('${driver.id}')">a driver</button>` : ''}${driver && hauler ? ' · ' : ''}${hauler ? `<button type="button" class="link inline" onclick="lgpViewAs('${hauler.id}')">an outside hauler</button>` : ''}. The gear’s “Viewing as” does the same.</p>`;
    return base().replace(/<div class="lgx-viewas">.*?<\/small><\/div>/s, line);
  };
  if (typeof LOGI_SCREENS === 'object') LOGI_SCREENS['lg-loads'] = OPS_SCREENS['lg-loads'];
  /* The hauler's own screen, in plain words. */
  const baseHauler = lgxHaulerView;
  lgxHaulerView = function (car) {
    const html = baseHauler(car);
    if (!lgpOn()) return html;
    return html.replace(/<small>Stop (\d+) · plant origin<\/small>/g, '<small>Stop $1 · Pick up at the plant</small>')
      .replace(/<small>Stop 1 · dealer holding<\/small>/g, '<small>Stop 1 · Pick up at the lot</small>')
      .replace(/<small>Stop (\d+) · dealer holding<\/small>/g, '<small>Stop $1 · Drop at the lot</small>')
      .replace(/<small>Stop (\d+) · end customer<\/small>/g, '<small>Stop $1 · Customer’s home</small>')
      .replace(/<h2>([^<]*) · Unscheduled<\/h2>/g, '<h2>$1 · No day picked yet</h2>')
      .replace(/No active routes assigned to/g, 'No loads right now for');
  };
}

/* ---------- 9. The run sheet ---------- */
function lgpRunSheetHtml(load) {
  const p = dtPlan(load), rig = lgRig(load.rigId), car = rig && lgCarrier(rig.carrierId), mi = lggMiles(load), origin = lgOrigin(load), units = lgLoadUnits(load);
  const long = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const promise = load.window && load.window !== 'Date only' ? load.windowNote || load.window : '';
  const bld = (u) => `<li><b>${u.wid} × ${u.len}</b> ${esc(u.name.replace(u.size, '').trim())} · serial <span class="serial">${esc(u.id)}</span>${u.kind === 'order' ? ` · for ${esc(u.customer)}` : ' · lot stock'}${lgWide(u) ? ' · <b>wide load</b>' : ''}</li>`;
  const stops = p.stops.map((s, i) => {
    const st = s.stop, lot = lgStopLot(st), list = lgStopUnits(st);
    if (s.isLot)
      return `<li><div class="lgp-rs-n">${i + 1}</div><div><h4>${esc(lot.town)} lot · drop ${lgPlural(list.length, 'building')}</h4>
        <p>${esc(placeAddress(lot))} · <b>${esc(lot.phone)}</b></p>
        <p>${s.real === 'done' ? `Done: got there ${dtClock(s.arrive)}, left ${dtClock(s.leave)}` : `Get there about <b>${dtClock(s.arrive)}</b>`}${load.date ? ` · ${esc(lotDay(lot, load.date).text)}` : ''}</p><ul>${list.map(bld).join('')}</ul></div></li>`;
    const u = list[0], sale = lgSale(u), to = sale ? orderInvoice(sale).shipTo : null, site = lgSite(u);
    return `<li><div class="lgp-rs-n">${i + 1}</div><div><h4>${esc(u.customer)} · set the building at the customer’s home</h4>
      <p>${to && (to.street || to.city) ? esc([to.street, to.city].filter(Boolean).join(', ')) : `About ${site?.miles ?? '?'} miles from the ${esc(lot.town)} lot. Ask the lot for the address.`}${to?.phone ? ` · <b>${esc(to.phone)}</b>` : ''}</p>
      <p>${s.real === 'done' ? `Done: got there ${dtClock(s.arrive)}, left ${dtClock(s.leave)}` : `Get there about <b>${dtClock(s.arrive)}</b>`}${promise ? ` · the customer was told: ${esc(promise.toLowerCase())}` : ''}</p>
      ${site ? `<p>At the site: ${esc([site.access, site.noGate ? 'no gate' : site.gate ? site.gate + ' ft gate' : '', site.ground, site.notes].filter(Boolean).join(' · '))}</p>` : ''}<ul>${list.map(bld).join('')}</ul></div></li>`;
  }).join('');
  const permit = units.some(lgWide) || load.permitReq ? `<p><b>Permit:</b> ${load.permit ? 'we have it' : 'NOT confirmed yet'}${load.permitNotes ? ' · ' + esc(load.permitNotes) : ''}</p>` : '';
  return `<div class="lgp-rs"><div class="lgp-rs-head"><div><small>Bennett Buildings · run sheet</small><h3>${lgLoadName(load)} · ${load.date ? long(load.date) : 'no day picked yet'}</h3></div><div class="lgp-rs-count"><b>${units.length}</b><span>building${units.length === 1 ? '' : 's'}</span></div></div>
    <div class="lgp-rs-facts"><span><small>Trailer</small><b>${esc(rig?.name || 'Not picked')}${rig?.feet ? ` · ${rig.feet} ft` : ''}</b></span><span><small>Driver</small><b>${esc(load.driver || 'Not set')}</b></span><span><small>Hauler</small><b>${esc(car?.name || '')}</b></span><span><small>${p.live ? 'Left' : 'Leaves'}</small><b>${dtClock(p.start)}</b></span><span><small>Miles</small><b>${mi ? mi.text : '—'}</b></span><span><small>Back about</small><b>${dtClock(p.end)}</b></span></div>
    ${permit}${load.why ? `<p><b>Note from dispatch:</b> ${esc(load.why.reason)}</p>` : ''}
    <ol class="lgp-rs-stops"><li class="start"><div class="lgp-rs-n">${icon(load.from.type === 'plant' ? 'build' : 'lot', 16)}</div><div><h4>Start: ${esc(lgOriginName(load))}</h4><p>${esc(placeAddress(origin))}${origin.phone ? ` · <b>${esc(origin.phone)}</b>` : ''}</p><p>Load the last stop’s building first, so the first stop’s building comes off first.</p></div></li>
      ${stops}
      <li class="start"><div class="lgp-rs-n">${icon('check', 16)}</div><div><h4>Back at ${esc(lgOriginName(load))}</h4><p>About <b>${dtClock(p.end)}</b> · ${Math.round(p.back.miles)} miles back, empty</p></div></li></ol>
    <p class="source">Times are a plan, not a promise: saved road times plus time to unload. Made-up names and sample buildings in this preview.</p></div>`;
}
function lgpRunSheet(id) {
  const load = lgLoad(id);
  modal(`Run sheet · ${lgLoadName(load)}`, `${lgpRunSheetHtml(load)}
    <div class="actions no-print">${button('Print', `lgpRunSheetPrint('${id}')`, 'secondary')}${button('Email it to the hauler', `lgxManifestEmail('${id}')`, 'secondary')}${S.sfNotes ? button('Turbo Assist’s version', `lgxManifest('${id}',true)`, 'secondary') : ''}${button('Close', 'closeModal()', 'secondary')}</div>
    ${S.sfNotes ? '' : '<p class="source no-print">One sheet for the whole trip. Turbo Assist prints one page for each building; that version shows when builder notes are on.</p>'}`);
  $('.modal')?.classList.add('wide');
}
/* Printing: the page prints only the run sheet, then comes back. */
function lgpRunSheetPrint(id) {
  let box = $('#lgp-print');
  if (!box) document.body.insertAdjacentHTML('beforeend', '<div id="lgp-print"></div>'), (box = $('#lgp-print'));
  box.innerHTML = lgpRunSheetHtml(lgLoad(id));
  document.body.classList.add('lgp-printing');
  const done = () => document.body.classList.remove('lgp-printing');
  addEventListener('afterprint', done, { once: true });
  setTimeout(done, 60000);
  print();
}
{
  const turbo = lgxManifest;
  lgxManifest = function (id, turboVersion) {
    return !lgpOn() || turboVersion ? turbo(id) : lgpRunSheet(id);
  };
  const baseEmail = lgxManifestEmail;
  lgxManifestEmail = function (id) {
    baseEmail(id);
    if (!lgpOn()) return;
    const m = document.querySelector('.modal');
    if (m) m.innerHTML = m.innerHTML.replace('Email route manifest', 'Email the run sheet').replace('Sends a PDF snapshot (stops, contacts, notes) to the hauler. Paper-trail fallback when they won’t use a login.', 'Sends the run sheet to the hauler: every stop, the phone numbers and the notes. Good for a hauler who does not sign in.').replace('Back to the manifest', 'Back to the run sheet');
  };
}

if (typeof taNotesFor === 'function') {
  taNotesFor('lg-load', [['Run sheet', '<code>emailLogisticsRouteManifest</code> and <code>manifestSnapshotToTextLines</code> (server/logi-services/routeManifestService.ts) print one manifest per building. The run sheet is a proposal: one sheet for the whole trip.']], ['Arrival times that follow the truck once it is rolling.', 'A second load on the same trailer leaving when the first is back.', 'A warning when a stop is outside the area a hauler covers.', 'A note and a photo needed when damage is marked.']);
  taNotesFor('lg-cal', [], ['Counting loads instead of buildings, leave and back times on each card, a mark on a load with a closed stop, and moving a load to another day.']);
  taNotesFor('lg-places', [], ['The list of lots under the map on a phone, and a tap that picks the nearest lot.']);
  taNotesFor('lg-service', [], ['Plain words for the request, job and check-in steps.']);
}
