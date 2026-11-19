import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { assemble, cleanSuggestion, isEars, missingSlots } from '../hooks/compose'
import { inWorkspace } from '../hooks/vault'
import { checkQuestion, checkReply, unlinkedTerms } from '../hooks/lint'
import { basePrompt, currentReference, decisionNote, docsDocument, reviseAdrText, supersedeText, termNote, updateTermText, vaultIndex } from '../hooks/notes'

const ADR = `---
id: ADR-0007
status: proposed
scope: testing
---
Given     Specs run through a Gherkin runner. Each [[selector]] needs a [[step]] to be testable.
Decide    Can a spec be approved while one of its selectors has no step?

Where A:  When a spec is approved, the linter shall reject it if any [[selector]] has no [[step]].
          → every approved spec runs · can't approve before tests exist
Where B:  When a spec is approved, the linter shall warn if any [[selector]] has no [[step]].
          → approve early · specs and tests can drift apart
Combines  exclusive
Recommend A: keeps tests from outgrowing specs.
`

// The Decisions panel: the card on top, the reference under it.
const PANE = {
  plugin: 'decision-cards',
  component: 'Pane',
  requestId: 'decisions',
  props: {
    title: 'Decisions',
    isFocused: false,
    bodyColumns: 150,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const
const ANSWER_PANE = PANE
const NOTES_PANE = PANE

// The engine hands hooks absolute paths; the fake disk keys by the project-relative tail.
const rel = (path: string) => {
  const p = path.replace(/\\/g, '/')
  const lower = p.toLowerCase()
  const i = Math.max(lower.lastIndexOf('/decisions/'), lower.lastIndexOf('/terms/'), lower.lastIndexOf('/decisions'), lower.lastIndexOf('/terms'))
  if (i < 0) return p
  const tail = p.slice(i + 1)
  const slash = tail.indexOf('/')
  return slash < 0 ? tail.toLowerCase() : tail.slice(0, slash).toLowerCase() + tail.slice(slash)
}

type On = Parameters<TestBody>[1]
type Ui = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>

// Opens a folded section (base prompt rules or terms) if it is closed.
const unfold = async (ui: Pick<Ui, 'find' | 'press'>, key: string) => {
  const b = await ui.find({ key: `fold-${key}` })
  if (b && JSON.stringify(b).includes('▸')) await ui.press({ key: `fold-${key}` })
}

const fakeDisk = (on: On, files: Record<string, string>) => {
  let mtime = 1
  const dirOf = (path: string) => (rel(path).startsWith('terms') ? 'terms/' : 'decisions/')
  // The session's own project layer (cwd '/' → /vault) is empty here, so every note is the shared vault's.
  const isLayer = (path: string) => /^([a-z]:)?[\\/]vault([\\/]|$)/i.test(path)
  // A path exists when it is a file, or a folder holding one.
  on('fs.exists', (_, e) => {
    if (isLayer(e.path)) return { value: false }
    const r = rel(e.path).replace(/\/+$/, '')
    return { value: r in files || Object.keys(files).some(k => k.startsWith(`${r}/`)) }
  })
  on('fs.list', (_, e) => ({
    value: Object.keys(files)
      .filter(p => !isLayer(e.path) && p.startsWith(dirOf(e.path)))
      .map(p => ({ name: p.slice(dirOf(e.path).length), kind: 'file' as const, size: 1, mtimeMs: mtime, isLink: false })),
  }))
  on('fs.read', (_, e) => {
    const text = files[rel(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', (_, e) => {
    files[rel(e.path)] = e.text
    mtime += 1
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'decisions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  // A paused-typing timer fires at once here.
  on('clock.after', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('a proposed ADR becomes a card, and Accept records the pick', async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase a spec may use.\n',
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /ADR-0007/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /An approved phrase a spec may use/ })).toBeDefined()
    // `step` has no term note, so the card flags it.
    expect(await ui.find({ type: 'Text', text: /not defined yet/i })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'pick-ADR-0007.md-B' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  await ui.unmount()

  expect(files['decisions/ADR-0007.md']).toContain('status: accepted')
  expect(files['decisions/ADR-0007.md']).toContain('Decision  B')

  const after = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await after.find({ type: 'Text', text: /✓ accepted \(B\)/ })).toBeDefined()
  expect(await after.find({ type: 'Text', text: /Rule in force/ })).toBeDefined()
  await after.unmount()
})

test('a malformed ADR is drawn as an error card, not skipped', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0009.md': '---\nid: ADR-0009\nstatus: proposed\n---\nGiven  something\n' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const line = await ui.find({ type: 'Text', text: /Missing: Decide/ })
  expect(line?.text).toContain('Where X')
  await ui.unmount()
})

test('the Other form assembles an EARS sentence from its slots', () => {
  const draft = { pattern: 'If' as const, condition: 'a [[step]] fails.', system: 'ci', response: 'Shall block the merge.' }
  expect(assemble(draft)).toBe('If a [[step]] fails, then the [[ci]] shall block the merge.')
  expect(assemble({ ...draft, pattern: 'The', condition: '' })).toBe('The [[ci]] shall block the merge.')
  expect(assemble({ pattern: 'When', condition: '', system: '', response: '' })).toBe(
    'When <condition>, the <system> shall <response>.',
  )
  expect(missingSlots({ pattern: 'The', condition: '', system: 'ci', response: '' })).toEqual(['response'])
})

test('filling the Other form and accepting writes the rule into the ADR', async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/ci.md': '**Definition:** The automated checker.',
    'terms/step.md': '**Definition:** Test code for one selector.',
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const answer = await $.ui.mount({ ...ANSWER_PANE, surface: 'desktop' })
  const f = 'ADR-0007.md'
  await answer.select({ key: `pattern-${f}`, value: 'If' })
  await answer.input({ key: `cond-${f}`, text: 'a [[step]] fails', kind: 'change' })
  await answer.select({ key: `system-${f}`, value: 'ci' })
  await answer.input({ key: `resp-${f}`, text: 'block the merge', kind: 'change' })
  expect(JSON.stringify(await answer.find({ key: `sentence-${f}` }))).toContain('shall block the merge')
  await answer.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(JSON.stringify(await ui.find({ key: `accept-${f}` }))).toContain('Accept my rule')
  await ui.press({ key: `accept-${f}` })
  await ui.unmount()

  expect(files['decisions/ADR-0007.md']).toContain('Decision  Other')
  expect(files['decisions/ADR-0007.md']).toContain('Other     If a [[step]] fails, then the [[ci]] shall block the merge.')
})

test('an unfinished Other rule is not accepted', async ($, on) => {
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const answer = await $.ui.mount({ ...ANSWER_PANE, surface: 'terminal' })
  await answer.input({ key: 'resp-ADR-0007.md', text: 'block the merge', kind: 'change' })
  expect(await answer.find({ type: 'Text', text: /Still needed: condition, system/ })).toBeDefined()
  await answer.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  await ui.unmount()
  expect(files['decisions/ADR-0007.md']).toContain('status: proposed')
})

test('Notes shows rules first, keeps the record behind them, and follows links', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': accepted,
    'decisions/ADR-0008.md': ADR.replace('ADR-0007', 'ADR-0008'),
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase a spec may use.',
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...NOTES_PANE, surface })
    await unfold(ui, 'base:rules')
    // Rules: the rule in force, not its question.
    expect(await ui.find({ type: 'Text', text: /Rules in force · 1/ })).toBeDefined()
    expect(JSON.stringify(await ui.find({ key: 'rule-ADR-0007' }))).toContain('When a spec is approved, the linter shall reject it')
    expect(await ui.find({ type: 'Text', text: /Waiting on you · 1/ })).toBeDefined()

    // Opening a rule shows the rule; the record appears only when asked for.
    await ui.press({ key: 'idx-ADR-0007' })
    expect(await ui.find({ type: 'Text', text: /rule in force/ })).toBeDefined()
    expect(await ui.find({ key: 'note-record' })).toBeUndefined()
    await ui.press({ key: 'record-ADR-0007' })
    expect(await ui.find({ key: 'note-record' })).toBeDefined()
    await ui.press({ key: 'record-ADR-0007' })

    // A term on the decision card opens its note below, numbered as in the glossary.
    await ui.press({ key: 'term-selector' })
    expect(await ui.find({ type: 'Text', text: /1\.1  selector/ })).toBeDefined()

    await ui.press({ key: 'tab-terms' })
    expect(await ui.find({ type: 'Text', text: /Glossary · 1/ })).toBeDefined()
    await ui.press({ key: 'tab-docs' })
    expect(await ui.find({ key: 'docs-body' })).toBeDefined()
    await ui.press({ key: 'tab-rules' })
    await ui.unmount()
  }
})

test('Docs reads as one document: rules in ADR number order, then the glossary, then open questions', () => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const docs = docsDocument([
    decisionNote('ADR-0007', 'Decisions/ADR-0007.md', accepted),
    decisionNote('ADR-0008', 'Decisions/ADR-0008.md', ADR.replace('ADR-0007', 'ADR-0008')),
    termNote('selector', 'Terms/selector.md', '---\ntype: entity\n---\n**Definition:** An approved phrase.'),
  ])
  expect(docs).toContain('## 1. Rules in force')
  expect(docs).toContain('**1.1** When a spec is approved, the linter shall reject it if any [[selector]] has no [[step]].')
  expect(docs).toContain('Decided in [[ADR-0007|ADR-0007]]')
  expect(docs).toContain('**[[selector]]** *(entity)*: An approved phrase. Used in [[ADR-0007|ADR-0007]], [[ADR-0008|ADR-0008]].')
  expect(docs).toContain('## 3. Open questions')
})

test('pending ADRs are tabs; the active one shows, and tabs switch it', async ($, on) => {
  const second = ADR.replace('ADR-0007', 'ADR-0008').replace('Can a spec be approved', 'When should tests run')
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR, 'decisions/ADR-0008.md': second }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Can a spec be approved/ })).toBeDefined()
  await ui.press({ key: 'card-tab-ADR-0008.md' })
  expect(await ui.find({ type: 'Text', text: /^When should tests run/ })).toBeDefined()
  await ui.press({ key: 'card-tab-ADR-0007.md' })
  expect(await ui.find({ type: 'Text', text: /^Can a spec be approved/ })).toBeDefined()
  await ui.unmount()
})

test('the Free text tab sends plain words as a request', async ($, on) => {
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const answer = await $.ui.mount({ ...ANSWER_PANE, surface: 'desktop' })
  await answer.press({ key: 'mode-free-ADR-0007.md' })
  await answer.input({ key: 'free-ADR-0007.md', text: 'only run slow tests before a release', kind: 'change' })
  await answer.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  await ui.unmount()

  expect(files['decisions/ADR-0007.md']).toContain('status: answered')
  expect(files['decisions/ADR-0007.md']).toContain('Request   only run slow tests before a release')
})

test('editing a term replaces its definition and bumps its version', () => {
  const before = '---\ntype: entity\nversion: 2\n---\n**Definition:** Old meaning.\n'
  const after = updateTermText(before, 'actor', 'New meaning.')
  expect(after).toContain('version: 3')
  expect(after).toContain('type: actor')
  expect(after).toContain('**Definition:** New meaning.')
  expect(after).not.toContain('Old meaning')
})

test('a revision supersedes the old decision, and agents only see the newest', () => {
  const old = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const revised = reviseAdrText(old, 'ADR-0007', 'ADR-0009')
  expect(revised).toContain('supersedes: ADR-0007')
  expect(revised).toContain('Revises [[ADR-0007]]')
  expect(revised).not.toContain('Decision  A')

  const retired = supersedeText(old, 'ADR-0009')
  const notesNow = [
    decisionNote('ADR-0007', 'decisions/ADR-0007.md', retired),
    decisionNote('ADR-0009', 'decisions/ADR-0009.md', revised.replace('status: proposed', 'status: accepted') + '\nDecision  B\n'),
    termNote('selector', 'terms/selector.md', '---\ntype: entity\nversion: 4\n---\n**Definition:** An approved phrase.'),
  ]
  const ref = currentReference(notesNow)
  expect(ref).toContain('ADR-0009')
  expect(ref).toContain('Decided: B:')
  expect(ref).not.toContain('ADR-0007:')
  expect(ref).toContain('selector (entity, v4): An approved phrase.')
})

test('the browser edits a term in place', async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/selector.md': '---\ntype: entity\nversion: 1\n---\n**Definition:** An approved phrase a spec may use.',
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const decision = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await decision.press({ key: 'term-selector' })
  await decision.unmount()
  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await ui.press({ key: 'pencil-view-selector' })
  await ui.input({ key: 'edit-def-selector', text: 'A phrase a spec may use, bound to a step.', kind: 'change' })
  await ui.press({ key: 'edit-save-selector' })
  await ui.unmount()

  expect(files['terms/selector.md']).toContain('version: 2')
  expect(files['terms/selector.md']).toContain('**Definition:** A phrase a spec may use, bound to a step.')
})

test('accepting a revision marks the old decision superseded', async ($, on) => {
  const old = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': old,
    'decisions/ADR-0009.md': reviseAdrText(old, 'ADR-0007', 'ADR-0009'),
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'pick-ADR-0009.md-B' })
  await ui.press({ key: 'accept-ADR-0009.md' })
  await ui.unmount()

  expect(files['decisions/ADR-0009.md']).toContain('status: accepted')
  expect(files['decisions/ADR-0007.md']).toContain('status: superseded')
  expect(files['decisions/ADR-0007.md']).toContain('superseded_by: ADR-0009')
})

test('Defer keeps the card on screen as undecided; Reopen brings it back', async ($, on) => {
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'defer-ADR-0007.md' })
  expect(files['decisions/ADR-0007.md']).toContain('status: deferred')
  expect(await ui.find({ type: 'Text', text: /deferred: still undecided/ })).toBeDefined()
  await ui.unmount()

  const notesPane = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await notesPane.press({ key: 'idx-ADR-0007' })
  await notesPane.press({ key: 'reopen-ADR-0007' })
  await notesPane.unmount()
  expect(files['decisions/ADR-0007.md']).toContain('status: proposed')
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await again.find({ type: 'Text', text: /needs your decision/ })).toBeDefined()
  await again.unmount()
})

test('a pencil opens a rule for editing, and saving rewords it in place', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = { 'decisions/ADR-0007.md': accepted }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await unfold(ui, 'base:rules')
  await ui.press({ key: 'pencil-rules-ADR-0007' })
  await ui.input({ key: 'rule-def-ADR-0007', text: 'When a spec is approved, the linter shall reject it if any [[selector]] lacks a [[step]].', kind: 'change' })
  await ui.press({ key: 'rule-save-ADR-0007' })
  await ui.unmount()

  const adr = files['decisions/ADR-0007.md'] ?? ''
  expect(adr).toContain('Where A:  When a spec is approved, the linter shall reject it if any [[selector]] lacks a [[step]].')
  expect(adr).toContain('version: 2')
  expect(adr).not.toContain('has no [[step]].\n          → every')
})

test('a rule edit that is not an EARS sentence is refused', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = { 'decisions/ADR-0007.md': accepted }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await unfold(ui, 'base:rules')
  await ui.press({ key: 'pencil-rules-ADR-0007' })
  await ui.input({ key: 'rule-def-ADR-0007', text: 'just reject bad specs', kind: 'change' })
  await ui.press({ key: 'rule-save-ADR-0007' })
  await ui.unmount()
  expect(files['decisions/ADR-0007.md']).toBe(accepted)
})

test('the vault index lists current terms, decisions in force, waiting and superseded ones', () => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const index = vaultIndex([
    termNote('ci', 'Terms/ci.md', '---\ntype: actor\nversion: 2\n---\n**Definition:** The checker.'),
    decisionNote('ADR-0007', 'Decisions/ADR-0007.md', supersedeText(accepted, 'ADR-0011')),
    decisionNote('ADR-0011', 'Decisions/ADR-0011.md', accepted.replace('ADR-0007', 'ADR-0011')),
    decisionNote('ADR-0012', 'Decisions/ADR-0012.md', ADR.replace('ADR-0007', 'ADR-0012')),
  ])
  expect(index).toContain('- **1.1** [[ci]] *(actor, v2)*: The checker.')
  expect(index).toContain('- **2.1** [[ADR-0011|ADR-0011]]')
  expect(index).toContain('[[ADR-0012|ADR-0012]] *proposed*')
  expect(index).toContain('[[ADR-0007|ADR-0007]] → [[ADR-0011]]')
})

test('a suggestion is kept only when it is an EARS sentence, with links only to known terms', () => {
  expect(isEars('When a change is committed, the ci shall run every step.')).toBe(true)
  expect(isEars('If a step fails, then the ci shall block the merge.')).toBe(true)
  expect(isEars('If a step fails, the ci shall block the merge.')).toBe(false)
  expect(isEars('Run the slow tests before a release.')).toBe(false)
  expect(cleanSuggestion('"When a [[release]] is prepared, the [[ci]] shall run every [[step]]"', ['ci', 'step'])).toBe(
    'When a release is prepared, the [[ci]] shall run every [[step]].',
  )
  expect(cleanSuggestion('Sure! Here is a rule.', ['ci'])).toBe('')
})

test('Suggest rule rewrites the words in place, and Accept keeps the originals as the request', async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/ci.md': '**Definition:** The automated checker.',
    'terms/step.md': '**Definition:** Test code for one selector.',
  }
  fakeDisk(on, files)
  const asked: string[] = []
  on('model.complete', (_, e) => {
    asked.push(String(e.prompt))
    return { value: { isAnswered: true, text: '{"rule": "When a release is prepared, the [[ci]] shall run every [[step]].", "unclear": []}', usage: {} } } as never
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mode-free-ADR-0007.md' })
  await ui.input({ key: 'free-ADR-0007.md', text: 'only run the slow tests before a release', kind: 'change' })
  expect(asked.length).toBe(0)
  await ui.press({ key: 'suggest-ADR-0007.md' })
  expect(asked[0]).toContain('only run the slow tests before a release')

  // The field now holds the rule, and the button says so.
  const field = await ui.find({ key: 'free-ADR-0007.md' })
  expect(JSON.stringify(field)).toContain('When a release is prepared, the [[ci]] shall run every [[step]].')
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Accept rule: When a release is prepared')
  expect(await ui.find({ key: 'undo-ADR-0007.md' })).toBeDefined()

  await ui.press({ key: 'accept-ADR-0007.md' })
  await ui.unmount()

  const adr = files['decisions/ADR-0007.md'] ?? ''
  expect(adr).toContain('status: accepted')
  expect(adr).toContain('Other     When a release is prepared, the [[ci]] shall run every [[step]].')
  expect(adr).toContain('Request   only run the slow tests before a release')
})

test('when no rule can be made, the vague phrases are highlighted with what is missing', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  on('model.complete', () => ({
    value: { isAnswered: true, text: '{"rule": null, "unclear": [{"phrase": "the slow tests", "why": "which tests count as slow?"}, {"phrase": "made up", "why": "x"}]}', usage: {} },
  }) as never)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mode-free-ADR-0007.md' })
  await ui.input({ key: 'free-ADR-0007.md', text: 'only run the slow tests sometimes', kind: 'change' })
  await ui.press({ key: 'suggest-ADR-0007.md' })
  expect(await ui.find({ type: 'Text', text: /NEEDS MORE DETAIL/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /“the slow tests”: which tests count as slow\?/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /made up/ })).toBeUndefined()
  // The words stay as typed (nothing was rewritten), shown with the vague part flagged.
  expect(await ui.find({ type: 'Text', text: /^only run the slow tests sometimes$/ })).toBeDefined()
  expect(await ui.find({ key: 'undo-ADR-0007.md' })).toBeUndefined()
  await ui.unmount()
})

test('a term link can be inserted into the words, and the button names the option it would accept', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR, 'terms/ci.md': '**Definition:** The automated checker.' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // (Focus moves made by the person can't be raised from the test kit; picking an option is.)
  await ui.press({ key: 'pick-ADR-0007.md-B' })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Accept B: When a spec is approved, the linter shall warn')

  await ui.press({ key: 'mode-free-ADR-0007.md' })
  await ui.input({ key: 'free-ADR-0007.md', text: 'ask the', kind: 'change' })
  await ui.select({ key: 'free-link-ADR-0007.md', value: 'ci' })
  expect(JSON.stringify(await ui.find({ key: 'free-ADR-0007.md' }))).toContain('ask the [[ci]]')
  expect(await ui.find({ type: 'Text', text: /READS AS/ })).toBeDefined()
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Send my words: “ask the ci')
  await ui.unmount()
})

test('the question tool is refused with how to write a proposed ADR instead', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  on('tool.call', () => ({ result: {} }) as never)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ran = await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: 'Which one?', header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
  } as never)
  const said = JSON.stringify(ran)
  expect(said).toContain('decision cards')
  expect(said).toContain('ADR-0008.md')
  expect(said).toContain('Where A:  When <trigger>')
  expect(said).toContain('appears in the Decisions panel')
  expect(said).not.toContain('/decisions')
})

test('accepting or deferring a card tells the agent in the conversation', async ($, on) => {
  const second = ADR.replace('ADR-0007', 'ADR-0008')
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR, 'decisions/ADR-0008.md': second }
  fakeDisk(on, files)
  const session = mock.session(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  await ui.press({ key: 'defer-ADR-0008.md' })
  await ui.unmount()

  const notes = JSON.stringify(session.appended())
  expect(notes).toContain('ADR-0007 accepted. Rule in force: When a spec is approved, the linter shall reject it')
  expect(notes).toContain('ADR-0008 was deferred by the person')
})

test('the vault folders and templates are created where missing', async ($, on) => {
  const files: Record<string, string> = {}
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const written = Object.keys(files).map(k => k.replace(/\\/g, '/'))
  expect(written.some(k => k.endsWith('decisions/.keep'))).toBe(true)
  expect(written.some(k => k.endsWith('terms/.keep'))).toBe(true)
  expect(written.some(k => k.endsWith('Specs/.keep'))).toBe(true)
  expect(written.some(k => k.endsWith('Templates/Question (ADR).md'))).toBe(true)
  expect(written.some(k => k.endsWith('.obsidian/templates.json'))).toBe(true)
})

test('Docs sections start closed, open on click, and render their items as Markdown', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': accepted,
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.',
  }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-docs' })
  expect(await ui.find({ key: 'docs-toggle-base:rules-doc' })).toBeDefined()
  expect(await ui.find({ key: 'docs-rule-ADR-0007' })).toBeUndefined()

  await ui.press({ key: 'docs-toggle-base:rules-doc' })
  const rule = await ui.find({ key: 'docs-rule-ADR-0007' })
  expect(JSON.stringify(rule)).toContain('**1.1** When a spec is approved')
  expect(JSON.stringify(rule)).toContain('file:///note/ADR-0007')

  await ui.press({ key: 'docs-toggle-base:rules-doc' })
  expect(await ui.find({ key: 'docs-rule-ADR-0007' })).toBeUndefined()

  await ui.press({ key: 'docs-expand-all' })
  expect(await ui.find({ key: 'docs-term-selector' })).toBeDefined()
  await ui.press({ key: 'docs-collapse-all' })
  expect(await ui.find({ key: 'docs-term-selector' })).toBeUndefined()
  await ui.unmount()
})


test('one Decisions panel holds the card and the reference, and keeps a decided card', async ($, on) => {
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'accept-ADR-0007.md' })).toBeDefined()
    expect(await ui.find({ key: 'mode-free-ADR-0007.md' })).toBeDefined()
    expect(await ui.find({ key: 'tab-rules' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  expect(await ui.find({ type: 'Text', text: /✓ accepted \(A\)/ })).toBeDefined()
  expect(await ui.find({ key: 'tab-rules' })).toBeDefined()
  await ui.unmount()
})

test('Talk with me more sends the prompt to the agent and asks it to revise the ADR', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'talk-text-ADR-0007.md' })).toBeUndefined()
  await ui.press({ key: 'talk-ADR-0007.md' })
  await ui.input({ key: 'talk-text-ADR-0007.md', text: 'where is this stored, and what can read it?', kind: 'change' })
  await ui.press({ key: 'talk-send-ADR-0007.md' })
  expect(await ui.find({ key: 'talk-text-ADR-0007.md' })).toBeUndefined()
  await ui.unmount()

  expect(sent.length).toBe(1)
  expect(sent[0]).toContain('Before I decide ADR-0007')
  expect(sent[0]).toContain('where is this stored, and what can read it?')
  expect(sent[0]).toContain('keep status: proposed')
})

test('after typing free text, clicking an option moves the button to that option and keeps it there', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'mode-free-ADR-0007.md' })
  await ui.input({ key: 'free-ADR-0007.md', text: 'something in my own words', kind: 'change' })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Send my words')

  // Clicking the body of option B (not only its label) selects it.
  await ui.press({ key: 'pick-ADR-0007.md-B' })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Accept B:')

  // The field sending the same text again (as on losing focus) does not take it back.
  await ui.input({ key: 'free-ADR-0007.md', text: 'something in my own words', kind: 'change' })
  await ui.input({ key: 'free-ADR-0007.md', text: 'something in my own words', kind: 'submit' })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Accept B:')

  // Real typing does.
  await ui.input({ key: 'free-ADR-0007.md', text: 'something else entirely', kind: 'change' })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Send my words')
  await ui.unmount()
})

test('every click on an option moves the selection, not only the first', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))
  await ui.press({ key: 'pick-ADR-0007.md-B' })
  expect(await label()).toContain('Accept B:')
  await ui.press({ key: 'pick-ADR-0007.md-A' })
  expect(await label()).toContain('Accept A:')
  await ui.press({ key: 'pick-ADR-0007.md-B' })
  expect(await label()).toContain('Accept B:')
  await ui.unmount()
})

test('clicking a blue link anywhere on the card opens that note in Reference', async ($, on) => {
  fakeDisk(on, {
    'decisions/ADR-0007.md': ADR,
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.',
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const given = await ui.find({ key: 'given-ADR-0007.md' })
  expect(JSON.stringify(given)).toContain('file:///note/selector')
  await ui.press({ key: 'given-ADR-0007.md', link: { href: 'file:///note/selector' } } as never)
  expect(await ui.find({ type: 'Text', text: /1\.1  selector/ })).toBeDefined()
  await ui.unmount()
})

test('option text is wrapped across buttons, never cut off', async ($, on) => {
  const long = ADR.replace('the linter shall reject it if any [[selector]] has no [[step]].', 'the linter shall reject it if any [[selector]] has no [[step]], and it shall say which selector is missing, which spec it belongs to, and what to write next.')
  fakeDisk(on, { 'decisions/ADR-0007.md': long })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 60 }, surface: 'desktop' })
  const lines: string[] = []
  for (let i = 0; i < 12; i++) {
    const b = await ui.find({ key: `pickbody-ADR-0007.md-A-${i}` })
    if (!b) break
    lines.push(String((b as { text?: string }).text ?? ''))
  }
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.join(' ')).toContain('and what to write next.')
  expect(lines.some(l => l.includes('…'))).toBe(false)
  await ui.press({ key: `pickbody-ADR-0007.md-A-${lines.length - 1}` })
  expect(JSON.stringify(await ui.find({ key: 'accept-ADR-0007.md' }))).toContain('Accept A:')
  await ui.unmount()
})

test('the reply check follows the template: optional lines, fixed opening words, in order, at most 8 lines', () => {
  const good = [
    'Done       Added the reply checker',
    'Done       Fixed the panel crash',
    'Open       [[ADR-0018]] is not done',
    'Needs you  Decide [[ADR-0020]]',
    'Check      Run `claude plugin test` → 36 pass',
  ].join('\n')
  expect(checkReply(good)).toEqual([])
  expect(checkReply('Done Added one thing')).toEqual([])
  expect(checkReply('```\nDone       Added it\n```')).toEqual([])
  expect(checkReply('| Done | Changed the template |\n| Check | Open the panel → the card shows |')).toEqual([])
  expect(checkReply('Here is what I did. It went well.').join(' ')).toContain('no labelled lines')
  expect(checkReply('Done I wrote the checker').join(' ')).toContain('Done line must be')
  expect(checkReply('Open the checker is unverified').join(' ')).toContain('Open line must be')
  expect(checkReply('Check Run the tests').join(' ')).toContain('Check line must be')
  expect(checkReply('Needs you Decide [[ADR-1]]\nDone Added it').join(' ')).toContain('out of order')
  expect(checkReply('Check Run a → b\nCheck Run c → d').join(' ')).toContain('Check appears more than once')
  expect(checkReply(Array.from({ length: 9 }, (_, k) => `Done Added item ${k}`).join('\n')).join(' ')).toContain('9 lines; the limit is 8')
})
test('the question check catches a broken proposed ADR, and passes a good one', () => {
  const notesNow = [
    { name: 'ci', kind: 'term' as const, subtitle: 'actor' },
    { name: 'test-sprawl', kind: 'term' as const, subtitle: 'problem' },
  ]
  const good = {
    decide: 'Should tests run on every commit?',
    options: [
      { letter: 'A', rule: 'When a change is committed, the [[ci]] shall run every step.', consequence: 'fast · costly' },
      { letter: 'B', rule: 'When a release is prepared, the [[ci]] shall run every step.', consequence: 'cheap · late' },
    ],
    recommend: 'A',
    names: ['ci', 'test-sprawl'],
    error: null,
  }
  expect(checkQuestion(good, notesNow)).toEqual([])
  const bad = {
    ...good,
    decide: 'Tests on commit',
    options: [{ ...good.options[0]!, rule: 'run the tests a lot', consequence: '' }, good.options[1]!],
    names: ['ci', 'pipeline'],
  }
  const said = checkQuestion(bad, notesNow).join(' | ')
  expect(said).toContain('ending in "?"')
  expect(said).toContain('Where A is not an EARS rule')
  expect(said).toContain('Where A has no')
  expect(said).toContain('no note for [[pipeline]]')
  expect(said).toContain('Given must link the problem it serves')
})

test('writing a proposed ADR that breaks the question rule is refused, with what to fix', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR, 'terms/test-sprawl.md': '---\ntype: problem\n---\n**Definition:** Tests grow.' })
  on('tool.call', () => ({ result: {} }) as never)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])
  const ran = await $.tool.call({
    tool: 'Write',
    file_path: 'C:/Users/Aaron/Documents/Projects/personal/agent-vault/Decisions/ADR-0099.md',
    content: '---\nid: ADR-0099\nstatus: proposed\n---\nGiven     Something.\nDecide    Pick one\n\nWhere A:  do it\nWhere B:  do not\n',
  } as never)
  const said = JSON.stringify(ran)
  expect(said).toContain('breaks ADR-0001')
  expect(said).toContain('ending in')
})

test('a reply that breaks the reply rule is flagged under it, and the agent is told', async ($, on) => {
  const accepted17 = '---\nid: ADR-0004\nstatus: accepted\n---\nGiven     x [[long-replies]]\nDecide    Which shape?\nWhere A:  When an agent replies, the agent shall use four lines.\n          → a · b\nWhere B:  When an agent replies, the agent shall write prose.\n          → c · d\nRecommend A: x\n\nDecision  A\n'
  fakeDisk(on, { 'decisions/ADR-0004.md': accepted17 })
  const session = mock.session(on)
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])
  const result = await $.turn.complete({
    reason: 'answer',
    answer: 'I did a lot of things today and here is a long story about them.',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
  } as never)
  expect(JSON.stringify(result)).toContain('This reply breaks ADR-0004')
  expect(JSON.stringify(session.appended())).toContain('Your last reply broke ADR-0004')
})

test('a finished tab closes with its ×, and parked decisions are out of what agents read', async ($, on) => {
  const parked = ADR.replace('ADR-0007', 'ADR-0013').replace('status: proposed', 'status: parked') + '\nDecision  A\n'
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR, 'decisions/ADR-0013.md': parked }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'accept-ADR-0007.md' })
  expect(await ui.find({ key: 'close-tab-ADR-0007.md' })).toBeDefined()
  await ui.press({ key: 'close-tab-ADR-0007.md' })
  expect(await ui.find({ key: 'card-tab-ADR-0007.md' })).toBeUndefined()
  await ui.unmount()

  const ref = currentReference([decisionNote('ADR-0013', 'Decisions/ADR-0013.md', parked)])
  expect(ref).not.toContain('ADR-0013')
})

test('every instance of a defined term must be linked, in questions and replies', () => {
  const names = ['spec', 'step', 'long-replies', 'adr']
  expect(unlinkedTerms('Each [[spec]] has a [[step]].', names)).toEqual([])
  expect(unlinkedTerms('Each spec has two steps.', names)).toEqual(['spec', 'step'])
  expect(unlinkedTerms('This fixes long replies.', names)).toEqual(['long-replies'])
  expect(unlinkedTerms('See ADR-0018 and `spec.md`.', names)).toEqual([])
  expect(unlinkedTerms('Two ADRs are open.', names)).toEqual(['adr'])
  expect(unlinkedTerms('A specification is not a spec-0001 id.', names)).toEqual([])

  expect(checkReply('Done Added a spec', names).join(' ')).toContain('unlinked terms: spec')
  expect(checkReply('Done Added a [[spec]]', names)).toEqual([])

  const notesNow = [
    { name: 'ci', kind: 'term' as const, subtitle: 'actor' },
    { name: 'test-sprawl', kind: 'term' as const, subtitle: 'problem' },
  ]
  const q = {
    given: 'The ci runs too much, which is [[test-sprawl]].',
    decide: 'Should the [[ci]] run less?',
    options: [
      { letter: 'A', rule: 'When a change is committed, the [[ci]] shall run every step.', consequence: 'fast · costly' },
      { letter: 'B', rule: 'When a release is prepared, the [[ci]] shall run every step.', consequence: 'cheap · late' },
    ],
    recommend: 'A',
    names: ['ci', 'test-sprawl'],
    error: null,
  }
  expect(checkQuestion(q, notesNow).join(' ')).toContain('unlinked terms: [[ci]]')
})

test('the generated Docs and Index link every defined term they mention', () => {
  const linkedAdr = ADR.replace('Can a spec be approved while one of its selectors has no step?', 'Can a [[spec]] be approved while one of its [[selector]]s has no [[step]]?')
    .replace('When a spec is approved', 'When a [[spec]] is approved')
  const accepted = linkedAdr.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const all = [
    decisionNote('ADR-0007', 'Decisions/ADR-0007.md', accepted),
    termNote('selector', 'Terms/selector.md', '---\ntype: entity\n---\n**Definition:** An approved phrase a [[spec]] may use.'),
    termNote('spec', 'Terms/spec.md', '---\ntype: entity\n---\n**Definition:** A short file of [[rule|rules]].'),
    termNote('rule', 'Terms/rule.md', '---\ntype: entity\n---\n**Definition:** One sentence in force.'),
    termNote('term', 'Terms/term.md', '---\ntype: entity\n---\n**Definition:** A defined word.'),
    termNote('step', 'Terms/step.md', '---\ntype: entity\n---\n**Definition:** Test code.'),
  ]
  const names = all.filter(n => n.kind === 'term').map(n => n.name)
  // headings are labels, not prose; everything else must link
  const prose = (md: string) => md.split('\n').filter(l => !l.startsWith('#') && !/^\d+\. /.test(l)).join('\n')
  expect(unlinkedTerms(prose(docsDocument(all)), names)).toEqual([])
  expect(unlinkedTerms(prose(vaultIndex(all)), names)).toEqual([])
})

const GLOSSARY: Record<string, string> = {
  'terms/agent.md': '---\ntype: actor\n---\n**Definition:** An AI doing work.',
  'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.',
  'terms/step.md': '---\ntype: entity\n---\n**Definition:** Test code for a selector.',
  'terms/test-sprawl.md': '---\ntype: problem\n---\n**Definition:** Tests grow too much.',
}

test('the glossary filters by search, by first letter and by type', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR, ...GLOSSARY })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-terms' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 4$/ })).toBeDefined()

  await ui.press({ key: 'letter-S' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 2 of 4/ })).toBeDefined()
  expect(await ui.find({ key: 'idx-agent' })).toBeUndefined()
  await ui.press({ key: 'letter-all' })

  await ui.select({ key: 'term-type', value: 'problem' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 1 of 4/ })).toBeDefined()
  expect(await ui.find({ key: 'idx-test-sprawl' })).toBeDefined()
  await ui.select({ key: 'term-type', value: '' })

  await ui.input({ key: 'term-search', text: 'phrase', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 1 of 4/ })).toBeDefined()
  expect(await ui.find({ key: 'idx-selector' })).toBeDefined()
  await ui.unmount()
})

test('docs search lists matching rules and terms instead of the sections', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  fakeDisk(on, { 'decisions/ADR-0007.md': accepted, ...GLOSSARY })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-docs' })
  await ui.input({ key: 'docs-search', text: 'linter', kind: 'change' })
  expect(await ui.find({ type: 'Text', text: /1 match for “linter”/ })).toBeDefined()
  expect(JSON.stringify(await ui.find({ key: 'docs-hit-ADR-0007' }))).toContain('the linter shall reject it')
  expect(await ui.find({ key: 'docs-toggle-base:rules-doc' })).toBeUndefined()
  await ui.input({ key: 'docs-search', text: '', kind: 'change' })
  expect(await ui.find({ key: 'docs-toggle-base:rules-doc' })).toBeDefined()
  await ui.unmount()
})

test('back and forward step through the notes opened in Reference', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR, ...GLOSSARY })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'nav-back' })).toBeUndefined()
  await ui.press({ key: 'tab-terms' })
  await unfold(ui, 'base:terms')
  await ui.press({ key: 'idx-agent' })
  expect(await ui.find({ type: 'Text', text: /1\.1  agent/ })).toBeDefined()
  await ui.press({ key: 'notes-back' })
  await ui.press({ key: 'idx-selector' })
  expect(await ui.find({ type: 'Text', text: /1\.2  selector/ })).toBeDefined()

  await ui.press({ key: 'nav-back' })
  await ui.press({ key: 'nav-back' })
  expect(await ui.find({ type: 'Text', text: /1\.1  agent/ })).toBeDefined()
  await ui.press({ key: 'nav-forward' })
  await ui.press({ key: 'nav-forward' })
  expect(await ui.find({ type: 'Text', text: /1\.2  selector/ })).toBeDefined()
  expect(await ui.find({ key: 'nav-forward' })).toBeUndefined()
  await ui.unmount()
})

test('the base prompt carries the rules in force, the reply and question shapes, and the terms', () => {
  const accepted = decisionNote('ADR-0007', 'd/ADR-0007.md', ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n')
  const waiting = decisionNote('ADR-0009', 'd/ADR-0009.md', ADR.replace('ADR-0007', 'ADR-0009'))
  const term = termNote('selector', 't/selector.md', '---\ntype: entity\n---\n**Definition:** An approved [[phrase]].\n')
  const text = basePrompt([accepted, waiting, term], 'C:/vault/Decisions')
  expect(text).toContain('- ADR-0007: When a spec is approved, the linter shall reject it if any selector has no step.')
  expect(text).toContain('Needs you  <Decide ADR-nnnn')
  expect(text).toContain('Write a proposed ADR into C:/vault/Decisions')
  expect(text).toContain('Waiting on the person: ADR-0009.')
  expect(text).toContain('- selector (entity): An approved phrase.')
  expect(text).not.toContain('[[phrase]]')
})

test('a rule marked prompt: record stays out of the base prompt and the reference, but stays in force', () => {
  const kept = decisionNote('ADR-0002', 'd/ADR-0002.md', ADR.replace('ADR-0007', 'ADR-0002').replace('status: proposed', 'status: accepted') + '\nDecision  A\n')
  const setup = decisionNote(
    'ADR-0001',
    'd/ADR-0001.md',
    ADR.replace('ADR-0007', 'ADR-0001').replace('status: proposed', 'status: accepted\nprompt: record') + '\nDecision  B\n',
  )
  expect(setup.record).toBe(true)
  expect(setup.rule).not.toBe('')
  const text = basePrompt([kept, setup], 'C:/vault/Decisions')
  expect(text).toContain('- ADR-0002:')
  expect(text).not.toContain('ADR-0001')
  expect(currentReference([kept, setup])).not.toContain('ADR-0001')
})

test("a project's vault folder is layered over the shared vault, the project's note winning", async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** The shared meaning.\n',
    'terms/step.md': '---\ntype: entity\n---\n**Definition:** Shared step.\n',
    '/proj/vault/Terms/selector.md': '---\ntype: entity\n---\n**Definition:** The project meaning.\n',
  }
  // Project paths keep their /proj/vault tail; shared ones fold to decisions/ and terms/.
  const norm = (path: string) => {
    const p = path.replace(/\\/g, '/')
    const at = p.indexOf('/proj/vault')
    if (at >= 0) return p.slice(at)
    const r = rel(p)
    return /^(terms|decisions)$/i.test(r) ? r.toLowerCase() : r
  }
  const under = (dir: string) => `${norm(dir).replace(/\/+$/, '')}/`
  on('fs.exists', (_, e) => ({ value: norm(e.path) in files || Object.keys(files).some(k => k.startsWith(under(e.path))) }))
  on('fs.list', (_, e) => ({
    value: Object.keys(files)
      .filter(k => k.startsWith(under(e.path)) && !k.slice(under(e.path).length).includes('/'))
      .map(k => ({ name: k.slice(under(e.path).length), kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', (_, e) => {
    const text = files[norm(e.path)]
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', (_, e) => {
    files[norm(e.path)] = e.text
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'decisions' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])

  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-terms' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 2$/ })).toBeDefined()
  await ui.press({ key: 'idx-selector' })
  expect(await ui.find({ type: 'Markdown', text: /The project meaning\./ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /The shared meaning\./ })).toBeUndefined()
  await ui.unmount()
})

test('the mod runs only in sessions under the workspace folder', () => {
  expect(inWorkspace(String.raw`C:\Users\A\Documents\Projects\personal\x`, 'C:/Users/A/Documents/Projects')).toBe(true)
  expect(inWorkspace('C:/Users/A/Documents/Projects', 'C:/Users/A/Documents/Projects/')).toBe(true)
  expect(inWorkspace('C:/Users/A/Documents/ProjectsOld/x', 'C:/Users/A/Documents/Projects')).toBe(false)
  expect(inWorkspace('C:/Temp/scratch', 'C:/Users/A/Documents/Projects')).toBe(false)
  expect(inWorkspace('C:/Temp/scratch', '')).toBe(true)
})

test('rules list in ADR number order, inside a folded Base prompt section', async ($, on) => {
  const accepted = (id: string) => ADR.replace('ADR-0007', id).replace('status: proposed', 'status: accepted').replace('scope: testing', `scope: ${id === 'ADR-0010' ? 'alpha' : 'zeta'}`) + '\nDecision  A\n'
  fakeDisk(on, { 'decisions/ADR-0010.md': accepted('ADR-0010'), 'decisions/ADR-0002.md': accepted('ADR-0002') })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])
  const ui = await $.ui.mount({ ...NOTES_PANE, surface: 'desktop' })
  expect(JSON.stringify(await ui.find({ key: 'fold-base:rules' }))).toContain('▸ Base prompt rules')
  expect(await ui.find({ key: 'rule-ADR-0002' })).toBeUndefined()
  await ui.press({ key: 'fold-base:rules' })
  const order = (await ui.findAll({ type: 'Button', text: /^ADR-00/ })).map(b => JSON.stringify(b).match(/ADR-00\d\d/)?.[0])
  expect(order.slice(0, 2)).toEqual(['ADR-0002', 'ADR-0010'])
  await ui.unmount()
})
