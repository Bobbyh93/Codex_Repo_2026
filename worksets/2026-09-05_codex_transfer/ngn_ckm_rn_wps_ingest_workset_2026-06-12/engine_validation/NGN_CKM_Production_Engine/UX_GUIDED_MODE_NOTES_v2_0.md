# UX Guided Mode Notes v2.0

## Release purpose
This patch converts the v1.6 operator interface from tab navigation into a state-driven guided workflow.

## Implemented changes

- Added Guided Mode status bar.
- Added workflow state tracking for:
  - content loaded
  - scope selected
  - outputs selected
  - build ready
  - complete
- Added run type selector:
  - Single topic
  - Multi-topic batch
  - Full workbook
- Locked later tabs until prerequisites are satisfied.
- Added pre-build validation panel in Build Settings.
- Added frontend blocking for missing content, missing scope, and missing outputs.
- Added backend `/workflow/validate` endpoint.
- Added backend validation before `/submit` execution.
- Routed batch run types through `/workbook/run-full`.

## Behavior

Single-topic runs require:
- content loaded
- main topic selected
- at least one subtopic selected
- at least one output selected

Multi-topic and full-workbook runs require:
- content loaded
- source/control workbook path available
- at least one output selected

## Version
Application version bumped from 1.6.0 to 2.0.0.
