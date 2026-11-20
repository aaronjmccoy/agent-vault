# Handoff contracts: what we might be missing

For talking through, not deciding. [[ADR-0012]] (your words: "Agents should hand each other contracts") and [[ADR-0013]] stay proposed until this is settled.

## Where handoffs happen today

An [[agent]] hands work on in three ways:

1. **Subagents** (the Agent tool). The handoff is a prompt, and what comes back is one final report. You never see either one. You only see my summary of the report.
2. **Other sessions** (start a session, or send a message to one). The handoff is a brief, and the reply is a short note. You can open these sessions.
3. **A [[verifier]]** under [[ADR-0011]]. This is also a handoff: the change and its [[spec]] go in, and a [[verdict]] comes out.

None of these have a fixed shape today. That is why a handoff is [[hard-to-judge]], and why a [[message]] was defined.

## Four things "contract" could mean

| Reading | What is fixed in advance | Exists already as |
| --- | --- | --- |
| Input | What is asked: the scope, the files, and what done looks like | Part of [[message]] ("needs") |
| Output | The shape of what comes back | [[verdict]] (pass or fail per [[requirement]]) |
| Both, checked | A [[spec]] goes in, and a [[result]] per [[requirement]] comes out | [[spec]] + [[verdict]] |
| Agreed by you | You approve the contract before the work starts | Nothing yet |

ADR-0013 offered only the first three. The fourth is the one most likely to be missing. Is the contract between two agents, or between you and the work?

## Open points

- **Who signs it?** If only agents do, it helps with auditing. If you approve it, it works like a plan you agree to before any work starts. That costs you a step, but it is the strongest fix for [[hard-to-judge]].
- **Which handoffs count?** Subagents are the most frequent and the least visible. Sessions are fewer and you can already see them. Quick read-only lookups may not need a contract.
- **Does the mod enforce it?** A rule about handoffs only takes effect ([[rules-not-landing]]) if the mod checks Agent tool prompts the way it checks ADR writes. Otherwise agents would recite it and then skip it.
- **What format?** A [[message]] is defined as YAML. A contract could be YAML, which a machine can check, or a short labelled prose block, which you can read. Prose is easier to skim on mobile.
- **What comes back if the contract isn't met?** A [[verdict]] with [[finding|findings]], a retry, or a note to you.

## Recommend for discussion

My guess is that you meant something nearer the last reading: work you can trust because its terms were set before it started. If so, the next step is to decide who approves a contract, before deciding its format.
