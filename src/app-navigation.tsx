import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useNavigationType, type Location } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const pageNames: Record<string, string> = {
  '/': 'Today',
  '/quests': 'Quests',
  '/projects': 'Project',
  '/skills': 'Skills',
  '/world': 'World',
  '/character': 'Character',
  '/focus': 'Focus',
  '/chronicle': 'Chronicle',
  '/journal': 'Journal',
  '/library': 'Library',
  '/insights': 'Insights',
  '/history': 'Activity history',
  '/outputs': 'Outputs',
  '/settings': 'Settings',
};

const rootPath = (path: string) => `/${path.split('/')[1] || ''}`;
export const pageName = (path: string) => pageNames[rootPath(path)] || 'PROS';
const routeView = ({ pathname, search }: Pick<Location, 'pathname' | 'search'>) => pathname + search;
const detailRoute = /^\/(projects|skills)\/[^/]+\/?$/;
const rememberedTabs = new Set(['/quests', '/skills', '/world', '/character']);

export const DetailOrigin = createContext<Location | undefined>(undefined);

/** These values belong to the mounted profile and reset on account switch. */
export function useAppNavigation() {
  const entry = useLocation();
  const navigationType = useNavigationType();
  const visited = useRef<Location>(entry);
  const origins = useRef(new Map<string, Location>());
  const tabs = useRef(new Map<string, string>());
  const scroll = useRef(new Map<string, number>());
  const previous = visited.current;
  const origin = detailRoute.test(entry.pathname)
    ? navigationType === 'PUSH' && previous.key !== entry.key && previous.pathname !== entry.pathname
      ? previous
      : origins.current.get(entry.key)
    : undefined;

  useLayoutEffect(() => {
    visited.current = entry;
    if (origin) origins.current.set(entry.key, origin);
    if (rememberedTabs.has(entry.pathname)) tabs.current.set(entry.pathname, entry.search);
  }, [entry, origin]);

  const tabPath = rootPath(origin?.pathname ?? entry.pathname);
  const activeTab = tabPath === '/projects' ? '/quests' : tabPath;
  return {
    origin, activeTab,
    tabHref: (path: string) => path + (rememberedTabs.has(path) && entry.pathname === path ? entry.search : tabs.current.get(path) || ''),
    saveScroll: (top: number) => scroll.current.set(routeView(entry), top),
    position: scroll.current.get(routeView(entry)) || 0,
  };
}

/** Mount inside Suspense so lazy pages have their full height when restored. */
export function RouteView({ position, children }: { position: number; children: ReactNode }) {
  const node = useRef<HTMLDivElement>(null);
  const previous = useRef<Location | null>(null);
  const entry = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    const last = previous.current;
    previous.current = entry;
    const element = node.current;
    const main = element?.closest('main');
    if (!main || !element) return;
    const newPage = !last || last.pathname !== entry.pathname;
    if (newPage || navigationType === 'POP' && last.key !== entry.key) main.scrollTop = position;
    if (newPage && !document.querySelector('dialog[open]')) {
      element.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    }
  }, [entry, navigationType, position]);

  return <div ref={node}>{children}</div>;
}

export function DetailBack({ parent, className = 'back-link' }: { parent: '/quests' | '/skills'; className?: string }) {
  const origin = useContext(DetailOrigin);
  const navigate = useNavigate();
  const path = origin?.pathname || parent;
  return <Link className={className} to={origin ? routeView(origin) : parent} onClick={event => {
    if (!origin || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    navigate(-1);
  }}><ArrowLeft size={16}/>Back to {pageName(path)}</Link>;
}
