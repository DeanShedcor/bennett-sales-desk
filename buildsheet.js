/* buildsheet.js: the plant build sheet that goes with every order.
   Two landscape pages: (1) specs by crew, a plan with every item named in words, and a
   parts table; (2) each wall drawn flat like a tape measure, with start and end marks.

   The order does not record where doors, windows and boxes go, so the sheet starts from a
   STANDARD LAYOUT (rules below) and says so until the sales manager confirms or moves items.
   Anything the order does not say (light location, heights, door swing) is listed in the
   "Confirm before building" box instead of being guessed.

   Loaded last, after the Sales desk and Plant QC scripts. */

const BS = { key: null, edit: false, samples: {} };
const BS_FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
const BS_SCALED = 'Porch walls are drawn to scale from the configurator floor plan (4 ft deep, 8 ft long). Measured drawings still to come.';

/* 17.667 -> 17'-8"   (to the nearest eighth of an inch) */
function bsFeet(v) {
  let e = Math.round(v * 96);
  const ft = Math.floor(e / 96);
  e -= ft * 96;
  return `${ft}'-${Math.floor(e / 8)}${BS_FR[e % 8]}"`;
}
function bsSwapSides(s) {
  return s.replace(/left|right/gi, (m) => {
    const o = m.toLowerCase() === 'left' ? 'right' : 'left';
    return m === m.toUpperCase() ? o.toUpperCase() : m[0] === m[0].toUpperCase() ? o[0].toUpperCase() + o.slice(1) : o;
  });
}

/* ---------- Footprint: outline, walls, porch ----------
   x runs along the length, y across the width, in feet. Each wall is [name, hook end, far end,
   hook label, far label]; the tape is always hooked on the first point. */
function bsShape(c) {
  const [W, L] = c.size.split('x').map(Number);
  const pkg = activePackage(c) ? c.package : '';
  const gable = { top: 'LEFT SIDE', bottom: 'RIGHT SIDE', left: 'FRONT', right: 'BACK' };
  const longFront = { top: 'BACK', bottom: 'FRONT', left: 'LEFT END', right: 'RIGHT END' };
  const rect = [
    ['Left side wall', [0, 0], [L, 0], 'FRONT END', 'BACK END'],
    ['Back wall', [L, 0], [L, W], 'LEFT SIDE', 'RIGHT SIDE'],
    ['Right side wall', [0, W], [L, W], 'FRONT END', 'BACK END'],
    ['Front wall', [0, 0], [0, W], 'LEFT SIDE', 'RIGHT SIDE'],
  ];
  let sh = { sides: gable, walls: rect, poly: [[0, 0], [L, 0], [L, W], [0, W]], deck: null, posts: [], flags: [], roles: { entry: 3, barn: 1, windows: [0, 2], outlets: [0, 2, 1] } };
  let mirror = null;
  if (pkg === 'End Porch') {
    const p = 4;
    sh.walls = [
      ['Left side wall', [p, 0], [L, 0], 'FRONT END', 'BACK END'],
      rect[1],
      ['Right side wall', [p, W], [L, W], 'FRONT END', 'BACK END'],
      ['Front wall', [p, 0], [p, W], 'LEFT SIDE', 'RIGHT SIDE'],
    ];
    sh.poly = [[p, 0], [L, 0], [L, W], [p, W]];
    sh.deck = [[0, 0], [p, 0], [p, W], [0, W]];
    sh.posts = [[0, 0], [0, W / 2], [0, W]];
    sh.roles = { ...sh.roles, windows: W >= 10 ? [0, 2, 3] : [0, 2], winOpt: [{}, {}, W === 12 ? { at: 6.8229 } : { frac: 0.65 }], entryOpt: W === 12 ? { at: 2.1042 } : W >= 10 ? { frac: 0.3 } : {} };
    if (W !== 12) sh.flags.push('End porch front wall is measured for 12 ft wide. Door and window are placed in proportion for this width.');
  } else if (pkg === 'Deluxe Porch') {
    /* From the plant drawing for a 12 ft wide Deluxe Porch on the right. */
    sh.walls = [
      ['Left side wall', [4, 0], [L, 0], 'FRONT END', 'BACK END'],
      rect[1],
      ['Right side wall', [12, W], [L, W], 'FRONT END, AT THE PORCH DOOR WALL', 'BACK END'],
      ['Porch door wall', [12, W - 4], [12, W], 'CORNER OF THE PORCH SIDE WALL', 'RIGHT SIDE'],
      ['Porch side wall', [6, W - 4], [12, W - 4], 'CORNER OF THE ANGLED WALL', 'PORCH DOOR WALL'],
      ['Angled wall', [4, W - 8], [6, W - 4], 'CORNER OF THE FRONT WALL', 'PORCH SIDE WALL'],
      ['Front wall', [4, 0], [4, W - 8], 'LEFT SIDE', 'ANGLED WALL'],
    ];
    sh.poly = [[4, 0], [L, 0], [L, W], [12, W], [12, W - 4], [6, W - 4], [4, W - 8]];
    sh.deck = [[0, 0], [4, 0], [4, W - 8], [6, W - 4], [12, W - 4], [12, W], [0, W]];
    sh.posts = [[0, 0], [0, W - 8], [0, W], [8, W]];
    sh.roles = { entry: 3, barn: 1, windows: [6, 5, 4, 2, 0], winOpt: [{}, { at: 1.15625 }, {}, { at: Math.max(1, ((L - 12) * 11) / 12 - 8) }, {}], outlets: [0, 2, 1] };
    if (W !== 12) sh.flags.push('Porch walls are drawn from the 12 ft wide plant drawing. Confirm them for this width.');
    if ((c.porchSide || 'Left') === 'Left') mirror = 'y';
  } else if (pkg === 'Side Porch') {
    const pl = 8;
    sh.sides = longFront;
    sh.walls = [
      ['Back wall', [0, 0], [L, 0], 'LEFT END', 'RIGHT END'],
      ['Right end wall', [L, 0], [L, W - 4], 'BACK', 'PORCH'],
      ['Porch wall', [L - pl, W - 4], [L, W - 4], 'CORNER OF THE PORCH END WALL', 'RIGHT END'],
      ['Porch end wall', [L - pl, W - 4], [L - pl, W], 'CORNER OF THE PORCH WALL', 'FRONT'],
      ['Front wall', [0, W], [L - pl, W], 'LEFT END', 'PORCH'],
      ['Left end wall', [0, 0], [0, W], 'BACK', 'FRONT'],
    ];
    sh.poly = [[0, 0], [L, 0], [L, W - 4], [L - pl, W - 4], [L - pl, W], [0, W]];
    sh.deck = [[L - pl, W - 4], [L, W - 4], [L, W], [L - pl, W]];
    sh.posts = [[L, W], [L - pl / 2, W]];
    sh.roles = { entry: 2, entryOpt: { at: 4 }, barn: 5, windows: [2, 4, 0], winOpt: [{ at: 1 }], outlets: [0, 4, 5] };
    sh.flags.push(BS_SCALED);
    if ((c.porchSide || 'Left') === 'Left') mirror = 'x';
  } else if (pkg === 'Middle Porch') {
    const pl = 8, x1 = (L - pl) / 2, x2 = x1 + pl;
    sh.sides = longFront;
    sh.walls = [
      ['Back wall', [0, 0], [L, 0], 'LEFT END', 'RIGHT END'],
      ['Right end wall', [L, 0], [L, W], 'BACK', 'FRONT'],
      ['Front wall, right of porch', [x2, W], [L, W], 'PORCH', 'RIGHT END'],
      ['Porch right wall', [x2, W - 4], [x2, W], 'CORNER OF THE PORCH WALL', 'FRONT'],
      ['Porch wall', [x1, W - 4], [x2, W - 4], 'LEFT CORNER', 'RIGHT CORNER'],
      ['Porch left wall', [x1, W - 4], [x1, W], 'CORNER OF THE PORCH WALL', 'FRONT'],
      ['Front wall, left of porch', [0, W], [x1, W], 'LEFT END', 'PORCH'],
      ['Left end wall', [0, 0], [0, W], 'BACK', 'FRONT'],
    ];
    sh.poly = [[0, 0], [L, 0], [L, W], [x2, W], [x2, W - 4], [x1, W - 4], [x1, W], [0, W]];
    sh.deck = [[x1, W - 4], [x2, W - 4], [x2, W], [x1, W]];
    sh.posts = [[x1, W], [x2, W]];
    sh.roles = { entry: 4, entryOpt: { at: 1 }, barn: 1, windows: [4, 6, 2], winOpt: [{ at: 5 }], outlets: [0, 6, 7] };
    sh.flags.push(BS_SCALED + ' The porch is drawn centered on the length.');
  }
  if (c.style === 'Studio' && !pkg) {
    /* From the measured Studio plan: the double door and three transoms are on the long front wall. */
    sh.sides = longFront;
    sh.walls = [
      ['Back wall', [0, 0], [L, 0], 'LEFT END', 'RIGHT END'],
      ['Right end wall', [L, 0], [L, W], 'BACK', 'FRONT'],
      ['Front wall', [0, W], [L, W], 'LEFT END', 'RIGHT END'],
      ['Left end wall', [0, 0], [0, W], 'BACK', 'FRONT'],
    ];
    sh.roles = { entry: 2, barn: 1, windows: [0, 1, 3], outlets: [0, 3, 1] };
    sh.studio = true;
    if (L !== 12) sh.flags.push('Transoms are measured for a 12 ft long Studio. They are spaced evenly for this length.');
  }
  if (mirror) {
    const m = ([x, y]) => (mirror === 'y' ? [x, W - y] : [L - x, y]);
    sh.walls = sh.walls.map(([n, a, b, h, f]) => [bsSwapSides(n), m(a), m(b), bsSwapSides(h), bsSwapSides(f)]);
    sh.poly = sh.poly.map(m);
    sh.deck = sh.deck.map(m);
    sh.posts = sh.posts.map(m);
  }
  sh.walls = sh.walls.map(([name, a, b, hook, far], i) => ({ i, id: 'ABCDEFGHJK'[i], name, a, b, hook, far, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }));
  return { ...sh, L, W, pkg, minX: Math.min(...sh.poly.map((q) => q[0])) };
}

/* Lights hang from the ceiling: on the center line of the building, unless it is a Studio or
   the salesperson lifts that rule for the order. They keep 6 inches clear of the walls. */
const bsLightsFree = (c, sh) => !!sh.studio || !!c.sheet?.lightsFree;
function bsLightSpot(sh, free, x, y) {
  const q = [Math.round(x * 12) / 12, free ? Math.round(y * 12) / 12 : sh.W / 2];
  return [[0.49, 0], [-0.49, 0], [0, 0.49], [0, -0.49]].every(([dx, dy]) => bsInside(sh.poly, [q[0] + dx, q[1] + dy])) ? q : null;
}
const bsBulb = (x, y, k, color = '#0c1a28') =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})" fill="none" stroke="${color}" stroke-width="${(1.8 / k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"><path d="M-3.4 2.6a5.6 5.6 0 1 1 6.8 0c-.9.8-1.3 1.6-1.3 2.6h-4.200c0-1-.4-1.800-1.300-2.600z"/><path d="M-2 7.800h4M-1.100 10h2.200"/></g>`;
function bsDoorWidth(name) {
  const m = name.match(/(\d+)\s*[x×]\s*\d+/);
  return m ? +m[1] : /double|barn/i.test(name) ? 6 : 3;
}

/* ---------- Standard layout ----------
   Openings are spaced evenly on their wall. The first outlet goes 1'-4 5/8" before the first
   opening on its wall, the second 2'-9" after the last opening, the third 1'-8 3/8" from the
   hook end of the back wall: the spacing used on the plant's own drawings. */
function bsLayout(c) {
  const sh = bsShape(c), r = sh.roles, loose = [], put = sh.walls.map(() => []);
  const doors = [], wins = [];
  const pk = packageOpenings(c);
  if (pk.length)
    for (const t of pk) {
      const m = t.match(/^(\d+) × (\d)×(\d) windows?(.*)$/);
      if (m) for (let i = 0; i < +m[1]; i++) wins.push({ kind: 'window', name: `Window ${m[2]}×${m[3]}`, w: +m[2], note: m[4].replace(/^ with /, '').trim() });
      else if (/window/i.test(t)) loose.push(`${t}: in the dormer, not placed on a wall.`);
      else doors.push({ kind: 'door', name: t[0].toUpperCase() + t.slice(1), w: bsDoorWidth(t) });
    }
  else doors.push({ kind: 'door', name: doorName(c.door), w: bsDoorWidth(doorName(c.door)) });
  const mainDoors = doors.length;
  for (const d of c.extraDoors || []) doors.push({ kind: 'door', name: doorName(d), w: bsDoorWidth(doorName(d)) });
  for (const w of windowItems(c)) {
    if (w.option === 'Octagon') {
      loose.push('Octagon gable window: goes in the gable, not placed on a wall.');
      continue;
    }
    const sp = windowSpec(w)[0], wd = /^3/.test(sp) ? 3 : 2, g = windowGroup(w);
    wins.push({
      kind: 'window', name: `Window ${wd}×3${g > 1 ? ` ×${g}` : ''}`, w: wd * g,
      note: [/Insulated/.test(sp) && 'insulated', w.shutters && 'shutters', w.flower && 'flower box', w.transom && 'transom above'].filter(Boolean).join(', '),
    });
  }
  doors.forEach((d, i) => (d.key = 'd' + i));
  wins.forEach((w, i) => (w.key = 'w' + i));

  const spare = [...r.outlets];
  if (sh.pkg === 'Dormer Package') {
    /* Dormer doors sit on the long side, with the two package windows either side. */
    if (wins[0]) put[2].push(wins[0]);
    put[2].push(doors[0]);
    if (wins[1]) put[2].push(wins[1]);
    wins.slice(2).forEach((w, i) => put[[0, 3][i % 2]].push(w));
    sh.flags.push('Dormer doors and windows are drawn on the right side. Confirm the side.');
  } else {
    put[r.entry].push({ ...doors[0], ...(r.entryOpt || {}) });
    if (sh.pkg === 'Garage Package' && doors[1]) put[2].push({ ...doors[1], frac: 0.2 });
    else if (mainDoors > 1) put[r.barn].push(doors[1]);
    wins.forEach((w, i) => put[r.windows[i % r.windows.length]].push({ ...w, ...(r.winOpt?.[i] || {}) }));
  }
  doors.slice(Math.max(mainDoors, 1)).forEach((d, i) => put[spare[i % spare.length]].push(d));

  const items = [];
  put.forEach((list, wi) => {
    const len = sh.walls[wi].len;
    const fixed = list.some((x) => x.at != null || x.frac != null);
    const total = list.reduce((s, x) => s + x.w, 0);
    const gap = (len - total) / (list.length + 1);
    let run = 0;
    list.forEach((x, j) => {
      let at;
      if (x.at != null) at = x.at;
      else if (x.frac != null) at = Math.round((len * x.frac - x.w / 2) * 12) / 12;
      else if (fixed) at = Math.round(((len - x.w) / 2) * 12) / 12;
      else at = Math.round((gap * (j + 1) + run) * 12) / 12;
      run += x.w;
      if (gap < 0.25 && !fixed) loose.push(`${x.name} does not fit on the ${sh.walls[wi].name.toLowerCase()} with the other openings. Move it by hand.`);
      items.push({ key: x.key, kind: x.kind, name: x.name, note: x.note || '', w: x.w, wi, at: Math.max(0, Math.min(at, len - x.w)) });
    });
  });

  if (sh.studio) {
    const tw = 2 + 5 / 12, gap = (sh.L - 3 * tw) / 4;
    if (gap > 0) for (let i = 0; i < 3; i++) items.push({ key: 't' + i, kind: 'window', name: 'Transom, horizontal', note: 'high on the wall', w: tw, high: true, wi: 2, at: gap * (i + 1) + tw * i });
  }

  /* Electrical boxes. Transoms sit high on the wall, so boxes and doors may pass under them. */
  const el = c.electrical;
  if (el && el !== 'None') {
    const count = { 'Lights Only': 0, Minimal: 0, Basic: 1, Expanded: 3, Utility: 3 }[el];
    const spansOn = (wi) => items.filter((x) => x.wi === wi && x.w && !x.high).sort((a, b) => a.at - b.at);
    const clear = (wi, x) => x >= 0.25 && x <= sh.walls[wi].len - 0.25 && !spansOn(wi).some((s) => x > s.at - 0.3 && x < s.at + s.w + 0.3);
    const entry = items.find((x) => x.key === 'd0');
    if (entry) {
      const len = sh.walls[entry.wi].len;
      const tries = [entry.at + entry.w + 0.667, entry.at - 0.667, 0.115, len - 0.115];
      const x = tries.find((t) => t > 0.05 && t < len - 0.05 && !spansOn(entry.wi).some((s) => t > s.at - 0.05 && t < s.at + s.w + 0.05));
      if (x != null) items.push({ key: 's0', kind: 'switch', name: 'Light switch', note: 'by the main door', w: 0, wi: entry.wi, at: x });
      else loose.push('Light switch: no room beside the main door. Location not set.');
    }
    if (count == null) loose.push(`${el} electrical: the number of outlets is not known. Outlets are not placed.`);
    for (let i = 0; i < (count || 0); i++) {
      const wi = r.outlets[i], len = sh.walls[wi].len, sp = spansOn(wi);
      const first = i === 0 ? (sp.length ? sp[0].at - 1.3854 : len / 2) : i === 1 ? (sp.length ? sp[sp.length - 1].at + sp[sp.length - 1].w + 2.75 : len / 2) : 1.6979;
      const x = [first, len / 2, len / 4, (len * 3) / 4].find((t) => clear(wi, t));
      if (x != null) items.push({ key: 'o' + i, kind: 'outlet', name: 'Outlet', note: '', w: 0, wi, at: x });
      else loose.push(`Outlet ${i + 1}: no clear spot on the ${sh.walls[wi].name.toLowerCase()}. Location not set.`);
    }
    {
      const count = 1 + (Number(c.extraLights) || 0), mid = sh.W / 2;
      let xa = null, xb = null;
      for (let x = 0.5; x <= sh.L - 0.5; x += 0.25) if (bsLightSpot(sh, false, x, mid)) (xa ??= x), (xb = x);
      for (let i = 0; i < count && xa != null; i++) {
        const x = Math.round((xa + ((xb - xa) * (i + 1)) / (count + 1)) * 12) / 12;
        items.push({ key: 'l' + i, kind: 'light', name: 'Light', note: 'ceiling', w: 0, wi: -1, at: x, x, y: mid });
      }
      if (xa == null) loose.push('Light: no clear spot on the center line. Location not set.');
    }
    loose.push(el === 'Utility' ? 'Six-space breaker box: location is not on the order.' : 'Pigtail (drop-cord adapter): location is not on the order.');
    for (const e of electricalExtras(c)) if (e.key !== 'extraLights') loose.push(`${e.label[0].toUpperCase() + e.label.slice(1)}: location is not on the order.`);
  }

  /* Moves made by the sales manager. */
  const pos = c.sheet?.pos || {};
  for (const it of items) {
    const p = pos[it.key];
    if (it.kind === 'light') {
      const q = p && p.x != null && bsLightSpot(sh, bsLightsFree(c, sh), p.x, p.y);
      if (q) [it.x, it.y, it.at, it.moved] = [q[0], q[1], q[0], true];
      continue;
    }
    it.std = { wi: it.wi, at: it.at };
    if (p && sh.walls[p.wall]) {
      it.wi = p.wall;
      it.at = Math.max(0, Math.min(p.at, sh.walls[p.wall].len - it.w));
      it.moved = true;
    }
  }
  items.sort((a, b) => (a.wi < 0 ? 99 : a.wi) - (b.wi < 0 ? 99 : b.wi) || a.at - b.at);
  items.forEach((it, i) => (it.n = i + 1));

  if (doors.length) loose.push('Door swing and handle side are not on the order.');
  loose.push('Heights off the floor for windows, outlets and the switch are not on the order.');
  if (c.customOpening || c.customDoor) loose.push(`Custom door request (${c.customDoor || 'dimensions needed'}): not placed on a wall.`);
  if (c.buildOnSite) loose.push('Build on site: site review required.');
  return { sh, items, notes: [...loose, ...sh.flags], c };
}

/* ---------- Which order ---------- */
function bsOrder(key) {
  const qb = typeof Q !== 'undefined' ? Q.builds : [];
  const dealer = `Bennett Buildings of ${LOT_LOCATION}`;
  if (key.startsWith('qc:')) {
    const b = qb.find((x) => x.serial === key.slice(3));
    return b && { c: b.c, serial: b.serial, id: b.order !== b.serial ? b.order : '', customer: b.customer || '', dealer: b.dealer };
  }
  if (key === 'cfg') return { c: S.c, serial: '', id: 'Quote in progress', customer: S.customer || '', dealer };
  const s = S.sales.find((x) => x.id === key);
  if (s) return { c: s.c, serial: '', id: s.id, customer: s.customer, dealer };
  const b = qb.find((x) => x.order === key);
  if (b) return { c: b.c, serial: b.serial, id: key, customer: b.customer || '', dealer: b.dealer };
  const n = +key.slice(1), sample = sampleBuilds[n];
  BS.samples[key] ||= clone({ ...defaults, shield: n === 0, color: n === 0 ? 'Clay' : 'Blue', windows: n === 0 ? 1 : 0 });
  return sample && { c: BS.samples[key], serial: '', id: 'Sample order', customer: sample.title, dealer: 'ShedCor' };
}

/* ---------- Page pieces ---------- */
const bsBal = (n) => `<span class="bs-bal">${n}</span>`;
const bsTag = (id) => `<span class="bs-tag">${id}</span>`;
const bsSw = (hex) => (hex ? `<span class="bs-sw" style="background:${hex}"></span>` : '');

function bsBand(o, lay, page) {
  const c = o.c, ok = c.sheet?.ok;
  const cell = (k, v, cls = '') => `<div class="bs-cell ${cls}"><small>${k}</small><strong>${v}</strong></div>`;
  return `<div class="bs-band">
    <div class="bs-big"><b>${esc(c.size.replace('x', ' × '))}</b><span>Build sheet</span></div>
    ${cell('Style', esc(label(c).replace(c.size, '').trim() + (lay.sh.pkg ? ' · ' + lay.sh.pkg : '')))}
    ${lay.sh.pkg === 'Side Porch' || lay.sh.pkg === 'Deluxe Porch' ? cell('Porch side', (c.porchSide || 'Left').toUpperCase()) : ''}
    ${cell('Serial', esc(o.serial || 'Assigned at the plant'))}
    ${cell('Order', esc([o.id, o.customer].filter(Boolean).join(' · ') || '—'))}
    ${cell('Dealer', esc(o.dealer.replace('Bennett Buildings of ', 'Bennett · ')), 'bs-grow bs-clip')}
    ${cell('Layout', ok ? `Confirmed ${new Date(ok).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'NOT CONFIRMED', ok ? '' : 'bs-warn')}
    ${cell('Sheet', `${page} of 2`)}
  </div>`;
}

function bsSpec(c, lay) {
  const pkg = activePackage(c), wood = usesWoodOptions(c);
  const count = (list) => Object.entries(list.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).map(([k, n]) => `${n} × ${k}`);
  const openings = count(lay.items.filter((x) => x.w).map((x) => x.name.toLowerCase() + (x.note ? `, ${x.note}` : '')));
  const elec = { 'Lights Only': ['1 light', '1 switch', '1 drop-cord adapter'], Minimal: ['1 light', '1 switch', '1 drop-cord adapter'], Basic: ['1 light', '1 switch', '1 outlet', '1 drop-cord adapter'], Expanded: ['1 light', '1 switch', '3 outlets', '1 drop-cord adapter'], Utility: ['1 light', '1 switch', '3 outlets', 'Six-space breaker box'] }[c.electrical] || [];
  const groups = [
    ['Floor', [`Floor joists ${c.floor || pkg?.floor ? '12" on center (upgrade)' : '16" on center'}`, `${lay.sh.W} × ${lay.sh.L} ft footprint`]],
    ['Walls', [
      wood ? (c.wallHeight ? `${c.wallHeight} ft sidewall` : 'Standard sidewall height') : 'Metal building',
      `Siding: ${esc(c.siding)}`,
      c.shield && 'TechShield radiant barrier',
      `Walls ${lay.sh.walls[0].id} to ${lay.sh.walls[lay.sh.walls.length - 1].id}: sheet 2`,
    ]],
    ['Doors &amp; windows', openings.length ? openings.map(esc) : ['None on the order']],
    ['Roof', [
      c.roof === 'Metal' ? `Metal roof, ${bsSw(metalRoofColors[c.roofColor])}${esc(c.roofColor || 'color not chosen')}` : 'Architectural shingles',
      c.style === 'Lofted' ? 'Gambrel roof, front and rear lofts' : c.style === 'Low-Wall Barn' ? 'Gambrel roof' : c.style === 'Studio' ? 'Single-slope roof' : 'Gable roof',
      c.package === 'Dormer Package' && pkg && esc(dormerOption(c).label),
    ]],
    ['Paint', [
      `Siding ${bsSw(paintColors[c.color])}${esc(c.color)}`,
      `Trim ${bsSw(paintColors[c.trimColor || 'Origami White'])}${esc(c.trimColor || 'Origami White')}`,
      c.doorColor && `Doors ${bsSw(paintColors[c.doorColor])}${esc(c.doorColor)}`,
      c.doorTrimColor && `Door trim ${bsSw(paintColors[c.doorTrimColor])}${esc(c.doorTrimColor)}`,
      wood && c.accentColor && `${c.accentArea === 'lower' ? 'Two-tone lower' : 'Accent gable'} ${esc(c.accentColor)}`,
      wood && c.customPaint && `Paint match ${esc(c.customPaint)}`,
    ]],
    [pkg?.porch ? 'Porch' : 'Package', pkg ? [esc(c.package), pkg.porch && esc(pkg.porch), (c.package === 'Side Porch' || c.package === 'Deluxe Porch') && `On the ${(c.porchSide || 'Left').toUpperCase()}`] : ['No building package']],
    ['Electrical', c.electrical && c.electrical !== 'None' ? [`${esc(c.electrical)} package`, ...elec, ...electricalExtras(c).map((e) => esc(e.label))] : ['No electrical']],
  ];
  return `<div class="bs-spec">${groups.map(([name, list]) => `<div><h3>${name}</h3><ul>${list.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>`;
}

/* ---------- Plan drawing ---------- */
function bsInside(poly, [x, y]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bsWallGeo(sh, w) {
  const d = [(w.b[0] - w.a[0]) / w.len, (w.b[1] - w.a[1]) / w.len];
  let n = [-d[1], d[0]];
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  if (!bsInside(sh.poly, [mid[0] + n[0] * 0.2, mid[1] + n[1] * 0.2])) n = [-n[0], -n[1]];
  return { d, n, at: (t) => [w.a[0] + d[0] * t, w.a[1] + d[1] * t] };
}
/* Lay labels out along a line so none overlap, keeping the group centered on its items.
   Returns how far the worst label ended up from where it wanted to be. */
function bsSlot(list, lo, hi, gap) {
  if (!list.length) return 0;
  list.sort((a, b) => a.want - b.want);
  let prev = -Infinity;
  for (const l of list) {
    l.pos = Math.max(l.want, prev + gap);
    prev = l.pos + l.size;
  }
  let shift = list.reduce((sum, l) => sum + l.want - l.pos, 0) / list.length;
  const last = list[list.length - 1];
  shift = Math.min(shift, hi - (last.pos + last.size));
  shift = Math.max(shift, lo - list[0].pos);
  for (const l of list) l.pos += shift;
  return Math.max(...list.map((l) => Math.abs(l.pos - l.want)));
}
/* The roomiest spot on the porch deck, for its label. */
function bsPole(sh) {
  const seg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const edges = [sh.deck, sh.poly].flatMap((poly) => poly.map((q, i) => [q, poly[(i + 1) % poly.length]]));
  let best = null, score = 0;
  for (let x = 0.5; x < sh.L; x += 0.5)
    for (let y = 0.5; y < sh.W; y += 0.5) {
      if (!bsInside(sh.deck, [x, y]) || bsInside(sh.poly, [x, y])) continue;
      const d = Math.min(...edges.map(([a, b]) => seg([x, y], a, b)));
      if (d > score) (score = d), (best = [x, y]);
    }
  return best;
}
/* A light grid over the floor, one square per foot, clipped to the building outline. */
function bsGrid(sh, P, id, color, width) {
  const f = (v) => v.toFixed(1), [x0, y0] = P([0, 0]), [x1, y1] = P([sh.L, sh.W]);
  let d = '';
  for (let x = 1; x < sh.L; x++) d += `M${f(P([x, 0])[0])} ${f(y0)}V${f(y1)}`;
  for (let y = 1; y < sh.W; y++) d += `M${f(x0)} ${f(P([0, y])[1])}H${f(x1)}`;
  return `<clipPath id="${id}"><polygon points="${sh.poly.map((q) => P(q).map(f).join(',')).join(' ')}"/></clipPath><path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" clip-path="url(#${id})"/>`;
}
function bsPlan(lay) {
  const { sh, items } = lay, { L, W } = sh;
  const VW = 1040, VH = 392, Sc = Math.min(680 / L, 164 / W, 30);
  const bw = L * Sc, bh = W * Sc, X0 = 180 + (680 - bw) / 2, Y0 = 86;
  const P = ([x, y]) => [X0 + x * Sc, Y0 + y * Sc];
  const pts = (l) => l.map((q) => P(q).map((v) => v.toFixed(1)).join(',')).join(' ');
  const f = (v) => v.toFixed(1);
  const bal = (x, y, n, r = 9.5) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#111"/><text x="${f(x)}" y="${f(y + 3.5)}" text-anchor="middle" font-size="${n > 9 ? 9 : 10}" font-weight="700" fill="#fff">${n}</text>`;
  const o = [`<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plan of the building from above">`];
  o.push('<defs><pattern id="bsdeck" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6H6" stroke="#9a9a9a" stroke-width="0.7"/></pattern></defs>');
  if (sh.deck) o.push(`<polygon points="${pts(sh.deck)}" fill="url(#bsdeck)" stroke="#111" stroke-width="1" stroke-dasharray="4 3"/>`);
  o.push(`<polygon points="${pts(sh.poly)}" fill="#fff"/>${bsGrid(sh, P, 'bsgridp', '#cfd6dc', 0.6)}<polygon points="${pts(sh.poly)}" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="miter"/>`);
  for (const q of sh.posts) {
    const [x, y] = P(q);
    o.push(`<rect x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8" fill="#111"/>`);
  }
  const pole = sh.deck && bsPole(sh);
  if (pole) {
    const [x, y] = P(pole);
    o.push(`<text x="${f(x)}" y="${f(y + 3)}" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="1">PORCH</text>`);
  }
  const labels = { top: [], bottom: [], left: [], right: [] };
  for (const w of sh.walls) {
    const g = bsWallGeo(sh, w), on = items.filter((x) => x.wi === w.i);
    for (const it of on) {
      const a = P(g.at(it.at)), b = P(g.at(it.at + it.w));
      if (it.high) o.push(`<line x1="${f(a[0] - g.n[0] * 7)}" y1="${f(a[1] - g.n[1] * 7)}" x2="${f(b[0] - g.n[0] * 7)}" y2="${f(b[1] - g.n[1] * 7)}" stroke="#111" stroke-width="3.5"/>`);
      else if (it.w) {
        o.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#fff" stroke-width="7"/>`);
        if (it.kind === 'window') o.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#111" stroke-width="5.5"/><line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#fff" stroke-width="2.4"/>`);
        else o.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#111" stroke-width="1.2" stroke-dasharray="3 2"/>`);
      } else {
        const x = a[0] + g.n[0] * 12, y = a[1] + g.n[1] * 12;
        if (it.kind === 'outlet') o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M${f(x - 2)} ${f(y - 3)}v6M${f(x + 2)} ${f(y - 3)}v6" stroke="#111" stroke-width="1.4"/>`);
        else o.push(`<rect x="${f(x - 6)}" y="${f(y - 6)}" width="12" height="12" fill="#fff" stroke="#111" stroke-width="1.5"/><text x="${f(x)}" y="${f(y + 3.6)}" text-anchor="middle" font-size="9.5" font-weight="800">S</text>`);
      }
      const mid = P(g.at(it.at + it.w / 2));
      const side = Math.abs(g.n[0]) > Math.abs(g.n[1]) ? (g.n[0] > 0 ? 'left' : 'right') : g.n[1] > 0 ? 'top' : 'bottom';
      const sub = `Wall ${w.id}${it.note ? ' · ' + it.note : ''}`;
      labels[side].push({ it, x: mid[0], y: mid[1], sub, tw: 30 + Math.max(it.name.length * 6.6, sub.length * 5) });
    }
    /* Wall letter in the longest clear stretch of the wall, or just outside a crowded wall. */
    const cuts = [0, ...on.map((x) => (x.w ? [x.at, x.at + x.w] : [x.at - 0.7, x.at + 0.7])).sort((a, b) => a[0] - b[0]).flat(), w.len];
    let best = [0, 0];
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > best[1] - best[0]) best = [cuts[i], cuts[i + 1]];
    const roomy = (best[1] - best[0]) * Sc >= 24, [tx, ty] = P(g.at(roomy ? (best[0] + best[1]) / 2 : w.len / 2));
    w.tagAt = roomy ? [tx, ty] : [tx - g.n[0] * 17, ty - g.n[1] * 17];
  }
  const text = (l, x, y, anchor) =>
    `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-size="10.5" font-weight="700">${esc(l.it.name)}</text><text x="${f(x)}" y="${f(y + 11)}" text-anchor="${anchor}" font-size="8.6" fill="#333">${esc(l.sub)}</text>`;
  /* Rows above and below the building. */
  for (const side of ['top', 'bottom']) {
    const all = labels[side].sort((a, b) => a.x - b.x);
    all.forEach((l) => ((l.want = l.x - 10), (l.size = l.tw)));
    let rows = [all];
    if (bsSlot(all, 16, VW - 16, 10) > 70 && all.length > 2) rows = [all.filter((_, i) => i % 2 === 0), all.filter((_, i) => i % 2 === 1)];
    rows.forEach((row, ri) => {
      bsSlot(row, 16, VW - 16, 10);
      const cy = side === 'top' ? Y0 - 22 - ri * 26 : Y0 + bh + 22 + ri * 26;
      for (const l of row) {
        const cx = l.pos + 10;
        o.push(`<line x1="${f(l.x)}" y1="${f(l.y)}" x2="${f(cx)}" y2="${f(cy)}" stroke="#111" stroke-width="0.9"/>${bal(cx, cy, l.it.n)}${text(l, cx + 14, cy, 'start')}`);
      }
    });
  }
  /* Columns left and right of the building. */
  for (const side of ['left', 'right']) {
    const col = labels[side];
    col.forEach((l) => ((l.want = l.y - 10), (l.size = 22)));
    bsSlot(col, Y0 - 14, Y0 + bh + 14, 5);
    const cx = side === 'left' ? X0 - 40 : X0 + bw + 50;
    for (const l of col) {
      const cy = l.pos + 10;
      o.push(`<line x1="${f(l.x)}" y1="${f(l.y)}" x2="${f(cx)}" y2="${f(cy)}" stroke="#111" stroke-width="0.9"/>${bal(cx, cy, l.it.n)}${text(l, side === 'left' ? cx - 14 : cx + 14, cy, side === 'left' ? 'end' : 'start')}`);
    }
  }
  for (const it of items.filter((x) => x.kind === 'light')) {
    const [x, y] = P([it.x, it.y]);
    o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="#fff" stroke="#111" stroke-width="1.5"/>${bsBulb(x, y - 1.5, 0.62, '#111')}${bal(x + 18, y, it.n, 8)}`);
  }
  for (const w of sh.walls) o.push(`<rect x="${f(w.tagAt[0] - 9)}" y="${f(w.tagAt[1] - 9)}" width="18" height="18" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="${f(w.tagAt[0])}" y="${f(w.tagAt[1] + 4)}" text-anchor="middle" font-size="11.5" font-weight="800">${w.id}</text>`);
  /* Side names and overall size. */
  const name = (x, y, t, a = 'middle') => `<text x="${f(x)}" y="${f(y)}" text-anchor="${a}" font-size="13" font-weight="800" letter-spacing="2">${t}</text>`;
  const dy = Y0 + bh + 82;
  o.push(name(X0 + bw / 2, 16, sh.sides.top), name(14, 18, sh.sides.left, 'start'), name(VW - 14, 18, sh.sides.right, 'end'), name(X0 + bw / 2, dy + 24, sh.sides.bottom));
  o.push(`<path d="M${f(X0)} ${dy}H${f(X0 + bw)}M${f(X0)} ${dy - 5}v10M${f(X0 + bw)} ${dy - 5}v10" stroke="#111" stroke-width="1" fill="none"/>`);
  o.push(`<rect x="${f(X0 + bw / 2 - 112)}" y="${dy - 8}" width="224" height="16" fill="#fff"/><text x="${f(X0 + bw / 2)}" y="${dy + 4}" text-anchor="middle" font-size="11.5" font-weight="800">${bsFeet(L)} long · ${bsFeet(W)} wide overall</text>`);
  /* How to read. */
  const ky = VH - 22;
  o.push(`<text x="14" y="${ky + 12.5}" font-size="8" font-weight="700" letter-spacing="1">HOW TO READ</text>`);
  o.push(bal(100, ky + 9, 1, 8) + `<text x="113" y="${ky + 12.5}" font-size="9">item number, same on sheet 2</text>`);
  o.push(`<rect x="262" y="${ky}" width="18" height="18" fill="#fff" stroke="#111" stroke-width="1.6"/><text x="271" y="${ky + 13}" text-anchor="middle" font-size="11.5" font-weight="800">A</text><text x="286" y="${ky + 12.5}" font-size="9">wall letter</text>`);
  o.push(`<line x1="350" y1="${ky + 9}" x2="376" y2="${ky + 9}" stroke="#111" stroke-width="5.5"/><line x1="350" y1="${ky + 9}" x2="376" y2="${ky + 9}" stroke="#fff" stroke-width="2.4"/><text x="382" y="${ky + 12.5}" font-size="9">window</text>`);
  o.push(`<line x1="430" y1="${ky + 9}" x2="456" y2="${ky + 9}" stroke="#111" stroke-width="1.2" stroke-dasharray="3 2"/><text x="462" y="${ky + 12.5}" font-size="9">door</text>`);
  o.push(`<circle cx="504" cy="${ky + 9}" r="6" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M502 ${ky + 6}v6M506 ${ky + 6}v6" stroke="#111" stroke-width="1.4"/><text x="515" y="${ky + 12.5}" font-size="9">outlet</text>`);
  o.push(`<rect x="556" y="${ky + 3}" width="12" height="12" fill="#fff" stroke="#111" stroke-width="1.5"/><text x="562" y="${ky + 12.6}" text-anchor="middle" font-size="9.5" font-weight="800">S</text><text x="573" y="${ky + 12.5}" font-size="9">switch</text>`);
  if (sh.deck) o.push(`<rect x="614" y="${ky + 5}" width="8" height="8" fill="#111"/><text x="627" y="${ky + 12.5}" font-size="9">porch post</text>`);
  o.push(`<rect x="${sh.deck ? 700 : 614}" y="${ky + 4}" width="10" height="10" fill="#fff" stroke="#b9c2ca" stroke-width="0.8"/><text x="${sh.deck ? 715 : 629}" y="${ky + 12.5}" font-size="9">grid square = 1 ft</text>`);
  if (items.some((x) => x.kind === 'light')) o.push(`<circle cx="${sh.deck ? 826 : 740}" cy="${ky + 9}" r="7" fill="#fff" stroke="#111" stroke-width="1.5"/>${bsBulb(sh.deck ? 826 : 740, ky + 7.7, 0.55, '#111')}<text x="${sh.deck ? 838 : 752}" y="${ky + 12.5}" font-size="9">light</text>`);
  o.push('</svg>');
  return o.join('');
}

const bsSideWall = (t) => t.toLowerCase() + (/wall|side|end/i.test(t) ? '' : ' wall');
const bsWhere = (it, sh) => (it.kind === 'light' ? `${bsFeet(it.x - (sh?.minX || 0))} from the ${sh ? bsSideWall(sh.sides.left) : 'front'}, ${bsFeet(it.y)} from the ${sh ? bsSideWall(sh.sides.top) : 'left side'}` : it.w ? `${bsFeet(it.at)} to ${bsFeet(it.at + it.w)}` : `${bsFeet(it.at)} to center`);

function bsSchedule(lay) {
  const half = Math.ceil(lay.items.length / 2);
  const tbl = (list) =>
    list.length
      ? `<table><thead><tr><th>#</th><th>Item</th><th>Wall</th><th>Position on the wall</th></tr></thead><tbody>${list
          .map((it) => `<tr><td>${bsBal(it.n)}</td><td><b>${esc(it.name)}</b>${it.note ? ' · ' + esc(it.note) : ''}</td><td>${it.wi < 0 ? 'Ceiling' : `${bsTag(lay.sh.walls[it.wi].id)} ${esc(lay.sh.walls[it.wi].name)}`}</td><td>${bsWhere(it, lay.sh)}${it.moved ? ' · moved' : ''}</td></tr>`)
          .join('')}</tbody></table>`
      : '<div></div>';
  return `<h2>What goes where · every position is drawn wall by wall on sheet 2 · open questions are listed on sheet 2</h2><div class="bs-two">${tbl(lay.items.slice(0, half))}${tbl(lay.items.slice(half))}</div>`;
}

/* ---------- One wall, drawn flat like a tape measure ---------- */
function bsStrip(lay, w, scale) {
  const on = lay.items.filter((x) => x.wi === w.i).sort((a, b) => a.at - b.at);
  const texts = on.map((it) => `${it.name}: ${bsWhere(it)}`);
  const need = Math.max(0, ...texts.map((t) => 26 + t.length * 5.8));
  const wpx = w.len * scale, x0 = 8, width = Math.max(x0 + wpx + 56, need + 6, 190);
  const rowEnd = [];
  const placed = on.map((it, i) => {
    const xc = x0 + (it.at + it.w / 2) * scale, tw = 22 + texts[i].length * 5.8;
    const left = Math.min(Math.max(2, xc - tw / 2), Math.max(2, width - tw - 2));
    let row = rowEnd.findIndex((e) => left > e + 10);
    if (row < 0) row = rowEnd.length;
    rowEnd[row] = left + tw;
    return { it, left, row, text: texts[i] };
  });
  const top = 12 + Math.max(1, rowEnd.length) * 17, barh = 26, h = top + barh + 46;
  const f = (v) => v.toFixed(1);
  const bal = (x, y, n, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#111"/><text x="${f(x)}" y="${f(y + 3.4)}" text-anchor="middle" font-size="${n > 9 ? 8.5 : 9.5}" font-weight="700" fill="#fff">${n}</text>`;
  const o = [`<svg width="${f(width)}" height="${h}" viewBox="0 0 ${f(width)} ${h}" xmlns="http://www.w3.org/2000/svg">`];
  o.push(`<rect x="${x0}" y="${top}" width="${f(wpx)}" height="${barh}" fill="#d9d9d9" stroke="#111" stroke-width="1.6"/>`);
  for (const it of on) {
    const xs = x0 + it.at * scale, xe = x0 + (it.at + it.w) * scale;
    if (it.high) {
      o.push(`<rect x="${f(xs)}" y="${top}" width="${f(xe - xs)}" height="9" fill="#fff" stroke="#111" stroke-width="1.4"/><path d="M${f(xs)} ${top - 4}V${top}M${f(xe)} ${top - 4}V${top}" stroke="#111" stroke-width="1"/>`);
      o.push(bal((xs + xe) / 2, top - 1, it.n, 7));
      continue;
    }
    if (it.w) {
      o.push(`<rect x="${f(xs)}" y="${top}" width="${f(xe - xs)}" height="${barh}" fill="#fff" stroke="#111" stroke-width="1.6"/>`);
      if (it.kind === 'window') o.push(`<line x1="${f(xs)}" y1="${top + barh / 2}" x2="${f(xe)}" y2="${top + barh / 2}" stroke="#111" stroke-width="1"/>`);
      o.push(`<path d="M${f(xs)} ${top - 4}V${top + barh + 14}M${f(xe)} ${top - 4}V${top + barh + 14}" stroke="#111" stroke-width="1"/>`);
    } else o.push(`<path d="M${f(xs)} ${top - 4}V${top + barh + 14}" stroke="#111" stroke-width="1.2"/>`);
    o.push(bal((xs + xe) / 2, top + barh / 2, it.n, 8.5));
  }
  for (const p of placed) {
    const ty = top - 10 - p.row * 17;
    o.push(bal(p.left + 8, ty - 3.5, p.it.n, 7.5) + `<text x="${f(p.left + 20)}" y="${ty}" font-size="10.5" font-weight="700">${esc(p.text)}</text>`);
  }
  const ty = top + barh + 14, step = w.len > 16 ? 4 : w.len > 6 ? 2 : 1;
  o.push(`<line x1="${x0}" y1="${ty}" x2="${f(x0 + wpx)}" y2="${ty}" stroke="#111" stroke-width="1"/>`);
  for (let ft = 0; ft <= w.len + 1e-6; ft++) {
    const x = x0 + ft * scale, big = ft % step === 0;
    o.push(`<line x1="${f(x)}" y1="${ty}" x2="${f(x)}" y2="${ty + (big ? 6 : 3)}" stroke="#111" stroke-width="${big ? 1 : 0.6}"/>`);
    if (big && ft > 0 && w.len - ft > 0.3) o.push(`<text x="${f(x)}" y="${ty + 15}" text-anchor="middle" font-size="8">${ft}'</text>`);
  }
  o.push(`<line x1="${f(x0 + wpx)}" y1="${ty}" x2="${f(x0 + wpx)}" y2="${ty + 6}" stroke="#111" stroke-width="1"/><text x="${f(x0 + wpx + 6)}" y="${ty + 3.5}" font-size="9" font-weight="800">${bsFeet(w.len)}</text>`);
  o.push(`<path d="M${x0} ${ty + 20}v9M${x0} ${ty + 24.5}h16m-5 -3.5l5 3.5l-5 3.5" fill="none" stroke="#111" stroke-width="1.6"/><text x="${x0 + 21}" y="${ty + 28}" font-size="8.6" font-weight="800">0' HOOK TAPE: ${esc(w.hook)}</text>`);
  if (wpx > 420) o.push(`<text x="${f(x0 + wpx)}" y="${ty + 28}" text-anchor="end" font-size="8.6" font-weight="600" fill="#333">${esc(w.far)}</text>`);
  o.push('</svg>');
  return `<div class="bs-wall"><div class="bs-walltitle">${bsTag(w.id)}${esc(w.name)} <small>${bsFeet(w.len)} long</small></div>${o.join('')}</div>`;
}

function bsConfirmBox(lay) {
  const ok = lay.c.sheet?.ok;
  return `<div class="bs-confirm"><h2>Confirm before building</h2>
    <p>${ok ? 'The sales manager confirmed the positions on this sheet.' : '<b>Positions are the standard layout.</b> The sales manager has not confirmed them yet.'} The order does not say the items below, so they are listed instead of guessed.</p>
    <ul>${lay.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}

function bsPages(o) {
  const lay = bsLayout(o.c), walls = lay.sh.walls;
  const used = walls.filter((w) => lay.items.some((x) => x.wi === w.i)), bare = walls.filter((w) => !used.includes(w));
  const scale = Math.min(23, 900 / Math.max(...walls.map((w) => w.len)));
  const foot = (a, b) => `<div class="bs-foot"><span>${a}</span><span>${b}</span></div>`;
  return `<section class="bs-page"><div class="bs-fit">${bsBand(o, lay, 1)}${bsSpec(o.c, lay)}
      <div class="bs-plan">${bsPlan(lay)}</div>
      <div class="bs-lower">${bsSchedule(lay)}</div></div>
      ${foot('Prices are left off this sheet. Positions are measured along each wall from the end marked on sheet 2.', 'Sheet 1 of 2 · Plan and parts')}
    </section>
    <section class="bs-page"><div class="bs-fit">${bsBand(o, lay, 2)}
      <div class="bs-how"><b>How to read a wall strip:</b> hook the tape on the end marked 0′ and pull along the wall. Each opening shows where it <b>starts</b> and where it <b>ends</b> on the tape. Outlets and the switch show the distance to the <b>center of the box</b>.</div>
      <div class="bs-walls">${[...used].sort((a, b) => b.len - a.len).map((w) => bsStrip(lay, w, scale)).join('')}</div>
      ${bare.length ? `<p class="bs-bare"><b>Nothing on:</b> ${bare.map((w) => `${bsTag(w.id)} ${esc(w.name)}, ${bsFeet(w.len)}`).join(' &nbsp; ')}</p>` : ''}
      ${bsConfirmBox(lay)}</div>
      ${foot('Box positions are to the center of the box.', 'Sheet 2 of 2 · Wall by wall')}
    </section>`;
}

/* ---------- Floor plan editor ----------
   The salesperson drags doors, windows, outlets and the switch along a wall or onto another
   wall. Positions snap to the inch and openings cannot overlap. What is set here is what the
   build sheet prints. */
function bsEdGeom(sh) {
  /* One drawing unit is one screen pixel, so items stay finger-sized on a phone. */
  const VW = Math.max(330, Math.min(1000, window.innerWidth - 58)), m = VW < 600 ? 50 : 80, Y0 = VW < 600 ? 64 : 76;
  const Sc = Math.min((VW - 2 * m) / sh.L, 520 / sh.W, 64);
  return { VW, Sc, X0: (VW - sh.L * Sc) / 2, Y0, VH: sh.W * Sc + 2 * Y0, side: VW < 600 ? 36 : 52 };
}
/* Where an item may start on a wall: the spot nearest to `want` that clears the other openings. */
function bsEdFit(lay, it, wi, want) {
  const len = lay.sh.walls[wi].len, gap = it.w ? 0.25 : 0.1;
  const others = lay.items.filter((x) => x !== it && x.wi === wi && x.w && !x.high === !it.high).sort((a, b) => a.at - b.at);
  const slots = [];
  let lo = 0;
  for (const o of others) {
    slots.push([lo, o.at - gap - it.w]);
    lo = o.at + o.w + gap;
  }
  slots.push([lo, len - it.w]);
  let best = null;
  for (const [a, b] of slots) {
    if (b < a - 1e-9) continue;
    const at = Math.min(Math.max(want, a), b);
    if (best == null || Math.abs(at - want) < Math.abs(best - want)) best = at;
  }
  return best == null ? null : Math.round(best * 96) / 96;
}
function bsEdPlace(key, wi, want) {
  const o = bsOrder(BS.key), lay = bsLayout(o.c), it = lay.items.find((x) => x.key === key);
  if (!it) return false;
  const at = bsEdFit(lay, it, wi, Math.round(want * 12) / 12);
  if (at == null) return false;
  const sheet = (o.c.sheet ||= { pos: {}, ok: null });
  sheet.pos[key] = { wall: wi, at };
  sheet.ok = null;
  return true;
}
function bsEdDraw(lay) {
  const { sh, items } = lay, g = bsEdGeom(sh), f = (v) => v.toFixed(1);
  const P = ([x, y]) => [g.X0 + x * g.Sc, g.Y0 + y * g.Sc];
  const pts = (l) => l.map((q) => P(q).map(f).join(',')).join(' ');
  const o = ['<defs><pattern id="bseddeck" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#e9dcc6"/><path d="M0 9H9" stroke="#bfa57f" stroke-width="1"/></pattern></defs>'];
  if (sh.deck) o.push(`<polygon points="${pts(sh.deck)}" fill="url(#bseddeck)" stroke="#8a7350" stroke-width="1.5"/>`);
  o.push(`<polygon points="${pts(sh.poly)}" fill="#fbf7ee"/>${bsGrid(sh, P, 'bsgride', '#e3d9c4', 1)}<polygon points="${pts(sh.poly)}" fill="none" stroke="#0c1a28" stroke-width="9" stroke-linejoin="miter"/>`);
  for (const q of sh.posts) {
    const [x, y] = P(q);
    o.push(`<rect x="${f(x - 6)}" y="${f(y - 6)}" width="12" height="12" fill="#0c1a28"/>`);
  }
  const pole = sh.deck && bsPole(sh);
  if (pole) {
    const [x, y] = P(pole);
    o.push(`<text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-size="13" font-weight="700" fill="#6b5433" letter-spacing="1.5">PORCH</text>`);
  }
  const bw = sh.L * g.Sc, bh = sh.W * g.Sc;
  const side = (x, y, t, rot = 0) => `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-size="${g.VW < 600 ? 11 : 15}" font-weight="800" letter-spacing="2" fill="#566879" ${rot ? `transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''}>${t}</text>`;
  o.push(side(g.X0 + bw / 2, 22, sh.sides.top), side(g.X0 + bw / 2, g.VH - 10, sh.sides.bottom), side(g.X0 - g.side, g.Y0 + bh / 2, sh.sides.left, -90), side(g.X0 + bw + g.side, g.Y0 + bh / 2, sh.sides.right, 90));
  for (const w of sh.walls) {
    const geo = bsWallGeo(sh, w), on = items.filter((x) => x.wi === w.i);
    const cuts = [0, ...on.map((x) => (x.w ? [x.at, x.at + x.w] : [x.at - 0.5, x.at + 0.5])).sort((a, b) => a[0] - b[0]).flat(), w.len];
    let best = [0, 0];
    for (let i = 0; i < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > best[1] - best[0]) best = [cuts[i], cuts[i + 1]];
    const [tx, ty] = P(geo.at((best[0] + best[1]) / 2)), tag = [tx + geo.n[0] * 22, ty + geo.n[1] * 22];
    o.push(`<text x="${f(tag[0])}" y="${f(tag[1] + 5)}" text-anchor="middle" font-size="14" font-weight="800" fill="#93a1ae">${w.id}</text>`);
    for (const it of on) {
      const a = P(geo.at(it.at)), b = P(geo.at(it.at + it.w)), mid = P(geo.at(it.at + it.w / 2)), sel = BS.sel === it.key;
      const line = (stroke, width, extra = '') => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
      const out = [mid[0] - geo.n[0] * 26, mid[1] - geo.n[1] * 26];
      let art;
      if (it.high) {
        const up = (q) => [q[0] - geo.n[0] * 10, q[1] - geo.n[1] * 10], a2 = up(a), b2 = up(b);
        const hl = (stroke, width) => `<line x1="${f(a2[0])}" y1="${f(a2[1])}" x2="${f(b2[0])}" y2="${f(b2[1])}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
        art = (sel ? hl('#ffb703', 18) : '') + hl('#0c1a28', 7) + hl('#bfe3f5', 3) + hl('transparent', 30);
      } else if (it.w) {
        art = (sel ? line('#ffb703', 22, 'stroke-linecap="round"') : '') + line('#fbf7ee', 11);
        art += it.kind === 'window' ? line('#0c1a28', 9) + line('#bfe3f5', 4) : line('#8a5a2b', 7) + line('#e7c79c', 3);
        art += line('transparent', 40, 'stroke-linecap="round"');
      } else {
        /* Teardrop: the round end carries the symbol and the point touches the spot on the wall. */
        const r = 15, tip = [a[0] + geo.n[0] * 5, a[1] + geo.n[1] * 5], c = [a[0] + geo.n[0] * 31, a[1] + geo.n[1] * 31];
        const th = Math.atan2(-geo.n[1], -geo.n[0]), al = Math.acos(r / 26);
        const t1 = [c[0] + r * Math.cos(th + al), c[1] + r * Math.sin(th + al)], t2 = [c[0] + r * Math.cos(th - al), c[1] + r * Math.sin(th - al)];
        const drop = `M${f(tip[0])} ${f(tip[1])}L${f(t1[0])} ${f(t1[1])}A${r} ${r} 0 1 1 ${f(t2[0])} ${f(t2[1])}Z`;
        art = `${sel ? `<path d="${drop}" fill="#ffb703" stroke="#ffb703" stroke-width="10" stroke-linejoin="round"/>` : ''}<path d="${drop}" fill="#fff" stroke="#0c1a28" stroke-width="2.2" stroke-linejoin="round"/>`;
        art += it.kind === 'outlet' ? `<path d="M${f(c[0] - 4)} ${f(c[1] - 8)}v8M${f(c[0] + 4)} ${f(c[1] - 8)}v8" stroke="#0c1a28" stroke-width="2.6" stroke-linecap="round"/><path d="M${f(c[0] - 3)} ${f(c[1] + 9)}v-2.500a3 3 0 0 1 6 0v2.500z" fill="#0c1a28"/>` : `<text x="${f(c[0])}" y="${f(c[1] + 5.5)}" text-anchor="middle" font-size="16" font-weight="800">S</text>`;
        art += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="27" fill="transparent"/>`;
      }
      o.push(`<g data-key="${it.key}" class="bs-edit-item">${art}<circle cx="${f(out[0])}" cy="${f(out[1])}" r="11" fill="${sel ? '#ffb703' : '#0c1a28'}"/><text x="${f(out[0])}" y="${f(out[1] + 4)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${sel ? '#0c1a28' : '#fff'}">${it.n}</text></g>`);
      if (sel) {
        /* Distance to each end of the wall, drawn just outside it. */
        const off = (q, d) => [q[0] - geo.n[0] * d, q[1] - geo.n[1] * d];
        const s0 = P(w.a), s1 = P(w.b);
        for (const [p, q, text] of [[s0, a, bsFeet(it.at)], [b, s1, bsFeet(w.len - it.at - it.w)]]) {
          const p1 = off(p, 46), q1 = off(q, 46), m = [(p1[0] + q1[0]) / 2, (p1[1] + q1[1]) / 2];
          if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 4) continue;
          o.push(`<path d="M${f(p1[0])} ${f(p1[1])}L${f(q1[0])} ${f(q1[1])}M${f(off(p, 38)[0])} ${f(off(p, 38)[1])}L${f(off(p, 54)[0])} ${f(off(p, 54)[1])}M${f(off(q, 38)[0])} ${f(off(q, 38)[1])}L${f(off(q, 54)[0])} ${f(off(q, 54)[1])}" stroke="#b3362e" stroke-width="1.5" fill="none"/>`);
          o.push(`<rect x="${f(m[0] - 30)}" y="${f(m[1] - 10)}" width="60" height="20" rx="4" fill="#fff"/><text x="${f(m[0])}" y="${f(m[1] + 4.5)}" text-anchor="middle" font-size="13" font-weight="800" fill="#b3362e">${text}</text>`);
        }
      }
    }
  }
  const lights = items.filter((x) => x.kind === 'light');
  if (lights.length && !bsLightsFree(lay.c, sh)) {
    const [lx, ly] = P([0, sh.W / 2]);
    o.push(`<path d="M${f(lx)} ${f(ly)}H${f(P([sh.L, 0])[0])}" stroke="#d99a00" stroke-width="1.5" stroke-dasharray="7 6" clip-path="url(#bsgride)"/>`);
  }
  for (const it of lights) {
    const [x, y] = P([it.x, it.y]), sel = BS.sel === it.key;
    o.push(`<g data-key="${it.key}" class="bs-edit-item">${sel ? `<circle cx="${f(x)}" cy="${f(y)}" r="24" fill="#ffb703"/>` : ''}<circle cx="${f(x)}" cy="${f(y)}" r="18" fill="#fff6cf" stroke="#0c1a28" stroke-width="2.2"/>${bsBulb(x, y - 2.5, 1.35)}<circle cx="${f(x)}" cy="${f(y)}" r="28" fill="transparent"/><circle cx="${f(x + 19)}" cy="${f(y - 19)}" r="10" fill="${sel ? '#ffb703' : '#0c1a28'}"/><text x="${f(x + 19)}" y="${f(y - 15)}" text-anchor="middle" font-size="11" font-weight="700" fill="${sel ? '#0c1a28' : '#fff'}">${it.n}</text></g>`);
  }
  return o.join('');
}
function bsEdInfo(lay) {
  const it = lay.items.find((x) => x.key === BS.sel);
  if (!it) return `<p class="bs-edhint">Tap a door, window, outlet, switch or light, then drag it along the wall or onto another wall. Drag a light across the ceiling.</p>`;
  if (it.kind === 'light') {
    const free = bsLightsFree(lay.c, lay.sh), nd = (dx, dy, t) => `<button type="button" class="chipbtn" onclick="bsEdNudge(${dx},${dy})">${t}</button>`;
    return `<div class="bs-edcard"><div class="bs-edwhat">${bsBal(it.n)}<div><strong>Light</strong><small>Ceiling · <b>${bsWhere(it, lay.sh)}</b>${free ? '' : ' · on the center line'}</small></div></div>
      <div class="bs-ednudge">${nd(-1, 0, '← 1 ft')}${nd(-1 / 12, 0, '← 1 in')}${nd(1 / 12, 0, '1 in →')}${nd(1, 0, '1 ft →')}${free ? nd(0, -1 / 12, '↑ 1 in') + nd(0, 1 / 12, '↓ 1 in') + nd(0, -1, '↑ 1 ft') + nd(0, 1, '↓ 1 ft') : ''}</div>
      ${it.moved ? `<button type="button" class="link" onclick="bsEdReset('${it.key}')">Back to standard spot</button>` : '<span class="bs-std">Standard spot</span>'}</div>`;
  }
  const w = lay.sh.walls[it.wi];
  const nudge = (d, t) => `<button type="button" class="chipbtn" onclick="bsEdNudge(${d})">${t}</button>`;
  return `<div class="bs-edcard"><div class="bs-edwhat">${bsBal(it.n)}<div><strong>${esc(it.name)}</strong><small>${bsTag(w.id)} ${esc(w.name)} · ${it.w ? 'starts' : 'center'} <b>${bsFeet(it.at)}</b> from the ${esc(w.hook.toLowerCase())}</small></div></div>
    <div class="bs-ednudge">${nudge(-1, '− 1 ft')}${nudge(-1 / 12, '− 1 in')}${nudge(1 / 12, '+ 1 in')}${nudge(1, '+ 1 ft')}</div>
    <label class="bs-edwall">Wall <select onchange="bsEdToWall(+this.value)">${lay.sh.walls.map((x) => `<option value="${x.i}" ${x.i === it.wi ? 'selected' : ''}>${x.id} · ${esc(x.name)}</option>`).join('')}</select></label>
    ${it.moved ? `<button type="button" class="link" onclick="bsEdReset('${it.key}')">Back to standard spot</button>` : '<span class="bs-std">Standard spot</span>'}</div>`;
}
function bsEditor(o) {
  const lay = bsLayout(o.c), g = bsEdGeom(lay.sh);
  const moved = lay.items.filter((x) => x.moved).length;
  return `<div class="bs-editor no-print"><div class="bs-edhead"><div><h3>Floor plan editor</h3><p>Drag items where the customer wants them. They snap to the inch and cannot overlap. The build sheet below follows this plan.</p></div>
      ${moved ? `<button type="button" class="link" onclick="bsEdReset()">Reset all ${moved} moved</button>` : ''}</div>
    <svg id="bs-edsvg" class="bs-edsvg" viewBox="0 0 ${g.VW} ${g.VH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg">${bsEdDraw(lay)}</svg>
    <div id="bs-edinfo">${bsEdInfo(lay)}</div>
    ${lay.items.some((x) => x.kind === 'light') ? (lay.sh.studio ? '<p class="bs-edfree">Studio: lights can go anywhere on the ceiling.</p>' : `<label class="bs-edfree"><input type="checkbox" ${o.c.sheet?.lightsFree ? 'checked' : ''} onchange="bsEdFree(this.checked)"> Let lights go anywhere, not only on the center line of the building</label>`) : ''}</div>`;
}
/* Redraw only the editor while dragging; the sheets below are redrawn when the drag ends. */
function bsEdRefresh() {
  const o = bsOrder(BS.key), lay = bsLayout(o.c), svg = document.getElementById('bs-edsvg');
  if (!svg) return;
  svg.innerHTML = bsEdDraw(lay);
  document.getElementById('bs-edinfo').innerHTML = bsEdInfo(lay);
}
function bsEdWire() {
  const svg = document.getElementById('bs-edsvg');
  if (!svg) return;
  const feet = (e) => {
    const lay = bsLayout(bsOrder(BS.key).c), g = bsEdGeom(lay.sh), m = svg.getScreenCTM().inverse();
    const x = e.clientX * m.a + e.clientY * m.c + m.e, y = e.clientX * m.b + e.clientY * m.d + m.f;
    return { lay, p: [(x - g.X0) / g.Sc, (y - g.Y0) / g.Sc] };
  };
  svg.onpointerdown = (e) => {
    const hit = e.target.closest('[data-key]');
    BS.sel = hit ? hit.dataset.key : null;
    BS.drag = hit ? { key: BS.sel, moved: false } : null;
    if (hit) svg.setPointerCapture(e.pointerId);
    bsEdRefresh();
  };
  svg.onpointermove = (e) => {
    if (!BS.drag) return;
    const { lay, p } = feet(e), it = lay.items.find((x) => x.key === BS.drag.key);
    if (!it) return;
    if (it.kind === 'light') {
      if (bsEdLight(it.key, p[0], p[1])) (BS.drag.moved = true), bsEdRefresh();
      return;
    }
    /* Nearest wall to the finger; the current wall wins unless another is clearly closer. */
    let pick = null;
    for (const w of lay.sh.walls) {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
      const t = Math.max(0, Math.min(w.len, ((p[0] - w.a[0]) * dx + (p[1] - w.a[1]) * dy) / w.len));
      const d = Math.hypot(p[0] - w.a[0] - (dx * t) / w.len, p[1] - w.a[1] - (dy * t) / w.len) - (w.i === it.wi ? 0.75 : 0);
      if (!pick || d < pick.d) pick = { d, w, t };
    }
    if (pick.w.len < it.w) return;
    if (bsEdPlace(it.key, pick.w.i, pick.t - it.w / 2)) {
      BS.drag.moved = true;
      bsEdRefresh();
    }
  };
  svg.onpointerup = svg.onpointercancel = () => {
    const moved = BS.drag?.moved;
    BS.drag = null;
    if (moved) bsRender();
  };
}
function bsEdLight(key, x, y) {
  const o = bsOrder(BS.key), sh = bsShape(o.c), q = bsLightSpot(sh, bsLightsFree(o.c, sh), x, y);
  if (!q) return false;
  const sheet = (o.c.sheet ||= { pos: {}, ok: null });
  sheet.pos[key] = { x: q[0], y: q[1] };
  sheet.ok = null;
  return true;
}
function bsEdFree(on) {
  const sheet = (bsOrder(BS.key).c.sheet ||= { pos: {}, ok: null });
  sheet.lightsFree = on;
  sheet.ok = null;
  bsRender();
}
function bsEdNudge(d, dy = 0) {
  const lay = bsLayout(bsOrder(BS.key).c), it = lay.items.find((x) => x.key === BS.sel);
  if (!it) return;
  if (it.kind === 'light' ? bsEdLight(it.key, it.x + d, it.y + dy) : bsEdPlace(it.key, it.wi, it.at + d)) bsRender();
}
function bsEdToWall(wi) {
  const lay = bsLayout(bsOrder(BS.key).c), it = lay.items.find((x) => x.key === BS.sel), len = lay.sh.walls[wi].len;
  if (it && len >= it.w && bsEdPlace(it.key, wi, (len - it.w) / 2)) bsRender();
  else toast('That item does not fit on that wall.');
}
function bsEdReset(key) {
  const sheet = bsOrder(BS.key).c.sheet;
  if (!sheet) return;
  if (key) delete sheet.pos[key];
  else sheet.pos = {};
  sheet.ok = null;
  bsRender();
}
function bsConfirm() {
  const o = bsOrder(BS.key);
  (o.c.sheet ||= { pos: {}, ok: null }).ok = Date.now();
  BS.edit = false;
  bsRender();
  toast('Layout confirmed. The build sheet now shows it as confirmed.');
}

/* ---------- Opening the sheet ---------- */
function bsRender() {
  const o = bsOrder(BS.key);
  let root = document.getElementById('bsheet');
  if (!o) return closeBuildSheet();
  if (!root) {
    root = document.createElement('div');
    root.id = 'bsheet';
    document.body.appendChild(root);
  }
  const keep = root.scrollTop;
  const ok = o.c.sheet?.ok;
  root.innerHTML = `<div class="bs-bar no-print">
      <button type="button" class="secondary small" onclick="closeBuildSheet()">← Back</button>
      <strong>Build sheet · ${esc(o.c.size)} ${esc(o.customer || o.serial || '')}</strong>
      <span class="bs-grow"></span>
      <button type="button" class="secondary small" onclick="BS.edit=!BS.edit;bsRender()">${BS.edit ? 'Done editing' : 'Edit floor plan'}</button>
      ${ok ? '<span class="pill good">Layout confirmed</span>' : '<button type="button" class="primary small" onclick="bsConfirm()">Confirm layout</button>'}
      <button type="button" class="secondary small" onclick="window.print()">Print</button>
    </div>
    ${BS.edit ? bsEditor(o) : ''}
    <div class="bs-pages" style="--z:${Math.min(1, (window.innerWidth - 24) / 1056).toFixed(3)}">${bsPages(o)}</div>`;
  /* Shrink a page's content when it would run past one printed sheet. */
  for (const page of root.querySelectorAll('.bs-page')) {
    const fit = page.querySelector('.bs-fit');
    for (let pass = 0; pass < 2; pass++) {
      const room = (page.getBoundingClientRect().width * 753) / 1056, h = fit.getBoundingClientRect().height;
      if (h <= room) break;
      fit.style.zoom = ((parseFloat(fit.style.zoom) || 1) * (room / h) * 0.985).toFixed(3);
    }
  }
  bsEdWire();
  root.scrollTop = keep;
}
function openBuildSheet(key, edit = false) {
  BS.key = key;
  BS.edit = edit;
  BS.sel = null;
  document.body.classList.add('bs-open');
  bsRender();
  document.getElementById('bsheet').scrollTop = 0;
}
function closeBuildSheet() {
  BS.key = null;
  document.body.classList.remove('bs-open');
  document.getElementById('bsheet')?.remove();
}
let bsWide = window.innerWidth;
window.addEventListener('resize', () => {
  document.querySelector('.bs-pages')?.style.setProperty('--z', Math.min(1, (window.innerWidth - 24) / 1056).toFixed(3));
  /* Redraw the editor only when the width changes, so a phone keyboard does not reset it. */
  if (BS.key && BS.edit && window.innerWidth !== bsWide) bsRender();
  bsWide = window.innerWidth;
});

/* ---------- A build sheet button on every order ---------- */
const bsButton = (key) => `<button type="button" class="secondary small bs-open-btn" onclick="openBuildSheet('${key}')">Build sheet</button>`;
{
  const salesChanges = changeOrdersMarkup;
  changeOrdersMarkup = function (key) {
    const html = salesChanges(key);
    return S.page === 'home' ? html : html.replace(/<\/div>$/, bsButton(key) + '</div>');
  };
  /* While configuring: place the doors, windows and electrical on the floor plan. */
  const salesStep = stepBody;
  stepBody = function () {
    const [title, body] = salesStep();
    if (!['Openings', 'Electrical'].includes(steps[S.step])) return [title, body];
    return [title, body + `<div class="bs-cfgplan"><div><strong>Where does everything go?</strong><small>Drag the doors, windows and electrical into place on the floor plan.</small></div><button type="button" class="primary small" onclick="openBuildSheet('cfg', true)">Open floor plan</button></div>`];
  };
  if (typeof buildSheet === 'function') {
    const qcSheet = buildSheet;
    buildSheet = function (b) {
      return qcSheet(b).replace(/<\/details>\s*$/, `<p>${bsButton('qc:' + b.serial)}</p></details>`);
    };
  }
}
