/* places.js: every Bennett sales lot and the plant that builds for them.

   The 22 lots, their street addresses, phone numbers and open days were copied from the lot pages
   on buybennett.com on Nov 14, 2026. To refresh, edit the LOTS list below. People are left out on
   purpose: this preview is public, so it keeps places and uses made-up people.

   The plant is ShedCor's plant in Orangeburg. More plants can be added on the Logistics side
   (Locations → Add a plant); each lot is served by one plant.

   Map positions are town-centre estimates, good enough for "about 85 miles" and a dot on a map.
   Real road miles come from Turbo Logistics (`computeOrgRouteMileage`).

   Loaded right after inventory.js, before core.js, so every side can use it. */

/* The Sales desk in this preview belongs to one lot. Orders made on it are that lot's orders;
   the Office and Logistics sides see every lot. */
const DESK_LOT = 'moncks-corner';
const deskSale = (s) => !s.lotId || s.lotId === DESK_LOT;

/* Hours for one day: [opens, closes] on a 24 hour clock, null when closed, 'appt' when the lot
   opens by appointment only. Seven days, Sunday first. */
const SHUT = null, APPT = 'appt';
const wk = (sun, mon, tue, wed, thu, fri, sat) => [sun, mon, tue, wed, thu, fri, sat];

const PLANTS = [
  { id: 'orangeburg', name: 'ShedCor plant', town: 'Orangeburg', state: 'SC', street: '3145 Magnolia St', zip: '29115', lat: 33.4918, lon: -80.8556 },
];

const LOTS = [
  { id: 'boiling-springs', town: 'Boiling Springs', state: 'SC', street: '9050 Asheville Hwy', zip: '29316', phone: '864-586-2900', lat: 35.0465, lon: -81.9818, hours: wk(SHUT, [9, 18], [9, 18], [9, 18], [9, 18], [9, 18], [9, 15]) },
  { id: 'brunswick', town: 'Brunswick', state: 'GA', street: '6785 New Jesup Hwy', zip: '31523', phone: '912-342-7027', lat: 31.19, lon: -81.54, hours: wk(SHUT, [10, 18], [10, 18], SHUT, [10, 18], [10, 18], [10, 14]) },
  { id: 'conover', town: 'Conover', state: 'NC', street: '920 Conover Blvd W', zip: '28613', phone: '828-465-6117', lat: 35.7065, lon: -81.2187, hours: wk(SHUT, [9, 17], [9, 17], [9, 17], [9, 17], [9, 14], APPT) },
  { id: 'conway', town: 'Conway', state: 'SC', street: '934 E Highway 501', zip: '29526', phone: '843-331-3408', lat: 33.836, lon: -79.0478, hours: wk(SHUT, [9, 17], [9, 17], [9, 17], [9, 17], [9, 14], APPT) },
  { id: 'cottageville', town: 'Cottageville', state: 'SC', street: '10257 Cottageville Hwy', zip: '29435', phone: '843-636-0379', lat: 32.9377, lon: -80.4829, hours: wk(APPT, APPT, [9, 17], [9, 17], [9, 17], [9, 17], [11, 16]) },
  { id: 'florence', town: 'Florence', state: 'SC', street: '2121 E Palmetto St', zip: '29506', phone: '843-407-6419', lat: 34.1954, lon: -79.7626, hours: wk(SHUT, [9.5, 18], [9.5, 18], [9.5, 18], [9.5, 18], [9, 17], [10, 14]) },
  { id: 'forest-city', town: 'Forest City', state: 'NC', street: '242 S Church St', zip: '28043', phone: '828-382-0167', lat: 35.334, lon: -81.8651, hours: wk(SHUT, [9, 17], [9, 17], SHUT, [9, 17], [9, 17], [10, 15]) },
  { id: 'graniteville', town: 'Graniteville', state: 'SC', street: '20 Chalk Bed Rd', zip: '29829', phone: '803-392-7101', lat: 33.5632, lon: -81.8079, hours: wk(SHUT, [9, 16], [10, 18], [10, 18], [10, 18], [9, 16], [10, 14]) },
  { id: 'lancaster', town: 'Lancaster', state: 'SC', street: '366 Lancaster Bypass E', zip: '29720', phone: '803-285-3445', lat: 34.7204, lon: -80.7709, hours: wk(SHUT, [9, 17], [9, 17], APPT, [9, 17], [9, 17], [10, 13]) },
  { id: 'lexington', town: 'Lexington', state: 'NC', street: '1634 Old U.S. Hwy 52', zip: '27295', phone: '336-300-8527', lat: 35.824, lon: -80.2534, hours: wk(SHUT, [9, 18], [9, 18], SHUT, [9, 18], [9, 18], [10, 14]) },
  { id: 'longs', town: 'Longs', state: 'SC', street: '1700 Hwy 9 E', zip: '29568', phone: '843-390-0922', lat: 33.9385, lon: -78.7331, hours: wk(SHUT, [9, 17], [9, 17], [9, 17], [9, 17], APPT, [9, 13]) },
  { id: 'lugoff', town: 'Lugoff', state: 'SC', street: '320 US-601', zip: '29078', phone: '803-572-5652', lat: 34.2271, lon: -80.6892, hours: wk(SHUT, [9, 18], SHUT, [9, 18], [9, 18], [9, 18], [10, 14]) },
  { id: 'mocksville', town: 'Mocksville', state: 'NC', street: '1765 Hwy 601 North', zip: '27028', phone: '336-677-0042', lat: 35.894, lon: -80.5614, hours: wk(SHUT, [10, 18], [10, 18], SHUT, [10, 18], [10, 18], [9.5, 14]) },
  { id: 'moncks-corner', town: 'Moncks Corner', state: 'SC', street: '3212 S Live Oak Dr', zip: '29461', phone: '843-291-7769', lat: 33.196, lon: -80.0131, hours: wk(SHUT, [9.5, 17.5], [9.5, 17.5], [9.5, 17.5], [9.5, 17.5], [9.5, 13], [9.5, 13]), firstSatClosed: true },
  { id: 'moncks-corner-2', town: 'Moncks Corner II', state: 'SC', street: '1023 US-17 ALT', zip: '29461', phone: '854-888-9892', lat: 33.19, lon: -79.99, hours: wk(SHUT, [9.5, 17.5], [9.5, 17.5], [9.5, 17.5], [9.5, 17.5], [9.5, 17.5], [9.5, 14]), note: 'The Hwy 52 lot' },
  { id: 'orangeburg', town: 'Orangeburg', state: 'SC', street: '3145 Magnolia St', zip: '29115', phone: '843-217-7972', lat: 33.4918, lon: -80.8556, hours: wk(SHUT, [9, 18], [9, 18], SHUT, [9, 18], [9, 16], [9, 13]), note: 'Same address as the plant' },
  { id: 'ravenel', town: 'Ravenel', state: 'SC', street: '5538 Savannah Hwy', zip: '29470', phone: '843-806-8594', lat: 32.7632, lon: -80.2423, hours: wk(SHUT, [10, 18], [10, 18], SHUT, [10, 18], [10, 18], [10, 14]) },
  { id: 'salisbury', town: 'Salisbury', state: 'NC', street: '1330 Jake Alexander Blvd W', zip: '28147', phone: '704-431-4672', lat: 35.671, lon: -80.4742, hours: wk(SHUT, SHUT, [9.5, 18], [9.5, 18], [9.5, 18], [9.5, 18], [9, 13]) },
  { id: 'statesboro', town: 'Statesboro', state: 'GA', street: '8724 US-301', zip: '30458', phone: '912-259-9905', lat: 32.4488, lon: -81.7832, hours: wk(SHUT, [10, 18], SHUT, [10, 18], [10, 18], [10, 18], [10, 14]) },
  { id: 'statesville', town: 'Statesville', state: 'NC', street: '590 Mocksville Hwy', zip: '28625', phone: '704-397-4221', lat: 35.7826, lon: -80.8873, hours: wk(APPT, [9.5, 18], [9.5, 18], [9.5, 18], APPT, [9.5, 18], [9.5, 16]) },
  { id: 'vidalia', town: 'Vidalia', state: 'GA', street: '3107 North St E', zip: '30474', phone: '478-484-4824', lat: 32.2177, lon: -82.4135, hours: wk(APPT, [9.5, 17.5], [9.5, 17.5], SHUT, [9.5, 17.5], [9.5, 17.5], [10, 14]) },
  { id: 'west-union', town: 'West Union', state: 'SC', street: '195 Garrett St', zip: '29696', phone: '864-916-2626', lat: 34.7579, lon: -83.0407, hours: wk(SHUT, [8.5, 17], [8.5, 17], [8.5, 17], [8.5, 17], [8.5, 17], [9, 14]) },
];

const STATE_NAME = { SC: 'South Carolina', NC: 'North Carolina', GA: 'Georgia' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const lotById = (id) => LOTS.find((l) => l.id === id);
const plantById = (id) => PLANTS.find((p) => p.id === id) || PLANTS[0];
const lotTown = (l) => `${l.town}, ${l.state}`;
const dealerName = (l) => `Bennett Buildings of ${l.town}`;
const placeAddress = (p) => `${p.street}, ${p.town.replace(/ II$/, '')}, ${p.state} ${p.zip}`;
/* "Bennett Buildings of Statesboro" → the Statesboro lot. */
const lotByDealer = (name) => LOTS.find((l) => name === dealerName(l)) || LOTS.find((l) => String(name || '').endsWith(l.town));
/* The lot an order was sold at. Orders made on this preview's Sales desk belong to its lot. */
const saleLot = (s) => lotById(s.lotId || DESK_LOT);

/* Straight-line miles between two places, stretched by 22% for roads and rounded to the nearest
   5. A real route can be longer; it is only ever shown as "about". */
function milesBetween(a, b) {
  if (!a || !b) return null;
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  const road = 3959 * 2 * Math.asin(Math.sqrt(h)) * 1.22;
  return road < 3 ? 0 : Math.max(5, Math.round(road / 5) * 5);
}
/* The plant that builds for a lot: the one it was set to, otherwise the nearest. */
function lotPlant(l) {
  return PLANTS.find((p) => p.id === l.plant) || PLANTS.slice().sort((a, b) => milesBetween(a, l) - milesBetween(b, l))[0];
}

/* Is a lot open on a date? `iso` is YYYY-MM-DD. Returns { open, appt, text }. */
const clock = (h) => `${((Math.floor(h) + 11) % 12) + 1}${h % 1 ? ':30' : ''} ${h < 12 ? 'AM' : 'PM'}`;
function lotDay(l, iso) {
  const d = new Date(iso + 'T12:00:00'), day = d.getDay(), h = l.hours[day];
  if (l.firstSatClosed && day === 6 && d.getDate() <= 7) return { open: false, appt: false, text: 'Closed the first Saturday of the month' };
  if (h === APPT) return { open: false, appt: true, text: `By appointment only on ${WEEKDAY[day]}s` };
  if (!h) return { open: false, appt: false, text: `Closed on ${WEEKDAY[day]}s` };
  return { open: true, appt: false, text: `Open ${clock(h[0])} to ${clock(h[1])}` };
}
/* One line for the whole week: "Mon–Fri 9 AM to 6 PM · Sat 9 AM to 3 PM · closed Sun". */
function lotWeek(l) {
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], order = [1, 2, 3, 4, 5, 6, 0];
  const say = (h) => (h === APPT ? 'by appointment' : !h ? 'closed' : `${clock(h[0])} to ${clock(h[1])}`);
  const runs = [];
  for (const d of order) {
    const text = say(l.hours[d]), last = runs[runs.length - 1];
    if (last && last.text === text) last.to = d;
    else runs.push({ from: d, to: d, text });
  }
  return runs.map((r) => `${short[r.from]}${r.to !== r.from ? '–' + short[r.to] : ''} ${r.text}`).join(' · ') + (l.firstSatClosed ? ' · closed the first Saturday of the month' : '');
}
