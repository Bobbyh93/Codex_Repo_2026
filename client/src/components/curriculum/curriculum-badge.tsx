/**
 * Inline curriculum badge component for showing available chapters
 * Displays a small indicator with expandable curriculum content
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurriculumBadgeProps {
  topicName: string;
  topicId?: string;
  className?: string;
}

interface ChapterSummary {
  chapter_id: string;
  chapter_name: string;
  subject: string;
}

export default function CurriculumBadge({ 
  topicName, 
  topicId,
  className 
}: CurriculumBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [searched, setSearched] = useState(false);

  const searchForChapters = async () => {
    if (loading || searched) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/curriculum/search?text=${encodeURIComponent(topicName)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setChapters(data.slice(0, 3)); // Limit to top 3 chapters
      }
    } catch (error) {
      console.error("Failed to fetch curriculum chapters:", error);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  if (!searched && chapters.length === 0) {
    return (
      <Badge 
        variant="secondary"
        className={cn("cursor-pointer", className)}
        onClick={searchForChapters}
      >
        <BookOpen className="h-3 w-3 mr-1" />
        Find Curriculum
      </Badge>
    );
  }

  if (loading) {
    return (
      <Badge variant="secondary" className={className}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Searching...
      </Badge>
    );
  }

  if (chapters.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge 
          variant="default" 
          className={cn("cursor-pointer bg-primary hover:bg-primary/90", className)}
        >
          <BookOpen className="h-3 w-3 mr-1" />
          {chapters.length} {chapters.length === 1 ? 'Chapter' : 'Chapters'}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm mb-2">Related Curriculum</h4>
          {chapters.map((chapter) => (
            <div
              key={chapter.chapter_id}
              className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
              onClick={() => window.open(`/curriculum/chapter/${chapter.chapter_id}`, '_blank')}
            >
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-1">
                  {chapter.chapter_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {chapter.subject}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={() => window.open(`/curriculum/search?topic=${encodeURIComponent(topicName)}`, '_blank')}
          >
            View All Curriculum
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}