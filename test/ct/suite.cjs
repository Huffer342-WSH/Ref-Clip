const assert = require('node:assert/strict');
const vscode = require('vscode');

exports.run = async function run() {
  const extension = vscode.extensions.getExtension('refclip.refclip');
  assert.ok(extension, 'RefClip must be discovered by the real extension host');
  await extension.activate();
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'CT requires a workspace');
  const uri = vscode.Uri.joinPath(folder.uri, 'sample.refcliptest');
  const source = ['class Example {', '  method() {', '    if (ready) {', '      work();', '    }', '  }', '}', ''];
  await vscode.workspace.fs.writeFile(uri, Buffer.from(source.join('\n')));
  const range = (a,b,c,d) => new vscode.Range(a,b,c,d);
  const selector = { scheme: 'file', pattern: '**/*.refcliptest' };
  const registrations = [
    vscode.languages.registerDocumentSymbolProvider(selector, {
      provideDocumentSymbols() {
        const outer = new vscode.DocumentSymbol('Example', '', vscode.SymbolKind.Class, range(0,0,6,1), range(0,6,0,13));
        outer.children = [new vscode.DocumentSymbol('method', '', vscode.SymbolKind.Method, range(1,2,5,3), range(1,2,1,8))];
        return [outer];
      },
    }),
    vscode.languages.registerFoldingRangeProvider(selector, {
      provideFoldingRanges: () => [new vscode.FoldingRange(0,6), new vscode.FoldingRange(2,4)],
    }),
  ];
  const config = vscode.workspace.getConfiguration('refclip', uri);
  const previousClipboard = await vscode.env.clipboard.readText();
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log(`CT PASS: ${name}`); };
  try {
    await config.update('pathStyle', 'workspaceRelative', vscode.ConfigurationTarget.Workspace);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    const select = (a,b,c,d) => { editor.selection = new vscode.Selection(a,b,c,d); };
    const copied = async command => {
      await vscode.commands.executeCommand(command);
      return vscode.env.clipboard.readText();
    };
    await check('real activation, commands, selection and clipboard', async () => {
      select(1,2,1,8);
      assert.equal(await copied('refclip.copyReference'), '[sample.refcliptest#L2](./sample.refcliptest#L2)');
    });
    await check('Document Symbol provider yields the smallest enclosing method', async () => {
      select(3,6,3,6);
      assert.equal(await copied('refclip.copySymbol'), '[sample.refcliptest method](./sample.refcliptest#L2-L6)');
    });
    await check('real folding provider command yields inclusive block lines', async () => {
      assert.equal(await copied('refclip.copyBlock'), '[sample.refcliptest#L3-L5](./sample.refcliptest#L3-L5)');
    });
    await check('Code Action survives API serialization and executes the requested reference', async () => {
      const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', uri, editor.selection);
      const action = actions.find(item => item.title.startsWith('RefClip.') && item.title.includes('method'));
      assert.ok(action?.command, 'RefClip method action must be returned');
      select(0,0,0,0);
      await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
      assert.equal(await vscode.env.clipboard.readText(), '[sample.refcliptest method](./sample.refcliptest#L2-L6)');
      await editor.edit(edit => edit.insert(new vscode.Position(0,0), '// changed\n'));
      await vscode.env.clipboard.writeText('unchanged');
      await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
      assert.equal(await vscode.env.clipboard.readText(), 'unchanged', 'Stale action must not overwrite clipboard');
    });
    await check('legacy command aliases and live settings work in VS Code', async () => {
      await config.update('pathStyle', 'absolute', vscode.ConfigurationTarget.Workspace);
      select(1,0,1,5);
      assert.equal(await copied('codexRefClip.copySelection'), `[sample.refcliptest#L2](${uri.fsPath}#L2)`);
    });
    await check('built-in TypeScript language service provides usable symbols', async () => {
      const tsUri = vscode.Uri.joinPath(folder.uri, 'real.ts');
      await vscode.workspace.fs.writeFile(tsUri, Buffer.from('export class Real {\n  execute() {\n    return 1;\n  }\n}\n'));
      const tsDocument = await vscode.workspace.openTextDocument(tsUri);
      const tsEditor = await vscode.window.showTextDocument(tsDocument);
      tsEditor.selection = new vscode.Selection(2,4,2,4);
      const service = vscode.extensions.getExtension('vscode.typescript-language-features');
      assert.ok(service, 'Built-in TypeScript extension must be available');
      await service.activate();
      const expected = `[real.ts execute](${tsUri.fsPath}#L2-L4)`;
      const deadline = Date.now() + 20000;
      let value;
      do {
        value = await copied('refclip.copySymbol');
        if (value === expected) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
      assert.equal(value, expected);
    });
    console.log(`CT: ${passed} passed`);
  } finally {
    registrations.forEach(item => item.dispose());
    await vscode.env.clipboard.writeText(previousClipboard);
  }
};
