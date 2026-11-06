import type {inspectBrowserObservation} from './browser.js';
import {STORE_APPS,nativeStoreForPackage,nativeStoreForUrl,type StoreName} from './store-policy.js';

type Report=ReturnType<typeof inspectBrowserObservation>&{store?:string;listingTitle?:string;query?:string;identityObservation?:{snapshot_id:string;observedAt:number};accessHold?:boolean};
function native(report:Report){return report.sourceKind==='android-app'&&Boolean(report.sourcePackage&&nativeStoreForPackage(report.sourcePackage))&&report.sourceRef?.startsWith('android-app://'+report.sourcePackage+'/observations/');}
export function browserReports(messages:any[]):Report[]{
 const reports:Report[]=[];
 for(const message of messages){
  if(message.role!=='toolResult'||!['phone_browser','phone_store_app'].includes(message.toolName))continue;
  try{
   const value=JSON.parse(message.content.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n'));
   if(message.isError||value.isError){
    if(message.toolName==='phone_store_app'&&Object.hasOwn(STORE_APPS,value.store))reports.push({sourceKind:'android-app',store:value.store,sourceLabel:STORE_APPS[value.store as StoreName].label,observedAt:value.observedAt||message.timestamp,sourceBound:false,accessHold:true,holds:[String(value.message||'The native app did not return source evidence.').slice(0,500)],prices:[],stock:'unknown'} as Report);
    continue;
   }
   if((value.sourceBound===true||(value.blocked===true&&(value.browser==='com.android.chrome'||native(value))))&&(typeof value.sourceUrl==='string'||native(value))&&Array.isArray(value.prices))reports.push(value);
  }catch{/* Invalid or failed observations are not price evidence. */}
 }
 return reports;
}
function amount(price:Report['prices'][number]){
 const value=(price.amountCents/100).toFixed(2);
 return price.currency==='INR'?'₹'+value:price.currency==='USD'?'US$'+value:'$'+value+' (dollar currency unspecified)';
}
function priceLabel(price:Report['prices'][number]){
 if(price.kind==='conditional')return 'Conditional amount (eligibility unverified)';
 if(price.kind!=='reference')return 'Page-listed amount';
 if(/excl[^₹$]*GST/i.test(price.evidence))return 'Displayed amount excluding GST';
 if(/\bGST\b/i.test(price.evidence))return 'Displayed GST component';
 if(/\/pc|\/piece|per piece|per unit/i.test(price.evidence))return 'Per-piece/unit reference';
 return 'Reference amount';
}
/** Research output is built from page observations, never from the model's draft. */
export function groundedShoppingResearch(reports:Report[],now=Date.now()):string {
 const accessHolds=reports.filter(report=>report.accessHold&&report.store&&Object.hasOwn(STORE_APPS,report.store)&&report.observedAt&&now-report.observedAt<=15*60000&&report.observedAt<=now+5000);
 const accessText=accessHolds.length?'\n\nNative app session holds:\n'+[...new Map(accessHolds.map(report=>[report.store,report])).values()].map(report=>'- ['+report.sourceLabel+' — manual app handoff](pocket-store://'+report.store+')\n  '+report.holds.join(' ')).join('\n'):'';
 const unique=new Map<string,Report>();
 for(const report of reports){
  if((!report.sourceBound&&!(report.blocked&&(report.browser==='com.android.chrome'||native(report))))||!report.observedAt||now-report.observedAt>15*60000||report.observedAt>now+5000)continue;
  if(native(report)){unique.set(report.pageKind==='product-page'&&report.listingTitle?report.sourcePackage+'|'+report.listingTitle:report.sourceRef!,report);continue;}
  if(!report.sourceUrl||nativeStoreForUrl(report.sourceUrl))continue;
  try{const url=new URL(report.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)continue;unique.set(url.href,report);}catch{}
 }
 const pages=[...unique.values()].slice(-6);
 const products=pages.filter(report=>!report.blocked&&report.sourceBound&&(native(report)?report.pageKind==='product-page'&&Boolean(report.listingTitle):report.pageKind!=='search-results'&&/\/(?:products?|dp|p)\//i.test(new URL(report.sourceUrl!).pathname)));
 if(!products.length){
  return 'Research is incomplete. No individual product listing was verified, so I cannot report current product prices, offers or matching specifications. Typical prices and model guesses have been withheld.'+
   (pages.length?'\n\nObserved discovery screens:\n'+pages.map(report=>'- '+(native(report)?'['+report.sourceLabel+'](pocket-store://'+nativeStoreForPackage(report.sourcePackage!) +')':'[Open observed page](<'+report.sourceUrl+'>)')+(report.blocked?' — access requires user attention.':' — discovery evidence only.')).join('\n'):'\nNo fresh source-bound app or browser evidence was retained.')+
   accessText+'\n\nThis evidence does not establish a cart, payment or merchant order.';
 }
 const sections=products.map(report=>{
  const lines=native(report)?['['+report.sourceLabel+'](pocket-store://'+nativeStoreForPackage(report.sourcePackage!)+')','Observed product label: '+report.listingTitle,'App package: '+report.sourcePackage,'Native observation: '+report.snapshot_id]:['[Open observed listing](<'+report.sourceUrl+'>)'];
  lines.push('Observed '+new Date(report.observedAt!).toISOString());
  if(native(report)&&report.identityObservation)lines.push('Product identity retained from native observation '+report.identityObservation.snapshot_id+' at '+new Date(report.identityObservation.observedAt).toISOString()+'.');
  if(report.prices.length)for(const price of report.prices.slice(0,8))lines.push('- '+priceLabel(price)+': '+amount(price));
  else lines.push('- Price was not established.');
  lines.push('- Availability reported by page: '+report.stock+'.');
  if(report.holds.length)lines.push('- Hold: '+report.holds.slice(0,4).join(' '));
  return lines.join('\n');
 });
 return 'Source-observed listing evidence follows. This is not a verified purchase recommendation.\n\n'+sections.join('\n\n')+accessText+'\n\nConditional offers require eligibility checks. Exact variant, seller, shipping, taxes and delivered total still require review. This evidence does not establish a cart, payment or merchant order.';
}
