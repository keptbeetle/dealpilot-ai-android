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
 s.localMessages=[];
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
  catch(e){s.connected=false;s.notice='Connect the DealPilot shopping service to start.';touch();}
 }
 async function pair(port,code){
  if(inFlight)return;
  inFlight=true;
  try{
   if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use the port printed by the local checkout host.');
   if(!/^[A-Za-z0-9_-]{12}$/.test(code))throw Error('Enter the 12-character code from the DealPilot host.');
   update(await api('/shopping/pair',{port,code}));
   await configure();
   s.notice='Connected. Tell DealPilot what you want to find.';
  }catch(e){s.notice=e.message||'Pairing failed. Restart the host for a fresh code.';}
  finally{inFlight=false;touch();}
 }
 function getMessages(){
  if(!s.active)return [];
  const out=[...s.archived,...(s.data?.messages||[]).map(m=>({role:m.role,text:textOf(m)})),...s.localMessages];
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
  if(isProceed(text)&&!quote)throw Error('Choose a product and prepare the cart before payment.');
  if(payment&&!['completed','cancelled','blocked'].includes(payment.status))throw Error('Resolve the existing PayPal Sandbox order before another shopping request.');  if(isChoose(text)&&!quote&&!payment){
    const offer=chooseTitle(text,s.data?.state?.offers||[]);
    if(offer){
      inFlight=true;s.pending=text;touch();
      try{
        const result=await requestAction('select',{offerId:offer.id,quantity:1});
        const prepared=result.state?.quote;
        if(!prepared)throw Error('The shopping service did not confirm the cart.');
        s.localMessages.push(
          {role:'user',text},
          {role:'assistant',text:'Cart prepared: '+prepared.quantity+' x '+prepared.title+'. Subtotal: '+money(prepared.totalCents,prepared.currency)+'. Review the quote and request PayPal checkout when ready.'}
        );
        s.notice='';touch();
        document.querySelector('#dealpilot-shop-stage .dealpilot-cart')?.scrollIntoView?.({block:'start',behavior:'smooth'});
      }catch(e){
        s.notice='Could not prepare cart: '+String(e.message||'Please try again.');touch();
      }finally{inFlight=false;s.pending=null;touch();}
      return true;
    }
  }
  if(payment&&newCategory(text)){await newPurchase();}
  s.proceed=false;s.pending=text;touch();inFlight=true;
  let completed=false;
  try{
    const result=await api('/shopping/chat',{message:text});
    update(result);
    if(isChoose(text)&&!result.state?.quote){
      const offer=chooseTitle(text,result.state?.offers||[]);
      if(offer)await requestAction('select',{offerId:offer.id,quantity:1});
    }
    completed=true;
  }catch(e){
    // Keep the message and the backend state: do not synthesize an offer or price.
    s.notice='Shopping request held: '+String(e.message||'Model is unavailable.')+' Your previous results and payment state remain available.';
  }finally{s.pending=null;inFlight=false;touch();}
  if(completed){
    const target=isChoose(text)?document.querySelector('#dealpilot-shop-stage .dealpilot-cart'):
      (/\bcompar(?:e|ison)\b/i.test(text)?document.querySelector('#dealpilot-shop-stage .dealpilot-compare-table'):null) || Array.from(document.querySelectorAll('#messages article[data-role="assistant"]')).at(-1);
    target?.scrollIntoView?.({block:'start',behavior:'smooth'});
  }
  return true;
 }
 async function newPurchase(){
  if(inFlight)throw Error('Complete the active request first.');
  const previous=(s.data?.messages||[]).map(m=>({role:m.role,text:textOf(m)}));
  if(previous.length||s.localMessages.length)s.archived.push(...previous,...s.localMessages,{role:'assistant',text:'--- New product search ---'});s.localMessages=[];
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
   const title=el('h3','','Connect DealPilot shopping');
   const note=el('p','dealpilot-muted','Connect the shopping service for product research, comparison and PayPal Sandbox checkout.');
   const portLabel=el('label','','Host port'),port=el('input');port.type='number';port.value='3490';port.min='1024';port.max='65535';portLabel.append(port);
   const codeLabel=el('label','','Pairing code'),code=el('input');code.autocomplete='off';code.maxLength=12;code.placeholder='12 characters';codeLabel.append(code);
   const message=el('p','dealpilot-muted',s.notice);const go=button('Connect shopping service',()=>void pair(Number(port.value),code.value.trim()));
   stage.append(title,note,portLabel,codeLabel,go,message);
  }else{
   const st=s.data.state,offers=st.offers||[],q=st.quote,p=st.payment;
   if(!q&&offers.length){
    stage.append(el('h3','','Headphone options'));
    stage.append(el('p','dealpilot-source-note','Example prices and stock for PayPal Sandbox testing.'));
    const latestUser=(s.data.messages||[]).filter(m=>m.role==='user').at(-1);
    if(/\bcompar(?:e|ison)\b/i.test(textOf(latestUser))){
      const wrap=el('div','dealpilot-compare-scroll'),table=el('table','dealpilot-compare-table'),head=el('tr');
      for(const field of ['Product','Price','Details','Stock'])head.append(el('th','',field));
      const thead=el('thead');thead.append(head);table.append(thead);
      const tbody=el('tbody');
      for(const offer of offers.slice(0,5)){
        const facts=Object.entries(offer.facts||{}).filter(([key])=>!/stock quantity|id|url/i.test(key)).slice(0,2).map(([key,value])=>key+': '+value).join(' / ');
        const row=el('tr');
        for(const value of [offer.title,money(offer.priceCents,offer.currency),facts||'Not specified',offer.stock||'Unknown'])row.append(el('td','',value));
        tbody.append(row);
      }
      table.append(tbody);wrap.append(table);stage.append(el('h4','','Side-by-side comparison'),wrap);
    }
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
    cart.append(el('h3','','Prepared cart'),el('p','',q.title),el('p','dealpilot-price',money(q.totalCents,q.currency)),
      el('p','',q.quantity+' item at '+money(q.totalCents,q.currency)+' subtotal'),
      el('p','dealpilot-source-note','Test cart · PayPal Sandbox. No retailer order.'));
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
  modeButton.textContent=s.active?'Shopping · Sample':'Shop with DealPilot';
  modeButton.setAttribute('aria-pressed',String(s.active));
 }
 if(modeButton)modeButton.onclick=()=>void(s.active?(s.active=false,touch()):activate());
 const origRender=render;
 render=()=>{renderButton();origRender();};
 renderButton();
 if(s.active)queueMicrotask(()=>void sync());
 return {get active(){return s.active;},get connected(){return s.connected;},get version(){return s.version;},getMessages,renderAside,send,activate,sync,newPurchase};
}
