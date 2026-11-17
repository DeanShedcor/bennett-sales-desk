# The checks

These are small programs that open the app in a hidden browser and use it the way a person would. They
click the buttons, fill in the forms and read what the screen says. Each one prints a line for every
thing it looked at.

They use only the made-up sample data that comes with the app. They never save anything and never
touch a real customer.

The app does not load this folder. It is here so the checks are not lost and anyone can run them.

## What you need

- Node.js
- Playwright with its Chromium browser: `npm install playwright` then `npx playwright install chromium`
- For one check (printing, in `fixes/15-…`): Python 3 with the Pillow package

## Run them

From the project folder:

    node checks/run-all.js

That starts a copy of the app on your computer, runs every check one after another, and stops the copy.
It takes about 45 minutes to an hour.

To check a site that is already up, for example the live preview:

    node checks/run-all.js https://deanshedcor.github.io/bennett-sales-desk/

To run only some of them, give part of a name:

    node checks/run-all.js --only office

To run one check by itself, give it the address:

    node checks/fixes/01-invoice-lock.js http://localhost:8765/

## How to read the result

One line for each check:

    ok    Office                                   80 passed    0 failed  212s
    FAIL  Logistics                               151 passed    1 failed  340s
            FAIL Trailer cards show the day's miles

- **passed** means the screen did what the check expected.
- **failed** means it did not. The lines under it say what was expected.
- **page errors** means the browser reported a fault while the check ran.

The last line gives the totals. If every check passed, the run ends with code 0. If anything failed, it ends
with code 1.

A failed check is not always a fault in the app. If you changed a word or moved a button on purpose, the
check may still expect the old one. Change the check to match, in the same change.

## What is in here

| File | What it checks |
|---|---|
| `every-screen.js` | Every screen opens at four widths with no sideways scrolling |
| `full-sale.js` | One whole sale from the desk to delivery, cash or rent-to-own |
| `sales-desk.js` | Leads, the checklist, the designer, the price list, rent-to-own math |
| `answers-and-bell.js` | Answers, the bell and the top bar (a walk-through: it reports faults only) |
| `users-and-pricing.js` | Users, permissions, model pricing, drafts and publishing |
| `lot-limits.js` | A person limited to some lots sees only those lots |
| `office.js` | The Office side |
| `office-and-logistics-paths.js` | Less common Office and Logistics paths (a walk-through) |
| `production.js`, `production-loads.js` | The plant board and loads (walk-throughs) |
| `plant.js` | Production and Plant QC |
| `logistics.js` | The Logistics side |
| `drive-time.js` | Drive time and the stored road miles |
| `firefly.js` | Firefly, the guide |
| `phone.js` | The five sides on a phone (a walk-through) |
| `fixes/01-…` to `fixes/19-…` | One file for each batch of fixes from the November 2026 review |
| `helpers/`, `fixes/phone-parts/`, `fixes/ink.py` | Small pieces the checks share |

Pictures and other files a check writes go in `checks/out/`, which is not saved with the project.
