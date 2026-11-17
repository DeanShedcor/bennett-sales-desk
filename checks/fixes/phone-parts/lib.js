const { chromium } = require('playwright');
const URL = process.env.URL || 'https://deanshedcor.github.io/bennett-sales-desk/';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
async function open(kind, dsf = 1, extra = {}) {
  const b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext(kind === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: dsf, ...extra } : { viewport: { width: 1360, height: 1000 }, deviceScaleFactor: dsf, ...extra });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await p.goto(URL); await p.waitForTimeout(2000);
  return { b, ctx, p, errs };
}
const SIDES = { sales: 'home', office: 'office', prod: 'prod', qc: 'qc', logi: 'logi' };
const SCREENS = [
  ['home', () => go('home')], ['lot', () => go('lot')], ['unit', () => openUnit(0)], ['start', () => go('start')], ['orders', () => go('orders')], ['sale', () => openSale('AA-20411')], ['performance', () => go('performance')], ['stock', () => go('stock')], ['notes', () => go('notes')],
  ['configure-size', () => { begin(); goStep(steps.indexOf('Size')); }], ['configure-finish', () => goStep(steps.indexOf('Finish'))],
  ['office', () => go('office')], ['of-orders', () => go('of-orders')], ['of-order', () => ofOpen('AA-20411')], ['of-pay', () => go('of-pay')], ['of-requests', () => go('of-requests')], ['of-settings', () => go('of-settings')], ['of-bills', () => go('of-bills')], ['of-users', () => go('of-users')], ['of-prices', () => go('of-prices')], ['of-notes', () => go('of-notes')],
  ['prod', () => go('prod')], ['pr-list', () => go('pr-list')], ['pr-unit', () => prOpen(prUnits().find((u) => u.phase >= 2)?.id)], ['pr-phases', () => go('pr-phases')], ['pr-notes', () => go('pr-notes')],
  ['qc', () => go('qc')], ['qc-rework', () => go('qc-rework')], ['qc-signoff', () => go('qc-signoff')], ['qc-report', () => go('qc-report')], ['qc-changes', () => go('qc-changes')],
  ['logi', () => go('logi')], ['lg-loads', () => go('lg-loads')], ['lg-load', () => lgOpen('AC')], ['lg-cal', () => go('lg-cal')], ['lg-places', () => go('lg-places')], ['lg-fleet', () => go('lg-fleet')], ['lg-drive', () => go('lg-drive')], ['lg-service', () => go('lg-service')], ['lg-notes', () => go('lg-notes')],
];
module.exports = { open, URL, ARGS, SIDES, SCREENS, PICS: process.cwd() + '/pics/', LOOK: process.cwd() + '/look/' };
