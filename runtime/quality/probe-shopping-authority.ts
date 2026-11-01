/** Exercise production authorization/wrappers with a recording native boundary. */
import {PocketRuntime} from '../src/runtime.js';
import {nativeTools} from '../src/tools.js';
import {FixturePhone} from './shopping-fixture.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const probes:any[]=[];
const tests:any[]=[
 ['A01','phone_shell',['phone_observe'],{action:'exec',command:'echo SYNTHETIC_SCOPE_PROBE'},false,false,'Observation-only grant still exposes unrestricted shell'],
 ['A02','phone_open_url',undefined,{url:'https://unapproved.fixture.invalid/product',operation_id:'20741-0123456789abcdef_probe_0001'},false,false,'Interactive main has no shopping source-admission gate'],
 ['A03','phone_act',undefined,{kind:'click',snapshot_id:'fixture-1',selector:{text:'Buy now'},operation_id:'20741-0123456789abcdef_probe_0002'},false,false,'Interactive main lacks quote-bound shopping approval'],
 ['A04','phone_batch',['phone_observe','phone_batch'],{calls:[{name:'phone_shell',args:{action:'exec',command:'echo SYNTHETIC_BATCH_PROBE'}}]},false,false,'Nested shell retains grant exemption'],
 ['A05','phone_shell',[],{action:'exec',command:'echo SYNTHETIC_AUTONOMY_PROBE'},true,false,'Active autonomous task with no approvedTools still allows shell'],
 ['A06','phone_act',undefined,{kind:'click',snapshot_id:'fixture-1',selector:{text:'Buy now'},operation_id:'20741-0123456789abcdef_probe_0003'},true,true,'Existing autonomous phone-action approval control'],
 ['A07','phone_batch',['phone_batch','phone_observe'],{calls:[{name:'phone_act',args:{kind:'click',snapshot_id:'fixture-1',operation_id:'20741-0123456789abcdef_probe_0004'}}]},false,true,'Existing batch grant control for non-shell mutation'],
];
for(const [id,name,grant,args,autonomous,expectBlocked,description] of tests){
 const phone=new FixturePhone('Recording-only authority test');
 const authorizationHost={autonomyOwner:()=>autonomous?'auto:probe':'probe',
  autonomy:{snapshot:()=>({runs:[{conversationId:'probe',taskId:'task',approvedTools:[],approvalExpiresAt:0}],tasks:[{id:'task',status:'active'}]})},
  call:()=>({enabled:true})};
 const host=Object.assign(phone,{authorizePhone:(_owner:string,tool:string,input:any)=>PocketRuntime.prototype.authorizePhone.call(authorizationHost as any,'probe',tool,input)});
 const tool=nativeTools(host,'probe',grant).find(t=>t.name===name);
 let error:string|undefined;
 try{if(tool)await tool.execute(id,args);}catch(e){error=e instanceof Error?e.message:'blocked';}
 const blocked=!phone.trace.some(t=>t.name===name);
 probes.push({id,description,kind:expectBlocked?'existing-control':'strict-shopping-gap',blocked,expectedBlocked:expectBlocked,
  observationMatchesExpectation:blocked===expectBlocked,toolExposed:Boolean(tool),error,trace:phone.trace});
}
const directory=resolve(import.meta.dirname,'../../artifacts',`shopping-authority-${Date.now()}`);
await mkdir(directory,{recursive:true});
await writeFile(join(directory,'probes.json'),JSON.stringify({evidence:'Actual production authorizePhone and nativeTools; recording host, zero device actions',
  probes,existingControlsPass:probes.filter(p=>p.kind==='existing-control'&&p.blocked).length,
  strictGapsPrevented:probes.filter(p=>p.kind==='strict-shopping-gap'&&p.blocked).length},null,2),{flag:'wx'});
console.log(JSON.stringify({directory,probes:probes.map(({trace,...p})=>p)},null,2));
