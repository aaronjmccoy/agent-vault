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
  // Kept out of the base prompt: it records setup or leaves the choice to each project.
  record: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'reference-guide': {
      notes: Shaped<NoteEntry[]>
      noteTab: Shaped<'rules' | 'terms' | 'docs'>
      selected: Shaped<string>
      showRecord: Shaped<string>
      docsOpen: Shaped<string[]>
      termQuery: Shaped<string>
      termLetter: Shaped<string>
      termType: Shaped<string>
      docsQuery: Shaped<string>
      navHistory: Shaped<{ stack: string[]; at: number }>
      editing: Shaped<string>
      termEdits: Shaped<Record<string, TermEdit>>
      ruleEdits: Shaped<Record<string, string>>
    }
  }
}
