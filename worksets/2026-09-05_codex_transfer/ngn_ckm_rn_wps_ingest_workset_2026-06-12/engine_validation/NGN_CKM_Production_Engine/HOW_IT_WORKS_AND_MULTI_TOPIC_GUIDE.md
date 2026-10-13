# How Lesson Production Studio Works

The app turns a source-grounded topic into a complete lesson package.

## Exact sequence

1. Settings: choose local image creation or OpenAI image generation.
2. Choose input: enter one topic or upload a source topic list.
3. Build lesson: the app creates an outline, slide plan, script, case study, answer key, review files, and a slide deck.
4. Review results: inspect created files, quality checks, and review cards.
5. Schedule batch: save a topic list for a later repeated run.
6. Field guide: read detailed explanations for each field.

## Correct source input

Use a source topic list with fields like:

```csv
concept,exemplars,subject_area,content_area,specialty_area,nclex_category,ncjmm_primary,priority_framework,source_anchor,evidence_status,needs_review,module_number
Concept A,"Subtopic 1,Subtopic 2",Subject Area A,Content Area A,Specialty Area A,Category A,Recognize Cues,Priority Framework A,"Source Name, Chapter or Page Range",sourced,false,01
```

Do not use generated output files as source input. Output files describe what was already built.
