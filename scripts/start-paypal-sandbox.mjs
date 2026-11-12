/** Private checkout bridge for the original Android app; all PayPal calls occur in DealPilot backend. */
import {spawn} from 'node:child_process';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import http from 'node:http';
import net from 'node:net';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const backend=resolve(process.env.DEALPILOT_ROOT||join(root,'../dealpilot-ai'));
const port=Number(process.env.DEALPILOT_CHECKOUT_PORT||3490),apiPort=Number(process.env.DEALPILOT_API_PORT||9190);
if(!existsSync(join(backend,'src/api/local.ts'))||!existsSync(join(backend,'node_modules/tsx/dist/loader.mjs')))throw Error('Install the sibling DealPilot backend first (pnpm install).');
if(!Number.isInteger(port)||!Number.isInteger(apiPort)||port<1024||apiPort<1024||port>65535||apiPort>65535||port===apiPort)throw Error('Choose two distinct private ports.');
for(const check of [port,apiPort])await new Promise((ok,fail)=>{const s=net.createServer();s.once('error',fail);s.listen(check,'127.0.0.1',()=>s.close(ok));});
const bridge=randomBytes(32).toString('hex'),pairing=randomBytes(9).toString('base64url');
const expires=Date.now()+600000,clients=new Map();
const env={...process.env,DEALPILOT_API_PORT:String(apiPort),POCKET_WEB_PORT:String(port),POCKET_BRIDGE_TOKEN:bridge};
const child=spawn(process.execPath,['--import',pathToFileURL(join(backend,'node_modules/tsx/dist/loader.mjs')).href,'src/api/local.ts'],{cwd:backend,env,stdio:'inherit',windowsHide:true});
let closing=false;
const stop=()=>{if(closing)return;closing=true;child.kill();server.close();};
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop();process.exit(0);});
child.on('exit',code=>{if(!closing){console.error('Checkout backend stopped.');process.exit(code||1);}});
let ready=false;
for(let i=0;i<55;i++){try{const r=await fetch('http://127.0.0.1:'+apiPort+'/api/health',{signal:AbortSignal.timeout(800)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
if(!ready){child.kill();throw Error('Private PayPal Sandbox backend did not become ready.');}
async function backendCall(action,input){
 const response=await fetch('http://127.0.0.1:'+apiPort+'/api/pocket/'+action,{method:'POST',headers:{'content-type':'application/json','x-pocket-bridge':bridge,'x-pocket-role':'buyer'},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(40000)});
 const result=await response.json();
 if(!response.ok)throw Object.assign(new Error(result.error||'Checkout service refused request.'),{status:response.status});
 return result;
}
function json(res,status,value){
 const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body);
}
function tokenOf(req){const match=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);return match?.[1];}
function checkCode(value){const text=String(value??'');return Date.now()<expires&&text.length===pairing.length&&/^[A-Za-z0-9_-]{12}$/.test(text)&&timingSafeEqual(Buffer.from(text),Buffer.from(pairing));}
let attempts=0;
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='GET'&&req.url?.startsWith('/shopping.html?')){
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    const outcome=url.searchParams.has('paypal_return')?'return':url.searchParams.has('paypal_cancel')?'cancel':null;
    const token=url.searchParams.get('token');
    if(!outcome||!token||!/^[A-Z0-9]{6,40}$/.test(token)){json(res,400,{error:'Invalid PayPal Sandbox return reference.'});return;}
    const link='dealpilotagent://paypal/'+outcome+'?token='+encodeURIComponent(token);
    const html='<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DealPilot AI - PayPal Sandbox</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui;background:#091a2e;color:#e8f5ff}main{width:min(90vw,440px);border:1px solid #395c85;border-radius:20px;background:#122e4a;padding:30px;text-align:center}h1{font-size:25px}p{line-height:1.5;color:#adc9e2}a{display:block;background:#0875cb;padding:16px;border-radius:14px;text-decoration:none;color:white;font-weight:750;margin-top:24px}</style><main><h1>PayPal Sandbox</h1><p>Return to DealPilot AI to verify the buyer-approved test transaction. Payment is not complete until the app confirms its capture.</p><a href="'+link+'">Return to DealPilot AI</a></main></html>';
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(html);return;
  }  if(req.method!=='POST'||!/^\/api\/shop\/(?:connect|state|action)$/.test(req.url||'')){json(res,404,{error:'Unknown checkout route.'});return;}
  if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(new Error('Use JSON requests.'),{status:415});
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>32000)throw Object.assign(new Error('Request too large.'),{status:413});chunks.push(chunk);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),kind=req.url.split('/').at(-1);
  if(kind==='connect'){
   if(++attempts>20||!checkCode(data.code))throw Object.assign(new Error('Invalid or expired pairing code. Restart the host and try again.'),{status:403});
   const result=await backendCall('create',{}),token=randomBytes(32).toString('base64url');
   clients.set(createHash('sha256').update(token).digest('hex'),result.state.id);
   json(res,200,{...result,bearer:token});return;
  }
  const token=tokenOf(req),session=token?clients.get(createHash('sha256').update(token).digest('hex')):null;
  if(!session)throw Object.assign(new Error('Checkout pairing expired. Connect the phone again.'),{status:401});
  if(kind==='state'){json(res,200,await backendCall('action',{id:session,action:'state',expectedRevision:0,operationId:crypto.randomUUID()}));return;}
  const allowed=new Set(['browserQuote','approve','pay','capture','reconcile','cancel']);
  if(!allowed.has(data.action))throw Object.assign(new Error('Unknown buyer checkout action.'),{status:400});
  if(!Number.isInteger(data.expectedRevision)||data.expectedRevision<0||!/^[0-9a-f-]{36}$/i.test(data.operationId||''))throw Object.assign(new Error('Invalid checkout revision or operation.'),{status:400});
  const result=await backendCall('action',{...data,id:session});
  json(res,200,result);
 }catch(error){json(res,error.status&&error.status>=400&&error.status<=503?error.status:503,{error:error.message||'Checkout service unavailable.'});}
});
server.listen(port,'127.0.0.1',()=>{
 console.log('DealPilot AI PayPal Sandbox host ready on localhost:'+port);
 console.log('Phone pairing code (10 minutes): '+pairing);
 console.log('Android USB: adb reverse tcp:'+port+' tcp:'+port);
});