import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const mf=new Miniflare({name:'mine',rootPath:root,modulesRoot:root,modules:true,scriptPath:root+'/worker/index.js',modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2026-05-22',port:0,durableObjects:{MATCHES:{className:'MineMatch',useSQLite:true}}});
const origin=(await mf.ready).origin,url=origin+'/match/012345678901234567890123';
const clients=[];const timeout=setTimeout(()=>{console.error('Socket test timed out');process.exit(1)},25000);
try{
 for(let i=0;i<2;i++){
 const r=await mf.dispatchFetch(url,{headers:{Upgrade:'websocket',Origin:origin}});assert.equal(r.status,101);const ws=r.webSocket,events=[];ws.accept();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);events.push(d);if(d.type==='end')console.log('end',d.result);});ws.send(JSON.stringify({type:'ready'}));clients.push({ws,events});}
 const wait=async(f)=>{for(let i=0;i<150&&!f();i++)await new Promise(r=>setTimeout(r,100));assert(f(),'Expected socket event');};
 await wait(()=>clients.every(c=>c.events.some(e=>e.type==='start')));
 assert.equal((await mf.dispatchFetch(url,{headers:{Upgrade:'websocket',Origin:origin}})).status,409);
 clients[0].ws.send(JSON.stringify({type:'input',keys:['KeyW'],x:0,y:0}));
 await wait(()=>clients[0].events.some(e=>e.type==='state'));
 const start=clients[0].events.find(e=>e.type==='start').state,now=clients[0].events.find(e=>e.type==='state').state;
 assert.notDeepEqual(start.players[0].pos,now.players[0].pos);
 clients[0].ws.close();await wait(()=>clients[1].events.some(e=>e.type==='end'));assert.equal(clients[1].events.find(e=>e.type==='end').result.winner,1);
 console.log('PASS: workerd two players, server movement, third-player rejection, disconnect victory');
}finally{clearTimeout(timeout);await mf.dispose();}
