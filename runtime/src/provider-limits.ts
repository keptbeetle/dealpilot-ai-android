import {createHash} from 'node:crypto';

export type ProviderHold={until:number;message:string};
export class ProviderLimits {
 private holds=new Map<string,ProviderHold>();
 private next=new Map<string,number>();
 constructor(private now:()=>number=Date.now){}
 status(key:string,model:string){
  for(const scope of [key,key+'\0'+model]){
   const hold=this.holds.get(scope);
   if(hold&&hold.until>this.now())return hold;
   if(hold)this.holds.delete(scope);
  }
 }
 reserve(key:string,spacing:number){
  const start=Math.max(this.now(),this.next.get(key)||0);
  this.next.set(key,start+spacing);
  return Math.max(0,start-this.now());
 }
 reject(key:string,model:string,reason:string){
  const now=this.now();
  if(/NOT_FOUND|\b404\b|no longer available/i.test(reason)){
   const hold={until:now+86400000,message:'The selected model '+model+' is unavailable to this key (HTTP 404). Choose a supported model. Progress was retained.'};
   this.holds.set(key+'\0'+model,hold);return hold;
  }
  if(!/\b429\b|RESOURCE_EXHAUSTED|quota exceeded|rate limit/i.test(reason))return;
  const daily=/per.day|per day|daily|free-models-per-day/i.test(reason);
  const reset=reason.match(/X-RateLimit-Reset[\\"]*\s*:\s*[\\"]*(\d{10,13})/i)?.[1];
  const retry=reason.match(/retry in\s+(\d+(?:\.\d+)?)s/i)?.[1];
  const raw=reset?Number(reset)*(reset.length===10?1000:1):retry?now+Math.ceil(Number(retry)*1000):daily?Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()+1):now+60000;
  const until=Math.max(now+1000,Math.min(raw,now+86400000));
  const hold={until,message:(daily?'The provider daily free allowance is exhausted (HTTP 429).':'The provider request allowance is temporarily exhausted (HTTP 429).')+' Next attempt after '+new Date(until).toISOString().replace('T',' ').replace('.000Z',' UTC')+'. Progress was retained. No paid fallback was used.'};
  const previous=this.holds.get(key);
  if(!previous||previous.until<until)this.holds.set(key,hold);
  return this.holds.get(key);
 }
}
export function providerLimitKey(provider:string,apiKey:string){
 return provider+'\0'+createHash('sha256').update(apiKey).digest('hex');
}
export const providerLimits=new ProviderLimits();
export async function waitForProvider(ms:number,signal?:AbortSignal){
 if(signal?.aborted)throw Error('Request cancelled.');
 if(ms<=0)return;
 await new Promise<void>((resolve,reject)=>{
  const complete=()=>{signal?.removeEventListener('abort',abort);resolve();};
  const timer=setTimeout(complete,ms),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('Request cancelled.'));};
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
}
