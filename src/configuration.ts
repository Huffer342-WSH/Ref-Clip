import * as vscode from 'vscode';

/** Prefer new settings; retain explicitly configured pre-rename settings. */
export function configuration(uri?: vscode.Uri): Pick<vscode.WorkspaceConfiguration, 'get'> {
  const current = vscode.workspace.getConfiguration('refclip', uri);
  const legacy = vscode.workspace.getConfiguration('codexRefClip', uri);
  return {
    get<T>(key: string, fallback?: T): T | undefined {
      const value = current.inspect<T>(key);
      const explicit = value && [value.globalValue, value.workspaceValue, value.workspaceFolderValue,
        value.globalLanguageValue, value.workspaceLanguageValue, value.workspaceFolderLanguageValue]
        .some(item => item !== undefined);
      return explicit ? current.get<T>(key) : legacy.get<T>(key) ?? current.get<T>(key, fallback as T);
    },
  } as Pick<vscode.WorkspaceConfiguration, 'get'>;
}
