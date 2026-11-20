---
id: Draft-0001
status: withdrawn
scope: testing
withdrawn_because: the person found it redundant; a spec's scenarios already run through step code, so a selector with no step fails its run
---
Given     [[spec|Specs]] run through a [[gherkin|Gherkin]] runner. Each [[selector]] in a [[spec]] needs a [[test-step|test step]] to be testable.
Decide    Can a [[spec]] be approved while one of its [[selector|selectors]] has no [[test-step|test step]]?

Where A:  When a [[spec]] is approved, the linter shall reject it if any [[selector]] has no [[test-step|test step]].
          → every approved [[spec]] runs · can't approve before tests exist
Where B:  When a [[spec]] is approved, the linter shall warn if any [[selector]] has no [[test-step|test step]].
          → approve early · [[spec|specs]] and tests can drift apart
Combines  exclusive
Recommend A: keeps tests from outgrowing [[spec|specs]].

Decision  A
Consequences  Every [[selector]] gets a [[test-step|test step]] written before its [[spec]] is approved. When [[test-step|test steps]] run is a separate [[adr|decision]]: [[ADR-0012]].
