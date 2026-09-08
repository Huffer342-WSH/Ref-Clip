import * as vscode from 'vscode';
import { configuration } from './configuration';
import { symbolIcon, blockPresentation, plainLabel, actionMarker } from './referencePresentation';
import { registerStatusBar } from './statusBar';
import { defaultTemplates, formatReference, substituteTemplate } from './referenceFormatter';
import { buildReference, enclosingSymbols, enclosingBlocks, getDocumentSymbols, getFoldingRanges,
  resolveQuickReference, selectionReference, supportsReference } from './referenceResolver';
import type { CodeReference, PathStyle, QuickCopyBehavior } from './types';

const copyCommand = 'refclip.copyReference';
const symbolLabelDefault = '{symbolIcon} {symbolName} · {symbolKind} → {range}';
interface CopyTarget { document: vscode.TextDocument; version: number; reference: CodeReference }
interface Choice extends vscode.QuickPickItem { target: CopyTarget; marker: string }

function target(document: vscode.TextDocument, reference: CodeReference): CopyTarget {
  return { document, version: document.version, reference };
}
function rangeLabel(reference: CodeReference): string {
  return reference.startLine === reference.endLine ? `L${reference.startLine}`
    : `L${reference.startLine}–L${reference.endLine}`;
}
async function choices(document: vscode.TextDocument, selection: vscode.Range): Promise<Choice[]> {
  const version = document.version;
  const range = selectionReference(document, selection);
  const [symbols, folds] = await Promise.all([getDocumentSymbols(document), getFoldingRanges(document)]);
  if (document.version !== version || document.isClosed) { return []; }
  const labelTemplate = configuration(document.uri)
    .get('symbolOptionTemplate', symbolLabelDefault);
  const enclosing: Choice[] = [
    ...enclosingSymbols(document, selection, symbols).map(symbol => {
      const reference = buildReference(document, symbol.range, symbol);
      return { label: substituteTemplate(labelTemplate, {
        symbolIcon: symbolIcon(symbol.kind), symbolName: symbol.name, symbolKind: vscode.SymbolKind[symbol.kind],
        fileName: reference.fileName, startLine: reference.startLine, endLine: reference.endLine,
        range: rangeLabel(reference),
      }), description: reference.fileName, marker: actionMarker(reference), target: target(document, reference) };
    }),
    ...enclosingBlocks(document, selection, folds).map(reference => {
      const appearance = blockPresentation(reference);
      return { label: `${appearance.icon} ${appearance.label} · ${rangeLabel(reference)}`,
        description: reference.blockHeader || 'Folding range', marker: actionMarker(reference), target: target(document, reference) };
    }),
  ];
  const size = (item: Choice) => {
    const r = item.target.reference;
    return document.offsetAt(new vscode.Position(r.endLine - 1, r.endCharacter ?? 0)) -
      document.offsetAt(new vscode.Position(r.startLine - 1, r.startCharacter ?? 0));
  };
  enclosing.sort((a, b) => size(a) - size(b));
  return [{ label: selection.isEmpty ? 'Copy Current Line' : 'Copy Selected Range',
    description: rangeLabel(range), marker: '≡', target: target(document, range) }, ...enclosing];
}

export function activate(context: vscode.ExtensionContext): void {
  const copy = async (request?: CopyTarget, behavior?: QuickCopyBehavior) => {
    try {
      let captured = request;
      if (!captured) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !supportsReference(editor.document.uri)) { return; }
        const { document, selection } = editor;
        const version = document.version;
        const selectedBehavior = behavior ?? configuration(document.uri)
          .get<QuickCopyBehavior>('quickCopyBehavior', 'selectionOrSymbol');
        const reference = await resolveQuickReference(document, selection, selectedBehavior);
        if (!reference) {
          vscode.window.setStatusBarMessage(`RefClip: No enclosing ${selectedBehavior} found.`, 3000);
          return;
        }
        captured = { document, version, reference };
      }
      if (captured.document.isClosed || captured.document.version !== captured.version) {
        vscode.window.setStatusBarMessage('RefClip: Code changed; choose the reference again.', 4000);
        return;
      }
      const config = configuration(captured.document.uri);
      const text = formatReference(captured.reference, {
        rangeTemplate: config.get('rangeTemplate', defaultTemplates.rangeTemplate),
        singleLineTemplate: config.get('singleLineTemplate', defaultTemplates.singleLineTemplate),
        symbolTemplate: config.get('symbolTemplate', defaultTemplates.symbolTemplate!),
      }, config.get<PathStyle>('pathStyle', 'absolute'));
      await vscode.env.clipboard.writeText(text);
      vscode.window.setStatusBarMessage(`Copied: ${text.replace(/[\r\n]+/g, ' ').slice(0, 180)}`, 3000);
    } catch (error) {
      void vscode.window.showErrorMessage(`RefClip: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  context.subscriptions.push(vscode.commands.registerCommand(copyCommand, (arg?: unknown) =>
    copy(arg && typeof arg === 'object' && 'reference' in arg && 'document' in arg && 'version' in arg
      ? arg as CopyTarget : undefined)));
  for (const [command, behavior] of [
    ['copySelection', 'selection'], ['copySymbol', 'symbol'], ['copyBlock', 'block'],
  ] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`refclip.${command}`, () => copy(undefined, behavior)));
  }
  context.subscriptions.push(vscode.commands.registerCommand('refclip.chooseReference', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !supportsReference(editor.document.uri)) { return; }
    const items = await choices(editor.document, editor.selection);
    if (!items.length) { return; }
    const selected = await vscode.window.showQuickPick(items, {
      title: 'RefClip', placeHolder: 'Range → enclosing symbols / blocks · smallest to largest',
      matchOnDescription: true,
    });
    if (selected) { await vscode.commands.executeCommand(copyCommand, selected.target); }
  }));

  // Old command IDs remain valid for existing keybindings.
  for (const name of ['copyReference', 'copySelection', 'copySymbol', 'copyBlock', 'chooseReference']) {
    context.subscriptions.push(vscode.commands.registerCommand(`codexRefClip.${name}`,
      (...args: unknown[]) => vscode.commands.executeCommand(`refclip.${name}`, ...args)));
  }

  registerStatusBar(context);

  // Custom kinds fall under VS Code's built-in "More Actions" group.
  const kind = vscode.CodeActionKind.Empty.append('refclip');
  context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
    [{ scheme: 'file' }, { scheme: 'vscode-remote' }], {
      async provideCodeActions(document, selection, actionContext, token) {
        if (actionContext.only && !actionContext.only.contains(kind)) { return []; }
        const items = await choices(document, selection);
        if (token.isCancellationRequested) { return []; }
        return items.map(item => {
          const label = plainLabel(item.label);
          const location = rangeLabel(item.target.reference);
          const title = `RefClip. ${item.marker} ${label}${label.includes(location) ? '' : ` · ${location}`}`;
          const action = new vscode.CodeAction(title, kind);
          action.command = { command: copyCommand, title, arguments: [item.target] };
          return action;
        });
      },
    }, { providedCodeActionKinds: [kind] }));
}
