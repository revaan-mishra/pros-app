import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { useGame } from '../app-context';
import { clampTourStep, clipTourRect, finishTour, moveTour, readTourState, skipTour, startTour, tourNavigationTarget, tourSteps, writeTourState, type TourMode, type TourRect, type TourState } from '../tour';
import { Button } from './ui';
import './guided-tour.css';

export interface GuidedTourProps { mode?: TourMode; onClose: () => void; onComplete: () => void }

/** Mount only after the user accepts a compact invitation or chooses Replay.
 * The tour never invokes game commands, logs effort, or completes objectives. */
export function GuidedTour({ mode = 'intro', onClose, onComplete }: GuidedTourProps) {
  const { accountId, data } = useGame(); const navigate = useNavigate(); const location = useLocation();
  const scope = `${accountId}\u0000${mode}`;
  const loadState = () => startTour(readTourState(accountId,undefined,mode),false,undefined,mode);
  const [stored,setStored] = useState(()=>({scope,state:loadState()}));
  const currentScope = stored.scope === scope;
  const state = currentScope ? stored.state : loadState();
  const setState = (update: (previous: TourState) => TourState) => setStored(previous=>({scope,state:update(previous.scope===scope?previous.state:loadState())}));
  const [targetRect, setTargetRect] = useState<TourRect | null>(null); const [usingFallback, setUsingFallback] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null); const id = useId();
  const steps = tourSteps(mode); const stepIndex = clampTourStep(state.step,mode); const step = steps[stepIndex]; const isLast = stepIndex === steps.length - 1;
  const navigationTarget = tourNavigationTarget(step.route,location.pathname,location.search);
  const reduced = data.profile.motion === 'reduced' || data.profile.motion === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => { if(!currentScope){setStored({scope,state:loadState()});setTargetRect(null);} }, [accountId,mode,scope,currentScope]);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const node = dialog.current; node?.showModal(); heading.current?.focus();
    return () => { node?.close(); const destination = previousFocus.current?.isConnected ? previousFocus.current : document.querySelector<HTMLElement>('#main-content h1'); destination?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if(currentScope)setStorageAvailable(writeTourState(accountId, state,undefined,mode)); }, [accountId, mode, state, currentScope]);
  useEffect(() => { if (currentScope && navigationTarget !== null) navigate(navigationTarget); }, [currentScope, navigationTarget, navigate]);
  useEffect(() => {
    if (!currentScope || navigationTarget !== null) { setTargetRect(null); return; }
    let target: HTMLElement | null = null; let disposed = false; let firstMeasure = true;
    let timer: ReturnType<typeof setTimeout> | undefined; let resizeObserver: ResizeObserver | undefined;
    const visible = (node: HTMLElement) => {
      const box = node.getBoundingClientRect(); const style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !node.closest('[inert], [aria-hidden="true"]');
    };
    const measure = () => {
      if (disposed || !target?.isConnected) return;
      const box = target.getBoundingClientRect();
      const next = clipTourRect({ left: box.left, top: box.top, width: box.width, height: box.height }, viewport());
      setTargetRect(previous => previous?.left === next?.left && previous?.top === next?.top && previous?.width === next?.width && previous?.height === next?.height ? previous : next);
    };
    const findAndMeasure = () => {
      if (disposed) return;
      const candidates = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)];
      target = candidates.find(visible) || document.querySelector<HTMLElement>('#main-content h1');
      setUsingFallback(!candidates.some(visible));
      if (target && firstMeasure) {
        firstMeasure = false;
        // Scripted scrolling is allowed while the modal blocks background input.
        // Fixed navigation needs no scroll; in-content controls should be visible.
        if (!target.closest('.mobile-nav, .sidebar')) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
        if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(measure); resizeObserver.observe(target); }
      }
      measure();
      heading.current?.focus({ preventScroll: true });
    };
    const resized = () => {
      setScreenWidth(window.innerWidth);
      // A desktop sidebar may become an inert mobile drawer after rotation.
      // Re-resolve the visible anchor instead of highlighting the hidden copy.
      if (target && !visible(target)) { resizeObserver?.disconnect(); firstMeasure = true; findAndMeasure(); }
      else measure();
    };
    timer = setTimeout(findAndMeasure, 60);
    window.addEventListener('resize', resized); window.addEventListener('scroll', measure, true);
    return () => { disposed = true; clearTimeout(timer); resizeObserver?.disconnect(); window.removeEventListener('resize', resized); window.removeEventListener('scroll', measure, true); };
  }, [currentScope, location.pathname, location.search, navigationTarget, reduced, state.step, step.route, step.target]);

  const close = () => { const skipped = skipTour(state); writeTourState(accountId, skipped,undefined,mode); onClose(); };
  const next = () => {
    if (isLast) { const completed = finishTour(state); writeTourState(accountId, completed,undefined,mode); onComplete(); }
    else { setTargetRect(null); setState(previous => moveTour(previous, 1)); }
  };
  const previous = () => { setTargetRect(null); setState(current => moveTour(current, -1)); };
  const narrow = screenWidth <= 760;
  const targetAtBottom = targetRect && targetRect.top + targetRect.height > window.innerHeight - 115;
  const targetAtRight = targetRect && targetRect.left + targetRect.width > window.innerWidth - 420 && targetRect.top + targetRect.height > window.innerHeight - 330;
  const cardStyle = { '--tour-bottom': narrow && targetAtBottom ? '100px' : '22px', '--tour-side': !narrow && targetAtRight ? 'left' : 'right' } as CSSProperties;
  return <dialog ref={dialog} className={`guided-tour ${targetRect ? 'guided-tour-targeted' : ''} ${!narrow && targetAtRight ? 'guided-tour-card-left' : ''}`} style={cardStyle} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); close(); }}>
    {!targetRect && <div className="guided-tour-shade" aria-hidden="true"/>}
    {targetRect && <div className="guided-tour-highlight" aria-hidden="true" style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }}/>} 
    <section className="guided-tour-card" key={step.id}>
      <div className="guided-tour-topline"><span className="guided-tour-compass"><Compass size={21} strokeWidth={1.4}/></span><span>{mode === 'reference' ? 'THE REFERENCE FIELD GUIDE' : 'THREE STOPS TO BEGIN'}</span><button aria-label="Skip guided tour" onClick={close}><X size={19}/></button></div>
      <div className="guided-tour-step-label">{step.eyebrow}</div>
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{step.title}</h2>
      <p id={`${id}-body`}>{step.body}</p>
      <div className="guided-tour-takeaway"><span aria-hidden="true">✧</span><span>{step.takeaway}</span></div>
      {usingFallback && <p className="guided-tour-fallback">You’re on the right page. The highlighted heading marks this stop.</p>}
      {!storageAvailable && <p className="guided-tour-fallback" role="status">Tour progress cannot be saved in this browser right now. Your game records are unchanged.</p>}
      <div className="guided-tour-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}><div aria-hidden="true">{steps.map((item, index) => <span key={item.id} className={index <= stepIndex ? 'reached' : ''}/>)}</div><span>{stepIndex + 1} of {steps.length}</span></div>
      <div className="guided-tour-actions"><Button variant="ghost" onClick={previous} disabled={stepIndex === 0}><ArrowLeft size={16}/>Back</Button><button className="guided-tour-skip" onClick={close}>Skip tour</button><Button onClick={next}>{isLast ? mode === 'reference' ? 'Close field guide' : 'Make it your own' : 'Next'}{isLast ? <Check size={16}/> : <ArrowRight size={16}/>}</Button></div>
    </section>
  </dialog>;
}
