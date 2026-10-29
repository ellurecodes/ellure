/**
 * Pure domain money utilities.
 * All monetary amounts in the system are strictly stored as integer paise (minor units).
 * ₹1.00 = 100 paise. Never use floating point for monetary arithmetic.
 */

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const clean = rupees.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Format integer paise into Indian currency format (en-IN).
 * e.g., 12345678 -> "₹1,23,456.78"
 * Options:
 * - showPaise: 'auto' (shows decimals only if non-zero), 'always', 'never'
 * - showSign: true to prepend '+' for positive
 */
export function formatInr(
  paise: number,
  options: {
    showPaise?: 'auto' | 'always' | 'never';
    showSign?: boolean;
    compact?: boolean;
  } = {}
): string {
  const { showPaise = 'auto', showSign = false, compact = false } = options;
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;

  if (compact && absPaise >= 10000000) { // 1 Crore
    const cr = (rupees / 10000000).toFixed(2);
    return `${isNegative ? '-' : showSign ? '+' : ''}₹${cr} Cr`;
  }
  if (compact && absPaise >= 100000) { // 1 Lakh
    const lk = (rupees / 100000).toFixed(2);
    return `${isNegative ? '-' : showSign ? '+' : ''}₹${lk} L`;
  }

  let minimumFractionDigits = 0;
  let maximumFractionDigits = 2;

  if (showPaise === 'always') {
    minimumFractionDigits = 2;
    maximumFractionDigits = 2;
  } else if (showPaise === 'never') {
    minimumFractionDigits = 0;
    maximumFractionDigits = 0;
  } else {
    // 'auto'
    const hasCents = absPaise % 100 !== 0;
    minimumFractionDigits = hasCents ? 2 : 0;
    maximumFractionDigits = 2;
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits,
    maximumFractionDigits,
  });

  const formatted = formatter.format(rupees);
  if (isNegative) {
    return formatted; // Intl includes minus
  }
  return showSign && paise > 0 ? `+${formatted}` : formatted;
}

/**
 * Converts a foreign currency minor unit amount to INR paise given a user-entered exchange rate.
 * Exchange rate represents 1 unit of foreign currency in INR (e.g. 1 USD = 83.50 INR).
 * foreignMinorUnits: e.g. 1000 cents for $10.00
 * exchangeRateToInr: e.g. 83.50
 * Returns integer INR paise.
 */
export function convertForeignToInrPaise(
  foreignMinorUnits: number,
  exchangeRateToInr: number
): number {
  if (foreignMinorUnits <= 0 || exchangeRateToInr <= 0) return 0;
  // foreignMinorUnits / 100 is foreign major units
  // foreign major units * exchangeRateToInr is INR major units
  // INR major units * 100 is INR paise
  // Which simplifies to: Math.round(foreignMinorUnits * exchangeRateToInr)
  return Math.round(foreignMinorUnits * exchangeRateToInr);
}

/**
 * Format foreign currency with standard formatter
 */
export function formatForeign(minorUnits: number, currencyCode: string): string {
  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    });
    return formatter.format(minorUnits / 100);
  } catch {
    return `${currencyCode} ${(minorUnits / 100).toFixed(2)}`;
  }
}
