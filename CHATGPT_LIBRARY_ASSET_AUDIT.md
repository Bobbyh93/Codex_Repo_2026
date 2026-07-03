# ChatGPT Library Asset Audit

Date: July 3, 2026

## Access Check

- In-app Browser: not signed in; `https://chatgpt.com/library?tab=files` redirects to the public ChatGPT home page.
- Chrome profile: signed in; files library opens at `https://chatgpt.com/library?tab=files`.
- Project links resolve in signed-in Chrome:
  - Nursing Education Concepts and Topics
  - RN Review - Visual Topic Guides

## Visible Files Library Candidates

The visible files tab shows recent files that should be treated as reference-pack candidates, not source truth:

| File or family | Observed type | Product use candidate |
| --- | --- | --- |
| `skill(21).zip` | ZIP | Skill/reference pack candidate for source-contract or agent workflow review. |
| `harrity_lesson_builder_audio_feature_20260623.zip` | ZIP | Harrity audio-feature reference pack candidate. |
| `learner_handout.md` | Markdown | Learner-facing handout pattern candidate. |
| `facilitator_guide.md` | Markdown | Faculty/facilitator notes pattern candidate. |
| `boots_to_bedside_agent_packet.zip` | ZIP | Agent packet / workforce pathway reference candidate. |
| `boots_to_bedside_agent_handoff.docx` and `boots_to_bedside_agent_handoff-1.docx` | Word | Agent handoff/reference candidate. |
| `2026-06-24_boots_to_bedside_va_pathfinder_application_pack.*` | DOCX/MD/ZIP | Non-nursing-source program packet; useful as document/packet workflow pattern. |
| `Solution_Generator_*` files | ZIP | Solution-generator workflow pattern candidates. |
| `VDIS_v1_*` files | XLSX/TXT/DOCX/PDF | Report/workbook package pattern candidates. |

## Visible Project/Chat Signals

The signed-in Chrome sidebar also shows relevant workspace anchors:

- Pinned: `Nursing Education Concepts and Topics`
- Pinned: `Lesson Builder Process`
- Pinned: `Full-Stack Nursing System`
- Pinned: `Harrity Lesson Builder Workflow`
- Projects: `A concept Based approach to nursing`
- Projects: `RN Review - Visual Topic Guides`
- Chats: `Master taxonomy completed for nursing content system`
- Chats: `Universal Nursing Content System plan outlined`
- Chats: `Branch · Instructor ATI Checklist` and related Instructor ATI Checklist entries

## Product Interpretation

ChatGPT library files should feed NurseStudy as a new `chatgpt_library_reference_pack` intake path:

1. Register visible file metadata as pending/reference-only source records.
2. Preserve origin as ChatGPT library, not Drive/local upload.
3. Classify each file as skill pack, lesson contract, learner handout, facilitator guide, packet/workbook/report pattern, or non-MVP reference.
4. Promote only reviewed files into source truth.
5. Keep project/chat links as workspace context until files can be exported or connected through an official API/path.

## Recommended Next Build

Add Source Studio support for ChatGPT library reference packs:

- Manual registration form for ChatGPT file title, file type, modified date, size, and project/chat context.
- Bulk paste/import field for a visible library inventory.
- Source kind: `chatgpt_library_reference_pack`.
- Approval default: `pending`.
- Citation policy default: `reference_only`.
- Metadata fields: `chatgptProject`, `chatgptConversation`, `assetFamily`, `candidateUse`, `requiresExport`.

## Known Limits

- The library page was inspected visually/DOM-only through signed-in Chrome; no files were downloaded.
- ChatGPT project pages did not expose a structured project file manifest in the visible page state.
- Any file contents still require export/download or another user-approved transfer path before NurseStudy can ingest chunks or citations.
