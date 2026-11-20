# Base prompt

Generated from the shared vault by the decision-cards mod. Do not edit it: change a decision instead, and this file follows.
Every agent in this workspace follows it. Where a project keeps its own `vault/` folder, that project's rules and terms are layered on top, and its note wins where both define the same name.
Where anything earlier in a conversation, or in memory, disagrees with this file, follow this file.

## Rules in force

- ADR-0001: When an agent asks a person to decide, the agent shall write the question as an adr with status proposed, in the lines Given, Decide, Where (one per option), Combines and Recommend.
- ADR-0002: When a spec is written, the author shall put each EARS requirement in a Gherkin Rule line, with an ID and 1–3 Scenarios under it.
- ADR-0003: When a spec line is written, the author shall use only EARS and Gherkin keywords, the fixed operators (is, equals, above, below, within, contains, not) and selectors, and shall link every other noun as a short term link.
- ADR-0004: When an agent replies to a person, the agent shall use four labelled lines (Done, Open, Needs you, Check), each a link or one short clause, in at most 8 lines.
- ADR-0005: Where a project has its own rules, terms, docs or jobs, the agent shall keep them in a vault folder inside that project's repository, layered over the shared vault, with the project's note winning where both define the same name.
- ADR-0006: The ci shall run a project's tests automatically at the pace that project specifies.
- ADR-0007: Where an agent works in any folder under Documents\Projects, the agent shall load Base.md, through a CLAUDE.md in Documents\Projects, and the decision-cards mod shall run in that session.
- ADR-0008: Where a rule only records setup or leaves the choice to each project, the decision-cards mod shall keep it out of the base prompt and list it in Docs only.
- ADR-0009: Where a term has a note, the decision-cards mod shall put it in the base prompt.
- ADR-0010: When an agent asks a person to decide, the agent shall write the proposed adr and show it as the native question dialog, and the decision-cards mod shall write the answer back into that adr.
- ADR-0011: When a person asks for a check, the agent shall first list the requirements and scenarios it will test as a compact table and confirm them with the person, and the verifier shall then check the job's change against them and write a verdict, with evidence for each result and at most five findings.
- ADR-0012: When an agent hands a job to another agent, the agent shall hand it as a contract, and both agents shall communicate only through that contract and a result for each of its scenarios, with no prose.
- ADR-0013: When an adr that amends another is decided, the agent shall move the amended adr to the Archive, give the decided one its place, and renumber the ADRs in force so they run in order with no gaps, updating every link to them.

## How to reply

Up to four labelled lines, in this order, each included only when it has something to say, at most 8 lines in all:

```
Done       <Added | Changed | Fixed | Removed | Found> <thing>
Open       <thing> is <not started | not done | blocked>
Needs you  <Decide ADR-nnnn | Approve <action> | Do <step>>
Check      <Run `command` | Open <link>> → <what you should see>
```

Done and Open may repeat, one item per line. Link every defined term as [[term]], in replies, notes and specs alike.

## How to ask

Never ask in chat or with a question tool. Write a proposed ADR into C:/Users/Aaron/Documents/Projects/personal/agent-vault/Decisions from the Question template: Given, Decide (one sentence ending in "?"), one Where line per option written as an EARS rule with its consequence, Combines, and Recommend. Then end your turn; the answer comes back as a note.

## Terms

- adr (entity): A short file recording one decision: the question, its options as EARS rules, the choice, and its consequences.
- agent (actor): An AI model doing work in a session: it writes, checks and asks, and the person decides.
- autocommit (action): Committing changes automatically at a pace a project sets.
- ci (actor): The automated checker that runs tests whenever code is committed.
- contract (entity): The spec one agent hands another as the whole of a job: its Gherkin scenarios say what must be done and how it is checked, with no prose beside them.
- cryptic-questions (problem): Agent questions assume jargon and treat the person's words as fixed picks instead of reasoning about them.
- ears (entity): A fixed sentence pattern for a rule: When, While, If or Where, then the system shall do something.
- evidence (entity): The link that backs a result in a verdict: the scenario or test run that showed it.
- finding (entity): One problem a verdict reports, tied to the requirement it breaks and written in the spec's vocabulary.
- gherkin (entity): The Given, When, Then language used for scenarios in a spec.
- hard-to-judge (problem): The person cannot tell quickly whether an agent's output is good.
- job (entity): One piece of work an agent carries from a person's request to a verdict: its spec, its messages, and any adrs it raised.
- link (entity): A reference from text to a term's note, written as term in notes, specs and ADRs, and as a markdown link to the note's file in chat replies, where wiki links show as plain text; every instance of a defined word gets one.
- long-replies (problem): Agent replies run far too long and are tedious to review.
- message (entity): A YAML record one agent writes to hand work to another: who, what job, status, links and needs.
- person (actor): The human the agents work for: the only one who decides, and the reader every reply is written for.
- question (entity): A request from an agent for a person to decide, written as a proposed adr and asked in the client's native question dialog, which records the answer in that adr.
- requirement (entity): One rule in a spec, with an ID such as REQ-003, that its Gherkin scenarios check.
- response (entity): What an agent writes back to a person: up to four labelled lines (Done, Open, Needs you, Check), each included only when it has something to say, in at most 8 lines.
- result (entity): The pass or fail a verdict gives one requirement.
- rule (entity): One sentence a decision put in force, written in EARS; agents follow the newest one.
- rules-not-landing (problem): Instructions get recited back, but their effects never show up in what agents do.
- scenario (entity): One concrete case under a requirement, written in Gherkin as Given, When and Then, and run as a test.
- selector (entity): An approved phrase a spec may use, such as "is assigned 20".
- skill (entity): A packaged procedure an agent loads when it is relevant, which can add its own selectors.
- spec (entity): A short file listing what a change must do: each EARS rule states a requirement, and its Gherkin scenarios are the executable tests that check it, run through step code.
- step (entity): The test code that makes one selector actually run.
- term (entity): A note defining one word of the project vocabulary, which specs and decisions link to.
- test-sprawl (problem): Tests and QA grow far beyond what the work needs.
- verdict (entity): A YAML record giving pass or fail for each requirement, with evidence and up to five findings.
- verifier (actor): The agent that checks a job's change against its spec and writes the verdict; it never wrote the change.
