# Bennett Sales and QC (preview)

A preview of the salesperson product for a shed company. It shows the layout, the words, the order of
the steps and the click path. It is not the real system.

Live preview: https://deanshedcor.github.io/bennett-sales-desk/

## What it is

One web app with five sides. The switch under the top bar moves between them.

| Side | What people do there |
|---|---|
| Sales desk | Leads, design a building in 3D, quote it, sell it, sign the papers, look up orders, restock the lot |
| Office | Check new orders, payments, sales tax, fuel, requests from the lots, company bills, settings |
| Production | The plant board, loads, each building's steps, materials, plant serial numbers |
| Plant QC | The QC check, photos, rework, the final sign-off |
| Logistics | Build loads, drive time, the calendar, trailers and haulers, the driver's day, the run sheet |

Around the five sides:

- **Users and permissions** (the gear): who can see and change what, by side and by lot.
- **Model pricing** (the gear): one price list, lot prices, drafts, publish on a date, undo.
- **Firefly**: the guide. Tours, a next step, and answers to questions. It can be turned off.
- **Search** (top bar): finds orders, customers, buildings, loads and people from any side.

## What is real and what is pretend

- Every customer, order and person is **made up**. The sample order is for "Morgan Avery".
- **Nothing is saved to a server.** A refresh puts the sample data back. Only small things stay on the
  device: an unfinished sale, Firefly's on or off switch, and a copy of the app for when there is no signal.
- **Signing in is for show.** Anyone with the link can use the gear to view the app as any person.
- The rent-to-own form warns people not to type a real license or Social Security number. It keeps only the
  last 4 digits and the name of the ID photo file. **Keep that warning.**
- Each side has a page that lists what works today, what is still pretend, and the open questions for
  Turbo Assist's builder (top right of the strip under the top bar).

Turbo Assist is the real product: records, permissions, prices and saving live there. This preview decides
how a screen should look and read. Where a button matches something Turbo Assist already does, a short note
in the code names it. Where it does not, the note says it is a feature the product still has to accept.

## Run it on your computer

It is plain HTML, CSS and JavaScript. There is nothing to build or install for the app itself.

With Node.js:

    node serve.cjs

Then open http://127.0.0.1:4173/

Or with Python: `python3 -m http.server 8765`, then open http://localhost:8765/

To put it on the web, publish this folder with any static web host and keep the files together.

## How it is put together

- `index.html` is the page. It lists every style sheet and script, and they load **in that order**.
- Scripts share one set of names: `S` holds the state, `render()` draws the page, `go(page)` changes screen.
- **Newer files load later and wrap the older ones.** A newer file keeps the old function, then replaces it
  with one that calls the old one and adds to it. So the older files need few edits.
- Every file in `index.html` has a number on the end (`app.css?v=20`). **When you change a file, raise its
  number**, or people keep seeing the old one.
- `sw.js` keeps a copy of the app on the device so it opens with no signal. **When you change any file,
  also change the `KEEP` name at the top of `sw.js`.**
- Each screen has its own address after the `#`, so Back works and a link opens the right screen.

### The main files

| Part | Files |
|---|---|
| Start-up, state, prices, sale steps | `core.js`, `views.js`, `prices.js`, `catalog-options.js`, `sale-flow.js`, `order.js`, `order-docs.js` |
| The 3D building and the floor plan | `plan3d.js`, `model-viewer.min.js`, `buildsheet.js`, `electrical-placement.js`, `floorplan-options.js` |
| The lot, leads, restock, performance | `lot.js`, `inventory.js`, `turbo-sales.js`, `sales-polish.js`, `sale-draft.js`, `invoice-totals.js` |
| Office | `office.js`, `turbo-office.js`, `office-guards.js`, `office-link.js`, `office-polish.js` |
| Users, permissions, model pricing | `admin.js` |
| Production | `production.js`, `turbo-plant.js`, `plant-guards.js`, `plant-polish.js` |
| Plant QC | `qc-config.js`, `qc-sample-data.js`, `qc-app.js`, `qc-screens.js` |
| Logistics | `logistics.js`, `logistics-screens.js`, `turbo-logi.js`, `logi-guards.js`, `logi-polish.js`, `drive.js`, `drive-data.js`, `places.js` |
| Shared across sides | `ops-shell.js`, `turbo.js`, `turbo-data.js`, `app-shell.js`, `app-help.js`, `app-words.js`, `phone-sizes.js`, `firefly.js`, `sw.js` |

Style sheets sit beside the scripts they belong to (`office` screens use `ops.css`, `turbo-office.css` and
`admin.css`, and so on). Colors and fonts are set once, at the top of `app.css`.

`qc-config.js` is the one file to edit for the QC checklist, the problem types and the crews.

## Where the numbers come from

- **Prices** are a copy of Turbo Assist's price list (retail prices only). The Model pricing page changes
  them for this preview. No cost, wholesale or pay numbers are in this project.
- **Rent-to-own terms** follow Turbo Assist's terms for 24, 36 and 48 months. The 60-month numbers continue
  the same pattern and still need to be confirmed.
- **Road miles and drive times** between the plant and the lots were looked up once and are stored in
  `drive-data.js`. The app never calls a map service. Map data © OpenStreetMap contributors.
- The last miles to a customer's home are still an estimate.

## The checks

About 1,500 automatic checks click through the app the way a person would. Run them before publishing a
change:

    node checks/run-all.js

See `checks/README.md` for what they need and how to read the result.

## Rules for anyone changing it

1. **This project is public.** Never put a real customer's name, address, phone number, ID or invoice in it.
   Use made-up people only.
2. **Keep the rent-to-own warning** about not typing a real license or Social Security number.
3. **Write for a 5th grade reader.** The people using this build and sell sheds. No computer words. One name
   for each thing on every side (Performance, Locations, Change orders, the office, QC check, Final sign-off,
   rent-to-own).
4. Write dates as "Nov 14", building sizes as "10x16", and payments as "$300 a month".
5. Ask before anything big happens, and give a way to undo it.
6. Buttons on a phone are at least 44 px tall (48 px on the plant sides) and reading text is at least 14 px.
7. Raise the file's `?v=` number and the `KEEP` name in `sw.js` with every change, then run the checks.
