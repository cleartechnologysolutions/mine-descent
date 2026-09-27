export function installMultiplayer(api){
 const panel=document.createElement('div');panel.id='multiplayer';panel.innerHTML='<button id="hostMatch" class="secondary">TWO PLAYER · CREATE MATCH</button><p id="matchNotice" role="status"></p><input id="matchLink" aria-label="Match link" readonly hidden><button id="copyMatch" hidden>Copy match link</button><button id="joinMatch" class="secondary" hidden>JOIN TWO-PLAYER MATCH</button><button id="leaveMatch" hidden>Leave match</button>';
 document.getElementById('start').after(panel);
 const $=id=>document.getElementById(id);let ws=null,seat=0,latest=null,active=false,playing=false,done=false,inputTimer=null,started=0,lastSent=0;
 const sendInput=()=>{if(!playing&&performance.now()-lastSent<1000)return;lastSent=performance.now();if(ws?.readyState===1)ws.send(JSON.stringify({type:'input',...api.input(playing&&performance.now()>=started)}));};
 const status=text=>$('matchNotice').textContent=text;
 const end=result=>{if(done)return;done=true;playing=false;clearInterval(inputTimer);api.finish(result.winner===null?'Draw':result.winner===seat?'You win!':'Ship destroyed',result.reason);};
 function connect(id){if(active)return;done=false;active=true;playing=false;latest=null;api.unlock();status('Connecting…');$('hostMatch').disabled=true;$('joinMatch').disabled=true;$('start').disabled=true;$('continue').disabled=true;$('leaveMatch').hidden=false;
  ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/match/${id}`);
  ws.onmessage=event=>{let d;try{d=JSON.parse(event.data);}catch{return;}
   if(d.type==='joined'){seat=d.seat;api.reset(seat);ws.send(JSON.stringify({type:'ready'}));}
   if(d.type==='waiting')status(d.count===1?'Waiting for player two. Share this link.':'Both players joined. Preparing mine…');
   if(d.type==='start'){latest=d.state;playing=true;started=performance.now()+d.delay;api.start();status('Match starting');}
   if(d.type==='state')latest=d.state;
   if(d.type==='end')end(d.result);
  };
  ws.onerror=()=>status('Unable to connect. Deploy the full multiplayer build, or create a fresh match.');
  ws.onclose=event=>{if(done)return;done=true;playing=false;clearInterval(inputTimer);api.finish('Connection interrupted','Connection closed ('+event.code+'): '+(event.reason||'No close reason received. The network or server ended the connection.')+' Return to the menu and create a new match.');};
  inputTimer=setInterval(sendInput,100);
 }
 $('hostMatch').onclick=()=>{const id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');const url=new URL(location.href);url.search='match='+id;history.replaceState(null,'',url);$('matchLink').value=url.href;$('matchLink').hidden=false;$('copyMatch').hidden=false;connect(id);};
 $('copyMatch').onclick=()=>navigator.clipboard.writeText($('matchLink').value).then(()=>status('Link copied.')).catch(()=>{$('matchLink').select();status('Select and copy the link.');});
 const incoming=new URL(location.href).searchParams.get('match');if(incoming&&/^[a-f0-9]{24}$/.test(incoming)){$('joinMatch').hidden=false;$('joinMatch').onclick=()=>connect(incoming);status('A two-player match is ready to join.');}
 $('leaveMatch').onclick=()=>{done=true;clearInterval(inputTimer);ws?.close();location.href=location.pathname;};
 for(const event of ['keydown','keyup'])window.addEventListener(event,e=>{if(active&&!e.repeat&&['Space','KeyX'].includes(e.code))sendInput();});
 window.addEventListener('pagehide',()=>{clearInterval(inputTimer);ws?.close();});
 return {get active(){return active;},tick(dt){if(playing&&latest){api.render(latest,seat,dt);api.notice(performance.now()<started?'Starting in '+Math.ceil((started-performance.now())/1000):latest.meltdown>0?'REACTOR: '+Math.ceil(latest.meltdown)+'s · Return to START room':'DUEL · You are '+(seat===0?'BLUE':'GOLD'));}}};
}
