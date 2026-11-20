---
id: Draft-0016
status: superseded
superseded_by: ADR-0008
scope: agents/verification
---
Given     A [[verifier]], a [[verdict]], its [[result|results]], [[evidence]] and [[finding|findings]] are defined, but no [[rule]] says when they are used. Today the Check line is the only way you judge work, which leaves [[hard-to-judge]] partly open.
Decide    Must a [[job]]'s change be checked by a [[verifier]] before it reaches you?

Where A:  When a [[job]]'s change is ready, the [[verifier]] shall check it against its [[spec]] and write a [[verdict]], with [[evidence]] for each [[result]] and at most five [[finding|findings]].
          → you judge each [[job]] from a pass or fail list · one more [[agent]] run per [[job]], and each [[job]] needs a [[spec]]
Where B:  When a [[person]] asks for a check, the [[verifier]] shall check the [[job]]'s change against its [[spec]] and write a [[verdict]], with [[evidence]] for each [[result]] and at most five [[finding|findings]].
          → you get a [[verdict]] when the work matters · unchecked work still reaches you by default
Where C:  Where a [[job]] is done, the [[agent]] that did it shall report it in its [[response]] alone.
          → nothing changes, and the [[term|terms]] stay as vocabulary · you keep judging from the Check line
Combines  exclusive
Recommend B: it puts the [[verdict]] to work where it pays off, without a [[spec]] and an extra run for every small change.

Decision  B
