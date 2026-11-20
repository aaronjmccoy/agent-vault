import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'


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

test('/ref-guide opens the reference guide: Rules, Terms and Docs tabs, with in-panel editing and a link to each file', { options: { vaultDir: 'C:/agent-vault' } }, async ($, on) => {
  const accepted = ADR.replace('status: proposed', 'status: accepted') + '\nDecision  A\n'
  const files: Record<string, string> = { 'decisions/ADR-0007.md': accepted, 'terms/selector.md': '---\ntype: entity\n---\n**Definition:** An approved phrase.' }
  fakeDisk(on, files)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'ref-guide', args: '' } as Parameters<typeof $.command.run>[0])
  expect(JSON.stringify(ran)).toContain('Reference guide opened')
  const ui = await $.ui.mount({
    plugin: 'reference-guide',
    component: 'Pane',
    requestId: 'ref-guide',
    surface: 'desktop',
    props: { title: 'Reference guide', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  } as never)
  expect(await ui.find({ key: 'tab-rules' })).toBeDefined()
  expect(await ui.find({ key: 'tab-terms' })).toBeDefined()
  expect(await ui.find({ key: 'tab-docs' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Rules in force · 1/ })).toBeDefined()
  await ui.press({ key: 'tab-terms' })
  expect(await ui.find({ type: 'Text', text: /Glossary · 1/ })).toBeDefined()
  await ui.press({ key: 'fold-base:terms' })
  await ui.press({ key: 'idx-selector' })
  expect(await ui.find({ type: 'Markdown', text: /An approved phrase\./ })).toBeDefined()
  await ui.press({ key: 'notes-back' })
  await ui.press({ key: 'tab-docs' })
  expect(await ui.find({ type: 'Markdown', text: /# Docs/ })).toBeDefined()
  await ui.press({ key: 'tab-terms' })
  await ui.press({ key: 'idx-selector' })
  expect(JSON.stringify(await ui.find({ key: 'file-view-selector' }))).toContain('Open the file')
  await ui.press({ key: 'pencil-view-selector' })
  await ui.input({ key: 'edit-def-selector', text: 'A phrase a spec may use.', kind: 'change' })
  await ui.press({ key: 'edit-save-selector' })
  await ui.unmount()
})
