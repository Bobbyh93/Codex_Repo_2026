# ChatGPT API Extraction Notes - v2.3

## What changed
The application now includes an optional OpenAI-assisted extraction layer for Data Chunker Pro output.

## New backend file
`backend/openai_content_processor.py`

## What it does
When the app processes the intake folder and an API key is saved, it sends compacted Data Chunker Pro chunks to the OpenAI Responses API and asks for strict JSON topic rows:

- concept
- exemplars/subtopics
- source anchor
- subject/content/specialty area
- NCLEX category when evident
- NCJMM primary function
- priority framework
- evidence status
- review flag
- clean source-grounded summary

## Safety constraints
The prompt tells the model:
- do not invent clinical facts,
- use only supplied text and metadata,
- merge duplicates,
- preserve source/page anchors,
- set `needs_review=true` for vague or uncertain rows.

## Fallback
If no API key is saved, or the API call fails, the app falls back to deterministic local extraction and reports the fallback warning in the UI.
