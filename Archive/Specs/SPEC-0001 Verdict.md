---
id: SPEC-0001
status: parked
version: 1
scope: agents/communication
---
What a [[verdict]] must say, so a [[person]] can trust it without rereading the change. It refines [[Draft-0008]]. One [[question]] is open: [[Draft-0010]].

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[job]]'s change is ready, the [[verifier]] shall write one [[verdict]] for that [[job]].
  Scenario: One [[verdict]] per check
    Given a [[job]] whose change is ready
    When the [[verifier]] checks it
    Then the number of [[verdict]]s for the [[job]] equals 1

Rule: REQ-002 The [[verdict]] shall give one [[result]] for every [[requirement]] of the [[job]]'s [[spec]].
  Scenario: No [[requirement]] left out
    Given a [[spec]] with 3 [[requirement]]s
    When the [[verdict]] is written
    Then the number of [[result|results]] equals 3

Rule: REQ-003 When a [[result]] is pass, the [[verdict]] shall link its [[evidence]].
  Scenario: A pass shows what proved it
    Given a [[requirement]] whose [[scenario]] passed
    When the [[verdict]] is written
    Then its [[result]] contains a link to that [[scenario]]'s run

Rule: REQ-004 When a [[result]] is fail, the [[verdict]] shall state what was observed, as a Then line in the [[spec]]'s vocabulary.
  Scenario: A fail says what actually happened
    Given a [[requirement]] expecting "Then the total equals 12"
    When the run shows 20
    Then its [[result]] contains "Then the total equals 20"

Rule: REQ-005 The [[verdict]] shall hold at most 5 [[finding]]s, each linked to one [[requirement]].
  Scenario: [[finding|Findings]] stay few and traceable
    Given a check that found 7 problems
    When the [[verdict]] is written
    Then the number of [[finding]]s is within 0 to 5
    And each [[finding]] contains a [[requirement]] ID

Rule: REQ-006 If any [[result]] is fail, then the [[verdict]] shall be fail overall.
  Scenario: One failure fails the whole
    Given [[result|results]] pass, pass and fail
    When the [[verdict]] is written
    Then the overall [[result]] equals fail

Rule: REQ-007 The [[verifier]] shall not change the code it checks.
  Scenario: Checking is read-only
    Given a [[verifier]] checking a change
    When it finds a problem
    Then the change is not edited
    And the problem is a [[finding]]
```

Open: what a [[result]] says when a [[requirement]] cannot be checked at all, see [[Draft-0010]]. REQ-006 changes once that is decided.
