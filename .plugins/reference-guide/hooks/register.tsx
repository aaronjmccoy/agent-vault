import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { NoteEntry, TermEdit } from '../types'
import { areaTitle, decisionNote, findNote, isCurrent, newTermText, replaceRule, termNote, TERM_TYPES, updateTermText } from './notes'

// The reference guide: a panel over the agent-vault base system (its rules, terms
// and docs), opened with /ref-guide. It reads the same vault the base prompt is
// generated from, and edits its notes in place. See README.md.

const REF_GUIDE = 'ref-guide'
const POLL_MS = 2000
const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const plain = (text: string): string => text.replace(LINK, (_, name: string, label?: string) => (label ?? name).trim())
const joinPath = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, '')}/${name}`

const EARS = /^(When|While|If|Where|The)\b.+\bshall\b.+/
// Whether a sentence follows one of the EARS patterns.
export const isEars = (s: string): boolean => {
  const t = s.trim()
  if (!EARS.test(t)) return false
  if (/^If\b/.test(t)) return /,\s*then the\b/i.test(t)
  if (/^(When|While|Where)\b/.test(t)) return /,\s*the\b/i.test(t)
  return true
}

// The vault comes from AGENT_VAULT where set, else from the vaultDir option.
// A project's own vault folder (projectVault) is layered over it.
const config = { adrDir: '', termsDir: '', projectVault: 'vault', projectRoot: '' }
const setVault = (dir: string) => {
  const v = dir.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  config.adrDir = v ? `${v}/Decisions` : ''
  config.termsDir = v ? `${v}/Terms` : ''
}

const notes = atom({ plugin: 'reference-guide', key: 'notes' } as const, [] as NoteEntry[], { shape: 'notes-1' })

// A note from the shared vault is part of the base prompt; the rest are the project's own.
const slashed = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
const isBase = (n: NoteEntry): boolean => slashed(n.file).startsWith(`${slashed(n.kind === 'term' ? config.termsDir : config.adrDir)}/`)

const noteCache = new Map<string, { mtimeMs: number; entry: NoteEntry }>()

// Reads every term note and ADR (only the files that changed); the project's note wins.
async function indexNotes($: EngineInterface): Promise<void> {
  const layer = config.projectRoot && config.projectVault ? joinPath(config.projectRoot.replace(/\\/g, '/'), config.projectVault) : ''
  const sharedRoot = config.adrDir.replace(/\/Decisions$/, '').toLowerCase()
  const dirs: [string, 'term' | 'decision'][] = [
    ...(layer && layer.toLowerCase() !== sharedRoot ? ([[`${layer}/Terms`, 'term'], [`${layer}/Decisions`, 'decision']] as [string, 'term' | 'decision'][]) : []),
    [config.termsDir, 'term'],
    [config.adrDir, 'decision'],
  ]
  const found: NoteEntry[] = []
  const named = new Set<string>()
  for (const [dir, kind] of dirs) {
    if (!dir || !(await $.fs.exists(dir))) continue
    for (const f of await $.fs.list(dir)) {
      if (f.kind !== 'file' || !f.name.toLowerCase().endsWith('.md')) continue
      const path = joinPath(dir, f.name)
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
      const id = `${kind}:${hit.entry.name.toLowerCase()}`
      if (named.has(id)) continue
      named.add(id)
      found.push(hit.entry)
    }
  }
  found.sort((x, y) => x.kind.localeCompare(y.kind) || x.title.localeCompare(y.title))
  if (JSON.stringify(found) !== JSON.stringify(await read($, notes))) await update($, notes, () => found)
}

let inFlight: Promise<void> | null = null
async function refresh($: EngineInterface): Promise<void> {
  if (inFlight) return inFlight
  inFlight = indexNotes($)
  try {
    await inFlight
  } finally {
    inFlight = null
  }
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

const noteTab = atom({ plugin: 'reference-guide', key: 'noteTab' } as const, 'rules', { shape: 'notetab-2' })
// The note the guide shows; '' shows the tab's list.
const selected = atom({ plugin: 'reference-guide', key: 'selected' } as const, '', { shape: 'selected-1' })
// The decision whose record (reasoning, options, consequences) is open; '' for none.
const showRecord = atom({ plugin: 'reference-guide', key: 'showRecord' } as const, '', { shape: 'record-1' })
// Sections the person has opened.
const docsOpen = atom({ plugin: 'reference-guide', key: 'docsOpen' } as const, [] as string[], { shape: 'docsopen-1' })
// Glossary controls: the search text, the A–Z letter, the term type ('' = all).
const termQuery = atom({ plugin: 'reference-guide', key: 'termQuery' } as const, '', { shape: 'termquery-1' })
const termLetter = atom({ plugin: 'reference-guide', key: 'termLetter' } as const, '', { shape: 'termletter-1' })
const termType = atom({ plugin: 'reference-guide', key: 'termType' } as const, '', { shape: 'termtype-1' })
const docsQuery = atom({ plugin: 'reference-guide', key: 'docsQuery' } as const, '', { shape: 'docsquery-1' })
// Where the person has been: '' is the list view of the current tab.
const navHistory = atom({ plugin: 'reference-guide', key: 'navHistory' } as const, { stack: [''], at: 0 }, { shape: 'nav-1' })

// Search fields keep their own text; these are what they start with.
const querySeeds = new Map<string, string>()
// In-panel editing: the note whose editor is open ('' for none; rules as rule:<name>), and the drafts.
const editing = atom({ plugin: 'reference-guide', key: 'editing' } as const, '', { shape: 'editing-1' })
const termEdits = atom({ plugin: 'reference-guide', key: 'termEdits' } as const, {}, { shape: 'termedits-1' })
const ruleEdits = atom({ plugin: 'reference-guide', key: 'ruleEdits' } as const, {}, { shape: 'ruleedits-1' })
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
  setVault(String(options.vaultDir ?? ''))
  config.projectVault = String(options.projectVault ?? 'vault')

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ref-guide', description: 'Open the reference guide: rules in force, the glossary and the docs' })
    config.projectRoot = e.cwd
    const fromEnv = String((await $.env.get('AGENT_VAULT').catch(() => '')) ?? '').trim()
    if (fromEnv) setVault(fromEnv)
    const result = await next(e)
    void refresh($).catch(() => {})
    $.clock.every(POLL_MS, () => {
      void refresh($).catch(() => {})
    })
    return result
  })

  on('command.run', { command: 'ref-guide' }, async $ => {
    if (!config.adrDir) return { text: 'Set AGENT_VAULT (or the vaultDir option) to the agent-vault folder first.' }
    await refresh($).catch(() => {})
    const { isPlaced } = await $.ui.open({ id: REF_GUIDE, title: 'Reference guide', columns: 72 })
    return { text: isPlaced ? 'Reference guide opened.' : 'This surface draws no panel. Read Docs.md in the vault instead.' }
  })

  // The panel: Rules, Terms and Docs tabs over the vault, with in-place editing.
  on('ui.render', { component: 'Pane', requestId: REF_GUIDE }, async ($, e) =>
    drawReference($, e, await read($, notes), { termsDir: config.termsDir, isBase }),
  )
}
