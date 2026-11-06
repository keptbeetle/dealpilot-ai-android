import test from 'node:test';
import assert from 'node:assert/strict';
import {MOBILE_SESSION_BUDGET,MobileSession} from '../src/session.js';
import {AssistantMessageEventStream} from '@earendil-works/pi-ai/utils/event-stream';

const session=()=>new MobileSession('test-operator',{mode:'scripted'},{},[]);

test('provider-qualified current-model aliases are canonicalized before inference',()=>{
  const s=new MobileSession('test-operator',
    {mode:'openai',endpoint:'https://api.example.test/v1',model:'main-large'},
    {authMode:'openai',endpoint:'https://api.example.test/v1',model:'main-large',apiKey:'test-key'},[],[], '', 'openai/main-large');
  assert.equal(s.agent.state.model.id,'main-large');
});

test('long workflows exceed former turn cap and stop at the new generation cap',()=>{
  const s=session(),finish=(s.agent as any).finishTurn;
  assert.equal(MOBILE_SESSION_BUDGET.turnsPerGeneration,200);
  for(let i=0;i<MOBILE_SESSION_BUDGET.turnsPerGeneration;i++)assert.equal(finish(),undefined);
  assert.throws(()=>finish(),/Mobile generation turn budget reached/);
});

test('tool budget supports hundreds of calls and remains bounded',async()=>{
  const s=session(),before=(s.agent as any).beforeToolCall;
  assert.equal(MOBILE_SESSION_BUDGET.toolCallsPerGeneration,800);
  for(let i=0;i<MOBILE_SESSION_BUDGET.toolCallsPerGeneration;i++)assert.equal(await before(),undefined);
  await assert.rejects(async()=>before(),/Mobile tool-call budget reached/);
});
test('main yields after a successful async handoff without spending another provider request, while failed dispatch and workers continue',async()=>{
 for(const [owner,accepted,expected] of [['main',true,1],['main',false,2],['worker',true,2]] as const){
  let requests=0;
  const tool={name:'subagent',label:'Delegate',description:'Synthetic dispatch',parameters:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:JSON.stringify({action:'spawn',results:[accepted?{ok:true,conversationId:'test-worker',generation:1}:{ok:false,error:'not dispatched'}]})}],details:{}})};
  const session=new MobileSession(owner,{mode:'scripted'},{},[tool]);
  session.agent.streamFunction=(model:any)=>{
   const stream=new AssistantMessageEventStream();const call=++requests===1;
   const message:any={role:'assistant',api:model.api,provider:model.provider,model:model.id,timestamp:Date.now(),content:call?[{type:'toolCall',id:'dispatch-once',name:'subagent',arguments:{}}]:[{type:'text',text:'Finished'}],stopReason:call?'toolUse':'stop',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
   queueMicrotask(()=>{stream.push({type:'done',reason:message.stopReason,message});stream.end(message);});return stream;
  };
  await session.prompt('Delegate this task');assert.equal(requests,expected,owner+' accepted='+accepted);
 }
});

test('saved transcript survives old message and byte limits, but enforces new caps',()=>{
  const s=session();
  s.agent.state.messages.push(...Array.from({length:300},(_,i)=>({role:'user',content:[{type:'text',text:'x'}],timestamp:i} as any)));
  s.agent.state.messages.push({role:'user',content:[{type:'text',text:'x'.repeat(1_100_000)}],timestamp:1} as any);
  assert.equal(s.full(),false,'old 256-message / 1-million-character limits must no longer block');
  while(s.messages.length<MOBILE_SESSION_BUDGET.maxMessages-1)s.agent.state.messages.push({role:'user',content:[{type:'text',text:'x'}],timestamp:2} as any);
  assert.equal(s.full(),false);
  s.agent.state.messages.push({role:'user',content:[{type:'text',text:'x'}],timestamp:3} as any);
  assert.equal(s.full(),true,'new count cap must still apply');
  s.agent.state.messages.length=0;
  s.agent.state.messages.push({role:'user',content:[{type:'text',text:'x'.repeat(MOBILE_SESSION_BUDGET.maxSerializedChars)}],timestamp:4} as any);
  assert.equal(s.full(),true,'new byte cap must still apply');
});
