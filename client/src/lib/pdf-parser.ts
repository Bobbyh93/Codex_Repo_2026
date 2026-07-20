// This file would contain client-side PDF parsing utilities if needed
// For now, PDF parsing is handled on the server side using pdf-parse

export interface ParsedTopic {
  name: string;
  description: string;
  category: string;
  score?: number;
}

export interface ParsedAssessmentData {
  topics: ParsedTopic[];
  overallScore?: number;
  contentAreas: Array<{
    name: string;
    score: number;
  }>;
}

// Utility function to extract structured data from parsed text
export function processExtractedText(text: string): ParsedAssessmentData {
  const topics: ParsedTopic[] = [];
  const contentAreas: Array<{ name: string; score: number }> = [];

  // Extract topics to review section
  const topicsMatch = text.match(/Topics To Review([\s\S]*?)(?=\n\s*\n|\n\s*Page|\Z)/i);
  
  if (topicsMatch) {
    const topicsText = topicsMatch[1];
    
    // Parse individual topics
    const topicMatches = topicsText.match(/([A-Z][^:]+):\s*([^\n]+)/g);
    
    if (topicMatches) {
      topicMatches.forEach(match => {
        const [category, description] = match.split(':').map(s => s.trim());
        if (category && description) {
          topics.push({
            name: category,
            description,
            category: determineContentArea(category)
          });
        }
      });
    }
  }

  // Extract content area scores
  const scoreMatches = text.match(/([A-Z][^0-9]*?)\s+(\d+\.\d+)%/g);
  
  if (scoreMatches) {
    scoreMatches.forEach(match => {
      const parts = match.match(/([A-Z][^0-9]*?)\s+(\d+\.\d+)%/);
      if (parts) {
        const [, name, scoreStr] = parts;
        contentAreas.push({
          name: name.trim(),
          score: parseFloat(scoreStr)
        });
      }
    });
  }

  return {
    topics,
    contentAreas
  };
}

function determineContentArea(topicName: string): string {
  const mappings = {
    'Management': 'Management of Care',
    'Safety': 'Safety and Infection Control',
    'Health Promotion': 'Health Promotion and Maintenance',
    'Psychosocial': 'Psychosocial Integrity',
    'Basic Care': 'Basic Care and Comfort',
    'Pharmacological': 'Pharmacological and Parenteral Therapies',
    'Risk': 'Reduction of Risk Potential',
    'Physiological': 'Physiological Adaptation'
  };

  for (const [key, area] of Object.entries(mappings)) {
    if (topicName.toLowerCase().includes(key.toLowerCase())) {
      return area;
    }
  }

  return 'General Nursing';
}
