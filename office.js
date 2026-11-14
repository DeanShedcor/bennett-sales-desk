/* office.js: the Office side. One central office reviews every lot's orders.

   Two authorities. This preview decides how the screens look and the order the office works in.
   Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does: this side is
   drawn as its Order Intake review plus the deal paperwork, and every control names the function
   it would call. Anything that exists only here is listed under "Only in this preview" on the
   notes page (Office → What is real and what is not).

   What the office does here:
   - Reviews a submitted order against a checklist. Three things must be in before it can approve:
     the deposit or first payment, the confirmed floor plan, and (rent-to-own) the RTO company's yes.
   - Keeps the money lines: discounts with a purpose, the fuel surcharge, delivery charges, payments.
   - Places an order on hold with a reason the lot sees, or cancels it.
   - Releases a finished building to Logistics, through the lot or straight to the customer.
   - Approves change orders and the lots' stock orders.
   - Holds the settings that move with the market: fuel surcharge, free delivery miles, deposit.

   Nothing is saved: a reload starts over. Loaded after sale-flow.js; wraps Sales desk globals. */

const OF = {
  id: null, back: 'office', tile: 'all', lot: 'All', q: '', tab: 'review', payTab: 'confirm',
  set: {
    /* Fuel surcharge: a percent of the price (how it works today), by size (a square foot or a
       foot of length), or a flat amount. Each way keeps its own number; null until the office sets it. */
    fuel: { method: 'percent', pct: null, perSqFt: null, perFt: null, flat: null },
    fuelLog: [],
    overTo: 100, overFee: 100, /* 51 to 100 miles: $100, from the delivery agreement */
    depositPct: 10, /* the website asks cash customers for 10% at the time of order */
    driverPay: false, /* false: cash sales are paid in full before delivery */
    cardFeePct: 3, /* processing fee a card carries when a driver takes it; a starting number for the office to set */
    purposes: ['Military'],
    rtoCos: ['JMAG LLC'], /* one company today (the name on the sample contract); more can be added */
  },
};
/* Extra delivery charges, from the Delivery and blocking agreement every customer signs. */
const OF_FEES = [
  ['Extra row of blocks (2 runners)', 75], ['Extra row of blocks (4 runners)', 150], ['Anchor', 100],
  ['16 in pier set, building up to 32 ft', 750], ['16 in pier set, building over 32 ft', 1200], ['Return trip fee', 250],
];
const OF_METHODS = ['Card', 'Cash', 'Check', 'Bank transfer', 'Money order'];
const OF_FUEL = {
  percent: { key: 'pct', name: 'Percent of the price', hint: 'How it works today. A bigger price carries a bigger surcharge.', label: 'Percent of the building price (%)' },
  size: { key: 'perSqFt', name: 'By square foot', hint: 'So much a square foot of building: width × length.', label: 'Dollars per square foot of building' },
  linear: { key: 'perFt', name: 'By linear foot', hint: 'So much a foot of the building’s length.', label: 'Dollars per foot of length' },
  flat: { key: 'flat', name: 'Flat amount', hint: 'The same on every building.', label: 'Dollars per building' },
};
const ofFuelValue = (f = OF.set.fuel) => f[OF_FUEL[f.method].key];
const ofFuelSet = () => ofFuelValue() != null;
/* The surcharge for one building. `price` is the building and its options before the surcharge. */
function ofFuelFor(c, price) {
  const f = OF.set.fuel, v = ofFuelValue();
  if (v == null) return null;
  const length = Number(c.size.split('x')[1]);
  return Math.round((f.method === 'percent' ? (price * v) / 100 : f.method === 'size' ? floorArea(c) * v : f.method === 'linear' ? length * v : v) * 100) / 100;
}
function ofFuelSay(f = OF.set.fuel) {
  const v = ofFuelValue(f);
  return v == null ? 'not set' : f.method === 'percent' ? `${v}% of the building price` : f.method === 'size' ? `${money(v)} per sq ft of building` : f.method === 'linear' ? `${money(v)} per foot of length` : `${money(v)} per building`;
}
const OF_STAGE = { 'Submitted · Awaiting review': 'review', 'Correction requested': 'hold', 'Processed · Sold': 'approved', Delivered: 'delivered', Cancelled: 'cancelled' };
const OF_STAGE_NAME = { review: 'To review', hold: 'On hold', approved: 'Approved', delivered: 'Delivered', cancelled: 'Cancelled' };
const OF_STAGE_PILL = { review: 'blue', hold: 'red', approved: 'good', delivered: 'good', cancelled: 'ghost' };

const ofStage = (s) => OF_STAGE[s.status] || null;
const ofSale = (id) => S.sales.find((x) => x.id === id);
const ofAll = () => S.sales.filter(ofStage);
const ofLog = (s, text) => s.events.push({ text, time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
const ofSum = (list) => list.reduce((t, x) => t + Number(x.amount || 0), 0);
const ofRto = (s) => s.type === 'Rent-to-own' || /RTO/.test(s.invoice?.plan || '');
const ofRtoName = (s) => s.office?.rtoCo?.company || (s.rtoApp?.provider && s.rtoApp.provider !== 'RTO provider' ? s.rtoApp.provider : OF.set.rtoCos.length === 1 ? OF.set.rtoCos[0] : 'the RTO company');
const ofStamp = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ofAgo = (t) => {
  const h = Math.max(0, Math.round((Date.now() - t) / 36e5));
  return h < 1 ? 'under an hour ago' : h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.round(h / 24)} days ago`;
};

/* ---------- The office's own record on an order ----------
   s.office: hold, RTO company answer, delivery path, release.  s.money: the lines the invoice
   does not carry on its own.  s.site: the delivery site answers. */
function ofRec(s) {
  if (!s.office) s.office = { hold: null, holds: [], rtoCo: null, path: null, released: null, ticks: {}, cancel: null, approved: null };
  if (!s.money) {
    const first = s.invoice ? s.invoice.dueToday : Number(s.billing?.deposit) || 0;
    const at = s.submittedAt ? Date.parse(s.submittedAt) : Date.now();
    s.money = { fuel: s.path === 'lot' || s.invoice ? 0 : null, discounts: [], fees: [], payments: first > 0 ? [{ amount: first, method: 'Taken at the lot', at, confirmed: false }] : [] };
    const b = s.billing;
    if (b?.discount > 0) s.money.discounts.push({ amount: b.discount, purpose: b.purpose || '', ok: false, by: 'Salesperson' });
  }
  return s.office;
}

/* ---------- Money ---------- */
function ofTotals(s) {
  ofRec(s);
  const m = s.money, rto = ofRto(s), discounts = ofSum(m.discounts), fees = ofSum(m.fees);
  const total = s.total - discounts + fees; /* before tax */
  const paid = ofSum(m.payments.filter((p) => p.confirmed && !p.refunded)), pending = ofSum(m.payments.filter((p) => !p.confirmed));
  const inv = orderInvoice(s);
  return { rto, discounts, fees, total, paid, pending, balance: rto ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100), monthly: inv.monthly, depositMin: Math.round(total * OF.set.depositPct) / 100 };
}
/* May this building go to the customer's home? Rent-to-own once the RTO company says yes; cash once
   it is paid in full, or with the balance collected by the driver when that setting is on. */
function ofPayRule(s) {
  const t = ofTotals(s), o = s.office;
  if (t.rto) return o.rtoCo?.state === 'approved' ? { ok: true, text: 'Rent-to-own approved' } : { ok: false, text: 'Waiting on the RTO company' };
  if (t.balance <= 0) return { ok: true, text: 'Paid in full', full: true };
  return OF.set.driverPay ? { ok: true, text: `Driver collects ${money(t.balance)} at delivery`, collect: t.balance } : { ok: false, text: `Balance of ${money(t.balance)} is due before delivery` };
}
/* Built and passed plant QC? A lot building is already built. */
function ofBuilt(s) {
  if (s.path === 'lot') return { ok: true, text: 'On the lot' };
  const b = typeof build === 'function' && build(s.id);
  if (b && qcStatus(b) === 'Ready to ship') return { ok: true, text: `Passed plant QC${b.signoff ? ' · signed off ' + ofStamp(b.signoff.at) : ''}` };
  if (b) return { ok: false, text: dealerStatus(b) };
  const p = s.plantPhase ?? -1;
  return { ok: false, text: p < 0 ? 'Not started' : `At the plant: ${phaseNames[p]}` };
}
/* Delivery charge for the miles on file: free inside the free miles, a set charge up to the next
   mark, and past that a fee Logistics approves. */
function ofDelivery(s) {
  const miles = s.site?.miles === '' || s.site?.miles == null ? null : Number(s.site.miles), free = FREE_DELIVERY_MILES;
  if (miles == null) return { miles, text: 'Miles not recorded', state: 'todo' };
  if (miles <= free) return { miles, text: `${miles} miles · free within ${free}`, state: 'ok', fee: 0 };
  if (miles <= OF.set.overTo) return { miles, text: `${miles} miles · ${free + 1} to ${OF.set.overTo} miles is ${money(OF.set.overFee)}`, state: 'ok', fee: OF.set.overFee };
  const lg = s.money?.fees.find((f) => f.by === 'Logistics');
  return lg ? { miles, text: `${miles} miles · ${money(lg.amount)} approved by Logistics`, state: 'ok', fee: lg.amount, over: true, approved: true }
    : { miles, text: `${miles} miles · over ${OF.set.overTo}: Logistics approves the fee`, state: 'todo', fee: null, over: true };
}
/* Keep the mileage charge on the order in step with the miles: one line, added, changed or removed. */
function siteFeeSync(s) {
  ofRec(s);
  const m = s.money, d = ofDelivery(s);
  m.fees = m.fees.filter((f) => !f.auto || (f.by === 'Logistics' && d.over));
  if (d.fee && !d.over) m.fees.push({ name: `Delivery · ${d.miles} miles`, amount: d.fee, auto: true });
  return d.fee && !d.over ? d.fee : 0;
}
/* Today's price list total for a custom order, without the fuel surcharge. */
function ofListPrice(s) {
  if (s.invoice || s.path === 'lot') return null;
  try {
    return Math.round(breakdown(s.c).filter((r) => r.name !== 'Fuel surcharge').reduce((t, r) => t + r.amount, 0) * 100) / 100;
  } catch { return null; }
}

/* ---------- The checklist ----------
   Each check: state ok | todo | wait | bad, and whether approval waits on it. */
function ofChecks(s) {
  const o = ofRec(s), m = s.money, inv = orderInvoice(s), t = ofTotals(s), lotSale = s.path === 'lot', id = s.id, out = [];
  const btn = (text, fn, cls = 'secondary small') => `<button type="button" class="${cls}" onclick="${fn}">${text}</button>`;

  const st = inv.shipTo, gone = [!st.name && 'name', !st.phone && 'phone', !st.street && 'street address', !st.city && 'city, state and ZIP'].filter(Boolean);
  out.push({ key: 'customer', short: 'Address', title: 'Customer and delivery address', must: true, state: gone.length ? 'bad' : 'ok',
    text: gone.length ? `Missing: ${gone.join(', ')}` : `${esc(st.name)} · ${esc(st.phone)} · ${esc(st.street)}, ${esc(st.city)}`, hold: 'Customer or delivery address is incomplete' });

  const unsigned = SF_DOCS.filter(([k]) => !inv.signed[k]).map(([, n]) => n.toLowerCase());
  const rtoGap = t.rto && !s.rtoApp;
  out.push({ key: 'paper', short: 'Signatures', title: 'Paperwork signed', must: true, state: unsigned.length || rtoGap ? 'bad' : 'ok',
    text: unsigned.length ? `Not signed: ${unsigned.join(', ')}` : rtoGap ? 'The rent-to-own application is not finished' : `Invoice, terms and delivery agreement signed ${esc(inv.signed.invoice)}${t.rto ? ' · rent-to-own application complete' : ''}`,
    act: btn('Invoice', `ofDoc('${id}','invoice')`), hold: 'Paperwork is not fully signed' });

  const got = m.payments.filter((p) => p.confirmed && !p.refunded), wait = m.payments.filter((p) => !p.confirmed), what = t.rto ? 'first payment' : 'deposit';
  out.push({ key: 'deposit', short: t.rto ? 'First payment' : 'Deposit', title: t.rto ? 'First payment received' : 'Deposit received', must: true,
    state: got.length ? 'ok' : wait.length ? 'todo' : 'bad',
    text: got.length ? `${money(ofSum(got))} received and confirmed${!t.rto && t.balance <= 0 ? ' · paid in full' : ''}${!t.rto && ofSum(got) < t.depositMin ? ` · under the usual ${OF.set.depositPct}% (${money(t.depositMin)})` : ''}${wait.length ? ` · ${money(ofSum(wait))} more to confirm` : ''}`
      : wait.length ? `${money(ofSum(wait))} ${esc(wait[0].method.toLowerCase())} · the lot recorded it, the office has not confirmed it` : `No ${what} recorded${t.rto ? '' : ` · cash sales take ${OF.set.depositPct}% at the time of order (${money(t.depositMin)})`}`,
    act: got.length ? '' : wait.length ? btn('Confirm received', `ofConfirmPay('${id}',${m.payments.indexOf(wait[0])})`, 'primary small') : btn('Record a payment', `ofPayForm('${id}')`), hold: `No ${what} on file` });

  if (!lotSale)
    out.push({ key: 'plan', short: 'Floor plan', title: 'Floor plan confirmed', must: true, state: s.c.sheet?.ok ? 'ok' : 'bad',
      text: s.c.sheet?.ok ? `Confirmed ${ofStamp(s.c.sheet.ok)} · the plant builds from this sheet` : 'Nobody has confirmed where the doors, windows and electrical go',
      act: btn('Build sheet', `openBuildSheet('${id}')`), hold: 'Floor plan is not confirmed' });

  if (t.rto) {
    const r = o.rtoCo, name = esc(ofRtoName(s)), tried = (o.rtoTries || []).map((x) => x.company), left = OF.set.rtoCos.filter((c) => !tried.includes(c));
    /* One company: one button. Several: the office picks where it goes, and can try another after a decline. */
    const send = left.length > 1 ? `<label class="of-pickco">Send to<select id="of-rto-co">${left.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>${btn('Send', `ofRtoSend('${id}')`, 'primary small')}` : btn(`Send to ${esc(left[0] || 'the RTO company')}`, `ofRtoSend('${id}')`, 'primary small');
    const more = r?.state === 'declined' && OF.set.rtoCos.some((c) => c !== r.company && !tried.includes(c));
    out.push({ key: 'rto', short: 'RTO company', title: 'RTO company approval', must: true,
      state: !r ? 'todo' : r.state === 'approved' ? 'ok' : r.state === 'declined' ? 'bad' : 'wait',
      text: (!r ? `Not sent ${left.length > 1 ? 'yet' : `to ${name} yet`}` : r.state === 'approved' ? `Approved by ${name} ${ofStamp(r.at)}` : r.state === 'declined' ? `Declined by ${name} ${ofStamp(r.at)} · ${more ? 'try another company, cancel, or place on hold' : 'cancel, or place on hold to change the sale'}` : `Sent to ${name} ${ofAgo(r.sent)} · waiting on their answer`) + (tried.length ? ` · declined earlier by ${tried.map(esc).join(', ')}` : ''),
      act: !r ? send : r.state === 'sent' ? btn('They approved', `ofRtoAnswer('${id}',true)`, 'primary small') + btn('They declined', `ofRtoAnswer('${id}',false)`) : more ? btn('Send to another company', `ofRtoRetry('${id}')`, 'primary small') : '', hold: 'The RTO company declined the application' });
  }

  const list = ofListPrice(s), gap = list == null ? 0 : Math.round((s.total - (m.fuel || 0) - list) * 100) / 100;
  out.push({ key: 'price', short: 'Price', title: 'Price matches the price list', must: true, state: gap ? 'bad' : 'ok',
    text: s.invoice ? `${money(s.total)} · priced on the signed invoice` : lotSale ? `${money(s.total)} · the lot price` : gap ? `Order ${money(s.total - (m.fuel || 0))} · price list ${money(list)} · ${money(Math.abs(gap))} ${gap < 0 ? 'under' : 'over'}` : `${money(list)} · same as the price list today`,
    act: gap < 0 ? btn('Record as a discount', `ofGapDiscount('${id}')`) : gap > 0 ? btn('Use the list price', `ofUseList('${id}')`) : '', hold: 'The price does not match the price list' });

  m.discounts.forEach((d, i) =>
    out.push({ key: 'disc' + i, short: 'Discount', title: `Discount · ${esc(d.purpose || 'no purpose given')}`, must: true, state: d.ok ? 'ok' : d.purpose ? 'todo' : 'bad',
      text: `${money(-d.amount)} · ${d.ok ? 'approved by the office' : d.purpose ? `added by the ${(d.by || 'salesperson').toLowerCase()} · needs the office’s OK` : 'a discount needs a purpose'}`,
      act: d.ok ? '' : (d.purpose ? btn('OK the discount', `ofDiscountOk('${id}',${i})`, 'primary small') : '') + btn('Remove', `ofDiscountDrop('${id}',${i})`), hold: 'The discount needs a purpose' }));

  (s.toConfirm || []).forEach((x, i) =>
    out.push({ key: 'flag' + i, short: 'Flagged item', title: 'Flagged by the salesperson', must: true, state: o.ticks[i] ? 'ok' : 'todo',
      text: esc(x) + (o.ticks[i] ? ' · confirmed by the office' : ''), act: o.ticks[i] ? '' : btn('Confirmed', `ofTick('${id}',${i})`, 'primary small'), hold: 'A flagged option could not be confirmed' }));
  return out;
}
const ofLeft = (s) => ofChecks(s).filter((c) => c.must && c.state !== 'ok');

/* ---------- Opening things ---------- */
function ofOpen(id) {
  OF.id = id;
  if (typeof opsSide === 'function' && opsSide(S.page) === 'office' && S.page !== 'of-order') OF.back = S.page;
  else if (S.page !== 'of-order') OF.back = 'office';
  go('of-order');
}
function ofDoc(id, kind) {
  S.activeSale = id;
  orderDoc(kind);
}
function ofContract(id) {
  S.activeSale = id;
  rtoDownload();
}
function ofReviewNext() {
  const next = ofAll().filter((s) => ofStage(s) === 'review').sort((a, b) => ofLeft(a).length - ofLeft(b).length)[0];
  if (next) ofOpen(next.id);
  else toast('Nothing is waiting for review.');
}

/* ---------- Actions on an order ---------- */
function ofConfirmPay(id, i) {
  const s = ofSale(id), p = s.money.payments[i];
  p.confirmed = true;
  p.confirmedAt = Date.now();
  ofLog(s, `Office confirmed ${money(p.amount)} received (${p.method.toLowerCase()})`);
  render();
  toast(`${money(p.amount)} confirmed.`);
}
function ofDropPay(id, i) {
  const s = ofSale(id), [p] = s.money.payments.splice(i, 1);
  ofLog(s, `Office could not find ${money(p.amount)} (${p.method.toLowerCase()}) and removed it`);
  render();
  toast('Payment removed. The order now shows it as missing.');
}
function ofPayForm(id) {
  const s = ofSale(id), t = ofTotals(s);
  const suggest = t.rto ? orderInvoice(s).dueToday || '' : t.paid ? t.balance : t.depositMin;
  modal('Record a payment', `<p><strong>${esc(s.customer)}</strong> · ${esc(id)}${t.rto ? '' : ` · balance ${money(t.balance)}`}</p>
    <div class="fields"><label>Amount ($)<input id="of-pay-amount" type="number" min="0.01" step="0.01" value="${suggest || ''}" inputmode="decimal"></label>
    <label>How it was paid<select id="of-pay-method">${OF_METHODS.map((x) => `<option>${x}</option>`).join('')}</select></label></div>
    <label class="field">Reference or note (optional)<input id="of-pay-note" maxlength="80" placeholder="Example: check number"></label>
    <p class="source">Preview only: nothing is charged. Do not type a real card or account number.</p>
    <div class="actions">${button('Save the payment', `ofPaySave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofPaySave(id) {
  const s = ofSale(id), amount = Math.round(Number($('#of-pay-amount').value) * 100) / 100;
  if (!(amount > 0)) return toast('Type the amount that was paid.');
  ofRec(s);
  s.money.payments.push({ amount, method: $('#of-pay-method').value, note: $('#of-pay-note').value.trim(), at: Date.now(), confirmed: true, confirmedAt: Date.now(), by: 'Office' });
  ofLog(s, `Office recorded ${money(amount)} (${$('#of-pay-method').value.toLowerCase()})`);
  closeModal();
  render();
  const t = ofTotals(s);
  toast(t.rto || t.balance > 0 ? `${money(amount)} recorded.` : `${money(amount)} recorded. Paid in full.`);
}
function ofRtoSend(id) {
  const s = ofSale(id), o = ofRec(s), tried = (o.rtoTries || []).map((x) => x.company);
  const company = $('#of-rto-co')?.value || OF.set.rtoCos.find((c) => !tried.includes(c)) || OF.set.rtoCos[0];
  o.rtoCo = { state: 'sent', company, sent: Date.now() };
  if (s.rtoApp) s.rtoApp.provider = company;
  ofLog(s, `Office sent the application to ${company}`);
  render();
  toast('Sent. Record their answer when it comes back.');
}
/* Declined: with more than one company, the application can go to the next. */
function ofRtoRetry(id) {
  const s = ofSale(id), o = ofRec(s);
  (o.rtoTries ||= []).push(o.rtoCo);
  o.rtoCo = null;
  render();
}
function ofAddRtoCo() {
  const v = $('#of-rtoco').value.trim();
  if (!v) return;
  if (!OF.set.rtoCos.includes(v)) OF.set.rtoCos.push(v);
  render();
  toast(`${v} added. The office now picks where each application goes.`);
}
function ofRtoAnswer(id, yes) {
  const s = ofSale(id), r = ofRec(s).rtoCo;
  r.state = yes ? 'approved' : 'declined';
  r.at = Date.now();
  ofLog(s, `${ofRtoName(s).replace(/^the/, 'The')} ${yes ? 'approved' : 'declined'} the application`);
  render();
  toast(yes ? 'Approval recorded.' : 'Decline recorded. Cancel the order or place it on hold.');
}
function ofDiscountOk(id, i) {
  const s = ofSale(id), d = s.money.discounts[i];
  d.ok = true;
  ofLog(s, `Office approved the ${money(d.amount)} discount (${d.purpose})`);
  render();
}
function ofDiscountDrop(id, i) {
  const s = ofSale(id), [d] = s.money.discounts.splice(i, 1);
  ofLog(s, `Office removed the ${money(d.amount)} discount${d.purpose ? ` (${d.purpose})` : ''}`);
  render();
}
function ofDiscountForm(id) {
  modal('Add a discount', `<div class="fields"><label>Discount ($)<input id="of-disc-amount" type="number" min="0.01" step="0.01" inputmode="decimal"></label>
    <label>Purpose<input id="of-disc-purpose" list="of-purposes" maxlength="60" placeholder="Example: Military"></label></div>
    <datalist id="of-purposes">${OF.set.purposes.map((p) => `<option>${esc(p)}</option>`).join('')}</datalist>
    <p class="source">Every discount carries its purpose onto the invoice.</p>
    <div class="actions">${button('Add the discount', `ofDiscountSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofDiscountSave(id) {
  const s = ofSale(id), amount = Math.round(Number($('#of-disc-amount').value) * 100) / 100, purpose = $('#of-disc-purpose').value.trim();
  if (!(amount > 0)) return toast('Type the discount amount.');
  if (!purpose) return toast('A discount needs a purpose.');
  ofRec(s);
  s.money.discounts.push({ amount, purpose, ok: true, by: 'Office' });
  ofLog(s, `Office added a ${money(amount)} discount (${purpose})`);
  closeModal();
  render();
}
/* The order is under the price list: keep the customer's price and name the gap as a discount. */
function ofGapDiscount(id) {
  const s = ofSale(id), list = ofListPrice(s), gap = Math.round((list - (s.total - (s.money.fuel || 0))) * 100) / 100;
  modal('Record the difference as a discount', `<p>The order is <strong>${money(gap)}</strong> under the price list. Keeping the customer’s price means recording that as a discount.</p>
    <label class="field">Purpose<input id="of-disc-purpose" list="of-purposes" maxlength="60" placeholder="Why the lower price was given"></label>
    <datalist id="of-purposes">${OF.set.purposes.map((p) => `<option>${esc(p)}</option>`).join('')}</datalist>
    <div class="actions">${button('Record the discount', `ofGapSave('${id}',${gap})`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofGapSave(id, gap) {
  const s = ofSale(id), purpose = $('#of-disc-purpose').value.trim();
  if (!purpose) return toast('A discount needs a purpose.');
  s.total = Math.round((s.total + gap) * 100) / 100;
  s.money.discounts.push({ amount: gap, purpose, ok: true, by: 'Office' });
  ofLog(s, `Office set the price to the price list and recorded a ${money(gap)} discount (${purpose})`);
  closeModal();
  render();
}
function ofUseList(id) {
  const s = ofSale(id), list = ofListPrice(s), was = s.total;
  s.total = Math.round((list + (s.money.fuel || 0)) * 100) / 100;
  ofLog(s, `Office corrected the price from ${money(was)} to ${money(s.total)} (price list)`);
  render();
  toast('Price set to the price list.');
}
function ofTick(id, i) {
  const s = ofSale(id);
  ofRec(s).ticks[i] = true;
  ofLog(s, `Office confirmed: ${s.toConfirm[i]}`);
  render();
}
/* Fuel surcharge: an order made before the office set the rate can take today's rate. */
function ofFuelApply(id) {
  const s = ofSale(id), amount = ofFuelFor(s.c, s.total);
  if (amount == null) return go('of-settings');
  s.money.fuel = amount;
  s.total = Math.round((s.total + amount) * 100) / 100;
  ofLog(s, `Office added the fuel surcharge (${money(amount)} · ${ofFuelSay()})`);
  render();
}
/* Delivery site answers: miles from the lot, access, the narrowest opening and the ground.
   The salesperson asks them at the sale; Logistics confirms them with the customer when it
   schedules the delivery. They live on the order, or on a sample building that has no order. */
let SITE_EDIT = null;
function siteMissing(d) {
  d = d || {};
  return [(d.miles === '' || d.miles == null) && 'miles from the lot', !d.access && 'site access', !d.noGate && (d.gate === '' || d.gate == null) && 'the narrowest gate or opening', !d.ground && 'the ground'].filter(Boolean);
}
const siteWho = () => ({ office: 'Office', logi: 'Logistics' })[document.body.dataset.side] || 'Salesperson';
function siteForm(holder, confirm) {
  SITE_EDIT = { ...holder, confirm: !!confirm };
  const s = holder.sale, u = holder.unit, d = (s ? s.site : u.site) || {}, width = Number((s ? s.c.size : u.size).split('x')[0]);
  const who = s ? `${esc(s.customer)} · ${esc(label(s.c))} · sold at ${esc(lotTown(saleLot(s)))}` : `${esc(u.customer)} · ${esc(u.name)} · sold at ${esc(lotTown(lotById(u.lotId)))}`;
  const pick = (name, text, opts) => `<label>${text}<select id="of-site-${name}"><option value="">Not asked yet</option>${opts.map((x) => `<option ${d[name] === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
  modal(confirm ? 'Confirm the delivery site' : 'Delivery site', `<p><strong>${who}</strong></p>
    ${confirm ? `<p class="notice">${d.askedBy ? `Asked by the ${esc(d.askedBy.toLowerCase())} ${d.askedAt ? ofStamp(d.askedAt) : 'at the sale'}.` : 'Asked at the sale.'} Go over each answer with the customer again before the delivery is scheduled.</p>` : ''}
    <div class="fields"><label>Miles from the lot to the site<input id="of-site-miles" type="number" min="0" step="1" value="${d.miles ?? ''}" inputmode="numeric"></label>
    <label>Narrowest gate or opening (ft)<input id="of-site-gate" type="number" min="0" step="0.5" value="${d.gate ?? ''}" ${d.noGate ? 'disabled' : ''} inputmode="decimal"></label>
    ${pick('access', 'Site access', ['Clear access', 'Tight access', 'Not sure, needs a look'])}${pick('ground', 'Ground at the site', ['Level', 'Slight slope', 'Needs leveling'])}</div>
    <label class="checkrow"><input id="of-site-nogate" type="checkbox" ${d.noGate ? 'checked' : ''} onchange="$('#of-site-gate').disabled=this.checked"> <span>No gate or opening to pass through</span></label>
    <label class="field">Notes for the driver (optional)<input id="of-site-notes" maxlength="160" value="${esc(d.notes || '')}" placeholder="Trees, wires, soft ground, where it goes"></label>
    <p class="source">A ${width} ft wide building needs a ${width + 2} ft opening and 14 ft of height clear of wires and limbs. Delivery is free within ${FREE_DELIVERY_MILES} miles of the lot, ${money(OF.set.overFee)} up to ${OF.set.overTo} miles, and past that Logistics approves the fee.</p>
    <div class="actions">${button(confirm ? 'Confirmed with the customer' : 'Save', 'siteSave()')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofSiteForm(id, confirm) {
  siteForm({ sale: ofSale(id) }, confirm);
}
function siteSave() {
  const h = SITE_EDIT, s = h.sale, u = h.unit, old = (s ? s.site : u.site) || {}, v = (k) => $('#of-site-' + k).value.trim(), noGate = $('#of-site-nogate').checked;
  const d = { miles: v('miles') === '' ? '' : Math.max(0, Number(v('miles')) || 0), gate: noGate || v('gate') === '' ? '' : Number(v('gate')), noGate, access: v('access'), ground: v('ground'), notes: v('notes') };
  const gaps = siteMissing(d), same = ['miles', 'gate', 'noGate', 'access', 'ground'].every((k) => String(old[k] ?? '') === String(d[k] ?? ''));
  if (h.confirm && gaps.length) return toast(`Still to ask: ${gaps.join(', ')}.`);
  d.askedBy = old.askedBy || siteWho();
  d.askedAt = old.askedAt || Date.now();
  d.confirmed = h.confirm ? Date.now() : same ? old.confirmed || null : null; /* changed answers need confirming again */
  if (s) {
    const before = ofSum(ofRec(s) && s.money.fees.filter((f) => f.auto));
    s.site = d;
    const fee = siteFeeSync(s), now = ofDelivery(s);
    ofLog(s, `${siteWho()} ${h.confirm ? 'confirmed the delivery site with the customer' : 'recorded the delivery site'}: ${siteLine(s) || 'no answers'}${fee && fee !== before ? ` · ${money(fee)} delivery charge` : now.over && !now.approved ? ' · over ' + OF.set.overTo + ' miles, Logistics approves the fee' : ''}`);
  } else u.site = d;
  closeModal();
  render();
  toast(h.confirm ? 'Site confirmed.' : gaps.length ? `Saved. Still to ask: ${gaps.join(', ')}.` : 'Delivery site saved.');
}
function siteLine(s) {
  const d = s.site;
  if (!d) return '';
  return [d.miles === '' || d.miles == null ? null : `${d.miles} mi from the lot`, d.access || null, d.noGate ? 'no gate' : d.gate === '' || d.gate == null ? null : `${d.gate} ft opening`, d.ground || null, d.notes || null].filter(Boolean).join(' · ');
}
/* What stands in the way at the site: an opening too narrow, a slope, a tight drive. */
function siteProblems(s) {
  const d = s.site, w = Number(s.c.size.split('x')[0]), out = [];
  if (!d) return [];
  if (!d.noGate && d.gate !== '' && d.gate != null) {
    if (d.gate <= w) out.push(`The opening is ${d.gate} ft and the building is ${w} ft wide`);
    else if (d.gate < w + 2) out.push(`Tight: a ${w} ft building through a ${d.gate} ft opening`);
  }
  if (d.ground === 'Needs leveling') out.push('The site needs leveling first');
  if (d.access && d.access !== 'Clear access') out.push(d.access);
  return out;
}
function ofFeeForm(id) {
  modal('Add a delivery charge', `<p>From the delivery and blocking agreement the customer signed.</p>
    <div class="of-feepick">${OF_FEES.map(([n, a], i) => `<button type="button" class="chipbtn" onclick="$('#of-fee-name').value='${n}';$('#of-fee-amount').value=${a}">${n} · ${money(a)}</button>`).join('')}</div>
    <div class="fields"><label>What it is for<input id="of-fee-name" maxlength="70"></label><label>Amount ($)<input id="of-fee-amount" type="number" min="0.01" step="0.01" inputmode="decimal"></label></div>
    <div class="actions">${button('Add the charge', `ofFeeSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofFeeSave(id) {
  const s = ofSale(id), name = $('#of-fee-name').value.trim(), amount = Math.round(Number($('#of-fee-amount').value) * 100) / 100;
  if (!name || !(amount > 0)) return toast('Say what the charge is for and how much.');
  ofRec(s);
  s.money.fees.push({ name, amount });
  ofLog(s, `Office added a charge: ${name} ${money(amount)}`);
  closeModal();
  render();
}
function ofFeeDrop(id, i) {
  const s = ofSale(id), [f] = s.money.fees.splice(i, 1);
  ofLog(s, `Office removed a charge: ${f.name} ${money(f.amount)}`);
  render();
}

/* Approve. A custom order goes to the plant with its order form and floor plan; a lot sale is sold. */
function ofApprove(id) {
  const s = ofSale(id), left = ofLeft(s);
  if (ofStage(s) !== 'review') return;
  if (left.length) return toast(`${left.length} thing${left.length === 1 ? '' : 's'} left before this can be approved.`);
  const o = ofRec(s);
  s.status = 'Processed · Sold';
  s.discrepancy = false;
  o.approved = { at: Date.now() };
  if (s.path === 'lot') {
    if (lots[s.lot]) lots[s.lot].status = 'Sold';
    s.fulfillment = 'Sold · waiting on delivery';
    ofLog(s, 'Office approved the sale · handed to Logistics for delivery');
  } else {
    s.plantPhase = 1;
    s.fulfillment = phaseNames[1];
    ofLog(s, `Office approved · order form and floor plan sent to the ${lotPlant(saleLot(s)).name} in ${lotPlant(saleLot(s)).town}`);
  }
  render();
  scrollTo(0, 0);
  toast(s.path === 'lot' ? 'Approved. Logistics can schedule the delivery.' : 'Approved and sent to the plant.');
}
/* Hold: the reason goes to the lot, which fixes it and submits again. */
function ofHoldForm(id) {
  const s = ofSale(id), reasons = [...new Set(ofLeft(s).map((c) => c.hold).filter(Boolean))];
  modal(ofStage(s) === 'approved' ? 'Return to hold' : 'Place on hold', `<p>The lot sees this at the top of the order, fixes it and submits again. <strong>${esc(s.customer)}</strong> · ${esc(id)}</p>
    ${reasons.length ? `<div class="of-feepick">${reasons.map((r) => `<button type="button" class="chipbtn" onclick="const f=$('#of-hold-reason');f.value=f.value?f.value+'; '+this.textContent:this.textContent">${esc(r)}</button>`).join('')}</div>` : ''}
    <label class="field">Reason<input id="of-hold-reason" maxlength="160" placeholder="What is wrong"></label>
    <label class="field">What the lot needs to do (optional)<textarea id="of-hold-note" rows="2" maxlength="300"></textarea></label>
    <div class="actions">${button('Place on hold', `ofHoldSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function ofHoldSave(id) {
  const s = ofSale(id), reason = $('#of-hold-reason').value.trim(), o = ofRec(s);
  if (!reason) return toast('A hold needs a reason.');
  const back = ofStage(s) === 'approved';
  o.hold = { reason, note: $('#of-hold-note').value.trim(), at: Date.now() };
  s.status = 'Correction requested';
  s.fulfillment = 'On hold by the office';
  if (back) s.plantPhase = null;
  ofLog(s, `Office ${back ? 'returned the order to' : 'placed the order on'} hold: ${reason}`);
  closeModal();
  render();
  toast('On hold. The lot can see the reason on the order.');
}
function ofCancelForm(id) {
  const s = ofSale(id), t = ofTotals(s), custom = s.path !== 'lot';
  modal('Cancel this order', `<p><strong>${esc(s.customer)}</strong> · ${esc(id)} · ${esc(label(s.c))}</p>
    <p class="notice">${custom ? 'The terms say a custom build may not be cancelled without the seller’s written consent.' : `The terms allow a restocking fee of up to 15% of the price (${money(s.total * 0.15)}).`}${t.paid ? ` ${money(t.paid)} has been paid and will show under refunds to settle.` : ''}</p>
    <label class="field">Reason<input id="of-cancel-reason" maxlength="160" placeholder="Why the order is being cancelled"></label>
    <div class="actions">${button('Cancel the order', `ofCancelSave('${id}')`)}${button('Keep the order', 'closeModal()', 'secondary')}</div>`);
}
function ofCancelSave(id) {
  const s = ofSale(id), reason = $('#of-cancel-reason').value.trim();
  if (!reason) return toast('Cancelling needs a reason.');
  ofRec(s).cancel = { reason, at: Date.now() };
  s.status = 'Cancelled';
  s.fulfillment = 'Cancelled';
  if (s.path === 'lot' && lots[s.lot]) lots[s.lot].status = 'Available';
  ofLog(s, `Office cancelled the order: ${reason}`);
  closeModal();
  render();
  toast('Order cancelled.');
}
/* Stand-in for Production, so an order can be walked through the plant from this screen. */
function ofPlantNext(id) {
  S.activeSale = id;
  sfPlantNext();
}
/* Through the lot, or straight from the plant to the customer. */
function ofPath(id, path) {
  const s = ofSale(id), o = ofRec(s);
  if (o.released) return;
  o.path = o.path === path ? null : path;
  ofLog(s, o.path ? `Delivery path set: ${o.path === 'home' ? 'plant to home' : 'through the lot'}` : 'Delivery path left for Logistics to decide');
  render();
}
function ofPathHint(s) {
  const pay = ofPayRule(s), see = s.billing?.seeFirst;
  if (see === 'yes') return ['lot', 'The customer wants to see it at the lot first.'];
  if (!pay.ok) return ['lot', `${pay.text}, so it goes to the lot until that is settled.`];
  if (pay.full || ofRto(s)) return ['home', `${pay.text}${see === 'no' ? ', and the customer does not need to see it first' : ''}.`];
  return ['home', `${pay.text}.`];
}
function ofCanRelease(s) {
  const o = ofRec(s), built = ofBuilt(s), pay = ofPayRule(s);
  if (ofStage(s) !== 'approved' || o.released) return { ok: false, why: '' };
  if (!built.ok) return { ok: false, why: built.text };
  if (s.path !== 'lot' && !o.path) return { ok: false, why: 'Choose through the lot or plant to home' };
  if ((s.path === 'lot' || o.path === 'home') && !pay.ok) return { ok: false, why: pay.text };
  return { ok: true, why: '' };
}
function ofRelease(id) {
  const s = ofSale(id), can = ofCanRelease(s), o = ofRec(s);
  if (!can.ok) return toast(can.why || 'Not ready to release yet.');
  o.released = { at: Date.now() };
  s.fulfillment = 'Released to Logistics';
  ofLog(s, `Office released the building to Logistics · ${s.path === 'lot' ? 'lot to home' : o.path === 'home' ? 'plant to home' : 'through the lot'}`);
  render();
  toast('Released. It is on the Logistics board now.');
}

/* ---------- Screens ---------- */
const ofPill = (s) => `<span class="pill ${OF_STAGE_PILL[ofStage(s)]}">${OF_STAGE_NAME[ofStage(s)]}</span>`;
const ofSample = (s) => (s.sample ? '<span class="pill ghost">Sample order</span>' : '');
const ofMatches = (s) => (OF.lot === 'All' || saleLot(s).id === OF.lot) && (!OF.q.trim() || `${s.customer} ${s.id} ${label(s.c)} ${saleLot(s).town}`.toLowerCase().includes(OF.q.trim().toLowerCase()));
/* Where an approved order is, in one line. */
function ofWhere(s) {
  const o = ofRec(s);
  if (ofStage(s) === 'delivered') return `Delivered ${esc(s.deliveredAt || '')}`;
  if (o.released) return typeof lgSaleLine === 'function' ? lgSaleLine(s) : 'With Logistics';
  const built = ofBuilt(s);
  return built.ok ? (s.path === 'lot' ? 'Sold off the lot · waiting on release' : `${built.text} · waiting on release`) : built.text;
}
function ofRow(s, extra = '') {
  const stage = ofStage(s), left = stage === 'review' ? ofLeft(s) : [], lot = saleLot(s), o = ofRec(s);
  const flags = stage === 'review'
    ? left.length ? left.map((c) => `<span class="ops-flag ${c.state}">${esc(c.short)}</span>`).join('') : '<span class="ops-flag ok">Ready to approve</span>'
    : stage === 'hold' ? `<span class="ops-flag bad">${esc(o.hold?.reason || 'On hold')}</span>`
    : stage === 'approved' ? `<span class="ops-flag info">${ofWhere(s)}</span>`
    : stage === 'cancelled' ? `<span class="ops-flag info">${esc(o.cancel?.reason || 'Cancelled')}</span>` : `<span class="ops-flag ok">${ofWhere(s)}</span>`;
  return `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${esc(s.customer)}</strong><span class="serial">${esc(s.id)}</span>${ofPill(s)}${ofSample(s)}</div>
    <p class="ops-rowsub">${esc(label(s.c))} · ${esc(lotTown(lot))} · ${ofRto(s) ? 'Rent-to-own' : 'Cash'}${s.submittedAt ? ` · submitted ${ofAgo(Date.parse(s.submittedAt))}` : ''}</p>
    <div class="ops-flags">${flags}${extra}</div></div>
    <button type="button" class="${stage === 'review' ? 'primary' : 'secondary'} small" onclick="ofOpen('${s.id}')">${stage === 'review' ? 'Review' : 'Open'} ${icon('arrow', 16)}</button></article>`;
}
const ofFilterBar = (redraw) => `<div class="qc-filter"><label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search customer, order or lot" aria-label="Search customer, order or lot" value="${esc(OF.q)}" oninput="OF.q=this.value;${redraw}"></label>
  <label class="ops-select">Lot<select onchange="OF.lot=this.value;render()"><option value="All">All ${LOTS.length} lots</option>${LOTS.map((l) => `<option value="${l.id}" ${OF.lot === l.id ? 'selected' : ''}>${esc(lotTown(l))}</option>`).join('')}</select></label></div>`;

/* What is waiting on the office, in groups. */
function ofGroups() {
  const all = ofAll().filter(ofMatches), review = all.filter((s) => ofStage(s) === 'review');
  const waitingRto = review.filter((s) => s.office?.rtoCo?.state === 'sent');
  const pays = [];
  all.filter((s) => ofStage(s) !== 'cancelled').forEach((s) => (ofRec(s), s.money.payments.forEach((p, i) => !p.confirmed && pays.push({ s, p, i }))));
  const release = all.filter((s) => ofStage(s) === 'approved' && !ofRec(s).released && ofBuilt(s).ok);
  const changes = S.changes.filter((c) => !c.declined && c.done === 1), stock = S.stock.filter((r) => (r.stage || 0) === 0 && r.status === 'Pending');
  return { review: review.filter((s) => !waitingRto.includes(s)), rto: waitingRto, pays, release, changes, stock, hold: all.filter((s) => ofStage(s) === 'hold') };
}
function officeList() {
  const g = ofGroups(), show = (k) => OF.tile === 'all' || OF.tile === k || (OF.tile === 'review' && k === 'rto');
  const sec = (k, title, n, body) => (show(k) && n ? `<h2 class="sectionhead qc-group">${title} <small>${n}</small></h2>${body}` : '');
  const html = [
    sec('review', 'To review', g.review.length, `<div class="ops-list">${g.review.sort((a, b) => ofLeft(a).length - ofLeft(b).length).map((s) => ofRow(s)).join('')}</div>`),
    sec('rto', 'Waiting on the RTO company', g.rto.length, `<div class="ops-list">${g.rto.map((s) => ofRow(s)).join('')}</div>`),
    sec('pays', 'Payments to confirm', g.pays.length, `<div class="ops-list">${g.pays.map(ofPayRow).join('')}</div>`),
    sec('release', 'Ready to release for delivery', g.release.length, `<div class="ops-list">${g.release.map((s) => ofRow(s)).join('')}</div>`),
    sec('requests', 'Requests from the lots', g.changes.length + g.stock.length, `<div class="ops-list">${g.changes.map(ofChangeRow).join('')}${g.stock.map(ofStockRow).join('')}</div>`),
    sec('hold', 'On hold · waiting on the lot', g.hold.length, `<div class="ops-list">${g.hold.map((s) => ofRow(s)).join('')}</div>`),
  ].join('');
  return html || `<div class="panel emptystate"><strong>Nothing here right now</strong><p>${OF.tile === 'all' ? 'No order is waiting on the office for this lot and search.' : 'Nothing in this group for this lot and search.'}</p>${OF.tile !== 'all' || OF.q || OF.lot !== 'All' ? button('Show everything', "OF.tile='all';OF.q='';OF.lot='All';render()", 'secondary') : ''}</div>`;
}
function officeHome() {
  const g = ofGroups();
  const kpi = (k, n, text) => `<button type="button" class="kpi" aria-pressed="${OF.tile === k}" onclick="OF.tile=OF.tile==='${k}'?'all':'${k}';render()"><strong>${n}</strong><span>${text}</span></button>`;
  return `${head('Office · all ' + LOTS.length + ' lots', 'What needs the office today.', 'One office reviews every lot’s orders, keeps the money straight and releases finished buildings for delivery.')}
  <div class="today ops-tiles">
    ${kpi('review', g.review.length + g.rto.length, 'orders to review')}
    ${kpi('pays', g.pays.length, 'payments to confirm')}
    ${kpi('release', g.release.length, 'ready to release for delivery')}
    ${kpi('requests', g.changes.length + g.stock.length, 'requests from the lots')}
  </div>
  ${ofFilterBar("$('#of-list').innerHTML=officeList()")}
  <div id="of-list">${officeList()}</div>
  ${opsNotes([
    ['The review queue', 'Order Intake: <code>listIntakes</code>, tabs Pending Review / On Hold / Accepted / Cancelled.'],
    ['Requests from the lots', 'A stock order is an intake of kind <code>inventory</code> in the same queue.'],
  ], ['Payments to confirm, the release list and change orders sit in one to-do list here. Turbo Assist has no payment or change-order record yet.'])}`;
}

/* All orders, by where they stand with the office. */
function officeOrders() {
  const all = ofAll().filter(ofMatches), tabs = ['review', 'hold', 'approved', 'delivered', 'cancelled'];
  const early = S.sales.filter((s) => ['Quote issued', 'Sold · Awaiting signatures'].includes(s.status)).length;
  const rows = all.filter((s) => ofStage(s) === OF.tab);
  return `${head('Office · all ' + LOTS.length + ' lots', 'Every order.', 'Where each order stands with the office, and where the building is once it is approved.')}
  ${ofFilterBar("$('#of-orders').innerHTML=officeOrderRows()")}
  <div class="chiprow ops-tabs">${tabs.map((k) => `<button type="button" class="chipbtn${OF.tab === k ? ' on' : ''}" onclick="OF.tab='${k}';render()">${OF_STAGE_NAME[k]} <span class="ops-n">${all.filter((s) => ofStage(s) === k).length}</span></button>`).join('')}</div>
  <div id="of-orders">${officeOrderRows()}</div>
  ${early ? `<p class="lede-small" style="margin-top:20px">${early} more ${early === 1 ? 'order is' : 'orders are'} still with a salesperson (a quote, or waiting on signatures). They reach the office when the lot submits them.</p>` : ''}
  ${opsNotes([['The tabs', 'Order Intake status: <code>pending_review</code>, <code>on_hold</code>, <code>accepted</code>, <code>cancelled</code>.']], ['A Delivered tab. Turbo Assist tracks delivery on the route, not on the intake.'])}`;
}
function officeOrderRows() {
  const rows = ofAll().filter(ofMatches).filter((s) => ofStage(s) === OF.tab);
  return rows.length ? `<div class="ops-list">${rows.map((s) => ofRow(s)).join('')}</div>` : `<div class="panel emptystate"><strong>No ${OF_STAGE_NAME[OF.tab].toLowerCase()} orders</strong><p>Nothing matches this lot and search.</p></div>`;
}

/* One order: the checklist, the money, the decision. */
function ofCheckRow(c) {
  const mark = { ok: icon('check', 16), todo: '', wait: '…', bad: '!' }[c.state] ?? '';
  return `<div class="of-check ${c.state}"><span class="of-mark">${mark}</span><div class="grow"><strong>${c.title}</strong><small>${c.text}</small></div>${c.act ? `<div class="of-acts">${c.act}</div>` : ''}</div>`;
}
function ofMoneyPanel(s) {
  const m = s.money, t = ofTotals(s), id = s.id, inv = orderInvoice(s), open = !['cancelled', 'delivered'].includes(ofStage(s));
  const x = (i, fn) => (open ? ` <button type="button" class="of-x" aria-label="Remove" onclick="${fn}('${id}',${i})">×</button>` : '');
  const fuel = s.path === 'lot' ? odRow('Fuel surcharge', 'In the lot price') : s.invoice ? odRow('Fuel surcharge', 'Included on the invoice')
    : m.fuel != null ? odRow('Fuel surcharge', money(m.fuel) + ' · in the price above', 'sub')
    : odRow('Fuel surcharge', !ofFuelSet() ? `${STILL_NEEDED} <button type="button" class="link inline" onclick="go('of-settings')">Set it</button>` : `<button type="button" class="link inline" onclick="ofFuelApply('${id}')">Add ${money(ofFuelFor(s.c, s.total))} · ${ofFuelSay()}</button>`);
  const d = ofDelivery(s);
  const taxes = inv.taxes ? odRow(t.rto ? 'Sales tax, monthly' : 'Sales tax', money(inv.taxes.reduce((a, b) => a + b[1], 0))) : odRow('Sales tax', '<span class="of-soft">From the tax service</span>');
  return `<section class="panel"><div class="panelhead"><h2>Money</h2><span class="pill blue">${t.rto ? `Rent-to-own${s.billing?.term || s.rtoApp?.term ? ' · ' + (s.billing?.term || s.rtoApp?.term) + ' months' : ''}` : 'Cash purchase'}</span></div>
    ${odRow(t.rto ? 'Cash price of the building' : 'Building and options', money(s.total))}
    ${fuel}
    ${m.discounts.map((k, i) => odRow(`Discount · ${esc(k.purpose || 'no purpose')}${k.ok ? '' : ' <em class="of-soft">not approved yet</em>'}`, money(-k.amount) + x(i, 'ofDiscountDrop'))).join('')}
    ${odRow('Delivery', d.miles == null ? '<span class="of-soft">Miles not recorded</span>' : d.fee === 0 ? `Free · ${d.miles} miles` : d.over && !d.approved ? `${d.miles} miles · <span class="of-soft">waiting on Logistics for the fee</span>` : `${d.miles} miles`)}
    ${m.fees.map((k, i) => odRow(esc(k.name), money(k.amount) + x(i, 'ofFeeDrop'), 'sub')).join('')}
    ${taxes}
    ${odRow(t.rto ? 'Price the RTO company pays, before tax' : 'Order total, before tax', money(t.total), 'strong')}
    ${t.rto && t.monthly != null ? odRow('Monthly payment, before tax', money(t.monthly)) : ''}
    ${m.payments.map((p) => odRow(`${esc(p.method)}${p.note ? ' · ' + esc(p.note) : ''} · ${ofStamp(p.at)}${p.confirmed ? '' : ' <em class="of-soft">not confirmed</em>'}${p.refunded ? ' <em class="of-soft">refunded</em>' : ''}`, money(p.amount), 'sub')).join('')}
    ${odRow(t.rto ? 'Received from the customer' : 'Paid', money(t.paid) + (t.pending ? ` <small>+ ${money(t.pending)} to confirm</small>` : ''))}
    ${t.rto ? '' : odRow('Balance', t.balance > 0 ? money(t.balance) : 'Paid in full', 'total')}
    ${open ? `<div class="actions">${button('Record a payment', `ofPayForm('${id}')`, 'secondary small')}${button('Add a discount', `ofDiscountForm('${id}')`, 'secondary small')}${button('Add a delivery charge', `ofFeeForm('${id}')`, 'secondary small')}</div>` : ''}
    <p class="source">${t.rto ? 'The RTO company pays for the building. The customer pays the first payment at signing, then monthly.' : OF.set.driverPay ? 'Cash sales: the driver may take the final payment at delivery.' : 'Cash sales are paid in full before delivery.'} Sales tax comes from the tax service by delivery address; it is not connected in this preview.</p></section>`;
}
function ofAlsoPanel(s) {
  const d = ofDelivery(s), id = s.id, probs = siteProblems(s), gaps = siteMissing(s.site), open = !['cancelled', 'delivered'].includes(ofStage(s));
  const text = !s.site ? `Not asked yet. Free delivery is within ${FREE_DELIVERY_MILES} miles of the lot that sold it.`
    : `${esc(siteLine(s))}${gaps.length ? ` · <b>still to ask: ${gaps.join(', ')}</b>` : ''}${probs.length ? ` · <b>${probs.map(esc).join(' · ')}</b>` : ''} · ${d.text}`;
  return `<section class="panel"><h2>Delivery site</h2>
    ${ofCheckRow({ state: d.state === 'ok' && !probs.length && !gaps.length ? 'ok' : 'todo', title: 'Miles, access, the opening and the ground', text, act: open ? `<button type="button" class="secondary small" onclick="ofSiteForm('${id}')">${s.site ? 'Change' : 'Add'}</button>` : '' })}
    ${s.site && !gaps.length ? ofCheckRow({ state: s.site.confirmed ? 'ok' : 'wait', title: 'Confirmed by Logistics', text: s.site.confirmed ? `Confirmed with the customer ${ofStamp(s.site.confirmed)}` : 'Logistics goes over these with the customer again when it schedules the delivery' }) : ''}
    <p class="source">The salesperson asks these at the sale. They do not hold up approval. Past ${OF.set.overTo} miles, Logistics approves the delivery fee.</p></section>`;
}
/* After approval: plant, QC, release, delivery. */
function ofAfterPanel(s) {
  const o = s.office, id = s.id, built = ofBuilt(s), pay = ofPayRule(s), lotSale = s.path === 'lot', can = ofCanRelease(s), [hint, why] = ofPathHint(s);
  const phase = s.plantPhase ?? -1, qcB = typeof build === 'function' && build(id);
  const pathPick = lotSale ? '' : `<div class="of-path"><div class="of-seg" role="group" aria-label="Delivery path">
      <button type="button" class="${o.path === 'lot' ? 'on' : ''}" ${o.released ? 'disabled' : ''} onclick="ofPath('${id}','lot')"><strong>Through the lot</strong><small>Rides a plant load to ${esc(saleLot(s).town)}; delivered from there</small></button>
      <button type="button" class="${o.path === 'home' ? 'on' : ''}" ${o.released ? 'disabled' : ''} onclick="ofPath('${id}','home')"><strong>Plant to home</strong><small>Straight from the plant to the customer</small></button></div>
      <p class="of-hint">${o.path ? '' : 'Not chosen yet. '}Suggested: <b>${hint === 'home' ? 'plant to home' : 'through the lot'}</b>. ${why}</p></div>`;
  return `<section class="panel"><div class="panelhead"><h2>After approval</h2><span class="pill ${o.released ? 'good' : 'blue'}">${o.released ? 'With Logistics' : 'With the plant'}</span></div>
    ${ofCheckRow({ state: 'ok', title: 'Approved by the office', text: o.approved ? ofStamp(o.approved.at) : 'Approved' })}
    ${lotSale ? '' : ofCheckRow({ state: built.ok || phase >= phaseNames.indexOf('Final QA') ? 'ok' : 'wait', title: 'Plant builds it', text: phase < 0 ? 'Not started' : phaseNames[Math.min(phase, phaseNames.length - 1)] }) + `<div class="of-phases">${chevronTrack(phaseNames, built.ok ? phaseNames.length : Math.max(phase, 0))}</div>`}
    ${!lotSale && !o.released && phase < phaseNames.indexOf('Final QA') ? `<p class="of-standin"><b>Preview stand-in</b> There is no Production side here yet. <button type="button" class="link inline" onclick="ofPlantNext('${id}')">Production: move to ${phaseNames[phase + 1]}</button></p>` : ''}
    ${lotSale ? '' : ofCheckRow({ state: built.ok ? 'ok' : qcB ? 'wait' : 'todo', title: 'Passes plant QC', text: qcB ? built.text : 'After the plant reaches Final QA', act: qcB ? `<button type="button" class="secondary small" onclick="openBuild('${id}')">QC report</button>` : '' })}
    ${ofCheckRow({ state: pay.ok ? 'ok' : 'todo', title: 'Payment for a home delivery', text: pay.text })}
    ${pathPick}
    ${ofCheckRow({ state: o.released ? 'ok' : can.ok ? 'todo' : 'wait', title: 'Released to Logistics', text: o.released ? `${ofStamp(o.released.at)} · ${typeof lgSaleLine === 'function' ? lgSaleLine(s) : 'on the Logistics board'}` : can.ok ? 'Ready. Releasing puts it on the Logistics board.' : can.why || 'Waits on the steps above',
      act: o.released ? `<button type="button" class="secondary small" onclick="lgOpenSale('${id}')">Open in Logistics</button>` : '' })}
  </section>`;
}
function officeOrder() {
  const s = ofSale(OF.id);
  if (!s || !ofStage(s)) return `<button class="link backlink" onclick="go('${OF.back}')">${icon('back', 18)} Back</button><div class="panel emptystate"><strong>Choose an order</strong><p>Pick one from the to-do list.</p>${button('To do', "go('office')", 'secondary')}</div>`;
  const o = ofRec(s), stage = ofStage(s), lot = saleLot(s), id = s.id, checks = ofChecks(s), left = checks.filter((c) => c.must && c.state !== 'ok'), inv = orderInvoice(s), rto = ofRto(s);
  const can = ofCanRelease(s), plantStarted = (s.plantPhase ?? 0) > 1 || s.built;
  const holdBox = stage === 'hold' ? `<div class="of-banner hold"><strong>On hold since ${ofStamp(o.hold?.at || Date.now())}</strong><p>${esc(o.hold?.reason || 'The office asked for a correction.')}${o.hold?.note ? ' · ' + esc(o.hold.note) : ''}</p><small>Waiting on the ${esc(lot.town)} lot to fix it and submit again. It comes back to the review list when they do.</small></div>` : '';
  const cancelBox = stage === 'cancelled' ? `<div class="of-banner hold"><strong>Cancelled ${ofStamp(o.cancel?.at || Date.now())}</strong><p>${esc(o.cancel?.reason || '')}</p></div>` : '';
  const bar = stage === 'review'
    ? `<div class="ops-bar"><div class="grow"><strong>${left.length ? `${left.length} thing${left.length === 1 ? '' : 's'} left before you can approve` : 'Ready to approve'}</strong><small>${left.length ? left.map((c) => esc(c.short)).join(' · ') : s.path === 'lot' ? 'Approving hands it to Logistics for delivery' : `Approving sends it to the plant in ${esc(lotPlant(lot).town)}`}</small></div>
        <button type="button" class="ops-quiet" onclick="ofHoldForm('${id}')">Place on hold</button><button type="button" class="primary" ${left.length ? 'disabled' : ''} onclick="ofApprove('${id}')">${s.path === 'lot' ? 'Approve the sale' : 'Approve · send to the plant'}</button></div>`
    : stage === 'approved' && !o.released
      ? `<div class="ops-bar"><div class="grow"><strong>${can.ok ? 'Ready to release for delivery' : 'Approved'}</strong><small>${can.ok ? (s.path === 'lot' ? 'Lot to home' : o.path === 'home' ? 'Plant to home' : 'Through the lot') : esc(can.why || ofWhere(s))}</small></div>
        ${plantStarted ? '' : `<button type="button" class="ops-quiet" onclick="ofHoldForm('${id}')">Return to hold</button>`}<button type="button" class="primary" ${can.ok ? '' : 'disabled'} onclick="ofRelease('${id}')">Release to Logistics</button></div>` : '';
  return `<button class="link backlink" onclick="go('${OF.back}')">${icon('back', 18)} ${OF.back === 'of-orders' ? 'Every order' : OF.back === 'of-pay' ? 'Payments' : 'To do'}</button>
  ${head(`Order review · ${esc(lotTown(lot))}`, esc(s.customer), `${esc(id)} · ${esc(label(s.c))} · ${rto ? 'Rent-to-own' : 'Cash purchase'}`)}
  <section class="panel of-top"><div class="pillrow">${ofPill(s)}<span class="pill">${esc(inv.orderType)}</span><span class="pill blue">${esc(inv.plan)}</span>${ofSample(s)}</div>
    <div class="qc-facts"><span>Sold at <strong>${esc(dealerName(lot))}</strong></span><span>Built at <strong>${esc(lotPlant(lot).name)}, ${esc(lotPlant(lot).town)}</strong></span>${s.agent ? `<span>Salesperson <strong>${esc(s.agent)}</strong></span>` : ''}${s.submittedAt ? `<span>Submitted <strong>${ofAgo(Date.parse(s.submittedAt))}</strong></span>` : ''}</div></section>
  ${holdBox}${cancelBox}
  <div class="od-grid"><div class="od-col">
    ${stage === 'approved' || stage === 'delivered' ? ofAfterPanel(s) : ''}
    <section class="panel"><div class="panelhead"><h2>${stage === 'review' ? 'Before you approve' : 'The review'}</h2><span class="pill ${left.length ? 'amber' : 'good'}">${left.length ? `${left.length} left` : 'All in'}</span></div>
      ${checks.map(ofCheckRow).join('')}</section>
    ${ofAlsoPanel(s)}
  </div><div class="od-col">
    ${ofMoneyPanel(s)}
    <section class="panel"><div class="panelhead"><h2>Building</h2><span class="od-tag">${esc(label(s.c))}</span></div>
      ${modelMarkup(s.c, true)}
      <p class="of-inc">${included(s.c).filter(Boolean).map(esc).join(' · ')}</p>
      <div class="actions">${button('Invoice', `ofDoc('${id}','invoice')`, 'secondary small')}${button('Terms', `ofDoc('${id}','terms')`, 'secondary small')}${button('Delivery agreement', `ofDoc('${id}','delivery')`, 'secondary small')}${s.path === 'lot' ? '' : button('Build sheet', `openBuildSheet('${id}')`, 'secondary small')}${rto && s.rtoApp ? button('RTO contract', `ofContract('${id}')`, 'secondary small') : ''}</div></section>
    <section class="panel"><h2>History</h2>${s.events.slice().reverse().map((e) => `<div class="log"><small>${esc(e.time)}</small><br>${esc(e.text)}</div>`).join('')}
      ${['review', 'hold', 'approved'].includes(stage) ? `<p><button type="button" class="link" onclick="ofCancelForm('${id}')">Cancel this order</button></p>` : ''}</section>
  </div></div>
  ${bar}
  ${opsNotes([
    ['The checklist', 'Order Intake’s paperwork check: <code>buildIntakePaperworkChecks</code> (customer contact, sale path, seller location, plant) gates “Accept — paperwork OK” through <code>intakePaperworkReadyForAccept</code>.'],
    ['Approve · send to the plant', '<code>acceptIntake</code> creates the deal and unit, then <code>submitDealToBuild</code> checks the plant packet (order form, floor plan) and moves the unit to <code>order_approved</code>.'],
    ['Place on hold · Return to hold', '<code>holdIntake</code> / <code>returnIntakeToHold</code>: a reason is required and the submitter is told to revise and resubmit.'],
    ['Cancel this order', '<code>cancelIntake</code>.'],
    ['Paperwork', 'Deal paperwork items (<code>ops_deal_paperwork_items</code>): order form, waivers, RTO contract or deposit receipt; missing → received → verified.'],
    ['Release to Logistics', 'The <code>ready_to_deliver</code> flag (<code>readyToDeliverPatch</code>). Logistics will not route a unit without it (<code>assertUnitEligibleForLogisticsRoute</code>).'],
  ], [
    'The deposit, floor plan and RTO company checks as hard stops. Turbo Assist’s checklist has no payment or RTO-approval line yet.',
    'Every money line: discounts with a purpose, fuel surcharge, delivery charges, payments and balance. Turbo Assist keeps none of these at intake.',
    'The price check against the price list.',
    'Through the lot / plant to home as an office choice.',
  ])}`;
}

/* Payments: what to confirm, what is still owed, what to give back. */
function ofPayRow({ s, p, i }) {
  return `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${money(p.amount)}</strong><span class="serial">${esc(p.method)} · ${ofStamp(p.at)}</span>${ofSample(s)}</div>
    <p class="ops-rowsub">${esc(s.customer)} · ${esc(s.id)} · ${esc(lotTown(saleLot(s)))} · ${ofRto(s) ? 'first payment' : 'deposit or payment'}</p></div>
    <div class="ops-rowacts"><button type="button" class="link" onclick="ofDropPay('${s.id}',${i})">Not received</button><button type="button" class="secondary small" onclick="ofOpen('${s.id}')">Order</button><button type="button" class="primary small" onclick="ofConfirmPay('${s.id}',${i})">Confirm received</button></div></article>`;
}
function officePay() {
  const all = ofAll().filter(ofMatches), live = all.filter((s) => ofStage(s) !== 'cancelled');
  const pays = [];
  live.forEach((s) => (ofRec(s), s.money.payments.forEach((p, i) => !p.confirmed && pays.push({ s, p, i }))));
  const owing = live.filter((s) => !ofRto(s) && ofTotals(s).balance > 0 && ofStage(s) !== 'delivered');
  const refunds = all.filter((s) => ofStage(s) === 'cancelled' && ofTotals(s).paid > 0);
  const owed = owing.reduce((t, s) => t + ofTotals(s).balance, 0);
  const tab = (k, n, text) => `<button type="button" class="kpi" aria-pressed="${OF.payTab === k}" onclick="OF.payTab='${k}';render()"><strong>${n}</strong><span>${text}</span></button>`;
  return `${head('Office · all ' + LOTS.length + ' lots', 'Payments.', OF.set.driverPay ? 'Cash sales: the driver may take the final payment at delivery.' : 'Cash sales are paid in full before the building is delivered.')}
  <div class="today ops-tiles three">${tab('confirm', pays.length, 'payments to confirm')}${tab('owing', owing.length, `balances due · ${money(owed)}`)}${tab('refunds', refunds.length, 'refunds to settle')}</div>
  ${ofFilterBar("$('#of-pay').innerHTML=officePayRows()")}
  <div class="ops-list" id="of-pay">${officePayRows()}</div>
  ${opsNotes([['Confirm received', 'The deal’s <code>deposit_receipt</code> paperwork item, received → verified.']], ['The ledger itself: amounts, balances and refunds. Turbo Assist has no payment record yet.', 'Sales tax, which will come from a tax service.'])}`;
}
function officePayRows() {
  const all = ofAll().filter(ofMatches), live = all.filter((s) => ofStage(s) !== 'cancelled');
  const pays = [];
  live.forEach((s) => (ofRec(s), s.money.payments.forEach((p, i) => !p.confirmed && pays.push({ s, p, i }))));
  const owing = live.filter((s) => !ofRto(s) && ofTotals(s).balance > 0 && ofStage(s) !== 'delivered');
  const refunds = all.filter((s) => ofStage(s) === 'cancelled' && ofTotals(s).paid > 0);
  return OF.payTab === 'confirm'
    ? pays.map(ofPayRow).join('') || '<div class="panel emptystate"><strong>Nothing to confirm</strong><p>Every payment the lots recorded has been matched.</p></div>'
    : OF.payTab === 'owing'
      ? owing.map((s) => { const t = ofTotals(s); return ofRow(s, `<span class="ops-flag todo">Paid ${money(t.paid)} of ${money(t.total)} · balance ${money(t.balance)}</span>`).replace('</article>', `<button type="button" class="secondary small" onclick="ofPayForm('${s.id}')">Record a payment</button></article>`); }).join('') || '<div class="panel emptystate"><strong>No balances due</strong><p>Every cash order is paid in full.</p></div>'
      : refunds.map((s) => { const t = ofTotals(s); return ofRow(s, `<span class="ops-flag bad">${money(t.paid)} paid on a cancelled order</span>`).replace('</article>', `<button type="button" class="secondary small" onclick="ofRefund('${s.id}')">Mark refunded</button></article>`); }).join('') || '<div class="panel emptystate"><strong>No refunds to settle</strong><p>No cancelled order has money on it.</p></div>';
}
function ofRefund(id) {
  const s = ofSale(id), paid = ofTotals(s).paid;
  s.money.payments.forEach((p) => p.confirmed && (p.refunded = true));
  ofLog(s, `Office marked ${money(paid)} refunded`);
  render();
  toast('Marked refunded.');
}

/* Requests from the lots: change orders and stock orders. */
function ofChangeRow(c) {
  const n = S.changes.indexOf(c), sale = ofSale(c.order);
  return `<article class="ops-row tall"><div class="grow"><div class="ops-rowtop"><strong>Change order ${esc(c.id)}</strong><span class="serial">${esc(changeOrderName(c.order))}</span>${c.sample ? '<span class="pill ghost">Sample</span>' : ''}</div>
    <p class="ops-rowsub">${esc(c.what)}${c.reason ? ` · Reason: ${esc(c.reason)}` : ''}</p>
    <div class="ops-flags"><span class="ops-flag todo">Waiting on the office since ${ofStamp(c.log[0])}</span></div></div>
    <div class="ops-rowacts">${sale ? `<label class="of-delta">Price change ($)<input id="of-delta-${n}" type="number" step="0.01" placeholder="0" inputmode="decimal"></label>` : ''}<button type="button" class="link" onclick="declineChange(${n})">Decline</button><button type="button" class="primary small" onclick="ofChangeOk(${n})">Approve · to the plant</button></div></article>`;
}
function ofChangeOk(n) {
  const c = S.changes[n], s = ofSale(c.order), delta = Math.round(Number($('#of-delta-' + n)?.value || 0) * 100) / 100;
  if (s && delta) {
    s.total = Math.round((s.total + delta) * 100) / 100;
    c.delta = delta;
    ofLog(s, `Change order ${c.id} approved · price ${delta > 0 ? 'up' : 'down'} ${money(Math.abs(delta))}`);
  } else if (s) ofLog(s, `Change order ${c.id} approved by the office`);
  advanceChange(n);
}
function ofStockRow(r) {
  const n = S.stock.indexOf(r);
  return `<article class="ops-row tall"><div class="grow"><div class="ops-rowtop"><strong>Stock order ${esc(r.id)}</strong><span class="serial">${esc(r.location)} lot</span>${r.sample ? '<span class="pill ghost">Sample</span>' : ''}${r.custom ? '<span class="pill blue">Custom build</span>' : ''}</div>
    <p class="ops-rowsub">${esc(r.name || label(r.c))}${r.total ? ' · ' + money(r.total) : ''}${r.date ? ' · asked for ' + new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</p>
    <div class="ops-flags"><span class="ops-flag todo">Inventory for the lot · no customer yet</span></div></div>
    <div class="ops-rowacts"><button type="button" class="link" onclick="cancelStock(${n});toast('Stock order declined.')">Decline</button><button type="button" class="primary small" onclick="advanceStock(${n});toast('Approved. Sent to the plant.')">Approve · to the plant</button></div></article>`;
}
function officeRequests() {
  const changes = S.changes.filter((c) => !c.declined && c.done === 1), plant = S.changes.filter((c) => !c.declined && c.done === 2);
  const stock = S.stock.filter((r) => (r.stage || 0) === 0 && r.status === 'Pending'), building = S.stock.filter((r) => (r.stage || 0) > 0 && r.status === 'Pending');
  return `${head('Office · all ' + LOTS.length + ' lots', 'Requests from the lots.', 'A change to a building that is already ordered, or a building a lot wants for its own stock. Both need the office before the plant acts.')}
  <h2 class="sectionhead qc-group">Change orders <small>${changes.length} waiting on the office</small></h2>
  <div class="ops-list">${changes.map(ofChangeRow).join('') || '<div class="panel emptystate"><strong>No change orders waiting</strong><p>Nothing needs the office right now.</p></div>'}</div>
  ${plant.length ? `<p class="lede-small" style="margin-top:12px">${plant.length} approved change order${plant.length === 1 ? ' is' : 's are'} waiting on the plant to acknowledge (Plant QC → Change orders).</p>` : ''}
  <h2 class="sectionhead qc-group">Stock orders <small>${stock.length} waiting on the office</small></h2>
  <div class="ops-list">${stock.map(ofStockRow).join('') || '<div class="panel emptystate"><strong>No stock orders waiting</strong><p>Nothing needs the office right now.</p></div>'}</div>
  ${building.length ? `<p class="lede-small" style="margin-top:12px">${building.length} approved stock order${building.length === 1 ? ' is' : 's are'} with the plant.</p>` : ''}
  ${opsNotes([['Stock orders', 'An order intake of kind <code>inventory</code> (sale path <code>inventory_no_sale_yet</code>), accepted with the same <code>acceptIntake</code>.']], ['Change orders: the request, the office approval with a price change, and the plant’s acknowledgment. Turbo Assist has no change-order record yet.'])}`;
}

/* Settings: the numbers that move with the market. */
function ofFuelMethod(method) {
  const f = OF.set.fuel, was = ofFuelSay();
  if (f.method === method) return;
  f.method = method;
  OF.set.fuelLog.unshift({ from: was, to: `${OF_FUEL[method].name.toLowerCase()} · ${ofFuelSay()}`, at: Date.now() });
  render();
}
function ofSetFuel() {
  const f = OF.set.fuel, raw = $('#of-fuel').value.trim(), v = raw === '' ? null : Math.round(Number(raw) * 1000) / 1000, was = ofFuelSay();
  if (v != null && !(v >= 0)) return toast('Type a number.');
  if (v != null && f.method === 'percent' && v > 25) return toast('That is more than 25% of the price. Check the number.');
  f[OF_FUEL[f.method].key] = v;
  OF.set.fuelLog.unshift({ from: was, to: ofFuelSay(), at: Date.now() });
  render();
  toast(v == null ? 'Fuel surcharge cleared. Prices show STILL NEEDED again.' : `Fuel surcharge is now ${ofFuelSay()} on every new building.`);
}
/* What the surcharge comes to on a plain 10 × 16, so the office sees the number it is setting. */
function ofFuelExample() {
  const c = clone(defaults), rows = breakdown(c), price = rows.reduce((t, r) => t + (r.name === 'Fuel surcharge' ? 0 : r.amount), 0), amount = ofFuelFor(c, price);
  return amount == null ? '' : `<p class="of-example">Example: a ${esc(label(c))} at ${money(price)} carries <b>${money(amount)}</b>.</p>`;
}
function ofSetNum(key, el, min, max) {
  const v = Number(el.value);
  if (!(v >= min && v <= max)) return (el.value = key === 'freeMiles' ? FREE_DELIVERY_MILES : OF.set[key]), toast(`Use a number from ${min} to ${max}.`);
  if (key === 'freeMiles') FREE_DELIVERY_MILES = v;
  else OF.set[key] = v;
  render();
  toast('Saved.');
}
function ofAddPurpose() {
  const v = $('#of-purpose').value.trim();
  if (!v) return;
  if (!OF.set.purposes.includes(v)) OF.set.purposes.push(v);
  render();
}
function officeSettings() {
  const f = OF.set;
  return `${head('Office', 'Settings.', 'The numbers that change with the market live here, so nobody edits a price list to move them.')}
  <div class="grid2">
    <section class="panel"><div class="panelhead"><h2>Fuel surcharge</h2><span class="pill ${ofFuelSet() ? 'good' : 'red'}">${ofFuelSet() ? esc(ofFuelSay()) : 'Not set'}</span></div>
      <p>Added to every new custom building automatically. An order keeps the amount it was sold with.</p>
      <div class="of-seg" role="group" aria-label="How the fuel surcharge is figured">${Object.entries(OF_FUEL).map(([k, o]) => `<button type="button" class="${f.fuel.method === k ? 'on' : ''}" onclick="ofFuelMethod('${k}')"><strong>${o.name}</strong><small>${o.hint}</small></button>`).join('')}</div>
      <div class="of-inline"><label>${OF_FUEL[f.fuel.method].label}<input id="of-fuel" type="number" min="0" step="0.01" value="${ofFuelValue() ?? ''}" inputmode="decimal" placeholder="Not set"></label>${button('Save', 'ofSetFuel()', 'primary small')}</div>
      ${ofFuelExample()}
      ${ofFuelSet() ? '' : `<p class="notice">Until this is set, every price on the Sales desk shows ${STILL_NEEDED} beside the fuel surcharge.</p>`}
      ${f.fuelLog.length ? `<ul class="qc-log">${f.fuelLog.map((x) => `<li><strong>${esc(x.from)} → ${esc(x.to)}</strong><small>${ofStamp(x.at)}</small></li>`).join('')}</ul>` : ''}</section>
    <section class="panel"><h2>Delivery</h2>
      <div class="of-inline"><label>Free within (miles of the lot that sold it)<input type="number" min="0" max="500" value="${FREE_DELIVERY_MILES}" onchange="ofSetNum('freeMiles',this,0,500)" inputmode="numeric"></label></div>
      <div class="of-inline"><label>Past that, up to (miles)<input type="number" min="0" max="1000" value="${f.overTo}" onchange="ofSetNum('overTo',this,0,1000)" inputmode="numeric"></label><label>Charge ($)<input type="number" min="0" max="10000" value="${f.overFee}" onchange="ofSetNum('overFee',this,0,10000)" inputmode="decimal"></label></div>
      <p class="source">Farther than ${f.overTo} miles, Logistics approves the fee for that delivery. The first two match the delivery and blocking agreement; the terms and conditions still say 51 to 60 miles.</p>
      <h3>Extra charges the office can add</h3><ul class="of-feelist">${OF_FEES.map(([n, a]) => `<li><span>${n}</span><strong>${money(a)}</strong></li>`).join('')}</ul></section>
    <section class="panel"><h2>Cash sales</h2>
      <div class="of-inline"><label>Deposit at the time of order (%)<input type="number" min="0" max="100" value="${f.depositPct}" onchange="ofSetNum('depositPct',this,0,100)" inputmode="numeric"></label></div>
      <h3>Final payment</h3>
      <div class="of-seg two" role="group" aria-label="Final payment"><button type="button" class="${f.driverPay ? '' : 'on'}" onclick="OF.set.driverPay=false;render()"><strong>Before delivery</strong><small>Paid in full before a building goes to a home. How it works today.</small></button>
        <button type="button" class="${f.driverPay ? 'on' : ''}" onclick="OF.set.driverPay=true;render()"><strong>Driver can take it</strong><small>The driver collects the balance at delivery, before the customer signs.</small></button></div>
      <p class="source">A driver may take a cashier’s check, cash or a card.</p>
      <div class="of-inline"><label>Card processing fee when a driver takes a card (%)<input type="number" min="0" max="10" step="0.1" value="${f.cardFeePct}" onchange="ofSetNum('cardFeePct',this,0,10)" inputmode="decimal"></label></div>
      <p class="source">Added to what the driver charges, to cover the card’s cost. 3% is a starting number: set your own.</p></section>
    <section class="panel"><div class="panelhead"><h2>Rent-to-own companies</h2><span class="pill blue">${f.rtoCos.length === 1 ? 'One company' : f.rtoCos.length + ' companies'}</span></div>
      <p>${f.rtoCos.length === 1 ? 'Every rent-to-own application goes to this company. Add another and the office picks where each one goes, and can try the next after a decline.' : 'The office picks where each application goes, and can try the next company after a decline.'}</p>
      <div class="chiprow">${f.rtoCos.map((c, i) => `<span class="chipbtn on">${esc(c)}${f.rtoCos.length > 1 ? ` <button type="button" class="of-x" aria-label="Remove ${esc(c)}" onclick="OF.set.rtoCos.splice(${i},1);render()">×</button>` : ''}</span>`).join('')}</div>
      <div class="of-inline"><label>Add a company<input id="of-rtoco" maxlength="50" placeholder="Company name"></label>${button('Add', 'ofAddRtoCo()', 'secondary small')}</div></section>
    <section class="panel"><h2>Discounts</h2>
      <p>Every discount needs a purpose. These are offered as quick picks; anything else can be typed.</p>
      <div class="chiprow">${f.purposes.map((p, i) => `<span class="chipbtn on">${esc(p)} <button type="button" class="of-x" aria-label="Remove ${esc(p)}" onclick="OF.set.purposes.splice(${i},1);render()">×</button></span>`).join('')}</div>
      <div class="of-inline"><label>Add a purpose<input id="of-purpose" maxlength="40" placeholder="Example: First responder"></label>${button('Add', 'ofAddPurpose()', 'secondary small')}</div>
      <h3>Sales tax</h3><p class="of-soft">Comes from a tax service, by delivery address. Not connected in this preview, so tax shows as “from the tax service”.</p></section>
  </div>
  ${opsNotes([['Free delivery miles and haul charges', 'Haul rates live in <code>mfg_haul_rate_rules</code>.']], ['A fuel surcharge setting (a percent of the price, by the square foot, by the linear foot, or a flat amount) with its change history. Turbo Assist has no fuel surcharge yet.', 'The deposit percent, the driver-payment switch, the discount purposes and the list of RTO companies.', 'Sales tax: the plan <code>rto_tax_lookup.md</code> is not started.'])}`;
}

function officeNotes() {
  return `<button class="link backlink" onclick="go('office')">${icon('back', 18)} To do</button>
  ${head('Office', 'What is real and what is not.', 'This side is a working picture of the office’s job. It shows the steps and the order they happen in; it keeps nothing.')}
  <div class="grid2">
    <section class="panel"><h2>Matches Turbo Assist</h2><ul>
      <li>The review queue and its four states are Order Intake: pending review, on hold, accepted, cancelled.</li>
      <li>Approve is “Accept — paperwork OK”, followed by Submit to build, which checks the order form and floor plan and puts the order on the plant.</li>
      <li>A hold needs a reason and goes back to the person who submitted it.</li>
      <li>Release to Logistics is the “ready to deliver” flag Logistics waits for.</li>
      <li>A lot’s stock order is the same kind of intake, marked inventory.</li>
    </ul></section>
    <section class="panel"><h2>Only in this preview</h2><ul>
      <li>Deposit, floor plan and RTO company approval as things that must be in before approval.</li>
      <li>The money: discounts with a purpose, the fuel surcharge setting, delivery charges, payments, balances and refunds.</li>
      <li>Sales tax, shown as “from the tax service”.</li>
      <li>Change orders with a price change.</li>
      <li>Choosing through the lot or plant to home.</li>
    </ul></section>
    <section class="panel"><h2>Sample data</h2><ul>
      <li>Every customer is made up. Orders marked “Sample order” were written for this preview.</li>
      <li>The ${LOTS.length} lots, their addresses and open days are from buybennett.com.</li>
      <li>Prices come from Turbo Assist’s price list. The fuel surcharge has no number until the office sets one.</li>
    </ul></section>
    <section class="panel"><h2>Not built</h2><ul>
      <li>Logins. Anyone can press any button.</li>
      <li>Card processing, a tax service and the RTO company’s own system.</li>
      <li>Saving. Reloading the page starts over.</li>
    </ul></section>
  </div>`;
}

/* ---------- Sales desk: what changes now that the office is real ---------- */

/* The fuel surcharge reads the office setting. Unset, prices still say STILL NEEDED. */
{
  const listBreakdown = breakdown;
  breakdown = function (c = S.c) {
    const rows = listBreakdown(c), row = rows.find((r) => r.name === 'Fuel surcharge');
    if (!row) return rows;
    const amount = ofFuelFor(c, rows.reduce((t, r) => t + (r === row ? 0 : r.amount), 0));
    if (amount != null) Object.assign(row, { amount, needed: false, source: `Set by the office · ${ofFuelSay()}` });
    return rows;
  };
  const flag = sfFuelFlag;
  sfFuelFlag = function (html) {
    return ofFuelSet() ? html : flag(html);
  };
}

/* Billing: a discount with its purpose, and whether the customer needs to see the building first. */
{
  const deskBilling = openBilling;
  openBilling = function () {
    deskBilling();
    const form = $('#saleBilling'), b = reviewBilling || {};
    if (!form) return;
    form.querySelector('.actions').insertAdjacentHTML('beforebegin', `<fieldset class="of-billing"><legend>Discount</legend>
      <div class="fields"><label>Discount ($)<input name="discount" type="number" min="0" step="0.01" value="${b.discount || ''}" inputmode="decimal" placeholder="0"></label>
      <label>Purpose<input name="purpose" list="of-purposes" maxlength="60" value="${esc(b.purpose || '')}" placeholder="Example: Military"></label></div>
      <datalist id="of-purposes">${OF.set.purposes.map((p) => `<option>${esc(p)}</option>`).join('')}</datalist>
      <p class="source">A discount needs a purpose. The office approves it at review.</p></fieldset>
      ${S.path === 'lot' ? '' : `<label class="field">Does the customer need to see the building before it is delivered?<select name="seeFirst"><option value="">Not asked</option><option value="yes" ${b.seeFirst === 'yes' ? 'selected' : ''}>Yes, at the lot first</option><option value="no" ${b.seeFirst === 'no' ? 'selected' : ''}>No, deliver it straight to them</option></select></label>`}`);
    const dep = form.elements.deposit?.closest('label');
    if (dep) dep.firstChild.textContent = 'Deposit or first payment taken today ($)';
  };
  const deskContinue = continueBilling;
  continueBilling = function (form) {
    const discount = Math.round(Number(form.elements.discount?.value || 0) * 100) / 100, purpose = (form.elements.purpose?.value || '').trim();
    if (discount > 0 && !purpose) return toast('Add the purpose of the discount.');
    if (discount >= amount()) return toast('The discount is as much as the building.');
    OF.billing = { discount: discount > 0 ? discount : 0, purpose: discount > 0 ? purpose : '', seeFirst: form.elements.seeFirst?.value || '' };
    deskContinue(form);
  };
  const deskReview = showSaleReview;
  showSaleReview = function () {
    if (OF.billing) Object.assign(reviewBilling, OF.billing), (OF.billing = null);
    deskReview();
  };
  /* Creating the order: keep the fuel rate it was sold at, the discount, the first payment and the site answers. */
  const deskSubmit = submitSale;
  submitSale = function () {
    const before = new Set(S.sales.map((s) => s.id + s.status));
    deskSubmit();
    const s = sfSale();
    if (!s || before.has(s.id + s.status) || s.money) return;
    const fuelRow = s.path === 'lot' ? null : breakdown(s.c).find((r) => r.name === 'Fuel surcharge');
    ofRec(s);
    s.money.fuel = s.path === 'lot' ? 0 : fuelRow && !fuelRow.needed ? fuelRow.amount : null;
    if (s.path === 'lot' && S.delivery) (s.site = { ...S.delivery, askedBy: 'Salesperson', askedAt: Date.now(), confirmed: null }), siteFeeSync(s);
    if (S.page === 'sale') render();
  };
}

/* The invoice carries the selling lot, the discount, and the delivery charge. */
{
  const deskInvoice = orderInvoice;
  orderInvoice = function (s) {
    const inv = deskInvoice(s);
    if (!inv.derived) return inv;
    const lot = saleLot(s), m = s.money, out = { ...inv, lines: inv.lines.slice() };
    out.dealer = { name: dealerName(lot), street: lot.street, city: `${lot.town.replace(/ II$/, '')}, ${lot.state} ${lot.zip}`, phone: lot.phone };
    if (s.agent) out.agent = s.agent;
    if (!m) return out;
    for (const d of m.discounts) out.lines.push([`Discount · ${d.purpose || 'no purpose given'}`, 1, -d.amount]);
    for (const f of m.fees) out.lines.push([f.name, 1, f.amount]);
    out.subtotal = Math.round((s.total - ofSum(m.discounts) + ofSum(m.fees)) * 100) / 100;
    if (out.monthly != null && s.billing?.term) out.monthly = payment(s.total - ofSum(m.discounts), s.billing.term);
    const d = ofDelivery(s);
    out.delivery = d.miles == null ? 'To be confirmed' : d.fee === 0 ? 'FREE' : d.fee ? money(d.fee) : 'Fee to be approved by Logistics';
    return out;
  };
  /* The build sheet names the lot that sold it. */
  const sheetOrder = bsOrder;
  bsOrder = function (key) {
    const o = sheetOrder(key), s = S.sales.find((x) => x.id === key);
    if (o && s) o.dealer = dealerName(saleLot(s));
    return o;
  };
}

/* The order page on the desk: the office's hold reason, in the lot's face. */
{
  const deskPanel = sfPanel;
  sfPanel = function (s) {
    const o = s.office;
    if (s.status === 'Cancelled')
      return `<section class="panel of-banner hold"><strong>Cancelled by the office</strong><p>${esc(o?.cancel?.reason || '')}</p><small>${o?.cancel ? ofStamp(o.cancel.at) : ''}</small></section>`;
    const hold = s.status === 'Correction requested' && o?.hold
      ? `<section class="panel of-banner hold"><strong>On hold by the office</strong><p>${esc(o.hold.reason)}${o.hold.note ? ' · ' + esc(o.hold.note) : ''}</p><small>Fix it, then press Submit for admin review again under Next steps.</small></section>` : '';
    return hold + deskPanel(s);
  };
  /* Submitting again clears the hold. */
  const deskSubmit = sfSubmit;
  sfSubmit = function () {
    const s = sfSale(), held = s?.office?.hold;
    deskSubmit();
    if (s && held && s.status === 'Submitted · Awaiting review') {
      s.office.holds.push({ ...held, cleared: Date.now() });
      s.office.hold = null;
      s.submittedAt = new Date().toISOString();
    }
    if (s && s.status === 'Submitted · Awaiting review') ofRec(s);
  };
}

/* ---------- Sample orders from other lots ----------
   Made-up customers, so the office has every kind of order to look at. Each one is marked
   "Sample order". They are other lots' orders, so the Moncks Corner Sales desk does not list them. */
(function seedOffice() {
  const hoursAgo = (h) => new Date(Date.now() - h * 36e5), day = (d) => d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const stamp = (d) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const make = (o) => {
    const c = { ...clone(defaults), catalogOptions: true, windows: 1, ...o.c }, at = hoursAgo(o.hours), lot = lotById(o.lot), rto = !!o.term, [first, ...rest] = o.customer.split(' ');
    let list = 0;
    try { list = Math.round(breakdown(c).reduce((t, r) => t + r.amount, 0) * 100) / 100; } catch { list = 0; }
    if (o.plan !== false) c.sheet = { pos: {}, ok: at.getTime() - 20 * 60e3 };
    const total = list + (o.off || 0), n = String((o.lot.length * 7 + o.hours) % 100).padStart(2, '0');
    const s = {
      id: o.id, customer: o.customer, c, total, path: 'custom', lot: null, lotId: o.lot, agent: o.agent, sample: true,
      type: rto ? 'Rent-to-own' : 'Cash purchase', status: o.status || 'Submitted · Awaiting review', fulfillment: 'Review pending',
      accepted: true, deposit: true, rto, submittedAt: at.toISOString(),
      billing: { type: rto ? 'Rent-to-own' : 'Cash purchase', term: o.term || null, deposit: o.deposit ?? 0, seeFirst: o.seeFirst || '' },
      customerInfo: { firstName: first, lastName: rest.join(' '), email: `${first}.${rest.join('')}@example.com`.toLowerCase(), phone: `(${lot.phone.slice(0, 3)}) 555-01${n}`,
        billingStreet: o.street, billingCity: o.zip === false ? '' : lot.town.replace(/ II$/, ''), billingState: o.zip === false ? '' : lot.state, billingZip: o.zip === false ? '' : lot.zip, same: true },
      signed: { invoice: day(at), terms: day(at), delivery: day(at) }, signatures: {},
      events: [{ time: stamp(new Date(at - 50 * 60e3)), text: `Order created by ${o.agent} at ${lot.town}` }, { time: stamp(new Date(at - 15 * 60e3)), text: 'Customer signed the invoice, terms and delivery agreement' }, { time: stamp(at), text: 'Submitted to administrator for review' }],
      site: o.miles == null ? undefined : { miles: o.miles, access: 'Clear access', gate: '', noGate: true, ground: 'Level', notes: '', askedBy: 'Salesperson', askedAt: at.getTime() - 40 * 60e3, confirmed: null },
    };
    if (rto) s.rtoApp = { provider: OF.set.rtoCos[0], signedOn: day(at), term: o.term, a: { dlState: lot.state, dlGiven: true, dobGiven: true, ssn4: '0000', billingSame: true, employer: 'Sample Employer', r1name: 'Sample Reference', r1phone: '(843) 555-0111', r1rel: 'Friend', r1state: lot.state, r2name: 'Sample Reference Two', r2phone: '(843) 555-0122', r2rel: 'Friend', r2state: lot.state, idPhoto: 'sample-license.jpg', property: 'Owns the property', cosigner: false } };
    S.sales.push(s);
    ofRec(s);
    s.money.fuel = null;
    s.money.payments = (o.pays || []).map(([amount, method, confirmed]) => ({ amount: amount === 'all' ? total : amount === 'tenth' ? Math.round(total * 10) / 100 : amount, method, at: at.getTime(), confirmed: !!confirmed, confirmedAt: confirmed ? at.getTime() + 30 * 60e3 : undefined }));
    if (o.discount) s.money.discounts.push({ amount: o.discount[0], purpose: o.discount[1], ok: false, by: 'Salesperson' });
    siteFeeSync(s);
    if (o.after) o.after(s);
    return s;
  };

  /* The sample order every side knows: rent-to-own, signed, first payment taken at the lot. */
  const avery = ofSale('AA-20411');
  if (avery) {
    avery.c.sheet = { pos: {}, ok: Date.parse('2026-11-06T10:40:00') };
    avery.agent = 'Casey Brooks';
    avery.submittedAt = hoursAgo(3).toISOString();
    avery.site = { miles: 12, access: 'Clear access', gate: '', noGate: true, ground: 'Level', notes: '', askedBy: 'Salesperson', askedAt: Date.parse('2026-11-06T10:20:00'), confirmed: null };
    ofRec(avery);
    avery.money.payments = [{ amount: 605.84, method: 'Card at the lot', at: Date.parse('2026-11-06T10:45:00'), confirmed: false }];
  }
  /* Cash, paid in full, everything in: ready to approve. */
  make({ id: 'STB-3102', lot: 'statesboro', customer: 'Dana Whitfield', agent: 'Sam Carter', hours: 2, c: { style: 'Lofted', size: '10x16', color: 'Clay', trimColor: 'Origami White', roofColor: 'Charcoal' }, street: '14 Sample Oak Rd', miles: 18, seeFirst: 'no', pays: [['all', 'Bank transfer', true]] });
  /* Rent-to-own, sent to the RTO company yesterday. */
  make({ id: 'LEX-1634', lot: 'lexington', customer: 'Pat Monroe', agent: 'Riley Hart', hours: 26, term: 48, c: { style: 'Utility', size: '12x24', shield: true, color: 'Dovetail Grey', trimColor: 'Origami White', roofColor: 'Black', windows: 2 }, street: '208 Sample Mill Rd', miles: 31, pays: [[436.5, 'Card at the lot', true]],
    after: (s) => (s.office.rtoCo = { state: 'sent', company: OF.set.rtoCos[0], sent: Date.now() - 20 * 36e5 }) });
  /* Cash with a military discount to approve and a deposit to confirm. */
  make({ id: 'FLO-2121', lot: 'florence', customer: 'Robin Hale', agent: 'Jo Whitaker', hours: 5, c: { style: 'Utility', size: '12x20', siding: 'Lap', color: 'Sage Green', trimColor: 'Origami White', roof: 'Shingles', windows: 2 }, street: '77 Sample Pine Ct', miles: 44, discount: [300, 'Military'], pays: [['tenth', 'Card at the lot', false]] });
  /* Cash with two problems (no deposit, under the price list), and 62 miles out: a delivery charge. */
  make({ id: 'CNW-0934', lot: 'conway', customer: 'Drew Ellison', agent: 'Lee Tran', hours: 7, c: { style: 'Utility', size: '10x12', color: 'Blue', trimColor: 'Origami White', roofColor: 'Galvalume', windows: 0 }, street: '5 Sample Marsh Ln', miles: 62, off: -150, pays: [] });
  /* On hold since yesterday: the floor plan was never confirmed. */
  make({ id: 'VID-3107', lot: 'vidalia', customer: 'Toni Marsh', agent: 'Kai Rivers', hours: 30, term: 60, plan: false, status: 'Correction requested', c: { style: 'Lofted', size: '10x20', color: 'Red', trimColor: 'Origami White', roofColor: 'Black' }, street: '31 Sample Peach St', miles: 9, pays: [[392.1, 'Card at the lot', true]],
    after: (s) => {
      s.fulfillment = 'On hold by the office';
      s.office.hold = { reason: 'Floor plan is not confirmed', note: 'Walk the customer through the floor plan and press Confirm layout, then submit again.', at: Date.now() - 22 * 36e5 };
      s.events.push({ time: stamp(hoursAgo(22)), text: 'Office placed the order on hold: Floor plan is not confirmed' });
    } });
  /* Approved last week, at the plant, and 118 miles from the lot: Logistics has a fee to approve. */
  make({ id: 'GRV-0020', lot: 'graniteville', customer: 'Kelly Ardmore', agent: 'Max Dunn', hours: 150, status: 'Processed · Sold', c: { style: 'Studio', size: '10x16', color: 'Alpine Grey', trimColor: 'Black', roofColor: 'Black', windows: 2 }, street: '402 Sample Ridge Rd', miles: 118, pays: [['tenth', 'Card at the lot', true]],
    after: (s) => {
      s.office.approved = { at: Date.now() - 140 * 36e5 };
      s.plantPhase = 3;
      s.fulfillment = phaseNames[3];
      s.events.push({ time: stamp(hoursAgo(140)), text: 'Office approved · order form and floor plan sent to the plant' });
    } });
  /* Built and signed off by plant QC: waiting on the office to release them. */
  const builtAndPassed = (s, signedHoursAgo) => {
    const at = Date.now() - signedHoursAgo * 36e5;
    s.office.approved = { at: at - 9 * 864e5 };
    s.plantPhase = phaseNames.length - 1;
    s.built = day(new Date(at - 864e5));
    s.fulfillment = 'Passed plant QC · ready to ship';
    s.events.push({ time: stamp(new Date(at - 9 * 864e5)), text: 'Office approved · order form and floor plan sent to the plant' }, { time: stamp(new Date(at)), text: 'Plant QC: signed off · ready to ship' });
    if (typeof Q === 'undefined') return;
    Q.builds.push({ serial: s.id, order: s.id, saleId: s.id, customer: s.customer, c: s.c, size: s.c.size, style: label(s.c).replace(s.c.size, '').trim(), dealer: dealerName(saleLot(s)),
      siding_color: s.c.color, trim_color: s.c.trimColor || 'Origami White', roof: s.c.roof === 'Metal' ? (s.c.roofColor ? s.c.roofColor + ' metal' : 'Metal') : 'Architectural shingles',
      stage: LAST, days_in_stage: 0, results: { [QC]: { result: 'pass', firstPass: true, by: 'Sample record', at: at - 2 * 36e5 } }, superseded: [], attempts: { [QC]: 1 }, hold: null, model_image: null, signoff: { by: 'Sample record', at } });
    record(s.id, QC, 'Inspection passed', at - 2 * 36e5, 'Sample record');
    record(s.id, QC, 'Signed off. Ready to ship', at, 'Sample record');
  };
  /* Rent-to-own, approved by the RTO company: free to go straight to the customer. */
  make({ id: 'RAV-5538', lot: 'ravenel', customer: 'Avery Quinn', agent: 'Noel Park', hours: 240, term: 36, status: 'Processed · Sold', seeFirst: 'no', c: { style: 'Utility', size: '10x16', shield: true, color: 'Navajo White', trimColor: 'Brown', roofColor: 'Brown' }, street: '19 Sample Creek Rd', miles: 27, pays: [[421.4, 'Card at the lot', true]],
    after: (s) => {
      s.office.rtoCo = { state: 'approved', company: OF.set.rtoCos[0], sent: Date.now() - 238 * 36e5, at: Date.now() - 230 * 36e5 };
      builtAndPassed(s, 4);
    } });
  /* Cash with a balance still owed: it can ride to the lot, not to the customer's home. */
  make({ id: 'LUG-0320', lot: 'lugoff', customer: 'Shawn Pickett', agent: 'Erin Vale', hours: 260, status: 'Processed · Sold', seeFirst: 'yes', c: { style: 'Utility', size: '12x16', shield: true, color: 'Web Grey', trimColor: 'Origami White', roofColor: 'Charcoal', windows: 2 }, street: '650 Sample Lake Dr', miles: 14, pays: [['tenth', 'Card at the lot', true]],
    after: (s) => builtAndPassed(s, 20) });
})();

const OFFICE_SCREENS = { office: officeHome, 'of-orders': officeOrders, 'of-order': officeOrder, 'of-pay': officePay, 'of-requests': officeRequests, 'of-settings': officeSettings, 'of-notes': officeNotes };
