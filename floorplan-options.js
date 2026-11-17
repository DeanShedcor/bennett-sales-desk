/* floorplan-options.js: options that sit inside the building go on the floor plan.

   The owner's rule (Nov 16, 2026): options like a workbench and shelves are added to the floor
   plan, and when any are on the building the floor plan has to be edited, so the builder knows
   where each one goes. There is no "default spot" for these: every piece has to be placed.
   Pieces: workbench, shelving, partition wall, loft, U-shaped loft, framed opening. Each is drawn
   to scale from the amount ordered, listed on the build sheet, and moved in the editor like a door.
   A piece counts as placed once the salesperson drags it, moves it with the buttons, picks a wall,
   or presses "This spot is right". Its spot is kept in c.sheet.pos with the amount and the building
   it was placed for, so a new amount, size or style asks for it to be placed again.
   Until every piece is placed the sale cannot be quoted or completed, and the layout cannot be
   confirmed on the order.
   Existing functions hooked: bsLayout, bsPlan, bsEdDraw, bsEditor, bsEdInfo, bsEdPlace, bsEdNudge,
   bsConfirm, closeBuildSheet, stepBody, whenBuildReady, quoteForm, included (buildsheet.js,
   views.js, core.js) and TA_ADDONS / taAddonQty (turbo-sales.js).
   Turbo Assist's configurator plan leaves floor plans out of scope, so this is a feature the
   product still has to accept.
   Loaded right after electrical-placement.js. */
{
  /* [price-list name, key, plain name, kind, depth off the wall in ft] */
  const FP_OPTS = [
    ['Workbench (per LF)', 'xb', 'Workbench', 'run', 2],
    ['Three Tier Shelving (per LF)', 'xs', 'Shelving', 'run', 1.5],
    ['Partition Wall (per linear foot)', 'xw', 'Partition wall', 'wall', 0],
    ['Additional Loft (PER SQ FT)', 'xl', 'Loft', 'loft', 0],
    ['U Loft (per SQ FT)', 'xu', 'U-shaped loft', 'uloft', 0],
    ['Custom Frame Out', 'xf', 'Framed opening', 'frame', 0],
  ];
  const sizeOf = (c) => [c.size, c.style, c.package || ''].join('|');
  const qtyOf = (c, name) => (typeof taAddonQty === 'function' && typeof taAddon === 'function' && taAddon(name)?.[3](c) ? taAddonQty(c, name) : 0);

  /* The pieces a building has, and whether each has been placed for this amount and this building. */
  function fpPieces(c) {
    const out = [];
    if (!c || !c.extras) return out;
    for (const [name, key, label, kind, depth] of FP_OPTS) {
      const q = qtyOf(c, name);
      if (!q) continue;
      const many = kind === 'frame' ? q : 1;
      for (let i = 0; i < many; i++) {
        const k = kind === 'frame' ? key + i : key, p = c.sheet?.pos?.[k];
        const text = kind === 'frame' ? label + (many > 1 ? ` ${i + 1}` : '') : `${label} · ${q} ${kind === 'loft' || kind === 'uloft' ? 'sq ft' : 'ft'}`;
        out.push({ key: k, label, kind, depth, q, name: text, placed: !!p && p.q === q && p.sz === sizeOf(c) });
      }
    }
    return out;
  }
  const fpLeft = (c) => fpPieces(c).filter((x) => !x.placed);
  window.fpPieces = fpPieces;
  window.fpLeft = fpLeft;

  /* How far a piece can reach into the building from a spot on a wall. */
  function reach(sh, g, t) {
    const [x, y] = g.at(t);
    let d = 0;
    while (d < 80 && bsInside(sh.poly, [x + g.n[0] * (d + 0.25), y + g.n[1] * (d + 0.25)])) d += 0.25;
    return d;
  }
  /* Size of a piece on a given wall: [length along the wall, depth into the building]. */
  function shape(sh, w, pc) {
    const g = bsWallGeo(sh, w), far = reach(sh, g, w.len / 2);
    if (pc.kind === 'run') return [Math.min(pc.q, w.len), pc.depth];
    if (pc.kind === 'wall') return [1 / 3, Math.min(pc.q, far)];
    if (pc.kind === 'frame') return [Math.min(3, w.len), 0];
    if (pc.kind === 'loft') return [w.len, Math.min(pc.q / w.len, far)];
    /* U shape: a band across the wall, about 4 ft deep, and an arm down each side. */
    const band = Math.min(4, pc.q / w.len, far), arm = Math.max(0, Math.min((pc.q - band * w.len) / 4, far - band));
    return [w.len, band, arm];
  }
  /* The nearest spot on the wall that clears the doors (and windows, for a framed opening) and the
     other pieces against that wall. Null when there is no room. */
  function fit(lay, pc, wi, len, want, others) {
    const w = lay.sh.walls[wi];
    if (pc.kind === 'loft' || pc.kind === 'uloft') return 0;
    const block = lay.items.filter((x) => x.wi === wi && x.w && !x.high && (x.kind === 'door' || pc.kind === 'frame')).map((x) => [x.at, x.at + x.w]);
    for (const o of others) if (o.fw === wi && o.key !== pc.key && o.fix !== 'loft' && o.fix !== 'uloft') block.push([o.at, o.at + o.len]);
    block.sort((a, b) => a[0] - b[0]);
    const slots = [];
    let lo = 0;
    for (const [a, b] of block) { slots.push([lo, a - len]); lo = Math.max(lo, b); }
    slots.push([lo, w.len - len]);
    let best = null;
    for (const [a, b] of slots) {
      if (b < a - 1e-9) continue;
      const at = Math.min(Math.max(want, a), b);
      if (best == null || Math.abs(at - want) < Math.abs(best - want)) best = at;
    }
    return best == null ? null : Math.round(best * 12) / 12;
  }

  /* Corners of a piece on the plan, in feet. */
  function corners(sh, it) {
    const g = bsWallGeo(sh, sh.walls[it.fw]), a = g.at(it.at), b = g.at(it.at + it.len), n = g.n, d = it.depth;
    const main = [a, b, [b[0] + n[0] * d, b[1] + n[1] * d], [a[0] + n[0] * d, a[1] + n[1] * d]];
    const arms = [];
    if (it.fix === 'uloft' && it.arm > 0) {
      const dir = g.d, far = d + it.arm;
      for (const [p, s] of [[a, 1], [b, -1]]) {
        const q = [p[0] + dir[0] * 2 * s, p[1] + dir[1] * 2 * s];
        arms.push([[p[0] + n[0] * d, p[1] + n[1] * d], [q[0] + n[0] * d, q[1] + n[1] * d], [q[0] + n[0] * far, q[1] + n[1] * far], [p[0] + n[0] * far, p[1] + n[1] * far]]);
      }
    }
    return { main, arms };
  }
  const box = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
  const hits = (a, b) => a[0] < b[2] - 0.05 && a[2] > b[0] + 0.05 && a[1] < b[3] - 0.05 && a[3] > b[1] + 0.05;

  /* ---------- The layout: the pieces join the doors, windows and electrical ---------- */
  const baseLayout = bsLayout;
  bsLayout = function (c) {
    const lay = baseLayout(c), sh = lay.sh, pcs = fpPieces(c), made = [];
    let n = lay.items.length;
    for (const pc of pcs) {
      const p = pc.placed ? c.sheet.pos[pc.key] : null;
      /* Where it would go if nobody says otherwise: the back wall for a loft, else the longest wall with room. */
      const order = pc.kind === 'loft' || pc.kind === 'uloft' ? [sh.roles.barn ?? 1] : sh.walls.map((w) => w.i).sort((a, b) => sh.walls[b].len - sh.walls[a].len);
      let wi = p && sh.walls[p.wall] ? p.wall : null, at = null, dims = null;
      for (const tryWall of wi != null ? [wi] : order) {
        const w = sh.walls[tryWall];
        if (!w) continue;
        dims = shape(sh, w, pc);
        at = fit(lay, pc, tryWall, dims[0], p ? p.at : pc.kind === 'wall' ? w.len / 2 : 0, made);
        if (at != null) { wi = tryWall; break; }
      }
      if (at == null) { wi = order[0]; dims = shape(sh, sh.walls[wi], pc); at = 0; }
      const w = sh.walls[wi];
      const it = { key: pc.key, kind: 'fix', fix: pc.kind, name: pc.name, note: '', w: pc.kind === 'run' || pc.kind === 'frame' ? dims[0] : 0, wi: -2, fw: wi, at, len: dims[0], depth: dims[1], arm: dims[2] || 0, q: pc.q, sz: sizeOf(c), placed: pc.placed, moved: pc.placed, n: ++n };
      it.wallText = `${bsTag(w.id)} ${esc(w.name)}`;
      it.whereText = !it.placed ? '<b>Not placed yet</b>'
        : pc.kind === 'loft' || pc.kind === 'uloft' ? `Overhead, across this wall, ${bsFeet(it.depth)} deep${it.arm ? `, with an arm ${bsFeet(it.arm)} long down each side` : ''}`
        : pc.kind === 'wall' ? `Starts ${bsFeet(it.at)} from the ${esc(w.hook.toLowerCase())}, runs ${bsFeet(it.depth)} into the building`
        : `${bsFeet(it.at)} to ${bsFeet(it.at + it.len)}${it.depth ? `, ${bsFeet(it.depth)} deep` : ''}`;
      /* Plain warnings: in front of a window, or in the way of a door. */
      it.warn = [];
      if (pc.kind === 'run' && pc.q > w.len + 0.01) it.warn.push(`${pc.label} is ${pc.q} ft and this wall is ${bsFeet(w.len)}. Only ${bsFeet(it.len)} fits here.`);
      if (pc.kind === 'run' || pc.kind === 'wall') {
        const mine = box(corners(sh, it).main);
        for (const o of lay.items) {
          if (o.wi < 0 || !o.w || o.high) continue;
          const g = bsWallGeo(sh, sh.walls[o.wi]), a = g.at(o.at), b = g.at(o.at + o.w), deep = o.kind === 'door' ? 3 : 0.5;
          const zone = box([a, b, [a[0] + g.n[0] * deep, a[1] + g.n[1] * deep], [b[0] + g.n[0] * deep, b[1] + g.n[1] * deep]]);
          if (hits(mine, zone)) it.warn.push(o.kind === 'door' ? `${pc.label} is in the way of the ${o.name.toLowerCase()}. Move it so the door can open.` : `${pc.label} is in front of a window.`);
        }
      }
      made.push(it);
      lay.items.push(it);
      if (!it.placed) lay.notes.push(`${it.name}: not placed on the floor plan yet.`);
      for (const t of it.warn) lay.notes.push(t);
    }
    return lay;
  };

  /* ---------- Drawing ---------- */
  function art(lay, P, edit, small) {
    const f = (v) => v.toFixed(1), pts = (l) => l.map((q) => P(q).map(f).join(',')).join(' ');
    const o = [`<defs><pattern id="fp-hatch${edit ? 'e' : 'p'}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="${edit ? '#345f80' : '#111'}" stroke-width="${edit ? 2 : 1}"/></pattern></defs>`];
    for (const it of lay.items) {
      if (it.kind !== 'fix') continue;
      const { main, arms } = corners(lay.sh, it), sel = edit && BS.sel === it.key, todo = !it.placed;
      const cx = main.reduce((s, p) => s + p[0], 0) / 4, cy = main.reduce((s, p) => s + p[1], 0) / 4;
      let [mx, my] = P([cx, cy]);
      /* On the printed plan a piece's number never sits under a wall letter: it steps toward the middle of the building. */
      if (!edit) {
        const mid = P([lay.sh.poly.reduce((s, p) => s + p[0], 0) / lay.sh.poly.length, lay.sh.poly.reduce((s, p) => s + p[1], 0) / lay.sh.poly.length]);
        for (let tries = 0; tries < 4 && lay.sh.walls.some((w) => w.tagAt && Math.hypot(w.tagAt[0] - mx, w.tagAt[1] - my) < 20); tries++) {
          const d = Math.hypot(mid[0] - mx, mid[1] - my) || 1;
          mx += ((mid[0] - mx) / d) * 22; my += ((mid[1] - my) / d) * 22;
        }
      }
      const line = todo ? '#b3362e' : edit ? '#0c1a28' : '#111', dash = todo ? 'stroke-dasharray="7 5"' : '';
      let body = '';
      if (it.fix === 'frame') {
        const [a, b] = [P(main[0]), P(main[1])];
        body = `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#fff" stroke-width="${edit ? 13 : 8}"/><line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${line}" stroke-width="${edit ? 5 : 2.5}" stroke-dasharray="${edit ? '10 6' : '5 3'}"/>`;
        if (edit) body += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="transparent" stroke-width="40"/>`;
      } else {
        const fill = it.fix === 'loft' || it.fix === 'uloft' ? `url(#fp-hatch${edit ? 'e' : 'p'})` : it.fix === 'wall' ? line : edit ? (it.label === 'Shelving' || /Shelving/.test(it.name) ? '#cfe1ec' : '#e7c79c') : '#e6e6e6';
        const over = it.fix === 'loft' || it.fix === 'uloft';
        for (const poly of [main, ...arms])
          body += `<polygon points="${pts(poly)}" fill="${fill}" fill-opacity="${over ? 0.55 : 1}" stroke="${line}" stroke-width="${edit ? 2.2 : 1.2}" ${over && !todo ? 'stroke-dasharray="6 4"' : dash}/>`;
        if (/Shelving/.test(it.name)) {
          const g = bsWallGeo(lay.sh, lay.sh.walls[it.fw]);
          for (const k of [1 / 3, 2 / 3]) { const a = P([main[0][0] + g.n[0] * it.depth * k, main[0][1] + g.n[1] * it.depth * k]), b = P([main[1][0] + g.n[0] * it.depth * k, main[1][1] + g.n[1] * it.depth * k]); body += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${line}" stroke-width="${edit ? 1.2 : 0.7}"/>`; }
        }
        if (edit) body += `<polygon points="${pts(main)}" fill="transparent" stroke="transparent" stroke-width="${it.fix === 'wall' ? 34 : 18}"/>`;
      }
      const glow = sel ? `<polygon points="${pts(main)}" fill="none" stroke="#ffb703" stroke-width="10" stroke-linejoin="round"/>` : '';
      const r = edit ? 12 : 8;
      const badge = `<circle cx="${f(mx)}" cy="${f(my)}" r="${r}" fill="${todo ? '#b3362e' : sel ? '#ffb703' : '#111'}"/><text x="${f(mx)}" y="${f(my + (edit ? 4.5 : 3.2))}" text-anchor="middle" font-size="${edit ? 12 : it.n > 9 ? 8 : 9}" font-weight="700" fill="${sel && !todo ? '#0c1a28' : '#fff'}">${todo && edit ? '?' : it.n}</text>`;
      const tag = `<text x="${f(mx)}" y="${f(my + r + (edit ? 15 : 10))}" text-anchor="middle" font-size="${edit ? 13 : 8.6}" font-weight="700" fill="${todo ? '#b3362e' : '#111'}" stroke="#fff" stroke-width="${edit ? 4 : 2.5}" paint-order="stroke">${esc(it.name)}${todo ? ' · not placed' : ''}</text>`;
      /* On the printed plan the number is enough: the name and the spot are in the list beside it. */
      /* On a narrow screen the names would pile up, so only the picked piece shows its name. */
      o.push(edit ? `<g data-key="${it.key}" class="bs-edit-item fp-piece">${glow}${body}${badge}${small && !sel ? '' : tag}</g>` : `<g class="fp-piece">${body}${badge}</g>`);
    }
    return o.join('');
  }
  const under = (svg, extra) => {
    const mark = 'stroke-linejoin="miter"/>', i = svg.indexOf(mark);
    return i < 0 ? svg.replace('</svg>', extra + '</svg>') : svg.slice(0, i + mark.length) + extra + svg.slice(i + mark.length);
  };
  const basePlan = bsPlan;
  bsPlan = function (lay) {
    const svg = basePlan(lay);
    if (!lay.items.some((x) => x.kind === 'fix')) return svg;
    const { L, W } = lay.sh, Sc = Math.min(680 / L, 164 / W, 30), X0 = 180 + (680 - L * Sc) / 2, Y0 = 86; /* the same scale bsPlan draws at */
    return under(svg, art(lay, ([x, y]) => [X0 + x * Sc, Y0 + y * Sc], false));
  };
  const baseEdDraw = bsEdDraw;
  bsEdDraw = function (lay) {
    const svg = baseEdDraw(lay);
    if (!lay.items.some((x) => x.kind === 'fix')) return svg;
    const g = bsEdGeom(lay.sh);
    return under(svg, art(lay, ([x, y]) => [g.X0 + x * g.Sc, g.Y0 + y * g.Sc], true, g.VW < 600));
  };

  /* ---------- The editor ---------- */
  function fpPlace(key, wi, want) {
    const o = bsOrder(BS.key), lay = bsLayout(o.c), it = lay.items.find((x) => x.key === key && x.kind === 'fix'), w = lay.sh.walls[wi];
    if (!it || !w) return false;
    const pc = { key, kind: it.fix, q: it.q, depth: it.fix === 'run' ? it.depth : 0, label: it.name.split(' · ')[0] };
    const dims = shape(lay.sh, w, pc), at = fit(lay, pc, wi, dims[0], Math.round(want * 12) / 12, lay.items.filter((x) => x.kind === 'fix'));
    if (at == null) return false;
    const sheet = (o.c.sheet ||= { pos: {}, ok: null });
    sheet.pos[key] = { wall: wi, at, q: it.q, sz: it.sz };
    sheet.ok = null;
    return true;
  }
  const isFix = (key) => /^x[bswluf]\d*$/.test(key || '');
  const basePlace = bsEdPlace;
  bsEdPlace = function (key, wi, want) {
    return isFix(key) ? fpPlace(key, wi, want) : basePlace(key, wi, want);
  };
  const baseNudge = bsEdNudge;
  bsEdNudge = function (d, dy = 0) {
    if (!isFix(BS.sel)) return baseNudge(d, dy);
    const it = bsLayout(bsOrder(BS.key).c).items.find((x) => x.key === BS.sel);
    if (it && fpPlace(it.key, it.fw, it.at + d)) bsRender();
  };
  /* "This spot is right": keep the piece where the plan shows it. */
  function fpHere(key) {
    const it = bsLayout(bsOrder(BS.key).c).items.find((x) => x.key === key);
    if (it && fpPlace(key, it.fw, it.at)) { bsRender(); toast(`${it.name.split(' · ')[0]} placed.`); }
    else toast('It does not fit there. Drag it to a wall with room.');
  }
  function fpPick(key) {
    BS.sel = key;
    BS.edit = true;
    bsRender();
    document.getElementById('bs-edsvg')?.scrollIntoView({ block: 'nearest' });
  }
  Object.assign(window, { fpHere, fpPick });

  const baseInfo = bsEdInfo;
  bsEdInfo = function (lay) {
    const it = lay.items.find((x) => x.key === BS.sel);
    if (!it || it.kind !== 'fix') {
      const html = baseInfo(lay);
      return lay.items.some((x) => x.kind === 'fix') ? html.replace('Tap a door, window, outlet, switch or light,', 'Tap a door, window, outlet, switch, light, workbench, shelf, wall or loft,') : html;
    }
    const w = lay.sh.walls[it.fw], over = it.fix === 'loft' || it.fix === 'uloft';
    const nudge = (d, t) => `<button type="button" class="chipbtn" onclick="bsEdNudge(${d})">${t}</button>`;
    return `<div class="bs-edcard fp-card"><div class="bs-edwhat">${bsBal(it.n)}<div><strong>${esc(it.name)}</strong><small>${it.wallText} · ${it.whereText}</small></div></div>
      ${it.warn.map((t) => `<p class="fp-warn">${esc(t)}</p>`).join('')}
      ${over ? '' : `<div class="bs-ednudge">${nudge(-1, '− 1 ft')}${nudge(-1 / 12, '− 1 in')}${nudge(1 / 12, '+ 1 in')}${nudge(1, '+ 1 ft')}</div>`}
      <label class="bs-edwall">Wall <select onchange="bsEdToWall(+this.value)">${lay.sh.walls.map((x) => `<option value="${x.i}" ${x.i === it.fw ? 'selected' : ''}>${x.id} · ${esc(x.name)}</option>`).join('')}</select></label>
      ${it.placed ? `<span class="fp-ok">${icon('check', 16)} Placed</span><button type="button" class="link" onclick="bsEdReset('${it.key}')">Take it off the plan</button>`
        : `<p class="fp-todo">Drag it to where the customer wants it${over ? ', or pick the wall it goes across' : ''}. If this spot is right, press the button.</p><button type="button" class="primary fp-here" onclick="fpHere('${it.key}')">This spot is right</button>`}</div>`;
  };
  /* The tray: what is still to place. */
  function tray(c) {
    const all = fpPieces(c), left = all.filter((x) => !x.placed);
    if (!all.length) return '';
    return left.length
      ? `<div class="fp-tray todo" id="fp-tray"><strong>Still to place: ${left.length} of ${all.length}</strong><span>The builder needs to know where each one goes. Tap one, then drag it into place.</span><div class="fp-chips">${left.map((x) => `<button type="button" class="fp-chip" onclick="fpPick('${x.key}')">${esc(x.name)}</button>`).join('')}</div></div>`
      : `<div class="fp-tray done" id="fp-tray">${icon('check', 18)}<strong>All placed.</strong><span>${all.map((x) => esc(x.name)).join(', ')}</span></div>`;
  }
  const baseEditor = bsEditor;
  bsEditor = function (o) {
    const html = baseEditor(o);
    return html.replace('<svg id="bs-edsvg"', tray(o.c) + '<svg id="bs-edsvg"');
  };
  /* The layout cannot be confirmed while a piece has no spot. */
  const baseConfirm = bsConfirm;
  bsConfirm = function () {
    const o = bsOrder(BS.key), left = o ? fpLeft(o.c) : [];
    if (!left.length) return baseConfirm();
    BS.edit = true;
    BS.sel = left[0].key;
    bsRender();
    toast(`Place ${names(left)} on the floor plan first.`);
  };

  /* ---------- The sale waits until every piece is placed ---------- */
  const names = (list) => {
    const n = [...new Set(list.map((x) => 'the ' + x.label.toLowerCase()))];
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
  };
  const designing = () => S.page === 'configure' && S.path !== 'lot' && S.c && S.c.catalogOptions;
  const waiting = () => (designing() ? fpLeft(S.c) : []);
  const finishIndex = () => steps.indexOf('Finish');

  function fpOpen() {
    const left = fpLeft(S.c);
    openBuildSheet('cfg', true);
    if (left.length) { BS.sel = left[0].key; bsRender(); }
  }
  window.fpOpen = fpOpen;

  function card(c) {
    const all = fpPieces(c), left = all.filter((x) => !x.placed);
    if (!all.length) return '';
    const list = all.map((x) => `<li class="${x.placed ? 'ok' : 'todo'}">${x.placed ? icon('check', 16) : '<span class="fp-q">?</span>'} ${esc(x.name)}${x.placed ? '' : ' · not placed yet'}</li>`).join('');
    return left.length
      ? `<div class="fp-ask ask" id="fp-ask"><div class="grow"><strong>The builder needs to know where these go.</strong><small>Open the floor plan and put each one in its place. ${left.length === 1 ? '1 is' : left.length + ' are'} left. You need to do this to keep going.</small><ul>${list}</ul></div><button type="button" class="primary" onclick="fpOpen()">Edit floor plan</button></div>`
      : `<div class="fp-ask done" id="fp-ask">${icon('check', 20)}<div class="grow"><strong>All placed on the floor plan.</strong><small>The builder will see where each one goes.</small><ul>${list}</ul></div><button type="button" class="secondary" onclick="fpOpen()">Edit floor plan</button></div>`;
  }
  const baseStep = stepBody;
  stepBody = function () {
    const [title, body] = baseStep();
    if (steps[S.step] !== 'Finish' || !designing()) return [title, body];
    return [title, body + card(S.c)];
  };
  function stop() {
    const left = waiting();
    if (finishIndex() >= 0 && S.step !== finishIndex()) { S.step = finishIndex(); S.completed = Math.max(S.completed, S.step); render(); }
    const el = document.getElementById('fp-ask');
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); }
    toast(`Place ${names(left)} on the floor plan first.`);
  }
  /* Continue and the step buttons. The options are picked on the last step, so this only matters
     if a later step is ever added; it is here so the rule holds either way. */
  const baseGo = goStep;
  goStep = function (step) {
    if (waiting().length && finishIndex() >= 0 && step > finishIndex()) return stop();
    return baseGo(step);
  };
  /* Create quote, Complete the sale, a stock order and a site review all pass through here. */
  const baseReady = whenBuildReady;
  whenBuildReady = function (action) {
    if (waiting().length) return stop();
    return baseReady(action);
  };
  /* The last step's own "Review and create quote" button calls quoteForm directly. */
  const baseQuote = quoteForm;
  quoteForm = function () {
    if (waiting().length) return stop();
    return baseQuote.apply(this, arguments);
  };

  /* Back from the floor plan: redraw the card. A visit that placed the pieces also answers the
     electrical question as "placed on the floor plan", unless Yes was already pressed. */
  const baseClose = closeBuildSheet;
  closeBuildSheet = function () {
    const wasCfg = typeof BS !== 'undefined' && BS.key === 'cfg';
    baseClose();
    if (!wasCfg || !designing()) return;
    const c = S.c, all = fpPieces(c);
    if (all.length && !fpLeft(c).length && c.electrical && c.electrical !== 'None' && !c.elecPlace) c.elecPlace = 'edited';
    if (all.length) render();
  };

  /* The quote and the review say the pieces are on the floor plan. */
  if (typeof included === 'function') {
    const baseIncluded = included;
    included = function (c) {
      const out = baseIncluded(c), all = fpPieces(c);
      if (all.length) out.push(fpLeft(c).length ? 'Options still to place on the floor plan' : `${all.map((x) => x.label).filter((x, i, a) => a.indexOf(x) === i).join(', ')} placed on the floor plan`);
      return out;
    };
  }
}
