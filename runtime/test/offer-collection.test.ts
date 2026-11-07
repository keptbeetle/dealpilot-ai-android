import test from 'node:test';import assert from 'node:assert/strict';
import {navigateStoreApp,type StoreContext} from '../src/native-store.js';
import {OfferEvidenceLedger} from '../src/offer-evidence.js';
const now=Date.now(),pkg='in.amazon.mShop.android.shopping',title='Sony WH-X100 wireless headphones';
const wrap=(r:any)=>({content:[{type:'text',text:JSON.stringify(r)}]});
const frame=(id:string,lines:string[],label=title)=>({snapshot_id:id,captured_at_ms:now,package_name:pkg,coordinate_width:720,coordinate_height:1280,nodes:[{resource_id:'productTitle',text:label},{text:'About this item'},{text:'Product details'},{text:'Back'},...lines.map(text=>({text}))]});
function harness(frames:any[]){let i=0;const calls:any[]=[];return {calls,execute:async(name:string,args:any)=>{calls.push({name,args});return wrap(name==='phone_capabilities'?{operation_prefix:'owned'}:name==='phone_apps'?{apps:[{package_name:pkg}]}:name==='phone_observe'?frames[Math.min(i++,frames.length-1)]:{status:'requested'});}};}
const context=():StoreContext=>({query:'wireless headphones',selectedLabel:title,selectedFromSnapshot:'search',evidenceChain:'owned-selection',productPage:{label:title,at:now-1000,snapshot:'identity'}});
test('one native collection joins source price, stock and seller from successive real-screen frames',async()=>{
 const h=harness([frame('top',['Selected Color: Black']),frame('price',['INR 2999','Selected Color: Black']),frame('stock',['In stock','Sold by: Source Seller'])]);const ledger=new OfferEvidenceLedger();
 const r=await navigateStoreApp(h.execute,{store:'amazon',action:{kind:'collect'} as any},'collect-one',undefined,context(),report=>ledger.record(report));
 assert.equal(r.regularPrice?.amountCents,299900);assert.equal(r.stock,'available');assert.match(r.visibleText,/Sold by: Source Seller/);assert.equal(r.evidenceFields.regularPrice[0].snapshotId,'price');assert.equal(h.calls.filter(c=>c.name==='phone_act').length,2);assert.equal(r.collection.stoppedReason,'comparison-fields-observed');
});
test('collection stops when scrolling makes no progress and never operates purchase controls',async()=>{
 const h=harness([frame('top',['Add to cart'])]);const r=await navigateStoreApp(h.execute,{store:'amazon',action:{kind:'collect'} as any},'no-progress',undefined,context(),r=>r);
 assert.equal(r.collection.stoppedReason,'no-progress');assert.ok(h.calls.filter(c=>c.name==='phone_act').length<=2);assert.ok(h.calls.filter(c=>c.name==='phone_act').every(c=>c.args.kind==='swipe'));assert.equal(r.regularPrice,null);
});
test('collection stops on product change without merging another product price',async()=>{
 const h=harness([frame('top',[]),frame('other',['INR 1','In stock'],'JBL Other headphones')]),ledger=new OfferEvidenceLedger();
 const r=await navigateStoreApp(h.execute,{store:'amazon',action:{kind:'collect'} as any},'changed',undefined,context(),r=>ledger.record(r));
 assert.equal(r.code,'OFFER_CHANGED_DURING_COLLECTION');assert.equal(ledger.snapshot().entries.some(e=>e.frames.some(f=>f.listingTitle==='JBL Other headphones')),false);
});
