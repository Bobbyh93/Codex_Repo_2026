import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExtractedTopicsListProps {
  reportId: string;
}

export default function ExtractedTopicsList({ reportId }: ExtractedTopicsListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/assessment-reports", reportId, "topic-performance"],
    enabled: !!reportId,
  });

  if (isLoading) {
    return <div className="p-4">Loading extracted topics...</div>;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Extracted Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No topics found in this report.</p>
        </CardContent>
      </Card>
    );
  }

  // Group topics by content area for better organization
  const groupedTopics = data.reduce((acc: Record<string, any[]>, item: any) => {
    const area = item.topic?.contentArea?.name || "Uncategorized";
    if (!acc[area]) {
      acc[area] = [];
    }
    acc[area].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topics Extracted from Your PDF</CardTitle>
        <p className="text-sm text-muted-foreground">
          Found {data.length} topics across {Object.keys(groupedTopics).length} content areas
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedTopics).map(([area, topics]: [string, any[]]) => (
              <div key={area} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm">{area}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {topics.length} topics
                  </Badge>
                </div>
                
                <div className="space-y-2 pl-4">
                  {topics.map((item: any, index: number) => (
                    <div 
                      key={item.id} 
                      className="flex items-start justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {index + 1}.
                          </span>
                          <p className="font-medium text-sm">
                            {item.topic?.name || "Unknown Topic"}
                          </p>
                        </div>
                        
                        {item.topic?.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            {item.topic.description}
                          </p>
                        )}
                        
                        {/* Show additional metadata if available */}
                        <div className="flex gap-2 mt-2 ml-6">
                          {item.topic?.specialty && (
                            <Badge variant="outline" className="text-xs">
                              {item.topic.specialty}
                            </Badge>
                          )}
                          {item.topic?.systemCategory && (
                            <Badge variant="outline" className="text-xs">
                              {item.topic.systemCategory}
                            </Badge>
                          )}
                          {item.score !== undefined && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                item.score >= 80 ? 'bg-green-100 text-green-700' :
                                item.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}
                            >
                              Score: {Number(item.score).toFixed(0)}%
                            </Badge>
                          )}
                          <Badge 
                            className={`text-xs ${
                              item.priority === 1 ? 'bg-red-500' :
                              item.priority === 2 ? 'bg-yellow-500' :
                              'bg-blue-500'
                            } text-white`}
                          >
                            Priority {item.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}