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
    './api': { api: { get: async () => assert.fail('Creation must use backend validation without fetching voter lists'), ...api } },
    './authentication': {
      ensureAuthSession: async () => ({ user }), getCurrentUser: () => user,
      hasPoliticianPageAccess: () => true,
    },
    './voter-photo-upload': {}, '@/utils/voterCreation': creation,
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

test('sends the complete location scope to backend validation', async () => {
  let request;
  await voters({ post: async (url, payload) => {
    request = { url, payload };
    return { data: { success: true, data: { voter: { id: fullId } } } };
  } }).createVoter({ ...form, epicNo: ' rew 0893909 ' });
  assert.equal(request.url, '/politician/dashboard/create-voter');
  for (const field of ['state', 'district', 'city', 'village', 'boothNo', 'ward']) {
    assert.equal(request.payload[field], form[field]);
  }
  assert.equal(request.payload.epicNo, 'REW0893909');
});

test('preserves backend HTTP errors so the form can display the server message', async () => {
  for (const [status, message] of [
    [400, 'State, district, city and booth number are required'],
    [403, 'Politicians can only add voters within their assigned area'],
    [409, 'EPIC already exists in this city, booth and ward'],
    [500, 'Unable to add voter'],
  ]) {
    const failure = { response: { status, data: { success: false, message } } };
    await assert.rejects(voters({ post: async () => { throw failure; } }).createVoter(form),
      error => error === failure && error.response.data.message === message);
  }
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

test('creation accepts optional form details and validates WhatsApp separately from phone', async () => {
  assert.equal(creation.validateNewVoter({ ...form, whatsappNumber: '' }, user), '');
  assert.match(creation.validateNewVoter({ ...form, whatsappNumber: '123' }, user), /WhatsApp/);
  const details = {
    whatsappNumber: '9876543210', serialNo: '123', education: 'Graduate',
    working: 'Teacher', economicCategory: 'BPL', socialCategory: 'OBC', rationCategory: 'PHH',
  };
  await voters({ post: async (url, payload) => {
    for (const [key, value] of Object.entries(details)) assert.equal(payload[key], value);
    assert.equal(payload.phone, '');
    return { data: { success: true, data: { voter: { id: fullId } } } };
  } }).createVoter({ ...form, ...details });
});

test('new voter result is consumed once and cannot cross user accounts', () => {
  const results = load('src/features/voters/voter-creation-result.ts');
  const voter = { id: fullId };
  results.setCreatedVoter(user.id, voter);
  assert.equal(results.takeCreatedVoter(user.id), voter);
  assert.equal(results.takeCreatedVoter(user.id), null);
  results.setCreatedVoter(user.id, voter);
  assert.equal(results.takeCreatedVoter('another-user'), null);
  assert.equal(results.takeCreatedVoter(user.id), null);
});
