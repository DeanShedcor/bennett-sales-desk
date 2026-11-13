/* hero-reality.js: the home hero shows our model becoming the real building.
   The building in the photo is drawn first as a plan (lines), fills in as our 3D model (drawn by
   plan3d.js from a 12 × 28 Deluxe Porch, Origami White with black trim and roof, camera matched to the
   photo), then sweeps across into the photo itself. The oak and the field stay put the whole time.
   It plays once when the page opens; "Watch it become real" plays it again. With reduced motion turned
   on in the device settings, the photo shows straight away. Loaded last; wraps heroScene. */
let HR_PLAYED = false;
{
  const salesHero = heroScene;
  heroScene = function () {
    const html = salesHero(), done = HR_PLAYED;
    HR_PLAYED = true;
    return html
      .replace('<img class="shed-hero"', `<img class="shed-hero hr-open" src="./shed-hero-open.webp" alt="" aria-hidden="true">
    <img class="shed-hero hr-plan" src="./hero-plan.webp" alt="" aria-hidden="true">
    <img class="shed-hero hr-model" src="./hero-model.webp" alt="" aria-hidden="true">
    <span class="hr-sweep" aria-hidden="true"></span>
    <img class="shed-hero hr-photo"`)
      .replace('<div class="scene">', `<div class="scene hr${done ? ' hr-done' : ''}">`)
      .replace(/<\/div>\s*$/, `<button type="button" class="hr-replay" onclick="hrReplay(this)">${icon('rotate', 14)} Watch it become real</button></div>`);
  };
}
function hrReplay(btn) {
  const scene = btn.closest('.scene');
  scene.classList.remove('hr-done');
  scene.classList.remove('hr');
  void scene.offsetWidth;
  scene.classList.add('hr');
}
/* The home page is first drawn before this file loads; draw it again so the hero plays. */
if (S.page === 'home') render();
