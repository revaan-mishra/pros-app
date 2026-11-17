import { COSMETICS } from '../catalog';
import type { Cosmetic, Profile } from '../types';

/** A render-only copy. Its temporary eligible list must never be used by save commands. */
export function previewAppearance(profile: Profile, eligible: readonly string[], cosmeticId?: string) {
  const item = COSMETICS.find(c => c.id === cosmeticId);
  return {
    profile: { ...profile, equipment: { ...profile.equipment, ...(item ? { [item.slot]: item.id } : {}) } },
    renderEligible: item ? [...new Set([...eligible, item.id])] : [...eligible],
    item,
  };
}

/** The save path checks canonical eligibility again; previews confer no permission. */
export function equipCosmetic(profile: Profile, eligible: readonly string[], cosmeticId: string): Profile {
  const item = COSMETICS.find(c => c.id === cosmeticId);
  if (!item || !eligible.includes(item.id)) throw new Error('This piece is not currently unlocked. Review its regional requirements.');
  return { ...profile, equipment: { ...profile.equipment, [item.slot]: profile.equipment[item.slot] === item.id ? '' : item.id } };
}
export function cosmeticRequirement(item: Cosmetic) {
  const minutes = [0, 60, 240, 720][item.stage];
  return { minutes, outputs: item.stage, completedProject: item.stage === 3 };
}
export function starterAppearance(profile: Profile): Profile {
  return { ...profile, equipment: { emblem: '', accessory: '', outfit: '' } };
}

/** Never round an unmet effort gate up to its displayed target. */
export function wardrobeEffortMinutes(seconds: number): string {
  const hundredths = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) / 60 * 100 + 1e-9);
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(hundredths / 100);
}
export function pickerColor(color: string): string {
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return color.slice(0,7);
  if (/^#[0-9a-f]{3,4}$/i.test(color)) return '#' + color.slice(1,4).split('').map(c=>c+c).join('');
  return '#669d86';
}
