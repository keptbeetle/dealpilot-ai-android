import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from '../../runtime/node_modules/linkedom/esm/index.js';

const html=await readFile(new URL('../shopping.html',import.meta.url),'utf8');
const code=await readFile(new URL('../shopping.js',import.meta.url),'utf8');
async function screen(search='?checkout=1',connected=false,order=null,proposal=null){
 const {window}=parseHTML(html),calls=[];
 const state={id:'test-session',revision:0,mode:'real',consent:{sources:false,channel3:false},offers:[],quote:null,payment:order?{orderId:order,status:'approval-required'}:null,events:[]};
 const storage=new Map();
 if(proposal){
  storage.set('browser-checkout',JSON.stringify(proposal));
  state.quote={...proposal,browserSource:proposal.url,hash:'test-hash',totalCents:proposal.unitCents*proposal.quantity,expiresAt:Date.now()+600000,approved:true};
 }
 const context=vm.createContext({window,document:window.document,location:{search},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},crypto:{randomUUID:()=> 'test-operation'},URL,URLSearchParams,Intl,console,setTimeout:()=>0});
 const bridge={request(id,path,raw){
  const body=JSON.parse(raw);calls.push({path,body});
  queueMicrotask(()=>{
   if(path==='/shopping/hosted-settings')window.pocketReply(id,{configured:connected,endpoint:connected?'https://checkout.example.org':''},null);
   else if(path==='/shopping/hosted-configure'){connected=true;window.pocketReply(id,{state,sandboxReady:true},null);}
   else if(!connected)window.pocketReply(id,null,'Set up your PayPal checkout connection first.');
   else window.pocketReply(id,{state,sandboxReady:true},null);
  });
 }};
 window.PocketNative=bridge;context.PocketNative=bridge;
 vm.runInContext(code,context);
 async function settle(){for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));}
 await settle();
 return {document:window.document,calls,settle,state,storage};
}
test('native checkout configures HTTPS service without the Windows pairing flow',async()=>{
 const view=await screen();
 assert.equal(view.document.querySelector('#connection').hidden,false);
 assert.equal(view.document.querySelector('#host-port'),null);
 assert.equal(view.document.querySelector('#pair-code'),null);
 assert.equal(view.document.querySelector('.controls').hidden,true);
 view.document.querySelector('#checkout-endpoint').value='https://checkout.example.org';
 view.document.querySelector('#checkout-key').value='A'.repeat(43);
 Array.from(view.document.querySelectorAll('button')).find(b=>b.textContent==='Connect checkout').click();
 await view.settle();
 assert.equal(view.document.querySelector('#checkout-key').value,'');
 assert.equal(view.document.querySelector('#connection').hidden,true);
 assert.ok(view.calls.some(c=>c.path==='/shopping/hosted-configure'&&c.body.hosted===true));
 assert.ok(!view.calls.some(c=>c.path==='/shopping/pair'));
 view.document.querySelector('#new-chat').click();await view.settle();
 assert.equal(view.calls.at(-1).body.operationId,'test-operation');
});
test('a forged PayPal return never captures or reconciles a different purchase',async()=>{
 const view=await screen('?checkout=1&paypal_return=FORGED1234',true,'TEST12345678');
 assert.match(view.document.querySelector('#notice').textContent,/does not match/);
 assert.ok(!view.calls.some(c=>['capture','reconcile'].includes(c.body.action)));
});
test('a matching PayPal return refreshes status without invoking capture',async()=>{
 const view=await screen('?checkout=1&paypal_return=TEST12345678',true,'TEST12345678');
 assert.equal(view.calls.filter(c=>c.body.action==='reconcile').length,1);
 assert.ok(!view.calls.some(c=>c.body.action==='capture'));
});

test('reopening the same selected listing restores its existing quote without a duplicate purchase panel',async()=>{
 const listing={title:'ARK Flow',url:'https://arkelectron.com/product/ark-flow/',unitCents:25000,currency:'USD',quantity:1};
 const view=await screen('?checkout=1',true,'TEST12345678',listing);
 assert.equal(view.storage.has('browser-checkout'),false);
 assert.ok(!Array.from(view.document.querySelectorAll('button')).some(b=>b.textContent==='Use this listing for sandbox review'));
 assert.match(view.document.querySelector('#checkout').textContent,/ARK Flow/);
});
