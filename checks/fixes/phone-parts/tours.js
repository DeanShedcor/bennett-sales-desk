// node tours.js <url> [phone|desk] : walk all nine Firefly tours and flag every step with a problem.
// Exports run(url, kind) -> { total, bad: [..], finished: n }
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
async function run(url, kind, shotDir) {
  const b = await chromium.launch({ args: ARGS });
  const p = await (await b.newContext(kind === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1360, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(2200);
  const ev = (f, a) => p.evaluate(f, a), w = (ms) => p.waitForTimeout(ms);
  await ev(() => { ffSetOn(true); }); await w(500);
  const ids = await ev(() => FF_TOURS.map((t) => t.id));
  const bad = []; let total = 0, finished = 0;
  for (const id of ids) {
    await ev((id) => { adView('u1'); ffTourStart(id); }, id); await w(900);
    const n = await ev((id) => ffTour(id).steps.length, id);
    for (let i = 0; i < n; i++) {
      await w(1500); total++;
      const st = await ev(() => {
        const t = ffTour(FF.tour); if (!t) return null;
        const s = t.steps[FF.step], el = (() => { try { return ffEl(s.sel); } catch (e) { return null; } })();
        const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
        const card = document.getElementById('ff-card'), c = R(card), e = R(el), go = R(card && card.querySelector('.ff-go')), stop = R(card && card.querySelector('.ff-ghost'));
        const inView = (r) => r && r.t >= 0 && r.b <= innerHeight && r.l >= 0 && r.r <= innerWidth;
        const bar = !!(el && el.closest('.topbar, .tabbar, .previewstrip')), seen = e ? Math.max(0, Math.min(e.b, innerHeight) - Math.max(e.t, bar ? 0 : 60)) : 0, h = e ? e.b - e.t : 0;
        let tappable = null;
        if (s.until && el && e) { const x = (e.l + e.r) / 2, y = (e.t + e.b) / 2; const hit = y > 0 && y < innerHeight ? document.elementsFromPoint(x, y).filter((q) => !q.closest('#ff-root'))[0] : null; tappable = !!hit && (el.contains(hit) || hit.contains(el)); }
        return { i: FF.step, title: s.title, has: !!el, until: !!s.until, card: c, el: e, cardIn: inView(c), goIn: go ? inView(go) : null, stopIn: stop ? inView(stop) : null, seenOk: !e || seen >= Math.min(h, 100), topOk: !e || bar || h > innerHeight - 300 || (e.t >= 56 && e.t < innerHeight - 40), tappable };
      });
      if (!st) { bad.push(`${id} ended early at step ${i + 1}`); break; }
      const flags = [!st.has && 'no control to point at', !st.cardIn && 'card not fully on screen ' + JSON.stringify(st.card), st.goIn === false && 'Next button off screen', st.stopIn === false && 'Stop button off screen', st.has && !st.seenOk && 'control not on screen ' + JSON.stringify(st.el), st.has && !st.topOk && 'control cut off at the top ' + JSON.stringify(st.el), st.tappable === false && 'control cannot be tapped where it is'].filter(Boolean);
      if (flags.length) { bad.push(`${kind} ${id} #${st.i + 1} "${st.title}": ${flags.join('; ')}`); if (shotDir) await p.screenshot({ path: `${shotDir}/tour-${kind}-${id}-${st.i + 1}.png` }); }
      if (st.until && st.has && st.tappable) { const r = st.el; if (kind === 'phone') await p.touchscreen.tap((r.l + r.r) / 2, (r.t + r.b) / 2); else await p.mouse.click((r.l + r.r) / 2, (r.t + r.b) / 2); await w(900); if (await ev((i) => FF.step === i, st.i)) { bad.push(`${kind} ${id} #${st.i + 1} "${st.title}": pressing the control did not move the tour on`); await ev(() => ffStep(FF.step + 1)); } }
      else if (st.until) { await ev(() => { const s = ffTour(FF.tour).steps[FF.step]; const e = ffEl(s.sel); if (e) e.click(); }); await w(700); if (await ev((i) => FF.step === i, st.i)) await ev(() => ffStep(FF.step + 1)); }
      else if (st.goIn) { if (kind === 'phone') await p.tap('#ff-card .ff-go'); else await p.click('#ff-card .ff-go'); }
      else await ev(() => ffStep(FF.step + 1));
    }
    await w(600);
    if (await ev((id) => !FF.tour && FF.done[id] === true, id)) finished++; else bad.push(`${kind} ${id} did not finish`);
    await ev(() => { ffTourEnd(false); ffClose(); closeModal(); });
  }
  await b.close();
  return { total, bad, finished, tours: ids.length, errs };
}
module.exports = { run };
if (require.main === module) (async () => {
  for (const kind of process.argv[3] ? [process.argv[3]] : ['phone', 'desk']) {
    const r = await run(process.argv[2], kind, process.cwd() + '/look');
    console.log(`${kind}: ${r.total} steps, ${r.bad.length} problems, ${r.finished} of ${r.tours} tours finished, errors ${r.errs.length}`);
    r.bad.forEach((x) => console.log('  ' + x.slice(0, 260)));
  }
})();
