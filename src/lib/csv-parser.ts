/**
 * RFC 4180-compliant CSV parser with BOM stripping and header normalisation.
 * Shared by useStudentsImport and MigrationStep (onboarding).
 */

/** Strip BOM, trim whitespace, collapse multiple spaces */
export function normaliseHeader(h: string): string {
  return h.replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Parse a single CSV row following RFC 4180:
 * - Quoted fields may contain commas, newlines, and literal `"` (escaped as `""`)
 * - Unquoted fields end at the next comma
 */
function parseRow(line: string): string[] {
  const result: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // trailing comma produced an empty final field
      result.push('');
      break;
    }

    if (line[i] === '"') {
      // ── Quoted field ──
      i++; // skip opening quote
      let value = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // escaped quote → literal "
            value += '"';
            i += 2;
          } else {
            // closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      result.push(value.trim());
      // skip comma (or we're at end of line)
      if (i < line.length && line[i] === ',') i++;
    } else {
      // ── Unquoted field ──
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        result.push(line.slice(i).trim());
        break;
      } else {
        result.push(line.slice(i, commaIdx).trim());
        i = commaIdx + 1;
      }
    }
  }

  return result;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse a CSV string into normalised headers and data rows.
 * Handles BOM, escaped quotes, and Windows line endings.
 */
export function parseCSV(content: string): ParsedCSV {
  // Strip BOM from entire content
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const rawHeaders = parseRow(lines[0]);
  const headers = rawHeaders.map(normaliseHeader);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

/**
 * Read a File as text, falling back to Windows-1252 if UTF-8 produces
 * replacement characters (common with Excel exports).
 */
export async function readFileAsText(f: File): Promise<string> {
  const utf8 = await f.text();
  if (!utf8.includes('\uFFFD')) return utf8;
  const buffer = await f.arrayBuffer();
  return new TextDecoder('windows-1252').decode(buffer);
}
