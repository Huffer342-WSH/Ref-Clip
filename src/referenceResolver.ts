import * as path from 'node:path';
import * as vscode from 'vscode';
import type { CodeReference, QuickCopyBehavior } from './types';
import { relativeFilePath } from './referencePaths';

type ProviderSymbol = vscode.DocumentSymbol | vscode.SymbolInformation;
export interface ReferenceSymbol {
  name: string;
  kind: vscode.SymbolKind;
  range: vscode.Range;
  selectionRange?: vscode.Range;
  depth: number;
}

export function supportsReference(uri: vscode.Uri): boolean {
  return uri.scheme === 'file' || uri.scheme === 'vscode-remote';
}

export async function getDocumentSymbols(document: vscode.TextDocument): Promise<ReferenceSymbol[]> {
  try {
    const result = await vscode.commands.executeCommand<ProviderSymbol[]>(
      'vscode.executeDocumentSymbolProvider', document.uri);
    return flattenSymbols(result ?? [], document.uri);
  } catch {
    // A missing or failing language service must not prevent selection copying.
    return [];
  }
}

export function flattenSymbols(symbols: ProviderSymbol[], uri: vscode.Uri, depth = 0): ReferenceSymbol[] {
  return symbols.flatMap(symbol => {
    if ('selectionRange' in symbol) {
      return [{ name: symbol.name, kind: symbol.kind, range: symbol.range,
        selectionRange: symbol.selectionRange, depth }, ...flattenSymbols(symbol.children, uri, depth + 1)];
    }
    return symbol.location.uri.toString() === uri.toString()
      ? [{ name: symbol.name, kind: symbol.kind, range: symbol.location.range, depth }] : [];
  });
}

export function buildReference(document: vscode.TextDocument, range: vscode.Range,
  symbol?: ReferenceSymbol): CodeReference {
  // A selection ending at column zero does not include that last line.
  const end = !range.isEmpty && range.end.character === 0 && range.end.line > range.start.line
    ? document.lineAt(range.end.line - 1).range.end : range.end;
  const absolutePath = document.uri.fsPath;
  const folder = vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.find(
    folder => folder.uri.scheme === document.uri.scheme && folder.uri.authority === document.uri.authority);
  const directory = path.dirname(absolutePath);
  return {
    uri: document.uri, absolutePath,
    relativePath: relativeFilePath(folder?.uri.fsPath ?? directory, absolutePath),
    fileRelativePath: relativeFilePath(directory, absolutePath),
    fileName: path.basename(absolutePath),
    startLine: range.start.line + 1, endLine: end.line + 1,
    startCharacter: range.start.character, endCharacter: end.character,
    symbolName: symbol?.name, symbolKind: symbol?.kind,
  };
}

/** All enclosing targets, ordered from the smallest range to the largest. */
export function enclosingSymbols(document: vscode.TextDocument, selection: vscode.Range,
  symbols: ReferenceSymbol[]): ReferenceSymbol[] {
  const end = !selection.isEmpty && selection.end.character === 0 && selection.end.line > selection.start.line
    ? document.lineAt(selection.end.line - 1).range.end : selection.end;
  const normalized = new vscode.Range(selection.start, end);
  const seen = new Set<string>();
  return symbols.filter(symbol => {
    const key = `${symbol.name}:${document.offsetAt(symbol.range.start)}:${document.offsetAt(symbol.range.end)}`;
    if (!symbol.range.contains(normalized) || seen.has(key)) { return false; }
    seen.add(key);
    return true;
  }).sort((a, b) =>
    (document.offsetAt(a.range.end) - document.offsetAt(a.range.start)) -
    (document.offsetAt(b.range.end) - document.offsetAt(b.range.start)) || b.depth - a.depth);
}

export function selectionReference(document: vscode.TextDocument, selection: vscode.Range): CodeReference {
  return buildReference(document, selection.isEmpty ? document.lineAt(selection.start.line).range : selection);
}

export async function getFoldingRanges(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {
  try {
    return await vscode.commands.executeCommand<vscode.FoldingRange[]>(
      'vscode.executeFoldingRangeProvider', document.uri) ?? [];
  } catch { return []; }
}

export function enclosingBlocks(document: vscode.TextDocument, selection: vscode.Range,
  folds: vscode.FoldingRange[]): CodeReference[] {
  const endLine = !selection.isEmpty && selection.end.character === 0 && selection.end.line > selection.start.line
    ? selection.end.line - 1 : selection.end.line;
  const seen = new Set<string>();
  return folds.filter(fold => {
    const key = `${fold.start}:${fold.end}`;
    if (!Number.isInteger(fold.start) || !Number.isInteger(fold.end) || fold.start < 0 ||
      fold.end >= document.lineCount || fold.end <= fold.start ||
      fold.start > selection.start.line || fold.end < endLine || seen.has(key)) { return false; }
    seen.add(key);
    return true;
  }).sort((a, b) => a.end - a.start - (b.end - b.start) || b.start - a.start).map(fold => {
    const end = document.lineAt(fold.end).range.end;
    const reference = buildReference(document, new vscode.Range(document.lineAt(fold.start).range.start, end));
    // Folding ends are inclusive lines, even when the final line is empty.
    return { ...reference, endLine: fold.end + 1, endCharacter: end.character,
      blockKind: fold.kind === undefined ? undefined : ['', 'comment', 'imports', 'region'][fold.kind], blockHeader: document.lineAt(fold.start).text?.trim().slice(0, 120) };
  });
}

export async function resolveQuickReference(document: vscode.TextDocument, selection: vscode.Range,
  behavior: QuickCopyBehavior): Promise<CodeReference | undefined> {
  if (behavior === 'selection' || (behavior === 'selectionOrSymbol' && !selection.isEmpty)) {
    return selectionReference(document, selection);
  }
  if (behavior === 'block') {
    return enclosingBlocks(document, selection, await getFoldingRanges(document))[0];
  }
  const symbol = enclosingSymbols(document, selection, await getDocumentSymbols(document))[0];
  return symbol ? buildReference(document, symbol.range, symbol)
    : behavior === 'selectionOrSymbol' ? selectionReference(document, selection) : undefined;
}
