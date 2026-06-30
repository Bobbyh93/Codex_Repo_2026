import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Home, RefreshCw } from 'lucide-react';

export function VerifyMagicLink() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [, setLocation] = useLocation();
  const { setUser, setToken } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const verifyToken = async () => {
      // Get token from URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setStatus('error');
        setErrorMessage('No verification token found in the URL.');
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to verify login link');
        }

        // Store auth data
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        
        setIsNewUser(data.isNewUser);
        setStatus('success');
        
        toast({
          title: data.isNewUser ? 'Welcome to NursePrep Analytics!' : 'Welcome back!',
          description: data.isNewUser 
            ? 'Your account has been created successfully.' 
            : 'You have been logged in successfully.',
        });

        // Redirect after a short delay
        setTimeout(() => {
          // Redirect based on user role
          if (data.user.role === 'admin') {
            setLocation('/admin/dashboard');
          } else {
            setLocation('/dashboard');
          }
        }, 2000);
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.message || 'Failed to verify your login link.');
        
        toast({
          title: 'Verification failed',
          description: error.message || 'The login link may be expired or invalid.',
          variant: 'destructive',
        });
      }
    };

    verifyToken();
  }, [setUser, setToken, setLocation, toast]);

  const handleGoHome = () => {
    setLocation('/');
  };

  const handleTryAgain = () => {
    setLocation('/login');
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              Verifying your login link
            </CardTitle>
            <CardDescription>
              Please wait while we verify your identity...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <LoadingState message="Verifying..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto bg-green-100 dark:bg-green-900 p-3 rounded-full w-fit mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {isNewUser ? 'Welcome to NursePrep Analytics!' : 'Welcome back!'}
            </CardTitle>
            <CardDescription>
              {isNewUser 
                ? 'Your account has been created and you are now logged in.' 
                : 'You have been successfully logged in.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Redirecting you to your dashboard...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto bg-red-100 dark:bg-red-900 p-3 rounded-full w-fit mb-2">
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Verification failed
          </CardTitle>
          <CardDescription>
            We couldn't verify your login link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-medium mb-2">Common reasons:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• The link has expired (links are valid for 15 minutes)</li>
              <li>• The link has already been used</li>
              <li>• The link was copied incorrectly</li>
            </ul>
          </div>
        </CardContent>
        <CardContent className="flex flex-col space-y-2 pt-0">
          <Button 
            onClick={handleTryAgain} 
            className="w-full"
            data-testid="button-try-again"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Request a new login link
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGoHome} 
            className="w-full"
            data-testid="button-go-home"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to home page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}