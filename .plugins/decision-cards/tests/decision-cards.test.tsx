import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { inWorkspace } from '../hooks/vault'
import { checkQuestion, checkReply, unlinkedTerms } from '../hooks/lint'
import { basePrompt, currentReference, decisionNote, docsDocument, supersedeText, termNote, vaultIndex } from '../hooks/notes'

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


const revisionOf = (old: string) =>
  old.replace('id: ADR-0007', 'id: ADR-0009').replace('status: accepted', 'status: proposed\nsupersedes: ADR-0007').replace(/\n\nDecision  A\n$/, '\n')

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

test('a revision supersedes the old decision, and agents only see the newest', () => {
  const old = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const revised = revisionOf(old)
  expect(revised).toContain('supersedes: ADR-0007')
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

test('a question with no proposed ADR behind it is refused, with how to write one', async ($, on) => {
  fakeDisk(on, { 'decisions/ADR-0007.md': ADR })
  on('tool.call', () => ({ result: {} }) as never)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: 'Which one?', header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
  } as never)
  const said = JSON.stringify(ran)
  expect(said).toContain('Not asked')
  expect(said).toContain('ADR-0008.md')
  expect(said).toContain('Where A:  When <trigger>')
  expect(said).toContain('header set to the ADR id')
})

test('the native dialog is filled from the ADR, and the pick is written back', async ($, on) => {
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': ADR,
    'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.',
  }
  fakeDisk(on, files)
  let shown: { question: string; header: string; options: { label: string; description: string; preview?: string }[] }[] = []
  on('tool.call', (_, e) => {
    shown = (e as unknown as { questions: typeof shown }).questions
    return { result: { questions: shown, answers: { [shown[0]!.question]: 'Option B' } } } as never
  })
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
  const ran = await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: 'anything', header: 'ADR-0007', multiSelect: false, options: [{ label: 'x', description: 'x' }, { label: 'y', description: 'y' }] }],
  } as never)
  expect(shown[0]!.question).toContain('Can a spec be approved while one of its selectors has no step?')
  expect(shown[0]!.options.map(o => o.label)).toEqual(['Option A (Recommended)', 'Option B'])
  expect(shown[0]!.options[1]!.description).toContain('the linter shall warn')
  expect(shown[0]!.options[0]!.preview).toContain('selector: An approved phrase.')
  expect(files['decisions/ADR-0007.md']).toContain('status: accepted')
  expect(files['decisions/ADR-0007.md']).toContain('Decision  B')
  expect(JSON.stringify(ran)).toContain('ADR-0007 accepted: B')
})

test('typed words and no answer both leave the ADR proposed, with no note from the mod', async ($, on) => {
  const files: Record<string, string> = { 'decisions/ADR-0007.md': ADR, 'decisions/ADR-0008.md': ADR.replace('ADR-0007', 'ADR-0008').replace('Can a spec', 'May a spec') }
  fakeDisk(on, files)
  on('tool.call', (_, e) => {
    const qs = (e as unknown as { questions: { question: string }[] }).questions
    return { result: { questions: qs, answers: { [qs[0]!.question]: 'only on Fridays' } } } as never
  })
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
  const q = (h: string) => ({ question: 'q', header: h, multiSelect: false, options: [{ label: 'x', description: 'x' }, { label: 'y', description: 'y' }] })
  const ran = await $.tool.call({ tool: 'AskUserQuestion', questions: [q('ADR-0007'), q('ADR-0008')] } as never)
  expect(files['decisions/ADR-0007.md']).toBe(ADR)
  expect(files['decisions/ADR-0008.md']).toContain('status: proposed')
  expect(JSON.stringify(ran)).not.toContain('[decision-cards]')
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

test('the reply check follows the template: optional lines, fixed opening words, in order, at most 8 lines', () => {
  const good = [
    'Done       Added the reply checker',
    'Done       Fixed the dialog crash',
    'Open       [[ADR-0018]] is not done',
    'Needs you  Decide [[ADR-0020]]',
    'Check      Run `claude plugin test` → 36 pass',
  ].join('\n')
  expect(checkReply(good)).toEqual([])
  expect(checkReply('Done Added one thing')).toEqual([])
  expect(checkReply('```\nDone       Added it\n```')).toEqual([])
  expect(checkReply('| Done | Changed the template |\n| Check | Open Docs.md → the rule shows |')).toEqual([])
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

test('the base prompt carries the rules in force, the reply and question shapes, and the terms', () => {
  const accepted = decisionNote('ADR-0007', 'd/ADR-0007.md', ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n')
  const waiting = decisionNote('ADR-0009', 'd/ADR-0009.md', ADR.replace('ADR-0007', 'ADR-0009'))
  const term = termNote('selector', 't/selector.md', '---\ntype: entity\n---\n**Definition:** An approved [[phrase]].\n')
  const text = basePrompt([accepted, waiting, term], 'C:/vault/Decisions')
  expect(text).toContain('- ADR-0007: When a spec is approved, the linter shall reject it if any selector has no step.')
  expect(text).toContain('| **Needs you** | <Decide ADR-nnnn')
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

test('the mod runs only in sessions under the workspace folder', () => {
  expect(inWorkspace(String.raw`C:\Users\A\Documents\Projects\personal\x`, 'C:/Users/A/Documents/Projects')).toBe(true)
  expect(inWorkspace('C:/Users/A/Documents/Projects', 'C:/Users/A/Documents/Projects/')).toBe(true)
  expect(inWorkspace('C:/Users/A/Documents/ProjectsOld/x', 'C:/Users/A/Documents/Projects')).toBe(false)
  expect(inWorkspace('C:/Temp/scratch', 'C:/Users/A/Documents/Projects')).toBe(false)
  expect(inWorkspace('C:/Temp/scratch', '')).toBe(true)
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
  on('prompt.compose', () => ({ sections: [] }) as never)
  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'decisions', args: '' } as Parameters<typeof $.command.run>[0])
  const composed = JSON.stringify(await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['mobile'], tools: [], outputStyle: null, traits: [], sections: [] } as never))
  expect(composed).toContain('The project meaning.')
  expect(composed).not.toContain('The shared meaning.')
})

test('picking a revision in the dialog marks the old decision superseded', async ($, on) => {
  const old = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = {
    'decisions/ADR-0007.md': old,
    'decisions/ADR-0009.md': revisionOf(old),
  }
  fakeDisk(on, files)
  on('tool.call', (_, e) => {
    const qs = (e as unknown as { questions: { question: string }[] }).questions
    return { result: { questions: qs, answers: { [qs[0]!.question]: 'Option B' } } } as never
  })
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'q', header: 'ADR-0009', multiSelect: false, options: [{ label: 'x', description: 'x' }, { label: 'y', description: 'y' }] }] } as never)
  expect(files['decisions/ADR-0009.md']).toContain('status: accepted')
  expect(files['decisions/ADR-0007.md']).toContain('status: superseded')
  expect(files['decisions/ADR-0007.md']).toContain('superseded_by: ADR-0009')
})

test('/ref-guide opens the reference guide panel with the rules and the glossary', async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  fakeDisk(on, { 'decisions/ADR-0007.md': accepted, 'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'ref-guide', args: '' } as Parameters<typeof $.command.run>[0])
  expect(JSON.stringify(ran)).toContain('Reference guide opened')
  const ui = await $.ui.mount({
    plugin: 'decision-cards',
    component: 'Pane',
    requestId: 'ref-guide',
    surface: 'desktop',
    props: { title: 'Reference guide', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  } as never)
  expect(await ui.find({ type: 'Markdown', text: /Rules in force/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\*\*selector\*\*/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\[\[/ })).toBeUndefined()
  await ui.unmount()
})
