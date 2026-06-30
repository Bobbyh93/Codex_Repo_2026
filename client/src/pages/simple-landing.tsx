import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { track, EVENTS } from "@/lib/analytics";

export default function SimpleLanding() {
  const [, navigate] = useLocation();

  useEffect(() => {
    track(EVENTS.LANDING_VIEW);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="container max-w-6xl mx-auto px-4 pt-12 pb-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            1-Hour Exam Recovery Blueprint
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Upload your test report → Get your personalized study plan instantly.
            Average score improvement: 15-20%
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/post-test")}
              className="text-lg px-8 py-6"
              data-testid="button-quick-plan"
            >
              Get Your Free Blueprint
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-16">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">2,847</p>
              <p className="text-sm text-gray-600">Students Helped</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">85%</p>
              <p className="text-sm text-gray-600">Pass Rate</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold">18%</p>
              <p className="text-sm text-gray-600">Avg Improvement</p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Upload Test Report</h3>
              <p className="text-sm text-gray-600">
                PDF or image format - instant analysis
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">Get Your Blueprint</h3>
              <p className="text-sm text-gray-600">
                Top 2 gaps + 3×20-min focused tasks
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                3
              </div>
              <h3 className="font-semibold mb-2">Complete & Improve</h3>
              <p className="text-sm text-gray-600">
                Average 15-20% score increase
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-3">Ready to Improve Your Score?</h3>
              <p className="text-gray-600 mb-6">
                Join thousands of nursing students who turned failure into success
              </p>
              <Button 
                size="lg"
                onClick={() => navigate("/post-test")}
                className="w-full sm:w-auto"
              >
                Start Now - It's Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Admin Links - At Very Bottom */}
        <div className="mt-16 text-center pb-8">
          <Button 
            variant="link" 
            onClick={() => navigate("/study-guide")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            View Study Guide Template →
          </Button>
          <Button 
            variant="link" 
            onClick={() => navigate("/admin")}
            className="text-sm text-gray-400 hover:text-gray-600 ml-4"
          >
            Admin Portal
          </Button>
        </div>
      </div>
    </div>
  );
}