import * as Sentry from '@sentry/react';
import { SENTRY_DSN } from '@/lib/env';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
  });
}

export { Sentry };
