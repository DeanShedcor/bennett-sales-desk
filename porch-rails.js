/* porch-rails.js: the porch railing that was picked is drawn, and left off when none was picked.

   The railing is picked by name on the Package step (porch-options.js: c.railing, c.railColor).
   This file works out where that railing goes on the floor plan and hands it to every drawing as
   sh.rails: the 3D model (plan3d.js), the build sheet plan and the floor plan editor
   (buildsheet.js), and the small top-view picture on the porch tiles (porchPlan).

   Where each railing goes. Feet in brackets are the feet sold for that choice.
   End Porch
     Side railing only [8]    both short sides of the porch.
     Door on the right [14]   both sides, and the front from the left corner to the middle post.
                              The way in is on the right, and the door is placed on the right.
     Door on the left [14]    the same, the other way round.
     Door in the center [16]  both sides, and the front from each corner in, with a 4 ft way in
                              in the middle. The middle post is drawn as two posts, one each side
                              of the way in. The door is placed in the center.
   Middle Porch
     Door on the right [4]    the left half of the open front. The door is placed on the right.
     Door on the left [4]     the right half. The door is placed on the left.
   Side Porch
     Side railing only [8]    the end of the porch (4 ft) and the half of the front that is not
                              in front of the door (4 ft).
   Deluxe Porch (as on the building in the home page photo)
     Standard railing         the short return by the front wall (4 ft) and the last 4 ft of the
                              side porch, by the door wall.
     Extended railing [+4]    the same, and the front between the corner post and the next post.
   Full Side Porch
     Standard railing [24]    both ends (4 ft each) and 8 ft of the front in from each corner.
   Left and right are as you face the front of the building.

   Guesses, still to be confirmed by the owner: the Side Porch layout, the Deluxe "extended" bay,
   the Full Side layout, and two posts for "Door in the center". Turbo Assist keeps the railing only
   as feet ('Porch Railing (Per Linear Ft)'); where it goes is a feature the product still has to accept.

   A building with no railing choice on it (a lot building, an older order) is drawn as before.
   Loaded last; wraps bsShape(), bsLayout() and porchPlan(). */
{
  const KNOWN = {
    'End Porch': { 'Side railing only': 8, 'Door on the right': 14, 'Door on the left': 14, 'Door in the center': 16 },
    'Middle Porch': { 'Door on the right': 4, 'Door on the left': 4 },
    'Side Porch': { 'Side railing only': 8 },
    'Deluxe Porch': { 'Standard railing': null, 'Extended railing': null },
    'Full Side Porch': { 'Standard railing': 24 },
  };
  /* The railing this building has, or '' for none. */
  const pickOf = (c, pkg) => (c && pkg && KNOWN[pkg] && c.railing in KNOWN[pkg] ? c.railing : '');
  const railHex = (c) => (c.railColor === 'Black' ? '#1d1d1f' : '#f3f2ee');
  window.porchRailPick = (c) => pickOf(c, c && c.package);

  /* ---------- where it goes, on the floor plan ---------- */
  const baseShape = bsShape;
  bsShape = function (c) {
    const sh = baseShape(c), { L, W, pkg } = sh;
    sh.rails = [];
    const pick = pickOf(c, pkg);
    if (!pick) return sh;
    let rails = [], flip = (q) => q;
    const roles = { ...sh.roles, winOpt: [...(sh.roles.winOpt || [])] };
    if (pkg === 'End Porch') {
      const p = sh.minX, wide = W >= 10;
      rails = [[[0, 0], [p, 0]], [[0, W], [p, W]]];
      if (pick === 'Door on the right') {
        rails.push([[0, 0], [0, W / 2]]);
        roles.entryOpt = { frac: W === 12 ? 0.6997 : 0.7 };
        if (wide) roles.winOpt[2] = { frac: W === 12 ? 0.3481 : 0.35 };
      } else if (pick === 'Door on the left') {
        rails.push([[0, W / 2], [0, W]]);
        if (!wide) roles.entryOpt = { frac: 0.3 };
      } else if (pick === 'Door in the center') {
        const a = (W - 4) / 2, b = (W + 4) / 2;
        rails.push([[0, 0], [0, a]], [[0, b], [0, W]]);
        sh.posts = [[0, 0], [0, a], [0, b], [0, W]];
        roles.entryOpt = { frac: 0.5 };
        if (wide) roles.winOpt[2] = { frac: 0.82 };
        sh.flags.push('Door in the center: the middle porch post is drawn as two posts, one each side of the way in. Confirm.');
      }
      if (pick === 'Door on the right' || pick === 'Door in the center') sh.flags.push(`The front door is placed ${pick === 'Door on the right' ? 'on the right' : 'in the center'} to match the porch railing.`);
    } else if (pkg === 'Middle Porch') {
      const x1 = (L - 8) / 2;
      if (pick === 'Door on the right') {
        rails = [[[x1, W], [x1 + 4, W]]];
        roles.entryOpt = { at: 4 };
        roles.winOpt[0] = { at: 1 };
        sh.flags.push('The porch door is placed on the right to match the porch railing.');
      } else rails = [[[x1 + 4, W], [x1 + 8, W]]];
    } else if (pkg === 'Side Porch') {
      rails = [[[L, W - 4], [L, W]], [[L - 8, W], [L - 4, W]]];
      if ((c.porchSide || 'Left') === 'Left') flip = ([x, y]) => [L - x, y];
    } else if (pkg === 'Full Side Porch') {
      const r = Math.min(8, (L - 4) / 2);
      rails = [[[0, W - 4], [0, W]], [[L, W - 4], [L, W]], [[0, W], [r, W]], [[L - r, W], [L, W]]];
    } else if (pkg === 'Deluxe Porch') {
      rails = [[[0, 0], [4, 0]], [[8, W], [12, W]]];
      if (pick === 'Extended railing') rails.push([[0, 0], [0, W - 8]]);
      if ((c.porchSide || 'Left') === 'Left') flip = ([x, y]) => [x, W - y];
    }
    sh.roles = roles;
    sh.rails = rails.map(([a, b]) => [flip(a), flip(b)]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.4);
    sh.railHex = railHex(c);
    sh.railName = pick;
    const sold = KNOWN[pkg][pick], drawn = Math.round(sh.rails.reduce((t, [a, b]) => t + Math.hypot(b[0] - a[0], b[1] - a[1]), 0));
    sh.railFeet = drawn;
    if (sold != null && Math.abs(drawn - sold) > 0.5) sh.flags.push(`Porch railing: ${sold} ft sold, ${drawn} ft drawn on this size. Confirm the railing layout.`);
    return sh;
  };

  /* A door that was moved by hand may end up behind the railing. Say so on the build sheet. */
  const onRail = (sh, q) => sh.rails.some(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy) < 0.25 && t > 0.02 && t < 0.98;
  });
  function doorBehindRail(lay) {
    const sh = lay.sh;
    if (!sh.rails?.length || !sh.deck) return false;
    for (const it of lay.items) {
      if (it.kind !== 'door' || !it.w) continue;
      const w = sh.walls[it.wi], g = bsWallGeo(sh, w), mid = g.at(it.at + it.w / 2);
      if (!bsInside(sh.deck, [mid[0] - g.n[0] * 0.3, mid[1] - g.n[1] * 0.3])) continue;
      /* walk straight out from the door to the edge of the deck */
      for (let s = 0.3; s < 14; s += 0.1) {
        const q = [mid[0] - g.n[0] * s, mid[1] - g.n[1] * s];
        if (bsInside(sh.deck, q)) continue;
        if (onRail(sh, q)) return true;
        break;
      }
    }
    return false;
  }
  const baseLayout = bsLayout;
  bsLayout = function (c) {
    const lay = baseLayout(c);
    try {
      /* the railing is drawn on the plan now, so it is no longer listed as "not drawn on this sheet" */
      if (lay.sh.rails?.length) lay.notes = lay.notes.filter((n) => !/^Porch railing: .*not drawn on this sheet\.$/.test(n));
      lay.railBlocked = doorBehindRail(lay);
      if (lay.railBlocked) lay.notes.push('A door is behind the porch railing. Move the door, or pick another railing on the Package step.');
    } catch (e) {}
    return lay;
  };

  /* ---------- the floor plan drawings (called from buildsheet.js) ---------- */
  /* P turns plan feet into drawing points. `k` is the size of the drawing's marks. */
  window.porchRailsSvg = function (sh, P, k = 1, ink = '#111') {
    if (!sh.rails?.length) return '';
    const f = (v) => v.toFixed(1), cx = sh.deck.reduce((t, q) => t + q[0], 0) / sh.deck.length, cy = sh.deck.reduce((t, q) => t + q[1], 0) / sh.deck.length;
    let d = '', ticks = '';
    for (const [a, b] of sh.rails) {
      const A = P(a), B = P(b), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      d += `M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}`;
      /* short marks on the deck side, one a foot, so it reads as a railing and not a wall */
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      const s = (cx - mid[0]) * nx + (cy - mid[1]) * ny >= 0 ? 1 : -1;
      for (let i = 0.5; i < len; i += 1) {
        const q = P([a[0] + ((b[0] - a[0]) * i) / len, a[1] + ((b[1] - a[1]) * i) / len]);
        ticks += `M${f(q[0])} ${f(q[1])}l${f(nx * s * 5 * k)} ${f(ny * s * 5 * k)}`;
      }
    }
    return `<g class="bs-rails" data-rail="${esc(sh.railName)}" data-feet="${sh.railFeet}"><path d="${d}" stroke="${ink}" stroke-width="${3.2 * k}" stroke-linecap="square" fill="none"/><path d="${ticks}" stroke="${ink}" stroke-width="${1.1 * k}" fill="none"/></g>`;
  };

  /* ---------- the small top view on the porch tiles ---------- */
  /* Rails and door marks in the picture's own points (right-handed; flipped for a porch on the left). */
  const TILE = {
    'End Porch': {
      'Side railing only': { rails: [[30, 62, 30, 80], [90, 62, 90, 80]] },
      'Door on the right': { rails: [[30, 62, 30, 80], [90, 62, 90, 80], [30, 80, 60, 80]], door: [53, 62, 67, 62, 69, 62, 83, 62] },
      'Door on the left': { rails: [[30, 62, 30, 80], [90, 62, 90, 80], [60, 80, 90, 80]], door: [53, 62, 67, 62, 37, 62, 51, 62] },
      'Door in the center': { rails: [[30, 62, 30, 80], [90, 62, 90, 80], [30, 80, 50, 80], [70, 80, 90, 80]] },
    },
    'Middle Porch': {
      'Door on the right': { rails: [[42, 74, 60, 74]], door: [53, 54, 67, 54, 61, 54, 75, 54] },
      'Door on the left': { rails: [[60, 74, 78, 74]], door: [53, 54, 67, 54, 45, 54, 59, 54] },
    },
    'Side Porch': { 'Side railing only': { rails: [[108, 54, 108, 74], [60, 74, 84, 74]], door: [77, 54, 91, 54, 88, 54, 102, 54] } },
    'Full Side Porch': { 'Standard railing': { rails: [[12, 54, 12, 74], [108, 54, 108, 74], [12, 74, 44, 74], [76, 74, 108, 74]] } },
    'Deluxe Porch': {
      'Standard railing': { rails: [[30, 62, 30, 80], [90, 26, 90, 44]] },
      'Extended railing': { rails: [[30, 62, 30, 80], [90, 26, 90, 44], [30, 80, 50, 80]] },
    },
  };
  let tileFor = null; /* the building a large top view is being drawn for */
  if (typeof porchPlan === 'function') {
    const basePlan = porchPlan;
    porchPlan = function (name, side = 'Left', large = false) {
      const svg = basePlan(name, side, large), c = tileFor || (typeof S === 'object' && S.c);
      const t = c && c.package === name && TILE[name]?.[pickOf(c, name)];
      if (!svg || !t) return svg;
      const sided = name === 'Side Porch' || name === 'Deluxe Porch', fx = (x) => (sided && side === 'Left' ? 120 - x : x);
      const ink = c.railColor === 'Black' ? '#16181b' : '#ffffff', edge = c.railColor === 'Black' ? '' : `<path d="${t.rails.map(([a, b, x, y]) => `M${fx(a)} ${b}L${fx(x)} ${y}`).join('')}" stroke="#1f2a35" stroke-width="3.6" stroke-linecap="round"/>`;
      let add = '';
      if (t.door) add += `<path d="M${fx(t.door[0])} ${t.door[1]}L${fx(t.door[2])} ${t.door[3]}" stroke="#1f2a35" stroke-width="3.6"/><path d="M${fx(t.door[4])} ${t.door[5]}L${fx(t.door[6])} ${t.door[7]}" stroke="#ffffff" stroke-width="3.4"/>`;
      add += `<g class="pp-rails" data-rail="${esc(pickOf(c, name))}">${edge}<path d="${t.rails.map(([a, b, x, y]) => `M${fx(a)} ${b}L${fx(x)} ${y}`).join('')}" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-dasharray="1.2 2.6"/></g>`;
      return svg.replace(/<text x="60" y="92"/, add + '<text x="60" y="92"');
    };
    if (typeof modelMarkup === 'function') {
      const baseModel = modelMarkup;
      modelMarkup = function (c) {
        tileFor = c;
        try { return baseModel.apply(this, arguments); } finally { tileFor = null; }
      };
    }
  }

  /* ---------- the explainer page ---------- */
  try {
    AW_REAL.sales.push('The 3D model and the floor plan show the porch railing that was picked, in its color, and leave it off when none was picked.');
    AW_OPEN.push(['Where each porch railing goes', 'The model draws each named railing in a set place: end porch sides and front, the half of a middle porch away from the door, the end and one bay of a side porch, two 4 ft runs on a deluxe porch, and the ends plus 8 ft from each corner on a full side porch. The side, deluxe “extended” and full side layouts are best guesses. Turbo Assist keeps railing as feet only.']);
  } catch (e) {}
}
