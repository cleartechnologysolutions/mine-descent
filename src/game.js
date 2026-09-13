import * as T from '/three.module.min.js';
import {IndustrialArt,CinematicPass} from '/art.js';
import {createRobot} from '/robots.js';
import {makeMineLayout} from '/layouts.js';
import {CANNONS,cannonById,cleanArsenal} from '/weapons.js';
const $=id=>document.getElementById(id), clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const canvas=$('game'),audio=new window.VoidAudio();
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('unsupported').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const art=new IndustrialArt(T,renderer),cinema=new CinematicPass(T,renderer,Math.round(innerWidth*Math.min(devicePixelRatio,1.7)),Math.round(innerHeight*Math.min(devicePixelRatio,1.7)));
const scene=new T.Scene(),camera=new T.PerspectiveCamera(77,innerWidth/innerHeight,.12,7000);scene.add(camera);
let world=new T.Group();scene.add(world);const amb=new T.AmbientLight(0xa1aab3,.3);scene.add(amb);const headlight=new T.SpotLight(0xd8e2df,1600,100,Math.PI*.29,.5,2);camera.add(headlight);headlight.position.set(0,-.15,0);const headTarget=new T.Object3D();headTarget.position.set(0,0,-20);camera.add(headTarget);headlight.target=headTarget;headlight.castShadow=true;headlight.shadow.mapSize.set(1024,1024);headlight.shadow.bias=-.0004;headlight.shadow.normalBias=.08;headlight.shadow.camera.near=.5;headlight.shadow.camera.far=90;
const flashLight=new T.PointLight(0xff9864,0,65,1.5);scene.add(flashLight);
const keys=new Set(), mouse={left:false,right:false}, steering={x:0,y:0};
const steeringDeadzone=.055, steeringAxis=V(), steeringRotation=new T.Quaternion();const raycaster=new T.Raycaster();
let flightInputActive=false,pendingUpgrades=0,coreFound=false;
let mineLayout=null,doors=[],generators=[],visitedRooms=new Set();
let mode='menu',zone='mine',mine=0,nextMine=1,stage='search',enemies=[],shots=[],particles=[],pickups=[],walls=[],rooms=[],links=[],spaceObjects=[],decor=[],reactor=null,time=0,toastTime=0,hitTime=0,damageFlash=0,shake=0,fireWait=0,missileWait=0,overheated=false,killCount=0,score=0,salvage=0,volume=.65,difficulty='normal',mapExpanded=false,checkpoint=null,spaceReady=false,combo=0,comboTime=0;
let upgrades={cannon:0,shield:0,engine:0};
let arsenal=cleanArsenal(),browsedCannon='pulse',browseUntil=0,wheelDelta=0,wheelAt=-1,cannonBurst=0,cannonRecovery=0;
let player={pos:V(),q:new T.Quaternion(),vel:V(),shield:100,hull:100,heat:0,boost:100,missiles:6,lastHit:-100};
const names=['IRON HOLLOW','FRACTURE WORKS','HELIX CORE'],colours=[0x40d9ce,0xfb9a43,0xb487fa],diff=()=>difficulty==='easy'?.6:difficulty==='hard'?1.3:1;
const tmp=V(),tmp2=V(),forward=V(),right=V(),up=V();
const mat=(color,emissive=0)=>new T.MeshStandardMaterial({color,roughness:.7,metalness:.45,emissive,emissiveIntensity:1,flatShading:false});
const rockmat=art.materials.rock,wallmat=art.materials.armor,darkmat=art.materials.rubber,edgemat=art.materials.steel,goldmat=art.materials.brass;
const geometries={box:new T.BoxGeometry(1,1,1),sphere:new T.IcosahedronGeometry(1,1),octa:new T.OctahedronGeometry(1),bolt:new T.SphereGeometry(1,6,4)};
function mesh(geo,material,pos,scale,parent=world){const m=new T.Mesh(geo,material);m.position.copy(pos);if(scale)m.scale.copy(scale);parent.add(m);return m;}
function box(pos,size,material=wallmat,parent=world){return mesh(geometries.box,material,pos,size,parent);}
function glow(color){return new T.MeshBasicMaterial({color});}
function line(a,b,color=0x7fffe5,parent=world){const g=new T.BufferGeometry().setFromPoints([a,b]);const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.75}));parent.add(l);return l;}
const starsG=new T.BufferGeometry(),starArray=[];for(let i=0;i<2800;i++){const p=V(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(2500+Math.random()*2000);starArray.push(p.x,p.y,p.z);}starsG.setAttribute('position',new T.Float32BufferAttribute(starArray,3));const stars=new T.Points(starsG,new T.PointsMaterial({color:0xaed8ff,size:2.2,sizeAttenuation:true}));scene.add(stars);
const cockpit=art.cockpit(camera);cockpit.visible=false;
function clearWorld(){resetCannonBrowse();art.reset();const keepMats=new Set([rockmat,wallmat,darkmat,edgemat,goldmat]),seenMats=new Set(),seenGeo=new Set();world.traverse(o=>{if(o.geometry&&!Object.values(geometries).includes(o.geometry)&&!seenGeo.has(o.geometry)){seenGeo.add(o.geometry);o.geometry.dispose();}for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&!m.userData.shared&&!keepMats.has(m)&&!seenMats.has(m)){seenMats.add(m);m.userData.ownedTexture?.dispose();m.dispose();}});scene.remove(world);world=new T.Group();scene.add(world);enemies=[];shots=[];particles=[];pickups=[];walls=[];rooms=[];links=[];decor=[];spaceObjects=[];reactor=null;doors=[];generators=[];visitedRooms=new Set();coreFound=false;mineLayout=null;fireWait=0;missileWait=0;overheated=false;cannonBurst=0;cannonRecovery=0;player.heat=0;mouse.left=false;mouse.right=false;centerSteering();flashLight.intensity=0;}
function disposeGroup(group){const seen=new Set();group.traverse(o=>{if(o.geometry&&!Object.values(geometries).includes(o.geometry))o.geometry.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m&&!m.userData.shared&&!seen.has(m)&&![rockmat,wallmat,darkmat,edgemat,goldmat].includes(m)){seen.add(m);m.userData.ownedTexture?.dispose();m.dispose();}});}
function toast(text,seconds=3.5){$('toast').textContent=text;toastTime=seconds;$('toast').style.opacity=1;}
function roomWall(c,axis,sign,opening,color,index){return art.wall(world,c,axis,sign,opening,walls,index);}
function makeMine(index){
 clearWorld();zone='mine';mine=index;stage='search';mineLayout=makeMineLayout(index);
 scene.background=new T.Color(0x07090a);scene.fog=new T.FogExp2(0x11171b,.010);
 amb.intensity=.48;headlight.intensity=1600;stars.visible=false;
 rooms=mineLayout.coords.map(a=>V(...a));links=mineLayout.links;
 const color=colours[index];
 for(let i=0;i<rooms.length;i++){
  const c=rooms[i];
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const target=c.clone().setComponent(axis,c.getComponent(axis)+sign*50);
   const neighbor=rooms.findIndex(p=>p.distanceTo(target)<1);
   const opening=links.some(([a,b])=>(a===i&&b===neighbor)||(b===i&&a===neighbor));
   roomWall(c,axis,sign,opening,color,i);
  }
  walls.push(art.room(world,c,i));
 }
 for(const [a,b]of links)makeTunnel(rooms[a],rooms[b],color);
 art.batchEnvironment(world);
 // Moving assemblies are created after the static environment is batched.
 links.forEach(([a,b],i)=>{if(i%2===0||a===mineLayout.coreRoom||b===mineLayout.coreRoom)makeDoor(a,b);});
 const coreRoom=mineLayout.coreRoom,built=art.reactor(world,rooms[coreRoom].clone().add(V(0,1,0)));
 reactor={mesh:built.group,core:built.core,shield:built.shield,hp:420+index*200,maxHp:420+index*200,room:coreRoom,active:false};
 reactor.shield.material.opacity=.2;
 art.obstacles.push({min:reactor.mesh.position.clone().add(V(-5.8,-12,-5.8)),max:reactor.mesh.position.clone().add(V(5.8,12,5.8))});
 for(const offset of [V(-11,-5,-9),V(11,-5,-9),V(0,8,11)])makeGenerator(rooms[coreRoom].clone().add(offset));
 let id=0;
 for(let r=0;r<rooms.length;r++){
  if(r===coreRoom||mineLayout.cacheRooms.includes(r))continue;
  const deep=mineLayout.distanceToCore[r]<=2,n=r===0?1:deep?2+index%2:1+(r%3===0?1:0);
  for(let i=0;i<n;i++){
   const type=deep?'evader':r>2&&i===0&&r%3===0?'heavy':'drone';
   spawnEnemy(rooms[r].clone().add(V(i%2?7:-7,i%2?5:-5,-6+i*7)),type,r,id++);
  }
 }
 const guardianPositions=[V(9.8,6,-10.3),V(-9,5,7),V(9,-5,8)];
 guardianPositions.forEach((offset,i)=>{const e=spawnEnemy(rooms[coreRoom].clone().add(offset),i===0?'warden':'evader',coreRoom,id++);e.guardian=true;});
 for(const r of mineLayout.cacheRooms)spawnPickup(rooms[r].clone(),'cache',90+index*20);
 // Each mine introduces one new cannon; missed earlier models can be recovered here too.
 const available=CANNONS.filter(w=>w.level>0&&w.level<=index+1);
 for(const [i,w]of [...available].reverse().entries()){
  const room=mineLayout.cacheRooms[i%mineLayout.cacheRooms.length];
  spawnPickup(rooms[room].clone().add(V(5,2,-4)),arsenal.owned.includes(w.id)?'cannonAmmo':'cannon',arsenal.owned.includes(w.id)?w.pack:w.initial,w.id);
  for(const [j,r]of mineLayout.resupplyRooms.entries())if(j%available.length===i||j===mineLayout.resupplyRooms.length-1)
   spawnPickup(rooms[r].clone().add(V(-5+i*5,-3,-5)),'cannonAmmo',w.pack,w.id);
 }
 for(const [i,r]of mineLayout.resupplyRooms.entries()){
  spawnPickup(rooms[r].clone().add(V(-6,2,5)),'shield',35);
  spawnPickup(rooms[r].clone().add(V(6,2,5)),i%2?'cache':'missile',i%2?35:4);
 }
 player.pos.set(0,0,9);player.q.identity();player.vel.set(0,0,0);player.lastHit=time-8;
 killCount=0;visitedRooms.add(0);world.updateMatrixWorld(true);art.updateLighting(player.pos);
 audio.music('mine');$('sector').textContent=String(index+1).padStart(2,'0')+' / '+names[index];
 toast('Find the reactor deep inside the mine. Bulkhead doors open as you approach.',5);updateObjectives();
}
function makeDoor(a,b){
 const center=rooms[a].clone().add(rooms[b]).multiplyScalar(.5),delta=rooms[b].clone().sub(rooms[a]);
 const axis=delta.x?0:delta.y?1:2,root=new T.Group();root.position.copy(center);
 root.quaternion.setFromUnitVectors(V(0,0,1),delta.normalize());world.add(root);
 const panels=[];
 for(const side of [-1,1]){
  const panel=new T.Group();root.add(panel);panel.position.x=side*4.2;
  const slab=art.box(panel,[0,0,0],[8.52,16.5,1.15],wallmat);
  for(const face of [-1,1]){
   art.box(panel,[0,0,face*.67],[7.8,14.8,.18],darkmat);
   for(const y of [-5,0,5])art.box(panel,[0,y,face*.82],[7.6,.35,.24],edgemat);
   art.box(panel,[-side*3.7,0,face*.85],[.14,11,.06],art.emissive(0xffa760,1.6));
   for(const y of [-6,6])for(const x of [-2,0,2]){const stripe=art.box(panel,[x,y,face*.9],[.55,1.1,.05],art.materials.yellow);stripe.rotation.z=.6;}
  }
  const bounds=new T.Box3();slab.userData.rayBounds=bounds;panels.push({mesh:panel,slab,side,box:bounds});walls.push(slab);
 }
 for(const x of [-8.8,8.8])art.box(root,[x,0,0],[.5,17.8,2.2],edgemat);
 for(const y of [-8.8,8.8])art.box(root,[0,y,0],[18,.5,2.2],edgemat);
 const door={root,center,axis,panels,open:0,hold:0,opening:false};doors.push(door);positionDoor(door);
}
function positionDoor(door){
 for(const panel of door.panels)panel.mesh.position.x=panel.side*(4.2+door.open*8.6);
 door.root.updateMatrixWorld(true);
 for(const panel of door.panels)panel.box.setFromObject(panel.slab);
}
function updateDoors(dt){
 for(const door of doors){
  const delta=player.pos.clone().sub(door.center),cross=[0,1,2].filter(a=>a!==door.axis);
  const near=Math.abs(delta.getComponent(door.axis))<27&&cross.every(a=>Math.abs(delta.getComponent(a))<11);
  const occupied=door.open>0&&enemies.some(e=>{const d=e.mesh.position.clone().sub(door.center);return Math.abs(d.getComponent(door.axis))<7+e.r&&cross.every(a=>Math.abs(d.getComponent(a))<9+e.r);});
  door.hold=near||occupied?1.25:Math.max(0,door.hold-dt);
  const opening=door.hold>0;
  if(opening!==door.opening&&door.center.distanceTo(player.pos)<55)audio.sfx('door',pan(door.center),.65);
  door.opening=opening;const next=clamp(door.open+(opening?3:-1.5)*dt,0,1);
  if(next!==door.open){door.open=next;positionDoor(door);}
 }
}
function makeGenerator(pos){
 const root=new T.Group();root.position.copy(pos);world.add(root);
 for(const y of [-2.1,2.1])art.box(root,[0,y,0],[3.4,.6,3.4],wallmat);
 for(const x of [-1.55,1.55])art.box(root,[x,0,0],[.3,4.3,2.8],edgemat);
 const core=mesh(new T.CylinderGeometry(1.15,1.15,3.6,12),art.emissive(0xa592ff,3),V(),null,root);
 for(const axis of [0,1]){const ring=mesh(new T.TorusGeometry(2,.12,6,32),art.emissive(0xc1afff,2),V(),null,root);if(axis)ring.rotation.x=Math.PI/2;}
 generators.push({mesh:root,core,pos:pos.clone(),hp:90+mine*30,r:2.3});
}
function hitGenerator(generator,amount){
 if(generator.hp<=0)return;generator.hp=Math.max(0,generator.hp-amount);hitTime=.12;
 if(generator.hp===0){generator.core.visible=false;world.remove(generator.mesh);disposeGroup(generator.mesh);explosion(generator.pos,0xb99cff,1.3);audio.sfx('explosion',pan(generator.pos),.6);score+=200;}
 updateReactorShield();
}
function updateReactorShield(){
 if(zone!=='mine'||!reactor)return;
 const active=generators.every(g=>g.hp<=0)&&!enemies.some(e=>e.guardian);
 if(active&&!reactor.active){reactor.active=true;reactor.shield.visible=false;stage='reactor';toast('Containment down. Destroy the reactor core!',4);audio.music('combat');}
 updateObjectives();
}
function updateExploration(){
 const entered=rooms.findIndex(r=>Math.abs(r.x-player.pos.x)<16&&Math.abs(r.y-player.pos.y)<16&&Math.abs(r.z-player.pos.z)<16);
 if(entered>=0&&!visitedRooms.has(entered)){
  visitedRooms.add(entered);
  if(entered===reactor?.room){coreFound=true;if(!reactor.active)stage='containment';toast('Reactor chamber. Destroy the shield relays and its guardians.',5);}
  updateObjectives();
 }
}
function makeTunnel(a,b,color){const delta=b.clone().sub(a),axis=delta.x?0:delta.y?1:2,c=a.clone().add(b).multiplyScalar(.5),other=[0,1,2].filter(i=>i!==axis);for(const cross of other)for(const sign of [-1,1]){const p=c.clone(),s=V(18,18,18);p.setComponent(cross,p.getComponent(cross)+sign*9);s.setComponent(axis,15);s.setComponent(cross,.65);walls.push(art.box(world,p.toArray(),s.toArray(),wallmat));}const supports=art.tunnel(world,a,b);walls.push(supports);}
function pointInside(p){
 if(rooms.some(c=>Math.abs(p.x-c.x)<16&&Math.abs(p.y-c.y)<16&&Math.abs(p.z-c.z)<16))return true;
 for(const [a,b]of links){const delta=rooms[b].clone().sub(rooms[a]),axis=delta.x?0:delta.y?1:2,c=rooms[a].clone().add(rooms[b]).multiplyScalar(.5);if([0,1,2].every(j=>Math.abs(p.getComponent(j)-c.getComponent(j))<(j===axis?26:8.65)))return true;}
 return false;
}
function allowed(p,r=1.15){
 if(art.blocked(p,r))return false;
 if(zone==='space')return !spaceObjects.some(o=>o.solid&&o.pos.distanceToSquared(p)<(o.radius+r)**2);
 for(const door of doors)if(door.center.distanceToSquared(p)<900&&door.panels.some(panel=>panel.box.distanceToPoint(p)<r))return false;
 if(generators.some(g=>g.hp>0&&g.pos.distanceToSquared(p)<(g.r+r)**2))return false;
 if(!pointInside(p))return false;
 for(let a=0;a<3;a++)for(const sign of [-1,1]){const n=p.clone();n.setComponent(a,n.getComponent(a)+sign*r);if(!pointInside(n))return false;}
 return true;
}
// The mouse is a virtual joystick: displacement sets a sustained angular rate.
// Use the ordinary cursor position; no browser mouse capture is required.
function steeringRadius(){return clamp(Math.min(innerWidth,innerHeight)*.28,100,230);}
function drawSteering(){
 const radius=steeringRadius(),x=steering.x*radius,y=steering.y*radius,length=Math.hypot(x,y);
 const active=length>radius*steeringDeadzone;
 $('steeringCursor').style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;
 $('steeringCursor').style.opacity=active?'.9':'.2';
 $('steeringTether').style.width=length+'px';
 $('steeringTether').style.transform=`rotate(${Math.atan2(y,x)}rad)`;
 $('steeringTether').style.opacity=active?'.45':'0';
 $('steeringCenter').style.width=$('steeringCenter').style.height=radius*steeringDeadzone*2+'px';
}
function centerSteering(){steering.x=0;steering.y=0;drawSteering();}
function steerPlayer(dt){
 const magnitude=Math.hypot(steering.x,steering.y);
 if(magnitude<=steeringDeadzone)return;
 const response=Math.pow(clamp((magnitude-steeringDeadzone)/(1-steeringDeadzone),0,1),1.35);
 const rate=2.2*Number($('sensitivity').value)/80;
 steeringAxis.set(-steering.y*($('invert').checked?-1:1),-steering.x,0).normalize();
 player.q.multiply(steeringRotation.setFromAxisAngle(steeringAxis,response*rate*dt)).normalize();
}
function movePlayer(dt){updateDoors(dt);steerPlayer(dt);const braking=mouse.left&&mouse.right;const local=V((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),(keys.has('KeyR')||keys.has('ArrowUp')?1:0)-(keys.has('KeyF')||keys.has('ArrowDown')?1:0),(mouse.right||keys.has('KeyS')?1:0)-(mouse.left||keys.has('KeyW')?1:0));if(braking)local.set(0,0,0);if(local.length()>1)local.normalize();const boost=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&player.boost>1&&local.length()>0;const speed=(zone==='space'?74:21)*(boost?2.1:1)*(1+upgrades.engine*.12);const desired=local.applyQuaternion(player.q).multiplyScalar(speed);const response=braking?24:desired.lengthSq()===0?14:player.vel.dot(desired)<0?16:8;player.vel.lerp(desired,1-Math.exp(-dt*response));if(desired.lengthSq()===0&&player.vel.lengthSq()<.0025)player.vel.set(0,0,0);player.boost=clamp(player.boost+(boost?-29:18+upgrades.engine*7)*dt,0,100);const steps=Math.ceil(player.vel.length()*dt/.8)||1;for(let i=0;i<steps;i++){for(let axis=0;axis<3;axis++){const p=player.pos.clone();p.setComponent(axis,p.getComponent(axis)+player.vel.getComponent(axis)*dt/steps);if(allowed(p))player.pos.copy(p);else{if(Math.abs(player.vel.getComponent(axis))>12){shake=Math.max(shake,.08);if(time-player.lastHit>1.5)damage(2,'collision');}player.vel.setComponent(axis,0);}}}
const roll=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*dt*1.5;if(roll)player.q.multiply(new T.Quaternion().setFromAxisAngle(V(0,0,1),roll)).normalize();
if(zone==='mine'){updateExploration();art.updateLighting(player.pos);}audio.update({speed:player.vel.length()/(zone==='space'?150:45),boost,combat:enemies.some(e=>e.mesh.position.distanceTo(player.pos)<60)?1:0,danger:player.hull<30?.7:0,space:zone==='space'},dt);}
function spawnEnemy(pos,type,room,id){
 const evader=type==='evader',model=createRobot(T,evader?'drone':type,art.materials),g=model.group;
 g.position.copy(pos);world.add(g);const scale=evader?.64:1;g.scale.setScalar(scale);
 const e={mesh:g,body:model.body,eye:model.eye,model,pos:pos.clone(),type,evader,r:(model.radius||3)*scale,room,id,
 hp:(type==='warden'?360:type==='heavy'?95:evader?64:54)*(1+mine*.2),shot:1.5+Math.random()*2,phase:Math.random()*6,
 flash:0,charge:0,charging:false,awake:false,servo:2+Math.random()*5,guardian:false,inSight:false};
 if(evader){model.eye.material.emissive.setHex(0xae84ff);model.eye.material.color.setHex(0x3d235a);}
 enemies.push(e);return e;
}
function spawnPickup(pos,type,value,weapon=null){const w=cannonById(weapon),g=art.pickup(world,pos,type,w?.color);pickups.push({mesh:g,type,value,weapon,baseY:pos.y});}
function ownedCannons(){return CANNONS.filter(w=>arsenal.owned.includes(w.id));}
function resetCannonBrowse(){browsedCannon=arsenal.equipped;browseUntil=0;wheelDelta=0;$('weaponPicker').hidden=true;}
function cannonAmmoText(w){return w.level?arsenal.ammo[w.id]+' '+w.ammoName:'UNLIMITED AMMO';}
function drawCannonPicker(){
 const list=$('cannonOptions');list.replaceChildren();
 for(const w of ownedCannons()){
  const row=document.createElement('div');row.className='cannonOption'+(w.id===browsedCannon?' browsing':'');
  row.style.borderColor=w.id===browsedCannon?'#'+w.color.toString(16).padStart(6,'0'):'';
  row.innerHTML='<span>'+w.name+(w.id===arsenal.equipped?' <small>EQUIPPED</small>':'')+'</span><b>'+cannonAmmoText(w)+'</b>';list.append(row);
 }
 $('cannonDescription').textContent=cannonById(browsedCannon).description;
 $('weaponPicker').hidden=mode!=='play'||browseUntil<=time;
}
function browseCannon(step){
 if(mode!=='play'||!flightInputActive)return;
 const available=ownedCannons();if(browseUntil<=time)browsedCannon=arsenal.equipped;
 const index=available.findIndex(w=>w.id===browsedCannon);browsedCannon=available[(index+step+available.length)%available.length].id;
 browseUntil=time+6;drawCannonPicker();audio.sfx('click',0,.6);
}
function selectCannon(){
 if(mode!=='play'||!flightInputActive||browseUntil<=time)return;
 const w=cannonById(browsedCannon);if(!w||!arsenal.owned.includes(w.id))return;
 arsenal.equipped=w.id;resetCannonBrowse();audio.sfx('equip');
 toast(w.name+' equipped'+(w.level&&arsenal.ammo[w.id]===0?' · Empty. Find '+w.ammoName.toLowerCase()+'.':''),2);
}

// Broad phase keeps distant rooms out of local gun and visibility raycasts.
const collisionSegment=new T.Box3(),collisionEnd=V();
function intersectWalls(){
 const origin=raycaster.ray.origin;collisionEnd.copy(raycaster.ray.direction).multiplyScalar(raycaster.far).add(origin);
 collisionSegment.setFromPoints([origin,collisionEnd]).expandByScalar(.01);
 const candidates=walls.filter(w=>{const bounds=w.userData.rayBounds||(w.userData.rayBounds=new T.Box3().setFromObject(w));return bounds.intersectsBox(collisionSegment);});
 return raycaster.intersectObjects(candidates,true);
}
function visible(a,b){
 const d=b.clone().sub(a),len=d.length();d.normalize();raycaster.set(a,d);raycaster.far=len-.3;
 if(intersectWalls().length)return false;
 const cover=[...(reactor?[{pos:reactor.mesh.position,r:5.8}]:[]),...generators.filter(g=>g.hp>0)];
 return !cover.some(o=>a.distanceTo(o.pos)>o.r+.1&&b.distanceTo(o.pos)>o.r+.1&&sphereEntry(a,d,len-.3,o.pos,o.r)<Infinity);
}
function beginCannonRecovery(){
 if(overheated)return;overheated=true;cannonRecovery=2.2;cannonBurst=0;player.heat=100;fireWait=Math.max(fireWait,.45);
 toast('Rapid fire cooling. Tap Space for single shots.',2.2);
}
function updateCannonCooling(dt){
 if(overheated){
  cannonRecovery=Math.max(0,cannonRecovery-dt);player.heat=Math.max(0,player.heat-dt*40);
  if(cannonRecovery===0){overheated=false;player.heat=Math.min(player.heat,18);cannonBurst=0;}
 }else{
  player.heat=Math.max(0,player.heat-dt*21);
  cannonBurst=flightInputActive&&keys.has('Space')?cannonBurst+dt:Math.max(0,cannonBurst-dt*2);
  if(cannonBurst>=4)beginCannonRecovery();
 }
}
function fire(missile=false,manual=true){
 if(mode!=='play')return;const wait=missile?missileWait:fireWait;if(wait>0)return;
 if(missile&&player.missiles<=0){toast('No missiles. Find an orange resupply.',1.5);missileWait=.6;return;}
 if(!missile&&overheated&&!manual)return;
 const weapon=cannonById(arsenal.equipped);
 if(!missile&&weapon.level&&arsenal.ammo[weapon.id]<=0){
  arsenal.equipped='pulse';resetCannonBrowse();toast(weapon.name+' empty. Pulse Cannon online.',2.5);
  audio.sfx('equip',0,.6);fireWait=.18;return;
 }
 const dir=V(0,0,-1).applyQuaternion(player.q),pos=player.pos.clone().addScaledVector(dir,2);let target=null,best=missile?.82:.989;
 for(const e of enemies){const d=e.mesh.position.clone().sub(pos),dot=d.clone().normalize().dot(dir);if(dot>best&&dot>(e.evader?(missile?.91:.9994):-1)&&d.length()<(zone==='space'?500:110)&&visible(pos,e.mesh.position)){target=e;best=dot;}}
 if(!missile&&target)dir.copy(target.mesh.position).sub(pos).normalize();
 if(missile){player.missiles--;missileWait=.75;}
 else{if(weapon.level)arsenal.ammo[weapon.id]--;fireWait=overheated?Math.max(.45,weapon.interval):weapon.interval/(1+upgrades.cannon*.08);if(!overheated){player.heat=clamp(player.heat+weapon.heat,0,100);if(player.heat>=99)beginCannonRecovery();}}
 const offsets=!missile&&weapon.id==='pulse'&&upgrades.cannon>0?[-.65,.65]:[missile?0:Math.random()>.5?.65:-.65];
 const pellets=!missile&&weapon.id==='breach'?[[0,0],[-.065,0],[.065,0],[0,-.065],[0,.065]]:[[0,0]];
 const shipRight=V(1,0,0).applyQuaternion(player.q),shipUp=V(0,1,0).applyQuaternion(player.q);
 for(const off of offsets){
  const origin=pos.clone().addScaledVector(shipRight,off),muzzle=origin.clone().sub(player.pos);raycaster.set(player.pos,muzzle.clone().normalize());raycaster.far=muzzle.length();const block=intersectWalls();if(block.length)origin.copy(block[0].point).addScaledVector(muzzle.normalize(),-.1);
  for(const [x,y]of pellets)createShot(origin,dir.clone().addScaledVector(shipRight,x).addScaledVector(shipUp,y).normalize(),missile?'missile':weapon.id==='pulse'?'laser':weapon.id,false,target);
 }
 audio.sfx(missile?'missile':weapon.sound);shake=Math.max(shake,missile?.13:weapon.kick);
 if(browseUntil>time)drawCannonPicker();
}
function createShot(pos,dir,type,enemy=false,target=null){
 const weapon=cannonById(type==='laser'?'pulse':type),color=enemy?0xff5136:type==='missile'?0xffc976:weapon.color;
 const m=mesh(geometries.bolt,glow(color),pos,type==='missile'?V(.25,.25,.7):enemy?V(.12,.12,.85):V(...weapon.size));m.quaternion.setFromUnitVectors(V(0,0,1),dir);
 shots.push({mesh:m,dir:dir.clone(),speed:enemy?(zone==='space'?72:29+mine*5):type==='missile'?(zone==='space'?150:66):zone==='space'?weapon.spaceSpeed:weapon.speed,
  life:enemy?5:zone==='space'?4:2,type,enemy,target,color,splash:weapon?.splash||0,splashRadius:weapon?.splashRadius||0,
  damage:enemy?(6+mine*2)*diff():type==='missile'?100:weapon.damage+upgrades.cannon*3});
}
function segmentDistance(p,a,b){const ab=b.clone().sub(a),t=clamp(p.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),.001),0,1);return p.distanceTo(a.clone().addScaledVector(ab,t));}
function explosion(pos,color=0xff8b43,scale=1){art.burst(world,pos,scale,color);for(let i=0;i<Math.floor(20*scale);i++){const velocity=V(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar((5+Math.random()*15)*scale);const m=mesh(geometries.bolt,glow(i%3===0?0xffffd1:color),pos,V(.13,.13,.13).multiplyScalar(scale));particles.push({mesh:m,vel:velocity,life:.3+Math.random()*.7,max:1,scale});}if(particles.length>450){for(const p of particles.splice(0,particles.length-450)){world.remove(p.mesh);p.mesh.material.dispose();}}flashLight.position.copy(pos);flashLight.color.setHex(color);flashLight.intensity=Math.max(flashLight.intensity,160*scale);}
function dropEnemySupplies(e){
 const low=player.shield<=maxShield()*.25;
 const chance=e.type==='warden'?1:Math.max(e.type==='heavy'?.75:.5,low?.85:0);
 if(Math.random()<chance)spawnPickup(e.mesh.position.clone(),'shield',e.type==='warden'?60:e.type==='heavy'?35:25);
 // Missile salvage remains an independent reward; shield drops do not replace it.
 if(Math.random()<.12)spawnPickup(e.mesh.position.clone(),'missile',Math.random()<.5?2:4);
}
function enemyHit(e,amount){e.hp-=amount;e.flash=.11;e.body.material.emissive.setHex(0xffdbb5);hitTime=.12;if(e.hp<=0&&enemies.includes(e)){world.remove(e.mesh);disposeGroup(e.mesh);enemies.splice(enemies.indexOf(e),1);explosion(e.mesh.position,0xff7651,e.type==='warden'?2.3:1.2);audio.sfx(e.type==='warden'?'wardenDeath':'robotDeath',pan(e.mesh.position),1/(1+e.mesh.position.distanceToSquared(player.pos)/2500));combo=comboTime>0?combo+1:1;comboTime=4;score+=(e.type==='warden'?1000:e.type==='heavy'?220:100)*Math.min(combo,4);salvage+=e.type==='warden'?50:10;killCount++;dropEnemySupplies(e);if(e.type==='warden')toast('Warden destroyed.');updateReactorShield();}}
function pan(pos){return clamp(pos.clone().sub(player.pos).normalize().dot(V(1,0,0).applyQuaternion(player.q)),-1,1);}
function sphereEntry(origin,dir,maxDistance,center,radius){
 const offset=center.clone().sub(origin),projection=offset.dot(dir),squared=offset.lengthSq();
 if(squared<=radius*radius)return 0;
 const discriminant=radius*radius-(squared-projection*projection);
 if(discriminant<0)return Infinity;
 const distance=projection-Math.sqrt(discriminant);
 return distance>=0&&distance<=maxDistance?distance:Infinity;
}
function updateShots(dt){
 for(let i=shots.length-1;i>=0;i--){
  if(mode!=='play')break;const s=shots[i];s.life-=dt;
  if(s.type==='missile'&&s.target&&enemies.includes(s.target))s.dir.lerp(s.target.mesh.position.clone().sub(s.mesh.position).normalize(),1-Math.exp(-dt*4)).normalize();
  const old=s.mesh.position.clone(),travel=s.speed*dt;let distance=travel,hit=null;
  if(s.life>0){
   raycaster.set(old,s.dir);raycaster.far=travel;const obstruction=intersectWalls()[0];
   if(obstruction){distance=obstruction.distance;hit={type:'wall'};}
   const consider=(center,radius,type,object)=>{const d=sphereEntry(old,s.dir,travel,center,radius);if(d<distance){distance=d;hit={type,object};}};
   if(s.enemy){consider(player.pos,1.55,'player');if(reactor)consider(reactor.mesh.position,5.8,'wall');for(const g of generators)if(g.hp>0)consider(g.pos,g.r,'wall');}
   else{
    for(const e of enemies)consider(e.mesh.position,e.r+(e.evader?.16:.4),'enemy',e);
    if(reactor)consider(reactor.mesh.position,reactor.active?5:6.2,'reactor');
    for(const g of generators)if(g.hp>0)consider(g.pos,g.r,'generator',g);
   }
  }
  const end=old.clone().addScaledVector(s.dir,distance);
  if(hit?.type==='player')damage(s.damage,'enemy');
  else if(hit?.type==='enemy')enemyHit(hit.object,s.damage);
  else if(hit?.type==='generator')hitGenerator(hit.object,s.damage);
  else if(hit?.type==='reactor'){
   if(reactor.active){reactor.hp=Math.max(0,reactor.hp-s.damage);hitTime=.12;updateObjectives();if(reactor.hp===0){destroyReactor();return;}}
   else if(toastTime<=0)toast('Containment shield active. Destroy the relays and reactor guardians.',3);
  }
  s.mesh.position.copy(end);s.mesh.quaternion.setFromUnitVectors(V(0,0,1),s.dir);
  if(hit||s.life<=0){
   if((s.type==='missile'||s.splash>0)&&!s.enemy&&mode==='play'){
    const radius=s.type==='missile'?12:s.splashRadius,damage=s.type==='missile'?70:s.splash;
    explosion(end,s.color,1.4);audio.sfx('explosion',pan(end),s.type==='missile'?1:.65);
    for(const e of [...enemies])if(e!==hit?.object&&e.mesh.position.distanceTo(end)<radius&&visible(end,e.mesh.position))enemyHit(e,damage);
    for(const g of generators)if(g!==hit?.object&&g.hp>0&&g.pos.distanceTo(end)<radius&&visible(end,g.pos))hitGenerator(g,damage);
   }else if(s.life>0)explosion(end,s.color,.22);
   world.remove(s.mesh);s.mesh.material.dispose();shots.splice(i,1);
  }
 }
}
function damage(amount,source){if(mode!=='play')return;let remaining=amount;const absorbed=Math.min(player.shield,remaining);player.shield-=absorbed;remaining-=absorbed;player.hull=Math.max(0,player.hull-remaining);player.lastHit=time;damageFlash=.6;shake=Math.max(shake,.16);audio.sfx('hit');if(player.hull<=0)endGame(false,source==='reactor'?'The reactor took the mine with it.':'Hull integrity reached zero.');}
function destroyReactor(){
 if(zone!=='mine'||!reactor||!reactor.active||reactor.hp>0)return;
 score+=1500+mine*750;pendingUpgrades++;nextMine=mine+1;
 audio.sfx('reactor');makeSpace();refill(false);releaseControls();flightInputActive=true;camera.position.copy(player.pos);camera.quaternion.copy(player.q);camera.updateMatrixWorld();
 explosion(player.pos.clone().add(V(0,0,36)),0xffad63,4);shake=.4;
 toast(nextMine<3?'Reactor destroyed. Extraction complete. Fly to the next mine; U installs your upgrade.':'Final reactor destroyed. Extraction complete. Reach the jump gate.',6);
 saveCheckpoint();updateObjectives();
}
function updateEnemies(dt){for(const e of enemies){if(zone==='mine'&&e.pos.distanceToSquared(player.pos)>120*120){e.mesh.visible=false;e.inSight=false;continue;}e.mesh.visible=true;e.phase+=dt;const speed=e.evader?2.8:e.type==='warden'?.36:.65;if(zone==='space'){const chase=player.pos.clone().sub(e.pos),distance=chase.length();if(distance<550&&distance>65){const proposed=e.pos.clone().addScaledVector(chase.normalize(),dt*(e.type==='heavy'?22:37));if(allowed(proposed,e.r))e.pos.copy(proposed);}}const nextPosition=e.pos.clone().add(e.evader?V(Math.sin(e.phase*speed)*3.4,Math.cos(e.phase*2.1)*2.6,Math.sin(e.phase*1.7)*2.2):V(Math.sin(e.phase*speed)*1.7,Math.cos(e.phase*.8)*1.1,Math.sin(e.phase*.4)*1.2));if(zone==='space'||allowed(nextPosition,e.r))e.mesh.position.copy(nextPosition);e.mesh.lookAt(player.pos);e.shot-=dt;e.flash-=dt;if(e.flash<=0)e.body.material.emissive.setHex(0);const dist=e.mesh.position.distanceTo(player.pos),inSight=dist<(zone==='space'?380:85)&&visible(e.mesh.position,player.pos),volume=1/(1+dist*dist/(zone==='space'?18000:2200)),prefix=e.type==='warden'?'warden':'robot';e.inSight=inSight;if(inSight&&!e.awake){e.awake=true;e.shot=Math.max(e.shot,1.6);audio.sfx(prefix+'Wake',pan(e.mesh.position),volume);}e.servo-=dt;if(inSight&&e.servo<=0){audio.sfx(prefix+'Move',pan(e.mesh.position),volume*.35);e.servo=4+Math.random()*5;}
if(!e.charging&&e.shot<=.6&&inSight){e.charging=true;e.charge=.6;e.chargeDeadline=performance.now()+600;audio.sfx(prefix+'Charge',pan(e.mesh.position),volume);}
if(e.charging){e.charge=Math.max(0,(e.chargeDeadline-performance.now())/1000);if(e.charge<=0){e.charging=false;e.shot=(e.type==='warden'?1.45:e.evader?1.65:2.2+Math.random())/(1+mine*.14);if(inSight){const dir=player.pos.clone().addScaledVector(player.vel,.16).sub(e.mesh.position).normalize(),origin=e.mesh.position.clone().addScaledVector(dir,e.r+1);createShot(origin,dir,'enemy',true);audio.sfx(prefix+'Fire',pan(e.mesh.position),volume);if(e.type==='warden')createShot(origin,dir.clone().add(V(.07,.02,0)).normalize(),'enemy',true);}}}e.model.animate?.(time,dt,e.charging?1-e.charge/.6:0,e.mesh.position.distanceTo(e.pos));e.mesh.updateMatrixWorld(true);}}
function updatePickups(dt){
 for(let i=pickups.length-1;i>=0;i--){
  const p=pickups[i];p.mesh.rotation.y+=dt;p.mesh.position.y=p.baseY+Math.sin(time*2)*.45;
  if(p.mesh.position.distanceTo(player.pos)>=4)continue;
  if(p.type==='cannon'||p.type==='cannonAmmo'){
   const w=cannonById(p.weapon);if(!w)continue;
   const fresh=p.type==='cannon'&&!arsenal.owned.includes(w.id);
   if(!fresh&&arsenal.ammo[w.id]>=w.capacity)continue;
   if(fresh)arsenal.owned.push(w.id);
   const before=arsenal.ammo[w.id];arsenal.ammo[w.id]=Math.min(w.capacity,before+p.value);
   toast(fresh?w.name+' recovered · +'+(arsenal.ammo[w.id]-before)+' '+w.ammoName.toLowerCase()+'. Scroll to browse; middle-click equips.':w.name+' · +'+(arsenal.ammo[w.id]-before)+' '+w.ammoName.toLowerCase(),fresh?6:2.5);
   if(browseUntil>time)drawCannonPicker();
  }else if(p.type==='shield'){if(player.shield>=maxShield())continue;const gained=Math.min(p.value,maxShield()-player.shield);player.shield+=gained;toast('Shield cell +'+gained,1.8);}
  else if(p.type==='missile'){player.missiles=Math.min(24,player.missiles+Math.min(p.value,4));toast('Missile resupply',1.8);}
  else{salvage+=p.value;score+=p.value*5;player.hull=Math.min(100,player.hull+15);toast('Hidden cache: +'+p.value+' salvage. Hull repaired.',3);}
  audio.sfx(p.type==='cannon'?'equip':'pickup');world.remove(p.mesh);disposeGroup(p.mesh);pickups.splice(i,1);
 }
}
function maxShield(){return 100+upgrades.shield*45;}
function refill(restoreShields=true){if(restoreShields)player.shield=maxShield();player.hull=100;player.boost=100;player.heat=0;player.missiles=6+mine*2;}
function saveCheckpoint(preserveSector=false){const base=preserveSector&&checkpoint?checkpoint:{mine,zone,nextMine,score,salvage,difficulty};checkpoint={...base,upgrades:{...upgrades},pendingUpgrades,arsenal:cleanArsenal(preserveSector&&checkpoint?checkpoint.arsenal:arsenal)};try{localStorage.setItem('voidbreak-v1',JSON.stringify(checkpoint));}catch{}}
function readCheckpoint(){try{const s=JSON.parse(localStorage.getItem('voidbreak-v1'));if(s&&Number.isInteger(s.mine)&&s.mine>=0&&s.mine<=2&&['mine','space'].includes(s.zone)&&['easy','normal','hard'].includes(s.difficulty)&&Number.isInteger(s.nextMine)&&s.nextMine>=1&&s.nextMine<=3&&s.upgrades&&['cannon','shield','engine'].every(k=>Number.isInteger(s.upgrades[k])&&s.upgrades[k]>=0&&s.upgrades[k]<=6)&&Number.isFinite(s.score)&&Number.isFinite(s.salvage)&&(s.pendingUpgrades===undefined||(Number.isInteger(s.pendingUpgrades)&&s.pendingUpgrades>=0&&s.pendingUpgrades<=3)))return s;}catch{}return null;}
function openUpgrade(){
 if(mode!=='play'||zone!=='space'||pendingUpgrades<=0)return;
 mode='upgrade';releaseControls();$('upgrade').hidden=false;audio.pause(true);
 const cards=[['cannon','01 / WEAPON SYSTEM','Twin pulse cannon','Adds a second barrel and increases firing speed.'],['shield','02 / SURVIVABILITY','Shield capacitor','Adds 45 shield capacity. Restore shields with shield cells.'],['engine','03 / MOBILITY','Overdrive thrusters','12% faster thrust and faster afterburner recharge.']];
 $('upgradeCards').replaceChildren();
 for(const [id,label,title,desc]of cards){
  const b=document.createElement('button');b.className='upgradeCard';b.innerHTML='<small>'+label+'</small><b>'+title+'</b><p>'+desc+'</p><small>INSTALL ↗</small>';
  b.addEventListener('click',()=>{if(mode!=='upgrade'||pendingUpgrades<=0)return;upgrades[id]++;pendingUpgrades--;refill(false);saveCheckpoint(true);resumePlay();updateObjectives();});
  $('upgradeCards').append(b);
 }
}
function closeUpgrade(){if(mode==='upgrade')resumePlay();}
function makeSpace(){clearWorld();zone='space';stage='transit';scene.background=new T.Color(0x030610);scene.fog=new T.FogExp2(0x061021,.00018);stars.visible=true;amb.intensity=.38;headlight.intensity=700;spaceReady=false;player.pos.set(0,0,25);player.q.identity();player.vel.set(0,0,0);const sun=new T.DirectionalLight(0xb1e4ff,3);sun.position.set(600,250,400);world.add(sun);const planet=mesh(new T.SphereGeometry(530,48,32),mat(0x284857),V(1050,-290,-1700),null);const atmosphere=mesh(new T.SphereGeometry(540,40,24),new T.MeshBasicMaterial({color:0x42a3c1,transparent:true,opacity:.12,side:T.BackSide}),planet.position.clone(),V(1.03,1.03,1.03));const rings=new T.Mesh(new T.RingGeometry(640,980,90),new T.MeshBasicMaterial({color:0x729a9b,transparent:true,opacity:.22,side:T.DoubleSide}));rings.position.copy(planet.position);rings.rotation.set(1.2,.3,.1);world.add(rings);
for(let i=0;i<90;i++){const pos=V((Math.random()-.5)*1600,(Math.random()-.5)*650,-Math.random()*1550),r=5+Math.random()*24;if(Math.abs(pos.x)<75&&Math.abs(pos.y)<75)pos.x+=140;const rock=mesh(new T.IcosahedronGeometry(r,3),rockmat,pos,V(1.4,.8,1));rock.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);walls.push(rock);spaceObjects.push({type:'rock',mesh:rock,pos,radius:r*1.25,solid:true});}
const husk=mesh(new T.IcosahedronGeometry(76,2),rockmat,V(0,0,200),V(1.4,1,1));walls.push(husk);spaceObjects.push({type:'rock',mesh:husk,pos:husk.position,radius:96,solid:true});art.burst(world,V(0,0,118),12,0xff8c48);
const dest=V(0,0,-920);if(nextMine<3){const rock=mesh(new T.IcosahedronGeometry(82,2),rockmat,dest.clone().add(V(0,0,-85)),V(1.45,1.1,1.25));walls.push(rock);spaceObjects.push({type:'rock',mesh:rock,pos:rock.position,radius:75,solid:true});for(const side of [-1,1])box(dest.clone().add(V(side*43,0,-20)),V(20,45,45),wallmat);box(dest.clone().add(V(0,34,-12)),V(88,18,30),darkmat);box(dest.clone().add(V(0,-34,-12)),V(88,18,30),darkmat);}
for(let i=0;i<3;i++){const ring=new T.Mesh(new T.TorusGeometry(29+i*2,.5,8,64),glow(nextMine<3?0x80f5d9:0xad8aff));ring.position.copy(dest).add(V(0,0,-i*8));world.add(ring);decor.push({type:'gate',mesh:ring});}spaceObjects.push({type:'destination',pos:dest,radius:85});
const wreckPos=V(-210,50,-420),wreck=new T.Group();wreck.position.copy(wreckPos);wreck.rotation.set(.2,.3,.45);world.add(wreck);box(V(),V(28,14,68),wallmat,wreck);box(V(0,12,15),V(15,8,28),darkmat,wreck);for(const s of [-1,1]){box(V(s*28,0,-10),V(40,4,20),darkmat,wreck);box(V(s*36,0,-13),V(5,7,15),goldmat,wreck);}walls.push(wreck);spaceObjects.push({type:'wreck',mesh:wreck,pos:wreckPos,radius:48,solid:true,used:false});
const anomalyPos=V(185,95,-625);const a=new T.Group();a.position.copy(anomalyPos);world.add(a);for(let i=0;i<4;i++){const r=new T.Mesh(new T.TorusGeometry(18+i*3,.2,6,60),glow(0xb77bff));r.rotation.set(i*.6,i*.7,0);a.add(r);}mesh(geometries.octa,mat(0xa381ed,0x644cae),V(),V(8,8,8),a);spaceObjects.push({type:'anomaly',mesh:a,pos:anomalyPos,radius:45,used:false});decor.push({type:'anomaly',mesh:a});
for(const [i,w]of ownedCannons().filter(w=>w.level).entries())spawnPickup(V(65,-25,-260-i*120),'cannonAmmo',w.pack,w.id);
for(let i=0;i<7;i++)spawnPickup(V(65+Math.sin(i)*20,-25,-150-i*80),'cache',12);
for(let i=0;i<3+mine;i++){const e=spawnEnemy(V((i-1)*45,20+((i%2)*35),-410-i*55),i===0?'heavy':'drone',0,100+i);e.mesh.scale.setScalar(2.2);e.r*=2.2;e.hp*=1.3;}
$('sector').textContent='OPEN SPACE / '+(nextMine<3?'BOUND FOR '+names[nextMine]:'EXTRACTION');audio.music('space');toast(nextMine<3?'Open space. Explore, install your upgrade with U, or fly to the next outpost.':'All reactors destroyed. Reach the jump gate to finish the mission.',5);updateObjectives();}
function interactSpace(){if(mode!=='play'||zone!=='space')return;for(const o of spaceObjects){const dist=o.pos.distanceTo(player.pos);if(o.type==='destination'&&dist<88){if(nextMine===3){endGame(true);return;}makeMine(nextMine);refill(false);saveCheckpoint();audio.sfx('warp');return;}if(o.type==='wreck'&&!o.used&&dist<65){o.used=true;salvage+=100;score+=750;player.missiles=Math.min(24,player.missiles+5);player.hull=Math.min(100,player.hull+35);toast('Freighter recovered: +100 salvage, 5 missiles, hull repair.',5);audio.sfx('pickup');for(let i=0;i<2;i++)spawnEnemy(o.pos.clone().add(V(i?38:-38,10,-60)),'heavy',0,150+i);return;}if(o.type==='anomaly'&&!o.used&&dist<60){o.used=true;player.boost=100;salvage+=75;score+=1000;
const outward=player.pos.clone().sub(o.pos).normalize();if(outward.lengthSq()<.1)outward.set(0,0,1);
const offsets=[outward,V(1,0,0),V(-1,0,0),V(0,1,0),V(0,-1,0),V(0,0,1),V(0,0,-1)];
const cellPos=[9,15,21].flatMap(distance=>offsets.map(offset=>player.pos.clone().addScaledVector(offset,distance))).find(p=>p.distanceTo(o.pos)>10&&allowed(p))||player.pos.clone().addScaledVector(outward,9);
spawnPickup(cellPos,'shield',maxShield());toast('Anomaly harvested: shield cell released nearby. +75 salvage.',5);audio.sfx('warp');explosion(o.pos,0xaa79ff,3);return;}}}
function nearestRoom(p){let best=Infinity,result=0;rooms.forEach((r,i)=>{const d=r.distanceToSquared(p);if(d<best){best=d;result=i;}});return result;}
function pathTo(start,end){const queue=[[start]],seen=new Set([start]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===end)return path;for(const [a,b]of links){const n=a===last?b:b===last?a:-1;if(n>=0&&!seen.has(n)){seen.add(n);queue.push([...path,n]);}}}return[start];}
function objectiveTarget(){
 if(zone!=='space')return null;
 const destination=spaceObjects.find(o=>o.type==='destination');
 return destination?{pos:destination.pos,label:nextMine<3?names[nextMine]:'JUMP GATE'}:null;
}
function updateObjectives(){
 $('target').hidden=zone!=='space';$('upgradeBtn').hidden=zone!=='space'||pendingUpgrades<=0;
 $('upgradeBtn').textContent='U · UPGRADE'+(pendingUpgrades>1?' ×'+pendingUpgrades:'');
 if(zone==='space'){
  $('phase').textContent=nextMine<3?'INTERSECTOR FLIGHT':'FINAL EXTRACTION';$('objective').textContent=nextMine<3?'Reach '+names[nextMine]:'Reach the jump gate';
  $('detail').textContent='Explore the freighter and anomaly, or fly to the outpost. C enters; U installs a recovered upgrade.';
 }else if(!coreFound){
  $('phase').textContent='DEEP MINE SURVEY';$('objective').textContent='Find the reactor';
  $('detail').textContent=visitedRooms.size+' / '+rooms.length+' chambers surveyed. Follow the tunnels and watch for ambushes.';
 }else if(!reactor.active){
  $('phase').textContent='REACTOR CONTAINMENT';$('objective').textContent='Break its defenses';
  $('detail').textContent=generators.filter(g=>g.hp>0).length+' shield relays · '+enemies.filter(e=>e.guardian).length+' chamber guardians remaining';
 }else{
  $('phase').textContent='REACTOR EXPOSED';$('objective').textContent='Destroy the reactor';$('detail').textContent='Core integrity '+Math.ceil(reactor.hp)+' / '+reactor.maxHp+' · Fire into the pressure vessel.';
 }
 $('timer').hidden=true;
}
function updateHUD(dt){
 const critical=player.hull<=30,shieldRatio=player.shield/maxShield(),lowShield=shieldRatio<=.25;
 $('shieldWarning').hidden=mode!=='play'||!lowShield;$('shieldWarning').style.opacity=lowShield?.18+clamp((.25-shieldRatio)/.25,0,1)*.37:0;
 $('shieldBar').style.background=lowShield?'#f27858':'#98bcb2';
 $('survivalStatus').textContent=critical?'HULL CRITICAL · FIND REPAIRS':player.shield<=0?'SHIELDS DOWN · FIND CELLS':lowShield?'SHIELDS LOW · FIND CELLS':player.shield<maxShield()?'FIND SHIELD CELLS':'HULL 0 = SHIP LOST';
 $('survivalStatus').style.color=critical||lowShield?'#ff8970':'#91a7b8';
 $('hullBar').style.background=critical?'#ff6742':'#93b6d4';
 $('shieldText').textContent=Math.ceil(player.shield);$('hullText').textContent=Math.ceil(player.hull);$('boostText').textContent=Math.ceil(player.boost);$('shieldBar').style.width=100*player.shield/maxShield()+'%';$('hullBar').style.width=player.hull+'%';$('heatBar').style.width=player.heat+'%';$('heatBar').style.background=overheated?'#ff5143':'#ffbd70';$('boostBar').style.width=player.boost+'%';$('ammo').textContent=player.missiles+' SEEKER MISSILES';const equipped=cannonById(arsenal.equipped);$('weaponName').textContent=equipped.id==='pulse'&&upgrades.cannon?'TWIN PULSE / LV '+upgrades.cannon:equipped.name.toUpperCase();$('cannonAmmo').textContent=cannonAmmoText(equipped);$('cannonMode').textContent=overheated?'SINGLE SHOTS · '+cannonRecovery.toFixed(1)+'s':'RAPID FIRE READY';$('cannonMode').style.color=overheated?'#ffb26f':'#91a7b8';$('cannonAmmo').style.color=equipped.level&&arsenal.ammo[equipped.id]===0?'#ff8970':'#c5d9d0';$('weaponPicker').hidden=mode!=='play'||browseUntil<=time;$('score').textContent=String(score).padStart(6,'0');$('salvage').textContent='SALVAGE '+salvage;$('hitmark').style.opacity=hitTime>0?1:0;$('damage').style.opacity=damageFlash;const target=objectiveTarget();$('target').hidden=!target;
 if(target){const to=target.pos.clone().sub(player.pos),local=to.clone().applyQuaternion(player.q.clone().invert()),behind=local.z>0,depth=Math.max(Math.abs(local.z),.05),tan=Math.tan(camera.fov*Math.PI/360);let x=local.x/(depth*tan*camera.aspect),y=local.y/(depth*tan);if(behind&&Math.abs(x)<.2)x=.85;x=clamp(x,-.84,.84);y=clamp(y,-.68,.66);$('target').style.left=(50+x*50)+'%';$('target').style.top=(50-y*50)+'%';$('targetLabel').textContent=behind?'TURN · '+target.label:target.label;$('targetDistance').textContent=Math.round(to.length())+' m';}
 let prompt='';if(zone==='space'){let best=Infinity;for(const o of spaceObjects){const d=o.pos.distanceTo(player.pos);if(o.type==='destination'&&d<88&&d<best){prompt=nextMine<3?'[C] ENTER MINE':'[C] ENGAGE JUMP DRIVE';best=d;}else if(o.type==='wreck'&&!o.used&&d<65&&d<best){prompt='[C] SALVAGE DERELICT FREIGHTER';best=d;}else if(o.type==='anomaly'&&!o.used&&d<60&&d<best){prompt='[C] HARVEST THE ANOMALY';best=d;}}
if(!prompt){const wreck=spaceObjects.find(o=>o.type==='wreck'&&!o.used),anomaly=spaceObjects.find(o=>o.type==='anomaly'&&!o.used);if(wreck&&player.pos.distanceTo(wreck.pos)<250)prompt='Derelict signal: left of flight path';else if(anomaly&&player.pos.distanceTo(anomaly.pos)<230)prompt='Energy anomaly: right and above';}}
if(!prompt.startsWith('[C]')){const nearby=pickups.filter(p=>(p.type==='shield'||(!prompt&&p.weapon))&&p.mesh.position.distanceTo(player.pos)<22&&visible(player.pos,p.mesh.position)).sort((a,b)=>a.mesh.position.distanceToSquared(player.pos)-b.mesh.position.distanceToSquared(player.pos))[0];if(nearby){if(nearby.type==='shield')prompt=player.shield>=maxShield()?'SHIELD CELL · SHIELDS FULL':'SHIELD CELL +'+Math.min(nearby.value,maxShield()-player.shield)+' · FLY THROUGH TO COLLECT';else{const w=cannonById(nearby.weapon);prompt=w.name+' · '+(nearby.type==='cannon'?'FLY THROUGH TO RECOVER':arsenal.ammo[w.id]>=w.capacity?'AMMO FULL':'+'+nearby.value+' '+w.ammoName);}}}
$('prompt').textContent=prompt;drawMap();}
function drawMap(){
 const c=$('mapCanvas').getContext('2d'),w=180,h=150;c.clearRect(0,0,w,h);c.strokeStyle='#51809633';
 for(let i=15;i<w;i+=25){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}
 if(zone==='mine'){
  const project=p=>[p.x-p.y*.35,p.z-p.y*.5],known=[...visitedRooms].map(i=>rooms[i]),projected=[...known,player.pos].map(project);
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min(140/Math.max(100,maxX-minX),110/Math.max(100,maxY-minY));
  const map=p=>{const [x,y]=project(p);return[90+(x-(minX+maxX)/2)*scale,75+(y-(minY+maxY)/2)*scale];};
  c.strokeStyle='#719497';c.lineWidth=2;
  for(const [a,b]of links)if(visitedRooms.has(a)&&visitedRooms.has(b)){c.beginPath();c.moveTo(...map(rooms[a]));c.lineTo(...map(rooms[b]));c.stroke();}
  for(const i of visitedRooms){const [x,y]=map(rooms[i]);c.fillStyle=i===nearestRoom(player.pos)?'#365b61':'#1a303c';c.fillRect(x-4,y-4,8,8);c.strokeStyle='#81aeb5';c.strokeRect(x-4,y-4,8,8);}
  for(const e of enemies)if(e.inSight&&visitedRooms.has(e.room)){const [x,y]=map(e.mesh.position);c.fillStyle=e.evader?'#c897ff':'#ff735a';c.fillRect(x-2,y-2,4,4);}
  c.fillStyle='#a6ffee';c.beginPath();c.arc(...map(player.pos),3,0,7);c.fill();
 }else{
  const map=p=>[90+(p.x-player.pos.x)*.19,110+(p.z-player.pos.z)*.12];
  for(const o of spaceObjects){if(!['destination','wreck','anomaly'].includes(o.type))continue;const [x,y]=map(o.pos);c.fillStyle=o.type==='destination'?'#ffdb94':o.type==='wreck'?'#67dbe9':'#b997ff';c.beginPath();c.arc(clamp(x,8,172),clamp(y,8,142),4,0,7);c.fill();}
  c.fillStyle='#a6ffee';c.beginPath();c.moveTo(90,104);c.lineTo(86,115);c.lineTo(94,115);c.fill();
 }
 $('map').style.transform=mapExpanded?'scale(1.9)':'';$('map').style.transformOrigin='top right';$('mapTitle').textContent=zone==='mine'?'SURVEYED CHAMBERS':'DEEP SPACE RADAR';
}
function releaseControls(){$('shieldWarning').hidden=true;resetCannonBrowse();flightInputActive=false;keys.clear();mouse.left=false;mouse.right=false;centerSteering();player.vel.set(0,0,0);}
async function resumePlay(){flightInputActive=true;keys.clear();mouse.left=false;mouse.right=false;centerSteering();canvas.focus?.({preventScroll:true});for(const e of enemies)if(e.charging)e.chargeDeadline=performance.now()+e.charge*1000;mode='play';$('menu').hidden=true;$('pause').hidden=true;$('ending').hidden=true;$('upgrade').hidden=true;$('hud').hidden=false;cockpit.visible=true;audio.start();audio.pause(false);}
function pauseGame(){if(mode!=='play')return;mode='pause';releaseControls();$('pause').hidden=false;audio.pause(true);}
function beginNew(){arsenal=cleanArsenal();pendingUpgrades=0;difficulty=$('difficulty').value;upgrades={cannon:0,shield:0,engine:0};score=0;salvage=0;mine=0;nextMine=1;makeMine(0);refill();saveCheckpoint();resumePlay();}
function restore(s){arsenal=cleanArsenal(s.arsenal);pendingUpgrades=s.pendingUpgrades||0;difficulty=s.difficulty;upgrades={...s.upgrades};mine=s.mine;nextMine=s.nextMine;score=s.score;salvage=s.salvage;if(s.zone==='space')makeSpace();else makeMine(mine);refill();saveCheckpoint();resumePlay();}
function endGame(win,reason=''){if(!['play','upgrade'].includes(mode))return;mode='end';releaseControls();$('ending').hidden=false;$('hud').hidden=true;audio.update({speed:0,boost:false,combat:false,danger:0,space:true},.016);audio.music(win?'victory':'off');audio.sfx(win?'warp':'reactor');audio.pause(false);$('endLabel').textContent=win?'MISSION COMPLETE':'SHIP LOST';$('endTitle').textContent=win?'The mines are silent.':'Ship destroyed.';$('endText').textContent=win?'Three outposts destroyed. '+score.toLocaleString()+' points. '+salvage+' salvage recovered. The sector is free.':reason+' Retry this sector in a repaired and rearmed ship. Progress earned in this sector resets; earlier sectors stay cleared. Unlimited retries.';$('retry').hidden=win;if(win){try{localStorage.removeItem('voidbreak-v1');}catch{}}}
$('upgradeBtn').onclick=openUpgrade;$('closeUpgrade').onclick=closeUpgrade;$('start').onclick=beginNew;$('resume').onclick=resumePlay;$('pauseBtn').onclick=pauseGame;$('restart').onclick=()=>restore(checkpoint);$('retry').onclick=()=>restore(checkpoint);$('newRun').onclick=beginNew;$('continue').onclick=()=>{const s=readCheckpoint();if(s)restore(s);};$('continue').hidden=!readCheckpoint();
function applyVolume(v){volume=v;audio.setVolume(v);$('volume').value=v*100;$('pauseVolume').value=v*100;try{localStorage.setItem('voidbreak-volume',v);}catch{}}$('volume').oninput=e=>applyVolume(e.target.value/100);$('pauseVolume').oninput=e=>applyVolume(e.target.value/100);$('mute').onchange=e=>audio.setMuted(e.target.checked);try{const v=localStorage.getItem('voidbreak-volume');if(v!==null)applyVolume(clamp(Number(v),0,1));else applyVolume(.65);}catch{}
const flightKeys=new Set(['Space','Tab','KeyW','KeyA','KeyS','KeyD','KeyR','KeyF','KeyQ','KeyE','KeyX','KeyC','KeyZ','KeyU','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
window.addEventListener('keydown',e=>{if(e.code==='Escape'){if(mode==='upgrade')closeUpgrade();else pauseGame();return;}if(mode!=='play'||!flightInputActive||e.ctrlKey||e.metaKey||e.altKey)return;if(flightKeys.has(e.code))e.preventDefault();if(e.code==='KeyC'&&!e.repeat)interactSpace();if(e.code==='KeyU'&&!e.repeat)openUpgrade();if(mode!=='play')return;if(e.code==='Tab'&&!e.repeat)mapExpanded=!mapExpanded;if(e.code==='KeyZ')centerSteering();keys.add(e.code);if(!e.repeat&&e.code==='Space')fire();if(!e.repeat&&e.code==='KeyX')fire(true);});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(mode==='play'&&flightKeys.has(e.code)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)e.preventDefault();});
window.addEventListener('blur',pauseGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(mode!=='play')return;flightInputActive=true;e.preventDefault();canvas.focus?.({preventScroll:true});if(e.button===0)mouse.left=true;if(e.button===2)mouse.right=true;if(e.button===1)selectCannon();});
canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
canvas.addEventListener('wheel',e=>{
 if(mode!=='play'||!flightInputActive||e.ctrlKey||e.metaKey||e.altKey||!Number.isFinite(e.deltaY))return;
 e.preventDefault();const now=performance.now();if(now-wheelAt>220||Math.sign(e.deltaY)!==Math.sign(wheelDelta))wheelDelta=0;wheelAt=now;
 wheelDelta+=e.deltaY*(e.deltaMode===1?40:e.deltaMode===2?innerHeight:1);
 if(Math.abs(wheelDelta)>=40){browseCannon(Math.sign(wheelDelta));wheelDelta=0;}
},{passive:false});
window.addEventListener('mouseup',e=>{if(e.button===0)mouse.left=false;if(e.button===2)mouse.right=false;});
canvas.addEventListener('mouseleave',()=>{if(mode==='play')releaseControls();});
canvas.addEventListener('mouseenter',()=>{if(mode==='play')flightInputActive=true;});
window.addEventListener('mousemove',e=>{
 if(mode!=='play'||e.target!==canvas||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
 flightInputActive=true;
 const radius=steeringRadius();
 steering.x=(e.clientX-innerWidth/2)/radius;
 steering.y=(e.clientY-innerHeight/2)/radius;
 const magnitude=Math.hypot(steering.x,steering.y);
 if(magnitude>1){steering.x/=magnitude;steering.y/=magnitude;}
 drawSteering();
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));cinema.resize(Math.round(innerWidth*Math.min(devicePixelRatio,1.7)),Math.round(innerHeight*Math.min(devicePixelRatio,1.7)));drawSteering();});
function update(dt){time+=dt;art.update(time,dt);flashLight.intensity*=Math.exp(-dt*14);toastTime-=dt;hitTime-=dt;comboTime-=dt;damageFlash=Math.max(0,damageFlash-dt*1.8);shake=Math.max(0,shake-dt*.8);if(toastTime<=0)$('toast').style.opacity=0;fireWait-=dt;missileWait-=dt;updateCannonCooling(dt);if(mode==='play'){movePlayer(dt);if(mode!=='play')return;if(keys.has('Space'))fire(false,false);if(keys.has('KeyX'))fire(true);updateEnemies(dt);const previousZone=zone;updateShots(dt);if(mode!=='play'||zone!==previousZone)return;updatePickups(dt);for(const d of decor){if(d.type==='gate')d.mesh.rotation.z+=dt*.14;if(d.type==='anomaly'){d.mesh.rotation.y+=dt*.24;d.mesh.rotation.z+=dt*.1;}}if(reactor){reactor.core.rotation.y+=dt*.3;reactor.core.material.emissiveIntensity=2.4+Math.sin(time*3)*.5;reactor.shield.rotation.y+=dt*.2;}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.vel,dt);if(p.light)p.mesh.intensity*=.83;else p.mesh.scale.multiplyScalar(Math.max(0,1-dt*1.5));if(p.life<=0){world.remove(p.mesh);if(p.mesh.material)p.mesh.material.dispose();particles.splice(i,1);}}camera.position.copy(player.pos);camera.quaternion.copy(player.q);if(shake>0)camera.position.add(V((Math.random()-.5)*shake,(Math.random()-.5)*shake,0));camera.fov=T.MathUtils.lerp(camera.fov,77+(player.vel.length()/(zone==='space'?150:44))*7,dt*5);camera.updateProjectionMatrix();camera.updateMatrixWorld();updateHUD(dt);}}
function menuScene(){makeMine(0);mode='menu';$('hud').hidden=true;$('toast').style.opacity=0;camera.position.set(0,2,12);camera.lookAt(-6,0,-14);if(enemies[0]){enemies[0].pos.set(5,0,-6);enemies[0].mesh.position.copy(enemies[0].pos);enemies[0].mesh.lookAt(camera.position);enemies[0].mesh.scale.setScalar(1.2);}cockpit.visible=false;}
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.035);last=now;if(mode==='play')update(dt);else if(mode==='menu'){time+=dt;art.update(time,dt);camera.position.x=Math.sin(time*.1)*.4;camera.lookAt(-6,0,-14);for(const e of enemies){e.model.animate?.(time,dt,0,0);}}cinema.render(scene,camera,time);}menuScene();requestAnimationFrame(frame);
// Read-only diagnostics for support and automated mechanical checks.
window.minedescent={snapshot:()=>({mode,zone,mine,nextMine,stage,enemies:enemies.length,hull:player.hull,shield:player.shield,score,salvage,rooms:rooms.length,surveyed:visitedRooms.size,pendingUpgrades,upgrades:{...upgrades},arsenal:cleanArsenal(arsenal),position:player.pos.toArray(),renderer:renderer.info.render}),version:'3.1.2'};
