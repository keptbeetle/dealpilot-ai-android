import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {updateShoppingRequest,restoreShoppingRequest} from '../src/shopping-request.js';
import {verifyShoppingReport,compareVerifiedListings} from '../src/shopping-verification.js';
import {inspectStoreObservation} from '../src/native-store.js';
import {nativeTools} from '../src/tools.js';
import {PocketRuntime} from '../src/runtime.js';
import {emptyAutonomy} from '../src/autonomy.js';
const now=1793980000000;
const initial='I need a new Android smartphone under Rs 25,000 in India. Samsung and Motorola are preferred. At least 128 GB storage.';
const request=()=>updateShoppingRequest(undefined,initial)!;
function report(lines:string[]=[],title='Samsung Galaxy M355G 128GB Black',selected=title){return inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:'AI-fixture',captured_at_ms:now,nodes:[{resource_id:'product_title',text:title},{text:'INR 19999'},{text:'In stock'},{text:'Condition: New'},{text:'Sold by: Sample Seller'},{text:'Add to Cart'},...lines.map(text=>({text}))]},'amazon',{selectedLabel:selected,selectedFromSnapshot:'AI-search'});}
test('canonical user constraints distinguish preferences from requirements and survive ordinary refinement',()=>{
 const first=request();assert.deepEqual(first.checks,{currency:'INR',budgetCents:2500000,minimumStorageGB:128});assert.equal(first.newOnly,true);assert.deepEqual(first.preferredBrands,['Samsung','Motorola']);assert.equal(first.checks.brand,undefined);
 const second=updateShoppingRequest(first,'Actually my maximum budget is Rs 20,000. New phones only.');assert.equal(second?.checks.budgetCents,2000000);assert.equal(second?.checks.minimumStorageGB,128);assert.equal(second?.newOnly,true);assert.equal(second?.revision,first.revision+1);
 assert.equal(updateShoppingRequest(first,'Only look for Samsung phones')?.checks.brand,'Samsung');
});
test('budget shorthand and unlabelled smartphone capacity retain exact currency and integer cents',()=>{
 const value=updateShoppingRequest(undefined,'Find a smartphone under Rs 20k with at least 128GB');assert.equal(value?.checks.budgetCents,2000000);assert.equal(value?.checks.minimumStorageGB,128);
 assert.equal(updateShoppingRequest(undefined,'Find wireless headphones under $100k')?.checks.budgetCents,10000000);
});
test('ambiguous currency and budget remain held until explicitly resolved',()=>{
 const bad=updateShoppingRequest(request(),'My budget is Rs 20,000 or USD 500.');assert.ok(bad?.issues.length);
 const retained=updateShoppingRequest(bad,'Compare those options');assert.ok(retained?.issues.length);
 const fixed=updateShoppingRequest(retained,'My budget is INR 20,000');assert.deepEqual(fixed?.issues,[]);
});
test('new categories start a fresh request and corrupt saved constraints fail closed',()=>{
 const changed=updateShoppingRequest(request(),'Find headphones under USD 100');assert.equal(changed?.category,'headphones');assert.equal(changed?.checks.minimumStorageGB,undefined);assert.equal(changed?.checks.currency,'USD');
 assert.equal(restoreShoppingRequest({...request(),checks:{budgetCents:-1}}),undefined);assert.deepEqual(restoreShoppingRequest(JSON.parse(JSON.stringify(request()))),request());
});
test('native outputs invoke the actual DealPilot identity, freshness and cost modules',()=>{
 const value=verifyShoppingReport(report(),request(),now);assert.equal(value.engine,'dealpilot-pure-modules');assert.equal(value.freshness.status,'recent');assert.equal(value.identity.status,'model-compatible');assert.equal(value.cost?.reportedTotalCents,null);assert.equal(value.cost?.unknownComponents.length,3);assert.equal(value.seller,'Sample Seller');assert.equal(value.purchaseReady,false);
 assert.equal(value.checks.find(c=>c.attribute==='new condition')?.outcome,'supported');
 const unknownBrand=verifyShoppingReport(report([],'Generic phone M355G 128GB Black'),{...request(),checks:{...request().checks,brand:'Samsung'}},now);assert.equal(unknownBrand.checks.find(c=>c.attribute==='required brand')?.outcome,'unknown');
});
test('currency, over-budget prices, insufficient storage, used condition and unavailable stock veto a recommendation',()=>{
 const req=updateShoppingRequest(request(),'Budget is INR 10,000')!;assert.equal(verifyShoppingReport(report(),req,now).status,'contradicted');
 const small=verifyShoppingReport(report(['64GB storage'],'Samsung Galaxy M355G 64GB Black'),request(),now);assert.equal(small.checks.find(c=>c.attribute==='storage')?.outcome,'contradicted');
 const used=report();used.visibleText=used.visibleText.replace('Condition: New','Condition: Used');assert.equal(verifyShoppingReport(used,request(),now).status,'contradicted');
 assert.equal(verifyShoppingReport({...report(),stock:'unavailable'},request(),now).status,'contradicted');
 assert.equal(verifyShoppingReport({...report(),regularPrice:{amountCents:19999,currency:'USD',kind:'listed',evidence:'USD199.99'}},request(),now).status,'contradicted');
});
test('conflicting selected variant and page identity cannot become verified from the lower price',()=>{
 const wrong=report([],'Samsung Galaxy M355G 256GB White','Samsung Galaxy M355G 128GB Black');assert.equal(verifyShoppingReport(wrong,request(),now).identity.status,'conflict');assert.equal(verifyShoppingReport(wrong,request(),now).status,'contradicted');
});
test('conflicting explicit conditions on the same native product observation cannot count as new',()=>{
 const both=report(['Condition: Used']);
 const verified=verifyShoppingReport(both,request(),now);
 assert.equal(verified.condition,'conflict');
 assert.equal(verified.status,'contradicted');
 assert.equal(verified.checks.find(c=>c.attribute==='new condition')?.outcome,'contradicted');
 assert.equal(verified.comparison.rankable,false);
 const notNewRequired=verifyShoppingReport(both,{...request(),newOnly:false},now);
 assert.equal(notNewRequired.status,'contradicted','A contradictory source must be held even without a new-only constraint');
});
test('stale and search-card observations cannot support constraint passes',()=>{
 assert.equal(verifyShoppingReport(report(),request(),now+16*60000).freshness.status,'stale');assert.ok(verifyShoppingReport(report(),request(),now+16*60000).checks.every(c=>c.outcome==='unknown'));
 assert.ok(verifyShoppingReport({...report(),pageKind:'search-results'},request(),now).checks.every(c=>c.outcome==='unknown'));
});
test('unknown fees never become zero and reported free shipping does not establish final total',()=>{
 const value=verifyShoppingReport(report(['FREE delivery','Inclusive of all taxes']),request(),now);assert.equal(value.cost?.reportedTotalCents,null);assert.deepEqual(value.cost?.unknownComponents,['mandatory fees']);assert.equal(value.checkoutVerified,false);
});
test('real alternative headphone manufacturers are recognized without mistaking noise cancellation for a brand',()=>{
 for(const brand of ['JLab','Noise','boAt','Skullcandy','Philips']){
  const req=updateShoppingRequest(undefined,'Find only '+brand+' new over-ear headphones under INR 5000')!;
  const title=brand+' Model X100 Over-Ear Headphones';
  const checked=verifyShoppingReport(report([],title),req,now);
  assert.equal(checked.observedBrand.toLowerCase(),brand.toLowerCase());
  assert.equal(checked.checks.find(c=>c.attribute==='required brand')?.outcome,'supported',brand);
 }
 const natural=updateShoppingRequest(undefined,'I prefer headphones with noise cancellation under INR 4000')!;
 assert.deepEqual(natural.preferredBrands,[]);
 const branded=updateShoppingRequest(undefined,'I prefer Noise Airwave or JLab headphones under INR 4000')!;
 assert.ok(branded.preferredBrands.includes('Noise'));
 assert.ok(branded.preferredBrands.includes('JLab'));
 const generic=verifyShoppingReport(report([],'Noise Cancelling Bluetooth Headphones X100'),updateShoppingRequest(undefined,'Find wireless headphones under INR 4000'),now);
 assert.equal(generic.observedBrand,null,'A generic noise-cancelling feature is not a manufacturer claim');
});
test('checksum-invalid identifiers are rejected; same names without identifiers do not establish cross-store equivalence',()=>{
 const a=report(['EAN: 4006381333932']);assert.equal(verifyShoppingReport(a,request(),now).status,'contradicted');
 const left={...report(),verification:verifyShoppingReport(report(),request(),now)};assert.equal(compareVerifiedListings(left,left).basis,'unresolved');assert.equal(compareVerifiedListings({...left,verification:{}},left).basis,'unresolved');
});
test('Flipkart truncated detail safely links same-model selected-card fit, not unrelated variants',()=>{
 const title='Tune 520 BT 57Hr Playtime, Pure Bass, Multi Connect 5.3LE Bluetoo...more';
 const selected=', JBL, Tune 520 BT 57Hr Playtime, Pure Bass, Multi Connect 5.3LE Bluetooth Headset Black, On the Ear, 4.1, 30%, INR 3499';
 const fp=inspectStoreObservation({package_name:'com.flipkart.android',snapshot_id:'flipkart-detail',captured_at_ms:now,
  nodes:[{text:'Selected Color:'},{text:'Black'},{text:'JBL'},{text:'Visit store'},{resource_id:'productTitle',text:title},
    {text:'Add to cart'},{text:'Buy now'},{text:'INR 3499'},{text:'Delivery details'}]},'flipkart',{selectedLabel:selected,selectedFromSnapshot:'clicked-search-card'});
 const previous={...fp,listingTitle:title}; // Existing saved native observations had an unprefixed truncated detail title.
 const req=updateShoppingRequest(undefined,'Find new over-ear headphones under INR 4000, only JBL')!;
 const current=verifyShoppingReport(previous,req,now);
 assert.equal(current.checks.find(c=>c.attribute==='headphone fit')?.outcome,'contradicted');
 assert.match(current.checks.find(c=>c.attribute==='headphone fit')?.evidence||'',/Linked selected search card/);
 assert.equal(current.checks.find(c=>c.attribute==='new condition')?.outcome,'unknown');
 assert.equal(current.checks.find(c=>c.attribute==='required brand')?.outcome,'supported');
 assert.equal(current.observedBrand,'JBL');
 assert.equal(current.identity.status,'model-compatible');
 assert.equal(current.identity.variantUnresolved,false);
 assert.equal(current.comparison.eligible,false,'A contradictory over-ear requirement vetoes the comparison');
 const permitted=verifyShoppingReport(previous,updateShoppingRequest(undefined,'Find on-ear headphones under INR 4000, only JBL'),now);
 assert.equal(permitted.comparison.eligible,true,'The same-model and selected-colour claims are linked');
 assert.equal(permitted.comparison.rankable,false,'Stock remains unknown, even when the style and price qualify');
 assert.equal(current.comparison.rankable,false);
 assert.equal(current.purchaseReady,false);
 const wrongModel=verifyShoppingReport({...previous,selectedFrom:{...previous.selectedFrom,label:selected.replace('Tune 520 BT','Tune 530 BT')}},req,now);
 assert.equal(wrongModel.checks.find(c=>c.attribute==='headphone fit')?.outcome,'unknown');
 assert.equal(wrongModel.comparison.eligible,false,'Battery hour overlap cannot substitute for a matching selected product');
 const differentColour=verifyShoppingReport({...previous,selectedFrom:{...previous.selectedFrom,label:selected.replace('Headset Black','Headset Blue')}},req,now);
 assert.equal(differentColour.checks.find(c=>c.attribute==='headphone fit')?.outcome,'unknown');
 assert.equal(differentColour.status,'contradicted');
 assert.equal(differentColour.comparison.eligible,false);
 const missingSelection=verifyShoppingReport({...previous,selectedFrom:{...previous.selectedFrom,snapshot_id:undefined}},req,now);
 assert.equal(missingSelection.checks.find(c=>c.attribute==='headphone fit')?.outcome,'unknown');
 const otherBrand=verifyShoppingReport({...previous,visibleText:previous.visibleText.replace('JBL'+String.fromCharCode(10)+'Visit store','Sony'+String.fromCharCode(10)+'Visit store')},req,now);
 assert.equal(otherBrand.checks.find(c=>c.attribute==='required brand')?.outcome,'contradicted');
 const contradictoryTitle=verifyShoppingReport({...previous,listingTitle:'Tune 520 BT 57Hr Playtime Over Ear Bluetooth Headset Black'},req,now);
 assert.equal(contradictoryTitle.checks.find(c=>c.attribute==='headphone fit')?.outcome,'supported');
});
test('vendored verification runtime is pinned to the recorded adapted-file hashes',()=>{
 const root=new URL('../vendor/dealpilot/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('SOURCE_MANIFEST.json',root),'utf8'));
 assert.equal(manifest.modules.length,4);for(const item of manifest.modules)assert.equal(createHash('sha256').update(readFileSync(new URL(item.destination,root))).digest('hex'),item.adaptedSha256);
});
test('canonical checks override omitted or relaxed model arguments at actual composite dispatch',async()=>{
 const next=updateShoppingRequest(request(),'My budget is INR 20,000')!;const calls:any[]=[];
 const host={shoppingRequest:()=>next,authorizePhone(){},dropPriorImages(){},call(method:string,input:any){calls.push({method,...input});if(input.name==='phone_capabilities')return {operation_prefix:'owned'};if(input.name==='phone_apps')return {apps:[{package_name:'in.amazon.mShop.android.shopping'}]};if(input.name==='phone_observe')return {package_name:'in.amazon.mShop.android.shopping',snapshot_id:'current',captured_at_ms:Date.now(),coordinate_width:720,coordinate_height:1280,nodes:[{resource_id:'product_title',text:'Samsung Galaxy M355G 128GB Black'},{text:'128GB ROM'},{text:'INR 19999'},{text:'In stock'},{text:'Add to Cart'}]};return {};}};
 const tool=nativeTools(host,'shop').find(t=>t.name==='phone_store_app')!;
 const result=await tool.execute('request',{store:'amazon',checks:{currency:'USD',budgetCents:99999999}});assert.equal(result.isError,false);const value=JSON.parse(result.content[0].text);assert.equal(value.verification.appliedChecks.currency,'INR');assert.equal(value.verification.appliedChecks.budgetCents,2000000);assert.equal(value.verification.appliedChecks.minimumStorageGB,128);assert.equal(value.verification.checks.find((c:any)=>c.attribute==='storage').outcome,'supported');
 const scrolled=await tool.execute('scroll',{store:'amazon',display_target:'physical',action:{kind:'scroll',direction:'down'}});assert.equal(JSON.parse(scrolled.content[0].text).identityObservation.snapshot_id,'current');
});
test('host-owned canonical request survives checkpoint restore and is copied into worker scopes',()=>{
 const thread='00000000-0000-4000-8000-000000000001';const saved={mainThreadId:thread,shoppingRequests:{['thread:'+thread]:request()}};
 const runtime=new PocketRuntime({call(method:string){return JSON.stringify({ok:true,result:method==='credentials.get'?{authMode:'scripted'}:method==='autonomy.load'?emptyAutonomy():method==='store.load'?saved:{}});},emit(){}});
 const definition=runtime.registry.agents.get('shopping-researcher');(runtime as any).createSession('worker',{definition,requestedConfig:{}});
 const canonical=runtime.shoppingRequest('worker')!;assert.equal(canonical.checks.minimumStorageGB,128);canonical.checks.minimumStorageGB=1;assert.equal(runtime.shoppingRequest('worker')?.checks.minimumStorageGB,128);assert.equal(runtime.save(),true);
});
