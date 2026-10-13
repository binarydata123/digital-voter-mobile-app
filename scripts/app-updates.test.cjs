const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/app-updates/manifest.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, URL });
const { parseManifest, isNewer } = exportsObject;
const manifest = { version: '1.0.1', versionCode: 2, apkUrl: 'https://example.com/app-2.apk', mandatory: false, releaseNotes: 'Fixes', sha256: 'a'.repeat(64) };
test('higher Android build prompts; same/lower code and invalid installed code do not', () => {
  assert.equal(isNewer(parseManifest(manifest), '1'), true);
  for (const build of ['2', '3', null, 'bad', '0']) assert.equal(isNewer(parseManifest(manifest), build), false);
});
test('optional and mandatory flags survive validation', () => {
  assert.equal(parseManifest(manifest).mandatory, false);
  assert.equal(parseManifest({ ...manifest, mandatory: true }).mandatory, true);
});
test('reject untrusted or malformed update metadata', () => {
  for (const patch of [{ apkUrl: 'http://example.com/app.apk' }, { apkUrl: 'file:///tmp/a.apk' }, { apkUrl: 'https://user:pass@example.com/a.apk' }, { mandatory: 'true' }, { sha256: 'bad' }, { versionCode: 2.1 }, { versionCode: -1 }, { versionCode: 2147483647 }, { version: '' }, { releaseNotes: 'x'.repeat(10001) }]) assert.throws(() => parseManifest({ ...manifest, ...patch }));
});
const checkExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/app-updates/check.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: checkExports, require: () => exportsObject });
test('server errors, unavailable server and bad JSON keep app usable', async () => {
  for (const request of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, text: async () => 'invalid JSON' }), async () => ({ ok: true, text: async () => 'x'.repeat(20001) })]) {
    assert.equal(await checkExports.checkUpdate('https://example.com/latest.json', '1', new AbortController().signal, request), null);
  }
});
test('check returns validated newer mandatory manifest', async () => {
  const request = async () => ({ ok: true, text: async () => JSON.stringify({ ...manifest, mandatory: true }) });
  const result = await checkExports.checkUpdate('https://example.com/latest.json', '1', new AbortController().signal, request);
  assert.equal(result.versionCode, 2);
  assert.equal(result.mandatory, true);
});
const verifyExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/app-updates/verify-download.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: verifyExports });
test('failed downloads never reach APK verification', async () => {
  for (const result of [undefined, { status: 404, uri: 'file:///app.apk' }]) {
    await assert.rejects(verifyExports.verifyDownload(result, manifest.sha256, async () => { assert.fail('must not hash'); }, async () => {}), /Download failed/);
  }
});
test('checksum mismatch deletes APK and cannot proceed to installer', async () => {
  let deleted;
  await assert.rejects(verifyExports.verifyDownload({ status: 200, uri: 'file:///bad.apk' }, manifest.sha256, async () => 'b'.repeat(64), async (uri) => { deleted = uri; }), /checksum mismatch/);
  assert.equal(deleted, 'file:///bad.apk');
});
test('only a verified APK URI is returned for installation', async () => {
  assert.equal(await verifyExports.verifyDownload({ status: 200, uri: 'file:///good.apk' }, manifest.sha256, async () => manifest.sha256.toUpperCase(), async () => assert.fail('must not delete')), 'file:///good.apk');
});
test('supports existing website downloadUrl format with safe optional defaults', () => {
  const data = { appName: 'Politic Ease', packageName: 'com.binarydatasteam.digitalvoter', version: '1.0.0', versionCode: 2, platform: 'android', downloadUrl: 'https://example.com/app.apk', websiteUrl: 'https://example.com/', fileType: 'apk', sha256: manifest.sha256 };
  const result = parseManifest(data);
  assert.equal(result.apkUrl, data.downloadUrl);
  assert.equal(result.mandatory, false);
  assert.equal(result.releaseNotes, '');
  for (const patch of [{ versionCode: undefined }, { sha256: undefined }, { platform: 'ios' }, { packageName: 'other.app' }, { downloadUrl: 'http://example.com/a.apk' }]) assert.throws(() => parseManifest({ ...data, ...patch }));
});
