import test from 'node:test';import assert from 'node:assert/strict';
import {buildOfferReview,observedSandboxProposal} from '../src/offer-review.js';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
import {AssistantMessageEventStream} from '@earendil-works/pi-ai';
import {inspectStoreObservation} from '../src/native-store.js';
import {updateShoppingRequest} from '../src/shopping-request.js';
const now=1794030000000;
function offer(extra:string[]=[],usd=false){const title='Sony X100 headphones';return inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:'source',captured_at_ms:now,nodes:[{resource_id:'productTitle',text:title},{text:'Add to cart'},{text:(usd?'USD':'INR')+' 100'},{text:'In stock'},{text:'Condition: New'},{text:'Sold by: Seller A'},...extra.map(text=>({text}))]},'amazon',{selectedLabel:title,selectedFromSnapshot:'search'});}
const req=(usd=false)=>updateShoppingRequest(undefined,'Find new headphones under '+(usd?'USD':'INR')+' 5000')!;
test('complete explicit source claims permit a reported review without certifying merchant checkout',()=>{
 const r=buildOfferReview(offer(['Shipping: INR 10','Taxes: INR 5','Total mandatory fees: INR 2','No membership required','Ships to India','Deliver to: Selected area']),req(),1,now);
 assert.equal(r.status,'source-reported-review');assert.equal(r.cart?.reportedTotalCents,11700);assert.equal(r.checkoutVerified,false);assert.equal(r.purchaseReady,false);assert.equal(r.cart?.simulated,true);
});
test('unknown shipping tax fees destination and membership stay unknown in the simulated cart',()=>{
 const r=buildOfferReview(offer(),req(),1,now);assert.equal(r.cart?.itemSubtotalCents,10000);assert.equal(r.cart?.reportedTotalCents,null);assert.ok(r.unknowns.includes('shipping'));assert.equal(r.sandboxReview.eligible,false);
});
test('changed quantity cannot reuse a unit-only delivery quote',()=>{
 const r=buildOfferReview(offer(['Shipping: INR 10','Taxes: INR 5','Total mandatory fees: INR 2','No membership required','Ships to India','Deliver to: Selected area']),req(),2,now);assert.equal(r.cart?.itemSubtotalCents,20000);assert.equal(r.cart?.reportedTotalCents,null);
});
test('included tax is not added twice and contradictory free shipping prevents a reviewed draft',()=>{
 const included=buildOfferReview(offer(['Shipping: INR 10','Taxes: INR 5','All taxes included','Total mandatory fees: INR 2','No membership required','Ships to India','Deliver to: Selected area']),req(),1,now);assert.equal(included.cart?.reportedTotalCents,11200);
 const conflicting=buildOfferReview(offer(['Shipping: INR 10','FREE shipping']),req(),1,now);assert.equal(conflicting.cart,null);assert.equal(conflicting.verification.costConflict,true);
});
test('contradiction, invalid quantity and expired evidence cannot create a simulation draft',()=>{
 assert.equal(buildOfferReview(offer(),req(),0,now).cart,null);assert.equal(buildOfferReview(offer(),req(),1,now+16*60000).cart,null);assert.equal(buildOfferReview({...offer(),stock:'unavailable'},req(),1,now).cart,null);
});
test('USD sandbox proposal needs a compatible observed HTTPS link and explicit later buyer approval',()=>{
 const native=offer([],true);assert.equal(buildOfferReview(native,req(true),1,now).sandboxReview.eligible,false);
 const r=buildOfferReview({...native,sourceUrl:'https://www.amazon.com/dp/AIEXAMPLE'},req(true),1,now);assert.equal(r.sandboxReview.eligible,true);assert.equal(r.sandboxReview.requiresExplicitBuyerApproval,true);assert.equal(r.sandboxReview.amountCents,10000);
});
test('legacy sandbox proposals cannot invent prices or refresh expired field evidence',()=>{
 const r={...offer([],true),sourceUrl:'https://www.amazon.com/dp/AIEXAMPLE'},p={title:r.listingTitle,url:r.sourceUrl,unitCents:10000,currency:'USD',quantity:1};
 assert.equal(observedSandboxProposal(p,[r],req(true),now),true);assert.equal(observedSandboxProposal({...p,unitCents:1},[r],req(true),now),false);assert.equal(observedSandboxProposal(p,[{...r,evidenceObservedAt:now-16*60000}],req(true),now),false);
});
test('actual main stream resolves only known current-chat offer IDs and suppresses unobserved payment markers',async()=>{
 let saved:any={};const bridge={call(method:string,raw:string){const a=JSON.parse(raw);if(method==='store.save')saved=a.state;return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():method==='store.load'?saved:{}});},emit(){}};
 const r=new PocketRuntime(bridge),fresh={...offer(),observedAt:Date.now(),continuity:{chainId:'current'}};const source=r.recordShoppingEvidence('main',fresh);let output='POCKET_REVIEW '+JSON.stringify({offerId:source.offer_id,quantity:1});
 r.main.agent.streamFunction=((model:any)=>{const stream=new AssistantMessageEventStream(),message:any={role:'assistant',content:[{type:'text',text:output}],api:model.api,provider:model.provider,model:model.id,timestamp:Date.now(),stopReason:'stop',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};stream.push({type:'done',reason:'stop',message});stream.end(message);return stream;}) as any;
 r.dispatch(JSON.stringify({action:'send',text:'I choose Sony X100 headphones, prepare checkout'}));for(let i=0;i<100&&!r.state().messages.some((m:any)=>m.role==='assistant');i++)await new Promise(done=>setTimeout(done,10));assert.match(r.state().messages.at(-1).text,/Source-informed simulated cart/);assert.ok(!r.state().messages.at(-1).text.includes('POCKET_CHECKOUT'));
 assert.equal(r.reviewShoppingOffer('offer_'+'f'.repeat(20)),null);output='POCKET_CHECKOUT '+JSON.stringify({title:'Invented product',url:'https://shop.example/products/fake',unitCents:100,currency:'USD',quantity:1});const count=r.state().messages.length;r.dispatch(JSON.stringify({action:'send',text:'I choose that one, prepare checkout'}));for(let i=0;i<100&&r.state().messages.length<=count+1;i++)await new Promise(done=>setTimeout(done,10));assert.match(r.state().messages.at(-1).text,/Sandbox review is held/);
});
