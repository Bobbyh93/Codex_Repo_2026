import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminAuth } from "@/lib/admin-auth";
import type {
  Textbook,
  TextbookChapter,
  TextbookSection,
  ChapterTopicMapping,
} from "@shared/schema";
import {
  Library,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Search,
  Link2,
  Unlink,
  Upload,
  Loader2,
  BookMarked,
  Layers,
  Tag,
  Indent,
} from "lucide-react";

// ==================== Types ====================
const SUBJECTS = [
  "Fundamentals",
  "Medical-Surgical",
  "Pharmacology",
  "OB/Maternal",
  "Pediatrics",
  "Mental Health",
  "Geriatrics",
  "Community Health",
  "Leadership/Management",
  "Critical Care",
] as const;

const NCLEX_CATEGORIES = [
  "Management of Care",
  "Safety and Infection Control",
  "Health Promotion and Maintenance",
  "Psychosocial Integrity",
  "Basic Care and Comfort",
  "Pharmacological and Parenteral Therapies",
  "Reduction of Risk Potential",
  "Physiological Adaptation",
  "Growth and Development",
] as const;

interface ChapterSearchResult {
  id: string;
  chapterNumber: string;
  title: string;
  subjectTag: string | null;
  nclexCategoryTag: string | null;
  textbookId: string;
  textbookTitle: string | null;
  textbookPublisher: string | null;
}

interface MappingWithDetail {
  id: string;
  chapterId: string | null;
  sectionId: string | null;
  nursingTopicId: string | null;
  contentAreaId: string | null;
  subject: string | null;
  notes: string | null;
  chapterTitle: string | null;
  chapterNumber: string | null;
  textbookTitle: string | null;
  sectionTitle: string | null;
  sectionNumber: string | null;
}

interface NursingTopic {
  id: string;
  name: string;
  contentAreaId: string | null;
}

interface ContentArea {
  id: string;
  name: string;
  nclexCategory: string;
}

interface TopicsWithMappingsResponse {
  areas: ContentArea[];
  topics: NursingTopic[];
  mappings: MappingWithDetail[];
}

// ==================== Form Schemas ====================
const textbookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  publisher: z.string().min(1, "Publisher is required"),
  edition: z.string().optional(),
  isbn: z.string().optional(),
  primarySubject: z.string().optional(),
  description: z.string().optional(),
});

const chapterSchema = z.object({
  chapterNumber: z.string().min(1, "Chapter number is required"),
  title: z.string().min(1, "Title is required"),
  subjectTag: z.string().optional(),
  nclexCategoryTag: z.string().optional(),
  pageStart: z.coerce.number().optional(),
  pageEnd: z.coerce.number().optional(),
});

const sectionSchema = z.object({
  sectionNumber: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  subjectTag: z.string().optional(),
  nclexCategoryTag: z.string().optional(),
  pageStart: z.coerce.number().optional(),
  pageEnd: z.coerce.number().optional(),
});

const bulkChaptersSchema = z.object({
  chaptersJson: z.string().min(1, "JSON is required"),
});

type TextbookFormValues = z.infer<typeof textbookSchema>;
type ChapterFormValues = z.infer<typeof chapterSchema>;
type SectionFormValues = z.infer<typeof sectionSchema>;
type BulkChaptersFormValues = z.infer<typeof bulkChaptersSchema>;

// ==================== Main Component ====================
export default function CurriculumCatalog() {
  const { makeAdminRequest } = useAdminAuth();
  const { toast } = useToast();

  const [selectedTextbookId, setSelectedTextbookId] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [textbookSearch, setTextbookSearch] = useState("");

  // Dialog states
  const [textbookDialog, setTextbookDialog] = useState<{ open: boolean; editing: Textbook | null }>({ open: false, editing: null });
  const [chapterDialog, setChapterDialog] = useState<{ open: boolean; textbookId: string | null; editing: TextbookChapter | null }>({ open: false, textbookId: null, editing: null });
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; chapterId: string | null; editing: TextbookSection | null }>({ open: false, chapterId: null, editing: null });
  const [bulkDialog, setBulkDialog] = useState<{ open: boolean; textbookId: string | null }>({ open: false, textbookId: null });
  const [mappingDialog, setMappingDialog] = useState<{ open: boolean; topicId: string | null; topicName: string | null; contentAreaId: string | null }>({ open: false, topicId: null, topicName: null, contentAreaId: null });

  // Mapping dialog state
  const [chapterSearch, setChapterSearch] = useState("");
  const [selectedChapterForSection, setSelectedChapterForSection] = useState<ChapterSearchResult | null>(null);
  const [sectionSearch, setSectionSearch] = useState("");

  // ==================== Queries ====================
  const { data: textbooks = [], isLoading: textbooksLoading } = useQuery<Textbook[]>({
    queryKey: ["/api/admin/curriculum/textbooks"],
    queryFn: async () => {
      const res = await makeAdminRequest("/api/admin/curriculum/textbooks");
      if (!res.ok) throw new Error("Failed to fetch textbooks");
      return res.json();
    },
  });

  const { data: chaptersData = [] } = useQuery<TextbookChapter[]>({
    queryKey: ["/api/admin/curriculum/chapters", selectedTextbookId],
    queryFn: async () => {
      if (!selectedTextbookId) return [];
      const res = await makeAdminRequest(`/api/admin/curriculum/textbooks/${selectedTextbookId}/chapters`);
      if (!res.ok) throw new Error("Failed to fetch chapters");
      return res.json();
    },
    enabled: !!selectedTextbookId,
  });

  const { data: topicsData } = useQuery<TopicsWithMappingsResponse>({
    queryKey: ["/api/admin/curriculum/topics-with-mappings"],
    queryFn: async () => {
      const res = await makeAdminRequest("/api/admin/curriculum/topics-with-mappings");
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json();
    },
  });

  const { data: allChapters = [] } = useQuery<ChapterSearchResult[]>({
    queryKey: ["/api/admin/curriculum/chapters/search", chapterSearch],
    queryFn: async () => {
      const url = chapterSearch
        ? `/api/admin/curriculum/chapters/search?q=${encodeURIComponent(chapterSearch)}`
        : "/api/admin/curriculum/chapters/search";
      const res = await makeAdminRequest(url);
      if (!res.ok) throw new Error("Failed to search chapters");
      return res.json();
    },
  });

  const { data: chapterSections = [] } = useQuery<TextbookSection[]>({
    queryKey: ["/api/admin/curriculum/chapters", selectedChapterForSection?.id, "sections"],
    queryFn: async () => {
      if (!selectedChapterForSection) return [];
      const res = await makeAdminRequest(`/api/admin/curriculum/chapters/${selectedChapterForSection.id}/sections/search`);
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
    enabled: !!selectedChapterForSection,
  });

  const { data: sections = {} as Record<string, TextbookSection[]> } = useQuery<Record<string, TextbookSection[]>>({
    queryKey: ["/api/admin/curriculum/sections", Array.from(expandedChapters).join(",")],
    queryFn: async () => {
      const result: Record<string, TextbookSection[]> = {};
      for (const chapterId of expandedChapters) {
        const res = await makeAdminRequest(`/api/admin/curriculum/chapters/${chapterId}/sections`);
        if (res.ok) result[chapterId] = await res.json();
      }
      return result;
    },
    enabled: expandedChapters.size > 0,
  });

  // ==================== Mutations ====================
  const seedAlignmentMutation = useMutation({
    mutationFn: async () => {
      const res = await makeAdminRequest("/api/admin/curriculum/seed-alignment", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed");
      return res.json() as Promise<{ count: number }>;
    },
    onSuccess: (data) => {
      toast({ title: "Alignment seeded", description: `${data.count} subject alignments configured` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const seedCatalogMutation = useMutation({
    mutationFn: async () => {
      const res = await makeAdminRequest("/api/admin/seed-catalog", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed catalog");
      return res.json() as Promise<{
        success: boolean;
        message: string;
        details: { ati: unknown; openRN: unknown; pearson: unknown; medSurg: unknown };
        totalInserted: number;
        totalSkipped: number;
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/textbooks"] });
      toast({ title: "Catalog seeded", description: data.message });
    },
    onError: (e: Error) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  const saveTextbookMutation = useMutation({
    mutationFn: async (data: TextbookFormValues & { id?: string }) => {
      const { id, ...body } = data;
      const url = id ? `/api/admin/curriculum/textbooks/${id}` : "/api/admin/curriculum/textbooks";
      const res = await makeAdminRequest(url, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed to save textbook");
      return res.json() as Promise<Textbook>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/textbooks"] });
      setTextbookDialog({ open: false, editing: null });
      toast({ title: "Textbook saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTextbookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await makeAdminRequest(`/api/admin/curriculum/textbooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/textbooks"] });
      setSelectedTextbookId(null);
      toast({ title: "Textbook deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveChapterMutation = useMutation({
    mutationFn: async (data: ChapterFormValues & { id?: string; textbookId: string }) => {
      const { id, textbookId, ...body } = data;
      const url = id ? `/api/admin/curriculum/chapters/${id}` : `/api/admin/curriculum/textbooks/${textbookId}/chapters`;
      const res = await makeAdminRequest(url, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed to save chapter");
      return res.json() as Promise<TextbookChapter>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters/search"] });
      setChapterDialog({ open: false, textbookId: null, editing: null });
      toast({ title: "Chapter saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await makeAdminRequest(`/api/admin/curriculum/chapters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters/search"] });
      toast({ title: "Chapter deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveSectionMutation = useMutation({
    mutationFn: async (data: SectionFormValues & { id?: string; chapterId: string }) => {
      const { id, chapterId, ...body } = data;
      const url = id ? `/api/admin/curriculum/sections/${id}` : `/api/admin/curriculum/chapters/${chapterId}/sections`;
      const res = await makeAdminRequest(url, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed to save section");
      return res.json() as Promise<TextbookSection>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/sections"] });
      setSectionDialog({ open: false, chapterId: null, editing: null });
      toast({ title: "Section saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await makeAdminRequest(`/api/admin/curriculum/sections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/sections"] });
      toast({ title: "Section deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (data: { textbookId: string; chapters: unknown[] }) => {
      const res = await makeAdminRequest(`/api/admin/curriculum/textbooks/${data.textbookId}/chapters/bulk`, {
        method: "POST",
        body: JSON.stringify({ chapters: data.chapters }),
      });
      if (!res.ok) throw new Error("Failed to bulk import");
      return res.json() as Promise<{ inserted: number; chapters: TextbookChapter[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/chapters/search"] });
      setBulkDialog({ open: false, textbookId: null });
      toast({ title: "Bulk import complete", description: `${data.inserted} chapters imported` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMappingMutation = useMutation({
    mutationFn: async (data: { chapterId?: string; sectionId?: string; nursingTopicId?: string; contentAreaId?: string; subject?: string; notes?: string }) => {
      const res = await makeAdminRequest("/api/admin/curriculum/mappings", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to add mapping");
      return res.json() as Promise<ChapterTopicMapping>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/topics-with-mappings"] });
      setMappingDialog({ open: false, topicId: null, topicName: null, contentAreaId: null });
      setSelectedChapterForSection(null);
      setSectionSearch("");
      setChapterSearch("");
      toast({ title: "Mapping added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await makeAdminRequest(`/api/admin/curriculum/mappings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove mapping");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curriculum/topics-with-mappings"] });
      toast({ title: "Mapping removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ==================== Forms ====================
  const textbookForm = useForm<TextbookFormValues>({
    resolver: zodResolver(textbookSchema),
    defaultValues: { title: "", publisher: "", edition: "", isbn: "", primarySubject: "", description: "" },
  });

  const chapterForm = useForm<ChapterFormValues>({
    resolver: zodResolver(chapterSchema),
    defaultValues: { chapterNumber: "", title: "", subjectTag: "", nclexCategoryTag: "" },
  });

  const sectionForm = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema),
    defaultValues: { sectionNumber: "", title: "", subjectTag: "", nclexCategoryTag: "" },
  });

  const bulkForm = useForm<BulkChaptersFormValues>({
    resolver: zodResolver(bulkChaptersSchema),
    defaultValues: { chaptersJson: "" },
  });

  // ==================== Helpers ====================
  const openTextbookDialog = (book?: Textbook) => {
    textbookForm.reset(book ? {
      title: book.title,
      publisher: book.publisher,
      edition: book.edition ?? "",
      isbn: book.isbn ?? "",
      primarySubject: book.primarySubject ?? "",
      description: book.description ?? "",
    } : { title: "", publisher: "", edition: "", isbn: "", primarySubject: "", description: "" });
    setTextbookDialog({ open: true, editing: book ?? null });
  };

  const openChapterDialog = (textbookId: string, chapter?: TextbookChapter) => {
    chapterForm.reset(chapter ? {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      subjectTag: chapter.subjectTag ?? "",
      nclexCategoryTag: chapter.nclexCategoryTag ?? "",
      pageStart: chapter.pageStart ?? undefined,
      pageEnd: chapter.pageEnd ?? undefined,
    } : { chapterNumber: "", title: "", subjectTag: "", nclexCategoryTag: "" });
    setChapterDialog({ open: true, textbookId, editing: chapter ?? null });
  };

  const openSectionDialog = (chapterId: string, section?: TextbookSection) => {
    sectionForm.reset(section ? {
      sectionNumber: section.sectionNumber ?? "",
      title: section.title,
      subjectTag: section.subjectTag ?? "",
      nclexCategoryTag: section.nclexCategoryTag ?? "",
      pageStart: section.pageStart ?? undefined,
      pageEnd: section.pageEnd ?? undefined,
    } : { sectionNumber: "", title: "", subjectTag: "", nclexCategoryTag: "" });
    setSectionDialog({ open: true, chapterId, editing: section ?? null });
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const selectedTextbook = textbooks.find((b) => b.id === selectedTextbookId) ?? null;
  const filteredTextbooks = textbooks.filter((b) =>
    b.title.toLowerCase().includes(textbookSearch.toLowerCase()) ||
    b.publisher.toLowerCase().includes(textbookSearch.toLowerCase())
  );

  const areas = topicsData?.areas ?? [];
  const allTopics = topicsData?.topics ?? [];
  const allMappings = topicsData?.mappings ?? [];

  const filteredChapterSections = chapterSections.filter((s) =>
    !sectionSearch || s.title.toLowerCase().includes(sectionSearch.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Curriculum Catalog</h1>
            <p className="text-muted-foreground">Manage textbooks, chapters, and NCLEX topic mappings</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedCatalogMutation.mutate()}
              disabled={seedCatalogMutation.isPending}
              data-testid="button-seed-catalog"
            >
              {seedCatalogMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Library className="h-4 w-4 mr-2" />}
              Seed Default Catalog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedAlignmentMutation.mutate()}
              disabled={seedAlignmentMutation.isPending}
              data-testid="button-seed-alignment"
            >
              {seedAlignmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Seed Subject Alignment
            </Button>
          </div>
        </div>

        <Tabs defaultValue="textbooks">
          <TabsList>
            <TabsTrigger value="textbooks">
              <BookOpen className="h-4 w-4 mr-2" />
              Textbook Manager
            </TabsTrigger>
            <TabsTrigger value="mapping">
              <Link2 className="h-4 w-4 mr-2" />
              Topic Mapping
            </TabsTrigger>
          </TabsList>

          {/* ==================== TEXTBOOK MANAGER ==================== */}
          <TabsContent value="textbooks" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search textbooks..."
                      value={textbookSearch}
                      onChange={(e) => setTextbookSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button size="sm" onClick={() => openTextbookDialog()} data-testid="button-add-textbook">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {textbooksLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading...
                  </div>
                ) : filteredTextbooks.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Library className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No textbooks yet.</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => openTextbookDialog()}>
                        Add first textbook
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredTextbooks.map((book) => (
                    <Card
                      key={book.id}
                      className={`cursor-pointer transition-colors ${selectedTextbookId === book.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
                      onClick={() => setSelectedTextbookId(book.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight">{book.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{book.publisher}</p>
                            {book.edition && <p className="text-xs text-muted-foreground">{book.edition}</p>}
                            {book.primarySubject && (
                              <Badge variant="secondary" className="mt-1 text-xs">{book.primarySubject}</Badge>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); openTextbookDialog(book); }}
                              data-testid={`edit-book-${book.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteTextbookMutation.mutate(book.id); }}
                              data-testid={`delete-book-${book.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-2">
                {!selectedTextbook ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      <BookMarked className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Select a textbook to view and manage its chapters</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{selectedTextbook.title}</h2>
                        <p className="text-sm text-muted-foreground">{selectedTextbook.publisher}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkDialog({ open: true, textbookId: selectedTextbookId })}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Bulk Import
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openChapterDialog(selectedTextbookId!)}
                          data-testid="button-add-chapter"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Chapter
                        </Button>
                      </div>
                    </div>

                    {chaptersData.length === 0 ? (
                      <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                          <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No chapters yet. Add a chapter or bulk import a table of contents.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {chaptersData.map((chapter) => (
                          <Collapsible
                            key={chapter.id}
                            open={expandedChapters.has(chapter.id)}
                            onOpenChange={() => toggleChapter(chapter.id)}
                          >
                            <Card>
                              <CardContent className="p-0">
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                                    {expandedChapters.has(chapter.id)
                                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-muted-foreground">Ch. {chapter.chapterNumber}</span>
                                        <span className="text-sm font-medium">{chapter.title}</span>
                                        {chapter.subjectTag && <Badge variant="outline" className="text-xs">{chapter.subjectTag}</Badge>}
                                        {chapter.nclexCategoryTag && <Badge variant="secondary" className="text-xs">{chapter.nclexCategoryTag}</Badge>}
                                        {chapter.pageStart != null && chapter.pageEnd != null && (
                                          <span className="text-xs text-muted-foreground">pp. {chapter.pageStart}–{chapter.pageEnd}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openChapterDialog(selectedTextbookId!, chapter)}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="border-t px-4 pb-3 pt-2 space-y-1 bg-muted/20">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sections</span>
                                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openSectionDialog(chapter.id)}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Section
                                      </Button>
                                    </div>
                                    {(sections[chapter.id] ?? []).length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-1 pl-2">No sections — add sections to this chapter.</p>
                                    ) : (
                                      (sections[chapter.id] ?? []).map((section) => (
                                        <div key={section.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-background/80 group">
                                          <Indent className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                          <span className="text-xs text-muted-foreground w-12 shrink-0">{section.sectionNumber ?? "—"}</span>
                                          <span className="text-sm flex-1">{section.title}</span>
                                          {section.subjectTag && <Badge variant="outline" className="text-xs">{section.subjectTag}</Badge>}
                                          {section.pageStart != null && <span className="text-xs text-muted-foreground">p.{section.pageStart}</span>}
                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openSectionDialog(chapter.id, section)}>
                                              <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteSectionMutation.mutate(section.id)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </CardContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== TOPIC MAPPING TAB ==================== */}
          <TabsContent value="mapping" className="mt-4">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">NCLEX Topic → Textbook Chapter/Section Mappings</CardTitle>
                  <CardDescription>
                    For each nursing topic, link specific textbook chapters or sections. Click "Add Mapping" to search and link at the chapter or section level.
                  </CardDescription>
                </CardHeader>
              </Card>

              {areas.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No NCLEX content areas found. Upload and process assessment data first.</p>
                  </CardContent>
                </Card>
              ) : (
                areas.map((area) => {
                  const areaTopics = allTopics.filter((t) => t.contentAreaId === area.id);
                  return (
                    <Card key={area.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-primary">{area.nclexCategory || area.name}</CardTitle>
                        <CardDescription className="text-xs">{area.name}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {areaTopics.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No topics in this category.</p>
                        ) : (
                          <div className="space-y-2">
                            {areaTopics.map((topic) => {
                              const topicMappings = allMappings.filter((m) => m.nursingTopicId === topic.id);
                              return (
                                <div key={topic.id} className="border rounded-md p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{topic.name}</p>
                                      {topicMappings.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {topicMappings.map((m) => (
                                            <div key={m.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-xs">
                                              <BookOpen className="h-3 w-3 text-blue-600 shrink-0" />
                                              <span className="text-blue-800">
                                                {m.textbookTitle
                                                  ? `${m.textbookTitle} — Ch. ${m.chapterNumber}`
                                                  : "Unknown chapter"}
                                              </span>
                                              {m.sectionTitle && (
                                                <span className="text-blue-600 flex items-center gap-0.5">
                                                  <Indent className="h-2.5 w-2.5" />
                                                  {m.sectionNumber ? `${m.sectionNumber} ` : ""}{m.sectionTitle}
                                                </span>
                                              )}
                                              <button
                                                onClick={() => removeMappingMutation.mutate(m.id)}
                                                className="ml-1 text-red-400 hover:text-red-600"
                                                title="Remove mapping"
                                              >
                                                <Unlink className="h-3 w-3" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground mt-1">No chapters mapped yet</p>
                                      )}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="shrink-0 text-xs h-7"
                                      onClick={() => {
                                        setSelectedChapterForSection(null);
                                        setChapterSearch("");
                                        setSectionSearch("");
                                        setMappingDialog({ open: true, topicId: topic.id, topicName: topic.name, contentAreaId: area.id });
                                      }}
                                      data-testid={`add-mapping-${topic.id}`}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Mapping
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== TEXTBOOK DIALOG ==================== */}
      <Dialog open={textbookDialog.open} onOpenChange={(open) => setTextbookDialog({ open, editing: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{textbookDialog.editing ? "Edit Textbook" : "Add Textbook"}</DialogTitle>
          </DialogHeader>
          <Form {...textbookForm}>
            <form
              onSubmit={textbookForm.handleSubmit((data) =>
                saveTextbookMutation.mutate({ ...data, id: textbookDialog.editing?.id })
              )}
              className="space-y-4"
            >
              <FormField control={textbookForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Open RN Nursing Fundamentals" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={textbookForm.control} name="publisher" render={({ field }) => (
                <FormItem>
                  <FormLabel>Publisher</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Open RN, ATI, Pearson" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={textbookForm.control} name="edition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edition</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 2nd" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={textbookForm.control} name="isbn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISBN</FormLabel>
                    <FormControl><Input {...field} placeholder="978-..." /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={textbookForm.control} name="primarySubject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Subject</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={textbookForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} rows={2} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTextbookDialog({ open: false, editing: null })}>Cancel</Button>
                <Button type="submit" disabled={saveTextbookMutation.isPending}>
                  {saveTextbookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ==================== CHAPTER DIALOG ==================== */}
      <Dialog open={chapterDialog.open} onOpenChange={(open) => setChapterDialog({ open, textbookId: null, editing: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{chapterDialog.editing ? "Edit Chapter" : "Add Chapter"}</DialogTitle>
          </DialogHeader>
          <Form {...chapterForm}>
            <form
              onSubmit={chapterForm.handleSubmit((data) =>
                saveChapterMutation.mutate({ ...data, id: chapterDialog.editing?.id, textbookId: chapterDialog.textbookId! })
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <FormField control={chapterForm.control} name="chapterNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number</FormLabel>
                    <FormControl><Input {...field} placeholder="1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="col-span-2">
                  <FormField control={chapterForm.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input {...field} placeholder="Chapter title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              <FormField control={chapterForm.control} name="subjectTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Tag</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={chapterForm.control} name="nclexCategoryTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>NCLEX Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NCLEX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={chapterForm.control} name="pageStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Start</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={chapterForm.control} name="pageEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page End</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setChapterDialog({ open: false, textbookId: null, editing: null })}>Cancel</Button>
                <Button type="submit" disabled={saveChapterMutation.isPending}>
                  {saveChapterMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ==================== SECTION DIALOG ==================== */}
      <Dialog open={sectionDialog.open} onOpenChange={(open) => setSectionDialog({ open, chapterId: null, editing: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sectionDialog.editing ? "Edit Section" : "Add Section"}</DialogTitle>
          </DialogHeader>
          <Form {...sectionForm}>
            <form
              onSubmit={sectionForm.handleSubmit((data) =>
                saveSectionMutation.mutate({ ...data, id: sectionDialog.editing?.id, chapterId: sectionDialog.chapterId! })
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <FormField control={sectionForm.control} name="sectionNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number</FormLabel>
                    <FormControl><Input {...field} placeholder="1.1" /></FormControl>
                  </FormItem>
                )} />
                <div className="col-span-2">
                  <FormField control={sectionForm.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input {...field} placeholder="Section title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              <FormField control={sectionForm.control} name="subjectTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Tag</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={sectionForm.control} name="nclexCategoryTag" render={({ field }) => (
                <FormItem>
                  <FormLabel>NCLEX Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NCLEX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={sectionForm.control} name="pageStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Start</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={sectionForm.control} name="pageEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page End</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSectionDialog({ open: false, chapterId: null, editing: null })}>Cancel</Button>
                <Button type="submit" disabled={saveSectionMutation.isPending}>
                  {saveSectionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ==================== BULK IMPORT DIALOG ==================== */}
      <Dialog open={bulkDialog.open} onOpenChange={(open) => setBulkDialog({ open, textbookId: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Chapters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste a JSON array of chapters. Each item needs <code className="bg-muted px-1 rounded">chapterNumber</code> and <code className="bg-muted px-1 rounded">title</code>. Optionally include <code className="bg-muted px-1 rounded">subjectTag</code>, <code className="bg-muted px-1 rounded">nclexCategoryTag</code>, <code className="bg-muted px-1 rounded">pageStart</code>, <code className="bg-muted px-1 rounded">pageEnd</code>.
            </p>
            <Form {...bulkForm}>
              <form
                onSubmit={bulkForm.handleSubmit((data) => {
                  try {
                    const parsed: unknown = JSON.parse(data.chaptersJson);
                    if (!Array.isArray(parsed)) throw new Error("Must be a JSON array");
                    bulkImportMutation.mutate({ textbookId: bulkDialog.textbookId!, chapters: parsed });
                  } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : "Invalid JSON";
                    toast({ title: "Invalid JSON", description: message, variant: "destructive" });
                  }
                })}
                className="space-y-4"
              >
                <FormField control={bulkForm.control} name="chaptersJson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>JSON Array</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={10}
                        placeholder={`[\n  { "chapterNumber": "1", "title": "Introduction to Nursing", "subjectTag": "Fundamentals" },\n  { "chapterNumber": "2", "title": "Communication", "pageStart": 45 }\n]`}
                        className="font-mono text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBulkDialog({ open: false, textbookId: null })}>Cancel</Button>
                  <Button type="submit" disabled={bulkImportMutation.isPending}>
                    {bulkImportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== MAPPING DIALOG ==================== */}
      <Dialog
        open={mappingDialog.open}
        onOpenChange={(open) => {
          setMappingDialog({ open, topicId: null, topicName: null, contentAreaId: null });
          if (!open) { setSelectedChapterForSection(null); setSectionSearch(""); setChapterSearch(""); }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Chapter / Section Mapping</DialogTitle>
            {mappingDialog.topicName && (
              <p className="text-sm text-muted-foreground mt-1">
                Linking to: <strong>{mappingDialog.topicName}</strong>
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Step 1: Select chapter */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Step 1 — Select a Chapter
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search chapters by title, textbook, or subject..."
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/20">
                {allChapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {textbooks.length === 0 ? "Add textbooks and chapters first" : "No chapters found"}
                  </p>
                ) : (
                  allChapters.map((ch) => (
                    <div
                      key={ch.id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedChapterForSection?.id === ch.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}
                      onClick={() => { setSelectedChapterForSection(ch); setSectionSearch(""); }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Ch. {ch.chapterNumber} — {ch.title}</p>
                        <p className="text-xs text-muted-foreground">{ch.textbookTitle}{ch.textbookPublisher ? ` (${ch.textbookPublisher})` : ""}</p>
                        <div className="flex gap-1 mt-0.5">
                          {ch.subjectTag && <Badge variant="outline" className="text-xs">{ch.subjectTag}</Badge>}
                          {ch.nclexCategoryTag && <Badge variant="secondary" className="text-xs">{ch.nclexCategoryTag}</Badge>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={selectedChapterForSection?.id === ch.id ? "default" : "outline"}
                        className="ml-3 shrink-0"
                        disabled={addMappingMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          addMappingMutation.mutate({
                            chapterId: ch.id,
                            nursingTopicId: mappingDialog.topicId ?? undefined,
                            contentAreaId: mappingDialog.contentAreaId ?? undefined,
                            subject: ch.subjectTag ?? undefined,
                          });
                        }}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Map Chapter
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Step 2: Optionally map to a specific section */}
            {selectedChapterForSection && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Step 2 (optional) — Map to a Specific Section of Ch. {selectedChapterForSection.chapterNumber}
                </p>
                {chapterSections.length === 0 ? (
                  <p className="text-xs text-muted-foreground border rounded p-3">This chapter has no sections yet. You can map at the chapter level (Step 1) or add sections first in the Textbook Manager.</p>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Filter sections..."
                        value={sectionSearch}
                        onChange={(e) => setSectionSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/20">
                      {filteredChapterSections.map((section) => (
                        <div key={section.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{section.sectionNumber ? `${section.sectionNumber} — ` : ""}{section.title}</p>
                            {section.pageStart != null && <p className="text-xs text-muted-foreground">p. {section.pageStart}</p>}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-3 shrink-0"
                            disabled={addMappingMutation.isPending}
                            onClick={() =>
                              addMappingMutation.mutate({
                                chapterId: selectedChapterForSection.id,
                                sectionId: section.id,
                                nursingTopicId: mappingDialog.topicId ?? undefined,
                                contentAreaId: mappingDialog.contentAreaId ?? undefined,
                                subject: section.subjectTag ?? selectedChapterForSection.subjectTag ?? undefined,
                              })
                            }
                          >
                            <Indent className="h-3 w-3 mr-1" />
                            Map Section
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setMappingDialog({ open: false, topicId: null, topicName: null, contentAreaId: null });
              setSelectedChapterForSection(null);
              setSectionSearch("");
              setChapterSearch("");
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
