/* office-polish.js: the remaining Office items from the owner's review (Nov 16, 2026).

   Office findings 7, 10, 11, 14 to 22:
    1. "Not received", "Decline" and "Accept removal" ask first, ask for a reason, and keep the record.
    2. On a phone the Model pricing tabs wrap, and a bar says how many changes are waiting.
    3. A price change on an order the customer already signed takes the signature off and says so.
    4. (In admin.js) a read-only person can open the look-only pop-ups.
    5. A cancelled order can be reopened, and offers no money buttons except the refund.
    6. One name for each step; system words are tucked into the builder notes.
    7. The To do tile and its list show the same count; search and the lot filter cover requests.
    8. A new person needs a name and an email nobody else has; an access history says who changed what.
    9. Settings are in sections, save the same way, and the out-of-date lines are fixed.
   10. A lot's own prices are marked, listed in one place, and can go back to the main list.
   11. Small polish: money shown as $12,090, "1 price changed", a question before a draft is thrown away.
   Written for a reader with a 5th grade education and no technical knowledge.
   Loaded after office-link.js. Wraps the office and admin functions. */

const OP = { pending: null, setTab: 'prices', priceBack: 'of-users', accessLog: [], sure: false };
const opWho = () => (typeof adMe === 'function' ? adMe().name : 'Office');
const opAsks = () => !(typeof OG !== 'undefined' && OG.live); /* checks that are not about these questions switch them off */
const opCents = (n) => Math.round(n * 100) / 100;
const opPlural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* One small pop-up that asks why, used by every "are you sure" below. */
function opAskWhy(title, body, yes, fn, placeholder = 'Type the reason') {
  OP.pending = fn;
  modal(title, `${body}<label class="field">Reason (needed)<input id="op-why" maxlength="140" placeholder="${esc(placeholder)}"></label>
    <div class="actions">${button(yes, 'opWhyGo()')}${button('Go back', 'closeModal()', 'secondary')}</div>`);
  $('#op-why')?.focus();
}
function opWhyGo() {
  const why = $('#op-why')?.value.trim(), fn = OP.pending;
  if (!why) return toast('Type the reason first.');
  OP.pending = null;
  closeModal();
  if (fn) fn(why);
}

/* ---------- 1. Ask first, ask why, keep the record ----------
   Turbo Assist: deactivateMembership keeps a removed person (never erased). A payment marked not
   received and a declined request kept with a reason are features the product still has to accept. */
{
  const baseDrop = ofDropPay;
  ofDropPay = function (id, i) {
    if (typeof adCan === 'function' && !adCan('payments')) return baseDrop.apply(this, arguments); /* says "read only" */
    const s = ofSale(id), p = s?.money.payments[i];
    if (!p) return;
    const drop = (why) => {
      s.money.payments.splice(s.money.payments.indexOf(p), 1);
      (s.money.dropped ||= []).push({ ...p, reason: why, by: opWho(), droppedAt: Date.now() });
      ofLog(s, `Office marked ${money(p.amount)} (${p.method.toLowerCase()}) not received: ${why}`);
      render();
      toast('Marked not received. The record stays on the order.');
    };
    if (!opAsks()) return drop('No reason given');
    opAskWhy('Mark this payment not received?', `<p><strong>${money(p.amount)}</strong> · ${esc(p.method)} · ${esc(s.customer)} · ${esc(id)}</p>
      <p>The order will show this money as missing. The payment is not erased: it stays on the order, marked “not received”.</p>`, 'Mark not received', drop, 'Example: not in the bank deposit');
  };
  const baseMoney = ofMoneyPanel;
  ofMoneyPanel = function (s) {
    let html = baseMoney(s);
    const gone = s.money?.dropped || [];
    if (gone.length)
      html = html.replace(/<div class="od-kv "><span>(Paid|Received from the customer)<\/span>/, (m) => gone.map((p) => odRow(`${esc(p.method)} · ${ofStamp(p.at)} <em class="of-soft">not received: ${esc(p.reason)} · ${esc(p.by)}</em>`, `<s>${money(p.amount)}</s>`, 'sub op-gone')).join('') + m);
    return html;
  };
}
/* A lot's request: declined with a reason, and kept in a "Declined" list. */
function opDecline(kind, n) {
  const x = kind === 'change' ? S.changes[n] : S.stock[n];
  if (!x) return;
  const name = kind === 'change' ? `Change order ${x.id}` : `Stock order ${x.id}`;
  const go = (why) => {
    if (kind === 'change') Object.assign(x, { declined: true, declineReason: why, declinedBy: opWho() }), x.log.push(new Date().toISOString());
    else Object.assign(x, { status: 'Declined', declined: { reason: why, by: opWho(), at: Date.now() } });
    const s = kind === 'change' ? ofSale(x.order) : null;
    if (s) ofLog(s, `Office declined change order ${x.id}: ${why}`);
    if (typeof taNotify === 'function') taNotify({ to: 'sales', saleId: s?.id, go: s ? `openSale('${s.id}')` : "go('stock')", title: `${name} was declined`, body: `The office said no. Reason: “${why}”.` });
    render();
    toast(`${name} declined. The lot is told why.`);
  };
  if (!opAsks()) return go('No reason given');
  opAskWhy(`Decline ${name.toLowerCase()}?`, `<p><strong>${esc(kind === 'change' ? x.what : x.name || label(x.c))}</strong></p><p>The lot is told it was declined, and why. The request is kept in the Declined list.</p>`, 'Decline it', go, 'Example: the building is already built');
}
{
  const baseChange = ofChangeRow;
  ofChangeRow = function (c) {
    return baseChange(c).replace(/onclick="declineChange\((\d+)\)"/, 'onclick="opDecline(\'change\',$1)"');
  };
  const baseStock = ofStockRow;
  ofStockRow = function (r) {
    return baseStock(r).replace(/onclick="cancelStock\((\d+)\);toast\('Stock order declined\.'\)"/, 'onclick="opDecline(\'stock\',$1)"');
  };
}
function opDeclinedBlock() {
  const ch = S.changes.filter((c) => c.declined && c.declineReason && ofMine(c)), st = S.stock.filter((r) => r.status === 'Declined' && ofMine(r));
  if (!ch.length && !st.length) return '';
  const row = (title, sub, why, by) => `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${title}</strong><span class="pill ghost">Declined</span></div><p class="ops-rowsub">${sub}</p><div class="ops-flags"><span class="ops-flag">Why: ${esc(why)} · ${esc(by)}</span></div></div></article>`;
  return `<h2 class="sectionhead qc-group">Declined <small>${ch.length + st.length} kept</small></h2><div class="ops-list op-declined">
    ${ch.map((c) => row(`Change order ${esc(c.id)}`, esc(c.what), c.declineReason, c.declinedBy)).join('')}${st.map((r) => row(`Stock order ${esc(r.id)}`, esc(r.name || label(r.c)) + ' · ' + esc(r.location) + ' lot', r.declined.reason, r.declined.by)).join('')}</div>`;
}
/* Removing a person for good: ask first and ask why. The person is kept, marked "Deleted". */
{
  const baseDecide = adDecide;
  adDecide = function (id, accept) {
    const u = adUser(id);
    /* Nothing to ask when the rules below will say no anyway (the one who asked cannot also agree). */
    if (!accept || !opAsks() || !u || !adIsSuper() || (u.kind === 'super' && u.removal?.by === AD.me)) return opTrack(u, () => baseDecide.apply(this, arguments));
    opAskWhy(`Remove ${esc(u.name)} for good?`, `<p>${esc(u.name)} will not be able to sign in again.</p><p>The record is not erased. It stays in the Removed list, marked “Deleted”, so it can be looked up later.</p>`, 'Remove for good', (why) => {
      opTrack(u, () => baseDecide.call(this, id, true));
      if (u.status === 'deleted' && u.removal) u.removal.finalReason = why;
      render();
    }, 'Example: left the company');
  };
}

/* ---------- 2 and 11. Model pricing: tabs fit a phone, a "changes waiting" bar, plain money ----------
   Turbo Assist: the org price book (server/orgPricingCsv.ts, resolve_pricing). */
function opDraftDrop() {
  if (!AD.draft.length) return;
  if (!opAsks()) return (AD.draft = []), render();
  modal('Throw the draft away?', `<p>${opPlural(AD.draft.length, 'price change')} will be lost. The live prices stay as they are.</p>
    <div class="actions">${button('Throw it away', 'AD.draft=[];closeModal();render();toast("Draft thrown away. No price changed.")')}${button('Keep the draft', 'closeModal()', 'secondary')}</div>`);
}
const opNum = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
{
  const baseInput = adPriceInput;
  adPriceInput = function (d, current, label) {
    const dr = adDraftOf(d), shown = dr ? dr.new : current;
    return baseInput(d, current, label).replace(/<input type="number" min="0" step="1" inputmode="decimal" value="[^"]*"([^>]*)>/, (m, rest) => `<span class="op-money"><span class="op-dollar">$</span><input type="text" inputmode="decimal" value="${shown == null ? '' : opNum(shown)}"${rest}></span>`);
  };
  const basePrice = adPrice;
  adPrice = function (d, raw, quiet) {
    return basePrice.call(this, d, typeof raw === 'string' ? raw.replace(/[$,\s]/g, '') : raw, quiet);
  };
  const baseDraft = adDraftTab;
  adDraftTab = function () {
    return baseDraft()
      .replace(/<p><b>1<\/b> prices changed: (\d+) up, (\d+) down\./, '<p><b>1</b> price changed: $1 up, $2 down.')
      .replace(`onclick="AD.draft=[];render()"`, 'onclick="opDraftDrop()"');
  };
  const basePrices = OPS_SCREENS['of-prices'];
  OPS_SCREENS['of-prices'] = function () {
    const back = { 'of-settings': 'Settings', 'of-users': 'Users and permissions' }[OP.priceBack] || 'Users and permissions', n = AD.draft.length;
    let html = basePrices.apply(this, arguments);
    html = html.replace(/<button class="link backlink" onclick="go\('of-users'\)">([\s\S]*?) Users and permissions<\/button>/, `<button class="link backlink" onclick="go('${OP.priceBack}')">$1 Back to ${back}</button>`);
    if (n && AD.tab !== 'draft')
      html = html.replace('<section class="panel ad-prices">', `<div class="op-waiting" role="status"><span><strong>${opPlural(n, 'change')} waiting</strong> Nothing is live until you publish.</span><button type="button" class="primary small" onclick="AD.tab='draft';render()">Review</button></div><section class="panel ad-prices">`);
    return html;
  };
  const baseDetail = opsDetail;
  opsDetail = function (page) {
    if (page === 'of-prices') return [OP.priceBack, OP.priceBack === 'of-settings' ? 'Settings' : 'Users', 'Model pricing'];
    if (page === 'of-bills') return null; /* Company bills is in the menu now */
    return baseDetail(page);
  };
  const baseGo = go;
  go = function (page) {
    if (page === 'of-prices' && ['of-settings', 'of-users'].includes(S.page)) OP.priceBack = S.page;
    return baseGo.apply(this, arguments);
  };
}

/* ---------- 10. A lot's own prices: marked, listed, and a way back to the main list ----------
   Turbo Assist: "Subscriber MSRP overrides" (OrgSettingsSectionPricingOverrides). */
function opOwnPrices() {
  const out = [];
  for (const [lot, map] of Object.entries(AD.over))
    for (const [key, price] of Object.entries(map)) {
      const item = key.startsWith('item|'), [model, size] = item ? ['item', key.slice(5)] : key.split('|');
      const main = item ? adItem(size)?.price : PRICE_LIST[model]?.[size];
      if (main == null || price === main) continue;
      out.push({ lot, model, size, price, main, name: item ? size : `${model} ${size.replace('x', ' × ')}` });
    }
  return out.sort((a, b) => lotById(a.lot).town.localeCompare(lotById(b.lot).town) || a.name.localeCompare(b.name));
}
function opBackToMain(lot, model, size) {
  const main = model === 'item' ? adItem(size)?.price : PRICE_LIST[model]?.[size];
  if (main == null) return;
  adPrice({ kind: 'lot', lot, model, size }, main);
  toast('Added to the draft. It goes back to the main list price when you publish.');
}
function opOwnList() {
  const rows = opOwnPrices();
  return `<section class="op-own"><h3 class="ad-w">Lots with their own prices <small>${rows.length}</small></h3>
    ${rows.length ? `<ul class="pricelines op-ownlist">${rows.map((r) => {
      const diff = opCents(r.price - r.main), waiting = adDraftOf({ kind: 'lot', lot: r.lot, model: r.model, size: r.size });
      return `<li><span><strong>${esc(lotById(r.lot).town)}</strong> · ${esc(r.name)}</span><strong>${money(r.price)} <small class="op-diff">main list ${money(r.main)} · ${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}</small>
        ${waiting ? '<em class="og-flag">Change waiting in the draft</em>' : adCan('pricing') ? `<button type="button" class="link inline" onclick='opBackToMain(${esc(JSON.stringify(r.lot))},${esc(JSON.stringify(r.model))},${esc(JSON.stringify(r.size))})'>Back to the main list</button>` : ''}</strong></li>`;
    }).join('')}</ul>` : '<p class="muted">Every lot sells at the main list price.</p>'}</section>`;
}
{
  const baseLot = adLotTab;
  adLotTab = function () {
    const lot = AD.lot || DESK_LOT;
    let html = baseLot().replace(/<p class="ad-hint">[\s\S]*?has its own price on:[\s\S]*?<\/p>/, '');
    /* Mark each cell that is this lot's own price. */
    html = html.replace(/<label class="ad-cell( changed)?"><span>([\d]+ × [\d]+)<\/span>/g, (m, ch, size) => {
      const key = AD.model + '|' + size.replace(' × ', 'x'), own = AD.over[lot]?.[key], main = PRICE_LIST[AD.model]?.[size.replace(' × ', 'x')];
      return own != null && own !== main ? `<label class="ad-cell${ch || ''} op-owncell"><span>${size} <em>this lot’s own price · main list ${money(main)}</em></span>` : m;
    });
    return opOwnList() + html;
  };
  /* A lot price published back to the main list price stops being the lot's own price. */
  const baseApply = adApply;
  adApply = function (changes) {
    baseApply(changes);
    for (const d of changes) {
      if (d.kind !== 'lot') continue;
      const key = d.model + '|' + d.size, main = d.model === 'item' ? adItem(d.size)?.price : PRICE_LIST[d.model]?.[d.size];
      if (AD.over[d.lot]?.[key] === main) delete AD.over[d.lot][key];
    }
  };
}
/* The Published list: each set opens to show the old and the new price of every line. */
function opPublishedDetails() {
  if (S.page !== 'of-prices' || AD.tab !== 'draft') return;
  const heads = [...document.querySelectorAll('.ad-prices h3.ad-w')], h = heads.find((x) => x.textContent.trim() === 'Published');
  if (!h) return;
  let el = h.nextElementSibling, i = 0;
  while (el && el.classList.contains('ad-set')) {
    const s = AD.log[i++];
    if (s && !el.querySelector('.op-setlines'))
      el.insertAdjacentHTML('beforeend', `<details class="op-setlines"><summary>See the ${opPlural(s.changes.length, 'price')}: old and new</summary><ul class="pricelines">${s.changes.map((d) => `<li><span>${esc(adChangeName(d))}</span><strong><s>${money(d.old)}</s> ${money(d.new)}</strong></li>`).join('')}</ul></details>`);
    el = el.nextElementSibling;
  }
}

/* ---------- 3. A signed order's price changes: the signature comes off, and the order says so ----------
   Turbo Assist: the signed invoice (order_sign_instances). A new signature after a price change is a
   feature the product still has to accept. The Sales desk's own lock is sfUnsignAsk in sale-flow.js. */
const opSigned = (s) => !!s && !s.invoice && !!s.signed?.invoice;
const opPrice = (s) => opCents(ofTotals(s).total);
function opUnsign(s, was, why) {
  delete s.signed.invoice;
  if (s.signatures) delete s.signatures.invoice;
  ofRec(s).resign = { at: Date.now(), by: opWho(), why, was, now: opPrice(s) };
  ofLog(s, `The price changed after the customer signed (${why}): ${money(was)} to ${money(opPrice(s))}. The invoice needs a new signature.`);
  if (typeof taNotify === 'function') taNotify({ to: 'sales', saleId: s.id, go: `openSale('${s.id}')`, title: `${s.customer}: the invoice needs a new signature`, body: `The office changed the price after the customer signed (${why}). It was ${money(was)} and is ${money(opPrice(s))} now. Have the customer sign the invoice again.` });
}
const OP_PRICE_FNS = {
  ofFuelApply: 'fuel surcharge added', ofDiscountSave: 'discount added', ofDiscountDrop: 'discount removed', ofFeeSave: 'delivery charge added', ofFeeDrop: 'delivery charge removed',
  ofGapSave: 'price set to the price list', ofUseList: 'price set to the price list', ofChangeOk: 'change order approved', siteSave: 'delivery answers changed',
};
const opSaleOf = (name, args) => (name === 'ofChangeOk' ? ofSale(S.changes[args[0]]?.order) : name === 'siteSave' ? (typeof SITE_EDIT !== 'undefined' ? SITE_EDIT?.sale : null) : ofSale(args[0]));
for (const [name, why] of Object.entries(OP_PRICE_FNS)) {
  const base = window[name];
  if (typeof base !== 'function') continue;
  window[name] = function (...args) {
    const s = opSaleOf(name, args), signed = opSigned(s), was = signed ? opPrice(s) : 0;
    /* One click and no form: ask before it touches a signed price. */
    if (name === 'ofFuelApply' && signed && opAsks() && !OP.sure) {
      const amount = ofFuelFor(s.c, s.total);
      if (amount != null)
        return modal('The customer already signed this price', `<p>Adding <strong>${money(amount)}</strong> changes the price ${esc(s.customer)} signed.</p><p>If you add it, the signature comes off the invoice and the lot has to get it signed again.</p>
          <div class="actions">${button('Add it and ask for a new signature', `OP.sure=true;closeModal();ofFuelApply('${s.id}');OP.sure=false`)}${button('Leave the price alone', 'closeModal()', 'secondary')}</div>`);
    }
    const out = base.apply(this, args);
    if (signed && opSigned(s) && Math.abs(opPrice(s) - was) > 0.004) {
      opUnsign(s, was, why);
      render();
      toast('The price changed, so the customer has to sign the invoice again. The lot has been told.');
    }
    return out;
  };
}
{
  const baseRow = ofRow;
  ofRow = function (s, extra = '') {
    return baseRow(s, (s.office?.resign ? '<span class="ops-flag bad">Needs a new signature</span>' : '') + extra);
  };
  const baseCan = ofCanRelease;
  ofCanRelease = function (s) {
    const out = baseCan(s);
    return s.office?.resign && ofStage(s) === 'approved' && !s.office.released ? { ok: false, why: 'The customer has to sign the invoice again first' } : out;
  };
  const baseChecks = ofChecks;
  ofChecks = function (s) {
    const out = baseChecks(s), r = s.office?.resign;
    if (r) out.unshift({ key: 'resign', short: 'New signature', title: 'Needs a new signature', must: true, state: 'bad', text: `The price changed after the customer signed (${esc(r.why)}). The lot has to get the invoice signed again.`, hold: 'The invoice needs a new signature' });
    return out;
  };
  /* The Sales desk: the invoice step opens again so the customer can sign the new price. */
  const baseSteps = sfSteps;
  sfSteps = function (s) {
    const out = baseSteps(s), r = s.office?.resign;
    if (r) {
      const row = out.desk.find((x) => x.title === 'Customer signs the invoice');
      if (row) Object.assign(row, { on: false, text: `The office changed the price after signing (${esc(r.why)}): ${money(r.was)} is ${money(r.now)} now. The customer has to sign again.`, act: `<button type="button" class="primary small" onclick="sfSignDoc('invoice')">Sign again</button>` });
    }
    return out;
  };
  const baseSign = sfSign;
  sfSign = function (kind) {
    const s = sfSale(), had = kind === 'invoice' && s?.office?.resign;
    baseSign.apply(this, arguments);
    if (had && s.signed?.invoice) {
      s.office.resign = null;
      if (typeof taNotify === 'function') taNotify({ to: 'office', saleId: s.id, go: `ofOpen('${s.id}')`, title: `${s.customer} signed the new price`, body: 'The invoice is signed again. The order can move on.' });
      render();
    }
  };
}

/* ---------- 5. A cancelled order can be reopened; no money buttons except the refund ----------
   Turbo Assist: cancelIntake has no way back yet, so reopening is a feature the product still has to accept. */
{
  const baseCancel = ofCancelSave;
  ofCancelSave = function (id) {
    const s = ofSale(id), lotWas = s?.path === 'lot' ? lots[s.lot]?.status : null, was = s?.status, fulfil = s?.fulfillment;
    baseCancel.apply(this, arguments);
    if (s?.office?.cancel && s.status === 'Cancelled') Object.assign(s.office.cancel, { lotWas, statusWas: was, fulfilWas: fulfil, by: opWho() });
  };
}
function opReopenForm(id) {
  const s = ofSale(id);
  if (!s || ofStage(s) !== 'cancelled') return;
  if (s.path === 'lot' && lots[s.lot] && lots[s.lot].status !== 'Available') return toast('That building is no longer free on the lot, so this order cannot be reopened.');
  opAskWhy('Reopen this order?', `<p><strong>${esc(s.customer)}</strong> · ${esc(id)} · ${esc(label(s.c))}</p><p>It goes back to the “To review” list so the office can look at it again.</p>`, 'Reopen the order', (why) => {
    const o = ofRec(s), c = o.cancel || {};
    (o.cancels ||= []).push({ ...c, reopened: { at: Date.now(), by: opWho(), reason: why } });
    o.cancel = null;
    o.approved = null;
    s.status = 'Submitted · Awaiting review';
    s.fulfillment = 'Review pending';
    if (s.path === 'lot' && lots[s.lot]) lots[s.lot].status = c.lotWas && c.lotWas !== 'Available' ? c.lotWas : 'Sold';
    ofLog(s, `Office reopened the order: ${why}`);
    if (typeof taNotify === 'function') taNotify({ to: 'sales', saleId: s.id, go: `openSale('${s.id}')`, title: `${s.customer}: the order was reopened`, body: `The office reopened the cancelled order. Reason: “${why}”. It is back in review.` });
    render();
    toast('Order reopened. It is back in “To review”.');
  }, 'Example: the customer changed their mind');
}
{
  const baseMoney = ofMoneyPanel;
  ofMoneyPanel = function (s) {
    let html = baseMoney(s);
    if (ofStage(s) !== 'cancelled') return html;
    const t = ofTotals(s);
    html = html.replace(/<button type="button" class="link inline" onclick="ofFuelApply\([^)]*\)">[\s\S]*?<\/button>/, '<span class="of-soft">Not added</span>')
      .replace(/<div class="actions">(?:<button type="button" class="secondary small" onclick="of(?:PayForm|DiscountForm|FeeForm)\([^)]*\)">[^<]*<\/button>)+<\/div>/, '');
    const refund = t.paid > 0 ? `<div class="actions">${button('Mark refunded', `ofRefund('${s.id}')`, 'secondary small')}</div><p class="source">${money(t.paid)} was paid on this cancelled order. Give it back, then mark it refunded.</p>` : '<p class="source">No money to give back on this order.</p>';
    return html.replace(/<p class="source">/, refund + '<p class="source">');
  };
}

/* The order page: the "needs a new signature" banner, and Reopen on a cancelled order. */
{
  const baseOrder = OPS_SCREENS['of-order'];
  OPS_SCREENS['of-order'] = function () {
    let html = baseOrder.apply(this, arguments);
    const s = ofSale(OF.id);
    if (!s || !ofStage(s)) return html;
    const r = s.office?.resign;
    if (r) html = toBefore(html, '<div class="od-grid">', `<div class="of-banner hold op-resign"><strong>Needs a new signature</strong><p>The price changed after the customer signed the invoice (${esc(r.why)}). It was ${money(r.was)} when they signed. It is ${money(opPrice(s))} now.</p><small>The lot has been told. The order cannot be sent for delivery until the customer signs the invoice again.</small></div>`);
    if (ofStage(s) === 'cancelled')
      html = html.replace(/(<div class="of-banner hold"><strong>Cancelled [\s\S]*?<\/p>)<\/div>/, (m, head) => `${head}<div class="actions">${button('Reopen this order', `opReopenForm('${s.id}')`, 'secondary small')}</div></div>`);
    return html;
  };
}

/* ---------- 6. One name for each step; system words go to the builder notes ----------
   The names follow the Office's own tabs (To review, On hold, Approved, Delivered, Cancelled).
   Turbo Assist's intake tabs are Pending Review, On Hold, Accepted, Cancelled (listIntakes). */
Object.assign(TO_TAB, { review: 'To review', hold: 'On hold', approved: 'Approved', delivered: 'Delivered', cancelled: 'Cancelled' });
Object.assign(TO_EVENT, { submitted: 'Sent to the office', merged: 'Sent again after a fix', accepted: 'Approved', on_hold: 'Put on hold', returned_to_hold: 'Put back on hold', cancelled: 'Cancelled' });
Object.assign(TO_SOURCE, { inventory_host_customer_order: 'From the lot’s sales system', inventory_host_inventory_order: 'From the lot’s stock system', in_app_customer: 'Entered at the Sales desk', in_app_inventory: 'Stock building ordered at the Sales desk', in_app_dealer: 'Sent in by a dealer', manual_import: 'Typed in by the office', idearoom_export: 'From the online builder', sensei_export: 'From the old sales system' });
/* Sample notices written before this file loaded carry the old names; give them the plain ones too. */
if (typeof TA !== 'undefined')
  for (const n of TA.notices)
    for (const [old, plain] of [['inventory host customer order', 'From the lot’s sales system'], ['inventory host inventory order', 'From the lot’s stock system'], ['In-app customer order', 'Entered at the Sales desk'], ['In-app inventory build', 'Stock building ordered at the Sales desk']])
      for (const k of ['title', 'body']) if (typeof n[k] === 'string') n[k] = n[k].split(old).join(plain);
TO_PAPER.order_form.splice(0, 2, 'Order form', 'The sheet the plant builds from');
TO_PAPER.rto_contract.splice(0, 2, 'Rent-to-own contract', 'Signed at the Sales desk');
TO_PAPER.happy_sheet.splice(0, 2, 'Delivery sign-off sheet', 'Signed by the customer at delivery');
TO_PAPER.steel_supplemental.splice(0, 2, 'Extra steel paperwork', 'Papers for a steel building');
TO_PAPER.waivers.splice(0, 2, 'Extra waivers', 'Only for some options');
{
  const baseIntake = toIntakePanel;
  toIntakePanel = function (s) {
    return baseIntake(s)
      .replace('<h2>Order intake</h2>', '<h2>How the order came in</h2>')
      .replace(/<span>Sale path<\/span>/, '<span>How it is paid</span>')
      .replace('Turbo Assist’s own intake check:', 'Builder notes · Turbo Assist’s own check:')
      .replace('<h3>Intake record</h3>', '<h3>What happened, in order</h3>');
  };
  const basePaper = toPaperPanel;
  toPaperPanel = function (s) {
    let html = basePaper(s);
    html = html.replace(/<p class="to-sub">[\s\S]*?<\/p>/, `<p class="to-sub">The papers this ${ofRto(s) ? 'rent-to-own' : 'cash'} order needs, and which ones are in.</p>`);
    /* Signatures are already in "Before you approve"; here they fold away, so paperwork is not listed twice. */
    html = html.replace(/<h3>Signatures<\/h3>([\s\S]*?)(<p class="source">Filed under)/, (m, rows, tail) => `<details class="op-fold"><summary>Who signed what</summary>${rows}</details>${tail}`);
    return html.replace(/<p class="source">Filed under <b>([\s\S]*?)<\/b>, the folder Turbo Assist keeps a deal’s paperwork in\. ([\s\S]*?)<\/p>/, (m, folder, tip) => `<p class="source">${tip}</p><details class="op-fold op-builder"><summary>Builder notes</summary><p class="source">Filed under <b>${folder}</b>, the folder Turbo Assist keeps a deal’s paperwork in.</p></details>`);
  };
}

/* ---------- 7. Counts and filters agree; search and the lot filter cover requests ---------- */
const opFiltering = () => OF.lot !== 'All' || !!OF.q.trim();
function opReqMatch(x) {
  if (!['office', 'of-requests'].includes(S.page) || !opFiltering()) return true;
  if (OF.lot !== 'All' && typeof adRecLot === 'function' && adRecLot(x) !== OF.lot) return false;
  const q = OF.q.trim().toLowerCase();
  if (!q) return true;
  const lot = typeof adRecLot === 'function' ? lotById(adRecLot(x) || '')?.town || '' : '';
  const text = 'done' in x && 'order' in x ? `${x.id} ${changeOrderName(x.order)} ${x.what} ${x.reason || ''}` : 'location' in x ? `${x.id} ${x.location} ${x.name || (x.c ? label(x.c) : '')}` : JSON.stringify(x);
  return `${text} ${lot}`.toLowerCase().includes(q);
}
{
  const baseMine = ofMine;
  ofMine = function (x) {
    return baseMine(x) && opReqMatch(x);
  };
}
const opNothing = (what) => `<div class="panel emptystate op-none"><strong>Nothing found</strong><p>${opFiltering() ? `No ${what} matches this lot and search.` : `There is no ${what} here right now.`}</p>${opFiltering() || OF.tile !== 'all' ? button('Show everything', "OF.tile='all';OF.q='';OF.lot='All';render()", 'secondary') : ''}</div>`;
officeList = function () {
  const g = ofGroups(), show = (k) => OF.tile === 'all' || OF.tile === k;
  const sec = (k, title, n, body) => (show(k) && n ? `<h2 class="sectionhead qc-group">${title} <small>${n}</small></h2>${body}` : '');
  const review = [...g.review.sort((a, b) => ofLeft(a).length - ofLeft(b).length).map((s) => ofRow(s)), ...g.rto.map((s) => ofRow(s, '<span class="ops-flag wait">Waiting on the rent-to-own company</span>'))];
  const html = [
    sec('review', 'To review', review.length, `<div class="ops-list">${review.join('')}</div>`),
    sec('pays', 'Payments to confirm', g.pays.length, `<div class="ops-list">${g.pays.map(ofPayRow).join('')}</div>`),
    sec('release', 'Ready to release for delivery', g.release.length, `<div class="ops-list">${g.release.map((s) => ofRow(s)).join('')}</div>`),
    sec('requests', 'Requests from the lots', g.changes.length + g.stock.length, `<div class="ops-list">${g.changes.map(ofChangeRow).join('')}${g.stock.map(ofStockRow).join('')}</div>`),
    sec('hold', 'On hold · waiting on the lot', g.hold.length, `<div class="ops-list">${g.hold.map((s) => ofRow(s)).join('')}</div>`),
  ].join('');
  return html || opNothing('order or request');
};
officeOrderRows = function () {
  const rows = ofAll().filter(ofMatches).filter((s) => ofStage(s) === OF.tab);
  return rows.length ? `<div class="ops-list">${rows.map((s) => ofRow(s)).join('')}</div>` : opNothing(`${OF_STAGE_NAME[OF.tab].toLowerCase()} order`);
};
/* Typing in the search box redraws the page; keep the cursor in the box. */
function opKeepFocus() {
  render();
  const box = document.querySelector('#app .qc-filter .search');
  if (box) box.focus(), box.setSelectionRange(box.value.length, box.value.length);
}
{
  const baseRequests = OPS_SCREENS['of-requests'];
  OPS_SCREENS['of-requests'] = function () {
    let html = baseRequests.apply(this, arguments);
    const any = /<article class="ops-row/.test(html);
    const bar = ofFilterBar('opKeepFocus()');
    html = toBefore(html, '<h2 class="sectionhead qc-group">Change orders', (typeof adScopeText === 'function' ? adScopeText(bar) : bar) + (opFiltering() && !any ? opNothing('request') : ''));
    return toBeforeLast(html, '<details class="ops-notes"', opDeclinedBlock());
  };
}

/* ---------- 8. People: checked before they are added, and a history of who changed what ----------
   Turbo Assist: AdminInviteUserBlock (invite by email), addUserLocation / removeUserLocation.
   The history list and a team member with Edit on Users are features the product still has to accept. */
const opEmailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const opEmailTaken = (e, but) => AD.users.some((u) => u.id !== but && u.status !== 'deleted' && (u.email || '').toLowerCase() === e.toLowerCase());
function opNote(whom, what) {
  OP.accessLog.unshift({ who: opWho(), whom: whom.name, id: whom.id, what, at: Date.now() });
}
/* What the person is set up to see and change (whatever their status is today). */
function opAccessSay(u) {
  if (adIsOwner(u)) return 'everything';
  const on = AD_SECTIONS.map(([k, n]) => [n, u.access[k] || adFromRoles(u, k)]).filter(([, l]) => l !== 'none');
  return on.length ? on.map(([n, l]) => `${n} (${AD_LEVEL_NAME[l].toLowerCase()})`).join(', ') : 'nothing yet';
}
const opFacts = (u) => ({ Name: u.name, Title: u.title || 'none', Email: u.email || 'none', 'Kind of account': AD_KIND[u.kind], 'Job roles': u.roles.map((r) => AD_ROLES[r][0]).join(', ') || 'none', 'Lots and plants': adLots(u), Access: opAccessSay(u), Status: { active: 'active', invited: 'invited', off: 'removed', pending: 'removal waiting', deleted: 'deleted' }[u.status] || u.status });
function opTrack(u, run) {
  const before = u ? opFacts(u) : null, out = run();
  if (u && AD.users.includes(u)) {
    const after = opFacts(u);
    for (const k of Object.keys(after)) if (before[k] !== after[k]) opNote(u, `${k}: ${before[k]} → ${after[k]}`);
  }
  return out;
}
{
  /* A team member who was given Edit on Users can add and change team members, never owners or super users. */
  const baseMay = adMayEdit;
  adMayEdit = function (target) {
    const me = adMe();
    if (!adIsOwner(me) && adCan('users') && target?.kind === 'user' && target.id !== me.id) return true;
    return baseMay.apply(this, arguments);
  };
  const baseForm = adAddForm;
  adAddForm = function () {
    baseForm.apply(this, arguments);
    if (!adIsOwner()) document.querySelectorAll('#ad-k option').forEach((o) => o.value !== 'user' && o.remove());
    const e = $('#ad-e');
    if (e) e.closest('label').firstChild.textContent = 'Email (needed)';
  };
  const baseAdd = adAdd;
  adAdd = function () {
    const v = (id) => $('#' + id)?.value.trim() || '', name = v('ad-n'), email = v('ad-e'), kind = v('ad-k');
    if (!adCan('users')) return toast('You cannot add people.');
    if (!name) return toast('Type the person’s name.');
    if (!email) return toast('Type the person’s email. The invitation goes there.');
    if (!opEmailOk(email)) return toast('That email does not look right. It needs to look like name@example.com.');
    if (opEmailTaken(email)) return toast('Someone here already has that email. Each person needs their own.');
    if (AD.users.some((u) => u.status !== 'deleted' && u.name.toLowerCase() === name.toLowerCase())) return toast(`There is already a ${name} here. Add a middle initial so you can tell them apart.`);
    if (!adIsOwner() && kind !== 'user') return toast('Only an owner can add an owner.');
    const n = AD.users.length;
    baseAdd.apply(this, arguments);
    const u = AD.users[n];
    if (u) opNote(u, `Invited as ${AD_KIND[u.kind]}${u.roles.length ? ', ' + u.roles.map((r) => AD_ROLES[r][0]).join(', ') : ''} · ${adLots(u)}`), render();
  };
  const baseSet = adSet;
  adSet = function (id, key, value) {
    const u = adUser(id);
    if (u && key === 'email') {
      if (!opEmailOk(value)) return render(), toast('That email does not look right. It needs to look like name@example.com.');
      if (opEmailTaken(value, id)) return render(), toast('Someone here already has that email. Each person needs their own.');
    }
    if (u && key === 'kind' && !adIsOwner()) return render(), toast('Only an owner can change the kind of account.');
    return opTrack(u, () => baseSet.apply(this, arguments));
  };
  for (const name of ['adRole', 'adLevel', 'adLot', 'adJoin', 'adRestore']) {
    const base = window[name];
    window[name] = function (id, ...rest) {
      const u = adUser(id);
      if (name === 'adLevel' && u && !adIsOwner() && rest[0] === 'users') return render(), toast('Only an owner can give someone access to Users and permissions.');
      return opTrack(u, () => base.call(this, id, ...rest));
    };
  }
  const baseRemove = adRemove;
  adRemove = function (id) {
    return opTrack(adUser(id), () => baseRemove.apply(this, arguments));
  };
}
function opAccessCard(id) {
  const rows = OP.accessLog.filter((x) => !id || x.id === id);
  return `<section class="panel op-access"><div class="panelhead"><h2>${id ? 'Changes to this person' : 'Access history'}</h2><span class="pill ghost">${opPlural(rows.length, 'change')}</span></div>
    ${rows.length ? `<ul class="qc-log">${rows.slice(0, 40).map((x) => `<li><strong>${id ? '' : esc(x.whom) + ' · '}${esc(x.what)}</strong><small>Changed by ${esc(x.who)} · ${adStamp(x.at)}</small></li>`).join('')}</ul>` : `<p class="of-soft">${id ? 'Nothing about this person has been changed yet.' : 'Nobody’s access has been changed yet. Every change shows here with who made it and when.'}</p>`}</section>`;
}
{
  const baseUsers = OPS_SCREENS['of-users'];
  OPS_SCREENS['of-users'] = function () {
    let html = baseUsers.apply(this, arguments);
    if (!adIsOwner() && adCan('users') && !html.includes('adAddForm()')) html = html.replace('<div class="actions">', `<div class="actions">${button('Add a person', 'adAddForm()')}`);
    return toBeforeLast(html, '<details class="ops-notes"', opAccessCard());
  };
  const baseUser = OPS_SCREENS['of-user'];
  OPS_SCREENS['of-user'] = function () {
    const html = baseUser.apply(this, arguments), u = adUser(AD.open);
    return u ? html + opAccessCard(u.id) : html;
  };
}

/* ---------- 9. Settings: in sections, saved one way, and no out-of-date lines ---------- */
OF_FUEL.percent.hint = 'A bigger price carries a bigger surcharge.';
const OP_TABS = [
  ['prices', 'Prices and fees', ['Fuel surcharge', 'Delivery', 'Discounts']],
  ['paid', 'Getting paid', ['Cash sales', 'Rent-to-own companies', 'Rent-to-own terms']],
  ['papers', 'Paperwork and people', ['Paperwork each deal needs', 'Who can do what']],
  ['history', 'History', ['Settings history']],
];
function opSetTab(k) {
  OP.setTab = k;
  render();
}
function opDriverPay(on) {
  if (OF.set.driverPay === on) return;
  const say = (v) => (v ? 'the driver can take it' : 'before delivery');
  if (!opAsks()) return (OF.set.driverPay = on), render();
  modal('Save this change?', `<ul class="og-changes"><li><strong>Final payment</strong><span><s>${say(OF.set.driverPay)}</s> → <b>${say(on)}</b></span></li></ul>
    <p class="source">This changes every new cash sale on every lot.</p>
    <div class="actions">${button('Save the change', `OF.set.driverPay=${on};closeModal();render();toast('Saved.')`)}${button('Do not change it', 'closeModal()', 'secondary')}</div>`);
}
{
  const baseSettings = OPS_SCREENS['of-settings'];
  OPS_SCREENS['of-settings'] = function () {
    let html = baseSettings.apply(this, arguments);
    html = html.replace('<p>This preview has no logins. In Turbo Assist the office’s work is split in two.</p>', `<p>Who can see and change each part of the app is set under <button type="button" class="link inline" onclick="go('of-users')">Users and permissions</button>. These are the two office jobs Turbo Assist has today.</p>`)
      .replace('onclick="OF.set.driverPay=false;render()"', 'onclick="opDriverPay(false)"').replace('onclick="OF.set.driverPay=true;render()"', 'onclick="opDriverPay(true)"')
      .replace('Paid in full before a building goes to a home. How it works today.', 'Paid in full before a building goes to a home.');
    const tabs = `<div class="op-settabs" role="tablist" aria-label="Settings sections">${OP_TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${OP.setTab === k}" class="chipbtn${OP.setTab === k ? ' on' : ''}" onclick="opSetTab('${k}')">${n}</button>`).join('')}</div>
      <p class="op-savehint">Change a number and press <b>Save</b>. You see what it does before anything is saved.</p>`;
    return toBefore(html, '<div class="grid2', tabs);
  };
}
/* After the page is drawn: show only the open section, and give every number its own Save button. */
function opSettingsTidy() {
  if (S.page !== 'of-settings') return;
  const names = Object.fromEntries(OP_TABS.flatMap(([k, , list]) => list.map((n) => [n, k])));
  for (const sec of document.querySelectorAll('#app section.panel')) {
    const h = sec.querySelector('h2')?.textContent.trim();
    if (h && names[h]) sec.hidden = OP.setTab !== 'all' && names[h] !== OP.setTab; /* 'all' is for the automatic checks */
  }
  /* A number saves when you leave its box. The Save button is the plain way to do that: pressing it leaves the box. */
  for (const input of document.querySelectorAll('#app input[onchange^="ofSetNum("]')) {
    const label = input.closest('label');
    if (input.disabled || !label || label.nextElementSibling?.classList.contains('op-save')) continue;
    label.insertAdjacentHTML('afterend', '<button type="button" class="secondary small op-save">Save</button>');
  }
  for (const term of document.querySelectorAll('#app .to-term')) if (!term.querySelector('.op-save')) term.insertAdjacentHTML('beforeend', '<button type="button" class="secondary small op-save">Save</button>');
}
/* The history line for rent-to-own uses the same plain words as the terms card. */
if (typeof ogSummary === 'function') {
  const baseSummary = ogSummary;
  ogSummary = function () {
    return baseSummary().map(([k, v]) => [k, String(v).replace(/^price divided by ([\d.]+)/, 'divide the price by $1')]);
  };
}

/* ---------- After every draw ---------- */
{
  const drawn = render;
  render = function () {
    drawn.apply(this, arguments);
    try {
      opSettingsTidy();
      opPublishedDetails();
    } catch (e) { console.error(e); }
  };
}
