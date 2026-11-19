---
id: Draft-0008
status: parked
scope: agents/communication
parked_because: scope freeze after the drift review; reopen when a real failure calls for it
---
Given     [[agent|Agents]] hand work to each other. Handoffs in shared chat lose context, and a [[person]] cannot check them.
Decide    In what form do [[agent|agents]] pass work and [[result|results]] to each other?

Where A:  When an [[agent]] hands work to another [[agent]], the [[agent]] shall write a [[message]] or a [[verdict]] as YAML, validated against its JSON Schema.
          → strictly checkable · a [[person]] reads it through a viewer or as raw data
Where B:  When an [[agent]] hands work to another [[agent]], the [[agent]] shall write Markdown with a few fixed header fields.
          → readable in Obsidian · looser to check
Combines  exclusive
Recommend B: one format would serve both people and [[agent|agents]].

Decision  A
Consequences  You chose strict data over the recommendation. A [[message]] carries schema, id, [[job]], from, to, status, refs, needs and up to 3 notes. A [[verdict]] gives pass or fail per [[requirement]] with an [[evidence]] link, and up to 5 [[finding|findings]] written in [[spec]] vocabulary.
