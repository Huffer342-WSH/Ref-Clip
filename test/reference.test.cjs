const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
class Position {
  constructor(line, character) { this.line = line; this.character = character; }
  isBefore(p) { return this.line < p.line || this.line === p.line && this.character < p.character; }
}
class Range {
  constructor(start, end) { this.start = start; this.end = end; }
  get isEmpty() { return this.start.line === this.end.line && this.start.character === this.end.character; }
  contains(value) {
    const a = value.start ?? value; const b = value.end ?? value;
    return !a.isBefore(this.start) && !this.end.isBefore(b);
  }
}
const r = (a,b,c,d) => new Range(new Position(a,b), new Position(c,d));
const uri = { fsPath: '/workspace/src/user.ts', scheme: 'file', toString: () => 'file:///workspace/src/user.ts' };
let provider = [];
let folds = [];
let workspaceFolder = { uri: { fsPath: '/workspace' } };
const vscode = { Range, commands: { executeCommand: async command => { const result = command === 'vscode.executeFoldingRangeProvider' ? folds : provider; if (result instanceof Error) throw result; return result; } },
  workspace: { getWorkspaceFolder: () => workspaceFolder } };
const original = Module._load;
Module._load = function(name, ...args) { return name === 'vscode' ? vscode : original.call(this, name, ...args); };
const { flattenSymbols, enclosingSymbols, selectionReference, enclosingBlocks, getFoldingRanges, resolveQuickReference } = require('../out/referenceResolver');
Module._load = original;
const { formatReference } = require('../out/referenceFormatter');
const doc = { uri, lineCount: 30, offsetAt: p => p.line * 100 + p.character, lineAt: line => ({ range: r(line,0,line,80) }) };
const method = { name: 'createUser', kind: 5, range: r(3,2,8,3), selectionRange: r(3,7,3,17), children: [] };
const outer = { name: 'Service', kind: 4, range: r(0,0,12,1), selectionRange: r(0,6,0,13), children: [method] };

test('explicit multiline selection preserved and trailing column zero excluded', async () => {
  provider = [outer];
  const ref = await resolveQuickReference(doc, r(4,2,7,0), 'selectionOrSymbol');
  assert.equal(ref.startLine, 5); assert.equal(ref.endLine, 7);
  assert.equal(ref.endCharacter, 80); assert.equal(ref.symbolName, undefined);
});
test('missing and failed providers fall back to selection or current line', async () => {
  for (const result of [[], undefined, new Error('provider failed')]) {
    provider = result;
    const ref = await resolveQuickReference(doc, r(2,5,2,5), 'selectionOrSymbol');
    assert.equal(ref.startCharacter, 0); assert.equal(ref.endCharacter, 80);
    assert.equal(formatReference(ref), '[user.ts#L3](/workspace/src/user.ts#L3)');
    assert.equal((await resolveQuickReference(doc, r(2,5,2,9), 'selectionOrSymbol')).endCharacter, 9);
  }
});
test('flat symbols choose smallest enclosing range and ignore other files', () => {
  const symbols = flattenSymbols([
    { name: 'outer', kind: 4, location: { uri, range: r(0,0,12,1) } },
    { name: 'inner', kind: 5, location: { uri, range: r(3,2,8,3) } },
    { name: 'foreign', kind: 5, location: { uri: { toString: () => 'file:///other' }, range: r(5,0,5,8) } },
  ], uri);
  assert.equal(enclosingSymbols(doc, r(5,4,5,4), symbols)[0].name, 'inner');
});
test('template replacement is literal, nonrecursive, supports optional values and numeric kind', () => {
  const reference = { fileName: '$&{endLine}', absolutePath: 'C:\\src\\user.ts', relativePath: 'src/user.ts', startLine: 1, endLine: 2, symbolKind: 5 };
  assert.equal(formatReference(reference, { rangeTemplate: '{fileName}|{symbolName}|{symbolKind}|{unknown}|{absolutePath}', singleLineTemplate: '' }), '$&{endLine}||5|{unknown}|C:\\src\\user.ts');
});

test('enclosing choices are innermost first, multiline aware, and deduplicated', () => {
  const symbols = flattenSymbols([outer, method], uri);
  assert.deepEqual(enclosingSymbols(doc, r(4,0,6,0), symbols).map(s => s.name), ['createUser', 'Service']);
  assert.deepEqual(enclosingSymbols(doc, r(2,0,10,0), symbols).map(s => s.name), ['Service']);
  assert.deepEqual(enclosingSymbols(doc, r(15,0,15,0), symbols), []);
});
test('explicit selection copy never expands to a symbol', () => {
  const ref = selectionReference(doc, r(3,7,3,17));
  assert.equal(ref.symbolName, undefined);
  assert.equal(formatReference(ref), '[user.ts#L4](/workspace/src/user.ts#L4)');
});
test('symbol template has one-line and range suffixes and is configurable', () => {
  const ref = { fileName: 'user.ts', absolutePath: '/src/user.ts', startLine: 4, endLine: 4, symbolName: 'User' };
  assert.equal(formatReference(ref), '[user.ts User](/src/user.ts#L4)');
  assert.equal(formatReference({ ...ref, endLine: 9 }), '[user.ts User](/src/user.ts#L4-L9)');
  assert.equal(formatReference(ref, { rangeTemplate: '', singleLineTemplate: '', symbolTemplate: '{symbolName}:{startLine}' }), 'User:4');
});

test('folding blocks use inclusive lines, filter invalid/duplicate ranges, and sort smallest first', () => {
  const result = enclosingBlocks(doc, r(5,0,7,0), [
    { start: 0, end: 20 }, { start: 4, end: 8 }, { start: 4, end: 8 },
    { start: 5, end: 6 }, { start: 6, end: 9 }, { start: -1, end: 8 }, { start: 0, end: 30 },
  ]);
  assert.deepEqual(result.map(x => [x.startLine, x.endLine]), [[6,7], [5,9], [1,21]]);
  const emptyEndDoc = { ...doc, lineAt: line => ({ range: r(line,0,line,line === 6 ? 0 : 80) }) };
  assert.equal(enclosingBlocks(emptyEndDoc, r(5,0,5,0), [{ start: 5, end: 6 }])[0].endLine, 7);
});
test('fold provider errors or absence return an empty list', async () => {
  for (folds of [undefined, new Error('failure')]) { assert.deepEqual(await getFoldingRanges(doc), []); }
});
test('quick copy honors any selection, then smallest symbol, then line fallback', async () => {
  provider = [outer];
  assert.equal((await resolveQuickReference(doc, r(3,7,3,17), 'selectionOrSymbol')).symbolName, undefined);
  assert.equal((await resolveQuickReference(doc, r(5,7,5,7), 'selectionOrSymbol')).symbolName, 'createUser');
  assert.equal((await resolveQuickReference(doc, r(5,7,5,7), 'selection')).symbolName, undefined);
  provider = [];
  assert.equal((await resolveQuickReference(doc, r(5,7,5,7), 'selectionOrSymbol')).startLine, 6);
  assert.equal(await resolveQuickReference(doc, r(5,7,5,7), 'symbol'), undefined);
  folds = [{ start: 3, end: 8 }];
  assert.equal((await resolveQuickReference(doc, r(5,7,5,7), 'block')).startLine, 4);
  folds = [];
  assert.equal(await resolveQuickReference(doc, r(5,7,5,7), 'block'), undefined);
});
test('paths distinguish workspace and current directory; no workspace falls back to file directory', () => {
  let ref = selectionReference(doc, r(3,7,3,17));
  assert.equal(ref.relativePath, './src/user.ts');
  assert.equal(ref.fileRelativePath, './user.ts');
  assert.equal(formatReference(ref, undefined, 'workspaceRelative'), '[user.ts#L4](./src/user.ts#L4)');
  assert.equal(formatReference(ref, undefined, 'fileRelative'), '[user.ts#L4](./user.ts#L4)');
  workspaceFolder = undefined;
  ref = selectionReference(doc, r(3,7,3,17));
  assert.equal(ref.relativePath, './user.ts');
  workspaceFolder = { uri: { fsPath: '/workspace' } };
});
test('portable relative paths cover dotfiles, parents, Windows drives and UNC shares', () => {
  const { relativeFilePath } = require('../out/referencePaths');
  const paths = require('node:path');
  assert.equal(relativeFilePath('/repo', '/repo/.hidden', paths.posix), './.hidden');
  assert.equal(relativeFilePath('/repo', '/other/a.ts', paths.posix), '../other/a.ts');
  assert.equal(relativeFilePath('/repo', '/repo', paths.posix), './');
  assert.equal(relativeFilePath('C:/repo', 'C:/repo/src/a.ts', paths.win32), './src/a.ts');
  assert.equal(relativeFilePath('C:/repo', 'D:/a.ts', paths.win32), 'D:/a.ts');
  assert.equal(relativeFilePath('//server/share/repo', '//server/share/a.ts', paths.win32), '../a.ts');
});
