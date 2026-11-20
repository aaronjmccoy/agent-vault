# Docs

How this system works, written from its 14 [[rule|rules]] in force and 31 defined [[term|terms]]. Each [[rule]] says who acts, when, and what they do. Follow a link for a [[term]]'s definition or the [[adr|decision]] behind a [[rule]].

## Contents

1. Rules in force
2. Glossary

## 1. Rules in force

**1.1** When asking a [[person]] to decide, the [[agent]] writes the [[question]] as a proposed [[adr]] from the Question template: a Given, one Decide question, two to four Where options that each state an [[ears|EARS]] [[rule]] with what happens and what it costs, Combines, and Recommend.

*Why:* What shape does each [[question]] an [[agent]] puts to you take? *Decided in [[ADR-0001|ADR-0001]] · Agents › Communication.*

**1.2** When writing a [[spec]], the author puts each [[ears|EARS]] [[requirement]] in a [[gherkin|Gherkin]] Rule line, with an ID and 1–3 [[scenario|Scenarios]] under it.

*Why:* How is a [[spec]] written, so that you can see each [[requirement]] pass or fail in a test? *Decided in [[ADR-0002|ADR-0002]] · Agents › Specs.*

**1.3** When writing a [[spec]] line, the author uses only [[ears|EARS]] and [[gherkin|Gherkin]] keywords, the fixed operators (is, equals, above, below, within, contains, not) and [[selector|selectors]], and links every other noun as a short [[term]] [[link]].

*Why:* Which words may a [[spec]] line use, and so which of them can you look up as a [[term]]? *Decided in [[ADR-0003|ADR-0003]] · Agents › Vocabulary.*

**1.4** When writing a [[response|reply]], the [[agent]] uses a two-column table of up to four labelled rows (Done, Open, Needs you, Check), each a [[link]] or one short clause, in at most 8 rows.

*Why:* What shape does each [[response|reply]] you read from an [[agent]] take? *Decided in [[ADR-0004|ADR-0004]] · Agents › Communication.*

**1.5** Where a project has its own [[rule|rules]], [[term|terms]], docs or [[job|jobs]], the [[agent]] keeps them in a vault folder inside that project's repository, layered over the shared vault, with the project's note winning where both define the same name.

*Why:* Where should each project's own layer live? *Decided in [[ADR-0005|ADR-0005]] · Agents › Process.*

**1.6** Where a [[term]] has a note, the base prompt includes it.

*Why:* What happens to a [[term]] that no [[rule]] in force uses, in the base prompt you read and in the vault? *Decided in [[ADR-0006|ADR-0006]] · Agents › Vocabulary.*

**1.7** When asking a [[person]] to decide, the [[agent]] writes the proposed [[adr]] and shows it as the native [[question]] dialog, and the dialog writes the [[person]]'s pick back into that [[adr]].

*Why:* Where do you answer an [[agent]]'s [[question|questions]]? *Decided in [[ADR-0007|ADR-0007]] · Agents › Communication.*

**1.8** When a [[person]] asks for a check, the [[agent]] first lists the [[requirement|requirements]] and [[scenario|scenarios]] it will test as a compact table and confirms them with the [[person]], and the [[verifier]] then checks the [[job]]'s change against them and writes a [[verdict]], with [[evidence]] for each [[result]] and at most five [[finding|findings]].

*Why:* What must happen when a [[person]] asks for a check? *Decided in [[ADR-0008|ADR-0008]] · Agents › Verification.*

**1.9** When handing a [[job]] to another [[agent]], the [[agent]] hands it as a [[contract]], and both [[agent|agents]] communicate only through that [[contract]] and a [[result]] for each of its [[scenario|scenarios]], with no prose.

*Why:* In what form does an [[agent]] hand a [[job]] to another [[agent]], which decides what you can check of the handoff? *Decided in [[ADR-0009|ADR-0009]] · Agents › Handoff.*

**1.10** When an [[adr]] that amends another is decided, the [[agent]] moves the amended [[adr]] to the Archive, gives the decided one its place, and renumbers the [[adr|ADRs]] in force so they run in order with no gaps, updating every [[link]] to them.

*Why:* What happens to the Decisions list you read when an [[adr]] that amends another is decided? *Decided in [[ADR-0010|ADR-0010]] · Agents › Process.*

**1.11** When a [[response|reply]] breaks the reply [[rule]], the reply check holds it back before it enters the chat, and the [[agent]] recomposes the whole [[response|reply]] from the problems found, so only the corrected [[response|reply]] is shown.

*Why:* What happens to a [[response|reply]] that breaks the reply [[rule]] before you see it? *Decided in [[ADR-0011|ADR-0011]] · Agents › Communication.*

**1.12** Where a project sets a test pace, [[ci]] runs that project's tests at that pace, and the project also sets the pace at which to [[autocommit]].

*Why:* When do the tests you've written run automatically? *Decided in [[ADR-0012|ADR-0012]] · Agents › Testing · a record, not in the base prompt.*

**1.13** Where an [[agent]] works in any folder under a workspace listed in AGENT_WORKSPACES, the [[agent]] loads the base prompt through the CLAUDE.md at that workspace's root.

*Why:* Which sessions should load the base prompt? *Decided in [[ADR-0013|ADR-0013]] · Agents › Process · a record, not in the base prompt.*

**1.14** Where a [[rule]] only records setup or leaves the choice to each project, the base prompt leaves it out, and Docs lists it.

*Why:* Should the base prompt leave out [[rule|rules]] an [[agent]] cannot act on? *Decided in [[ADR-0014|ADR-0014]] · Agents › Process · a record, not in the base prompt.*

## 2. Glossary

**[[adr]]** *(entity)*: A short file recording one decision: the [[question]], its options as [[ears|EARS]] [[rule|rules]], the choice, and its consequences. Used in [[ADR-0001|ADR-0001]], [[ADR-0007|ADR-0007]], [[ADR-0010|ADR-0010]].

**[[agent]]** *(actor)*: An AI model doing work in a session: it writes, checks and asks, and the [[person]] decides. Used in [[ADR-0001|ADR-0001]], [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0005|ADR-0005]], [[ADR-0006|ADR-0006]], [[ADR-0007|ADR-0007]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0010|ADR-0010]], [[ADR-0011|ADR-0011]], [[ADR-0013|ADR-0013]], [[ADR-0014|ADR-0014]].

**[[autocommit]]** *(action)*: Committing changes automatically at a pace a project sets. Used in [[ADR-0012|ADR-0012]].

**[[ci]]** *(actor)*: The automated checker that runs tests whenever code is committed. Used in [[ADR-0012|ADR-0012]].

**[[contract]]** *(entity)*: The [[spec]] one [[agent]] hands another as the whole of a [[job]]: its [[gherkin|Gherkin]] [[scenario|scenarios]] say what must be done and how it is checked, with no prose beside them. Used in [[ADR-0009|ADR-0009]].

**[[cryptic-questions]]** *(problem)*: [[agent|Agent]] [[question|questions]] assume jargon and treat the [[person]]'s words as fixed picks instead of reasoning about them. Used in [[ADR-0001|ADR-0001]].

**[[ears]]** *(entity)*: A fixed sentence pattern for a [[rule]], in the present tense: When, While, If or Where something holds, an actor does something, as in "When writing a reply, the agent uses a two-column table of labelled rows." Used in [[ADR-0001|ADR-0001]], [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]].

**[[evidence]]** *(entity)*: The link that backs a [[result]] in a [[verdict]]: the [[scenario]] or test run that showed it. Used in [[ADR-0006|ADR-0006]], [[ADR-0008|ADR-0008]].

**[[finding]]** *(entity)*: One problem a [[verdict]] reports, tied to the [[requirement]] it breaks and written in the [[spec]]'s vocabulary. Used in [[ADR-0006|ADR-0006]], [[ADR-0008|ADR-0008]].

**[[gherkin]]** *(entity)*: The Given, When, Then language used for [[scenario|scenarios]] in a [[spec]]. Used in [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0009|ADR-0009]].

**[[hard-to-judge]]** *(problem)*: The [[person]] cannot tell quickly whether an [[agent]]'s output is good. Used in [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0007|ADR-0007]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0010|ADR-0010]], [[ADR-0012|ADR-0012]].

**[[job]]** *(entity)*: One piece of work an [[agent]] carries from a [[person]]'s request to a [[verdict]]: its [[spec]], its [[message]]s, and any [[adr]]s it raised. Used in [[ADR-0005|ADR-0005]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]].

**[[link]]** *(entity)*: A reference from text to a [[term]]'s note, written as [[term]] in notes, [[spec|specs]] and [[adr|ADRs]], and as a markdown link to the note's file in chat replies, where wiki links show as plain text; every instance of a defined word gets one. Used in [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0009|ADR-0009]], [[ADR-0010|ADR-0010]], [[ADR-0011|ADR-0011]].

**[[long-replies]]** *(problem)*: [[agent|Agent]] replies run far too long and are tedious to review. Used in [[ADR-0004|ADR-0004]], [[ADR-0006|ADR-0006]], [[ADR-0014|ADR-0014]].

**[[message]]** *(entity)*: A YAML record one [[agent]] writes to hand work to another: who, what [[job]], status, links and needs. Used in [[ADR-0006|ADR-0006]].

**[[person]]** *(actor)*: The human the [[agent|agents]] work for: the only one who decides, and the reader every [[response|reply]] is written for. Used in [[ADR-0001|ADR-0001]], [[ADR-0006|ADR-0006]], [[ADR-0007|ADR-0007]], [[ADR-0008|ADR-0008]].

**[[question]]** *(entity)*: A request from an [[agent]] for a [[person]] to decide, written as a proposed [[adr]] and asked in the client's native question dialog, which records the answer in that [[adr]]. Used in [[ADR-0001|ADR-0001]], [[ADR-0007|ADR-0007]].

**[[requirement]]** *(entity)*: One [[rule]] in a [[spec]], with an ID such as REQ-003, that its [[gherkin|Gherkin]] [[scenario|scenarios]] check. Used in [[ADR-0002|ADR-0002]], [[ADR-0008|ADR-0008]].

**[[response]]** *(entity)*: What an [[agent]] writes back to a [[person]]: a two-column table of up to four labelled rows (Done, Open, Needs you, Check), each included only when it has something to say, in at most 8 rows. Used in [[ADR-0004|ADR-0004]], [[ADR-0007|ADR-0007]], [[ADR-0011|ADR-0011]].

**[[result]]** *(entity)*: The pass or fail a [[verdict]] gives one [[requirement]]. Used in [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]].

**[[rule]]** *(entity)*: One sentence a [[adr|decision]] put in force, written in [[ears|EARS]]; [[agent|agents]] follow the newest one. Used in [[ADR-0001|ADR-0001]], [[ADR-0005|ADR-0005]], [[ADR-0006|ADR-0006]], [[ADR-0011|ADR-0011]], [[ADR-0014|ADR-0014]].

**[[rules-not-landing]]** *(problem)*: Instructions get recited back, but their effects never show up in what [[agent|agents]] do. Used in [[ADR-0002|ADR-0002]], [[ADR-0005|ADR-0005]], [[ADR-0011|ADR-0011]], [[ADR-0013|ADR-0013]].

**[[scenario]]** *(entity)*: One concrete case under a [[requirement]], written in [[gherkin|Gherkin]] as Given, When and Then, and run as a test. Used in [[ADR-0002|ADR-0002]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0012|ADR-0012]].

**[[selector]]** *(entity)*: An approved phrase a [[spec]] may use, such as "is assigned 20". Used in [[ADR-0003|ADR-0003]].

**[[skill]]** *(entity)*: A packaged procedure an [[agent]] loads when it is relevant, which can add its own [[selector]]s.

**[[spec]]** *(entity)*: A short file listing what a change must do: each [[ears|EARS]] [[rule]] states a [[requirement]], and its [[gherkin|Gherkin]] [[scenario|scenarios]] are the executable tests that check it, run through [[test-step|test step]] code. Used in [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0012|ADR-0012]].

**[[term]]** *(entity)*: A note defining one word of the project vocabulary, which [[spec|specs]] and [[adr|decisions]] link to. Used in [[ADR-0001|ADR-0001]], [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0005|ADR-0005]], [[ADR-0006|ADR-0006]], [[ADR-0011|ADR-0011]].

**[[test-sprawl]]** *(problem)*: Tests and QA grow far beyond what the work needs. Used in [[ADR-0002|ADR-0002]].

**[[test-step]]** *(entity)*: The test code that makes one [[selector]] actually run, so a [[scenario]] line using it can be executed. Used in [[ADR-0002|ADR-0002]], [[ADR-0012|ADR-0012]].

**[[verdict]]** *(entity)*: A YAML record giving pass or fail for each [[requirement]], with [[evidence]] and up to five [[finding|findings]]. Used in [[ADR-0008|ADR-0008]].

**[[verifier]]** *(actor)*: The [[agent]] that checks a [[job]]'s change against its [[spec]] and writes the [[verdict]]; it never wrote the change. Used in [[ADR-0008|ADR-0008]].
