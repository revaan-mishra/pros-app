import { useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import { Button, Field, formatNumber } from '../components/ui';
import type { Project, Skill } from '../types';
import { parseCapture, type CaptureProposal } from './capture-parser';
import './smart-capture.css';

export function SmartCapture({ text, onText, skills, projects, timeZone, linkedProjectId, linkedSkillId, onApply, openLibrary }: {
  text: string; onText: (text: string) => void; skills: Skill[]; projects: Project[]; timeZone: string;
  linkedProjectId?: string; linkedSkillId?: string; onApply: (proposal: CaptureProposal) => void; openLibrary: () => void;
}) {
  const [review, setReview] = useState<CaptureProposal | null>(null);
  const [applied, setApplied] = useState(false);
  const current = review?.source === text ? review : null;
  const linkedChange = !!(current?.projectId && linkedProjectId && current.projectId !== linkedProjectId);
  const skillChange = !!(current?.allocations.length && linkedSkillId && !current.allocations.some(allocation => allocation.skillId === linkedSkillId));
  return <details className="form-details smart-capture"><summary>Describe it in one line</summary><div className="form-stack">
    <p className="small muted">Works offline. Your words stay on this device while the suggested fields are prepared.</p>
    <Field label="Activity sentence" hint="For example: guitar 25m yesterday, or frontend + German 30m 70/30."><textarea maxLength={1000} rows={2} value={text} onChange={event => { onText(event.target.value); setReview(null); setApplied(false); }} placeholder="What did you practice, and for how long?"/></Field>
    <Button type="button" variant="secondary" disabled={!text.trim()} onClick={() => { setReview(parseCapture(text, { skills, projects, timeZone })); setApplied(false); }}>Review sentence<ArrowDown size={16}/></Button>
    {current && <div className="capture-proposal" aria-live="polite">
      <strong>{current.ready ? 'Suggested fields' : 'A little more detail is needed'}</strong>
      {current.skillCandidates.length > 0 && <p>{current.skillCandidates.map(candidate => `${candidate.name}${candidate.match === 'suggested' ? ' (similar name)' : ''}`).join(' · ')}</p>}
      {current.allocations.length > 1 && <p>{current.allocations.map(allocation => `${skills.find(skill => skill.id === allocation.skillId)?.name}: ${allocation.percent}%`).join(' · ')}</p>}
      {current.seconds !== undefined && <p>{formatNumber(current.seconds / 60)} minutes{current.localDate ? ` · ${current.localDate}` : ''}</p>}
      {current.projectId && <p>Project: {projects.find(project => project.id === current.projectId)?.title}</p>}
      {current.issues.length > 0 && <ul>{current.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {current.notices.map(notice => <p className="small muted" key={notice}>{notice}</p>)}
      {current.pages !== undefined && <Button type="button" variant="ghost" onClick={openLibrary}>Open Library for page progress</Button>}
      {linkedChange && <p className="form-warning">This sentence names another project. Keep the linked project and edit it deliberately in the fields below.</p>}
      {skillChange && <p className="form-warning">This action belongs to a different skill. Keep its context, or change the skill deliberately in the fields below.</p>}
      {current.ready && !linkedChange && !skillChange && <Button type="button" variant="secondary" onClick={() => { onApply(current); setApplied(true); }}>{applied ? 'Fill fields again' : 'Fill reviewed fields'}<Check size={16}/></Button>}
      {applied && <p className="small" role="status">Fields filled. Nothing has been recorded yet; review the form and its XP preview below.</p>}
    </div>}
  </div></details>;
}
