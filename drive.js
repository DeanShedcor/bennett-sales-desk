/* drive.js: drive time in load planning, read from a stored table instead of a live map service.

   DT.table holds the road miles and minutes between every pair of fixed places (the plants and
   the lots). Today every row is an ESTIMATE: straight-line distance with a road factor, at a
   truck's speed. A row can be replaced with a real road time (Trailers screen, Drive-time table)
   and is then marked as real. A customer's home is reached from their lot using the miles on the
   delivery site record.
   Turbo Assist (bennett-buddy b42d324) measures route miles with a map service and a straight-line
   fallback (computeOrgRouteMileage) and has no drive time, arrival times or driving-hours check:
   those are only in this preview.
   Loaded after the Logistics files. */

const DT = {
  set: { mph: 50, wideMph: 45, emptyMph: 55, lotMin: 20, homeMin: 60, leave: '07:00', maxDrive: 11, maxDay: 14 },
  table: {},
};
const dtKey = (a, b) => [a, b].sort().join('|');
const dtId = (p) => (PLANTS.includes(p) ? 'plant:' : 'lot:') + p.id;
/* Fill the table once: every plant and lot against every other. */
(function dtSeed() {
  const places = [...PLANTS, ...LOTS];
  for (let i = 0; i < places.length; i++)
    for (let j = i + 1; j < places.length; j++) {
      const miles = milesBetween(places[i], places[j]) || 0;
      DT.table[dtKey(dtId(places[i]), dtId(places[j]))] = { miles, min: null, real: false };
    }
})();
const dtRow = (a, b) => (a === b ? { miles: 0, min: 0, real: true } : DT.table[dtKey(dtId(a), dtId(b))] || { miles: milesBetween(a, b) || 0, min: null, real: false });
const dtClock = (min) => {
  const m = Math.round(min), h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}${m >= 1440 ? ' next day' : ''}`;
};
const dtLong = (min) => {
  const m = Math.round(min / 5) * 5, h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
};
const dtStart = (load) => {
  const [h, m] = (load.leave || DT.set.leave).split(':').map(Number);
  return h * 60 + (m || 0);
};
/* One leg: miles and minutes between two spots ({ p: place, extra: miles past it to a home }). */
function dtLeg(a, b, mph) {
  const row = dtRow(a.p, b.p), extra = a.extra + b.extra, miles = row.miles + extra;
  /* A stored real time is kept as it is; the miles to a home past the lot are added at truck speed. */
  const min = row.min != null ? row.min + (extra / mph) * 60 : (miles / mph) * 60;
  return { miles, min, real: row.min != null && !extra };
}
/* The whole run: leave, each stop's arrival, wait, unload and departure, then home again. */
function dtPlan(load) {
  const origin = { p: lgOrigin(load), extra: 0 }, wide = lgLoadUnits(load).some(lgWide), mph = wide ? DT.set.wideMph : DT.set.mph;
  const day = load.date ? new Date(load.date + 'T12:00:00').getDay() : null;
  let at = origin, t = dtStart(load), drive = 0, onSite = 0, miles = 0, allReal = true;
  const stops = load.stops.map((stop) => {
    const next = lgSpot(stop), leg = dtLeg(at, next, mph), isLot = lgStopIsLot(stop), n = stop.units.length;
    const arrive = t + leg.min, unload = n * (isLot ? DT.set.lotMin : DT.set.homeMin);
    let wait = 0, flag = null, hours = '';
    if (isLot && load.date) {
      const lot = lgStopLot(stop), d = lotDay(lot, load.date), h = lot.hours[day];
      hours = d.text;
      if (d.open && Array.isArray(h)) {
        if (arrive < h[0] * 60) (wait = h[0] * 60 - arrive), (flag = { level: 'info', text: `arrives ${dtLong(wait)} before the lot opens at ${clock(h[0])}` });
        else if (arrive + unload > h[1] * 60) flag = { level: 'warn', text: arrive > h[1] * 60 ? `arrives after the lot closes at ${clock(h[1])}` : `still unloading when the lot closes at ${clock(h[1])}` };
      }
    }
    const leave = arrive + wait + unload;
    drive += leg.min;
    onSite += wait + unload;
    miles += leg.miles;
    allReal = allReal && leg.real;
    at = next;
    t = leave;
    return { stop, isLot, name: isLot ? lgStopLot(stop).town + ' lot' : lgStopUnits(stop)[0].customer, leg, arrive, wait, unload, leave, flag, hours, n };
  });
  const back = stops.length ? dtLeg(at, origin, DT.set.emptyMph) : { miles: 0, min: 0, real: true };
  drive += back.min;
  miles += back.miles;
  const end = t + back.min, start = dtStart(load);
  return { start, stops, back, end, drive, onSite, miles, day: end - start, wide, mph, allReal: allReal && back.real };
}
function dtLeave(id, value) {
  const load = lgLoad(id);
  if (!load || !/^\d\d:\d\d$/.test(value)) return;
  load.leave = value;
  lgNote(load, `Leaves at ${dtClock(dtStart(load))}`);
  render();
}
function dtPanel(load) {
  if (!load.stops.length) return '';
  const p = dtPlan(load), open = ['planned', 'scheduled'].includes(load.state), from = lgOriginName(load);
  const over = p.drive > DT.set.maxDrive * 60, long = p.day > DT.set.maxDay * 60;
  return `<section class="panel dt-panel"><div class="panelhead"><h2>Drive time</h2><span class="pill ${p.allReal ? 'good' : 'amber'}">${p.allReal ? 'Road times' : 'Estimate'}</span></div>
    <div class="dt-top"><label>Leaves at<input type="time" value="${load.leave || DT.set.leave}" ${open ? '' : 'disabled'} onchange="dtLeave('${load.id}',this.value)"></label>
      <div class="dt-sum"><span><b>${dtLong(p.drive)}</b>driving</span><span><b>${dtLong(p.onSite)}</b>at stops</span><span><b>${Math.round(p.miles)} mi</b>round trip</span><span class="${long ? 'bad' : ''}"><b>${dtClock(p.end)}</b>back at ${esc(load.from.type === 'plant' ? 'the plant' : 'the lot')}</span></div></div>
    <ol class="dt-line"><li class="go"><time>${dtClock(p.start)}</time><div><b>Leave ${esc(from)}</b><small>${p.wide ? `Wide load: figured at ${DT.set.wideMph} mph` : `Loaded truck: figured at ${DT.set.mph} mph`}</small></div></li>
      ${p.stops.map((s) => `<li class="drive"><time></time><div><small>${dtLong(s.leg.min)} · ${Math.round(s.leg.miles)} mi${s.leg.real ? ' · road time' : ''}</small></div></li>
        <li class="${s.flag ? s.flag.level : ''}"><time>${dtClock(s.arrive)}</time><div><b>${esc(s.name)}</b><small>Unload ${s.n} building${s.n === 1 ? '' : 's'}: ${dtLong(s.unload)} · leaves ${dtClock(s.leave)}${s.hours ? ' · ' + esc(s.hours) : ''}</small>${s.flag ? `<small class="dt-flag">${esc(s.flag.text.charAt(0).toUpperCase() + s.flag.text.slice(1))}</small>` : ''}</div></li>`).join('')}
      <li class="drive"><time></time><div><small>${dtLong(p.back.min)} · ${Math.round(p.back.miles)} mi back, empty</small></div></li>
      <li class="go"><time>${dtClock(p.end)}</time><div><b>Back at ${esc(from)}</b><small>${dtLong(p.day)} from leaving to back</small></div></li></ol>
    ${over ? `<p class="notice">${icon('alert', 16)} ${dtLong(p.drive)} of driving is over the ${DT.set.maxDrive} hours one driver may drive in a day. Split the run or plan an overnight.</p>` : long ? `<p class="notice">${icon('alert', 16)} ${dtLong(p.day)} on duty is over the ${DT.set.maxDay}-hour day. Split the run or plan an overnight.</p>` : ''}
    <p class="source">${p.allReal ? 'From the stored road times.' : 'Estimated from distance and truck speed, not from a road map yet. Real routes can run 10 to 20 percent longer.'} ${load.date ? '' : 'Pick a day to check each lot’s hours. '}Speeds and unload times are set on the Trailers screen.</p></section>`;
}
/* The same plan, in the places a dispatcher already looks. */
{
  const base = lgChecks;
  lgChecks = function (load) {
    const out = base(load);
    if (!load.stops.length || !['planned', 'scheduled'].includes(load.state)) return out;
    const p = dtPlan(load);
    for (const s of p.stops) if (s.flag?.level === 'warn') out.push({ level: 'warn', text: `${s.name}: the truck ${s.flag.text} (leaving at ${dtClock(p.start)}).`, dt: true });
    if (p.drive > DT.set.maxDrive * 60) out.push({ level: 'warn', text: `About ${dtLong(p.drive)} of driving: over the ${DT.set.maxDrive} hours one driver may drive in a day.`, dt: true });
    else if (p.day > DT.set.maxDay * 60) out.push({ level: 'warn', text: `About ${dtLong(p.day)} from leaving to back: over the ${DT.set.maxDay}-hour day.`, dt: true });
    return out;
  };
  const baseStop = lgStopCard;
  lgStopCard = function (load, i, big) {
    const html = baseStop(load, i, big), s = load.stops[i]?.done ? null : dtPlan(load).stops[i], at = html.indexOf('<ul class="lg-stopunits">');
    return !s || at < 0 ? html : html.slice(0, at) + `<small class="dt-eta">Arrives about ${dtClock(s.arrive)} · ${dtLong(s.leg.min)} drive</small>` + html.slice(at);
  };
  const baseRow = lgLoadRow;
  lgLoadRow = function (load) {
    const html = baseRow(load);
    if (!load.stops.length || ['delivered', 'cancelled'].includes(load.state)) return html;
    const p = dtPlan(load), i = html.indexOf('<div class="ops-flags">'), j = i < 0 ? -1 : html.indexOf('</div>', i);
    return j < 0 ? html : html.slice(0, j) + `<span class="ops-flag ${p.drive > DT.set.maxDrive * 60 ? 'bad' : ''}">About ${dtLong(p.drive)} driving · back ${dtClock(p.end)}</span>` + html.slice(j);
  };
  const page = OPS_SCREENS['lg-load'];
  OPS_SCREENS['lg-load'] = function () {
    const html = page(), load = lgLoad(LG.loadId), mark = '<section class="panel"><h2>History</h2>', at = html.indexOf(mark);
    return !load || at < 0 ? html : html.slice(0, at) + dtPanel(load) + html.slice(at);
  };
  const fleet = OPS_SCREENS['lg-fleet'];
  OPS_SCREENS['lg-fleet'] = function () {
    const html = fleet(), at = html.lastIndexOf('<details class="ops-notes"'), real = Object.values(DT.table).filter((r) => r.min != null).length, all = Object.keys(DT.table).length;
    const num = (key, label, unit, min, max) => `<label>${label}<span><input type="number" min="${min}" max="${max}" value="${DT.set[key]}" onchange="dtSet('${key}',this.value,${min},${max})"> ${unit}</span></label>`;
    const card = `<section class="panel dt-settings"><div class="panelhead"><h2>Drive time</h2><span class="pill ${real === all ? 'good' : 'amber'}">${real} of ${all} pairs are road times</span></div>
      <p>Load planning figures drive time from a stored table of every plant and lot pair, so it does not depend on an outside map service.</p>
      <div class="dt-fields">${num('mph', 'Loaded truck', 'mph', 25, 70)}${num('wideMph', 'Wide load', 'mph', 25, 70)}${num('emptyMph', 'Coming back empty', 'mph', 25, 75)}${num('lotMin', 'Unload at a lot, each building', 'min', 5, 120)}${num('homeMin', 'Set a building at a home', 'min', 10, 240)}${num('maxDrive', 'Most driving in a day', 'hours', 4, 14)}<label>Usual time to leave<span><input type="time" value="${DT.set.leave}" onchange="DT.set.leave=this.value;render()"></span></label></div>
      <div class="actions">${button('Open the drive-time table', 'dtTable()', 'secondary')}</div>
      <p class="source">Every time is an estimate until a real road time is typed into the table. Eleven hours of driving and a fourteen-hour day are the federal limits for one driver.</p></section>`;
    return at < 0 ? html + card : html.slice(0, at) + card + html.slice(at);
  };
}
function dtSet(key, raw, min, max) {
  const v = Number(raw);
  if (!(v >= min && v <= max)) return toast(`Use a number from ${min} to ${max}.`), render();
  DT.set[key] = v;
  render();
}
/* The table itself: from one place to every other, with a box to type the real road time. */
let dtFrom = null;
function dtTable(fromId) {
  const places = [...PLANTS, ...LOTS], from = places.find((p) => dtId(p) === (fromId || dtFrom)) || PLANTS[0];
  dtFrom = dtId(from);
  const name = (p) => (PLANTS.includes(p) ? p.name : lotTown(p));
  const rows = places.filter((p) => p !== from).map((p) => ({ p, row: dtRow(from, p) })).sort((a, b) => a.row.miles - b.row.miles);
  modal('Drive-time table', `<label class="field">From<select onchange="dtTable(this.value)">${places.map((p) => `<option value="${dtId(p)}" ${p === from ? 'selected' : ''}>${esc(name(p))}</option>`).join('')}</select></label>
    <p class="source">Minutes for a loaded truck. An estimate is the miles at ${DT.set.mph} mph. Type the real road time for a pair and it is used from then on, both ways.</p>
    <div class="dt-table">${rows.map(({ p, row }) => `<div class="dt-pair${row.min != null ? ' real' : ''}"><span class="grow"><b>${esc(name(p))}</b><small>${Math.round(row.miles)} mi · ${row.min != null ? 'road time' : 'estimate ' + dtLong((row.miles / DT.set.mph) * 60)}</small></span><label><input type="number" min="1" max="900" step="1" placeholder="${Math.round((row.miles / DT.set.mph) * 60)}" value="${row.min ?? ''}" aria-label="Real road minutes to ${esc(name(p))}" onchange="dtReal('${dtId(from)}','${dtId(p)}',this.value)"> min</label></div>`).join('')}</div>`);
}
function dtReal(a, b, raw) {
  const row = DT.table[dtKey(a, b)], v = String(raw).trim() === '' ? null : Math.round(Number(raw));
  if (!row || (v != null && !(v > 0 && v <= 900))) return toast('Type the minutes, 1 to 900, or leave it empty to go back to the estimate.');
  row.min = v;
  row.real = v != null;
  render();
  dtTable(a);
  toast(v == null ? 'Back to the estimate.' : 'Saved. Load planning uses it now, both ways.');
}
if (typeof taNotesFor === 'function') {
  taNotesFor('lg-load', [['Miles', '<code>computeOrgRouteMileage</code>: a map service, with straight-line miles as the fallback.']], ['Drive time, the arrival time at each stop checked against the lot’s hours, and the driving-hours check. Turbo Logistics has route miles only.', 'The stored table of drive times between every plant and lot, so planning does not wait on a map service. Every row is an estimate until a real road time is typed in.']);
  taNotesFor('lg-fleet', [], ['The drive-time settings and table.']);
}
