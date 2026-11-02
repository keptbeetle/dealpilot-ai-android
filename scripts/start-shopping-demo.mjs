/** Native Windows/Node launcher; no credentials in arguments or printed output. */
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {existsSync} from 'node:fs';
import net from 'node:net';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const deal=resolve(process.env.DEALPILOT_ROOT||join(root,'../dealpilot-ai'));
const web=Number(process.env.POCKET_PREVIEW_PORT||3090),api=Number(process.env.POCKET_BACKEND_PORT||8790);
if(!existsSync(join(deal,'src/api/local.ts'))||!existsSync(join(deal,'node_modules/tsx/dist/loader.mjs')))throw Error('Install the sibling DealPilot checkout dependencies, or set DEALPILOT_ROOT.');
for(const port of [web,api]){
 if(!Number.isInteger(port)||port<1024||port>65535||web===api)throw Error('Choose two distinct private ports1024–65535.');
 await new Promise((done,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(done));});
}
const token=randomBytes(32).toString('hex');
const shared={...process.env,POCKET_BRIDGE_TOKEN:token,POCKET_WEB_PORT:String(web),DEALPILOT_API_PORT:String(api)};
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();setTimeout(()=>process.exit(code),300).unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
const backend=spawn(process.execPath,['--import',pathToFileURL(join(deal,'node_modules/tsx/dist/loader.mjs')).href,'src/api/local.ts'],{cwd:deal,env:shared,stdio:'inherit',windowsHide:true});children.push(backend);backend.on('exit',code=>{if(!stopping)stop(code||1);});
let ready=false;
for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${api}/api/health`,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
if(!ready){stop(1);throw Error('Private shopping backend did not start.');}
const ui=spawn(process.execPath,['preview/server.mjs'],{cwd:root,env:{...shared,POCKET_PREVIEW_PORT:String(web),POCKET_SHOPPING_BACKEND:`http://127.0.0.1:${api}/`},stdio:'inherit',windowsHide:true});children.push(ui);ui.on('exit',code=>{if(!stopping)stop(code||1);});
console.log(`Shopping demo: http://127.0.0.1:${web}/shopping.html`);
