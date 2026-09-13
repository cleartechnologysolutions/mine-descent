const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let timerId = 0;
const timers = new Set();
class Param {
  constructor(value=0) { this.value = value; this.events = []; }
  event(type,value,time) { assert(Number.isFinite(value)); assert(Number.isFinite(time) && time >= 0); this.value=value; this.events.push({type,value,time}); }
  setValueAtTime(v,t){this.event('set',v,t)}
  setTargetAtTime(v,t,d){assert(d>0);this.event('target',v,t)}
  linearRampToValueAtTime(v,t){this.event('linear',v,t)}
  exponentialRampToValueAtTime(v,t){assert(v>0);this.event('exponential',v,t)}
}
class Node {
 constructor(c,type) { this.ctx=c;this.kind=type;this.edges=[];this.frequency=new Param();this.gain=new Param();this.pan=new Param();this.Q=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();c.nodes.push(this); }
 connect(n){this.edges.push(n);return n;}
 disconnect(){this.edges=[];this.disconnected=true;}
 start(t=this.ctx.currentTime){assert(!this.started);assert(t>=this.ctx.currentTime-0.001);this.started=true;this.startAt=t;}
 stop(t=this.ctx.currentTime){assert(this.started);assert(Number.isFinite(t));this.stopAt=t;}
}
class Context {
 constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.nodes=[];this.destination={};}
 createGain(){return new Node(this,'gain')}
 createDynamicsCompressor(){return new Node(this,'compressor')}
 createWaveShaper(){return new Node(this,'waveshaper')}
 createConvolver(){return new Node(this,'convolver')}
 createBiquadFilter(){return new Node(this,'filter')}
 createOscillator(){return new Node(this,'oscillator')}
 createBufferSource(){return new Node(this,'buffer')}
 createStereoPanner(){return new Node(this,'panner')}
 createBuffer(ch,l,rate){assert(l>0);let d=Array.from({length:ch},()=>new Float32Array(l));return {getChannelData:i=>d[i]};}
 advance(dt){this.currentTime+=dt;for(const n of this.nodes){if(n.stopAt<=this.currentTime&&!n.ended){n.ended=true;n.onended?.();}}}
 async suspend(){this.state='suspended'}
 async resume(){this.state='running'}
 async close(){this.advance(10);this.state='closed'}
}
const sandbox={AudioContext:Context, console, Math, Float32Array, Set, Object, Number,
 setInterval:()=>{timers.add(++timerId);return timerId},clearInterval:i=>timers.delete(i)};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/audio.js'),'utf8'),sandbox);
(async()=>{
 const audio=new sandbox.VoidAudio();
 assert.equal(await audio.start(),true);
 assert.equal(timers.size,1);
 const c=audio.ctx;
 const events=['laser','breach','vulcan','siege','equip','door','missile','enemy','explosion','reactor','hit','pickup','alarm','warp','click','robotWake','robotCharge','robotFire','robotMove','robotDeath','wardenWake','wardenCharge','wardenFire','wardenMove','wardenDeath','mineAmbience'];
 const result=[];
 for(const event of events){
  c.advance(10);
  const baseline=c.nodes.length;
  audio.sfx(event,0.4,0.75);
  const sources=c.nodes.slice(baseline).filter(n=>n.started);
  assert(sources.length>0,event+' emitted no voices');
  assert(sources.every(n=>Number.isFinite(n.stopAt)),event+' missing finite stop');
  const max=Math.max(...sources.map(n=>n.stopAt-c.currentTime));
  assert(max<6,event+' exceeded bounded one-shot duration');
  result.push({event,voices:sources.length,maxSeconds:+max.toFixed(3)});
  c.advance(7);
  assert.equal(audio._sources.size,0,event+' leaked source references');
  assert(sources.every(n=>n.disconnected),event+' failed source disconnection');
 }
 const silent=c.nodes.length;audio.sfx('robotWake',0,0);assert.equal(c.nodes.length,silent);
 for(const mode of ['mine','space','combat','escape','victory','menu','off']){
  audio.music(mode);audio.update({space:mode==='space',combat:mode==='combat',danger:mode==='escape'?1:0});
  for(let i=0;i<64;i++){audio._musicStep(i,c.currentTime+0.01,mode);c.advance(0.18);}
  c.advance(10);assert.equal(audio._sources.size,0);
 }
 // Exercise normal and fastest supported cannon cadence with overlapping tails.
 for(const [sound,interval] of [['laser',0.14],['laser',0.14/(1+6*0.08)],['vulcan',0.075/(1+6*.08)],['breach',.55/(1+6*.08)],['siege',.65/(1+6*.08)]]){
  c.advance(10);let peakVoices=0;
  for(let shot=0;shot<150;shot++){
   const before=c.nodes.length;audio.sfx(sound);
   assert(c.nodes.length>before,'rapid-fire cannon lost a shot');
   peakVoices=Math.max(peakVoices,audio._sources.size);c.advance(interval);
  }
  assert(peakVoices<48,'short cannon tails must not build up a wall of active voices');
  c.advance(1);assert.equal(audio._sources.size,0,'cannon voices outlived their tails');
 }
 assert([...audio.outputCeiling.curve].every(v=>Number.isFinite(v)&&Math.abs(v)<=0.94));
 audio.music('mine');audio.update({space:false,combat:false,danger:0,minehum:1});assert.equal(audio.ambientBus.gain.value,0.15);
 audio.update({space:true});assert.equal(audio.ambientBus.gain.value,0);
 await audio.pause();assert.equal(c.state,'suspended');assert.equal(timers.size,0);
 const count=c.nodes.length;audio.sfx('wardenWake');audio._schedule();assert.equal(c.nodes.length,count);
 await audio.pause(false);assert.equal(timers.size,1);await audio.start();assert.equal(timers.size,1);
 for(let i=0;i<40;i++){c.currentTime+=0.11;audio.sfx('robotDeath');}assert(audio._sources.size<=144);
 audio.setVolume(99);assert.equal(audio.volume,1);audio.setMuted(true);assert.equal(audio.master.gain.value,0);
 await audio.dispose();assert.equal(c.state,'closed');assert.equal(timers.size,0);assert.equal(audio._sources.size,0);assert.equal(audio._ambientSources.length,0);
 assert(c.nodes.filter(n=>n.started).every(n=>Number.isFinite(n.stopAt)));
 console.log(JSON.stringify({status:'PASS',eventChecks:result,musicModes:7,checks:['all voices finitely stopped and disconnected','zero intensity emits no nodes','source cap <=144','mine/space ambient fade targets','pause suspends context and blocks effects','resume creates exactly one scheduler','master volume/mute bounded','dispose closes context/stops all sources']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
