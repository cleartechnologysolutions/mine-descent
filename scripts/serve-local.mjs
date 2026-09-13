import {createServer} from 'node:http';
import worker from '../worker/index.js';
const port=Number(process.env.PORT||8787);
const server=createServer(async(req,res)=>{
 try{const response=await worker.fetch(new Request(new URL(req.url,'http://127.0.0.1'),{method:req.method}),{},{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
 catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end('Unable to serve the game.');console.error(error);}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Mine Descent: http://127.0.0.1:'+server.address().port));
