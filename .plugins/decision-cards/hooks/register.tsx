import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Pending, CardOption, CardTerm, NoteEntry, TermEdit } from '../types'
import {
  areaTitle,
  newTermText,
  replaceRule,
  TERM_TYPES,
  updateTermText,
  currentReference,
  basePrompt,
  decisionNote,
  findNote,
  isCurrent,
  nextAdrId,
  stripFrontmatter,
  supersedeText,
  termNote,
  docsDocument,
  vaultIndex,
} from './notes'
import { TEMPLATES, inWorkspace, vaultRootOf } from './vault'
import { setTermsHref, checkQuestion, checkReply, isEars, QUESTION_RULE, REPLY_RULE } from './lint'

const POLL_MS = 2000
// The reference guide: rules in force, the glossary and open questions, read-only.
const REF_GUIDE = 'ref-guide'

const pending = atom({ plugin: 'decision-cards', key: 'pending' } as const, [], {
  shape: 'pending-1',
})
const vocab = atom({ plugin: 'decision-cards', key: 'vocab' } as const, [], {
  shape: 'vocab-1',
})
const notes = atom({ plugin: 'decision-cards', key: 'notes' } as const, [] as NoteEntry[], {
  shape: 'notes-3',
})

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

// "[[name|Label]]" -> "Label", "[[name]]" -> "name"
export const plain = (text: string): string =>
  text.replace(LINK, (_, name: string, label?: string) => (label ?? name).trim())

const termNames = (text: string): string[] =>
  [...text.matchAll(LINK)].map(m => (m[1] ?? "").trim())

const splitFrontmatter = (text: string) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const meta: Record<string, string> = {}
  if (lines[0]?.trim() !== '---') return { meta, body: lines, metaEnd: -1 }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end < 0) return { meta, body: lines, metaEnd: -1 }
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z_]+):\s*(.*?)\s*(#.*)?$/)
    if (m?.[1]) meta[m[1]] = m[2] ?? ''
  }
  return { meta, body: lines.slice(end + 1), metaEnd: end }
}

type Parsed = Omit<Pending, 'terms' | 'file' | 'lint'> & { status: string; names: string[] }

export const parseAdr = (text: string): Parsed => {
  const { meta, body } = splitFrontmatter(text)
  const options: CardOption[] = []
  let given = ''
  let decide = ''
  let combines = ''
  let recommend = ''
  let recommendReason = ''
  let last: 'given' | 'option' | null = null
  for (const raw of body) {
    const line = raw.trimEnd()
    let m: RegExpMatchArray | null
    if ((m = line.match(/^Given\s+(.+)$/))) {
      given = (m[1] ?? "").trim()
      last = 'given'
    } else if ((m = line.match(/^Decide\s+(.+)$/))) {
      decide = (m[1] ?? "").trim()
      last = null
    } else if ((m = line.match(/^Where\s+([A-Z]):\s*(.+)$/))) {
      options.push({ letter: m[1] ?? '', rule: (m[2] ?? "").trim(), consequence: '' })
      last = 'option'
    } else if ((m = line.match(/^Combines\s+(.+)$/))) {
      combines = (m[1] ?? "").trim()
      last = null
    } else if ((m = line.match(/^Recommend\s+([A-Z])\s*:?\s*(.*)$/))) {
      recommend = m[1] ?? ''
      recommendReason = (m[2] ?? "").trim()
      last = null
    } else if (/^\s+\S/.test(line) && last) {
      const rest = line.trim()
      if (last === 'option') {
        const o = options[options.length - 1]
        if (!o) continue
        const isConsequence = rest.startsWith('→') || rest.startsWith('->')
        if (isConsequence) o.consequence = rest.replace(/^(→|->)\s*/, '')
        else o.rule += ' ' + rest
      } else given += ' ' + rest
    }
  }
  const missing = [
    !given && 'Given',
    !decide && 'Decide',
    options.length < 2 && 'at least two "Where X:" options',
    !meta.id && 'frontmatter id',
  ].filter(Boolean)
  const badRecommend =
    recommend && !options.some(o => o.letter === recommend)
      ? `Recommend names ${recommend}, which is not an option`
      : null
  const error = missing.length
    ? `Missing: ${missing.join(', ')}`
    : badRecommend
  const names = [
    ...new Set(
      [given, decide, ...options.flatMap(o => [o.rule, o.consequence])].flatMap(termNames),
    ),
  ]
  return {
    id: meta.id ?? '',
    status: (meta.status ?? '').toLowerCase(),
    scope: meta.scope ?? '',
    given,
    decide,
    options,
    combines,
    recommend,
    recommendReason,
    names,
    error,
  }
}

export const decisionOf = (text: string): string | null => {
  const m = text.match(/^Decision\s+([A-Z])\b/m)
  return m ? m[1] ?? null : null
}

export const definitionOf = (text: string): string | null => {
  const m = text.match(/\*\*Definition:\*\*\s*(.+)/)
  return m ? (m[1] ?? "").trim() : null
}

// Records the picked option and sets the status, keeping everything else.
export const acceptText = (text: string, letter: string): string => {
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const { metaEnd } = splitFrontmatter(text)
  for (let i = 1; i < metaEnd; i++) {
    const l = lines[i] ?? ''
    if (/^status:/.test(l)) lines[i] = l.replace(/^status:\s*\S+/, 'status: accepted')
  }
  while (lines.length && (lines[lines.length - 1] ?? '').trim() === '') lines.pop()
  lines.push('', `Decision  ${letter}`, '')
  return lines.join(nl)
}

const joinPath = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, '')}/${name}`

// projectRoot is the session's folder; its projectVault folder, where present, is
// layered over the shared vault (ADR-0005).
const config = { adrDir: 'decisions', termsDir: 'terms', indexFile: '', docsFile: '', baseFile: '', claudeFile: '', projectVault: 'vault', projectRoot: '', workspaceRoot: '', active: true }
let lastIndex = ''
let lastDocs = ''
let lastBase = ''
let lastClaude = ''
const seen = new Map<string, number>()
const parsedByFile = new Map<string, Parsed>()
let announced = false
let knownPending = new Set<string>()

async function termOf($: EngineInterface, name: string): Promise<CardTerm> {
  // A link to another decision resolves to that ADR: its status and question.
  if (/^ADR-\d+$/i.test(name)) {
    try {
      const adr = parseAdr(String(await $.fs.read(joinPath(config.adrDir, `${name}.md`))))
      const decided = decisionOf(String(await $.fs.read(joinPath(config.adrDir, `${name}.md`))))
      return { name, definition: `${adr.status}${decided ? ` (${decided})` : ''}: ${adr.decide}` }
    } catch {
      return { name, definition: null }
    }
  }
  try {
    return { name, definition: definitionOf(String(await $.fs.read(joinPath(config.termsDir, `${name}.md`)))) }
  } catch {
    return { name, definition: null }
  }
}

let inFlight: Promise<void> | null = null

// One refresh at a time: the poll, the command and Accept all share it.
async function refresh($: EngineInterface): Promise<void> {
  if (inFlight) return inFlight
  inFlight = refreshOnce($)
  try {
    await inFlight
  } finally {
    inFlight = null
  }
}

const noteCache = new Map<string, { mtimeMs: number; entry: NoteEntry }>()

// A note from the shared vault is part of the base prompt; the rest are the project's own.
const slashed = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
const isBase = (n: NoteEntry): boolean => slashed(n.file).startsWith(`${slashed(n.kind === 'term' ? config.termsDir : config.adrDir)}/`)

// The session's project vault folder, unless it is the shared vault itself.
const projectLayer = (): string => {
  if (!config.projectRoot || !config.projectVault) return ''
  const dir = joinPath(config.projectRoot.replace(/\\/g, '/'), config.projectVault)
  const sharedRoot = vaultRootOf(config.adrDir).replace(/\\/g, '/').toLowerCase()
  return dir.toLowerCase() === sharedRoot ? '' : dir
}

// Reads every term note and ADR (only the files that changed) into the browser's set.
async function indexNotes($: EngineInterface): Promise<void> {
  const found: NoteEntry[] = []
  const live = new Set<string>()
  // The project layer is read first, so its note wins where both define a name.
  const layer = projectLayer()
  const dirs = [
    ...(layer ? ([[`${layer}/Terms`, 'term', true], [`${layer}/Decisions`, 'decision', true]] as const) : []),
    [config.termsDir, 'term', false],
    [config.adrDir, 'decision', false],
  ] as const
  const shared: NoteEntry[] = []
  const named = new Set<string>()
  for (const [dir, kind, fromProject] of dirs) {
    if (!(await $.fs.exists(dir))) continue
    for (const f of await $.fs.list(dir)) {
      if (f.kind !== 'file' || !f.name.toLowerCase().endsWith('.md')) continue
      const path = joinPath(dir, f.name)
      live.add(path)
      let hit = noteCache.get(path)
      if (!hit || hit.mtimeMs !== f.mtimeMs) {
        try {
          const text = String(await $.fs.read(path))
          const name = f.name.slice(0, -3)
          hit = { mtimeMs: f.mtimeMs, entry: kind === 'term' ? termNote(name, path, text) : decisionNote(name, path, text) }
          noteCache.set(path, hit)
        } catch {
          continue
        }
      }
      if (!fromProject) shared.push(hit.entry)
      const id = `${kind}:${hit.entry.name.toLowerCase()}`
      if (named.has(id)) continue
      named.add(id)
      found.push(hit.entry)
    }
  }
  for (const path of [...noteCache.keys()]) if (!live.has(path)) noteCache.delete(path)
  found.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title))
  if (JSON.stringify(found) !== JSON.stringify(await read($, notes))) await update($, notes, () => found)
  // Keep the vault's Index.md in step with its notes; write only when it changed.
  if (config.indexFile && shared.length) {
    const text = vaultIndex(shared)
    if (text !== lastIndex) {
      let onDisk = ''
      try {
        onDisk = String(await $.fs.read(config.indexFile))
      } catch {}
      if (onDisk !== text) await $.fs.write(config.indexFile, text)
      lastIndex = text
    }
  }
  if (config.baseFile && shared.length) {
    const text = basePrompt(shared, config.adrDir)
    if (text !== lastBase) {
      let onDisk = ''
      try {
        onDisk = String(await $.fs.read(config.baseFile))
      } catch {}
      if (onDisk !== text) await $.fs.write(config.baseFile, text)
      lastBase = text
    }
  }
  // ADR-0007: the workspace CLAUDE.md carries the base prompt itself, since an
  // @import of a file outside a session's project is not expanded.
  if (config.claudeFile && shared.length) {
    const text = [
      '# Workspace base prompt',
      '',
      `Every agent working under this folder follows the guidelines below (ADR-0007). This file is generated by the decision-cards mod from the shared vault (${vaultRootOf(config.adrDir)}); change a decision there, not this file.`,
      '',
      basePrompt(shared, config.adrDir).replace(/^# Base prompt\n+/, '').replace(/^## /gm, '### '),
    ].join('\n')
    if (text !== lastClaude) {
      let onDisk = ''
      try {
        onDisk = String(await $.fs.read(config.claudeFile))
      } catch {}
      if (onDisk !== text) await $.fs.write(config.claudeFile, text)
      lastClaude = text
    }
  }
  if (config.docsFile && shared.length) {
    const text = docsDocument(shared)
    if (text !== lastDocs) {
      let onDisk = ''
      try {
        onDisk = String(await $.fs.read(config.docsFile))
      } catch {}
      if (onDisk !== text) await $.fs.write(config.docsFile, text)
      lastDocs = text
    }
  }
}

async function refreshOnce($: EngineInterface): Promise<void> {
  const { adrDir, termsDir } = config
  await indexNotes($)
  if (await $.fs.exists(termsDir)) {
    const words = (await $.fs.list(termsDir))
      .filter(f => f.kind === 'file' && f.name.toLowerCase().endsWith('.md'))
      .map(f => f.name.slice(0, -3))
      .sort()
    if (JSON.stringify(words) !== JSON.stringify(await read($, vocab))) await update($, vocab, () => words)
  }
  if (!(await $.fs.exists(adrDir))) return
  const entries = (await $.fs.list(adrDir)).filter(
    f => f.kind === 'file' && f.name.toLowerCase().endsWith('.md'),
  )
  const names = new Set(entries.map(f => f.name))
  for (const f of entries) {
    if (seen.get(f.name) === f.mtimeMs) continue
    seen.set(f.name, f.mtimeMs)
    try {
      parsedByFile.set(f.name, parseAdr(String(await $.fs.read(joinPath(adrDir, f.name)))))
    } catch {
      parsedByFile.delete(f.name)
    }
  }
  for (const name of [...parsedByFile.keys()]) if (!names.has(name)) parsedByFile.delete(name)

  const next: Pending[] = []
  for (const [file, p] of [...parsedByFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (p.status !== 'proposed') continue
    const terms: CardTerm[] = []
    for (const n of p.names) terms.push(await termOf($, n))
    const { status: _s, names: _n, ...rest } = p
    next.push({ ...rest, file, terms, lint: checkQuestion(p, await read($, notes)) })
  }
  const before = JSON.stringify(await read($, pending))
  if (before !== JSON.stringify(next)) await update($, pending, () => next)
  const ids = next.map(c => c.id || c.file)
  const fresh = ids.filter(id => !knownPending.has(id))
  if (!announced && ids.length) {
    $.ui.toast(`${ids.length} decision${ids.length > 1 ? 's are' : ' is'} waiting for you. Run /decisions to answer.`)
  } else if (announced && fresh.length) {
    $.ui.toast(`${fresh.join(', ')} ${fresh.length > 1 ? 'need' : 'needs'} your decision.`)
  }
  announced = true
  knownPending = new Set(ids)
}

// Creates the vault's folders and templates where they are missing, so the
// framework is ready wherever the mod runs.
async function ensureVault($: EngineInterface): Promise<void> {
  const root = vaultRootOf(config.adrDir)
  for (const dir of [config.adrDir, config.termsDir, `${root}/Specs`]) {
    if (!(await $.fs.exists(dir))) await $.fs.write(`${dir}/.keep`, '')
  }
  for (const [name, text] of Object.entries(TEMPLATES)) {
    const path = `${root}/Templates/${name}`
    if (!(await $.fs.exists(path))) await $.fs.write(path, text)
  }
  const obsidian = `${root}/.obsidian/templates.json`
  if (!(await $.fs.exists(obsidian))) await $.fs.write(obsidian, '{\n  "folder": "Templates"\n}\n')
}

// What an agent is told when it tries to ask with the built-in question tool.
export const askInstead = (nextId: string, adrDir: string, termsDir: string): string =>
  [
    `Questions to the person are proposed ADRs (${QUESTION_RULE}), asked through this dialog (ADR-0010).`,
    `First write a proposed ADR to ${adrDir}/${nextId}.md, in this shape:`,
    '---',
    `id: ${nextId}`,
    'status: proposed',
    'scope: <area, no project names>',
    '---',
    'Given     <at most two plain sentences; link terms as [[term]]>',
    'Decide    <one sentence ending in "?" saying what changes for the person>',
    'Where A:  When <trigger>, the [[system]] shall <response>.',
    '          → <what happens> · <what it costs>',
    'Where B:  When <trigger>, the [[system]] shall <response>.',
    '          → <what happens> · <what it costs>',
    'Combines  exclusive | <how options combine>',
    'Recommend A: <one-sentence reason>',
    '',
    `Each option is one EARS rule. Link only terms that have a note in ${termsDir}; define a new term there first.`,
    'Write the file with the Write tool, then call AskUserQuestion with one question per ADR (at most 4), its header set to the ADR id, such as ' + nextId + '. The mod fills the question and options from the file and records the answer in it.',
  ].join('\n')

// Puts a note in the conversation for the agent: the model reads it on its next request.
async function tellAgent($: EngineInterface, text: string): Promise<void> {
  try {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
  } catch {}
}

// The ADR file a Write call targets, when it is one in the Decisions folder.
export const adrFileOf = (input: unknown): string => {
  const path = typeof input === 'object' && input && 'file_path' in input ? String((input as { file_path: unknown }).file_path) : ''
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  if (!norm(path).startsWith(norm(config.adrDir) + '/')) return ''
  const name = path.replace(/\\/g, '/').split('/').pop() ?? ''
  return /^ADR-\d+\.md$/i.test(name) ? name : ''
}

// One native dialog question built from a proposed ADR (ADR-0010): the Decide line
// is the question, each Where line an option, the recommended one first. Term
// definitions go in the preview, since the dialog has no hover.
type Dialog = {
  file: string
  id: string
  question: { question: string; header: string; multiSelect: boolean; options: { label: string; description: string; preview?: string }[] }
  byLabel: Record<string, string>
  rules: Record<string, string>
}

export const dialogOf = (file: string, p: Parsed, terms: CardTerm[]): Dialog => {
  const ordered = [...p.options].sort((a, b) => Number(b.letter === p.recommend) - Number(a.letter === p.recommend))
  const glossary = terms.filter(t => t.definition && !/^ADR-/i.test(t.name)).map(t => `${t.name}: ${t.definition}`)
  const preview = [`Given: ${plain(p.given)}`, ...(glossary.length ? ['', ...glossary] : [])].join('\n')
  const byLabel: Record<string, string> = {}
  const rules: Record<string, string> = {}
  const options = ordered.map(o => {
    const label = `Option ${o.letter}${o.letter === p.recommend ? ' (Recommended)' : ''}`
    byLabel[label] = o.letter
    rules[o.letter] = plain(o.rule)
    const consequence = plain(o.consequence).replace(/\s*·\s*/, '. Cost: ')
    return { label, description: `${plain(o.rule)}${consequence ? ` → ${consequence}` : ''}`, preview }
  })
  const why = p.recommend && p.recommendReason ? ` (Recommended ${p.recommend}: ${plain(p.recommendReason)})` : ''
  return {
    file,
    id: p.id,
    question: { question: `${plain(p.decide)}${why}`, header: p.id, multiSelect: false, options },
    byLabel,
    rules,
  }
}

// Writes a picked option into its ADR. Anything else the dialog returns (typed
// words, no answer) leaves the ADR proposed, and the agent reads it from the result.
async function recordAnswer($: EngineInterface, d: Dialog, said: string): Promise<string> {
  const letter = d.byLabel[said] ?? (/^[A-Z]$/.test(said) && d.rules[said] ? said : '')
  if (!letter) return ''
  const path = joinPath(config.adrDir, d.file)
  const before = String(await $.fs.read(path))
  await $.fs.write(path, acceptText(before, letter))
  const replaces = stripFrontmatter(before).meta.supersedes?.replace(/^\[\[|\]\]$/g, '')
  if (replaces) {
    const oldPath = joinPath(config.adrDir, `${replaces}.md`)
    try {
      await $.fs.write(oldPath, supersedeText(String(await $.fs.read(oldPath)), d.id))
    } catch {}
  }
  seen.delete(d.file)
  void refresh($).catch(() => {})
  return `[decision-cards] ${d.id} accepted: ${letter}. Rule in force: ${d.rules[letter]}`
}

// The reference guide (/ref-guide): the vault's rules, terms and docs, read-only,
// in one panel with three tabs. Links open the note they name; ← → step back
// and forward through the notes opened.

const HREF = 'file:///note/'
const toMarkdown = (body: string): string =>
  body.replace(LINK, (_, name: string, label?: string) => `[${(label ?? name).trim()}](${HREF}${encodeURIComponent(name.trim())})`)
const noteFromHref = (href: string): string | null => (href.startsWith(HREF) ? decodeURIComponent(href.slice(HREF.length)) : null)
const backlinksOf = (name: string, notes: readonly NoteEntry[]): NoteEntry[] =>
  notes.filter(n => n.name !== name && n.links.some(l => l.toLowerCase() === name.toLowerCase()))
// Follows superseded_by to the newest decision (at most 20 hops, so a loop can't hang).
const latestOf = (note: NoteEntry, notes: readonly NoteEntry[]): NoteEntry => {
  let at = note
  for (let i = 0; i < 20 && at.supersededBy; i++) {
    const next = findNote(at.supersededBy, notes)
    if (!next || next === at) break
    at = next
  }
  return at
}
const byNumber = (a: NoteEntry, b: NoteEntry) => a.name.localeCompare(b.name, undefined, { numeric: true })

const noteTab = atom({ plugin: 'decision-cards', key: 'noteTab' } as const, 'rules', { shape: 'notetab-2' })
// The note the guide shows; '' shows the tab's list.
const selected = atom({ plugin: 'decision-cards', key: 'selected' } as const, '', { shape: 'selected-1' })
// The decision whose record (reasoning, options, consequences) is open; '' for none.
const showRecord = atom({ plugin: 'decision-cards', key: 'showRecord' } as const, '', { shape: 'record-1' })
// Sections the person has opened.
const docsOpen = atom({ plugin: 'decision-cards', key: 'docsOpen' } as const, [] as string[], { shape: 'docsopen-1' })
// Glossary controls: the search text, the A–Z letter, the term type ('' = all).
const termQuery = atom({ plugin: 'decision-cards', key: 'termQuery' } as const, '', { shape: 'termquery-1' })
const termLetter = atom({ plugin: 'decision-cards', key: 'termLetter' } as const, '', { shape: 'termletter-1' })
const termType = atom({ plugin: 'decision-cards', key: 'termType' } as const, '', { shape: 'termtype-1' })
const docsQuery = atom({ plugin: 'decision-cards', key: 'docsQuery' } as const, '', { shape: 'docsquery-1' })
// Where the person has been: '' is the list view of the current tab.
const navHistory = atom({ plugin: 'decision-cards', key: 'navHistory' } as const, { stack: [''], at: 0 }, { shape: 'nav-1' })

// Search fields keep their own text; these are what they start with.
const querySeeds = new Map<string, string>()
// In-panel editing: the note whose editor is open ('' for none; rules as rule:<name>), and the drafts.
const editing = atom({ plugin: 'decision-cards', key: 'editing' } as const, '', { shape: 'editing-1' })
const termEdits = atom({ plugin: 'decision-cards', key: 'termEdits' } as const, {}, { shape: 'termedits-1' })
const ruleEdits = atom({ plugin: 'decision-cards', key: 'ruleEdits' } as const, {}, { shape: 'ruleedits-1' })
// What each edit field starts with, set once per note.
const termSeeds = new Map<string, string>()
const ruleSeeds = new Map<string, string>()

// Writes a term note: rewrites an existing one in place (new version, old
// definition gone) or creates it.
async function saveTerm($: EngineInterface, name: string, edit: TermEdit, exists: boolean): Promise<void> {
  if (!edit.definition.trim()) {
    $.ui.toast(`${name}: write a definition first`)
    return
  }
  const path = joinPath(config.termsDir, `${name}.md`)
  const text = exists
    ? updateTermText(String(await $.fs.read(path)), edit.type, edit.definition)
    : newTermText(name, edit.type, edit.definition, `t-${Math.random().toString(36).slice(2, 6)}`)
  await $.fs.write(path, text)
  termSeeds.delete(name)
  await update($, termEdits, x => {
    const { [name]: _gone, ...rest } = x
    return rest
  })
  await update($, editing, () => '')
  $.ui.toast(exists ? `${name} updated` : `${name} created`)
  await refresh($)
}

// Opens a note's file in the app the system uses for it (Obsidian, an editor), for edits too big for the panel.
async function openFile($: EngineInterface, path: string): Promise<void> {
  const isWindows = /^[A-Za-z]:[\\/]/.test(path)
  const argv = isWindows ? ['cmd', '/c', 'start', '', path.replace(/\//g, '\\')] : ['open', path]
  const { exitCode } = await $.process.run(argv)
  if (exitCode !== 0) $.ui.toast(`Could not open ${path}`)
}

// Rewords a rule in force, in place. It must stay an EARS sentence.
async function saveRule($: EngineInterface, note: NoteEntry): Promise<void> {
  const text = ((await read($, ruleEdits))[note.name] ?? note.rule).replace(/\s*\n\s*/g, ' ').trim()
  if (!isEars(text)) {
    $.ui.toast('Write the rule as one EARS sentence, e.g. "When <trigger>, the <system> shall <response>."')
    return
  }
  await $.fs.write(note.file, replaceRule(String(await $.fs.read(note.file)), text))
  ruleSeeds.delete(note.name)
  await update($, ruleEdits, x => {
    const { [note.name]: _gone, ...rest } = x
    return rest
  })
  await update($, editing, () => '')
  $.ui.toast(`${note.title} updated`)
  await refresh($)
}

const fire = (p: Promise<unknown>): void => {
  void p.catch(() => {})
}

async function drawReference(
  $: EngineInterface,
  e: RenderInput,
  allNotes: readonly NoteEntry[],
  opts: { termsDir: string; isBase: (n: NoteEntry) => boolean },
) {
  const { Box, Text, Button, Input, Select, Markdown } = $.ui.resolve(e)
  const { termsDir, isBase } = opts
  const sel = await read($, selected)
  const tab = await read($, noteTab)
  const showing = await read($, showRecord)
  const docsShown = await read($, docsOpen)
  const termQ = await read($, termQuery)
  const termL = await read($, termLetter)
  const termT = await read($, termType)
  const docsQ = await read($, docsQuery)
  const nav = await read($, navHistory)
  const editingKey = await read($, editing)
  const edits = await read($, termEdits)

  type El = ReturnType<typeof h>

  const choose = (name: string) => {
    fire(update($, selected, () => name))
    fire(
      update($, navHistory, x => {
        if (x.stack[x.at] === name) return x
        const stack = [...x.stack.slice(0, x.at + 1), name].slice(-50)
        return { stack, at: stack.length - 1 }
      }),
    )
  }
  const goTo = (at: number) => {
    const target = nav.stack[at]
    if (target === undefined) return
    fire(update($, navHistory, x => ({ ...x, at })))
    fire(update($, selected, () => target))
  }
  const toggle = (key: string) => () => fire(update($, docsOpen, x => (x.includes(key) ? x.filter(k => k !== key) : [...x, key])))

  const md = (key: string, text: string, opts2: { bold?: boolean; indent?: boolean } = {}) => (
    <Box key={`box-${key}`} marginTop={1} paddingLeft={opts2.indent ? 2 : 0} width="100%">
      <Markdown
        key={key}
        text={toMarkdown(opts2.bold ? `**${text.trim()}**` : text) || '_This note is empty._'}
        onLinkPress={link => {
          const name = noteFromHref(link.href)
          if (name) choose(name)
        }}
      />
    </Box>
  )
  const tabButton = (key: string, label: string, isOn: boolean, press: () => void) => (
    <Box key={`tb-${key}`} flexDirection="column">
      <Button key={key} plain onPress={press}>
        {label}
      </Button>
      <Text color={isOn ? 'suggestion' : 'subtle'}>{isOn ? '─'.repeat(label.length) : ' '}</Text>
    </Box>
  )

  const current = allNotes.filter(isCurrent)
  const terms = current.filter(n => n.kind === 'term').sort((a, b) => a.title.localeCompare(b.title))
  const decisions = current.filter(n => n.kind === 'decision').sort((a, b) => a.title.localeCompare(b.title))
  const hidden = allNotes.length - current.length
  const numberOf = (n: NoteEntry) => {
    const i = (n.kind === 'term' ? terms : decisions).indexOf(n)
    return i < 0 ? (n.kind === 'term' ? '1.–' : '2.–') : `${n.kind === 'term' ? 1 : 2}.${i + 1}`
  }

  const blocks: El[] = []

  // ---- editing: a pencil edits in place; "Open the file" opens the note itself for bigger edits
  const editKey = (n: NoteEntry) => (n.kind === 'term' ? n.name : `rule:${n.name}`)
  const isEditing = (n: NoteEntry) => editingKey === editKey(n)
  const canEdit = (n: NoteEntry) => n.kind === 'term' || (n.status === 'accepted' && !!n.rule && isCurrent(n))
  const tools = (n: NoteEntry, where: string) => (
    <Box key={`tools-${where}-${n.name}`} gap={2} flexShrink={0}>
      {canEdit(n) ? (
        <Button key={`pencil-${where}-${n.name}`} plain onPress={() => fire(update($, editing, () => (isEditing(n) ? '' : editKey(n))))}>
          {isEditing(n) ? '✕' : '✎'}
        </Button>
      ) : null}
      <Button key={`file-${where}-${n.name}`} plain onPress={() => void openFile($, n.file).catch(() => $.ui.toast(`Could not open ${n.file}`))}>
        Open the file
      </Button>
    </Box>
  )
  const withTools = (n: NoteEntry, where: string, content: El) => (
    <Box key={`wt-${where}-${n.name}`} flexDirection="row" justifyContent="space-between" marginTop={1} width="100%">
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {content}
      </Box>
      {tools(n, where)}
    </Box>
  )
  const termForm = (name: string, existing: NoteEntry | undefined): El[] => {
    const edit = edits[name] ?? { type: existing?.subtitle && TERM_TYPES.includes(existing.subtitle as never) ? existing.subtitle : 'entity', definition: existing?.summary ?? '' }
    if (!termSeeds.has(name)) termSeeds.set(name, edit.definition)
    const setEdit = (patch: Partial<TermEdit>) => fire(update($, termEdits, x => ({ ...x, [name]: { ...(x[name] ?? edit), ...patch } })))
    return [
      <Box key={`tf-type-${name}`} flexDirection="column" marginTop={1}>
        <Text dimColor>Type</Text>
        <Select key={`edit-type-${name}`} value={edit.type} options={TERM_TYPES.map(t => ({ value: t, label: t }))} onSelect={v => setEdit({ type: v })} />
      </Box>,
      <Box key={`tf-def-${name}`} flexDirection="column" marginTop={1} width="100%">
        <Text dimColor>Definition: one sentence; link other terms as [[term]]</Text>
        <Input
          key={`edit-def-${name}`}
          rows={3}
          value={termSeeds.get(name) ?? ''}
          placeholder="What this word means in this project."
          submitLabel=""
          onInput={v => setEdit({ definition: v })}
          onSubmit={v => setEdit({ definition: v })}
        />
      </Box>,
      <Box key={`tf-btn-${name}`} marginTop={1} gap={2}>
        <Button key={`edit-save-${name}`} variant="primary" onPress={() => void saveTerm($, name, edits[name] ?? edit, !!existing).catch(() => $.ui.toast(`${name}: could not save`))}>
          {existing ? `Save as v${(Number.parseInt(existing.version, 10) || 1) + 1}` : 'Create term'}
        </Button>
        <Button key={`edit-cancel-${name}`} plain onPress={() => fire(update($, editing, () => ''))}>
          Cancel
        </Button>
      </Box>,
      <Text key={`tf-hint-${name}`} dimColor>
        {existing ? 'Saving replaces the old definition; agents use only the new one. For bigger edits, open the file.' : `Creates ${joinPath(termsDir, `${name}.md`)}.`}
      </Text>,
    ]
  }
  const ruleForm = (d: NoteEntry): El[] => {
    if (!ruleSeeds.has(d.name)) ruleSeeds.set(d.name, d.rule)
    const setDraft = (v: string) => fire(update($, ruleEdits, x => ({ ...x, [d.name]: v })))
    return [
      <Box key={`rf-def-${d.name}`} flexDirection="column" marginTop={1} width="100%">
        <Text dimColor>Rule: one EARS sentence; link terms as [[term]]</Text>
        <Input key={`rule-def-${d.name}`} rows={3} value={ruleSeeds.get(d.name) ?? ''} submitLabel="↵" onInput={setDraft} onSubmit={setDraft} />
      </Box>,
      <Box key={`rf-btn-${d.name}`} marginTop={1} gap={2}>
        <Button key={`rule-save-${d.name}`} variant="primary" onPress={() => void saveRule($, d).catch(() => $.ui.toast(`${d.title}: could not save`))}>
          {`Save as v${(Number.parseInt(d.version || '1', 10) || 1) + 1}`}
        </Button>
        <Button key={`rule-cancel-${d.name}`} plain onPress={() => fire(update($, editing, () => ''))}>
          Cancel
        </Button>
      </Box>,
      <Text key={`rf-hint-${d.name}`} dimColor>
        Saving replaces the rule in force; agents use only the new wording. To change its reasoning or options, open the file.
      </Text>,
    ]
  }
  const editorFor = (n: NoteEntry): El[] => (n.kind === 'term' ? termForm(n.name, n) : ruleForm(n))
  const heading = (text: string) =>
    blocks.push(
      <Box key={`h-${text}`} marginTop={1}>
        <Text bold>{text}</Text>
      </Box>,
    )
  const entry = (n: NoteEntry, where: string) => {
    const used = backlinksOf(n.name, current).map(b => b.title)
    blocks.push(
      withTools(
        n,
        where,
        <Box flexDirection="column">
          <Box gap={1}>
            <Text dimColor>{numberOf(n)}</Text>
            <Button key={`${where}-${n.name}`} plain onPress={() => choose(n.name)}>
              {n.title}
            </Button>
            <Text dimColor>{n.subtitle}</Text>
          </Box>
          {n.summary ? <Text dimColor>{plain(n.summary)}</Text> : null}
          {used.length ? <Text dimColor>Referenced by {used.join(', ')}</Text> : null}
        </Box>,
      ),
    )
    if (isEditing(n)) blocks.push(...editorFor(n))
  }
  // A section that starts folded; its open state is kept.
  const foldable = (key: string, title: string, count: string, fill: () => void, forceOpen = false) => {
    const isOpen = forceOpen || docsShown.includes(key)
    blocks.push(
      <Box key={`f-${key}`} marginTop={1} gap={1}>
        <Button key={`fold-${key}`} plain onPress={toggle(key)}>
          {`${isOpen ? '▾' : '▸'} ${title}`}
        </Button>
        <Text dimColor>{count}</Text>
      </Box>,
    )
    if (isOpen) fill()
  }

  const note = sel ? findNote(sel, allNotes) : undefined
  if (sel) {
    // One note: a term's definition, or the rule a decision put in force with its record behind it.
    blocks.push(
      <Box key="back" marginTop={1}>
        <Button key="notes-back" plain onPress={() => choose('')}>
          {`← Back to ${tab}`}
        </Button>
      </Box>,
    )
    if (note) {
      if (note.kind === 'term') {
        blocks.push(
          withTools(
            note,
            'view',
            <Box flexDirection="column">
              <Text bold>
                {numberOf(note)}  {note.title}
              </Text>
              <Text dimColor>
                term · {note.subtitle} · v{note.version} · {note.file}
              </Text>
            </Box>,
          ),
        )
        if (isEditing(note)) blocks.push(...termForm(note.name, note))
        else blocks.push(md('note-body', note.body.replace(/\n(?!\n)/g, '  \n')))
      } else {
        const isOpen = showing === note.name
        blocks.push(
          withTools(
            note,
            'view',
            <Box flexDirection="column">
              <Text dimColor>{note.title}</Text>
              {md(`note-rule-${note.name}`, note.rule || note.summary, { bold: true })}
              <Text dimColor>
                {note.rule ? `rule in force · v${note.version || '1'}` : `${note.status}: not decided yet`}
                {note.scope ? ` · ${note.scope}` : ''}
              </Text>
            </Box>,
          ),
        )
        if (isEditing(note)) blocks.push(...ruleForm(note))
        if (note.supersededBy) {
          const latest = latestOf(note, allNotes)
          blocks.push(
            <Box key="superseded" flexDirection="column" marginTop={1}>
              <Text color="warning">Superseded. Agents no longer use this rule.</Text>
              <Button key="to-latest" plain onPress={() => choose(latest.name)}>
                {`Open the current one: ${latest.title}`}
              </Button>
            </Box>,
          )
        }
        blocks.push(
          <Box key="record-toggle" marginTop={1}>
            <Button key={`record-${note.name}`} plain onPress={() => fire(update($, showRecord, () => (isOpen ? '' : note.name)))}>
              {isOpen ? '▾ Hide the decision record' : '▸ Show the decision record'}
            </Button>
          </Box>,
        )
        if (isOpen) {
          blocks.push(
            <Box key="record-meta" marginTop={1}>
              <Text dimColor>
                {note.subtitle} · {note.file}
              </Text>
            </Box>,
          )
          blocks.push(md('note-record', note.body.replace(/\n(?!\n)/g, '  \n')))
        }
      }
      heading(`Links to · ${note.links.length}`)
      if (!note.links.length) blocks.push(<Text key="no-links" dimColor>Nothing yet.</Text>)
      for (const l of note.links) {
        const target = findNote(l, allNotes)
        if (target) entry(target, 'to')
        else
          blocks.push(
            <Box key={`missing-${l}`} marginTop={1} gap={1}>
              <Text>{l}</Text>
              <Text color="warning">no note yet</Text>
            </Box>,
          )
      }
    } else if (editingKey === sel) {
      blocks.push(
        <Box key="new-term" marginTop={1}>
          <Text bold>New term: {sel}</Text>
        </Box>,
      )
      blocks.push(...termForm(sel, undefined))
    } else {
      blocks.push(
        <Box key="unknown" flexDirection="column" marginTop={1}>
          <Text bold>{sel}</Text>
          <Text color="warning">No note by this name yet.</Text>
          <Button key={`define-${sel}`} plain onPress={() => fire(update($, editing, () => sel))}>
            Define this term
          </Button>
        </Box>,
      )
    }
    const backs = backlinksOf(note?.name ?? sel, current)
    heading(`Referenced by · ${backs.length}`)
    if (!backs.length) blocks.push(<Text key="no-backs" dimColor>Nothing links here yet.</Text>)
    for (const b of backs) entry(b, 'from')
  } else if (tab === 'docs') {
    // Docs: one document, opened section by section; each item links on to its note.
    const inForce = decisions.filter(d => d.status === 'accepted' && d.rule).sort(byNumber)
    const open = decisions.filter(d => d.status === 'proposed').sort(byNumber)
    const groups = [
      { key: 'base', label: 'Base prompt', rules: inForce.filter(isBase), terms: terms.filter(isBase) },
      { key: 'project', label: "This project's", rules: inForce.filter(d => !isBase(d)), terms: terms.filter(t => !isBase(t)) },
    ].filter(g => g.rules.length || g.terms.length)
    blocks.push(
      md(
        'docs-body',
        `# Docs\n\nHow this system works, from its **${inForce.length} [[rule|rules]] in force** and **${terms.length} defined [[term|terms]]**. Each [[rule]] says who acts, when, and what they shall do. Open a section to read it; follow a link to the note behind any [[rule]] or [[term]].`,
      ),
    )
    if (!querySeeds.has('docs')) querySeeds.set('docs', docsQ)
    blocks.push(
      <Box key="docs-search-box" marginTop={1} width="100%" flexDirection="column">
        <Input
          key="docs-search"
          value={querySeeds.get('docs') ?? ''}
          placeholder="Search the docs"
          submitLabel="↵"
          onInput={v => fire(update($, docsQuery, () => v))}
          onSubmit={v => fire(update($, docsQuery, () => v))}
        />
      </Box>,
    )
    const dq = docsQ.trim().toLowerCase()
    if (dq) {
      const ruleHits = inForce.filter(d => plain(d.rule).toLowerCase().includes(dq) || plain(d.summary).toLowerCase().includes(dq))
      const termHits = terms.filter(t => t.title.toLowerCase().includes(dq) || plain(t.summary).toLowerCase().includes(dq))
      heading(`${ruleHits.length + termHits.length} match${ruleHits.length + termHits.length === 1 ? '' : 'es'} for “${docsQ.trim()}”`)
      for (const d of ruleHits) blocks.push(md(`docs-hit-${d.name}`, `${d.rule}\n\n*Decided in [[${d.name}|${d.title}]] · ${areaTitle(d.scope || 'general')}*`))
      for (const t of termHits) blocks.push(md(`docs-hit-${t.name}`, `**[[${t.name}]]** *(${t.subtitle})*: ${t.summary}`))
    } else {
      const allKeys = [...groups.flatMap(g => [`${g.key}:rules-doc`, `${g.key}:glossary`]), 'open']
      blocks.push(
        <Box key="docs-all" marginTop={1} gap={2}>
          <Button key="docs-expand-all" plain onPress={() => fire(update($, docsOpen, () => allKeys))}>
            Expand all
          </Button>
          <Button key="docs-collapse-all" plain onPress={() => fire(update($, docsOpen, () => []))}>
            Collapse all
          </Button>
        </Box>,
      )
      let num = 0
      for (const g of groups) {
        if (g.rules.length) {
          const n = ++num
          foldable(`${g.key}:rules-doc`, `${n}. ${g.label} rules`, `${g.rules.length} rule${g.rules.length === 1 ? '' : 's'}`, () => {
            g.rules.forEach((d, j) => {
              blocks.push(
                withTools(d, 'docs', md(`docs-rule-${d.name}`, `**${n}.${j + 1}** ${d.rule}\n\n*Why:* ${d.summary} *Decided in [[${d.name}|${d.title}]] · ${areaTitle(d.scope || 'general')}.*`, { indent: true })),
              )
              if (isEditing(d)) blocks.push(...ruleForm(d))
            })
          })
        }
        if (g.terms.length) {
          const n = ++num
          foldable(`${g.key}:glossary`, `${n}. ${g.label} glossary`, `${g.terms.length} term${g.terms.length === 1 ? '' : 's'}`, () => {
            for (const t of g.terms) {
              const used = backlinksOf(t.name, current).filter(b => b.kind === 'decision')
              const text = `**[[${t.name}|${t.title}]]** *(${t.subtitle})*: ${t.summary || 'Not defined yet.'}${used.length ? `\n\nUsed in ${used.map(b => `[[${b.name}|${b.title}]]`).join(', ')}.` : ''}`
              blocks.push(withTools(t, 'docs', md(`docs-term-${t.name}`, text, { indent: true })))
              if (isEditing(t)) blocks.push(...termForm(t.name, t))
            }
          })
        }
      }
      if (open.length) {
        foldable('open', `${num + 1}. Open questions`, `${open.length}`, () => {
          blocks.push(md('docs-open', open.map(d => `- [[${d.name}|${d.title}]] *(${d.status})*: ${d.summary}`).join('\n')))
        })
      }
    }
  } else if (tab === 'terms') {
    // A dictionary: search by word, jump by first letter, narrow by type.
    if (!querySeeds.has('terms')) querySeeds.set('terms', termQ)
    const q = termQ.trim().toLowerCase()
    const letters = [...new Set(terms.map(t => t.title.charAt(0).toUpperCase()))].sort()
    const types = [...new Set(terms.map(t => t.subtitle))].sort()
    const shown = terms.filter(
      t =>
        (!termL || t.title.toUpperCase().startsWith(termL)) &&
        (!termT || t.subtitle === termT) &&
        (!q || t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)),
    )
    blocks.push(
      <Box key="term-controls" flexDirection="column" marginTop={1} width="100%">
        <Input
          key="term-search"
          value={querySeeds.get('terms') ?? ''}
          placeholder="Search terms and definitions"
          submitLabel="↵"
          onInput={v => fire(update($, termQuery, () => v))}
          onSubmit={v => fire(update($, termQuery, () => v))}
        />
        <Box marginTop={1} gap={1} flexWrap="wrap">
          {tabButton('letter-all', 'All', !termL, () => fire(update($, termLetter, () => '')))}
          {letters.map(l => tabButton(`letter-${l}`, l, termL === l, () => fire(update($, termLetter, () => (termL === l ? '' : l)))))}
        </Box>
        <Select
          key="term-type"
          value={termT}
          options={[{ value: '', label: 'All types' }, ...types.map(t => ({ value: t, label: t }))]}
          onSelect={v => fire(update($, termType, () => v))}
        />
      </Box>,
    )
    heading(`Glossary · ${shown.length === terms.length ? terms.length : `${shown.length} of ${terms.length}`}`)
    if (!terms.length) blocks.push(<Text key="no-terms" dimColor>No term notes in {termsDir}/ yet.</Text>)
    else if (!shown.length) blocks.push(<Text key="no-match" dimColor>No term matches. Clear the search, the letter or the type.</Text>)
    const dictionary = (list: readonly NoteEntry[]) => {
      let lastLetter = ''
      for (const n of list) {
        const first = n.title.charAt(0).toUpperCase()
        if (first !== lastLetter) {
          blocks.push(
            <Box key={`letter-head-${first}-${n.name}`} marginTop={1}>
              <Text bold color="suggestion">
                {first}
              </Text>
            </Box>,
          )
          lastLetter = first
        }
        entry(n, 'idx')
      }
    }
    const ownTerms = shown.filter(t => !isBase(t))
    const baseTerms = shown.filter(isBase)
    if (ownTerms.length) {
      heading(`This project's terms · ${ownTerms.length}`)
      dictionary(ownTerms)
    }
    if (baseTerms.length) foldable('base:terms', 'Base prompt terms', `${baseTerms.length}`, () => dictionary(baseTerms), Boolean(q || termL || termT))
  } else {
    // Rules: what is in force, in ADR number order; the project's own first,
    // the base prompt's in a folded section. Each rule's record is one click away.
    const inForce = decisions.filter(d => d.status === 'accepted' && d.rule).sort(byNumber)
    const waiting = decisions.filter(d => d.status === 'proposed').sort(byNumber)
    const own = inForce.filter(d => !isBase(d))
    const base = inForce.filter(isBase)
    heading(`Rules in force · ${inForce.length}`)
    if (!inForce.length) blocks.push(<Text key="no-rules" dimColor>No accepted rules yet.</Text>)
    const ruleRow = (d: NoteEntry) => {
      blocks.push(
        withTools(
          d,
          'rules',
          <Box flexDirection="column">
            {md(`rule-md-${d.name}`, d.rule)}
            <Box gap={1}>
              <Button key={`idx-${d.name}`} plain onPress={() => choose(d.name)}>
                {d.title}
              </Button>
              <Text dimColor>{`${d.scope || 'general'} · record and reasoning`}</Text>
            </Box>
          </Box>,
        ),
      )
      if (isEditing(d)) blocks.push(...ruleForm(d))
    }
    if (own.length) {
      heading(`This project's rules · ${own.length}`)
      own.forEach(ruleRow)
    }
    if (base.length) foldable('base:rules', 'Base prompt rules', `${base.length}`, () => base.forEach(ruleRow))
    if (waiting.length) {
      heading(`Waiting on you · ${waiting.length}`)
      for (const d of waiting) entry(d, 'idx')
    }
    if (hidden)
      blocks.push(
        <Box key="hidden" marginTop={1}>
          <Text dimColor>{hidden} superseded or retired, left out</Text>
        </Box>,
      )
  }

  const setTab = (t: 'rules' | 'terms' | 'docs') => () => {
    fire(update($, noteTab, () => t))
    choose('')
  }
  return (
    <Box flexDirection="column" width="100%" paddingX={1}>
      <Box gap={2}>
        <Box gap={1}>
          {nav.at > 0 ? (
            <Button key="nav-back" plain onPress={() => goTo(nav.at - 1)}>
              ←
            </Button>
          ) : (
            <Text dimColor>←</Text>
          )}
          {nav.at < nav.stack.length - 1 ? (
            <Button key="nav-forward" plain onPress={() => goTo(nav.at + 1)}>
              →
            </Button>
          ) : (
            <Text dimColor>→</Text>
          )}
        </Box>
        {tabButton('tab-rules', 'Rules', tab === 'rules' && !sel, setTab('rules'))}
        {tabButton('tab-terms', 'Terms', tab === 'terms' && !sel, setTab('terms'))}
        {tabButton('tab-docs', 'Docs', tab === 'docs' && !sel, setTab('docs'))}
      </Box>
      <Box flexDirection="column">{blocks}</Box>
    </Box>
  )
}

export const register: Register = (on, options) => {
  config.adrDir = String(options.adrDir ?? 'decisions')
  config.termsDir = String(options.termsDir ?? 'terms')
  setTermsHref(config.termsDir)
  config.indexFile = String(options.indexFile ?? '')
  config.docsFile = String(options.docsFile ?? '')
  config.baseFile = String(options.baseFile ?? '')
  config.claudeFile = String(options.claudeFile ?? '')
  config.projectVault = String(options.projectVault ?? 'vault')
  config.workspaceRoot = String(options.workspaceRoot ?? '')
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'decisions',
      description: 'Ask the decisions waiting for you in the question dialog',
    })
    await $.command.register({
      name: 'ref-guide',
      description: 'Open the reference guide: rules in force, the glossary and open questions',
    })
    config.projectRoot = e.cwd
    config.active = inWorkspace(e.cwd, config.workspaceRoot)
    if (!config.active) return next(e)
    const result = await next(e)
    await ensureVault($).catch(() => {})
    void refresh($).catch(() => {})
    $.clock.every(POLL_MS, () => {
      void refresh($).catch(() => {})
    })
    return result
  })

  on('command.run', { command: 'ref-guide' }, async $ => {
    await refresh($).catch(() => {})
    const { isPlaced } = await $.ui.open({ id: REF_GUIDE, title: 'Reference guide', columns: 72 })
    return { text: isPlaced ? 'Reference guide opened.' : `This surface draws no panel. The same content is in ${config.docsFile || 'Docs.md'}.` }
  })

  // The reference guide's panel: Rules, Terms and Docs tabs over the vault, read-only.
  on('ui.render', { component: 'Pane', requestId: REF_GUIDE }, async ($, e, next) => {
    if (!config.active) return next(e)
    return drawReference($, e, await read($, notes), { termsDir: config.termsDir, isBase })
  })

  on('command.run', { command: 'decisions' }, async $ => {
    await refresh($).catch(() => {})
    const ids = (await read($, pending)).map(c => c.id || c.file)
    if (!ids.length) return { text: 'Nothing is waiting for you.' }
    return {
      text: `${ids.join(', ')} ${ids.length > 1 ? 'are' : 'is'} waiting. Send any message and the agent asks ${ids.length > 1 ? 'them' : 'it'} in the question dialog.`,
      context: [`[decision-cards] The person wants to answer ${ids.join(', ')}. On your next turn, first call AskUserQuestion with one question per ADR (at most 4 per call), its header set to the ADR id.`],
    }
  })

  // Agents ask through the native question dialog (ADR-0010), one question per
  // proposed ADR, its header the ADR id. The mod fills each question from the file,
  // so every dialog has the same shape, and writes the answer back into the ADR.
  // If the guard itself fails, the question goes through rather than being lost.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (!config.active) return next(e)
    await ensureVault($)
    await refresh($).catch(() => {})
    const asked = ((e as { questions?: { header?: string }[] }).questions ?? []).map(q => String(q.header ?? '').trim())
    const built: Dialog[] = []
    const problems: string[] = []
    for (const id of asked) {
      const file = /^ADR-\d+$/i.test(id) ? `${id.toUpperCase()}.md` : ''
      const p = file ? parsedByFile.get(file) : undefined
      if (!p) problems.push(`"${id}" is not an ADR in ${config.adrDir}`)
      else if (p.status !== 'proposed') problems.push(`${id} is ${p.status || 'not proposed'}, not waiting`)
      else if (p.error) problems.push(`${id}: ${p.error}`)
      else if (p.options.length > 4) problems.push(`${id} has ${p.options.length} options; the dialog takes at most 4`)
      else built.push(dialogOf(file, p, await Promise.all(p.names.map(n => termOf($, n)))))
    }
    if (!asked.length || problems.length) {
      const nextId = nextAdrId(await read($, notes))
      return { deny: [...(problems.length ? [`Not asked: ${problems.join('; ')}.`] : []), askInstead(nextId, config.adrDir, config.termsDir)].join('\n') }
    }
    const result = await next({ ...e, questions: built.map(d => d.question) } as typeof e)
    if (result.deny !== undefined || result.isError || !result.result) return result
    const out = result.result as { answers?: Record<string, string>; afkTimeoutMs?: number }
    if (out.afkTimeoutMs) return { ...result, context: [...(result.context ?? []), '[decision-cards] The dialog timed out unanswered. Those ADRs stay proposed: ask again later, and do not act as if they were decided.'] }
    const notes2: string[] = []
    for (const d of built) {
      const said = String(out.answers?.[d.question.question] ?? '').trim()
      notes2.push(await recordAnswer($, d, said))
    }
    return { ...result, context: [...(result.context ?? []), ...notes2.filter(Boolean)] }
  }).catch(($, e, next) => next(e))

  // A proposed ADR that breaks QUESTION_RULE is refused when an agent writes it, with
  // what to fix, so the rule is applied rather than recited.
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (!config.active) return next(e)
    const file = adrFileOf(e)
    if (!file) return next(e)
    const text = String((e as { content?: unknown }).content ?? '')
    const parsed = parseAdr(text)
    if (parsed.status !== 'proposed') return next(e)
    const problems = checkQuestion(parsed, await read($, notes))
    if (!problems.length) {
      const result = await next(e)
      if (result.deny !== undefined || result.isError) return result
      const id = parsed.id || file.slice(0, -3)
      return { ...result, context: [...(result.context ?? []), `[decision-cards] ${id} is written. Now ask it: call AskUserQuestion with a question whose header is ${id} (ADR-0010), then act on the answer.`] }
    }
    return { deny: `${file} breaks ${QUESTION_RULE}, so it was not written: ${problems.join('; ')}. Fix these and write it again.` }
  }).catch(($, e, next) => next(e))

  // Each main-thread reply is checked against the reply rule in force (REPLY_RULE):
  // a broken one is flagged under the reply, and the agent is told.
  on('turn.complete', async ($, e, next) => {
    if (!config.active) return next(e)
    const result = await next(e)
    if (('agentId' in e && e.agentId) || e.reason !== 'answer') return result
    const rule = findNote(REPLY_RULE, await read($, notes))
    if (!rule || rule.status !== 'accepted') return result
    const problems = checkReply(e.answer, (await read($, notes)).filter(n => n.kind === 'term' && isCurrent(n)).map(n => n.name))
    if (!problems.length) return result
    await tellAgent($, `[decision-cards] Your last reply broke ${REPLY_RULE} (four labelled lines: Done, Open, Needs you, Check; at most 8 lines): ${problems.join('; ')}. Use that shape for every reply.`)
    return { ...result, text: `⚠ This reply breaks ${REPLY_RULE}: ${problems.join('; ')}.` }
  }).catch(($, e, next) => next(e))

  // Every system prompt carries the current reference, so work in this project
  // uses the newest terms and decisions and drops superseded ones.
  on('prompt.compose', async ($, e, next) => {
    if (!config.active) return next(e)
    const result = await next(e)
    const text = currentReference(await read($, notes))
    if (!text) return result
    return { sections: [...result.sections, { id: 'decision-cards:reference', text, scope: 'session' as const }] }
  })

}
