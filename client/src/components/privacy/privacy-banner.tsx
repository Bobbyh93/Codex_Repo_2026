import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/auth-context';
import { X, Settings, Shield, Eye, TrendingUp, Target } from 'lucide-react';

interface CookieCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isRequired: boolean;
  isEnabledByDefault: boolean;
}

interface ConsentPreferences {
  necessaryCookies: boolean;
  functionalCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
}

const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'necessary',
    name: 'necessary',
    displayName: 'Necessary Cookies',
    description: 'Essential for basic website functionality, authentication, and security. Cannot be disabled.',
    isRequired: true,
    isEnabledByDefault: true,
  },
  {
    id: 'functional',
    name: 'functional',
    displayName: 'Functional Cookies',
    description: 'Enable enhanced features like personalized settings, saved preferences, and improved user experience.',
    isRequired: false,
    isEnabledByDefault: false,
  },
  {
    id: 'analytics',
    name: 'analytics',
    displayName: 'Analytics Cookies',
    description: 'Help us understand how you use our site to improve performance and user experience.',
    isRequired: false,
    isEnabledByDefault: false,
  },
  {
    id: 'marketing',
    name: 'marketing',
    displayName: 'Marketing Cookies',
    description: 'Used to deliver relevant content and track marketing campaign effectiveness.',
    isRequired: false,
    isEnabledByDefault: false,
  },
];

export function PrivacyBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessaryCookies: true,
    functionalCookies: false,
    analyticsCookies: false,
    marketingCookies: false,
  });

  // Check if user has existing consent
  const { data: existingConsent } = useQuery({
    queryKey: ['/api/privacy/consent'],
    enabled: !!user,
  });

  // Save consent preferences
  const saveConsentMutation = useMutation({
    mutationFn: async (data: { preferences: ConsentPreferences; method: string }) => {
      return await apiRequest('POST', '/api/privacy/consent', data);
    },
    onSuccess: () => {
      setShowBanner(false);
      setShowSettings(false);
      localStorage.setItem('nurseprep_consent_given', 'true');
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/consent'] });
    },
  });

  useEffect(() => {
    // Check if consent has been given
    const consentGiven = localStorage.getItem('nurseprep_consent_given');
    
    // Show banner if no consent exists and user is not on privacy-related pages
    if (!consentGiven && !existingConsent && !window.location.pathname.includes('/privacy')) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000); // Show banner after 1 second for better UX

      return () => clearTimeout(timer);
    }
  }, [existingConsent]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessaryCookies: true,
      functionalCookies: true,
      analyticsCookies: true,
      marketingCookies: true,
    };
    setPreferences(allAccepted);
    saveConsentMutation.mutate({
      preferences: allAccepted,
      method: 'banner_accept_all',
    });
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly = {
      necessaryCookies: true,
      functionalCookies: false,
      analyticsCookies: false,
      marketingCookies: false,
    };
    setPreferences(necessaryOnly);
    saveConsentMutation.mutate({
      preferences: necessaryOnly,
      method: 'banner_necessary_only',
    });
  };

  const handleCustomSave = () => {
    saveConsentMutation.mutate({
      preferences,
      method: 'banner_custom',
    });
  };

  const updatePreference = (category: keyof ConsentPreferences, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [category]: enabled,
    }));
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      {/* Privacy Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
        <div className="container mx-auto p-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-lg">Privacy & Cookies</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBanner(false)}
                  className="h-8 w-8 p-0"
                  data-testid="button-close-banner"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                We use cookies to enhance your learning experience, provide personalized study recommendations, 
                and analyze site performance. Your privacy matters to us.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleAcceptAll}
                    disabled={saveConsentMutation.isPending}
                    data-testid="button-accept-all"
                    className="font-medium"
                  >
                    Accept All Cookies
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAcceptNecessary}
                    disabled={saveConsentMutation.isPending}
                    data-testid="button-necessary-only"
                  >
                    Necessary Only
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(true)}
                    data-testid="button-customize"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Customize
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  <a href="/privacy-policy" className="underline hover:no-underline">
                    Privacy Policy
                  </a>
                  {' • '}
                  <a href="/terms" className="underline hover:no-underline">
                    Terms of Service
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Customize your cookie preferences. You can change these settings anytime in your privacy settings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {COOKIE_CATEGORIES.map((category) => {
              const isEnabled = preferences[category.name as keyof ConsentPreferences];
              const icon = {
                necessary: Shield,
                functional: Settings,
                analytics: TrendingUp,
                marketing: Target,
              }[category.name];
              const IconComponent = icon || Shield;
              
              return (
                <div key={category.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="mt-1">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{category.displayName}</span>
                        {category.isRequired && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => 
                          updatePreference(category.name as keyof ConsentPreferences, checked)
                        }
                        disabled={category.isRequired}
                        data-testid={`switch-${category.name}`}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomSave}
              disabled={saveConsentMutation.isPending}
              data-testid="button-save-preferences"
            >
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for checking consent status
export function usePrivacyConsent() {
  const { data: consent } = useQuery({
    queryKey: ['/api/privacy/consent'],
  });

  return {
    hasConsent: !!consent || !!localStorage.getItem('nurseprep_consent_given'),
    consent: consent,
    canUseAnalytics: (consent as any)?.analyticsCookies || false,
    canUseMarketing: (consent as any)?.marketingCookies || false,
    canUseFunctional: (consent as any)?.functionalCookies || false,
  };
}