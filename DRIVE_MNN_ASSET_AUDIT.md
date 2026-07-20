# Drive MNN Asset Audit

Date: July 3, 2026

## Folder

- Google Drive folder: `MNN`
- Folder ID: `18DNf_F1E9rdHjEDHYlqDeHlSKULZgTmb`
- Role: maternal-newborn nursing package hub for deck exemplars, package manifests, chapter folders, validation files, and source-prep artifacts.

## High-Value Contents

| Asset area | Observed contents | MVP use |
| --- | --- | --- |
| `20260503_MN_All_Chapters_Deck_Package` | README, `decks`, `supporting_files` | Import as a Drive package collection. Use deck set and supporting files as package metadata/reference material. |
| `supporting_files` | master manifest, slide blueprint master, QA log, production plan, visual asset register, manifest JSON | Use as Source Studio/package-import metadata, export validation references, and package-readiness signals. |
| `decks` | Maternal-newborn chapter Google Slides decks across antepartum, intrapartum, postpartum, and newborn topics | Use as deck grammar, pacing, and learner-facing format exemplars. Do not treat slide text as citation source truth without approval. |
| root `chapters` folder | 27 chapter folders, from contraception through newborn complications | Use as package/source-pack candidates. Each chapter can become a registered source collection with its own approval state. |
| chapter folder example | README, validation report, Harrity deck, bound placeholder, embedded images, `qa_summary.json`, `taxonomy.json`, `source.json`, `runtime.json`, `slide_content.json`, `deck.json`, `outline.json`, `script.json` | This is the clearest package anatomy for a future Drive package importer. |
| `maternal_newborn_harrity_chapter_decks` | `decks` and `validation` folders, including chapter-level Harrity decks and a batch manifest | Use as the chapter-deck exemplar set and validation-history reference. |
| `maternal_newborn_notes_pass` | narrative plan, notes pass validation, chapter folders | Use as a notes/source-prep candidate, especially for guided notes and remediation support after source approval. |

## Immediate Product Interpretation

The MNN folder should be registered as a first-class related asset collection in NurseStudy, but not as automatic source truth. The right MVP behavior is:

1. Register the Drive folder and top-level package manifests as source/package metadata.
2. Show chapter/deck/package provenance in Source Studio.
3. Let admins promote specific chapter folders or files to approved source records only after citation policy and ownership are reviewed.
4. Use decks as template and slide-grammar exemplars.
5. Use `source.json`, `taxonomy.json`, QA summaries, manifests, and slide blueprints as package-import clues.
6. Route large or textbook-like PDFs through Data Chunker Pro before NurseStudy ingestion.

## Proposed Source Registry Roles

| Registry role | Applies to | Approval behavior |
| --- | --- | --- |
| `drive_package_hub` | `MNN` root folder | Reference-only until imported into specific package records. |
| `drive_deck_package` | all-chapters deck package | Reference/template by default. |
| `drive_supporting_manifest` | master manifest, slide blueprint, QA log, production plan | Metadata/reference. Can power validation but not clinical claims. |
| `drive_chapter_source_candidate` | 27 chapter folders | Requires admin approval before generation uses content as source truth. |
| `drive_harrity_deck_exemplar` | chapter Google Slides decks | Template/deck grammar only unless separately approved. |
| `drive_notes_pass_candidate` | notes pass chapter folders | Requires approval and citation policy before generation. |

## Recommended Next Build

Add a Drive package import action to Source Studio:

- Accept a Drive folder URL.
- Create one package-hub record plus child source candidates.
- Extract metadata from manifests, blueprint sheets, validation docs, deck titles, and chapter folders.
- Detect chapter number/topic, deck count, manifest count, validation count, and taxonomy/source JSON presence.
- Mark imported records as `reference_only` until an admin approves them.
- Link approved records to generation with citation policy, chunk count, and package provenance visible.

## Implementation Status

Implemented first pass:

- Admin endpoint: `POST /api/admin/lesson-builder/drive-packages/import`
- Admin UI: Source Studio `Import Drive Package Hub`
- MNN preset: `https://drive.google.com/drive/folders/18DNf_F1E9rdHjEDHYlqDeHlSKULZgTmb`
- Created record types: `drive_package_hub`, `drive_supporting_manifest`, `drive_presentation_collection`, `drive_notes_pass`, and 27 `drive_chapter_source_candidate` records.
- Safety behavior: imported records are pending/reference-only and require approval before source-truth use.

Live Render verification:

- First import completed successfully on `https://nursestudy-lesson-builder.onrender.com`.
- Created 31 source records and 38 manifest/file rows.
- Registry summary after import: 27 chapter source candidates, 1 package hub, 1 supporting manifest record, 1 deck collection record, and 1 notes-pass candidate.
- Repeat import returned `duplicate` and created zero new source/file rows.

## Known Limits

- Drive inspection verified structure and metadata, not clinical accuracy.
- ChatGPT project pages still require signed-in inspection before their files can be summarized.
- Workspace agents are useful production operators, but no inspected agent currently has a live API channel.
- Proprietary/manual-like content must be paraphrased and cited safely, with faculty or AI review before pilot use.
