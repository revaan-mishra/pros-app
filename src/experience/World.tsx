import { usePhoneLayout } from '../components/phone-layout';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, Check, ChevronDown, ChevronRight, Clock3, Compass, Eye, MapPinned, Plus, Shield, Sparkles } from 'lucide-react';
import { ContextualHint } from '../components/ContextualHint';
import { useGame } from '../app-context';
import { REGIONS } from '../catalog';
import { bossProgress } from '../domain';
import { getAutoTimeOfDay, WorldArt, type SkyChoice } from '../components/WorldArt';
import { Button, Dialog, PageHeading, Progress, Tag, formatNumber } from '../components/ui';
import type { RegionId } from '../types';
import { KeepsakeGlyph } from './Scenes';
import { RegionScene } from './RegionScene';
import { keepsakesFor } from './model';
import { REGION_EXPERIENCES, regionAction, regionRequirement, residentResponse } from './regions';
import { RegionalResident } from './RegionalResident';
import './experience.css';
import './world.css';

const SKY_CHOICES: SkyChoice[] = ['auto', 'dawn', 'day', 'twilight', 'night'];
function useAtlasSky(accountId: string) {
  const key = `pros.ui.${accountId}.world-sky`;
  const read = () => {
    try { const value: unknown = JSON.parse(localStorage.getItem(key) || 'null'); return SKY_CHOICES.includes(value as SkyChoice) ? value as SkyChoice : 'auto'; }
    catch { return 'auto' as SkyChoice; }
  };
  const [choice, setChoice] = useState<{ key: string; value: SkyChoice }>(() => ({ key, value: read() }));
  useEffect(() => { setChoice({ key, value: read() }); }, [key]);
  return [choice.key === key ? choice.value : 'auto', (value: SkyChoice) => {
    if (!SKY_CHOICES.includes(value)) return;
    setChoice({ key, value });
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Presentation can remain in memory. */ }
  }] as const;
}
function practiceTime(seconds: number) {
  const rounded = Math.round(Math.max(0, seconds) * 100) / 100;
  const minutes = Math.floor(rounded / 60); const remainder = Math.round((rounded - minutes * 60) * 100) / 100;
  const subMinute = new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(remainder);
  return `${formatNumber(minutes)} min${remainder ? ` ${subMinute} sec` : ''}`;
}

export function WorldPage() {
  const { accountId, data, projection, setModal } = useGame();
  const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const phone = usePhoneLayout();
  const [regionPicker, setRegionPicker] = useState(false);
  const [skyChoice, setSkyChoice] = useAtlasSky(accountId);
  const [clock, setClock] = useState(() => new Date());
  const [previewStage, setPreviewStage] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setClock(new Date()); const timer = setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const sky = skyChoice === 'auto' ? getAutoTimeOfDay(data.profile.timeZone, clock) : skyChoice;
  const lastRegion = data.skills.find(skill => skill.id === data.profile.lastSkillId)?.regionId;
  const region = REGIONS.find(item => item.id === params.get('region')) || REGIONS.find(item => item.id === lastRegion) || REGIONS[0];
  useEffect(() => setPreviewStage(null), [region.id]);
  const place = REGION_EXPERIENCES[region.id]; const progress = projection.regions[region.id];
  const scene = place.stages[progress.stage]; const requirement = regionRequirement(progress.stage, progress);
  const allKeepsakes = useMemo(() => keepsakesFor(data), [data]);
  const keepsakes = allKeepsakes.filter(item => item.regionId === region.id);
  const skills = data.skills.filter(skill => !skill.deleted && !skill.archived && skill.regionId === region.id);
  const action = regionAction(data, region.id); const resident = residentResponse(data, region.id, { projection, now: clock.getTime() });
  const primarySkill = action.skill || skills.find(skill => skill.equipped) || skills[0];
  const projects = data.projects.filter(project => !project.deleted && !project.archived && project.regionId === region.id);
  const activeProject = action.project?.status === 'active' && !action.project.archived ? action.project : undefined;
  const stageCount = REGIONS.reduce((sum, item) => sum + projection.regions[item.id].stage, 0);
  const stages = Object.fromEntries(REGIONS.map(item => [item.id, projection.regions[item.id].stage]));
  const color = { '--place-color': region.color } as CSSProperties;
  const selectRegion = (id: RegionId) => {
    setPreviewStage(null);
    setRegionPicker(false);
    setParams(previous => { const next = new URLSearchParams(previous); next.set('region', id); return next; });
  };
  const perform = (item: typeof action | typeof resident.action) => {
    if (item.kind === 'create-skill') setModal({ type: 'skill', regionId: region.id });
    else if (item.href) navigate(item.href);
  };
  const focus = () => {
    if (!primarySkill) return;
    const query = new URLSearchParams({ skill: primarySkill.id });
    if (activeProject && activeProject.skillId === primarySkill.id) {
      query.set('project', activeProject.id);
      if (action.quest) query.set('quest', action.quest.id);
    }
    navigate(`/focus?${query}`);
  };
  const regionChoices = <nav className={phone ? "atlas-place-index atlas-region-picker" : "atlas-place-index"} aria-label="Choose a region">
        {REGIONS.map((item, index) => {
          const current = projection.regions[item.id]; const details = REGION_EXPERIENCES[item.id];
          return <button key={item.id} aria-pressed={item.id === region.id} className={item.id === region.id ? 'selected' : ''} onClick={() => selectRegion(item.id)} style={{ '--index-color': item.color } as CSSProperties}>
            <span className="atlas-place-number">0{index + 1}</span><span className="atlas-place-label"><strong>{item.shortName}</strong><small>{details.stages[current.stage].title}</small></span><span className="atlas-place-stage" aria-label={`${current.stage} of 3 stages restored`}>{[1, 2, 3].map(stage => <i key={stage} className={stage <= current.stage ? 'restored' : ''}/>)}</span><ChevronRight size={16}/>
          </button>;
        })}
      </nav>;
  const previewButton = <Button variant="secondary" onClick={() => setPreviewStage(progress.stage)}><Eye size={16}/>Preview transformations</Button>;
  const landscape = <div className="atlas-place-main">
          <div className="atlas-scene-frame"><RegionScene regionId={region.id} stage={progress.stage} keepsakes={keepsakes} timeOfDay={sky} eager><div className="place-caption"><span className="eyebrow">{region.shortName.toUpperCase()} · YOUR CURRENT PLACE</span><h2>{scene.title}</h2></div></RegionScene></div>
          <div className="atlas-scene-description"><p>{scene.detail}</p><button className="text-link" onClick={() => setModal({ type: 'story', regionId: region.id })}><BookOpen size={16}/>Read available chapters<ArrowRight size={15}/></button></div>


        {phone && previewButton}
      </div>;
  const nextPanel = <aside className="atlas-instrument-panel" aria-label={`${region.shortName} requirements and actions`}>
          <div className="atlas-next-landmark">
            <div className="atlas-primary-action"><span className="eyebrow">A USEFUL NEXT STEP</span><h4>{action.label}</h4><p>{action.detail}</p><Button onClick={() => perform(action)}>{action.kind === 'create-skill' ? <Plus size={16}/> : <ArrowRight size={16}/>} {action.kind === 'project' ? 'Open expedition' : action.kind === 'practice' ? 'Start focus' : 'Create a skill'}</Button></div>
            <p className="eyebrow">{requirement ? `NEXT · RESTORATION ${requirement.stage}` : 'THE PLACE IS FLOURISHING'}</p>
            <h3>{requirement ? place.stages[requirement.stage].title : 'There is still room for your next work.'}</h3>
            <p className="muted">{requirement ? 'These are cumulative requirements. Relevant practice and distinct results are both needed.' : 'The campaign here is complete. Keep making projects, keeping results and giving them a place at home.'}</p>
            {requirement ? <div className="atlas-requirements">
              <div><span><Clock3 size={16}/>Relevant practice</span><strong>{practiceTime(progress.seconds)} / {requirement.minutes} min</strong></div><Progress label={`${region.shortName} next effort requirement`} value={progress.minutes / requirement.minutes} color={region.color}/><p>{requirement.remainingMinutes > 0 ? `${practiceTime(requirement.remainingMinutes * 60)} more practice needed` : 'Effort requirement met'}</p>
              <div><span><Award size={16}/>Distinct outputs</span><strong>{progress.outcomes} / {requirement.outcomes}</strong></div><Progress label={`${region.shortName} next output requirement`} value={progress.outcomes / requirement.outcomes} color={region.color}/><p>{requirement.remainingOutcomes ? `${requirement.remainingOutcomes} more ${requirement.remainingOutcomes === 1 ? 'result' : 'results'} needed` : 'Output requirement met'}</p>
              {requirement.requiresProject && <div className="atlas-project-requirement"><Shield size={16}/><span>Including a completed project</span>{progress.completedProjects ? <><Check size={17} aria-hidden="true"/><span className="sr-only">Requirement met</span></> : <strong>Still needed</strong>}</div>}
            </div> : <div className="atlas-complete-mark"><Sparkles size={22}/><span>{practiceTime(progress.seconds)}<small>{progress.outcomes} distinct results · {progress.completedProjects} completed projects</small></span></div>}

            {primarySkill && <div className="atlas-capture-actions"><Button variant="secondary" onClick={() => setModal({ type: 'log', options: { skillId: primarySkill.id, ...(activeProject && activeProject.skillId === primarySkill.id ? { projectId: activeProject.id } : {}) } })}><Plus size={16}/>Log activity</Button><Button variant="ghost" onClick={() => setModal({ type: 'output', skillId: primarySkill.id })}><Award size={16}/>Record output</Button>{action.kind === 'project' && <Button variant="ghost" onClick={focus}><Clock3 size={16}/>Start regional focus</Button>}</div>}
            <Link className="evidence-link" to={`/skills?view=all&region=${region.id}`}>Explore related skills<ArrowRight size={15}/></Link>
          </div>
        </aside>;
  const atlasHint = <ContextualHint accountId={accountId} id="atlas-v1">Choose a named place; its next requirement and action appear together. Appearance previews grant no progress.</ContextualHint>;
  return <div className="experience-page atlas-page" style={color}>
    <PageHeading eyebrow="THE FIELD ATLAS" title="A world with your work in it." action={<Tag tone="success"><MapPinned size={15}/>{stageCount} / 18 restored</Tag>}>Six places, changed by the things you practice and finish. Everything you have restored stays through time away.</PageHeading>

    {!phone && atlasHint}
    {phone ? <Button variant="secondary" className="atlas-change-region" aria-haspopup="dialog" onClick={() => setRegionPicker(true)}>
      <MapPinned size={18}/><span><small>Change region</small>{region.shortName}</span><ChevronRight size={17}/>
    </Button> : <div className="atlas-region-switcher">{regionChoices}</div>}

    <section className="atlas-place" aria-labelledby="selected-place-title">
      <div className="atlas-place-heading"><div><p className="eyebrow">{region.domain.toUpperCase()} · {progress.stage} / 3 RESTORED</p><h2 id="selected-place-title" tabIndex={-1}>{place.placeName}</h2></div>{!phone && previewButton}</div>
      <div className="atlas-place-layout">
        {phone ? <>{nextPanel}{landscape}</> : <>{landscape}{nextPanel}</>}
      </div>
    </section>

    {phone && atlasHint}
    <details className="atlas-map-disclosure atlas-disclosure"><summary><span>Explore the valley map<small>Six places · sky and lighting controls</small></span><ChevronDown size={17}/></summary><div className="atlas-disclosure-content"><div className="atlas-map-sheet">
        <div className="atlas-map-top"><div><span className="eyebrow">THE VALLEY & ITS SIX PLACES</span><h2 id="atlas-index-heading">Choose where to return.</h2></div><label className="atlas-sky"><span>Sky</span><select value={skyChoice} onChange={event => setSkyChoice(event.target.value as SkyChoice)}><option value="auto">Local time</option><option value="dawn">Dawn</option><option value="day">Daylight</option><option value="twilight">Twilight</option><option value="night">Night</option></select></label></div>
        <div className="atlas-map-picture" aria-hidden="true"><WorldArt stages={stages} activeRegion={region.id} compact timeOfDay={sky}/></div>
        <p className="atlas-map-note">{skyChoice === 'auto' ? `Light follows your ${data.profile.timeZone} clock.` : 'A different light, with the same earned progress.'} Choose a named place in the list.</p>
      </div></div></details>

    <details className="atlas-path-section atlas-disclosure"><summary><span>Restoration path<small>{progress.stage} of 3 stages restored · preview every transformation</small></span><ChevronDown size={17}/></summary><div className="atlas-disclosure-content"><section className="atlas-current-changes"><h3>In the current scene</h3><ul>{scene.changes.map(change=><li key={change}>{change}</li>)}</ul><p>The scene follows eligible records. Corrections update the place with them.</p></section><div className="atlas-section-heading"><div><p className="eyebrow">THE CHANGES YOUR WORK MAKES</p><h2 id="restoration-path-title">Three restorations. One connected place.</h2></div><p>All requirements are cumulative. No attendance deadline.</p></div><ol className="atlas-restoration-path">{place.stages.slice(1).map((item, index) => {
      const step = index + 1; const gate = regionRequirement(index)!; const reached = progress.stage >= step;
      return <li key={item.title} className={reached ? 'reached' : ''}><div className="atlas-path-status"><span>{reached ? <Check size={18}/> : `0${step}`}</span><Tag>{progress.stage === step ? 'Current' : reached ? 'Restored' : 'Ahead'}</Tag></div><h3>{item.title}</h3><ul>{item.changes.map(change => <li key={change}>{change}</li>)}</ul><p className="atlas-stage-gate">{gate.minutes} minutes · {gate.outcomes} {gate.outcomes === 1 ? 'output' : 'outputs'}{gate.requiresProject ? ' · one completed project' : ''}</p><button className="text-link" onClick={() => setPreviewStage(step)}>Preview appearance<Eye size={15}/></button></li>;
    })}</ol></div></details>

    <details className="atlas-evidence-section atlas-disclosure"><summary><span>Results & guardian projects<small>{keepsakes.length} kept {keepsakes.length===1?'result':'results'} · {projects.length} {projects.length===1?'project':'projects'}</small></span><ChevronDown size={17}/></summary><div className="atlas-disclosure-content"><div className="atlas-section-heading"><div><p className="eyebrow">WORK WITH A PLACE HERE</p><h2 id="atlas-evidence-title">The records behind the restoration.</h2></div><Link className="text-link" to="/outputs">All output records<ArrowRight size={15}/></Link></div><div className="atlas-evidence-layout"><div><h3>Finished results · {keepsakes.length}</h3>{keepsakes.length ? <div className="atlas-keepsake-list">{keepsakes.slice(0, 6).map(item => <Link key={item.id} to={`/?collection=1&keepsake=${encodeURIComponent(item.id)}`}><KeepsakeGlyph kind={item.kind}/><span><strong>{item.output.title}</strong><small>{item.source}</small></span><ArrowRight size={15}/></Link>)}</div> : <p className="muted">Your first confirmed result will appear here. Previewing a restored place does not create evidence.</p>}<Link className="evidence-link" to="/?collection=1">Arrange the six home display slots<ArrowRight size={15}/></Link></div><div><h3>{region.guardian}</h3><p className="muted">{progress.stage === 3 ? 'Keep a new project here whenever you need a direction.' : place.mystery}</p>{projects.length ? <div className="atlas-project-list">{projects.map(project => <Link to={`/projects/${project.id}`} key={project.id}><span><strong>{project.title}</strong><small>{project.status} · {Math.round(bossProgress(project, data) * 100)}% resolved</small></span><ArrowRight size={15}/></Link>)}</div> : <p className="small muted">A project gives this region's guardian challenge a real finish.</p>}{primarySkill ? <Button variant="secondary" onClick={() => setModal({ type: 'project', skillId: primarySkill.id })}><Compass size={16}/>Start a project here</Button> : <Button variant="secondary" onClick={() => setModal({ type: 'skill', regionId: region.id })}><Plus size={16}/>Create a regional skill</Button>}</div></div></div></details>
    <div className="atlas-resident"><RegionalResident regionId={region.id} response={resident} onAction={() => perform(resident.action)}/></div>

    {phone && regionPicker && <Dialog title="Choose a region" onClose={() => setRegionPicker(false)} className="region-picker-sheet">{regionChoices}</Dialog>}
    {previewStage !== null && <Dialog title="The shape of a restored place" eyebrow="APPEARANCE PREVIEW · NO PROGRESS CHANGED" onClose={() => setPreviewStage(null)} wide><div className="atlas-preview-scene"><RegionScene regionId={region.id} stage={previewStage} keepsakes={keepsakes} timeOfDay={sky}/></div><div className="stage-preview-controls" role="group" aria-label="Restoration appearance preview">{place.stages.map((item, index) => <button key={item.title} className={previewStage === index ? 'selected' : ''} aria-pressed={previewStage === index} onClick={() => setPreviewStage(index)}>{index === 0 ? 'Before' : `Stage ${index}`}</button>)}</div><h3>{place.stages[previewStage].title}</h3><p>{place.stages[previewStage].detail}</p><ul>{place.stages[previewStage].changes.map(change => <li key={change}>{change}</li>)}</ul><p className="small muted">This is an appearance preview. Your actual region remains at stage {progress.stage}. Chapters open through your real records; previewing adds no effort, output, equipment or story access.</p></Dialog>}
  </div>;
}
