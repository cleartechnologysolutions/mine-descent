// One additional cannon family enters the salvage pool in each mine.
export const CANNONS = [
  {id:'pulse',name:'Pulse Cannon',level:0,color:0x8affed,description:'Reliable pulse fire · unlimited ammunition',ammoName:'UNLIMITED',capacity:0,pack:0,initial:0,interval:.14,heat:5,damage:20,speed:160,spaceSpeed:330,size:[.12,.12,.85],sound:'laser',kick:.024},
  {id:'breach',name:'Breach Cannon',level:1,color:0xffb35f,description:'Five-shot spread · devastating at close range',ammoName:'SHELLS',capacity:96,pack:12,initial:24,interval:.55,heat:12,damage:17,speed:180,spaceSpeed:350,size:[.16,.16,.7],sound:'breach',kick:.09},
  {id:'vulcan',name:'Vulcan Cannon',level:2,color:0xf3ed9a,description:'Rapid armor-piercing rounds · fast, precise fire',ammoName:'ROUNDS',capacity:360,pack:60,initial:120,interval:.075,heat:3.2,damage:25,speed:300,spaceSpeed:560,size:[.10,.10,1.5],sound:'vulcan',kick:.032},
  {id:'siege',name:'Siege Cannon',level:3,color:0xc99aff,description:'Heavy plasma · explosive impact',ammoName:'PLASMA CELLS',capacity:60,pack:8,initial:16,interval:.65,heat:18,damage:95,speed:125,spaceSpeed:260,size:[.38,.38,1.2],sound:'siege',kick:.14,splash:40,splashRadius:9}
];
export const cannonById=id=>CANNONS.find(w=>w.id===id);
export function cleanArsenal(value){
  const owned=CANNONS.filter(w=>w.id==='pulse'||(Array.isArray(value?.owned)&&value.owned.includes(w.id))).map(w=>w.id);
  const ammo=Object.fromEntries(CANNONS.filter(w=>w.level).map(w=>[w.id,Number.isFinite(value?.ammo?.[w.id])?Math.max(0,Math.min(w.capacity,Math.floor(value.ammo[w.id]))):0]));
  return {owned,ammo,equipped:owned.includes(value?.equipped)?value.equipped:'pulse'};
}
