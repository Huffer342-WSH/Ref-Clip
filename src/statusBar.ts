import * as vscode from 'vscode';
import { configuration } from './configuration';
import { supportsReference } from './referenceResolver';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  let quick: vscode.StatusBarItem | undefined;
  let panel: vscode.StatusBarItem | undefined;
  let placement = '';
  const update = () => {
    const editor = vscode.window.activeTextEditor;
    const config = configuration(editor?.document.uri);
    const side = config.get<string>('statusBarAlignment', 'right');
    const priority = config.get<number>('statusBarPriority', -100);
    const nextPlacement = `${side}:${priority}`;
    if (!quick || !panel || placement !== nextPlacement) {
      quick?.dispose();
      panel?.dispose();
      placement = nextPlacement;
      const alignment = side === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
      quick = vscode.window.createStatusBarItem('refclip.quickCopy', alignment, priority);
      quick.name = 'RefClip: Quick Copy';
      quick.text = '$(copy) Ref';
      quick.command = 'refclip.copyReference';
      // A narrow shared priority band avoids the built-in items between 100 and 101.
      panel = vscode.window.createStatusBarItem('refclip.options', alignment, priority - 0.001);
      panel.name = 'RefClip: Reference Options';
      panel.text = '$(list-selection) Refs';
      panel.tooltip = 'RefClip: Open Reference Options';
      panel.command = 'refclip.chooseReference';
    }
    quick.tooltip = `RefClip: Quick Copy (${config.get('quickCopyBehavior', 'selectionOrSymbol')})`;
    for (const [item, setting] of [[quick, 'showQuickCopyButton'], [panel, 'showOptionsButton']] as const) {
      if (editor && supportsReference(editor.document.uri) && config.get(setting, true)) { item.show(); }
      else { item.hide(); }
    }
  };
  context.subscriptions.push({ dispose: () => { quick?.dispose(); panel?.dispose(); } },
    vscode.window.onDidChangeActiveTextEditor(update), vscode.workspace.onDidChangeConfiguration(update));
  update();
}
