import { useId } from 'react';
import type { AttributeId, Profile, RegionId } from '../types';
import './art.css';

const REGION_COLORS: Record<RegionId, { cloth: string; light: string; accent: string }> = {
  observatory: { cloth: '#405272', light: '#889fc1', accent: '#cbd5ee' },
  foundry: { cloth: '#774b39', light: '#c28b60', accent: '#e7bc86' },
  atelier: { cloth: '#685471', light: '#b39bc3', accent: '#dbbfdd' },
  training: { cloth: '#4d6241', light: '#a4b480', accent: '#d0d7a0' },
  citadel: { cloth: '#65512e', light: '#b99e61', accent: '#e8cd8e' },
  sanctuary: { cloth: '#3b6960', light: '#86b5a0', accent: '#c4d9b5' },
};

function regionOf(value: string, slot: string, eligible: string[]): RegionId | null {
  if (!eligible.includes(value) || !value.endsWith(`-${slot}`)) return null;
  const region = value.slice(0, -slot.length - 1) as RegionId;
  return Object.hasOwn(REGION_COLORS, region) ? region : null;
}

function Crest({ region, x, y, scale = 1 }: { region: RegionId; x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {region === 'observatory' && <><ellipse rx="9" ry="4" transform="rotate(-24)"/><circle r="5.6"/><path d="m9-10 1.5 3L14-6l-3.5 1-1.5 3L8-5 5-6l3-1Z" fill="currentColor" stroke="none"/></>}
    {region === 'foundry' && <><path d="m0-11 3 3 4-1 1 4 3 2-2 4 1 4-4 1-2 3-4-2-4 1-1-4-3-2 2-4-1-4 4-1Z"/><circle r="3"/></>}
    {region === 'atelier' && <><path d="M-7 10 3-7q7-6 8 0Q8 5-5 6M-2 1l6 2M2-5l6 2"/><path d="m-5 6-2 5"/></>}
    {region === 'training' && <><path d="M0 11V-8M0 5q-11 0-10-10Q0-4 0 5ZM0 0q10-2 9-11Q-1-9 0 0Z"/></>}
    {region === 'citadel' && <><path d="m-9-7 9-4 9 4v9q-2 6-9 10-7-4-9-10ZM-4-5v10M4-5v10M-4 0h8"/></>}
    {region === 'sanctuary' && <><path d="M0 9q-9-3-9-11 7 0 9 7 2-7 9-7 0 8-9 11ZM0 5q-6-8 0-16 6 8 0 16Z"/><path d="M-11 9h22"/></>}
  </g>;
}

const CLOAK_SILHOUETTES: Record<RegionId, string> = {
  observatory: 'M94 105q-23 6-31 37l-7 76 35 5 12-30h39l14 32 32-12-14-71q-5-27-29-38Z',
  foundry: 'M94 105q-21 7-29 36l-5 60 32 13 13-20h34l17 20 28-12-10-59q-4-25-28-39Z',
  atelier: 'M94 105q-27 8-31 34l-8 59 34 17 14-22h39l14 27 32-16-14-61q-4-25-28-39Z',
  training: 'M94 105q-21 7-29 36l1 45 24 14 13-12h39l12 13 26-16-6-42q-4-25-28-39Z',
  citadel: 'M94 105q-21 7-29 36l-8 72 32 14 14-34h39l14 34 31-15-13-69q-4-25-28-39Z',
  sanctuary: 'M94 105q-21 7-29 36l-3 79 27 11 31-12 29 12 34-11-9-77q-4-25-28-39Z',
};

/** Accessories retain their authored identities instead of sharing a generic staff. */
function RegionalAccessory({ region }: { region: RegionId }) {
  const palette = REGION_COLORS[region];
  return <g color={palette.accent} strokeLinecap="round" strokeLinejoin="round">
    {region === 'observatory' && <><path d="m165 176 7-13" stroke="#d4ad83" strokeWidth="6"/><g transform="translate(175 145) rotate(-15)" stroke="currentColor" fill="#27394b"><circle r="24" strokeWidth="2.5"/><ellipse rx="21" ry="10" transform="rotate(-35)" fill="none" strokeWidth="1.4"/><path d="M0-27v54M-21 0h42" strokeWidth="1.3"/><circle r="8" fill="#a8bccb" fillOpacity=".4"/><path d="m-4-7 13 8-14 4Z" fill="currentColor" stroke="none"/><circle cy="-29" r="4" fill="none" strokeWidth="2"/></g></>}
    {region === 'foundry' && <><path d="m153 170 30 1 3 34-34 2Z" fill="#564333" stroke="currentColor" strokeWidth="1.4"/><path d="m154 178 29 1-2 14-25 1Z" fill="#8a6950" stroke="currentColor" strokeWidth="1.2"/><path d="m161 179-2-23 4-5m-4 5-4-3m22 26-2-24m-3 2 6-1" stroke="#c5c2a0" strokeWidth="3"/><path d="m168 180 1-18 4-3" stroke="#b79a68" strokeWidth="3"/><path d="m157 198 24-1m-13-11v8" stroke="currentColor" strokeWidth="1.2"/></>}
    {region === 'atelier' && <><path d="M168 176v-26q0-6-5-6t-5-6v-22m20 0v22q0 6-5 6t-5 6" stroke="#d8d9e0" strokeWidth="4" fill="none"/><path d="M167 161v30" stroke="#b9bfd2" strokeWidth="5"/><path d="m162 171 12 1" stroke="#d4ad83" strokeWidth="6"/><path d="M160 119v14m16-14v14" stroke="#f6e7da" strokeWidth="1"/></>}
    {region === 'training' && <><path d="m68 157 15 5-4 15-14-5Zm87 8 15-5 5 15-16 5Z" fill="#725b3e" stroke="currentColor" strokeWidth="1.5"/><path d="m67 162 14 4m-15 2 14 4m78-3 14-5m-12 10 14-5" stroke="#d5ba83" strokeWidth="2"/><path d="m71 161 2 12m90-6 4 10" stroke="#c8c098" strokeWidth="1.2"/></>}
    {region === 'citadel' && <><ellipse cx="166" cy="172" rx="5" ry="6" fill="#705624" stroke="#ebcf81" strokeWidth="2"/><path d="m162 168 5-3 5 3-2 5h-6Z" fill="#d9a550" stroke="#f4dba1" strokeWidth="1"/><path d="M166 167v4m3-3v3m-4-1h4" stroke="#715228" strokeWidth=".8"/><path d="M140 119q20 8 14 30" stroke="#c8a863" strokeWidth="1.3" fill="none"/></>}
    {region === 'sanctuary' && <><path d="M110 111q-10 23-5 39l6 7" stroke="#bca67b" strokeWidth="1.5" fill="none"/><path d="m110 149 9 9-1 14-10 7-8-9 1-13Z" fill="#75ad92" stroke="#b8dbb0" strokeWidth="1.7"/><path d="m110 153-4 10 5 10 3-14" stroke="#d1e4bc" strokeWidth="1.2" fill="none"/><circle cx="110" cy="150" r="3" fill="#d5c68a"/></>}
  </g>;
}

export interface AvatarProps { profile: Profile; eligibleCosmetics: string[]; size?: number; dominantAttribute?: AttributeId; companion?: boolean }

/** Original, self-contained modular character art. A corrected unlock falls back immediately. */
export function Avatar({ profile, eligibleCosmetics, size = 220, dominantAttribute, companion = false }: AvatarProps) {
  const id = `hero-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const outfit = regionOf(profile.equipment.outfit, 'outfit', eligibleCosmetics);
  const emblem = regionOf(profile.equipment.emblem, 'emblem', eligibleCosmetics);
  const accessory = regionOf(profile.equipment.accessory, 'accessory', eligibleCosmetics);
  const selected = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(profile.avatarColor) ? profile.avatarColor : '#5e9a86';
  const palette = outfit ? REGION_COLORS[outfit] : { cloth: selected, light: '#a8b7a1', accent: '#d6bd83' };
  const scholar = profile.avatarStyle === 'scholar';
  const maker = profile.avatarStyle === 'maker';
  const auraColors: Record<AttributeId, string> = { strength: '#d7a07c', intelligence: '#acc5e9', wisdom: '#b2c599', discipline: '#82c2b0', creativity: '#c9addb', charisma: '#e1c17d' };
  const auraColor = dominantAttribute ? auraColors[dominantAttribute] : palette.cloth;
  const label = `${profile.displayName || 'Your character'}, ${profile.avatarStyle}${outfit ? `, wearing the ${outfit} outfit` : ', wearing a starter outfit'}${emblem ? ` and ${emblem} emblem` : ''}${accessory ? ` with a ${accessory} accessory` : ''}`;
  return <span className={`avatar-art ${profile.motion === 'reduced' ? 'avatar-art--reduced' : ''}`} style={{ width: size, height: size }} data-outfit={outfit || 'starter'} data-emblem={emblem || 'none'} data-accessory={accessory || 'none'}>
    <svg viewBox="0 0 240 260" fill="none" role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{label}</title>
      <defs>
        <radialGradient id={`${id}-aura`}><stop stopColor={auraColor} stopOpacity=".4"/><stop offset="1" stopColor="#152e2b" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-cloak`} x1="64" y1="92" x2="171" y2="215" gradientUnits="userSpaceOnUse"><stop stopColor={palette.cloth}/><stop offset="1" stopColor="#173c36"/></linearGradient>
        <linearGradient id={`${id}-skin`} x1="109" y1="58" x2="130" y2="111" gradientUnits="userSpaceOnUse"><stop stopColor="#dab18a"/><stop offset="1" stopColor="#b77c5d"/></linearGradient>
        <linearGradient id={`${id}-tunic`} x1="104" y1="119" x2="139" y2="203" gradientUnits="userSpaceOnUse"><stop stopColor="#d3cfac"/><stop offset="1" stopColor="#8a967f"/></linearGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <circle className={dominantAttribute ? 'avatar-soul-aura' : undefined} cx="121" cy="128" r="108" fill={`url(#${id}-aura)`}/>
      <circle cx="121" cy="128" r="96" stroke="#96b09a" strokeOpacity=".1"/>
      <path d="M32 156a94 94 0 0 1 137-109M208 105a91 91 0 0 1-105 113" stroke="#bfc3a0" strokeOpacity=".22" strokeDasharray="2 10"/>
      <path d="m43 73 2-5 2 5 5 2-5 2-2 5-2-5-5-2Zm149 99 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#d9c388" opacity=".7"/>
      <circle cx="187" cy="61" r="2" fill="#a3c1a4"/>
      <circle cx="43" cy="178" r="1.5" fill="#a3c1a4"/>
      <ellipse cx="122" cy="237" rx="55" ry="7" fill="#061712" opacity=".55" filter={`url(#${id}-shadow)`}/>
      <path d="m93 189 3 42 17 1 7-44Zm30-1 5 43h18l-1-43Z" fill="#31433c" stroke="#172b27" strokeWidth="1.5"/>
      <path d="m95 224-3 11q-12 4-11 8l32-1 2-18Zm33 0 1 17 29 2q2-6-13-9l-1-10Z" fill="#574638" stroke="#152b26" strokeWidth="1.5"/>
      <path d="m97 225 13 1m21-1 11 1m-48 12h17m21 1 20 1" stroke="#a18c61" strokeWidth="1.3"/>
      <path d={outfit ? CLOAK_SILHOUETTES[outfit] : "M94 105q-21 7-29 36l-6 69 32 8 12-25h39l14 27 28-10-10-67q-4-25-28-39Z"} fill={`url(#${id}-cloak)`} stroke="#8aa18c" strokeOpacity=".65" strokeWidth="1.6"/>
      <path d="m91 114-17 85 18 13 12-23m42-74 21 83-14 13-13-23" stroke="#d5cfaa" strokeOpacity=".28" strokeWidth="1.5"/>
      <path d="m105 108-12 77 27 19 28-19-11-77Z" fill={`url(#${id}-tunic)`} stroke="#627b68" strokeWidth="1.5"/>
      <path d="m119 123 1 77m-15-44 14 4 15-4m-29-16 14 4 16-4" stroke="#728675" strokeOpacity=".5"/>
      <path d="m92 170 56-1 2 11-60 2Z" fill="#72543b" stroke="#a59165"/>
      <rect x="116" y="170" width="12" height="12" rx="2" fill="#bda572" stroke="#e0c78e"/>
      <path d="M120 173v6h5" stroke="#675b3d" strokeWidth="1.5"/>
      <path d="m91 173-10 18 1 15 15 3 6-17-1-14Z" fill="#644d38" stroke="#a58b5e"/>
      <path d="m84 190 16 4m-10-7 1 13" stroke="#b8a375" strokeWidth="1.2"/>
      <path d="m76 133-7 32 12 5 12-33Zm71 5 9 33 13-6-8-33Z" fill={palette.cloth} stroke="#91a58d" strokeWidth="1.4"/>
      <path d="m69 162-1 15 6 6 6-4 3-14Zm87 4 3 13 7 3 7-7-4-14Z" fill="#c18f6b" stroke="#6d674b" strokeWidth="1.2"/>
      <path d="m72 168 6 2m84 0 6-2" stroke="#e0b58b"/>
      <path d="m100 112 17 22 24-23-8-13h-23Z" fill="#644b35" stroke="#a39265"/>
      <path d="m111 93-1 20q10 11 22-1l-2-21Z" fill="#bd8865"/>
      <path d="M100 64q-3-24 22-25 26 1 25 27l-7 29q-18 20-34 0Z" fill="#29372f" stroke="#172d28" strokeWidth="1.5"/>
      <path d="M104 64q-4-5-6 2l4 18 5 1m33-20q6-5 7 2l-4 17-5 1" fill="#bd8a68" stroke="#745943"/>
      <path d="m106 62-1 20q0 18 17 23 17-6 18-23l-1-22Z" fill={`url(#${id}-skin)`} stroke="#a27155" strokeWidth="1.1"/>
      <path d="M103 68q-6-28 17-30 29-1 25 29l-9-10-2-9q-15 17-30 11Z" fill="#344337"/>
      <path d="M110 50q16-9 29 2m-28 2 18-5" stroke="#829074" strokeOpacity=".45" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="m109 73 8-1m11 0 7 1" stroke="#4a4733" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="m111 78 4 1m15-1 3-1" stroke="#2c3c30" strokeWidth="2.1" strokeLinecap="round"/>
      <path d="m122 77-3 9 4 1m-7 7q6 3 12-1" stroke="#976447" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="m108 87 5 2m18-2 5-1" stroke="#e5b38a" strokeOpacity=".55" strokeWidth="1.2"/>
      {scholar ? <>
        <path d="m96 58 9-25 28-10 17 33-27-6Z" fill={palette.cloth} stroke="#9bb09a" strokeWidth="1.5"/>
        <path d="m96 58 28-4 28 5-2 6-27-5-28 5Z" fill="#788e75" stroke="#b0b89a"/>
        <path d="m126 29 4 11-8 7" stroke={palette.accent} strokeWidth="1.4"/>
        <path d="M108 78h11m5 0h11m-16 0h5" stroke="#b8a77b" strokeWidth="1.3"/>
        <circle cx="113" cy="79" r="6" stroke="#a99466" strokeWidth="1.3"/><circle cx="130" cy="79" r="6" stroke="#a99466" strokeWidth="1.3"/>
      </> : maker ? <>
        <path d="m99 65 5-16 32-5 9 20-14-8-21 7Z" fill="#68563b" stroke="#a39368"/>
        <path d="m109 124-8 58 36 10 2-66-14 9Z" fill="#6b5941" stroke="#ad966c"/>
        <path d="m110 153 21 4-1 17-22-4Z" fill="#77664d" stroke="#b4a17d"/>
        <path d="m116 146 2 15m9-13-3 15" stroke="#d3bb86" strokeWidth="2.5"/>
      </> : <>
        <path d="m96 105 13-6 11 12 16-13 13 8-17 19-13 7-17-13Z" fill="#8d987a" stroke="#bdc1a0" strokeWidth="1.5"/>
        <path d="m110 110 10 12 15-13" stroke="#c8c6a0" strokeOpacity=".6"/>
        <path d="m136 101 14 30-10 6-13-18" fill="#76896e" stroke="#b2b99b"/>
      </>}
      <path d="m81 120 8-9 8 5-4 16-11-1Z" fill="#84947a" stroke="#c2c2a0"/>
      <circle cx="89" cy="122" r="4" fill={palette.accent} stroke="#e2d1a2"/>
      {outfit === 'observatory' && <g stroke={palette.accent} strokeWidth="1.2"><path d="M83 113q34 28 70 0l9 22q-42 25-87-2Z" fill={palette.cloth}/><path d="m85 120 3 4m23 3 1 5m20-8 2 4m12-7 3 3"/></g>}
      {outfit === 'foundry' && <g stroke={palette.accent} strokeWidth="1.3"><path d="m104 112 15 18-19 20-9-24Zm33 0-14 18 22 20 8-23Z" fill="#533e30"/><path d="m109 145 24 1 5 46-35 1Z" fill="#8a6747"/><path d="m109 163 24 1-1 15-24-1Z" fill="#64503b"/></g>}
      {outfit === 'atelier' && <g stroke={palette.accent} strokeWidth="1.4"><path d="M86 107q26 12 60-2l23 27-38 15-53-17Z" fill="#6c526c"/><path d="m85 123 45 14 29-9" fill="none"/><path d="m86 133-4 14m14-11-3 13m41-11 3 14m11-18 6 13"/></g>}
      {outfit === 'training' && <g stroke={palette.accent} strokeWidth="1.5"><path d="m104 115 36 54-7 8-39-52Z" fill="#7b8258"/><path d="m72 182 13 8m73 1 14-8"/><path d="m102 204 9 2m19 0 11-1" strokeWidth="3"/></g>}
      {outfit === 'citadel' && <g stroke={palette.accent} strokeWidth="1.4"><path d="m101 109 42 66 11-8-42-65Z" fill="#9b783e"/><path d="m99 108 8-13 14 12 15-12 10 14-23 17Z" fill="#3f493b"/><path d="M77 199q44 23 91 0" fill="none"/></g>}
      {outfit === 'sanctuary' && <g stroke={palette.accent} strokeWidth="1.3"><path d="m105 111 27 24-26 68 15 17-29 8 3-62Z" fill="#557f6b"/><path d="m137 112-16 23 21 75 10 17 18-8-18-61Z" fill="#3a665c"/><path d="m104 202 17 16 20-9m-38-69 23-8" fill="none"/></g>}
      {emblem && <g color={REGION_COLORS[emblem].accent}><circle cx="137" cy="143" r="14" fill="#193c35" stroke="currentColor" strokeWidth="1.1"/><Crest region={emblem} x={137} y={143} scale={.7}/></g>}
      {accessory && <RegionalAccessory region={accessory}/>}
      {outfit && <><path d="M69 191q50 27 105 0" stroke={palette.accent} strokeWidth="2"/><path d="m68 199 5 3m7 3 5 2m7 2 5 2m51-1 6-2m7-3 6-2m6-3 4-2" stroke={palette.light} strokeWidth="1.6"/><g color={palette.accent}><Crest region={outfit} x={120} y={187} scale={.45}/></g></>}
      {companion && <image href="/art/olive.webp" x="155" y="174" width="69" height="74" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>}
      <ellipse cx="121" cy="246" rx="30" ry="2" fill="#a4b19a" opacity=".12"/>
    </svg>
  </span>;
}

export default Avatar;
