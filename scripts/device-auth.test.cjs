const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

function fixture(store = new Map()) {
  const cache = new Map();
  const notices = [];
  let databaseDeletes = 0;
  let transport = async () => ({ data: { success: true } });
  let requestHook;
  let rejectHook;
  const client = {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: hook => { requestHook = hook; } },
      response: { use: (_, hook) => { rejectHook = hook; } },
    },
    post: (url, data, config) => request(url, { ...config, data, method: 'post' }),
    get: (url, config) => request(url, { ...config, method: 'get' }),
  };
  async function request(url, options = {}) {
    const config = await requestHook({ ...options, url, headers: { ...client.defaults.headers.common, ...options.headers } });
    try { return await transport(config); }
    catch (failure) { failure.config = config; return rejectHook(failure); }
  }
  const secureStore = {
    getItemAsync: async key => store.get(key) || null,
    setItemAsync: async (key, value) => { store.set(key, value); },
    deleteItemAsync: async key => { store.delete(key); },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      exports, __DEV__: false, process: { env: {} },
      console: { log() {} }, URL, Promise,
      require(name) {
        if (name === 'expo-secure-store') return secureStore;
        if (name === 'expo-crypto') return { randomUUID };
        if (name === 'expo-device') return { manufacturer: 'Test', modelName: 'Phone' };
        if (name.endsWith('/getSimPhoneNumber')) return { getSimPhoneNumber: async () => null };
        if (name === 'react-native') return { Platform: { OS: 'android', Version: 36 } };
        if (name === 'axios') return { create: () => client };
        if (name === './voter-database') return { deleteVoterDatabase: async () => { databaseDeletes++; } };
        const resolved = `src/services/${name.replace('./', '')}.ts`;
        if (fs.existsSync(resolved)) return load(resolved);
        throw new Error(`Unexpected dependency: ${name}`);
      },
    }, { filename: file });
    return exports;
  }
  const auth = load('src/services/authentication.ts');
  const api = load('src/services/api.ts');
  const identity = load('src/services/device-identity.ts');
  load('src/services/auth-session-events.ts').subscribeAuthSession(notice => notices.push(notice));
  const user = { id: 'test-user', name: 'Test', phone: '9876543210', role: 'politician' };
  function signedIn(token = 'current-token') { auth.setAuthSession(token, user); }
  return { auth, api, identity, store, notices, user, signedIn, setTransport(value) { transport = value; }, get databaseDeletes() { return databaseDeletes; } };
}
const error = (status, code, message = code, contactToken) => ({ response: { status, data: { code, message, contactToken } } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('installation UUID persists across restarts and concurrent identity requests', async () => {
  const f = fixture();
  const values = await Promise.all([f.identity.getDeviceIdentity(), f.identity.getDeviceIdentity()]);
  assert.equal(values[0].deviceId, values[1].deviceId);
  assert.equal(values[0].deviceName, 'Test Phone');
  const restarted = fixture(f.store);
  assert.equal((await restarted.identity.getDeviceIdentity()).deviceId, values[0].deviceId);
});

test('login sends installation metadata and persists the returned session', async () => {
  const f = fixture();
  let sent;
  f.setTransport(async config => { sent = config; return { data: { data: { token: 'new-token', user: f.user } } }; });
  await f.auth.loginPolitician({ phone: '9876543210', password: 'secret' });
  assert.equal(sent.url, '/auth/login');
  assert.equal(sent.data.deviceId, f.store.get('politicEase.installationId'));
  assert.ok(sent.data.deviceName);
  assert.equal(f.store.get('votersakha.authToken'), 'new-token');
});

test('device limit errors retain their code and message without endpoint retries', async () => {
  const f = fixture();
  let requests = 0;
  f.setTransport(async () => { requests++; throw error(403, 'DEVICE_LIMIT_REACHED', 'Five devices are already signed in.', 'contact-proof'); });
  await assert.rejects(f.auth.loginPolitician({ phone: '9876543210', password: 'secret' }), failure =>
    failure.code === 'DEVICE_LIMIT_REACHED' && failure.message.includes('Five devices') && failure.contactToken === 'contact-proof');
  assert.equal(requests, 1);
  assert.equal(await f.api.getApiAuthToken(), null);
});

test('logout waits for the server, frees local credentials and keeps installation identity', async () => {
  const f = fixture();
  const identity = await f.identity.getDeviceIdentity();
  f.signedIn();
  await f.api.waitForAuthTokenStorage();
  let finish;
  f.setTransport(config => { assert.equal(config.url, '/auth/logout'); return new Promise(resolve => { finish = resolve; }); });
  const pending = f.auth.logoutPolitician();
  await tick();
  assert.equal(f.auth.getAuthToken(), 'current-token');
  finish({ data: { success: true } });
  assert.equal(await pending, true);
  assert.equal(f.auth.getCurrentUser(), null);
  assert.equal(f.store.has('votersakha.authToken'), false);
  assert.equal(f.store.has('votersakha.authUser'), false);
  assert.equal(f.store.get('politicEase.installationId'), identity.deviceId);
  assert.equal(f.databaseDeletes, 1);
});

test('offline logout reports failure and retains the session', async () => {
  const f = fixture(); f.signedIn();
  f.setTransport(async () => { throw new Error('Network unavailable'); });
  assert.equal(await f.auth.logoutPolitician(), false);
  assert.equal(f.auth.getAuthToken(), 'current-token');
  assert.equal(f.databaseDeletes, 0);
  assert.equal(f.notices[0].invalidated, false);
  assert.match(f.notices[0].message, /not been released/);
});

test('logout requires explicit server confirmation before clearing credentials', async () => {
  const f = fixture(); f.signedIn();
  f.setTransport(async () => ({ data: { success: false } }));
  assert.equal(await f.auth.logoutPolitician(), false);
  assert.equal(f.auth.getAuthToken(), 'current-token');
  assert.equal(f.databaseDeletes, 0);
});

for (const code of ['SESSION_INVALIDATED', 'DEVICE_SESSION_REVOKED']) {
  test(`${code} clears credentials and publishes a login notice`, async () => {
    const f = fixture(); f.signedIn();
    f.setTransport(async () => { throw error(401, code); });
    await assert.rejects(f.api.api.get('/protected'));
    assert.equal(f.auth.getAuthToken(), null);
    assert.equal(f.auth.getCurrentUser(), null);
    assert.equal(f.store.has('votersakha.authToken'), false);
    assert.equal(f.databaseDeletes, 1);
    assert.equal(f.notices[0].invalidated, true);
  });
}

test('transient server failures do not clear credentials', async () => {
  const f = fixture(); f.signedIn();
  f.setTransport(async () => { throw error(503, undefined, 'Please try again'); });
  await assert.rejects(f.api.api.get('/protected'));
  assert.equal(f.auth.getAuthToken(), 'current-token');
  assert.equal(f.notices.length, 0);
});

test('a late revoked response from an older token cannot clear a new login', async () => {
  const f = fixture(); f.signedIn('old-token');
  let reject;
  f.setTransport(() => new Promise((_, fail) => { reject = fail; }));
  const pending = f.api.api.get('/protected');
  await tick();
  f.signedIn('new-token');
  reject(error(401, 'DEVICE_SESSION_REVOKED'));
  await assert.rejects(pending);
  assert.equal(f.auth.getAuthToken(), 'new-token');
  assert.equal(f.notices.length, 0);
});

test('serialized token writes cannot restore a token after local cleanup', async () => {
  const f = fixture();
  f.signedIn('one'); f.signedIn('two');
  await f.auth.clearLocalAuthSession();
  assert.equal(f.store.has('votersakha.authToken'), false);
  assert.equal(f.store.has('votersakha.authUser'), false);
});

test('late logout completion cannot clear a newer login', async () => {
  const f = fixture(); f.signedIn('old-token');
  let finish;
  f.setTransport(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.auth.logoutPolitician();
  await tick();
  f.signedIn('new-token');
  finish({ data: { success: true } });
  await pending;
  assert.equal(f.auth.getAuthToken(), 'new-token');
  assert.equal(f.databaseDeletes, 0);
});

test('late profile response cannot restore a user after session cleanup', async () => {
  const f = fixture(); f.signedIn();
  let finish;
  f.setTransport(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.auth.refreshCurrentUser();
  await tick();
  await f.auth.clearLocalAuthSession();
  finish({ data: { data: { user: f.user } } });
  await assert.rejects(pending, /sign in again/);
  assert.equal(f.auth.getCurrentUser(), null);
  assert.equal(f.store.has('votersakha.authUser'), false);
});
