import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { Activity, AlertTriangle, TrendingUp, Eye } from "lucide-react";

interface GapAnalysisChartProps {
  data: Array<{
    topic: {
      name: string;
      subject?: string;
      system?: string;
    };
    gapScore: number;
    score?: number;
  }>;
  onTopicClick?: (topicName: string) => void;
  className?: string;
}

export default function GapAnalysisChart({ data, onTopicClick, className = "" }: GapAnalysisChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);

  // Enhanced color mapping based on gap severity
  const getColorByGapScore = (gapScore: number) => {
    if (gapScore >= 40) return {
      background: 'rgba(239, 68, 68, 0.8)',
      border: 'rgb(239, 68, 68)',
      gradient: 'rgba(239, 68, 68, 0.1)'
    };
    if (gapScore >= 25) return {
      background: 'rgba(251, 146, 60, 0.8)',
      border: 'rgb(251, 146, 60)',
      gradient: 'rgba(251, 146, 60, 0.1)'
    };
    if (gapScore >= 15) return {
      background: 'rgba(250, 204, 21, 0.8)',
      border: 'rgb(250, 204, 21)',
      gradient: 'rgba(250, 204, 21, 0.1)'
    };
    return {
      background: 'rgba(34, 197, 94, 0.8)',
      border: 'rgb(34, 197, 94)',
      gradient: 'rgba(34, 197, 94, 0.1)'
    };
  };

  // Enhanced priority assessment
  const getPriorityLevel = (gapScore: number) => {
    if (gapScore >= 40) return { level: "Critical", icon: "🔴" };
    if (gapScore >= 25) return { level: "High", icon: "🟠" };
    if (gapScore >= 15) return { level: "Medium", icon: "🟡" };
    return { level: "Low", icon: "🟢" };
  };

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Prepare enhanced data for chart
    const chartData = data.slice(0, 8).map((item, index) => {
      const colors = getColorByGapScore(item.gapScore);
      const priority = getPriorityLevel(item.gapScore);
      
      return {
        label: item.topic.name.substring(0, 25) + (item.topic.name.length > 25 ? "..." : ""),
        fullLabel: item.topic.name,
        value: Number(item.gapScore),
        currentScore: Number(item.score || 0),
        subject: item.topic.subject || 'General',
        system: item.topic.system || 'Core',
        priority: priority,
        colors: colors,
        index: index
      };
    });

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.map(item => item.label),
        datasets: [{
          label: 'Knowledge Gap (%)',
          data: chartData.map(item => item.value),
          backgroundColor: chartData.map(item => item.colors.background),
          borderColor: chartData.map(item => item.colors.border),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: chartData.map(item => item.colors.border),
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (event, elements) => {
          if (elements.length > 0 && onTopicClick) {
            const elementIndex = elements[0].index;
            const topicName = chartData[elementIndex].fullLabel;
            onTopicClick(topicName);
          }
        },
        onHover: (event, elements) => {
          if (elements.length > 0) {
            const elementIndex = elements[0].index;
            setHoveredTopic(chartData[elementIndex].fullLabel);
            if (chartRef.current) {
              chartRef.current.style.cursor = onTopicClick ? 'pointer' : 'default';
            }
          } else {
            setHoveredTopic(null);
            if (chartRef.current) {
              chartRef.current.style.cursor = 'default';
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: 'rgb(243, 244, 246)',
            bodyColor: 'rgb(209, 213, 219)',
            borderColor: 'rgba(75, 85, 99, 0.5)',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 12
            },
            callbacks: {
              title: function(context) {
                const dataIndex = context[0].dataIndex;
                const item = chartData[dataIndex];
                return `${item.priority.icon} ${item.fullLabel}`;
              },
              beforeBody: function(context) {
                const dataIndex = context[0].dataIndex;
                const item = chartData[dataIndex];
                return [
                  `Subject: ${item.subject}`,
                  `System: ${item.system}`,
                  `Priority: ${item.priority.level}`,
                  ''
                ];
              },
              label: function(context) {
                const dataIndex = context.dataIndex;
                const item = chartData[dataIndex];
                return [
                  `Gap Score: ${item.value}%`,
                  `Current Score: ${item.currentScore}%`,
                  `Target Score: ${Math.max(75, item.currentScore + item.value)}%`
                ];
              },
              afterBody: function(context) {
                const dataIndex = context[0].dataIndex;
                const item = chartData[dataIndex];
                const impact = item.value >= 40 ? "High Impact" : 
                              item.value >= 25 ? "Medium Impact" : "Low Impact";
                return [
                  '',
                  `📊 ${impact} - Focus on this topic for score improvement`,
                  onTopicClick ? '🔗 Click to view study resources' : ''
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(156, 163, 175, 0.2)',
              lineWidth: 1
            },
            border: {
              color: 'rgba(107, 114, 128, 0.3)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              },
              color: 'rgb(107, 114, 128)',
              font: {
                size: 11,
                weight: 500
              }
            },
            title: {
              display: true,
              text: 'Knowledge Gap Percentage',
              color: 'rgb(75, 85, 99)',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            border: {
              color: 'rgba(107, 114, 128, 0.3)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              color: 'rgb(107, 114, 128)',
              font: {
                size: 10,
                weight: 500
              }
            },
            title: {
              display: true,
              text: 'Study Topics (prioritized by gap score)',
              color: 'rgb(75, 85, 99)',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          }
        },
        elements: {
          bar: {
            borderRadius: 8
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutQuart'
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, onTopicClick]);

  if (!data.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <div className="bg-gray-100 rounded-full p-4">
          <Activity className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center space-y-2">
          <p className="font-medium">No gap analysis data available</p>
          <p className="text-sm">Upload an assessment report to see your knowledge gaps</p>
        </div>
      </div>
    );
  }

  const maxGapScore = Math.max(...data.map(item => item.gapScore));
  const avgGapScore = Math.round(data.reduce((sum, item) => sum + item.gapScore, 0) / data.length);
  const criticalTopics = data.filter(item => item.gapScore >= 40).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enhanced Chart Header with Statistics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-blue-900">Knowledge Gap Analysis</h3>
          </div>
          {hoveredTopic && (
            <div className="text-sm text-blue-700 font-medium">
              Hovering: {hoveredTopic}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{criticalTopics}</div>
            <div className="text-gray-600">Critical Topics</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{maxGapScore}%</div>
            <div className="text-gray-600">Highest Gap</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{avgGapScore}%</div>
            <div className="text-gray-600">Average Gap</div>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-600 flex items-center gap-1">
          <Eye className="h-3 w-3" />
          <span>
            {onTopicClick ? 'Click bars to view study resources' : 'Hover over bars for detailed information'}
          </span>
        </div>
      </div>

      {/* Enhanced Chart Container */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="h-80 md:h-96">
          <canvas ref={chartRef} data-testid="gap-analysis-chart" />
        </div>
      </div>

      {/* Priority Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Priority Guide
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span><strong>Critical (40%+)</strong> - Immediate focus needed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span><strong>High (25-39%)</strong> - High priority review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span><strong>Medium (15-24%)</strong> - Moderate focus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span><strong>Low (&lt;15%)</strong> - Maintenance review</span>
          </div>
        </div>
      </div>
    </div>
  );
}
