# Codex Tree Inventory and Status Map

**Scope:** `C:\Users\RHarrity\Documents\Codex` (whole tree)
**Current as of:** 2026-09-06 · **First issued:** 2026-08-27
**Method:** read-only inspection of committed manifests, QA JSON, state files, git metadata, and handoff docs, plus the work done in this session. No `.env` file was opened.

> Replaces `CODEX_TREE_INVENTORY_2026-08-27.md`. Ten days of change made that version stale in three places: the repo moved, the crosswalk branch advanced, and the CAT slice was triaged.

---

## 1. What Changed Since 2026-08-27

**The project restarted.** `Codex_Repo_2026` has six new commits on `origin/main` dated 2026-09-05 and 2026-09-06, after six weeks idle:

| Date | Commit | Subject |
|---|---|---|
| 2026-09-06 | `e9ef531` | Add validate_lesson_json.py for lesson draft QA |
| 2026-09-06 | `993909e` | Add drafts/ scaffolding for autonomous Claude-authored lesson drafts |
| 2026-09-06 | `1a97a04` | Add missing JWT_SECRET to render.yaml |
| 2026-09-05 | `533dd36` | Bound the /health database probe with a timeout (#9) |
| 2026-09-05 | `51989e7` | Let the real health check own /health (#8) |
| 2026-09-05 | `2750384` | Fix TypeScript errors across server and client (#7) |

**Your local checkout is 6 commits behind.** Pull before doing anything in that repo.

Two consequences for this document: `#7` probably resolves or reduces the 315 legacy TypeScript diagnostics recorded as debt, and the `/health` plus `JWT_SECRET` work is progress on the Render deployment that was the stop point. **Neither is re-verified here** — the local checkout is stale and I did not pull.

Worth noting what those commits are *not*: none touch `state/`, `daily_worksets/`, `shared/nclex-rn-2026.ts`, `curriculum_exports/`, or `server/directed-remediation-engine.ts`. The state-driven ops pipeline has not moved. The new work is a separate lesson-drafting track.

**Work completed in this session** (2026-08-27 → 2026-09-06):

- The 36 blocked mapping-resolution rows are drafted, three passes deep, ending in a complete method-consistent table. §4.3.
- The CAT slice is triaged with a migration assessment and a work package. §5.1.
- `Execute_to_Goal_Sites` is clean. §4.5.

---

## 2. Executive Summary

Five active work sets, one reusable TTS package, and eight dated session folders of which five are empty scaffolds.

| Signal | Value |
|---|---|
| Active work sets | 5 |
| Finished and released | 1 (prelicensure crosswalk) |
| Advanced this session | 2 (RN WPS/NGN CKM branch, CAT triage) |
| Blocked on one credential | 2 (Lesson Builder TTS, production pilot) |
| Last recorded ops run | 2026-07-15 — `blocked_or_planning_only`, still the latest |
| Repo activity | resumed 2026-09-05; local checkout 6 behind |

**The credential is still the top of the critical path.** Everything the session accomplished was work that could be done *around* it.

---

## 3. Production Chain

1. **Prelicensure QSEN→AACN crosswalk** — `prelicensure_crosswalk_workset_2026-06-11` — **complete**, review queue driven to 0.
2. **RN WPS ↔ prelicensure crosswalk** — `rn_wps_prelicensure_crosswalk_workset_2026-06-12` — workbook delivered; **396 of 402 bridge rows still unresolved at task level**.
3. **NGN CKM lesson ingest** — `ngn_ckm_rn_wps_ingest_workset_2026-06-12` — **process-level mapping now drafted for all 36 rows** and awaiting a reviewer. Engine proven on 1 clean row.
4. **Lesson Builder / NurseStudy** — `Codex_Repo_2026` — deployed and gated; narration blocked, `release_state: not_ready`.
5. **Site front ends** — `Execute_to_Goal_Sites`, plus two app copies in dated folders.

Step 3's drafting is done. Step 3's *decisions* are not, and they are the gate.

---

## 4. Work Set Detail

### 4.1 Codex_Repo_2026 — Harrity Lesson Builder Pipeline / NurseStudy
**Status: blocked (execution context) · local checkout stale**

Local `HEAD` is `721c242` (2026-07-19); `origin/main` is 6 ahead. Working tree clean.

State files (unchanged since 2026-07-19, and unchanged on origin):

- `pipeline_state`: active `tts_asset_verification`; next `credential_backed_openai_tts_assets`.
- `qa_state`: `blocked_until_execution_context_exists`. 2 gates pass, 4 blocked.
- `release_state`: `not_ready`, `export_pass_allowed: false`.
- `work_queue`: 5 packages — 2 complete, 2 blocked, 1 pending. A sixth, `HLB-CAT-040`, is drafted and staged but **not inserted** (§5.1).
- Last ops run 2026-07-15T02:21Z: guards pass, 7 active blockers, paid AI disallowed, `$0.00` retry ceiling. Latest daily workset is still 2026-07-15.

Deployment per `LIVE_DEPLOYMENT_STATUS.md`: live on Render, launch gates recorded passing. Remaining for a real cohort: real pilot learners, archived Harrity export bundle, faculty review as a premium layer.

Debt: 315 legacy TypeScript diagnostics — **likely reduced by commit `2750384`, not re-verified.** Computer Adaptive Testing was the named missing capability; see §5.1.

### 4.2 prelicensure_crosswalk_workset_2026-06-11 — QSEN → AACN
**Status: complete and released.** Unchanged. 11 sheets, 214 Entry Level rows, 835 canonical rows, review queue burned 21 → 10 → 0. Still the reference template for how a work set closes.

### 4.3 ngn_ckm + rn_wps — the crosswalk branch
**Status: drafted, awaiting reviewer decisions**

The RN WPS crosswalk workbook (13 sheets, reconciliation pass) is unchanged: 402 task rows, **6 confident matches, 396 in review queue**. That task-level figure has not moved.

What moved is the *process-level* resolution the ingest work set holds. On 2026-06-12 it stopped at `prepared_pending_ai` with 0 drafts and 36 unresolved. Three passes this session:

| Folder | What it is | Result |
|---|---|---|
| `mapping_resolution\` | the original pipeline output | 36 rows `credential_pending` — **untouched, all files still 2026-06-13** |
| `mapping_resolution_claude\` | pass 1: drafted inside the original candidate sets | 23 drafted, 9 not_mappable, 4 undraftable · superseded |
| `mapping_resolution_claude_v2\` | pass 2: 10 rows on regenerated candidates | proof the candidate generator was the bottleneck · superseded |
| **`mapping_resolution_claude_v3\`** | **pass 3: all 36 on one method** | **30 drafted, 6 not_mappable, 0 undraftable, 0 validation errors** |

**Review from v3.** `wps_qsen_crosswalk_v3_review.csv` is the instrument. v1 and v2 carry `SUPERSEDED.md` notices.

Two checks on v3 worth more than the counts: all 30 drafted tops are **Skills** statements, matching the KSA level of tasks that describe what a nurse does — and nothing optimised for that. And contradictions between processes sharing identical source task text went **6 → 1**, the survivor being a documented deliberate split.

Still open and still human: 16 of 30 drafts are low confidence, `RN-WPS-037` has no good home anywhere in QSEN, and the 396 task-level rows behind all this are untouched.

### 4.4 Prescribing rows should leave the queue
`RN-WPS-029` and `RN-WPS-030` are advanced-practice tasks inherited from an O\*NET RN profile that blends RN and APRN work. Verified `not_mappable` against all 207 statements. Move them to the source exclusion list beside `*CIP Code` and `Provider`.

### 4.5 Execute_to_Goal_Sites
**Status: clean.** The two "modified" files held **zero content change** — CRLF rewritten over LF. Both restored from the index and verified byte-identical by SHA-256. Added `.gitattributes` (`* text=auto eol=lf`).

One cleanup left for you: three empty `.git/index.lock*` files. **They are mine** — created by my own read-only `git status` calls and unremovable because this bridge cannot delete files. Until they clear, `git status` reports those two files as modified even though the content is correct; that is a stale stat cache, not a real diff.

```
cd ~\Documents\Codex\Execute_to_Goal_Sites; del .git\index.lock*; git status
```

### 4.6 harrity_click_to_set_key_and_run_tts_20260610 — TTS package
**Status: reusable, and the counter-evidence.** Complete contract v1.0.0. `audio/slide_narration/S001.mp3` exists with `render_status: success`. The render path worked on 2026-06-10; the credential is what changed.

---

## 5. Dated Session Folders

| Folder | Files | Contents | Disposition |
|---|---:|---|---|
| 2026-04-28 | 0 | empty scaffold | delete |
| **2026-05-25** | many | `pearson-concept-audit-dashboard` v0.1.0 · audit xlsx · 5 site tarballs | keep |
| 2026-06-24 | 0 | 2 empty scaffolds | delete |
| **2026-06-25** | many | one empty scaffold; `site-creator-vinext-starter` v0.1.0 | keep app, delete scaffold |
| 2026-07-02 | 0 | empty scaffold | delete |
| **2026-07-09** | 727 | **CAT feature slice** + 9 browser-QA clones (719 files); two sibling scaffolds empty | **§5.1 first, then prune** |
| 2026-07-14 | 0 | 4 empty scaffolds | delete |
| 2026-07-19 | 1 | 2 scaffolds; one holds a loose `.env.local` | handle credential, then delete |

### 5.1 The CAT slice — triaged, decision pending

Assessment and work package delivered to `Codex\CAT_MIGRATION_2026-09-06\`.

**Verdict: migrate the logic, not the data.** The slice's blueprint JSON duplicates `NCLEX_CATEGORIES` in `shared/nclex-rn-2026.ts` exactly — all eight ranges and midpoints. Derive it; don't import a second source of truth. Its real value is the selector, ability update, eight readiness gates, session model, and a prototype that passed two recorded QA runs.

**The blocker is your own item pool, not the prototype.** The repo generates 120 assessment items and 48 clinical-judgment items, exported to QTI — but `buildAssessmentItems` puts the correct answer at option **A** every time, all 40 `ClinicalFact` entries share **one** distractor triple, `difficulty` is the string `"application"` or `"analysis"` rather than a number, and three context phrases clone each fact into three near-identical items. Fine for a linear mastery check. Cannot drive adaptive selection.

Blueprint percentages were verified externally: all eight client-needs ranges and the 85/150 item bounds check out. Six fields did **not** verify — `timeLimitHours`, `pretestItems`, `minimumLengthScoredContentItems`, `minimumLengthClinicalJudgmentCaseStudyItems`, and the case-study counts. The stop rules depend on the first four.

`HLB-CAT-040` is written in the repo's `work_queue` schema, priority 4, ready to paste — **after you pull.**

---

## 6. Critical Path

**One invalid credential still blocks two branches and four QA gates.**

- `Codex_Repo_2026/state/pipeline_state.json`: key present, `openai_authenticated_probe_status: "invalid_api_key"`, unverified.
- The NGN CKM mapping-resolution QA records `api_status: "missing"` — though that branch is no longer waiting on it, since the drafting was done without an API call.

Downstream: TTS verification → production pilot → four gates → `release_state: not_ready`.

**Second-order blocker, independent of the credential:** the RN WPS confident-match rate. Regeneration proved the candidate generator was the constraint at process level. The same fix has not been applied to the 396 task-level rows.

---

## 7. Credential Hygiene

Three environment files. None opened.

| Path | Size | Git status |
|---|---:|---|
| `Codex_Repo_2026/.env.local` | 181 B | ignored, untracked — safe |
| `harrity_..._tts_20260610/.env` | 181 B | ignored — safe |
| `2026-07-19/.../.env.local` | 180 B | **no repo in that folder — no ignore protection** |

Every credential guard run on record reports no external secret file read and no secret value logged.

---

## 8. Next Actions

| # | Action | Owner | Unblocks |
|---:|---|---|---|
| 1 | `git pull` in `Codex_Repo_2026` | you | everything repo-side; re-check the TS debt and Render status after |
| 2 | Rotate `OPENAI_API_KEY`; rerun credential guard then the live TTS pilot | you | TTS verification, production pilot, 4 gates |
| 3 | Reviewer pass on `mapping_resolution_claude_v3\wps_qsen_crosswalk_v3_review.csv` | **licensed reviewer** | the NGN CKM branch |
| 4 | Move `RN-WPS-029` and `RN-WPS-030` to the source exclusion list | you | −2 rows, permanently |
| 5 | Decide the CAT disposition; if migrating, insert `HLB-CAT-040` after the pull | you | the named product gap |
| 6 | Decide the 396 task-level RN WPS rows: semantic re-match, sampled review, or accept a partial bridge | you | step 2 of the chain |
| 7 | Restart or retire the ops schedule, idle since 2026-07-15 | you | pipeline visibility |
| 8 | Close the live pilot: real cohort plus archived Harrity export | you | `release_state` |
| 9 | Delete the three stale `.git/index.lock*` files (§4.5) | you | a clean `git status` |
| 10 | Consolidation sweep — **only after 5** | you | disk and clarity |

---

## 9. Consolidation Candidates

Do not sweep before §5.1 is decided — the CAT slice sits in a folder that otherwise reads as disposable.

- **Empty scaffolds** — 2026-04-28, 2026-06-24 (2), 2026-07-02, 2026-07-14 (4), two in 2026-07-09, one in 2026-06-25. Verified zero files at any depth.
- **Stray empty directories at the Codex root** — `.git`, `.agents`, `.codex`. The empty `.git` makes git commands run from the root fail with "not a repository".
- **9 browser-QA repo clones** in `2026-07-09/.../work/` — 719 files; keep the final iteration.
- **5 `node_modules` trees and 2 `.pnpm-store` directories** (one at the Codex root) — reinstallable.
- **3 broken `node_modules` symlinks** in the crosswalk and ingest worksets — resolve to nothing. Those worksets are not re-executable as they stand; their QA JSON is the record.
- **5 pearson site tarballs** — keep the newest.
- **Two vinext starters** — confirm which is canonical.

---

## 10. Assumptions and Limits

1. Status is read from committed manifests, QA JSON, state files and git metadata. Except where this document says otherwise, nothing was re-executed.
2. **The local `Codex_Repo_2026` checkout is 6 commits behind and was not pulled.** Anything about that repo describes the stale local state plus commit subjects read from the fetched remote ref.
3. `.env` files were not opened. Key validity is taken from the recorded probe status.
4. "Live on Render" is as stated in `LIVE_DEPLOYMENT_STATUS.md`; the live URL was not requested or verified.
5. The v3 crosswalk drafts are **drafts**. No row may enter the ingest queue or the binding manifest without a reviewer decision. Confidence describes the strength of the QSEN–WPS correspondence, not certainty about nursing practice.
6. External NCLEX facts in §5.1 were verified 2026-09-06 against UWorld's test plan page and NCSBN's format article. The six unverified fields were not found in either.
7. Folders described as empty were verified by recursive file count excluding `node_modules`, git internals and `.pnpm-store`.
