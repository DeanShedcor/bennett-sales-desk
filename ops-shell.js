/* ops-shell.js: puts the Office, Production and Logistics sides in the same shell as the Sales
   desk and Plant QC.

   One render() for all five sides. A page named "office" or "of-…" is the Office; "prod" or
   "pr-…" is Production; "logi" or "lg-…" is Logistics; everything else is handed back to the
   render the other two sides already share.
   Loaded last. */

/* Icons the two new sides use. Same drawing style as the rest (24 × 24, 2px round strokes). */
Object.assign(ICONS, {
  truck: '<path d="M2.500 6.500h11v9.500h-11z"/><path d="M13.500 10h4l3 3.200V16h-7"/><circle cx="7" cy="17.500" r="1.900"/><circle cx="17" cy="17.500" r="1.900"/>',
  trailer: '<path d="M2 8.500h15v6.500H2z"/><path d="M17 15h4.500"/><circle cx="7" cy="17" r="1.900"/><circle cx="12.500" cy="17" r="1.900"/>',
  box: '<path d="M3.500 8 12 4l8.500 4v8L12 20l-8.500-4z"/><path d="M3.500 8 12 12l8.500-4M12 12v8"/>',
  calendar: '<rect x="4" y="5.500" width="16" height="14.500" rx="2"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/>',
  cash: '<rect x="3" y="6.500" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.600"/>',
  inbox: '<path d="M4 13.500 6.500 5h11L20 13.500V19H4z"/><path d="M4 13.500h4.500l1 2.500h5l1-2.500H20"/>',
  sliders: '<path d="M4 7h9M18 7h2M4 17h2M11 17h9"/><circle cx="15.500" cy="7" r="2.200"/><circle cx="8.500" cy="17" r="2.200"/>',
  list: '<path d="M8.500 7H20M8.500 12H20M8.500 17H20"/><path d="M4 7h.01M4 12h.01M4 17h.01"/>',
  wheel: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="2"/><path d="M12 14v6.500M3.800 10.500l6.300 1M20.200 10.500l-6.300 1"/>',
  phone: '<path d="M6 3.500h3l1.500 4-2 1.500a11 11 0 0 0 6.500 6.500l1.500-2 4 1.500v3a2 2 0 0 1-2.200 2A16.500 16.500 0 0 1 4 5.700 2 2 0 0 1 6 3.500z"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
});
document.querySelectorAll('[data-ops-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.opsIcon, el.classList.contains('tab-sale') ? 24 : 22)));

const OPS_SCREENS = { ...(typeof OFFICE_SCREENS === 'object' ? OFFICE_SCREENS : {}), ...(typeof PROD_SCREENS === 'object' ? PROD_SCREENS : {}), ...(typeof LOGI_SCREENS === 'object' ? LOGI_SCREENS : {}) };
const opsSide = (page) => (page === 'office' || String(page).startsWith('of-') ? 'office' : page === 'prod' || String(page).startsWith('pr-') ? 'prod' : page === 'logi' || String(page).startsWith('lg-') ? 'logi' : null);
/* Detail screens: [page to go back to, its name, the title in the phone's top bar]. */
function opsDetail(page) {
  if (page === 'of-order') return [OF.back, OF.back === 'of-orders' ? 'Orders' : OF.back === 'of-pay' ? 'Payments' : 'To do', ofSale(OF.id)?.customer || 'Order'];
  if (page === 'of-notes') return ['office', 'To do', 'About this preview'];
  if (page === 'lg-notes') return ['logi', 'Dispatch', 'About this preview'];
  if (page === 'pr-notes') return ['prod', 'Board', 'About this preview'];
  if (page === 'pr-unit') return [PR.back, PR.back === 'pr-list' ? 'Units' : 'Board', PR.id || 'Building'];
  if (page === 'lg-load' && typeof lgDetailNav === 'function') return lgDetailNav();
  return null;
}
/* Which menu item lights up. A detail screen lights the list it was opened from. */
const opsNav = (page) => opsDetail(page)?.[0] || page;

/* Product notes, tucked under each screen: what Turbo Assist already does for each control here,
   and what exists only in this preview. Closed until someone opens it. */
function opsNotes(hooks = [], only = []) {
  return `<details class="ops-notes" ${S.opsNotes ? 'open' : ''} ontoggle="S.opsNotes=this.open"><summary>Product notes for this screen</summary>
    <p>Turbo Assist (bennett-buddy, read at commit b42d324) decides what each step does. This is what each control here would call, and what exists only in this preview so far.</p>
    ${hooks.length ? `<h4>Turbo Assist already does this</h4><ul>${hooks.map(([k, v]) => `<li><b>${k}</b> ${v}</li>`).join('')}</ul>` : ''}
    ${only.length ? `<h4>Only in this preview</h4><ul>${only.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}</details>`;
}

let opsView = '';
{
  const otherSides = render;
  render = function () {
    const side = opsSide(S.page), screen = OPS_SCREENS[S.page];
    if (!side || !screen) {
      opsView = '';
      return otherSides();
    }
    if (typeof syncSales === 'function') syncSales();
    if (typeof lgSync === 'function') lgSync();
    const detail = opsDetail(S.page), nav = opsNav(S.page);
    document.body.dataset.side = side;
    document.body.dataset.page = S.page;
    document.body.classList.toggle('qc-detail', !!detail);
    document.querySelectorAll('[data-nav]').forEach((b) => {
      const on = b.dataset.nav === nav;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('#appnav').innerHTML = detail ? `<button class="appback" onclick="go('${detail[0]}')">${icon('back', 20)}<span>${esc(detail[1])}</span></button><strong>${esc(detail[2])}</strong><span></span>` : '';
    const app = $('#app');
    app.innerHTML = screen();
    const view = S.page + '|' + (detail ? detail[2] : '');
    if (view !== opsView) {
      app.classList.remove('qc-enter', 'qc-enter-detail');
      void app.offsetWidth;
      app.classList.add(detail ? 'qc-enter-detail' : 'qc-enter');
      opsView = view;
    }
    if (typeof syncDealer === 'function') syncDealer();
    if (typeof lgAfterRender === 'function') lgAfterRender();
  };
}

/* The build sheet opens over whatever screen is showing. Coming back to an Office or Logistics
   screen redraws it, so a layout confirmed in the sheet shows as confirmed. */
{
  const sheetClose = closeBuildSheet;
  closeBuildSheet = function () {
    sheetClose();
    if (opsSide(S.page)) render();
  };
}

render();
