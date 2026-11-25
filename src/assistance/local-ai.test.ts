import { describe,expect,it,vi } from 'vitest';
import { LocalAiController,type LocalAiDriver,type LocalAiSession } from './local-ai-runtime';
import { LocalAiFailure, localAiFailureKind } from './local-ai-errors';
import { LOCAL_AI_MODELS,boundedLocalContext,localAiMessages,parseLocalSuggestion,removeLocalModelFiles } from './local-ai-models';
const context={projectTitle:'A working prototype',skillName:'Frontend',nextAction:'Make the first screen',outputCriterion:'A usable page',minutes:15};
const pending=<T>()=>{let resolve!:(value:T)=>void;let reject!:(e:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(){const terminate=vi.fn();const session:LocalAiSession={generate:vi.fn(async()=>JSON.stringify({action:'Build one small screen',finish:'Save a screenshot and next question'})),terminate};const driver:LocalAiDriver={probe:vi.fn(async()=>({shaderF16:true})),load:vi.fn(async()=>session),remove:vi.fn(async()=>{})};return {driver,session,terminate,controller:new LocalAiController(driver)};}
describe('optional account-scoped local AI',()=>{
 it('opens with no runtime or model request and loads only after explicit action',async()=>{const f=fixture();expect(f.driver.probe).not.toHaveBeenCalled();expect(f.driver.load).not.toHaveBeenCalled();await f.controller.load();expect(f.driver.load).toHaveBeenCalledWith(LOCAL_AI_MODELS.compact.id,expect.any(Function),expect.any(AbortSignal));expect(f.controller.state.phase).toBe('ready');});
 it('selects the f32 model when shader-f16 is absent',async()=>{const f=fixture();f.driver.probe=vi.fn(async()=>({shaderF16:false}));await f.controller.load();expect(f.controller.state.modelId).toBe(LOCAL_AI_MODELS.compatible.id);});
 it('keeps written and parser fallbacks when WebGPU is unavailable',async()=>{const f=fixture();f.driver.probe=vi.fn(async()=>{throw Error('No GPU');});await f.controller.load();expect(f.driver.load).not.toHaveBeenCalled();expect(f.controller.state.phase).toBe('unsupported');expect(f.controller.state.message).toContain('parser');});
 it('retries an interrupted download once with the same worker cancellation signal', async () => {
   const f = fixture();
   const load = vi.fn<LocalAiDriver['load']>().mockRejectedValueOnce(new LocalAiFailure('download')).mockResolvedValueOnce(f.session);
   f.driver.load = load;
   await f.controller.load();
   expect(load).toHaveBeenCalledTimes(2);
   expect(load.mock.calls[1][2]).toBe(load.mock.calls[0][2]);
   expect(f.controller.state.phase).toBe('ready');
 });
 it('bounds repeated download failures and shows a connection-specific message', async () => {
   const f = fixture();
   f.driver.load = vi.fn(async () => { throw new LocalAiFailure('download'); });
   await f.controller.load();
   expect(f.driver.load).toHaveBeenCalledTimes(2);
   expect(f.controller.state.phase).toBe('error');
   expect(f.controller.state.message).toContain('connection');
 });
 it('shows storage recovery and avoids retrying a quota failure', async () => {
   const f = fixture();
   const failure = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
   expect(localAiFailureKind(failure)).toBe('storage');
   f.driver.load = vi.fn(async () => { throw failure; });
   await f.controller.load();
   expect(f.driver.load).toHaveBeenCalledOnce();
   expect(f.controller.state.message).toContain('Remove model files');
 });
 it('does not adopt a model that finishes loading after stop or account disposal',async()=>{const f=fixture(),load=pending<LocalAiSession>();f.driver.load=vi.fn(()=>load.promise);const job=f.controller.load();await Promise.resolve();f.controller.dispose();load.resolve(f.session);await job;expect(f.terminate).toHaveBeenCalledOnce();expect(f.controller.state.phase).not.toBe('ready');});
 it('permits one request and ignores an old account’s late generation',async()=>{const f=fixture(),generation=pending<string>();f.session.generate=vi.fn(()=>generation.promise);await f.controller.load();const job=f.controller.generate(context);await f.controller.generate(context);expect(f.session.generate).toHaveBeenCalledTimes(1);f.controller.dispose();generation.resolve(JSON.stringify({action:'Old private suggestion',finish:'Old context'}));await job;expect(f.controller.state.result).toBeUndefined();expect(f.terminate).toHaveBeenCalledOnce();});
 it('rejects malformed model output rather than converting it into an action',async()=>{const f=fixture();f.session.generate=vi.fn(async()=>'{"action":"Grant XP","finish":"done","command":{"xp":1000}}');await f.controller.load();await f.controller.generate(context);expect(f.controller.state.phase).toBe('error');expect(f.controller.state.result).toBeUndefined();expect(f.controller.state.message).toContain('interpretation');});
 it('clears generated context and releases GPU resources before removal',async()=>{const f=fixture();await f.controller.load();await f.controller.generate(context);expect(f.controller.state.result?.action).toBeDefined();await f.controller.remove();expect(f.terminate).toHaveBeenCalledOnce();expect(f.driver.remove).toHaveBeenCalledWith(expect.any(AbortSignal));expect(f.controller.state.result).toBeUndefined();expect(f.controller.state.phase).toBe('idle');});
 it('survives a development effect cleanup and reactivation without reviving old results',async()=>{const f=fixture();await f.controller.load();f.controller.dispose();f.controller.activate();await f.controller.load();expect(f.controller.state.phase).toBe('ready');expect(f.driver.load).toHaveBeenCalledTimes(2);});
});
describe('bounded model proposals and minimum context',()=>{
 it('sends only explicitly selected fields, never additional journals, IDs or history',()=>{const input={...context,journal:'PRIVATE',accountId:'firebase:secret',activities:['HISTORY']};const messages=JSON.stringify(localAiMessages(input));expect(messages).not.toContain('PRIVATE');expect(messages).not.toContain('firebase:secret');expect(messages).not.toContain('HISTORY');expect(messages).toContain('A working prototype');expect(boundedLocalContext({...context,projectTitle:'a'.repeat(999)}).projectTitle).toHaveLength(200);});
 it('rejects unsafe budgets, unbounded text and structured commands',()=>{expect(()=>boundedLocalContext({...context,minutes:999})).toThrow();expect(()=>parseLocalSuggestion('x'.repeat(4001))).toThrow();expect(()=>parseLocalSuggestion('{"action":"a","finish":"b","command":"save"}')).toThrow();expect(()=>parseLocalSuggestion('{"action":"a","finish":""}')).toThrow();expect(parseLocalSuggestion('{"action":" A small action ","finish":" A stopping point "}')).toEqual({action:'A small action',finish:'A stopping point'});});
});

it('removes only the configured model URLs without opening the damaged manifest', async () => {
  const model = { model: 'https://example.test/model/resolve/abc/', model_lib: 'https://example.test/runtime.wasm' };
  const damagedManifest = new Request(model.model + 'tensor-cache.json');
  const shard = new Request(model.model + 'params_shard_0.bin');
  const unrelated = new Request('https://example.test/other/params_shard_0.bin');
  const modelCache = { keys: async () => [damagedManifest, shard, unrelated], delete: vi.fn(async () => true) };
  const runtimeCache = { keys: async () => [new Request(model.model_lib), unrelated], delete: vi.fn(async () => true) };
  const storage = {
    has: async (name: string) => name !== 'webllm/config',
    open: async (name: string) => name === 'webllm/model' ? modelCache : runtimeCache,
  };

  await removeLocalModelFiles(storage as unknown as CacheStorage, [model]);

  expect(modelCache.delete.mock.calls).toEqual([[damagedManifest, { ignoreVary: true }], [shard, { ignoreVary: true }]]);
  expect(runtimeCache.delete).toHaveBeenCalledExactlyOnceWith(new Request(model.model_lib), { ignoreVary: true });
});

describe('worker deadline and abort behavior',()=>{
 it('checks the model adapter’s required limit before downloading weights', async () => {
   const requestAdapter = vi.fn(async () => ({
     features: new Set(['shader-f16']),
     limits: {
       maxBufferSize: 256 * 1024 * 1024,
       maxStorageBufferBindingSize: 128 * 1024 * 1024,
       maxComputeWorkgroupStorageSize: 32 * 1024,
       maxStorageBuffersPerShaderStage: 8,
     },
   }));
   vi.stubGlobal('navigator', { gpu: { requestAdapter } });
   vi.stubGlobal('Worker', class {});
   vi.stubGlobal('isSecureContext', true);
   try {
     const { browserLocalAiDriver } = await import('./local-ai-runtime');
     await expect(browserLocalAiDriver.probe()).rejects.toMatchObject({ kind: 'graphics' });
     expect(requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance' });
   } finally {
     vi.unstubAllGlobals();
   }
 });
 it('terminates a silent worker and rejects model loading at the deadline',async()=>{
  vi.useFakeTimers();const terminate=vi.fn();class SilentWorker{onmessage=null;onerror=null;onmessageerror=null;terminate=terminate;postMessage=vi.fn();}
  vi.stubGlobal('Worker',SilentWorker);
  try{const {browserLocalAiDriver,LOCAL_AI_DEADLINES}=await import('./local-ai-runtime');const job=browserLocalAiDriver.load(LOCAL_AI_MODELS.compatible.id,()=>{},new AbortController().signal);const rejection=expect(job).rejects.toThrow('too long');await vi.advanceTimersByTimeAsync(LOCAL_AI_DEADLINES.load);await rejection;expect(terminate).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();vi.useRealTimers();}
 });
 it('rejects an in-flight download immediately when its account panel is cancelled',async()=>{
  const terminate=vi.fn();class SilentWorker{onmessage=null;onerror=null;onmessageerror=null;terminate=terminate;postMessage=vi.fn();}
  vi.stubGlobal('Worker',SilentWorker);
  try{const {browserLocalAiDriver}=await import('./local-ai-runtime');const abort=new AbortController();const job=browserLocalAiDriver.load(LOCAL_AI_MODELS.compatible.id,()=>{},abort.signal);const rejection=expect(job).rejects.toThrow('stopped');abort.abort();await rejection;expect(terminate).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();}
 });
});

it.each(['generate','remove'] as const)('bounds a silent %s request and terminates its worker',async kind=>{
 vi.useFakeTimers();const terminate=vi.fn();class WorkerDouble{onmessage:((event:MessageEvent)=>void)|null=null;onerror=null;onmessageerror=null;terminate=terminate;postMessage(message:{id:number;kind:string}){if(message.kind==='load')queueMicrotask(()=>this.onmessage?.({data:{id:message.id,kind:'ready'}} as MessageEvent));}}
 vi.stubGlobal('Worker',WorkerDouble);
 try{const {browserLocalAiDriver,LOCAL_AI_DEADLINES}=await import('./local-ai-runtime');const signal=new AbortController().signal;const session=kind==='generate'?await browserLocalAiDriver.load(LOCAL_AI_MODELS.compatible.id,()=>{},signal):undefined;const job=kind==='generate'?session!.generate(context):browserLocalAiDriver.remove(signal);const rejection=expect(job).rejects.toThrow('too long');await vi.advanceTimersByTimeAsync(LOCAL_AI_DEADLINES[kind]);await rejection;expect(terminate).toHaveBeenCalledOnce();}finally{vi.unstubAllGlobals();vi.useRealTimers();}
});

it('binds each accepted result to its explicitly selected project context',async()=>{
 const f=fixture();await f.controller.load();await f.controller.generate(context,'project-a:revision-1|selected-context');expect(f.controller.state.resultContextKey).toBe('project-a:revision-1|selected-context');
 const belongs=(current:string)=>f.controller.state.resultContextKey===current?f.controller.state.result:undefined;
 expect(belongs('project-b:revision-1|selected-context')).toBeUndefined();expect(belongs('project-a:revision-2|selected-context')).toBeUndefined();expect(belongs('project-a:revision-1|selected-context')?.action).toBeDefined();
 f.controller.clearResult();expect(f.controller.state.result).toBeUndefined();expect(f.controller.state.resultContextKey).toBeUndefined();
});
