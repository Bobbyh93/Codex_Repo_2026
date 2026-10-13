# Data Chunker Pro Standard - v2.3

## Goal
Make Data Chunker Pro a one-folder step. The user should not manually clean text or manually enter topics.

## Folder rule
Use exactly one folder as the Data Chunker Pro output destination:

`NGN_CKM_Production_Engine/intake/data_chunker_output`

Do not choose:
- `output/`
- `output/ckm_exports/`
- `output/curriculum_masters/`
- any folder from a completed run

## Recommended Data Chunker Pro preset

Use these settings when available:

| Setting | Recommended value |
|---|---|
| Output format | JSON |
| Output folder | App intake folder above |
| Chunk size | 900-1,200 tokens, or about 3-5 paragraphs |
| Overlap | 100-150 tokens |
| Split method | Heading first, then page/paragraph |
| Metadata to preserve | source file, page number, heading/section |
| Tables | Preserve as text/markdown when possible |
| Run size | One source document or one chapter/module per run when possible |

## App behavior after chunking
1. User clicks `Process intake folder`.
2. If an OpenAI API key is configured, the app asks ChatGPT to clean chunks, detect concepts, detect subtopics, and preserve source anchors.
3. If no API key is configured, the app uses local fallback extraction.
4. The app creates a source topic table automatically.
5. User selects a detected topic and builds.

## ChatGPT API extraction prompt behavior
The app instructs the model to:
- use only supplied chunks,
- avoid inventing clinical facts,
- return strict JSON,
- detect concept, subtopics, source anchor, NCLEX/CJMM fields when evident,
- mark vague rows for review rather than pretending certainty.

