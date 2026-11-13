/* sale-flow.js: takes a sale from "Finalize" all the way to delivery, with every check mark on
   the order page tied to something that actually happens.

   1. Finalize creates the order and waits on the customer's signatures.
   2. The customer signs the invoice, the terms and the delivery agreement on screen. On a
      rent-to-own sale the RTO application parts tick off as each step is finished.
   3. Submit for admin review stays off, listing what is missing, until all of that is done.
   4. After approval: build sheet confirmed, build started, build complete (the building then
      shows up in Plant QC), passed plant QC, delivery scheduled, delivered and signed for.

   Signatures stay in this browser tab only, like everything else in the preview.
   Loaded last; wraps the Sales desk, order page and Plant QC globals. */

const SF_DOCS = [
  ['invoice', 'Invoice'],
  ['terms', 'Terms and conditions of sale'],
  ['delivery', 'Delivery and blocking agreement'],
];
const SF_SIGNING = ['Sold · Awaiting signatures', 'Correction requested'];
const sfSale = () => S.sales.find((x) => x.id === S.activeSale);
const sfNow = () => new Date().toLocaleTimeString();
const sfLog = (s, text) => s.events.push({ text, time: sfNow() });
const sfDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/* What still stands between this order and admin review. */
const sfSigned = (s) => orderInvoice(s).signed || {};
function sfMissing(s) {
  const signed = sfSigned(s), out = SF_DOCS.filter(([k]) => !signed[k]).map(([, t]) => `Customer signature on the ${t.toLowerCase()}`);
  if (s.type === 'Rent-to-own' && !s.rtoApp) out.push('Rent-to-own application (all parts)');
  return out;
}

/* ---------- Finalize: no more pretend checklist; the order is created and signing starts ---------- */
continueBilling = function (form) {
  const { type, term, deposit } = form.elements;
  const isRto = type.value === 'Rent-to-own';
  reviewBilling = { type: type.value, term: isRto ? Number(term.value) : null, deposit: Number(deposit.value) };
  reviewChecklist = [];
  showSaleReview();
};
showSaleReview = function () {
  const d = reviewCustomer, b = reviewBilling, rto = b.type === 'Rent-to-own';
  const next = [...SF_DOCS.map(([, t]) => `The customer signs the ${t.toLowerCase()}`), ...(rto ? ['The customer completes the rent-to-own application'] : []), 'You submit it for admin review'];
  modal('Finalize sale · create the order', `<p><strong>${esc(d.firstName + ' ' + d.lastName)}</strong><br>${esc(d.email)} · ${esc(d.phone)}</p><p>${d.same ? 'Delivery address matches billing.' : 'Separate delivery address provided.'}</p>
    <p><strong>${b.type}</strong> · ${money(amount())} building subtotal<br>Deposit recorded: ${money(b.deposit)}${rto ? `<br>${b.term} months · ${money(payment(amount(), b.term))}/mo before tax` : `<br>Remaining building subtotal: ${money(amount() - b.deposit)}`}</p>
    <h3>Next, on the order page</h3><ol class="sf-next">${next.map((x) => `<li>${x}</li>`).join('')}</ol>
    <div class="actions">${button('← Billing', 'openBilling()', 'secondary')}${button('Create the order →', 'submitSale()')}</div>`);
};
{
  const salesSubmit = submitSale;
  submitSale = function () {
    const before = S.sales.length;
    salesSubmit();
    const s = sfSale();
    if (!s || s.status !== 'Submitted · Awaiting review' || s.signed) return;
    s.status = 'Sold · Awaiting signatures';
    s.fulfillment = 'Waiting on customer signatures';
    s.signed = {};
    s.signatures = {};
    const last = s.events[s.events.length - 1];
    if (last && /Submitted to administrator/.test(last.text)) s.events.pop();
    sfLog(s, before < S.sales.length ? 'Order created · waiting on customer signatures' : 'Quote finalized · waiting on customer signatures');
    render();
  };
}

/* ---------- Signing on screen ---------- */
/* A pad to sign on with a finger or a mouse, the printed name, and an "I agree" box. */
function sfPad(kind, name, agree) {
  return `<div class="sf-signbox no-print" data-kind="${kind}">
    <h3>Customer signature</h3>
    <label class="field">Printed name<input id="sf-name" value="${esc(name)}" oninput="sfReady()" autocomplete="off"></label>
    <div class="sf-padwrap"><canvas id="sf-pad" class="sf-pad" aria-label="Sign here with a finger or the mouse"></canvas><span class="sf-padhint">Sign here</span>
      <button type="button" class="chipbtn sf-clear" onclick="sfClear()">Clear</button></div>
    <label class="sf-agree"><input type="checkbox" id="sf-agree" onchange="sfReady()"> ${agree}</label>
    <p class="source">Preview: use a fictional name. The signature stays in this browser tab.</p>
    <div class="actions"><button type="button" class="primary" id="sf-sign" disabled onclick="sfSign('${kind}')">Sign</button></div></div>`;
}
let sfInk = false;
function sfWire() {
  const c = document.getElementById('sf-pad');
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), r = c.getBoundingClientRect();
  c.width = Math.round(r.width * dpr);
  c.height = Math.round(r.height * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.lineWidth = 2.4;
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = '#0c1a28';
  sfInk = false;
  let last = null;
  const at = (e) => {
    const b = c.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  c.onpointerdown = (e) => {
    c.setPointerCapture(e.pointerId);
    last = at(e);
    e.preventDefault();
  };
  c.onpointermove = (e) => {
    if (!last) return;
    const p = at(e);
    g.beginPath();
    g.moveTo(...last);
    g.lineTo(...p);
    g.stroke();
    last = p;
    if (!sfInk) (sfInk = true), c.parentNode.classList.add('inked'), sfReady();
  };
  c.onpointerup = c.onpointercancel = () => (last = null);
}
function sfClear() {
  const c = document.getElementById('sf-pad');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  sfInk = false;
  c.parentNode.classList.remove('inked');
  sfReady();
}
function sfReady() {
  const ok = sfInk && document.getElementById('sf-agree')?.checked && document.getElementById('sf-name')?.value.trim();
  const btn = document.getElementById('sf-sign');
  if (btn) btn.disabled = !ok;
}
function sfSign(kind) {
  const s = sfSale(), name = document.getElementById('sf-name').value.trim();
  if (!s || !sfInk || !name) return;
  (s.signed ||= {})[kind] = odToday();
  (s.signatures ||= {})[kind] = { name, img: document.getElementById('sf-pad').toDataURL('image/png') };
  if (kind === 'receipt') {
    s.status = 'Delivered';
    s.fulfillment = 'Delivered';
    s.deliveredAt = odToday();
    sfLog(s, `Delivered · ${name} signed for the building`);
    if (s.path === 'lot' && lots[s.lot]) lots[s.lot].status = 'Sold';
  } else sfLog(s, `${name} signed the ${(SF_DOCS.find(([k]) => k === kind) || [, kind])[1].toLowerCase()}`);
  closeModal();
  render();
  const left = sfMissing(s);
  toast(kind === 'receipt' ? 'Delivered. The order is complete.' : left.length ? `Signed. ${left.length} left before admin review.` : 'Everything is signed. Ready to submit for admin review.');
}
/* Sign a document: the document itself, then the signature box under it. */
function sfSignDoc(kind) {
  const s = sfSale();
  orderDoc(kind);
  const actions = document.querySelector('.modal .actions.no-print');
  actions.insertAdjacentHTML('beforebegin', sfPad(kind, orderInvoice(s).shipTo.name || s.customer, `The customer has read the ${(SF_DOCS.find(([k]) => k === kind) || [, ''])[1].toLowerCase()} and agrees to it.`));
  sfWire();
  document.getElementById('sf-pad').scrollIntoView({ block: 'nearest' });
}
/* Show who signed, with the signature, on a signed document. */
{
  const salesDoc = orderDoc;
  orderDoc = function (kind) {
    salesDoc(kind);
    const sig = sfSale()?.signatures?.[kind], box = document.querySelector('.modal .od-sign > div');
    if (sig && box) box.insertAdjacentHTML('beforeend', `<img class="sf-sigimg" src="${sig.img}" alt="Signature of ${esc(sig.name)}">`);
    if (sig && kind === 'invoice') document.querySelector('.modal .od-paper')?.insertAdjacentHTML('beforeend', `<div class="od-sign"><div><small>Signed by</small><strong>${esc(sig.name)}</strong><img class="sf-sigimg" src="${sig.img}" alt="Signature of ${esc(sig.name)}"></div><div><small>Date</small><strong>${esc(sfSale().signed.invoice)}</strong></div></div>`);
  };
  const salesInvoice = orderInvoice;
  orderInvoice = function (s) {
    const inv = salesInvoice(s);
    return s.signed ? { ...inv, signed: { ...inv.signed, ...s.signed } } : inv;
  };
}

/* ---------- RTO application: remember how far the customer got ---------- */
{
  const salesRtoNext = rtoNext;
  rtoNext = function () {
    const s = sfSale(), step = RTOF.step;
    salesRtoNext();
    if (!s) return;
    s.rtoStep = Math.max(s.rtoStep || 0, step + 1);
    if (!s.rtoApp) render();
  };
}

/* ---------- Submitting, production and delivery ---------- */
function sfSubmit() {
  const s = sfSale();
  if (!s || sfMissing(s).length) return toast('Finish the steps listed before submitting.');
  s.status = 'Submitted · Awaiting review';
  s.fulfillment = 'Review pending';
  s.rto = s.type === 'Rent-to-own' ? !!s.rtoApp : s.rto;
  sfLog(s, 'Submitted to administrator for review');
  render();
  toast('Submitted for admin review.');
}
function sfPlant(step) {
  const s = sfSale();
  if (!s) return;
  if (step === 'start') {
    s.buildStarted = odToday();
    s.fulfillment = 'Build started at the plant';
    sfLog(s, 'Plant started the build');
  }
  if (step === 'built') {
    s.built = odToday();
    s.fulfillment = 'Built · waiting on plant QC';
    sfLog(s, 'Plant marked the build complete · sent to Plant QC');
    if (typeof syncSales === 'function') syncSales();
  }
  render();
}
function sfSchedule() {
  const s = sfSale(), v = document.getElementById('sf-date')?.value;
  if (!s || !v) return toast('Pick a delivery date.');
  s.deliverOn = v;
  s.fulfillment = `Delivery scheduled ${sfDay(v)}`;
  sfLog(s, `Delivery scheduled for ${sfDay(v)}`);
  render();
}
function sfReceipt() {
  const s = sfSale();
  modal('Delivery sign-off', `<div class="od-paper od-legal"><div class="od-paperhead"><strong>Delivery receipt</strong><span>Invoice # ${esc(orderInvoice(s).number)}</span></div>
    <p>${esc(label(s.c))}${s.c.package && activePackage(s.c) ? ' · ' + esc(s.c.package) : ''}, delivered to ${esc(orderInvoice(s).shipTo.street || 'the delivery address on the invoice')}.</p>
    <p>The customer confirms the building was delivered, set and blocked where they asked, and has walked around it with the driver.</p></div>`
    + sfPad('receipt', orderInvoice(s).shipTo.name || s.customer, 'The customer received the building and is satisfied with where it was set.'));
  sfWire();
}
/* Where the plant's QC stands for this order. */
function sfQc(s) {
  const b = typeof build === 'function' && build(s.id);
  return { b, passed: b && qcStatus(b) === 'Ready to ship', text: b ? dealerStatus(b) : 'Waiting on the build' };
}

/* The steps, in order, with the one to do now. */
function sfSteps(s) {
  const lot = s.path === 'lot', signing = SF_SIGNING.includes(s.status), after = ['Processed · Sold', 'Delivered'].includes(s.status);
  const reviewing = s.status === 'Submitted · Awaiting review';
  const rto = s.type === 'Rent-to-own';
  const steps = [], signed = sfSigned(s);
  for (const [k, t] of SF_DOCS) steps.push({ title: `Customer signs the ${t.toLowerCase()}`, on: signed[k], text: signed[k] ? `Signed ${signed[k]} by ${esc(s.signatures?.[k]?.name || s.customer)}` : 'Read it with the customer, then they sign on the screen', act: signing ? `<button type="button" class="secondary small" onclick="sfSignDoc('${k}')">Sign</button>` : '' });
  if (rto) steps.push({ title: 'Rent-to-own application', on: s.rtoApp, text: s.rtoApp ? 'All parts done' : `${Math.max(0, Math.min((s.rtoStep || 0) - 1, 5))} of 5 parts done`, act: signing && !s.rtoApp ? button(s.rtoStep > 1 && RTOF.sale === s.id ? 'Continue' : 'Start', s.rtoStep > 1 && RTOF.sale === s.id ? `rtoApply(${Math.min(s.rtoStep, RTO_LAST)})` : 'rtoApply(0)', 'secondary small') : '' });
  const missing = sfMissing(s);
  steps.push({ title: 'Submitted for admin review', on: !signing && s.status !== 'Quote issued', text: signing ? (missing.length ? `Still needed: ${missing.join('; ')}` : 'Everything is signed') : reviewing ? 'Waiting on the administrator' : 'Approved', act: signing ? `<button type="button" class="primary small" ${missing.length ? 'disabled' : ''} onclick="sfSubmit()">Submit for admin review</button>` : '', block: signing && missing.length });
  steps.push({ title: 'Approved by admin', on: after, text: after ? 'Approved' : reviewing ? 'Use Approve as admin under Review and history' : 'After submitting' });
  if (!lot) {
    const ok = s.c.sheet?.ok, qc = sfQc(s);
    steps.push({ title: 'Build sheet confirmed', on: ok, text: ok ? 'Floor plan and positions confirmed for the plant' : 'Check the floor plan with the customer, then Confirm layout', act: after && !ok ? `<button type="button" class="secondary small" onclick="openBuildSheet('${s.id}')">Open build sheet</button>` : '' });
    steps.push({ title: 'Build started', on: s.buildStarted, text: s.buildStarted ? `Started ${s.buildStarted}` : 'The plant starts the building', act: after && ok && !s.buildStarted ? button('Mark build started', "sfPlant('start')", 'secondary small') : '' });
    steps.push({ title: 'Build complete', on: s.built, text: s.built ? `Complete ${s.built} · sent to Plant QC` : 'The plant finishes the building', act: s.buildStarted && !s.built ? button('Mark build complete', "sfPlant('built')", 'secondary small') : '' });
    steps.push({ title: 'Passed plant QC', on: qc.passed, text: s.built ? qc.text : 'After the build is complete', act: qc.b && !qc.passed ? `<button type="button" class="secondary small" onclick="openBuild('${s.id}')">Open in Plant QC</button>` : '' });
  }
  const ready = s.status === 'Delivered' || (after && (lot || sfQc(s).passed));
  steps.push({ title: 'Delivery scheduled', on: s.deliverOn, text: s.deliverOn ? sfDay(s.deliverOn) : lot ? 'Pick a delivery day with the customer' : 'Once the building passes plant QC', act: ready && !s.deliverOn ? `<span class="sf-sched"><input type="date" id="sf-date" min="${new Date().toISOString().slice(0, 10)}" aria-label="Delivery date">${button('Schedule', 'sfSchedule()', 'secondary small')}</span>` : '' });
  steps.push({ title: 'Delivered and signed for', on: s.deliveredAt, text: s.deliveredAt ? `Delivered ${s.deliveredAt} · signed by ${esc(s.signatures?.receipt?.name || s.customer)}` : 'The customer signs for the building at delivery', act: s.deliverOn && !s.deliveredAt ? button('Customer sign-off', 'sfReceipt()', 'primary small') : '' });
  return steps;
}
function sfPanel(s) {
  const steps = sfSteps(s), now = steps.findIndex((x) => !x.on), done = steps.filter((x) => x.on).length;
  return `<section class="panel sf-panel"><div class="panelhead"><h2>Next steps</h2><span class="pill ${now < 0 ? 'good' : 'amber'}">${now < 0 ? 'Complete' : `${done} of ${steps.length} done`}</span></div>
    ${steps.map((x, i) => `<div class="od-doc sf-step${i === now ? ' now' : ''}${x.block ? ' blocked' : ''}"><span class="od-check ${x.on ? 'on' : ''}">${x.on ? icon('check', 16) : ''}</span><div class="grow"><strong>${x.title}</strong><small>${x.text}</small></div>${x.act || ''}</div>`).join('')}
  </section>`;
}

/* ---------- The order page ---------- */
orderTrack = function (s) {
  const lot = s.path === 'lot', hold = s.status === 'Correction requested';
  const names = ['Quote', 'Signed', hold ? 'Correction needed' : 'Admin review', ...(lot ? [] : ['In production', 'Plant QC']), 'Delivery', 'Delivered'];
  let at = { 'Quote issued': 0, 'Sold · Awaiting signatures': 1, 'Submitted · Awaiting review': 2, 'Correction requested': 2 }[s.status];
  if (s.status === 'Delivered') at = names.length;
  else if (s.status === 'Processed · Sold') at = lot ? 3 : !s.built ? 3 : !sfQc(s).passed ? 4 : 5;
  return chevronTrack(names, at ?? 0, hold);
};
{
  const salesOrderPage = orderPage;
  orderPage = function () {
    const s = sfSale();
    let html = salesOrderPage();
    if (!s || s.status === 'Quote issued') return html;
    if (s.built && typeof syncSales === 'function') syncSales(), syncDealer();
    html = html.replace('<div class="od-grid">', sfPanel(s) + '<div class="od-grid">').replace('<span class="pill amber">Delivered</span>', '<span class="pill good">Delivered</span>');
    /* Unsigned paperwork gets a Sign button next to View while the customer is signing. */
    if (SF_SIGNING.includes(s.status))
      for (const [k] of SF_DOCS)
        if (!sfSigned(s)[k]) html = html.replace(`onclick="orderDoc('${k}')">View</button>`, `onclick="orderDoc('${k}')">View</button><button type="button" class="primary small" onclick="sfSignDoc('${k}')">Sign</button>`);
    return html;
  };
}
/* Plant QC writes its own status onto the order; once delivery is scheduled the order's own status wins. */
if (typeof syncDealer === 'function') {
  const qcDealer = syncDealer;
  syncDealer = function () {
    const keep = new Map(S.sales.filter((s) => s.deliverOn || s.status === 'Delivered').map((s) => [s.id, s.fulfillment]));
    qcDealer();
    for (const s of S.sales) if (keep.has(s.id)) s.fulfillment = keep.get(s.id);
  };
}
