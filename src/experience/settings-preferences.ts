import type { Profile } from '../types';

export const SETTINGS_FIELDS = ['displayName','avatarStyle','avatarColor','theme','motion','sound','timeZone'] as const;
export type SettingsField = typeof SETTINGS_FIELDS[number];
export const SETTINGS_LABELS:Record<SettingsField,string> = {displayName:'Display name',avatarStyle:'Avatar style',avatarColor:'Character accent',theme:'Appearance',motion:'Motion',sound:'Quiet sounds',timeZone:'Time zone'};
export function settingsChangedFields(base:Profile,edited:Profile):SettingsField[]{
  return SETTINGS_FIELDS.filter(field=>edited[field]!==base[field]);
}
/** Merge independent preference fields; the store still checks current.revision atomically. */
export function mergeSettingsPreferences(base:Profile,edited:Profile,current:Profile){
  if(base.id!==current.id||edited.id!==current.id)throw new Error('These preferences belong to a different profile. Reload the saved preferences.');
  const changedFields=settingsChangedFields(base,edited);
  const conflicts=changedFields.filter(field=>current[field]!==base[field]&&current[field]!==edited[field]);
  const changes=Object.fromEntries(changedFields.map(field=>[field,edited[field]]));
  return {profile:{...current,...changes} as Profile,changedFields,conflicts};
}
