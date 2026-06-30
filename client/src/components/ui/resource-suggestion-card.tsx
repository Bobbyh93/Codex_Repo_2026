import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BookOpen,
  Video,
  FileQuestion,
  FileText,
  Brain,
  Monitor,
  Clock,
  ExternalLink,
  Plus,
  Check,
  Info,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface ResourceSuggestion {
  id?: string;
  title: string;
  type: 'video' | 'article' | 'practice' | 'textbook' | 'quiz' | 'simulation';
  description: string;
  url?: string;
  duration?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  provider?: string;
  confidence: number;
  keywords: string[];
}

interface ResourceSuggestionCardProps {
  suggestions: ResourceSuggestion[];
  isLoading?: boolean;
  error?: string;
  onAccept: (suggestion: ResourceSuggestion) => void;
  onReject?: (suggestion: ResourceSuggestion) => void;
  onRefresh?: () => void;
  acceptedIds?: Set<string>;
}

const resourceTypeIcons = {
  video: Video,
  article: FileText,
  practice: FileQuestion,
  textbook: BookOpen,
  quiz: Brain,
  simulation: Monitor,
};

const difficultyColors = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function ResourceSuggestionCard({
  suggestions,
  isLoading,
  error,
  onAccept,
  onReject,
  onRefresh,
  acceptedIds = new Set()
}: ResourceSuggestionCardProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };

  const getSuggestionId = (suggestion: ResourceSuggestion, index: number): string => {
    return suggestion.id || `suggestion-${index}-${suggestion.title}`;
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          {onRefresh && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={onRefresh} 
              className="ml-2"
              data-testid="button-retry"
            >
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse" />
            Generating AI Suggestions...
          </CardTitle>
          <CardDescription>
            AI is analyzing the topic and generating relevant resource suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Resource Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Click "AI Suggest Resources" after selecting a topic to get intelligent resource recommendations
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Resource Suggestions
          </span>
          {onRefresh && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRefresh}
              data-testid="button-refresh-suggestions"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Review and accept AI-generated resource suggestions for this topic
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => {
            const Icon = resourceTypeIcons[suggestion.type];
            const isExpanded = expandedCards.has(index);
            const suggestionId = getSuggestionId(suggestion, index);
            const isAccepted = acceptedIds.has(suggestionId);
            
            return (
              <div
                key={suggestionId}
                className={`border rounded-lg p-4 transition-all ${
                  isAccepted ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''
                }`}
                data-testid={`suggestion-card-${index}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm" data-testid={`text-title-${index}`}>
                          {suggestion.title}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {suggestion.type}
                          </Badge>
                          <Badge className={`text-xs ${difficultyColors[suggestion.difficulty]}`}>
                            {suggestion.difficulty}
                          </Badge>
                          {suggestion.duration && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {suggestion.duration} min
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Progress 
                              value={suggestion.confidence * 100} 
                              className="w-12 h-2 mr-1"
                            />
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-description-${index}`}>
                      {isExpanded ? suggestion.description : suggestion.description.slice(0, 150) + '...'}
                    </p>
                    
                    {isExpanded && (
                      <div className="space-y-2 pt-2">
                        {suggestion.provider && (
                          <p className="text-xs text-gray-500">
                            <strong>Provider:</strong> {suggestion.provider}
                          </p>
                        )}
                        {suggestion.url && (
                          <div className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3 text-gray-500" />
                            <a 
                              href={suggestion.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                              data-testid={`link-url-${index}`}
                            >
                              {suggestion.url}
                            </a>
                          </div>
                        )}
                        {suggestion.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {suggestion.keywords.map((keyword, kidx) => (
                              <Badge key={kidx} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={isAccepted ? "secondary" : "default"}
                        onClick={() => onAccept(suggestion)}
                        disabled={isAccepted}
                        data-testid={`button-accept-${index}`}
                      >
                        {isAccepted ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Accepted
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                      {onReject && !isAccepted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReject(suggestion)}
                          data-testid={`button-reject-${index}`}
                        >
                          Reject
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(index)}
                        data-testid={`button-toggle-${index}`}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {suggestions.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              AI suggestions are based on best practices in nursing education. Always review before accepting.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}