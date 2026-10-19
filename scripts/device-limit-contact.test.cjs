const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function service(api) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/device-limit-contact.ts','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: () => ({ api }) });
  return exports;
}
const contact = { admin: { name: 'Admin', phone: '9876543210' }, deviceLimit: 5, activeDeviceCount: 5, message: 'My current limit is 5 devices. Please increase the limit.' };
test('admin contact API uses the scoped proof, without sending phone/password', async () => {
  const f = service({ get: async (path, options) => {
    assert.equal(path, '/auth/device-limit/admin-contact');
    assert.equal(options.headers.Authorization, 'Bearer verified-contact-proof');
    assert.equal(options.params, undefined);
    return { data: { success: true, data: contact } };
  } });
  assert.equal((await f.getDeviceLimitAdminContact('verified-contact-proof')).deviceLimit, 5);
});
test('contact message uses international WhatsApp format and safely encoded text', () => {
  const f = service({});
  const url = new URL(f.adminWhatsAppUrl(contact));
  assert.equal(url.pathname, '/919876543210');
  assert.equal(url.searchParams.get('text'), contact.message);
  assert.equal(new URL(f.adminWhatsAppUrl({ ...contact, admin: { ...contact.admin, phone: '+44 7700 900123' } })).pathname, '/447700900123');
});
test('unavailable admin numbers and unsuccessful responses show a useful error', async () => {
  const f = service({ get: async () => ({ data: { success: false, message: 'No admin contact is available.' } }) });
  await assert.rejects(f.getDeviceLimitAdminContact('proof'), /No admin contact/);
  assert.throws(() => f.adminWhatsAppUrl({ ...contact, admin: { ...contact.admin, phone: '' } }), /unavailable/);
});
