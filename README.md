# agent-vault

A set of agent best practices you can adopt as a whole: how you ask agents for work, how they reply, how they ask you to decide, and how they hand work to each other. Every rule is a decision record in this repo, and one base prompt generated from them is what every agent reads.

Start with the [Cheat sheet](Cheat%20sheet.md). It walks through the whole loop and explains why each format was chosen.

## What's here

| Path | What it holds |
| --- | --- |
| [Decisions](Decisions) | The rules in force, one ADR each, numbered in order |
| [Terms](Terms) | The vocabulary: one note per defined word |
| [Templates](Templates) | Starting points for a question (ADR), a response, a spec and a term |
| [Specs](Specs) | Contracts: Gherkin specs that agents hand each other |
| [Base.md](Base.md) | The base prompt every agent reads, generated from Decisions and Terms |
| [Docs.md](Docs.md), [Index.md](Index.md) | The same rules and terms as a numbered document, and a map of every note |
| [Archive](Archive) | Superseded drafts, kept as history |
| `.plugins` | The Claude Code module that applies the rules (below) |

## Adopt it

1. Clone the repo anywhere, for example `~/agent-vault`.
2. Set two env settings, in your shell or in the `env` block of `~/.claude/settings.json`:

   | Setting | Value | Example |
   | --- | --- | --- |
   | `AGENT_VAULT` | Where you cloned this repo | `C:/Users/you/agent-vault` |
   | `AGENT_WORKSPACES` | The folders that hold your projects, separated by `;` | `C:/Users/you/Projects;D:/clients` |

   ```json
   {
     "env": {
       "AGENT_VAULT": "C:/Users/you/agent-vault",
       "AGENT_WORKSPACES": "C:/Users/you/Projects;D:/clients"
     }
   }
   ```

3. Install the module in Claude Code:

   ```
   /plugin marketplace add C:/Users/you/agent-vault/.plugins
   /plugin install decision-cards@agent-vault
   ```

4. Start a session in any project under one of your workspaces. Its CLAUDE.md and AGENTS.md now carry the base prompt.

| Module | What it does |
| --- | --- |
| decision-cards | Writes the base prompt into a CLAUDE.md and an AGENTS.md at each workspace, and into Base.md, Docs.md and Index.md. Asks proposed ADRs in the native question dialog and records your pick. Checks each reply and question against the rules. |

Codex and other tools that read AGENTS.md get the base prompt from the same workspace file. A tool with a different instruction file needs a line pointing at [Base.md](Base.md).

## Change a rule

Ask an agent to "revise ADR-nnnn so that…". It writes a proposed ADR and asks it in the question dialog. When you pick an option, the rule is in force everywhere at each agent's next session. An ADR that amends another takes its place, and the list is renumbered so it stays in order with no gaps (ADR-0010).
