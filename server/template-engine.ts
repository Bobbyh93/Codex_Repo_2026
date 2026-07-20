/**
 * Template Engine for Professional Study Guides
 * Handles {{placeholder}} substitution and validation
 */

export interface TemplateData {
  // Cover page
  student_name: string;
  assessment_date: string;
  current_stage: string;
  target_stage: string;
  completion_estimate: string;
  
  // Progress indicators
  you_are_here: {
    current_stage: string;
    stage_description: string;
    next_milestone: string;
    progress_percent: number;
  };
  
  // Daily focus items
  daily_focus: {
    title: string;
    description: string;
    estimated_time: string;
    success_criteria: string[];
    resources: Array<{
      type: 'video' | 'reading' | 'practice';
      title: string;
      url?: string;
      duration?: string;
    }>;
  }[];
  
  // Success indicators
  success_indicators: {
    doing_right: string[];
    needs_work: string[];
    target_scores: Array<{
      topic: string;
      current: number;
      target: number;
    }>;
  };
  
  // Learning modules
  modules: Array<{
    title: string;
    stage: string;
    learning_objectives: string[];
    video_content: Array<{
      title: string;
      duration: string;
      difficulty: string;
      embed_code?: string;
    }>;
    case_studies: Array<{
      title: string;
      scenario: string;
      questions: string[];
      key_points: string[];
    }>;
    skills_labs: Array<{
      skill_name: string;
      equipment_needed: string[];
      steps: string[];
      safety_notes: string[];
    }>;
    reflection_questions: string[];
    assessment_links: string[];
  }>;
  
  // Resources and references
  additional_resources: Array<{
    category: string;
    items: Array<{
      title: string;
      url: string;
      type: string;
      description: string;
    }>;
  }>;
}

export class TemplateEngine {
  private template: string;
  
  constructor(template: string) {
    this.template = template;
  }
  
  /**
   * Replace {{placeholder}} syntax with actual data
   */
  render(data: TemplateData): string {
    let rendered = this.template;
    
    // Handle simple substitutions
    rendered = this.handleSimpleSubstitutions(rendered, data);
    
    // Handle complex objects and arrays
    rendered = this.handleComplexSubstitutions(rendered, data);
    
    // Validate no placeholders are left
    this.validateRendering(rendered);
    
    return rendered;
  }
  
  private handleSimpleSubstitutions(content: string, data: TemplateData): string {
    // Replace simple {{key}} patterns
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }
  
  private handleComplexSubstitutions(content: string, data: TemplateData): string {
    // Handle {{#each array}} loops
    content = this.handleEachLoops(content, data);
    
    // Handle {{#if condition}} blocks
    content = this.handleConditionalBlocks(content, data);
    
    return content;
  }
  
  private handleEachLoops(content: string, data: TemplateData): string {
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return content.replace(eachRegex, (match, arrayPath, template) => {
      const array = this.getNestedValue(data, arrayPath.trim());
      
      if (!Array.isArray(array)) {
        return '';
      }
      
      return array.map(item => {
        let itemTemplate = template;
        
        // Replace {{this.property}} with item values
        itemTemplate = itemTemplate.replace(/\{\{this\.([^}]+)\}\}/g, (subMatch: string, prop: string) => {
          const value = this.getNestedValue(item, prop.trim());
          return value !== undefined ? String(value) : subMatch;
        });
        
        // Replace {{this}} with the item itself
        itemTemplate = itemTemplate.replace(/\{\{this\}\}/g, String(item));
        
        return itemTemplate;
      }).join('');
    });
  }
  
  private handleConditionalBlocks(content: string, data: TemplateData): string {
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(\{\{#else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    
    return content.replace(ifRegex, (match, condition, trueBlock, elseMatch, falseBlock) => {
      const conditionValue = this.getNestedValue(data, condition.trim());
      const isTrue = Boolean(conditionValue) && conditionValue !== 0 && conditionValue !== '';
      
      return isTrue ? trueBlock : (falseBlock || '');
    });
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  private validateRendering(content: string): void {
    const remainingPlaceholders = content.match(/\{\{[^}]+\}\}/g);
    
    if (remainingPlaceholders) {
      console.warn('Unresolved placeholders found:', remainingPlaceholders);
    }
  }
  
  /**
   * Validate that template data contains all required fields
   */
  static validateTemplateData(data: any): data is TemplateData {
    const required = [
      'student_name',
      'assessment_date', 
      'current_stage',
      'you_are_here',
      'daily_focus',
      'success_indicators',
      'modules'
    ];
    
    for (const field of required) {
      if (!(field in data)) {
        throw new Error(`Missing required template field: ${field}`);
      }
    }
    
    return true;
  }
}