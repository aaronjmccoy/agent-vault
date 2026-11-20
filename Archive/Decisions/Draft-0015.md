---
id: Draft-0015
status: withdrawn
scope: agents/process
amends: "[[ADR-0014]]"
---
Given     An [[agent]] asked "when do my tests run?" reads Base.md, finds [[rule|rules]] only up to [[ADR-0011]], and may answer that no [[rule]] covers it, though [[ADR-0012]] does. An [[agent]] that answers as if a decided [[rule]] were missing is [[rules-not-landing]].
Decide    When you ask an [[agent]] about test pace or workspaces, does Base.md point it to [[ADR-0012]] and [[ADR-0013]]?

Where A:  Where the base prompt lists the [[rule|rules]] in force, it ends with one line: "Also in force, as records in Docs.md: [[ADR-0012]] (test pace), [[ADR-0013]] (workspaces), [[ADR-0014]] (records)."
          → the [[agent]] finds the right [[rule]] when you ask · one line added to every base prompt
Where B:  Where the base prompt lists the [[rule|rules]] in force, it leaves records out entirely, and an [[agent]] finds them only by reading the vault.
          → the base prompt stays as short as [[ADR-0014]] intended · the [[agent]] may tell you no [[rule]] covers test pace
Combines  exclusive
Recommend A: one line costs little against an [[agent]] answering wrongly about a decided [[rule]].
