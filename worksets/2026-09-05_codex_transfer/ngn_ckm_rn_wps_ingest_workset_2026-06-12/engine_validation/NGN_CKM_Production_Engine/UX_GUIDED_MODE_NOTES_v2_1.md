# UX Guided Mode Notes v2.1

## Purpose

Version 2.1 tightens the operator-facing workflow so the application behaves like a guided production flow rather than a technical control panel.

## Changes

- Replaced the Step 1 input dropdown experience with visible source-method cards.
- Step 1 now shows only the controls for the selected source method.
- Moved topic-candidate action into Step 2 as a selectable topic list.
- Added topic-selection actions: select all, clear detected, and use selected topic.
- Renamed the setup panel to System readiness.
- Reworked readiness display into clear pass/pending checks:
  - Content loaded
  - Topics selected
  - Outputs selected
  - Build ready
- Added a Step 1 next-step card with direct navigation to Step 2 after content is loaded.
- Preserved backend validation and artifact enforcement from v2.0.

## Design rule

Only one active workflow decision should be visible at a time. Technical paths remain available, but they are presented as guided choices instead of simultaneous controls.
