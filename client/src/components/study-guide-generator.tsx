import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font, Image } from '@react-pdf/renderer';

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff', fontWeight: 700 }
  ]
});

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
  },
  coverPage: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 10,
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 400,
    marginBottom: 30,
    color: '#64748b',
    textAlign: 'center',
  },
  sectionPage: {
    padding: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
    color: '#1e293b',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 10,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 20,
    marginBottom: 10,
    color: '#334155',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#475569',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 600,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginVertical: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  phaseCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  phaseTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
  },
  phaseDate: {
    fontSize: 10,
    color: '#64748b',
  },
  topicItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  bullet: {
    fontSize: 10,
    marginRight: 8,
    color: '#3b82f6',
  },
  resourceBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  resourceTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1e40af',
    marginBottom: 5,
  },
  resourceText: {
    fontSize: 10,
    color: '#3730a3',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    marginRight: '2%',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  weekSchedule: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 20,
  },
  dayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 10,
  },
  dayLabel: {
    width: '20%',
    fontSize: 11,
    fontWeight: 600,
    color: '#334155',
  },
  dayContent: {
    width: '80%',
    fontSize: 10,
    color: '#475569',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  highlightBox: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 15,
    marginVertical: 15,
  },
  highlightText: {
    fontSize: 11,
    color: '#92400e',
  },
  checklistItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 2,
    marginRight: 8,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 30,
    paddingHorizontal: 20,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressCircleActive: {
    backgroundColor: '#3b82f6',
  },
  progressCircleComplete: {
    backgroundColor: '#10b981',
  },
  progressStepText: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
  progressLine: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: '#e2e8f0',
    zIndex: -1,
  }
});

interface StudyGuideData {
  assessmentDate: string;
  overallScore: number;
  weakAreas: Array<{
    topic: string;
    score: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  studyPhases: Array<{
    phase: string;
    weeks: string;
    topics: string[];
    resources: Array<{
      title: string;
      type: string;
      url?: string;
    }>;
  }>;
  weeklyPlan: Array<{
    day: string;
    morning: string;
    afternoon: string;
    evening: string;
  }>;
  estimatedHours: number;
  targetDate: string;
}

// Study Guide PDF Document Component
const StudyGuideDocument: React.FC<{ data: StudyGuideData }> = ({ data }) => (
  <Document>
    {/* Cover Page */}
    <Page size="A4" style={styles.page}>
      <View style={styles.coverPage}>
        <Text style={styles.title}>Your Personalized{'\n'}Study Roadmap</Text>
        <Text style={styles.subtitle}>NursePrep Analytics</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.overallScore}%</Text>
            <Text style={styles.statLabel}>Current Performance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.estimatedHours}h</Text>
            <Text style={styles.statLabel}>Study Time Needed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.weakAreas.filter(a => a.priority === 'high').length}</Text>
            <Text style={styles.statLabel}>Priority Topics</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.targetDate}</Text>
            <Text style={styles.statLabel}>Target Date</Text>
          </View>
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            This personalized guide is based on your assessment from {data.assessmentDate}
          </Text>
        </View>
      </View>
    </Page>

    {/* Progress Overview Page */}
    <Page size="A4" style={styles.page}>
      <View style={styles.sectionPage}>
        <Text style={styles.sectionTitle}>Your Learning Journey</Text>
        
        <View style={styles.progressIndicator}>
          <View style={styles.progressStep}>
            <View style={[styles.progressCircle, styles.progressCircleActive]}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>1</Text>
            </View>
            <Text style={styles.progressStepText}>Foundation</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={styles.progressCircle}>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>2</Text>
            </View>
            <Text style={styles.progressStepText}>Reinforcement</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={styles.progressCircle}>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>3</Text>
            </View>
            <Text style={styles.progressStepText}>Mastery</Text>
          </View>
          <View style={styles.progressStep}>
            <View style={styles.progressCircle}>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>4</Text>
            </View>
            <Text style={styles.progressStepText}>NCLEX Ready</Text>
          </View>
        </View>

        <Text style={styles.subsectionTitle}>Priority Areas for Improvement</Text>
        
        {data.weakAreas.map((area, index) => (
          <View key={index} style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <Text style={styles.phaseTitle}>{area.topic}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.phaseDate}>Current Score: {area.score}%</Text>
                <View style={{
                  marginLeft: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: area.priority === 'high' ? '#fca5a5' : 
                                area.priority === 'medium' ? '#fcd34d' : '#86efac',
                  borderRadius: 4
                }}>
                  <Text style={{ fontSize: 9, color: '#1e293b' }}>
                    {area.priority.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${area.score}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </Page>

    {/* Study Phases Pages */}
    {data.studyPhases.map((phase, phaseIndex) => (
      <Page key={phaseIndex} size="A4" style={styles.page}>
        <View style={styles.sectionPage}>
          <Text style={styles.sectionTitle}>{phase.phase}</Text>
          <Text style={styles.text}>{phase.weeks}</Text>

          <Text style={styles.subsectionTitle}>Focus Topics</Text>
          {phase.topics.map((topic, index) => (
            <View key={index} style={styles.topicItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>{topic}</Text>
            </View>
          ))}

          <Text style={styles.subsectionTitle}>Recommended Resources</Text>
          {phase.resources.map((resource, index) => (
            <View key={index} style={styles.resourceBox}>
              <Text style={styles.resourceTitle}>{resource.title}</Text>
              <Text style={styles.resourceText}>Type: {resource.type}</Text>
              {resource.url && (
                <Text style={styles.resourceText}>Access: {resource.url}</Text>
              )}
            </View>
          ))}

          <Text style={styles.subsectionTitle}>Success Checklist</Text>
          <View style={styles.phaseCard}>
            <View style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.text}>Complete all assigned readings</Text>
            </View>
            <View style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.text}>Practice 50+ questions per topic</Text>
            </View>
            <View style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.text}>Review incorrect answers thoroughly</Text>
            </View>
            <View style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.text}>Achieve 70%+ on practice tests</Text>
            </View>
          </View>
        </View>
      </Page>
    ))}

    {/* Weekly Schedule Page */}
    <Page size="A4" style={styles.page}>
      <View style={styles.sectionPage}>
        <Text style={styles.sectionTitle}>Week 1 Study Schedule</Text>
        
        <View style={styles.weekSchedule}>
          {data.weeklyPlan.map((day, index) => (
            <View key={index} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{day.day}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayContent}>Morning: {day.morning}</Text>
                <Text style={styles.dayContent}>Afternoon: {day.afternoon}</Text>
                <Text style={styles.dayContent}>Evening: {day.evening}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            Tips for Success:
          </Text>
          <Text style={[styles.highlightText, { marginTop: 10 }]}>
            • Study in 45-minute focused sessions with 15-minute breaks
          </Text>
          <Text style={styles.highlightText}>
            • Review previous day's material before starting new topics
          </Text>
          <Text style={styles.highlightText}>
            • Use active recall and spaced repetition techniques
          </Text>
          <Text style={styles.highlightText}>
            • Join study groups for difficult topics
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated on {new Date().toLocaleDateString()}</Text>
          <Text style={styles.footerText}>NursePrep Analytics</Text>
        </View>
      </View>
    </Page>
  </Document>
);

export default StudyGuideDocument;