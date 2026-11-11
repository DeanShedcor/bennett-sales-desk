/* lot.js: selling a building off the lot.
   Building detail page, compare, delivery questions, sharing, follow-ups, restock prompt and
   the manager's lot summary. Loaded after core.js and before views.js. */

const LOT_COMPARE = [];
const FREE_DELIVERY_MILES = 50; /* The listing says: free delivery and setup within 50 miles. */

/* ---------- Small helpers ---------- */

const lotImg = (url, width) => `https://shedcor.shedsuite.com/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
const lotSize = (u) => u.c.size.replace('x', ' × ') + ' ft';

/* Days since the build date in the serial number. The listing has no date-arrived-on-lot. */
function lotDays(u) {
  const b = String(lotBuilt(u));
  if (b.length !== 8) return null;
  const built = new Date(Number(b.slice(0, 4)), Number(b.slice(4, 6)) - 1, Number(b.slice(6, 8)));
  return Math.max(0, Math.floor((Date.now() - built) / 864e5));
}

function lotPills(u) {
  const days = lotDays(u);
  return (
    `<span class="pill ${u.status === 'Available' ? 'good' : 'amber'}">${u.status}</span>` +
    `<span class="pill ${u.condition === 'used' ? 'amber' : 'ghost'}">${u.condition === 'used' ? 'Pre-owned' : 'New'}</span>` +
    (days === null ? '' : `<span class="pill ${days > 180 ? 'amber' : 'ghost'}">Built ${days} days ago</span>`) +
    (u.listPrice ? `<span class="pill red">Save ${money(u.listPrice - u.price)}</span>` : '') +
    (LOT_FILTER.budget && S.page === 'lot' ? `<span class="pill good">${money(LOT_FILTER.budget - lotPay(u))} under budget</span>` : '')
  );
}

/* Cash price, with the old price crossed out when the building is on sale. */
function lotCash(u) {
  return (u.listPrice ? `<s>${money(u.listPrice)}</s> ` : '') + `<strong>${money(u.price)}</strong>`;
}

/* ---------- Building detail page ---------- */

function openUnit(i) {
  S.unit = i;
  go('unit');
}

function showUnitPhoto(k) {
  const u = lots[S.unit];
  const main = $('#unit-main');
  if (main) main.src = lotImg(u.photos[k], 1080);
  document.querySelectorAll('.thumbs .thumb').forEach((b, n) => b.classList.toggle('on', n === k));
}

function unitPage() {
  const i = S.unit;
  const u = lots[i];
  if (!u) return '<p>Choose a building from the lot.</p>';
  const [w, l] = u.c.size.split('x').map(Number);
  const available = u.status === 'Available';
  const comparing = LOT_COMPARE.includes(i);
  const facts = [
    ['Size', `${lotSize(u)} · ${w * l} sq ft`],
    ['Style', label(u.c)],
    ['Serial', u.id],
    ['Siding', u.colors.siding],
    ['Trim', u.colors.trim],
    ['Roof', u.colors.roof]
  ];
  return `<button class="link backlink" onclick="go('lot')">${icon('back', 16)} My lot</button>
  <div class="unitpage">
    <section class="unitgallery">
      <div class="unitphoto big"><img id="unit-main" src="${esc(lotImg(u.photos[0], 1080))}" alt="${esc(u.name)}" onerror="this.parentNode.outerHTML=modelMarkup(lots[${i}].c,true)"></div>
      ${
        u.photos.length > 1
          ? `<div class="thumbs">${u.photos
              .map((p, k) => `<button type="button" class="thumb${k ? '' : ' on'}" aria-label="Photo ${k + 1} of ${u.photos.length}" onclick="showUnitPhoto(${k})"><img src="${esc(lotImg(p, 256))}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`)
              .join('')}</div>`
          : ''
      }
      <p class="source">${u.photos.length} photo${u.photos.length === 1 ? '' : 's'} from the buybennett.com listing, copied ${LOT_LISTING_DATE}.</p>
      <section class="panel"><h2>On this building</h2><ul class="included">${[u.colors.siding + ' siding', u.colors.trim + ' trim', u.colors.roof + ' roof', ...u.features]
        .map((item) => `<li>${icon('check', 16)}${esc(item)}</li>`)
        .join('')}</ul></section>
    </section>
    <section class="unitinfo">
      <span class="pillrow">${lotPills(u)}</span>
      <h1>${esc(u.name)}</h1>
      <dl class="unitfacts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <section class="panel unitprice">
        <div class="lotpay"><strong class="price">${money(payment(u.price, S.term))}<small>/mo</small></strong><span>${S.term}-month rent-to-own, before tax</span></div>
        <div class="unitterms" role="group" aria-label="Rent-to-own term">${[24, 36, 48, 60]
          .map((t) => `<button type="button" class="term${t === S.term ? ' active' : ''}" aria-pressed="${t === S.term}" onclick="S.term=${t};render()"><small>${t} months</small><strong>${money(payment(u.price, t))}</strong><small>/mo + tax</small></button>`)
          .join('')}</div>
        <dl class="unitmoney"><div><dt>Down payment</dt><dd>${money(u.down)}</dd></div><div><dt>Cash price</dt><dd>${lotCash(u)}</dd></div>${
          u.listPrice ? `<div><dt>Sale savings</dt><dd>${money(u.listPrice - u.price)}</dd></div>` : ''
        }</dl>
        <p class="source">Payments are estimates, not approved terms. Down payment is the amount shown on the listing.</p>
      </section>
      <div class="unitactions">
        ${
          available
            ? button('Start the sale on this building ' + icon('arrow', 18), `pickLot(${i})`, 'primary big')
            : button('View sales record ' + icon('arrow', 18), `pickLot(${i})`, 'primary big') + button('Order another for stock', `restock(${i})`, 'secondary')
        }
        <div class="unitactions-row">${button('Share with customer', `shareUnit(${i})`, 'secondary')}${button('Log an interested customer', `logInterest(${i})`, 'secondary')}${button(
          comparing ? 'Remove from compare' : 'Add to compare',
          `toggleCompare(${i},${!comparing});render()`,
          'secondary'
        )}</div>
        <button type="button" class="link" onclick="buildLike(${i})">Not quite right? Build one like it ${icon('arrow', 16)}</button>
      </div>
      <section class="panel"><h2>Interested customers</h2>${followUpRows((f) => f.unit === u.id) || '<p class="empty">Nobody logged yet. Use “Log an interested customer” after showing this building.</p>'}</section>
    </section>
  </div>${compareBarMarkup()}`;
}

/* "Not quite right?": start a custom build that begins with this building's size, style and colors. */
function buildLike(i) {
  const u = lots[i];
  begin('custom');
  for (const key of ['style', 'size', 'siding', 'shield', 'color', 'trimColor', 'roof', 'roofColor'])
    if (u.c[key] !== undefined) S.c[key] = u.c[key];
  render();
  toast('Custom build started from this building. Confirm each step.');
}

/* ---------- Compare ---------- */

function toggleCompare(i, on) {
  const at = LOT_COMPARE.indexOf(i);
  if (on && at < 0) {
    if (LOT_COMPARE.length >= 3) {
      toast('Compare up to three buildings at a time.');
      const box = $(`#compare-${i}`);
      if (box) box.checked = false;
      return;
    }
    LOT_COMPARE.push(i);
  } else if (!on && at >= 0) LOT_COMPARE.splice(at, 1);
  const bar = $('#comparebar');
  if (bar) bar.outerHTML = compareBarMarkup();
}

function clearCompare() {
  LOT_COMPARE.length = 0;
  render();
}

function compareBarMarkup() {
  const n = LOT_COMPARE.length;
  return `<div id="comparebar" class="comparebar" ${n ? '' : 'hidden'}><span>${n} building${n === 1 ? '' : 's'} selected</span>${button('Compare', 'openCompare()', 'primary')}<button type="button" class="link" onclick="clearCompare()">Clear</button></div>`;
}

function openCompare() {
  if (LOT_COMPARE.length < 2) {
    toast('Pick at least two buildings to compare.');
    return;
  }
  const units = LOT_COMPARE.map((i) => ({ u: lots[i], i }));
  const row = (name, cell) => `<tr><th scope="row">${name}</th>${units.map(({ u, i }) => `<td>${cell(u, i)}</td>`).join('')}</tr>`;
  modal(
    'Compare buildings',
    `<div class="comparewrap"><table class="comparetable" style="--cols:${units.length}">
      <thead><tr><td></td>${units.map(({ u, i }) => `<th scope="col"><div class="unitphoto"><img src="${esc(lotImg(u.photos[0], 384))}" alt="" onerror="this.parentNode.outerHTML=modelMarkup(lots[${i}].c,true)"></div>${esc(u.name)}</th>`).join('')}</tr></thead>
      <tbody>
        ${row('60-month payment', (u) => `<strong class="price">${money(payment(u.price, 60))}</strong>/mo`)}
        ${row('36-month payment', (u) => money(payment(u.price, 36)) + '/mo')}
        ${row('Cash price', (u) => lotCash(u))}
        ${row('Down payment', (u) => money(u.down))}
        ${row('Size', (u) => `${lotSize(u)} · ${u.c.size.split('x').reduce((a, b) => a * b, 1)} sq ft`)}
        ${row('Style', (u) => esc(label(u.c)))}
        ${row('Condition', (u) => (u.condition === 'used' ? 'Pre-owned' : 'New'))}
        ${row('Colors', (u) => esc(`${u.colors.siding} siding, ${u.colors.trim} trim, ${u.colors.roof} roof`))}
        ${row('Built', (u) => (lotDays(u) === null ? 'Not on serial' : lotDays(u) + ' days ago'))}
        ${row('Features', (u) => `<ul>${u.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`)}
        ${row('', (u, i) => button('View building', `closeModal();openUnit(${i})`, 'secondary'))}
      </tbody></table></div>`
  );
  $('.modal').classList.add('wide');
}

/* ---------- Lot sale: locked building plus delivery questions ---------- */

function deliveryState() {
  if (!S.delivery) S.delivery = { miles: '', access: '', gate: '', noGate: false, ground: '', notes: '' };
  return S.delivery;
}

/* Questions still unanswered. Only a lot sale asks them. */
function lotDeliveryMissing() {
  if (S.path !== 'lot') return [];
  const d = deliveryState();
  return [
    d.miles === '' && 'Distance to the delivery site',
    !d.access && 'Site access',
    d.gate === '' && !d.noGate && 'Narrowest gate or opening',
    !d.ground && 'Ground at the site'
  ].filter(Boolean);
}

function deliveryNotes() {
  const d = deliveryState();
  const width = Number(lots[S.lot].c.size.split('x')[0]);
  const notes = [];
  if (d.miles !== '' && Number(d.miles) > FREE_DELIVERY_MILES)
    notes.push(`Over ${FREE_DELIVERY_MILES} miles. The delivery fee must be confirmed before quoting.`);
  if (!d.noGate && d.gate !== '') {
    if (Number(d.gate) <= width) notes.push(`The opening is ${d.gate} ft and the building is ${width} ft wide. It will not fit through.`);
    else if (Number(d.gate) < width + 2) notes.push(`Tight fit: a ${width} ft wide building through a ${d.gate} ft opening. Confirm with the driver.`);
  }
  if (d.access && d.access !== 'Clear access') notes.push('Site access needs a review by the driver.');
  if (d.ground === 'Needs leveling') notes.push('The site needs leveling before delivery.');
  return notes;
}

function deliverySummary() {
  const d = deliveryState();
  return [
    d.miles === '' ? null : `${d.miles} mi`,
    d.access || null,
    d.noGate ? 'no gate' : d.gate === '' ? null : `${d.gate} ft opening`,
    d.ground || null,
    d.notes || null
  ]
    .filter(Boolean)
    .join(' · ');
}

/* The delivery line that goes on the quote for a lot building. */
function lotDeliveryItems() {
  if (S.path !== 'lot' || !S.delivery) return [];
  const free = Number(S.delivery.miles) <= FREE_DELIVERY_MILES;
  return [
    {
      name: 'Delivery and setup · ' + deliverySummary(),
      amount: 0,
      source: free ? `Free within ${FREE_DELIVERY_MILES} miles, per the listing` : 'Fee to confirm: over ' + FREE_DELIVERY_MILES + ' miles'
    }
  ];
}

function deliveryStatusMarkup() {
  const missing = lotDeliveryMissing();
  const notes = deliveryNotes();
  const d = deliveryState();
  const free = d.miles !== '' && Number(d.miles) <= FREE_DELIVERY_MILES;
  return `<div id="delivery-status">${
    missing.length
      ? `<p class="notice">${icon('lock', 14)} Still needed before a quote or sale: ${missing.join(', ')}.</p>`
      : `<p class="deliveryok">${icon('check', 16)} ${free ? `Free delivery and setup, within ${FREE_DELIVERY_MILES} miles.` : 'Delivery answers complete.'}</p>`
  }${notes.map((n) => `<p class="notice">${icon('alert', 14)} ${esc(n)}</p>`).join('')}</div>`;
}

function setDelivery(key, value) {
  const d = deliveryState();
  d[key] = key === 'noGate' ? Boolean(value) : key === 'miles' || key === 'gate' ? (value === '' ? '' : Math.max(0, Number(value) || 0)) : String(value).slice(0, 160);
  if (key === 'noGate') {
    const gate = $('#delivery-gate');
    if (gate) gate.disabled = d.noGate;
  }
  const status = $('#delivery-status');
  if (status) status.outerHTML = deliveryStatusMarkup();
  refreshSummary();
}

function deliveryPrompt() {
  modal(
    'Answer the delivery questions first',
    `<p>The delivery fee and fit are checked before a quote or sale. Still needed:</p><ul class="stepsleft">${lotDeliveryMissing()
      .map((m) => `<li>${icon('lock', 16)}<span>${m}</span></li>`)
      .join('')}</ul><div class="actions">${button('Go to delivery questions ' + icon('arrow', 18), "closeModal();$('#delivery-panel').scrollIntoView({behavior:'smooth',block:'start'})")}${button('Close', 'closeModal()', 'secondary')}</div>`
  );
}

function lotSaleMarkup() {
  const u = lots[S.lot];
  const d = deliveryState();
  const options = (list, current) => `<option value="">Choose…</option>` + list.map((o) => `<option ${o === current ? 'selected' : ''}>${o}</option>`).join('');
  return `<span class="pillrow"><span class="pill">${icon('lock', 12)} Already built · fixed configuration</span>${lotPills(u)}</span><h1>${esc(u.name)}</h1><p class="serial">${u.id} · ${label(S.c)}</p>${unitPhoto(u, S.lot, 1080)}
  <section class="panel" id="delivery-panel"><h2>Delivery</h2><p class="lede-small">Ask these before quoting so the delivery fee and the fit are right.</p>
    <div class="fields">
      <label>Distance to the delivery site (miles)<input type="number" inputmode="numeric" min="0" step="1" value="${d.miles}" oninput="setDelivery('miles',this.value)"></label>
      <label>Site access<select onchange="setDelivery('access',this.value)">${options(['Clear access', 'Tight access', 'Not sure, needs a look'], d.access)}</select></label>
      <label>Narrowest gate or opening (feet)<input id="delivery-gate" type="number" inputmode="decimal" min="0" step="0.5" value="${d.gate}" ${d.noGate ? 'disabled' : ''} oninput="setDelivery('gate',this.value)"></label>
      <label>Ground at the site<select onchange="setDelivery('ground',this.value)">${options(['Level', 'Slight slope', 'Needs leveling'], d.ground)}</select></label>
    </div>
    <label class="checkrow"><input type="checkbox" ${d.noGate ? 'checked' : ''} onchange="setDelivery('noGate',this.checked)"> <span>No gate or opening to pass through</span></label>
    <label class="field">Delivery notes<input maxlength="160" placeholder="Trees, wires, soft ground, where it goes" value="${esc(d.notes)}" oninput="setDelivery('notes',this.value)"></label>
    ${deliveryStatusMarkup()}
  </section>
  <section class="panel"><h2>On this building</h2><p class="lockline">${icon('lock', 14)} This building is already built. Its size, colors and options cannot be changed. Only delivery is set here.</p><ul class="included">${[u.colors.siding + ' siding', u.colors.trim + ' trim', u.colors.roof + ' roof', ...u.features]
    .map((item) => `<li>${icon('check', 16)}${esc(item)}</li>`)
    .join('')}</ul><p class="notice">Copied from the buybennett.com listing on ${LOT_LISTING_DATE}. The photo shows the actual building, and the 3D model is a reference for its style and colors. Confirm it is still on the lot before quoting.</p><button type="button" class="link" onclick="buildLike(${S.lot})">Not quite right? Build one like it ${icon('arrow', 16)}</button></section>`;
}

/* ---------- Share with the customer, and the follow-up list ---------- */

function unitMessage(u, name) {
  const first = (name || '').trim().split(/\s+/)[0];
  return `Hi${first ? ' ' + first : ''}, here is the ${u.name} at Bennett Buildings of ${LOT_LOCATION}. Rent-to-own from ${money(payment(u.price, 60))}/mo for 60 months, or ${money(u.price)} cash, before tax. Photos and details: ${u.url}`;
}

function shareUnit(i) {
  const u = lots[i];
  modal(
    'Share this building',
    `<p>Send the customer the payment and a link to the listing, which has the photos. Each send is logged as a follow-up.</p>
    <div class="fields"><label>Customer name<input id="share-name" maxlength="80" oninput="$('#share-message').value=unitMessage(lots[${i}],this.value)"></label><label>Mobile number<input id="share-phone" type="tel" maxlength="30"></label></div>
    <label class="field">Email address<input id="share-email" type="email" maxlength="120"></label>
    <label class="field">Message<textarea id="share-message" rows="5">${esc(unitMessage(u, ''))}</textarea></label>
    <div class="actions">${button('Text it', `sendShare(${i},'text')`)}${button('Email it', `sendShare(${i},'email')`, 'secondary')}${button('Copy message', `sendShare(${i},'copy')`, 'secondary')}</div>
    <p class="source">Text and email open on this device with the message filled in, and you press send there.</p>`
  );
}

function sendShare(i, via) {
  const u = lots[i];
  const name = $('#share-name').value.trim();
  const phone = $('#share-phone').value.trim();
  const email = $('#share-email').value.trim();
  const message = $('#share-message').value;
  if (!name) return toast('Enter the customer’s name so the follow-up can be logged.');
  if (via === 'text' && !phone) return toast('Enter a mobile number to text.');
  if (via === 'email' && !email) return toast('Enter an email address.');
  S.shown.push({ unit: u.id, customer: name, phone, email, via, date: new Date().toISOString(), done: false });
  if (via === 'copy') navigator.clipboard?.writeText(message).catch(() => {});
  else
    location.href =
      via === 'text'
        ? `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(message)}`
        : `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(u.name)}&body=${encodeURIComponent(message)}`;
  closeModal();
  render();
  toast(via === 'copy' ? 'Message copied and follow-up logged.' : 'Follow-up logged.');
}

function logInterest(i) {
  modal(
    'Log an interested customer',
    `<p>Record who looked at this building so someone can call them back.</p>
    <div class="fields"><label>Customer name<input id="interest-name" maxlength="80"></label><label>Phone number<input id="interest-phone" type="tel" maxlength="30"></label></div>
    <label class="field">Note<input id="interest-note" maxlength="160" placeholder="What they liked, when to call"></label>
    <div class="actions">${button('Save follow-up', `saveInterest(${i})`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`
  );
}

function saveInterest(i) {
  const name = $('#interest-name').value.trim();
  if (!name) return toast('Enter the customer’s name.');
  S.shown.push({ unit: lots[i].id, customer: name, phone: $('#interest-phone').value.trim(), note: $('#interest-note').value.trim(), via: 'shown', date: new Date().toISOString(), done: false });
  closeModal();
  render();
  toast('Follow-up saved.');
}

function toggleFollowUp(n) {
  S.shown[n].done = !S.shown[n].done;
  render();
}

function followUpRows(filter, withUnit = false) {
  const how = { shown: 'Shown in person', text: 'Texted', email: 'Emailed', copy: 'Message copied' };
  return S.shown
    .map((f, n) => ({ f, n }))
    .filter(({ f }) => f.customer && filter(f))
    .sort((a, b) => Number(a.f.done) - Number(b.f.done) || new Date(b.f.date) - new Date(a.f.date))
    .map(({ f, n }) => {
      const at = lots.findIndex((u) => u.id === f.unit);
      return `<div class="followrow${f.done ? ' done' : ''}"><span class="grow"><strong>${esc(f.customer)}</strong><small>${how[f.via] || 'Shown'} · ${new Date(f.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${f.note ? ' · ' + esc(f.note) : ''}</small>${
        withUnit && at >= 0 ? `<button type="button" class="link" onclick="openUnit(${at})">${esc(lots[at].name)}</button>` : ''
      }</span>${f.phone ? `<a class="chipbtn" href="tel:${esc(f.phone)}">Call ${esc(f.phone)}</a>` : ''}<button type="button" class="chipbtn${f.done ? ' on' : ''}" onclick="toggleFollowUp(${n})">${f.done ? 'Done ✓' : 'Mark done'}</button></div>`;
    })
    .join('');
}

/* ---------- Manager's lot summary ---------- */

function lotSummaryMarkup() {
  const available = lots.filter((u) => u.status === 'Available');
  const ages = available.map(lotDays).filter((d) => d !== null);
  const avg = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const week = S.sales.filter((s) => s.path === 'lot' && s.submittedAt && Date.now() - new Date(s.submittedAt) < 7 * 864e5);
  const oldest = available.filter((u) => lotDays(u) !== null).sort((a, b) => lotDays(b) - lotDays(a))[0];
  const open = S.shown.filter((f) => f.customer && !f.done).length;
  const tile = (value, text) => `<div class="kpi"><strong>${value}</strong><span>${text}</span></div>`;
  return `<section class="lotsummary" aria-label="Lot summary"><div class="today">${tile(available.length, `of ${lots.length} buildings available`)}${tile(
    '$' + Math.round(available.reduce((a, u) => a + u.price, 0)).toLocaleString('en-US'),
    'lot value'
  )}${tile(avg === null ? '–' : avg, 'average days since built')}${tile(week.length, 'sold off the lot this week')}</div>${
    oldest ? `<p class="source">Oldest build on the lot, built ${lotDays(oldest)} days ago: <button type="button" class="link inline" onclick="openUnit(${lots.indexOf(oldest)})">${esc(oldest.name)}</button></p>` : ''
  }<details class="panel followups" ${open ? 'open' : ''}><summary>Follow-ups <span class="pill ${open ? 'amber' : 'ghost'}">${open} open</span></summary>${
    followUpRows(() => true, true) || '<p class="empty">No follow-ups yet. They appear here when a building is shared or a customer is logged.</p>'
  }</details></section>`;
}

/* ---------- After the sale ---------- */

function restockPrompt(i) {
  const u = lots[i];
  modal(
    'Order another like it?',
    `<p><strong>${esc(u.name)}</strong> is now sale pending and will leave the lot. Keep the lot stocked by ordering the same building.</p><div class="actions">${button('Order another like this ' + icon('arrow', 18), `closeModal();restock(${i})`)}${button('Not now', 'closeModal()', 'secondary')}</div>`
  );
}
