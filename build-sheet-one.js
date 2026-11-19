/* build-sheet-one.js: one build sheet with every measurement on it, and a separate electrical sheet.

   The owner showed a builder the old sheet 2 of 2 (walls drawn flat as grey strips, away from the
   plan) and it confused him. He wants the measurements for everything on ONE sheet. So:

   1. BUILD SHEET (one landscape page). A big floor plan seen from above. Beside every wall runs a
      tape line: hook the tape at START and each number is how far along the wall that edge is.
      Each door and window is named in words where it sits, with its size (wide x tall). Inside
      pieces (workbench, shelving, lofts, inside walls) carry their size and where they start.
      No item numbers to look up, no list on another page, no electrical, no prices.
      A wall with no room for its numbers (the angled wall of a Deluxe Porch, a short wall with a
      lot on it) gets a lettered close-up under the plan, on the same drawing.
   2. ELECTRICAL SHEET (its own page, only when the building has electrical). The same plan in
      light grey with only the electrical drawn in black, a count of what to install, and a short
      list of how far each box is from the START corner of its wall.

   Measurements are written the carpenter's short way: 11' 6", 12', 6" (owner, Nov 2026).

   Existing functions hooked: bsPages() is replaced (the old two pages stay reachable as
   bsPagesOld). Everything is read from bsLayout(), so the floor plan editor, the porch railing,
   the inside options and the notes that other files add all keep working. bsRender() still fits
   each .bs-page to one printed sheet. Nothing here changes a price or an order.
   The sign-off line and the named loft drawn on the plan are new: features the product still has
   to accept. Loaded last. */
{
  const INK = '#111', SOFT = '#9aa3ab';
  const f = (v) => v.toFixed(1);

  /* 11.5 -> 11' 6"   20 -> 20'   0.25 -> 3"   (to the nearest eighth of an inch) */
  function b1Feet(v) {
    let e = Math.round(v * 96);
    const ft = Math.floor(e / 96);
    e -= ft * 96;
    const inch = Math.floor(e / 8), fr = BS_FR[e % 8];
    if (!inch && !fr) return `${ft}'`;
    return `${ft ? ft + "' " : ''}${inch || ''}${fr}"`;
  }
  window.b1Feet = b1Feet;
  const low = (t) => String(t).toLowerCase();
  const hookWords = (w) => 'the ' + low(w.hook).replace(/^corner of the /, 'corner by the ');
  const isElec = (it) => it.kind === 'outlet' || it.kind === 'switch' || it.kind === 'light';
  const ELEC_NOTE = /outlet|switch|light\b|lights\b|pigtail|breaker|electrical|drop-cord|plug|conduit|\bamp\b|fan\b|receptacle/i;
  const PACK = { 'Lights Only': ['Drop-cord hookup (pigtail)'], Minimal: ['Drop-cord hookup (pigtail)'], Basic: ['Drop-cord hookup (pigtail)'], Expanded: ['Drop-cord hookup (pigtail)'], Utility: ['Breaker box, 6 spaces'] };
  const sizeInName = (t) => String(t).replace(/(\d+)\s*[x×]\s*(\d+)(\s*ft)?/, "$1' x $2'");

  /* What a door, window or box is called on the drawing: [what it is, its size]. */
  function nameParts(it) {
    if (it.kind === 'outlet') return ['Plug', ''];
    if (it.kind === 'switch') return ['Switch', ''];
    const wide = b1Feet(it.w), m = it.name.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (it.kind === 'fix') return [/garage/i.test(it.name) ? 'Garage door' : 'Opening', `${wide} wide`];
    if (it.kind === 'window') return it.high ? ['Transom', `${wide}, up high`] : ['Window', m ? `${wide} x ${m[2]}'` : `${wide} wide`];
    const kind = /roll/i.test(it.name) ? 'Roll-up door' : /double|barn/i.test(it.name) ? 'Double door' : 'Door';
    return [kind, m ? `${wide} x ${m[2]}'` : `${wide} wide`];
  }
  /* Openings cut into a wall: doors, windows, transoms, framed openings. */
  const openingsOn = (lay, w) => lay.items
    .filter((x) => (x.wi === w.i && x.w && !isElec(x)) || (x.kind === 'fix' && x.fix === 'frame' && x.fw === w.i && x.placed))
    .map((x) => ({ ...x, w: x.w || x.len }))
    .sort((a, b) => a.at - b.at);
  const boxesOn = (lay, w) => lay.items.filter((x) => x.wi === w.i && (x.kind === 'outlet' || x.kind === 'switch')).sort((a, b) => a.at - b.at);

  function wallSide(sh, w) {
    const g = bsWallGeo(sh, w), out = [-g.n[0], -g.n[1]], ax = Math.abs(out[0]), ay = Math.abs(out[1]);
    return { g, angled: Math.min(ax, ay) > 0.2, side: ax > ay ? (out[0] < 0 ? 'left' : 'right') : out[1] < 0 ? 'top' : 'bottom' };
  }

  /* A loft picked by name ("4 ft Back", "U-Shaped Loft"). Lofts sit at the two ends of the roof
     ridge, which run left and right on the drawing. Each piece is [x from, x to, y from, y to]. */
  function namedLofts(lay) {
    const c = lay.c, sh = lay.sh, name = String(c.loft || ''), x0 = sh.minX, ends = sh.sides.left === 'FRONT' ? ['front', 'back'] : ['left end', 'right end'];
    const m = name.match(/^(\d+) ft (Front & Back|Front|Back)$/), out = [];
    const y0 = Math.min(...sh.poly.map((q) => q[1])), y1 = Math.max(...sh.poly.map((q) => q[1]));
    if (m) {
      const d = +m[1];
      if (/Front/.test(m[2])) out.push({ box: [x0, x0 + d, y0, y1], d, text: `${d}' deep, across the ${ends[0]}` });
      if (/Back/.test(m[2])) out.push({ box: [sh.L - d, sh.L, y0, y1], d, text: `${d}' deep, across the ${ends[1]}` });
    } else if (/^U-Shaped/i.test(name)) {
      /* The order gives no sizes for this one: 4 ft across the far end, a 2 ft arm down each side. */
      out.push({ box: [sh.L - 4, sh.L, y0, y1], d: 4, u: true, text: `4' deep across the ${ends[1]}, 2' down each side` });
      out.push({ box: [x0, sh.L - 4, y0, y0 + 2], arm: true }, { box: [x0, sh.L - 4, y1 - 2, y1], arm: true });
    }
    return out;
  }

  /* ---------- The plan: mode 'build' or 'elec' ---------- */
  function b1Plan(lay, mode) {
    let rows = { top: 1, bottom: 1, ins: 0 }, out, same = false;
    const eq = (a, b) => a.top === b.top && a.bottom === b.bottom && a.ins === b.ins;
    for (let pass = 0; pass < 5 && !same; pass++) {
      out = draw(lay, mode, rows);
      same = eq(out.need, rows);
      if (!same) rows = pass < 3 ? out.need : { top: Math.max(rows.top, out.need.top), bottom: Math.max(rows.bottom, out.need.bottom), ins: Math.max(rows.ins, out.need.ins) };
    }
    return same ? out.svg : draw(lay, mode, rows).svg;
  }
  function draw(lay, mode, rows) {
    const { sh, items, c } = lay, { L, W } = sh, build = mode === 'build';
    const VW = 768, GAP = 30, ROW = 14, mSide = 116, INS = 88;
    const mT = rows.top ? GAP + 10 + rows.top * ROW + 24 : 66, mB = (rows.bottom ? GAP + 19 + rows.bottom * ROW + 16 : 18) + (rows.ins ? 10 : 0), KEY = 26;
    const Sc = Math.min((VW - 2 * mSide) / L, ((build ? 566 : 470) - mT - mB - KEY - (rows.ins ? INS : 0)) / W, 40);
    const bw = L * Sc, bh = W * Sc, X0 = (VW - bw) / 2, Y0 = mT, VH = mT + bh + mB + (rows.ins ? INS : 0) + KEY;
    const P = ([x, y]) => [X0 + x * Sc, Y0 + y * Sc];
    const pts = (l) => l.map((q) => P(q).map(f).join(',')).join(' ');
    const wallInk = build ? INK : SOFT;
    const numW = (t) => t.length * 6.7 + 4, nameW = (t) => t.length * 5.7 + 4;
    const o = [`<svg viewBox="0 0 ${VW} ${f(VH)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${build ? 'The building from above, with every measurement' : 'Where the electrical goes'}">`];
    const txt = (x, y, t, a = 'middle', size = 10.5, weight = 500, fill = INK) => `<text x="${f(x)}" y="${f(y)}" text-anchor="${a}" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(t)}</text>`;
    o.push(`<defs><pattern id="b1deck${mode}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6H6" stroke="#b5b5b5" stroke-width="0.7"/></pattern><pattern id="b1loft${mode}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="${INK}" stroke-width="1"/></pattern><clipPath id="b1in${mode}"><polygon points="${pts(sh.poly)}"/></clipPath></defs>`);

    /* porch floor, building floor, walls */
    if (sh.deck) o.push(`<polygon points="${pts(sh.deck)}" fill="url(#b1deck${mode})" stroke="${wallInk}" stroke-width="1" stroke-dasharray="4 3"/>`);
    o.push(`<polygon points="${pts(sh.poly)}" fill="#fff"/>${bsGrid(sh, P, 'b1grid' + mode, '#dfe4e8', 0.6)}`);

    /* lofts and inside options (build sheet only), under the walls */
    if (build) {
      for (const lf of namedLofts(lay)) {
        const [xa, xb, ya, yb] = lf.box, box = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]];
        o.push(`<polygon points="${pts(box)}" clip-path="url(#b1in${mode})" fill="url(#b1loft${mode})" fill-opacity="0.35" stroke="${INK}" stroke-width="1.2" stroke-dasharray="6 4"/>`);
        if (lf.arm) continue;
        const [cx, cy] = P([(xa + xb) / 2, (ya + yb) / 2]);
        o.push(`<g class="b1-loft" transform="rotate(-90 ${f(cx)} ${f(cy)})">${txt(cx, cy - 2, lf.u ? 'U-SHAPED LOFT (overhead)' : 'LOFT (overhead)', 'middle', 10.5, 800)}${txt(cx, cy + 10.5, lf.text, 'middle', 9.6, 600)}</g>`);
      }
      for (const it of items) {
        if (it.kind !== 'fix' || it.fix === 'frame') continue;
        const w = sh.walls[it.fw], g = bsWallGeo(sh, w), a = g.at(it.at), b = g.at(it.at + it.len), n = g.n, d = it.depth;
        const box = [a, b, [b[0] + n[0] * d, b[1] + n[1] * d], [a[0] + n[0] * d, a[1] + n[1] * d]];
        const xs = box.map((q) => P(q)[0]), ys = box.map((q) => P(q)[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const red = !it.placed, line = red ? '#b3362e' : INK, over = it.fix === 'loft' || it.fix === 'uloft';
        const name = it.name.split(' · ')[0].toUpperCase();
        if (it.fix === 'wall') o.push(`<line x1="${f(P(a)[0])}" y1="${f(P(a)[1])}" x2="${f(P(box[3])[0])}" y2="${f(P(box[3])[1])}" stroke="${line}" stroke-width="4" ${red ? 'stroke-dasharray="6 4"' : ''}/>`);
        else o.push(`<polygon points="${pts(box)}" fill="${over ? `url(#b1loft${mode})` : '#ececec'}" fill-opacity="${over ? 0.35 : 1}" stroke="${line}" stroke-width="1.3" ${red || over ? 'stroke-dasharray="6 4"' : ''}/>`);
        const head = red ? `${name}: NOT PLACED YET` : it.fix === 'run' ? `${name} ${b1Feet(it.len)} long, ${b1Feet(d)} deep` : over ? `${name} (overhead) ${b1Feet(d)} deep` : `${name} ${b1Feet(d)} long`;
        const sub = red || over ? '' : it.at < 0.02 ? `starts at ${hookWords(w)}` : `starts ${b1Feet(it.at)} from ${hookWords(w)}`;
        /* Words run along the wall the piece is on. Lines that do not fit inside go just past it, toward the middle of the room. */
        const along = Math.abs(g.d[0]) > 0.7, room = (along ? Math.max(...xs) - Math.min(...xs) : Math.max(...ys) - Math.min(...ys)), thick = (along ? Math.max(...ys) - Math.min(...ys) : Math.max(...xs) - Math.min(...xs));
        const inward = along ? Math.sign(n[1]) || 1 : Math.sign(n[0]) || 1;
        const lines = [[head, 9.8, 800, line, head.length * 5.9], ...(sub ? [[sub, 9, 600, INK, sub.length * 5]] : [])];
        const fitIn = lines.filter((l) => l[4] <= room + 2), inside = it.fix === 'wall' ? 0 : thick >= 27 ? fitIn.length === lines.length ? lines.length : (lines[0][4] <= room + 2 ? 1 : 0) : thick >= 14 && lines[0][4] <= room + 2 ? 1 : 0;
        let body = '';
        lines.forEach((l, i) => {
          let off; /* how far from the piece's middle, across the wall */
          if (i < inside) off = inside === 2 ? (i ? 9.5 : -2.5) : 3.5;
          else { const k = i - inside; off = inward > 0 ? thick / 2 + 11 + k * 11.5 : -(thick / 2 + 4 + (lines.length - inside - 1 - k) * 11.5); }
          /* words that are wider than the piece stay inside the building */
          const half = l[4] / 2 + 5, mid = along ? cx : cy, lo2 = along ? Math.min(...sh.poly.map((q) => P(q)[0])) : Math.min(...sh.poly.map((q) => P(q)[1])), hi2 = along ? Math.max(...sh.poly.map((q) => P(q)[0])) : Math.max(...sh.poly.map((q) => P(q)[1]));
          const slide = Math.max(lo2 + half, Math.min(hi2 - half, mid)) - mid;
          body += txt(cx + (along ? slide : -slide), cy + off, l[0], 'middle', l[1], l[2], l[3]);
        });
        o.push(`<g class="fp-piece" data-key="${it.key}">${along ? body : `<g transform="rotate(-90 ${f(cx)} ${f(cy)})">${body}</g>`}</g>`);
      }
    }
    o.push(`<polygon points="${pts(sh.poly)}" fill="none" stroke="${wallInk}" stroke-width="${build ? 5 : 4}" stroke-linejoin="miter"/>`);
    for (const q of sh.posts) {
      const [x, y] = P(q);
      o.push(`<rect x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8" fill="${wallInk}"/>`);
    }
    if (typeof porchRailsSvg === 'function') o.push(porchRailsSvg(sh, P, 1, wallInk));

    /* openings on the walls, and what the tape shows for each wall */
    const sides = { top: [], bottom: [], left: [], right: [] }, closeUps = [], bare = [];
    const toInset = (s) => ((s.marks.length > 2 ? closeUps : bare).push(s));
    for (const w of sh.walls) {
      const { g, side, angled } = wallSide(sh, w), ops = openingsOn(lay, w), boxes = boxesOn(lay, w);
      for (const it of ops) {
        const a = P(g.at(it.at)), b = P(g.at(it.at + it.w)), ink = build ? INK : SOFT;
        const seg = (color, width, dash = '') => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        if (it.high) {
          const s = (q) => [q[0] - g.n[0] * 7, q[1] - g.n[1] * 7];
          o.push(`<line x1="${f(s(a)[0])}" y1="${f(s(a)[1])}" x2="${f(s(b)[0])}" y2="${f(s(b)[1])}" stroke="${ink}" stroke-width="3.5"/>`);
        } else if (it.kind === 'window') o.push(seg('#fff', 7) + seg(ink, 5.5) + seg('#fff', 2.4));
        else o.push(seg('#fff', 7) + seg(ink, 1.3, it.kind === 'fix' ? '5 3' : '3 2'));
      }
      if (!build)
        for (const it of boxes) {
          const q = P(g.at(it.at)), x = q[0] + g.n[0] * 13, y = q[1] + g.n[1] * 13;
          o.push(it.kind === 'outlet'
            ? `<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M${f(x - 2.3)} ${f(y - 3.4)}v6.8M${f(x + 2.3)} ${f(y - 3.4)}v6.8" stroke="${INK}" stroke-width="1.6"/>`
            : `<rect x="${f(x - 7)}" y="${f(y - 7)}" width="14" height="14" fill="#fff" stroke="${INK}" stroke-width="1.8"/><text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-size="11" font-weight="800">S</text>`);
        }
      const marks = [{ t: 0, text: 'START', start: true }], names = [];
      if (build) {
        for (const it of ops) {
          for (const t of [it.at, it.at + it.w]) if (!marks.some((m) => Math.abs(m.t - t) < 0.011)) marks.push({ t, text: b1Feet(t) });
          names.push({ t: it.at + it.w / 2, parts: nameParts(it), it });
        }
      } else {
        if (!boxes.length) continue;
        for (const it of boxes) { marks.push({ t: it.at, text: b1Feet(it.at) }); names.push({ t: it.at, parts: nameParts(it), it }); }
      }
      const end = marks.find((m) => Math.abs(m.t - w.len) < 0.011);
      if (end) end.text = `${b1Feet(w.len)} END`;
      else marks.push({ t: w.len, text: `${b1Feet(w.len)} END` });
      names.forEach((n) => (n.text = n.parts.filter(Boolean).join(' ')));
      const A = P(w.a), B = P(w.b), horiz = side === 'top' || side === 'bottom', s = { w, g, marks, names, ops, boxes };
      if (angled) { toInset(s); continue; }
      /* a short wall with a lot on it has no room for its numbers: it gets a close-up */
      if (horiz) {
        const px = Math.abs(B[0] - A[0]), rowEnd = [];
        for (const m of [...marks].sort((a, b) => a.t - b.t)) {
          const left = (m.t / w.len) * px - numW(m.text) / 2;
          let r = rowEnd.findIndex((e) => left > e + 5);
          if (r < 0) r = rowEnd.length;
          rowEnd[r] = left + numW(m.text);
        }
        if (rowEnd.length > 2 || names.reduce((t, n) => t + nameW(n.text) + 6, 0) > px + 60) { toInset(s); continue; }
      }
      if (!horiz && (marks.length + names.length * 2) * 13 > Math.abs(B[1] - A[1]) + 64) { toInset(s); continue; }
      s.lo = horiz ? Math.min(A[0], B[0]) : Math.min(A[1], B[1]);
      s.hi = horiz ? Math.max(A[0], B[0]) : Math.max(A[1], B[1]);
      s.depth = side === 'top' ? A[1] - Y0 : side === 'bottom' ? Y0 + bh - A[1] : side === 'left' ? A[0] - X0 : X0 + bw - A[0];
      sides[side].push(s);
    }
    const need = { top: 0, bottom: 0, ins: 0 };
    for (const side of ['top', 'bottom', 'left', 'right']) {
      /* Two walls facing the same way cannot share one stretch of tape: the outer wall keeps it. */
      const kept = [];
      for (const s of sides[side].sort((a, b) => a.depth - b.depth)) {
        if (kept.some((k) => s.lo < k.hi - 2 && s.hi > k.lo + 2)) toInset(s);
        else kept.push(s);
      }
      const horiz = side === 'top' || side === 'bottom', dir = side === 'top' || side === 'left' ? -1 : 1;
      const edge = side === 'top' ? Y0 : side === 'bottom' ? Y0 + bh : side === 'left' ? X0 : X0 + bw, tape = edge + dir * GAP;
      const labels = [], nameList = [], titles = [];
      for (const s of kept) {
        const at = (t) => P(s.g.at(t)), a = at(0), b = at(s.w.len);
        o.push(horiz ? `<line x1="${f(a[0])}" y1="${f(tape)}" x2="${f(b[0])}" y2="${f(tape)}" stroke="${INK}" stroke-width="1.4"/>` : `<line x1="${f(tape)}" y1="${f(a[1])}" x2="${f(tape)}" y2="${f(b[1])}" stroke="${INK}" stroke-width="1.4"/>`);
        const sgn = horiz ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
        o.push(horiz ? `<path d="M${f(a[0])} ${f(tape - 6)}L${f(a[0] + sgn * 10)} ${f(tape)}L${f(a[0])} ${f(tape + 6)}Z" fill="${INK}"/>` : `<path d="M${f(tape - 6)} ${f(a[1])}L${f(tape)} ${f(a[1] + sgn * 10)}L${f(tape + 6)} ${f(a[1])}Z" fill="${INK}"/>`);
        for (const m of s.marks) {
          const q = at(m.t), far = horiz ? Math.abs(q[1] - edge) : Math.abs(q[0] - edge);
          /* a dotted line carries the mark from an inner wall out to the tape */
          if (far > 3 || !build) o.push(horiz ? `<line x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(q[0])}" y2="${f(tape)}" stroke="#777" stroke-width="0.8" stroke-dasharray="2 3"/>` : `<line x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(tape)}" y2="${f(q[1])}" stroke="#777" stroke-width="0.8" stroke-dasharray="2 3"/>`);
          if (!m.start) o.push(horiz ? `<line x1="${f(q[0])}" y1="${f(tape - 5)}" x2="${f(q[0])}" y2="${f(tape + 5)}" stroke="${INK}" stroke-width="1.4"/>` : `<line x1="${f(tape - 5)}" y1="${f(q[1])}" x2="${f(tape + 5)}" y2="${f(q[1])}" stroke="${INK}" stroke-width="1.4"/>`);
          labels.push({ p: horiz ? q[0] : q[1], text: m.text });
        }
        for (const n of s.names) {
          const q = at(n.t);
          if (horiz) nameList.push({ p: q[0], text: n.text });
          else if (n.parts[1]) nameList.push({ p: q[1] - 6.5, text: n.parts[0] }, { p: q[1] + 6.5, text: n.parts[1] });
          else nameList.push({ p: q[1], text: n.parts[0], box: true });
        }
        /* the wall's name and length */
        const title = s.w.name.toUpperCase(), long = `${b1Feet(s.w.len)} long`;
        if (horiz) {
          const y = side === 'top' ? tape - 10 - rows.top * ROW - 7 : tape + 19 + rows.bottom * ROW + 9;
          /* a short wall keeps its name; its length is the END number on the tape */
          const full = title.length * 9.5 + long.length * 6 + 16, tight = full > Math.abs(b[0] - a[0]) + 90;
          const size = tight ? title.length * 9.5 : full;
          titles.push({ y, title, long: tight ? '' : long, size, want: (a[0] + b[0]) / 2 - size / 2 });
        } else {
          const x = side === 'left' ? X0 - 34 : X0 + bw + 34, top = Math.min(a[1], b[1]), anchor = side === 'left' ? 'end' : 'start', lines = [];
          for (const word of title.split(' ')) {
            if (lines.length && (lines[lines.length - 1] + ' ' + word).length <= 11) lines[lines.length - 1] += ' ' + word;
            else lines.push(word);
          }
          lines.forEach((t, i) => o.push(`<text x="${f(x)}" y="${f(top - 18 - 13.5 * (lines.length - i))}" text-anchor="${anchor}" font-size="11.5" font-weight="800" letter-spacing=".3">${esc(t)}</text>`));
          o.push(`<text x="${f(x)}" y="${f(top - 18)}" text-anchor="${anchor}" font-size="11.5" font-weight="600">${long}</text>`);
        }
      }
      if (horiz) {
        if (titles.length) bsSlot(titles, 4, VW - 4, 16);
        for (const t of titles) o.push(`<text x="${f(t.pos + t.size / 2)}" y="${f(t.y)}" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="1">${esc(t.title)}${t.long ? ` <tspan font-weight="600" letter-spacing="0" font-size="11.5">· ${t.long}</tspan>` : ''}</text>`);
        /* names sit between the wall and the tape; numbers go outside the tape, in rows when they crowd */
        nameList.forEach((n) => ((n.size = nameW(n.text)), (n.want = n.p - n.size / 2)));
        bsSlot(nameList, 4, VW - 4, 6);
        for (const n of nameList) o.push(txt(n.pos + n.size / 2, side === 'top' ? edge - 10 : edge + 19, n.text, 'middle', 10.5, 600));
        const rowEnd = [];
        for (const l of labels.sort((a, b) => a.p - b.p)) {
          const tw = numW(l.text), left = Math.max(2, Math.min(VW - tw - 2, l.p - tw / 2));
          let r = rowEnd.findIndex((e) => left > e + 5);
          if (r < 0) r = rowEnd.length;
          rowEnd[r] = left + tw;
          const y = side === 'top' ? tape - 10 - r * ROW : tape + 19 + r * ROW;
          if (r > 0) o.push(`<line x1="${f(l.p)}" y1="${f(tape)}" x2="${f(l.p)}" y2="${f(side === 'top' ? y + 2 : y - 10)}" stroke="${INK}" stroke-width="0.7"/>`);
          o.push(txt(left + tw / 2, y, l.text, 'middle', 12, 800));
        }
        need[side] = kept.length ? Math.max(1, rowEnd.length) : 0;
      } else {
        /* one column beside the tape: numbers and names in the order you meet them */
        const col = [...labels, ...nameList.map((n) => ({ ...n, name: true }))].sort((a, b) => a.p - b.p || (a.name ? 1 : -1));
        col.forEach((l) => ((l.size = 12), (l.want = l.p - 6)));
        if (col.length) bsSlot(col, Y0 - 12, Y0 + bh + 14, 1);
        const x = tape + dir * 9, anchor = side === 'left' ? 'end' : 'start';
        for (const l of col) {
          if (!l.name && Math.abs(l.pos + 6 - l.p) > 2) o.push(`<line x1="${f(tape)}" y1="${f(l.p)}" x2="${f(tape + dir * 7)}" y2="${f(l.pos + 6)}" stroke="${INK}" stroke-width="0.7"/>`);
          o.push(txt(x, l.pos + 10, l.text, anchor, l.name ? 10.5 : 12, l.name ? 600 : 800));
        }
      }
    }
    const pole = sh.deck && bsPole(sh);
    if (pole) {
      const [x, y] = P(pole), deep = c.package === 'End Porch' ? sh.minX : 4;
      o.push(txt(x, y - 1, 'PORCH', 'middle', 10, 800, build ? INK : '#6b747c'));
      if (build && Sc * deep > 62) o.push(txt(x, y + 10.5, `${deep}' deep`, 'middle', 9.6, 600));
    }

    /* a wall with nothing on it and no tape still shows how long it is */
    if (build)
      for (const s of bare) {
        const q = P(s.g.at(s.w.len / 2));
        o.push(txt(q[0] - s.g.n[0] * 12, q[1] - s.g.n[1] * 12 + 4, b1Feet(s.w.len), 'middle', 10.5, 800));
      }
    /* close-ups: the walls that had no room for their numbers, each drawn flat under the plan */
    need.ins = closeUps.length ? 1 : 0;
    if (closeUps.length && rows.ins) {
      const top = Y0 + bh + mB + 2, gap = 26;
      closeUps.forEach((s, i) => {
        s.tag = 'ABCDEFGH'[i];
        s.title = `${s.w.name.toUpperCase()} close-up`;
        s.wide = Math.max(150, s.marks.reduce((t, m) => t + numW(m.text) + 12, 0), s.names.reduce((t, n) => t + nameW(n.text) + 8, 0), 30 + s.title.length * 6.6);
      });
      const total = closeUps.reduce((t, s) => t + s.wide, 0) + gap * (closeUps.length - 1), squeeze = Math.min(1, (VW - 24) / total);
      let x = Math.max(12, (VW - total * squeeze) / 2);
      o.push(`<line x1="8" y1="${f(top - 6)}" x2="${VW - 8}" y2="${f(top - 6)}" stroke="#bbb" stroke-width="0.8"/>`);
      for (const s of closeUps) {
        const wd = s.wide * squeeze, X = (t) => x + (t / s.w.len) * wd, bar = top + 40, tp = top + 54;
        /* the letter on the plan, on the wall */
        const q = P(s.g.at(s.w.len / 2)), tx = q[0] - s.g.n[0] * 13, ty = q[1] - s.g.n[1] * 13;
        o.push(`<rect x="${f(tx - 8)}" y="${f(ty - 8)}" width="16" height="16" fill="${INK}"/><text x="${f(tx)}" y="${f(ty + 4.2)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">${s.tag}</text>`);
        o.push(`<rect x="${f(x)}" y="${f(top + 1)}" width="16" height="16" fill="${INK}"/><text x="${f(x + 8)}" y="${f(top + 13.2)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">${s.tag}</text><text x="${f(x + 22)}" y="${f(top + 13.5)}" font-size="11.5" font-weight="800" letter-spacing=".6">${esc(s.title)}</text>`);
        o.push(`<line x1="${f(x)}" y1="${bar}" x2="${f(x + wd)}" y2="${bar}" stroke="${wallInk}" stroke-width="5"/>`);
        for (const it of s.ops) {
          const a = X(it.at), b = X(it.at + it.w), ink = build ? INK : SOFT, seg = (color, width, dash = '') => `<line x1="${f(a)}" y1="${bar}" x2="${f(b)}" y2="${bar}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
          o.push(it.kind === 'window' ? seg('#fff', 7) + seg(ink, 5.5) + seg('#fff', 2.4) : seg('#fff', 7) + seg(ink, 1.3, '3 2'));
        }
        const nl = s.names.map((n) => ({ text: n.text, size: nameW(n.text), want: X(n.t) - nameW(n.text) / 2 }));
        if (nl.length) bsSlot(nl, x - 8, x + wd + 8, 5);
        for (const n of nl) o.push(txt(n.pos + n.size / 2, bar - 9, n.text, 'middle', 10.5, 600));
        o.push(`<line x1="${f(x)}" y1="${tp}" x2="${f(x + wd)}" y2="${tp}" stroke="${INK}" stroke-width="1.4"/><path d="M${f(x)} ${tp - 6}L${f(x + 10)} ${tp}L${f(x)} ${tp + 6}Z" fill="${INK}"/>`);
        const rowEnd = [];
        for (const m of [...s.marks].sort((a, b) => a.t - b.t)) {
          const px = X(m.t), tw = numW(m.text), left = px - tw / 2;
          if (!m.start) o.push(`<line x1="${f(px)}" y1="${tp - 5}" x2="${f(px)}" y2="${tp + 5}" stroke="${INK}" stroke-width="1.4"/>`);
          let r = rowEnd.findIndex((e) => left > e + 4);
          if (r < 0) r = rowEnd.length;
          rowEnd[r] = left + tw;
          if (r > 0) o.push(`<line x1="${f(px)}" y1="${tp}" x2="${f(px)}" y2="${tp + 8 + r * 12.5}" stroke="${INK}" stroke-width="0.7"/>`);
          o.push(txt(px, tp + 18 + r * 12.5, m.text, 'middle', 12, 800));
        }
        x += wd + gap * squeeze;
      }
    }

    /* ceiling lights (electrical sheet) */
    if (!build) {
      const lights = items.filter((x) => x.kind === 'light').sort((a, b) => a.x - b.x);
      const tags = lights.map((it, i) => {
        const [x, y] = P([it.x, it.y]), text = `${b1Feet(it.x - sh.minX)} from the ${bsSideWall(sh.sides.left)}`;
        return { it, x, y, i, text, size: Math.max(text.length * 5.4, 60) + 6, want: 0, up: bsInside(sh.poly, [it.x, it.y - 46 / Sc]) && (i % 2 === 0 || !bsInside(sh.poly, [it.x, it.y + 42 / Sc])) };
      });
      for (const up of [true, false]) {
        const row = tags.filter((t) => t.up === up);
        row.forEach((t) => (t.want = t.x - t.size / 2));
        if (row.length) bsSlot(row, X0 + 4, X0 + bw - 4, 6);
      }
      for (const t of tags) {
        const cx = t.pos + t.size / 2, ty = t.up ? t.y - 31 : t.y + 27;
        o.push(`<line x1="${f(t.x)}" y1="${f(t.y)}" x2="${f(cx)}" y2="${f(t.up ? ty + 15 : ty - 11)}" stroke="${INK}" stroke-width="0.8"/>`);
        o.push(`<circle cx="${f(t.x)}" cy="${f(t.y)}" r="9" fill="#fff" stroke="${INK}" stroke-width="1.8"/>${bsBulb(t.x, t.y - 1.6, 0.7, INK)}`);
        o.push(txt(cx, ty, lights.length > 1 ? `LIGHT ${t.i + 1}` : 'LIGHT', 'middle', 10.5, 800) + txt(cx, ty + 11.5, t.text, 'middle', 9.8, 600));
      }
    }

    /* how to read it */
    const ky = VH - 19;
    let kx = 6;
    const key = (art, words, wide) => { o.push(art(kx) + `<text x="${f(kx + wide + 5)}" y="${f(ky + 12.5)}" font-size="10">${esc(words)}</text>`); kx += wide + 5 + words.length * 5.1 + 14; };
    if (build) {
      key((x) => `<path d="M${x} ${ky + 3}L${x + 10} ${ky + 9}L${x} ${ky + 15}Z" fill="${INK}"/><line x1="${x + 10}" y1="${ky + 9}" x2="${x + 30}" y2="${ky + 9}" stroke="${INK}" stroke-width="1.4"/><line x1="${x + 24}" y1="${ky + 4}" x2="${x + 24}" y2="${ky + 14}" stroke="${INK}" stroke-width="1.4"/>`, 'hook your tape at START; each number is how far from START', 30);
      key((x) => `<line x1="${x}" y1="${ky + 9}" x2="${x + 22}" y2="${ky + 9}" stroke="${INK}" stroke-width="5.5"/><line x1="${x}" y1="${ky + 9}" x2="${x + 22}" y2="${ky + 9}" stroke="#fff" stroke-width="2.4"/>`, 'window', 22);
      key((x) => `<line x1="${x}" y1="${ky + 9}" x2="${x + 22}" y2="${ky + 9}" stroke="${INK}" stroke-width="1.3" stroke-dasharray="3 2"/>`, 'door', 22);
      key(() => '', "sizes are wide x tall", -5);
      if (sh.rails?.length) key((x) => `<path d="M${x} ${ky + 6}H${x + 22}" stroke="${INK}" stroke-width="3.2"/><path d="M${x + 4} ${ky + 6}v5M${x + 11} ${ky + 6}v5M${x + 18} ${ky + 6}v5" stroke="${INK}" stroke-width="1.1"/>`, 'railing', 22);
      key((x) => `<rect x="${x}" y="${ky + 4}" width="10" height="10" fill="#fff" stroke="#aab3bb" stroke-width="0.8"/>`, "square = 1'", 10);
    } else {
      key((x) => `<circle cx="${x + 8}" cy="${ky + 9}" r="7.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/>${bsBulb(x + 8, ky + 7.6, 0.58, INK)}`, 'light on the ceiling', 16);
      key((x) => `<rect x="${x}" y="${ky + 2}" width="14" height="14" fill="#fff" stroke="${INK}" stroke-width="1.6"/><text x="${x + 7}" y="${ky + 13}" text-anchor="middle" font-size="10.5" font-weight="800">S</text>`, 'light switch', 14);
      key((x) => `<circle cx="${x + 7}" cy="${ky + 9}" r="7" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M${x + 4.7} ${ky + 5.6}v6.8M${x + 9.3} ${ky + 5.6}v6.8" stroke="${INK}" stroke-width="1.5"/>`, 'plug (outlet)', 14);
      key((x) => `<line x1="${x}" y1="${ky + 9}" x2="${x + 24}" y2="${ky + 9}" stroke="${SOFT}" stroke-width="4"/>`, 'walls, doors and windows are grey', 24);
      key((x) => `<path d="M${x} ${ky + 3}L${x + 10} ${ky + 9}L${x} ${ky + 15}Z" fill="${INK}"/>`, 'hook your tape at START', 10);
    }
    o.push('</svg>');
    return { svg: o.join(''), need };
  }

  /* ---------- Page pieces ---------- */
  function band(o, lay, title, page, pages) {
    const c = o.c, ok = c.sheet?.ok;
    const cell = (k, v, cls = '') => `<div class="bs-cell ${cls}"><small>${k}</small><strong>${v}</strong></div>`;
    return `<div class="bs-band b1-band">
      <div class="bs-big"><b>${esc(c.size.replace('x', ' × '))}</b><span>${title}</span></div>
      ${cell('Building', esc(label(c).replace(c.size, '').trim() + (lay.sh.pkg ? ' · ' + lay.sh.pkg : '')))}
      ${lay.sh.pkg === 'Side Porch' || lay.sh.pkg === 'Deluxe Porch' ? cell('Porch side', (c.porchSide || 'Left').toUpperCase()) : ''}
      ${cell('Serial number', esc(o.serial || 'Given at the plant'))}
      ${cell('Order', esc([o.id, o.customer].filter(Boolean).join(' · ') || '—'))}
      ${cell('Sold by', esc(o.dealer.replace('Bennett Buildings of ', 'Bennett · ')), 'bs-grow bs-clip')}
      ${cell('Layout', ok ? `Checked ${new Date(ok).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'NOT CHECKED YET', ok ? '' : 'bs-warn')}
      ${cell('Page', `${page} of ${pages}`)}
    </div>`;
  }
  const sw = (hex) => (hex ? `<span class="bs-sw" style="background:${hex}"></span>` : '');
  const group = (name, list, cls = '') => `<div class="b1-group ${cls}"><h3>${name}</h3><ul>${list.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul></div>`;

  function buildSide(c, lay, power) {
    const pkg = activePackage(c), wood = usesWoodOptions(c), sh = lay.sh;
    const count = (list) => Object.entries(list.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).map(([k, n]) => `${n} ${k}`);
    const opens = count(lay.items.filter((x) => x.w && !isElec(x) && x.kind !== 'fix').map((x) => sizeInName(low(x.name)) + (x.note ? `, ${x.note}` : '')));
    const roofKind = c.style === 'Lofted' ? 'Barn roof (gambrel), with lofts at the front and back' : c.style === 'Low-Wall Barn' ? 'Barn roof (gambrel)' : c.style === 'Studio' ? 'One-slope roof' : 'Gable roof';
    return [
      group('Building', [
        `<b>${sh.W}' wide, ${sh.L}' long</b>`,
        wood ? (c.wallHeight ? `Side walls ${esc(String(c.wallHeight))}' tall` : 'Side walls: standard height') : 'Metal building',
        `Floor joists ${c.floor || pkg?.floor ? '12" apart (upgrade)' : '16" apart'}`,
        `Siding: ${esc(c.siding)}`,
        c.shield && 'TechShield heat barrier',
      ]),
      group('Doors and windows', opens.length ? [...opens.map(esc), '<i>Sizes are wide x tall.</i>'] : ['None on the order']),
      group('Roof', [
        roofKind,
        c.roof === 'Metal' ? `Metal roof: ${sw(metalRoofColors[c.roofColor])}${esc(c.roofColor || 'color not picked')}` : `Shingle roof${c.shingleColor ? ': ' + esc(c.shingleColor) : ''}`,
        c.package === 'Dormer Package' && pkg && esc(dormerOption(c).label),
      ]),
      group('Paint colors', [
        `Siding: ${sw(paintColors[c.color])}${esc(c.color)}`,
        `Trim: ${sw(paintColors[c.trimColor || 'Origami White'])}${esc(c.trimColor || 'Origami White')}`,
        c.doorColor && `Doors: ${sw(paintColors[c.doorColor])}${esc(c.doorColor)}`,
        c.doorTrimColor && `Door trim: ${sw(paintColors[c.doorTrimColor])}${esc(c.doorTrimColor)}`,
        wood && c.accentColor && `${c.accentArea === 'lower' ? 'Two-tone lower part' : 'Gable accent'}: ${esc(c.accentColor)}`,
        wood && c.customPaint && `Paint match: ${esc(c.customPaint)}`,
      ]),
      pkg ? group(pkg.porch ? 'Porch' : 'Package', [esc(c.package), pkg.porch && esc(pkg.porch), (c.package === 'Side Porch' || c.package === 'Deluxe Porch') && `On the ${(c.porchSide || 'Left').toUpperCase()}`, ...(typeof porchNotes === 'function' ? porchNotes(c).map((t) => esc(t.replace(/(\d+) ft\b/g, "$1'"))) : [])], 'b1-porch') : '',
    ].join('');
  }
  function buildUnder(c, lay, power) {
    const piece = (x) => {
      const name = esc(x.name.split(' · ')[0]);
      if (!x.placed) return `${name} <b>(not placed yet)</b>`;
      return x.fix === 'run' ? `${name}: ${b1Feet(x.len)} long, ${b1Feet(x.depth)} deep` : x.fix === 'wall' ? `${name}: ${b1Feet(x.depth)} long` : x.fix === 'frame' ? `${name}: ${b1Feet(x.len)} wide` : `${name} (overhead): ${b1Feet(x.depth)} deep`;
    };
    const inside = [...lay.items.filter((x) => x.kind === 'fix').map(piece), c.loft && `Loft: ${esc(String(c.loft).replace(/(\d+) ft/g, "$1'"))}`].filter(Boolean);
    return `<div class="b1-under">${inside.length ? group('Inside', inside, 'b1-inside') : ''}${group('Electrical', [power ? '<b>See the Electrical sheet</b> (next page)' : 'No electrical on this building'])}</div>`;
  }

  /* Notes other files put on the layout, split in two: things to do, and things to ask. */
  function notesFor(lay, elec) {
    const ask = [], todo = [];
    for (let n of lay.notes) {
      if (/^Heights off the floor/.test(n)) {
        ask.push(elec ? 'How high off the floor the plugs and the switch go is not on the order. Use the plant standard heights.' : 'How high off the floor the windows go is not on the order. Use the plant standard height.');
        continue;
      }
      if (/^Loft: /.test(n) && !elec && namedLofts(lay).length) continue; /* drawn on the plan */
      if (ELEC_NOTE.test(n) !== elec) continue;
      n = n.replace(/Pigtail \(drop-cord adapter\)/, 'Drop-cord hookup (pigtail)').replace(/: location is not on the order\./, ': where it goes is not on the order.').replace(/(\d+) ft\b/g, "$1'");
      (/not on the order|not placed|not set|confirm|does not fit|by hand|in the way|in front of|is behind|not known|review required/i.test(n) ? ask : todo).push(n);
    }
    if (!elec && /^U-Shaped/i.test(String(lay.c.loft || ''))) ask.push("U-shaped loft: the order gives no sizes. It is drawn 4' deep across the end with a 2' arm down each side. Check before you build it.");
    return { ask: [...new Set(ask)], todo: [...new Set(todo)] };
  }
  const noteBox = (title, list, cls = '') => (list.length ? `<div class="b1-notes ${cls}"><h2>${title}</h2><ul>${list.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '');
  const signOff = () => `<div class="b1-sign"><span>Built by</span><i></i><span>Date</span><i class="short"></i><span>Checked by</span><i></i><span>Date</span><i class="short"></i></div>`;
  const foot = (a, b) => `<div class="bs-foot"><span>${a}</span><span>${b}</span></div>`;

  function buildPage(o, lay, power) {
    const { ask, todo } = notesFor(lay, false), ok = o.c.sheet?.ok;
    if (!ok) ask.unshift('The sales manager has not checked where the doors and windows go. They are in the standard spots.');
    return `<section class="bs-page b1-page" data-sheet="build"><div class="bs-fit">${band(o, lay, 'Build sheet', 1, power ? 2 : 1)}
      <div class="b1-grid"><div class="b1-side">${buildSide(o.c, lay, power)}${noteBox('Special notes', todo)}</div>
        <div class="b1-main"><div class="bs-plan b1-plan">${b1Plan(lay, 'build')}</div>
          <div class="b1-noterow">${buildUnder(o.c, lay, power)}${noteBox('Ask the office before you build', ask, 'b1-ask')}</div></div></div>
      ${signOff()}</div>
      ${foot('Every measurement for the building is on this page. Sizes are the door and window sizes: frame the openings the plant standard way. No prices on this sheet.', power ? 'Build sheet · the electrical is on the next page' : 'Build sheet')}
    </section>`;
  }

  function elecPage(o, lay) {
    const c = o.c, sh = lay.sh, its = lay.items;
    const n = (k) => its.filter((x) => x.kind === k).length, many = (q, one, more) => `${q} ${q === 1 ? one : more}`;
    const counts = [n('light') && many(n('light'), 'light on the ceiling', 'lights on the ceiling'), n('switch') && many(n('switch'), 'light switch', 'light switches'), n('outlet') && many(n('outlet'), 'plug (outlet)', 'plugs (outlets)'), ...(PACK[c.electrical] || []).map((x) => '1 ' + low(x)), ...electricalExtras(c).filter((e) => e.key !== 'extraLights').map((e) => esc(e.label))].filter(Boolean);
    const how = c.elecPlace === 'edited' ? 'The salesperson put each one on the floor plan. Build it the way this sheet shows.' : c.elecPlace === 'default' ? 'The customer wants the standard spots. That is what this sheet shows.' : 'Nobody has picked the spots yet. This sheet shows the standard spots.';
    const rows = [], lights = its.filter((x) => x.kind === 'light').sort((a, b) => a.x - b.x);
    lights.forEach((it, i) => rows.push([lights.length > 1 ? `Light ${i + 1}` : 'Light', 'Ceiling', `${b1Feet(it.x - sh.minX)} from the ${bsSideWall(sh.sides.left)}, ${b1Feet(it.y)} from the ${bsSideWall(sh.sides.top)}${Math.abs(it.y - sh.W / 2) < 0.05 ? ' (the middle of the building)' : ''}`]));
    for (const w of sh.walls) for (const it of boxesOn(lay, w)) rows.push([it.kind === 'outlet' ? 'Plug (outlet)' : 'Light switch' + (it.note ? ` <i>(${esc(it.note)})</i>` : ''), esc(w.name), `${b1Feet(it.at)} from ${esc(hookWords(w))}, to the middle of the box`]);
    for (const x of PACK[c.electrical] || []) rows.push([x, '<b>Ask the office</b>', 'Where it goes is not on the order.']);
    const { ask, todo } = notesFor(lay, true);
    const side = [
      group('What to install', counts),
      group('Package', [`${esc(c.electrical)} electrical package`]),
      group('Who picked the spots', [how]),
      group('How high off the floor', ['Not on the order. Use the plant standard heights for the switch and the plugs.']),
      group('How to measure', ['Hook your tape at START on that wall.', 'Each number is to the <b>middle of the box</b>.', 'Boxes go on a wall stud. Lights hang from a roof truss.']),
    ].join('');
    return `<section class="bs-page b1-page" data-sheet="electrical"><div class="bs-fit">${band(o, lay, 'Electrical sheet', 2, 2)}
      <div class="b1-grid"><div class="b1-side">${side}${noteBox('Special notes', todo)}${noteBox('Ask the office before you wire', ask, 'b1-ask')}</div>
        <div class="b1-main"><div class="bs-plan b1-plan">${b1Plan(lay, 'elec')}</div>
          <div class="b1-list"><h2>Where each one goes</h2><table class="b1-wall b1-elec"><thead><tr class="b1-cols"><td>What</td><td>Where</td><td>How far</td></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
        </div></div>
      ${signOff()}</div>
      ${foot('Only the electrical is on this page. Doors, windows and everything else are on the build sheet.', 'Electrical sheet')}
    </section>`;
  }

  try {
    AW_REAL.sales.push('The build sheet is one page with every measurement on the drawing, written the short way (11\' 6"). The electrical has its own sheet.');
    AW_OPEN.push(['Build sheet and electrical sheet', 'The plant gets one build sheet with a tape line beside every wall, and a separate electrical sheet. Heights off the floor, framing sizes and where the drop-cord hookup goes are not on the order, so the sheets say to ask. The sign-off line and a named loft drawn on the plan have no Turbo Assist record: a feature the product still has to accept.']);
  } catch (e) {}

  if (typeof bsPages === 'function') {
    window.bsPagesOld = bsPages;
    bsPages = function (o) {
      const lay = bsLayout(o.c), power = !!o.c.electrical && o.c.electrical !== 'None';
      return buildPage(o, lay, power) + (power ? elecPage(o, lay) : '');
    };
  }
}
