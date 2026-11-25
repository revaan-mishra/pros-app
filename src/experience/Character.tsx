import { usePhoneLayout } from '../components/phone-layout';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, BookOpen, Brain, Check, ChevronDown, Compass, Dumbbell, Eye, Flame, LockKeyhole, MapPinned, Mountain, Palette, RotateCcw, Shield, Target, Trophy, Users } from 'lucide-react';
import { useGame } from '../app-context';
import { ATTRIBUTES, COSMETICS, REGIONS } from '../catalog';
import { Avatar } from '../components/Avatar';
import { RelicModel } from '../components/RelicModel';
import { Button, Dialog, Empty, Field, PageHeading, Progress, SectionTitle, Tag, formatNumber } from '../components/ui';
import type { AttributeId, Profile } from '../types';
import { cosmeticRequirement, equipCosmetic, previewAppearance, starterAppearance, wardrobeEffortMinutes, pickerColor } from './appearance';
import './character.css';

const ATTRIBUTE_ICONS = { strength: Dumbbell, intelligence: Brain, wisdom: BookOpen, discipline: Target, creativity: Palette, charisma: Users };
const PALETTE = [['#669d86','Fern green'],['#728bad','Dusk blue'],['#b18a69','Warm ochre'],['#9c83a7','Heather violet'],['#a3c792','Sage green']];
function useLocalDetail(accountId: string, name: string) {
  const key = `pros.ui.${accountId}.${name}`;
  const read = () => { try { return localStorage.getItem(key) !== 'false'; } catch { return true; } };
  const [choice,setChoice] = useState({key,value:read()});
  useEffect(()=>setChoice({key,value:read()}),[key]);
  return [choice.key===key?choice.value:true,(value:boolean)=>{setChoice({key,value});try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Optional appearance remains usable in memory. */}}] as const;
}
const regionFor = (id: string) => REGIONS.find(r=>r.id===id)!;

export function CharacterPage() {
  const { accountId, data, projection, save, busy } = useGame();
  const phone = usePhoneLayout();
  const [params,setParams] = useSearchParams();
  const view = ['portrait','wardrobe','milestones'].includes(params.get('view')||'') ? params.get('view')! : params.has('slot')||params.has('region') ? 'wardrobe' : 'portrait';
  const slot = ['emblem','accessory','outfit'].includes(params.get('slot')||'') ? params.get('slot')! : 'all';
  const regionFilter = REGIONS.some(r=>r.id===params.get('region')) ? params.get('region')! : 'all';
  const [avatarStyle,setAvatarStyle] = useState<Profile['avatarStyle']>(data.profile.avatarStyle);
  const [avatarColor,setAvatarColor] = useState(data.profile.avatarColor);
  const [previewId,setPreviewId] = useState<string>(); const [error,setError] = useState('');
  const [showAura,setShowAura] = useLocalDetail(accountId,'attribute-aura');
  const [showFamiliar,setShowFamiliar] = useLocalDetail(accountId,'avatar-familiar');
  useEffect(()=>{setAvatarStyle(data.profile.avatarStyle);setAvatarColor(data.profile.avatarColor);},[accountId,data.profile.avatarStyle,data.profile.avatarColor]);
  useEffect(()=>{setPreviewId(undefined);setError('');},[accountId,view]);
  const dominantAttribute = useMemo(()=>{
    const entries=Object.entries(projection.attributes).filter(([,a])=>a.xp>0).sort((a,b)=>b[1].xp-a[1].xp);
    return entries.length && !(entries.length>1 && Math.abs(entries[0][1].xp-entries[1][1].xp)<1e-8) ? entries[0][0] as AttributeId : undefined;
  },[projection.attributes]);
  const lookChanged=avatarStyle!==data.profile.avatarStyle || avatarColor!==data.profile.avatarColor;
  const appearance={...data.profile,avatarStyle,avatarColor};
  const preview=previewAppearance(appearance,projection.eligibleCosmetics,previewId);
  const changeFilter=(key:string,value:string)=>setParams(old=>{const next=new URLSearchParams(old);next.set('view','wardrobe');value==='all'?next.delete(key):next.set(key,value);return next;},{replace:true});
  const viewLink=(value:string)=>{const next=new URLSearchParams(params);next.set('view',value);return `/character?${next}`;};
  const perform=async(work:()=>Promise<unknown>)=>{setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'The appearance could not be saved.');}};
  const equip=(id:string)=>perform(async()=>{await save('profile',equipCosmetic(data.profile,projection.eligibleCosmetics,id),'Wardrobe updated');setPreviewId(undefined);});
  const achievements=[
    {title:'A beginning',detail:'Record your first practice.',earned:projection.xp>0,icon:Compass},
    {title:'Something finished',detail:'Keep a meaningful output.',earned:projection.totalOutputs>0,icon:Award},
    {title:'A guardian resolved',detail:'Complete a project and its output.',earned:projection.totalProjects>0,icon:Shield},
    {title:'First lights',detail:'Establish at least one region.',earned:REGIONS.some(r=>projection.regions[r.id].stage>0),icon:Flame},
    {title:'A living place',detail:'Fully restore one region.',earned:REGIONS.some(r=>projection.regions[r.id].stage===3),icon:Mountain},
    {title:'A world of your making',detail:'Fully restore all six regions.',earned:REGIONS.every(r=>projection.regions[r.id].stage===3),icon:MapPinned},
  ];
  const attributes = <section className="character-attributes"><SectionTitle title="Six ways of showing up" subtitle="Attributes describe the distribution of your credited practice."/><div className="character-attribute-list">{ATTRIBUTES.map(a=>{
          const value=projection.attributes[a.id];const low=(value.level-1)**2*100;const next=value.level**2*100;const Icon=ATTRIBUTE_ICONS[a.id];
          return <article key={a.id} style={{'--attribute-color':a.color} as CSSProperties}><Icon size={20}/><div><div><strong>{a.name}</strong><span>Level {value.level}</span></div><Progress label={`${a.name} progress`} value={(value.xp-low)/(next-low)} color={a.color}/><small>{formatNumber(value.xp)} XP · {formatNumber(Math.max(0,next-value.xp))} to next level</small></div></article>;
        })}</div><details className="character-explanation"><summary>What do the numbers mean?</summary><p>One credited minute earns one character XP. Skills divide that effort among their recorded attribute affinities. Attribute level is 1 + floor(√(attribute XP / 100)). These are game measures of recorded effort, not assessments of ability or personal worth.</p><Link className="text-link" to="/insights">See your activity distribution<ArrowRight size={15}/></Link></details></section>;
  return <div className="experience-page character-v3">
    <PageHeading eyebrow="THE PERSON BEHIND THE PRACTICE" title="A portrait of your practice." action={<Link className="btn btn-secondary" to="/?collection=1">Your home collection<ArrowRight size={16}/></Link>}>Choose the appearance you enjoy. Your record of work gives it a history.</PageHeading>
    <nav className="character-view-nav" aria-label="Character views">{[['portrait','Portrait'],['wardrobe','Wardrobe'],['milestones','Milestones']].map(([id,label])=><Link key={id} to={viewLink(id)} aria-current={view===id?'page':undefined}>{label}{id==='wardrobe'&&<small>{projection.eligibleCosmetics.length}/{COSMETICS.length}</small>}</Link>)}</nav>
    {view==='portrait'&&(<div className="portrait-spread">
      <section className="portrait-plate" aria-label="Your character appearance">
        <div className="portrait-inscription"><span className="eyebrow">{lookChanged?'APPEARANCE PREVIEW · UNSAVED':'CURRENT APPEARANCE'}</span><span>LEVEL {projection.character.level}</span></div>
        <div className="portrait-figure"><Avatar profile={appearance} eligibleCosmetics={projection.eligibleCosmetics} size={320} dominantAttribute={showAura?dominantAttribute:undefined} companion={showFamiliar}/></div>
        <div className="portrait-name"><h2>{data.profile.displayName}</h2><p>{projection.titles[0] || 'A path of your own'}</p></div>
        <div className="portrait-xp"><span>{formatNumber(projection.character.current)} / {formatNumber(projection.character.required)} XP to level {projection.character.level+1}</span><Progress label="Character level progress" value={projection.character.progress}/></div>
        <dl className="portrait-totals"><div><dt>Credited XP</dt><dd>{formatNumber(projection.xp)}</dd></div><div><dt>Outputs</dt><dd>{projection.totalOutputs}</dd></div><div><dt>Projects</dt><dd>{projection.totalProjects}</dd></div></dl>
      </section>
      <div className="portrait-detail">
        {!phone && attributes}

        <details className="character-look"><summary><span>Edit appearance{lookChanged&&<small>Unsaved appearance preview</small>}</span><ChevronDown size={17}/></summary><div className="character-look-content"><SectionTitle title="Your everyday appearance" subtitle="Preview changes here, then save deliberately."/><Field label="Character style"><div className="character-style-buttons" role="group" aria-label="Character style">{(['wanderer','scholar','maker'] as const).map(style=><Button key={style} variant={avatarStyle===style?'secondary':'ghost'} aria-pressed={avatarStyle===style} onClick={()=>setAvatarStyle(style)}>{style==='wanderer'?<Compass size={16}/>:style==='scholar'?<BookOpen size={16}/>:<Palette size={16}/>}<span>{style}</span>{avatarStyle===style&&<Check size={14}/>}</Button>)}</div></Field><Field label="Starter cloak color" hint="Regional outfits keep their own materials. This color appears with starter gear."><div className="character-color-buttons">{PALETTE.map(([color,label])=><button key={color} type="button" aria-label={label} aria-pressed={avatarColor===color} style={{background:color}} onClick={()=>setAvatarColor(color)}>{avatarColor===color&&<Check size={18}/>}</button>)}</div></Field><Field label="Custom cloak color"><input className="character-custom-color" type="color" value={pickerColor(avatarColor)} onChange={e=>setAvatarColor(e.target.value)}/></Field><div className="button-row"><Button disabled={busy||!lookChanged} onClick={()=>void perform(()=>save('profile',{...data.profile,avatarStyle,avatarColor},'Your appearance is saved'))}>Save appearance</Button>{lookChanged&&<Button variant="ghost" onClick={()=>{setAvatarStyle(data.profile.avatarStyle);setAvatarColor(data.profile.avatarColor);}}>Reset preview</Button>}</div><div className="character-atmosphere"><label><input type="checkbox" checked={showAura} onChange={e=>setShowAura(e.target.checked)}/><span>Attribute aura<small>A quiet glow for an untied leading attribute.</small></span></label><label><input type="checkbox" checked={showFamiliar} onChange={e=>setShowFamiliar(e.target.checked)}/><span>Olive<small>Your white Spitz, beside you.</small></span></label></div></div></details>
        {phone && <details className="character-attribute-disclosure"><summary>Attributes<ChevronDown size={17}/></summary>{attributes}</details>}
        <RelicModel motion={data.profile.motion}/>
      </div>
    </div>)}
    {view==='wardrobe'&&(<section className="character-wardrobe"><SectionTitle title="The wardrobe atlas" subtitle={`${projection.eligibleCosmetics.length} of ${COSMETICS.length} regional pieces currently available. Preview every piece on your character.`} action={<Button variant="ghost" disabled={busy||!Object.values(data.profile.equipment).some(v=>v&&!v.startsWith('starter-'))} onClick={()=>void perform(()=>save('profile',starterAppearance(data.profile),'Starter appearance equipped'))}><RotateCcw size={16}/>Wear starter gear</Button>}/><div className="wardrobe-controls"><div className="segmented" role="group" aria-label="Wardrobe category">{[['all','All pieces'],['emblem','Emblems'],['accessory','Accessories'],['outfit','Outfits']].map(([id,label])=><button key={id} className={slot===id?'active':''} aria-pressed={slot===id} onClick={()=>changeFilter('slot',id)}>{label}</button>)}</div><label className="wardrobe-region">Region<select value={regionFilter} onChange={e=>changeFilter('region',e.target.value)}><option value="all">All regions</option>{REGIONS.map(r=><option key={r.id} value={r.id}>{r.shortName}</option>)}</select></label></div>
      <div className="wardrobe-regions">{REGIONS.filter(r=>regionFilter==='all'||regionFilter===r.id).map(region=><section key={region.id} className="wardrobe-region-group" style={{'--wardrobe-color':region.color} as CSSProperties}><header><span className="wardrobe-number">0{REGIONS.indexOf(region)+1}</span><h3>{region.shortName}</h3><Link to={`/world?region=${region.id}`} aria-label={`Visit ${region.shortName}`}><ArrowRight size={17}/></Link></header>{COSMETICS.filter(item=>item.regionId===region.id&&(slot==='all'||slot===item.slot)).map(item=>{
        const unlocked=projection.eligibleCosmetics.includes(item.id);const equipped=unlocked&&data.profile.equipment[item.slot]===item.id;
        return <article className={`wardrobe-entry ${equipped?'is-equipped':''}`} key={item.id}><div><span className="eyebrow">{item.slot} · STAGE {item.stage}</span><h4>{item.name}</h4><span className="wardrobe-status">{equipped?<><Check size={13}/>Equipped</>:unlocked?'Available':<><LockKeyhole size={12}/>Not yet available</>}</span></div><Button variant="ghost" aria-label={`Preview ${item.name}`} onClick={()=>{setError('');setPreviewId(item.id);}}><Eye size={15}/>Preview</Button></article>;
      })}</section>)}</div><p className="character-note">Corrections recalculate eligibility and return invalid equipment to its starter appearance. Absence never removes earned gear.</p>
    </section>)}
    {view==='milestones'&&(<div className="character-memory-grid"><section><SectionTitle title="Moments that matter" subtitle="Recognized from your current evidence."/><div className="character-achievements">{achievements.map(a=>{const Icon=a.icon;return <article key={a.title} className={a.earned?'earned':''}><Icon size={21}/><div><h3>{a.title}</h3><p>{a.detail}</p></div>{a.earned?<Check size={16}/>:<LockKeyhole size={14}/>}</article>;})}</div></section><section><SectionTitle title="Keeper titles" subtitle="Each fully restored region gives its keeper a name."/>{projection.titles.length?<div className="character-titles">{projection.titles.map(title=><p key={title}><Trophy size={20}/>{title}</p>)}</div>:<Empty icon={Trophy} title="An open page">Restore a region to its final stage. There is no deadline.</Empty>}<Link className="text-link" to="/world">Visit your world<ArrowRight size={15}/></Link></section></div>)}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {preview.item&&<Dialog title={preview.item.name} eyebrow="APPEARANCE PREVIEW · NO PROGRESS CHANGED" onClose={()=>setPreviewId(undefined)} wide><div className="wardrobe-preview"><div className="wardrobe-preview-art"><Avatar profile={preview.profile} eligibleCosmetics={preview.renderEligible} size={300} dominantAttribute={showAura?dominantAttribute:undefined} companion={showFamiliar}/><span>Preview · {preview.item.slot}</span></div><div className="wardrobe-preview-copy"><div className="wardrobe-current"><Avatar profile={data.profile} eligibleCosmetics={projection.eligibleCosmetics} size={95}/><span>Currently saved appearance</span></div><Tag>{projection.eligibleCosmetics.includes(preview.item.id)?'Available to equip':'Preview only · locked'}</Tag><h3>{regionFor(preview.item.regionId).name} · Stage {preview.item.stage}</h3><p>{preview.item.description}</p><h4>Cumulative requirements</h4><ul className="wardrobe-requirements">{(()=>{const requirement=cosmeticRequirement(preview.item);const p=projection.regions[preview.item.regionId];return <><li><span>{wardrobeEffortMinutes(p.seconds)} / {requirement.minutes} relevant minutes</span>{p.seconds+1e-8>=requirement.minutes*60&&<Check size={16}/>}</li><li><span>{p.outcomes} / {requirement.outputs} distinct outputs</span>{p.outcomes>=requirement.outputs&&<Check size={16}/>}</li>{requirement.completedProject&&<li><span>{p.completedProjects} / 1 completed project</span>{p.completedProjects>0&&<Check size={16}/>}</li>}</>;})()}</ul><Link className="text-link" to={`/world?region=${preview.item.regionId}`} onClick={()=>setPreviewId(undefined)}>Inspect regional evidence<ArrowRight size={15}/></Link>{projection.eligibleCosmetics.includes(preview.item.id)?<Button disabled={busy} onClick={()=>void equip(preview.item!.id)}>{data.profile.equipment[preview.item.slot]===preview.item.id?'Unequip this piece':'Equip this piece'}</Button>:<p className="small muted">Previewing changes only this illustration. It grants no equipment, XP or world progress.</p>}</div></div>{error&&<p role="alert" className="form-error">{error}</p>}</Dialog>}
  </div>;
}
