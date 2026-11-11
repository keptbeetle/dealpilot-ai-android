import {verifyShoppingReport,compareVerifiedListings} from './shopping-verification.js';
import type {ShoppingRequest} from './shopping-request.js';
import {nativeStoreForPackage,STORE_APPS} from './store-policy.js';
/** Attribute comparisons do not require different models to share a GTIN. */
export function compareShoppingCandidates(reports:any[],request?:ShoppingRequest,now=Date.now()){
 const unique=new Map<string,any>();
 for(const r of reports){if(r.sourceBound&&r.pageKind==='product-page'&&r.listingTitle)unique.set((r.sourcePackage||r.sourceUrl)+'|'+r.listingTitle,r);}
 const candidates=[...unique.values()].slice(-6);
 const rows=candidates.map(report=>{
  const verification=verifyShoppingReport(report,request,now);
  const retailer=report.sourcePackage?nativeStoreForPackage(report.sourcePackage):null;
  const sourceName=retailer?STORE_APPS[retailer].label:report.sourceUrl?new URL(report.sourceUrl).hostname:'Unidentified source';
  return {title:report.listingTitle as string,sourceName,sourceRef:report.sourceRef||report.sourceUrl,snapshotId:report.snapshot_id,observedAt:report.observedAt,priceCents:verification.comparison.eligible?report.regularPrice.amountCents:null,observedPriceCents:report.sourceBound&&!report.blocked&&verification.freshness.status==='recent'&&Number.isSafeInteger(report.regularPrice?.amountCents)&&report.regularPrice.amountCents>0&&['INR','USD'].includes(report.regularPrice.currency)?report.regularPrice.amountCents:null,currency:report.regularPrice?.currency??null,availability:report.stock,matchesRequirements:verification.comparison.matchesRequirements,rankable:verification.comparison.rankable,deliveredTotalCents:verification.cost?.reportedTotalCents??null,verification};
 });
 const matching=rows.filter(r=>r.rankable),currencies=new Set(matching.map(r=>r.currency));
 const comparable=matching.length>=2&&currencies.size===1;
 const equivalence=rows.length===2?compareVerifiedListings({...candidates[0],verification:rows[0].verification},{...candidates[1],verification:rows[1].verification}):null;
 return {status:comparable?'comparable-listed-prices':'insufficient',rows,lowestListedPriceCents:comparable?Math.min(...matching.map(r=>r.priceCents!)):null,currency:comparable?matching[0].currency:null,sameProductEquivalence:equivalence,checkoutVerified:false,purchaseReady:false};
}
const cell=(text:unknown)=>String(text??'Unknown').replace(/[\r\n]+/g,' ').replace(/\\/g,'\\\\').replace(/([|<>\[\]*_`])/g,'\\$1');
export function comparisonMarkdown(reports:any[],request?:ShoppingRequest,now=Date.now()){
 const comparison=compareShoppingCandidates(reports,request,now);if(comparison.rows.length<2)return '';
 const lines=['Source-backed comparison of distinct observed listings (not necessarily different models):','| Product | Retailer | Listed price | Requirements | Availability | Source snapshot |','| --- | --- | --- | --- | --- | --- |'];
 for(const row of comparison.rows){
  const budgetFailed=row.verification.checks.some(check=>check.attribute==='regular-price budget'&&check.outcome==='contradicted');
  const displayedPrice=row.observedPriceCents===null?'Unknown':row.currency+' '+(row.observedPriceCents/100).toFixed(2)+(budgetFailed?' (over budget)':row.priceCents===null?' (not qualified)':'');
  const unmet=row.verification.checks.filter(check=>check.outcome!=='supported')
   .map(check=>check.attribute+': '+check.outcome);
  const requirements=unmet.length?unmet.slice(0,3).join('; ')
   :!row.verification.comparison.eligible?'Source identity incomplete'
   :row.matchesRequirements?(row.verification.comparison.partialObservation?'Supported in partial observation':'Supported')
   :'Not established';
  lines.push('| '+[row.title,row.sourceName,displayedPrice,requirements,row.availability,row.snapshotId||row.sourceRef].map(cell).join(' | ')+' |');
 }
 if(comparison.lowestListedPriceCents!==null)lines.push('Lowest listed price among matching observed offers: '+comparison.currency+' '+(comparison.lowestListedPriceCents/100).toFixed(2)+'. This ranks listed prices only.');
 else lines.push('There are not yet two matching, available offers with comparable listed prices.');
 lines.push('Delivery costs remain unknown unless separately established. This table does not approve checkout or payment.');
 return lines.join('\n');
}
