/* small-fixes.js: three small fixes that sit on top of everything else.

   1. On a phone the bar at the bottom holds six buttons, and Office and Logistics each have seven
      screens. The last button is now "More". It opens a short list with the two screens that did not
      fit: Office has Settings and Company bills, Logistics has Trailers and Service jobs.
      The screens themselves are unchanged (OPS_SCREENS['of-bills'], OPS_SCREENS['lg-service']).
   2. Firefly's "Today" list: closing it no longer marks the news read. Pressing one piece of news
      marks that one read (ahReadNotice) and opens it (ahNoticeGo), the same as the bell.
   3. The Logistics top bar on a tablet is in small-fixes.css.
   Turbo Assist has no "More" tab; this is a feature the product still has to accept.
   Loaded last; wraps render() and ffState(). */
{
  ICONS.more = '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.500" cy="12" r="1.4"/>';
  const MORE = {
    office: [['of-settings', 'Settings', 'sliders', 'How the office works: tax, terms, people and prices.'], ['of-bills', 'Company bills', 'cash', 'Power, water, leases and loans the company pays.']],
    logi: [['lg-fleet', 'Trailers', 'trailer', 'Each trailer and what it can carry.'], ['lg-service', 'Service jobs', 'build', 'Repairs and visits after a building is built.']],
  };
  const bar = document.querySelector('.tabbar');
  for (const [side, list] of Object.entries(MORE)) {
    const old = bar?.querySelector(`button[data-for="${side}"][data-nav="${list[0][0]}"]`);
    if (!old) continue;
    old.insertAdjacentHTML('afterend', `<button type="button" data-for="${side}" data-more="${side}" class="sx-more" onclick="sxMore('${side}')" aria-haspopup="dialog">${icon('more', 22)}<span>More</span></button>`);
    old.remove();
  }
  window.sxMore = function (side) {
    const list = MORE[side] || [];
    modal('More', `<div class="sx-morelist">${list.map(([page, name, ic, text]) => `<button type="button" class="sx-morerow${S.page === page ? ' on' : ''}" onclick="closeModal();go('${page}')">${icon(ic, 24)}<span><strong>${name}</strong><small>${text}</small></span>${icon('arrow', 18)}</button>`).join('')}</div>`);
  };
  const baseRender = render;
  render = function () {
    baseRender.apply(this, arguments);
    try {
      const nav = typeof opsNav === 'function' ? opsNav(S.page) : S.page;
      document.querySelectorAll('.tabbar [data-more]').forEach((b) => {
        const on = (MORE[b.dataset.more] || []).some((x) => x[0] === nav);
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
    } catch (e) {}
  };

  /* News in Firefly's list: pressing it marks that one read and opens it. */
  if (typeof ffState === 'function' && typeof taNoticesFor === 'function') {
    const baseState = ffState;
    ffState = function () {
      const st = baseState.apply(this, arguments);
      try {
        const news = taNoticesFor(ffSide()).filter((n) => !n.read);
        for (const need of st.needs) {
          const n = news.find((x) => x.title === need.title && x.body === need.text && (x.go || '') === (need.go || ''));
          if (n) need.go = `ahReadNotice('${n.id}');${typeof ahNoticeGo === 'function' ? ahNoticeGo(n) : n.go || ''}`;
        }
      } catch (e) {}
      return st;
    };
  }
  render();
}
