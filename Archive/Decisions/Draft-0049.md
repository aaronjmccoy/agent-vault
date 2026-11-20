---
id: Draft-0049
status: superseded
superseded_by: ADR-0008
scope: agents/verification
amends: "[[ADR-0008]]"
---
Given     [[ADR-0008]] says the test list is confirmed with you, the base prompt says through a Needs you row asking you to Approve it, and the cheat sheet does not say how. A confirmation with no stated form is [[hard-to-judge]].
Decide    How do you confirm the list of what a check will test?

Where A:  When a [[person]] asks for a check, the [[agent]] shows the test list in its [[response|reply]] and asks you to Approve it in the Needs you row, then checks once you approve.
          → quick, in the flow of the conversation · the approval is not recorded in a file
Where B:  When a [[person]] asks for a check, the [[agent]] writes the test list as a proposed [[adr]] and asks you to approve it in the dialog, then checks once you pick it.
          → the agreed list is recorded and works on mobile · every check needs a file and a dialog
Combines  exclusive
Recommend A: a test list is an approval, not a [[rule]], so the Needs you row fits it.

Decision  A
