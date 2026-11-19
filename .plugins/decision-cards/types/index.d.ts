export type CardOption = { letter: string; rule: string; consequence: string }
export type CardTerm = { name: string; definition: string | null }
export type Card = {
  file: string
  id: string
  scope: string
  given: string
  decide: string
  options: CardOption[]
  combines: string
  recommend: string
  recommendReason: string
  terms: CardTerm[]
  error: string | null
  // What breaks the question rule (ADR-0010); empty when it passes.
  lint: string[]
}

export type OtherDraft = {
  pattern: 'When' | 'While' | 'If' | 'Where' | 'The'
  condition: string
  system: string
  response: string
}

export type NoteEntry = {
  name: string
  kind: 'term' | 'decision'
  file: string
  title: string
  subtitle: string
  summary: string
  body: string
  links: string[]
  status: string
  version: string
  supersededBy: string
  supersedes: string
  outcome: string
  // The area an ADR belongs to (its scope), and the rule it put in force.
  scope: string
  rule: string
  // Kept out of the base prompt: it records setup or leaves the choice to each project.
  record: boolean
}

export type TermEdit = { type: string; definition: string }

// A rule suggested from the person's free text: the words it came from, and the sentence.
export type Suggestion = {
  source: string
  sentence: string
  state: 'working' | 'ready' | 'none'
  unclear: { phrase: string; why: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    'decision-cards': {
      cards: Shaped<Card[]>
      picks: Shaped<Record<string, string>>
      drafts: Shaped<Record<string, OtherDraft>>
      vocab: Shaped<string[]>
      notes: Shaped<NoteEntry[]>
      selected: Shaped<string>
      freeText: Shaped<Record<string, string>>
      activeCard: Shaped<string>
      modes: Shaped<Record<string, 'form' | 'free'>>
      noteTab: Shaped<'rules' | 'terms' | 'docs'>
      showRecord: Shaped<string>
      editing: Shaped<string>
      termEdits: Shaped<Record<string, TermEdit>>
      suggestions: Shaped<Record<string, Suggestion>>
      ruleEdits: Shaped<Record<string, string>>
      docsOpen: Shaped<string[]>
      talkOpen: Shaped<string>
      talkText: Shaped<Record<string, string>>
      doneTabs: Shaped<string[]>
      termQuery: Shaped<string>
      termLetter: Shaped<string>
      termType: Shaped<string>
      docsQuery: Shaped<string>
      navHistory: Shaped<{ stack: string[]; at: number }>
    }
  }
}
