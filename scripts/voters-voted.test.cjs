const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, console, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

const fullKey = 'hoshiarpur_voters:6a3cc039647774362343eb87';
const voter = { id: fullKey, voterKey: 'v105954', name: 'Example', district: 'Hoshiarpur', epicNo: 'ABC123', age: 31, gender: 'Female' };
const electionVoting = load('src/utils/electionVoting.ts', {});
function service(api, electionDate = electionVoting.getIndiaCalendarDate()) {
  return load('src/services/voters.ts', {
    './api': { api },
    './authentication': {
      ensureAuthSession: async () => ({ user: {} }),
      getCurrentUser: () => ({}),
      hasPoliticianPageAccess: () => true,
      refreshCurrentUser: async () => ({ electionDate }),
    },
    './voter-photo-upload': {},
    '@/utils/voterCreation': load('src/utils/voterCreation.ts', {}),
    '@/utils/electionVoting': electionVoting,
  });
}

test('allows marking only on the election day in India, including midnight boundaries', () => {
  const check = electionVoting.getElectionVotingError;
  assert.equal(check('2026-10-15', new Date('2026-10-15T04:30:00Z')), '');
  assert.match(check('2026-10-26', new Date('2026-10-15T04:30:00Z')), /only.*2026-10-26/);
  assert.match(check('2026-10-15', new Date('2026-10-14T18:29:59Z')), /only/);
  assert.equal(check('2026-10-15', new Date('2026-10-14T18:30:00Z')), '');
  assert.equal(check('2026-10-15', new Date('2026-10-15T18:29:59Z')), '');
  assert.match(check('2026-10-15', new Date('2026-10-15T18:30:00Z')), /only/);
  for (const date of [null, undefined, '', 'invalid', '2026-02-30']) assert.match(check(date), /not set/);
});

test('blocked election dates never fetch a star or send an update', async () => {
  const api = { get: async () => assert.fail('Must not fetch star'), put: async () => assert.fail('Must not update voter') };
  for (const date of ['2099-10-26', '2000-10-15', null, 'invalid']) {
    await assert.rejects(service(api, date).markVoterAsVoted(voter), /election date/);
  }
});

test('election-day print saves voted true and preserves existing star details', async () => {
  let payload;
  const updated = await service({
    get: async () => ({ data: { data: { star: { stanceKey: 'favorable', notes: 'Keep' } } } }),
    put: async (_, body) => { payload = body; return { data: { success: true } }; },
  }).markPrintedVoterAsVoted({ ...voter, voted: false });
  assert.equal(payload.voted, true);
  assert.equal(payload.notes, 'Keep');
  assert.equal(payload.stanceKey, 'favorable');
  assert.equal(updated.voted, true);
});

test('prints outside election day or without election date leave voted unchanged', async () => {
  const original = { ...voter, voted: false };
  const api = { get: async () => assert.fail('Must not fetch star'), put: async () => assert.fail('Must not update voted') };
  for (const date of ['2099-10-26', '2000-10-15', null, 'invalid']) {
    assert.equal(await service(api, date).markPrintedVoterAsVoted(original), null);
    assert.equal(original.voted, false);
  }
  assert.equal(await service(api).markPrintedVoterAsVoted({ ...voter, voted: true }), null);
});

test('failed voted save after print rejects without changing the input record', async () => {
  const original = { ...voter, voted: false };
  await assert.rejects(service({
    get: async () => ({ data: {} }),
    put: async () => { throw new Error('Connection lost'); },
  }).markPrintedVoterAsVoted(original), /Connection lost/);
  assert.equal(original.voted, false);
});

test('authentication keeps electionDate from login and refreshes profile changes', async () => {
  const auth = load('src/services/authentication.ts', {
    'expo-secure-store': { setItemAsync: async () => {} },
    'react-native': { Platform: { OS: 'android' } },
    './voter-database': {},
    './api': {
      setApiAuthToken: () => {},
      api: {
        post: async () => ({ data: { data: { token: 'token', user: { id: 'actor', role: 'politician', profile: { electionDate: '2026-10-15' } } } } }),
        get: async () => ({ data: { data: { user: { id: 'actor', role: 'politician', electionDate: '2026-10-26' } } } }),
      },
    },
  });
  assert.equal((await auth.loginPolitician({ phone: 'test', password: 'test' })).user.electionDate, '2026-10-15');
  assert.equal((await auth.refreshCurrentUser()).electionDate, '2026-10-26');
});

test('marks full voter key as voted and preserves existing star fields', async () => {
  let saved;
  const existing = { stanceKey: 'favorable', duplicateVote: true, dead: false, notes: 'Keep', mobileNumber: '123', photoUri: 'https://example.com/photo', voterPhone: '123' };
  const api = {
    get: async () => ({ data: { data: { star: existing } } }),
    put: async (url, payload) => { saved = { url, payload }; return { data: { success: true } }; },
  };
  const updated = await service(api).markVoterAsVoted(voter);
  assert.equal(saved.url, `/voter-stars/${encodeURIComponent(fullKey)}`);
  assert.equal(saved.payload.voted, true);
  assert.equal(saved.payload.voterDocumentId, '6a3cc039647774362343eb87');
  for (const [key, value] of Object.entries(existing)) assert.equal(saved.payload[key], value);
  assert.equal(updated.voted, true);
  assert.equal(updated.voterKey, fullKey);
});

test('creates a voted star when there is no existing star', async () => {
  let payload;
  await service({
    get: async () => { throw { response: { status: 404 } }; },
    put: async (_, body) => { payload = body; return { data: { success: true } }; },
  }).markVoterAsVoted(voter);
  assert.equal(payload.stanceKey, 'unassigned');
  assert.equal(payload.voted, true);
});

test('failed save and unresolved short IDs do not report voted success', async () => {
  const failed = service({
    get: async () => ({ data: {} }),
    put: async () => ({ data: { success: false, message: 'Denied' } }),
  });
  await assert.rejects(failed.markVoterAsVoted(voter), /Denied/);
  const unresolved = service({
    get: async () => ({ data: { voters: [] } }),
    put: async () => assert.fail('Must not save an unresolved voter'),
  });
  await assert.rejects(unresolved.markVoterAsVoted({ ...voter, id: 'short' }), /identifier is missing/);
  assert.equal(voter.voted, undefined);
});

test('reload normalizes true and false voted values correctly', async () => {
  const values = [true, false, 'true', 'false', 1, 0, undefined];
  const voters = await service({ get: async () => ({ data: { voters: values.map((voted, index) => ({ id: `hoshiarpur_voters:${index}`, voterData: { voted } })) } }) }).fetchVoters();
  assert.deepEqual(Array.from(voters, item => item.voted), [true, false, true, false, true, false, false]);
});

test('edited education, working and dropdown gender are saved and reloaded', async () => {
  let saved;
  const edited = { ...voter, voterKey: fullKey, education: ' Graduate ', working: ' Teacher ', gender: 'Female' };
  await service({
    get: async () => ({ data: { data: { star: null } } }),
    put: async (_, body) => { saved = body; },
  }).updateVoterDetails(edited);
  assert.equal(saved.education, 'Graduate');
  assert.equal(saved.working, 'Teacher');
  assert.equal(saved.gender, 'Female');
  const reloaded = await service({ get: async () => ({ data: { voters: [{ id: fullKey, voterData: { Education: saved.education, Working: saved.working, Gender: saved.gender } }] } }) }).fetchVoters();
  assert.equal(reloaded[0].education, 'Graduate');
  assert.equal(reloaded[0].working, 'Teacher');
  assert.equal(reloaded[0].gender, 'Female');
  await service({ get: async () => ({ data: {} }), put: async (_, body) => { saved = body; } }).updateVoterDetails({ ...edited, education: '', working: '' });
  assert.equal(saved.education, '');
  assert.equal(saved.working, '');
});

test('native cache inserts, updates and reads voted without losing SQL bindings', async () => {
  const writes = [];
  const db = {
    withTransactionAsync: async callback => callback(),
    runAsync: async (sql, ...args) => { writes.push({ sql, args }); },
    getFirstAsync: async () => ({ total: 1 }),
    getAllAsync: async () => [{ voter_id: fullKey, voted: 1, education: 'Graduate', working: 'Teacher' }],
  };
  const local = load('src/services/local-voters.native.ts', {
    './voter-database': { getVoterDatabase: async () => db, isLocalVoterDatabaseAvailable: () => true },
  });
  const cached = { ...voter, voted: true, education: 'Graduate', working: 'Teacher' };
  await local.replaceLocalVoters('actor', [cached]);
  await local.updateLocalVoter('actor', cached);
  const insert = writes.find(write => write.sql.includes('INSERT OR REPLACE INTO voters'));
  assert.equal((insert.sql.match(/\?/g) || []).length, insert.args[0].length);
  assert.equal(insert.args[0].at(-1), 1);
  assert.equal(insert.args[0].at(-3), 'Graduate');
  assert.equal(insert.args[0].at(-2), 'Teacher');
  const update = writes.find(write => write.sql.includes('UPDATE voters SET'));
  assert.equal((update.sql.match(/\?/g) || []).length, update.args.length);
  assert.equal(update.args.at(-3), 1);
  assert.equal(update.args.at(-5), 'Graduate');
  assert.equal(update.args.at(-4), 'Teacher');
  const restored = (await local.getLocalVoterPage('actor')).voters[0];
  assert.equal(restored.voted, true);
  assert.equal(restored.education, 'Graduate');
  assert.equal(restored.working, 'Teacher');
});
