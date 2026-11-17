import { creditedActivities, projectGame, validOutputs } from '../domain';
import { expeditionFor } from './model';
import { experienceFor } from './preferences';
import type { GameData, Projection, Project, Quest, RegionId, RegionProgress, Skill } from '../types';

export interface RegionStage {
  title: string;
  detail: string;
  changes: string[];
  chapterTitle: string;
  chapter: string[];
}
export interface RegionExperience {
  regionId: RegionId;
  placeName: string;
  focusName: string;
  asset: string;
  focalPoint: string;
  caretaker: { name: string; role: string; description: string };
  stages: [RegionStage, RegionStage, RegionStage, RegionStage];
  mystery: string;
}
const chapter = (title: string, detail: string, changes: string[], chapterTitle: string, first: string, second: string): RegionStage => ({ title, detail, changes, chapterTitle, chapter: [first, second] });

/** Authored presentation only. These scenes never supply progression evidence. */
export const REGION_EXPERIENCES: Record<RegionId, RegionExperience> = {
  observatory: {
    regionId: 'observatory', placeName: 'The Sky Room', focusName: 'Observatory desk', asset: '/art/observatory.webp', focalPoint: '50% 44%',
    caretaker: { name: 'Ilan', role: 'The cartographer', description: 'An ink-stained cartographer with a brass lens and a map that is never quite finished.' },
    mystery: 'The observatory has a place for an atlas, but Ilan has left its center blank. What belongs at its center?',
    stages: [
      chapter('The empty plinth', 'A central plinth waits for its telescope. The chart alcove and shelves are empty.', ['Empty telescope plinth', 'Blank chart alcove', 'Unfilled reading shelves'], 'An unfinished coordinate', 'Ilan rests a hand on the empty plinth. The first instrument will stand here; the chart alcove and shelves have been left clear for a question worth following.', 'No instrument will answer in your place. Choose a language, a text, or a question, then keep something that shows what you understood.'),
      chapter('The aligned telescope', 'A brass telescope stands aligned on the central plinth. The chart alcove waits for the next restoration.', ['Brass telescope installed', 'Tripod mounted on the plinth', 'Chart alcove still empty'], 'A point that can be named', 'A telescope now stands on the plinth. Ilan aligns its lens toward the valley sky. The first kept result gives this work a point that can be named.', 'The first kept result belongs beside the instrument. It might be an exchange, an explained idea, or a finished text; the record matters more than the scale.'),
      chapter('The chart room', 'A chart fills the left alcove and books line the reading shelves beside the telescope.', ['Chart placed in the alcove', 'Reading books shelved', 'Aligned telescope retained'], 'The space between points', 'The chart alcove is filled and the reading shelves hold books. Ilan traces a route between separate observations, leaving room for another route beside it.', 'The atlas is still missing its central plate. Two finished results have made a pattern, but it needs sustained work and a completed project to become a whole.'),
      chapter('The living sky atlas', 'A constellation plate completes the space above the telescope. The charts and reading shelves remain open.', ['Constellation plate installed', 'Chart alcove retained', 'Complete sky atlas displayed'], 'The place you return from', 'Ilan fits the constellation plate above the telescope. Its center marks the place an observer returns to, rather than a claim that the sky is complete.', 'The first atlas is finished. Its charts point to your kept work. New languages, questions and projects can add their own pages without closing these ones.'),
    ],
  },
  foundry: {
    regionId: 'foundry', placeName: 'The Copper Workshop', focusName: 'Foundry workbench', asset: '/art/foundry.webp', focalPoint: '52% 46%',
    caretaker: { name: 'Nara', role: 'The mechanic', description: 'A practical mechanic in a leather apron, carrying a small caliper instead of a ceremonial weapon.' },
    mystery: 'The empty circular frame has room for a mechanism. Nara has set aside one small cog whose place is still unknown.',
    stages: [
      chapter('The cold workshop', 'The open hearth is cold. A bare workbench faces an empty circular frame.', ['Cold open hearth', 'Bare workbench', 'Empty central wheel frame'], 'The spare part', 'Nara surveys the empty circular frame from the bare workbench. A mechanism belongs here, but its workings will have to be understood before they can be assembled.', 'The workbench can hold a small experiment before it holds a grand design. Begin with something that can be built, repaired, or explained well enough to test.'),
      chapter('The working hearth', 'A contained flame relights the hearth. The bench is ready for its first set of instruments.', ['Hearth relit', 'Working fire contained', 'Bare bench ready for tools'], 'A thing that works', 'A small flame settles into the hearth. Nara can point to a first kept result even while the bench waits for its full set of instruments.', 'The cog still has no home, but the room has a use again. Something works because it was made and examined, not because every part of the plan was known in advance.'),
      chapter('The working bench', 'Diagrams and instruments occupy the bench. The circular frame still waits for its wheel.', ['Bench diagrams laid out', 'Instruments installed', 'Central frame prepared for its wheel'], 'The missing connection', 'Diagrams and instruments give the workbench its shape. Nara compares the workings and finds the place for the small cog: a connection in the planned assembly.', 'The bench is ready; the central mechanism is not. A finished project will give the workshop a reason to connect its pieces.'),
      chapter('The central mechanism', 'A complete wheel fills the circular frame above the working bench and hearth.', ['Central wheel installed', 'Wheel spokes and hub completed', 'Working bench and hearth retained'], 'Connected at last', 'The central wheel fills its frame. Nara checks the hub and its connections; separate experiments have become a complete assembly.', 'Its purpose is ordinary and useful: to keep the workshop working. The completed project remains beside its diagrams. There is space on the other benches for whatever you decide to build next.'),
    ],
  },
  atelier: {
    regionId: 'atelier', placeName: 'The Riverside Atelier', focusName: 'Atelier practice room', asset: '/art/atelier.webp', focalPoint: '50% 50%',
    caretaker: { name: 'Marin', role: 'The conservator', description: 'A conservator in a slate work coat, keeping a place for the imperfect study beside the finished piece.' },
    mystery: 'Marin has reserved a place in the empty alcove for a work that does not exist yet.',
    stages: [
      chapter('The waiting room', 'An empty wall, a closed terrace. There is room for your first work.', ['Closed terrace gate', 'Empty exhibition alcove', 'Unoccupied practice desk'], 'A place without a picture', 'The terrace gate is closed. Marin looks from the bare alcove to the work table. “Choose something small enough to finish,” the conservator says.', 'A place in the alcove is being kept for later. There is no exhibition to arrange yet; the first job is a piece of work that can return to this room.'),
      chapter('The practice room', 'A working light and a place to practice. Your first finished work belongs here.', ['Working light strengthened', 'Practice desk available', 'Exhibition alcove still waiting'], 'A place to begin again', 'The practice room has its first kept work. Marin makes space beside the instrument, leaving the rest of the desk clear.', 'A session has a place to start, and a result has a place to stay. The reserved alcove and the terrace are still waiting.'),
      chapter('The exhibition wall', 'Finished work fills the alcove. The terrace is the next part of this place to restore.', ['Two exhibition frames filled', 'Alcove lights uncovered', 'Terrace route prepared'], 'Studies beside finished work', 'Two frames occupy the alcove. They hold different finished results, with the records of their making close at hand. Marin keeps a space beside them for revisions.', 'The exhibition has begun. Opening the terrace will take sustained practice and a completed project. The place Marin reserved is almost ready.'),
      chapter('The open terrace', 'The gate is gone, the windows are open, and your work has a place in the light.', ['Terrace gate removed', 'Windows opened', 'Finished project given an exhibition place'], 'The room beyond the gate', 'The gate has been lifted away. Daylight reaches the open windows and the first row of the terrace. Marin puts the finished project beside the earlier studies.', 'The empty alcove was a promise of space, not a demand for a perfect piece. The room has changed through work you can point to. Its next exhibition is yours to choose.'),
    ],
  },
  training: {
    regionId: 'training', placeName: 'The Long Circuit', focusName: 'Training pavilion', asset: '/art/training.webp', focalPoint: '51% 46%',
    caretaker: { name: 'Edda', role: 'The sentinel', description: 'A steady sentinel with a woven wrist guard and a walking staff worn smooth by use.' },
    mystery: 'Edda has kept the last route marker aside. Unlike the others, its arrow will point toward the start.',
    stages: [
      chapter('The overgrown route', 'Grass grows along the route edges. The timber pavilion overlooks an empty practice court.', ['Grown-in path edges', 'Open timber pavilion', 'Empty circular practice court'], 'The inward marker', 'Edda looks across the empty court toward the open pavilion. One route marker has been kept aside; its arrow will point back to the start.', 'No speed is written on the stones. Choose a repeatable practice at a scale that fits you. The grounds make room for movement and for recovery.'),
      chapter('The clear path', 'Standing markers make a route toward the pavilion. The grown-in edges are cleared back.', ['Route markers raised', 'Path edges cleared', 'Pavilion approach marked'], 'The first measured route', 'Standing markers now make a route across the grounds. Edda leaves the way wide enough to turn around; the place for a sheltered bench comes next.', 'The kept result records a practice or technique you can name. It need not be a personal record; it needs to be something real enough to revisit.'),
      chapter('The equipped pavilion', 'A bench and equipment rack fill the open pavilion. A practice boundary marks the court.', ['Sheltered bench installed', 'Equipment rack restored', 'Practice boundary marked'], 'Shelter along the route', 'The open pavilion now has a bench and equipment rack. A marked boundary gives practice a clear place. Edda keeps the final route marker aside a little longer.', 'The circuit is still incomplete. A project can give repeated practice a finish without making every future session a test.'),
      chapter('The complete circuit', 'Circuit banners rise above the court. The return route connects open ground and the equipped pavilion.', ['Circuit banners raised', 'Return route completed', 'Practice court and pavilion connected'], 'A route with a return', 'The circuit banners rise above the court. Edda completes the return route; the path was always meant to lead back to shelter, with room to recover.', 'The completed project has its marker here. The path remains available after a day away or a long absence. Nothing in these grounds measures how often you return.'),
    ],
  },
  citadel: {
    regionId: 'citadel', placeName: 'The Exchange Hall', focusName: 'Citadel study', asset: '/art/citadel.webp', focalPoint: '50% 45%',
    caretaker: { name: 'Tavi', role: 'The envoy', description: 'An envoy in a practical ochre coat, carrying correspondence with room for corrections in the margins.' },
    mystery: 'Tavi leaves one side of the council table clear, facing the doorway. Why keep that place open?',
    stages: [
      chapter('The closed exchange', 'The gate is closed. A bare stone council table waits inside the hall.', ['Closed entry gates', 'Bare stone council table', 'Unfilled exchange walls'], 'The place by the doorway', 'Tavi keeps one side of the bare table clear, facing the doorway rather than the head of the hall. The empty place seems deliberate.', 'The hall has no decision to make yet. Choose a conversation, a strategy, or a considered choice with an outcome you can describe.'),
      chapter('The open gates', 'The gates open onto the hall. The stone table waits for maps and correspondence.', ['Entry gates opened', 'Council approach cleared', 'Bare table ready for records'], 'A decision made clear', 'The gates open onto the bare table. Tavi can point to a first kept decision or exchange, while the hall waits for its working records.', 'A finished result gives the hall its first purpose. Its meaning is in the record: what was said, decided, compared, or understood.'),
      chapter('The council room', 'A map and correspondence cover the working table. The exchange walls still wait for their displays.', ['Council map laid out', 'Correspondence placed on the table', 'Exchange walls prepared'], 'Room for another view', 'A map and correspondence occupy the stone table. Tavi arranges the records so someone approaching from the doorway can read them before joining the discussion.', 'The place facing the doorway is still open. A completed project will give the exchange its full purpose; there is no advantage in pretending the work is finished.'),
      chapter('The inhabited exchange', 'Exchange boards and a banner complete the hall. The table remains set with maps and correspondence.', ['Exchange boards installed', 'Hall banner raised', 'Working council table retained'], 'The right to revise', 'The exchange boards fill their places and a banner marks the open hall. Tavi leaves the side of the table facing the doorway clear, even now.', 'That place is for the next person to improve the decision. The first project is complete; the exchange remains useful because its conclusions can be revisited.'),
    ],
  },
  sanctuary: {
    regionId: 'sanctuary', placeName: 'The Stillwater Garden', focusName: 'Sanctuary garden', asset: '/art/sanctuary-base.webp', focalPoint: '50% 48%',
    caretaker: { name: 'Sela', role: 'The gardener', description: 'A gardener with a folded linen shawl, a shallow seed tray and no bell calling anyone to practice.' },
    mystery: 'A dry basin rests beside the stone pavilion. Sela is planting around it while leaving its center clear.',
    stages: [
      chapter('The quiet pavilion', 'A stone pavilion stands beside a dry basin. The garden beds are still sparse.', ['Open stone pavilion', 'Dry foreground basin', 'Unplanted garden edges'], 'The space left clear', 'Sela looks over the dry basin beside the stone pavilion. The surrounding beds can be planted; its center has been left clear.', 'There is room to pause before any milestone. Reflection, attention and a useful written result can change this place without making stillness another task to perfect.'),
      chapter('The quiet seat', 'A wooden reflection bench gives the pavilion a place to sit. The basin remains dry.', ['Wooden reflection bench installed', 'Notebook placed at the seat', 'Dry basin preserved'], 'Something worth keeping', 'A wooden bench gives the pavilion a recognizable place to return. A notebook rests at the seat, ready for a reflection worth keeping.', 'The basin remains empty. There is room for an unsettled thought beside a useful one; only the result you choose to keep becomes evidence.'),
      chapter('The returning garden', 'Plants fill the edges around the pavilion and basin. The reflection bench keeps its quiet place.', ['Garden beds planted', 'Basin edges surrounded by foliage', 'Reflection bench retained'], 'A space left open', 'The garden beds hold new planting. Sela has worked around the basin, leaving its center clear. The bench remains a quiet place beside the new foliage.', 'The space was never forgotten. A sustained project can complete the water garden, but the garden does not ask you to manufacture a calm mood to qualify.'),
      chapter('The water garden', 'Water and mature planting surround the pavilion. The garden keeps room for another beginning.', ['Water garden opened', 'Mature planting restored', 'Pavilion surrounded by the finished garden'], 'What the gap was for', 'Sela opens the inlet. Water fills the place kept clear beside the pavilion, while mature planting surrounds the garden. The empty space was room for this change.', 'The completed project belongs beside the earlier reflections. The garden remains open to practice, writing, and work you have not chosen yet. There is nothing here to maintain by attendance.'),
    ],
  },
};

export interface NextRegionRequirement {
  stage: number; minutes: number; outcomes: number; requiresProject: boolean;
  remainingMinutes: number; remainingOutcomes: number; remainingProjects: number;
}
/** Targets are cumulative and match the deterministic progression engine. */
export function regionRequirement(stage: number, progress?: Pick<RegionProgress, 'minutes' | 'outcomes' | 'completedProjects'>): NextRegionRequirement | null {
  const current = Math.min(3, Math.max(0, Number.isFinite(stage) ? Math.floor(stage) : 0));
  if (current === 3) return null;
  const next = current + 1, minutes = [0, 60, 240, 720][next];
  return { stage: next, minutes, outcomes: next, requiresProject: next === 3,
    remainingMinutes: Math.max(0, minutes - (progress?.minutes || 0)),
    remainingOutcomes: Math.max(0, next - (progress?.outcomes || 0)),
    remainingProjects: next === 3 && !(progress?.completedProjects) ? 1 : 0 };
}

export interface RegionAction {
  kind: 'project' | 'practice' | 'create-skill'; label: string; detail: string; href?: string;
  project?: Project; quest?: Quest; skill?: Skill;
}
export interface EvidenceAction { kind: 'evidence'; label: string; detail: string; href: string }
/** An explanation of one useful route; never creates work or starts a timer. */
export function regionAction(data: GameData, regionId: RegionId): RegionAction {
  const skills = data.skills.filter(s => !s.deleted && !s.archived && s.regionId === regionId);
  const pinned = experienceFor(data.profile).pinnedProjectId;
  const projects = data.projects.filter(p => !p.deleted && !p.archived && p.regionId === regionId && ['active', 'paused'].includes(p.status) && skills.some(s => s.id === p.skillId));
  const project = projects.find(p => p.id === pinned) || projects.filter(p => p.status === 'active').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0];
  if (project) {
    const route = expeditionFor(data, project);
    const quest = route.nextQuest?.projectId === project.id && route.nextQuest.skillId === project.skillId ? route.nextQuest : undefined;
    return { kind: 'project', project, quest, skill: skills.find(s => s.id === project.skillId), href: `/projects/${encodeURIComponent(project.id)}`,
      label: project.status === 'paused' ? 'Review paused project' : route.canComplete ? 'Review finished output' : 'Continue project',
      detail: project.status === 'paused' ? `${project.title} is paused. Resume only when it fits.` : `${project.title} · ${route.nextLabel}` };
  }
  const skill = skills.find(s => s.id === data.profile.lastSkillId) || skills.find(s => s.equipped) || skills.sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
  return skill ? { kind: 'practice', skill, label: 'Start regional focus', detail: `Practice ${skill.name}. Only confirmed time earns effort.`, href: `/focus?skill=${encodeURIComponent(skill.id)}` }
    : { kind: 'create-skill', label: 'Create a regional skill', detail: 'Choose this region when creating a custom skill. Existing history stays preserved.' };
}

export type ResidentState = 'changed-evidence' | 'paused-project' | 'delivery-ready' | 'active-project' | 'flourishing' | 'returning' | 'kept-output' | 'first-arrival' | 'practice';
export interface ResidentResponse { state: ResidentState; heading: string; text: string; action: RegionAction | EvidenceAction }
/** Authored facts from current records; a supplied clock is optional, never a source of rewards. */
export function residentResponse(data: GameData, regionId: RegionId, options: { projection?: Projection; now?: number } = {}): ResidentResponse {
  const projection = options.projection || projectGame(data), p = projection.regions[regionId];
  const action = regionAction(data, regionId), content = REGION_EXPERIENCES[regionId];
  const valid = validOutputs(data), eligible = new Set(valid.map(o => o.id));
  const changed = data.outputs.filter(o => !o.deleted && o.regionId === regionId && !eligible.has(o.id)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0];
  if (changed) return { state: 'changed-evidence', heading: 'A record needs another look', text: `“${changed.title}” is preserved, but no longer meets its source requirements. Review the evidence before counting it toward this place.`, action: { kind: 'evidence', label: 'Review changed evidence', detail: 'Inspect the output and its source requirements.', href: `/outputs?output=${encodeURIComponent(changed.id)}` } };
  if (action.project?.status === 'paused') return { state: 'paused-project', heading: 'The work can wait', text: `“${action.project.title}” is paused. This place keeps its earned progress. You can review its scope before deciding to resume.`, action };
  if (action.project) return expeditionFor(data, action.project).canComplete
    ? { state: 'delivery-ready', heading: 'Give the result its place', text: `Preparation and relevant effort are ready for “${action.project.title}”. Confirm only when its finished result exists.`, action }
    : { state: 'active-project', heading: 'One piece of the work', text: `“${action.project.title}” has a next step: ${expeditionFor(data, action.project).nextLabel}. Its own requirements decide when it is finished.`, action };
  if (p.stage === 3) return { state: 'flourishing', heading: 'A finished place, with room left', text: `${content.placeName} has all three restorations. New practice and projects remain useful here; the campaign never resets your records.`, action };
  const recent = creditedActivities(data).filter(c => c.allocations.some(a => a.regionId === regionId)).sort((a,b) => b.activity.occurredAt.localeCompare(a.activity.occurredAt))[0];
  if (options.now !== undefined && Number.isFinite(options.now) && recent && options.now - Date.parse(recent.activity.occurredAt) >= 30 * 86400000) return { state: 'returning', heading: 'Your place is still here', text: 'Your regional practice and kept results are preserved. Choose one manageable action when you are ready; time away creates no debt.', action };
  const kept = valid.filter(o => o.regionId === regionId).sort((a,b) => b.confirmedAt.localeCompare(a.confirmedAt) || a.id.localeCompare(b.id))[0];
  if (kept) return { state: 'kept-output', heading: 'Something real belongs here', text: `“${kept.title}” is kept in this region. More relevant practice and distinct results can restore its next landmark.`, action };
  return p.seconds === 0 ? { state: 'first-arrival', heading: 'A place for a first attempt', text: content.stages[0].detail + ' Start with a manageable practice; keep an output when something is genuinely finished.', action }
    : { state: 'practice', heading: 'Practice has a place', text: 'Your relevant effort is recorded. A finished output is a separate result you confirm; a checked task alone does not create one.', action };
}
