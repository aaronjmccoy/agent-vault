---
id: {{title}}
status: draft
version: 1
---
```gherkin
Feature: [[feature-term]]

Rule: REQ-001 When <trigger>, <actor> <responds>.
  Scenario: <one concrete case>
    Given [[thing]] is <state>
    When [[actor]] <does something>
    Then [[thing]] equals <value>
```

Each [[rule|Rule]] holds one [[ears|EARS]] [[requirement]], and its 1–3 [[scenario|Scenarios]] are the executable tests for it. Use only [[ears|EARS]] and [[gherkin|Gherkin]] keywords, the fixed operators (is, equals, above, below, within, contains, not) and [[selector|selectors]] from loaded [[skill|skills]]. Everything else is a [[term]] link ([[ADR-0002]], [[ADR-0003]]). Trace every test to a [[requirement]] ID; for a bug, add a [[requirement]] first. Keep status: draft until every [[selector]] has a [[test-step|test step]], then set status: approved.
