import { Component, ErrorInfo, ReactNode } from 'react';
import { Sentry } from '@/lib/sentry';
import { logger } from '@/lib/logger';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 * 
 * This prevents the entire app from crashing when a component fails to render.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error);
    logger.error('Error info:', errorInfo);

    this.setState({ errorInfo });

    // Auto-recover from failed dynamic imports (chunk load failures).
    // These are non-fatal — redirect to dashboard instead of showing error page.
    if (error?.message?.includes('Failed to fetch dynamically imported module')) {
      logger.warn('Chunk load failure detected — redirecting to /dashboard');
      window.location.href = '/dashboard';
      return;
    }

    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="mx-auto w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-section-title tracking-tight">Something went wrong</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                We encountered an unexpected error. This has been logged and our team will investigate.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details in development */}
              {import.meta.env.DEV && this.state.error && (
                <div className="rounded-lg bg-muted p-3 text-xs">
                  <p className="font-mono font-semibold text-destructive">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-muted-foreground">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                If the problem persists, try refreshing the page or{' '}
                <button
                  onClick={this.handleReload}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  reload the application
                </button>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly error boundary wrapper for functional components.
 * Wrap any component tree that might throw errors during rendering.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export default ErrorBoundary;
