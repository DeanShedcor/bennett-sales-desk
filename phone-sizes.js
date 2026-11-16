/* phone-sizes.js: the safety net behind phone-sizes.css.

   On a phone, after anything on the page changes, it looks at what is on screen and:
   - makes anything you tap at least 44 px tall and wide;
   - lifts reading text under 14 px to 14 px, and typing boxes to 16 px.
   It only runs at phone width, and never touches the map, drawings, the 3D building or Firefly's
   own bug. A feature of this preview; Turbo Assist sets sizes in its own stylesheet. */
{
  const PHONE = window.matchMedia('(max-width: 680px)');
  const TAP = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], summary';
  const SKIP = 'svg, canvas, model-viewer, #ff-bug, .no-fit, .lg-map';
  const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };

  function fitTaps(root) {
    for (const e of root.querySelectorAll(TAP)) {
      if (e.disabled && !e.matches('button')) continue;
      if (e.closest(SKIP)) continue;
      const boxed = /^(checkbox|radio)$/.test(e.type) ? e.closest('label') : null, t = boxed || e, r = seen(t);
      if (!r || (r.height >= 43.5 && r.width >= 43.5)) continue;
      const cs = getComputedStyle(t);
      if (cs.position === 'absolute' || cs.position === 'fixed') { /* a corner button: grow it in place */
        if (r.height < 43.5) t.style.minHeight = '44px';
        if (r.width < 43.5) t.style.minWidth = '44px';
        continue;
      }
      if (cs.display === 'inline') { t.style.display = 'inline-flex'; t.style.alignItems = 'center'; }
      else if (cs.display === 'inline-block' || cs.display === 'block') { if (t.tagName !== 'INPUT' && t.tagName !== 'SELECT' && t.tagName !== 'TEXTAREA') { t.style.display = cs.display === 'block' ? 'flex' : 'inline-flex'; t.style.alignItems = 'center'; if (cs.textAlign === 'center') t.style.justifyContent = 'center'; } }
      if (r.height < 43.5) t.style.minHeight = '44px';
      if (r.width < 43.5) { t.style.minWidth = '44px'; if (!boxed && !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.style.justifyContent = 'center'; }
    }
  }
  function fitText(root) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    const done = new Set();
    while ((n = walk.nextNode())) {
      const e = n.parentElement;
      if (!e || done.has(e) || !n.textContent.trim()) continue;
      done.add(e);
      if (e.closest(SKIP) || e.closest('.topbar, .tabbar, .previewstrip, script, style')) continue;
      const f = parseFloat(getComputedStyle(e).fontSize);
      if (f > 0.5 && f < 13.6) e.style.fontSize = '14px';
    }
  }
  let queued = false;
  function fit() {
    queued = false;
    if (!PHONE.matches) return;
    try {
      /* The map's dots are too small for a finger. On a phone a tap on the map picks the nearest
         lot and the lots are listed under it, so the dots stop being buttons of their own. */
      for (const d of document.querySelectorAll('.lg-map [role=button]')) { d.removeAttribute('role'); d.setAttribute('tabindex', '-1'); d.setAttribute('aria-hidden', 'true'); }
      fitText(document.body); fitTaps(document.body);
    } catch (e) {}
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(fit); } };
  new MutationObserver(ask).observe(document.body, { childList: true, subtree: true });
  PHONE.addEventListener?.('change', ask);
  window.addEventListener('load', ask);
  window.phoneSizesFit = fit;
  ask();
}
