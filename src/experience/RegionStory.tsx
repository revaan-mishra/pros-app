import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LockKeyhole } from 'lucide-react';
import { useGame } from '../app-context';
import { REGIONS } from '../catalog';
import { Button, Dialog } from '../components/ui';
import type { RegionId } from '../types';
import { RegionScene, sceneStage } from './RegionScene';
import { keepsakesFor } from './model';
import { REGION_EXPERIENCES } from './regions';

export function RegionStory({ regionId, close }: { regionId: RegionId; close: () => void }) {
  const { data, projection } = useGame();
  const region = REGIONS.find(r=>r.id===regionId)!; const place = REGION_EXPERIENCES[regionId];
  const eligible = sceneStage(projection.regions[regionId].stage);
  const [choice,setChoice] = useState(eligible); const chapter = Math.min(choice,eligible); const scene = place.stages[chapter];
  return <Dialog title={place.placeName} eyebrow={`${region.shortName.toUpperCase()} · AUTHORED CHAPTERS`} onClose={close} wide>
    <div className="region-story"><RegionScene regionId={regionId} stage={chapter} keepsakes={keepsakesFor(data).filter(k=>k.regionId===regionId)}/>
      <div className="chapter-navigation" role="group" aria-label="Read an available chapter">{place.stages.map((item,i)=><button key={item.title} disabled={i>eligible} aria-pressed={chapter===i} onClick={()=>setChoice(i)}>{i>eligible?<LockKeyhole size={13}/>:<BookOpen size={13}/>} {i===0?'Arrival':`Chapter ${i}`}<br/>{item.title}</button>)}</div>
      <article className="story-prose" aria-live="polite"><p className="eyebrow">{place.caretaker.name} · {place.caretaker.role}</p><h3>{scene.chapterTitle}</h3>{scene.chapter.map(p=><p key={p}>{p}</p>)}<p className="chapter-evidence">Chapters follow your currently eligible restoration stages. Corrections can change access; your own journal writing is preserved. Reading a chapter adds no XP.</p><Link className="evidence-link" to={`/world?region=${regionId}`} onClick={close}>Inspect this place’s evidence</Link></article>
    </div><Button onClick={close}>Close chapter</Button>
  </Dialog>;
}
