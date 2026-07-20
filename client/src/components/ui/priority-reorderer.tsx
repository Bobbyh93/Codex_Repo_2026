import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GripVertical, AlertTriangle, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Topic {
  id: string;
  name: string;
  score: number;
  priority: 'High' | 'Medium' | 'Low';
  system?: string;
  gap?: number;
}

interface PriorityReordererProps {
  topics: Topic[];
  onReorder: (topics: Topic[]) => void;
  showScores?: boolean;
  maxItems?: number;
}

function SortableItem({ id, children, index }: { id: string; children: React.ReactNode; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50"
      )}
      data-testid={`sortable-item-${index}`}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move p-1 hover:bg-gray-100 rounded"
          data-testid={`drag-handle-${index}`}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function PriorityReorderer({
  topics,
  onReorder,
  showScores = true,
  maxItems = 10
}: PriorityReordererProps) {
  const [items, setItems] = useState(topics.slice(0, maxItems));
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(topics.slice(0, maxItems));
  }, [topics, maxItems]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        onReorder(newOrder);
        return newOrder;
      });
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < items.length) {
      const newOrder = arrayMove(items, index, newIndex);
      setItems(newOrder);
      onReorder(newOrder);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 50) return 'text-red-600';
    if (score < 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Priority Order</Label>
        <span className="text-xs text-gray-500">Drag to reorder</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((topic, index) => (
              <SortableItem key={topic.id} id={topic.id} index={index}>
                <Card className="flex-1">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-sm">{topic.name}</p>
                          {topic.system && (
                            <Badge variant="outline" className="text-xs">
                              {topic.system}
                            </Badge>
                          )}
                        </div>
                        
                        {showScores && (
                          <div className="flex items-center gap-3 mt-1">
                            <span className={cn(
                              "text-xs font-medium",
                              getScoreColor(topic.score)
                            )}>
                              Score: {topic.score}%
                            </span>
                            {topic.gap && topic.gap > 20 && (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                                <span className="text-xs text-gray-600">
                                  Gap: {topic.gap}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", getPriorityColor(topic.priority))}>
                          {topic.priority}
                        </Badge>
                        
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            data-testid={`move-up-${index}`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            data-testid={`move-down-${index}`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-blue-900">Priority Ordering</p>
            <p className="text-xs text-blue-700 mt-1">
              Drag topics to reorder their priority. Topics at the top will receive more focus in the study plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}