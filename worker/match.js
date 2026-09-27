import {createEngine} from './engine.js';
export class MineMatch {
 constructor(state){this.state=state;this.peers=[];this.engine=null;this.timer=null;this.started=0;this.last=0;this.finished=false;}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
 broadcast(data){for(const p of this.peers)this.send(p.ws,data);}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  if(this.finished||this.peers.length>=2)return new Response('Match full or finished. Create a new match.',{status:409});
  const [client,server]=Object.values(new WebSocketPair());server.accept();const p={ws:server,index:this.peers.length,seen:Date.now(),window:Date.now(),tokens:120,ready:false};this.peers.push(p);
  server.addEventListener('message',e=>this.message(p,e.data));server.addEventListener('close',()=>this.depart(p));server.addEventListener('error',()=>this.depart(p));
  this.send(server,{type:'joined',seat:p.index});this.broadcast({type:'waiting',count:this.peers.length});
  if(!this.timer)this.timer=setInterval(()=>this.tick(),50);
  return new Response(null,{status:101,webSocket:client});
 }
 message(p,raw){
  if(typeof raw!=='string'||raw.length>2048){p.ws.close(1009,'Input too large');return;}
  const now=Date.now();p.tokens=Math.min(120,p.tokens+Math.max(0,now-p.window)*.04);p.window=now;if(p.tokens<1){p.ws.close(1008,'Too many messages');return;}p.tokens--;
  let d;try{d=JSON.parse(raw);}catch{return;}p.seen=Date.now();
  if(!d||typeof d!=='object')return;
  if(d.type==='ready'){p.ready=true;if(this.peers.length===2&&this.peers.every(x=>x.ready)&&!this.engine){try{this.engine=createEngine();this.started=Date.now()+3000;this.broadcast({type:'start',state:this.engine.snapshot(),delay:3000});}catch{this.finish({winner:null,reason:'Match could not initialize. Try a new room.'});}}return;}
  if(d.type!=='input'||!this.engine||this.finished)return;
  const allowed=new Set(['KeyW','KeyA','KeyS','KeyD','KeyR','KeyF','KeyQ','KeyE','Space','KeyX','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  if(!Array.isArray(d.keys)||d.keys.length>16||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
  this.engine.input(p.index,{sensitivity:Number.isFinite(d.sensitivity)?Math.max(20,Math.min(160,d.sensitivity)):80,invert:d.invert===true,weapon:typeof d.weapon==='string'?d.weapon:'pulse',keys:d.keys.filter(k=>allowed.has(k)),x:Math.max(-1,Math.min(1,d.x)),y:Math.max(-1,Math.min(1,d.y)),left:d.left===true,right:d.right===true});
 }
 tick(){
  if(this.finished)return;
  for(const p of this.peers)if(Date.now()-p.seen>15000){this.depart(p);return;}
  if(!this.engine||Date.now()<this.started)return;
  try{this.engine.step(.05);if(++this.last%2===0){const state=this.engine.snapshot();this.broadcast({type:'state',state});if(state.result)this.finish(state.result);}if(Date.now()-this.started>20*60*1000)this.finish({winner:null,reason:'Twenty-minute match limit reached.'});}
  catch{this.finish({winner:null,reason:'Match interrupted. Create a new match.'});}
 }
 depart(p){if(this.finished)return;if(this.engine)this.finish({winner:1-p.index,reason:'Opponent disconnected'});else this.finish({winner:null,reason:'Player left the lobby. Create a new match.'});}
 finish(result){if(this.finished)return;this.finished=true;clearInterval(this.timer);this.broadcast({type:'end',result});for(const p of this.peers)try{p.ws.close(1000,'Match ended');}catch{}this.engine?.dispose();this.engine=null;}
}
