import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/lib/admin-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Brain, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const generateSchema = z.object({
  contentType: z.enum(["study_guide", "summary", "practice_questions", "concept_explanation", "case_study"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  length: z.enum(["short", "medium", "comprehensive"]),
  includeExamples: z.boolean().default(true),
  includePracticeQuestions: z.boolean().default(false),
  includeVisualAids: z.boolean().default(false),
  customInstructions: z.string().optional(),
});

interface GenerateContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  onSuccess?: () => void;
}

export function GenerateContentModal({
  open,
  onOpenChange,
  topicId,
  topicName,
  onSuccess,
}: GenerateContentModalProps) {
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  const form = useForm<z.infer<typeof generateSchema>>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      contentType: "study_guide",
      difficulty: "intermediate",
      length: "medium",
      includeExamples: true,
      includePracticeQuestions: false,
      includeVisualAids: false,
      customInstructions: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof generateSchema>) => {
      const response = await makeAdminRequest("/api/admin/content/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId,
          topicName,
          ...values,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate content");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedContent(data);
      toast({
        title: "Content generated successfully",
        description: "Review the generated content below before saving.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedContent) return;

      const response = await makeAdminRequest("/api/admin/resources/save-generated", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId,
          content: generatedContent,
          metadata: form.getValues(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save content");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Content saved successfully",
        description: `AI-generated content has been linked to ${topicName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resources"] });
      form.reset();
      setGeneratedContent(null);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = (open: boolean) => {
    // If closing and there's generated content, confirm first
    if (!open && generatedContent) {
      if (confirm("Are you sure? The generated content will be lost.")) {
        setGeneratedContent(null);
        onOpenChange(false);
      }
    } else if (!open) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate AI Content for {topicName}</DialogTitle>
          <DialogDescription>
            Use AI to generate study materials and learning resources for this topic.
          </DialogDescription>
        </DialogHeader>

        {!generatedContent ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => generateMutation.mutate(values))}
              className="space-y-4"
            >
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  AI-generated content should be reviewed and verified before use. 
                  The system will create content based on best practices in nursing education.
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-content-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="study_guide">Study Guide</SelectItem>
                        <SelectItem value="summary">Topic Summary</SelectItem>
                        <SelectItem value="practice_questions">Practice Questions</SelectItem>
                        <SelectItem value="concept_explanation">Concept Explanation</SelectItem>
                        <SelectItem value="case_study">Case Study</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the type of content to generate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-difficulty">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Length</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-length">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="short">Short (1-2 pages)</SelectItem>
                          <SelectItem value="medium">Medium (3-5 pages)</SelectItem>
                          <SelectItem value="comprehensive">Comprehensive (6+ pages)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel>Include Options</FormLabel>
                
                <FormField
                  control={form.control}
                  name="includeExamples"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-examples"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include Examples</FormLabel>
                        <FormDescription>
                          Add real-world examples and scenarios
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includePracticeQuestions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-questions"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include Practice Questions</FormLabel>
                        <FormDescription>
                          Add NCLEX-style practice questions with rationales
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeVisualAids"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-visuals"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include Visual Aid Descriptions</FormLabel>
                        <FormDescription>
                          Add descriptions for charts, diagrams, and mnemonics
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Any specific requirements or focus areas..."
                        rows={3}
                        data-testid="textarea-instructions"
                      />
                    </FormControl>
                    <FormDescription>
                      Provide additional guidance for content generation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={generateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={generateMutation.isPending}
                  data-testid="button-generate-submit"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Content
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <Brain className="h-4 w-4" />
              <AlertDescription>
                Content generated successfully! Review the content below before saving.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2">{generatedContent.title}</h3>
              <div className="prose prose-sm">
                <p className="whitespace-pre-wrap">{generatedContent.content}</p>
              </div>
              {generatedContent.metadata && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Type: {generatedContent.metadata.type} | 
                    Difficulty: {generatedContent.metadata.difficulty} | 
                    Length: {generatedContent.metadata.length}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setGeneratedContent(null)}
                disabled={saveMutation.isPending}
              >
                Regenerate
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-generated"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Save Content
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}