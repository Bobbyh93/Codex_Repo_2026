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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, ExternalLink, Loader2, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const attachSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  url: z.string().url("Please enter a valid URL"),
  description: z.string().optional(),
  type: z.enum(["video", "article", "practice", "simulation", "website", "other"]),
  provider: z.string().min(2, "Provider is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  duration: z.number().min(1).optional(),
  tags: z.array(z.string()).default([]),
});

interface AttachExternalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  onSuccess?: () => void;
}

export function AttachExternalModal({
  open,
  onOpenChange,
  topicId,
  topicName,
  onSuccess,
}: AttachExternalModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset form and state when closing
      form.reset();
      setTags([]);
      setTagInput("");
      setUrlPreview(null);
      onOpenChange(false);
    }
  };

  const form = useForm<z.infer<typeof attachSchema>>({
    resolver: zodResolver(attachSchema),
    defaultValues: {
      title: "",
      url: "",
      description: "",
      type: "article",
      provider: "",
      difficulty: "intermediate",
      duration: undefined,
      tags: [],
    },
  });

  // Auto-detect provider from URL
  const handleUrlChange = (url: string) => {
    form.setValue("url", url);
    
    // Auto-detect provider
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      form.setValue("provider", "YouTube");
      form.setValue("type", "video");
    } else if (url.includes("khanacademy.org")) {
      form.setValue("provider", "Khan Academy");
    } else if (url.includes("nurseslabs.com")) {
      form.setValue("provider", "Nurseslabs");
    } else if (url.includes("registerednursern.com")) {
      form.setValue("provider", "RegisteredNurseRN");
    } else if (url.includes("simplenursing.com")) {
      form.setValue("provider", "Simple Nursing");
    } else if (url.includes("picmonic.com")) {
      form.setValue("provider", "Picmonic");
    } else if (url.includes("ncbi.nlm.nih.gov")) {
      form.setValue("provider", "PubMed/NCBI");
      form.setValue("type", "article");
    }
  };

  const attachMutation = useMutation({
    mutationFn: async (values: z.infer<typeof attachSchema>) => {
      const response = await makeAdminRequest("/api/admin/resources/attach-external", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          topicId,
          tags,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to attach external resource");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "External resource attached successfully",
        description: `The resource has been linked to ${topicName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resources"] });
      form.reset();
      setTags([]);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Attachment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Preview URL mutation
  const previewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await makeAdminRequest("/api/admin/resources/preview-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error("Failed to preview URL");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUrlPreview(data);
      if (data.title && !form.getValues("title")) {
        form.setValue("title", data.title);
      }
      if (data.description && !form.getValues("description")) {
        form.setValue("description", data.description);
      }
    },
  });

  const handlePreviewUrl = () => {
    const url = form.getValues("url");
    if (url && z.string().url().safeParse(url).success) {
      previewMutation.mutate(url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attach External Resource to {topicName}</DialogTitle>
          <DialogDescription>
            Link to external learning resources from educational websites, videos, or articles.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => attachMutation.mutate(values))}
            className="space-y-4"
          >
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                Attach resources from trusted educational platforms like YouTube, Khan Academy, 
                Nurseslabs, or academic journals.
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource URL</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://www.example.com/resource"
                        onChange={(e) => handleUrlChange(e.target.value)}
                        data-testid="input-url"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handlePreviewUrl}
                      disabled={!form.getValues("url") || previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Preview"
                      )}
                    </Button>
                  </div>
                  <FormDescription>
                    Enter the full URL of the external resource
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {urlPreview && (
              <Alert className="border-blue-200 bg-blue-50">
                <ExternalLink className="h-4 w-4" />
                <AlertDescription>
                  <strong>Preview:</strong> {urlPreview.title || "Resource found"}
                  {urlPreview.description && (
                    <p className="text-xs mt-1">{urlPreview.description}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Pharmacology Basics Video Tutorial"
                      data-testid="input-title"
                    />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Brief description of the resource content..."
                      rows={3}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="article">Article</SelectItem>
                        <SelectItem value="practice">Practice Questions</SelectItem>
                        <SelectItem value="simulation">Simulation</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider/Source</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Khan Academy"
                        data-testid="input-provider"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="e.g., 15"
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-duration"
                      />
                    </FormControl>
                    <FormDescription>
                      Estimated time to complete
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Add tags..."
                  data-testid="input-tags"
                />
                <Button type="button" variant="secondary" onClick={addTag}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-red-500"
                      data-testid={`remove-tag-${tag}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={attachMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={attachMutation.isPending}
                data-testid="button-attach-submit"
              >
                {attachMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Attaching...
                  </>
                ) : (
                  <>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach Resource
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}