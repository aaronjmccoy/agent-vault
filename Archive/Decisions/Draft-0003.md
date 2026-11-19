---
id: Draft-0003
status: superseded
scope: agents/communication
superseded_by: ADR-0004
---
Given     [[agent|Agent]] [[response]]s ran long and were tedious to review. Fixed templates were agreed in conversation but never recorded, so [[agent|agents]] could not see them.
Decide    What shape must an [[agent]]'s [[response|reply]] to a [[person]] take?

Where A:  When an [[agent]] replies to a [[person]], the [[agent]] shall write the [[response]] in [[gherkin|Gherkin]] keywords only: Given, When and Then are required, And and But are optional.
          → short and checkable · a [[response|reply]] with no But has no gaps and nothing waiting on you
Where B:  When an [[agent]] replies to a [[person]], the [[agent]] shall write free prose with a linked details file.
          → flexible · the details file invites length, which is what this [[adr|decision]] exists to stop
Combines  exclusive
Recommend A: it is the shape that was adopted in conversation.

Decision  A
Consequences  But marks anything a reader might wrongly assume from Then. "But [[ADR-n]] is proposed" means a [[adr|decision]] is waiting on the [[person]] and is shown as a [[question|decision card]]. The Details field was dropped.
