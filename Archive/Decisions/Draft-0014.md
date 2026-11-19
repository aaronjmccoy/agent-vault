---
id: Draft-0014
status: withdrawn
scope: agents/communication
supersedes: ADR-0004
withdrawn_because: verification is kept outside this system by the person's decision
---
Given     Revises [[ADR-0004]]. Your [[response|Response]] template gives each line fixed opening words a checker can hold [[agent|agents]] to. It leaves two gaps: Open cannot say work is unverified, and a [[response|reply]] that only answers a [[question]] has no line. It serves [[long-replies]] and [[hard-to-judge]].
Decide    Should the [[response|Response]] template also cover unverified work and plain answers?

Where A:  When an [[agent]] replies to a [[person]], the [[agent]] shall use the [[response|Response]] template's lines, where Open may also end "is not verified" and an Answer line may carry a direct answer.
          → honest caveats and plain answers both fit · two more things to learn
Where B:  When an [[agent]] replies to a [[person]], the [[agent]] shall use the [[response|Response]] template's lines exactly as written.
          → the template stays as you wrote it · unverified work has to be called "not done", and a plain answer has no line
Combines  exclusive
Recommend A: without "not verified", tested-but-unseen work is reported as unfinished, which misleads you.
