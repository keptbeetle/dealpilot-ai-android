import {nativeStoreForPackage} from './store-policy.js';
const fields=['snapshot_id','observedAt','sourceBound','sourceKind','sourcePackage','sourceRef','sourceUrl','sourceLabel','store','pageKind','listingTitle','selectedFrom','prices','regularPrice','capacitiesGB','stock','visibleText','truncated','blocked','continuity'] as const;
function valid(r:any){return r&&r.sourceBound===true&&!r.blocked&&r.sourceKind==='android-app'&&nativeStoreForPackage(r.sourcePackage)&&r.pageKind==='product-page'&&typeof r.listingTitle==='string'&&r.listingTitle.length>3&&r.listingTitle.length<=400&&typeof r.snapshot_id==='string'&&r.snapshot_id.length<=200&&r.sourceRef==='android-app://'+r.sourcePackage+'/observations/'+encodeURIComponent(r.snapshot_id)&&Number.isSafeInteger(r.observedAt)&&typeof r.continuity?.chainId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(r.continuity.chainId);}
const scope=(r:any)=>r.sourcePackage+'|'+r.continuity.chainId+'|'+r.listingTitle;
function dimensions(r:any){const t=String(r.visibleText||'');return {colour:t.match(/Selected Colou?r\s*(?:is|:)?\s*([^\n.]{1,100})/i)?.[1]?.trim(),size:t.match(/Selected (?:Size|Capacity)\s*(?:is|:)?\s*([^\n.]{1,100})/i)?.[1]?.trim(),seller:t.match(/\bSold by\s*:?\s*([^\n]{2,100})/i)?.[1]?.trim(),location:t.match(/\bDeliver(?:ing)? to\s*:?\s*([^\n]{2,100})/i)?.[1]?.trim()};}
function clean(r:any){const copy:any={};for(const f of fields)if(r[f]!==undefined)copy[f]=structuredClone(r[f]);if(String(copy.visibleText||'').length>4000){copy.visibleText=copy.visibleText.slice(0,4000);copy.truncated=true;}copy.prices=(Array.isArray(copy.prices)?copy.prices:[]).filter((p:any)=>p&&Number.isSafeInteger(p.amountCents)&&p.amountCents>0&&p.amountCents<=200000000&&['INR','USD','dollar-unspecified'].includes(p.currency)&&['listed','reference','conditional'].includes(p.kind)).slice(0,20).map((p:any)=>({...p,evidence:String(p.evidence||'').slice(0,240)}));return copy;}
/** Host-owned continuity only. Names alone never join unrelated visits. */
export class OfferEvidenceLedger {
 private entries=new Map<string,any[]>();
 constructor(saved?:any){if(saved?.version===1&&Array.isArray(saved.entries))for(const entry of saved.entries.slice(-12)){if(typeof entry?.scope==='string'&&Array.isArray(entry.frames)&&entry.frames.length&&entry.frames.every((r:any)=>valid(r)&&scope(r)===entry.scope))this.entries.set(entry.scope,entry.frames.slice(-4).map(clean));}}
 snapshot(){return {version:1,entries:[...this.entries].map(([scope,frames])=>({scope,frames:structuredClone(frames)}))};}
 record(report:any,now=Date.now()):any {
  if(!valid(report)||report.observedAt>now+5000||now-report.observedAt>15*60000)return report;
  const key=scope(report),current=clean(report);let frames=(this.entries.get(key)||[]).filter(f=>now-f.observedAt<=15*60000&&f.observedAt<=now+5000&&f.snapshot_id!==report.snapshot_id);
  const next=dimensions(current),previous=Object.assign({},...frames.map(dimensions));
  if(Object.entries(next).some(([field,value])=>value&&previous[field]&&previous[field]!==value))frames=[];
  frames=[...frames,current].slice(-4);this.entries.delete(key);this.entries.set(key,frames);while(this.entries.size>12)this.entries.delete(this.entries.keys().next().value!);
  const prices=[...new Map(frames.flatMap(f=>f.prices||[]).map(p=>[p.currency+'|'+p.amountCents+'|'+p.kind,p])).values()];
  const listed=prices.filter((p:any)=>p.kind==='listed'),regularPrice=listed.length===1?listed[0]:null;
  const stocks=frames.map(f=>f.stock),available=stocks.includes('available'),unavailable=stocks.includes('unavailable');
  const stock=stocks.includes('conflict')||available&&unavailable?'conflict':unavailable?'unavailable':available?'available':'unknown';
  const conditions=new Set(frames.map(f=>String(f.visibleText||'').match(/\b(?:Item condition|Condition)\s*[:\n]\s*(new|used|renewed|refurbished|open box)\b/i)?.[1]?.toLowerCase()).filter(Boolean));
  const evidenceFields:any={};for(const field of ['regularPrice','stock','capacitiesGB','visibleText'])evidenceFields[field]=frames.filter(f=>field==='regularPrice'?f.regularPrice:field==='stock'?f.stock!=='unknown':Boolean(f[field])).map(f=>({snapshotId:f.snapshot_id,observedAt:f.observedAt,sourceRef:f.sourceRef}));
  const text=frames.map(f=>f.visibleText||'').join('\n');
  return {...report,prices,regularPrice,stock,conditionConflict:conditions.size>1,capacitiesGB:{ram:[...new Set(frames.flatMap(f=>f.capacitiesGB?.ram||[]))],storage:[...new Set(frames.flatMap(f=>f.capacitiesGB?.storage||[]))]},visibleText:text.slice(0,8000),truncated:frames.some(f=>f.truncated)||text.length>8000,evidenceFields,evidenceObservedAt:Math.min(...frames.map(f=>f.observedAt)),evidenceFrameCount:frames.length};
 }
}
