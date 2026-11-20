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
    'decided_by: \"\"',
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
    'Given     At most two sentences: why the question came up, and the problem it serves, linked: [[problem]]. Link every [[term]].',
    'Decide    One sentence ending in "?" that names what changes for the person, not only the mechanism.',
    '',
    'Where A:  When <trigger>, <actor> <responds>.',
    '          → what happens · what it costs',
    'Where B:  When <trigger>, <actor> <responds>.',
    '          → what happens · what it costs',
    'Combines  exclusive (or which options can be picked together)',
    'Recommend A: one-sentence reason.',
    '',
  ].join('\n'),
  'Response.md': [
    '| | |',
    '| --- | --- |',
    '| **Done** | <Added \\| Changed \\| Fixed \\| Removed \\| Found> <thing, with [term](full path to its note) links> |',
    '| **Open** | <thing> is <not started \\| not done \\| blocked> |',
    '| **Needs you** | <Decide <the question open in the dialog> \\| Approve <action> \\| Do <step>> |',
    '| **Check** | <Run `command` \\| Open <link>> → <what you should see> |',
    '',
    'The whole reply is this table: no text before or after it, and never in a code block, so links work. Each row is optional and at most two sentences; keep this order, at most 8 rows. Start each row with one of its listed words. Done and Open may repeat, one item per row; Needs you and Check appear at most once. Needs you never asks for a decision itself: decisions are asked in the dialog.',
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
    'Rule: REQ-001 When <trigger>, <actor> <responds>.',
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

// ADR-0013: the mod runs only in sessions whose folder is under the workspace root
// (every session when no root is set).
export const inWorkspace = (cwd: string, workspaceRoot: string): boolean => {
  if (!workspaceRoot.trim()) return true
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const dir = norm(cwd)
  const base = norm(workspaceRoot)
  return dir === base || dir.startsWith(`${base}/`)
}
