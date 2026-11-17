import type { Project, Skill } from '../types';

/** A suggestion only: the caller must review it and use the ordinary capture command. */
export interface CaptureProposal {
  source: string;
  normalized: string;
  intent: 'activity' | 'negated' | 'planned' | 'page-progress';
  seconds?: number;
  localDate?: string;
  allocations: { skillId: string; percent: number }[];
  skillCandidates: { skillId: string; name: string; match: 'exact' | 'alias' | 'suggested' }[];
  projectId?: string;
  projectCandidates: { projectId: string; title: string }[];
  pages?: number;
  issues: string[];
  notices: string[];
  /** Offsets refer to normalized text, because Unicode normalization can change its length. */
  tokens: { kind: 'duration' | 'date' | 'skill' | 'project' | 'pages' | 'split'; start: number; end: number; text: string }[];
  ready: boolean;
}
export interface CaptureContext {
  skills: readonly Skill[];
  projects?: readonly Project[];
  timeZone: string;
  now?: Date;
  /** Optional aliases are supplied by the caller, never inferred from another account. */
  aliases?: Readonly<Record<string, readonly string[]>>;
}
const aliases: Readonly<Record<string, readonly string[]>> = {
  'acoustic-guitar': ['guitar', 'acoustic'], frontend: ['front end', 'front-end', 'web development'],
  meditation: ['meditate', 'meditating'], 'creative-writing': ['writing'],
  'digital-illustration': ['illustration', 'drawing'], 'focus-endurance': ['deep work'],
  'music-production': ['producing music'], cardio: ['cardio'], mobility: ['mobility', 'stretching'],
};
const normalize = (value: string) => value.normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
const word = (char: string | undefined) => !!char && /[\p{L}\p{N}_]/u.test(char);
function occurrences(text: string, phrase: string): number[] {
  if (!phrase) return [];
  const found: number[] = [];
  let from = 0;
  while (from < text.length) {
    const at = text.indexOf(phrase, from);
    if (at < 0) break;
    if (!word(text[at - 1]) && !word(text[at + phrase.length])) found.push(at);
    from = at + Math.max(1, phrase.length);
  }
  return found;
}
function calendarDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value || '').join('-');
}
function validDay(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function priorDay(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let diagonal = previous[0]; previous[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const above = previous[j + 1];
      previous[j + 1] = Math.min(above + 1, previous[j] + 1, diagonal + (a[i] === b[j] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

/** Bounded English capture syntax, not a language model and not a completion detector. */
export function parseCapture(source: string, context: CaptureContext): CaptureProposal {
  const result: CaptureProposal = { source, normalized: '', intent: 'activity', allocations: [], skillCandidates: [], projectCandidates: [], issues: [], notices: [], tokens: [], ready: false };
  if (source.length > 1000) { result.issues.push('Keep this capture under 1,000 characters.'); return result; }
  const text = normalize(source); result.normalized = text;
  if (!text) { result.issues.push('Describe the work, its skill, and the time spent.'); return result; }
  if (context.skills.length > 1000 || (context.projects?.length || 0) > 1000) { result.issues.push('Use the manual fields for this large library.'); return result; }
  const token = (kind: CaptureProposal['tokens'][number]['kind'], start: number, end: number) => result.tokens.push({ kind, start, end, text: text.slice(start, end) });
  if (/\b(?:didn't|did not|haven't|have not|couldn't|could not|don't|do not|didnt|havent|couldnt|skipped|not done|no time spent)\b/u.test(text)) {
    result.intent = 'negated'; result.issues.push('This says the work did not happen. No completed activity is proposed.');
  } else if (/\b(?:plan to|planning to|will|want to|intend to|need to|tomorrow)\b/u.test(text)) {
    result.intent = 'planned'; result.issues.push('This describes planned work. Use a quest, or describe time already spent.');
  }

  // Resolve calendar dates as date keys, never by subtracting 24 hours from a zoned instant.
  let today: string | undefined;
  try { today = calendarDay(context.now || new Date(), context.timeZone); }
  catch { result.issues.push('Confirm a valid profile time zone before applying a date.'); }
  const dates: string[] = [];
  for (const match of text.matchAll(/\b(today|yesterday|\d{4}-\d{2}-\d{2})\b/gu)) {
    token('date', match.index!, match.index! + match[0].length);
    const value = match[0] === 'today' ? today : match[0] === 'yesterday' ? today && priorDay(today) : match[0];
    if (value && validDay(value)) dates.push(value); else result.issues.push('The date could not be read. Use YYYY-MM-DD or the date field.');
  }
  if (/\b(?:last week|last month|(?:last |this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/u.test(text)) result.issues.push('Choose an exact date; this date wording is ambiguous.');
  if (new Set(dates).size > 1) result.issues.push('More than one date was found. Capture one day at a time.');
  else result.localDate = dates[0] || today;
  if (today && result.localDate && result.localDate > today) result.issues.push('Future effort cannot be recorded. Choose today or an earlier date.');

  const units = new Set<string>(); let totalSeconds = 0; let durationCount = 0;
  const durationPattern = /(-?\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![\p{L}_])/gu;
  let lastDurationEnd = -1;
  for (const match of text.matchAll(durationPattern)) {
    if ((word(text[match.index! - 1]) || text[match.index! - 1] === '.') && match.index !== lastDurationEnd) continue;
    lastDurationEnd = match.index! + match[0].length;
    const unit = match[2].startsWith('h') ? 'hours' : match[2].startsWith('m') ? 'minutes' : 'seconds';
    const value = Number(match[1]); durationCount++;
    token('duration', match.index!, match.index! + match[0].length);
    if (units.has(unit)) result.issues.push('A time unit appears twice. Use one total, such as 45m or 1h 15m.');
    units.add(unit); totalSeconds += value * (unit === 'hours' ? 3600 : unit === 'minutes' ? 60 : 1);
    if (value <= 0) result.issues.push('Time spent must be greater than zero.');
  }
  if (durationCount) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 1 || totalSeconds > 86400) result.issues.push('Use a duration between one second and 24 hours.');
    else result.seconds = Math.round(totalSeconds);
  } else result.issues.push('Time is missing. Add minutes or hours; no effort is assumed.');
  if (/\b\d+(?:\.\d+)?\s*(?:to|-|–|or)\s*\d+(?:\.\d+)?\s*(?:h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)\b/u.test(text)) result.issues.push('A time range is ambiguous. Enter one reviewed duration.');

  for (const match of text.matchAll(/\b(\d+)\s*pages?\b/gu)) {
    token('pages', match.index!, match.index! + match[0].length);
    if (result.pages !== undefined) result.issues.push('More than one page count was found. Review it in Library.');
    result.pages = Number(match[1]);
  }
  if (result.pages !== undefined) {
    result.notices.push('Pages do not earn XP. Update page progress in Library; only reviewed time can become effort.');
    if (!result.seconds && result.intent === 'activity') result.intent = 'page-progress';
  }

  type Hit = { skill: Skill; phrase: string; start: number; end: number; match: 'exact' | 'alias' };
  const hits: Hit[] = [];
  for (const skill of context.skills.filter(skill => !skill.archived && !skill.deleted)) {
    const exact = [skill.name, skill.id, skill.id.replace(/-/g, ' '), skill.name.split(' · ')[0]];
    const customAliases = context.aliases?.[skill.id] || [];
    const phrases = new Map<string, Hit['match']>();
    for (const phrase of [...(aliases[skill.id] || []), ...customAliases].slice(0, 25)) if (phrase.length <= 120) phrases.set(normalize(phrase), 'alias');
    for (const phrase of exact) if (phrase.length <= 120) phrases.set(normalize(phrase), 'exact');
    for (const [phrase, match] of phrases) for (const start of occurrences(text, phrase)) hits.push({ skill, phrase, start, end: start + phrase.length, match });
  }
  // A full skill phrase consumes shorter contained names, but equal phrases remain ambiguous.
  const maximal = hits.filter(hit => !hits.some(other => other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start));
  const bySkill = new Map<string, Hit>();
  for (const hit of maximal.sort((a, b) => a.start - b.start || (a.match === 'exact' ? -1 : 1))) if (!bySkill.has(hit.skill.id)) bySkill.set(hit.skill.id, hit);
  const ordered = [...bySkill.values()];
  for (const hit of ordered) {
    result.skillCandidates.push({ skillId: hit.skill.id, name: hit.skill.name, match: hit.match });
    token('skill', hit.start, hit.end);
  }
  if (result.intent === 'activity' && ordered.some(hit => /\b(?:not|no|never)\s+(?:\w+\s+){0,2}$/u.test(text.slice(0, hit.start)))) {
    result.intent = 'negated'; result.issues.push('This may say the work did not happen. Confirm what you actually did in the fields below.');
  }
  if (result.tokens.some(item => item.kind === 'duration' && ordered.some(hit => hit.start <= item.start && hit.end >= item.end))) result.issues.push('A time value is part of a skill name. Enter the reviewed duration manually.');
  const ambiguous = ordered.some((hit, index) => ordered.some((other, j) => index !== j && other.start < hit.end && other.end > hit.start));
  if (!ordered.length) {
    const words = text.match(/[\p{L}][\p{L}-]{3,29}/gu) || [];
    const suggestions = context.skills.filter(skill => !skill.deleted && !skill.archived).filter(skill => {
      const skillWords = normalize(skill.name).match(/[\p{L}][\p{L}-]{3,29}/gu) || [];
      return words.some(term => skillWords.some(name => Math.abs(name.length - term.length) <= 1 && distance(term, name) === 1));
    }).slice(0, 4);
    result.skillCandidates.push(...suggestions.map(skill => ({ skillId: skill.id, name: skill.name, match: 'suggested' as const })));
    result.issues.push(suggestions.length ? 'A similar skill was found. Use its exact name or select a skill in the fields below.' : 'Choose a skill, or include its name in the sentence.');
  } else if (ambiguous) result.issues.push('That skill name matches more than one path. Use the complete name or select it below.');
  else if (ordered.length > 2) result.issues.push('Use at most two skills for one activity.');
  else if (ordered.length === 1) result.allocations = [{ skillId: ordered[0].skill.id, percent: 100 }];
  else {
    const splits = [...text.matchAll(/\b(\d{1,3})\s*%?\s*\/\s*(\d{1,3})\s*%?(?!\d)/gu)];
    if (splits.length !== 1) result.issues.push('Two skills need one explicit effort split, such as 70/30.');
    else {
      const split = splits[0]; token('split', split.index!, split.index! + split[0].length);
      const primary = Number(split[1]), secondary = Number(split[2]);
      if (primary < 1 || secondary < 1 || primary + secondary !== 100) result.issues.push('Both skill percentages must be positive whole numbers totaling 100.');
      else result.allocations = [{ skillId: ordered[0].skill.id, percent: primary }, { skillId: ordered[1].skill.id, percent: secondary }];
    }
  }
  for (const match of text.matchAll(/\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/gu)) {
    if (!result.tokens.some(item => (item.kind === 'duration' || item.kind === 'split') && item.start <= match.index! && item.end >= match.index! + match[0].length)) result.issues.push('Choose an exact date; this numeric date wording is ambiguous.');
  }
  // A literal project title is the only automatic project candidate; fuzzy projects are not linked.
  for (const project of (context.projects || []).filter(project => !project.deleted && !project.archived && project.status === 'active')) {
    if (project.title.length < 4 || project.title.length > 200) continue;
    const at = occurrences(text, normalize(project.title))[0];
    if (at !== undefined) { result.projectCandidates.push({ projectId: project.id, title: project.title }); token('project', at, at + normalize(project.title).length); }
  }
  if (result.tokens.some(item => item.kind === 'duration' && result.tokens.some(other => other.kind === 'project' && other.start <= item.start && other.end >= item.end))) result.issues.push('A time value is part of a project title. Enter the reviewed duration manually.');
  if (result.projectCandidates.length > 1) result.issues.push('Several projects match. Choose the intended project in the fields below.');
  else if (result.projectCandidates.length === 1) {
    const project = context.projects!.find(project => project.id === result.projectCandidates[0].projectId)!;
    if (result.allocations.some(allocation => allocation.skillId === project.skillId)) result.projectId = project.id;
    else result.issues.push('The named project does not use the proposed skill. Choose a compatible project or independent practice.');
  }
  result.issues = [...new Set(result.issues)];
  result.ready = result.intent === 'activity' && result.seconds !== undefined && result.localDate !== undefined && !!result.allocations.length && !result.issues.length;
  return result;
}
