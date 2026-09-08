const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
let explicit = {}, legacy = {};
const defaults = { pathStyle: 'absolute', showOptionsButton: true };
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { workspace: { getConfiguration: namespace => ({
    inspect: key => ({ globalValue: explicit[key] }),
    get: (key, fallback) => namespace === 'refclip' ? explicit[key] ?? defaults[key] ?? fallback : legacy[key] ?? fallback,
  }) } };
  return original.call(this, name, ...args);
};
const { configuration } = require('../out/configuration');
Module._load = original;
test('new explicit settings win; old explicit values survive rename; defaults remain available', () => {
  assert.equal(configuration().get('pathStyle'), 'absolute');
  legacy.pathStyle = 'workspaceRelative';
  assert.equal(configuration().get('pathStyle'), 'workspaceRelative');
  explicit.pathStyle = 'fileRelative';
  assert.equal(configuration().get('pathStyle'), 'fileRelative');
  legacy.showOptionsButton = false;
  assert.equal(configuration().get('showOptionsButton'), false);
  explicit.showOptionsButton = true;
  assert.equal(configuration().get('showOptionsButton'), true);
});
