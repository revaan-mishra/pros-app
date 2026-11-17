import { describe, expect, it } from 'vitest';
import { seedGame } from '../domain';
import { parseCapture, type CaptureContext } from './capture-parser';
import type { Project, Skill } from '../types';

const skills = seedGame('empty').skills;
const context: CaptureContext = { skills, timeZone: 'Asia/Kolkata', now: new Date('2026-11-17T18:45:00Z') };
const parse = (text: string, overrides: Partial<CaptureContext> = {}) => parseCapture(text, { ...context, ...overrides });
const custom = (id: string, name: string): Skill => ({ ...skills[0], id, name, custom: true });
const project = (id: string, title: string, skillId = 'frontend'): Project => ({ ...skills[0], id, title, skillId, description: '', outputCriterion: 'A result', objectives: [], regionId: 'foundry', status: 'active', effortTargetSeconds: 3600, archived: false });

describe('offline capture interpretation', () => {
  it('reads an alias, minutes and yesterday in the confirmed profile zone', () => {
    const result = parse('guitar 25m yesterday');
    expect(result.ready).toBe(true); expect(result.seconds).toBe(1500);
    expect(result.localDate).toBe('2026-11-17');
    expect(result.allocations).toEqual([{ skillId: 'acoustic-guitar', percent: 100 }]);
  });
  it('conserves an explicit split and keeps skill mention order', () => {
    const result = parse('30m frontend + German 70/30');
    expect(result.ready).toBe(true); expect(result.seconds).toBe(1800);
    expect(result.allocations).toEqual([{ skillId: 'frontend', percent: 70 }, { skillId: 'german', percent: 30 }]);
    expect(result.allocations.reduce((total, allocation) => total + result.seconds! * allocation.percent / 100, 0)).toBe(1800);
    expect(parse('German + frontend 30m 25/75').allocations[0]).toEqual({ skillId: 'german', percent: 25 });
  });
  it('requires an explicit split instead of inventing one', () => {
    expect(parse('guitar and German 30m').ready).toBe(false);
    expect(parse('guitar and German 30m').allocations).toEqual([]);
    for (const split of ['70/40', '100/0', '0/100', '70/30 50/50']) expect(parse(`guitar German 30m ${split}`).ready).toBe(false);
  });
  it('supports decimal hours, seconds and compound distinct units', () => {
    expect(parse('German 1.5 hours').seconds).toBe(5400); expect(parse('German 1.5 hours').ready).toBe(true);
    expect(parse('German 1h 15m 30s').seconds).toBe(4530);
    expect(parse('German 1h15m30s').seconds).toBe(4530); expect(parse('German 1h15m30s').ready).toBe(true);
    expect(parse('German 90 seconds').seconds).toBe(90);
    expect(parse('German 0.5m').seconds).toBe(30);
  });
  it('rejects duplicate units, time ranges and implausible values', () => {
    for (const text of ['German 20m 30m', 'German 20-30m', 'German 20 to 30m', 'German 20 or 30m', 'German -5m', 'German 0m', 'German 25h', 'German 0.001s']) expect(parse(text).ready, text).toBe(false);
  });
  it('does not invent effort from missing time or page progress', () => {
    expect(parse('practice guitar yesterday').seconds).toBeUndefined();
    const pages = parse('read 20 pages'); expect(pages.intent).toBe('page-progress'); expect(pages.seconds).toBeUndefined(); expect(pages.ready).toBe(false);
    const timed = parse('German 20 pages 15m'); expect(timed.ready).toBe(true); expect(timed.seconds).toBe(900); expect(timed.pages).toBe(20);
  });
  it('does not interpret negation or intention as completed work', () => {
    for (const text of ["didn't meditate today 25m", 'did not practice guitar 15m', 'I haven’t played guitar 20m', 'skipped German 30m', 'didnt meditate 20m', 'no German 30m', 'not guitar 20m']) {
      const result = parse(text); expect(result.intent, text).toBe('negated'); expect(result.ready).toBe(false);
    }
    for (const text of ['I want to play guitar 20m', 'I will practice German 30m', 'guitar 25m tomorrow']) {
      const result = parse(text); expect(result.intent, text).toBe('planned'); expect(result.ready).toBe(false);
    }
  });
  it('uses the longest exact phrase instead of its contained custom skill', () => {
    const result = parse('Acoustic Guitar 20m', { skills: [...skills, custom('short', 'Guitar')] });
    expect(result.ready).toBe(true); expect(result.allocations).toEqual([{ skillId: 'acoustic-guitar', percent: 100 }]);
  });
  it('keeps equally named paths ambiguous and offers fuzzy matches without selecting them', () => {
    const ambiguous = parse('Guitar 20m', { skills: [...skills, custom('other', 'Guitar')] });
    expect(ambiguous.ready).toBe(false); expect(ambiguous.allocations).toEqual([]); expect(ambiguous.skillCandidates).toHaveLength(2);
    const fuzzy = parse('Greman 20m'); expect(fuzzy.ready).toBe(false); expect(fuzzy.allocations).toEqual([]);
    const typo = parse('Germam 20m'); expect(typo.skillCandidates).toContainEqual({ skillId: 'german', name: 'German', match: 'suggested' });
  });
  it('only matches complete word boundaries and excludes unavailable skills', () => {
    expect(parse('Germanic 20m').ready).toBe(false);
    const unavailable = skills.map(skill => skill.id === 'german' ? { ...skill, archived: true } : skill);
    expect(parse('German 20m', { skills: unavailable }).ready).toBe(false);
    expect(parse('German 20m', { skills: skills.map(skill => ({ ...skill, deleted: true })) }).skillCandidates).toEqual([]);
  });
  it('supports supplied aliases only for that provided skill context', () => {
    expect(parse('my riffs 20m', { aliases: { 'acoustic-guitar': ['my riffs'] } }).ready).toBe(true);
    expect(parse('my riffs 20m').ready).toBe(false);
  });
  it('handles Unicode, numbered names and safe text without executing anything', () => {
    expect(parse('Ｇｅｒｍａｎ　２５ｍ').seconds).toBe(1500);
    const result = parse('3D Printing 20m', { skills: [custom('3d', '3D Printing')] });
    expect(result.ready).toBe(true); expect(result.seconds).toBe(1200);
    expect(parse('30m Stretch 15m', { skills: [custom('stretch', '30m Stretch')] }).ready).toBe(false);
    expect(parse('<script>alert(1)</script> German 20m').source).toContain('<script>');
  });
  it('makes token explanations refer to the normalized input', () => {
    const result = parse('  Ｇｅｒｍａｎ  25m yesterday  ');
    for (const token of result.tokens) expect(result.normalized.slice(token.start, token.end)).toBe(token.text);
  });
  it('resolves calendar yesterday without a DST or midnight offset bug', () => {
    expect(parse('German 20m yesterday', { timeZone: 'America/New_York', now: new Date('2026-11-02T05:30:00Z') }).localDate).toBe('2026-11-01');
    expect(parse('German 20m today', { timeZone: 'America/New_York' }).localDate).toBe('2026-11-17');
    expect(parse('German 20m today').localDate).toBe('2026-11-18');
  });
  it('rejects invalid, future, conflicting or ambiguous dates', () => {
    for (const text of ['German 20m 2026-02-30', 'German 20m 2026-11-19', 'German 20m today yesterday', 'German 20m last Monday', 'German 20m on 11/16']) expect(parse(text).ready, text).toBe(false);
    expect(parse('German 20m 2026-11-16').ready).toBe(true);
    expect(parse('German 20m', { timeZone: 'Mars/Olympus' }).ready).toBe(false);
  });
  it('only links one exact, active, compatible project title', () => {
    const projects = [project('web', 'Small web garden')];
    const result = parse('frontend 25m Small web garden', { projects });
    expect(result.ready).toBe(true); expect(result.projectId).toBe('web');
    expect(parse('German 25m Small web garden', { projects }).ready).toBe(false);
    expect(parse('frontend 25m small web gardem', { projects }).projectId).toBeUndefined();
    expect(parse('frontend 25m Small web garden', { projects: [{ ...projects[0], archived: true }] }).projectId).toBeUndefined();
    expect(parse('frontend 25m Small web garden and Second garden', { projects: [...projects, project('second', 'Second garden')] }).ready).toBe(false);
    expect(parse('frontend A 25m experiment', { projects: [project('timed-name', 'A 25m experiment')] }).ready).toBe(false);
  });
  it('bounds input and does not mutate source records or retain previous proposals', () => {
    const original = JSON.stringify(skills);
    expect(parse('a'.repeat(1001)).ready).toBe(false); expect(parse('').ready).toBe(false);
    expect(parse('guitar 20m').ready).toBe(true); expect(parse('read pages').seconds).toBeUndefined();
    expect(JSON.stringify(skills)).toBe(original);
  });
});
