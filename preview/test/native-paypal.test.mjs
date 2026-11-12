import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutIntent,cartSuggestion} from '../native-paypal.js';
test('normal phone research and comparison never activate checkout',()=>{
 for(const message of ['Find JBL wireless headphones under $100','Compare Sony and JBL prices','Check stock in Chrome','Maybe buy headphones?','Do not prepare a cart']){
  assert.equal(checkoutIntent(message),null,message);
 }
});
test('affirmative cart request is distinct from payment request',()=>{
 assert.equal(checkoutIntent('I choose JBL, prepare my cart'),'cart');
 assert.equal(checkoutIntent('Add these to my basket'),'cart');
 assert.equal(checkoutIntent('Proceed to pay'),'pay');
 assert.equal(checkoutIntent('Pay with PayPal'),'pay');
 assert.equal(checkoutIntent('Pay for these headphones'),'pay');
 assert.equal(checkoutIntent('Please complete the payment'),'pay');
 assert.equal(checkoutIntent('I am ready to checkout'),'pay');
 assert.equal(checkoutIntent('Proceed with payment'),'pay');
 assert.equal(checkoutIntent('Do not proceed to pay'),null);
 assert.equal(checkoutIntent('Pay later, not yet'),null);
 assert.equal(checkoutIntent('I am not ready to pay'),null);
});
test('cart defaults are editable test amounts, not real merchant claims',()=>{
 assert.deepEqual(cartSuggestion('JBL Tune headphones'),{title:'JBL wireless headphones',price:'69.00',url:'https://www.jbl.com/'});
 assert.deepEqual(cartSuggestion('Sony wireless headphones'),{title:'Sony wireless headphones',price:'79.00',url:'https://electronics.sony.com/'});
});