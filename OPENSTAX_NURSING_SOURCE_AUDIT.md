# OpenStax Nursing Source Audit

## Access Check

- Source URL: `https://openstax.org/subjects/nursing`
- Browser title observed: `Browse free nursing textbooks | OpenStax`
- Verified date: 2026-07-03
- Use in NurseStudy: public catalog/reference metadata first; not automatic RAG or AI source truth.

## Catalog Categories And Books

The OpenStax Nursing subject page exposes six nursing categories and eight book records:

| Category | Book | Online URL | PDF URL |
| --- | --- | --- | --- |
| Fundamentals and Skills | Clinical Nursing Skills | `https://openstax.org/books/clinical-nursing-skills/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Clinical-Nursing-Skills-WEB.pdf` |
| Fundamentals and Skills | Fundamentals of Nursing | `https://openstax.org/books/fundamentals-nursing/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Fundamentals_of_Nursing_-_WEB.pdf` |
| Maternal-Newborn Nursing | Maternal-Newborn Nursing | `https://openstax.org/books/maternal-newborn-nursing/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Maternal-Newborn_Nursing-WEB.pdf` |
| Medical-Surgical Nursing | Medical-Surgical Nursing | `https://openstax.org/books/medical-surgical-nursing/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Medical-Surgical_Nursing-WEB.pdf` |
| Nutrition and Pharmacology | Nutrition for Nurses | `https://openstax.org/books/nutrition/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Nutrition_for_Nurses-WEB.pdf` |
| Nutrition and Pharmacology | Pharmacology for Nurses | `https://openstax.org/books/pharmacology/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Pharmacology-WEB.pdf` |
| Population and Community Health | Population Health for Nurses | `https://openstax.org/books/population-health/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Population_Health_for_Nurses_-_WEB.pdf` |
| Psychiatric-Mental Health Nursing | Psychiatric-Mental Health Nursing | `https://openstax.org/books/psychiatric-mental-health/pages/1-introduction` | `https://assets.openstax.org/oscms-prodcms/media/documents/Psychiatric-Mental_Health_Nursing-WEB.pdf` |

## Compliance And Product Policy

OpenStax Nursing is useful for coverage planning, curriculum maps, and learner/faculty links, but it needs a special source policy:

- License shown on the subject page footer: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.
- Book pages include an AI-ingestion restriction: do not ingest the books into large language models or generative AI offerings without OpenStax permission.
- NurseStudy should therefore register OpenStax as link-only/source-catalog metadata by default.
- Do not download, chunk, embed, summarize with live AI, or use the PDF/book text for generation unless OpenStax permission is documented.
- If permission is granted later, create a separate approved source pack with provenance, citation policy, and chunking records.

## Implemented Source Studio Path

Source Studio now supports OpenStax Nursing catalog registration:

- Admin UI card: `Register OpenStax Nursing Catalog`.
- API: `POST /api/admin/lesson-builder/openstax/import`.
- Source kinds:
  - `openstax_nursing_catalog`
  - `openstax_book_reference`
- Default approval: `pending`.
- Citation policy: `link_only_no_llm_ingestion_without_permission`.
- Metadata guardrails:
  - `origin: "openstax"`
  - `referenceOnly: true`
  - `noLlmIngestionWithoutPermission: true`
  - `requiresOpenStaxPermissionBeforeRag: true`
  - `blockedForGeneration: true`

## Live Render Verification

- Live app: `https://nursestudy-lesson-builder.onrender.com/`
- Deployed bundle checked: `assets/index-DXG9_Bvg.js`
- Bundle contains `Register OpenStax Nursing Catalog` and `/api/admin/lesson-builder/openstax/import`.
- Live authenticated import completed with 9 source records: 1 `openstax_nursing_catalog` and 8 `openstax_book_reference`.
- Import created 8 virtual book-link file records.
- Repeat import returned `duplicate` with zero new source records.
- Source registry shows all 9 OpenStax records with `blockedForGeneration` and `noLlmIngestionWithoutPermission` guardrails.

## MVP Use

Use OpenStax as a public nursing coverage map and trusted link catalog. It can help define what topics the MVP should support next, especially maternal-newborn, medical-surgical, pharmacology, psychiatric-mental health, population health, fundamentals, and skills. It should not replace approved local/Drive source truth for AI-assisted lesson generation until permission is confirmed.
