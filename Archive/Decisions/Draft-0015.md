---
id: Draft-0015
status: superseded
scope: agents/process
superseded_by: ADR-0007
---
Given     The [[rule|rules]] in force reach only this session: the Decisions panel is a development mod loaded here alone, so your fork had no checks and no [[rule|rules]]. That is [[rules-not-landing]] in every other session you start.
Decide    How should the [[rule|rules]] reach every Claude Code session you start?

Where A:  When a Claude Code session starts, the decision-cards mod shall load in it, installed once as a user plugin from a folder you keep.
          → every session gets the panel, the checks and the [[rule|rules]] in its prompt · you install it once, and updates come from that folder
Where B:  When a Claude Code session starts, the [[agent]] shall read the [[rule|rules]] in force from a generated file in your user settings folder.
          → nothing to install · the [[rule|rules]] arrive as text only, and nothing checks [[response|replies]] or [[question|questions]]
Combines  A and B combine: B also reaches tools that read that file but run no mods.
Recommend A: only the mod checks that the [[rule|rules]] are followed; text alone is how they stopped landing before.

Decision  Other
Request   I want these guidelines to be a base prompt that all agents under the shared workspace follow, the decisions panel is just one part
