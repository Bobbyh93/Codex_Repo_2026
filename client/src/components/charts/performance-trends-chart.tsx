import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function PerformanceTrendsChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Mock data for demonstration - in real app this would come from props
    const trendData = [65, 68, 72, 75, 79, 83.5];
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score %',
          data: trendData,
          borderColor: 'hsl(188 81% 36%)',
          backgroundColor: 'hsl(188 81% 36% / 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'hsl(188 81% 36%)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 60,
            max: 90,
            grid: {
              color: 'hsl(214.3 31.8% 91.4%)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 8
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return <canvas ref={chartRef} data-testid="performance-trends-chart" />;
}
