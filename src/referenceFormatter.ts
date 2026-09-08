import type { CodeReference, ReferenceTemplates, PathStyle } from './types';

export const defaultTemplates: ReferenceTemplates = {
  symbolTemplate: '[{fileName} {symbolName}]({path}#L{startLine}{lineRangeSuffix})',
  rangeTemplate: '[{fileName}#L{startLine}-L{endLine}]({path}#L{startLine}-L{endLine})',
  singleLineTemplate: '[{fileName}#L{startLine}]({path}#L{startLine})',
};

/** Literal, single-pass substitution: unknown tokens remain intact. */
export function formatReference(reference: CodeReference, templates = defaultTemplates, pathStyle: PathStyle = 'absolute'): string {
  const template = reference.symbolName !== undefined
    ? templates.symbolTemplate ?? defaultTemplates.symbolTemplate!
    : reference.startLine === reference.endLine ? templates.singleLineTemplate : templates.rangeTemplate;
  const values: Record<string, string | number | undefined> = {
    absolutePath: reference.absolutePath, relativePath: reference.relativePath,
    fileRelativePath: reference.fileRelativePath,
    path: pathStyle === 'workspaceRelative' ? reference.relativePath
      : pathStyle === 'fileRelative' ? reference.fileRelativePath ?? reference.absolutePath : reference.absolutePath,
    fileName: reference.fileName, startLine: reference.startLine, endLine: reference.endLine,
    startCharacter: reference.startCharacter, endCharacter: reference.endCharacter,
    symbolName: reference.symbolName, symbolKind: reference.symbolKind,
    lineRangeSuffix: reference.startLine === reference.endLine ? '' : `-L${reference.endLine}`,
  };
  return substituteTemplate(template, values);
}

export function substituteTemplate(template: string, values: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? '') : token);
}
