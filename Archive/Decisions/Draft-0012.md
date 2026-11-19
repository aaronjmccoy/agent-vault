---
id: Draft-0012
status: withdrawn
scope: agents/vocabulary
supersedes: ADR-0003
withdrawn_because: it re-opened a rule the person had settled: link every instance; the fix is a check, not a looser rule
---
Given     Revises [[ADR-0003]]. Linking every noun proved too strict to follow: the [[verdict]] [[spec]] left about 15 nouns unlinked. A [[rule]] nobody can follow gets recited, not applied, which is [[rules-not-landing]].
Decide    How strictly must [[agent|agents]] link words to [[term]] notes?

Where A:  When an [[agent]] writes a [[spec]], a [[adr|decision]] or a [[response|reply]], the [[agent]] shall link a defined [[term]] where the reader needs its meaning, and shall define any new jargon before using it.
          → a [[rule]] people and [[agent|agents]] can actually follow · which words get linked is a judgement, so a checker only catches undefined jargon
Where B:  When an [[agent]] writes a [[spec]], a [[adr|decision]] or a [[response|reply]], the [[agent]] shall link every noun to a [[term]] note.
          → fully checkable · too strict in practice, so it gets ignored
Combines  exclusive
Recommend A: it keeps the check that matters (no undefined jargon) and drops the one nobody kept; [[spec]] [[scenario|scenarios]] still use only the fixed operator words.
