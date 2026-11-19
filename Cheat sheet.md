# Prompting the agent-vault framework: cheat sheet

As of 2026-11-19. Online copy: https://claude.ai/artifact/E13ccGAX3ufLPkkmt1UzM9

## How it works

You say what you want. Agents follow the rules in force, and they ask you only through decision cards.

1. The shared vault (`agent-vault`) holds Decisions (ADR-0001 to ADR-0008), Terms, Specs and Templates. Base.md, Docs.md and Index.md are generated from them.
2. Every session under `Documents\Projects` loads the base prompt through the CLAUDE.md file in that folder.
3. When an agent needs a decision from you, it writes a proposed ADR. The ADR shows up as a card in the Decisions panel.
4. Your answer becomes a rule in force, and the base prompt picks it up at the next refresh.
5. Each reply comes back in at most four labelled lines: Done, Open, Needs you, Check.

## Asking for work

Give the outcome and how you'll know it's done, and use the vault's own words. Agents carry out what they can check.

| You want | Say | Why it lands |
| --- | --- | --- |
| A task done | "Add X. It's done when `npm test` passes and the page shows Y." | A done-when gives the agent its Check line. |
| Exact meaning | Use defined words: spec, rule, verdict, job | Each has one note, so nobody has to guess what you meant. |
| A standing behaviour | "Make this a rule: when X, the agent shall Y." | The agent writes a proposed ADR, and once you accept it, it reaches every session. |
| To change a rule | "Revise ADR-0004 so that…" | The agent writes a revising ADR instead of quietly working around the rule. |
| A one-off exception | "Just this once, …" | Nothing gets recorded, and the rule stays as it is. |
| Options to weigh | "Propose a decision on…" | You get a card with each option as a rule and its cost. |
| A long explanation | "Write it up as a doc" or "…as a note in the vault" | Chat replies are capped at 8 lines. |

Agents never ask you questions in chat. When one needs you, it writes a card and ends its turn.

## Reading a reply

Read Needs you first. It's the only line that waits on you.

| Line | Opens with | Means | Your move |
| --- | --- | --- | --- |
| Done | Added, Changed, Fixed, Removed, Found | What changed | Skim it |
| Open | … is not started, not done, blocked | What's unfinished | Decide whether it matters |
| Needs you | Decide ADR-nnnn, Approve, Do | The one thing waiting on you | Act on it |
| Check | Run `command`, Open link → what you should see | How to check it yourself | Run it before you trust Done |

A missing line means there was nothing to say. Each defined term links to its note. If a reply breaks the shape, a ⚠ note says how, and the agent is told to fix it.

## Answering a decision card

Each option on a card is the exact rule that goes into force. Read the arrow line under it before you pick.

A card reads top to bottom:

- **Given**: why the question came up, and which problem it serves.
- **Decide**: one question ending in "?".
- **Where A, B…**: one rule per option, then → what happens · what it costs.
- **Combines**: whether options can be mixed.
- **Recommend**: the agent's pick, with a one-line reason.

| To | Do | What happens |
| --- | --- | --- |
| Take an option | Pick it, then Accept | Its rule goes into force at the next refresh |
| Set your own rule | Choose Other and write the rule | Your sentence becomes the rule |
| Answer in plain words | Use Free text | It's recorded as a request until an agent writes it up as a rule |
| Wait | Defer | Agents treat it as undecided |

If a card is hard to follow, the question is badly written. Say so in Free text, for example "unclear: what does option B cost?". The agent will rewrite the card.

## Writing rules and specs

A rule is one EARS sentence. Name who acts, when, and what they shall do.

| Pattern | Use it for |
| --- | --- |
| When \<trigger>, the \<actor> shall \<response>. | Something that happens on an event |
| While \<state>, the \<actor> shall \<response>. | Something that holds for as long as a state lasts |
| If \<unwanted condition>, then the \<actor> shall \<response>. | Handling a failure |
| Where \<context or feature>, the \<actor> shall \<response>. | Something that applies only in some places |

A spec puts each rule on a Gherkin Rule line with an ID, then 1–3 scenarios under it. The scenarios run as tests.

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[job]]'s change is ready, the [[verifier]] shall write one [[verdict]].
  Scenario: a finished job gets a verdict
    Given a [[job]] whose change is ready
    When the [[verifier]] checks it
    Then one [[verdict]] is written
```

A spec line may use only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and approved selectors. Write every other noun as a `[[term]]` link. Start a new spec from Templates/Spec.md.

## Terms and links

If a word matters, it needs a term note. Undefined words are where intent goes missing.

- **Define before use.** A term note is one file in Terms holding a one-sentence `**Definition:**`. Ask "add a term for X" before you lean on a new word.
- **Link every instance.** In notes, specs and ADRs, write `[[term]]`. In chat, write a markdown link to the note, such as `[spec](Terms/spec.md)`.
- **Change a meaning once.** Editing a definition bumps the note's version, and agents use only the newest one.
- **Words worth knowing:** adr, rule, spec, requirement, scenario, step, selector, job, verdict, verifier, response, link. The Glossary in Docs.md lists them all.

## Where things live

Edit the source notes. Generated files are rebuilt from them and overwrite any edits.

| What | Where | Edit it? |
| --- | --- | --- |
| Decisions (ADR-0001…) | agent-vault/Decisions | Yes: answer cards, or edit the file |
| Terms | agent-vault/Terms | Yes |
| Specs | agent-vault/Specs | Yes |
| Templates (Question, Response, Spec, Term) | agent-vault/Templates | Yes |
| A project's own rules and terms | `<repo>/vault/Decisions`, `<repo>/vault/Terms` | Yes. A project note wins over a shared note with the same name |
| Base.md, Docs.md, Index.md | agent-vault | No, they're generated |
| Workspace CLAUDE.md | Documents\Projects | No, it's generated |
| Old drafts | agent-vault/Archive | History only; agents don't read it |

Three rules are records, not instructions: test pace (ADR-0006), workspace setup (ADR-0007) and the base-prompt filter (ADR-0008). They appear in Docs.md but not in the base prompt.

## Pitfalls

| Pitfall | What happens | Instead |
| --- | --- | --- |
| Editing Base.md or CLAUDE.md | Your edit is overwritten at the next refresh | Change the decision behind it |
| Vague asks ("clean it up", "make it better") | The agent guesses what done means | Say what done looks like, as something you can run or open |
| A rule that only describes setup | It's kept out of the base prompt (ADR-0008) | Phrase it as something an agent does |
| Expecting a chat question back | The agent writes a card and stops | Check the Decisions panel |
| Reopening a settled point | Agents won't relitigate it on their own | Ask for a revising ADR by number |
| Asking for a long write-up in chat | The 8-line cap cuts it short | Ask for a doc or a vault note |
