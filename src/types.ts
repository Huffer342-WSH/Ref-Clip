import type * as vscode from 'vscode';

export interface CodeReference {
  uri: vscode.Uri;
  absolutePath: string;
  relativePath: string;
  fileName: string;
  fileRelativePath?: string;
  /** Lines are one-based; characters are zero-based UTF-16 offsets. */
  startLine: number;
  endLine: number;
  /** End character is exclusive, matching VS Code ranges. */
  startCharacter?: number;
  endCharacter?: number;
  blockKind?: string;
  blockHeader?: string;
  symbolName?: string;
  symbolKind?: vscode.SymbolKind;
}

export interface ReferenceTemplates {
  rangeTemplate: string;
  singleLineTemplate: string;
  symbolTemplate?: string;
}

export type QuickCopyBehavior = 'selectionOrSymbol' | 'selection' | 'symbol' | 'block';
export type PathStyle = 'absolute' | 'workspaceRelative' | 'fileRelative';
