# Lesson Agent Audit

Audit date: 2026-06-26

## Result

Selected MVP agent: `agt_69f192d4f1908191baa41586bb0df9ea`

Reason: this agent is the most focused match for the NurseStudy Lesson Builder product path. It is a nursing curriculum production agent for source-grounded lesson packages, slide scaffolds, presenter notes, NCLEX/NGN items, remediation support, source anchors, taxonomy tags, and faculty review status. It has no unrelated live connector dependencies in the inspected draft, which makes it the cleanest API candidate for a server-side generation pipeline.

Current blocker: none of the audited agents currently has a live API channel. Endpoint-backed `agent_ready` cannot be verified until an API channel is created and published for the selected agent, then stored server-side as `NURSING_CURRICULUM_AGENT_ENDPOINT` with an appropriate server-side key.

API-channel attempt: staging an API channel for the selected agent through the Workspace Agents connector returned `upsert_api_channel_failed`. No live endpoint was created in that attempt.

## Audit Table

| Agent ID | Name | Classification | API Channel | MVP Fit |
| --- | --- | --- | --- | --- |
| `agt_69f192d4f1908191baa41586bb0df9ea` | Nursing Curriculum Builder Agent | `primary_candidate` | Missing | Best fit for source-grounded lesson packages and review packs. |
| `agt_69f18b9441248191b26043ffe71a3ad1` | Nursing Curriculum Builder Agent | `supporting_candidate` | Missing | Strong builder, includes presentation-package support, but has more connector/dependency surface. |
| `agt_69eacf4c03dc8191b0de2b4d2dd59dc1` | Nursing Curriculum Supervisor | `supporting_candidate` | Missing | Good supervisory/planning layer, less focused on strict package production. |
| `agt_69e9650a7848819195bc7c67d42d8ad2` | Nursing Curriculum Architecture Planner | `not_lesson_builder` | Missing | Architecture and build sequencing, not the generation worker. |
| `agt_69eac845c7148191abce7d8829f97c4e` | SQL Crafter | `not_lesson_builder` | Missing | SQL and uploaded-document planning scope, not lesson package generation. |
| `agt_69eac95f60bc81919265dd4f3caadc00` | Nursing Curriculum Planner | `not_lesson_builder` | Missing | Task planning and commitments, not content generation. |
| `agt_69f18b1ccbf48191bf0c6c8bbf037055` | Knowledge Search Agent | `not_lesson_builder` | Missing | Workspace search and synthesis, useful for source discovery but not package generation. |

## Implementation Decision

NurseStudy now defaults `NURSING_CURRICULUM_AGENT_ID` to the selected builder agent. Production can override that value server-side without code changes.

Direct `OPENAI_API_KEY` generation is an accepted live drafting path when no workspace-agent endpoint exists. In that state health should report `openai_chat_completions_ready`; successful generation should also be visible in package metadata as `agent_assisted` with no deterministic fallback.

## Next Live-Agent Step

Create and publish one API channel for `agt_69f192d4f1908191baa41586bb0df9ea`, then store these server-side only:

- `NURSING_CURRICULUM_AGENT_ENDPOINT`
- `NURSING_CURRICULUM_AGENT_API_KEY`

After restart, `/api/admin/lesson-builder/agent-status` should report the selected agent ID, endpoint configured, authorization configured, and `agent_ready`.
