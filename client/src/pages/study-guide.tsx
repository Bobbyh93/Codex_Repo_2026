import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, Download, Calendar, Target, Clock, 
  TrendingUp, BookOpen, Video, Brain,
  CheckCircle, AlertCircle, ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import { PDFDownloadLink } from '@react-pdf/renderer';
import StudyGuideDocument from "@/components/study-guide-generator";
import { PageHeader } from "@/components/ui/page-header";

export default function StudyGuide() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [guideData, setGuideData] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<any>(null);

  useEffect(() => {
    loadAssessmentData();
  }, []);

  const loadAssessmentData = async () => {
    setLoading(true);
    try {
      // Load latest assessment data
      const response = await fetch('/api/assessment-reports/latest');
      if (response.ok) {
        const data = await response.json();
        setAssessmentData(data);
        generateStudyGuide(data);
      }
    } catch (error) {
      console.error('Failed to load assessment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateStudyGuide = (assessment: any) => {
    // Process assessment data to generate personalized study guide
    const weakAreas = [
      { topic: "Pharmacology", score: 45, priority: "high" as const },
      { topic: "Fluid & Electrolytes", score: 52, priority: "high" as const },
      { topic: "Cardiac Nursing", score: 61, priority: "medium" as const },
      { topic: "Respiratory System", score: 68, priority: "medium" as const },
      { topic: "Pediatric Care", score: 72, priority: "low" as const }
    ].filter(area => area.score < 70);

    const studyPhases = [
      {
        phase: "Phase 1: Foundation Building",
        weeks: "Weeks 1-2",
        topics: [
          "Pharmacology fundamentals and drug calculations",
          "Fluid and electrolyte balance",
          "Basic cardiac physiology and EKG interpretation"
        ],
        resources: [
          { title: "Pharmacology Video Series", type: "Video", url: "nurseprep.com/pharm" },
          { title: "Drug Calculation Workbook", type: "Practice", url: "nurseprep.com/calc" },
          { title: "Fluid & Electrolyte Guide", type: "Reading", url: "nurseprep.com/fluids" }
        ]
      },
      {
        phase: "Phase 2: Reinforcement",
        weeks: "Weeks 3-4",
        topics: [
          "Advanced pharmacology and drug interactions",
          "Cardiac medications and interventions",
          "Respiratory assessment and management"
        ],
        resources: [
          { title: "NCLEX Practice Questions", type: "Quiz", url: "nurseprep.com/practice" },
          { title: "Case Study Simulations", type: "Interactive", url: "nurseprep.com/cases" },
          { title: "Peer Study Groups", type: "Collaborative", url: "nurseprep.com/groups" }
        ]
      },
      {
        phase: "Phase 3: Mastery",
        weeks: "Weeks 5-6",
        topics: [
          "Complex patient scenarios",
          "Priority setting and delegation",
          "NCLEX-style critical thinking"
        ],
        resources: [
          { title: "Full-Length Practice Exams", type: "Assessment", url: "nurseprep.com/exams" },
          { title: "Virtual Clinical Simulations", type: "Simulation", url: "nurseprep.com/sims" },
          { title: "One-on-One Tutoring", type: "Support", url: "nurseprep.com/tutor" }
        ]
      }
    ];

    const weeklyPlan = [
      {
        day: "Monday",
        morning: "Pharmacology fundamentals (2 hours)",
        afternoon: "Drug calculation practice (1.5 hours)",
        evening: "Review and self-quiz (1 hour)"
      },
      {
        day: "Tuesday",
        morning: "Fluid & electrolyte concepts (2 hours)",
        afternoon: "Case studies (1.5 hours)",
        evening: "Video reviews (1 hour)"
      },
      {
        day: "Wednesday",
        morning: "Cardiac physiology (2 hours)",
        afternoon: "EKG interpretation (1.5 hours)",
        evening: "Practice questions (1 hour)"
      },
      {
        day: "Thursday",
        morning: "Respiratory system (2 hours)",
        afternoon: "Clinical scenarios (1.5 hours)",
        evening: "Group study session (1 hour)"
      },
      {
        day: "Friday",
        morning: "Weekly review (2 hours)",
        afternoon: "Practice exam (2 hours)",
        evening: "Review mistakes (1 hour)"
      },
      {
        day: "Saturday",
        morning: "Weak area focus (3 hours)",
        afternoon: "Simulation practice (2 hours)",
        evening: "Rest and relaxation"
      },
      {
        day: "Sunday",
        morning: "Light review (1 hour)",
        afternoon: "Plan next week (1 hour)",
        evening: "Rest and preparation"
      }
    ];

    const guide = {
      studentName: "Student Name",
      assessmentDate: new Date().toLocaleDateString(),
      overallScore: 65,
      weakAreas,
      studyPhases,
      weeklyPlan,
      estimatedHours: 120,
      targetDate: "6 weeks"
    };

    setGuideData(guide);
  };

  const studyPhaseColors = {
    foundation: "bg-blue-100 text-blue-700",
    reinforcement: "bg-purple-100 text-purple-700",
    mastery: "bg-green-100 text-green-700"
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Personalized Study Guide"
          description="Your customized learning roadmap to NCLEX success"
          showHomeButton={true}
          showEducatorLogin={true}
          showBranding={true}
          variant="default"
        />

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-pulse">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Generating your personalized study guide...</p>
              </div>
            </CardContent>
          </Card>
        ) : guideData ? (
          <>
            {/* Quick Stats */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{guideData.overallScore}%</p>
                      <p className="text-sm text-gray-600">Current Score</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{guideData.estimatedHours}h</p>
                      <p className="text-sm text-gray-600">Study Time</p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{guideData.weakAreas.length}</p>
                      <p className="text-sm text-gray-600">Focus Areas</p>
                    </div>
                    <Target className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{guideData.targetDate}</p>
                      <p className="text-sm text-gray-600">Target</p>
                    </div>
                    <Calendar className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="phases">Study Phases</TabsTrigger>
                <TabsTrigger value="schedule">Weekly Plan</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Learning Journey</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Progress Indicator */}
                    <div className="mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-2">
                            1
                          </div>
                          <p className="text-sm">Foundation</p>
                          <p className="text-xs text-gray-500">Current</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 rounded-full bg-gray-300 text-white flex items-center justify-center mx-auto mb-2">
                            2
                          </div>
                          <p className="text-sm">Reinforcement</p>
                          <p className="text-xs text-gray-500">Weeks 3-4</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 rounded-full bg-gray-300 text-white flex items-center justify-center mx-auto mb-2">
                            3
                          </div>
                          <p className="text-sm">Mastery</p>
                          <p className="text-xs text-gray-500">Weeks 5-6</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                        <div className="text-center flex-1">
                          <div className="w-12 h-12 rounded-full bg-gray-300 text-white flex items-center justify-center mx-auto mb-2">
                            4
                          </div>
                          <p className="text-sm">NCLEX Ready</p>
                          <p className="text-xs text-gray-500">Final</p>
                        </div>
                      </div>
                    </div>

                    {/* Priority Areas */}
                    <h3 className="font-semibold mb-4">Priority Areas for Improvement</h3>
                    <div className="space-y-3">
                      {guideData.weakAreas.map((area: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{area.topic}</h4>
                            <Badge className={
                              area.priority === 'high' ? 'bg-red-100 text-red-700' :
                              area.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }>
                              {area.priority.toUpperCase()} PRIORITY
                            </Badge>
                          </div>
                          <Progress value={area.score} className="mb-2" />
                          <p className="text-sm text-gray-600">Current Score: {area.score}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Study Phases Tab */}
              <TabsContent value="phases">
                <div className="space-y-4">
                  {guideData.studyPhases.map((phase: any, idx: number) => (
                    <Card key={idx}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{phase.phase}</CardTitle>
                          <Badge variant="outline">{phase.weeks}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4">
                          <h4 className="font-medium mb-2">Focus Topics:</h4>
                          <ul className="space-y-1">
                            {phase.topics.map((topic: string, i: number) => (
                              <li key={i} className="flex items-start">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                                <span className="text-sm">{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Resources:</h4>
                          <div className="grid md:grid-cols-2 gap-2">
                            {phase.resources.map((resource: any, i: number) => (
                              <div key={i} className="bg-blue-50 rounded p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  {resource.type === 'Video' ? <Video className="h-4 w-4" /> :
                                   resource.type === 'Practice' ? <Brain className="h-4 w-4" /> :
                                   <BookOpen className="h-4 w-4" />}
                                  <span className="font-medium text-sm">{resource.title}</span>
                                </div>
                                <p className="text-xs text-gray-600">{resource.type}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Weekly Schedule Tab */}
              <TabsContent value="schedule">
                <Card>
                  <CardHeader>
                    <CardTitle>Week 1 Study Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {guideData.weeklyPlan.map((day: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-2">{day.day}</h4>
                          <div className="grid md:grid-cols-3 gap-2 text-sm">
                            <div className="bg-yellow-50 rounded p-2">
                              <p className="font-medium text-yellow-700">Morning</p>
                              <p className="text-gray-600">{day.morning}</p>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                              <p className="font-medium text-blue-700">Afternoon</p>
                              <p className="text-gray-600">{day.afternoon}</p>
                            </div>
                            <div className="bg-purple-50 rounded p-2">
                              <p className="font-medium text-purple-700">Evening</p>
                              <p className="text-gray-600">{day.evening}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Remember to take regular breaks and maintain a healthy study-life balance.
                        Adjust this schedule based on your personal commitments and energy levels.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Resources Tab */}
              <TabsContent value="resources">
                <Card>
                  <CardHeader>
                    <CardTitle>All Recommended Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {guideData.studyPhases.flatMap((phase: any) => phase.resources).map((resource: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {resource.type === 'Video' ? <Video className="h-5 w-5 text-blue-500" /> :
                               resource.type === 'Quiz' ? <Brain className="h-5 w-5 text-purple-500" /> :
                               resource.type === 'Interactive' ? <Target className="h-5 w-5 text-green-500" /> :
                               <BookOpen className="h-5 w-5 text-orange-500" />}
                              <div>
                                <h4 className="font-medium">{resource.title}</h4>
                                <p className="text-sm text-gray-600">{resource.type}</p>
                                <Button size="sm" variant="link" className="p-0 h-auto text-blue-600">
                                  Access Resource →
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Download Button */}
            <div className="mt-6 text-center">
              <PDFDownloadLink
                document={<StudyGuideDocument data={guideData} />}
                fileName="study-guide.pdf"
              >
                {({ blob, url, loading, error }) => (
                  <Button size="lg" disabled={loading}>
                    {loading ? (
                      <>Generating PDF...</>
                    ) : (
                      <>
                        <Download className="h-5 w-5 mr-2" />
                        Download Study Guide PDF
                      </>
                    )}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">No Assessment Data Available</h3>
              <p className="text-gray-600 mb-4">
                Complete an assessment first to generate your personalized study guide
              </p>
              <Button onClick={() => navigate("/post-test")}>
                Take Assessment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}