/* firefly.js: Firefly, the guide on top of the app.

   This follows Turbo Assist's own Firefly (bennett-buddy b42d324, docs/planning/firefly_intent.md,
   which is the canonical behavior, and src/lib/firefly). What is kept from it:
   - One Firefly: a small oval body with two wings and a glow (here the tail carries the light). Click opens the panel; Esc or a
     click outside closes it. It can float (drag it anywhere) or dock in the notification bell.
   - Four jobs, in this order: attention, the next step, Ask and tours, Personal Assistant.
   - Color is the meaning: discovery blue, teaching green, guidance amber, focus purple,
     critical red (a little larger, a heartbeat). "Stop blinking" leaves critical red and still.
     A highlight flickers to its target: dark, then there. Reduced motion keeps the colors.
   - Assist levels Off, Minimal, Standard, Proactive. Off never opens by itself and hides Ask.
   - Ask answers in the panel and stays. "Walk me through…", "tour" or "show me" starts a
     tour. A tour points at the real control and waits; the person does the step. A tour never
     sends, submits, saves or deletes. Tours a person cannot run are not listed.
   - Push to talk: hold the bug on a phone, double-click it on a computer, or Ctrl+Shift+F.
   - Personal Assistant: a separate thread for owners; every action waits for a yes.
   Only in this preview: the tours themselves (written for these screens), the welcome for a
   first visit, "show me around this screen", the getting-started progress, and a checkbox that
   turns Firefly off altogether.
   Loaded last. */

const FF_INTENT = {
  discovery: ['96,165,250', 'Something to explore'],
  teaching: ['74,222,128', 'Showing you how'],
  guidance: ['251,191,36', 'A next step is ready'],
  focus: ['192,132,252', 'Keeping quiet while you work'],
  critical: ['248,113,113', 'Something needs you now'],
};
const FF_AUTO = !navigator.webdriver; /* an automated test drives the app itself; Firefly waits to be asked */
const FF = { on: true, home: 'float', assist: 'standard', speed: 'normal', open: false, view: 'main', q: '', answer: null, tour: null, step: 0, done: {}, seen: {}, still: false, pos: null, thread: [], notes: [], heard: false };
try {
  Object.assign(FF, JSON.parse(localStorage.getItem('firefly:prefs') || '{}'));
  FF.home = localStorage.getItem('firefly:display_mode') === 'sidebar' ? 'bell' : FF.home;
} catch { /* private window: start fresh */ }
function ffSave() {
  try {
    localStorage.setItem('firefly:prefs', JSON.stringify({ on: FF.on, assist: FF.assist, speed: FF.speed, done: FF.done, pos: FF.pos, welcomed: FF.welcomed }));
    localStorage.setItem('firefly:display_mode', FF.home === 'bell' ? 'sidebar' : 'floating');
  } catch { /* nothing to keep */ }
}
const ffSide = () => document.body.dataset.side || 'sales';
const ffMe = () => (typeof adMe === 'function' ? adMe() : null);
const ffCan = (section, want = 'read') => (typeof adAccess === 'function' ? AD_LEVEL[adAccess(adMe(), section)] >= AD_LEVEL[want] : true) && !(section === 'sales' && typeof adLimited === 'function' && adLimited() && !adLotOk(DESK_LOT));
const ffSideName = (s) => ({ sales: 'Sales desk', office: 'Office', prod: 'Production', qc: 'Plant QC', logi: 'Logistics', pricing: 'Model pricing' })[s] || s;
/* The first match that is on the screen. */
function ffEl(sel) {
  if (typeof sel === 'function') return sel();
  return [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') || null;
}
const ffTry = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/* ---------- What needs this person, and the next step ---------- */
function ffState() {
  const side = ffSide(), needs = [];
  let next = null;
  const notices = typeof taNoticesFor === 'function' ? taNoticesFor(side).filter((n) => !n.read).slice(0, 3) : [];
  if (side === 'sales' && ffCan('sales')) {
    const mine = ffTry(() => S.sales.filter(deskSale), []);
    const held = mine.find((s) => s.status === 'Correction requested'), sign = mine.find((s) => s.status === 'Sold · Awaiting signatures'), review = mine.find((s) => s.status === 'Submitted · Awaiting review');
    if (held) needs.push({ tone: 'critical', title: `${held.customer}’s order is on hold`, text: (held.office?.hold?.reason || 'The office asked for a fix') + '. Fix it and submit again.', go: `openSale('${held.id}')` });
    next = held ? { text: `${held.customer}’s order is on hold. Fix it and submit it again.`, go: `openSale('${held.id}')` }
      : sign ? { text: `${sign.customer}’s order: the customer still has paperwork to sign.`, go: `openSale('${sign.id}')` }
      : review ? { text: `${review.customer}’s order is with the office. Nothing for you to do until they answer.`, go: `openSale('${review.id}')`, label: 'Open the order' }
      : { text: 'No open order needs you. Start the next sale.', go: "S.saleLead=null;go('start')", label: 'Start a sale' };
  } else if (side === 'office' && ffCan('office')) {
    const all = ffTry(() => ofAll(), []), review = all.filter((s) => ofStage(s) === 'review'), late = ffTry(() => toOverdue().length, 0);
    const pays = all.flatMap((s) => (s.money?.payments || []).filter((p) => !p.confirmed).map(() => s));
    if (late) needs.push({ tone: 'critical', title: `${late} paperwork item${late === 1 ? ' is' : 's are'} overdue`, text: 'Missing a day after the lot submitted the order.', go: 'toOverdueList()' });
    next = review.length ? { text: `${review.length} order${review.length === 1 ? '' : 's'} waiting for review. The oldest is first.`, go: 'ofReviewNext()', label: 'Review the next one' }
      : pays.length ? { text: `${pays.length} payment${pays.length === 1 ? '' : 's'} recorded at a lot and not confirmed yet.`, go: "go('of-pay')", label: 'Open payments' } : null;
  } else if (side === 'prod' && ffCan('prod')) {
    const units = ffTry(() => prUnits().filter((u) => u.phase < phaseNames.length - 1), []).sort((a, b) => a.since - b.since), u = units[0];
    if (u) next = { text: `Oldest on the board: ${u.name}${u.customer ? ' for ' + u.customer : ''}, at ${phaseNames[u.phase]}.`, go: `prOpen('${u.id}')`, label: 'Open it' };
  } else if (side === 'qc' && ffCan('qc')) {
    next = { text: 'Inspect the building that has waited longest.', go: 'inspectNext()', label: 'Inspect next' };
  } else if (side === 'logi' && ffCan('logi')) {
    const ready = ffTry(() => LG.units.filter((u) => u.at === 'plant' && !u.loadId).length, 0), road = ffTry(() => LG.loads.filter((l) => l.state === 'in_transit').length, 0);
    if (ready) next = { text: `${ready} building${ready === 1 ? ' is' : 's are'} at the plant with no load yet.`, go: "go('logi')", label: 'See them' };
    else if (road) next = { text: `${road} load${road === 1 ? ' is' : 's are'} on the road.`, go: "go('lg-loads')", label: 'Open loads' };
  }
  notices.forEach((n) => needs.push({ tone: /hold|overdue|waiting on/i.test(n.title) ? 'critical' : 'guidance', title: n.title, text: n.body, go: n.go || '' }));
  const calm = ['configure', 'qc-inspect'].includes(S.page);
  const intent = FF.tour ? 'teaching' : needs.some((n) => n.tone === 'critical') ? 'critical' : calm ? 'focus' : needs.length || (next && !/Start a sale|Nothing for you/.test(next.text + next.label)) ? 'guidance' : 'discovery';
  return { side, needs: needs.slice(0, 4), next, intent };
}

/* ---------- Tours: written for these screens; each points at a real control and waits ---------- */
const ffNav = (page) => () => ffEl(`.topnav [data-nav="${page}"]`) || ffEl(`.tabbar [data-nav="${page}"]`);
const ffPanelOf = (sel) => () => ffEl(sel)?.closest('.panel') || ffEl(sel);
const FF_TOURS = [
  { id: 'welcome', name: 'The whole app in a minute', section: null, about: 'The five sides, where answers live, and where to find me.', keys: ['welcome', 'overview', 'whole app', 'start', 'new here', 'basics'],
    start: () => {}, steps: [
      { sel: '.previewstrip .sideswitch', title: 'Five sides, one building', text: 'A building moves left to right: sold at the Sales desk, approved by the Office, built in Production, checked by Plant QC, delivered by Logistics.' },
      { sel: '#ta-ans-btn', title: 'Answers', text: 'Delivery rules, sizes, payments, warranty, steel. Search it in plain words from any screen.' },
      { sel: '#ta-bell', title: 'What happened while you were away', text: 'Orders placed on hold, deliveries scheduled, buildings that passed QC. Each side has its own.' },
      { sel: () => ffEl({ sales: '.home-actions .primary', office: '#of-list .ops-row', prod: '.pr-board', qc: '.qc-floor', logi: '.ops-tiles' }[ffSide()] || '#app h1'), title: 'Your work starts here', text: 'Every side opens on what needs doing today, oldest first. No hunting.' },
      { sel: () => (FF.home === 'bell' ? ffEl('#ta-bell') : ffEl('#ff-bug')), title: 'And this is me', text: 'Click me any time. Ask “how do I…”, or say “walk me through” and I will point at the real buttons while you do it.' },
    ] },
  { id: 'sales-lot', name: 'Sell a building from the lot', section: 'sales', about: 'From Home to the building’s own page, where the sale begins.', keys: ['sell', 'from the lot', 'my lot', 'inventory', 'in stock', 'building on the lot', 'lot sale'],
    answer: 'Press Start a sale, then Browse my lot. Pick the building and press “Start the sale on this building”. The delivery questions and the customer’s signatures come next.',
    start: () => go('home'), steps: [
      { sel: '.home-actions .primary', title: 'Press “Start a sale”', text: 'Every sale starts here, whether the building is on the lot or still an idea.', until: () => S.page === 'start' },
      { sel: `.startcard .primary[onclick="begin('lot')"]`, title: 'Press “Browse my lot”', text: 'A building on the lot keeps its serial number and its features all the way through.', until: () => S.page === 'lot' },
      { sel: '.lotcard .photobtn', title: 'Pick a building', text: 'Any one. Filters at the top narrow the lot by size, style or monthly budget.', until: () => S.page === 'unit' },
      { sel: '.unitprice', title: 'Price, cash or monthly', text: 'The rent-to-own payments follow the terms the office set. Tap a term to switch.' },
      { sel: '.unitactions .primary', hands: false, title: 'This button starts the sale', text: 'It opens the delivery questions, then the paperwork. I stop here so nothing real starts by accident.' },
    ] },
  { id: 'sales-configure', name: 'Configure and quote a new building', section: 'sales', about: 'Eight short steps with a running price.', keys: ['configur', 'custom', 'quot', 'new building', 'design a', 'build a'],
    answer: 'Press Start a sale, then Start configuring. Work through the eight steps; the price at the bottom follows every choice. “Create quote” saves a quote, “Complete the sale” starts the order.',
    start: () => go('home'), steps: [
      { sel: '.home-actions .primary', title: 'Press “Start a sale”', text: 'Same door as a lot sale.', until: () => S.page === 'start' },
      { sel: `.startcard .primary[onclick="begin()"]`, title: 'Press “Start configuring”', text: 'One choice at a time. Nothing is ordered until the very end.', until: () => S.page === 'configure' },
      { sel: '.steps', title: 'Eight steps', text: 'Style, size, package, openings, colors, exterior, electrical, finish. Jump back to any of them.' },
      { sel: '.choicegrid', title: 'Choose, and watch the building', text: 'The model on the left redraws with every choice. Drag it to turn it.' },
      { sel: '.deal-main', title: 'The price keeps up', text: 'Total and monthly payment follow each choice. “Price details” shows every line.' },
      { sel: '.summaryactions', hands: false, title: 'Quote it or sell it', text: '“Create quote” saves a quote the customer can open. “Complete the sale” starts the order. I leave both to you.' },
    ] },
  { id: 'sales-order', name: 'Follow an order to delivery', section: 'sales', about: 'Where an order stands and whose move it is.', keys: ['track', 'status', 'where is', 'signature', 'follow an order', 'find an order', 'look up'],
    answer: 'Open Orders and pick the order. The tracker shows where it stands, and “Next steps” lists what is yours and what another team does.',
    start: () => go('orders'), steps: [
      { sel: '#orderresults .listrow', title: 'Open an order', text: 'Search by customer, order number or serial.', until: () => S.page === 'sale' },
      { sel: '.od-top', title: 'Where it stands', text: 'Quote, signed, office review, plant, QC, delivery. The amber block is now.' },
      { sel: '.sf-panel', title: 'Whose move it is', text: 'The top half is yours at the desk. The bottom half belongs to the office, the plant and logistics; you watch it move.' },
      { sel: '.ta-facts', title: 'Answers for this order', text: 'Lead time, payments, warranty and set-up, already picked for this kind of sale.' },
    ] },
  { id: 'office-approve', name: 'Review and approve an order', section: 'office', about: 'The checks, the paperwork, then the decision.', keys: ['approv', 'review', 'accept', 'on hold', 'intake', 'paperwork'],
    answer: 'On the Office To do list press Review on the oldest order. Every check on the left has to be green, the paperwork has to be in, then “Approve · send to the plant”. “Place on hold” sends it back to the lot with your reason.',
    start: () => go('office'), steps: [
      { sel: '.ops-tiles', title: 'What needs the office', text: 'Orders to review, payments to confirm, buildings to release, requests from the lots.' },
      { sel: '#of-list .ops-row .primary', title: 'Press “Review”', text: 'The list is oldest first, so the top one has waited longest.', until: () => S.page === 'of-order' },
      { sel: ffPanelOf('.of-check'), title: 'Every check goes green', text: 'Address, signatures, first payment, floor plan, price. A red one names what is missing and gives you the button to fix it.' },
      { sel: '.to-paper', title: 'The paperwork this deal needs', text: 'It changes with the sale: rent-to-own adds the contract, cash adds the deposit receipt.' },
      { sel: '.ops-bar', hands: false, title: 'Approve, or send it back', text: 'Approve sends it to the plant. Place on hold returns it to the lot with your reason and tells the salesperson. That decision is yours, so I stop here.' },
    ] },
  { id: 'office-prices', name: 'Change prices and publish them', section: 'pricing', about: 'One price, a whole group, and the day it goes live.', keys: ['change price', 'change a price', 'pricing', 'raise price', 'price increase', 'publish', 'msrp'],
    answer: 'Open Model pricing. Type a new price on any size, or move a whole group by a percent. Changes wait in the draft; pick the day and press Publish.',
    start: () => { AD.tab = 'grid'; go('of-prices'); }, steps: [
      { sel: '.ad-tabs', title: 'Five tabs', text: 'Buildings, options and packages, prices for one lot, the price sheet, and the draft.' },
      { sel: '.ad-grid', title: 'Type a price', text: 'Each box is one size. A changed box turns amber and shows what it was.' },
      { sel: '.ad-bulk', title: 'Or move a whole group', text: 'A model, a series, a width or everything, by a percent or a dollar amount, rounded.' },
      { sel: '.ad-tabs .chipbtn:last-child', hands: false, title: 'Nothing is live yet', text: 'The draft lists every change, old and new. An owner picks the day and publishes. Written quotes keep their price.' },
    ] },
  { id: 'logi-load', name: 'Plan and check a load', section: 'logi', about: 'What is waiting, then one load: the trailer, the stops, the checks.', keys: ['a load', 'loads', 'trailer', 'haul', 'dispatch', 'schedule a delivery', 'manifest'],
    answer: 'Dispatch shows the buildings that are ready, grouped by where they go. “Build a load” starts a load; add buildings until the trailer is full, pick the trailer and day, clear the checks, then schedule.',
    start: () => go('logi'), steps: [
      { sel: '.ops-tiles', title: 'Today in logistics', text: 'Ready to load, on the road, waiting at a lot, and what is scheduled.' },
      { sel: '#app .ops-row', title: 'Buildings that are ready', text: 'Grouped by the lot they are going to, so buildings for one lot ride together.' },
      { sel: ffNav('lg-loads'), title: 'Open “Loads”', text: 'Every load, planned through delivered.', until: () => S.page === 'lg-loads' },
      { sel: '#app .ops-row .secondary', title: 'Open a load', text: 'Any one.', until: () => S.page === 'lg-load' },
      { sel: '.lg-trailer', title: 'The trailer, to scale', text: 'Each block is a building. Past the end of the trailer shows red.' },
      { sel: () => (ffEl('.lg-check') || document.querySelector('#app select[onchange*="window"]'))?.closest('.panel') || null, title: 'Trailer, day and checks', text: 'Pick the trailer and the day here. Anything in the way shows as a warning: trailer length, a wide-load permit, lot hours, a customer not told yet. No warnings means it is clear.' },
      { sel: '.ops-bar', hands: false, title: 'Schedule and start', text: 'These tell the lot, the salesperson and the customer. I leave them to the dispatcher.' },
    ] },
  { id: 'prod-board', name: 'Read the production board', section: 'prod', about: 'Nine phases, oldest first, and one building’s page.', keys: ['production', 'the board', 'phase', 'kanban', 'build specs'],
    answer: 'The board has a column for each of the nine phases. Open a card to move it to the next phase, see its build specs and materials, or put it on a production load.',
    start: () => go('prod'), steps: [
      { sel: '.pr-board', title: 'Nine phases, left to right', text: 'Order received to Build complete. In each column the oldest building is on top.' },
      { sel: '.pr-card', title: 'Open a building', text: 'Any card.', until: () => S.page === 'pr-unit' },
      { sel: () => [...document.querySelectorAll('#app .panel h2')].find((h) => /Move phase/.test(h.textContent))?.closest('.panel') || null, hands: false, title: 'Move it on', text: 'The plant manager moves a building to the next phase here, with a note if one is needed.' },
      { sel: '.tp-specs', title: 'Build specs', text: 'Joists, studs, plates and loft, figured from the size by the framing rules.' },
    ] },
  { id: 'qc-inspect', name: 'How Plant QC works', section: 'qc', about: 'What is waiting, how an inspection goes, and the dashboard.', keys: ['qc', 'inspect', 'quality', 'sign-off', 'sign off', 'rework'],
    answer: 'Plant QC lists the buildings waiting. Open one and answer each question Yes, No or N/A; a No needs a photo and goes to Rework. When nothing is left to fix, final QC signs it off with initials.',
    start: () => go('qc'), steps: [
      { sel: '.today', title: 'What is waiting', text: 'Buildings to inspect, in rework, and ready for sign-off.' },
      { sel: '.qc-floor', title: 'Buildings on the floor', text: 'Open one to inspect it. Each question is answered Yes, No or N/A, and a No needs a photo.' },
      { sel: ffNav('qc-report'), title: 'Open “Report”', text: 'The numbers behind the floor.', until: () => S.page === 'qc-report' },
      { sel: '#app .panel', title: 'The QC dashboard', text: 'Waiting for QC, waiting for final QC, and which failures come up most.' },
    ] },
];
const ffTour = (id) => FF_TOURS.find((t) => t.id === id);
const ffTourOk = (t) => !t.section || ffCan(t.section);
/* The catalog: only tours this person can run. */
const ffCatalog = () => FF_TOURS.filter(ffTourOk);

function ffTourStart(id) {
  const t = ffTour(id);
  if (!t) return;
  if (!ffTourOk(t)) return ffSay(`${ffMe()?.name || 'This person'} cannot open ${ffSideName(t.section)}, so I can’t walk through that.`);
  closeModal();
  if (typeof taCloseAnswers === 'function') taCloseAnswers();
  FF.open = false;
  FF.tour = id;
  FF.step = -1;
  t.start();
  ffStep(0);
}
function ffStep(i) {
  const t = ffTour(FF.tour);
  if (!t) return;
  if (i >= t.steps.length) return ffTourEnd(true);
  FF.step = i;
  FF.stepAt = Date.now();
  FF.scrolled = false;
  ffFlicker();
  ffDraw();
}
function ffTourEnd(finished) {
  const t = ffTour(FF.tour);
  FF.tour = null;
  $('#ff-ring')?.remove();
  $('#ff-card')?.remove();
  ffHome();
  if (finished && t) {
    FF.done[t.id] = true;
    ffSave();
    ffBurst();
    const left = ffCatalog().filter((x) => !FF.done[x.id]);
    FF.answer = { title: `Done: ${t.name}`, text: left.length ? `${ffCatalog().length - left.length} of ${ffCatalog().length} tours finished. Next up: ${left[0].name}.` : 'That was the last tour. You have seen the whole app.', tour: left[0]?.id, cheer: true };
    FF.view = 'main';
    FF.open = true;
  }
  ffDraw();
}
/* Keep the highlight on the real control while the screen changes underneath it. */
function ffTick() {
  if (!FF.tour) return;
  const t = ffTour(FF.tour), s = t.steps[FF.step];
  if (!s) return;
  if (s.until && ffTry(s.until, false)) return ffStep(FF.step + 1);
  const el = ffTry(() => ffEl(s.sel), null), ring = $('#ff-ring'), card = $('#ff-card');
  if (!ring || !card) return;
  const lost = !el && Date.now() - FF.stepAt > 2500;
  card.classList.toggle('lost', lost);
  if (!el) {
    ring.style.display = 'none';
    card.style.cssText = 'left:50%;top:38%;transform:translateX(-50%)';
    card.querySelector('.ff-lost').hidden = !lost;
    return;
  }
  if (!FF.scrolled) {
    FF.scrolled = true;
    const r0 = el.getBoundingClientRect();
    if (r0.top < 90 || r0.bottom > innerHeight - 190) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  const r = el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight, tall = Math.min(r.height, vh - 150);
  ring.style.cssText = `display:block;left:${Math.max(4, r.left - pad)}px;top:${Math.max(4, r.top - pad)}px;width:${Math.min(vw - 8, r.width + pad * 2)}px;height:${tall + pad * 2}px`;
  const cw = Math.min(340, vw - 24), ch = card.offsetHeight || 170, below = r.top + tall + pad + 14, above = r.top - pad - 14 - ch;
  const top = below + ch < vh - 12 ? below : above > 70 ? above : Math.max(70, vh - ch - 14);
  card.style.cssText = `left:${Math.min(vw - cw - 12, Math.max(12, r.left))}px;top:${top}px;width:${cw}px`;
  card.querySelector('.ff-lost').hidden = true;
  if (FF.home !== 'bell') ffBugTo(Math.min(vw - 60, r.right - 8), Math.max(60, r.top - 34));
}
setInterval(ffTick, 200);
/* A step the person does by pressing the real control moves on when they press it. */
document.addEventListener('click', (e) => {
  if (!FF.tour) return;
  const t = ffTour(FF.tour), s = t.steps[FF.step], el = s && ffTry(() => ffEl(s.sel), null);
  if (!el || !el.contains(e.target) || e.target.closest('#ff-root')) return;
  const at = FF.step;
  setTimeout(() => FF.tour === t.id && FF.step === at && (!s.until || ffTry(s.until, false)) && ffStep(at + 1), 320);
}, true);

/* ---------- Ask ---------- */
const FF_PAGES = [['orders', 'sales', ['orders', 'order lookup'], "go('orders')", 'Orders'], ['lot', 'sales', ['my lot', 'the lot', 'inventory'], "go('lot')", 'My lot'], ['office', 'office', ['office', 'to do'], "go('office')", 'the Office'], ['of-pay', 'payments', ['payments', 'payment'], "go('of-pay')", 'Payments'], ['of-prices', 'pricing', ['pricing', 'prices', 'price list'], "go('of-prices')", 'Model pricing'], ['of-users', 'users', ['users', 'permissions', 'people'], "go('of-users')", 'Users and permissions'], ['prod', 'prod', ['production', 'board'], "go('prod')", 'Production'], ['qc', 'qc', ['plant qc', 'qc'], "go('qc')", 'Plant QC'], ['logi', 'logi', ['logistics', 'dispatch'], "go('logi')", 'Logistics'], ['lg-loads', 'logi', ['loads'], "go('lg-loads')", 'Loads']];
function ffMatchTour(q) {
  const text = q.toLowerCase();
  return FF_TOURS.map((t) => [t, t.keys.filter((k) => text.includes(k)).reduce((n, k) => n + k.length, 0)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
/* One router for typed and spoken questions (Turbo Assist: matchAskQuery). */
function ffAsk(raw) {
  const q = String(raw || '').trim(), text = q.toLowerCase();
  if (!q) return;
  FF.q = q;
  FF.view = 'main';
  FF.open = true;
  if (/what (else )?can firefly do|show me what firefly/.test(text)) return (FF.view = 'catalog'), (FF.answer = null), ffDraw();
  const tour = ffMatchTour(text), wantsTour = /\btour\b|walk me through|show me/.test(text);
  if (tour && !ffTourOk(tour)) FF.answer = { title: 'Not on this account', text: `${ffMe()?.name || 'This person'} cannot open ${ffSideName(tour.section)}, so I can’t show that. An owner can give access under Users and permissions.` };
  else if (tour && wantsTour) return ffTourStart(tour.id);
  else if (tour && /how (do|can|would|should) (i|we|you)|how to|where (do|can) (i|we)|can (i|we|this app)|help me/.test(text)) FF.answer = { title: tour.name, text: tour.answer || tour.about, tour: tour.id, show: tour.id };
  else {
    const page = /\b(open|go to|take me to|show)\b/.test(text) && FF_PAGES.find((p) => p[2].some((k) => text.includes(k)));
    const kb = typeof taSearch === 'function' ? taSearch(q)[0] : null;
    if (page) FF.answer = ffCan(page[1]) ? { title: page[4], text: `I can take you to ${page[4]}.`, go: page[3], label: 'Take me there' } : { title: 'Not on this account', text: `${ffMe()?.name || 'This person'} cannot open ${page[4]}.` };
    else if (kb) FF.answer = { title: kb.title, text: kb.hint || kb.body.replace(/[#*]/g, '').slice(0, 240), article: kb.id, tour: tour?.id };
    else if (tour) FF.answer = { title: tour.name, text: tour.answer || tour.about, tour: tour.id, show: tour.id };
    else FF.answer = { title: 'I don’t have that one yet', text: 'No article or tour answers it. In Turbo Assist a question like this is flagged so someone writes the answer.', flag: q };
  }
  ffDraw();
}
/* "Show me": point at the first real control without starting the tour. */
function ffShow(id) {
  const t = ffTour(id);
  if (!t || !ffTourOk(t)) return;
  FF.open = false;
  t.start();
  ffDraw();
  setTimeout(() => {
    const el = ffTry(() => ffEl(t.steps[0].sel), null);
    if (el) ffSpot(el, 3200);
  }, 350);
}
/* "Show me around this screen": the three or four things that matter on whatever is open. */
function ffAround() {
  const marks = [['.today, .ops-tiles', 'Today at a glance'], ['.ops-bar, .summaryactions, .home-actions', 'The main action'], ['#of-list, #leads-panel, .pr-board, .qc-floor, .ad-grid, .lg-trailer, .sf-panel', 'Where the work is'], ['.ops-notes', 'What is real and what is preview']]
    .map(([sel, name]) => [ffEl(sel), name]).filter(([el]) => el);
  FF.open = false;
  ffDraw();
  if (!marks.length) return ffSay('Nothing special to point at on this screen.');
  marks.forEach(([el, name], i) => setTimeout(() => ffSpot(el, 1900, name), i * 2100));
}
function ffSpot(el, ms, label = '') {
  el.scrollIntoView({ block: 'center', behavior: 'auto' });
  const r = el.getBoundingClientRect(), root = $('#ff-root');
  root.insertAdjacentHTML('beforeend', `<div class="ff-ring ff-spot" style="display:block;left:${Math.max(4, r.left - 6)}px;top:${Math.max(4, r.top - 6)}px;width:${Math.min(innerWidth - 8, r.width + 12)}px;height:${Math.min(innerHeight - 120, r.height) + 12}px">${label ? `<span>${esc(label)}</span>` : ''}</div>`);
  const ring = root.lastElementChild;
  if (FF.home !== 'bell') ffFlicker(), ffBugTo(Math.min(innerWidth - 60, r.right - 8), Math.max(60, r.top - 34));
  setTimeout(() => (ring.remove(), $('.ff-spot') || ffHome()), ms);
}

/* ---------- Push to talk ---------- */
function ffTalk() {
  if (!FF.on || FF.assist === 'off' || FF.tour || FF.heard) return false;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return ffSay('Voice works in Chrome and Edge. Type the question instead.'), false;
  const rec = new SR();
  FF.heard = rec;
  rec.lang = 'en-US';
  rec.interimResults = false;
  let said = '';
  rec.onresult = (e) => (said = e.results[0][0].transcript);
  rec.onerror = () => (said = '');
  rec.onend = () => {
    FF.heard = false;
    ffDraw();
    if (said.trim()) ffAsk(said); /* empty speech does not submit */
  };
  rec.start();
  setTimeout(() => FF.heard === rec && rec.stop(), 15000);
  ffDraw();
  return true;
}
const ffTalkStop = () => FF.heard && FF.heard.stop();

/* ---------- Personal Assistant: a thread for owners; every action waits for a yes ---------- */
const ffCanAssist = () => typeof adIsOwner === 'function' && adIsOwner() && (typeof AD === 'undefined' || AD.me === 'u1');
function ffAssist(raw) {
  const q = String(raw || '').trim(), text = q.toLowerCase();
  if (!q || !ffCanAssist()) return;
  FF.thread.push({ me: true, text: q });
  const note = /^(note|remember|remind me)[:,]?\s+(.*)$/i.exec(q), page = FF_PAGES.find((p) => p[2].some((k) => text.includes(k)));
  if (note) FF.thread.push({ text: `Save this note?`, quote: note[2], act: `FF.notes.unshift(${JSON.stringify(note[2])})`, done: 'Saved to your notes.' });
  else if (page) FF.thread.push({ text: `Open ${page[4]}?`, act: page[3], done: `Opened ${page[4]}.` });
  else if (/\bnotes?\b/.test(text)) FF.thread.push({ text: FF.notes.length ? 'Your notes: ' + FF.notes.map((n) => '“' + n + '”').join(' · ') : 'No notes yet. Type “note” and what to keep.' });
  else FF.thread.push({ text: 'I can keep a note for you (“note call the Florence lot about the 12×24”) or open a screen (“open payments”). I ask before I do anything.' });
  ffDraw();
  const box = $('#ff-thread');
  if (box) box.scrollTop = box.scrollHeight;
}
function ffConfirm(i, yes) {
  const m = FF.thread[i];
  if (!m || m.closed) return;
  m.closed = yes ? 'yes' : 'no';
  if (yes) ffTry(() => new Function(m.act)(), null);
  FF.thread.push({ text: yes ? m.done : 'Left as it was.' });
  ffDraw();
}

/* ---------- Drawing ---------- */
/* A firefly: a small dark body, two wings that flutter, and a tail that glows in the color of what it means. */
const ffBugSvg = (size = 30) => `<svg class="ff-fairy" width="${size}" height="${size}" viewBox="0 0 30 30" aria-hidden="true"><g transform="rotate(34 15 13)"><ellipse class="ff-wing a" cx="7.4" cy="13" rx="7.8" ry="3.3"/></g><g transform="rotate(-34 15 13)"><ellipse class="ff-wing b" cx="22.6" cy="13" rx="7.8" ry="3.3"/></g><circle class="ff-halo" cx="15" cy="20" r="6.2"/><ellipse class="ff-body" cx="15" cy="15" rx="3.9" ry="6.6"/><circle class="ff-orb" cx="15" cy="20" r="3.7"/><circle class="ff-core" cx="15" cy="19.4" r="1.6"/></svg>`;
const ffBtn = (text, code, cls = 'ff-go') => `<button type="button" class="${cls}" onclick="${code}">${text}</button>`;
function ffAnswerHtml(a) {
  return `<div class="ff-ans${a.cheer ? ' cheer' : ''}"><b>${esc(a.title)}</b><p>${esc(a.text)}</p><div class="ff-row">${a.tour ? ffBtn('Take a tour', `ffTourStart('${a.tour}')`) : ''}${a.show ? ffBtn('Show me', `ffShow('${a.show}')`, 'ff-ghost') : ''}${a.go ? ffBtn(a.label || 'Take me there', `ffClose();${a.go}`) : ''}${a.article ? ffBtn('Read the article', `ffClose();taOpenAnswers('${a.article}')`, a.tour ? 'ff-ghost' : 'ff-go') : ''}${a.flag ? ffBtn('Flag it for the team', "FF.answer={title:'Flagged',text:'Sent to the team that writes the answers. Preview: nothing is sent.'};ffDraw()", 'ff-ghost') : ''}</div></div>`;
}
function ffPanelHtml() {
  const st = ffState(), me = ffMe(), as = me && typeof AD !== 'undefined' && AD.me !== 'u1', cat = ffCatalog(), done = cat.filter((t) => FF.done[t.id]).length, off = FF.assist === 'off';
  const head = `<header class="ff-head">${ffBugSvg(26)}<b>Firefly</b><small>${FF.view === 'catalog' ? 'What I can do' : FF.view === 'settings' ? 'Settings' : FF.view === 'pa' ? 'Personal Assistant' : FF_INTENT[st.intent][1]}</small><button type="button" class="ff-x" aria-label="Close Firefly" onclick="ffClose()">×</button></header>`;
  const tabs = `<nav class="ff-tabs"><button type="button" class="${FF.view === 'main' ? 'on' : ''}" onclick="ffView('main')">Today</button><button type="button" class="${FF.view === 'catalog' ? 'on' : ''}" onclick="ffView('catalog')">Tours <i>${done}/${cat.length}</i></button>${ffCanAssist() ? `<button type="button" class="${FF.view === 'pa' ? 'on' : ''}" onclick="ffView('pa')">Assistant</button>` : ''}<button type="button" class="${FF.view === 'settings' ? 'on' : ''}" onclick="ffView('settings')" aria-label="Firefly settings">${icon('sliders', 15)}</button></nav>`;
  let body = '';
  if (FF.view === 'catalog') {
    const groups = [...new Set(cat.map((t) => t.section))];
    body = `<div class="ff-sec"><div class="ff-prog"><span>Getting started</span><i><b style="width:${cat.length ? (done / cat.length) * 100 : 0}%"></b></i><span>${done} of ${cat.length}</span></div></div>` +
      groups.map((g) => `<div class="ff-sec ff-tours"><h4>${g ? ffSideName(g) : 'Start here'}</h4>${cat.filter((t) => t.section === g).map((t) => `<div><span><b>${esc(t.name)}</b><small>${esc(t.about)} · ${t.steps.length} steps</small></span>${FF.done[t.id] ? '<em>Done</em>' : ''}${ffBtn(FF.done[t.id] ? 'Again' : 'Start tour', `ffTourStart('${t.id}')`, FF.done[t.id] ? 'ff-ghost' : 'ff-go')}</div>`).join('')}</div>`).join('') +
      `<div class="ff-sec"><p class="ff-fine">Only tours this person can run are listed. A tour points at the real button and waits for you. It never sends, submits, saves or deletes.</p></div>`;
  } else if (FF.view === 'settings') {
    const seg = (key, opts) => `<span class="ff-seg">${opts.map(([v, n]) => `<button type="button" class="${FF[key] === v ? 'on' : ''}" onclick="ffSet('${key}','${v}')">${n}</button>`).join('')}</span>`;
    body = `<div class="ff-sec"><label class="ff-check"><input type="checkbox" id="ff-on" ${FF.on ? 'checked' : ''} onchange="ffSetOn(this.checked)"> <span><b>Show Firefly</b><small>Untick to turn it off everywhere. Turn it back on from the notification bell.</small></span></label></div>
      <div class="ff-sec"><h4>How much it speaks up</h4>${seg('assist', [['off', 'Off'], ['minimal', 'Minimal'], ['standard', 'Standard'], ['proactive', 'Proactive']])}<p class="ff-fine">${{ off: 'Never opens by itself. Ask and voice are hidden. The handle stays so you can still open it.', minimal: 'Opens by itself only to welcome a first visit.', standard: 'May peek when you change sides and something urgent is waiting.', proactive: 'The same as Standard for now.' }[FF.assist]}</p></div>
      <div class="ff-sec"><h4>Where it lives</h4>${seg('home', [['float', 'Floating'], ['bell', 'In the bell']])}<p class="ff-fine">${FF.home === 'bell' ? 'The bell glows in Firefly’s color and opens this panel.' : 'Drag the bug anywhere on the screen.'}</p></div>
      <div class="ff-sec"><h4>Motion</h4>${seg('speed', [['calm', 'Calm'], ['normal', 'Normal'], ['lively', 'Lively']])}${st.intent === 'critical' ? `<label class="ff-check" style="margin-top:10px"><input type="checkbox" ${FF.still ? 'checked' : ''} onchange="FF.still=this.checked;ffDraw()"> <span><b>Stop blinking</b><small>Stays red and still until the urgent thing is handled.</small></span></label>` : ''}</div>
      <div class="ff-sec"><div class="ff-row">${ffBtn('Replay the welcome', 'ffClose();ffWelcome(true)', 'ff-ghost')}${ffBtn('Start over on tours', 'FF.done={};ffSave();ffDraw()', 'ff-ghost')}</div></div>`;
  } else if (FF.view === 'pa') {
    body = `<div class="ff-sec"><p class="ff-fine">A private thread for owners. It keeps notes and opens screens, and it asks before it does anything.</p></div>
      <div class="ff-thread" id="ff-thread">${FF.thread.map((m, i) => `<div class="ff-msg${m.me ? ' me' : ''}"><span>${esc(m.text)}${m.quote ? `<q>${esc(m.quote)}</q>` : ''}</span>${m.act && !m.closed ? `<div class="ff-row">${ffBtn('Yes, do it', `ffConfirm(${i},true)`)}${ffBtn('No', `ffConfirm(${i},false)`, 'ff-ghost')}</div>` : ''}</div>`).join('') || '<div class="ff-msg"><span>What would you like kept or opened?</span></div>'}</div>
      <form class="ff-ask ff-sec" onsubmit="event.preventDefault();ffAssist(this.q.value);"><input name="q" autocomplete="off" aria-label="Message the assistant" placeholder="note call the Florence lot…"><button class="ff-go" type="submit">Send</button></form>`;
  } else {
    body = `${as ? `<div class="ff-as">Viewing as <b>${esc(me.name)}</b>. This is what Firefly would show them.</div>` : ''}
      ${st.needs.length ? `<div class="ff-sec"><h4>Needs you</h4>${st.needs.map((n) => `<${n.go ? `button type="button" onclick="ffClose();${esc(n.go)}"` : 'div'} class="ff-item"><i class="${n.tone}"></i><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></${n.go ? 'button' : 'div'}>`).join('')}</div>` : ''}
      ${st.next ? `<div class="ff-sec"><h4>Next step</h4><div class="ff-next"><span>${esc(st.next.text)}</span>${ffBtn(st.next.label || 'Take me there', `ffClose();${st.next.go}`)}</div></div>` : ''}
      ${off ? '' : `<div class="ff-sec"><h4>Ask</h4><form class="ff-ask" onsubmit="event.preventDefault();ffAsk(this.q.value)"><input name="q" id="ff-q" autocomplete="off" aria-label="Ask Firefly" placeholder="How do I…?  Walk me through…" value="${esc(FF.q)}"><button type="button" class="ff-mic${FF.heard ? ' on' : ''}" aria-label="Hold to talk" onpointerdown="ffTalk()" onpointerup="ffTalkStop()">${icon('phone', 15)}</button><button class="ff-go" type="submit">Ask</button></form>
        ${FF.heard ? '<p class="ff-fine">Listening. Let go to send.</p>' : ''}${FF.answer ? ffAnswerHtml(FF.answer) : `<div class="ff-chips">${ffBtn('✦ Show me what Firefly can do', "ffAsk('what can firefly do')", 'ff-chip')}${ffBtn('Show me around this screen', 'ffAround()', 'ff-chip')}</div>`}</div>`}
      ${!st.needs.length && !st.next && off ? '<div class="ff-sec"><p class="ff-fine">Nothing needs you right now.</p></div>' : ''}`;
  }
  return head + tabs + `<div class="ff-body">${body}</div>`;
}
function ffDraw() {
  const root = $('#ff-root');
  if (!root) return;
  const me = ffMe(), gone = !FF.on || (me && me.status !== 'active'), st = ffState(), bell = $('#ta-bell'), docked = FF.home === 'bell';
  root.hidden = gone;
  root.dataset.intent = st.intent;
  root.dataset.speed = FF.speed;
  root.classList.toggle('still', FF.still && st.intent === 'critical');
  root.style.setProperty('--ff', FF_INTENT[st.intent][0]);
  const bug = $('#ff-bug');
  bug.hidden = docked && !FF.tour;
  bug.querySelector('.ff-n').textContent = st.needs.length || '';
  bug.querySelector('.ff-n').hidden = !st.needs.length || !!FF.tour;
  bug.setAttribute('aria-label', `Firefly: ${FF_INTENT[st.intent][1]}${st.needs.length ? ', ' + st.needs.length + ' need you' : ''}`);
  bug.classList.toggle('listening', !!FF.heard);
  if (bell) {
    bell.classList.toggle('ff-bell', docked && !gone);
    bell.style.setProperty('--ff', FF_INTENT[st.intent][0]);
  }
  const panel = $('#ff-panel');
  panel.hidden = !FF.open || !!FF.tour;
  if (!panel.hidden) {
    const keep = document.activeElement?.id === 'ff-q' ? [document.activeElement.selectionStart, document.activeElement.value] : null;
    panel.innerHTML = ffPanelHtml();
    ffPlace();
    if (keep) {
      const q = $('#ff-q');
      q.value = keep[1];
      q.focus();
      q.setSelectionRange(keep[0], keep[0]);
    }
  }
  if (FF.tour) {
    const t = ffTour(FF.tour), s = t.steps[FF.step];
    if (!s) return;
    if (!$('#ff-ring')) root.insertAdjacentHTML('beforeend', '<div class="ff-ring" id="ff-ring"></div><section class="ff-card" id="ff-card" role="dialog" aria-live="polite"></section>');
    $('#ff-card').innerHTML = `<small>Tour · ${esc(t.name)}</small><b>${esc(s.title)}</b><p>${esc(s.text)}</p><p class="ff-lost" hidden>I can’t see that control on this screen. Press Next and I’ll carry on.</p>
      <div class="ff-row"><span class="ff-dots">${t.steps.map((_, i) => `<i class="${i <= FF.step ? 'on' : ''}"></i>`).join('')}</span><span class="ff-of">${FF.step + 1} of ${t.steps.length}</span>${ffBtn('Stop', 'ffTourEnd(false)', 'ff-ghost')}${s.until ? `<span class="ff-wait">Waiting for you</span>` : ffBtn(FF.step + 1 === t.steps.length ? 'Finish' : 'Next', `ffStep(${FF.step + 1})`)}</div>`;
    ffTick();
  }
}
function ffView(v) {
  FF.view = v;
  FF.answer = null;
  ffDraw();
}
function ffOpen() {
  if (!FF.on) return;
  FF.open = true;
  $('#ff-welcome')?.remove();
  $('#ff-peek')?.remove();
  ffDraw();
}
function ffClose() {
  FF.open = false;
  ffDraw();
}
const ffToggle = () => (FF.open ? ffClose() : ffOpen());
function ffSet(key, value) {
  FF[key] = value;
  if (key === 'home') ffHome();
  ffSave();
  ffDraw();
}
/* The checkbox: off hides Firefly everywhere; the bell goes back to plain notifications. */
function ffSetOn(on) {
  FF.on = !!on;
  if (!on) Object.assign(FF, { open: false }), FF.tour && ffTourEnd(false), $('#ff-welcome')?.remove();
  ffSave();
  ffDraw();
  toast(on ? 'Firefly is on.' : 'Firefly is off. Turn it back on from the notification bell.');
}
/* A short line beside the bug that goes away by itself. */
function ffSay(text) {
  $('#ff-peek')?.remove();
  $('#ff-root').insertAdjacentHTML('beforeend', `<button type="button" class="ff-peek" id="ff-peek" onclick="ffOpen()">${esc(text)}</button>`);
  ffPlace();
  setTimeout(() => $('#ff-peek')?.remove(), 6000);
}
/* Where the bug sits, and the panel beside it. */
function ffHome() {
  const bug = $('#ff-bug');
  if (!bug) return;
  if (FF.pos) bug.style.cssText = `left:${Math.min(innerWidth - 60, Math.max(4, FF.pos[0]))}px;top:${Math.min(innerHeight - 60, Math.max(70, FF.pos[1]))}px;right:auto;bottom:auto`;
  else bug.style.cssText = '';
}
function ffBugTo(x, y) {
  $('#ff-bug').style.cssText = `left:${x}px;top:${y}px;right:auto;bottom:auto`;
}
/* A highlight flickers: dark, then there. */
function ffFlicker() {
  const bug = $('#ff-bug');
  if (!bug || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  bug.classList.remove('flick');
  void bug.offsetWidth;
  bug.classList.add('flick');
}
function ffBurst() {
  const bug = $('#ff-bug'), r = (bug.hidden ? $('#ta-bell') : bug).getBoundingClientRect();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const html = Array.from({ length: 14 }, (_, i) => `<i class="ff-spark" style="left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.round(Math.cos((i / 14) * 6.283) * (50 + (i % 3) * 22))}px;--dy:${Math.round(Math.sin((i / 14) * 6.283) * (50 + (i % 3) * 22))}px"></i>`).join('');
  $('#ff-root').insertAdjacentHTML('beforeend', `<span id="ff-sparks">${html}</span>`);
  setTimeout(() => $('#ff-sparks')?.remove(), 1100);
}
function ffPlace() {
  const panel = $('#ff-panel'), bug = $('#ff-bug'), anchor = (FF.home === 'bell' ? $('#ta-bell') : bug).getBoundingClientRect(), phone = innerWidth <= 680;
  if (!panel.hidden && !phone) {
    const w = 388, h = Math.min(panel.offsetHeight, innerHeight - 90), up = anchor.top > innerHeight / 2;
    panel.style.cssText = `left:${Math.min(innerWidth - w - 12, Math.max(12, anchor.right - w))}px;top:${up ? Math.max(74, anchor.top - h - 10) : Math.min(innerHeight - h - 12, anchor.bottom + 10)}px`;
  } else if (!panel.hidden) panel.style.cssText = '';
  for (const id of ['ff-peek', 'ff-welcome']) {
    const el = $('#' + id);
    if (el && !phone) el.style.cssText = `right:${Math.max(12, innerWidth - anchor.left + 8)}px;${anchor.top > innerHeight / 2 ? `bottom:${Math.max(12, innerHeight - anchor.bottom)}px` : `top:${anchor.top}px`}`;
  }
}
/* The first visit: one small card, three choices, never in the way. */
function ffWelcome(force) {
  if (!FF.on || (!force && (FF.seen.welcome || FF.assist === 'off'))) return;
  FF.seen.welcome = true;
  FF.welcomed = true;
  ffSave();
  const side = ffSide(), first = ffCatalog().find((t) => t.section === side && !FF.done[t.id]);
  $('#ff-welcome')?.remove();
  $('#ff-root').insertAdjacentHTML('beforeend', `<section class="ff-welcome" id="ff-welcome" role="dialog" aria-label="Welcome from Firefly"><button type="button" class="ff-x" aria-label="Close" onclick="this.parentNode.remove()">×</button>
    <small>Welcome</small><b>I’m Firefly. I’ll show you around.</b><p>This is the ${ffSideName(side)}. I point at the real buttons and wait while you press them. Nothing is sent or saved by me.</p>
    <div class="ff-row">${ffBtn('The whole app in a minute', "ffTourStart('welcome')")}${first ? ffBtn(esc(first.name), `ffTourStart('${first.id}')`, 'ff-ghost') : ''}</div>
    <div class="ff-row">${ffBtn('What needs me today?', 'ffOpen()', 'ff-link')}${ffBtn('Not now', "document.getElementById('ff-welcome').remove()", 'ff-link')}</div></section>`);
  ffFlicker();
  ffPlace();
}

/* ---------- Mounting ---------- */
document.body.insertAdjacentHTML('beforeend', `<div id="ff-root"><button type="button" class="ff-bug" id="ff-bug"><span class="ff-glow"></span>${ffBugSvg(36)}<span class="ff-n" hidden></span></button><section class="ff-panel" id="ff-panel" role="dialog" aria-label="Firefly" hidden></section></div>`);
ffHome();
{
  /* Drag to move (the bug chases the pointer), click to open, double-click or a long press to talk. */
  const bug = $('#ff-bug');
  let down = null, moved = false, press = null, clicks = 0, wait = null, tx = 0, ty = 0, raf = 0;
  const chase = () => {
    const r = bug.getBoundingClientRect(), x = r.left + (tx - r.left) * 0.35, y = r.top + (ty - r.top) * 0.35;
    ffBugTo(x, y);
    raf = moved && down ? requestAnimationFrame(chase) : 0;
  };
  bug.addEventListener('pointerdown', (e) => {
    if (FF.tour) return;
    down = [e.clientX, e.clientY];
    moved = false;
    bug.setPointerCapture(e.pointerId);
    press = e.pointerType === 'touch' ? setTimeout(() => !moved && ffTalk() && (press = 'talk'), 520) : null;
  });
  bug.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (!moved && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 7) return;
    moved = true;
    clearTimeout(press);
    tx = e.clientX - 28;
    ty = e.clientY - 28;
    if (!raf) raf = requestAnimationFrame(chase);
  });
  bug.addEventListener('pointerup', () => {
    clearTimeout(press);
    if (press === 'talk') return (press = null), (down = null), void ffTalkStop();
    if (moved) {
      FF.pos = [Math.min(innerWidth - 60, Math.max(4, tx)), Math.min(innerHeight - 60, Math.max(70, ty))];
      ffHome();
      ffSave();
      ffPlace();
    } else if (down && !FF.tour) {
      clicks++;
      clearTimeout(wait);
      wait = setTimeout(() => {
        if (clicks > 1 && !FF.open) ffTalk() || ffToggle();
        else ffToggle();
        clicks = 0;
      }, clicks > 1 ? 0 : 240);
    }
    down = null;
  });
}
document.addEventListener('pointerdown', (e) => {
  if (FF.open && !e.target.closest('#ff-root, #ta-bell, .modal-back, .ta-sheet-back')) ffClose();
});
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (e.key === 'Escape') {
    if (FF.tour) ffTourEnd(false);
    else if (FF.open) ffClose();
    $('#ff-welcome')?.remove();
  } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f' && !typing) {
    e.preventDefault();
    ffTalk();
  } else if (e.key === '?' && !typing && FF.on) ffToggle();
});
addEventListener('resize', () => (ffHome(), ffPlace()));
/* Docked: the bell opens Firefly. Floating, or off: the bell is plain notifications, with the switch. */
{
  const notices = taOpenNotices;
  taOpenNotices = function () {
    if (FF.on && FF.home === 'bell') return ffToggle();
    notices();
    $('.modal')?.insertAdjacentHTML('beforeend', `<label class="checkrow ff-onrow"><input type="checkbox" id="ff-on-bell" ${FF.on ? 'checked' : ''} onchange="ffSetOn(this.checked)"> Show Firefly, the guide that points things out</label>`);
  };
  const drawn = render;
  let lastSide = '';
  render = function () {
    drawn();
    ffDraw();
    const side = ffSide();
    if (FF_AUTO && FF.on && side !== lastSide && lastSide && ['standard', 'proactive'].includes(FF.assist) && !FF.open && !FF.tour && !FF.seen['peek:' + side]) {
      const st = ffState(), urgent = st.needs.find((n) => n.tone === 'critical');
      if (urgent) (FF.seen['peek:' + side] = true), ffSay(urgent.title);
    }
    lastSide = side;
  };
}
document.addEventListener('DOMContentLoaded', () => {
  render();
  /* Minimal and up: one welcome for a first visit. */
  if (FF_AUTO) setTimeout(() => !FF.welcomed && ffWelcome(), 1400);
});
