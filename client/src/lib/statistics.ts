// Statistical analysis utilities for nursing education data

export interface TopicStatistics {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  percentile25: number;
  percentile75: number;
}

export interface GapAnalysisResult {
  topicId: string;
  gapScore: number;
  priority: number;
  regressionCoefficient: number;
  confidenceInterval: [number, number];
}

export interface RegressionAnalysis {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
}

// Calculate basic statistics for a dataset
export function calculateStatistics(data: number[]): TopicStatistics {
  if (data.length === 0) {
    throw new Error("Cannot calculate statistics for empty dataset");
  }

  const sorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  
  const mean = data.reduce((sum, value) => sum + value, 0) / n;
  
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);

  const percentile25 = sorted[Math.floor(n * 0.25)];
  const percentile75 = sorted[Math.floor(n * 0.75)];

  return {
    mean,
    median,
    standardDeviation,
    variance,
    percentile25,
    percentile75
  };
}

// Perform linear regression analysis
export function linearRegression(xValues: number[], yValues: number[]): RegressionAnalysis {
  if (xValues.length !== yValues.length || xValues.length === 0) {
    throw new Error("X and Y arrays must have the same non-zero length");
  }

  const n = xValues.length;
  const sumX = xValues.reduce((sum, x) => sum + x, 0);
  const sumY = yValues.reduce((sum, y) => sum + y, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const residualSumSquares = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  
  const rSquared = 1 - (residualSumSquares / totalSumSquares);

  // Calculate standard error
  const standardError = Math.sqrt(residualSumSquares / (n - 2));

  return {
    slope,
    intercept,
    rSquared,
    standardError
  };
}

// Calculate comprehension gap scores for topics
export function calculateGapScores(
  topicScores: Array<{ topicId: string; score: number; frequency: number }>,
  nationalAverages: Array<{ topicId: string; average: number }>
): GapAnalysisResult[] {
  const results: GapAnalysisResult[] = [];

  topicScores.forEach((topic, index) => {
    const nationalAverage = nationalAverages.find(avg => avg.topicId === topic.topicId);
    
    if (nationalAverage) {
      // Calculate gap score (how far below national average)
      const gapScore = Math.max(0, nationalAverage.average - topic.score);
      
      // Weight by frequency of appearance in assessments
      const weightedGap = gapScore * (1 + topic.frequency * 0.1);
      
      // Simple regression coefficient based on position and performance
      const regressionCoefficient = weightedGap / nationalAverage.average;
      
      // Basic confidence interval (±5% for demonstration)
      const confidenceInterval: [number, number] = [
        Math.max(0, weightedGap - 5),
        Math.min(100, weightedGap + 5)
      ];

      results.push({
        topicId: topic.topicId,
        gapScore: weightedGap,
        priority: index + 1,
        regressionCoefficient,
        confidenceInterval
      });
    }
  });

  // Sort by gap score (highest gaps = highest priority)
  return results
    .sort((a, b) => b.gapScore - a.gapScore)
    .map((result, index) => ({ ...result, priority: index + 1 }));
}

// Calculate recommended study time based on gap analysis
export function calculateStudyTime(gapScore: number, difficulty: number = 1): number {
  // Base time: 60-180 minutes depending on gap score
  const baseTime = Math.round(60 + (gapScore / 100) * 120);
  
  // Adjust for topic difficulty (1 = easy, 2 = medium, 3 = hard)
  const adjustedTime = baseTime * difficulty;
  
  // Round to nearest 5 minutes
  return Math.round(adjustedTime / 5) * 5;
}

// Generate performance trends over time
export function generatePerformanceTrends(
  historicalScores: Array<{ date: string; score: number }>
): Array<{ period: string; score: number; trend: 'up' | 'down' | 'stable' }> {
  if (historicalScores.length === 0) {
    return [];
  }

  const sorted = historicalScores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trends = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = i > 0 ? sorted[i - 1] : null;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    
    if (previous) {
      const difference = current.score - previous.score;
      if (difference > 2) trend = 'up';
      else if (difference < -2) trend = 'down';
    }

    trends.push({
      period: formatPeriod(current.date, i),
      score: current.score,
      trend
    });
  }

  return trends;
}

function formatPeriod(date: string, index: number): string {
  // Simple week numbering for demo
  return `Week ${index + 1}`;
}

// Calculate priority matrix for study planning
export function calculatePriorityMatrix(
  topics: Array<{
    gapScore: number;
    frequency: number;
    difficulty: number;
    timeToMastery: number;
  }>
): Array<{ index: number; priorityScore: number; category: 'high' | 'medium' | 'low' }> {
  return topics.map((topic, index) => {
    // Priority score combines gap, frequency, and urgency (inverse of time to mastery)
    const urgency = 1 / (topic.timeToMastery / 60); // Convert minutes to hours for urgency
    const priorityScore = (topic.gapScore * 0.4) + (topic.frequency * 0.3) + (urgency * 0.3);
    
    let category: 'high' | 'medium' | 'low' = 'low';
    if (priorityScore > 70) category = 'high';
    else if (priorityScore > 40) category = 'medium';

    return {
      index,
      priorityScore,
      category
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
