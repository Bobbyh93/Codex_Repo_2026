import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Shield, 
  Settings, 
  Eye, 
  TrendingUp, 
  Target, 
  Download, 
  Trash2, 
  Mail,
  MessageSquare,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface PrivacySettings {
  emailMarketing: boolean;
  smsMarketing: boolean;
  dataSharing: boolean;
  profileVisible: boolean;
  analyticsOptOut: boolean;
}

interface ConsentHistory {
  id: string;
  action: string;
  consentMethod: string;
  timestamp: string;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  functionalConsent: boolean;
}

export function PrivacySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Fetch current privacy settings
  const { data: privacySettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/privacy/settings'],
    enabled: !!user,
  });

  // Fetch current consent preferences
  const { data: currentConsent } = useQuery({
    queryKey: ['/api/privacy/consent'],
    enabled: !!user,
  });

  // Fetch consent history
  const { data: consentHistory } = useQuery({
    queryKey: ['/api/privacy/consent-history'],
    enabled: !!user,
  });

  // Update privacy settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: PrivacySettings) => {
      return await apiRequest('/api/privacy/settings', 'PUT', settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your privacy preferences have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/settings'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update privacy settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update cookie consent
  const updateConsentMutation = useMutation({
    mutationFn: async (consent: any) => {
      return await apiRequest('/api/privacy/consent', 'POST', {
        preferences: consent,
        method: 'settings_page',
      });
    },
    onSuccess: () => {
      toast({
        title: "Consent Updated",
        description: "Your cookie preferences have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/consent'] });
    },
  });

  // Export personal data
  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/privacy/export-data', 'POST', {});
      return response;
    },
    onSuccess: (data) => {
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nurseprep-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data Exported",
        description: "Your personal data has been downloaded as a JSON file.",
      });
    },
  });

  const handleSettingChange = (key: keyof PrivacySettings, value: boolean) => {
    const updatedSettings = {
      ...(privacySettings || {}),
      [key]: value,
    } as PrivacySettings;
    updateSettingsMutation.mutate(updatedSettings);
  };

  const handleConsentChange = (category: string, value: boolean) => {
    const updatedConsent = {
      ...(currentConsent || {}),
      [`${category}Cookies`]: value,
    };
    updateConsentMutation.mutate(updatedConsent);
  };

  if (settingsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-muted animate-pulse rounded" />
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-500" />
          Privacy & Data Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your privacy preferences, cookie settings, and data controls
        </p>
      </div>

      {/* Cookie Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cookie Preferences
          </CardTitle>
          <CardDescription>
            Control how we use cookies to enhance your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium">Necessary Cookies</div>
                  <div className="text-sm text-muted-foreground">
                    Required for basic site functionality
                  </div>
                </div>
                <Badge variant="secondary">Required</Badge>
              </div>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium">Functional Cookies</div>
                  <div className="text-sm text-muted-foreground">
                    Enable personalized features and preferences
                  </div>
                </div>
              </div>
              <Switch
                checked={(currentConsent as any)?.functionalCookies || false}
                onCheckedChange={(checked) => handleConsentChange('functional', checked)}
                data-testid="switch-functional-cookies"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="font-medium">Analytics Cookies</div>
                  <div className="text-sm text-muted-foreground">
                    Help us improve the platform with usage analytics
                  </div>
                </div>
              </div>
              <Switch
                checked={(currentConsent as any)?.analyticsCookies || false}
                onCheckedChange={(checked) => handleConsentChange('analytics', checked)}
                data-testid="switch-analytics-cookies"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="font-medium">Marketing Cookies</div>
                  <div className="text-sm text-muted-foreground">
                    Show relevant content and track campaign effectiveness
                  </div>
                </div>
              </div>
              <Switch
                checked={(currentConsent as any)?.marketingCookies || false}
                onCheckedChange={(checked) => handleConsentChange('marketing', checked)}
                data-testid="switch-marketing-cookies"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Communication Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Communication Preferences
          </CardTitle>
          <CardDescription>
            Control how we communicate with you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">Email Marketing</div>
                <div className="text-sm text-muted-foreground">
                  Receive updates about new features and study tips
                </div>
              </div>
            </div>
            <Switch
              checked={(privacySettings as any)?.emailMarketing || false}
              onCheckedChange={(checked) => handleSettingChange('emailMarketing', checked)}
              data-testid="switch-email-marketing"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">SMS Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Get study reminders and important updates via text
                </div>
              </div>
            </div>
            <Switch
              checked={(privacySettings as any)?.smsMarketing || false}
              onCheckedChange={(checked) => handleSettingChange('smsMarketing', checked)}
              data-testid="switch-sms-marketing"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Sharing & Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Data Sharing & Visibility
          </CardTitle>
          <CardDescription>
            Control how your data is shared and displayed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-purple-500" />
              <div>
                <div className="font-medium">Profile Visibility</div>
                <div className="text-sm text-muted-foreground">
                  Allow others to see your public profile information
                </div>
              </div>
            </div>
            <Switch
              checked={(privacySettings as any)?.profileVisible !== false}
              onCheckedChange={(checked) => handleSettingChange('profileVisible', checked)}
              data-testid="switch-profile-visible"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">Anonymous Data Sharing</div>
                <div className="text-sm text-muted-foreground">
                  Help improve nursing education through anonymous usage data
                </div>
              </div>
            </div>
            <Switch
              checked={(privacySettings as any)?.dataSharing || false}
              onCheckedChange={(checked) => handleSettingChange('dataSharing', checked)}
              data-testid="switch-data-sharing"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Your Data Rights
          </CardTitle>
          <CardDescription>
            Access, export, or delete your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Under GDPR and CCPA, you have the right to access, export, and delete your personal data.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => exportDataMutation.mutate()}
              disabled={exportDataMutation.isPending}
              className="justify-start"
              data-testid="button-export-data"
            >
              <Download className="mr-2 h-4 w-4" />
              {exportDataMutation.isPending ? 'Exporting...' : 'Export My Data'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsDeletingAccount(true)}
              className="justify-start text-destructive hover:text-destructive"
              data-testid="button-delete-account"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consent History */}
      {consentHistory && (consentHistory as ConsentHistory[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Consent History
            </CardTitle>
            <CardDescription>
              Your privacy consent changes over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(consentHistory as ConsentHistory[]).slice(0, 5).map((entry: ConsentHistory) => (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="font-medium capitalize">
                        {entry.action} Consent
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Via {entry.consentMethod.replace('_', ' ')} • {entry.timestamp && !isNaN(new Date(entry.timestamp).getTime()) ? new Date(entry.timestamp).toLocaleDateString() : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {entry.analyticsConsent && <Badge variant="secondary">Analytics</Badge>}
                    {entry.marketingConsent && <Badge variant="secondary">Marketing</Badge>}
                    {entry.functionalConsent && <Badge variant="secondary">Functional</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Links */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <a href="/privacy-policy" className="underline hover:no-underline">
              Privacy Policy
            </a>
            <a href="/terms" className="underline hover:no-underline">
              Terms of Service
            </a>
            <a href="/cookie-policy" className="underline hover:no-underline">
              Cookie Policy
            </a>
            <a href="/data-processing" className="underline hover:no-underline">
              Data Processing Agreement
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}