---
id: Draft-0020
status: superseded
superseded_by: ADR-0001
scope: agents/communication
amends: "[[ADR-0001]]"
---
Given     [[ADR-0001]] and the template say the Decide line names what changes for the [[person]], but the base prompt and cheat sheet only say "one sentence ending in ?". A Decide line about the mechanism alone leads to [[cryptic-questions]].
Decide    What does the Decide line of each [[question]] you answer say?

Where A:  When writing a [[question]], the [[agent]] writes the Decide line as one sentence ending in "?" that names what changes for the [[person]], not only the mechanism.
          → you see what is at stake for you in the [[question]] itself · harder to phrase for internal decisions
Where B:  When writing a [[question]], the [[agent]] writes the Decide line as one sentence ending in "?" that names the mechanism being decided.
          → precise for technical decisions · you work out for yourself what changes for you
Combines  exclusive
Recommend A: it keeps every [[question]] about you, not about the machinery.

Decision  A
