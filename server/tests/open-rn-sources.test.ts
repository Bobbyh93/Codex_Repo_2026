import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPEN_RN_BOOKS,
  OPEN_RN_LICENSE,
  RETIRED_OPEN_RN_SLUGS,
  buildOpenRnSourceRows,
  currentOpenRnBooks,
} from "../../shared/open-rn-sources";

describe("Open RN source list", () => {
  it("has unique keys, catalog URLs and read URLs", () => {
    const keys = OPEN_RN_BOOKS.map((book) => book.key);
    const catalogUrls = OPEN_RN_BOOKS.map((book) => book.catalogUrl);
    const readUrls = currentOpenRnBooks().map((book) => book.readUrl);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(catalogUrls).size).toBe(catalogUrls.length);
    expect(new Set(readUrls).size).toBe(readUrls.length);
  });

  it("gives every current book an https read URL on wtcs.pressbooks.pub and no retired slug", () => {
    for (const book of currentOpenRnBooks()) {
      expect(book.readUrl, book.key).toMatch(/^https:\/\/wtcs\.pressbooks\.pub\/[a-z0-9]+\/$/);
      const slug = (book.readUrl as string).split("/")[3];
      expect(RETIRED_OPEN_RN_SLUGS as readonly string[], book.key).not.toContain(slug);
      expect(book.catalogUrl, book.key).toMatch(/^https:\/\/www\.wistechopen\.org\/textbook\/[a-z0-9-]+$/);
    }
  });

  it("keeps coming-soon titles out of the readable set", () => {
    const soon = OPEN_RN_BOOKS.filter((book) => book.status === "coming_soon");
    expect(soon.length).toBeGreaterThan(0);
    for (const book of soon) expect(book.readUrl, book.key).toBeNull();
    expect(currentOpenRnBooks().every((book) => book.readUrl !== null)).toBe(true);
  });
});

describe("Open RN source registry rows", () => {
  const rows = buildOpenRnSourceRows();

  it("builds one catalog row plus one row per current book", () => {
    expect(rows).toHaveLength(currentOpenRnBooks().length + 1);
    expect(rows[0].sourceKind).toBe("open_rn_catalog");
    expect(rows.slice(1).every((row) => row.sourceKind === "open_rn_book")).toBe(true);
  });

  it("records licence, attribution and verification date on every row", () => {
    for (const row of rows) {
      expect(row.metadata.license, row.title).toBe(OPEN_RN_LICENSE);
      expect(row.metadata.attributionRequired, row.title).toBe(true);
      expect(row.metadata.licenseVerifiedOn, row.title).toBe("2026-10-13");
      expect(row.citationPolicy, row.title).toBe("cite_with_attribution_cc_by");
    }
  });

  it("keeps every row reference-only and blocked from generation until approved per title", () => {
    for (const row of rows) {
      expect(row.metadata.referenceOnly, row.title).toBe(true);
      expect(row.metadata.blockedForGeneration, row.title).toBe(true);
      expect(row.metadata.approvalRequiredBeforeGeneration, row.title).toBe(true);
    }
    expect(rows.slice(1).every((row) => row.approvalStatus === "pending")).toBe(true);
  });

  it("is identical on every call (deterministic input to the import dedupe hash)", () => {
    expect(JSON.stringify(buildOpenRnSourceRows())).toBe(JSON.stringify(rows));
  });
});

describe("learner references page", () => {
  const page = readFileSync(resolve(__dirname, "../../client/src/pages/references.tsx"), "utf8");

  it("is driven by the shared source list and holds no hardcoded book URLs", () => {
    expect(page).toContain("shared/open-rn-sources");
    expect(page).not.toMatch(/wtcs\.pressbooks\.pub\/[a-z0-9]+\//);
    for (const slug of RETIRED_OPEN_RN_SLUGS) expect(page).not.toContain(`/${slug}/`);
  });
});
