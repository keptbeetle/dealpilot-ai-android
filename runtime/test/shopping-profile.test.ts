import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
import {nativeTools} from '../src/tools.js';
function setup(){
 const effects:any[]=[];
 const runtime=new PocketRuntime({call(method:string,raw:string){const args=JSON.parse(raw);if(method==='tool')effects.push(args);return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():{status:'requested'}});},emit(){}});
 const definition=runtime.registry.agents.get('shopping-researcher')!;
 const session=(runtime as any).createSession('shop',{definition,requestedConfig:{}});
 return {runtime,session,effects,definition};
}
test('owner-authorized visible shopping is advertised while general Pocket capabilities remain available',()=>{
 const {runtime,session}=setup();
 for(const name of ['phone_browser','phone_store_app','phone_open_url','phone_open_app','phone_observe','phone_act'])assert.ok(session.agent.state.tools.find((t:any)=>t.name===name).parameters.properties.display_target.enum.includes('physical'),name);
 assert.ok(runtime.main.agent.state.tools.find((t:any)=>t.name==='phone_shell').parameters.properties.action.enum.includes('exec'));
 assert.ok(!session.agent.state.tools.find((t:any)=>t.name==='phone_shell').parameters.properties.action.enum.includes('exec'));
});
test('visible and optional virtual native research pass the scoped authorization check',()=>{
 const {runtime}=setup();
 for(const name of ['phone_browser','phone_store_app','phone_open_url','phone_open_app','phone_observe','phone_act'])for(const display_target of ['physical','virtual'])assert.doesNotThrow(()=>runtime.authorizePhone('shop',name,{display_target}));
});
test('nested batches accept visible navigation but retain the source-safe shell boundary',async()=>{
 const {runtime,effects}=setup(),tool=nativeTools(runtime,'shop',['phone_batch','phone_open_url']).find(t=>t.name==='phone_batch')!;
 await tool.execute('visible',{calls:[{name:'phone_open_url',args:{url:'https://shop.example',display_target:'physical'}}]});
 assert.equal(effects[0].args.calls[0].args.display_target,'physical');
 await assert.rejects(()=>tool.execute('shell',{calls:[{name:'phone_shell',args:{action:'exec',command:'curl merchant.example'}}]}),/cannot use unrestricted shell/);
 assert.equal(effects.length,1);
});
test('research cannot substitute arbitrary commands or file images for the verification tool path',async()=>{
 const {runtime,effects}=setup(),tool=nativeTools(runtime,'shop').find(t=>t.name==='phone_shell')!;
 for(const args of [{action:'exec',command:'input tap 1 1'},{action:'image',path:'/some/image'},{action:'capture',display_id:0}])await assert.rejects(()=>tool.execute('shell',args),/cannot use unrestricted shell/);
 assert.deepEqual(effects,[]);
});
test('restored shopping workers retain visible permission and scoped shell protection',()=>{
 const {runtime,definition}=setup();(runtime as any).createSession('restored',{definition,requestedConfig:{}},[{role:'system',content:'Old private-only prompt'}]);
 assert.equal(runtime.focusedShoppingResearch('restored'),true);assert.doesNotThrow(()=>runtime.authorizePhone('restored','phone_act',{display_target:'physical'}));
 assert.throws(()=>runtime.authorizePhone('restored','phone_shell',{action:'exec'}),/cannot use unrestricted shell/);
});
