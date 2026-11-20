---
id: Draft-0022
status: superseded
superseded_by: ADR-0001
scope: agents/communication
amends: "[[ADR-0001]]"
---
Given     [[ADR-0001]] and the base prompt require a Combines line, the cheat sheet leaves it out, and the dialog always lets you pick only one option, whatever the line says. A line that changes nothing is [[rules-not-landing]].
Decide    Can you pick more than one option in a [[question]]?

Where A:  When writing a [[question]], the [[agent]] states in a Combines line which options can be picked together, and the dialog lets you pick several when they combine.
          → options that combine can be picked together · the dialog setup changes
Where B:  When writing a [[question]], the [[agent]] makes its options exclusive and leaves out the Combines line, and the dialog lets you pick one.
          → one line fewer, matching what the dialog does now · a choice that combines must be split into separate [[question|questions]]
Combines  exclusive
Recommend A: some choices really do combine, and the line already exists.

Decision  A
