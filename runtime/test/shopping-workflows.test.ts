import test from 'node:test';
import assert from 'node:assert/strict';
import {updateShoppingRequest} from '../src/shopping-request.js';
import {inspectStoreObservation} from '../src/native-store.js';
import {verifyShoppingReport} from '../src/shopping-verification.js';
const now=1793982000000;
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
