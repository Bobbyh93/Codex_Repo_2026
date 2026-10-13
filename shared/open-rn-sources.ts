// Open RN nursing textbooks, published by WisTech Open (Wisconsin technical colleges).
//
// Verified against the publisher's own pages on 2026-10-13: catalog at
// https://www.wistechopen.org/textook-categories/nursing, each title's catalog page, and the
// "read" link it points to on wtcs.pressbooks.pub. Re-verify before changing this list; the
// older book URLs used elsewhere in the repo (clinicalskills, nursingmedicalsurgical,
// nursingmentalhealth, maternalnewborn, nursingpediatrics, painnutrition) return "Page not found".

export const OPEN_RN_PUBLISHER = "WisTech Open (Wisconsin technical colleges)";
export const OPEN_RN_CATALOG_URL = "https://www.wistechopen.org/textook-categories/nursing";
export const OPEN_RN_LICENSE = "CC BY 4.0";
export const OPEN_RN_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const OPEN_RN_VERIFIED_ON = "2026-10-13";

export type OpenRnLicenseScope = "book" | "site";

export interface OpenRnBook {
  key: string;
  title: string;
  /** Edition label as shown on the publisher's page, kept verbatim (may be a review year). */
  editionLabel: string | null;
  subject: string;
  description: string;
  /** Read-online URL on wtcs.pressbooks.pub; null while the publisher lists the title as coming soon. */
  readUrl: string | null;
  catalogUrl: string;
  status: "current" | "coming_soon";
  /** "book" = the book's own page states the licence; "site" = only the publisher's site-wide statement. */
  licenseScope: OpenRnLicenseScope;
}

const catalog = (slug: string) => `https://www.wistechopen.org/textbook/${slug}`;
const read = (slug: string) => `https://wtcs.pressbooks.pub/${slug}/`;

export const OPEN_RN_BOOKS: OpenRnBook[] = [
  {
    key: "nursing-fundamentals-2e",
    title: "Nursing Fundamentals, 2nd Edition",
    editionLabel: "2nd Edition (publisher shows: 2027)",
    subject: "Fundamentals",
    description: "Core nursing skills, safety, infection control, vital signs, hygiene, oxygenation and patient care basics for beginning nursing students.",
    readUrl: read("nursingfundamentals"),
    catalogUrl: catalog("nursing-fundamentals-2nd-edition"),
    status: "current",
    licenseScope: "book",
  },
  {
    key: "nursing-skills-2e",
    title: "Nursing Skills, 2nd Edition",
    editionLabel: "2nd Edition (publisher shows: 2028)",
    subject: "Clinical Skills",
    description: "Step-by-step clinical skills with the nursing process and clinical judgment applied to each procedure.",
    readUrl: read("nursingskills"),
    catalogUrl: catalog("nursing-skills-2nd-edition"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-pharmacology-2e",
    title: "Nursing Pharmacology, 2nd Edition",
    editionLabel: "2nd Edition (publisher shows: 2027)",
    subject: "Pharmacology",
    description: "Drug classes, mechanisms, adverse effects and nursing considerations organized by body system.",
    readUrl: read("pharmacology2e"),
    catalogUrl: catalog("nursing-pharmacology-2nd-edition"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-health-alterations",
    title: "Nursing Health Alterations",
    editionLabel: "publisher shows: 2028",
    subject: "Med-Surg",
    description: "Alterations in health across body systems: pathophysiology, assessment, nursing care and clinical judgment.",
    readUrl: read("healthalts"),
    catalogUrl: catalog("nursing-health-alterations"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-mhcc-2e",
    title: "Nursing Mental Health & Community Concepts, 2nd Edition",
    editionLabel: "2nd Edition (publisher shows: 2028)",
    subject: "Mental Health",
    description: "Mental health nursing and community health concepts, including vulnerable populations.",
    readUrl: read("nursingmhcc"),
    catalogUrl: catalog("nursing-mental-health-community-concepts-2nd-edition"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-mpc-2e",
    title: "Nursing Management & Professional Concepts, 2nd Edition",
    editionLabel: "2nd Edition (publisher shows: 2028)",
    subject: "Management",
    description: "Leadership, delegation, legal and ethical practice, and professional nursing concepts.",
    readUrl: read("nursingmpc"),
    catalogUrl: catalog("nursing-management-professional-concepts-2nd-edition"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-health-promotion",
    title: "Nursing Health Promotion",
    editionLabel: "publisher shows: 2028",
    subject: "Health Promotion",
    description: "Health promotion across the lifespan, including nutrition and the maternal-newborn and pediatric content previously published as separate books.",
    readUrl: read("healthpromo"),
    catalogUrl: catalog("nursing-health-promotion"),
    status: "current",
    licenseScope: "site",
  },
  {
    key: "nursing-dosage-calculations",
    title: "Nursing Dosage Calculations",
    editionLabel: "publisher shows: 2029",
    subject: "Pharmacology",
    description: "Dosage calculation methods and practice for safe medication administration.",
    readUrl: read("nursingdosagecalculations"),
    catalogUrl: catalog("nursing-dosage-calculations"),
    status: "current",
    licenseScope: "site",
  },
  // Listed on the publisher's nursing catalog as "Coming Soon" on 2026-10-13: no read link yet.
  ...([
    ["nursing-skills-3e", "Nursing Skills, 3rd Edition", "Clinical Skills", "nursing-skills-3rd-edition"],
    ["nursing-pharmacology-3e", "Nursing Pharmacology, 3rd Edition", "Pharmacology", "nursing-pharmacology-3rd-edition"],
    ["nursing-advanced-skills-2e", "Nursing Advanced Skills, 2nd Edition", "Clinical Skills", "nursing-advanced-skills-second-edition"],
    ["nursing-complex-health-alterations-1", "Nursing Complex Health Alterations I", "Med-Surg", "nursing-complex-health-alterations-i"],
    ["nursing-assistant-2e", "Nursing Assistant, 2nd Edition", "Nursing Assistant", "nursing-assistant-2nd-edition"],
  ] as const).map(([key, title, subject, slug]): OpenRnBook => ({
    key,
    title,
    editionLabel: null,
    subject,
    description: "Announced by the publisher; not yet readable online.",
    readUrl: null,
    catalogUrl: catalog(slug),
    status: "coming_soon",
    licenseScope: "site",
  })),
];

/** Book-level slugs the repo used before 2026-10-13 that now return "Page not found". */
export const RETIRED_OPEN_RN_SLUGS = [
  "clinicalskills",
  "nursingmedicalsurgical",
  "nursingmentalhealth",
  "maternalnewborn",
  "nursingmaternalnewborn",
  "nursingpediatrics",
  "painnutrition",
] as const;

export const currentOpenRnBooks = () => OPEN_RN_BOOKS.filter((book) => book.status === "current");

export interface OpenRnSourceRow {
  title: string;
  sourceKind: string;
  sourceType: string;
  sourceUri: string;
  subject: string;
  edition: string;
  citationPolicy: string;
  approvalStatus: "pending" | "approved" | "rejected";
  ingestionStatus: string;
  metadata: Record<string, unknown>;
}

const commonMetadata = {
  origin: "open_rn",
  publisher: OPEN_RN_PUBLISHER,
  license: OPEN_RN_LICENSE,
  licenseUrl: OPEN_RN_LICENSE_URL,
  licenseVerifiedOn: OPEN_RN_VERIFIED_ON,
  attributionRequired: true,
  // CC BY permits adaptation and machine use with attribution, but third-party figures are
  // "except where otherwise noted" and each title needs an explicit approval before generation.
  thirdPartyContentNote: "Licence is 'except where otherwise noted'; check chapter back-matter before reusing images or figures.",
  referenceOnly: true,
  blockedForGeneration: true,
  approvalRequiredBeforeGeneration: true,
};

/** Pure builder for the source-registry rows: one catalog row plus one row per current book. */
export function buildOpenRnSourceRows(approvalStatus: OpenRnSourceRow["approvalStatus"] = "pending"): OpenRnSourceRow[] {
  const books = currentOpenRnBooks();
  const catalogRow: OpenRnSourceRow = {
    title: "Open RN nursing textbook catalog (WisTech Open)",
    sourceKind: "open_rn_catalog",
    sourceType: "open_textbook_catalog",
    sourceUri: OPEN_RN_CATALOG_URL,
    subject: "Open RN nursing textbooks",
    edition: `catalog read ${OPEN_RN_VERIFIED_ON}`,
    citationPolicy: "cite_with_attribution_cc_by",
    approvalStatus,
    ingestionStatus: "ready",
    metadata: { ...commonMetadata, registryRole: "open_rn_catalog", bookCount: books.length, comingSoonCount: OPEN_RN_BOOKS.length - books.length },
  };
  const bookRows = books.map((book): OpenRnSourceRow => ({
    title: book.title,
    sourceKind: "open_rn_book",
    sourceType: "open_textbook",
    sourceUri: book.readUrl as string,
    subject: book.subject,
    edition: book.editionLabel ?? "unspecified",
    citationPolicy: "cite_with_attribution_cc_by",
    approvalStatus: "pending",
    ingestionStatus: "ready",
    metadata: {
      ...commonMetadata,
      registryRole: "open_rn_book",
      key: book.key,
      catalogUrl: book.catalogUrl,
      licenseScope: book.licenseScope,
      candidateSource: true,
    },
  }));
  return [catalogRow, ...bookRows];
}
