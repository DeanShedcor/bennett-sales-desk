/* price-bar.js: the bottom bar of the designer.

   "Price details" is a real green button that sits right after the building total, so the price
   things are together. Everything pressed on the bar is the same height and sits on one line.
   The picked month is yellow, like the monthly price it sets.
   The button does what the old link did: it opens and closes the list of every price line.
   Loaded last; wraps render() and refreshSummary(). On a phone the bar keeps its own layout. */
{
  const wide = window.matchMedia('(min-width: 981px)');
  function fixBar() {
    try {
      const main = document.querySelector('.quoteaside .deal-main');
      if (!main || main.querySelector('.deal-details') || !wide.matches) return;
      const more = main.querySelector('.deal-toggle .deal-more'), total = main.querySelector('.deal-total');
      if (!more || !total) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'deal-details';
      b.setAttribute('aria-expanded', String(Boolean(S.expanded)));
      b.setAttribute('aria-label', (S.expanded ? 'Hide' : 'Show') + ' price details');
      b.onclick = () => { S.expanded = !S.expanded; refreshSummary(); };
      b.appendChild(more);
      total.insertAdjacentElement('afterend', b);
    } catch (e) {}
  }
  const baseRender = render;
  render = function () { const r = baseRender.apply(this, arguments); fixBar(); return r; };
  const baseRefresh = refreshSummary;
  refreshSummary = function () { const r = baseRefresh.apply(this, arguments); fixBar(); return r; };
  wide.addEventListener?.('change', () => { try { if (document.querySelector('.quoteaside')) refreshSummary(); } catch (e) {} });
  fixBar();
}
