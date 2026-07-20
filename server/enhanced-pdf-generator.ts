import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { db } from './db';
import { nursingTopics, contentAreas, topicPerformance, assessmentReports } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

interface StudyGuideData {
  student: {
    name: string;
    email?: string;
    school?: string;
  };
  assessment: {
    date: Date;
    fileName: string;
    overallScore: number;
    totalTopics: number;
  };
  performance: {
    strengths: any[];
    weaknesses: any[];
    criticalGaps: any[];
  };
  studyPlan: {
    dailyGoals: any[];
    weeklyMilestones: any[];
    estimatedTime: number;
  };
  resources: {
    videos: any[];
    readings: any[];
    practice: any[];
  };
}

export async function generateProfessionalStudyGuide(reportId: string): Promise<Buffer> {
  // Fetch comprehensive data
  const report = await db.query.assessmentReports.findFirst({
    where: eq(assessmentReports.id, reportId),
    with: {
      user: true
    }
  });

  if (!report) {
    throw new Error('Report not found');
  }

  // Fetch performance data
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

  // Process and organize data
  const processedTopics = performanceData
    .filter(perf => perf.topic !== null)
    .map(perf => {
      const score = parseFloat(perf.score || '0');
      const gapScore = parseFloat(perf.gapScore || '0');
      
      // Determine subject and system
      let subject = 'Fundamentals';
      let system = 'Core Concepts';
      
      if (perf.topic?.subject) subject = perf.topic.subject;
      else if (perf.topic?.specialty) subject = perf.topic.specialty;
      
      if (perf.topic?.system) system = perf.topic.system;
      else if (perf.topic?.systemCategory) system = perf.topic.systemCategory;
      
      // Categorize topic name for better organization
      const topicName = perf.topic?.name || 'Unknown Topic';
      
      return {
        id: perf.topic?.id,
        subject,
        system,
        topicName,
        score,
        priority: perf.priority || 3,
        gapScore,
        studyTime: perf.recommendedStudyTime || 30,
        category: perf.topic?.contentArea?.name || 'General',
        performanceLevel: score >= 80 ? 'strong' : score >= 60 ? 'moderate' : 'weak'
      };
    });

  // Categorize performance
  const strengths = processedTopics.filter(t => t.performanceLevel === 'strong');
  const weaknesses = processedTopics.filter(t => t.performanceLevel === 'weak');
  const criticalGaps = processedTopics.filter(t => t.priority <= 2);
  
  // Calculate statistics
  const averageScore = processedTopics.length > 0 
    ? processedTopics.reduce((sum, t) => sum + t.score, 0) / processedTopics.length 
    : 0;
  
  const totalStudyHours = Math.ceil(
    processedTopics.reduce((sum, t) => sum + t.studyTime, 0) / 60
  );

  // Group by content areas for organized study
  const groupedByArea = processedTopics.reduce((acc, topic) => {
    const key = topic.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(topic);
    return acc;
  }, {} as Record<string, any[]>);

  // Prepare study guide data
  const guideData: StudyGuideData = {
    student: {
      name: report.user?.username || 'Student',
      email: report.user?.email,
      school: report.user?.school || undefined
    },
    assessment: {
      date: report.uploadDate || new Date(),
      fileName: report.fileName,
      overallScore: averageScore,
      totalTopics: processedTopics.length
    },
    performance: {
      strengths,
      weaknesses,
      criticalGaps
    },
    studyPlan: {
      dailyGoals: generateDailyGoals(criticalGaps),
      weeklyMilestones: generateWeeklyMilestones(groupedByArea),
      estimatedTime: totalStudyHours
    },
    resources: {
      videos: generateVideoResources(weaknesses),
      readings: generateReadingResources(processedTopics),
      practice: generatePracticeResources(criticalGaps)
    }
  };

  return createComprehensivePDF(guideData, processedTopics, groupedByArea);
}

function createComprehensivePDF(
  data: StudyGuideData, 
  topics: any[], 
  groupedByArea: Record<string, any[]>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: 'NursePrep Analytics - Personalized Study Guide',
        Author: 'NursePrep Analytics',
        Subject: 'NCLEX Study Guide',
        CreationDate: new Date()
      }
    });
    
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    
    doc.pipe(stream);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    // Define colors
    const colors = {
      primary: '#1e40af',
      secondary: '#0ea5e9',
      success: '#059669',
      warning: '#ea580c',
      danger: '#dc2626',
      muted: '#64748b',
      light: '#f1f5f9',
      dark: '#0f172a'
    };

    // Helper functions
    const addHeader = (text: string, size: number = 20, color: string = colors.primary) => {
      doc.fillColor(color)
         .fontSize(size)
         .font('Helvetica-Bold')
         .text(text);
      doc.fillColor(colors.dark);
    };

    const addSubheader = (text: string, size: number = 14) => {
      doc.fillColor(colors.secondary)
         .fontSize(size)
         .font('Helvetica-Bold')
         .text(text);
      doc.fillColor(colors.dark);
    };

    const addDivider = () => {
      const y = doc.y;
      doc.moveTo(40, y)
         .lineTo(572, y)
         .strokeColor(colors.light)
         .lineWidth(1)
         .stroke();
      doc.moveDown(0.5);
    };

    const addBox = (x: number, y: number, width: number, height: number, fillColor: string, strokeColor?: string) => {
      if (strokeColor) {
        doc.roundedRect(x, y, width, height, 5)
           .fillAndStroke(fillColor, strokeColor);
      } else {
        doc.roundedRect(x, y, width, height, 5)
           .fill(fillColor);
      }
    };

    // === PAGE 1: COVER PAGE ===
    // Header background
    addBox(0, 0, 612, 120, colors.primary);
    
    // Title
    doc.fillColor('#ffffff')
       .fontSize(32)
       .font('Helvetica-Bold')
       .text('PERSONALIZED STUDY GUIDE', 40, 30, { align: 'center' });
    
    doc.fontSize(16)
       .font('Helvetica')
       .text('NURSEPREP ANALYTICS', 40, 70, { align: 'center' });
    
    doc.moveDown(4);
    
    // Assessment Details Card
    doc.fillColor(colors.dark);
    addBox(40, 140, 532, 100, '#f8fafc', colors.secondary);
    
    doc.fillColor(colors.dark)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('ASSESSMENT DETAILS', 55, 155);
    
    doc.fontSize(11)
       .font('Helvetica');
    
    if (data.student.school) {
      doc.text(`School: ${data.student.school}`, 55, 180);
    }
    
    doc.text(`Assessment Date: ${data.assessment.date.toLocaleDateString()}`, 320, 180);
    doc.text(`Report: ${data.assessment.fileName}`, 320, 195);
    
    // Performance Overview
    const overviewBoxTop = 260;
    doc.y = overviewBoxTop;
    addBox(40, overviewBoxTop, 532, 140, '#fff7ed', colors.warning);
    
    const overviewY = overviewBoxTop + 10;
    doc.fillColor(colors.dark)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('PERFORMANCE OVERVIEW', 55, overviewY);
    
    doc.fontSize(24)
       .font('Helvetica-Bold');
    
    // Overall Score with color coding
    const scoreColor = data.assessment.overallScore >= 80 ? colors.success :
                      data.assessment.overallScore >= 60 ? colors.warning : colors.danger;
    
    doc.fillColor(scoreColor)
       .text(`${data.assessment.overallScore.toFixed(1)}%`, 55, overviewY + 30);
    
    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica')
       .text('Overall Score', 55, overviewY + 60);
    
    // Stats
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(`${data.assessment.totalTopics}`, 200, overviewY + 35);
    
    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica')
       .text('Topics Assessed', 200, overviewY + 60);
    
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(`${data.performance.criticalGaps.length}`, 320, overviewY + 35);
    
    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica')
       .text('Critical Gaps', 320, overviewY + 60);
    
    doc.fillColor(colors.dark)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(`${data.studyPlan.estimatedTime}h`, 420, overviewY + 35);
    
    doc.fillColor(colors.muted)
       .fontSize(10)
       .font('Helvetica')
       .text('Study Time Needed', 420, overviewY + 60);
    
    // Quick Summary
    doc.y = 420;
    addHeader('YOUR LEARNING JOURNEY', 16, colors.primary);
    doc.moveDown(0.5);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    // Progress indicator
    const stages = [
      { name: 'Foundation', score: 0, desc: 'Building core knowledge' },
      { name: 'Development', score: 40, desc: 'Strengthening understanding' },
      { name: 'Proficiency', score: 60, desc: 'Applying concepts' },
      { name: 'Mastery', score: 80, desc: 'Ready for NCLEX' }
    ];
    
    const currentStage = stages.reduce((prev, curr) => 
      data.assessment.overallScore >= curr.score ? curr : prev
    );
    
    doc.text(`You are currently in the ${currentStage.name} stage: ${currentStage.desc}`, 40, doc.y);
    doc.moveDown();
    
    // Visual progress bar
    const barY = doc.y;
    const barWidth = 492;
    const barHeight = 30;
    
    // Background bar
    addBox(40, barY, barWidth, barHeight, '#e2e8f0');
    
    // Progress fill
    const progressWidth = (data.assessment.overallScore / 100) * barWidth;
    addBox(40, barY, progressWidth, barHeight, scoreColor);
    
    // Stage markers
    stages.forEach(stage => {
      const markerX = 40 + (stage.score / 100) * barWidth;
      doc.strokeColor(colors.dark)
         .lineWidth(2)
         .moveTo(markerX, barY - 5)
         .lineTo(markerX, barY + barHeight + 5)
         .stroke();
      
      doc.fillColor(colors.muted)
         .fontSize(9)
         .text(stage.name, markerX - 20, barY + barHeight + 10);
    });
    
    // Footer for page 1
    doc.fillColor(colors.muted)
       .fontSize(9)
       .text('Generated by NursePrep Analytics • Page 1', 40, 750, { align: 'center' });
    
    // === PAGE 2: EXECUTIVE SUMMARY ===
    doc.addPage();
    
    addHeader('EXECUTIVE SUMMARY', 22);
    addDivider();
    doc.moveDown();
    
    // Key Findings
    addSubheader('Key Findings', 16);
    doc.moveDown(0.5);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    // Strengths section
    if (data.performance.strengths.length > 0) {
      doc.fillColor(colors.success)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('✓ Areas of Strength', 40, doc.y);
      
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica');
      
      data.performance.strengths.slice(0, 5).forEach(topic => {
        doc.text(`• ${topic.subject} - ${topic.topicName}: ${topic.score.toFixed(1)}%`, 55, doc.y);
      });
      
      doc.moveDown();
    }
    
    // Critical Gaps section
    if (data.performance.criticalGaps.length > 0) {
      doc.fillColor(colors.danger)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('⚠ Critical Knowledge Gaps', 40, doc.y);
      
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica');
      
      data.performance.criticalGaps.slice(0, 7).forEach(topic => {
        doc.text(`• ${topic.subject} - ${topic.topicName}: ${topic.score.toFixed(1)}% (Gap: ${topic.gapScore.toFixed(0)}%)`, 55, doc.y);
      });
      
      doc.moveDown();
    }
    
    // Study Recommendations
    addSubheader('Immediate Action Items', 16);
    doc.moveDown(0.5);
    
    const actionItems = [
      'Focus on high-priority topics first - these have the largest knowledge gaps',
      'Dedicate at least 2-3 hours daily to structured study',
      'Complete practice questions after each study session',
      'Review fundamentals before advancing to complex topics',
      'Take weekly practice assessments to track progress'
    ];
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    actionItems.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`, 40, doc.y);
    });
    
    doc.moveDown();
    
    // Study Timeline
    addSubheader('Recommended Study Timeline', 16);
    doc.moveDown(0.5);
    
    // Timeline visualization
    const timelineY = doc.y;
    const weeks = Math.ceil(data.studyPlan.estimatedTime / 20); // Assuming 20 hours per week
    
    for (let week = 0; week < Math.min(weeks, 4); week++) {
      const weekX = 40 + (week * 130);
      
      // Week box
      addBox(weekX, timelineY, 120, 80, '#f0f9ff', colors.secondary);
      
      doc.fillColor(colors.dark)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`Week ${week + 1}`, weekX + 35, timelineY + 10);
      
      doc.fontSize(10)
         .font('Helvetica');
      
      // Week focus
      const weekFocus = week === 0 ? 'Critical Gaps' :
                       week === 1 ? 'Weak Areas' :
                       week === 2 ? 'Reinforcement' : 'Practice Tests';
      
      doc.text(weekFocus, weekX + 20, timelineY + 30);
      
      // Hours
      doc.fillColor(colors.muted)
         .fontSize(9)
         .text(`~${Math.min(20, data.studyPlan.estimatedTime - (week * 20))} hours`, weekX + 25, timelineY + 50);
    }
    
    // === PAGE 3: DETAILED TOPIC ANALYSIS ===
    doc.addPage();
    
    addHeader('DETAILED TOPIC ANALYSIS', 22);
    addDivider();
    doc.moveDown();
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.muted)
       .text('Topics are organized by content area and priority level', 40, doc.y);
    doc.moveDown();
    
    // Process grouped topics
    Object.entries(groupedByArea).forEach(([area, areaTopics]) => {
      // Check if we need a new page
      if (doc.y > 600) {
        doc.addPage();
      }
      
      // Area header - save Y before drawing box
      const areaHeaderY = doc.y;
      addBox(40, areaHeaderY, 532, 30, colors.primary);
      
      doc.fillColor('#ffffff')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(area, 50, areaHeaderY + 8);
      
      doc.y = areaHeaderY + 38;
      doc.fillColor(colors.dark);
      
      // Sort topics by priority
      const sortedTopics = (areaTopics as any[]).sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.gapScore - a.gapScore;
      });
      
      // Topic table header
      const tableHeaderY = doc.y;
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Topic', 50, tableHeaderY)
         .text('Score', 350, tableHeaderY)
         .text('Priority', 420, tableHeaderY)
         .text('Study Time', 480, tableHeaderY);
      
      doc.y = tableHeaderY + 16;
      
      // Topic rows
      doc.font('Helvetica')
         .fontSize(9);
      
      sortedTopics.slice(0, 10).forEach(topic => {
        if (doc.y > 700) {
          doc.addPage();
        }
        
        // Priority color coding
        const priorityColor = topic.priority === 1 ? colors.danger :
                            topic.priority === 2 ? colors.warning :
                            topic.priority === 3 ? colors.secondary : colors.success;
        
        // Save row Y before writing any columns
        const rowY = doc.y;

        // Topic name (advances doc.y)
        doc.fillColor(colors.dark)
           .text(`• ${topic.topicName}`, 50, rowY, { width: 280 });
        
        // Score with color (same row Y)
        const scoreColor = topic.score >= 70 ? colors.success :
                          topic.score >= 50 ? colors.warning : colors.danger;
        doc.fillColor(scoreColor)
           .text(`${topic.score.toFixed(1)}%`, 350, rowY);
        
        // Priority badge (same row Y)
        doc.fillColor(priorityColor)
           .text(`P${topic.priority}`, 430, rowY);
        
        // Study time (same row Y)
        doc.fillColor(colors.muted)
           .text(`${topic.studyTime} min`, 485, rowY);
        
        // Advance past the row
        doc.y = rowY + 14;
        doc.moveDown(0.2);
      });
      
      doc.moveDown();
    });
    
    // === PAGE 4: PERSONALIZED STUDY PLAN ===
    doc.addPage();
    
    addHeader('YOUR PERSONALIZED STUDY PLAN', 22);
    addDivider();
    doc.moveDown();
    
    // Daily Schedule
    addSubheader('Daily Study Schedule', 16);
    doc.moveDown(0.5);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    const dailySchedule = [
      { time: '9:00 AM - 10:30 AM', activity: 'Content Review', description: 'Read textbook chapters, watch educational videos' },
      { time: '10:30 AM - 11:00 AM', activity: 'Break', description: 'Rest and refresh' },
      { time: '11:00 AM - 12:30 PM', activity: 'Practice Questions', description: 'Complete 50-75 NCLEX-style questions' },
      { time: '2:00 PM - 3:30 PM', activity: 'Weak Area Focus', description: 'Deep dive into critical gap topics' },
      { time: '3:30 PM - 4:00 PM', activity: 'Review & Reflect', description: 'Review mistakes, create flashcards' }
    ];
    
    // Schedule table
    dailySchedule.forEach(slot => {
      if (doc.y > 650) {
        doc.addPage();
      }
      
      // Save Y before drawing time block box
      const slotBoxY = doc.y;
      addBox(40, slotBoxY, 532, 45, '#f8fafc', '#e2e8f0');
      
      doc.fillColor(colors.primary)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(slot.time, 50, slotBoxY + 8);
      
      doc.fillColor(colors.dark)
         .text(slot.activity, 180, slotBoxY + 8);
      
      doc.fillColor(colors.muted)
         .fontSize(9)
         .font('Helvetica')
         .text(slot.description, 50, slotBoxY + 26);
      
      doc.y = slotBoxY + 55;
    });
    
    doc.moveDown();
    
    // Weekly Milestones
    addSubheader('Weekly Milestones', 16);
    doc.moveDown(0.5);
    
    const milestones = [
      'Complete review of all critical gap topics',
      'Score 70% or higher on practice assessments',
      'Master medication calculations and dosages',
      'Review and understand all rationales for incorrect answers'
    ];
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    milestones.forEach((milestone, index) => {
      doc.text(`Week ${index + 1}: ${milestone}`, 40, doc.y);
    });
    
    // === PAGE 5: RESOURCES ===
    doc.addPage();
    
    addHeader('STUDY RESOURCES', 22);
    addDivider();
    doc.moveDown();
    
    // Video Resources
    addSubheader('📹 Recommended Video Content', 14);
    doc.moveDown(0.5);
    
    const videoResources = [
      { channel: 'RegisteredNurseRN', topics: 'Pharmacology, Med-Surg, Fundamentals' },
      { channel: 'Simple Nursing', topics: 'Visual learning, Mnemonics, Quick reviews' },
      { channel: 'Nurse Sarah', topics: 'NCLEX strategies, Test-taking tips' }
    ];
    
    doc.fontSize(10)
       .font('Helvetica');
    
    videoResources.forEach(resource => {
      const videoRowY = doc.y;
      doc.fillColor(colors.dark)
         .font('Helvetica-Bold')
         .text(`• ${resource.channel}:`, 40, videoRowY);
      doc.fillColor(colors.muted)
         .font('Helvetica')
         .text(`  ${resource.topics}`, 140, videoRowY);
      doc.y = videoRowY + 14;
      doc.moveDown(0.3);
    });
    
    doc.moveDown();
    
    // Reading Materials
    addSubheader('📚 Essential Reading Materials', 14);
    doc.moveDown(0.5);
    
    const readings = [
      'Open RN Nursing Fundamentals',
      'Open RN Nursing Pharmacology',
      'Open RN Nursing Management and Professional Concepts',
      'Open RN Nursing Skills'
    ];
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    readings.forEach(book => {
      doc.text(`• ${book}`, 40, doc.y);
    });
    
    doc.moveDown();
    
    // Practice Resources
    addSubheader('✏️ Practice Question Banks', 14);
    doc.moveDown(0.5);
    
    const practiceResources = [
      { name: 'Open RN Textbooks', description: 'Free, comprehensive nursing textbooks aligned to NCLEX content areas' },
      { name: 'Open RN Practice Questions', description: 'NCLEX-style questions embedded in Open RN chapters' }
    ];
    
    practiceResources.forEach(resource => {
      doc.fillColor(colors.dark)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`• ${resource.name}`, 40, doc.y);
      doc.fillColor(colors.muted)
         .fontSize(9)
         .font('Helvetica')
         .text(resource.description, 55, doc.y);
      doc.moveDown(0.5);
    });
    
    // Study Tips Box
    doc.moveDown();
    const tipsBoxTop = doc.y;
    addBox(40, tipsBoxTop, 532, 140, '#fef3c7', colors.warning);
    
    doc.fillColor(colors.dark)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('STUDY TIPS FOR SUCCESS', 50, tipsBoxTop + 10);
    
    const tips = [
      'Use the Pomodoro Technique: 25 minutes focused study, 5 minute break',
      'Create mnemonics for difficult concepts and medication names',
      'Teach concepts to others - explaining reinforces understanding',
      'Focus on the "why" behind answers, not just memorization',
      'Take care of yourself: proper sleep, nutrition, and exercise'
    ];
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    tips.forEach((tip, index) => {
      doc.text(`${index + 1}. ${tip}`, 50, tipsBoxTop + 30 + (index * 18), { width: 500 });
    });
    
    doc.y = tipsBoxTop + 150;
    
    // === PAGE 6: TRACKING PROGRESS ===
    doc.addPage();
    
    addHeader('TRACKING YOUR PROGRESS', 22);
    addDivider();
    doc.moveDown();
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor(colors.dark)
       .text('Use this section to monitor your improvement over time', 40, doc.y);
    doc.moveDown();
    
    // Progress Tracking Table
    addSubheader('Weekly Progress Tracker', 14);
    doc.moveDown(0.5);
    
    // Table header - save Y before drawing box
    const tableHeadY = doc.y;
    addBox(40, tableHeadY, 532, 30, colors.primary);
    
    doc.fillColor('#ffffff')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('Week', 50, tableHeadY + 9)
       .text('Topics Covered', 120, tableHeadY + 9)
       .text('Practice Score', 250, tableHeadY + 9)
       .text('Hours Studied', 350, tableHeadY + 9)
       .text('Notes', 450, tableHeadY + 9);
    
    doc.y = tableHeadY + 35;
    
    // Empty rows for tracking
    for (let week = 1; week <= 4; week++) {
      const rowBoxY = doc.y;
      addBox(40, rowBoxY, 532, 35, '#ffffff', '#e2e8f0');
      
      doc.fillColor(colors.muted)
         .fontSize(10)
         .font('Helvetica')
         .text(`Week ${week}`, 50, rowBoxY + 11)
         .text('_______', 120, rowBoxY + 11)
         .text('_____%', 250, rowBoxY + 11)
         .text('_____', 350, rowBoxY + 11)
         .text('________________', 450, rowBoxY + 11);
      
      doc.y = rowBoxY + 40;
    }
    
    doc.moveDown();
    
    // Success Metrics
    addSubheader('Success Indicators', 14);
    doc.moveDown(0.5);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.dark);
    
    const metrics = [
      'Consistently scoring 75% or higher on practice tests',
      'Completing 500+ practice questions per week',
      'Understanding rationales for all incorrect answers',
      'Feeling confident with priority and delegation questions',
      'Finishing questions within the allocated time'
    ];
    
    metrics.forEach(metric => {
      doc.text(`☐ ${metric}`, 40, doc.y);
    });
    
    // Final motivational section
    doc.moveDown(2);
    const motivBoxY = doc.y;
    addBox(40, motivBoxY, 532, 100, '#dcfce7', colors.success);
    
    doc.fillColor(colors.dark)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('YOU CAN DO THIS!', 40, motivBoxY + 10, { align: 'center' });
    
    doc.fontSize(11)
       .font('Helvetica')
       .text('Every nurse who has passed the NCLEX started exactly where you are now.', 50, motivBoxY + 32, { 
         align: 'center',
         width: 512
       })
       .text('Stay consistent, trust the process, and believe in yourself.', 50, motivBoxY + 52, {
         align: 'center',
         width: 512
       })
       .text('Your dedication today shapes the nurse you\'ll become tomorrow.', 50, motivBoxY + 72, {
         align: 'center',
         width: 512
       });
    
    doc.y = motivBoxY + 110;
    
    // Footer
    doc.fillColor(colors.muted)
       .fontSize(9)
       .text(`© NursePrep Analytics • Generated ${new Date().toLocaleString()} • Total Pages: 6`, 40, 750, { 
         align: 'center' 
       });
    
    doc.end();
  });
}

// Helper functions for generating dynamic content
function generateDailyGoals(criticalGaps: any[]): any[] {
  return criticalGaps.slice(0, 5).map(topic => ({
    topic: topic.topicName,
    time: `${Math.ceil(topic.studyTime / 7)} minutes`,
    objective: `Achieve 70% comprehension in ${topic.subject}`
  }));
}

function generateWeeklyMilestones(groupedByArea: Record<string, any[]>): any[] {
  return Object.entries(groupedByArea).slice(0, 4).map(([area, topics], index) => ({
    week: index + 1,
    focus: area,
    topics: topics.length,
    goal: `Master ${Math.min(5, topics.length)} topics in ${area}`
  }));
}

function generateVideoResources(weaknesses: any[]): any[] {
  const resources: any[] = [];
  const subjects = Array.from(new Set(weaknesses.map(w => w.subject)));
  
  subjects.forEach(subject => {
    resources.push({
      subject,
      channel: 'RegisteredNurseRN',
      videos: `${subject} comprehensive review series`
    });
  });
  
  return resources;
}

function generateReadingResources(topics: any[]): any[] {
  const categories = Array.from(new Set(topics.map(t => t.category)));
  return categories.map(cat => ({
    category: cat,
    chapters: `Review chapters related to ${cat}`,
    pages: 'See textbook index'
  }));
}

function generatePracticeResources(criticalGaps: any[]): any[] {
  return criticalGaps.slice(0, 5).map(topic => ({
    topic: topic.topicName,
    questions: '25-30 questions',
    source: 'NCLEX question bank',
    focusArea: topic.subject
  }));
}