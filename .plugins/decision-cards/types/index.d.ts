export type CardOption = { letter: string; rule: string; consequence: string }
export type CardTerm = { name: string; definition: string | null }
export type Pending = {
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

export type TermEdit = { type: string; definition: string }

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
}

declare module 'claude-code' {
  interface PluginState {
    'decision-cards': {
      pending: Shaped<Pending[]>
      vocab: Shaped<string[]>
      notes: Shaped<NoteEntry[]>
    }
  }
}
