# NurseStudy Product Consolidation Log

## 2026-07-14 - MVP Navigation Cleanup

### Scope

Clean the visible NurseStudy admin navigation without deleting protected routes or triggering paid AI/media work. This pass treats the Render/GitHub app as canonical and keeps Replit reconciliation as a separate follow-up because the Replit connector was not authenticated during planning.

### Canonical App

- Repository: `Bobbyh93/Codex_Repo_2026`
- Production URL: `https://nursestudy-lesson-builder.onrender.com`
- Primary live service: `nursestudy-lesson-builder`

### MVP Routes Kept In Primary Admin Navigation

- `/admin/dashboard` - admin launch surface
- `/admin/lesson-builder` - cited learner lesson package workflow
- `/admin/topic-production` - topic/source/status matrix
- `/admin/knowledge-base` - reviewed source library management
- `/admin/content-mapper` - content block and taxonomy mapping
- `/admin/assessment-manager` - assessment intake and weak-topic evidence
- `/admin/pilot-requests` - educator/pilot request review

### Student Routes Kept As MVP Surface

- `/` - public/student home
- `/student` - student home alias
- `/student/study-pack` - learner study pack
- `/student/progress` - learner progress
- `/lessons/:id` - learner lesson package
- `/login`, `/register`, `/verify-magic-link`, `/auth/verify` - learner auth support

### Routes Hidden From Primary Navigation, Not Deleted

These routes remain protected/deep-linkable so existing workflows are not broken, but they are no longer part of the visible MVP menu:

- `/admin/call-bookings`
- `/admin/content-import`
- `/admin/content-workflow`
- `/admin/resources`
- `/admin/resource-mapper`
- `/admin/topics-queue`
- `/admin/ai-analyzer`
- `/admin/data-processing`
- `/admin/demand-analytics`
- `/admin/database`
- `/admin/curriculum-catalog`
- `/admin/assessment-preview/:reportId`
- `/admin/topics-needing-resources`

### Implementation Notes

- Added `client/src/lib/mvp-navigation.tsx` as the shared route/navigation registry.
- Updated the admin dropdown navigation to render from the shared MVP sections.
- Updated the admin sidebar layout to render only the MVP admin routes.
- Removed static top-bar action buttons for unimplemented quick-search/status behavior from the admin layout.
- No OpenAI calls, media generation, TTS, Drive, Notion, or paid external actions were used.

### Validation Plan

Run these before merging/deploying the branch:

- `npm run check:launch`
- `npm run smoke:launch-surfaces`
- `npm run smoke:topic-production`
- `npm run smoke:lesson-builder`
- `npm run build`

Browser-smoke these routes after deployment or local checkout:

- `/`
- `/student`
- `/student/progress`
- `/student/study-pack`
- `/admin/login`
- `/admin/dashboard`
- `/admin/lesson-builder`
- `/admin/topic-production`
- `/admin/assessment-manager`

### Remaining Product Gap

Computer Adaptive Testing remains the major missing product capability. The current cleanup intentionally avoids adding CAT navigation until the linked assessment/CAT route is implemented and testable.
