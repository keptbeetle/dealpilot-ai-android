import type {inspectBrowserObservation} from './browser.js';

type Report=ReturnType<typeof inspectBrowserObservation>;
export function browserReports(messages:any[]):Report[]{
 const reports:Report[]=[];
 for(const message of messages){
  if(message.role!=='toolResult'||message.toolName!=='phone_browser'||message.isError)continue;
  try{
   const value=JSON.parse(message.content.filter((part:any)=>part.type==='text').map((part:any)=>part.text).join('\n'));
   if((value.sourceBound===true||(value.blocked===true&&value.browser==='com.android.chrome'))&&typeof value.sourceUrl==='string'&&Array.isArray(value.prices))reports.push(value);
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
 const unique=new Map<string,Report>();
 for(const report of reports){
  if((!report.sourceBound&&!(report.blocked&&report.browser==='com.android.chrome'))||!report.sourceUrl||!report.observedAt||now-report.observedAt>15*60000||report.observedAt>now+5000)continue;
  try{const url=new URL(report.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)continue;unique.set(url.href,report);}catch{}
 }
 const pages=[...unique.values()].slice(-6);
 const products=pages.filter(report=>!report.blocked&&report.sourceBound&&report.pageKind!=='search-results'&&/\/(?:products?|dp|p)\//i.test(new URL(report.sourceUrl!).pathname));
 if(!products.length){
  return 'Research is incomplete. No individual product listing was verified, so I cannot report current product prices, offers or matching specifications. Typical prices and model guesses have been withheld.'+
   (pages.length?'\n\nObserved discovery pages:\n'+pages.map(report=>'- [Open observed page](<'+report.sourceUrl+'>)'+(report.blocked?' — access requires user attention.':' — discovery evidence only.')).join('\n'):'\nNo fresh source-bound browser evidence was retained.')+
   '\n\nThis evidence does not establish a cart, payment or merchant order.';
 }
 const sections=products.map(report=>{
  const lines=['[Open observed listing](<'+report.sourceUrl+'>)','Observed '+new Date(report.observedAt!).toISOString()];
  if(report.prices.length)for(const price of report.prices.slice(0,8))lines.push('- '+priceLabel(price)+': '+amount(price));
  else lines.push('- Price was not established.');
  lines.push('- Availability reported by page: '+report.stock+'.');
  if(report.holds.length)lines.push('- Hold: '+report.holds.slice(0,4).join(' '));
  return lines.join('\n');
 });
 return 'Source-observed listing evidence follows. This is not a verified purchase recommendation.\n\n'+sections.join('\n\n')+'\n\nConditional offers require eligibility checks. Exact variant, seller, shipping, taxes and delivered total still require review. This evidence does not establish a cart, payment or merchant order.';
}
