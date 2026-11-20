# Docs

How this system works, written from its 12 [[rule|rules]] in force and 31 defined [[term|terms]]. Each [[rule]] says who acts, when, and what they shall do. Follow a link for a [[term]]'s definition or the [[adr|decision]] behind a [[rule]].

## Contents

1. Agents › Communication
2. Agents › Handoff
3. Agents › Process
4. Agents › Specs
5. Agents › Verification
6. Agents › Vocabulary
7. Testing
8. Glossary

## 1. Agents › Communication

**1.1** When an [[agent]] asks a [[person]] to decide, the [[agent]] shall write the [[question]] as an [[adr]] with status proposed, in the lines Given, Decide, Where (one per option), Combines and Recommend.

*Why:* What shape must an [[agent]]'s [[question]] to a [[person]] take? *Decided in [[ADR-0001|ADR-0001]].*

**1.2** When an [[agent]] replies to a [[person]], the [[agent]] shall use four labelled lines (Done, Open, Needs you, Check), each a link or one short clause, in at most 8 lines.

*Why:* What fixed shape should an [[agent]]'s [[response|reply]] to you take instead? *Decided in [[ADR-0004|ADR-0004]].*

**1.3** When an [[agent]] asks a [[person]] to decide, the [[agent]] shall write the proposed [[adr]] and show it as the native [[question]] dialog, and the decision-cards mod shall write the answer back into that [[adr]].

*Why:* Where should you answer an [[agent]]'s [[question|questions]]? *Decided in [[ADR-0010|ADR-0010]].*

## 2. Agents › Handoff

**2.1** When an [[agent]] hands a [[job]] to another [[agent]], the [[agent]] shall hand it as a [[contract]], and both [[agent|agents]] shall communicate only through that [[contract]] and a [[result]] for each of its [[scenario|scenarios]], with no prose.

*Why:* How must an [[agent]] hand a [[job]] to another [[agent]]? *Decided in [[ADR-0012|ADR-0012]].*

## 3. Agents › Process

**3.1** Where a project has its own [[rule|rules]], [[term|terms]], docs or [[job|jobs]], the [[agent]] shall keep them in a vault folder inside that project's repository, layered over the shared vault, with the project's note winning where both define the same name.

*Why:* Where should each project's own layer live? *Decided in [[ADR-0005|ADR-0005]].*

**3.2** Where an [[agent]] works in any folder under Documents\Projects, the [[agent]] shall load Base.md, through a CLAUDE.md in Documents\Projects, and the decision-cards mod shall run in that session.

*Why:* Which sessions should load the base prompt and run the decision-cards mod? *Decided in [[ADR-0007|ADR-0007]].*

**3.3** Where a [[rule]] only records setup or leaves the choice to each project, the decision-cards mod shall keep it out of the base prompt and list it in Docs only.

*Why:* Should the base prompt leave out [[rule|rules]] an [[agent]] cannot act on? *Decided in [[ADR-0008|ADR-0008]].*

## 4. Agents › Specs

**4.1** When a [[spec]] is written, the author shall put each [[ears|EARS]] [[requirement]] in a [[gherkin|Gherkin]] [[rule|Rule]] line, with an ID and 1–3 [[scenario|Scenarios]] under it.

*Why:* How is a [[spec]] written, so that every [[requirement]] is checked by a test? *Decided in [[ADR-0002|ADR-0002]].*

## 5. Agents › Verification

**5.1** When a [[person]] asks for a check, the [[verifier]] shall check the [[job]]'s change against its [[spec]] and write a [[verdict]], with [[evidence]] for each [[result]] and at most five [[finding|findings]].

*Why:* Must a [[job]]'s change be checked by a [[verifier]] before it reaches you? *Decided in [[ADR-0011|ADR-0011]].*

## 6. Agents › Vocabulary

**6.1** When a [[spec]] line is written, the author shall use only [[ears|EARS]] and [[gherkin|Gherkin]] keywords, the fixed operators (is, equals, above, below, within, contains, not) and [[selector]]s, and shall link every other noun as a short [[term]] link.

*Why:* What may appear in a [[spec]] line, and how is each [[term]] addressed? *Decided in [[ADR-0003|ADR-0003]].*

**6.2** Where a [[term]] has a note, the decision-cards mod shall put it in the base prompt.

*Why:* Should the base prompt leave out [[term|terms]] that no [[rule]] in force uses? *Decided in [[ADR-0009|ADR-0009]].*

## 7. Testing

**7.1** The [[ci]] shall run a project's tests automatically at the pace that project specifies.

*Why:* When should the tests you've written run automatically? *Decided in [[ADR-0006|ADR-0006]].*

## 8. Glossary

**[[adr]]** *(entity)*: A short file recording one decision: the [[question]], its options as [[ears|EARS]] [[rule|rules]], the choice, and its consequences. Used in [[ADR-0001|ADR-0001]], [[ADR-0010|ADR-0010]].

**[[agent]]** *(actor)*: An AI model doing work in a session: it writes, checks and asks, and the [[person]] decides. Used in [[ADR-0001|ADR-0001]], [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0005|ADR-0005]], [[ADR-0007|ADR-0007]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0010|ADR-0010]], [[ADR-0011|ADR-0011]], [[ADR-0012|ADR-0012]].

**[[autocommit]]** *(action)*: Committing changes automatically at a pace a project sets. Used in [[ADR-0006|ADR-0006]].

**[[ci]]** *(actor)*: The automated checker that runs tests whenever code is committed. Used in [[ADR-0006|ADR-0006]].

**[[contract]]** *(entity)*: The [[spec]] one [[agent]] hands another as the whole of a [[job]]: its [[gherkin|Gherkin]] [[scenario|scenarios]] say what must be done and how it is checked, with no prose beside them. Used in [[ADR-0012|ADR-0012]].

**[[cryptic-questions]]** *(problem)*: [[agent|Agent]] [[question|questions]] assume jargon and treat the [[person]]'s words as fixed picks instead of reasoning about them.

**[[ears]]** *(entity)*: A fixed sentence pattern for a [[rule]]: When, While, If or Where, then the system shall do something. Used in [[ADR-0001|ADR-0001]], [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]].

**[[evidence]]** *(entity)*: The link that backs a [[result]] in a [[verdict]]: the [[scenario]] or test run that showed it. Used in [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].

**[[finding]]** *(entity)*: One problem a [[verdict]] reports, tied to the [[requirement]] it breaks and written in the [[spec]]'s vocabulary. Used in [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].

**[[gherkin]]** *(entity)*: The Given, When, Then language used for [[scenario|scenarios]] in a [[spec]]. Used in [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]].

**[[hard-to-judge]]** *(problem)*: The [[person]] cannot tell quickly whether an [[agent]]'s output is good. Used in [[ADR-0010|ADR-0010]], [[ADR-0011|ADR-0011]], [[ADR-0012|ADR-0012]].

**[[job]]** *(entity)*: One piece of work an [[agent]] carries from a [[person]]'s request to a [[verdict]]: its [[spec]], its [[message]]s, and any [[adr]]s it raised. Used in [[ADR-0005|ADR-0005]], [[ADR-0011|ADR-0011]], [[ADR-0012|ADR-0012]].

**[[link]]** *(entity)*: A reference from text to a [[term]]'s note, written as [[term]] in notes, [[spec|specs]] and [[adr|ADRs]], and as a markdown link to the note's file in chat replies, where wiki links show as plain text; every instance of a defined word gets one.

**[[long-replies]]** *(problem)*: [[agent|Agent]] replies run far too long and are tedious to review. Used in [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]].

**[[message]]** *(entity)*: A YAML record one [[agent]] writes to hand work to another: who, what [[job]], status, links and needs. Used in [[ADR-0009|ADR-0009]].

**[[person]]** *(actor)*: The human the [[agent|agents]] work for: the only one who decides, and the reader every [[response|reply]] is written for. Used in [[ADR-0001|ADR-0001]], [[ADR-0004|ADR-0004]], [[ADR-0010|ADR-0010]], [[ADR-0011|ADR-0011]].

**[[question]]** *(entity)*: A request from an [[agent]] for a [[person]] to decide, written as a proposed [[adr]] and asked in the client's native question dialog, which records the answer in that [[adr]]. Used in [[ADR-0001|ADR-0001]], [[ADR-0010|ADR-0010]].

**[[requirement]]** *(entity)*: One [[rule]] in a [[spec]], with an ID such as REQ-003, that its [[gherkin|Gherkin]] [[scenario|scenarios]] check. Used in [[ADR-0002|ADR-0002]].

**[[response]]** *(entity)*: What an [[agent]] writes back to a [[person]]: up to four labelled lines (Done, Open, Needs you, Check), each included only when it has something to say, in at most 8 lines. Used in [[ADR-0004|ADR-0004]], [[ADR-0011|ADR-0011]].

**[[result]]** *(entity)*: The pass or fail a [[verdict]] gives one [[requirement]]. Used in [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]], [[ADR-0012|ADR-0012]].

**[[rule]]** *(entity)*: One sentence a [[adr|decision]] put in force, written in [[ears|EARS]]; [[agent|agents]] follow the newest one. Used in [[ADR-0001|ADR-0001]], [[ADR-0002|ADR-0002]], [[ADR-0005|ADR-0005]], [[ADR-0008|ADR-0008]], [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].

**[[rules-not-landing]]** *(problem)*: Instructions get recited back, but their effects never show up in what [[agent|agents]] do. Used in [[ADR-0005|ADR-0005]], [[ADR-0007|ADR-0007]].

**[[scenario]]** *(entity)*: One concrete case under a [[requirement]], written in [[gherkin|Gherkin]] as Given, When and Then, and run as a test. Used in [[ADR-0002|ADR-0002]], [[ADR-0006|ADR-0006]], [[ADR-0012|ADR-0012]].

**[[selector]]** *(entity)*: An approved phrase a [[spec]] may use, such as "is assigned 20". Used in [[ADR-0003|ADR-0003]].

**[[skill]]** *(entity)*: A packaged procedure an [[agent]] loads when it is relevant, which can add its own [[selector]]s.

**[[spec]]** *(entity)*: A short file listing what a change must do: each [[ears|EARS]] [[rule]] states a [[requirement]], and its [[gherkin|Gherkin]] [[scenario|scenarios]] are the executable tests that check it, run through [[step]] code. Used in [[ADR-0002|ADR-0002]], [[ADR-0003|ADR-0003]], [[ADR-0004|ADR-0004]], [[ADR-0006|ADR-0006]], [[ADR-0011|ADR-0011]], [[ADR-0012|ADR-0012]].

**[[step]]** *(entity)*: The test code that makes one [[selector]] actually run. Used in [[ADR-0002|ADR-0002]], [[ADR-0006|ADR-0006]].

**[[term]]** *(entity)*: A note defining one word of the project vocabulary, which [[spec|specs]] and [[adr|decisions]] link to. Used in [[ADR-0001|ADR-0001]], [[ADR-0003|ADR-0003]], [[ADR-0005|ADR-0005]], [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].

**[[test-sprawl]]** *(problem)*: Tests and QA grow far beyond what the work needs.

**[[verdict]]** *(entity)*: A YAML record giving pass or fail for each [[requirement]], with [[evidence]] and up to five [[finding|findings]]. Used in [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].

**[[verifier]]** *(actor)*: The [[agent]] that checks a [[job]]'s change against its [[spec]] and writes the [[verdict]]; it never wrote the change. Used in [[ADR-0009|ADR-0009]], [[ADR-0011|ADR-0011]].
