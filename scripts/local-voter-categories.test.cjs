const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
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

// Run the application's schema, migrations and queries against real SQLite.
// Only the Expo native bridge and device key storage are replaced in this test.
function storage(filename, platform = 'android') {
  const sqlite = new DatabaseSync(filename);
  const params = args => Array.isArray(args[0]) ? args[0] : args;
  const bridge = {
    execAsync: async sql => sqlite.exec(sql),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...params(args)),
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...params(args)) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...params(args)),
    withTransactionAsync: async callback => {
      sqlite.exec('BEGIN');
      try {
        await callback();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const database = load('src/services/voter-database.native.ts', {
    'expo-crypto': {},
    'expo-secure-store': { getItemAsync: async () => '00'.repeat(32) },
    'expo-sqlite': { openDatabaseAsync: async () => bridge },
    'react-native': { Platform: { OS: platform } },
  });
  return {
    local: load('src/services/local-voters.native.ts', { './voter-database': database }),
    sqlite,
    close: () => sqlite.close(),
  };
}

const politicianId = 'politician-1';
const voter = {
  id: 'hoshiarpur_voters:6a3cc039647774362343eb87',
  name: 'Aanchal', gender: 'Female', age: 47, guardian: 'Example',
  epicNo: 'BDP2165751', houseNo: '363', booth: 'Booth-117',
  district: 'Hoshiarpur', state: 'Punjab',
};
const categories = { economicCategory: 'IRDP', socialCategory: 'OBC', rationCategory: 'AAY' };
function assertCategories(actual, expected = categories) {
  for (const key of Object.keys(categories)) assert.equal(actual[key], expected[key], key);
}

function remoteService(api) {
  return load('src/services/voters.ts', {
    './api': { api },
    './authentication': {
      ensureAuthSession: async () => ({ user: { id: politicianId } }),
      getCurrentUser: () => ({ id: politicianId }),
      hasPoliticianPageAccess: () => true,
    },
    './voter-photo-upload': {},
    '@/utils/voterCreation': load('src/utils/voterCreation.ts'),
    '@/utils/electionVoting': load('src/utils/electionVoting.ts'),
  });
}

test('edit categories persist in SQLite across reopen and a paginated server refresh', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voter-categories-'));
  let store = storage(path.join(directory, 'voters.db'));
  t.after(() => { store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  await store.local.replaceLocalVoters(politicianId, [voter]);
  let serverVoter = voter;
  const remote = remoteService({
    get: async url => {
      if (url.startsWith('/voter-stars/')) return { data: { data: { star: null } } };
      assert.equal(url, '/politician/voters/assigned-data');
      return { data: { voters: [{ id: voter.id, voterData: serverVoter }], total: 1 } };
    },
    put: async (url, payload) => {
      assert.equal(url, `/voter-stars/${encodeURIComponent(voter.id)}`);
      assertCategories(payload);
      serverVoter = { ...voter, ...categories };
      return { data: { success: true } };
    },
  });
  // Same sequence as the edit screen: save remotely, then write the result locally.
  const saved = await remote.updateVoterDetails({ ...voter, ...categories });
  await store.local.updateLocalVoter(politicianId, saved);
  assertCategories((await store.local.getLocalVoterPage(politicianId)).voters[0]);
  store.close();
  store = storage(path.join(directory, 'voters.db'));
  assertCategories((await store.local.getLocalVoterPage(politicianId)).voters[0]);
  await store.local.replaceLocalVotersFromPages(politicianId, savePage => remote.forEachVoterPage({}, savePage));
  assertCategories((await store.local.getLocalVoterPage(politicianId)).voters[0]);
  // Explicitly clearing the selections also persists, rather than restoring old values.
  const cleared = Object.fromEntries(Object.keys(categories).map(key => [key, '']));
  await store.local.updateLocalVoter(politicianId, { ...saved, ...cleared });
  assertCategories((await store.local.getLocalVoterPage(politicianId)).voters[0], cleared);
});

test('older voter databases gain category columns without losing cached voters', async t => {
  const store = storage(':memory:');
  t.after(store.close);
  await store.local.replaceLocalVoters(politicianId, [voter]);
  // Recreate the schema state of an installation predating these three fields.
  for (const column of ['economic_category', 'social_category', 'ration_category', 'whatsapp_number']) {
    store.sqlite.exec(`ALTER TABLE voters DROP COLUMN ${column}`);
  }
  const database = load('src/services/voter-database.native.ts', {
    'expo-crypto': {},
    'expo-secure-store': { getItemAsync: async () => '00'.repeat(32) },
    'expo-sqlite': { openDatabaseAsync: async () => ({
      execAsync: async sql => store.sqlite.exec(sql),
      getAllAsync: async sql => store.sqlite.prepare(sql).all(),
    }) },
    'react-native': { Platform: { OS: 'android' } },
  });
  await database.getVoterDatabase();
  assert.equal((await store.local.getLocalVoterPage(politicianId)).voters[0].name, voter.name);
  assert.equal((await store.local.getLocalVoterPage(politicianId)).voters[0].whatsappNumber, '');
  await store.local.updateLocalVoter(politicianId, { ...voter, whatsappNumber: '9876543210' });
  assert.equal((await store.local.getLocalVoterPage(politicianId)).voters[0].whatsappNumber, '9876543210');
  await store.local.updateLocalVoter(politicianId, { ...voter, ...categories });
  assertCategories((await store.local.getLocalVoterPage(politicianId)).voters[0]);
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: WhatsApp number survives sync, edit and database reopen`, async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voter-whatsapp-'));
    const filename = path.join(directory, 'voters.db');
    let store = storage(filename, platform);
    t.after(() => { store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    const read = async () => (await store.local.getLocalVoterPage(politicianId)).voters[0];
    await store.local.replaceLocalVoters(politicianId, [{ ...voter, whatsappNumber: '9876543210' }]);
    assert.equal((await read()).whatsappNumber, '9876543210');
    await store.local.updateLocalVoter(politicianId, { ...await read(), whatsappNumber: '9123456780' });
    store.close();
    store = storage(filename, platform);
    assert.equal((await read()).whatsappNumber, '9123456780');
    await store.local.replaceLocalVotersFromPages(politicianId, async savePage => {
      await savePage([{ ...voter, whatsappNumber: '9988776655' }]);
      return 1;
    });
    assert.equal((await read()).whatsappNumber, '9988776655');
    await store.local.updateLocalVoter(politicianId, { ...await read(), whatsappNumber: '' });
    assert.equal((await read()).whatsappNumber, '');
    await store.local.addLocalVoter(politicianId, { ...voter, id: 'new-voter', whatsappNumber: '9876543210' });
    const page = await store.local.getLocalVoterPage(politicianId);
    assert.equal(page.voters.find(item => item.id === 'new-voter').whatsappNumber, '9876543210');
  });
}
