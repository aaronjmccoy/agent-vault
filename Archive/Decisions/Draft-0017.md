---
id: Draft-0017
status: superseded
scope: agents/communication
superseded_by: ADR-0004
---
Given     Three reviews found [[gherkin|Gherkin]] replies read as prose behind keywords: Given and When end up describing a request and a list of actions, not a state and one event, and nothing in them can be checked. It serves your first problem: replies too long and tedious to review.
Decide    What fixed shape should an [[agent]]'s [[response|reply]] to you take instead?

Where A:  When writing a [[response|reply]], the [[agent]] uses four labelled lines (Done, Open, Needs you, Check), each a link or one short clause, in at most 8 lines.
          → bottom line first, and every line is something you can click or run · a new shape to learn; [[gherkin|Gherkin]] stays only in [[spec|specs]]
Where B:  When writing a [[response|reply]], the [[agent]] keeps [[gherkin|Gherkin]] keywords, with Given as a state, one When, and a Then you can check.
          → one vocabulary everywhere · status replies still don't fit Given and When, as all three reviews found
Where C:  When writing a [[response|reply]], the [[agent]] answers in plain prose of at most 5 sentences, ending with what needs the [[person]].
          → the most natural to read · nothing to check its shape against, so length and drift creep back
Combines  exclusive
Recommend A: it is the shortest shape a script can check, and it puts what needs you on its own line instead of hiding it in caveats.

Decision  A
