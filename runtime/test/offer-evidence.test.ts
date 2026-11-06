import test from 'node:test';
import assert from 'node:assert/strict';
import {OfferEvidenceLedger} from '../src/offer-evidence.js';
import {inspectStoreObservation} from '../src/native-store.js';
import {verifyShoppingReport} from '../src/shopping-verification.js';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
const now=1794030000000;
function frame(id:string,lines:string[],chain='selected-one',at=now){return {...inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:id,captured_at_ms:at,nodes:[{resource_id:'productTitle',text:'Sony X100 headphones'},{text:'About this item'},...lines.map(text=>({text}))]},'amazon',{selectedLabel:'Sony X100 headphones',selectedFromSnapshot:'search'}),continuity:{chainId:chain}};}
test('complementary scroll facts merge with per-field source and original timestamps',()=>{
 const l=new OfferEvidenceLedger();l.record(frame('price',['INR 2999','Selected Color: Black']),now);
 const r=l.record(frame('seller',['Sold by: Sample Seller','Condition: New','In stock']),now);
 assert.equal(r.regularPrice?.amountCents,299900);assert.equal(verifyShoppingReport(r,undefined,now).seller,'Sample Seller');assert.equal(r.evidenceFields.regularPrice[0].snapshotId,'price');assert.equal(r.evidenceFields.regularPrice[0].observedAt,now);
});
test('navigation and explicit variant, seller or delivery-location changes invalidate earlier price',()=>{
 for(const [before,after,chain] of [['Selected Color: Black','Selected Color: White','selected-one'],['Sold by: A Seller','Sold by: B Seller','selected-one'],['Deliver to: Area A','Deliver to: Area B','selected-one'],['','', 'another-selection']]){
  const l=new OfferEvidenceLedger();l.record(frame('first',['INR 2999',before]),now);const r=l.record(frame('next',[after],chain),now);assert.equal(r.regularPrice,null,before);
 }
});
test('conflicting price and stock or condition claims never silently choose the optimistic frame',()=>{
 const l=new OfferEvidenceLedger();l.record(frame('one',['INR 2999','In stock','Condition: New']),now);
 const r=l.record(frame('two',['INR 3999','Out of stock','Condition: Used']),now);assert.equal(r.regularPrice,null);assert.equal(r.stock,'conflict');assert.equal(verifyShoppingReport(r,undefined,now).status,'contradicted');
});
test('persisted evidence does not become fresh by restoring or taking a new unrelated snapshot',()=>{
 const l=new OfferEvidenceLedger();l.record(frame('one',['INR 2999']),now);
 const restored=new OfferEvidenceLedger(JSON.parse(JSON.stringify(l.snapshot())));const r=restored.record(frame('two',['Condition: New'],'selected-one',now+16*60000),now+16*60000);assert.equal(r.regularPrice,null);
 assert.deepEqual(new OfferEvidenceLedger({version:1,entries:[{garbage:true}]}).snapshot(),{version:1,entries:[]});
});
test('search, foreign-package and future frames cannot contaminate selected product evidence',()=>{
 const l=new OfferEvidenceLedger();const one=frame('one',['INR 2999']);l.record({...one,pageKind:'search-results'},now);l.record({...one,sourcePackage:'evil.app'},now);l.record({...one,observedAt:now+60000},now);assert.equal(l.snapshot().entries.length,0);
});
test('host checkpoint really saves and restores the offer ledger without refreshing timestamps',()=>{
 let saved:any={};const bridge={call(method:string,raw:string){const a=JSON.parse(raw);if(method==='store.save')saved=a.state;return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():method==='store.load'?saved:{}});},emit(){}};
 const r=new PocketRuntime(bridge);const at=Date.now(),one=frame('price',['INR 2999'],'persist',at);r.recordShoppingEvidence('main',one);
 assert.ok(Object.values(saved.offerEvidence).length);const restored=new PocketRuntime(bridge),combined=restored.recordShoppingEvidence('main',frame('seller',['Sold by: A Seller'],'persist',at+1));assert.equal(combined.regularPrice.amountCents,299900);assert.equal(combined.evidenceFields.regularPrice[0].observedAt,at);
});
test('OCR image provenance persists with its original earliest time and conflicts cannot revive a price',()=>{
 const l=new OfferEvidenceLedger();l.record({...frame('price',['INR 899']),priceEvidenceType:'ocr-stable',ocrEvidence:{snapshots:[{snapshotId:'pixels-one',observedAt:now-700,imageSha256:'a'.repeat(64)},{snapshotId:'pixels-two',observedAt:now,imageSha256:'b'.repeat(64)}]}},now);
 const restored=new OfferEvidenceLedger(l.snapshot()),r=restored.record(frame('details',['Condition: New']),now);assert.equal(r.ocrEvidence.snapshots[0].snapshotId,'pixels-one');assert.equal(r.evidenceObservedAt,now-700);
 const held=restored.record({...frame('conflict',['INR 999']),ocrConflict:true,regularPrice:null},now);assert.equal(held.regularPrice,null);assert.equal(verifyShoppingReport(held,undefined,now).status,'contradicted');
});
