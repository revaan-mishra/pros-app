import { LOCAL_AI_MODELS, boundedLocalContext, parseLocalSuggestion, type LocalAiContext, type LocalAiSuggestion, type LocalModelId } from './local-ai-models';
import { LocalAiFailure, localAiFailureKind, localAiLoadMessage, type LocalAiFailureKind } from './local-ai-errors';
export type LocalAiPhase='idle'|'checking'|'unsupported'|'loading'|'ready'|'generating'|'removing'|'error';
export interface LocalAiState { phase:LocalAiPhase;progress:number;message:string;modelId?:LocalModelId;result?:LocalAiSuggestion;resultContextKey?:string }
export interface LocalAiSession { generate(context:LocalAiContext):Promise<string>;terminate():void }
export interface LocalAiDriver { probe():Promise<{shaderF16:boolean}>;load(modelId:LocalModelId,progress:(value:number)=>void,signal:AbortSignal):Promise<LocalAiSession>;remove(signal:AbortSignal):Promise<void> }
const stopped=()=>new Error('Local AI stopped. Your saved work is unchanged.');
/** One controller per mounted account panel. It owns no persistent game data. */
export class LocalAiController {
  state:LocalAiState={phase:'idle',progress:0,message:'Local AI is optional. Written guidance and activity interpretation work without it.'};
  private listeners=new Set<()=>void>();private session?:LocalAiSession;private abort?:AbortController;private epoch=0;private disposed=false;
  constructor(private driver:LocalAiDriver){}
  activate(){if(this.disposed){this.disposed=false;this.state={phase:'idle',progress:0,message:'Local AI is optional. Written guidance and activity interpretation work without it.'};}}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  snapshot=()=>this.state;
  private update(patch:Partial<LocalAiState>){if(this.disposed)return;this.state={...this.state,...patch};this.listeners.forEach(l=>l());}
  async load(){
    if(this.disposed||['checking','loading','generating','removing'].includes(this.state.phase))return;
    this.stop(false);
    const epoch = this.epoch;
    const abort = new AbortController();
    this.abort = abort;
    this.update({phase:'checking',progress:0,result:undefined,message:'Checking this device…'});
    try{
      const support=await this.driver.probe();if(this.disposed||epoch!==this.epoch)return;
      const modelId=(support.shaderF16?LOCAL_AI_MODELS.compact:LOCAL_AI_MODELS.compatible).id;
      this.update({phase:'loading',modelId,message:'Preparing local AI files…'});
      const prepare = () => this.driver.load(modelId, value => {
        if (epoch === this.epoch) this.update({ progress: Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0 });
      }, abort.signal);
      let session: LocalAiSession;
      try {
        session = await prepare();
      } catch (error) {
        if (abort.signal.aborted || localAiFailureKind(error) !== 'download' || globalThis.navigator?.onLine === false) throw error;
        this.update({ progress: 0, message: 'Retrying the model download. Olive will reuse the files already saved.' });
        session = await prepare();
      }
      if(this.disposed||epoch!==this.epoch){session.terminate();return;}
      this.session=session;this.update({phase:'ready',progress:1,message:'Local AI is ready for this visit. Review every suggestion.'});
    } catch (error) {
      if (epoch !== this.epoch || this.disposed) return;
      const kind = this.state.phase === 'checking' ? 'graphics' : localAiFailureKind(error);
      this.update({ phase: kind === 'graphics' ? 'unsupported' : 'error', progress: 0, message: localAiLoadMessage(kind) });
    }
  }
  async generate(input:LocalAiContext,contextKey=JSON.stringify(boundedLocalContext(input))){
    if(!this.session||this.state.phase!=='ready')return;
    const context=boundedLocalContext(input),epoch=this.epoch;this.update({phase:'generating',result:undefined,message:'Olive is shaping a small next step on this device…'});
    try{
      const raw=await this.session.generate(context);if(this.disposed||epoch!==this.epoch)return;
      this.update({phase:'ready',result:parseLocalSuggestion(raw),resultContextKey:contextKey,message:'AI suggestion ready. Review and edit it before using it.'});
    }catch{if(epoch===this.epoch&&!this.disposed){this.session?.terminate();this.session=undefined;this.update({phase:'error',result:undefined,message:'Olive could not make a reliable AI suggestion. Written guidance and activity interpretation are ready below.'});}}
  }
  clearResult(){if(this.state.phase==='generating')this.stop();else this.update({result:undefined,resultContextKey:undefined});}
  stop(show=true){this.epoch++;this.abort?.abort();this.abort=undefined;this.session?.terminate();this.session=undefined;if(show)this.update({phase:'idle',progress:0,result:undefined,resultContextKey:undefined,message:stopped().message});else this.update({result:undefined,resultContextKey:undefined});}
  async remove(){if(this.disposed||this.state.phase==='removing')return;this.stop(false);const epoch=this.epoch;this.abort=new AbortController();this.update({phase:'removing',result:undefined,message:'Removing local AI files from this browser…'});try{await this.driver.remove(this.abort.signal);if(epoch===this.epoch)this.update({phase:'idle',progress:0,modelId:undefined,message:'Local AI files removed. Written guidance remains available.'});}catch{if(epoch===this.epoch)this.update({phase:'error',message:'Some model files could not be removed. Try again; your app records are unchanged.'});}}
  dispose(){this.stop(false);this.disposed=true;this.listeners.clear();}
}
interface Reply {id:number;kind:'progress'|'ready'|'result'|'removed'|'error';progress?:number;text?:string;failure?:LocalAiFailureKind}
export const LOCAL_AI_DEADLINES={load:600_000,generate:90_000,remove:30_000} as const;
function workerConnection(){
  let worker: Worker;
  try {
    worker = new Worker(new URL('./local-ai-worker.ts', import.meta.url), { type: 'module', name: 'Olive local AI' });
  } catch {
    throw new LocalAiFailure('worker');
  }
  let next=0,closed=false;const pending=new Map<number,{resolve:(reply:Reply)=>void;reject:(e:Error)=>void;progress?:(n:number)=>void;timer:ReturnType<typeof setTimeout>}>();
  const terminate = (reason = stopped()) => {
    if (closed) return;
    closed = true;
    worker.terminate();
    for (const operation of pending.values()) {
      clearTimeout(operation.timer);
      operation.reject(reason);
    }
    pending.clear();
  };
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const reply = event.data, operation = pending.get(reply.id);
    if (!operation) return;
    if (reply.kind === 'progress') {
      operation.progress?.(reply.progress || 0);
      return;
    }
    pending.delete(reply.id);
    clearTimeout(operation.timer);
    if (reply.kind === 'error') operation.reject(new LocalAiFailure(reply.failure || 'runtime'));
    else operation.resolve(reply);
  };
  worker.onerror = worker.onmessageerror = () => terminate(new LocalAiFailure('worker'));
  return {
    terminate,
    request: (kind: keyof typeof LOCAL_AI_DEADLINES, payload: object = {}, progress?: (n: number) => void) =>
      new Promise<Reply>((resolve, reject) => {
        if (closed) { reject(stopped()); return; }
        const id = ++next;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new LocalAiFailure('timeout', 'Local AI took too long.'));
          terminate();
        }, LOCAL_AI_DEADLINES[kind]);
        pending.set(id, { resolve, reject, progress, timer });
        try { worker.postMessage({ kind, id, ...payload }); }
        catch { terminate(new LocalAiFailure('worker')); }
      }),
  };
}
export const browserLocalAiDriver:LocalAiDriver={
  async probe(){
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(options: { powerPreference: string }): Promise<{
      features: ReadonlySet<string>;
      limits: { maxBufferSize: number; maxStorageBufferBindingSize: number; maxComputeWorkgroupStorageSize: number; maxStorageBuffersPerShaderStage: number };
    } | null> } }).gpu;
    if (!globalThis.isSecureContext || !gpu || typeof Worker === 'undefined') throw new LocalAiFailure('graphics');
    // Choose the same adapter that WebLLM will request in the model worker.
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new LocalAiFailure('graphics');
    const limits = adapter.limits;
    // These are the minimum buffer limits accepted by the pinned WebLLM runtime.
    if (limits.maxBufferSize < 256 * 1024 * 1024 || limits.maxStorageBufferBindingSize < 128 * 1024 * 1024 ||
        limits.maxComputeWorkgroupStorageSize < 32 * 1024 || limits.maxStorageBuffersPerShaderStage < 10) {
      throw new LocalAiFailure('graphics');
    }
    return { shaderF16: adapter.features.has('shader-f16') };
  },
  async load(modelId,progress,signal){
    const connection=workerConnection();const abort=()=>connection.terminate();signal.addEventListener('abort',abort,{once:true});
    try{if(signal.aborted)throw stopped();await connection.request('load',{modelId},progress);if(signal.aborted)throw stopped();return {generate:async context=>(await connection.request('generate',{context:boundedLocalContext(context)})).text||'',terminate(){signal.removeEventListener('abort',abort);connection.terminate();}};}catch(error){signal.removeEventListener('abort',abort);connection.terminate();throw error;}
  },
  async remove(signal){const connection=workerConnection();const abort=()=>connection.terminate();signal.addEventListener('abort',abort,{once:true});try{if(signal.aborted)throw stopped();await connection.request('remove');}finally{signal.removeEventListener('abort',abort);connection.terminate();}},
};
