/* qc-app.js: the Plant QC side of the combined Bennett + ShedCor app.
   Loaded after the Sales Desk scripts (core.js, lot.js, changes.js, views.js) and built the
   same way: each screen is a function that returns an HTML string, render() puts it into
   <main id="app">, go(page) switches screens.

   What it shares with the sales side:
   - S.page and go(): QC screens are pages named "qc", "qc-inspect", "qc-rework"...
   - S.changes: one change order list for both sides (changes.js owns its shape).
   - S.sales: a sold custom order shows up here as a building that is Ready for QA, with the
     sale's own setup as its build sheet and 3D model. Its QC status is written back to the
     order so the dealer sees it.
   QC-only state lives in Q. Checklists, defect types and rules are in qc-config.js. */

/* One QC inspection per building. Internally a building is either in QC (stage 0) or signed
   off and ready to ship (stage 1). The tiles on screen are the checklist groups, not stages. */
const QC = "QC";
const STAGES = [QC, QC_CONFIG.shipTile];
const LAST = 1;
const AREAS = Object.keys(QC_CONFIG.checklists);
const TILES = [...AREAS, QC_CONFIG.shipTile];
const HOUR = 3600e3;
const NOW = Date.now();
const DAY_START = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

/* Checklist index built from qc-config.js: CHECK[QC] = [{area, section, items:[{id,text}]}] */
const CHECK = {}, ITEM = {};
(() => {
  let n = 0;
  CHECK[QC] = Object.entries(QC_CONFIG.checklists).flatMap(([area, sections]) =>
    sections.map((s) => ({
      area,
      section: s.section,
      items: s.items.map((text) => {
        const it = { id: "i" + ++n, text, area, section: s.section };
        ITEM[it.id] = it;
        return it;
      }),
    })),
  );
})();
const itemsOf = (stage) => (CHECK[stage] || []).flatMap((s) => s.items);

/* Questions that do not apply to an order (rules in qc-config.js, fed by the sale's setup). */
const SKIP_RULE = {};
QC_CONFIG.skipWhen.forEach((rule) => rule.questions.forEach((text) => (SKIP_RULE[text] = rule)));
const skipReason = (b, item) => (SKIP_RULE[item.text]?.when(b.c) ? SKIP_RULE[item.text].why : null);
const itemsFor = (b) => itemsOf(QC).filter((i) => !skipReason(b, i));
/* The question in this building's own words (rules in qc-config.js, under `specific`).
   Falls back to the general wording when there is no rule or the order lacks the detail. */
function askText(b, item) {
  try {
    return (b && item && QC_CONFIG.specific?.[item.text]?.(b)) || item.text;
  } catch {
    return item.text;
  }
}
const needsPhoto = (id) => !QC_CONFIG.photoNotNeeded.includes(ITEM[id]?.text);

/* ---------- QC state (in memory only; a reload resets it) ---------- */
const Q = {
  serial: null,
  who: 0,
  f: { status: "All", q: "" },
  builds: [],
  rework: [],
  log: [],
  drafts: {},
  inspections: [], /* first inspections: {at, serial, style, pass}. Feeds the first-pass rate. */
  defects: [], /* made-up closed failures from before today, for the quality report */
  reportDays: 30,
  rwFilter: "All",
  signSerial: null,
  rwSeq: 3,
  sheetOpen: true,
};

/* Every pass, fail, rework and sign-off is appended here with who and when. Nothing is removed. */
function record(serial, stage, text, at = Date.now(), who = me().name) {
  Q.log.push({ at, who, serial, stage, text });
}
const me = () => QC_CONFIG.people[Q.who];

/* The sale's setup for a sample building, in the same shape the Sales desk uses, so the build
   sheet, the 3D model and the "does not apply" rules work the same for every building. */
const QC_STYLE = {
  "Basic Utility": { style: "Utility" },
  "Classic Utility": { style: "Utility", shield: true },
  "Elite Utility": { style: "Utility", siding: "Lap" },
  "Basic Lofted Barn": { style: "Lofted" },
  "Classic Lofted Barn": { style: "Lofted", shield: true },
  "Basic Studio": { style: "Studio" },
  "Silver Bullet": { style: "Silver Bullet", siding: "Metal" },
};
function sampleConfig(b) {
  return { ...defaults, ...QC_STYLE[b.style], size: b.size, color: b.siding_color, trimColor: b.trim_color, roof: /shingle/i.test(b.roof) ? "Shingles" : "Metal", ...b.order_options };
}

(function seed() {
  const SAMPLE = "Sample record";
  Q.builds = QC_SAMPLE.builds.map((b) => {
    const stage = STAGES.indexOf(b.stage);
    const o = { ...b, stage, order: b.sales_order || b.serial, c: sampleConfig(b), results: {}, superseded: [], attempts: {}, hold: null };
    if (b.qc_status === "Needs sign-off" || b.qc_status === "Signed off") {
      const at = b.qc_status === "Signed off" ? NOW - 5 * HOUR : b.days_in_stage < 2 ? Math.max(DAY_START + 60e3, NOW - (2 + b.days_in_stage) * HOUR) : NOW - 30 * HOUR;
      o.results[QC] = { result: "pass", firstPass: true, by: SAMPLE, at };
      o.attempts[QC] = 1;
      record(b.serial, QC, "Inspection passed", at, SAMPLE);
    }
    if (b.qc_status === "On hold") {
      o.hold = { reason: QC_SAMPLE.hold_reasons[b.serial] || "On hold", by: SAMPLE, at: NOW - 50 * HOUR };
      record(b.serial, QC, `Put on hold: ${o.hold.reason}`, o.hold.at, SAMPLE);
    }
    if (b.qc_status === "Signed off") {
      o.signoff = { by: SAMPLE, at: NOW - 3 * HOUR };
      record(b.serial, QC, "Signed off. Ready to ship", o.signoff.at, SAMPLE);
    }
    return o;
  });
  /* A sample building part-way through its check: the first two tiles answered Yes. */
  Q.builds.filter((b) => b.qc_status === "In QA").forEach((b) => {
    const answers = {};
    itemsFor(b).filter((i) => AREAS.indexOf(i.area) < 2).forEach((i) => (answers[i.id] = { r: "pass" }));
    Q.drafts[b.serial + "|" + QC] = { answers };
  });
  Q.rework = QC_SAMPLE.rework.map((r) => {
    const b = build(r.serial), openedAt = NOW - r.opened_hours_ago * HOUR;
    const item = itemsOf(QC).find((i) => i.text === r.item);
    b.results[QC] = { result: "fail", firstPass: false, by: SAMPLE, at: openedAt };
    b.attempts[QC] = 1;
    record(r.serial, QC, `Failed: ${r.item} (${r.defect}). Sent to rework`, openedAt, SAMPLE);
    const step = QC_CONFIG.reworkSteps.indexOf(r.step);
    if (step === 1) record(r.serial, QC, `Fixed by ${r.assigned_to || "the crew"}: ${r.item}. Ready for re-inspection`, openedAt + 30 * HOUR, SAMPLE);
    return { id: r.id, serial: r.serial, stage: QC, itemId: item?.id, item: r.item, defect: r.defect, note: r.note, photo: null, assigned: r.assigned_to, fixedBy: step === 1 ? r.assigned_to : null, step, openedAt, by: SAMPLE, sample: true };
  });

  /* Links to the Sales desk samples.
     - Its sample order for Taylor Reed (10x16 Classic Utility) is this side's SAMPLE-1016-1001,
       so that order's change order CO-1 shows on the building here.
     - One more sample change order, approved and waiting on the plant, on a building in QC. */
  sampleBuilds[0].stage = phaseNames.indexOf("Final QA");
  const ago = (h) => new Date(NOW - h * HOUR).toISOString();
  S.changes.push({
    id: "CO-" + (S.changes.length + 1),
    order: "SAMPLE-1020-1004",
    what: "Move the left-wall window 2 ft toward the back wall.",
    reason: "Customer is putting shelving by the door.",
    done: 2,
    log: [ago(30), ago(9)],
    sample: true,
  });
})();

/* ---------- Lookups ---------- */
function build(serial) { return Q.builds.find((b) => b.serial === serial); }
const stageName = () => QC;
const started = (b) => Object.values(Q.drafts[b.serial + "|" + QC]?.answers || {}).some((a) => a.r);
const openRework = (b) => Q.rework.filter((r) => r.serial === b.serial && r.step < 2);
/* Change orders are the Sales desk's own records: done counts finished steps (1 requested,
   2 approved, 3 acknowledged by the plant). A declined one no longer blocks anything. */
const changeOpen = (c) => !c.declined && c.done < 3;
const changesOf = (b) => S.changes.filter((c) => c.order === b.order);
const openChanges = (b) => changesOf(b).filter(changeOpen);
function qcStatus(b) {
  if (b.stage === LAST) return "Ready to ship";
  if (b.hold) return "On hold";
  if (openRework(b).length) return "In rework";
  if (b.results[QC]?.result === "pass") return "Needs sign-off";
  return started(b) ? "In QA" : "Ready for QA";
}
const STATUS_PILL = { "Ready for QA": "blue", "In QA": "amber", "Needs sign-off": "amber", "In rework": "red", "On hold": "red", "Ready to ship": "good" };
const statusPill = (b) => { const s = qcStatus(b); return `<span class="pill ${STATUS_PILL[s]}">${s}</span>`; };
const when = (t) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
function age(t) {
  const h = Math.max(0, Math.round((Date.now() - t) / HOUR));
  return h < 1 ? "under an hour" : h < 48 ? plural(h, "hour") : plural(Math.round(h / 24), "day");
}

/* ---------- Link to the Sales desk ---------- */

/* A sold custom order becomes a building that is Ready for QA. In this preview that happens as
   soon as the sale is approved; live, it would happen when the plant marks the build complete. */
function syncSales() {
  /* Only once the plant has marked the build complete on the order (s.built). */
  S.sales.filter((s) => s.status === "Processed · Sold" && s.built && !["lot", "site", "stock"].includes(s.path) && !build(s.id)).forEach((s) => {
    const b = {
      serial: s.id, order: s.id, saleId: s.id, customer: s.customer, c: s.c,
      size: s.c.size, style: label(s.c).replace(s.c.size, "").trim(), dealer: `Bennett Buildings of ${LOT_LOCATION}`,
      siding_color: s.c.color, trim_color: s.c.trimColor || "Origami White",
      roof: s.c.roof === "Metal" ? (s.c.roofColor ? s.c.roofColor + " metal" : "Metal") : "Architectural shingles",
      stage: 0, days_in_stage: 0, results: {}, superseded: [], attempts: {}, hold: null, model_image: null,
    };
    Q.builds.push(b);
    record(b.serial, QC, "Build complete and ready for QA (marked on the Sales desk order in this tab)", Date.now(), "Sample record");
    captureThumb(b);
  });
}
/* What the dealer sees on their order while the building is with QC. */
function dealerStatus(b) {
  const n = openRework(b).length;
  return {
    "Ready for QA": "Built · waiting on plant QC",
    "In QA": "Plant QC in progress",
    "In rework": `Plant QC found ${plural(n, "thing")} to fix`,
    "Needs sign-off": "Passed plant QC · waiting on sign-off",
    "On hold": "On hold at the plant",
    "Ready to ship": "Passed plant QC · ready to ship",
  }[qcStatus(b)];
}
function syncDealer() {
  Q.builds.forEach((b) => {
    const s = b.saleId && S.sales.find((x) => x.id === b.saleId);
    if (s) s.fulfillment = dealerStatus(b);
    if (b.order === "B0") {
      sampleBuilds[0].stage = phaseNames.indexOf(b.stage === LAST ? "Build complete" : "Final QA");
      sampleBuilds[0].note = `Plant QC: ${dealerStatus(b)}. Serial ${b.serial}.`;
    }
  });
}
/* A milestone the dealer should see in the order's own timeline. */
function dealerNote(b, text) {
  const s = b.saleId && S.sales.find((x) => x.id === b.saleId);
  if (s) s.events.push({ text: "Plant QC: " + text, time: new Date().toLocaleTimeString() });
}
/* Change order names on the sales side: say which building a QC sample order is. */
const salesChangeOrderName = changeOrderName;
changeOrderName = function (key) {
  const b = Q.builds.find((x) => x.order === key && !x.saleId && key[0] !== "B");
  return b ? `${b.serial} · ${b.size} ${b.style}` : salesChangeOrderName(key);
};

/* A still picture of a sold order's 3D model, taken once in the browser, for the cards. */
function captureThumb(b) {
  const html = modelMarkup(b.c, true);
  if (!html.includes("<model-viewer")) return;
  const box = document.createElement("div");
  box.className = "qc-capture";
  box.innerHTML = html;
  document.body.appendChild(box);
  const v = box.querySelector("model-viewer");
  const done = () => { box.remove(); if (document.body.dataset.side === "qc") render(); };
  v.addEventListener("load", async () => {
    try {
      applyModelColors(v);
      await v.updateComplete;
      await new Promise((r) => setTimeout(r, 500));
      b.model_image = v.toDataURL("image/png");
    } catch { /* the card keeps its placeholder */ }
    done();
  }, { once: true });
  v.addEventListener("error", done, { once: true });
}

/* ---------- Shell: one render() for both sides ---------- */
const QC_NAV = { "qc-inspect": "qc", "qc-notes": "qc" };
const DETAIL = { "qc-inspect": true, "qc-notes": true };
let lastView = "";
const salesRender = render;
render = function () {
  const screen = QC_SCREENS[S.page];
  document.body.dataset.side = screen ? "qc" : "sales";
  if (!screen) {
    document.body.classList.remove("qc-detail");
    $("#appnav").innerHTML = "";
    lastView = "";
    return salesRender();
  }
  syncSales();
  document.body.dataset.page = S.page;
  document.body.classList.toggle("qc-detail", !!DETAIL[S.page]);
  const nav = QC_NAV[S.page] || S.page;
  document.querySelectorAll("[data-nav]").forEach((b) => {
    const on = b.dataset.nav === nav;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  /* Phones and tablets: detail screens swap the logo for a back button and a title, like an app. */
  const title = S.page === "qc-inspect" ? build(Q.serial)?.serial : "About this preview";
  $("#appnav").innerHTML = DETAIL[S.page] ? `<button class="appback" onclick="go('qc')">${icon("back", 20)}<span>Buildings</span></button><strong>${esc(title || "")}</strong><span></span>` : "";
  const app = $("#app");
  app.innerHTML = screen();
  const view = S.page + "|" + (DETAIL[S.page] ? Q.serial : "");
  if (view !== lastView) {
    app.classList.remove("qc-enter", "qc-enter-detail");
    void app.offsetWidth;
    app.classList.add(DETAIL[S.page] ? "qc-enter-detail" : "qc-enter");
    lastView = view;
  }
  syncDealer();
};
function openBuild(serial) { Q.serial = serial; go("qc-inspect"); }
function inspectNext() {
  const next = Q.builds.filter((b) => ["In QA", "Ready for QA"].includes(qcStatus(b))).sort((a, b) => started(b) - started(a) || b.days_in_stage - a.days_in_stage)[0];
  if (next) openBuild(next.serial);
  else toast("Nothing is ready for QA.");
}

/* ---------- Screen 1: Buildings (QC home) ---------- */
function counters() {
  const count = (s) => Q.builds.filter((b) => qcStatus(b) === s).length;
  const passedToday = Q.builds.reduce((n, b) => n + Object.values(b.results).filter((r) => r.result === "pass" && r.at >= DAY_START).length, 0);
  return { waiting: count("Ready for QA") + count("In QA"), rework: count("In rework"), passedToday, rate: firstPassStats(7).rate };
}
function floor() {
  const c = counters(), f = Q.f;
  const kpi = (status, n, label) => `<button class="kpi" aria-pressed="${f.status === status}" onclick="setFilter('status','${f.status === status ? "All" : status}')"><strong>${n}</strong><span>${label}</span></button>`;
  const statuses = ["All", "Ready for QA", "In QA", "In rework", "Needs sign-off", "On hold", "Ready to ship"];
  return `${head("ShedCor Plant · Quality control", "Buildings", "Every building here is built and out of the plant. The tiles show how far its QC check has got.")}
  <div class="today">
    ${kpi("Ready for QA", c.waiting, "Ready for QA or in QA")}
    ${kpi("In rework", c.rework, "In rework")}
    <div class="kpi"><strong>${c.passedToday}</strong><span>Passed inspection today</span></div>
    <div class="kpi"><strong>${c.rate}%</strong><span>First-pass rate this week</span></div>
  </div>
  <div class="qc-filter">
    <label class="searchbar">${icon("orders", 18)}<input class="search" id="floor-search" type="search" inputmode="search" placeholder="Search by serial or customer" aria-label="Search by serial or customer" value="${esc(f.q)}" oninput="Q.f.q=this.value;$('#floorlist').innerHTML=floorList()"></label>
    <div><small>QC status</small><div class="chiprow">${statuses.map((s) => `<button class="chipbtn${f.status === s ? " on" : ""}" onclick="setFilter('status','${s}')">${s}</button>`).join("")}</div></div>
  </div>
  <div id="floorlist">${floorList()}</div>
  <p class="lede-small" style="margin-top:20px">Sample buildings, plus any order sold on the Sales desk side in this tab. Nothing is saved between visits. <button class="link inline" onclick="go('qc-notes')">What is real and what is not</button></p>`;
}
function setFilter(key, value) { Q.f[key] = value; render(); }
function floorList() {
  const f = Q.f, q = f.q.trim().toLowerCase();
  const rows = Q.builds
    .filter((b) => (f.status === "All" || qcStatus(b) === f.status) && (!q || (b.serial + " " + (b.customer || "")).toLowerCase().includes(q)))
    .sort((a, b) => floorOrder(a) - floorOrder(b) || b.days_in_stage - a.days_in_stage);
  if (!rows.length)
    return `<div class="panel emptystate"><strong>No buildings match</strong><p>Nothing fits that search and those filters.</p>${button("Show every building", "Q.f={status:'All',q:''};render()", "secondary")}</div>`;
  const groups = [
    ["In QC", (b) => b.stage !== LAST],
    ["Ready to ship", (b) => b.stage === LAST],
  ];
  return groups.map(([title, test]) => {
    const g = rows.filter(test);
    return g.length ? `<h2 class="sectionhead qc-group">${title} <small>${g.length}</small></h2><div class="cards qc-floor">${g.map(floorCard).join("")}</div>` : "";
  }).join("");
}
/* The QC tiles for one building. Same chevrons as chevronTrack() on the sales side, but they
   show how far the QC CHECK has got, not how far the building is built:
     grey   nothing answered in that group yet
     amber  the group the inspector is on (or sign-off, once everything has passed)
     navy   every question in the group is Yes or N/A
     red    a question in the group has an open failure
     green  Ready to ship, once signed off */
function areaState(b, area) {
  if (openRework(b).some((r) => ITEM[r.itemId]?.area === area)) return "failed";
  if (b.stage === LAST || b.results[QC]) return "done"; /* inspection finished: the rest was Yes, N/A or fixed */
  if (!started(b)) return "";
  const ans = Q.drafts[b.serial + "|" + QC]?.answers || {};
  const items = itemsFor(b).filter((i) => i.area === area);
  if (items.some((i) => ans[i.id]?.r === "fail")) return "failed";
  return items.every((i) => ans[i.id]?.r) ? "done" : "";
}
function qcTrack(b) {
  const states = AREAS.map((a) => areaState(b, a)), shipped = b.stage === LAST;
  const current = started(b) ? states.indexOf("") : -1;
  const passed = !shipped && b.results[QC]?.result === "pass" && !openRework(b).length;
  const failed = AREAS.filter((a, i) => states[i] === "failed"), done = states.filter((x) => x === "done").length;
  const text = shipped ? "Signed off and ready to ship" : `${done} of ${AREAS.length} QC groups checked${failed.length ? `. Open failures in: ${failed.join(", ")}` : ""}${passed ? ". Waiting on sign-off" : ""}`;
  const tile = (name, cls) => `<i class="${cls}"><span>${esc(name).replace(/ /g, "<br>")}</span></i>`;
  return `<span class="chev long" role="img" aria-label="${esc(text)}"><span class="chev-row" style="--n:${TILES.length}">${
    AREAS.map((a, i) => tile(a, states[i] === "failed" ? "done failed" : states[i] === "done" ? "done" : i === current ? "now" : "")).join("")
  }${tile(QC_CONFIG.shipTile, shipped ? "now ship" : passed ? "now" : "")}</span></span>`;
}
/* Picture of the building's 3D model from the sale. Tap it to turn the live model. */
function thumb(b, big = false) {
  const alt = `${esc(b.size)} ${esc(b.style)}, ${esc(b.siding_color)} siding, ${esc(b.trim_color)} trim`;
  return `<button class="qc-thumb${big ? " big" : ""}" onclick="showModel('${b.serial}')" aria-label="Open the 3D model for ${esc(b.serial)}">${
    b.model_image ? `<img src="${esc(b.model_image)}" alt="${alt}" loading="lazy">` : icon("lot", 28)
  }</button>`;
}
function showModel(serial) {
  const b = build(serial), live = modelMarkup(b.c);
  modal(`${esc(b.size)} ${esc(b.style)}`, `${live || (b.model_image ? `<div class="qc-modelbig"><img src="${esc(b.model_image)}" alt=""></div>` : "")}
    <div class="qc-facts"><span>Siding <strong>${esc(b.siding_color)}</strong></span><span>Trim <strong>${esc(b.trim_color)}</strong></span><span>Roof <strong>${esc(b.roof)}</strong></span></div>
    <p class="lede-small">${esc(b.serial)}. Drag to turn it. The model shows the style, package and colors from the sale. Doors, windows and options are listed on the build sheet.</p>`);
}
/* Order on the Buildings screen: being checked, ready for QA, in rework, needs sign-off, on hold,
   then signed off. Within each, the building that has been out of the plant longest comes first. */
const floorOrder = (b) => ["In QA", "Ready for QA", "In rework", "Needs sign-off", "On hold", "Ready to ship"].indexOf(qcStatus(b));
function floorCard(b) {
  const st = qcStatus(b), rw = openRework(b), co = openChanges(b);
  const ready = rw.filter((r) => r.step === 1).length;
  const action =
    st === "Ready for QA" ? ["Start QA", "primary"]
    : st === "In QA" ? ["Continue QA", "primary"]
    : st === "In rework" ? [ready ? "Re-inspect" : "Open rework", ready ? "primary" : "secondary"]
    : st === "Needs sign-off" ? ["Open for sign-off", "primary"]
    : ["Open", "secondary"];
  const days = b.stage === LAST ? "" : b.days_in_stage < 1 ? "Ready for QC today" : `Ready for QC ${plural(b.days_in_stage, "day")}`;
  return `<article class="card qc-card">
    <div class="qc-cardtop">${thumb(b)}<div class="grow">${statusPill(b)}<h3>${esc(b.serial)}</h3><p><strong>${esc(b.size)} ${esc(b.style)}</strong><br><small>${esc(b.dealer)}${b.customer ? ` · for ${esc(b.customer)}` : ""}</small></p></div></div>
    ${qcTrack(b)}
    <div class="pillrow">${[
      days && `<span class="pill ghost">${days}</span>`,
      b.saleId && `<span class="pill blue">Sold in this tab</span>`,
      b.hold && `<span class="pill ghost">${esc(b.hold.reason)}</span>`,
      rw.length && `<span class="pill ghost">${plural(rw.length, "open failure")}${ready ? `, ${ready} fixed` : ""}</span>`,
      co.length && `<span class="pill amber">Change order open</span>`,
    ].filter(Boolean).join(" ")}</div>
    <button class="${action[1]} qc-open" onclick="openBuild('${b.serial}')">${action[0]}</button>
  </article>`;
}

/* ---------- Screen 2: Inspect a building ---------- */
function draftOf(b) {
  return (Q.drafts[b.serial + "|" + QC] ??= { answers: {} });
}
function missing(a, id) {
  if (a?.r !== "fail") return [];
  return [!a.defect && "a defect type", !(a.note || "").trim() && "a note", needsPhoto(id) && !a.photo && "a photo"].filter(Boolean);
}
function tally(b) {
  const items = itemsFor(b), ans = draftOf(b).answers;
  const answered = items.filter((i) => ans[i.id]?.r).length;
  const fails = items.filter((i) => ans[i.id]?.r === "fail");
  const incomplete = fails.filter((i) => missing(ans[i.id], i.id).length).length;
  return { total: items.length, answered, fails: fails.length, incomplete, ready: answered === items.length && !incomplete };
}

function inspect() {
  const b = build(Q.serial);
  if (!b) return floor();
  const st = qcStatus(b), co = changesOf(b).filter((c) => !c.declined);
  let body;
  if (b.stage === LAST) body = `<div class="panel emptystate"><strong>Ready to ship</strong><p>Signed off by ${esc(b.signoff?.by)} on ${when(b.signoff?.at)}.</p></div>`;
  else if (b.hold) body = holdPanel(b);
  else if (st === "In rework") body = reworkPanel(b);
  else if (st === "Needs sign-off") body = passedPanel(b);
  else body = checklist(b);
  return `<button class="link backlink" onclick="go('qc')">${icon("back", 18)} Buildings</button>
  ${head(b.stage === LAST ? "Ready to ship" : "QC inspection", `${esc(b.size)} ${esc(b.style)}`, `${esc(b.serial)} · ${esc(b.dealer)}${b.customer ? ` · for ${esc(b.customer)}` : ""}`)}
  <section class="panel">
    <div class="panelhead"><div class="pillrow">${statusPill(b)}</div><button class="chipbtn" onclick="pickPerson()">${icon("user", 16)} ${esc(me().name)}, ${esc(me().role)} · change</button></div>
    ${qcTrack(b)}
    <div class="qc-ref">${thumb(b, true)}<div class="qc-facts"><span>Siding <strong>${esc(b.siding_color)}</strong></span><span>Trim <strong>${esc(b.trim_color)}</strong></span><span>Roof <strong>${esc(b.roof)}</strong></span><span>Size <strong>${esc(b.size)}</strong></span></div></div>
  </section>
  ${buildSheet(b)}
  ${co.length ? `<section class="changes">${co.map((c) => qcChangeCard(c)).join("")}</section>` : ""}
  <div class="stack" style="margin-top:20px">${body}</div>
  ${historyPanel(b)}`;
}

/* The build sheet: what was sold, in the same words the Sales desk shows the dealer. */
function buildSheet(b) {
  const lines = included(b.c).filter((x) => x && x !== "Standard Storage").map((x) => (x === "None electrical" ? "No electrical" : x));
  const from = b.saleId ? `Sold to ${esc(b.customer)} on the Sales desk` : b.order === "B0" ? `Sales desk sample order for ${esc(b.customer)}` : "Sample order";
  return `<details class="panel qc-sheet" ${Q.sheetOpen ? "open" : ""} ontoggle="Q.sheetOpen=this.open"><summary><h2>Build sheet</h2><span class="pill ghost">${from}</span></summary>
    <ul>${lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    ${b.saleId ? `<p><button class="link" onclick="openSale('${b.saleId}')">Open the order on the Sales desk ${icon("arrow", 16)}</button></p>` : ""}
  </details>`;
}

function buildingLine(b) {
  return `<div class="qc-bline">${thumb(b)}<div class="grow"><strong>${esc(b.serial)}</strong><small>${esc(b.size)} ${esc(b.style)} · ${qcStatus(b)}</small></div><button class="secondary small" onclick="openBuild('${b.serial}')">Open building</button></div>`;
}
/* A dealer's change order: requested by the manager, approved by an admin, acknowledged by the
   plant. The record itself belongs to the Sales desk (changes.js); this is the plant's view. */
function qcChangeCard(c, withBuilding = false) {
  const [status] = changeStatus(c), b = Q.builds.find((x) => x.order === c.order);
  const where = !withBuilding ? "" : b ? buildingLine(b) : `<div class="qc-bline"><div class="grow"><strong>${esc(changeOrderName(c.order))}</strong><small>Still being built. Not in QC yet.</small></div></div>`;
  const action = c.declined ? ""
    : c.done === 2 ? `<div class="actions">${button("Acknowledge this change", `ackChange('${c.id}')`, "primary")}</div>`
    : c.done < 2 ? `<small>The plant can acknowledge this once an admin approves it. In this preview the admin's button is on the order, on the Sales desk side.</small>`
    : `<small>Acknowledged${c.ackBy ? ` by ${esc(c.ackBy)}` : ""} on ${changeWhen(c.log[2])}.</small>`;
  return `<div class="changecard"><small>Change order ${esc(c.id)} · ${status}</small>${where}<span class="changetext">${esc(c.what)}</span>${c.reason ? `<small>${esc(c.reason)}</small>` : ""}${chevronTrack(CHANGE_STEPS, c.declined ? 1 : c.done, Boolean(c.declined))}${action}</div>`;
}
function ackChange(id) {
  const c = S.changes.find((x) => x.id === id), b = Q.builds.find((x) => x.order === c.order);
  if (!c || c.declined || c.done !== 2) return;
  c.done = 3;
  c.log.push(new Date().toISOString());
  c.ackBy = me().name;
  if (b) record(b.serial, QC, `Change order ${c.id} acknowledged by the plant: ${c.what}`);
  toast(`Change order ${c.id} acknowledged.`);
  render();
}

function checklist(b) {
  const d = draftOf(b), ans = d.answers;
  const panel = (s, title) => {
    const items = s.items.filter((i) => !skipReason(b, i));
    const skipped = [...new Set(s.items.map((i) => skipReason(b, i)).filter(Boolean))];
    const done = items.filter((i) => ans[i.id]?.r).length, n = CHECK[QC].indexOf(s);
    const note = skipped.length ? `<p class="qc-skipnote">${plural(s.items.length - items.length, "question")} left out: ${skipped.map(esc).join("; ")}.</p>` : "";
    if (!items.length) return `<section class="panel"><div class="panelhead"><h2>${esc(title)}</h2><span class="pill ghost">Does not apply</span></div>${note}</section>`;
    return `<section class="panel">
      <div class="panelhead"><h2>${esc(title)}</h2><span class="pill ${done === items.length ? "good" : "ghost"}">${done} of ${items.length}</span></div>
      ${items.map((i) => itemRow(i, ans[i.id])).join("")}
      ${done < items.length ? `<div class="qc-rest"><button class="secondary" onclick="yesToRest(${n})">${icon("check", 18)} Yes to the other ${items.length - done}</button></div>` : ""}
      ${note}
    </section>`;
  };
  /* One block per QC tile. A tile with several sections gets a heading above its panels. */
  const sections = AREAS.map((area) => {
    const group = CHECK[QC].filter((s) => s.area === area);
    return group.length === 1 ? panel(group[0], area) : `<h2 class="sectionhead qc-area">${esc(area)}</h2>${group.map((s) => panel(s, s.section)).join("")}`;
  });
  return `<p class="muted">Yes means the item is good. No means it needs fixing. Answers are kept if you leave this screen and come back.</p>${sections.join("")}
  <div class="qc-bar" id="qc-bar">${barHTML(b)}</div>
  <p><button class="link" onclick="holdModal()">${icon("lock", 16)} Put this building on hold</button></p>`;
}
/* "Yes to the rest": answers Yes to every question in one group that has no answer yet.
   It is recorded on the inspection, so the report can show where the shortcut was used. */
function yesToRest(n) {
  const b = build(Q.serial), d = draftOf(b), s = CHECK[QC][n];
  s.items.filter((i) => !skipReason(b, i) && !d.answers[i.id]?.r).forEach((i) => (d.answers[i.id] = { ...d.answers[i.id], r: "pass" }));
  d.bulk = [...new Set([...(d.bulk || []), s.section])];
  render();
}
function itemRow(i, a) {
  const btn = (r, text) => `<button class="${r}${a?.r === r ? " on" : ""}" aria-pressed="${a?.r === r}" onclick="answer('${i.id}','${r}')">${text}</button>`;
  return `<div class="qc-item" id="row-${i.id}">
    <p>${esc(askText(build(Q.serial), i))}</p>
    <div class="qc-ans" role="group" aria-label="${esc(askText(build(Q.serial), i))}">${btn("pass", "Yes")}${btn("fail", "No")}${btn("na", "N/A")}</div>
    ${a?.r === "fail" ? failForm(i, a) : ""}
  </div>`;
}
function failForm(i, a) {
  return `<div class="qc-fail">
    <h4>What is wrong?</h4>
    <div class="chiprow">${QC_CONFIG.defectTypes.map((d, n) => `<button class="chipbtn${a.defect === d ? " on" : ""}" aria-pressed="${a.defect === d}" onclick="setDefect('${i.id}',${n})">${esc(d)}</button>`).join("")}</div>
    <label class="field">Note for the crew fixing it<textarea id="note-${i.id}" rows="2" placeholder="Where it is and what to fix" oninput="setNote('${i.id}',this.value)">${esc(a.note || "")}</textarea></label>
    <div class="qc-photo">
      ${a.photo ? `<img src="${a.photo}" alt="Photo of the failure">` : ""}
      <label class="secondary">${icon("plus", 18)} ${a.photo ? "Retake photo" : "Take photo"}<input id="photo-${i.id}" type="file" accept="image/*" capture="environment" onchange="setPhoto('${i.id}',this)"></label>
      ${needsPhoto(i.id) ? "" : `<small>A photo is optional for this question.</small>`}
    </div>
    <span class="qc-missing" id="miss-${i.id}">${missingText(a, i.id)}</span>
  </div>`;
}
const missingText = (a, id) => { const m = missing(a, id); return m.length ? "Still needed: " + m.join(", ") + "." : ""; };
function barHTML(b) {
  const t = tally(b), left = t.total - t.answered;
  const why = left ? `${plural(left, "item")} left to answer`
    : t.incomplete ? "An item answered No still needs a defect type, a note or a photo"
    : t.fails ? `${plural(t.fails, "item")} answered No. The building cannot be signed off until fixed.`
    : "Every item is Yes or N/A";
  return `<div class="grow"><strong>${t.answered} of ${t.total} answered</strong><small>${why}</small></div>
    <button class="primary big" ${t.ready ? "" : "disabled"} onclick="finishInspection()">${t.fails ? "Send to rework" : "Pass inspection"}</button>`;
}
function answer(id, r) {
  const b = build(Q.serial), ans = draftOf(b).answers;
  ans[id] = { ...ans[id], r };
  render();
}
function setDefect(id, n) { draftOf(build(Q.serial)).answers[id].defect = QC_CONFIG.defectTypes[n]; render(); }
function setNote(id, value) {
  const b = build(Q.serial), a = draftOf(b).answers[id];
  a.note = value;
  $("#miss-" + id).textContent = missingText(a, id);
  $("#qc-bar").innerHTML = barHTML(b);
}
function setPhoto(id, input) {
  const file = input.files?.[0];
  if (!file) return;
  const serial = Q.serial, reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      /* Keep a small copy only: photos live in memory in this preview. */
      const k = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      draftOf(build(serial)).answers[id].photo = c.toDataURL("image/jpeg", 0.7);
      if (S.page === "qc-inspect" && Q.serial === serial) render();
    };
    img.onerror = () => toast("That file is not a photo. Try again.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function finishInspection() {
  const b = build(Q.serial), t = tally(b);
  if (!t.ready) return;
  const d = draftOf(b), ans = d.answers, items = itemsFor(b);
  const attempt = (b.attempts[QC] = (b.attempts[QC] || 0) + 1);
  const first = attempt === 1;
  if (first) Q.inspections.push({ at: Date.now(), serial: b.serial, style: b.style, pass: !t.fails });
  const answers = Object.fromEntries(items.map((i) => [i.id, ans[i.id].r]));
  const bulk = d.bulk || [];
  if (bulk.length) record(b.serial, QC, `"Yes to the rest" used on: ${bulk.join(", ")}`);
  if (t.fails) {
    items.filter((i) => ans[i.id].r === "fail").forEach((i) => {
      const a = ans[i.id];
      Q.rework.push({ id: "RW-" + ++Q.rwSeq, serial: b.serial, stage: QC, itemId: i.id, item: i.text, ask: askText(b, i), defect: a.defect, note: a.note.trim(), photo: a.photo, assigned: null, step: 0, openedAt: Date.now(), by: me().name });
      record(b.serial, QC, `Failed: ${askText(b, i)} (${a.defect}). Sent to rework`);
    });
    b.results[QC] = { result: "fail", firstPass: false, by: me().name, at: Date.now(), answers, bulk };
    dealerNote(b, `inspection found ${plural(t.fails, "thing")} to fix before it can ship`);
    toast(`${plural(t.fails, "failure")} sent to rework. ${b.serial} cannot be signed off yet.`);
  } else {
    b.results[QC] = { result: "pass", firstPass: first, by: me().name, at: Date.now(), answers, bulk };
    record(b.serial, QC, `Inspection passed${first ? " first time" : ""}`);
    dealerNote(b, "inspection passed · waiting on sign-off");
    toast(`Inspection passed for ${b.serial}.`);
  }
  delete Q.drafts[b.serial + "|" + QC];
  render();
  scrollTo(0, 0);
}

/* A building in rework: each open failure, with the Failed > Fixed > Re-inspected track. */
function reworkPanel(b) {
  const open = openRework(b);
  return `<section class="panel">
    <div class="panelhead"><h2>${plural(open.length, "open failure")}</h2><span class="pill red">Cannot be signed off</span></div>
    <p class="muted">${esc(b.serial)} cannot be signed off until every failure is fixed and passes re-inspection.</p>
    <div class="stack">${open.map((r) => reworkCard(r)).join("")}</div>
  </section>
  <p><button class="link" onclick="holdModal()">${icon("lock", 16)} Put this building on hold</button></p>`;
}
function reworkCard(r, withBuilding = false) {
  const actions = r.step === 0
    ? button("Mark as fixed", `fixedModal('${r.id}')`, "primary")
    : button("Re-inspection passed", `reinspect('${r.id}',true)`, "primary") + button("Still failing", `reinspect('${r.id}',false)`, "secondary");
  return `<div class="qc-rework">
    ${withBuilding ? buildingLine(build(r.serial)) : ""}
    <div class="buildrow-head"><strong class="grow">${esc(r.ask || askText(build(r.serial), ITEM[r.itemId] || { text: r.item }))}</strong><span class="pill red">${esc(r.defect)}</span></div>
    <p>${esc(r.note)}</p>
    ${r.photo ? `<img src="${r.photo}" alt="Photo of the failure">` : `<small>${r.sample ? "No photo on this sample record." : "No photo was needed for this question."}</small>`}
    ${chevronTrack(QC_CONFIG.reworkSteps, r.step)}
    <small>Failed ${age(r.openedAt)} ago by ${esc(r.by)} · ${r.step === 1 && r.fixedBy ? `Fixed by ${esc(r.fixedBy)}` : r.assigned ? `Assigned to ${esc(r.assigned)}` : "Not assigned"} ${r.step === 0 ? `<button class="link inline" onclick="assignModal('${r.id}')">${r.assigned ? "Change" : "Assign"}</button>` : ""}</small>
    <div class="actions">${actions}</div>
  </div>`;
}
const rw = (id) => Q.rework.find((r) => r.id === id);
/* Marking a failure fixed asks who did the work, so rework can be traced to a crew. */
function fixedModal(id) {
  const r = rw(id);
  modal("Who fixed it?", `<p class="muted">${esc(r.item)}</p><div class="qc-pick">${QC_CONFIG.crews.map((c, n) => `<button class="secondary" onclick="markFixed('${id}',${n})">${esc(c)}${r.assigned === c ? '<span class="pill good">Assigned</span>' : ""}</button>`).join("")}<button class="secondary" onclick="markFixed('${id}',-1)">${esc(me().name)} (inspector fixed it)</button></div>`);
}
function markFixed(id, n) {
  const r = rw(id);
  r.step = 1; r.fixedAt = Date.now(); r.fixedBy = n < 0 ? me().name : QC_CONFIG.crews[n];
  record(r.serial, QC, `Fixed by ${r.fixedBy}: ${r.item}. Ready for re-inspection`);
  closeModal();
  toast("Marked as fixed. It needs a re-inspection before it closes.");
  render();
}
function reinspect(id, passed) {
  const r = rw(id), b = build(r.serial);
  if (!passed) {
    r.step = 0;
    record(r.serial, QC, `Re-inspection failed: ${r.item}. Back to rework`);
    toast("Still failing. Sent back to rework.");
    return render();
  }
  r.step = 2; r.closedAt = Date.now(); r.closedBy = me().name;
  record(r.serial, QC, `Re-inspection passed: ${r.item}. Failure closed`);
  if (!openRework(b).length) {
    b.results[QC] = { ...b.results[QC], result: "pass", firstPass: false, by: me().name, at: Date.now() };
    record(r.serial, QC, "Inspection passed after rework");
    dealerNote(b, "everything is fixed and re-inspected · waiting on sign-off");
    toast(`Every failure is closed. ${b.serial} has passed inspection.`);
  } else toast("Failure closed.");
  render();
}
function assignModal(id) {
  const r = rw(id);
  modal("Assign this rework", `<p class="muted">${esc(r.item)}</p><div class="qc-pick">${QC_CONFIG.crews.map((c, n) => `<button class="secondary" onclick="assign('${id}',${n})">${esc(c)}${r.assigned === c ? '<span class="pill good">Assigned</span>' : ""}</button>`).join("")}${r.assigned ? `<button class="link" onclick="assign('${id}',-1)">Remove assignment</button>` : ""}</div>`);
}
function assign(id, n) {
  const r = rw(id);
  r.assigned = n < 0 ? null : QC_CONFIG.crews[n];
  record(r.serial, QC, r.assigned ? `Rework assigned to ${r.assigned}: ${r.item}` : `Rework assignment removed: ${r.item}`);
  closeModal();
  render();
}

/* An inspection that has passed: go to sign-off, or reopen it (one of the two places that ask
   "are you sure"). */
function passedPanel(b) {
  const r = b.results[QC], co = openChanges(b);
  return `<section class="panel">
    <div class="panelhead"><h2>Inspection passed</h2><span class="pill good">${r.firstPass ? "Passed first time" : "Passed after rework"}</span></div>
    <p class="muted">Passed by ${esc(r.by)} on ${when(r.at)}.</p>
    ${co.length ? `<p class="notice">This building has a change order the plant has not acknowledged. It cannot be signed off until that is done.</p>` : ""}
    <div class="actions">${button(`Go to sign-off ${icon("arrow", 18)}`, `Q.signSerial='${b.serial}';go('qc-signoff')`, "primary big")}</div>
    <p><button class="link" onclick="reopenModal()">${icon("rotate", 16)} Reopen this inspection</button></p>
  </section>`;
}
function reopenModal() {
  const b = build(Q.serial);
  modal(`Reopen this inspection?`, `<p>${esc(b.serial)} goes back to Ready for QA and the whole checklist has to be answered again. The earlier pass stays in the history.</p><div class="actions">${button("Yes, reopen it", "reopen()", "primary")}${button("Keep it passed", "closeModal()", "secondary")}</div>`);
}
function reopen() {
  const b = build(Q.serial);
  b.superseded.push({ ...b.results[QC], supersededAt: Date.now(), supersededBy: me().name });
  delete b.results[QC];
  record(b.serial, QC, "Inspection reopened. The earlier pass is superseded");
  dealerNote(b, "inspection reopened");
  closeModal();
  toast("Inspection reopened.");
  render();
}

/* Hold */
function holdPanel(b) {
  return `<section class="panel">
    <div class="panelhead"><h2>On hold</h2><span class="pill red">${esc(b.hold.reason)}</span></div>
    <p class="muted">Put on hold by ${esc(b.hold.by)} on ${when(b.hold.at)}. Nothing can be inspected until the hold comes off.</p>
    <div class="actions">${button("Take off hold", "releaseHold()", "primary big")}</div>
  </section>`;
}
function holdModal() {
  modal("Put on hold", `<p class="muted">Pick the reason. The building keeps its answers and any open failures.</p><div class="qc-pick">${QC_CONFIG.holdReasons.map((h, n) => `<button class="secondary" onclick="setHold(${n})">${esc(h)}</button>`).join("")}</div>`);
}
function setHold(n) {
  const b = build(Q.serial);
  b.hold = { reason: QC_CONFIG.holdReasons[n], by: me().name, at: Date.now() };
  record(b.serial, QC, `Put on hold: ${b.hold.reason}`);
  closeModal();
  render();
}
function releaseHold() {
  const b = build(Q.serial);
  b.hold = null;
  record(b.serial, QC, "Taken off hold");
  toast(`${b.serial} is off hold.`);
  render();
}

/* Who is using the screen. Stands in for logins. */
function pickPerson() {
  modal("Who is inspecting?", `<p class="muted">Every pass, fail and fix is recorded under this name. A live version would use logins.</p><div class="qc-pick">${QC_CONFIG.people.map((p, n) => `<button class="secondary" onclick="Q.who=${n};closeModal();render()"><span>${esc(p.name)} <small>${esc(p.role)}</small></span>${n === Q.who ? '<span class="pill good">Current</span>' : ""}</button>`).join("")}</div>`);
}

function historyPanel(b) {
  const rows = Q.log.filter((l) => l.serial === b.serial).sort((a, c) => c.at - a.at);
  return `<h2 class="sectionhead">History</h2><section class="panel"><p class="muted">Who did what and when. Entries are never removed.</p><ul class="qc-log">${rows.length ? rows.map((l) => `<li><strong>${esc(l.text)}</strong><small>${esc(l.who)} · ${when(l.at)}</small></li>`).join("") : `<li><small>Nothing recorded yet.</small></li>`}</ul></section>`;
}

/* ---------- The plain-speaking notes page for the QC side ---------- */
function qcNotes() {
  return `<button class="link backlink" onclick="go('qc')">${icon("back", 18)} Buildings</button>
  ${head("Preview", "What is real and what is not", "This is a working preview of the plant QC side. It runs in this browser tab only.")}
  <div class="grid2 qc-notes">
    <section class="panel"><h2>Real</h2><ul>
      <li>The checklist questions. They are the ${Object.keys(ITEM).length} active items from the plant's current QC checklist, each reworded as a Yes / No question.</li>
      <li>The rules: every question answered before an inspection can pass; a failure needs a defect type, a note and (for most questions) a photo; a building with an open failure or an unacknowledged change order cannot be signed off; every action records who and when.</li>
      <li>The link to the Sales desk: change orders are one shared list, a sold custom order arrives here with its own build sheet and 3D model, and its QC status shows on the dealer's order.</li>
    </ul></section>
    <section class="panel"><h2>First draft to correct</h2><ul>
      <li>The wording of each question, and which QC tile (Flooring, Walls, Paint, Roofing, Final QA) each group of questions sits under.</li>
      <li>Which questions are left out for which orders, and which questions do not need a photo.</li>
      <li>The defect types, hold reasons and crew names.</li>
      <li>All of these are in one file, <strong>qc-config.js</strong>.</li>
    </ul></section>
    <section class="panel"><h2>Sample data</h2><ul>
      <li>The twelve sample buildings, their dealers, options and open rework are made up. One of them is the Sales desk's sample order for Taylor Reed.</li>
      <li>A sold order shows up here the moment it is approved on the Sales desk. Live, it would arrive when the plant marks the build complete, with its real serial.</li>
      <li>The four people are made up. Picking a name stands in for logging in, and the Sales desk / Plant QC switch stands in for who is logged in.</li>
      <li>The quality report and the first-pass rate start from about 90 days of made-up inspection history, then add what is done in this tab.</li>
      <li>Nothing is saved. Reloading the page puts everything back.</li>
    </ul></section>
    <section class="panel"><h2>Not built</h2><ul>
      <li>Logins for dealer, admin, inspector, QC lead and plant manager.</li>
      <li>A connection to the plant's production system, so buildings, serials and results are real and stored.</li>
      <li>Photo storage. Photos are kept in this tab's memory only.</li>
      <li>The 3D model shows the style, package and colors. It does not place each door and window; those are on the build sheet.</li>
    </ul></section>
  </div>`;
}

const QC_SCREENS = {
  "qc": floor,
  "qc-inspect": inspect,
  "qc-notes": qcNotes,
  "qc-rework": () => reworkQueue(),
  "qc-signoff": () => signoff(),
  "qc-report": () => report(),
  "qc-changes": () => changeOrders(),
};

/* The other QC screens are in qc-screens.js, which also draws the first screen again. */
