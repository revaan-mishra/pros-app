export type AttributeId = 'strength' | 'intelligence' | 'wisdom' | 'discipline' | 'creativity' | 'charisma';
export type RegionId = 'observatory' | 'foundry' | 'atelier' | 'training' | 'citadel' | 'sanctuary';
export type EntityKind = 'profile' | 'skills' | 'activities' | 'quests' | 'projects' | 'outputs' | 'books' | 'journals' | 'focusSessions';
export interface BaseEntity { id: string; revision: number; createdAt: string; updatedAt: string; deleted?: boolean }
export interface Affinity { attribute: AttributeId; percent: number }
export interface Skill extends BaseEntity {
  name: string; description: string; category: string; regionId: RegionId; affinities: Affinity[];
  icon: string; equipped: boolean; archived: boolean; custom?: boolean;
}
export interface Allocation { skillId: string; percent: number; regionId: RegionId; affinities: Affinity[] }
export interface Activity extends BaseEntity {
  title: string; seconds: number; allocations: Allocation[]; occurredAt: string; localDate: string;
  timeZone: string; note: string; source: 'manual' | 'focus' | 'reading';
  questId?: string; projectId?: string; focusSessionId?: string; bookId?: string;
  startedAt?: string; endedAt?: string;
}
export interface Quest extends BaseEntity {
  title: string; skillId: string; projectId?: string; objectiveId?: string; parentId?: string; dueDate?: string;
  status: 'pending' | 'completed' | 'skipped'; archived: boolean; priority: boolean;
  recurrence: 'none' | 'daily' | 'weekdays' | 'weekly'; occurrenceOf?: string; completedAt?: string;
  skippedAt?: string;
  originalDueDate?: string;
  scheduleHistory?: { id: string; at: string; from?: string; to?: string }[];
  note: string;
}
export interface Objective { id: string; title: string; required: boolean; completed: boolean }
export interface Project extends BaseEntity {
  title: string; description: string; outputCriterion: string; skillId: string; regionId: RegionId;
  status: 'draft' | 'active' | 'paused' | 'completed'; archived: boolean; targetDate?: string;
  effortTargetSeconds: number; objectives: Objective[]; completedAt?: string;
}
export interface Output extends BaseEntity {
  title: string; description: string; skillId: string; regionId: RegionId;
  projectId?: string; bookId?: string; confirmedAt: string;
}
export interface Book extends BaseEntity {
  title: string; author: string; status: 'wishlist' | 'reading' | 'paused' | 'completed';
  pages: number; totalPages: number; skillId: string; notes: string; archived: boolean;
}
export interface Journal extends BaseEntity {
  title: string; body: string; date: string; activityId?: string; projectId?: string; bookId?: string;
  milestoneId?: string;
}
export interface FocusSegment { start: number; end?: number }
export interface FocusSession extends BaseEntity {
  skillId: string; questId?: string; projectId?: string; targetSeconds: number | null;
  status: 'running' | 'paused' | 'review' | 'completed' | 'discarded';
  segments: FocusSegment[]; confirmedSeconds?: number;
  continuationNote?: string;
  continuationQuestId?: string;
}
export interface ExperiencePreferences {
  version: 1;
  pinnedProjectId?: string;
  dismissedProjectIds: string[];
  keepsakeSlots: (string | null)[];
  focusMode: 'immersive' | 'minimal' | 'practice';
  focusMinutes: number;
}
export interface AudioPreferences {
  version: 1;
  preset: 'silent' | 'quiet-focus' | 'world' | 'custom';
  musicEnabled: boolean; musicVolume: number;
  musicChoice: 'regional' | 'procedural' | 'homestead' | 'woodlands' | 'fairy-lights';
  ambienceEnabled: boolean; ambienceVolume: number;
  ambienceChoice: 'regional' | 'forest' | 'water' | 'forest-water';
  interfaceEnabled: boolean; milestonesEnabled: boolean;
}
export interface Profile extends BaseEntity {
  displayName: string; avatarColor: string; avatarStyle: 'wanderer' | 'scholar' | 'maker';
  equipment: { emblem: string; accessory: string; outfit: string };
  timeZone: string; onboardingStep: number; onboardingComplete: boolean; lastSkillId: string;
  motion: 'system' | 'reduced' | 'full'; sound: boolean; theme: 'dark' | 'light' | 'system';
  lastOpenedAt: string; lastExportAt?: string; celebrationIds: string[];
  experience?: ExperiencePreferences;
  audio?: AudioPreferences;
}
export interface GameData {
  profile: Profile; skills: Skill[]; activities: Activity[]; quests: Quest[]; projects: Project[];
  outputs: Output[]; books: Book[]; journals: Journal[]; focusSessions: FocusSession[];
}
export type GameEntity = Profile | Skill | Activity | Quest | Project | Output | Book | Journal | FocusSession;
export interface LevelProgress { level: number; xp: number; current: number; required: number; progress: number }
export interface RegionProgress {
  seconds: number; minutes: number; outcomes: number; completedProjects: number; stage: number;
  nextMinutes: number | null; nextOutcomes: number | null; needsProject: boolean;
}
export interface Projection {
  xp: number; character: LevelProgress;
  attributes: Record<AttributeId, { xp: number; level: number }>;
  skills: Record<string, LevelProgress & { minutes: number; outcomes: number; milestone: number }>;
  regions: Record<RegionId, RegionProgress>; eligibleCosmetics: string[]; titles: string[];
  totalOutputs: number; totalProjects: number;
}
export interface RegionDefinition {
  id: RegionId; name: string; domain: string; color: string; shortName: string;
  description: string; guardian: string; stages: string[];
}
export interface Cosmetic { id: string; name: string; slot: 'emblem' | 'accessory' | 'outfit'; regionId: RegionId; stage: number; description: string }
export interface StarterProject { title: string; description: string; outputCriterion: string; actions: string[] }
export interface StoredRecord { key: string; accountId: string; kind: EntityKind; entityId: string; revision: number; data: GameEntity }
export interface Mutation { kind: EntityKind; entity: GameEntity; expectedRevision?: number }
export type ConsumedDraft = string | { name: string; value: unknown };
export interface Command {
  id: string; accountId: string; mutations: Mutation[]; createdAt: string; status: 'pending' | 'synced' | 'conflict' | 'failed';
  schemaVersion: number; rulesVersion: number; error?: string;
}
export interface Backup {
  format: 'pros-backup'; version: number; rulesVersion: number; exportedAt: string;
  accountId: string; data: GameData; pendingCommands: Command[];
  drafts?: BackupDraft[];
}
export type DraftJSON = null | string | number | boolean | DraftJSON[] | { [key: string]: DraftJSON };
export interface BackupDraft { name: string; value: DraftJSON; updatedAt: string }
