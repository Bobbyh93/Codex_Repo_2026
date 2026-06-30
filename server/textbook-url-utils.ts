// Mapping of known Open RN textbook titles → their Pressbooks slugs.
// Used to derive chapter URLs when textbookChapters.url is NULL in the DB,
// so chapters added before the url column was populated still get a clickable
// link in PDF study guides and the web chapter detail page.
export const PRESSBOOKS_SLUG_MAP: Record<string, string> = {
  'Clinical Nursing Skills':                                             'nursingskills',
  'Nursing Fundamentals':                                                'nursingfundamentals',
  'Open RN Medical-Surgical Nursing':                                    'healthalts',
  'Nursing Mental Health':                                               'nursingmentalhealth',
  'Nursing Pediatrics':                                                  'nursingpediatrics',
  'Nursing Pharmacology':                                                'nursingpharmacology',
  'Nursing Maternal-Newborn':                                            'nursingmaternalnewborn',
  'Nursing Mental Health and Community Concepts 2e — Community Health Chapters': 'nursingmhcc',
  'Nursing Health Promotion — Nutrition and Dietary Care Chapters':      'healthpromo',
};

/**
 * Derives a direct Pressbooks chapter URL from the textbook title and chapter
 * number when no explicit URL is stored in the database.
 *
 * Pressbooks uses `chapter/chapter-N/` as the canonical entry point for each
 * chapter, which redirects to the first section of that chapter.
 *
 * Returns null when the textbook title is not in the known slug map (e.g. ATI,
 * Pearson, or OpenStax titles that are not hosted on wtcs.pressbooks.pub).
 */
export function deriveChapterUrl(textbookTitle: string, chapterNumber: string): string | null {
  const slug = PRESSBOOKS_SLUG_MAP[textbookTitle];
  if (!slug) return null;
  return `https://wtcs.pressbooks.pub/${slug}/chapter/chapter-${chapterNumber}/`;
}
