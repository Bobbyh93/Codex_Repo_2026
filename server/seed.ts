import { db } from "./db";
import { contentAreas, nursingTopics, learningResources, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function seedDatabase() {
  try {
    // Check if demo user exists
    const existingUser = await db.select().from(users).where(eq(users.id, "demo-user"));
    if (existingUser.length === 0) {
      // Create demo user if it doesn't exist with specific ID
      await db.insert(users).values({
        id: "demo-user",
        username: "demo",
        email: "demo@example.com",
        password: crypto.randomBytes(32).toString("hex")
      });
      console.log("Created demo user");
    }

    // Check if data already exists
    const existingAreas = await db.select().from(contentAreas);
    if (existingAreas.length > 0) {
      console.log("Database already seeded");
      return;
    }

    // Seed content areas
    const areas = [
      { name: "Management of Care", description: "Leadership, delegation, and advocacy", nclexCategory: "Safe and Effective Care Environment" },
      { name: "Safety and Infection Control", description: "Safety protocols and infection prevention", nclexCategory: "Safe and Effective Care Environment" },
      { name: "Health Promotion and Maintenance", description: "Health screening and disease prevention", nclexCategory: "Health Promotion and Maintenance" },
      { name: "Psychosocial Integrity", description: "Mental health and coping mechanisms", nclexCategory: "Psychosocial Integrity" },
      { name: "Basic Care and Comfort", description: "Comfort measures and personal care", nclexCategory: "Physiological Integrity" },
      { name: "Pharmacological and Parenteral Therapies", description: "Medication administration and monitoring", nclexCategory: "Physiological Integrity" },
      { name: "Reduction of Risk Potential", description: "Monitoring and preventing complications", nclexCategory: "Physiological Integrity" },
      { name: "Physiological Adaptation", description: "Managing illness and body system alterations", nclexCategory: "Physiological Integrity" }
    ];

    const insertedAreas = await db.insert(contentAreas).values(areas).returning();
    console.log("Seeded content areas");

    // Seed nursing topics
    const topics = [
      { name: "Client Rights Assessment and Advocacy", description: "Protecting patient rights and providing advocacy", contentAreaId: insertedAreas[0].id, keywords: ["advocacy", "rights", "ethics", "consent"] },
      { name: "Handling Hazardous and Infectious Materials", description: "Safe handling of dangerous substances and preventing infections", contentAreaId: insertedAreas[1].id, keywords: ["infection", "hazardous", "safety", "ppe"] },
      { name: "Techniques of Physical Assessment", description: "Comprehensive physical examination skills", contentAreaId: insertedAreas[2].id, keywords: ["assessment", "examination", "physical", "inspection"] },
      { name: "Coping Mechanisms and Stress Management", description: "Supporting patient psychological wellness", contentAreaId: insertedAreas[3].id, keywords: ["coping", "stress", "mental health", "support"] },
      { name: "Personal Hygiene and Elimination", description: "Assisting with activities of daily living", contentAreaId: insertedAreas[4].id, keywords: ["hygiene", "elimination", "comfort", "adl"] },
      { name: "Adverse Effects and Contraindications", description: "Monitoring for medication side effects and interactions", contentAreaId: insertedAreas[5].id, keywords: ["adverse", "contraindications", "medication", "side effects"] },
      { name: "System-Specific Assessments", description: "Targeted assessment of body systems", contentAreaId: insertedAreas[6].id, keywords: ["assessment", "systems", "monitoring", "evaluation"] },
      { name: "Alterations in Body Systems", description: "Managing pathophysiological changes", contentAreaId: insertedAreas[7].id, keywords: ["pathophysiology", "alterations", "disease", "adaptation"] }
    ];

    await db.insert(nursingTopics).values(topics);
    console.log("Seeded nursing topics");

    console.log("Database seeding completed successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
