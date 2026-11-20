---
id: Draft-0034
status: superseded
superseded_by: ADR-0004
scope: agents/communication
amends: "[[ADR-0004]]"
---
Given     The base prompt, the [[response|reply]] template and the reply check fix each row's opening words (Done: Added…, Open: … is not done, Check: Run … →), but [[ADR-0004]] and the cheat sheet never say so. Rows that open any way at all are [[hard-to-judge]] at a glance.
Decide    How does each row of a [[response|reply]] you read begin?

Where A:  When writing a [[response|reply]], the [[agent]] opens each row with its fixed words: Done with Added, Changed, Fixed, Removed or Found; Open with "… is not started, not done or blocked"; Needs you with Decide, Approve or Do; and Check with Run or Open, then "→ what you should see".
          → every row reads the same way, and the check can test it · some things take rephrasing to fit
Where B:  When writing a [[response|reply]], the [[agent]] writes each row under its label in its own words, as long as the row says what changed, what is left, what waits on you, or how to check.
          → rows read naturally · the check can only test the labels
Combines  exclusive
Recommend A: fixed openings make a [[response|reply]] scannable and checkable.

Decision  A
