import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pending, CardOption, CardTerm, NoteEntry } from '../types'
import {
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
import { setTermsHref, checkQuestion, checkReply, QUESTION_RULE, REPLY_RULE } from './lint'

const POLL_MS = 2000

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
// Paths come from env settings where set (AGENT_VAULT, AGENT_WORKSPACES), else from the
// mod's own options. Each workspace folder gets a CLAUDE.md carrying the base prompt.
const config = {
  adrDir: 'decisions',
  termsDir: 'terms',
  indexFile: '',
  docsFile: '',
  baseFile: '',
  claudeFiles: [] as string[],
  projectVault: 'vault',
  projectRoot: '',
  workspaceRoots: [] as string[],
  active: true,
}
const lastClaude = new Map<string, string>()
let lastIndex = ''
let lastDocs = ''
let lastBase = ''
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
  for (const file of shared.length ? config.claudeFiles : []) {
    const text = [
      '# Workspace base prompt',
      '',
      `Every agent working under this folder follows the guidelines below (ADR-0007). This file is generated from the shared vault (${vaultRootOf(config.adrDir)}); change a decision there, not this file.`,
      '',
      basePrompt(shared, config.adrDir).replace(/^# Base prompt\n+/, '').replace(/^## /gm, '### '),
    ].join('\n')
    if (text !== lastClaude.get(file)) {
      let onDisk = ''
      try {
        onDisk = String(await $.fs.read(file))
      } catch {}
      if (onDisk !== text) await $.fs.write(file, text)
      lastClaude.set(file, text)
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

export const register: Register = (on, options) => {
  config.adrDir = String(options.adrDir ?? 'decisions')
  config.termsDir = String(options.termsDir ?? 'terms')
  setTermsHref(config.termsDir)
  config.indexFile = String(options.indexFile ?? '')
  config.docsFile = String(options.docsFile ?? '')
  config.baseFile = String(options.baseFile ?? '')
  config.claudeFiles = String(options.claudeFile ?? '').trim() ? [String(options.claudeFile)] : []
  config.projectVault = String(options.projectVault ?? 'vault')
  config.workspaceRoots = String(options.workspaceRoot ?? '').trim() ? [String(options.workspaceRoot)] : []
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'decisions',
      description: 'Ask the decisions waiting for you in the question dialog',
    })
    config.projectRoot = e.cwd
    // Env settings win over the options: AGENT_VAULT is the vault folder, AGENT_WORKSPACES
    // one or more workspace folders separated by ";".
    const vault = String((await $.env.get('AGENT_VAULT').catch(() => '')) ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (vault) {
      config.adrDir = `${vault}/Decisions`
      config.termsDir = `${vault}/Terms`
      config.indexFile = `${vault}/Index.md`
      config.docsFile = `${vault}/Docs.md`
      config.baseFile = `${vault}/Base.md`
      setTermsHref(config.termsDir)
    }
    const roots = String((await $.env.get('AGENT_WORKSPACES').catch(() => '')) ?? '')
      .split(';')
      .map(s => s.trim().replace(/\\/g, '/').replace(/\/+$/, ''))
      .filter(Boolean)
    if (roots.length) {
      config.workspaceRoots = roots
      config.claudeFiles = roots.map(root => `${root}/CLAUDE.md`)
    }
    config.active = !config.workspaceRoots.length || config.workspaceRoots.some(root => inWorkspace(e.cwd, root))
    if (!config.active) return next(e)
    const result = await next(e)
    await ensureVault($).catch(() => {})
    void refresh($).catch(() => {})
    $.clock.every(POLL_MS, () => {
      void refresh($).catch(() => {})
    })
    return result
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
