import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContextualHint } from '../components/ContextualHint';
import { useGame } from '../app-context';
import { REGIONS } from '../catalog';
import { Button, Dialog, Empty } from '../components/ui';
import { keepsakesFor } from './model';
import { experienceFor } from './preferences';
import { KeepsakeGlyph } from './Scenes';

export function KeepsakeCollection({ close, initialId, initialSlot = 0 }: { close: () => void; initialId?: string; initialSlot?: number }) {
  const { accountId, data, save, busy, setModal } = useGame();
  const all = keepsakesFor(data); const prefs = experienceFor(data.profile);
  const [selectedId, setSelectedId] = useState(initialId);
  const [slot, setSlot] = useState(Math.min(5, Math.max(0, Math.floor(initialSlot))));
  const [error, setError] = useState('');
  const selected = all.find(k => k.id === selectedId);
  async function place(id: string | null) {
    const keepsakeSlots = prefs.keepsakeSlots.map((value, index) => index === slot ? id : value === id && id ? null : value);
    try { await save('profile', { ...data.profile, experience: { ...prefs, keepsakeSlots } }, id ? 'Keepsake placed at home' : 'Display slot cleared'); close(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The display could not be saved.'); }
  }
  return <Dialog title={selected ? selected.output.title : 'Work worth keeping'} eyebrow="MAKER’S MARKS" onClose={close} wide>
    <ContextualHint accountId={accountId} id="collection-v1">Choose a finished result, then a numbered place at home; its source record always stays linked.</ContextualHint>
    {selected ? <div className="keepsake-detail">
      <button className="text-link" onClick={() => setSelectedId(undefined)}><ArrowLeft size={16}/>All keepsakes</button>
      <div className="keepsake-object"><KeepsakeGlyph kind={selected.kind}/></div>
      <p className="eyebrow">{REGIONS.find(r => r.id === selected.regionId)?.shortName} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: data.profile.timeZone }).format(new Date(selected.output.confirmedAt))}</p>
      <p>{selected.output.description || 'A finished result, preserved in your own record.'}</p><p className="small muted">{selected.source}</p>
      <div className="display-slot-picker" role="group" aria-label="Home display slot">{prefs.keepsakeSlots.map((value, i) => <button key={i} className={slot === i ? 'selected' : ''} aria-pressed={slot === i} onClick={() => setSlot(i)}><span>{String(i + 1).padStart(2, '0')}</span>{value && all.some(k => k.id === value) ? 'Occupied' : 'Empty'}</button>)}</div>
      <Button disabled={busy} onClick={() => void place(selected.id)}><Check size={17}/>Display in slot {slot + 1}</Button>
      {prefs.keepsakeSlots[slot] && <Button variant="ghost" disabled={busy} onClick={() => void place(null)}>Clear display slot {slot + 1}</Button>}
      <Link className="evidence-link" to={selected.href} onClick={close}>View the source record<ArrowRight size={16}/></Link>
      <Button variant="ghost" onClick={() => { close(); setModal({ type: 'output', id: selected.id }); }}>Correct this output</Button>
      <p className="small muted">This keepsake follows its output. Correcting the evidence updates its availability without adding XP.</p>
    </div> : <>
      <p className="muted">Finished projects, books and other outputs become keepsakes. Choose one to give it a place at home.</p>
      <Link className="evidence-link" to="/outputs" onClick={close}>Review all output records<ArrowRight size={16}/></Link>
      {selectedId && !selected && <p className="form-warning">That keepsake’s evidence has changed. Currently eligible work is shown below.</p>}
      {all.length ? <div className="keepsake-grid">{all.map(k => <button key={k.id} className="keepsake-option" onClick={() => setSelectedId(k.id)}><KeepsakeGlyph kind={k.kind}/><strong>{k.output.title}</strong><small>{k.source}</small></button>)}</div> : <Empty icon={BookOpen} title="Your first finished work belongs here" action={<Button onClick={() => { close(); setModal({ type: 'output' }); }}><Plus size={16}/>Record an output</Button>}>Practice earns effort XP. A completed result becomes a keepsake when you confirm it.</Empty>}
      {prefs.keepsakeSlots[slot] && <Button variant="ghost" disabled={busy} onClick={() => void place(null)}>Clear display slot {slot + 1}</Button>}
    </>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </Dialog>;
}
