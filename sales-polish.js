/* sales-polish.js: eight small Sales desk fixes from the Nov 16, 2026 review.

   1. Typed entries are checked on the sale's customer form and the billing form.
   2. Rent-to-own identity: the "do not type a real license or SSN" warning sits above the fields;
      only the last 4 digits are asked for; the birth date must make the customer 18.
   3. Restock: "Cancel order" asks first, and is blocked once the plant has started building.
   4. "New sale" in the Sales menu (the button itself is in index.html; NAV_GROUP below lights it).
   5. A lead's phone and email are tap-to-call and tap-to-email.
   6. Order lookup: one status per order, search hides what does not match.
   7. A quote's record is titled Quote, with its next step at the top.
   8. Restock: a model is listed once, under "Order more" or "Hold off".
   Turbo Assist: leads and their contact details stay in Legacy's lead editor; stock orders are
   inventory requests the office approves (the office's Requests screen); a quote version has no
   record there yet. The entry checks and the restock rules are desk behaviour the product still
   has to accept. Loaded after the other Sales files; wraps their globals. */

/* ---------- 4. New sale in the menu ---------- */
Object.assign(NAV_GROUP, { start: 'start', configure: 'start' });

/* ---------- 1. Typed entries ---------- */
{
  const STATES = new Set(RTO_STATES.concat('DC'));
  const refuse = (input, text) => {
    document.querySelectorAll('.sp-fielderror').forEach((e) => e.remove());
    input.closest('label')?.insertAdjacentHTML('beforeend', `<small class="sp-fielderror" role="alert">${text}</small>`);
    input.focus();
    toast(text);
    return false;
  };
  const customerOk = (form) => {
    const el = form.elements, on = (i) => i && !i.matches(':disabled') && i.value.trim();
    const digits = (el.phone?.value || '').replace(/\D/g, '');
    if (on(el.phone) && !(digits.length === 10 || (digits.length === 11 && digits[0] === '1'))) return refuse(el.phone, 'Enter a 10-digit phone number, like (843) 555-0199.');
    if (on(el.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.email.value.trim())) return refuse(el.email, 'Enter an email address, like name@example.com.');
    for (const p of ['billing', 'delivery']) {
      const st = el[p + 'State'], zip = el[p + 'Zip'];
      if (on(st) && !STATES.has(st.value.trim().toUpperCase())) return refuse(st, 'Enter the state as two letters, like SC.');
      if (on(st)) st.value = st.value.trim().toUpperCase();
      if (on(zip) && !/^\d{5}(-\d{4})?$/.test(zip.value.trim())) return refuse(zip, 'Enter a 5-digit ZIP code.');
    }
    return true;
  };
  const deskReview = reviewSale;
  reviewSale = function () {
    const form = $('#customerInfo');
    if (form && !customerOk(form)) return;
    deskReview();
  };

  /* Billing: money today cannot be more than the building, and $0 is asked about once. */
  const deskContinue = continueBilling;
  continueBilling = function (form) {
    const dep = form.elements.deposit, deposit = Math.round(Number(dep.value || 0) * 100) / 100;
    const discount = Math.max(0, Number(form.elements.discount?.value || 0)), price = Math.round((amount() - discount) * 100) / 100;
    if (!(deposit >= 0)) return refuse(dep, 'Enter the money taken today, or 0.');
    if (deposit > price) return refuse(dep, `That is more than the building costs (${money(price)}).`);
    if (deposit === 0 && form.dataset.zeroOk !== '1') {
      if (!form.querySelector('.sp-zero'))
        form.querySelector('.actions').insertAdjacentHTML('beforebegin', `<div class="sp-zero" role="alert"><strong>Take no money today?</strong><span>The deposit box says $0.</span>
          <div class="actions"><button type="button" class="secondary small" onclick="this.closest('.sp-zero').remove();document.querySelector('#saleBilling [name=deposit]').focus()">Type an amount</button><button type="button" class="primary small" onclick="const f=this.form||document.getElementById('saleBilling');f.dataset.zeroOk='1';continueBilling(f)">Yes, take no money today</button></div></div>`);
      form.querySelector('.sp-zero').scrollIntoView({ block: 'nearest' });
      return;
    }
    deskContinue(form);
  };
}

/* ---------- 2. Rent-to-own identity ---------- */
{
  const SSN = ['ssn', 'csSsn'], DOB = ['dob', 'csDob'];
  const deskApply = rtoApply;
  rtoApply = function (step) {
    deskApply(step);
    const form = document.getElementById('rtoForm');
    if (!form) return;
    /* The warning comes before the fields it is about. */
    const notice = form.querySelector('.notice'), fields = form.querySelector('.fields');
    if (notice && fields && (notice.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_PRECEDING)) fields.before(notice);
    for (const n of SSN) {
      const i = form.elements[n];
      if (!i) continue;
      /* Only the last 4 digits were ever kept; now only they are asked for. */
      i.closest('label').firstChild.textContent = i.closest('label').firstChild.textContent.replace('Social Security number', 'Last 4 digits of the Social Security number');
      Object.assign(i, { maxLength: 4, placeholder: '4 digits', type: 'text' });
      i.setAttribute('inputmode', 'numeric');
      i.setAttribute('autocomplete', 'off');
    }
    const max = new Date(); max.setFullYear(max.getFullYear() - 18);
    for (const n of DOB) if (form.elements[n]) form.elements[n].max = max.toISOString().slice(0, 10);
  };
  const deskNext = rtoNext;
  rtoNext = function () {
    const form = document.getElementById('rtoForm');
    const bad = (i, text) => { form.querySelectorAll('.sp-fielderror').forEach((e) => e.remove()); i.closest('label').insertAdjacentHTML('beforeend', `<small class="sp-fielderror" role="alert">${text}</small>`); i.focus(); toast(text); };
    if (form) {
      const live = (n) => { const i = form.elements[n]; return i && !i.closest('fieldset[disabled]') && i.value.trim() ? i : null; };
      for (const n of SSN) { const i = live(n); if (i && !/^\d{4}$/.test(i.value.trim())) return bad(i, 'Enter the last 4 digits only.'); }
      const cut = new Date(); cut.setFullYear(cut.getFullYear() - 18);
      for (const n of DOB) { const i = live(n); if (i && !(new Date(i.value + 'T00:00:00') <= cut)) return bad(i, 'The customer must be at least 18.'); }
    }
    deskNext();
  };
}

/* ---------- 3 and 8. Restock ---------- */
{
  /* Building starts at Flooring; before that the order can still be cancelled from the desk. */
  const building = (r) => {
    const u = typeof prUnits === 'function' ? prUnits().find((x) => x.id === r.id) : null;
    return (u && u.phase >= phaseNames.indexOf('Flooring')) || (r.stage || 0) >= STOCK_STAGES.indexOf('In production') && !u;
  };
  const deskRestock = restockPage;
  restockPage = function () {
    return deskRestock().replace(/<button type="button" class="link" onclick="cancelStock\((\d+)\)">Cancel order<\/button>/g, (_, n) =>
      building(S.stock[Number(n)])
        ? '<span class="sp-nocancel">The plant has started building it. Ask the office to cancel.</span>'
        : `<button type="button" class="link" onclick="spCancelStock(${n})">Cancel order</button>`);
  };
  window.spCancelStock = function (n) {
    const r = S.stock[n];
    if (!r) return;
    modal('Cancel this stock order?', `<p><strong>${esc(r.name || label(r.c))}</strong> · ${esc(r.id)} for the ${esc(r.location || LOT_LOCATION)} lot.</p><p>The order is taken off the list and the office is not asked to approve it.</p>
      <div class="actions">${button('Keep the order', 'closeModal()', 'secondary')}${button('Cancel the order', `closeModal();cancelStock(${n});toast('Stock order cancelled.')`, 'primary')}</div>`);
  };
  /* A model that is slow on the lot is under "Hold off" only. */
  const deskSuggest = restockSuggestions;
  restockSuggestions = function () {
    const hold = new Set(restockWarnings().map((g) => kindKey(g.c)));
    return deskSuggest().filter((g) => !hold.has(kindKey(g.c)));
  };
}

/* ---------- 5. Tap to call and email ---------- */
{
  const deskLead = lead;
  lead = function (i) {
    deskLead(i);
    for (const row of document.querySelectorAll('.modal .ta-leadfacts .od-kv')) {
      const k = row.firstElementChild?.textContent, v = row.lastElementChild, text = v?.textContent.trim();
      if (!text || v.querySelector('.muted')) continue;
      if (k === 'Phone') v.innerHTML = `<a href="tel:${esc(text.replace(/[^\d+]/g, ''))}">${esc(text)}</a>`;
      if (k === 'Email') v.innerHTML = `<a href="mailto:${esc(text)}">${esc(text)}</a>`;
    }
  };
}

/* ---------- 6. Order lookup ---------- */
{
  const WAITING = { 'Submitted · Awaiting review': 'The office is still reviewing this order, so the plant has not started it.', 'Correction requested': 'The office asked for a correction, so the plant has not started it.' };
  const deskFilter = filterOrders;
  filterOrders = function (q) {
    deskFilter(q);
    const text = String(q || '').trim().toLowerCase();
    /* One status: an order the office has not approved is not "in production". */
    const line = $('#ta-serial'), sale = text && S.sales.find((s) => s.id.toLowerCase() === text);
    if (line && !line.hidden && sale && WAITING[sale.status]) line.innerHTML = `${icon('build', 18)}<span><strong>Plant status.</strong> ${WAITING[sale.status]}</span>`;
    /* Search hides what does not match, in every list on the page. */
    for (const list of document.querySelectorAll('#app .changesummary, #app .sp-builds')) {
      let shown = 0;
      for (const row of list.querySelectorAll('.advicerow, .buildrow')) { row.hidden = !!text && !row.textContent.toLowerCase().includes(text); shown += row.hidden ? 0 : 1; }
      list.hidden = !!text && !shown;
      if (list.classList.contains('sp-builds') && list.previousElementSibling?.classList.contains('sectionhead')) list.previousElementSibling.hidden = list.hidden;
    }
  };
  const deskOrders = orders;
  orders = function () {
    return deskOrders().replace(/(In production at ShedCor<\/h2>\s*<section class="panel)(">)/, '$1 sp-builds$2');
  };
}

/* ---------- 7. A quote says Quote ---------- */
{
  const deskOrder = orderPage;
  orderPage = function () {
    let html = deskOrder();
    const s = S.sales.find((x) => x.id === S.activeSale);
    if (!s || s.status !== 'Quote issued') return html;
    html = html.replace(/(<div class="eyebrow">)Invoice /, '$1Quote ');
    const end = html.indexOf('>Finalize this sale</button></div>'), start = end < 0 ? -1 : html.lastIndexOf('<div class="actions">', end);
    if (start < 0) return html;
    const stop = end + '>Finalize this sale</button></div>'.length, actions = html.slice(start, stop);
    html = html.slice(0, start) + html.slice(stop);
    const at = html.indexOf('<div class="od-grid">');
    return at < 0 ? html : html.slice(0, at) + `<section class="panel sp-next"><div class="grow"><small class="eyebrow">Next step</small><strong>This is a quote, not an order yet.</strong><span>When the customer is ready to buy, finalize the sale.</span></div>${actions}</section>` + html.slice(at);
  };
}

/* =====================================================================================================
   Second batch from the Nov 16, 2026 review. Words are written for someone with a 5th grade education
   and no technical background.

   B1. Performance page in plain words: this lot only, one "show the last N days" picker, a list that
       fits a phone.
   B2. One down payment: a lot building shows what is due at signing from the office's rent-to-own
       terms (taRtoCalc), the same number billing uses.
   B3. Sales words in the designer and the sale's pop-ups.
   B4. My lot on a phone: a short list, and build age and lot value behind "Staff details".
   B5. A custom sale asks the delivery questions before the customer's details and the money.
   Turbo Assist: rent-to-own terms come from the RTO Terms table (`loadRtoTermsForOrg`); the site
   answers have no record there yet (the preview keeps them on the order, `s.site`). The Performance
   page, the short lot list and asking first are desk behaviour the product still has to accept.
   ===================================================================================================== */

/* ---------- B3. Sales words ---------- */
const SP_WORDS = [
  ['Package prices come from Turbo Assist’s price list and stay the same across sizes. A price marked reference · confirm is not in that list and is left out of the estimate.', 'A package costs the same on every size. If a package says “Ask the office for the price”, it is not in the total yet.'],
  [/\+\$0\.00 reference · confirm/g, 'Ask the office for the price'],
  [/ ?reference · confirm/g, ' · ask the office for the price'],
  ['Elite series · supported by catalog rule', 'Elite series'],
  ['Add TechShield (free upgrade to 7/16" thickness)', 'Add TechShield heat barrier (comes with thicker 7/16" siding)'],
  ['Front and rear lofts are included in this demo package.', 'Front and rear lofts are included.'],
  [/Price to confirm/g, 'Ask the office for the price'],
  ['Base and options from Turbo Assist’s price list · before tax / final delivery. Preview only. No live order or payment.', 'Prices come from the price list. Tax and delivery are added later.'],
  ['Unit price snapshot · before tax / final delivery. Preview only. No live order or payment.', 'This is the price on the lot. Tax and delivery are added later.'],
  ['Reference base + sample options · before tax / final delivery. Preview only. No live order or payment.', 'Prices come from the price list. Tax and delivery are added later.'],
  ['<small>Reference estimate</small>', '<small>Estimate</small>'],
  ['Fictional customer', 'Customer'],
  ['Preview estimates · tax and delivery to be confirmed.', 'The office adds sales tax later.'],
  ['Simulated deposit ($)', 'Money taken today ($)'],
  ['Deposit entry is a demo amount. Final balance depends on taxes, delivery and applicable terms.', 'The rest is due before delivery. Tax and delivery can change the final amount.'],
  ['Simulated deposit: ', 'Paid today: '],
  ['Save this configuration and its reference estimate. Revisions create a new version.', 'This saves the building and its price as a quote. If you change the building later, the first quote is kept too.'],
  ['Typed signature is a preview mark only, not an executed agreement.', 'Typing your name here marks the quote as yours.'],
  ['Valid for (days)', 'Good for how many days'],
  ['Payment preference', 'How they want to pay'],
  [/-month RTO estimate/g, '-month rent-to-own'],
  ['Estimates, not approved terms.', 'These are estimates. The rent-to-own company sets the final payment.'],
];
const spWords = (html) => SP_WORDS.reduce((h, [a, b]) => (typeof a === 'string' ? h.split(a).join(b) : h.replace(a, b)), String(html));
{
  const deskConfigure = configure, deskSummary = summary, deskModal = modal;
  configure = function () { return spWords(deskConfigure()); };
  summary = function () { return spWords(deskSummary()); };
  modal = function (title, body) { return deskModal(title, document.body.dataset.side === 'sales' ? spWords(body) : body); };
}

/* ---------- B2. One down payment ---------- */
/* What is due at signing on the chosen term, from the office's rent-to-own terms. */
function spDueAtSigning(u, months = S.term) {
  const c = typeof taRtoCalc === 'function' ? taRtoCalc(months, u.price) : null;
  return c ? { amount: c.minToday, payments: c.downPayments } : { amount: u.down, payments: null };
}
{
  const say = (n) => (n == null ? '' : n === 1 ? 'the first payment' : `the first ${n} payments`);
  const deskUnit = unitPage;
  unitPage = function () {
    const html = deskUnit(), u = lots[S.unit];
    if (!u) return html;
    const d = spDueAtSigning(u);
    return html
      .replace(`<div><dt>Down payment</dt><dd>${money(u.down)}</dd></div>`, `<div><dt>Due at signing</dt><dd>${money(d.amount)}</dd></div>`)
      .replace('Payments are estimates, not approved terms. Down payment is the amount shown on the listing.', `These are estimates. The rent-to-own company sets the final payment. Due at signing is ${say(d.payments) || 'the down payment'} on the ${S.term}-month plan, before tax.`);
  };
}

/* ---------- B4. My lot: a short list on a phone; staff details on request ---------- */
{
  const phone = () => window.matchMedia('(max-width: 680px)').matches;
  const listView = () => (S.lotView ? S.lotView === 'list' : phone());
  const deskPills = lotPills;
  lotPills = function (u) {
    const html = deskPills(u);
    return S.lotStaff ? html : html.replace(/<span class="pill (?:amber|ghost)">Built \d+ days ago<\/span>/, '');
  };
  const deskSummaryStrip = lotSummaryMarkup;
  lotSummaryMarkup = function () {
    const html = deskSummaryStrip();
    if (S.lotStaff) return html;
    /* Lot value and build age are for staff, not for a customer looking over a shoulder. */
    return html
      .replace(/<div class="kpi"><strong>[^<]*<\/strong><span>lot value<\/span><\/div>/, '')
      .replace(/<div class="kpi"><strong>[^<]*<\/strong><span>average days since built<\/span><\/div>/, '')
      .replace(/<p class="source">Oldest build on the lot[\s\S]*?<\/p>/, '');
  };
  const deskCards = lotCards;
  lotCards = function () {
    if (!listView()) return deskCards();
    const rows = lotResults();
    if (!rows.length) return deskCards();
    return `<div class="sp-lotlist">${rows.map(({ u, i }) => {
      const open = u.status === 'Available' ? `openUnit(${i})` : `pickLot(${i})`;
      return `<button type="button" class="sp-lotrow" onclick="${open}" aria-label="View ${esc(u.name)}">
        <img src="${esc(lotImg(u.photos?.[0] || u.photo, 256))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <span class="grow"><strong>${esc(lotSize(u))} ${esc(label(u.c).replace(/^\d+x\d+\s*/, ''))}</strong>
          <small>${esc(u.c.color || '')}${u.condition === 'used' ? ' · Pre-owned' : ''}${u.status === 'Available' ? '' : ' · ' + esc(u.status)}</small></span>
        <span class="sp-lotpay"><strong>${money(payment(u.price, S.term))}</strong><small>a month</small><small>${lotCash(u)} cash</small></span>
      </button>`;
    }).join('')}</div>`;
  };
  window.spLotView = function (v) { S.lotView = v; render(); };
  window.spLotStaff = function () { S.lotStaff = !S.lotStaff; render(); };
  const deskLot = lot;
  lot = function () {
    const list = listView();
    const tools = `<div class="sp-lottools" role="group" aria-label="How the lot is shown">
      <button type="button" class="chipbtn${list ? ' on' : ''}" aria-pressed="${list}" onclick="spLotView('list')">Short list</button>
      <button type="button" class="chipbtn${list ? '' : ' on'}" aria-pressed="${!list}" onclick="spLotView('cards')">Photos</button>
      <button type="button" class="chipbtn${S.lotStaff ? ' on' : ''}" aria-pressed="${!!S.lotStaff}" onclick="spLotStaff()">Staff details</button></div>`;
    return deskLot()
      .replace('<div class="lotcount">', tools + '<div class="lotcount">')
      .replace(/ copied from the buybennett\.com listing on ([^.]*)\. Availability here is simulated, so confirm a building is still on the lot before quoting\./, ' from the buybennett.com listing on $1. Check that a building is still on the lot before you quote it.');
  };
}

/* ---------- B1. Performance in plain words ---------- */
{
  const STATUS = { Processed: 'Sold', Pending: 'Sale in progress' };
  const day = (d) => new Date(d + (String(d).length <= 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const tile = (text, value) => `<div class="metric">${text}<strong>${value}</strong></div>`;
  window.spPerfDays = function (n) { S.filter.days = n; S.taStatDays = n; render(); };
  performanceScreen = function () {
    const f = S.filter, days = f.days || 90;
    S.taStatDays = days;
    /* The sample records belong to this lot on this page; the old page showed two Georgia lots. */
    const cut = new Date('2026-11-03T12:00:00Z').getTime() - days * 864e5;
    const rows = history.filter((h) => (f.rep === 'All' || h.rep === f.rep) && (f.style === 'All' || h.style === f.style) && new Date(h.date).getTime() >= cut);
    const sold = rows.filter((h) => h.status === 'Processed'), pending = rows.filter((h) => h.status === 'Pending'), onLot = rows.filter((h) => h.status !== 'Processed');
    const avg = sold.length ? Math.round(sold.reduce((a, h) => a + h.days, 0) / sold.length) : null;
    const liveCut = Date.now() - days * 864e5;
    const mine = S.sales.filter(deskSale).filter((s) => s.status !== 'Quote issued' && (!s.submittedAt || Date.parse(s.submittedAt) >= liveCut));
    const done = mine.filter((s) => ['Delivered', 'Cancelled'].includes(s.status)).length;
    const reps = ['All', ...new Set(history.map((h) => h.rep))];
    const pick = (text, key, opts) => `<label>${text}<select onchange="S.filter.${key}=this.value;render()">${opts.map((x) => `<option value="${esc(x)}" ${x === f[key] ? 'selected' : ''}>${x === 'All' ? 'Everyone' : esc(x)}</option>`).join('')}</select></label>`;
    const styles = ['All', ...Object.keys(descriptions)];
    return head(`HOW THE LOT IS SELLING · ${LOT_LOCATION.toUpperCase()}`, 'What sells. What sits.', 'These are sample numbers, so you can see how the page works. They are not real sales.') +
      `<section class="panel sp-perf"><div class="fields">
        <label>Show the last<select id="sp-perf-days" onchange="spPerfDays(+this.value)">${[30, 60, 90, 365].map((d) => `<option value="${d}" ${d === days ? 'selected' : ''}>${d === 365 ? '12 months' : d + ' days'}</option>`).join('')}</select></label>
        ${pick('Salesperson', 'rep', reps)}
        <label>Building style<select onchange="S.filter.style=this.value;render()">${styles.map((x) => `<option value="${esc(x)}" ${x === f.style ? 'selected' : ''}>${x === 'All' ? 'All styles' : esc(x)}</option>`).join('')}</select></label></div>
        <h2>Buildings on this lot</h2>
        <div class="metricrow">${tile('Came in', rows.filter((h) => new Date(h.received).getTime() >= cut).length)}${tile('Sold', sold.length)}${tile('Sale in progress', pending.length)}${tile('Still on the lot', onLot.length)}</div>
        <p>${avg == null ? 'No building sold in this time.' : `A building that sold sat on the lot for about <strong>${avg} days</strong>.`}</p>
        <h2>Sales at this desk</h2>
        <div class="metricrow">${tile('Sales started', mine.length)}${tile('Finished', done)}${tile('Still open', mine.length - done)}${tile('Quotes written today', S.quotes.length)}</div>
        ${S.quotes.length ? `<p class="sp-chips">${S.quotes.map((q) => `<button class="chipbtn" onclick="S.activeQuote='${q.id}';go('quote')">Quote ${q.id} · ${esc(q.customer)}</button>`).join(' ')}</p>` : ''}
      </section>
      <section class="panel sp-perf" style="margin-top:20px"><h2>Each building</h2>
        <label class="searchbar">${icon('orders')}<input class="search" aria-label="Search the buildings" placeholder="Search a size, color or option" oninput="document.querySelectorAll('.sp-perfrow').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(this.value.toLowerCase()))"></label>
        <div class="sp-perflist">${rows.map((h) => `<button type="button" class="sp-perfrow" onclick="historyDetail('${h.id}')">
          <span class="grow"><strong>${esc(h.size)} ${esc(h.style)} · ${money(h.price)}</strong><small>${esc(h.siding)} · ${esc(h.color)} · ${esc(h.options)}</small></span>
          <span class="sp-perfwhen"><span class="pill ${h.status === 'Processed' ? 'good' : h.status === 'Pending' ? 'amber' : 'ghost'}">${STATUS[h.status] || 'On the lot'}</span><small>${h.status === 'Processed' ? `after ${h.days} days · ${day(h.date)}` : `${h.days} days on the lot`}</small><small>${esc(h.rep)}</small></span>
        </button>`).join('') || '<p class="empty">No buildings match. Try a longer time.</p>'}</div>
      </section>`;
  };
  historyDetail = function (id) {
    const h = history.find((x) => x.id === id);
    if (!h) return;
    modal(`${h.size} ${h.style}`, `<p>${esc(h.siding)} · ${esc(h.color)}<br>${esc(h.options)}</p>
      <div class="od-kv"><span>Price</span><strong>${money(h.price)}</strong></div>
      <div class="od-kv"><span>Came to the lot</span><strong>${day(h.received)}</strong></div>
      <div class="od-kv"><span>${h.status === 'Processed' ? 'Sold' : 'Last update'}</span><strong>${day(h.date)}</strong></div>
      <div class="od-kv"><span>Days on the lot</span><strong>${h.days}</strong></div>
      <div class="od-kv"><span>Salesperson</span><strong>${esc(h.rep)}</strong></div>
      <div class="od-kv"><span>Where it stands</span><strong>${STATUS[h.status] || 'On the lot'}</strong></div>
      <p class="source">A sample record, not a real sale.</p>`);
  };
}

/* ---------- B5. Delivery questions before the price (custom sale) ---------- */
{
  const custom = () => !['lot', 'stock', 'site'].includes(S.path);
  const fee = (d) => ofDelivery({ site: d, money: null });
  const feeText = (d) => {
    const r = fee(d);
    if (r.miles == null) return 'Type the miles to see the delivery charge.';
    if (r.over) return `More than ${OF.set.overTo} miles. Logistics sets the delivery charge and tells you.`;
    return r.fee ? `Delivery is <strong>${money(r.fee)}</strong> for ${r.miles} miles.` : `Delivery is <strong>free</strong> (${r.miles} miles, within ${FREE_DELIVERY_MILES}).`;
  };
  window.spSiteFee = function () {
    const el = $('#sp-site-fee');
    if (el) el.innerHTML = feeText({ miles: $('#sp-site-miles').value.trim() === '' ? '' : Number($('#sp-site-miles').value) });
  };
  window.spSiteAsk = function () {
    const d = S.sitePre || {}, width = Number(S.c.size.split('x')[0]);
    const pick = (name, text, opts) => `<label>${text}<select id="sp-site-${name}"><option value="">Choose one</option>${opts.map((x) => `<option ${d[name] === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
    modal('Where is the building going?', `<p>Ask these now, so the delivery charge is in the price the customer agrees to.</p>
      <div class="fields"><label>Miles from the lot to their place<input id="sp-site-miles" type="number" min="0" step="1" value="${d.miles ?? ''}" inputmode="numeric" oninput="spSiteFee()"></label>
      <label>Narrowest gate or opening, in feet<input id="sp-site-gate" type="number" min="0" step="0.5" value="${d.gate ?? ''}" ${d.noGate ? 'disabled' : ''} inputmode="decimal"></label>
      ${pick('access', 'Can the truck get in?', ['Clear access', 'Tight access', 'Not sure, needs a look'])}${pick('ground', 'The ground where it will sit', ['Level', 'Slight slope', 'Needs leveling'])}</div>
      <label class="checkrow"><input id="sp-site-nogate" type="checkbox" ${d.noGate ? 'checked' : ''} onchange="$('#sp-site-gate').disabled=this.checked"> <span>No gate or opening to pass through</span></label>
      <label class="field">Notes for the driver (optional)<input id="sp-site-notes" maxlength="160" value="${esc(d.notes || '')}" placeholder="Trees, wires, soft ground, where it goes"></label>
      <p class="sp-sitefee" id="sp-site-fee" role="status"></p>
      <p class="source">A ${width} ft wide building needs a ${width + 2} ft opening and 14 ft of height clear of wires and limbs.</p>
      <div class="actions">${button('← Back to the building', 'closeModal()', 'secondary')}${button('Continue ' + icon('arrow', 18), 'spSiteSave()')}</div>`);
    spSiteFee();
  };
  window.spSiteSave = function () {
    const v = (k) => $('#sp-site-' + k).value.trim(), noGate = $('#sp-site-nogate').checked;
    const d = { miles: v('miles') === '' ? '' : Math.max(0, Number(v('miles')) || 0), gate: noGate || v('gate') === '' ? '' : Number(v('gate')), noGate, access: v('access'), ground: v('ground'), notes: v('notes') };
    const gaps = siteMissing(d);
    if (gaps.length) return toast(`Still to ask: ${gaps.join(', ')}.`);
    S.sitePre = { ...d, askedBy: 'Salesperson', askedAt: Date.now(), confirmed: null };
    closeModal();
    finalizeForm();
  };
  /* One line on each of the sale's pop-ups: where it is going and what delivery costs. */
  const line = () => {
    const d = S.sitePre;
    if (!custom() || !d) return '';
    return `<p class="sp-delivery"><span><strong>Delivery.</strong> ${feeText(d).replace('Delivery is ', '').replace(/^./, (c) => c.toUpperCase())}</span><button type="button" class="link inline" onclick="spSiteAsk()">Change</button></p>`;
  };
  const put = (sel) => {
    const el = document.querySelector(sel);
    if (el && !el.parentNode.querySelector('.sp-delivery')) el.insertAdjacentHTML('beforebegin', line());
  };
  const deskFinalize = finalizeForm;
  finalizeForm = function (details) {
    if (!details && custom() && !(S.sitePre && !siteMissing(S.sitePre).length)) return spSiteAsk();
    deskFinalize(details);
    put('#customerInfo');
  };
  const deskBilling = openBilling;
  openBilling = function () {
    deskBilling();
    put('#saleBilling');
  };
  const deskReview = showSaleReview;
  showSaleReview = function () {
    deskReview();
    const m = document.querySelector('.modal'), d = S.sitePre;
    if (!m || !custom() || !d) return;
    for (const li of m.querySelectorAll('.sf-next li')) if (/delivery-site questions/.test(li.textContent)) li.remove();
    const r = fee(d), disc = reviewBilling?.discount > 0 ? reviewBilling.discount : 0;
    m.querySelector('h3')?.insertAdjacentHTML('beforebegin', line() + (r.fee && !r.over ? `<p class="sp-withdelivery">Building and delivery together: <strong>${money(Math.round((amount() - disc + r.fee) * 100) / 100)}</strong>, before tax.</p>` : ''));
  };
  /* The answers go onto the order as it is created, so the order page's step arrives done. */
  const deskSubmit = submitSale;
  submitSale = function () {
    const d = custom() ? S.sitePre : null;
    deskSubmit();
    const s = S.sales.find((x) => x.id === S.activeSale);
    if (!d || !s || s.path === 'lot' || s.site) return;
    s.site = d;
    const charge = siteFeeSync(s);
    ofLog(s, `Salesperson recorded the delivery site at the sale: ${siteLine(s)}${charge ? ` · ${money(charge)} delivery charge` : ''}`);
    S.sitePre = null;
    render();
  };
  const deskBegin = begin;
  begin = function (which) {
    S.sitePre = null;
    return deskBegin(which);
  };
}
