# NurseStudy Lesson Builder MVP Handoff

## Current MVP Status

The DB-backed Lesson Builder path is functional locally and is the live Render product path for the internal pilot:

- Public-launch MFP acceptance is now recorded in `PUBLIC_LAUNCH_MFP_ACCEPTANCE.md`: internal pilot is accepted as the baseline, the public scope is a controlled visitor/capture entry plus the protected admin/learner workflow, and Replit/NursesBrain/Data Chunker/Drive assets remain supporting systems unless promoted through source approval.
- The public root now centers the nursing student learning interface: lesson library, featured published lesson, topic filters, guided notes, quizzes, rationales, citations, progress-friendly lesson structure, and source-backed study materials.
- Public pilot request review is optional operations support at `/pilot-request` and `/admin/pilot-requests`, not the main product surface.
- Admin Knowledge Base upload creates persisted document chunks.
- Approved sources can generate a Harrity web lesson package.
- Source detail now includes a NursesBrain-style normalization step for table/crosswalk signals, taxonomy hints, official pilot source status, and weak-topic metadata.
- Data Chunker Pro on the local workstation is the designated preprocessing path for large textbook and chapter PDFs: use it to create RAG-ready chunk files/folders, then register those outputs into NurseStudy with source provenance, approval state, and citation policy.
- Packages support edit, rebuild artifacts, QA, contract validation, publish, learner view, and Harrity zip export.
- Packages can carry an assessment bridge: weak topic, ATI category, NCLEX category, CJM step, and evidence source.
- Published learner lessons are available at `/lessons/:id`.
- Student lesson discovery APIs are available at `/api/student/home`, `/api/student/lessons`, and `/api/student/lessons/:id/summary`; they derive from published Lesson Builder packages and exclude admin-only QA/source-management internals.
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
- Live launch is documented in `LIVE_LAUNCH_RUNBOOK.md`; the default target is Render Web Service using `render.yaml`.
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
- Open the learner assignment dashboard from a copied cohort link, confirm progress and next action render, then continue into the learner lesson.
- Export Harrity bundle and verify required files are present.
- Open the Pilot Launch Console, confirm all readiness steps pass, and export Pilot Evidence for the program-director handoff.
- Review `OPENAI_WORKSPACE_ASSET_AUDIT.md` before choosing an agent API runtime or importing attached agent resources as source contracts.
- Run `npm run preflight:live-launch` before host connection or deployment.
- Run `npm run smoke:lesson-builder` or `node scripts/lesson-builder-release-smoke.mjs` before handoff.
- Confirm no secrets are present in tracked files or terminal summaries.
