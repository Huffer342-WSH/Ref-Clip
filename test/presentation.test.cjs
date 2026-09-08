const { test } = require('node:test');
const assert = require('node:assert/strict');
const { symbolIcon, blockPresentation, plainLabel, actionMarker } = require('../out/referencePresentation');

test('Outline types have distinct icons, including struct and enum member', () => {
  assert.equal(symbolIcon(4), '$(symbol-class)');
  assert.equal(symbolIcon(5), '$(symbol-method)');
  assert.equal(symbolIcon(11), '$(symbol-function)');
  assert.equal(symbolIcon(21), '$(symbol-enum-member)');
  assert.equal(symbolIcon(22), '$(symbol-struct)');
  assert.equal(symbolIcon(25), '$(symbol-type-parameter)');
  assert.equal(symbolIcon(100), '$(symbol-misc)');
});
test('folding kinds override header hints; unknown blocks keep a generic label', () => {
  assert.equal(blockPresentation({ blockKind: 'comment', blockHeader: 'if (x)' }).label, 'Comment');
  assert.equal(blockPresentation({ blockKind: 'imports' }).label, 'Imports');
  assert.equal(blockPresentation({ blockKind: 'region' }).label, 'Region');
  assert.equal(blockPresentation({ blockHeader: 'if (ok) {' }).label, 'if · Block');
  assert.equal(blockPresentation({ blockHeader: 'for (auto v : list) {' }).icon, '$(sync)');
  assert.equal(blockPresentation({ blockHeader: 'struct User {' }).icon, '$(symbol-struct)');
  assert.equal(blockPresentation({ blockHeader: '} else {' }).label, 'else · Block');
  assert.equal(blockPresentation({ blockHeader: 'format(value)' }).label, 'Block');
  assert.equal(blockPresentation({ blockHeader: '// if (x)' }).label, 'Block');
  assert.equal(blockPresentation({}).label, 'Block');
});
test('plain labels retain braces and type text without codicon markup', () => {
  assert.equal(plainLabel('$(symbol-struct) User · Struct'), 'User · Struct');
  assert.equal(plainLabel('$(code) {} Block'), '{} Block');
});

test('Code Action markers distinguish regions and symbol types without codicon syntax', () => {
  assert.equal(actionMarker({ symbolKind: 22 }), '◇');
  assert.equal(actionMarker({ symbolKind: 11 }), 'ƒ');
  assert.equal(actionMarker({ blockKind: 'region' }), '▱');
  assert.equal(actionMarker({ blockHeader: 'for (x)' }), '↻');
});
