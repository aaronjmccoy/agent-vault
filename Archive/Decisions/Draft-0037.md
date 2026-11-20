---
id: Draft-0037
status: superseded
superseded_by: ADR-0004
scope: agents/communication
amends: "[[ADR-0004]]"
---
Given     The reply check flags any line outside the table, but [[ADR-0004]], the base prompt and the cheat sheet never say a [[response|reply]] is only the table. Text around the table brings back [[long-replies]].
Decide    Can a [[response|reply]] you read hold anything outside its table?

Where A:  When writing a [[response|reply]], the [[agent]] puts everything in the table, with no text before or after it.
          → every [[response|reply]] is the same short shape · a needed explanation goes in a row or a linked note
Where B:  When writing a [[response|reply]], the [[agent]] may put one sentence above the table to answer a direct [[question]] you asked.
          → a direct answer comes first, in plain words · replies vary in shape, and the sentence can grow
Combines  exclusive
Recommend A: one shape every time is what keeps replies quick to read.

Decision  A
