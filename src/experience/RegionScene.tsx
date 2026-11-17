import { memo, useEffect, useState, type ReactNode } from 'react';
import type { RegionId } from '../types';
import type { TimeOfDay } from '../components/WorldArt';
import type { Keepsake } from './model';
import { AtelierScene, KeepsakeGlyph } from './Scenes';
import './regional-scenes.css';

export function sceneStage(stage: number) { return Number.isFinite(stage) ? Math.min(3, Math.max(0, Math.floor(stage))) : 0; }
export function regionSceneAsset(region: RegionId, stage: number) {
  if (region === 'atelier') return sceneStage(stage) === 3 ? '/art/atelier-flourish.webp' : '/art/atelier.webp';
  if (region === 'sanctuary') return sceneStage(stage) === 3 ? '/art/sanctuary.webp' : '/art/sanctuary-base.webp';
  return `/art/${region}.webp`;
}

/** Small authored foreground instruments, aligned to the painting's own coordinate system. */
function ObservatoryLayers({ stage }: { stage: number }) {
  return <>
    {stage >= 1 && <g data-landmark="aligned-telescope" stroke="#bba477" strokeWidth="5" strokeLinejoin="round"><ellipse cx="778" cy="724" rx="90" ry="14" fill="#141d21" opacity=".65" stroke="none"/><path d="m778 570-82 148m82-148 83 148m-83-148v159" stroke="#71563b" strokeWidth="16"/><path d="m778 570-82 148m82-148 83 148m-83-148v159" strokeWidth="3"/><circle cx="778" cy="561" r="31" fill="#524533"/><g transform="rotate(-28 778 520)"><rect x="640" y="490" width="280" height="62" rx="9" fill="#756046"/><path d="M659 490v62m224-62v62m-191-62v62"/><ellipse cx="920" cy="521" rx="15" ry="32" fill="#15272f"/><ellipse cx="921" cy="520" rx="9" ry="23" stroke="#9eaca3" strokeWidth="2"/><path d="M640 507h-37v26h37" fill="#4f4639"/></g></g>}
    {stage >= 2 && <g data-landmark="chart-room"><path d="m58 472 228-12 9 129-238 17Z" fill="#b7a581" stroke="#806e4c" strokeWidth="4"/><path d="m79 503 174-12m-165 43 181-13m-99-47 5 112" stroke="#666d64" strokeWidth="2" opacity=".65"/><circle cx="171" cy="529" r="41" fill="none" stroke="#7a6d51" strokeWidth="2"/><path d="m130 527 83 4m-45-44 5 82" stroke="#817154" strokeWidth="2"/><path d="m1190 585 43-1 4 139-44 1Zm50-14 28 2-7 151-27-2Zm39 27 41-4 13 130-45 3Z" fill="#53646b" stroke="#a08a5f" strokeWidth="3"/></g>}
    {stage >= 3 && <g data-landmark="living-sky-atlas" stroke="#d0c8a6" strokeWidth="2" fill="#e4d4aa" opacity=".85"><path d="m579 239 88 37 77-77 93 93 99-41 61 87M667 276l28 106 91-18 51-72m-51 72 82 75 129-101" fill="none" opacity=".55"/>{[[579,239],[667,276],[744,199],[837,292],[936,251],[997,338],[695,382],[786,364],[868,439]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="4"/><path d={`M${x-8} ${y}h16M${x} ${y-8}v16`} strokeWidth="1"/></g>)}<ellipse cx="790" cy="314" rx="240" ry="160" fill="none" opacity=".3" strokeDasharray="3 10"/></g>}
  </>;
}
function FoundryLayers({ stage }: { stage: number }) {
  return <>
    {stage >= 1 && <g data-landmark="working-hearth"><ellipse cx="555" cy="579" rx="103" ry="25" fill="#d68f37" opacity=".18"/><path d="m477 587 151 13m-135 7 128-24" stroke="#59382b" strokeWidth="19" strokeLinecap="round"/><path d="M487 584q-13-29 13-59-4 29 22 28 6-40 34-69-7 51 19 59 17-27 18-45 44 44 19 87Z" fill="#c97d37"/><path d="M521 586q-16-28 15-54-3 30 18 21 9-16 10-26 24 33 13 61Z" fill="#e5bb6d"/></g>}
    {stage >= 2 && <g data-landmark="working-bench" stroke="#b4a07a" strokeWidth="3"><path d="m1102 528 173 8-33 36-181-10Z" fill="#a69c7f"/><path d="m1097 539 117 9m-128 6 91 4m36-16-3 17" stroke="#5b695f" strokeWidth="2"/><path d="M1293 478h71v67h-71Z" fill="#3b463e"/><path d="m1293 478 34-15 37 15m-37-15v79m-34-31 71 3"/><path d="m1387 511 50-17 5 9-49 19Z" fill="#86623e"/><circle cx="1403" cy="493" r="24" fill="none" stroke="#88795e" strokeWidth="9"/></g>}
    {stage >= 3 && <g data-landmark="central-mechanism" transform="translate(982 323)" stroke="#ba9561" fill="#4b5149"><circle r="163" fill="#273739" strokeWidth="9"/><circle r="138" fill="none" strokeWidth="14"/>{Array.from({length:12},(_,i)=><g key={i} transform={`rotate(${i*30})`}><path d="M-12-151v-21h24v21" fill="#876c46" strokeWidth="3"/><path d="M0-127V-45" strokeWidth="13"/><path d="M0-126V-44" stroke="#d1b682" strokeWidth="2"/></g>)}<circle r="47" strokeWidth="8"/><circle r="19" fill="#b49a6c" stroke="#dac69a" strokeWidth="3"/><path d="M-85-64q86-68 158 0M-73 80q70 51 144-1" fill="none" strokeWidth="3" opacity=".7"/></g>}
  </>;
}
function TrainingLayers({ stage }: { stage: number }) {
  return <>
    {stage === 0 && <g data-landmark="overgrown-path" fill="#485b3c" opacity=".8"><path d="M480 935q-40-105-155-143 44 99 155 143Zm0 0q-10-109 50-170 7 90-50 170Zm608-18q20-95 123-145-29 100-123 145Zm0 0q-2-98-52-133-4 82 52 133Z"/></g>}
    {stage >= 1 && <g data-landmark="cleared-route" fill="#727b65" stroke="#b8b79a" strokeWidth="3">{[[424,771],[515,704],[626,660]].map(([x,y],i)=><g key={x} transform={`translate(${x} ${y}) scale(${1-i*.12})`}><path d="m-20 38 4-83 19-12 21 12 4 83Z"/><path d="M-6-24 9-37l14 13M9-37V9" fill="none" strokeWidth="4"/></g>)}</g>}
    {stage >= 2 && <g data-landmark="restored-pavilion" transform="translate(0 -187)" stroke="#b9ac81" strokeWidth="5" fill="#5d6250"><path d="M934 630h224v17H934Zm15 18-9 66m200-66 10 66"/><path d="M981 629v-52m60 52v-70m61 70v-51" stroke="#465647" strokeWidth="13"/><path d="M965 578h32m28-19h31m29 20h32" stroke="#b8ad87" strokeWidth="10"/><path transform="translate(0 187)" d="m736 767 227 21 123-54" fill="none" stroke="#b5ac86" strokeWidth="3" strokeDasharray="18 16"/></g>}
    {stage >= 3 && <g data-landmark="complete-circuit" stroke="#a4ac88" strokeWidth="4"><path d="M744 646V341m419 305V341M731 352h445" stroke="#645a42" strokeWidth="10"/><path d="M759 357h75v151l-38-23-37 23Zm309 0h75v151l-38-23-37 23Z" fill="#49604c"/><path d="m775 404 21-22 21 22-21 22Zm309 0 21-22 21 22-21 22Z" fill="none"/><path d="m527 841 110 21 102-24m424-26 115-41" strokeDasharray="18 15" fill="none" opacity=".75"/></g>}
  </>;
}
function CitadelLayers({ stage }: { stage: number }) {
  return <>
    {stage === 0 && <g data-landmark="closed-gates" fill="#443e34" stroke="#a08c65" strokeWidth="4"><path d="M575 367q90 64 185 91v169H575Zm385 0q-91 64-185 91v169h185Z"/>{[600,640,680,720,800,840,880,920].map(x=><path key={x} d={`M${x} ${x<770?405+(x-600)*.3:501-(x-800)*.3}V620`} strokeWidth="5"/>)}<path d="M584 559h168m31 0h169" strokeWidth="9"/></g>}
    {stage >= 1 && <g data-landmark="open-gates" fill="#795f3e" stroke="#c3a16d" strokeWidth="3"><path d="M532 367h18v246h-18Zm454 0h18v246h-18Z"/><path d="M531 401h22m-22 160h22m431-160h22m-22 160h22" strokeWidth="8"/></g>}
    {stage >= 2 && <g data-landmark="council-room"><path d="m575 655 319-12 144 38-340 18Z" fill="#b8a984" stroke="#8e7b54" strokeWidth="4"/><path d="m658 654 31 20 74-15 68 20 58-16 56 13" fill="none" stroke="#6d7b6c" strokeWidth="3"/><circle cx="765" cy="669" r="9" fill="#715c3f"/><path d="m439 662 74-5 35 16-74 6Z" fill="#d0c1a0"/><path d="m1061 651 37 4 8 18-39-4Z" fill="#b2a384"/><circle cx="1098" cy="669" r="7" fill="#7f5a3f"/></g>}
    {stage >= 3 && <g data-landmark="exchange-hall"><path d="M282 419h122v164H282Zm854 0h103v164h-103Z" fill="#4b5c58" stroke="#b69b66" strokeWidth="5"/><path d="M296 438h94m-94 21h94m-94 72h94m758-93h75m-75 25h75m-75 68h75" stroke="#c4b694" strokeWidth="3" opacity=".8"/><path d="m1342 196 62-14v139l-29-11-33 29Z" fill="#8f784e" stroke="#d4be8b" strokeWidth="3"/><circle cx="1375" cy="242" r="16" fill="none" stroke="#d4be8b" strokeWidth="4"/><path d="M310 568h38v17h-38Zm52-13h26v30h-26Zm787-1h54v31h-54Z" fill="#a28c62"/></g>}
  </>;
}
function SanctuaryLayers({ stage }: { stage: number }) {
  if (stage === 3) return null; // The final authored painting opens the water garden.
  return <>
    {stage >= 1 && <g data-landmark="reflection-seat" fill="#75634c" stroke="#b09b72" strokeWidth="5"><path d="M198 550h266v23H198Zm18 22-12 81m242-81 13 81M216 546v-81h228v81"/><path d="M222 486h215m-215 30h215" stroke="#bba682" strokeWidth="3"/><path d="M298 548h72v-12h-72Z" fill="#a79c7f"/></g>}
    {stage >= 2 && <g data-landmark="returning-garden" fill="#607c56" stroke="#aac08a" strokeWidth="2">{[[580,748],[1120,736],[1250,854],[397,864]].map(([x,y],i)=><g key={x} transform={`translate(${x} ${y}) scale(${i%2?.9:1.2})`}><path d="M0 0q-60-17-64-69 55 1 64 69Zm0 0q-10-85 23-103Q42-40 0 0Zm0 0q56-62 92-44Q65 3 0 0Z"/><path d="M0 4v-55m0 55L-40-41m40 45 65-35" fill="none" stroke="#c0c29c"/></g>)}</g>}
  </>;
}

export const RegionScene = memo(function RegionScene({ regionId, stage, keepsakes = [], children, timeOfDay = 'twilight' }: { regionId: RegionId; stage: number; keepsakes?: Keepsake[]; children?: ReactNode; eager?: boolean; timeOfDay?: TimeOfDay }) {
  const level = sceneStage(stage); const src = regionSceneAsset(regionId,level); const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[src]);
  if (regionId === 'atelier') return <AtelierScene stage={level} keepsakes={keepsakes} timeOfDay={timeOfDay}>{children}</AtelierScene>;
  return <div className={`pros-scene regional-scene regional-scene-${regionId}`} data-region={regionId} data-stage={level}>
    <div className="scene-paint" aria-hidden="true">{failed ? <div className="scene-unavailable">Illustration unavailable · your records are ready</div> : <svg className="regional-canvas" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" focusable="false">
      <image href={src} width="1536" height="1024" preserveAspectRatio="xMidYMid slice" onError={()=>setFailed(true)}/>
      <rect width="1536" height="1024" fill="#091823" opacity={level===0?.2:level===1?.06:0}/>
      <g className="regional-restoration" key={`${regionId}-${level}`}>
        {regionId==='observatory' ? <ObservatoryLayers stage={level}/> : regionId==='foundry' ? <FoundryLayers stage={level}/> : regionId==='training' ? <TrainingLayers stage={level}/> : regionId==='citadel' ? <CitadelLayers stage={level}/> : <SanctuaryLayers stage={level}/>}
        {level>=2 && keepsakes.length>0 && <g data-landmark="kept-work" transform={regionId==='observatory'?'translate(1208 660)':regionId==='foundry'?'translate(1180 439)':regionId==='citadel'?'translate(342 490)':regionId==='training'?'translate(1002 345)':'translate(303 459)'}><KeepsakeGlyph kind={keepsakes[0].kind} width="65" height="72" style={{width:65,height:72,color:'#c7af7d'}}/></g>}
      </g>
      <rect width="1536" height="1024" fill={timeOfDay==='night'?'#071d3f':timeOfDay==='dawn'?'#d89f85':'#d1e5ce'} opacity={timeOfDay==='night'?.25:timeOfDay==='dawn'?.1:timeOfDay==='day'?.045:0}/>
    </svg>}</div>{children}
  </div>;
});
