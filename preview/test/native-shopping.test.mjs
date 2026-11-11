import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from '../../runtime/node_modules/linkedom/esm/index.js';
import {findPreparedCart,renderPreparedCart} from '../native-shopping.js';

const listing={title:'Observed Demo Headphones',url:'https://example.com/products/observed-headphones',currency:'USD',unitCents:7900,quantity:1};
const marker='POCKET_CHECKOUT '+JSON.stringify(listing);
const parse=text=>text.endsWith(marker)?{text:text.slice(0,-marker.length).trim(),listing}:null;
test('observed cart is visible but cannot enter checkout until a separate buyer payment instruction',()=>{
 const messages=[{role:'user',text:'I choose that observed product. Prepare the cart.'},{role:'assistant',text:'A simulated cart is prepared.\n'+marker}];
 const selected=findPreparedCart(messages,parse);
 assert.ok(selected);
 assert.equal(selected.readyToPay,false);
 const {window}=parseHTML('<body></body>');
 globalThis.document=window.document;
 const box=renderPreparedCart(selected,()=>assert.fail('Should not start payment without buyer instruction.'));
 assert.match(box.textContent,/\$79\.00/);
 assert.match(box.textContent,/simulated/i);
 assert.equal(box.querySelector('button'),null);
});
test('proceed-to-pay instruction enables a separate explicit checkout button, not automatic payment',async()=>{
 let opened=null;
 const selected=findPreparedCart([
  {role:'assistant',text:'Prepared quote.\n'+marker},
  {role:'user',text:'Proceed to pay with PayPal sandbox.'}
 ],parse);
 assert.equal(selected?.readyToPay,true);
 const {window}=parseHTML('<body></body>');globalThis.document=window.document;
 const box=renderPreparedCart(selected,async chosen=>{opened=chosen;});
 assert.equal(opened,null);
 box.querySelector('button').click();
 await Promise.resolve();
 assert.deepEqual(opened,listing);
});
test('a newer product request cancels a stale prepared quote',()=>{
 const state=findPreparedCart([
  {role:'assistant',text:'Prepared.\n'+marker},
  {role:'user',text:'Find another laptop instead.'},
  {role:'assistant',text:'Researching.'}
 ],parse);
 assert.equal(state,null);
});
