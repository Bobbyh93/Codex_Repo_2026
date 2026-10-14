import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  CHAPTER_PATTERN_SLUGS,
  PRESSBOOKS_SLUG_MAP,
  RETIRED_TEXTBOOK_TITLES,
  deriveChapterUrl,
} from '../textbook-url-utils.js';
import { RETIRED_OPEN_RN_SLUGS, currentOpenRnBooks } from '../../shared/open-rn-sources';

describe('deriveChapterUrl', () => {
  it('returns a direct chapter URL on books where the chapter pattern is confirmed', () => {
    expect(deriveChapterUrl('Nursing Mental Health and Community Concepts 2e — Community Health Chapters', '14'))
      .toBe('https://wtcs.pressbooks.pub/nursingmhcc/chapter/chapter-14/');
    expect(deriveChapterUrl('Nursing Health Promotion — Nutrition and Dietary Care Chapters', '2'))
      .toBe('https://wtcs.pressbooks.pub/healthpromo/chapter/chapter-2/');
  });

  it('falls back to the book-level URL where the chapter pattern returns "Page not found"', () => {
    expect(deriveChapterUrl('Nursing Fundamentals', '5')).toBe('https://wtcs.pressbooks.pub/nursingfundamentals/');
    expect(deriveChapterUrl('Clinical Nursing Skills', '1')).toBe('https://wtcs.pressbooks.pub/nursingskills/');
    expect(deriveChapterUrl('Open RN Medical-Surgical Nursing', '36')).toBe('https://wtcs.pressbooks.pub/healthalts/');
    expect(deriveChapterUrl('Nursing Pharmacology', '3')).toBe('https://wtcs.pressbooks.pub/pharmacology2e/');
  });

  it('returns null for the retired Open RN books instead of a dead link', () => {
    for (const title of RETIRED_TEXTBOOK_TITLES) expect(deriveChapterUrl(title, '1'), title).toBeNull();
  });

  it('returns null for titles not hosted on Pressbooks (ATI, Pearson, OpenStax) and for an empty title', () => {
    expect(deriveChapterUrl('ATI Digital Learning Suite', '1')).toBeNull();
    expect(deriveChapterUrl('Pharmacology for Nurses', '10')).toBeNull();
    expect(deriveChapterUrl('', '1')).toBeNull();
  });
});

describe('Open RN slug consistency', () => {
  const currentSlugs = new Set(currentOpenRnBooks().map((book) => (book.readUrl as string).split('/')[3]));

  it('maps every title to a current book slug and never to a retired one', () => {
    for (const [title, slug] of Object.entries(PRESSBOOKS_SLUG_MAP)) {
      expect(currentSlugs.has(slug), `${title} -> ${slug}`).toBe(true);
      expect(RETIRED_OPEN_RN_SLUGS as readonly string[], title).not.toContain(slug);
    }
  });

  it('only trusts the chapter pattern on slugs that are current books', () => {
    for (const slug of CHAPTER_PATTERN_SLUGS) expect(currentSlugs.has(slug), slug).toBe(true);
  });

  it('keeps retired titles out of the slug map', () => {
    for (const title of RETIRED_TEXTBOOK_TITLES) expect(PRESSBOOKS_SLUG_MAP[title], title).toBeUndefined();
  });
});

describe('seed catalogs', () => {
  const serverDir = resolve(__dirname, '..');
  const seeds = readdirSync(serverDir).filter((name) => /^seed-.*\.ts$/.test(name));
  const urls = seeds.flatMap((name) => {
    const text = readFileSync(resolve(serverDir, name), 'utf8');
    return [...text.matchAll(/https:\/\/wtcs\.pressbooks\.pub\/([a-z0-9]+)\/([^"'\s)]*)/g)].map((m) => ({ file: name, slug: m[1], rest: m[2] }));
  });

  it('references no retired book slug', () => {
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(RETIRED_OPEN_RN_SLUGS as readonly string[], `${url.file}: ${url.slug}`).not.toContain(url.slug);
  });

  it('uses the chapter pattern only on books where it is confirmed', () => {
    for (const url of urls) {
      if (url.rest.startsWith('chapter/')) {
        expect(CHAPTER_PATTERN_SLUGS.has(url.slug), `${url.file}: ${url.slug}/${url.rest}`).toBe(true);
      }
    }
  });
});
