import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStoreObservation} from '../src/native-store.js';
import {updateShoppingRequest} from '../src/shopping-request.js';
import {compareShoppingCandidates} from '../src/shopping-comparison.js';
import {groundedShoppingResearch} from '../src/shopping-evidence.js';
const now=1794030000000;
const req=()=>updateShoppingRequest(undefined,'Find new headphones under INR 5000. Sony and JBL are preferred.')!;
function product(title:string,price=2999,extra:string[]=[]){return inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:title,captured_at_ms:now,nodes:[{resource_id:'productTitle',text:title},{text:'Add to cart'},{text:'INR '+price},{text:'Condition: New'},{text:'In stock'},...extra.map(text=>({text}))]},'amazon',{selectedLabel:title,selectedFromSnapshot:'results'});}
test('two independently observed new in-stock over-ear models can be compared without checkout approval',()=>{
 const request=updateShoppingRequest(undefined,'Find NEW over-ear headphones under INR 4000')!;
 const comparison=compareShoppingCandidates([
  product('JBL Tune X200 Over-Ear headphones',2999),
  product('Soundcore Q20i Over-Ear headphones',3799)
 ],request,now);
 assert.equal(comparison.status,'comparable-listed-prices');
 assert.equal(comparison.rows.filter(r=>r.rankable).length,2);
 assert.equal(comparison.lowestListedPriceCents,299900);
 assert.equal(comparison.purchaseReady,false);
 assert.equal(comparison.checkoutVerified,false);
});
test('different models can compare matching source facts despite unknown seller and delivered costs',()=>{
 const r=compareShoppingCandidates([product('Sony WH-X100 headphones'),product('JBL Tune X200 headphones',2499)],req(),now);
 assert.equal(r.status,'comparable-listed-prices');assert.equal(r.rows.filter(r=>r.matchesRequirements).length,2);assert.equal(r.lowestListedPriceCents,249900);assert.ok(r.rows.every(r=>r.deliveredTotalCents===null));assert.equal(r.checkoutVerified,false);
});
test('unknown mandatory requirement stays visible but cannot become a matching ranked candidate',()=>{
 const request=updateShoppingRequest(undefined,'Find a new phone under INR 25000 with 128GB storage')!;
 const r=compareShoppingCandidates([product('Sony Phone X100'),product('JBL Phone X200')],request,now);
 assert.equal(r.lowestListedPriceCents,null);assert.ok(r.rows.every(r=>!r.matchesRequirements));
});
test('currency conflicts and unavailable stock cannot become matching price comparisons',()=>{
 const unavailable={...product('JBL X200 headphones'),stock:'unavailable'};
 const usd=product('Sony X100 headphones');usd.regularPrice={...usd.regularPrice!,currency:'USD'};
 assert.equal(compareShoppingCandidates([usd,unavailable],req(),now).lowestListedPriceCents,null);
});
test('stale discovery screens and variant conflicts cannot enter eligible comparison rows',()=>{
 const one=product('Sony X100 headphones');
 const wrong={...product('JBL X200 256GB White'),selectedFrom:{label:'JBL X200 128GB Black',snapshot_id:'select'}};
 const r=compareShoppingCandidates([{...one,pageKind:'search-results'},wrong,{...one,observedAt:now-16*60000}],req(),now);assert.ok(r.rows.every(r=>!r.matchesRequirements));assert.equal(r.status,'insufficient');
});
test('chat shows an attributed comparison table and distinguishes lowest listed price from final cost',()=>{
 const s=groundedShoppingResearch([product('Sony X100 headphones'),product('JBL X200 headphones',2499)],now,req());
 assert.match(s,/\| Product \|/);assert.match(s,/Lowest listed price among matching observed offers/);assert.match(s,/Delivery costs remain unknown/);assert.match(s,/JBL X200/);assert.ok(!s.includes('cheapest delivered'));
});
test('source-observed over-budget price remains visible as excluded, never rankable',()=>{
 const sony=product('Sony WH-CH520 headphones',3590),soundcore=product('Soundcore Q20i headphones',5999);
 const comparison=compareShoppingCandidates([sony,soundcore],req(),now);
 assert.equal(comparison.rows[1].priceCents,null);
 assert.equal(comparison.rows[1].observedPriceCents,599900);
 assert.equal(comparison.rows[1].rankable,false);
 assert.equal(comparison.status,'insufficient');
 const text=groundedShoppingResearch([sony,soundcore],now,req());
 assert.match(text,/Soundcore Q20i headphones \| Amazon Android app \| INR 5999\.00 \(over budget\)/);
 assert.doesNotMatch(text,/Lowest listed price among matching observed offers/);
});
test('comparison table explains specifically why observed listings do not meet requirements',()=>{
 const request=updateShoppingRequest(undefined,'Find NEW over-ear headphones under INR 4000')!;
 const sony={...product('Sony WH-CH520 On Ear Headphones',3590),
  visibleText:product('Sony WH-CH520 On Ear Headphones',3590).visibleText.replace('Condition: New','')};
 const soundcore=product('Soundcore Q20i Over-Ear Headphones',4998);
 const text=groundedShoppingResearch([sony,soundcore],now,request);
 assert.match(text,/new condition: unknown/);
 assert.match(text,/headphone fit: contradicted/);
 assert.match(text,/regular-price budget: contradicted/);
 assert.match(text,/INR 4998\.00 \(over budget\)/);
 assert.doesNotMatch(text,/Lowest listed price among matching observed offers/);
});
test('an unbound or stale source cannot lend an observed price to the comparison',()=>{
 const sony=product('Sony WH-CH520 headphones',3590);
 const other={...product('Soundcore Q20i headphones',5999),sourceBound:false};
 const stale={...product('Soundcore Q20i headphones',5999),observedAt:now-16*60000};
 assert.equal(compareShoppingCandidates([sony,other],req(),now).rows.length,1);
 assert.equal(compareShoppingCandidates([sony,stale],req(),now).rows[1].observedPriceCents,null);
});
test('partial page observations may compare explicit known facts while missing required specs still hold',()=>{
 const a={...product('Sony X100 headphones'),truncated:true},b={...product('JBL X200 headphones'),truncated:true};
 assert.equal(compareShoppingCandidates([a,b],req(),now).status,'comparable-listed-prices');
 assert.equal(compareShoppingCandidates([a,b],{...req(),checks:{...req().checks,minimumRamGB:16}},now).status,'insufficient');
});
