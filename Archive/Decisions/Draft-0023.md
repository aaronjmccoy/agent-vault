---
id: Draft-0023
status: superseded
superseded_by: ADR-0001
scope: agents/communication
amends: "[[ADR-0001]]"
---
Given     [[ADR-0001]] says an [[agent]] does not ask what it can look up or settle with a sensible default, and defines any new word as a [[term]] before asking, but neither the base prompt nor the cheat sheet says so. [[question|Questions]] about settled facts or unknown words are [[cryptic-questions]].
Decide    When does an [[agent]] put a [[question]] to you at all?

Where A:  When a choice comes up, the [[agent]] asks only if it cannot look the answer up and no sensible default exists, and writes a [[term]] note first for any new word the [[question]] uses.
          → you are asked only what needs you, in words you can look up · the [[agent]] sometimes picks a default you would not have
Where B:  When a choice comes up, the [[agent]] asks whenever the choice affects you, and writes a [[term]] note first for any new word the [[question]] uses.
          → you see every choice that touches you · more [[question|questions]], including easy ones
Combines  exclusive
Recommend A: your attention goes to the choices only you can make.

Decision  A
