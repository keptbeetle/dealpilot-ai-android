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
test('stale and search-card observations cannot support constraint passes',()=>{
 assert.equal(verifyShoppingReport(report(),request(),now+16*60000).freshness.status,'stale');assert.ok(verifyShoppingReport(report(),request(),now+16*60000).checks.every(c=>c.outcome==='unknown'));
 assert.ok(verifyShoppingReport({...report(),pageKind:'search-results'},request(),now).checks.every(c=>c.outcome==='unknown'));
});
test('unknown fees never become zero and reported free shipping does not establish final total',()=>{
 const value=verifyShoppingReport(report(['FREE delivery','Inclusive of all taxes']),request(),now);assert.equal(value.cost?.reportedTotalCents,null);assert.deepEqual(value.cost?.unknownComponents,['mandatory fees']);assert.equal(value.checkoutVerified,false);
});
test('checksum-invalid identifiers are rejected; same names without identifiers do not establish cross-store equivalence',()=>{
 const a=report(['EAN: 4006381333932']);assert.equal(verifyShoppingReport(a,request(),now).status,'contradicted');
 const left={...report(),verification:verifyShoppingReport(report(),request(),now)};assert.equal(compareVerifiedListings(left,left).basis,'unresolved');assert.equal(compareVerifiedListings({...left,verification:{}},left).basis,'unresolved');
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
