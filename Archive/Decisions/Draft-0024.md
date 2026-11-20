---
id: Draft-0024
status: superseded
superseded_by: ADR-0002
scope: agents/specs
---
Given     Instructions written as intentions get recited back by [[agent|agents]] but never change what they do, which is [[rules-not-landing]]. A [[spec]] needs [[requirement|requirements]] that a test can check.
Decide    How is a [[spec]] written, so that you can see each [[requirement]] pass or fail in a test?

Where A:  When writing a [[spec]], the author puts each [[ears|EARS]] [[requirement]] in a [[gherkin|Gherkin]] Rule line, with an ID and 1–3 [[scenario|Scenarios]] under it.
          → each [[requirement]] sits next to the tests that check it · each [[gherkin|Gherkin]] Rule line carries an [[ears|EARS]] sentence, so the file mixes two notations
Where B:  When writing a [[spec]], the author keeps [[ears|EARS]] [[requirement|requirements]] and [[gherkin|Gherkin]] [[scenario|scenarios]] in separate files, linked by tags.
          → each file stays pure · two files to keep in step for every change
Combines  exclusive
Recommend A: [[requirement]] and test stay together.

Decision  A
Consequences
- When a [[scenario]] runs, [[test-step|test step]] code executes it, so it is a test, not an example.
- When writing a test, the author traces it to a [[requirement]] ID or a bug ID, so tests stay within the [[spec]] ([[test-sprawl]]).
