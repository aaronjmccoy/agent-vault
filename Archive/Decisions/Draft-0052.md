---
id: Draft-0052
status: superseded
superseded_by: ADR-0009
scope: agents/handoff
---
Given     Handoffs written as free prose are [[hard-to-judge]]: neither what was asked nor what came back can be checked. A [[contract]] in [[gherkin|Gherkin]] states both, so each can be checked.
Decide    In what form does an [[agent]] hand a [[job]] to another [[agent]], which decides what you can check of the handoff?

Where A:  When handing a [[job]] to another [[agent]], the [[agent]] hands it as a [[contract]], and both [[agent|agents]] communicate only through that [[contract]] and a [[result]] for each of its [[scenario|scenarios]], with no prose.
          → every handoff states what must be done and how it is checked, and what comes back can be checked against it · each handoff needs a [[spec]], even a small one
Where B:  When handing a [[job]] to another [[agent]], the [[agent]] writes the [[contract]] to the project's Specs folder and hands over its [[link]], and both [[agent|agents]] communicate only through that [[contract]] and a [[result]] for each of its [[scenario|scenarios]], with no prose.
          → the [[contract]] outlives the handoff and can be checked again later · a file to write and keep for every handoff
Combines  exclusive
Recommend A: a [[contract]] fixes what is asked and how it is checked before the work starts.

Decision  A
