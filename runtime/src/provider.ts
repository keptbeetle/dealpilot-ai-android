import {providerLimits,providerLimitKey,waitForProvider} from './provider-limits.js';
/** Selected Pi adapters. Agent loops and tool execution stay inside Android. */
import type { StreamFn } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Model } from '@earendil-works/pi-ai';
import { streamSimple as googleStream } from '@earendil-works/pi-ai/api/google-generative-ai';
import { streamSimple } from '@earendil-works/pi-ai/api/openai-responses';
import { streamSimple as completionsStreamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { streamSimple as codexStreamSimple } from '@earendil-works/pi-ai/api/openai-codex-responses';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { SCRIPT_MODEL, scriptedStream } from './scripted.js';
import {CODEX_RESPONSES_URL,ensureCodexCredentials,redactProviderSecrets,type CodexCredentialInput} from './codex-auth.js';
import {codexFailure} from './codex-errors.js';
export {registerCodexCredentialUpdater,redactProviderSecrets} from './codex-auth.js';

export interface ProviderConfig {
  mode?: 'scripted' | 'openai' | 'codex' | 'codex-account' | 'opencode' | 'nebius' | 'gemini' | 'openrouter';
  endpoint?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
}
export interface ProviderCredentials extends CodexCredentialInput {
  endpoint?: string;
  model?: string;
  authMode?: string;
  modelSource?: 'manual' | 'catalog';
  reasoningEffortModel?: string;
  reasoningEfforts?: string[];
}
type ProviderModel = Model<'openai-responses'> | Model<'openai-codex-responses'> | Model<'openai-completions'> | Model<'google-generative-ai'>;
export const OPENCODE_BASE_URL = 'https://opencode.ai/inference/openai/v1';
export const NEBIUS_BASE_URL = 'https://api.tokenfactory.nebius.com/v1';
export const REASONING_EFFORTS = ['minimal','low','medium','high','xhigh','max'] as const;
export type ReasoningEffort = typeof REASONING_EFFORTS[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'low';
const REASONING_EFFORT_SET = new Set<string>(REASONING_EFFORTS);
export function normalizeReasoningEffort(value: unknown): ReasoningEffort {
  return typeof value === 'string' && REASONING_EFFORT_SET.has(value) ? value as ReasoningEffort : DEFAULT_REASONING_EFFORT;
}
function providerInput(mode: string, id: string): Array<'text'|'image'> {
  const normalized = id.toLowerCase().replace(/:free$/,'');
  const vision = /(^|[/._-])(vl|vision|omni)([/._-]|$)/.test(normalized)
    || normalized === 'zai-org/glm-5.3-flash'
    || normalized === 'glm-5.3-flash-free';
  return vision ? ['text','image'] : ['text'];
}
function accountMode(config: ProviderConfig, credentials: ProviderCredentials): boolean {
  return (credentials.authMode || config.mode) === 'codex-account';
}
function selectedMode(config: ProviderConfig, credentials: ProviderCredentials): string {
  return credentials.authMode || config.mode || 'openai';
}
function configurableReasoningMode(mode: string): boolean {
  return ['openai','api-key','codex','codexRelay','codex-relay','codex-account'].includes(mode);
}
function selectedThinkingLevelMap(config: ProviderConfig, credentials: ProviderCredentials): {xhigh?: string; max?: string}|undefined {
  const effort = normalizeReasoningEffort(config.reasoningEffort);
  if (!configurableReasoningMode(selectedMode(config,credentials))) return undefined;
  if (effort === 'xhigh') return {xhigh:'xhigh'};
  if (effort === 'max') return {max:'max'};
  return undefined;
}
function isRelay(config: ProviderConfig, credentials: ProviderCredentials): boolean {
  return ['codex', 'codexRelay', 'codex-relay'].includes(selectedMode(config, credentials));
}
export function modelFor(config: ProviderConfig, credentials: ProviderCredentials = {}, override?: string): ProviderModel {
  if (config.mode === 'scripted') return SCRIPT_MODEL;
  const mode = selectedMode(config, credentials);
  const account = accountMode(config, credentials), relay = isRelay(config, credentials);
  if (account && (config.endpoint || credentials.endpoint)) throw new Error('Codex account inference uses a fixed provider endpoint; remove the endpoint override.');
  const fixed = mode === 'openrouter' ? 'https://openrouter.ai/api/v1' : mode === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : mode === 'opencode' ? OPENCODE_BASE_URL : mode === 'nebius' ? NEBIUS_BASE_URL : undefined;
  const configured = credentials.endpoint || config.endpoint;
  if (fixed && configured && configured.replace(/\/$/, '') !== fixed) throw new Error('This provider uses a fixed API endpoint.');
  const endpoint = account ? CODEX_RESPONSES_URL : fixed || configured || (relay ? 'http://10.0.2.2:8787/v1' : 'https://api.openai.com/v1');
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || url.hash) throw new Error('Provider endpoint must be a base URL without credentials, query or fragment.');
  if (relay) {
    if (url.protocol !== 'http:' || !['10.0.2.2', '127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Codex relay is restricted to the Android emulator host or loopback.');
  } else if (url.protocol !== 'https:') throw new Error('Direct API providers require HTTPS.');
  const id = override || credentials.model || config.model || (mode === 'openrouter' ? 'nvidia/nemotron-3.5-super-vl:free' : mode === 'gemini' ? 'gemini-3.5-flash' : account ? 'gpt-6-luna' : mode === 'opencode' ? 'big-pickle' : mode === 'nebius' ? 'zai-org/GLM-5.3-Flash' : 'gpt-6-sol');
  if (!/^[a-zA-Z0-9._:/+@-]{1,160}$/.test(id)) throw new Error('Invalid model identifier.');
  if (mode === 'openrouter' && !id.endsWith(':free')) throw new Error('OpenRouter is restricted to explicitly free models.');
  if (mode === 'gemini') {
    return {id, name:id, provider:'google', api:'google-generative-ai', baseUrl:fixed!, input:['text','image'],
      reasoning:true, contextWindow:1048576, maxTokens:8192, cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  }
  if (mode === 'opencode' || mode === 'nebius' || mode === 'openrouter') {
    return {
      id, name: id, provider: mode, api: 'openai-completions',
      baseUrl: url.toString().replace(/\/$/, ''), input: providerInput(mode,id),
      reasoning: true, contextWindow: 128000, maxTokens: 4096,
      thinkingLevelMap: selectedThinkingLevelMap(config,credentials),
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      compat: { supportsDeveloperRole: false,
        ...(mode === 'nebius' || mode === 'openrouter' ? {supportsReasoningEffort:false,supportsStore:false} : {}),
      },
    };
  }
  return {
    id, name: id, provider: account ? 'openai-codex' : 'openai', api: account ? 'openai-codex-responses' : 'openai-responses',
    baseUrl: url.toString().replace(/\/$/, ''), input: ['text', 'image'],
    reasoning: true, contextWindow: 128000, maxTokens: 4096,
    thinkingLevelMap: selectedThinkingLevelMap(config,credentials),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    // Pi emits strict:false for standard Responses. The Codex adapter emits
    // strict:null, which is explicitly patched to false below for optional fields.
    compat: { supportsMaxOutputTokens: !relay && !account, supportsStrictMode: true },
  };
}
function failure(model: ProviderModel | undefined, text: string, aborted = false): AssistantMessageEventStream {
  const stream = new AssistantMessageEventStream();
  const output: AssistantMessage = {
    role:'assistant',content:[],api:model?.api || 'openai-responses',provider:model?.provider || 'openai',model:model?.id || 'unconfigured',
    timestamp:Date.now(),stopReason:aborted ? 'aborted' : 'error',errorMessage:text.slice(0,512),
    usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},
  };
  stream.push({type:'error',reason:aborted ? 'aborted' : 'error',error:output});stream.end(output);return stream;
}
function fixedCompletionsFetch(mode: string, fetcher: typeof fetch, requestSignal?: AbortSignal): typeof fetch {
  const expected = mode === 'opencode'
    ? OPENCODE_BASE_URL + '/chat/completions'
    : mode === 'nebius'
      ? NEBIUS_BASE_URL + '/chat/completions'
      : mode === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : undefined;
  if (!expected) return fetcher;
  return (async(input: any, init?: RequestInit)=>{
    if (String(input) !== expected) throw new Error('Unexpected fixed-provider inference destination.');
    const timeout = AbortSignal.timeout(120000);
    // Keep both the wall-clock timeout and the original conversation signal
    // attached after response headers arrive so a stalled SSE body cannot hang.
    const signal = AbortSignal.any([timeout,...(init?.signal?[init.signal]:[]),...(requestSignal?[requestSignal]:[])]);
    return fetcher(expected,{...init,redirect:'error',signal});
  }) as typeof fetch;
}

const CODEX_INFERENCE_RETRIES = 3;
export const CODEX_REQUEST_TIMEOUT_MS=600000;
export const CODEX_STREAM_IDLE_TIMEOUT_MS=300000;
const CODEX_INFERENCE_ATTEMPTS = 1 + CODEX_INFERENCE_RETRIES;
const RETRYABLE_CODEX_STREAM_ERRORS = new Set(['server_error','internal_error','overloaded','service_unavailable','rate_limit_exceeded','upstream_error']);
const RETRYABLE_HTTP = new Set([408,429,500,502,503,504]);
const RETRYABLE_NETWORK = new Set(['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET']);
function retryableNetwork(error: unknown): boolean {
  const value = error as any;
  const code = value?.cause?.code ?? value?.code;
  if (typeof code === 'string') return RETRYABLE_NETWORK.has(code);
  return error instanceof TypeError && /^(fetch failed|failed to fetch|network request failed)$/i.test(error.message);
}
function retryDelay(headers: Headers | undefined, attempt: number): number {
  const milliseconds = headers?.get('retry-after-ms');
  const after = headers?.get('retry-after');
  if (milliseconds && Number.isFinite(Number(milliseconds))) return Math.max(0,Number(milliseconds));
  if (after) {
    if (Number.isFinite(Number(after))) return Math.max(0,Number(after)*1000);
    const date = Date.parse(after);
    if (Number.isFinite(date)) return Math.max(0,date-Date.now());
  }
  return 1000 * 2**attempt;
}
// Only retry an explicitly time-limited Gemini rejection before any content/tool delta.
export function geminiRetryDelay(reason: string): number | undefined {
  if (!/quota exceeded/i.test(reason) || !/per minute/i.test(reason) || /per day|billing disabled/i.test(reason)) return;
  const match = reason.match(/retry in ([0-9.]+)s/i);
  const seconds = match && Number(match[1]);
  if (seconds && seconds > 0 && seconds <= 60) return Math.ceil(seconds * 1000) + 250;
}
async function* interruptibleEvents<T>(source:AsyncIterable<T>,signal?:AbortSignal):AsyncGenerator<T> {
  const iterator=source[Symbol.asyncIterator]();let finished=false;
  try {
    while(true) {
      const next=await new Promise<IteratorResult<T>>((resolve,reject)=>{
        const abort=()=>reject(new Error('Provider stream interrupted.'));
        if(signal?.aborted){abort();return;}
        signal?.addEventListener('abort',abort,{once:true});
        iterator.next().then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));
      });
      if(next.done){finished=true;return;}
      yield next.value;
    }
  } finally {
    if(!finished)void iterator.return?.().catch(()=>{});
  }
}
function retryWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve,reject)=>{
    const abort = ()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new Error('Codex inference interrupted.'));};
    const timer = setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
    if (signal.aborted) abort();
  });
}
/** Inspect only a bounded error code, never expose provider bodies to Pi or stored diagnostics. */
async function terminalCodexError(response: Response,budget:{error?:string},signal:AbortSignal): Promise<boolean> {
  budget.error=codexFailure(response.status,undefined).message;
  if (!response.body) return !RETRYABLE_HTTP.has(response.status);
  const reader = response.body.getReader();const chunks: Uint8Array[] = [];let size = 0;
  try {
    while (true) {
      let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
      let next:ReadableStreamReadResult<Uint8Array>;
      try {
        next=await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve,reject)=>{
          abort=()=>reject(new Error('Codex error response interrupted'));
          timer=setTimeout(()=>reject(new Error('Codex error response stalled')),5000);
          signal.addEventListener('abort',abort,{once:true});
          if(signal.aborted)abort();else reader.read().then(resolve,reject);
        });
      } finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 32768) return true;
      chunks.push(next.value);
    }
    const body:unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const failure=codexFailure(response.status,body);budget.error=failure.message;return failure.terminal;
  } catch {return !RETRYABLE_HTTP.has(response.status);}
  finally {try {void reader.cancel().catch(()=>{});} catch {/* Discard remote diagnostics. */}}
}

function fixedCodexFetch(fetcher: typeof fetch, budget: {attempts:number;error?:string}, deadline: AbortSignal, requestSignal?: AbortSignal): typeof fetch {
  return (async(input: any, init?: RequestInit)=>{
    if (String(input) !== CODEX_RESPONSES_URL) throw new Error('Unexpected Codex inference destination.');
    // A single wall-clock deadline covers transport retries, SSE restarts and
    // the response body; Pi's header-only signal is not sufficient alone.
    const idle=new AbortController();
    const signal = AbortSignal.any([deadline,idle.signal,...(init?.signal?[init.signal]:[]),...(requestSignal?[requestSignal]:[])]);
    // Retry only inference transport before successful headers. Pi never retries the
    // agent loop or streamed output, and credential refresh/persistence is outside here.
    let response!: Response;
    while (budget.attempts < CODEX_INFERENCE_ATTEMPTS) {
      if (signal.aborted) throw new Error('Codex inference interrupted.');
      const attempt = budget.attempts++;
      try {
        response = await fetcher(CODEX_RESPONSES_URL,{...init,redirect:'error',signal});
      } catch (error) {
        budget.error=deadline.aborted?'Codex inference timed out. Check the phone connection and retry.':'Could not connect to Codex. Check the phone network and retry.';
        if (signal.aborted || !retryableNetwork(error) || budget.attempts===CODEX_INFERENCE_ATTEMPTS)
          throw new Error('Codex inference connection failed.');
        await retryWait(retryDelay(undefined,attempt),signal);
        continue;
      }
      if (response.ok) {budget.error=undefined;break;}
      const terminal = await terminalCodexError(response,budget,signal);
      const delay = retryDelay(response.headers,attempt);
      if (signal.aborted) throw new Error('Codex inference interrupted.');
      if (terminal || !RETRYABLE_HTTP.has(response.status) || budget.attempts===CODEX_INFERENCE_ATTEMPTS || delay>5000) {
        return new Response(JSON.stringify({error:{message:`Codex inference rejected the request (HTTP ${response.status}).`}}),{status:response.status,headers:{'content-type':'application/json'}});
      }
      await retryWait(delay,signal);
    }
    if (!response.body) throw new Error('Codex returned no event stream.');
    const reader = response.body.getReader();let bytes = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const timer=setTimeout(()=>{budget.error='The Codex response stream stalled for five minutes. Retry the request; sign-in was not changed.';idle.abort();},CODEX_STREAM_IDLE_TIMEOUT_MS);
        try {
          const next = await reader.read();
          if (next.done) {controller.close();return;}
          bytes += next.value.byteLength;
          if (bytes > 16*1024*1024) {budget.error='Codex response exceeded the mobile size limit.';await reader.cancel();throw new Error('Codex response exceeded its size limit.');}
          controller.enqueue(next.value);
        } catch {budget.error??=deadline.aborted?'Codex inference timed out. Check the phone connection and retry.':'The Codex response stream disconnected. Retry the request.';controller.error(new Error('Codex event stream ended unexpectedly.'));}
        finally {clearTimeout(timer);}
      },
      cancel: reason=>reader.cancel(reason),
    });
    return new Response(body,{status:response.status,headers:response.headers});
  }) as typeof fetch;
}

// Keep Gemini's tool declarations small and compatible with its schema limits.
// The model may navigate only source-observing phone tools; buyer checkout
// remains a separate host-controlled action after explicit approval.
const GEMINI_VISIBLE_TOOLS=new Set(['phone_browser','phone_store_app','phone_observe','phone_capabilities']);
// Gemini rejects the Android browser's full JSON schema (HTTP 400). Expose a
// small model-facing schema; host-side phone checks and buyer approval stay intact.
const GEMINI_BROWSER_INITIAL={type:'object',properties:{
 url:{type:'string',description:'Full HTTPS URL to open in Android Chrome'},
 display_target:{type:'string',enum:['physical','virtual']}
},required:['url']};
const GEMINI_BROWSER_FOLLOWUP={type:'object',properties:{
 url:{type:'string'},
 action:{type:'object',properties:{
  kind:{type:'string',enum:['click','scroll']},
  selector:{type:'object',properties:{text:{type:'string'},description:{type:'string'}}},
  direction:{type:'string',enum:['up','down']}
 },required:['kind']},
 display_target:{type:'string',enum:['physical','virtual']}
}};
function geminiModelFacingTool(tool:any,initialResearch:boolean){
 if(tool.name==='phone_browser')return {...tool,parameters:initialResearch?GEMINI_BROWSER_INITIAL:GEMINI_BROWSER_FOLLOWUP};
 if(tool.name==='phone_capabilities')return {...tool,parameters:{type:'object',properties:{}}};
 if(tool.name==='phone_observe')return {...tool,parameters:{type:'object',properties:{display_target:{type:'string',enum:['physical','virtual']}}}};
 return tool;
}
export function constrainGeminiTools(context:any,initialResearch=false):any {
 const latest=(context.messages||[]).at(-1);
 const text=String(latest?.content?.filter?.((part:any)=>part?.type==='text')?.map((part:any)=>part.text)?.join(' ')||latest?.content||'');
 const shoppingBrowser=initialResearch&&!/\b(?:Amazon|Flipkart)\b/i.test(text);
 const selected=shoppingBrowser?new Set(['phone_browser']):initialResearch?new Set(['phone_store_app']):GEMINI_VISIBLE_TOOLS;
 return {...context,messages:(context.messages||[]).map((message:any)=>
  message.role==='system'&&Array.isArray(message.toolsAdded)
   ?{...message,toolsAdded:message.toolsAdded.filter((tool:any)=>selected.has(tool.name)).map((tool:any)=>geminiModelFacingTool(tool,initialResearch))}
   :message)};
}
export function firstShoppingResearchTurn(context:any):boolean{
 const message=(context.messages||[]).at(-1);
 if(message?.role!=='user')return false;
 const text=String(Array.isArray(message.content)?message.content.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join(' '):message.content||'');
 return /\b(?:browse|search|research|find|look up|open)\b/i.test(text)&&
  /\b(?:headphones?|earbuds?|laptops?|products?|retailer|walmart|best buy|sony|jbl)\b/i.test(text);
}
export function makeStream(config: ProviderConfig, credentials: ProviderCredentials = {}, owner: any, reasoningOverride?: ReasoningEffort, supportedReasoning?: readonly ReasoningEffort[], modelSource = credentials.modelSource): StreamFn {
  if (config.mode === 'scripted') return scriptedStream(owner);
  return async(_model, context, options)=>{
    let model: ProviderModel | undefined;
    const account = accountMode(config,credentials);
    const mode = selectedMode(config,credentials);
    try {
      model = modelFor(config,credentials,_model?.id);
      if (options?.signal?.aborted) return failure(model,'Request cancelled.',true);
      let apiKey = credentials.apiKey;
      if (account) apiKey = (await ensureCodexCredentials(credentials,{signal:options?.signal,fetch:options?.fetch})).accessToken;
      else if (mode === 'opencode' && !apiKey?.trim()) return failure(model,'Configure an OpenCode Console service-account key before sending.');
      else if (mode === 'nebius' && !apiKey?.trim()) return failure(model,'Configure a Nebius API key before sending.');
      else if (!apiKey?.trim()) return failure(model,'Configure a provider credential before sending.');
      if (options?.signal?.aborted) return failure(model,'Request cancelled.',true);
      const metered=mode==='gemini'||mode==='openrouter';
      const limitKey=providerLimitKey(mode,apiKey!);
      const hold=metered?providerLimits.status(limitKey,model.id):undefined;
      if(hold)return failure(model,hold.message);
      if(metered)await waitForProvider(providerLimits.reserve(limitKey,mode==='gemini'?5000:4500),options?.signal);
      const queuedHold=metered?providerLimits.status(limitKey,model.id):undefined;
      if(queuedHold)return failure(model,queuedHold.message);
      const requestedReasoning = configurableReasoningMode(mode) && (owner === 'main' || reasoningOverride !== undefined)
        ? normalizeReasoningEffort(reasoningOverride ?? config.reasoningEffort)
        : DEFAULT_REASONING_EFFORT;
      const hasCatalogReasoning = Array.isArray(supportedReasoning);
      const advertisedReasoning = hasCatalogReasoning
        ? supportedReasoning!.filter(value => REASONING_EFFORT_SET.has(value))
        : Array.isArray(credentials.reasoningEfforts)
          ? credentials.reasoningEfforts.filter(value => REASONING_EFFORT_SET.has(value))
          : [];
      const manualModel = modelSource === 'manual' && credentials.model === model.id;
      const modelLevels = !manualModel && (hasCatalogReasoning || credentials.reasoningEffortModel === model.id)
        ? advertisedReasoning : [];
      const reasoning = modelLevels.length && !modelLevels.includes(requestedReasoning)
        ? modelLevels.includes(DEFAULT_REASONING_EFFORT) ? DEFAULT_REASONING_EFFORT : modelLevels[0]
        : !manualModel && !modelLevels.length && (account || modelSource === 'catalog')
          ? DEFAULT_REASONING_EFFORT : requestedReasoning;
      const requestDeadline=metered?AbortSignal.timeout(65000):undefined;
      const requestSignal=metered?AbortSignal.any([requestDeadline!,...(options?.signal?[options.signal]:[])]):options?.signal;
      const shared = {...options,signal:requestSignal,apiKey,transport:'sse' as const,maxRetries:0,timeoutMs:account?CODEX_STREAM_IDLE_TIMEOUT_MS:120000,reasoning};
      const budget:{attempts:number;error?:string} = {attempts:0};
      // Credential refresh is deliberately outside this retry scope.
      const deadline = account ? AbortSignal.timeout(CODEX_REQUEST_TIMEOUT_MS) : undefined;
      const retrySignal = account
        ? AbortSignal.any([deadline!,...(options?.signal?[options.signal]:[])])
        : undefined;
      const sourceFor = (onCodexEvent?: (event:any)=>void) => model!.api === 'openai-codex-responses'
        ? codexStreamSimple(model!,context,{
            ...shared,signal:retrySignal,fetch:fixedCodexFetch(options?.fetch ?? globalThis.fetch,budget,deadline!,options?.signal),
            onProviderStreamEvent:async (event,selected)=>{
              onCodexEvent?.(event);
              await options?.onProviderStreamEvent?.(event,selected);
            },
            onPayload:async(raw,selected)=>{
              const replacement = await options?.onPayload?.(raw,selected);
              const body = (replacement ?? raw) as any;
              return {...body,model:model!.id,store:false,stream:true,
                ...(Array.isArray(body.tools) ? {tools:body.tools.map((tool:any)=>tool.type==='function'?{...tool,strict:false}:tool)} : {})};
            },
          })
        : model!.api === 'google-generative-ai'
          ? googleStream(model!,constrainGeminiTools(context,owner==='main'&&firstShoppingResearchTurn(context)),owner==='main'&&firstShoppingResearchTurn(context)?{...shared,toolChoice:'any'}:shared)
        : model!.api === 'openai-completions'
          ? completionsStreamSimple(model!,context,{
              ...shared,
              fetch:fixedCompletionsFetch(mode,options?.fetch ?? globalThis.fetch,options?.signal),
            })
          : streamSimple(model!,context,shared);
      const guarded = new AssistantMessageEventStream();
      void(async()=>{
        let forwardedStart = false;
        let geminiRetried = false;
        let unavailableRetried = false;
        try {
          while (true) {
            let retryableStreamFailure = false;
            let emittedProgress = false;
            let providerProgress = false;
            let restart = false;
            let geminiWait: number | undefined;
            const source = sourceFor((event:any)=>{
              const type = event?.type;
              if (typeof type !== 'string') return;
              // The Pi adapter can buffer partial function calls before emitting
              // any consumer event. Even a single argument delta makes replay unsafe.
              if (type.startsWith('response.output_item.') || type.startsWith('response.function_call_arguments.') ||
                  type.startsWith('response.output_text.') || type.startsWith('response.reasoning_') ||
                  type.startsWith('response.refusal.') || type.startsWith('response.content_part.')) {
                providerProgress = true;
              }
              if (type !== 'response.failed' && type !== 'error') return;
              budget.error=codexFailure(undefined,event?.response?.error??event?.error??event).message;
              const code = event?.response?.error?.code ?? event?.error?.code ?? event?.code;
              retryableStreamFailure = typeof code === 'string' && RETRYABLE_CODEX_STREAM_ERRORS.has(code.toLowerCase());
            });
            for await (const event of metered?interruptibleEvents(source,requestSignal):source) {
              if ((account || metered) && event.type === 'start') {
                if (!forwardedStart) {
                  // Pi mutates its partial message when a later SSE failure arrives.
                  // Never expose the upstream object across a suppressed retry.
                  guarded.push({...event,partial:structuredClone(event.partial)});
                  forwardedStart = true;
                }
                continue;
              }
              // An SSE failure may be retried only before any visible content
              // or tool-call event. Both HTTP and SSE consume one shared budget.
              if (account && event.type === 'error' && retryableStreamFailure &&
                  !emittedProgress && !providerProgress && budget.attempts < CODEX_INFERENCE_ATTEMPTS && !retrySignal!.aborted) {
                restart = true;
                break;
              }
              if (mode === 'gemini' && event.type === 'error' && !geminiRetried && !emittedProgress && !options?.signal?.aborted) {
                geminiWait = geminiRetryDelay(event.error.errorMessage || '');
                if (geminiWait !== undefined) { geminiRetried = true; restart = true; break; }
              }
              if(metered&&event.type==='error'&&!unavailableRetried&&!emittedProgress&&!requestSignal?.aborted&&/UNAVAILABLE|high demand|\b503\b/i.test(event.error.errorMessage||'')){
                unavailableRetried=true;restart=true;geminiWait=1500;break;
              }
              const providerHold=metered&&event.type==='error'?providerLimits.reject(limitKey,model!.id,event.error.errorMessage||''):undefined;
              if (event.type !== 'error') emittedProgress = true;
              if (event.type === 'error') {
                if (account) {
                  // Do not persist raw provider diagnostics or remote failure bodies.
                  event.reason=options?.signal?.aborted?'aborted':'error';
                  event.error = {...event.error,stopReason:options?.signal?.aborted?'aborted':'error',errorMessage:options?.signal?.aborted?'Request cancelled.':deadline?.aborted?'Codex inference timed out. Check the phone connection and retry.':budget.error??'Codex inference failed. The saved sign-in may still be valid.'};
                  delete event.error.diagnostics;
                } else if (mode === 'gemini') {
                  const reason = event.error.errorMessage || '';
                  event.error.errorMessage = options?.signal?.aborted ? 'Request cancelled.'
                    : providerHold ? providerHold.message
                    : requestDeadline?.aborted ? 'The model request timed out. Progress was retained. Retry later.'
                    : /RESOURCE_EXHAUSTED|quota exceeded|\b429\b/i.test(reason) ? 'Gemini reached its request quota (HTTP 429). Retry when your quota is available.'
                    : /UNAVAILABLE|high demand|\b503\b/i.test(reason) ? 'Gemini is temporarily unavailable (HTTP 503). Retry this request later.'
                    : /API_KEY_INVALID|INVALID_API_KEY|UNAUTHENTICATED|PERMISSION_DENIED|\b403\b/i.test(reason) ? 'Gemini rejected this connection. Check the saved key and its access to the selected model.'
                    : /INVALID_ARGUMENT|\b400\b|invalid.*schema|function.*declaration/i.test(reason) ? 'Gemini rejected the tool request schema (HTTP 400). Try a supported model or fewer tools.'
                    : /NOT_FOUND|\b404\b/i.test(reason) ? 'Gemini model was not found or is unavailable for this API key (HTTP 404).'
                    : 'Gemini could not finish this request. Check the model, connection and device network.';
                  delete event.error.diagnostics;
                } else if(mode==='openrouter'){
                  const reason=event.error.errorMessage||'';
                  event.error.errorMessage=providerHold?providerHold.message:requestDeadline?.aborted?'The model request timed out. Progress was retained. Retry later.':/429|rate limit/i.test(reason)?'OpenRouter free-model request limit reached (HTTP 429). Wait for the quota to reset before continuing.'
                    : /402|credits|balance/i.test(reason)?'The selected free route is unavailable. No paid model was substituted.'
                    : redactProviderSecrets(reason||'OpenRouter request failed.',credentials).slice(0,512);
                } else event.error.errorMessage = redactProviderSecrets(event.error.errorMessage || 'Provider request failed.',credentials).slice(0,512);
              }
              guarded.push(event);
            }
            if (!restart) break;
            if (geminiWait !== undefined) await waitForProvider(Math.max(geminiWait,metered?providerLimits.reserve(limitKey,mode==='gemini'?5000:4500):0),requestSignal);
            else await retryWait(retryDelay(undefined,budget.attempts-1),retrySignal!);
          }
          // Terminal events carry the sanitized final message; do not replace it
          // with the upstream stream's unredacted error result.
          guarded.end();
        } catch {
          const aborted = !!options?.signal?.aborted;
          const terminal = await failure(model,aborted?'Request cancelled.':requestDeadline?.aborted?'The model request timed out. Progress was retained. Retry later.':'Provider stream failed; progress was retained.',aborted).result();
          guarded.push({type:'error',reason:aborted?'aborted':'error',error:terminal});guarded.end(terminal);
        }
      })();
      return guarded;
    } catch (error) {
      const aborted = !!options?.signal?.aborted;
      const message = account ? (error instanceof Error && /^(Invalid Codex|Codex account|Codex refresh|Codex token|Secure Codex|Codex account inference)/.test(error.message) ? error.message : 'Codex account connection failed; sign in again.') : error instanceof Error ? error.message : 'Provider configuration failed.';
      return failure(model,aborted?'Request cancelled.':redactProviderSecrets(message,credentials),aborted);
    }
  };
}
