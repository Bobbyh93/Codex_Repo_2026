import { db } from './db';
import { contentBlocks, nursingTopics, learningObjectives } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';

// Content quality metrics and scoring parameters
export interface QualityMetrics {
  accuracy: number;           // 0-100: Factual accuracy and medical correctness
  completeness: number;       // 0-100: Coverage of important concepts
  clarity: number;           // 0-100: Readability and comprehension level
  relevance: number;         // 0-100: Alignment with NCLEX standards
  engagement: number;        // 0-100: Student engagement potential
  practicality: number;      // 0-100: Real-world application value
  currency: number;          // 0-100: How up-to-date the content is
  difficulty: number;        // 0-100: Appropriate difficulty level
  evidenceBased: number;     // 0-100: Evidence-based practice alignment
  inclusivity: number;      // 0-100: Cultural competence and inclusivity
}

export interface QualityScore {
  contentId: string;
  overallScore: number;      // Weighted average of all metrics
  metrics: QualityMetrics;
  qualityLevel: 'excellent' | 'good' | 'acceptable' | 'needs_improvement' | 'poor';
  recommendations: string[];
  lastAssessed: Date;
  assessedBy: 'automated' | 'expert' | 'peer_review';
  confidence: number;        // 0-1: Confidence in the automated scoring
}

export interface QualityWeights {
  accuracy: number;          // Default: 0.25
  completeness: number;      // Default: 0.15
  clarity: number;           // Default: 0.15
  relevance: number;         // Default: 0.20
  engagement: number;        // Default: 0.05
  practicality: number;      // Default: 0.10
  currency: number;          // Default: 0.05
  difficulty: number;        // Default: 0.05
  evidenceBased: number;     // Default: 0.10
  inclusivity: number;      // Default: 0.05
}

// Default quality weights for nursing education content
export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  accuracy: 0.25,       // Most important for medical content
  completeness: 0.15,   // Important for comprehensive learning
  clarity: 0.15,        // Critical for student understanding
  relevance: 0.20,      // Must align with NCLEX standards
  engagement: 0.05,     // Nice to have but not critical
  practicality: 0.10,   // Real-world application matters
  currency: 0.05,       // Should be current but not frequently changing
  difficulty: 0.05,     // Should match target level
  evidenceBased: 0.10,  // Important for quality nursing education
  inclusivity: 0.05     // Important for modern healthcare
};

export class ContentQualityScorer {
  private weights: QualityWeights;

  constructor(customWeights?: Partial<QualityWeights>) {
    this.weights = { ...DEFAULT_QUALITY_WEIGHTS, ...customWeights };
  }

  /**
   * Assess content quality using multiple automated metrics
   */
  async assessContentQuality(contentId: string): Promise<QualityScore> {
    // Get content data
    const [content] = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.id, contentId));

    if (!content) {
      throw new Error('Content not found');
    }

    // Calculate individual metrics
    const metrics: QualityMetrics = {
      accuracy: await this.assessAccuracy(content),
      completeness: await this.assessCompleteness(content),
      clarity: await this.assessClarity(content),
      relevance: await this.assessRelevance(content),
      engagement: await this.assessEngagement(content),
      practicality: await this.assessPracticality(content),
      currency: await this.assessCurrency(content),
      difficulty: await this.assessDifficulty(content),
      evidenceBased: await this.assessEvidenceBased(content),
      inclusivity: await this.assessInclusivity(content)
    };

    // Calculate weighted overall score
    const overallScore = this.calculateOverallScore(metrics);

    // Determine quality level
    const qualityLevel = this.determineQualityLevel(overallScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, overallScore);

    // Calculate confidence in automated scoring
    const confidence = this.calculateConfidence(content, metrics);

    return {
      contentId,
      overallScore: Math.round(overallScore),
      metrics,
      qualityLevel,
      recommendations,
      lastAssessed: new Date(),
      assessedBy: 'automated',
      confidence
    };
  }

  /**
   * Batch assess multiple content items
   */
  async batchAssessQuality(contentIds: string[]): Promise<QualityScore[]> {
    const results: QualityScore[] = [];
    
    for (const contentId of contentIds) {
      try {
        const score = await this.assessContentQuality(contentId);
        results.push(score);
      } catch (error) {
        console.error(`Failed to assess quality for content ${contentId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get quality summary for content category
   */
  async getCategoryQualitySummary(category: string): Promise<{
    averageScore: number;
    totalItems: number;
    distribution: Record<string, number>;
    topPerformers: Array<{ id: string; title: string; score: number }>;
    improvementNeeded: Array<{ id: string; title: string; score: number; issues: string[] }>;
  }> {
    // This would typically query a quality_scores table
    // For now, return a sample structure
    return {
      averageScore: 78,
      totalItems: 150,
      distribution: {
        excellent: 25,
        good: 60,
        acceptable: 45,
        needs_improvement: 15,
        poor: 5
      },
      topPerformers: [
        { id: '1', title: 'Cardiac Care Fundamentals', score: 95 },
        { id: '2', title: 'Medication Safety Protocols', score: 92 },
        { id: '3', title: 'Infection Control Procedures', score: 90 }
      ],
      improvementNeeded: [
        { id: '4', title: 'Basic Assessment Skills', score: 65, issues: ['clarity', 'completeness'] },
        { id: '5', title: 'Patient Communication', score: 68, issues: ['engagement', 'inclusivity'] }
      ]
    };
  }

  /**
   * Assess factual accuracy using medical knowledge base
   */
  private async assessAccuracy(content: any): Promise<number> {
    const text = content.content.toLowerCase();
    let score = 85; // Base score

    // Check for medical terminology accuracy
    const medicalTerms = this.extractMedicalTerms(text);
    const accurateTerms = medicalTerms.filter(term => this.isAccurateMedicalTerm(term));
    const terminologyAccuracy = accurateTerms.length / Math.max(medicalTerms.length, 1);
    
    // Check for factual consistency
    const factualIssues = this.detectFactualIssues(text);
    const factualPenalty = factualIssues.length * 5; // -5 points per issue

    // Check for evidence-based statements
    const hasEvidenceMarkers = this.hasEvidenceMarkers(text);
    const evidenceBonus = hasEvidenceMarkers ? 5 : 0;

    score = score * terminologyAccuracy - factualPenalty + evidenceBonus;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess content completeness relative to learning objectives
   */
  private async assessCompleteness(content: any): Promise<number> {
    const text = content.content;
    let score = 70; // Base score

    // Check content length adequacy
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 100) score -= 20;
    else if (wordCount > 500) score += 10;

    // Check for key concept coverage
    const keyConcepts = await this.getKeyConceptsForCategory(content.category);
    const coveredConcepts = keyConcepts.filter(concept => 
      text.toLowerCase().includes(concept.toLowerCase())
    );
    const coverageRatio = coveredConcepts.length / Math.max(keyConcepts.length, 1);
    score = score + (coverageRatio * 30);

    // Check for practical examples
    const hasExamples = this.hasExamples(text);
    if (hasExamples) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess content clarity and readability
   */
  private async assessClarity(content: any): Promise<number> {
    const text = content.content;
    let score = 75; // Base score

    // Calculate readability score (simplified Flesch-Kincaid)
    const avgWordsPerSentence = this.calculateAvgWordsPerSentence(text);
    const avgSyllablesPerWord = this.calculateAvgSyllablesPerWord(text);
    
    // Optimal for nursing education: 12-16 words per sentence
    if (avgWordsPerSentence > 20) score -= 15;
    else if (avgWordsPerSentence >= 12 && avgWordsPerSentence <= 16) score += 10;

    // Check for clear structure
    const hasHeaders = /#{1,4}\s/.test(text) || /\b(I\.|II\.|III\.|1\.|2\.|3\.)/g.test(text);
    if (hasHeaders) score += 10;

    // Check for bullet points or numbered lists
    const hasLists = /^\s*[-*•]\s/gm.test(text) || /^\s*\d+\.\s/gm.test(text);
    if (hasLists) score += 5;

    // Check for excessive jargon
    const jargonDensity = this.calculateJargonDensity(text);
    if (jargonDensity > 0.15) score -= 10; // More than 15% jargon

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess relevance to NCLEX standards
   */
  private async assessRelevance(content: any): Promise<number> {
    const text = content.content.toLowerCase();
    let score = 70; // Base score

    // Check for NCLEX-relevant keywords
    const nclexKeywords = [
      'patient safety', 'prioritization', 'delegation', 'infection control',
      'medication administration', 'assessment', 'nursing process', 'critical thinking',
      'client care', 'therapeutic communication', 'cultural competence'
    ];

    const relevantKeywords = nclexKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    const keywordScore = (relevantKeywords.length / nclexKeywords.length) * 30;
    score += keywordScore;

    // Check category alignment
    if (content.category && this.isNclexRelevantCategory(content.category)) {
      score += 15;
    }

    // Check for clinical scenarios
    const hasClinicalScenario = this.hasClinicalScenario(text);
    if (hasClinicalScenario) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess student engagement potential
   */
  private async assessEngagement(content: any): Promise<number> {
    const text = content.content;
    let score = 65; // Base score

    // Check for interactive elements
    const hasQuestions = /\?/g.test(text);
    if (hasQuestions) score += 10;

    // Check for case studies or scenarios
    const hasScenarios = this.hasScenarios(text);
    if (hasScenarios) score += 15;

    // Check for varied content types
    const hasVariety = this.hasContentVariety(text);
    if (hasVariety) score += 10;

    // Check for personal relevance markers
    const hasPersonalRelevance = this.hasPersonalRelevance(text);
    if (hasPersonalRelevance) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess practical application value
   */
  private async assessPracticality(content: any): Promise<number> {
    const text = content.content.toLowerCase();
    let score = 70; // Base score

    // Check for procedure steps
    const hasProcedures = this.hasProcedureSteps(text);
    if (hasProcedures) score += 15;

    // Check for real-world examples
    const hasRealWorldExamples = this.hasRealWorldExamples(text);
    if (hasRealWorldExamples) score += 10;

    // Check for skill application
    const practicalKeywords = ['practice', 'apply', 'demonstrate', 'perform', 'implement'];
    const hasPracticalLanguage = practicalKeywords.some(keyword => 
      text.includes(keyword)
    );
    if (hasPracticalLanguage) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess content currency and up-to-dateness
   */
  private async assessCurrency(content: any): Promise<number> {
    let score = 80; // Base score assuming reasonably current

    // Check for recent guidelines or dates
    const currentYear = new Date().getFullYear();
    const hasRecentDates = this.hasRecentDates(content.content, currentYear);
    if (hasRecentDates) score += 10;

    // Check for outdated terminology or practices
    const hasOutdatedTerms = this.hasOutdatedTerms(content.content);
    if (hasOutdatedTerms) score -= 15;

    // Check creation date if available
    if (content.createdAt) {
      const ageInYears = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (ageInYears > 3) score -= 10; // Reduce score for content older than 3 years
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess appropriate difficulty level
   */
  private async assessDifficulty(content: any): Promise<number> {
    const text = content.content;
    let score = 75; // Base score

    // Calculate complexity metrics
    const avgWordLength = this.calculateAvgWordLength(text);
    const sentenceComplexity = this.calculateSentenceComplexity(text);
    const conceptDensity = this.calculateConceptDensity(text);

    // Appropriate for nursing students (moderate difficulty)
    if (avgWordLength >= 5 && avgWordLength <= 7) score += 10;
    if (sentenceComplexity >= 0.4 && sentenceComplexity <= 0.7) score += 10;
    if (conceptDensity >= 0.2 && conceptDensity <= 0.4) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess evidence-based practice alignment
   */
  private async assessEvidenceBased(content: any): Promise<number> {
    const text = content.content.toLowerCase();
    let score = 70; // Base score

    // Check for evidence markers
    const evidenceMarkers = [
      'research shows', 'studies indicate', 'evidence suggests',
      'clinical trials', 'meta-analysis', 'systematic review',
      'best practice', 'guidelines recommend'
    ];

    const hasEvidenceMarkers = evidenceMarkers.some(marker => 
      text.includes(marker)
    );
    if (hasEvidenceMarkers) score += 20;

    // Check for citations or references
    const hasCitations = this.hasCitations(text);
    if (hasCitations) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess cultural competence and inclusivity
   */
  private async assessInclusivity(content: any): Promise<number> {
    const text = content.content.toLowerCase();
    let score = 75; // Base score

    // Check for inclusive language
    const inclusiveTerms = [
      'cultural', 'diverse', 'inclusive', 'respectful',
      'cultural competence', 'cultural sensitivity'
    ];

    const hasInclusiveLanguage = inclusiveTerms.some(term => 
      text.includes(term)
    );
    if (hasInclusiveLanguage) score += 15;

    // Check for bias indicators (negative)
    const biasIndicators = this.detectBiasIndicators(text);
    if (biasIndicators.length > 0) score -= (biasIndicators.length * 10);

    // Check for diverse examples
    const hasDiverseExamples = this.hasDiverseExamples(text);
    if (hasDiverseExamples) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(metrics: QualityMetrics): number {
    return (
      metrics.accuracy * this.weights.accuracy +
      metrics.completeness * this.weights.completeness +
      metrics.clarity * this.weights.clarity +
      metrics.relevance * this.weights.relevance +
      metrics.engagement * this.weights.engagement +
      metrics.practicality * this.weights.practicality +
      metrics.currency * this.weights.currency +
      metrics.difficulty * this.weights.difficulty +
      metrics.evidenceBased * this.weights.evidenceBased +
      metrics.inclusivity * this.weights.inclusivity
    );
  }

  /**
   * Determine quality level based on overall score
   */
  private determineQualityLevel(score: number): QualityScore['qualityLevel'] {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'acceptable';
    if (score >= 60) return 'needs_improvement';
    return 'poor';
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(metrics: QualityMetrics, overallScore: number): string[] {
    const recommendations: string[] = [];

    if (metrics.accuracy < 80) {
      recommendations.push('Review content for medical accuracy and update any outdated information');
    }
    if (metrics.completeness < 70) {
      recommendations.push('Add more comprehensive coverage of key concepts and examples');
    }
    if (metrics.clarity < 75) {
      recommendations.push('Improve readability by simplifying sentence structure and adding clear headings');
    }
    if (metrics.relevance < 80) {
      recommendations.push('Enhance alignment with NCLEX standards and clinical practice requirements');
    }
    if (metrics.engagement < 70) {
      recommendations.push('Add interactive elements, case studies, or practical scenarios');
    }
    if (metrics.evidenceBased < 75) {
      recommendations.push('Include more evidence-based practice references and current research');
    }

    if (overallScore < 70) {
      recommendations.push('Consider major revision or replacement of this content');
    }

    return recommendations;
  }

  /**
   * Calculate confidence in automated scoring
   */
  private calculateConfidence(content: any, metrics: QualityMetrics): number {
    let confidence = 0.8; // Base confidence

    // Higher confidence for longer, more structured content
    const wordCount = content.content.split(/\s+/).length;
    if (wordCount > 300) confidence += 0.1;
    if (wordCount < 100) confidence -= 0.2;

    // Higher confidence if content has clear structure
    const hasStructure = /#{1,4}\s/.test(content.content) || content.title;
    if (hasStructure) confidence += 0.05;

    // Lower confidence for edge case scores
    const scoresInNormalRange = Object.values(metrics).filter(score => score >= 60 && score <= 90).length;
    const totalMetrics = Object.keys(metrics).length;
    if (scoresInNormalRange / totalMetrics < 0.7) confidence -= 0.1;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  // Helper methods for content analysis
  private extractMedicalTerms(text: string): string[] {
    // Simplified medical term extraction
    const medicalPatterns = [
      /\b[a-z]+itis\b/gi,      // Inflammation terms
      /\b[a-z]+pathy\b/gi,     // Disease terms
      /\b[a-z]+emia\b/gi,      // Blood condition terms
      /\bhyper[a-z]+\b/gi,     // Hyper- prefix
      /\bhypo[a-z]+\b/gi,      // Hypo- prefix
    ];
    
    const terms: string[] = [];
    medicalPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      terms.push(...matches);
    });
    
    return Array.from(new Set(terms));
  }

  private isAccurateMedicalTerm(term: string): boolean {
    // Simplified accuracy check
    const knownAccurateTerms = [
      'hypertension', 'hypotension', 'tachycardia', 'bradycardia',
      'pneumonia', 'arthritis', 'anemia', 'leukemia'
    ];
    return knownAccurateTerms.includes(term.toLowerCase());
  }

  private detectFactualIssues(text: string): string[] {
    const issues: string[] = [];
    
    // Check for contradictory statements
    if (text.includes('always') && text.includes('never')) {
      issues.push('Contains absolute statements that may be contradictory');
    }
    
    return issues;
  }

  private hasEvidenceMarkers(text: string): boolean {
    const markers = ['research', 'study', 'evidence', 'clinical trial', 'guideline'];
    return markers.some(marker => text.toLowerCase().includes(marker));
  }

  private async getKeyConceptsForCategory(category: string): Promise<string[]> {
    // Simplified concept mapping
    const conceptMap: Record<string, string[]> = {
      'cardiac': ['heart rate', 'blood pressure', 'ECG', 'chest pain', 'cardiac output'],
      'respiratory': ['oxygen saturation', 'breathing pattern', 'lung sounds', 'airway'],
      'medication': ['dosage', 'side effects', 'contraindications', 'administration route'],
      'default': ['assessment', 'intervention', 'evaluation', 'patient safety']
    };
    
    return conceptMap[category?.toLowerCase()] || conceptMap.default;
  }

  private hasExamples(text: string): boolean {
    const exampleMarkers = ['for example', 'such as', 'instance', 'case study'];
    return exampleMarkers.some(marker => text.toLowerCase().includes(marker));
  }

  private calculateAvgWordsPerSentence(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return sentences.length > 0 ? words.length / sentences.length : 0;
  }

  private calculateAvgSyllablesPerWord(text: string): number {
    // Simplified syllable counting
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalSyllables = words.reduce((sum, word) => {
      return sum + Math.max(1, word.replace(/[^aeiouAEIOU]/g, '').length);
    }, 0);
    return words.length > 0 ? totalSyllables / words.length : 0;
  }

  private calculateJargonDensity(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const jargonWords = words.filter(word => word.length > 8 || /[A-Z]{2,}/.test(word));
    return words.length > 0 ? jargonWords.length / words.length : 0;
  }

  private isNclexRelevantCategory(category: string): boolean {
    const nclexCategories = [
      'safe and effective care environment',
      'physiological integrity',
      'psychosocial integrity',
      'health promotion and maintenance'
    ];
    return nclexCategories.some(cat => 
      category.toLowerCase().includes(cat) || cat.includes(category.toLowerCase())
    );
  }

  private hasClinicalScenario(text: string): boolean {
    const scenarioMarkers = ['patient', 'client', 'scenario', 'case', 'situation'];
    return scenarioMarkers.some(marker => text.toLowerCase().includes(marker));
  }

  private hasScenarios(text: string): boolean {
    return text.toLowerCase().includes('scenario') || text.toLowerCase().includes('case study');
  }

  private hasContentVariety(text: string): boolean {
    const varietyMarkers = ['diagram', 'chart', 'table', 'list', 'figure', 'image'];
    return varietyMarkers.some(marker => text.toLowerCase().includes(marker));
  }

  private hasPersonalRelevance(text: string): boolean {
    const relevanceMarkers = ['your', 'you will', 'your patient', 'your practice'];
    return relevanceMarkers.some(marker => text.toLowerCase().includes(marker));
  }

  private hasProcedureSteps(text: string): boolean {
    return /step \d+|first|second|third|next|finally/gi.test(text);
  }

  private hasRealWorldExamples(text: string): boolean {
    const realWorldMarkers = ['in practice', 'clinical setting', 'hospital', 'bedside'];
    return realWorldMarkers.some(marker => text.toLowerCase().includes(marker));
  }

  private hasRecentDates(text: string, currentYear: number): boolean {
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];
    return recentYears.some(year => text.includes(year.toString()));
  }

  private hasOutdatedTerms(text: string): boolean {
    const outdatedTerms = ['nurse aide', 'mental retardation', 'handicapped'];
    return outdatedTerms.some(term => text.toLowerCase().includes(term));
  }

  private calculateAvgWordLength(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalLength = words.reduce((sum, word) => sum + word.length, 0);
    return words.length > 0 ? totalLength / words.length : 0;
  }

  private calculateSentenceComplexity(text: string): number {
    // Simplified complexity calculation based on conjunctions and clauses
    const complexityMarkers = ['however', 'therefore', 'because', 'although', 'whereas'];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const complexSentences = sentences.filter(sentence => 
      complexityMarkers.some(marker => sentence.toLowerCase().includes(marker))
    );
    return sentences.length > 0 ? complexSentences.length / sentences.length : 0;
  }

  private calculateConceptDensity(text: string): number {
    // Simplified concept density based on technical terms
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const technicalWords = words.filter(word => 
      word.length > 6 && /[a-z][a-z][a-z]/i.test(word)
    );
    return words.length > 0 ? technicalWords.length / words.length : 0;
  }

  private hasCitations(text: string): boolean {
    return /\(\d{4}\)|\[\d+\]|et al\./.test(text);
  }

  private detectBiasIndicators(text: string): string[] {
    const biasTerms = ['all patients', 'every nurse', 'never', 'always', 'typical patient'];
    return biasTerms.filter(term => text.includes(term));
  }

  private hasDiverseExamples(text: string): boolean {
    const diversityMarkers = ['culture', 'ethnicity', 'age', 'gender', 'background'];
    return diversityMarkers.some(marker => text.toLowerCase().includes(marker));
  }
}

// Export default instance
export const contentQualityScorer = new ContentQualityScorer();