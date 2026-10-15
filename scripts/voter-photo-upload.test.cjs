const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

class Multipart {
  parts = [];
  append(...args) { this.parts.push(args); }
}
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, console, FormData: Multipart, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

function nativeUploader(size = 1024) {
  const calls = { renders: 0, deleted: 0 };
  const image = { width: 3000, height: 2000, saveAsync: async options => {
    calls.save = options;
    return { uri: 'file:///cache/converted.jpg' };
  } };
  const context = { renderAsync: async () => { calls.renders++; return image; }, resize: dimensions => { calls.resize = dimensions; } };
  const module = load('src/services/voter-photo-upload.native.ts', {
    'expo-file-system': { File: class {
      constructor(uri) { this.uri = uri; this.exists = true; this.size = size; }
      delete() { calls.deleted++; this.exists = false; }
    } },
    'expo-image-manipulator': { ImageManipulator: { manipulate: uri => { calls.source = uri; return context; } }, SaveFormat: { JPEG: 'jpeg' } },
  });
  return { ...module, calls };
}

test('native photo upload converts to JPEG and appends explicit RN file metadata', async () => {
  const uploader = nativeUploader();
  const form = new Multipart();
  const cleanup = await uploader.appendVoterPhoto(form, 'file:///photos/IMG.HEIC');
  assert.equal(uploader.calls.source, 'file:///photos/IMG.HEIC');
  assert.equal(uploader.calls.save.format, 'jpeg');
  assert.equal(uploader.calls.resize.width, 1600);
  assert.equal(form.parts[0].length, 2);
  assert.equal(form.parts[0][0], 'voterPhotoFile');
  assert.deepEqual(Object.keys(form.parts[0][1]), ['uri', 'name', 'type']);
  assert.equal(form.parts[0][1].uri, 'file:///cache/converted.jpg');
  assert.equal(form.parts[0][1].type, 'image/jpeg');
  assert.equal(uploader.calls.deleted, 0);
  cleanup();
  assert.equal(uploader.calls.deleted, 1);
});

test('empty or oversized images never reach multipart upload', async () => {
  for (const size of [0, 5 * 1024 * 1024 + 1]) {
    const uploader = nativeUploader(size);
    const form = new Multipart();
    await assert.rejects(uploader.appendVoterPhoto(form, 'file:///photo'), /valid image/);
    assert.equal(form.parts.length, 0);
    assert.equal(uploader.calls.deleted, 1);
  }
});

const voter = { id: 'hoshiarpur_voters:doc', voterKey: 'hoshiarpur_voters:doc', name: 'Example', age: 31, gender: 'Female', photoUri: 'file:///photos/local.jpg' };
function voters(api, upload) {
  return load('src/services/voters.ts', {
    './api': { api },
    './authentication': { ensureAuthSession: async () => ({ user: {} }), getCurrentUser: () => ({}) },
    './voter-photo-upload': { appendVoterPhoto: upload },
    '@/utils/voterCreation': load('src/utils/voterCreation.ts'),
    '@/utils/electionVoting': load('src/utils/electionVoting.ts'),
  });
}

test('successful save returns the confirmed remote photo URL and cleans temporary image', async () => {
  let cleaned = false;
  const service = voters({
    get: async () => ({ data: { data: { star: null } } }),
    put: async (url, form) => {
      assert.equal(url, '/voter-stars/hoshiarpur_voters%3Adoc');
      assert.ok(form.parts.some(part => part[0] === 'voterPhotoFile'));
      assert.equal(cleaned, false);
      return { data: { success: true, data: { star: { photoUri: 'https://example.com/photo.jpg' } } } };
    },
  }, async form => { form.append('voterPhotoFile', { uri: 'file:///cache/converted.jpg', name: 'voter-photo.jpg', type: 'image/jpeg' }); return () => { cleaned = true; }; });
  const saved = await service.updateVoterDetails(voter);
  assert.equal(saved.photoUri, 'https://example.com/photo.jpg');
  assert.equal(cleaned, true);
  assert.equal(voter.photoUri, 'file:///photos/local.jpg');
});

test('failed upload cleans temporary image and leaves selected voter unchanged', async () => {
  let cleaned = false;
  const service = voters({
    get: async () => ({ data: {} }),
    put: async () => { throw new Error('Input Buffer is empty'); },
  }, async () => () => { cleaned = true; });
  const original = { ...voter, photoUri: 'https://example.com/old.jpg' };
  service.setSelectedVoter(original);
  await assert.rejects(service.updateVoterDetails(voter), /Input Buffer is empty/);
  assert.equal(cleaned, true);
  assert.equal(service.getSelectedVoter().photoUri, original.photoUri);
});

test('upload without a confirmed server URL does not report success', async () => {
  const service = voters({ get: async () => ({ data: {} }), put: async () => ({ data: { success: true } }) }, async () => () => {});
  await assert.rejects(service.updateVoterDetails(voter), /did not confirm/);
});
