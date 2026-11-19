// shared: make a cash or RTO order through the real forms; returns at the order page (or at the RTO form for RTO)
module.exports = async function mk(p, type, opts = {}) {
  await p.click('button:has-text("Start a sale"):visible'); await p.waitForTimeout(300);
  await p.click('button:has-text("Start configuring")'); await p.waitForTimeout(1800);
  for (let i = 0; i < 7; i++) { await p.evaluate(() => { const y = [...document.querySelectorAll('#ep-card.ask button')].find((b) => /^Yes/.test(b.textContent.trim())); if (y) y.click(); }); await p.locator('button:has-text("Continue"):visible').first().click(); await p.waitForTimeout(350); }
  await p.locator('#app button:has-text("Complete the sale"):visible').first().click(); await p.waitForTimeout(700);
  /* the delivery questions now come first on a custom sale */
  if (await p.locator('#sp-site-miles').count()) { await p.fill('#sp-site-miles', String(opts.miles ?? 20)); await p.check('#sp-site-nogate'); await p.selectOption('#sp-site-access', 'Clear access'); await p.selectOption('#sp-site-ground', 'Level'); await p.click('.modal button:has-text("Continue")'); await p.waitForTimeout(500); }
  for (const [n, v] of Object.entries({ firstName: 'Jamie', lastName: 'Sample', email: 'jamie@example.com', phone: '(843) 555-0199', billingStreet: '12 Test Rd', billingCity: 'Moncks Corner', billingState: 'SC', billingZip: '29461' })) await p.fill(`#customerInfo [name=${n}]`, v);
  await p.click('#customerInfo button[type=submit]'); await p.waitForTimeout(400);
  await p.selectOption('#saleBilling [name=type]', type); await p.waitForTimeout(300);
  if (opts.atBilling) return;
  await p.fill('#saleBilling [name=deposit]', opts.deposit || '552');
  await p.click('#saleBilling button[type=submit]'); await p.waitForTimeout(500);
  if (opts.atReview) return;
  await p.click('.modal button:has-text("Create the order")'); await p.waitForTimeout(800);
};
