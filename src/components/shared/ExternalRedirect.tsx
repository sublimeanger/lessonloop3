import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';

interface ExternalRedirectProps {
  to: string;
  /** If true, appends the current path's dynamic segments to the external URL */
  preservePath?: boolean;
}

/**
 * Performs a hard redirect to an external URL.
 * Used to redirect old marketing routes to the static site.
 */
export function ExternalRedirect({ to, preservePath }: ExternalRedirectProps) {
  const params = useParams();
  const location = useLocation();

  useEffect(() => {
    let url = to;
    // Replace :param placeholders with actual values
    if (preservePath && params['*']) {
      url = `${to}/${params['*']}`;
    } else if (params.slug) {
      url = to.replace(':slug', params.slug);
    }
    window.location.replace(url);
  }, [to, params, preservePath, location]);

  return null;
}
