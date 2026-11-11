import test from 'node:test';
import assert from 'node:assert/strict';
import {updateShoppingRequest,restoreShoppingRequest} from '../src/shopping-request.js';
import {inspectStoreObservation} from '../src/native-store.js';
import {verifyShoppingReport} from '../src/shopping-verification.js';
const now=1793982000000;
test('two-model comparison retains explicit both NEW and condition-only requirements',()=>{
 const exact='Please compare Sony WH-CH520 and Soundcore Q20i wireless headphones, both NEW, under INR 5000, by opening their individual listings in the native Amazon Android app.';
 const r=updateShoppingRequest(undefined,exact);
 assert.equal(r?.newOnly,true,'Both NEW is a hard selected-item requirement');
 assert.equal(r?.checks.budgetCents,500000);
 assert.equal(r?.category,'headphones');
 assert.equal(updateShoppingRequest(undefined,'Find Sony headphones, brand-new condition only')?.newOnly,true);
 assert.equal(updateShoppingRequest(undefined,'Find headphones under INR 5000, both must be brand new')?.newOnly,true);
 assert.equal(updateShoppingRequest(undefined,'Find laptops under INR 80000, no refurbished units')?.newOnly,true);
 assert.equal(updateShoppingRequest(undefined,'I want NEW wireless over-ear headphones under INR 4000')?.newOnly,true);
 assert.equal(updateShoppingRequest(undefined,'Find new noise-cancelling Bluetooth headphones under INR 5000')?.newOnly,true);
 assert.equal(updateShoppingRequest(undefined,'Find headphones with new features under INR 5000')?.newOnly,false);
 const relaxed=updateShoppingRequest(r,'Used or refurbished is okay for this comparison');
 assert.equal(relaxed?.newOnly,false,'Explicit later user permission can relax the condition');
});
test('over-ear shopping requirements reject source-observed on-ear products and persist across budget changes',()=>{
 let request=updateShoppingRequest(undefined,'I want NEW wireless over-ear headphones under INR 4000, Sony preferred');
 assert.deepEqual(request?.headphoneFits,['over-ear']);
 assert.equal(request?.newOnly,true);
 const exactFollowup='Compare only the two existing native store observations in this chat under INR 4000. Both must be NEW wireless over-ear headphones. Check the observed listing titles for over-ear versus on-ear and clearly mark unknown condition, stock, seller, shipping and final total.';
 const strictFollowup=updateShoppingRequest(request,exactFollowup);
 assert.deepEqual(strictFollowup?.headphoneFits,['over-ear'],'Comparing on-ear against required over-ear must not relax the requirement');
 const withoutOnEar=updateShoppingRequest(request,'Only over-ear headphones, not on-ear');
 assert.deepEqual(withoutOnEar?.headphoneFits,['over-ear']);
 const priceReport=(title:string)=>inspectStoreObservation({
   package_name:'in.amazon.mShop.android.shopping',snapshot_id:title,captured_at_ms:now,
   nodes:[{resource_id:'productTitle',text:title},{text:'Buy now'},{text:'INR 3590'},{text:'In stock'}],
 },'amazon',{selectedLabel:title,selectedFromSnapshot:'results'});
 const onEar=verifyShoppingReport(priceReport('Sony WH-CH520 Wireless Bluetooth Headphones On Ear Black'),request,now);
 assert.equal(onEar.checks.find(c=>c.attribute==='headphone fit')?.outcome,'contradicted');
 assert.equal(onEar.comparison.matchesRequirements,false);
 assert.equal(onEar.comparison.rankable,false);
 const overEar=verifyShoppingReport(priceReport('Soundcore Q20i Bluetooth Headphones Over-Ear Black'),request,now);
 assert.equal(overEar.checks.find(c=>c.attribute==='headphone fit')?.outcome,'supported');
 const unspecified=verifyShoppingReport(priceReport('Sony Headphones X100 Black'),request,now);
 assert.equal(unspecified.checks.find(c=>c.attribute==='headphone fit')?.outcome,'unknown');
 request=updateShoppingRequest(request,'Lower the budget to INR 3500 and compare existing offers');
 assert.deepEqual(request?.headphoneFits,['over-ear']);
 assert.deepEqual(restoreShoppingRequest(request)?.headphoneFits,['over-ear']);
 assert.equal(restoreShoppingRequest({...request,headphoneFits:['over-ear','not-valid']}),undefined);
 const either=updateShoppingRequest(request,'Over-ear or on-ear are both fine now');
 assert.deepEqual(either?.headphoneFits,['over-ear','on-ear']);
 assert.equal(verifyShoppingReport(priceReport('Sony WH-CH520 Wireless Bluetooth Headphones On Ear Black'),either,now).checks.find(c=>c.attribute==='headphone fit')?.outcome,'supported');
 const unrestricted=updateShoppingRequest(either,'Any headphone style is fine');
 assert.equal(unrestricted?.headphoneFits,undefined);
});
test('ordinary headphones request and budget refinement preserve explicit new condition',()=>{
 let r=updateShoppingRequest(undefined,'Find new wireless headphones under Rs 5000. Sony and JBL preferred.');
 r=updateShoppingRequest(r,'Make my budget Rs 3000, new headphones only.');
 assert.equal(r?.checks.budgetCents,300000);assert.equal(r?.newOnly,true);assert.deepEqual(r?.preferredBrands,['Sony','JBL']);
});
test('plain phone switches category without inheriting laptop capacities',()=>{
 let r=updateShoppingRequest(undefined,'Find a laptop under INR 80000 with 16GB RAM and 1TB SSD');
 r=updateShoppingRequest(r,'Instead find a phone under INR 20000 with 128GB storage');
 assert.equal(r?.category,'smartphone');assert.equal(r?.checks.minimumRamGB,undefined);assert.equal(r?.checks.minimumStorageGB,128);
});
test('explicitly resolving conflicting storage clears only that conflict',()=>{
 let r=updateShoppingRequest(undefined,'Find a laptop under INR 80000 with 256GB storage or 512GB storage');
 assert.ok(r?.issues.some(i=>i.includes('minimumStorageGB')));
 r=updateShoppingRequest(r,'I mean at least 512GB storage');
 assert.equal(r?.checks.minimumStorageGB,512);assert.ok(!r?.issues.some(i=>i.includes('minimumStorageGB')));
});
test('decimal TB requirement is not silently parsed as its fractional digits',()=>{
 const r=updateShoppingRequest(undefined,'Find a laptop under INR 80000 with 1.5TB storage');assert.equal(r?.checks.minimumStorageGB,1536);
});
test('changing a hard brand to a preference genuinely relaxes the restriction',()=>{
 let r=updateShoppingRequest(undefined,'Find headphones under INR 5000, only Sony');assert.equal(r?.checks.brand,'Sony');
 r=updateShoppingRequest(r,'Sony is just preferred, other brands are okay');assert.equal(r?.checks.brand,undefined);assert.deepEqual(r?.preferredBrands,['Sony']);
});
test('only Sony or JBL is a union, not an accidental Sony-only restriction',()=>{
 const r=updateShoppingRequest(undefined,'Find headphones under INR 5000, only Sony or JBL');
 const observe=(brand:string)=>inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:'test',captured_at_ms:now,nodes:[{resource_id:'product_title',text:brand+' wireless headphones model X100'},{text:'Add to Cart'},{text:'INR 2999'}]},'amazon');
 const a=verifyShoppingReport(observe('JBL'),r,now),b=verifyShoppingReport(observe('Bose'),r,now);
 assert.ok(a.checks.some(c=>c.attribute==='allowed brands'&&c.outcome==='supported'));
 assert.ok(b.checks.some(c=>c.attribute==='allowed brands'&&c.outcome==='contradicted'));
});
test('future-dated and truncated observations cannot become purchase-ready',()=>{
 const r=updateShoppingRequest(undefined,'Find headphones under INR 5000');
 const source=inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:'test',captured_at_ms:now+3600000,nodes_truncated:true,nodes:[{resource_id:'product_title',text:'Sony wireless headphones X100'},{text:'Add to Cart'},{text:'INR 2999'}]},'amazon');
 const v=verifyShoppingReport(source,r,now);assert.equal(v.purchaseReady,false);assert.ok(v.checks.every(c=>c.outcome==='unknown'));
});

test('animated Flipkart digit wheels cannot become a false nine-rupee product price',()=>{
 const nodes=[{resource_id:'productTitle',text:'TRIGGR Punkheadz Z4 headphones'},{text:'Add to cart'},{text:'Buy now, at, ₹, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9'},{text:'₹'},{text:'9'}];
 const r=inspectStoreObservation({package_name:'com.flipkart.android',snapshot_id:'wheel',captured_at_ms:now,nodes},'flipkart');assert.equal(r.regularPrice,null);assert.equal(r.prices.length,0);
 const stable=inspectStoreObservation({package_name:'com.flipkart.android',snapshot_id:'stable',captured_at_ms:now,nodes:[...nodes,{text:'INR 899'}]},'flipkart');assert.equal(stable.regularPrice?.amountCents,89900);
});
