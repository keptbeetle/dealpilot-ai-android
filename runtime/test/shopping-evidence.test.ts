import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectBrowserObservation} from '../src/browser.js';
import {browserReports,groundedShoppingResearch} from '../src/shopping-evidence.js';
const now=1793948000000;
const observation=(url:string,text:string[])=>inspectBrowserObservation({package_name:'com.android.chrome',snapshot_id:'fixture',captured_at_ms:now,nodes:[{resource_id:'com.android.chrome:id/url_bar',text:url},...text.map(text=>({text}))]});
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
test('an access challenge retains its observed handoff link while withholding prices',()=>{
 const report=observation('shop.example/products/headphones',['CAPTCHA verify you are human','INR 4999']);
 const answer=groundedShoppingResearch([report],now);assert.match(answer,/access requires user attention/);assert.match(answer,/shop.example/);assert.ok(!answer.includes('4999'));
});
