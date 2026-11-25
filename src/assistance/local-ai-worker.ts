import { MLCEngine, prebuiltAppConfig, type AppConfig } from '@mlc-ai/web-llm';
import { LOCAL_AI_MODELS, localAiMessages, removeLocalModelFiles, type LocalAiContext, type LocalModelId } from './local-ai-models';
import { LocalAiFailure, localAiFailureKind } from './local-ai-errors';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(value:unknown)=>void};
const appConfig:AppConfig={cacheBackend:'cache',model_list:Object.values(LOCAL_AI_MODELS).map(info=>{const record=prebuiltAppConfig.model_list.find(model=>model.model_id===info.id);if(!record)throw Error('Unsupported local model.');return {...record,model:`${info.repository}/resolve/${info.revision}/`,overrides:{...record.overrides,context_window_size:1024}};})};
let engine:MLCEngine|undefined;let occupied=false;
scope.onmessage=async(event:MessageEvent<{id:number;kind:string;modelId?:LocalModelId;context?:LocalAiContext}>)=>{
  const request=event.data;if(occupied){scope.postMessage({id:request.id,kind:'error'});return;}occupied=true;
  try{
    if(request.kind==='load'){
      if (!(navigator as Navigator & { gpu?: unknown }).gpu) throw new LocalAiFailure('graphics');
      if(!appConfig.model_list.some(model=>model.model_id===request.modelId))throw Error('Unsupported local model.');
      await engine?.unload();engine=new MLCEngine({appConfig,logLevel:'ERROR',initProgressCallback:progress=>scope.postMessage({id:request.id,kind:'progress',progress:progress.progress})});
      await engine.reload(request.modelId!);scope.postMessage({id:request.id,kind:'ready'});
    }else if(request.kind==='generate'){
      if(!engine||!request.context)throw Error('Local AI is not ready.');
      await engine.resetChat();
      const result=await engine.chat.completions.create({messages:localAiMessages(request.context),temperature:.35,max_tokens:180,stream:false,response_format:{type:'json_object',schema:JSON.stringify({type:'object',properties:{action:{type:'string',maxLength:200},finish:{type:'string',maxLength:400}},required:['action','finish'],additionalProperties:false})}});
      const text=result.choices[0]?.message.content||'';await engine.resetChat();scope.postMessage({id:request.id,kind:'result',text});
    }else if(request.kind==='remove'){
      await engine?.unload();
      engine = undefined;
      await removeLocalModelFiles(caches, appConfig.model_list);
      scope.postMessage({ id: request.id, kind: 'removed' });
    }else throw Error('Unsupported local request.');
  }catch(error){scope.postMessage({id:request.id,kind:'error',failure:localAiFailureKind(error)});}finally{occupied=false;}
};
