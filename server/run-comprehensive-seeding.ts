#!/usr/bin/env tsx

import { runComprehensiveSeeding } from "./comprehensive-content-seeder";

async function main() {
  console.log("🚀 Starting comprehensive content seeding...");
  
  try {
    const result = await runComprehensiveSeeding();
    
    if (result.success) {
      console.log("✅ Comprehensive seeding completed successfully!");
      console.log(`📊 Total items seeded: ${result.totalSeeded}`);
      process.exit(0);
    } else {
      console.error("❌ Seeding failed:", result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Fatal error during seeding:", error);
    process.exit(1);
  }
}

// Run the main function
main();