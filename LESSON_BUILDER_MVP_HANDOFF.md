# NurseStudy Lesson Builder MVP Handoff

## Current MVP Status

The DB-backed Lesson Builder path is functional locally and is the live Render product path for the internal pilot:

- Public-launch MFP acceptance is now recorded in `PUBLIC_LAUNCH_MFP_ACCEPTANCE.md`: internal pilot is accepted as the baseline, the public scope is a controlled visitor/capture entry plus the protected admin/learner workflow, and Replit/NursesBrain/Data Chunker/Drive assets remain supporting systems unless promoted through source approval.
- The public root now centers the nursing student learning interface: lesson library, featured published lesson, topic filters, guided notes, quizzes, rationales, citations, progress-friendly lesson structure, and source-backed study materials.
- Public pilot request review is optional operations support at `/pilot-request` and `/admin/pilot-requests`, not the main product surface.
- Student Study Workspace v1 adds anonymous browser-session progress without accounts: saved lessons, recent lessons, completed lessons, practice attempts, feedback counts, and a guided study pack.
- Admin Knowledge Base upload creates persisted document chunks.
- PowerPoint decks (`.pptx`) can be imported through Knowledge Base and Content Import. The extractor preserves numeric slide order, visible slide text, and speaker notes; Knowledge Base imports become chunked source material, while Content Import creates slide-level content blocks for Content Mapper review.
- Approved sources can generate a Harrity web lesson package.
- Topic Production is now the low-cost operator workspace for deciding where generated or processed content belongs before spending on richer media. Use `/admin/topic-production` to review each topic's concept, specialty/nursing subject, source/deck/study-guide assets, visuals slot, quiz slot, Airtable shorts row, cost guardrail, review state, student-preview state, and public-publish state.
- The first two topic-production starter packets are locally public in the preview workflow:
  - Maternal-Newborn Lesson Guide: 8 slides, 1 quiz item, 8 citations.
  - Pediatrics Asthma: 8 slides, 1 quiz item, 8 citations.
- Phase 2 topic-production catalog expansion is now represented locally as three mapped candidate rows, held for human review before media spend:
  - Postpartum Hemorrhage Priorities: Maternal-Newborn, Perfusion / Reproductive Health, Reduction of Risk Potential, Recognize Cues.
  - Newborn Assessment Cues: Maternal-Newborn, Health Promotion / Safety, Health Promotion and Maintenance, Recognize Cues.
  - Pediatric Emergency Priorities: Pediatrics, Safety / Clinical Judgment, Physiological Integrity, Prioritize Hypotheses.
- Phase 3 Human Review Pack is available at `/api/admin/topic-production-matrix/human-review-pack?format=json|csv` and on `/admin/topic-production`. It shows the two public starter lessons plus the three candidate topics, where each belongs, source/deck references, review decision, recommended decision, next owner action, hold triggers, and the no-media-spend guardrail.
- Phase 4 Media Pilot Pack is available at `/api/admin/topic-production-matrix/media-pilot-pack?format=json|csv` and on `/admin/topic-production`. It only includes topics with an approved Phase 3 placement and maps each approved topic to its slide deck plan, study guide plan, visual slot, quiz/rationale plan, narration script plan, source evidence, and future video status. It is a planning/export checkpoint only; video status remains `not_started_manual_approval_required` until a separate spend decision is made.
- Phase 4 Budget Gate is available at `/api/admin/topic-production-matrix/media-work-orders?format=json|csv` and on `/admin/topic-production`. It converts each approved media pilot row into a dollarized one-topic work order using the user's planning rate of 2,500 tokens = $100. The current first-topic work order is 3,500 tokens / $140. Admins can approve scaffold planning, request revision, or hold spend. `approve_single_topic_scaffold` approves only the one-topic planning pass; no batch generation, TTS, rendered video, or paid visual generation is approved.
- Phase 4 Scaffold Pack is available at `/api/admin/topic-production-matrix/media-scaffold-pack?format=json|csv` and on `/admin/topic-production` after a work order is approved for scaffold planning. It produces a deterministic, zero-AI-call outline for slide deck, study guide, visual storyboard, quiz/rationale, narration notes, and creator review checklist. It now has a scaffold-level creator decision gate: approve the next AI text-draft checkpoint, request revisions, or hold spend. It is still a review artifact only; no TTS, video rendering, batch generation, or paid visual generation is approved.
- Phase 5 Text Draft Pack is available at `/api/admin/topic-production-matrix/media-text-draft-pack?format=json|csv` and on `/admin/topic-production` after a scaffold is approved for the AI text-draft checkpoint. It organizes the first reviewable text for slides, study guide, visual brief, quiz/rationales, and narration script while still blocking TTS, rendered video, paid visuals, and batch generation. It now has a text-draft creator decision gate: approve lesson-package assembly checkpoint, request text revisions, or hold spend.
- Phase 6 Package Assembly Pack is available at `/api/admin/topic-production-matrix/package-assembly-pack?format=json|csv` and on `/admin/topic-production` after a text draft is approved for package assembly. It shows where the approved draft belongs in the learner package: lesson title, slide deck, guided notes, practice item, citations, learner surface, export package, and creator/human review gate. It is still a checkpoint only; no public publish, TTS, rendered video, paid visuals, or batch generation is approved.
- Phase 7 Review Blueprint is available at `/api/admin/topic-production-matrix/package-review-blueprint?format=json|csv` and on `/admin/topic-production` after package assembly is available. It expands the package plan into learner outcome, slide blueprint, guided notes, practice item, citation slots, visual placeholders, export files, creator checklist, expert questions, stop conditions, and next allowed action. It still blocks package publish, TTS, rendered video, paid visuals, and batch generation.
- Phase 8 Build Approval Gate is attached to the Phase 7 Review Blueprint through `/api/admin/topic-production-matrix/package-review-blueprint/:workOrderId/review` and the admin card buttons. It records whether the creator approves one deterministic unpublished review-package build, requests revisions, or holds spend. Even when approved, it does not approve public publish, TTS, rendered video, paid visuals, or batch generation.
- Phase 9 Review Package Build is available at `/api/admin/topic-production-matrix/review-package-builds?format=json|csv|zip` and on `/admin/topic-production` after Phase 8 approval. It creates the six-file deterministic review bundle (`review_manifest.json`, `learner_slides.md`, `guided_notes.md`, `practice_item.md`, `citations.md`, and `creator_review_checklist.md`) so the creator can inspect where AI-generated or processed content belongs before any publish/media spend.
- Phase 10 Review Package Promotion is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/promote` and the Phase 9 card button. It creates or returns one normal Lesson Builder package draft with learner slides, one practice item, citations, and creator-review manifest metadata. The promoted package remains `draft`, unpublished, and hidden from public lesson routes until a later explicit QA/publish checkpoint.
- Phase 11 Creator QA Gate is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/creator-qa` and the Phase 9 card button. It runs the existing Lesson Builder QA and Harrity contract validation against the promoted unpublished draft, records `ready_for_controlled_preview` or `needs_revision` in `manifest.topicProduction.creatorQaGate`, and keeps public publish, media, and batch generation blocked.
- Phase 12 QA Repair Gate uses the same `creator-qa` endpoint to repair the deterministic promoted draft's review-package citation anchors plus prediction/rationale learning moments before QA. The first target topic can now reach `ready_for_controlled_preview` and package status `qa_ready` while remaining hidden from public lesson routes.
- Phase 13 Controlled Preview Decision is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/controlled-preview-decision` and the Phase 9 card buttons. It approves, holds, or requests fixes for the QA-ready promoted draft, creates a preview-key URL only after approval, and keeps the ordinary public lesson URL hidden.
- Phase 14 Controlled Preview Review Outcome is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/preview-review` and the Phase 9 card buttons. It records whether the controlled preview is `ready_for_release`, `needs_fix`, or `hold_release` in the promoted draft manifest while public publish, media, and batch generation remain blocked.
- Phase 15 Public Release Decision Gate is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/public-release-decision` for review packages and `/api/admin/topic-production-matrix/drafts/:packageId/public-release-decision` for starter drafts. It records `approve_public_release`, `needs_fix`, or `hold_release`; only approval exposes the publish endpoint, and media/batch generation remains a separate decision.
- Phase 16 Release Audit Snapshot is available through `/api/admin/topic-production-matrix/drafts/:packageId/release-audit-snapshot` and the Final Publish Readiness card. It is read-only and summarizes learner-visible content, QA, citations, decisions, visibility, blockers, and guardrails before the final publish click.
- Phase 17 Publish Lock Confirmation requires the final publish request to include `confirmPublicPublish=true` and `confirmationText="I understand this makes the lesson public"`. Missing confirmation returns 400 without publishing; confirmed publish still depends on the existing QA, contract, release decision, and audit gates.
- Phase 18 Public Student Release Sanity is available through `/api/admin/topic-production-matrix/drafts/:packageId/student-release-sanity` and the Final Publish Readiness card. It is read-only and verifies the public learner payload after publish: mapped weak-topic labels, slides, guided notes, quiz/rationale, citations, completion/feedback support, and no admin-only internals.
- Phase 19 Student Lesson Workspace Polish makes `/lessons/:id` clearer for nursing students: study-path progress, mapped topic labels, deck/practice/guided-notes/citations jump controls, save/complete state, and quiz rationale reveal after answer selection.
- Phase 20 Student Home and Library Entry Polish makes `/` and `/student` the public learner handoff: topic tiles filter published lessons, the library opens `/lessons/:id`, and smoke coverage proves `/api/student/home` plus `/api/student/lessons` expose learner-safe labels, metrics, guided notes, citations, and trust signals for the published package.
- Phase 21 Student Workspace Event Loop proves the anonymous student workspace after handoff: save/open/slide/practice/complete/feedback events for a published lesson now feed `/api/student/progress` and `/api/student/study-pack` with completed counts, practice attempts, feedback, guided notes, rationales, citations, and the same learner URL.
- Topic Production exposes the Airtable `Viral Shorts Workflow` contract as a structured export path, but the current MFP uses it as a planning/checklist row first. Shorts/video/audio production should stay behind an explicit spend decision.
- Source detail now includes a NursesBrain-style normalization step for table/crosswalk signals, taxonomy hints, official pilot source status, and weak-topic metadata.
- Data Chunker Pro on the local workstation is the designated preprocessing path for large textbook and chapter PDFs: use it to create RAG-ready chunk files/folders, then register those outputs into NurseStudy with source provenance, approval state, and citation policy.
- Packages support edit, rebuild artifacts, QA, contract validation, publish, learner view, and Harrity zip export.
- Packages can carry an assessment bridge: weak topic, ATI category, NCLEX category, CJM step, and evidence source.
- Admins can run `AI Map Weak Topic` on a package to attach the assessment bridge with confidence, rationale, source evidence, and agent mode while preserving the existing student APIs.
- Published learner lessons are available at `/lessons/:id`.
- Student lesson discovery and workspace APIs are available at `/api/student/home`, `/api/student/lessons`, `/api/student/lessons/:id/summary`, `/api/student/progress?sessionId=...`, and `/api/student/study-pack?sessionId=...`; they derive from published Lesson Builder packages and learner events, and exclude admin-only QA/source-management internals.
- `/lessons/:id` now supports `Save lesson`, `Back to library`, `Study path`, shared browser-session progress, `lesson_saved` learner events, completion status, practice events, feedback, guided notes, rationales, and citations.
- Assignment links now open a token-gated learner assignment dashboard at `/lesson-assignments/:assignmentId/learner/:learnerId`, with safe progress, next action, lesson preview, completion, feedback, source labels, and a clean handoff into `/lessons/:id`.
- Faculty reviewers can record package decisions: comment, changes requested, approved for pilot, or approved for release.
- Premium faculty review now includes a scored 5-criterion rubric for clinical accuracy, source traceability, NCLEX/CJM alignment, learner experience, and assessment quality.
- Premium faculty review now has a printable faculty review certificate/report at `/api/admin/lesson-builder/packages/:id/faculty-review/certificate`.
- Published learner lessons record anonymous open, slide, practice, completion, and feedback signals for pilot review.
- Publish, export, faculty review, and learner feedback events are available as release audit history on package detail.
- The live admin Lesson Builder includes a Pilot Launch Console with readiness ladder, active pilot package, AI review, premium faculty review status, assignment activity, learner link actions, and pilot evidence export.
- Google Drive nursing PPT/Slides assets are registered as reusable deck/source-pattern references, including the CH18 Harrity learner-facing deck, Harrity skill overview, California CNS lesson deck, and NCC RN2019/NCOC chapter decks.
- The MNN Google Drive folder is audited in `DRIVE_MNN_ASSET_AUDIT.md`: it contains a maternal-newborn package hub with 27 chapter folders, Harrity decks, manifests, slide blueprint, QA log, notes pass, validation reports, and source/taxonomy JSON files. Treat it as a Drive package collection first, then promote only approved records into source-truth use.
- Source Studio now has a Drive Package Hub import action and `/api/admin/lesson-builder/drive-packages/import`. The first supported preset imports the MNN folder as reference-only metadata, a package-hub source, supporting manifest/QA records, deck collection records, notes-pass candidate, and 27 chapter source candidates.
- Live Render verification passed for the MNN Drive Package Hub import: first import completed with 31 source records and 38 manifest/file entries; source registry showed 27 `drive_chapter_source_candidate`, 1 `drive_package_hub`, 1 `drive_supporting_manifest`, 1 `drive_presentation_collection`, and 1 `drive_notes_pass`; repeat import returned `duplicate` with zero new rows.
- Pearson Course Audit and Pearson Concept Audit Sites dashboards are registered as related audit-pattern references for coverage review, reviewer state, premium faculty review workflow, and program-director evidence reporting.
- OpenAI workspace assets are audited in `OPENAI_WORKSPACE_ASSET_AUDIT.md`: the Builder, Architecture, Supervisor, Planner, SQL, and Knowledge Search agents are useful production operators, but no inspected agent currently has a live API channel.
- ChatGPT library and project surfaces are audited in `CHATGPT_LIBRARY_ASSET_AUDIT.md`: signed-in Chrome exposes recent files and project anchors, while the in-app Browser remains signed out. Source Studio now includes `Register ChatGPT Library Pack` and `/api/admin/lesson-builder/chatgpt-library/import` for pending/reference-only visible inventory registration.
- OpenStax Nursing is audited in `OPENSTAX_NURSING_SOURCE_AUDIT.md`: Source Studio now includes `Register OpenStax Nursing Catalog` and `/api/admin/lesson-builder/openstax/import` for link-only catalog/book metadata. OpenStax records are blocked from AI/RAG generation until OpenStax ingestion permission is documented.
- Live Render verification passed for the ChatGPT Library and OpenStax Nursing imports: deployed bundle `assets/index-DXG9_Bvg.js` contains both Source Studio cards and API paths; ChatGPT import completed with 5 source records and deduped on repeat; OpenStax import completed with 9 source records, 8 virtual book-link rows, all 9 no-AI-ingestion guardrails present, and deduped on repeat.

The current local runtime is Neon-backed and usable for pilot validation. Direct server-side OpenAI Chat Completions is a valid live drafting path for the pilot. Workspace Agent endpoint support remains optional until a live API channel can be created and published.

## Official Pilot Source

Use `Therapeutic Communication Pilot Nursing Source` as the current MVP pilot source. It is paired with the required source contracts:

- Harrity Lesson Builder Pipeline Contract
- Nursing Chapter Deck Builder Schema
- NCC AMS Pilot Preflight Package

Smoke-test uploads named `mvp-*` are development artifacts, not official pilot sources.

For the live pilot, normalize the official source in Source Detail, keep it approved and ready, and attach its weak topic to the published pilot package through the Assessment Bridge panel.

Live Render pilot smoke has completed for package `bf472933-fdb6-4e67-b893-491c00c7bcd4`: official source normalized, Assessment Bridge attached, AI-reviewed `approved_for_pilot` recorded, internal smoke assignment completed, learner feedback recorded, Pilot Outcomes updated, and Harrity export verified. Human faculty review remains premium.

## Live Pilot Launch Console

The live Render app is deployed from `Bobbyh93/Codex_Repo_2026` on `main`. The Pilot Launch Console update was pushed in commit `0fda120` (`Add pilot launch console`) and verified on `https://nursestudy-lesson-builder.onrender.com/admin/lesson-builder`. The Pilot Evidence Export UI polish was pushed in commit `061586e` (`Polish pilot evidence export`).

Verified live on Render:

- The app wakes successfully and redirects protected admin routes to `/admin/login`.
- The seeded admin login succeeds for the live smoke environment.
- `/admin/lesson-builder` renders the Pilot Launch Console.
- The console shows Drive deck count, Pearson audit-pattern count, active pilot package, learner link action, AI Review, Open Learner, Export Evidence, assignment counts, learner completion, and export readiness.
- The console now surfaces the related Pearson audit-pattern dashboards by name with their workflow roles and open links, so admins can connect them to faculty review, traceability, and evidence-reporting workflows.
- The console also surfaces related Google Drive PPT/Slides deck exemplars by name with their deck roles, chapter/slide details, and open links for lesson-grammar and chapter-structure reference.
- The console and evidence reports label Drive/Pearson related assets as reference-only, not authoritative citation/source truth.
- Live AI Review was run for the active pilot package and the readiness ladder now reports `Latest AI review: approved for pilot`.
- Authenticated API smoke passed for `/api/admin/pilot-launch/summary`.
- Authenticated API smoke passed for `/api/admin/lesson-builder/packages/:id/pilot-evidence-export`.
- Pilot Evidence Export now fetches through the admin app, downloads a named JSON report, shows an `Exporting...` state, and displays a `Latest pilot evidence report` confirmation after export.
- Pilot Evidence Export includes related Pearson audit-pattern references in JSON, Markdown, and printable HTML reports.
- Pilot Evidence Export includes related Google Drive deck exemplars in JSON, Markdown, and printable HTML reports.
- Pilot Evidence reports include related asset counts in the executive summary, Markdown links, and clickable HTML `Open reference` links for Drive/Pearson references.
- Pilot Evidence reports include a `relatedAssetPolicy` guardrail stating that lesson claims must cite approved source traceability records.
- The admin export confirmation now shows generated file count, audit-pattern count, deck-exemplar count, completion count, and the reference-only source-truth policy after JSON or Markdown export.
- Pilot Evidence Export also supports a director-ready Markdown brief through `?format=markdown` and the admin `Export Brief` action.
- Pilot Evidence Export also supports a printable HTML report through `?format=html` and the admin `Open Report` action for faculty/program-director review.
- Pilot Evidence Export now supports a print/PDF-ready executive slide report through `?format=executive` and the admin `Exec Report` action.
- Pilot Evidence Export now supports a JSON slide-deck outline through `?format=slides` and the admin `Export Slides` action. The outline is generated from the same evidence payload as the JSON, Markdown, and HTML reports.
- Post-polish authenticated live API smoke passed for package `bf472933-fdb6-4e67-b893-491c00c7bcd4`: evidence export returned `200`, referenced 12 generated files, showed 1 assigned learner, 1 completed learner, and `exportReady=true`.
- Post-brief authenticated live API smoke passed for the same package: `?format=markdown` returned `200`, `text/markdown`, and filename `therapeutic-communication-live-ai-mvp-release-smoke-pilot-evidence-brief.md`.
- Post-report authenticated live API smoke passed for the same package: `?format=html` returned `200`, `text/html`, and filename `therapeutic-communication-live-ai-mvp-release-smoke-pilot-evidence-report.html`.
- Post-audit-pattern authenticated live API smoke passed for the same package: JSON evidence export includes `relatedAuditPatterns` with 2 entries, and printable HTML includes the `Related Audit Patterns` Pearson section.
- Post-deck-exemplar authenticated live API smoke passed for the same package: JSON evidence export includes `relatedDeckExemplars` with 5 entries, and printable HTML includes the `Related Deck Exemplars` Drive section.
- Post-link-polish authenticated live API smoke passed for the same package: Markdown evidence reports include `[Open reference]` links and related asset counts, while printable HTML includes clickable `Open reference` links plus audit/deck summary counts.
- Post-policy authenticated live API smoke passed for the same package: JSON evidence export includes `relatedAssetPolicy.citationUse=not_authoritative_source_truth`, Markdown includes `Related asset policy`, and printable HTML includes the reference-only citation guardrail.
- Post-export-confirmation live bundle check passed: Render deploy `c1536d6` serves `assets/index-8jbbh_bu.js`, and the client bundle includes audit-pattern count, deck-exemplar count, and related-asset policy confirmation copy.
- Local build verification passed for the executive/slide evidence handoff: frontend production build and server bundle both completed after adding `Exec Report` and `Export Slides`.
- Live Render verification passed for the executive/slide evidence handoff: deployed bundle `assets/index-Drl8JJaZ.js` contains `Exec Report`, `Export Slides`, and `format=executive`.
- Live authenticated API smoke passed for package `bf472933-fdb6-4e67-b893-491c00c7bcd4`: `?format=executive` returned `200`, `text/html`, filename `therapeutic-communication-live-ai-mvp-release-smoke-executive-pilot-evidence-report.html`, and the executive report title; `?format=slides` returned `200`, `application/json`, filename `therapeutic-communication-live-ai-mvp-release-smoke-pilot-evidence-slides.json`, report type `pilot_evidence_slide_outline`, and 8 slides.
- Live Render verification passed for the premium faculty rubric/certificate slice: service events show deploy live for `dfac920`; admin route serves bundle `assets/index-C5lVVq3p.js` with `Faculty rubric`, `Open Certificate`, `clinical_accuracy`, and `faculty-review/certificate`.
- Live authenticated API smoke passed for the active package: `GET /faculty-review` returned 5 rubric criteria, latest rubric summary, and a certificate URL; `GET /faculty-review/certificate` returned `200`, `text/html`, filename `therapeutic-communication-live-ai-mvp-release-smoke-faculty-review-certificate.html`, and contained the Faculty Review Certificate, Rubric Evidence, and Clinical accuracy sections.
- Live Render verification passed for the learner assignment dashboard: admin login reached `/admin/lesson-builder`, Pilot Launch Console showed `Copy Learner Link`, the real token-gated assignment link opened `/lesson-assignments/:assignmentId/learner/:learnerId`, rendered assignment progress, completion, feedback, practice preview, source labels, and no admin controls, then `Open Lesson` routed to `/lessons/:id` with deck, practice item, guided notes, citations, and no console errors.
- Browser verification reached the updated console after Render wake. A later export-click pass hit Render's cold-start/loading interstitial, so API smoke is the authoritative verification for the export response while the UI code is verified on GitHub `main`.

Use the Pearson Sites projects as workflow models, not as nursing source truth:

- `Pearson Course Audit Workflow Dashboard`: course/concept coverage review, reviewer-state workflow, faculty approval pattern, and product-operator console inspiration.
- `Pearson Concept Audit Dashboard`: concept/course package audit, source-to-concept traceability, evidence summary, and program-director reporting pattern.

Use the Drive PPT/Slides assets as source/deck exemplars:

- CH18 Asthma Learner-Facing Lesson Package: golden Harrity learner-facing lesson grammar.
- Harrity Lesson Builder Skill Overview: package contract and pipeline framing.
- California CNS Harrity Lesson Deck: alternate Harrity deck pattern.
- NCC RN2019/NCOC chapter decks: nursing chapter structure and course-source pattern.

Use Data Chunker Pro as the heavy-source RAG preparation tool:

- Run large textbook PDFs, manuals, and chapter sets through Data Chunker Pro on the workstation.
- Preserve the generated chunk folders/files, source metadata, and any exported indexes as an importable RAG source pack.
- Register the resulting files in NurseStudy as approved source records before lesson generation.
- Keep Data Chunker Pro output as provenance-bearing source material, not as an automatic publish approval.

Use the MNN Drive package hub as the first Drive package-import target:

- Register the root `MNN` folder as a `drive_package_hub`.
- Import manifests, slide blueprints, QA logs, validation reports, and deck metadata before importing clinical content.
- Treat chapter folders as `drive_chapter_source_candidate` records until citation policy and approval are set.
- Use Harrity decks as lesson grammar and template references unless a reviewer explicitly approves them as source records.
- Use the Source Studio `Import Drive Package Hub` panel for the MNN preset. It creates pending/reference-only records by design.

## Production Environment

Set these as server-side secrets in the production host. Do not place real values in tracked files.

- `DATABASE_URL`: pooled Neon app connection string.
- `SESSION_SECRET`: strong 32+ character session secret.
- `OPENAI_API_KEY` or `NURSING_CURRICULUM_AGENT_API_KEY`: required for live AI generation.
- `NURSING_CURRICULUM_AGENT_ENDPOINT`: required only when using the workspace lesson-agent endpoint.
- `NURSING_CURRICULUM_AGENT_ID`: defaults to the audited MVP builder agent, `agt_69f192d4f1908191baa41586bb0df9ea`.
- `SENDGRID_API_KEY`: required if production email validation remains enabled.
- `FROM_EMAIL`, `FROM_NAME`, `APP_URL`, `NODE_ENV`, and `PORT`: production app settings.

Use a direct Neon connection string only for migration/admin commands, not app runtime.

## Release Notes

- If health shows `openai_chat_completions_ready` or `workspace_agent_ready`, package generation may use live agent-assisted drafting.
- If health shows `fallback_only` or `agent_invalid_key`, the MVP is still functional but generation uses deterministic template fallback.
- Pilot launch readiness now separates AI-reviewed pilot approval from human faculty review. AI-reviewed `approved_for_pilot` satisfies internal MVP launch; human faculty review is a premium feature for formal release support.
- Pilot readiness now also reports official source readiness, source normalization, assessment bridge status, active assignment status, learner completion, and live verification completion.
- Pilot Launch Console is the preferred admin entry point for the internal cohort launch; use the broader Lesson Builder tabs for source/package debugging and audit drill-down.
- `/admin/pilot-requests` is the focused queue for controlled public MFP requests. Use it to qualify and follow up on interested programs; the primary public surface is now the student lesson library at `/`.
- The student home/library filters published lessons by weak topic, NCLEX category, CJM step, and subject, then opens `/lessons/:id` for the learner-safe deck, guided notes, practice, rationale, citations, feedback, and completion signals.
- The student workspace at `/student/progress` summarizes anonymous browser progress and recommends next lessons; `/student/study-pack` compiles guided notes, practice rationales, and citation labels from saved/opened/completed published lessons.
- Google Drive decks and Pearson Sites dashboards are related supporting assets. They are registered for provenance and workflow-pattern reuse, but they should not replace approved nursing source documents.
- MNN Drive assets are the strongest next package-import candidate because they already carry chapter folders, decks, manifests, QA, validation, source JSON, taxonomy JSON, and notes-pass structure.
- OpenAI workspace agents are related production operators. Use direct OpenAI Chat Completions for live Render generation until a selected Builder Agent API channel is created, published, and stored server-side.
- ChatGPT files library (`https://chatgpt.com/library?tab=files`) is accessible through signed-in Chrome and should feed a future `chatgpt_library_reference_pack` intake path. Treat visible files as non-authoritative reference packs until exported/downloaded, reviewed, and registered with citation policy.
- The admin Lesson Builder now includes a Pilot Release Readiness panel and `/api/admin/lesson-builder/release-readiness` blocker summary.
- Replit `NurseStudy` assessment workflows and `NursesBrain` autonomous extraction remain source patterns for future work. The MVP stays Lesson Builder-first until the live pilot loop is verified end to end.
- Learner dashboard routes are token-gated; published `/lessons/:id` remains the learner-facing share route for published lessons.
- Assignment dashboard routes are the preferred learner entry point for cohort pilots because they show assignment status and progress before the deck opens.
- Password registration accepts current first-name/last-name payloads, derives username from email when needed, and keeps password-strength validation.
- Professional Study Guide is quarantined as post-MVP by default with a controlled JSON response unless `ENABLE_PROFESSIONAL_STUDY_GUIDE=true`.
- Unknown `/api/*` routes return JSON 404 responses instead of the frontend HTML shell.
- `npm run preflight:live-launch` checks the Render blueprint, production env contract, secret ignore rules, runbook, Node version, and build output.
- `npm run smoke:lesson-builder` runs the focused pilot release smoke against `APP_URL` or `http://localhost:5000`.
- `npm run check:launch` runs a focused launch-surface TypeScript gate. It currently passes and reports legacy diagnostics outside the launch surface.
- `npm run smoke:launch-surfaces` runs the fast no-AI/no-media public/admin launch checkpoint. It verifies the public home, student progress, study pack, topic-production, content-mapper, and lesson-builder pages serve successfully, then checks learner-safe student APIs and the topic-production matrix/human-review pack.
- `npm run smoke:topic-production` runs the no-AI Topic Production launch smoke against the local preview. It verifies Drive asset mapping, Airtable shorts contract, draft review, phase-3 handoff, student launch readiness, publish readiness, public lessons, events, and feedback.
- The Topic Production smoke also verifies the Phase 2 five-topic catalog shape: at least five total rows, three `topic_candidate` rows, mapped concept/subject/weak-topic/NCLEX/CJM fields, and media spend held until human review.
- The Topic Production smoke now verifies the Phase 3 Human Review Pack: five review rows, required placement/review fields, CSV export, media-spend guardrail, and candidate review decision persistence.
- The Topic Production smoke now verifies the Phase 4 Media Pilot Pack: approved placement rows only, required deck/study-guide/visual/quiz/narration/video fields, CSV export, and the manual-approval/no-generation guardrail.
- The Topic Production smoke now verifies the Phase 4 Budget Gate: media work-order JSON/CSV, required dollar/token fields, $140 per-topic estimate, review decision persistence, scaffold-only approval status, and no-generation guardrail.
- The Topic Production smoke now verifies the Phase 4 Scaffold Pack, Phase 5 Text Draft Pack, Phase 6 Package Assembly Pack, Phase 7 Review Blueprint, Phase 8 Build Approval Gate, Phase 9 Review Package Build, Phase 10 Review Package Promotion, Phase 12 QA Repair Gate, Phase 13 Controlled Preview Decision, Phase 14 Controlled Preview Review Outcome, Phase 15 Public Release Decision Gate, Phase 16 Release Audit Snapshot, Phase 17 Publish Lock, Phase 18 Student Release Sanity, Phase 20 Public Student Entry, and Phase 21 Student Workspace Event Loop: scaffold JSON/CSV, text-draft JSON/CSV, package-assembly JSON/CSV, review-blueprint JSON/CSV, review-package JSON/CSV/ZIP, unpublished Lesson Builder draft creation, QA-ready creator gate metadata, controlled-preview approval/link behavior, preview-review outcome persistence, public-release decision gating, release-audit content inventory, required deck/study-guide/visual/quiz/narration/checklist/learner-surface/export fields, published lesson discovery through `/api/student/home` and `/api/student/lessons`, progress/study-pack compilation from learner events, approved topic inclusion, scaffold/text-draft/blueprint review decision persistence, review bundle file contract, and no-media/batch-production guardrails.
- Live launch is documented in `LIVE_LAUNCH_RUNBOOK.md`; the default target is Render Web Service using `render.yaml`.
- Final local MVP closeout on July 4, 2026 passed the launch gate stack against `http://127.0.0.1:5055`: preflight 25/25, launch-surface smoke 12/12, topic-production smoke 145/145, Lesson Builder release smoke 36/36, frontend build passed, server bundle passed, and no paid AI/media generation was triggered.
- Agent audit is recorded in `LESSON_AGENT_AUDIT.md`; no audited agent had a live API channel at the time of review.
- Full production hardening should include app-wide TypeScript cleanup; the focused Lesson Builder build path passes, while full `tsc --noEmit` still reports existing unrelated errors.
- Production deployment requirements are summarized in `LESSON_BUILDER_PRODUCTION_CHECKLIST.md`.

## Handoff Checklist

- Run frontend build and server bundle.
- Verify `/admin/lesson-builder` health cards.
- Upload one approved pilot source and confirm document/source readiness.
- For large PDF textbooks or chapter sets, run Data Chunker Pro first and register the generated RAG-ready chunk files/folders as the source pack.
- Import the MNN Drive hub metadata and register chapter folders as source candidates before approving any MNN content for generation.
- Register ChatGPT library reference packs for visible files/prompts when useful; they remain pending/reference-only until each file is exported/downloaded, reviewed, and approved.
- Register OpenStax Nursing as link-only catalog metadata for curriculum coverage planning; do not ingest or chunk OpenStax book/PDF text for AI generation without documented permission.
- Normalize the official pilot source and confirm table/crosswalk/taxonomy hints are visible.
- Generate, edit, rebuild, QA, validate, publish, and open learner lesson.
- Attach one weak topic or ATI category to the package through Assessment Bridge.
- Record one AI-reviewed `approved_for_pilot` decision for internal launch; add human faculty review only for the premium release workflow.
- For premium release workflow, complete the faculty rubric, save the faculty decision, and open the faculty review certificate/report for the handoff packet.
- Open the learner lesson, mark complete, submit feedback, and confirm learner signals appear in admin package detail.
- Save a public lesson, attempt practice, mark complete, submit feedback, then verify `/student/progress` and `/student/study-pack` update for the same browser session.
- Open the learner assignment dashboard from a copied cohort link, confirm progress and next action render, then continue into the learner lesson.
- Export Harrity bundle and verify required files are present.
- Open the Pilot Launch Console, confirm all readiness steps pass, and export Pilot Evidence for the program-director handoff.
- Review `OPENAI_WORKSPACE_ASSET_AUDIT.md` before choosing an agent API runtime or importing attached agent resources as source contracts.
- Run `npm run preflight:live-launch` before host connection or deployment.
- Run `npm run smoke:lesson-builder` or `node scripts/lesson-builder-release-smoke.mjs` before handoff.
- Run `npm run check:launch`, `npm run smoke:launch-surfaces`, and `npm run smoke:topic-production` before the next topic-production spend checkpoint.
- Keep the next topic-production checkpoint small: review 2-5 topics, approve taxonomy/content placement, and only then decide whether to spend on AI-generated slide polish, visuals, narration, or video.
- Confirm no secrets are present in tracked files or terminal summaries.
