# Open NCLEX Curriculum Workbench

Dependency-free, read-only execution dashboard for the NurseStudy `NCLEX-RN-2026` curriculum.

Run `npm run build:nclex-curriculum` from the repository root to regenerate the Canvas-portable curriculum exports and the sanitized dashboard artifact at `data/execution-status.json`.

Serve the repository root and open `/apps/nurse-prep-web/`. The dashboard contains aggregate curriculum-production data only and excludes learner, patient, credential, and unpublished source content.
