# Harrity Lesson Builder Pipeline — Supporting File Replacements

This document contains clean replacement content for:
- `references/prompt-pack.md`
- `references/schemas.md`
- `references/quality-gates.md`

---

# File: references/prompt-pack.md

# Prompt Pack

Use these templates in interactive mode. Preserve field names when the user wants deterministic output.

## 1. Intake and preflight prompt
```markdown
Build a Harrity lesson-production package from the supplied sources.

Audience level: [beginner/intermediate/advanced/mixed]
Lesson goal: [goal]
Desired language: [language]
Duration budget seconds: [seconds]
Slide budget: [min-max]
Deck format: [pptx/google slides/other]
Existing deck provided: [yes/no]
Audio strategy: [tts/human/both]
SSML required: [yes/no]
Final export target: [narrated deck/video/both]
Voice preferences: [style/voice if known]
Required terminology: [list]
Forbidden assumptions: [list]

Sources:
- text items: [list]
- tables/taxonomies: [list]
- files: [list]

Return:
1. normalized intake
2. assumptions
3. conflicts
4. warnings
5. proposed scope
6. production target summary
```

## 2. Topic identification prompt
```markdown
Identify the most useful lesson topic from the supplied source material.

Rules:
- ground the topic in the source content, not only the filename
- for spreadsheets, inspect worksheet names, headers, category fields, status fields, rollup tabs, and concentration patterns
- distinguish the domain-content story from the process or governance story
- identify noise or outlier content that should not drive the lesson

Return:
- candidate_topic
- evidence_for_topic
- dominant_content_clusters
- outlier_or_noise_clusters
- recommended_lesson_angle
- recommended_audience_fit
```

## 3. Lesson outline prompt
```markdown
Create the lesson outline only.

Rules:
- ground the outline in the identified topic scope
- show the intended teaching sequence before drafting slides
- map major sections back to source clusters or source files
- if the source is a spreadsheet, summarize the workbook’s key signals before slide drafting

Return:
- lesson_title
- lesson_summary
- teaching_sequence
- section_list
- slide_count_target
- source_coverage_map
- excluded_or_deferred_topics
```

## 4. Slide blueprint prompt
```markdown
Create the slide blueprint only.

Rules:
- keep learner-facing slide text concise
- do not place narration into `on_slide_text`
- create exactly one slide blueprint object per slide
- include `speaker_intent` but not full narration yet
- keep one core teaching objective per slide
- fit the total estimated narration time inside the budget
- keep every slide inside a layout-safe content budget
- prefer fewer bullets and shorter headlines over dense slide text
- if a slide is dense enough to threaten readability, split it

Return each slide with:
- slide_id
- slide_number
- slide_title
- lesson_section
- learning_objective
- on_slide_text
- speaker_intent
- main_point
- sub_points
- definitions
- evidence_examples
- concept_tags
- outcome_tags
- prerequisite_slide_ids
- estimated_narration_duration_seconds
- visual_notes
- layout_archetype
- estimated_text_density
- source_refs
- evidence_status
```

## 5. Blueprint QA prompt
```markdown
Audit the blueprint as a media-production blueprint, not just an instructional outline.

Check for:
- narration leakage into `on_slide_text`
- overcrowded slides
- weak or vague `speaker_intent`
- duplicate concepts
- unsupported claims
- audience mismatch
- pacing issues
- glossary drift
- tag inconsistency
- layout-archetype mismatch
- excessive text density

Return:
- qa_status
- defects
- recommended fixes
- locked slide set for narration
```

## 6. Verbatim narration prompt
```markdown
Generate the lecturer's exact spoken script for each approved slide.

Rules:
- create exactly one narration object per `slide_id`
- `speaker_script_verbatim` must be complete enough to read or synthesize as-is
- `tts_text` must be production-ready for TTS
- keep stage directions out of `tts_text`
- if useful, include SSML aligned to `tts_text`
- keep the spoken timing within `target_duration_seconds`
- do not add unsupported new topics

Return each slide with:
- slide_id
- slide_title
- target_duration_seconds
- speaker_script_verbatim
- tts_text
- ssml
- delivery_notes
- pronunciation_notes
- net_new_items
- evidence_status
```

## 7. Narration QA prompt
```markdown
Audit the narration package against the approved slide blueprint.

Check for:
- one-to-one mapping between slide_id and narration
- full spoken completeness
- separation from `on_slide_text`
- TTS readiness
- duration fit
- glossary consistency
- unsupported claims
- audience fit
- redundancy

Return:
- qa_status
- defects
- recommended fixes
- approved narration set
```

## 8. Media binding prompt
```markdown
Build the per-slide media-binding package for generated audio and deck timing.

Rules:
- produce one audio target per `slide_id`
- assign deterministic `audio_filename` values
- map each audio asset to the matching slide
- set `auto_advance_after_seconds` using audio duration plus the approved buffer
- preserve `tts_text` and `ssml` exactly

Return each slide with:
- slide_id
- audio_filename
- audio_format
- tts_text
- ssml
- target_duration_seconds
- audio_insert_target
- auto_advance_after_seconds
- transition_after_audio
- trim_silence_policy
- voice_name
- voice_settings
- pronunciation_notes
```

## 9. Deck assembly prompt
```markdown
Assemble or update the slide deck with layout-safe rendering.

Rules:
- keep slide visuals concise
- bind the correct audio file to the matching slide_id when audio exists
- set slide timing from the media package
- preserve slide order and identifiers
- do not claim the deck was edited if only a manifest was produced
- if supported, add presenter notes from the approved narration
- if supported, render slides for overlap and overflow inspection before delivery

Return:
- deck file artifact or deck assembly manifest
- per-slide binding confirmation
- deck warnings
- render QA summary
```

## 10. Deck-render QA prompt
```markdown
Audit the rendered or assembled deck for visual layout safety.

Check for:
- text overlap
- text overflow outside visible slide bounds
- broken safe margins
- unstable bullet spacing
- slide-id preservation
- narration leakage into slide bodies
- notes alignment when notes are requested

Return:
- qa_status
- overflow_findings
- overlap_findings
- slides_requiring_relayout
- approved_deck_artifact
```

## 11. Deliverables bundle prompt
```markdown
Prepare the final lesson-production bundle.

Return:
- outline artifact
- source bundle or source summary artifact
- final deck artifact or manifest
- narration artifact
- media manifest
- timing manifest
- video export artifact or manifest
- unresolved environment constraints
```

## 12. Controlled revision prompt
```markdown
Apply a change-controlled revision.

Slides or artifacts to change: [ids]
Requested changes: [list]

Rules:
- keep unaffected slide ids locked
- keep unaffected audio filenames locked unless timing or naming policy changed
- update only downstream artifacts touched by the revision
- if the request is about overlap, spacing, or readability, treat it as a deck-layout revision first
- rerun deck-render QA after layout changes
- produce a revision log

Return:
- changed artifacts only
- revision log
- re-run QA results for affected stages
```

---

# File: references/schemas.md

# Schemas

Use these canonical JSON shapes in automation mode or whenever deterministic structures are needed. Keep field names unchanged.

## Enumerations
- `audience_level`: `beginner` | `intermediate` | `advanced` | `mixed`
- `mode`: `interactive` | `automation`
- `evidence_status`: `source-grounded` | `inferred` | `illustrative-example` | `unresolved`
- `qa_status`: `pass` | `pass_with_warnings` | `fail`
- `audio_start_mode`: `automatic` | `on-click`
- `audio_format`: `mp3` | `wav` | `m4a`
- `estimated_text_density`: `low` | `medium` | `high`

## Slide identity rule
- `slide_id` is the persistent identifier and should match `^S\\d{2}[A-Z]?$`
- `slide_number` is the current order and may change if slides are inserted or reordered

## Normalized intake object
```json
{
  "audience_level": "beginner",
  "lesson_goal": "Explain the core process and enable first implementation.",
  "language": "en",
  "mode": "automation",
  "duration_budget_seconds": 1200,
  "slide_budget": {"min": 8, "max": 12},
  "deck_format": "pptx",
  "existing_deck_provided": false,
  "audio_strategy": "tts",
  "ssml_required": true,
  "final_export_target": "narrated deck plus video",
  "voice_preferences": {"style": "clear, instructional, measured"},
  "sources": {
    "text_items": ["..."],
    "tables": [],
    "files": ["..."]
  },
  "required_terminology": ["..."],
  "forbidden_assumptions": ["..."],
  "assumptions": ["..."],
  "warnings": ["..."],
  "conflicts": []
}
```

## Topic identification object
```json
{
  "stage": "topic_identification",
  "candidate_topic": "How to interpret the workbook and prioritize remediation.",
  "evidence_for_topic": [
    "Workbook includes summary status fields and category concentrations.",
    "Backlog clusters indicate a remediation story, not just a content inventory."
  ],
  "dominant_content_clusters": ["status rollups", "category hotspots", "manual review queues"],
  "outlier_or_noise_clusters": ["deprecated tabs", "empty worksheets"],
  "recommended_lesson_angle": "Teach users how to read the workbook and act on its signals.",
  "recommended_audience_fit": "beginner"
}
```

## Outline package
```json
{
  "stage": "outline",
  "lesson_title": "Reading the QA workbook",
  "lesson_summary": "Teach the learner how to interpret the workbook and prioritize the backlog.",
  "teaching_sequence": [
    "What the workbook measures",
    "How completion states work",
    "Where the backlog is concentrated",
    "What remediation order to use"
  ],
  "section_list": [
    {"section": "Orientation", "purpose": "Explain workbook role."},
    {"section": "Status model", "purpose": "Explain completion states."}
  ],
  "slide_count_target": 6,
  "source_coverage_map": [
    {"section": "Orientation", "sources": ["summary tab", "status columns"]}
  ],
  "excluded_or_deferred_topics": ["Deep row-level adjudication examples"]
}
```

## Glossary and production policy object
```json
{
  "glossary": [
    {
      "term": "slide_id",
      "definition": "A persistent identifier for a slide across revisions.",
      "synonyms_allowed": [],
      "forbidden_variants": ["slide key"],
      "first_introduced_slide_id": null
    }
  ],
  "concept_tags": ["definition", "workflow", "quality-control"],
  "outcome_tags": ["understand", "apply", "audit"],
  "synonym_policy": "Use approved glossary terms exactly unless a synonym is explicitly allowed.",
  "timing_policy": {
    "buffer_seconds_after_audio": 0.5,
    "target_words_per_minute_min": 120,
    "target_words_per_minute_max": 170
  },
  "asset_naming_policy": "Use lower-case, slide-id-prefixed filenames such as s01-audio.mp3.",
  "slide_audio_binding_policy": "Bind one audio asset to exactly one slide_id.",
  "layout_policy": {
    "title_font_min_pt": 24,
    "body_font_min_pt": 16,
    "max_bullets_per_slide": 4,
    "max_characters_per_bullet_target": 90,
    "safe_margin_inches": 0.3,
    "allow_auto_shrink": false,
    "notes_policy": "Add presenter notes from approved narration when deck output is requested."
  },
  "final_export_target": "narrated deck plus video",
  "proposed_new_tags": []
}
```

## Slide blueprint package
```json
{
  "stage": "blueprint",
  "audience_level": "beginner",
  "lesson_goal": "Explain the process and enable first use.",
  "duration_budget_seconds": 1200,
  "slides": [
    {
      "slide_id": "S01",
      "slide_number": 1,
      "slide_title": "What the process produces",
      "lesson_section": "Foundations",
      "learning_objective": "Identify the outputs created by the lesson pipeline.",
      "on_slide_text": {
        "headline": "The pipeline creates multiple controlled artifacts",
        "bullets": [
          "Outline before deck production",
          "Blueprint before narration",
          "Deck plus downstream manifests"
        ],
        "callouts": ["Keep slide text concise"]
      },
      "speaker_intent": "Explain why the visual channel and narration channel must stay separate.",
      "main_point": "The process creates a locked sequence of outline, blueprint, narration, media, and export artifacts.",
      "sub_points": [
        "Each stage has its own artifact.",
        "Approvals prevent drift.",
        "Stable slide IDs preserve traceability."
      ],
      "definitions": [
        {"term": "slide_id", "definition": "A persistent identifier for a slide across revisions."}
      ],
      "evidence_examples": [
        {"type": "source-grounded", "text": "The workflow requires a full verbatim script for each slide."}
      ],
      "concept_tags": ["workflow", "artifact-control"],
      "outcome_tags": ["understand"],
      "prerequisite_slide_ids": [],
      "estimated_narration_duration_seconds": 75,
      "visual_notes": ["Do not place the full narration on the slide."],
      "layout_archetype": "title-bullets",
      "estimated_text_density": "low",
      "source_refs": ["skill workflow", "quality gates"],
      "evidence_status": "source-grounded"
    }
  ]
}
```

## Narration package
```json
{
  "stage": "narration",
  "audience_level": "beginner",
  "slides": [
    {
      "slide_id": "S01",
      "slide_title": "What the process produces",
      "target_duration_seconds": 75,
      "speaker_script_verbatim": "This lesson begins with a production rule, not a formatting preference. The text shown on a slide is for the learner's eyes, while the narration is for the lecturer's voice. If you merge those channels, the slide becomes overcrowded and the audio pipeline becomes unreliable.",
      "tts_text": "This lesson begins with a production rule, not a formatting preference. The text shown on a slide is for the learner's eyes, while the narration is for the lecturer's voice. If you merge those channels, the slide becomes overcrowded and the audio pipeline becomes unreliable.",
      "ssml": "<speak>This lesson begins with a production rule, not a formatting preference. <break time=\"300ms\"/> The text shown on a slide is for the learner's eyes, while the narration is for the lecturer's voice.</speak>",
      "delivery_notes": ["Use a confident explanatory tone."],
      "pronunciation_notes": [],
      "net_new_items": [],
      "evidence_status": "source-grounded"
    }
  ]
}
```

## Media binding package
```json
{
  "stage": "media",
  "voice_style": "clear, instructional, measured",
  "slides": [
    {
      "slide_id": "S01",
      "audio_filename": "s01-audio.mp3",
      "audio_format": "mp3",
      "tts_text": "This lesson begins with a production rule, not a formatting preference.",
      "ssml": "<speak>This lesson begins with a production rule, not a formatting preference.</speak>",
      "target_duration_seconds": 75,
      "audio_insert_target": "slide:S01",
      "auto_advance_after_seconds": 75.5,
      "transition_after_audio": "advance after clip ends",
      "trim_silence_policy": "trim leading and trailing silence",
      "voice_name": "alloy",
      "voice_settings": {"speaking_rate": 1.0},
      "pronunciation_notes": []
    }
  ]
}
```

## Deck assembly package
```json
{
  "stage": "deck_assembly",
  "deck_format": "pptx",
  "deck_file": "lesson_deck.pptx",
  "slides": [
    {
      "slide_id": "S01",
      "slide_number": 1,
      "audio_filename": "s01-audio.mp3",
      "audio_bound": true,
      "audio_start_mode": "automatic",
      "auto_advance_after_seconds": 75.5,
      "speaker_notes_present": true,
      "deck_warnings": []
    }
  ],
  "render_qa_summary": {
    "qa_status": "pass",
    "overflow_findings": [],
    "overlap_findings": [],
    "slides_requiring_relayout": []
  }
}
```

## Video export package
```json
{
  "stage": "video_export",
  "deck_file": "lesson_deck_with_audio.pptx",
  "audio_manifest_file": "audio_manifest.json",
  "timing_manifest_file": "timing_manifest.json",
  "video_output_file": "lesson_video.mp4",
  "export_status": "ready_for_render",
  "unresolved_constraints": []
}
```

## Revision log object
```json
{
  "revision_log": [
    {
      "item_type": "slide",
      "item_id": "S03",
      "previous_value_summary": "Blueprint leaked narration into on-slide bullets and overflowed the layout.",
      "new_value_summary": "Blueprint now keeps concise bullets, uses a lower-density layout, and moves the full explanation into the narration object.",
      "reason": "The original slide broke both the visual-versus-narration contract and the layout safety policy.",
      "downstream_effects": ["Regenerate narration for S03", "Recompute media timing", "Update deck layout and notes"]
    }
  ]
}
```

---

# File: references/quality-gates.md

# Quality Gates

Use these checks before approving a stage.

## Gate 1: Preflight
Pass only if:
- the lesson goal is clear or explicitly assumed
- audience level is set or explicitly assumed
- sources are listed
- duration or slide budget exists
- production target is named
- conflicts and warnings are visible

## Gate 2: Topic identification
Pass only if:
- the candidate topic is grounded in source content
- evidence for the topic is explicit
- dominant clusters are identified
- noise or outlier content is identified when relevant
- the recommended lesson angle fits the audience and source purpose

Fail if:
- the topic is inferred mainly from the filename
- the topic ignores obvious concentration patterns in the source
- the chosen angle is not well supported by the source material

## Gate 3: Outline
Pass only if:
- the outline is grounded in the identified topic scope
- the teaching sequence is coherent
- source coverage is visible
- deferred topics are called out when relevant
- the slide count target is plausible for the duration budget

Fail if:
- the outline drifts away from the identified topic
- the teaching sequence is not usable for slide drafting
- key source clusters are omitted without explanation

## Gate 4: Blueprint
Pass only if every slide:
- has a unique `slide_id`
- has concise learner-facing `on_slide_text`
- does not contain the full narration in `on_slide_text`
- has one clear learning objective
- has a usable `speaker_intent`
- has an estimated narration duration
- uses approved terminology and tags
- avoids unsupported claims
- includes a valid layout archetype
- stays within acceptable text density
- cites relevant source references

Fail the blueprint if:
- slide text is overloaded
- multiple core concepts are hidden in one slide
- slide bullets read like a transcript
- pacing materially exceeds the lesson budget
- layout density is likely to cause overflow or overlap

## Gate 5: Narration
Pass only if every slide:
- has exactly one narration object
- contains a complete `speaker_script_verbatim`
- includes production-ready `tts_text`
- maps one-to-one to `slide_id`
- fits the timing budget
- matches the audience level
- preserves glossary consistency

Fail the narration if:
- the spoken script is just a bullet expansion stub
- important explanatory transitions are missing
- the narration depends on unseen visuals
- `tts_text` is incomplete or polluted by stage directions

## Gate 6: Media binding
Pass only if every slide:
- has an `audio_filename`
- has a timing value suitable for auto-advance
- has a deterministic insert target
- preserves one audio asset target per slide
- uses the approved naming policy

Fail the media package if:
- audio assets do not map cleanly to slide ids
- timing fields are missing
- file naming is inconsistent
- the package would require manual reinterpretation to bind assets

## Gate 7: Deck assembly
Pass only if:
- the deck file or deck manifest preserves slide ids
- audio bindings are explicit per slide when audio exists
- auto-advance values are explicit per slide
- slide visuals remain concise
- narration is not dumped into slide bodies
- presenter notes are present when requested and supported

Fail the deck assembly if:
- audio is ambiguously mapped
- slide timing is missing
- visual and narration channels have been collapsed
- the deck output is only a manifest even though real deck creation was available

## Gate 8: Deck-render QA
Pass only if:
- no text boxes overlap
- no text overflows the visible slide area
- title and body regions preserve safe margins
- bullet spacing is visually stable
- slide IDs are preserved
- slide text remains concise
- narration is not dumped into slide bodies
- notes or presenter-script linkage is present when requested

Fail the deck-render stage if:
- any text overlaps or spills outside the intended region
- more than one slide exceeds the safe text-density threshold
- slide body font size falls below the defined minimum
- notes, slide text, and narration drift out of sync

## Gate 9: Deliverables bundle
Pass only if:
- there is an outline artifact
- there is a source bundle or source summary artifact
- there is a final deck artifact or a deterministic deck manifest
- there is a narration artifact
- there is a media manifest
- unresolved renderer limits are explicitly stated if direct export is unavailable

Fail if:
- the minimum artifact rule was not met
- downstream media/export claims exceed what the environment actually produced

## Global QA reminders
Always check for:
- duplicate slide ids
- glossary drift
- taxonomy drift
- unsupported claims
- timing drift across stages
- narration leakage into slide text
- layout drift between blueprint and deck
- revisions that changed unaffected slide ids or audio filenames
- overlap or overflow introduced during deck revisions

