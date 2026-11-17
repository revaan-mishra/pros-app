import { seedGame } from '../domain';
import { experienceFor } from './preferences';

/** Only used when initially creating the explicitly isolated sample namespace. */
export function seedExperienceDemo() {
  const data = seedGame('demo');
  const project = data.projects.find(p => p.id === 'project-guitar')!;
  project.status = 'active'; delete project.completedAt;
  project.effortTargetSeconds = 180 * 60;
  project.objectives[2].completed = false;
  const output = data.outputs.find(o => o.id === 'output-recording')!;
  delete output.projectId; output.title = 'A first twelve-bar study';
  output.description = 'Sample evidence: a short study kept before the current recording project. This sample never contributes to a real profile.';
  data.profile.lastSkillId = project.skillId;
  data.profile.experience = { ...experienceFor(data.profile), pinnedProjectId: project.id, keepsakeSlots: ['output-recording', 'output-book', null, null, null, null] };
  return data;
}
