import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Feather, ShieldCheck } from 'lucide-react';
import { useGame } from '../app-context';
import { Button, Dialog, Field } from './ui';
import { oliveAdvice } from '../assistance/olive-guide';
import { weeklyChronicle } from '../experience/chronicle-model';
import './olive.css';

export function OliveSprite({ size = 96, decorative = false }: { size?: number; decorative?: boolean }) {
  return <span className="olive-sprite" style={{ width:size, height:size }}><img src="/art/olive.webp" width="528" height="560" alt={decorative ? '' : 'Olive, a small white Spitz with a curled tail and teal collar'}/></span>;
}

export function OliveCard() {
  const [open,setOpen]=useState(false);
  return <><section className="olive-invitation" aria-label="Olive, your companion"><OliveSprite size={72} decorative/><div><span className="eyebrow">A LITTLE COMPANY</span><h2>Olive is here.</h2><p>Find a smaller next step, or look back at your week.</p></div><Button variant="ghost" onClick={()=>setOpen(true)}>Take a moment<ArrowRight size={16}/></Button></section>{open&&<OliveGuide onClose={()=>setOpen(false)}/>}</>;
}

/** Offline, evidence-bound guidance. No model/network calls or hidden game mutations. */
export function OliveGuide({ projectId, onClose }: { projectId?: string; onClose:()=>void }) {
  const { data, setModal }=useGame();const navigate=useNavigate();
  const [selected,setSelected]=useState(projectId||'');const [minutes,setMinutes]=useState(15);const [view,setView]=useState<'next'|'week'>('next');
  const advice=oliveAdvice(data,selected||undefined,minutes);const recap=weeklyChronicle(data);
  const projects=data.projects.filter(p=>!p.deleted&&!p.archived&&(p.status==='active'||p.id===selected));
  const go=(path:string)=>{onClose();navigate(path);};
  return <Dialog title="A moment with Olive" eyebrow="YOUR COMPANION" onClose={onClose} wide><div className="olive-guide">
    <header className="olive-welcome"><OliveSprite size={126}/><div><span className="olive-local"><span aria-hidden="true"/>On-device guidance</span><h3>A little clarity.<br/>Your own pace.</h3><p>Choose what would help. Every suggestion is yours to change.</p></div></header>
    <div className="olive-tabs" role="group" aria-label="Guidance topic"><button aria-pressed={view==='next'} onClick={()=>setView('next')}>Find a next step</button><button aria-pressed={view==='week'} onClick={()=>setView('week')}>Look back at my week</button></div>
    {view==='next'?<div className="olive-content"><Field label="Project"><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">My current expedition</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field><div className="olive-budget" role="group" aria-label="Time available">{[5,15,30,60].map(value=><button key={value} aria-pressed={minutes===value} onClick={()=>setMinutes(value)}>{value} min</button>)}</div><article className="olive-suggestion"><span className="eyebrow">A SUGGESTION, NOT AN ASSIGNMENT</span><h3>{advice.title}</h3><p>{advice.explanation}</p>{advice.action&&<blockquote>{advice.action}</blockquote>}{advice.finish&&<p className="olive-finish"><strong>A useful stopping point</strong>{advice.finish}</p>}<div className="button-row">{advice.state==='practice'&&<><Button onClick={()=>go(`/focus?skill=${encodeURIComponent(advice.skillId!)}&project=${encodeURIComponent(advice.projectId!)}&minutes=${minutes}${advice.questId?`&quest=${encodeURIComponent(advice.questId)}`:''}`)}>Open focus<ArrowRight size={16}/></Button><Button variant="secondary" onClick={()=>{onClose();setModal({type:'quest',projectId:advice.projectId,suggestedTitle:advice.action});}}>Edit as a next action<Feather size={16}/></Button></>}{advice.projectId&&advice.state!=='practice'&&<Button onClick={()=>go(`/projects/${encodeURIComponent(advice.projectId!)}`)}>Review project<ArrowRight size={16}/></Button>}{advice.state==='choose'&&<Button onClick={()=>go('/quests')}>Choose a project<ArrowRight size={16}/></Button>}</div></article>{(advice.tip||advice.milestone)&&<details className="olive-detail"><summary>Practice notes and the next milestone</summary>{advice.tip&&<p>{advice.tip}</p>}{advice.milestone&&<p>{advice.milestone}</p>}<p className="small muted">Milestones require actual effort and a confirmed result. Reading a suggestion changes no progress.</p></details>}</div>:<section className="olive-content olive-recap"><span className="eyebrow">{recap.from} — {recap.to}</span><h3>The work you can return to.</h3><p>{recap.statement}</p><p className="muted">What made it easier to begin? What would you like to make smaller next time?</p><div className="button-row"><Button onClick={()=>{onClose();setModal({type:'journal'});}}>Write a reflection<Feather size={16}/></Button><Button variant="secondary" onClick={()=>go('/chronicle')}>Open Chronicle<ArrowRight size={16}/></Button></div></section>}
    <footer className="olive-privacy"><ShieldCheck size={16}/><p>Works offline. Olive uses your selected project, skill guidance and activity totals. Your journal stays yours.</p></footer>
    <details className="olive-detail"><summary>How Olive works</summary><p>Olive combines written practice guides with your selected project, entirely on your device. Your writing is never sent to an AI service for these suggestions. Suggestions cannot log effort, complete work or unlock rewards.</p><p>You can also describe an activity in the activity form. Review its skill, time and date before saving; missing details are yours to fill in.</p><p>Cloud AI services are not connected to this app. You can read about the privacy choices below.</p><div className="olive-sources"><a href="https://developers.cloudflare.com/workers-ai/platform/data-usage/" target="_blank" rel="noreferrer">Cloudflare data policy</a><a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Gemini service terms</a><a href="https://webllm.mlc.ai/docs/" target="_blank" rel="noreferrer">Browser-local AI</a></div></details>
    <Link className="text-link" to="/settings?section=data" onClick={onClose}>Your data and privacy<ArrowRight size={15}/></Link>
  </div></Dialog>;
}
