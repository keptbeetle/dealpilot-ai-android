import {verifyShoppingReport,compareVerifiedListings} from './shopping-verification.js';
import type {ShoppingRequest} from './shopping-request.js';
/** Attribute comparisons do not require different models to share a GTIN. */
export function compareShoppingCandidates(reports:any[],request?:ShoppingRequest,now=Date.now()){
 const unique=new Map<string,any>();
 for(const r of reports){if(r.sourceBound&&r.pageKind==='product-page'&&r.listingTitle)unique.set((r.sourcePackage||r.sourceUrl)+'|'+r.listingTitle,r);}
 const candidates=[...unique.values()].slice(-6);
 const rows=candidates.map(report=>{
  const verification=verifyShoppingReport(report,request,now);
  return {title:report.listingTitle as string,sourceRef:report.sourceRef||report.sourceUrl,snapshotId:report.snapshot_id,observedAt:report.observedAt,priceCents:verification.comparison.eligible?report.regularPrice.amountCents:null,currency:report.regularPrice?.currency??null,availability:report.stock,matchesRequirements:verification.comparison.matchesRequirements,rankable:verification.comparison.rankable,deliveredTotalCents:verification.cost?.reportedTotalCents??null,verification};
 });
 const matching=rows.filter(r=>r.rankable),currencies=new Set(matching.map(r=>r.currency));
 const comparable=matching.length>=2&&currencies.size===1;
 const equivalence=rows.length===2?compareVerifiedListings({...candidates[0],verification:rows[0].verification},{...candidates[1],verification:rows[1].verification}):null;
 return {status:comparable?'comparable-listed-prices':'insufficient',rows,lowestListedPriceCents:comparable?Math.min(...matching.map(r=>r.priceCents!)):null,currency:comparable?matching[0].currency:null,sameProductEquivalence:equivalence,checkoutVerified:false,purchaseReady:false};
}
const cell=(text:unknown)=>String(text??'Unknown').replace(/[\r\n]+/g,' ').replace(/\\/g,'\\\\').replace(/([|<>\[\]*_`])/g,'\\$1');
export function comparisonMarkdown(reports:any[],request?:ShoppingRequest,now=Date.now()){
 const comparison=compareShoppingCandidates(reports,request,now);if(comparison.rows.length<2)return '';
 const lines=['Source-backed product comparison (different models compared on observed attributes):','| Product | Listed price | Requirements | Availability | Source snapshot |','| --- | --- | --- | --- | --- |'];
 for(const row of comparison.rows)lines.push('| '+[row.title,row.priceCents===null?'Unknown':row.currency+' '+(row.priceCents/100).toFixed(2),row.matchesRequirements?'Supported':'Unknown or contradicted',row.availability,row.snapshotId||row.sourceRef].map(cell).join(' | ')+' |');
 if(comparison.lowestListedPriceCents!==null)lines.push('Lowest listed price among matching observed offers: '+comparison.currency+' '+(comparison.lowestListedPriceCents/100).toFixed(2)+'. This ranks listed prices only.');
 else lines.push('There are not yet two matching, available offers with comparable listed prices.');
 lines.push('Delivery costs remain unknown unless separately established. This table does not approve checkout or payment.');
 return lines.join('\n');
}
