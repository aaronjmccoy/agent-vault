// The Other form builds a rule in an EARS pattern from its slots, so the
// sentence is in the right shape by construction.

import type { OtherDraft } from '../types'

export type Pattern = {
  keyword: OtherDraft['pattern']
  label: string
  // The prompt for the condition slot; null for the pattern without one.
  condition: string | null
}

export const PATTERNS: readonly Pattern[] = [
  { keyword: 'When', label: 'When: something happens', condition: 'When… (the trigger)' },
  { keyword: 'While', label: 'While: during a state', condition: 'While… (the state)' },
  { keyword: 'If', label: 'If: something goes wrong', condition: 'If… (the unwanted event)' },
  { keyword: 'Where', label: 'Where: a feature is included', condition: 'Where… (the feature)' },
  { keyword: 'The', label: 'Always', condition: null },
]

export const EMPTY_DRAFT: OtherDraft = { pattern: 'When', condition: '', system: '', response: '' }

export const patternOf = (keyword: string): Pattern =>
  PATTERNS.find(p => p.keyword === keyword) ?? PATTERNS[0]!

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const noPeriod = (s: string) => clean(s).replace(/[.\s]+$/, '')
const lowerFirst = (s: string) => s.replace(/^(When|While|If|Where|Then|The|Shall)\s+/i, '')

// The slots still empty, by their prompt, for the form to point at.
export const missingSlots = (d: OtherDraft): string[] => {
  const p = patternOf(d.pattern)
  return [
    p.condition && !clean(d.condition) ? 'condition' : '',
    !clean(d.system) ? 'system' : '',
    !clean(d.response) ? 'response' : '',
  ].filter(Boolean)
}

export const isStarted = (d: OtherDraft | undefined): boolean =>
  !!d && !!(clean(d.condition) || clean(d.system) || clean(d.response))

const asLink = (system: string) => {
  const s = clean(system)
  return s.startsWith('[[') ? s : `[[${s}]]`
}

// The rule as one EARS sentence. Empty slots show as <placeholders>.
export const assemble = (d: OtherDraft): string => {
  const p = patternOf(d.pattern)
  const cond = noPeriod(lowerFirst(d.condition)) || '<condition>'
  const system = clean(d.system) ? asLink(d.system) : '<system>'
  const response = noPeriod(lowerFirst(d.response)) || '<response>'
  switch (p.keyword) {
    case 'The':
      return `The ${system} shall ${response}.`
    case 'If':
      return `If ${cond}, then the ${system} shall ${response}.`
    default:
      return `${p.keyword} ${cond}, the ${system} shall ${response}.`
  }
}

// ---- free text → a suggested rule

const EARS = /^(When|While|If|Where|The)\b.+\bshall\b.+/

// Whether a sentence follows one of the EARS patterns.
export const isEars = (s: string): boolean => {
  const t = s.trim()
  if (!EARS.test(t)) return false
  if (/^If\b/.test(t)) return /,\s*then the\b/i.test(t)
  if (/^(When|While|Where)\b/.test(t)) return /,\s*the\b/i.test(t)
  return true
}

// The request sent to the model: the person's words in; either one EARS rule
// out, or the phrases too vague to make one from.
export const suggestRequest = (words: string, decide: string, vocab: readonly string[]) => ({
  system: [
    "You turn a person's request into one requirement sentence in EARS form, using exactly one of these patterns:",
    ...PATTERNS.map(p => `- ${p.keyword === 'The' ? 'The <system> shall <response>.' : p.keyword === 'If' ? 'If <unwanted event>, then the <system> shall <response>.' : `${p.keyword} <${p.keyword === 'When' ? 'trigger' : p.keyword === 'While' ? 'state' : 'feature is included'}>, the <system> shall <response>.`}`),
    "Keep the person's meaning and add nothing they did not say.",
    vocab.length
      ? `Wrap a noun in [[double brackets]] only when it is one of these defined terms: ${vocab.join(', ')}. Keep any [[link]] the person wrote.`
      : 'Keep any [[link]] the person wrote; add no others.',
    'If the request is too vague to name who acts, when, and what they shall do, do not guess: list the vague phrases instead.',
    'Never change what the person asked for. Do not turn one thing into another (for example, a pace for committing into a schedule for running tests), and do not add a who, when or what they did not say. If a faithful rule would need any of that, set "rule" to null and list the phrase that is missing it.',
    'Reply with JSON only, in this shape:',
    '{"rule": "<the EARS sentence, or null>", "unclear": [{"phrase": "<exact words copied from the request>", "why": "<what is missing, under 12 words>"}]}',
    'Give "unclear" only when "rule" is null. Each phrase must appear in the request exactly as written.',
  ].join('\n'),
  prompt: `The decision being answered: ${decide}\nThe person's words: ${words.trim()}`,
})

export type Unclear = { phrase: string; why: string }

// The model's reply as a rule, or as the request's unclear phrases. Phrases
// that are not really in the person's words are dropped.
export const parseSuggestion = (raw: string, vocab: readonly string[], words: string): { sentence: string; unclear: Unclear[] } => {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  let data: { rule?: unknown; unclear?: unknown } = {}
  try {
    data = JSON.parse(json)
  } catch {
    return { sentence: cleanSuggestion(raw, vocab), unclear: [] }
  }
  const sentence = typeof data.rule === 'string' ? cleanSuggestion(data.rule, vocab) : ''
  const unclear = Array.isArray(data.unclear)
    ? data.unclear
        .map(u => ({ phrase: String((u as Unclear)?.phrase ?? '').trim(), why: String((u as Unclear)?.why ?? '').trim() }))
        .filter(u => u.phrase && words.toLowerCase().includes(u.phrase.toLowerCase()))
    : []
  return { sentence, unclear: sentence ? [] : unclear }
}

// The person's words cut into plain and flagged pieces, in order.
export const markUnclear = (words: string, unclear: readonly Unclear[]): { text: string; why?: string }[] => {
  const parts: { text: string; why?: string }[] = []
  let rest = words
  while (rest) {
    let best: { at: number; u: Unclear } | null = null
    for (const u of unclear) {
      const at = rest.toLowerCase().indexOf(u.phrase.toLowerCase())
      if (at >= 0 && (!best || at < best.at)) best = { at, u }
    }
    if (!best) {
      parts.push({ text: rest })
      break
    }
    if (best.at > 0) parts.push({ text: rest.slice(0, best.at) })
    parts.push({ text: rest.slice(best.at, best.at + best.u.phrase.length), why: best.u.why })
    rest = rest.slice(best.at + best.u.phrase.length)
  }
  return parts
}

// The model's reply as a usable sentence, or '' when it isn't one.
export const cleanSuggestion = (raw: string, vocab: readonly string[]): string => {
  const line = (raw.split('\n').map(l => l.trim()).find(Boolean) ?? '').replace(/^["'“”`]+|["'“”`]+$/g, '').trim()
  if (!isEars(line)) return ''
  const known = new Set(vocab.map(v => v.toLowerCase()))
  // Unwrap any [[link]] the model invented for a word with no term note.
  const linked = line.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (m, name: string, label?: string) =>
    known.has(name.trim().toLowerCase()) ? m : (label ? label.slice(1) : name),
  )
  return /[.!?]$/.test(linked) ? linked : `${linked}.`
}

// [[terms]] in the draft that have no term note.
export const undefinedTerms = (text: string, vocab: readonly string[]): string[] => {
  const known = new Set(vocab.map(v => v.toLowerCase()))
  return [
    ...new Set(
      [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)]
        .map(m => (m[1] ?? '').trim())
        .filter(n => !known.has(n.toLowerCase()) && !/^ADR-\d+$/i.test(n)),
    ),
  ]
}
