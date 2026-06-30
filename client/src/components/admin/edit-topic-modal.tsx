import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2, Save } from "lucide-react";

const editTopicSchema = z.object({
  topicName: z.string().min(3, "Topic name must be at least 3 characters"),
  priority: z.number().min(0).max(10),
  resolved: z.boolean(),
  notes: z.string().optional(),
});

interface EditTopicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicName: string;
  currentPriority: number;
  currentResolved: boolean;
  onSuccess?: () => void;
}

interface TopicData {
  id: string;
  topicId: string;
  topicName: string;
  priority: number;
  resolved: boolean;
  notes?: string;
  requestCount: number;
  firstRequested: string;
  lastRequested: string;
}

export function EditTopicModal({
  open,
  onOpenChange,
  topicId,
  topicName,
  currentPriority,
  currentResolved,
  onSuccess,
}: EditTopicModalProps) {
  const { toast } = useToast();
  const { makeAdminRequest } = useAdminAuth();

  // Fetch current topic data for form initialization
  const { data: topicData, isLoading: isLoadingData } = useQuery({
    queryKey: ["/api/admin/topics-queue/details", topicId],
    queryFn: async () => {
      const response = await makeAdminRequest(`/api/admin/topics-queue/${topicId}/details`);
      if (!response.ok) throw new Error("Failed to fetch topic data");
      return response.json() as Promise<TopicData>;
    },
    enabled: open && !!topicId,
  });

  const form = useForm<z.infer<typeof editTopicSchema>>({
    resolver: zodResolver(editTopicSchema),
    defaultValues: {
      topicName,
      priority: currentPriority,
      resolved: currentResolved,
      notes: "",
    },
  });

  // Update form when data loads - moved to useEffect to prevent render loops
  useEffect(() => {
    if (topicData && !form.formState.isDirty) {
      form.reset({
        topicName: topicData.topicName,
        priority: topicData.priority,
        resolved: topicData.resolved,
        notes: topicData.notes || "",
      });
    }
  }, [topicData, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof editTopicSchema>) => {
      const response = await makeAdminRequest(`/api/admin/topics-queue/${topicId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName: values.topicName,
          priority: values.priority,
          resolved: values.resolved,
          notes: values.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update topic");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Topic updated successfully",
        description: `Changes to "${form.getValues().topicName}" have been saved`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics-queue/details", topicId] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return "Critical";
    if (priority >= 5) return "High";
    if (priority >= 3) return "Medium";
    return "Low";
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-600";
    if (priority >= 5) return "text-orange-600";
    if (priority >= 3) return "text-yellow-600";
    return "text-green-600";
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Topic: {topicName}
          </DialogTitle>
          <DialogDescription>
            Update topic properties, priority level, and resolution status.
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="topicName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter topic name"
                        data-testid="input-topic-name"
                      />
                    </FormControl>
                    <FormDescription>
                      The display name for this topic in the queue
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Priority Level</span>
                      <span className={`text-sm font-medium ${getPriorityColor(field.value)}`} data-testid="priority-label">
                        {field.value} - {getPriorityLabel(field.value)}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <div className="px-2">
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(values) => field.onChange(values[0])}
                          className="w-full"
                          data-testid="slider-priority"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Low (0)</span>
                          <span>Medium (3-4)</span>
                          <span>High (5-7)</span>
                          <span>Critical (8-10)</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Higher priority topics will appear first in the queue
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="resolved"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mark as Resolved</FormLabel>
                      <FormDescription>
                        Mark this topic as resolved if adequate resources have been added
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-resolved"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any notes about this topic's status or requirements..."
                        rows={3}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormDescription>
                      Internal notes about this topic's development status
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Topic Stats (Read-only) */}
              {topicData && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-2">Topic Statistics</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Requests:</span>
                      <span className="ml-2 font-medium" data-testid="stat-requests">
                        {topicData.requestCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">First Requested:</span>
                      <span className="ml-2 font-medium" data-testid="stat-first-requested">
                        {topicData.firstRequested && !isNaN(new Date(topicData.firstRequested).getTime()) ? new Date(topicData.firstRequested).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Requested:</span>
                      <span className="ml-2 font-medium" data-testid="stat-last-requested">
                        {topicData.lastRequested && !isNaN(new Date(topicData.lastRequested).getTime()) ? new Date(topicData.lastRequested).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-2 font-medium" data-testid="stat-status">
                        {form.watch("resolved") ? "Resolved" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || !form.formState.isDirty}
                  data-testid="button-save-edit"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}