---
id: Draft-0019
status: superseded
superseded_by: ADR-0001
scope: agents/communication
amends: "[[ADR-0001]]"
---
Given     The Given line is described three ways: [[ADR-0001]] says only "a Given", the base prompt and cheat sheet say "why it came up and which problem it serves", and the template says "at most two plain sentences". A Given that wanders makes a [[question]] [[hard-to-judge]].
Decide    What does the Given of each [[question]] you answer contain?

Where A:  When writing a [[question]], the [[agent]] writes a Given of at most two sentences that says why the [[question]] came up and names the problem it serves.
          → every Given is short and tied to a named problem · some context has to be left out
Where B:  When writing a [[question]], the [[agent]] writes a Given that says why the [[question]] came up and names the problem it serves, at whatever length it needs.
          → room for full context · Givens grow long and slow to read
Combines  exclusive
Recommend A: it is what the template already asks, and it keeps each [[question]] quick to read.

Decision  A
