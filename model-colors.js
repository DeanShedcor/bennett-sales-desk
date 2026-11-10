function whiteOnlyDoor(value){return /^36(?:["″]|\s*(?:inch|in\b))/i.test(value||'')||/roll[ -]?up|garage/i.test(value||'');}
function allDoorsWhiteOnly(c){return [c.door,...(c.extraDoors||[])].every(whiteOnlyDoor);}
// Use each viewer's own configuration, including saved quotes and style cards.
function applyModelColors(viewer) {
 if(!viewer.model)return;
 const c=JSON.parse(viewer.dataset.finishConfig||'{}');
 const paints={White:'#ffffff',...paintColors,...stainColors,Sage:paintColors['Sage Green'],Slate:paintColors['Web Grey']};
 const siding=c.style==='Silver Bullet'?{...bulletStandard,...bulletPremium,Galvalume:metalRoofColors.Galvalume}:paints;
 const body=siding[c.color]||paints.Blue;
 const trim=paints[c.trimColor]||paints['Origami White'];
 const door=whiteOnlyDoor(c.door)?'#ffffff':paints[c.doorColor]||body;
 const doorTrim=paints[c.doorTrimColor]||trim;
 const roof=metalRoofColors[c.roofColor]||metalRoofColors.Charcoal;
 for(const material of viewer.model.materials){
  if(!material.isLoaded)continue;
  let hex;
  switch(material.name){
   case 'Painted wood siding':case 'Painted galvanized siding':case 'Stained staggered shake siding':hex=body;break;
   case 'Painted trim':hex=trim;break;
   case 'Door panels':hex=door;break;
   case '36-inch white door':case 'White garage door':hex='#ffffff';break;
   case 'Door trim':hex=doorTrim;break;
   case 'Painted steel roof':case 'Architectural asphalt shingles':case 'Roof seams and flashing':case 'Roof-matched seams and hardware':case 'Roof edge flashing':
    if(c.style!=='Greenhouse'&&c.roof!=='Shingles')hex=roof;
    break;
  }
  if(hex)material.pbrMetallicRoughness.setBaseColorFactor(hex);
 }
}
function updateModelColors(viewer,c){
 viewer.dataset.finishConfig=JSON.stringify(c);
 applyModelColors(viewer);
}
