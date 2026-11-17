/* app-help.js: one place that answers questions, one count of what is new, and Firefly staying out
   of the way.

   1. Answers. ahAnswer(question) is the one function behind the Home ask bar, the Answers sheet and
      Firefly, so the same question gets the same answer in all three. It knows the app's own
      how-to questions, forgives spelling, finds a size like 14x40, and says "I don't know that yet"
      when it has no sure answer. (Turbo Assist: matchAskQuery, with retrieval over the same articles.)
   2. One count. The bell and Firefly show the same number: news for this side not read yet.
      Reading it in either place clears it in both.
   3. News can be opened and cleared one at a time, and Firefly's on/off box is at the top of the list.
   4. Firefly never rests on top of a button, and shows once that it can be dragged.
   5. Keyboard: a "Skip to the page" button comes first, every button has a name, and the side
      switch says which side is chosen.
   Loaded after firefly.js. Wraps taSearch, taAnsList, taOpenNotices, taChrome, ffAsk, ffDraw,
   ffClose and render. These are features of this preview; the product still has to accept them. */

/* ---------- 1. Answers ---------- */
const AH = { index: null, vocab: null, tip: 'firefly:dragtip' };
const ahNorm = (t) => String(t).toLowerCase().replace(/(\d+)\s*(?:x|×|by)\s*(\d+)/g, '$1x$2').replace(/[’']/g, '');
/* Everyday words for the words the articles use, on top of Turbo's own list. */
Object.assign(TA_ALSO, {
  slope: ['unlevel', 'level', 'blocking'], sloped: ['unlevel', 'level', 'blocking'], unlevel: ['level', 'blocking', 'set height'], hill: ['unlevel', 'blocking'],
  repo: ['repossess', 'missed payment', 'default'], refund: ['refund', 'non-refundable'], color: ['color', 'paint'], colors: ['color', 'paint'],
  credit: ['card', 'credit check'], card: ['card'], deposit: ['down payment', 'deposit'], plan: ['rent-to-own', 'financing'], built: ['lead time', 'build'],
  hoa: ['hoa', 'restriction'], park: ['restriction', 'permit'], warranty: ['warranty'], shed: ['portable', 'shed'], insulated: ['insulation'],
});
/* Small words that say nothing about the subject. */
for (const w of 'go put need much many want have has any some would could should into onto until im ive me us please tell know just really thing things'.split(' ')) TA_STOP.add(w);
function ahBuild() {
  AH.index = TA_KB.map((a) => ({ a, title: ahNorm(a.title), hint: ahNorm(a.hint || ''), tags: ahNorm(a.tags.join(' ')).replace(/[_-]/g, ' '), body: ahNorm(a.body) }));
  AH.vocab = new Map();
  const add = (text, weight) => { for (const w of text.match(/[a-z]{4,}/g) || []) AH.vocab.set(w, (AH.vocab.get(w) || 0) + weight); };
  for (const x of AH.index) { add(x.title, 6); add(x.tags, 4); add(x.hint, 2); add(x.body, 1); }
  for (const k of Object.keys(TA_ALSO)) add(k, 3);
  for (const w of 'delivery warranty payment deposit permit serial price prices firefly user users sale order orders load loads trailer driver building buildings quote invoice cancel refund surcharge fuel commission'.split(' ')) add(w, 8);
}
/* How many letters differ (a swap of two neighbours counts once), stopping early past the limit. */
function ahDist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], prev2[j - 2] + 1);
      low = Math.min(low, row[j]);
    }
    if (low > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}
/* A misspelled word becomes the nearest word the articles use: "warrenty" reads as "warranty". */
function ahSpell(word) {
  if (!AH.vocab) ahBuild();
  if (word.length < 5 || /\d/.test(word) || AH.vocab.has(word) || TA_ALSO[word]) return word;
  for (const [v] of AH.vocab) if (v.startsWith(word) || (word.length > 5 && word.startsWith(v) && v.length >= word.length - 2)) return word;
  const max = word.length >= 8 ? 2 : 1;
  let best = null, score = 0;
  for (const [v, weight] of AH.vocab) {
    if (v[0] !== word[0]) continue;
    const d = ahDist(word, v, max);
    if (d > max) continue;
    const s = (max + 1 - d) * 100 + Math.min(weight, 60);
    if (s > score) (best = v), (score = s);
  }
  return best || word;
}
const ahWords = (q) => taWords(ahNorm(q)).map(ahSpell);
const AH_WEAK = new Set(['shed', 'sheds', 'building', 'buildings', 'portable', 'bennett']);
/* Every article with a score, best first. */
function ahRank(q) {
  if (!AH.index) ahBuild();
  const words = ahWords(q), text = ahNorm(q);
  if (!words.length) return [];
  const phrase = words.length > 1 ? words.join(' ') : '';
  return AH.index
    .map((x) => {
      let score = 0, hits = 0, weak = 0;
      for (const word of words) {
        let best = 0;
        for (const w of [word, ...(TA_ALSO[word] || [])]) {
          const at = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const has = (t) => ((at.lastIndex = 0), at.test(t));
          const n = (x.body.match(at) || []).length;
          best = Math.max(best, (has(x.title) ? 6 : 0) + (has(x.tags) ? 4 : 0) + (has(x.hint) ? 5 : 0) + Math.min(n, 5));
        }
        /* "Shed" and "building" are in nearly every article, so they count for little. */
        if (AH_WEAK.has(word) && words.some((w) => !AH_WEAK.has(w))) { weak++; score += Math.min(best, 1); continue; }
        if (best) hits++;
        score += best;
      }
      if (phrase && x.title.includes(phrase)) score += 10;
      else if (phrase && (x.hint.includes(phrase) || x.tags.includes(phrase))) score += 5;
      /* Steel, the CRM and how-to-use-Turbo-Assist articles only lead when the question is about them. */
      const off = (x.a.topic === 'Steel structures' && !/steel|carport|garage|longhorn|steelcraft|metal/.test(text)) ||
        (x.a.topic === 'Using Turbo Assist' && !/turbo|app\b|browser|voice|roleplay|bug|who do i call|contact/.test(text)) ||
        (x.a.topic === 'Company and CRM' && !/crm|pipeline|lead|follow|gohighlevel|ghl|company|shedcor|bennett|idearoom|inventory/.test(text));
      const cover = hits / Math.max(1, words.length - weak);
      return { a: x.a, hits, cover, off, score: score * cover ** 2 * (off ? 0.45 : 1) };
    })
    .filter((r) => r.hits && r.score >= 2)
    .sort((x, y) => y.score - x.score);
}
/* A sure match: every word found and a real score, or a very strong score. */
const ahSure = (r) => !!r && !r.off && ((r.cover === 1 && r.score >= 6) || r.score >= 16);
/* The Answers sheet's own search now uses the same ranking. */
taSearch = function (q) {
  const all = ahRank(q);
  return all.filter((r) => r.score >= all[0].score * 0.35).slice(0, 8).map((r) => r.a);
};

/* The app's own how-to questions. First match wins. `need` is the section a person must be able to open. */
const AH_FAQ = [
  { id: 'off', test: /(turn|switch|shut)\b.*\b(you|firefly|guide|bug)\b.*\boff|(turn|switch|shut) off (you|firefly|the guide|the bug)|\b(hide|remove|stop|disable|get rid of) (you|firefly|the guide|the bug)\b/, title: 'Turn Firefly off',
    text: 'Open me and press the small settings button at the top of my box. Untick “Show Firefly”. To bring me back, press the bell at the top of the screen and tick “Show Firefly”.', go: "ffOpen();ffView('settings')", label: 'Open my settings', keep: true },
  { id: 'help', test: /^(help|help me|i need help|what can (you|firefly) do|what do you do|who are you|what are you|what is firefly)\??$/, title: 'What I can do',
    text: 'I can show you around with short tours, point at the right button and wait while you press it, and answer questions about delivery, sizes, payments and the warranty. Type a question in plain words.', go: "ffOpen();ffView('catalog')", label: 'See the tours', tour: 'welcome', keep: true },
  { id: 'around', test: /show me around|look around|whats on this (screen|page)|what is on this (screen|page)|show me this (screen|page)|where (is|are) (things|everything)/, title: 'A look around',
    text: 'I can point at the three or four things that matter on the screen you have open. Or take the one-minute tour of the whole app.', go: 'ffClose();ffAround()', label: 'Show me this screen', tour: 'welcome' },
  { id: 'user', test: /\b(add|invite|create|set up|make)\b.*\b(user|users|person|people|employee|worker|someone|account|login)\b|\bnew (user|person|employee|hire)\b|give (someone|somebody|a person) access/, title: 'Add a person', need: 'users',
    text: 'Press the gear button at the top and open “Users and permissions”. Press “Add a person”, type the name and email, pick the job, then choose what they can see. Only owners and super users can add people.', go: "go('of-users')", label: 'Open Users' },
  { id: 'hide-lot', test: /\b(hide|limit|block|keep)\b.*\blots?\b|only see (their|his|her|one|some) (own )?lots?/, title: 'Limit a person to some lots', need: 'users',
    text: 'Open “Users and permissions”, open the person, and tick only the lots they should see. They then see only those lots on every screen.', go: "go('of-users')", label: 'Open Users' },
  { id: 'cancel-load', test: /\bcancel\b.*\b(load|run|truck|delivery)\b/, title: 'Cancel a load', need: 'logi',
    text: 'Open the load and press “Cancel load”. Type why, then confirm. This works even when the truck is on the road. The lot and the salesperson are told.', go: "go('lg-loads')", label: 'Open Loads' },
  { id: 'cancel-order', test: /\bcancel\b.*\b(order|sale|sales)\b/, title: 'Cancel an order', need: 'office',
    text: 'The office does this. Open the order, press “Cancel order” and type why. The lot is told. A cancelled order can be opened again with “Reopen this order”.', go: "go('of-orders')", label: 'Open Office orders' },
  { id: 'undo', test: /\bundo\b|take (it|that|the move|a move) back|by (mistake|accident)|wrong (step|phase)|\bsend (it|a building|the building) back\b/, title: 'Undo a move', need: 'prod',
    text: 'Right after you move a building, an “Undo” button shows for 10 seconds. If it is gone, a lead can open the building, press “Send back” and type why.', go: "go('prod')", label: 'Open the board' },
  { id: 'move', test: /\b(move|send|push)\b.*\b(building|shed|it)\b.*\b(next|phase|step)\b|\bnext (phase|step)\b/, title: 'Move a building to the next step', need: 'prod',
    text: 'On Production, open the building. Type a note if you need one, then press the button for the next step. “Undo” shows for 10 seconds if you pressed it by mistake.', go: "go('prod')", label: 'Open the board', tour: 'prod-board' },
  { id: 'price', test: /\b(change|raise|lower|set|update|edit|fix)\b.*\b(price|prices|pricing)\b|price (increase|change)/, title: 'Change a price', need: 'pricing',
    text: 'Press the gear and open “Model pricing”. Type the new price on any size or option. Changes wait in “Draft and publish”. Pick the day, press Publish, and check the list before you say yes. “Undo this publish” puts the old prices back.', go: "AD.tab='grid';go('of-prices')", label: 'Open Model pricing', tour: 'office-prices' },
  { id: 'sale', test: /\b(start|begin|make|open|ring up|do)\b.*\b(new )?sale\b|new sale/, title: 'Start a sale', need: 'sales',
    text: 'Press “Start a sale” on Home, or “New sale” in the menu. Then pick a building from your lot, or build a new one step by step.', go: "S.saleLead=null;go('start')", label: 'Start a sale', tour: 'sales-lot' },
  { id: 'pay', test: /\b(take|record|enter|add|log|collect)\b.*\b(payment|deposit|money)\b|\bhow do i get paid by\b/, title: 'Take a payment', need: 'sales',
    text: 'At the desk, type the money taken today on the last step of the sale. At the office, open the order’s Money box and press “Record a payment”, then “Confirm received” when the money is in.', go: "go('orders')", label: 'Open Orders' },
  { id: 'print', test: /\bprint\b/, title: 'Print a quote, invoice or run sheet',
    text: 'Open the quote, the invoice or the run sheet and press its Print button. To print a quote: open Orders, pick the customer, press “Open issued quote”, then “Print quote”.', go: "go('orders')", label: 'Open Orders', need: 'sales' },
  { id: 'serial', test: /\bserial\b/, title: 'Find a building by its serial number',
    text: 'Type the serial number in the search box on Orders, Production, Plant QC or Dispatch. It tells you where that building is right now.', go: "go('orders')", label: 'Open Orders', need: 'sales' },
  { id: 'fee-who', test: /\b(who|approve|approves|sets?)\b.*\b(delivery fee|delivery fees|delivery charge|fee)\b/, title: 'Who sets the delivery fee',
    text: () => `Delivery is free within ${FREE_DELIVERY_MILES} miles of the lot. From ${FREE_DELIVERY_MILES + 1} to ${OF.set.overTo} miles it is ${money(OF.set.overFee)}, added for you. Past ${OF.set.overTo} miles, Logistics sets the fee. Those wait on Dispatch under “Delivery fees to approve”.`, article: 'delivery-distance' },
  { id: 'fee', test: /\bdelivery (fee|fees|cost|charge|price)\b|how much\b.*\bdeliver|\bdeliver\w*\b.*\b(cost|how much)\b|\bcost to deliver\b/, title: 'What delivery costs',
    text: () => `Delivery is free within ${FREE_DELIVERY_MILES} miles of the lot. From ${FREE_DELIVERY_MILES + 1} to ${OF.set.overTo} miles it is ${money(OF.set.overFee)}. Past ${OF.set.overTo} miles, Logistics sets the fee for that trip.`, article: 'delivery-distance' },
  { id: 'permit', test: /^(?!.*\b(steel|carport|metal building)\b).*\bpermits?\b/, title: 'Do I need a permit?',
    text: 'It depends on the town or county. The rules change from place to place, so the customer should ask their local permit office before delivery. We can give them the engineering papers the office asks for.', article: 'wind-anchors' },
  { id: 'tax', test: /\bsales tax\b|\btax(es)?\b/, title: 'Sales tax',
    text: 'The office types the sales tax on each order. On a cash order it is added to the total. On rent-to-own it is added to each monthly payment. A cash order cannot be approved until the tax is typed or “Tax exempt” is ticked.' },
  { id: 'fuel', test: /\bfuel\b/, title: 'Fuel surcharge',
    text: () => `A fuel charge is added to every new building. Right now it is ${ofFuelSay()}. The office can change it under Settings.` },
  { id: 'pay-me', test: /\bcommission\b|\bmy pay\b|\bpaycheck\b|when do i get paid/, title: 'I don’t know that yet', unknown: true,
    text: 'Pay and commission are not in this app. Ask your manager.' },
];
const AH_SIZE = /\b(\d{1,2})x(\d{1,2})\b/;
/* A size someone typed: is it one we sell, and what does it start at? */
function ahSize(text) {
  const m = text.match(AH_SIZE);
  if (!m || typeof PRICE_LIST === 'undefined') return null;
  const size = `${m[1]}x${m[2]}`, flip = `${m[2]}x${m[1]}`;
  const pick = Object.entries(PRICE_LIST).some(([, sizes]) => sizes[size] != null) ? size : Object.entries(PRICE_LIST).some(([, sizes]) => sizes[flip] != null) ? flip : null;
  if (!pick) return { title: `${size.replace('x', ' × ')}: not a size we sell`, text: 'That size is not on the price list. Sheds run from 6 × 4 up to 16 × 60. Ask the office about a size that is not listed.', article: 'size-limits' };
  const price = (name) => { try { const [ser, ...st] = name.split(' '); const c = { style: st.join(' '), size: pick, siding: 'Basic groove' }; return (typeof priceListBase === 'function' && /^(Basic|Classic|Elite)$/.test(ser) ? priceListBase(c, ser) : null) ?? PRICE_LIST[name][pick]; } catch (e) { return PRICE_LIST[name][pick]; } };
  const rows = Object.keys(PRICE_LIST).filter((n) => PRICE_LIST[n][pick] != null).map((n) => [n, price(n)]).sort((a, b) => a[1] - b[1]);
  return { title: `${pick.replace('x', ' × ')}: yes, we sell that size`, text: `It starts at ${money(rows[0][1])} for a ${rows[0][0]}. ${rows.length > 1 ? `Other styles in this size: ${rows.slice(1, 4).map(([n, p]) => `${n} ${money(p)}`).join(', ')}${rows.length > 4 ? ', and more' : ''}. ` : ''}That is the building only, before options, tax and delivery.`, article: 'size-limits' };
}
/* "How long is the drive to Lexington": road miles and truck time from the plant, from the stored table. */
function ahDrive(text) {
  if (!/\b(drive|driving|miles|far|trip|haul)\b/.test(text) || typeof LOTS === 'undefined' || typeof dtRow !== 'function') return null;
  const lot = LOTS.find((l) => text.includes(l.town.toLowerCase()));
  if (!lot) return null;
  try {
    const plant = PLANTS[0], row = dtRow(plant, lot), min = dtKnown(row, DT.set.mph);
    if (!row.miles) return null;
    const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
    return { title: `The drive to ${lot.town}`, text: `From the ${plant.town} plant to the ${lot.town} lot is ${Math.round(row.miles)} road miles${min != null ? `, about ${hm(min)} in a loaded truck` : ''}. A load’s page shows the whole day: every stop and when the truck is back.`, go: typeof ffCan !== 'function' || ffCan('logi') ? "go('logi')" : null, label: 'Open Dispatch' };
  } catch (e) { return null; }
}
/* The one answer. kind: 'app' (how the app works), 'tour', 'article', or 'unknown'. */
function ahAnswer(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  const text = ahNorm(q).replace(/[^a-z0-9$% ]+/g, ' ').replace(/\s+/g, ' ').trim(), fixed = text.split(' ').map((w) => (TA_STOP.has(w) ? w : ahSpell(w))).join(' ');
  const can = (section) => !section || typeof ffCan !== 'function' || ffCan(section), who = () => (typeof ffMe === 'function' && ffMe()?.name) || 'This person';
  const close = ahRank(q).slice(0, 4).map((r) => r.a);
  for (const f of AH_FAQ) {
    if (!f.test.test(text) && !f.test.test(fixed)) continue;
    if (f.unknown) return { kind: 'unknown', title: f.title, text: f.text, flag: q, close: [] };
    if (!can(f.need)) return { kind: 'app', title: f.title, text: `${typeof f.text === 'function' ? f.text() : f.text} ${who()} cannot open that part of the app. An owner can give access under “Users and permissions”.`, close };
    let body = f.text;
    try { if (typeof body === 'function') body = body(); } catch (e) { continue; }
    return { kind: 'app', id: f.id, title: f.title, text: body, go: f.go, label: f.label, tour: f.tour && typeof ffTour === 'function' && ffTourOk(ffTour(f.tour)) ? f.tour : null, article: f.article || null, close };
  }
  const size = ahSize(fixed);
  if (size) return { kind: 'app', ...size, close };
  const drive = ahDrive(fixed);
  if (drive) return { kind: 'app', ...drive, close };
  if (typeof FF_PAGES !== 'undefined' && /\b(open|go to|take me to|show)\b/.test(text)) {
    const page = FF_PAGES.find((p) => p[2].some((k) => text.includes(k)));
    if (page) return can(page[1]) ? { kind: 'app', title: page[4], text: `I can take you to ${page[4]}.`, go: page[3], label: 'Take me there', close } : { kind: 'app', title: 'Not on this account', text: `${who()} cannot open ${page[4]}.`, close };
  }
  const ranked = ahRank(q), tour = typeof ffMatchTour === 'function' ? ffMatchTour(fixed) : null, best = ranked.find((r) => !r.off) || ranked[0], howto = /how (do|can|would|should) (i|we|you)|how to|where (do|can) (i|we)|can (i|we|this app)|help me/.test(text);
  const tourKeys = tour ? tour.keys.filter((k) => fixed.includes(k)).reduce((n, k) => n + k.length, 0) : 0;
  if (tour && !ffTourOk(tour)) return { kind: 'app', title: 'Not on this account', text: `${who()} cannot open ${ffSideName(tour.section)}, so I can’t show that. An owner can give access under “Users and permissions”.`, close };
  if (tour && (howto || tourKeys >= 7 || !ahSure(best))) return { kind: 'tour', title: tour.name, text: tour.answer || tour.about, tour: tour.id, show: tour.id, close };
  if (ahSure(best)) return { kind: 'article', title: best.a.title, text: best.a.hint || best.a.body.replace(/[#*]/g, '').slice(0, 240), article: best.a.id, flagged: best.a.flag || '', close: close.slice(1) };
  return { kind: 'unknown', title: 'I don’t know that yet', text: close.length ? 'I could not find a sure answer. The articles below might be close. If not, ask your manager, or flag the question so someone writes the answer.' : 'I could not find an answer. Ask your manager, or flag the question so someone writes the answer.', flag: q, close };
}

/* Firefly asks the same function. "Tour" or "walk me through" still starts a tour straight away. */
ffAsk = function (raw) {
  const q = String(raw || '').trim(), text = q.toLowerCase();
  if (!q) return;
  FF.q = q;
  FF.view = 'main';
  FF.open = true;
  if (/what (else )?can firefly do|show me what firefly/.test(text)) return (FF.view = 'catalog'), (FF.answer = null), ffDraw();
  const tour = ffMatchTour(text);
  if (tour && ffTourOk(tour) && /\btour\b|walk me through/.test(text)) return ffTourStart(tour.id);
  const a = ahAnswer(q);
  FF.answer = { title: a.title, text: a.text, go: a.go, label: a.label, tour: a.tour, show: a.show, article: a.article, flag: a.flag };
  ffDraw();
};
/* The Answers sheet (and the Home ask bar, which opens it) leads with the same answer. */
{
  const esc2 = (t) => esc(t);
  const row = (a) => taAnsRow(a);
  taAnsList = (function (base) {
    return function () {
      const q = TA.ans.q.trim();
      if (!q) return base();
      const a = ahAnswer(q);
      if (!a) return base();
      const btn = (text, code, cls = 'secondary small') => `<button type="button" class="${cls}" onclick="${code}">${text}</button>`;
      const acts = [a.go ? btn(esc2(a.label || 'Take me there') + ' ' + icon('arrow', 16), `taCloseAnswers();${a.go}`, 'primary small') : '', a.tour ? btn('Take the tour', `taCloseAnswers();ffSetOn(true);ffTourStart('${a.tour}')`) : '', a.article ? btn('Read the article ' + icon('arrow', 16), `taOpenAnswers('${a.article}')`) : '',
        a.flag ? btn('Flag it for the team', "this.outerHTML='<span class=&quot;pill good&quot;>Flagged. Preview: nothing is sent.</span>'") : ''].join('');
      const lead = a.kind === 'unknown'
        ? `<div class="ta-best ah-unknown" id="ah-answer" data-kind="unknown"><small>No sure answer</small><strong>${esc2(a.title)}</strong><p>${esc2(a.text)}</p><div class="actions">${acts}</div></div>`
        : `<div class="ta-best" id="ah-answer" data-kind="${a.kind}"><small>${a.kind === 'article' ? 'Best match' : 'How it works here'}</small><strong>${esc2(a.title)}</strong><p>${esc2(a.text)}</p>${a.flagged ? `<p class="notice">${icon('alert', 16)} ${esc2(a.flagged)}</p>` : ''}<div class="actions">${acts}</div></div>`;
      const more = (a.close || []).filter((x) => x.id !== a.article);
      return lead + (more.length ? `<h3>${a.kind === 'unknown' ? 'These might be close' : 'Also about this'}</h3>${more.map(row).join('')}` : '');
    };
  })(taAnsList);
}

/* ---------- 2. One count: news for this side that has not been read ---------- */
const ahNews = (side = taSide()) => taNoticesFor(side).filter((n) => !n.read).length;
{
  const baseDraw = ffDraw;
  ffDraw = function () {
    baseDraw();
    const bug = document.getElementById('ff-bug'), n = ahNews();
    if (!bug) return;
    const badge = bug.querySelector('.ff-n');
    badge.textContent = n || '';
    badge.hidden = !n || !!FF.tour;
    bug.setAttribute('aria-label', `Firefly, your guide${n ? `: ${n} new` : ''}. Press to open, drag to move.`);
    ahRest();
  };
  const baseChrome = taChrome;
  let busy = false;
  taChrome = function () {
    baseChrome();
    if (busy) return;
    busy = true;
    try { ffDraw(); } finally { busy = false; }
  };
  /* Looking at "Today" in Firefly reads the news, the same as opening the bell. */
  const baseClose = ffClose;
  ffClose = function () {
    const read = FF.open && FF.view === 'main' && !FF.tour;
    baseClose();
    if (read && ahNews()) {
      taNoticesFor().forEach((n) => (n.read = true));
      taChrome();
    }
  };
}

/* ---------- 3. News: open or clear one at a time; Firefly's switch on top ---------- */
function ahNoticeGo(n) {
  if (n.go) return n.go;
  const side = n.to;
  if (n.saleId && side === 'sales' && S.sales.some((x) => x.id === n.saleId)) return `openSale('${n.saleId}')`;
  if (n.saleId && side === 'office' && typeof ofOpen === 'function') return `ofOpen('${n.saleId}')`;
  /* News about a building by its serial: open Orders with that serial looked up. */
  if (n.serial && side === 'sales') return `go('orders');setTimeout(()=>{const i=document.getElementById('order-search');if(i){i.value='${n.serial}';filterOrders('${n.serial}');}},80)`;
  return '';
}
function ahClearNotice(id) {
  const i = TA.notices.findIndex((n) => n.id === id);
  if (i >= 0) TA.notices.splice(i, 1);
  taOpenNotices();
}
function ahClearAll() {
  const side = taSide();
  for (const n of taNoticesFor(side)) TA.notices.splice(TA.notices.indexOf(n), 1);
  taOpenNotices();
}
taOpenNotices = function () {
  /* When Firefly lives in the bell, the bell opens Firefly (which lists the news under “Today”). */
  if (FF.on && FF.home === 'bell') return ffToggle();
  const side = taSide(), list = taNoticesFor(side);
  modal(
    'What is new',
    `<label class="checkrow ff-onrow ah-fftop"><input type="checkbox" id="ff-on-bell" ${FF.on ? 'checked' : ''} onchange="ffSetOn(this.checked)"> Show Firefly, the guide that points things out</label>
    <p class="source">News for the ${esc(TA_SIDE_NAME[side])}. Nothing is texted or emailed from this preview.</p>
    <div class="ta-notices">${
      list.length
        ? list.map((n) => {
            const go = ahNoticeGo(n);
            return `<div class="ta-notice${n.read ? '' : ' new'}" data-notice="${n.id}"><div class="grow"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${taAgo(n.at)}</small></div><span class="ah-nbtns">${go ? `<button type="button" class="secondary small" onclick="closeModal();${esc(go)}">Open</button>` : ''}<button type="button" class="secondary small" onclick="ahClearNotice('${n.id}')" aria-label="Clear: ${esc(n.title)}">Clear</button></span></div>`;
          }).join('')
        : '<p class="muted">Nothing new for this side.</p>'
    }</div>${list.length > 1 ? `<div class="actions">${button('Clear all', 'ahClearAll()', 'secondary')}</div>` : ''}`
  );
  list.forEach((n) => (n.read = true));
  taChrome();
};

/* ---------- 4. Firefly keeps off the buttons ---------- */
/* Is there something to press under this spot? */
function ahCovers(x, y, size = 56) {
  const pts = [[x + size / 2, y + size / 2], [x + 10, y + 10], [x + size - 10, y + 10], [x + 10, y + size - 10], [x + size - 10, y + size - 10]];
  for (const [px, py] of pts) {
    const el = document.elementsFromPoint(px, py).find((e) => !e.closest('#ff-root'));
    if (el && el.closest('button, a[href], input, select, textarea, summary, label, [role=button], [onclick]')) return true;
  }
  return false;
}
let ahDragging = false;
function ahRest() {
  const bug = document.getElementById('ff-bug'), root = document.getElementById('ff-root');
  if (!bug || !root || root.hidden || bug.hidden || FF.tour || FF.open || ahDragging || FF.home === 'bell') return;
  const vw = innerWidth, vh = innerHeight, size = 56;
  const base = FF.pos ? [Math.min(vw - 60, Math.max(4, FF.pos[0])), Math.min(vh - 60, Math.max(70, FF.pos[1]))] : [vw - size - 22, vh - size - 112];
  const spots = [base];
  for (const x of [base[0], vw - size - 8, 8]) for (let y = base[1]; y >= 76; y -= 30) spots.push([x, y]);
  for (const x of [base[0], vw - size - 8, 8]) for (let y = base[1] + 30; y <= vh - size - 8; y += 30) spots.push([x, y]);
  for (let x = vw - size - 8; x >= 8; x -= 40) for (let y = vh - size - 112; y >= 76; y -= 60) spots.push([x, y]);
  const free = spots.find(([x, y]) => !ahCovers(x, y, size)) || base;
  const now = bug.getBoundingClientRect();
  if (Math.abs(now.left - free[0]) > 1 || Math.abs(now.top - free[1]) > 1) ffBugTo(free[0], free[1]);
}
/* Shown once: Firefly can be dragged. */
function ahDragTip(force) {
  let seen = false;
  try { seen = !!localStorage.getItem(AH.tip); } catch (e) {}
  const bug = document.getElementById('ff-bug');
  if (!bug || bug.hidden || !FF.on || FF.tour || (seen && !force)) return false;
  try { localStorage.setItem(AH.tip, '1'); } catch (e) {}
  document.getElementById('ah-dragtip')?.remove();
  const r = bug.getBoundingClientRect(), left = r.left > innerWidth / 2;
  document.getElementById('ff-root').insertAdjacentHTML('beforeend', `<div class="ah-dragtip" id="ah-dragtip" role="status" style="top:${Math.max(76, Math.round(r.top + 6))}px;${left ? `right:${Math.round(innerWidth - r.left + 8)}px` : `left:${Math.round(r.right + 8)}px`}">In your way? Drag me anywhere. <button type="button" class="ah-tipx" aria-label="Close this tip" onclick="this.parentNode.remove()">Got it</button></div>`);
  setTimeout(() => document.getElementById('ah-dragtip')?.remove(), 9000);
  return true;
}
{
  const bug = document.getElementById('ff-bug');
  if (bug) {
    bug.addEventListener('pointerdown', () => { ahDragging = true; document.getElementById('ah-dragtip')?.remove(); });
    window.addEventListener('pointerup', () => setTimeout(() => { ahDragging = false; ahRest(); }, 60));
  }
  let wait = 0;
  const later = () => { clearTimeout(wait); wait = setTimeout(ahRest, 160); };
  window.addEventListener('scroll', later, { passive: true });
  window.addEventListener('resize', later);
  /* A person meeting the app for the first time sees the tip a little after the welcome. */
  if (typeof FF_AUTO !== 'undefined' && FF_AUTO) setTimeout(() => ahDragTip(), 9000);
}

/* ---------- 5. Keyboard: skip link, a name on every button, the chosen side ---------- */
function ahSkip() {
  const app = document.getElementById('app');
  app.setAttribute('tabindex', '-1');
  app.focus({ preventScroll: true });
  const first = app.querySelector('h1, h2, button, a[href], input, select');
  (first || app).scrollIntoView({ block: 'start' });
  window.scrollBy(0, -90);
}
if (!document.getElementById('ah-skip')) document.body.insertAdjacentHTML('afterbegin', '<button type="button" class="skip-link" id="ah-skip" onclick="ahSkip()">Skip to the page</button>');
const AH_NAMES = [[/taOpenAnswers/, 'Open the answer about this'], [/closeModal|\.remove\(\)|Close/, 'Close'], [/goStep\(S\.step-1\)|history\.back/, 'Back'], [/window\.print/, 'Print'], [/lgMove|moveUp|\bup\b/i, 'Move up'], [/moveDown|\bdown\b/i, 'Move down']];
function ahName() {
  for (const e of document.querySelectorAll('button:not([aria-label]):not([title]), [role=button]:not([aria-label]):not([title])')) {
    if ((e.textContent || '').trim() || e.querySelector('img[alt]:not([alt=""])')) continue;
    const code = e.getAttribute('onclick') || '', hit = AH_NAMES.find(([re]) => re.test(code));
    e.setAttribute('aria-label', hit ? hit[1] : e.closest('.ta-tip') || e.classList.contains('ta-tip') ? 'Open the answer about this' : 'More');
  }
  const side = document.body.dataset.side || 'sales';
  for (const b of document.querySelectorAll('[data-side-btn]')) {
    const on = b.dataset.sideBtn === side;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
}
{
  const baseRender = render;
  render = function () {
    baseRender.apply(this, arguments);
    try { ahName(); ahRest(); } catch (e) {}
  };
  new MutationObserver(() => { clearTimeout(AH.naming); AH.naming = setTimeout(() => { try { ahName(); ahRest(); } catch (e) {} }, 120); }).observe(document.body, { childList: true, subtree: true });
  ahName();
}
