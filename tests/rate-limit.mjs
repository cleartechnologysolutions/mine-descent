import assert from 'node:assert/strict';
import {MineMatch} from '../worker/match.js';
const oldNow=Date.now;let now=10000;Date.now=()=>now;
try {
 const match=new MineMatch({});let closed=null;
 const p={window:now,tokens:120,seen:now,ws:{close:(code,reason)=>{closed={code,reason};}}};
 const input=JSON.stringify({type:'input',keys:[],x:0,y:0});
 // Buffered legitimate input following a slow eight-second startup.
 for(let i=0;i<80;i++)match.message(p,input);
 assert.equal(closed,null);
 // Normal 10 Hz controls continue without penalties.
 for(let i=0;i<600;i++){now+=100;match.message(p,input);}
 assert.equal(closed,null);
 for(let i=0;i<130;i++)match.message(p,input);
 assert.equal(closed?.code,1008);
 console.log('PASS: startup burst and 60 seconds of normal input accepted; sustained flood rejected');
} finally {Date.now=oldNow;}
