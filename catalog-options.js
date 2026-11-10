const packageDetails = {
  'Side Porch': { minWidth: 8, minLength: 12, windows: '3 × 2×3 windows', porch: '4-ft composite porch, painted posts and railing' },
  'End Porch': { minWidth: 8, minLength: 8, windows: '3 × 2×3 windows', porch: '4-ft composite porch, painted posts and railing' },
  'Deluxe Porch': { minWidth: 10, minLength: 20, windows: '5 × 2×3 windows', porch: 'Wraparound composite porch, painted posts and railing' },
  'Garage Package': { minWidth: 10, minLength: 12, windows: '1 × 2×3 window', floor: '12-inch-on-center floor joists' },
  'Dormer Package': { minWidth: 8, minLength: 12 }
};
const garageDoorWidths = [6, 8, 9];

function usesWoodOptions(c) {
  return c.style !== 'Silver Bullet' && c.style !== 'Greenhouse';
}

function fitsPackage(name, size) {
  const details = packageDetails[name];
  if (!details) return true;
  const [width, length] = size.split('x').map(Number);
  return width >= details.minWidth && width <= 14 && length >= details.minLength && length <= 40;
}

function activePackage(c) {
  return c.catalogOptions ? packageDetails[c.package] : undefined;
}

function metalDoor(c) {
  return c.size.startsWith('12x') ? '8 × 6 ft roll-up door' : '6 × 6 ft roll-up door';
}

function packageOpenings(c) {
  if (c.catalogOptions && c.style === 'Silver Bullet') return [metalDoor(c)];
  const details = activePackage(c);
  if (!details) return [];
  if (c.package === 'Garage Package') {
    return [`${c.garageDoorWidth || 6} × 7 ft roll-up door`, 'Solid fiberglass entry door', details.windows];
  }
  if (c.package === 'Dormer Package') {
    return [
      c.dormerLength === 12 ? '2 × 3×3 windows with shutters' : '2 × 2×3 windows with shutters',
      `${c.dormerLength === 12 ? 4 : 3} dormer transom windows`,
      'Double wood doors with a transom in each door'
    ];
  }
  return [details.windows, '9-lite fiberglass entry door', 'Double barn door'];
}

function packageFeatures(c) {
  const details = activePackage(c);
  return [...packageOpenings(c), details?.porch, details?.floor].filter(Boolean);
}

function catalogFeatures(c) {
  if (!c.catalogOptions) return [];
  return [
    c.buildOnSite && 'Build on Site · site review required',
    usesWoodOptions(c) && c.wallHeight && `${c.wallHeight}-ft sidewalls`,
    usesWoodOptions(c) && c.accentColor && `${c.accentArea==='lower'?'Two-tone siding':'Accent gable'} · ${c.accentColor}`,
    usesWoodOptions(c) && c.customPaint && `Sherwin-Williams match · ${c.customPaint}`,
    usesWoodOptions(c) && c.customDoor && `Custom door request · ${c.customDoor}`,
    c.package === 'Dormer Package' && `${c.dormerLength || 8}-ft dormer`,
    ...packageFeatures(c)
  ].filter(Boolean);
}

function catalogReviewItems(c) {
  if (!c.catalogOptions) return [];
  return [
    c.buildOnSite && 'On-site construction and site conditions',
    usesWoodOptions(c) && c.wallHeight && `${c.wallHeight}-ft sidewall availability and price`,
    usesWoodOptions(c) && c.accentColor && 'Accent finish availability and price',
    usesWoodOptions(c) && c.customPaint && 'Custom paint match and price',
    usesWoodOptions(c) && c.customDoor && 'Custom door dimensions, fit and price',
    c.package === 'Garage Package' && 'Roll-up door fit and package pricing for the selected size',
    c.package === 'Dormer Package' && 'Dormer fit and package pricing for the selected size',
    activePackage(c) && packageAmount(c) === null && 'Building package price',
    c.roof === 'Shingles' && shinglePrice(c) === null && 'Architectural shingles price'
  ].filter(Boolean);
}

function reviewItemsMarkup(c) {
  const items = catalogReviewItems(c);
  return items.length ? '<p class="notice">Confirm before quoting: '+items.map(esc).join(' · ')+'.</p>' : '';
}

function syncPackageSelection(previous, next, key) {
  if (!next.catalogOptions || !['style', 'size', 'package'].includes(key)) return;
  const hadIncludedOpenings = packageOpenings(previous).length > 0;
  if (!fitsPackage(next.package, next.size)) {
    next.package = 'Standard Storage';
    toast('The previous package falls outside the published size range for this building.');
  }
  if (next.style === 'Silver Bullet') {
    next.windows = 0;
    next.windowItems = [];
    next.extraDoors = [];
    next.door = 'Double';
    next.floor = false;
    next.roof = 'Metal';
    next.shutters = false;
  }
  const hasIncludedOpenings = packageOpenings(next).length > 0;
  if (next.sampleWindow && hadIncludedOpenings !== hasIncludedOpenings && next.style !== 'Greenhouse') {
    next.windows = hasIncludedOpenings ? 0 : 1;
    next.windowItems = hasIncludedOpenings ? [] : [{ option: '2x3 Standard', type: 'Standard', shutters: false }];
  }
}

function packageVariantMarkup(c) {
  if (c.package === 'Garage Package') {
    return '<div class="fields"><label>Included roll-up door size<select onchange="change(\'garageDoorWidth\',+this.value)">'+
      garageDoorWidths.map(width=>`<option value="${width}" ${width===(c.garageDoorWidth||6)?'selected':''}>${width} × 7 ft</option>`).join('')+
      '</select></label></div><p class="source">Confirm door fit and clearance for this building before quoting.</p>';
  }
  if (c.package === 'Dormer Package') {
    return '<div class="fields"><label>Dormer length<select onchange="change(\'dormerLength\',+this.value)">'+
      [8,12].map(length=>`<option value="${length}" ${length===(c.dormerLength||8)?'selected':''}>${length} ft</option>`).join('')+
      '</select></label></div>';
  }
  return '';
}

function wallHeightMarkup(c) {
  if (!usesWoodOptions(c)) return '';
  return `<div class="fields"><label>Sidewall height<select onchange="change('wallHeight',+this.value)">
    <option value="0">Standard height · confirm</option>
    ${[6,7].map(height=>`<option value="${height}" ${c.wallHeight===height?'selected':''}>${height} ft</option>`).join('')}
  </select></label></div>`;
}

function setCatalogText(key,value) {
  S.c[key] = value.trim().slice(0,120);
  const aside = document.querySelector('.quoteaside');
  if (aside) aside.outerHTML = summary();
}

function paintOptionsMarkup(c) {
  if (!usesWoodOptions(c)) return '';
  const open = c.accentColor || c.customPaint ? ' open' : '';
  const accentOptions = Object.keys({...paintColors,...stainColors}).map(name=>
    `<option value="${esc(name)}" ${c.accentColor===name?'selected':''}>${esc(name)}</option>`).join('');
  return `<details${open}><summary>Two-tone siding and custom paint</summary><div class="fields">
    <label>Accent placement<select onchange="change('accentArea',this.value)">
      <option value="gable">Gable</option><option value="lower" ${c.accentArea==='lower'?'selected':''}>Lower siding</option>
    </select></label>
    <label>Second siding color<select onchange="change('accentColor',this.value)">
      <option value="">Match main siding</option>${accentOptions}
    </select></label>
    <label>Custom Sherwin-Williams color name or code
      <input maxlength="120" value="${esc(c.customPaint)}" placeholder="Example: SW 7008 Alabaster" oninput="setCatalogText('customPaint',this.value)">
    </label>
  </div>${accentSample(c)}
  <p class="source">The reference model shows the selected main siding. Custom paint and accent finishes are recorded for review.</p></details>`;
}

function accentSample(c) {
  const colors={...paintColors,...stainColors};
  const accent=colors[c.accentColor];
  if (!accent) return '';
  const body=colors[c.color]||paintColors.Blue;
  return `<figure class="accent-sample">
    <svg viewBox="0 0 136 100" width="136" height="100" role="img" aria-label="Siding and accent color placement">
      <path d="M10 40L68 8L126 40Z" fill="${c.accentArea==='lower'?body:accent}"/>
      <path d="M10 40H126V94H10Z" fill="${body}"/>
      ${c.accentArea==='lower'?'<path d="M10 70H126V94H10Z" fill="'+accent+'"/>':''}
      <path d="M55 53H81V94H55Z" fill="white" opacity=".55"/>
      <path d="M10 94V40L68 8L126 40V94Z" fill="none" stroke="#283747" stroke-width="2"/>
    </svg>
    <figcaption>${esc(c.color)} with ${esc(c.accentColor)} · color placement sample</figcaption>
  </figure>`;
}

function includedOpeningsMarkup(c) {
  const openings = packageOpenings(c);
  return openings.length ? '<section class="panel"><h3>Included openings</h3><ul>'+
    openings.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></section>' : '';
}

function startSiteReview() {
  modal('Request a site review', `<p>Save this building configuration for a site review. Site conditions and construction costs need confirmation.</p>
    <div class="fields"><label>Fictional customer<input id="site-customer" value="${esc(S.customer)}" maxlength="120"></label>
    <label>Site notes<textarea id="site-notes" maxlength="500" placeholder="Access, placement, or site preparation"></textarea></label></div>
    ${button('Save site review request','saveSiteReview()')}`);
}

function saveSiteReview() {
  const customer = $('#site-customer').value.trim();
  if (!customer) { toast('Enter a customer for the site review.'); return; }
  const id = 'BEN-'+String(S.sales.length+2041);
  S.sales.push({
    id, customer, c: clone(S.c), total: amount(), path: 'site', lot: null, leadIndex: S.saleLead,
    status: 'Site review requested', fulfillment: 'Awaiting site review',
    siteNotes: $('#site-notes').value.trim(),
    events: [{ text: 'Site review requested · simulation', time: new Date().toLocaleTimeString() }]
  });
  closeModal();
  openSale(id);
}

function siteReviewRecord(s) {
  return head(s.id,esc(s.customer),label(s.c))+
    `<div class="grid2"><section class="panel">${modelMarkup(s.c)}<h2>Requested configuration</h2>
    <p>${included(s.c).map(esc).join(' · ')}</p><p>Building reference estimate · ${money(s.total)}</p>
    ${reviewItemsMarkup(s.c)}</section><section class="panel"><h2>Awaiting site review</h2>
    <p>Site access, preparation, and construction pricing need dealer review.</p>
    <h3>Site notes</h3><p>${esc(s.siteNotes||'No site notes entered.')}</p>
    <p class="source">Simulated request saved in this preview.</p></section></div>`;
}
