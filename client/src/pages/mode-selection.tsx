import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, ArrowRight, Target, CheckCircle, Shield } from "lucide-react";
import { useLocation } from "wouter";

export default function ModeSelection() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">NursePrep Analytics</h1>
          <p className="text-muted-foreground text-lg">Choose your learning path</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pre-Test Preparation */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Pre-Test Preparation</CardTitle>
              <CardDescription>
                Prepare before your assessment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Upload your course syllabus</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">See what topics students typically miss</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Get predictive study recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Focus on high-risk areas before testing</span>
                </li>
              </ul>
              <Button 
                onClick={() => navigate("/pre-test")}
                className="w-full"
                variant="default"
              >
                Start Pre-Test Prep
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Post-Test Review */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Post-Test Review</CardTitle>
              <CardDescription>
                Analyze your assessment results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Upload your assessment report</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Identify knowledge gaps</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Get personalized remediation plan</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                  <span className="text-sm">Track improvement progress</span>
                </li>
              </ul>
              <Button 
                onClick={() => navigate("/post-test")}
                className="w-full"
                variant="outline"
              >
                Review Assessment Results
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Admin Link */}
      <div className="text-center mt-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/login")}
          className="text-muted-foreground hover:text-foreground"
        >
          <Shield className="h-4 w-4 mr-2" />
          Admin Portal
        </Button>
      </div>
    </div>
  );
}