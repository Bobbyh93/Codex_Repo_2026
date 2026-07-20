# Harrity / NurseStudy MVP Work Breakdown Structure

Status date: 2026-07-10  
Operating mode: hourly work packets with proof, logs, and cost caps  
Cost rule: user estimate is 2,500 tokens = $100. Default packet cap is 1,250-2,500 tokens ($50-$100). Milestone cap is 12,500 tokens ($500) unless explicitly approved.

## Launch Operating Rule

Do the smallest useful work packet that moves the live product forward, then stop for evidence. Each packet must leave one of these proofs:

- A live URL/API check
- A passing local script
- A committed file or artifact
- A Drive record/log update
- A clear blocker with the next owner/action

Do not run broad AI generation, media generation, TTS, video rendering, or mass topic expansion without a named milestone and budget checkpoint.

## WBS 1 - Live Product Health

Goal: Keep the launched NurseStudy product usable while development continues.

Tasks:

- WBS-1.1 Check Render health and public student home.
- WBS-1.2 Check admin login and protected topic-production access.
- WBS-1.3 Check published lesson, progress, study pack, and export readiness.
- WBS-1.4 Log any live defects with route, severity, proof, and next action.

Acceptance evidence:

- `/health` returns OK.
- `/api/student/home` returns published lessons.
- Authenticated `/api/admin/topic-production-matrix` returns topic rows.
- Lesson Builder release smoke passes or failures are logged with owner.

## WBS 2 - Topic Catalog Backbone

Goal: Every topic has a clear subject home and production state.

Required fields per topic:

- Topic
- Nursing specialty or subject
- Concept
- Weak-topic label
- NCLEX category
- CJM step
- Source evidence
- Related slide deck
- Related study guide
- Visual asset status
- Quiz status, minimum one item
- Human review status

Tasks:

- WBS-2.1 Audit unmapped topics.
- WBS-2.2 Map topic to specialty/subject and concept.
- WBS-2.3 Confirm source evidence and citations.
- WBS-2.4 Assign package status: draft, review, ready, published.

Acceptance evidence:

- Topic-production matrix row has required mapping fields.
- No student-facing package is marked ready without at least one quiz item and citation.

## WBS 3 - Content Package Factory

Goal: Convert approved topic rows into student-ready learning packages.

Minimum package:

- Video lesson slide deck placeholder or source deck link
- Study guide or guided notes
- Visual plan or generated visual placeholder
- Quiz item with rationale
- Citation/source list
- Student preview route

Tasks:

- WBS-3.1 Build package draft from mapped topic.
- WBS-3.2 Attach slides/study guide/visual/quiz references.
- WBS-3.3 Run deterministic QA.
- WBS-3.4 Promote only one reviewed packet per hourly cycle unless quality is proven.

Acceptance evidence:

- Package appears in student library or controlled preview.
- Practice/rationale and citations render.
- Export status is ready.

## WBS 4 - Airtable / Viral Shorts Workflow

Goal: Rebuild the viral shorts workflow as a tracker, not a separate product shell.

Tasks:

- WBS-4.1 Define Airtable fields that mirror the topic-production matrix.
- WBS-4.2 Add short-form content status: hook, script, visual, caption, CTA, approval.
- WBS-4.3 Map each short back to a topic/package.
- WBS-4.4 Use Airtable only for production tracking until the app needs direct sync.

Acceptance evidence:

- Tracker contract exists.
- Each short has topic/package linkage.
- No orphan shorts are produced without a lesson/study asset path.

## WBS 5 - Drive Source Operations

Goal: Keep source files, decks, study guides, and exports findable.

Tasks:

- WBS-5.1 Use Drive folder `NurseStudy` where available.
- WBS-5.2 Store WBS/log copies or exported review packs.
- WBS-5.3 Keep source decks and generated package artifacts linked in the topic matrix.
- WBS-5.4 Avoid uploading secrets, local `.env`, or raw keys.

Acceptance evidence:

- Drive artifact URL or folder ID is recorded in `ops/ops-manifest.json`.
- Each imported source has a source type and traceable title.

## WBS 6 - Hourly Operating Cadence

Default hourly cycle:

1. Check: live health, current route, current blocker.
2. Choose: one work packet under the budget cap.
3. Build: edit or generate only the minimum needed.
4. Verify: run the narrowest meaningful check.
5. Log: append proof, cost estimate, and next action.

Stop conditions:

- A live customer-facing route is down.
- A source artifact is missing or ambiguous.
- A change requires paid AI/media generation over the packet cap.
- A workflow requires a human content decision.

## WBS 7 - Browser / Computer QA Lane

Goal: Verify real screens and local app behavior without turning every packet into a full regression cycle.

Tasks:

- WBS-7.1 Browser check the current focus route.
- WBS-7.2 Confirm console/network health when browser tooling is available.
- WBS-7.3 Use Computer only for native desktop artifacts or apps that cannot be validated through local files.
- WBS-7.4 Capture only the screenshot or proof needed for the packet.

Acceptance evidence:

- Route URL, result, and proof are logged in `ops/WORK_LOG.md`.
- Any failed screen has a named next action, not a vague note.

## WBS 8 - Build Web Apps UI Lane

Goal: Keep the public student experience usable while admin/operator tools mature.

Tasks:

- WBS-8.1 Improve only the active launch surface for the packet.
- WBS-8.2 Keep admin workflows protected and student workflows clean.
- WBS-8.3 Run focused build/smoke checks after UI edits.
- WBS-8.4 Avoid redesigns unless a specific workflow is blocked.

Acceptance evidence:

- Public/student route loads.
- Admin route remains protected.
- No visible broken link on the edited surface.

## WBS 9 - Replit Source-Pattern Lane

Goal: Use Replit work as backlog/source patterns, not as the active product shell.

Tasks:

- WBS-9.1 Identify reusable Replit ideas only when they support the current NurseStudy workflow.
- WBS-9.2 Convert useful Replit work into a ticket or source note.
- WBS-9.3 Do not restart the product in Replit during launch operations.

Acceptance evidence:

- Any Replit-derived work item maps to a NurseStudy route, API, package, or topic row.
