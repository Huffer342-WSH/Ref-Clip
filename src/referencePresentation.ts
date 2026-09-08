import type { CodeReference } from './types';

// VS Code SymbolKind numeric order; use the same product icons as Outline.
const symbolIcons = [
  'file', 'module', 'namespace', 'package', 'class', 'method', 'property',
  'field', 'constructor', 'enum', 'interface', 'function', 'variable', 'constant',
  'string', 'number', 'boolean', 'array', 'object', 'key', 'null', 'enum-member',
  'struct', 'event', 'operator', 'type-parameter',
];
export function symbolIcon(kind: number): string {
  return `$(symbol-${symbolIcons[kind] ?? 'misc'})`;
}

/** Folding API only supplies comment/imports/region. Keywords are header hints, not parsed semantics. */
export function blockPresentation(reference: CodeReference): { icon: string; label: string } {
  switch (reference.blockKind) {
    case 'comment': return { icon: '$(comment)', label: 'Comment' };
    case 'imports': return { icon: '$(references)', label: 'Imports' };
    case 'region': return { icon: '$(fold)', label: 'Region' };
  }
  const keyword = reference.blockHeader?.match(/^(?:}\s*)?(if|else|for|while|do|switch|case|try|catch|finally|struct|class|enum|interface|namespace|match|loop)\b/)?.[1];
  const icon = keyword && ['struct', 'class', 'enum', 'interface', 'namespace'].includes(keyword)
    ? `$(symbol-${keyword})` : keyword && ['if', 'else', 'switch', 'case', 'match'].includes(keyword)
      ? '$(git-branch)' : keyword && ['for', 'while', 'do', 'loop'].includes(keyword)
        ? '$(sync)' : '$(code)';
  return { icon, label: keyword ? `${keyword} · Block` : 'Block' };
}

/** Code Action titles are plain text; do not leak Quick Pick codicon markup. */
export function plainLabel(label: string): string {
  return label.replace(/\$\([a-z0-9-]+(?:~[a-z]+)?\)\s*/gi, '');
}

/** Portable text markers for Code Actions, whose titles do not render codicons. */
export function actionMarker(reference: CodeReference): string {
  if (reference.symbolKind !== undefined) {
    if ([4, 10, 22].includes(reference.symbolKind)) { return '◇'; }
    if ([5, 8, 11].includes(reference.symbolKind)) { return 'ƒ'; }
    if ([15, 19, 21].includes(reference.symbolKind)) { return '#'; }
    if ([1, 2, 3, 17, 18].includes(reference.symbolKind)) { return '{}'; }
    if ([6, 7, 12, 13].includes(reference.symbolKind)) { return '•'; }
    return '◈';
  }
  if (reference.blockKind === 'region') { return '▱'; }
  if (reference.blockKind === 'comment') { return '//'; }
  if (reference.blockKind === 'imports') { return '↳'; }
  const presentation = blockPresentation(reference);
  if (presentation.icon === '$(git-branch)') { return '⑂'; }
  if (presentation.icon === '$(sync)') { return '↻'; }
  return '{}';
}
