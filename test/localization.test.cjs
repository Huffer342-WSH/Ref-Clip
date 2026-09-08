const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../package.json');
const directory = path.resolve(__dirname, '../l10n/manifest');

test('all locales cover manifest tokens and match generated runtime files', () => {
  const tokens = [...JSON.stringify(manifest).matchAll(/%([^%]+)%/g)].map(match => match[1]);
  const english = JSON.parse(fs.readFileSync(path.join(directory, 'package.nls.json'), 'utf8'));
  for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const translations = JSON.parse(content);
    for (const key of tokens) {
      assert.equal(typeof translations[key], 'string', `${filename}: ${key}`);
      assert.ok(translations[key].length, `${filename}: ${key}`);
    }
    assert.deepEqual(Object.keys(translations).sort(), Object.keys(english).sort());
    assert.equal(fs.readFileSync(path.resolve(__dirname, '..', filename), 'utf8'), content);
  }
});
