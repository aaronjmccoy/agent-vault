---
id: Draft-0026
status: superseded
superseded_by: ADR-0002
scope: agents/specs
amends: "[[ADR-0002]]"
---
Given     Only the [[spec]] note says a [[spec]] cannot be approved while a [[scenario]] has no [[test-step|test step]], and the [[spec]] template's "status: draft" is explained nowhere. Without a stated point of approval, a [[spec]]'s state is [[hard-to-judge]].
Decide    When does a [[spec]] you are shown count as approved?

Where A:  When a [[spec]] is approved, every [[selector]] its [[scenario|scenarios]] use has a [[test-step|test step]], and until then its status is draft.
          → an approved [[spec]] always runs · approval waits on the test code
Where B:  When a [[spec]] is approved, its [[requirement|requirements]] are agreed, and each [[scenario]] whose [[selector|selectors]] have no [[test-step|test step]] yet is marked pending until one is written.
          → you can approve what must hold before the test code exists · pending [[scenario|scenarios]] must be tracked until they run
Combines  exclusive
Recommend A: approval then means the [[spec]] can prove itself.

Decision  A
