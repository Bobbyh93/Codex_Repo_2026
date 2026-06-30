interface StudySession {
  userId: string;
  date: string;
  topic: string;
  subtopic?: string;
  minutesStudied: number;
  resourcesCompleted: string[];
  startScore?: number;
  endScore?: number;
  notes?: string;
}

interface DailyActivity {
  date: string;
  sessions: StudySession[];
  totalMinutes: number;
  uniqueTopics: string[];
  resourceCount: number;
  avgImprovement: number;
}

// Track study sessions
export async function recordStudySession(session: StudySession): Promise<void> {
  // In production, save to database
  console.log('Recording study session:', session);
  
  // Calculate intensity based on time studied
  const intensity = Math.min(4, Math.floor(session.minutesStudied / 30));
  
  // Store in database (using in-memory for MVP)
  const sessions = getStoredSessions();
  sessions.push({
    ...session,
    timestamp: new Date().toISOString(),
    intensity
  });
  
  // In production: await db.insert(studySessions).values(session);
}

// Get study activity for heatmap
export async function getStudyActivity(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DailyActivity[]> {
  // In production, query from database
  const sessions = getStoredSessions().filter(
    s => s.userId === userId && 
    new Date(s.date) >= startDate && 
    new Date(s.date) <= endDate
  );
  
  // Group by date
  const activityByDate = new Map<string, StudySession[]>();
  sessions.forEach(session => {
    const dateKey = session.date.split('T')[0];
    const existing = activityByDate.get(dateKey) || [];
    activityByDate.set(dateKey, [...existing, session]);
  });
  
  // Calculate daily summaries
  const dailyActivities: DailyActivity[] = [];
  activityByDate.forEach((sessions, date) => {
    const totalMinutes = sessions.reduce((sum, s) => sum + s.minutesStudied, 0);
    const uniqueTopics = [...new Set(sessions.map(s => s.topic))];
    const resourceCount = sessions.reduce((sum, s) => sum + s.resourcesCompleted.length, 0);
    
    // Calculate average improvement
    const improvements = sessions
      .filter(s => s.startScore !== undefined && s.endScore !== undefined)
      .map(s => (s.endScore! - s.startScore!));
    
    const avgImprovement = improvements.length > 0
      ? improvements.reduce((sum, i) => sum + i, 0) / improvements.length
      : 0;
    
    dailyActivities.push({
      date,
      sessions,
      totalMinutes,
      uniqueTopics,
      resourceCount,
      avgImprovement
    });
  });
  
  return dailyActivities.sort((a, b) => b.date.localeCompare(a.date));
}

// Calculate study streaks
export function calculateStreak(activities: DailyActivity[]): number {
  if (activities.length === 0) return 0;
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Sort activities by date descending
  const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
  
  for (let i = 0; i < sorted.length; i++) {
    const activityDate = new Date(sorted[i].date);
    activityDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    
    if (activityDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else if (i > 0) {
      // Streak broken
      break;
    }
  }
  
  return streak;
}

// Get study statistics
export async function getStudyStats(userId: string): Promise<{
  totalHours: number;
  totalSessions: number;
  favoriteTopics: string[];
  currentStreak: number;
  longestStreak: number;
  avgSessionLength: number;
  totalResources: number;
  avgImprovement: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const activities = await getStudyActivity(userId, thirtyDaysAgo, new Date());
  
  // Calculate statistics
  const allSessions = activities.flatMap(a => a.sessions);
  const totalMinutes = allSessions.reduce((sum, s) => sum + s.minutesStudied, 0);
  const totalHours = Math.round(totalMinutes / 60);
  
  // Topic frequency
  const topicCounts = new Map<string, number>();
  allSessions.forEach(s => {
    topicCounts.set(s.topic, (topicCounts.get(s.topic) || 0) + 1);
  });
  
  const favoriteTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);
  
  const currentStreak = calculateStreak(activities);
  
  // Calculate average improvement
  const improvements = allSessions
    .filter(s => s.startScore !== undefined && s.endScore !== undefined)
    .map(s => (s.endScore! - s.startScore!));
  
  const avgImprovement = improvements.length > 0
    ? improvements.reduce((sum, i) => sum + i, 0) / improvements.length
    : 0;
  
  return {
    totalHours,
    totalSessions: allSessions.length,
    favoriteTopics,
    currentStreak,
    longestStreak: currentStreak, // Would need historical data for true longest
    avgSessionLength: allSessions.length > 0 ? totalMinutes / allSessions.length : 0,
    totalResources: allSessions.reduce((sum, s) => sum + s.resourcesCompleted.length, 0),
    avgImprovement: Math.round(avgImprovement * 10) / 10
  };
}

// In-memory storage for MVP (replace with database in production)
let storedSessions: any[] = [];

function getStoredSessions() {
  return storedSessions;
}

// Generate sample data for demonstration
export function generateSampleActivity(): DailyActivity[] {
  const activities: DailyActivity[] = [];
  const topics = ["Pharmacology", "Cardiac Nursing", "Respiratory Care", "Fluid & Electrolytes", "Mental Health"];
  const today = new Date();
  
  // Generate data for last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // 70% chance of activity
    if (Math.random() < 0.7) {
      const numSessions = Math.floor(Math.random() * 3) + 1;
      const sessions: StudySession[] = [];
      
      for (let j = 0; j < numSessions; j++) {
        sessions.push({
          userId: "demo-user",
          date: dateStr,
          topic: topics[Math.floor(Math.random() * topics.length)],
          minutesStudied: Math.floor(Math.random() * 60) + 15,
          resourcesCompleted: [`resource-${i}-${j}`],
          startScore: 60 + Math.floor(Math.random() * 20),
          endScore: 70 + Math.floor(Math.random() * 20)
        });
      }
      
      activities.push({
        date: dateStr,
        sessions,
        totalMinutes: sessions.reduce((sum, s) => sum + s.minutesStudied, 0),
        uniqueTopics: [...new Set(sessions.map(s => s.topic))],
        resourceCount: sessions.length,
        avgImprovement: 8 + Math.random() * 7
      });
    }
  }
  
  return activities;
}