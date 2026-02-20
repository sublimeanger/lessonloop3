import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';

export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const strengthConfig = [
  { label: 'Weak', color: 'bg-destructive' },
  { label: 'Fair', color: 'bg-orange-500' },
  { label: 'Good', color: 'bg-yellow-500' },
  { label: 'Strong', color: 'bg-success' },
] as const;

/**
 * Check if a password appears in known breaches using the HIBP k-Anonymity API.
 * Only sends the first 5 chars of the SHA-1 hash — the full password never leaves the client.
 */
export async function checkPasswordBreach(password: string): Promise<{ breached: boolean; count: number }> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) return { breached: false, count: 0 };

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hash, countStr] = line.split(':');
      if (hash.trim() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        if (count > 0) return { breached: true, count };
      }
    }

    return { breached: false, count: 0 };
  } catch {
    // Network error — don't block signup
    return { breached: false, count: 0 };
  }
}

interface PasswordStrengthProps {
  password: string;
  visible: boolean;
  showBreachWarning?: boolean;
}

export function PasswordStrengthIndicator({ password, visible, showBreachWarning = true }: PasswordStrengthProps) {
  const [breachResult, setBreachResult] = useState<{ breached: boolean; count: number } | null>(null);
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);

  useEffect(() => {
    if (!showBreachWarning || password.length < PASSWORD_MIN_LENGTH) {
      setBreachResult(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsCheckingBreach(true);
      const result = await checkPasswordBreach(password);
      setBreachResult(result);
      setIsCheckingBreach(false);
    }, 500); // debounce

    return () => clearTimeout(timeout);
  }, [password, showBreachWarning]);

  if (!visible) return null;

  const score = getPasswordScore(password);
  const config = strengthConfig[Math.max(0, score - 1)] ?? strengthConfig[0];
  const meetsLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password);

  return (
    <div className="space-y-1.5 pt-1">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              password.length > 0 && i <= score ? config.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs text-muted-foreground">{config.label}</p>
      )}

      {/* Requirements */}
      <div className="space-y-0.5">
        <Requirement met={meetsLength}>At least {PASSWORD_MIN_LENGTH} characters</Requirement>
        <Requirement met={hasCase}>Upper & lowercase letters</Requirement>
        <Requirement met={hasNumberOrSymbol}>Number or special character</Requirement>
      </div>

      {/* Breach warning */}
      {breachResult?.breached && (
        <div className="flex items-start gap-1.5 text-xs text-warning mt-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            This password has appeared in {breachResult.count.toLocaleString()} known data breaches. Consider choosing a different one.
          </span>
        </div>
      )}
      {isCheckingBreach && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking password safety…</span>
        </div>
      )}
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {met ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <X className="h-3 w-3 text-destructive" />
      )}
      {children}
    </div>
  );
}
