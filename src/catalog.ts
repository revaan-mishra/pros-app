import { EXTRA_SKILLS, extraStarterForSkill } from './experience/skill-content';
import type { Affinity, AttributeId, Cosmetic, RegionDefinition, RegionId, Skill, StarterProject } from './types';

export const ATTRIBUTES: { id: AttributeId; name: string; description: string; color: string; icon: string }[] = [
  { id: 'strength', name: 'Strength', description: 'The work of moving, lifting, and building a capable body.', color: '#d7a07c', icon: 'dumbbell' },
  { id: 'intelligence', name: 'Intelligence', description: 'Curiosity put into practice through learning and problem solving.', color: '#acc5e9', icon: 'brain' },
  { id: 'wisdom', name: 'Wisdom', description: 'Reflection, perspective, and the patient work of understanding.', color: '#b2c599', icon: 'book-open' },
  { id: 'discipline', name: 'Discipline', description: 'Attention and deliberate practice, one useful session at a time.', color: '#82c2b0', icon: 'target' },
  { id: 'creativity', name: 'Creativity', description: 'Ideas made tangible through music, movement, words, and images.', color: '#c9addb', icon: 'palette' },
  { id: 'charisma', name: 'Charisma', description: 'Effort invested in expression, listening, and connection.', color: '#e1c17d', icon: 'messages-square' },
];

export const REGIONS: RegionDefinition[] = [
  { id: 'observatory', name: 'The Observatory', shortName: 'Observatory', domain: 'Languages & knowledge', color: '#acc5e9', description: 'Follow a question beyond the familiar. Every exchange, chapter, and discovery brings the stars a little closer.', guardian: 'The Keeper of Unasked Questions', stages: ["The empty plinth", "The aligned telescope", "The chart room", "The living sky atlas"] },
  { id: 'foundry', name: 'The Foundry', shortName: 'Foundry', domain: 'Technology & engineering', color: '#d99b78', description: 'Take an idea apart, understand its pieces, and make something that works. Small experiments keep the furnace warm.', guardian: 'The Unfinished Engine', stages: ["The cold workshop", "The working hearth", "The working bench", "The central mechanism"] },
  { id: 'atelier', name: 'The Atelier', shortName: 'Atelier', domain: 'Art & creative practice', color: '#c4a9d9', description: 'A place for the imperfect first take and the work worth keeping. Let practice become something you can share.', guardian: 'The Silent Muse', stages: ["The waiting room", "The practice room", "The exhibition wall", "The open terrace"] },
  { id: 'training', name: 'The Training Grounds', shortName: 'Training', domain: 'Movement & physical practice', color: '#a7bd8b', description: 'Return to the basics. Move with care, build capacity, and leave room for the recovery that makes progress possible.', guardian: 'The Patient Sentinel', stages: ["The overgrown route", "The clear path", "The equipped pavilion", "The complete circuit"] },
  { id: 'citadel', name: 'The Citadel', shortName: 'Citadel', domain: 'Strategy & communication', color: '#e1bd75', description: 'Think clearly, make considered choices, and bring people with you. A strong foundation begins with one useful decision.', guardian: 'The Council of Possibilities', stages: ["The closed exchange", "The open gates", "The council room", "The inhabited exchange"] },
  { id: 'sanctuary', name: 'The Sanctuary', shortName: 'Sanctuary', domain: 'Focus & reflection', color: '#83c9ba', description: 'Make space to notice what matters. Reflection and sustained attention turn a clearing into somewhere you can return.', guardian: 'The Restless Echo', stages: ["The quiet pavilion", "The quiet seat", "The returning garden", "The water garden"] },
];

type SkillRow = [string, string, string, RegionId, string, string, AttributeId, AttributeId];
const rows: SkillRow[] = [
  ['spanish', 'Spanish · Latin America', 'Languages', 'observatory', 'languages', 'Build useful exchanges, listen closely, and find your own words.', 'intelligence', 'charisma'],
  ['japanese', 'Japanese · JLPT paths', 'Languages', 'observatory', 'languages', 'Connect characters, listening, and everyday expression through steady practice.', 'intelligence', 'discipline'],
  ['french', 'French', 'Languages', 'observatory', 'languages', 'Read, listen, and speak in a language that becomes more familiar through use.', 'intelligence', 'charisma'],
  ['german', 'German', 'Languages', 'observatory', 'languages', 'Turn vocabulary and structure into conversations you can actually use.', 'intelligence', 'discipline'],
  ['frontend', 'Frontend Web Development', 'Technology', 'foundry', 'code', 'Build clear, accessible interfaces and understand how the browser brings them to life.', 'intelligence', 'creativity'],
  ['ai-engineering', 'AI Engineering', 'Technology', 'foundry', 'sparkles', 'Make useful AI systems, test their limits, and evaluate what they actually deliver.', 'intelligence', 'wisdom'],
  ['data-science', 'Data Science', 'Technology', 'foundry', 'chart-no-axes-combined', 'Ask a clear question, inspect the evidence, and explain what the data can support.', 'intelligence', 'wisdom'],
  ['systems-architecture', 'Systems Architecture', 'Technology', 'foundry', 'network', 'Understand boundaries, trade-offs, and how reliable components work together.', 'intelligence', 'wisdom'],
  ['game-development', 'Game Development', 'Technology', 'foundry', 'gamepad-2', 'Turn a small mechanic into something playable, understandable, and enjoyable.', 'creativity', 'intelligence'],
  ['acoustic-guitar', 'Acoustic Guitar', 'Creative practice', 'atelier', 'guitar', 'Build relaxed technique, musical understanding, and a repertoire worth playing.', 'creativity', 'discipline'],
  ['music-production', 'Music Production', 'Creative practice', 'atelier', 'audio-lines', 'Shape sound into a finished arrangement through listening and experimentation.', 'creativity', 'discipline'],
  ['digital-illustration', 'Digital Illustration', 'Creative practice', 'atelier', 'palette', 'Practice seeing, develop visual ideas, and finish images with intention.', 'creativity', 'discipline'],
  ['creative-writing', 'Creative Writing', 'Creative practice', 'atelier', 'feather', 'Find the detail, draft the scene, and revise until your meaning comes through.', 'creativity', 'charisma'],
  ['choreography', 'Choreography & Flow', 'Creative practice', 'atelier', 'wind', 'Explore rhythm, transitions, and expressive movement at a comfortable pace.', 'creativity', 'strength'],
  ['calisthenics', 'Calisthenics', 'Physical practice', 'training', 'dumbbell', 'Develop controlled bodyweight movement with a sustainable progression.', 'strength', 'discipline'],
  ['weightlifting', 'Olympic Weightlifting', 'Physical practice', 'training', 'dumbbell', 'Invest in sound technique, qualified feedback, and patient strength practice.', 'strength', 'discipline'],
  ['cardio', 'High-Intensity Cardio', 'Physical practice', 'training', 'heart-pulse', 'Build conditioning through appropriately scaled effort and recovery.', 'strength', 'discipline'],
  ['mobility', 'Flexibility & Mobility', 'Physical practice', 'training', 'activity', 'Practice comfortable ranges of motion and notice how movement feels.', 'strength', 'wisdom'],
  ['portfolio-investing', 'Portfolio Investing', 'Strategy', 'citadel', 'chart-no-axes-combined', 'Understand risk, diversification, and the reasoning behind an investment plan.', 'wisdom', 'intelligence'],
  ['capital-allocation', 'Capital Allocation', 'Strategy', 'citadel', 'scale', 'Compare uses of limited resources and make your assumptions explicit.', 'wisdom', 'intelligence'],
  ['public-speaking', 'Public Speaking', 'Strategy', 'citadel', 'mic', 'Organize a message, practice its delivery, and communicate with an audience.', 'charisma', 'discipline'],
  ['macroeconomics', 'Macroeconomics', 'Strategy', 'citadel', 'landmark', 'Connect economic ideas to evidence, mechanisms, and their limitations.', 'intelligence', 'wisdom'],
  ['stoicism', 'Stoic Philosophy', 'Mindset', 'sanctuary', 'landmark', 'Read thoughtfully and turn a useful principle into a practical response.', 'wisdom', 'discipline'],
  ['analytical-thinking', 'Analytical Thinking', 'Mindset', 'sanctuary', 'brain', 'Make claims precise, examine assumptions, and look for a better explanation.', 'wisdom', 'intelligence'],
  ['focus-endurance', 'Focus Endurance', 'Mindset', 'sanctuary', 'focus', 'Protect a manageable block of attention and learn what helps you return.', 'discipline', 'wisdom'],
  ['meditation', 'Meditation', 'Mindset', 'sanctuary', 'leaf', 'Practice noticing and returning, without needing every session to feel a certain way.', 'wisdom', 'discipline'],
];

const catalogAt = '2026-01-01T00:00:00.000Z';
export const SKILLS: Skill[] = rows.map(([id, name, category, regionId, icon, description, first, second]) => ({
  id, name, category, regionId, icon, description, revision: 0, createdAt: catalogAt, updatedAt: catalogAt,
  affinities: [{ attribute: first, percent: 70 }, { attribute: second, percent: 30 }] as Affinity[],
  equipped: ['frontend', 'acoustic-guitar', 'calisthenics'].includes(id), archived: false, custom: false,
}));

export const SKILL_CATALOG: Skill[] = [...SKILLS,...EXTRA_SKILLS];

const rewards: Record<RegionId, [string, string, string]> = {
  observatory: ['Starfinder Emblem', 'Brass Astrolabe', 'Stargazer Cloak'],
  foundry: ['Ember Emblem', 'Maker’s Toolkit', 'Artificer Coat'],
  atelier: ['Muse Emblem', 'Silver Tuning Fork', 'Atelier Mantle'],
  training: ['Sentinel Emblem', 'Woven Bracers', 'Wayfarer Garb'],
  citadel: ['Council Emblem', 'Amber Signet', 'Envoy Regalia'],
  sanctuary: ['Stillwater Emblem', 'Jade Keepsake', 'Sanctuary Robes'],
};
export const COSMETICS: Cosmetic[] = REGIONS.flatMap(region => (['emblem', 'accessory', 'outfit'] as const).map((slot, index) => ({
  id: `${region.id}-${slot}`, name: rewards[region.id][index], slot, regionId: region.id, stage: index + 1,
  description: `A mark of ${region.shortName.toLowerCase()} ${['established', 'restored', 'flourishing'][index]}. Available while its milestone requirements are met.`,
})));

export const STORIES: Record<RegionId, string[]> = {
  observatory: [
    'The roof is open to a sky no one has charted in years. On the desk lies a blank page. A question is enough to begin.',
    'A lamp catches in the old tower. Your first finished exchange becomes a point on the chart: proof that a distant place can become familiar.',
    'The chart room opens. Notes line the walls, windows turn toward new horizons, and the telescope finally has somewhere to look.',
    'The Keeper lowers the unfinished atlas. You have not learned everything. You have learned how to set out, return with something, and set out again. The sky is open.',
  ],
  foundry: [
    'An engine stands still beneath a coat of dust. Its pieces are ordinary enough. The work will be learning how they belong together.',
    'A flame settles into the furnace. One small thing works, and the workshop has a reason to open its doors.',
    'Light reaches the side benches. Experiments become tools; the parts you once only named now make sense in your hands.',
    'The engine turns. Its rhythm is not the sound of a perfect plan, but of a finished result, tested and understood. The Foundry is yours to keep building.',
  ],
  atelier: [
    'The terrace gate is closed. Beside it, Marin has left an empty folio on the work table. “Choose something small enough to finish,” the conservator says. There is no exhibition to arrange yet. The first job is to make a piece of work that can return to this room.',
    'The practice room has its first kept work. Marin makes space beside the instrument, leaving the rest of the desk clear. A session has a place to start, and a result has a place to stay. Beyond the gate, the terrace is still waiting.',
    'Two frames occupy the alcove. They hold different finished results, with the records of their making close at hand. Marin keeps an empty space beside them for revisions. The exhibition has begun; opening the terrace will take sustained practice and a completed project.',
    'The gate has been lifted away. Daylight reaches the open windows and the first row of the terrace. Marin puts the finished project beside the earlier studies. The room has changed through work you can point to. Its next exhibition is yours to choose.',
  ],
  training: [
    'Grass grows through the old training circle. There is no audience here, only a path that becomes clearer each time it is walked.',
    'Footprints return to the grounds. A measured session and a tangible step make a beginning worth trusting.',
    'The circle is clear, the targets repaired. Familiar movements feel more deliberate. There is room here for effort and for rest.',
    'The Patient Sentinel steps aside. Strength has taken the shape of a practice you can return to. The path continues; it does not demand a race.',
  ],
  citadel: [
    'The hall holds a table and a hundred possible decisions. For now, choose one that matters enough to examine.',
    'The gate opens. A useful decision or a message clearly delivered has given the empty hall its first purpose.',
    'People gather at the table. Assumptions are written down, alternatives considered, and ideas made clear enough to discuss.',
    'The Council sets the final chair beside yours. A considered project is complete. The Citadel stands on choices you can explain, and remains open to better ones.',
  ],
  sanctuary: [
    'A clearing lies behind the trees. The water is still even when your thoughts are not. You do not have to earn a place to sit.',
    'A lantern marks the way back. One deliberate practice and one useful reflection have made a place to pause.',
    'The garden returns slowly. Attention has become less a thing to force and more a path you know how to find.',
    'The Restless Echo fades into the trees. Nothing needs to be held perfectly still. You have made enough room to notice, choose, and begin again.',
  ],
};

function starter(title: string, outputCriterion: string, actions: [string, string, string], description: string): StarterProject {
  return { title, outputCriterion, actions, description };
}
const STARTERS: Record<string, StarterProject> = {
  spanish: starter('A conversation for a new city', 'Speak or record a complete everyday exchange without reading every line.', ['Choose a situation you might actually use', 'Practice both sides aloud', 'Keep one complete exchange'], 'Use a café, directions, or an introduction as a small reason to speak.'),
  japanese: starter('An introduction in your own words', 'Deliver a short self-introduction and explain the words you chose.', ['Choose five things worth saying', 'Practice reading and listening to the phrases', 'Say the introduction from prompts'], 'Connect your current study level to a short exchange you can make your own.'),
  french: starter('A short story, understood', 'Finish a short French text and summarize its meaning in your own words.', ['Choose a manageable text', 'Read and note useful expressions', 'Write or speak a short summary'], 'Favor a text you can finish over one you feel you ought to read.'),
  german: starter('An everyday exchange', 'Complete a brief dialogue about a familiar situation.', ['Choose one practical scenario', 'Practice its useful structures', 'Record or perform the complete dialogue'], 'Make vocabulary useful by putting it into a small conversation.'),
  frontend: starter('Build a useful little page', 'Save a working page that is usable on a phone and by keyboard.', ['Sketch one clear screen', 'Build its main interaction', 'Test narrow screens and keyboard navigation'], 'Finish one useful interaction before adding more screens.'),
  'ai-engineering': starter('An experiment with evidence', 'Keep a small AI experiment, its test cases, and a short evaluation.', ['Define one useful input and output', 'Build the smallest working experiment', 'Test several ordinary and difficult cases'], 'A useful result includes knowing where the system falls short.'),
  'data-science': starter('One question, one clear finding', 'Create a chart or table with a written conclusion and limitations.', ['Choose a dataset and a specific question', 'Inspect and analyze the relevant data', 'Explain the finding and its uncertainty'], 'Start with a question that the available evidence can actually address.'),
  'systems-architecture': starter('Explain a small system', 'Produce a diagram and explain one important design trade-off.', ['Choose a familiar application', 'Map its boundaries and data flow', 'Compare two approaches to one design decision'], 'Make the connections between components understandable.'),
  'game-development': starter('A five-minute playable loop', 'Finish a playable prototype with a clear goal, feedback, and restart.', ['Choose one central mechanic', 'Build a complete play-and-restart loop', 'Watch someone try it and revise one problem'], 'Give a small mechanic enough attention to feel coherent.'),
  'acoustic-guitar': starter('A twelve-bar moment', 'Keep a complete twelve-bar performance at a comfortable tempo.', ['Choose a comfortable chord pattern', 'Practice transitions slowly', 'Record one complete take'], 'Make a short piece of music feel relaxed and connected.'),
  'music-production': starter('Finish a one-minute arrangement', 'Export a complete short arrangement with a beginning and an ending.', ['Choose a small palette of sounds', 'Arrange a clear musical idea', 'Balance the parts and export the result'], 'A short finished arrangement teaches more than an ever-growing loop.'),
  'digital-illustration': starter('One subject, one finished image', 'Export a finished illustration and keep a note about one choice you made.', ['Collect a small set of references', 'Develop a readable sketch', 'Resolve color, shape, and the final export'], 'Choose a subject that gives you something specific to practice.'),
  'creative-writing': starter('A scene worth keeping', 'Finish and revise a short scene with a clear change from beginning to end.', ['Choose a character and a small conflict', 'Draft without polishing every sentence', 'Revise for clarity and keep the finished scene'], 'Let a bounded scene give the words somewhere to go.'),
  choreography: starter('A short movement phrase', 'Perform or record a complete movement phrase with intentional transitions.', ['Choose music and a comfortable movement range', 'Connect a few movements into a phrase', 'Practice and keep one complete performance'], 'Build a phrase that feels comfortable enough to repeat and refine.'),
  calisthenics: starter('A sustainable bodyweight routine', 'Complete an appropriately scaled routine and record how each movement felt.', ['Choose familiar movements suited to your current ability', 'Practice the routine with comfortable form', 'Record the session and one sensible next adjustment'], 'Build a routine you can return to; seek qualified guidance for unfamiliar movements.'),
  weightlifting: starter('A technique practice you understand', 'Complete a suitably coached technique session and keep its main feedback.', ['Choose a technique focus with qualified guidance', 'Practice at an appropriate load', 'Record useful cues and the next technique focus'], 'Technical quality and appropriate coaching lead this practice.'),
  cardio: starter('A conditioning session with a plan', 'Complete an appropriately scaled session and note effort and recovery.', ['Choose a familiar activity and manageable session', 'Complete the planned work and recovery', 'Record how the session felt and what to adjust'], 'Use a level appropriate to your health and experience; the app does not prescribe intensity.'),
  mobility: starter('A comfortable movement sequence', 'Complete a short comfortable sequence and note one useful observation.', ['Choose a few familiar movements', 'Move through a comfortable range without forcing it', 'Keep the sequence and your observations'], 'A repeatable, comfortable practice is enough for a useful beginning.'),
  'portfolio-investing': starter('Explain a model portfolio', 'Write a hypothetical allocation with its assumptions, risks, and limitations.', ['Choose a hypothetical goal and time horizon', 'Research diversification and relevant risks', 'Write an allocation rationale and its limitations'], 'Use a learning example; finishing it does not require buying an investment.'),
  'capital-allocation': starter('Make one trade-off visible', 'Compare three hypothetical uses of a limited resource and explain a choice.', ['Define the resource and intended outcome', 'Compare alternatives and assumptions', 'Write a decision and the evidence that could change it'], 'A clear decision model makes uncertainty easier to discuss.'),
  'public-speaking': starter('A clear two-minute message', 'Deliver or record a two-minute talk with an understandable main point.', ['Choose one message and its audience', 'Structure the opening, example, and close', 'Practice and keep one complete delivery'], 'A short talk creates room to work on clarity and delivery.'),
  macroeconomics: starter('Explain one economic mechanism', 'Create a concise explanation supported by evidence and a limitation.', ['Choose a specific economic question', 'Trace its mechanism using reputable sources', 'Explain the mechanism and what it does not establish'], 'Aim to make one connection clear rather than explain the whole economy.'),
  stoicism: starter('A principle put into practice', 'Keep a reflection connecting one passage to a specific response in daily life.', ['Read a short passage carefully', 'Choose a situation where its idea might help', 'Try a considered response and reflect on it'], 'Let the reading support a practical experiment rather than another rule to obey.'),
  'analytical-thinking': starter('Test a familiar claim', 'Write a claim, its assumptions, supporting evidence, and a fair counterargument.', ['Make the claim precise', 'Look for evidence and alternative explanations', 'Write a revised conclusion with uncertainty'], 'Practice changing your conclusion when the evidence gives you a reason.'),
  'focus-endurance': starter('Build a workable focus session', 'Complete a manageable focused block and record what helped or interrupted it.', ['Choose one specific next action', 'Prepare a manageable block of attention', 'Review the session and one useful adjustment'], 'A shorter block completed deliberately is a useful starting point.'),
  meditation: starter('A small practice of returning', 'Complete a comfortable practice and note what you noticed without grading it.', ['Choose a short practice and comfortable position', 'Practice noticing and gently returning', 'Write one observation about the experience'], 'The purpose is to practice; a busy mind does not invalidate a session.'),
};

export function starterForSkill(skill: string | Skill): StarterProject {
  const id = typeof skill === 'string' ? skill : skill.id;
  const found = STARTERS[id] || extraStarterForSkill(id);
  if (found) return { ...found, actions: [...found.actions] };
  const name = typeof skill === 'string' ? 'your skill' : skill.name;
  return starter(`A first result in ${name}`, 'Keep one finished result and explain what you learned.', ['Choose one small result', 'Practice the part that matters', 'Finish it and note a useful next step'], `Give ${name} a small project with a clear finish.`);
}
