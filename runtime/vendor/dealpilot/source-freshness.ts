import type {LiveOffer} from './contracts.js'

export const MAX_OBSERVATION_AGE_HOURS=48
const FUTURE_TOLERANCE_MS=5*60*1000
const HOUR_MS=60*60*1000

export type ObservationFreshness={
  status:'unknown'|'recent'|'stale'|'future-invalid'
  observedAt:string|null
  ageHours:number|null
  explanation:string
}

/** ISO-8601 UTC observations only; never confuse a feed load or catalog lookup with a merchant observation. */
export function parseMerchantObservedAt(raw:string,now:Date):string|null{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw))return null
  const timestamp=Date.parse(raw)
  if(!Number.isFinite(timestamp))return null
  const parsed=new Date(timestamp)
  // Reject normalized nonexistent dates and impossible clock times.
  const canonical=parsed.toISOString().replace(/\.000Z$/,'Z')
  const normalized=raw.replace(/(\.\d{1,3})?Z$/,(_,fraction:string|undefined)=>
    fraction?'.'+fraction.slice(1).padEnd(3,'0')+'Z':'Z')
  if(canonical!==normalized.replace(/\.000Z$/,'Z'))return null
  if(timestamp>now.getTime()+FUTURE_TOLERANCE_MS)return null
  return parsed.toISOString()
}
export function assessObservationFreshness(
  offer:Pick<LiveOffer,'observedAt'>,now=new Date(),maxAgeHours=MAX_OBSERVATION_AGE_HOURS,
):ObservationFreshness{
  if(!offer.observedAt)return {status:'unknown',observedAt:null,ageHours:null,
    explanation:'The source did not supply a merchant observation timestamp; the quote freshness is unknown.'}
  const timestamp=parseMerchantObservedAt(offer.observedAt,now)
  if(!timestamp)return {status:'future-invalid',observedAt:offer.observedAt,ageHours:null,
    explanation:'The reported observation timestamp is invalid or lies in the future.'}
  const ageHours=Math.max(0,(now.getTime()-Date.parse(timestamp))/HOUR_MS)
  if(ageHours>maxAgeHours)return {status:'stale',observedAt:timestamp,ageHours,
    explanation:'This source claim was observed more than '+maxAgeHours+' hours ago and is withheld from provisional comparison.'}
  return {status:'recent',observedAt:timestamp,ageHours,
    explanation:'The source reports a recent observation time, but this does not authenticate the price or stock.'}
}
