/* qc-screens.js: the rest of the Plant QC side: Rework queue, Sign-off, Quality report and
   Change orders. Loaded after qc-app.js. Same approach: each screen returns an HTML string. */

/* ---------- Made-up history so the report has something to show ----------
   About 90 days of pretend inspections and failures, generated the same way every time.
   The mix leans toward what inspectors wrote up most in the current system (silicone,
   shiners, paint touch-up). A live version would read real results instead. */
(function sampleHistory() {
  let seed = 20261111;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const styles = ["Classic Utility", "Classic Utility", "Classic Utility", "Classic Lofted Barn", "Classic Lofted Barn", "Basic Utility", "Elite Utility", "Basic Lofted Barn", "Basic Studio", "Silver Bullet"];
  const weighted = [
    ["Is there silicone on the windows?", "Silicone missing", 4],
    ["Is there silicone on the trim above the door?", "Silicone missing", 3],
    ["Is there silicone on the doors?", "Silicone missing", 2],
    ["Are the walls free of visible shiners?", "Shiners or nails", 4],
    ["Is the paint touched up?", "Paint or finish flaw", 4],
    ["Is the paint coverage complete?", "Paint or finish flaw", 2],
    ["Is the building free of paint overspray?", "Paint or finish flaw", 1],
    ["Are the top-plate corners and joints free of gaps?", "Gap or poor fit", 2],
    ["Is the floor sheeting free of unacceptable gaps?", "Gap or poor fit", 1],
    ["Is the roofing clean and uniform, with correct screw spacing?", "Roof screws or metal", 2],
    ["Is the visible wood of high quality?", "Wood quality", 2],
    ["Are all receptacles, lights, switches and breaker boxes (if required) installed in the correct location?", "Electrical", 1],
    ["Do the doors and windows work properly with no gaps?", "Gap or poor fit", 1],
    ["Are the keys in the building?", "Missing item or option", 1],
  ];
  const all = Object.values(ITEM);
  const pool = weighted.flatMap(([text, defect, w]) => {
    const item = all.find((i) => i.text === text); /* skipped if the question was reworded in qc-config.js */
    return item ? Array(w).fill({ item, defect }) : [];
  });
  let n = 0;
  for (let d = 90; d >= 1; d--) {
    const day = DAY_START - d * 24 * HOUR;
    if ([0, 6].includes(new Date(day).getDay())) continue;
    const count = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < count; k++) {
      const at = day + (8 + rnd() * 8) * HOUR, style = pick(styles), serial = "SAMPLE-H" + (2000 + ++n);
      const fails = pool.length && rnd() < 0.27 ? 1 + (rnd() < 0.35) + (rnd() < 0.12) : 0;
      Q.inspections.push({ at, serial, style, pass: !fails });
      for (let f = 0; f < fails; f++) {
        const p = pick(pool);
        Q.defects.push({ serial, style, section: p.item.area, item: p.item.text, defect: p.defect, openedAt: at, closedAt: at + (3 + rnd() * rnd() * 70) * HOUR });
      }
    }
  }
  /* the sample buildings that already have an inspection result */
  Q.builds.forEach((b) => { const r = b.results[QC]; if (r) Q.inspections.push({ at: r.at, serial: b.serial, style: b.style, pass: r.firstPass }); });
})();

function firstPassStats(days) {
  const cut = Date.now() - days * 24 * HOUR, ins = Q.inspections.filter((i) => i.at >= cut);
  const pass = ins.filter((i) => i.pass).length;
  return { n: ins.length, pass, rate: ins.length ? Math.round((pass / ins.length) * 100) : 0 };
}
/* Every failure, old and new, in one shape for the report. */
function allDefects() {
  return Q.defects.concat(Q.rework.map((r) => ({ serial: r.serial, style: build(r.serial).style, section: ITEM[r.itemId]?.area || "Other", item: r.item, defect: r.defect, openedAt: r.openedAt, closedAt: r.closedAt })));
}
const hours = (ms) => { const h = ms / HOUR; return h < 48 ? plural(Math.round(h), "hour") : `${(h / 24).toFixed(1)} days`; };

/* ---------- Screen 3: Rework queue ---------- */
function reworkQueue() {
  const open = Q.rework.filter((r) => r.step < 2).sort((a, b) => a.openedAt - b.openedAt);
  const closed = Q.rework.filter((r) => r.step === 2).sort((a, b) => b.closedAt - a.closedAt);
  const filters = { "All": () => true, "To fix": (r) => r.step === 0, "Ready to re-inspect": (r) => r.step === 1, "Not assigned": (r) => !r.assigned };
  const shown = open.filter(filters[Q.rwFilter]);
  const kpi = (n, label) => `<div class="kpi"><strong>${n}</strong><span>${label}</span></div>`;
  return `${head("ShedCor Plant · Quality control", "Rework queue", "Open failures, oldest first. A failure closes only when it passes re-inspection.")}
  <div class="today">
    ${kpi(open.length, "Open failures")}
    ${kpi(open.filter(filters["Ready to re-inspect"]).length, "Ready to re-inspect")}
    ${kpi(open.filter(filters["Not assigned"]).length, "Not assigned")}
    <div class="kpi qc-kpitext"><strong>${open.length ? age(open[0].openedAt) : "None"}</strong><span>Oldest open failure</span></div>
  </div>
  <div class="qc-filter"><div class="chiprow">${Object.keys(filters).map((f) => `<button class="chipbtn${Q.rwFilter === f ? " on" : ""}" onclick="Q.rwFilter='${f}';render()">${f}</button>`).join("")}</div></div>
  ${shown.length ? `<div class="stack">${shown.map((r) => reworkCard(r, true)).join("")}</div>`
    : `<div class="panel emptystate"><strong>${open.length ? "Nothing matches that filter" : "No open failures"}</strong><p>${open.length ? "Pick another filter to see the rest of the queue." : "Every failure has been fixed and has passed re-inspection."}</p></div>`}
  ${closed.length ? `<h2 class="sectionhead">Closed</h2><section class="panel"><ul class="qc-log">${closed.map((r) => `<li><strong>${esc(r.item)}</strong><small>${esc(r.serial)} · ${esc(r.defect)} · closed by ${esc(r.closedBy)} on ${when(r.closedAt)}, ${hours(r.closedAt - r.openedAt)} after it failed</small></li>`).join("")}</ul></section>` : ""}`;
}

/* ---------- Screen 4: Final QA sign-off ---------- */
function blockers(b) {
  const out = [], open = openRework(b), r = b.results[QC];
  if (b.hold) out.push(`On hold: ${b.hold.reason}`);
  if (open.length) out.push(`${plural(open.length, "open failure")} in rework`);
  else if (r?.result !== "pass") out.push("The inspection is not finished");
  openChanges(b).forEach((c) => out.push(c.done < 2 ? `Change order ${c.id} is waiting on admin approval, then the plant` : `Change order ${c.id} is not acknowledged by the plant`));
  return out;
}
function signoff() {
  const b = Q.signSerial && build(Q.signSerial);
  if (b && b.stage >= LAST - 1) return signDetail(b);
  const inQA = Q.builds.filter((x) => x.stage === LAST - 1);
  const ready = inQA.filter((x) => !blockers(x).length), notReady = inQA.filter((x) => blockers(x).length);
  const done = Q.builds.filter((x) => x.stage === LAST).sort((a, c) => c.signoff.at - a.signoff.at);
  const row = (x, label, cls) => `<div class="qc-signrow">${thumb(x)}<div class="grow"><strong>${esc(x.serial)}</strong><small>${esc(x.size)} ${esc(x.style)} · ${esc(x.dealer)}${x.customer ? ` · for ${esc(x.customer)}` : ""}</small><div class="pillrow">${
    x.stage === LAST ? `<span class="pill ghost">Signed off by ${esc(x.signoff.by)} on ${when(x.signoff.at)}</span>`
    : blockers(x).length ? blockers(x).map((t) => `<span class="pill red">${esc(t)}</span>`).join(" ") : `<span class="pill good">Ready to sign off</span>`}</div></div><button class="${cls}" onclick="Q.signSerial='${x.serial}';go('qc-signoff')">${label}</button></div>`;
  const group = (title, list, label, cls) => list.length ? `<h2 class="sectionhead qc-group">${title} <small>${list.length}</small></h2><section class="panel qc-signlist">${list.map((x) => row(x, label, cls)).join("")}</section>` : "";
  return `${head("ShedCor Plant · Quality control", "Sign-off", "A building ships only after its inspection has passed, every failure is closed and every change order is acknowledged.")}
  ${inQA.length || done.length ? "" : `<div class="panel emptystate"><strong>Nothing to sign off</strong><p>No building is in QC.</p></div>`}
  ${group("Ready to sign off", ready, "Review and sign off", "primary")}
  ${group("Not ready yet", notReady, "See why", "secondary")}
  ${group("Signed off, ready to ship", done, "View", "secondary")}`;
}
function signDetail(b) {
  const r = b.results[QC], block = blockers(b), signed = b.stage === LAST;
  const rw = Q.rework.filter((x) => x.serial === b.serial), cos = changesOf(b).filter((c) => !c.declined);
  const sections = CHECK[QC].map((s) => {
    const items = s.items.filter((i) => !skipReason(b, i));
    if (!items.length) return `<div class="qc-secrow"><strong>${esc(s.section)}</strong><div class="pillrow"><span class="pill ghost">Does not apply to this order</span></div></div>`;
    const a = items.map((i) => r?.answers?.[i.id]);
    const yes = a.filter((x) => x === "pass").length, na = a.filter((x) => x === "na").length, no = a.filter((x) => x === "fail").length;
    const openHere = openRework(b).filter((x) => ITEM[x.itemId]?.section === s.section).length;
    const pills = !r ? `<span class="pill ghost">Not inspected</span>`
      : !r.answers ? (openHere ? `<span class="pill red">${plural(openHere, "open failure")}</span>` : `<span class="pill ghost">No item detail on this sample record</span>`)
      : [yes && `<span class="pill good">${yes} yes</span>`, na && `<span class="pill ghost">${na} N/A</span>`, no && `<span class="pill ${openHere ? "red" : "amber"}">${no} no, ${openHere ? `${openHere} still open` : "fixed"}</span>`].filter(Boolean).join(" ");
    return `<div class="qc-secrow"><strong>${esc(s.section)}</strong><div class="pillrow">${pills}</div></div>`;
  }).join("");
  const result = !r ? "Not inspected yet" : r.result !== "pass" ? "Failed, in rework" : r.firstPass ? "Passed first time" : "Passed after rework";
  return `<button class="link backlink" onclick="Q.signSerial=null;render();scrollTo(0,0)">${icon("back", 18)} All sign-offs</button>
  ${head("Sign-off", `${esc(b.size)} ${esc(b.style)}`, `${esc(b.serial)} · ${esc(b.dealer)}${b.customer ? ` · for ${esc(b.customer)}` : ""}`)}
  <section class="panel">
    <div class="panelhead"><div class="pillrow">${statusPill(b)}</div><button class="secondary small" onclick="openBuild('${b.serial}')">Open building</button></div>
    <div class="qc-ref">${thumb(b, true)}<div class="qc-facts"><span>Siding <strong>${esc(b.siding_color)}</strong></span><span>Trim <strong>${esc(b.trim_color)}</strong></span><span>Roof <strong>${esc(b.roof)}</strong></span><span>Size <strong>${esc(b.size)}</strong></span></div></div>
  </section>
  <div class="grid2" style="margin-top:20px">
    <section class="panel">
      <div class="panelhead"><h2>Inspection</h2><span class="pill ${r?.result === "pass" ? "good" : "red"}">${result}</span></div>
      ${r ? `<p class="muted">${r.result === "pass" ? "Passed" : "Inspected"} by ${esc(r.by)} on ${when(r.at)}.</p>` : ""}
      ${r?.bulk?.length ? `<p class="muted">"Yes to the rest" was used on: ${r.bulk.map(esc).join(", ")}.</p>` : ""}
      <div class="qc-seclist">${sections}</div>
    </section>
    <div class="stack">
      <section class="panel">
        <div class="panelhead"><h2>Rework</h2><span class="pill ${openRework(b).length ? "red" : "ghost"}">${openRework(b).length ? plural(openRework(b).length, "open failure") : rw.length ? "All closed" : "None"}</span></div>
        ${rw.length ? `<ul class="qc-log">${rw.map((x) => `<li><strong>${esc(x.item)}</strong><small>${esc(x.defect)} · ${x.step === 2 ? `closed by ${esc(x.closedBy)} on ${when(x.closedAt)}` : x.step === 1 ? "fixed, waiting on re-inspection" : "not fixed yet"}</small></li>`).join("")}</ul>` : `<p class="muted">Nothing failed on this building.</p>`}
      </section>
      <section class="panel">
        <div class="panelhead"><h2>Change orders</h2><span class="pill ${openChanges(b).length ? "amber" : "ghost"}">${openChanges(b).length ? `${openChanges(b).length} open` : cos.length ? "All acknowledged" : "None"}</span></div>
        ${cos.length ? `<div class="changes">${cos.map((c) => qcChangeCard(c)).join("")}</div>` : `<p class="muted">No change orders on this building.</p>`}
      </section>
    </div>
  </div>
  <section class="panel" style="margin-top:20px">
    ${signed
      ? `<div class="panelhead"><h2>Signed off</h2><span class="pill good">Ready to ship</span></div><p class="muted">Signed off by ${esc(b.signoff.by)} on ${when(b.signoff.at)}.</p>`
      : block.length
      ? `<div class="panelhead"><h2>Cannot be signed off yet</h2><span class="pill red">${plural(block.length, "thing")} to clear</span></div><ul class="qc-blockers">${block.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><div class="actions">${button("Open building", `openBuild('${b.serial}')`, "secondary")}</div>`
      : `<div class="panelhead"><h2>Sign off</h2><button class="chipbtn" onclick="pickPerson()">${icon("user", 16)} ${esc(me().name)}, ${esc(me().role)} · change</button></div>
         <p class="muted">Signing off records ${esc(me().name)} as the inspector and moves ${esc(b.serial)} to Ready to ship.</p>
         <div class="actions">${button(`Sign off as ${esc(me().name)}`, "signModal()", "primary big")}</div>`}
  </section>`;
}
/* Sign-off is one of the two places that ask "are you sure". */
function signModal() {
  const b = build(Q.signSerial);
  modal("Sign off this building?", `<p><strong>${esc(b.serial)}</strong>, ${esc(b.size)} ${esc(b.style)}, moves to Ready to ship, signed by ${esc(me().name)}.</p><div class="actions">${button("Yes, sign it off", "doSignoff()", "primary")}${button("Not yet", "closeModal()", "secondary")}</div>`);
}
function doSignoff() {
  const b = build(Q.signSerial);
  closeModal();
  if (blockers(b).length) return toast("This building cannot be signed off yet.");
  b.stage = LAST; b.days_in_stage = 0;
  b.signoff = { by: me().name, at: Date.now() };
  record(b.serial, QC, `Signed off by ${me().name}. Ready to ship`);
  dealerNote(b, `signed off by ${me().name} · ready to ship`);
  toast(`${b.serial} signed off. Ready to ship.`);
  render();
  scrollTo(0, 0);
}

/* ---------- Screen 5: Quality report ---------- */
function barList(rows, unit) {
  if (!rows.length) return `<p class="muted">No failures in this period.</p>`;
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="qc-bars">${rows.map(([label, n, note]) => `<div class="qc-barrow"><span>${esc(label)}</span><div class="qc-track"><i style="width:${Math.max(2, (n / max) * 100)}%"></i></div><strong>${n}${note ? ` <small>${note}</small>` : ""}</strong></div>`).join("")}</div>`;
}
function countBy(list, key) {
  const m = new Map();
  list.forEach((x) => m.set(x[key], (m.get(x[key]) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function report() {
  const days = Q.reportDays, cut = Date.now() - days * 24 * HOUR;
  const fp = firstPassStats(days), defs = allDefects().filter((d) => d.openedAt >= cut), closed = defs.filter((d) => d.closedAt);
  const avg = closed.length ? hours(closed.reduce((t, d) => t + d.closedAt - d.openedAt, 0) / closed.length) : "None closed";
  const inspectedByStyle = new Map(countBy(Q.inspections.filter((i) => i.at >= cut), "style"));
  const byStyle = countBy(defs, "style").map(([style, n]) => [style, n, inspectedByStyle.get(style) ? `on ${plural(inspectedByStyle.get(style), "building")}` : ""]);
  const perBuild = new Map();
  defs.forEach((d) => { const e = perBuild.get(d.serial) || { serial: d.serial, style: d.style, n: 0, time: 0, open: 0 }; e.n++; d.closedAt ? (e.time += d.closedAt - d.openedAt) : e.open++; perBuild.set(d.serial, e); });
  const worst = [...perBuild.values()].sort((a, b) => b.n - a.n || b.time - a.time).slice(0, 5);
  const kpi = (n, label) => `<div class="kpi"><strong>${n}</strong><span>${label}</span></div>`;
  return `${head("ShedCor Plant · Quality control", "Quality report", "Where failures are coming from, how often buildings pass first time and how long rework takes.")}
  <div class="qc-filter"><div class="chiprow">${[7, 30, 90].map((d) => `<button class="chipbtn${days === d ? " on" : ""}" onclick="Q.reportDays=${d};render()">Last ${d} days</button>`).join("")}</div></div>
  <div class="today">
    ${kpi(fp.n, "Buildings inspected")}
    ${kpi(fp.rate + "%", "Passed first time")}
    ${kpi(defs.length, "Failures found")}
    <div class="kpi qc-kpitext"><strong>${avg}</strong><span>Average time in rework</span></div>
  </div>
  <div class="grid2">
    <section class="panel"><h2>Failures by part of the building</h2><p class="muted">The QC tile the failed question sits under.</p>${barList(countBy(defs, "section"))}</section>
    <section class="panel"><h2>Failures by defect type</h2><p class="muted">What the inspector picked when answering No.</p>${barList(countBy(defs, "defect"))}</section>
    <section class="panel"><h2>Failures by building style</h2><p class="muted">Count of failures, with how many of that style were inspected.</p>${barList(byStyle)}</section>
    <section class="panel"><h2>Buildings with the most rework</h2>${worst.length ? `<ul class="qc-log">${worst.map((w) => `<li><strong>${esc(w.serial)} <small>${esc(w.style)}</small></strong><small>${plural(w.n, "failure")}${w.time ? ` · ${hours(w.time)} in rework` : ""}${w.open ? ` · ${w.open} still open` : ""}</small></li>`).join("")}</ul>` : `<p class="muted">No failures in this period.</p>`}</section>
  </div>
  <p class="lede-small" style="margin-top:20px">Sample numbers. The history before today is made up; inspections done in this tab are added to it.</p>`;
}

/* ---------- Screen 6: Change orders ----------
   Every change order from the Sales desk, including ones on buildings still being built,
   because the plant has to acknowledge those too. */
function changeOrders() {
  const live = S.changes.filter((c) => !c.declined);
  const open = live.filter(changeOpen).sort((a, b) => b.done - a.done);
  const done = live.filter((c) => c.done >= 3);
  const mine = open.filter((c) => c.done === 2).length;
  return `${head("ShedCor Plant · Quality control", "Change orders", "A dealer's change is requested by their manager, approved by an admin, then acknowledged here by the plant.")}
  ${open.length ? `<h2 class="sectionhead qc-group">Open <small>${open.length}${mine ? `, ${mine} waiting on the plant` : ""}</small></h2><div class="changes">${open.map((c) => qcChangeCard(c, true)).join("")}</div>`
    : `<div class="panel emptystate"><strong>No open change orders</strong><p>Every change order has been acknowledged by the plant.</p></div>`}
  ${done.length ? `<h2 class="sectionhead qc-group">Acknowledged <small>${done.length}</small></h2><div class="changes">${done.map((c) => qcChangeCard(c, true)).join("")}</div>` : ""}
  <p class="lede-small" style="margin-top:20px">This is the same list the dealer sees on the Sales desk side. A building with a change order the plant has not acknowledged cannot be signed off.</p>`;
}

/* ---------- Start ---------- */
document.querySelectorAll("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon, el.classList.contains("tab-sale") ? 24 : 22)));
syncDealer();
render();
