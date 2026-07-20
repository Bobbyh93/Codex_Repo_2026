import { useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, Mail, Key, ArrowLeft, Shield } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const { loginWithCode } = useAuth();
  const { toast } = useToast();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      setIsNewUser(data.isNewUser || false);
      
      toast({
        title: 'Verification code sent!',
        description: `We've sent a 6-digit code to ${email}. Please check your inbox.`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to send code',
        description: error.message || 'Please check your email and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await loginWithCode(email, verificationCode, stayLoggedIn);
      
      toast({
        title: isNewUser ? 'Welcome to NursePrep Analytics!' : 'Welcome back!',
        description: isNewUser 
          ? 'Your account has been created and you are now logged in.' 
          : 'You have successfully logged in.',
      });
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Please check your code and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCodeSent(false);
    setVerificationCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {codeSent ? 'Enter Verification Code' : 'Welcome to NursePrep Analytics'}
          </CardTitle>
          <CardDescription className="text-center">
            {codeSent 
              ? `We've sent a code to ${email}`
              : 'Sign in with your email - no password needed!'
            }
          </CardDescription>
        </CardHeader>
        
        {!codeSent ? (
          <form onSubmit={handleSendCode}>
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
                  />
                </div>
              </div>
              
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  No password required! We'll send you a secure verification code via email.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
                data-testid="button-send-code"
              >
                {isLoading ? (
                  <LoadingState size="sm" variant="inline" message="Sending code..." />
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Verification Code
                  </>
                )}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                First time here?{' '}
                <Link href="/register">
                  <a className="text-primary hover:underline" data-testid="link-register">
                    Create an account
                  </a>
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    className="pl-10 text-center text-2xl font-mono tracking-wider"
                    autoComplete="off"
                    autoFocus
                    data-testid="input-code"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stay-logged-in"
                  checked={stayLoggedIn}
                  onCheckedChange={(checked) => setStayLoggedIn(checked as boolean)}
                  data-testid="checkbox-stay-logged-in"
                />
                <Label
                  htmlFor="stay-logged-in"
                  className="text-sm font-normal cursor-pointer"
                >
                  Keep me logged in for 30 days
                </Label>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Code expires in 10 minutes. Didn't receive it? Check your spam folder.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading || verificationCode.length !== 6}
                data-testid="button-verify-code"
              >
                {isLoading ? (
                  <LoadingState size="sm" variant="inline" message={isNewUser ? "Creating account..." : "Signing in..."} />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    {isNewUser ? 'Create Account & Sign In' : 'Sign In'}
                  </>
                )}
              </Button>
              
              <div className="flex items-center justify-between w-full">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendCode}
                  data-testid="button-back"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Change Email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={isLoading}
                  data-testid="button-resend"
                >
                  Resend Code
                </Button>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}