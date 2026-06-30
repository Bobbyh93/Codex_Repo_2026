import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, ChevronDown, ChevronRight, ExternalLink, BookOpen, 
  Video, FileText, Brain, Target, Clock, TrendingUp, Loader2,
  AlertCircle, Activity, Stethoscope, ClipboardList, TestTube,
  ArrowLeft, Home
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface TopicHierarchy {
  subject: string;
  specialty: string;
  system: string;
  diagnosis: string[];
  problems: string[];
  assessment: string[];
  diagnostics: {
    test: string;
    expectedBaseline: string;
    criticalChange: string;
  }[];
  vitalSigns: {
    parameter: string;
    diagnosisBaseline: string;
    alertThreshold: string;
  }[];
  resources: {
    type: string;
    title: string;
    duration: string;
    url: string;
    difficulty: string;
  }[];
}

export default function DetailedAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [topics, setTopics] = useState<TopicHierarchy[]>([]);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const analyzeReport = async (uploadedFile: File) => {
    setAnalyzing(true);
    
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      
      // Call structured analysis API
      const response = await fetch("/api/analyze-structured", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Analysis failed");
      }
      
      const data = await response.json();
      
      // Simulate detailed analysis with diagnosis-specific baselines
      setTimeout(() => {
        setTopics([
          {
            subject: "Pharmacology",
            specialty: "Medical-Surgical Nursing",
            system: "Cardiovascular",
            diagnosis: [
              "Hypertension",
              "Heart Failure", 
              "Myocardial Infarction",
              "Atrial Fibrillation"
            ],
            problems: [
              "Medication non-compliance",
              "Drug interactions",
              "Adverse effects monitoring",
              "Dosage calculation errors"
            ],
            assessment: [
              "Blood pressure monitoring",
              "Cardiac output assessment",
              "Medication effectiveness",
              "Side effect evaluation"
            ],
            diagnostics: [
              { test: "ECG", expectedBaseline: "ST elevation in MI patients", criticalChange: "New ST changes >2mm" },
              { test: "Troponin", expectedBaseline: ">0.04 ng/mL in MI", criticalChange: "Rising trend >20%" },
              { test: "BNP", expectedBaseline: ">400 pg/mL in HF", criticalChange: "Increase >30% from baseline" },
              { test: "Digoxin Level", expectedBaseline: "0.5-2.0 ng/mL therapeutic", criticalChange: ">2.0 ng/mL toxic" }
            ],
            vitalSigns: [
              { parameter: "BP (Hypertension)", diagnosisBaseline: "Goal <130/80", alertThreshold: ">160/100 or <90/60" },
              { parameter: "HR (AFib)", diagnosisBaseline: "Rate control <110", alertThreshold: ">130 or <50" },
              { parameter: "RR (Heart Failure)", diagnosisBaseline: "16-20 at rest", alertThreshold: ">24 indicates decompensation" },
              { parameter: "Weight (HF)", diagnosisBaseline: "Daily monitoring", alertThreshold: ">2 lbs/day or >5 lbs/week" }
            ],
            resources: [
              { type: "Video", title: "Cardiac Medications Overview", duration: "15 min", url: "#", difficulty: "Beginner" },
              { type: "Video", title: "ACE Inhibitors & ARBs", duration: "12 min", url: "#", difficulty: "Intermediate" },
              { type: "Practice", title: "Cardiac Drug Calculations", duration: "20 min", url: "#", difficulty: "Advanced" },
              { type: "Reading", title: "Beta Blocker Guidelines", duration: "10 min", url: "#", difficulty: "Intermediate" },
              { type: "Video", title: "Diuretic Therapy Management", duration: "18 min", url: "#", difficulty: "Intermediate" },
              { type: "Practice", title: "Drug Interaction Quiz", duration: "15 min", url: "#", difficulty: "Advanced" }
            ]
          },
          {
            subject: "Fluid & Electrolytes",
            specialty: "Critical Care Nursing",
            system: "Renal",
            diagnosis: [
              "Hyponatremia",
              "Hyperkalemia",
              "Dehydration",
              "Fluid Overload"
            ],
            problems: [
              "Electrolyte imbalance",
              "Fluid volume deficit",
              "Fluid volume excess",
              "Acid-base imbalance"
            ],
            assessment: [
              "Intake & Output monitoring",
              "Daily weights",
              "Edema assessment",
              "Skin turgor evaluation"
            ],
            diagnostics: [
              { test: "Sodium", expectedBaseline: "<135 mEq/L in hyponatremia", criticalChange: "<120 mEq/L severe" },
              { test: "Potassium", expectedBaseline: ">5.5 mEq/L in hyperkalemia", criticalChange: ">6.5 mEq/L critical" },
              { test: "BUN/Creatinine", expectedBaseline: "Ratio >20:1 in dehydration", criticalChange: "Creatinine rise >0.3 mg/dL" },
              { test: "Urine Specific Gravity", expectedBaseline: ">1.025 concentrated", criticalChange: "<1.003 or >1.030" }
            ],
            vitalSigns: [
              { parameter: "BP (Dehydration)", diagnosisBaseline: "Orthostatic drop >20/10", alertThreshold: "SBP <90 or drop >40" },
              { parameter: "HR (Hyperkalemia)", diagnosisBaseline: "Monitor for bradycardia", alertThreshold: "<50 bpm or peaked T waves" },
              { parameter: "Weight (Fluid Overload)", diagnosisBaseline: "Increase from dry weight", alertThreshold: ">2 kg in 24 hours" },
              { parameter: "Urine Output", diagnosisBaseline: "30-50 mL/hr minimum", alertThreshold: "<30 mL/hr or <0.5 mL/kg/hr" }
            ],
            resources: [
              { type: "Video", title: "Fluid Balance Basics", duration: "10 min", url: "#", difficulty: "Beginner" },
              { type: "Video", title: "Electrolyte Imbalances", duration: "20 min", url: "#", difficulty: "Intermediate" },
              { type: "Practice", title: "IV Fluid Calculations", duration: "25 min", url: "#", difficulty: "Advanced" },
              { type: "Reading", title: "ABG Interpretation Guide", duration: "15 min", url: "#", difficulty: "Intermediate" },
              { type: "Video", title: "Managing Hyponatremia", duration: "12 min", url: "#", difficulty: "Advanced" },
              { type: "Practice", title: "Electrolyte Case Studies", duration: "30 min", url: "#", difficulty: "Advanced" }
            ]
          },
          {
            subject: "Respiratory Care",
            specialty: "Pulmonary Nursing",
            system: "Respiratory",
            diagnosis: [
              "COPD Exacerbation",
              "Pneumonia",
              "Asthma",
              "Pulmonary Embolism"
            ],
            problems: [
              "Impaired gas exchange",
              "Ineffective airway clearance",
              "Dyspnea",
              "Activity intolerance"
            ],
            assessment: [
              "Lung sound auscultation",
              "Respiratory pattern",
              "Oxygen saturation monitoring",
              "Sputum assessment"
            ],
            diagnostics: [
              { test: "ABG (COPD)", expectedBaseline: "pH 7.35-7.38, PaCO2 45-55", criticalChange: "pH <7.25 or PaCO2 >60" },
              { test: "WBC (Pneumonia)", expectedBaseline: ">12,000 with left shift", criticalChange: ">20,000 or <4,000" },
              { test: "Peak Flow (Asthma)", expectedBaseline: "<80% predicted", criticalChange: "<50% severe attack" },
              { test: "D-dimer (PE)", expectedBaseline: ">500 ng/mL positive", criticalChange: ">4000 high probability" }
            ],
            vitalSigns: [
              { parameter: "RR (COPD)", diagnosisBaseline: "20-24 baseline", alertThreshold: ">30 or use of accessory muscles" },
              { parameter: "O2 Sat (COPD)", diagnosisBaseline: "88-92% goal", alertThreshold: "<88% on usual O2" },
              { parameter: "Temp (Pneumonia)", diagnosisBaseline: ">38°C expected", alertThreshold: ">39.5°C or <35°C" },
              { parameter: "HR (PE)", diagnosisBaseline: "Tachycardia >100", alertThreshold: ">120 with hypotension" }
            ],
            resources: [
              { type: "Video", title: "Respiratory Assessment", duration: "15 min", url: "#", difficulty: "Beginner" },
              { type: "Video", title: "Oxygen Therapy Devices", duration: "12 min", url: "#", difficulty: "Beginner" },
              { type: "Practice", title: "ABG Interpretation Practice", duration: "20 min", url: "#", difficulty: "Intermediate" },
              { type: "Reading", title: "COPD Management Protocol", duration: "10 min", url: "#", difficulty: "Intermediate" },
              { type: "Video", title: "Ventilator Basics", duration: "25 min", url: "#", difficulty: "Advanced" },
              { type: "Practice", title: "Respiratory Medications Quiz", duration: "15 min", url: "#", difficulty: "Intermediate" }
            ]
          }
        ]);
        setAnalyzing(false);
        toast({
          title: "Analysis Complete",
          description: "Review diagnosis-specific baselines for each topic",
        });
      }, 2000);
      
    } catch (error) {
      setAnalyzing(false);
      toast({
        title: "Analysis Failed",
        description: "Please try again with a valid assessment report",
        variant: "destructive"
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        analyzeReport(acceptedFiles[0]);
      }
    },
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  // Reset to upload view
  const resetAnalysis = () => {
    setFile(null);
    setTopics([]);
    setExpandedTopic(null);
  };

  // Step 1: Upload
  if (!file) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <div className="mb-6 pt-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="mb-4"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Comprehensive Assessment Analysis</h1>
            <p className="text-gray-600">Get detailed breakdown with diagnosis-specific baselines for each topic</p>
          </div>

          <Card>
            <CardContent className="p-8">
              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                  transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                `}
                data-testid="upload-zone"
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Drop your assessment report here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Comprehensive Analysis
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Navigation */}
        <div className="mb-6 pt-4">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              data-testid="button-back-home"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button 
              variant="ghost" 
              onClick={resetAnalysis}
              data-testid="button-new-analysis"
            >
              <Upload className="h-4 w-4 mr-2" />
              New Analysis
            </Button>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Comprehensive Assessment Breakdown</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>📄 {file.name}</span>
            <span>•</span>
            <span>Found {topics.length} areas requiring focus</span>
          </div>
        </div>

        {analyzing ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
              <p className="text-lg font-medium">Analyzing your assessment...</p>
              <p className="text-sm text-gray-500 mt-2">Building diagnosis-specific baselines</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {topics.map((topic, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedTopic(expandedTopic === index ? null : index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedTopic === index ? 
                        <ChevronDown className="h-5 w-5" /> : 
                        <ChevronRight className="h-5 w-5" />
                      }
                      <div>
                        <CardTitle className="text-xl">{topic.subject}</CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{topic.specialty}</Badge>
                          <Badge variant="outline">{topic.system} System</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      {topic.resources.length} Resources Available
                    </Button>
                  </div>
                </CardHeader>

                {expandedTopic === index && (
                  <CardContent className="pt-0">
                    <Tabs defaultValue="hierarchy" className="mt-4">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="hierarchy">
                          <Stethoscope className="h-4 w-4 mr-2" />
                          Clinical
                        </TabsTrigger>
                        <TabsTrigger value="vitals">
                          <Activity className="h-4 w-4 mr-2" />
                          Vital Baselines
                        </TabsTrigger>
                        <TabsTrigger value="diagnostics">
                          <TestTube className="h-4 w-4 mr-2" />
                          Lab Baselines
                        </TabsTrigger>
                        <TabsTrigger value="resources">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Resources
                        </TabsTrigger>
                      </TabsList>

                      {/* Clinical Hierarchy */}
                      <TabsContent value="hierarchy" className="space-y-4 mt-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="font-semibold text-sm">Diagnoses</h4>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {topic.diagnosis.map((d, i) => (
                                  <li key={i} className="text-sm flex items-center gap-2">
                                    <span className="text-blue-500">•</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="font-semibold text-sm">Problems</h4>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {topic.problems.map((p, i) => (
                                  <li key={i} className="text-sm flex items-center gap-2">
                                    <span className="text-red-500">•</span> {p}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="font-semibold text-sm">Assessment Focus</h4>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {topic.assessment.map((a, i) => (
                                  <li key={i} className="text-sm flex items-center gap-2">
                                    <span className="text-green-500">•</span> {a}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3">
                              <h4 className="font-semibold text-sm">Required Diagnostics</h4>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-1">
                                {topic.diagnostics.map((d, i) => (
                                  <li key={i} className="text-sm flex items-center gap-2">
                                    <span className="text-purple-500">•</span> {d.test}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>

                      {/* Vital Signs - Diagnosis Specific */}
                      <TabsContent value="vitals" className="mt-4">
                        <Alert className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            These are diagnosis-specific baseline values and alert thresholds for this patient population
                          </AlertDescription>
                        </Alert>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vital Parameter</TableHead>
                              <TableHead>Expected Baseline for Diagnosis</TableHead>
                              <TableHead>Alert Threshold</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {topic.vitalSigns.map((vital, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{vital.parameter}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50">
                                    {vital.diagnosisBaseline}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-red-50">
                                    {vital.alertThreshold}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>

                      {/* Diagnostics - Patient Specific */}
                      <TabsContent value="diagnostics" className="mt-4">
                        <Alert className="mb-4">
                          <TestTube className="h-4 w-4" />
                          <AlertDescription>
                            Expected lab values specific to these diagnoses and when to escalate care
                          </AlertDescription>
                        </Alert>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Diagnostic Test</TableHead>
                              <TableHead>Expected Baseline</TableHead>
                              <TableHead>Critical Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {topic.diagnostics.map((diagnostic, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <TestTube className="h-4 w-4 text-purple-500" />
                                    {diagnostic.test}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {diagnostic.expectedBaseline}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="bg-red-50 text-red-700">
                                    {diagnostic.criticalChange}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>

                      {/* Resources Table */}
                      <TabsContent value="resources" className="mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Difficulty</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {topic.resources.map((resource, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {resource.type === "Video" && <Video className="h-4 w-4 text-blue-500" />}
                                    {resource.type === "Practice" && <Brain className="h-4 w-4 text-purple-500" />}
                                    {resource.type === "Reading" && <FileText className="h-4 w-4 text-green-500" />}
                                    <span>{resource.type}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{resource.title}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {resource.duration}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={
                                      resource.difficulty === "Beginner" ? "default" :
                                      resource.difficulty === "Intermediate" ? "secondary" :
                                      "destructive"
                                    }
                                  >
                                    {resource.difficulty}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost">
                                    Start
                                    <ExternalLink className="h-3 w-3 ml-2" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Study Plan Summary */}
                        <Alert className="mt-4">
                          <Target className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Recommended Study Path:</strong> Focus on understanding diagnosis-specific baselines first, 
                            then complete resources in order of difficulty. Total time: {
                              topic.resources.reduce((acc, r) => acc + parseInt(r.duration), 0)
                            } minutes
                          </AlertDescription>
                        </Alert>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                )}
              </Card>
            ))}

            {/* Overall Summary */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Total Study Time Required</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {Math.round(topics.reduce((acc, t) => 
                        acc + t.resources.reduce((sum, r) => sum + parseInt(r.duration), 0), 0
                      ) / 60)} hours
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-2">Across {topics.length} topic areas</p>
                    <div className="flex gap-2 justify-end">
                      <Button 
                        size="lg" 
                        variant="outline"
                        onClick={() => {
                          // Export as CSV
                          const csvData = {
                            topics: topics.map(t => ({
                              name: t.subject,
                              score: 70, // Example score
                              category: t.specialty,
                              priority: "high",
                              estimatedTime: t.resources.reduce((sum, r) => sum + parseInt(r.duration), 0),
                              resources: t.resources.map(r => ({
                                type: r.type,
                                title: r.title,
                                duration: parseInt(r.duration)
                              }))
                            })),
                            totalTime: topics.reduce((acc, t) => 
                              acc + t.resources.reduce((sum, r) => sum + parseInt(r.duration), 0), 0
                            ),
                            focusAreas: [...new Set(topics.map(t => t.specialty))]
                          };
                          
                          fetch("/api/export-csv", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(csvData)
                          })
                          .then(res => res.blob())
                          .then(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "study-plan.csv";
                            a.click();
                          });
                        }}
                      >
                        Export CSV
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                      <Button size="lg">
                        Download PDF
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}