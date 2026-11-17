import { useEffect, useRef, useState } from 'react';
import { clearDraft, DraftConflictError, loadDraftRecord, saveDraft } from '../storage';
import { draftJSON } from '../draft-data';

type Snapshot = { value: unknown; updatedAt?: string } | null;
/** Draft writes are serialized and compare the version that this form actually read. */
export function useDraft<T extends Record<string, unknown>>(accountId: string, name: string, initial: T, legacyName?: string, validate?: (value: unknown) => T) {
  const [value,setValue] = useState(initial); const [ready,setReady] = useState(false);
  const [status,setStatus] = useState('Opening draft…'); const [error,setError] = useState(''); const [retry,setRetry] = useState(0);
  const [competing,setCompeting] = useState<{ current: Snapshot } | null>(null);
  const expected = useRef<Snapshot | undefined>(undefined); const legacy = useRef<Snapshot>(null);
  const latest = useRef(value); latest.current = value; const raw = useRef<unknown>(initial);
  const initialized = useRef(false); const cleared = useRef(false); const aliveRef = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve()); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function restore(saved: unknown): T {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('This saved draft is unreadable. Export it before discarding.');
    if (Object.keys(saved).some(key => !Object.hasOwn(initial,key))) throw new Error('This draft contains fields this version cannot edit. Export it before discarding.');
    const restored = { ...initial };
    for (const key of Object.keys(initial) as (keyof T)[]) {
      const item = (saved as T)[key];
      if (key in saved && (typeof item !== typeof initial[key] || Array.isArray(item) !== Array.isArray(initial[key]))) throw new Error('A saved draft field is unreadable. Export the draft before discarding.');
      if (typeof item === typeof initial[key] && Array.isArray(item) === Array.isArray(initial[key])) restored[key] = item;
    }
    if (validate && 'baseRevision' in initial && !('baseRevision' in saved)) Object.assign(restored,{baseRevision:0});
    return validate ? validate(restored) : restored;
  }
  function reportConflict(e: unknown) {
    if (e instanceof DraftConflictError && aliveRef.current) setCompeting({ current:e.current });
  }
  const enqueue = (snapshot: T) => {
    queue.current = queue.current.catch(()=>{}).then(async()=>{
      if (cleared.current) return;
      if (expected.current === undefined) throw new Error('Open the saved draft before writing changes.');
      if (aliveRef.current) setStatus('Saving draft…');
      await saveDraft(accountId,name,snapshot,expected.current);
      expected.current = { value:draftJSON(snapshot) };
      if (aliveRef.current) { setError('');setCompeting(null);setStatus('Draft saved on this device'); }
    }).catch(e=>{ reportConflict(e);if(aliveRef.current){setError(e instanceof Error?e.message:'Draft could not be saved.');setStatus('Draft has not been saved');}throw e; });
    return queue.current;
  };
  useEffect(()=>{aliveRef.current=true;return()=>{aliveRef.current=false;};},[]);
  useEffect(()=>{
    let alive=true;initialized.current=false;setReady(false);setError('');
    void(async()=>{
      const current=await loadDraftRecord(accountId,name); if(!alive)return;expected.current=current;
      const old=!current&&legacyName?await loadDraftRecord(accountId,legacyName):null;if(!alive)return;legacy.current=old;
      const saved=current||old;
      if(saved){raw.current=saved.value;const checked=restore(saved.value);latest.current=checked;setValue(checked);setStatus('Draft restored from this device');}
      if(alive){initialized.current=true;setReady(true);}
    })().catch(e=>{if(alive){setError(e instanceof Error?e.message:'Saved draft could not be opened.');setStatus('Saved draft could not open. Retry or export it before discarding.');}});
    return()=>{alive=false;};
  },[accountId,name,retry]);
  useEffect(()=>{
    if(!ready||cleared.current)return;setStatus('Draft changes waiting to save…');
    timer.current=setTimeout(()=>{void enqueue(latest.current).catch(()=>{});},250);
    return()=>clearTimeout(timer.current);
  },[value,ready,accountId,name]);
  useEffect(()=>()=>{clearTimeout(timer.current);if(initialized.current&&!cleared.current)void enqueue(latest.current).catch(()=>{});},[accountId,name]);
  const flush=async()=>{clearTimeout(timer.current);await enqueue(latest.current);};
  const clear=async()=>{
    cleared.current=true;clearTimeout(timer.current);await queue.current.catch(()=>{});
    await clearDraft(accountId,name,typeof latest.current.commandId==='string'?latest.current.commandId:undefined,latest.current);
    if(legacyName&&legacy.current)await clearDraft(accountId,legacyName,undefined,legacy.current.value);
  };
  const discard=async()=>{
    if(expected.current===undefined)throw new Error('Retry opening the saved draft before discarding it.');
    clearTimeout(timer.current);cleared.current=true;await queue.current.catch(()=>{});
    // Discarding this form must not delete a competing tab's saved version.
    try { if(expected.current)await clearDraft(accountId,name,undefined,expected.current.value);
      if(legacyName&&legacy.current)await clearDraft(accountId,legacyName,undefined,legacy.current.value);
    } catch(e) { cleared.current=false;throw e; }
  };
  const keepMine=async()=>{
    clearTimeout(timer.current);await queue.current.catch(()=>{});if(!competing)return;
    expected.current=competing.current;await enqueue(latest.current);
  };
  const useSaved=async()=>{
    clearTimeout(timer.current);await queue.current.catch(()=>{});if(!competing)return;
    try{if(!competing.current)throw new Error('The other copy removed this draft. Keep your version or discard this form.');
      const checked=restore(competing.current.value);expected.current=competing.current;latest.current=checked;setValue(checked);setCompeting(null);setError('');
    }catch(e){setError(e instanceof Error?e.message:'The other draft could not be opened.');}
  };
  return [value,setValue,clear,ready,flush,{status,error,raw:ready?value:raw.current,retry:()=>{if(ready)void flush().catch(()=>{});else setRetry(i=>i+1);},discard,competing,keepMine,useSaved,reportConflict}] as const;
}
