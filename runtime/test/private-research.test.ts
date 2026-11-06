import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
import {nativeTools} from '../src/tools.js';

function setup(){
 const effects:any[]=[];
 const runtime=new PocketRuntime({call(method:string,raw:string){const args=JSON.parse(raw);if(method==='tool')effects.push(args);return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():{}});},emit(){}});
 const definition=runtime.registry.agents.get('shopping-researcher')!;
 const session=(runtime as any).createSession('private-shop',{definition,requestedConfig:{}});
 return {runtime,session,effects,definition};
}

test('focused shopping metadata restricts physical screens and shell fallbacks without removing general Pocket capabilities',()=>{
 const {runtime,session}=setup(),tools=session.agent.state.tools;
 for(const name of ['phone_browser','phone_store_app','phone_open_url','phone_open_app','phone_observe','phone_act']){
  const tool=tools.find((t:any)=>t.name===name);assert.ok(tool,name);assert.deepEqual(tool.parameters.properties.display_target.enum,['virtual']);
 }
 const shell=tools.find((t:any)=>t.name==='phone_shell');assert.ok(!shell.parameters.properties.action.enum.includes('exec'));assert.match(shell.description,/disabled/);
 const general=runtime.main.agent.state.tools.find((t:any)=>t.name==='phone_shell');assert.ok(general.parameters.properties.action.enum.includes('exec'));
 assert.doesNotThrow(()=>runtime.authorizePhone('main','phone_open_url',{display_target:'physical'}));
 assert.doesNotThrow(()=>runtime.authorizePhone('main','phone_shell',{action:'exec',command:'general phone work'}));
});

test('composite and direct physical-screen calls fail before capabilities, allocation or native dispatch',async()=>{
 const {session,effects}=setup();
 for(const [name,args] of [
  ['phone_browser',{url:'https://www.google.com/search?q=smartphones',display_target:'physical'}],
  ['phone_store_app',{store:'amazon',query:'smartphones',display_target:'physical'}],
  ['phone_open_url',{url:'https://shop.example/products/phone',display_target:'physical'}],
  ['phone_open_app',{package_name:'com.android.chrome',display_target:'physical'}],
  ['phone_observe',{display_target:'physical'}],
  ['phone_act',{display_target:'physical',kind:'key',key:'back'}],
 ] as const){const tool=session.agent.state.tools.find((t:any)=>t.name===name);await assert.rejects(()=>tool.execute('physical',args),/private-display only/);}
 assert.deepEqual(effects,[]);
});

test('nested batch operations cannot switch to physical screens or unrestricted shell in the focused profile',async()=>{
 const {runtime,effects}=setup();const tool=nativeTools(runtime,'private-shop',['phone_batch','phone_open_url']).find(t=>t.name==='phone_batch')!;
 await assert.rejects(()=>tool.execute('batch',{calls:[{name:'phone_open_url',args:{url:'https://shop.example',display_target:'physical'}}]}),/private-display only/);
 await assert.rejects(()=>tool.execute('shell',{calls:[{name:'phone_shell',args:{action:'exec',command:'am start --display 0'}}]}),/cannot use unrestricted shell/);
 assert.deepEqual(effects,[]);
});

test('private research cannot execute arbitrary commands, read image files or target another display',async()=>{
 const {runtime,effects}=setup(),tool=nativeTools(runtime,'private-shop').find(t=>t.name==='phone_shell')!;
 for(const args of [{action:'exec',command:'input tap 1 1'},{action:'image',path:'/some/image'},{action:'capture',display_id:0},{action:'capture',display_id:99}])await assert.rejects(()=>tool.execute('shell',args),/cannot use unrestricted shell/);
 for(const action of ['context','acquire','release','capture','poll','stop'])assert.doesNotThrow(()=>runtime.authorizePhone('private-shop','phone_shell',{action}));
 assert.deepEqual(effects,[]);
});

test('restored shopping workers receive the same enforced private-display scope',()=>{
 const {runtime,definition}=setup();
 (runtime as any).createSession('restored-shop',{definition,requestedConfig:{}},[{role:'system',content:'Old unrestricted fallback prompt'}]);
 assert.equal(runtime.privateDisplayResearch('restored-shop'),true);
 assert.throws(()=>runtime.authorizePhone('restored-shop','phone_act',{display_target:'physical'}),/private-display only/);
});
