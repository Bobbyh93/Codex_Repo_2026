import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send login link');
      }

      setEmailSent(true);
      
      toast({
        title: 'Check your email!',
        description: 'We\'ve sent you a login link if an account exists with this email.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to send login link',
        description: error.message || 'Please check your email and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAnother = () => {
    setEmailSent(false);
    setEmail('');
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto bg-green-100 dark:bg-green-900 p-3 rounded-full w-fit mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Check your email
            </CardTitle>
            <CardDescription>
              We've sent a login link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Click the link in the email to log in to your account. The link expires in 15 minutes.
              </AlertDescription>
            </Alert>
            
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium mb-2">Didn't receive the email?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Check your spam or junk folder</li>
                <li>• Make sure you entered the correct email</li>
                <li>• Wait a few moments for the email to arrive</li>
              </ul>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleSendAnother}
              data-testid="button-send-another"
            >
              Try another email
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Admin user?{' '}
              <Link href="/admin/login" className="text-primary hover:underline" data-testid="link-admin-login">
                Use password login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to NursePrep Analytics
          </CardTitle>
          <CardDescription className="text-center">
            Sign in with just your email - no password needed!
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                  data-testid="input-email"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                No password required! We'll send you a secure link to log in instantly.
              </AlertDescription>
            </Alert>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isLoading}
              data-testid="button-send-magic-link"
            >
              {isLoading ? (
                <>Sending login link...</>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Login Link
                </>
              )}
            </Button>
            
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Other options
                </span>
              </div>
            </div>
            
            <div className="text-sm text-center text-muted-foreground space-y-2">
              <div>
                First time here?{' '}
                <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                  Create an account
                </Link>
              </div>
              <div>
                Admin user?{' '}
                <Link href="/admin/login" className="text-primary hover:underline" data-testid="link-admin-login">
                  Use password login
                </Link>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
