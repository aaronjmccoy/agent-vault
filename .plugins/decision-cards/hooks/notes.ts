// The linked note set: term notes and ADRs, the [[links]] between them, and
// the edits that keep it current (a term rewritten in place, a decision
// superseded by a newer one).

import type { NoteEntry } from '../types'

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
export const stripFrontmatter = (text: string): { meta: Record<string, string>; body: string } => {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const meta: Record<string, string> = {}
  if (lines[0]?.trim() !== '---') return { meta, body: text.trim() }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end < 0) return { meta, body: text.trim() }
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z_]+):\s*(.*?)\s*(#.*)?$/)
    if (m?.[1]) meta[m[1]] = (m[2] ?? '').replace(/^"(.*)"$/, '$1')
  }
  return { meta, body: lines.slice(end + 1).join('\n').trim() }
}

// Sets (or adds) frontmatter keys, keeping every other line as it was.
export const setFrontmatter = (text: string, values: Record<string, string>): string => {
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let end = lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') : -1
  if (end < 0) {
    lines.unshift('---', '---')
    end = 1
  }
  for (const [key, value] of Object.entries(values)) {
    const i = lines.findIndex((l, j) => j > 0 && j < end && new RegExp(`^${key}:`).test(l))
    if (i >= 0) lines[i] = `${key}: ${value}`
    else {
      lines.splice(end, 0, `${key}: ${value}`)
      end += 1
    }
  }
  return lines.join(nl)
}

export const linksOf = (text: string): string[] => [
  ...new Set([...text.matchAll(LINK)].map(m => (m[1] ?? '').trim()).filter(Boolean)),
]

const plainText = (s: string) => s.replace(LINK, (_, n: string, l?: string) => (l ?? n).trim())

export const termNote = (name: string, file: string, text: string): NoteEntry => {
  const { meta, body } = stripFrontmatter(text)
  const def = body.match(/\*\*Definition:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  return {
    name,
    kind: 'term',
    file,
    title: name,
    subtitle: meta.type ?? 'term',
    summary: def,
    body,
    links: linksOf(body),
    status: (meta.status ?? 'approved').toLowerCase(),
    version: meta.version ?? '1',
    supersededBy: '',
    supersedes: '',
    outcome: def,
    scope: '',
    rule: '',
    record: false,
  }
}

// What a decided ADR settled on, in words: the chosen option's rule, the
// person's own rule, or their request still waiting for a rule.
const outcomeOf = (body: string): string => {
  const decision = body.match(/^Decision\s+(\S+)/m)?.[1]
  if (!decision) return ''
  if (decision === 'Other') {
    const own = body.match(/^Other\s+(.+)$/m)?.[1]?.trim()
    return own ?? ''
  }
  const rule = body.match(new RegExp(`^Where\\s+${decision}:\\s*(.+)$`, 'm'))?.[1]?.trim()
  return rule ? `${decision}: ${rule}` : decision
}

// The rule a decided ADR put in force, as one sentence (no option letter).
// A request still waiting for an agent to turn it into a rule is not a rule yet.
export const ruleOf = (body: string): string => {
  const decision = body.match(/^Decision\s+(\S+)/m)?.[1]
  if (!decision) return ''
  if (decision === 'Other') return body.match(/^Other\s+(.+)$/m)?.[1]?.trim() ?? ''
  // ADR-0018: options that combine are decided together, as "A+C"; all their rules hold.
  return decision
    .split('+')
    .map(letter => body.match(new RegExp(`^Where\\s+${letter}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

export const decisionNote = (name: string, file: string, text: string): NoteEntry => {
  const { meta, body } = stripFrontmatter(text)
  const decide = body.match(/^Decide\s+(.+)$/m)?.[1]?.trim() ?? ''
  const decision = body.match(/^Decision\s+(\S+)/m)?.[1]
  const status = (meta.status ?? 'unknown').toLowerCase()
  return {
    name,
    kind: 'decision',
    file,
    title: meta.id || name,
    subtitle: decision ? `${status} (${decision})` : status,
    summary: decide,
    body,
    links: linksOf(body),
    status,
    version: '',
    supersededBy: (meta.superseded_by ?? '').replace(/^\[\[|\]\]$/g, ''),
    supersedes: (meta.supersedes || meta.amends || '').replace(/^"|"$/g, '').replace(/^\[\[|\]\]$/g, ''),
    outcome: outcomeOf(body),
    scope: meta.scope ?? '',
    rule: ruleOf(body),
    // ADR-0014: a rule that only records setup, or leaves the choice to each project,
    // stays in force and in Docs but is kept out of what agents read.
    record: (meta.prompt ?? '').toLowerCase() === 'record',
  }
}

export const findNote = (name: string, notes: readonly NoteEntry[]): NoteEntry | undefined =>
  notes.find(n => n.name.toLowerCase() === name.toLowerCase() || n.title.toLowerCase() === name.toLowerCase())

// Superseded, retired, parked and withdrawn notes are kept but not in force.
export const isCurrent = (n: NoteEntry) => !['superseded', 'retired', 'parked', 'withdrawn'].includes(n.status)
// ADR-0001, ADR-0002, … in number order.
const byNumber = (a: NoteEntry, b: NoteEntry) => a.name.localeCompare(b.name, undefined, { numeric: true })

// ---- edits

export const nextAdrId = (notes: readonly NoteEntry[]): string => {
  const top = notes
    .filter(n => n.kind === 'decision')
    .map(n => Number.parseInt(n.title.replace(/^ADR-/i, ''), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0)
  return `ADR-${String(top + 1).padStart(4, '0')}`
}

export const supersedeText = (text: string, byId: string): string =>
  setFrontmatter(text, { status: 'superseded', superseded_by: byId })

// ---- Docs: rules and terms as one engineering document for human readers

export const areaTitle = (scope: string) =>
  (scope || 'general')
    .split('/')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' › ')

// The working document: what the system does, rule by rule in ADR number order,
// in plain sentences, with every term defined where a reader needs it. Generated from the notes.
export const docsDocument = (notes: readonly NoteEntry[]): string => {
  const byTitle = (a: NoteEntry, b: NoteEntry) => a.title.localeCompare(b.title)
  const terms = notes.filter(n => n.kind === 'term' && isCurrent(n)).sort(byTitle)
  const rules = notes.filter(n => n.kind === 'decision' && isCurrent(n) && n.status === 'accepted' && n.rule).sort(byNumber)
  const open = notes.filter(n => n.kind === 'decision' && (n.status === 'proposed')).sort(byNumber)
  const one = (s: string) => s.replace(/\s+/g, ' ').trim()
  const usedIn = (t: NoteEntry) =>
    notes
      .filter(n => n.kind === 'decision' && isCurrent(n) && n.links.some(l => l.toLowerCase() === t.name.toLowerCase()))
      .sort(byNumber)
      .map(n => `[[${n.name}|${n.title}]]`)

  const out: string[] = [
    '# Docs',
    '',
    `How this system works, written from its ${rules.length} [[rule|rules]] in force and ${terms.length} defined [[term|terms]]. Each [[rule]] says who acts, when, and what they do. Follow a link for a [[term]]'s definition or the [[adr|decision]] behind a [[rule]].`,
    '',
    '## Contents',
    '',
    '1. Rules in force',
    '2. Glossary',
    ...(open.length ? ['3. Open questions'] : []),
    '',
    '## 1. Rules in force',
    '',
  ]
  rules.forEach((r, j) => {
    const record = r.record ? ' · a record, not in the base prompt' : ''
    out.push(`**1.${j + 1}** ${one(r.rule)}`, '')
    out.push(`*Why:* ${one(r.summary)} *Decided in [[${r.name}|${r.title}]] · ${areaTitle(r.scope)}${record}.*`, '')
  })
  out.push('## 2. Glossary', '')
  for (const t of terms) {
    const used = usedIn(t)
    out.push(`**${t.title === t.name ? `[[${t.name}]]` : `[[${t.name}|${t.title}]]`}** *(${t.subtitle})*: ${one(t.summary) || 'not defined yet.'}${used.length ? ` Used in ${used.join(', ')}.` : ''}`, '')
  }
  if (open.length) {
    out.push('## 3. Open questions', '')
    for (const d of open) out.push(`- [[${d.name}|${d.title}]] *(${d.status})*: ${one(d.summary)}`)
    out.push('')
  }
  return out.join('\n')
}

// ---- the vault's Index.md

// The vault's map of content, laid out like the browser: generated, so it never goes stale.
export const vaultIndex = (notes: readonly NoteEntry[]): string => {
  const byTitle = (a: NoteEntry, b: NoteEntry) => a.title.localeCompare(b.title)
  const terms = notes.filter(n => n.kind === 'term' && isCurrent(n)).sort(byTitle)
  const decisions = notes.filter(n => n.kind === 'decision').sort(byTitle)
  const inForce = decisions.filter(n => isCurrent(n) && n.status === 'accepted')
  const waiting = decisions.filter(n => n.status === 'proposed')
  const superseded = decisions.filter(n => n.status === 'superseded')
  const parked = decisions.filter(n => n.status === 'parked')
  const one = (s: string) => s.replace(/\s+/g, ' ').trim()
  // Sections past the decision log appear only when they hold something, so a
  // finished vault reads as finished; each is numbered in the order it appears.
  const extra = [
    { title: 'Waiting on you', items: waiting.map(d => `- [[${d.name}|${d.title}]] *${d.status}*: ${one(d.summary)}`), note: '' },
    { title: 'Superseded', items: superseded.map(d => `- [[${d.name}|${d.title}]] → [[${d.supersededBy}]]`), note: '' },
    { title: 'Parked', items: parked.map(d => `- [[${d.name}|${d.title}]]: ${one(d.summary)}`), note: '> Set aside until a real failure calls for them; not in force.' },
  ]
    .filter(x => x.items.length)
    .map((x, i) => ({ ...x, n: i + 3 }))
  return [
    '---',
    'generated: true',
    '---',
    '# Reference',
    '',
    '> Generated from the notes in this vault. Edit the notes; changes here are overwritten.',
    '',
    `1. [[#1 Glossary|Glossary]] · ${terms.length} [[term|terms]]`,
    `2. [[#2 Decision log|Decision log]] · ${inForce.length} in force`,
    ...extra.map(x => `${x.n}. [[#${x.n} ${x.title}|${x.title}]] · ${x.items.length}`),
    '',
    '## 1 Glossary',
    '',
    ...terms.map((t, i) => `- **1.${i + 1}** [[${t.name}]] *(${t.subtitle}, v${t.version})*: ${one(t.summary)}`),
    '',
    '## 2 Decision log',
    '',
    ...inForce.map((d, i) => `- **2.${i + 1}** [[${d.name}|${d.title}]] *${d.subtitle}*: ${one(d.summary)}`),
    '',
    ...extra.flatMap(x => [`## ${x.n} ${x.title}`, '', ...(x.note ? [x.note, ''] : []), ...x.items, '']),
    '## Templates',
    '',
    '[[Term]] · [[Question (ADR)]] · [[Response]] · [[Spec]]',
    '',
  ].join('\n')
}

// ---- what agents read

// The current reference, for the system prompt: newest values only. Superseded
// decisions and retired terms are left out, so they stop steering the work.
export const currentReference = (notes: readonly NoteEntry[], limit = 6000): string => {
  const terms = notes.filter(n => n.kind === 'term' && isCurrent(n)).sort((a, b) => a.title.localeCompare(b.title))
  const decided = notes
    .filter(n => n.kind === 'decision' && isCurrent(n) && !n.record && n.status === 'accepted')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const pending = notes
    .filter(n => n.kind === 'decision' && (n.status === 'proposed'))
    .map(n => n.title)
  if (!terms.length && !decided.length) return ''
  const out = [
    'Project reference: the current terms and decisions of this project, read from its term notes and ADRs.',
    'These are the only values in force. Where anything earlier in this conversation, or in your memory, disagrees with them, follow these and drop the older value. Superseded decisions and retired terms are left out on purpose: do not rely on them.',
    '',
    'Terms:',
    ...terms.map(t => `- ${t.title} (${t.subtitle}, v${t.version}): ${plainText(t.summary) || 'no definition yet'}`),
    '',
    'Decisions in force:',
    ...decided.map(d => `- ${d.title}: ${plainText(d.summary)} Decided: ${plainText(d.outcome) || d.subtitle}`),
    ...(pending.length ? ['', `Waiting on the person: ${pending.join(', ')}. At the start of your next turn, before other work, ask them again in the dialog; until then, do not act as if they were decided.`] : []),
    '',
    'How to link in chat: [[wiki links]] show as plain text in chat, so in replies link each defined term as a markdown link to its note in the Terms folder, such as [adr](<Terms folder>/adr.md); words with no note stay plain. Keep [[term]] in notes, specs and ADRs.',
    'How to ask the person: never ask in chat. Write a proposed ADR into the Decisions folder with the Write tool, from the Question template: each option one EARS rule in the present tense, every option following the rules in force and differing only in what is being decided. Then call AskUserQuestion with one question per ADR, its header set to the ADR id (such as ADR-0009); the dialog is filled from the file, and a picked option is written back into it. Words typed in Other leave the ADR proposed: read them, revise or talk it through, and ask again.',
  ].join('\n')
  return out.length > limit ? out.slice(0, limit - 40) + '\n… (reference cut to fit)' : out
}

// ---- the base prompt

const vaultOf = (decisionsDir: string) => decisionsDir.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/[^/]+$/, '')

// The guidelines every agent in the workspace starts from, as one plain file that
// any tool can load (CLAUDE.md imports it). Generated from the shared vault only:
// a project's own layer is added on top by the mod, or by that project's own file.
export const basePrompt = (notes: readonly NoteEntry[], decisionsDir: string): string => {
  const byTitle = (a: NoteEntry, b: NoteEntry) => a.title.localeCompare(b.title)
  const one = (s: string) => plainText(s).replace(/\s+/g, ' ').trim()
  const terms = notes.filter(x => x.kind === 'term' && isCurrent(x)).sort(byTitle)
  const rules = notes.filter(x => x.kind === 'decision' && isCurrent(x) && x.status === 'accepted' && x.rule && !x.record).sort(byNumber)
  const pending = notes.filter(x => x.kind === 'decision' && (x.status === 'proposed')).sort(byNumber)
  return [
    '# Base prompt',
    '',
    'Generated from the shared vault. Do not edit it: change a decision instead, and this file follows.',
    'Every agent in this workspace follows it. Where a project keeps a `vault/` folder at its repository\'s root, that project\'s rules and terms are layered on top: a project term wins over a shared term of the same name, and a project decision (numbered with a project prefix, such as SHOP-0001) replaces a shared one only when its amends line names it.',
    'Where anything earlier in a conversation, or in memory, disagrees with this file, follow this file.',
    '',
    '## Rules in force',
    '',
    ...rules.map(r => `- ${r.name}: ${one(r.rule)}`),
    '',
    '## How to write a rule',
    '',
    'A rule is one EARS sentence in the present tense: a keyword clause, then the actor and what it does. Never "shall" or "will".',
    '',
    '| Pattern | Use it for |',
    '| --- | --- |',
    '| When <trigger>, <actor> <responds>. | Something that happens on an event |',
    '| While <state>, <actor> <responds>. | Something that holds while a state lasts |',
    '| If <unwanted condition>, <actor> <responds>. | Handling a failure |',
    '| Where <context or feature>, <actor> <responds>. | Something that applies only in some places |',
    '',
    'Example: "When writing a reply, the agent uses a two-column table of up to four labelled rows (Done, Open, Needs you, Check), each at most two sentences, in at most 8 rows." One actor, one trigger, one response, so whether it was followed shows in what the agent does next.',
    '',
    '## How to link',
    '',
    `Every defined word is a link to its term note, every time it appears, not only the first. In notes, specs and ADRs, write [[term]]. In chat replies, where wiki links show as plain text, write a markdown link to the note, for example [adr](${vaultOf(decisionsDir)}/Terms/adr.md). Link only words that have a note under Terms; others stay plain. Qualify a link with its folder only when two notes share a name.`,
    '',
    '## How to reply',
    '',
    'The whole reply is a two-column markdown table with an empty header: no text before or after it, and never in a code block, so links render. One row per labelled line, in this order, each row at most two sentences and included only when it has something to say, at most 8 rows in all. Start each row with its listed words.',
    '',
    '| | |',
    '| --- | --- |',
    '| **Done** | <Added \\| Changed \\| Fixed \\| Removed \\| Found> <thing> |',
    '| **Open** | <thing> is <not started \\| not done \\| blocked> |',
    '| **Needs you** | <Decide <the question open in the dialog> \\| Approve <action> \\| Do <step>> |',
    '| **Check** | <Run `command` \\| Open <link>> → <what you should see> |',
    '',
    'Done and Open may repeat, one item per row; Needs you and Check appear at most once. Needs you never asks for a decision itself: it asks you to Approve an action or Do a step, or points to a question already open in the dialog. A reply that breaks this shape is held back and recomposed before it is shown; if the second attempt still fails, it is shown with a ⚠ notice, and your next reply begins by recomposing it, then answers the new request (ADR-0011).',
    '',
    '## How to ask',
    '',
    `Never ask in chat (ADR-0007). Ask only if the answer can't be looked up and no sensible default exists, and write a term note first for any new word the question uses. Write a proposed ADR into ${decisionsDir} from the Question template: Given (at most two sentences: why the question came up, and which problem it serves), Decide (one sentence ending in "?" that names what changes for the person, not only the mechanism), two to four Where lines, each an EARS rule in the present tense with "→ what happens · what it costs" under it, Combines (which options can be picked together; "exclusive" if none), and Recommend (your pick and why). Every option follows the rules already in force and differs from the others only in the course of action it suggests. Then call AskUserQuestion with up to four waiting questions, one per ADR, each with its header set to the ADR id, such as ADR-0009. The dialog is filled from the file, and the person's pick is written back into it.`,
    '',
    'Only a picked option decides. If the person types in Other instead, the ADR stays proposed: read what they mean, talk it through or revise the ADR, and ask again. If they say a question is unclear, rewrite it. A question left unanswered stays proposed: ask it again at the start of your next turn, before other work.',
    '',
    '## How to hand off work',
    '',
    'When handing a job to another agent, hand it a contract: a spec from the Spec template, each requirement an EARS rule on a Gherkin Rule line with an ID and 1–3 Scenarios under it. Every test traces to a requirement ID; a bug gets a new requirement first. A spec stays a draft until every selector its scenarios use has a test step; only then is it approved. A spec line uses only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and selectors: pick one from a skill already present, and when none fits, propose a new skill that defines the phrase with its test step; every other noun is a term link. Send the contract alone, with no envelope: every instruction is a requirement in it. Both agents communicate only through the contract and a result for each scenario, with no prose.',
    '',
    '## How to check',
    '',
    'When the person asks for a check ("check your work"), first list what you will test as a compact table and ask them to approve it (Needs you: Approve the test list). Only then does a verifier that did not make the change run the checks and write a verdict: a YAML record saved next to the spec, with a result (pass or fail) for each scenario, evidence for each, and at most five findings. A requirement passes only when all its scenarios pass. Link the verdict in your Check row.',
    '',
    '| ID | Requirement | How it is tested |',
    '| --- | --- | --- |',
    '| REQ-001 | <what must hold> | <the scenario to run, and what shows it passed> |',
    '',
    '## Reading requests',
    '',
    '| The person says | Do this |',
    '| --- | --- |',
    '| "Add X. It is done when …" | The done-when becomes your Check row |',
    '| "Check your work" | List what you will test, get it approved, then check (above) |',
    '| "Make this a rule: …" | Write a proposed ADR with the rule as an option, and ask it |',
    '| "Revise ADR-nnnn so that …" | Write an ADR that amends it, and ask it; never work around a rule quietly. Once it is decided, archive both as ADR-nnnn-vN and rewrite ADR-nnnn with the new rule as a Consequences line |',
    '| "Just this once, …" | Do it without recording anything; the rule stays as it is |',
    '| "Propose a decision on …" | Write a proposed ADR with each option as a rule and its cost, and ask it |',
    '| A long explanation | Write it as a doc or a vault note, since replies stop at 8 rows |',
    '| A vague ask ("clean it up") | Ask what done looks like before starting |',
    ...(pending.length ? ['', `Waiting on the person: ${pending.map(p => p.name).join(', ')}. At the start of your next turn, before other work, ask them again in the dialog; until then, do not act as if they were decided.`] : []),
    '',
    '## Terms',
    '',
    'Each term is listed with its type: actor (someone or something that acts), entity (a thing that exists), action (something done), problem (a recurring trouble this framework fixes), state, event or value.',
    '',
    ...terms.map(t => `- ${t.title} (${t.subtitle}): ${one(t.summary) || 'not defined yet'}`),
    '',
  ].join('\n')
}

// ---- editing from the reference guide

export const TERM_TYPES = ['actor', 'entity', 'state', 'event', 'action', 'value'] as const

// A term rewritten in place: the old definition is gone, the version goes up.
export const updateTermText = (text: string, type: string, definition: string): string => {
  const { meta } = stripFrontmatter(text)
  const version = String((Number.parseInt(meta.version ?? '1', 10) || 1) + 1)
  const withMeta = setFrontmatter(text, { type, version })
  const clean = definition.replace(/\s*\n\s*/g, ' ').trim()
  return /\*\*Definition:\*\*.*/.test(withMeta)
    ? withMeta.replace(/\*\*Definition:\*\*.*/, `**Definition:** ${clean}`)
    : `${withMeta.replace(/\s+$/, '')}\n**Definition:** ${clean}\n`
}

export const newTermText = (name: string, type: string, definition: string, notation: string): string =>
  [
    '---',
    `notation: ${notation}`,
    `type: ${type}`,
    `aliases: []`,
    'version: 1',
    'status: approved',
    '---',
    `**Definition:** ${definition.replace(/\s*\n\s*/g, ' ').trim()}`,
    '',
  ].join('\n')

// A decided ADR with its rule reworded in place: the chosen option's line (or the
// person's own rule) gets the new sentence, and the version goes up. The old
// wording is gone; agents only see the new one.
export const replaceRule = (text: string, rule: string): string => {
  const { meta, body } = stripFrontmatter(text)
  const decision = body.match(/^Decision\s+(\S+)/m)?.[1]
  if (!decision) return text
  const clean = rule.replace(/\s*\n\s*/g, ' ').trim()
  const version = String((Number.parseInt(meta.version ?? '1', 10) || 1) + 1)
  const swapped =
    decision === 'Other'
      ? text.replace(/^Other\s+.+$/m, `Other     ${clean}`)
      : text.replace(new RegExp(`^Where\\s+${decision}:\\s*.+$`, 'm'), `Where ${decision}:  ${clean}`)
  return setFrontmatter(swapped, { version })
}
