import {assessSourceIdentity,compareReportedOffers} from '../vendor/dealpilot/source-identity.js';
import {evaluateReportedCost} from '../vendor/dealpilot/purchase-cost.js';
import {assessObservationFreshness} from '../vendor/dealpilot/source-freshness.js';
import {canonicalGtin,normalizePartNumber} from '../vendor/dealpilot/product-identifiers.js';
import type {ShoppingRequest} from './shopping-request.js';
import {reportedCostClaims} from './reported-costs.js';

type Result={attribute:string;outcome:'supported'|'contradicted'|'unknown';evidence:string};
/** Native observations are an adapter input, never manufactured HTML/catalogue evidence. */
export function verifyShoppingReport(report:any,request?:ShoppingRequest,now=Date.now()){
 const evidenceTime=Number.isFinite(report.evidenceObservedAt)?Math.min(report.observedAt,report.evidenceObservedAt):report.observedAt;
 const timestamp=Number.isFinite(evidenceTime)?new Date(evidenceTime).toISOString():null;
 const freshness=assessObservationFreshness({observedAt:timestamp},new Date(now),.25);
 const product=report.sourceBound&&!report.blocked&&report.pageKind==='product-page';
 const usable=Boolean(product&&freshness.status==='recent');
 const title=String(report.listingTitle||'');
 const selected=String(report.selectedFrom?.label||'').replace(/^Go to detail page for "([^"]+)".*$/,'$1');
 const text=String(report.visibleText||'');
 const requestedBrand=request?.checks.brand;
 const escapedBrand=requestedBrand?.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const brand=title.match(/\b(Samsung|Motorola|Sony|JBL|ASUS|Lenovo|Dell|HP|Acer|Apple|Bose|Anker|Soundcore|OnePlus|Xiaomi|Realme|Nothing|Google|Vivo|Oppo)\b/i)?.[1]||(escapedBrand&&new RegExp('\\b'+escapedBrand+'\\b','i').test(title)?requestedBrand:'')||'';
 const model=text.match(/\b(?:Model number|Model name|MPN)\s*[:\n]\s*([A-Za-z0-9][A-Za-z0-9 _./-]{1,60})/i)?.[1]?.trim()||null;
 const gtinText=text.match(/\b(?:GTIN|EAN|UPC)\s*[:\n]\s*(\d{8,14})\b/i)?.[1]||null;
 const gtin=gtinText?canonicalGtin(gtinText):null;
 const identity=assessSourceIdentity({title:selected,brand},{title,model:model?normalizePartNumber(model):null,gtin});
 const seller=text.match(/\b(?:Sold by\s*[:\n]?\s*|Seller\s*[:\n]\s*)([^\n]{2,100})/i)?.[1]?.trim()||null;
 const explicitCondition=text.match(/\b(?:Item condition|Condition)\s*[:\n]\s*(new|used|renewed|refurbished|open box)\b/i)?.[1]?.toLowerCase();
 const condition=report.conditionConflict?'conflict':explicitCondition||(/\b(?:renewed|refurbished|pre-owned|used phone|open box)\b/i.test(title)?'non-new':'unknown');
 const price=report.regularPrice;
 const checks:Result[]=[];
 const add=(attribute:string,supported:boolean|undefined,evidence:string)=>checks.push({attribute,outcome:!usable||supported===undefined?'unknown':supported?'supported':'contradicted',evidence});
 if(request?.checks.currency)add('currency',price?.currency?price.currency===request.checks.currency:undefined,price?.currency||'No unambiguous currency.');
 if(request?.checks.budgetCents!==undefined)add('regular-price budget',price&&price.currency===request.checks.currency?price.amountCents<=request.checks.budgetCents:undefined,price?.evidence||'No single unconditional listing price.');
 for(const [field,attribute,values] of [['minimumRamGB','RAM',report.capacitiesGB?.ram],['minimumStorageGB','storage',report.capacitiesGB?.storage]] as const){
  const minimum=request?.checks[field];if(minimum!==undefined)add(attribute,values?.length===1?values[0]>=minimum:undefined,values?.length?values.join(', ')+' GB source claims':'No unique capacity claim.');
 }
 if(request?.checks.brand)add('required brand',brand?brand.toLowerCase()===request.checks.brand.toLowerCase():undefined,brand||'Manufacturer unknown.');
 if(request?.requiredBrands?.length)add('allowed brands',brand?request.requiredBrands.some(value=>value.toLowerCase()===brand.toLowerCase()):undefined,brand||'Manufacturer unknown.');
 if(request?.newOnly)add('new condition',condition==='unknown'?undefined:condition==='new',condition==='unknown'?'No explicit selected-item condition.':condition);
 const currency=price?.currency==='INR'||price?.currency==='USD'?price.currency:null;
 const reported=currency?reportedCostClaims(text,currency):null;
 const cost=currency&&reported?evaluateReportedCost({priceCents:price.amountCents,currency,costClaims:reported.claims}):null;
 const reasons=[...(request?.issues||[]),...(!product?['Individual product-page provenance is not established.']:[]),...(freshness.status!=='recent'?[freshness.explanation]:[]),...(!price?['No unique unconditional product price.']:[]),...(report.stock!=='available'?['Stock is '+(report.stock||'unknown')+'.']:[]),...(!seller?['Seller identity is not reported in this observation.']:[]),...checks.filter(c=>c.outcome!=='supported').map(c=>c.attribute+' is '+c.outcome+'.'),...(identity.status!=='model-compatible'||identity.variantUnresolved?identity.reasons:[]),...(!selected?['Search selection and product identity have not been independently linked.']:[]),...(gtinText&&!gtin?['Reported GTIN has an invalid checksum.']:[]),...(cost?cost.status==='reported-estimate'?[]:cost.reasons:['Delivered cost cannot be evaluated without an explicit currency and price.']),...(report.truncated?['Observation is truncated.']:[])];
 if(reported?.conflict)reasons.push('Source-reported cost or eligibility assertions conflict.');
 const sourceContradicted=checks.some(c=>c.outcome==='contradicted')||['conflict','unavailable'].includes(report.stock)||identity.status==='conflict'||Boolean(request?.issues.length)||Boolean(gtinText&&!gtin)||Boolean(report.conditionConflict)||Boolean(report.ocrConflict);
 const contradicted=sourceContradicted||Boolean(reported?.conflict);
 const exactSelectedTitle=Boolean(selected&&report.selectedFrom?.snapshot_id&&title.trim().toLowerCase()===selected.trim().toLowerCase());
 const identityLinked=identity.status==='model-compatible'&&!identity.variantUnresolved||exactSelectedTitle&&identity.status!=='conflict';
 const comparisonReasons=[...(!usable?['Fresh product-page evidence is required.']:[]),...(!title||!identityLinked?['The selected product identity is unresolved.']:[]),...(!price||!['USD','INR'].includes(price.currency)||!Number.isSafeInteger(price.amountCents)||price.amountCents<1?['A complete unconditional price and currency are required.']:[]),...(sourceContradicted?['Source facts contradict the request or listing identity.']:[])];
 const comparable=comparisonReasons.length===0;
 const comparison={eligible:comparable,matchesRequirements:comparable&&checks.every(c=>c.outcome==='supported'),rankable:comparable&&checks.every(c=>c.outcome==='supported')&&report.stock==='available',partialObservation:Boolean(report.truncated),reasons:comparisonReasons};
 return {engine:'dealpilot-pure-modules',status:contradicted?'contradicted':reasons.length?'held':'source-supported',requestRevision:request?.revision??null,appliedChecks:request?.checks??null,newOnly:request?.newOnly??false,checks,freshness,identity,cost,costClaims:reported?.claims,costConflict:reported?.conflict??false,seller,condition,identifiers:{gtin,mpn:model?normalizePartNumber(model):null},comparison,reasons:[...new Set(reasons)],checkoutVerified:false,purchaseReady:false,independentVerification:false};
}
export function compareVerifiedListings(left:any,right:any){
 const a=left.verification,b=right.verification;
 return compareReportedOffers({title:left.listingTitle||'',brand:left.listingTitle?.match(/^\w+/)?.[0]||'',gtin:a?.identifiers?.gtin,mpn:a?.identifiers?.mpn},{title:right.listingTitle||'',brand:right.listingTitle?.match(/^\w+/)?.[0]||'',gtin:b?.identifiers?.gtin,mpn:b?.identifiers?.mpn});
}
