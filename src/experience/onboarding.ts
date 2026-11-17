import { z } from 'zod';
import { SKILLS } from '../catalog';
const starterIds=new Set(SKILLS.map(s=>s.id));
export const onboardingSchema=z.object({name:z.string().max(80),selected:z.array(z.string().refine(id=>starterIds.has(id),'Choose an available starter skill.')).max(3).refine(ids=>new Set(ids).size===ids.length),step:z.number().int().min(0).max(2),goal:z.string().max(200)}).strict();
export function startingSkillOptions(selected:string[],search:string,browse:boolean){
  const chosen=SKILLS.filter(s=>selected.includes(s.id));
  const matching=SKILLS.filter(s=>!selected.includes(s.id)&&(search?s.name.toLowerCase().includes(search.toLowerCase()):browse||['observatory','atelier','training'].includes(s.regionId)));
  return [...chosen,...matching].slice(0,search||browse?SKILLS.length:9);
}
