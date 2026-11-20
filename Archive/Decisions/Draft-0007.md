---
id: Draft-0007
status: parked
scope: agents/specs
parked_because: scope freeze after the drift review; reopen when a real failure calls for it
---
Given     [[spec|Spec]] lines need actions beyond the fixed operators, such as "is assigned 20". Each context needs a different set of these.
Decide    Where do the action phrases a [[spec]] may use come from?

Where A:  When a [[skill]] is loaded, the [[skill]] shall add its own [[selector]]s, each with a phrase, typed slots and a [[test-step|test step]].
          → the vocabulary grows by context · a phrase only exists where something can run it
Where B:  When a [[spec]] is written, the author shall pick phrases from one global list.
          → one place to look · the list grows without bound and mixes unrelated contexts
Combines  exclusive
Recommend A: phrases travel with the [[skill]] that gives them meaning.

Decision  A
Consequences  A core set (the fixed operators) is always loaded. The linter flags a phrase defined by two [[skill|skills]], and a [[selector]] with no [[test-step|test step]] ([[Draft-0001]]).
