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
