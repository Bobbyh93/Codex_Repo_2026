// Mapping of known Open RN textbook titles to their current Pressbooks slugs.
// Used to derive chapter URLs when textbookChapters.url is NULL in the DB, so chapters added
// before the url column was populated still get a clickable link in PDF study guides and the
// web chapter detail page.
//
// Verified against the live books on 2026-10-13 (see shared/open-rn-sources.ts): the older
// books were renamed or merged, and only some books still serve /chapter/chapter-N/.
export const PRESSBOOKS_SLUG_MAP: Record<string, string> = {
  'Clinical Nursing Skills':                                             'nursingskills',
  'Nursing Fundamentals':                                                'nursingfundamentals',
  'Open RN Medical-Surgical Nursing':                                    'healthalts',
  'Nursing Pharmacology':                                                'pharmacology2e',
  'Nursing Mental Health and Community Concepts 2e — Community Health Chapters': 'nursingmhcc',
  'Nursing Health Promotion — Nutrition and Dietary Care Chapters':      'healthpromo',
};

// Titles whose books no longer exist under their old slug. They get no link rather than a dead one.
export const RETIRED_TEXTBOOK_TITLES = new Set([
  'Nursing Mental Health',
  'Nursing Pediatrics',
  'Nursing Maternal-Newborn',
]);

// Books on which `chapter/chapter-N/` was confirmed to resolve on 2026-10-13. Every other book
// falls back to its book-level URL, because that pattern returns "Page not found" there.
export const CHAPTER_PATTERN_SLUGS = new Set(['healthpromo', 'nursingmhcc']);

/**
 * Derives a Pressbooks link for a chapter from the textbook title and chapter number when no
 * explicit URL is stored in the database.
 *
 * - Books where `chapter/chapter-N/` is confirmed: the direct chapter URL.
 * - Other current books: the book-level read URL.
 * - Retired or unknown titles (ATI, Pearson, OpenStax, the retired Open RN books): null.
 */
export function deriveChapterUrl(textbookTitle: string, chapterNumber: string): string | null {
  const slug = PRESSBOOKS_SLUG_MAP[textbookTitle];
  if (!slug) return null;
  if (CHAPTER_PATTERN_SLUGS.has(slug)) {
    return `https://wtcs.pressbooks.pub/${slug}/chapter/chapter-${chapterNumber}/`;
  }
  return `https://wtcs.pressbooks.pub/${slug}/`;
}
