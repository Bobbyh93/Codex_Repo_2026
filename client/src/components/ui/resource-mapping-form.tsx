import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Sparkles, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const resourceMappingSchema = z.object({
  topicId: z.string().min(1, "Topic is required"),
  resourceTitle: z.string().min(3, "Title must be at least 3 characters"),
  resourceType: z.enum(['video', 'article', 'practice', 'textbook', 'quiz', 'simulation']),
  description: z.string().min(10, "Description must be at least 10 characters"),
  url: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute").max(600, "Duration cannot exceed 600 minutes"),
  tags: z.string(),
  notes: z.string().optional(),
});

type ResourceMappingFormData = z.infer<typeof resourceMappingSchema>;

interface ResourceMappingFormProps {
  topics: Array<{ id: string; name: string }>;
  onSubmit: (data: ResourceMappingFormData) => Promise<void>;
  onAiSuggest?: (topicId: string, difficulty: string) => void;
  defaultValues?: Partial<ResourceMappingFormData>;
  isEditing?: boolean;
}

export function ResourceMappingForm({
  topics,
  onSubmit,
  onAiSuggest,
  defaultValues,
  isEditing = false
}: ResourceMappingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ResourceMappingFormData>({
    resolver: zodResolver(resourceMappingSchema),
    defaultValues: {
      topicId: '',
      resourceTitle: '',
      resourceType: 'article',
      description: '',
      url: '',
      difficulty: 'intermediate',
      duration: 30,
      tags: '',
      notes: '',
      ...defaultValues
    }
  });
  
  // Auto-save draft to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!isEditing) {
        localStorage.setItem('resourceMappingDraft', JSON.stringify(value));
        setIsDraft(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isEditing]);
  
  // Load draft on mount
  useEffect(() => {
    if (!isEditing && !defaultValues) {
      const draft = localStorage.getItem('resourceMappingDraft');
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          form.reset(parsedDraft);
          setIsDraft(true);
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    }
  }, [form, isEditing, defaultValues]);
  
  const handleSubmit = async (data: ResourceMappingFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      localStorage.removeItem('resourceMappingDraft');
      setIsDraft(false);
      toast({
        title: "Success",
        description: isEditing ? "Resource mapping updated successfully" : "Resource mapping created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save resource mapping. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAiSuggest = () => {
    const topicId = form.getValues('topicId');
    const difficulty = form.getValues('difficulty');
    if (topicId && onAiSuggest) {
      onAiSuggest(topicId, difficulty);
    } else {
      toast({
        title: "Select a topic first",
        description: "Please select a topic before requesting AI suggestions",
        variant: "destructive",
      });
    }
  };
  
  const clearDraft = () => {
    localStorage.removeItem('resourceMappingDraft');
    setIsDraft(false);
    form.reset();
    toast({
      title: "Draft cleared",
      description: "The draft has been cleared successfully",
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {isEditing ? 'Edit Resource Mapping' : 'Create Resource Mapping'}
          {isDraft && !isEditing && (
            <Badge variant="secondary" className="ml-2">
              Draft saved
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Map learning resources to nursing topics for student study plans
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="topicId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-topic">
                          <SelectValue placeholder="Select a topic" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {topics.map((topic) => (
                          <SelectItem key={topic.id} value={topic.id} data-testid={`option-topic-${topic.id}`}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="resourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-resource-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="video" data-testid="option-type-video">Video</SelectItem>
                        <SelectItem value="article" data-testid="option-type-article">Article</SelectItem>
                        <SelectItem value="practice" data-testid="option-type-practice">Practice Questions</SelectItem>
                        <SelectItem value="textbook" data-testid="option-type-textbook">Textbook</SelectItem>
                        <SelectItem value="quiz" data-testid="option-type-quiz">Quiz</SelectItem>
                        <SelectItem value="simulation" data-testid="option-type-simulation">Simulation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="resourceTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter resource title" data-testid="input-resource-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Describe what this resource covers and how it helps students"
                      className="min-h-[100px]"
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource URL (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="url" 
                      placeholder="https://example.com/resource"
                      data-testid="input-url"
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty for offline resources or textbook references
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-difficulty">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="beginner" data-testid="option-difficulty-beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate" data-testid="option-difficulty-intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced" data-testid="option-difficulty-advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1" 
                        max="600"
                        data-testid="input-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags/Keywords</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter tags separated by commas (e.g., medication, safety, pediatric)"
                      data-testid="input-tags"
                    />
                  </FormControl>
                  <FormDescription>
                    Add keywords to help with resource discovery
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Internal notes about this resource mapping"
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Mapping' : 'Create Mapping')}
              </Button>
              
              {onAiSuggest && !isEditing && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAiSuggest}
                  disabled={!form.watch('topicId')}
                  data-testid="button-ai-suggest"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Suggest Resources
                </Button>
              )}
              
              {isDraft && !isEditing && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={clearDraft}
                  data-testid="button-clear-draft"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Draft
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}