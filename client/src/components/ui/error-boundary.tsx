import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, FileText } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Alert, AlertDescription } from "./alert";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  showDetails?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleRefresh = () => {
    // Reset error state and reload the page, preserving admin session
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Preserve admin context - stay on admin page if we're in admin section
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin')) {
      // Just reload the current admin page
      window.location.reload();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    // Reset error state and navigate appropriately based on context
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Check if we're in admin context
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin')) {
      // Go to admin dashboard instead of public home
      window.location.href = '/admin/dashboard';
    } else {
      window.location.href = '/';
    }
  };

  handleClearStorage = () => {
    // Clear app data but preserve admin session cookies
    try {
      // Only clear non-admin items from localStorage
      const keysToKeep: string[] = [];
      const currentPath = window.location.pathname;
      
      if (currentPath.startsWith('/admin')) {
        // In admin context, preserve admin-related items
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('admin') || key === 'csrfToken')) {
            keysToKeep.push(key);
          }
        }
      }
      
      // Save admin items
      const savedItems: { [key: string]: string } = {};
      keysToKeep.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) savedItems[key] = value;
      });
      
      // Clear storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore admin items
      Object.entries(savedItems).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      this.handleRefresh();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      this.handleRefresh();
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center">
          <div className="max-w-md w-full">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-lg">Something went wrong</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  We encountered an unexpected error. Your data has been preserved and you can try the following actions:
                </p>

                <div className="space-y-2">
                  <Button 
                    onClick={this.handleRefresh}
                    className="w-full"
                    data-testid="button-refresh-page"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                  
                  <Button 
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="w-full"
                    data-testid="button-go-home"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    {window.location.pathname.startsWith('/admin') ? 'Go to Admin Dashboard' : 'Go to Home'}
                  </Button>
                  
                  <Button 
                    onClick={this.handleClearStorage}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid="button-clear-storage"
                  >
                    Clear App Data & Refresh
                  </Button>
                </div>

                {this.props.showDetails && this.state.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">Technical Details</summary>
                        <div className="mt-2 text-xs font-mono">
                          <div><strong>Error:</strong> {this.state.error.message}</div>
                          {this.state.error.stack && (
                            <div className="mt-1">
                              <strong>Stack:</strong>
                              <pre className="mt-1 whitespace-pre-wrap text-xs">
                                {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  If this problem persists, try uploading your PDF again or contact support.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Simplified error boundary for specific sections
export function SectionErrorBoundary({ 
  children, 
  title = "Section Error",
  description = "This section encountered an error."
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">{title}</div>
            <div className="text-sm mt-1">{description}</div>
          </AlertDescription>
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// Error boundary specifically for file upload sections
export function UploadErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Error</h3>
            <p className="text-muted-foreground mb-4">
              There was an issue with the file upload system. Please try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-refresh-upload">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// Error boundary for study plan sections
export function StudyPlanErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Study Plan Unavailable</h3>
            <p className="text-muted-foreground mb-4">
              We're having trouble loading your study plan. Please try uploading your assessment again.
            </p>
            <div className="space-y-2">
              <Button onClick={() => window.location.href = '/'} data-testid="button-upload-new">
                <FileText className="h-4 w-4 mr-2" />
                Upload New Assessment
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                data-testid="button-refresh-study-plan"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}