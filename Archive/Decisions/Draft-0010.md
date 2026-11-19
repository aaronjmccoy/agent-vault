---
id: Draft-0010
status: parked
scope: agents/communication
parked_because: scope freeze after the drift review; reopen when a real failure calls for it
---
Given     A [[verdict]] gives pass or fail for each [[requirement]]. Sometimes the [[verifier]] cannot check one at all: its [[step]] is missing or the test environment is down.
Decide    When a [[requirement]] could not be checked, should the [[verdict]] say so, or count it as failed?

Where A:  If a [[requirement]] cannot be checked, then the [[verifier]] shall mark its [[result]] blocked with the reason, and the [[verdict]] shall not pass overall.
          → you can tell "broken" from "not checked yet" · a third [[result]] to read and handle
Where B:  If a [[requirement]] cannot be checked, then the [[verifier]] shall mark its [[result]] fail with the reason.
          → only two [[result|results]] · "not checked" looks the same as "broken", so failures may send work back for nothing
Combines  exclusive
Recommend A: a [[verdict]] that hides "not checked" behind "fail" sends work back for problems that may not exist.
