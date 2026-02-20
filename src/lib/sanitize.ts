import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'i', 'em', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class', 'src', 'alt'],
    ALLOW_DATA_ATTR: false,
  });
}

export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
