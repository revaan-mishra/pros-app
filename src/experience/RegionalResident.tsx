import { useEffect, useId, useState } from 'react';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { Button } from '../components/ui';
import type { RegionId } from '../types';
import { REGION_EXPERIENCES, type ResidentResponse } from './regions';
import './residents.css';

const palettes: Record<RegionId, { coat: string; skin: string; hair: string; accent: string }> = {
  observatory: { coat: '#405673', skin: '#c79672', hair: '#d1cec2', accent: '#bccded' },
  foundry: { coat: '#644c3c', skin: '#b87958', hair: '#342e2b', accent: '#d9a574' },
  atelier: { coat: '#525a65', skin: '#c8a386', hair: '#4a362e', accent: '#c7b3d6' },
  training: { coat: '#5a6447', skin: '#b48262', hair: '#383a31', accent: '#bccb9b' },
  citadel: { coat: '#827046', skin: '#9f664b', hair: '#2c2b2a', accent: '#dfc27f' },
  sanctuary: { coat: '#526f64', skin: '#bd9577', hair: '#aba99a', accent: '#abd1b8' },
};

/** Original small vector vignettes: readable residents, without an extra image download. */
export function ResidentPortrait({ regionId }: { regionId: RegionId }) {
  const palette = palettes[regionId], caretaker = REGION_EXPERIENCES[regionId].caretaker;
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  return <svg className="resident-portrait" viewBox="0 0 120 148" role="img" aria-labelledby={`${id}-title`}>
    <title id={`${id}-title`}>{caretaker.name}, {caretaker.role.toLowerCase()}. {caretaker.description}</title>
    <defs><linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={palette.coat}/><stop offset="1" stopColor="#112731"/></linearGradient></defs>
    <path d="M9 143V62a51 51 0 0 1 102 0v81Z" fill={`url(#${id}-wash)`}/>
    <path d="M9 140V62a51 51 0 0 1 102 0v78M17 140V63a43 43 0 0 1 86 0v77" fill="none" stroke={palette.accent} opacity=".3"/>
    <path d="M18 144q2-46 42-48t42 48Z" fill={palette.coat} stroke={palette.accent} strokeWidth="1.4"/>
    <path d="m47 96 13 21 13-21-5-13H52Z" fill={palette.skin}/>
    <path d="M33 55q-2-32 27-32t27 32v38H34Z" fill={palette.hair}/>
    <ellipse cx="60" cy="65" rx="23" ry="31" fill={palette.skin}/>
    <path d="M35 57q7-2 17-16 10 16 32 17-1-33-25-33T35 57Z" fill={palette.hair}/>
    <path d="m45 65 9-1m12 0 9 1m-16 4-3 12 6 1m-9 9q7 3 14-1" fill="none" stroke="#5e4a3b" strokeLinecap="round" strokeWidth="1.6"/>
    <path d="M47 71h4m18 0h4" stroke="#293531" strokeLinecap="round" strokeWidth="2.4"/>
    <path d="m42 103 18 17 18-17M60 121v22" fill="none" stroke={palette.accent} opacity=".7"/>
    {regionId === 'observatory' && <><path d="M43 71h14m6 0h14m-20 0h6" stroke="#e0cba0" fill="none"/><circle cx="50" cy="72" r="8" stroke="#e0cba0" fill="none"/><circle cx="70" cy="72" r="8" stroke="#e0cba0" fill="none"/><path d="m25 123 29-5 5 24-29 3Z" fill="#b4b6a0" stroke="#d0bd86"/><path d="m31 130 17-4m-13 12 16-4" stroke="#536b79"/><path d="m76 120 8-9 8 9-8 8Z" fill="none" stroke="#e1c68d"/></>}
    {regionId === 'foundry' && <><path d="m40 103-6 39h49l-5-39-18 16Z" fill="#624333" stroke="#b99268"/><path d="M48 122h25v16H48Z" fill="#7d5b40"/><path d="M82 109v26m-5-24v-7h15v7m-10 19h10" stroke="#dfc29a" fill="none" strokeWidth="2"/><path d="M39 43q20-12 41 1" stroke="#a6926f" strokeWidth="6"/><circle cx="45" cy="43" r="5" fill="#86938a" stroke="#bdb08c"/><circle cx="70" cy="42" r="5" fill="#86938a" stroke="#bdb08c"/></>}
    {regionId === 'atelier' && <><path d="M42 66h14m8 0h14m-22 0h8" stroke="#645944" fill="none"/><path d="m26 124 30-6 5 26H31Z" fill="#70647a" stroke="#cfb88f"/><path d="m34 130 15-3m-13 10 15-3" stroke="#d6c8b4"/><path d="m82 111 5 31m-2-32 5-7 2 8Z" fill="#a99876" stroke="#d8cbaa"/></>}
    {regionId === 'training' && <><path d="m37 105 23 17 23-17-5 17-18 7-18-7Z" fill="#829272"/><path d="M27 90v55" stroke="#b39a75" strokeWidth="5" strokeLinecap="round"/><path d="m22 114 10-1m-10 5 10-1m-10 5 10-1" stroke="#d5c6a3" strokeWidth="2"/><path d="m75 128 15-2 3 10-15 3Z" fill="#ab9974" stroke="#d9ccaa"/><path d="m79 129 2 8m4-9 2 8" stroke="#586344"/><path d="M34 43q1-26 27-25t28 28l-13-11-24-5Z" fill={palette.hair}/></>}
    {regionId === 'citadel' && <><path d="m37 103 23 19 23-19-6 26-17-7-17 7Z" fill="#b49e64"/><path d="m29 126 26-7 7 23-28 3Z" fill="#d0c4a7" stroke="#ebd79e"/><path d="m34 132 18-4m-16 10 18-4" stroke="#746a50"/><circle cx="49" cy="136" r="4" fill="#a06b4f"/><path d="m72 101 14 11m-12 3 6-10" stroke="#e2c685"/><path d="M33 52q-1-31 27-31 31 0 29 34l-14-8-9-12-24 12Z" fill={palette.hair}/></>}
    {regionId === 'sanctuary' && <><path d="m34 101 26 21 25-21 9 36-34-11-30 12Z" fill="#a7b29b" stroke="#d4d9bd"/><path d="m33 123 52 2-6 18H39Z" fill="#937a54" stroke="#c1b38a"/><path d="M49 131q-11-15-14-4 2 8 14 8m7-6q3-17 10-11 4 7-10 16m10-1q14-12 15-2-3 6-15 5" fill="#718e6e" stroke="#a8bd87"/><path d="M36 46q4-25 25-25t26 28l-19-14-13 5Z" fill={palette.hair}/></>}
  </svg>;
}

export function RegionalResident({ regionId, response, onAction }: { regionId: RegionId; response: ResidentResponse; onAction: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const resident = REGION_EXPERIENCES[regionId].caretaker;
  useEffect(() => setDismissed(false), [regionId, response.state]);
  if (dismissed) return <button className="resident-reopen text-link" onClick={() => setDismissed(false)}><MessageCircle size={16}/>Talk to {resident.name}</button>;
  return <aside className="regional-resident" aria-label={`${resident.name}, ${resident.role}`}>
    <ResidentPortrait regionId={regionId}/><div className="resident-copy"><p className="eyebrow">{resident.name} · {resident.role}</p><h3>{response.heading}</h3><p>{response.text}</p><Button variant="ghost" onClick={onAction}>{response.action.label}<ArrowRight size={15}/></Button></div>
    <button className="resident-dismiss" aria-label={`Dismiss ${resident.name}'s note`} onClick={() => setDismissed(true)}><X size={17}/></button>
  </aside>;
}
