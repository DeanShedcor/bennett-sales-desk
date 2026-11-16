/* office-guards.js: guard rails on the Office side's money, prices, settings and super users.

   From the owner's review (Nov 16, 2026), Office findings 1, 3, 4, 5, 6 and 8:
   1. Payment buttons follow the person's Payments access wherever they sit.
   2. Publishing prices shows a summary first, flags big changes, lists every row, and can be undone.
   3. Settings refuse numbers outside a sensible range and ask before saving, with a before-and-after example.
   4. A payment above what is owed asks first; a discount cannot be more than the price.
   5. A cash order needs its sales tax entered, or "Tax exempt" ticked, before it can be approved.
   6. Every settings change is written to a history: who, the old value and the new value.
   7. The last super user cannot be removed or demoted; removing a super user needs a reason and
      the other super user's say-so.
   Loaded after admin.js. Wraps the office and admin functions; the older files are not edited. */

const OG = { log: [], last: null, pending: null, live: false, payOver: null };
const ogCents = (n) => Math.round(n * 100) / 100;
const ogWho = () => (typeof adMe === 'function' ? adMe().name : 'Office');
const ogWrap = (name, make) => { const base = window[name]; if (typeof base === 'function') window[name] = make(base); };

/* ---------- 1. Payments follow the Payments access level ----------
   Turbo Assist: the deal's deposit_receipt paperwork item (received → verified). Its screens open or
   close by role; a read-only level is a feature the product still has to accept. */
const ogPayOk = () => typeof adCan !== 'function' || adCan('payments');
const OG_PAY_FNS = ['ofConfirmPay', 'ofDropPay', 'ofPayForm', 'ofPaySave', 'ofRefund'];
for (const name of OG_PAY_FNS)
  ogWrap(name, (base) => function (...args) {
    if (!ogPayOk()) return toast(`Payments: read only. ${ogWho()} can see payments but cannot change them.`);
    return base.apply(this, args);
  });
function ogLockPayButtons() {
  if (ogPayOk()) return;
  const sel = OG_PAY_FNS.map((f) => `button[onclick^="${f}("]`).join(', ');
  const seen = new Set();
  for (const b of document.querySelectorAll(sel)) {
    b.disabled = true;
    b.classList.add('og-locked');
    b.title = 'Payments: read only';
    const box = b.parentElement;
    if (box && !seen.has(box) && !box.querySelector('.og-lockmsg')) b.insertAdjacentHTML('afterend', '<span class="og-lockmsg">Payments: read only</span>');
    seen.add(box);
  }
}

/* ---------- 2. Publishing prices: look first, then publish; and a way back ----------
   Turbo Assist: the org price book (resolve_pricing). A publish summary and "undo this publish"
   are features the product still has to accept. */
const OG_BIG = 15; /* percent */
const ogPct = (d) => (d.old ? ((d.new - d.old) / d.old) * 100 : 100);
const ogPctSay = (d) => { const p = ogPct(d), n = Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : Math.round(Math.abs(p) * 10) / 10; return `${p >= 0 ? 'up' : 'down'} ${n}%`; };
const ogIsBig = (d) => Math.abs(ogPct(d)) > OG_BIG;
function ogChangeLine(d, undo) {
  const big = ogIsBig(d);
  return `<li class="${big ? 'og-big' : ''}"><span>${esc(adChangeName(d))}${big ? ' <em class="og-flag">Big change. Check it.</em>' : ''}</span><strong><s>${money(d.old)}</s> ${money(d.new)} <small class="og-pct">${ogPctSay(d)}</small>${undo ? ` <button type="button" class="link inline" onclick='AD.draft=AD.draft.filter((x)=>adKey(x)!==adKey(${esc(JSON.stringify(d))}));render()'>undo</button>` : ''}</strong></li>`;
}
{
  const baseDraft = adDraftTab;
  adDraftTab = function () {
    let html = baseDraft();
    if (AD.draft.length) {
      const big = AD.draft.filter(ogIsBig).length;
      const list = `${big ? `<p class="notice og-bignote"><b>${big}</b> ${big === 1 ? 'price changes' : 'prices change'} by more than ${OG_BIG}%. They are marked in red. Look at them before you publish.</p>` : ''}<ul class="pricelines ad-changes og-all">${AD.draft.map((d) => ogChangeLine(d, true)).join('')}</ul>`;
      html = html.replace(/<ul class="pricelines ad-changes">[\s\S]*?<\/ul>(?:<p class="source">\d+ more not shown\.<\/p>)?/, () => list);
    }
    if (AD.log.length) {
      const newest = AD.log.findIndex((s) => !s.undone);
      const rows = AD.log.map((s, i) => `<div class="ad-set"><span class="grow"><strong>${s.changes.length} ${s.changes.length === 1 ? 'price' : 'prices'} · live ${adDay(s.date)}</strong><small>By ${esc(s.by)} · ${esc(s.changes.slice(0, 3).map(adChangeName).join(', '))}${s.changes.length > 3 ? '…' : ''}</small>${s.undone ? `<small class="og-undone">Put back to the old prices by ${esc(s.undone.by)} ${adStamp(s.undone.at)}</small>` : ''}</span>${s.undone || !adIsOwner() ? '' : i === newest ? `<button type="button" class="secondary small" onclick="ogUndoAsk(${i})">Undo this publish</button>` : '<small class="of-soft">Undo the newer one first</small>'}</div>`).join('');
      html = html.replace(/<h3 class="ad-w">Published<\/h3>[\s\S]*$/, () => `<h3 class="ad-w">Published</h3>${rows}`);
    }
    return html;
  };
  const basePublish = adPublish;
  adPublish = function () {
    if (OG.live || !adIsOwner() || !AD.draft.length) return basePublish();
    const d = AD.draft, ups = d.filter((x) => x.new > x.old), downs = d.filter((x) => x.new < x.old), big = d.filter(ogIsBig);
    const top = (rows, dir) => rows.slice().sort((a, b) => dir * (ogPct(b) - ogPct(a))).slice(0, 3);
    const when = $('#ad-when')?.value || adToday(), today = when <= adToday();
    const li = (x) => `<li class="${ogIsBig(x) ? 'og-big' : ''}"><span>${esc(adChangeName(x))}</span><strong><s>${money(x.old)}</s> ${money(x.new)} <small class="og-pct">${ogPctSay(x)}</small></strong></li>`;
    modal('Publish these prices?', `<p><b>${d.length}</b> ${d.length === 1 ? 'price changes' : 'prices change'}: ${ups.length} ${ups.length === 1 ? 'goes' : 'go'} up, ${downs.length} ${downs.length === 1 ? 'goes' : 'go'} down. ${today ? 'They go live <b>right now</b> on every Sales desk.' : `They go live <b>${adDay(when)}</b>.`}</p>
      ${big.length ? `<p class="notice og-bignote"><b>${big.length}</b> of them ${big.length === 1 ? 'changes' : 'change'} by more than ${OG_BIG}%. Make sure that is what you meant.</p>` : ''}
      ${ups.length ? `<h3 class="og-h">Biggest raises</h3><ul class="pricelines og-sum">${top(ups, 1).map(li).join('')}</ul>` : ''}
      ${downs.length ? `<h3 class="og-h">Biggest cuts</h3><ul class="pricelines og-sum">${top(downs, -1).map(li).join('')}</ul>` : ''}
      <p class="source">Quotes and orders already written keep their price. You can undo a publish afterwards.</p>
      <div class="actions">${button(`Publish ${d.length} ${d.length === 1 ? 'price' : 'prices'}`, 'ogPublishGo()')}${button('Go back', 'closeModal()', 'secondary')}</div>`);
  };
}
function ogPublishGo() {
  closeModal();
  OG.live = true;
  try { adPublish(); } finally { OG.live = false; }
}
function ogUndoAsk(i) {
  const s = AD.log[i];
  if (!s || s.undone) return;
  modal('Undo this publish?', `<p>This puts <b>${s.changes.length}</b> ${s.changes.length === 1 ? 'price' : 'prices'} back to what ${s.changes.length === 1 ? 'it was' : 'they were'} before ${esc(s.by)} published on ${adDay(s.date)}.</p>
    <ul class="pricelines og-sum">${s.changes.slice(0, 5).map((d) => `<li><span>${esc(adChangeName(d))}</span><strong><s>${money(d.new)}</s> ${money(d.old)}</strong></li>`).join('')}</ul>${s.changes.length > 5 ? `<p class="source">And ${s.changes.length - 5} more.</p>` : ''}
    <div class="actions">${button('Put the old prices back', `ogUndo(${i})`)}${button('Keep the new prices', 'closeModal()', 'secondary')}</div>`);
}
function ogUndo(i) {
  const s = AD.log[i];
  if (!s || s.undone) return;
  if (!adIsOwner()) return toast('Only an owner can undo a publish.');
  for (const d of s.changes) {
    if (d.kind === 'shed') PRICE_LIST[d.model][d.size] = d.old;
    else if (d.kind === 'item') adItem(d.name).price = d.old;
    else if (PRICE_LIST[d.model]?.[d.size] === d.old) delete AD.over[d.lot]?.[d.model + '|' + d.size];
    else (AD.over[d.lot] ||= {})[d.model + '|' + d.size] = d.old;
  }
  s.undone = { by: ogWho(), at: Date.now() };
  closeModal();
  render();
  toast(`${s.changes.length} ${s.changes.length === 1 ? 'price is' : 'prices are'} back to what ${s.changes.length === 1 ? 'it was' : 'they were'}.`);
}

/* ---------- 3 and 6. Settings: sensible numbers, ask before saving, and a history ----------
   Turbo Assist keeps these in org settings; a change history is a feature the product still has to accept. */
const OG_FUEL_MAX = { percent: 10, size: 2, linear: 20, flat: 500 };
function ogSummary() {
  const f = OF.set, out = [
    ['Fuel surcharge', ofFuelSet() ? `${OF_FUEL[f.fuel.method].name.toLowerCase()}, ${ofFuelSay()}` : `${OF_FUEL[f.fuel.method].name.toLowerCase()}, not set`],
    ['Free delivery within', `${FREE_DELIVERY_MILES} miles`],
    ['Delivery charge covers up to', `${f.overTo} miles`],
    ['Delivery charge past the free miles', money(f.overFee)],
    ['Deposit on a cash sale', `${f.depositPct}%`],
    ['Final payment', f.driverPay ? 'the driver can take it' : 'before delivery'],
    ['Card fee when a driver takes a card', `${f.cardFeePct}%`],
    ['Discount reasons', f.purposes.join(', ') || 'none'],
    ['Rent-to-own companies', f.rtoCos.join(', ') || 'none'],
  ];
  if (typeof TA !== 'undefined')
    for (const t of TA.rto.terms)
      out.push([`Rent-to-own, ${t.months} months`, `price divided by ${t.divisor}, ${t.downType === 'percent' ? `${Math.round(t.down * 1000) / 10}% down` : `${t.down} payment${t.down === 1 ? '' : 's'} down`}${t.epo != null ? `, early payoff ${Math.round(t.epo * 1000) / 10}%` : ''}${t.balloon ? `, ${t.balloonPayments} big last payments` : ''}`]);
  return out;
}
/* What the settings come to on a plain 10 × 16, so the person sees what the number does. */
function ogExample() {
  const c = clone(defaults), rows = breakdown(c), price = ogCents(rows.reduce((t, r) => t + (r.name === 'Fuel surcharge' ? 0 : r.amount), 0)), fuel = ofFuelFor(c, price), total = ogCents(price + (fuel || 0));
  const del = (mi) => (mi <= FREE_DELIVERY_MILES ? 'Free' : mi <= OF.set.overTo ? money(OF.set.overFee) : 'Logistics sets the fee');
  const out = [
    ['Fuel surcharge', fuel == null ? 'Not set' : money(fuel)],
    ['Price with fuel', money(total)],
    ['Delivery, 30 miles away', del(30)],
    ['Delivery, 75 miles away', del(75)],
    ['Delivery, 150 miles away', del(150)],
    [`Deposit on a cash sale`, money(ogCents((total * OF.set.depositPct) / 100))],
  ];
  for (const m of [24, 36, 48, 60]) out.push([`Monthly payment, ${m} months`, money(payment(total, m))]);
  return { name: label(c), rows: out };
}
function ogSnap() {
  return { set: clone(OF.set), free: FREE_DELIVERY_MILES, terms: clone(TA.rto.terms), rtoLog: clone(TO.rtoLog), rtoStart: TO.rtoStart ? clone(TO.rtoStart) : TO.rtoStart };
}
function ogRestore(s) {
  OF.set = s.set;
  FREE_DELIVERY_MILES = s.free;
  TA.rto.terms.splice(0, TA.rto.terms.length, ...s.terms);
  TO.rtoLog.splice(0, TO.rtoLog.length, ...s.rtoLog);
  TO.rtoStart = s.rtoStart;
  taRtoSync();
}
/* A number outside the sensible range is refused, with the range in the message. */
function ogRange(name, args) {
  if (name === 'ofSetFuel') {
    const raw = $('#of-fuel')?.value.trim(), v = Number(raw), max = OG_FUEL_MAX[OF.set.fuel.method];
    if (raw !== '' && v > max) return `That is too high for a fuel surcharge. Use a number from 0 to ${max}.`;
  }
  if (name === 'ofSetNum') {
    const [key, el] = args, v = Number(el.value);
    const lim = { freeMiles: [0, 200], overTo: [1, 500], overFee: [0, 1000], depositPct: [0, 50], cardFeePct: [0, 10] }[key];
    if (lim && !(v >= lim[0] && v <= lim[1])) return `Use a number from ${lim[0]} to ${lim[1]}.`;
    if (key === 'freeMiles' && v >= OF.set.overTo) return `Free miles have to be less than ${OF.set.overTo}, the miles the delivery charge covers.`;
    if (key === 'overTo' && v <= FREE_DELIVERY_MILES) return `This has to be more than ${FREE_DELIVERY_MILES}, the free delivery miles.`;
  }
  if (name === 'toRtoSet' && args[1] === 'divisor') {
    const v = Number(args[2]);
    if (!(v >= 10 && v <= 40)) return 'Use a number from 10 to 40. The monthly payment is the price divided by this number.';
  }
  return '';
}
for (const name of ['ofSetFuel', 'ofFuelMethod', 'ofSetNum', 'toRtoSet', 'toRtoUseTurbo', 'toRtoReset'])
  ogWrap(name, (base) => function (...args) {
    if (OG.live) return base.apply(this, args);
    const bad = ogRange(name, args);
    if (bad) return render(), toast(bad);
    /* Try the change with the screen frozen, read what it would do, then put everything back and ask. */
    const snap = ogSnap(), before = { sum: ogSummary(), ex: ogExample() }, keep = { render, toast };
    let said = '';
    render = () => {};
    toast = (m) => { said = m; };
    const typed = args.map((a) => (a && typeof a === 'object' && 'value' in a ? { value: a.value } : a));
    try { base.apply(this, args); } finally { render = keep.render; toast = keep.toast; }
    const after = { sum: ogSummary(), ex: ogExample() };
    ogRestore(snap);
    const changed = after.sum.filter(([k, v], i) => v !== before.sum[i]?.[1]).map(([k, v]) => [k, before.sum.find((x) => x[0] === k)?.[1] ?? 'not set', v]);
    if (!changed.length) return render(), said && toast(said);
    OG.pending = { name, args: typed, fuel: $('#of-fuel')?.value };
    const exRows = after.ex.rows.map(([k, v], i) => { const was = before.ex.rows[i][1]; return `<tr class="${was !== v ? 'og-diff' : ''}"><td>${esc(k)}</td><td>${esc(was)}</td><td>${esc(v)}${was !== v ? ' <em class="og-flag">changes</em>' : ''}</td></tr>`; }).join('');
    modal('Save this change?', `<ul class="og-changes">${changed.map(([k, a, b]) => `<li><strong>${esc(k)}</strong><span><s>${esc(a)}</s> → <b>${esc(b)}</b></span></li>`).join('')}</ul>
      <h3 class="og-h">What it does to a ${esc(after.ex.name)}</h3>
      <div class="og-tablewrap"><table class="og-ex"><thead><tr><th></th><th>Now</th><th>After</th></tr></thead><tbody>${exRows}</tbody></table></div>
      <p class="source">This changes every new quote on every lot. Orders already written keep their numbers.</p>
      <div class="actions">${button('Save the change', 'ogSave()')}${button('Do not change it', 'ogCancel()', 'secondary')}</div>`);
  });
function ogSave() {
  const p = OG.pending;
  OG.pending = null;
  closeModal();
  if (!p) return;
  const box = $('#of-fuel');
  if (box && p.fuel != null) box.value = p.fuel;
  OG.live = true;
  try { window[p.name](...p.args); } finally { OG.live = false; }
}
function ogCancel() {
  OG.pending = null;
  closeModal();
  render();
}
/* The history: written whenever a draw finds a setting different from the last draw. */
function ogNoteChanges() {
  if (typeof OF === 'undefined' || typeof TA === 'undefined') return;
  const now = ogSummary();
  if (OG.last)
    for (const [k, v] of now) {
      const was = OG.last.find((x) => x[0] === k)?.[1];
      if (was !== undefined && was !== v) OG.log.unshift({ what: k, from: was, to: v, who: ogWho(), at: Date.now() });
    }
  OG.last = now;
}
{
  const baseSettings = OPS_SCREENS['of-settings'];
  OPS_SCREENS['of-settings'] = function () {
    const html = baseSettings.apply(this, arguments);
    const card = `<section class="panel og-history"><div class="panelhead"><h2>Settings history</h2><span class="pill ghost">${OG.log.length} ${OG.log.length === 1 ? 'change' : 'changes'}</span></div>
      ${OG.log.length ? `<ul class="qc-log">${OG.log.slice(0, 40).map((x) => `<li><strong>${esc(x.what)}: ${esc(x.from)} → ${esc(x.to)}</strong><small>${esc(x.who)} · ${ofStamp(x.at)}</small></li>`).join('')}</ul>` : '<p class="of-soft">No setting has been changed yet. Each change shows here with who made it, the old number and the new number.</p>'}</section>`;
    const at = html.lastIndexOf('<details class="ops-notes"');
    return at < 0 ? html + card : html.slice(0, at) + card + html.slice(at);
  };
}

/* ---------- 4. Money boxes: a payment above what is owed asks first; a discount stops at the price ----------
   Turbo Assist keeps no ledger yet (payments, balances and refunds are this preview's); the limits are
   features the product still has to accept. */
ogWrap('ofPaySave', (base) => function (id) {
  const s = ofSale(id), box = $('#of-pay-amount'), amount = ogCents(Number(box?.value));
  if (s && amount > 0) {
    const t = ofTotals(s), owed = t.rto ? ogCents(t.total - t.paid) : t.balance;
    if (amount > owed + 0.005 && OG.payOver !== `${id}|${amount}`) {
      OG.payOver = `${id}|${amount}`;
      document.querySelector('.modal .og-over')?.remove();
      box.closest('.fields').insertAdjacentHTML('afterend', `<p class="notice og-over" role="alert"><b>${money(amount)} is more than what is owed (${money(Math.max(0, owed))}).</b> Check the number. If it is right, press Save the payment again.</p>`);
      return;
    }
  }
  OG.payOver = null;
  return base.apply(this, arguments);
});
ogWrap('ofDiscountSave', (base) => function (id) {
  const s = ofSale(id), amount = ogCents(Number($('#of-disc-amount')?.value));
  if (s && amount > 0) {
    ofRec(s);
    const room = ogCents(s.total - ofSum(s.money.discounts));
    if (amount > room) return toast(`A discount cannot be more than the price. The most you can take off is ${money(Math.max(0, room))}.`);
  }
  return base.apply(this, arguments);
});

/* ---------- 5. Sales tax before approving a cash order ----------
   Turbo Assist: the sales tax line on the order (typed by hand today; a lookup by address is planned).
   "Tax exempt" as a tick is a feature the product still has to accept. */
function ogExempt(id, on) {
  const s = ofSale(id), o = ofRec(s);
  o.taxExempt = on ? { by: ogWho(), at: Date.now() } : null;
  ofLog(s, on ? 'Office marked the order tax exempt' : 'Office took off the tax exempt mark');
  render();
  toast(on ? 'Marked tax exempt.' : 'Tax exempt mark taken off.');
}
const ogTaxNeeded = (s) => !s.invoice && !ofRto(s);
{
  const baseChecks = ofChecks;
  ofChecks = function (s) {
    const out = baseChecks(s);
    if (!ogTaxNeeded(s)) return out;
    const pct = toTaxPct(s), exempt = !!s.office?.taxExempt, ok = pct != null || exempt;
    const check = { key: 'tax', short: 'Sales tax', title: 'Sales tax', must: true, state: ok ? 'ok' : 'bad',
      text: exempt ? 'Marked tax exempt: no sales tax on this order' : pct != null ? `${pct}% sales tax entered` : 'No sales tax yet. Type the percent in the Money box, or mark the order tax exempt.',
      act: ok ? '' : `<button type="button" class="secondary small" onclick="ogExempt('${s.id}',true)">Tax exempt</button>`, hold: 'Sales tax is not entered' };
    const at = out.findIndex((c) => c.key === 'deposit');
    out.splice(at < 0 ? out.length : at + 1, 0, check);
    return out;
  };
  const baseMoney = ofMoneyPanel;
  ofMoneyPanel = function (s) {
    let html = baseMoney(s);
    if (!ogTaxNeeded(s)) return html;
    const open = !['cancelled', 'delivered'].includes(ofStage(s)), on = !!s.office?.taxExempt;
    const row = open
      ? `<label class="checkrow og-exempt"><input type="checkbox" ${on ? 'checked' : ''} onchange="ogExempt('${s.id}',this.checked)"> Tax exempt (no sales tax on this order)</label>`
      : on ? '<p class="of-soft og-exempt">Tax exempt</p>' : '';
    return html.replace(/(<div class="od-kv to-taxrow">[\s\S]*?<\/strong><\/div>)/, (m) => m + row);
  };
}

/* ---------- 7. Super users ----------
   Turbo Assist: the platform roles above an org owner (platform_owner, platform_admin). Needing the
   other super user's say-so is a feature the product still has to accept. */
const ogSupers = () => AD.users.filter((u) => u.kind === 'super' && ['active', 'invited'].includes(u.status));
const ogOtherSupers = (u) => ogSupers().filter((x) => x.id !== u.id && x.id !== u.removal?.by);
{
  const baseSet = adSet;
  adSet = function (id, key, value) {
    const u = adUser(id);
    if (u && key === 'kind' && u.kind === 'super' && value !== 'super' && adIsSuper()) {
      if (ogSupers().filter((x) => x.id !== u.id).length === 0) return render(), toast('There has to be at least one super user. Make someone else a super user first.');
      if (u.id !== AD.me) return render(), toast(`You cannot take super user away from ${u.name} this way. Use “Remove this person”. ${u.name} has to agree.`);
    }
    return baseSet.apply(this, arguments);
  };
  const baseForm = adRemoveForm;
  adRemoveForm = function (id) {
    const u = adUser(id);
    if (!u || u.kind !== 'super') return baseForm.apply(this, arguments);
    if (ogSupers().filter((x) => x.id !== u.id).length === 0) return toast('There has to be at least one super user. This is the last one.');
    const others = ogSupers().filter((x) => x.id !== u.id && x.id !== AD.me);
    modal(`Remove ${esc(u.name)}`, `<p>${esc(u.name)} is a super user. One super user cannot remove another alone.</p>
      <p>${esc(u.name)} is locked out right away and told why. The removal is only final when ${others.length ? 'another super user agrees' : `${esc(u.name)} agrees`}.</p>
      <label class="field">Reason (needed)<input id="ad-why" maxlength="100" placeholder="Example: left the company"></label>
      <div class="actions">${button('Ask to remove', `adRemove('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
  };
  const baseRemove = adRemove;
  adRemove = function (id) {
    const u = adUser(id), me = adMe();
    if (!u || u.kind !== 'super') return baseRemove.apply(this, arguments);
    if (id === AD.me) return toast('You cannot remove yourself.');
    if (!adIsSuper(me) || !adMayEdit(u)) return toast('Only a super user can remove a super user.');
    if (ogSupers().filter((x) => x.id !== u.id).length === 0) return toast('There has to be at least one super user. This is the last one.');
    const reason = $('#ad-why')?.value.trim() || '';
    if (!reason) return toast('Type the reason. A super user cannot be removed without one.');
    u.status = 'pending';
    u.removal = { by: me.id, at: Date.now(), reason, superAsk: true };
    if (typeof taNotify === 'function') taNotify({ to: 'office', title: `Super user removal waiting — ${u.name}`, body: `${me.name} asked to remove ${u.name}: ${reason}. It is not final until another super user agrees.`, go: "go('of-users')" });
    closeModal();
    go('of-users');
    toast(`${u.name} is locked out. The removal waits for ${ogOtherSupers(u).length ? 'another super user' : u.name} to agree.`);
  };
  const baseDecide = adDecide;
  adDecide = function (id, accept) {
    const u = adUser(id);
    if (u && u.kind === 'super' && u.status === 'pending' && accept && u.removal?.by === AD.me) return toast('You asked for this removal, so someone else has to agree to it.');
    return baseDecide.apply(this, arguments);
  };
  const baseRow = adRow;
  adRow = function (u) {
    let html = baseRow(u);
    if (u.kind === 'super' && u.status === 'pending') {
      const need = ogOtherSupers(u).length ? 'another super user' : esc(u.name);
      if (u.removal?.by === AD.me) html = html.replace(/<button type="button" class="primary small" onclick="adDecide\('[^']+',true\)">Accept removal<\/button>/, '').replace('>Restore</button>', '>Cancel the removal</button>');
      html = html.replace('<div class="ops-flags">', `<div class="ops-flags"><span class="ops-flag todo">Waiting for ${need} to agree</span>`);
    }
    return html;
  };
  const baseUsers = adUsersPage;
  adUsersPage = OPS_SCREENS['of-users'] = function () {
    return baseUsers.apply(this, arguments).replace('An owner removed these owners. They are locked out now. Accept to make it final, or restore them.', 'These people are locked out now. An owner’s removal is final when a super user accepts it. A super user’s removal is final when another super user agrees.');
  };
}
/* A super user whose removal is waiting sees why, and can answer when no third super user exists. */
function ogSelfDecide(agree) {
  const u = adMe();
  if (!u || u.kind !== 'super' || u.status !== 'pending') return;
  if (agree) { u.status = 'deleted'; u.removal.final = { by: u.id, at: Date.now() }; }
  else { u.status = 'active'; u.removal = null; }
  render();
  toast(agree ? 'Your account is removed.' : 'Your account is back.');
}
function ogSuperLocked() {
  const me = typeof adMe === 'function' ? adMe() : null;
  if (!me || me.kind !== 'super' || me.status !== 'pending' || !me.removal?.superAsk) return;
  const by = adUser(me.removal.by)?.name || 'A super user', others = ogOtherSupers(me);
  $('#app').innerHTML = `<section class="panel ad-locked og-superlock"><h1>Your access is on hold.</h1>
    <p>${esc(by)} asked to remove your account. The reason given: “${esc(me.removal.reason)}”.</p>
    <p>${others.length ? 'You cannot use the app until another super user decides.' : 'It is not final unless you agree. You cannot use the app until you answer.'}</p>
    ${others.length ? '' : `<div class="actions">${button('Do not remove me', 'ogSelfDecide(false)')}${button('I agree to be removed', 'ogSelfDecide(true)', 'secondary')}</div>`}</section>`;
}

/* ---------- After every draw ---------- */
{
  const drawn = render;
  render = function () {
    try { ogNoteChanges(); } catch (e) { console.error(e); } /* before the draw, so the history card is current */
    drawn.apply(this, arguments);
    try {
      ogLockPayButtons();
      ogSuperLocked();
    } catch (e) { console.error(e); }
  };
}
