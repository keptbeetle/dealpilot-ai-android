import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutIntent} from '../native-paypal.js';
import {offersFromChat,resolveCartFromChat,sameCartProduct} from '../native-cart-from-chat.js';

const list=[
 {role:'user',text:'Find Sony and JBL headphones under $100, compare them.'},
 {role:'assistant',text:'Here are the options:\n- **JBL Tune 770NC** — Price: $79.99. https://www.jbl.com/headphones/tune770nc.html\n- **Sony WH-CH720N** — Price: $94.50. https://electronics.sony.com/audio/headphones/headband/p/whch720n-b'},
 {role:'user',text:'I choose the Sony one.'}
];
test('ordinary phone research, comparison and negation do not start checkout',()=>{
 for(const message of ['Find JBL wireless headphones under $100','Compare Sony and JBL prices','Check stock in Chrome','Maybe buy headphones?','Do not prepare a cart']){
  assert.equal(checkoutIntent(message),null,message);
 }
});
test('cart and explicit payment remain different intents',()=>{
 assert.equal(checkoutIntent('I choose Sony, prepare my cart'),'cart');
 assert.equal(checkoutIntent('Add these to my basket'),'cart');
 assert.equal(checkoutIntent('Proceed to pay'),'pay');
 assert.equal(checkoutIntent('Pay with PayPal'),'pay');
 assert.equal(checkoutIntent('I am ready to checkout'),'pay');
 assert.equal(checkoutIntent('Do not proceed to pay'),null);
});
test('most recent buyer choice wins over older brands in conversation',()=>{
 const cart=resolveCartFromChat(list,'Prepare my cart');
 assert.equal(cart.title,'Sony WH-CH720N');
 assert.equal(cart.price,'94.50');
 assert.equal(cart.url,'https://electronics.sony.com/audio/headphones/headband/p/whch720n-b');
 assert.equal(cart.sourcePrice,'$94.50');
});
test('latest explicit choice in the cart command wins over previous choice',()=>{
 const cart=resolveCartFromChat(list,'I choose JBL Tune 770NC, prepare my cart');
 assert.equal(cart.title,'JBL Tune 770NC');
 assert.equal(cart.price,'79.99');
 assert.match(cart.url,/jbl\.com/);
});
test('live-phone price estimate and Google search link are not invented as a USD checkout quote',()=>{
 const messages=[
  {role:'user',text:'Find wireless headphones under $100'},
  {role:'assistant',text:'- **Soundcore by Anker Q20i** — price unverified. [Check](https://www.google.com/search?q=Q20i)\n- **Sony WH-CH720N** — about **₹6,300–₹6,700** (roughly **US$88–$110**). [Google search](https://www.google.com/search?q=Sony+WH-CH720N+price)'},
  {role:'user',text:'I chose the sony one'}
 ];
 const cart=resolveCartFromChat(messages,'prepare my cart');
 assert.equal(cart.title,'Sony WH-CH720N');
 assert.equal(cart.price,'');
 assert.equal(cart.url,'');
 assert.match(cart.sourcePrice,/₹6,300/);
 assert.match(cart.notice,/exact USD test amount/);
});
test('no explicit selection never defaults to JBL or any fixed product',()=>{
 const cart=resolveCartFromChat(list.slice(0,2),'Prepare my cart');
 assert.equal(cart.title,'');
 assert.equal(cart.price,'');
 assert.equal(cart.url,'');
});
test('ambiguous Sony models require an exact model selection',()=>{
 const cart=resolveCartFromChat([
  {role:'assistant',text:'- **Sony WH-CH720N** — $94.50. https://store.example/720n\n- **Sony WH-1000XM5** — $298.00. https://store.example/xm5'},
  {role:'user',text:'I choose Sony'}
 ],'prepare my cart');
 assert.equal(cart.title,'');
 assert.match(cart.notice,/Several listed products/);
});
test('a markdown table may supply product, price and direct retailer link',()=>{
 const cart=resolveCartFromChat([
  {role:'assistant',text:'| Model | Price | Source |\n|---|---|---|\n| **Sony WH-CH720N** | $89.99 | https://electronics.sony.com/audio/headphones/headband/p/whch720n-b |\n| **JBL Tune 770NC** | $79.99 | https://www.jbl.com/headphones/tune770nc.html |'},
  {role:'user',text:'select Sony WH-CH720N'}
 ],'prepare my cart');
 assert.equal(cart.title,'Sony WH-CH720N');
 assert.equal(cart.price,'89.99');
});
test('multiple dollar figures or ranged amounts are not assigned as an exact price',()=>{
 const offers=offersFromChat([{role:'assistant',text:'- **Sony WH-CH720N** — $79 to $105 depending on store. https://store.example/sony'}]);
 assert.equal(offers[0].price,'');
});
test('old JBL quote cannot be treated as matching the selected Sony model',()=>{
 assert.equal(sameCartProduct({title:'Sony WH-CH720N'},{title:'JBL wireless headphones'}),false);
 assert.equal(sameCartProduct({title:'Sony WH-CH720N'},{title:'Sony WH-CH720N'}),true);
});
