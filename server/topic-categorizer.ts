import { db } from "./db";
import { nursingTopics, topicFrequencyTracking } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Subject mapping based on topic keywords and patterns
const SUBJECT_MAPPINGS = {
  'Medical-Surgical': [
    'cardiovascular', 'respiratory', 'neurological', 'gastrointestinal', 
    'musculoskeletal', 'endocrine', 'renal', 'immune', 'hematologic',
    'cardiac', 'pulmonary', 'diabetes', 'hypertension', 'stroke',
    'pneumonia', 'copd', 'heart failure', 'kidney', 'liver'
  ],
  'Pediatrics': [
    'pediatric', 'child', 'infant', 'newborn', 'neonatal', 'adolescent',
    'growth', 'development', 'immunization', 'congenital', 'childhood'
  ],
  'Maternal/Newborn': [
    'maternal', 'pregnancy', 'prenatal', 'postpartum', 'labor', 'delivery',
    'obstetric', 'perinatal', 'breastfeeding', 'lactation', 'fetal'
  ],
  'Mental Health': [
    'mental', 'psychiatric', 'psychological', 'depression', 'anxiety',
    'schizophrenia', 'bipolar', 'psychosocial', 'coping', 'stress',
    'suicide', 'addiction', 'substance', 'therapeutic communication'
  ],
  'Pharmacology': [
    'medication', 'drug', 'pharmacological', 'pharmaceutical', 'dosage',
    'adverse effects', 'contraindications', 'interactions', 'administration'
  ],
  'Fundamentals': [
    'basic care', 'hygiene', 'comfort', 'safety', 'infection control',
    'vital signs', 'assessment', 'nursing process', 'documentation',
    'client rights', 'advocacy', 'ethics', 'legal'
  ]
};

// System mapping for body systems
const SYSTEM_MAPPINGS = {
  'Cardiovascular': [
    'heart', 'cardiac', 'vascular', 'blood pressure', 'hypertension',
    'arrhythmia', 'dysrhythmia', 'mi', 'myocardial', 'angina', 'chf'
  ],
  'Respiratory': [
    'lung', 'pulmonary', 'breathing', 'respiratory', 'oxygen', 'ventilation',
    'pneumonia', 'copd', 'asthma', 'bronchitis', 'airway'
  ],
  'Neurological': [
    'neuro', 'brain', 'nervous', 'stroke', 'cva', 'seizure', 'headache',
    'spinal', 'paralysis', 'parkinson', 'alzheimer', 'dementia'
  ],
  'Gastrointestinal': [
    'gi', 'gastro', 'intestinal', 'stomach', 'bowel', 'liver', 'hepatic',
    'pancreas', 'digestive', 'nutrition', 'elimination'
  ],
  'Musculoskeletal': [
    'muscle', 'bone', 'joint', 'fracture', 'arthritis', 'mobility',
    'orthopedic', 'skeletal', 'movement', 'ambulation'
  ],
  'Endocrine': [
    'diabetes', 'thyroid', 'hormone', 'endocrine', 'insulin', 'glucose',
    'metabolic', 'pituitary', 'adrenal'
  ],
  'Renal/Urinary': [
    'kidney', 'renal', 'urinary', 'bladder', 'dialysis', 'nephro',
    'uti', 'catheter', 'fluid balance', 'electrolyte'
  ],
  'Immune/Hematologic': [
    'immune', 'blood', 'hematologic', 'anemia', 'leukemia', 'lymph',
    'infection', 'antibody', 'wbc', 'rbc', 'platelet', 'coagulation'
  ]
};

export function categorizeTopicBySubject(topicName: string): string {
  const lowerTopic = topicName.toLowerCase();
  
  for (const [subject, keywords] of Object.entries(SUBJECT_MAPPINGS)) {
    if (keywords.some(keyword => lowerTopic.includes(keyword))) {
      return subject;
    }
  }
  
  // Default categorization based on common patterns
  if (lowerTopic.includes('management of care') || lowerTopic.includes('delegation')) {
    return 'Fundamentals';
  }
  if (lowerTopic.includes('safety') || lowerTopic.includes('infection')) {
    return 'Fundamentals';
  }
  
  return 'Medical-Surgical'; // Default subject
}

export function categorizeTopicBySystem(topicName: string): string | null {
  const lowerTopic = topicName.toLowerCase();
  
  for (const [system, keywords] of Object.entries(SYSTEM_MAPPINGS)) {
    if (keywords.some(keyword => lowerTopic.includes(keyword))) {
      return system;
    }
  }
  
  // Some topics don't map to specific body systems
  if (lowerTopic.includes('psychosocial') || lowerTopic.includes('mental')) {
    return 'Mental Health';
  }
  if (lowerTopic.includes('safety') || lowerTopic.includes('infection') || 
      lowerTopic.includes('legal') || lowerTopic.includes('ethics')) {
    return 'Core Concepts';
  }
  
  return null; // No specific system mapping
}

export async function trackAndCategorizeTopics(topics: Array<{name: string, category: string}>, reportId: string) {
  const categorizedTopics = [];
  
  for (const topic of topics) {
    const subject = categorizeTopicBySubject(topic.name);
    const system = categorizeTopicBySystem(topic.name);
    
    // Track frequency in database
    const normalizedName = topic.name.toLowerCase().trim();
    const existingTracking = await db
      .select()
      .from(topicFrequencyTracking)
      .where(eq(topicFrequencyTracking.normalizedName, normalizedName))
      .limit(1);
    
    if (existingTracking.length > 0) {
      // Update existing tracking
      await db
        .update(topicFrequencyTracking)
        .set({
          occurrenceCount: sql`${topicFrequencyTracking.occurrenceCount} + 1`,
          lastReportId: reportId,
          lastUpdated: new Date(),
          subject: subject,
          system: system
        })
        .where(eq(topicFrequencyTracking.id, existingTracking[0].id));
    } else {
      // Create new tracking entry
      await db
        .insert(topicFrequencyTracking)
        .values({
          topicName: topic.name,
          normalizedName: normalizedName,
          subject: subject,
          system: system,
          occurrenceCount: 1,
          lastReportId: reportId,
          firstSeen: new Date(),
          lastUpdated: new Date()
        });
    }
    
    categorizedTopics.push({
      ...topic,
      subject,
      system
    });
  }
  
  return categorizedTopics;
}

export async function getMostFrequentTopics(limit: number = 10) {
  return await db
    .select()
    .from(topicFrequencyTracking)
    .orderBy(sql`${topicFrequencyTracking.occurrenceCount} DESC`)
    .limit(limit);
}

export async function getTopicsBySubjectAndSystem() {
  const topics = await db
    .select()
    .from(topicFrequencyTracking)
    .orderBy(sql`${topicFrequencyTracking.subject}, ${topicFrequencyTracking.system}, ${topicFrequencyTracking.occurrenceCount} DESC`);
  
  // Organize by subject and system
  const organized: Record<string, Record<string, any[]>> = {};
  
  for (const topic of topics) {
    const subject = topic.subject || 'Fundamentals';
    const system = topic.system || 'Core Concepts';
    
    if (!organized[subject]) {
      organized[subject] = {};
    }
    if (!organized[subject][system]) {
      organized[subject][system] = [];
    }
    
    organized[subject][system].push(topic);
  }
  
  return organized;
}