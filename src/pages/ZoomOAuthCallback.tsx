import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Proxy route for Zoom OAuth callback.
 * Zoom redirects here (app.lessonloop.net/auth/zoom/callback),
 * and we forward code+state to the Supabase edge function.
 */
export default function ZoomOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const zoomError = searchParams.get('error');

    if (zoomError) {
      // Parse state to get redirect_uri, then redirect with error
      try {
        const stateData = JSON.parse(atob(state || ''));
        window.location.href = `${stateData.redirect_uri || '/settings'}?zoom_error=${encodeURIComponent(zoomError)}`;
      } catch {
        window.location.href = `/settings?zoom_error=${encodeURIComponent(zoomError)}`;
      }
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code or state parameter.');
      return;
    }

    // Forward to the edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const callbackUrl = `${supabaseUrl}/functions/v1/zoom-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    
    // Redirect to the edge function which handles token exchange and DB storage
    window.location.href = callbackUrl;
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <a href="/settings" className="text-primary underline">Back to Settings</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Connecting your Zoom account…</p>
      </div>
    </div>
  );
}
