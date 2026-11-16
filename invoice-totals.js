/* invoice-totals.js: the invoice the customer signs adds up.

   Before: paid extras read "Included", the fuel surcharge had no line, "Subtotal" already held
   the delivery charge and "Delivery" was listed again under it, and there was no Total.
   Now, for an invoice built from the sale (not the fixed sample invoice):
   - each priced line from the price breakdown shows its amount; no-charge items read "Included";
   - totals read Subtotal (building and options), Delivery, Sales tax, Total, Amount due today
     and Balance after today's payment. A rent-to-own invoice keeps its monthly lines.
   Existing function hooked: orderDoc('invoice') and orderInvoice(s). Turbo Assist's own invoice
   comes from the sales order's line items (`sales_order_line_items`); this is the desk's view.
   Loaded after the office files so it draws last. */
{
  const baseDoc = orderDoc;
  const cents = (n) => Math.round(n * 100) / 100;
  const same = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); return a === b || a.startsWith(b) || b.startsWith(a); };

  /* The building line, then every priced line, then what is included at no charge. */
  function invoiceLines(s, inv) {
    if (typeof breakdown !== 'function' || !s.c) return null;
    let rows;
    try { rows = breakdown(s.c); } catch (e) { return null; }
    if (!rows.length || Math.abs(cents(rows.reduce((t, r) => t + r.amount, 0)) - s.total) > 0.005) return null; /* prices moved since the sale: keep the old lines */
    const priced = rows.slice(1).filter((r) => r.amount);
    /* "No shutters" and "None electrical" are not things the customer is buying, so they are left off. */
    const free = inv.lines.slice(1).filter(([d, , t]) => t == null && !/^(No|None) /.test(d) && !priced.some((r) => same(r.name, d)));
    const office = inv.lines.slice(1).filter(([, , t]) => t != null);
    return [[inv.lines[0][0], 1, rows[0].amount], ...priced.map((r) => [r.name, 1, r.amount]), ...free, ...office];
  }

  orderDoc = function (kind) {
    baseDoc(kind);
    const s = S.sales.find((x) => x.id === S.activeSale), paper = document.querySelector('.modal .od-paper');
    if (kind !== 'invoice' || !s || !paper) return;
    const inv = orderInvoice(s);
    if (!inv.derived) return;
    const isDelivery = ([d, , t]) => t != null && /^Delivery · /.test(d);
    const fee = cents(inv.lines.filter(isDelivery).reduce((t, x) => t + x[2], 0));
    const sub = cents(inv.subtotal - fee);

    const lines = invoiceLines(s, inv);
    const body = paper.querySelector('.od-lines tbody');
    if (lines && body)
      body.innerHTML = lines.filter((x) => !isDelivery(x)).map(([d, q, t], i) => `<tr><td>${esc(d)}${i === 0 ? `<small>${inv.serial ? 'Serial number ' + esc(inv.serial) + '<br>' : ''}${inv.finish.map(([k, v]) => `${k}: ${esc(v)}`).join(', ')}</small>` : ''}</td><td>${q}</td><td>${t == null ? 'Included' : (t < 0 ? '−' : '') + money(Math.abs(t))}</td></tr>`).join('');
    else if (body) for (const tr of body.querySelectorAll('tr')) if (/^Delivery · /.test(tr.firstElementChild.textContent)) tr.remove();

    const totals = paper.querySelector('.od-totals');
    if (!totals) return;
    const rto = inv.monthly != null, taxes = inv.taxes || [], tax = taxes.length ? cents(taxes.reduce((t, x) => t + x[1], 0)) : null;
    const delivery = fee ? money(fee) : odMoney(inv.delivery);
    const out = [odRow('Subtotal · building and options', money(sub)), odRow('Delivery', esc(delivery))];
    if (rto) {
      out.push(odRow('Total price', money(cents(sub + fee)), 'strong'));
      out.push(odRow('Monthly payment before taxes', money(inv.monthly)));
      for (const [k, v] of taxes) out.push(odRow(esc(k), money(v), 'sub'));
      if (tax != null) out.push(odRow('Total monthly sales tax', money(tax)));
      if (inv.waiver != null) out.push(odRow('Liability waiver program', money(inv.waiver)));
      if (tax != null) out.push(odRow('Total monthly payment', money(cents(inv.monthly + tax + (inv.waiver || 0))), 'strong'));
      out.push(odRow('Amount due today', inv.dueToday != null ? money(inv.dueToday) : '—', 'total'));
    } else {
      const total = cents(sub + fee + (tax || 0));
      out.push(tax != null ? odRow(esc(taxes.length === 1 ? taxes[0][0] : 'Sales tax'), money(tax)) : odRow('Sales tax', 'Added by the office'));
      out.push(odRow(tax != null ? 'Total' : 'Total before sales tax', money(total), 'strong'));
      out.push(odRow('Amount due today', inv.dueToday != null ? money(inv.dueToday) : '—', 'total'));
      if (inv.dueToday != null) out.push(odRow(tax != null ? 'Balance after today’s payment' : 'Balance after today’s payment, before sales tax', money(Math.max(0, cents(total - inv.dueToday)))));
    }
    totals.innerHTML = out.join('');
  };
}

/* The customer's view of a quote carries no builder notes and no demo labels. The staff view keeps
   them. Drawn last, so no other layer puts them back. Existing function hooked: quoteView(customer). */
{
  const baseQuote = quoteView;
  quoteView = function (customer = false) {
    const html = baseQuote(customer);
    if (!customer) return html;
    return html
      .replace(/<p class="source">Estimated with[^<]*<\/p>/, '<p class="source">Monthly payments are estimates. Deposit, taxes and approval are set on the rent-to-own agreement.</p>')
      .replace('<p class="source">Manager signature · demonstration only</p>', '<p class="source">Manager signature</p>')
      .replace(/<p class="source">The link contains the immutable quote snapshot[^<]*<\/p>/, '')
      .replace(/<p class="source">All actions are simulations[^<]*<\/p>/, '')
      .replace(/<button class="link" onclick="currentQ\(\)\.expiredDemo[^>]*>[^<]*<\/button>/, '')
      .replace('Pay deposit · simulate', 'Pay deposit').replace('Deposit simulated ✓', 'Deposit recorded ✓').replace('RTO form simulated ✓', 'Application started ✓')
      .replace('Accepted · simulation', 'Accepted')
      .replace(/<br><small>[^<]*<\/small><\/td><td>/g, '</td><td>');
  };
}
