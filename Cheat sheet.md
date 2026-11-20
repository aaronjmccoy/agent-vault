# Working with agents through questions and responses

As of 2026-11-20. Online copy: https://claude.ai/artifact/E13ccGAX3ufLPkkmt1UzM9

You and your [[agent|agents]] talk in a few fixed formats, one for each step of the work. You ask for work in plain words. An [[agent]] replies in a short table, asks you to decide through the question dialog, and hands work to other [[agent|agents]] as Gherkin [[contract|contracts]]. Every decision you make becomes a [[rule]] that all [[agent|agents]], in every project, read from one shared base prompt.

## 1. The loop

All the work follows one cycle:

1. **You ask** for work in plain words, saying what done looks like.
2. **The [[agent]] works**, then **replies** in the [[response]] table.
3. When it needs a choice from you, it writes a proposed [[adr|ADR]] and **asks** it in the question dialog.
4. **You pick** an option. Your pick is written into the [[adr|ADR]], and its [[rule]] is in force.
5. The base prompt is rebuilt, so **every [[agent]]** follows the new [[rule]] from its next session.
6. When an [[agent]] passes part of the work to another [[agent]], it hands over a [[contract]], and the result comes back against it.

You decide once, and the decision reaches every [[agent]] without you repeating it. Nothing depends on an [[agent]] remembering an earlier conversation, because the [[rule|rules]] live in files, not in chat history.

## 2. Three standards, and why they fit

The formats are built from three established standards. Each does one job.

| Standard | Its job here | Why it fits |
| --- | --- | --- |
| [[ears\|EARS]] (Easy Approach to Requirements Syntax) | Writing one [[rule]] | It forces every sentence into a trigger, an actor and a response ("When X, the agent shall Y"). A [[rule]] in that shape can only be read one way, and anyone can see whether it was followed. |
| [[adr\|ADR]] (Architecture Decision Record) | Recording one decision | It keeps the question, the options, the choice and the reasons together in one short file. A year later you can still see why a [[rule]] exists, and a [[question]] is simply an ADR that hasn't been decided yet. |
| [[gherkin\|Gherkin]] (Given, When, Then) | Checking that work meets a [[rule]] | It turns a [[rule]] into concrete examples that run as tests. "Done" stops being a matter of opinion: either the [[scenario|scenarios]] pass or they don't. |

They nest. Each option in an [[adr|ADR]] is one EARS [[rule]]. A [[spec]] is a list of EARS [[rule|rules]], each with Gherkin [[scenario|scenarios]] under it. So the same sentence you pick in a [[question]] is the sentence that gets tested.

## 3. Each step's format

Each step has one format. A fixed format lets you judge an [[agent]]'s output at a glance, and lets the output be checked automatically before you see it.

### 3.1 Words: terms and links

Every word with a special meaning has a [[term]] note in the Terms folder: one file per word, holding a one-sentence definition and a few details. Here is the note for [[contract]]:

```markdown
---
type: entity
aliases: [work contract]
version: 1
decided_by: "[[ADR-0012]]"
---
**Definition:** The spec one agent hands another as the whole of a job: its
Gherkin scenarios say what must be done and how it is checked, with no prose
beside them.
```

The type says what kind of word it is: an actor that does things, an entity that exists, an action, and so on. Aliases are other spellings that mean the same thing. The version goes up by one whenever the definition is changed, and [[agent|agents]] always use the newest version. The decided_by line names the [[adr|ADR]] that introduced the word.

Wherever a defined word appears, it is written as a [[link]] to its note. In notes, [[spec|specs]] and [[adr|ADRs]] that's `[[contract]]`. In chat, where those links don't work, it's a normal link to the file, such as `[contract](Terms/contract.md)`.

Defining a word once, and linking it every time, means you and every [[agent]] read the same meaning. Undefined jargon is how a [[question]] ends up asking about something you never agreed to.

### 3.2 Rules: EARS sentences

A [[rule]] is one EARS sentence that names who acts, when, and what they shall do. For example, ADR-0004's [[rule]]: "When an agent replies to a person, the agent shall use four labelled lines (Done, Open, Needs you, Check), each a link or one short clause, in at most 8 lines."

| Pattern | Use it for |
| --- | --- |
| When \<trigger>, the \<actor> shall \<response>. | Something that happens on an event |
| While \<state>, the \<actor> shall \<response>. | Something that holds while a state lasts |
| If \<unwanted condition>, then the \<actor> shall \<response>. | Handling a failure |
| Where \<context or feature>, the \<actor> shall \<response>. | Something that applies only in some places |

Because each [[rule]] has a single actor, trigger and response, you can see in the [[agent]]'s next action whether it was followed. [[rule|Rules]] written as general advice tend to get repeated back to you but not acted on.

### 3.3 Questions: a proposed ADR, asked in the dialog

When an [[agent]] needs you to decide, it writes a proposed [[adr|ADR]] in the Decisions folder and opens the question dialog built from it. Each line of the ADR has a place in the dialog:

| ADR line | What it holds | Example (ADR-0011) | In the dialog |
| --- | --- | --- | --- |
| Header | The ADR's id | ADR-0011 | The chip above the question |
| Given | Why the question came up, and which problem it serves | Most people ask an agent to "check your work" and expect it to know what that means. | The preview beside each option, with every term's definition |
| Decide | One question ending in "?" | What must happen when a person asks for a check? | The question |
| Where A, B… | One EARS [[rule]] per option, then → what happens · what it costs | A: the agent first lists what it will test and confirms it with you, then checks. → you see what "checked" covers · one more step | One option each: the [[rule]] and its cost |
| Recommend | The [[agent]]'s pick and its reason | A: a check starts by agreeing what will be tested. | The first option, marked "(Recommended)" |
| Other | | | A free-text box under the options |

Every option is the exact [[rule]] that goes into force, so you choose the wording itself, not a direction an [[agent]] will interpret later. The dialog works on desktop and on mobile (ADR-0010). Only picking an option decides anything. Words typed into Other leave the [[question]] open: the [[agent]] reads them and asks again. [[agent|Agents]] never ask in chat, where a decision would scroll away unrecorded.

### 3.4 Responses: the response table

Every reply is a two-column table with up to four labelled rows, at most 8 rows in all. A row appears only when it has something to say.

| | |
| --- | --- |
| **Done** | Added, Changed, Fixed, Removed or Found … |
| **Open** | … is not started, not done or blocked |
| **Needs you** | Decide ADR-nnnn, Approve …, or Do … |
| **Check** | Run `command` or Open link → what you should see |

Long replies are tedious to review. This shape tells you what changed, what's left, what's waiting on you, and how to check it yourself, in a few lines. Read **Needs you** first: it's the only row that asks something of you. It is a table rather than a code block, so its links work. A reply that breaks the shape gets a ⚠ note saying how, and the [[agent]] is told to fix it.

### 3.5 Handoffs: contracts in Gherkin

When one [[agent]] passes a [[job]] to another, it hands over a [[contract]]: a [[spec]] in which each [[requirement]] is an EARS [[rule]] on a Gherkin Rule line, with 1 to 3 [[scenario|scenarios]] under it.

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[person]] asks for a check, the [[verifier]] shall write one [[verdict]].
  Scenario: a requested check gets a verdict
    Given a [[job]] whose change is ready
    When the [[person]] asks for a check
    Then one [[verdict]] is written
```

The receiving [[agent]] answers with a [[result]] for each [[scenario]], with no prose (ADR-0012). A [[spec]] line may use only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and approved [[selector|selectors]]. Every other noun is a [[term]] [[link]] (ADR-0002, ADR-0003).

Prose between [[agent|agents]] hides both what was asked and what came back. A [[contract]] settles both before the work starts, and its [[scenario|scenarios]] test the result afterwards.

### 3.6 Checks: agree what will be tested, then check

Most people simply ask an [[agent]] to "check your work". Before checking anything, the [[agent]] lists what it will test, in a compact table, and asks you to confirm (ADR-0011):

| ID | Requirement | How it's tested |
| --- | --- | --- |
| REQ-001 | Saving a term bumps its version | Run the term-edit scenario; the file shows version 2 |
| REQ-002 | A reply over 8 rows is flagged | Run the reply-check scenario; a ⚠ note appears |

Once you confirm, a [[verifier]] that didn't make the change runs those checks and writes a [[verdict]]: pass or fail for each [[requirement]], with [[evidence]] and at most five [[finding|findings]].

Agreeing on the list first means a pass covers what you expected it to cover, and you can add anything that's missing before the check runs.

## 4. Asking for work

Say what outcome you want and how you'll know it's done, using the vault's own words. [[agent|Agents]] act on what they can check.

| You want | Say | What you get |
| --- | --- | --- |
| A task done | "Add X. It's done when `npm test` passes and the page shows Y." | The done-when becomes the Check row |
| Exact meaning | Defined words: [[spec]], [[rule]], [[contract]], [[verdict]], [[job]] | No guessing, because each word has one note |
| A checked result | "Check your work." | A table of what will be tested, to confirm, then a [[verdict]] |
| A standing behaviour | "Make this a rule: when X, the agent shall Y." | A proposed [[adr\|ADR]] in the dialog; once you pick it, every [[agent]] follows it |
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
| A rule that only describes setup | It's kept out of the base prompt (ADR-0008) | Phrase it as something an [[agent]] does |
| Editing Base.md or CLAUDE.md | Your edit is overwritten at the next rebuild | Change the decision behind it |

## 5. One prompt for every agent and project

The [[rule|rules]] reach every [[agent]] through one generated base prompt. You never copy it by hand.

### 5.1 Configure the paths

Two env settings, set in your shell or in the `env` block of `~/.claude/settings.json`, say where things are:

| Setting | What it is | Example |
| --- | --- | --- |
| `AGENT_VAULT` | The folder holding this vault | `C:/Users/you/Documents/Projects/personal/agent-vault` |
| `AGENT_WORKSPACES` | One or more folders that hold your projects, separated by `;` | `C:/Users/you/Documents/Projects;D:/clients` |

### 5.2 Where the prompt comes from

The vault is the single source. Its Decisions and Terms are turned into these files:

| File | What it is | Who reads it |
| --- | --- | --- |
| Base.md | The base prompt: the [[rule\|rules]] in force, the [[response]] and [[question]] formats, and the [[term\|terms]] | You, as the readable copy |
| `CLAUDE.md` in each workspace | The same base prompt | Every Claude Code session in a folder under that workspace |
| Docs.md | The [[rule\|rules]] and [[term\|terms]] as one numbered document | You |
| Index.md | A map of every note | You, in Obsidian |

Three [[rule|rules]] are records rather than instructions (ADR-0006 to ADR-0008). They appear in Docs.md but not in the base prompt.

### 5.3 How each kind of agent gets it

| Agent | How it reads the prompt | What you do |
| --- | --- | --- |
| A Claude Code session in a project under a configured workspace | Claude Code loads the CLAUDE.md files in the session's folder and every folder above it, so it finds the workspace's file (ADR-0007). | Keep the project under a configured workspace |
| A session or subagent started by that session | It works in the same folder, so it reads the same CLAUDE.md. The work itself arrives as a [[contract]] (ADR-0012). | Nothing |
| A project under a configured workspace that has its own rules | Its own `vault/Decisions` and `vault/Terms` are layered over the shared vault, and its note wins where both define the same name (ADR-0005). | Add notes to the project's `vault/` folder (example below) |
| A different agent tool (Codex, for example) | It reads its own instruction file, such as AGENTS.md, not CLAUDE.md | Point that file at Base.md. This isn't automated yet |
| A session outside every configured workspace | It doesn't load the base prompt | Add its folder to `AGENT_WORKSPACES` |

### 5.4 Example: a project's own vault

A shop app under the `Documents/Projects` workspace defines a word the shared vault doesn't have, and gives its own meaning to one that it does:

```
Documents/Projects/              ← a configured workspace (its CLAUDE.md holds the base prompt)
└── shop-app/                    ← a project
    ├── src/
    └── vault/
        └── Terms/
            ├── sku.md           ← new here: "A stock-keeping unit: one sellable variant of a product."
            └── job.md           ← replaces the shared "job" in this project only
```

Sessions in `shop-app` read every shared [[term]] and [[rule]], plus `sku`, and use the project's meaning of [[job]]. Sessions in other projects never see either. A `vault/Decisions` folder works the same way for [[rule|rules]] that apply to this project only.

### 5.5 Keeping it current

Change a [[rule]] by deciding an [[adr|ADR]], never by editing the generated files. They are rebuilt within seconds, and each session picks them up at its next start.

When an [[adr|ADR]] that amends another is decided, the amended one moves to the Archive and the new one takes its place. The [[adr|ADRs]] in force are then renumbered so they run in order with no gaps, and every [[link]] to them is updated (ADR-0013). The Decisions folder always reads as one finished list.
