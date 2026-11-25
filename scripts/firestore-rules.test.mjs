import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { encodeComposition } from '../src/cloud/affinity-composition.ts';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, setLogLevel, where, writeBatch } from 'firebase/firestore';

// Deliberately fails without the emulator; never touches a production project.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Start this suite with the Firestore emulator.');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
setLogLevel('silent'); // Expected permission failures are assertions, not console errors.
let environment;
const at = '2026-11-17T00:00:00.000Z';
const account = (uid = 'alice', verified = true) => environment.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: verified }).firestore();
const path = (db, uid, type, key) => doc(db, 'users', uid, type, key);
const base = (id = 'test') => ({ id, revision: 1, createdAt: at, updatedAt: at });
const skill = (id = 'guitar') => ({ ...base(id), name: 'Guitar', description: '', category: 'Music', regionId: 'atelier', affinities: [{ attribute: 'creativity', percent: 70 }, { attribute: 'discipline', percent: 30 }], icon: 'music', equipped: true, archived: false });
const activity = (id = 'practice') => ({ ...base(id), title: 'Practice', seconds: 1500, allocations: [{ skillId: 'guitar', percent: 100, regionId: 'atelier', affinities: [{ attribute: 'creativity', percent: 100 }] }], occurredAt: at, localDate: '2026-11-17', timeZone: 'Asia/Kolkata', note: '', source: 'manual' });
const profile = () => ({ ...base('profile'), displayName: 'Wanderer', avatarColor: '#abcdef', avatarStyle: 'wanderer', equipment: { emblem: '', accessory: '', outfit: '' }, timeZone: 'Asia/Kolkata', onboardingStep: 3, onboardingComplete: true, lastSkillId: 'guitar', motion: 'system', sound: false, theme: 'dark', lastOpenedAt: at, celebrationIds: [] });
const fixtures = {
  profile,
  skills: skill,
  activities: activity,
  quests: () => ({ ...base(), title: 'Practice', skillId: 'guitar', status: 'pending', archived: false, priority: false, recurrence: 'none', note: '' }),
  projects: () => ({ ...base(), title: 'Record a song', description: '', outputCriterion: 'One recording', skillId: 'guitar', regionId: 'atelier', status: 'active', archived: false, effortTargetSeconds: 3600, objectives: [{ id: 'step', title: 'Prepare', completed: false, required: true }] }),
  outputs: () => ({ ...base(), title: 'One recording', description: '', skillId: 'guitar', regionId: 'atelier', confirmedAt: at }),
  books: () => ({ ...base(), title: 'A book', author: '', status: 'reading', pages: 0, totalPages: 100, skillId: 'guitar', notes: '', archived: false }),
  journals: () => ({ ...base(), title: '', body: 'Private writing', date: '2026-11-17' }),
  focusSessions: () => ({ ...base(), skillId: 'guitar', targetSeconds: null, status: 'running', segments: [{ start: Date.parse(at) }] }),
};
const attributes=['strength','intelligence','wisdom','discipline','creativity','charisma'];
function wireAffinities(items) {
 const order=[...items.map(item=>item.attribute),...attributes.filter(name=>!items.some(item=>item.attribute===name))],available=[...attributes],factorial=[1,1,2,6,24,120];let rank=0;
 for(let index=0;index<6;index++){const at=available.indexOf(order[index]);if(at<0)return '999:100';rank+=at*factorial[5-index];available.splice(at,1);}
 const encoded=encodeComposition(items.map(item=>String(item.percent)));return `${rank}:${items.length}:${encoded.total}:${encoded.rank}`;
}
function wire(kind,input,sequence=1,commandId='command-1'){
 const data=kind==='skills'?{...input,affinities:wireAffinities(input.affinities)}:kind==='activities'?{...input,allocations:`${input.allocations.map(item=>item.percent).join('|')}#${input.allocations.map(item=>`${item.skillId}~${item.regionId}~${wireAffinities(item.affinities)}`).join(';')}`}:input;
 return {wireVersion:3,kind,entityId:data.id,data,revision:data.revision,sequence,commandId};
}
function key(record) { return record.kind === 'profile' ? 'profile' : `${record.kind}:${record.entityId}`; }
async function commit(db, records, { uid = 'alice', commandId = records[0]?.commandId || 'command-1', sequence = records[0]?.sequence || 1, receipt = true, state = true } = {}) {
  const batch = writeBatch(db);
  if (state) batch.set(path(db, uid, 'state', 'main'), { sequence, commandId, deleting: false });
  if (receipt) batch.set(path(db, uid, 'commands', commandId), { id: commandId, fingerprint: 'a'.repeat(64), sequence, keys: records.map(key), status: 'accepted' });
  for (const record of records) batch.set(path(db, uid, 'records', key(record)), record);
  return batch.commit();
}
async function seed(callback) { return environment.withSecurityRulesDisabled(context => callback(context.firestore())); }
before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-pros-rules', firestore: { host, port: Number(port), rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
beforeEach(async () => { await environment.clearFirestore(); });
after(async () => { await environment?.cleanup(); });

for (const [kind, create] of Object.entries(fixtures)) {
  test(`valid ${kind} can be atomically created and read by its owner`, async () => {
    const db = account(); const record = wire(kind, create());
    await assertSucceeds(commit(db, [record]));
    assert.deepEqual((await assertSucceeds(getDoc(path(db, 'alice', 'records', key(record))))).data(), record);
  });
  test(`${kind} rejects unknown fields on create and update`, async () => {
    const db = account();
    await assertFails(commit(db, [wire(kind, { ...create(), isAdmin: true })]));
    await assertSucceeds(commit(db, [wire(kind, create())]));
    await assertFails(commit(db, [wire(kind, { ...create(), revision: 2, isAdmin: true }, 2, 'command-2')]));
  });
}
test('anonymous and unverified accounts cannot read, list or write private records', async () => {
  await assertSucceeds(commit(account(), [wire('skills', skill())]));
  for (const db of [environment.unauthenticatedContext().firestore(), account('alice', false)]) {
    await assertFails(getDoc(path(db, 'alice', 'records', 'skills:guitar')));
    await assertFails(getDocs(query(collection(db, 'users', 'alice', 'records'), limit(200))));
    await assertFails(commit(db, [wire('skills', skill('other'), 2, 'command-2')]));
  }
});
test('a verified account opens without an access document and the operator can pause and restore sync', async () => {
  const db = account();
  assert.equal((await assertSucceeds(getDoc(doc(db, 'access', 'alice')))).exists(), false);
  await assertSucceeds(commit(db, [wire('skills', skill())]));
  await seed(admin => setDoc(doc(admin, 'access', 'alice'), { enabled: false }));
  await assertFails(getDoc(path(db, 'alice', 'records', 'skills:guitar')));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 2 }, 2, 'command-2')]));
  await seed(admin => setDoc(doc(admin, 'access', 'alice'), { enabled: true }));
  await assertSucceeds(getDoc(path(db, 'alice', 'records', 'skills:guitar')));
  await assertSucceeds(commit(db, [wire('skills', { ...skill(), revision: 2 }, 2, 'command-2')]));
});
test('cross-user reads, queries, create, update, delete and state changes are denied', async () => {
  await assertSucceeds(commit(account(), [wire('skills', skill())]));
  const bob = account('bob');
  await assertFails(getDoc(path(bob, 'alice', 'records', 'skills:guitar')));
  await assertFails(getDocs(query(collection(bob, 'users', 'alice', 'records'), limit(200))));
  await assertFails(commit(bob, [wire('skills', skill('other'), 2, 'command-2')], { uid: 'alice' }));
  await assertFails(setDoc(path(bob, 'alice', 'state', 'main'), { sequence: 1, commandId: 'command-1', deleting: true }));
  await assertFails(deleteDoc(path(bob, 'alice', 'records', 'skills:guitar')));
});
test('sync overrides cannot be self-granted, listed or read across users', async () => {
  const alice = account();
  await assertSucceeds(getDoc(doc(alice, 'access', 'alice')));
  await assertFails(setDoc(doc(alice, 'access', 'alice'), { enabled: true }));
  await assertFails(getDoc(doc(alice, 'access', 'bob')));
  await assertFails(getDocs(collection(alice, 'access')));
});
test('canonical record revision increments exactly once and preserves creation identity', async () => {
  const db = account(); await assertSucceeds(commit(db, [wire('skills', skill())]));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 3 }, 2, 'command-2')]));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 2, createdAt: '2026-11-18T00:00:00.000Z' }, 2, 'command-2')]));
  await assertSucceeds(commit(db, [wire('skills', { ...skill(), revision: 2, name: 'Acoustic guitar' }, 2, 'command-2')]));
});
test('record-only, receipt-only and state-only ordinary writes cannot bypass the command protocol', async () => {
  const db = account(); const record = wire('skills', skill());
  await assertFails(setDoc(path(db, 'alice', 'records', key(record)), record));
  await assertFails(setDoc(path(db, 'alice', 'commands', 'command-1'), { id: 'command-1', fingerprint: 'a'.repeat(64), sequence: 1, keys: [key(record)], status: 'accepted' }));
  await assertFails(setDoc(path(db, 'alice', 'state', 'main'), { sequence: 1, commandId: 'command-1', deleting: false }));
});
test('receipt replay and reused sequence cannot mutate canonical records', async () => {
  const db = account(); await assertSucceeds(commit(db, [wire('skills', skill())]));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 2 })]));
  await assertFails(setDoc(path(db, 'alice', 'commands', 'command-1'), { id: 'command-1', fingerprint: 'b'.repeat(64), sequence: 1, keys: ['skills:guitar'], status: 'accepted' }));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 2 }, 1, 'command-2')]));
});
test('record key, wrapper revision and omitted receipt membership are enforced', async () => {
  const db = account(); const record = wire('skills', skill());
  const b = writeBatch(db);
  b.set(path(db, 'alice', 'state', 'main'), { sequence: 1, commandId: 'command-1', deleting: false });
  b.set(path(db, 'alice', 'commands', 'command-1'), { id: 'command-1', fingerprint: 'a'.repeat(64), sequence: 1, keys: ['skills:unrelated'], status: 'accepted' });
  b.set(path(db, 'alice', 'records', key(record)), record);
  await assertFails(b.commit());
  await assertFails(commit(db, [{ ...record, revision: 2 }]));
  await assertFails(commit(db, [{ ...record, entityId: 'different' }]));
});
test('invalid durations, allocations and huge strings are rejected on create and update', async () => {
  const db = account();
  for (const patch of [{ seconds: -1 }, { seconds: 86401 }, { seconds: 0.5 }, { title: 'x'.repeat(201) }, { note: 'x'.repeat(50001) }, { allocations: [{ ...activity().allocations[0], percent: 50 }] }, { allocations: [{ ...activity().allocations[0], affinities: [{ attribute: 'creativity', percent: 100 }] }], invalidField: true }]) {
    await assertFails(commit(db, [wire('activities', { ...activity(), ...patch })]));
  }
  await assertSucceeds(commit(db, [wire('activities', activity())]));
  await assertFails(commit(db, [wire('activities', { ...activity(), revision: 2, note: 'x'.repeat(50001) }, 2, 'command-2')]));
});
test('ranked affinity grammar rejects invalid ranks, wrong totals and malformed numeric values', async () => {
  const db = account(); const valid = wire('skills', skill());
  for (const affinities of ['720:1:100:0','-1:1:100:0','00:1:100:0','0:1:99:0','0:2:100.002:0','0:2:100.00100000001:0','0:2:NaN:0','0:7:100:0','0:1:100.0005:0','0:1:100.'+'0'.repeat(100)+'1:0','0:2:1e2:0','0:2:100:1e2','0:2:100:-1']) {
    await assertFails(commit(db, [{ ...valid, data: { ...valid.data, affinities } }]));
  }
});
test('allocation wire grammar rejects duplicate skills, unknown regions and wrong allocation sums', async () => {
  const db = account(); const valid = wire('activities', activity());
  for (const allocations of ['50|50#guitar~atelier~0:1:100:0;guitar~atelier~0:1:100:0','100#guitar~unknown~0:1:100:0','50#guitar~atelier~0:1:100:0','100#guitar~atelier~0:1:99:0','100#guitar~atelier~0:1:NaN:0','50|50#guitar~atelier~0:1:100:0','100#guitar~atelier~720:1:100:0']) {
    await assertFails(commit(db, [{ ...valid, data: { ...valid.data, allocations } }]));
  }
});
test('two-skill effort with historical two-attribute affinities remains synchronizable', async () => {
  const db = account();
  const allocations = [
    { skillId: 'guitar', percent: 70, regionId: 'atelier', affinities: skill().affinities },
    { skillId: 'reading', percent: 30, regionId: 'observatory', affinities: [{ attribute: 'wisdom', percent: 60 }, { attribute: 'intelligence', percent: 40 }] },
  ];
  await assertSucceeds(commit(db, [wire('activities', { ...activity(), allocations })]));
});
test('six-attribute custom skill remains synchronizable', async () => {
  const db = account(); const attributes = ['strength', 'intelligence', 'wisdom', 'discipline', 'creativity', 'charisma'];
  const affinities = attributes.map((attribute, index) => ({ attribute, percent: index === 5 ? 20 : 16 }));
  await assertSucceeds(commit(db, [wire('skills', { ...skill(), affinities })]));
});
for (const count of [2, 8]) test(`${count} skills with all six affinities remain synchronizable`, async () => {
  const attributes = ['strength', 'intelligence', 'wisdom', 'discipline', 'creativity', 'charisma'];
  const affinities = attributes.map((attribute, index) => ({ attribute, percent: index === 5 ? 20 : 16 }));
  const allocations = Array.from({ length: count }, (_, index) => ({ skillId: `skill-${index}`, percent: 100 / count, regionId: 'atelier', affinities }));
  await assertSucceeds(commit(account(), [wire('activities', { ...activity(), allocations })]));
});
test('profile optional experience and sound preferences accept legacy profiles and reject invalid values', async () => {
  const db = account();
  const experience = { version: 1, dismissedProjectIds: [], keepsakeSlots: [null, null, null, null, null, null], focusMode: 'practice', focusMinutes: 25 };
  const audio = { version: 1, preset: 'silent', musicEnabled: false, musicVolume: .2, musicChoice: 'regional', ambienceEnabled: false, ambienceVolume: .1, ambienceChoice: 'forest', interfaceEnabled: false, milestonesEnabled: false };
  await assertFails(commit(db, [wire('profile', { ...profile(), experience: { ...experience, focusMinutes: 0 } })]));
  await assertFails(commit(db, [wire('profile', { ...profile(), audio: { ...audio, musicVolume: 5 } })]));
  await assertSucceeds(commit(db, [wire('profile', { ...profile(), experience, audio })]));
});
test('400-record command fits the shared document access budget', async () => {
  const db = account();
  await assertSucceeds(commit(db, Array.from({ length: 400 }, (_, index) => wire('skills', skill(`skill-${index}`)))));
  const results = await assertSucceeds(getDocs(query(collection(db, 'users', 'alice', 'records'), where('sequence', '>', 0), where('sequence', '<=', 1), orderBy('sequence'), limit(200))));
  assert.equal(results.size, 200);
});
test('100-objective project and its linked quests can be saved atomically', async () => {
  const db = account(); const project = fixtures.projects();
  project.objectives = Array.from({ length: 100 }, (_, index) => ({ id: `step-${index}`, title: `Step ${index}`, completed: false, required: true }));
  const records = [wire('projects', project), ...project.objectives.map(objective => wire('quests', { ...fixtures.quests(), id: `quest-${objective.id}`, projectId: project.id, objectiveId: objective.id }))];
  await assertSucceeds(commit(db, records));
  const results = await assertSucceeds(getDocs(query(collection(db, 'users', 'alice', 'records'), limit(200))));
  assert.equal(results.size, 101);
});
test('receipt key count is bounded and ordinary unbounded collection lists are denied', async () => {
  const db = account();
  const records = Array.from({ length: 401 }, (_, index) => wire('skills', skill(`skill-${index}`)));
  await assertFails(commit(db, records));
  await assertSucceeds(commit(db, [wire('skills', skill())]));
  await assertFails(getDocs(collection(db, 'users', 'alice', 'records')));
  await assertFails(getDocs(query(collection(db, 'users', 'alice', 'records'), limit(201))));
});
test('ordinary removal uses tombstones; hard deletion requires frozen deletion state', async () => {
  const db = account(); await assertSucceeds(commit(db, [wire('skills', skill())]));
  await assertFails(deleteDoc(path(db, 'alice', 'records', 'skills:guitar')));
  await assertSucceeds(commit(db, [wire('skills', { ...skill(), revision: 2, deleted: true }, 2, 'command-2')]));
  await assertFails(commit(db, [wire('profile', { ...profile(), deleted: true }, 3, 'command-3')]));
});
test('deletion freezes uploads, allows revoked-owner cleanup, and cannot be reopened', async () => {
  const db = account(); await assertSucceeds(commit(db, [wire('skills', skill())]));
  await seed(admin => setDoc(doc(admin, 'access', 'alice'), { enabled: false }));
  await assertSucceeds(setDoc(path(db, 'alice', 'state', 'main'), { sequence: 1, commandId: 'command-1', deleting: true }));
  await assertSucceeds(getDocs(query(collection(db, 'users', 'alice', 'records'), limit(200))));
  await assertFails(setDoc(path(db, 'alice', 'state', 'main'), { sequence: 1, commandId: 'command-1', deleting: false }));
  await assertFails(commit(db, [wire('skills', { ...skill(), revision: 2 }, 2, 'command-2')]));
  await assertSucceeds(deleteDoc(path(db, 'alice', 'records', 'skills:guitar')));
  await assertSucceeds(deleteDoc(path(db, 'alice', 'commands', 'command-1')));
  await assertFails(deleteDoc(path(db, 'alice', 'state', 'main')));
});
test('empty account can enter deletion while synchronization is paused', async () => {
  const db = account('charlie');
  await seed(admin => setDoc(doc(admin, 'access', 'charlie'), { enabled: false }));
  await assertSucceeds(setDoc(path(db, 'charlie', 'state', 'main'), { sequence: 0, commandId: 'deletion', deleting: true }));
});
