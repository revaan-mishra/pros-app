import { useEffect, useState, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { dismissHint, hintDismissed } from '../contextual-hints';
import './contextual-hint.css';

/** An ordinary inline note. It never traps focus or changes work records. */
export function ContextualHint({ accountId, id, children }: { accountId: string; id: string; children: ReactNode }) {
  const key = `${accountId}\u0000${id}`;
  const [saved,setSaved] = useState(()=>({key,dismissed:hintDismissed(accountId,id)}));
  useEffect(()=>{
    const update=()=>setSaved({key,dismissed:hintDismissed(accountId,id)});
    update();window.addEventListener('storage',update);window.addEventListener('pros:hint-dismissed',update);
    return()=>{window.removeEventListener('storage',update);window.removeEventListener('pros:hint-dismissed',update);};
  },[accountId,id,key]);
  const hidden=saved.key===key?saved.dismissed:hintDismissed(accountId,id);
  if(hidden)return null;
  return <aside className="contextual-hint" aria-label="Tip"><Info size={17} aria-hidden="true"/><p>{children}</p><button type="button" aria-label="Dismiss this tip" onClick={()=>{dismissHint(accountId,id);setSaved({key,dismissed:true});window.dispatchEvent(new Event('pros:hint-dismissed'));}}><X size={16}/></button></aside>;
}
