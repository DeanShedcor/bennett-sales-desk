/* lot-flyer.js: a one-page flyer for a building on the lot.

   A salesperson asked for a handout: the size, the price and the photo on top, then the colors,
   package and options, then a rent-to-own estimate for all four terms, then the lot's address and
   phone, the salesperson's name and a QR code.

   The QR code opens that building's own online listing (the link kept with each lot building). The
   link carries a tag (utm_source=flyer, utm_medium=qr, the lot and the building) so the real
   website's visitor counts can tell a flyer scan from other visits. Counting who then bought
   online has to happen on the website's side; this preview cannot do it.

   Turbo Assist has no flyer or handout function. This is a feature the product still has to accept.
   Loaded late; wraps unitPage(). Uses qr.js (the same QR maker the quote uses). */
{
  const KEY = 'sales:flyer-name';
  const myLot = () => (typeof LOTS === 'object' && LOTS.find((l) => l.id === DESK_LOT)) || null;
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const savedName = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const seller = () => savedName() ?? (typeof adMe === 'function' && adMe() ? adMe().name : '');

  /* The listing link with the flyer tag added. */
  function lotFlyerLink(u) {
    if (!u.url) return '';
    const lot = myLot();
    const tag = `utm_source=flyer&utm_medium=qr&utm_campaign=${encodeURIComponent(slug(lot ? lot.town : u.location))}&utm_content=${encodeURIComponent(u.id)}`;
    return u.url + (u.url.includes('?') ? '&' : '?') + tag;
  }
  function qr(link) {
    try { const code = qrcode(0, 'M'); code.addData(link); code.make(); return code.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); } catch (e) { return ''; }
  }
  function lotFlyerHtml(u, name = seller()) {
    const [w, l] = u.c.size.split('x').map(Number), lot = myLot(), d = lotDetails(u), link = lotFlyerLink(u), code = link ? qr(link) : '';
    const list = (items, none) => `<ul>${(items.length ? items : [none]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const terms = [24, 36, 48, 60].map((t) => ({ t, pay: payment(u.price, t), due: typeof spDueAtSigning === 'function' ? spDueAtSigning(u, t).amount : u.down }));
    return `<article class="flyer" aria-label="Flyer for ${esc(u.name)}">
      <header class="fl-top"><div><small>Bennett Buildings${lot ? ' · ' + esc(lot.town) + ', ' + lot.state : ''}</small><h1>${esc(u.name)}</h1><p>${esc(lotSize(u))} · ${w * l} sq ft · ${esc(label(u.c))}</p></div>
        <div class="fl-price">${u.listPrice ? `<s>${money(u.listPrice)}</s>` : ''}<strong>${money(u.price)}</strong>${u.listPrice ? `<em>Save ${money(u.listPrice - u.price)}</em>` : '<em>Cash price, before tax</em>'}</div></header>
      <div class="fl-photo"><img src="${esc(lotImg(u.photos[0], 1080))}" alt="${esc(u.name)}" onerror="this.parentNode.classList.add('none')"></div>
      <section class="fl-details"><h2>Building details</h2><div class="fl-groups">
        <div><h3>Colors</h3>${list(d.colors)}</div><div><h3>Package</h3>${list(d.pack, 'No package')}</div><div><h3>Options</h3>${list(d.options, 'No added options')}</div></div></section>
      <section class="fl-rto"><h2>Rent-to-own estimate</h2>
        <table><thead><tr><th>Months</th>${terms.map((x) => `<th>${x.t}</th>`).join('')}</tr></thead><tbody>
          <tr><th>Payment each month</th>${terms.map((x) => `<td><strong>${money(x.pay)}</strong></td>`).join('')}</tr>
          <tr><th>Due at signing</th>${terms.map((x) => `<td>${money(x.due)}</td>`).join('')}</tr></tbody></table>
        <p>Estimate, before tax. The rent-to-own company sets the final payment.</p></section>
      <footer class="fl-foot"><div class="fl-contact"><h2>Come see it</h2>
          ${lot ? `<p><strong>Bennett Buildings · ${esc(lot.town)}</strong><br>${esc(lot.street)}<br>${esc(lot.town)}, ${lot.state} ${lot.zip}</p><p class="fl-phone">${esc(lot.phone)}</p>` : `<p><strong>${esc(u.location)}</strong></p>`}
          ${name ? `<p>Ask for <strong>${esc(name)}</strong></p>` : ''}<p class="fl-id">Building ${esc(u.id)}</p></div>
        ${code ? `<div class="fl-qr">${code}<p>Scan to see this building online</p></div>` : ''}</footer>
    </article>`;
  }
  function lotFlyer(i) {
    const u = lots[i];
    if (!u) return;
    modal('Flyer', `<p class="no-print">This prints on one page. Hand it to the customer.</p>
      <label class="field no-print">Salesperson name on the flyer<input id="fl-name" maxlength="40" value="${esc(seller())}" oninput="lotFlyerName(${i},this.value)"></label>
      <div id="fl-box" class="fl-box">${lotFlyerHtml(u)}</div>
      <p class="source no-print">${u.url ? 'The QR code opens this building’s own page online. The link is tagged so the website can count how many people scanned a flyer. Counting who then bought online is done on the website.' : 'This building has no online page yet, so the flyer has no QR code.'}</p>
      <div class="actions no-print">${button('Close', 'closeModal()', 'secondary')}${button('Print flyer', `lotFlyerPrint(${i})`, 'primary')}</div>`);
    document.querySelector('.modal')?.classList.add('wide');
  }
  function lotFlyerName(i, value) {
    try { localStorage.setItem(KEY, value.trim()); } catch (e) {}
    const box = document.getElementById('fl-box');
    if (box) box.innerHTML = lotFlyerHtml(lots[i], value.trim());
  }
  /* Printing: the page prints only the flyer, then comes back. */
  function lotFlyerPrint(i) {
    const u = lots[i];
    if (!u) return;
    let box = document.getElementById('fl-print');
    if (!box) document.body.insertAdjacentHTML('beforeend', '<div id="fl-print"></div>'), (box = document.getElementById('fl-print'));
    box.innerHTML = lotFlyerHtml(u, document.getElementById('fl-name')?.value.trim() ?? seller());
    document.body.classList.add('fl-printing');
    const done = () => document.body.classList.remove('fl-printing');
    addEventListener('afterprint', done, { once: true });
    setTimeout(done, 60000);
    const img = box.querySelector('img'), go = () => print();
    if (img && !img.complete) { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); } else go();
  }
  Object.assign(window, { lotFlyer, lotFlyerHtml, lotFlyerLink, lotFlyerName, lotFlyerPrint });

  const baseUnit = unitPage;
  unitPage = function () {
    const html = baseUnit();
    return lots[S.unit] ? html.replace('<div class="unitactions-row">', `<div class="unitactions-row">${button('Print flyer', `lotFlyer(${S.unit})`, 'secondary')}`) : html;
  };

  try {
    AW_REAL.sales.push('A building on the lot has a one-page flyer to print: photo, price, details, a rent-to-own estimate, the lot’s phone and a QR code to its page online.');
    AW_OPEN.push(['Flyer and the QR code', 'The flyer is new; Turbo Assist has no handout. The QR link is tagged so the website can count scans. Should the website also count who bought after scanning?']);
  } catch (e) {}
}
