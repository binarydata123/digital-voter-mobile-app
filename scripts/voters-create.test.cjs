const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
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
const creation = load('src/utils/voterCreation.ts');
const user = {
  id: 'actor', role: 'politician', state: 'Punjab', district: 'Hoshiarpur',
  states: ['Punjab'], districts: ['Hoshiarpur'], cities: ['Hoshiarpur'],
  villages: ['Village A'], assignedBooths: ['Booth-006'], ward: 'Ward 2',
};
const form = { ...creation.newVoterForm(user), epicNo: 'rew0893909', nameEnglish: 'Example', gender: 'Female', age: '31' };
const fullId = 'hoshiarpur_voters:6a3cc039647774362343eb87';
function voters(api) {
  return load('src/services/voters.ts', {
    './api': { api },
    './authentication': {
      ensureAuthSession: async () => ({ user }), getCurrentUser: () => user,
      hasPoliticianPageAccess: () => true,
    },
    './background-removal-file': {}, '@/utils/voterCreation': creation,
    '@/utils/electionVoting': load('src/utils/electionVoting.ts'),
  });
}

test('defaults location to profile assignments, preferring assigned arrays', () => {
  const defaults = creation.newVoterForm({ ...user, state: 'Unassigned state' });
  for (const field of ['state', 'district', 'city', 'village', 'boothNo', 'ward']) {
    assert.equal(defaults[field], form[field]);
  }
  assert.equal(creation.validateNewVoter(form, user), '');
});

test('rejects locations outside the assignment and accounts with missing scope', () => {
  for (const field of ['state', 'district', 'city', 'village', 'boothNo', 'ward']) {
    assert.match(creation.validateNewVoter({ ...form, [field]: 'Elsewhere' }, user), /assigned area/);
  }
  assert.match(creation.validateNewVoter(form, { ...user, districts: [], district: '' }), /assigned state and district/);
});

test('validates required fields, voter age and real dates of birth', () => {
  for (const patch of [{ epicNo: '' }, { nameEnglish: '' }, { gender: '' }, { age: '17' }, { age: '131' }, { age: '31.5' }, { dob: '2000-02-30' }, { dob: '2999-01-01' }, { relation: 'Father', relationName: '' }]) {
    assert.notEqual(creation.validateNewVoter({ ...form, ...patch }, user), '');
  }
  assert.equal(creation.getAgeFromVoterDob('2000-10-16', new Date(2026, 9, 15)), 25);
  assert.equal(creation.getAgeFromVoterDob('2000-10-15', new Date(2026, 9, 15)), 26);
  const dob = '1995-03-04';
  assert.equal(creation.validateNewVoter({ ...form, dob, age: String(creation.getAgeFromVoterDob(dob)) }, user), '');
});

test('creates via the politician endpoint and maps the returned document', async () => {
  let request;
  const service = voters({ post: async (url, payload) => {
    request = { url, payload };
    return { data: { success: true, data: { voter: {
      id: fullId, voterKey: 'short', voter_name_english: payload.nameEnglish,
      voter_gender: payload.gender, voter_age: payload.age, epic_no: payload.epicNo,
      booth_id: payload.boothNo, state: payload.state, district: payload.district,
    } } } };
  } });
  const result = await service.createVoter({ ...form, nameEnglish: ' Example ' });
  assert.equal(request.url, '/politician/dashboard/create-voter');
  assert.equal(request.payload.nameEnglish, 'Example');
  assert.equal(request.payload.epicNo, 'REW0893909');
  assert.equal(request.payload.boothNo, 'Booth-006');
  assert.equal(result.id, fullId);
  assert.equal(result.voterKey, fullId);
  assert.equal(result.name, 'Example');
  assert.equal(result.age, 31);
  assert.equal(result.booth, 'Booth-006');
});

test('invalid locations never POST; duplicate/server errors remain failures', async () => {
  await assert.rejects(voters({ post: async () => assert.fail('Invalid location must not POST') }).createVoter({ ...form, district: 'Elsewhere' }), /assigned area/);
  await assert.rejects(voters({ post: async () => ({ data: { success: false, message: 'EPIC already exists' } }) }).createVoter(form), /EPIC already exists/);
});

test('native creation adds a search record and increments cache count only once', async () => {
  const writes = [];
  let existing = null;
  const database = {
    withTransactionAsync: async callback => callback(),
    getFirstAsync: async () => existing,
    runAsync: async (sql, ...args) => { writes.push({ sql, args }); },
  };
  const local = load('src/services/local-voters.native.ts', {
    './voter-database': { getVoterDatabase: async () => database },
  });
  const voter = { id: fullId, name: 'Example', gender: 'Female', age: 31, booth: 'Booth-006', epicNo: form.epicNo, houseNo: '', guardian: '' };
  await local.addLocalVoter(user.id, voter);
  existing = { voter_id: fullId };
  await local.addLocalVoter(user.id, voter);
  assert.equal(writes.filter(write => write.sql.includes('voter_count = voter_count + 1')).length, 1);
  assert.equal(writes.filter(write => write.sql.includes('INSERT INTO voter_search')).length, 2);
  for (const write of writes.filter(write => write.sql.includes('INSERT OR REPLACE INTO voters'))) {
    assert.equal((write.sql.match(/\?/g) || []).length, write.args[0].length);
    assert.equal(write.args[0][0], user.id);
  }
});
