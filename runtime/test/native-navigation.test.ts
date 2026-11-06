import test from 'node:test';import assert from 'node:assert/strict';
import {navigateStoreApp,classifyStoreScreen,type StoreContext} from '../src/native-store.js';
const pkg='in.amazon.mShop.android.shopping',now=Date.now();
const screen=(nodes:any[],id='frame')=>({package_name:pkg,snapshot_id:id,captured_at_ms:now,coordinate_width:720,coordinate_height:1280,nodes});
const product=()=>screen([{resource_id:'productTitle',text:'Sony X100 headphones'},{text:'Add to cart'},{text:'In stock'},{text:'INR 2999'},{text:'More details',clickable:true}]);
const wrap=(r:any)=>({content:[{type:'text',text:JSON.stringify(r)}]});
test('screen state recognises product controls without falsely admitting a complete listing',()=>{
 assert.equal(classifyStoreScreen(screen([{text:'Add to cart'},{text:'Buy now'}]),'amazon'),'product-details');assert.equal(classifyStoreScreen(screen([{text:'CAPTCHA verify you are human'}]),'amazon'),'challenge');assert.equal(classifyStoreScreen(screen([{text:'query',editable:true,focused:true}]),'amazon'),'search-input');
});
test('host-issued target IDs resolve observed controls and invented IDs dispatch nothing',async()=>{
 const context:StoreContext={},calls:any[]=[];
 const exec=async(name:string,args:any)=>{calls.push({name,args});return wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?product():{});};
 const first=await navigateStoreApp(exec,{store:'amazon'},'inspect',undefined,context);const target=first.navigationTargets.find((t:any)=>t.label==='More details');assert.match(target.target_id,/^target_/);
 await navigateStoreApp(exec,{store:'amazon',action:{kind:'click',target_id:target.target_id}},'click',undefined,context);assert.ok(calls.some(c=>c.name==='phone_act'&&c.args.selector?.text==='More details'));
 const before=calls.length;const forged=await navigateStoreApp(exec,{store:'amazon',action:{kind:'click',target_id:'target_forged'}},'forged',undefined,context);assert.equal(forged.code,'APP_TARGET_EXPIRED');assert.equal(calls.length,before);
});
test('new-query recovery goes back once from a recognised product and then confirms search input',async()=>{
 const q='headphones',frames=[product(),screen([{text:'Search Amazon.in',resource_id:'search_box',clickable:true},{text:'Home'},{text:'Deals'},{text:'Categories'}]),screen([{text:'Search',resource_id:'search_edit',editable:true},{text:'Recent'},{text:'Cancel'},{text:'Popular'}]),screen([{text:q,resource_id:'search_edit',editable:true}]),screen([{text:'Filters'},{text:'Sony'},{text:'JBL'},{text:'Results'}])];let i=0;const acts:any[]=[];
 const r=await navigateStoreApp(async(name,args)=>wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?frames[Math.min(i++,frames.length-1)]:(acts.push(args),{})),{store:'amazon',query:q},'recover');assert.equal(r.pageKind,'search-results');assert.equal(acts.find(a=>a.kind).key,'back');assert.equal(acts.filter(a=>a.key==='back').length,1);
});

test('owned targets can follow a full unchanged label after ad layout movement, but ambiguous or changed products hold',async()=>{
 const label='Sponsored Ad - Sony WH-CH520 Wireless Bluetooth Headphones Black';
 for(const mode of ['moved','ambiguous','changed']){
  const bounds=(top:number)=>({left:310,top,right:690,bottom:top+60});
  const listing=(top:number,text=label)=>({description:text,clickable:true,bounds:bounds(top)});
  const old=screen([{text:'Filters'},...Array.from({length:3},()=>listing(900)),{text:'Search Amazon.in'},{text:'Results'}],'old');
  const fresh=screen([{text:'Filters'},...Array.from({length:3},(_,i)=>listing(mode==='ambiguous'?500+i*100:500,mode==='changed'?'Different product':label)),{text:'Search Amazon.in'},{text:'Results'}],'fresh');
  let observations=0;const calls:any[]=[],context:StoreContext={};
  const exec=async(name:string,args:any)=>{calls.push({name,args});return wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?(observations++===0?old:fresh):{});};
  const first=await navigateStoreApp(exec,{store:'amazon'},'observe-'+mode,undefined,context),target=first.navigationTargets.find((t:any)=>t.label===label);
  const result=await navigateStoreApp(exec,{store:'amazon',action:{kind:'click',target_id:target.target_id}},'click-'+mode,undefined,context);
  const clicks=calls.filter(c=>c.name==='phone_act'&&c.args.kind==='click');
  if(mode==='moved'){assert.equal(clicks.length,1);assert.equal(clicks[0].args.y,530);assert.equal(result.isError,undefined);assert.equal(first.navigationTargets.filter((t:any)=>t.label===label).length,1);}
  else{assert.equal(result.code,'APP_TARGET_AMBIGUOUS');assert.equal(clicks.length,0);}
 }
});
