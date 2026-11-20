---
id: Draft-0030
status: superseded
superseded_by: ADR-0003
scope: agents/specs
amends: "[[ADR-0003]]"
---
Given     A [[spec]] line may only use [[selector|selectors]], fixed phrases that test code knows how to run, but no file says where an [[agent]] finds them. Without a source, nobody can tell whether a [[spec]] line will run, which is [[hard-to-judge]].
Decide    Where does an [[agent]] find the phrases a [[spec]] you read may use?

Where A:  When writing a [[spec]] line, the author picks a [[selector]] from a [[skill]] already present, and when none fits, proposes a new [[skill]] that defines the phrase with its [[test-step|test step]].
          → every phrase comes with the code that runs it, and new ones arrive as reviewable [[skill|skills]] · a missing phrase waits on a new [[skill]]
Where B:  When writing a [[spec]] line, the author picks a [[selector]] from a [[skill]] already present, and when none fits, adds the phrase with its [[test-step|test step]] to the closest [[skill]] already present.
          → no new [[skill]] for each missing phrase · [[skill|skills]] slowly fill with phrases outside their purpose
Combines  exclusive
Recommend A: it is what you described, and each [[skill]] stays about one thing.

Decision  A
