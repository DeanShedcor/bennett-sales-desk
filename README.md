# Bennett Sales Desk (v2)

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
