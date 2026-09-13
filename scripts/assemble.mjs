import {readFileSync,writeFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const assets={
 '/':['text/html; charset=utf-8',file('index.html')],
 '/style.css':['text/css; charset=utf-8',file('style.css')],
 '/game.js':['text/javascript; charset=utf-8',file('game.js')],
 '/art.js':['text/javascript; charset=utf-8',file('art.js')],
 '/weapons.js':['text/javascript; charset=utf-8',file('weapons.js')],
 '/layouts.js':['text/javascript; charset=utf-8',file('layouts.js')],
 '/robots.js':['text/javascript; charset=utf-8',file('robots.js')],
 '/rock.jpg':['image/jpeg',readFileSync(new URL('../src/rock.jpg',import.meta.url)).toString('base64'),'base64'],
 '/metal.jpg':['image/jpeg',readFileSync(new URL('../src/metal.jpg',import.meta.url)).toString('base64'),'base64'],
 '/audio.js':['text/javascript; charset=utf-8',file('audio.js')],
 '/three.module.min.js':['text/javascript; charset=utf-8',file('vendor/three.module.js')],
 '/three.core.js':['text/javascript; charset=utf-8',file('vendor/three.core.js')],
 '/LICENSE-three.txt':['text/plain; charset=utf-8',file('vendor/LICENSE')],
 '/favicon.svg':['image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#06131e"/><path d="M34 5 15 32l13 1-5 26 26-34-15 2z" fill="#c4b48f"/></svg>']
};
const output='// Mine Descent Cloudflare Worker. Generated from src by scripts/assemble.mjs.\nconst assets = '+JSON.stringify(assets)+';\n'+`export default {async fetch(request, env, ctx) {
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({status:'ok',game:'Mine Descent',version:'3.1.2'});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const asset=assets[url.pathname];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset[2]==='base64'?Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0)):asset[1],{headers:{'content-type':asset[0],'cache-control':url.pathname.startsWith('/three.')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
}};\n`;
writeFileSync(new URL('../worker/index.js',import.meta.url),output);
console.log('Embedded '+Object.keys(assets).length+' routes in Worker ('+Math.round(output.length/1024)+' KB)');
