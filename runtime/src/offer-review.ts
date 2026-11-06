import {verifyShoppingReport} from './shopping-verification.js';
import {nativeStoreForPackage,nativeStoreForUrl} from './store-policy.js';
import type {ShoppingRequest} from './shopping-request.js';
export function buildOfferReview(report:any,request?:ShoppingRequest,quantity=1,now=Date.now()){
 const verification=verifyShoppingReport(report,request,now);
 const quantityValid=Number.isInteger(quantity)&&quantity>=1&&quantity<=10;
 const ready=quantityValid&&verification.comparison.rankable&&!verification.costConflict;
 const unknowns=[...(verification.cost?.unknownComponents||['shipping','tax','mandatory fees']),...(!verification.seller?['seller']:[]),...(verification.condition==='unknown'?['condition']:[]),...(!/\bDeliver(?:ing)? to\s*:\s*[^\n]{2,100}/i.test(report.visibleText||'')?['delivery location']:[]),...(verification.costClaims?.membershipRequired!=='no'?['membership eligibility']:[]),...(quantity!==1?['quantity-specific costs']:[]),...(report.truncated?['uninspected page content']:[])];
 let link:string|null=null;
 try{const u=new URL(report.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/\/(?:dp|gp\/product|p|products?)\//i.test(u.pathname)&&(!report.sourcePackage||!nativeStoreForPackage(report.sourcePackage)||nativeStoreForUrl(u.href)===nativeStoreForPackage(report.sourcePackage)))link=u.href;}catch{}
 const cart=ready?{simulated:true,title:report.listingTitle,sourceRef:report.sourceRef,quantity,currency:report.regularPrice.currency,unitCents:report.regularPrice.amountCents,itemSubtotalCents:report.regularPrice.amountCents*quantity,reportedTotalCents:unknowns.length===0&&verification.cost?.status==='reported-estimate'?verification.cost.reportedTotalCents:null}:null;
 const eligible=Boolean(cart&&cart.currency==='USD'&&link);
 return {status:!cart?'research-hold':cart.reportedTotalCents!==null?'source-reported-review':'item-only-simulation',cart,unknowns,verification,sandboxReview:{eligible,amountCents:eligible?cart!.itemSubtotalCents:null,url:eligible?link:null,requiresExplicitBuyerApproval:true,merchantCostsIncluded:false},checkoutVerified:false,purchaseReady:false};
}
const plain=(s:unknown)=>String(s??'Unknown').replace(/[\r\n]/g,' ').replace(/([<>\[\]*_`])/g,'\\$1');
export function reviewMarkdown(review:ReturnType<typeof buildOfferReview>){
 if(!review.cart)return 'Selected-offer review is held. No cart or payment was prepared. '+review.verification.reasons.slice(0,5).join(' ');
 const c=review.cart,lines=['Source-informed simulated cart — no merchant cart or order was created.',plain(c.title),'Quantity: '+c.quantity+'. Item subtotal: '+c.currency+' '+(c.itemSubtotalCents/100).toFixed(2)+'.',c.reportedTotalCents!==null?'Source-reported estimate: '+c.currency+' '+(c.reportedTotalCents/100).toFixed(2)+'; buyer checkout is not verified.':'Merchant delivered total: unknown.','Still unresolved: '+(review.unknowns.join(', ')||'Source assertions still require final buyer review')+'.'];
 if(review.sandboxReview.eligible){lines.push('PayPal sandbox demonstration uses the item subtotal only. It excludes merchant shipping/taxes/fees and requires your separate exact-total approval.');lines.push('POCKET_CHECKOUT '+JSON.stringify({title:c.title,url:review.sandboxReview.url,unitCents:c.unitCents,currency:'USD',quantity:c.quantity}));}
 else lines.push('Sandbox handoff is unavailable for this source/currency. Use the observed merchant app to review the listing; no currency or URL was invented.');
 return lines.join('\n');
}
export function observedSandboxProposal(proposal:any,reports:any[],request?:ShoppingRequest,now=Date.now()){
 if(!proposal||proposal.currency!=='USD'||!Number.isSafeInteger(proposal.unitCents)||proposal.unitCents<1||!Number.isInteger(proposal.quantity)||proposal.quantity<1||proposal.quantity>10||typeof proposal.title!=='string'||proposal.title.length<4||proposal.title.length>400)return false;
 if(request?.checks.currency&&request.checks.currency!=='USD'||request?.issues.length||request?.checks.budgetCents!==undefined&&proposal.unitCents>request.checks.budgetCents)return false;
 try{const u=new URL(proposal.url);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;}catch{return false;}
 return reports.some(r=>r.sourceBound&&!r.blocked&&r.sourceUrl===proposal.url&&/\/(?:products?|dp|p)\//i.test(String(r.sourceUrl))&&r.pageKind!=='search-results'&&r.pageKind!=='unknown'&&r.stock==='available'&&now-Math.min(r.observedAt,r.evidenceObservedAt??r.observedAt)<=15*60000&&r.observedAt<=now+5000&&r.regularPrice?.currency==='USD'&&r.regularPrice.amountCents===proposal.unitCents&&String(r.visibleText||'').toLowerCase().includes(proposal.title.toLowerCase())&&(!request?.newOnly||/\bCondition\s*:\s*New\b/i.test(r.visibleText||''))&&(!request?.requiredBrands?.length||request.requiredBrands.some(b=>proposal.title.toLowerCase().includes(b.toLowerCase())))&&(!request?.checks.minimumRamGB||r.capacitiesGB?.ram?.length===1&&r.capacitiesGB.ram[0]>=request.checks.minimumRamGB)&&(!request?.checks.minimumStorageGB||r.capacitiesGB?.storage?.length===1&&r.capacitiesGB.storage[0]>=request.checks.minimumStorageGB)&&(!request?.checks.brand||proposal.title.toLowerCase().includes(request.checks.brand.toLowerCase())));
}
