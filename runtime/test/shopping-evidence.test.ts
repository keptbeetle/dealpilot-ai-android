import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectBrowserObservation} from '../src/browser.js';
import {browserReports,groundedShoppingResearch,existingShoppingComparisonRequested} from '../src/shopping-evidence.js';
import {inspectStoreObservation} from '../src/native-store.js';
const now=1793948000000;
const observation=(url:string,text:string[])=>inspectBrowserObservation({package_name:'com.android.chrome',snapshot_id:'fixture',captured_at_ms:now,nodes:[{resource_id:'com.android.chrome:id/url_bar',text:url},...text.map(text=>({text}))]});

test('read-only comparisons of previous shopping evidence are grounded without triggering a new search',()=>{
 assert.equal(existingShoppingComparisonRequested('Now lower the maximum budget to INR 4000. Compare only the two existing verified product observations from this chat.'),true);
 assert.equal(existingShoppingComparisonRequested('Which of those two listings is cheapest under INR 4000?'),true);
 assert.equal(existingShoppingComparisonRequested('Compare two NEW headphones under INR 5000 by visiting Amazon'),false);
 assert.equal(existingShoppingComparisonRequested('Compare the earlier listings, but do a fresh search now'),false);
 assert.equal(existingShoppingComparisonRequested('Compare only the two existing observed JLab and Noise listings from this chat under INR 4000. Do not search again or interact with a retailer, cart or checkout.'),true,'Negated new-search language must not bypass source-grounded comparisons');
 assert.equal(existingShoppingComparisonRequested('Compare these observed offers; no new search needed.'),true);
 assert.equal(existingShoppingComparisonRequested('Compare existing listings without fresh research.'),true);
 assert.equal(existingShoppingComparisonRequested('Compare these offers; do not do a fresh search now.'),true);
 assert.equal(existingShoppingComparisonRequested('Compare the previous offers, but please run a fresh search now.'),false);
 assert.equal(existingShoppingComparisonRequested('Compare the previous offers and search again now.'),false);
 assert.equal(existingShoppingComparisonRequested('What is two plus two?'),false);
});
test('scrolling to specifications does not erase earlier price evidence or silently merge eligibility',()=>{
 const frame=(id:string,lines:string[])=>inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:id,captured_at_ms:now,nodes:[{resource_id:'product_title',text:'Sony wireless headphones X100'},{text:'About this item'},...lines.map(text=>({text}))]},'amazon');
 const answer=groundedShoppingResearch([frame('price',['INR 2999','INR 3999 MRP']),frame('details',['Condition: New','Bluetooth'])],now);
 assert.match(answer,/₹2999.00/);assert.match(answer,/Earlier source frame/);assert.match(answer,/not merged.*eligibility/);assert.match(answer,/Price was not established/);
});
test('search results cannot become verified products or invented typical prices',()=>{
 const report=observation('www.google.com/search?q=Sony+JBL',['Sony headphones','₹3490','In stock']);
 const answer=groundedShoppingResearch([report],now);
 assert.match(answer,/Research is incomplete/);assert.match(answer,/google.com/);assert.ok(!answer.includes('3490'));
});
test('listing output uses source amounts, preserves conditional pricing and unknown currency, and does not imply checkout verification',()=>{
 const report=observation('shop.example/products/headphones',['Headphones','INR 4999','INR 3999 with bank credit card','In stock']);
 const answer=groundedShoppingResearch([report],now);assert.match(answer,/₹4999.00/);assert.match(answer,/Conditional amount.*₹3999.00/);assert.match(answer,/not a verified purchase/);
 const dollar=groundedShoppingResearch([observation('shop.example/products/sensor',['$250.00','In stock'])],now);assert.match(dollar,/currency unspecified/);assert.ok(!dollar.includes('US$'));
});
test('expired source observations and unrelated tool text cannot supply fresh price evidence',()=>{
 const report=observation('shop.example/products/headphones',['INR 4999','In stock']);
 assert.match(groundedShoppingResearch([report],now+16*60000),/No individual product/);
 assert.deepEqual(browserReports([{role:'user',toolName:'phone_browser',content:[{type:'text',text:JSON.stringify(report)}]}]),[]);
 assert.equal(browserReports([{role:'toolResult',toolName:'phone_browser',content:[{type:'text',text:JSON.stringify(report)}]}]).length,1);
});
test('repeated native discovery observations render one handoff per retailer, without invented products',()=>{
 const frame=(store:'amazon'|'flipkart',id:string)=>inspectStoreObservation({package_name:store==='amazon'?'in.amazon.mShop.android.shopping':'com.flipkart.android',snapshot_id:id,captured_at_ms:now,nodes:[{text:'Search headphones'},{text:'Headphones results'}]},store);
 const answer=groundedShoppingResearch([frame('amazon','a'),...Array.from({length:9},(_,i)=>frame('flipkart','f'+i))],now);
 assert.match(answer,/Research is incomplete/);
 assert.equal((answer.match(/pocket-store:\/\/flipkart/g)||[]).length,1);
 assert.equal((answer.match(/pocket-store:\/\/amazon/g)||[]).length,1);
 assert.doesNotMatch(answer,/Page-listed amount|Lowest listed price/);
});
test('many later discovery frames cannot evict an earlier fresh product observation',()=>{
 const product=inspectStoreObservation({package_name:'in.amazon.mShop.android.shopping',snapshot_id:'product-source',captured_at_ms:now,nodes:[{resource_id:'product_title',text:'Sony WH-CH520 headphones'},{text:'Buy now'},{text:'INR 2999'},{text:'In stock'}]},'amazon');
 const discovery=Array.from({length:9},(_,i)=>inspectStoreObservation({package_name:'com.flipkart.android',snapshot_id:'discovery-'+i,captured_at_ms:now+i,nodes:[{text:'Search headphones'},{text:'Results'}]},'flipkart'));
 const answer=groundedShoppingResearch([product,...discovery],now+30);
 assert.match(answer,/Source-observed listing evidence/);
 assert.match(answer,/Sony WH-CH520/);
 assert.match(answer,/2999\.00/);
});
test('an access challenge retains its observed handoff link while withholding prices',()=>{
 const report=observation('shop.example/products/headphones',['CAPTCHA verify you are human','INR 4999']);
 const answer=groundedShoppingResearch([report],now);assert.match(answer,/access requires user attention/);assert.match(answer,/shop.example/);assert.ok(!answer.includes('4999'));
});
