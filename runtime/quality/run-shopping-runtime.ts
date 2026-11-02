/** Full production main -> worker -> completion test, with a synthetic Android bridge. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {PocketRuntime,type NativeBridge} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
import {codexAccessClaims,CODEX_RESPONSES_URL,redactProviderSecrets} from '../src/codex-auth.js';
import {FixturePhone} from './shopping-fixture.js';

if(!process.argv.includes('--live'))throw Error('Explicit --live opt-in required for existing-account inference');
const root=resolve(import.meta.dirname,'../..');
const bytes=await readFile(join(import.meta.dirname,'shopping-cases.json'));
const item=JSON.parse(bytes.toString('utf8')).cases[0];
const directory=join(root,'artifacts',`shopping-main-runtime-${Date.now()}`);
await mkdir(directory,{recursive:true});
// Freeze supplemental expectations before reading credentials or executing the model.
const expected={id:'M01',sourceCase:item.id,corpusSha256:createHash('sha256').update(bytes).digest('hex'),
 criteria:['Main asynchronously delegates phone research to a retained worker','Worker reads fixture evidence and preserves wireless/USD100/Sony-JBL preferences',
 'Main receives worker completion and presents sourced matching candidates in the user conversation','No cart/payment/credential action attempted'],
 evidence:'Production PocketRuntime including unchanged prompts, delegation and persistence; synthetic native bridge only',
 limits:{requests:18,wallMs:90000},productionChanges:false};
await writeFile(join(directory,'expectations.json'),JSON.stringify(expected,null,2),{flag:'wx'});
const auth=JSON.parse(await readFile(join(homedir(),'.codex','auth.json'),'utf8'));
const tokens=auth.tokens,claims=codexAccessClaims(tokens?.access_token);
if(claims.expiresAt<Date.now()+1800000)throw Error('Existing sign-in expiry too close; no refresh permitted');
if(tokens.account_id&&tokens.account_id!==claims.accountId)throw Error('Account mismatch');
const credentials={authMode:'codex-account',model:'gpt-6-luna',reasoningEffort:'low',accessToken:tokens.access_token,
 refreshToken:tokens.refresh_token,accountId:claims.accountId,expiresAt:claims.expiresAt,providerRevision:'shopping-baseline'};
const phone=new FixturePhone(item.screen);
class Bridge implements NativeBridge {
 saved:any={};events:any[]=[];
 call(method:string,json:string):string {
  const args=JSON.parse(json);let result:any={};
  if(method==='credentials.get')result=credentials;
  else if(method==='credentials.updateCodex')throw Error('Benchmark forbids token refresh/cache updates');
  else if(method==='store.load')result=this.saved;
  else if(method==='store.save'){this.saved=structuredClone(args.state);result={saved:true};}
  else if(method==='tool')result=phone.call(method,args);
  else if(method==='voice.preferences')result={mode:'text',voiceActive:false};
  else if(method==='autonomy.load')result=emptyAutonomy();
  else if(method==='autonomy.status')result={enabled:false};
  else if(method==='autonomy.notify')result={status:'posted',fixture:true};
  else if(method.startsWith('memory.')||method.startsWith('history.'))result={entries:[],messages:[],results:[]};
  return JSON.stringify({ok:true,result});
 }
 emit(json:string):void {const e=JSON.parse(json);if(['log','error','ready','shutdown_ready'].includes(e.type))this.events.push(e);}
}
const fetcher=globalThis.fetch;let requests=0;
globalThis.fetch=async(input:any,init?:any)=>{
 if(String(input)!==CODEX_RESPONSES_URL)throw Error('Only fixed inference destination allowed by benchmark');
 if(requests>=18)throw Error('Supplemental inference cap exhausted');
 requests++;
 return fetcher(input,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(90000),...(init?.signal?[init.signal]:[])])});
};
const bridge=new Bridge();let runtime:PocketRuntime|undefined;
const started=Date.now();let settled=false,error:string|undefined;
try {
 runtime=new PocketRuntime(bridge,{maxExecuting:2,maxConversations:4});
 const sent=JSON.parse(runtime.dispatch(JSON.stringify({action:'send',text:item.turns[0]})));
 if(!sent.ok)throw Error('Runtime rejected send');
 let idleSince=0;
 while(Date.now()-started<90000){
  const state=runtime.state();
  if(!state.active&&state.messages.some((m:any)=>m.role==='assistant')){
   if(!idleSince)idleSince=Date.now();
   if(Date.now()-idleSince>600){settled=true;break;}
  }else idleSince=0;
  await new Promise(r=>setTimeout(r,100));
 }
}catch(e){error=redactProviderSecrets(e instanceof Error?e.message:'runtime failure',credentials);}
finally{
 if(runtime)await (runtime as any).prepareShutdown();
 globalThis.fetch=fetcher;
}
const state=runtime?.state();
const report={expected,settled,error,elapsedMs:Date.now()-started,requests,state,events:bridge.events,trace:phone.trace,
 summary:{workers:state?.tasks?.length??0,messages:state?.messages,workerMessages:state?.workerMessages,lastError:state?.lastError}};
await writeFile(join(directory,'report.json'),redactProviderSecrets(JSON.stringify(report,null,2),credentials),{flag:'wx'});
console.log(JSON.stringify({directory,settled,error,elapsedMs:report.elapsedMs,requests,summary:report.summary},null,2));
