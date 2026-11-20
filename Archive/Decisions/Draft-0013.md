---
id: Draft-0013
status: withdrawn
scope: testing
supersedes: ADR-0006
withdrawn_because: the person already said enough about test pacing; ADR-0006 now records their own words
---
Given     Revises [[ADR-0006]]. Your words were "Each project will specify a pace by which to [[autocommit]]." Suggest [[rule]] turned that into tests running at that pace, which may not be what you meant. It serves [[test-sprawl]].
Decide    Should a project's [[autocommit]] pace also decide when its tests run?

Where A:  Where a project sets an [[autocommit]] pace, the [[ci]] shall run the [[test-step|test steps]] of every [[spec]] a commit touches, at each [[autocommit]].
          → tests follow your commits · they run as often as you commit
Where B:  Where a project sets an [[autocommit]] pace, the [[agent]] shall commit at that pace, and the [[ci]] shall run every [[test-step|test step]] before a release.
          → commits stay regular and tests stay out of the way · problems surface only at release
Where C:  When a change is committed, the [[ci]] shall run the [[test-step|test steps]] of every [[spec]] the change touches.
          → tests on every commit, whatever the pace · the pace only sets how often that happens
Combines  B and C combine: touched [[spec|specs]] on every commit, everything before a release.
Recommend A: it is the [[rule]] as recorded, so choosing it confirms what you meant; pick B or C if the pace was only about committing.
