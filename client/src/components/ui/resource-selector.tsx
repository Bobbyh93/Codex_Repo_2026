import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, BookOpen, Video, FileText, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Resource {
  id: string;
  title: string;
  type: 'video' | 'article' | 'textbook' | 'website';
  url?: string;
  description?: string;
  topics: string[];
  systems: string[];
}

interface ResourceSelectorProps {
  selectedResources: string[];
  onResourcesChange: (resources: string[]) => void;
  topicFilter?: string;
  systemFilter?: string;
  placeholder?: string;
}

const ResourceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'video': return <Video className="h-4 w-4" />;
    case 'article': return <FileText className="h-4 w-4" />;
    case 'textbook': return <BookOpen className="h-4 w-4" />;
    default: return <Link className="h-4 w-4" />;
  }
};

export function ResourceSelector({
  selectedResources,
  onResourcesChange,
  topicFilter,
  systemFilter,
  placeholder = "Select resources..."
}: ResourceSelectorProps) {
  const [open, setOpen] = useState(false);
  
  // Fetch resources from database
  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['/api/admin/resources', topicFilter, systemFilter],
  });

  const selectedItems = resources.filter(r => selectedResources.includes(r.id));

  const handleSelect = (resourceId: string) => {
    const newSelection = selectedResources.includes(resourceId)
      ? selectedResources.filter(id => id !== resourceId)
      : [...selectedResources, resourceId];
    onResourcesChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedResources.length === resources.length) {
      onResourcesChange([]);
    } else {
      onResourcesChange(resources.map(r => r.id));
    }
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid="button-resource-selector"
          >
            <span className="truncate">
              {selectedItems.length > 0
                ? `${selectedItems.length} resources selected`
                : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search resources..." />
            <CommandList>
              <CommandEmpty>No resources found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={handleSelectAll}
                  className="font-medium"
                  data-testid="option-select-all"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedResources.length === resources.length ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Select All
                </CommandItem>
                {resources.map((resource) => (
                  <CommandItem
                    key={resource.id}
                    onSelect={() => handleSelect(resource.id)}
                    className="flex items-start gap-2 py-2"
                    data-testid={`option-resource-${resource.id}`}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        selectedResources.includes(resource.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ResourceIcon type={resource.type} />
                        <span className="font-medium">{resource.title}</span>
                      </div>
                      {resource.description && (
                        <p className="text-xs text-gray-600 mt-1">{resource.description}</p>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {resource.topics.slice(0, 2).map((topic) => (
                          <Badge key={topic} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {resource.topics.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{resource.topics.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Resources Display */}
      {selectedItems.length > 0 && (
        <Card className="p-3 bg-gray-50">
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {selectedItems.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between p-2 bg-white rounded-md"
                  data-testid={`selected-resource-${resource.id}`}
                >
                  <div className="flex items-center gap-2">
                    <ResourceIcon type={resource.type} />
                    <span className="text-sm">{resource.title}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSelect(resource.id)}
                    className="h-6 w-6 p-0"
                    data-testid={`remove-resource-${resource.id}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}