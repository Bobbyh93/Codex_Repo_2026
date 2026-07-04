# Topic Production Milestones

## Budget Principle

Use the user's planning rate of 2,500 tokens = $100 for milestone sizing. Keep each build checkpoint small enough to review quality before moving to the next spend band.

No paid AI narration, video rendering, broad image generation, or large content expansion should run automatically in these milestones. The default path is source mapping, template generation, proof, and human review.

## Phase 1: Two-Topic Launch Proof

Budget target: $100-$500.

Goal: prove the operating loop with the existing Maternal-Newborn and Pediatrics starter packets.

Acceptance:
- Each topic has a concept, nursing specialty/subject, weak-topic label, source/deck/study-guide references, visual slot, and quiz slot.
- Each topic has a generated learner package with slides, at least one quiz item, citations, and public lesson route.
- The Airtable Viral Shorts Workflow export row exists as a planning artifact, not a required video-production spend.
- `npm run check:launch` passes.
- `npm run smoke:topic-production` passes.

Current state:
- Maternal-Newborn Lesson Guide is public in local preview.
- Pediatrics Asthma is public in local preview.
- Both starter packets currently have 8 slides, 1 quiz item, and 8 citations.

## Phase 2: Five-Topic Catalog Expansion

Budget target: $100-$500 after Phase 1 review.

Goal: add three more high-value nursing topics without scaling media production yet.

Acceptance:
- Five total topics are mapped to concept, specialty/subject, weak-topic label, NCLEX/CJM tags, source deck or study-guide asset, visual slot, and quiz slot.
- At least three topics are approved for draft review.
- At least two topics remain public learner examples.
- No generated content is treated as final until reviewed by the content creator/operator.

Current local state:
- Phase 2 has three mapped `topic_candidate` rows:
  - Postpartum Hemorrhage Priorities.
  - Newborn Assessment Cues.
  - Pediatric Emergency Priorities.
- The three candidates carry concept, nursing subject, weak topic, NCLEX category, CJM step, and source-evidence placement.
- The three candidates intentionally remain `not_generated` and held for human review before AI polish, visuals, audio, or video spend.
- `npm run check:launch` passes.
- `npm run smoke:topic-production` passes and verifies at least five topic-production rows with three candidates.

## Phase 3: Human Review Pack

Budget target: $100-$500 after Phase 2 review.

Goal: turn the mapped topic catalog into a content-review queue the creator can approve or reject quickly.

Acceptance:
- Each topic exposes a review packet with what belongs in the slide deck, study guide, quiz, visuals, and future video script.
- Each topic has one explicit next action: approve, revise taxonomy, revise source, revise quiz, or hold for expert review.
- CSV/JSON exports support Airtable import or manual review without needing the Airtable API as a launch dependency.

Current local state:
- `/admin/topic-production` shows a Phase 3 Human Review Pack card with five review rows.
- `/api/admin/topic-production-matrix/human-review-pack?format=json|csv` exports the same pack.
- The pack includes the two public starter lessons and the three Phase 2 candidates.
- Each review row includes topic, concept, nursing subject, weak topic, NCLEX category, CJM step, source/deck references, review decision, recommended decision, next owner action, hold trigger, and cost guardrail.
- Review actions support approve placement, revise, or hold while keeping media spend blocked.
- `npm run check:launch` passes.
- `npm run smoke:topic-production` passes and verifies the human review pack plus one persisted candidate placement decision.

## Phase 4: Media Production Pilot

Budget target: $100-$500 after one Phase 3 placement is approved.

Goal: choose one reviewed topic and map the first richer media bundle before spending on media generation.

Acceptance:
- One approved topic receives a Phase 4 media pilot row with a slide deck plan, student study guide plan, visual plan, quiz/rationale plan, narration script plan, and future video status.
- The media pilot row states where AI-generated or processed content belongs so the creator can review placement before continuing.
- Audio/video/image generation is manually approved before spend.
- CSV/JSON exports support local review and Airtable handoff without requiring the Airtable API as a launch dependency.

Current local state:
- `/admin/topic-production` shows a Phase 4 Media Pilot Pack card after the Phase 3 Human Review Pack.
- `/api/admin/topic-production-matrix/media-pilot-pack?format=json|csv` exports only topics with an approved Phase 3 placement.
- `/admin/topic-production` also shows a Phase 4 Budget Gate that converts the first approved topic into a dollarized work order before generation.
- `/api/admin/topic-production-matrix/media-work-orders?format=json|csv` exports the same work order with the planning rate, token budget, dollar budget, line items, and manual approval status.
- The Budget Gate supports approve scaffold, revise order, and hold spend decisions. Approving the scaffold only approves the one-topic planning pass; it does not approve media rendering, TTS, video, paid visuals, or batch generation.
- `/admin/topic-production` shows a Phase 4 Scaffold Pack after a work order is approved for scaffold planning.
- `/api/admin/topic-production-matrix/media-scaffold-pack?format=json|csv` exports the deterministic scaffold: slide outline, study guide outline, visual storyboard, quiz/rationale scaffold, narration outline, and creator review checklist.
- Each scaffold row now has a creator review gate: approve the next AI text-draft checkpoint, request revisions, or hold spend. This records intent only; it does not trigger AI generation, TTS, video rendering, or paid visual generation.
- `/api/admin/topic-production-matrix/media-text-draft-pack?format=json|csv` exports the next review packet after scaffold approval: slide text draft, study-guide text, visual brief, quiz/rationale draft, narration script, creator questions, and no-media cost guardrail.
- Each text-draft row now has a creator review gate: approve the lesson-package assembly checkpoint, request text revisions, or hold spend. This records intent only; it does not assemble a package, run TTS, render video, generate paid visuals, or start batch generation.
- `/api/admin/topic-production-matrix/package-assembly-pack?format=json|csv` exports the Phase 6 Package Assembly Pack after a text draft is approved for package assembly. It maps the approved draft into a learner package title, slide deck plan, guided notes plan, practice item, citation plan, learner surface, export plan, review gate, next allowed action, and no-media/no-public-publish guardrail.
- `/admin/topic-production` shows the Phase 6 Package Assembly Pack so the creator can see where each approved text draft belongs before any richer production spend.
- `/api/admin/topic-production-matrix/package-review-blueprint?format=json|csv` exports the Phase 7 Review Blueprint after package assembly is available. It expands the approved package plan into learner outcome, slide blueprint, guided notes blueprint, practice item blueprint, visual placeholders, citation slots, export file list, creator checklist, expert questions, stop conditions, and no-publish/no-media guardrail.
- `/admin/topic-production` shows the Phase 7 Review Blueprint so the creator can review a complete learner-package shape before approving a real package build.
- Phase 8 Build Approval Gate is recorded through `/api/admin/topic-production-matrix/package-review-blueprint/:workOrderId/review` and the Phase 7 card buttons. It supports approve one deterministic unpublished review-package build, request blueprint revision, or hold spend. Approval is still not public publish or media approval.
- `/api/admin/topic-production-matrix/review-package-builds?format=json|csv|zip` exports the Phase 9 deterministic review package after Phase 8 approval. It creates the six review files the creator needs next: review manifest, learner slides, guided notes, practice item, citations, and creator checklist.
- `/admin/topic-production` shows the Phase 9 Review Package Build card so the creator can see where AI-generated or processed content belongs before promoting anything into Lesson Builder, public publishing, TTS, video, paid visuals, or batch production.
- Phase 10 promotion is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/promote` and the Phase 9 card button. It creates or returns one normal Lesson Builder package with `status=draft`, slides, one practice item, citations, and creator-review manifest metadata. It is explicitly unpublished and hidden from public lesson routes.
- Phase 11 Creator QA Gate is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/creator-qa` and the Phase 9 card button. It runs the existing Lesson Builder QA and Harrity contract validation against the promoted unpublished draft, records `ready_for_controlled_preview` or `needs_revision` in `manifest.topicProduction.creatorQaGate`, and keeps publish/media blocked.
- Phase 12 QA Repair Gate keeps the same `creator-qa` endpoint but now repairs the deterministic promoted draft's review-package citations plus prediction/rationale learning moments before QA. The target result is `ready_for_controlled_preview` with package status `qa_ready`, while the public lesson route still returns 404 until a later explicit preview/publish checkpoint.
- Phase 13 Controlled Preview Decision is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/controlled-preview-decision` and the Phase 9 card buttons. It can approve, hold, or request fixes for the QA-ready promoted draft, creates a preview-key URL only after approval, and still keeps the normal public lesson URL hidden.
- Phase 14 Controlled Preview Review Outcome is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/preview-review` and the Phase 9 card buttons. It records `ready_for_release`, `needs_fix`, or `hold_release` in the promoted draft manifest after controlled-preview approval, while public publish, TTS, rendered video, paid visuals, and batch production remain blocked.
- Phase 15 Public Release Decision Gate is available through `/api/admin/topic-production-matrix/review-package-builds/:workOrderId/public-release-decision` for review packages and `/api/admin/topic-production-matrix/drafts/:packageId/public-release-decision` for starter drafts. It records `approve_public_release`, `needs_fix`, or `hold_release`; only approval exposes the existing publish endpoint, and media/batch work still stays separate.
- Phase 16 Release Audit Snapshot is available through `/api/admin/topic-production-matrix/drafts/:packageId/release-audit-snapshot` and the Final Publish Readiness card. It is read-only and shows the package, learner visibility, slide deck, practice item, citations, QA, decisions, blockers, and cost guardrail before the final publish click.
- Phase 17 Publish Lock Confirmation requires the final publish request to include `confirmPublicPublish=true` and `confirmationText="I understand this makes the lesson public"`. Missing confirmation returns 400 and does not publish, while confirmed publish is still allowed only after QA, contract validation, release decision, and audit snapshot gates are satisfied.
- Phase 18 Public Student Release Sanity is available through `/api/admin/topic-production-matrix/drafts/:packageId/student-release-sanity` and the Final Publish Readiness card. It is read-only and checks the actual public learner payload after publish: weak-topic labels, slides, guided notes, practice/rationale, citations, completion/feedback endpoints, and no admin-only internals.
- Phase 19 Student Lesson Workspace Polish improves `/lessons/:id` for public learners: the page shows a compact study-path strip, mapped topic labels, deck/practice/guided-notes/citations jump controls, completion/save state, and quiz rationales only after the student selects an answer.
- Phase 20 Student Home and Library Entry Polish makes the public root and `/student` act as the first learner handoff: topic tiles filter the lesson library, published packages expose learner-safe weak-topic/NCLEX/CJM labels, and the smoke test proves `/api/student/home` plus `/api/student/lessons` include the published learner URL.
- Phase 21 Student Workspace Event Loop locks the next learner checkpoint: the smoke records save/open/slide/practice/complete/feedback events for the published lesson, then proves `/api/student/progress` and `/api/student/study-pack` compile the same session into recent progress, completion counts, guided notes, rationales, and citations.
- Phase 22 Launch Surface Smoke adds a fast, no-AI, no-media checkpoint for the visible public/admin launch routes. `npm run smoke:launch-surfaces` verifies the public home, student progress, study pack, topic-production, content-mapper, and lesson-builder pages serve successfully, then checks learner-safe student APIs plus the topic-production matrix/human-review pack before running heavier spend-gate smoke.
- The launch smoke approves `Postpartum Hemorrhage Priorities` as a placement-only review decision, then verifies that the Phase 4 pack contains that topic.
- The current per-topic work order is 3,500 tokens / $140 at the user's planning rate of 2,500 tokens = $100.
- The pack keeps video status at `not_started_manual_approval_required`; work-order review can move to `approve_single_topic_scaffold` while still blocking paid media generation until a separate explicit approval.
- `npm run check:launch` passes.
- `npm run smoke:launch-surfaces` passes and verifies the fast public/admin launch route plus learner API checkpoint.
- `npm run smoke:topic-production` passes and verifies the media pilot pack fields, approved topic, CSV export, dollar work-order fields, $140 estimate, work-order review persistence, deterministic scaffold pack, text draft pack, package assembly pack, package review blueprint, Phase 8 build-gate decision persistence, Phase 9 review-package JSON/CSV/ZIP exports, Phase 10 unpublished draft promotion, Phase 12 QA-ready creator gate metadata, Phase 13 controlled-preview approval/link behavior, Phase 14 preview-review outcome persistence, Phase 15 public-release decision gating, Phase 16 release-audit snapshots, Phase 17 publish confirmation lock, Phase 18 public student release sanity, Phase 20 public student home/library handoff, Phase 21 student workspace progress/study-pack event loop, and no-generation/no-media guardrails.

## Stop Conditions

Pause before spending more when:
- A topic lacks a credible source or citation path.
- Taxonomy mapping is uncertain.
- Generated quiz rationales are weak.
- Student lesson output is not understandable without admin context.
- A milestone smoke or focused launch check fails.
