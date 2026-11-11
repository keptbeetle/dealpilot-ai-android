import {assessSourceIdentity,compareReportedOffers} from '../vendor/dealpilot/source-identity.js';
import {evaluateReportedCost} from '../vendor/dealpilot/purchase-cost.js';
import {assessObservationFreshness} from '../vendor/dealpilot/source-freshness.js';
import {canonicalGtin,normalizePartNumber} from '../vendor/dealpilot/product-identifiers.js';
import type {ShoppingRequest,HeadphoneFit} from './shopping-request.js';
import {reportedCostClaims} from './reported-costs.js';

type Result={attribute:string;outcome:'supported'|'contradicted'|'unknown';evidence:string};
const brandLabel=/^(?:Samsung|Motorola|Sony|JBL|ASUS|Lenovo|Dell|HP|Acer|Apple|Bose|Anker|Soundcore|OnePlus|Xiaomi|Realme|Nothing|Google|Vivo|Oppo)$/i;
const colours=['black','white','blue','navy','pink','beige','silver','grey','gray','green','red','purple','brown','cream','yellow','orange'];
const compact=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const coloursIn=(value:string)=>colours.filter(colour=>new RegExp('\\b'+colour+'\\b','i').test(value));
function selectedPageColour(text:string):string|undefined{
 const claims=[...text.matchAll(/(?:^|\n)Selected Colou?r\s*(?::|is)\s*([a-z]{3,12})(?=\n|$)/gi)].map(m=>m[1].toLowerCase()).filter(x=>colours.includes(x));
 return new Set(claims).size===1?claims[0]:undefined;
}
const fitsIn=(value:string):HeadphoneFit[]=>{
 const found:HeadphoneFit[]=[];
 if(/\b(?:over[- ](?:the[- ])?ear|around[- ](?:the[- ])?ear|circumaural)\b/i.test(value))found.push('over-ear');
 if(/\b(?:on[- ](?:the[- ])?ear|supra[- ]aural)\b/i.test(value))found.push('on-ear');
 if(/\b(?:in[- ](?:the[- ])?ear|intra[- ]aural)\b/i.test(value))found.push('in-ear');
 return found;
};
function adjacentPageBrand(title:string,text:string):string{
 const lines=text.split('\n').map(line=>line.trim());
 const matches=new Set<string>();
 for(let i=2;i<lines.length;i++)if(lines[i]===title&&/^visit store$/i.test(lines[i-1])&&brandLabel.test(lines[i-2]))matches.add(lines[i-2]);
 return matches.size===1?[...matches][0]:'';
}
/** A selected search card is a source claim only while its exact model prefix
 * and, if visible, selected colour agree with this opened detail page. */
function linkedSelectedCard(report:any,title:string,selected:string,text:string):boolean{
 if(typeof report.selectedFrom?.snapshot_id!=='string'||!report.selectedFrom.snapshot_id||!selected||!title)return false;
 const prefix=compact(title.replace(/\.{2,}\s*more$/i,'')).slice(0,36);
 if(prefix.length<18||!/\d/.test(prefix)||!compact(selected).includes(prefix))return false;
 const selectedColours=coloursIn(selected);
 const selectedOnPage=selectedPageColour(text);
 if(selectedOnPage&&selectedColours.length&&(selectedColours.length!==1||selectedColours[0]!==selectedOnPage))return false;
 return true;
}
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
 const titleBrand=title.match(/\b(Samsung|Motorola|Sony|JBL|ASUS|Lenovo|Dell|HP|Acer|Apple|Bose|Anker|Soundcore|OnePlus|Xiaomi|Realme|Nothing|Google|Vivo|Oppo)\b/i)?.[1]||'';
 const pageBrand=adjacentPageBrand(title,text);
 const brandDisagreement=Boolean(titleBrand&&pageBrand&&titleBrand.toLowerCase()!==pageBrand.toLowerCase());
 const brand=titleBrand||pageBrand||(escapedBrand&&new RegExp('\\b'+escapedBrand+'\\b','i').test(title)?requestedBrand:'')||'';
 const cardLinked=linkedSelectedCard(report,title,selected,text);
 const pageColour=selectedPageColour(text),titleColours=coloursIn(title),cardColours=coloursIn(selected);
 const variantDisagreement=Boolean(pageColour&&(titleColours.some(c=>c!==pageColour)||cardColours.length===1&&cardColours[0]!==pageColour));
 const identityTitle=(titleBrand||!pageBrand?title:pageBrand+' '+title)+
  (cardLinked&&pageColour&&!titleColours.length?' '+pageColour:'');
 const model=text.match(/\b(?:Model number|Model name|MPN)\s*[:\n]\s*([A-Za-z0-9][A-Za-z0-9 _./-]{1,60})/i)?.[1]?.trim()||null;
 const gtinText=text.match(/\b(?:GTIN|EAN|UPC)\s*[:\n]\s*(\d{8,14})\b/i)?.[1]||null;
 const gtin=gtinText?canonicalGtin(gtinText):null;
 const identity=assessSourceIdentity({title:selected,brand},{title:identityTitle,model:model?normalizePartNumber(model):null,gtin});
 const seller=text.match(/\b(?:Sold by\s*[:\n]?\s*|Seller\s*[:\n]\s*)([^\n]{2,100})/i)?.[1]?.trim()||null;
 const conditionClaims=[...text.matchAll(/\b(?:Item condition|Condition)\s*[:\n]\s*(new|used|renewed|refurbished|open box)\b/gi)].map(m=>m[1].toLowerCase());
 const condition=report.conditionConflict||new Set(conditionClaims).size>1?'conflict':conditionClaims[0]||(/\b(?:renewed|refurbished|pre-owned|used phone|open box)\b/i.test(title)?'non-new':'unknown');
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
 if(request?.headphoneFits?.length){
  // Fit claims must identify the selected listing, not unrelated recommendations,
  // reviews or accessories elsewhere in the native product page.
  const detailFits=fitsIn(title);
  const cardFits=cardLinked?fitsIn(selected):[];
  const fitConflict=detailFits.length>1||cardFits.length>1||detailFits.length===1&&cardFits.length===1&&detailFits[0]!==cardFits[0];
  const fit=!fitConflict?(detailFits[0]||cardFits[0]):undefined;
  const evidence=fitConflict?'The linked card and product title disagree about headphone fit.'
   :detailFits.length===1?'Product-page title states '+fit+'.'
   :cardFits.length===1?'Linked selected search card states '+fit+'; matching model prefix'+(text.match(/\bSelected Colou?r\s*:?\s*\n?\s*([a-z]+)\b/i)?' and selected colour':'')+'.'
   :'Neither the product-page title nor a linked selected card establishes a unique headphone fit.';
  add('headphone fit',fit?request.headphoneFits.includes(fit):undefined,evidence);
 }
 const currency=price?.currency==='INR'||price?.currency==='USD'?price.currency:null;
 const reported=currency?reportedCostClaims(text,currency):null;
 const cost=currency&&reported?evaluateReportedCost({priceCents:price.amountCents,currency,costClaims:reported.claims}):null;
 const reasons=[...(request?.issues||[]),...(!product?['Individual product-page provenance is not established.']:[]),...(freshness.status!=='recent'?[freshness.explanation]:[]),...(!price?['No unique unconditional product price.']:[]),...(report.stock!=='available'?['Stock is '+(report.stock||'unknown')+'.']:[]),...(!seller?['Seller identity is not reported in this observation.']:[]),...checks.filter(c=>c.outcome!=='supported').map(c=>c.attribute+' is '+c.outcome+'.'),...(identity.status!=='model-compatible'||identity.variantUnresolved?identity.reasons:[]),...(!selected?['Search selection and product identity have not been independently linked.']:[]),...(gtinText&&!gtin?['Reported GTIN has an invalid checksum.']:[]),...(cost?cost.status==='reported-estimate'?[]:cost.reasons:['Delivered cost cannot be evaluated without an explicit currency and price.']),...(report.truncated?['Observation is truncated.']:[])];
 if(reported?.conflict)reasons.push('Source-reported cost or eligibility assertions conflict.');
 if(brandDisagreement)reasons.push('Product title and adjacent brand label disagree.');
 if(variantDisagreement)reasons.push('Selected product colour differs between the opened detail page and its source card or title.');
 const sourceContradicted=checks.some(c=>c.outcome==='contradicted')||['conflict','unavailable'].includes(report.stock)||identity.status==='conflict'||Boolean(request?.issues.length)||Boolean(gtinText&&!gtin)||condition==='conflict'||Boolean(report.ocrConflict)||brandDisagreement||variantDisagreement;
 const contradicted=sourceContradicted||Boolean(reported?.conflict);
 const exactSelectedTitle=Boolean(selected&&report.selectedFrom?.snapshot_id&&title.trim().toLowerCase()===selected.trim().toLowerCase());
 const identityLinked=identity.status==='model-compatible'&&!identity.variantUnresolved&&
  (report.sourceKind!=='android-app'||cardLinked||exactSelectedTitle)||exactSelectedTitle&&identity.status!=='conflict';
 const comparisonReasons=[...(!usable?['Fresh product-page evidence is required.']:[]),...(!title||!identityLinked?['The selected product identity is unresolved.']:[]),...(!price||!['USD','INR'].includes(price.currency)||!Number.isSafeInteger(price.amountCents)||price.amountCents<1?['A complete unconditional price and currency are required.']:[]),...(sourceContradicted?['Source facts contradict the request or listing identity.']:[])];
 const comparable=comparisonReasons.length===0;
 const comparison={eligible:comparable,matchesRequirements:comparable&&checks.every(c=>c.outcome==='supported'),rankable:comparable&&checks.every(c=>c.outcome==='supported')&&report.stock==='available',partialObservation:Boolean(report.truncated),reasons:comparisonReasons};
 return {engine:'dealpilot-pure-modules',status:contradicted?'contradicted':reasons.length?'held':'source-supported',requestRevision:request?.revision??null,appliedChecks:request?.checks??null,newOnly:request?.newOnly??false,checks,freshness,identity,cost,costClaims:reported?.claims,costConflict:reported?.conflict??false,seller,observedBrand:brand||null,condition,identifiers:{gtin,mpn:model?normalizePartNumber(model):null},comparison,reasons:[...new Set(reasons)],checkoutVerified:false,purchaseReady:false,independentVerification:false};
}
export function compareVerifiedListings(left:any,right:any){
 const a=left.verification,b=right.verification;
 return compareReportedOffers({title:left.listingTitle||'',brand:left.listingTitle?.match(/^\w+/)?.[0]||'',gtin:a?.identifiers?.gtin,mpn:a?.identifiers?.mpn},{title:right.listingTitle||'',brand:right.listingTitle?.match(/^\w+/)?.[0]||'',gtin:b?.identifiers?.gtin,mpn:b?.identifiers?.mpn});
}
