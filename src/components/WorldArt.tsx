import { useId } from 'react';
import type { RegionId } from '../types';
import './art.css';

const PLACES: { id: RegionId; label: string; x: number; y: number; color: string }[] = [
  { id: 'observatory', label: 'Observatory', x: 510, y: 154, color: '#b7c9f3' },
  { id: 'citadel', label: 'Citadel', x: 270, y: 287, color: '#e6bd75' },
  { id: 'foundry', label: 'Foundry', x: 748, y: 290, color: '#e49b76' },
  { id: 'training', label: 'Training grounds', x: 295, y: 492, color: '#a7bd8b' },
  { id: 'sanctuary', label: 'Sanctuary', x: 513, y: 407, color: '#83c9ba' },
  { id: 'atelier', label: 'Atelier', x: 747, y: 494, color: '#c4a9d9' },
];
const stageOf = (n = 0) => Math.max(0, Math.min(3, Math.floor(n)));

export type TimeOfDay = 'dawn' | 'day' | 'twilight' | 'night';
export type SkyChoice = 'auto' | TimeOfDay;
export function getAutoTimeOfDay(timeZone?: string, now = new Date()): TimeOfDay {
  let hour = now.getHours();
  try { if (timeZone) hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now)); } catch { /* Keep the device clock as a display-only fallback. */ }
  return hour >= 5 && hour < 9 ? 'dawn' : hour >= 9 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'twilight' : 'night';
}
const SKY_PALETTES: Record<TimeOfDay, { sea: string; shore: string; land: string; sky: string; horizon: string }> = {
  dawn: { sea: '#364947', shore: '#1a2930', land: '#3c4c4b', sky: '#253448', horizon: '#795a59' },
  day: { sea: '#2b5d63', shore: '#16313a', land: '#3d5c55', sky: '#304d60', horizon: '#7e9c90' },
  twilight: { sea: '#264442', shore: '#101f25', land: '#334d47', sky: '#101c28', horizon: '#294b4b' },
  night: { sea: '#12252c', shore: '#081116', land: '#2b403c', sky: '#0c1525', horizon: '#1d3742' },
};


function Pine({ x, y, size = 1, color = '#385b56' }: { x: number; y: number; size?: number; color?: string }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path d="M0 10V-22" stroke="#718a78" strokeWidth="2" /><path d="m0-29-12 22h7L-16 6H16L5-7h7Z" fill={color} /><path d="M0-25V4" stroke="#8da68b" strokeWidth=".7" opacity=".4" /></g>;
}

/** Relic Monuments that appear when a region reaches Stage 2 or 3 (tangible rewards of practice) */
function RelicMonument({ id, stage }: { id: RegionId; stage: number }) {
  if (stage < 2) return null;
  return (
    <g className="world-relic-pulse" transform="translate(60, -16)">
      {id === 'observatory' && (
        <g>
          {/* Celestial Armillary Astrolabe */}
          <circle cx="0" cy="0" r="14" fill="#1b2e3b" stroke="#e6c68b" strokeWidth="1.8" />
          <ellipse cx="0" cy="0" rx="14" ry="6" stroke="#9bb4d6" strokeWidth="1.2" transform="rotate(25)" />
          <circle cx="0" cy="0" r="4" fill="#ffe5a3" />
          <path d="M0-18v36M-18 0h36" stroke="#e6c68b" strokeWidth="1.2" opacity="0.7" />
        </g>
      )}
      {id === 'foundry' && (
        <g>
          {/* Gilded Clockwork Engine Gear */}
          <circle cx="0" cy="0" r="13" fill="#2d1c15" stroke="#e49b76" strokeWidth="2" />
          <circle cx="0" cy="0" r="6" fill="#ffe1a1" className="world-art-ember" />
          <path d="M-13 0h26M0-13v26M-9-9l18 18M-9 9l18-18" stroke="#e49b76" strokeWidth="1.6" />
        </g>
      )}
      {id === 'atelier' && (
        <g>
          {/* Artist's Easel & Silver Tuning Fork */}
          <path d="M-9 14l9-26 9 26M0-12v26" stroke="#baa4cc" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="-8" y="-6" width="16" height="12" rx="1" fill="#dfd5ea" stroke="#8b73a2" strokeWidth="1.2" />
          <circle cx="0" cy="0" r="3" fill="#89569b" />
        </g>
      )}
      {id === 'training' && (
        <g>
          {/* Carved Runic Obelisk */}
          <path d="M-5 14L-3-16 0-21 3-16 5 14Z" fill="#586f56" stroke="#cdd8ad" strokeWidth="1.6" />
          <path d="M0-14v22M-2-6h4M-2 4h4" stroke="#e0e8c5" strokeWidth="1.4" />
        </g>
      )}
      {id === 'citadel' && (
        <g>
          {/* Council Envoy Banner */}
          <path d="M-8-18h16v18l-8-4-8 4Z" fill="#cfae5f" stroke="#ffe5a3" strokeWidth="1.5" />
          <circle cx="0" cy="-9" r="3" fill="#2d2211" />
          <path d="M0-22v26" stroke="#a68437" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {id === 'sanctuary' && (
        <g>
          {/* Floating Luminous Water Lotus */}
          <ellipse cx="0" cy="6" rx="14" ry="5" fill="#3a6d65" stroke="#87c7b8" strokeWidth="1.2" opacity="0.8" />
          <path d="M0 6q-8-8-4-16 8 4 4 16m0 0q8-8 4-16-8 4-4 16" fill="#b9eedf" stroke="#71b5a5" strokeWidth="1.2" />
          <circle cx="0" cy="-2" r="3" fill="#ffffff" className="world-art-glow" />
        </g>
      )}
    </g>
  );
}

/** Each stage adds a specific, visible part of a place. Artwork is original SVG. */
function Landmark({ id, stage, prefix }: { id: RegionId; stage: number; prefix: string }) {
  const built = stage > 0;
  const ink = built ? '#8ba8a0' : '#536d68';
  const stone = built ? '#42615e' : '#263f3e';
  const light = built ? '#edce91' : '#6c8175';
  return <g className={`world-landmark world-landmark--${id} world-landmark--stage-${stage}`} strokeLinejoin="round" strokeLinecap="round">
    <ellipse cy="30" rx="72" ry="20" fill="#091a1c" opacity=".55" />
    <path d="m-69 23 22-12 61-4 52 13-17 17-83 5Z" fill="#36524c" stroke="#6f8970" strokeWidth=".9" />
    {stage === 3 && <ellipse className="world-art-glow" cy="9" rx="83" ry="49" fill={`url(#${prefix}-halo)`} />}
    {id === 'observatory' && <>
      <path d="m-37 19 8-15h61l12 16-8 8h-66Z" fill="#60766b" stroke={ink} />
      <path d="M-27 8v-32h54V9l-27 10Z" fill={stone} stroke={ink} />
      <path d="M0-22V17l26-9v-31Z" fill="#29494b" />
      {built ? <><path d="M-36-25a36 36 0 0 1 72 0Z" fill="#7e9290" stroke="#b9c9ba" /><path d="M-29-27a30 30 0 0 1 58 0" fill="none" stroke="#a7b6a5" /><path d="m-2-31 28-25 8 8-28 25Z" fill="#a6bab1" stroke="#d2d8bc" /><path d="m27-57 11 10" stroke="#f1d59b" strokeWidth="4" /><path d="M-3-8h8v15h-8Z" fill={light} /></> : <><path d="m-33-24 9-9 12 7 12-7 11 8 18-7 4 9Z" fill="#536f6a" stroke={ink} /><path d="m10-22-7 12 9 7-5 16" fill="none" stroke="#122b2d" strokeWidth="3" /></>}
      {stage >= 2 && <><path d="M-57 18v-29l12-10 13 10v30Z" fill="#456766" stroke={ink} /><path d="m-61-10 16-18 17 18Z" fill="#78918d" stroke={ink} /><circle cx="-45" cy="0" r="4" fill={light} /><path d="M30 17h24V-7H31" fill="#456766" stroke={ink} /><path d="M34-9h16l-8-16Z" fill="#809594" /></>}
      {stage === 3 && <><path d="M-74-28q72-45 145-3" fill="none" stroke="#c4cfb0" strokeDasharray="2 8" opacity=".7" /><path d="m-64-30 4-8 4 8-4 8Zm110-20 3-6 3 6-3 6Z" fill="#f4dca5" /><path d="M-45-26v-22m-9 10h18" stroke="#a2b6a7" /></>}
    </>}
    {id === 'citadel' && <>
      <path d="M-47 21v-43h94v43L0 35Z" fill={stone} stroke={ink} /><path d="M0-8v42l47-13v-42Z" fill="#2c4a48" />
      <path d={built ? 'M-50-20v-12h9v8h10v-8h10v8h10v-8h10v8h10v-8h10v8h10v-8h10v8h9v12Z' : 'M-50-20v-10h12v9h14v-5h13v8h13v-6h12v6h12v-13h12v8h12v7Z'} fill="#6f8070" stroke={ink} />
      <path d="M-11 30V9q11-18 22 0v21Z" fill="#102c2c" stroke={ink} />
      {built && <><path d="M-30-24v-34h20v35m22 0v-34h20v35" fill="#5b756c" stroke={ink} /><path d="m-35-57 15-22 15 22Zm42 0 15-22 15 22Z" fill="#b59c67" stroke="#d0b57c" /><path d="M-23-43h6v11h-6Zm42 0h6v11h-6Z" fill={light} /></>}
      {stage >= 2 && <><path d="m-69 21 5-38h21m88 0h20l6 37" fill="#4f6c61" stroke={ink} /><path d="M-69-17h27m2-20H43m1 20h25" stroke="#9caa85" strokeWidth="4" /><path d="M-59-6h5v10h-5Zm114 0h5V4h-5Z" fill={light} /></>}
      {stage === 3 && <><path d="M-20-80v-24m42 24v-24" stroke="#c2b383" /><path d="m-19-104 20 5-20 8Zm42 0 20 5-20 8Z" fill="#e1be72" /><path d="M-36 38q36 16 73 0" fill="none" stroke="#b9ad78" strokeWidth="2" /><path d="M-6 20h12" stroke="#ead49c" strokeWidth="2" /></>}
    </>}
    {id === 'foundry' && <>
      <path d="m-44 18 2-46h62l17 18v32L0 33Z" fill={stone} stroke={ink} /><path d="m-44-29 35-21 46 39-37 5Z" fill={built ? '#7a8070' : '#485c52'} stroke={ink} /><path d="M0-7v40l37-11v-33Z" fill="#294847" />
      <path d="M-31 20V0q10-13 20 0v26" fill="#1a302e" stroke={ink} />
      {built && <><path d="M-28 18V2q7-9 14 0v20Z" fill="#dfac69" /><path className="world-art-ember" d="m-23 17-3-7 5 2 3-10 4 14Z" fill="#ffe1a1" /><path d="M13-33v-40h15v55" fill="#6b7870" stroke={ink} /><path d="M10-73h21v7H10Z" fill="#87917a" /><path d="M20-83q-17-12-2-21t-7-16" fill="none" stroke="#a3af97" strokeWidth="7" opacity=".22" /></>}
      {stage >= 2 && <><path d="M-66 20V-4h20v27m85-1h25V-2H38" fill="#3e6158" stroke={ink} /><path d="m-70-3 14-13 15 13m-24 15h15m90-14 14-13 15 13" fill="#8c8970" stroke={ink} /><path d="M47 9h9v11h-9Z" fill={light} /></>}
      {stage === 3 && <><path d="m-49 34 14 11h56l19-14" fill="none" stroke="#d6ab70" strokeWidth="3" /><circle cx="54" cy="-23" r="12" fill="#324d48" stroke="#c0aa72" strokeWidth="3" /><path d="M54-35v24m-12-12h24m-20-8 16 16m-16 0 16-16" stroke="#c0aa72" /><path d="m-15-61 1-4m-10 11-1-5m66-31 1-4" stroke="#e4bd80" strokeWidth="2" /></>}
    </>}
    {id === 'atelier' && <>
      <path d="M-37 18v-41h65l14 12v34L0 35Z" fill={stone} stroke={ink} /><path d="m-44-24 36-30L43-9 0 1Z" fill={built ? '#858196' : '#566369'} stroke={ink} /><path d="M0 1v34l42-12V-9Z" fill="#3b4b56" />
      <path d="M-24 23V5q8-11 16 0v24Z" fill="#1e3437" stroke={ink} />
      {built && <><path d="m-12-28 9-10 16 15-10 8Z" fill="#c8c4b4" stroke="#e0d6b8" /><path d="m-7-28 15 8m-12-13 6 13" stroke="#596d70" /><path d="m12 10 18-5v12l-18 5Z" fill={light} /><path d="M-21 9v14m-5-7h10" stroke="#aaaea0" /></>}
      {stage >= 2 && <><path d="m-62 20 7-34 17 5-5 36Zm19 0-16-4m7-18 9 3" fill="#768a7a" stroke={ink} /><path d="M40 25h27V6H40" fill="#537269" stroke={ink} /><path d="M43 6 67-2l8 9-29 9Z" fill="#a9b197" stroke={ink} /><path d="m-63 24 12 3" stroke="#d0b99c" strokeWidth="3" /></>}
      {stage === 3 && <><path d="m-64-34 21 9 27-5" fill="none" stroke="#b4bbaa" /><path d="m-61-33 4 10 7-6m3-2 4 10 7-6" fill="#c5b8d2" /><path d="M49 6v-34m-7 13 7-6 7 6m-7-6 7-6" stroke="#a6b7a4" strokeWidth="2" /><path d="m52-34 8-2-1 9Z" fill="#c4b2d1" /><circle cx="-48" cy="-40" r="3" fill="#e3d6ae" /></>}
    </>}
    {id === 'training' && <>
      <ellipse cy="12" rx="51" ry="26" fill="#344d3b" stroke={ink} /><ellipse cy="9" rx="40" ry="19" fill="#7a8865" stroke="#a3ac83" /><path d="M-54 4v23M54 4v23" stroke={ink} strokeWidth="5" />
      {!built && <><path d="m-23 8 7-4 15 9m16-6 14 5" stroke="#b0b18a" fill="none" /><path d="M-52-6v13m5-14-10 7m105-7v12" stroke="#536c57" strokeWidth="4" /></>}
      {built && <><path d="M-24 8V-24m-11 12h22m-18 2 15 16m-1-16L-32 6" stroke="#cec49a" strokeWidth="4" /><circle cx="-24" cy="-31" r="6" fill="#a8aa81" stroke="#dbd2a9" /><path d="M16 5v-28" stroke="#b2a982" strokeWidth="3" /><circle cx="16" cy="-23" r="13" fill="#465d4a" stroke="#a7b187" strokeWidth="3" /><circle cx="16" cy="-23" r="6" fill="#c7bf8b" /></>}
      {stage >= 2 && <><path d="m-65 13 5-37 15 8v36m82-3 12-38 16 8-3 34" fill="#567359" stroke={ink} /><path d="m-68-23 10-11 18 16m76-5 14-11 18 12" fill="#8b9b75" stroke={ink} /><path d="M-4 12v-39m0 6 21 9-21 3" stroke="#d4c48c" fill="#9eac79" /></>}
      {stage === 3 && <><path d="m-69 29 9 12 53 8 62-10 15-13" fill="none" stroke="#b2ba89" strokeWidth="3" /><path d="M-58-36v-20m109 20v-20" stroke="#c5be8e" /><path d="m-57-56 16 6-16 7m109-13 16 6-16 7" fill="#d1c58b" /><path d="m-10 28 10-5 10 5-10 5Z" fill="#e0cd91" /></>}
    </>}
    {id === 'sanctuary' && <>
      <ellipse cy="24" rx="59" ry="18" fill="#2d5952" stroke="#789c83" /><ellipse cy="23" rx="43" ry="10" fill="#529286" opacity=".6" /><path d="M-31 20v-37h62v37" fill={stone} stroke={ink} />
      <path d={built ? 'M-42-15 0-49l42 34-42 13Z' : 'm-42-15 15-10 14 6 14-9 13 10 13-7 16 10-42 13Z'} fill={built ? '#809f88' : '#4c7060'} stroke={ink} />
      <path d="M-10 24V4q10-17 20 0v20Z" fill="#183b36" stroke={ink} />
      {built && <><path d="M-3 9h6v12h-6Z" fill={light} /><path d="M0-48v-12m-5 6H5" stroke="#b5c7a0" /><path d="m-24 13-2 10m53-11-2 11" stroke="#c1ceb0" strokeWidth="3" /></>}
      {stage >= 2 && <><Pine x={-51} y={7} size={1.15} color="#5b8e70" /><Pine x={51} y={9} size={1.25} color="#6a9477" /><path d="m-34 30 34 12 35-13" fill="none" stroke="#a0bca0" strokeWidth="3" /><path d="M-8 39h16m-5-7H3" stroke="#d4d6ad" /></>}
      {stage === 3 && <><path d="M-64 4q8-42 23-33m104 36q-5-43-20-36" fill="none" stroke="#83aa86" strokeWidth="2" /><path d="m-60-15-8-5 10-1m6-8-7-6 10 2m47 4 8-5-2 10m8 2 9-3-6 9" fill="#a9c69a" /><path d="M-47 28q48 21 94 0" fill="none" stroke="#e1ce90" opacity=".8" /><circle cx="-34" cy="-48" r="2" fill="#eddba8" /><circle cx="40" cy="-51" r="2" fill="#eddba8" /></>}
    </>}
  <RelicMonument id={id} stage={stage}/>
    </g>;
}

export interface WorldArtProps {
  stages: Partial<Record<RegionId, number>>;
  activeRegion?: RegionId;
  onRegionClick?: (id: RegionId) => void;
  compact?: boolean;
  timeOfDay?: TimeOfDay;
}

export function WorldArt({ stages, activeRegion, onRegionClick, compact = false, timeOfDay = 'twilight' }: WorldArtProps) {
  const id = `map-${useId().replace(/:/g, '')}`;
  const palette = SKY_PALETTES[timeOfDay];
  return <div className={`world-art ${compact ? 'world-art--compact' : ''}`}>
    <div className="world-art-map">
      <svg viewBox="0 0 1000 680" fill="none" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Your six regions</title>
        <desc id={`${id}-desc`}>An illustrated island with an observatory, citadel, foundry, training grounds, sanctuary and atelier. Each place develops through four visual stages as you make progress.</desc>
        <defs>
          <radialGradient id={`${id}-sea`}><stop stopColor={palette.sea} /><stop offset="1" stopColor={palette.shore} stopOpacity="0" /></radialGradient>
          <linearGradient id={`${id}-land`} x1="250" y1="100" x2="720" y2="600" gradientUnits="userSpaceOnUse"><stop stopColor={palette.land} /><stop offset=".48" stopColor="#30473f" /><stop offset="1" stopColor="#263c38" /></linearGradient>
          <radialGradient id={`${id}-halo`}><stop stopColor="#e4c47d" stopOpacity=".25" /><stop offset="1" stopColor="#e4c47d" stopOpacity="0" /></radialGradient>
          <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#05141a" floodOpacity=".45" /></filter>
        </defs>
        <ellipse cx="500" cy="345" rx="485" ry="337" fill={`url(#${id}-sea)`} />
        {(timeOfDay === 'night' || timeOfDay === 'twilight') && <g className="world-star-twinkle" fill="#e8e0c0" opacity={timeOfDay === 'night' ? .7 : .35}>{[[120,85],[180,52],[280,110],[350,60],[670,75],[760,45],[860,95],[920,140]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2 : 1.2}/>)}</g>}
        <g stroke="#6e8b7e" strokeWidth=".7" opacity=".15"><ellipse cx="498" cy="351" rx="438" ry="276" /><ellipse cx="498" cy="351" rx="456" ry="292" /><path d="M90 353h820M500 52v592" strokeDasharray="2 7" /></g>
        <path d="m485 67 54 19 58 42 84 11 39 48 90 28 38 65-17 70 29 59-25 78-81 39-44 56-69 8-63 31-60-15-70 13-52-24-83-4-29-38-74-17-32-67 17-60-33-55 26-66 6-59 61-27 25-56 76-10 43-41Z" fill="#172f31" stroke="#698779" strokeOpacity=".4" strokeWidth="2" transform="translate(0 11)" />
        <path d="m485 67 54 19 58 42 84 11 39 48 90 28 38 65-17 70 29 59-25 78-81 39-44 56-69 8-63 31-60-15-70 13-52-24-83-4-29-38-74-17-32-67 17-60-33-55 26-66 6-59 61-27 25-56 76-10 43-41Z" fill={`url(#${id}-land)`} stroke="#8d9c7b" strokeWidth="1.4" filter={`url(#${id}-shadow)`} />
        <g stroke="#8c9e7c" strokeWidth=".8" opacity=".19"><path d="m485 84 52 21 55 40 79 14 31 46 93 32 30 50-18 67 28 55-22 61-76 36-45 56-65 8-61 28-60-14-67 11-55-23-75-4-30-38-68-16-23-51 17-59-33-56 26-66 7-48 57-24 25-57 76-9Z" /><path d="m491 102 44 23 54 39 73 13 30 44 92 33 23 36-18 65 28 55-20 48-71 34-47 56-60 7-62 29-58-16-66 10-56-22-72-3-26-40-64-15-17-40 17-58-32-55 26-67 6-37 54-24 23-56 76-9Z" /></g>
        <g fill="#637965" stroke="#91a084" strokeWidth=".75" opacity=".65"><path d="m405 219 40-76 43 66-18-10-16 18-13-22-14 21Z" /><path d="m443 232 41-92 50 96-27-17-13 9-14-31-13 23Z" /><path d="m543 211 33-60 35 71-20-10-15 4-11-20Z" /><path d="m598 295 34-64 36 79-23-18-12 7-13-25Z" /></g>
        <g fill="#b5b6a0" opacity=".6"><path d="m445 144-12 23 12-7 11 9Zm39-4-14 31 14-10 13 13Zm92 11-10 18 10-5 8 7Z" /></g>
        <path d="M565 242q-59 47-31 73t-22 42q-31 19-7 51t-35 54q-35 23-13 58t-4 60" stroke="#213f40" strokeWidth="18" /><path d="M565 242q-59 47-31 73t-22 42q-31 19-7 51t-35 54q-35 23-13 58t-4 60" stroke="#66988a" strokeOpacity=".75" strokeWidth="9" /><path d="M565 242q-59 47-31 73t-22 42q-31 19-7 51t-35 54q-35 23-13 58t-4 60" stroke="#b6c0a1" strokeOpacity=".25" strokeWidth="1.4" />
        <g stroke="#d3b47c" strokeWidth="1.8" strokeDasharray="3 7" opacity=".52"><path d="M292 298Q375 226 492 169M530 169q105 11 202 113M738 315q-45 55-203 88M490 415q-87 26-177 74M533 424q109 68 194 71M310 467q-68-65-43-139" /></g>
        <g opacity=".8">{[[342,335,1],[360,353,.8],[335,367,.9],[385,394,1.2],[403,372,.7],[613,437,1.15],[632,455,.9],[651,431,.8],[602,476,.8],[637,491,.75],[379,543,.85],[400,557,.65],[665,210,.75],[686,227,.8],[204,365,.75],[218,386,.9]].map(([x,y,s],i)=><Pine key={i} x={x} y={y} size={s} />)}</g>
        <g stroke="#96a48a" strokeWidth="1.5" opacity=".45"><path d="m707 563 8-3 8 3m-5 8 8-3 8 3M220 205l8-3 8 3m-40 235 8-3 8 3" /><path d="m537 554 10-2 7 3m-318-82 10-3 7 3" /></g>
        {PLACES.map(place => <g key={place.id} transform={`translate(${place.x} ${place.y})`}>
          {activeRegion === place.id && <><ellipse cy="18" rx="85" ry="43" fill={place.color} opacity=".08" /><ellipse cy="18" rx="82" ry="40" stroke={place.color} strokeWidth="1.5" strokeDasharray="3 6" opacity=".7" /></>}
          <Landmark id={place.id} stage={stageOf(stages[place.id])} prefix={id} />
          <text y="66" textAnchor="middle" fill={activeRegion === place.id ? '#f1dbad' : '#c1ccba'} fontSize="17" fontFamily="Georgia, serif" letterSpacing=".8">{place.label}</text>
          <g transform="translate(-12 79)">{[1,2,3].map(n=><circle key={n} cx={(n-1)*12} r="2" fill={stageOf(stages[place.id]) >= n ? place.color : '#546b5e'} />)}</g>
        </g>)}
        <g transform="translate(899 112)" stroke="#a4b19a" opacity=".6"><path d="M0-30v60m-22-30h44M0-30l7 26-7 34-7-34Z" strokeWidth=".8" /><path d="M0-30v30h7Z" fill="#a4b19a" stroke="none" /><circle r="17" strokeWidth=".6" /><text y="-42" textAnchor="middle" fontSize="11" fill="#b9c0a8" stroke="none" fontFamily="Georgia, serif">N</text></g>
        <g fill="#899e94" opacity=".4" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="4" fontSize="13"><text x="72" y="523" transform="rotate(-76 72 523)">THE QUIET SEA</text><text x="754" y="629">A WORLD IN THE MAKING</text></g>
      </svg>
      {onRegionClick && PLACES.map(place => <button key={place.id} type="button" className="world-art-region-hit" style={{ left: `${place.x / 10 - 8.5}%`, top: `${place.y / 6.8 - 10}%` }} onClick={() => onRegionClick(place.id)} tabIndex={-1} aria-hidden="true" title={`Explore ${place.label}`} />)}
    </div>
    {!compact && <div className="world-art-legend" aria-label="Regions">
      {PLACES.map(place => onRegionClick ? <button key={place.id} type="button" className={`world-art-legend-item ${activeRegion === place.id ? 'is-active' : ''}`} onClick={() => onRegionClick(place.id)} aria-pressed={activeRegion === place.id}>
        <span className="world-art-legend-dot" style={{ backgroundColor: place.color }} /><span>{place.label}</span><span className="world-art-stage" aria-label={`Stage ${stageOf(stages[place.id])} of 3`}>{stageOf(stages[place.id])}/3</span>
      </button> : <div key={place.id} className="world-art-legend-item"><span className="world-art-legend-dot" style={{ backgroundColor: place.color }} /><span>{place.label}</span><span className="world-art-stage">{stageOf(stages[place.id])}/3</span></div>)}
    </div>}
  </div>;
}

export function RegionArt({ regionId, stage, compact = false, timeOfDay = 'twilight' }: { regionId: RegionId; stage: number; compact?: boolean; timeOfDay?: TimeOfDay }) {
  const id = `scene-${useId().replace(/:/g, '')}`;
  const place = PLACES.find(p => p.id === regionId) ?? PLACES[0];
  const n = stageOf(stage);
  const palette = SKY_PALETTES[timeOfDay];
  const showStars = timeOfDay === 'twilight' || timeOfDay === 'night';
  return <div className={`world-art world-art-scene ${compact ? 'world-art-scene--compact' : ''}`}>
    <svg viewBox="0 0 1000 500" fill="none" role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{place.label}, development stage {n} of 3</title>
      <defs>
        <linearGradient id={`${id}-sky`} x1="500" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse"><stop stopColor={palette.sky} /><stop offset=".65" stopColor={palette.horizon} /><stop offset="1" stopColor="#233c38" /></linearGradient>
        <radialGradient id={`${id}-dawn`}><stop stopColor={place.color} stopOpacity=".22" /><stop offset="1" stopColor={place.color} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor="#e4c47d" stopOpacity=".35" /><stop offset="1" stopColor="#e4c47d" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-water`} x1="300" y1="280" x2="500" y2="500" gradientUnits="userSpaceOnUse"><stop stopColor="#5f958a" stopOpacity=".7" /><stop offset="1" stopColor="#294f4d" /></linearGradient>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h1000v500H0Z" />
      <ellipse cx="585" cy="210" rx="350" ry="260" fill={`url(#${id}-dawn)`} />
      {showStars && <g fill="#e6dbb4" opacity=".6">{[[99,75],[155,43],[270,104],[329,49],[441,83],[540,33],[678,78],[745,48],[861,102],[926,52],[803,155],[178,154]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%3===0 ? 1.8 : 1} />)}</g>}
      {showStars ? <><circle cx="740" cy="95" r="29" fill="#cdd4b6" opacity=".8"/><circle cx="751" cy="86" r="29" fill={palette.sky}/></> : <circle cx="740" cy="95" r="29" fill="#e9cd91" opacity=".7"/>}
      <path d="m0 282 89-64 70 30 88-93 85 68 104-107 112 96 87-61 84 71 109-103 85 88 87-8v301H0Z" fill="#2c4747" />
      <path d="m184 249 62-94 40 33-34-7-16 29-12-8Zm202-89 50-44 49 42-31-6-16-16-14 24Zm376-8 66-33 47 46-36-11-12-18-23 19Z" fill="#82988c" opacity=".35" />
      <path d="M0 320q123-78 266-13t260-12q151-87 268-27t206 12v220H0Z" fill="#2c4b43" />
      <path d="M0 394q147-59 276-23t255-27q149-63 271-13t198-6v175H0Z" fill="#203e37" />
      {(regionId === 'sanctuary' || regionId === 'atelier') && <><path d="M276 352q154-57 333 16t391 4v128H192q244-35 84-148" fill={`url(#${id}-water)`} /><path d="M357 377h155m96 22h121m-407 44h181m165 20h101m42-87h113" stroke="#9eb79c" strokeOpacity=".3" strokeWidth="2" /></>}
      {regionId === 'foundry' && <><path d="M368 351q116 25 55 67t-46 82h298q-145-43-100-88t33-73" fill="#152e2c" /><path d="M478 369q-8 24 33 43t-1 88" stroke="#9f7857" strokeWidth="12" opacity=".5" /><path d="M478 369q-8 24 33 43t-1 88" stroke="#dfad72" strokeWidth="3" opacity={n ? '.75' : '.2'} /></>}
      {(regionId === 'observatory' || regionId === 'citadel') && <path d="m281 382 102-101 58 18 65-76 85 81 73 79-51 71-113-31-112 20Z" fill="#415d50" stroke="#76917a" strokeOpacity=".35" />}
      {regionId === 'training' && <><path d="M175 413q101-86 217-48t268-22l173 157H175Z" fill="#5d7250" /><path d="M198 456q175-85 363-43" stroke="#a9a67b" strokeWidth="2" strokeDasharray="4 10" opacity=".5" /></>}
      <g transform="translate(517 338) scale(2.2)"><Landmark id={regionId} stage={n} prefix={id} /></g>
      <g opacity=".9">{[[84,362,2.4],[143,392,2],[213,350,1.5],[827,349,2.2],[887,389,2.8],[959,344,1.5],[765,397,1.4]].map(([x,y,s],i)=><Pine key={i} x={x} y={y} size={s} color={regionId === 'sanctuary' ? '#4b7458' : '#294d40'} />)}</g>
      {n >= 2 && <g stroke="#d6bc85" strokeWidth="2" opacity=".8"><path d="M339 386v29m341-24v28" /><path d="m334 385 5-8 5 8-5 7Zm341 5 5-8 5 8-5 7Z" fill="#e6c68b" /></g>}
      <path d="M0 459q150-36 294 17t315-6q177-43 391-3v33H0Z" fill="#132c29" />
      <g stroke="#63816b" strokeWidth="1.5" opacity=".6"><path d="m79 475 3-18 6 17m-4-10-6-5m46 18 7-25 3 24m752 2 5-21 7 22m-5-10 7-5m34 15 4-25 4 22" /></g>
      {n === 3 && <g className="world-art-fireflies" fill="#e6d6a1">{[[275,333],[724,317],[359,285],[649,258],[465,220],[585,184],[808,277]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%2 ? 2 : 1.5} />)}</g>}
    </svg>
  </div>;
}

export default WorldArt;
