---
id: Draft-0038
status: superseded
superseded_by: ADR-0004
scope: agents/communication
amends: "[[ADR-0004]]"
---
Given     [[ADR-0004]] limits each row to "a [[link]] or one short clause", which neither the base prompt nor the cheat sheet repeats, and which replies often exceed. A row that runs long is [[long-replies]] inside the table.
Decide    How much can one row of a [[response|reply]] you read say?

Where A:  When writing a row, the [[agent]] keeps it to one short clause or one [[link]], and moves longer detail to a linked note.
          → rows read at a glance · detail sits one click away
Where B:  When writing a row, the [[agent]] keeps it to at most two sentences, with any longer detail moved to a linked note.
          → a row can carry what changed and why · rows take longer to scan
Combines  exclusive
Recommend B: one clause rarely says enough to judge the work, and two sentences still read quickly.

Decision  B
