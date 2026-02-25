/**
 * Shared logging utility that sanitises PII before writing to console.
 *
 * In development (ENVIRONMENT=development) the full values are logged.
 * In every other environment emails and UUIDs are masked automatically.
 */

const isDev = () => Deno.env.get("ENVIRONMENT") === "development";

// Matches standard email addresses
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Matches UUIDs (8-4-4-4-12 hex format)
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

/**
 * Mask an email address.
 * "user@example.com" -> "u***@e***.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const domainParts = domain.split(".");
  const tld = domainParts.pop() || "";
  const domainName = domainParts.join(".");
  return `${local[0] || ""}***@${domainName[0] || ""}***.${tld}`;
}

/**
 * Mask a UUID.
 * "abc12345-6789-0abc-def0-123456789abc" -> "abc1...bc"
 */
function maskUuid(uuid: string): string {
  const stripped = uuid.replace(/-/g, "");
  return `${stripped.slice(0, 4)}...${stripped.slice(-2)}`;
}

/**
 * Sanitise a single value (string, Error, or object) by masking emails and UUIDs.
 */
function sanitise(value: unknown): unknown {
  if (value instanceof Error) {
    const masked = new Error(sanitiseString(value.message));
    masked.stack = value.stack ? sanitiseString(value.stack) : undefined;
    return masked;
  }
  if (typeof value === "string") {
    return sanitiseString(value);
  }
  if (typeof value === "object" && value !== null) {
    try {
      const json = JSON.stringify(value);
      return JSON.parse(sanitiseString(json));
    } catch {
      return value;
    }
  }
  return value;
}

function sanitiseString(str: string): string {
  return str
    .replace(EMAIL_RE, (match) => maskEmail(match))
    .replace(UUID_RE, (match) => maskUuid(match));
}

/**
 * Log an informational message with PII masked (unless in development).
 */
export function log(...args: unknown[]): void {
  if (isDev()) {
    console.log(...args);
    return;
  }
  console.log(...args.map(sanitise));
}

/**
 * Log an error message with PII masked (unless in development).
 */
export function logError(...args: unknown[]): void {
  if (isDev()) {
    console.error(...args);
    return;
  }
  console.error(...args.map(sanitise));
}
