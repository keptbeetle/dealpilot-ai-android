import {createHash} from 'node:crypto';
import {inspectShoppingObservation,type BrowserObservation,type ObservationNode,type ShoppingChecks} from './browser.js';
import {STORE_APPS,nativeStoreForUrl,type StoreName} from './store-policy.js';
export {STORE_APPS} from './store-policy.js';
export type {StoreName} from './store-policy.js';

type Selector={resource_id?:string;text?:string;description?:string;bounds?:{left:number;top:number;right:number;bottom:number}};
type StoreAction={kind:'click';selector:Selector}|{kind:'scroll';direction:'up'|'down'}|{kind:'back'};
export type StoreArgs={store:StoreName;query?:string;url?:string;action?:StoreAction;checks?:ShoppingChecks;display_target?:'virtual'|'physical'};
export type StoreContext={query?:string;selectedLabel?:string;selectedFromSnapshot?:string;productPage?:{label:string;at:number;snapshot:string}};
type Execute=(name:string,args:Record<string,unknown>)=>Promise<any>;
const forbidden=/add to (?:cart|bag|basket)|buy now|place order|pay now|checkout|purchase|subscribe and save|subscribe & save|^cart$|^orders$|^your account$|^sign in$|^log ?in$/i;
const searchLabel=/search|rs_search|search_src|search_box|search_edit/i;
const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
 const timer=setTimeout(done,ms),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('Store navigation cancelled.'));};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
});
function unwrap(result:any){try{return JSON.parse(result.content.find((c:any)=>c.type==='text').text);}catch{return {isError:true,code:'APP_OBSERVATION_FAILED',message:'The native tool did not return a usable result.'};}}
function nodeLabel(node:ObservationNode){return (node.text||node.description||'').trim();}
function sameBounds(a:ObservationNode['bounds'],b:ObservationNode['bounds']){return Boolean(a&&b&&(['left','top','right','bottom'] as const).every(key=>a[key]===b[key]));}
function selectorFor(node:ObservationNode,nodes:ObservationNode[]):Selector{
 for(const property of ['resource_id','description','text'] as const){const value=node[property];if(value&&value.length<(property==='resource_id'?240:400)&&nodes.filter(n=>n[property]===value).length===1)return {[property]:value};}
 if(node.text&&node.description&&node.text.length<400&&node.description.length<400&&nodes.filter(n=>n.text===node.text&&n.description===node.description).length===1)return {text:node.text,description:node.description};
 if(node.bounds){
  for(const property of ['description','text'] as const){const value=node[property];if(value&&value.length<400&&nodes.filter(n=>n[property]===value).every(n=>sameBounds(n.bounds,node.bounds)))return {[property]:value,bounds:node.bounds};}
 }
 return {};
}
function matches(node:ObservationNode,selector:Selector){return Object.entries(selector).length>0&&Object.entries(selector).every(([key,value])=>value&&(key==='bounds'?sameBounds(node.bounds,value as Selector['bounds']):node[key as keyof Selector]===value));}
function explicitProductTitle(nodes:ObservationNode[],selected?:string){
 const titleLabel=(text:string)=>text.replace(/\.?\s*View media content in full screen\.?$/i,'').trim();
 const candidates=nodes.filter(n=>/product.?title|product.?name|pdp.?title/i.test(n.resource_id||'')).map(nodeLabel).map(titleLabel).filter(t=>t.length>8);
 if(candidates.length)return candidates[0].slice(0,400);
 if(!selected)return undefined;
 const words=[...new Set(selected.toLowerCase().replace(/₹[\d,.]+/g,'').split(/[^a-z0-9-]+/).filter(w=>w.length>2&&!/^(?:sponsored|reviews|ratings|stars|price|with|free|delivery|offer|from)$/.test(w)))].slice(0,14);
 const scored=nodes.map(nodeLabel).map(titleLabel).filter(t=>t.length>10&&t.length<=400&&!forbidden.test(t)).map(text=>({text,score:words.filter(w=>text.toLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score||a.text.length-b.text.length);
 return words.length>=2&&scored[0]?.score>=Math.min(4,words.length)?scored[0].text:undefined;
}
export function inspectStoreObservation(observation:BrowserObservation,store:StoreName,context:StoreContext={},checks:ShoppingChecks={}){
 const definition=STORE_APPS[store],nodes=(observation.nodes||[]).filter(node=>{
  const b=node.bounds,w=observation.coordinate_width,h=observation.coordinate_height;
  return !b||!w||!h||b.right>b.left&&b.bottom>b.top&&b.right>0&&b.bottom>0&&b.left<w&&b.top<h;
 });
 const packageAccepted=(definition.packages as readonly string[]).includes(observation.package_name||'');
 const texts=nodes.map(nodeLabel).filter(Boolean),text=texts.join('\n');
 const searchResults=texts.some(t=>/^(?:all filters icon|prime filter,.*|filters?|sort(?: by)?|sort & filter|filter & sort|results for .+|\d[\d,]* results?)$/i.test(t));
 const productControls=texts.some(t=>/^(?:add to (?:cart|bag)|buy now|buy it now|select options)$/i.test(t));
 const freshTitle=explicitProductTitle(nodes,context.selectedLabel);
 const prior=context.productPage;
 const continued=Boolean(prior&&observation.captured_at_ms&&observation.captured_at_ms>=prior.at&&observation.captured_at_ms-prior.at<=15*60000&&(!freshTitle||freshTitle===prior.label));
 const title=freshTitle||(continued?prior?.label:undefined);
 const productDetails=texts.some(t=>/^(?:visit the .+ store|about this item|product details|buy new)$/i.test(t));
 const product=Boolean(title&&(productControls||productDetails||continued)&&!searchResults);
 const pageKind=product?'product-page':searchResults?'search-results':context.selectedLabel?'unknown':context.query?'search-results':'unknown';
 const proof=Boolean(packageAccepted&&observation.snapshot_id&&observation.captured_at_ms);
 const ref=proof?'android-app://'+observation.package_name+'/observations/'+encodeURIComponent(observation.snapshot_id!):null;
 const report=inspectShoppingObservation({...observation,nodes},checks,{kind:'android-app',bound:proof,url:null,ref,label:definition.label,pageKind,holds:[
  ...(!packageAccepted?['The observed screen is outside the selected store app. No browser fallback was used.']:[]),
  ...(!proof?['A fresh native app snapshot is required to bind this observation.']:[]),
  ...(!product?['Open an individual product inside this app before attributing its price or specifications.']:['Exact seller, selected variant and offer eligibility remain unverified.']),
 ]});
 return {...report,store,listingTitle:title,query:context.query,identityObservation:continued?{snapshot_id:prior!.snapshot,observedAt:prior!.at}:undefined,selectedFrom:context.selectedLabel?{label:context.selectedLabel,snapshot_id:context.selectedFromSnapshot}:undefined,
  navigationTargets:nodes.filter(n=>n.clickable&&n.enabled!==false&&nodeLabel(n)&&!forbidden.test(nodeLabel(n))&&!/^ref=/i.test(nodeLabel(n))).map(n=>({label:nodeLabel(n).slice(0,400),selector:selectorFor(n,nodes)})).filter(target=>Object.keys(target.selector).length>0).slice(0,30),
  note:'Observed native app evidence, not a web-page capture. No product URL or SKU is invented. Search cards are discovery only. Seller, variant, offers and delivered total still require review.'};
}

export async function navigateStoreApp(execute:Execute,args:StoreArgs,callId:string,signal?:AbortSignal,context:StoreContext={}){
 if(signal?.aborted)throw Error('Store navigation cancelled.');
 if(!Object.hasOwn(STORE_APPS,args.store))throw Error('Choose the installed Amazon or Flipkart app.');
 if(args.action&&!['click','scroll','back'].includes(args.action.kind))throw Error('Unsupported native store action.');
 // Only an explicit scroll can continue an already observed product identity.
 // New navigation, searches and unrelated inspections must prove identity again.
 if(args.action?.kind!=='scroll')context.productPage=undefined;
 if(args.query!==undefined&&(!args.query.trim()||args.query.length>180))throw Error('Store search requires 1 to 180 characters.');
 // Search+action is a bounded sequence: finish and observe the search before
 // validating the action against its actual results. A URL remains standalone.
 if(args.url&&(args.query||args.action))throw Error('Choose a product link or search/navigation in one call.');
 if(args.url){const url=new URL(args.url);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||args.url.length>2048||nativeStoreForUrl(args.url)!==args.store||/\/(?:cart|checkout|payment|orders?|account)(?:\/|$)/i.test(url.pathname))throw Error('Use an ordinary HTTPS product/search link for the selected store.');}
 const definition=STORE_APPS[args.store],target={display_target:args.display_target||'physical'};
 const caps=unwrap(await execute('phone_capabilities',{}));if(caps.isError)return caps;
 const inventory=unwrap(await execute('phone_apps',{}));if(inventory.isError)return inventory;
 const pkg=definition.packages.find(pkg=>inventory.apps?.some((app:any)=>app.package_name===pkg));
 if(!pkg)return {isError:true,code:'STORE_APP_NOT_INSTALLED',store:args.store,message:definition.label+' is not installed or visible. Install or enable it to use native navigation. No web fallback was used.'};
 const base=createHash('sha256').update(callId).digest('hex').slice(0,16);let step=0;
 const operation=()=>caps.operation_prefix+'_store_'+base+'_'+(++step);
 const observe=async()=>unwrap(await execute('phone_observe',{...target,max_nodes:500,compact:true,include_image:false}));
 const read=async(requirePageContent=false,requireSearch=false)=>{
  let current:any;
  const attempts=requireSearch?32:16;
  for(let attempt=0;attempt<attempts;attempt++){
   current=await observe();if(current.isError){if(current.code==='NOT_READY'&&attempt<attempts-1){await wait(500,signal);continue;}return current;}
   const report=inspectStoreObservation(current,args.store,context,args.checks);
   if(report.blocked)return current;
   const meaningful=(current.nodes||[]).filter((n:ObservationNode)=>nodeLabel(n).length>2&&!/placeholder/i.test(nodeLabel(n))).length;
   const body=report.visibleText.split('\n').filter(t=>t.length>2&&!/^(?:back|search(?: amazon\.in)?|scan it|home(?: tab.*)?|your amazon\.com tab.*|you|wallet(?: tab.*)?|cart(?: \d.*)?|browse menu tab.*|menu)$/i.test(t));
   const searchReady=!requireSearch||(current.nodes||[]).some((n:ObservationNode)=>n.enabled!==false&&(n.clickable||n.editable)&&searchLabel.test([n.resource_id,n.text,n.description].join(' ')))||(current.nodes||[]).some((n:ObservationNode)=>/^skip sign in$|^skip for now$/i.test(nodeLabel(n)));
   if(current.package_name===pkg&&meaningful>=4&&searchReady&&(!requirePageContent||body.length>=3))return current;
   await wait(500,signal);
  }
  return current;
 };
 const recoveries:Array<{failedOperation:string;recoveryOperation:string}>=[];
 const act=async(observation:BrowserObservation,action:Record<string,unknown>)=>{
  if(signal?.aborted)throw Error('Store navigation cancelled.');
  if(action.selector&&Object.keys(action.selector).length===0)return {isError:true,code:'APP_TARGET_AMBIGUOUS',message:'No unique complete native selector was observed. Truncated or duplicate labels cannot be clicked.'};
  const op=operation();let result=unwrap(await execute('phone_act',{...target,...action,snapshot_id:observation.snapshot_id,operation_id:op}));
  if(result.isError&&result.code==='STALE_OBSERVATION'&&result.dispatch_status==='not_dispatched'){
   const fresh=await observe();
   const uniqueSelector=action.selector&&(fresh.nodes||[]).filter((n:ObservationNode)=>matches(n,action.selector as Selector)).length===1;
   const sameViewport=action.kind==='swipe'&&fresh.coordinate_width===observation.coordinate_width&&fresh.coordinate_height===observation.coordinate_height;
   if(!fresh.isError&&fresh.package_name===pkg&&!inspectStoreObservation(fresh,args.store,context,args.checks).blocked&&(uniqueSelector||sameViewport)){
    const recovery=operation();recoveries.push({failedOperation:op,recoveryOperation:recovery});
    result=unwrap(await execute('phone_act',{...target,...action,snapshot_id:fresh.snapshot_id,operation_id:recovery}));
    return result.isError?{...result,operation_id:recovery}:result;
   }
  }
  return result.isError?{...result,operation_id:op}:result;
 };
 const reportError=(message:string,code='STORE_APP_NOT_READY')=>({isError:true,code,store:args.store,message:message+' No browser fallback was used.'});
 let current:any;
 let continuedQuery=false;
 if(args.action&&args.query&&context.query===args.query.trim()){
  const observed=await observe();
  if(!observed.isError&&observed.package_name===pkg){current=observed;args={...args,query:undefined};continuedQuery=true;}
 }
 if(args.query||args.url){
  context.query=args.query?.trim();context.selectedLabel=undefined;context.selectedFromSnapshot=undefined;
  const opened=unwrap(await execute(args.url?'phone_open_url':'phone_open_app',{...target,...(args.url?{url:args.url,app_package:pkg}:{package_name:pkg}),operation_id:operation()}));if(opened.isError)return opened;
  current=await read(false,Boolean(args.query));
 }else if(!continuedQuery)current=await read();
 if(current.isError)return current;
 if(current.package_name!==pkg)return reportError('The observed screen did not match the requested store and display.','PRIVATE_STORE_SESSION_UNAVAILABLE');
 if(inspectStoreObservation(current,args.store,context,args.checks).blocked)return inspectStoreObservation(current,args.store,context,args.checks);
 if(args.query){
  // Only an explicit guest affordance can dismiss optional sign-in. Never enter credentials.
  const skip=current.nodes?.find((n:ObservationNode)=>n.clickable&&/^skip sign in$|^skip for now$/i.test(nodeLabel(n)));
  if(skip){const result=await act(current,{kind:'click',selector:selectorFor(skip,current.nodes)});if(result.isError)return result;await wait(600,signal);current=await read();}
  if(current.isError)return current;
  if(current.package_name!==pkg)return reportError('Optional guest navigation left the selected app.');
  let nodes:ObservationNode[]=current.nodes||[];
  const search=nodes.find(n=>n.enabled!==false&&searchLabel.test([n.resource_id,n.text,n.description].join(' '))&&!/voice|camera|barcode|image/i.test([n.text,n.description].join(' '))&&(n.clickable||n.editable));
  if(!search)return reportError('The app search control is not exposed. Sign-in, onboarding or an app-layout change may require user attention.','APP_SEARCH_UNAVAILABLE');
  const clicked=await act(current,{kind:'click',selector:selectorFor(search,nodes)});if(clicked.isError)return clicked;
  await wait(350,signal);current=await read();if(current.isError)return current;
  if(current.package_name!==pkg)return reportError('Search opened outside the selected app.');
  nodes=current.nodes||[];
  const field=nodes.find(n=>n.editable&&n.enabled!==false&&searchLabel.test([n.resource_id,n.text,n.description].join(' ')));
  if(!field)return reportError('An editable store search field was not observed.','APP_SEARCH_UNAVAILABLE');
  const fieldSelector=selectorFor(field,nodes);
  const typed=await act(current,{kind:'type',selector:fieldSelector,text:context.query,replace:true});if(typed.isError)return typed;
  current=await observe();if(current.isError)return current;
  if(current.package_name!==pkg)return reportError('The app changed while typing the search.');
  const input=(current.nodes||[]).find((n:ObservationNode)=>n.editable&&n.text===context.query);
  if(!input)return reportError('The search text was not confirmed in the app. No submission was attempted.');
  const submitted=await act(current,{kind:'key',key:'enter',selector:selectorFor(input,current.nodes)});if(submitted.isError)return submitted;
  await wait(750,signal);current=await read(true);
 }
 if(args.action){
  const before=inspectStoreObservation(current,args.store,context,args.checks);if(!before.sourceBound)return before;
  let action:Record<string,unknown>;
  if(args.action.kind==='click'){
   const selector=args.action.selector||{},matchesFound:ObservationNode[]=(current.nodes||[]).filter((n:ObservationNode)=>matches(n,selector));
   const samePosition=args.action.selector?.bounds&&matchesFound.length>1&&matchesFound.every(n=>nodeLabel(n)===nodeLabel(matchesFound[0]));
   if(matchesFound.length!==1&&!samePosition)return reportError('The observed app target must match exactly one current node or one identical label at the same position.','APP_TARGET_AMBIGUOUS');
   const node=matchesFound[0],label=nodeLabel(node);if(!label||forbidden.test(label))return reportError('Store research cannot operate purchase or account controls.','RESEARCH_ACTION_BLOCKED');
   if(before.pageKind!=='product-page'){context.selectedLabel=label;context.selectedFromSnapshot=current.snapshot_id;}
   if(selector.bounds){
    const b=selector.bounds,w=current.coordinate_width,h=current.coordinate_height;
    if(!w||!h||b.right<=b.left||b.bottom<=b.top||b.left>=w||b.top>=h||b.right<=0||b.bottom<=0||(Math.min(w,b.right)-Math.max(0,b.left))*(Math.min(h,b.bottom)-Math.max(0,b.top))>w*h*.3)return reportError('The current label does not establish a bounded visible click target.','APP_TARGET_AMBIGUOUS');
    action={kind:'click',x:Math.round((Math.max(0,b.left)+Math.min(w,b.right))/2),y:Math.round((Math.max(0,b.top)+Math.min(h,b.bottom))/2)};
   }else action={kind:'click',selector:selectorFor(node,current.nodes)};
  }else if(args.action.kind==='scroll'){
   const direction=args.action.direction||'down';if(!['up','down'].includes(direction))throw Error('Native store scrolling requires up or down.');
   const w=current.coordinate_width,h=current.coordinate_height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<64||h<64)return reportError('A fresh viewport is required for scrolling.');
   const down=direction==='down';action={kind:'swipe',x:Math.round(w*.5),y:Math.round(h*(down?0.75:0.3)),end_x:Math.round(w*.5),end_y:Math.round(h*(down?0.3:0.75)),duration_ms:450};
  }else{context.selectedLabel=undefined;context.selectedFromSnapshot=undefined;action={kind:'key',key:'back'};}
  const result=await act(current,action);if(result.isError)return result;
  await wait(550,signal);current=await read(args.action.kind==='click');
 }
 if(current.isError)return current;
 if(current.package_name!==pkg)return reportError('The observed screen left the selected store.','PRIVATE_STORE_SESSION_UNAVAILABLE');
 const report=inspectStoreObservation(current,args.store,context,args.checks);
 if(report.pageKind==='product-page'&&report.listingTitle&&report.sourceBound&&!context.productPage)context.productPage={label:report.listingTitle,at:current.captured_at_ms,snapshot:current.snapshot_id};
 if(report.pageKind!=='product-page')context.productPage=undefined;
 return {...report,...target,operation_prefix:caps.operation_prefix,preDispatchRecoveries:recoveries};
}
