import { useGame } from '../app-context';
import { COSMETICS, REGIONS } from '../catalog';
import { formatNumber } from '../components/ui';
import { changeImpact } from './record-commands';
import type { Mutation } from '../types';

export function ImpactPreview({ mutations }: { mutations: Mutation[] }) {
  const { data } = useGame(); const impact = changeImpact(data, mutations);
  return <section className="record-impact" aria-label="Progression impact preview"><h3>What this changes</h3>
    <dl><div><dt>Character XP</dt><dd>{formatNumber(impact.before.xp)} → {formatNumber(impact.after.xp)}</dd></div><div><dt>Eligible outputs</dt><dd>{impact.before.totalOutputs} → {impact.after.totalOutputs}</dd></div></dl>
    {REGIONS.filter(r => impact.before.regions[r.id].stage !== impact.after.regions[r.id].stage || impact.before.regions[r.id].outcomes !== impact.after.regions[r.id].outcomes).map(r => <p key={r.id}>{r.shortName}: stage {impact.before.regions[r.id].stage} → {impact.after.regions[r.id].stage}; outputs {impact.before.regions[r.id].outcomes} → {impact.after.regions[r.id].outcomes}.</p>)}
    {!!impact.lostCosmetics.length && <p>Unavailable cosmetics: {impact.lostCosmetics.map(id => COSMETICS.find(c => c.id === id)?.name || id).join(', ')}. Equipped pieces return to their starter appearance.</p>}
    {!!impact.changedSlots.length && <p>Home display {impact.changedSlots.length === 1 ? 'slot' : 'slots'} {impact.changedSlots.join(', ')} will become empty until its evidence qualifies again.</p>}
    {mutations.some(m => m.kind === 'projects' && (m.entity as { status: string }).status === 'active') && <p>The linked project reopens.</p>}
    {mutations.some(m => m.kind === 'books' && (m.entity as { status: string }).status === 'reading') && <p>The linked book returns to Reading.</p>}
    <p className="small muted">Effort remains in activity history. Undo is available after saving.</p>
  </section>;
}
