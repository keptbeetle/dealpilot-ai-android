import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from '../../runtime/node_modules/linkedom/esm/index.js';
import {mountDemoShopping} from '../native-demo-shopping.js';

test('one DealPilot chat handles explicit sample consent, model results, selection and sandbox handoff',async()=>{
 const {window}=parseHTML('<html><body><button id="shopping-mode"></button><div id="messages"></div></body></html>');
 globalThis.document=window.document;
 const stored=new Map();globalThis.sessionStorage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 const offers=[
  {id:'sony',title:'Sony Demo Air wireless headphones',priceCents:7900,currency:'USD',facts:{'Battery life':'30 hours'},stock:'in-stock'},
  {id:'jbl',title:'JBL Demo Air wireless headphones',priceCents:6900,currency:'USD',facts:{'Battery life':'40 hours'},stock:'in-stock'}
 ];
 let checkoutCount=0;
 let state={id:'session1',revision:0,mode:'real',offers:[],quote:null,payment:null};
 let messages=[];
 const actions=[];
 const fakeApi=async(path,body={})=>{
  actions.push({path,body});
  if(path==='/shopping/enter')return {ready:true};
  if(path==='/shopping/state')throw Error('Pairing required');
  if(path==='/shopping/pair')return {state:{...state},messages:[],sandboxReady:true};
  if(path==='/shopping/action'){
   if(body.action==='configure')state={...state,mode:'sample',revision:state.revision+1};
   if(body.action==='select')state={...state,revision:state.revision+1,quote:{title:offers.find(o=>o.id===body.offerId).title,totalCents:7900,unitCents:7900,currency:'USD',quantity:1}};
   return {state:{...state}};
  }
  if(path==='/shopping/chat'){
   messages.push({role:'user',text:body.message},{role:'assistant',text:'Here are the sample offers.'});
   state={...state,offers,revision:state.revision+1};
   return {state:{...state},messages:[...messages],sandboxReady:true};
  }
  throw Error(path);
 };
 let changed=0;
 const demo=mountDemoShopping({api:fakeApi,render:()=>{changed++;},onCheckout:()=>{checkoutCount++;}});
 window.document.querySelector('#shopping-mode').click();
 for(let i=0;i<4;i++)await new Promise(setImmediate);
 assert.equal(demo.active,true);
 assert.equal(actions[0].path,'/shopping/enter');
 assert.equal(actions[1].path,'/shopping/state');
 demo.renderAside(window.document.querySelector('#messages'));
 assert.match(window.document.querySelector('#dealpilot-shop-stage').textContent,/Connect DealPilot shopping/);
 const inputs=window.document.querySelectorAll('#dealpilot-shop-stage input');
 inputs[0].value='3490';inputs[1].value='abCD1234efGH';
 window.document.querySelector('#dealpilot-shop-stage>button').click();
 for(let i=0;i<7;i++)await new Promise(setImmediate);
 assert.equal(demo.connected,true);
 assert.equal(actions.some(x=>x.body.action==='configure'&&x.body.mode==='sample'),true);
 await demo.send('Find Sony and JBL headphones under 100 USD');
 demo.renderAside(window.document.querySelector('#messages'));
 assert.match(window.document.querySelector('#dealpilot-shop-stage').textContent,/Sony Demo Air/);
 await demo.send('Compare Sony and JBL on price, battery life, and stock');
 demo.renderAside(window.document.querySelector('#messages'));
 const comparison=window.document.querySelector('.dealpilot-compare-table');
 assert.ok(comparison,'a shopper comparison must show a structured table');
 assert.equal(comparison.querySelectorAll('tbody tr').length,2);
 assert.match(comparison.textContent,/30 hours/);
 assert.match(comparison.textContent,/in-stock/);
 await demo.send('I choose Sony Demo Air, prepare my cart');
 assert.equal(demo.getMessages().some(x=>x.role==='assistant'),true);
 demo.renderAside(window.document.querySelector('#messages'));
 assert.match(window.document.querySelector('#dealpilot-shop-stage').textContent,/Prepared cart/);
 await demo.send('Proceed to pay');
 demo.renderAside(window.document.querySelector('#messages'));
 assert.equal(checkoutCount,0);
 assert.match(window.document.querySelector('#dealpilot-shop-stage').textContent,/Open PayPal Sandbox checkout/);
 window.document.querySelector('.dealpilot-cart button').click();
 assert.equal(checkoutCount,1);
 assert.ok(changed>3);
});
