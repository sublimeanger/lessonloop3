import * as Sentry from '@sentry/react';
import { SENTRY_DSN } from '@/lib/env';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 1.0,
  });
}

export { Sentry };
