# Slide Script TTS Contract

Date: 2026-06-10
Decision ID: HLB-AUDIO-001
Canonical ID: slide_script_tts
User-facing label: Slide Script TTS Renderer

## Purpose
Generate production audio files from locked slide narration scripts for Harrity lesson packages.

## Source of Truth
The source of truth is `narration_script_locked`, not visible slide text, not draft speaker notes, and not the PPTX deck object.

## Default Runtime
- provider: openai
- model: gpt-4o-mini-tts
- voice: marin
- format: mp3
- fallback_policy: block_not_fake
- output mode: one audio file per slide

## Required Inputs
- package_id
- lesson_title
- tts_contract_version
- render_policy
- slides[]
- slide_id
- slide_number
- slide_title
- narration_script_status
- narration_script_locked
- duration_target_sec
- output_file

## Blocked Inputs
- draft speaker notes
- visible slide text only
- unresolved reviewer comments
- raw citations meant for internal review
- raw URLs
- unresolved abbreviations
- unapproved clinical claims
- TODO notes
- bracketed editorial comments

## Required Gates
1. script_locked
2. source_traceability_present when source anchors are available
3. tts_safe_text_passed
4. output_path_validated
5. qa_manifest_written

## Status Flow
draft -> script_ready -> script_locked -> tts_ready -> tts_rendered -> tts_qa_passed -> video_handoff_ready -> released

## Blocked Transitions
- draft -> tts_ready
- draft -> tts_rendered
- script_ready -> tts_rendered
- tts_rendered -> released without tts_qa_passed
