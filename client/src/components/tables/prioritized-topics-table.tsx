import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExternalLink } from "lucide-react";

interface TopicPerformanceData {
  id: string;
  priority: number;
  gapScore: number;
  score: number;
  recommendedStudyTime: number;
  topic: {
    name: string;
    description: string;
    contentArea: {
      name: string;
    };
  };
}

interface PrioritizedTopicsTableProps {
  data: TopicPerformanceData[];
}

export default function PrioritizedTopicsTable({ data }: PrioritizedTopicsTableProps) {
  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-destructive text-destructive-foreground";
    if (priority === 2) return "bg-chart-4 text-primary-foreground";
    if (priority === 3) return "bg-chart-3 text-foreground";
    return "bg-chart-2 text-primary-foreground";
  };

  const getFrequencyLevel = (gapScore: number) => {
    if (gapScore > 70) return "High";
    if (gapScore > 50) return "Medium";
    return "Low";
  };

  const getContentAreaColor = (contentAreaName: string) => {
    const colors = {
      "Management of Care": "bg-chart-1/20 text-chart-1",
      "Safety and Infection Control": "bg-chart-2/20 text-chart-2",
      "Basic Care and Comfort": "bg-chart-4/20 text-chart-4",
      "Psychosocial Integrity": "bg-chart-1/20 text-chart-1",
      "Pharmacological and Parenteral Therapies": "bg-chart-3/20 text-chart-3",
      "Reduction of Risk Potential": "bg-chart-2/20 text-chart-2",
      "Physiological Adaptation": "bg-chart-5/20 text-chart-5",
      "Health Promotion and Maintenance": "bg-chart-3/20 text-chart-3"
    };
    return colors[contentAreaName as keyof typeof colors] || "bg-muted/20 text-muted-foreground";
  };

  if (!data.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No topic performance data available</p>
        <p className="text-sm mt-2">Upload an assessment report to see prioritized topics for review</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Priority</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Topic</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Content Area</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gap Score</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Frequency</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Study Time</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Resources</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((topic) => (
            <tr key={topic.id} className="hover:bg-accent/50" data-testid={`topic-row-${topic.id}`}>
              <td className="p-4">
                <span 
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${getPriorityColor(topic.priority)}`}
                  data-testid={`priority-badge-${topic.priority}`}
                >
                  {topic.priority}
                </span>
              </td>
              <td className="p-4">
                <div className="font-medium text-foreground" data-testid={`topic-name-${topic.id}`}>
                  {topic.topic.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {topic.topic.description || "Assessment topic for review"}
                </div>
              </td>
              <td className="p-4">
                <Badge 
                  variant="secondary" 
                  className={`${getContentAreaColor(topic.topic.contentArea.name)} border-0`}
                  data-testid={`content-area-${topic.id}`}
                >
                  {topic.topic.contentArea.name}
                </Badge>
              </td>
              <td className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <Progress 
                      value={Number(topic.gapScore)} 
                      className="h-2"
                      data-testid={`gap-progress-${topic.id}`}
                    />
                  </div>
                  <span 
                    className={`text-sm font-medium ${
                      Number(topic.gapScore) > 70 ? 'text-destructive' :
                      Number(topic.gapScore) > 50 ? 'text-chart-4' : 'text-chart-2'
                    }`}
                    data-testid={`gap-score-${topic.id}`}
                  >
                    {Number(topic.gapScore).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="p-4 text-sm" data-testid={`frequency-${topic.id}`}>
                {getFrequencyLevel(Number(topic.gapScore))}
              </td>
              <td className="p-4 text-sm font-medium" data-testid={`study-time-${topic.id}`}>
                {topic.recommendedStudyTime} min
              </td>
              <td className="p-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary hover:text-primary/80"
                  data-testid={`view-resources-${topic.id}`}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="px-6 py-4 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" data-testid="table-summary">
            Showing {data.length} prioritized topics
          </p>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" data-testid="button-previous-page">
              Previous
            </Button>
            <Button variant="outline" size="sm" data-testid="button-next-page">
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
