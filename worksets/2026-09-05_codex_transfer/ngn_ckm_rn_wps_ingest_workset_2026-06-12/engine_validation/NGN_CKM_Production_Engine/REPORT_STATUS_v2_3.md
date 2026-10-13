# Report Status - Version 2.3

## Completed
- Simplified UX to a four-step operator workflow.
- Removed confusing project type/object fields from the user-facing plan.
- Fixed `[object Object]` display risk by sending scalar build options only.
- Added one-folder Data Chunker Pro method.
- Added a Data Chunker Pro standard preset guide.
- Added optional OpenAI/ChatGPT API extraction for source cleaning and topic detection.
- Added OpenAI text model and extraction toggle settings.
- Added local fallback when OpenAI extraction is unavailable.

## Intended user flow
1. Built-in topics for fastest testing, or Data Chunker Pro JSON into the app intake folder.
2. App processes source and detects topics.
3. User selects topic/subtopics.
4. User builds lesson package.

## Version
Backend FastAPI version: 2.3.0
