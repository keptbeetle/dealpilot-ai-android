import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectStoreObservation,navigateStoreApp,STORE_APPS} from '../src/native-store.js';
import {nativeStoreForUrl} from '../src/store-policy.js';
import {browsePage,inspectBrowserObservation,type BrowserObservation} from '../src/browser.js';
import {browserReports,groundedShoppingResearch} from '../src/shopping-evidence.js';
import {nativeTools,clearNativeToolUiState} from '../src/tools.js';

// Assistant-authored synthetic source fixtures; not real retailer or human evidence.
const now=1793948000000;
const pkg=STORE_APPS.amazon.packages[0];
function screen(nodes:any[],extra:Partial<BrowserObservation>={}):BrowserObservation {
 return {package_name:pkg,snapshot_id:'native-fixture',captured_at_ms:now,coordinate_width:720,coordinate_height:1280,nodes,...extra};
}
const product=()=>screen([{resource_id:'product_title',text:'Sony wireless headphones WH-EXAMPLE'},{text:'INR 4999'},{text:'INR 3999 with bank credit card'},{text:'In stock'},{text:'Add to Cart',clickable:true}]);
const wrap=(value:any)=>({content:[{type:'text',text:JSON.stringify(value)}]});

test('Flipkart product scope excludes a previous listing and monthly instalments from the current price',()=>{
 const title='Tune 770NC Active Noise Cancelling, 70Hr Playtime, Fast Pair & Mu...more';
 const observations=screen([
  {text:'₹2,699'},{text:'JBL'},{text:'Visit store'},{text:title},{text:'Buy now'},
  {description:'53%, 9,999, ₹4,749',clickable:true},{text:'₹4,749'},
  {text:'Buy at ₹4,036, EMI @ ₹673 x 6m, No Cost EMI'},{text:'Buy at ₹4,036'},{text:'EMI @ ₹673 x 6m'},{text:'₹1,009/m, (4 months), Bajaj Finance'},{text:'+₹39 Protect Promise Fee'},
 ],{package_name:'com.flipkart.android'});
 const selected='JBL, Tune 770NC Active Noise Cancelling, 70Hr Playtime, Fast Pair & Multi Connect Bluetooth Headset Black';
 const r=inspectStoreObservation(observations,'flipkart',{selectedLabel:selected,selectedFromSnapshot:'results'});
 assert.equal(r.regularPrice?.amountCents,474900);
 assert.ok(!r.prices.some(p=>p.amountCents===269900&&p.kind==='listed'));
 assert.ok(r.prices.filter(p=>[403600,100900].includes(p.amountCents)).every(p=>p.kind==='conditional'));
 assert.match(r.listingTitle||'',/^JBL Tune 770NC/);
});

test('busy and stale native gestures retry only when dispatch was explicitly prevented',async()=>{
 for(const mode of ['busy','stale-twice','unknown','window-changed']){
  let reads=0,acts=0;
  const result=await navigateStoreApp(async(name,args)=>{
   if(name==='phone_capabilities')return wrap({operation_prefix:'owned'});
   if(name==='phone_apps')return wrap({apps:[{package_name:pkg}]});
   if(name==='phone_observe'){
    reads++;
    return wrap({...product(),snapshot_id:'fresh-'+reads,window_id:mode==='window-changed'&&reads>1?2:1});
   }
   if(name==='phone_act'){
    acts++;
    if(mode==='unknown')return wrap({isError:true,code:'RESULT_UNKNOWN'});
    if(acts<=(mode==='stale-twice'?2:1))return wrap({isError:true,code:mode==='busy'?'NOT_READY':'STALE_OBSERVATION',dispatch_status:'not_dispatched'});
   }
   return wrap({status:'dispatched'});
  },{store:'amazon',action:{kind:'scroll',direction:'down'}},'retry-'+mode);
  assert.equal(acts,mode==='busy'?2:mode==='stale-twice'?3:1);
  assert.equal(Boolean(result.isError),mode==='unknown'||mode==='window-changed');
 }
});
function bridge(observations:BrowserObservation[],error?:any){
 const calls:any[]=[];let index=0;
 return {calls,execute:async(name:string,args:any)=>{calls.push({name,args});return wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?observations[Math.min(index++,observations.length-1)]:error||{status:'requested'});}};
}
test('retailer hosts are exact and both regional Amazon packages are supported',()=>{
 for(const url of ['https://www.amazon.in/s?k=headphones','https://amazon.com/dp/example'])assert.equal(nativeStoreForUrl(url),'amazon');
 assert.equal(nativeStoreForUrl('https://www.flipkart.com/example/p/id'),'flipkart');
 assert.equal(nativeStoreForUrl('https://amazon.in.evil.example/dp/id'),undefined);
 assert.equal(inspectStoreObservation(product(),'amazon').sourceBound,true);
 assert.equal(inspectStoreObservation({...product(),package_name:STORE_APPS.amazon.packages[1]},'amazon').sourceBound,true);
});

test('selected native detail title establishes a product while purchase controls are offscreen',()=>{
 const title='JBL Tune 510BT wireless headphones';
 const r=inspectStoreObservation(screen([{resource_id:'productTitle',text:title},{text:'4.1 stars'},{text:'Customer reviews'}]),'amazon',{selectedLabel:title,selectedFromSnapshot:'search'});
 assert.equal(r.pageKind,'product-page');assert.equal(r.regularPrice,null);
});
test('escaped ampersand does not break an otherwise identical native scroll identity',()=>{
 const r=inspectStoreObservation(screen([{resource_id:'productTitle',text:'JBL X100 &amp; Voice Assistant'},{text:'INR 2999'}]),'amazon',{productPage:{label:'JBL X100 & Voice Assistant',at:now-1000,snapshot:'identity'}});
 assert.equal(r.listingTitle,'JBL X100 & Voice Assistant');assert.equal(r.identityObservation?.snapshot_id,'identity');
});
test('browser calls cannot navigate to Amazon or Flipkart or bind their website prices',async()=>{
 for(const url of ['https://www.amazon.in/dp/example','https://www.flipkart.com/example/p/id']){
  const result=await browsePage(async()=>{throw Error('No browser primitive permitted');},{url},'blocked');
  assert.equal(result.code,'NATIVE_STORE_REQUIRED');
  const report=inspectBrowserObservation(screen([{resource_id:'com.android.chrome:id/url_bar',text:url},{text:'INR 999'},{text:'In stock'}],{package_name:'com.android.chrome'}));
  assert.equal(report.sourceBound,false);assert.equal(report.regularPrice,null);
 }
});
test('native research accepts the authorized physical display and missing apps never launch a browser',async()=>{
 const visible=bridge([product()]);
 const report=await navigateStoreApp(visible.execute,{store:'amazon',display_target:'physical'},'physical');assert.equal(report.display_target,'physical');
 const calls:string[]=[];const absent=async(name:string)=>{calls.push(name);return wrap(name==='phone_apps'?{apps:[]}:{operation_prefix:'owned'});};
 assert.equal((await navigateStoreApp(absent,{store:'flipkart',query:'headphones'},'absent')).code,'STORE_APP_NOT_INSTALLED');
 assert.deepEqual(calls,['phone_capabilities','phone_apps']);
});
test('native links reject credential, wrong-store, insecure, unusual-port and checkout targets before dispatch',async()=>{
 for(const url of ['http://www.amazon.in/dp/example','https://secret@www.amazon.in/dp/example','https://www.amazon.in:1234/dp/example','https://www.flipkart.com/example/p/id','https://www.amazon.in/checkout']){
  await assert.rejects(()=>navigateStoreApp(async()=>{throw Error('Must not dispatch');},{store:'amazon',url},'bad'),/ordinary HTTPS/);
 }
});
test('native product links use the installed package on a private display and retain real observation provenance',async()=>{
 const host=bridge([product()]);const report=await navigateStoreApp(host.execute,{store:'amazon',url:'https://www.amazon.in/dp/example',display_target:'virtual'},'native-link');
 const launch=host.calls.find(c=>c.name==='phone_open_url');assert.equal(launch.args.app_package,pkg);assert.equal(launch.args.browser,undefined);
 assert.ok(host.calls.filter(c=>!['phone_apps','phone_capabilities'].includes(c.name)).every(c=>c.args.display_target==='virtual'));
 assert.equal(report.sourceKind,'android-app');assert.equal(report.sourceUrl,null);assert.match(report.sourceRef,/^android-app:\/\//);
});

test('read-only stale observations are reobserved before a native listing is discarded',async()=>{
 const host=bridge([{isError:true,code:'STALE_OBSERVATION',message:'Screen changed during observation'} as any,product()]);
 const result=await navigateStoreApp(host.execute,{store:'amazon',url:'https://www.amazon.in/dp/example'},'stale-read');
 assert.equal(result.pageKind,'product-page');assert.equal(result.sourceBound,true);assert.equal(host.calls.filter(c=>c.name==='phone_observe').length,2);
});

test('Flipkart rotating search placeholder and single unlabelled editor can complete a native search',async()=>{
 const fp=STORE_APPS.flipkart.packages[0],query='wireless headphones';
 const frames=[
  screen([{text:'For You'},{text:'Fashion'},{text:'Mobiles'},{text:'Electronics'},{description:'watches',role:'android.view.ViewGroup',clickable:true,bounds:{left:108,top:220,right:540,bottom:262}},{text:'watches',bounds:{left:108,top:220,right:540,bottom:262}}],{package_name:fp}),
  screen([{text:'For You'},{text:'Fashion'},{text:'Mobiles'},{text:'Electronics'}],{package_name:fp}),
  screen([{role:'android.widget.EditText',editable:true,focused:true,text:''},{text:'Recent searches'},{text:'Clear history'},{text:'Back'},{text:'Popular searches'}],{package_name:fp}),
  screen([{role:'android.widget.EditText',editable:true,text:query}],{package_name:fp}),
  screen([{text:'Filters'},{text:'Headphone results'},{text:'JBL'},{text:'Sony'}],{package_name:fp})
 ];let index=0;const actions:any[]=[];
 const result=await navigateStoreApp(async(name,args)=>wrap(name==='phone_capabilities'?{operation_prefix:'own'}:name==='phone_apps'?{apps:[{package_name:fp}]}:name==='phone_observe'?frames[Math.min(index++,frames.length-1)]:(actions.push(args),{})),{store:'flipkart',query},'flipkart-dynamic');
 assert.equal(result.pageKind,'search-results');assert.ok(actions.some(a=>a.kind==='type'&&a.text===query));
});

test('not-dispatched rotating search can rebind only the same freshly observed search rectangle',async()=>{
 const fp=STORE_APPS.flipkart.packages[0],query='headphones',b={left:108,top:220,right:540,bottom:262};
 const home=(word:string)=>screen([{text:'For You'},{text:'Fashion'},{text:'Mobiles'},{text:'Electronics'},{description:word,clickable:true,bounds:b}],{package_name:fp});
 const frames=[home('watches'),{isError:true,code:'STALE_OBSERVATION'},home('mobiles'),screen([{text:'Search products',resource_id:'search_edit',editable:true},{text:'Recent'},{text:'Popular'},{text:'Cancel'}],{package_name:fp}),screen([{text:query,resource_id:'search_edit',editable:true}],{package_name:fp}),screen([{text:'Filters'},{text:'Results'},{text:'Sony'},{text:'JBL'}],{package_name:fp})];
 let frame=0,clicks=0;const actions:any[]=[];
 const r=await navigateStoreApp(async(name,args)=>{
  if(name==='phone_capabilities')return wrap({operation_prefix:'own'});if(name==='phone_apps')return wrap({apps:[{package_name:fp}]});if(name==='phone_observe')return wrap(frames[Math.min(frame++,frames.length-1)]);
  if(name==='phone_act'){actions.push(args);if(args.kind==='click'&&++clicks===1)return wrap({isError:true,code:'STALE_OBSERVATION',dispatch_status:'not_dispatched'});}return wrap({});
 },{store:'flipkart',query},'rotating-safe-retry');
 assert.equal(r.pageKind,'search-results');assert.equal(r.preDispatchRecoveries.length,1);assert.deepEqual(actions.slice(0,2).map(a=>a.selector.description),['watches','mobiles']);assert.notEqual(actions[0].operation_id,actions[1].operation_id);
});

test('resuming Flipkart with an already focused unlabelled editor replaces the old query directly',async()=>{
 const fp=STORE_APPS.flipkart.packages[0],query='wireless headphones',frames=[
  screen([{text:'tv',editable:true,focused:true},{text:'Recent Searches'},{text:'Edit'},{text:'Recommended Stores'}],{package_name:fp}),
  screen([{text:query,editable:true,focused:true},{text:query}],{package_name:fp}),
  screen([{text:'Filters'},{text:'Results'},{text:'Sony'},{text:'JBL'}],{package_name:fp})
 ];let i=0;const acts:any[]=[];
 const r=await navigateStoreApp(async(name,args)=>wrap(name==='phone_capabilities'?{operation_prefix:'own'}:name==='phone_apps'?{apps:[{package_name:fp}]}:name==='phone_observe'?frames[Math.min(i++,frames.length-1)]:(acts.push(args),{})),{store:'flipkart',query},'warm-editor');
 assert.equal(r.pageKind,'search-results');assert.deepEqual(acts.filter(a=>a.kind).map(a=>a.kind),['type','key']);assert.equal(acts.find(a=>a.kind==='type').text,query);assert.equal(acts.find(a=>a.kind==='key').selector,undefined);
});

test('Flipkart result-header query can be reopened without mistaking filter controls for search',async()=>{
 const fp=STORE_APPS.flipkart.packages[0],query='wireless headphones',frames=[
  screen([{text:'Sort & Filter'},{text:'Top Rated'},{text:'Fast Charging'},{text:'Headphones',description:'Headphones',clickable:true,bounds:{left:98,top:65,right:615,bottom:121}}],{package_name:fp}),
  screen([{text:'Headphones',editable:true,focused:true},{text:'Recent Searches'},{text:'Edit'},{text:'Recommended Stores'}],{package_name:fp}),
  screen([{text:query,editable:true,focused:true}],{package_name:fp}),
  screen([{text:'Filters'},{text:'Results'},{text:'Sony'},{text:'JBL'}],{package_name:fp})
 ];let i=0;const acts:any[]=[];
 const r=await navigateStoreApp(async(name,args)=>wrap(name==='phone_capabilities'?{operation_prefix:'own'}:name==='phone_apps'?{apps:[{package_name:fp}]}:name==='phone_observe'?frames[Math.min(i++,frames.length-1)]:(acts.push(args),{})),{store:'flipkart',query},'result-editor');
 assert.equal(r.pageKind,'search-results');assert.equal(acts.find(a=>a.kind==='click').selector.description,'Headphones');
});
test('no-SKU search plus scroll confirms native input and observes actual results before acting',async()=>{
 const query='Sony JBL wireless headphones';const host=bridge([
  screen([{text:'Search Amazon.in',resource_id:'search_box',clickable:true},{text:'Home'},{text:'Categories'},{text:'Deals'}],{snapshot_id:'home'}),
  screen([{resource_id:'search_edit',editable:true,text:'Search Amazon.in'},{text:'Recent'},{text:'Headphones'},{text:'Cancel'}],{snapshot_id:'input'}),
  screen([{resource_id:'search_edit',editable:true,text:query}],{snapshot_id:'typed'}),
  screen([{text:'Filters'},{text:'Sony headphones'},{text:'JBL headphones'},{text:'INR 4999'}],{snapshot_id:'results'}),
 ]);
 const report=await navigateStoreApp(host.execute,{store:'amazon',query,action:{kind:'scroll',direction:'down'}},'no-sku');
 const acts=host.calls.filter(c=>c.name==='phone_act').map(c=>c.args);
 assert.deepEqual(acts.map(a=>a.kind),['click','type','key','swipe']);assert.equal(acts[1].text,query);assert.equal(acts[2].snapshot_id,'typed');assert.equal(acts[2].key,'enter');assert.equal(acts[3].snapshot_id,'results');
 assert.equal(new Set(acts.map(a=>a.operation_id)).size,4);assert.equal(report.pageKind,'search-results');assert.equal(report.regularPrice,null);
});
test('source package, freshness and individual-product evidence are required; cards remain discovery',()=>{
 const report=inspectStoreObservation(product(),'amazon',{}, {currency:'INR',budgetCents:500000});
 assert.equal(report.pageKind,'product-page');assert.equal(report.regularPrice?.amountCents,499900);assert.equal(report.prices.find(p=>p.amountCents===399900)?.kind,'conditional');
 const cards=inspectStoreObservation(screen([...product().nodes!,{text:'Filters'}]),'amazon',{query:'headphones'});
 assert.equal(cards.regularPrice,null);assert.equal(cards.pageKind,'search-results');
 for(const extra of [{package_name:'com.android.chrome'},{snapshot_id:undefined},{captured_at_ms:undefined}]){
  const wrong=inspectStoreObservation({...product(),...extra},'amazon');assert.equal(wrong.sourceBound,false);assert.equal(wrong.regularPrice,null);
 }
});
test('purchase actions, ambiguous targets and challenges never reach a research click',async()=>{
 for(const [observation,selector,code] of [
  [product(),{text:'Add to Cart'},'RESEARCH_ACTION_BLOCKED'],
  [screen([{text:'Sony headphones',clickable:true},{text:'Sony headphones',clickable:true},{text:'Filters'},{text:'Other'}]),{text:'Sony headphones'},'APP_TARGET_AMBIGUOUS'],
 ] as const){const host=bridge([observation]);const result=await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector}},code);assert.equal(result.code,code);assert.ok(!host.calls.some(c=>c.name==='phone_act'));}
 const host=bridge([screen([{text:'CAPTCHA verify you are human'},{text:'INR 4999'},{text:'Continue'},{text:'Help'}])]);
 assert.equal((await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector:{text:'Continue'}}},'challenge')).blocked,true);
 assert.ok(!host.calls.some(c=>c.name==='phone_act'));
});

test('off-screen retained WebView cards cannot hide current navigation or contaminate observed prices',()=>{
 const observation=product();
 observation.nodes=[...Array.from({length:40},(_,n)=>({text:'Old sponsored card '+n,clickable:true,bounds:{left:0,top:-100,right:720,bottom:-10}})),...observation.nodes!,{text:'INR 999',bounds:{left:0,top:2000,right:720,bottom:2100}}];
 const report=inspectStoreObservation(observation,'amazon');
 assert.equal(report.regularPrice?.amountCents,499900);assert.ok(!report.navigationTargets.some(t=>t.label.includes('Old sponsored')));assert.ok(!report.prices.some(p=>p.amountCents===99900));
});

test('clipped labels, duplicate selectors and tracking strings are not offered as navigation targets',()=>{
 const report=inspectStoreObservation(screen([{text:'x'.repeat(400),clickable:true},{text:'Duplicate',clickable:true},{text:'Duplicate',clickable:true},{description:'ref=tracking&keywords=Sony+headphones',clickable:true},{text:'Sony headphones',clickable:true}]),'amazon');
 assert.deepEqual(report.navigationTargets.map(t=>t.label),['Sony headphones']);
});

test('duplicate native WebView labels use a fresh bounded hit while stale positions and purchase labels remain blocked',async()=>{
 const bounds={left:100,top:200,right:500,bottom:300};
 const nodes=[{text:'Sony wireless headphones',clickable:true,bounds},{text:'Sony wireless headphones',clickable:true,bounds},{text:'Filters'},{text:'Help'}];
 const host=bridge([screen(nodes),product()]);
 await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector:{text:'Sony wireless headphones',bounds:{bottom:300,right:500,top:200,left:100}}}},'position');
 const action=host.calls.find(c=>c.name==='phone_act').args;assert.equal(action.x,300);assert.equal(action.y,250);assert.equal(action.selector,undefined);assert.equal(action.snapshot_id,'native-fixture');
 const stale=bridge([screen(nodes)]);const result=await navigateStoreApp(stale.execute,{store:'amazon',action:{kind:'click',selector:{text:'Sony wireless headphones',bounds:{...bounds,top:201}}}},'stale');
 assert.equal(result.code,'APP_TARGET_AMBIGUOUS');assert.ok(!stale.calls.some(c=>c.name==='phone_act'));
});
test('a native product gallery scrolls to a title before binding price and stock',async()=>{
 const title='JBL Tune 520BT wireless headphones';
 const search=screen([{text:'Filters'},{text:title,clickable:true},{text:'Search'},{text:'Sort by relevance'},{text:'More results'}],{snapshot_id:'results',window_id:7});
 const gallery=screen([{text:'Buy now'},{text:'Selected Color: Black'},{text:'Gallery'},{text:'Top pick'},{text:'Headphone image'}],{snapshot_id:'gallery',window_id:7});
 const detail=screen([{resource_id:'product_title',text:title},{text:'INR 2999'},{text:'In stock'},{text:'Buy now'}],{snapshot_id:'detail',window_id:7});
 const host=bridge([search,gallery,detail]);
 const result=await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector:{text:title}}},'gallery');
 assert.equal(result.pageKind,'product-page',JSON.stringify(result));
 assert.equal(result.listingTitle,title);
 assert.equal(result.regularPrice?.amountCents,299900);
 assert.equal(result.stock,'available');
 assert.equal(host.calls.filter(c=>c.name==='phone_act'&&c.args.kind==='swipe').length,1);
 assert.equal(result.sourceBound,true);
});
test('gallery recovery refuses changed native window and never reads the unrelated product price',async()=>{
 const title='JBL Tune 520BT wireless headphones';
 const search=screen([{text:'Filters'},{text:title,clickable:true},{text:'Search'},{text:'Sort by relevance'},{text:'More results'}],{snapshot_id:'results',window_id:7});
 const gallery=screen([{text:'Buy now'},{text:'Selected Color: Black'},{text:'Gallery'},{text:'Top pick'},{text:'Headphone image'}],{snapshot_id:'gallery',window_id:7});
 const different=screen([{resource_id:'product_title',text:'Unrelated sponsored headphones'},{text:'INR 999'},{text:'In stock'},{text:'Buy now'}],{snapshot_id:'different-window',window_id:8});
 const host=bridge([search,gallery,different]);
 const result=await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector:{text:title}}},'gallery-window-change');
 assert.notEqual(result.pageKind,'product-page');
 assert.equal(result.regularPrice,null);
 assert.equal(host.calls.filter(c=>c.name==='phone_act'&&c.args.kind==='swipe').length,1);
});
test('native actions consume fresh snapshots and cancellation stops before any primitive',async()=>{
 const host=bridge([screen([{text:'Sony headphones',clickable:true},{text:'Filters'},{text:'Search'},{text:'Help'}],{snapshot_id:'fresh'}),product()]);
 const context={};await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'click',selector:{text:'Sony headphones'}}},'click',undefined,context);
 assert.equal(host.calls.find(c=>c.name==='phone_act').args.snapshot_id,'fresh');assert.match(JSON.stringify(context),/Sony headphones/);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>navigateStoreApp(async()=>{throw Error('Must not dispatch');},{store:'amazon'},'cancelled',controller.signal),/cancelled/);
});
test('private-session rejection is retained without retries, website calls or physical takeover',async()=>{
 const host=bridge([],{isError:true,code:'ACTION_REJECTED',message:'Existing session cannot be used on a private display'});
 const result=await navigateStoreApp(host.execute,{store:'amazon',query:'headphones'},'session');assert.equal(result.code,'ACTION_REJECTED');
 assert.deepEqual(host.calls.map(c=>c.name),['phone_capabilities','phone_apps','phone_open_app']);
});
test('completed worker releases native selections so retired target IDs cannot be reused',async()=>{
 const calls:string[]=[];
 const observation=screen([{text:'Search'},{text:'Headphones',clickable:true},{text:'Filters'},{text:'Other results'},{text:'Product cards'}]);
 const host={dropPriorImages:()=>{},call:(_method:string,{name}:any)=>{
  calls.push(name);return name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?observation:{status:'dispatched'};
 }};
 const tool=nativeTools(host,'finished-worker').find(tool=>tool.name==='phone_store_app');
 assert.ok(tool);
 const observed=JSON.parse((await tool.execute('inspect',{store:'amazon'})).content[0].text);
 const id=observed.navigationTargets?.find((t:any)=>t.label==='Headphones')?.target_id;
 assert.ok(id);
 clearNativeToolUiState(host,'finished-worker');
 const after=JSON.parse((await tool.execute('stale',{store:'amazon',target_id:id})).content[0].text);
 assert.equal(after.code,'APP_TARGET_EXPIRED');
 assert.equal(calls.filter(name=>name==='phone_act').length,0);
});
test('native composite retains primitive grants and approval gates',async()=>{
 const host={authorizePhone:()=>{throw Error('approval expired');},call:()=>{throw Error('must not dispatch');}};
 const restricted=nativeTools(host,'worker',['phone_store_app']).find(t=>t.name==='phone_store_app')!;
 await assert.rejects(()=>restricted.execute('read',{store:'amazon'}),/granted phone_capabilities/);
 const tool=nativeTools(host,'worker').find(t=>t.name==='phone_store_app')!;
 await assert.rejects(()=>tool.execute('read',{store:'amazon'}),/approval expired/);
});
test('native grounding uses observed product facts without invented URLs and preserves session holds',()=>{
 const report=inspectStoreObservation(product(),'amazon');const answer=groundedShoppingResearch([report],now);
 assert.match(answer,/₹4999.00/);assert.match(answer,/Conditional amount.*₹3999.00/);assert.match(answer,/pocket-store:\/\/amazon/);assert.match(answer,/Exact seller/);assert.ok(!answer.includes('https://'));
 assert.match(groundedShoppingResearch([report],now+16*60000),/No individual product/);
 const reports=browserReports([{role:'toolResult',toolName:'phone_store_app',timestamp:now,isError:true,content:[{type:'text',text:JSON.stringify({isError:true,store:'flipkart',message:'Private session blocked'})}]}]);
 const hold=groundedShoppingResearch(reports,now);assert.match(hold,/Private session blocked/);assert.match(hold,/pocket-store:\/\/flipkart/);assert.ok(!hold.includes('4999'));
 const cards=inspectStoreObservation(screen([{text:'Filters'},{text:'INR 4999'}]),'amazon',{query:'headphones'});assert.ok(!groundedShoppingResearch([cards],now).includes('4999'));
});

test('scroll continuity keeps the previously proven product identity with its original observation and expires it',()=>{
 const source=inspectStoreObservation(product(),'amazon');
 const context={productPage:{label:source.listingTitle!,at:now,snapshot:'identity-proof'}};
 const price=screen([{text:'INR 2989'},{text:'MRP INR 5990'},{text:'EMI from INR 105'},{text:'In stock'}],{captured_at_ms:now+1000});
 const report=inspectStoreObservation(price,'amazon',context);assert.equal(report.pageKind,'product-page');assert.equal(report.regularPrice?.amountCents,298900);assert.equal(report.identityObservation?.snapshot_id,'identity-proof');
 assert.equal(inspectStoreObservation({...price,captured_at_ms:now+16*60000},'amazon',context).pageKind,'unknown');
 assert.equal(inspectStoreObservation({...price,nodes:[...price.nodes!,{text:'All Filters Icon'}]},'amazon',context).pageKind,'search-results');
 const accessibleTitle={resource_id:'product_title',text:source.listingTitle+'. View media content in full screen'};
 assert.equal(inspectStoreObservation({...price,nodes:[accessibleTitle,...price.nodes!]},'amazon',context).pageKind,'product-page');
 assert.equal(inspectStoreObservation({...price,nodes:[accessibleTitle,...price.nodes!]},'amazon',context).listingTitle,source.listingTitle);
});

test('a redundant query is context for a fresh click, not a second search or an argument failure',async()=>{
 const host=bridge([screen([{text:'Sony headphones',clickable:true},{text:'Filters'},{text:'Search'},{text:'Help'}]),product()]);
 const result=await navigateStoreApp(host.execute,{store:'amazon',query:'Sony headphones',action:{kind:'click',selector:{text:'Sony headphones'}}},'redundant',undefined,{query:'Sony headphones'});
 assert.ok(!result.isError);assert.ok(host.calls.some(c=>c.name==='phone_act'));assert.ok(!host.calls.some(c=>c.name==='phone_open_app'));
});
test('only an explicitly nondispatched stale action can recover once with a fresh snapshot and new operation ID',async()=>{
 const calls:any[]=[];let observations=0,actions=0;
 const execute=async(name:string,args:any)=>{calls.push({name,args});return wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?{...product(),snapshot_id:'fresh-'+(++observations)}:name==='phone_act'&&actions++===0?{isError:true,code:'STALE_OBSERVATION',dispatch_status:'not_dispatched'}:{status:'dispatched'});};
 const result=await navigateStoreApp(execute,{store:'amazon',action:{kind:'scroll',direction:'down'}},'safe-retry');const acts=calls.filter(c=>c.name==='phone_act');assert.equal(acts.length,2);assert.notEqual(acts[0].args.operation_id,acts[1].args.operation_id);assert.notEqual(acts[0].args.snapshot_id,acts[1].args.snapshot_id);assert.equal(result.preDispatchRecoveries?.length,1);
});
test('unknown action outcomes are never retried',async()=>{
 const host=bridge([product()],{isError:true,code:'RESULT_UNKNOWN'});const result=await navigateStoreApp(host.execute,{store:'amazon',action:{kind:'scroll',direction:'down'}},'unknown');assert.equal(result.code,'RESULT_UNKNOWN');assert.equal(host.calls.filter(c=>c.name==='phone_act').length,1);
});
