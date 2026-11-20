// Checks that make the communication rules land: a reply's shape (ADR-0004)
// and a question's shape (ADR-0001). Each returns the problems found, in
// plain words; none means it passes.


// The two rules these checks enforce, by id in the vault.
export const QUESTION_RULE = 'ADR-0001'
export const REPLY_RULE = 'ADR-0004'

export const REPLY_LABELS = ['Done', 'Open', 'Needs you', 'Check'] as const
export const REPLY_MAX_LINES = 8

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const plainText = (s: string) => s.replace(LINK, (_, n: string, l?: string) => (l ?? n).trim())

// The label a reply line starts with ("Done …", "Done: …", "**Done** …", "| Done | … |"),
// and what follows it.
const split = (line: string): { label?: (typeof REPLY_LABELS)[number]; rest: string } => {
  const bare = line.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '').replace(/\*\*/g, '').trim()
  const m = bare.match(/^(Done|Open|Needs you|Check)\b\s*(?::|\|)?\s*(.*)$/i)
  if (!m?.[1]) return { rest: bare }
  const label = REPLY_LABELS.find(l => l.toLowerCase() === m[1]!.toLowerCase())
  return { label, rest: (m[2] ?? '').replace(/^\|\s*/, '').trim() }
}

// Defined terms the text mentions without a [[link]] (ADR-0003: link every
// instance). Plurals and hyphenated names count; IDs such as ADR-0018 and
// `code` do not.
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const unlinkedTerms = (text: string, names: readonly string[]): string[] => {
  // A [[wiki link]] (notes) and a [markdown link](…) (chat, where wiki links do not render) both count.
  const bare = text
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/`[^`]*`/g, ' ')
  const found: string[] = []
  for (const name of names) {
    const body = name.split('-').map(esc).join('[\\s-]')
    const re = new RegExp(`(^|[^\\w-])${body}(?:s|es)?(?![\\w]|-\\d)`, 'i')
    if (re.test(bare)) found.push(name)
  }
  return found
}
const linkProblem = (missing: readonly string[], inChat = false) =>
  inChat
    ? `unlinked terms: ${missing.join(', ')}; link every instance as a markdown link to its note, such as [${missing[0]}](${TERMS_HREF}/${missing[0]}.md)`
    : `unlinked terms: ${missing.map(n => `[[${n}]]`).join(', ')}; link every instance`
// Where chat links to term notes point: the shared vault's Terms folder.
let TERMS_HREF = 'Terms'
export const setTermsHref = (dir: string) => {
  TERMS_HREF = dir.replace(/\\/g, '/').replace(/\/+$/, '')
}

// What each line may open with, per Templates/Response.md.
const FRAMES: Record<(typeof REPLY_LABELS)[number], { test: (rest: string) => boolean; shape: string }> = {
  Done: { test: r => /^(Added|Changed|Fixed|Removed|Found)\b/.test(r), shape: 'Added | Changed | Fixed | Removed | Found …' },
  Open: { test: r => /\bis (not started|not done|blocked)\b/.test(r), shape: '… is not started | not done | blocked' },
  'Needs you': { test: r => /^(Decide|Approve|Do)\b/.test(r), shape: 'Decide | Approve | Do …' },
  Check: { test: r => /^(Run|Open)\b/.test(r) && r.includes('→'), shape: 'Run | Open … → what you should see' },
}

// A reply to the person, per the template: each line optional; Done and Open
// may repeat, Needs you and Check at most once; in that order; each opening
// with one of its listed words; at most 8 lines in all.
export const checkReply = (text: string, terms: readonly string[] = []): string[] => {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    // table scaffolding is not content: a header of empty cells, or a |---| rule
    .filter(l => l && !/^\|?[\s|:-]*\|[\s|:-]*$/.test(l) && !l.startsWith('```'))
  const problems: string[] = []
  const parts = lines.map(split)
  if (!parts.some(p => p.label)) return ['no labelled lines (Done, Open, Needs you, Check)']
  const unlabelled = parts.filter(p => !p.label).length
  if (unlabelled) problems.push(`${unlabelled} line${unlabelled > 1 ? 's' : ''} without a label`)
  const order = parts.map(p => p.label).filter((l): l is (typeof REPLY_LABELS)[number] => !!l)
  const rank = order.map(l => REPLY_LABELS.indexOf(l))
  if (rank.some((r, k) => k > 0 && r < rank[k - 1]!)) problems.push(`labels out of order (use ${REPLY_LABELS.join(', ')})`)
  for (const once of ['Needs you', 'Check'] as const) {
    if (order.filter(l => l === once).length > 1) problems.push(`${once} appears more than once`)
  }
  for (const p of parts) {
    if (p.label && !FRAMES[p.label].test(p.rest)) problems.push(`${p.label} line must be "${FRAMES[p.label].shape}"`)
  }
  if (lines.length > REPLY_MAX_LINES) problems.push(`${lines.length} lines; the limit is ${REPLY_MAX_LINES}`)
  const missing = unlinkedTerms(text, terms)
  if (missing.length) problems.push(linkProblem(missing, true))
  return [...new Set(problems)]
}

export type AdrShape = {
  given?: string
  decide: string
  options: { letter: string; rule: string; consequence: string }[]
  recommend: string
  names: string[]
  error: string | null
}
export type KnownNote = { name: string; kind: 'term' | 'decision'; subtitle: string }

// A question to the person, as a proposed ADR: the shape ADR-0001 sets, every
// link backed by a note, and the problem it serves named in Given.
export const checkQuestion = (adr: AdrShape, notes: readonly KnownNote[]): string[] => {
  const problems: string[] = []
  if (adr.error) problems.push(adr.error)
  if (adr.decide && !adr.decide.trim().endsWith('?')) problems.push('Decide must be one question ending in "?"')
  for (const o of adr.options) {
    if (!isEars(plainText(o.rule))) problems.push(`Where ${o.letter} is not an EARS rule in the present tense ("When …, <actor> <does> …", no "shall")`)
    if (!o.consequence) problems.push(`Where ${o.letter} has no "→ what happens · what it costs" line`)
  }
  if (!adr.recommend) problems.push('no Recommend line')
  const known = new Set(notes.map(n => n.name.toLowerCase()))
  const undefinedNames = adr.names.filter(n => !known.has(n.toLowerCase()))
  if (undefinedNames.length) problems.push(`no note for ${undefinedNames.map(n => `[[${n}]]`).join(', ')}: define it first`)
  const servesProblems = notes.filter(n => n.kind === 'term' && n.subtitle === 'problem').map(n => n.name.toLowerCase())
  if (servesProblems.length && !adr.names.some(n => servesProblems.includes(n.toLowerCase()))) {
    problems.push(`Given must link the problem it serves (${servesProblems.map(n => `[[${n}]]`).join(', ')})`)
  }
  const prose = [adr.given ?? '', adr.decide, ...adr.options.flatMap(o => [o.rule, o.consequence])].join('\n')
  const unlinked = unlinkedTerms(prose, notes.filter(n => n.kind === 'term').map(n => n.name))
  if (unlinked.length) problems.push(linkProblem(unlinked))
  return problems
}

// An EARS sentence in the present tense: a keyword clause, then the actor and what it does
// ("When writing a reply, the agent uses four labelled lines."). "shall" marks the old,
// future-tense form and is refused.
const EARS = /^(When|While|If|Where)\b[^,]+,\s*\S+.*\s\S+/
// Whether a sentence follows one of the EARS patterns.
export const isEars = (s: string): boolean => {
  const t = s.trim()
  if (/\bshall\b/i.test(t)) return false
  if (/^The\s+\S+.*\s\S+/.test(t)) return true
  return EARS.test(t)
}
