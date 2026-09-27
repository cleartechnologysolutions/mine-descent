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
let source=fs.readFileSync(root+'/src/game.js','utf8').replace("'/three.module.min.js'",JSON.stringify('file://'+root+'/src/vendor/three.module.js')).replace("'/art.js'",JSON.stringify('file://'+root+'/src/art.js')).replace("'/robots.js'",JSON.stringify('file://'+root+'/src/robots.js')).replace("'/layouts.js'",JSON.stringify('file://'+root+'/src/layouts.js')).replace("'/weapons.js'",JSON.stringify('file://'+root+'/src/weapons.js')).replace("import {installMultiplayer} from '/multiplayer.js';",'const installMultiplayer=api=>{globalThis.multiplayerTestApi=api;return {active:false};};').replace('new T.WebGLRenderer','new globalThis.MockRenderer');
source+='\nexport {T,scene,player,keys,makeMine,makeSpace,beginNew,restore,refill,allowed,pointInside,pathTo,visible,segmentDistance,movePlayer,updateShots,update,fire,damage,destroyReactor,enemyHit,interactSpace,objectiveTarget,readCheckpoint,saveCheckpoint,pauseGame,resumePlay,maxShield,openUpgrade,closeUpgrade,spawnPickup,createShot,makeMineLayout,updateDoors,positionDoor,updateExploration,hitGenerator,updateReactorShield,updateEnemies,drawMap,drawSteering,sphereEntry,updatePickups,updateHUD,browseCannon,selectCannon,CANNONS,cleanArsenal,updateCannonCooling,reactorProximity,reactorSignal,dropEnemySupplies,audio,art};\nexport const state=()=>({mode,zone,mine,nextMine,stage,enemies,shots,particles,walls,rooms,links,reactor,doors,generators,visitedRooms,mineLayout,coreFound,hasReactorKey,gateSeen,wingEntered,currentRoom,pendingUpgrades,score,salvage,upgrades,pickups,spaceObjects,checkpoint,arsenal,browsedCannon,browseUntil,fireWait,overheated,cannonBurst,cannonRecovery});\nexport function configure(values){if(values.mode)mode=values.mode;if(values.nextMine!==undefined)nextMine=values.nextMine;if(values.stage)stage=values.stage;if(values.upgrades)upgrades=values.upgrades;if(values.fireWait!==undefined)fireWait=values.fireWait;if(values.pendingUpgrades!==undefined)pendingUpgrades=values.pendingUpgrades;}\n';
const testModule=(await import('node:os')).tmpdir()+'/voidbreak-game-under-test-'+process.pid+'.mjs';fs.writeFileSync(testModule,source);const g=await import('file://'+testModule+'?t='+Date.now());const vec=(...a)=>new g.T.Vector3(...a);let count=0;function check(label,fn){fn();count++;console.log('PASS '+label);}

const {createEngine}=await import('../worker/engine.js');
const engine=createEngine(),api=globalThis.multiplayerTestApi;api.reset(0);api.start();
let effectId=0;
for(const w of g.CANNONS){
 const snapshot=engine.snapshot();snapshot.shots=[{id:100+effectId,pos:[0,0,3],q:[0,0,0,1],type:w.id==='pulse'?'laser':w.id,enemy:false,owner:0}];
 snapshot.effects=[{id:++effectId,kind:'sound',sound:w.sound,pos:[0,0,9],owner:0,volume:1,kick:w.kick}];
 const before=g.audio.sounds.length;api.render(snapshot,0,.016);api.render(snapshot,0,.016);
 const sounds=g.audio.sounds.slice(before).filter(x=>x.name===w.sound);assert.equal(sounds.length,1,w.id+' sound should play once');assert.equal(sounds[0].volume,1);assert.equal(sounds[0].pan,0);
 let matched=false;g.scene.traverse(o=>{if(o.isMesh&&o.position.equals(vec(0,0,3))&&o.material.color?.getHex()===w.color&&o.scale.equals(vec(...w.size)))matched=true;});assert(matched,w.id+' original projectile visual');
}
const pilot=engine.debug.pilots[0];pilot.arsenal.owned.push('breach');pilot.arsenal.ammo.breach=20;engine.input(0,{keys:['Space'],weapon:'breach'});engine.step(.05);
const snapshot=engine.snapshot();assert.equal(snapshot.effects.filter(x=>x.sound==='breach').length,1);assert.equal(snapshot.shots.filter(x=>x.type==='breach').length,5);
assert.equal(pilot.arsenal.ammo.breach,19);
engine.dispose();console.log('PASS: four original weapon visuals/sounds, full local volume, repeated snapshot deduplication, one Breach sound for five pellets');
