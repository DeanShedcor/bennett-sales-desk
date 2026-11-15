/* turbo-office.js: the Office side's share of what Turbo Assist already knows.

   Turbo Assist (bennett-buddy, read at commit b42d324) is the functionality authority. Each piece
   below is something it already does or has planned, shown in the Office the preview already has:
   - Paperwork: which documents a deal needs comes from its rule set (DEFAULT_PAPERWORK_RULES_DOC in
     server/opsPaperwork/manifestEvaluator.ts), with the names from DEFAULT_TEMPLATES
     (server/admin-handlers/opsPaperwork.ts) and the statuses missing, received, verified, waived.
   - Signatures: Turbo Sign's contract and signer statuses (server/sign-domain/ctrShared.ts).
   - Order intake: source labels, the two notices (placed on hold, resubmitted), the review prompts,
     the five intake checks and the event names (server/opsOrderIntake, src/components/sales-intake).
   - Cancel reasons and the folder a deal's paperwork is filed under (src/lib/ops/driveFolderRecipe.ts).
   - Ready to deliver: the blocked reason and timeline lines (src/lib/ops/readyToDeliver.ts).
   - The Ops summary counts and the daily ownership digest (src/lib/messages/ownershipDigestModel.ts).
   - Rent-to-own terms: the Ops "RTO Terms" table, over TA.rto in turbo.js.
   - Sales tax: typed by hand today; the lookup in docs/planning/rto_tax_lookup.md is not started.
   - Returns: unit status repossessed / returned opens a service job by itself
     (src/lib/service/manufacturingAutoBridge.ts); buildings not built here get REPO- or CASH- serials.
   - Company bills: Ops "Obligations" (src/lib/opsObligations).
   Loaded after turbo.js. It wraps the Office screens and actions in office.js and changes none of them. */

const toCents = (n) => Math.round(n * 100) / 100;
const toBefore = (html, anchor, add) => {
  const i = html.indexOf(anchor);
  return i < 0 ? html : html.slice(0, i) + add + html.slice(i);
};
const toBeforeLast = (html, anchor, add) => {
  const i = html.lastIndexOf(anchor);
  return i < 0 ? html : html.slice(0, i) + add + html.slice(i);
};
const toPlural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

const TO = {
  dueHours: 24, /* paperwork is due the day after the lot submits the order: this preview's rule */
  seq: { REPO: 41, CASH: 12 },
  returns: [],
  bills: [],
  billSeq: 0,
  rgaKind: 'repossessed',
  entry: 'repo_intake',
  rtoStart: null,
  rtoLog: [],
  digestOpen: false,
};

/* ---------- Paperwork: which documents a deal needs ---------- */
const TO_PAPER = {
  order_form: ['Order form / IdeaRoom doc', 'Build sheet used in plant', 5],
  rto_contract: ['RTO contract', 'Completed in the POS', 10],
  deposit_receipt: ['Deposit receipt', 'Check, cash, or card receipt', 20],
  happy_sheet: ['Happy sheet (delivery)', 'FastField or equivalent proof', 30],
  steel_supplemental: ['Steel supplemental paperwork', 'Line-specific steel docs', 35],
  waivers: ['Conditional waivers', 'Extra waivers for specific options', 40],
};
const TO_PAPER_RULES = {
  default_item_keys: ['order_form', 'waivers'],
  rules: [
    { when: { deal_payment: ['rto', 'finance'] }, add_item_keys: ['rto_contract'], say: 'Rent-to-own or financed' },
    { when: { deal_payment: ['cash', 'check'] }, add_item_keys: ['deposit_receipt'], say: 'Cash or check' },
    { when: { deal_order_type: 'inventory' }, add_item_keys: ['happy_sheet'], say: 'Sold from inventory' },
    { when: { deal_type: 'steel' }, add_item_keys: ['steel_supplemental'], say: 'Steel structure' },
  ],
};
const TO_PAPER_STATE = { missing: 'Missing', received: 'Received', verified: 'Verified', waived: 'Waived' };
/* Same walk as evaluateManifestItemKeys: the always-on documents, then each rule that matches. */
function toManifestKeys(ctx) {
  const out = [...TO_PAPER_RULES.default_item_keys];
  for (const r of TO_PAPER_RULES.rules) {
    const hit = Object.entries(r.when).every(([k, v]) => ctx[k] != null && [].concat(v).some((a) => String(a).toLowerCase() === String(ctx[k]).toLowerCase()));
    if (hit) r.add_item_keys.forEach((k) => out.includes(k) || out.push(k));
  }
  return out.sort((a, b) => TO_PAPER[a][2] - TO_PAPER[b][2]);
}
const toDealContext = (s) => ({ deal_type: 'shed', deal_payment: ofRto(s) ? 'rto' : 'cash', deal_order_type: s.path === 'lot' ? 'inventory' : 'custom_order' });
/* Each document, tied to what the preview already tracks for the order. */
function toPaperItems(s) {
  const o = ofRec(s), m = s.money, inv = orderInvoice(s), lot = s.path === 'lot', stage = ofStage(s);
  const sent = Date.parse(o.firstSubmitted || s.submittedAt || '') || null, due = sent == null ? null : sent + TO.dueHours * 36e5;
  return toManifestKeys(toDealContext(s)).map((key) => {
    let status = 'missing', text = '', itemDue = due;
    if (key === 'order_form') {
      const on = lot ? inv.signed.invoice : s.c.sheet?.ok;
      status = on ? (o.approved ? 'verified' : 'received') : 'missing';
      text = lot ? (on ? `Signed invoice for serial ${esc(inv.serial || s.id)} · ${esc(on)}` : 'The invoice is not signed') : on ? `Build sheet confirmed ${ofStamp(on)}` : 'The build sheet is not confirmed';
    } else if (key === 'waivers') {
      const n = ['terms', 'delivery'].filter((k) => inv.signed[k]).length;
      status = n === 2 ? (o.approved ? 'verified' : 'received') : 'missing';
      text = n === 2 ? `Terms and the delivery and blocking agreement signed ${esc(inv.signed.terms)}` : `${n} of 2 signed: terms, and the delivery and blocking agreement`;
    } else if (key === 'rto_contract') {
      const app = s.rtoApp, r = o.rtoCo;
      status = !app ? 'missing' : r?.state === 'approved' ? 'verified' : 'received';
      text = !app ? 'The rent-to-own application is not finished' : `Application signed ${esc(app.signedOn)}${r?.state === 'approved' ? ` · approved by ${esc(ofRtoName(s))}` : r?.state === 'sent' ? ` · with ${esc(ofRtoName(s))}` : r?.state === 'declined' ? ` · declined by ${esc(ofRtoName(s))}` : ' · not sent to the RTO company yet'}`;
    } else if (key === 'deposit_receipt') {
      const got = m.payments.filter((p) => p.confirmed && !p.refunded), wait = m.payments.filter((p) => !p.confirmed);
      status = got.length ? 'verified' : wait.length ? 'received' : 'missing';
      text = got.length ? `${money(ofSum(got))} confirmed by the office` : wait.length ? `${money(ofSum(wait))} recorded at the lot · the office has not confirmed it` : 'No deposit recorded';
    } else if (key === 'happy_sheet') {
      status = s.deliveredAt ? 'received' : 'missing';
      itemDue = null; /* due at delivery, not before */
      text = s.deliveredAt ? `The customer signed for the building ${esc(s.deliveredAt)}` : 'The driver collects it when the building is delivered';
    }
    if (status === 'missing' && o.paper?.[key] === 'waived') (status = 'waived'), (text += ' · waived by the office');
    const overdue = status === 'missing' && itemDue != null && itemDue < Date.now() && stage !== 'cancelled' && stage !== 'delivered';
    return { key, label: TO_PAPER[key][0], about: TO_PAPER[key][1], status, text, due: itemDue, overdue };
  });
}
/* Turbo Assist's count: paperwork still missing after its due date. */
function toOverdue() {
  const out = [];
  for (const s of ofAll()) if (ofStage(s) !== 'cancelled') for (const x of toPaperItems(s)) if (x.overdue) out.push({ s, x });
  return out;
}
function toOverdueList() {
  const list = toOverdue();
  modal('Overdue paperwork', `<p class="source">Paperwork still missing a day after the lot submitted the order.</p>
    ${list.length ? list.map(({ s, x }) => `<div class="to-doc late"><div class="grow"><strong>${esc(x.label)}</strong><small>${esc(s.customer)} · ${esc(s.id)} · ${esc(lotTown(saleLot(s)))} · ${x.text} · due ${ofStamp(x.due)}</small></div><button type="button" class="secondary small" onclick="closeModal();ofOpen('${s.id}')">Open</button></div>`).join('') : '<p class="muted">Nothing is overdue.</p>'}`);
}
function toWaive(id, key) {
  const s = ofSale(id), o = ofRec(s);
  (o.paper ||= {})[key] = o.paper[key] === 'waived' ? null : 'waived';
  ofLog(s, `${TO_PAPER[key][0]}: ${o.paper[key] ? 'waived by the office' : 'no longer waived'}`);
  render();
}

/* ---------- Signatures: Turbo Sign's statuses ---------- */
const TO_SIGN = {
  draft: 'Prefilled but not sent to signers yet.',
  sent: 'Envelope dispatched to signers.',
  viewed: 'At least one signer opened the document.',
  'partially signed': 'Some signers completed; waiting on others.',
  signed: 'All required signatures captured.',
  declined: 'A signer refused to sign.',
  expired: 'Signing window elapsed at the provider.',
  voided: 'Cancelled by a manager or admin.',
};
function toSignRows(s) {
  const inv = orderInvoice(s), who = (k) => s.signatures?.[k]?.name || inv.shipTo.name || s.customer, out = [];
  const waiting = s.status === 'Quote issued' ? 'draft' : 'sent', gone = ofStage(s) === 'cancelled';
  for (const [k, title] of SF_DOCS) {
    const on = inv.signed[k], status = on ? 'signed' : gone ? 'voided' : waiting;
    out.push({ title, status, signers: [['Customer', on ? 'signed' : gone ? 'pending' : waiting === 'sent' ? 'sent' : 'pending', on, who(k)]] });
  }
  if (ofRto(s)) {
    const app = s.rtoApp, on = app?.signedOn, st = on ? 'signed' : gone ? 'pending' : 'pending';
    out.push({ title: 'RTO contract', status: on ? 'signed' : gone ? 'voided' : 'draft', signers: [['Customer', st, on, inv.shipTo.name || s.customer], ...(app?.a?.cosigner ? [['Co-signer', st, on, app.a.csName || 'On the application']] : [])] });
  }
  const got = s.signed?.receipt || s.deliveredAt;
  out.push({ title: 'Delivery receipt', status: got ? 'signed' : gone ? 'voided' : 'draft', signers: [['Customer', got ? 'signed' : 'pending', got, who('receipt')]] });
  return out;
}
/* The folder Turbo Assist files the deal's paperwork under (default Drive folder recipe). */
const toCancelKind = (c) => c?.kind || (/reject/i.test(c?.reason || '') ? 'rto_rejected' : 'customer_cancelled');
function toFolder(s) {
  const stage = ofStage(s), o = ofRec(s), made = new Date(Date.parse(o.firstSubmitted || s.submittedAt || '') || Date.now());
  const year = String(made.getFullYear()), month = String(made.getMonth() + 1).padStart(2, '0'), leaf = `${s.customer} · ${s.id}`;
  if (stage === 'cancelled') return ['Cancelled', toCancelKind(o.cancel) === 'rto_rejected' ? 'RTO Rejected' : 'Customer Cancelled', year, leaf].join(' / ');
  if (stage === 'delivered') return ['Delivered', ofRto(s) ? 'RTO' : 'Cash', year, month, leaf].join(' / ');
  return ['Pending', leaf].join(' / ');
}
function toPaperPanel(s) {
  const items = toPaperItems(s), id = s.id, open = !['cancelled', 'delivered'].includes(ofStage(s));
  const done = items.filter((x) => x.status !== 'missing').length, late = items.filter((x) => x.overdue).length, ctx = toDealContext(s);
  const flag = (x) => (x.overdue ? 'bad' : x.status === 'missing' ? 'todo' : x.status === 'received' ? 'wait' : x.status === 'verified' ? 'ok' : '');
  const canWaive = (x) => open && (x.key === 'waivers' || x.key === 'happy_sheet') && (x.status === 'missing' || x.status === 'waived');
  return `<section class="panel to-paper"><div class="panelhead"><h2>Paperwork</h2><span class="pill ${late ? 'red' : done === items.length ? 'good' : 'amber'}">${late ? `${late} overdue` : `${done} of ${items.length} in`}</span></div>
    <p class="to-sub">What Turbo Assist’s paperwork rules ask for on a ${ctx.deal_payment === 'rto' ? 'rent-to-own' : 'cash'} ${ctx.deal_order_type === 'inventory' ? 'sale from inventory' : 'custom order'}.</p>
    ${items.map((x) => `<div class="to-doc ${x.overdue ? 'late' : x.status}"><div class="grow"><strong>${esc(x.label)}</strong><small>${esc(x.about)} · ${x.text}${x.overdue ? ` · <b>was due ${ofStamp(x.due)}</b>` : ''}</small></div>
      <div class="to-docside"><span class="ops-flag ${flag(x)}">${TO_PAPER_STATE[x.status]}${x.overdue ? ' · overdue' : ''}</span>${canWaive(x) ? `<button type="button" class="link" onclick="toWaive('${id}','${x.key}')">${x.status === 'waived' ? 'Undo' : 'Waive'}</button>` : ''}</div></div>`).join('')}
    <h3>Signatures</h3>
    ${toSignRows(s).map((d) => `<div class="to-doc"><div class="grow"><strong>${esc(d.title)}</strong><small>${d.signers.map(([role, st, on, name]) => `${role}: ${st}${on ? ` ${esc(on)} · ${esc(name)}` : ''}`).join(' · ')}</small></div>
      <div class="to-docside"><span class="to-chip ${d.status.replace(' ', '-')}" title="${esc(TO_SIGN[d.status])}">${d.status}</span></div></div>`).join('')}
    <p class="source">Filed under <b>${esc(toFolder(s))}</b>, the folder Turbo Assist keeps a deal’s paperwork in. ${taTip('down-payment', 'No paperwork, no delivery')}</p></section>`;
}

/* ---------- Order intake: source, status, the five checks, the events ---------- */
const TO_SOURCE = {
  inventory_host_customer_order: 'inventory host customer order',
  inventory_host_inventory_order: 'inventory host inventory order',
  in_app_customer: 'In-app customer order',
  in_app_inventory: 'In-app inventory build',
  in_app_dealer: 'Dealer-submitted order',
  manual_import: 'Manual import',
  idearoom_export: 'IdeaRoom export',
  sensei_export: 'Sensei export',
};
/* An order that carries its own point-of-sale invoice came in from the inventory system. */
const toSource = (s) => (s.invoice ? 'inventory_host_customer_order' : 'in_app_customer');
const TO_TAB = { review: 'Pending Review', hold: 'On Hold', approved: 'Accepted', delivered: 'Accepted', cancelled: 'Cancelled' };
const TO_EVENT = { submitted: 'Submitted', merged: 'Resubmitted', accepted: 'Accepted', on_hold: 'Placed on hold', returned_to_hold: 'Returned to hold', cancelled: 'Cancelled' };
/* buildIntakePaperworkChecks: the five things Turbo Assist checks before "Accept — paperwork OK". */
function toIntakeChecks(s) {
  const st = orderInvoice(s).shipTo, lot = saleLot(s), plant = lot && lotPlant(lot), reach = !!(st.phone || st.email), notes = (s.toConfirm || []).join('; ');
  return [
    { label: 'Customer contact captured', status: st.name && reach ? 'pass' : 'fail', detail: st.name && reach ? [st.name, st.phone, st.email].filter(Boolean).join(' · ') : 'Missing end-customer contact' },
    { label: 'Sale path specified', status: 'pass', detail: ofRto(s) ? 'Rent-to-own' : 'Cash sale' },
    { label: 'Seller location pinned', status: lot ? 'pass' : 'warn', detail: lot ? dealerName(lot) : 'Optional for some sources; required for dealer submissions' },
    { label: 'Proposed plant (for accept)', status: plant ? 'pass' : 'warn', detail: plant ? `${plant.name}, ${plant.town}` : 'Accept may fail until a plant is set' },
    { label: 'Submitter notes reviewed', status: notes ? 'pass' : 'warn', detail: notes || 'No notes on this submission' },
  ];
}
function toIntakeEvents(s) {
  const o = ofRec(s), out = [], first = Date.parse(o.firstSubmitted || s.submittedAt || '');
  if (first) out.push({ type: 'submitted', at: first });
  for (const h of o.holds || []) {
    out.push({ type: h.returned ? 'returned_to_hold' : 'on_hold', at: h.at, text: h.reason });
    if (h.cleared) out.push({ type: 'merged', at: h.cleared });
  }
  if (o.hold) out.push({ type: o.hold.returned ? 'returned_to_hold' : 'on_hold', at: o.hold.at, text: o.hold.reason });
  if (o.approved) out.push({ type: 'accepted', at: o.approved.at });
  if (o.cancel) out.push({ type: 'cancelled', at: o.cancel.at, text: o.cancel.reason });
  return out.sort((a, b) => a.at - b.at);
}
function toIntakePanel(s) {
  const stage = ofStage(s), checks = toIntakeChecks(s), fails = checks.filter((c) => c.status === 'fail').length, mark = { pass: 'ok', warn: 'todo', fail: 'bad' };
  return `<section class="panel to-intake"><div class="panelhead"><h2>Order intake</h2><span class="pill ${stage === 'hold' ? 'red' : stage === 'cancelled' ? 'ghost' : stage === 'review' ? 'blue' : 'good'}">${TO_TAB[stage]}</span></div>
    ${odRow('Came in as', esc(TO_SOURCE[toSource(s)]))}
    ${odRow('Sale path', ofRto(s) ? 'Rent-to-own' : 'Cash sale')}
    <details class="to-five"><summary>Turbo Assist’s own intake check: ${fails ? `${toPlural(fails, 'check')} failed` : `${checks.filter((c) => c.status === 'pass').length} of ${checks.length} pass`}</summary>
      ${checks.map((c) => `<div class="to-line"><span class="ops-flag ${mark[c.status]}">${c.status}</span><span class="grow"><strong>${c.label}</strong><small>${esc(c.detail)}</small></span></div>`).join('')}
      <p class="source">These five are all that gate “Accept — paperwork OK” in Turbo Assist today. A warning does not stop an accept; a failed check does. The longer list on the left is this preview’s.</p></details>
    <h3>Intake record</h3>
    <ul class="qc-log to-events">${toIntakeEvents(s).map((e) => `<li><strong>${TO_EVENT[e.type]}${e.text ? ': ' + esc(e.text) : ''}</strong><small>${ofStamp(e.at)}</small></li>`).join('') || '<li><small>Nothing recorded yet.</small></li>'}</ul>
  </section>`;
}

/* ---------- Sales tax: typed by hand, the way Turbo Assist's calculator works today ---------- */
const toTaxPct = (s) => (s.invoice ? null : s.office?.taxPct ?? null);
function toSetTax(id, raw) {
  const s = ofSale(id), o = ofRec(s), text = String(raw).trim(), v = text === '' ? null : Math.round(Number(text) * 1000) / 1000;
  if (v != null && !(v >= 0 && v <= 15)) {
    toast('Type a tax percent from 0 to 15.');
    return render();
  }
  if ((o.taxPct ?? null) === v) return;
  o.taxPct = v;
  ofLog(s, v == null ? 'Office cleared the sales tax percent' : `Office typed the sales tax: ${v}% (no automatic lookup yet)`);
  render();
}
{
  /* With a percent typed, a cash order owes the tax too; a rent-to-own payment carries it monthly. */
  const baseTotals = ofTotals;
  TO.baseTotals = baseTotals;
  ofTotals = function (s) {
    const t = baseTotals(s), pct = toTaxPct(s);
    if (pct == null) return t;
    t.taxPct = pct;
    if (t.rto) {
      t.tax = t.monthly == null ? 0 : toCents((t.monthly * pct) / 100);
      t.monthlyWithTax = t.monthly == null ? null : toCents(t.monthly + t.tax);
      return t;
    }
    t.tax = toCents((t.total * pct) / 100);
    t.totalWithTax = toCents(t.total + t.tax);
    t.balance = Math.max(0, toCents(t.totalWithTax - t.paid));
    return t;
  };
  /* The invoice carries the same line, so the Sales desk and the customer see it. */
  const baseInvoice = orderInvoice;
  orderInvoice = function (s) {
    const inv = baseInvoice(s), pct = toTaxPct(s);
    if (pct == null || !inv.derived) return inv;
    const amount = ofRto(s) ? (inv.monthly == null ? null : toCents((inv.monthly * pct) / 100)) : toCents((inv.subtotal * pct) / 100);
    return amount == null ? inv : { ...inv, taxes: [[`Sales tax (${pct}%) · typed by the office`, amount]] };
  };
  /* The invoice document totals its tax lines as a monthly amount. A cash invoice shows the one tax
     line and the total with tax instead. */
  const baseDoc = orderDoc;
  orderDoc = function (kind) {
    baseDoc(kind);
    const s = S.sales.find((x) => x.id === S.activeSale);
    if (kind !== 'invoice' || !s || ofRto(s) || toTaxPct(s) == null) return;
    const inv = orderInvoice(s), tax = inv.taxes ? inv.taxes.reduce((t, x) => t + x[1], 0) : 0;
    for (const el of document.querySelectorAll('.modal .od-totals .od-kv')) {
      if (el.firstElementChild?.textContent !== 'Total monthly sales tax') continue;
      el.insertAdjacentHTML('afterend', odRow('Total with tax', money(inv.subtotal + tax), 'strong'));
      el.remove();
    }
  };
  const baseMoney = ofMoneyPanel;
  ofMoneyPanel = function (s) {
    let html = baseMoney(s);
    const t = ofTotals(s), pct = toTaxPct(s), open = !['cancelled', 'delivered'].includes(ofStage(s));
    html = html.replace('Sales tax comes from the tax service by delivery address; it is not connected in this preview.', `Sales tax is typed by hand today, the way Turbo Assist’s calculator works; a lookup by delivery address is planned.`);
    if (s.invoice) return html.replace(/(<div class="od-kv "><span>Sales tax(?:, monthly)?)(<\/span>)/, '$1 <em class="to-chip">on the signed invoice</em>$2');
    const amount = pct == null ? '' : `<span class="to-taxamt">${money(t.tax)}${t.rto ? ' a month' : ''}</span>`;
    const field = open
      ? `<label class="to-taxin"><input type="number" min="0" max="15" step="0.001" inputmode="decimal" value="${pct ?? ''}" placeholder="none" aria-label="Sales tax percent for this order" onchange="toSetTax('${s.id}',this.value)"><span>%</span></label>`
      : pct == null ? '<span class="of-soft">Not entered</span>' : `<span>${pct}%</span>`;
    html = html.replace(/<div class="od-kv "><span>Sales tax(?:, monthly)?<\/span><strong>.*?<\/strong><\/div>/, `<div class="od-kv to-taxrow"><span>Sales tax${t.rto ? ', monthly' : ''} <em class="to-chip" title="Turbo Assist plans three badges here: auto · X%, manual (auto: X%), and no lookup. The lookup is not built, so this one always reads no lookup.">no lookup</em></span><strong>${field}${amount}</strong></div>`);
    if (pct == null) return html;
    return t.rto
      ? html.replace(/(<div class="od-kv "><span>Monthly payment, before tax<\/span><strong>[^<]*<\/strong><\/div>)/, `$1${odRow('Monthly payment with tax', money(t.monthlyWithTax))}`)
      : html.replace(/(<div class="od-kv strong"><span>Order total, before tax<\/span><strong>[^<]*<\/strong><\/div>)/, `$1${odRow('Order total with tax', money(t.totalWithTax), 'strong')}`);
  };
}

/* ---------- Rent-to-own terms: down payments at signing ---------- */
/* What the order's term asks for at signing, from the office's terms table. */
function toRtoDown(s) {
  if (!ofRto(s) || s.invoice) return null;
  const months = Number(s.billing?.term || s.rtoApp?.term), term = months && taRtoTerm(months);
  if (!term) return null;
  const price = s.total - ofSum(s.money?.discounts || []), calc = taRtoCalc(months, price, 0, toTaxPct(s) ?? 0);
  return { months, amount: calc.minToday, say: term.downType === 'payments' ? toPlural(Math.max(1, term.down), 'payment') : `${toCents(term.down * 100)}%` };
}
{
  const baseChecks = ofChecks;
  ofChecks = function (s) {
    const out = baseChecks(s), need = toRtoDown(s), c = need && out.find((x) => x.key === 'deposit');
    if (!c) return out;
    const all = ofSum(s.money.payments.filter((p) => !p.refunded));
    c.text += !all ? ` · a ${need.months}-month term asks for ${need.say} down (${money(need.amount)})`
      : all + 0.005 < need.amount ? ` · <b>under the ${need.say} down a ${need.months}-month term asks for (${money(need.amount)})</b>` : ` · covers the ${need.say} down a ${need.months}-month term asks for (${money(need.amount)})`;
    return out;
  };
  const basePayForm = ofPayForm;
  ofPayForm = function (id) {
    basePayForm(id);
    const s = ofSale(id), need = s && toRtoDown(s), field = $('#of-pay-amount');
    if (!need || !field) return;
    const left = toCents(need.amount - ofSum(s.money.payments.filter((p) => !p.refunded)));
    if (left > 0) field.value = left;
    field.closest('.fields')?.insertAdjacentHTML('afterend', `<p class="source">A ${need.months}-month term asks for ${need.say} down at signing: ${money(need.amount)}. ${taTip('rto-timing', 'When payments are due')}</p>`);
  };
}
/* The terms table in Settings. The four term lengths are fixed in this preview; the numbers are the office's. */
function toRtoSet(months, key, raw) {
  const t = taRtoTerm(months), v = Number(raw);
  if (!t) return;
  TO.rtoStart ||= clone(TA.rto.terms);
  if (key === 'divisor') {
    if (!(v > 0)) return toast('A divisor has to be more than 0.'), render();
    t.divisor = Math.round(v * 1000) / 1000;
  } else if (key === 'downType') {
    t.downType = raw === 'percent' ? 'percent' : 'payments';
    t.down = t.downType === 'percent' ? 0.1 : 1;
  } else if (key === 'down') {
    if (t.downType === 'payments' ? !(v >= 1 && v <= 12) : !(v > 0 && v <= 50)) return toast(t.downType === 'payments' ? 'Use 1 to 12 payments.' : 'Use a percent from 1 to 50.'), render();
    t.down = t.downType === 'payments' ? Math.round(v) : Math.round(v * 10) / 1000;
  } else if (key === 'balloon') t.balloon = !!raw;
  else if (key === 'balloonPayments') t.balloonPayments = Math.max(0, Math.round(v) || 0);
  else if (key === 'epo') {
    if (String(raw).trim() !== '' && !(v > 0 && v <= 100)) return toast('Use a payoff percent from 1 to 100.'), render();
    t.epo = String(raw).trim() === '' ? null : Math.round(v * 10) / 1000;
  }
  toRtoSaved(`${months} months changed`);
}
function toRtoSaved(what) {
  taRtoSync();
  TO.rtoLog.unshift({ what, at: Date.now() });
  render();
  toast('Saved. The Sales desk figures payments with it now.');
}
function toRtoUseTurbo() {
  TO.rtoStart ||= clone(TA.rto.terms);
  for (const d of TA.rto.turbo) Object.assign(taRtoTerm(d.months) || {}, { divisor: d.divisor, downType: 'payments', down: d.down, epo: d.epo });
  toRtoSaved('Turbo Assist’s defaults put in for 24, 36 and 48 months');
}
function toRtoReset() {
  if (!TO.rtoStart) return;
  TA.rto.terms.splice(0, TA.rto.terms.length, ...clone(TO.rtoStart));
  TO.rtoStart = null;
  toRtoSaved('Back to the numbers from the public listing');
}
function toRtoPanel() {
  const price = 6018, same = (a, b) => Math.abs(a - b) < 0.0005, edited = !!TO.rtoStart;
  const num = (m, key, value, extra = '') => `<input type="number" value="${value}" ${extra} onchange="toRtoSet(${m},'${key}',this.value)">`;
  return `<section class="panel to-wide"><div class="panelhead"><h2>Rent-to-own terms</h2><span class="pill blue">${esc(TA.rto.provider)}</span></div>
    <p>The Sales desk figures every monthly payment from this table: the price divided by the divisor. ${taTip('rto-overview', 'How rent-to-own works')}</p>
    <div class="to-terms">${TA.rto.terms.map((t) => `<fieldset class="to-term"><legend>${t.months} months</legend>
      <label>Divisor${num(t.months, 'divisor', t.divisor, 'min="0.01" step="0.1" inputmode="decimal"')}</label>
      <label>Down Type<select onchange="toRtoSet(${t.months},'downType',this.value)"><option value="payments" ${t.downType === 'payments' ? 'selected' : ''}>Payments</option><option value="percent" ${t.downType === 'percent' ? 'selected' : ''}>Percentage</option></select></label>
      <label>Down Value${t.downType === 'payments' ? num(t.months, 'down', t.down, 'min="1" max="12" step="1" inputmode="numeric"') : num(t.months, 'down', toCents(t.down * 100), 'min="1" max="50" step="0.5" inputmode="decimal"')}</label>
      <label class="to-check"><input type="checkbox" ${t.balloon ? 'checked' : ''} onchange="toRtoSet(${t.months},'balloon',this.checked)"> Balloon?</label>
      <label>Balloon Pmts${num(t.months, 'balloonPayments', t.balloonPayments, `min="0" step="1" inputmode="numeric" ${t.balloon ? '' : 'disabled'}`)}</label>
      <label>Payoff percent<input type="number" value="${t.epo == null ? '' : toCents(t.epo * 100)}" min="1" max="100" step="1" inputmode="numeric" placeholder="Not set" onchange="toRtoSet(${t.months},'epo',this.value)"></label>
      <p class="to-termsay">${money(payment(price, t.months))} a month on a ${money(price)} building · ${t.downType === 'payments' ? toPlural(t.down, 'payment') : toCents(t.down * 100) + '%'} down</p></fieldset>`).join('')}</div>
    <h3>Turbo Assist’s built-in defaults</h3>
    <div class="to-tablewrap"><table class="to-table"><thead><tr><th>Months</th><th>Divisor</th><th>Down</th><th>Payoff</th><th>On ${money(price)}</th><th>This table</th></tr></thead><tbody>
      ${TA.rto.turbo.map((d) => { const t = taRtoTerm(d.months); return `<tr><td data-l="Months">${d.months}</td><td data-l="Divisor">${d.divisor}</td><td data-l="Down">${toPlural(d.down, 'payment')}</td><td data-l="Payoff">${Math.round(d.epo * 100)}%</td><td data-l="On ${money(price)}">${money(price / d.divisor)}</td><td>${same(t.divisor, d.divisor) ? '<span class="ops-flag ok">Same divisor</span>' : `<span class="ops-flag todo">${t.divisor} here</span>`}</td></tr>`; }).join('')}
      <tr><td data-l="Months">60</td><td colspan="4" class="of-soft">Turbo Assist has no 60-month default</td><td><span class="ops-flag todo">${taRtoTerm(60).divisor} here</span></td></tr></tbody></table></div>
    <p class="notice">Turbo Assist’s 36 and 48 month defaults (25.2 and 33.6) do not match the payments a public lot listing shows, which work out to 21.6 and 24.6. This preview started from the listing, with one payment down. Neither set is the contract: put the real ones in.</p>
    <div class="actions">${button('Use Turbo Assist’s defaults', 'toRtoUseTurbo()', 'secondary small')}${edited ? button('Back to the listing numbers', 'toRtoReset()', 'secondary small') : ''}</div>
    ${TO.rtoLog.length ? `<ul class="qc-log">${TO.rtoLog.slice(0, 4).map((x) => `<li><strong>${esc(x.what)}</strong><small>${ofStamp(x.at)}</small></li>`).join('')}</ul>` : ''}
    <p class="source">Sales Console pulls these term rows. Divisor and required down are managed here. Adding or removing a term length is done in Turbo Assist; this preview keeps 24, 36, 48 and 60 months.</p></section>`;
}

/* ---------- Hold, resubmit, cancel, approve, release: Turbo Assist's wording and notices ---------- */
{
  const baseHoldForm = ofHoldForm;
  ofHoldForm = function (id) {
    baseHoldForm(id);
    const s = ofSale(id), field = $('#of-hold-reason');
    if (field && s) field.placeholder = ofStage(s) === 'approved' ? 'What needs to change before this can be re-accepted?' : 'Ask the submitter to clarify the spec or fix data.';
  };
  /* Placed on hold: the person who submitted it gets Turbo Assist's notice. */
  const baseHoldSave = ofHoldSave;
  ofHoldSave = function (id) {
    const s = ofSale(id), was = s && ofStage(s), had = s?.office?.hold;
    baseHoldSave(id);
    const h = s?.office?.hold;
    if (!h || h === had) return;
    h.returned = was === 'approved';
    const here = taNotify({ to: 'sales', saleId: id, go: `openSale('${id}')`, title: `Order intake placed on hold (${TO_SOURCE[toSource(s)]})`, body: `Your order intake submission was placed on hold. Reason: "${h.reason}". Revise the order and resubmit to return it to the review queue.` });
    ofLog(s, here ? 'The salesperson was notified in the app' : `The salesperson at ${saleLot(s).town} was notified in the app`);
    render();
  };
  /* Submitted again: the office gets Turbo Assist's notice, with the reason it gave. */
  const baseSubmit = sfSubmit;
  sfSubmit = function () {
    const s = sfSale(), held = s?.office?.hold ? { ...s.office.hold } : null, before = s?.status;
    if (s && held) ofRec(s).firstSubmitted ||= s.submittedAt;
    baseSubmit();
    if (!s || !held || before !== 'Correction requested' || s.status !== 'Submitted · Awaiting review') return;
    taNotify({ to: 'office', saleId: s.id, go: `ofOpen('${s.id}')`, title: `Held order intake resubmitted (${TO_SOURCE[toSource(s)]})`, body: `An order intake you placed on hold has been resubmitted and is back in the review queue. Your hold reason was: "${held.reason}". Open the Order Intake panel to review the revised submission.` });
  };
  /* Cancel: Turbo Assist's two reasons as quick picks. Anything else can still be typed. */
  const baseCancelForm = ofCancelForm;
  ofCancelForm = function (id) {
    baseCancelForm(id);
    $('#of-cancel-reason')?.closest('label')?.insertAdjacentHTML('beforebegin', `<div class="of-feepick to-cancelpick">${['RTO Rejected', 'Customer Cancelled'].map((r) => `<button type="button" class="chipbtn" onclick="const f=document.getElementById('of-cancel-reason');f.value=this.textContent;f.focus()">${r}</button>`).join('')}</div>`);
  };
  const baseCancelSave = ofCancelSave;
  ofCancelSave = function (id) {
    const s = ofSale(id);
    baseCancelSave(id);
    const c = s?.office?.cancel;
    if (c && !c.kind) c.kind = toCancelKind(c);
  };
  /* Approve a custom order: Submit to build's own success line goes in the history. */
  const baseApprove = ofApprove;
  ofApprove = function (id) {
    const s = ofSale(id), was = s?.status;
    baseApprove(id);
    if (!s || s.status === was || s.status !== 'Processed · Sold' || s.path === 'lot') return;
    ofLog(s, 'Plant packet complete. Submitted to build (Order approved).');
    render();
  };
  /* Release: the ready-to-deliver timeline line. */
  const baseRelease = ofRelease;
  ofRelease = function (id) {
    const s = ofSale(id), was = !!s?.office?.released;
    baseRelease(id);
    if (!s || was || !s.office.released) return;
    ofLog(s, 'Marked ready to deliver. Logistics can pick up this deal when the building is finished.');
    render();
  };
  const baseAfter = ofAfterPanel;
  ofAfterPanel = function (s) {
    const o = s.office, stage = ofStage(s), id = s.id, built = ofBuilt(s);
    let add = '';
    if (stage === 'approved' && !o.released && s.path !== 'lot' && !built.ok)
      add += `<p class="to-why">${icon('lock', 15)}<span>Ready to deliver is available after the plant finishes this unit (Build complete / Ship from plant). Use Submit to build for paperwork.</span></p>`;
    if (stage === 'approved' && !o.released)
      add += `<p class="source">If this order is returned to hold it goes back to the lot. The building and its serial are kept for the next approval.</p>`;
    if (stage === 'delivered')
      add += o.rga
        ? ofCheckRow({ state: 'bad', title: `${TO_RGA[o.rga.status]} · ${ofStamp(o.rga.at)}`, text: `Serial ${esc(o.rga.serial)} · service job opened: ${esc(o.rga.title)}${o.rga.note ? ' · ' + esc(o.rga.note) : ''}` })
        : `<div class="actions"><button type="button" class="secondary small" onclick="toReturnForm('${id}')">Record a return or repossession</button></div>`;
    return add ? toBeforeLast(baseAfter(s), '</section>', add) : baseAfter(s);
  };
  const baseWhere = ofWhere;
  ofWhere = function (s) {
    const r = s.office?.rga;
    return baseWhere(s) + (r ? ` · ${r.status === 'repossessed' ? 'Repossessed' : 'Returned'} ${ofStamp(r.at)}` : '');
  };
}

/* ---------- Returns: repossessed or returned, and buildings that were not built here ---------- */
const TO_RGA = { repossessed: 'Repossessed unit', returned: 'Returned unit' };
const TO_ORIGIN = { repo_intake: ['Repo intake', 'REPO'], cash_purchase: ['Cash purchase', 'CASH'] };
const toSerialOf = (s) => s.serial || orderInvoice(s).serial || s.id;
/* Sentinel serials: the prefix, a dash and a four-digit counter (REPO-0042). */
const toSentinel = (prefix) => `${prefix}-${String(++TO.seq[prefix]).padStart(4, '0')}`;
function toReturnForm(id) {
  const s = ofSale(id), serial = toSerialOf(s);
  TO.rgaKind = ofRto(s) ? 'repossessed' : 'returned';
  const pick = (k, name, text) => `<button type="button" data-rga="${k}" class="${TO.rgaKind === k ? 'on' : ''}" onclick="TO.rgaKind='${k}';this.parentNode.querySelectorAll('button').forEach((b)=>b.classList.toggle('on',b===this));document.getElementById('to-rga-job').textContent=TO_RGA['${k}']+' — internal upgrade for ${esc(serial)}'"><strong>${name}</strong><small>${text}</small></button>`;
  modal('Record a return or repossession', `<p><strong>${esc(s.customer)}</strong> · ${esc(id)} · ${esc(label(s.c))} · serial ${esc(serial)}</p>
    <div class="of-seg two" role="group" aria-label="What happened">${pick('repossessed', 'Repossessed', 'The rent-to-own company took the building back.')}${pick('returned', 'Returned', 'The customer gave the building back.')}</div>
    <label class="field">Note (optional)<input id="to-rga-note" maxlength="120" placeholder="Example: picked up from the customer’s yard"></label>
    <p class="source">Turbo Assist marks the unit and opens a service job by itself, named: <b id="to-rga-job">${TO_RGA[TO.rgaKind]} — internal upgrade for ${esc(serial)}</b>. ${taTip('rto-rules', 'Repossession rules')}</p>
    <div class="actions">${button('Save', `toReturnSave('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function toReturnSave(id) {
  const s = ofSale(id), o = ofRec(s), kind = TO.rgaKind, serial = toSerialOf(s), title = `${TO_RGA[kind]} — internal upgrade for ${serial}`, note = $('#to-rga-note')?.value.trim() || '';
  o.rga = { status: kind, at: Date.now(), serial, title, note };
  const row = { kind, serial, saleId: id, at: Date.now(), title, what: label(s.c), where: lotTown(saleLot(s)), note, job: false };
  if (typeof taServiceAdd === 'function') row.job = !!taServiceAdd({ title, serial, kind, from: 'office', saleId: id });
  TO.returns.unshift(row);
  ofLog(s, `Office recorded the building as ${kind} · service job opened: ${title}`);
  closeModal();
  render();
  toast(row.job ? 'Recorded. The service job is on the Logistics side.' : 'Recorded. Turbo Service opens the job.');
}
/* A building that was not built here (a repo brought in, or one bought for cash) gets a REPO- or CASH- serial. */
function toEntrySave() {
  const what = $('#to-entry-what').value.trim(), lot = lotById($('#to-entry-lot').value), [name, prefix] = TO_ORIGIN[TO.entry];
  if (!what) return toast('Say what the building is, like 10x16 Lofted Barn.');
  const serial = toSentinel(prefix);
  TO.returns.unshift({ kind: TO.entry, serial, at: Date.now(), what, where: lotTown(lot), title: '', note: '', job: false });
  render();
  toast(`${name}: serial ${serial} issued.`);
}
function toReturnsBlock() {
  const say = { repossessed: 'Repossessed', returned: 'Returned', repo_intake: 'Repo intake', cash_purchase: 'Cash purchase' };
  return `<h2 class="sectionhead qc-group">Returns and buildings brought in <small>${TO.returns.length}</small></h2>
  <div class="ops-list">${TO.returns.map((r) => `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${esc(r.serial)}</strong><span class="serial">${esc(r.what)}</span><span class="pill ${r.title ? 'red' : 'blue'}">${say[r.kind]}</span>${r.sample ? '<span class="pill ghost">Sample</span>' : ''}</div>
      <p class="ops-rowsub">${esc(r.where)} · ${ofStamp(r.at)}${r.note ? ' · ' + esc(r.note) : ''}</p>
      <div class="ops-flags">${r.title ? `<span class="ops-flag wait">Service job: ${esc(r.title)}</span>` : '<span class="ops-flag ok">Joins that lot’s inventory under this serial</span>'}</div></div>
      ${r.saleId ? `<button type="button" class="secondary small" onclick="ofOpen('${r.saleId}')">Order</button>` : ''}</article>`).join('') || '<div class="panel emptystate"><strong>No returns</strong><p>A repossessed or returned building shows here with its service job.</p></div>'}</div>
  <section class="panel to-entry"><h3>Bring in a building that was not built here</h3>
    <div class="of-seg two" role="group" aria-label="Where it came from">${Object.entries(TO_ORIGIN).map(([k, [name, prefix]]) => `<button type="button" class="${TO.entry === k ? 'on' : ''}" onclick="TO.entry='${k}';render()"><strong>${name}</strong><small>${k === 'repo_intake' ? 'A repossessed building coming into inventory.' : 'A building bought for cash, such as a trade-in.'} Serial ${prefix}-####.</small></button>`).join('')}</div>
    <div class="of-inline"><label>What it is<input id="to-entry-what" maxlength="60" placeholder="Example: 10x16 Lofted Barn"></label><label>Lot<select id="to-entry-lot">${LOTS.map((l) => `<option value="${l.id}" ${l.id === DESK_LOT ? 'selected' : ''}>${esc(lotTown(l))}</option>`).join('')}</select></label>${button('Issue the serial', 'toEntrySave()', 'secondary small')}</div>
    <p class="source">A building made at the plant keeps its plant serial. One that was not gets the next ${TO_ORIGIN[TO.entry][1]}- number, so nobody mistakes it for a new build.</p></section>`;
}

/* ---------- Company bills: Turbo Ops "Obligations" ---------- */
const TO_BILL_KIND = { utility: 'Utility', internet: 'Internet / telecom', lease: 'Lease', mortgage: 'Mortgage', other: 'Other' };
const TO_BILL_SUB = { electricity: 'Electricity', water: 'Water', sewer: 'Sewer', gas: 'Natural gas', trash: 'Trash', other: 'Other utility' };
const TO_BILL_CADENCE = ['monthly', 'quarterly', 'yearly', 'weekly', 'other'];
const TO_BILL_STATUS = { active: ['Active', 'good'], ended: ['Ended', 'ghost'], draft: ['Draft', 'amber'] };
const TO_REMIND = ['Office manager', 'Bookkeeper', 'Plant manager', 'Owner'];
const TO_MONTHLY = /^(\d{1,2})(?:st|nd|rd|th)\s+of each month$/i;
const toOrdinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
/* The next due date a rule like "15th of each month" gives, and when its reminder goes out.
   A rule Turbo Assist cannot read stays text, with no reminder (nextMonthlyReminderAt). */
function toBillNext(b, now = new Date()) {
  const m = TO_MONTHLY.exec(String(b.due || '').trim()), day = m ? Number(m[1]) : 0;
  if (day < 1 || day > 28 || b.lead == null || b.status !== 'active') return null;
  for (let step = 0; step < 3; step++) {
    const due = new Date(now.getFullYear(), now.getMonth() + step, day, 13, 0, 0);
    if (due.getTime() >= now.getTime()) return { due, notify: new Date(due.getTime() - b.lead * 864e5), soon: due.getTime() - b.lead * 864e5 <= now.getTime() };
  }
  return null;
}
const toBillsSoon = () => TO.bills.filter((b) => toBillNext(b)?.soon);
const toBillDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
function toBillAdd(b, quiet) {
  const bill = { id: 'B' + ++TO.billSeq, status: 'active', cadence: 'monthly', lead: null, ...b };
  TO.bills.push(bill);
  const next = toBillNext(bill);
  /* Turbo Assist's reminder: "{provider} due soon", with the due rule and the days ahead. */
  if (next?.soon) taNotify({ to: 'office', go: "go('of-bills')", title: `${bill.provider} due soon`, body: `${bill.due}. ${bill.lead} day(s) ahead.`, at: quiet ? Math.min(next.notify.getTime(), Date.now() - 6e5) : Date.now() });
  return bill;
}
function toBillSave() {
  const v = (id) => $('#' + id).value.trim(), provider = v('to-b-provider'), leadText = v('to-b-lead'), lead = leadText === '' ? null : Number(leadText), kind = v('to-b-kind');
  if (!provider) return toast('Type who the bill is from.');
  if (lead != null && !(Number.isInteger(lead) && lead >= 0 && lead <= 90)) return toast('Days ahead has to be a whole number from 0 to 90.');
  const amount = v('to-b-amount') === '' ? null : toCents(Number(v('to-b-amount')));
  toBillAdd({ provider, kind, sub: kind === 'utility' ? v('to-b-sub') : null, where: v('to-b-where'), account: v('to-b-account'), about: v('to-b-about'), cadence: v('to-b-cadence'), due: v('to-b-due'), amount, paidTo: v('to-b-paid') || provider, remind: v('to-b-remind'), lead, status: v('to-b-status') });
  TO.billForm = false;
  render();
  toast(`${provider} added.`);
}
function toBillToggle(id) {
  const b = TO.bills.find((x) => x.id === id);
  b.status = b.status === 'active' ? 'ended' : 'active';
  render();
}
function toBillRow(b) {
  const next = toBillNext(b), [name, pill] = TO_BILL_STATUS[b.status];
  const flag = b.status !== 'active' ? `<span class="ops-flag">No reminders while ${name.toLowerCase()}</span>`
    : next ? `<span class="ops-flag ${next.soon ? 'todo' : 'ok'}">${next.soon ? 'Due soon' : 'Next due'} ${toBillDay(next.due)}</span><span class="ops-flag wait">${b.remind ? esc(b.remind) + ' is reminded' : 'Reminder'} ${toBillDay(next.notify)} · ${toPlural(b.lead, 'day')} ahead</span>`
    : `<span class="ops-flag">${b.lead == null ? 'No reminder set' : 'No reminder: the due rule is only text'}</span>`;
  return `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${esc(b.provider)}</strong><span class="serial">${TO_BILL_KIND[b.kind]}${b.sub ? ' · ' + TO_BILL_SUB[b.sub] : ''}</span><span class="pill ${pill}">${name}</span><span class="pill ghost">Sample</span></div>
    <p class="ops-rowsub">${esc(b.where)}${b.about ? ' · ' + esc(b.about) : ''}${b.account ? ' · account ' + esc(b.account) : ''} · ${b.amount == null ? 'amount varies' : money(b.amount)} ${esc(b.cadence)} · due: ${esc(b.due || 'not set')} · paid to ${esc(b.paidTo)}</p>
    <div class="ops-flags">${flag}</div></div>
    <button type="button" class="secondary small" onclick="toBillToggle('${b.id}')">${b.status === 'active' ? 'Mark ended' : 'Make active'}</button></article>`;
}
function officeBills() {
  const opt = (list, pick) => list.map(([k, n]) => `<option value="${esc(k)}" ${k === pick ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const places = ['Central office', ...PLANTS.map((p) => `${p.name}, ${p.town}`), ...LOTS.map((l) => `${lotTown(l)} lot`)].map((x) => [x, x]);
  const live = TO.bills.filter((b) => b.status === 'active'), monthly = live.filter((b) => b.cadence === 'monthly' && b.amount != null).reduce((t, b) => t + b.amount, 0);
  return `<button class="link backlink" onclick="go('office')">${icon('back', 18)} To do</button>
  ${head('Office', 'Company bills.', 'The power, water, internet, leases and loans the company pays, with a reminder before each one is due.')}
  <div class="today ops-tiles three"><div class="kpi"><strong>${live.length}</strong><span>active bills</span></div><div class="kpi"><strong>${toBillsSoon().length}</strong><span>due soon</span></div><div class="kpi"><strong>${money(monthly)}</strong><span>a month in fixed bills</span></div></div>
  <div class="ops-list">${TO.bills.map(toBillRow).join('')}</div>
  ${TO.billForm ? `<section class="panel to-billform"><h2>Add a bill</h2>
    <div class="fields"><label>Provider<input id="to-b-provider" maxlength="80" placeholder="Who the bill is from"></label>
      <label>Kind<select id="to-b-kind" onchange="document.getElementById('to-b-subwrap').hidden=this.value!=='utility'">${opt(Object.entries(TO_BILL_KIND), 'utility')}</select></label>
      <label id="to-b-subwrap">Utility<select id="to-b-sub">${opt(Object.entries(TO_BILL_SUB), 'electricity')}</select></label>
      <label>Location<select id="to-b-where">${opt(places, 'Central office')}</select></label>
      <label>Account<input id="to-b-account" maxlength="40" placeholder="Example: ending 0000"></label>
      <label>Description<input id="to-b-about" maxlength="80"></label>
      <label>Cadence<select id="to-b-cadence">${opt(TO_BILL_CADENCE.map((c) => [c, c]), 'monthly')}</select></label>
      <label>Due rule<input id="to-b-due" maxlength="60" placeholder="15th of each month"></label>
      <label>Amount ($)<input id="to-b-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Leave empty if it varies"></label>
      <label>Who is paid<input id="to-b-paid" maxlength="80" placeholder="Same as the provider"></label>
      <label>Remind this person<select id="to-b-remind">${opt(TO_REMIND.map((r) => [r, r]), 'Office manager')}</select></label>
      <label>Days ahead<input id="to-b-lead" type="number" min="0" max="90" step="1" inputmode="numeric" placeholder="0 to 90"></label>
      <label>Status<select id="to-b-status">${opt(Object.entries(TO_BILL_STATUS).map(([k, [n]]) => [k, n]), 'active')}</select></label></div>
    <p class="source">A due rule written like “15th of each month” (the 1st to the 28th) gets a reminder. Anything else is kept as text. This page is public: do not type a real account number.</p>
    <div class="actions">${button('Save the bill', 'toBillSave()')}${button('Cancel', 'TO.billForm=false;render()', 'secondary')}</div></section>`
    : `<div class="actions">${button('Add a bill', 'TO.billForm=true;render()', 'secondary')}</div>`}
  ${opsNotes([
    ['This screen', 'Ops, “Obligations” (<code>ops_obligations</code>): kinds <code>OPS_OBLIGATION_KINDS</code>, utility types <code>OPS_UTILITY_SUBTYPES</code>, cadences <code>OPS_OBLIGATION_CADENCES</code>, statuses active, ended, draft.'],
    ['The fields', '<code>OBLIGATION_TYPE_FIELDS</code>: Provider, Location, Account, Description, Cadence, Due rule, Amount, Who is paid, Remind this person, Days ahead.'],
    ['Reminders', '<code>nextMonthlyReminderAt</code> reads a rule like “15th of each month”; <code>syncObligationReminder</code> sends “{provider} due soon” in the app, 0 to 90 days ahead. Ended and draft bills send none.'],
    ['Who may set up bill types', '<code>OBLIGATION_TYPE_ADMIN_ROLES</code>: admins and owners only.'],
  ], ['Every bill here is made up. The fixed-bills total and the “due soon” tile are this preview’s; Turbo Assist lists the obligations and sends the reminders.'])}`;
}

/* ---------- Office home: Turbo Assist's summary counts and the daily digest ---------- */
/* The lots in Turbo Assist's own location list (src/config/locations.ts). */
const TO_TA_LOTS = ['Boiling Springs SC', 'Conway SC', 'Moncks Corner SC', 'Florence SC', 'Lugoff SC', 'Ravenel SC', 'Cottageville SC', 'Newberry SC', 'West Union SC', 'Longs SC', 'Lancaster SC', 'Greenwood SC', 'Graniteville SC', 'Brunswick GA', 'Vidalia GA', 'Statesboro GA', 'Conover NC', 'Goldsboro NC', 'Forest City NC', 'Lexington NC', 'Wilson NC', 'Orangeburg SC'];
function toLotGaps() {
  const web = LOTS.map((l) => `${l.town} ${l.state}`);
  return { web: LOTS.filter((l) => !TO_TA_LOTS.includes(`${l.town} ${l.state}`)), turbo: TO_TA_LOTS.filter((x) => !web.includes(x)) };
}
function toLotsList() {
  const g = toLotGaps();
  modal('Lots that do not line up', `<p>The lot list here is the website’s. Turbo Assist keeps its own list, and the two disagree.</p>
    <h3>On the website, not in Turbo Assist (${g.web.length})</h3><p>${g.web.map((l) => esc(lotTown(l))).join(' · ') || 'None'}</p>
    <h3>In Turbo Assist, not on the website (${g.turbo.length})</h3><p>${g.turbo.map((x) => esc(x.replace(/ (\w\w)$/, ', $1'))).join(' · ') || 'None'}</p>
    <p class="source">An order from a lot Turbo Assist does not know cannot be pinned to a seller location. Its own count, “unmapped host lots”, is the same idea for lots the inventory system knows.</p>`);
}
function toOpenTasks() {
  const q = OF.q, lot = OF.lot;
  Object.assign(OF, { q: '', lot: 'All' });
  const g = ofGroups();
  Object.assign(OF, { q, lot });
  return g.review.length + g.rto.length + g.pays.length + g.release.length + g.changes.length + g.stock.length;
}
function toSummary() {
  const chip = (n, one, many, fn, hot) => `<button type="button" class="chipbtn to-sum${hot && n ? ' hot' : ''}" onclick="${fn}"><span class="count">${n}</span>${n === 1 ? one : many}</button>`;
  return `<div class="to-summary" role="group" aria-label="Office summary">
    ${chip(toOverdue().length, 'overdue paperwork item', 'overdue paperwork items', 'toOverdueList()', true)}
    ${chip(toOpenTasks(), 'open task', 'open tasks', "document.getElementById('of-list')?.scrollIntoView({behavior:'smooth',block:'start'})")}
    ${chip(taNoticesFor('office').filter((n) => !n.read).length, 'unread notice', 'unread notices', 'taOpenNotices()')}
    ${chip(toLotGaps().web.length, 'lot not in Turbo Assist', 'lots not in Turbo Assist', 'toLotsList()')}
    ${chip(toBillsSoon().length, 'company bill due soon', 'company bills due soon', "go('of-bills')", true)}</div>`;
}
function toDigest() {
  const now = new Date(), day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), month0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const sent = ofAll().filter((s) => s.submittedAt).map((s) => ({ s, at: Date.parse(s.office?.firstSubmitted || s.submittedAt) }));
  const rank = (list) => Object.entries(list.reduce((m, { s }) => ((m[lotTown(saleLot(s))] = (m[lotTown(saleLot(s))] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const prior = sent.filter((x) => x.at >= prev.getTime() && x.at < day0.getTime()), mtd = sent.filter((x) => x.at >= month0.getTime());
  const prevDay = prev.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  return { label: prev.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }), prior: prior.length, priorRows: rank(prior), mtdRows: rank(mtd), closed: S.sales.filter((s) => s.deliveredAt === prevDay).length };
}
function toDigestCard() {
  const d = toDigest();
  return `<details class="panel to-digest" ${TO.digestOpen ? 'open' : ''} ontoggle="TO.digestOpen=this.open"><summary><strong>Daily ownership digest — ${esc(d.label)}</strong><small>What the owners are sent each morning</small></summary>
    <div class="to-digest-body"><p><b>Summary for ${esc(d.label)}</b></p>
      <p>Prior-day sales: ${toPlural(d.prior, 'order')} submitted</p>
      <ul>${d.priorRows.map(([lot, n]) => `<li>${esc(lot)} — ${n}</li>`).join('') || '<li>No orders submitted that day.</li>'}</ul>
      <p>Month-to-date leaderboard (orders submitted):</p>
      ${d.mtdRows.length ? `<ol>${d.mtdRows.slice(0, 10).map(([lot, n]) => `<li>${esc(lot)} — ${n}</li>`).join('')}</ol>` : '<p>No orders submitted yet this month.</p>'}
      ${d.closed ? `<p>Ops deals closed prior day: ${d.closed}</p>` : ''}
      <p>Great work yesterday — keep the momentum going today. Share your sales callouts in-app when you close a deal.</p>
      <p>Sales callouts: reply in-app via workplace messaging or your daily workflow — email reply is not required in v1.</p></div>
    <p class="source">Turbo Assist’s digest counts leads marked sent and ranks salespeople. This preview has orders, so it counts orders submitted and ranks lots.</p></details>`;
}

/* ---------- Settings: the rule set, who can do what, the fuel suggestion ---------- */
function toFuelSuggest() {
  const f = OF.set.fuel, was = ofFuelSay();
  Object.assign(f, { method: 'size', perSqFt: 0.3 });
  OF.set.fuelLog.unshift({ from: was, to: `by square foot · ${ofFuelSay()}`, at: Date.now() });
  render();
  toast(`Fuel surcharge is now ${ofFuelSay()} on every new building.`);
}
function toFuelNote() {
  const f = OF.set.fuel, on = f.method === 'size' && f.perSqFt === 0.3;
  return `<div class="to-suggest"><p><b>From the sample orders in Turbo Assist:</b> the fuel surcharge was $28.80 on an 8 × 12 and $36.00 on a 10 × 12, and the public builder showed $48 on a 10 × 16. All three are <b>$0.30 a square foot</b>, not a percent of the price.</p>
    ${on ? '<span class="ops-flag ok">In use now</span>' : button('Use $0.30 per sq ft', 'toFuelSuggest()', 'secondary small')}</div>`;
}
function toRulesPanel() {
  const name = (k) => TO_PAPER[k][0];
  return `<section class="panel"><h2>Paperwork each deal needs</h2>
    <p>Turbo Assist’s rule set. The order page lists these for each order and shows what is still missing.</p>
    <ul class="of-feelist to-rules"><li><span>Every deal</span><strong>${TO_PAPER_RULES.default_item_keys.map(name).join(' · ')}</strong></li>
      ${TO_PAPER_RULES.rules.map((r) => `<li><span>${r.say}</span><strong>${r.add_item_keys.map(name).join(' · ')}</strong></li>`).join('')}</ul>
    <p class="source">Each org can replace these rules. A document is missing, received, verified or waived. Document library categories: Forms, Order Forms, Waivers, Information, Policies, Archived.</p></section>`;
}
function toRolesPanel() {
  return `<section class="panel"><h2>Who can do what</h2>
    <p>This preview has no logins. In Turbo Assist the office’s work is split in two.</p>
    <ul class="of-feelist to-roles"><li><span><b>Reviewer</b><small>The person who works the review list</small></span><strong>Accept, hold or cancel an order · match the deal type · Submit to build · update paperwork · mark ready to deliver · write hold notes · ask for a salesperson to be linked</strong></li>
      <li><span><b>Manager</b><small>Admin, owner or trainer</small></span><strong>Everything a reviewer can, plus create or delete a deal, change the paperwork rules and templates, and change settings</strong></li>
      <li><span><b>Admin or owner only</b></span><strong>Set up the kinds of company bills</strong></li></ul>
    <p class="source">A reviewer sees Deals, Timeline, Tasks and Notifications. Settings, Books and Payables stay closed to them.</p></section>`;
}

/* ---------- Putting it on the screens ---------- */
{
  const baseHome = OPS_SCREENS.office;
  OPS_SCREENS.office = officeHome = function () {
    let html = baseHome();
    html = toBefore(html, '<div class="qc-filter">', toSummary());
    return toBeforeLast(html, '<details class="ops-notes"', toDigestCard());
  };
  const baseOrder = OPS_SCREENS['of-order'];
  OPS_SCREENS['of-order'] = officeOrder = function () {
    const s = ofSale(OF.id);
    let html = baseOrder();
    if (!s || !ofStage(s)) return html;
    html = toBefore(html, '<section class="panel"><h2>Delivery site</h2>', toPaperPanel(s));
    return toBefore(html, '<section class="panel"><h2>History</h2>', toIntakePanel(s));
  };
  const baseSettings = OPS_SCREENS['of-settings'];
  OPS_SCREENS['of-settings'] = officeSettings = function () {
    let html = baseSettings();
    html = html.replace('<p>Added to every new custom building automatically. An order keeps the amount it was sold with.</p>', (m) => m + toFuelNote());
    html = html.replace('Comes from a tax service, by delivery address. Not connected in this preview, so tax shows as “from the tax service”.', 'Typed by hand on each order for now, the way Turbo Assist’s calculator works. The automatic lookup by delivery address is planned and not started.');
    return toBeforeLast(html, '<details class="ops-notes"', `<div class="grid2 to-settings">${toRtoPanel()}${toRulesPanel()}${toRolesPanel()}</div>`);
  };
  const baseRequests = OPS_SCREENS['of-requests'];
  OPS_SCREENS['of-requests'] = officeRequests = function () {
    return toBeforeLast(baseRequests(), '<details class="ops-notes"', toReturnsBlock());
  };
  const baseNotesPage = OPS_SCREENS['of-notes'];
  OPS_SCREENS['of-notes'] = officeNotes = function () {
    return toBeforeLast(baseNotesPage(), '</div>', `<section class="panel"><h2>Added from Turbo Assist</h2><ul>
      <li>The paperwork each deal needs, from its rule set, and the signing status of each document.</li>
      <li>The intake wording: where an order came from, the notices when it is held and resubmitted, the two cancel reasons.</li>
      <li>The rent-to-own terms table, the summary counts, the daily digest and company bills.</li>
      <li>Returns and repossessions, with the service job Turbo Assist opens by itself.</li>
      <li>Sales tax typed by hand on an order, the way its calculator works until the lookup is built.</li></ul></section>`);
  };
  OPS_SCREENS['of-bills'] = officeBills;
  const baseDetail = opsDetail;
  opsDetail = function (page) {
    return page === 'of-bills' ? ['office', 'To do', 'Company bills'] : baseDetail(page);
  };
}

/* ---------- Product notes for the screens above ---------- */
taNotesFor('office', [
  ['The summary counts', 'Ops summary (<code>getSummary</code>): <code>overdue_paperwork_items</code> (missing and past <code>due_at</code>), <code>open_tasks_for_me</code>, <code>unread_notifications</code>, <code>unmapped_host_lots</code>.'],
  ['Daily ownership digest', '<code>buildOwnershipDigestContent</code>: “Prior-day sales”, “Month-to-date leaderboard”, “Ops deals closed prior day”, then the closing note.'],
], [
  'The due rule for paperwork (a day after the order is submitted). Turbo Assist lets a reviewer set <code>due_at</code> on each item and has no default.',
  'The digest counting orders by lot. Turbo Assist counts leads marked sent, by salesperson.',
  '“Lots not in Turbo Assist” compares the website’s lots with <code>src/config/locations.ts</code>. Four on each side do not line up.',
]);
taNotesFor('of-order', [
  ['Paperwork', '<code>evaluateManifestItemKeys</code> over <code>DEFAULT_PAPERWORK_RULES_DOC</code>; names from <code>DEFAULT_TEMPLATES</code>; each item is missing, received, verified or waived (<code>ops_deal_paperwork_items</code>).'],
  ['Signatures', 'Turbo Sign: contract <code>INSTANCE_STATUSES</code> (draft, sent, viewed, partially signed, signed, declined, expired, voided) and <code>SIGNER_STATUSES</code>; signer roles Customer, Co-signer, Dealer rep.'],
  ['Filed under', 'The default Drive folder recipe (<code>defaultDriveFolderRecipe</code>): Pending, Cancelled by reason and year, Delivered by sale path, year and month.'],
  ['Order intake', 'Source labels from <code>formatSourceLabel</code>; tabs Pending Review, On Hold, Accepted, Cancelled; events submitted, merged, accepted, on_hold, returned_to_hold, cancelled (<code>orderIntakeEventsRepo</code>).'],
  ['The five intake checks', '<code>buildIntakePaperworkChecks</code>; <code>intakePaperworkReadyForAccept</code> stops an accept only on a failed check.'],
  ['Hold and resubmit notices', '<code>notifyIntakePlacedOnHold</code> to the submitter and <code>notifyIntakeResubmitted</code> to the reviewer, word for word. The reason boxes use the review screen’s prompts.'],
  ['Cancel reasons', '“RTO Rejected” and “Customer Cancelled” (<code>DRIVE_MATCH_OPTIONS</code>).'],
  ['Approve', '<code>submitDealToBuild</code> answers “Plant packet complete. Submitted to build (Order approved).” An incomplete packet answers “Plant packet is incomplete. Upload or mark received: …”. An accepted intake reads “Accepted. Continue this customer in Deals. Return to hold sends the intake back and archives that deal; the unit and serial stay for a later accept.”'],
  ['Release', '<code>readyToDeliverBlockedReason</code> and <code>readyToDeliverTimelineBody</code>, word for word.'],
  ['Sales tax', 'The calculator’s typed <code>Tax %</code>. Planned: <code>docs/planning/rto_tax_lookup.md</code> (not started), with the badges “auto · X%”, “manual (auto: X%)” and “no lookup”.'],
  ['Down payments at signing', 'The term’s Down Type and Down Value from the RTO Terms table (<code>loadRtoTermsForOrg</code>), figured the way <code>SalesConsoleRtoCalculatorSection</code> does.'],
  ['Return or repossession', 'Unit status <code>repossessed</code> or <code>returned</code>; <code>buildManufacturingAutoDescription</code> names the service job that opens by itself.'],
], [
  'Tying each paperwork line to a signature, a payment or the build sheet. In Turbo Assist a person uploads the file or marks it received.',
  'The delivery receipt on every delivery. The rule set asks for the happy sheet only on a sale from inventory.',
  'What the tax is figured on (the order total before tax). No plan says which lines are taxable.',
  'A short first payment is flagged, not blocked, the same as a short cash deposit.',
]);
taNotesFor('of-settings', [
  ['Rent-to-own terms', 'Ops, RTO Terms (<code>RtoSettingsOrgTermsEditor</code>): Months, Divisor, Down Type, Down Value, Balloon?, Balloon Pmts, and payoff percent by state. Defaults: <code>DEFAULT_RTO_TERMS</code>.'],
  ['Paperwork each deal needs', '<code>DEFAULT_PAPERWORK_RULES_DOC</code>; an org’s own rules live in <code>ops_paperwork_rule_sets</code>.'],
  ['Who can do what', '<code>OPS_REVIEWER_ROLES</code>, <code>opsReviewerMayWrite</code> and <code>OPS_PAPERWORK_UI_MANAGE_ROLES</code>.'],
], [
  'The fuel surcharge suggestion: $0.30 a square foot is read from three sample orders, not from a written rule.',
  'In this preview a changed divisor also refigures orders already written. A real order keeps the terms it was signed with.',
  'One payoff percent per term. Turbo Assist can also override it by state.',
]);
taNotesFor('of-requests', [
  ['Returns', 'Unit statuses <code>repossessed</code> and <code>returned</code> (<code>MFG_UNIT_RGA_SERVICE_STATUSES</code>) open a Turbo Service request by themselves.'],
  ['Bring in a building that was not built here', 'Fulfillment, New inventory: origins <code>repo_intake</code> and <code>cash_purchase</code> get a REPO- or CASH- serial (<code>sentinelPrefixForOrigin</code>).'],
], ['The list of returns in one place with change orders and stock orders.']);
taNotesFor('of-pay', [], ['With a tax percent typed on an order, the balance due and the amount a driver collects include the tax.']);

/* ---------- Sample data ---------- */
(function seedTurboOffice() {
  const ago = (h) => Date.now() - h * 36e5, stamp = (t) => ofStamp(t);
  /* One order that was held and came back, so the intake record and the office bell have a real example. */
  const robin = ofSale('FLO-2121');
  if (robin) {
    const o = ofRec(robin), lot = saleLot(robin);
    o.firstSubmitted = new Date(ago(23)).toISOString();
    o.holds.push({ reason: 'Customer or delivery address is incomplete', note: '', at: ago(20), cleared: ago(5) });
    robin.events = [
      { time: stamp(ago(24)), text: `Order created by ${robin.agent} at ${lot.town}` },
      { time: stamp(ago(23.5)), text: 'Customer signed the invoice, terms and delivery agreement' },
      { time: stamp(ago(23)), text: 'Submitted to administrator for review' },
      { time: stamp(ago(20)), text: 'Office placed the order on hold: Customer or delivery address is incomplete' },
      { time: stamp(ago(20)), text: `The salesperson at ${lot.town} was notified in the app` },
      { time: stamp(ago(5)), text: 'Submitted to administrator for review' },
    ];
    taNotify({ to: 'office', saleId: robin.id, go: `ofOpen('${robin.id}')`, at: ago(5), title: `Held order intake resubmitted (${TO_SOURCE[toSource(robin)]})`, body: 'An order intake you placed on hold has been resubmitted and is back in the review queue. Your hold reason was: "Customer or delivery address is incomplete". Open the Order Intake panel to review the revised submission.' });
  }
  /* Made-up bills. The first is always a few days out, so there is one reminder to look at. */
  const soon = new Date(Date.now() + 3 * 864e5), soonDay = Math.min(soon.getDate(), 28);
  toBillAdd({ provider: 'Sample Power Co-op', kind: 'utility', sub: 'electricity', where: 'Central office', account: 'ending 0417', about: 'Office and yard lights', due: `${toOrdinal(soonDay)} of each month`, amount: 412.5, paidTo: 'Sample Power Co-op', remind: 'Office manager', lead: 5 }, true);
  toBillAdd({ provider: 'Sample Fiber', kind: 'internet', where: 'Central office', account: 'ending 2290', about: 'Internet and phones', due: '1st of each month', amount: 189, paidTo: 'Sample Fiber', remind: 'Bookkeeper', lead: 3 }, true);
  toBillAdd({ provider: 'Sample Land Trust', kind: 'lease', where: 'Moncks Corner, SC lot', about: 'Lot lease', due: '28th of each month', amount: 2400, paidTo: 'Sample Land Trust', remind: 'Owner', lead: 7 }, true);
  toBillAdd({ provider: 'Sample County Water', kind: 'utility', sub: 'water', where: `${PLANTS[0].name}, ${PLANTS[0].town}`, cadence: 'quarterly', due: 'Net 20 after the quarter ends', amount: null, paidTo: 'Sample County Water', remind: 'Plant manager', lead: 10 }, true);
  toBillAdd({ provider: 'Sample Waste Hauling', kind: 'utility', sub: 'trash', where: `${PLANTS[0].name}, ${PLANTS[0].town}`, due: '10th of each month', amount: 96, paidTo: 'Sample Waste Hauling', remind: 'Plant manager', lead: 2, status: 'ended' }, true);
  /* Two made-up records so the returns list is not empty. */
  TO.returns.push(
    { kind: 'repossessed', serial: 'SAMPLE-1016-0877', at: ago(150), what: '10x16 Basic Utility', where: 'Lugoff, SC', title: 'Repossessed unit — internal upgrade for SAMPLE-1016-0877', note: 'Came back from a rent-to-own customer', job: false, sample: true },
    { kind: 'repo_intake', serial: 'REPO-0041', at: ago(300), what: '12x20 Classic Lofted', where: 'Conway, SC', title: '', note: 'Bought at a repo sale', job: false, sample: true },
  );
})();
