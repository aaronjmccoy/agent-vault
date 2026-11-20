---
generated: true
---
# Reference

> Generated from the notes in this vault. Edit the notes; changes here are overwritten.

1. [[#1 Glossary|Glossary]] · 31 [[term|terms]]
2. [[#2 Decision log|Decision log]] · 14 in force

## 1 Glossary

- **1.1** [[adr]] *(entity, v2)*: A short file recording one decision: the [[question]], its options as [[ears|EARS]] [[rule|rules]], the choice, and its consequences.
- **1.2** [[agent]] *(actor, v2)*: An AI model doing work in a session: it writes, checks and asks, and the [[person]] decides.
- **1.3** [[autocommit]] *(action, v2)*: Committing changes automatically at a pace a project sets.
- **1.4** [[ci]] *(actor, v2)*: The automated checker that runs tests whenever code is committed.
- **1.5** [[contract]] *(entity, v1)*: The [[spec]] one [[agent]] hands another as the whole of a [[job]]: its [[gherkin|Gherkin]] [[scenario|scenarios]] say what must be done and how it is checked, with no prose beside them.
- **1.6** [[cryptic-questions]] *(problem, v2)*: [[agent|Agent]] [[question|questions]] assume jargon and treat the [[person]]'s words as fixed picks instead of reasoning about them.
- **1.7** [[ears]] *(entity, v4)*: A fixed sentence pattern for a [[rule]], in the present tense: When, While, If or Where something holds, an actor does something, as in "When writing a reply, the agent uses a two-column table of labelled rows."
- **1.8** [[evidence]] *(entity, v2)*: The link that backs a [[result]] in a [[verdict]]: the [[scenario]] or test run that showed it.
- **1.9** [[finding]] *(entity, v2)*: One problem a [[verdict]] reports, tied to the [[requirement]] it breaks and written in the [[spec]]'s vocabulary.
- **1.10** [[gherkin]] *(entity, v4)*: The Given, When, Then language used for [[scenario|scenarios]] in a [[spec]].
- **1.11** [[hard-to-judge]] *(problem, v2)*: The [[person]] cannot tell quickly whether an [[agent]]'s output is good.
- **1.12** [[job]] *(entity, v2)*: One piece of work an [[agent]] carries from a [[person]]'s request to a [[verdict]]: its [[spec]], its [[message]]s, and any [[adr]]s it raised.
- **1.13** [[link]] *(entity, v1)*: A reference from text to a [[term]]'s note, written as [[term]] in notes, [[spec|specs]] and [[adr|ADRs]], and as a markdown link to the note's file in chat replies, where wiki links show as plain text; every instance of a defined word gets one.
- **1.14** [[long-replies]] *(problem, v2)*: [[agent|Agent]] replies run far too long and are tedious to review.
- **1.15** [[message]] *(entity, v2)*: A YAML record one [[agent]] writes to hand work to another: who, what [[job]], status, links and needs.
- **1.16** [[person]] *(actor, v2)*: The human the [[agent|agents]] work for: the only one who decides, and the reader every [[response|reply]] is written for.
- **1.17** [[question]] *(entity, v2)*: A request from an [[agent]] for a [[person]] to decide, written as a proposed [[adr]] and asked in the client's native question dialog, which records the answer in that [[adr]].
- **1.18** [[requirement]] *(entity, v2)*: One [[rule]] in a [[spec]], with an ID such as REQ-003, that its [[gherkin|Gherkin]] [[scenario|scenarios]] check.
- **1.19** [[response]] *(entity, v3)*: What an [[agent]] writes back to a [[person]]: a two-column table of up to four labelled rows (Done, Open, Needs you, Check), each included only when it has something to say, in at most 8 rows.
- **1.20** [[result]] *(entity, v2)*: The pass or fail a [[verdict]] gives one [[requirement]].
- **1.21** [[rule]] *(entity, v2)*: One sentence a [[adr|decision]] put in force, written in [[ears|EARS]]; [[agent|agents]] follow the newest one.
- **1.22** [[rules-not-landing]] *(problem, v2)*: Instructions get recited back, but their effects never show up in what [[agent|agents]] do.
- **1.23** [[scenario]] *(entity, v2)*: One concrete case under a [[requirement]], written in [[gherkin|Gherkin]] as Given, When and Then, and run as a test.
- **1.24** [[selector]] *(entity, v2)*: A fixed phrase a [[skill]] defines, together with its [[test-step|test step]], that a [[spec]] line may use, such as "is assigned 20".
- **1.25** [[skill]] *(entity, v2)*: A packaged procedure an [[agent]] loads when it is relevant, which can add its own [[selector]]s.
- **1.26** [[spec]] *(entity, v2)*: A short file listing what a change must do: each [[ears|EARS]] [[rule]] states a [[requirement]], and its [[gherkin|Gherkin]] [[scenario|scenarios]] are the executable tests that check it, run through [[test-step|test step]] code.
- **1.27** [[term]] *(entity, v1)*: A note defining one word of the project vocabulary, which [[spec|specs]] and [[adr|decisions]] link to.
- **1.28** [[test-sprawl]] *(problem, v2)*: Tests and QA grow far beyond what the work needs.
- **1.29** [[test-step]] *(entity, v3)*: The test code that makes one [[selector]] actually run, so a [[scenario]] line using it can be executed.
- **1.30** [[verdict]] *(entity, v2)*: A YAML record giving pass or fail for each [[requirement]], with [[evidence]] and up to five [[finding|findings]].
- **1.31** [[verifier]] *(actor, v2)*: The [[agent]] that checks a [[job]]'s change against its [[spec]] and writes the [[verdict]]; it never wrote the change.

## 2 Decision log

- **2.1** [[ADR-0001|ADR-0001]] *accepted (A)*: What shape does each [[question]] an [[agent]] puts to you take?
- **2.2** [[ADR-0002|ADR-0002]] *accepted (A)*: How is a [[spec]] written, so that you can see each [[requirement]] pass or fail in a test?
- **2.3** [[ADR-0003|ADR-0003]] *accepted (A)*: Which words may a [[spec]] line use, and so which of them can you look up as a [[term]]?
- **2.4** [[ADR-0004|ADR-0004]] *accepted (A)*: What shape does each [[response|reply]] you read from an [[agent]] take?
- **2.5** [[ADR-0005|ADR-0005]] *accepted (A)*: Where should each project's own layer live?
- **2.6** [[ADR-0006|ADR-0006]] *accepted (C)*: What happens to a [[term]] that no [[rule]] in force uses, in the base prompt you read and in the vault?
- **2.7** [[ADR-0007|ADR-0007]] *accepted (A)*: Where do you answer an [[agent]]'s [[question|questions]]?
- **2.8** [[ADR-0008|ADR-0008]] *accepted (A)*: What must happen when a [[person]] asks for a check?
- **2.9** [[ADR-0009|ADR-0009]] *accepted (A)*: In what form does an [[agent]] hand a [[job]] to another [[agent]], which decides what you can check of the handoff?
- **2.10** [[ADR-0010|ADR-0010]] *accepted (A)*: What happens to the Decisions list you read when an [[adr]] that amends another is decided?
- **2.11** [[ADR-0011|ADR-0011]] *accepted (A)*: What happens to a [[response|reply]] that breaks the reply [[rule]] before you see it?
- **2.12** [[ADR-0012|ADR-0012]] *accepted (D)*: When do the tests you've written run automatically?
- **2.13** [[ADR-0013|ADR-0013]] *accepted (A)*: Which sessions should load the base prompt?
- **2.14** [[ADR-0014|ADR-0014]] *accepted (A)*: Should the base prompt leave out [[rule|rules]] an [[agent]] cannot act on?

## Templates

[[Term]] · [[Question (ADR)]] · [[Response]] · [[Spec]]
