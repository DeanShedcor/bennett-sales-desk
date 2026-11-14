/* plan3d.js: a simple 3D view of the building, drawn from the same floor plan as the build
   sheet (buildsheet.js). Nothing is loaded from a model file: walls, roof, porch, doors and
   windows are built from the order, so moving an item on the 2D plan moves it here too.

   Drawn to look like the real thing: sunlight and shadows, siding, roofing, glass and grass
   are all painted by the shader. Drag to turn.
   One hidden WebGL canvas does the drawing and each view on the page is a copy of its picture,
   so any number of views can be shown. Loaded last. */

const P3 = { views: {}, angles: { editor: { yaw: -0.72, pitch: 0.95 } }, inside: { editor: true }, zoom: {}, seq: 0, gl: null };

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
  const t = 1 / Math.tan((28 * Math.PI) / 360), near = 2, far = 2600;
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  return p3Mul(proj, view);
}
/* How light a color is (0 dark to 1 light), and a color made darker or lighter by a factor. */
const p3Lum = (hex) => p3Hex(hex).reduce((t, v, i) => t + v * [0.3, 0.59, 0.11][i], 0);
const p3Shade = (hex, k) => '#' + p3Hex(hex).map((v) => Math.round(Math.min(1, v * k) * 255).toString(16).padStart(2, '0')).join('');
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
    doorTrim: paints[c.doorTrimColor] || trim,
    roof: c.style === 'Greenhouse' ? '#dfeef2' : c.roof === 'Shingles' ? '#4a4d50' : metalRoofColors[c.roofColor] || metalRoofColors.Charcoal,
    glass: '#a9d4ea', floor: '#8a7158', deck: '#7b7b7c', skid: '#cdbf98',
  };
}
/* Height of the top of the walls and roof across the width (plan y), measured from the floor. */
function p3Profile(c, W) {
  const h = Number(c.wallHeight) || (c.style === 'Low-Wall Barn' ? 5 : c.style === 'Lofted' ? 6 : 7);
  if (c.style === 'Studio') return [[0, h], [W, h + 2]];
  /* Lofted, from the engineer drawing: 6 ft sidewalls and the peak 11'-8" above the floor on a 16-wide,
     so the roof rises 5'-8" (0.354 of the width), scaled to other widths. */
  if (c.style === 'Lofted') return [[0, h], [W * 0.2, h + W * 0.2504], [W / 2, h + W * (17 / 48)], [W * 0.8, h + W * 0.2504], [W, h]];
  if (c.style === 'Low-Wall Barn') return [[0, h], [W * 0.2, h + W * 0.205], [W / 2, h + W * 0.29], [W * 0.8, h + W * 0.205], [W, h]];
  /* 5 in 12 roof pitch, from the engineer drawings. */
  return [[0, h], [W / 2, h + (W / 2) * (5 / 12)], [W, h]];
}
/* `inside` leaves the roof off and shows the framing: studs, plates, headers, rafters and the electrical. */
function p3Mesh(c, inside = false, yaw = 0) {
  /* The building sits on concrete blocks (BLK high) under its skids; F is the floor, above skids and frame. */
  const lay = bsLayout(c), sh = lay.sh, { L, W } = sh, col = p3Colors(c), BLK = 0.33, F = BLK + 0.6;
  const prof = p3Profile(c, W), eave = prof[0][1];
  /* A letter after a color names its surface, so the shader can draw siding, roofing, glass, decking or grass. */
  {
    const same = col.door === col.body, bare = (hex) => /^#a7a9a7/i.test(hex);
    /* Bare Galvalume (siding or roof) shines like metal; painted steel is glossy paint. */
    col.body += (c.style === 'Silver Bullet' || c.siding === 'Metal') && bare(col.body) ? 'M' : 'b';
    /* The door panel is siding too, whatever its color. */
    col.door = same ? col.body : col.door + 'b';
    col.roof += c.style === 'Greenhouse' ? 'q' : c.roof !== 'Shingles' && bare(col.roof) ? 'M' : 'r';
    col.glass += 'g';
    col.deck += 'd';
    col.accent = typeof usesWoodOptions === 'function' && usesWoodOptions(c) && c.accentColor && ({ ...paintColors, ...stainColors }[c.accentColor] || null);
    if (col.accent) col.accent += 'b';
  }
  const topAt = (y) => {
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][0] + 1e-9) return prof[i - 1][1] + ((prof[i][1] - prof[i - 1][1]) * (y - prof[i - 1][0])) / (prof[i][0] - prof[i - 1][0]);
    return prof[prof.length - 1][1];
  };
  const pos = [], nor = [], rgb = [], mat = [], lines = [], edges = [];
  const metal = c.style === 'Silver Bullet' || c.siding === 'Metal';
  /* Surface kinds: 0 paint, 1 grooved wood siding, 2 lap siding, 3 ribbed painted steel, 4 shingles, 5 glass, 6 deck boards,
     7 grass, 8 diamond tread plate, 9 OSB sheathing, 10 lumber grain upright, 11 bead-board ceiling, 12 concrete,
     13 clear corrugated roof, 14 bare Galvalume, 15 lumber grain lengthwise. */
  const kinds = { b: metal ? 3 : c.siding === 'Lap' ? 2 : 1, r: c.roof === 'Shingles' ? 4 : 3, g: 5, d: 6, G: 7, p: 8, o: 9, w: 10, c: 11, k: 12, q: 13, M: 14, h: 15 };
  const V = (x, y, up) => [x, up, y];
  /* A flat, convex face given as 3D points; outlined unless told otherwise. */
  let hide = false;
  const face = (pts, hex, outline = true, tris = null) => {
    if (hide) return;
    const n = p3Norm(p3Cross(p3Sub(pts[1], pts[0]), p3Sub(pts[2], pts[0]))), k = p3Hex(hex);
    const order = tris || Array.from({ length: pts.length - 2 }, (_, i) => [0, i + 1, i + 2]).flat();
    for (const i of order) pos.push(...pts[i]), nor.push(...n), rgb.push(...k), mat.push(kinds[hex[7]] || 0);
    if (outline) pts.forEach((p, i) => edges.push(...p, ...pts[(i + 1) % pts.length]));
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
    q.forEach((a) => edges.push(...V(a[0], a[1], lo), ...V(a[0], a[1], hi)));
  };

  /* Accent siding, over the plain wall: the gable above the eave, or the lower 3 ft with a trim board on top
     (two-tone). The wall is cut at that height and the accent part laid just proud of it. */
  const LOWER = 3;
  const cut = (pts, h, above) => {
    const out = [], inn = (p) => (above ? p[1] >= h : p[1] <= h);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      if (inn(p)) out.push(p);
      if (inn(p) !== inn(q)) {
        const t = (h - p[1]) / (q[1] - p[1]);
        out.push([p[0] + (q[0] - p[0]) * t, h, p[2] + (q[2] - p[2]) * t]);
      }
    });
    /* Drop repeated points, so the face's lighting direction is worked out from three distinct corners. */
    return out.filter((p, i) => Math.hypot(...p3Sub(p, out[(i + out.length - 1) % out.length])) > 1e-6);
  };
  const accent = (pts, n) => {
    if (!col.accent) return;
    const lower = c.accentArea === 'lower', part = cut(pts, F + (lower ? LOWER : eave), !lower), o = 0.004;
    if (part.length >= 3 && !hide) face(part.map((p) => [p[0] - n[0] * o, p[1], p[2] - n[1] * o]), col.accent, false);
    if (lower && !hide) {
      const band = cut(cut(pts, F + LOWER - 0.15, true), F + LOWER + 0.15, false);
      if (band.length >= 3) face(band.map((p) => [p[0] - n[0] * 0.03, p[1], p[2] - n[1] * 0.03]), col.trim);
    }
  };

  /* The ground the building sits on. */
  face([V(-1200, -1200, 0), V(-1200, 1200, 0), V(1200, 1200, 0), V(1200, -1200, 0)], '#6e8f4bG', false);
  /* Floor, porch deck and the frame they sit on. */
  flat(sh.poly, F, col.floor);
  /* The floor frame is painted with the siding and sits on two skids, each set on 4 in concrete blocks at the
     ends and about every 6 ft. */
  const rim = col.body.slice(0, 7);
  band(sh.poly, BLK + 0.3, F, rim);
  for (const y of [W * 0.2, W * 0.8]) {
    box(0.1, y - 0.15, L - 0.1, y + 0.15, BLK, BLK + 0.3, col.skid + 'h');
    const n = Math.max(1, Math.ceil((L - 1.1) / 6));
    for (let i = 0; i <= n; i++) {
      const x = 0.55 + (i * (L - 1.1)) / n;
      box(x - 0.62, y - 0.34, x + 0.62, y + 0.34, 0, BLK, '#a3a19bk');
    }
  }
  if (sh.deck) {
    flat(sh.deck, F, col.deck);
    band(sh.deck, BLK + 0.3, F, rim);
  }

  /* Walls rise to the roof line, so end walls carry their own gable. */
  for (const w of sh.walls) {
    const [ax, ay] = w.a, [bx, by] = w.b, top = [];
    const at = (y) => (Math.abs(by - ay) < 1e-9 ? null : [ax + ((bx - ax) * (y - ay)) / (by - ay), y]);
    const mids = prof.map((p) => p[0]).filter((y) => y > Math.min(ay, by) + 1e-6 && y < Math.max(ay, by) - 1e-6).sort((p, q) => (by > ay ? q - p : p - q));
    top.push(V(bx, by, F + topAt(by)), ...mids.map((y) => V(at(y)[0], y, F + topAt(y))), V(ax, ay, F + topAt(ay)));
    /* Inside view: a wall that faces the viewer is left as open framing, so the inside is never hidden. */
    const open = inside && -(bsWallGeo(sh, w).n[0] * Math.sin(yaw) + bsWallGeo(sh, w).n[1] * Math.cos(yaw)) > 0.25;
    hide = open;
    face([V(ax, ay, F), V(bx, by, F), ...top], col.body);
    accent([V(ax, ay, F), V(bx, by, F), ...top], bsWallGeo(sh, w).n);

    /* Doors and windows sit just proud of the wall on both faces. */
    const geo = bsWallGeo(sh, w), wallTop = Math.min(topAt(ay), topAt(by));
    if (inside) {
      hide = false;
      const wood = '#e2c8a0h', stud = '#e2c8a0w';
      /* A box against the inside of this wall: centered at `t` along it, from `d0` to `d1` off the wall. */
      const obox = (t, half, d0, d1, lo, hi, hex) => {
        const p = geo.at(t), cx = p[0] + (geo.n[0] * (d0 + d1)) / 2, cy = p[1] + (geo.n[1] * (d0 + d1)) / 2;
        const hx = Math.abs(geo.d[0]) * half + (Math.abs(geo.n[0]) * (d1 - d0)) / 2, hy = Math.abs(geo.d[1]) * half + (Math.abs(geo.n[1]) * (d1 - d0)) / 2;
        box(cx - hx, cy - hy, cx + hx, cy + hy, F + lo, F + hi, hex);
      };
      /* The back of the siding, then plates, studs at 16 in on center and a header over each opening. */
      if (!open) face([V(ax, ay, F), V(bx, by, F), ...top].map((p) => [p[0] + geo.n[0] * 0.02, p[1], p[2] + geo.n[1] * 0.02]), '#c4a06ao', false);
      obox(w.len / 2, w.len / 2, 0.02, 0.31, 0, 0.125, wood);
      obox(w.len / 2, w.len / 2, 0.02, 0.31, wallTop - 0.25, wallTop, wood);
      for (const s of bsStuds(sh, w, lay.items)) obox(s.x, 0.0625, 0.02, 0.31, 0.125, topAt(geo.at(s.x)[1]) - 0.02, stud);
      for (const it of lay.items.filter((x) => x.wi === w.i)) {
        if (it.w && !it.high) {
          const hi = Math.min(it.kind === 'door' ? (/roll/i.test(it.name) ? 7 : 6.67) : 6.2, wallTop - 0.15) + 0.17;
          if (wallTop - 0.25 - hi > 0.1) obox(it.at + it.w / 2, it.w / 2 + 0.125, 0.02, 0.31, hi, Math.min(hi + 0.46, wallTop - 0.25), wood);
        }
        if (it.kind === 'outlet' || it.kind === 'switch') {
          /* As built: a white cover plate on a box beside its stud (outlets 18 in off the floor, switches 48 in),
             and the white cable running up beside the stud to the top plate. */
          const side = it.at + 0.4 < w.len ? 1 : -1, t = it.at + side * 0.18, up = it.kind === 'outlet' ? 1.5 : 4, plate = '#f3f2ee';
          const front = (t0, t1, y0, y1, hex) => {
            const p = geo.at(t0), q = geo.at(t1), d = 0.205;
            face([V(p[0] + geo.n[0] * d, p[1] + geo.n[1] * d, F + y0), V(q[0] + geo.n[0] * d, q[1] + geo.n[1] * d, F + y0), V(q[0] + geo.n[0] * d, q[1] + geo.n[1] * d, F + y1), V(p[0] + geo.n[0] * d, p[1] + geo.n[1] * d, F + y1)], hex, false);
          };
          obox(t, 0.115, 0.02, 0.2, up - 0.19, up + 0.19, plate);
          if (it.kind === 'outlet') {
            for (const y of [up + 0.085, up - 0.085]) {
              front(t - 0.065, t + 0.065, y - 0.055, y + 0.055, '#e9e7e0');
              for (const k of [-0.03, 0.03]) front(t + k - 0.006, t + k + 0.006, y - 0.002, y + 0.035, '#2b2b2b');
              front(t - 0.01, t + 0.01, y - 0.04, y - 0.018, '#2b2b2b');
            }
          } else {
            front(t - 0.03, t + 0.03, up - 0.06, up + 0.06, '#d9d7d0');
            obox(t, 0.018, 0.2, 0.25, up - 0.02, up + 0.05, plate);
          }
          obox(it.at + side * 0.085, 0.012, 0.03, 0.06, up + 0.19, wallTop - 0.25, plate);
        }
      }
      hide = open;
    }
    for (const it of lay.items.filter((x) => x.wi === w.i && x.w)) {
      const door = it.kind === 'door', roll = /roll/i.test(it.name), house = /lite|fiberglass/i.test(it.name), glassTop = /transom/i.test(it.name);
      const tall = Number((it.name.match(/×(\d+)/) || [])[1]) || 3;
      let hi = door ? (roll ? 7 : 6.67) : 6.5, lo = 0;
      if (it.high) (lo = eave + 0.42), (hi = eave + 1.42);
      else if (door) hi = Math.min(hi, wallTop - 0.5);
      else (hi = Math.min(hi, wallTop - 0.5)), (lo = Math.max(1.5, hi - tall));
      const a0 = it.at, a1 = it.at + it.w, black = '#17191c', white = '#f4f4f1', silver = '#c9cdd2', c3 = 0.29;
      const frame = col.doorTrim, darkFrame = p3Lum(frame) < 0.4;
      for (const side of [-1, 1]) {
        const off = (t, d) => {
          const q = geo.at(t);
          return [q[0] + geo.n[0] * d * side, q[1] + geo.n[1] * d * side];
        };
        const quad = (ta, tb, y0, y1, d, hex, outline = true) => face([V(...off(ta, d), F + y0), V(...off(tb, d), F + y0), V(...off(tb, d), F + y1), V(...off(ta, d), F + y1)], hex, outline);
        const seg = (ta, ya, tb, yb, d) => lines.push(...V(...off(ta, d), F + ya), ...V(...off(tb, d), F + yb));
        /* A flat shape on the wall, from [along the wall, height] points (convex). */
        const poly = (pts, d, hex, outline = false) => face(pts.map(([t, y]) => V(...off(t, d), F + y)), hex, outline);
        /* A small round part (knob, lock, screw head). */
        const dot = (t, y, r, d, hex) => poly(Array.from({ length: 8 }, (_, i) => [t + r * Math.cos(((i + 0.5) * Math.PI) / 4), y + r * Math.sin(((i + 0.5) * Math.PI) / 4)]), d, hex);
        const out = side === -1;
        /* Casing, as built: a board each side (at a door it runs down over the floor frame), a header with
           beveled ends (a door also gets a cap board on top), and under a window a sill that flares out at the bottom. */
        const foot = door ? lo - 0.3 : lo;
        quad(a0 - c3, a0, foot, hi, 0.07, col.trim);
        quad(a1, a1 + c3, foot, hi, 0.07, col.trim);
        if (door) {
          quad(a0 - c3 - 0.04, a1 + c3 + 0.04, hi, hi + 0.3, 0.08, col.trim);
          if (out) poly([[a0 - c3 - 0.09, hi + 0.3], [a1 + c3 + 0.09, hi + 0.3], [a1 + c3 + 0.19, hi + 0.42], [a0 - c3 - 0.19, hi + 0.42]], 0.12, col.trim, true);
        } else {
          /* A transom, as built: a flat board over it and one under it, each running past the side boards. */
          if (it.high) for (const y of [hi, lo - 0.27]) quad(a0 - c3 - 0.13, a1 + c3 + 0.13, y, y + 0.27, 0.09, col.trim);
          else poly([[a0 - c3, hi], [a1 + c3, hi], [a1 + c3 + 0.16, hi + 0.38], [a0 - c3 - 0.16, hi + 0.38]], 0.09, col.trim, true);
          if (!it.high) poly([[a0 - c3 - 0.17, lo - 0.3], [a1 + c3 + 0.17, lo - 0.3], [a1 + c3 + 0.03, lo], [a0 - c3 - 0.03, lo]], 0.1, col.trim, true);
        }
        if (!door) {
          quad(a0, a1, lo, hi, 0.06, white);
          if (it.high) {
            /* White vinyl frame, one row of five upright panes. */
            const fw = 0.085, gw = it.w - 2 * fw, n = Math.max(3, Math.round(it.w / 0.48));
            quad(a0 + fw, a1 - fw, lo + fw, hi - fw, 0.09, col.glass);
            for (let k = 1; k < n; k++) quad(a0 + fw + (gw * k) / n - 0.016, a0 + fw + (gw * k) / n + 0.016, lo + fw, hi - fw, 0.1, white, false);
          } else {
            /* Single-hung window, as built: a 2 by 2 grid in each sash and a thick meeting rail; outside, a
               screen covers the lower sash and its grid shows through it. */
            const mid = (lo + hi) / 2, m = (a0 + a1) / 2;
            for (const [y0, y1, low] of [[lo + 0.09, mid - 0.04, true], [mid + 0.04, hi - 0.09, false]]) {
              const screen = low && out, bar = screen ? '#c4c7cb' : white;
              quad(a0 + 0.09, a1 - 0.09, y0, y1, 0.09, screen ? '#5a5f65' : col.glass);
              quad(m - 0.022, m + 0.022, y0, y1, 0.1, bar, false);
              quad(a0 + 0.09, a1 - 0.09, (y0 + y1) / 2 - 0.022, (y0 + y1) / 2 + 0.022, 0.1, bar, false);
            }
            quad(a0 + 0.05, a1 - 0.05, mid - 0.05, mid + 0.06, 0.11, white, false);
            /* Shutters, as built: three boards with gaps, held by three battens that run past the boards a little. */
            if (out && (/shutter/i.test(it.note || '') || c.shutters)) for (const s0 of [a0 - c3 - 0.07 - 1, a1 + c3 + 0.07]) {
              for (let i = 0; i < 3; i++) quad(s0 + i * 0.355, s0 + i * 0.355 + 0.29, lo + 0.02, hi - 0.02, 0.06, col.trim);
              for (const y of [hi - 0.52, (lo + hi) / 2 - 0.15, lo + 0.2]) quad(s0 - 0.015, s0 + 1.015, y, y + 0.3, 0.1, col.trim);
            }
          }
        } else if (roll) {
          quad(a0, a1, lo, hi, 0.06, white);
          for (let y = lo + 0.6; y < hi; y += 0.6) seg(a0, y, a1, y, 0.07);
        } else if (house) {
          quad(a0, a1, lo, hi, 0.06, white);
          const leaves = it.w >= 5 ? 2 : 1, lw = it.w / leaves;
          for (let i = 0; i < leaves; i++) {
            const la = a0 + i * lw + 0.45, lb = a0 + (i + 1) * lw - 0.45, y0 = lo + 3.3, y1 = hi - 0.5;
            quad(la, lb, y0, y1, 0.09, col.glass);
            for (const k of [1 / 3, 2 / 3]) seg(la + (lb - la) * k, y0, la + (lb - la) * k, y1, 0.1), seg(la, y0 + (y1 - y0) * k, lb, y0 + (y1 - y0) * k, 0.1);
          }
          if (leaves === 2) seg(a0 + lw, lo, a0 + lw, hi, 0.07);
        } else {
          /* Shed door, as built: a siding panel; a frame, middle rail and (with a transom) a rail under a row of
             glass on each leaf, in the door trim color; three black T-strap hinges per leaf; a black T-handle
             with a lock; a foot bolt on the bottom rail; a center strip on a double door; and a diamond tread
             plate across the sill. */
          quad(a0, a1, lo, hi, 0.06, col.door);
          const leaves = it.w >= 5 ? 2 : 1, lw = it.w / leaves, rail = 0.44 * hi;
          for (let i = 0; i < leaves; i++) {
            const la = a0 + i * lw, lb = la + lw, top = hi - c3 - 1.05;
            const bars = [[la, la + c3, lo, hi], [lb - c3, lb, lo, hi], [la, lb, hi - c3, hi], [la, lb, lo, lo + c3], [la, lb, rail, rail + c3]];
            if (glassTop) bars.push([la, lb, top - c3, top]);
            for (const [ta, tb, y0, y1] of bars) quad(ta, tb, y0, y1, 0.1, frame);
            if (glassTop) {
              quad(la + c3, lb - c3, top, hi - c3, 0.09, col.glass);
              const n = leaves === 2 ? 5 : 7, mun = darkFrame ? '#26282c' : white;
              for (let k = 1; k < n; k++) quad(la + c3 + ((lw - 2 * c3) * k) / n - 0.02, la + c3 + ((lw - 2 * c3) * k) / n + 0.02, top, hi - c3, 0.11, mun, false);
            }
            if (!out) continue;
            const edge = leaves === 2 && i === 1 ? lb : la, dir = edge === la ? 1 : -1, at = (u) => edge + dir * u;
            for (const y of [hi - c3 / 2, rail + c3 / 2, lo + c3 / 2]) {
              /* T-strap hinge: a leaf on the casing, the barrel at the gap, and a strap that tapers to a point along the rail. */
              poly([[at(-0.03), y - 0.16], [at(-0.2), y - 0.16], [at(-0.235), y - 0.12], [at(-0.235), y + 0.12], [at(-0.2), y + 0.16], [at(-0.03), y + 0.16]], 0.12, black);
              poly([[at(0), y - 0.1], [at(0.2), y - 0.1], [at(0.2), y + 0.1], [at(0), y + 0.1]], 0.14, black);
              poly([[at(0.2), y - 0.075], [at(0.86), y - 0.03], [at(0.93), y], [at(0.86), y + 0.03], [at(0.2), y + 0.075]], 0.14, black);
              quad(at(-0.04), at(0.04), y - 0.17, y + 0.17, 0.16, '#2c2f34', false);
              for (const k of [-0.06, 0.06]) quad(at(-0.04), at(0.04), y + k - 0.007, y + k + 0.007, 0.165, '#5b5f66', false);
              for (const [u, v] of [[0.33, 0], [0.56, 0], [0.76, 0], [0.1, 0.05], [0.1, -0.05], [-0.13, 0.09], [-0.13, -0.09]]) dot(at(u), y + v, 0.02, 0.15, '#3c3f45');
            }
            if (leaves === 1 || i === 1) {
              /* T-handle on the latch stile at the middle rail, with the lock in its center. */
              const h = leaves === 1 ? lb - c3 / 2 : la + c3 / 2, y = rail + c3 / 2 + 0.05;
              poly([[h, y + 0.2], [h + 0.04, y + 0.13], [h + 0.05, y + 0.02], [h + 0.035, y - 0.14], [h, y - 0.2], [h - 0.035, y - 0.14], [h - 0.05, y + 0.02], [h - 0.04, y + 0.13]], 0.15, black);
              dot(h, y - 0.01, 0.03, 0.16, silver);
            }
            dot(la + lw / 2, lo + c3 / 2, 0.045, 0.13, silver);
          }
          if (leaves === 2) {
            seg(a0 + lw, lo, a0 + lw, hi, 0.11);
            if (out) quad(a0 + lw - 0.06, a0 + lw + 0.06, lo, hi, 0.115, col.door);
          }
          if (out) quad(a0, a1, lo - 0.12, lo + 0.02, 0.13, '#c5cacep', false);
        }
      }
    }
    /* Studio, as built: a trim band across the front wall, running between the transoms' side boards, and a
       level band along each end wall just under the low eave. */
    if (sh.studio && Math.abs(geo.n[0]) + Math.abs(geo.n[1]) > 0) {
      const strip = (t0, t1, y0, y1) => {
        const p = geo.at(t0), q = geo.at(t1), d = -0.065;
        face([V(p[0] + geo.n[0] * d, p[1] + geo.n[1] * d, F + y0), V(q[0] + geo.n[0] * d, q[1] + geo.n[1] * d, F + y0), V(q[0] + geo.n[0] * d, q[1] + geo.n[1] * d, F + y1), V(p[0] + geo.n[0] * d, p[1] + geo.n[1] * d, F + y1)], col.trim);
      };
      const highs = lay.items.filter((x) => x.wi === w.i && x.high).sort((p, q) => p.at - q.at);
      if (highs.length) {
        let t = 0.16;
        for (const [g0, g1] of [...highs.map((x) => [x.at - 0.29, x.at + x.w + 0.29]), [w.len - 0.16, w.len]]) {
          if (g0 > t + 0.05) strip(t, g0, eave + 0.6, eave + 0.89);
          t = g1;
        }
      } else if (Math.abs(topAt(ay) - topAt(by)) > 0.5) strip(0.16, w.len - 0.16, eave - 0.36, eave - 0.07);
    }
  }
  hide = false;
  /* Where an end of the building is open (a porch), close the gable above the eave. */
  for (const x of [0, L]) {
    const covered = sh.walls.filter((w) => Math.abs(w.a[0] - x) < 1e-6 && Math.abs(w.b[0] - x) < 1e-6).reduce((s, w) => s + w.len, 0);
    if (covered > W - 0.01) continue;
    const low = Math.min(...prof.map((p) => p[1]));
    const pts = [...prof.filter((p) => p[1] > low + 1e-6 || p[0] === 0 || p[0] === W).map((p) => V(x, p[0], F + p[1]))];
    if (prof[0][1] > low + 1e-6) pts.unshift(V(x, 0, F + low));
    if (prof[prof.length - 1][1] > low + 1e-6) pts.push(V(x, W, F + low));
    if (pts.length >= 3) face(pts, c.accentArea === 'lower' || !col.accent ? col.body : col.accent);
  }
  /* Corner boards, and a vent high in each gable end. */
  for (const [x, y] of sh.poly) box(x - 0.16, y - 0.16, x + 0.16, y + 0.16, F, F + topAt(y) - 0.02, col.trim);
  const peak = Math.max(...prof.map((p) => p[1]));
  let seam = 7.7;
  if (!inside && c.style !== 'Studio' && c.style !== 'Greenhouse' && peak - eave > 1.7) {
    /* Gable vent, as built: a 14 x 18 in plate with an arched top in the trim color, set high and centered
       under the peak, with a 9 x 11 1/2 in louvered opening: four slanted blades, each with four groups of slots. */
    const k = Math.min(1, (peak - eave - 0.4) / 2), vw = 0.583 * k, vh = 1.5 * k;
    const top = Math.min(peak - 0.62, topAt(W / 2 + vw) - 0.42 + vh * 0.18), v0 = Math.max(eave + 0.15, top - vh);
    const ow = vw * 0.64, oy0 = v0 + vh * 0.15, oy1 = v0 + vh * 0.79, bh = (oy1 - oy0) / 4;
    const slot = p3Lum(col.trim) < 0.3 ? '#7a5838' : '#25282b';
    seam = Math.min(seam, v0 - 0.3);
    /* The plate is a thick frame standing off the wall; the louvers sit back inside its opening, below the
       face of the frame, each blade sloping down and out but still recessed, as on the plant's buildings. */
    const PF = 0.13, BACK = 0.015, reveal = p3Shade(col.trim, 0.82);
    for (const [x, s] of [[0, -1], [L, 1]]) {
      const P = (y, up, d) => V(x + s * d, y, F + up), sq = (y0, y1, u0, u1, d, hex) => face([P(y0, u0, d), P(y1, u0, d), P(y1, u1, d), P(y0, u1, d)], hex, false);
      const archAt = (t) => [W / 2 - t * vw, v0 + vh * (0.82 + 0.18 * (1 - t * t))];
      const arch = Array.from({ length: 13 }, (_, i) => archAt((i / 12) * 2 - 1));
      /* Face of the frame, with the opening left out: a strip each side, one under, and the arched top. */
      sq(W / 2 - vw, W / 2 + vw, v0, oy0, PF, col.trim);
      sq(W / 2 - vw, W / 2 - ow, oy0, oy1, PF, col.trim);
      sq(W / 2 + ow, W / 2 + vw, oy0, oy1, PF, col.trim);
      face([P(W / 2 - vw, oy1, PF), P(W / 2 + vw, oy1, PF), ...arch.map(([y, u]) => P(y, u, PF))], col.trim, false);
      /* Its outside edge, back to the wall. */
      const rim = [[W / 2 - vw, v0], [W / 2 + vw, v0], ...arch];
      rim.forEach((q, i) => {
        const r = rim[(i + 1) % rim.length];
        face([P(q[0], q[1], 0.01), P(r[0], r[1], 0.01), P(r[0], r[1], PF), P(q[0], q[1], PF)], col.trim, false);
      });
      /* Inside the opening: the dark back, the four sides of the recess, then the blades. */
      sq(W / 2 - ow, W / 2 + ow, oy0, oy1, BACK, '#141618');
      face([P(W / 2 - ow, oy1, BACK), P(W / 2 + ow, oy1, BACK), P(W / 2 + ow, oy1, PF), P(W / 2 - ow, oy1, PF)], reveal, false);
      face([P(W / 2 - ow, oy0, BACK), P(W / 2 + ow, oy0, BACK), P(W / 2 + ow, oy0, PF), P(W / 2 - ow, oy0, PF)], reveal, false);
      for (const y of [W / 2 - ow, W / 2 + ow]) face([P(y, oy0, BACK), P(y, oy1, BACK), P(y, oy1, PF), P(y, oy0, PF)], reveal, false);
      for (let i = 0; i < 4; i++) {
        const yt = oy1 - i * bh;
        face([P(W / 2 - ow, yt - 0.01, 0.03), P(W / 2 + ow, yt - 0.01, 0.03), P(W / 2 + ow, yt - bh * 0.5, 0.09), P(W / 2 - ow, yt - bh * 0.5, 0.09)], col.trim, false);
        sq(W / 2 - ow, W / 2 + ow, yt - bh * 0.95, yt - bh * 0.5, 0.09, col.trim);
        const gw = (ow * 2 * 0.9) / 4;
        for (let g = 0; g < 4; g++) for (let j = 0; j < 6; j++) {
          const y = W / 2 - ow * 0.9 + gw * g + gw * (0.16 + j * 0.13);
          sq(y, y + gw * 0.07, yt - bh * 0.88, yt - bh * 0.58, 0.092, slot);
        }
      }
      for (const [dy, du] of [[-0.78, 0.1], [0.78, 0.1], [-0.78, 0.8], [0.78, 0.8]]) sq(W / 2 + dy * vw - 0.02, W / 2 + dy * vw + 0.02, v0 + du * vh - 0.02, v0 + du * vh + 0.02, PF + 0.003, p3Shade(col.trim, 0.7));
    }
  }
  /* Where the gable sheet of siding meets the wall sheet: a horizontal seam with a Z-flashing lip. */
  if (!metal && c.siding !== 'Lap' && c.style !== 'Studio') {
    seam = Math.max(seam, eave + 0.05);
    for (const [x, s] of [[0, -1], [L, 1]]) {
      let ya = null, yb = null;
      for (let y = 0; y <= W + 1e-9; y += W / 400) if (topAt(y) > seam + 0.1) (ya ??= y), (yb = y);
      if (ya != null) face([V(x + s * 0.012, ya, F + seam), V(x + s * 0.012, yb, F + seam), V(x + s * 0.012, yb, F + seam + 0.04), V(x + s * 0.012, ya, F + seam + 0.04)], p3Shade(col.body.slice(0, 7), 0.6), false);
    }
  }

  /* Roof over the whole footprint, porch included, with a small overhang. */
  hide = inside;
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
  /* Each roof slope, with the roof deck under it: from below the overhang shows wood sheathing, not the metal. */
  const slope = (xa, xb, p, q) => {
    face([V(xa, p[0], F + p[1] + 0.08), V(xb, p[0], F + p[1] + 0.08), V(xb, q[0], F + q[1] + 0.08), V(xa, q[0], F + q[1] + 0.08)], col.roof);
    if (c.style !== 'Greenhouse') face([V(xa, p[0], F + p[1] + 0.01), V(xb, p[0], F + p[1] + 0.01), V(xb, q[0], F + q[1] + 0.01), V(xa, q[0], F + q[1] + 0.01)], '#b99d70o', false);
  };
  for (let i = 1; i < rp.length; i++) {
    if (!dorm || i < rp.length - 1) {
      slope(-ov, L + ov, rp[i - 1], rp[i]);
      continue;
    }
    slope(-ov, dorm.x0, rp[i - 1], rp[i]);
    slope(dorm.x1, L + ov, rp[i - 1], rp[i]);
    if (dorm.cut > rp[i - 1][0] + 0.05) slope(dorm.x0, dorm.x1, rp[i - 1], [dorm.cut, topAt(dorm.cut)]);
  }

  /* Ridge cap: a bent strip over the peak. */
  {
    const pi = prof.findIndex((p) => p[1] === peak);
    if (pi > 0 && pi < prof.length - 1) {
      const side = (q) => {
        const d = Math.hypot(q[0] - prof[pi][0], q[1] - prof[pi][1]);
        return [prof[pi][0] + ((q[0] - prof[pi][0]) / d) * 0.38, prof[pi][1] + ((q[1] - prof[pi][1]) / d) * 0.38];
      };
      const cap = p3Shade(col.roof.slice(0, 7), 1.06);
      for (const q of [side(prof[pi - 1]), side(prof[pi + 1])]) face([V(-ov, prof[pi][0], F + peak + 0.13), V(L + ov, prof[pi][0], F + peak + 0.13), V(L + ov, q[0], F + q[1] + 0.1), V(-ov, q[0], F + q[1] + 0.1)], cap);
    }
  }

  hide = false;
  /* Porch posts and a top rail between them. */
  const posts = sh.posts.map(([x, y]) => [Math.min(Math.max(x, 0.2), L - 0.2), Math.min(Math.max(y, 0.2), W - 0.2)]);
  /* Posts stop at the porch ceiling, under a beam along each open side. */
  for (const [x, y] of posts) box(x - 0.23, y - 0.23, x + 0.23, y + 0.23, F, F + Math.min(topAt(y), eave) - 0.02, col.trim);
  /* Porch, as built: a white board ceiling at the eave, a trim band along the top of each porch wall and a
     base board along its foot, stopping at the doors. */
  if (sh.deck) {
    if (!inside) flat(sh.deck, F + eave - 0.02, '#eeede8c');
    for (const w of sh.walls) {
      const g = bsWallGeo(sh, w), mid = g.at(w.len / 2);
      if (!bsInside(sh.deck, [mid[0] - g.n[0] * 0.3, mid[1] - g.n[1] * 0.3])) continue;
      const strip = (t0, t1, y0, y1) => {
        const p = g.at(t0), q = g.at(t1), d = -0.04;
        face([V(p[0] + g.n[0] * d, p[1] + g.n[1] * d, F + y0), V(q[0] + g.n[0] * d, q[1] + g.n[1] * d, F + y0), V(q[0] + g.n[0] * d, q[1] + g.n[1] * d, F + y1), V(p[0] + g.n[0] * d, p[1] + g.n[1] * d, F + y1)], col.trim);
      };
      const gaps = lay.items.filter((x) => x.wi === w.i && x.w && !x.high && x.kind === 'door').map((x) => [x.at - 0.29, x.at + x.w + 0.29]).sort((p, q) => p[0] - q[0]);
      let t = 0;
      for (const [g0, g1] of [...gaps, [w.len, w.len]]) {
        if (g0 > t + 0.05) strip(t, g0, 0.015, 0.3);
        t = Math.max(t, g1);
      }
      if (!inside) strip(0, w.len, eave - 0.36, eave - 0.02);
    }
  }
  /* The porches are built without a railing. */
  /* Decking, as built: grey composite boards running the length of the building, wrapped on every open
     side by a border board ("picture frame") so no board ends show. The border is mitered where two open
     sides meet, and its edge covers the end grain of the deck down to the painted floor frame. */
  if (sh.deck) {
    const cx = sh.deck.reduce((t, q) => t + q[0], 0) / sh.deck.length, cy = sh.deck.reduce((t, q) => t + q[1], 0) / sh.deck.length;
    const onWall = (q) => sh.walls.some((w) => {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], t = Math.max(0, Math.min(1, ((q[0] - w.a[0]) * dx + (q[1] - w.a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(q[0] - w.a[0] - t * dx, q[1] - w.a[1] - t * dy) < 0.03;
    });
    const D = sh.deck, N = D.length, open = D.map((q, i) => !onWall([(q[0] + D[(i + 1) % N][0]) / 2, (q[1] + D[(i + 1) % N][1]) / 2]));
    const frame = '#78797a', bw = 0.46, top = F + 0.02;
    D.forEach((a, i) => {
      if (!open[i]) return;
      const b = D[(i + 1) % N], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      let n = [-d[1], d[0]];
      if ((cx - mid[0]) * n[0] + (cy - mid[1]) * n[1] < 0) n = [-n[0], -n[1]];
      /* Inner corners: mitered (pulled in along the edge) where the next side is open too, square where it meets a wall. */
      const ia = [a[0] + n[0] * bw + (open[(i + N - 1) % N] ? d[0] * bw : 0), a[1] + n[1] * bw + (open[(i + N - 1) % N] ? d[1] * bw : 0)];
      const ib = [b[0] + n[0] * bw - (open[(i + 1) % N] ? d[0] * bw : 0), b[1] + n[1] * bw - (open[(i + 1) % N] ? d[1] * bw : 0)];
      face([V(a[0], a[1], top), V(b[0], b[1], top), V(ib[0], ib[1], top), V(ia[0], ia[1], top)], frame, false);
      lines.push(...V(ia[0], ia[1], top + 0.002), ...V(ib[0], ib[1], top + 0.002));
      if (open[(i + N - 1) % N]) lines.push(...V(a[0], a[1], top + 0.002), ...V(ia[0], ia[1], top + 0.002));
      /* The wrap over the edge of the deck, a little proud of the painted frame below. */
      const o = 0.015;
      face([V(a[0] - n[0] * o, a[1] - n[1] * o, F - 0.1), V(b[0] - n[0] * o, b[1] - n[1] * o, F - 0.1), V(b[0] - n[0] * o, b[1] - n[1] * o, top), V(a[0] - n[0] * o, a[1] - n[1] * o, top)], frame);
      const t = 0.3, beam = [a, b, [b[0] + n[0] * t, b[1] + n[1] * t], [a[0] + n[0] * t, a[1] + n[1] * t]];
      band(beam, F + eave - 0.5, F + eave - 0.02, col.trim);
      flat(beam, F + eave - 0.5, col.trim);
    });
  }

  if (inside) {
    /* Rafters at 24 in on center, drawn as lines so the inside stays in view, and the ceiling lights. */
    for (let x = 0; x <= L + 0.01; x += 2) for (let i = 1; i < prof.length; i++) lines.push(...V(x, prof[i - 1][0], F + prof[i - 1][1]), ...V(x, prof[i][0], F + prof[i][1]));
    /* Truss bottom chords at the top of the walls, 24 in on center, and each light on a chord, as built:
       a white porcelain holder with the bulb below it. */
    for (let x = 2; x <= L - 2 + 1e-9; x += 2) {
      let ya = null, yb = null;
      for (let y = 0.2; y <= W - 0.2 + 1e-9; y += 0.1) if (bsInside(sh.poly, [x, y])) (ya ??= y), (yb = y);
      if (ya != null) box(x - 0.0625, ya, x + 0.0625, yb, F + eave - 0.29, F + eave, '#e2c8a0h');
    }
    const ring = (x, y, r, lo, hi, hex) => {
      const q = Array.from({ length: 10 }, (_, i) => [x + r * Math.cos((i * Math.PI) / 5), y + r * Math.sin((i * Math.PI) / 5)]);
      band(q, lo, hi, hex);
      flat(q, lo, hex);
    };
    for (const it of lay.items.filter((x) => x.kind === 'light')) {
      ring(it.x, it.y, 0.2, F + eave - 0.4, F + eave - 0.29, '#f4f3ef');
      ring(it.x, it.y, 0.13, F + eave - 0.62, F + eave - 0.4, '#fffdf0');
    }
  }
  hide = inside;
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
  /* For the shader's shading under and around the building: its footprint (porch included) and the eave line. */
  const all = [...sh.poly, ...(sh.deck || [])];
  const box2 = [Math.min(...all.map((q) => q[0])), Math.min(...all.map((q) => q[1])), Math.max(...all.map((q) => q[0])), Math.max(...all.map((q) => q[1]))];
  return {
    pos: new Float32Array(pos), nor: new Float32Array(nor), rgb: new Float32Array(rgb), mat: new Float32Array(mat), lines: new Float32Array(lines), edges: new Float32Array(edges),
    box: box2, levels: [F, F + eave], inside,
    center: [L / 2, high * 0.45, W / 2], radius: 0.5 * Math.hypot(L + 2, W + 2, high),
    labels: [[sh.sides.left, [-2.2, 0, W / 2]], [sh.sides.right, [L + 2.2, 0, W / 2]], [sh.sides.top, [L / 2, 0, -2.2]], [sh.sides.bottom, [L / 2, 0, W + 2.2]]],
  };
}

/* ---------- Drawing ---------- */
/* The sun stays off to the viewer's left as the building turns, like lights around a turntable, so the
   sides in view are lit and the shadow falls where it can be seen. Shadows come from a depth picture
   taken from the sun. */
function p3Sun(center, r, P3_SUN) {
  const eye = [center[0] + P3_SUN[0] * r * 2, center[1] + P3_SUN[1] * r * 2, center[2] + P3_SUN[2] * r * 2];
  const f = p3Norm(p3Sub(center, eye)), s = p3Norm(p3Cross(f, [0, 1, 0])), u = p3Cross(s, f), near = 0.1, far = r * 4, k = 1 / (r * 1.2);
  const view = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
  return p3Mul([k, 0, 0, 0, 0, k, 0, 0, 0, 0, -2 / (far - near), 0, 0, 0, -(far + near) / (far - near), 1], view);
}
/* The sun's depth picture is looked up from a point nudged a little toward the sun, so a face never shadows
   itself, while small parts such as trim and hardware still cast their shadows. */
const P3_VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;attribute float aM;uniform mat4 uM;uniform mat4 uL;uniform vec3 uOff;varying vec3 vP;varying vec3 vN;varying vec3 vC;varying float vM;varying vec4 vS;void main(){vP=aP;vN=aN;vC=aC;vM=aM;float s=dot(aN,uOff);vS=uL*vec4(aP+aN*(s>0.0?0.04:(s<0.0?-0.04:0.0)),1.0);gl_Position=uM*vec4(aP,1.0);}';
/* Painted like a photograph: light is worked out in linear units and finished with a film-like curve; each
   surface (kind numbers below) gets its own texture, bumps, gloss and reflection of the sky. */
const P3_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vP;varying vec3 vN;varying vec3 vC;varying float vM;varying vec4 vS;
uniform sampler2D uSh;uniform vec3 uEye;uniform vec3 uSun;uniform vec3 uFog;uniform float uLine;uniform float uAlpha;uniform float uFar;uniform float uPx;
uniform vec4 uBox;uniform vec2 uLevel;uniform float uInside;uniform float uTaps;
float px;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
float depthAt(vec2 q){return dot(texture2D(uSh,q),vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}
/* How much of a detail w feet wide shows at this distance: all of it when it spans a few pixels, none when it is under one. */
float aa(float w){return clamp(w/(px*2.0)-0.35,0.0,1.0);}
/* Soft sun shadow: several looks into the sun's depth picture, spread on a turned spiral. */
float shade(float ndl){
  vec3 s=vS.xyz/vS.w*0.5+0.5;
  if(s.x<0.0||s.x>1.0||s.y<0.0||s.y>1.0||s.z>1.0)return 1.0;
  float bias=0.0004+0.0012*(1.0-ndl),a=hash(gl_FragCoord.xy)*6.2832,lit=0.0,k=0.0;
  for(int i=0;i<16;i++){
    float fi=float(i);if(fi>=uTaps)break;
    float r=sqrt((fi+0.5)/uTaps)*2.6/2048.0,an=fi*2.39996+a;
    lit+=s.z-bias>depthAt(s.xy+vec2(cos(an),sin(an))*r)?0.0:1.0;k+=1.0;
  }
  return lit/k;
}
/* The sky as a surface sees it in a reflection: blue overhead, pale at the horizon, ground below, a glint toward the sun. */
vec3 sky(vec3 d){
  float h=d.y;
  vec3 s=h>0.0?mix(vec3(0.74,0.80,0.86),vec3(0.17,0.35,0.70),pow(clamp(h,0.0,1.0),0.5)):mix(vec3(0.36,0.40,0.31),vec3(0.07,0.10,0.04),clamp(-h*3.0,0.0,1.0));
  float sd=max(dot(d,uSun),0.0);
  return s+vec3(1.0,0.85,0.6)*(0.3*pow(sd,6.0)+6.0*pow(sd,500.0));
}
void main(){
  if(uLine>0.5){gl_FragColor=vec4(vec3(0.04,0.05,0.06)*uAlpha,uAlpha);return;}
  vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
  vec3 t=abs(n.y)>0.99?vec3(1.0,0.0,0.0):normalize(cross(vec3(0.0,1.0,0.0),n));vec3 b=cross(n,t);
  float u=dot(vP,t),v=dot(vP,b),dist=length(uEye-vP);
  vec3 view=(uEye-vP)/dist;
  px=uPx*dist/uFar;
  vec3 c=pow(vC,vec3(2.2));
  float du=0.0,dv=0.0,ao=1.0,rough=0.6,f0=0.04,metal=0.0,glow=0.0,glass=0.0,ground=0.0,m=vM;
  /* 0 paint: satin, with the faint texture of primed trim board. */
  if(m<0.5){c*=0.96+0.08*noise(vec2(u,v)*7.0);rough=0.55;}
  /* 1 LP grooved panel: a groove every 8 in, its two walls catching and losing the sun; embossed cedar grain;
     each 4 x 8 ft sheet a shade apart. */
  else if(m<1.5){
    float g=fract(u/0.6667+0.5)-0.5,x=abs(g)*0.6667/0.016,e=px/0.016,vis=aa(0.032);
    float gm=1.0-smoothstep(1.0-e,1.0+e,x),wm=gm*smoothstep(0.55-e,0.55+e,x);
    float gn=noise(vec2(u*48.0,v*1.8)),gl=noise(vec2(u*130.0,v*0.7));c*=0.97+0.05*gn+0.03*gl*aa(0.008);
    ao*=mix(1.0,0.55,gm*vis);du-=sign(g)*1.3*wm*vis;du+=(gn-0.5)*0.1*aa(0.02)*(1.0-gm);
    c*=0.988+0.024*hash(vec2(floor(u/4.0),floor(v/8.0)+3.0));
    rough=0.62;
  }
  /* 2 lap siding: each board tips out at the bottom and throws a shadow line on the board below. */
  else if(m<2.5){
    float f=fract(v/0.5);
    dv-=0.12;
    ao*=1.0-0.6*smoothstep(0.78,1.0,f)*aa(0.06);
    dv-=1.2*aa(0.03)*(1.0-smoothstep(0.05-px/0.5,0.05+px/0.5,f));
    float gn=noise(vec2(u*1.6,v*50.0));dv+=(gn-0.5)*0.3*aa(0.02);c*=0.965+0.07*gn;
    c*=0.985+0.03*hash(vec2(floor(v/0.5),floor(u/12.0)));
    rough=0.62;
  }
  /* 3 painted ribbed steel and 14 bare Galvalume: a rib every 9 in with two stiffeners between, slight
     oil-canning in the flat, a 3 ft sheet a shade apart; glossy, so it mirrors the sky. */
  else if(m<3.5||(m>13.5&&m<14.5)){
    float d=fract(u/0.75+0.5)-0.5,ad=abs(d),e=px/0.75,vis=aa(0.05);
    du+=sign(d)*1.5*vis*smoothstep(0.035-e,0.035+e,ad)*(1.0-smoothstep(0.08-e,0.08+e,ad));
    c*=1.0+0.04*vis*(1.0-smoothstep(0.035-e,0.035+e,ad));
    du+=sign(ad-0.33)*sign(d)*0.5*aa(0.02)*(1.0-smoothstep(0.018-e,0.018+e,abs(ad-0.33)));
    du+=(noise(vec2(u*0.8,v*0.25))-0.5)*0.08;
    c*=0.975+0.05*hash(vec2(floor(u/3.0),9.0));
    if(m>13.5){metal=0.8;rough=0.45;c*=0.92+0.12*noise(vec2(u*6.0,v*0.5));}
    else{rough=0.46;f0=0.045;}
  }
  /* 4 architectural shingles: staggered tabs of mixed tone, granules, a shadow under each course. */
  else if(m<4.5){
    float row=floor(v/0.42),fr=fract(v/0.42),uu=u+mod(row,2.0)*0.5+hash(vec2(row,3.0))*0.37;
    c*=0.84+0.24*hash(vec2(floor(uu),row))+0.08*noise(vec2(u*2.0,row*1.7));
    float gv=aa(0.02);c*=mix(0.97,0.8+0.34*noise(vec2(u,v)*30.0),gv);
    ao*=1.0-0.55*smoothstep(0.78,1.0,fr)*aa(0.04);
    ao*=1.0-0.35*(1.0-smoothstep(0.0,max(0.035,px*1.5),fract(uu)))*aa(0.02);
    dv-=0.15;rough=0.92;
  }
  /* 5 glass: a dark room behind, the sky in front. */
  else if(m<5.5){glass=1.0;rough=0.05;}
  /* 6 composite decking: 5 1/2 in boards with a gap, each a shade apart, with embossed grain. */
  else if(m<6.5){
    float f=fract(v/0.4583),bi=floor(v/0.4583);
    float ge=max(0.03,px*1.5/0.4583),gap=(1.0-smoothstep(0.0,ge,f))+smoothstep(1.0-ge,1.0,f);
    ao*=1.0-0.8*gap*aa(0.012);
    c*=0.92+0.12*hash(vec2(bi,7.0));
    float gn=noise(vec2(u*1.4+bi*13.0,v*75.0));c*=0.94+0.1*gn;dv+=(gn-0.5)*0.25*aa(0.008);
    rough=0.55;
  }
  /* 7 lawn: patches of lush and drier grass, clumps, and blades up close. */
  else if(m<7.5){
    ground=1.0;
    vec2 g=vP.xz;
    float n1=noise(g*0.07),n2=noise(g*0.45+3.1),n3=noise(g*2.2+7.7),n4=noise(g*9.0+1.3),n5=noise(g*31.0);
    c=mix(vec3(0.045,0.105,0.02),vec3(0.13,0.125,0.045),smoothstep(0.5,0.95,n1)*0.28+n2*0.14);
    c*=0.84+0.3*n3;
    c*=mix(1.0,0.7+0.55*n4,aa(0.06));c*=mix(1.0,0.75+0.5*n5,aa(0.02));
    rough=0.95;
  }
  /* 8 diamond tread plate: bright aluminum with raised diamonds. */
  else if(m<8.5){
    vec2 q=fract(vec2(u,v)*8.0)-0.5;float k=mod(floor(u*8.0)+floor(v*8.0),2.0);
    float d=k>0.5?abs(q.x+q.y):abs(q.x-q.y),e=k>0.5?abs(q.x-q.y):abs(q.x+q.y);
    float ridge=(1.0-smoothstep(0.05,0.12,d))*(1.0-smoothstep(0.3,0.42,e))*aa(0.02);
    c*=0.85+0.1*noise(vec2(u,v)*3.0)+0.3*ridge;metal=0.8;rough=0.4;
  }
  /* 9 OSB: pressed wood strands. */
  else if(m<9.5){
    vec2 q=vec2(u*7.0,v*2.4);float fl=hash(floor(q+vec2(0.0,floor(q.x)*0.37))),vis=aa(0.03);
    c*=0.72+0.38*fl*vis+0.19*(1.0-vis)+0.16*noise(vec2(u,v)*5.0);rough=0.9;
  }
  /* 10 and 15 framing lumber: grain along the stud (10) or along a plate, header or skid (15). */
  else if(m<10.5||m>14.5){
    float al=m>14.5?u:v,ac=m>14.5?v:u,vis=aa(0.01);
    float gr=noise(vec2(ac*38.0,al*1.1+ac*3.0));
    c*=0.86+0.2*gr*vis+0.1*(1.0-vis);c*=0.95+0.1*hash(vec2(floor(al/8.0),floor(ac*2.0)));rough=0.78;
  }
  /* 11 porch ceiling: bead board, a groove every 4 in. */
  else if(m<11.5){
    float g=fract(u/0.3333+0.5)-0.5,x=abs(g)*0.3333/0.012,e=px/0.012,vis=aa(0.024);
    float gm=1.0-smoothstep(1.0-e,1.0+e,x);ao*=mix(1.0,0.55,gm*vis);du-=sign(g)*1.2*vis*gm*smoothstep(0.5-e,0.5+e,x);
    c*=0.97+0.05*noise(vec2(u*3.0,v*0.5));rough=0.6;
  }
  /* 12 concrete block. */
  else if(m<12.5){c*=0.8+0.3*noise(vec2(u,v)*12.0)-0.18*step(0.82,noise(vec2(u,v)*37.0))*aa(0.02);rough=0.95;}
  /* 13 clear corrugated roof (greenhouse): corrugations, rafters and purlins showing through, light passing in. */
  else{
    du+=sin(fract(u/0.2083)*6.2832)*0.4*aa(0.04);
    float dr=abs(fract(u/2.0+0.5)-0.5)*2.0,dp=abs(fract(v/2.0+0.5)-0.5)*2.0;
    float fr=max(1.0-smoothstep(0.05,0.09,dr),1.0-smoothstep(0.04,0.07,dp));
    c=mix(c*vec3(0.78,0.86,0.9),c*vec3(0.36,0.33,0.3),fr*0.9);glow=0.4;rough=0.22;f0=0.05;
  }
  vec3 N=normalize(n+t*du+b*dv);
  float ng=dot(n,uSun),ndl=max(dot(N,uSun),0.0)*smoothstep(0.0,0.08,ng),sh=ng>0.0?shade(ng):0.0;
  /* Light the sky cannot reach: under and beside the building, along the ground line, up under the eaves,
     and deep in a porch. */
  float env=1.0,hgt=vP.y;
  vec2 dd=max(uBox.xy-vP.xz,vP.xz-uBox.zw);
  float outs=length(max(dd,0.0)),inn=min(max(dd.x,dd.y),0.0);
  if(ground>0.5)env*=mix(0.2,1.0,smoothstep(-0.8,0.0,inn))*mix(0.55,1.0,smoothstep(0.0,2.8,outs));
  else{
    env*=mix(0.55,1.0,smoothstep(0.0,1.1,hgt));
    if(uInside<0.5&&hgt<uLevel.y){
      if(outs<0.25&&abs(N.y)<0.6)env*=mix(0.7,1.0,smoothstep(0.0,1.6,uLevel.y-hgt));
      env*=mix(1.0,0.55,smoothstep(0.4,4.0,-inn));
    }
  }
  vec3 SUN=vec3(1.0,0.91,0.78)*2.85;
  vec3 amb=mix(vec3(0.30,0.27,0.19)*0.55,vec3(0.40,0.52,0.72)*0.95,N.y*0.5+0.5)*ao*env;
  float ndv=max(dot(N,view),0.001);
  vec3 H=normalize(uSun+view);
  float shin=exp2(11.0*(1.0-rough)),spec=pow(max(dot(N,H),0.0),shin)*(shin+2.0)*0.125;
  float fr=pow(1.0-ndv,5.0)*(1.0-rough)*(1.0-rough);
  vec3 F=mix(vec3(f0),c,metal);F+=(vec3(1.0)-F)*fr;
  vec3 R=sky(reflect(-view,N)),Rb=mix(R,mix(vec3(0.30,0.30,0.24),vec3(0.55,0.65,0.80),N.y*0.5+0.5),rough);
  vec3 col=c*(1.0-metal)*(amb+SUN*ndl*sh)+F*(SUN*spec*ndl*sh*0.3+Rb*ao*env);
  if(glass>0.5){
    float Fg=0.06+0.94*fr;
    vec3 room=vec3(0.010,0.012,0.014)*(0.6+0.8*noise(vec2(u,v)*1.3))*env;
    col=room*(1.0-Fg)+R*c*1.3*(Fg*0.85+0.1)*env+SUN*spec*ndl*sh*0.5;
  }
  if(glow>0.0)col+=c*SUN*glow*0.25*(0.4+0.6*sh);
  col=pow(vec3(1.0)-exp(-col*0.9),vec3(1.0/2.2));
  if(ground>0.5)col=mix(col,uFog,0.85*smoothstep(uFar*3.0,uFar*16.0,dist));
  gl_FragColor=vec4(col,1.0);
}
`;
function p3Gl() {
  if (P3.gl) return P3.gl;
  const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) return null;
  const program = (vs, fs) => {
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(prog, s);
    }
    ['aP', 'aN', 'aC', 'aM'].forEach((name, i) => gl.bindAttribLocation(prog, i, name));
    gl.linkProgram(prog);
    return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
  };
  const prog = program(P3_VS, P3_FS);
  /* The sun's depth picture, with depth packed into the four color channels. */
  const depth = program('attribute vec3 aP;uniform mat4 uL;varying float vD;void main(){gl_Position=uL*vec4(aP,1.0);vD=gl_Position.z*0.5+0.5;}', 'precision highp float;varying float vD;void main(){vec4 e=fract(vD*vec4(1.0,255.0,65025.0,16581375.0));e-=e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);gl_FragColor=e;}');
  if (!prog || !depth) return null;
  const tex = gl.createTexture(), fbo = gl.createFramebuffer(), rb = gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 2048, 2048);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  P3.gl = { gl, canvas, prog, depth, fbo, tex, buf: { p: gl.createBuffer(), n: gl.createBuffer(), c: gl.createBuffer(), m: gl.createBuffer(), l: gl.createBuffer() } };
  return P3.gl;
}
/* A smooth random value between 0 and 1 along a line, for clouds and the tree line. */
function p3Noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return h(i) * (1 - u) + h(i + 1) * u;
}
/* Behind the building: sky, soft clouds and a hazy line of trees on the horizon. Each is placed by its direction
   from the viewer, so it turns with the view like real scenery. M is the camera, f the level view direction. */
function p3Backdrop(ctx, w, h, M, eye, center, light) {
  const dir = (d) => {
    const cw = M[3] * d[0] + M[7] * d[1] + M[11] * d[2];
    return cw <= 1e-6 ? null : [((M[0] * d[0] + M[4] * d[1] + M[8] * d[2]) / cw) * 0.5 * w + w / 2, (0.5 - ((M[1] * d[0] + M[5] * d[1] + M[9] * d[2]) / cw) * 0.5) * h];
  };
  const at = (p) => {
    const cw = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    return cw <= 1e-6 ? null : [(((M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / cw) * 0.5 + 0.5) * w, (0.5 - ((M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / cw) * 0.5) * h];
  };
  const f = p3Norm([center[0] - eye[0], 0, center[2] - eye[2]]), hz = dir(f)?.[1] ?? -1e4;
  /* Sky: deep blue overhead, pale haze down at the horizon, a little warmer on the sun's side. */
  const sky = ctx.createLinearGradient(0, hz - h * 1.15, 0, hz);
  sky.addColorStop(0, '#4f86c9');
  sky.addColorStop(0.55, '#8cb6e2');
  sky.addColorStop(0.88, '#c9dcec');
  sky.addColorStop(1, '#e2eaee');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const right = p3Norm(p3Cross(f, [0, 1, 0])), side = light[0] * right[0] + light[2] * right[2];
  const warm = ctx.createLinearGradient(side > 0 ? w : 0, 0, side > 0 ? 0 : w, 0);
  warm.addColorStop(0, `rgba(255, 216, 165, ${(0.24 * Math.min(1, Math.abs(side) * 1.5)).toFixed(3)})`);
  warm.addColorStop(0.65, 'rgba(255, 216, 165, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, Math.max(0, Math.min(h, hz + 2)));
  if (hz <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, Math.min(h, hz + 1));
  ctx.clip();
  /* Clouds: loose groups of soft puffs, flatter and fainter toward the horizon. */
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, k = h / 0.4887;
  for (let i = 0; i < 24; i++) {
    const az = rnd() * Math.PI * 2, el = 0.03 + rnd() * 0.24, size = 0.05 + rnd() * 0.09, puffs = 4 + Math.floor(rnd() * 5);
    for (let j = 0; j < puffs; j++) {
      const a = az + (rnd() - 0.5) * size * 2.4, e = el + (rnd() - 0.3) * size * 0.3, r = size * (0.45 + rnd() * 0.6) * k, p = dir([Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]);
      if (!p || p[0] < -r || p[0] > w + r) continue;
      const fade = Math.min(1, (hz - p[1]) / (h * 0.25) + 0.25), g = ctx.createRadialGradient(p[0], p[1] - r * 0.1, 0, p[0], p[1], r);
      g.addColorStop(0, `rgba(255, 255, 255, ${(0.5 * fade).toFixed(3)})`);
      g.addColorStop(0.55, `rgba(246, 249, 252, ${(0.26 * fade).toFixed(3)})`);
      g.addColorStop(1, 'rgba(240, 245, 250, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  /* Trees far off along the horizon, as rounded crowns of mixed height: a pale far row and a darker nearer row,
     down to where the lawn ends. */
  const edge = at([eye[0] + f[0] * 1150, 0, eye[2] + f[2] * 1150]), base = Math.max(hz, edge ? edge[1] : hz) + 3;
  const crown = (a, count, seed) => {
    const x = a * count, k = Math.floor(x), t = (x - k) * 2 - 1, hk = p3Noise1(k * 0.37 + seed) * 0.6 + p3Noise1(k * 3.1 + seed) * 0.4;
    return Math.sqrt(Math.max(0, 1 - t * t)) * (0.2 + 0.8 * hk * hk);
  };
  for (const [lo, amp, count, seed, color] of [[0.011, 0.012, 640, 5, 'rgba(132, 150, 150, 0.6)'], [0.005, 0.021, 430, 9, 'rgba(68, 88, 74, 0.95)']]) {
    const pts = [];
    for (let i = 0; i <= 5760; i++) {
      const a = i / 5760, gap = Math.min(1, p3Noise1(a * 22 + seed * 2) * 1.8);
      const e = lo + amp * (0.4 * p3Noise1(a * 36 + seed) + 0.6 * gap * Math.max(crown(a, count, seed), 0.85 * crown(a + 0.37 / count, count * 1.53, seed + 3)));
      const r = a * Math.PI * 2, p = dir([Math.sin(r) * Math.cos(e), Math.sin(e), Math.cos(r) * Math.cos(e)]);
      if (p && p[0] > -40 && p[0] < w + 40) pts.push(p);
    }
    if (pts.length < 2) continue;
    pts.sort((p, q) => p[0] - q[0]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], base);
    for (const p of pts) ctx.lineTo(p[0], Math.min(p[1], base));
    ctx.lineTo(pts[pts.length - 1][0], base);
    ctx.closePath();
    ctx.fill();
  }
}
/* A light vignette, as a camera lens gives. */
function p3Finish(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.32, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(8, 16, 24, 0)');
  g.addColorStop(1, 'rgba(8, 16, 24, 0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function p3Draw(el, fast = false) {
  const view = P3.views[el.id], G = p3Gl();
  if (!view || !G) return;
  const turn = P3.inside[view.slot] ? Math.round(((P3.angles[view.slot] ||= { yaw: -0.72, pitch: 0.4 }).yaw * 12) / Math.PI) : 0;
  const key = JSON.stringify(view.c) + !!P3.inside[view.slot] + turn;
  if (view.key !== key) {
    try {
      view.mesh = p3Mesh(view.c, !!P3.inside[view.slot], (turn * Math.PI) / 12);
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
  /* The picture is drawn larger than shown and scaled down, for clean edges and fine siding grooves; while a
     finger or the mouse is turning it, it is drawn at plain size so it keeps up. */
  fast = fast || P3.rush;
  const ss = fast ? (dpr >= 2 ? 0.7 : 1) : Math.min(dpr >= 2 ? 1.35 : 1.75, 2600 / w, 2600 / h), wi = Math.round(w * ss), hi = Math.round(h * ss);
  const ang = (P3.angles[view.slot] ||= { yaw: -0.72, pitch: 0.4 });
  const dist = (m.radius / Math.sin((14 * Math.PI) / 180)) * Math.max(1, h / w) * (w / h > 2 ? 0.7 : w / h > 1.5 ? 0.82 : 0.98) * (P3.inside[view.slot] ? 1.25 : 1) / (P3.zoom[view.slot] || 1);
  const eye = [m.center[0] + dist * Math.cos(ang.pitch) * Math.sin(ang.yaw), m.center[1] + dist * Math.sin(ang.pitch), m.center[2] + dist * Math.cos(ang.pitch) * Math.cos(ang.yaw)];
  /* Afternoon sun, about 38 degrees up, kept off to the viewer's left as the building turns. */
  const M = p3Camera(eye, m.center, w / h), light = p3Norm([Math.sin(ang.yaw - 0.95) * 0.79, 0.62, Math.cos(ang.yaw - 0.95) * 0.79]), sun = p3Sun(m.center, m.radius, light), { gl, canvas, prog, depth, fbo, tex, buf } = G;
  if (canvas.width !== wi || canvas.height !== hi) (canvas.width = wi), (canvas.height = hi);
  const feed = (i, buffer, data, size = 3) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
  };
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  for (const i of [1, 2, 3]) gl.disableVertexAttribArray(i);
  feed(0, buf.p, m.pos);

  /* 1. What the sun sees: anything farther than this is in shadow. */
  gl.useProgram(depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, 2048, 2048);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(gl.getUniformLocation(depth, 'uL'), false, new Float32Array(sun));
  gl.drawArrays(gl.TRIANGLES, 0, m.pos.length / 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  /* 2. The picture itself. */
  const U = (name) => gl.getUniformLocation(prog, name);
  gl.useProgram(prog);
  gl.viewport(0, 0, wi, hi);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(U('uM'), false, new Float32Array(M));
  gl.uniformMatrix4fv(U('uL'), false, new Float32Array(sun));
  gl.uniform3fv(U('uOff'), light);
  gl.uniform3fv(U('uEye'), eye);
  gl.uniform3fv(U('uSun'), light);
  gl.uniform3fv(U('uFog'), [0.6, 0.67, 0.58]);
  gl.uniform1f(U('uFar'), dist);
  gl.uniform1f(U('uPx'), (0.5 * dist) / hi);
  gl.uniform4fv(U('uBox'), [m.box[0], m.box[1], m.box[2], m.box[3]]);
  gl.uniform2fv(U('uLevel'), m.levels);
  gl.uniform1f(U('uInside'), m.inside ? 1 : 0);
  gl.uniform1f(U('uTaps'), fast ? 5 : 14);
  gl.uniform1f(U('uLine'), 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(U('uSh'), 0);
  feed(1, buf.n, m.nor);
  feed(2, buf.c, m.rgb);
  feed(3, buf.m, m.mat, 1);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  gl.drawArrays(gl.TRIANGLES, 0, m.pos.length / 3);
  gl.disable(gl.POLYGON_OFFSET_FILL);

  /* 3. Thin lines for bars, slats and seams. Outlines on every face only in the framed inside view, where they
     help read the studs; outside, the light and shadow show the edges, as in a photo. */
  for (const i of [1, 2, 3]) gl.disableVertexAttribArray(i);
  gl.vertexAttrib3f(1, 0, 1, 0);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(U('uLine'), 1);
  for (const [data, alpha] of [[m.edges, m.inside ? 0.12 : 0], [m.lines, 0.5]]) {
    if (!data.length || !alpha) continue;
    feed(0, buf.l, data);
    gl.uniform1f(U('uAlpha'), alpha);
    gl.drawArrays(gl.LINES, 0, data.length / 3);
  }
  gl.disable(gl.BLEND);

  /* Sky and scenery behind, then the picture, scaled down smoothly, then the lens vignette. */
  p3Backdrop(ctx, w, h, M, eye, m.center, light);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, wi, hi, 0, 0, w, h);
  p3Finish(ctx, w, h);
  /* Side names on the ground, so front and back are never in doubt. */
  ctx.font = `700 ${Math.round(11 * dpr)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(10, 25, 15, 0.75)';
  ctx.shadowBlur = 4 * dpr;
  /* Only the two sides facing the viewer are named; the far ones would print over the building. */
  const near = [...m.labels].sort((a, b) => Math.hypot(...p3Sub(a[1], eye)) - Math.hypot(...p3Sub(b[1], eye))).slice(0, 2);
  for (const [text, p] of near) {
    const cw = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
    if (cw <= 0) continue;
    const x = ((M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / cw) * 0.5 + 0.5, y = 0.5 - ((M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / cw) * 0.5;
    ctx.fillText(text, Math.min(Math.max(x * w, 40 * dpr), w - 40 * dpr), Math.min(Math.max(y * h, 14 * dpr), h - 6 * dpr));
  }
  ctx.shadowBlur = 0;
}
/* Draw every view on the page that is new, resized or whose order changed. */
function p3Paint(force = false) {
  const live = new Set();
  for (const el of document.querySelectorAll('canvas.p3d')) {
    const view = P3.views[el.id];
    if (!view) continue;
    live.add(el.id);
    const stamp = JSON.stringify(view.c) + !!P3.inside[view.slot] + el.clientWidth + 'x' + el.clientHeight;
    if (!force && view.stamp === stamp) continue;
    view.stamp = stamp;
    if (!view.wired) {
      view.wired = true;
      let last = null;
      /* Zoom: mouse wheel, two-finger pinch, or the + and - buttons. */
      const pts = new Map(), spread = () => (pts.size === 2 ? Math.hypot(...[0, 1].map((i) => [...pts.values()][0][i] - [...pts.values()][1][i])) : 0);
      el.onwheel = (e) => {
        if (p3Zoom(view.slot, e.deltaY < 0 ? 1.15 : 1 / 1.15)) e.preventDefault();
      };
      el.onpointerdown = (e) => {
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        last = [e.clientX, e.clientY];
        el.setPointerCapture(e.pointerId);
      };
      el.onpointermove = (e) => {
        if (pts.has(e.pointerId)) {
          const before = spread();
          pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 2) {
            if (before > 0) p3Zoom(view.slot, spread() / before);
            return;
          }
        }
        if (!last) return;
        const a = (P3.angles[view.slot] ||= { yaw: -0.72, pitch: 0.4 });
        a.yaw -= (e.clientX - last[0]) * 0.01;
        if (e.pointerType === 'mouse') a.pitch = Math.min(1.45, Math.max(0.05, a.pitch + (e.clientY - last[1]) * 0.01));
        last = [e.clientX, e.clientY];
        view.turning = true;
        p3Draw(el, true);
      };
      el.onpointerup = el.onpointercancel = (e) => {
        pts.delete(e.pointerId);
        last = null;
        /* Let go: draw it again at full quality. */
        if (view.turning) (view.turning = false), p3Draw(el);
      };
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
/* Switch a view between the outside and the framed inside (roof off, looking down in). */
function p3Inside(slot) {
  P3.inside[slot] = !P3.inside[slot];
  const a = (P3.angles[slot] ||= { yaw: -0.72, pitch: 0.4 });
  a.pitch = P3.inside[slot] ? Math.max(a.pitch, 0.95) : Math.min(a.pitch, 0.4);
  p3Paint(true);
}
/* Move the camera closer or farther. Returns false at either limit, so the page can scroll instead. */
function p3Zoom(slot, by) {
  const was = P3.zoom[slot] || 1, now = Math.min(5, Math.max(1, was * by));
  if (now === was) return false;
  P3.zoom[slot] = now;
  p3Paint(true);
  return true;
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
    return `<div class="reference-model p3d-box">${p3dMarkup(c, 'stage')}<div class="p3d-bar"><span>Drawn from the floor plan · drag to turn</span><button type="button" class="chipbtn" aria-label="Zoom out" onclick="p3Zoom('stage', 1 / 1.3)">−</button><button type="button" class="chipbtn" aria-label="Zoom in" onclick="p3Zoom('stage', 1.3)">+</button><button type="button" class="chipbtn" onclick="p3Inside('stage')">Inside / outside</button><button type="button" class="chipbtn" onclick="p3Top('stage')">Top / angle</button></div></div>`;
  };
  /* In the floor plan editor the 3D view sits under the plan and follows every move. */
  const oldEditor = bsEditor;
  bsEditor = function (o) {
    return oldEditor(o).replace(/<\/div>\s*$/, `<div class="p3d-ed"><div class="p3d-edhead"><strong>3D view</strong><span>Inside view: studs at 16 in on center, electrical on the studs</span><button type="button" class="chipbtn" aria-label="Zoom out" onclick="p3Zoom('editor', 1 / 1.3)">−</button><button type="button" class="chipbtn" aria-label="Zoom in" onclick="p3Zoom('editor', 1.3)">+</button><button type="button" class="chipbtn" onclick="p3Inside('editor')">Inside / outside</button><button type="button" class="chipbtn" onclick="p3Top('editor')">Top / angle</button></div>${p3dMarkup(o.c, 'editor')}</div></div>`);
  };
  /* While choosing colors the page is not redrawn, so point the 3D views at the new choices and repaint
     them at once: the model shows each color as it is picked. */
  const oldChange = change;
  change = function (...args) {
    const before = S.c, out = oldChange.apply(this, args);
    if (S.c !== before) {
      for (const v of Object.values(P3.views)) if (v.c === before) v.c = S.c;
      p3Paint();
    }
    return out;
  };
  /* While an item is being dragged on the plan, the 3D view follows at plain quality, then sharpens once the
     dragging stops. */
  const oldRefresh = bsEdRefresh;
  bsEdRefresh = function () {
    oldRefresh();
    P3.rush = true;
    p3Paint();
    P3.rush = false;
    clearTimeout(P3.settle);
    P3.settle = setTimeout(() => p3Paint(true), 350);
  };
}
