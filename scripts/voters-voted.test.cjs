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
function service(api) {
  return load('src/services/voters.ts', {
    './api': { api },
    './authentication': {
      ensureAuthSession: async () => ({ user: {} }),
      getCurrentUser: () => ({}),
      hasPoliticianPageAccess: () => true,
    },
    './background-removal-file': {},
  });
}

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

test('native cache inserts, updates and reads voted without losing SQL bindings', async () => {
  const writes = [];
  const db = {
    withTransactionAsync: async callback => callback(),
    runAsync: async (sql, ...args) => { writes.push({ sql, args }); },
    getFirstAsync: async () => ({ total: 1 }),
    getAllAsync: async () => [{ voter_id: fullKey, voted: 1 }],
  };
  const local = load('src/services/local-voters.native.ts', {
    './voter-database': { getVoterDatabase: async () => db, isLocalVoterDatabaseAvailable: () => true },
  });
  await local.replaceLocalVoters('actor', [{ ...voter, voted: true }]);
  await local.updateLocalVoter('actor', { ...voter, voted: true });
  const insert = writes.find(write => write.sql.includes('INSERT OR REPLACE INTO voters'));
  assert.equal((insert.sql.match(/\?/g) || []).length, insert.args[0].length);
  assert.equal(insert.args[0].at(-1), 1);
  const update = writes.find(write => write.sql.includes('UPDATE voters SET'));
  assert.equal((update.sql.match(/\?/g) || []).length, update.args.length);
  assert.equal(update.args.at(-3), 1);
  assert.equal((await local.getLocalVoterPage('actor')).voters[0].voted, true);
});
