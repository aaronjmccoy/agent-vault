---
id: Draft-0051
status: superseded
superseded_by: ADR-0008
scope: agents/verification
amends: "[[ADR-0008]]"
---
Given     The [[result]] note gives one [[result]] per [[requirement]], while [[ADR-0009]] asks for a [[result]] for each [[scenario]]. Two meanings of one word make a [[verdict]] [[hard-to-judge]].
Decide    What does each pass or fail you read in a [[verdict]] belong to?

Where A:  When a [[verdict]] is written, each [[scenario]] gets a [[result]], and a [[requirement]] passes only when all its [[scenario|scenarios]] pass.
          → you see exactly which case failed · a [[verdict]] has more lines to read
Where B:  When a [[verdict]] is written, each [[requirement]] gets one [[result]], and a failing [[scenario]] is named in its [[evidence]].
          → one line per [[requirement]] · the failing case is one step further away
Combines  exclusive
Recommend A: a failure is fixed case by case, so the [[result]] should point at the case.

Decision  A
