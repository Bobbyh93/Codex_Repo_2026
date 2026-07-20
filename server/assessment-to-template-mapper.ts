/**
 * Assessment Data to Template JSON Mapper
 * Transforms assessment analysis into structured template data
 */

import type { TemplateData } from './template-engine';

export interface TopicGap {
  topic: string;
  contentArea: string;
  currentScore: number;
  targetScore: number;
  priority: number;
  gapSize: number;
}

export interface AssessmentAnalysis {
  topicGaps: TopicGap[];
  totalTopics: number;
  averageScore: number;
  assessmentDate: string;
  studentName?: string;
}

export class AssessmentToTemplateMapper {
  
  /**
   * Transform assessment analysis into template JSON structure
   */
  static mapToTemplateData(analysis: AssessmentAnalysis): TemplateData {
    const topPriorityGaps = analysis.topicGaps
      .filter(gap => gap.priority <= 2)
      .slice(0, 6); // Top 6 for daily focus
    
    const currentStage = this.determineCurrentStage(analysis.averageScore);
    const targetStage = this.determineTargetStage(currentStage);
    
    return {
      // Cover page
      student_name: analysis.studentName || "NCLEX Candidate",
      assessment_date: this.formatDate(analysis.assessmentDate),
      current_stage: currentStage,
      target_stage: targetStage,
      completion_estimate: this.estimateCompletionTime(topPriorityGaps),
      
      // Progress indicators
      you_are_here: {
        current_stage: currentStage,
        stage_description: this.getStageDescription(currentStage),
        next_milestone: this.getNextMilestone(currentStage),
        progress_percent: this.calculateProgressPercent(analysis.averageScore)
      },
      
      // Daily focus items (top priority gaps → actionable tasks)
      daily_focus: topPriorityGaps.map((gap, index) => ({
        title: `Day ${index + 1}: Master ${gap.topic}`,
        description: this.generateFocusDescription(gap),
        estimated_time: this.estimateStudyTime(gap),
        success_criteria: this.generateSuccessCriteria(gap),
        resources: this.generateDailyResources(gap)
      })),
      
      // Success indicators
      success_indicators: {
        doing_right: this.identifyStrengths(analysis.topicGaps),
        needs_work: this.identifyWeaknesses(analysis.topicGaps),
        target_scores: this.generateTargetScores(analysis.topicGaps)
      },
      
      // Learning modules (organized by NCLEX categories)
      modules: this.generateLearningModules(analysis.topicGaps),
      
      // Additional resources
      additional_resources: this.generateAdditionalResources()
    };
  }
  
  private static determineCurrentStage(averageScore: number): string {
    if (averageScore < 50) return "Foundation Building";
    if (averageScore < 65) return "Knowledge Application"; 
    if (averageScore < 75) return "Critical Thinking";
    if (averageScore < 85) return "Test Mastery";
    return "NCLEX Ready";
  }
  
  private static determineTargetStage(currentStage: string): string {
    const stages = [
      "Foundation Building",
      "Knowledge Application", 
      "Critical Thinking",
      "Test Mastery",
      "NCLEX Ready"
    ];
    
    const currentIndex = stages.indexOf(currentStage);
    return stages[Math.min(currentIndex + 1, stages.length - 1)];
  }
  
  private static getStageDescription(stage: string): string {
    const descriptions = {
      "Foundation Building": "Building core nursing knowledge and understanding basic concepts",
      "Knowledge Application": "Applying nursing knowledge to patient scenarios and care plans",
      "Critical Thinking": "Analyzing complex situations using clinical judgment model",
      "Test Mastery": "Mastering test-taking strategies and time management",
      "NCLEX Ready": "Confident and prepared for NCLEX success"
    };
    
    return descriptions[stage as keyof typeof descriptions] || stage;
  }
  
  private static getNextMilestone(currentStage: string): string {
    const milestones = {
      "Foundation Building": "Complete fundamental concept mastery",
      "Knowledge Application": "Pass practice tests with 70% accuracy", 
      "Critical Thinking": "Master clinical judgment scenarios",
      "Test Mastery": "Achieve consistent 85%+ on practice exams",
      "NCLEX Ready": "Schedule and pass NCLEX exam"
    };
    
    return milestones[currentStage as keyof typeof milestones] || "Continue studying";
  }
  
  private static calculateProgressPercent(averageScore: number): number {
    // Map score to progress stages
    return Math.min(Math.round((averageScore / 85) * 100), 100);
  }
  
  private static generateFocusDescription(gap: TopicGap): string {
    return `Focus on ${gap.topic} fundamentals. Current performance: ${gap.currentScore}%. Target: ${gap.targetScore}%. Priority level: ${gap.priority}.`;
  }
  
  private static estimateStudyTime(gap: TopicGap): string {
    const baseTime = 60; // minutes
    const priorityMultiplier = gap.priority <= 1 ? 1.5 : 1.0;
    const gapMultiplier = (gap.targetScore - gap.currentScore) / 10;
    
    const totalMinutes = Math.round(baseTime * priorityMultiplier * Math.max(gapMultiplier, 0.5));
    return `${totalMinutes} minutes`;
  }
  
  private static generateSuccessCriteria(gap: TopicGap): string[] {
    return [
      `Score ${gap.targetScore}% or higher on practice questions`,
      `Complete all video content for ${gap.topic}`,
      `Successfully answer case study scenarios`,
      `Demonstrate understanding through teach-back method`
    ];
  }
  
  private static generateDailyResources(gap: TopicGap): TemplateData['daily_focus'][0]['resources'] {
    return [
      {
        type: 'video',
        title: `${gap.topic} Fundamentals`,
        duration: '15-20 min',
        url: `#video-${gap.topic.toLowerCase().replace(/\s+/g, '-')}`
      },
      {
        type: 'reading',
        title: `${gap.topic} Study Guide`,
        duration: '20-30 min'
      },
      {
        type: 'practice',
        title: `${gap.topic} Practice Questions`,
        duration: '20-25 min'
      }
    ];
  }
  
  private static identifyStrengths(gaps: TopicGap[]): string[] {
    return gaps
      .filter(gap => gap.currentScore >= 75)
      .slice(0, 4)
      .map(gap => `${gap.topic} (${gap.currentScore}%)`);
  }
  
  private static identifyWeaknesses(gaps: TopicGap[]): string[] {
    return gaps
      .filter(gap => gap.currentScore < 65)
      .slice(0, 4)
      .map(gap => `${gap.topic} (${gap.currentScore}%)`);
  }
  
  private static generateTargetScores(gaps: TopicGap[]): TemplateData['success_indicators']['target_scores'] {
    return gaps
      .slice(0, 6)
      .map(gap => ({
        topic: gap.topic,
        current: gap.currentScore,
        target: gap.targetScore
      }));
  }
  
  private static generateLearningModules(gaps: TopicGap[]): TemplateData['modules'] {
    // Group gaps by NCLEX categories
    const categories = this.groupGapsByCategory(gaps);
    
    return Object.entries(categories).map(([category, categoryGaps]) => ({
      title: category,
      stage: this.getCategoryStage(categoryGaps),
      learning_objectives: this.generateLearningObjectives(categoryGaps),
      video_content: this.generateVideoContent(categoryGaps),
      case_studies: this.generateCaseStudies(categoryGaps),
      skills_labs: this.generateSkillsLabs(categoryGaps),
      reflection_questions: this.generateReflectionQuestions(categoryGaps),
      assessment_links: this.generateAssessmentLinks(categoryGaps)
    }));
  }
  
  private static groupGapsByCategory(gaps: TopicGap[]): Record<string, TopicGap[]> {
    const categories: Record<string, TopicGap[]> = {};
    
    gaps.forEach(gap => {
      const category = gap.contentArea || 'General Nursing';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(gap);
    });
    
    return categories;
  }
  
  private static getCategoryStage(gaps: TopicGap[]): string {
    const avgScore = gaps.reduce((sum, gap) => sum + gap.currentScore, 0) / gaps.length;
    return this.determineCurrentStage(avgScore);
  }
  
  private static generateLearningObjectives(gaps: TopicGap[]): string[] {
    return gaps.map(gap => 
      `Master ${gap.topic} concepts and achieve ${gap.targetScore}% proficiency`
    );
  }
  
  private static generateVideoContent(gaps: TopicGap[]): TemplateData['modules'][0]['video_content'] {
    return gaps.map(gap => ({
      title: `${gap.topic} Essentials`,
      duration: '12-18 min',
      difficulty: gap.priority <= 2 ? 'High Priority' : 'Standard',
      embed_code: `video-${gap.topic.toLowerCase().replace(/\s+/g, '-')}`
    }));
  }
  
  private static generateCaseStudies(gaps: TopicGap[]): TemplateData['modules'][0]['case_studies'] {
    return gaps.slice(0, 2).map(gap => ({
      title: `${gap.topic} Clinical Scenario`,
      scenario: `Patient presents with conditions related to ${gap.topic}`,
      questions: [
        'What are the priority nursing interventions?',
        'What assessment findings would you expect?',
        'What patient education is needed?'
      ],
      key_points: [
        `Apply ${gap.topic} knowledge to patient care`,
        'Use clinical judgment model',
        'Prioritize patient safety'
      ]
    }));
  }
  
  private static generateSkillsLabs(gaps: TopicGap[]): TemplateData['modules'][0]['skills_labs'] {
    return gaps.slice(0, 1).map(gap => ({
      skill_name: `${gap.topic} Skill Practice`,
      equipment_needed: ['Standard nursing supplies', 'Patient simulator', 'Documentation forms'],
      steps: [
        'Review theoretical knowledge',
        'Demonstrate skill technique', 
        'Practice with feedback',
        'Document findings'
      ],
      safety_notes: [
        'Follow infection control protocols',
        'Verify patient identification',
        'Use proper body mechanics'
      ]
    }));
  }
  
  private static generateReflectionQuestions(gaps: TopicGap[]): string[] {
    return [
      'What aspects of this topic do I find most challenging?',
      'How does this knowledge apply to patient safety?',
      'What connections can I make to other nursing concepts?',
      'How will I know when I have mastered this material?'
    ];
  }
  
  private static generateAssessmentLinks(gaps: TopicGap[]): string[] {
    return gaps.map(gap => 
      `Practice Quiz: ${gap.topic} Assessment`
    );
  }
  
  private static generateAdditionalResources(): TemplateData['additional_resources'] {
    return [
      {
        category: 'NCLEX Prep Resources',
        items: [
          {
            title: 'NCSBN Learning Extension',
            url: 'https://learningext.ncsbn.org',
            type: 'Online Platform',
            description: 'Official NCLEX prep from the test makers'
          },
          {
            title: 'Kaplan Nursing',
            url: 'https://kaptest.com/nursing',
            type: 'Prep Course',
            description: 'Comprehensive NCLEX review program'
          }
        ]
      },
      {
        category: 'Clinical Resources',
        items: [
          {
            title: 'Nursing Central',
            url: 'https://nursingcentral.com',
            type: 'Clinical Reference',
            description: 'Point-of-care clinical information'
          }
        ]
      }
    ];
  }
  
  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  private static estimateCompletionTime(gaps: TopicGap[]): string {
    const totalHours = gaps.length * 2; // 2 hours per priority gap
    const weeks = Math.ceil(totalHours / 10); // 10 hours per week study time
    
    return `${weeks} weeks (${totalHours} hours total)`;
  }
}