/**
 * Shared prompt-injection defenses for AI chat edge functions.
 */

export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now/i,
  /new\s+system\s+prompt/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if/i,
  /override\s+(your\s+)?instructions/i,
  /reveal\s+(your\s+)?(system|initial)\s+prompt/i,
  /output\s+(your\s+)?instructions/i,
  /repeat\s+(your\s+)?(system\s+)?prompt/i,
  /what\s+are\s+your\s+instructions/i,
  /forget\s+(everything|all)/i,
  /base64\s+decode/i,
  /encode.*instructions/i,
  /translate.*instructions/i,
  /(?:respond|reply|answer|write|output|speak)\s+(?:in|using)\s+(?:french|spanish|german|chinese|japanese|korean|arabic|hindi|russian|portuguese|italian)/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /bypass\s+(?:your\s+)?(?:filters?|rules?|safety)/i,
  /^human\s*:/im,
  /^user\s*:/im,
];

export const MAX_MESSAGE_LENGTH = 2000;

export function sanitiseMessage(content: string): string {
  let sanitised = content.slice(0, MAX_MESSAGE_LENGTH);
  sanitised = sanitised.normalize('NFKC');
  sanitised = sanitised.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
  for (const pattern of INJECTION_PATTERNS) {
    sanitised = sanitised.replace(pattern, "[filtered]");
  }
  sanitised = sanitised
    .replace(/```/g, "'''")
    // eslint-disable-next-line no-control-regex
    .replace(/\x00/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return sanitised;
}
