/* order.js: the order page for a building.
   Everything the invoice carries is laid out in plain view: customer, building, money, who
   sold it, and the signed paperwork. The rent-to-own application asks only what the invoice
   does not already answer, and its answers and the contract are never shown on the page:
   they have to be downloaded.

   Loaded after the Sales desk, Plant QC and build sheet scripts. Replaces the old sale page. */

/* One full sample order, built from the layout of a real ShedCor invoice with made-up
   customer details. */
const ORDER_SAMPLE = {
  id: 'AA-20411', customer: 'Morgan Avery', path: 'custom', lot: null, total: 14869, type: 'Rent-to-own',
  status: 'Submitted · Awaiting review', fulfillment: 'Review pending', accepted: true, deposit: true, rto: true, sample: true,
  c: { ...clone(defaults), size: '12x40', catalogOptions: true, package: 'Deluxe Porch', porchSide: 'Right', electrical: 'Expanded', color: 'Origami White', trimColor: 'Ebony', roofColor: 'Black', wallHeight: 7, windows: 0, windowItems: [] },
  events: [
    { time: 'Nov 6, 10:12 AM', text: 'Invoice AA-20411 created by Casey Brooks' },
    { time: 'Nov 6, 10:31 AM', text: 'Customer signed the invoice, terms and delivery agreement' },
    { time: 'Nov 6, 10:44 AM', text: 'Rent-to-own application completed and contract signed' },
    { time: 'Nov 6, 10:45 AM', text: 'First payment of $605.84 collected' },
    { time: 'Nov 6, 10:46 AM', text: 'Submitted to administrator' },
  ],
  invoice: {
    number: 'AA-20411', plan: 'RTO · 60 month · 1 pay', orderType: 'New · Off-lot sale', date: '11/06/2026', agent: 'Casey Brooks',
    serial: 'SAMPLE-1240-2001',
    shipTo: { name: 'Morgan Avery', street: '120 Sample Creek Ln', city: 'Moncks Corner, SC 29461', phone: '(843) 555-0142', email: 'morgan.avery@example.com' },
    dealer: { name: 'Bennett Buildings of Moncks Corner', street: '3212 South Live Oak Drive', city: 'Moncks Corner, SC 29461', phone: '(843) 291-7769' },
    from: { name: 'ShedCor, LLC', street: '120 Pinnacle Place, Suite A', city: 'Little River, SC 29566', phone: '(843) 273-0054' },
    finish: [['Siding', 'Wood · Origami White', '#faf9f5'], ['Trim', 'Wood · Ebony stain', '#3a3432'], ['Roof', 'Metal · Black', '#27292c']],
    lines: [
      ['Basic Utility (No Package) 12 x 40', 1, 14869],
      ['Deluxe Porch Package · Right · Utility (36" 9 lite door, 5 2x3 windows, standard railing)', 1, null],
      ['Deluxe Vent', 2, null],
      ['Double Shed Door', 1, null],
      ['Expanded Electrical Package (pigtail, 1 light switch, 1 light w/bulb, 3 outlets)', 1, null],
      ['Fuel Surcharge', 1, null],
      ['Porch Railing Color · Black', 1, null],
      ['Window Color · Black', 1, null],
    ],
    subtotal: 14869, monthly: 546.65,
    taxes: [['Special district sales tax (2%)', 10.93], ['City of Unincorporated sales tax (1%)', 5.47], ['Berkeley County sales tax (0%)', 0], ['SC state sales tax (6%)', 32.8]],
    waiver: 9.99, delivery: 'FREE', dueToday: 605.84,
    signed: { invoice: '11/06/2026', terms: '11/06/2026', delivery: '11/06/2026' },
  },
  rtoApp: {
    provider: 'JMAG LLC', signedOn: '11/06/2026', term: 60,
    a: { dlState: 'SC', dlGiven: true, dobGiven: true, ssn4: '0000', phone2: '(843) 555-0143', billingSame: true, employer: 'Sample Employer', employerPhone: '(843) 555-0100',
      r1name: 'Jamie Avery', r1phone: '(843) 555-0111', r1rel: 'Spouse', r1state: 'SC', r2name: 'Riley Stone', r2phone: '(843) 555-0122', r2rel: 'Friend', r2state: 'SC',
      idPhoto: 'sample-license.jpg', property: 'Owns the property', cosigner: false },
  },
};
if (!S.sales.some((s) => s.id === ORDER_SAMPLE.id)) S.sales.push(ORDER_SAMPLE);

const odMoney = (n) => (n == null ? 'Included' : typeof n === 'string' ? n : money(n));
const odToday = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

/* The invoice for an order: the real one when the order carries it, otherwise put together
   from what the Sales desk recorded when the sale was made. */
function orderInvoice(s) {
  if (s.invoice) return s.invoice;
  const c = s.c, i = s.customerInfo || {}, rto = s.type === 'Rent-to-own', term = s.billing?.term;
  const pre = i.same === false ? 'delivery' : 'billing';
  return {
    number: s.id, derived: true,
    plan: rto ? `RTO · ${term} month` : s.type || 'Quote',
    orderType: s.path === 'lot' ? 'Off-lot sale' : 'New · Custom order',
    date: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : odToday(),
    agent: 'Not recorded in this preview', serial: s.path === 'lot' ? lots[s.lot]?.id || '' : '',
    shipTo: { name: s.customer, street: [i[pre + 'Street'], i[pre + 'Unit']].filter(Boolean).join(', '), city: [i[pre + 'City'], [i[pre + 'State'], i[pre + 'Zip']].filter(Boolean).join(' ')].filter(Boolean).join(', '), phone: i.phone || '', email: i.email || '' },
    dealer: { name: `Bennett Buildings of ${LOT_LOCATION}`, street: '', city: '', phone: '' },
    from: ORDER_SAMPLE.invoice.from,
    finish: [['Siding', c.color, paintColors[c.color]], ['Trim', c.trimColor || 'Origami White', paintColors[c.trimColor || 'Origami White']], ['Roof', c.roof === 'Metal' ? `Metal · ${c.roofColor || 'color not chosen'}` : 'Architectural shingles', metalRoofColors[c.roofColor]]],
    lines: [[label(c), 1, s.total], ...included(c).filter((x) => x && x !== 'Standard Storage').map((x) => [x, 1, null])],
    subtotal: s.total, monthly: rto && term ? payment(s.total, term) : null, taxes: null, waiver: null,
    delivery: 'To be confirmed', dueToday: s.billing ? s.billing.deposit : null,
    signed: {},
  };
}

/* ---------- The page ---------- */
function orderTrack(s) {
  const at = { 'Quote issued': 0, 'Submitted · Awaiting review': 2, 'Correction requested': 2, 'Processed · Sold': 3 }[s.status] ?? 0;
  const hold = s.status === 'Correction requested';
  return chevronTrack(['Quote', 'Sold and signed', hold ? 'Correction needed' : 'Admin review', s.path === 'lot' ? 'Delivery' : 'In production', 'Delivered'], at, hold);
}
const odRow = (k, v, cls = '') => `<div class="od-kv ${cls}"><span>${k}</span><strong>${v}</strong></div>`;
const odParty = (p) => [p.street, p.city].filter(Boolean).map(esc).join('<br>');

function orderPage() {
  const s = S.sales.find((x) => x.id === S.activeSale);
  if (!s) return '<p>Choose an order.</p>';
  const inv = orderInvoice(s), c = s.c, rto = s.type === 'Rent-to-own' || /RTO/.test(inv.plan);
  const pkg = activePackage(c) ? ` · ${c.package}${c.porchSide && /Side|Deluxe/.test(c.package) ? ', ' + c.porchSide.toLowerCase() : ''}` : '';
  const taxTotal = inv.taxes ? inv.taxes.reduce((t, x) => t + x[1], 0) : null;
  const monthlyTotal = inv.monthly != null && taxTotal != null ? inv.monthly + taxTotal + (inv.waiver || 0) : null;
  const statusPill = s.status === 'Processed · Sold' ? 'good' : s.status === 'Correction requested' ? 'red' : 'amber';
  const st = inv.shipTo, maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${st.street}, ${st.city}`);

  const customer = `<section class="panel"><div class="panelhead"><h2>Customer</h2><span class="od-tag">Ship to</span></div>
    <div class="od-name">${esc(st.name)}</div>
    <p class="od-addr">${odParty(st) || '<span class="od-missing">Delivery address not recorded yet</span>'}</p>
    <div class="od-contact">
      ${st.phone ? `<a class="chipbtn" href="tel:${esc(st.phone.replace(/[^\d+]/g, ''))}">${icon('user', 16)} ${esc(st.phone)}</a>` : ''}
      ${st.email ? `<a class="chipbtn" href="mailto:${esc(st.email)}">${icon('receipt', 16)} ${esc(st.email)}</a>` : ''}
      ${st.street ? `<a class="chipbtn" target="_blank" rel="noopener" href="${maps}">${icon('lot', 16)} Directions</a>` : ''}
    </div></section>`;

  const building = `<section class="panel"><div class="panelhead"><h2>Building</h2>${inv.serial ? `<span class="od-serial">Serial ${esc(inv.serial)}</span>` : '<span class="od-tag">Serial assigned at the plant</span>'}</div>
    ${modelMarkup(c)}
    <div class="od-finish">${inv.finish.map(([k, v, hex]) => `<div><small>${k}</small><strong>${hex ? `<i style="background:${hex}"></i>` : ''}${esc(v)}</strong></div>`).join('')}</div>
    <table class="od-lines"><thead><tr><th>Description</th><th>Qty</th><th>Total</th></tr></thead><tbody>
      ${inv.lines.map(([d, q, t]) => `<tr><td>${esc(d)}</td><td>${q}</td><td>${t == null ? '<span class="od-inc">Included</span>' : money(t)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="2">Subtotal</td><td>${money(inv.subtotal)}</td></tr></tfoot></table>
    <div class="od-plantrow"><div><strong>For the plant</strong><small>Floor plan, wall-by-wall positions and specs by crew.</small></div>${changeOrdersMarkup(s.id)}</div></section>`;

  const payment = `<section class="panel"><div class="panelhead"><h2>Payment</h2><span class="pill blue">${esc(inv.plan)}</span></div>
    ${odRow('Subtotal', money(inv.subtotal))}
    ${inv.monthly != null ? odRow('Monthly payment before taxes', money(inv.monthly)) : ''}
    ${inv.taxes ? `<details class="od-tax"><summary>${odRow(rto ? 'Total monthly sales tax' : 'Sales tax', money(taxTotal))}</summary>${inv.taxes.map(([k, v]) => odRow(esc(k), money(v), 'sub')).join('')}</details>` : odRow('Sales tax', '<span class="od-missing">To be confirmed</span>')}
    ${inv.waiver != null ? odRow('Liability waiver program', money(inv.waiver)) : ''}
    ${monthlyTotal != null ? odRow('Total monthly payment', money(monthlyTotal), 'strong') : ''}
    ${odRow('Delivery', esc(odMoney(inv.delivery)))}
    ${odRow('Amount due today', inv.dueToday != null ? money(inv.dueToday) : '<span class="od-missing">Not recorded</span>', 'total')}</section>`;

  const doc = (title, signed, action, note = '') => `<div class="od-doc"><span class="od-check ${signed ? 'on' : ''}">${signed ? icon('check', 16) : ''}</span><div class="grow"><strong>${title}</strong><small>${signed ? `Signed ${esc(signed)}` : note || 'Not signed yet'}</small></div>${action}</div>`;
  const view = (kind) => `<button type="button" class="secondary small" onclick="orderDoc('${kind}')">View</button>`;
  const papers = `<section class="panel"><h2>Paperwork</h2>
    ${doc('Invoice', inv.signed.invoice, view('invoice'))}
    ${doc('Terms and conditions of sale', inv.signed.terms, view('terms'))}
    ${doc('Delivery and blocking agreement', inv.signed.delivery, view('delivery'))}
    ${rto ? doc('Rent-to-own contract', s.rtoApp?.signedOn, s.rtoApp ? `<button type="button" class="secondary small" onclick="rtoDownload()">Download</button>` : '', 'Waiting on the RTO application') : ''}
    ${rto ? `<p class="od-lock">${icon('alert', 16)} The rent-to-own contract cannot be opened on this page. It has to be downloaded.</p>` : ''}</section>`;

  /* Each part ticks as soon as its step of the application is done (s.rtoStep counts finished steps). */
  const app = s.rtoApp, prog = s.rtoStep || 0, done = (k) => !!app || prog > k;
  const part = (title, on, text) => `<div class="od-doc"><span class="od-check ${on ? 'on' : ''}">${on ? icon('check', 16) : ''}</span><div class="grow"><strong>${title}</strong><small>${text}</small></div></div>`;
  const rtoPanel = !rto ? '' : `<section class="panel"><div class="panelhead"><h2>Rent-to-own application</h2><span class="pill ${app ? 'good' : 'amber'}">${app ? 'Complete' : prog ? `${Math.min(prog - 1, 5)} of 5 parts done` : 'Not started'}</span></div>
    <p class="source">Asks only what the invoice does not already answer. Name, phone, email, delivery address, building, price, term and waiver come straight from the invoice.</p>
    ${part('Identity and photo of the ID', done(1), done(1) ? ((app ? app.a : RTOF.a).idPhoto ? 'On file' : 'On file · ID photo still missing') : "Driver's license, photo of the ID, birth date, Social Security number")}
    ${part('Contact and work', done(2), done(2) ? 'On file' : 'Second phone, billing address, employer')}
    ${part('Property', done(3), done(3) ? 'On file' : 'Owns or rents the delivery property')}
    ${part('Two references', done(4), done(4) ? '2 of 2 on file' : 'Name, phone, relationship and state for each')}
    ${part('Co-signer', done(5), app ? (app.a.cosigner ? 'On file' : 'None on this application') : done(5) ? 'Answered' : 'Optional')}
    <div class="od-todo"><strong>To confirm · Payment due day</strong>Not decided yet: does the customer pick the day, is it always the 15th, or does the RTO provider set it? The application does not ask for a due day until this is confirmed.</div>
    <p class="od-lock">${icon('alert', 16)} Answers are never shown here. Download the contract to see them.</p>
    <div class="actions">${app ? button('Download RTO contract', 'rtoDownload()') + button('Replace answers', 'rtoApply(0)', 'secondary') : prog > 1 && RTOF.sale === s.id ? button('Continue RTO application', `rtoApply(${Math.min(prog, RTO_LAST)})`) : button('Start RTO application', 'rtoApply(0)')}</div></section>`;

  const sold = `<section class="panel"><h2>Sale details</h2>
    <div class="od-two">
      ${odRow('Invoice number', esc(inv.number))}${odRow('Date', esc(inv.date))}
      ${odRow('Order type', esc(inv.orderType))}${odRow('Agent', esc(inv.agent))}
    </div>
    <div class="od-parties"><div><small>Dealer</small><strong>${esc(inv.dealer.name)}</strong><p>${odParty(inv.dealer)}${inv.dealer.phone ? '<br>' + esc(inv.dealer.phone) : ''}</p></div>
    <div><small>Invoice from</small><strong>${esc(inv.from.name)}</strong><p>${odParty(inv.from)}<br>${esc(inv.from.phone)}</p></div></div></section>`;

  const reviewing = s.status.includes('Submitted') || s.status === 'Correction requested';
  const review = `<section class="panel"><div class="panelhead"><h2>Review and history</h2><span class="pill blue">${esc(s.fulfillment || '')}</span></div>
    ${reviewing ? `<p>Administrator: check the options, paperwork, identity and delivery details.</p><div class="actions">${button('Request correction', "reviewAction('correction')", 'secondary')}${button('Approve as admin', "reviewAction('approve')")}${s.status === 'Correction requested' ? button('Resolve and resubmit', "reviewAction('resubmit')", 'secondary') : ''}</div>` : ''}
    ${s.status === 'Quote issued' ? `<div class="actions">${s.quoteId ? button('Open issued quote', `S.activeQuote='${s.quoteId}';go('quote')`, 'secondary') : ''}${button('Finalize this sale', `S.c=clone(S.sales.find(x=>x.id===S.activeSale).c);S.path='${s.path}';S.lot=${s.lot};S.customer=${JSON.stringify(s.customer).replace(/"/g, '&quot;')};finalizeForm()`)}</div>` : ''}
    ${s.path === 'lot' ? `<div class="actions">${button('Matching sales history', `matchHistory(${s.lot})`, 'secondary')}${button('Order another for stock', `restock(${s.lot})`, 'secondary')}</div>` : ''}
    ${s.events.slice().reverse().map((e) => `<div class="log"><small>${esc(e.time)}</small><br>${esc(e.text)}</div>`).join('')}</section>`;

  return `<button class="link backlink" onclick="go('orders')">${icon('back', 18)} All orders</button>
    ${head(`Invoice ${esc(inv.number)}`, esc(s.customer), esc(label(c) + pkg))}
    <section class="panel od-top">
      <div class="pillrow"><span class="pill">${esc(inv.orderType)}</span><span class="pill blue">${esc(inv.plan)}</span><span class="pill ${statusPill}">${esc(s.status)}</span>${s.sample ? '<span class="pill ghost">Sample order</span>' : ''}</div>
      ${orderTrack(s)}
      <div class="od-tiles">
        <div><small>Due today</small><strong>${inv.dueToday != null ? money(inv.dueToday) : '—'}</strong></div>
        <div><small>${monthlyTotal != null ? 'Monthly, with tax' : 'Building total'}</small><strong>${money(monthlyTotal ?? inv.subtotal)}</strong></div>
        <div><small>Subtotal</small><strong>${money(inv.subtotal)}</strong></div>
        <div><small>Delivery</small><strong>${esc(odMoney(inv.delivery))}</strong></div>
      </div>
    </section>
    <div class="od-grid"><div class="od-col">${customer}${building}${sold}</div><div class="od-col">${payment}${papers}${rtoPanel}${review}</div></div>`;
}

/* ---------- Viewing the invoice and agreements ---------- */
function orderDoc(kind) {
  const s = S.sales.find((x) => x.id === S.activeSale), inv = orderInvoice(s);
  if (kind !== 'invoice') {
    const terms = kind === 'terms', name = esc(inv.shipTo.name || s.customer);
    const body = terms
      ? ORDER_DOCS.terms.map(([h, p]) => `<p><strong>${esc(h)}.</strong> ${esc(p).replace('{name}', name)}</p>`).join('')
      : ORDER_DOCS.delivery.map(([h, list]) => `<p><strong>${esc(h)}</strong></p><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('');
    modal(terms ? 'Terms and conditions of sale' : 'Delivery and blocking agreement', `<div class="od-paper od-legal">
      <div class="od-paperhead"><strong>${terms ? 'Terms and conditions of sale' : 'Delivery and blocking agreement'}</strong><span>Invoice # ${esc(inv.number)}</span></div>
      ${body}
      <div class="od-sign"><div><small>Signed by</small><strong>${inv.signed[kind] ? name : 'Not signed yet'}</strong></div><div><small>Date</small><strong>${esc(inv.signed[kind] || '—')}</strong></div></div></div>
      <div class="actions no-print">${button('Print', 'window.print()', 'secondary')}</div>`);
    document.querySelector('.modal').classList.add('od-wide');
    return;
  }
  const taxTotal = inv.taxes ? inv.taxes.reduce((t, x) => t + x[1], 0) : null;
  const who = (title, p, extra = '') => `<div><small>${title}</small><strong>${esc(p.name)}</strong><p>${odParty(p)}${p.phone ? '<br>' + esc(p.phone) : ''}${extra}</p></div>`;
  modal(`Invoice ${esc(inv.number)}`, `<div class="od-paper">
    <div class="od-paperhead"><strong>${esc(inv.plan)}</strong><span>Invoice # ${esc(inv.number)}</span></div>
    <div class="od-who">${who('Invoice from', inv.from)}${who('Ship to', inv.shipTo, inv.shipTo.email ? '<br>' + esc(inv.shipTo.email) : '')}${who('Dealer', inv.dealer)}
      <div><small>Order type</small><strong>${esc(inv.orderType)}</strong><p>Date ${esc(inv.date)}<br>Agent ${esc(inv.agent)}</p></div></div>
    <table class="od-lines"><thead><tr><th>Description</th><th>Qty</th><th>Total</th></tr></thead><tbody>
      ${inv.lines.map(([d, q, t], i) => `<tr><td>${esc(d)}${i === 0 ? `<small>${inv.serial ? 'Serial number ' + esc(inv.serial) + '<br>' : ''}${inv.finish.map(([k, v]) => `${k}: ${esc(v)}`).join(', ')}</small>` : ''}</td><td>${q}</td><td>${t == null ? 'Included' : money(t)}</td></tr>`).join('')}
    </tbody></table>
    <div class="od-totals">
      ${odRow('Subtotal', money(inv.subtotal))}
      ${inv.monthly != null ? odRow('Monthly payment before taxes', money(inv.monthly)) : ''}
      ${(inv.taxes || []).map(([k, v]) => odRow(esc(k), money(v), 'sub')).join('')}
      ${taxTotal != null ? odRow('Total monthly sales tax', money(taxTotal)) : ''}
      ${inv.waiver != null ? odRow('Liability waiver program', money(inv.waiver)) : ''}
      ${inv.monthly != null && taxTotal != null ? odRow('Total monthly payment', money(inv.monthly + taxTotal + (inv.waiver || 0)), 'strong') : ''}
      ${odRow('Delivery', esc(odMoney(inv.delivery)))}
      ${odRow('Amount due today', inv.dueToday != null ? money(inv.dueToday) : '—', 'total')}
    </div>
    <p class="source">${inv.signed.invoice ? `Signed by the customer on ${esc(inv.signed.invoice)}.` : 'Not signed yet.'} Terms and conditions and the delivery agreement are separate documents on the order page.</p></div>
    <div class="actions no-print">${button('Print invoice', 'window.print()', 'secondary')}</div>`);
  document.querySelector('.modal').classList.add('od-wide');
}

/* ---------- Rent-to-own application: only what the invoice does not answer ---------- */
const RTO_STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const RTO_STEPS = ['From the invoice', 'Identity', 'Contact and work', 'Property', 'References', 'Co-signer', 'Finish'];
const RTO_LAST = RTO_STEPS.length - 1;
let RTOF = { step: 0, a: {} };
/* Fields whose answer is never kept: the license number and birth date (only that they were entered),
   and the Social Security number (only its last 4 digits). */
const RTO_SECRET = { dl: 'dlGiven', dob: 'dobGiven', ssn: 'ssn4', csDl: 'csDlGiven', csDob: 'csDobGiven', csSsn: 'csSsn4' };
function rtoField(label, name, o = {}) {
  if (RTO_SECRET[name] && RTOF.a[RTO_SECRET[name]]) o = { ...o, entered: true };
  const v = RTO_SECRET[name] ? '' : RTOF.a[name] ?? '';
  if (o.options) return `<label>${label}<select name="${name}">${o.options.map((x) => `<option ${x === (v || o.value) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
  return `<label>${label}${o.entered ? ' · entered, type again to change' : o.optional ? ' (optional)' : ''}<input name="${name}" type="${o.type || 'text'}" value="${esc(v)}" ${o.optional || o.entered ? '' : 'required'} ${o.attrs || ''}></label>`;
}
function rtoApply(step) {
  const s = S.sales.find((x) => x.id === S.activeSale), inv = orderInvoice(s);
  if (step === 0 && RTOF.sale !== s.id) RTOF = { step: 0, a: { billingSame: true }, sale: s.id };
  RTOF.step = step;
  const ref = (n) => `<h3>Reference ${n}</h3><div class="fields">${rtoField('Full name', `r${n}name`)}${rtoField('Phone', `r${n}phone`, { type: 'tel' })}${rtoField('Relationship', `r${n}rel`)}${rtoField('State', `r${n}state`, { options: RTO_STATES, value: 'SC' })}</div>`;
  const body = [
    `<p>Nothing here needs retyping. It is already on invoice ${esc(inv.number)}.</p>
     <div class="od-recap">${odRow('Applicant', esc(inv.shipTo.name))}${odRow('Primary phone', esc(inv.shipTo.phone || '—'))}${odRow('Email', esc(inv.shipTo.email || '—'))}${odRow('Delivery address', odParty(inv.shipTo).replace('<br>', ', ') || '—')}${odRow('Building', esc(inv.lines[0][0]))}${odRow('Plan', esc(inv.plan))}${inv.monthly != null ? odRow('Monthly payment before taxes', money(inv.monthly)) : ''}${inv.waiver != null ? odRow('Liability waiver', 'Accepted · ' + money(inv.waiver) + ' a month') : ''}</div>
     <p class="source">Five short parts are left: identity, contact and work, the property, two references and an optional co-signer.</p>`,
    `<div class="fields">${rtoField("Driver's license number", 'dl')}${rtoField('License state', 'dlState', { options: RTO_STATES, value: 'SC' })}${rtoField('Birth date', 'dob', { type: 'date' })}${rtoField('Social Security number', 'ssn', { type: 'password', attrs: 'inputmode="numeric" autocomplete="off" placeholder="###-##-####"' })}</div>
     <label class="field">Photo of the driver's license${RTOF.a.idPhoto ? ` · on file: ${esc(RTOF.a.idPhoto)}` : ''}<input type="file" name="idPhoto" accept="image/*" capture="environment" ${RTOF.a.idPhoto ? '' : 'required'}></label>
     <p class="notice">Preview only: please do not type a real license or Social Security number or upload a real ID. Only the license state, the last 4 digits of the Social Security number and the name of the photo file are kept. The license number and birth date are not kept.</p>`,
    `<div class="fields">${rtoField('Secondary phone', 'phone2', { type: 'tel', optional: true })}${rtoField('Employer', 'employer')}${rtoField("Employer's phone", 'employerPhone', { type: 'tel', optional: true })}</div>
     <p class="source">For employer, "Retired" or "Self-employed" is fine.</p>
     <label class="field"><input type="checkbox" name="billingSame" ${RTOF.a.billingSame ? 'checked' : ''} onchange="document.getElementById('rto-billing').hidden=this.checked"> Billing address is the same as the delivery address on the invoice</label>
     <div id="rto-billing" ${RTOF.a.billingSame ? 'hidden' : ''}>${rtoField('Billing address', 'billing', { optional: true })}</div>`,
    `<div class="fields">${rtoField('Who owns the delivery property?', 'property', { options: ['Owns the property', 'Rents the property'], value: 'Owns the property' })}</div>
     <p class="source">If the customer rents, add the landlord so the building can be placed with permission.</p>
     <div class="fields">${rtoField("Landlord's name", 'landlord', { optional: true })}${rtoField("Landlord's phone", 'landlordPhone', { type: 'tel', optional: true })}</div>`,
    ref(1) + ref(2),
    `<label class="field"><input type="checkbox" name="cosigner" ${RTOF.a.cosigner ? 'checked' : ''} onchange="const f=document.getElementById('rto-cs');f.hidden=f.disabled=!this.checked"> Add a co-signer to this application</label>
     <fieldset id="rto-cs" class="od-fieldset" ${RTOF.a.cosigner ? '' : 'hidden disabled'}><div class="fields">${rtoField('Full name', 'csName')}${rtoField('Phone', 'csPhone', { type: 'tel' })}${rtoField('Relationship to the applicant', 'csRel')}${rtoField("Driver's license number", 'csDl')}${rtoField('License state', 'csDlState', { options: RTO_STATES, value: 'SC' })}${rtoField('Birth date', 'csDob', { type: 'date' })}${rtoField('Social Security number', 'csSsn', { type: 'password', attrs: 'inputmode="numeric" autocomplete="off" placeholder="###-##-####"' })}</div></fieldset>
     <p class="source">Leave the box empty if there is no co-signer.</p>`,
    `<p>Ready to save. The contract is made from these answers plus the invoice.</p>
     <div class="od-recap">${odRow('Identity', RTOF.a.idPhoto ? 'Entered, with ID photo' : 'Entered · ID photo missing')}${odRow('Contact and work', 'Entered')}${odRow('Property', esc(RTOF.a.property || ''))}${odRow('References', '2 of 2')}${odRow('Co-signer', RTOF.a.cosigner ? esc(RTOF.a.csName || 'Added') : 'None')}</div>
     <div class="od-todo"><strong>To confirm · Payment due day</strong>Not decided yet. This application does not ask for it.</div>
     <p class="od-lock">${icon('alert', 16)} After saving, these answers are not shown on the order page. They can only be seen by downloading the contract.</p>`,
  ][step];
  modal('Rent-to-own application', `<div class="od-steps">${chevronTrack(RTO_STEPS, step)}</div>
    <form id="rtoForm" onsubmit="event.preventDefault();rtoNext()"><h3 class="od-stephead">${RTO_STEPS[step]}</h3>${body}
    <div class="actions">${step ? button('← Back', `rtoKeep();rtoApply(${step - 1})`, 'secondary').replace('<button', '<button type="button"') : ''}<button class="primary" type="submit">${step === RTO_LAST ? 'Save application' : step === 0 ? 'Start' : 'Continue →'}</button></div></form>`);
}
function rtoKeep() {
  const form = document.getElementById('rtoForm');
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') RTOF.a[el.name] = el.checked;
    else if (el.type === 'file') { if (el.files[0]) RTOF.a[el.name] = el.files[0].name; }
    else if (el.name === 'ssn' || el.name === 'csSsn') { if (el.value) RTOF.a[el.name + '4'] = el.value.replace(/\D/g, '').slice(-4); }
    else if (RTO_SECRET[el.name]) { if (el.value.trim()) RTOF.a[RTO_SECRET[el.name]] = true; }
    else RTOF.a[el.name] = el.value.trim();
  }
}
function rtoNext() {
  rtoKeep();
  if (RTOF.step < RTO_LAST) return rtoApply(RTOF.step + 1);
  const s = S.sales.find((x) => x.id === S.activeSale);
  s.rtoApp = { provider: 'RTO provider', signedOn: odToday(), term: s.billing?.term || 60, a: { ...RTOF.a } };
  s.rto = true;
  s.events.push({ text: 'Rent-to-own application completed', time: new Date().toLocaleTimeString() });
  RTOF = { step: 0, a: {} };
  closeModal();
  render();
  toast('Application saved. The contract is ready to download.');
}
/* The contract as a file. This is the only place the application answers can be read. */
function rtoDownload() {
  const s = S.sales.find((x) => x.id === S.activeSale), inv = orderInvoice(s), app = s.rtoApp, a = app.a;
  const taxTotal = inv.taxes ? inv.taxes.reduce((t, x) => t + x[1], 0) : 0;
  const text = [
    'CUSTOMER DATA SHEET', '',
    `Lessee / rental customer: ${inv.shipTo.name}`, `Primary phone: ${inv.shipTo.phone}`, `Secondary phone: ${a.phone2 || ''}`, `Email: ${inv.shipTo.email}`,
    `Driver's license: ${a.dlState} · number ${a.dlGiven ? 'entered, not kept in this preview' : 'not entered'}`, `Birth date: ${a.dobGiven ? 'entered, not kept in this preview' : 'not entered'}`, `Social Security number: ***-**-${a.ssn4 || '____'}`,
    `Employer: ${a.employer}`, `Employer's phone: ${a.employerPhone || ''}`,
    `Delivery address: ${inv.shipTo.street}, ${inv.shipTo.city}`, `Billing address: ${a.billingSame ? 'Same as delivery' : a.billing || ''}`, '',
    `Photo of ID: ${a.idPhoto || 'not provided'}`, `Delivery property: ${a.property || ''}${a.landlord ? ' · landlord ' + a.landlord + (a.landlordPhone ? ', ' + a.landlordPhone : '') : ''}`, '',
    `Reference 1: ${a.r1name}, ${a.r1phone}, ${a.r1rel}, ${a.r1state}`, `Reference 2: ${a.r2name}, ${a.r2phone}, ${a.r2rel}, ${a.r2state}`,
    a.cosigner ? `Co-signer: ${a.csName}, ${a.csPhone}, ${a.csRel}, license ${a.csDlState} (number ${a.csDlGiven ? 'entered, not kept' : 'not entered'}), birth date ${a.csDobGiven ? 'entered, not kept' : 'not entered'}, SSN ***-**-${a.csSsn4 || '____'}` : 'Co-signer: none', '',
    'Payment due day: TO BE CONFIRMED', '',
    'RENTAL PURCHASE AGREEMENT (summary)', '',
    `Owner / lessor: ${app.provider}`, `Date: ${app.signedOn}`, `Property: ${inv.lines[0][0]}${inv.serial ? ', serial ' + inv.serial : ''}`,
    ...inv.lines.slice(1).map((l) => `  Add-on: ${l[0]}`),
    `Cash price before tax: ${money(inv.subtotal)}`, `Term: ${app.term} monthly payments`,
    inv.monthly != null ? `Monthly rental payment: ${money(inv.monthly)} + ${money(taxTotal)} tax${inv.waiver ? ' + ' + money(inv.waiver) + ' loss damage waiver' : ''}` : '',
    inv.dueToday != null ? `Initial payment: ${money(inv.dueToday)}` : '', '',
    'Preview file. The live version downloads the full signed contract as a PDF.',
  ].filter((x) => x !== '').join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })), link = document.createElement('a');
  link.href = url;
  link.download = `RTO-contract-${inv.number}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  s.events.push({ text: 'Rent-to-own contract downloaded', time: new Date().toLocaleTimeString() });
  toast('Contract downloaded.');
}

/* The order page takes over from the old sale record. Build-on-site reviews keep their own page. */
{
  const oldSale = sale;
  sale = function () {
    const s = S.sales.find((x) => x.id === S.activeSale);
    return s && s.path === 'site' ? oldSale() : orderPage();
  };
}
