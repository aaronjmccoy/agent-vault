# Working with agents through questions and responses

As of 2026-11-20. Online copy: https://claude.ai/artifact/E13ccGAX3ufLPkkmt1UzM9

You and your agents talk in a few fixed formats, one for each step. You ask for work in plain words. Agents reply in a small table, ask you to decide through a question dialog, and hand work to each other as Gherkin contracts. Every decision you make becomes a rule that all agents, in all projects, read from one shared base prompt.

## 1. The loop

Everything follows one cycle:

1. **You ask** for work, in plain words with a done-when.
2. **The agent works** and **replies** in the response table.
3. If it needs a choice from you, it writes a **proposed ADR** and **asks** it in the question dialog.
4. **You pick** an option. The mod writes your pick into the ADR, and its rule is **in force**.
5. The mod rebuilds the **base prompt**, so **every agent** follows the new rule from its next session.
6. When an agent hands part of the work to another agent, it hands over a **contract**, and the result comes back against it.

Why a loop: you decide once, and the decision reaches every agent on its own. You don't repeat yourself, and nothing depends on an agent remembering a conversation.

## 2. The formats, step by step

Each step has one format. A fixed format is what lets you judge an agent's output quickly, and what lets the mod check it before you see it.

### 2.1 Words: terms and links

**Looks like:** a note in Terms holding one sentence, `**Definition:** …`. Text links each defined word: `[[spec]]` in notes, specs and ADRs, and `[spec](Terms/spec.md)` in chat.

**Why:** a word with one written meaning can't be misread. Undefined jargon is where questions turn cryptic and intent goes missing. Every instance is linked, so you can always check what a word means. Changing a definition bumps its version, and agents use only the newest.

### 2.2 Rules: EARS sentences

**Looks like:** one sentence naming who acts, when, and what they shall do.

| Pattern | Use it for |
| --- | --- |
| When \<trigger>, the \<actor> shall \<response>. | Something that happens on an event |
| While \<state>, the \<actor> shall \<response>. | Something that holds while a state lasts |
| If \<unwanted condition>, then the \<actor> shall \<response>. | Handling a failure |
| Where \<context or feature>, the \<actor> shall \<response>. | Something that applies only in some places |

**Why:** an EARS sentence has one actor, one trigger and one response, so you can see whether it was followed. A rule an agent can only recite, and never visibly apply, doesn't count.

### 2.3 Questions: a proposed ADR, asked in the dialog

**Looks like:** the agent writes a file in Decisions, then opens the client's question dialog built from it.

```
Given     why the question came up, and which problem it serves
Decide    one question ending in "?"
Where A:  the rule option A would put in force (EARS)
          → what happens · what it costs
Where B:  …
Combines  whether options can be mixed
Recommend A: the agent's pick, with a one-line reason
```

In the dialog, the header is the ADR id, each option's description is its rule and cost, the recommended option comes first, and the preview shows the Given with the definition of each term it uses.

**Why:** every option is the exact rule that goes into force, so you choose wording, not a vague direction. The dialog works on desktop and mobile (ADR-0010). Only an option you pick decides anything. Words you type in Other leave the question open, and the agent reads them and asks again. Agents never ask in chat, where a decision would be lost.

### 2.4 Responses: the response table

**Looks like:** a two-column table, one row per labelled line, at most 8 rows, each row only when it has something to say.

| | |
| --- | --- |
| **Done** | Added, Changed, Fixed, Removed or Found … |
| **Open** | … is not started, not done or blocked |
| **Needs you** | Decide ADR-nnnn, Approve …, or Do … |
| **Check** | Run `command` or Open link → what you should see |

**Why:** long replies are tedious to review. The table says what changed, what's left, what waits on you, and how to verify it yourself. Read **Needs you** first. A missing row means there was nothing to say. It's a table, not a code block, so links work. If a reply breaks the shape, a ⚠ note says how, and the agent is told.

### 2.5 Handoffs: contracts in Gherkin

**Looks like:** when one agent hands a job to another, it hands over a spec. Each requirement is an EARS rule on a Gherkin Rule line, with 1–3 scenarios under it, and the scenarios run as tests.

```gherkin
Feature: [[verdict]]

Rule: REQ-001 When a [[person]] asks for a check, the [[verifier]] shall write one [[verdict]].
  Scenario: a requested check gets a verdict
    Given a [[job]] whose change is ready
    When the [[person]] asks for a check
    Then one [[verdict]] is written
```

The receiving agent answers with a result for each scenario, with no prose (ADR-0012). A spec line uses only EARS and Gherkin keywords, the operators is, equals, above, below, within, contains and not, and approved selectors. Every other noun is a `[[term]]` link (ADR-0002, ADR-0003).

**Why:** prose between agents hides what was asked and what came back. A contract fixes both before the work starts, and the scenarios check it afterwards.

### 2.6 Checks: verdicts on request

**Looks like:** you say "check this against its spec". A verifier that didn't write the change checks it and writes a verdict: pass or fail for each requirement, with evidence and at most five findings (ADR-0011).

**Why:** a check by a separate agent, against the contract, is the fastest way to trust work you can't read line by line.

## 3. Asking for work

Say what outcome you want and how you'll know it's done, in the vault's own words. Agents act on what they can check.

| You want | Say | What you get |
| --- | --- | --- |
| A task done | "Add X. It's done when `npm test` passes and the page shows Y." | The done-when becomes the Check row |
| Exact meaning | Use defined words: spec, rule, contract, verdict, job | No guessing; each word has one note |
| A checked result | "Check this against its spec." | A verdict from a verifier |
| A standing behaviour | "Make this a rule: when X, the agent shall Y." | A proposed ADR in the dialog; once picked, every agent follows it |
| To change a rule | "Revise ADR-0004 so that…" | A revising ADR, not a quiet workaround |
| A one-off exception | "Just this once, …" | Nothing recorded; the rule stands |
| Options to weigh | "Propose a decision on…" | A question with each option as a rule and its cost |
| A long explanation | "Write it up as a doc" or "…as a note in the vault" | A document, since replies stop at 8 rows |
| To answer waiting questions | Run `/decisions`, then send any message | The agent asks them in the dialog |

Pitfalls to avoid:

| Pitfall | What happens | Instead |
| --- | --- | --- |
| Vague asks ("clean it up") | The agent guesses what done means | Say what done looks like, as something you can run or open |
| Typing a rule into Other | It isn't in force until it's asked again as an option | Pick an option, or ask for a revised question |
| Reopening a settled point | Agents won't reopen it on their own | Ask for a revising ADR by number |
| A rule that only describes setup | It's kept out of the base prompt (ADR-0008) | Phrase it as something an agent does |
| Editing Base.md or CLAUDE.md | Your edit is overwritten at the next refresh | Change the decision behind it |

## 4. One prompt for every agent and project

The rules reach every agent through one generated base prompt. You never copy it by hand.

### 4.1 Where it comes from

The shared vault (`Documents\Projects\personal\agent-vault`) is the single source. It holds Decisions, Terms, Specs and Templates. The decision-cards mod reads them and writes:

| File | What it is | Who reads it |
| --- | --- | --- |
| Base.md | The base prompt: rules in force, the response and question formats, the terms | Kept in the vault as the readable copy |
| `Documents\Projects\CLAUDE.md` | The same base prompt | Every Claude Code session in any folder under `Documents\Projects` |
| Docs.md | Rules and terms as one numbered document | You, and `/ref-guide` |
| Index.md | A map of every note | You, in Obsidian |

Three rules are records rather than instructions (ADR-0006 to ADR-0008). They appear in Docs.md and `/ref-guide`, but not in the base prompt.

### 4.2 How each kind of agent gets it

| Agent | How it reads the prompt | What you do |
| --- | --- | --- |
| A Claude Code session in a project under `Documents\Projects` | Claude Code loads CLAUDE.md files from the session's folder and its parents, so it finds the workspace file (ADR-0007). The mod also adds the current rules to the system prompt each turn and checks replies and questions. | Keep the project under `Documents\Projects` |
| Another session or subagent it starts | Same folder, same CLAUDE.md. The work itself arrives as a contract (ADR-0012). | Nothing |
| A project with its own rules | Its `vault/Decisions` and `vault/Terms` are layered over the shared vault, and a project note wins over a shared one with the same name (ADR-0005). | Add notes in `<repo>/vault/` |
| A different agent tool (Codex, for example) | It reads its own instruction file, such as AGENTS.md, not CLAUDE.md | Point that file at Base.md. This isn't automated yet |
| A session outside `Documents\Projects` | It doesn't load the base prompt | Move the work under `Documents\Projects` |

### 4.3 Keeping it current

Change a rule by deciding an ADR, never by editing the generated files. The mod rebuilds them within seconds, and each session picks them up at its next start. The mod is installed from `agent-vault/.plugins` and runs only in sessions under the workspace folder.

## Appendix: commands and places

| Command | What it does |
| --- | --- |
| `/decisions` | Lists the ADRs waiting for you; send any message and the agent asks them in the dialog |
| `/ref-guide` | Opens the reference guide panel with Rules, Terms and Docs tabs. A pencil (✎) edits a term or rule in place; **Open the file** opens the note for bigger edits. On a surface with no panels, read Docs.md |

| What | Where | Edit it? |
| --- | --- | --- |
| Decisions (ADR-0001…) | agent-vault/Decisions | Yes: answer in the dialog, or edit the file |
| Terms | agent-vault/Terms | Yes |
| Specs | agent-vault/Specs | Yes |
| Templates (Question, Response, Spec, Term) | agent-vault/Templates | Yes |
| A project's own rules and terms | `<repo>/vault/Decisions`, `<repo>/vault/Terms` | Yes |
| Base.md, Docs.md, Index.md, workspace CLAUDE.md | agent-vault, `Documents\Projects` | No, they're generated |
| Old drafts | agent-vault/Archive | History only; agents don't read it |
