const $=s=>document.querySelector(s),native=Boolean(window.PocketNative);
let state,ready=false,messages=[],busy=false,sequence=0;const pending=new Map();
if(native)window.pocketReply=(id,value,error)=>{const p=pending.get(id);if(!p)return;pending.delete(id);error?p.reject(Error(error)):p.resolve(value);};
async function rpc(kind,body={}){
 if(native)return new Promise((resolve,reject)=>{const id=String(++sequence);pending.set(id,{resolve,reject});PocketNative.request(id,'/shopping/'+kind,JSON.stringify(body));setTimeout(()=>{if(pending.delete(id))reject(Error('Host request timed out. Restore status before retrying payment.'));},100000);});
 const response=await fetch('/api/shop/'+kind,{method:'POST',headers:{'content-type':'application/json','x-pocket-request':'1'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(data.error||'Shopping request failed.');return data;
}
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const money=(c,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(c/100);
function button(text,fn,disabled=false){const b=el('button',text);b.type='button';b.disabled=disabled;b.onclick=()=>run(fn);return b;}
async function run(fn){if(busy)return;busy=true;$('#send').disabled=true;document.body.classList.add('busy');$('#notice').textContent='';try{await fn();}catch(e){$('#notice').textContent=e.message;try{accept(await rpc('state'));}catch{}}finally{busy=false;$('#send').disabled=false;document.body.classList.remove('busy');}}
function accept(result){state=result.state;ready=result.sandboxReady;if(result.messages)messages=result.messages;$('#connection').hidden=true;render();}
async function action(action,extra={}){accept(await rpc('action',{action,id:state.id,expectedRevision:state.revision,operationId:crypto.randomUUID(),...extra}));}
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
function open(url){if(native)return rpc('open',{url});window.open(url,'_blank','noopener,noreferrer');}
function inline(parent,text){
 const allowed=new Set((state?.offers??[]).map(o=>o.url));if(state?.payment?.approvalUrl)allowed.add(state.payment.approvalUrl);
 const pattern=/\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g;let offset=0;
 for(const match of text.matchAll(pattern)){parent.append(document.createTextNode(text.slice(offset,match.index)));if(match[1])parent.append(el('strong',match[1]));else if(allowed.has(match[3])&&safeLink(match[3])){const a=el('a',match[2]);a.href=match[3];a.rel='noopener noreferrer';a.onclick=e=>{e.preventDefault();void open(match[3]);};parent.append(a);}else parent.append(document.createTextNode(match[0]));offset=match.index+match[0].length;}
 parent.append(document.createTextNode(text.slice(offset)));
}
function richText(text){
 const body=el('div',undefined,'reply'),lines=text.split('\n'),cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 for(let i=0;i<lines.length;i++){
  if(lines[i].includes('|')&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i+1])){
   const wrap=el('div',undefined,'table-wrap'),table=el('table'),head=el('tr');for(const cell of cells(lines[i]).slice(0,8)){const th=el('th');inline(th,cell);head.append(th);}table.append(head);i+=2;let rows=0;
   for(;i<lines.length&&lines[i].includes('|')&&rows++<30;i++){const row=el('tr');for(const cell of cells(lines[i]).slice(0,8)){const td=el('td');inline(td,cell);row.append(td);}table.append(row);}i--;wrap.append(table);body.append(wrap);
  }else if(lines[i].trim()){const p=el('p');inline(p,lines[i]);body.append(p);}
 }
 return body;
}
const checkoutOnly=native&&new URLSearchParams(location.search).has('checkout');
if(checkoutOnly){
 document.querySelector('.intro h1').textContent='Review your sandbox purchase';
 document.querySelector('.intro p').textContent='Review the listing from your DealPilot AI chat and approve the exact test amount.';
 document.querySelector('.intro').append($('#readiness'));
 const connection=$('#connection');
 connection.replaceChildren(el('h2','Connect PayPal Sandbox'),el('p','One-time pairing with the private DealPilot checkout host. PayPal uses only sandbox test funds.'));
 const portLabel=el('label','Checkout host port'),port=el('input');port.id='checkout-port';port.type='number';port.value='3490';port.min='1024';port.max='65535';portLabel.append(port);
 const codeLabel=el('label','One-time pairing code'),code=el('input');code.id='checkout-pair-code';code.autocomplete='off';code.placeholder='From DealPilot host';codeLabel.append(code);
 connection.append(portLabel,codeLabel,button('Connect Sandbox',async()=>{
   try{accept(await rpc('pair',{port:Number(port.value),code:code.value.trim()}));await restoreBrowserCart();}finally{code.value='';}
 }));
 const manage=button('Sandbox connection',async()=>{connection.hidden=false;});
 document.querySelector('.intro').append(manage);

 for(const selector of ['.controls','#chat','#shop-composer','#offers','#journey','#new-chat','#history','#purchase-history'])$(selector).hidden=true;
}
function productMatrix(offers){
 const wrap=el('div',undefined,'table-wrap comparison-matrix'),table=el('table'),header=el('tr');
 for(const name of ['Product','Price','Key details','Availability'])header.append(el('th',name));table.append(header);
 for(const o of offers){
  const row=el('tr'),facts=Object.entries(o.facts??{}).filter(([key])=>!/(url|tracking|internal)/i.test(key)).slice(0,3).map(([key,value])=>`${key}: ${value}`).join(' · ');
  for(const value of [o.title,money(o.priceCents,o.currency),facts||'Specifications not available',o.stock||'Unknown'])row.append(el('td',value));
  table.append(row);
 }
 wrap.append(table);return wrap;
}
function render(){
 $('#source-mode').value=state.mode;$('#source-consent').checked=state.consent.sources;$('#channel-consent').checked=state.consent.channel3;
 $('#readiness').textContent=ready?'Genuine PayPal sandbox is configured. No payment starts until you approve this exact quote and press Pay.':'PayPal sandbox is not configured. Checkout stays blocked; no fake payment is substituted.';
 $('#mode-note').textContent=state.mode==='sample'?'SAMPLE DATA: products, stock, prices, delivery assumptions, cart and merchant fulfilment are SIMULATED. Payment uses genuine PayPal sandbox test funds.':'REAL SOURCE MODE: observations come from permitted sources. Merchant cart/fulfilment are simulated. Test price excludes unknown seller shipping, tax and fees; it is not a real delivered quote.';
 if(native)$('#mode-note').textContent+=' Host-assisted demo: the model, research and payment backend run on your paired Windows host. General phone actions are paused in this mode. Background automation was paused on entry; resume it separately in settings if wanted.';
 const chat=$('#chat');chat.replaceChildren();for(const m of messages){const a=el('article',undefined,'message');a.dataset.role=m.role;a.append(el('strong',m.role==='user'?'You':'DealPilot AI'),richText(m.text));chat.append(a);}
 const offers=$('#offers');offers.replaceChildren();if(state.offers.length){offers.append(el('h2','Products matching your search'),el('p','Verified against the selected source mode; compare specifications below.','muted'),productMatrix(state.offers));}
 for(const o of state.offers){const card=el('article',undefined,'offer');card.append(el('h2',o.title),el('p',money(o.priceCents,o.currency),'price'),el('p',o.merchant+' · '+o.stock),el('p',state.mode==='sample'?'Simulated inventory · test data':o.verification,'muted'));for(const [key,v] of Object.entries(o.facts??{}))card.append(el('p',key+': '+v));if(o.pack)card.append(el('p',`${o.pack} items inside one purchased pack`));const url=safeLink(o.url);if(url&&state.mode==='real')card.append(button('Open actual listing',()=>open(url)));const label=el('label','Purchased units / packs'),q=el('input');q.type='number';q.min='1';q.max='10';q.value='1';q.setAttribute('aria-label','Quantity for '+o.title);label.append(q);card.append(label,button('Choose & prepare test cart',()=>action('select',{offerId:o.id,quantity:Number(q.value)}),Boolean(state.payment)||state.mode==='real'&&!/^page-(?:crosschecked|observed):/.test(o.verification)));offers.append(card);}
 const checkout=$('#checkout');checkout.replaceChildren();if(state.quote){
  const q=state.quote,p=state.payment;checkout.append(el('h2','Review the exact test checkout'),el('p',q.title),el('p',`${q.quantity} × ${money(q.unitCents,q.currency)} = ${money(q.totalCents,q.currency)}`,'price'),el('p',state.mode==='sample'?'SIMULATED delivery/tax:0 in this sample scenario. No real seller quote.':'Seller shipping/tax/fees UNKNOWN and excluded. Test amount is item subtotal only.'),el('p','Quote expires '+new Date(q.expiresAt).toLocaleTimeString()),el('p','Cart and merchant fulfilment are simulated. No real order or shipment.'));
  if(q.itemsPerPack)checkout.append(el('p',`${q.quantity} purchased packs × ${q.itemsPerPack} items per pack = ${q.quantity*q.itemsPerPack} items total.`));
  if(!p){const label=el('label',undefined,'check'),check=el('input');check.type='checkbox';check.id='approve-check';label.append(check,el('span',`I reviewed ${money(q.totalCents,q.currency)} and approve this exact simulated cart for PayPal sandbox test payment.`));checkout.append(label,button(q.approved?'Exact quote approved':'Approve exact quote',async()=>{if(!check.checked)throw Error('Review and check the exact total acknowledgement first.');await action('approve',{quoteHash:q.hash,acknowledgeSandbox:true});},q.approved||q.currency!=='USD'),button('Pay with PayPal sandbox',()=>action('pay',{quoteHash:q.hash}),!q.approved||!ready||q.currency!=='USD'),button('Cancel unpaid cart',()=>action('cancel')));if(q.currency!=='USD')checkout.append(el('p','INR is retained. This sandbox adapter is USD-only; no currency conversion or substitute amount is used.'));}
  if(p){checkout.append(el('p','Sandbox status: '+p.status));if(p.orderId)checkout.append(el('p','Provider order: '+p.orderId));if(p.approvalUrl&&p.status==='approval-required')checkout.append(button('Open genuine PayPal sandbox',()=>open(p.approvalUrl)),button('I approved at PayPal — verify and capture',()=>action('capture',{returnedOrderId:p.orderId})));if(p.status!=='completed')checkout.append(button('Reconcile status (read only)',()=>action('reconcile')),button('Cancel uncaptured checkout',()=>action('cancel')));if(p.status==='completed'){const receipt=el('div',undefined,'receipt');receipt.append(el('h2','Sandbox test payment verified'),el('p','Capture: '+p.captureId),el('p','Demo order: '+p.receiptId),el('p','Merchant order and fulfilment are SIMULATED. Nothing will ship.'));checkout.append(receipt);}if(p.status==='unknown'||p.status==='creating'||p.status==='processing')checkout.append(el('p','Outcome is uncertain. Do not pay again. Reconciliation never repeats a capture.'));}
 }
 if(state.quote?.browserSource){
   checkout.prepend(el('p','Selected from DealPilot browsing. The seller price and availability have not been verified.'));
   checkout.append(button('Open listing',()=>open(state.quote.browserSource)));
 }
 if(checkoutOnly){
   $('#mode-note').textContent='PayPal sandbox uses test funds. The merchant order is simulated.';
   let pending=sessionStorage.getItem('browser-checkout');
   if(pending&&state.quote){
     const listing=JSON.parse(pending),q=state.quote;
     if(q.browserSource===listing.url&&q.title===listing.title&&q.unitCents===listing.unitCents&&q.currency===listing.currency&&q.quantity===listing.quantity){
       sessionStorage.removeItem('browser-checkout');pending=null;
     }
   }
   if(pending){
     const listing=JSON.parse(pending);
     const panel=el('section',undefined,'offer');
     panel.append(el('h2',listing.title),el('p',listing.url),el('p',listing.quantity+' × '+money(listing.unitCents,listing.currency)),button('Use this listing for sandbox review',async()=>{
       await action('browserQuote',{listing});sessionStorage.removeItem('browser-checkout');render();
     },Boolean(state.payment)));
     if(state.payment){
       panel.append(el('p','The checkout below belongs to a previous purchase. Resolve it, then choose New purchase conversation to review this listing.'));
       checkout.prepend(panel);
     }else checkout.replaceChildren(panel);
   }
 }
 const events=$('#events');events.replaceChildren();for(const e of state.events)events.append(el('li',`${e.kind} · ${e.text}`));
}
$('#configure').onclick=()=>run(()=>action('configure',{mode:$('#source-mode').value,consent:{sources:$('#source-consent').checked,channel3:$('#channel-consent').checked}}));
$('#restore').onclick=()=>run(async()=>accept(await rpc('state')));
$('#new-chat').onclick=()=>run(async()=>{$('#purchase-history').hidden=true;accept(await rpc('new',{operationId:crypto.randomUUID()}));});
$('#history').onclick=()=>run(async()=>{const result=await rpc('history'),panel=$('#purchase-history');panel.replaceChildren(el('h2','Previous test purchases'));for(const p of result.purchases){const card=el('article',undefined,'offer');card.append(el('h3',p.quote?.title||'Shopping conversation'),el('p',p.payment?'Sandbox: '+p.payment.status:'No payment'),el('p',p.payment?.receiptId||p.payment?.orderId||'No order/receipt'),el('p','Merchant fulfilment is simulated. No real shipment.'));panel.append(card);}panel.hidden=false;});
if($('#pair'))$('#pair').onclick=()=>run(async()=>accept(await rpc('pair',{port:Number($('#host-port').value),code:$('#pair-code').value})));
async function restoreBrowserCart(){
 if(!checkoutOnly||!state)return;
 const raw=sessionStorage.getItem('browser-checkout');if(!raw)return;
 const listing=JSON.parse(raw);
 if(state.payment){
   if(['completed','cancelled','blocked'].includes(state.payment.status)){
     accept(await rpc('new',{operationId:crypto.randomUUID()}));
   }else return; // Never replace an unresolved PayPal payment.
 }
 const quote=state.quote;
 const same=quote&&quote.browserSource===listing.url&&quote.title===listing.title&&quote.unitCents===listing.unitCents&&quote.currency===listing.currency&&quote.quantity===listing.quantity;
 if(!same)await action('browserQuote',{listing});
 sessionStorage.removeItem('browser-checkout');
}
$('#shop-composer').onsubmit=e=>{e.preventDefault();run(async()=>{const message=$('#request').value.trim();if(!message)throw Error('Describe what you need.');$('#notice').textContent='DealPilot AI is researching…';const result=await rpc('chat',{message});accept(result);$('#request').value='';$('#notice').textContent='';});};
if(native){window.pocketBack=()=>void rpc('close').then(()=>location.href='/index.html');$('#back').onclick=e=>{e.preventDefault();window.pocketBack();};}
run(async()=>{
 try{
  accept(await rpc(native?'state':'connect'));
  if(checkoutOnly){await restoreBrowserCart();
   const params=new URLSearchParams(location.search),returned=params.get('paypal_return')||params.get('paypal_cancel');
   if(returned){
    if(returned!==state.payment?.orderId)throw Error('This PayPal return does not match the active purchase. Restore and review the correct checkout.');
    await action('reconcile');
    $('#notice').textContent=params.has('paypal_cancel')?'You returned from PayPal cancellation. Review the saved status before continuing.':'PayPal status refreshed. Use the verification button to complete an approved test payment.';
   }
  }
 }catch(e){if(native&&!state)$('#connection').hidden=false;throw e;}
});
if(!checkoutOnly&&location.search.includes('paypal_'))$('#notice').textContent='Returning from PayPal is not payment confirmation. Restore this session, then verify and capture only the matching approved test order. On Android, return to DealPilot AI and use its verification button.';

// Checkout uses the same buyer-paired local PayPal Sandbox connection as DealPilot.
