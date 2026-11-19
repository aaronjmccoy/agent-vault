import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Card, CardOption, CardTerm, NoteEntry, OtherDraft, TermEdit } from '../types'
import {
  backlinksOf,
  currentReference,
  basePrompt,
  decisionNote,
  findNote,
  isCurrent,
  latestOf,
  newTermText,
  nextAdrId,
  noteFromHref,
  reviseAdrText,
  setFrontmatter,
  stripFrontmatter,
  supersedeText,
  TERM_TYPES,
  termNote,
  toMarkdown,
  updateTermText,
  areaTitle,
  replaceRule,
  docsDocument,
  vaultIndex,
} from './notes'
import { TEMPLATES, inWorkspace, vaultRootOf } from './vault'
import { setTermsHref, checkQuestion, checkReply, QUESTION_RULE, REPLY_RULE } from './lint'
import { assemble, isEars, markUnclear, parseSuggestion, EMPTY_DRAFT, isStarted, missingSlots, patternOf, PATTERNS, suggestRequest, undefinedTerms } from './compose'

// One pane holds all three columns. The other two ids belong to an earlier
// three-pane version and are only closed now.
const PANE = 'decisions'
const TITLE = 'Decisions'
const ANSWER = 'decisions-answer'
// Reference material, docked beside the conversation.
const REF_PANE = 'decisions-reference'
const NOTES_PANE = 'decisions-notes'
const POLL_MS = 2000
const OTHER = 'Other'
const FREE = 'Free'
// The rule suggested from free text, once the person picks it.
const FORMED = 'Formed'

const cards = atom({ plugin: 'decision-cards', key: 'cards' } as const, [], {
  shape: 'cards-2',
})
const picks = atom({ plugin: 'decision-cards', key: 'picks' } as const, {}, {
  shape: 'picks-1',
})
const drafts = atom({ plugin: 'decision-cards', key: 'drafts' } as const, {}, {
  shape: 'drafts-2',
})
const vocab = atom({ plugin: 'decision-cards', key: 'vocab' } as const, [], {
  shape: 'vocab-1',
})
const notes = atom({ plugin: 'decision-cards', key: 'notes' } as const, [] as NoteEntry[], {
  shape: 'notes-3',
})
// The term whose edit form is open; '' for none.
const editing = atom({ plugin: 'decision-cards', key: 'editing' } as const, '', {
  shape: 'editing-1',
})
const suggestions = atom({ plugin: 'decision-cards', key: 'suggestions' } as const, {}, {
  shape: 'suggestions-1',
})
const ruleEdits = atom({ plugin: 'decision-cards', key: 'ruleEdits' } as const, {}, {
  shape: 'ruleedits-1',
})
// Docs sections the person has opened.
const docsOpen = atom({ plugin: 'decision-cards', key: 'docsOpen' } as const, [] as string[], {
  shape: 'docsopen-1',
})
// The card whose "Talk with me more" box is open, and what is typed in it.
const talkOpen = atom({ plugin: 'decision-cards', key: 'talkOpen' } as const, '', {
  shape: 'talkopen-1',
})
const talkText = atom({ plugin: 'decision-cards', key: 'talkText' } as const, {}, {
  shape: 'talktext-1',
})
// ADR files decided in this session: their tabs stay open with the outcome until closed.
const doneTabs = atom({ plugin: 'decision-cards', key: 'doneTabs' } as const, [] as string[], {
  shape: 'donetabs-1',
})
// Glossary controls: the search text, the A–Z letter, the term type ('' = all).
const termQuery = atom({ plugin: 'decision-cards', key: 'termQuery' } as const, '', { shape: 'termquery-1' })
const termLetter = atom({ plugin: 'decision-cards', key: 'termLetter' } as const, '', { shape: 'termletter-1' })
const termType = atom({ plugin: 'decision-cards', key: 'termType' } as const, '', { shape: 'termtype-1' })
// Docs search text.
const docsQuery = atom({ plugin: 'decision-cards', key: 'docsQuery' } as const, '', { shape: 'docsquery-1' })
// Where the person has been in Reference: '' is the list view of the current tab.
const navHistory = atom({ plugin: 'decision-cards', key: 'navHistory' } as const, { stack: [''], at: 0 }, { shape: 'nav-1' })
const termEdits = atom({ plugin: 'decision-cards', key: 'termEdits' } as const, {}, {
  shape: 'termedits-1',
})
const freeText = atom({ plugin: 'decision-cards', key: 'freeText' } as const, {}, {
  shape: 'free-1',
})
// Which pending decision the pane shows.
const activeCard = atom({ plugin: 'decision-cards', key: 'activeCard' } as const, '', {
  shape: 'active-1',
})
// Per card: 'form' builds a rule, 'free' takes plain words.
const modes = atom({ plugin: 'decision-cards', key: 'modes' } as const, {}, {
  shape: 'modes-1',
})
const noteTab = atom({ plugin: 'decision-cards', key: 'noteTab' } as const, 'rules', {
  shape: 'notetab-2',
})
// The decision whose record (reasoning, options, consequences) is shown; '' for none.
const showRecord = atom({ plugin: 'decision-cards', key: 'showRecord' } as const, '', {
  shape: 'record-1',
})
// The note the browser shows; '' shows the whole set.
const selected = atom({ plugin: 'decision-cards', key: 'selected' } as const, '', {
  shape: 'selected-1',
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

type Parsed = Omit<Card, 'terms' | 'file' | 'lint'> & { status: string; names: string[] }

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
  const m = text.match(/^Decision\s+([A-Z])/m)
  return m ? m[1] ?? null : null
}

export const definitionOf = (text: string): string | null => {
  const m = text.match(/\*\*Definition:\*\*\s*(.+)/)
  return m ? (m[1] ?? "").trim() : null
}

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim()

// Records the decision and sets the status, keeping everything else.
// A built rule is accepted; a free-text request is "answered" until an agent
// turns it into a rule.
export const acceptText = (text: string, letter: string, other = '', request = ''): string => {
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const { metaEnd } = splitFrontmatter(text)
  const status = letter === FREE ? 'answered' : 'accepted'
  for (let i = 1; i < metaEnd; i++) {
    const l = lines[i] ?? ''
    if (/^status:/.test(l)) lines[i] = l.replace(/^status:\s*\S+/, `status: ${status}`)
  }
  while (lines.length && (lines[lines.length - 1] ?? '').trim() === '') lines.pop()
  if (letter === FREE) {
    lines.push('', `Decision  ${OTHER}`, `Request   ${oneLine(other)}`)
  } else {
    lines.push('', `Decision  ${letter === FORMED ? OTHER : letter}`)
    if (letter === OTHER || letter === FORMED) lines.push(`Other     ${oneLine(other)}`)
    if (letter === FORMED && request.trim()) lines.push(`Request   ${oneLine(request)}`)
  }
  lines.push('')
  return lines.join(nl)
}

// Fire-and-forget for writes from handlers: a lost race is not an error worth surfacing.
const fire = (p: Promise<unknown>): void => {
  void p.catch(() => {})
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
// The text each form field starts with, set once per card (see the render hook).
const seeds = new Map<string, OtherDraft>()
const freeSeeds = new Map<string, string>()
const termSeeds = new Map<string, string>()
const ruleSeeds = new Map<string, string>()
const talkSeeds = new Map<string, string>()
// Search fields keep their own text; these are what they start with.
const querySeeds = new Map<string, string>()

type ColumnId = 'decision' | 'rule' | 'notes'


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
// ADR-0001, ADR-0002, … in number order.
const byNumber = (a: NoteEntry, b: NoteEntry) => a.name.localeCompare(b.name, undefined, { numeric: true })


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

  const next: Card[] = []
  for (const [file, p] of [...parsedByFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (p.status !== 'proposed') continue
    const terms: CardTerm[] = []
    for (const n of p.names) terms.push(await termOf($, n))
    const { status: _s, names: _n, ...rest } = p
    next.push({ ...rest, file, terms, lint: checkQuestion(p, await read($, notes)) })
  }
  const before = JSON.stringify(await read($, cards))
  if (before !== JSON.stringify(next)) await update($, cards, () => next)
  const ids = next.map(c => c.id || c.file)
  const fresh = ids.filter(id => !knownPending.has(id))
  if (!announced && ids.length) {
    $.ui.toast(`${ids.length} decision${ids.length > 1 ? 's are' : ' is'} waiting in the Decisions panel.`)
  } else if (announced && fresh.length) {
    $.ui.toast(`${fresh.join(', ')} ${fresh.length > 1 ? 'need' : 'needs'} your decision in the Decisions panel.`)
  }
  announced = true
  knownPending = new Set(ids)
}

async function accept($: EngineInterface, card: Card): Promise<void> {
  const chosen = (await read($, picks))[card.file] ?? card.recommend
  if (!chosen) {
    $.ui.toast(`${card.id}: pick an option first`)
    return
  }
  const draft = (await read($, drafts))[card.file] ?? EMPTY_DRAFT
  const missing = missingSlots(draft)
  if (chosen === OTHER && missing.length) {
    $.ui.toast(`${card.id}: fill in the ${missing.join(', ')} first`)
    return
  }
  const said = ((await read($, freeText))[card.file] ?? '').trim()
  if (chosen === FREE && !said) {
    $.ui.toast(`${card.id}: write what you want first`)
    return
  }
  const formed = (await read($, suggestions))[card.file]
  if (chosen === FORMED && !isEars(said)) {
    $.ui.toast(`${card.id}: the rule in the field is not an EARS sentence any more`)
    return
  }
  const extra = chosen === OTHER ? assemble(draft) : chosen === FREE ? said : chosen === FORMED ? said : ''
  const path = joinPath(config.adrDir, card.file)
  const before = String(await $.fs.read(path))
  await $.fs.write(path, acceptText(before, chosen, extra, chosen === FORMED ? formed?.source ?? '' : ''))
  // Accepting a revision retires what it revises, so only the newest stays in force.
  const replaces = stripFrontmatter(before).meta.supersedes?.replace(/^\[\[|\]\]$/g, '')
  if (replaces) {
    const oldPath = joinPath(config.adrDir, `${replaces}.md`)
    try {
      await $.fs.write(oldPath, supersedeText(String(await $.fs.read(oldPath)), card.id))
    } catch {
      $.ui.toast(`${card.id}: accepted, but ${replaces} could not be marked superseded`)
    }
  }
  seen.delete(card.file)
  seeds.delete(card.file)
  freeSeeds.delete(card.file)
  await update($, doneTabs, x => (x.includes(card.file) ? x : [...x, card.file]))
  const decided =
    chosen === FREE
      ? `${card.id} answered by the person in their own words, not yet a rule: "${said}". Turn it into one EARS rule and propose it as a revision before acting on it.`
      : `${card.id} accepted. Rule in force: ${chosen === OTHER || chosen === FORMED ? extra : card.options.find(o => o.letter === chosen)?.rule ?? chosen}`
  await tellAgent($, `[decision-cards] ${decided}`)
  $.ui.toast(chosen === FREE ? `${card.id}: sent; an agent will turn it into a rule` : `${card.id} accepted: ${chosen}`)
  await refresh($)
}

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

// Opens the Decisions panel beside the conversation. It stays open: nothing here closes it.
async function openPanel($: EngineInterface): Promise<void> {
  await $.ui.open({ id: PANE, title: TITLE, columns: 64 })
}

// Panes from earlier versions, folded into the one Decisions panel.
async function closeOldPanes($: EngineInterface): Promise<void> {
  for (const id of [ANSWER, NOTES_PANE, REF_PANE]) {
    try {
      await $.ui.close({ id })
    } catch {}
  }
}

const suggestSeq = new Map<string, number>()

// Asks a small model to rewrite the person's free text as one EARS sentence,
// when they press Suggest rule. A reply that is not a rule is dropped.
function requestSuggestion($: EngineInterface, card: Card, words: string): void {
  const n = (suggestSeq.get(card.file) ?? 0) + 1
  suggestSeq.set(card.file, n)
  if (!words.trim()) {
    $.ui.toast('Write something first, then press Suggest rule.')
    return
  }
  void suggestRule($, card, words, n).catch(() => {})
}

async function suggestRule($: EngineInterface, card: Card, words: string, n: number): Promise<void> {
  await update($, suggestions, x => ({ ...x, [card.file]: { source: words, sentence: '', state: 'working' as const, unclear: [] } }))
  const vocab = await read($, notes).then(all => all.filter(t => t.kind === 'term').map(t => t.name))
  const { system, prompt } = suggestRequest(words, card.decide, vocab)
  const reply = await $.model.complete({ model: 'haiku', system, prompt, maxTokens: 400, effort: 'low' })
  if (suggestSeq.get(card.file) !== n) return
  const { sentence, unclear } = reply.isAnswered ? parseSuggestion(reply.text, vocab, words) : { sentence: '', unclear: [] }
  await update($, suggestions, x => ({
    ...x,
    [card.file]: { source: words, sentence, state: sentence ? ('ready' as const) : ('none' as const), unclear },
  }))
  if (sentence) {
    // Better words replace the person's own in the field; the originals are kept as the request.
    freeSeeds.set(card.file, sentence)
    await update($, freeText, f => ({ ...f, [card.file]: sentence }))
    await update($, picks, p => ({ ...p, [card.file]: FORMED }))
  }
}

// Puts the person's own words back after a rewrite.
async function undoRewrite($: EngineInterface, card: Card): Promise<void> {
  const formed = (await read($, suggestions))[card.file]
  if (!formed) return
  freeSeeds.set(card.file, formed.source)
  await update($, freeText, f => ({ ...f, [card.file]: formed.source }))
  await update($, suggestions, x => {
    const { [card.file]: _gone, ...rest } = x
    return rest
  })
  await update($, picks, p => ({ ...p, [card.file]: FREE }))
}

// Defers a pending ADR (its tab closes; it stays undecided) or reopens a
// deferred one (its tab comes back, active).
async function setStatus($: EngineInterface, file: string, id: string, status: 'deferred' | 'proposed'): Promise<void> {
  const path = joinPath(config.adrDir, file)
  await $.fs.write(path, setFrontmatter(String(await $.fs.read(path)), { status }))
  seen.delete(file)
  if (status === 'proposed') {
    await update($, activeCard, () => file)
    await update($, doneTabs, x => x.filter(f => f !== file))
  } else await update($, doneTabs, x => (x.includes(file) ? x : [...x, file]))
  if (status === 'deferred') await tellAgent($, `[decision-cards] ${id} was deferred by the person. It is still undecided: do not act as if it were decided.`)
  $.ui.toast(status === 'deferred' ? `${id} deferred. It stays open as undecided.` : `${id} reopened`)
  await refresh($)
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
    `Questions to the person go through decision cards here (${QUESTION_RULE}), not the question tool.`,
    `Write a proposed ADR to ${adrDir}/${nextId}.md, in this shape:`,
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
    'Write the file with the Write tool: its decision card appears in the Decisions panel for the person to answer. Then end your turn. Their answer reaches you as a note in this conversation.',
  ].join('\n')

// Puts a note in the conversation for the agent: the model reads it on its next request.
async function tellAgent($: EngineInterface, text: string): Promise<void> {
  try {
    await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
  } catch {}
}

// "Talk with me more": the person's prompt starts an agent turn about the card,
// and the agent is asked to fold what comes out of it back into the ADR.
async function talkMore($: EngineInterface, card: Card): Promise<void> {
  const words = ((await read($, talkText))[card.file] ?? '').trim()
  if (!words) {
    $.ui.toast('Write what you want to talk through first.')
    return
  }
  const path = joinPath(config.adrDir, card.file)
  talkSeeds.delete(card.file)
  await update($, talkText, x => {
    const { [card.file]: _gone, ...rest } = x
    return rest
  })
  await update($, talkOpen, () => '')
  await $.prompt.submit({
    text: [
      `[decision-cards] Before I decide ${card.id} (${plain(card.decide)}), I want to talk it through:`,
      '',
      words,
      '',
      `Answer me here first. Then revise ${path} in place so its Given, its options and their consequences reflect what we found: add or reword options if needed, keep each option one EARS rule, keep status: proposed, and do not decide for me.`,
    ].join('\n'),
  })
  $.ui.toast(`Sent. The agent will answer in the chat and update ${card.id}.`)
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

// Opens a proposed revision of a decided ADR and shows it.
async function reviseDecision($: EngineInterface, note: NoteEntry): Promise<void> {
  const newId = nextAdrId(await read($, notes))
  const file = `${newId}.md`
  await $.fs.write(joinPath(config.adrDir, file), reviseAdrText(String(await $.fs.read(note.file)), note.title, newId))
  await update($, activeCard, () => file)
  $.ui.toast(`${newId} opened to revise ${note.title}`)
  await refresh($)
}

// The ADR file a Write call targets, when it is one in the Decisions folder.
export const adrFileOf = (input: unknown): string => {
  const path = typeof input === 'object' && input && 'file_path' in input ? String((input as { file_path: unknown }).file_path) : ''
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  if (!norm(path).startsWith(norm(config.adrDir) + '/')) return ''
  const name = path.replace(/\\/g, '/').split('/').pop() ?? ''
  return /^ADR-\d+\.md$/i.test(name) ? name : ''
}

// Draws the decision card or the reference, the two halves of the Decisions panel.
async function drawView($: EngineInterface, e: RenderInput, view: 'card' | 'reference' | 'row', only = '') {
  const { adrDir, termsDir } = config
    const { Box, Text, Button, Input, Select, Markdown } = $.ui.resolve(e)
    const list = await read($, cards)
    const chosen = await read($, picks)
    const typed = await read($, drafts)
    const words = await read($, vocab)
    const allNotes = await read($, notes)
    const sel = await read($, selected)
    const said = await read($, freeText)
    const active = await read($, activeCard)
    const modeOf = await read($, modes)
    const tab = await read($, noteTab)
    const editingTerm = await read($, editing)
    const edits = await read($, termEdits)
    const formedAll = await read($, suggestions)
    const showing = await read($, showRecord)
    const ruleDrafts = await read($, ruleEdits)
    const docsShown = await read($, docsOpen)
    const termQ = await read($, termQuery)
    const termL = await read($, termLetter)
    const termT = await read($, termType)
    const docsQ = await read($, docsQuery)
    const nav = await read($, navHistory)
    const talking = await read($, talkOpen)
    const talkTyped = await read($, talkText)

    type El = ReturnType<typeof h>
    type Block = { el: El; rows: number }

    // ---- layout: the card is two columns in the feed; Reference is one
    const bodyCols = (e.component === 'Pane' ? e.props.bodyColumns : undefined) ?? e.viewport?.columns ?? 100
    const gap = 1
    const wide = view !== 'reference' && bodyCols >= 90
    const colW = wide ? Math.floor((bodyCols - gap) / 2) : bodyCols
    const textW = Math.max(10, colW - 4)
    // Decisions made here stay on screen with their outcome; nothing is torn down.
    const noteOf = (file: string) => allNotes.find(n => n.kind === 'decision' && n.name.toLowerCase() === file.replace(/\.md$/i, '').toLowerCase())
    const doneFiles = (await read($, doneTabs)).filter(f => !list.some(c => c.file === f))
    const tabs = [
      ...list.map(c => ({ file: c.file, id: c.id || c.file, decide: c.decide, done: false })),
      ...doneFiles.map(f => {
        const n = noteOf(f)
        return { file: f, id: n?.title ?? f, decide: n?.summary ?? '', done: true }
      }),
    ]
    const focusFile = view === 'row' ? only : tabs.some(t => t.file === active) ? active : (tabs[0]?.file ?? '')
    const card = list.find(c => c.file === focusFile)
    const doneNote = card ? undefined : noteOf(focusFile)

    const rowsOf = (text: string, w = textW) =>
      text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(1, w))), 0)
    const block = (el: El, rows: number): Block => ({ el, rows })
    // Word-wraps text to lines of at most `width` characters (a longer word stands alone).
    const wrapWords = (text: string, width: number): string[] => {
      const lines: string[] = []
      let line = ''
      for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + word.length > Math.max(10, width)) {
          lines.push(line)
          line = word
        } else line = line ? `${line} ${word}` : word
      }
      if (line) lines.push(line)
      return lines
    }

    const choose = (name: string) => {
      fire(update($, selected, () => name))
      fire(update($, editing, () => ''))
      fire(
        update($, navHistory, h => {
          if (h.stack[h.at] === name) return h
          const stack = [...h.stack.slice(0, h.at + 1), name].slice(-50)
          return { stack, at: stack.length - 1 }
        }),
      )
    }
    const goTo = (at: number) => {
      const target = nav.stack[at]
      if (target === undefined) return
      fire(update($, navHistory, h => ({ ...h, at })))
      fire(update($, selected, () => target))
      fire(update($, editing, () => ''))
    }

    const isDefined = (name: string) => !!findNote(name, allNotes)
    // A sentence with its [[links]] as real links: clicking one opens that note
    // in the Reference half of the panel. <placeholders> are kept as written.
    const md = (key: string, text: string, opts: { bold?: boolean; dim?: boolean } = {}) => {
      const safe = text.replace(/[<>]/g, ch => `\\${ch}`)
      return (
        <Markdown
          key={key}
          text={toMarkdown(opts.bold ? `**${safe.trim()}**` : safe)}
          dimColor={opts.dim ? true : undefined}
          onLinkPress={link => {
            const name = noteFromHref(link.href)
            if (name) choose(name)
          }}
        />
      )
    }
    // Hover changes color only, never weight or size, so nothing reflows.
    const linked = (text: string) => {
      const parts: (string | El)[] = []
      let at = 0
      for (const m of text.matchAll(LINK)) {
        const i = m.index ?? 0
        if (i > at) parts.push(text.slice(at, i))
        const name = (m[1] ?? '').trim()
        parts.push(
          <Text underline color={isDefined(name) ? 'suggestion' : 'warning'} hover={{ scope: `term-${name}`.slice(0, 64), color: 'claude' }}>
            {(m[2] ?? m[1] ?? '').trim()}
          </Text>,
        )
        at = i + m[0].length
      }
      if (at < text.length) parts.push(text.slice(at))
      return parts
    }

    // A bordered panel taking a third of the row; the row stretches every
    // column to the tallest, and the pane's own scroll moves them together.
    const column = (id: ColumnId, header: El, blocks: Block[], width: string) => (
      <Box key={`col-${id}`} flexDirection="column" width={width} flexGrow={1} flexShrink={1} borderStyle="round" borderColor="subtle" paddingX={1}>
        {header}
        <Box flexDirection="column">{blocks.map(b => b.el)}</Box>
      </Box>
    )

    const tabButton = (key: string, label: string, isOn: boolean, press: () => void) => (
      <Box flexDirection="column">
        <Button key={key} plain onPress={press}>
          {label}
        </Button>
        <Text color={isOn ? 'suggestion' : 'subtle'}>{isOn ? '─'.repeat(label.length) : ' '}</Text>
      </Box>
    )

    // ---- column 3: the notes, laid out as a reference document
    const current = allNotes.filter(isCurrent)
    const terms = current.filter(n => n.kind === 'term').sort((a, b) => a.title.localeCompare(b.title))
    const decisions = current.filter(n => n.kind === 'decision').sort((a, b) => a.title.localeCompare(b.title))
    const hidden = allNotes.length - current.length
    const numberOf = (n: NoteEntry) => {
      const i = (n.kind === 'term' ? terms : decisions).indexOf(n)
      return i < 0 ? (n.kind === 'term' ? '1.–' : '2.–') : `${n.kind === 'term' ? 1 : 2}.${i + 1}`
    }

    const termForm = (name: string, existing: NoteEntry | undefined, w: number): Block[] => {
      const edit = edits[name] ?? { type: existing?.subtitle && TERM_TYPES.includes(existing.subtitle as never) ? existing.subtitle : 'entity', definition: existing?.summary ?? '' }
      if (!termSeeds.has(name)) termSeeds.set(name, edit.definition)
      const setEdit = (patch: Partial<TermEdit>) => {
        fire(update($, termEdits, x => ({ ...x, [name]: { ...(x[name] ?? edit), ...patch } })))
      }
      return [
        block(
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Type</Text>
            <Select key={`edit-type-${name}`} value={edit.type} options={TERM_TYPES.map(t => ({ value: t, label: t }))} onSelect={v => setEdit({ type: v })} />
          </Box>,
          3,
        ),
        block(
          <Box flexDirection="column" marginTop={1} width="100%">
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
          5,
        ),
        block(
          <Box marginTop={1} gap={2}>
            <Button
              key={`edit-save-${name}`}
              variant="primary"
              onPress={() => {
                void saveTerm($, name, edits[name] ?? edit, !!existing).catch(() => $.ui.toast(`${name}: could not save`))
              }}
            >
              {existing ? `Save as v${(Number.parseInt(existing.version, 10) || 1) + 1}` : 'Create term'}
            </Button>
            <Button key={`edit-cancel-${name}`} plain onPress={() => fire(update($, editing, () => ''))}>
              Cancel
            </Button>
          </Box>,
          2,
        ),
        block(<Text dimColor>{existing ? 'Saving replaces the old definition; agents use only the new one.' : `Creates ${joinPath(termsDir, `${name}.md`)}.`}</Text>, rowsOf('Saving replaces the old definition; agents use only the new one.', w)),
      ]
    }

    const notesColumn = (width: string, cells: number) => {
      const w = Math.max(10, cells - 4)
      const blocks: Block[] = []

      // ---- editing: a pencil at the top right of an item opens its editor in place
      const editKey = (n: NoteEntry) => (n.kind === 'term' ? n.name : `rule:${n.name}`)
      const isEditing = (n: NoteEntry) => editingTerm === editKey(n)
      const canEdit = (n: NoteEntry) => n.kind === 'term' || (n.status === 'accepted' && !!n.rule && isCurrent(n))
      const pencil = (n: NoteEntry, where: string) => (
        <Button key={`pencil-${where}-${n.name}`} plain onPress={() => fire(update($, editing, () => (isEditing(n) ? '' : editKey(n))))}>
          {isEditing(n) ? '✕' : '✎'}
        </Button>
      )
      const withPencil = (n: NoteEntry, where: string, content: El) =>
        canEdit(n) ? (
          <Box flexDirection="row" justifyContent="space-between" marginTop={1} width="100%">
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              {content}
            </Box>
            {pencil(n, where)}
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {content}
          </Box>
        )
      const ruleForm = (d: NoteEntry): Block[] => {
        if (!ruleSeeds.has(d.name)) ruleSeeds.set(d.name, d.rule)
        const setDraft = (v: string) => fire(update($, ruleEdits, x => ({ ...x, [d.name]: v })))
        const hint = 'Saving replaces the rule in force; agents use only the new wording.'
        return [
          block(
            <Box flexDirection="column" marginTop={1} width="100%">
              <Text dimColor>Rule: one EARS sentence; link terms as [[term]]</Text>
              <Input key={`rule-def-${d.name}`} rows={3} value={ruleSeeds.get(d.name) ?? ''} submitLabel="↵" onInput={setDraft} onSubmit={setDraft} />
            </Box>,
            5,
          ),
          block(
            <Box marginTop={1} gap={2}>
              <Button key={`rule-save-${d.name}`} variant="primary" onPress={() => void saveRule($, d).catch(() => $.ui.toast(`${d.title}: could not save`))}>
                {`Save as v${(Number.parseInt(d.version || '1', 10) || 1) + 1}`}
              </Button>
              <Button key={`rule-cancel-${d.name}`} plain onPress={() => fire(update($, editing, () => ''))}>
                Cancel
              </Button>
            </Box>,
            2,
          ),
          block(<Text dimColor>{hint}</Text>, rowsOf(hint, w)),
        ]
      }
      const editorFor = (n: NoteEntry): Block[] => (n.kind === 'term' ? termForm(n.name, n, w) : ruleForm(n))

      const entry = (n: NoteEntry, where: string) => {
        const used = backlinksOf(n.name, current).map(b => b.title)
        blocks.push(
          block(
            withPencil(
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
            2 + rowsOf(plain(n.summary), w) + (used.length ? 1 : 0),
          ),
        )
        if (isEditing(n)) blocks.push(...editorFor(n))
      }
      const heading = (text: string) => blocks.push(block(<Box marginTop={1}><Text bold>{text}</Text></Box>, 2))
      // A section that starts collapsed; its open state is kept with the Docs sections.
      const foldable = (key: string, title: string, count: string, fill: () => void, forceOpen = false) => {
        const isOpen = forceOpen || docsShown.includes(key)
        blocks.push(
          block(
            <Box marginTop={1} gap={1}>
              <Button
                key={`fold-${key}`}
                plain
                onPress={() => fire(update($, docsOpen, x => (x.includes(key) ? x.filter(k => k !== key) : [...x, key])))}
              >
                {`${isOpen ? '▾' : '▸'} ${title}`}
              </Button>
              <Text dimColor>{count}</Text>
            </Box>,
            2,
          ),
        )
        if (isOpen) fill()
      }

      const note = sel ? findNote(sel, allNotes) : undefined
      if (sel) {
        blocks.push(
          block(
            <Box marginTop={1}>
              <Button key="notes-back" plain onPress={() => choose('')}>
                {`← Back to ${tab}`}
              </Button>
            </Box>,
            2,
          ),
        )
        if (note) {
          const markdownOf = (text: string, key: string, rows: number) =>
            block(
              <Box marginTop={1}>
                <Markdown
                  key={key}
                  text={toMarkdown(text).replace(/\n(?!\n)/g, '  \n') || '_This note is empty._'}
                  onLinkPress={link => {
                    const name = noteFromHref(link.href)
                    if (name) choose(name)
                  }}
                />
              </Box>,
              rows,
            )
          if (note.kind === 'term') {
            blocks.push(
              block(
                withPencil(
                  note,
                  'view',
                  <Box flexDirection="column">
                    <Text bold>{numberOf(note)}  {note.title}</Text>
                    <Text dimColor>term · {note.subtitle} · v{note.version} · {note.file}</Text>
                  </Box>,
                ),
                3,
              ),
            )
            if (isEditing(note)) blocks.push(...termForm(note.name, note, w))
            else blocks.push(markdownOf(note.body, 'note-body', 1 + rowsOf(note.body, w)))
          } else {
            // A decision reads as the rule it put in force; its record is one click away.
            const isOpen = showing === note.name
            blocks.push(
              block(
                withPencil(
                  note,
                  'view',
                  <Box flexDirection="column">
                    <Text dimColor>{note.title}</Text>
                    {md(`note-rule-${note.name}`, note.rule || note.summary, { bold: true })}
                    <Text dimColor>
                      {note.rule ? `rule in force · v${note.version || '1'}` : note.status === 'answered' ? 'answered in words; waiting for a rule' : `${note.status}: not decided yet`}
                      {note.scope ? ` · ${note.scope}` : ''}
                    </Text>
                  </Box>,
                ),
                3 + rowsOf(plain(note.rule || note.summary), w),
              ),
            )
            if (isEditing(note)) blocks.push(...ruleForm(note))
            if (note.supersededBy) {
              const latest = latestOf(note, allNotes)
              blocks.push(
                block(
                  <Box flexDirection="column" marginTop={1}>
                    <Text color="warning">Superseded. Agents no longer use this rule.</Text>
                    <Button key="to-latest" plain onPress={() => choose(latest.name)}>
                      {`Open the current one: ${latest.title}`}
                    </Button>
                  </Box>,
                  3,
                ),
              )
            }
            if (note.status === 'proposed') {
              blocks.push(
                block(
                  <Box marginTop={1}>
                    <Button key={`open-card-${note.name}`} plain onPress={() => fire(update($, activeCard, () => `${note.name}.md`))}>
                      Open its decision card
                    </Button>
                  </Box>,
                  2,
                ),
              )
            } else if (isCurrent(note) && (note.status === 'accepted' || note.status === 'answered')) {
              blocks.push(
                block(
                  <Box flexDirection="column" marginTop={1}>
                    <Button
                      key={`revise-${note.name}`}
                      plain
                      onPress={() => {
                        void reviseDecision($, note).catch(() => $.ui.toast(`${note.title}: could not create the revision`))
                      }}
                    >
                      Revise this rule
                    </Button>
                    <Text dimColor>Opens a new proposed ADR. Once accepted, it replaces this one.</Text>
                  </Box>,
                  3,
                ),
              )
            } else if (note.status === 'deferred') {
              blocks.push(
                block(
                  <Box flexDirection="column" marginTop={1}>
                    <Button
                      key={`reopen-${note.name}`}
                      plain
                      onPress={() => {
                        void setStatus($, `${note.name}.md`, note.title, 'proposed').catch(() => $.ui.toast(`${note.title}: could not reopen`))
                      }}
                    >
                      Reopen this decision
                    </Button>
                    <Text dimColor>Deferred: still undecided. Reopening puts it back in the tabs.</Text>
                  </Box>,
                  3,
                ),
              )
            }
            blocks.push(
              block(
                <Box marginTop={1}>
                  <Button key={`record-${note.name}`} plain onPress={() => fire(update($, showRecord, () => (isOpen ? '' : note.name)))}>
                    {isOpen ? '▾ Hide the decision record' : '▸ Show the decision record'}
                  </Button>
                </Box>,
                2,
              ),
            )
            if (isOpen) {
              blocks.push(
                block(
                  <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>
                      {note.subtitle} · {note.file}
                    </Text>
                  </Box>,
                  2,
                ),
              )
              blocks.push(markdownOf(note.body, 'note-record', 1 + rowsOf(note.body, w)))
            }
          }
          heading(`Links to · ${note.links.length}`)
          if (!note.links.length) blocks.push(block(<Text dimColor>Nothing yet.</Text>, 1))
          for (const l of note.links) {
            const target = findNote(l, allNotes)
            if (target) entry(target, 'to')
            else
              blocks.push(
                block(
                  <Box marginTop={1} gap={1}>
                    <Button key={`to-${l}`} plain onPress={() => choose(l)}>
                      {l}
                    </Button>
                    <Text color="warning">no note yet</Text>
                  </Box>,
                  2,
                ),
              )
          }
        } else if (editingTerm === sel) {
          blocks.push(block(<Box marginTop={1}><Text bold>New term: {sel}</Text></Box>, 2))
          blocks.push(...termForm(sel, undefined, w))
        } else {
          blocks.push(
            block(
              <Box flexDirection="column" marginTop={1}>
                <Text bold>{sel}</Text>
                <Text color="warning">No note by this name yet.</Text>
                <Button key={`define-${sel}`} plain onPress={() => fire(update($, editing, () => sel))}>
                  Define this term
                </Button>
              </Box>,
              4,
            ),
          )
        }
        const backs = backlinksOf(note?.name ?? sel, current)
        heading(`Referenced by · ${backs.length}`)
        if (!backs.length) blocks.push(block(<Text dimColor>Nothing links here yet.</Text>, 1))
        for (const b of backs) entry(b, 'from')
      } else if (tab === 'docs') {
        // Docs: one document, drilled into section by section. A section opens on
        // click; its items render as Markdown, and each links on to its note.
        const inForce = decisions.filter(d => d.status === 'accepted' && d.rule).sort(byNumber)
        const open = decisions.filter(d => d.status === 'proposed' || d.status === 'deferred' || d.status === 'answered').sort(byNumber)
        // Sections: the base prompt's rules and terms, then the project's own, each in number order.
        const groups = [
          { key: 'base', label: 'Base prompt', rules: inForce.filter(isBase), terms: terms.filter(isBase) },
          { key: 'project', label: "This project's", rules: inForce.filter(d => !isBase(d)), terms: terms.filter(t => !isBase(t)) },
        ].filter(g => g.rules.length || g.terms.length)
        const md = (key: string, text: string, rows: number) =>
          block(
            <Box marginTop={1} width="100%">
              <Markdown
                key={key}
                text={toMarkdown(text)}
                onLinkPress={link => {
                  const name = noteFromHref(link.href)
                  if (name) choose(name)
                }}
              />
            </Box>,
            rows,
          )
        const toggle = (key: string) => () =>
          fire(update($, docsOpen, x => (x.includes(key) ? x.filter(k => k !== key) : [...x, key])))
        const section = (key: string, title: string, count: string, fill: () => void) => {
          const isOpen = docsShown.includes(key)
          blocks.push(
            block(
              <Box key={`docs-sec-${key}`} marginTop={1} gap={1}>
                <Button key={`docs-toggle-${key}`} plain onPress={toggle(key)}>
                  {`${isOpen ? '▾' : '▸'} ${title}`}
                </Button>
                <Text dimColor>{count}</Text>
              </Box>,
              2,
            ),
          )
          if (isOpen) fill()
        }

        const intro = `# Docs\n\nHow this system works, from its **${inForce.length} [[rule|rules]] in force** and **${terms.length} defined [[term|terms]]**. Each [[rule]] says who acts, when, and what they shall do. Open a section to read it; follow a link to the note behind any [[rule]] or [[term]].`
        blocks.push(md('docs-body', intro, 4 + rowsOf(intro, w)))
        if (!querySeeds.has('docs')) querySeeds.set('docs', docsQ)
        blocks.push(
          block(
            <Box marginTop={1} width="100%" flexDirection="column">
              <Input
                key="docs-search"
                value={querySeeds.get('docs') ?? ''}
                placeholder="Search the docs"
                submitLabel="↵"
                onInput={v => fire(update($, docsQuery, () => v))}
                onSubmit={v => fire(update($, docsQuery, () => v))}
              />
            </Box>,
            2,
          ),
        )
        const dq = docsQ.trim().toLowerCase()
        if (dq) {
          const ruleHits = inForce.filter(d => plain(d.rule).toLowerCase().includes(dq) || plain(d.summary).toLowerCase().includes(dq))
          const termHits = terms.filter(t => t.title.toLowerCase().includes(dq) || plain(t.summary).toLowerCase().includes(dq))
          heading(`${ruleHits.length + termHits.length} match${ruleHits.length + termHits.length === 1 ? '' : 'es'} for “${docsQ.trim()}”`)
          for (const d of ruleHits) {
            const text = `${d.rule}\n\n*Decided in [[${d.name}|${d.title}]] · ${areaTitle(d.scope || 'general')}*`
            blocks.push(md(`docs-hit-${d.name}`, text, 3 + rowsOf(text, w)))
          }
          for (const t of termHits) {
            const text = `**[[${t.name}]]** *(${t.subtitle})*: ${t.summary}`
            blocks.push(md(`docs-hit-${t.name}`, text, 2 + rowsOf(text, w)))
          }
        } else {
        const allKeys = [...groups.flatMap(g => [`${g.key}:rules-doc`, `${g.key}:glossary`]), 'open']
        blocks.push(
          block(
            <Box marginTop={1} gap={2}>
              <Button key="docs-expand-all" plain onPress={() => fire(update($, docsOpen, () => allKeys))}>
                Expand all
              </Button>
              <Button key="docs-collapse-all" plain onPress={() => fire(update($, docsOpen, () => []))}>
                Collapse all
              </Button>
            </Box>,
            2,
          ),
        )

        let num = 0
        for (const g of groups) {
          if (g.rules.length) {
            const n = ++num
            section(`${g.key}:rules-doc`, `${n}. ${g.label} rules`, `${g.rules.length} rule${g.rules.length === 1 ? '' : 's'}`, () => {
              g.rules.forEach((d, j) => {
                const text = `**${n}.${j + 1}** ${d.rule}\n\n*Why:* ${d.summary} *Decided in [[${d.name}|${d.title}]] · ${areaTitle(d.scope || 'general')}.*`
                blocks.push(
                  block(
                    withPencil(
                      d,
                      'docs',
                      <Box paddingLeft={2} width="100%">
                        <Markdown
                          key={`docs-rule-${d.name}`}
                          text={toMarkdown(text)}
                          onLinkPress={link => {
                            const name = noteFromHref(link.href)
                            if (name) choose(name)
                          }}
                        />
                      </Box>,
                    ),
                    3 + rowsOf(text, w),
                  ),
                )
                if (isEditing(d)) blocks.push(...ruleForm(d))
              })
            })
          }
          if (g.terms.length) {
            const n = ++num
            section(`${g.key}:glossary`, `${n}. ${g.label} glossary`, `${g.terms.length} term${g.terms.length === 1 ? '' : 's'}`, () => {
              for (const t of g.terms) {
                const used = backlinksOf(t.name, current).filter(b => b.kind === 'decision')
                const text = `**[[${t.name}|${t.title}]]** *(${t.subtitle})*: ${t.summary || 'Not defined yet.'}${used.length ? `\n\nUsed in ${used.map(b => `[[${b.name}|${b.title}]]`).join(', ')}.` : ''}`
                blocks.push(
                  block(
                    withPencil(
                      t,
                      'docs',
                      <Box paddingLeft={2} width="100%">
                        <Markdown
                          key={`docs-term-${t.name}`}
                          text={toMarkdown(text)}
                          onLinkPress={link => {
                            const name = noteFromHref(link.href)
                            if (name) choose(name)
                          }}
                        />
                      </Box>,
                    ),
                    3 + rowsOf(text, w),
                  ),
                )
                if (isEditing(t)) blocks.push(...termForm(t.name, t, w))
              }
            })
          }
        }

        if (open.length) {
          section('open', `${num + 1}. Open questions`, `${open.length}`, () => {
            const text = open.map(d => `- [[${d.name}|${d.title}]] *(${d.status})*: ${d.status === 'answered' ? d.outcome : d.summary}`).join('\n')
            blocks.push(md('docs-open', text, 1 + rowsOf(text, w)))
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
          block(
            <Box flexDirection="column" marginTop={1} width="100%">
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
            7,
          ),
        )
        heading(`Glossary · ${shown.length === terms.length ? terms.length : `${shown.length} of ${terms.length}`}`)
        if (!terms.length) blocks.push(block(<Text dimColor>No term notes in {termsDir}/ yet.</Text>, 1))
        else if (!shown.length) blocks.push(block(<Text dimColor>No term matches. Clear the search, the letter or the type.</Text>, 1))
        const dictionary = (list: readonly NoteEntry[]) => {
          let lastLetter = ''
          for (const n of list) {
            const first = n.title.charAt(0).toUpperCase()
            if (first !== lastLetter) {
              blocks.push(block(<Box marginTop={1}><Text bold color="suggestion">{first}</Text></Box>, 2))
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
        // Rules: what is in force, in ADR number order. The project's own rules show
        // first; the base prompt's sit in a folded section. The record stays behind each rule.
        const inForce = decisions.filter(d => d.status === 'accepted' && d.rule).sort(byNumber)
        const words = decisions.filter(d => d.status === 'answered').sort(byNumber)
        const waiting = decisions.filter(d => d.status === 'proposed' || d.status === 'deferred').sort(byNumber)
        const own = inForce.filter(d => !isBase(d))
        const base = inForce.filter(isBase)
        heading(`Rules in force · ${inForce.length}`)
        if (!inForce.length) blocks.push(block(<Text dimColor>No accepted rules yet.</Text>, 1))
        const ruleRow = (d: NoteEntry) => {
            blocks.push(
              block(
                withPencil(
                  d,
                  'rules',
                  <Box flexDirection="column">
                    {md(`rule-${d.name}`, d.rule)}
                    <Box gap={1}>
                      <Button key={`idx-${d.name}`} plain onPress={() => choose(d.name)}>
                        {d.title}
                      </Button>
                      <Text dimColor>{`${d.scope || 'general'} · record and reasoning`}</Text>
                    </Box>
                  </Box>,
                ),
                2 + rowsOf(plain(d.rule), w),
              ),
            )
            if (isEditing(d)) blocks.push(...ruleForm(d))
        }
        if (own.length) {
          heading(`This project's rules · ${own.length}`)
          own.forEach(ruleRow)
        }
        if (base.length) foldable('base:rules', 'Base prompt rules', `${base.length}`, () => base.forEach(ruleRow))
        if (words.length) {
          heading(`Waiting for a rule · ${words.length}`)
          for (const d of words) entry(d, 'idx')
        }
        if (waiting.length) {
          heading(`Waiting on you · ${waiting.length}`)
          for (const d of waiting) entry(d, 'idx')
        }
        if (hidden) blocks.push(block(<Box marginTop={1}><Text dimColor>{hidden} superseded or retired, left out</Text></Box>, 2))
      }
      const setTab = (t: 'rules' | 'terms' | 'docs') => () => {
        fire(update($, noteTab, () => t))
        choose('')
      }
      const header = (
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
      )
      return column('notes', header, blocks, width)
    }

    if (view === 'reference') return notesColumn('100%', bodyCols)
    // ---- the ADR tab strip: left-aligned like browser tabs; when they overflow,
    // the strip starts at the active one and ‹ › step through the rest
    const activeIdx = Math.max(0, tabs.findIndex(t => t.file === focusFile))
    const clip = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s)
    const tabW = Math.max(16, Math.min(32, Math.floor((bodyCols - 4) / Math.max(1, tabs.length)) - 1))
    const fit = Math.max(1, Math.floor((bodyCols - 4) / (tabW + 1)))
    const overflow = tabs.length > fit
    const start = overflow ? Math.min(activeIdx, tabs.length - fit) : 0
    const shown = tabs.slice(start, start + fit)
    const openCard = (file: string) => {
      fire(update($, activeCard, () => file))
    }
    const step = (by: number) => () => {
      const target = tabs[Math.max(0, Math.min(tabs.length - 1, activeIdx + by))]
      if (target) openCard(target.file)
    }
    const tabStrip = (
      <Box key="adr-tabs" flexDirection="row" alignItems="center">
        {shown.map((t, i) => {
          const isActive = t.file === focusFile
          return (
            <Box
              key={`tabbox-${t.file}`}
              width={tabW}
              marginLeft={i === 0 ? 0 : 1}
              borderStyle="round"
              borderColor={isActive ? 'suggestion' : 'subtle'}
              hover={{ borderColor: 'suggestion' }}
            >
              <Button key={`card-tab-${t.file}`} plain onPress={() => openCard(t.file)}>
                {clip(`${t.done ? '✓ ' : ''}${t.id} ${plain(t.decide)}`, tabW - (t.done ? 5 : 2))}
              </Button>
              {t.done ? (
                <Box marginLeft={1}>
                  <Button key={`close-tab-${t.file}`} plain onPress={() => fire(update($, doneTabs, x => x.filter(f => f !== t.file)))}>
                    ×
                  </Button>
                </Box>
              ) : null}
            </Box>
          )
        })}
        {overflow ? (
          <Box marginLeft={1} gap={1}>
            {activeIdx > 0 ? (
              <Button key="tab-prev" plain onPress={step(-1)}>
                ‹
              </Button>
            ) : (
              <Text> </Text>
            )}
            {activeIdx < tabs.length - 1 ? (
              <Button key="tab-next" plain onPress={step(1)}>
                ›
              </Button>
            ) : (
              <Text> </Text>
            )}
          </Box>
        ) : null}
      </Box>
    )
    const strip = view === 'row' ? null : tabStrip

    // A decided card: the same place, now showing what was decided.
    const decidedView = (n: NoteEntry) => {
      const tone = n.status === 'accepted' ? 'success' : n.status === 'deferred' ? 'warning' : 'subtle'
      const statusText =
        n.status === 'accepted'
          ? `✓ ${n.subtitle}`
          : n.status === 'deferred'
            ? 'deferred: still undecided'
            : n.status === 'answered'
              ? 'answered in words; waiting for a rule'
              : n.status === 'superseded'
                ? `superseded by ${n.supersededBy}`
                : n.status
      return (
        <Box key={`done-${n.name}`} flexDirection="column" borderStyle="round" borderColor={tone} paddingX={1}>
          <Box gap={2}>
            {n.scope ? <Text bold>{n.scope}</Text> : null}
            <Text dimColor>{n.title}</Text>
            <Text color={tone}>{statusText}</Text>
          </Box>
          {md(`done-q-${n.name}`, n.summary, { bold: true })}
          {n.rule ? (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>Rule in force</Text>
              {md(`done-r-${n.name}`, n.rule)}
            </Box>
          ) : n.outcome ? (
            <Box marginTop={1}>
              {md(`done-o-${n.name}`, n.outcome)}
            </Box>
          ) : null}
          <Box gap={2} marginTop={1}>
            <Button key={`done-open-${n.name}`} plain onPress={() => choose(n.name)}>
              Open in Reference
            </Button>
            {n.status === 'deferred' ? (
              <Button
                key={`done-reopen-${n.name}`}
                plain
                onPress={() => {
                  void setStatus($, `${n.name}.md`, n.title, 'proposed').catch(() => $.ui.toast(`${n.title}: could not reopen`))
                }}
              >
                Reopen
              </Button>
            ) : null}
          </Box>
        </Box>
      )
    }

    if (!card) {
      if (doneNote) {
        return view === 'row' ? (
          decidedView(doneNote)
        ) : (
          <Box flexDirection="column">
            {tabStrip}
            {decidedView(doneNote)}
          </Box>
        )
      }
      if (view === 'row') return null
      return (
        <Box paddingX={1}>
          <Text dimColor>No decisions are waiting for you.</Text>
        </Box>
      )
    }

    if (card.error) {
      return (
        <Box flexDirection="column">
          {strip}
          <Box flexDirection="column" borderStyle="round" borderColor="error" paddingX={2} paddingY={1}>
            <Text bold>{card.id || card.file}</Text>
            <Text color="error">This card cannot be drawn. {card.error}.</Text>
            <Text dimColor>{joinPath(adrDir, card.file)}</Text>
          </Box>
        </Box>
      )
    }

    const pick = chosen[card.file] ?? card.recommend
    const recommended = card.options.find(o => o.letter === card.recommend)
    const mode = modeOf[card.file] ?? 'form'
    const draft: OtherDraft = typed[card.file] ?? EMPTY_DRAFT
    const pattern = patternOf(draft.pattern)
    const sentence = assemble(draft)
    const unknown = undefinedTerms(sentence, words)
    const missing = missingSlots(draft)
    const isOther = pick === OTHER
    const isFree = pick === FREE
    // Fields are seeded once and then left alone, like plain HTML inputs.
    if (!seeds.has(card.file)) seeds.set(card.file, draft)
    const seed = seeds.get(card.file) ?? draft
    if (!freeSeeds.has(card.file)) freeSeeds.set(card.file, said[card.file] ?? '')
    const freeSeed = freeSeeds.get(card.file) ?? ''
    const setSlot = (slot: keyof OtherDraft, value: string) => {
      void (async () => {
        if (((await read($, drafts))[card.file] ?? EMPTY_DRAFT)[slot] === value) return
        let started = false
        await update($, drafts, d => {
          const nextDraft = { ...(d[card.file] ?? EMPTY_DRAFT), [slot]: value } as OtherDraft
          started = isStarted(nextDraft)
          return { ...d, [card.file]: nextDraft }
        })
        if (started) await update($, picks, p => ({ ...p, [card.file]: OTHER }))
      })()
    }
    const setFree = (value: string) => {
      void (async () => {
        // The field can send its text again when it loses focus; that is not
        // typing, so it must not take the selection back from an option.
        const before = (await read($, freeText))[card.file] ?? ''
        if (value === before) return
        await update($, freeText, f => ({ ...f, [card.file]: value }))
        if (value.trim()) await update($, picks, p => ({ ...p, [card.file]: isEars(value) ? FORMED : FREE }))
      })().catch(() => {})
    }
    const addLink = (term: string) => {
      if (!term) return
      void read($, freeText).then(f => {
        const now = (f[card.file] ?? '').replace(/\s+$/, '')
        const next = `${now}${now ? ' ' : ''}[[${term}]] `
        freeSeeds.set(card.file, next)
        setFree(next)
      })
    }
    const formed = formedAll[card.file]
    const short = (t: string, n = 48) => {
      const p = plain(t).replace(/\s+/g, ' ').trim()
      return p.length > n ? `${p.slice(0, n - 1)}…` : p
    }
    const freeNow = said[card.file] ?? ''
    const isFormed = pick === FORMED
    const pickedRule = card.options.find(o => o.letter === pick)?.rule ?? ''
    const acceptLabel = isFormed
      ? `Accept rule: ${short(freeNow)}`
      : isFree
        ? `Send my words: “${short(freeNow, 40)}”`
        : isOther
          ? `Accept my rule: ${short(sentence)}`
          : pick
            ? `Accept ${pick}: ${short(pickedRule)}`
            : 'Pick an option'

    // ---- column 1: the decision, its words and its options
    const decisionColumn = (width: string, cells: number) => {
      const w = Math.max(10, cells - 4)
      const blocks: Block[] = [
        block(<Box marginTop={1}>{md(`decide-${card.file}`, card.decide, { bold: true })}</Box>, 1 + rowsOf(plain(card.decide), w)),
        block(<Box marginTop={1}>{md(`given-${card.file}`, card.given, { dim: true })}</Box>, 1 + rowsOf(plain(card.given), w)),
      ]
      if (card.terms.length) {
        blocks.push(block(<Box marginTop={1}><Text dimColor>TERMS</Text></Box>, 2))
        for (const t of card.terms) {
          const note = findNote(t.name, allNotes)
          blocks.push(
            block(
              <Box flexDirection="column">
                <Box gap={1}>
                  <Button key={`term-${t.name}`} plain onPress={() => choose(t.name)}>
                    {t.name}
                  </Button>
                  {note ? <Text dimColor>{note.subtitle}</Text> : <Text color="warning">not defined yet</Text>}
                </Box>
                {t.definition ? <Text dimColor>{plain(t.definition)}</Text> : null}
              </Box>,
              1 + (t.definition ? rowsOf(plain(t.definition), w) : 0),
            ),
          )
        }
      }
      blocks.push(block(<Box marginTop={1}><Text dimColor>OPTIONS</Text></Box>, 2))
      for (const o of card.options) {
        const isPicked = pick === o.letter
        blocks.push(
          block(
            <Box
              key={`opt-${o.letter}`}
              flexDirection="column"
              borderStyle="round"
              borderColor={isPicked ? 'suggestion' : 'subtle'}
              hover={{ borderColor: 'suggestion' }}
              paddingX={1}
            >
              <Box gap={2}>
                <Button key={`pick-${card.file}-${o.letter}`} plain onPress={() => update($, picks, p => ({ ...p, [card.file]: o.letter }))}>
                  {`Option ${o.letter}`}
                </Button>
                {card.recommend === o.letter ? <Text color="success">recommended</Text> : null}
                {isPicked ? <Text color="suggestion">selected</Text> : null}
              </Box>
              {/* Buttons draw one line each, so the text is wrapped here and every
                  wrapped line is its own button: nothing is cut off, and each line
                  still selects the option. */}
              {[...wrapWords(plain(o.rule), w - 4), ...(o.consequence ? wrapWords(`→ ${plain(o.consequence)}`, w - 4) : [])].map((line, i) => (
                <Button key={`pickbody-${card.file}-${o.letter}-${i}`} plain onPress={() => update($, picks, p => ({ ...p, [card.file]: o.letter }))}>
                  {line}
                </Button>
              ))}
            </Box>,
            3 + rowsOf(plain(o.rule), w - 4) + (o.consequence ? rowsOf(plain(o.consequence), w - 4) : 0),
          ),
        )
      }
      blocks.push(
        block(
          <Box flexDirection="column" marginTop={1}>
            {recommended && card.recommendReason ? md(`why-${card.file}`, `Why ${recommended.letter}: ${card.recommendReason}`, { dim: true }) : null}
            {card.combines && card.combines.toLowerCase() !== 'exclusive' ? (
              md(`combines-${card.file}`, `Combines: ${card.combines}`, { dim: true })
            ) : (
              <Text dimColor>Pick one, or answer in your own words.</Text>
            )}
          </Box>,
          2 + rowsOf(card.recommendReason, w),
        ),
      )
      return column('decision', <Text dimColor>DECISION</Text>, blocks, width)
    }

    // ---- column 2: the person's own answer, as a built rule or in plain words
    const ruleColumn = (width: string, cells: number) => {
      const w = Math.max(10, cells - 4)
      const blocks: Block[] = []
      const field = (label: string, control: El) =>
        blocks.push(
          block(
            <Box flexDirection="column" marginTop={1} width="100%">
              <Text dimColor>{label}</Text>
              {control}
            </Box>,
            3,
          ),
        )
      if (mode === 'free') {
        const hint = 'Say what you want in your own words, then press Suggest rule below to get it written as a rule. Click the suggestion to use it, or send your words as they are.'
        blocks.push(block(<Box marginTop={1}><Text dimColor>{hint}</Text></Box>, 1 + rowsOf(hint, w)))
        const rows = 10
        blocks.push(
          block(
            <Box marginTop={1} width="100%" flexDirection="column" alignItems="stretch">
              <Input
                key={`free-${card.file}`}
                rows={rows}
                value={freeSeed}
                placeholder="e.g. only run the slow tests before a release"
                submitLabel="↵"
                onInput={setFree}
                onSubmit={text => {
                  setFree(text)
                  requestSuggestion($, card, text)
                }}
              />
            </Box>,
            1 + rows,
          ),
        )
        blocks.push(
          block(
            <Box marginTop={1}>
              <Button
                key={`suggest-${card.file}`}
                onPress={() => {
                  void read($, freeText).then(f => requestSuggestion($, card, f[card.file] ?? ''))
                }}
              >
                Suggest rule
              </Button>
            </Box>,
            2,
          ),
        )
        if (words.length) {
          blocks.push(
            block(
              <Box marginTop={1} flexDirection="column">
                <Text dimColor>Link a term</Text>
                <Select
                  key={`free-link-${card.file}`}
                  value=""
                  options={[{ value: '', label: 'Insert [[term]]…' }, ...words.map(x => ({ value: x, label: x }))]}
                  onSelect={addLink}
                />
              </Box>,
              3,
            ),
          )
        }
        const flagged = formed && !formed.sentence && formed.unclear.length && formed.source === freeNow ? formed.unclear : []
        if (freeNow.trim() && (freeNow.includes('[[') || flagged.length)) {
          const pieces = markUnclear(freeNow, flagged)
          blocks.push(
            block(
              <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={flagged.length ? 'warning' : 'subtle'} paddingX={1}>
                <Text dimColor>{flagged.length ? 'NEEDS MORE DETAIL' : 'READS AS'}</Text>
                {flagged.length ? (
                  <Text>
                    {pieces.map(piece =>
                      piece.why ? (
                        <Text color="warning" underline>
                          {piece.text}
                        </Text>
                      ) : (
                        <Text>{linked(piece.text)}</Text>
                      ),
                    )}
                  </Text>
                ) : (
                  md(`free-preview-${card.file}`, freeNow)
                )}
                {flagged.map(u => (
                  <Text color="warning">
                    “{u.phrase}”: {u.why}
                  </Text>
                ))}
              </Box>,
              3 + rowsOf(plain(freeNow), w - 4) + flagged.length,
            ),
          )
        }
        if (formed?.state === 'working') {
          blocks.push(block(<Box marginTop={1}><Text dimColor>Writing your words as a rule…</Text></Box>, 2))
        } else if (formed?.state === 'none' && !flagged.length && formed.source === freeNow) {
          blocks.push(
            block(
              <Box marginTop={1}>
                <Text dimColor>No rule could be made. Try saying who acts, when, and what it shall do.</Text>
              </Box>,
              2,
            ),
          )
        } else if (formed?.state === 'ready' && isFormed) {
          blocks.push(
            block(
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>Rewritten from your words: “{short(formed.source, 80)}”. They are kept with your answer.</Text>
                <Button key={`undo-${card.file}`} plain onPress={() => void undoRewrite($, card).catch(() => {})}>
                  Undo: put my words back
                </Button>
              </Box>,
              3,
            ),
          )
        }
      } else {
        field(
          'Kind',
          <Select key={`pattern-${card.file}`} value={draft.pattern} options={PATTERNS.map(p => ({ value: p.keyword, label: p.label }))} onSelect={v => setSlot('pattern', v)} />,
        )
        if (pattern.condition) {
          field(
            pattern.condition,
            <Input key={`cond-${card.file}`} value={seed.condition} placeholder="a change is committed" submitLabel="" onInput={v => setSlot('condition', v)} onSubmit={v => setSlot('condition', v)} />,
          )
        }
        field(
          'The… (who acts)',
          words.length ? (
            <Select
              key={`system-${card.file}`}
              value={draft.system}
              options={[{ value: '', label: 'Choose a term' }, ...words.map(x => ({ value: x, label: x }))]}
              onSelect={v => setSlot('system', v)}
            />
          ) : (
            <Input key={`system-${card.file}`} value={seed.system} placeholder="ci" submitLabel="" onInput={v => setSlot('system', v)} onSubmit={v => setSlot('system', v)} />
          ),
        )
        field(
          'Shall… (what it does)',
          <Input key={`resp-${card.file}`} value={seed.response} placeholder="run every [[step]]" submitLabel="" onInput={v => setSlot('response', v)} onSubmit={v => setSlot('response', v)} />,
        )
        const done = isStarted(draft) && !missing.length
        blocks.push(
          block(
            <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={done ? 'success' : 'subtle'} paddingX={1}>
              {md(`sentence-${card.file}`, sentence)}
              {isStarted(draft) && missing.length ? <Text color="warning">Still needed: {missing.join(', ')}</Text> : null}
              {unknown.length ? <Text color="warning">Not defined yet: {unknown.join(', ')}</Text> : null}
            </Box>,
            3 + rowsOf(plain(sentence), w - 4) + (missing.length ? 1 : 0) + (unknown.length ? 1 : 0),
          ),
        )
        blocks.push(block(<Text dimColor>Wrap nouns as [[term]] to link them.</Text>, 1))
      }
      const setMode = (m: 'form' | 'free') => () => {
        fire(update($, modes, x => ({ ...x, [card.file]: m })))
      }
      const header = (
        <Box gap={2}>
          {tabButton(`mode-form-${card.file}`, 'Build a rule', mode === 'form', setMode('form'))}
          {tabButton(`mode-free-${card.file}`, 'Free text', mode === 'free', setMode('free'))}
        </Box>
      )
      return column('rule', header, blocks, width)
    }

    if (!talkSeeds.has(card.file)) talkSeeds.set(card.file, '')
    const talkNow = talkTyped[card.file] ?? ''
    const setTalk = (v: string) => fire(update($, talkText, x => ({ ...x, [card.file]: v })))
    const talkBox = (
      <Box key={`talkbox-${card.file}`} flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1} marginBottom={1} width="100%">
        <Text dimColor>What do you want to know before deciding? The agent answers in the chat and updates this card.</Text>
        <Box marginTop={1} width="100%" flexDirection="column" alignItems="stretch">
          <Input
            key={`talk-text-${card.file}`}
            rows={3}
            value={talkSeeds.get(card.file) ?? ''}
            placeholder="e.g. where is this stored, and what can read it?"
            submitLabel="↵"
            onInput={setTalk}
            onSubmit={v => {
              setTalk(v)
              void talkMore($, card).catch(() => $.ui.toast('Could not send that.'))
            }}
          />
        </Box>
        {words.length ? (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Link a term</Text>
            <Select
              key={`talk-link-${card.file}`}
              value=""
              options={[{ value: '', label: 'Insert [[term]]…' }, ...words.map(x => ({ value: x, label: x }))]}
              onSelect={term => {
                if (!term) return
                void read($, talkText).then(x => {
                  const now = (x[card.file] ?? '').replace(/\s+$/, '')
                  const next = `${now}${now ? ' ' : ''}[[${term}]] `
                  talkSeeds.set(card.file, next)
                  setTalk(next)
                })
              }}
            />
          </Box>
        ) : null}
        {talkNow.includes('[[') ? (
          <Box marginTop={1}>{md(`talk-preview-${card.file}`, talkNow)}</Box>
        ) : null}
        <Box marginTop={1}>
          <Button key={`talk-send-${card.file}`} variant="primary" onPress={() => void talkMore($, card).catch(() => $.ui.toast('Could not send that.'))}>
            Send
          </Button>
        </Box>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {strip}
        <Box gap={2} alignItems="center">
          {card.scope ? <Text bold>{card.scope}</Text> : null}
          <Text dimColor>{card.id}</Text>
          <Text color="warning">● needs your decision</Text>
          <Button
            key={`accept-${card.file}`}
            variant="primary"
            onPress={() => {
              void accept($, card).catch(() => $.ui.toast(`${card.id}: could not write the file`))
            }}
          >
            {acceptLabel}
          </Button>
          <Button
            key={`defer-${card.file}`}
            onPress={() => {
              void setStatus($, card.file, card.id, 'deferred').catch(() => $.ui.toast(`${card.id}: could not write the file`))
            }}
          >
            Defer
          </Button>
          <Button key={`talk-${card.file}`} plain onPress={() => fire(update($, talkOpen, () => (talking === card.file ? '' : card.file)))}>
            {talking === card.file ? 'Close talk' : 'Talk with me more'}
          </Button>
        </Box>
        {talking === card.file ? talkBox : null}
        {card.lint?.length ? (
          <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1} marginBottom={1}>
            <Text color="warning">This question breaks {QUESTION_RULE}. Ask the agent to fix it, or Talk with me more:</Text>
            {(card.lint ?? []).map(problem => (
              <Text color="warning">· {problem}</Text>
            ))}
          </Box>
        ) : null}
        <Box flexDirection={wide ? 'row' : 'column'} gap={gap} width="100%" alignItems="stretch">
          {decisionColumn(wide ? '50%' : '100%', colW)}
          {ruleColumn(wide ? '50%' : '100%', colW)}
        </Box>
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
  const { adrDir, termsDir } = config

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'decisions',
      description: 'Open the Decisions panel: decisions waiting for you, and the reference',
    })
    config.projectRoot = e.cwd
    config.active = inWorkspace(e.cwd, config.workspaceRoot)
    if (!config.active) return next(e)
    const result = await next(e)
    void closeOldPanes($)
    await ensureVault($).catch(() => {})
    void openPanel($).catch(() => {})
    void refresh($).catch(() => {})
    $.clock.every(POLL_MS, () => {
      void refresh($).catch(() => {})
    })
    return result
  })

  on('command.run', { command: 'decisions' }, async $ => {
    await refresh($).catch(() => {})
    await openPanel($)
    const n = (await read($, cards)).length
    return { text: n ? `${n} decision${n > 1 ? 's' : ''} waiting in the Decisions panel.` : 'Decisions panel opened. Nothing is waiting for you.' }
  })

  // Agents ask through decision cards, not the built-in question tool (QUESTION_RULE).
  // If the guard itself fails, the question goes through rather than being lost.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (!config.active) return next(e)
    await ensureVault($)
    const nextId = nextAdrId(await read($, notes))
    return { deny: askInstead(nextId, config.adrDir, config.termsDir) }
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
    if (!problems.length) return next(e)
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

  // The Decisions panel: the card for what is waiting (or just decided) on top,
  // the reference (rules, terms, docs) under it, one scroll for both.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (!config.active) return next(e)
    const pane = e.requestId
    if (pane === PANE) {
      const cardEl = await drawView($, e, 'card')
      const refEl = await drawView($, e, 'reference')
      const { Box: B } = $.ui.resolve(e)
      return (
        <B flexDirection="column">
          {cardEl}
          <B marginTop={1} flexDirection="column">
            {refEl}
          </B>
        </B>
      )
    }
    if (pane === ANSWER || pane === NOTES_PANE || pane === REF_PANE) {
      const { Box: B, Text: T } = $.ui.resolve(e)
      return (
        <B paddingX={1}>
          <T dimColor>This now lives in the Decisions panel. You can close this tab.</T>
        </B>
      )
    }
    return next(e)
  })
}
