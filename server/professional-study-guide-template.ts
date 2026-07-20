/**
 * Professional Study Guide Template Integration
 * Bridges existing assessment analysis with new template system
 */

import { AssessmentToTemplateMapper, type AssessmentAnalysis, type TopicGap } from './assessment-to-template-mapper';
import { TemplateRenderer, type OutputFormat } from './template-renderer';
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { topicPerformance } from "@shared/simplified-schema";

export interface StudyGuideGenerationRequest {
  format: OutputFormat;
  studentName?: string;
  reportId?: string;
  includeInteractiveFeatures?: boolean;
}

export interface StudyGuideResponse {
  content: string;
  format: OutputFormat;
  metadata: {
    generatedAt: string;
    studentName: string;
    totalTopics: number;
    estimatedCompletionTime: string;
  };
}

export class ProfessionalStudyGuideTemplate {
  
  /**
   * Generate a professional study guide using the template system
   */
  static async generateStudyGuide(request: StudyGuideGenerationRequest): Promise<StudyGuideResponse> {
    try {
      // Get assessment analysis data
      const analysis = await this.getAssessmentAnalysis(request.reportId);
      
      // Transform to template data format
      const templateData = AssessmentToTemplateMapper.mapToTemplateData({
        ...analysis,
        studentName: request.studentName || analysis.studentName
      });
      
      // Render with template system
      const content = TemplateRenderer.render(templateData, {
        format: request.format,
        includeStyles: true
      });
      
      return {
        content,
        format: request.format,
        metadata: {
          generatedAt: new Date().toISOString(),
          studentName: templateData.student_name,
          totalTopics: analysis.totalTopics,
          estimatedCompletionTime: templateData.completion_estimate
        }
      };
    } catch (error) {
      console.error('Error generating study guide:', error);
      throw new Error(`Failed to generate study guide: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate downloadable study guide
   */
  static async generateDownload(request: StudyGuideGenerationRequest): Promise<Buffer> {
    const analysis = await this.getAssessmentAnalysis(request.reportId);
    const templateData = AssessmentToTemplateMapper.mapToTemplateData({
      ...analysis,
      studentName: request.studentName || analysis.studentName
    });
    
    return TemplateRenderer.generateDownload(templateData, request.format);
  }
  
  /**
   * Get MIME type for format
   */
  static getMimeType(format: OutputFormat): string {
    return TemplateRenderer.getMimeType(format);
  }
  
  /**
   * Get file extension for format
   */
  static getFileExtension(format: OutputFormat): string {
    return TemplateRenderer.getFileExtension(format);
  }
  
  /**
   * Get assessment analysis from database
   */
  private static async getAssessmentAnalysis(reportId?: string): Promise<AssessmentAnalysis> {
    try {
      // Get topic performance data
      const topicPerformanceData = await db.select().from(topicPerformance);
      
      if (topicPerformanceData.length === 0) {
        // Return sample data if no performance data exists
        return this.getSampleAnalysis();
      }
      
      // Transform database data to TopicGap format
      const topicGaps: TopicGap[] = topicPerformanceData.map(item => ({
        topic: item.topicId || 'Unknown Topic',
        contentArea: this.mapToContentArea(item.topicId || ''),
        currentScore: this.calculateCurrentScore(item.gapScore),
        targetScore: 85, // Standard target
        priority: this.calculatePriority(item.gapScore),
        gapSize: parseFloat(item.gapScore?.toString() || '0')
      }));
      
      // Sort by priority (highest first)
      topicGaps.sort((a, b) => a.priority - b.priority);
      
      const averageScore = this.calculateAverageScore(topicGaps);
      
      return {
        topicGaps,
        totalTopics: topicGaps.length,
        averageScore,
        assessmentDate: new Date().toISOString(),
        studentName: undefined // Will be provided in request
      };
      
    } catch (error) {
      console.error('Error fetching assessment analysis:', error);
      return this.getSampleAnalysis();
    }
  }
  
  /**
   * Map topic name to NCLEX content area
   */
  private static mapToContentArea(topicName: string): string {
    const contentAreaMap: Record<string, string> = {
      'medication': 'Pharmacological and Parenteral Therapies',
      'safety': 'Safety and Infection Control',
      'management': 'Management of Care',
      'assessment': 'Health Promotion and Maintenance',
      'physiological': 'Physiological Integrity',
      'psychosocial': 'Psychosocial Integrity'
    };
    
    const lowerTopic = topicName.toLowerCase();
    for (const [key, value] of Object.entries(contentAreaMap)) {
      if (lowerTopic.includes(key)) {
        return value;
      }
    }
    
    return 'Safe and Effective Care Environment';
  }
  
  /**
   * Calculate current score from gap score
   */
  private static calculateCurrentScore(gapScore: number | string | null | undefined): number {
    const gap = parseFloat(gapScore?.toString() || '0');
    return Math.max(0, Math.round(100 - gap));
  }
  
  /**
   * Calculate priority level from gap score
   */
  private static calculatePriority(gapScore: number | string | null | undefined): number {
    const gap = parseFloat(gapScore?.toString() || '0');
    if (gap >= 40) return 1; // Critical priority
    if (gap >= 25) return 2; // High priority
    if (gap >= 15) return 3; // Medium priority
    return 4; // Low priority
  }
  
  /**
   * Calculate average score across all topics
   */
  private static calculateAverageScore(topicGaps: TopicGap[]): number {
    if (topicGaps.length === 0) return 0;
    const sum = topicGaps.reduce((acc, gap) => acc + gap.currentScore, 0);
    return Math.round(sum / topicGaps.length);
  }
  
  /**
   * Get sample analysis for demo purposes
   */
  private static getSampleAnalysis(): AssessmentAnalysis {
    return {
      topicGaps: [
        {
          topic: 'Medication Administration',
          contentArea: 'Pharmacological and Parenteral Therapies',
          currentScore: 65,
          targetScore: 85,
          priority: 1,
          gapSize: 35
        },
        {
          topic: 'Patient Safety',
          contentArea: 'Safety and Infection Control', 
          currentScore: 72,
          targetScore: 85,
          priority: 2,
          gapSize: 28
        },
        {
          topic: 'Health Assessment',
          contentArea: 'Health Promotion and Maintenance',
          currentScore: 78,
          targetScore: 85,
          priority: 3,
          gapSize: 22
        },
        {
          topic: 'Care Coordination',
          contentArea: 'Management of Care',
          currentScore: 82,
          targetScore: 85,
          priority: 4,
          gapSize: 18
        }
      ],
      totalTopics: 4,
      averageScore: 74,
      assessmentDate: new Date().toISOString(),
      studentName: 'NCLEX Student'
    };
  }
}