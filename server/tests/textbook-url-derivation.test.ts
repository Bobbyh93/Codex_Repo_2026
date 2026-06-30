import { describe, it, expect } from 'vitest';
import { deriveChapterUrl } from '../textbook-url-utils.js';

describe('deriveChapterUrl', () => {
  it('returns a Pressbooks URL for a known Open RN textbook', () => {
    const url = deriveChapterUrl('Nursing Fundamentals', '5');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingfundamentals/chapter/chapter-5/');
  });

  it('handles Med-Surg which maps to the healthalts slug', () => {
    const url = deriveChapterUrl('Open RN Medical-Surgical Nursing', '36');
    expect(url).toBe('https://wtcs.pressbooks.pub/healthalts/chapter/chapter-36/');
  });

  it('handles Clinical Nursing Skills', () => {
    const url = deriveChapterUrl('Clinical Nursing Skills', '1');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingskills/chapter/chapter-1/');
  });

  it('handles Nursing Pharmacology', () => {
    const url = deriveChapterUrl('Nursing Pharmacology', '3');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingpharmacology/chapter/chapter-3/');
  });

  it('handles Nursing Mental Health', () => {
    const url = deriveChapterUrl('Nursing Mental Health', '2');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingmentalhealth/chapter/chapter-2/');
  });

  it('handles Nursing Pediatrics', () => {
    const url = deriveChapterUrl('Nursing Pediatrics', '4');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingpediatrics/chapter/chapter-4/');
  });

  it('handles Nursing Maternal-Newborn', () => {
    const url = deriveChapterUrl('Nursing Maternal-Newborn', '7');
    expect(url).toBe('https://wtcs.pressbooks.pub/nursingmaternalnewborn/chapter/chapter-7/');
  });

  it('returns null for a textbook title not in the slug map (ATI, Pearson, etc.)', () => {
    expect(deriveChapterUrl('ATI Digital Learning Suite', '1')).toBeNull();
    expect(deriveChapterUrl('Pharmacology for Nurses', '10')).toBeNull();
    expect(deriveChapterUrl('Clinical Judgment: The Nurse\'s Guide', '1')).toBeNull();
  });

  it('returns null for an empty title', () => {
    expect(deriveChapterUrl('', '1')).toBeNull();
  });

  it('includes the chapter number as-is in the URL path', () => {
    const url = deriveChapterUrl('Nursing Fundamentals', '20');
    expect(url).toContain('chapter-20');
  });

  it('generates a URL that starts with the expected Pressbooks base', () => {
    const url = deriveChapterUrl('Nursing Mental Health', '1');
    expect(url).toMatch(/^https:\/\/wtcs\.pressbooks\.pub\//);
  });
});
