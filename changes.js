/* changes.js: change orders on a building that is already ordered.
   Three steps, each owned by a different role: the manager requests the change, an admin
   approves it, and the manufacturing plant acknowledges it.
   Loaded after lot.js and before views.js. */

const CHANGE_STEPS = ['Requested by manager', 'Approved by admin', 'Acknowledged by plant'];
const CHANGE_ROLES = ['Manager', 'Admin', 'Plant'];

/* `order` is a sales record id, or "B" plus the position of a build in the production list.
   `done` counts the finished steps: 1 requested, 2 approved, 3 acknowledged. */
S.changes = [];

/* Preview data: one change order on each of the two orders in production, at different steps.
   Remove this call to start empty. */
function seedChanges() {
  const ago = (hours) => new Date(Date.now() - hours * 36e5).toISOString();
  S.changes.push(
    {
      id: 'CO-1',
      order: 'B0',
      what: 'Change the double shed door to a 6 × 7 roll-up door.',
      reason: 'Customer wants to park a mower inside.',
      done: 1,
      log: [ago(26)],
      sample: true
    },
    {
      id: 'CO-2',
      order: 'B1',
      what: 'Add one 2 × 3 window on the left wall and change the trim color to Black.',
      reason: 'Customer changed their mind after ordering.',
      done: 2,
      log: [ago(74), ago(50)],
      sample: true
    }
  );
}
seedChanges();

function changeOrderName(key) {
  if (key[0] === 'B') return sampleBuilds[Number(key.slice(1))]?.title || 'Production order';
  const s = S.sales.find((s) => s.id === key);
  return s ? `${s.customer} · ${s.id}` : key;
}

function changeStatus(c) {
  if (c.declined) return ['Declined by admin', 'red'];
  return [['', 'Waiting on admin approval', 'Waiting on the plant to acknowledge', 'Complete · plant acknowledged'][c.done], c.done === 3 ? 'good' : 'amber'];
}

const changeWhen = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function changeCard(c) {
  const n = S.changes.indexOf(c);
  const [status, tone] = changeStatus(c);
  return `<div class="changecard"><div class="buildrow-head"><strong>Change order ${c.id}</strong><span class="pill ${tone}">${status}</span>${c.sample ? '<span class="pill ghost">Preview sample</span>' : ''}</div><p class="changetext">${esc(c.what)}</p>${
    c.reason ? `<small>Reason: ${esc(c.reason)}</small>` : ''
  }${chevronTrack(CHANGE_STEPS, c.declined ? 1 : c.done, Boolean(c.declined))}<small>${c.log.map((at, i) => `${['Requested', c.declined ? 'Declined' : 'Approved', 'Acknowledged'][i]} ${changeWhen(at)} · ${CHANGE_ROLES[i]}`).join(' &nbsp;→&nbsp; ')}</small>${
    c.declined || c.done === 3
      ? ''
      : `<div class="stockactions">${
          c.done === 1
            ? `<button type="button" class="chipbtn" onclick="advanceChange(${n})">Approve as admin</button><button type="button" class="link" onclick="declineChange(${n})">Decline as admin</button>`
            : `<button type="button" class="chipbtn" onclick="advanceChange(${n})">Acknowledge as plant</button>`
        }</div>`
  }</div>`;
}

/* Change orders for one order, plus the button to request another. The home page shows a
   one-line status instead of the full cards. */
function changeOrdersMarkup(key) {
  const list = S.changes.filter((c) => c.order === key);
  if (S.page === 'home')
    return list.map((c) => `<span class="pillrow"><span class="pill ${changeStatus(c)[1]}">Change order ${c.id} · ${changeStatus(c)[0]}</span></span>`).join('');
  return `<div class="changes">${list.map(changeCard).join('')}<button type="button" class="secondary small" onclick="requestChange('${key}')">${icon('plus', 16)} Request a change order</button></div>`;
}

function changeSummaryMarkup() {
  const open = S.changes.filter((c) => !c.declined && c.done < 3);
  const admin = open.filter((c) => c.done === 1).length;
  const plant = open.filter((c) => c.done === 2).length;
  return `<section class="panel changesummary"><div class="panelhead"><h2>Change orders</h2><span class="pill ${open.length ? 'amber' : 'ghost'}">${open.length} open</span></div><p>${
    open.length ? `${admin} waiting on admin approval · ${plant} waiting on the plant to acknowledge.` : 'No open change orders.'
  } A change order goes from the manager’s request, to admin approval, to the plant’s acknowledgment.</p>${open
    .map((c) => `<div class="advicerow"><span class="grow"><strong>${c.id} · ${esc(changeOrderName(c.order))}</strong><small>${esc(c.what)}</small></span><span class="pill amber">${changeStatus(c)[0]}</span></div>`)
    .join('')}<p class="source">This preview has no logins, so the admin and plant steps are buttons on each change order. In the live system each role would only see its own step.</p></section>`;
}

function requestChange(key) {
  modal(
    'Request a change order',
    `<p>For <strong>${esc(changeOrderName(key))}</strong>. The request goes to an admin for approval, then to the manufacturing plant.</p>
    <label class="field">What needs to change?<textarea id="change-what" rows="3" maxlength="300" placeholder="Example: change the trim color to Black"></textarea></label>
    <label class="field">Reason<input id="change-reason" maxlength="160" placeholder="Why the change is needed"></label>
    <div class="actions">${button('Send to admin', `saveChange('${key}')`)}${button('Cancel', 'closeModal()', 'secondary')}</div>`
  );
}

function saveChange(key) {
  const what = $('#change-what').value.trim();
  if (!what) return toast('Describe what needs to change.');
  S.changes.push({ id: 'CO-' + (S.changes.length + 1), order: key, what, reason: $('#change-reason').value.trim(), done: 1, log: [new Date().toISOString()] });
  closeModal();
  render();
  toast('Change order sent to admin for approval.');
}

function advanceChange(n) {
  const c = S.changes[n];
  if (c.declined || c.done >= 3) return;
  c.done++;
  c.log.push(new Date().toISOString());
  render();
  toast(c.done === 2 ? 'Approved. Sent to the plant.' : 'Plant acknowledged the change.');
}

function declineChange(n) {
  const c = S.changes[n];
  c.declined = true;
  c.log.push(new Date().toISOString());
  render();
  toast('Change order declined.');
}
