/* turbo.js: the shared pieces for everything this preview takes from Turbo Assist.

   Turbo Assist (bennett-buddy, read at commit b42d324) is the functionality authority. This file
   holds what all five sides use from it:
   - Answers: the knowledge base Turbo Assist answers from (Training, Ask & policies), as a panel
     that opens over any screen. The articles are in turbo-data.js.
   - Notifications: the in-app notices Turbo Assist sends (order placed on hold, delivery scheduled,
     final QC passed), one bell for whichever side is showing.
   - Rent-to-own terms: the org's term table (Ops, RTO Terms) the desk's monthly math reads.
   - Product notes: extra lines for the "Product notes for this screen" block.
   Loaded after ops-shell.js and turbo-data.js; the side files (turbo-sales.js, turbo-office.js,
   turbo-plant.js, turbo-logi.js) load after this one. */

Object.assign(ICONS, {
  help: '<circle cx="12" cy="12" r="8.500"/><path d="M9.600 9.600a2.500 2.500 0 1 1 3.600 2.200c-.800.500-1.200 1-1.200 1.900"/><path d="M12 16.900v.200"/>',
  bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z"/><path d="M10 20.500a2 2 0 0 0 4 0"/>',
  book: '<path d="M4.500 5.500a2 2 0 0 1 2-2H19v14H6.500a2 2 0 0 0-2 2z"/><path d="M4.500 19.500a2 2 0 0 0 2 2H19"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
});

const TA = {
  commit: TA_COMMIT,
  seq: 0,
  notices: [], /* { id, to, title, body, at, read, saleId, go } */
  notes: {}, /* page -> { hooks: [], only: [] } */
  ans: { q: '', topic: 'All', id: null, tab: 'answers' },
  /* Rent-to-own terms. Turbo Assist keeps one table per org (Ops, RTO Terms: Months, Divisor,
     Down Type, Down Value, Balloon, payoff percent) and the calculator reads it. The four terms
     and divisors below are the ones this preview has used from the start: a public lot listing's
     monthly payments divided into its price. `turbo` is DEFAULT_RTO_TERMS in
     src/lib/rto/rtoTermSettings.ts, shown beside them in Office, Settings so the office can pick. */
  rto: {
    provider: 'JMAG',
    taxPct: 0,
    terms: [
      { months: 24, divisor: 16.8, downType: 'payments', down: 1, balloon: false, balloonPayments: 0, epo: 0.62 },
      { months: 36, divisor: 21.6, downType: 'payments', down: 1, balloon: false, balloonPayments: 0, epo: 0.58 },
      { months: 48, divisor: 24.6, downType: 'payments', down: 1, balloon: false, balloonPayments: 0, epo: 0.55 },
      { months: 60, divisor: 27.2, downType: 'payments', down: 1, balloon: false, balloonPayments: 0, epo: null }, /* Turbo Assist's defaults have no 60-month term */
    ],
    turbo: [
      { months: 24, divisor: 16.8, down: 2, epo: 0.62 },
      { months: 36, divisor: 25.2, down: 3, epo: 0.58 },
      { months: 48, divisor: 33.6, down: 4, epo: 0.55 },
    ],
  },
};
const taSide = () => document.body.dataset.side || 'sales';
const TA_SIDE_NAME = { sales: 'Sales desk', office: 'Office', prod: 'Production', qc: 'Plant QC', logi: 'Logistics' };

/* ---------- Rent-to-own terms ---------- */
const taRtoTerm = (months) => TA.rto.terms.find((t) => t.months === Number(months));
/* The desk's payment() divides by `divisors`; keep it in step with the office's table. */
function taRtoSync() {
  TA.rto.terms.forEach((t) => (divisors[t.months] = t.divisor));
}
/* Same arithmetic as Turbo Assist's RTO term calculator (SalesConsoleRtoCalculatorSection.tsx):
   payment = price × (1 + tax) ÷ divisor; money paid today above the required down payments goes
   to the customer's reserve (CSRA) and lowers the price the payment is figured on. */
function taRtoCalc(months, cashPrice, paidToday = 0, taxPct = TA.rto.taxPct) {
  const r = taRtoTerm(months);
  if (!r) return null;
  const tax = (Number(taxPct) || 0) / 100, divisor = Math.max(r.divisor, 0.01);
  const baseline = (cashPrice * (1 + tax)) / divisor;
  const downPayments = r.downType === 'payments' ? Math.max(1, r.down) : Math.max(1, (Math.max(0, r.down) * cashPrice) / Math.max(baseline, 0.01));
  const k = (downPayments * (1 + tax)) / divisor, denominator = 1 - k;
  const csra = denominator <= 0 ? 0 : Math.max(0, (paidToday - k * cashPrice) / denominator);
  const payment = (Math.max(0, cashPrice - csra) * (1 + tax)) / divisor;
  const round = (n) => Math.round(n * 100) / 100;
  return { term: r, downPayments, minToday: round(k * cashPrice), csra: round(csra), payment: round(payment), baseline: round(baseline), contractTotal: round(payment * Math.max(1, r.months)) };
}
/* The early-purchase chart for one term: what it costs to pay the contract off after each payment. */
function taRtoChart(months, cashPrice, paidToday = 0, taxPct = TA.rto.taxPct) {
  const c = taRtoCalc(months, cashPrice, paidToday, taxPct);
  if (!c) return [];
  const pct = c.term.epo;
  return Array.from({ length: Math.max(1, c.term.months) }, (_, i) => {
    const paidOnContract = Math.max(0, paidToday - c.csra) + i * c.payment, totalPaid = paidToday + i * c.payment;
    const remaining = Math.max(0, c.contractTotal - paidOnContract), payoff = pct == null ? null : remaining * pct;
    return { made: i, totalPaid, remaining, payoff, totalIfPaidOut: payoff == null ? null : totalPaid + payoff };
  });
}

/* ---------- Product notes ---------- */
/* Extra "Turbo Assist already does this" and "Only in this preview" lines for one screen. */
function taNotesFor(page, hooks = [], only = []) {
  const x = (TA.notes[page] ||= { hooks: [], only: [] });
  x.hooks.push(...hooks);
  x.only.push(...only);
}
{
  const baseNotes = opsNotes;
  opsNotes = function (hooks = [], only = []) {
    const x = TA.notes[S.page] || {};
    return baseNotes(hooks.concat(x.hooks || []), only.concat(x.only || []));
  };
}

/* ---------- Notifications ---------- */
/* One notice for one side. `go` is the code that opens what the notice is about. A notice for the
   Sales desk about another lot's order is dropped: this desk is one lot. */
function taNotify(n) {
  if (n.to === 'sales' && n.saleId && typeof deskSale === 'function') {
    const s = S.sales.find((x) => x.id === n.saleId);
    if (s && !deskSale(s)) return null;
  }
  const item = { id: 'N' + ++TA.seq, at: Date.now(), read: false, ...n };
  TA.notices.push(item);
  taChrome();
  return item;
}
const taNoticesFor = (side = taSide()) => TA.notices.filter((n) => n.to === side).sort((a, b) => b.at - a.at);
function taAgo(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}
function taOpenNotices() {
  const side = taSide(), list = taNoticesFor(side);
  modal(
    'Notifications',
    `<p class="source">${esc(TA_SIDE_NAME[side])} · in-app notices, the way Turbo Assist sends them. Nothing is texted or emailed from this preview.</p>
    <div class="ta-notices">${
      list.length
        ? list
            .map(
              (n) =>
                `<div class="ta-notice${n.read ? '' : ' new'}"><div class="grow"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${taAgo(n.at)}</small></div>${n.go ? `<button type="button" class="secondary small" onclick="closeModal();${esc(n.go)}">Open</button>` : ''}</div>`
            )
            .join('')
        : '<p class="muted">Nothing new for this side.</p>'
    }</div>`
  );
  list.forEach((n) => (n.read = true));
  taChrome();
}

/* ---------- Answers ---------- */
const TA_TOPICS = ['All', 'Delivery and site', 'Sizes and styles', 'Materials and warranty', 'Payment and rent-to-own', 'Steel structures', 'Company and CRM', 'Using Turbo Assist', 'Advertising and routing'];
/* What each side looks up most, shown before anyone types. */
const TA_SUGGEST = {
  sales: ['lead-times', 'size-limits', 'rto-overview', 'down-payment', 'warranty', 'roof-rules'],
  office: ['down-payment', 'rto-rules', 'rto-timing', 'lead-times', 'rto-overview', 'delivery-distance'],
  prod: ['roof-rules', 'materials', 'siding-tiers', 'size-limits', 'electrical', 'roof-styles'],
  qc: ['materials', 'lp-smartside', 'roof-rules', 'warranty', 'lost-keys', 'electrical'],
  logi: ['size-limits', 'set-height', 'lead-times', 'wind-anchors', 'build-on-site', 'inventory-lead-times'],
};
const TA_ASK = {
  sales: ['How far is delivery free?', 'Biggest building we deliver?', 'Is there interest on rent-to-own?', 'What does the warranty cover?'],
  office: ['When is the first RTO payment due?', 'How much deposit on a cash sale?', 'Which payment types can a deposit use?'],
  prod: ['Can a barn have a roll-up door?', 'Which series get TechShield?', 'How tall is a lofted barn?'],
  qc: ['Which series get TechShield?', 'What voids the warranty?', 'Lost keys'],
  logi: ['How high can blocking go?', 'Biggest building we deliver?', 'Who pays if the truck gets stuck?', 'Are anchors included?'],
};
/* The four customers Turbo Assist plays in Training, Roleplay
   (docs/sql/seed_shedcor_training_roleplay_scenarios.sql). */
const TA_ROLEPLAY = [
  ['Price-sensitive buyer', 'You are price-sensitive and ask about total cost, financing, and what is included. Push politely on discounts. You are interested but cautious about budget.'],
  ['Curious first-time buyer', 'You are new to buying a portable building or shed. Ask basic questions about sizes, delivery, and what happens after you order. You are friendly but not ready to commit.'],
  ['Timing and warranty concerns', 'You like the product but worry about delivery timing, site prep, and warranty/support if something goes wrong. Ask follow-up questions until reassured.'],
  ['Experienced shopper', 'You have shopped before and compare options. Ask specific questions about materials, build quality, and how this dealer differs from competitors.'],
];
const taArticle = (id) => TA_KB.find((a) => a.id === id) || TA_KB_STAFF_ONLY.find((a) => a.id === id) || null;
const TA_AUD = { both: 'For customers and staff', customer: 'Safe to tell a customer', staff: 'For staff' };

/* Article text is markdown-light: ## headings, **bold**, lists. */
function taMd(md) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of String(md).split('\n')) {
    const line = raw.trim();
    let m;
    if (!line) close();
    else if ((m = /^#{1,3}\s+(.*)$/.exec(line))) {
      close();
      out.push(`<h3>${inline(m[1])}</h3>`);
    } else if ((m = /^[-*]\s+(.*)$/.exec(line)) || (m = /^\d+\.\s+(.*)$/.exec(line))) {
      const kind = /^\d/.test(line) ? 'ol' : 'ul';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join('');
}

const TA_STOP = new Set('a an and are as at be by can do does for from get how i if in is it my of on or our that the their them there they this to was we what when where which who why will with you your about'.split(' '));
const taWords = (q) =>
  String(q)
    .toLowerCase()
    .replace(/[^a-z0-9$%-]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !TA_STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w));
/* Everyday words for the words the articles use. */
const TA_ALSO = { biggest: ['largest', 'maximum'], bigger: ['largest', 'maximum'], max: ['maximum'], far: ['mile', 'distance'], cost: ['price', 'fee'], charge: ['fee'], stuck: ['recovery'], tall: ['height'], high: ['height'], key: ['lockset'], hurricane: ['wind'], tie: ['anchor'], interest: ['interest', 'apr'], wait: ['lead time'], long: ['lead time', 'week'], level: ['blocking'], block: ['blocking'], credit: ['credit'], cancel: ['refund'], deposit: ['deposit', 'down payment'], down: ['deposit'] };
let taIndex = null;
/* Plain keyword search, best match first. Turbo Assist answers with retrieval over the same
   articles; this is enough to find the right one in a preview. */
function taSearch(q) {
  const words = taWords(q);
  if (!words.length) return [];
  taIndex ||= TA_KB.map((a) => ({ a, title: a.title.toLowerCase(), hint: (a.hint || '').toLowerCase(), tags: a.tags.join(' ').toLowerCase(), body: a.body.toLowerCase() }));
  return taIndex
    .map((x) => {
      let score = 0, hits = 0;
      for (const word of words) {
        let best = 0;
        for (const w of [word, ...(TA_ALSO[word] || [])]) {
          const inTitle = x.title.includes(w), inHint = x.hint.includes(w), inTags = x.tags.includes(w), n = x.body.split(w).length - 1;
          best = Math.max(best, (inTitle ? 6 : 0) + (inTags ? 4 : 0) + (inHint ? 5 : 0) + Math.min(n, 5));
        }
        if (best) hits++;
        score += best;
      }
      /* A steel or how-to-use-the-app article only leads when the question is about that. */
      const off = (x.a.topic === 'Steel structures' && !/steel|carport|garage|longhorn|steelcraft/.test(q.toLowerCase())) || (x.a.topic === 'Using Turbo Assist' && !/turbo|app|browser|voice|roleplay|bug/.test(q.toLowerCase()));
      return { a: x.a, hits, score: score * (hits / words.length) ** 2 * (off ? 0.6 : 1) };
    })
    .filter((r) => r.hits && r.score >= 2)
    .sort((x, y) => y.score - x.score)
    .slice(0, 8)
    .map((r) => r.a);
}

function taAnsRow(a) {
  const locked = !a.body;
  return `<button type="button" class="ta-row" onclick="taOpenAnswers('${a.id}')"><span class="grow"><strong>${esc(a.title)}</strong><small>${esc(locked ? a.about : a.hint || a.body.replace(/[#*]/g, '').slice(0, 150))}</small></span>${locked ? icon('lock', 16) : icon('arrow', 16)}</button>`;
}
function taAnsArticle(a) {
  const back = `<button type="button" class="link" onclick="TA.ans.id=null;taAnsBody()">${icon('back', 16)} All answers</button>`;
  if (!a.body)
    return `${back}<article class="ta-article"><h2>${esc(a.title)}</h2><div class="pillrow"><span class="pill amber">${icon('lock', 13)} Staff only</span><span class="pill ghost">${esc(a.topic)}</span></div>
      <p>${esc(a.about)}</p><p class="notice">This article stays in Turbo Assist. Turbo Assist marks it for inside the company, so its text is not on this public preview. Open it in Turbo Assist under Training, Ask &amp; policies.</p></article>`;
  const related = TA_KB.filter((x) => x.topic === a.topic && x.id !== a.id).slice(0, 4);
  return `${back}<article class="ta-article"><h2>${esc(a.title)}</h2>
    <div class="pillrow"><span class="pill ${a.aud === 'staff' ? 'amber' : 'good'}">${TA_AUD[a.aud]}</span><span class="pill ghost">${esc(a.topic)}</span></div>
    ${a.hint ? `<p class="ta-hint"><strong>Short answer.</strong> ${esc(a.hint)}</p>` : ''}
    ${a.flag ? `<p class="notice">${icon('alert', 16)} ${esc(a.flag)}</p>` : ''}
    <div class="ta-text">${taMd(a.body)}</div>
    <p class="source">From Turbo Assist’s knowledge base (bennett-buddy ${TA.commit}), article <code>${esc(a.slug)}</code>. In the shipped app this is Training, Ask &amp; policies.</p>
    ${related.length ? `<h3>Related</h3>${related.map(taAnsRow).join('')}` : ''}</article>`;
}
function taAnsList() {
  const s = TA.ans, side = taSide(), q = s.q.trim();
  if (q) {
    const found = taSearch(q), best = found[0];
    if (!found.length) return `<div class="emptystate"><strong>No article answers that yet.</strong><p>Try fewer words, or pick a topic. In Turbo Assist an unanswered question goes to the article queue for a trainer to write.</p></div>`;
    return `<div class="ta-best"><small>Best match</small><strong>${esc(best.title)}</strong><p>${esc(best.hint || best.body.replace(/[#*]/g, '').slice(0, 260))}</p>${best.flag ? `<p class="notice">${icon('alert', 16)} ${esc(best.flag)}</p>` : ''}<button type="button" class="secondary small" onclick="taOpenAnswers('${best.id}')">Read the article ${icon('arrow', 16)}</button></div>
      ${found.length > 1 ? `<h3>Also about this</h3>${found.slice(1).map(taAnsRow).join('')}` : ''}`;
  }
  if (s.topic !== 'All') {
    const list = TA_KB.filter((a) => a.topic === s.topic).concat(TA_KB_STAFF_ONLY.filter((a) => a.topic === s.topic));
    return `<h3>${esc(s.topic)} · ${list.length}</h3>${list.map(taAnsRow).join('')}`;
  }
  return `<div class="ta-ask">${(TA_ASK[side] || TA_ASK.sales).map((x) => `<button type="button" class="chipbtn" onclick="taAsk(this.textContent)">${esc(x)}</button>`).join('')}</div>
    <h3>Looked up most on the ${esc(TA_SIDE_NAME[side])} side</h3>${(TA_SUGGEST[side] || TA_SUGGEST.sales).map(taArticle).filter(Boolean).map(taAnsRow).join('')}
    <p class="source">${TA_KB.length} articles from Turbo Assist’s knowledge base, plus ${TA_KB_STAFF_ONLY.length} staff-only titles. Pick a topic above to see them all.</p>`;
}
function taAnsPractice() {
  return `<p>Turbo Assist plays the customer and scores the conversation. These are the four customers it ships with.</p>
    ${TA_ROLEPLAY.map(([name, persona]) => `<div class="ta-persona"><strong>${esc(name)}</strong><p>${esc(persona)}</p></div>`).join('')}
    <p class="notice">Practice runs in Turbo Assist under Training, Roleplay. Legacy keeps training; the desk only points to it.</p>
    <button type="button" class="link" onclick="taOpenAnswers('ta-training-roleplay')">How roleplay works ${icon('arrow', 16)}</button>`;
}
function taAnsBody() {
  const el = $('#ta-ans-body');
  if (!el) return;
  const s = TA.ans, a = s.id && taArticle(s.id);
  el.innerHTML = s.tab === 'practice' ? taAnsPractice() : a ? taAnsArticle(a) : taAnsList();
  el.scrollTop = 0;
  document.querySelectorAll('#ta-sheet [data-topic]').forEach((b) => b.classList.toggle('on', s.tab === 'answers' && !s.q.trim() && !a && b.dataset.topic === s.topic));
  document.querySelectorAll('#ta-sheet [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === s.tab));
  const tools = $('#ta-ans-tools');
  if (tools) tools.hidden = s.tab !== 'answers';
}
function taAsk(text) {
  TA.ans.q = text;
  TA.ans.id = null;
  const input = $('#ta-ans-q');
  if (input) input.value = text;
  taAnsBody();
}
/* Open the panel: on an article (its id), on a search (any other text), or on the front page. */
function taOpenAnswers(arg) {
  const s = TA.ans;
  s.tab = 'answers';
  if (arg && taArticle(arg)) s.id = arg;
  else if (arg) Object.assign(s, { q: String(arg), id: null });
  else if (!$('#ta-sheet')) Object.assign(s, { q: '', id: null, topic: 'All' });
  if (!$('#ta-sheet')) {
    const side = taSide();
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="ta-sheet-back" id="ta-sheet" onclick="if(event.target===this)taCloseAnswers()"><section class="ta-sheet" role="dialog" aria-modal="true" aria-label="Answers">
        <header><div><strong>Answers</strong><small>Turbo Assist’s knowledge base</small></div><button type="button" class="chipbtn" onclick="taCloseAnswers()">Close ×</button></header>
        ${side === 'sales' ? `<div class="ta-tabs"><button type="button" data-tab="answers" onclick="TA.ans.tab='answers';taAnsBody()">Answers</button><button type="button" data-tab="practice" onclick="TA.ans.tab='practice';taAnsBody()">Practice</button></div>` : ''}
        <div id="ta-ans-tools"><label class="searchbar">${icon('orders', 18)}<input id="ta-ans-q" class="search" type="search" aria-label="Ask a question" placeholder="Ask a question, like: how far is delivery free?" value="${esc(s.q)}" oninput="TA.ans.q=this.value;TA.ans.id=null;taAnsBody()"></label>
        <div class="ta-topics">${TA_TOPICS.map((t) => `<button type="button" class="chipbtn" data-topic="${esc(t)}" onclick="TA.ans.topic=this.dataset.topic;TA.ans.q='';TA.ans.id=null;document.getElementById('ta-ans-q').value='';taAnsBody()">${esc(t)}</button>`).join('')}</div></div>
        <div class="ta-body" id="ta-ans-body"></div></section></div>`
    );
  } else if ($('#ta-ans-q')) $('#ta-ans-q').value = s.q;
  taAnsBody();
}
function taCloseAnswers() {
  $('#ta-sheet')?.remove();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#ta-sheet')) taCloseAnswers();
});
/* A small link beside a control: opens the article that explains the rule. */
function taTip(id, text = 'Why?') {
  return `<button type="button" class="ta-tip" onclick="event.stopPropagation();event.preventDefault();taOpenAnswers('${id}')">${icon('help', 14)}<span>${esc(text)}</span></button>`;
}

/* ---------- Top bar: Answers and the bell, on every side ---------- */
document.querySelector('.topbar-right').insertAdjacentHTML(
  'afterbegin',
  `<button type="button" class="ta-topbtn" id="ta-ans-btn" onclick="taOpenAnswers()" aria-label="Answers: search the knowledge base">${icon('book', 18)}<span>Answers</span></button>
   <button type="button" class="ta-topbtn" id="ta-bell" onclick="taOpenNotices()" aria-label="Notifications">${icon('bell', 18)}<span class="count" id="ta-bell-count" hidden></span></button>`
);
function taChrome() {
  const el = $('#ta-bell-count');
  if (!el) return;
  const n = taNoticesFor().filter((x) => !x.read).length;
  el.hidden = !n;
  el.textContent = n;
  $('#ta-bell').setAttribute('aria-label', n ? `Notifications: ${n} new` : 'Notifications');
}
{
  const baseRender = render;
  render = function () {
    baseRender();
    taChrome();
  };
}
taRtoSync();
/* The side files add to screens that are already drawn; draw once more when everything has loaded. */
document.addEventListener('DOMContentLoaded', () => render());
