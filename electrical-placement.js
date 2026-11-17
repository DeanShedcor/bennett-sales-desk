/* electrical-placement.js: where does the electrical go? The salesperson must say before moving on.

   The owner's rule (Nov 16, 2026): when a building has an electrical package, the Electrical step
   asks "Do you want the default electrical package placement installed?" The salesperson presses
   Yes, or presses Edit floor plan and places it. Until one is pressed the sale cannot move forward:
   not with Continue, not by jumping to a later step, and not with the finish buttons.
   Changing the package or the extra lights, switches or outlets asks again.
   Kept on the building as c.elecPlace: 'default' or 'edited'. It rides to the order and shows on
   the review and the build sheet note, so the plant knows which one the customer chose.
   Existing functions hooked: stepBody(), goStep(), whenBuildReady(), change(), closeBuildSheet(),
   openBuildSheet('cfg', true). Turbo Assist's configurator plan leaves floor plans out of scope,
   so this question is a feature the product still has to accept.
   Loaded after buildsheet.js and the Sales files; wraps their globals. */
{
  const hasPower = (c) => c && c.catalogOptions && c.electrical && c.electrical !== 'None';
  const needsAnswer = (c = S.c) => hasPower(c) && S.path !== 'lot' && !c.elecPlace;
  const elecIndex = () => steps.indexOf('Electrical');
  let fromCard = false; /* the floor plan was opened from the question */

  function elecPlaceDefault() {
    const pos = S.c.sheet?.pos;
    if (pos) for (const k of Object.keys(pos)) if (/^[sol]\d+$/.test(k)) delete pos[k]; /* switches, outlets and lights go back to the standard spots */
    S.c.elecPlace = 'default';
    render();
    toast('Default electrical placement will be installed.');
  }
  function elecPlaceEdit() {
    fromCard = true;
    openBuildSheet('cfg', true);
  }
  function elecPlaceAgain() {
    delete S.c.elecPlace;
    render();
  }
  Object.assign(window, { elecPlaceDefault, elecPlaceEdit, elecPlaceAgain });

  function card(c) {
    if (c.elecPlace === 'default')
      return `<div class="ep-card done" id="ep-card">${icon('check', 20)}<div class="grow"><strong>Default electrical placement will be installed.</strong><small>Lights, switches and outlets go in the standard spots for this building.</small></div><button type="button" class="secondary" onclick="elecPlaceAgain()">Change</button></div>`;
    if (c.elecPlace === 'edited')
      return `<div class="ep-card done" id="ep-card">${icon('check', 20)}<div class="grow"><strong>The electrical is placed on the floor plan.</strong><small>The plant builds it the way the floor plan shows.</small></div><button type="button" class="secondary" onclick="elecPlaceEdit()">Edit floor plan</button><button type="button" class="secondary" onclick="elecPlaceAgain()">Change</button></div>`;
    return `<div class="ep-card ask" id="ep-card"><div class="grow"><strong>Do you want the default electrical package placement installed?</strong><small>Press Yes to put the lights, switches and outlets in the standard spots. Or press Edit floor plan to choose where each one goes. You need to press one to keep going.</small></div><div class="ep-actions"><button type="button" class="primary" onclick="elecPlaceDefault()">Yes</button><button type="button" class="secondary" onclick="elecPlaceEdit()">Edit floor plan</button></div></div>`;
  }

  /* The Electrical step shows the question in place of the plain "Open floor plan" strip. */
  const baseStep = stepBody;
  stepBody = function () {
    const [title, body] = baseStep();
    if (steps[S.step] !== 'Electrical' || !hasPower(S.c) || S.path === 'lot') return [title, body];
    const plain = body.replace(/<div class="bs-cfgplan">[\s\S]*?<\/button><\/div>/, '');
    return [title, plain + card(S.c)];
  };

  function stop() {
    if (S.step !== elecIndex()) { S.step = elecIndex(); render(); }
    const el = document.getElementById('ep-card');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); }
    toast('Press Yes or Edit floor plan for the electrical first.');
  }

  /* Continue, the step buttons and the bar's Continue all go through goStep. */
  const baseGo = goStep;
  goStep = function (step) {
    if (needsAnswer() && elecIndex() >= 0 && step > elecIndex() && S.step <= elecIndex() && S.completed >= elecIndex()) return stop();
    if (needsAnswer() && elecIndex() >= 0 && step > elecIndex() && S.step > elecIndex()) return stop(); /* the package was changed later on */
    return baseGo(step);
  };
  /* Create quote and Complete the sale. */
  const baseReady = whenBuildReady;
  whenBuildReady = function (action) {
    if (needsAnswer() && S.completed >= elecIndex()) return stop();
    return baseReady(action);
  };

  /* A different package, or more or fewer extras, is a different layout: ask again. */
  const baseChange = change;
  change = function (key, value, resolve) {
    const before = JSON.stringify([S.c.electrical, S.c.extraLights, S.c.extraSwitches, S.c.extraReceptacles, S.c.size, S.c.style]);
    baseChange(key, value, resolve);
    const after = JSON.stringify([S.c.electrical, S.c.extraLights, S.c.extraSwitches, S.c.extraReceptacles, S.c.size, S.c.style]);
    if (before !== after && S.c.elecPlace) { delete S.c.elecPlace; render(); }
  };

  /* Coming back from the floor plan counts as placing it. */
  const baseClose = closeBuildSheet;
  closeBuildSheet = function () {
    const wasCfg = typeof BS !== 'undefined' && BS.key === 'cfg';
    baseClose();
    if (wasCfg && fromCard && hasPower(S.c)) {
      fromCard = false;
      S.c.elecPlace = 'edited';
      render();
      toast('Electrical placed on the floor plan.');
    }
  };

  /* The review and the quote say which one was chosen. */
  if (typeof included === 'function') {
    const baseIncluded = included;
    included = function (c) {
      const out = baseIncluded(c);
      if (hasPower(c) && c.elecPlace) out.push(c.elecPlace === 'default' ? 'Electrical in the default spots' : 'Electrical placed on the floor plan');
      return out;
    };
  }
}
