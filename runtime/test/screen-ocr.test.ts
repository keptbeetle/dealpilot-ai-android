import test from 'node:test';import assert from 'node:assert/strict';
import {applyStableOcrPrice,applyStableVariantStock} from '../src/screen-ocr.js';
import {inspectStoreObservation} from '../src/native-store.js';
const now=1794030000000,title='Sony X100 headphones',pkg='in.amazon.mShop.android.shopping';
const obs=(id:string,price='Buy now at INR 899',at=now)=>({package_name:pkg,window_id:1,snapshot_id:id,captured_at_ms:at,coordinate_width:720,coordinate_height:1280,nodes:[{resource_id:'productTitle',text:title},{text:'Add to cart'}],ocr:{engine:'mlkit-latin',onDevice:true,snapshotId:id,capturedAt:at,imageSha256:'a'.repeat(64),width:720,height:1280,truncated:false,lines:[{text:title,bounds:{left:10,top:100,right:650,bottom:160}},{text:price,bounds:{left:10,top:1000,right:650,bottom:1100}}]}});
const report=()=>inspectStoreObservation(obs('native'),'amazon',{selectedLabel:title,selectedFromSnapshot:'results'});
test('two separately captured stable complete OCR prices retain image/snapshot provenance',()=>{
 const r=applyStableOcrPrice(report(),obs('one'),obs('two',undefined,now+700),now+700);assert.equal(r.regularPrice?.amountCents,89900);assert.equal(r.priceEvidenceType,'ocr-stable');assert.deepEqual(r.ocrEvidence.snapshots.map((s:any)=>s.snapshotId),['one','two']);
});
test('changing, ambiguous, conditional or implicit-currency pixels do not become regular prices',()=>{
 for(const [a,b] of [['Buy now at INR 899','Buy now at INR 999'],['INR 899','INR 899'],['Buy now at 899','Buy now at 899'],['Buy now INR 899 with bank card','Buy now INR 899 with bank card']])assert.equal(applyStableOcrPrice(report(),obs('one',a),obs('two',b,now+700),now+700).regularPrice,null);
});
test('wrong snapshot, reused capture, wrong app and tree/visual conflicts hold instead of overriding',()=>{
 const same=obs('one'),second=obs('two',undefined,now+700);for(const bad of [{...second,package_name:'evil.app'},{...second,ocr:{...second.ocr,snapshotId:'forged'}},same])assert.equal(applyStableOcrPrice(report(),same,bad,now+700).regularPrice,null);
 const tree={...report(),prices:[{amountCents:99900,currency:'INR',kind:'listed'}],regularPrice:{amountCents:99900,currency:'INR',kind:'listed'}};const r=applyStableOcrPrice(tree,same,second,now+700);assert.equal(r.ocrConflict,true);assert.equal(r.regularPrice,null);
});
test('a native currency anchor can bind exact numeric crop pixels when full-line OCR misreads the symbol',()=>{
 const make=(id:string,at:number)=>{const o:any=obs(id,'Buy now at 7899',at);o.ocr.lines[1]={text:'Buy now',bounds:{left:10,top:940,right:650,bottom:990}};o.ocr.currencyRegions=[{currency:'INR',amountText:'899',currencyBounds:{left:10,top:1000,right:30,bottom:1050},bounds:{left:30,top:996,right:430,bottom:1054}}];return o;};
 const r=applyStableOcrPrice(report(),make('one',now),make('two',now+700),now+700);assert.equal(r.regularPrice?.amountCents,89900);
});

test('two screenshots report stock for the selected colour card only',()=>{
 const make=(id:string,at:number,colour='Black',status='In stock')=>{
  const o=obs(id,undefined,at);
  o.nodes.push({text:'Selected Colour is '+colour+'. Tap to expand.'});
  const line=(text:string,left:number,top:number,right:number)=>({text,bounds:{left,top,right,bottom:top+34}});
  o.ocr.lines=[line('Black',36,680,134),line('Taupe',280,680,386),line('White',520,680,612),line(status,36,805,170),line('In stock',280,805,410),line('Only 1 left',520,805,665)];
  return o;
 };
 const first=make('one',now),second=make('two',now+700);
 const r=applyStableVariantStock(report(),first,second,now+700);
 assert.equal(r.stock,'available');assert.equal(r.stockOcrEvidence.colour,'Black');assert.equal(r.stockOcrEvidence.snapshots[0].snapshotId,'one');
 assert.equal(applyStableVariantStock(report(),first,make('two',now+700,'White'),now+700).stock,'unknown');
 assert.equal(applyStableVariantStock(report(),first,make('two',now+700,'Black',''),now+700).stock,'unknown');
 assert.equal(applyStableVariantStock(report(),first,make('two',now+700,'Black','Out of stock'),now+700).stock,'unknown');
 const wrapped=(id:string,at:number)=>{
  const frame=make(id,at,'Black','Available to');
  frame.ocr.lines.push({text:'ship in 1-...',bounds:{left:36,top:845,right:177,bottom:880}});
  return frame;
 };
 assert.equal(applyStableVariantStock(report(),wrapped('one',now),wrapped('two',now+700),now+700).stockOcrEvidence.claim,'Available to ship');
});
