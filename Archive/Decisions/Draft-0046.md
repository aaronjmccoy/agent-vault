---
id: Draft-0046
status: superseded
superseded_by: ADR-0007
scope: agents/communication
amends: "[[ADR-0007]]"
---
Given     The base prompt lets one dialog carry up to four [[question|questions]], while [[ADR-0007]] and the cheat sheet describe one [[question]] at a time. Several unrelated [[question|questions]] in one dialog can make each [[hard-to-judge]].
Decide    How many [[question|questions]] do you answer in one dialog?

Where A:  When asking a [[person]] to decide, the [[agent]] puts up to four waiting [[question|questions]] in one dialog, one per [[adr]].
          → related choices are answered together, in one sitting · each [[question]] gets less of your attention
Where B:  When asking a [[person]] to decide, the [[agent]] puts one [[question]] in each dialog.
          → each choice gets your full attention · several choices mean several dialogs in a row
Combines  exclusive
Recommend A: batching keeps a run of small choices quick, and you can still answer each on its own.

Decision  A
