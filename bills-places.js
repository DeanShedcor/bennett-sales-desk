/* bills-places.js: Company bills are kept place by place, and a setting says who may change them.

   1. Every bill belongs to one place: Corporate, the Manufacturing plant, or one sales lot.
      A drop-down at the top of Company bills picks the place; the counts, the money a month
      and the list follow it. "All places" shows a total for each place and every bill under
      its place. A new bill goes to the place that is picked; under "All places" the form asks.
   2. "Company bills" is its own line under Users and permissions: Cannot see, Can look,
      Can change. Owners and super users can change. The Office admin role can change, the
      Office reviewer role can look, everyone else cannot see. A person who can only look gets
      no add or change buttons, and the functions refuse too.

   Turbo Assist: a company bill already carries a place (ops_obligations.location_id) and the
   list can be asked for one place (the location_id filter in src/components/ops/useOpsObligations.ts).
   It keeps a list of people per kind of bill (access_user_ids, treatment "access", in
   src/lib/opsObligations/obligationTypes.ts). One Cannot see / Can look / Can change setting
   for the whole section, and the totals per place, are features the product still has to accept.
   Every bill here is made up. Loaded last; wraps toBillAdd, toBillSave, toBillToggle, adSection,
   sxMore, render() and replaces OPS_SCREENS['of-bills']. */
{
  /* ---------- Places ---------- */
  const PLACES = [['corp', 'Corporate'], ...PLANTS.map((p) => ['plant:' + p.id, 'Manufacturing plant']), ...LOTS.map((l) => ['lot:' + l.id, `${lotTown(l)} lot`])];
  const placeName = (id) => (PLACES.find((p) => p[0] === id) || PLACES[0])[1];
  const OLD = { 'Central office': 'corp', [`${PLANTS[0].name}, ${PLANTS[0].town}`]: 'plant:' + PLANTS[0].id };
  const placeOf = (where) => (PLACES.find((p) => p[0] === where || p[1] === where) || [OLD[where]])[0] || null;
  const SKEY = 'office:billPlace';
  let saved = 'all';
  try { saved = sessionStorage.getItem(SKEY) || 'all'; } catch (e) {}
  TO.billPlace = saved === 'all' || PLACES.some((p) => p[0] === saved) ? saved : 'all';
  window.bpPlaces = () => PLACES.map((p) => p.slice());
  window.bpPick = function (id) {
    TO.billPlace = id === 'all' || PLACES.some((p) => p[0] === id) ? id : 'all';
    TO.billForm = false;
    try { sessionStorage.setItem(SKEY, TO.billPlace); } catch (e) {}
    render();
  };

  /* ---------- Who may see and change bills ---------- */
  const LEVEL_WORDS = { none: 'Cannot see', read: 'Can look', edit: 'Can change' };
  AD_SECTIONS.splice(AD_SECTIONS.findIndex(([k]) => k === 'payments') + 1, 0, ['bills', 'Company bills']);
  AD_ROLES.admin[1].bills = 'edit';
  AD_ROLES.ops_reviewer[1].bills = 'read';
  const baseSection = adSection;
  adSection = function (page = S.page) { return page === 'of-bills' ? 'bills' : baseSection(page); };
  const level = () => adAccess(adMe(), 'bills');
  const canChange = () => level() === 'edit';
  const NO = 'You can look at bills but not change them.';
  window.bpLevel = level;

  /* ---------- Every bill gets a place ---------- */
  const baseAdd = toBillAdd;
  toBillAdd = function (b, quiet) {
    const place = b.place || placeOf(b.where) || (TO.billPlace !== 'all' ? TO.billPlace : 'corp');
    return baseAdd.call(this, { ...b, place, where: placeName(place) }, quiet);
  };
  TO.bills.forEach((b) => { b.place = b.place || placeOf(b.where) || 'corp'; b.where = placeName(b.place); });

  /* Made-up bills so each place has its own. Due days sit two to three weeks out, so none of
     these adds a "due soon" reminder on its own. */
  const dayIn = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return Math.min(d.getDate(), 28); };
  const rule = (n) => `${toOrdinal(dayIn(n))} of each month`;
  const seed = (place, provider, kind, about, amount, remind, n, more = {}) => toBillAdd({ place, provider, kind, about, amount, paidTo: provider, remind, lead: 5, due: rule(n), ...more }, true);
  seed('corp', 'Sample Mutual Insurance', 'other', 'Insurance on the buildings and trucks', 1850, 'Owner', 16);
  seed('corp', 'Sample Office Software', 'other', 'Office and bookkeeping software', 320, 'Bookkeeper', 18);
  seed('corp', 'Sample Payroll Service', 'other', 'Runs payroll every two weeks', 275, 'Bookkeeper', 20);
  const plant = 'plant:' + PLANTS[0].id;
  seed(plant, 'Sample Electric', 'utility', 'Shop power', 3960, 'Plant manager', 15, { sub: 'electricity' });
  seed(plant, 'Sample Lumber Supply', 'other', 'Lumber and siding account', null, 'Plant manager', 0, { due: 'Net 30 after each delivery', lead: null });
  seed(plant, 'Sample Equipment Leasing', 'lease', 'Forklift lease', 780, 'Plant manager', 19);
  LOTS.forEach((l, i) => {
    const place = 'lot:' + l.id;
    if (!TO.bills.some((b) => b.place === place && b.kind === 'lease')) seed(place, 'Sample Land Trust', 'lease', 'Lot lease', 1800 + ((i * 7) % 9) * 100, 'Owner', 14 + (i % 8));
    seed(place, 'Sample Power Co-op', 'utility', 'Office and yard lights', 140 + ((i * 5) % 13) * 10, 'Office manager', 13 + (i % 9), { sub: 'electricity' });
  });

  /* ---------- Changing a bill is refused for someone who can only look ---------- */
  const baseSave = toBillSave, baseToggle = toBillToggle;
  toBillSave = function () { return canChange() ? baseSave.apply(this, arguments) : toast(NO); };
  toBillToggle = function () { return canChange() ? baseToggle.apply(this, arguments) : toast(NO); };
  window.bpForm = function (open) {
    if (open && !canChange()) return toast(NO);
    TO.billForm = !!open;
    render();
  };

  /* ---------- The screen ---------- */
  const fixed = (list) => list.filter((b) => b.status === 'active' && b.cadence === 'monthly' && b.amount != null).reduce((t, b) => t + b.amount, 0);
  const active = (list) => list.filter((b) => b.status === 'active');
  const soon = (list) => list.filter((b) => toBillNext(b)?.soon);
  const at = (id) => TO.bills.filter((b) => b.place === id);
  const row = (b, can) => { const html = toBillRow(b); return can ? html : html.replace(/<button type="button" class="secondary small" onclick="toBillToggle[\s\S]*?<\/button>/, ''); };
  const opt = (list, pick) => list.map(([k, n]) => `<option value="${esc(k)}" ${k === pick ? 'selected' : ''}>${esc(n)}</option>`).join('');

  function picker(pick) {
    const lots = PLACES.filter((p) => p[0].startsWith('lot:'));
    return `<div class="bp-pick"><label for="bp-place">Show bills for</label>
      <select id="bp-place" onchange="bpPick(this.value)">
        <option value="all" ${pick === 'all' ? 'selected' : ''}>All places</option>
        ${opt(PLACES.filter((p) => !p[0].startsWith('lot:')), pick)}
        <optgroup label="Sales lots">${opt(lots, pick)}</optgroup>
      </select></div>`;
  }
  function form(pick) {
    const one = pick !== 'all';
    return `<section class="panel to-billform"><h2>Add a bill${one ? ' for ' + esc(placeName(pick)) : ''}</h2>
    <div class="fields"><label>Who the bill is from<input id="to-b-provider" maxlength="80" placeholder="Example: Sample Power Co-op"></label>
      <label>Kind<select id="to-b-kind" onchange="document.getElementById('to-b-subwrap').hidden=this.value!=='utility'">${opt(Object.entries(TO_BILL_KIND), 'utility')}</select></label>
      <label id="to-b-subwrap">Utility<select id="to-b-sub">${opt(Object.entries(TO_BILL_SUB), 'electricity')}</select></label>
      <label>Place<select id="to-b-where" ${one ? 'disabled' : ''}>${one ? opt([[pick, placeName(pick)]], pick) : '<option value="">Pick a place</option>' + opt(PLACES, '')}</select></label>
      <label>Account<input id="to-b-account" maxlength="40" placeholder="Example: ending 0000"></label>
      <label>What it is for<input id="to-b-about" maxlength="80"></label>
      <label>How often<select id="to-b-cadence">${opt(TO_BILL_CADENCE.map((c) => [c, c]), 'monthly')}</select></label>
      <label>When it is due<input id="to-b-due" maxlength="60" placeholder="15th of each month"></label>
      <label>Amount ($)<input id="to-b-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Leave empty if it changes"></label>
      <label>Who is paid<input id="to-b-paid" maxlength="80" placeholder="Same as who the bill is from"></label>
      <label>Remind this person<select id="to-b-remind">${opt(TO_REMIND.map((r) => [r, r]), 'Office manager')}</select></label>
      <label>Days ahead<input id="to-b-lead" type="number" min="0" max="90" step="1" inputmode="numeric" placeholder="0 to 90"></label>
      <label>Status<select id="to-b-status">${opt(Object.entries(TO_BILL_STATUS).map(([k, [n]]) => [k, n]), 'active')}</select></label></div>
    <p class="source">Written like “15th of each month” (the 1st to the 28th), the bill gets a reminder. Anything else is kept as words. This page is public: do not type a real account number.</p>
    <div class="actions">${button('Save the bill', 'bpSave()')}${button('Cancel', 'bpForm(false)', 'secondary')}</div></section>`;
  }
  window.bpSave = function () {
    if (!canChange()) return toast(NO);
    if (!$('#to-b-where').value) return toast('Pick the place this bill belongs to.');
    toBillSave();
  };
  function locked() {
    return `<section class="panel ad-locked" id="bp-locked"><h1>You do not have access to Company bills.</h1><p>An owner can change this under Users and permissions.</p></section>`;
  }
  function bills() {
    const lv = level();
    if (lv === 'none') return locked();
    const can = lv === 'edit', pick = TO.billPlace, all = pick === 'all', list = all ? TO.bills : at(pick), name = all ? 'All places' : placeName(pick);
    const table = all ? `<section class="panel bp-totals"><h2>Each place’s bills</h2>
      <div class="bp-scroll"><table class="bp-table"><thead><tr><th>Place</th><th>Active bills</th><th>Due soon</th><th>Set bills a month</th><th></th></tr></thead>
      <tbody>${PLACES.map(([id, n]) => { const l = at(id); return `<tr data-place="${id}"><td><strong>${esc(n)}</strong></td><td>${active(l).length}</td><td>${soon(l).length}</td><td>${money(fixed(l))}</td><td><button type="button" class="secondary small" onclick="bpPick('${id}')">Open</button></td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td><strong>All places</strong></td><td>${active(TO.bills).length}</td><td>${soon(TO.bills).length}</td><td id="bp-grand">${money(fixed(TO.bills))}</td><td></td></tr></tfoot></table></div></section>` : '';
    const rows = all
      ? PLACES.map(([id, n]) => { const l = at(id); return l.length ? `<section class="bp-group" data-place="${id}"><h3><span>${esc(n)}</span><small>${money(fixed(l))} a month</small></h3><div class="ops-list">${l.map((b) => row(b, can)).join('')}</div></section>` : ''; }).join('')
      : list.length ? `<div class="ops-list">${list.map((b) => row(b, can)).join('')}</div>` : `<div class="panel emptystate"><strong>No bills for ${esc(name)} yet</strong><p>${can ? 'Press “Add a bill” to add the first one.' : 'Bills added for this place show here.'}</p></div>`;
    return `${head('Office', 'Company bills.', 'Each place has its own bills: every sales lot, the manufacturing plant, and Corporate. Pick a place to see what it costs.')}
    ${picker(pick)}
    ${can ? '' : `<p class="notice" id="bp-look">${NO} Ask an owner to change this.</p>`}
    <div class="today ops-tiles three" id="bp-tiles"><div class="kpi"><strong>${active(list).length}</strong><span>active bills · ${esc(name)}</span></div><div class="kpi"><strong>${soon(list).length}</strong><span>due soon</span></div><div class="kpi"><strong>${money(fixed(list))}</strong><span>a month in set bills</span></div></div>
    ${table}${rows}
    ${can ? (TO.billForm ? form(pick) : `<div class="actions">${button(all ? 'Add a bill' : 'Add a bill for ' + esc(name), 'bpForm(true)', 'secondary')}</div>`) : ''}
    ${opsNotes([
      ['This screen', 'Ops, “Obligations” (<code>ops_obligations</code>): kinds <code>OPS_OBLIGATION_KINDS</code>, utility types <code>OPS_UTILITY_SUBTYPES</code>, cadences <code>OPS_OBLIGATION_CADENCES</code>, statuses active, ended, draft.'],
      ['The place', 'Each bill has a <code>location_id</code>; the list can be asked for one place (the <code>location_id</code> filter in <code>useOpsObligations</code>).'],
      ['The fields', '<code>OBLIGATION_TYPE_FIELDS</code>: Provider, Location, Account, Description, Cadence, Due rule, Amount, Who is paid, Remind this person, Days ahead.'],
      ['Reminders', '<code>nextMonthlyReminderAt</code> reads a rule like “15th of each month”; <code>syncObligationReminder</code> sends “{provider} due soon” in the app, 0 to 90 days ahead. Ended and draft bills send none.'],
      ['Who may see a bill', 'A kind of bill can carry a list of people (<code>access_user_ids</code>, treatment “access”).'],
    ], ['The totals for each place and the “All places” view.', 'One setting for the whole section, Cannot see / Can look / Can change, under Users and permissions: a feature the product still has to accept.', 'Every bill on this page is made up.'])}`;
  }
  OPS_SCREENS['of-bills'] = bills;

  /* ---------- "More" on a phone leaves bills out for someone who cannot see them ---------- */
  if (typeof sxMore === 'function') {
    const baseMore = sxMore;
    window.sxMore = function () {
      const r = baseMore.apply(this, arguments);
      if (level() === 'none') document.querySelectorAll('.sx-morerow').forEach((b) => /go\('of-bills'\)/.test(b.getAttribute('onclick') || '') && b.remove());
      return r;
    };
  }

  /* ---------- After each draw ---------- */
  const baseRender = render;
  render = function () {
    baseRender.apply(this, arguments);
    try {
      const lv = level(), none = lv === 'none', app = $('#app');
      document.querySelectorAll('[data-nav="of-bills"]').forEach((b) => b.classList.toggle('bp-off', none));
      if (none) app.querySelectorAll('[onclick*="go(\'of-bills\')"]').forEach((el) => el.remove());
      if (S.page === 'of-bills') {
        if (none && !app.querySelector('#bp-locked')) app.innerHTML = locked();
        const sel = $('#bp-place');
        if (sel) sel.disabled = false; /* someone who can only look still picks the place */
        const bar = $('#ad-bar b:last-of-type');
        if (bar && LEVEL_WORDS[lv] && /None|Read only|Edit/.test(bar.textContent)) bar.textContent = LEVEL_WORDS[lv];
      }
      /* The Company bills line under Users and permissions uses plain words. */
      document.querySelectorAll('.ad-seg[aria-label="Company bills"] button').forEach((b, i) => (b.textContent = Object.values(LEVEL_WORDS)[i] || b.textContent));
    } catch (e) {}
  };
  render();
}
