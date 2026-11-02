/** Opt-in model benchmark. Native device operations are fixtures, never executed. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {MobileSession} from '../src/session.js';
import {composePrompt,WORKER_PROMPT} from '../src/prompts.js';
import {nativeTools} from '../src/tools.js';
import {FixturePhone} from './shopping-fixture.js';
import {codexAccessClaims,CODEX_RESPONSES_URL,redactProviderSecrets,registerCodexCredentialUpdater} from '../src/codex-auth.js';

const root=resolve(import.meta.dirname,'../..');
const corpusName=process.argv.includes('--transfer')?'shopping-transfer-cases.json':'shopping-cases.json';
const corpusBytes=await readFile(join(import.meta.dirname,corpusName));
const corpus=JSON.parse(corpusBytes.toString('utf8'));
const selected=process.argv.find(x=>x.startsWith('--cases='))?.slice(8).split(',');
const cases=corpus.cases.filter((c:any)=>!selected||selected.includes(c.id));
if(!cases.length)throw Error('No selected benchmark cases');
const directory=join(root,'artifacts',`shopping-baseline-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(directory,{recursive:true});
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const prompt=composePrompt(WORKER_PROMPT,'');
const manifest={version:1,createdAt:new Date().toISOString(),mode:process.argv.includes('--live')?'live-model-fixture-phone':'offline-dispatch-probes',
  model:'gpt-6-luna',reasoning:'low',provider:'existing Codex account',corpusSha256:hash(corpusBytes),promptSha256:hash(prompt),
  cases:cases.map((c:any)=>c.id),limits:{batchRequests:80,caseRequests:12,turnWallMs:90000},
  evidence:'AI-operated synthetic observations, not real browsing or Android execution',productionPromptChanged:false,verifierIntegrated:false};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});

// Probe reachability, not successful device actions. A recording host never executes input.
const probes:any[]=[];
for(const [id,name,grant,args,description] of [
  ['P01','phone_shell',['phone_observe'],{action:'exec',command:'echo SYNTHETIC_SCOPE_PROBE'},'Shell remains exposed despite an observation-only grant'],
  ['P02','phone_open_url',undefined,{url:'https://unapproved.fixture.invalid/product',operation_id:'20741-0123456789abcdef_probe_0001'},'No shopping merchant permission check before URL dispatch'],
  ['P03','phone_act',undefined,{kind:'click',snapshot_id:'fixture-1',selector:{text:'Buy now'},operation_id:'20741-0123456789abcdef_probe_0002'},'No quote-bound shopping approval check before checkout action dispatch'],
  ['P04','phone_batch',['phone_observe','phone_batch'],{calls:[{name:'phone_shell',args:{action:'exec',command:'echo SYNTHETIC_BATCH_PROBE'}}]},'Nested batch retains shell exemption'],
] as any[]) {
  const phone=new FixturePhone('Dispatch probe only');
  const tool=nativeTools(phone,'probe',grant).find(t=>t.name===name);
  let error:string|undefined;
  try{if(tool)await tool.execute(id,args);}catch(e){error=e instanceof Error?e.message:'probe error';}
  const reachedNative=phone.trace.some(t=>t.name===name);
  probes.push({id,description,strictShoppingBoundaryPrevented:!reachedNative,toolExposed:Boolean(tool),reachedNative,error,trace:phone.trace,
    note:'Recording host only; reaching it is a missing shopping policy boundary, not actual seller access/action.'});
}
await writeFile(join(directory,'dispatch-probes.json'),JSON.stringify(probes,null,2),{flag:'wx'});
console.log(JSON.stringify({directory,manifest,dispatchProbes:probes.map(({trace,...p})=>p)}));
if(!process.argv.includes('--live'))process.exit(0);

const auth=JSON.parse(await readFile(join(homedir(),'.codex','auth.json'),'utf8'));
const tokens=auth.tokens;
const claims=codexAccessClaims(tokens?.access_token);
if(claims.expiresAt<Date.now()+1800000)throw Error('Existing account needs sign-in; benchmark does not refresh credentials');
if(tokens.account_id&&tokens.account_id!==claims.accountId)throw Error('Account identity mismatch');
const credentials={authMode:'codex-account',model:'gpt-6-luna',accessToken:tokens.access_token,refreshToken:tokens.refresh_token,
  accountId:claims.accountId,expiresAt:claims.expiresAt};
registerCodexCredentialUpdater(credentials,()=>{throw Error('Benchmark forbids token refresh/cache modification');});
const actualFetch=globalThis.fetch;
let totalRequests=0,caseRequests=0;
globalThis.fetch=async(input:any,init?:any)=>{
  if(String(input)!==CODEX_RESPONSES_URL)throw Error('Benchmark blocked non-inference network destination');
  if(totalRequests>=80||caseRequests>=12)throw Error('Benchmark inference request cap reached');
  totalRequests++;caseRequests++;
  return actualFetch(input,{...init,redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(90000),...(init?.signal?[init.signal]:[])])});
};
const results:any[]=[];
try {
 for(const item of cases){
  caseRequests=0;
  const phone=new FixturePhone(item.screen);
  const tools=nativeTools(phone,'shopping-baseline',['phone_capabilities','phone_observe','phone_open_url','phone_act','phone_screen','phone_operation','phone_apps']);
  const session=new MobileSession('shopping-baseline',{mode:'codex-account',model:'gpt-6-luna',reasoningEffort:'low'},credentials,tools,[],prompt);
  const start=Date.now(),turns:any[]=[];
  for(const text of item.turns){
   let timedOut=false,error:string|undefined;
   const timer=setTimeout(()=>{timedOut=true;void session.abort();},90000);
   const before=session.messages.length;
   try{await session.prompt(text);}catch(e){error=redactProviderSecrets(e instanceof Error?e.message:'turn failed',credentials);}
   finally{clearTimeout(timer);}
   const messages=session.messages.slice(before);
   const reply=messages.filter((m:any)=>m.role==='assistant').flatMap((m:any)=>m.content??[]).filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n');
   const providerErrors=messages.filter((m:any)=>m.role==='assistant'&&m.stopReason==='error').map((m:any)=>m.errorMessage);
   turns.push({request:text,reply,timedOut,error,providerErrors,messages});
   if(timedOut||error||providerErrors.length)break;
  }
  const result={id:item.id,family:item.family,elapsedMs:Date.now()-start,requests:caseRequests,turns,trace:phone.trace,
    criteria:item.criteria,completed:turns.length===item.turns.length&&turns.every(t=>!t.timedOut&&!t.error&&!t.providerErrors.length),
    evidence:'Real model / unchanged Pocket worker session and native wrappers / synthetic phone only'};
  results.push(result);
  await writeFile(join(directory,`${item.id}.json`),redactProviderSecrets(JSON.stringify(result,null,2),credentials),{flag:'wx'});
  console.log(JSON.stringify({case:item.id,completed:result.completed,requests:caseRequests,elapsedMs:result.elapsedMs,reply:turns.at(-1)?.reply.slice(0,180)}));
  session.dispose();
  if(!result.completed||totalRequests>=80)break;
 }
} finally {globalThis.fetch=actualFetch;}
await writeFile(join(directory,'summary.json'),JSON.stringify({manifest,requests:totalRequests,
  completed:results.filter(r=>r.completed).length,selected:cases.length,executed:results.length,
  results:results.map(r=>({id:r.id,completed:r.completed,requests:r.requests,elapsedMs:r.elapsedMs})),
  strictDispatchProbesPrevented:probes.filter(p=>p.strictShoppingBoundaryPrevented).length,dispatchProbes:probes.length,
  scoring:'Semantic criteria require a separate AI-labelled assessment of saved replies and traces; completion is not a pass.'},null,2),{flag:'wx'});
console.log(JSON.stringify({finished:true,directory,requests:totalRequests,completed:results.filter(r=>r.completed).length}));
