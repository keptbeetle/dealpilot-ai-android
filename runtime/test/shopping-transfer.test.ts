import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStoreObservation} from '../src/native-store.js';
import {OfferEvidenceLedger} from '../src/offer-evidence.js';
import {updateShoppingRequest} from '../src/shopping-request.js';
import {compareShoppingCandidates} from '../src/shopping-comparison.js';
import {buildOfferReview} from '../src/offer-review.js';

// AI-authored controlled native observations: transfer contracts, not retailer evidence.
const now=1794030000000;
const cases=[
 {name:'headphones',prompt:'Find new headphones under INR 5000. Sony and JBL are preferred.',titles:['Sony WH-X100 headphones','JBL Tune X200 headphones'],prices:[2999,2499],specs:[],refine:'Only Sony now, under INR 2800'},
 {name:'phones',prompt:'Find new phones under INR 25000 with at least 128GB storage',titles:['Samsung Phone X100','Motorola Phone X200'],prices:[19999,17999],specs:['Storage: 128GB'],refine:'Reduce my budget to INR 15000'},
 {name:'laptops',prompt:'Find new ASUS laptops under INR 80000 with at least 16GB RAM and 512GB storage',titles:['ASUS Laptop X100','ASUS Laptop X200'],prices:[69999,74999],specs:['RAM: 16GB','Storage: 512GB'],refine:'Only under INR 65000 now'},
];
for(const c of cases)test(c.name+': discover, combine scroll evidence, restore, compare, select, refine and expire',()=>{
 const request=updateShoppingRequest(undefined,c.prompt)!;
 const ledger=new OfferEvidenceLedger();
 function frame(title:string,id:string,lines:string[]){return {...inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:id,captured_at_ms:now,nodes:[{resource_id:'productTitle',text:title},{text:'About this item'},...lines.map(text=>({text}))]},'amazon',{selectedLabel:title,selectedFromSnapshot:'search-'+title}),continuity:{chainId:'selection-'+c.titles.indexOf(title)}};}
 const rows=c.titles.map((title,i)=>{
  ledger.record(frame(title,'price-'+i,['INR '+c.prices[i],...c.specs]),now);
  return ledger.record(frame(title,'details-'+i,['Condition: New','In stock','Sold by: Source Seller']),now);
 });
 const restored=new OfferEvidenceLedger(JSON.parse(JSON.stringify(ledger.snapshot())));
 const sourceRows=rows.map(r=>restored.read(r.offer_id,now));
 const comparison=compareShoppingCandidates(sourceRows,request,now);
 assert.equal(comparison.status,'comparable-listed-prices');
 assert.equal(comparison.lowestListedPriceCents,Math.min(...c.prices)*100);
 const review=buildOfferReview(sourceRows[0],request,2,now);
 assert.equal(review.status,'item-only-simulation');
 assert.equal(review.cart?.itemSubtotalCents,c.prices[0]*200);
 assert.equal(review.cart?.reportedTotalCents,null);
 assert.equal(review.sandboxReview.eligible,false);
 assert.equal(review.purchaseReady,false);
 const refined=updateShoppingRequest(request,c.refine)!;
 assert.equal(compareShoppingCandidates(sourceRows,refined,now).status,'insufficient');
 assert.equal(buildOfferReview(sourceRows[0],refined,1,now).cart,null);
 assert.equal(restored.read(rows[0].offer_id,now+16*60000),null);
});
