/**
 * Security and sanitization utilities.
 */

/**
 * Validates a platform URL.
 * Allows ONLY http:// and https://.
 * Rejects javascript:, data:, vbscript:, file:, etc.
 */
export function validateSafeUrl(urlStr: string): { isValid: boolean; normalizedUrl?: string; hostname?: string; error?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const trimmed = urlStr.trim();
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { isValid: false, error: 'Disallowed URL protocol. Only http:// or https:// is permitted.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol.' };
    }

    return {
      isValid: true,
      normalizedUrl: parsed.href,
      hostname: parsed.hostname,
    };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitizes CSV cell values against spreadsheet formula injection (CSV Injection).
 * Cells starting with '=', '+', '-', '@', '\t', or '\r' can trigger code execution in Excel/Sheets.
 * We prefix them with a single quote (') to render as literal text.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // If the cell starts with a formula trigger character, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }

  // Escape double quotes if containing comma or quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Unsanitizes a cell imported from CSV, removing the protective single quote if it was added.
 */
export function unsanitizeCsvCell(value: string): string {
  if (value.startsWith("'") && /^[=+\-@\t\r]/.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}
