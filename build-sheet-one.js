/* build-sheet-one.js: one build sheet with every measurement on it, and a separate electrical sheet.

   The owner showed a builder the old sheet 2 of 2 (walls drawn flat as grey strips, away from the
   plan) and it confused him. He wants the measurements for everything on ONE sheet. So:

   1. BUILD SHEET (one landscape page). A big floor plan seen from above. Beside every wall runs a
      tape line: hook the tape at START and each number is how far along the wall that edge is.
      Each door and window is named in words where it sits. A list under the plan says the same
      thing wall by wall. No item numbers to look up, no wall letters, no electrical, no prices.
   2. ELECTRICAL SHEET (its own page, only when the building has electrical). The same plan in
      light grey with only the electrical drawn in black, a count of what to install, and how far
      each box is from the START corner of its wall.

   Feet and inches are written out ("11 ft 6 in"), never as decimals or tick marks.

   Existing functions hooked: bsPages() is replaced (the old two pages stay reachable as
   bsPagesOld). Everything is read from bsLayout(), so the floor plan editor, the porch railing,
   the inside options and the notes that other files add all keep working. bsRender() still fits
   each .bs-page to one printed sheet. Nothing here changes a price or an order.
   The sign-off line and the named loft drawn on the plan are new: features the product still has
   to accept. Loaded last. */
{
  const INK = '#111', SOFT = '#9aa3ab';
  const f = (v) => v.toFixed(1);

  /* 11.5 -> "11 ft 6 in", 20 -> "20 ft", 0.25 -> "3 in" (to the nearest eighth of an inch) */
  function b1Feet(v) {
    let e = Math.round(v * 96);
    const ft = Math.floor(e / 96);
    e -= ft * 96;
    const inch = Math.floor(e / 8), fr = BS_FR[e % 8];
    if (!inch && !fr) return `${ft} ft`;
    return `${ft ? ft + ' ft ' : ''}${inch || ''}${fr} in`;
  }
  window.b1Feet = b1Feet;
  const low = (t) => String(t).toLowerCase();
  const cap = (t) => String(t)[0].toUpperCase() + String(t).slice(1);
  const hookWords = (w) => 'the ' + low(w.hook).replace(/^corner of the /, 'corner by the ');
  const isElec = (it) => it.kind === 'outlet' || it.kind === 'switch' || it.kind === 'light';
  const ELEC_NOTE = /outlet|switch|light\b|lights\b|pigtail|breaker|electrical|drop-cord|plug|conduit|\bamp\b|fan\b|receptacle/i;
  const PACK = { 'Lights Only': ['Drop-cord hookup (pigtail)'], Minimal: ['Drop-cord hookup (pigtail)'], Basic: ['Drop-cord hookup (pigtail)'], Expanded: ['Drop-cord hookup (pigtail)'], Utility: ['Breaker box, 6 spaces'] };

  /* Short name for the drawing; the list under the plan gives the full name. */
  function shortName(it) {
    if (it.kind === 'outlet') return 'Plug';
    if (it.kind === 'switch') return 'Switch';
    if (it.kind === 'fix') return /garage/i.test(it.name) ? 'Garage door' : 'Framed opening';
    if (it.kind === 'window') return it.high ? 'Transom' : 'Window';
    if (/roll/i.test(it.name)) return 'Roll-up door';
    if (/double|barn/i.test(it.name)) return 'Double door';
    return 'Door';
  }
  /* "2 ft wide, 3 ft tall" when the name carries the size, else the width alone. */
  function sizeWords(it) {
    const m = it.name.match(/(\d+)\s*[x×]\s*(\d+)/);
    const wide = `${b1Feet(it.w || it.len)} wide`;
    if (it.high) return `${wide}, high on the wall`;
    return m ? `${wide}, ${m[2]} ft tall` : wide;
  }
  /* Openings cut into a wall: doors, windows, transoms, framed openings. */
  const openingsOn = (lay, w) => lay.items
    .filter((x) => (x.wi === w.i && x.w && !isElec(x)) || (x.kind === 'fix' && x.fix === 'frame' && x.fw === w.i && x.placed))
    .map((x) => ({ ...x, w: x.w || x.len }))
    .sort((a, b) => a.at - b.at);
  const boxesOn = (lay, w) => lay.items.filter((x) => x.wi === w.i && (x.kind === 'outlet' || x.kind === 'switch')).sort((a, b) => a.at - b.at);
  const piecesOn = (lay, w) => lay.items.filter((x) => x.kind === 'fix' && x.fix !== 'frame' && x.fw === w.i);

  function wallSide(sh, w) {
    const g = bsWallGeo(sh, w), out = [-g.n[0], -g.n[1]], ax = Math.abs(out[0]), ay = Math.abs(out[1]);
    return { g, angled: Math.min(ax, ay) > 0.2, side: ax > ay ? (out[0] < 0 ? 'left' : 'right') : out[1] < 0 ? 'top' : 'bottom' };
  }

  /* A loft picked by name ("4 ft Back") is drawn across that end when the front is an end wall. */
  function namedLofts(lay) {
    const c = lay.c, sh = lay.sh, m = c.loft && String(c.loft).match(/^(\d+) ft (Front & Back|Front|Back)$/);
    if (!m || sh.sides.left !== 'FRONT') return [];
    const d = +m[1], x0 = sh.minX, out = [];
    if (/Front/.test(m[2])) out.push([x0, x0 + d, 'front']);
    if (/Back/.test(m[2])) out.push([sh.L - d, sh.L, 'back']);
    return out.map(([a, b, end]) => ({ a, b, end, d }));
  }

  /* ---------- The plan: mode 'build' or 'elec' ---------- */
  function b1Plan(lay, mode) {
    let rows = { top: 1, bottom: 1 }, out, same = false;
    for (let pass = 0; pass < 4 && !same; pass++) {
      out = draw(lay, mode, rows);
      same = out.need.top === rows.top && out.need.bottom === rows.bottom;
      if (!same) rows = pass < 2 ? out.need : { top: Math.max(rows.top, out.need.top), bottom: Math.max(rows.bottom, out.need.bottom) };
    }
    return same ? out.svg : draw(lay, mode, rows).svg;
  }
  function draw(lay, mode, rows) {
    const { sh, items, c } = lay, { L, W } = sh, build = mode === 'build';
    const VW = 769, GAP = 30, ROW = 13, mSide = 138;
    const mT = rows.top ? GAP + 9 + rows.top * ROW + 22 : 62, mB = rows.bottom ? GAP + 17 + rows.bottom * ROW + 14 : 18, KEY = 26;
    const Sc = Math.min((VW - 2 * mSide) / L, ((build ? 412 : 470) - mT - mB - KEY) / W, 30);
    const bw = L * Sc, bh = W * Sc, X0 = (VW - bw) / 2, Y0 = mT, VH = mT + bh + mB + KEY;
    const P = ([x, y]) => [X0 + x * Sc, Y0 + y * Sc];
    const pts = (l) => l.map((q) => P(q).map(f).join(',')).join(' ');
    const wallInk = build ? INK : SOFT;
    const o = [`<svg viewBox="0 0 ${VW} ${f(VH)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${build ? 'The building from above, with every measurement' : 'Where the electrical goes'}">`];
    const txt = (x, y, t, a = 'middle', size = 10, weight = 500, fill = INK) => `<text x="${f(x)}" y="${f(y)}" text-anchor="${a}" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(t)}</text>`;
    o.push(`<defs><pattern id="b1deck${mode}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6H6" stroke="#b5b5b5" stroke-width="0.7"/></pattern><pattern id="b1loft${mode}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="${INK}" stroke-width="1"/></pattern></defs>`);

    /* porch floor, building floor, walls */
    if (sh.deck) o.push(`<polygon points="${pts(sh.deck)}" fill="url(#b1deck${mode})" stroke="${wallInk}" stroke-width="1" stroke-dasharray="4 3"/>`);
    o.push(`<polygon points="${pts(sh.poly)}" fill="#fff"/>${bsGrid(sh, P, 'b1grid' + mode, '#dfe4e8', 0.6)}<polygon points="${pts(sh.poly)}" fill="none" stroke="${wallInk}" stroke-width="${build ? 5 : 4}" stroke-linejoin="miter"/>`);
    for (const q of sh.posts) {
      const [x, y] = P(q);
      o.push(`<rect x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8" fill="${wallInk}"/>`);
    }
    if (typeof porchRailsSvg === 'function') o.push(porchRailsSvg(sh, P, 1, wallInk));
    const pole = sh.deck && bsPole(sh);
    if (pole) {
      const [x, y] = P(pole), deep = c.package === 'End Porch' ? sh.minX : 4;
      o.push(txt(x, y - 1, 'PORCH', 'middle', 9.5, 800, build ? INK : '#6b747c'));
      if (build && Sc * deep > 62) o.push(txt(x, y + 10, `${deep} ft deep`, 'middle', 8.6, 600));
    }

    /* inside options and lofts (build sheet only) */
    if (build) {
      for (const lf of namedLofts(lay)) {
        const box = [[lf.a, 0], [lf.b, 0], [lf.b, W], [lf.a, W]], [cx, cy] = P([(lf.a + lf.b) / 2, W / 2]);
        o.push(`<polygon points="${pts(box)}" fill="url(#b1loft${mode})" fill-opacity="0.35" stroke="${INK}" stroke-width="1.2" stroke-dasharray="6 4"/>`);
        o.push(`<g transform="rotate(-90 ${f(cx)} ${f(cy)})">${txt(cx, cy - 2, 'LOFT (overhead)', 'middle', 10, 800)}${txt(cx, cy + 10, `${lf.d} ft deep, across the ${lf.end}`, 'middle', 8.8, 600)}</g>`);
      }
      for (const it of items) {
        if (it.kind !== 'fix' || it.fix === 'frame') continue;
        const w = sh.walls[it.fw], g = bsWallGeo(sh, w), a = g.at(it.at), b = g.at(it.at + it.len), n = g.n, d = it.depth;
        const box = [a, b, [b[0] + n[0] * d, b[1] + n[1] * d], [a[0] + n[0] * d, a[1] + n[1] * d]];
        const xs = box.map((q) => P(q)[0]), ys = box.map((q) => P(q)[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, wide = Math.max(...xs) - Math.min(...xs), tall = Math.max(...ys) - Math.min(...ys);
        const red = !it.placed, line = red ? '#b3362e' : INK, over = it.fix === 'loft' || it.fix === 'uloft';
        const name = low(it.name.split(' · ')[0]);
        if (it.fix === 'wall') o.push(`<line x1="${f(P(a)[0])}" y1="${f(P(a)[1])}" x2="${f(P(box[3])[0])}" y2="${f(P(box[3])[1])}" stroke="${line}" stroke-width="4" ${red ? 'stroke-dasharray="6 4"' : ''}/>`);
        else o.push(`<polygon points="${pts(box)}" fill="${over ? `url(#b1loft${mode})` : '#ececec'}" fill-opacity="${over ? 0.35 : 1}" stroke="${line}" stroke-width="1.3" ${red || over ? 'stroke-dasharray="6 4"' : ''}/>`);
        const head = red ? `${name.toUpperCase()}: NOT PLACED YET` : it.fix === 'run' ? `${name.toUpperCase()} · ${b1Feet(it.len)} long, ${b1Feet(d)} deep` : over ? `${name.toUpperCase()} (overhead) · ${b1Feet(d)} deep` : `${name.toUpperCase()} · ${b1Feet(d)} long`;
        const sub = red || over ? '' : it.at < 0.02 ? `starts at ${hookWords(w)}` : `starts ${b1Feet(it.at)} from ${hookWords(w)}`;
        const turn = tall > wide * 1.3, room = turn ? tall : wide, thick = turn ? wide : tall;
        const fitHead = head.length * 5.3 < room + 40, twoLines = sub && thick >= 25 && sub.length * 4.7 < room + 40;
        const body = txt(cx, cy + (twoLines ? -2 : 3.5), fitHead ? head : name.toUpperCase(), 'middle', 9.2, 800, line) + (twoLines ? txt(cx, cy + 9.5, sub, 'middle', 8.4, 600) : '');
        o.push(turn ? `<g transform="rotate(-90 ${f(cx)} ${f(cy)})">${body}</g>` : body);
      }
    }

    /* openings on the walls, and the tape beside each wall */
    const sides = { top: [], bottom: [], left: [], right: [] }, skipped = [];
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
      /* what the tape shows for this wall */
      const marks = [{ t: 0, text: 'START', start: true }], names = [];
      if (build) {
        for (const it of ops) {
          for (const t of [it.at, it.at + it.w]) if (!marks.some((m) => Math.abs(m.t - t) < 0.011)) marks.push({ t, text: b1Feet(t) });
          names.push({ t: it.at + it.w / 2, text: `${shortName(it)} ${b1Feet(it.w)}` });
        }
      } else {
        if (!boxes.length) continue;
        for (const it of boxes) { marks.push({ t: it.at, text: b1Feet(it.at) }); names.push({ t: it.at, text: shortName(it) }); }
      }
      const end = marks.find((m) => Math.abs(m.t - w.len) < 0.011);
      if (end) end.text = `${b1Feet(w.len)} END`;
      else marks.push({ t: w.len, text: `${b1Feet(w.len)} END` });
      if (angled) { skipped.push(w); continue; }
      const A = P(w.a), B = P(w.b), horiz = side === 'top' || side === 'bottom';
      /* a short wall with a lot on it has no room for its numbers: the list carries them */
      if (horiz && marks.reduce((t, m) => t + m.text.length * 6 + 9, 0) > Math.abs(B[0] - A[0]) * 1.6 + 40) { skipped.push(w); continue; }
      if (!horiz && (marks.length + names.length) * 12.5 > Math.abs(B[1] - A[1]) + 50) { skipped.push(w); continue; }
      const lo = horiz ? Math.min(A[0], B[0]) : Math.min(A[1], B[1]), hi = horiz ? Math.max(A[0], B[0]) : Math.max(A[1], B[1]);
      const depth = side === 'top' ? A[1] - Y0 : side === 'bottom' ? Y0 + bh - A[1] : side === 'left' ? A[0] - X0 : X0 + bw - A[0];
      sides[side].push({ w, g, marks, names, lo, hi, depth });
    }
    const need = { top: 0, bottom: 0 };
    for (const side of ['top', 'bottom', 'left', 'right']) {
      /* Two walls facing the same way cannot share one stretch of tape: the outer wall keeps it. */
      const kept = [];
      for (const s of sides[side].sort((a, b) => a.depth - b.depth)) {
        if (kept.some((k) => s.lo < k.hi - 2 && s.hi > k.lo + 2)) skipped.push(s.w);
        else kept.push(s);
      }
      const horiz = side === 'top' || side === 'bottom', dir = side === 'top' || side === 'left' ? -1 : 1;
      const edge = side === 'top' ? Y0 : side === 'bottom' ? Y0 + bh : side === 'left' ? X0 : X0 + bw, tape = edge + dir * GAP;
      const labels = [], nameList = [], titles = [];
      for (const s of kept) {
        const at = (t) => P(s.g.at(t)), a = at(0), b = at(s.w.len);
        /* the tape line, with an arrow at START */
        o.push(horiz ? `<line x1="${f(a[0])}" y1="${f(tape)}" x2="${f(b[0])}" y2="${f(tape)}" stroke="${INK}" stroke-width="1.4"/>` : `<line x1="${f(tape)}" y1="${f(a[1])}" x2="${f(tape)}" y2="${f(b[1])}" stroke="${INK}" stroke-width="1.4"/>`);
        const sgn = horiz ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
        o.push(horiz ? `<path d="M${f(a[0])} ${f(tape - 6)}L${f(a[0] + sgn * 10)} ${f(tape)}L${f(a[0])} ${f(tape + 6)}Z" fill="${INK}"/>` : `<path d="M${f(tape - 6)} ${f(a[1])}L${f(tape)} ${f(a[1] + sgn * 10)}L${f(tape + 6)} ${f(a[1])}Z" fill="${INK}"/>`);
        for (const m of s.marks) {
          const q = at(m.t), far = horiz ? Math.abs(q[1] - edge) : Math.abs(q[0] - edge);
          /* a dotted line carries the mark from an inner wall out to the tape */
          if (far > 3 || !build) o.push(horiz ? `<line x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(q[0])}" y2="${f(tape)}" stroke="#777" stroke-width="0.8" stroke-dasharray="2 3"/>` : `<line x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(tape)}" y2="${f(q[1])}" stroke="#777" stroke-width="0.8" stroke-dasharray="2 3"/>`);
          if (!m.start) o.push(horiz ? `<line x1="${f(q[0])}" y1="${f(tape - 5)}" x2="${f(q[0])}" y2="${f(tape + 5)}" stroke="${INK}" stroke-width="1.4"/>` : `<line x1="${f(tape - 5)}" y1="${f(q[1])}" x2="${f(tape + 5)}" y2="${f(q[1])}" stroke="${INK}" stroke-width="1.4"/>`);
          labels.push({ p: horiz ? q[0] : q[1], text: m.text, bold: true });
        }
        for (const n of s.names) {
          const q = at(n.t);
          nameList.push({ p: horiz ? q[0] : q[1], text: n.text });
        }
        /* the wall's name and length */
        const title = s.w.name.toUpperCase(), long = `${b1Feet(s.w.len)} long`;
        if (horiz) {
          const y = side === 'top' ? tape - 9 - rows.top * ROW - 6 : tape + 17 + rows.bottom * ROW + 8;
          /* a short wall keeps its name; its length is the END number on the tape */
          const full = title.length * 9.2 + long.length * 5.6 + 16, tight = full > Math.abs(b[0] - a[0]) + 80;
          const size = tight ? title.length * 9.2 : full;
          titles.push({ y, title, long: tight ? '' : long, size, want: (a[0] + b[0]) / 2 - size / 2 });
        } else {
          const x = tape + dir * 9, top = Math.min(a[1], b[1]), anchor = side === 'left' ? 'end' : 'start';
          const lines = [];
          for (const word of title.split(' ')) {
            if (lines.length && (lines[lines.length - 1] + ' ' + word).length <= 11) lines[lines.length - 1] += ' ' + word;
            else lines.push(word);
          }
          lines.forEach((t, i) => o.push(`<text x="${f(x)}" y="${f(top - 17 - 13 * (lines.length - i))}" text-anchor="${anchor}" font-size="12" font-weight="800" letter-spacing=".8">${esc(t)}</text>`));
          o.push(`<text x="${f(x)}" y="${f(top - 17)}" text-anchor="${anchor}" font-size="11" font-weight="600">${long}</text>`);
        }
      }
      if (horiz) {
        if (titles.length) bsSlot(titles, 4, VW - 4, 16);
        for (const t of titles) o.push(`<text x="${f(t.pos + t.size / 2)}" y="${f(t.y)}" text-anchor="middle" font-size="12.5" font-weight="800" letter-spacing="1">${esc(t.title)}${t.long ? ` <tspan font-weight="600" letter-spacing="0" font-size="11">· ${t.long}</tspan>` : ''}</text>`);
        /* names sit between the wall and the tape; numbers go outside the tape, in rows when they crowd */
        nameList.forEach((n) => ((n.size = n.text.length * 5.3 + 4), (n.want = n.p - n.size / 2)));
        bsSlot(nameList, 4, VW - 4, 5);
        for (const n of nameList) o.push(txt(n.pos + n.size / 2, side === 'top' ? edge - 10 : edge + 18, n.text, 'middle', 9.6, 600));
        const rowEnd = [];
        for (const l of labels.sort((a, b) => a.p - b.p)) {
          const tw = l.text.length * 6 + 4, left = Math.max(2, Math.min(VW - tw - 2, l.p - tw / 2));
          let r = rowEnd.findIndex((e) => left > e + 5);
          if (r < 0) r = rowEnd.length;
          rowEnd[r] = left + tw;
          const y = side === 'top' ? tape - 9 - r * ROW : tape + 17 + r * ROW;
          if (r > 0) o.push(`<line x1="${f(l.p)}" y1="${f(tape)}" x2="${f(l.p)}" y2="${f(side === 'top' ? y + 2 : y - 9)}" stroke="${INK}" stroke-width="0.7"/>`);
          o.push(txt(left + tw / 2, y, l.text, 'middle', 10.5, 800));
        }
        need[side] = kept.length ? Math.max(1, rowEnd.length) : 0;
      } else {
        /* one column beside the tape: numbers and names in the order you meet them */
        const col = [...labels, ...nameList.map((n) => ({ ...n, name: true }))].sort((a, b) => a.p - b.p || (a.name ? 1 : -1));
        col.forEach((l) => ((l.size = 11), (l.want = l.p - 5.5)));
        if (col.length) bsSlot(col, Y0 - 12, Y0 + bh + 14, 1.5);
        const x = tape + dir * 9, anchor = side === 'left' ? 'end' : 'start';
        for (const l of col) {
          const y = l.pos + 9;
          if (!l.name && Math.abs(l.pos + 5.5 - l.p) > 2) o.push(`<line x1="${f(tape)}" y1="${f(l.p)}" x2="${f(tape + dir * 7)}" y2="${f(l.pos + 5.5)}" stroke="${INK}" stroke-width="0.7"/>`);
          o.push(txt(x, y, l.text, anchor, l.name ? 9.6 : 10.5, l.name ? 600 : 800));
        }
      }
    }
    /* walls with no tape on the drawing: say where to look */
    for (const w of skipped) {
      const has = build ? openingsOn(lay, w).length : boxesOn(lay, w).length;
      if (!has) continue;
      const { g } = wallSide(sh, w), q = P(g.at(w.len / 2));
      o.push(txt(q[0] - g.n[0] * 12, q[1] - g.n[1] * 12 + 3, `${cap(low(w.name))}: see the list`, g.n[0] > 0.2 ? 'end' : g.n[0] < -0.2 ? 'start' : 'middle', 8.6, 700));
      w.b1Skipped = true;
    }

    /* ceiling lights (electrical sheet) */
    if (!build) {
      const lights = items.filter((x) => x.kind === 'light').sort((a, b) => a.x - b.x);
      const tags = lights.map((it, i) => {
        const [x, y] = P([it.x, it.y]), text = `${b1Feet(it.x - sh.minX)} from the ${bsSideWall(sh.sides.left)}`;
        return { it, x, y, i, text, size: Math.max(text.length * 5.1, 60) + 6, want: 0, up: i % 2 === 0 };
      });
      for (const up of [true, false]) {
        const row = tags.filter((t) => t.up === up);
        row.forEach((t) => (t.want = t.x - t.size / 2));
        if (row.length) bsSlot(row, X0 + 4, X0 + bw - 4, 6);
      }
      for (const t of tags) {
        const cx = t.pos + t.size / 2, ty = t.up ? t.y - 30 : t.y + 26;
        o.push(`<line x1="${f(t.x)}" y1="${f(t.y)}" x2="${f(cx)}" y2="${f(t.up ? ty + 14 : ty - 10)}" stroke="${INK}" stroke-width="0.8"/>`);
        o.push(`<circle cx="${f(t.x)}" cy="${f(t.y)}" r="9" fill="#fff" stroke="${INK}" stroke-width="1.8"/>${bsBulb(t.x, t.y - 1.6, 0.7, INK)}`);
        o.push(txt(cx, ty, lights.length > 1 ? `LIGHT ${t.i + 1}` : 'LIGHT', 'middle', 10, 800) + txt(cx, ty + 11, t.text, 'middle', 9.2, 600));
      }
    }

    /* how to read it */
    const ky = VH - 19;
    let kx = 6;
    const key = (art, words, wide) => { o.push(art(kx) + `<text x="${f(kx + wide + 5)}" y="${f(ky + 12.5)}" font-size="9.6">${esc(words)}</text>`); kx += wide + 5 + words.length * 4.9 + 16; };
    if (build) {
      key((x) => `<path d="M${x} ${ky + 3}L${x + 10} ${ky + 9}L${x} ${ky + 15}Z" fill="${INK}"/><line x1="${x + 10}" y1="${ky + 9}" x2="${x + 30}" y2="${ky + 9}" stroke="${INK}" stroke-width="1.4"/><line x1="${x + 24}" y1="${ky + 4}" x2="${x + 24}" y2="${ky + 14}" stroke="${INK}" stroke-width="1.4"/>`, 'hook your tape at START; each number is how far from START', 30);
      key((x) => `<line x1="${x}" y1="${ky + 9}" x2="${x + 24}" y2="${ky + 9}" stroke="${INK}" stroke-width="5.5"/><line x1="${x}" y1="${ky + 9}" x2="${x + 24}" y2="${ky + 9}" stroke="#fff" stroke-width="2.4"/>`, 'window', 24);
      key((x) => `<line x1="${x}" y1="${ky + 9}" x2="${x + 24}" y2="${ky + 9}" stroke="${INK}" stroke-width="1.3" stroke-dasharray="3 2"/>`, 'door', 24);
      if (sh.rails?.length) key((x) => `<path d="M${x} ${ky + 6}H${x + 24}" stroke="${INK}" stroke-width="3.2"/><path d="M${x + 4} ${ky + 6}v5M${x + 11} ${ky + 6}v5M${x + 18} ${ky + 6}v5" stroke="${INK}" stroke-width="1.1"/>`, 'porch railing', 24);
      if (sh.deck) key((x) => `<rect x="${x}" y="${ky + 5}" width="8" height="8" fill="${INK}"/>`, 'porch post', 8);
      key((x) => `<rect x="${x}" y="${ky + 4}" width="10" height="10" fill="#fff" stroke="#aab3bb" stroke-width="0.8"/>`, 'small square = 1 ft', 10);
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
  const group = (name, list) => `<div class="b1-group"><h3>${name}</h3><ul>${list.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul></div>`;

  function buildSide(c, lay, power) {
    const pkg = activePackage(c), wood = usesWoodOptions(c), sh = lay.sh;
    const count = (list) => Object.entries(list.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).map(([k, n]) => `${n} ${k}`);
    const opens = count(lay.items.filter((x) => x.w && !isElec(x) && x.kind !== 'fix').map((x) => low(x.name).replace(/(\d)\s*[x×]\s*(\d+)(\s*ft)?/, '$1 ft × $2 ft') + (x.note ? `, ${x.note}` : '')));
    const inside = [...lay.items.filter((x) => x.kind === 'fix').map((x) => esc(x.name.replace(' · ', ', ')) + (x.placed ? '' : ' <b>(not placed yet)</b>')), c.loft && `Loft: ${esc(c.loft)}`];
    const roofKind = c.style === 'Lofted' ? 'Barn roof (gambrel), with lofts at the front and back' : c.style === 'Low-Wall Barn' ? 'Barn roof (gambrel)' : c.style === 'Studio' ? 'One-slope roof' : 'Gable roof';
    return [
      group('Building', [
        `<b>${sh.W} ft wide, ${sh.L} ft long</b>`,
        wood ? (c.wallHeight ? `Side walls ${esc(String(c.wallHeight))} ft tall` : 'Side walls: standard height') : 'Metal building',
        `Floor joists ${c.floor || pkg?.floor ? '12 in. apart (upgrade)' : '16 in. apart'}`,
        `Siding: ${esc(c.siding)}`,
        c.shield && 'TechShield heat barrier',
      ]),
      group('Doors and windows', opens.length ? opens.map(esc) : ['None on the order']),
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
      pkg ? group(pkg.porch ? 'Porch' : 'Package', [esc(c.package), pkg.porch && esc(pkg.porch), (c.package === 'Side Porch' || c.package === 'Deluxe Porch') && `On the ${(c.porchSide || 'Left').toUpperCase()}`, ...(typeof porchNotes === 'function' ? porchNotes(c).map(esc) : [])]) : '',
      inside.filter(Boolean).length ? group('Inside', inside) : '',
      group('Electrical', [power ? '<b>See the Electrical sheet</b> (next page)' : 'No electrical on this building']),
    ].join('');
  }

  /* The wall-by-wall list: the same numbers as the drawing, in words. */
  function wallList(lay) {
    const blocks = [], bare = [];
    for (const w of lay.sh.walls) {
      const ops = openingsOn(lay, w), pcs = piecesOn(lay, w);
      if (!ops.length && !pcs.length) { bare.push(w); continue; }
      const rows = [];
      for (const it of ops) rows.push([esc(it.kind === 'fix' ? it.name : it.name.replace(/(\d)\s*[x×]\s*(\d+)(\s*ft)?/, '$1 ft × $2 ft')) + (it.note ? ` <i>(${esc(it.note)})</i>` : ''), sizeWords(it), b1Feet(it.at), b1Feet(it.at + it.w)]);
      for (const it of pcs) {
        const name = esc(it.name.split(' · ')[0]);
        if (!it.placed) rows.push([name, '<b>Not placed yet. Ask the office.</b>', '', '']);
        else if (it.fix === 'run') rows.push([name, `${b1Feet(it.len)} long, ${b1Feet(it.depth)} deep`, b1Feet(it.at), b1Feet(it.at + it.len)]);
        else if (it.fix === 'wall') rows.push([name, `runs ${b1Feet(it.depth)} into the building`, b1Feet(it.at), '']);
        else rows.push([name + ' (overhead)', `across this wall, ${b1Feet(it.depth)} deep${it.arm ? `, with an arm ${b1Feet(it.arm)} long down each side` : ''}`, '', '']);
      }
      blocks.push(`<table class="b1-wall"><thead><tr><th colspan="4"><b>${esc(w.name)}</b> · ${b1Feet(w.len)} long · START at ${esc(hookWords(w))}</th></tr><tr class="b1-cols"><td>What</td><td>Size</td><td>Starts at</td><td>Ends at</td></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="b1-num">${r[2]}</td><td class="b1-num">${r[3]}</td></tr>`).join('')}</tbody></table>`);
    }
    return `<h2>Wall by wall · the same numbers as the drawing · measured along the wall from START</h2><div class="b1-walls">${blocks.join('')}</div>${bare.length ? `<p class="b1-bare"><b>Nothing to cut in:</b> ${bare.map((w) => `${esc(low(w.name))} (${b1Feet(w.len)})`).join(', ')}</p>` : ''}`;
  }

  /* Notes other files put on the layout, split in two: things to do, and things to ask. */
  function notesFor(lay, elec) {
    const ask = [], todo = [];
    for (let n of lay.notes) {
      if (/^Heights off the floor/.test(n)) {
        (elec ? ask : ask).push(elec ? 'How high off the floor the plugs and the switch go is not on the order. Use the plant standard heights.' : 'How high off the floor the windows go is not on the order. Use the plant standard height.');
        continue;
      }
      if (/^Loft: /.test(n) && !elec && namedLofts(lay).length) continue; /* drawn on the plan */
      if (ELEC_NOTE.test(n) !== elec) continue;
      n = n.replace(/Pigtail \(drop-cord adapter\)/, 'Drop-cord hookup (pigtail)').replace(/: location is not on the order\./, ': where it goes is not on the order.');
      (/not on the order|not placed|not set|confirm|does not fit|by hand|in the way|in front of|is behind|not known|review required/i.test(n) ? ask : todo).push(n);
    }
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
          <div class="b1-list">${wallList(lay)}</div>
          <div class="b1-noterow">${noteBox('Ask the office before you build', ask, 'b1-ask')}</div></div></div>
      ${signOff()}</div>
      ${foot('Every measurement for the building is on this page. Sizes are the door and window sizes: frame the openings the plant standard way. No prices on this sheet.', power ? 'Build sheet · the electrical is on the next page' : 'Build sheet')}
    </section>`;
  }

  function elecPage(o, lay) {
    const c = o.c, sh = lay.sh, its = lay.items;
    const n = (k) => its.filter((x) => x.kind === k).length, many = (q, one, more) => `${q} ${q === 1 ? one : more}`;
    const counts = [n('light') && many(n('light'), 'light on the ceiling', 'lights on the ceiling'), n('switch') && many(n('switch'), 'light switch', 'light switches'), n('outlet') && many(n('outlet'), 'plug (outlet)', 'plugs (outlets)'), ...(PACK[c.electrical] || []).map((x) => '1 ' + low(x)), ...electricalExtras(c).filter((e) => e.key !== 'extraLights').map((e) => esc(e.label))].filter(Boolean);
    const how = c.elecPlace === 'edited' ? 'The salesperson put each one on the floor plan. Build it the way this sheet shows.' : c.elecPlace === 'default' ? 'The customer wants the standard spots. That is what this sheet shows.' : 'Nobody has picked the spots yet. This sheet shows the standard spots.';
    const rows = [];
    for (const it of its.filter((x) => x.kind === 'light')) rows.push([its.filter((x) => x.kind === 'light').length > 1 ? `Light ${rows.length + 1}` : 'Light', 'Ceiling', `${b1Feet(it.x - sh.minX)} from the ${bsSideWall(sh.sides.left)}, ${b1Feet(it.y)} from the ${bsSideWall(sh.sides.top)}${Math.abs(it.y - sh.W / 2) < 0.05 ? ' (the middle of the building)' : ''}`]);
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

  if (typeof bsPages === 'function') {
    window.bsPagesOld = bsPages;
    bsPages = function (o) {
      const lay = bsLayout(o.c), power = !!o.c.electrical && o.c.electrical !== 'None';
      return buildPage(o, lay, power) + (power ? elecPage(o, lay) : '');
    };
  }
}
