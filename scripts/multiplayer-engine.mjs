import fs from 'node:fs';
const root=new URL('../',import.meta.url);
let s=fs.readFileSync(new URL('src/game.js',root),'utf8').replace("import {installMultiplayer} from '/multiplayer.js';\n",'').replaceAll('if(multiplayer.active)return;','').replace('if(multiplayer.active){multiplayer.tick(dt);return;}','');
const imports=s.split('\n').filter(l=>l.startsWith('import ')).join('\n').replaceAll("'/three.module.min.js'","'../src/vendor/three.module.js'").replaceAll("'/art.js'","'../src/art.js'").replaceAll("'/robots.js'","'../src/robots.js'").replaceAll("'/layouts.js'","'../src/layouts.js'").replaceAll("'/weapons.js'","'../src/weapons.js'");
s=s.split('\n').filter(l=>!l.startsWith('import ')).join('\n');
s=s.replace('art.batchEnvironment(world);','').replace('art.roomEffects(world,rooms,mineLayout.roomIdentity);','').replace('const cockpit=art.cockpit(camera);','const cockpit=new T.Group();');
s=s.replace('new T.WebGLRenderer','new MockRenderer');
s=s.slice(0,s.indexOf('let last=performance.now();'));
s=s.replace('function updateEnemies(dt){for(const e of enemies){','function updateEnemies(dt){for(const e of enemies){const target=pilots.filter(p=>p.hull>0).sort((a,b)=>a.pos.distanceToSquared(e.pos)-b.pos.distanceToSquared(e.pos))[0];if(!target)continue;player=target;');
s=s.replace('pickups.push({mesh:g,','pickups.push({netId:++serial,mesh:g,');
s=s.replace('shots.push({mesh:m,','shots.push({netId:++serial,owner:enemy?-1:pilots.indexOf(player),mesh:m,');
s=s.replace("if(s.enemy){consider(player.pos,1.55,'player');", "for(const p of pilots)if(p.hull>0&&(s.enemy||pilots.indexOf(p)!==s.owner))consider(p.pos,1.55,'player',p);\n   if(s.enemy){");
s=s.replace("if(hit?.type==='player')damage(s.damage,'enemy');", "if(hit?.type==='player'){player=hit.object;damage(s.damage,s.enemy?'robot':'other player');}");
const a=s.indexOf('function destroyReactor(){'),b=s.indexOf('function updateEnemies',a);
s=s.slice(0,a)+"function destroyReactor(){if(!meltdown)meltdown=12;reactor.hp=0;}\n"+s.slice(b);
s=s.replace("if(player.hull<=0)endGame(false,source==='reactor'?'The reactor took the mine with it.':'Hull integrity reached zero.');", "if(player.hull<=0)player.cause=source;");
s=s.replace('if(reactor.hp===0){destroyReactor();return;}', 'if(reactor.hp===0&&!meltdown){destroyReactor();}');
s=s.replace('function saveCheckpoint(preserveSector=false){','function saveCheckpoint(preserveSector=false){return;');
s=s.replace('function openUpgrade(){','function openUpgrade(){return;');
s=s.replace('function explosion(pos,color=0xff8b43,scale=1){',"function explosion(pos,color=0xff8b43,scale=1){netEffect({kind:'burst',pos:pos.toArray(),color,scale});return;");
s=s.replace('for(const e of [...enemies])if(e!==hit?.object', "for(const p of pilots)if(p.hull>0&&pilots.indexOf(p)!==s.owner&&p!==hit?.object&&p.pos.distanceTo(end)<radius&&visible(end,p.pos)){player=p;damagePlayerSplash(p,damage); } for(const e of [...enemies])if(e!==hit?.object");
s=s.replace("audio.sfx(missile?'missile':weapon.sound);shake", "netEffect({kind:'sound',sound:missile?'missile':weapon.sound,pos:player.pos.toArray(),owner:pilots.indexOf(player),volume:1,kick:missile?.13:weapon.kick});shake");
s=s.replace("audio.sfx(prefix+'Fire',pan(e.mesh.position),volume);", "netEffect({kind:'sound',sound:prefix+'Fire',pos:e.mesh.position.toArray(),owner:-1,volume:1});");
s=s.replace("audio.sfx('explosion',pan(end),s.type==='missile'?1:.65);", "netEffect({kind:'sound',sound:'explosion',pos:end.toArray(),owner:-1,volume:s.type==='missile'?1:.65});");
const shim=`
function damagePlayerSplash(p,n){player=p;damage(n,'other player');}
const effects=[];let effectId=0;function netEffect(effect){effects.push({...effect,id:++effectId,at:time});if(effects.length>128)effects.shift();}
const pilots=[],controls=[{},{}];let serial=0,meltdown=0,result=null;
class Element {constructor(id){this.value=id==='difficulty'?'normal':id==='sensitivity'?'80':'65';this.style={};this.hidden=false;this.children=[];}addEventListener(){}focus(){}append(){}replaceChildren(){}getContext(){return new Proxy({},{get:()=>()=>{}});}}
const els=new Map(),document={getElementById(id){if(!els.has(id))els.set(id,new Element(id));return els.get(id);},createElement:()=>new Element('x'),addEventListener(){}};
const window={addEventListener(){},VoidAudio:class{start(){}update(){}setVolume(){}setMuted(){}pause(){}sfx(){}music(){}}};
const innerWidth=1440,innerHeight=900,devicePixelRatio=1,localStorage={getItem(){return null;},setItem(){},removeItem(){}},requestAnimationFrame=()=>{};
class MockRenderer{shadowMap={};capabilities={getMaxAnisotropy:()=>1};info={render:{}};setSize(){}setPixelRatio(){}render(){}}
`;
const api=`
makeMine(0);mode='play';flightInputActive=true;
for(let i=0;i<2;i++){pilots.push({pos:rooms[i?1:0].clone().add(V(0,0,9)),q:new T.Quaternion(),vel:V(),shield:100,hull:100,heat:0,boost:100,missiles:6,lastHit:-100,fw:0,mw:0,burst:0,recovery:0,hot:false,arsenal:cleanArsenal()});}
function select(p){player=p;fireWait=p.fw;missileWait=p.mw;cannonBurst=p.burst;cannonRecovery=p.recovery;overheated=p.hot;arsenal=p.arsenal;}
function retain(p){p.fw=fireWait;p.mw=missileWait;p.burst=cannonBurst;p.recovery=cannonRecovery;p.hot=overheated;}
function step(dt){if(result)return;time+=dt;while(effects.length&&effects[0].at<time-2)effects.shift();
 for(let i=0;i<2;i++){const p=pilots[i];if(p.hull<=0)continue;select(p);const c=controls[i];$('sensitivity').value=c.sensitivity||80;$('invert').checked=!!c.invert;if(arsenal.owned.includes(c.weapon))arsenal.equipped=c.weapon;keys.clear();for(const k of c.keys||[])keys.add(k);steering.x=c.x||0;steering.y=c.y||0;mouse.left=!!c.left;mouse.right=!!c.right;flightInputActive=true;fireWait-=dt;missileWait-=dt;updateCannonCooling(dt);movePlayer(dt);if(keys.has('Space'))fire(false,!p.wasFire);if(keys.has('KeyX'))fire(true);p.wasFire=keys.has('Space');updatePickups(dt);retain(p);}
 updateEnemies(dt);world.updateMatrixWorld(true);updateShots(dt);
 if(meltdown>0){meltdown-=dt;if(meltdown<=0){for(const p of pilots)if(p.pos.distanceTo(rooms[0])>12){p.hull=0;p.cause='reactor';}result={winner:pilots[0].hull>0&&pilots[1].hull<=0?0:pilots[1].hull>0&&pilots[0].hull<=0?1:null,reason:'Reactor explosion'};}}
 const alive=pilots.map((p,i)=>p.hull>0?i:-1).filter(i=>i>=0);if(alive.length<2)result={winner:alive.length?alive[0]:null,reason:pilots.find(p=>p.hull<=0)?.cause||'Ship destroyed'};
}
return {step,input(i,c){controls[i]=c;},snapshot(){return {effects:effects.map(e=>({...e})),players:pilots.map(p=>({pos:p.pos.toArray(),q:p.q.toArray(),shield:p.shield,hull:p.hull,heat:p.heat,boost:p.boost,missiles:p.missiles,hot:p.hot,recovery:p.recovery,arsenal:p.arsenal})),enemies:enemies.map(e=>({id:e.id,pos:e.mesh.position.toArray(),q:e.mesh.quaternion.toArray(),hp:e.hp})),shots:shots.map(s=>({id:s.netId,pos:s.mesh.position.toArray(),q:s.mesh.quaternion.toArray(),type:s.type,enemy:s.enemy,owner:s.owner})),pickups:pickups.map(p=>({id:p.netId,pos:p.mesh.position.toArray(),type:p.type,value:p.value,weapon:p.weapon})),doors:doors.map(d=>({open:d.open,hold:d.hold,locked:d.locked})),generators:generators.map(g=>g.hp),reactor:{hp:reactor.hp,active:reactor.active},hasReactorKey,meltdown,result};},dispose(){clearWorld();},debug:{pilots,damage:(i,n)=>{player=pilots[i];damage(n,'robot');},reactor:()=>{reactor.active=true;reactor.hp=0;destroyReactor();}}};
`;
fs.writeFileSync(new URL('worker/engine.js',root),imports+'\nexport function createEngine(){\n'+shim+s+api+'\n}');
