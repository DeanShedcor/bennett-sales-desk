/* sale-flow.js: the order page's Next steps, from Finalize to delivery.

   Two authorities. This preview decides how each step looks and the order the salesperson takes
   it in. Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does, so every
   step names the existing function it hooks, and anything that exists only here is marked
   "Preview only".

   At the desk: the customer signs the invoice, terms and delivery agreement; a rent-to-own sale
   completes the RTO application; the floor plan can be checked; then Submit for admin review,
   which stays off until everything is signed.
   Handoffs: Order Intake approves, the plant moves through its nine phases, the QC build book
   passes the building, Logistics schedules and delivers. The desk only shows where the order is;
   a marked "Preview stand-ins" box acts for those apps so the preview can walk the whole path.

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
  modal('Complete the sale · create the order', `<p><strong>${esc(d.firstName + ' ' + d.lastName)}</strong><br>${esc(d.email)} · ${esc(d.phone)}</p><p>${d.same ? 'Delivery address matches billing.' : 'Separate delivery address provided.'}</p>
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
    s.toConfirm = catalogReviewItems(s.c);
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

/* ---------- Complete the sale never turns into a quote ----------
   The Sales desk used to open the quote form when anything was marked "confirm before quoting".
   Now the salesperson sees the list and chooses: go back to the building, or complete the sale with
   those items carried onto the order for the office to confirm at admin review. */
{
  const salesFinalize = finalizeForm;
  finalizeForm = function (details) {
    const items = catalogReviewItems(S.c), key = JSON.stringify(S.c);
    if (!items.length || S.sfAck === key) return salesFinalize(details);
    modal('Before you complete the sale', `<p>These are not settled for this building yet:</p>
      <ul class="sf-confirm-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>You can change the building, or complete the sale now. The office confirms these during admin review, and they show in red on the order until then.</p>
      <div class="actions">${button('← Back to the building', 'closeModal()', 'secondary')}${button('Complete the sale ' + icon('arrow', 18), 'S.sfAck=JSON.stringify(S.c);closeModal();finalizeForm()')}</div>`);
  };
  const run = finalizeForm;
  finalizeForm = function (details) {
    if (S.sfAck !== JSON.stringify(S.c) || !catalogReviewItems(S.c).length) return run(details);
    const real = catalogReviewItems;
    catalogReviewItems = () => [];
    try { return run(details); } finally { catalogReviewItems = real; }
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

/* ---------- Submitting (the desk's own job) ---------- */
function sfSubmit() {
  const s = sfSale();
  if (!s || sfMissing(s).length) return toast('Finish the steps listed before submitting.');
  s.status = 'Submitted · Awaiting review';
  s.fulfillment = 'Review pending';
  s.discrepancy = false;
  s.rto = s.type === 'Rent-to-own' ? !!s.rtoApp : s.rto;
  sfLog(s, 'Submitted to administrator for review');
  render();
  toast('Submitted for admin review.');
}

/* ---------- Preview stand-ins for the other apps ----------
   In Turbo Assist the administrator approves in Order Intake, Production accepts the order and
   moves the plant phases, the QC build book passes the building, and Logistics schedules and
   delivers. None of that happens on the desk. These buttons only let the preview walk the
   whole path; they sit in their own marked box under the handoffs. */
const SF_QA = () => phaseNames.indexOf('Final QA');
function sfPlantNext() {
  const s = sfSale();
  if (!s) return;
  s.plantPhase = Math.min((s.plantPhase ?? -1) + 1, SF_QA());
  s.fulfillment = phaseNames[s.plantPhase];
  sfLog(s, `Plant: ${phaseNames[s.plantPhase]}`);
  if (s.plantPhase === SF_QA() && !s.built) {
    s.built = odToday();
    sfLog(s, 'Plant: ready for final QA · on the Plant QC list');
    if (typeof syncSales === 'function') syncSales();
  }
  render();
}
function sfSchedule() {
  const s = sfSale(), v = document.getElementById('sf-date')?.value;
  if (!s || !v) return toast('Pick a delivery date.');
  s.deliverOn = v;
  s.fulfillment = `Delivery scheduled ${sfDay(v)}`;
  sfLog(s, `Logistics: delivery scheduled for ${sfDay(v)}`);
  render();
}
function sfReceipt() {
  const s = sfSale();
  modal('Proof of delivery', `<p class="sf-standin-note">Preview stand-in for Turbo Logistics: the driver collects this on site.</p><div class="od-paper od-legal"><div class="od-paperhead"><strong>Delivery receipt</strong><span>Invoice # ${esc(orderInvoice(s).number)}</span></div>
    <p>${esc(label(s.c))}${s.c.package && activePackage(s.c) ? ' · ' + esc(s.c.package) : ''}, delivered to ${esc(orderInvoice(s).shipTo.street || 'the delivery address on the invoice')}.</p>
    <p>The customer confirms the building was delivered, set and blocked where they asked, and has walked around it with the driver.</p></div>`
    + sfPad('receipt', orderInvoice(s).shipTo.name || s.customer, 'The customer received the building and is satisfied with where it was set.'));
  sfWire();
}
/* Where the plant's QC stands for this order. */
function sfQc(s) {
  const b = typeof build === 'function' && build(s.id);
  return { b, passed: b && qcStatus(b) === 'Ready to ship', text: b ? dealerStatus(b) : 'After the plant reaches Final QA' };
}
/* Approval puts a custom order on the plant at its first phase. */
{
  const salesReview = reviewAction;
  reviewAction = function (action) {
    salesReview(action);
    const s = sfSale();
    if (action === 'approve' && s?.status === 'Processed · Sold' && s.path !== 'lot' && s.plantPhase == null) {
      s.plantPhase = 0;
      s.fulfillment = phaseNames[0];
      render();
    }
  };
}

/* ---------- The steps ----------
   Each step says what Turbo Assist (bennett-buddy b42d324) already does for it ("hook"), and
   what exists only in this preview so far ("only"). */
const SF_HOOK = {
  sign: 'Turbo Sign: <code>sendInstance</code> → embedded signing (<code>instanceEmbeddedUrl</code>); the signed copy lands in the deal paperwork through <code>mirrorSignedContractToPaperwork</code>.',
  rto: 'Contract plan: partner <code>rto_lease</code> template, filled by <code>instancePrefill</code> and signed through Turbo Sign.',
  submit: '<code>SalesDeskSubmit</code> → <code>SalesRepIntakeForm</code> → order intake (<code>orderIntakeService</code>).',
  plan: 'The plant packet’s Floor plan slot (<code>ensureCustomerOrderPaperworkItems</code>).',
  approve: 'Order Intake, in the office. The desk records the handoff (<code>salesDeskHandoffEntry</code>).',
  plant: 'Production → Accept order puts it on the plant. Phases from <code>mfg_build_pipeline_v1</code>; the desk reads them with <code>salesDeskBuildStage</code>.',
  qc: 'The QC build book report (<code>mfg_qa_qc_build_book.md</code>). The desk opens that report.',
  ship: 'Turbo Logistics (<code>shipmentsService</code>, <code>routesService</code>).',
  pod: 'Turbo Logistics proof of delivery, filed to the deal paperwork; desk history reads <code>customer_order_delivered</code>.',
};
const SF_ONLY = {
  sign: 'Signing on this screen with a finger. The contract plan signs through the provider instead.',
  rto: 'The step-by-step application. Turbo Assist has no record for it yet; its desk shows “RTO application: Not recorded”.',
  submit: 'Holding Submit until everything is signed. No plan sets that rule yet.',
  plan: 'The floor plan editor and build sheet. The configurator plan leaves drawing floor plans in the browser out of scope.',
  pod: 'The on-screen delivery signature, until Logistics’ form is wired to the order.',
};
function sfSteps(s) {
  const lot = s.path === 'lot', signing = SF_SIGNING.includes(s.status), after = ['Processed · Sold', 'Delivered'].includes(s.status);
  const reviewing = s.status === 'Submitted · Awaiting review', rto = s.type === 'Rent-to-own';
  const desk = [], handoff = [], signed = sfSigned(s);
  for (const [k, t] of SF_DOCS)
    desk.push({ title: `Customer signs the ${t.toLowerCase()}`, on: signed[k], text: signed[k] ? `Signed ${signed[k]} by ${esc(s.signatures?.[k]?.name || s.customer)}` : 'Read it with the customer, then they sign', act: signing && !signed[k] ? `<button type="button" class="secondary small" onclick="sfSignDoc('${k}')">Sign</button>` : '', hook: SF_HOOK.sign, only: SF_ONLY.sign });
  if (rto)
    desk.push({ title: 'Rent-to-own application', on: s.rtoApp, text: s.rtoApp ? 'All parts done' : `${Math.max(0, Math.min((s.rtoStep || 0) - 1, 5))} of 5 parts done`, act: signing && !s.rtoApp ? button(s.rtoStep > 1 && RTOF.sale === s.id ? 'Continue' : 'Start', s.rtoStep > 1 && RTOF.sale === s.id ? `rtoApply(${Math.min(s.rtoStep, RTO_LAST)})` : 'rtoApply(0)', 'secondary small') : '', hook: SF_HOOK.rto, only: SF_ONLY.rto });
  if (!lot)
    desk.push({ title: 'Customer checks the floor plan', on: s.c.sheet?.ok, optional: true, text: s.c.sheet?.ok ? 'Layout confirmed' : 'Optional: walk the customer through where everything goes', act: !s.c.sheet?.ok && !after ? `<button type="button" class="secondary small" onclick="openBuildSheet('${s.id}')">Open floor plan</button>` : '', hook: SF_HOOK.plan, only: SF_ONLY.plan });
  const missing = sfMissing(s);
  desk.push({ title: 'Submit for admin review', on: !signing, text: signing ? (missing.length ? `Still needed: ${missing.join('; ')}` : 'Everything is signed') : `Submitted${reviewing ? ' · waiting on the office' : ''}`, act: signing ? `<button type="button" class="primary small" ${missing.length ? 'disabled' : ''} onclick="sfSubmit()">Submit for admin review</button>` : '', block: signing && missing.length, hook: SF_HOOK.submit, only: SF_ONLY.submit });

  handoff.push({ title: 'Order Intake approves', on: after, text: after ? 'Approved' : s.status === 'Correction requested' ? 'The office asked for a correction. Fix it, then submit again.' : reviewing ? 'Waiting on the office' : 'After you submit', hook: SF_HOOK.approve });
  if (!lot) {
    const phase = s.plantPhase ?? -1, qc = sfQc(s), done = qc.passed || phase >= phaseNames.length - 1;
    handoff.push({ title: 'Plant builds it', on: done || phase >= SF_QA(), text: phase < 0 ? 'After Order Intake approves' : phaseNames[Math.max(phase, 0)], extra: phase >= 0 ? `<div class="sf-phases">${chevronTrack(phaseNames, done ? phaseNames.length : phase)}</div>` : '', hook: SF_HOOK.plant });
    handoff.push({ title: 'Passes plant QC', on: qc.passed, text: qc.text, act: qc.b ? `<button type="button" class="secondary small" onclick="openBuild('${s.id}')">Open the QC report</button>` : '', hook: SF_HOOK.qc });
  }
  handoff.push({ title: 'Logistics schedules delivery', on: s.deliverOn, text: s.deliverOn ? sfDay(s.deliverOn) : lot ? 'After Order Intake approves' : 'After the building passes plant QC', hook: SF_HOOK.ship });
  handoff.push({ title: 'Delivered and signed for', on: s.deliveredAt, text: s.deliveredAt ? `Delivered ${s.deliveredAt} · signed by ${esc(s.signatures?.receipt?.name || s.customer)}` : 'The driver collects the customer’s signature', hook: SF_HOOK.pod, only: SF_ONLY.pod });
  return { desk, handoff };
}
/* Buttons that stand in for Order Intake, Production, Plant QC and Logistics in this preview. */
function sfStandins(s) {
  const lot = s.path === 'lot', after = s.status === 'Processed · Sold', qc = sfQc(s), b = [];
  if (s.status === 'Submitted · Awaiting review') b.push(button('Order Intake: approve', "reviewAction('approve')", 'secondary small'), button('Order Intake: ask for a correction', "reviewAction('correction')", 'secondary small'));
  if (after && !lot && (s.plantPhase ?? -1) < SF_QA()) b.push(button(`Production: move to ${phaseNames[(s.plantPhase ?? -1) + 1]}`, 'sfPlantNext()', 'secondary small'));
  if (after && !lot && qc.b && !qc.passed) b.push(button('Plant QC: open the inspection', `openBuild('${s.id}')`, 'secondary small'));
  if (after && !s.deliverOn && (lot || qc.passed)) b.push(`<span class="sf-sched"><input type="date" id="sf-date" min="${new Date().toISOString().slice(0, 10)}" aria-label="Delivery date">${button('Logistics: schedule', 'sfSchedule()', 'secondary small')}</span>`);
  if (after && s.deliverOn && !s.deliveredAt) b.push(button('Logistics: delivered, customer signs', 'sfReceipt()', 'secondary small'));
  return b.length ? `<div class="sf-standin"><strong>Preview stand-ins</strong><span>These buttons act for the other apps so the preview can walk the whole path. Salespeople do not see them in Turbo Assist.</span><div class="actions">${b.join('')}</div></div>` : '';
}
function sfRow(x, now) {
  const notes = S.sfNotes === false ? '' : `${x.hook ? `<small class="sf-hook"><b>Turbo Assist</b> ${x.hook}</small>` : ''}${x.only ? `<small class="sf-only"><b>Preview only</b> ${x.only}</small>` : ''}`;
  return `<div class="od-doc sf-step${now ? ' now' : ''}${x.block ? ' blocked' : ''}"><span class="od-check ${x.on ? 'on' : ''}">${x.on ? icon('check', 16) : ''}</span><div class="grow"><strong>${x.title}</strong><small>${x.text}</small>${x.extra || ''}${notes}</div>${x.act || ''}</div>`;
}
function sfPanel(s) {
  const { desk, handoff } = sfSteps(s), all = [...desk, ...handoff], now = all.find((x) => !x.on && !x.optional), done = all.filter((x) => x.on).length;
  return `<section class="panel sf-panel"><div class="panelhead"><h2>Next steps</h2><span class="sf-headr"><button type="button" class="link" onclick="S.sfNotes=S.sfNotes===false;render()">${S.sfNotes === false ? 'Show' : 'Hide'} product notes</button><span class="pill ${now ? 'amber' : 'good'}">${now ? `${done} of ${all.length} done` : 'Complete'}</span></span></div>
    ${s.toConfirm?.length && !['Processed · Sold', 'Delivered'].includes(s.status) ? `<div class="sf-toconfirm"><strong>Office confirms at admin review</strong><ul>${s.toConfirm.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <h3 class="sf-group">At the desk</h3>${desk.map((x) => sfRow(x, x === now)).join('')}
    <h3 class="sf-group">Handoffs <small>other apps do these; the desk shows where the order is</small></h3>${handoff.map((x) => sfRow(x, x === now)).join('')}
    ${sfStandins(s)}
  </section>`;
}

/* ---------- The order page ---------- */
orderTrack = function (s) {
  const lot = s.path === 'lot', hold = s.status === 'Correction requested';
  const names = ['Quote', 'Signed', hold ? 'Correction needed' : 'Admin review', ...(lot ? [] : ['Plant', 'Plant QC']), 'Delivery', 'Delivered'];
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
    /* QC passed: the plant's last phase, Build complete. */
    if (s.built && sfQc(s).passed && s.plantPhase < phaseNames.length - 1) s.plantPhase = phaseNames.length - 1;
    html = html.replace('<div class="od-grid">', sfPanel(s) + '<div class="od-grid">').replace('<span class="pill amber">Delivered</span>', '<span class="pill good">Delivered</span>');
    /* The office's approve / correction buttons now live in the stand-in box, marked as Order Intake. */
    html = html.replace(/<p>Administrator: check the options[\s\S]*?<\/div>/, '<p class="sf-standin-note">Approval happens in Order Intake. In this preview, use the stand-in buttons under Next steps.</p>');
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
