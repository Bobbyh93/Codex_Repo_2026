import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminAuth } from "@/lib/admin-auth";
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Download, 
  Upload,
  Filter,
  BookOpen,
  Video,
  FileText,
  Link2,
  Clock,
  Star
} from "lucide-react";

// Resource form schema with comprehensive validation
const resourceSchema = z.object({
  title: z.string().min(1, "Title is required").min(3, "Title must be at least 3 characters"),
  type: z.enum(["video", "article", "practice", "textbook", "quiz", "simulation"], {
    errorMap: () => ({ message: "Please select a resource type" })
  }),
  url: z.union([
    z.string().length(0), // Allow empty string
    z.string().url("Please enter a valid URL (e.g., https://example.com)")
  ]).optional(),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute").optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    errorMap: () => ({ message: "Please select a difficulty level" })
  }),
  tags: z.string().optional(), // Keep as string for UI, will be split later
  topics: z.string().min(1, "At least one topic is required").refine(
    (value) => value.trim().length > 0 && value.split(',').filter(t => t.trim()).length > 0,
    "Please enter at least one topic"
  ),
  description: z.string().optional(),
});

type ResourceFormData = z.infer<typeof resourceSchema>;

const getResourceIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="h-4 w-4" />;
    case "article":
    case "textbook":
      return <FileText className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "beginner":
      return "outline" as const;
    case "intermediate":
      return "secondary" as const;
    case "advanced":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export default function ResourceManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { makeAdminRequest } = useAdminAuth();
  const [editingResource, setEditingResource] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      title: "",
      type: "article",
      url: "",
      duration: 30,
      difficulty: "intermediate",
      tags: "",
      topics: "",
      description: "",
    },
  });

  // Watch form validity for button state
  const isFormValid = form.formState.isValid;

  // Fetch resources
  const { data: resources, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/resources", filterType, filterDifficulty],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("type", filterType);
      if (filterDifficulty !== "all") params.append("difficulty", filterDifficulty);
      
      const response = await makeAdminRequest(`/api/admin/resources?${params}`);
      
      if (!response.ok) throw new Error("Failed to fetch resources");
      return response.json();
    },
  });

  // Add resource mutation with enhanced error handling
  const addResourceMutation = useMutation({
    mutationFn: async (data: ResourceFormData) => {
      const response = await makeAdminRequest("/api/admin/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          topics: data.topics.split(",").map(t => t.trim()).filter(Boolean),
          keywords: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          metadata: {
            author: "Admin",
            publishDate: new Date().toISOString(),
            cost: "free",
          },
          mappings: {},
          quality: {
            accuracy: 90,
            relevance: 90,
            engagement: 85,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Resource Created",
        description: "The learning resource has been successfully added to the platform.",
      });
      setIsAddDialogOpen(false);
      form.reset();
      refetch();
    },
    onError: (error: Error) => {
      console.error("Add resource error:", error);
      toast({
        title: "❌ Failed to Create Resource",
        description: error.message || "Unable to create the resource. Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  // Update resource mutation with enhanced error handling
  const updateResourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ResourceFormData }) => {
      const response = await makeAdminRequest(`/api/admin/resources/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          topics: data.topics.split(",").map(t => t.trim()).filter(Boolean),
          keywords: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Resource Updated",
        description: "The learning resource has been successfully updated.",
      });
      setEditingResource(null);
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error: Error) => {
      console.error("Update resource error:", error);
      toast({
        title: "❌ Failed to Update Resource",
        description: error.message || "Unable to update the resource. Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission state
  const isSubmitting = addResourceMutation.isPending || updateResourceMutation.isPending;

  const handleSubmit = (data: ResourceFormData) => {
    if (editingResource) {
      updateResourceMutation.mutate({ id: editingResource.id, data });
    } else {
      addResourceMutation.mutate(data);
    }
  };

  const handleEdit = (resource: any) => {
    setEditingResource(resource);
    form.reset({
      title: resource.title,
      type: resource.type,
      url: resource.url || "",
      duration: resource.duration || 30,
      difficulty: resource.difficulty,
      tags: resource.tags?.join(", ") || "",
      topics: resource.topics?.join(", ") || "",
      description: resource.description || "",
    });
    setIsAddDialogOpen(true);
  };

  const filteredResources = resources?.resources?.filter((resource: any) => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          resource.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  }) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Management</h1>
          <p className="text-muted-foreground">Manage learning materials and study resources</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resources?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resources?.resources?.filter((r: any) => r.type === "video").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resources?.resources?.filter((r: any) => r.type === "article").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Practice Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resources?.resources?.filter((r: any) => r.type === "quiz").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-resources"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]" data-testid="select-resource-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="textbook">Textbook</SelectItem>
                    <SelectItem value="simulation">Simulation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                  <SelectTrigger className="w-[150px]" data-testid="select-difficulty">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" data-testid="button-bulk-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
                <Button variant="outline" data-testid="button-export">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-resource">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Resource
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resources Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No resources found</TableCell>
                  </TableRow>
                ) : (
                  filteredResources.map((resource: any) => (
                    <TableRow key={resource.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getResourceIcon(resource.type)}
                          <div>
                            <p>{resource.title}</p>
                            {resource.provider && (
                              <p className="text-xs text-muted-foreground">{resource.provider}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{resource.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getDifficultyColor(resource.difficulty)}
                          className={resource.difficulty === "beginner" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}
                        >
                          {resource.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{resource.duration || "-"} min</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {resource.topics?.slice(0, 2).map((topic: string) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {resource.topics?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{resource.topics.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {resource.metadata?.rating ? (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm">{resource.metadata.rating}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {resource.url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              data-testid={`button-view-${resource.id}`}
                            >
                              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                <Link2 className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(resource)}
                            data-testid={`button-edit-${resource.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-${resource.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit Resource Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingResource(null);
            form.reset();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingResource ? "Edit Resource" : "Add New Resource"}</DialogTitle>
              <DialogDescription>
                {editingResource ? "Update the resource details" : "Add a new learning resource to the platform"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Title
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter resource title"
                          data-testid="input-resource-title"
                          disabled={isSubmitting}
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
                        <FormLabel className="flex items-center gap-1">
                          Type
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger data-testid="select-resource-type-form">
                              <SelectValue placeholder="Select resource type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="video">📹 Video</SelectItem>
                            <SelectItem value="article">📄 Article</SelectItem>
                            <SelectItem value="practice">✏️ Practice</SelectItem>
                            <SelectItem value="textbook">📚 Textbook</SelectItem>
                            <SelectItem value="quiz">❓ Quiz</SelectItem>
                            <SelectItem value="simulation">🔬 Simulation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Difficulty
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger data-testid="select-difficulty-form">
                              <SelectValue placeholder="Select difficulty level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">🟢 Beginner</SelectItem>
                            <SelectItem value="intermediate">🟡 Intermediate</SelectItem>
                            <SelectItem value="advanced">🔴 Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">URL (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://example.com/resource"
                            data-testid="input-resource-url"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Leave empty if not applicable
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min="1"
                            placeholder="30"
                            data-testid="input-resource-duration"
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Estimated time to complete (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="topics"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Topics
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Pharmacology, Drug Administration, Medication Safety"
                          data-testid="input-resource-topics"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter at least one nursing topic this resource covers (separate multiple topics with commas)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Tags (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="nclex, pharmacology, medications"
                          data-testid="input-resource-tags"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Keywords to help categorize and search for this resource
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Brief description of what this resource covers and how it helps students..."
                          data-testid="textarea-resource-description"
                          disabled={isSubmitting}
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Help users understand what this resource is about
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4 border-t">
                  <div className="flex justify-between items-center w-full">
                    <div className="text-xs text-muted-foreground">
                      <span className="text-red-500">*</span> Required fields
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsAddDialogOpen(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={!isFormValid || isSubmitting}
                        data-testid="button-save-resource"
                        className="min-w-[120px]"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            {editingResource ? "Updating..." : "Creating..."}
                          </div>
                        ) : (
                          editingResource ? "Update Resource" : "Add Resource"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}