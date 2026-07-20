// Content Export System - One-click export with customizable formatting
import { db } from "./db";
import { reviewTopics } from "@shared/simplified-schema";
import { eq } from "drizzle-orm";

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'txt';
  contentType: 'topics' | 'assessments' | 'study-guide' | 'priority-analysis';
  includeFields: string[];
  filters?: {
    nclexCategory?: string;
    difficulty?: string;
    bodySystem?: string;
    population?: string;
  };
  groupBy?: string;
  sortBy?: string;
  customTemplate?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  contentType: string;
  data?: any;
  downloadUrl?: string;
  error?: string;
}

// Main export function
export async function exportContent(options: ExportOptions): Promise<ExportResult> {
  try {
    // Get the data based on content type
    const data = await fetchExportData(options);
    
    // Format the data according to the specified format
    const formattedContent = await formatData(data, options);
    
    // Generate filename
    const filename = generateFilename(options);
    
    return {
      success: true,
      filename,
      contentType: getContentType(options.format),
      data: formattedContent
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      filename: '',
      contentType: '',
      error: error.message
    };
  }
}

// Fetch data based on content type and filters
async function fetchExportData(options: ExportOptions): Promise<any[]> {
  switch (options.contentType) {
    case 'topics':
      return await fetchTopicsData(options);
    case 'assessments':
      return await fetchAssessmentsData(options);
    case 'study-guide':
      return await fetchStudyGuideData(options);
    case 'priority-analysis':
      return await fetchPriorityAnalysisData(options);
    default:
      throw new Error(`Unknown content type: ${options.contentType}`);
  }
}

// Fetch topics data with filters
async function fetchTopicsData(options: ExportOptions): Promise<any[]> {
  let query = db.select({
    id: reviewTopics.id,
    name: reviewTopics.name,
    description: reviewTopics.description,
    nclexCategory: reviewTopics.nclexCategory,
    nclexSubcategory: reviewTopics.nclexSubcategory,
    bodySystem: reviewTopics.bodySystem,
    nursingSpecialty: reviewTopics.nursingSpecialty,
    difficulty: reviewTopics.difficulty,
    estimatedStudyTime: reviewTopics.estimatedStudyTime,
    keywords: reviewTopics.keywords,
    createdAt: reviewTopics.createdAt
  }).from(reviewTopics).where(eq(reviewTopics.isActive, true));

  const results = await query;
  
  // Apply filters
  let filteredResults = results;
  
  if (options.filters) {
    if (options.filters.nclexCategory) {
      filteredResults = filteredResults.filter(r => r.nclexCategory === options.filters.nclexCategory);
    }
    if (options.filters.difficulty) {
      filteredResults = filteredResults.filter(r => r.difficulty === options.filters.difficulty);
    }
    if (options.filters.bodySystem) {
      filteredResults = filteredResults.filter(r => r.bodySystem === options.filters.bodySystem);
    }
  }
  
  // Apply sorting
  if (options.sortBy) {
    filteredResults.sort((a, b) => {
      const aVal = a[options.sortBy] || '';
      const bVal = b[options.sortBy] || '';
      return aVal.toString().localeCompare(bVal.toString());
    });
  }
  
  return filteredResults;
}

// Fetch assessment data (placeholder for now)
async function fetchAssessmentsData(options: ExportOptions): Promise<any[]> {
  // This would fetch from assessment_reports table when available
  return [
    {
      id: 1,
      fileName: 'Sample ATI Report',
      date: new Date().toISOString(),
      topicsIdentified: 15,
      averageScore: 72.5,
      weakAreas: ['Pharmacology', 'Safety']
    }
  ];
}

// Fetch study guide data
async function fetchStudyGuideData(options: ExportOptions): Promise<any[]> {
  const topics = await fetchTopicsData(options);
  
  // Group topics for study guide format
  const studyGuide = topics.map(topic => ({
    topicName: topic.name,
    description: topic.description,
    nclexCategory: topic.nclexCategory,
    bodySystem: topic.bodySystem || 'Core Concepts',
    difficulty: topic.difficulty,
    estimatedTime: topic.estimatedStudyTime,
    keyPoints: generateKeyPoints(topic),
    studyTips: generateStudyTips(topic)
  }));
  
  return studyGuide;
}

// Fetch priority analysis data
async function fetchPriorityAnalysisData(options: ExportOptions): Promise<any[]> {
  try {
    const { getSimpleTopicStats } = await import('./simple-topic-tracker');
    const stats = await getSimpleTopicStats();
    
    return stats.map(stat => ({
      topicName: stat.topicName,
      frequency: stat.frequency,
      priority: stat.priority,
      lastReviewed: stat.lastReviewed || 'Never',
      recommendedAction: generateRecommendedAction(stat)
    }));
  } catch (error) {
    return [];
  }
}

// Format data based on export format
async function formatData(data: any[], options: ExportOptions): Promise<string | Buffer> {
  switch (options.format) {
    case 'csv':
      return formatAsCSV(data, options);
    case 'json':
      return formatAsJSON(data, options);
    case 'pdf':
      return await formatAsPDF(data, options);
    case 'txt':
      return formatAsText(data, options);
    default:
      throw new Error(`Unknown format: ${options.format}`);
  }
}

// CSV formatter
function formatAsCSV(data: any[], options: ExportOptions): string {
  if (data.length === 0) return '';
  
  // Get headers based on included fields or all available fields
  const headers = options.includeFields.length > 0 
    ? options.includeFields 
    : Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
}

// JSON formatter
function formatAsJSON(data: any[], options: ExportOptions): string {
  // Filter fields if specified
  let exportData = data;
  if (options.includeFields.length > 0) {
    exportData = data.map(item => {
      const filtered = {};
      options.includeFields.forEach(field => {
        if (item[field] !== undefined) {
          filtered[field] = item[field];
        }
      });
      return filtered;
    });
  }
  
  // Group data if specified
  if (options.groupBy) {
    const grouped = {};
    exportData.forEach(item => {
      const groupKey = item[options.groupBy] || 'Other';
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(item);
    });
    exportData = grouped;
  }
  
  return JSON.stringify({
    exportInfo: {
      timestamp: new Date().toISOString(),
      contentType: options.contentType,
      recordCount: Array.isArray(exportData) ? exportData.length : Object.keys(exportData).length,
      filters: options.filters || {}
    },
    data: exportData
  }, null, 2);
}

// PDF formatter (simplified version)
async function formatAsPDF(data: any[], options: ExportOptions): Promise<Buffer> {
  // For now, return a simple text-based PDF content
  // In a full implementation, you'd use a PDF library like PDFKit
  const content = formatAsText(data, options);
  
  // Mock PDF buffer - in real implementation, use PDFKit or similar
  return Buffer.from(content, 'utf-8');
}

// Text formatter
function formatAsText(data: any[], options: ExportOptions): string {
  if (data.length === 0) return 'No data to export.';
  
  let output = `${options.contentType.toUpperCase()} EXPORT\n`;
  output += `Generated: ${new Date().toLocaleString()}\n`;
  output += `Records: ${data.length}\n`;
  output += '='.repeat(50) + '\n\n';
  
  if (options.contentType === 'study-guide') {
    return formatStudyGuideText(data, options);
  }
  
  // Standard formatting
  data.forEach((item, index) => {
    output += `${index + 1}. `;
    
    if (options.includeFields.length > 0) {
      options.includeFields.forEach(field => {
        if (item[field]) {
          output += `${field}: ${item[field]}\n   `;
        }
      });
    } else {
      // Show key fields
      if (item.name) output += `${item.name}\n`;
      if (item.description) output += `   Description: ${item.description}\n`;
      if (item.nclexCategory) output += `   NCLEX: ${item.nclexCategory}\n`;
      if (item.difficulty) output += `   Difficulty: ${item.difficulty}\n`;
    }
    
    output += '\n';
  });
  
  return output;
}

// Special formatting for study guides
function formatStudyGuideText(data: any[], options: ExportOptions): string {
  let output = 'NURSING STUDY GUIDE\n';
  output += `Generated: ${new Date().toLocaleString()}\n`;
  output += '='.repeat(50) + '\n\n';
  
  data.forEach((topic, index) => {
    output += `${index + 1}. ${topic.topicName}\n`;
    output += `   Category: ${topic.nclexCategory}\n`;
    if (topic.bodySystem) output += `   Body System: ${topic.bodySystem}\n`;
    output += `   Difficulty: ${topic.difficulty}\n`;
    output += `   Study Time: ${topic.estimatedTime} minutes\n`;
    output += `   Description: ${topic.description}\n`;
    
    if (topic.keyPoints) {
      output += `   Key Points:\n`;
      topic.keyPoints.forEach(point => output += `     • ${point}\n`);
    }
    
    if (topic.studyTips) {
      output += `   Study Tips:\n`;
      topic.studyTips.forEach(tip => output += `     • ${tip}\n`);
    }
    
    output += '\n' + '-'.repeat(40) + '\n\n';
  });
  
  return output;
}

// Helper functions
function generateFilename(options: ExportOptions): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const contentType = options.contentType.replace(/-/g, '_');
  return `${contentType}_export_${timestamp}.${options.format}`;
}

function getContentType(format: string): string {
  const types = {
    csv: 'text/csv',
    json: 'application/json',
    pdf: 'application/pdf',
    txt: 'text/plain'
  };
  return types[format] || 'application/octet-stream';
}

function generateKeyPoints(topic: any): string[] {
  const points = [];
  
  if (topic.nclexCategory === 'Basic Care and Comfort') {
    points.push('Focus on patient comfort measures');
    points.push('Consider cultural and personal preferences');
  } else if (topic.nclexCategory === 'Pharmacological and Parenteral Therapies') {
    points.push('Verify medication orders and patient allergies');
    points.push('Monitor for side effects and therapeutic response');
  } else if (topic.nclexCategory === 'Safety and Infection Control') {
    points.push('Implement appropriate precautions');
    points.push('Educate patient and family on safety measures');
  }
  
  if (topic.difficulty === 'Advanced') {
    points.push('Requires critical thinking and complex assessment');
  }
  
  return points;
}

function generateStudyTips(topic: any): string[] {
  const tips = [];
  
  if (topic.estimatedStudyTime > 60) {
    tips.push('Break study time into 20-minute focused sessions');
  }
  
  if (topic.bodySystem) {
    tips.push(`Review anatomy and physiology of ${topic.bodySystem} system`);
  }
  
  tips.push('Practice with case studies and scenarios');
  tips.push('Connect concepts to real patient situations');
  
  return tips;
}

function generateRecommendedAction(stat: any): string {
  if (stat.priority === 'high') {
    return 'Immediate review recommended - high frequency topic';
  } else if (stat.priority === 'medium') {
    return 'Schedule review within next week';
  } else {
    return 'Monitor for future review needs';
  }
}

// Get available export options
export function getExportOptions(): {
  formats: string[];
  contentTypes: string[];
  availableFields: { [key: string]: string[] };
} {
  return {
    formats: ['csv', 'json', 'pdf', 'txt'],
    contentTypes: ['topics', 'assessments', 'study-guide', 'priority-analysis'],
    availableFields: {
      topics: ['name', 'description', 'nclexCategory', 'bodySystem', 'difficulty', 'estimatedStudyTime'],
      assessments: ['fileName', 'date', 'topicsIdentified', 'averageScore', 'weakAreas'],
      'study-guide': ['topicName', 'nclexCategory', 'bodySystem', 'difficulty', 'keyPoints', 'studyTips'],
      'priority-analysis': ['topicName', 'frequency', 'priority', 'lastReviewed', 'recommendedAction']
    }
  };
}