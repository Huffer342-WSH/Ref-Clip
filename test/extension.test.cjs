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
  contains(x) { return !(x.start ?? x).isBefore(this.start) && !this.end.isBefore(x.end ?? x); }
}
class Kind {
  constructor(value) { this.value = value; }
  append(x) { return new Kind(this.value ? this.value + '.' + x : x); }
  contains(x) { return !this.value || x.value === this.value || x.value.startsWith(this.value + '.'); }
}
const r = (a,b,c,d) => new Range(new Position(a,b),new Position(c,d));
const commands = new Map();
const config = {};
const statuses = [];
let provider, metadata, configChanged, editorChanged, clipboard = 'untouched', pickerItems;
const disposable = { dispose() {} };
const uri = { fsPath: '/repo/src/a.ts', scheme: 'file', toString: () => 'file:///repo/src/a.ts' };
const document = { uri, version: 1, isClosed: false, lineCount: 20,
  offsetAt: p => p.line * 100 + p.character, lineAt: line => ({ range: r(line,0,line,80) }) };
const editor = { document, selection: r(5,2,5,2) };
const symbol = { name: 'method', kind: 5, range: r(2,0,10,2), selectionRange: r(2,5,2,11), children: [] };
const api = {
  Position, Range, SymbolKind: { 5: 'Method' }, CodeActionKind: { Empty: new Kind('') },
  CodeAction: class { constructor(title, kind) { this.title = title; this.kind = kind; } },
  StatusBarAlignment: { Left: 1, Right: 2 },
  workspace: { getWorkspaceFolder: () => ({ uri: { fsPath: '/repo' } }),
    getConfiguration: () => ({ inspect: key => ({ globalValue: config[key] }), get: (name, fallback) => config[name] ?? fallback }),
    onDidChangeConfiguration: fn => { configChanged = fn; return disposable; } },
  env: { clipboard: { writeText: async text => { clipboard = text; } } },
  commands: {
    registerCommand: (id, fn) => { commands.set(id, fn); return disposable; },
    executeCommand: async (id, ...args) => {
      if (id === 'vscode.executeDocumentSymbolProvider') return [symbol];
      if (id === 'vscode.executeFoldingRangeProvider') return [{ start: 4, end: 7 }];
      return commands.get(id)(...args);
    },
  },
  window: { activeTextEditor: editor,
    setStatusBarMessage: () => disposable, showErrorMessage: text => { throw new Error(text); },
    showQuickPick: async items => { pickerItems = items; return items[0]; },
    onDidChangeActiveTextEditor: fn => { editorChanged = fn; return disposable; },
    createStatusBarItem: (id, alignment, priority) => { const item = { id, alignment, priority, show() { this.visible = true; }, hide() { this.visible = false; }, dispose() { this.disposed = true; } }; statuses.push(item); return item; },
  },
  languages: { registerCodeActionsProvider: (selector, p, m) => { provider = p; metadata = m; return disposable; } },
};
const original = Module._load;
Module._load = function(name, ...args) { return name === 'vscode' ? api : original.call(this, name, ...args); };
const { activate } = require('../out/extension');
Module._load = original;
activate({ subscriptions: [] });

test('status buttons dispatch separate commands and react to settings/editor changes', () => {
  assert.equal(statuses.length, 2);
  assert.equal(statuses[0].command, 'refclip.copyReference');
  assert.equal(statuses[1].command, 'refclip.chooseReference');
  config.showQuickCopyButton = false; configChanged();
  assert.equal(statuses[0].visible, false); assert.equal(statuses[1].visible, true);
  api.window.activeTextEditor = undefined; editorChanged();
  assert.equal(statuses[1].visible, false);
  api.window.activeTextEditor = editor;
  config.showQuickCopyButton = true; configChanged();
});
test('quick copy and explicit context commands copy distinct targets with configured paths', async () => {
  config.pathStyle = 'workspaceRelative';
  editor.selection = r(5,2,5,8);
  await commands.get('refclip.copyReference')();
  assert.equal(clipboard, '[a.ts#L6](./src/a.ts#L6)');
  editor.selection = r(5,2,5,2);
  await commands.get('refclip.copyReference')();
  assert.equal(clipboard, '[a.ts method](./src/a.ts#L3-L11)');
  await commands.get('refclip.copyBlock')();
  assert.equal(clipboard, '[a.ts#L5-L8](./src/a.ts#L5-L8)');
  config.quickCopyBehavior = 'block';
  await commands.get('refclip.copyReference')();
  assert.equal(clipboard, '[a.ts#L5-L8](./src/a.ts#L5-L8)');
  editor.selection = r(15,0,15,0);
  await commands.get('refclip.copySymbol')();
  assert.equal(clipboard, '[a.ts#L5-L8](./src/a.ts#L5-L8)');
  editor.selection = r(5,2,5,2);
});
test('custom action kind, sorted targets, prompt template, cancellation and stale action guard', async () => {
  assert.equal(metadata.providedCodeActionKinds[0].value, 'refclip');
  assert.deepEqual(await provider.provideCodeActions(document, editor.selection, { only: new Kind('quickfix') }, {}), []);
  config.symbolOptionTemplate = 'SYMBOL: {symbolName} [{symbolKind}]';
  const actions = await provider.provideCodeActions(document, editor.selection, {}, {});
  assert.equal(actions.length, 3);
  assert.match(actions[0].title, /Current Line/);
  assert.match(actions[1].title, /Block/);
  assert.match(actions[2].title, /SYMBOL: method \[Method\]/);
  assert.deepEqual(await provider.provideCodeActions(document, editor.selection, {}, { isCancellationRequested: true }), []);
  const previous = clipboard;
  document.version++;
  await api.commands.executeCommand(actions[2].command.command, ...actions[2].command.arguments);
  assert.equal(clipboard, previous);
});
test('options panel has range, block and symbol choices; selection uses common copy path', async () => {
  await commands.get('refclip.chooseReference')();
  assert.equal(pickerItems.length, 3);
  assert.equal(clipboard, '[a.ts#L6](./src/a.ts#L6)');
});

test('Outline icons appear in the panel but do not leak into plain Code Action titles', async () => {
  delete config.symbolOptionTemplate;
  await commands.get('refclip.chooseReference')();
  assert.match(pickerItems[2].label, /\$\(symbol-method\)/);
  assert.match(pickerItems[1].label, /\$\(code\) Block/);
  const actions = await provider.provideCodeActions(document, editor.selection, {}, {});
  assert.ok(actions.every(action => !action.title.includes('$(')));
});
test('status priority keeps a narrow interval and placement changes dispose and recreate both buttons', () => {
  assert.equal(statuses[0].alignment, 2);
  assert.equal(statuses[0].priority, -100);
  assert.ok(Math.abs(statuses[0].priority - statuses[1].priority) < 0.002);
  config.statusBarAlignment = 'left'; config.statusBarPriority = 50;
  configChanged();
  assert.equal(statuses.length, 4);
  assert.ok(statuses[0].disposed && statuses[1].disposed);
  assert.equal(statuses[2].alignment, 1);
  assert.equal(statuses[2].priority, 50);
  assert.equal(statuses[3].priority, 49.999);
  configChanged();
  assert.equal(statuses.length, 4);
});

test('short action prefix, text markers and legacy command aliases', async () => {
  const actions = await provider.provideCodeActions(document, editor.selection, {}, {});
  assert.ok(actions.every(action => action.title.startsWith('RefClip. ')));
  assert.match(actions[2].title, /RefClip\. ƒ /);
  assert.match(actions[1].title, /RefClip\. \{\} /);
  await commands.get('codexRefClip.copySelection')();
  assert.equal(clipboard, '[a.ts#L6](./src/a.ts#L6)');
});
