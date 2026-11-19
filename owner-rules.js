/* owner-rules.js: where the owner's rule and Turbo Assist's knowledge base disagree.

   Barns and roll-up doors. Turbo Assist's "Roof Styles and Height / Door Rules" article says no
   roll-up or garage door on a barn. The owner says barns can have them (Nov 2026), so Sales and
   Plant no longer block or warn (turbo-sales.js, turbo-plant.js). The article is copied from Turbo
   Assist and is left as written; it is flagged here so anyone who reads it sees the owner's rule.
   Loaded late, after turbo-data.js and app-words.js. */
{
  try {
    const a = TA_KB.find((x) => x.id === 'roof-rules');
    if (a) a.flag = 'The owner says a barn can have a roll-up or garage door. This article still says no. It needs to be updated in Turbo Assist.';
  } catch (e) {}
  try {
    AW_REAL.sales.push('The roof (metal or shingles) is picked on the Exterior step, before Colors.');
    AW_OPEN.push(['Roll-up doors on barns', 'Turbo Assist says no roll-up on barns; the owner says barns can have them. This preview follows the owner. The article needs updating.']);
    AW_OPEN.push(['Shingle colors', 'The price list has no list of shingle colors. With a shingle roof, the Colors step says the color is written on the order.']);
  } catch (e) {}
}
