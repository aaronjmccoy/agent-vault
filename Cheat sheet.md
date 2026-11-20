# Prompting the agent-vault framework: cheat sheet

As of 2026-11-20. Online copy: https://claude.ai/artifact/E13ccGAX3ufLPkkmt1UzM9

## How it works

You say what you want. Agents follow the rules in force and ask you things only in the question dialog.

1. The shared vault (`agent-vault`) holds Decisions (ADR-0001 onward), Terms, Specs and Templates. Base.md, Docs.md and Index.md are generated from them.
2. Every session under `Documents\Projects` loads the base prompt through the CLAUDE.md in that folder.
3. When an agent needs a decision from you, it writes a proposed ADR and asks it in the client's question dialog, which works on desktop and mobile (ADR-0010).
4. The option you pick is written into the ADR and becomes a rule in force. The base prompt picks it up at the next refresh.
5. Each reply comes back as a small table of at most four labelled rows: Done, Open, Needs you, Check.
6. Agents hand work to each other only as contracts: Gherkin specs, with a result for each scenario and no prose (ADR-0012).

## Commands

| Command | What it does |
| --- | --- |
| `/decisions` | Lists the ADRs waiting for you. Send any message and the agent asks them in the dialog. |
| `/ref-guide` | Opens the reference guide panel: rules in force, the glossary and open questions. On a surface with no panels, read Docs.md instead. |

## Asking for work

Say what outcome you want and how you'll know it's done, using the vault's own words. Agents act on what they can check.

| You want | Say | Why it lands |
| --- | --- | --- |
| A task done | "Add X. It's done when `npm test` passes and the page shows Y." | The done-when gives the agent its Check line. |
| Exact meaning | Use defined words: spec, rule, verdict, job | Each has one note, so there's nothing to guess. |
| A checked result | "Check this against its spec." | A verifier writes a verdict: pass or fail for each requirement, with evidence (ADR-0011). |
| A standing behaviour | "Make this a rule: when X, the agent shall Y." | The agent writes a proposed ADR. Once you pick it, it reaches every session. |
| To change a rule | "Revise ADR-0004 so that…" | The agent writes a revising ADR instead of working around the rule. |
| A one-off exception | "Just this once, …" | Nothing is recorded, and the rule stays as it is. |
| Options to weigh | "Propose a decision on…" | You get a question where each option is a rule with its cost. |
| A long explanation | "Write it up as a doc" or "…as a note in the vault" | Chat replies are capped at 8 rows. |

Agents never ask you questions in chat. When one needs you, it writes an ADR and opens the dialog.

## Reading a reply

Read Needs you first. It's the only line that waits on you.

| Row | Opens with | Means | Your move |
| --- | --- | --- | --- |
| Done | Added, Changed, Fixed, Removed, Found | What changed | Skim it |
| Open | … is not started, not done, blocked | What's unfinished | Decide whether it matters |
| Needs you | Decide ADR-nnnn, Approve, Do | The one thing waiting on you | Act on it |
| Check | Run `command`, Open link → what you should see | How to verify it yourself | Run it before trusting Done |

A missing row means there was nothing to say. Each defined term links to its note. If a reply breaks this shape, a ⚠ note says how, and the agent is told to fix it.

## Answering a question

Each option is the exact rule that goes into force. Its description gives the rule, then → what happens and what it costs. The header is the ADR id. The preview shows the Given and the definition of each term it uses.

The ADR behind the dialog reads top to bottom:

- **Given**: why the question came up, and which problem it serves.
- **Decide**: one question ending in "?".
- **Where A, B…**: one rule per option (at most 4), then → what happens · what it costs.
- **Combines**: whether options can be mixed.
- **Recommend**: the agent's pick and its reason, shown first in the dialog.

| To | Do | What happens |
| --- | --- | --- |
| Take an option | Pick it (the recommended one comes first) | Its rule goes into force at the next refresh |
| Say something else | Type in Other | The ADR stays proposed. The agent reads your words, then rewrites the question or talks it through |
| Wait | Skip it or close the dialog | It stays proposed, and agents treat it as undecided |
| Answer later | Run `/decisions`, then send any message | The agent asks what's waiting |

If a question is hard to follow, it's badly written. Say so in Other, for example "unclear: what does option B cost?". The agent will rewrite the ADR.

## Writing rules and specs

A rule is one EARS sentence. Name who acts, when, and what they shall do.

| Pattern | Use it for |
| --- | --- |
| When \<trigger>, the \<actor> shall \<response>. | Something that happens on an event |
| While \<state>, the \<actor> shall \<response>. | Something that holds while a state lasts |
| If \<unwanted condition>, then the \<actor> shall \<response>. | Handling a failure |
| Where \<context or feature>, the \<actor> shall \<response>. | Something that applies only in some places |

A spec puts each rule on a Gherkin Rule line with an ID, then 1–3 scenarios under it. The scenarios run as tests.

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[person]] asks for a check, the [[verifier]] shall write one [[verdict]].
  Scenario: a requested check gets a verdict
    Given a [[job]] whose change is ready
    When the [[person]] asks for a check
    Then one [[verdict]] is written
```

A spec line may use only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and approved selectors. Write every other noun as a `[[term]]` link. Start a new spec from Templates/Spec.md.

## Terms and links

If a word matters, it needs a term note. Undefined words are where meaning gets lost.

- **Define before use.** A term note is one file in Terms with a one-sentence `**Definition:**`. Ask "add a term for X" before you rely on a new word.
- **Link every instance.** In notes, specs and ADRs, write `[[term]]`. In chat, write a markdown link to the note, such as `[spec](Terms/spec.md)`.
- **Change a meaning once.** Editing a definition bumps the note's version, and agents use only the newest one.
- **Keep unused terms.** A term stays in the base prompt even when no rule uses it yet (ADR-0009).
- **Words worth knowing:** adr, rule, spec, contract, requirement, scenario, step, selector, job, verdict, verifier, response, link. `/ref-guide` and Docs.md list them all.

## Where things live

Edit the source notes. Generated files are rebuilt from them, and any edit you make to them is overwritten.

| What | Where | Edit it? |
| --- | --- | --- |
| Decisions (ADR-0001…) | agent-vault/Decisions | Yes: answer in the dialog, or edit the file |
| Terms | agent-vault/Terms | Yes |
| Specs | agent-vault/Specs | Yes |
| Templates (Question, Response, Spec, Term) | agent-vault/Templates | Yes |
| A project's own rules and terms | `<repo>/vault/Decisions`, `<repo>/vault/Terms` | Yes. A project's note wins over a shared note with the same name |
| Base.md, Docs.md, Index.md | agent-vault | No, they're generated |
| Workspace CLAUDE.md | Documents\Projects | No, it's generated |
| Old drafts | agent-vault/Archive | History only; agents don't read it |

Three rules are records, not instructions: test pace (ADR-0006), workspace setup (ADR-0007) and the base-prompt filter (ADR-0008). They appear in Docs.md and the reference guide, but not in the base prompt.

## Pitfalls

| Pitfall | What happens | Instead |
| --- | --- | --- |
| Editing Base.md or CLAUDE.md | Your edit is overwritten at the next refresh | Change the decision behind it |
| Vague asks ("clean it up", "make it better") | The agent guesses what done means | Say what done looks like, as something you can run or open |
| A rule that only describes setup | It's kept out of the base prompt (ADR-0008) | Phrase it as something an agent does |
| Expecting a chat question back | The agent asks in the question dialog | Answer there, or run `/decisions` later |
| Typing a rule into Other | It isn't put in force until the agent writes it as an option and asks again | Pick an option, or ask for a revised question |
| Reopening a settled point | Agents won't reopen it on their own | Ask for a revising ADR by number |
| Asking for a long write-up in chat | The 8-row cap cuts it short | Ask for a doc or a vault note |
