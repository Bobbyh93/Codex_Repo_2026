import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { db } from './db';
import { nursingTopics, contentAreas, topicPerformance, assessmentReports } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

export async function generateStudyGuidePDF(reportId: string): Promise<Buffer> {
  // Fetch report and performance data
  const report = await db.query.assessmentReports.findFirst({
    where: eq(assessmentReports.id, reportId),
    with: {
      user: true
    }
  });

  if (!report) {
    throw new Error('Report not found');
  }

  // Fetch performance data for this report
  const performanceData = await db.query.topicPerformance.findMany({
    where: eq(topicPerformance.reportId, reportId),
    with: {
      topic: {
        with: {
          contentArea: true
        }
      }
    },
    orderBy: [desc(topicPerformance.priority), desc(topicPerformance.gapScore)]
  });

  // Organize data by Subject → System → Topic
  const organizedTopics = performanceData
    .filter(perf => perf.topic !== null)
    .map(perf => {
      // Determine subject based on available fields
      let subject = 'Fundamentals';
      if (perf.topic?.subject) {
        subject = perf.topic.subject;
      } else if (perf.topic?.specialty) {
        subject = perf.topic.specialty;
      } else if (perf.topic?.contentArea?.name) {
        // Map content area to subject
        const contentAreaName = perf.topic.contentArea.name.toLowerCase();
        if (contentAreaName.includes('pharmacology')) subject = 'Pharmacology';
        else if (contentAreaName.includes('fundamental')) subject = 'Fundamentals of Nursing';
        else if (contentAreaName.includes('mental') || contentAreaName.includes('psych')) subject = 'Mental Health';
        else if (contentAreaName.includes('maternal') || contentAreaName.includes('newborn')) subject = 'Maternal/Newborn';
        else if (contentAreaName.includes('pediatric')) subject = 'Pediatrics';
        else if (contentAreaName.includes('medical-surgical')) subject = 'Medical-Surgical';
      }

      // Determine system based on topic name and available fields
      let system = 'Core Concepts';
      if (perf.topic?.system) {
        system = perf.topic.system;
      } else if (perf.topic?.systemCategory) {
        system = perf.topic.systemCategory;
      } else if (perf.topic?.name) {
        // Infer system from topic name
        const topicName = perf.topic.name.toLowerCase();
        if (topicName.includes('cardiac') || topicName.includes('heart')) system = 'Cardiovascular';
        else if (topicName.includes('respiratory') || topicName.includes('lung')) system = 'Respiratory';
        else if (topicName.includes('neuro')) system = 'Neurological';
        else if (topicName.includes('renal') || topicName.includes('kidney')) system = 'Renal';
        else if (topicName.includes('gi') || topicName.includes('gastro')) system = 'Gastrointestinal';
        else if (topicName.includes('endocrine') || topicName.includes('diabetes')) system = 'Endocrine';
        else if (topicName.includes('musculoskeletal')) system = 'Musculoskeletal';
        else if (topicName.includes('immune')) system = 'Immune';
        else if (topicName.includes('assessment')) system = 'Assessment & Diagnosis';
        else if (topicName.includes('medication') || topicName.includes('pharm')) system = 'Medication Administration';
        else if (topicName.includes('safety') || topicName.includes('infection')) system = 'Safety & Infection Control';
      }

      return {
        subject,
        system,
        topicName: perf.topic?.name || 'Unknown Topic',
        score: parseFloat(perf.score || '0'),
        priority: perf.priority || 3,
        gapScore: parseFloat(perf.gapScore || '0'),
        studyTime: perf.recommendedStudyTime || 30
      };
    });

  // Group topics by Subject and System
  const grouped = organizedTopics.reduce((acc, topic) => {
    const key = `${topic.subject}::${topic.system}`;
    if (!acc[key]) {
      acc[key] = {
        subject: topic.subject,
        system: topic.system,
        topics: []
      };
    }
    acc[key].topics.push(topic);
    return acc;
  }, {} as Record<string, any>);

  // Calculate summary statistics
  const totalTopics = organizedTopics.length;
  const averageScore = totalTopics > 0 ? organizedTopics.reduce((sum, t) => sum + t.score, 0) / totalTopics : 0;
  const totalStudyMinutes = organizedTopics.reduce((sum, t) => sum + t.studyTime, 0);
  const highPriorityCount = organizedTopics.filter(t => t.priority <= 2).length;

  // Sort all topics by priority (high priority first)
  const sortedTopics = organizedTopics.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.gapScore - a.gapScore;
  });

  return createPDF({
    reportDate: report.uploadDate || new Date(),
    organizedTopics: sortedTopics,
    grouped,
    summary: {
      totalTopics,
      averageScore,
      estimatedStudyHours: Math.round(totalStudyMinutes / 60),
      highPriorityCount
    }
  });
}

function createPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    
    doc.pipe(stream);
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    // Header
    doc.fillColor('#1e40af')
       .fontSize(26)
       .font('Helvetica-Bold')
       .text('PERSONALIZED STUDY GUIDE', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fillColor('#64748b')
       .fontSize(14)
       .font('Helvetica')
       .text('NURSEPREP ANALYTICS', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fontSize(12)
       .text('Your Complete Study Blueprint', { align: 'center' });
    
    // Divider
    doc.moveTo(50, 120)
       .lineTo(550, 120)
       .strokeColor('#e2e8f0')
       .stroke();
    
    doc.moveDown(2);

    // Report Info Section (no personal identifiers)
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica');
    doc.text(`Generated: ${new Date(data.reportDate).toLocaleDateString()}`);
    
    doc.moveDown();

    // Summary Box
    const summaryBoxY = doc.y;
    doc.roundedRect(50, summaryBoxY, 500, 100, 5)
       .fillAndStroke('#f0f9ff', '#0ea5e9');
    
    doc.fillColor('#0c4a6e')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('SUMMARY', 60, summaryBoxY + 10);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Total Topics to Review: ${data.summary.totalTopics}`, 60, summaryBoxY + 32)
       .text(`Average Score: ${data.summary.averageScore.toFixed(1)}%`, 60, summaryBoxY + 50)
       .text(`High Priority Topics: ${data.summary.highPriorityCount}`, 300, summaryBoxY + 32)
       .text(`Estimated Study Time: ${data.summary.estimatedStudyHours} hours`, 300, summaryBoxY + 50);
    
    doc.y = summaryBoxY + 115;
    doc.moveDown();

    // Topics Organization Header
    doc.fillColor('#000000')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Topics to Review', { align: 'center' });
    
    doc.moveDown();
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#6b7280')
       .text('Organized by Subject → System → Topic for focused study', { align: 'center' });
    doc.fillColor('#dc2626');
    doc.text('⚠ High priority items are displayed first in each section', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(2);

    // Sort groups by subject and system
    const sortedGroups = Object.entries(data.grouped)
      .sort((a: any, b: any) => {
        if (a[1].subject !== b[1].subject) {
          return a[1].subject.localeCompare(b[1].subject);
        }
        return a[1].system.localeCompare(b[1].system);
      });

    sortedGroups.forEach(([key, group]: [string, any]) => {
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage();
      }

      // Subject & System Header
      doc.fillColor('#1e40af')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`${group.subject} → ${group.system}`);
      
      doc.moveDown(0.5);

      // Topics in this group (sorted by priority - high priority first)
      const sortedTopics = group.topics.sort((a: any, b: any) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.gapScore - a.gapScore;
      });
      
      // Add count of topics
      doc.fillColor('#6b7280')
         .fontSize(10)
         .font('Helvetica')
         .text(`${sortedTopics.length} topics in this area`);
      doc.fillColor('#000000');
      doc.moveDown(0.3);
      
      sortedTopics.forEach((topic: any) => {
          // Check for page break
          if (doc.y > 700) {
            doc.addPage();
          }

          // Priority color
          const priorityColor = topic.priority === 1 ? '#dc2626' : 
                              topic.priority === 2 ? '#ea580c' : 
                              topic.priority === 3 ? '#eab308' : '#059669';
          
          // Save Y before writing topic name
          const topicLineY = doc.y;

          // Topic name (left column)
          doc.fillColor('#000000')
             .fontSize(11)
             .font('Helvetica-Bold')
             .text(`• ${topic.topicName}`, 70, topicLineY, { width: 360 });
          
          // Priority badge (right column, same row as topic name)
          doc.fillColor(priorityColor)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`[P${topic.priority}]`, 450, topicLineY, { width: 80, align: 'right' });
          
          // Performance details on the next line
          const detailY = topicLineY + 15;
          doc.fillColor('#6b7280')
             .fontSize(9)
             .font('Helvetica')
             .text(`Score: ${topic.score.toFixed(1)}%  |  Gap: ${topic.gapScore.toFixed(0)}%  |  Study: ${topic.studyTime} min`, 85, detailY, { width: 445 });
          
          doc.y = detailY + 14;
          doc.moveDown(0.4);
        });
      
      doc.moveDown(0.5);
    });

    // Add new page for study recommendations
    doc.addPage();

    // Study Plan Recommendations
    doc.fillColor('#000000')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('RECOMMENDED STUDY APPROACH', { align: 'center' });
    
    doc.moveDown(2);

    // High Priority Topics
    const highPriorityTopics = data.organizedTopics.filter((t: any) => t.priority <= 2);
    const mediumPriorityTopics = data.organizedTopics.filter((t: any) => t.priority === 3);
    
    if (highPriorityTopics.length > 0) {
      doc.fillColor('#dc2626')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('WEEK 1: HIGH PRIORITY TOPICS');
      
      doc.moveDown();
      doc.fillColor('#000000')
         .fontSize(11)
         .font('Helvetica');
      
      highPriorityTopics.slice(0, 7).forEach((topic: any) => {
        doc.text(`• ${topic.subject} - ${topic.system}: ${topic.topicName}`);
        doc.fillColor('#6b7280')
           .fontSize(10)
           .text(`  Daily study time: ${Math.ceil(topic.studyTime / 7)} minutes`, { indent: 15 });
        doc.fillColor('#000000')
           .fontSize(11);
      });
      
      doc.moveDown();
    }

    if (mediumPriorityTopics.length > 0) {
      doc.fillColor('#ea580c')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('WEEK 2: MEDIUM PRIORITY TOPICS');
      
      doc.moveDown();
      doc.fillColor('#000000')
         .fontSize(11)
         .font('Helvetica');
      
      mediumPriorityTopics.slice(0, 7).forEach((topic: any) => {
        doc.text(`• ${topic.subject} - ${topic.system}: ${topic.topicName}`);
        doc.fillColor('#6b7280')
           .fontSize(10)
           .text(`  Daily study time: ${Math.ceil(topic.studyTime / 7)} minutes`, { indent: 15 });
        doc.fillColor('#000000')
           .fontSize(11);
      });
      
      doc.moveDown();
    }

    // Additional Resources Section
    doc.moveDown();
    doc.fillColor('#000000')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('RECOMMENDED RESOURCES');
    doc.moveDown();
    
    doc.fontSize(11)
       .font('Helvetica')
       .text('• Review your nursing textbook chapters for each topic area')
       .text('• Practice NCLEX-style questions daily (aim for 50-100 questions)')
       .text('• Watch educational videos from RegisteredNurseRN, Simple Nursing')
       .text('• Create flashcards for medication names and lab values')
       .text('• Join study groups to discuss challenging concepts');
    
    // Study Tips
    doc.moveDown(2);
    const tipsBoxY = doc.y;
    doc.roundedRect(50, tipsBoxY, 500, 120, 5)
       .fillAndStroke('#fef3c7', '#fbbf24');
    
    doc.fillColor('#92400e')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('STUDY TIPS FOR SUCCESS:', 60, tipsBoxY + 10);
    
    doc.font('Helvetica')
       .fontSize(10)
       .text('• Focus on high-priority topics first - they have the biggest knowledge gaps', 60, tipsBoxY + 28)
       .text('• Study related topics together (same subject & system) for better retention', 60, tipsBoxY + 44)
       .text('• Use active recall: test yourself frequently on the material', 60, tipsBoxY + 60)
       .text('• Review NCLEX-style questions for each topic area', 60, tipsBoxY + 76)
       .text('• Take practice assessments weekly to track your progress', 60, tipsBoxY + 92);
    
    doc.y = tipsBoxY + 130;

    // Footer
    doc.moveDown(4);
    doc.fillColor('#94a3b8')
       .fontSize(9)
       .text('© NursePrep Analytics • Generated ' + new Date().toLocaleString(), { align: 'center' });

    doc.end();
  });
}

// Generate customized PDF with additional instructor content
export async function generateCustomizedPDF(reportId: string, customizations?: any): Promise<Buffer> {
  // Fetch report and performance data
  const report = await db.query.assessmentReports.findFirst({
    where: eq(assessmentReports.id, reportId),
    with: {
      user: true
    }
  });

  if (!report) {
    throw new Error('Report not found');
  }

  // Fetch performance data for this report
  const performanceData = await db.query.topicPerformance.findMany({
    where: eq(topicPerformance.reportId, reportId),
    with: {
      topic: {
        with: {
          contentArea: true
        }
      }
    },
    orderBy: [desc(topicPerformance.priority), desc(topicPerformance.gapScore)]
  });

  // Process data same as before
  const organizedTopics = performanceData
    .filter(perf => perf.topic !== null)
    .map(perf => {
      let subject = 'Fundamentals';
      if (perf.topic?.subject) {
        subject = perf.topic.subject;
      } else if (perf.topic?.specialty) {
        subject = perf.topic.specialty;
      }

      let system = 'Core Concepts';
      if (perf.topic?.system) {
        system = perf.topic.system;
      } else if (perf.topic?.systemCategory) {
        system = perf.topic.systemCategory;
      }

      return {
        subject,
        system,
        topicName: perf.topic?.name || 'Unknown Topic',
        score: parseFloat(perf.score || '0'),
        priority: perf.priority || 3,
        gapScore: parseFloat(perf.gapScore || '0'),
        studyTime: perf.recommendedStudyTime || 30
      };
    });

  const grouped = organizedTopics.reduce((acc, topic) => {
    const key = `${topic.subject}::${topic.system}`;
    if (!acc[key]) {
      acc[key] = {
        subject: topic.subject,
        system: topic.system,
        topics: []
      };
    }
    acc[key].topics.push(topic);
    return acc;
  }, {} as Record<string, any>);

  const totalTopics = organizedTopics.length;
  const averageScore = totalTopics > 0 ? organizedTopics.reduce((sum, t) => sum + t.score, 0) / totalTopics : 0;
  const totalStudyMinutes = organizedTopics.reduce((sum, t) => sum + t.studyTime, 0);
  const highPriorityCount = organizedTopics.filter(t => t.priority <= 2).length;

  return createCustomizedPDF({
    studentName: (report as any).studentName || report.user?.username || 'Student',
    studentEmail: (report as any).studentEmail || report.user?.email || '',
    reportName: report.fileName || 'Assessment Report',
    reportDate: report.uploadDate || new Date(),
    organizedTopics,
    grouped,
    customizations,
    summary: {
      totalTopics,
      averageScore,
      estimatedStudyHours: Math.round(totalStudyMinutes / 60),
      highPriorityCount
    }
  });
}

function createCustomizedPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    
    doc.pipe(stream);
    
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    // Enhanced Header for Admin Version
    doc.fillColor('#1e40af')
       .fontSize(26)
       .font('Helvetica-Bold')
       .text('PERSONALIZED STUDY GUIDE', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fillColor('#64748b')
       .fontSize(14)
       .font('Helvetica')
       .text('NURSEPREP ANALYTICS', { align: 'center' });
    
    if (data.customizations?.instructorComments) {
      doc.moveDown(0.5);
      doc.fontSize(11)
         .fillColor('#059669')
         .text('Instructor Customized', { align: 'center' });
    }
    
    // Divider
    doc.moveTo(50, 130)
       .lineTo(550, 130)
       .strokeColor('#e2e8f0')
       .stroke();
    
    doc.moveDown(2);

    // Student Info Section
    doc.fillColor('#000000')
       .fontSize(12)
       .font('Helvetica');
    if (data.studentName) {
      doc.text(`Student: ${data.studentName}`);
    }
    if (data.studentEmail) {
      doc.text(`Email: ${data.studentEmail}`);
    }
    doc.text(`Assessment: ${data.reportName}`)
       .text(`Date: ${new Date(data.reportDate).toLocaleDateString()}`);
    
    doc.moveDown();

    // Instructor Comments (if provided)
    if (data.customizations?.instructorComments) {
      const commentBoxY = doc.y;
      doc.roundedRect(50, commentBoxY, 500, 80, 5)
         .fillAndStroke('#e0f2fe', '#0ea5e9');
      
      doc.fillColor('#0c4a6e')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Instructor Message', 60, commentBoxY + 10);
      
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#075985')
         .text(data.customizations.instructorComments, 60, commentBoxY + 28, {
           width: 480,
           align: 'left'
         });
      
      doc.fillColor('#000000');
      doc.y = commentBoxY + 92;
      doc.moveDown();
    }

    // Summary Box
    const summaryBoxY2 = doc.y;
    doc.roundedRect(50, summaryBoxY2, 500, 100, 5)
       .fillAndStroke('#f0f9ff', '#0ea5e9');
    
    doc.fillColor('#0c4a6e')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('PERFORMANCE SUMMARY', 60, summaryBoxY2 + 10);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Total Topics to Review: ${data.summary.totalTopics}`, 60, summaryBoxY2 + 32)
       .text(`Average Score: ${data.summary.averageScore.toFixed(1)}%`, 60, summaryBoxY2 + 50)
       .text(`High Priority Topics: ${data.summary.highPriorityCount}`, 300, summaryBoxY2 + 32)
       .text(`Estimated Study Time: ${data.summary.estimatedStudyHours} hours`, 300, summaryBoxY2 + 50);
    
    doc.fillColor('#000000');
    doc.y = summaryBoxY2 + 115;
    doc.moveDown();

    // Additional Study Notes (if customized)
    if (data.customizations?.additionalNotes) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('PERSONALIZED STUDY NOTES');
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.customizations.additionalNotes);
      doc.moveDown();
    }

    // Topics continue as before
    doc.addPage();
    doc.fillColor('#000000')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('Topics to Review - By Subject & System', { align: 'center' });
    doc.moveDown(2);

    // Render topics as before
    const sortedGroups = Object.entries(data.grouped)
      .sort((a: any, b: any) => {
        if (a[1].subject !== b[1].subject) {
          return a[1].subject.localeCompare(b[1].subject);
        }
        return a[1].system.localeCompare(b[1].system);
      });

    sortedGroups.forEach(([key, group]: [string, any]) => {
      if (doc.y > 650) {
        doc.addPage();
      }

      doc.fillColor('#1e40af')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(`${group.subject} → ${group.system}`);
      doc.moveDown(0.5);

      group.topics
        .sort((a: any, b: any) => a.priority - b.priority)
        .forEach((topic: any) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          const priorityColor = topic.priority === 1 ? '#dc2626' : 
                              topic.priority === 2 ? '#ea580c' : 
                              topic.priority === 3 ? '#eab308' : '#059669';

          // Save Y before writing topic name
          const topicLineY2 = doc.y;

          // Topic name (left column)
          doc.fillColor('#000000')
             .fontSize(11)
             .font('Helvetica-Bold')
             .text(`• ${topic.topicName}`, 70, topicLineY2, { width: 360 });
          
          // Priority badge (right column, same row)
          doc.fillColor(priorityColor)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(`[P${topic.priority}]`, 450, topicLineY2, { width: 80, align: 'right' });
          
          // Performance details on the next line
          const detailY2 = topicLineY2 + 15;
          doc.fillColor('#6b7280')
             .fontSize(9)
             .font('Helvetica')
             .text(`Score: ${topic.score.toFixed(1)}%  |  Gap: ${topic.gapScore.toFixed(0)}%  |  Study: ${topic.studyTime} min`, 85, detailY2, { width: 445 });
          
          doc.y = detailY2 + 14;
          doc.moveDown(0.4);
        });
      
      doc.moveDown();
    });

    // Customized Weekly Plan (if provided)
    if (data.customizations?.weeklyPlan) {
      if (doc.y > 500) {
        doc.addPage();
      }
      
      doc.fillColor('#000000')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('CUSTOMIZED WEEKLY STUDY PLAN');
      doc.moveDown();
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.customizations.weeklyPlan);
      doc.moveDown(2);
    }

    // Recommended Resources (if customized)
    if (data.customizations?.recommendedResources) {
      if (doc.y > 500) {
        doc.addPage();
      }
      
      doc.fillColor('#000000')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('INSTRUCTOR RECOMMENDED RESOURCES');
      doc.moveDown();
      
      doc.fontSize(11)
         .font('Helvetica')
         .text(data.customizations.recommendedResources);
      doc.moveDown(2);
    }

    // Footer
    doc.fillColor('#94a3b8')
       .fontSize(9)
       .text('© NursePrep Analytics • Generated ' + new Date().toLocaleString(), 50, 750, { align: 'center' });

    doc.end();
  });
}

// Keep the old function for backwards compatibility
export function generateStudyPlanPDF(data: any): Promise<Buffer> {
  return generateStudyGuidePDF(data.reportId || data.id);
}