import { seedOpenRNCatalog } from "./seed-openrn-catalog";
import { seedMedSurgCatalog } from "./seed-medsurg-catalog";
import { seedPopulationHealthCatalog } from "./seed-population-health-catalog";
import { seedNutritionCatalog } from "./seed-nutrition-catalog";
import { seedPharmacologyCatalog } from "./seed-pharmacology-catalog";
import { seedClinicalSkillsCatalog } from "./seed-clinical-skills-catalog";
import { seedMaternalNewbornCatalog } from "./seed-maternal-newborn-catalog";

export interface SeedCatalogResult {
  openRN: { inserted: number; skipped: number };
  medSurg: { inserted: number; skipped: number };
  populationHealth: { inserted: number; skipped: number };
  nutrition: { inserted: number; skipped: number };
  pharmacology: { inserted: number; skipped: number };
  clinicalSkills: { inserted: number; skipped: number };
  maternalNewborn: { inserted: number; skipped: number };
  totalInserted: number;
  totalSkipped: number;
}

export async function seedCatalog(): Promise<SeedCatalogResult> {
  const [openRN, medSurg, populationHealth, nutrition, pharmacology, clinicalSkills, maternalNewborn] = await Promise.all([
    seedOpenRNCatalog(),
    seedMedSurgCatalog(),
    seedPopulationHealthCatalog(),
    seedNutritionCatalog(),
    seedPharmacologyCatalog(),
    seedClinicalSkillsCatalog(),
    seedMaternalNewbornCatalog(),
  ]);

  return {
    openRN,
    medSurg,
    populationHealth,
    nutrition,
    pharmacology,
    clinicalSkills,
    maternalNewborn,
    totalInserted:
      openRN.inserted +
      medSurg.inserted +
      populationHealth.inserted +
      nutrition.inserted +
      pharmacology.inserted +
      clinicalSkills.inserted +
      maternalNewborn.inserted,
    totalSkipped:
      openRN.skipped +
      medSurg.skipped +
      populationHealth.skipped +
      nutrition.skipped +
      pharmacology.skipped +
      clinicalSkills.skipped +
      maternalNewborn.skipped,
  };
}
