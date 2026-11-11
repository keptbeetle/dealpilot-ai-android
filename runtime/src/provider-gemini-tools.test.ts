import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainGeminiTools,firstShoppingResearchTurn,ensureGeminiToolTranscript} from './provider.js';

test('Gemini sees only source-observing phone tools, never checkout/payment capabilities',()=>{
 const messages=[
  {role:'system',content:'System',toolsAdded:[
    {name:'subagent',description:'spawn worker'},
    {name:'phone_browser',description:'Browse observed retailer pages'},
    {name:'phone_store_app',description:'Inspect observed native retailer listings'},
    {name:'phone_capabilities',description:'Read phone capabilities'},
    {name:'phone_observe',description:'View phone screen'},
    {name:'phone_shell',description:'Shell'},
    {name:'paypal_capture',description:'Payment'}
  ]},
  {role:'user',content:[{type:'text',text:'Find Sony headphones'}]}
 ];
 const input={messages};
 const filtered=constrainGeminiTools(input);
 assert.deepEqual(filtered.messages[0].toolsAdded.map((item:any)=>item.name),
  ['phone_browser','phone_store_app','phone_capabilities','phone_observe']);
 assert.equal(input.messages[0].toolsAdded.length,7);
 assert.equal(filtered.messages[1],input.messages[1]);
});
test('explicit shopping research must first use the genuine phone browser tool, not generated guesses',()=>{
 const messages=[
  {role:'system',toolsAdded:[
   {name:'phone_browser'}, {name:'phone_store_app'}, {name:'phone_observe'},
   {name:'phone_capabilities'}, {name:'paypal_capture'}]},
  {role:'user',content:[{type:'text',text:'Find Sony WH-CH520 headphones at Best Buy and browse the product page on my phone.'}]}
 ];
 assert.equal(firstShoppingResearchTurn({messages}),true);
 const filtered=constrainGeminiTools({messages},true);
 assert.deepEqual(filtered.messages[0].toolsAdded.map((t:any)=>t.name),['phone_browser']);
 assert.deepEqual(filtered.messages[0].toolsAdded[0].parameters.required,['url']);
 assert.equal(JSON.stringify(filtered.messages[0].toolsAdded[0].parameters).includes('additionalProperties'),false);
 assert.equal(firstShoppingResearchTurn({messages:[...messages,{role:'toolResult',content:[]}]}),false);
 const amazon=[messages[0],{role:'user',content:[{type:'text',text:'Find headphones in Amazon app'}]}];
 assert.deepEqual(constrainGeminiTools({messages:amazon},true).messages[0].toolsAdded.map((t:any)=>t.name),['phone_store_app']);
});
test('main agent research carries registered tools into a transcript lacking tool declarations',()=>{
 const context={messages:[{role:'user',content:[{type:'text',text:'Find JBL headphones on Walmart using phone browser'}]}]};
 const tools=[{name:'phone_browser',parameters:{type:'object',properties:{url:{type:'string'}}}},{name:'phone_shell',parameters:{type:'object',properties:{command:{type:'string'}}}}];
 const recovered=ensureGeminiToolTranscript(context,tools);
 assert.equal(recovered.messages[0].role,'system');
 assert.deepEqual(recovered.messages[0].toolsAdded.map((tool:any)=>tool.name),['phone_browser']);
 const constrained=constrainGeminiTools(recovered,firstShoppingResearchTurn(context));
 assert.deepEqual(constrained.messages[0].toolsAdded.map((tool:any)=>tool.name),['phone_browser']);
 assert.deepEqual(constrained.messages[0].toolsAdded[0].parameters.required,['url']);
 assert.equal(constrained.messages[1],context.messages[0]);
});
