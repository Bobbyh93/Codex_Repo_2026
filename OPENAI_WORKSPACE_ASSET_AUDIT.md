# OpenAI Workspace Asset Audit

Date: July 3, 2026

## Summary

The OpenAI/ChatGPT workspace has a strong nursing-curriculum agent bench that should feed NurseStudy as a production system, not as scattered one-off chats. The verified asset stack is:

- OpenAI Platform projects for server-side API keys and runtime separation.
- Published ChatGPT/workspace agents for curriculum architecture, source audit, lesson building, remediation, planning, and knowledge search.
- Attached agent files and skills that include Harrity lesson contracts, taxonomy references, KIS schema/blueprint work, Rolladex/card templates, NGN builder kits, crosswalk materials, and source-governance documents.
- ChatGPT project links that appear directly related, but still require signed-in browser inspection before they can be promoted into the source registry.

## OpenAI Platform Targets

Verified through the OpenAI Platform connector:

- Organization: Harrity
  - Sim GPT
  - agent_name: NCLEX_MVP_Builder_Agent...
  - Project 1010
  - HARRITY_PROJECT
- Organization: Personal
  - Default project

Use a Harrity project for NurseStudy production keys. Keep keys server-side only. Do not expose project credentials to the browser.

## Workspace Agents

All listed agents were inspected through the Workspace Agents connector. No active API channel was found on any inspected agent, including published agents. This means the live Render app should keep using direct server-side OpenAI Chat Completions until an API channel is explicitly created and published for the chosen agent.

| Agent | Status | Best Use For NurseStudy | API Channel |
| --- | --- | --- | --- |
| Nursing Curriculum Builder Agent `agt_69f192d4f1908191baa41586bb0df9ea` | Published | Clean source-grounded lesson, item-bank, remediation, and faculty-review package generation contract | None |
| Nursing Curriculum Builder Agent `agt_69f18b9441248191b26043ffe71a3ad1` | Published | Richer builder with Drive/Notion/Calendar connectors plus presentation/SVG workflow; best candidate for future API-channel production agent | None |
| Nursing Curriculum Architecture Planner `agt_69e9650a7848819195bc7c67d42d8ad2` | Published | Full product architecture, KIS/schema planning, source-prep, chunking/indexing, crosswalks, launch readiness, mastery reporting | None |
| Nursing Curriculum Supervisor `agt_69eacf4c03dc8191b0de2b4d2dd59dc1` | Published | Curriculum decision memos, evidence synthesis, opportunity maps, rollout shaping, academic updates | None |
| Nursing Curriculum Planner `agt_69eac95f60bc81919265dd4f3caadc00` | Published | Task planning, commitment extraction, launch follow-ups, curriculum review prep | None |
| SQL Crafter `agt_69eac845c7148191abce7d8829f97c4e` | Published | Schema/query review, SQL drafting, uploaded-document curriculum planning | None |
| Knowledge Search Agent `agt_69f18b1ccbf48191bf0c6c8bbf037055` | Published | Cross-workspace search across Drive, Gmail, Calendar, Dropbox, and Notion-style sources | None |
| Bug Triage Copilot `agt_69f173b39cfc819194087c43ab357f88` | Not published | Future QA/issue triage helper | None |
| Unnamed agent `agt_69ffc1de10d48191ade7a04754e46c07` | Not published | Not currently product-relevant until named and scoped | None |

## Key Verified Agent Resources

### Builder Agent Resources

The richer Builder Agent includes files that should be treated as NurseStudy source contracts or reference packs:

- `standard_taxonomies.json`
- `source-register-template.md`
- `faculty-qa-checklist.md`
- `weekly_nursing_lesson_scaffold_starter_packet-1.docx`
- `harrity_scaffold_required_harness.py`
- `harrity_scaffold_required_harness_report.json`
- CKM standardized import, governance, SQL, release, and validation packages
- `build_package_1_control_plane_patch_v1.zip`
- `build_package_1_validation_report.json`

Recommended use: import these as read-only contract/reference source records. They should shape generation, QA, and export expectations, but not replace approved nursing source truth.

### Architecture Planner Resources

The Architecture Planner has the broadest product-system library:

- KIS blueprint, schema, dictionary, governance, adoption roadmap, and minimum entity set
- Rolladex/card templates and ETL runbook
- NGN Clinical Judgment Agent replication kit
- Nursing crosswalk agent runbook and skill package
- NCLEX guidebook PDF
- Performance report PDF
- Instructor manual folders and chapter assets
- Lesson Factory V4 artifacts
- Nursing education image asset starter CSV

Recommended use: use these to design the next NurseStudy data model and ingestion architecture. Source-governance review is required before any attached textbook/manual-derived content becomes learner-facing.

## ChatGPT Project Links

The user provided these ChatGPT project links:

- Nursing Education Concepts and Topics: `g-p-69def0f95a00819184e951302b7bf3fb`
- RN Review Visual Topic Guides: `g-p-69ec04c0536c8191bc57ab40151220e2`

Browser status:

- In-app browser was not signed into ChatGPT and redirected to login for project pages.
- The shared ChatGPT link resolved as `share_not_found` in the unsigned browser session.

Next step: inspect these links from a signed-in ChatGPT browser session, then register any useful project files, prompts, source maps, visual guides, and topic guides as NurseStudy `source_registry` records with `sourceKind=chatgpt_project_reference` or a similar non-authoritative reference type until source truth is confirmed.

## Product Integration Plan

1. Keep direct server-side OpenAI Chat Completions as the live MVP runtime until an agent API channel exists.
2. Choose one production agent candidate:
   - safest clean runtime contract: `agt_69f192d4f1908191baa41586bb0df9ea`
   - richer connected-source workflow: `agt_69f18b9441248191b26043ffe71a3ad1`
3. Create and publish a single API channel for the chosen agent when ready.
4. Store the resulting endpoint/trigger config server-side only.
5. Add NurseStudy health states:
   - `openai_chat_completions_ready`
   - `workspace_agent_channel_missing`
   - `workspace_agent_ready`
   - `agent_invalid_key`
6. Import verified agent file-tree resources as source contracts/reference packs.
7. Use Architecture Planner resources to guide the next schema/data-model sprint:
   - KIS-aligned source registry
   - concept/skill/entity cards
   - Data Chunker Pro source-pack import
   - ATI/syllabus-to-lesson assignment bridge
   - faculty review and evidence reporting

## MVP Implication

The OpenAI workspace already contains the blueprint for the full NurseStudy MVP. The live product should now unify:

- Lesson Builder Core from the current Render app
- ATI/remediation flows from Replit NurseStudy and Nurse Remediation Hub
- Source/RAG preparation from NursesBrain and Data Chunker Pro
- Curriculum objective mapping from SyllabusMapper
- Architecture/KIS/crosswalk planning from the Architecture Planner agent
- Lesson contracts and QA gates from the Builder Agents
- Premium review workflows from Pearson audit dashboards
- Visual/deck grammar from Drive decks and RN Review visual guides

The main blocker is not ideation. It is product consolidation: choose the authoritative runtime path, import the useful contracts/files, create a workspace-agent API channel if needed, and keep every learner-facing claim tied to approved source records.
