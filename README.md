# Bennett Sales Desk (v2) with ShedCor Plant QC

A rebuilt front end for the Bennett sales preview: configurator, 3D models, quotes, lot sales, orders,
performance and restock. Pricing rules, catalog data and the sale flow are carried over unchanged from the
original preview. Sales, quotes and reviews are simulations.

## Run locally

With Node.js installed:

    node serve.cjs

Then open http://127.0.0.1:4173/

## Host it

Publish this folder with any static web host. Keep the folder structure intact.

## Where things live

- `index.html`: page shell (top bar, phone tab bar)
- `css/app.css`: all styles; colors and fonts are tokens at the top of the file
- `js/core.js`: state, catalog data, pricing, quote and sale flow
- `js/views.js`: screens and layout (home, start a sale, lot, configurator, deal bar, orders)
- `js/catalog-options.js`, `js/model-colors.js`, `js/door-thumbnails.js`, `js/qr.js`: helpers carried over
- `models/`, `door-renderings/`, `window-renderings/`, `roof-thumbnails/`, `electrical/`, `siding/`: assets

## Plant QC side

The switch in the top bar changes between the dealer's Sales desk and the plant's QC side. The QC side is
added alongside the sales code; none of the sales files were changed apart from `index.html`.

- `qc-config.js`: the one file to edit for the QC checklist, defect types, crews, which questions are
  left out for which orders, and which questions do not need a photo
- `qc-sample-data.js`: made-up buildings and rework for the preview
- `qc-app.js`: QC state, the Buildings and Inspect screens, and the links to the sales side (shared
  change orders, sold orders arriving as Ready for QA, QC status written back to the order)
- `qc-screens.js`: Rework queue, Sign-off, Quality report and Change orders
- `qc.css`: styles for the QC side, including the iPhone and iPad app layout
- `thumbs/`: still pictures of the sample buildings' 3D models

Everything on the QC side is kept in memory. Reloading the page resets it.
