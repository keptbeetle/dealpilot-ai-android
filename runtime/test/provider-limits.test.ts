import assert from 'node:assert/strict';
import test from 'node:test';
import {ProviderLimits,providerLimitKey,waitForProvider} from '../src/provider-limits.js';
import {makeStream,modelFor} from '../src/provider.js';

test('provider-wide pacing shares allowance across workers but isolates credentials',()=>{
 const gate=new ProviderLimits(()=>1000),one=providerLimitKey('gemini','first-secret'),two=providerLimitKey('gemini','other-secret');
 assert.ok(!one.includes('first-secret'));assert.equal(gate.reserve(one,5000),0);assert.equal(gate.reserve(one,5000),5000);assert.equal(gate.reserve(two,5000),0);
});
test('daily quota honors actual reset epoch and holds every model using that key',()=>{
 let now=Date.UTC(2026,10,5,20);const gate=new ProviderLimits(()=>now),reset=now+123000;
 const hold=gate.reject('key','vl-free',JSON.stringify({error:{message:'free-models-per-day limit 429',metadata:{headers:{'X-RateLimit-Reset':String(reset)}}}}));
 assert.equal(hold?.until,reset);assert.match(hold!.message,/daily free allowance/);assert.equal(gate.status('key','different')?.until,reset);assert.equal(gate.status('other','vl-free'),undefined);
 now=reset;assert.equal(gate.status('key','vl-free'),undefined);
});
test('minute retry periods expire, and a shorter rejection cannot erase a longer hold',()=>{
 let now=1000;const gate=new ProviderLimits(()=>now);
 assert.equal(gate.reject('key','model','RESOURCE_EXHAUSTED quota exceeded per minute retry in 12.5s')?.until,13500);
 gate.reject('key','model','429 retry in 1s');assert.equal(gate.status('key','model')?.until,13500);now=13501;assert.equal(gate.status('key','model'),undefined);
});
test('retired model hold leaves supported models and other keys available',()=>{
 const gate=new ProviderLimits(()=>1000);assert.match(gate.reject('key','old-model','404 NOT_FOUND no longer available')!.message,/supported model/);
 assert.ok(gate.status('key','old-model'));assert.equal(gate.status('key','new-model'),undefined);assert.equal(gate.status('other','old-model'),undefined);
 assert.equal(gate.reject('key','new-model','503 high demand'),undefined);
});
test('pacing cancellation aborts before provider dispatch',async()=>{
 const controller=new AbortController(),pending=waitForProvider(10000,controller.signal);controller.abort();await assert.rejects(()=>pending,/cancelled/);
});
test('actual OpenRouter stream rejects daily quota once and serves the next failure locally without another API call',async()=>{
 const config={mode:'openrouter' as const,model:'synthetic/model:free'},credentials={apiKey:'synthetic-quota-regression-key'};let requests=0;
 const fetcher:typeof fetch=async()=>{requests++;return Response.json({error:{message:'429 free-models-per-day quota exceeded',code:429}},{status:429});};
 const stream=makeStream(config,credentials,'main');
 const first=await (await stream(modelFor(config),{messages:[]},{fetch:fetcher})).result();assert.match(first.errorMessage||'',/daily free allowance/);
 const second=await (await stream(modelFor(config),{messages:[]},{fetch:fetcher})).result();assert.equal(requests,1);assert.equal(first.errorMessage,second.errorMessage);
 assert.ok(!JSON.stringify(second).includes(credentials.apiKey));
});
test('OpenRouter retries a single unavailable rejection before content without changing model or entering a retry loop',async()=>{
 const config={mode:'openrouter' as const,model:'synthetic/overloaded:free'},credentials={apiKey:'synthetic-unavailable-regression-key'};let requests=0;
 const fetcher:typeof fetch=async()=>{requests++;return Response.json({error:{message:'503 high demand',code:503}},{status:503});};
 const result=await (await makeStream(config,credentials,'main')(modelFor(config),{messages:[]},{fetch:fetcher})).result();
 assert.equal(requests,2);assert.equal(result.stopReason,'error');assert.match(result.errorMessage||'',/503/);
});
test('a stalled provider body cannot ignore cancellation and leave a worker running forever',async()=>{
 const config={mode:'openrouter' as const,model:'synthetic/stalled:free'},credentials={apiKey:'synthetic-stalled-regression-key'},abort=new AbortController();
 const fetcher:typeof fetch=async()=>new Response(new ReadableStream({pull:()=>new Promise(()=>{})}),{headers:{'content-type':'text/event-stream'}});
 const stream=await makeStream(config,credentials,'main')(modelFor(config),{messages:[]},{fetch:fetcher,signal:abort.signal});
 const timer=setTimeout(()=>abort.abort(),30);
 try{const result=await stream.result();assert.equal(result.stopReason,'aborted');assert.match(result.errorMessage||'',/cancelled/);}finally{clearTimeout(timer);}
});
