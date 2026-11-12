/** Resolve a buyer's selected product from this native chat, never from a demo catalogue. */
const textOf=message=>String(message?.text??message?.content??'');
const normalized=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=value=>normalized(value).split(' ').filter(Boolean);
const cleanTitle=text=>String(text).replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/[*_\x60]/g,'').replace(/^(?:[-•]|\d+[.)])\s*/,'').replace(/\s+/g,' ').trim().slice(0,120);
const ignoreWords=new Set(['the','a','an','some','one','these','this','pair','headphones','headphone','wireless','bluetooth','with','from','for','buy','cart','please','add','get','model','option','product','my','your','it']);
const trustedProductLink=url=>{
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&!u.username&&!u.password&&!['google.com','bing.com','duckduckgo.com','youtube.com','youtu.be'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host));
 }catch{return false;}
};
const linksIn=text=>[...String(text).matchAll(/https:\/\/[^\s)\]>]+/gi)].map(x=>x[0].replace(/[.,;]+$/,'')).filter(trustedProductLink);
function exactUsd(text){
 const found=[...text.matchAll(/(?:US\$|\$|USD\s*:?\s*)([\d,]+(?:\.\d{1,2})?)/gi)];
 if(found.length!==1)return '';
 const match=found[0],prefix=text.slice(Math.max(0,match.index-36),match.index);
 const suffix=text.slice(match.index+match[0].length,match.index+match[0].length+26);
 if(/(?:about|around|roughly|approx(?:imately)?|estimated?|between|from|starting|up\s+to|under|~|≈|(?:\d)\s*[-–—]\s*)\s*$/i.test(prefix)||/^\s*(?:[-–—]|to\b|or\b|approximately\b|approx\b)/i.test(suffix))return '';
 const amount=Number(match[1].replace(/,/g,''));
 return Number.isFinite(amount)&&amount>0&&amount<=100000?amount.toFixed(2):'';
}
function sourcePrice(text){
 return text.match(/₹\s*[\d,]+(?:\.\d{1,2})?(?:\s*[-–—]\s*₹?\s*[\d,]+(?:\.\d{1,2})?)?/)?.[0]||
 text.match(/(?:US\$|\$|USD\s*)[\d,]+(?:\.\d{1,2})?(?:\s*[-–—]\s*(?:US\$|\$)?\s*[\d,]+(?:\.\d{1,2})?)?/)?.[0]||'';
}
export function offersFromChat(messages){
 const results=[];
 for(const [messageIndex,message] of messages.entries()){
  if(message?.role!=='assistant')continue;
  const lines=textOf(message).split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const line=lines[i].trim();
   let title='',details=line;
   if(line.startsWith('|')){
    const cells=line.split('|').map(cell=>cell.trim()).filter(Boolean);
    if(cells.length<2||/^(?:model|product|item|name|brand)$/i.test(cleanTitle(cells[0]))||/^[-: ]+$/.test(cells[0]))continue;
    title=cleanTitle(cells[0]);
   }else{
    const bullet=line.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.+)$/);
    if(!bullet)continue;
    const bold=bullet[1].match(/^\*\*([^*]+)\*\*/);
    if(bold)title=cleanTitle(bold[1]);
    else{
     const separated=bullet[1].match(/^(.{3,120}?)\s+(?:[—–]|:)\s+/);
     if(separated)title=cleanTitle(separated[1]);
     else{
      const linked=bullet[1].match(/^\[([^\]]+)\]\(https?:\/\/[^)]+\)/);
      if(linked)title=cleanTitle(linked[1]);
     }
    }
   }
   if(title.length<3||/^(?:price|features|battery|notes|availability|total|shipping|seller|link|source|check|compare|pros|cons)\b/i.test(title))continue;
   for(let n=i+1;n<Math.min(i+4,lines.length);n++){
    const next=lines[n].trim();
    if(!next||/^(?:[-*•]\s+|\d+[.)]\s+|\|)/.test(next))break;
    details+=' '+next;
   }
   results.push({title,price:exactUsd(details),url:linksIn(details)[0]||'',sourcePrice:sourcePrice(details),messageIndex,position:results.length});
  }
 }
 return results;
}
function extractSelection(text){
 const v=String(text);
 if(/\b(?:do not|don't|dont|never|not yet|maybe|should i|compare|versus|vs\.?|between)\b/i.test(v) && !/\b(?:i\s+(?:choose|chose|picked|selected|want|prefer)|go\s+with)\b/i.test(v))return '';
 const patterns=[
  /^(?:select|choose|chose|pick|picked|take)\s+(.+)/i,
  /\b(?:i(?:'ve| have)?\s+(?:chosen|selected|picked)|i\s+(?:choose|chose|pick|picked|select|selected|want|prefer|will\s+take|would\s+like)|(?:let'?s\s+)?(?:go|going)\s+with|i(?:'ll| will)\s+take)\s+(.+)/i,
  /\b(?:prepare|add|put|buy|order|purchase|checkout|pay\s+for)\s+(.+?)\s+(?:to|in|into|for)\s+(?:my|the|a)?\s*(?:cart|basket|checkout)\b/i,
  /\b(?:prepare|add|put|buy|order|purchase|checkout|pay\s+for)\s+(?:the\s+)?(.+?)(?:\s+(?:now|please))?[.!?]?$/i
 ];
 for(const pattern of patterns){
  const match=v.match(pattern);
  if(!match)continue;
  const selection=match[1].replace(/\s+(?:and\s+)?(?:prepare|add|put|checkout|pay|proceed)\b[\s\S]*$/i,'').replace(/\b(?:to|in|into)\s+(?:my|the)\s+(?:cart|basket)\b[\s\S]*$/i,'').replace(/[.,!]+$/,'').trim();
  if(selection&&!/^(?:my|the|a|some)\s*(?:cart|basket|checkout|order|payment)$|^(?:it|that|this|one|these|them|now)$/i.test(selection))return selection;
 }
 return '';
}
export function hasExplicitProductSelection(text){return !!extractSelection(text);}
function chooseOffer(offers,selection){
 if(!offers.length||!selection)return null;
 const words=tokens(selection).filter(word=>!ignoreWords.has(word));
 if(!words.length)return null;
 const scored=offers.map(offer=>{
  const title=normalized(offer.title),titleWords=tokens(offer.title);
  const overlapping=words.filter(word=>titleWords.includes(word));
  const score=(title.includes(normalized(selection))?80:0)+overlapping.length*12+(words.some(word=>/\d/.test(word)&&titleWords.includes(word))?30:0);
  return {...offer,score};
 }).filter(offer=>offer.score>0).sort((a,b)=>b.score-a.score||b.messageIndex-a.messageIndex||b.position-a.position);
 if(!scored.length)return null;
 if(scored.length>1&&scored[0].score===scored[1].score&&normalized(scored[0].title)!==normalized(scored[1].title))return {ambiguous:true};
 return scored[0];
}
export function resolveCartFromChat(messages,prompt=''){
 const recent=Array.isArray(messages)?messages.slice(-80):[];
 const offers=offersFromChat(recent);
 const selectionCandidates=[prompt,...recent.slice().reverse().filter(m=>m?.role==='user'&&!textOf(m).startsWith('[Worker completion]')).map(textOf)];
 let selection='';
 for(const text of selectionCandidates){selection=extractSelection(text);if(selection)break;}
 if(!selection)return {title:'',price:'',url:'',sourcePrice:'',notice:'Select a specific product in chat before preparing a cart.'};
 const match=chooseOffer(offers,selection);
 if(match?.ambiguous)return {title:'',price:'',url:'',sourcePrice:'',notice:'Several listed products match your selection. Specify the exact model in chat.'};
 if(!match)return {title:'',price:'',url:'',sourcePrice:'',notice:'I could not find that selected product in the assistant’s listings. Check the model, price and product link before preparing the cart.'};
 return {title:match.title,price:match.price,url:match.url,sourcePrice:match.sourcePrice,
  notice:match.price&&match.url?'Review the selected item, quoted USD amount and product link before continuing.':
   'Product selected from chat. '+(!match.price?'Enter an exact USD test amount; an estimated/ranged or non-USD price was not copied. ':'')+(!match.url?'Provide a direct HTTPS product listing; search-result links are not checkout references.':'')};
}
export function sameCartProduct(draft,quote){
 return !!draft?.title&&!!quote?.title&&normalized(draft.title)===normalized(quote.title);
}
