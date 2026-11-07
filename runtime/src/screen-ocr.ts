import {inspectShoppingObservation} from './browser.js';
function verifiedPixels(observation:any,source:any,now:number){
 const o=observation?.ocr;
 if(!o||o.engine!=='mlkit-latin'||o.onDevice!==true||o.truncated||o.snapshotId!==observation.snapshot_id||o.capturedAt!==observation.captured_at_ms||!/^[a-f0-9]{64}$/.test(o.imageSha256)||observation.package_name!==source.sourcePackage||!Number.isFinite(o.capturedAt)||now-o.capturedAt>15000||o.capturedAt>now+5000||!Number.isInteger(o.width)||!Number.isInteger(o.height)||o.width<64||o.height<64||!Array.isArray(o.lines)||o.lines.length>48)return null;
 const valid=o.lines.every((l:any)=>typeof l.text==='string'&&l.text.length<400&&l.bounds&&l.bounds.left>=0&&l.bounds.top>=0&&l.bounds.right<=o.width&&l.bounds.bottom<=o.height&&l.bounds.right>l.bounds.left&&l.bounds.bottom>l.bounds.top);
 if(!valid||/captcha|access denied|verify you are human/i.test(o.lines.map((l:any)=>l.text).join('\n')))return null;
 return o;
}
function candidate(observation:any,source:any,now:number){
 const o=verifiedPixels(observation,source,now);
 if(!o)return null;
 const lines=o.lines.map((l:any)=>l.text);
 const nativeTitles=(observation.nodes||[]).filter((n:any)=>/product.?title|pdp.?title/i.test(n.resource_id||'')).map((n:any)=>n.text||n.description||'');
 const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const titleBound=nativeTitles.some((t:string)=>normalize(t).includes(normalize(source.listingTitle||''))&&normalize(source.listingTitle||'').length>=8);
 const modelWords=String(source.listingTitle||'').split(/\s+/).filter(w=>/^(?=.*[a-z])(?=.*\d)[a-z0-9-]{2,30}$/i.test(w)&&!/^\d+(?:GB|TB|mAh|W|Hz|H|Hrs|Hours|dB|mm|G)$/i.test(w));
 if(!titleBound&&!modelWords.some(w=>normalize(lines.join(' ')).includes(normalize(w))))return null;
 const relevant=lines.map((line:string,index:number)=>/price|buy now|selling/i.test(line)?[line,lines[index+1]||''].join(' '):/^(?:at\s*)?(?:INR|USD|Rs\.?|₹|US\$)/i.test(line)&&/price|buy now|selling/i.test(lines[index-1]||'')?(lines[index-1]+' '+line):'').filter(Boolean);
 for(const region of Array.isArray(o.currencyRegions)?o.currencyRegions.slice(0,4):[]){
  const b=region.bounds,c=region.currencyBounds,sx=o.width/observation.coordinate_width,sy=o.height/observation.coordinate_height;
  if(!['INR','USD'].includes(region.currency)||!/^\d[\d,]*(?:\.\d{1,2})?$/.test(region.amountText)||!b||!c||c.left<0||c.top<0||c.right>observation.coordinate_width||c.bottom>observation.coordinate_height||b.right>o.width||b.bottom>o.height||Math.abs(b.left-Math.ceil(c.right*sx))>2||Math.abs(b.top-Math.max(0,Math.floor(c.top*sy)-4))>2)continue;
  const label=o.lines.find((l:any)=>/price|buy now|selling/i.test(l.text)&&l.bounds.right>b.left&&l.bounds.left<b.right&&l.bounds.bottom>=b.top-(b.bottom-b.top)*3&&l.bounds.top<=b.bottom);
  if(label)relevant.push(label.text+' '+region.currency+' '+region.amountText);
 }
 const r=inspectShoppingObservation({...observation,nodes:relevant.map((text:string)=>({text}))},{},{kind:'android-app',bound:true,url:null,ref:source.sourceRef,label:source.sourceLabel,pageKind:'product-page',holds:[]});
 return r.regularPrice?{price:r.regularPrice,snapshotId:o.snapshotId,capturedAt:o.capturedAt,imageSha256:o.imageSha256}:null;
}

const variantColours=/^(?:black|white|blue|navy|pink|taupe|beige|silver|grey|gray|green|red|purple|brown|cream|yellow|orange|ivory|mint|lavender)$/i;
const stockText=/^(?:in stock|only (?:\d+|few|a few) left(?: in stock)?|out of stock|currently unavailable|sold out)[.!]?$/i;
export function selectedColour(text:string){
 return text.match(/(?:^|\n)Selected Colou?r\s*(?:is\s+|:\s*)([^.\n]{2,40})(?:\.|$)/i)?.[1]?.trim();
}
function variantStock(observation:any,report:any,now:number){
 const pixels=verifiedPixels(observation,report,now);
 if(!pixels)return null;
 const colour=selectedColour((observation.nodes||[]).map((n:any)=>n.text||n.description||'').join('\n'));
 if(!colour||!variantColours.test(colour))return null;
 const labels=pixels.lines.filter((line:any)=>variantColours.test(line.text.trim()));
 const chosen=labels.filter((line:any)=>line.text.trim().toLowerCase()===colour.toLowerCase()&&labels.some((peer:any)=>peer!==line&&Math.abs(peer.bounds.top-line.bounds.top)<=pixels.height*.025&&Math.abs(peer.bounds.left-line.bounds.left)>=pixels.width*.20));
 if(chosen.length!==1)return null;
 const card=chosen[0].bounds;
 const claims=pixels.lines.filter((line:any)=>stockText.test(line.text.trim())&&line.bounds.top>=card.bottom&&line.bounds.top-card.bottom<=pixels.height*.18&&Math.abs(line.bounds.left-card.left)<=pixels.width*.09&&line.bounds.right-line.bounds.left<=pixels.width*.34);
 if(claims.length!==1)return null;
 const claim=claims[0].text.trim();
 return {colour,claim,stock:/^(?:out of stock|currently unavailable|sold out)/i.test(claim)?'unavailable':'available',snapshotId:pixels.snapshotId,observedAt:pixels.capturedAt,imageSha256:pixels.imageSha256};
}
export function applyStableVariantStock(report:any,first:any,second:any,now=Date.now()):any{
 if(report.store!=='amazon'||!report.sourceBound||report.blocked||report.pageKind!=='product-page'||report.stock!=='unknown')return report;
 const a=variantStock(first,report,now),b=variantStock(second,report,now);
 if(!a||!b||a.colour!==b.colour||a.claim!==b.claim||a.snapshotId===b.snapshotId||b.observedAt-a.observedAt<400||first.window_id!==second.window_id||first.coordinate_width!==second.coordinate_width||first.coordinate_height!==second.coordinate_height)return report;
 return {...report,stock:b.stock,stockOcrEvidence:{colour:b.colour,claim:b.claim,snapshots:[a,b].map(({snapshotId,observedAt,imageSha256})=>({snapshotId,observedAt,imageSha256}))}};
}
export function applyStableOcrPrice(report:any,first:any,second:any,now=Date.now()):any{
 if(!report.sourceBound||report.blocked||report.pageKind!=='product-page')return report;
 const a=candidate(first,report,now),b=candidate(second,report,now);
 if(!a||!b||a.snapshotId===b.snapshotId||b.capturedAt-a.capturedAt<400||first.window_id!==second.window_id||first.coordinate_width!==second.coordinate_width||first.coordinate_height!==second.coordinate_height||a.price.currency!==b.price.currency||a.price.amountCents!==b.price.amountCents)return report;
 const listed=(report.prices||[]).filter((p:any)=>p.kind==='listed');
 if(listed.some((p:any)=>p.currency!==b.price.currency||p.amountCents!==b.price.amountCents))return {...report,regularPrice:null,ocrConflict:true,holds:[...report.holds,'Native and screenshot price claims conflict.']};
 if((report.prices||[]).some((p:any)=>p.kind!=='listed'&&p.currency===b.price.currency&&p.amountCents===b.price.amountCents))return report;
 return {...report,regularPrice:b.price,prices:[...(report.prices||[]).filter((p:any)=>p.kind!=='listed'),b.price],priceEvidenceType:'ocr-stable',ocrEvidence:{snapshots:[a,b].map(p=>({snapshotId:p.snapshotId,observedAt:p.capturedAt,imageSha256:p.imageSha256}))}};
}
