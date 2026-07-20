import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Target, BookOpen, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudyPlan {
  id: string;
  name: string;
  duration: string;
  intensity: 'light' | 'moderate' | 'intensive';
  scheduleType: 'daily' | 'weekly' | 'flexible';
  description: string;
  recommendedFor: string[];
  weeklyHours: number;
  template: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
}

interface StudyPlanSelectorProps {
  selectedPlan: string;
  onPlanChange: (planId: string) => void;
  studentScore?: number;
  topicsCount?: number;
  onCustomize?: (customPlan: any) => void;
}

const PlanIntensityBadge = ({ intensity }: { intensity: string }) => {
  const colors = {
    light: 'bg-green-100 text-green-800',
    moderate: 'bg-blue-100 text-blue-800',
    intensive: 'bg-orange-100 text-orange-800'
  };
  return (
    <Badge className={cn('text-xs', colors[intensity as keyof typeof colors])}>
      {intensity}
    </Badge>
  );
};

export function StudyPlanSelector({
  selectedPlan,
  onPlanChange,
  studentScore = 0,
  topicsCount = 0,
  onCustomize
}: StudyPlanSelectorProps) {
  const [duration, setDuration] = useState('4-weeks');
  const [intensity, setIntensity] = useState('moderate');

  // Fetch study plan templates from database
  const { data: studyPlans = [] } = useQuery<StudyPlan[]>({
    queryKey: ['/api/admin/study-plans', duration, intensity],
  });

  // Default study plans if database is empty
  const defaultPlans: StudyPlan[] = [
    {
      id: 'comprehensive-4week',
      name: 'Comprehensive Review',
      duration: '4 weeks',
      intensity: 'moderate',
      scheduleType: 'weekly',
      description: 'Balanced approach covering all topics systematically',
      recommendedFor: ['Overall review', 'NCLEX prep'],
      weeklyHours: 15,
      template: {
        week1: ['Fundamentals review', 'Safety protocols', 'Practice questions'],
        week2: ['Medical-Surgical topics', 'Pharmacology basics', 'Case studies'],
        week3: ['Pediatrics & Maternal', 'Mental Health concepts', 'Lab values'],
        week4: ['Critical thinking', 'Priority setting', 'Mock exams']
      }
    },
    {
      id: 'intensive-2week',
      name: 'Intensive Bootcamp',
      duration: '2 weeks',
      intensity: 'intensive',
      scheduleType: 'daily',
      description: 'Fast-paced review for exam retakers',
      recommendedFor: ['Exam retake', 'Quick review'],
      weeklyHours: 30,
      template: {
        week1: ['High-priority topics', 'Daily practice tests', 'Content review'],
        week2: ['Weak areas focus', 'Test-taking strategies', 'Final review'],
        week3: [],
        week4: []
      }
    },
    {
      id: 'focused-remediation',
      name: 'Focused Remediation',
      duration: '3 weeks',
      intensity: 'light',
      scheduleType: 'flexible',
      description: 'Target specific weak areas identified in assessment',
      recommendedFor: ['Gap filling', 'Specific topics'],
      weeklyHours: 10,
      template: {
        week1: ['Priority 1 topics', 'Foundation concepts'],
        week2: ['Priority 2 topics', 'Application practice'],
        week3: ['Review and reinforcement', 'Assessment'],
        week4: []
      }
    }
  ];

  const availablePlans = studyPlans.length > 0 ? studyPlans : defaultPlans;
  const selectedPlanData = availablePlans.find(p => p.id === selectedPlan);

  // Recommend plan based on student performance
  const getRecommendedPlan = () => {
    if (studentScore < 60) return 'intensive-2week';
    if (studentScore < 75) return 'comprehensive-4week';
    return 'focused-remediation';
  };

  const recommendedPlanId = getRecommendedPlan();

  return (
    <div className="space-y-4">
      {/* Plan Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger data-testid="select-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2-weeks">2 Weeks</SelectItem>
              <SelectItem value="3-weeks">3 Weeks</SelectItem>
              <SelectItem value="4-weeks">4 Weeks</SelectItem>
              <SelectItem value="6-weeks">6 Weeks</SelectItem>
              <SelectItem value="8-weeks">8 Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Intensity</Label>
          <Select value={intensity} onValueChange={setIntensity}>
            <SelectTrigger data-testid="select-intensity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light (10 hrs/week)</SelectItem>
              <SelectItem value="moderate">Moderate (15 hrs/week)</SelectItem>
              <SelectItem value="intensive">Intensive (20+ hrs/week)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Study Plan Options */}
      <RadioGroup value={selectedPlan} onValueChange={onPlanChange}>
        <div className="space-y-3">
          {availablePlans.map((plan) => (
            <Card 
              key={plan.id}
              className={cn(
                "cursor-pointer transition-all",
                selectedPlan === plan.id && "border-primary ring-2 ring-primary/20",
                recommendedPlanId === plan.id && "border-green-500"
              )}
              onClick={() => onPlanChange(plan.id)}
              data-testid={`plan-option-${plan.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={plan.id} className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{plan.name}</h4>
                          {recommendedPlanId === plan.id && (
                            <Badge variant="outline" className="text-xs bg-green-50">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{plan.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <PlanIntensityBadge intensity={plan.intensity} />
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {plan.duration}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {plan.scheduleType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {plan.weeklyHours} hrs/week
                      </span>
                    </div>

                    {plan.recommendedFor.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {plan.recommendedFor.map((use) => (
                          <Badge key={use} variant="secondary" className="text-xs">
                            {use}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </RadioGroup>

      {/* Selected Plan Details */}
      {selectedPlanData && (
        <Card className="bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Weekly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(selectedPlanData.template).map(([week, tasks]) => 
                tasks.length > 0 && (
                  <div key={week} className="space-y-1">
                    <p className="text-xs font-medium text-gray-700 capitalize">
                      {week.replace('week', 'Week ')}
                    </p>
                    <ul className="space-y-1">
                      {tasks.map((task, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>

            {onCustomize && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => onCustomize(selectedPlanData)}
                data-testid="button-customize-plan"
              >
                Customize This Plan
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}