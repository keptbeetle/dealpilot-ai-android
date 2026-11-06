/** Only explicit itemized assertions are parsed. Absence is never a zero fee. */
export function reportedCostClaims(text:string,currency:'INR'|'USD'){
 const amount=(label:string)=>{
  const matches=[...text.matchAll(new RegExp('(?:^|\\n)'+label+'\\s*:\\s*(INR|USD|US\\$|Rs\\.?|₹)\\s*(\\d[\\d,]*(?:\\.\\d{1,2})?)\\b','gi'))];
  const values=matches.map(m=>({currency:/INR|Rs|₹/i.test(m[1])?'INR':'USD',cents:Math.round(Number(m[2].replace(/,/g,''))*100)}));
  if(values.some(v=>v.currency!==currency||!Number.isSafeInteger(v.cents)||v.cents<0||v.cents>200000000)||new Set(values.map(v=>v.cents)).size>1)return {value:null,conflict:true};
  return {value:values[0]?.cents??null,conflict:false};
 };
 const shipping=amount('(?:Shipping|Delivery charge)'),tax=amount('(?:Tax|Taxes)'),fees=amount('(?:Total mandatory fees|All additional fees)');
 const free=/\bfree delivery\b|\bfree shipping\b/i.test(text),included=/inclusive of all taxes|all taxes included/i.test(text),noFees=/\bno additional fees\b|\bno mandatory fees\b/i.test(text),noMembership=/\bno membership required\b/i.test(text),membership=/\bmembership required\b|\bmembers only\b/i.test(text.replace(/\bno membership required\b/ig,''));
 return {claims:{shippingCents:shipping.value??(free?0:null),taxCents:included?0:tax.value,mandatoryFeeCents:fees.value??(noFees?0:null),membershipRequired:noMembership?'no' as const:membership?'yes' as const:'unknown' as const,shipsToUS:/\bships to (?:the )?(?:US|USA|United States)\b/i.test(text)?'yes' as const:'unknown' as const,shipsToIN:/\bships to India\b/i.test(text)?'yes' as const:'unknown' as const},conflict:shipping.conflict||tax.conflict||fees.conflict||free&&Boolean(shipping.value)||noFees&&Boolean(fees.value)||noMembership&&membership};
}
