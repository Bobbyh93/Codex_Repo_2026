/**
 * Multi-Format Template Renderer
 * Supports Markdown, HTML, and PDF output
 */

import { TemplateEngine, type TemplateData } from './template-engine';

export type OutputFormat = 'markdown' | 'html' | 'pdf';

export interface RenderOptions {
  format: OutputFormat;
  includeStyles?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  colorScheme?: 'light' | 'dark' | 'print';
}

export class TemplateRenderer {
  private static readonly MARKDOWN_TEMPLATE = `
# {{student_name}}'s Professional Study Guide
*Generated on {{assessment_date}}*

---

## 🎯 YOU ARE HERE: {{you_are_here.current_stage}}

**Current Stage:** {{you_are_here.current_stage}}  
**Description:** {{you_are_here.stage_description}}  
**Progress:** {{you_are_here.progress_percent}}%  
**Next Milestone:** {{you_are_here.next_milestone}}

---

## 📅 Daily Focus Plan

{{#each daily_focus}}
### {{this.title}}
**Time Required:** {{this.estimated_time}}  
**Description:** {{this.description}}

**Success Criteria:**
{{#each this.success_criteria}}
- {{this}}
{{/each}}

**Resources:**
{{#each this.resources}}
- **{{this.title}}** ({{this.type}}){{#if this.duration}} - {{this.duration}}{{/if}}
{{/each}}

---
{{/each}}

## ✅ Success Indicators

### What You're Doing Right
{{#each success_indicators.doing_right}}
- {{this}}
{{/each}}

### Areas That Need Work
{{#each success_indicators.needs_work}}
- {{this}}
{{/each}}

### Target Scores
{{#each success_indicators.target_scores}}
- **{{this.topic}}:** {{this.current}}% → {{this.target}}%
{{/each}}

---

## 📚 Learning Modules

{{#each modules}}
## Module: {{this.title}}
**Stage:** {{this.stage}}

### Learning Objectives
{{#each this.learning_objectives}}
- {{this}}
{{/each}}

### Video Content
{{#each this.video_content}}
- **{{this.title}}** ({{this.duration}}) - {{this.difficulty}}
{{/each}}

### Case Studies
{{#each this.case_studies}}
#### {{this.title}}
**Scenario:** {{this.scenario}}

**Questions:**
{{#each this.questions}}
1. {{this}}
{{/each}}

**Key Points:**
{{#each this.key_points}}
- {{this}}
{{/each}}
{{/each}}

### Skills Labs
{{#each this.skills_labs}}
#### {{this.skill_name}}

**Equipment Needed:**
{{#each this.equipment_needed}}
- {{this}}
{{/each}}

**Steps:**
{{#each this.steps}}
1. {{this}}
{{/each}}

**Safety Notes:**
{{#each this.safety_notes}}
⚠️ {{this}}
{{/each}}
{{/each}}

### Reflection Questions
{{#each this.reflection_questions}}
- {{this}}
{{/each}}

### Assessments
{{#each this.assessment_links}}
- {{this}}
{{/each}}

---
{{/each}}

## 📖 Additional Resources

{{#each additional_resources}}
### {{this.category}}
{{#each this.items}}
- **[{{this.title}}]({{this.url}})** ({{this.type}})  
  {{this.description}}
{{/each}}

{{/each}}

---

*This study guide was generated based on your assessment performance and follows evidence-based learning principles. Adjust the timeline as needed based on your progress.*
`;

  private static readonly HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{student_name}}'s Professional Study Guide</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #fafafa;
        }
        
        .header {
            text-align: center;
            padding: 2rem 0;
            border-bottom: 3px solid #2563eb;
            margin-bottom: 3rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #1e40af;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header .date {
            color: #64748b;
            font-style: italic;
        }
        
        .you-are-here {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin: 2rem 0;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .you-are-here h2 {
            font-size: 1.8rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .progress-bar {
            background: rgba(255,255,255,0.2);
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            margin: 1rem 0;
        }
        
        .progress-fill {
            height: 100%;
            background: #10b981;
            border-radius: 6px;
            width: {{you_are_here.progress_percent}}%;
            transition: width 0.3s ease;
        }
        
        .daily-focus {
            display: grid;
            gap: 1.5rem;
            margin: 2rem 0;
        }
        
        .focus-item {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            border-left: 4px solid #f59e0b;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        
        .focus-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        
        .focus-item h3 {
            color: #1e40af;
            margin-bottom: 0.5rem;
            font-size: 1.3rem;
        }
        
        .time-badge {
            background: #fef3c7;
            color: #92400e;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
            display: inline-block;
            margin-bottom: 1rem;
        }
        
        .success-indicators {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
        
        .indicator-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .indicator-card.strengths {
            border-left: 4px solid #10b981;
        }
        
        .indicator-card.weaknesses {
            border-left: 4px solid #ef4444;
        }
        
        .indicator-card.targets {
            border-left: 4px solid #8b5cf6;
        }
        
        .modules {
            display: grid;
            gap: 2rem;
            margin: 2rem 0;
        }
        
        .module {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-top: 4px solid #6366f1;
        }
        
        .module h3 {
            color: #1e40af;
            font-size: 1.5rem;
            margin-bottom: 1rem;
        }
        
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .video-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
        }
        
        .case-study {
            background: #fef7f0;
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 1rem;
            margin: 0.5rem 0;
        }
        
        .skills-lab {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 1rem;
            margin: 0.5rem 0;
        }
        
        .safety-note {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 0.5rem 1rem;
            margin: 0.5rem 0;
            border-radius: 0 8px 8px 0;
        }
        
        .resources {
            background: #f8fafc;
            border-radius: 12px;
            padding: 2rem;
            margin: 2rem 0;
        }
        
        .resource-category {
            margin-bottom: 2rem;
        }
        
        .resource-item {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
            margin: 0.5rem 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .resource-link {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }
        
        .resource-link:hover {
            text-decoration: underline;
        }
        
        ul, ol {
            margin: 1rem 0;
            padding-left: 1.5rem;
        }
        
        li {
            margin: 0.5rem 0;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .success-indicators,
            .video-grid {
                grid-template-columns: 1fr;
            }
        }
        
        @media print {
            body {
                background: white;
                color: black;
            }
            
            .focus-item,
            .indicator-card,
            .module {
                box-shadow: none;
                border: 1px solid #ccc;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{student_name}}'s Professional Study Guide</h1>
        <p class="date">Generated on {{assessment_date}}</p>
    </div>
    
    <div class="you-are-here">
        <h2>🎯 YOU ARE HERE: {{you_are_here.current_stage}}</h2>
        <p><strong>Description:</strong> {{you_are_here.stage_description}}</p>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <p><strong>Progress:</strong> {{you_are_here.progress_percent}}%</p>
        <p><strong>Next Milestone:</strong> {{you_are_here.next_milestone}}</p>
    </div>
    
    <h2>📅 Daily Focus Plan</h2>
    <div class="daily-focus">
        {{#each daily_focus}}
        <div class="focus-item">
            <h3>{{this.title}}</h3>
            <span class="time-badge">{{this.estimated_time}}</span>
            <p>{{this.description}}</p>
            
            <h4>Success Criteria:</h4>
            <ul>
                {{#each this.success_criteria}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
            
            <h4>Resources:</h4>
            <ul>
                {{#each this.resources}}
                <li><strong>{{this.title}}</strong> ({{this.type}}){{#if this.duration}} - {{this.duration}}{{/if}}</li>
                {{/each}}
            </ul>
        </div>
        {{/each}}
    </div>
    
    <h2>✅ Success Indicators</h2>
    <div class="success-indicators">
        <div class="indicator-card strengths">
            <h3>What You're Doing Right</h3>
            <ul>
                {{#each success_indicators.doing_right}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
        </div>
        
        <div class="indicator-card weaknesses">
            <h3>Areas That Need Work</h3>
            <ul>
                {{#each success_indicators.needs_work}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
        </div>
        
        <div class="indicator-card targets">
            <h3>Target Scores</h3>
            <ul>
                {{#each success_indicators.target_scores}}
                <li><strong>{{this.topic}}:</strong> {{this.current}}% → {{this.target}}%</li>
                {{/each}}
            </ul>
        </div>
    </div>
    
    <h2>📚 Learning Modules</h2>
    <div class="modules">
        {{#each modules}}
        <div class="module">
            <h3>Module: {{this.title}}</h3>
            <p><strong>Stage:</strong> {{this.stage}}</p>
            
            <h4>Learning Objectives</h4>
            <ul>
                {{#each this.learning_objectives}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
            
            <h4>Video Content</h4>
            <div class="video-grid">
                {{#each this.video_content}}
                <div class="video-card">
                    <h5>{{this.title}}</h5>
                    <p><strong>Duration:</strong> {{this.duration}}</p>
                    <p><strong>Difficulty:</strong> {{this.difficulty}}</p>
                </div>
                {{/each}}
            </div>
            
            {{#each this.case_studies}}
            <div class="case-study">
                <h5>{{this.title}}</h5>
                <p><strong>Scenario:</strong> {{this.scenario}}</p>
                <h6>Questions:</h6>
                <ol>
                    {{#each this.questions}}
                    <li>{{this}}</li>
                    {{/each}}
                </ol>
                <h6>Key Points:</h6>
                <ul>
                    {{#each this.key_points}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
            </div>
            {{/each}}
            
            {{#each this.skills_labs}}
            <div class="skills-lab">
                <h5>{{this.skill_name}}</h5>
                <h6>Equipment Needed:</h6>
                <ul>
                    {{#each this.equipment_needed}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
                <h6>Steps:</h6>
                <ol>
                    {{#each this.steps}}
                    <li>{{this}}</li>
                    {{/each}}
                </ol>
                <h6>Safety Notes:</h6>
                {{#each this.safety_notes}}
                <div class="safety-note">⚠️ {{this}}</div>
                {{/each}}
            </div>
            {{/each}}
            
            <h4>Reflection Questions</h4>
            <ul>
                {{#each this.reflection_questions}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
            
            <h4>Assessments</h4>
            <ul>
                {{#each this.assessment_links}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
        </div>
        {{/each}}
    </div>
    
    <div class="resources">
        <h2>📖 Additional Resources</h2>
        {{#each additional_resources}}
        <div class="resource-category">
            <h3>{{this.category}}</h3>
            {{#each this.items}}
            <div class="resource-item">
                <div>
                    <a href="{{this.url}}" class="resource-link" target="_blank">{{this.title}}</a>
                    <p>{{this.description}}</p>
                </div>
                <span style="color: #64748b; font-size: 0.875rem;">{{this.type}}</span>
            </div>
            {{/each}}
        </div>
        {{/each}}
    </div>
    
    <footer style="text-align: center; padding: 2rem; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 3rem;">
        <p><em>This study guide was generated based on your assessment performance and follows evidence-based learning principles. Adjust the timeline as needed based on your progress.</em></p>
    </footer>
</body>
</html>
`;

  /**
   * Render template data to specified format
   */
  static render(data: TemplateData, options: RenderOptions): string {
    const template = this.getTemplate(options.format);
    const engine = new TemplateEngine(template);
    
    return engine.render(data);
  }
  
  private static getTemplate(format: OutputFormat): string {
    switch (format) {
      case 'markdown':
        return this.MARKDOWN_TEMPLATE;
      case 'html':
        return this.HTML_TEMPLATE;
      case 'pdf':
        // PDF uses HTML template with print-optimized styles
        return this.HTML_TEMPLATE;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Generate downloadable file content
   */
  static generateDownload(data: TemplateData, format: OutputFormat): Buffer {
    const content = this.render(data, { format });
    
    switch (format) {
      case 'markdown':
      case 'html':
        return Buffer.from(content, 'utf-8');
      case 'pdf':
        // TODO: Integrate with PDF generation library
        return Buffer.from(content, 'utf-8');
      default:
        throw new Error(`Download not supported for format: ${format}`);
    }
  }
  
  /**
   * Get MIME type for format
   */
  static getMimeType(format: OutputFormat): string {
    const mimeTypes = {
      markdown: 'text/markdown',
      html: 'text/html',
      pdf: 'application/pdf'
    };
    
    return mimeTypes[format];
  }
  
  /**
   * Get file extension for format
   */
  static getFileExtension(format: OutputFormat): string {
    const extensions = {
      markdown: '.md',
      html: '.html',
      pdf: '.pdf'
    };
    
    return extensions[format];
  }
}