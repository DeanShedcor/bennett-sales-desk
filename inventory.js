/* inventory.js: buildings on the lot, copied from the Moncks Corner listing on buybennett.com.
   One line per building:
   listing id | title | width | length | model | price | sale price | base price | down payment |
   serial | condition | status | colors | options | photo
   To refresh the lot, replace the lines inside LOT_LISTING and update LOT_LISTING_DATE. */
const LOT_LOCATION = 'Moncks Corner';
const LOT_STATE = 'SC';
const LOT_LISTING_DATE = 'Nov 10, 2026';
const LOT_PHOTO_HOST = 'https://shed-suite.appspot.com.storage.googleapis.com/';
const LOT_LISTING = String.raw`
441864|10 x 12 Silver Bullet with Vertical Steel Siding and Basic Electrical|10|12|Silver Bullet (No Package)|4105||3900|410.5|SB-UT-NP-1012-080125-051255|new|for-sale|roof:Galvalume;siding:Galvalume;trim:Black|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);6x6 Rollup Door (incl);Left Door Handle (incl)|ecommerce-settings/7cd3fcf0-8c1c-40e1-9276-d05b67e7e537.jpg
426270|10 x 12 Steel Utility with 6x6 Roll Door, Basic Electrical|10|12|Silver Bullet (No Package)|4105||3900|410.5|SB-UT-NP-1012-060125-023923|new|for-sale|roof:Galvalume;siding:Galvalume;trim:Black|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);Left Door Handle (incl);6x6 Rollup Door (incl)|inventory-photos/709f6abe-3fb6-4e9f-a740-8bd1bcc3b577.jpg
452268|10 x 12 Tall Wall Steel Utility with 6x7 Roll Door and Basic Electrical|10|12|Silver Bullet (No Package)|4375||3900|437.5|SB-UT-NP-1012-091225-052400|new|for-sale|roof:Black;siding:Color Siding;trim:Black|Gallery Blue -  Standard Siding Color (incl);7 ft High Wall (incl);Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);6x6 Rollup Door (incl);Left Door Handle (incl)|ecommerce-settings/ab676850-56f8-4cea-be54-da691dd605bb.jpg
443517|10 x 16 Basic Series Utility with 8' Dormer Package|10|16|Basic Utility (No Package)|6628||5158|662.8|BS-UT-NP-1016-080825-051462|new|for-sale|roof:White;siding:Clay;trim:Origami White|8ft Dormer Package (transom double door, 2 2x3 windows w/3 board shutters) (incl);Transom Single Door - White Transom (incl);2x3 Window - White x2 (incl);Transom Double Door - REMOVE (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/e233cfe4-1ac9-4bd4-804a-a99785656718.jpg
539293|10 x 16 Classic Lofted Barn with Basic Electrical|10|16|Classic Lofted (No Package)|6483||5870|648.3|CL-LB-NP-1016-081526-059379|new|for-sale|roof:Black;siding:Alpine Grey;trim:Black|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);Front & Back Loft - 4 ft Sections (incl);Door Trim - Alpine Grey (incl);2x3 Window - Black x2 (incl);Transom Double Door - Black Transom (incl);Double Shed Door - REMOVE (incl);Fuel Surcharge (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/ddd9e49d-ff7a-4db1-bf1b-438a8aff2a7e.jpg
539292|10x16 Classic Utility with Radiant Heat Barrier and Basic Plug-In Power|10|16|Classic Utility (No Package)|5966||5503|596.6|CL-UT-NP-1016-081526-059378|new|for-sale|roof:Black;siding:Sage Green;trim:Butternut - Stain|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);2x3 Window - Black x2 (incl);Fuel Surcharge (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/9fa475b3-ba46-4fc2-9d41-033a619a54b4.jpg
440074|10 x 16 Classic Utility with Radiant Heat Barrier & Basic Electric|10|16|Classic Utility (No Package)|5813||5503|581.3|CL-UT-NP-1016-072525-051101|new|for-sale|roof:Galvalume;siding:Dovetail Grey;trim:Origami White|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);2x3 Window - White (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/961a01cf-cfb9-4287-b768-9726a41eed32.jpg
556813|10 x 20 Dual Entry Classic Lofted Barn with Radiant Heat Barrier|10|20|Classic Lofted (No Package)|7352||7063|735.2|CL-LB-NP-1020-102226-060761|new|for-sale|roof:Black;siding:Dovetail Grey;trim:Origami White|Basic Electrical Package (Pigtail,1 light switch, 1 light w/bulb, 1 outlet) (incl);2x3 Window - Black x2 (incl);Single Wood Door (incl);Fuel Surcharge (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/cf15eae7-6d80-4507-b947-2de736aabe5f.jpg
552380|10x24 Classic Series Utility with 12' Dormer, Radiant Barrier, Expanded Electrical|10|24|Classic Utility (No Package)|9864||7678|986.4|CL-UT-NP-1024-100326-060352|new|for-sale|roof:Black;siding:Black;trim:Origami White|Transom Single Door - Black Transom (incl);Shutter Color - Chestnut Stain (incl);Double Shed Door (incl);2x3 Window - Black (incl);12ft Dormer Package (transom double door, 2 3x3 windows w/3 board shutters) (incl);Expanded Electrical Package (Pigtail, 1 light switch, 1 light w/bulb, 3 outlets) (incl);Deluxe Vent x2 (incl);Accent Door Color - Chestnut Brown Stain (incl);Transom Window - Black x2 (incl);Fuel Surcharge (incl)|ecommerce-settings/9938ea5b-300a-4a22-88c5-7e389680e317.jpg
485273|12 x 20 Classic Lofted Side Porch, Radiant Barrier, 8' Loft, Expanded Electrical|12|20|Classic Lofted (No Package)|9717||7902|971.7|CL-LB-NP-1220-013026-055044|new|for-sale|roof:Charcoal;siding:Alpine Grey;trim:Origami White|8' Front Loft (incl);Expanded Electrical Package (Pigtail, 1 light switch, 1 light w/bulb, 3 outlets) (incl);Side Porch Package - Left (36" 9 lite door, 3 2x3 windows) (incl);Deluxe Vent x2 (incl);Double Shed Door (incl)|ecommerce-settings/67046ec1-1946-4dfd-8adf-0d35fd21cd30.jpg
519111|12x20 Classic Series Utility with Radiant Barrier and Expanded Electrical|12|20|Classic Utility (No Package)|8589||7452|858.9|CL-UT-NP-1220-052926-057677|new|for-sale|roof:Black;siding:Web Grey;trim:Dovetail Grey|Double Shed Door (incl);Expanded Electrical Package (Pigtail, 1 light switch, 1 light w/bulb, 3 outlets) (incl);Deluxe Vent x2 (incl);Double Shed Door - REMOVE (incl);Double Accent Door - Alpine Grey (incl);2x3 Window - White x4 (incl);Fuel Surcharge (incl);Transom Double Door - White Transom (incl);Accent Gable - Blue (incl)|ecommerce-settings/c4057ae6-f7ce-4dd0-9edc-0d52531497a7.jpg
477276|12 x 20 HOA Friendly Elite Series Utility with Shingled Roof|12|20|Elite Utility (No Package)|8737||8262|873.7|EL-UT-NP-1220-122625-054406|new|for-sale|roof:Hickory;siding:Clay;trim:Clay|Utility $$0.00;Floor Joist: 2x6 - 16 inch OC $$0.00;Roof Material: Architectural Shingles $$375.00;Deluxe Vent $$0.00;Deluxe Vent $$0.00;Double Shed Door ( right wall - Color: Clay ) $$0.00;Siding: LP Smartside 8 inch Lap with 7/16 inch Tech Shield $$0.00;Shingle Delivery - Tarp $$100.00|ecommerce-settings/e78848b6-1fa8-4acb-8618-11e6909c0a49.jpg
544631|8 x 10 Basic Series Studio Shed|8|10|Basic Studio (No Package)|3644||3460|364.4|BS-ST-NP-0810-082826-059603|new|for-sale|roof:Black;siding:Brown;trim:Black|Utility $$0.00;Flooring: 3/4 inch Tongue & Groove $$0.00;Floor Joist: 2x4 - 16 inch OC $$0.00;Roof Material: Metal $$0.00;Transom Horizontal ( left wall - Color: Black ) $$80.00;Transom Horizontal ( left wall - Color: Black ) $$80.00;Shed Door ( back wall - Color: Brown ) $$0.00;Siding: LP 3/8 inch 8 inch OC Groove $$0.00;Fuel Surcharge $$24.00|ecommerce-settings/369427a2-2ee7-4618-a9ed-17badd78b099.jpg
443639|8 x 8 Classic Utility with Radiant Barrier and 4' Door|8|8|Classic Utility (No Package)|3455||3455|345.5|CL-UT-NP-0808-080825-051491|new|for-sale|roof:Charcoal;siding:Sage Green;trim:Origami White|Single Shed Door (incl);Deluxe Vent x2 (incl)|ecommerce-settings/432b6f5a-877b-4d94-885a-0c257b7cb449.jpg
544579|Pre-Owned 10x16 Classic Utility|10|16|Classic Utility (No Package)|5042||5503|504.2|51851R|used|for-sale|roof:Black;siding:Web Grey;trim:Origami White|Discount $-$461.00|ecommerce-settings/3f7a5772-16ab-4b8a-bdc5-681da27d6326.jpg
375168|REDUCED! 12 x 32 Classic Utility with Full Side Porch -Save Over $1100!|12|32|Classic Utility (No Package)|15900||10577|1590|CL-UT-NP-1232-110124-019264|new|for-sale|roof:Black;siding:Dovetail Grey;trim:Origami White|9-Lite French Door (incl);Double Shed Door (incl);Shutter - Black x2 (incl);Utility Electrical Package (100 amp capacity, 1 expandable breaker box, 1 breaker, 1 light switch, 1 light w/bulb, 3 outlets) (incl);2x3 Window - Black x4 (incl);Full Side Porch Railing - Standard (incl);Deluxe Vent x2 (incl);Double Shed Door - REMOVE (incl);Full Side Porch - Per Linear Foot x32 (incl);Price reduction per Wendy $-$1,102.00|ecommerce-settings/1ad69e1c-b4ab-4a3b-898d-62f53a87d839.jpg
553773|Used 8x12 Elite Series Utility Shed|8|12|Elite Utility (No Package)|3971.2||4147|397.12|51850R|used|for-sale|roof:Black;siding:Clay;trim:Origami White||ecommerce-settings/b4e789bc-49f4-4f5c-b68a-070740bd59ba.jpg
`;

/* Turn one listing line into a lot unit. `c` is the closest configurator setup, used for the
   3D reference model, the series label and payment estimates. */
function unitFromListing(line) {
  const [listingId, title, w, l, model, price, , , down, serial, condition, , colorText, optionText, photo] = line.split('|');
  const colors = Object.fromEntries(colorText.split(';').map((c) => c.split(':')));
  const options = optionText ? optionText.split(';') : [];
  const has = (re) => options.some((o) => re.test(o));
  const metal = /^Silver Bullet/.test(model);
  const style = metal ? 'Silver Bullet' : /Lofted/.test(model) ? 'Lofted' : /Studio/.test(model) ? 'Studio' : 'Utility';
  const metalColor = (optionText.match(/(\w+ \w+) -\s+Standard Siding Color/) || [])[1];
  const siding = colors.siding === 'Color Siding' ? metalColor || 'Galvalume' : colors.siding;
  const shingles = has(/Architectural Shingles/);
  const dormer = options.map((o) => o.match(/^(\d+)ft Dormer Package/)).find(Boolean);
  const sidePorch = options.map((o) => o.match(/^Side Porch Package - (Left|Right)/)).find(Boolean);
  const windows = options.reduce((n, o) => {
    const m = o.match(/^2x3 Window.*?(?: x(\d+))? \(incl\)$/);
    return m ? n + Number(m[1] || 1) : n;
  }, 0);
  const c = {
    ...defaults,
    style,
    size: w + 'x' + l,
    siding: metal ? 'Metal' : /^Elite/.test(model) ? 'Lap' : 'Basic groove',
    shield: /^Classic/.test(model),
    color: siding,
    trimColor: colors.trim.replace(' - Stain', ''),
    roof: shingles ? 'Shingles' : 'Metal',
    roofColor: shingles ? undefined : colors.roof,
    windows,
    shutters: has(/shutter/i),
    door: has(/^Single (Shed|Wood) Door/) && !has(/^Double Shed Door \(incl\)/) ? 'Single' : 'Double',
    electrical: (optionText.match(/(Basic|Expanded|Utility) Electrical Package/) || [0, 'None'])[1]
  };
  if (dormer) Object.assign(c, { package: 'Dormer Package', dormerLength: Number(dormer[1]) });
  else if (sidePorch) Object.assign(c, { package: 'Side Porch', porchSide: sidePorch[1] });

  const features = [];
  for (const raw of options) {
    if (/REMOVE|Fuel Surcharge|^Utility \$|Discount|Price reduction|Shingle Delivery/.test(raw)) continue;
    const text = raw.replace(/ \(incl\)$/, '').replace(/ \$\$?-?[\d,.]+$/, '').replace(/\s+/g, ' ').trim();
    const found = features.find((f) => f.text === text);
    if (found) found.count++;
    else features.push({ text, count: 1 });
  }
  return {
    id: serial,
    listingId,
    name: title,
    price: Number(price),
    down: Number(down),
    condition,
    location: LOT_LOCATION,
    source: 'buybennett.com listing · copied ' + LOT_LISTING_DATE,
    url: 'https://shedcor.shedsuite.com/3946/shop-inventory/' + listingId,
    photo: LOT_PHOTO_HOST + photo,
    colors: { siding, trim: colors.trim, roof: colors.roof },
    features: features.map((f) => f.text + (f.count > 1 ? ' x' + f.count : '')),
    status: 'Available',
    c
  };
}
