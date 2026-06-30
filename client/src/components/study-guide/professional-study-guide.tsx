import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Video, 
  BookOpen, 
  Target, 
  Clock, 
  Award, 
  CheckCircle, 
  ArrowRight,
  Download,
  Eye,
  Brain,
  Stethoscope,
  TrendingUp,
  Users,
  AlertTriangle,
  Lightbulb,
  PlayCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface ProfessionalStudyGuideProps {
  reportId: string;
  mode?: 'preview' | 'full';
  onExportPDF?: () => void;
}

// Import the type definitions from the server
type StudyStage = {
  current: 'foundation' | 'application' | 'synthesis' | 'mastery';
  description: string;
  objectives: string[];
  nextStage: string;
};

type ProgressIndicator = {
  stage: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  estimatedCompletion: string;
};

type ResourcePlaceholder = {
  type: 'reading' | 'video' | 'quiz' | 'simulation' | 'external' | 'practice';
  title: string;
  description: string;
  estimatedTime: number;
  difficulty: 'foundation' | 'intermediate' | 'advanced';
  source: string;
  isRequired: boolean;
  topicRelevance: number;
  clinicalRelevance: 'critical' | 'high' | 'medium' | 'low';
};

export function ProfessionalStudyGuide({ reportId, mode = 'preview', onExportPDF }: ProfessionalStudyGuideProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [expandedResources, setExpandedResources] = useState<string[]>([]);

  // Mock data for demonstration - in real implementation, this would fetch from the server
  const studyGuide = {
    title: "NCLEX SUCCESS BLUEPRINT",
    subtitle: "PERSONALIZED STUDY GUIDE",
    studentName: "Nursing Student",
    generatedDate: new Date().toLocaleDateString(),
    progressStage: {
      current: 'foundation' as const,
      description: 'Building fundamental nursing knowledge and basic clinical judgment skills',
      objectives: [
        'Master essential nursing concepts',
        'Develop basic clinical reasoning',
        'Understand foundational care principles'
      ],
      nextStage: 'Application of knowledge in clinical scenarios'
    },
    overview: {
      totalTopics: 5,
      estimatedHours: 8,
      priorityDistribution: { critical: 2, high: 2, medium: 1, low: 0 }
    },
    progressMap: [
      {
        stage: 'foundation',
        title: 'Foundation Building',
        description: 'Master fundamental nursing concepts',
        isCompleted: false,
        isCurrent: true,
        estimatedCompletion: '2-3 weeks'
      },
      {
        stage: 'application',
        title: 'Clinical Application',
        description: 'Apply knowledge to patient scenarios',
        isCompleted: false,
        isCurrent: false,
        estimatedCompletion: '3-4 weeks'
      },
      {
        stage: 'synthesis',
        title: 'Knowledge Synthesis',
        description: 'Integrate complex information',
        isCompleted: false,
        isCurrent: false,
        estimatedCompletion: '4-5 weeks'
      },
      {
        stage: 'mastery',
        title: 'NCLEX Mastery',
        description: 'Demonstrate readiness for practice',
        isCompleted: false,
        isCurrent: false,
        estimatedCompletion: '5-6 weeks'
      }
    ]
  };

  const resourceIcons = {
    reading: BookOpen,
    video: Video,
    quiz: Target,
    simulation: Stethoscope,
    external: ArrowRight,
    practice: Brain
  };

  const difficultyColors = {
    foundation: 'bg-success/10 text-success',
    intermediate: 'bg-warning/10 text-warning',
    advanced: 'bg-priority-high/10 text-priority-high'
  };

  const toggleResourceExpansion = (resourceId: string) => {
    setExpandedResources(prev => 
      prev.includes(resourceId) 
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  if (mode === 'preview') {
    return <StudyGuidePreview studyGuide={studyGuide} onExportPDF={onExportPDF} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section - Professional Format */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto mobile-p-4 py-12 text-center">
          <Badge className="mb-4 bg-primary-foreground/20 text-primary-foreground">
            AI-Powered Analysis
          </Badge>
          <h1 className="text-display mb-4 font-bold">
            {studyGuide.title}
          </h1>
          <p className="text-heading-4 opacity-90 mb-2">
            {studyGuide.subtitle}
          </p>
          <div className="flex justify-center items-center gap-4 text-body-small opacity-75">
            <span>{studyGuide.generatedDate}</span>
          </div>
        </div>
      </div>

      {/* Progress Map - "YOU ARE HERE" Style */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto mobile-p-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-heading-2 mb-2">YOU ARE HERE</h2>
            <p className="text-body text-muted-foreground">
              {studyGuide.progressStage.description}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {studyGuide.progressMap.map((stage, index) => (
              <div 
                key={stage.stage}
                className={cn(
                  "text-center p-4 rounded-lg border-2 transition-all",
                  stage.isCurrent 
                    ? "border-primary bg-primary/5 shadow-lg" 
                    : stage.isCompleted 
                      ? "border-success bg-success/5" 
                      : "border-muted bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-caption-medium",
                  stage.isCurrent 
                    ? "bg-primary text-primary-foreground" 
                    : stage.isCompleted 
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground"
                )}>
                  {stage.isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <h3 className="text-heading-4 mb-1">{stage.title}</h3>
                <p className="text-caption text-muted-foreground mb-2">
                  {stage.description}
                </p>
                <Badge variant="outline" className="text-caption">
                  {stage.estimatedCompletion}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Study Overview */}
      <div className="max-w-4xl mx-auto mobile-p-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="mobile-p-4 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-heading-3 font-bold text-primary">{studyGuide.overview.totalTopics}</div>
              <p className="text-body-small text-muted-foreground">Priority Topics</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="mobile-p-4 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-warning" />
              <div className="text-heading-3 font-bold text-warning">{studyGuide.overview.estimatedHours}h</div>
              <p className="text-body-small text-muted-foreground">Study Time</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="mobile-p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-priority-high" />
              <div className="text-heading-3 font-bold text-priority-high">{studyGuide.overview.priorityDistribution.critical}</div>
              <p className="text-body-small text-muted-foreground">Critical Gaps</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="mobile-p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-success" />
              <div className="text-heading-3 font-bold text-success">85%</div>
              <p className="text-body-small text-muted-foreground">Target Score</p>
            </CardContent>
          </Card>
        </div>

        {/* Study Section Preview */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-heading-2">CRITICAL PRIORITY TOPICS</h2>
                <p className="text-body text-muted-foreground">Master these concepts first for maximum NCLEX impact</p>
              </div>
              <Badge className="bg-priority-high text-priority-high-foreground">
                FOUNDATION STAGE
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="mobile-p-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="topics">Topics</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="clinical">Clinical Judgment</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-heading-3 mb-3">Learning Objectives</h3>
                    <ul className="space-y-2">
                      {studyGuide.progressStage.objectives.map((objective, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 mt-1 text-success" />
                          <span className="text-body">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-heading-3 mb-3">Study Approach</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="border-l-4 border-l-primary">
                        <CardContent className="mobile-p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="h-5 w-5 text-primary" />
                            <h4 className="text-heading-4">Clinical Reasoning</h4>
                          </div>
                          <p className="text-body-small text-muted-foreground">
                            Focus on understanding the 'why' behind nursing actions and developing systematic thinking patterns.
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="border-l-4 border-l-warning">
                        <CardContent className="mobile-p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Stethoscope className="h-5 w-5 text-warning" />
                            <h4 className="text-heading-4">Clinical Application</h4>
                          </div>
                          <p className="text-body-small text-muted-foreground">
                            Practice applying concepts to patient scenarios and real-world nursing situations.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="topics" className="mt-6">
                <div className="space-y-4">
                  {/* Mock topic data */}
                  {[
                    { name: "Medication Administration", priority: 1, gapScore: 75, difficulty: "Intermediate" },
                    { name: "Infection Control", priority: 2, gapScore: 68, difficulty: "Foundation" }
                  ].map((topic, index) => (
                    <Card key={index} className="border-l-4 border-l-priority-high">
                      <CardContent className="mobile-p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-heading-4 mb-1">{topic.name}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-caption">
                                Priority {topic.priority}
                              </Badge>
                              <Badge className={cn("text-caption", difficultyColors[topic.difficulty.toLowerCase() as keyof typeof difficultyColors])}>
                                {topic.difficulty}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-heading-4 text-priority-high">{topic.gapScore}%</div>
                            <p className="text-caption text-muted-foreground">Gap Score</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-body font-medium mb-1">Key Nursing Actions</h5>
                            <ul className="text-body-small text-muted-foreground space-y-1">
                              <li>• Comprehensive assessment protocols</li>
                              <li>• Evidence-based intervention strategies</li>
                              <li>• Patient safety and monitoring procedures</li>
                            </ul>
                          </div>
                          
                          <div className="bg-warning/10 p-3 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                              <div>
                                <h5 className="text-body-small font-medium text-warning">Safety Considerations</h5>
                                <p className="text-caption text-muted-foreground">
                                  Review safety protocols and error prevention strategies specific to this topic area.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="resources" className="mt-6">
                <StudyResourcesSection />
              </TabsContent>
              
              <TabsContent value="clinical" className="mt-6">
                <ClinicalJudgmentSection />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={onExportPDF} className="touch-target">
            <Download className="h-4 w-4 mr-2" />
            Export Full PDF Guide
          </Button>
          <Button variant="outline" className="touch-target">
            <Eye className="h-4 w-4 mr-2" />
            Preview Study Plan
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudyGuidePreview({ studyGuide, onExportPDF }: { studyGuide: any; onExportPDF?: () => void }) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center bg-gradient-to-r from-primary/10 to-primary/5">
        <h2 className="text-heading-2">{studyGuide.title}</h2>
        <p className="text-body text-muted-foreground">{studyGuide.subtitle}</p>
      </CardHeader>
      
      <CardContent className="mobile-p-4">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-heading-3 text-primary">{studyGuide.overview.totalTopics}</div>
              <p className="text-caption text-muted-foreground">Topics</p>
            </div>
            <div>
              <div className="text-heading-3 text-warning">{studyGuide.overview.estimatedHours}h</div>
              <p className="text-caption text-muted-foreground">Study Time</p>
            </div>
            <div>
              <div className="text-heading-3 text-priority-high">{studyGuide.overview.priorityDistribution.critical}</div>
              <p className="text-caption text-muted-foreground">Critical</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-heading-4 mb-3">Your Study Journey</h3>
            <div className="space-y-2">
              {studyGuide.progressMap.slice(0, 2).map((stage: ProgressIndicator, index: number) => (
                <div key={stage.stage} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-caption-medium",
                    stage.isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-body font-medium">{stage.title}</h4>
                    <p className="text-caption text-muted-foreground">{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={onExportPDF} className="w-full touch-target">
              <Download className="h-4 w-4 mr-2" />
              Get Complete Study Guide PDF
            </Button>
            <Button variant="outline" className="w-full touch-target">
              <Eye className="h-4 w-4 mr-2" />
              Preview Interactive Guide
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudyResourcesSection() {
  const sampleResources: ResourcePlaceholder[] = [
    {
      type: 'reading',
      title: 'Core Textbook Chapter - Medication Safety',
      description: 'Fundamental principles of safe medication administration',
      estimatedTime: 45,
      difficulty: 'foundation',
      source: 'Primary Nursing Textbook',
      isRequired: true,
      topicRelevance: 100,
      clinicalRelevance: 'critical'
    },
    {
      type: 'video',
      title: 'Medication Administration Techniques',
      description: 'Visual demonstration of proper medication administration procedures',
      estimatedTime: 25,
      difficulty: 'foundation',
      source: 'Educational Video Library',
      isRequired: true,
      topicRelevance: 95,
      clinicalRelevance: 'critical'
    },
    {
      type: 'quiz',
      title: 'NCLEX-Style Medication Questions',
      description: 'Practice questions with detailed rationales',
      estimatedTime: 30,
      difficulty: 'intermediate',
      source: 'Question Bank',
      isRequired: true,
      topicRelevance: 100,
      clinicalRelevance: 'critical'
    },
    {
      type: 'simulation',
      title: 'Virtual Medication Administration',
      description: 'Interactive patient simulation for medication safety',
      estimatedTime: 60,
      difficulty: 'intermediate',
      source: 'Clinical Simulation Platform',
      isRequired: false,
      topicRelevance: 90,
      clinicalRelevance: 'high'
    }
  ];

  const resourceIcons = {
    reading: BookOpen,
    video: Video,
    quiz: Target,
    simulation: Stethoscope,
    external: ArrowRight,
    practice: Brain
  };

  const difficultyColors = {
    foundation: 'bg-success/10 text-success',
    intermediate: 'bg-warning/10 text-warning',
    advanced: 'bg-priority-high/10 text-priority-high'
  };

  const relevanceColors = {
    critical: 'text-priority-high',
    high: 'text-warning',
    medium: 'text-info',
    low: 'text-muted-foreground'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-heading-3">Learning Resources</h3>
        <Badge variant="outline">
          {sampleResources.filter(r => r.isRequired).length} Required
        </Badge>
      </div>
      
      {sampleResources.map((resource, index) => {
        const IconComponent = resourceIcons[resource.type];
        
        return (
          <Card key={index} className={cn(
            "transition-all hover:shadow-md",
            resource.isRequired ? "border-l-4 border-l-primary" : ""
          )}>
            <CardContent className="mobile-p-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  resource.isRequired ? "bg-primary/10" : "bg-muted/50"
                )}>
                  <IconComponent className={cn(
                    "h-5 w-5",
                    resource.isRequired ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-heading-4 mb-1">{resource.title}</h4>
                      <p className="text-body-small text-muted-foreground mb-2">
                        {resource.description}
                      </p>
                    </div>
                    {resource.isRequired && (
                      <Badge className="bg-primary/10 text-primary">
                        Required
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-caption text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{resource.estimatedTime} min</span>
                    </div>
                    <Badge className={cn("text-caption", difficultyColors[resource.difficulty])}>
                      {resource.difficulty}
                    </Badge>
                    <span className={relevanceColors[resource.clinicalRelevance]}>
                      {resource.clinicalRelevance} relevance
                    </span>
                    <div className="ml-auto">
                      <Progress value={resource.topicRelevance} className="w-16 h-2" />
                      <span className="text-caption">{resource.topicRelevance}% match</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-muted/50">
                    <p className="text-caption text-muted-foreground">
                      Source: {resource.source}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      <Card className="bg-info/5 border-info/20">
        <CardContent className="mobile-p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 mt-0.5 text-info" />
            <div>
              <h4 className="text-heading-4 text-info mb-1">Study Tip</h4>
              <p className="text-body-small text-muted-foreground">
                Complete required resources in order. Use supplemental materials to reinforce concepts you find challenging.
                Practice questions should be completed after reviewing content for better retention.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClinicalJudgmentSection() {
  const clinicalSteps = [
    {
      step: 'Recognize Cues',
      description: 'Identify relevant patient data and environmental factors',
      application: 'What patient information is most important?',
      examples: ['Vital sign changes', 'Patient complaints', 'Physical findings']
    },
    {
      step: 'Analyze Cues',
      description: 'Interpret the significance of identified data',
      application: 'What do these findings mean for the patient?',
      examples: ['Pattern recognition', 'Data relationships', 'Clinical significance']
    },
    {
      step: 'Prioritize Hypotheses',
      description: 'Rank potential problems by urgency',
      application: 'What needs immediate attention?',
      examples: ['ABC priority', 'Life-threatening vs. non-urgent', 'Patient safety']
    },
    {
      step: 'Generate Solutions',
      description: 'Develop evidence-based interventions',
      application: 'What nursing actions are most appropriate?',
      examples: ['Nursing interventions', 'Collaborative care', 'Patient education']
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-heading-3 mb-2">NCSBN Clinical Judgment Model</h3>
        <p className="text-body text-muted-foreground">
          Framework for developing clinical reasoning skills essential for safe nursing practice
        </p>
      </div>
      
      <div className="grid gap-4">
        {clinicalSteps.map((step, index) => (
          <Card key={index} className="border-l-4 border-l-info">
            <CardContent className="mobile-p-4">
              <div className="flex items-start gap-4">
                <div className="bg-info/10 text-info rounded-full p-2 text-caption-medium font-bold min-w-[2rem] h-8 flex items-center justify-center">
                  {index + 1}
                </div>
                
                <div className="flex-1">
                  <h4 className="text-heading-4 mb-2">{step.step}</h4>
                  <p className="text-body text-muted-foreground mb-3">
                    {step.description}
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-body font-medium text-info mb-1">Key Question</h5>
                      <p className="text-body-small italic">"{step.application}"</p>
                    </div>
                    
                    <div>
                      <h5 className="text-body font-medium mb-2">Examples</h5>
                      <ul className="space-y-1">
                        {step.examples.map((example, exIndex) => (
                          <li key={exIndex} className="flex items-center gap-2 text-body-small">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="bg-success/5 border-success/20">
        <CardContent className="mobile-p-4">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 mt-0.5 text-success" />
            <div>
              <h4 className="text-heading-4 text-success mb-2">Practice Framework</h4>
              <p className="text-body-small text-muted-foreground mb-3">
                Use this systematic approach when studying clinical scenarios and answering NCLEX questions.
              </p>
              <div className="grid md:grid-cols-2 gap-3 text-body-small">
                <div>
                  <h5 className="font-medium mb-1">Study Questions</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• What cues are present?</li>
                    <li>• What do they mean?</li>
                    <li>• What's most important?</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium mb-1">Action Planning</h5>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• What should I do first?</li>
                    <li>• How will I evaluate success?</li>
                    <li>• What might need adjustment?</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}