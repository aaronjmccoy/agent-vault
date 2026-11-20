# Working with agents through questions and responses

As of 2026-11-20. Online copy: https://claude.ai/artifact/E13ccGAX3ufLPkkmt1UzM9

You and your [[agent|agents]] talk in a few fixed formats, one for each stage of the work. You ask for work in plain words. An [[agent]] replies in a short table, asks you to decide through the question dialog, and hands work to other [[agent|agents]] as Gherkin [[contract|contracts]]. Every decision you make becomes a [[rule]] that all [[agent|agents]], in every project, read from one shared base prompt.

## 1. The loop

All the work follows one cycle of six stages:

1. **You ask** for work in plain words, saying what done looks like.
2. **The [[agent]] works**, then **replies** in the [[response]] table.
3. When it needs a choice from you, it writes a proposed [[adr|ADR]] and **asks** it in the question dialog.
4. **You pick** an option. Your pick is written into the [[adr|ADR]], and its [[rule]] is in force.
5. The base prompt is rebuilt, so **every [[agent]]** follows the new [[rule]] from its next session.
6. When an [[agent]] passes part of the work to another [[agent]], it **hands over a [[contract]]**, and the result comes back against it.

You decide once, and the decision reaches every [[agent]] without you repeating it. Nothing depends on an [[agent]] remembering an earlier conversation, because the [[rule|rules]] live in files, not in chat history.

## 2. Three standards, and why they fit

The formats are built from three established standards. Each does one job.

| Standard | Its job here | Why it fits |
| --- | --- | --- |
| [[ears\|EARS]] (Easy Approach to Requirements Syntax) | Writing one [[rule]] | It forces every sentence into a trigger, an actor and a response ("When X, the agent does Y"). A [[rule]] in that shape can only be read one way, and anyone can see whether it was followed. |
| [[adr\|ADR]] (Architecture Decision Record) | Recording one decision | It keeps the question, the options, the choice and the reasons together in one short file. A year later you can still see why a [[rule]] exists, and a [[question]] is simply an ADR that hasn't been decided yet. |
| [[gherkin\|Gherkin]] (Given, When, Then) | Checking that work meets a [[rule]] | It turns a [[rule]] into concrete examples that run as tests. "Done" stops being a matter of opinion: either the [[scenario\|scenarios]] pass or they don't. |

They nest. Each option in an [[adr|ADR]] is one EARS [[rule]]. A [[spec]] is a list of EARS [[rule|rules]], each with Gherkin [[scenario|scenarios]] under it.

## 3. The grammar: terms, links and rules

Every format in section 4 is built from three parts. [[term|Terms]] fix what words mean, [[link|links]] point each word back to its meaning, and [[rule|rules]] are sentences made from those words.

### 3.1 Terms

Every word with a special meaning has a [[term]] note in the Terms folder: one file per word, holding a one-sentence definition and a few details. Here is the note for [[contract]]:

```markdown
---
notation: t-c7n2
type: entity
aliases: [work contract]
version: 1
status: approved
decided_by: "[[ADR-0009]]"
---
**Definition:** The [[spec]] one [[agent]] hands another as the whole of a [[job]]: its [[gherkin|Gherkin]] [[scenario|scenarios]] say what must be done and how it is checked, with no prose beside them.
```

The notation is a stable id that survives renaming, and the status says whether the word is approved for use. The type says what kind of word it is:

| Type | Meaning | Example |
| --- | --- | --- |
| actor | Someone or something that acts | [[agent]], [[person]], [[verifier]] |
| entity | A thing that exists and can be pointed at | [[spec]], [[adr]], [[rule]] |
| action | Something done | [[autocommit]] |
| problem | A recurring trouble the framework exists to fix | [[hard-to-judge]], [[long-replies]] |
| state | A condition that holds for a while | none yet |
| event | Something that happens at a moment | none yet |
| value | A quantity or setting | none yet |

Aliases are other words that mean the same thing. The decided_by line names the [[adr|ADR]] that introduced the word.

Each [[term]] note has its own version number, which goes up by one with every edit, and [[agent|agents]] always use the newest. The vault is a git repository, so each commit is also a snapshot of every note at once. To refer to the whole set as it stood at one moment, cite the commit.

Defining a word once means you and every [[agent]] read the same meaning. Undefined jargon is how a [[question]] ends up asking about something you never agreed to.

### 3.2 Links

Wherever a defined word appears, it is a [[link]] to its [[term]] note, so you can always check what it means. How the [[link]] looks depends on where you read it:

| Where you read it | How a link is written | Example |
| --- | --- | --- |
| Notes, specs and ADRs in the vault (Obsidian) | A wiki link | `[[contract]]` |
| An agent's reply in chat | A markdown link to the note's full path, because wiki links don't work in chat and a full path opens from any project | `[contract](C:/Users/you/agent-vault/Terms/contract.md)` |

Every instance gets a [[link]], not only the first, so a word is never ambiguous wherever you start reading.

### 3.3 Rules

A [[rule]] is one EARS sentence that names who acts, when, and what they do. It follows one of four patterns:

| Pattern | Use it for |
| --- | --- |
| When \<trigger>, \<actor> \<responds>. | Something that happens on an event |
| While \<state>, \<actor> \<responds>. | Something that holds while a state lasts |
| If \<unwanted condition>, \<actor> \<responds>. | Handling a failure |
| Where \<context or feature>, \<actor> \<responds>. | Something that applies only in some places |

For example: "When writing a reply, the agent uses a two-column table of up to four labelled rows (Done, Open, Needs you, Check), each a link or one short clause, in at most 8 rows." Rules are written in the present tense, as what happens, not what will happen.

Because each [[rule]] has a single actor, trigger and response, you can see in the [[agent]]'s next action whether it was followed. [[rule|Rules]] written as general advice tend to get repeated back to you but not acted on.

## 4. The format at each stage

Each stage of the loop where an [[agent]] produces something has one format, built from that grammar. A fixed format lets you judge the output at a glance, and lets it be checked automatically before you see it.

| Stage | What the agent produces | Format |
| --- | --- | --- |
| 2. Reply | A report on the work | The [[response]] table (4.1) |
| 3. Ask | A decision for you to make | A proposed [[adr\|ADR]], asked in the dialog (4.2) |
| 6. Hand over | Work for another [[agent]] | A [[contract]] (4.3) |
| When you ask for a check | A check of the work | A list of what will be tested, then a [[verdict]] (4.4) |

### 4.1 Replies: the response table

Every reply is a two-column table with up to four labelled rows, at most 8 rows in all. A row appears only when it has something to say.

| | |
| --- | --- |
| **Done** | Added, Changed, Fixed, Removed or Found … |
| **Open** | … is not started, not done or blocked |
| **Needs you** | Decide ADR-nnnn, Approve …, or Do … |
| **Check** | Run `command` or Open link → what you should see |

Long replies are tedious to review. This shape tells you what changed, what's left, what's waiting on you, and how to check it yourself, in a few lines. Read **Needs you** first: it's the only row that asks something of you. It is a table rather than a code block, so its links work. A reply that breaks the shape gets a ⚠ note saying how, and the [[agent]] is told to fix it.

### 4.2 Questions: a proposed ADR, asked in the dialog

When an [[agent]] needs you to decide, it writes a proposed [[adr|ADR]] in the Decisions folder and opens the question dialog built from it. Each line of the ADR has a place in the dialog:

| ADR line | What it holds | Example (ADR-0008) | In the dialog |
| --- | --- | --- | --- |
| Header | The ADR's id | ADR-0008 | The chip above the question |
| Given | At most two sentences: why the question came up, and which problem it serves | Most people ask an agent to "check your work" and expect it to know what that means. | The preview beside each option, with every term's definition |
| Decide | One question ending in "?" that names what changes for you, not only the mechanism | What must happen when a person asks for a check? | The question |
| Where A, B… | Two to four options, each one EARS [[rule]], then → what happens · what it costs | A: When asked for a check, the agent lists what it will test in a table, then confirms with you before checking. → you agree what a check covers · one confirmation step. B: When asked for a check, the agent writes what it will test as a spec, then confirms with you before checking. → the tests are kept for later · slower to set up. | One option each: the [[rule]] and its cost |
| Combines | Which options can be picked together; "exclusive" means pick one | exclusive | A single choice, or several boxes when options combine |
| Recommend | The [[agent]]'s pick and its reason | A: a check starts by agreeing what will be tested. | The first option, marked "(Recommended)" |
| (none) | | | Other: a free-text box under the options |

An [[agent]] asks only what it can't look up and has no sensible default for, and defines any new word as a [[term]] first, so the dialog can show its meaning. Every option follows the [[rule|rules]] already in force, and options differ only in the course of action they suggest. Each is the exact [[rule]] that goes into force, so you choose the wording itself, not a direction an [[agent]] will interpret later. The dialog works on desktop and on mobile. Only picking an option decides anything. Words typed into Other leave the [[question]] open: the [[agent]] reads them and asks again. [[agent|Agents]] never ask in chat, where a decision would scroll away unrecorded.

### 4.3 Handoffs: contracts in Gherkin

When one [[agent]] passes a [[job]] to another, it hands over a [[contract]]: a [[spec]] in which each [[requirement]] is an EARS [[rule]] on a Gherkin Rule line, with 1 to 3 [[scenario|scenarios]] under it.

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[person]] asks for a check, the [[verifier]] writes one [[verdict]].
  Scenario: a requested check gets a verdict
    Given a [[job]] whose change is ready
    When the [[person]] asks for a check
    Then one [[verdict]] is written
```

Every test traces to a [[requirement]] ID, and a bug gets a new [[requirement]] before its test is written. A [[spec]] stays a draft until every [[selector]] its [[scenario|scenarios]] use has a [[test-step|test step]]; only then is it approved.

A [[spec]] line may use only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and [[selector|selectors]]: fixed phrases such as "is written", each defined by a [[skill]] together with its [[test-step|test step]], the code that makes it run. The author picks one from a [[skill]] already present, and when none fits, proposes a new [[skill]] that defines it. Every other noun is a [[term]] [[link]]. The receiving [[agent]] answers with a [[result]] for each [[scenario]], with no prose.

Prose between [[agent|agents]] hides both what was asked and what came back. A [[contract]] settles both before the work starts, and its [[scenario|scenarios]] test the result afterwards.

### 4.4 Checks: agree what will be tested, then check

Most people simply ask an [[agent]] to "check your work". Before checking anything, the [[agent]] lists what it will test, in a compact table, and asks you to confirm:

| ID | Requirement | How it's tested |
| --- | --- | --- |
| REQ-001 | Saving a term bumps its version | Run the term-edit scenario; the file shows version 2 |
| REQ-002 | A reply over 8 rows is flagged | Run the reply-check scenario; a ⚠ note appears |

Once you confirm, a [[verifier]] that didn't make the change runs those checks and writes a [[verdict]]: pass or fail for each [[requirement]], with [[evidence]] and at most five [[finding|findings]].

Agreeing on the list first means a pass covers what you expected it to cover, and you can add anything that's missing before the check runs.

## 5. Asking for work

Say what outcome you want and how you'll know it's done, using the vault's own words. [[agent|Agents]] act on what they can check.

| You want | Say | What you get |
| --- | --- | --- |
| A task done | "Add X. It's done when `npm test` passes and the page shows Y." | The done-when becomes the Check row |
| Exact meaning | Defined words: [[spec]], [[rule]], [[contract]], [[verdict]], [[job]] | No guessing, because each word has one note |
| A checked result | "Check your work." | A table of what will be tested, to confirm, then a [[verdict]] |
| A standing behaviour | "Make this a rule: when X, the agent does Y." | A proposed [[adr\|ADR]] in the dialog; once you pick it, every [[agent]] follows it |
| To change a rule | "Revise ADR-0004 so that…" | A revising [[adr\|ADR]], not a quiet workaround |
| A one-off exception | "Just this once, …" | Nothing is recorded, and the [[rule]] stays as it is |
| Options to weigh | "Propose a decision on…" | A [[question]] with each option written as a [[rule]] with its cost |
| A long explanation | "Write it up as a doc" or "…as a note in the vault" | A document, since replies stop at 8 rows |
| To answer waiting questions | Run `/decisions`, then send any message | The [[agent]] asks them in the dialog |

Pitfalls to avoid:

| Pitfall | What happens | Instead |
| --- | --- | --- |
| Vague asks ("clean it up") | The [[agent]] guesses what done means | Say what done looks like, as something you can run or open |
| Typing a rule into Other | It isn't in force until it's asked again as an option | Pick an option, or ask for a revised [[question]] |
| Reopening a settled point | [[agent\|Agents]] won't reopen it on their own | Ask for a revising [[adr\|ADR]] by number |
| A rule that only describes setup | It's kept out of the base prompt | Phrase it as something an [[agent]] does |
| Editing Base.md or CLAUDE.md | Your edit is overwritten at the next rebuild | Change the decision behind it |

## 6. One prompt for every agent and project

Every [[agent]] reads the same base prompt, generated from this vault. Setting it up takes two env settings.

### 6.1 Setup

Set these in your shell, or in the `env` block of `~/.claude/settings.json`:

| Setting | Value | Example |
| --- | --- | --- |
| `AGENT_VAULT` | The folder holding this vault | `C:/Users/you/Documents/Projects/personal/agent-vault` |
| `AGENT_WORKSPACES` | The folders that hold your projects, separated by `;` | `C:/Users/you/Documents/Projects;D:/clients` |

From then on, each workspace folder gets a CLAUDE.md holding the base prompt. The vault itself gets Base.md (the same prompt, to read), Docs.md (the [[rule|rules]] and [[term|terms]] as one document) and Index.md (a map of every note). All four are generated: don't edit them.

### 6.2 Which agents read it

| Agent | Reads the prompt? |
| --- | --- |
| A Claude Code session in any folder under a workspace | Yes. Claude Code reads every CLAUDE.md from the session's folder up, so it finds the workspace's. |
| A session or subagent that session starts | Yes, for the same reason. Its work arrives as a [[contract]]. |
| Another agent tool, such as Codex | Only if its own instruction file (AGENTS.md for Codex) points at Base.md. Add that line yourself for now. |
| A session outside every workspace | No. Add its folder to `AGENT_WORKSPACES`. |

### 6.3 Rules for one project

A project under a workspace can add its own [[term|terms]] and [[rule|rules]] in a `vault` folder at its root. Where a project's note and a shared note have the same name, the project's wins, in that project only.

```
Documents/Projects/              ← a workspace
└── shop-app/                    ← a project
    ├── src/
    └── vault/
        └── Terms/
            ├── sku.md           ← new here: "A stock-keeping unit: one sellable variant of a product."
            └── job.md           ← replaces the shared "job", in shop-app only
```

### 6.4 Changing a rule

Change a [[rule]] by deciding an [[adr|ADR]], never by editing the generated files. They are rebuilt within seconds, and each session picks up the change when it next starts.

When an [[adr|ADR]] that amends another is decided, the old one moves to the Archive and the new one takes its number, so the Decisions folder always reads as one numbered list with no gaps.
