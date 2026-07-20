# ATI Parser Tests

This directory contains the Vitest unit tests and plain-text fixtures used to
verify that `server/ati-parser.ts` correctly extracts topics and scores from
every ATI report format seen in the wild.

---

## Running the tests

```bash
npm test          # single run (vitest run)
npx vitest        # watch mode during development
```

The vitest suite is also registered as a **Replit validation step** named
`test`, so it runs automatically on every task merge and surfaces failures in
the CI panel.

---

## Fixture inventory

| File | ATI format covered |
|------|--------------------|
| `fixture-inline-scores.txt` | Category header lines include an inline `62%` percentage — the most common layout for NCLEX Comprehensive Predictor reports |
| `fixture-group-scores-table.txt` | Separate "Group Scores" table with `Category  Points  Score%` rows; the Topics to Review section lists category names with no inline score |
| `fixture-subject-subcategory-format.txt` | `Subject > Subcategory: Topic Name` notation used by some RN Fundamentals/Med-Surg proctored reports |
| `fixture-no-category-score.txt` | Topics listed without any resolvable score — parser should yield `null` groupScore for all items |
| `fixture-multipage-format.txt` | Multi-page report where `Page N` headers and `Report Created` / `Please see…` metadata lines are interspersed between topic blocks; topics continue normally after each page break |

---

## How to add a new fixture

When a student uploads an ATI report that the parser does not handle
correctly, follow these steps:

### 1 — Create a plain-text fixture

Extract the raw text from the PDF (e.g. copy-paste or use `pdftotext`) and
save it as `server/tests/fixtures/fixture-<short-description>.txt`.

Keep the fixture realistic but **anonymise it**: replace the student name and
ID with made-up values, and trim any irrelevant boilerplate beyond the first
50 lines of header and the Topics to Review section.

### 2 — Identify what the parser should produce

Look at the Topics to Review block in the fixture and decide:
- Which **category names** should appear (NCLEX categories or Subject names)?
- What **groupScore** values should be assigned to each category?
- What **topic names** should be extracted?
- Should any topics carry a **subcategory**?

### 3 — Write a `describe` block

Add a new `describe('Fixture N – <format name>', () => { … })` block at the
bottom of `server/tests/ati-parser.test.ts` (increment N).

Minimum assertions for every fixture:

```ts
it('extracts topics from the report', () => {
  expect(result.topics.length).toBeGreaterThan(0);
});

it('assigns the expected groupScore to <Category> topics', () => {
  const topics = result.topics.filter(t => t.category === '<Category>');
  expect(topics.length).toBeGreaterThan(0);
  for (const t of topics) {
    expect(t.groupScore).toBeCloseTo(<expected>, 1);
  }
});

it('marks all extracted topics as needing review', () => {
  for (const t of result.topics) {
    expect(t.needsReview).toBe(true);
  }
});

it('extracts the overall score', () => {
  expect(result.studentDetails.overallScore).toBe('<score>');
});
```

Add extra assertions for any format-specific behaviour you are testing (e.g.
page-break continuity, subcategory extraction, null scores).

### 4 — Run the suite and iterate

```bash
npm test
```

If the parser does not yet handle the new format, update `server/ati-parser.ts`
and re-run until all assertions pass. Keep parser changes focused and add a
comment referencing the new fixture.

---

## Parser behaviour reference

| Behaviour | Where in parser |
|-----------|-----------------|
| Inline `Category  62%` headers inside Topics to Review | `inlineScoreMatch` branch in second pass |
| Group Scores table fallback | First pass builds `scoreMap`; second pass calls `scoreMap.get(matchedNCLEX)` |
| `Subject > Subcategory: Topic` lines | `subjectTopicMatch` regex in second pass |
| Page break / metadata lines skipped | `if (line.includes('Page') \|\| …) continue` in second pass |
| Extraction stops at `Outcomes` | `/^Outcomes\s*$/i.test(trimmedLine)` guard |
| ALT parenthetical stripped from topic name | `templateMatch` / `fullTopic` replacement |
