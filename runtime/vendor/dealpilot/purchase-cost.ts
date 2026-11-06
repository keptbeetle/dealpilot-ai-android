import type {LiveOffer} from './contracts.js'

/** Every cost component is a merchant assertion, not a checkout quotation. */
export type CostClaims={
  shippingCents:number|null
  taxCents:number|null
  mandatoryFeeCents:number|null
  membershipRequired:'yes'|'no'|'unknown'
  shipsToUS:'yes'|'no'|'unknown'
  shipsToIN?:'yes'|'no'|'unknown'
}
export type CostEvaluation={
  status:'reported-estimate'|'incomplete'|'restricted'|'ineligible'
  reportedTotalCents:number|null
  knownComponentsSumCents:number
  unknownComponents:Array<'shipping'|'tax'|'mandatory fees'>
  reasons:string[]
  sourceReported:true
  checkoutVerified:false
  buyerSpecificTaxVerified:false
  deliveryVerified:false
}
/**
 * Evaluates only *claims*. An all-in number requires every component and an
 * explicit, unrestricted merchant-reported delivery-market availability assertion.
 * No postcode, tax authority, membership or checkout verification exists.
 */
export function evaluateReportedCost(
  offer:Pick<LiveOffer,'priceCents'|'costClaims'|'currency'>,
):CostEvaluation{
  const claims=offer.costClaims
  const destination=offer.currency==='INR'?'IN':'US'
  const ships=destination==='IN'?claims?.shipsToIN:claims?.shipsToUS
  const reasons:string[]=[]
  const components=[
    ['shipping',claims?.shippingCents],
    ['tax',claims?.taxCents],
    ['mandatory fees',claims?.mandatoryFeeCents],
  ] as const
  const unknownComponents=components.filter(([,c])=>c==null)
    .map(([name])=>name)
  const knownComponentsSumCents=offer.priceCents+
    components.reduce<number>((sum,[,c])=>sum+(c??0),0)
  let status:CostEvaluation['status']='incomplete'
  if(ships==='no'){
    status='ineligible'
    reasons.push('Merchant reports that this listing does not ship to '+(destination==='IN'?'India.':'the US.'))
  }else if(claims?.membershipRequired==='yes'){
    status='restricted'
    reasons.push('Merchant reports that a membership is required; shopper eligibility is not established.')
  }else if(claims?.membershipRequired==='no'&&ships==='yes'&&
    unknownComponents.length===0){
    status='reported-estimate'
    reasons.push('All cost components supplied by merchant; buyer-specific total is not checkout verified.')
  }else{
    if(ships!=='yes')reasons.push(destination==='IN'?'India delivery eligibility has not been established.':'US delivery eligibility has not been established.')
    if(claims?.membershipRequired!=='no')reasons.push('Membership requirements have not been ruled out.')
    if(unknownComponents.length)reasons.push('Unreported cost components: '+unknownComponents.join(', ')+'.')
  }
  return {status,reportedTotalCents:status==='reported-estimate'?knownComponentsSumCents:null,
    knownComponentsSumCents,unknownComponents,reasons,sourceReported:true,
    checkoutVerified:false,buyerSpecificTaxVerified:false,deliveryVerified:false}
}
export type GroupCostSummary={
  status:'comparable-reported-estimates'|'insufficient'
  completeEstimates:number
  unresolvedOffers:number
  distinctMerchantsWithEstimates:number
  lowestReportedTotalCents:number|null
  highestReportedTotalCents:number|null
  lowestOfferId:string|null
  checkoutVerified:false
  note:string
}
export function summarizeGroupCosts(offers:readonly LiveOffer[]):GroupCostSummary{
  const currencies=new Set(offers.map(o=>o.currency))
  const eligible=(currencies.size>1?[]:offers).map(offer=>({offer,assessment:evaluateReportedCost(offer)}))
    .filter((entry):entry is {offer:LiveOffer;assessment:CostEvaluation & {reportedTotalCents:number}}=>
      entry.assessment.reportedTotalCents!==null)
  eligible.sort((a,b)=>a.assessment.reportedTotalCents-b.assessment.reportedTotalCents)
  const merchants=new Set(eligible.map(x=>x.offer.merchant.trim().toLowerCase()))
  const comparable=merchants.size>=2
  return {
    status:comparable?'comparable-reported-estimates':'insufficient',
    completeEstimates:eligible.length,
    unresolvedOffers:offers.length-eligible.length,
    distinctMerchantsWithEstimates:merchants.size,
    lowestReportedTotalCents:comparable?eligible[0].assessment.reportedTotalCents:null,
    highestReportedTotalCents:comparable?eligible[eligible.length-1].assessment.reportedTotalCents:null,
    lowestOfferId:comparable?eligible[0].offer.id:null,
    checkoutVerified:false,
    note:comparable
      ?'These are source-reported estimates among only the fully itemized, unrestricted quotes. They are not verified checkout totals or proof of the best deal.'
      :currencies.size>1?'Incompatible offer currencies cannot be compared or converted.':
       'Insufficient unrestricted, completely itemized quotes from different merchants. No meaningful total-price comparison is available.',
  }
}
/** Strict nonnegative amounts in the explicitly declared feed currency, no conversion. */
export function parseOptionalCurrencyAmount(value:string|undefined,currency:'USD'|'INR'):number|null|undefined{
  if(value===undefined||value.trim()==='')return null
  const match=value.trim().match(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?\s+(USD|INR)$/)
  if(!match||match[1]!==currency)return undefined
  const [whole,cents='']=value.trim().split(' ')[0].split('.')
  const amount=Number(whole)*100+Number(cents.padEnd(2,'0'))
  return amount<=(currency==='INR'?200_000_000:5_000_000)?amount:undefined
}
export const parseOptionalUsdAmount=(value:string|undefined)=>parseOptionalCurrencyAmount(value,'USD')
