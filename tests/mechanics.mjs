import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const windowEvents=new Map(),documentEvents=new Map();
const register=(registry,n,f)=>{if(!registry.has(n))registry.set(n,[]);registry.get(n).push(f);};
function dispatch(registry,n,values={}){const event={repeat:false,ctrlKey:false,metaKey:false,altKey:false,prevented:false,preventDefault(){this.prevented=true;},target:document.getElementById('game'),...values};for(const fn of registry.get(n)||[])fn(event);return event;}
let pointerLockRequests=0;
class Element{constructor(id){this.id=id;this.hidden=false;this.style={};this.value=id==='difficulty'?'normal':id==='sensitivity'?'80':'65';this.children=[];this.checked=false;this.events={};}addEventListener(n,f){this.events[n]=f;}focus(){document.activeElement=this;}getContext(){return new Proxy({},{get:()=>()=>{}});}replaceChildren(){this.children=[];}append(e){this.children.push(e);}requestPointerLock(){pointerLockRequests++;throw new Error('Mouse capture must never be requested');}}
const elements=new Map();globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},createElement:()=>new Element('new'),addEventListener(n,f){register(documentEvents,n,f);},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;}};
globalThis.window=globalThis;globalThis.addEventListener=(n,f)=>register(windowEvents,n,f);globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.devicePixelRatio=1;globalThis.requestAnimationFrame=()=>{};const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.VoidAudio=class{start(){return Promise.resolve(true);}update(state){this.lastState={...this.lastState,...state};}setVolume(){}setMuted(){}pause(){}sounds=[];sfx(name,pan,volume){this.sounds.push({name,pan,volume});}music(){}};
globalThis.MockRenderer=class{shadowMap={};capabilities={getMaxAnisotropy:()=>1};info={render:{}};setSize(){}setPixelRatio(){}render(scene){scene.updateMatrixWorld(true);}};
let source=fs.readFileSync(root+'/src/game.js','utf8').replace("'/three.module.min.js'",JSON.stringify('file://'+root+'/src/vendor/three.module.js')).replace("'/art.js'",JSON.stringify('file://'+root+'/src/art.js')).replace("'/robots.js'",JSON.stringify('file://'+root+'/src/robots.js')).replace("'/layouts.js'",JSON.stringify('file://'+root+'/src/layouts.js')).replace("'/weapons.js'",JSON.stringify('file://'+root+'/src/weapons.js')).replace('new T.WebGLRenderer','new globalThis.MockRenderer');
source+='\nexport {T,scene,player,keys,makeMine,makeSpace,beginNew,restore,refill,allowed,pointInside,pathTo,visible,segmentDistance,movePlayer,updateShots,update,fire,damage,destroyReactor,enemyHit,interactSpace,objectiveTarget,readCheckpoint,saveCheckpoint,pauseGame,resumePlay,maxShield,openUpgrade,closeUpgrade,spawnPickup,createShot,makeMineLayout,updateDoors,positionDoor,updateExploration,hitGenerator,updateReactorShield,updateEnemies,drawMap,drawSteering,sphereEntry,updatePickups,updateHUD,browseCannon,selectCannon,CANNONS,cleanArsenal,updateCannonCooling,reactorProximity,reactorSignal,dropEnemySupplies,audio,art};\nexport const state=()=>({mode,zone,mine,nextMine,stage,enemies,shots,particles,walls,rooms,links,reactor,doors,generators,visitedRooms,mineLayout,coreFound,hasReactorKey,gateSeen,wingEntered,currentRoom,pendingUpgrades,score,salvage,upgrades,pickups,spaceObjects,checkpoint,arsenal,browsedCannon,browseUntil,fireWait,overheated,cannonBurst,cannonRecovery});\nexport function configure(values){if(values.mode)mode=values.mode;if(values.nextMine!==undefined)nextMine=values.nextMine;if(values.stage)stage=values.stage;if(values.upgrades)upgrades=values.upgrades;if(values.fireWait!==undefined)fireWait=values.fireWait;if(values.pendingUpgrades!==undefined)pendingUpgrades=values.pendingUpgrades;}\n';
const testModule=(await import('node:os')).tmpdir()+'/voidbreak-game-under-test-'+process.pid+'.mjs';fs.writeFileSync(testModule,source);const g=await import('file://'+testModule+'?t='+Date.now());const vec=(...a)=>new g.T.Vector3(...a);let count=0;function check(label,fn){fn();count++;console.log('PASS '+label);}
g.beginNew();g.scene.updateMatrixWorld(true);
check('new campaign initializes playable mine with valid spawn and security',()=>{assert.equal(g.state().mode,'play');assert.equal(g.state().zone,'mine');assert(g.allowed(g.player.pos));assert.equal(g.state().enemies.length,24);});
for(let level=0;level<3;level++){
 g.makeMine(level);g.configure({mode:'play'});g.scene.updateMatrixWorld(true);
 check('mine '+level+' has a larger connected network and a deeply placed reactor',()=>{
  const {rooms,links,reactor}=g.state();assert.equal(rooms.length,[18,24,30][level]);assert(g.pathTo(0,reactor.room).length>=[10,12,14][level]);assert(links.length>=rooms.length);
  for(let i=0;i<rooms.length;i++)assert.equal(g.pathTo(0,i).at(-1),i);
  for(const [a,b]of links)assert.equal(rooms[a].distanceTo(rooms[b]),50);
 });
 check('mine '+level+' has distinct local room identities and a single gated wing',()=>{
  const {mineLayout:l,rooms,links,pickups,doors}=g.state();
  assert.equal(l.roomIdentity.length,rooms.length);assert.equal(new Set(l.roomIdentity.map(r=>r.name)).size,rooms.length);
  for(const [a,b]of links)assert.notEqual(l.roomIdentity[a].theme,l.roomIdentity[b].theme);
  const gates=doors.filter(d=>d.security);assert.equal(gates.length,1);assert(gates[0].locked);
  const outer=new Set([0]),queue=[0];for(const i of queue)for(const [a,b]of links){if(l.reactorGate.includes(a)&&l.reactorGate.includes(b))continue;const next=a===i?b:b===i?a:-1;if(next>=0&&!outer.has(next)){outer.add(next);queue.push(next);}}
  assert(outer.has(l.keyRoom));assert(!outer.has(l.coreRoom));assert.deepEqual(rooms.flatMap((_,i)=>outer.has(i)?[]:[i]),l.reactorWing);
  assert(l.reactorWing.length>=8);assert.equal(links.filter(([a,b])=>outer.has(a)!==outer.has(b)).length,1);
  const key=pickups.filter(p=>p.type==='reactorKey');assert.equal(key.length,1);assert(key[0].mesh.position.distanceTo(rooms[l.keyRoom])<10);
  const cells=pickups.filter(p=>p.type==='shield');assert.equal(cells.length,2);assert(cells.every(p=>p.value===35));
  for(const r of l.shieldRooms)assert(cells.some(p=>p.mesh.position.distanceTo(rooms[r])<10));
  assert.equal(l.shieldRooms.filter(r=>outer.has(r)).length,1);
 });
 check('mine '+level+' landmarks preserve enemy spawns, pickups, and room crossings',()=>{
  const {enemies,pickups,rooms,reactor}=g.state();
  for(const e of enemies)assert(g.allowed(e.mesh.position,e.r),`enemy ${e.type} room ${e.room}`);
  for(const p of pickups)assert(g.allowed(p.mesh.position),`pickup ${p.type}`);
  for(const [i,center]of rooms.entries())if(i!==reactor.room)for(const axis of [0,1,2]){
   const delta=vec().setComponent(axis,14.5);assert(g.visible(center.clone().sub(delta),center.clone().add(delta)),`room ${i} sight axis ${axis}`);
   for(const offset of [-14.5,-10,-5,0,5,10,14.5])assert(g.allowed(center.clone().setComponent(axis,center.getComponent(axis)+offset)),`room ${i} flight axis ${axis}`);
  }
 });
 check('mine '+level+' room effects animate after batching without obstructing shots',()=>{
  const systems=g.art.moving;assert.equal(systems.length,g.state().rooms.length);
  assert.equal(new Set(systems.map(s=>s.theme)).size,10);
  const ray=new g.T.Raycaster();
  for(const s of systems){
   assert(!g.state().walls.includes(s.root));g.art.updateLighting(s.center);assert(s.root.visible);assert(g.art.roomLights.filter(l=>l.visible).length<=4);
   g.art.updateRoomEffects(.2);const beforeGlow=s.glow.emissiveIntensity,before=Array.from(s.particles.geometry.attributes.position.array);const vertexCount=s.particles.geometry.attributes.position.count;
   g.art.updateRoomEffects(1.4);assert.notDeepEqual(Array.from(s.particles.geometry.attributes.position.array),before);assert.equal(s.particles.geometry.attributes.position.count,vertexCount);assert.equal(vertexCount,32);
   assert(s.motions.length>0||s.glow.emissiveIntensity!==beforeGlow);for(const m of s.motions)assert(!m.object.userData.batch);
   ray.set(s.center.clone().add(vec(0,0,30)),vec(0,0,-1));assert.equal(ray.intersectObject(s.root,true).length,0);
  }
  const key=g.state().pickups.find(p=>p.type==='reactorKey'),bounds=new g.T.Box3().setFromObject(key.mesh);assert(bounds.getSize(vec()).y>6);assert.equal(key.mesh.children.filter(o=>o.userData.keyPart==='tooth').length,2);assert(key.mesh.children.some(o=>o.userData.keyPart==='bow'&&o.geometry.type==='TorusGeometry'));assert(key.mesh.children.every(o=>o.material.color.getHex()===0xffc52e));
  g.art.updateLighting(g.player.pos);
 });
 if(level===0)check('locked bulkhead chunks on approach and shooting, with no rapid-fire sound spam',()=>{
  const door=g.state().doors.find(d=>d.security),normal=g.state().rooms[door.b].clone().sub(g.state().rooms[door.a]).normalize();
  const chunks=()=>g.audio.sounds.filter(s=>s.name==='doorLocked');const before=chunks().length;
  g.player.pos.copy(door.center).addScaledVector(normal,-40);g.updateDoors(1);
  g.player.pos.copy(door.center).addScaledVector(normal,-6);g.updateDoors(.01);assert.equal(chunks().length,before+1);
  for(let i=0;i<120;i++)g.updateDoors(1/60);assert.equal(chunks().length,before+1,'standing near a lock should not loop the sound');
  g.createShot(door.center.clone().addScaledVector(normal,-5),normal,'laser');g.updateShots(.1);assert.equal(chunks().length,before+2);
  for(let i=0;i<3;i++){g.createShot(door.center.clone().addScaledVector(normal,-5),normal,'laser');g.updateShots(.1);g.updateDoors(.1);}assert.equal(chunks().length,before+2);
  g.player.pos.copy(door.center).addScaledVector(normal,40);g.updateDoors(1);g.player.pos.copy(door.center).addScaledVector(normal,6);g.updateDoors(.01);assert.equal(chunks().length,before+3);
  assert(door.locked);assert.equal(door.open,0);assert(chunks().every(s=>s.volume>0&&s.volume<=.9&&Math.abs(s.pan)<=1));
 });
 check('mine '+level+' security blocks ships and shots until the physical key is recovered',()=>{
  const {doors,rooms,mineLayout:l}=g.state(),gate=doors.find(d=>d.security),normal=rooms[gate.b].clone().sub(rooms[gate.a]).normalize();
  assert(!g.allowed(gate.center));assert.equal(g.reactorProximity(),0);
  for(const side of [-1,1]){g.player.pos.copy(gate.center).addScaledVector(normal,6*side);g.updateDoors(.5);assert.equal(gate.open,0);assert(!g.visible(gate.center.clone().addScaledVector(normal,-6),gate.center.clone().addScaledVector(normal,6)));}
  g.player.pos.copy(gate.center).addScaledVector(normal,-10);g.player.q.setFromUnitVectors(vec(0,0,-1),normal);g.player.vel.set(0,0,0);g.keys.add('KeyW');g.keys.add('ShiftLeft');
  for(let i=0;i<60;i++)g.movePlayer(1/120);g.keys.clear();assert(g.player.pos.clone().sub(gate.center).dot(normal)<0);assert(g.allowed(g.player.pos));
  g.createShot(gate.center.clone().addScaledVector(normal,-5),normal,'laser');g.updateShots(.1);g.updateDoors(.5);assert.equal(g.state().shots.length,0);assert.equal(gate.open,0);assert(gate.locked);
  const key=g.state().pickups.find(p=>p.type==='reactorKey');g.player.pos.copy(key.mesh.position);g.updatePickups(0);assert(g.state().hasReactorKey);assert(!g.state().pickups.includes(key));assert(!gate.locked);assert(!g.state().coreFound);assert.equal(g.objectiveTarget(),null);
  g.player.pos.copy(gate.center).addScaledVector(normal,-6);g.updateDoors(.5);assert.equal(gate.open,1);assert(g.allowed(gate.center));assert(g.visible(gate.center.clone().addScaledVector(normal,-6),gate.center.clone().addScaledVector(normal,6)));
  g.player.pos.copy(gate.center).addScaledVector(normal,-10);g.player.vel.set(0,0,0);g.keys.add('KeyW');g.keys.add('ShiftLeft');
  for(let i=0;i<90;i++){g.movePlayer(1/120);assert(g.allowed(g.player.pos));}g.keys.clear();assert(g.player.pos.clone().sub(gate.center).dot(normal)>0);assert(g.state().wingEntered);assert(!g.state().coreFound);
  g.player.pos.copy(rooms[l.reactorGate[0]]);g.updateExploration();assert.equal(document.getElementById('chamberLabel').textContent,l.roomIdentity[l.reactorGate[0]].code+' / '+l.roomIdentity[l.reactorGate[0]].name.toUpperCase());
 });
 check('mine '+level+' reactor hum follows passages and grows smoothly toward the core',()=>{
  const l=g.state().mineLayout;let prior=0;
  for(let i=0;i<=l.coreRoom;i++){const strength=g.reactorSignal(l,l.coords[i]);assert(Number.isFinite(strength)&&strength>=prior&&strength<=1);prior=strength;}
  for(let i=l.reactorGate[1];i<l.coreRoom;i++)for(const t of [.32,.5,.68]){
   const sample=k=>g.reactorSignal(l,l.coords[i].map((n,j)=>n+(l.coords[i+1][j]-n)*k));
   assert(Math.abs(sample(t-.0001)-sample(t+.0001))<.002,`hum seam ${i} at ${t}`);
  }
  if(level===1){assert.equal(vec(...l.coords[7]).distanceTo(vec(...l.coords[l.coreRoom])),vec(...l.coords[16]).distanceTo(vec(...l.coords[l.coreRoom])));assert(g.reactorSignal(l,l.coords[7])>g.reactorSignal(l,l.coords[16]));}
 });
 check('mine '+level+' all open doorways and connecting tunnels fit the ship',()=>{
  for(const door of g.state().doors){door.open=1;g.positionDoor(door);}
  const {rooms,links}=g.state();for(const [a,b]of links)for(let t=.31;t<=.69;t+=.01)assert(g.allowed(rooms[a].clone().lerp(rooms[b],t)),`${a}->${b} at ${t}`);
 });
 check('mine '+level+' solid room walls block sight while open portals pass it',()=>{
  const {rooms}=g.state();assert.equal(g.visible(rooms[0],rooms[2]),false);assert.equal(g.visible(rooms[0],rooms[1]),true);
 });
}
g.makeMine(0);g.configure({mode:'play'});g.player.pos.copy(g.state().rooms[2]);g.player.q.identity();g.update(.016);
check('mine navigation has no reactor, enemy, or next-room waypoint',()=>{assert.equal(g.objectiveTarget(),null);assert.equal(document.getElementById('target').hidden,true);});
g.makeMine(0);g.configure({mode:'play'});g.refill();g.scene.updateMatrixWorld(true);
check('shooting a normal closed door opens it, holds it, and permits travel on either face',()=>{
 const gate=g.state().doors.find(d=>!d.security),normal=g.state().rooms[gate.b].clone().sub(g.state().rooms[gate.a]).normalize();
 for(const side of [-1,1]){
  gate.open=0;gate.hold=0;gate.opening=false;g.positionDoor(gate);g.player.pos.copy(gate.center).add(vec(80,80,80));
  const origin=gate.center.clone().addScaledVector(normal,6*side),direction=normal.clone().multiplyScalar(-side);
  g.createShot(origin,direction,'laser');g.updateShots(.12);assert.equal(g.state().shots.length,0,'impact consumes projectile');assert(gate.hold>=3.5);assert.equal(gate.open,0,'impact starts motor rather than removing panel');
  g.updateDoors(.4);assert.equal(gate.open,1);assert(g.allowed(gate.center));g.updateDoors(1);assert.equal(gate.open,1);g.updateDoors(3);assert.equal(gate.open,0);
 }
 g.player.pos.set(0,0,0);g.player.vel.set(0,0,0);
});
check('boost movement cannot cross solid walls',()=>{g.player.pos.set(0,0,0);g.keys.add('KeyD');g.keys.add('ShiftLeft');for(let i=0;i<150;i++)g.movePlayer(1/60);g.keys.clear();assert(g.player.pos.x<17);assert(g.allowed(g.player.pos));});
check('roll makes strafe follow ship-local axes',()=>{g.player.pos.set(0,0,0);g.player.vel.set(0,0,0);g.player.q.setFromAxisAngle(vec(0,0,1),Math.PI/2);g.keys.add('KeyD');for(let i=0;i<20;i++)g.movePlayer(1/60);g.keys.clear();assert(g.player.pos.y>2);assert(Math.abs(g.player.pos.x)<.01);});
check('muzzle stays on player side of close wall',()=>{g.player.q.setFromAxisAngle(vec(0,1,0),-Math.PI/2);g.player.pos.set(14.8,0,0);g.configure({fireWait:0});g.fire();assert(g.state().shots.at(-1).mesh.position.x<17.63);});
g.makeMine(0);g.configure({mode:'play'});g.refill();g.scene.updateMatrixWorld(true);
check('pulse cannon actually damages a target',()=>{const e=g.state().enemies[0];g.player.pos.copy(e.mesh.position).add(vec(0,0,9));g.player.q.identity();const hp=e.hp;g.fire();for(let i=0;i<8;i++)g.updateShots(1/60);assert(e.hp<hp);});
check('missile launch consumes ammo and hits a tracked target',()=>{const e=g.state().enemies[1];g.player.pos.copy(e.mesh.position).add(vec(0,0,12));g.player.q.identity();const hp=e.hp;const ammo=g.player.missiles;g.fire(true);assert.equal(g.player.missiles,ammo-1);for(let i=0;i<20;i++)g.updateShots(1/60);assert(e.hp<hp);});
check('reactor starts heavily protected and cannot be destroyed early',()=>{
 assert(g.state().reactor.hp>=420);assert.equal(g.state().generators.length,3);assert(g.state().enemies.some(e=>e.guardian));
 const hp=g.state().reactor.hp;g.player.pos.copy(g.state().reactor.mesh.position).add(vec(0,0,14));g.player.q.identity();g.configure({fireWait:0});g.fire();for(let i=0;i<8;i++)g.updateShots(1/60);assert.equal(g.state().reactor.hp,hp);g.destroyReactor();assert.equal(g.state().zone,'mine');
});
check('shield relays are physical targets that take repeated cannon hits',()=>{
 for(const [i,generator]of g.state().generators.entries()){
  const offset=i===2?vec(5.5,0,0):vec(0,0,5.5);g.player.pos.copy(generator.pos).add(offset);assert(g.allowed(g.player.pos),'generator firing position must be reachable');
  g.player.q.setFromUnitVectors(vec(0,0,-1),offset.clone().negate().normalize());
  for(let shot=0;generator.hp>0&&shot<12;shot++){g.player.heat=0;g.configure({fireWait:0});const hp=generator.hp;g.fire();for(let i=0;i<4;i++)g.updateShots(1/60);assert(generator.hp<hp,'relay must take direct projectile damage');}
  assert.equal(generator.hp,0);
 }
 assert.equal(g.state().reactor.active,false,'guardians must still protect the core');
});
check('only chamber guardians gate the reactor; unrelated survivors do not',()=>{
 for(const e of [...g.state().enemies])if(e.guardian)g.enemyHit(e,10000);
 assert(g.state().enemies.length>0);assert.equal(g.state().reactor.active,true);assert.equal(g.state().reactor.shield.visible,false);
});
check('a real killing projectile extracts directly into playable space once',()=>{
 g.player.pos.copy(g.state().reactor.mesh.position).add(vec(0,0,14));g.player.q.identity();g.player.heat=0;g.state().reactor.hp=40;
 g.configure({fireWait:0});g.fire();for(let i=0;i<8;i++)g.updateShots(1/60);assert.equal(g.state().zone,'mine');assert.equal(g.state().reactor.hp,20);
 g.configure({fireWait:0});g.fire();for(let i=0;i<8;i++)g.updateShots(1/60);
 assert.equal(g.state().zone,'space');assert.equal(g.state().mode,'play');assert.equal(g.state().nextMine,1);assert.equal(g.state().shots.length,0);assert.equal(g.state().pendingUpgrades,1);assert.equal(g.readCheckpoint().zone,'space');assert.equal(document.getElementById('upgrade').hidden,true);
 const score=g.state().score;g.destroyReactor();assert.equal(g.state().score,score);assert.equal(g.state().pendingUpgrades,1);
});
check('upgrade is optional in space, can be deferred, and installs only once',()=>{
 g.openUpgrade();assert.equal(g.state().mode,'upgrade');assert.equal(g.state().zone,'space');assert.equal(document.getElementById('upgradeCards').children.length,3);
 dispatch(windowEvents,'keydown',{code:'Escape'});assert.equal(g.state().mode,'play');assert.equal(g.state().pendingUpgrades,1);
 g.openUpgrade();const button=document.getElementById('upgradeCards').children[0];button.events.click();button.events.click();assert.equal(g.state().mode,'play');assert.equal(g.state().upgrades.cannon,1);assert.equal(g.state().pendingUpgrades,0);assert.equal(g.readCheckpoint().pendingUpgrades,0);
});
g.scene.updateMatrixWorld(true);
check('space asteroids block laser sight lines',()=>{const rock=g.state().spaceObjects.find(o=>o.type==='rock');assert.equal(g.visible(rock.pos.clone().add(vec(0,0,100)),rock.pos.clone().add(vec(0,0,-100))),false);});
check('space discovery grants salvage once and spawns ambush',()=>{const wreck=g.state().spaceObjects.find(o=>o.type==='wreck');g.player.pos.copy(wreck.pos).add(vec(0,0,60));const salvage=g.state().salvage,n=g.state().enemies.length;g.interactSpace();assert.equal(g.state().salvage,salvage+100);assert.equal(g.state().enemies.length,n+2);g.interactSpace();assert.equal(g.state().salvage,salvage+100);});
check('destination interaction enters next mine and rearms',()=>{const dest=g.state().spaceObjects.find(o=>o.type==='destination');g.player.pos.copy(dest.pos).add(vec(0,0,60));g.interactSpace();assert.equal(g.state().mine,1);assert.equal(g.state().zone,'mine');assert.equal(g.state().stage,'search');assert.equal(g.player.hull,100);});
check('checkpoint restore resets complete encounter',()=>{const s=g.state().checkpoint,n=g.state().enemies.length;g.enemyHit(g.state().enemies[0],10000);g.player.hull=8;g.restore(s);assert(!g.state().hasReactorKey);assert(g.state().doors.find(d=>d.security).locked);assert.equal(g.state().pickups.filter(p=>p.type==='reactorKey').length,1);assert.equal(g.state().enemies.length,n);assert.equal(g.player.hull,100);assert.equal(g.state().mode,'play');});
check('pause clears held flight and fire controls',()=>{g.keys.add('KeyW');g.pauseGame();assert.equal(g.state().mode,'pause');assert.equal(g.keys.size,0);g.resumePlay();assert.equal(g.state().mode,'play');});
check('final jump gate reaches victory',()=>{g.configure({nextMine:3,mode:'play'});g.makeSpace();g.player.pos.copy(g.state().spaceObjects.find(o=>o.type==='destination').pos).add(vec(0,0,60));g.interactSpace();assert.equal(g.state().mode,'end');assert.equal(document.getElementById('endLabel').textContent,'MISSION COMPLETE');assert.equal(g.readCheckpoint(),null);});
// Exercise real input event handlers as well as the flight/combat simulation.
g.makeMine(0);g.configure({mode:'play'});g.refill();g.scene.updateMatrixWorld(true);
const canvas=document.getElementById('game');
function resetFlight(){g.resumePlay();g.player.pos.set(0,0,0);g.player.vel.set(0,0,0);g.player.q.identity();g.configure({fireWait:0});}
function mouseDown(button){canvas.events.mousedown({button,preventDefault(){}});}
function mouseAt(x,y){return dispatch(windowEvents,'mousemove',{clientX:innerWidth/2+x,clientY:innerHeight/2+y,target:canvas});}
check('left mouse holds forward thrust without firing',()=>{resetFlight();mouseDown(0);g.update(.016);for(let i=0;i<15;i++)g.movePlayer(1/60);assert(g.player.pos.z<-2);assert.equal(g.state().shots.filter(s=>!s.enemy).length,0);dispatch(windowEvents,'mouseup',{button:0});});
check('right mouse holds reverse without consuming missiles',()=>{resetFlight();const ammo=g.player.missiles;mouseDown(2);g.update(.016);for(let i=0;i<15;i++)g.movePlayer(1/60);assert(g.player.pos.z>2);assert.equal(g.player.missiles,ammo);dispatch(windowEvents,'mouseup',{button:2});});
check('neutral thrust quickly stops residual drift',()=>{resetFlight();g.player.vel.set(0,0,-21);for(let i=0;i<18;i++)g.movePlayer(1/60);assert(g.player.vel.length()<.35);assert(Math.abs(g.player.pos.z)<1.5);});
check('both mouse buttons brake even with keyboard thrust held',()=>{resetFlight();g.player.vel.set(0,0,-21);dispatch(windowEvents,'keydown',{code:'KeyW'});mouseDown(0);mouseDown(2);for(let i=0;i<18;i++)g.movePlayer(1/60);assert(g.player.vel.length()<.05);assert(Math.abs(g.player.pos.z)<1);});
check('mouse plus keyboard forward does not double thrust',()=>{resetFlight();mouseDown(0);for(let i=0;i<20;i++)g.movePlayer(1/60);const speed=g.player.vel.length();resetFlight();mouseDown(0);dispatch(windowEvents,'keydown',{code:'KeyW'});for(let i=0;i<20;i++)g.movePlayer(1/60);assert(Math.abs(g.player.vel.length()-speed)<1e-8);});
check('reverse input promptly overcomes forward momentum',()=>{resetFlight();g.player.vel.set(0,0,-21);mouseDown(2);for(let i=0;i<8;i++)g.movePlayer(1/60);assert(g.player.vel.z>5);});
check('Space fires immediately and repeatedly without vertical motion',()=>{resetFlight();const before=g.state().shots.length;const event=dispatch(windowEvents,'keydown',{code:'Space'});assert(event.prevented);assert(g.state().shots.length>before);for(let i=0;i<16;i++)g.update(1/60);assert.equal(g.player.pos.y,0);assert.equal(g.player.pos.z,0);assert(g.player.heat>5);dispatch(windowEvents,'keyup',{code:'Space'});assert(!g.keys.has('Space'));});
check('X launches missiles independently of reverse thrust',()=>{resetFlight();const ammo=g.player.missiles;dispatch(windowEvents,'keydown',{code:'KeyX'});assert.equal(g.player.missiles,ammo-1);assert.equal(g.player.vel.length(),0);dispatch(windowEvents,'keyup',{code:'KeyX'});});
check('R and F move vertically; C does not move the ship',()=>{resetFlight();dispatch(windowEvents,'keydown',{code:'KeyR'});for(let i=0;i<12;i++)g.movePlayer(1/60);assert(g.player.pos.y>1);resetFlight();dispatch(windowEvents,'keydown',{code:'KeyF'});for(let i=0;i<12;i++)g.movePlayer(1/60);assert(g.player.pos.y<-1);resetFlight();dispatch(windowEvents,'keydown',{code:'KeyC'});g.movePlayer(.1);assert.equal(g.player.pos.length(),0);});
check('ordinary cursor steers while stationary and in reverse',()=>{resetFlight();document.pointerLockElement=null;let q=g.player.q.clone();dispatch(windowEvents,'mousemove',{clientX:innerWidth/2+230,clientY:innerHeight/2,target:canvas});g.movePlayer(.1);assert(g.player.q.angleTo(q)>.1);mouseDown(2);document.pointerLockElement=null;q=g.player.q.clone();dispatch(windowEvents,'mousemove',{clientX:innerWidth/2,clientY:innerHeight/2-230,target:canvas});g.movePlayer(.1);assert(g.player.q.angleTo(q)>.1);q=g.player.q.clone();dispatch(windowEvents,'mousemove',{clientX:innerWidth/2,clientY:innerHeight/2,target:canvas});g.movePlayer(.1);assert(g.player.q.angleTo(q)<1e-6);});
check('focus loss stops held mouse thrust and held Space fire',()=>{resetFlight();mouseDown(0);dispatch(windowEvents,'keydown',{code:'Space'});g.movePlayer(.1);dispatch(windowEvents,'blur');assert.equal(g.state().mode,'pause');assert.equal(g.keys.size,0);assert.equal(g.player.vel.length(),0);g.resumePlay();g.movePlayer(.1);assert.equal(g.player.vel.length(),0);assert.equal(document.activeElement,canvas);});
check('C enters destination and F only descends near it',()=>{g.configure({nextMine:1,mode:'play'});g.makeSpace();g.resumePlay();const dest=g.state().spaceObjects.find(o=>o.type==='destination');g.player.pos.copy(dest.pos).add(vec(0,0,60));dispatch(windowEvents,'keydown',{code:'KeyF'});assert.equal(g.state().zone,'space');dispatch(windowEvents,'keyup',{code:'KeyF'});dispatch(windowEvents,'keydown',{code:'KeyC'});assert.equal(g.state().zone,'mine');assert.equal(g.state().mine,1);});
// A single mouse event must keep turning through and beyond a complete rotation.
g.makeMine(0);g.configure({mode:'play'});g.refill();g.scene.updateMatrixWorld(true);
for(const [direction,dx,dy,axis] of [['right',230,0,[0,-1,0]],['left',-230,0,[0,1,0]],['up',0,-230,[1,0,0]],['down',0,230,[-1,0,0]]]){
 check('one mouse event sustains a full 360 and beyond: '+direction,()=>{
  resetFlight();mouseAt(dx,dy);
  assert(g.player.q.angleTo(new g.T.Quaternion())<1e-6,'mouse sets rate; simulation turns ship');
  const dt=(Math.PI/2)/2.2/60;let travel=0;
  for(let quarter=1;quarter<=5;quarter++){
   for(let frame=0;frame<60;frame++){const before=g.player.q.clone();g.movePlayer(dt);travel+=g.player.q.angleTo(before);}
   const expected=new g.T.Quaternion().setFromAxisAngle(vec(...axis),quarter*Math.PI/2);
   assert(g.player.q.angleTo(expected)<1e-6,'wrong heading at quarter '+quarter);
  }
  assert(travel>Math.PI*2);assert(Math.abs(g.player.q.length()-1)<1e-10);
 });
}
check('Z stops turning immediately without changing heading or thrust',()=>{
 resetFlight();mouseDown(0);mouseAt(230,0);g.movePlayer(.1);
 const heading=g.player.q.clone(),event=dispatch(windowEvents,'keydown',{code:'KeyZ'});assert(event.prevented);
 for(let i=0;i<20;i++)g.movePlayer(1/60);assert(g.player.q.angleTo(heading)<1e-6);assert(g.player.vel.length()>5);
});
check('deadzone allows steady aim while small cursor movements change turn rate',()=>{
 resetFlight();for(let i=1;i<=10;i++){mouseAt(i,0);g.movePlayer(.02);}
 assert(g.player.q.angleTo(new g.T.Quaternion())<1e-6);
 for(let i=11;i<=30;i++){mouseAt(i,0);g.movePlayer(.02);}
 assert(g.player.q.angleTo(new g.T.Quaternion())>.001);
 mouseAt(0,0);const heading=g.player.q.clone();g.movePlayer(.3);assert(g.player.q.angleTo(heading)<1e-6);
});
check('larger mouse offset increases turn rate and diagonal rate is capped',()=>{
 const angle=(x,y)=>{resetFlight();mouseAt(x,y);g.movePlayer(.2);return g.player.q.angleTo(new g.T.Quaternion());};
 const slow=angle(70,0),fast=angle(230,0),diagonal=angle(230,230),edge=angle(innerWidth/2-1,0);
 assert(slow>0&&slow<fast);assert(Math.abs(fast-diagonal)<1e-6);assert(Math.abs(fast-edge)<1e-6);
});
check('continuous turn speed is consistent at 30, 60, and 120 FPS',()=>{
 const headings=[];for(const fps of [30,60,120]){resetFlight();mouseAt(125,70);for(let i=0;i<fps*2;i++)g.movePlayer(1/fps);headings.push(g.player.q.clone());}
 assert(headings[0].angleTo(headings[1])<1e-6);assert(headings[0].angleTo(headings[2])<1e-6);
});
check('inverted Y reverses pitch while turn speed setting adjusts rotation',()=>{
 resetFlight();mouseAt(0,-230);g.movePlayer(.2);const regular=vec(0,0,-1).applyQuaternion(g.player.q);
 resetFlight();document.getElementById('invert').checked=true;mouseAt(0,-230);g.movePlayer(.2);const inverted=vec(0,0,-1).applyQuaternion(g.player.q);assert(regular.y>0&&inverted.y<0);assert(Math.abs(regular.y+inverted.y)<1e-6);document.getElementById('invert').checked=false;
 resetFlight();document.getElementById('sensitivity').value='40';mouseAt(230,0);g.movePlayer(.2);assert(Math.abs(g.player.q.angleTo(new g.T.Quaternion())-.22)<1e-6);document.getElementById('sensitivity').value='80';
});
check('mouse steering follows screen-local axes after a 90 degree roll',()=>{
 resetFlight();g.player.q.setFromAxisAngle(vec(0,0,1),Math.PI/2);const initial=g.player.q.clone();mouseAt(230,0);g.movePlayer(.2);
 const expected=initial.multiply(new g.T.Quaternion().setFromAxisAngle(vec(0,-1,0),.44));assert(g.player.q.angleTo(expected)<1e-6);assert(vec(0,0,-1).applyQuaternion(g.player.q).y>0);
});
check('pause, focus loss, canvas exit, restore, and sector changes clear steering',()=>{
 for(const transition of [()=>{g.pauseGame();g.resumePlay();},()=>{dispatch(windowEvents,'blur');g.resumePlay();},()=>{canvas.events.mouseleave();canvas.events.mouseenter();},()=>g.makeMine(0),()=>g.restore(g.state().checkpoint)]){
  resetFlight();mouseAt(230,-100);g.movePlayer(.1);transition();const heading=g.player.q.clone();g.movePlayer(.2);assert(g.player.q.angleTo(heading)<1e-6);
 }
});
check('mouse outside play cannot set a latent turn and steering marker is visible',()=>{
 resetFlight();mouseAt(160,80);assert.equal(document.getElementById('steeringCursor').style.opacity,'.9');assert(!document.getElementById('steeringCursor').style.transform.includes('NaN'));
 g.pauseGame();mouseAt(500,500);g.resumePlay();const heading=g.player.q.clone();g.movePlayer(.2);assert(g.player.q.angleTo(heading)<1e-6);assert.equal(document.getElementById('steeringCursor').style.opacity,'.2');
});
check('Space fires along the changing ship heading during a sustained turn',()=>{
 g.configure({nextMine:1,mode:'play'});g.makeSpace();g.refill();resetFlight();g.player.pos.set(2000,1000,2000);mouseAt(230,0);dispatch(windowEvents,'keydown',{code:'Space'});
 for(let i=0;i<12;i++)g.update(1/60);const shot=g.state().shots.filter(s=>!s.enemy).at(-1);assert(shot);assert(shot.dir.x>.2);assert(g.player.heat>5);dispatch(windowEvents,'keyup',{code:'Space'});
});
check('shields absorb damage, overflow hits hull, and zero hull means death',()=>{
 g.makeMine(0);g.configure({mode:'play'});g.refill();g.player.shield=100;g.damage(90,'enemy');assert.equal(g.player.shield,10);assert.equal(g.player.hull,100);
 g.damage(25,'enemy');assert.equal(g.player.shield,0);assert.equal(g.player.hull,85);g.damage(85,'enemy');assert.equal(g.player.hull,0);assert.equal(g.state().mode,'end');assert(document.getElementById('endText').textContent.includes('Unlimited retries'));
});
check('checkpoint retry fully rearms and rolls back sector gains without a life limit',()=>{
 g.beginNew();const checkpoint=g.state().checkpoint;
 for(let attempt=0;attempt<5;attempt++){
  g.enemyHit(g.state().enemies[0],10000);g.player.missiles=0;g.damage(9999,'enemy');document.getElementById('retry').onclick();
  assert.equal(g.state().mode,'play');assert.equal(g.player.hull,100);assert.equal(g.player.shield,g.maxShield());assert(g.player.missiles>=6);assert.equal(g.state().score,checkpoint.score);assert.equal(g.state().salvage,checkpoint.salvage);assert.equal(g.state().enemies.length,24);
 }
});
check('lethal projectile cannot collect an overlapping repair cache after death',()=>{
 g.makeMine(0);g.configure({mode:'play'});g.refill();resetFlight();g.player.shield=0;g.player.hull=1;
 g.spawnPickup(g.player.pos.clone(),'cache',90);const salvage=g.state().salvage;g.createShot(g.player.pos.clone(),vec(0,0,1),'enemy',true);g.update(.016);
 assert.equal(g.state().mode,'end');assert.equal(g.player.hull,0);assert.equal(g.state().salvage,salvage);
});
check('launch, resume, and repeated thrust clicks never request mouse capture',()=>{
 document.getElementById('start').onclick();assert.equal(g.state().mode,'play');assert.equal(g.player.vel.length(),0);
 g.pauseGame();document.getElementById('resume').onclick();const heading=g.player.q.clone();g.movePlayer(.1);assert(g.player.q.angleTo(heading)<1e-6);assert.equal(g.player.vel.length(),0);
 for(let i=0;i<4;i++){mouseDown(i%2?2:0);dispatch(windowEvents,'mouseup',{button:i%2?2:0});}
 assert.equal(pointerLockRequests,0);assert.equal(document.pointerLockElement,null);
});
check('leaving canvas clears thrust, fire, and turn; key repeats outside cannot restart them',()=>{
 resetFlight();mouseAt(230,0);mouseDown(0);dispatch(windowEvents,'keydown',{code:'Space'});g.movePlayer(.1);canvas.events.mouseleave();
 const heading=g.player.q.clone();dispatch(windowEvents,'keydown',{code:'Space',repeat:true,target:document.getElementById('pauseBtn')});dispatch(windowEvents,'keydown',{code:'KeyW',repeat:true,target:document.getElementById('pauseBtn')});
 g.movePlayer(.2);assert(g.player.q.angleTo(heading)<1e-6);assert.equal(g.player.vel.length(),0);assert.equal(g.keys.size,0);assert.equal(g.state().mode,'play');
 canvas.events.mouseenter();mouseAt(-230,0);g.movePlayer(.1);assert(g.player.q.angleTo(heading)>.1);
});
check('mouseup outside the canvas releases thrust and right click suppresses its menu',()=>{
 resetFlight();mouseDown(0);g.movePlayer(.1);dispatch(windowEvents,'mouseup',{button:0,target:document.getElementById('pauseBtn')});for(let i=0;i<40;i++)g.movePlayer(1/60);assert.equal(g.player.vel.length(),0);
 let prevented=false;canvas.events.contextmenu({preventDefault(){prevented=true;}});assert(prevented);
});
// Door collision and motion must agree in all three tunnel orientations.
g.makeMine(0);g.configure({mode:'play'});g.refill();g.scene.updateMatrixWorld(true);
for(const axis of [0,1,2]){
 check('automatic bulkhead on axis '+axis+' opens from either side and closes safely',()=>{
  const door=g.state().doors.find(d=>d.axis===axis&&!d.security);assert(door);
  const normal=vec(0,0,1).applyQuaternion(door.root.quaternion),cross=vec(1,0,0).applyQuaternion(door.root.quaternion);
  g.player.pos.set(1000,1000,1000);g.updateDoors(4);assert.equal(door.open,0);assert(!g.allowed(door.center));
  assert(!g.visible(door.center.clone().addScaledVector(normal,6),door.center.clone().addScaledVector(normal,-6)));
  door.open=.1;g.positionDoor(door);assert(!g.allowed(door.center),'narrow slit cannot fit the ship');
  assert(g.visible(door.center.clone().addScaledVector(normal,6),door.center.clone().addScaledVector(normal,-6)),'bullets and sight use the real opening');
  assert(!g.visible(door.center.clone().addScaledVector(cross,4).addScaledVector(normal,6),door.center.clone().addScaledVector(cross,4).addScaledVector(normal,-6)),'remaining panel still blocks sight');
  for(const side of [-1,1]){
   door.open=0;door.hold=0;g.positionDoor(door);g.player.pos.copy(door.center).addScaledVector(normal,side*24);
   for(let frame=0;frame<30;frame++)g.updateDoors(1/60);assert.equal(door.open,1);assert(g.allowed(door.center));
  }
  g.player.pos.copy(door.center);g.updateDoors(3);assert.equal(door.open,1,'door must not close around the player');
  g.player.pos.set(1000,1000,1000);for(let frame=0;frame<180;frame++)g.updateDoors(1/60);assert.equal(door.open,0);
 });
}
check('a closed bulkhead intercepts a real projectile',()=>{
 const door=g.state().doors[0],normal=vec(0,0,1).applyQuaternion(door.root.quaternion);door.open=0;g.positionDoor(door);
 g.createShot(door.center.clone().addScaledVector(normal,5),normal.clone().negate(),'laser');for(let i=0;i<4;i++)g.updateShots(1/60);assert.equal(g.state().shots.length,0);
});
check('boosting toward a closed bulkhead opens it before passage',()=>{
 const door=g.state().doors[0],normal=vec(0,0,1).applyQuaternion(door.root.quaternion);resetFlight();door.open=0;door.hold=0;g.positionDoor(door);
 g.player.pos.copy(door.center).addScaledVector(normal,26);g.player.q.setFromUnitVectors(vec(0,0,-1),normal.clone().negate());g.keys.add('KeyW');g.keys.add('ShiftLeft');
 for(let i=0;i<120;i++){g.movePlayer(1/120);assert(g.allowed(g.player.pos));}
 assert(g.player.pos.clone().sub(door.center).dot(normal)<0);g.keys.clear();
});
check('survey reveals entered rooms, never unseen rooms or hallway neighbors',()=>{
 g.makeMine(0);g.configure({mode:'play'});assert.deepEqual([...g.state().visitedRooms],[0]);
 g.player.pos.copy(g.state().rooms[0]).lerp(g.state().rooms[1],.5);g.updateExploration();assert.equal(g.state().visitedRooms.size,1);
 const map=document.getElementById('mapCanvas'),original=map.getContext;let rectangles=0;
 map.getContext=()=>new Proxy({},{get:(_,key)=>key==='fillRect'?()=>rectangles++:()=>{}});
 g.drawMap();assert.equal(rectangles,1,'only the surveyed room is drawn');
 g.player.pos.copy(g.state().rooms[1]);g.updateExploration();assert.equal(g.state().visitedRooms.size,2);rectangles=0;g.drawMap();assert.equal(rectangles,2);map.getContext=original;
 assert.equal(g.state().coreFound,false);assert.equal(g.objectiveTarget(),null);
});
check('deep defenders are smaller, evade faster, and remain within flight space',()=>{
 const elite=g.state().enemies.find(e=>e.evader&&!e.guardian),regular=g.state().enemies.find(e=>e.type==='drone');assert(elite.r<regular.r);assert(elite.mesh.scale.x<regular.mesh.scale.x);
 g.player.pos.copy(elite.pos).add(vec(0,0,10));elite.phase=0;let distance=0,previous=elite.mesh.position.clone();
 for(let i=0;i<60;i++){g.updateEnemies(1/60);distance+=previous.distanceTo(elite.mesh.position);previous.copy(elite.mesh.position);assert(g.allowed(elite.mesh.position,elite.r));}
 assert(distance>8,'evasive movement should exceed the ordinary slow hover');
});
check('elite targeting assistance is tighter but direct cannon shots still hit',()=>{
 resetFlight();const elite=g.state().enemies.find(e=>e.evader&&!e.guardian),regular=g.state().enemies.find(e=>e.type==='drone');regular.mesh.position.copy(elite.mesh.position);
 g.player.pos.copy(elite.mesh.position).add(vec(0,0,14));g.player.q.setFromAxisAngle(vec(0,1,0),-.08);
 const list=g.state().enemies;list.splice(0,list.length,regular);g.fire();assert(g.state().shots.at(-1).dir.x<0&&Math.abs(g.state().shots.at(-1).dir.x)<.03);
 list.splice(0,list.length,elite);g.configure({fireWait:0});g.fire();assert(g.state().shots.at(-1).dir.x>.07);
 g.state().shots.splice(0);g.player.q.identity();g.configure({fireWait:0});const hp=elite.hp;g.fire();for(let i=0;i<8;i++)g.updateShots(1/60);assert(elite.hp<hp);
});
check('pending upgrades survive reload and installation preserves sector reward rollback',()=>{
 g.configure({nextMine:1,pendingUpgrades:2,mode:'play'});g.makeSpace();g.refill();g.resumePlay();g.saveCheckpoint();const baseline=g.readCheckpoint();
 const wreck=g.state().spaceObjects.find(o=>o.type==='wreck');g.player.pos.copy(wreck.pos).add(vec(0,0,60));g.interactSpace();assert(g.state().salvage>baseline.salvage);
 g.openUpgrade();document.getElementById('upgradeCards').children[1].events.click();const saved=g.readCheckpoint();assert.equal(saved.pendingUpgrades,1);assert.equal(saved.salvage,baseline.salvage);assert.equal(saved.score,baseline.score);
 g.restore(saved);assert.equal(g.state().pendingUpgrades,1);assert.equal(g.state().upgrades.shield,saved.upgrades.shield);
 const dest=g.state().spaceObjects.find(o=>o.type==='destination');g.player.pos.copy(dest.pos).add(vec(0,0,60));g.interactSpace();assert.equal(g.state().zone,'mine');assert.equal(g.readCheckpoint().pendingUpgrades,1);
 const oldSave={...g.readCheckpoint()};delete oldSave.pendingUpgrades;localStorage.setItem('voidbreak-v1',JSON.stringify(oldSave));g.restore(g.readCheckpoint());assert.equal(g.state().pendingUpgrades,0);
});
check('all three reactor entrances permit flying around the central vessel',()=>{
 for(let level=0;level<3;level++){
  g.makeMine(level);g.configure({mode:'play'});const {rooms,reactor,links}=g.state(),edge=links.find(([a,b])=>a===reactor.room||b===reactor.room),neighbor=edge.find(i=>i!==reactor.room);
  const outward=rooms[neighbor].clone().sub(rooms[reactor.room]).normalize(),side=Math.abs(outward.x)<.5?vec(1,0,0):vec(0,0,1),entry=rooms[reactor.room].clone().addScaledVector(outward,14.5);
  assert(g.allowed(entry));for(let t=0;t<=1;t+=.02)assert(g.allowed(entry.clone().addScaledVector(side,t*8.5)));
  for(let t=0;t<=1;t+=.02)assert(g.allowed(entry.clone().addScaledVector(side,8.5).addScaledVector(outward,-t*14.5)));
 }
});
check('reactor blocks hostile projectiles without losing its own health',()=>{
 const core=g.state().reactor,origin=core.mesh.position.clone().add(vec(0,0,10));g.player.pos.copy(core.mesh.position).add(vec(0,0,-10));g.refill();const hull=g.player.hull,shield=g.player.shield,hp=core.hp;
 assert(!g.visible(origin,g.player.pos));g.createShot(origin,vec(0,0,-1),'enemy',true);for(let i=0;i<40;i++)g.updateShots(1/60);assert.equal(g.player.hull,hull);assert.equal(g.player.shield,shield);assert.equal(core.hp,hp);
});
check('the complete three-reactor campaign advances through space and the final gate',()=>{
 g.beginNew();
 for(let level=0;level<3;level++){
  assert.equal(g.state().mine,level);
  for(const generator of g.state().generators)g.hitGenerator(generator,10000);
  for(const e of [...g.state().enemies])if(e.guardian)g.enemyHit(e,10000);
  assert(g.state().enemies.length>0);assert(g.state().reactor.active);g.state().reactor.hp=20;
  g.player.pos.copy(g.state().reactor.mesh.position).add(vec(0,0,14));g.player.q.identity();g.configure({fireWait:0});g.fire();g.updateShots(.1);
  assert.equal(g.state().zone,'space');assert.equal(g.state().mode,'play');assert.equal(g.state().nextMine,level+1);assert.equal(g.readCheckpoint().pendingUpgrades,level+1);
  const dest=g.state().spaceObjects.find(o=>o.type==='destination');g.player.pos.copy(dest.pos).add(vec(0,0,60));g.interactSpace();
 }
 assert.equal(g.state().mode,'end');assert.equal(g.readCheckpoint(),null);
});
// Cannon loadout and arrow controls use real event handlers and projectile geometry.
for(const [code,axis,sign]of [['ArrowUp','y',1],['ArrowDown','y',-1],['ArrowLeft','x',-1],['ArrowRight','x',1]]){
 check(code+' translates without pitching or yawing',()=>{
  g.beginNew();resetFlight();const heading=g.player.q.clone();const event=dispatch(windowEvents,'keydown',{code});assert(event.prevented);
  for(let i=0;i<15;i++)g.movePlayer(1/60);dispatch(windowEvents,'keyup',{code});
  assert(g.player.pos[axis]*sign>2);assert(g.player.q.angleTo(heading)<1e-8);assert(Math.abs(g.player.pos.z)<1e-8);
 });
}
check('arrow aliases do not double speed and follow the rolled ship axes',()=>{
 g.beginNew();resetFlight();g.keys.add('ArrowUp');for(let i=0;i<15;i++)g.movePlayer(1/60);const speed=g.player.vel.length();
 resetFlight();g.keys.add('ArrowUp');g.keys.add('KeyR');for(let i=0;i<15;i++)g.movePlayer(1/60);assert(Math.abs(g.player.vel.length()-speed)<1e-8);
 resetFlight();g.player.q.setFromAxisAngle(vec(0,0,1),Math.PI/2);const heading=g.player.q.clone();g.keys.add('ArrowRight');for(let i=0;i<15;i++)g.movePlayer(1/60);assert(g.player.pos.y>2);assert(Math.abs(g.player.pos.x)<1e-8);assert(g.player.q.angleTo(heading)<1e-8);
 resetFlight();g.keys.add('ArrowRight');g.keys.add('ArrowUp');for(let i=0;i<15;i++)g.movePlayer(1/60);assert(Math.abs(g.player.vel.length()-speed)<1e-8);
 mouseDown(0);mouseDown(2);for(let i=0;i<25;i++)g.movePlayer(1/60);assert(g.player.vel.length()<.01);
});
function wheel(deltaY,extra={}){const e={deltaY,deltaMode:0,prevented:false,preventDefault(){this.prevented=true;},...extra};canvas.events.wheel(e);return e;}
function recover(id){const p=g.state().pickups.find(p=>p.type==='cannon'&&p.weapon===id);assert(p,'weapon must be physically available');g.player.pos.copy(p.mesh.position);g.updatePickups(0);return p;}
for(let level=0;level<3;level++)check('mine '+(level+1)+' has only introduced cannon families and reachable deterministic ammo',()=>{
 g.beginNew();g.makeMine(level);g.configure({mode:'play'});
 const expected=g.CANNONS.filter(w=>w.level&&w.level<=level+1).map(w=>w.id);
 assert.deepEqual(g.state().pickups.filter(p=>p.type==='cannon').map(p=>p.weapon).sort(),[...expected].sort());
 for(const id of expected){const ammo=g.state().pickups.filter(p=>p.type==='cannonAmmo'&&p.weapon===id);assert(ammo.length>=2);}
 for(const p of g.state().pickups.filter(p=>p.weapon))assert(g.allowed(p.mesh.position),'pickup '+p.weapon+' must fit accessible space');
});
check('weapon discovery supplies ammo without auto-equipping or duplicating rewards',()=>{
 g.beginNew();const before=g.state().salvage;recover('breach');assert(g.state().arsenal.owned.includes('breach'));assert.equal(g.state().arsenal.equipped,'pulse');assert.equal(g.state().arsenal.ammo.breach,24);assert.equal(g.state().salvage,before);g.updatePickups(0);assert.equal(g.state().arsenal.ammo.breach,24);
});
check('wheel previews owned cannons, wraps both ways, and middle click equips without thrust or fire',()=>{
 resetFlight();assert(wheel(100).prevented);assert.equal(g.state().browsedCannon,'breach');assert.equal(g.state().arsenal.equipped,'pulse');
 g.fire();assert.equal(g.state().shots.at(-1).type,'laser');const ammo=g.state().arsenal.ammo.breach,wait=g.state().fireWait,heat=g.player.heat,n=g.state().shots.length;
 mouseDown(1);assert.equal(g.state().arsenal.equipped,'breach');assert.equal(g.state().shots.length,n);assert.equal(g.state().arsenal.ammo.breach,ammo);assert.equal(g.state().fireWait,wait);assert.equal(g.player.heat,heat);g.movePlayer(.1);assert.equal(g.player.pos.length(),0);
 wheel(100);assert.equal(g.state().browsedCannon,'pulse');wheel(-100);assert.equal(g.state().browsedCannon,'breach');
 const e={button:1,prevented:false,preventDefault(){this.prevented=true;}};canvas.events.auxclick(e);assert(e.prevented);
});
check('fine wheel deltas accumulate, modifiers stay native, and pause cancels an unconfirmed choice',()=>{
 resetFlight();wheel(15);assert.equal(g.state().browsedCannon,'breach');wheel(15);wheel(15);assert.equal(g.state().browsedCannon,'pulse');
 assert(!wheel(100,{ctrlKey:true}).prevented);assert.equal(g.state().browsedCannon,'pulse');
 g.pauseGame();assert.equal(document.getElementById('weaponPicker').hidden,true);assert.equal(g.state().browsedCannon,'breach');assert(!wheel(100).prevented);mouseDown(1);assert.equal(g.state().arsenal.equipped,'breach');
 g.resumePlay();wheel(1,{deltaMode:1});assert.equal(g.state().browsedCannon,'pulse');canvas.events.mouseleave();assert.equal(g.state().browsedCannon,'breach');assert(!wheel(100).prevented);canvas.events.mouseenter();
});
for(const id of ['breach','vulcan','siege'])check(id+' fires distinct projectiles, consumes one ammo per trigger, and damages targets',()=>{
 g.beginNew();resetFlight();const arsenal=g.state().arsenal;arsenal.owned.push(id);arsenal.ammo[id]=5;arsenal.equipped=id;
 const e=g.state().enemies[0];g.state().enemies.splice(1);e.mesh.position.set(0,0,-6);e.pos.copy(e.mesh.position);e.hp=1000;g.player.pos.set(0,0,5);g.scene.updateMatrixWorld(true);
 g.fire();assert.equal(arsenal.ammo[id],4);assert.equal(g.state().shots.length,id==='breach'?5:1);assert(g.state().shots.every(s=>s.type===id));const wait=g.state().fireWait;g.fire();assert.equal(arsenal.ammo[id],4);assert(wait>0);
 for(let i=0;i<15;i++)g.updateShots(1/60);assert(e.hp<1000);assert.equal(g.state().shots.length,0);
});
check('empty special cannot fire and returns to unlimited Pulse; refill creates no special ammo',()=>{
 g.beginNew();resetFlight();const a=g.state().arsenal;a.owned.push('breach');a.equipped='breach';a.ammo.breach=0;g.fire();assert.equal(g.state().shots.length,0);assert.equal(a.equipped,'pulse');g.configure({fireWait:0});g.fire();assert.equal(g.state().shots.at(-1).type,'laser');assert.equal(a.ammo.breach,0);
 a.ammo.breach=3;g.refill();assert.equal(a.ammo.breach,3);
});
check('specific ammo can be found before its cannon, respects capacity, and full crates remain',()=>{
 g.beginNew();const a=g.state().arsenal,p=g.state().pickups.find(p=>p.type==='cannonAmmo'&&p.weapon==='breach');g.player.pos.copy(p.mesh.position);g.updatePickups(0);assert.equal(a.ammo.breach,12);assert.deepEqual(a.owned,['pulse']);
 const p2=g.state().pickups.find(p=>p.type==='cannonAmmo'&&p.weapon==='breach');a.ammo.breach=96;g.player.pos.copy(p2.mesh.position);g.updatePickups(0);assert(g.state().pickups.includes(p2));a.ammo.breach=95;g.updatePickups(0);assert.equal(a.ammo.breach,96);assert(!g.state().pickups.includes(p2));
});
check('retry rolls back cannon discovery, while extraction commits the remaining ammunition',()=>{
 g.beginNew();const start=g.readCheckpoint();recover('breach');g.restore(start);assert.deepEqual(g.state().arsenal.owned,['pulse']);assert.equal(g.state().arsenal.ammo.breach,0);recover('breach');g.state().arsenal.equipped='breach';g.state().arsenal.ammo.breach=7;
 for(const generator of g.state().generators)g.hitGenerator(generator,10000);for(const e of [...g.state().enemies])if(e.guardian)g.enemyHit(e,10000);g.state().reactor.hp=0;g.destroyReactor();
 const saved=g.readCheckpoint();assert.equal(saved.zone,'space');assert.equal(saved.arsenal.ammo.breach,7);assert.equal(saved.arsenal.equipped,'breach');assert(g.state().pickups.some(p=>p.type==='cannonAmmo'&&p.weapon==='breach'));
 g.state().arsenal.ammo.breach=1;g.restore(saved);assert.equal(g.state().arsenal.ammo.breach,7);
});
check('optional upgrades cannot bank collected ammo, and the next sector records actual remaining ammo',()=>{
 const baseline=g.readCheckpoint();const p=g.state().pickups.find(p=>p.type==='cannonAmmo');g.player.pos.copy(p.mesh.position);g.updatePickups(0);assert(g.state().arsenal.ammo.breach>baseline.arsenal.ammo.breach);
 g.openUpgrade();document.getElementById('upgradeCards').children[1].events.click();assert.deepEqual(g.readCheckpoint().arsenal,baseline.arsenal);assert(g.state().arsenal.ammo.breach>baseline.arsenal.ammo.breach);
 g.state().arsenal.ammo.breach=4;g.player.pos.copy(g.state().spaceObjects.find(o=>o.type==='destination').pos).add(vec(0,0,60));g.interactSpace();assert.equal(g.readCheckpoint().arsenal.ammo.breach,4);assert.equal(g.state().arsenal.equipped,'breach');
});
check('legacy and malformed loadouts normalize without breaking old checkpoints',()=>{
 const legacy=g.readCheckpoint();delete legacy.arsenal;g.restore(legacy);assert.deepEqual(g.state().arsenal.owned,['pulse']);assert.equal(g.state().arsenal.ammo.breach,0);
 assert.deepEqual(g.cleanArsenal({owned:['siege','invalid','siege'],equipped:'invalid',ammo:{siege:999999,vulcan:-2,breach:NaN}}),{owned:['pulse','siege'],equipped:'pulse',ammo:{breach:0,vulcan:0,siege:60}});
});

// Sustained fire recovery: held updates and fresh trigger presses are different inputs.
function startRecovery(id='pulse'){
 g.beginNew();resetFlight();g.state().enemies.splice(0);if(id!=='pulse'){g.state().arsenal.owned.push(id);g.state().arsenal.ammo[id]=200;g.state().arsenal.equipped=id;}
 dispatch(windowEvents,'keydown',{code:'Space'});
 let elapsed=0;while(!g.state().overheated&&elapsed<4.2){g.update(1/60);elapsed+=1/60;}
 assert(g.state().overheated);assert(elapsed>=2&&elapsed<=4.1);return elapsed;
}
for(const id of ['pulse','breach','vulcan','siege'])check(id+' sustained fire stops for recovery, permits true single shots, and then resumes',()=>{
 startRecovery(id);const ammo=g.state().arsenal.ammo[id],recovery=g.state().cannonRecovery;
 for(let i=0;i<35;i++)g.update(1/60);assert(g.state().overheated);if(id!=='pulse')assert.equal(g.state().arsenal.ammo[id],ammo);
 const n=g.state().shots.length;dispatch(windowEvents,'keydown',{code:'Space',repeat:true});assert.equal(g.state().shots.length,n);
 dispatch(windowEvents,'keyup',{code:'Space'});const before=g.state().shots.length;dispatch(windowEvents,'keydown',{code:'Space'});assert(g.state().shots.length>before);if(id!=='pulse')assert.equal(g.state().arsenal.ammo[id],ammo-1);
 const after=g.state().shots.length;dispatch(windowEvents,'keyup',{code:'Space'});dispatch(windowEvents,'keydown',{code:'Space'});assert.equal(g.state().shots.length,after,'single shot cadence must be bounded');assert(g.state().cannonRecovery<recovery);
 const ammoAfterTap=g.state().arsenal.ammo[id];for(let i=0;i<115;i++)g.update(1/60);assert.equal(g.state().overheated,false);if(id!=='pulse')assert(g.state().arsenal.ammo[id]<ammoAfterTap,'held fire resumes automatically');
});
check('switching cannons or pausing cannot clear recovery; missiles remain usable',()=>{
 startRecovery();g.state().arsenal.owned.push('breach');g.state().arsenal.ammo.breach=10;wheel(100);mouseDown(1);assert.equal(g.state().arsenal.equipped,'breach');assert(g.state().overheated);
 const cooldown=g.state().cannonRecovery;g.pauseGame();g.resumePlay();assert.equal(g.state().cannonRecovery,cooldown);assert(g.state().overheated);const missiles=g.player.missiles;g.fire(true);assert.equal(g.player.missiles,missiles-1);
});
check('a brief burst stays automatic and release cools it without a forced recovery',()=>{
 g.beginNew();resetFlight();g.state().enemies.splice(0);dispatch(windowEvents,'keydown',{code:'Space'});for(let i=0;i<90;i++)g.update(1/60);assert(!g.state().overheated);assert(g.state().cannonBurst>1.4);dispatch(windowEvents,'keyup',{code:'Space'});for(let i=0;i<90;i++)g.update(1/60);assert.equal(g.state().cannonBurst,0);assert(!g.state().overheated);
});

check('shield scarcity uses exact ordinary, heavy, critical and Warden drop thresholds',()=>{
 g.configure({upgrades:{cannon:0,shield:2,engine:0}});
 function sequence(values,fn){const random=Math.random;let i=0;Math.random=()=>values[i++]??.99;try{return fn();}finally{Math.random=random;}}
 function drop(type,roll){const start=g.state().pickups.length;sequence([roll,.99],()=>g.dropEnemySupplies({type,mesh:{position:g.player.pos.clone()}}));return g.state().pickups.slice(start);}
 for(const critical of [false,true]){
  g.player.shield=g.maxShield()*.25+(critical?0:.01);
  for(const [type,chance,value]of [['drone',critical?.45:.24,25],['evader',critical?.45:.24,25],['heavy',critical?.45:.4,35]]){
   const success=drop(type,chance-.000001);assert.equal(success.length,1);assert.equal(success[0].type,'shield');assert.equal(success[0].value,value);assert.equal(drop(type,chance).length,0);
  }
  assert.equal(drop('warden',.999999)[0].value,60);
 }
 g.player.shield=g.maxShield();let start=g.state().pickups.length;
 sequence([.99,0,.25],()=>g.dropEnemySupplies({type:'drone',mesh:{position:g.player.pos.clone()}}));assert.deepEqual(g.state().pickups.slice(start).map(p=>[p.type,p.value]),[['missile',2]]);
 start=g.state().pickups.length;sequence([0,0,.75],()=>g.dropEnemySupplies({type:'drone',mesh:{position:g.player.pos.clone()}}));assert.deepEqual(g.state().pickups.slice(start).map(p=>[p.type,p.value]),[['shield',25],['missile',4]]);
});
check('space and new-sector transitions clear reactor key and reactor sound',()=>{
 const oldEffects=[...g.art.moving];g.configure({nextMine:1,mode:'play'});g.makeSpace();assert.equal(g.art.moving.length,0);g.movePlayer(0);assert.equal(g.audio.lastState.reactor,0);assert.equal(g.audio.lastState.space,true);assert(!g.state().hasReactorKey);assert.equal(g.reactorProximity(),0);
 g.makeMine(1);assert.equal(g.art.moving.length,24);assert(g.art.moving.every(s=>!oldEffects.includes(s)));g.movePlayer(0);assert.equal(g.audio.lastState.reactor,0);assert(!g.state().hasReactorKey);assert.equal(g.state().currentRoom,0);assert(!g.state().gateSeen);
});
fs.unlinkSync(testModule);
console.log(`${count} mechanical checks passed using actual Three.js math, geometry, and raycasting. Browser GPU/audio rendering not exercised.`);
