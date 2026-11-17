import { useEffect, useState, type ReactNode, type SVGProps } from 'react';
import { getAutoTimeOfDay, type TimeOfDay } from '../components/WorldArt';
import type { Keepsake, KeepsakeKind } from './model';

export function KeepsakeGlyph({ kind, className = '', ...props }: { kind: KeepsakeKind } & SVGProps<SVGSVGElement>) {
  return <svg className={`keepsake-glyph ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" {...props}>
    <ellipse cx="50" cy="84" rx="29" ry="5" fill="currentColor" opacity=".12"/>
    {kind === 'volume' ? <><path d="M26 22h45v56H26q-8-4-8-9V30q0-8 8-8Z" fill="var(--relic-fill, #263b40)" stroke="currentColor" strokeWidth="2"/><path d="M28 22v55m3-8h36M20 70q4-5 10-1" stroke="currentColor" strokeWidth="2"/><path d="M42 37h16m-16 7h16m-8-14v23" stroke="currentColor" opacity=".65"/><path d="m59 22-1 35 6-5 5 5V22" fill="currentColor" opacity=".7"/></> : kind === 'folio' ? <><path d="m24 25 48-5 7 55-48 6Z" fill="var(--relic-fill, #343346)" stroke="currentColor" strokeWidth="2"/><path d="m24 25 7 56-6-2-7-52Zm20 11 21-2M46 47l18-2M48 57l14-2" stroke="currentColor" strokeWidth="2"/><circle cx="56" cy="59" r="8" fill="currentColor" opacity=".55"/><path d="m51 66-2 14 8-6 6 4-1-13" fill="currentColor" opacity=".6"/></> : kind === 'mechanism' ? <><path d="M28 75h46l4 7H24Z" fill="currentColor" opacity=".6"/><path d="M48 66v10m10-10v10" stroke="currentColor" strokeWidth="3"/><path d="m45 22 15 1 1 8 8 5 8-3 6 13-7 5-1 8 6 6-10 10-7-5-9 1-4 7-14-5 1-9-6-7-8 1-2-14 8-3 4-8-2-8Z" fill="var(--relic-fill, #42332a)" stroke="currentColor" strokeWidth="2"/><circle cx="52" cy="49" r="13" stroke="currentColor" strokeWidth="2"/><circle cx="52" cy="49" r="5" fill="currentColor"/></> : <><path d="m33 62-6 23 17-7 7 9 7-26" fill="currentColor" opacity=".45"/><path d="m60 60 15 19-15-2-8 9-8-24" fill="currentColor" opacity=".65"/><path d="m50 15 9 6 11 1 3 11 7 9-5 11-1 12-12 3-10 7-10-7-12-2-2-12-6-10 7-10 2-11 12-2Z" fill="var(--relic-fill, #3b3c2d)" stroke="currentColor" strokeWidth="2"/><circle cx="50" cy="45" r="18" stroke="currentColor" opacity=".65"/><path d="m41 45 7 7 12-15" stroke="currentColor" strokeWidth="2.5"/></>}
  </svg>;
}

function SceneImage({ src, eager = false }: { src: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return !failed ? <img src={src} alt="" width="1536" height="1024" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/> : <div className="scene-unavailable">Illustration unavailable · your records are ready</div>;
}
export function HomeScene({ timeZone, children }: { timeZone: string; children?: ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  return <div className="pros-scene home-scene" data-sky={getAutoTimeOfDay(timeZone, now)}><div className="scene-paint" aria-hidden="true"><SceneImage src="/art/home.webp" eager/><div className="scene-light"/></div>{children}</div>;
}
export function AtelierScene({ stage, keepsakes = [], children, timeOfDay = 'twilight' }: { stage: number; keepsakes?: Keepsake[]; children?: ReactNode; eager?: boolean; timeOfDay?: TimeOfDay }) {
  const level = Math.min(3, Math.max(0, Math.floor(stage)));
  const [failed, setFailed] = useState(false);
  const src = level === 3 ? '/art/atelier-flourish.webp' : '/art/atelier.webp';
  useEffect(() => setFailed(false), [src]);
  return <div className={`pros-scene atelier-scene atelier-stage-${level}`}>
    <div className="scene-paint" aria-hidden="true">{failed ? <div className="scene-unavailable">Illustration unavailable · your records are ready</div> : <svg className="atelier-canvas" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" focusable="false">
      <image href={src} width="1536" height="1024" onError={() => setFailed(true)}/>
      <rect width="1536" height="1024" fill="#061724" opacity={level === 0 ? .46 : level === 1 ? .14 : 0}/>
      <rect width="1536" height="1024" fill={timeOfDay === 'night' ? '#071d3f' : timeOfDay === 'dawn' ? '#d89f85' : '#d1e5ce'} opacity={timeOfDay === 'night' ? .28 : timeOfDay === 'dawn' ? .1 : timeOfDay === 'day' ? .045 : 0}/>
      {level >= 1 && <ellipse cx="1250" cy="610" rx="180" ry="210" fill="#edb958" opacity=".045"/>}
      {level >= 2 && [0, 1].map(i => <g key={i}>
        {level === 2 && <rect x={i ? 295 : 125} y={i ? 363 : 295} width={i ? 110 : 165} height={i ? 112 : 196} fill="#2a302dcc" stroke="#a48755" strokeWidth="6"/>}
        <KeepsakeGlyph kind={keepsakes[i]?.kind || 'folio'} x={i ? 303 : 140} y={i ? 368 : 325} width={i ? 92 : 130} height={i ? 100 : 145} style={{ width: i ? 92 : 130, height: i ? 100 : 145 }}/>
      </g>)}
    </svg>}
    </div>{children}
  </div>;
}
