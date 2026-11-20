# reference-guide

A panel for browsing and editing the agent-vault base system: its rules in force, its glossary of terms, and its docs. It reads the same vault the base prompt is generated from. How that system works, from asking for work to how the prompt reaches every agent, is covered in the vault's [Cheat sheet](../../Cheat%20sheet.md).

## Use

Run `/ref-guide`. The panel opens beside the chat, with three tabs:

| Tab | Shows |
| --- | --- |
| Rules | The rules in force, in ADR order: the project's own first, then the base prompt's. Each opens its decision record. |
| Terms | The glossary: search, jump by first letter, filter by type. |
| Docs | Rules and terms as one numbered document, with search. |

Links between notes open the linked note, and ← → step back and forward. A pencil (✎) edits a term's definition or a rule's wording in place, saved as a new version. **Open the file** opens the note in its default app for bigger edits. Panels are drawn on desktop and in the terminal. Where none can be drawn, read Docs.md in the vault.

## Setup

| Setting | Where | Default |
| --- | --- | --- |
| `AGENT_VAULT` | Env (your shell, or the `env` block of `~/.claude/settings.json`) | none |
| `vaultDir` | This module's options; `AGENT_VAULT` wins over it | none |
| `projectVault` | This module's options: the folder inside a project whose Decisions and Terms are layered over the vault | `vault` |

Install it from the vault's marketplace, `.plugins` in the repo: `/plugin install reference-guide@agent-vault`.
