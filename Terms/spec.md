---
notation: t-4h8w
type: entity
aliases: [specification]
version: 2
status: approved
decided_by: "[[ADR-0002]]"
---
**Definition:** A short file listing what a change must do: each [[ears|EARS]] [[rule]] states a [[requirement]], and its [[gherkin|Gherkin]] [[scenario|scenarios]] are the executable tests that check it, run through [[test-step|test step]] code.

[[gherkin|Gherkin]] is not documentation here. A [[scenario]] whose [[selector]]s have no [[test-step|test steps]] cannot run, so it cannot be approved.
