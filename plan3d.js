/* plan3d.js: a simple 3D view of the building, drawn from the same floor plan as the build
   sheet (buildsheet.js). Nothing is loaded from a model file: walls, roof, porch, doors and
   windows are built from the order, so moving an item on the 2D plan moves it here too.

   Built for usefulness, not looks: flat colors, dark outlines, drag to turn.
   One hidden WebGL canvas does the drawing and each view on the page is a copy of its picture,
   so any number of views can be shown. Loaded last. */

const P3 = { views: {}, angles: {}, seq: 0, gl: null };

/* ---------- Small vector and matrix helpers (column-major 4x4) ---------- */
const p3Sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const p3Cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const p3Norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function p3Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function p3Camera(eye, center, aspect) {
  const f = p3Norm(p3Sub(center, eye)), s = p3Norm(p3Cross(f, [0, 1, 0])), u = p3Cross(s, f);
  const view = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  const t = 1 / Math.tan((28 * Math.PI) / 360), near = 1, far = 600;
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  return p3Mul(proj, view);
}
const p3Hex = (hex) => {
  const h = (hex || '#888888').replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

/* Split a flat polygon (may be L-shaped) into triangles. Points are [x, y] pairs. */
function p3Ears(poly) {
  const area = poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0);
  const idx = poly.map((_, i) => i);
  if (area < 0) idx.reverse();
  const tri = [], turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 200) {
    for (let i = 0; i < idx.length; i++) {
      const a = poly[idx[(i + idx.length - 1) % idx.length]], b = poly[idx[i]], c = poly[idx[(i + 1) % idx.length]];
      if (turn(a, b, c) <= 1e-9) continue;
      const inside = idx.some((j) => {
        const p = poly[j];
        return p !== a && p !== b && p !== c && turn(a, b, p) > 1e-9 && turn(b, c, p) > 1e-9 && turn(c, a, p) > 1e-9;
      });
      if (inside) continue;
      tri.push(idx[(i + idx.length - 1) % idx.length], idx[i], idx[(i + 1) % idx.length]);
      idx.splice(i, 1);
      break;
    }
  }
  if (idx.length === 3) tri.push(...idx);
  return tri;
}

/* ---------- The building, as colored faces and outline segments ---------- */
function p3Colors(c) {
  const paints = { White: '#ffffff', ...paintColors, ...stainColors };
  const siding = c.style === 'Silver Bullet' ? { ...bulletStandard, ...bulletPremium, Galvalume: metalRoofColors.Galvalume } : paints;
  const body = siding[c.color] || paints.Blue, trim = paints[c.trimColor] || paints['Origami White'];
  return {
    body, trim,
    door: paints[c.doorColor] || body,
    roof: c.style === 'Greenhouse' ? '#dfeef2' : c.roof === 'Shingles' ? '#4a4d50' : metalRoofColors[c.roofColor] || metalRoofColors.Charcoal,
    glass: '#a9d4ea', floor: '#d9c39a', deck: '#9a7650', skid: '#6b5a45',
  };
}
/* Height of the top of the walls and roof across the width (plan y), measured from the floor. */
function p3Profile(c, W) {
  const h = Number(c.wallHeight) || (c.style === 'Low-Wall Barn' ? 5 : c.style === 'Lofted' ? 6 : 7);
  if (c.style === 'Studio') return [[0, h], [W, h + 2]];
  if (c.style === 'Lofted' || c.style === 'Low-Wall Barn') return [[0, h], [W * 0.2, h + W * 0.28], [W / 2, h + W * 0.4], [W * 0.8, h + W * 0.28], [W, h]];
  return [[0, h], [W / 2, h + W * 0.19], [W, h]];
}
function p3Mesh(c) {
  const lay = bsLayout(c), sh = lay.sh, { L, W } = sh, col = p3Colors(c), F = 0.6;
  const prof = p3Profile(c, W), eave = prof[0][1];
  const topAt = (y) => {
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][0] + 1e-9) return prof[i - 1][1] + ((prof[i][1] - prof[i - 1][1]) * (y - prof[i - 1][0])) / (prof[i][0] - prof[i - 1][0]);
    return prof[prof.length - 1][1];
  };
  const pos = [], nor = [], rgb = [], lines = [], soft = [], softC = [];
  /* A faint line in a darker shade of the surface it lies on: siding grooves, roof ribs, slats. */
  const groove = (p, q, hex) => {
    const k = p3Hex(hex);
    soft.push(...p, ...q);
    softC.push(...k, ...k);
  };
  const metal = c.style === 'Silver Bullet' || c.siding === 'Metal';
  const V = (x, y, up) => [x, up, y];
  /* A flat, convex face given as 3D points; outlined unless told otherwise. */
  const face = (pts, hex, outline = true, tris = null) => {
    const n = p3Norm(p3Cross(p3Sub(pts[1], pts[0]), p3Sub(pts[2], pts[0]))), k = p3Hex(hex);
    const order = tris || Array.from({ length: pts.length - 2 }, (_, i) => [0, i + 1, i + 2]).flat();
    for (const i of order) pos.push(...pts[i]), nor.push(...n), rgb.push(...k);
    if (outline) pts.forEach((p, i) => lines.push(...p, ...pts[(i + 1) % pts.length]));
  };
  const flat = (poly, up, hex) => face(poly.map(([x, y]) => V(x, y, up)), hex, true, p3Ears(poly));
  const band = (poly, lo, hi, hex) => poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    face([V(a[0], a[1], lo), V(b[0], b[1], lo), V(b[0], b[1], hi), V(a[0], a[1], hi)], hex, false);
  });
  const box = (x0, y0, x1, y1, lo, hi, hex) => {
    const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    band(q, lo, hi, hex);
    flat(q, hi, hex);
    q.forEach((a) => lines.push(...V(a[0], a[1], lo), ...V(a[0], a[1], hi)));
  };

  /* Floor, porch deck and the frame they sit on. */
  flat(sh.poly, F, col.floor);
  band(sh.poly, 0, F, col.skid);
  if (sh.deck) {
    flat(sh.deck, F, col.deck);
    band(sh.deck, 0, F, col.skid);
  }

  /* Walls rise to the roof line, so end walls carry their own gable. */
  for (const w of sh.walls) {
    const [ax, ay] = w.a, [bx, by] = w.b, top = [];
    const at = (y) => (Math.abs(by - ay) < 1e-9 ? null : [ax + ((bx - ax) * (y - ay)) / (by - ay), y]);
    const mids = prof.map((p) => p[0]).filter((y) => y > Math.min(ay, by) + 1e-6 && y < Math.max(ay, by) - 1e-6).sort((p, q) => (by > ay ? q - p : p - q));
    top.push(V(bx, by, F + topAt(by)), ...mids.map((y) => V(at(y)[0], y, F + topAt(y))), V(ax, ay, F + topAt(ay)));
    face([V(ax, ay, F), V(bx, by, F), ...top], col.body);
    /* Siding: vertical grooves, or horizontal boards for lap siding. */
    const along = (t) => [ax + ((bx - ax) * t) / w.len, ay + ((by - ay) * t) / w.len];
    if (c.siding === 'Lap') {
      for (let up = 0.5; up < Math.max(topAt(ay), topAt(by), ...mids.map(topAt)); up += 0.5) {
        const ok = Array.from({ length: 41 }, (_, i) => (w.len * i) / 40).filter((t) => topAt(along(t)[1]) >= up);
        if (ok.length > 1) groove(V(...along(ok[0]), F + up), V(...along(ok[ok.length - 1]), F + up), col.body);
      }
    } else {
      const step = metal ? 0.75 : 0.667;
      for (let t = step; t < w.len - 0.05; t += step) groove(V(...along(t), F), V(...along(t), F + topAt(along(t)[1])), col.body);
    }

    /* Doors and windows sit just proud of the wall on both faces. */
    const geo = bsWallGeo(sh, w), wallTop = Math.min(topAt(ay), topAt(by));
    for (const it of lay.items.filter((x) => x.wi === w.i && x.w)) {
      const door = it.kind === 'door', roll = /roll/i.test(it.name);
      let lo = door ? 0 : 3.2, hi = door ? (roll ? 7 : 6.67) : 6.2;
      if (it.high) (lo = eave + 0.3), (hi = eave + 1.5);
      hi = Math.min(hi, wallTop - 0.15);
      lo = Math.min(lo, hi - 1);
      const p0 = geo.at(it.at), p1 = geo.at(it.at + it.w);
      for (const side of [-1, 1]) {
        const off = (p, d) => [p[0] + geo.n[0] * d * side, p[1] + geo.n[1] * d * side];
        const quad = (a, b, y0, y1, d, hex) => face([V(...off(a, d), F + y0), V(...off(b, d), F + y0), V(...off(b, d), F + y1), V(...off(a, d), F + y1)], hex);
        quad(geo.at(it.at - 0.17), geo.at(it.at + it.w + 0.17), Math.max(0, lo - (door ? 0 : 0.17)), hi + 0.17, 0.05, col.trim);
        quad(p0, p1, lo, hi, 0.09, door ? (roll || /lite|fiberglass/i.test(it.name) ? '#f4f4f1' : col.door) : col.glass);
        if (door && it.w >= 5 && !roll) lines.push(...V(...off(geo.at(it.at + it.w / 2), 0.09), F + lo), ...V(...off(geo.at(it.at + it.w / 2), 0.09), F + hi));
        const lite = /lite/i.test(it.name), shed = door && !roll && !/lite|fiberglass/i.test(it.name);
        const seg = (ta, ya, tb, yb, d) => lines.push(...V(...off(geo.at(ta), d), F + ya), ...V(...off(geo.at(tb), d), F + yb));
        if (shed) {
          /* Shed doors: a trim frame and a middle rail on each leaf. */
          const leaves = it.w >= 5 ? 2 : 1, lw = it.w / leaves, b = 0.24;
          for (let i = 0; i < leaves; i++) {
            const la = it.at + i * lw, lb = la + lw;
            for (const [ta, tb, y0, y1] of [[la, la + b, lo, hi], [lb - b, lb, lo, hi], [la, lb, hi - b, hi], [la, lb, lo, lo + b], [la, lb, lo + 3.1, lo + 3.1 + b]]) quad(geo.at(ta), geo.at(tb), y0, y1, 0.12, col.trim);
          }
        }
        if (roll) for (let y = lo + 0.6; y < hi; y += 0.6) seg(it.at, y, it.at + it.w, y, 0.1);
        if (door && lite) {
          const leaves = it.w >= 5 ? 2 : 1, lw = it.w / leaves;
          for (let i = 0; i < leaves; i++) {
            const la = it.at + i * lw + 0.45, lb = it.at + (i + 1) * lw - 0.45, y0 = lo + 3.3, y1 = hi - 0.5;
            quad(geo.at(la), geo.at(lb), y0, y1, 0.12, col.glass);
            for (const k of [1 / 3, 2 / 3]) seg(la + (lb - la) * k, y0, la + (lb - la) * k, y1, 0.13), seg(la, y0 + (y1 - y0) * k, lb, y0 + (y1 - y0) * k, 0.13);
          }
        }
        if (!door) {
          /* Window bars, and shutters on the outside when the order has them. */
          seg(it.at + it.w / 2, lo, it.at + it.w / 2, hi, 0.1);
          seg(it.at, (lo + hi) / 2, it.at + it.w, (lo + hi) / 2, 0.1);
          if (side === -1 && !it.high && (/shutter/i.test(it.note || '') || c.shutters)) {
            quad(geo.at(it.at - 0.95), geo.at(it.at - 0.25), lo - 0.1, hi + 0.1, 0.08, col.trim);
            quad(geo.at(it.at + it.w + 0.25), geo.at(it.at + it.w + 0.95), lo - 0.1, hi + 0.1, 0.08, col.trim);
          }
        }
      }
    }
  }
  /* Where an end of the building is open (a porch), close the gable above the eave. */
  for (const x of [0, L]) {
    const covered = sh.walls.filter((w) => Math.abs(w.a[0] - x) < 1e-6 && Math.abs(w.b[0] - x) < 1e-6).reduce((s, w) => s + w.len, 0);
    if (covered > W - 0.01) continue;
    const low = Math.min(...prof.map((p) => p[1]));
    const pts = [...prof.filter((p) => p[1] > low + 1e-6 || p[0] === 0 || p[0] === W).map((p) => V(x, p[0], F + p[1]))];
    if (prof[0][1] > low + 1e-6) pts.unshift(V(x, 0, F + low));
    if (prof[prof.length - 1][1] > low + 1e-6) pts.push(V(x, W, F + low));
    if (pts.length >= 3) face(pts, col.body);
  }
  /* Corner boards, and a vent high in each gable end. */
  for (const [x, y] of sh.poly) box(x - 0.16, y - 0.16, x + 0.16, y + 0.16, F, F + topAt(y) - 0.02, col.trim);
  const peak = Math.max(...prof.map((p) => p[1]));
  if (c.style !== 'Studio' && c.style !== 'Greenhouse' && peak - eave > 1.7) {
    const v0 = eave + (peak - eave) * 0.3, v1 = Math.min(v0 + 1.2, peak - 0.45);
    for (const [x, d] of [[0, -0.07], [L, 0.07]]) {
      face([V(x + d, W / 2 - 0.5, F + v0), V(x + d, W / 2 + 0.5, F + v0), V(x + d, W / 2 + 0.5, F + v1), V(x + d, W / 2 - 0.5, F + v1)], col.trim);
      for (let up = v0 + 0.2; up < v1; up += 0.2) lines.push(...V(x + d * 1.2, W / 2 - 0.4, F + up), ...V(x + d * 1.2, W / 2 + 0.4, F + up));
    }
  }

  /* Roof over the whole footprint, porch included, with a small overhang. */
  const ov = 0.6, rp = prof.map((p) => [...p]);
  const stretch = (a, b) => {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    return [a[0] + ((a[0] - b[0]) / d) * ov, a[1] + ((a[1] - b[1]) / d) * ov];
  };
  rp[0] = stretch(rp[0], rp[1]);
  rp[rp.length - 1] = stretch(rp[rp.length - 1], rp[rp.length - 2]);
  /* Trim boards along the eaves and up the gable edges of the roof. */
  for (const e of [rp[0], rp[rp.length - 1]]) face([V(-ov, e[0], F + e[1] + 0.08), V(L + ov, e[0], F + e[1] + 0.08), V(L + ov, e[0], F + e[1] - 0.3), V(-ov, e[0], F + e[1] - 0.3)], col.trim);
  for (const x of [-ov, L + ov]) for (let i = 1; i < rp.length; i++) face([V(x, rp[i - 1][0], F + rp[i - 1][1] + 0.08), V(x, rp[i][0], F + rp[i][1] + 0.08), V(x, rp[i][0], F + rp[i][1] - 0.3), V(x, rp[i - 1][0], F + rp[i - 1][1] - 0.3)], col.trim);
  /* Roof lines: ribs running down a metal roof, courses running along a shingle roof. */
  for (let i = 1; i < rp.length; i++) {
    const a = rp[i - 1], b = rp[i], up = 0.1;
    if (c.roof === 'Shingles') {
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let k = 1; k < n; k++) groove(V(-ov, a[0] + ((b[0] - a[0]) * k) / n, F + a[1] + ((b[1] - a[1]) * k) / n + up), V(L + ov, a[0] + ((b[0] - a[0]) * k) / n, F + a[1] + ((b[1] - a[1]) * k) / n + up), col.roof);
    } else for (let x = 0; x <= L + 0.01; x += 1) groove(V(x, a[0], F + a[1] + up), V(x, b[0], F + b[1] + up), col.roof);
  }
  /* A dormer opens the right-hand roof slope: the main roof stops where the dormer begins. */
  let dorm = null;
  if (sh.pkg === 'Dormer Package') {
    const len = Math.min(c.dormerGable ? 12 : Number(c.dormerLength) || 8, L - 1);
    const mid = L / 2, x0 = Math.max(0.5, Math.min(mid - len / 2, L - len - 0.5));
    const back = (height) => {
      for (let y = W; y >= W / 2; y -= 0.05) if (topAt(y) >= height) return y;
      return W / 2;
    };
    dorm = { len, x0, x1: x0 + len, back, cut: back(eave + (c.dormerGable ? 0.5 : 1.95)) };
  }
  const slope = (xa, xb, p, q) => face([V(xa, p[0], F + p[1] + 0.08), V(xb, p[0], F + p[1] + 0.08), V(xb, q[0], F + q[1] + 0.08), V(xa, q[0], F + q[1] + 0.08)], col.roof);
  for (let i = 1; i < rp.length; i++) {
    if (!dorm || i < rp.length - 1) {
      slope(-ov, L + ov, rp[i - 1], rp[i]);
      continue;
    }
    slope(-ov, dorm.x0, rp[i - 1], rp[i]);
    slope(dorm.x1, L + ov, rp[i - 1], rp[i]);
    if (dorm.cut > rp[i - 1][0] + 0.05) slope(dorm.x0, dorm.x1, rp[i - 1], [dorm.cut, topAt(dorm.cut)]);
  }

  /* Porch posts and a top rail between them. */
  const posts = sh.posts.map(([x, y]) => [Math.min(Math.max(x, 0.2), L - 0.2), Math.min(Math.max(y, 0.2), W - 0.2)]);
  for (const [x, y] of posts) box(x - 0.17, y - 0.17, x + 0.17, y + 0.17, F, F + topAt(y), col.trim);
  /* Porch railing along the open edges of the deck, with a gap to walk through on the longest edge. */
  if (sh.deck) {
    const near = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < 0.03;
    };
    const open = sh.deck.map((a, i) => [a, sh.deck[(i + 1) % sh.deck.length]]).filter(([a, b]) => !sh.walls.some((w) => near([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w.a, w.b)));
    const longest = open.reduce((m, e) => (Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) > Math.hypot(m[1][0] - m[0][0], m[1][1] - m[0][1]) ? e : m), open[0]);
    for (const e of open) {
      const [a, b] = e, len = Math.hypot(b[0] - a[0], b[1] - a[1]), at = (t) => [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
      const runs = e === longest && len > 7 ? [[0, len / 2 - 2], [len / 2 + 2, len]] : [[0, len]];
      for (const [s0, s1] of runs) {
        for (const [y0, y1] of [[0.3, 0.45], [2.85, 3]]) face([V(...at(s0), F + y0), V(...at(s1), F + y0), V(...at(s1), F + y1), V(...at(s0), F + y1)], col.trim);
        for (let t = s0 + 0.4; t < s1 - 0.1; t += 0.4) lines.push(...V(...at(t), F + 0.45), ...V(...at(t), F + 2.85));
        if (s0 > 0) box(at(s0)[0] - 0.12, at(s0)[1] - 0.12, at(s0)[0] + 0.12, at(s0)[1] + 0.12, F, F + 3.1, col.trim);
        if (s1 < len) box(at(s1)[0] - 0.12, at(s1)[1] - 0.12, at(s1)[0] + 0.12, at(s1)[1] + 0.12, F, F + 3.1, col.trim);
      }
    }
  }

  /* Dormer on the right roof slope, centered over the dormer doors. */
  if (dorm) {
    const { len, x0, x1, back } = dorm, xm = (x0 + x1) / 2;
    const up = (height) => F + height + 0.12;
    if (c.dormerGable) {
      const knee = eave + 0.5, peak = Math.max(...prof.map((p) => p[1])) - 0.1, yk = back(knee), yp = back(peak);
      face([V(x0, W, F + eave), V(x1, W, F + eave), V(x1, W, F + knee), V(xm, W, F + peak), V(x0, W, F + knee)], col.body);
      for (const x of [x0, x1]) face([V(x, W, F + eave), V(x, W, F + knee), V(x, yk, F + knee)], col.body);
      for (const [xe, out] of [[x0, -0.4], [x1, 0.4]]) face([V(xe + out, W + ov, up(knee) - 0.2), V(xm, W + ov, up(peak)), V(xm, yp, up(peak)), V(xe + out, yk, up(knee) - 0.2)], col.roof);
    } else {
      const front = eave + 1.6, yb = back(front + 0.35), count = len >= 12 ? 4 : 3, tw = 1.9, gap = (len - count * tw) / (count + 1);
      face([V(x0, W, F + eave), V(x1, W, F + eave), V(x1, W, F + front), V(x0, W, F + front)], col.body);
      for (const x of [x0, x1]) face([V(x, W, F + eave), V(x, W, F + front), V(x, yb, F + topAt(yb))], col.body);
      face([V(x0 - 0.4, W + ov, up(front) - 0.06), V(x1 + 0.4, W + ov, up(front) - 0.06), V(x1 + 0.4, yb, up(front + 0.35)), V(x0 - 0.4, yb, up(front + 0.35))], col.roof);
      /* The row of transom windows across the front of the dormer. */
      for (let i = 0; i < count; i++) {
        const a = x0 + gap * (i + 1) + tw * i, pane = (x, y0, y1, d, hex) => face([V(a - x, W + d, F + eave + y0), V(a + tw + x, W + d, F + eave + y0), V(a + tw + x, W + d, F + eave + y1), V(a - x, W + d, F + eave + y1)], hex);
        pane(0.12, 0.3, 1.3, 0.05, col.trim);
        pane(0, 0.42, 1.18, 0.09, col.glass);
      }
    }
  }

  const high = Math.max(...prof.map((p) => p[1])) + F;
  return {
    pos: new Float32Array(pos), nor: new Float32Array(nor), rgb: new Float32Array(rgb), lines: new Float32Array(lines), soft: new Float32Array(soft), softC: new Float32Array(softC),
    center: [L / 2, high * 0.45, W / 2], radius: 0.5 * Math.hypot(L + 2, W + 2, high),
    labels: [[sh.sides.left, [-2.2, 0, W / 2]], [sh.sides.right, [L + 2.2, 0, W / 2]], [sh.sides.top, [L / 2, 0, -2.2]], [sh.sides.bottom, [L / 2, 0, W + 2.2]]],
  };
}

/* ---------- Drawing ---------- */
function p3Gl() {
  if (P3.gl) return P3.gl;
  const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uM;varying vec3 vN;varying vec3 vC;void main(){vN=aN;vC=aC;gl_Position=uM*vec4(aP,1.0);}'));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 vN;varying vec3 vC;uniform float uLine;void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;float d=max(dot(n,normalize(vec3(-0.45,0.8,0.4))),0.0);vec3 c=vC*(0.62+0.38*d);gl_FragColor=vec4(mix(c,vec3(0.07,0.10,0.14),uLine),1.0);}'));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  P3.gl = { gl, canvas, prog, buf: { p: gl.createBuffer(), n: gl.createBuffer(), c: gl.createBuffer(), l: gl.createBuffer(), s: gl.createBuffer(), sc: gl.createBuffer() } };
  return P3.gl;
}
function p3Draw(el) {
  const view = P3.views[el.id], G = p3Gl();
  if (!view || !G) return;
  const key = JSON.stringify(view.c);
  if (view.key !== key) {
    try {
      view.mesh = p3Mesh(view.c);
    } catch (e) {
      view.mesh = null;
    }
    view.key = key;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(2, Math.round(el.clientWidth * dpr)), h = Math.max(2, Math.round(el.clientHeight * dpr));
  if (el.width !== w || el.height !== h) (el.width = w), (el.height = h);
  const ctx = el.getContext('2d'), m = view.mesh;
  ctx.clearRect(0, 0, w, h);
  if (!m) return;
  const ang = (P3.angles[view.slot] ||= { yaw: -0.72, pitch: 0.4 });
  const dist = (m.radius / Math.sin((14 * Math.PI) / 180)) * Math.max(1, h / w) * (w / h > 2 ? 0.7 : w / h > 1.5 ? 0.82 : 0.98);
  const eye = [m.center[0] + dist * Math.cos(ang.pitch) * Math.sin(ang.yaw), m.center[1] + dist * Math.sin(ang.pitch), m.center[2] + dist * Math.cos(ang.pitch) * Math.cos(ang.yaw)];
  const M = p3Camera(eye, m.center, w / h), { gl, canvas, prog, buf } = G;
  if (canvas.width !== w || canvas.height !== h) (canvas.width = w), (canvas.height = h);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uM'), false, new Float32Array(M));
  const bind = (name, buffer, data) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    return loc;
  };
  bind('aP', buf.p, m.pos);
  const nLoc = bind('aN', buf.n, m.nor), cLoc = bind('aC', buf.c, m.rgb);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  gl.uniform1f(gl.getUniformLocation(prog, 'uLine'), 0);
  gl.drawArrays(gl.TRIANGLES, 0, m.pos.length / 3);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  /* Faint lines first (grooves, ribs), then the dark outlines. */
  gl.disableVertexAttribArray(nLoc);
  gl.vertexAttrib3f(nLoc, 0, -1, 0);
  if (m.soft.length) {
    bind('aP', buf.s, m.soft);
    bind('aC', buf.sc, m.softC);
    gl.uniform1f(gl.getUniformLocation(prog, 'uLine'), 0.3);
    gl.drawArrays(gl.LINES, 0, m.soft.length / 3);
  }
  bind('aP', buf.l, m.lines);
  gl.disableVertexAttribArray(nLoc);
  gl.disableVertexAttribArray(cLoc);
  gl.vertexAttrib3f(nLoc, 0, 1, 0);
  gl.vertexAttrib3f(cLoc, 0, 0, 0);
  gl.uniform1f(gl.getUniformLocation(prog, 'uLine'), 1);
  gl.drawArrays(gl.LINES, 0, m.lines.length / 3);
  ctx.drawImage(canvas, 0, 0);
  /* Side names on the ground, so front and back are never in doubt. */
  ctx.font = `700 ${Math.round(11 * dpr)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#566879';
  /* Only the two sides facing the viewer are named; the far ones would print over the building. */
  const near = [...m.labels].sort((a, b) => Math.hypot(...p3Sub(a[1], eye)) - Math.hypot(...p3Sub(b[1], eye))).slice(0, 2);
  for (const [text, p] of near) {
    const cw = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    if (cw <= 0) continue;
    const x = ((M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / cw) * 0.5 + 0.5, y = 0.5 - ((M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / cw) * 0.5;
    ctx.fillText(text, Math.min(Math.max(x * w, 40 * dpr), w - 40 * dpr), Math.min(Math.max(y * h, 14 * dpr), h - 6 * dpr));
  }
}
/* Draw every view on the page that is new, resized or whose order changed. */
function p3Paint(force = false) {
  const live = new Set();
  for (const el of document.querySelectorAll('canvas.p3d')) {
    const view = P3.views[el.id];
    if (!view) continue;
    live.add(el.id);
    const stamp = JSON.stringify(view.c) + el.clientWidth + 'x' + el.clientHeight;
    if (!force && view.stamp === stamp) continue;
    view.stamp = stamp;
    if (!view.wired) {
      view.wired = true;
      let last = null;
      el.onpointerdown = (e) => {
        last = [e.clientX, e.clientY];
        el.setPointerCapture(e.pointerId);
      };
      el.onpointermove = (e) => {
        if (!last) return;
        const a = (P3.angles[view.slot] ||= { yaw: -0.72, pitch: 0.4 });
        a.yaw -= (e.clientX - last[0]) * 0.01;
        if (e.pointerType === 'mouse') a.pitch = Math.min(1.45, Math.max(0.05, a.pitch + (e.clientY - last[1]) * 0.01));
        last = [e.clientX, e.clientY];
        p3Draw(el);
      };
      el.onpointerup = el.onpointercancel = () => (last = null);
    }
    p3Draw(el);
  }
  for (const id of Object.keys(P3.views)) if (!live.has(id)) delete P3.views[id];
}
/* A 3D view for an order. `slot` keeps the viewing angle when the page redraws. */
function p3dMarkup(c, slot = 'stage') {
  const id = 'p3d' + ++P3.seq;
  P3.views[id] = { c, slot };
  return `<canvas class="p3d" id="${id}" aria-label="3D view of the building, drawn from the floor plan"></canvas>`;
}
function p3Top(slot) {
  const a = (P3.angles[slot] ||= { yaw: -0.72, pitch: 0.4 });
  a.pitch = a.pitch > 1.2 ? 0.4 : 1.45;
  p3Paint(true);
}
setInterval(() => document.querySelector('canvas.p3d') && p3Paint(), 400);

/* ---------- Where the 3D view shows ---------- */
{
  /* The large model on a page is now drawn from the floor plan. Small thumbnails keep the old models. */
  const oldModel = modelMarkup;
  modelMarkup = function (c, small = false, interactive = !small) {
    if (small || !interactive || !c || !c.size || !p3Gl()) return oldModel(c, small, interactive);
    return `<div class="reference-model p3d-box">${p3dMarkup(c, 'stage')}<div class="p3d-bar"><span>Drawn from the floor plan · drag to turn</span><button type="button" class="chipbtn" onclick="p3Top('stage')">Top / angle</button></div></div>`;
  };
  /* In the floor plan editor the 3D view sits under the plan and follows every move. */
  const oldEditor = bsEditor;
  bsEditor = function (o) {
    return oldEditor(o).replace(/<\/div>\s*$/, `<div class="p3d-ed"><div class="p3d-edhead"><strong>3D view</strong><span>Follows the floor plan as you move things</span><button type="button" class="chipbtn" onclick="p3Top('editor')">Top / angle</button></div>${p3dMarkup(o.c, 'editor')}</div></div>`);
  };
  const oldRefresh = bsEdRefresh;
  bsEdRefresh = function () {
    oldRefresh();
    p3Paint();
  };
}
