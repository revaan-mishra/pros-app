import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGame } from '../app-context';
import { COSMETICS, REGIONS } from '../catalog';
import type { GameData, GameEntity } from '../types';
import type { User } from 'firebase/auth';
import { Cloud, Download, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { db, exportBackup, loadGame, recordKey } from '../storage';
import { cloudConfigured, friendlyCloudError, refreshAccount, register, resetPassword, signIn, signOutAccount, verifyEmail, watchAccount, type CloudErrorContext } from '../cloud/firebase';
import { createFirestoreAdapter } from '../cloud/firestore-adapter';
import { applyCloudPage, resolveCloudConflicts, type ConflictChoices, type ConflictReviews } from '../cloud/local-sync';
import { deleteCloudAccount, finishLocalAccountRemoval, LocalAccountCleanupError } from '../cloud/account-deletion';
import { pauseCloudSync, retryCloudSync, useCloudStatus } from '../cloud/useCloudSync';
import { Button, Dialog, Field, Tag } from './ui';
import './account-panel.css';

function useFirebaseUser() {
  const [session, setSession] = useState<{ user: User | null; ready: boolean; error: string }>({ user: null, ready: !cloudConfigured, error: '' });
  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true, unsubscribe: (() => void) | undefined;
    void watchAccount(user => { if (active) setSession({ user, ready: true, error: '' }); }).then(stop => { if (active) unsubscribe = stop; else stop(); }).catch(error => { if (active) setSession({ user: null, ready: true, error: friendlyCloudError(error, 'account') }); });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  async function refresh() { const user = await refreshAccount(); setSession({ user, ready: true, error: '' }); }
  return { ...session, refresh };
}
async function downloadBackup(accountId: string) {
  const backup = await exportBackup(accountId);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `pros-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Wait for restored identity before rendering cached private content. Expired
 * sessions keep initialized local work available; a different identity does not. */
export function CloudIdentityGuard({ accountId, onLeave, children }: { accountId: string; onLeave: () => void; children: ReactNode }) {
  const session = useFirebaseUser();
  if (!session.ready) return <div className="boot-state"><div className="compass-loader"/><p>Opening your private world…</p></div>;
  if (session.user && `firebase:${session.user.uid}` !== accountId) return <div className="boot-state"><ShieldCheck size={32}/><h1>Your worlds stay separate.</h1><p>A different account is signed in. Return to the opening screen to choose its world or sign in to this one.</p><Button onClick={onLeave}>Return to the opening screen</Button></div>;
  return children;
}

/** Online account entry; onboarding remains the existing authored experience. */
export function AccountEntry({ onOpen, onCreate, onClose }: { onOpen: (accountId: string) => void; onCreate: (accountId: string) => void; onClose: () => void }) {
  const session = useFirebaseUser(); const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  async function work(action: () => Promise<void>, context: CloudErrorContext = 'account') { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await action(); } catch (error) { setError(friendlyCloudError(error, context)); } finally { setBusy(false); setPassword(''); } }
  async function submit(event: FormEvent) { event.preventDefault(); await work(async () => {
    if (!navigator.onLine) throw new Error('Connect to the internet to set up or sign in to an account.');
    if (mode === 'reset') { await resetPassword(email); setMessage('If an account uses this address, a password reset link will arrive shortly.'); }
    else if (mode === 'register') { const result = await register(email, password); setMessage(result.verification.status === 'sent' ? 'Your account was created. Check your inbox to verify your email, then return here.' : result.verification.message); }
    else await signIn(email, password);
  }, mode === 'register' ? 'register' : mode === 'reset' ? 'reset-password' : 'sign-in'); }
  async function open() { await work(async () => {
    const user = session.user; if (!user || !user.emailVerified) throw new Error('Verify your email before opening this account.');
    const accountId = `firebase:${user.uid}`;
    if (navigator.onLine) {
      const adapter = await createFirestoreAdapter(accountId); const metadata = await db.syncMetadata.get(accountId);
      await applyCloudPage(accountId, await adapter.pull(metadata?.cursor || 0));
    } else {
      const metadata = await db.syncMetadata.get(accountId);
      if (!metadata?.accessGranted || !await loadGame(accountId)) throw new Error('Open this account online once before using it offline.');
    }
    if ((await loadGame(accountId))) onOpen(accountId); else onCreate(accountId);
  }); }
  return <Dialog title={session.user ? 'Your world, wherever you are.' : mode === 'register' ? 'Give your world a home.' : mode === 'reset' ? 'Find your way back.' : 'Welcome back, wanderer.'} eyebrow="YOUR PRIVATE ACCOUNT" onClose={() => { if (!busy) onClose(); }}><div className="form-stack account-entry">
    {!cloudConfigured ? <p>Account services are not available in this installation. You can keep using your saved worlds and export a backup.</p> : !session.ready ? <p role="status">Checking your sign-in…</p> : session.user ? <>
      <div className="account-identity"><ShieldCheck size={26}/><div><strong>{session.user.email}</strong><p>{session.user.emailVerified ? 'Email verified' : 'One more step: verify your email'}</p></div></div>
      {!session.user.emailVerified ? <><p>Open the verification link in your inbox, then return here and choose I’ve verified my email.</p><div className="button-row"><Button disabled={busy} onClick={() => void work(async () => { await session.refresh(); })}><RefreshCw size={16}/>I’ve verified my email</Button><Button variant="secondary" disabled={busy} onClick={() => void work(async () => { await verifyEmail(); setMessage('Verification email sent.'); }, 'verification')}><Mail size={16}/>Resend link</Button></div></> : <><p>Your progress is saved on this device first, then privately synchronized. A new device restores your world after sign-in.</p><Button disabled={busy} onClick={() => void open()}>{busy ? 'Opening your world…' : 'Open my world'}<Cloud size={16}/></Button></>}
      <Button variant="ghost" disabled={busy} onClick={() => void work(async () => { await signOutAccount(); })}>Use another account<LogOut size={16}/></Button>
      <details className="account-delete-entry"><summary>Account removal</summary><p>If a previous removal was interrupted, you can finish it here.</p><Button variant="danger" disabled={busy || !session.user.emailVerified} onClick={() => setDeleting(true)}>Remove this account</Button></details>
    </> : <form onSubmit={submit} className="form-stack"><p>{mode === 'register' ? 'Create a private account to keep your progress together across devices. Verify your email to open your world.' : mode === 'reset' ? 'We’ll send instructions for choosing a new password.' : 'Sign in to restore your world and synchronize saved work.'}</p><Field label="Email"><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy}/></Field>{mode !== 'reset' && <Field label="Password" hint={mode === 'register' ? 'At least eight characters.' : undefined}><input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : undefined} maxLength={4096} required disabled={busy}/></Field>}<Button type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'reset' ? 'Send reset link' : mode === 'register' ? 'Create my account' : 'Sign in'}</Button><div className="account-mode-links">{(['signin', 'register', 'reset'] as const).filter(item => item !== mode).map(item => <button key={item} type="button" disabled={busy} onClick={() => { setMode(item); setPassword(''); setError(''); setMessage(''); }}>{item === 'signin' ? 'Back to sign in' : item === 'register' ? 'Create an account' : 'Forgot password?'}</button>)}</div></form>}
    {(error || session.error) && <p role="alert" className="form-error">{error || session.error}</p>}{message && <p role="status" className="account-message">{message}</p>}
  </div>{deleting && session.user && <DeleteCloudAccount accountId={`firebase:${session.user.uid}`} close={() => setDeleting(false)} removed={onClose}/>}</Dialog>;
}

export function AccountPanel({ accountId, onLeave }: { accountId: string; onLeave: () => void }) {
  const { data } = useGame();
  const status = useCloudStatus(accountId); const session = useFirebaseUser();
  const conflicts = useLiveQuery(async () => { const saved = await db.syncConflicts.where('accountId').equals(accountId).filter(conflict => !conflict.resolvedAt).toArray(); return Promise.all(saved.map(async conflict => { const key = recordKey(accountId, conflict.kind, conflict.entityId); const local = await db.records.get(key), remote = await db.cloudRecords.get(key); return { ...conflict, local: local?.data || conflict.local, remote: remote || conflict.remote }; })); }, [accountId]) || [];
  const [entry, setEntry] = useState(false), [choices, setChoices] = useState<ConflictChoices>({}), [reviews, setReviews] = useState<ConflictReviews>({}), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [signingOut, setSigningOut] = useState(false), [deleting, setDeleting] = useState(false), [removeCopy, setRemoveCopy] = useState(false);
  async function work(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await action(); } catch (error) { setError(friendlyCloudError(error)); } finally { setBusy(false); } }
  const reviewed = (conflict: typeof conflicts[number]) => !!choices[conflict.key] && reviews[conflict.key]?.localRevision === conflict.local.revision && reviews[conflict.key]?.remoteSequence === (conflict.remote?.sequence || 0);
  const cloud = accountId.startsWith('firebase:'); const matches = session.user && `firebase:${session.user.uid}` === accountId;
  return <section className="card account-panel" aria-label="Account and synchronization"><div className="section-title"><div><h2>{cloud ? 'Your private account' : 'This device, your world'}</h2><p>{cloud ? 'Saved here first. Kept together privately.' : 'Your records stay in this browser. Save an external backup for safekeeping.'}</p></div><ShieldCheck size={23}/></div>
    {cloud ? <><div className="account-status"><Tag tone={status.phase === 'error' || status.phase === 'conflict' ? 'warning' : ''}>{status.phase === 'synced' ? 'Synchronized' : status.phase === 'syncing' ? 'Synchronizing' : status.phase === 'conflict' ? 'Review needed' : status.phase === 'offline' ? 'Offline' : status.phase === 'paused' ? 'Paused' : status.phase === 'verify-email' ? 'Verify email' : status.phase === 'sign-in' ? 'Sign in needed' : status.phase === 'error' ? 'Sync needs attention' : 'Connecting'}</Tag><span>{status.pending} pending {status.pending === 1 ? 'change' : 'changes'}</span></div><p role="status">{status.message}</p>{matches && <p className="small muted">Signed in as {session.user!.email}</p>}{status.lastSyncedAt && <p className="small muted">Last synchronized {new Date(status.lastSyncedAt).toLocaleString()}</p>}<div className="button-row"><Button variant="secondary" disabled={busy || status.phase === 'syncing'} onClick={() => retryCloudSync(accountId)}><RefreshCw size={16}/>Retry sync</Button><Button variant="ghost" disabled={busy} onClick={() => pauseCloudSync(accountId, status.phase !== 'paused')}>{status.phase === 'paused' ? 'Resume sync' : 'Pause sync'}</Button>{(!matches || !session.user!.emailVerified) && <Button onClick={() => setEntry(true)}>Review sign-in</Button>}</div>
      {!!conflicts.length && <div className="account-conflicts"><h3>Choose which version to keep</h3><p>Both versions stay preserved until you review every competing edit. A recovery snapshot is saved before applying your choices.</p>{conflicts.map(conflict => <fieldset key={conflict.key}><legend>{'title' in conflict.local ? conflict.local.title : 'name' in conflict.local ? conflict.local.name : 'Your profile'}</legend><details><summary>Compare saved versions</summary><div className="account-version-grid"><div><strong>This device</strong><ReadableRecord record={conflict.local} data={data}/></div><div><strong>Cloud</strong><ReadableRecord record={conflict.remote?.data || null} data={data}/></div></div></details><Field label="Version to keep"><select disabled={busy} value={reviewed(conflict) ? choices[conflict.key] : ''} onChange={event => { setChoices(current => ({ ...current, [conflict.key]: event.target.value as ConflictChoices[string] })); setReviews(current => ({ ...current, [conflict.key]: { localRevision: conflict.local.revision, remoteSequence: conflict.remote?.sequence || 0 } })); }}><option value="">Choose a version</option><option value="local">This device</option><option value="cloud">Cloud</option>{conflict.kind === 'journals' && conflict.remote && <option value="both">Both as separate journal entries</option>}</select></Field></fieldset>)}<Button disabled={busy || conflicts.some(conflict => !reviewed(conflict))} onClick={() => void work(async () => { await resolveCloudConflicts(accountId, choices, reviews); setChoices({}); setReviews({}); retryCloudSync(accountId); setMessage('Choices saved. Synchronization will check for any newer edits.'); })}>Apply reviewed choices</Button></div>}
      <div className="button-row"><Button variant="ghost" disabled={busy} onClick={() => setSigningOut(true)}><LogOut size={16}/>Sign out</Button><Button variant="ghost" disabled={busy} onClick={() => setDeleting(true)}>Remove account</Button></div>
    </> : <p className="small muted">A local world is separate from an online account. Export it before moving it to another device or importing it into your account.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}
    {entry && <AccountEntry onClose={() => setEntry(false)} onOpen={opened => { if (opened !== accountId) { setError('That is a different account. Sign out of this world before opening it.'); } setEntry(false); }} onCreate={() => { setError('That is a different account. Sign out of this world before starting it.'); setEntry(false); }}/ >}
    {signingOut && <Dialog title="Leave this world for now?" onClose={() => { if (!busy) setSigningOut(false); }}><div className="form-stack"><p>{status.pending ? `${status.pending} pending changes will stay on this device in this account. Sign in to the same account to synchronize them.` : 'Your saved records remain on this device. Signing out stops synchronization.'}</p><Button variant="secondary" disabled={busy} onClick={() => void work(async () => { await downloadBackup(accountId); setMessage('Backup prepared for download. Keep the file somewhere safe.'); })}><Download size={16}/>Export a backup</Button><Button disabled={busy} onClick={() => void work(async () => { await signOutAccount(); onLeave(); })}>Sign out and preserve saved work</Button><details><summary>Remove this device’s saved copy</summary><p>This clears saved records, drafts and pending changes from this browser. Your synchronized cloud records stay available after sign-in. Unsynced work is lost unless exported first.</p><label className="checkbox-field"><input type="checkbox" checked={removeCopy} onChange={event => setRemoveCopy(event.target.checked)} disabled={busy}/>I have saved what I need and want to clear this device.</label><Button variant="danger" disabled={busy || !removeCopy} onClick={() => void work(async () => { await signOutAccount(); await finishLocalAccountRemoval(accountId); onLeave(); })}>Sign out and clear this device</Button></details></div></Dialog>}
    {deleting && <DeleteCloudAccount accountId={accountId} close={() => setDeleting(false)} removed={onLeave}/ >}
  </section>;
}

function ReadableRecord({ record, data }: { record: GameEntity | null; data: GameData }) {
  if (!record) return <p>No cloud copy exists.</p>;
  const values = record as unknown as Record<string, unknown>;
  const labels: Record<string, string> = { title: 'Title', name: 'Name', displayName: 'Name', description: 'Description', body: 'Writing', note: 'Note', notes: 'Notes', outputCriterion: 'What finished means', status: 'Status', date: 'Date', localDate: 'Activity date', occurredAt: 'Recorded for', startedAt: 'Started', endedAt: 'Ended', confirmedAt: 'Confirmed', completedAt: 'Completed', targetDate: 'Target date', dueDate: 'Scheduled for', timeZone: 'Time zone', seconds: 'Effort in seconds', effortTargetSeconds: 'Effort target in seconds', targetSeconds: 'Timer target in seconds', confirmedSeconds: 'Confirmed seconds', recurrence: 'Repeats', pages: 'Current page', totalPages: 'Total pages', priority: 'Chosen priority', equipped: 'Equipped', archived: 'Archived', deleted: 'Removed', avatarStyle: 'Appearance', avatarColor: 'Appearance color', theme: 'Appearance mode', motion: 'Motion preference' };
  const text = (value: unknown) => typeof value === 'boolean' ? value ? 'Yes' : 'No' : value === null || value === '' ? 'Empty' : String(value);
  return <div className="account-readable-record"><dl>{Object.entries(labels).filter(([key]) => key in values).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{text(values[key])}</dd></div>)}{typeof values.skillId === 'string' && <div><dt>Skill</dt><dd>{data.skills.find(skill => skill.id === values.skillId)?.name || 'A saved skill'}</dd></div>}{typeof values.projectId === 'string' && <div><dt>Project</dt><dd>{data.projects.find(project => project.id === values.projectId)?.title || 'A saved project'}</dd></div>}{typeof values.regionId === 'string' && <div><dt>Region</dt><dd>{REGIONS.find(region => region.id === values.regionId)?.name || 'A saved region'}</dd></div>}</dl>
    {'objectives' in record && <div><strong>Project steps</strong><ol>{record.objectives.map(objective => <li key={objective.id}>{objective.title} · {objective.completed ? 'Completed' : 'Pending'}{objective.required ? ' · Required' : ''}</li>)}</ol></div>}
    {'allocations' in record && <div><strong>Effort allocation</strong><ul>{record.allocations.map(allocation => <li key={allocation.skillId}>{data.skills.find(skill => skill.id === allocation.skillId)?.name || 'A saved skill'} · {allocation.percent}%<small>{allocation.affinities.map(affinity => `${affinity.attribute} ${affinity.percent}%`).join(' · ')}</small></li>)}</ul></div>}
    {'affinities' in record && <p>{record.affinities.map(affinity => `${affinity.attribute} ${affinity.percent}%`).join(' · ')}</p>}
    {'equipment' in record && <div><strong>Wardrobe</strong><ul>{Object.entries(record.equipment).map(([slot, id]) => <li key={slot}>{slot} · {COSMETICS.find(item => item.id === id)?.name || 'Starter appearance'}</li>)}</ul></div>}
    {'audio' in record && record.audio && <p>Music {record.audio.musicEnabled ? 'on' : 'off'} · Ambience {record.audio.ambienceEnabled ? 'on' : 'off'} · Interface sounds {record.audio.interfaceEnabled ? 'on' : 'off'} · Milestone sounds {record.audio.milestonesEnabled ? 'on' : 'off'}</p>}
    <details><summary>Recovery details</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
  </div>;
}

function DeleteCloudAccount({ accountId, close, removed }: { accountId: string; close: () => void; removed: () => void }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(''), [localOnly, setLocalOnly] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (busy || confirmation !== 'DELETE') return; setBusy(true); setError(''); pauseCloudSync(accountId, true); try { if (localOnly) await finishLocalAccountRemoval(accountId); else await deleteCloudAccount(accountId, password, setProgress); removed(); } catch (error) { if (error instanceof LocalAccountCleanupError) setLocalOnly(true); setError(friendlyCloudError(error)); } finally { setBusy(false); setPassword(''); } }
  return <Dialog title="Remove your account and world?" eyebrow="PERMANENT ACCOUNT REMOVAL" onClose={() => { if (!busy) close(); }}><form className="form-stack" onSubmit={submit}><p>This removes your private cloud records and sign-in, then the saved copy on this device. External backup files and saved copies on other devices remain yours to remove separately.</p><p className="small muted">If cleanup is interrupted, sign in here again to finish it. A small frozen removal marker remains to prevent old devices from uploading former records.</p><Button type="button" variant="secondary" disabled={busy} onClick={() => { void downloadBackup(accountId).catch(error => setError(friendlyCloudError(error))); }}>Export a backup first<Download size={16}/></Button><Field label="Confirm your password"><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required={!localOnly} maxLength={4096} disabled={busy || localOnly}/></Field><Field label="Type DELETE to confirm"><input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" required pattern="DELETE" disabled={busy}/></Field>{error && <p className="form-error" role="alert">{error}</p>}{progress && <p role="status">{progress}</p>}<Button type="submit" variant="danger" disabled={busy || confirmation !== 'DELETE' || (!localOnly && !password)}>{busy ? 'Removing account…' : localOnly ? 'Retry device cleanup' : 'Permanently remove account'}</Button></form></Dialog>;
}
