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

/* Extra listing photos per listing id, after the main photo.
   e/ stands for ecommerce-settings/ and i/ for inventory-photos/. */
const LOT_PHOTOS = Object.fromEntries(
  String.raw`
375168=i/89c6e5ea-f3fc-44e4-93d3-c95a868071ae.jpeg,i/35e7e332-240a-418a-8085-622dad44f689.jpeg,i/7ed0c8f8-b857-43db-9637-7ddc771295d5.jpeg
426270=i/9d1bffa8-788a-4eac-abc2-defb5189dac6.jpg,i/9d1bffa8-788a-4eac-abc2-defb5189dac6.jpg,i/5c2f09f7-f100-4913-b8b4-6cd6d3e33a63.jpg,i/e948fb43-9271-4823-8406-2ac775451bb5.jpg
440074=e/b8038bed-e350-44bc-9af4-b8d498f38e34.jpg,i/16d63d51-2017-4017-8610-e41130791d4a.jpeg
441864=i/be1e6c97-95b4-40c3-ae37-c80d2946bdaa.jpeg,i/ffaa0b7c-5420-49ae-9735-5a97c5d42581.jpeg,i/cdc34982-8dcc-48aa-84d0-b151a1bbd261.jpeg,i/31126589-e6e2-4121-a219-16afac6dce37.jpeg
443517=e/3c46b4ca-81cd-4634-9c26-376f841440fc.jpg,e/a297dc9a-87dd-4c62-b6a6-e7c11cf6ab8c.jpg,i/f9bb7299-82b6-40cb-9480-c5a683e82218.jpeg
443639=e/9678221c-42da-4f8b-bd37-b16f09aaae0d.jpg,i/b84d1b44-83c2-4cda-a7bc-fceed1a6247f.jpeg,e/0760cbc9-f6b2-4e77-9522-387654007eb8.jpg
452268=e/20244032-538d-4d2c-84b1-77fcb64d001d.jpg,e/acb73bb3-a128-471b-a490-c643d658f220.jpg,e/7b380935-4a15-4420-95b7-2fdbb981faaa.jpg,i/ac7870a7-2154-47e8-8444-1d407f2dba8f.jpeg
477276=e/225e72d1-2dc7-4b67-b7dc-c7b27d10cdcd.jpg,i/88e9fd0e-52e5-46f4-b4e7-daee42b1e7e9.jpeg,e/08a1172c-d49d-4fa3-a00a-0a22f03ff232.jpg,i/0229a8c5-7e2f-4266-903d-aac0386f9d31.jpeg
485273=i/7ba5b141-5e0b-4dd0-a543-4aec5700aad2.jpeg,e/6c7a4676-0aa9-43a0-ba0e-194fe4bc9630.jpg,e/74e3e75b-51b2-4a68-a2e8-6e00a9dd96c1.jpg,e/a33d6272-106a-45ec-baed-778bcf7fceca.jpg,e/a74b794d-71cc-46b7-a611-8125a9625b5f.jpg,i/a4cc2dde-9ff0-4d7c-b925-4362abd6791d.jpeg
519111=e/2a73c8b7-7c2f-4194-83e8-f32ed6e34e53.jpg,e/d64742e0-cec2-4d7e-9014-d2ede2383122.jpg,e/a693ecf4-543e-4b62-aea0-5468052f7c6b.jpg,i/28ad01d9-c381-460f-a1fc-898a0307a001.jpg
539292=e/e4354f3b-2561-4bed-b17f-4169b4dd5111.jpg,e/728b05a1-0cb2-46c0-af83-2be3be875747.jpg,i/9ac08cd3-d63c-4865-942e-e0e3c0cf7197.jpg
539293=e/13b9f27a-5d1c-47ca-b5ca-3f9bc6e9b607.jpg,e/37884c03-7ca1-4b9e-8c79-9734523a5f27.jpg,e/62656bc5-e680-402b-be13-7dc3f872d7b5.jpg
544579=e/bbf85baa-f93b-4552-87e7-b7a17554bbf6.jpg,e/a1ecce4c-c248-4090-b34a-f4bb2de3f1ed.jpg,e/d9e80ef4-e1c0-4d3f-a00e-d2bbce23a568.jpg
544631=e/675333b0-0833-460b-aa45-770c8dcf8069.jpg,e/e089a196-9779-4a8b-a25e-1f07e29323df.jpg
552380=e/13ba8243-c251-44f7-97e1-d8f7590a244f.jpg,e/0802cb6f-4626-465b-b8fc-ccb13656df21.jpg,i/82168056-20fe-4c0c-94f0-71e1c407c0e2.jpg,i/bbbedaff-0b76-4913-a6ce-ed14100cb215.jpg
553773=
556813=e/cd6a4bc2-d64f-48d8-b96e-ca84275dc864.jpg,e/fa4185ad-3f36-4f05-a050-9e5c9739d969.jpg,i/4c6c8520-9e96-412a-a59f-0ff88408778a.jpg
`
    .trim()
    .split('\n')
    .map((line) => {
      const [id, list] = line.split('=');
      return [id, list ? list.split(',').map((p) => p.replace(/^e\//, 'ecommerce-settings/').replace(/^i\//, 'inventory-photos/')) : []];
    })
);

/* Turn one listing line into a lot unit. `c` is the closest configurator setup, used for the
   3D reference model, the series label and payment estimates. */
function unitFromListing(line) {
  const [listingId, title, w, l, model, price, sale, , down, serial, condition, , colorText, optionText, photo] = line.split('|');
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
  /* A sale price below the list price puts the building on sale. */
  const salePrice = Number(sale) > 0 && Number(sale) < Number(price) ? Number(sale) : null;
  return {
    id: serial,
    listingId,
    name: title,
    price: salePrice || Number(price),
    listPrice: salePrice ? Number(price) : null,
    down: Number(down),
    condition,
    location: LOT_LOCATION,
    source: 'buybennett.com listing · copied ' + LOT_LISTING_DATE,
    url: 'https://shedcor.shedsuite.com/3946/shop-inventory/' + listingId,
    photo: LOT_PHOTO_HOST + photo,
    photos: [...new Set([photo, ...(LOT_PHOTOS[listingId] || [])])].map((p) => LOT_PHOTO_HOST + p),
    colors: { siding, trim: colors.trim, roof: colors.roof },
    features: features.map((f) => f.text + (f.count > 1 ? ' x' + f.count : '')),
    status: 'Available',
    c
  };
}
