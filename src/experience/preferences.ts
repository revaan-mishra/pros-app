import { z } from '../validation';
import type { ExperiencePreferences, Profile } from '../types';

const id = z.string().min(1).max(160).regex(/^[A-Za-z0-9_.:@-]+$/);
export const experienceSchema = z.object({
  version: z.literal(1), pinnedProjectId: id.optional(),
  dismissedProjectIds: z.array(id).max(100),
  keepsakeSlots: z.array(id.nullable()).length(6),
  focusMode: z.enum(['immersive', 'minimal', 'practice']),
  focusMinutes: z.number().int().min(1).max(180),
}).strict().refine(p => new Set(p.keepsakeSlots.filter(Boolean)).size === p.keepsakeSlots.filter(Boolean).length,
  'A keepsake can occupy one display slot');

export function experienceFor(profile: Profile): ExperiencePreferences {
  return profile.experience || { version: 1, dismissedProjectIds: [], keepsakeSlots: [null, null, null, null, null, null], focusMode: 'immersive', focusMinutes: 25 };
}
