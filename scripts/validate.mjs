import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../worker/index.js';
assert.equal(typeof worker.fetch,'function');
const files={'/':'index.html','/style.css':'style.css','/game.js':'game.js','/art.js':'art.js','/audio.js':'audio.js','/robots.js':'robots.js','/layouts.js':'layouts.js','/weapons.js':'weapons.js','/rock.jpg':'rock.jpg','/metal.jpg':'metal.jpg','/three.module.min.js':'vendor/three.module.js','/three.core.js':'vendor/three.core.js','/LICENSE-three.txt':'vendor/LICENSE'};
for(const [route,path]of Object.entries(files)){const response=await worker.fetch(new Request('https://mine-descent.test'+route),{},{});assert.equal(response.status,200,route);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../src/'+path,import.meta.url)),route+' is stale');}
assert.equal((await worker.fetch(new Request('https://mine-descent.test/favicon.svg'),{},{})).status,200);
const health=await(await worker.fetch(new Request('https://mine-descent.test/health'),{},{})).json();assert.equal(health.version,'3.2.1');
console.log('Validated Mine Descent '+health.version+' and all 14 embedded routes.');
