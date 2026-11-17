import type { GameData } from '../types';
import { projectGame } from '../domain';
import { experienceFor } from '../experience/preferences';
import { expeditionFor } from '../experience/model';
import { skillGuide } from '../experience/skill-content';

export interface OliveAdvice {
  state: 'practice' | 'deliver' | 'paused' | 'unavailable' | 'choose';
  title: string; explanation: string; action?: string; finish?: string;
  tip?: string; milestone?: string; projectId?: string; skillId?: string; questId?: string;
}
/** Suggestions are presentation only: never evidence, commands or inferred effort. */
export function oliveAdvice(data: GameData, projectId?: string, minutes = 15): OliveAdvice {
  const budget = [5, 15, 30, 60].includes(minutes) ? minutes : 15;
  const wanted = projectId || experienceFor(data.profile).pinnedProjectId;
  const project = wanted ? data.projects.find(p => p.id === wanted && !p.deleted) : data.projects.find(p => !p.deleted && !p.archived && p.status === 'active');
  if (!project) return { state: 'choose', title: 'A small beginning is enough.', explanation: 'Choose a project, or open Skills to find a practice you would like to explore.' };
  const context = { projectId: project.id, skillId: project.skillId };
  if (project.archived || project.status === 'completed') return { ...context, state: 'unavailable', title: project.status === 'completed' ? 'Something finished. Room for what’s next.' : 'This project is resting in the archive.', explanation: 'Review this project or choose another one. Its saved work stays with you.' };
  if (project.status !== 'active') return { ...context, state: 'paused', title: 'Set a pace before you begin.', explanation: 'Open the project to activate or resume it when you are ready. No effort is lost while you wait.' };
  const skill = data.skills.find(s => s.id === project.skillId && !s.deleted && !s.archived);
  if (!skill) return { ...context, state: 'unavailable', title: 'This path needs its skill again.', explanation: 'Restore the project’s skill or choose another skill in Edit project before starting a new session.' };
  const route = expeditionFor(data, project);
  if (route.canComplete) return { ...context, state: 'deliver', title: 'Is your finished result ready?', explanation: 'The preparation and effort requirements are met. Review the actual result before confirming it.', finish: project.outputCriterion };
  const quest = route.nextQuest;
  const guide = skillGuide(skill.id);
  const projection = projectGame(data);
  const progress = projection.skills[skill.id];
  const next = guide?.milestones.find((_, i) => i >= (progress?.milestone || 0));
  const target = quest?.title || project.objectives.find(o => !o.completed)?.title || project.title;
  const action = `${budget} minutes: work on one small part of “${target}”.`.slice(0, 200);
  return { ...context, state: 'practice', questId: quest?.id,
    title: 'Make one part easier to begin.',
    explanation: quest ? `This follows your next action in ${project.title}. The time is a plan, not recorded effort.` : `This supports ${project.title}. The time is a plan, not recorded effort.`,
    action, finish: `Keep a short note of what changed and where you will begin next. Your project’s final result remains: ${project.outputCriterion}`,
    tip: guide?.tip, milestone: next ? `${next.title}: ${next.output}` : undefined };
}
