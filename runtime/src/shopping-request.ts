import type {ShoppingChecks} from './browser.js';
export type HeadphoneFit='over-ear'|'on-ear'|'in-ear';
export type ShoppingRequest={version:1;revision:number;checks:ShoppingChecks;newOnly:boolean;preferredBrands:string[];requiredBrands?:string[];category?:'smartphone'|'laptop'|'headphones';headphoneFits?:HeadphoneFit[];issues:string[]};
const brands=['Samsung','Motorola','Sony','JBL','ASUS','Lenovo','Dell','HP','Acer','Apple','Bose','Anker','Soundcore','OnePlus','Xiaomi','Realme','Nothing','Google','Vivo','Oppo'];
export function restoreShoppingRequest(value:any):ShoppingRequest|undefined{
 if(!value||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!value.checks||typeof value.newOnly!=='boolean'||!Array.isArray(value.preferredBrands)||!Array.isArray(value.issues))return;
 const checks:ShoppingChecks={};
 if(value.checks.currency!==undefined){if(!['INR','USD'].includes(value.checks.currency))return;checks.currency=value.checks.currency;}
 for(const field of ['budgetCents','minimumRamGB','minimumStorageGB'] as const)if(value.checks[field]!==undefined){if(!Number.isSafeInteger(value.checks[field])||value.checks[field]<1||value.checks[field]>200000000)return;checks[field]=value.checks[field];}
 if(value.checks.brand!==undefined){if(typeof value.checks.brand!=='string'||value.checks.brand.length>80)return;checks.brand=value.checks.brand;}
 if(value.preferredBrands.some((x:any)=>typeof x!=='string'||x.length>80)||value.issues.some((x:any)=>typeof x!=='string'||x.length>300))return;
 if(value.requiredBrands!==undefined&&(!Array.isArray(value.requiredBrands)||!value.requiredBrands.length||value.requiredBrands.length>12||value.requiredBrands.some((x:any)=>typeof x!=='string'||!x.trim()||x.length>80)))return;
 if(value.headphoneFits!==undefined&&(!Array.isArray(value.headphoneFits)||!value.headphoneFits.length||value.headphoneFits.length>3||new Set(value.headphoneFits).size!==value.headphoneFits.length||value.headphoneFits.some((x:any)=>!['over-ear','on-ear','in-ear'].includes(x))))return;
 return {version:1,revision:value.revision,checks,newOnly:value.newOnly,preferredBrands:value.preferredBrands.slice(0,12),...(value.requiredBrands?{requiredBrands:[...value.requiredBrands]}:{}),category:['smartphone','laptop','headphones'].includes(value.category)?value.category:undefined,...(value.headphoneFits?{headphoneFits:[...value.headphoneFits]}:{}),issues:value.issues.slice(0,8)};
}
/** Only direct user text updates these constraints. Product pages and model plans never do. */
export function updateShoppingRequest(previous:ShoppingRequest|undefined,message:string):ShoppingRequest|undefined{
 const category=/\b(?:smartphones?|(?:android |mobile )?phones?)\b/i.test(message)?'smartphone':/\blaptop/i.test(message)?'laptop':/headphones?|earbuds?|headset/i.test(message)?'headphones':undefined;
 const reset=/\bstart over\b|\bforget (?:the )?previous\b/i.test(message)||category&&previous?.category&&category!==previous.category;
 let request:ShoppingRequest=previous&&!reset?structuredClone(previous):{version:1,revision:0,checks:{},newOnly:false,preferredBrands:[],issues:[]};
 if(!previous&&!category&&!/\b(?:buy|shop|budget|find|need|looking for)\b/i.test(message))return;
 request.revision++;if(category)request.category=category;
 if(request.category==='headphones'){
   // Mentioning another style as a contrast does not authorize it. An explicit
  // must/only requirement in a clause overrides descriptive comparisons in
  // later clauses (e.g. 'must be over-ear; check over-ear versus on-ear').
  const readFits=(text:string):HeadphoneFit[]=>{
   const fits:HeadphoneFit[]=[];
   for(const [fit,pattern] of [['over-ear',/\b(?:over[- ]ear|around[- ]ear|circumaural)\b/i],['on-ear',/\b(?:on[- ]ear|supra[- ]aural)\b/i],['in-ear',/\b(?:in[- ]ear|intra[- ]aural)\b/i]] as const){
    if(pattern.test(text)&&!new RegExp('\\b(?:no|not|without|avoid|exclude)\\s+(?:any\\s+)?'+fit.replace('-','[- ]')+'\\b','i').test(text))fits.push(fit);
   }
   return fits;
  };
  const mandatory=message.split(/[.!?;]/).filter(part=>/\b(?:must|only|require|strictly)\b/i.test(part)).flatMap(readFits);
  const fits=[...new Set(mandatory.length?mandatory:readFits(message))];
  if(fits.length)request.headphoneFits=fits;
  if(/\b(?:any|either)\s+(?:headphone\s+)?(?:fit|style|form factor)\b|\b(?:fit|style|form factor)\s+(?:does(?:n.t| not)|isn.t)\s+matter\b/i.test(message))delete request.headphoneFits;
 }
 const inr=/₹|\bINR\b|\bRs\.?\s*\d|\brupees\b/i.test(message),usd=/\$|\bUSD\b|\bdollars?\b/i.test(message);
 if(inr||usd)request.issues=request.issues.filter(x=>!x.startsWith('Currency'));
 if(inr&&usd)request.issues.push('Currency is ambiguous: multiple currencies were stated.');
 else if(inr||usd)request.checks.currency=inr?'INR':'USD';
 const budgetPattern=/\b(?:under|below|up to|maximum(?: budget)?(?: is)?|max(?:imum)? budget(?: is)?|budget(?: is| of| to)?|at most)\s*[:=]?\s*(?:(?:Rs\.?|INR|USD)\s*|[₹$]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|lakh|lakhs)?\b/gi;
 const amounts=[...message.matchAll(budgetPattern)].map(m=>Math.round(Number(m[1].replace(/,/g,''))*(m[2]?.toLowerCase()==='k'?1000:/lakh/i.test(m[2]||'')?100000:1)*100));
 if(amounts.length)request.issues=request.issues.filter(x=>!x.startsWith('Budget'));
 if(new Set(amounts).size>1)request.issues.push('Budget is ambiguous: multiple limits were stated.');
 else if(amounts.length&&Number.isSafeInteger(amounts[0])&&amounts[0]>0&&amounts[0]<=200000000)request.checks.budgetCents=amounts[0];
 const capacity=(field:'minimumRamGB'|'minimumStorageGB',noun:string)=>{
  const matches=[...message.matchAll(new RegExp('\\b(\\d+(?:\\.\\d+)?)\\s*(GB|TB)\\s*(?:of\\s+)?'+noun,'gi')),...message.matchAll(new RegExp(noun+'\\s*(?:of|at least|minimum|to|is)?\\s*(\\d+(?:\\.\\d+)?)\\s*(GB|TB)','gi'))];
  const values=[...new Set(matches.map(m=>Number(m[1])*(m[2].toUpperCase()==='TB'?1024:1)))];
  if(values.length)request.issues=request.issues.filter(x=>!x.startsWith('Conflicting '+field));
  if(values.length===1)request.checks[field]=values[0];else if(values.length>1)request.issues.push('Conflicting '+field+' requirements.');
 };
 capacity('minimumRamGB','(?:RAM|memory)\\b');capacity('minimumStorageGB','(?:storage|SSD|ROM)\\b');
 if(request.category==='smartphone'&&!/\bRAM\b/i.test(message)){
  const values=[...message.matchAll(/\b(\d+(?:\.\d+)?)\s*(GB|TB)\b/gi)];if(values.length===1)request.checks.minimumStorageGB=Number(values[0][1])*(values[0][2].toUpperCase()==='TB'?1024:1);
 }
 if(/\bnew(?: phones?| smartphones?| laptops?| headphones?|earbuds?| products?| items?)? only\b|\bonly new\b|\bnew\s+(?:(?:wireless|bluetooth|over[- ]ear|on[- ]ear|noise[- ]cancelling|android|gaming)\s+){0,4}(?:smartphones?|phones?|laptops?|headphones?|headsets?|earbuds?)\b|\bno (?:used|refurbished|renewed)\b|\b(?:both|all|each|every)\s+(?:(?:must|should)\s+be\s+|are\s+)?(?:brand[- ]?)?new\b|\b(?:must|should)\s+be\s+(?:brand[- ]?)?new\b|\b(?:brand[- ]?)?new\s+(?:condition|products?|items?|models?|listings?)\b/i.test(message))request.newOnly=true;
 if(/\b(?:used|refurbished|renewed) (?:is |are )?(?:okay|ok|allowed)\b/i.test(message))request.newOnly=false;
 const named=brands.filter(brand=>new RegExp('\\b'+brand+'\\b','i').test(message));
 if(named.length&&/\bprefer|preferred|ideally/i.test(message)){
  request.preferredBrands=named;
  if(/\b(?:just|only) preferred\b|\bother brands (?:are )?(?:okay|ok|allowed)\b/i.test(message)){delete request.checks.brand;delete request.requiredBrands;}
 }
 const required=named.filter(brand=>new RegExp('(?:only(?: want(?: to)?(?: look for)?| show| consider| look(?:ing)? for| search(?:ing)? for)?|must be)\\s+'+brand+'\\b|\\b'+brand+'\\s+only\\b','i').test(message));
 if(required.length){
  // One explicit "only A or B" clause is a union. An unrelated preferred brand is not included.
  const alternatives=message.match(/\bonly\s+([A-Za-z]+(?:\s+(?:or|and)\s+[A-Za-z]+)+)\b/i)?.[1];
  const allowed=alternatives?named.filter(brand=>new RegExp('\\b'+brand+'\\b','i').test(alternatives)):required;
  if(allowed.length===1){request.checks.brand=allowed[0];delete request.requiredBrands;}
  else{request.requiredBrands=allowed;delete request.checks.brand;}
 }
 if(/\bany brand\b|\bremove.*brand/i.test(message)){delete request.checks.brand;delete request.requiredBrands;}
 return request;
}
