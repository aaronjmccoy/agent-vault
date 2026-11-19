// The vault's starting files, written where missing so the framework is ready
// on any machine: the templates, and a marker so each folder exists.

export const TEMPLATES: Readonly<Record<string, string>> = {
  'Term.md': [
    '---',
    'notation: t-xxxx',
    'type: entity',
    'aliases: []',
    'version: 1',
    'status: approved',
    '---',
    '**Definition:** One sentence: what {{title}} means here. Link other terms as [[term]].',
    '',
  ].join('\n'),
  'Question (ADR).md': [
    '---',
    'id: {{title}}',
    'status: proposed',
    'scope: area',
    '---',
    'Given     At most two plain sentences of context. Link every term: [[term]].',
    'Decide    One sentence ending in "?" that says what changes for the person deciding.',
    '',
    'Where A:  When <trigger>, the [[system]] shall <response>.',
    '          → what happens · what it costs',
    'Where B:  When <trigger>, the [[system]] shall <response>.',
    '          → what happens · what it costs',
    'Combines  exclusive',
    'Recommend A: one-sentence reason.',
    '',
  ].join('\n'),
  'Response.md': [
    '```gherkin',
    'Given [[job]] asked to <what the person asked, one line>',
    'When  <what was done, one line, with links>',
    'Then  <what is now true>',
    'And   <optional: more that is now true>',
    'But   <optional: what a reader might wrongly assume from Then>',
    '```',
    '',
    'Given, When and Then are required. Use And and But only when there is something to say.',
    '',
  ].join('\n'),
  'Spec.md': [
    '---',
    'id: {{title}}',
    'status: draft',
    'version: 1',
    '---',
    '```gherkin',
    'Feature: [[feature-term]]',
    '',
    'Rule: REQ-001 When [[trigger]], the [[system]] shall [[response]].',
    '  Scenario: <one concrete case>',
    '    Given [[thing]] is <state>',
    '    When [[actor]] <does something>',
    '    Then [[thing]] equals <value>',
    '```',
    '',
  ].join('\n'),
}

// The vault root is the folder that holds the Decisions folder.
export const vaultRootOf = (adrDir: string): string => adrDir.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '')

// ADR-0007: the mod runs only in sessions whose folder is under the workspace root
// (every session when no root is set).
export const inWorkspace = (cwd: string, workspaceRoot: string): boolean => {
  if (!workspaceRoot.trim()) return true
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const dir = norm(cwd)
  const base = norm(workspaceRoot)
  return dir === base || dir.startsWith(`${base}/`)
}
