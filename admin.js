/* admin.js: Users and permissions, and Model pricing.

   Turbo Assist (bennett-buddy b42d324) already has the pieces this stands on:
   - People: invite, approve, job roles a person can hold several of (ROLE_OPTIONS and
     ORG_ROLE_LABELS in src/components/admin/adminTypes.ts), the lots and plants each person
     belongs to (addUserLocation, AdminMemberPlantAssignments), and removal that deactivates
     and never erases (deactivateMembership). Above an owner sit its platform roles
     (platform_owner, platform_admin): the super users here.
   - Prices: the retail list per model and size, published from a sheet with the columns
     product_line, width_ft, length_ft, msrp (server/orgPricingCsv.ts), and per-dealer MSRP
     overrides (OrgSettingsSectionPricingOverrides). resolve_pricing reads both.
   Only in this preview so far: None / Read only / Edit per section, the two-step removal of
   an owner, job titles on a user, a publish date on a price change, and "view as".
   Every person here is made up. No cost or wholesale number is on this page.
   Loaded last. Pages live on the Office side: of-users, of-user, of-prices. */

const AD_SECTIONS = [
  ['sales', 'Sales desk'], ['office', 'Office'], ['prod', 'Production'], ['qc', 'Plant QC'], ['logi', 'Logistics'],
  ['pricing', 'Model pricing'], ['payments', 'Payments'], ['settings', 'Office settings'], ['users', 'Users and permissions'],
];
const AD_LEVEL = { none: 0, read: 1, edit: 2 }, AD_LEVEL_NAME = { none: 'None', read: 'Read only', edit: 'Edit' };
/* Job roles: Turbo Assist's role, the name on screen, and the access it starts a person with. */
const AD_ROLES = {
  sales_rep: ['Sales rep', { sales: 'edit' }],
  sales_manager: ['Sales manager', { sales: 'edit', pricing: 'read', logi: 'read' }],
  ops_reviewer: ['Office reviewer', { office: 'edit', payments: 'read', sales: 'read', logi: 'read' }],
  admin: ['Office admin', { office: 'edit', payments: 'edit', settings: 'edit', sales: 'read', prod: 'read', qc: 'read', logi: 'read', pricing: 'read', users: 'read' }],
  manufacturing_plant: ['Plant floor', { prod: 'edit' }],
  manufacturing_plant_supervisor: ['Plant supervisor', { prod: 'edit', qc: 'read' }],
  manufacturing_plant_manager: ['Plant manager', { prod: 'edit', qc: 'read', logi: 'read' }],
  mfg_qc: ['Plant QC', { qc: 'edit', prod: 'read' }],
  mfg_final_qc: ['Final QC', { qc: 'edit', prod: 'read' }],
  logistics_coordinator: ['Dispatcher', { logi: 'edit', office: 'read', prod: 'read' }],
  driver: ['Driver', { logi: 'read' }],
  third_party_hauler_subcoordinator: ['Hauler (view only)', { logi: 'read' }],
  trainer: ['Trainer', { sales: 'read' }],
  marketing: ['Marketing', { sales: 'read' }],
};
const AD_KIND = { super: 'Super user', owner: 'Owner', user: 'Team member' };
const AD = {
  me: 'u1', seq: 20, tab: 'grid', model: 'Basic Utility', lot: '', q: '', open: null,
  users: [
    { id: 'u1', name: 'Super user A', email: 'super.a@example.com', title: 'Company owner', kind: 'super', roles: [], lots: 'all', access: {}, status: 'active' },
    { id: 'u2', name: 'Super user B', email: 'super.b@example.com', title: 'Company owner', kind: 'super', roles: [], lots: 'all', access: {}, status: 'active' },
    { id: 'u3', name: 'Jo Carver', email: 'jo.carver@example.com', title: 'General manager', kind: 'owner', roles: [], lots: 'all', access: {}, status: 'active' },
    { id: 'u4', name: 'Lee Harmon', email: 'lee.harmon@example.com', title: 'Operations', kind: 'owner', roles: [], lots: 'all', access: {}, status: 'active' },
    { id: 'u5', name: 'Morgan Ellis', email: 'morgan.ellis@example.com', title: 'Regional owner', kind: 'owner', roles: [], lots: 'all', access: {}, status: 'pending', removal: { by: 'u3', at: Date.now() - 2 * 864e5, reason: 'Left the company' } },
    { id: 'u6', name: 'Sam Lee', email: 'sam.lee@example.com', title: 'Lot manager', kind: 'user', roles: ['sales_manager'], lots: ['moncks-corner'], access: {}, status: 'active' },
    { id: 'u7', name: 'Casey Park', email: 'casey.park@example.com', title: 'Salesperson', kind: 'user', roles: ['sales_rep'], lots: ['statesboro', 'vidalia'], access: {}, status: 'active' },
    { id: 'u8', name: 'Riley Brooks', email: 'riley.brooks@example.com', title: 'Office coordinator', kind: 'user', roles: ['ops_reviewer'], lots: 'all', access: { payments: 'edit' }, status: 'active' },
    { id: 'u9', name: 'Pat Nolan', email: 'pat.nolan@example.com', title: 'Plant manager', kind: 'user', roles: ['manufacturing_plant_manager'], lots: ['plant:orangeburg'], access: {}, status: 'active' },
    { id: 'u10', name: 'Quinn Avery', email: 'quinn.avery@example.com', title: 'QC inspector', kind: 'user', roles: ['mfg_qc', 'mfg_final_qc'], lots: ['plant:orangeburg'], access: {}, status: 'active' },
    { id: 'u11', name: 'Dee Alvarez', email: 'dee.alvarez@example.com', title: 'Dispatcher', kind: 'user', roles: ['logistics_coordinator'], lots: 'all', access: {}, status: 'active' },
    { id: 'u12', name: 'Marcus Bell', email: 'marcus.bell@example.com', title: 'Driver', kind: 'user', roles: ['driver'], lots: 'all', access: {}, status: 'active' },
    { id: 'u13', name: 'Taylor Finch', email: 'taylor.finch@example.com', title: 'Salesperson', kind: 'user', roles: ['sales_rep'], lots: ['florence'], access: {}, status: 'invited' },
  ],
  /* Prices */
  draft: [], sched: [], log: [], over: {}, lotCtx: null, when: '',
};
const adUser = (id) => AD.users.find((u) => u.id === id);
const adMe = () => adUser(AD.me);
const adIsSuper = (u = adMe()) => u.kind === 'super';
const adIsOwner = (u = adMe()) => u.kind === 'owner' || u.kind === 'super';
const adToday = () => new Date().toLocaleDateString('en-CA');
const adStamp = (t) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const adDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/* ---------- Who can see and change what ---------- */
/* What the job roles alone give for a section. */
function adFromRoles(u, key) {
  return u.roles.reduce((best, r) => (AD_LEVEL[AD_ROLES[r]?.[1][key] || 'none'] > AD_LEVEL[best] ? AD_ROLES[r][1][key] : best), 'none');
}
/* A person's access to one section. Owners and super users have everything; someone who is
   not active has nothing; everyone else gets what their roles give, then their own changes. */
function adAccess(u, key) {
  if (!u || u.status !== 'active') return 'none';
  if (adIsOwner(u)) return 'edit';
  return u.access[key] || adFromRoles(u, key);
}
/* The section a screen belongs to. */
function adSection(page = S.page) {
  if (/^of-(users|user)$/.test(page)) return 'users';
  if (page === 'of-prices') return 'pricing';
  if (page === 'of-pay') return 'payments';
  if (page === 'of-settings' || page === 'of-bills') return 'settings';
  const side = typeof opsSide === 'function' && opsSide(page);
  if (side) return side;
  return typeof QC_SCREENS === 'object' && QC_SCREENS[page] ? 'qc' : 'sales';
}
const adCan = (key, want = 'edit') => AD_LEVEL[adAccess(adMe(), key)] >= AD_LEVEL[want];
/* May the person signed in change this user? Owners manage everyone below super user. */
function adMayEdit(target) {
  const me = adMe();
  if (!adCan('users')) return false;
  if (target.kind === 'super') return adIsSuper(me);
  return adIsOwner(me);
}
/* Who shows in the list. An owner whose removal is waiting, or is final, is gone for everyone but a super user. */
const adVisible = (u) => adIsSuper() || !(u.kind === 'owner' && ['pending', 'deleted'].includes(u.status));
const adLots = (u) => (u.lots === 'all' ? 'All lots and plants' : u.lots.map((x) => (x.startsWith('plant:') ? plantById(x.slice(6))?.name || 'Plant' : lotById(x)?.town || x)).join(', ') || 'No lot yet');

/* ---------- People: add, change, remove ---------- */
function adOpen(id) {
  AD.open = id;
  go('of-user');
}
function adAddForm() {
  const kinds = adIsSuper() ? ['user', 'owner', 'super'] : ['user', 'owner'];
  modal('Add a person', `<div class="fields"><label>Name<input id="ad-n" maxlength="60" placeholder="First and last name"></label><label>Email<input id="ad-e" type="email" maxlength="80" placeholder="name@example.com"></label>
    <label>Title<input id="ad-t" maxlength="60" placeholder="Example: Lot manager"></label><label>Kind of account<select id="ad-k">${kinds.map((k) => `<option value="${k}">${AD_KIND[k]}</option>`).join('')}</select></label>
    <label>Job role<select id="ad-r"><option value="">Choose later</option>${Object.entries(AD_ROLES).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
    <label>Lot or plant<select id="ad-l"><option value="all">All lots and plants</option>${PLANTS.map((p) => `<option value="plant:${p.id}">${esc(p.name)}</option>`).join('')}${LOTS.map((l) => `<option value="${l.id}">${esc(lotTown(l))}</option>`).join('')}</select></label></div>
    <p class="source">They get an email invitation and show as invited until they accept. This page is public: use made-up people here.${adIsSuper() ? '' : ' Only a super user can add a super user.'}</p>
    <div class="actions">${button('Send the invitation', 'adAdd()')}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function adAdd() {
  const v = (id) => $('#' + id).value.trim(), name = v('ad-n'), kind = v('ad-k'), lot = v('ad-l');
  if (!name) return toast('Type the person’s name.');
  if (kind === 'super' && !adIsSuper()) return toast('Only a super user can add a super user.');
  const u = { id: 'u' + ++AD.seq, name, email: v('ad-e'), title: v('ad-t'), kind, roles: kind === 'user' && v('ad-r') ? [v('ad-r')] : [], lots: kind !== 'user' || lot === 'all' ? 'all' : [lot], access: {}, status: 'invited', by: AD.me };
  AD.users.push(u);
  closeModal();
  adOpen(u.id);
  toast(`${name} is invited.`);
}
function adSet(id, key, value) {
  const u = adUser(id);
  if (!u || !adMayEdit(u)) return toast('You cannot change this person.');
  if (key === 'kind') {
    if ((value === 'super' || u.kind === 'super') && !adIsSuper()) return toast('Only a super user can add or change a super user.'), render();
    u.kind = value;
    if (value !== 'user') Object.assign(u, { lots: 'all', access: {} });
  } else u[key] = value;
  render();
}
function adRole(id, role, on) {
  const u = adUser(id);
  if (!u || !adMayEdit(u)) return;
  u.roles = on ? [...new Set([...u.roles, role])] : u.roles.filter((r) => r !== role);
  render();
}
/* One section for one person. Choosing what the roles already give clears the personal change. */
function adLevel(id, key, level) {
  const u = adUser(id);
  if (!u || !adMayEdit(u)) return;
  if (level === adFromRoles(u, key)) delete u.access[key];
  else u.access[key] = level;
  render();
}
function adLot(id, lot, on) {
  const u = adUser(id);
  if (!u || !adMayEdit(u)) return;
  if (lot === 'all') u.lots = on ? 'all' : [];
  else u.lots = on ? [...new Set([...(u.lots === 'all' ? [] : u.lots), lot])] : (u.lots === 'all' ? [] : u.lots).filter((x) => x !== lot);
  render();
}
function adJoin(id) {
  adUser(id).status = 'active';
  render();
  toast('Marked as joined.');
}
function adRemoveForm(id) {
  const u = adUser(id), twoStep = u.kind === 'owner' && !adIsSuper();
  modal(`Remove ${esc(u.name)}`, `<p>${twoStep ? `${esc(u.name)} is an owner. They are locked out right away and told their access is under review. A super user then has to accept the removal before it is final.` : u.kind === 'owner' ? `${esc(u.name)} is an owner. As a super user your removal is final.` : `${esc(u.name)} can no longer sign in. Their past work stays on the orders.`}</p>
    <label class="field">Reason<input id="ad-why" maxlength="100" placeholder="Example: left the company"></label>
    <div class="actions">${button('Remove', `adRemove('${id}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`);
}
function adRemove(id) {
  const u = adUser(id), me = adMe(), reason = $('#ad-why')?.value.trim() || '';
  if (!u || id === AD.me) return toast('You cannot remove yourself.');
  if (!adMayEdit(u)) return toast('You cannot remove this person.');
  const twoStep = u.kind === 'owner' && !adIsSuper(me);
  u.status = twoStep ? 'pending' : u.kind === 'owner' ? 'deleted' : 'off';
  u.removal = { by: me.id, at: Date.now(), reason };
  if (twoStep && typeof taNotify === 'function') taNotify({ to: 'office', title: `Owner removal waiting on a super user — ${u.name}`, body: `${me.name} removed ${u.name}${reason ? ': ' + reason : ''}. They are locked out until a super user accepts or restores them.`, go: "go('of-users')" });
  closeModal();
  go('of-users');
  toast(twoStep ? `${u.name} is removed.` : `${u.name} is removed.`);
}
/* The super user's answer on an owner's removal. */
function adDecide(id, accept) {
  const u = adUser(id);
  if (!adIsSuper() || !u) return toast('Only a super user can do this.');
  u.status = accept ? 'deleted' : 'active';
  if (!accept) u.removal = null;
  else u.removal.final = { by: AD.me, at: Date.now() };
  render();
  toast(accept ? `${u.name} is deleted.` : `${u.name} is restored.`);
}
function adRestore(id) {
  const u = adUser(id);
  if (!adMayEdit(u)) return;
  u.status = 'active';
  u.removal = null;
  render();
}
function adView(id) {
  AD.me = id;
  render();
}

/* ---------- Screens: people ---------- */
function adAccessLine(u) {
  if (adIsOwner(u)) return 'Everything';
  const on = AD_SECTIONS.map(([k, n]) => [n, adAccess(u, k)]).filter(([, l]) => l !== 'none');
  return on.length ? on.map(([n, l]) => `${n}${l === 'read' ? ' (read only)' : ''}`).join(' · ') : 'Nothing yet';
}
function adRow(u) {
  const pill = { active: '', invited: '<span class="pill amber">Invited</span>', off: '<span class="pill ghost">Removed</span>', pending: '<span class="pill red">Removal waiting</span>', deleted: '<span class="pill ghost">Deleted</span>' }[u.status];
  return `<article class="ops-row"><div class="grow"><div class="ops-rowtop"><strong>${esc(u.name)}</strong><span class="serial">${esc(u.title || 'No title')}</span><span class="pill ${u.kind === 'super' ? 'blue' : u.kind === 'owner' ? 'good' : ''}">${AD_KIND[u.kind]}</span>${pill}${u.id === AD.me ? '<span class="pill ghost">You</span>' : ''}</div>
    <p class="ops-rowsub">${u.kind === 'user' ? esc(u.roles.map((r) => AD_ROLES[r][0]).join(', ') || 'No job role yet') + ' · ' : ''}${esc(adLots(u))}</p>
    <div class="ops-flags"><span class="ops-flag">${esc(adAccessLine(u))}</span>${u.removal ? `<span class="ops-flag">Removed by ${esc(adUser(u.removal.by)?.name || 'someone')} ${adStamp(u.removal.at)}${u.removal.reason ? ' · ' + esc(u.removal.reason) : ''}</span>` : ''}</div></div>
    <div class="ops-rowacts">${u.status === 'pending' && adIsSuper() ? `<button type="button" class="primary small" onclick="adDecide('${u.id}',true)">Accept removal</button><button type="button" class="secondary small" onclick="adDecide('${u.id}',false)">Restore</button>` : ''}
    ${['off', 'deleted'].includes(u.status) && adMayEdit(u) ? `<button type="button" class="secondary small" onclick="adRestore('${u.id}')">Restore</button>` : ''}
    <button type="button" class="secondary small" onclick="adOpen('${u.id}')">Open</button></div></article>`;
}
function adViewAs() {
  return `<label class="ad-viewas">View this app as<select onchange="adView(this.value)">${AD.users.map((u) => `<option value="${u.id}" ${u.id === AD.me ? 'selected' : ''}>${esc(u.name)} · ${AD_KIND[u.kind]}${u.status === 'active' ? '' : ' · ' + ({ invited: 'invited', off: 'removed', pending: 'removal waiting', deleted: 'deleted' })[u.status]}</option>`).join('')}</select></label>`;
}
function adUsersPage() {
  const list = AD.users.filter(adVisible), can = adCan('users');
  const group = (title, rows, hint = '') => (rows.length ? `<h2 class="sectionhead qc-group">${title} <small>${rows.length}</small></h2>${hint ? `<p class="ad-hint">${hint}</p>` : ''}<div class="ops-list">${rows.map(adRow).join('')}</div>` : '');
  const live = list.filter((u) => ['active', 'invited'].includes(u.status));
  return `${head('Settings', 'Users and permissions.', 'Who can sign in, what each person can see, and what they can change.')}
    <div class="ad-top">${adViewAs()}<div class="actions">${can && adIsOwner() ? button('Add a person', 'adAddForm()') : ''}${button('Model pricing', "go('of-prices')", 'secondary')}${button('Office settings', "go('of-settings')", 'secondary')}</div></div>
    <p class="source">There are no sign-ins in this preview. “View this app as” shows what that person would see, on every side.</p>
    ${group('Waiting on a super user', list.filter((u) => u.status === 'pending'), 'An owner removed these owners. They are locked out now. Accept to make it final, or restore them.')}
    ${group('Super users', live.filter((u) => u.kind === 'super'), 'Everything, plus the only ones who can add a super user or finally delete an owner.')}
    ${group('Owners', live.filter((u) => u.kind === 'owner'), 'Everything by default, including prices and adding people.')}
    ${group('Team', live.filter((u) => u.kind === 'user'))}
    ${group('Removed', list.filter((u) => ['off', 'deleted'].includes(u.status)))}
    ${opsNotes([
      ['Adding a person', 'Tenant admin, invite and approve (<code>AdminInviteUserBlock</code>, <code>AdminPendingApprovalsBlock</code>, <code>admin_approve_profile</code>).'],
      ['Job roles', '<code>ROLE_OPTIONS</code> and <code>ORG_ROLE_LABELS</code>; a person can hold several. The logistics roles are in <code>turboLogisticsRoles.ts</code>.'],
      ['Lots and plants', '<code>addUserLocation</code>, <code>removeUserLocation</code> and <code>AdminMemberPlantAssignments</code>.'],
      ['Removing a person', '<code>deactivateMembership</code>: the membership is switched off, never erased.'],
      ['Super users', 'The platform roles above an org owner (<code>platform_owner</code>, <code>platform_admin</code>).'],
    ], ['None, Read only and Edit for each section. Turbo Assist opens or closes a whole screen by role; it has no read-only level yet.', 'An owner’s removal waiting for a super user to accept it.', 'A job title on the user, and “view this app as”.'])}`;
}
function adUserPage() {
  const u = adUser(AD.open);
  if (!u || !adVisible(u)) return `<button class="link backlink" onclick="go('of-users')">${icon('back', 18)} Users</button><p>This person is not in the list.</p>`;
  const may = adMayEdit(u) && !['pending', 'deleted'].includes(u.status), dis = may ? '' : 'disabled', all = adIsOwner(u);
  const kinds = adIsSuper() ? ['user', 'owner', 'super'] : u.kind === 'super' ? ['super'] : ['user', 'owner'];
  const places = [...PLANTS.map((p) => ['plant:' + p.id, p.name]), ...LOTS.map((l) => [l.id, lotTown(l)])];
  return `<button class="link backlink" onclick="go('of-users')">${icon('back', 18)} Users</button>
    ${head(AD_KIND[u.kind], esc(u.name), esc(u.title || ''))}
    <div class="grid2"><section class="panel"><h2>Who they are</h2>
      <div class="fields"><label>Name<input value="${esc(u.name)}" maxlength="60" ${dis} onchange="adSet('${u.id}','name',this.value.trim()||'${esc(u.name)}')"></label><label>Title<input value="${esc(u.title)}" maxlength="60" ${dis} onchange="adSet('${u.id}','title',this.value.trim())"></label>
      <label>Email<input value="${esc(u.email)}" maxlength="80" ${dis} onchange="adSet('${u.id}','email',this.value.trim())"></label><label>Kind of account<select ${dis} onchange="adSet('${u.id}','kind',this.value)">${kinds.map((k) => `<option value="${k}" ${k === u.kind ? 'selected' : ''}>${AD_KIND[k]}</option>`).join('')}</select></label></div>
      <p class="source">${u.kind === 'super' ? 'A super user has everything, and is the only one who can add a super user or finally delete an owner.' : u.kind === 'owner' ? 'An owner has everything by default, can change prices and can add people. Only a super user can finally delete an owner.' : 'A team member gets what their job roles give, then any changes made below.'}</p>
      ${u.status === 'invited' ? `<p class="notice">Invited, not joined yet.</p>${may ? button('Mark as joined', `adJoin('${u.id}')`, 'secondary small') : ''}` : ''}
      ${u.status === 'pending' ? `<p class="notice">Removed by ${esc(adUser(u.removal.by)?.name)} ${adStamp(u.removal.at)}. Locked out until a super user decides.</p>` : ''}
      ${may && u.id !== AD.me && u.status !== 'off' ? `<div class="actions">${button('Remove this person', `adRemoveForm('${u.id}')`, 'secondary small')}</div>` : ''}</section>
    <section class="panel"><h2>Job roles</h2>${all ? '<p class="of-soft">Not needed: this account has everything.</p>' : `<div class="ad-roles">${Object.entries(AD_ROLES).map(([k, [n]]) => `<label class="checkrow"><input type="checkbox" ${u.roles.includes(k) ? 'checked' : ''} ${dis} onchange="adRole('${u.id}','${k}',this.checked)"> ${n}</label>`).join('')}</div><p class="source">Pick one or more. Each role fills in the access below.</p>`}</section></div>
    <section class="panel"><h2>What they can see and change</h2>
      <div class="ad-access">${AD_SECTIONS.map(([k, n]) => {
        const now = all ? 'edit' : u.status === 'active' || u.status === 'invited' ? u.access[k] || adFromRoles(u, k) : 'none', from = adFromRoles(u, k), own = !all && u.access[k] && u.access[k] !== from;
        return `<div class="ad-sec"><span class="grow"><strong>${n}</strong><small>${all ? 'Everything, by the kind of account' : own ? `Changed for this person · the roles give ${AD_LEVEL_NAME[from].toLowerCase()}` : `From the job roles`}</small></span>
          <span class="of-seg ad-seg" role="group" aria-label="${n}">${['none', 'read', 'edit'].map((l) => `<button type="button" class="${now === l ? 'on' : ''}" ${all || !may ? 'disabled' : ''} onclick="adLevel('${u.id}','${k}','${l}')">${AD_LEVEL_NAME[l]}</button>`).join('')}</span></div>`;
      }).join('')}</div></section>
    <section class="panel"><h2>Lots and plants</h2>${all ? '<p class="of-soft">All lots and plants.</p>' : `<label class="checkrow"><input type="checkbox" ${u.lots === 'all' ? 'checked' : ''} ${dis} onchange="adLot('${u.id}','all',this.checked)"> <b>All lots and plants</b></label>
      ${u.lots === 'all' ? '' : `<div class="ad-lots">${places.map(([id, name]) => `<label class="checkrow"><input type="checkbox" ${u.lots.includes(id) ? 'checked' : ''} ${dis} onchange="adLot('${u.id}','${id}',this.checked)"> ${esc(name)}</label>`).join('')}</div>`}
      <p class="source">They see orders, buildings and loads for these places only.</p>`}</section>`;
}

/* ---------- Prices ---------- */
const adKey = (d) => [d.kind, d.lot || '', d.model || d.name, d.size || ''].join('|');
const adItems = () => [...TA_PRICE_PACKAGES.map((x) => ({ x, group: 'Packages' })), ...TA_PRICE_OPTIONS.map((x) => ({ x, group: x.group }))];
const adItem = (name) => TA_PRICE_OPTIONS.find((o) => o.name === name) || TA_PRICE_PACKAGES.find((o) => o.name === name);
/* Today's price for a building at one lot (or the main list when no lot is named). */
function adNow(model, size, lot) {
  return (lot && AD.over[lot]?.[model + '|' + size]) ?? PRICE_LIST[model]?.[size] ?? null;
}
const adDraftOf = (d) => AD.draft.find((x) => adKey(x) === adKey(d));
/* Put one change in the draft. Typing the price it already has takes it back out. */
function adPrice(d, raw, quiet) {
  if (!adCan('pricing')) return toast('You can look at prices but not change them.');
  const value = Math.round(Number(raw) * 100) / 100, old = d.kind === 'item' ? adItem(d.name)?.price : d.kind === 'lot' ? adNow(d.model, d.size, d.lot) : PRICE_LIST[d.model]?.[d.size];
  if (old == null || !(value > 0 || (d.kind === 'item' && value !== 0))) return quiet || (toast('Type a price above zero.'), render());
  AD.draft = AD.draft.filter((x) => adKey(x) !== adKey(d));
  if (value !== old) AD.draft.push({ ...d, old, new: value });
  if (!quiet) render();
}
const adShown = (d, current) => adDraftOf(d)?.new ?? current;
/* Move a whole group by a percent or a dollar amount. */
function adBulk() {
  const scope = $('#ad-scope').value, by = Number($('#ad-by').value), unit = $('#ad-unit').value, round = Number($('#ad-round').value);
  if (!by) return toast('Type how much to move the prices.');
  let n = 0;
  for (const [model, sizes] of Object.entries(PRICE_LIST)) {
    if (scope.startsWith('model:') && scope.slice(6) !== model) continue;
    if (scope.startsWith('series:') && !model.startsWith(scope.slice(7) + ' ')) continue;
    for (const [size, price] of Object.entries(sizes)) {
      if (scope.startsWith('width:') && size.split('x')[0] !== scope.slice(6)) continue;
      const base = adShown({ kind: 'shed', model, size }, price), next = Math.max(1, Math.round((unit === '%' ? base * (1 + by / 100) : base + by) / round) * round);
      adPrice({ kind: 'shed', model, size }, next, true);
      n++;
    }
  }
  render();
  toast(`${n} prices moved into the draft. Nothing is live until you publish.`);
}
function adApply(changes) {
  for (const d of changes) {
    if (d.kind === 'shed') PRICE_LIST[d.model][d.size] = d.new;
    else if (d.kind === 'item') adItem(d.name).price = d.new;
    else (AD.over[d.lot] ||= {})[d.model + '|' + d.size] = d.new;
  }
}
/* Publish the draft: today, or on the day picked. */
function adPublish() {
  if (!adIsOwner()) return toast('Only an owner can publish prices.');
  if (!AD.draft.length) return toast('The draft is empty.');
  const date = $('#ad-when')?.value || adToday(), set = { id: 'P' + (AD.log.length + AD.sched.length + 1), date, by: adMe().name, at: Date.now(), changes: AD.draft };
  AD.draft = [];
  if (date <= adToday()) {
    adApply(set.changes);
    AD.log.unshift(set);
    toast(`${set.changes.length} prices are live.`);
  } else {
    AD.sched.push(set);
    toast(`${set.changes.length} prices will go live ${adDay(date)}.`);
  }
  render();
}
/* The day arrived (or, in the preview, someone pressed the button that pretends it did). */
function adGoLive(id) {
  const i = AD.sched.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [set] = AD.sched.splice(i, 1);
  adApply(set.changes);
  AD.log.unshift({ ...set, wentLive: Date.now() });
  render();
  toast(`${set.changes.length} prices are live.`);
}
function adUnschedule(id) {
  const i = AD.sched.findIndex((x) => x.id === id);
  if (i < 0) return;
  AD.draft.push(...AD.sched.splice(i, 1)[0].changes);
  render();
}
/* The price sheet: Turbo Assist's columns, plus the new price and an optional lot. Opens in Google Sheets. */
const adCsvCell = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
function adSheetCsv() {
  const rows = [['product_line', 'width_ft', 'length_ft', 'msrp', 'new_msrp', 'lot', 'notes'], ['HOW TO USE: type a new price in new_msrp. Leave it blank to keep the price. Type a lot name in lot for a price at that lot only. Do not change the first four columns.', '', '', '', '', '', '']];
  for (const [model, sizes] of Object.entries(PRICE_LIST)) for (const [size, price] of Object.entries(sizes)) rows.push([model, ...size.split('x'), price, '', '', '']);
  for (const { x, group } of adItems()) rows.push([x.name, '', '', x.price, '', '', group + (x.unit && x.unit !== 'each' ? ' · per ' + x.unit : '')]);
  return rows.map((r) => r.map(adCsvCell).join(',')).join('\n');
}
function adSheetDownload() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([adSheetCsv()], { type: 'text/csv' }));
  a.download = 'bennett-price-sheet.csv';
  a.click();
  toast('Price sheet downloaded. In Google Sheets: File, Import, Upload.');
}
function adCsvRows(text) {
  const out = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) c === '"' ? (text[i + 1] === '"' ? ((cell += '"'), i++) : (q = false)) : (cell += c);
    else if (c === '"') q = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), out.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), out.push(row);
  return out;
}
/* Read a filled-in sheet into the draft. Rows it cannot place are counted and named. */
function adSheetLoad(text) {
  if (!adCan('pricing')) return toast('You can look at prices but not change them.');
  const rows = adCsvRows(text), head = (rows[0] || []).map((h) => h.trim().toLowerCase()), col = (n) => head.indexOf(n);
  if (col('product_line') < 0 || col('new_msrp') < 0) return toast('This is not the price sheet: the product_line and new_msrp columns are missing.');
  let n = 0;
  const bad = [];
  for (const r of rows.slice(1)) {
    const name = (r[col('product_line')] || '').trim(), raw = (r[col('new_msrp')] || '').replace(/[$,\s]/g, ''), w = (r[col('width_ft')] || '').trim(), l = (r[col('length_ft')] || '').trim(), lotName = col('lot') < 0 ? '' : (r[col('lot')] || '').trim();
    if (!name || raw === '' || /^how to use/i.test(name)) continue;
    const price = Number(raw), size = w && l ? `${Number(w)}x${Number(l)}` : '';
    const lot = lotName ? LOTS.find((x) => [x.id, x.town, lotTown(x)].some((v) => v.toLowerCase() === lotName.toLowerCase())) : null;
    if (!(price > 0) || (lotName && !lot)) bad.push(name + (size ? ' ' + size : ''));
    else if (size && PRICE_LIST[name]?.[size] != null) adPrice(lot ? { kind: 'lot', lot: lot.id, model: name, size } : { kind: 'shed', model: name, size }, price, true), n++;
    else if (!size && adItem(name) && !lot) adPrice({ kind: 'item', name }, price, true), n++;
    else bad.push(name + (size ? ' ' + size : ''));
  }
  AD.tab = 'draft';
  render();
  toast(`${n} prices read into the draft.${bad.length ? ` ${bad.length} rows could not be placed: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}.` : ''}`);
  return { read: n, bad };
}
function adSheetPick(input) {
  const f = input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => adSheetLoad(String(r.result));
  r.readAsText(f);
}
/* A lot's own price wins over the main list for that lot's sales. */
{
  const listBase = priceListBase;
  priceListBase = function (c, ser) {
    const over = AD.over[AD.lotCtx || DESK_LOT]?.[priceListName(c, ser) + '|' + c.size];
    return over ?? listBase(c, ser);
  };
  if (typeof ofListPrice === 'function') {
    const officeList = ofListPrice;
    ofListPrice = function (s) {
      AD.lotCtx = saleLot(s).id;
      try {
        return officeList(s);
      } finally {
        AD.lotCtx = null;
      }
    };
  }
}

/* ---------- Screens: prices ---------- */
function adPriceInput(d, current, label) {
  const dr = adDraftOf(d), edit = adCan('pricing');
  return `<label class="ad-cell${dr ? ' changed' : ''}"><span>${label}</span><input type="number" min="0" step="1" inputmode="decimal" value="${dr ? dr.new : current}" ${edit ? '' : 'disabled'} aria-label="${esc(label)} price" onchange='adPrice(${esc(JSON.stringify(d))},this.value)'>${dr ? `<small>was ${money(dr.old)}</small>` : ''}</label>`;
}
function adGridTab() {
  const sizes = PRICE_LIST[AD.model], widths = [...new Set(Object.keys(sizes).map((s) => Number(s.split('x')[0])))].sort((a, b) => a - b);
  return `<div class="ad-tools"><label>Model<select onchange="AD.model=this.value;render()">${Object.keys(PRICE_LIST).map((m) => `<option ${m === AD.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label></div>
    ${widths.map((w) => `<h3 class="ad-w">${w} ft wide</h3><div class="ad-grid">${Object.keys(sizes).filter((s) => Number(s.split('x')[0]) === w).sort((a, b) => a.split('x')[1] - b.split('x')[1]).map((s) => adPriceInput({ kind: 'shed', model: AD.model, size: s }, sizes[s], s.replace('x', ' × '))).join('')}</div>`).join('')}
    ${adCan('pricing') ? `<section class="panel ad-bulk"><h3>Move a group of prices</h3><div class="ad-tools"><label>Which prices<select id="ad-scope"><option value="model:${esc(AD.model)}">${esc(AD.model)}, every size</option><option value="all">Every building</option>${['Basic', 'Classic', 'Elite'].map((x) => `<option value="series:${x}">${x} series</option>`).join('')}${[6, 8, 10, 12, 14, 16].map((x) => `<option value="width:${x}">Every ${x} ft wide</option>`).join('')}</select></label>
      <label>Move by<input id="ad-by" type="number" step="0.5" placeholder="3 or -50"></label><label>As<select id="ad-unit"><option value="%">percent</option><option value="$">dollars</option></select></label><label>Round to<select id="ad-round"><option value="1">$1</option><option value="5" selected>$5</option><option value="10">$10</option></select></label>${button('Add to the draft', 'adBulk()', 'secondary')}</div></section>` : ''}`;
}
function adItemsTab() {
  const q = AD.q.trim().toLowerCase(), list = adItems().filter(({ x }) => !q || x.name.toLowerCase().includes(q)), groups = [...new Set(list.map((x) => x.group))];
  return `<label class="searchbar">${icon('orders', 18)}<input class="search" type="search" placeholder="Search options and packages" value="${esc(AD.q)}" onchange="AD.q=this.value;render()"></label>
    ${groups.map((g) => `<h3 class="ad-w">${esc(g)}</h3><div class="ad-grid wide">${list.filter((x) => x.group === g).map(({ x }) => adPriceInput({ kind: 'item', name: x.name }, x.price, x.name + (x.unit && x.unit !== 'each' ? ` · per ${x.unit}` : ''))).join('')}</div>`).join('') || '<p class="muted">Nothing matches.</p>'}`;
}
function adLotTab() {
  const lot = AD.lot || DESK_LOT, sizes = PRICE_LIST[AD.model], own = Object.entries(AD.over[lot] || {});
  return `<p>A lot can sell a model at its own price. Everything else at that lot stays on the main list.</p>
    <div class="ad-tools"><label>Lot<select onchange="AD.lot=this.value;render()">${LOTS.map((l) => `<option value="${l.id}" ${l.id === lot ? 'selected' : ''}>${esc(lotTown(l))}</option>`).join('')}</select></label><label>Model<select onchange="AD.model=this.value;render()">${Object.keys(PRICE_LIST).map((m) => `<option ${m === AD.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label></div>
    ${own.length ? `<p class="ad-hint">${esc(lotById(lot).town)} has its own price on: ${own.map(([k, v]) => `${esc(k.replace('|', ' ').replace('x', ' × '))} ${money(v)}`).join(' · ')}</p>` : ''}
    <div class="ad-grid">${Object.keys(sizes).sort((a, b) => a.split('x')[0] - b.split('x')[0] || a.split('x')[1] - b.split('x')[1]).map((s) => adPriceInput({ kind: 'lot', lot, model: AD.model, size: s }, adNow(AD.model, s, lot), s.replace('x', ' × '))).join('')}</div>`;
}
const adChangeName = (d) => (d.kind === 'item' ? d.name : `${d.model} ${d.size.replace('x', ' × ')}${d.kind === 'lot' ? ' · ' + lotById(d.lot).town + ' only' : ''}`);
function adDraftTab() {
  const up = AD.draft.filter((d) => d.new > d.old).length;
  return `${AD.draft.length ? `<p><b>${AD.draft.length}</b> prices changed: ${up} up, ${AD.draft.length - up} down. Nothing is live yet.</p>
      <ul class="pricelines ad-changes">${AD.draft.slice(0, 60).map((d) => `<li><span>${esc(adChangeName(d))}</span><strong><s>${money(d.old)}</s> ${money(d.new)} <button type="button" class="link inline" onclick='AD.draft=AD.draft.filter((x)=>adKey(x)!==adKey(${esc(JSON.stringify(d))}));render()'>undo</button></strong></li>`).join('')}</ul>${AD.draft.length > 60 ? `<p class="source">${AD.draft.length - 60} more not shown.</p>` : ''}
      ${adIsOwner() ? `<div class="ad-tools"><label>Goes live on<input id="ad-when" type="date" min="${adToday()}" value="${adToday()}"></label>${button('Publish', 'adPublish()')}${button('Throw the draft away', 'AD.draft=[];render()', 'secondary')}</div>` : '<p class="notice">Only an owner can publish.</p>'}
      <p class="source">Quotes and orders already written keep the price they were written with.</p>` : '<p class="muted">No changes waiting. Change a price on another tab, or upload a filled-in price sheet.</p>'}
    ${AD.sched.length ? `<h3 class="ad-w">Set to go live later</h3>${AD.sched.map((s) => `<div class="ad-set"><span class="grow"><strong>${s.changes.length} prices · ${adDay(s.date)}</strong><small>Set up by ${esc(s.by)} ${adStamp(s.at)}</small></span>${adIsOwner() ? `<button type="button" class="secondary small" onclick="adGoLive('${s.id}')">Make it live now</button><button type="button" class="secondary small" onclick="adUnschedule('${s.id}')">Back to draft</button>` : ''}</div>`).join('')}` : ''}
    ${AD.log.length ? `<h3 class="ad-w">Published</h3>${AD.log.map((s) => `<div class="ad-set"><span class="grow"><strong>${s.changes.length} prices · live ${adDay(s.date)}</strong><small>By ${esc(s.by)} · ${esc(s.changes.slice(0, 3).map(adChangeName).join(', '))}${s.changes.length > 3 ? '…' : ''}</small></span></div>`).join('')}` : ''}`;
}
function adSheetTab() {
  return `<p>The whole price list as one sheet, made for Google Sheets or Excel.</p>
    <ol class="ad-steps"><li>${button('Download the price sheet', 'adSheetDownload()', 'secondary small')} It carries today’s prices for every building, option and package.</li>
    <li>Open it in Google Sheets (File, Import, Upload) and type new prices in the <b>new_msrp</b> column. Leave a row blank to keep its price. Type a lot’s name in <b>lot</b> for a price at that lot only.</li>
    <li>Download it from Google Sheets as CSV and upload it here: <input type="file" accept=".csv,text/csv" ${adCan('pricing') ? '' : 'disabled'} onchange="adSheetPick(this)"></li>
    <li>Check the changes on the Draft tab, pick the day, and publish.</li></ol>
    <p class="source">The first four columns are the ones Turbo Assist already reads from a price sheet: product_line, width_ft, length_ft, msrp.</p>`;
}
function adPricesPage() {
  const tabs = [['grid', 'Buildings'], ['items', 'Options and packages'], ['lot', 'Lot prices'], ['sheet', 'Price sheet'], ['draft', `Draft and publish${AD.draft.length ? ` · ${AD.draft.length}` : ''}`]];
  const body = { grid: adGridTab, items: adItemsTab, lot: adLotTab, sheet: adSheetTab, draft: adDraftTab }[AD.tab]();
  return `<button class="link backlink" onclick="go('of-users')">${icon('back', 18)} Users and permissions</button>
    ${head('Settings', 'Model pricing.', 'Retail prices for every building, option and package. Change them here; the Sales desk follows.')}
    ${adCan('pricing') ? '' : '<p class="notice">You can look at prices here. Only an owner, or someone given Edit on Model pricing, can change them.</p>'}
    <div class="ad-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" class="chipbtn${AD.tab === k ? ' on' : ''}" onclick="AD.tab='${k}';render()">${n}</button>`).join('')}</div>
    <section class="panel ad-prices">${body}</section>
    ${opsNotes([
      ['The price list', 'The org’s retail list, published from a sheet (<code>server/orgPricingCsv.ts</code>, “Sales org CSV (MSRP rows)”); <code>resolve_pricing</code> reads it for every quote.'],
      ['Lot prices', '“Subscriber MSRP overrides” (<code>OrgSettingsSectionPricingOverrides</code>): a dealer’s own price on a product.'],
      ['Moving a group of prices', 'Planned as the price change assistant (<code>docs/planning/mfg_price_change_assistant.md</code>).'],
    ], ['The grid you type into, the draft with old and new prices, and a day for the change to go live. Turbo Assist publishes a sheet at once.', 'Prices here are retail only. Cost, margin and wholesale stay in Turbo Assist’s manufacturing pricing and are not on this public page.', 'Windows, doors and electrical in the configurator’s own steps keep their built-in prices; buildings, lot prices and the price-list add-ons follow this page.'])}`;
}

/* ---------- Putting it in the app ---------- */
Object.assign(OPS_SCREENS, { 'of-users': adUsersPage, 'of-user': adUserPage, 'of-prices': adPricesPage });
{
  const baseDetail = opsDetail;
  opsDetail = function (page) {
    return page === 'of-user' ? ['of-users', 'Users', adUser(AD.open)?.name || 'Person'] : page === 'of-prices' ? ['of-users', 'Users', 'Model pricing'] : page === 'of-users' ? ['of-settings', 'Settings', 'Users and permissions'] : baseDetail(page);
  };
  const baseSettings = OPS_SCREENS['of-settings'];
  OPS_SCREENS['of-settings'] = function () {
    const html = baseSettings(), at = html.indexOf('<div class="grid2'), card = `<div class="ad-entry"><button type="button" class="kpi" onclick="go('of-users')">${icon('user', 22)}<span><strong>Users and permissions</strong>${AD.users.filter((u) => u.status === 'active' && adVisible(u)).length} people · who can see and change what</span></button><button type="button" class="kpi" onclick="go('of-prices')">${icon('cash', 22)}<span><strong>Model pricing</strong>Buildings, options, lot prices${AD.draft.length ? ` · ${AD.draft.length} in the draft` : ''}</span></button></div>`;
    return at < 0 ? card + html : html.slice(0, at) + card + html.slice(at);
  };
}
document.querySelector('.topbar-right').insertAdjacentHTML('afterbegin', `<button type="button" class="ta-topbtn" id="ad-gear" onclick="go('of-users')" aria-label="Users, permissions and pricing">${icon('sliders', 18)}</button>`);

/* Viewing as someone else: what they cannot see is closed, what they can only read cannot be changed. */
const AD_SAFE = /^(go\(|open|ofOpen|prOpen|lgOpen|adOpen|adView|taOpen|taClose|taAsk|taPriceList|taRtoOpen|closeModal|S\.\w+=|S\.\w+\s*=|AD\.(tab|model|lot|q)=|TA\.ans|OF\.(tab|payTab|tile|lot|q)|LG\.(tile|q|tab)|PR\.|Q\.|document\.getElementById\('of-list'\)|window\.print|event\.stop|if\(event\.target|this\.closest)/;
document.addEventListener('click', (e) => {
  if (document.body.dataset.adRead !== '1') return;
  const el = e.target.closest('button, [onclick], input[type=checkbox], input[type=radio], input[type=file]');
  if (!el || el.closest('.topbar, .previewstrip, .tabbar, #ad-bar, .ta-sheet-back, .sideswitch') || el.closest('summary')) return;
  if (el.type === 'submit' && el.closest('form.ta-askbar')) return;
  const code = (el.getAttribute('onclick') || '').trim();
  if (el.tagName !== 'INPUT' && (AD_SAFE.test(code) || /Close|Cancel|Back/.test(el.textContent))) return;
  e.preventDefault();
  e.stopPropagation();
  toast(`${adMe().name} can look here but not change anything.`);
}, true);
{
  const drawn = render;
  render = function () {
    const due = AD.sched.filter((s) => s.date <= adToday());
    due.forEach((s) => adGoLive(s.id));
    drawn();
    const me = adMe(), key = adSection(), level = adAccess(me, key), full = me.id === 'u1';
    document.body.dataset.adRead = !full && level === 'read' ? '1' : '';
    document.querySelectorAll('[data-side-btn]').forEach((b) => (b.hidden = !full && adAccess(me, b.dataset.sideBtn) === 'none'));
    $('#ad-bar')?.remove();
    if (full) return;
    const app = $('#app'), name = AD_SECTIONS.find(([k]) => k === key)[1];
    if (me.status === 'pending') app.innerHTML = `<section class="panel ad-locked"><h1>Your access is under review.</h1><p>An owner has removed your account. You cannot sign in until a super user decides. If you think this is a mistake, contact a super user.</p></section>`;
    else if (level === 'none') app.innerHTML = `<section class="panel ad-locked"><h1>${esc(me.name)} has no access to ${name}.</h1><p>${me.status === 'active' ? 'An owner can give access under Users and permissions.' : 'This account is not active.'}</p></section>`;
    else if (level === 'read') app.querySelectorAll('input:not([type=search]):not([type=checkbox]):not([type=radio]), textarea, select:not(.ad-viewas select)').forEach((el) => !el.closest('.qc-filter, .searchbar, .ad-tools, .ad-viewas, .inlinefield') && (el.disabled = true));
    app.insertAdjacentHTML('beforebegin', `<div id="ad-bar"><span>Viewing as <b>${esc(me.name)}</b> · ${AD_KIND[me.kind]}${me.title ? ', ' + esc(me.title) : ''} · ${name}: <b>${me.status === 'pending' ? 'locked out' : AD_LEVEL_NAME[level]}</b></span><button type="button" onclick="adView('u1')">Back to Super user A</button><button type="button" onclick="go('of-users')">Users</button></div>`);
  };
}
document.addEventListener('DOMContentLoaded', () => render());
