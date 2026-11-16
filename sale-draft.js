/* sale-draft.js: an unfinished sale is kept, and Home offers to pick it up.

   Before: pressing Home, a refresh or the phone's Back button reset the building with no warning.
   Now the building being designed is remembered on this device from the first choice made. Home
   shows "Pick up where you left off" with Resume and Start over. A quote or an order clears it.
   Kept: the building, the step, the customer's name, the term and the budget. Nothing else.
   Turbo Assist has no draft-sale record; this is a feature the product still has to accept.
   Loaded last; wraps render(). */
{
  const KEY = 'sales:draft';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = (d) => { try { d ? localStorage.setItem(KEY, JSON.stringify(d)) : localStorage.removeItem(KEY); } catch (e) {} };
  let made = null; /* how many quotes and orders existed at the last draw */

  const designing = () => S.page === 'configure' && S.path !== 'lot' && !S.activeQuote;
  const touched = () => S.step > 0 || S.completed > 0;

  function saleDraftResume() {
    const d = read();
    if (!d) return;
    Object.assign(S, { c: d.c, step: d.step, completed: d.completed, path: d.path, customer: d.customer || '', saleLead: d.saleLead ?? null, term: d.term || 60, budget: d.budget || 0, budgetMode: d.budgetMode || S.budgetMode, lot: null, activeSale: null, activeQuote: null });
    go('configure');
    toast('Picked up where you left off.');
  }
  function saleDraftDrop() {
    write(null);
    render();
    toast('Unfinished sale cleared.');
  }
  window.saleDraftResume = saleDraftResume;
  window.saleDraftDrop = saleDraftDrop;

  function card(d) {
    const when = new Date(d.at), today = when.toDateString() === new Date().toDateString();
    const time = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const date = today ? `today at ${time}` : `${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
    let name = '';
    try { name = label(d.c); } catch (e) { name = `${d.c.size} ${d.c.style}`; }
    return `<section class="panel sd-card" id="sale-draft" aria-label="Unfinished sale">
      <div class="grow"><small class="eyebrow">Pick up where you left off</small>
        <strong>${esc(name)}${d.customer ? ' for ' + esc(d.customer) : ''}</strong>
        <span>Step ${d.step + 1} of ${steps.length} · ${esc(steps[d.step] || '')} · saved ${date}</span></div>
      <div class="actions">${button('Start over', 'saleDraftDrop()', 'secondary')}${button('Resume ' + icon('arrow', 18), 'saleDraftResume()', 'primary')}</div>
    </section>`;
  }

  const baseRender = render;
  render = function () {
    baseRender.apply(this, arguments);
    try {
      const count = S.sales.length + S.quotes.length;
      if (made != null && count > made) write(null); /* it became a quote or an order */
      made = count;
      if (designing() && touched())
        write({ c: S.c, step: S.step, completed: S.completed, path: S.path, customer: S.customer, saleLead: S.saleLead, term: S.term, budget: S.budget, budgetMode: S.budgetMode, at: Date.now() });
      const d = read();
      if (d && S.page === 'home' && document.body.dataset.side === 'sales' && !document.getElementById('sale-draft'))
        document.querySelector('#app .hero')?.insertAdjacentHTML('afterend', card(d));
    } catch (e) {}
  };
}
