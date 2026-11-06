import type {LiveOffer} from './contracts.js'
import type {RetailerInspection} from './contracts.js'
import {canonicalGtin, normalizePartNumber} from './product-identifiers.js'

export type SourceIdentityAssessment = {
  status:'model-compatible'|'conflict'|'not-established'
  reasons:string[]
  matchedBy:('gtin'|'mpn'|'model-code')[]
  variantUnresolved:boolean
  checkoutVerified:false
  retailerAuthenticated:false
}
type SourceIdentityInput=Pick<LiveOffer,'title'|'brand'> & {gtin?:string|null;mpn?:string|null}

function tokens(value:string):string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g)??[]
}
function phraseIn(phrase:string,source:string):boolean {
  const needle=tokens(phrase)
  const haystack=tokens(source)
  return needle.length>0 && haystack.some((token,start)=>token===needle[0] &&
    needle.every((term,i)=>haystack[start+i]===term))
}

/** Whole model identifiers, never substring containment (XM5 must not match XM50). */
function modelCodes(value:string):Set<string> {
  const found=new Set<string>()
  const candidates=value.toUpperCase().match(/[A-Z0-9]+(?:[-/][A-Z0-9]+)*/g)??[]
  for(const raw of candidates){
    const canonical=raw.replace(/-/g,'')
    const compactModel=/^[A-Z]{1,2}\d{1,2}$/.test(canonical)
    if((canonical.length<4&&!compactModel) || !/[A-Z]/.test(canonical) || !/\d/.test(canonical))continue
    // A shared capacity, battery, display or power claim is not a model ID.
    if(/^\d+(?:GB|TB|MB|KB|MAH|AH|HZ|KHZ|MHZ|GHZ|W|V|MP|MM|CM|INCH|PACK|PK|PCS|GLTE)$/.test(canonical))continue
    if(/^20(?:2\d|3\d)$/.test(canonical))continue
    found.add(canonical)
  }
  return found
}
const colors=new Set(['black','white','blue','red','pink','silver','gray','grey','gold','green',
  'purple','beige','brown','navy','graphite','midnight','starlight','cream','sand',
  'obsidian','lilac','rose'])
function mentionedColors(title:string):string[] {
  return [...new Set(tokens(title).filter(token=>colors.has(token)).map(x=>x==='grey'?'gray':x))]
}
function capacities(title:string):string[] {
  return [...new Set([...title.matchAll(/\b(\d+(?:\.\d+)?)\s*(TB|GB)\b/gi)]
    .map(match=>String(Number(match[1])*(match[2].toUpperCase()==='TB'?1024:1))+'GB'))]
}
function packQuantity(title:string):number|null {
  const match=title.match(/\b(\d+)[\s-]*(?:pack|pk)\b|\b(?:pack|bundle)\s+of\s+(\d+)\b/i)
  if(match)return Number(match[1]??match[2])
  if(/\bsingle[\s-]?pack\b/i.test(title))return 1
  return null
}
function definiteVariantConflict(a:string,b:string):string[] {
  const reasons:string[]=[]
  const leftColors=mentionedColors(a),rightColors=mentionedColors(b)
  if(leftColors.length===1&&rightColors.length===1&&leftColors[0]!==rightColors[0])
    reasons.push('Explicit color variants differ: '+leftColors[0]+' vs '+rightColors[0]+'.')
  const leftSizes=capacities(a),rightSizes=capacities(b)
  if(leftSizes.length===1&&rightSizes.length===1&&leftSizes[0]!==rightSizes[0])
    reasons.push('Explicit capacity variants differ: '+leftSizes[0]+' vs '+rightSizes[0]+'.')
  const leftPack=packQuantity(a),rightPack=packQuantity(b)
  if(leftPack!==null&&rightPack!==null&&leftPack!==rightPack)
    reasons.push('Explicit pack quantities differ: '+leftPack+' vs '+rightPack+'.')
  return reasons
}

/**
 * The result reflects untrusted source *claims*, not authenticated retailer or
 * manufacturer identity. Catalog and page text agreeing never verifies a SKU.
 * A conflict vetoes human-confirmed holds for an unrelated listing.
 */
export function assessSourceIdentity(offer:SourceIdentityInput,inspection:RetailerInspection):SourceIdentityAssessment {
  const reasons:string[]=[]
  const matchedBy:SourceIdentityAssessment['matchedBy']=[]
  const pageTitle=inspection.title??''
  const invalidBrand=offer.brand==='Brand not supplied'||!offer.brand.trim()
  if(invalidBrand || !phraseIn(offer.brand,pageTitle)){
    return {status:'not-established',reasons:['The product-page title does not establish the stated manufacturer.'],
      matchedBy,variantUnresolved:true,checkoutVerified:false,retailerAuthenticated:false}
  }
  const leftGtin=offer.gtin?canonicalGtin(offer.gtin):null
  const rightGtin=inspection.gtin?canonicalGtin(inspection.gtin):null
  if(leftGtin && rightGtin){
    if(leftGtin!==rightGtin)reasons.push('Catalog and product-page GTINs differ.')
    else matchedBy.push('gtin')
  }
  const leftMpn=offer.mpn?normalizePartNumber(offer.mpn):null
  const rightMpn=inspection.model?normalizePartNumber(inspection.model):null
  if(leftMpn && rightMpn){
    if(leftMpn!==rightMpn)reasons.push('Catalog and product-page manufacturer part numbers differ.')
    else matchedBy.push('mpn')
  }
  const catalogCodes=modelCodes(offer.title)
  const pageCodes=modelCodes(pageTitle)
  const sourceModelCodes=modelCodes(inspection.model??'')
  const catalogAll=new Set([...catalogCodes,...modelCodes(offer.mpn??'')])
  const sourceAll=new Set([...pageCodes,...sourceModelCodes])
  if([...catalogAll].some(model=>sourceAll.has(model)))matchedBy.push('model-code')
  if(catalogCodes.size>0 && pageCodes.size>0 &&
     ![...catalogCodes].some(code=>pageCodes.has(code) ||
       [...pageCodes].some(short=>short.length>=5 && short.length<=7 &&
         code.startsWith(short) && /[A-Z]/.test(code.slice(short.length))))){
    reasons.push('Whole model codes in the catalog and source titles differ.')
  }
  if(rightMpn && catalogAll.size>0 &&
     ![...catalogAll].some(code=>sourceModelCodes.has(code) ||
       // Short marketing families (TAH6000) may expand to an explicit
       // manufacturer variant (TAH6000BK/00). Full models (WH1000XM5)
       // cannot be extended to another model (WH1000XM50).
       (code.length>=5 && code.length<=7 &&
        [...sourceModelCodes].some(actual=>actual.startsWith(code) && /[A-Z]/.test(actual.slice(code.length))))) &&
     !matchedBy.includes('mpn')){
    reasons.push('The source manufacturer model is inconsistent with the catalog model.')
  }
  const variants=definiteVariantConflict(offer.title,pageTitle)
  reasons.push(...variants)
  const knownColor=mentionedColors(offer.title).length===1 && mentionedColors(pageTitle).length===1
  const knownCapacity=capacities(offer.title).length===1 && capacities(pageTitle).length===1
  const knownPack=packQuantity(offer.title)!==null && packQuantity(pageTitle)!==null
  const variantUnresolved=(mentionedColors(offer.title).length>0||mentionedColors(pageTitle).length>0)&&!knownColor ||
    (capacities(offer.title).length>0||capacities(pageTitle).length>0)&&!knownCapacity ||
    (packQuantity(offer.title)!==null||packQuantity(pageTitle)!==null)&&!knownPack
  if(reasons.length>0) return {status:'conflict',reasons,matchedBy,variantUnresolved,
    checkoutVerified:false,retailerAuthenticated:false}
  if(!matchedBy.length){
    return {status:'not-established',reasons:['No agreeing complete model code, manufacturer part number or GTIN was found.'],
      matchedBy,variantUnresolved,checkoutVerified:false,retailerAuthenticated:false}
  }
  return {status:'model-compatible',reasons:[
    'Reported brand and at least one whole product identifier agree; this is not authentication or final variant verification.',
    ...(variantUnresolved?['One source omits an explicit configuration detail, requiring additional review.']:[]),
  ],matchedBy,variantUnresolved,checkoutVerified:false,retailerAuthenticated:false}
}

/** Pairwise *reported* catalog compatibility. It never authenticates either source. */
export function compareReportedOffers(
  left:SourceIdentityInput,right:SourceIdentityInput,
):{basis:'matching-gtin'|'matching-mpn'|'unresolved';reason:string}{
  const unresolved=(reason:string)=>({basis:'unresolved' as const,reason})
  if(left.brand.trim().toLowerCase()!==right.brand.trim().toLowerCase() ||
     left.brand.trim()===''||left.brand==='Brand not supplied')
    return unresolved('Manufacturer claims do not agree.')
  const aG=left.gtin?canonicalGtin(left.gtin):null
  const bG=right.gtin?canonicalGtin(right.gtin):null
  if(left.gtin&&!aG||right.gtin&&!bG)return unresolved('Invalid reported GTIN.')
  if(aG&&bG&&aG!==bG)return unresolved('Reported GTINs conflict.')
  const aM=left.mpn?normalizePartNumber(left.mpn):null
  const bM=right.mpn?normalizePartNumber(right.mpn):null
  if(left.mpn&&!aM||right.mpn&&!bM)return unresolved('Invalid manufacturer part number.')
  if(aM&&bM&&aM!==bM)return unresolved('Reported MPNs conflict.')
  const leftCodes=modelCodes(left.title)
  const rightCodes=modelCodes(right.title)
  if(leftCodes.size&&rightCodes.size&&![...leftCodes].some(code=>rightCodes.has(code)))
    return unresolved('Whole model codes in product titles differ.')
  const conflict=definiteVariantConflict(left.title,right.title)
  if(conflict.length)return unresolved(conflict.join(' '))
  // If a title mentions a variant and the other omits it, comparison is
  // unresolved rather than assuming the other listing has that configuration.
  const dimensions=[
    [mentionedColors(left.title),mentionedColors(right.title)],
    [capacities(left.title),capacities(right.title)],
    [packQuantity(left.title),packQuantity(right.title)],
  ] as const
  for(const [a,b] of dimensions){
    const sizeA=typeof a==='number'?1:a===null?0:a.length
    const sizeB=typeof b==='number'?1:b===null?0:b.length
    if(sizeA!==sizeB || sizeA>1 || sizeB>1)
      return unresolved('One or both listings leave a variant dimension ambiguous.')
  }
  if(aG&&bG&&aG===bG)
    return {basis:'matching-gtin',reason:'Reported checksum-valid GTINs match; source authenticity remains unverified.'}
  if(aM&&bM&&aM===bM)
    return {basis:'matching-mpn',reason:'Reported manufacturer part numbers agree; exact listing equivalence remains unverified.'}
  return unresolved('No shared GTIN or manufacturer part number to establish a comparable candidate.')
}
