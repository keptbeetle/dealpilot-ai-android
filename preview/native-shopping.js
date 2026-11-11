/* DealPilot's chat-native, buyer-controlled PayPal sandbox handoff.
 * This module never invents a product, price or merchant order.
 * The host runtime has already guarded POCKET_CHECKOUT with fresh phone evidence.
 */
const isProceed=text=>/\b(?:proceed(?:\s+to)?\s+(?:pay|payment|checkout)|pay\s+(?:now|with\s+paypal)|open\s+(?:the\s+)?paypal|continue\s+to\s+checkout|checkout\s+now)\b/i.test(text);
const isChanged=text=>/\b(?:cancel\s+(?:the\s+)?(?:cart|checkout|purchase)|start\s+over|find\s+(?:another|new)|search\s+(?:again|for)|change\s+(?:the\s+)?(?:product|selection)|choose\s+(?:another|different)|switch\s+to\s+(?:another|different))\b/i.test(text);
export function findPreparedCart(messages,parse){
 let chosen=null,at=-1;
 for(let i=0;i<messages.length;i++){
  const item=messages[i];
  if(item.role!=='assistant')continue;
  const parsed=parse(item.text||item.content||'');
  if(parsed){chosen=parsed;at=i;}
 }
 if(!chosen)return null;
 const since=messages.slice(at+1).filter(message=>message.role==='user').map(message=>String(message.text||message.content||''));
 if(since.some(isChanged))return null;
 const recent=messages.slice(Math.max(0,at-4)).filter(message=>message.role==='user').map(message=>String(message.text||message.content||''));
 return {...chosen,readyToPay:[...since,...recent].some(isProceed)};
}
export function renderPreparedCart(details,openCheckout){
 const {listing,readyToPay}=details;
 const box=document.createElement('section');box.className='dealpilot-cart';box.setAttribute('aria-label','Selected simulated cart');
 const title=document.createElement('h3');title.textContent='Your prepared test cart';
 const name=document.createElement('p');name.textContent=listing.title;
 const total=document.createElement('p');total.className='price';total.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:listing.currency}).format(listing.unitCents*listing.quantity/100);
 const quantity=document.createElement('p');quantity.textContent='Quantity: '+listing.quantity+' · Item subtotal only';
 const notice=document.createElement('p');notice.className='muted';notice.textContent='Verified source selection. Merchant cart, delivery and fulfillment are simulated; shipping and taxes are not included.';
 box.append(title,name,total,quantity,notice);
 if(readyToPay){
  const go=document.createElement('button');go.type='button';go.textContent='Continue to PayPal Sandbox';go.onclick=()=>{
   if(go.disabled)return;
   go.disabled=true;
   Promise.resolve(openCheckout(listing)).catch(error=>{
    go.disabled=false;
    const failure=document.createElement('p');failure.setAttribute('role','alert');
    failure.textContent=String(error?.message||'Checkout unavailable; please retry.');box.append(failure);
   });
  };box.append(go);
 }else{
  const help=document.createElement('p');help.className='muted';help.textContent='To continue, message DealPilot: “Proceed to pay”.';box.append(help);
 }
 return box;
}
