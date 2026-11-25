import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Download, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, Dialog } from './ui';
import './installation.css';

export const packagedApp = import.meta.env.MODE.startsWith('native-');

type Device = 'android' | 'apple' | 'computer';
type InstallPrompt = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' } | void>;
};

const devices: { id: Device; label: string }[] = [
  { id: 'android', label: 'Android' },
  { id: 'apple', label: 'iPhone & iPad' },
  { id: 'computer', label: 'Computer' },
];

function currentDevice(): Device {
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'apple';
  return 'computer';
}

function launchedInstalled() {
  return packagedApp || matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstallation() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(launchedInstalled);
  const [readyOffline, setReadyOffline] = useState(packagedApp);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (packagedApp) return;
    function offerInstall(event: Event) {
      if (!('prompt' in event) || typeof event.prompt !== 'function') return;
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    function completeInstall() {
      setInstalled(true);
      setPrompt(null);
      setFeedback('');
    }
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', completeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', completeInstall);
    };
  }, []);

  useEffect(() => {
    if (packagedApp || !('serviceWorker' in navigator) || !('caches' in window)) return;
    let mounted = true;
    void navigator.serviceWorker.ready.then(async registration => {
      const shell = await caches.match(new URL('index.html', registration.scope).href, { ignoreSearch: true });
      if (mounted) setReadyOffline(shell?.ok === true);
    }).catch(() => { /* Readiness requires a confirmed cache entry. */ });
    return () => { mounted = false; };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null);
    setFeedback('');
    try {
      const result = await prompt.prompt();
      if (result?.outcome === 'dismissed') setFeedback('You can install later from your browser’s menu.');
    } catch {
      setFeedback('Use the steps below to install from your browser.');
    }
  }

  return { canPrompt: !!prompt, installed, readyOffline, feedback, install };
}

export function InstallAction({ className, onOpen }: { className?: string; onOpen?: () => void }) {
  const [, setParams] = useSearchParams();
  if (packagedApp) return null;
  return <Button className={className} variant="secondary" aria-haspopup="dialog" onClick={() => {
    onOpen?.();
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('install', '1');
      return next;
    }, { replace: true });
  }}><Download size={17}/>Install PROS</Button>;
}

export function OfflineReadiness({ ready }: { ready: boolean }) {
  return <div className="onboarding-note install-offline" role="status">
    <ShieldCheck size={22}/>
    <p>{ready
      ? <><strong>Ready offline.</strong> The app and its artwork are saved for your next visit.</>
      : <>Keep PROS open to prepare it for offline use. Look for <strong>Ready offline</strong> here.</>}</p>
  </div>;
}

export function InstallGuide({ installation, onClose }: {
  installation: ReturnType<typeof useInstallation>; onClose: () => void;
}) {
  const [device, setDevice] = useState<Device>(currentDevice);
  const label = devices.find(item => item.id === device)?.label;
  const canInstallHere = installation.canPrompt && device === currentDevice() && device !== 'apple';
  return <Dialog title="Install PROS" onClose={onClose} className="install-sheet"
    footer={<Button variant={installation.installed ? 'primary' : 'secondary'} onClick={onClose}>
      {installation.installed ? 'Back to PROS' : 'Keep using the browser'}
    </Button>}>
    <div className="install-copy">
      {installation.installed
        ? <div className="install-intro"><Check size={25}/><p><strong>PROS is installed.</strong> Open it from the PROS icon whenever you want to return.</p></div>
        : <>
          <div className="install-intro"><img src="/favicon.svg" width="42" height="42" alt=""/><p>Add PROS to your Home Screen for quick access. It’s free and opens in its own window.</p></div>
          <div className="install-devices" role="group" aria-label="Choose a device">
            {devices.map(item => <Button key={item.id} variant="secondary" aria-pressed={device === item.id} onClick={() => setDevice(item.id)}>
              {item.id === 'computer' ? <Monitor size={17}/> : <Smartphone size={17}/>}
              {item.label}
            </Button>)}
          </div>
          <section aria-label={`Install on ${label}`}>
            {canInstallHere && <Button className="install-confirm" onClick={() => void installation.install()}><Download size={17}/>Install on this device</Button>}
            {installation.feedback && <p className="small muted" role="status">{installation.feedback}</p>}
            {device === 'android' ? <ol>
              <li>Open PROS in <strong>Chrome</strong>.</li>
              <li>Open Chrome’s <strong>More</strong> menu and choose <strong>Install app</strong> or <strong>Install and create shortcut</strong>.</li>
              <li>Tap <strong>Install</strong> and look for the PROS icon.</li>
            </ol> : device === 'apple' ? <ol>
              <li>Open PROS in <strong>Safari</strong>.</li>
              <li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li>
              <li>Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li>
            </ol> : <p>Look for <strong>Install PROS</strong> in your browser’s address bar or menu. On Mac Safari, choose <strong>File → Add to Dock</strong>. You can also use PROS in this tab.</p>}
          </section>
        </>}
      <OfflineReadiness ready={installation.readyOffline}/>
      <p className="small muted">On a new device, open the app online first. Sign in to your account to restore your own world, or explore the sample world to look around.</p>
    </div>
  </Dialog>;
}
