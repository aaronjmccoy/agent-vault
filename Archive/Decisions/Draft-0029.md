---
id: Draft-0029
status: superseded
superseded_by: ADR-0003
scope: agents/vocabulary
amends: "[[ADR-0003]]"
---
Given     [[ADR-0003]] raises a [[term]]'s version when its meaning changes, but the cheat sheet says every [[term]] and [[rule]] version goes up with every edit. Versions that mean different things in different places are [[hard-to-judge]].
Decide    When does the version of a [[term]] you read go up?

Where A:  When a [[term]]'s meaning changes, the author raises its version by one, and a wording fix that keeps the meaning leaves the version as it is.
          → a new version always means a new meaning · small fixes are not counted
Where B:  When a [[term]] note is edited, the author raises its version by one, whether or not the meaning changed.
          → every change is counted · a new version may mean nothing new
Combines  exclusive
Recommend A: [[agent|agents]] only need to notice when a meaning changes.

Decision  B
