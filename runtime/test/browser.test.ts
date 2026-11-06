import assert from 'node:assert/strict';
import test from 'node:test';
import {browsePage,inspectBrowserObservation as inspect,type BrowserObservation} from '../src/browser.js';
import {nativeTools} from '../src/tools.js';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';

// Assistant-authored regression evidence. These are not merchant or human labels.
function page(lines:string[],url='shop.example/products/laptop'):BrowserObservation{
 return {snapshot_id:'sample',captured_at_ms:1793900000000,package_name:'com.android.chrome',nodes:[
  {resource_id:'com.android.chrome:id/url_bar',text:url},...lines.map(text=>({text}))]};
}
test('selected laptop compares regular price with budget while retaining conditional bank offer and MRP',()=>{
 const result=inspect(page(['ASUS Vivobook','16 GB RAM','512 GB SSD','₹82,281','MRP ₹94,990','₹76,531 with bank credit card','In stock']),{currency:'INR',budgetCents:8000000,brand:'ASUS',minimumRamGB:16,minimumStorageGB:512});
 assert.equal(result.sourceBound,true);assert.equal(result.regularPrice?.amountCents,8228100);
 assert.equal(result.prices.find(p=>p.amountCents===7653100)?.kind,'conditional');
 assert.equal(result.prices.find(p=>p.amountCents===9499000)?.kind,'reference');
 assert.equal(result.checks.find(c=>c.attribute==='regular-price budget')?.outcome,'contradicted');
 assert.equal(result.checks.find(c=>c.attribute==='RAM')?.outcome,'supported');
 assert.match(result.offers.join(' '),/bank credit/);
});
test('separate currency and amount accessibility nodes preserve cents without floating point conversion',()=>{
 const result=inspect(page(['JBL headphones','₹','4,999.95','In stock']),{currency:'INR',budgetCents:500000});
 assert.equal(result.regularPrice?.amountCents,499995);assert.equal(result.checks[0].outcome,'supported');
});
test('split MRP labels are reference prices and coupons never become unconditional prices',()=>{
 const result=inspect(page(['Headphones','MRP','₹8,000','₹5,000 with coupon','₹5,500','In stock']));
 assert.equal(result.regularPrice?.amountCents,550000);
 assert.equal(result.prices.find(p=>p.amountCents===800000)?.kind,'reference');
});
test('plain dollar symbol never silently becomes USD',()=>{
 const result=inspect(page(['ARK sensor','$250.00','In stock']),{currency:'USD',budgetCents:30000});
 assert.equal(result.regularPrice?.currency,'dollar-unspecified');assert.equal(result.checks[0].outcome,'unknown');
 assert.equal(inspect(page(['Sensor','US$250.00','In stock'])).regularPrice?.currency,'USD');
});

test('rating stars and review counts cannot be mistaken for an Rs price',()=>{
 const result=inspect(page(['Sony headphones','4.2 out of 5 stars 32,409 Reviews','In stock']));
 assert.deepEqual(result.prices,[]);assert.equal(result.regularPrice,null);
 assert.equal(inspect(page(['Headphones','Rs 2,989.00','In stock'])).regularPrice?.amountCents,298900);
});
test('inline MRP, regular price and bank labels do not leak onto adjacent amounts',()=>{
 const result=inspect(page(['ASUS laptop','MRP ₹94,990 Price ₹82,281 Bank offer ₹76,531','In stock']));
 assert.equal(result.regularPrice?.amountCents,8228100);
 assert.equal(result.prices.find(p=>p.amountCents===7653100)?.kind,'conditional');
});
test('savings, shipping fees and starting prices do not become the selected product price',()=>{
 for(const line of ['Save ₹1,000','Shipping ₹100','Starting price from ₹999','₹1,000 off']){
  assert.equal(inspect(page(['Product promotion',line,'In stock'])).regularPrice,null,line);
 }
 assert.equal(inspect(page(['Headphones','Bank card offer','₹3,000','In stock'])).regularPrice,null);
});
test('a selected ten-pack total is kept separate from per-piece and GST breakdown amounts',()=>{
 const result=inspect(page(['NFC stickers','₹500.00','for','10','pcs','₹50.00','/pc','×','Price (excl. GST)','₹424.00','GST @ 18%','+','₹76.00','In Stock']),{currency:'INR',budgetCents:10000});
 assert.equal(result.regularPrice?.amountCents,50000);assert.equal(result.checks[0].outcome,'contradicted');
 for(const value of [5000,42400,7600])assert.equal(result.prices.find(p=>p.amountCents===value)?.kind,'reference');
});
test('search cards, mixed variants and multiple prices require product-page evidence',()=>{
 const result=inspect(page(['ASUS laptops','8 GB RAM','16 GB RAM','₹69,990','₹82,281'],'www.google.com/search?q=asus+laptop'),{currency:'INR',budgetCents:8000000,minimumRamGB:16});
 assert.equal(result.pageKind,'search-results');assert.equal(result.regularPrice,null);
 assert.ok(result.checks.every(c=>c.outcome==='unknown'));
 const mixed=inspect(page(['8 GB RAM','16 GB RAM','Storage 1 TB','₹79,999','₹89,999']));
 assert.equal(mixed.regularPrice,null);assert.deepEqual(mixed.capacitiesGB.storage,[1024]);
});
test('insufficient RAM, sold out and contradictory availability remain visible holds',()=>{
 const result=inspect(page(['ASUS 8 GB RAM','₹50,000','In stock','Sold out']),{minimumRamGB:16});
 assert.equal(result.checks[0].outcome,'contradicted');assert.equal(result.stock,'conflict');assert.ok(result.holds.length);
 assert.equal(inspect(page(['Headphones','₹1,999','Currently unavailable'])).stock,'unavailable');
 assert.match(inspect(page(['Headphones','₹1,999'])).holds.join(' '),/Availability was not established/);
});
test('CAPTCHA, native-app takeover and hidden addresses cannot yield source-bound checks',()=>{
 const ordinary=page(['ASUS 16 GB RAM','₹70,000','In stock']);
 for(const observation of [page(['CAPTCHA verify you are human','₹70,000']),{...ordinary,package_name:'com.amazon.mShop.android.shopping'},{...ordinary,nodes:ordinary.nodes!.slice(1)}]){
  const result=inspect(observation,{currency:'INR',budgetCents:8000000});
  assert.equal(result.sourceBound,false);assert.equal(result.regularPrice,null);assert.equal(result.checks[0].outcome,'unknown');
 }
});
test('currency mismatch and truncated evidence cannot silently pass',()=>{
 const result=inspect({...page(['USD 99.99','In stock']),nodes_truncated:true},{currency:'INR',budgetCents:1000000});
 assert.equal(result.checks[0].outcome,'unknown');assert.match(result.holds.join(' '),/truncated/);
});
test('an address still being edited is not evidence of a loaded source page',()=>{
 const sample=page(['Headphones','INR 2999','In stock']);sample.nodes![0].focused=true;
 const result=inspect(sample,{currency:'INR',budgetCents:500000});assert.equal(result.sourceBound,false);assert.equal(result.regularPrice,null);assert.equal(result.checks[0].outcome,'unknown');
});
test('browser navigation explicitly selects Chrome, uses a stable bounded operation receipt, and rejects credential URLs',async()=>{
 const calls:any[]=[];const execute=async(name:string,args:any)=>{calls.push({name,args});return {content:[{type:'text',text:JSON.stringify(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_observe'?page(['Headphones on product page','USD 99.00 regular price','In stock and available for delivery']):{status:'requested'})}]};};
 await browsePage(execute,{url:'https://shop.example/products/headphones'},'id-1');
 const launch=calls.find(c=>c.name==='phone_open_url');assert.equal(launch.args.browser,'chrome');assert.match(launch.args.operation_id,/^owned_browse_[a-f0-9]{20}$/);
 await assert.rejects(()=>browsePage(execute,{url:'https://secret@shop.example/products/headphones'},'id-2'),/without credentials/);
});
test('composite browser cannot bypass primitive grants or authorization',async()=>{
 const host={authorizePhone:()=>{throw Error('approval expired');},call:()=>{throw Error('must not dispatch');}};
 const restricted=nativeTools(host,'worker',['phone_browser']).find(t=>t.name==='phone_browser')!;
 await assert.rejects(()=>restricted.execute('read',{}),/granted phone_observe/);
 const tool=nativeTools(host,'worker').find(t=>t.name==='phone_browser')!;
 await assert.rejects(()=>tool.execute('read',{}),/approval expired/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>tool.execute('read',{},aborted.signal),/Cancelled/);
});
test('a previous Chrome product cannot masquerade as the requested page, and visible-screen requests preserve their target',async()=>{
 const calls:any[]=[];const execute=async(name:string,args:any)=>{calls.push({name,args});return {content:[{type:'text',text:JSON.stringify(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_observe'?page(['Previous product has enough content','USD 99.00 regular price','In stock and available for delivery']):{status:'requested'})}]};};
 const result=await browsePage(execute,{url:'https://shop.example/products/new-product',display_target:'physical'},'navigation');
 assert.equal(result.navigationStatus,'unconfirmed');assert.equal(result.sourceUrl,'https://shop.example/products/laptop');
 assert.match(result.holds.join(' '),/earlier page/);
 assert.ok(calls.filter(c=>c.name!=='phone_capabilities').every(c=>c.args.display_target==='physical'));
});
test('focused shopping worker retains navigation prerequisites and model inheritance without removing original phone tools',async()=>{
 const bridge={call(method:string){return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():{}});},emit(){}};
 const runtime=new PocketRuntime(bridge);
 const definition=runtime.registry.agents.get('shopping-researcher');assert.ok(definition);
 const session=(runtime as any).createSession('shopping-check',{definition,requestedConfig:{}});
 const names=session.agent.state.tools.map((t:any)=>t.name);
 for(const required of ['phone_store_app','phone_apps','phone_open_app','phone_browser','phone_open_url','phone_observe','phone_act','phone_capabilities'])assert.ok(names.includes(required));
 assert.ok(!names.includes('phone_sms'));assert.ok(runtime.main.agent.state.tools.some((t:any)=>t.name==='phone_sms'));
 assert.ok(runtime.registry.agents.has('phone-operator'));assert.equal(session.agent.state.model.id,runtime.main.agent.state.model.id);
});
test('browser clicks capture a fresh snapshot immediately before dispatch and observe the resulting source',async()=>{
 const calls:any[]=[];let observations=0;
 const execute=async(name:string,args:any)=>{
  calls.push({name,args});const value=name==='phone_capabilities'?{operation_prefix:'approved'}:name==='phone_observe'?{...page(['Product navigation has loaded','INR 2999 regular price','In stock and available for delivery'],observations++?'shop.example/products/headphones':'shop.example/search?q=headphones'),snapshot_id:observations===1?'fresh-before-click':'after-click'}:{status:'requested'};
  return {content:[{type:'text',text:JSON.stringify(value)}]};
 };
 const result=await browsePage(execute,{action:{kind:'click',selector:{text:'JBL Headphones'}}},'fresh-action');
 assert.equal(calls.find(c=>c.name==='phone_act')?.args.snapshot_id,'fresh-before-click');
 assert.deepEqual(calls.map(c=>c.name),['phone_capabilities','phone_observe','phone_act','phone_observe']);
 assert.equal(result.sourceUrl,'https://shop.example/products/headphones');assert.equal(result.actionObservedChange,true);
});
test('research actions stop at challenges and reject purchase controls before a click',async()=>{
 const calls:string[]=[];const execute=async(name:string)=>{calls.push(name);return {content:[{type:'text',text:JSON.stringify(name==='phone_capabilities'?{operation_prefix:'approved'}:page(['CAPTCHA verify you are human']))}]};};
 const result=await browsePage(execute,{action:{kind:'click',selector:{text:'Continue'}}},'challenge');
 assert.equal(result.blocked,true);assert.ok(!calls.includes('phone_act'));
 await assert.rejects(()=>browsePage(execute,{action:{kind:'click',selector:{text:'Add to cart'}}},'buy'),/purchase controls/);
});
test('browser scrolling uses the fresh viewport for a gesture instead of an invalid selector-less scroll action',async()=>{
 const calls:any[]=[];let observations=0;const execute=async(name:string,args:any)=>{
  calls.push({name,args});return {content:[{type:'text',text:JSON.stringify(name==='phone_capabilities'?{operation_prefix:'approved'}:name==='phone_observe'?{...page(['Product details before or after scrolling','INR 4999 regular page price','In stock and available for delivery']),coordinate_width:720,coordinate_height:1280,snapshot_id:'viewport-'+(++observations)}:{status:'requested'})}]};
 };
 await browsePage(execute,{action:{kind:'scroll',direction:'down'}},'scroll');
 const action=calls.find(c=>c.name==='phone_act').args;assert.equal(action.kind,'swipe');assert.equal(action.snapshot_id,'viewport-1');assert.equal(action.x,360);assert.ok(action.y>action.end_y);assert.ok(action.y<1280&&action.end_y>0);
});
