---
id: Draft-0031
status: superseded
superseded_by: ADR-0003
scope: agents/vocabulary
amends: "[[ADR-0003]]"
---
Given     [[ADR-0003]] requires a [[link]] only for nouns in [[spec]] lines, while the base prompt, cheat sheet and the [[link]] note require one on every instance of a defined word in notes, [[adr|ADRs]] and replies. A word you cannot trace to its meaning makes text [[hard-to-judge]].
Decide    Which defined words in what you read carry a [[link]] to their notes?

Where A:  When writing a note, [[spec]], [[adr]] or [[response|reply]], the author gives every instance of a defined word a [[link]] to its [[term]] note.
          → you can check any word wherever you read it · dense text carries many [[link|links]]
Where B:  When writing a note, [[spec]], [[adr]] or [[response|reply]], the author gives the first instance of a defined word in each paragraph a [[link]] to its [[term]] note.
          → lighter text, with a [[link]] in reach in every paragraph · a word met later in a paragraph has no [[link]] beside it
Combines  exclusive
Recommend A: it is what the checks already enforce, and it never leaves a word unexplained.

Decision  A
