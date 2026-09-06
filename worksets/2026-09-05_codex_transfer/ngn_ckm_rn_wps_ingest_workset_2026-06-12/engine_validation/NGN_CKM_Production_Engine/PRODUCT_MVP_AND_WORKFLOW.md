# Lesson Production Studio — Product Goal, Minimum Viable Product, and Workflow

## Product goal
Create a local application that turns approved source content into:

- a teachable lesson package
- a reusable set of objective and record tables
- a course/content master workbook that accumulates production outputs over time

The application is not only a deck maker. It is a controlled lesson-production system.

## Minimum viable product
The minimum viable production version does five things well:

1. Accept a source topic table, the bundled taxonomy base that ships with the app, or a Data Chunker Pro export.
2. Let the user select course, content area, concept, and subtopics from built indexes instead of typing everything manually.
3. Produce a lesson package with a readable slide deck, scripts, case practice, answer key, and remediation map.
4. Produce structured record tables for cards, objectives, sources, links, and notes.
5. Update a course/content master workbook and detect exact duplicates before new content is created.

## Recommended user workflow

### Option A — Source topic table
1. Import the source table.
2. Preview the detected rows.
3. Select course, content area, concept, and subtopics.
4. Choose duplicate handling and build depth.
5. Run the build.
6. Review artifacts and the updated master workbook.

### Option B — Data Chunker Pro
1. Set Data Chunker Pro output to `intake\data_chunker_output` when you want the fastest no-upload workflow.
2. In the application, choose **Data Chunker output folder** and use **Process app intake folder**.
3. The application detects concept packages and proposed subtopics automatically.
4. Confirm the scope from the built indexes and bundled taxonomy base.
5. Run the build.
6. Review the lesson package, record tables, and master workbook.

### Option C — Full source table run
1. Import a control workbook or CSV.
2. Preview the rows.
3. Run all eligible rows or a subset.
4. Review the run history, duplicates, and curriculum master outputs.

## Duplicate handling modes
- **Skip exact duplicate**: do not build when the request matches an existing run exactly.
- **Contribute to existing content**: continue the build and record it as a contribution to existing content.
- **Create a new version**: build a fresh revision with a new run label.
- **Replace existing version**: rebuild and treat the new run as the current working version.

## Why the master workbook exists
The master workbook keeps lesson-production records at the course/content level so the application can answer questions like:

- What has already been built for this course?
- Which objectives already exist?
- Which content was created in this run?
- Which artifacts belong to which run?
- Was this run skipped because it was an exact duplicate?

## Naming rules
All lesson artifacts are named with course, content area, concept, and run label so files do not collide.

Examples of output categories:
- outline
- blueprint
- scripts
- case study
- answer key
- remediation map
- lesson deck
- build quality report

## Design rules
- Use structured selectors and switches when an index already exists.
- Keep free text to a minimum.
- Keep the outline before slide drafting.
- Keep slide text concise and narration separate.
- Reject exact duplicates when the user chooses to skip them.
- Record every successful run in a curriculum master workbook.


## Bundled taxonomy base
The app ships with `bundled_taxonomy/master_taxonomy_base.csv`, `bundled_taxonomy/default_topic_catalog.csv`, and bundled source/category maps so a separate taxonomy upload is not required for normal operation.

The bundled taxonomy folder includes `course_content_master_template.xlsx` as a starting shell; the live course/content master workbook is still updated automatically on each successful run.
