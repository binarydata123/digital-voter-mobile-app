const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ os = 'ios', print = async () => {} } = {}) {
  const exports = {};
  const calls = [];
  const source = ts.transpileModule(fs.readFileSync('src/features/voters/components/VoterSlipPreview.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, console, require(name) {
    if (name === 'expo-print') return { printAsync: async options => { calls.push(options); return print(options); } };
    if (name === 'expo-file-system/legacy') return { EncodingType: { Base64: 'base64' }, readAsStringAsync: async () => 'LOCAL_BANNER_BASE64' };
    if (name === 'react-native') return { Platform: { OS: os }, StyleSheet: { create: value => value } };
    return {};
  } });
  return { ...exports, calls };
}
const voter = { id: 'one', name: 'First voter', guardian: 'Guardian', epicNo: 'ABC1234567', serialNo: '1', gender: 'Female', age: 35, booth: 'Booth-001' };
const member = { ...voter, id: 'two', name: 'Second voter', epicNo: 'XYZ9876543', serialNo: '2' };

test('iOS opens one native print job containing every family member and only one banner', async () => {
  const f = load();
  assert.equal(await f.printSlip(voter, true, 'data:image/png;base64,BANNER', [voter, member]), true);
  assert.equal(f.calls.length, 1);
  const html = f.calls[0].html;
  assert.ok(html.includes('ABC1234567') && html.includes('XYZ9876543'));
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.equal((html.match(/<!DOCTYPE html>/g) || []).length, 1);
  assert.equal((html.match(/class="paper"/g) || []).length, 2);
  assert.ok(html.includes('page-break-before: always'));
});

test('local banner files are embedded for iOS HTML printing', async () => {
  const f = load();
  await f.printSlip(voter, true, 'file:///saved/banner.png');
  assert.ok(f.calls[0].html.includes('data:image/png;base64,LOCAL_BANNER_BASE64'));
  assert.equal(f.calls[0].html.includes('file:///saved/banner.png'), false);
});

test('data-only family printing has no banner', async () => {
  const f = load();
  await f.printSlip(voter, false, 'data:image/png;base64,BANNER', [voter, member]);
  assert.equal(f.calls[0].html.includes('<img '), false);
});

test('single-voter printing and an empty optional family list still print one slip', async () => {
  const f = load();
  await f.printSlip(voter, false, undefined, []);
  assert.equal((f.calls[0].html.match(/class="paper"/g) || []).length, 1);
});

test('print-sheet cancellation returns false so callers do not mark voters as printed', async () => {
  const f = load({ print: async () => { throw { code: 'ERR_PRINT_INCOMPLETE' }; } });
  assert.equal(await f.printSlip(voter, false), false);
});

test('printer failures propagate for the preview error message', async () => {
  const f = load({ print: async () => { throw new Error('Printer unavailable'); } });
  await assert.rejects(f.printSlip(voter, false), /Printer unavailable/);
});

test('voter text is escaped in the printed document', () => {
  const f = load();
  const html = f.buildSlipHtml({ ...voter, name: '<script>alert(1)</script>' }, false);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});
