/* app-shell.js: things every side shares.

   1. Every screen has its own address (#logistics/load/AC, #office/order/AA-20411), so the
      browser's Back button goes back one screen, a refresh stays where you were, and a link to an
      order, a building or a load can be sent. The sample data starts over on a refresh, so a link
      to something that is gone lands on that side's list with a plain note.
   2. Pop-ups close with Esc or a tap outside, keep the Tab key inside, and keep Close in view.
   3. The logo opens the first screen of the side you are on. The gear remembers where you came from.
   4. No yellow button in the top bar on any side; each side's first screen keeps the action.
   5. The app is stored on the device so it opens with no signal (sw.js).
   Turbo Assist is a routed app already (react-router paths such as /logistics, /orders/:id); this
   gives the preview the same behaviour. The offline copy is a feature the product still has to accept.
   Loaded after every side, before Firefly. */

/* ---------- 1. Addresses ---------- */
const AS = { booted: false, applying: false, from: null, note: '' };
const AS_SIDE = { sales: 'sales', office: 'office', prod: 'plant', qc: 'qc', logi: 'logistics' };
const AS_HOME = { sales: 'home', office: 'office', prod: 'prod', qc: 'qc', logi: 'logi' };
const AS_PRE = { sales: '', office: 'of-', prod: 'pr-', qc: 'qc-', logi: 'lg-' };
const AS_SALES = new Set(['home', 'receipts', 'start', 'lot', 'unit', 'configure', 'quote', 'customer', 'sale', 'orders', 'restock', 'stock', 'performance', 'notes']);
const asSide = (page = S.page) => (typeof opsSide === 'function' && opsSide(page)) || (typeof QC_SCREENS === 'object' && QC_SCREENS[page] ? 'qc' : 'sales');
/* Screens that show one thing: how to read which one, how to open it by its id, and the list to
   fall back to when it is not there any more. */
const AS_ONE = {
  'of-order': { get: () => OF.id, set: (id) => !!ofSale(id) && ((OF.id = id), true), list: 'of-orders', what: 'order' },
  'of-user': { get: () => AD.open, set: (id) => AD.users.some((u) => u.id === id) && ((AD.open = id), true), list: 'of-users', what: 'person' },
  'pr-unit': { get: () => PR.id, set: (id) => !!prUnit(id) && ((PR.id = id), true), list: 'pr-list', what: 'building' },
  'lg-load': { get: () => LG.loadId, set: (id) => !!lgLoad(id) && ((LG.loadId = id), true), list: 'lg-loads', what: 'load' },
  'qc-inspect': { get: () => Q.serial, set: (id) => Q.builds.some((b) => b.serial === id) && ((Q.serial = id), true), list: 'qc', what: 'building' },
  unit: { get: () => lots[S.unit]?.id, set: (id) => { const i = lots.findIndex((l) => l.id === id); return i >= 0 && ((S.unit = i), true); }, list: 'lot', what: 'building' },
  sale: { get: () => S.activeSale, set: (id) => S.sales.some((s) => s.id === id) && ((S.activeSale = id), true), list: 'orders', what: 'order' },
  quote: { get: () => S.activeQuote, set: (id) => S.quotes.some((q) => q.id === id) && ((S.activeQuote = id), true), list: 'orders', what: 'quote' },
  customer: { get: () => S.activeQuote, set: (id) => S.quotes.some((q) => q.id === id) && ((S.activeQuote = id), true), list: 'orders', what: 'quote' },
};
function asHash() {
  const side = asSide(), page = S.page, word = page === AS_HOME[side] ? '' : page.slice(AS_PRE[side].length);
  let id = '';
  try { id = AS_ONE[page]?.get() || ''; } catch (e) {}
  return '#' + [AS_SIDE[side], word, id].filter(Boolean).map(encodeURIComponent).join('/');
}
/* Read an address into the app's state. Returns false when the address is not one of ours. */
function asApply(hash, first) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  const side = Object.keys(AS_SIDE).find((k) => AS_SIDE[k] === parts[0]);
  if (!side) return false;
  let page = parts[1] ? AS_PRE[side] + parts[1] : AS_HOME[side];
  const known = side === 'sales' ? AS_SALES.has(page) : side === 'qc' ? !!QC_SCREENS[page] : !!OPS_SCREENS[page];
  if (!known) page = AS_HOME[side];
  const one = AS_ONE[page];
  if (one) {
    let ok = false;
    try { if (side !== 'sales' && typeof syncSales === 'function') syncSales(); if (side === 'logi' && typeof lgSync === 'function') lgSync(); ok = !!parts[2] && one.set(parts[2]); } catch (e) {}
    if (!ok) {
      page = one.list;
      AS.note = `That ${one.what} is not here any more. This preview starts over when the page is reloaded.`;
    }
  }
  /* A sale being designed lives in memory. After a reload, pick the kept one up, or start again. */
  if (page === 'configure' && first) {
    S.page = 'start';
    try { if (localStorage.getItem('sales:draft') && typeof saleDraftResume === 'function') setTimeout(saleDraftResume, 0); } catch (e) {}
    return true;
  }
  S.page = page;
  return true;
}
{
  const drawn = render;
  render = function () {
    drawn.apply(this, arguments);
    try {
      asAfterDraw();
      if (AS.applying || location.hash.startsWith('#quote=')) return;
      const h = asHash();
      if (h === location.hash) return;
      if (AS.booted) window.history.pushState(null, '', h);
      else window.history.replaceState(null, '', h);
    } catch (e) {}
  };
}
addEventListener('popstate', () => {
  if (location.hash.startsWith('#quote=')) return;
  AS.applying = true;
  try {
    if (document.querySelector('.modal-back')) closeModal();
    if (asApply(location.hash, false)) { render(); scrollTo(0, 0); }
  } finally { AS.applying = false; }
  asSayNote();
});
function asSayNote() {
  if (!AS.note) return;
  const note = AS.note;
  AS.note = '';
  setTimeout(() => toast(note), 50);
}
/* Start-up: open the screen the address names. Runs before the first full draw. */
if (!location.hash.startsWith('#quote=') && location.hash.length > 1) {
  AS.applying = true;
  try { asApply(location.hash, true); } catch (e) {}
  if (S.page === 'boot') S.page = 'home'; /* not one of our addresses */
  try { render(); } catch (e) {} finally { AS.applying = false; }
}
addEventListener('DOMContentLoaded', () => setTimeout(() => {
  try { if (!location.hash.startsWith('#quote=')) window.history.replaceState(null, '', asHash()); } catch (e) {}
  AS.booted = true;
  asSayNote();
}, 0));

/* ---------- 3. The logo and the gear ---------- */
function asHome() {
  go(AS_HOME[asSide()]);
}
function asGear() {
  const side = asSide();
  AS.from = side === 'office' ? null : S.page;
  go('of-users');
}
function asGearBack() {
  const to = AS.from || 'home';
  AS.from = null;
  go(to);
}
{
  const brand = document.querySelector('.topbar .brand');
  if (brand) brand.setAttribute('onclick', 'asHome()');
  const gear = document.getElementById('ad-gear');
  if (gear) gear.setAttribute('onclick', 'asGear()');
}
const AS_SIDE_NAME = { sales: 'the Sales desk', office: 'the Office', prod: 'Production', qc: 'Plant QC', logi: 'Logistics' };
/* ---------- 4. Each side's first screen keeps the action its yellow top button had ---------- */
const AS_FIRST = {
  office: ['ofReviewNext()', 'Review the next order'],
  qc: ['inspectNext()', 'Check the next building'],
  logi: ['lgNewLoad()', 'Build a load'],
};
function asAfterDraw() {
  const app = document.getElementById('app'), side = asSide();
  if (!app) return;
  /* the gear: a way back to the side it was opened from */
  if (['of-users', 'of-user', 'of-prices'].includes(S.page)) {
    if (AS.from && !app.querySelector('.as-back'))
      app.insertAdjacentHTML('afterbegin', `<button type="button" class="link as-back" onclick="asGearBack()">${icon('back', 16)} Back to ${AS_SIDE_NAME[asSide(AS.from)]}</button>`);
  } else if (asSide() !== 'office') AS.from = null;
  const first = AS_FIRST[side];
  if (first && S.page === AS_HOME[side] && !app.querySelector('.as-first') && typeof window[first[0].replace('()', '')] === 'function') {
    const head = app.querySelector('.pagehead');
    if (head && !app.querySelector('.ad-locked')) head.insertAdjacentHTML('afterend', `<p class="as-first no-print"><button type="button" class="secondary" onclick="${first[0]}">${first[1]} ${icon('arrow', 16)}</button></p>`);
  }
}

/* ---------- 2. Pop-ups ---------- */
const asModal = () => document.querySelector('.modal-back');
/* Something typed, signed or picked that closing would lose. */
function asModalDirty(back) {
  return back.dataset.asDirty === '1' || !!back.querySelector('#sf-pad');
}
function asModalClose(back, how) {
  if (asModalDirty(back) && back.dataset.asAsked !== '1') {
    back.dataset.asAsked = '1';
    setTimeout(() => back.isConnected && delete back.dataset.asAsked, 4000);
    toast(how === 'esc' ? 'What you typed is not saved. Press Esc again to close.' : 'What you typed is not saved. Tap outside again to close.');
    return;
  }
  closeModal();
}
document.addEventListener('input', (e) => {
  const back = e.target.closest?.('.modal-back');
  if (back && !e.target.matches('[type=search]')) back.dataset.asDirty = '1';
}, true);
document.addEventListener('keydown', (e) => {
  const back = asModal();
  if (!back) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    asModalClose(back, 'esc');
    return;
  }
  if (e.key !== 'Tab') return;
  const box = back.querySelector('.modal') || back;
  const stops = [...box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!stops.length) return;
  const at = stops.indexOf(document.activeElement);
  const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at < 0 || at === stops.length - 1 ? 0 : at + 1;
  e.preventDefault();
  stops[next].focus();
});
{
  let downOn = null;
  document.addEventListener('pointerdown', (e) => { downOn = e.target; }, true);
  document.addEventListener('click', (e) => {
    const back = asModal();
    if (back && e.target === back && downOn === back) asModalClose(back, 'tap');
  });
}

/* ---------- 5. A copy on the device, so the app opens with no signal ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
