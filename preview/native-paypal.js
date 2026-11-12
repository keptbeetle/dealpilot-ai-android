/** Buyer-controlled PayPal Sandbox; the unmodified original agent handles browsing. */
export function checkoutIntent(text){
 const v=String(text||'').trim();
 if(/\b(?:do not|don't|dont|never|cancel|maybe|should i|not yet|not ready|pay later|wait before paying)\b/i.test(v))return null;
 if(/\b(?:proceed\s+to\s+pay|pay\s+(?:now|with\s+paypal|via\s+paypal|for\s+(?:this|the|my|these))|(?:go|continue|proceed|move)\s+(?:to|with)\s+(?:checkout|payment)|(?:make|complete|process|start|initiate)\s+(?:the\s+)?payment|(?:i(?:'m| am)\s+)?ready\s+to\s+(?:pay|checkout)|checkout\s+now)\b/i.test(v))return 'pay';
 if(/\b(?:prepare|add|put)\b[\s\S]{0,160}\b(?:cart|basket)\b/i.test(v))return 'cart';
 return null;
}
import {resolveCartFromChat,sameCartProduct,hasExplicitProductSelection} from './native-cart-from-chat.js';
const fmt=(c,cur='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:cur}).format(Number(c||0)/100);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const btn=(text,fn,style='')=>{const n=el('button','checkout-button '+style,text);n.type='button';n.onclick=fn;return n;};
const field=(parent,caption,value,type='text')=>{const label=el('label','checkout-label',caption),input=el('input','checkout-input');input.type=type;input.value=value;label.append(input);parent.append(label);return input;};
export function mountNativePayPal({api,getMessages,onNotice}){
 const root=el('section','dealpilot-checkout');root.id='dealpilot-checkout';root.setAttribute('role','dialog');root.setAttribute('aria-label','DealPilot Agent cart and PayPal Sandbox');root.setAttribute('aria-modal','true');document.body.append(root);
 let state=null,connected=false,busy=false,mode='',notice='',pendingCart=null,returnToken='';
 const saved=()=>{try{return JSON.parse(sessionStorage.getItem('dealpilot-paypal-draft')||'null');}catch{return null;}};
 pendingCart=saved();
 function update(response){state=response?.state||state;connected=!!state;notice='';draw();}
 async function call(action,extra={}){
  if(!state)throw Error('Connect the checkout host before continuing.');
  const result=await api('/checkout/action',{action,id:state.id,expectedRevision:state.revision,operationId:crypto.randomUUID(),...extra});
  update(result);return result;
 }
 async function task(fn){
  if(busy)return;busy=true;draw();
  try{await fn();}catch(error){notice=String(error.message||'Checkout was unavailable.');onNotice?.(notice);}
  finally{busy=false;draw();}
 }
 async function restore(){
  try{update(await api('/checkout/state'));}
  catch{connected=false;state=null;}
  draw();
 }
 function status(){const card=el('div','checkout-state'),q=state?.quote,p=state?.payment;
  if(!q)return card;
  card.append(el('h3','','Cart review'),el('p','checkout-name',q.title),el('p','checkout-amount',fmt(q.totalCents,q.currency)),el('p','checkout-detail','Quantity '+q.quantity+' · USD subtotal'));
  card.append(el('p','checkout-footnote','Test cart for PayPal Sandbox · No retailer order or shipment.'));
  if(p?.status==='completed'){
   card.append(el('h3','','PayPal Sandbox payment complete'),el('p','checkout-detail','Capture: '+p.captureId),el('p','checkout-detail','Receipt: '+p.receiptId));
  }else if(p){
   card.append(el('p','checkout-detail','Sandbox status: '+p.status));
   card.append(btn('Verify PayPal Sandbox payment',()=>void task(async()=>{const orderId=returnToken||p.orderId;if(orderId!==p.orderId)throw Error('Returned order does not match the cart.');await call('capture',{returnedOrderId:orderId});mode='payment';}),'primary'));
  }else if(mode==='payment'){
   const checkbox=el('input');checkbox.type='checkbox';checkbox.id='checkout-confirm-amount';
   const label=el('label','checkout-ack');label.append(checkbox,document.createTextNode(' I approve this exact amount for a PayPal Sandbox test payment.'));
   card.append(label);
   card.append(btn('Continue to PayPal Sandbox',()=>void task(async()=>{
    if(!checkbox.checked)throw Error('Review and approve the exact test amount before checkout.');
    await call('approve',{quoteHash:state.quote.hash,acknowledgeSandbox:true});
    const result=await call('pay',{quoteHash:state.quote.hash});
    const url=result.state?.payment?.approvalUrl;
    if(!url||new URL(url).hostname!=='www.sandbox.paypal.com')throw Error('The PayPal Sandbox approval link was unavailable.');
    await api('/checkout/open',{url});
   }),'primary'));
  }else card.append(el('p','checkout-detail','Ready. Say “Proceed to pay” to review PayPal Sandbox checkout.'));
  return card;
 }
 function setup(){const card=el('div','checkout-state');card.append(el('h3','','Connect checkout'));
  card.append(el('p','checkout-detail','One-time connection to the private PayPal Sandbox service.'));
  const port=field(card,'Host port','3490','number'),code=field(card,'Pairing code','','text');
  code.maxLength=12;code.autocomplete='off';
  card.append(btn('Connect checkout service',()=>void task(async()=>{
    const value=Number(port.value);
    if(!Number.isInteger(value)||value<1024||value>65535||!/^[A-Za-z0-9_-]{12}$/.test(code.value.trim()))throw Error('Enter the local host port and its 12-character pairing code.');
    update(await api('/checkout/pair',{port:value,code:code.value.trim()}));
    if(pendingCart)mode='cart-form';
  }),'primary'));return card;
 }
 function prepare(){const draft=pendingCart||resolveCartFromChat(getMessages());
  const card=el('div','checkout-state');card.append(el('h3','','Prepare your cart'),el('p','checkout-detail','Review the selected product from this conversation before saving a test cart.'));
  if(draft.notice)card.append(el('p','checkout-detail',draft.notice));
  if(draft.sourcePrice)card.append(el('p','checkout-detail','Price mentioned in chat: '+draft.sourcePrice));
  const title=field(card,'Selected product',draft.title||''),price=field(card,'Exact test subtotal (USD)',draft.price||'','number'),url=field(card,'Direct product listing (HTTPS)',draft.url||'','url');
  title.placeholder='Choose the exact product from your chat';price.placeholder='Confirm the exact USD amount';url.placeholder='https://retailer.example/product';
  price.step='0.01';price.min='0.01';
  card.append(btn('Prepare cart',()=>void task(async()=>{
    const cents=Math.round(Number(price.value)*100);
    if(!title.value.trim()||!Number.isSafeInteger(cents)||cents<1||cents>10000000)throw Error('Enter an item and a valid USD amount.');
    const link=new URL(url.value);if(link.protocol!=='https:'||link.username||link.password)throw Error('Use an HTTPS product reference.');
    const result=await call('browserQuote',{listing:{title:title.value.trim(),url:link.href,unitCents:cents,currency:'USD',quantity:1}});
    if(!result.state?.quote)throw Error('The checkout service did not confirm the cart.');
    pendingCart=null;sessionStorage.removeItem('dealpilot-paypal-draft');mode='cart';
  }),'primary'));return card;
 }
 function draw(){
  root.replaceChildren();root.hidden=!mode;
  if(root.hidden)return;
  const header=el('div','checkout-head');
  header.append(el('strong','','DealPilot Agent'),el('span','',mode==='payment'||state?.payment?'PayPal Sandbox':'Cart preparation'));
  header.append(btn('×',()=>{mode='';draw();},'close'));root.append(header);
  if(notice)root.append(el('p','checkout-error',notice));
  if(!connected)root.append(setup());
  else if(mode==='cart-form'&&!state?.payment)root.append(prepare());
  else if(state?.quote)root.append(status());
  else root.append(prepare());
  if(busy)root.append(el('p','checkout-detail','Processing your request…'));

 }
 async function onIntent(text){
  const intent=checkoutIntent(text);if(!intent)return false;
  const selected=resolveCartFromChat(getMessages(),text);
  await restore();
  if(intent==='pay'&&state?.quote&&(!hasExplicitProductSelection(text)||!selected.title||sameCartProduct(selected,state.quote))){
   pendingCart=null;sessionStorage.removeItem('dealpilot-paypal-draft');mode='payment';
  }else{
   pendingCart=selected;
   sessionStorage.setItem('dealpilot-paypal-draft',JSON.stringify(pendingCart));
   mode='cart-form';
  }
  draw();return true;
 }
 function onReturn(event){returnToken=String(event?.token||'');mode='payment';void restore();}
 void restore();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state?.quote)void restore();});
 return {onIntent,onReturn,restore,get state(){return state;}};
}
