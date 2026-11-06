import {createHash} from 'node:crypto';
import {nativeStoreForUrl} from './store-policy.js';

export type ObservationNode={text?:string;description?:string;resource_id?:string;clickable?:boolean;scrollable?:boolean;enabled?:boolean;focused?:boolean;editable?:boolean;role?:string;bounds?:{left:number;top:number;right:number;bottom:number}};
export type BrowserObservation={snapshot_id?:string;captured_at_ms?:number;package_name?:string;nodes?:ObservationNode[];nodes_truncated?:boolean;coordinate_width?:number;coordinate_height?:number};
export type ShoppingChecks={currency?:'USD'|'INR';budgetCents?:number;brand?:string;minimumRamGB?:number;minimumStorageGB?:number};
type Price={amountCents:number;currency:'USD'|'INR'|'dollar-unspecified';kind:'conditional'|'reference'|'listed';evidence:string};
const challenge=/verify (?:that )?you are human|unusual traffic|robot check|captcha|access denied|checking your browser|sign in to continue|log ?in to continue/i;
const conditions=/bank|credit card|debit card|cashback|coupon|exchange|trade.?in|membership|subscribe|EMI|per month|\/mo\b/i;
const references=/\bMRP\b|M\.R\.P\.?|list price|was price|price was|original price|regularly|RRP|\bsave(?:d|s)?\b|\bsavings\b|shipping|delivery charge|\btax(?:es)?\b|\bGST\b|\bfees?\b|order total|grand total|subtotal|starting price|from\s*$/i;

function sourceAddress(nodes:ObservationNode[]):string|null{
 const bar=nodes.find(node=>/url_bar|location_bar|omnibox/i.test(node.resource_id||''));
 const raw=bar?.text?.trim();
 if(!raw||bar?.focused||/\s/.test(raw))return null;
 try{
  const url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')?url.href:null;
 }catch{return null;}
}
function capacity(text:string,attribute:'ram'|'storage'):number[]{
 const noun=attribute==='ram'?'(?:RAM|memory)':'(?:SSD|HDD|storage|hard drive|ROM)';
 const after=new RegExp('(\\d+(?:\\.\\d+)?)[ \\t]*(GB|TB)[ \\t]*'+noun,'gi');
 const before=new RegExp(noun+'[ \\t]*[:=-]?[ \\t]*(\\d+(?:\\.\\d+)?)[ \\t]*(GB|TB)','gi');
 return [...new Set([...text.matchAll(after),...text.matchAll(before)].map(match=>Number(match[1])*(match[2].toUpperCase()==='TB'?1024:1)))];
}
export type ShoppingSourceContext={kind:'browser'|'android-app';bound:boolean;url:string|null;ref:string|null;label:string;pageKind:'page'|'search-results'|'product-page'|'unknown';holds:string[]};
export function inspectBrowserObservation(observation:BrowserObservation,checks:ShoppingChecks={}){
 const url=sourceAddress(observation.nodes||[]),chrome=observation.package_name==='com.android.chrome';
 const nativeStore=url?nativeStoreForUrl(url):undefined;
 const search=Boolean(url&&(/\/search(?:[/?]|$)|[?&](?:q|k)=/i.test(url)||new URL(url).hostname==='www.google.com'));
 return inspectShoppingObservation(observation,checks,{kind:'browser',bound:chrome&&Boolean(url)&&!nativeStore,url,ref:url,label:'Chrome',pageKind:search?'search-results':'page',holds:[
  ...(nativeStore?['Use the '+nativeStore+' Android app through phone_store_app. Website observations are not admitted for this retailer.']:[]),
  ...(!chrome?['The page is outside Chrome. Reopen it with the browser tool.']:[]),
  ...(!url?['The source address is not visible. Show the Chrome address bar before treating this as source-bound evidence.']:[]),
 ]});
}
export function inspectShoppingObservation(observation:BrowserObservation,checks:ShoppingChecks,source:ShoppingSourceContext){
 const nodes=observation.nodes||[],seen=new Set<string>();
 const lines=nodes.map(n=>(n.text||n.description||'').trim()).filter(text=>text&&!seen.has(text)&&Boolean(seen.add(text)));
 const text=lines.join('\n').slice(0,10000),url=source.url;
 const animatedDigits=lines.some(line=>/\b0,\s*1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7,\s*8,\s*9\b/.test(line));
 const prices:Price[]=[];
 const money=/(US\$|\bUSD\s*|\bINR\s*|\bRs\.?\s*|₹\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi;
 const priceLines=lines.map((line,index)=>{
  if(!animatedDigits&&/^(?:₹|\$|US\$|USD|INR|Rs\.?)$/.test(line)&&/^\d[\d,]*(?:\.\d{1,2})?$/.test(lines[index+1]||'')){
   const suffix=conditions.test(lines[index+2]||'')?' '+lines[index+2]:'';
   const prefix=references.test(lines[index-1]||'')||conditions.test(lines[index-1]||'')?lines[index-1]+' ':'';
   return prefix+line+' '+lines[index+1]+suffix;
  }
  const previous=lines[index-1]==='+'&&/\bGST\b/i.test(lines[index-2]||'')?lines[index-2]+' +':lines[index-1]||'';
  const unit=/^\/(?:pc|piece|unit)$|^per (?:piece|unit)$/i.test(lines[index+1]||'')?' '+lines[index+1]:'';
  return (!/(?:₹|\$|USD|INR)\s*\d/.test(previous)&&(references.test(previous)||conditions.test(previous))?previous+' '+line:line)+unit;
 });
 for(const line of priceLines){
  let previousEnd=0;
  for(const match of line.matchAll(money)){
   const value=match[2].replace(/,/g,'');
   if(!/^\d+(?:\.\d{1,2})?$/.test(value))continue;
   const [whole,fraction='']=value.split('.'),amountCents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
   if(!Number.isSafeInteger(amountCents)||amountCents<1||amountCents>200000000)continue;
   const currency=/₹|INR|Rs/i.test(match[1])?'INR':/USD|US\$/i.test(match[1])?'USD':'dollar-unspecified';
   const start=match.index??0,before=line.slice(Math.max(previousEnd,start-35),start),after=line.slice(start+match[0].length,start+match[0].length+55);
   // A condition belongs to this amount only when no later amount intervenes.
   const localAfter=after.split(/(?:₹|\$|USD|INR)\s*\d/)[0];
   const suffixCondition=conditions.test(localAfter)&&(localAfter.length===after.length||/^\s*(?:with|after|using|on|per|\/mo)\b/i.test(localAfter));
   const kind=conditions.test(before)||suffixCondition?'conditional':references.test(before)||/^\s+(?:off|\/pc|\/piece|\/unit|per piece|per unit)\b/i.test(localAfter)?'reference':'listed';
   previousEnd=start+match[0].length;
   const evidence=line.slice(Math.max(0,start-45),Math.min(line.length,start+match[0].length+65));
   if(!prices.some(p=>p.amountCents===amountCents&&p.currency===currency&&p.kind===kind))prices.push({amountCents,currency,kind,evidence});
   if(prices.length>=20)break;
  }
  if(prices.length>=20)break;
 }
 const listed=prices.filter(p=>p.kind==='listed');
 const regular=listed.length===1?listed[0]:null;
 const search=source.pageKind==='search-results'||source.pageKind==='unknown';
 const unavailable=/out of stock|currently unavailable|sold out|not available/i.test(text);
 const available=/\bin stock\b|available for delivery/i.test(text);
 const stock=available&&unavailable?'conflict':unavailable?'unavailable':available?'available':'unknown';
 const ram=capacity(text,'ram'),storage=capacity(text,'storage');
 const results:Array<{attribute:string;outcome:'supported'|'contradicted'|'unknown';evidence:string}>=[];
 if(checks.brand)results.push({attribute:'brand',outcome:text.toLowerCase().includes(checks.brand.toLowerCase())?'supported':'unknown',evidence:'Brand mention on the observed page; exact product identity still requires review.'});
 if(checks.budgetCents!==undefined)results.push({attribute:'regular-price budget',outcome:!regular||search||regular.currency!==checks.currency?'unknown':regular.amountCents<=checks.budgetCents?'supported':'contradicted',evidence:regular?.evidence||'No unique unconditional price on this product page.'});
 for(const [attribute,values,minimum] of [['RAM',ram,checks.minimumRamGB],['storage',storage,checks.minimumStorageGB]] as const){
  if(minimum!==undefined)results.push({attribute,outcome:values.length!==1||search?'unknown':values[0]>=minimum?'supported':'contradicted',evidence:values.length?values.join(', ')+' GB observed':'No explicit capacity in the visible text.'});
 }
 const blocked=challenge.test(text);
 if(!source.bound||blocked)for(const result of results)result.outcome='unknown';
 const holds=[
  ...source.holds,
  ...(blocked?['Access challenge or required sign-in. Stop and hand the page to the user.']:[]),
  ...(search?['Search results are discovery evidence. Open the exact product page to check its price and variant.']:[]),
  ...(stock==='conflict'||stock==='unavailable'?['Availability prevents a purchase recommendation.']:[]),
  ...(stock==='unknown'?['Availability was not established by the visible page.']:[]),
  ...(observation.nodes_truncated?['The page observation was truncated. Inspect the selected product details before a purchase recommendation.']:[]),
  ...(listed.length>1?['Several unconditional amounts are visible. Confirm the selected product and variant.']:[]),
  ...(animatedDigits?['Animated digit-wheel fragments were excluded; inspect a stable complete price.']:[]),
  ...results.filter(r=>r.outcome!=='supported').map(r=>r.attribute+' is '+r.outcome+'.'),
 ];
 const navigationTargets=nodes.filter(n=>n.clickable&&n.enabled!==false&&(n.text||n.description)).slice(0,20).map(n=>({selector:n.text?{text:n.text.slice(0,300)}:{description:n.description!.slice(0,300)}}));
 return {snapshot_id:observation.snapshot_id,observedAt:observation.captured_at_ms,sourceUrl:url,sourceRef:source.ref,sourceKind:source.kind,sourceLabel:source.label,sourcePackage:observation.package_name,browser:source.kind==='browser'?observation.package_name:undefined,pageKind:source.pageKind,navigationTargets,
  sourceBound:source.bound&&!blocked,blocked,prices,regularPrice:search||!source.bound||blocked?null:regular,offers:lines.filter(line=>conditions.test(line)).slice(0,8).map(line=>line.slice(0,220)),
  stock,capacitiesGB:{ram,storage},checks:results,holds,visibleText:text,truncated:Boolean(observation.nodes_truncated)||lines.join('\n').length>10000,
  note:'Observed page evidence only. Offers require eligibility checks. Seller cart, delivered total and purchase availability are not verified.'};
}

type Execute=(name:string,args:Record<string,unknown>)=>Promise<any>;
type BrowserAction={kind:'click';selector:{text?:string;description?:string}}|{kind:'scroll';direction:'up'|'down'};
function unwrap(result:any){
 const block=result.content?.find((part:any)=>part.type==='text');
 if(!block)return {isError:true,code:'BROWSER_READ_FAILED',message:'No native page observation returned.'};
 try{return JSON.parse(block.text);}catch{return {isError:true,code:'BROWSER_READ_FAILED',message:'The page observation was invalid.'};}
}
export async function browsePage(execute:Execute,args:{url?:string;action?:BrowserAction;checks?:ShoppingChecks;display_target?:'virtual'|'physical'},callId:string,signal?:AbortSignal){
 const target={display_target:args.display_target||'virtual'};
 let operationPrefix:string|undefined;
 let beforeAction:ReturnType<typeof inspectBrowserObservation>|undefined,actionReceipt:string|undefined;
 if(args.url&&args.action)throw Error('Choose a URL or a browser action in one call.');
 if(args.url&&nativeStoreForUrl(args.url))return {isError:true,code:'NATIVE_STORE_REQUIRED',store:nativeStoreForUrl(args.url),message:'Use phone_store_app for Amazon and Flipkart. No browser navigation was dispatched.'};
 if(args.url||args.action){
  const capabilities=unwrap(await execute('phone_capabilities',{}));
  if(capabilities.isError)return capabilities;
  operationPrefix=capabilities.operation_prefix;
 }
 const suffix=createHash('sha256').update(callId).digest('hex').slice(0,20);
 if(args.url){
  const url=new URL(args.url);
  if(url.protocol!=='https:'||url.username||url.password||args.url.length>2048)throw Error('Browser research requires an HTTPS URL without credentials.');
  const launch=unwrap(await execute('phone_open_url',{...target,url:url.href,browser:'chrome',operation_id:operationPrefix+'_browse_'+suffix}));
  if(launch.isError)return launch;
 }
 if(args.action){
  if(args.action.kind==='scroll'&&!['up','down'].includes(args.action.direction))throw Error('Browser scroll requires direction up or down.');
  if(args.action.kind==='click'){
   const label=args.action.selector?.text||args.action.selector?.description||'';
   if(!label.trim()||/buy now|place order|pay now|checkout|add to (?:cart|bag)|purchase|proceed to payment/i.test(label))throw Error('Browser research clicks require an observed navigation label and cannot operate purchase controls.');
  }
  const fresh=unwrap(await execute('phone_observe',{...target,max_nodes:180,include_image:false}));
  if(fresh.isError)return fresh;
  beforeAction=inspectBrowserObservation(fresh,args.checks);
  if(!beforeAction.sourceBound)return beforeAction;
  actionReceipt=operationPrefix+'_browseact_'+suffix;
  let action:Record<string,unknown>=args.action;
  if(args.action.kind==='scroll'){
   const width=fresh.coordinate_width,height=fresh.coordinate_height;
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64)throw Error('A fresh viewport is required for browser scrolling.');
   const down=args.action.direction==='down';
   action={kind:'swipe',x:Math.round(width*.5),y:Math.round(height*(down ? 0.75 : 0.3)),end_x:Math.round(width*.5),end_y:Math.round(height*(down ? 0.3 : 0.75)),duration_ms:450};
  }
  const result=unwrap(await execute('phone_act',{...target,...action,snapshot_id:fresh.snapshot_id,operation_id:actionReceipt}));
  if(result.isError)return {...result,operation_id:actionReceipt};
 }
 let observation:BrowserObservation;
 for(let attempt=0;;attempt++){
  const result=unwrap(await execute('phone_observe',{...target,max_nodes:180,include_image:false}));
  if(result.isError)return result;
  observation=result;
  const report=inspectBrowserObservation(observation,args.checks);
  const addressMatches=!args.url||Boolean(report.sourceUrl&&report.sourceUrl.replace(/\/$/,'')===new URL(args.url).href.replace(/\/$/,''));
  const substantive=report.visibleText.split('\n').filter(line=>line.length>20).length;
  const actionChanged=!beforeAction||beforeAction.sourceUrl!==report.sourceUrl||beforeAction.visibleText!==report.visibleText;
  if(report.blocked||report.browser!=='com.android.chrome'||(substantive>=3&&addressMatches&&(actionChanged||args.action?.kind==='scroll'))||attempt>=4){
   if(args.url&&!addressMatches)report.holds.push('Navigation did not confirm the requested address. The observed URL may be a redirect or an earlier page. Verify it before attributing this evidence to the requested product.');
   if(!actionChanged&&args.action?.kind==='click')report.holds.push('The click was dispatched but a changed page was not observed. Inspect this operation before repeating it.');
   return {...report,...target,...(operationPrefix?{operation_prefix:operationPrefix}:{}),...(actionReceipt?{operation_id:actionReceipt,actionObservedChange:actionChanged}:{}),...(args.url?{requestedUrl:args.url,navigationStatus:addressMatches?'address-matches':'unconfirmed'}:{})};
  }
  await new Promise<void>((resolve,reject)=>{
   const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
   const timer=setTimeout(done,700),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('Browser read cancelled.'));};
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
 }
}
