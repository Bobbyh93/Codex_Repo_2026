# Harrity Lesson Builder Codex Package

This output bundle imports the useful work from the linked ChatGPT conversation into Codex.

## Files

- `chatgpt-artifact/App.tsx` is the React/TypeScript artifact copied from ChatGPT.
- `standalone/index.html` is a dependency-free local preview with the same core behavior.
- `standalone/cat-testing.html` is a dependency-free CAT testing prototype.
- `INTEGRATION_BRIEF.md` records the frontend, backend gate, and acceptance-check details visible in the conversation.
- `NURSING_ED_PLATFORM_FOCUS.md` connects the imported lesson builder work to the broader nursing education product.
- `CAT_FEATURE_SPEC.md` defines the next CAT testing feature slice.
- `nclex-rn-2026-blueprint.json` stores the source-backed NCLEX-RN blueprint constraints for the CAT prototype.
- `item-bank.schema.json` defines the item-bank mapping contract.
- `sample-item-bank.json` provides a small starter item bank for the CAT prototype.
- `EXECUTION_LOG.md` records the local CAT prototype smoke test.

## Run The Preview

Open `standalone/index.html` in a browser. No install step is required.

The preview validates model, voice, format, slide ID, and obvious prompt/instruction leakage before enabling `Prepare audio payload`.

Open `standalone/cat-testing.html` in a browser to run the CAT testing prototype. No install step is required.

## Next Build Target

Build the CAT testing vertical slice described in `CAT_FEATURE_SPEC.md`, using `nclex-rn-2026-blueprint.json` and `sample-item-bank.json` as the first data contracts.
