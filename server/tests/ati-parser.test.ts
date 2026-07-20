import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseATIReport, getTopicsForReview } from '../ati-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

// ─────────────────────────────────────────────────────────
// Fixture 1: Inline percentages on NCLEX category header lines
// ─────────────────────────────────────────────────────────
describe('Fixture 1 – inline percentages on category headers', () => {
  const text = loadFixture('fixture-inline-scores.txt');
  const result = parseATIReport(text);

  it('extracts topics from the report', () => {
    expect(result.topics.length).toBeGreaterThan(0);
  });

  it('assigns the inline Management of Care score (62) to its topics', () => {
    const mocTopics = result.topics.filter(t => t.category === 'Management of Care');
    expect(mocTopics.length).toBeGreaterThan(0);
    for (const topic of mocTopics) {
      expect(topic.groupScore).toBe(62);
    }
  });

  it('assigns the inline Pharmacological and Parenteral Therapies score (59) to its topics', () => {
    const pharmTopics = result.topics.filter(
      t => t.category === 'Pharmacological and Parenteral Therapies'
    );
    expect(pharmTopics.length).toBeGreaterThan(0);
    for (const topic of pharmTopics) {
      expect(topic.groupScore).toBe(59);
    }
  });

  it('assigns the inline Physiological Adaptation score (60) to its topics', () => {
    const physTopics = result.topics.filter(t => t.category === 'Physiological Adaptation');
    expect(physTopics.length).toBeGreaterThan(0);
    for (const topic of physTopics) {
      expect(topic.groupScore).toBe(60);
    }
  });

  it('assigns the inline Reduction of Risk Potential score (64) to its topics', () => {
    const rrpTopics = result.topics.filter(t => t.category === 'Reduction of Risk Potential');
    expect(rrpTopics.length).toBeGreaterThan(0);
    for (const topic of rrpTopics) {
      expect(topic.groupScore).toBe(64);
    }
  });

  it('marks all extracted topics as needing review', () => {
    for (const topic of result.topics) {
      expect(topic.needsReview).toBe(true);
    }
  });

  it('extracts the student name', () => {
    expect(result.studentDetails.studentName).toBeTruthy();
  });

  it('extracts the overall score', () => {
    expect(result.studentDetails.overallScore).toBe('68.4');
  });
});

// ─────────────────────────────────────────────────────────
// Fixture 2: Group Scores table fallback
// ─────────────────────────────────────────────────────────
describe('Fixture 2 – Group Scores table fallback', () => {
  const text = loadFixture('fixture-group-scores-table.txt');
  const result = parseATIReport(text);

  it('extracts topics from the report', () => {
    expect(result.topics.length).toBeGreaterThan(0);
  });

  it('uses the Group Scores table score (58.3) for Management of Care topics', () => {
    const mocTopics = result.topics.filter(t => t.category === 'Management of Care');
    expect(mocTopics.length).toBeGreaterThan(0);
    for (const topic of mocTopics) {
      expect(topic.groupScore).toBeCloseTo(58.3, 1);
    }
  });

  it('uses the Group Scores table score (63.6) for Pharmacological and Parenteral Therapies topics', () => {
    const pharmTopics = result.topics.filter(
      t => t.category === 'Pharmacological and Parenteral Therapies'
    );
    expect(pharmTopics.length).toBeGreaterThan(0);
    for (const topic of pharmTopics) {
      expect(topic.groupScore).toBeCloseTo(63.6, 1);
    }
  });

  it('uses the Group Scores table score (61.1) for Physiological Adaptation topics', () => {
    const physTopics = result.topics.filter(t => t.category === 'Physiological Adaptation');
    expect(physTopics.length).toBeGreaterThan(0);
    for (const topic of physTopics) {
      expect(topic.groupScore).toBeCloseTo(61.1, 1);
    }
  });

  it('marks all extracted topics as needing review', () => {
    for (const topic of result.topics) {
      expect(topic.needsReview).toBe(true);
    }
  });

  it('extracts the overall score', () => {
    expect(result.studentDetails.overallScore).toBe('72.1');
  });
});

// ─────────────────────────────────────────────────────────
// Fixture 3: Subject > Subcategory: Topic format
// ─────────────────────────────────────────────────────────
describe('Fixture 3 – Subject > Subcategory: Topic format', () => {
  const text = loadFixture('fixture-subject-subcategory-format.txt');
  const result = parseATIReport(text);

  it('extracts topics from the report', () => {
    expect(result.topics.length).toBeGreaterThan(0);
  });

  it('assigns Medical-Surgical as the category for cardiovascular topics', () => {
    const medSurgTopics = result.topics.filter(t => t.category === 'Medical-Surgical');
    expect(medSurgTopics.length).toBeGreaterThan(0);
  });

  it('assigns Medical-Surgical Group Score (61.8) to its topics', () => {
    const medSurgTopics = result.topics.filter(t => t.category === 'Medical-Surgical');
    expect(medSurgTopics.length).toBeGreaterThan(0);
    for (const topic of medSurgTopics) {
      expect(topic.groupScore).toBeCloseTo(61.8, 1);
    }
  });

  it('assigns Pharmacology Group Score (58.3) to its topics', () => {
    const pharmTopics = result.topics.filter(t => t.category === 'Pharmacology');
    expect(pharmTopics.length).toBeGreaterThan(0);
    for (const topic of pharmTopics) {
      expect(topic.groupScore).toBeCloseTo(58.3, 1);
    }
  });

  it('assigns Mental Health Group Score (68.6) to its topics', () => {
    const mhTopics = result.topics.filter(t => t.category === 'Mental Health');
    expect(mhTopics.length).toBeGreaterThan(0);
    for (const topic of mhTopics) {
      expect(topic.groupScore).toBeCloseTo(68.6, 1);
    }
  });

  it('extracts the subcategory from the > notation', () => {
    const cardioTopic = result.topics.find(t => t.name === 'Heart Failure Management');
    expect(cardioTopic).toBeDefined();
    expect(cardioTopic?.subcategory).toBe('Cardiovascular');
  });

  it('marks all extracted topics as needing review', () => {
    for (const topic of result.topics) {
      expect(topic.needsReview).toBe(true);
    }
  });

  it('extracts the overall score', () => {
    expect(result.studentDetails.overallScore).toBe('74.5');
  });
});

// ─────────────────────────────────────────────────────────
// Fixture 4: Multi-page format with "Page N" headers interspersed
//
// Real ATI PDFs often insert "Page 2", "Page 3", "Report Created: …",
// and "Please see the following page…" lines between topic blocks.
// The parser must skip those lines and continue extracting topics as if
// they were never there.
// ─────────────────────────────────────────────────────────
describe('Fixture 4 – multi-page format with interspersed page headers', () => {
  const text = loadFixture('fixture-multipage-format.txt');
  const result = parseATIReport(text);

  it('extracts topics from the report', () => {
    expect(result.topics.length).toBeGreaterThan(0);
  });

  it('extracts topics from page 1 (Management of Care, before any page break)', () => {
    const mocTopics = result.topics.filter(t => t.category === 'Management of Care');
    expect(mocTopics.length).toBeGreaterThan(0);
  });

  it('extracts topics from page 2 (Pharmacological, after first page break)', () => {
    const pharmTopics = result.topics.filter(
      t => t.category === 'Pharmacological and Parenteral Therapies'
    );
    expect(pharmTopics.length).toBeGreaterThan(0);
  });

  it('extracts topics from page 3 (Physiological Adaptation and Reduction of Risk, across second break)', () => {
    const physTopics = result.topics.filter(t => t.category === 'Physiological Adaptation');
    expect(physTopics.length).toBeGreaterThan(0);
    const rrpTopics = result.topics.filter(t => t.category === 'Reduction of Risk Potential');
    expect(rrpTopics.length).toBeGreaterThan(0);
  });

  it('extracts topics from page 4 (Psychosocial Integrity, after third break)', () => {
    const psyTopics = result.topics.filter(t => t.category === 'Psychosocial Integrity');
    expect(psyTopics.length).toBeGreaterThan(0);
  });

  it('assigns the inline Management of Care score (58) to its topics', () => {
    const mocTopics = result.topics.filter(t => t.category === 'Management of Care');
    for (const topic of mocTopics) {
      expect(topic.groupScore).toBe(58);
    }
  });

  it('assigns the inline Pharmacological score (55) to its topics despite page break before the section', () => {
    const pharmTopics = result.topics.filter(
      t => t.category === 'Pharmacological and Parenteral Therapies'
    );
    for (const topic of pharmTopics) {
      expect(topic.groupScore).toBe(55);
    }
  });

  it('assigns the inline Physiological Adaptation score (57) to its topics', () => {
    const physTopics = result.topics.filter(t => t.category === 'Physiological Adaptation');
    for (const topic of physTopics) {
      expect(topic.groupScore).toBe(57);
    }
  });

  it('assigns the inline Reduction of Risk Potential score (66) to its topics', () => {
    const rrpTopics = result.topics.filter(t => t.category === 'Reduction of Risk Potential');
    for (const topic of rrpTopics) {
      expect(topic.groupScore).toBe(66);
    }
  });

  it('assigns the inline Psychosocial Integrity score (61) to topics on the last page', () => {
    const psyTopics = result.topics.filter(t => t.category === 'Psychosocial Integrity');
    for (const topic of psyTopics) {
      expect(topic.groupScore).toBe(61);
    }
  });

  it('does not include "Page N" or metadata text as topic names', () => {
    for (const topic of result.topics) {
      expect(topic.name).not.toMatch(/^Page\s+\d+/i);
      expect(topic.name).not.toMatch(/Report Created/i);
      expect(topic.name).not.toMatch(/Please see/i);
    }
  });

  it('stops extracting topics when the Outcomes section is reached', () => {
    const badTopic = result.topics.find(t =>
      t.name.toLowerCase().includes('outcomes') ||
      t.name.toLowerCase().includes('review the following')
    );
    expect(badTopic).toBeUndefined();
  });

  it('marks all extracted topics as needing review', () => {
    for (const topic of result.topics) {
      expect(topic.needsReview).toBe(true);
    }
  });

  it('extracts the student name', () => {
    expect(result.studentDetails.studentName).toBeTruthy();
  });

  it('extracts the overall score', () => {
    expect(result.studentDetails.overallScore).toBe('65.2');
  });

  it('does not produce any topic with groupScore above 100', () => {
    for (const topic of result.topics) {
      if (topic.groupScore != null) {
        expect(topic.groupScore).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
// Edge cases / regression guards
// ─────────────────────────────────────────────────────────
describe('Edge cases', () => {
  it('returns empty topics for null/undefined input', () => {
    const result = parseATIReport(null as unknown as string);
    expect(result.topics).toHaveLength(0);
  });

  it('returns empty topics for empty string', () => {
    const result = parseATIReport('');
    expect(result.topics).toHaveLength(0);
  });

  it('does not produce any topic with groupScore above 100', () => {
    const text = loadFixture('fixture-inline-scores.txt');
    const result = parseATIReport(text);
    for (const topic of result.topics) {
      if (topic.groupScore != null) {
        expect(topic.groupScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not produce any topic with groupScore below 0', () => {
    const text = loadFixture('fixture-group-scores-table.txt');
    const result = parseATIReport(text);
    for (const topic of result.topics) {
      if (topic.groupScore != null) {
        expect(topic.groupScore).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('topics with no resolvable category score have null groupScore', () => {
    const text = loadFixture('fixture-no-category-score.txt');
    const result = parseATIReport(text);
    expect(result.topics.length).toBeGreaterThan(0);
    for (const topic of result.topics) {
      expect(topic.groupScore).toBeNull();
    }
  });

  it('null groupScore topics sort last in getTopicsForReview', () => {
    const text = loadFixture('fixture-no-category-score.txt');
    const result = parseATIReport(text);
    const forReview = getTopicsForReview(result);
    // All topics in this fixture have null scores — they should all appear and sort consistently
    expect(forReview.length).toBeGreaterThan(0);
    for (const topic of forReview) {
      expect(topic.groupScore).toBeNull();
    }
  });

  it('stops extracting topics when Outcomes section is reached', () => {
    const text = loadFixture('fixture-inline-scores.txt');
    const result = parseATIReport(text);
    const afterOutcomes = result.topics.find(t =>
      t.name.toLowerCase().includes('please review') ||
      t.name.toLowerCase().includes('outcomes')
    );
    expect(afterOutcomes).toBeUndefined();
  });
});
