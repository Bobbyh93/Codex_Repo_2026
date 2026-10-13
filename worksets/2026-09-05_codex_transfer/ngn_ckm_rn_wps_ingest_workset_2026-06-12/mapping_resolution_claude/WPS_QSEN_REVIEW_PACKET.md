# RN WPS → QSEN Mapping Resolution — Claude Draft Packet

**Work set:** `ngn_ckm_rn_wps_ingest_workset_2026-06-12`
**Blocked step filled:** `mapping_resolution` — 36 process rows left at `credential_pending` on 2026-06-12
**Drafted by:** Claude, standing in for the `gpt-5.4-mini` call in `build_mapping_resolution.py`
**Drafted:** 2026-08-27 · **Merged and validated against the workset:** 2026-09-06
**Status:** DRAFT ONLY — no row may enter the ingest queue or binding manifest without a reviewer decision

**Run result: 36 of 36 rows drafted, 0 hallucination validation errors.**

**No OpenAI API call was made. No source file was modified. No original artifact was overwritten.**

---

## 1. What Changed

`build_mapping_resolution.py` was built to send each unresolved process row plus its 12 candidate QSEN statements to a model, and to validate the reply against a strict anti-hallucination contract. On 2026-06-12 it ran with no API key, wrote 36 rows of `credential_pending`, and stopped.

The model was the only missing part. These drafts fill that slot under the same contract:

- a `draft_mapping`'s top QSEN ID must come from that row's own candidate set
- every AACN sub-competency code must belong to the chosen QSEN statement
- every alternate ID must come from that row's candidate set

AACN codes are read from the source candidate rows by the merge script, never typed by hand, so code transcription error is structurally impossible.

---

## 2. Results

| Outcome | Rows | Meaning |
|---|---:|---|
| `draft_mapping` | 23 | A defensible QSEN counterpart exists in the candidate set |
| `not_mappable` | 9 | The WPS process has no QSEN counterpart, even in the full 207-statement set |
| `insufficient_evidence` | 4 | The candidate set is filler; regenerate candidates before review |
| **Total** | **36** | |

| Confidence | Rows |
|---|---:|
| high | 1 |
| medium | 5 |
| low | 17 (plus 13 non-drafted rows the schema also records as `low`) |
| n/a (not drafted) | 13 |

Hallucination validation errors on the real run: **0**. Every top ID and alternate was checked against its own candidate set, and every AACN code was copied from the chosen candidate row rather than typed.

---

## 3. The Three Findings That Matter More Than the Drafts

### 3.1 Nine of these rows should never have been in the review queue

`not_mappable` is not a failure here — it is the correct answer. QSEN's six competency domains (Patient-Centered Care, Teamwork & Collaboration, Evidence-Based Practice, Quality Improvement, Safety, Informatics) are deliberately *cross-cutting* competencies. They were never intended to cover the full clinical skill set. So these WPS processes have no QSEN counterpart by design:

| Process | Belongs to |
|---|---|
| RN-WPS-013 Diagnose medical conditions | AACN Domain 2 + NCJMM clinical judgment |
| RN-WPS-017 Immunize patients | AACN Domain 3 (Population Health) |
| RN-WPS-019 Maintain inventory of supplies | AACN Domain 7 (resource stewardship) |
| RN-WPS-021 Manage healthcare operations | AACN Domains 7 and 10 |
| RN-WPS-014 Direct healthcare delivery programs | AACN Domains 7 and 10 |
| RN-WPS-036 Test biological specimens | clinical skill, no QSEN counterpart |
| RN-WPS-039 Treat medical emergencies | AACN Domain 2 + NCJMM |
| **RN-WPS-029 Prescribe assistive devices** | **advanced practice — see 3.2** |
| **RN-WPS-030 Prescribe medications** | **advanced practice — see 3.2** |

Routing these to the AACN domains directly, instead of forcing them through the QSEN bridge, removes 9 rows from the review burden permanently.

### 3.2 Two rows are outside prelicensure scope entirely

RN-WPS-029 and RN-WPS-030 are *prescribing*. That is an advanced-practice activity in every US jurisdiction, and it appears here because the WPS source derives from an O\*NET registered-nurse profile that blends RN and APRN tasks. These belong on the **source exclusion list**, not the review queue — the same list that already carries `*CIP Code` and `Provider`.

### 3.3 The candidate generator is the real bottleneck, not the model

The lexical matcher returns a fixed 12 candidates per process. When it finds fewer than 12 real matches it pads the list with sequential filler — QSEN_0001, QSEN_0002, QSEN_0003 … at score `0.00`. Four rows are mostly filler:

| Process | Filler candidates |
|---|---|
| RN-WPS-003 Administer non-IV medications | 10 of 12 |
| RN-WPS-008 Assist during examinations | 9 of 12 |
| RN-WPS-028 Prepare patients for procedures | 11 of 12 |
| RN-WPS-037 Train caregivers | 8 of 12 |

Worse, the matcher sometimes ranks a false positive at the top. For RN-WPS-024 and RN-WPS-025 ("Monitor all aspects of patient care") the highest-scoring candidate at 0.23 is *"Describe strategies to empower patients or families in all aspects of the health care process"* — matched on the phrase **"all aspects"** and nothing else. For RN-WPS-036 ("Conduct specified laboratory tests") the entire candidate set matched on the token **"information"**.

And in five rows the *correct* QSEN statement exists in the full 207-statement set but was never offered as a candidate:

| Process | Missing candidate that should have been offered |
|---|---|
| RN-WPS-003 | QSEN_0158, QSEN_0160, QSEN_0162 (safety practice family) |
| RN-WPS-008 | QSEN_0062 (function within own scope as team member) |
| RN-WPS-018 | QSEN_0161 (communicate observations to the health care team) |
| RN-WPS-020 | QSEN_0188, QSEN_0189 (navigate and document in the EHR) |
| RN-WPS-034 | QSEN_0049, QSEN_0062, QSEN_0065 (scopes of practice family) |

**Implication:** rerunning the same matcher with a working API key would not have fixed these. Semantic candidate generation over all 207 statements — replacing the top-12 lexical prefilter — is the higher-leverage change, and it is what would move the RN WPS bridge past its 6-of-402 confident rate.

---

## 4. Duplicate Task Text

Several processes share identical source task text and must be resolved as pairs or triples, or they will drift apart:

| Shared source task | Processes |
|---|---|
| "Perform physical examinations, make tentative diagnoses, and treat patients en route…" | 013, 016, 039 |
| "Monitor all aspects of patient care, including diet and physical activity." | 024, 025 |
| "Observe nurses and visit patients to ensure proper nursing care." | 022, 035 |
| "Prescribe or recommend drugs, medical devices, or other forms of treatment…" | 029, 030 |
| "Order, interpret, and evaluate diagnostic tests…" | 006, 026 |
| "Prepare rooms, sterile instruments, equipment, or supplies…" | 019, 027 |
| "Direct or coordinate infection control programs…" | 005, 014 |
| "Prepare patients for and assist with examinations or treatments." | 008, 028 |
| "Provide health care, first aid, immunizations…" | 017, 038 |

Note the inconsistency this exposes: 019 and 027 share a task but received different outcomes (`not_mappable` vs `draft_mapping`), because the *concept labels* differ — "Maintain inventory" vs "Prepare supplies for use". Both readings are defensible. The reviewer should pick one and apply it to both.

Also worth flagging: RN-WPS-022's concept label is **"Monitor health or behavior of people or animals"** — a generic O\*NET work-activity label carried through unedited. Map from the task text, not the label.

---

## 5. The Drafts

Confidence is about the *strength of the correspondence*, not about how sure I am of my reasoning. `low` means a reviewer should expect to change it.

### High confidence (1)

| Process | → QSEN | Statement | Why |
|---|---|---|---|
| RN-WPS-011 Conduct research | QSEN_0097 | Participate effectively in appropriate data collection and other research activities | Clean one-to-one. "Engage in research activities related to nursing" is what the statement describes. |

### Medium confidence (5)

| Process | → QSEN | Statement | Why |
|---|---|---|---|
| RN-WPS-002 Administer anesthetics/sedatives | QSEN_0018 | Initiate effective treatments to relieve pain and suffering… | Administering the agent *is* initiating the pain treatment. |
| RN-WPS-007 Assess work/living/social environments | QSEN_0161 | Communicate observations or concerns related to hazards and errors… | Environmental assessment for health/safety problems is hazard identification. |
| RN-WPS-009 Collaborate with professionals to plan treatment | QSEN_0014 | Communicate patient values, preferences and expressed needs to other members of health care team | The strongest genuine Teamwork & Collaboration mapping in the batch. |
| RN-WPS-032 Record patient medical histories | QSEN_0189 | Document and plan patient care in an electronic health record | Direct informatics match; the candidate set happened to contain the right statement. |
| RN-WPS-033 Refer patients to practitioners/resources | QSEN_0020 | Assess level of patient's decisional conflict and provide access to resources | Matches on the resource-access half of the statement. |

### Low confidence (17)

| Process | → QSEN | Reviewer flag |
|---|---|---|
| RN-WPS-004 Advise communities/institutions | QSEN_0161 | Policy advocacy thin in QSEN |
| RN-WPS-005 Advise medical personnel | QSEN_0169 | Better fits (0161, 0156) absent from candidates |
| RN-WPS-006 Analyze test data or images | QSEN_0095 | Contextual only; clinical skill outside QSEN |
| RN-WPS-010 Communicate health info to public | QSEN_0006 | Population education is AACN Domain 3 |
| RN-WPS-015 Evaluate patient outcomes | QSEN_0134 | **Level mismatch** — QI-level statement, patient-level task |
| RN-WPS-016 Examine patients | QSEN_0016 | Partial; physical assessment outside QSEN |
| RN-WPS-018 Inform professionals re conditions | QSEN_0189 | **Candidate gap** — QSEN_0161 missing |
| RN-WPS-020 Maintain facility records | QSEN_0207 | **KSA mismatch** — attitude statement on a skill task |
| RN-WPS-022 Monitor health or behavior | QSEN_0192 | **Label quality** — generic O\*NET label |
| RN-WPS-023 Monitor during treatments | QSEN_0175 | **KSA mismatch** — attitude on a skill task |
| RN-WPS-024 Monitor progress/response | QSEN_0016 | **False positive warning** — do not take QSEN_0006 |
| RN-WPS-025 Monitor post-surgery | QSEN_0016 | Same as 024; resolve together |
| RN-WPS-026 Order diagnostic tests | QSEN_0091 | May exceed RN scope |
| RN-WPS-027 Prepare supplies/equipment | QSEN_0158 | Reconcile with 019 |
| RN-WPS-034 Supervise care personnel | QSEN_0010 | **Candidate gap** — scopes-of-practice family missing |
| RN-WPS-035 Supervise service workers | QSEN_0010 | Shares task with 022 |
| RN-WPS-038 Treat acute illness/injury | QSEN_0029 | Very broad; consider holding |

Full rationales and review notes are in the generated CSV and JSONL.

---

## 6. How to Run It

Both files go anywhere; the script defaults to the workset path on this machine.

```powershell
python merge_claude_mapping_resolution.py `
  --workset "C:\Users\RHarrity\Documents\Codex\ngn_ckm_rn_wps_ingest_workset_2026-06-12" `
  --suggestions claude_suggestions.json
```

Writes a new folder `mapping_resolution_claude\` beside the original:

| File | Purpose |
|---|---|
| `wps_process_mapping_resolution_claude_draft.csv` | The reviewer instrument — open in Excel, fill `review_decision`, `reviewer_notes`, `final_qsen_statement_id` |
| `claude_mapping_suggestions.jsonl` | Machine record, one line per process, with validation errors |
| `claude_mapping_resolution_qa.json` | QA record matching the shape of the original, with provenance |

Exit code 0 means every suggestion passed the contract. Exit code 2 means validation errors were found; they are written into the QA file and the CSV rather than being silently dropped.

Nothing in `mapping_resolution\` is touched. The original `credential_pending` record stays as evidence of what the pipeline did on 2026-06-12.

---

## 7. Recommended Sequence

1. **Move RN-WPS-029 and RN-WPS-030 to the source exclusion list.** Prescribing is out of prelicensure scope. −2 rows.
2. **Accept the 9 `not_mappable` rows and route them to AACN domains directly.** −9 rows.
3. **Review the 6 high- and medium-confidence drafts.** These are the ones likely to survive as-is.
4. **Decide the 4 duplicate-task pairs together**, especially 019/027 where the two readings currently disagree.
5. **Regenerate candidates semantically for the 4 filler rows and the 5 candidate-gap rows** before reviewing them — reviewing a bad candidate set wastes the reviewer's judgment.
6. **Then** the 17 low-confidence drafts, which is the real work.

Steps 1 and 2 cut the queue from 36 to 25 before anyone reads a single mapping.

---

## 8. Assumptions

1. These drafts are the product of reading the task text, the concept label, and the 12 supplied candidate statements. No external nursing source was consulted and no clinical authority is claimed.
2. Confidence reflects the strength of the QSEN-to-WPS correspondence, not certainty about nursing practice.
3. `not_mappable` is a claim about the QSEN statement set only. Every such row still maps somewhere in AACN — the note on each row says where.
4. AACN sub-competency codes are copied by the merge script from the chosen candidate row. They are exactly the codes the source workbook already attached to that QSEN statement; none were selected or invented independently.
5. The candidate-gap observations in §3.3 name statements from the full 207-statement QSEN index. They are deliberately **not** listed as alternates, because the contract forbids alternates outside the candidate set. They are review notes for the next candidate-generation run.
6. The merge script has now RUN against the real workset (2026-09-06): 36 of 36 rows drafted, 0 hallucination validation errors, source files unmodified. Its QA file records `confidence_counts` as high 1 / medium 5 / low 30, because the schema requires a confidence value on non-drafted rows too; the 17 genuinely low-confidence drafts are the `draft_mapping` rows in the table above.
