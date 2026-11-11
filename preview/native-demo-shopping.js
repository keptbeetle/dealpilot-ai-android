// DealPilot's single-chat sample-inventory demonstration.
// Sample facts are supplied by the existing model-backed shopping service;
// the buyer explicitly opts into simulated catalogue mode before use.
// Live phone browsing remains the separate native agent's actual operation.
const blank=()=>({active:false,connected:false,data:null,pending:null,notice:'',archived:[],proceed:false,version:0});
const textOf=x=>String(x?.text||x?.content||'');
const money=(c,cur='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:cur}).format(Number(c||0)/100);
const chooseTitle=(text,offers)=>{
 const words=String(text).toLowerCase();let matches=offers.filter(o=>{
  const title=String(o.title||'').toLowerCase();
  return title.length&&((/sony/.test(words)&&title.includes('sony'))||(/jbl/.test(words)&&title.includes('jbl'))||
   (/lenovo/.test(words)&&title.includes('lenovo'))||(/asus/.test(words)&&title.includes('asus'))||
   words.includes(title));
 });
 return matches.length===1?matches[0]:null;
};
const isChoose=text=>/\b(?:i (?:choose|select|want|pick)|go with|prepare (?:the |my )?cart|add (?:it|this|the .+?) to (?:my |the )?cart)\b/i.test(text)&&!/\b(?:not|don't|maybe|if)\b/i.test(text);
const isProceed=text=>/\b(?:proceed (?:to )?pay|pay (?:now|with paypal)|continue (?:to )?(?:pay|checkout)|open (?:the )?paypal|checkout now)\b/i.test(text);
const newCategory=text=>/\b(?:find|show|search|look for|shop for)\b/i.test(text);
const escape=s=>String(s??'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
function button(text,onclick,cls=''){const n=el('button',cls,text);n.type='button';n.onclick=onclick;return n;}
function store(){try{return JSON.parse(sessionStorage.getItem('dealpilot-chat-demo-state')||'{}');}catch{return {};}}
export function mountDemoShopping({api,render,onCheckout}){
 const s={...blank(),...store()};
 s.connected=false;s.data=null;s.pending=null;s.version=0;s.notice='';
 let inFlight=false;
 const touch=()=>{s.version++;try{sessionStorage.setItem('dealpilot-chat-demo-state',JSON.stringify({active:s.active,archived:s.archived,proceed:s.proceed}));}catch{}render();};
 const update=data=>{s.data=data;s.connected=!!data?.state;s.notice='';touch();};
 const requestAction=async(action,extra={})=>{
  const state=s.data.state;
  const result=await api('/shopping/action',{action,id:state.id,expectedRevision:state.revision,operationId:crypto.randomUUID(),...extra});
  update({...s.data,...result});
  return result;
 };
 const configure=async()=>{if(s.data?.state?.mode==='sample')return;await requestAction('configure',{mode:'sample',consent:{sources:false,channel3:false}});};
 async function activate(){
  s.active=true;touch();
  try{await api('/shopping/enter');update(await api('/shopping/state'));await configure();}
  catch(e){s.connected=false;s.notice='Connect the local DealPilot demo host to use sample inventory. No real product claims or payments will be made.';touch();}
 }
 async function pair(port,code){
  if(inFlight)return;
  inFlight=true;
  try{
   if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use the port printed by the local checkout host.');
   if(!/^[A-Za-z0-9_-]{12}$/.test(code))throw Error('Enter the 12-character code from the DealPilot host.');
   update(await api('/shopping/pair',{port,code}));
   await configure();
   s.notice='Connected. Search for your products below. Prices and availability will be clearly labeled simulated.';
  }catch(e){s.notice=e.message||'Pairing failed. Restart the host for a fresh code.';}
  finally{inFlight=false;touch();}
 }
 function getMessages(){
  if(!s.active)return [];
  const out=[...s.archived,...(s.data?.messages||[]).map(m=>({role:m.role,text:textOf(m)}))];
  if(s.pending)out.push({role:'user',text:s.pending});
  if(s.proceed&&s.data?.state?.quote)out.push({role:'user',text:'Proceed to pay.'});
  if(s.notice&&s.connected)out.push({role:'assistant',text:s.notice});
  return out;
 }
 async function send(text){
  if(!s.active)return false;
  if(inFlight)throw Error('DealPilot is processing the previous shopping request.');
  if(!s.connected)throw Error('Connect the local demo host using the code shown in the setup panel.');
  const quote=s.data?.state?.quote,payment=s.data?.state?.payment;
  if(isProceed(text)&&quote&&!payment){s.proceed=true;touch();return true;}
  if(isProceed(text)&&!quote)throw Error('Choose a product and prepare a simulated cart before payment.');
  if(payment&&!['completed','cancelled','blocked'].includes(payment.status))throw Error('Resolve the existing PayPal Sandbox order before another shopping request.');
  if(payment&&newCategory(text)){await newPurchase();}
  s.proceed=false;s.pending=text;touch();inFlight=true;
  try{
    const result=await api('/shopping/chat',{message:text});
    update(result);
    if(isChoose(text)&&!result.state?.quote){
      const offer=chooseTitle(text,result.state?.offers||[]);
      if(offer)await requestAction('select',{offerId:offer.id,quantity:1});
    }
  }catch(e){
    // Keep the message and the backend state: do not synthesize an offer or price.
    s.notice='Shopping request held: '+String(e.message||'Model is unavailable.')+' Your previous results and payment state remain available.';
  }finally{s.pending=null;inFlight=false;touch();}
  return true;
 }
 async function newPurchase(){
  if(inFlight)throw Error('Complete the active request first.');
  const previous=(s.data?.messages||[]).map(m=>({role:m.role,text:textOf(m)}));
  if(previous.length)s.archived.push(...previous,{role:'assistant',text:'--- New product search ---'});
  update(await api('/shopping/new',{operationId:crypto.randomUUID()}));
  await configure();s.proceed=false;touch();
 }
 async function sync(){
  if(!s.active)return;
  try{await api('/shopping/enter');update(await api('/shopping/state'));}
  catch{ s.connected=false;touch();}
 }
 function renderAside(parent){
  document.getElementById('dealpilot-shop-stage')?.remove();
  if(!s.active)return;
  const stage=el('section','dealpilot-shop-stage');stage.id='dealpilot-shop-stage';
  if(!s.connected){
   const title=el('h3','','Connect DealPilot Demo');
   const note=el('p','dealpilot-muted','Pair this phone with the private Windows shopping host. Demo catalogue and merchant carts are simulated; PayPal uses Sandbox test funds.');
   const portLabel=el('label','','Host port'),port=el('input');port.type='number';port.value='3490';port.min='1024';port.max='65535';portLabel.append(port);
   const codeLabel=el('label','','Pairing code'),code=el('input');code.autocomplete='off';code.maxLength=12;code.placeholder='12 characters';codeLabel.append(code);
   const message=el('p','dealpilot-muted',s.notice);const go=button('Connect demo host',()=>void pair(Number(port.value),code.value.trim()));
   stage.append(title,note,portLabel,codeLabel,go,message);
  }else{
   const st=s.data.state,offers=st.offers||[],q=st.quote,p=st.payment;
   if(!q&&offers.length){
    stage.append(el('h3','','Sample product shortlist'));
    stage.append(el('p','dealpilot-muted','Illustrative inventory for a repeatable payment demonstration — not live retailer prices.'));
    for(const o of offers.slice(0,6)){
      const row=el('div','dealpilot-sample-product');
      row.append(el('strong','',o.title),el('b','dealpilot-price',money(o.priceCents,o.currency)));
      const facts=Object.entries(o.facts||{}).filter(([k])=>!/stock quantity|id|url/i.test(k)).slice(0,3);
      if(facts.length)row.append(el('p','',facts.map(([k,v])=>k+': '+v).join(' · ')));
      stage.append(row);
    }
    stage.append(el('p','dealpilot-muted','Ask: “Compare these products,” then “I choose [product] — prepare the cart.”'));
   }
   if(q){
    const cart=el('section','dealpilot-cart');
    cart.append(el('h3','','Prepared demo cart'),el('p','',q.title),el('p','dealpilot-price',money(q.totalCents,q.currency)),
      el('p','',q.quantity+' purchased unit(s) · simulated merchant cart'),
      el('p','dealpilot-muted','PayPal payment will use Sandbox test funds. No retailer receives this order, and nothing ships.'));
    if(p?.status==='completed'){
      cart.append(el('h3','','Sandbox payment completed'),el('p','','PayPal order: '+p.orderId),el('p','','Capture: '+p.captureId),el('p','',p.receiptId||'Test receipt available'));
      cart.append(button('Find another product',()=>void newPurchase()));
    }else if(p)cart.append(el('p','dealpilot-muted','Sandbox status: '+p.status),button('Resume PayPal Sandbox',()=>void onCheckout()));
    else if(s.proceed)cart.append(button('Open PayPal Sandbox checkout',()=>void onCheckout()),el('p','dealpilot-muted','You will review and approve the exact test amount on the next screen.'));
    else cart.append(el('p','dealpilot-muted','Reply “Proceed to pay” to review the sandbox checkout.'));
    stage.append(cart);
   }
   if(s.notice)stage.append(el('p','dealpilot-muted',s.notice));
  }
  parent.after(stage);
 }
 const modeButton=document.getElementById('shopping-mode');
 function renderButton(){
  if(!modeButton)return;
  modeButton.textContent=s.active?'Demo catalogue: ON':'Use demo catalogue';
  modeButton.setAttribute('aria-pressed',String(s.active));
 }
 if(modeButton)modeButton.onclick=()=>void(s.active?(s.active=false,touch()):activate());
 const origRender=render;
 render=()=>{renderButton();origRender();};
 renderButton();
 if(s.active)queueMicrotask(()=>void sync());
 return {get active(){return s.active;},get connected(){return s.connected;},get version(){return s.version;},getMessages,renderAside,send,activate,sync,newPurchase};
}
