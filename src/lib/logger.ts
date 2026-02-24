const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args); // Always log warnings
  },
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args); // Always log errors
  },
};
