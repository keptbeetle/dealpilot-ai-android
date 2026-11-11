import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainGeminiTools} from './provider.js';

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
