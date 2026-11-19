---
id: Draft-0009
status: parked
scope: agents/process
parked_because: scope freeze after the drift review; reopen when a real failure calls for it
---
Given     A [[job]] leaves a trail across its [[spec]], [[message]]s, [[verdict]] and [[adr]]s, and nothing ties it together. Where the [[job]] note lives decides who can read it: this machine only, or everyone with the project's code.
Decide    Where should each [[job]]'s tracking page live, given who needs to read it?

Where A:  When an [[agent]] starts a [[job]], the [[agent]] shall create its [[job]] note in the shared vault's [[job|Jobs]] folder, linking its request, [[spec]], [[message]]s, [[verdict]] and [[adr]]s, and shall update its status as the work moves.
          → you browse every [[job]] beside the [[rule|rules]] and [[term|terms]], from any project · only this machine can read it, unless you sync the vault
Where B:  When an [[agent]] starts a [[job]], the [[agent]] shall create its [[job]] note in the project's own repository, linking the same things, and shall update its status as the work moves.
          → it travels with the code to collaborators, cloud sessions and pull requests · it sits outside the vault, so it drops out of your links and Docs
Where C:  When an [[agent]] starts a [[job]], the [[agent]] shall record it only in git commits and branch names.
          → nothing extra to write · no page to open or link, and nothing outside git can read it
Combines  exclusive
Recommend A: while you work alone on this machine, the vault keeps every [[job]] one click from the [[rule|rules]] it follows. Revise to B when others need to read [[job]] progress.
