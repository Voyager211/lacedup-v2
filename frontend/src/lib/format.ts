/**
 * Display formatting.
 *
 * The EJS layer had no helpers at all: 65 inline `toLocaleString` calls, three
 * different date formats for the same "valid till" concept, and currency
 * rendered three ways (`₹` + Math.round, `₹` + toLocaleString('en-IN'), and
 * bare Math.round). Every one of those goes through here instead.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

/**
 * Money, in rupees.
 *
 * Whole amounts print without a decimal part - `₹1,299` rather than
 * `₹1,299.00` - because prices in this catalogue are almost always whole and
 * the trailing zeros are noise. Fractional amounts (wallet balances after a
 * partial refund, say) keep both decimals.
 */
export const formatINR = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? INR_WHOLE.format(value) : INR.format(value);
};

/** A bare number with Indian digit grouping and no currency symbol. */
export const formatNumber = (value: number | null | undefined): string =>
  value == null || Number.isNaN(value) ? '—' : new Intl.NumberFormat('en-IN').format(value);

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

type DateStyle = 'short' | 'long' | 'numeric' | 'full';

const DATE_FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  // With the weekday, for the admin page headers - "when was this placed" is
  // easier to answer from "Tuesday" than from the date alone.
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
};

/** One date format for the whole app. `en-IN`, day first. */
export const formatDate = (
  value: string | number | Date | null | undefined,
  style: DateStyle = 'short'
): string => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-IN', DATE_FORMATS[style]) : '—';
};

export const formatDateTime = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/** "2 days ago", "in 3 hours". Falls back to an absolute date beyond a month. */
export const formatRelative = (value: string | number | Date | null | undefined): string => {
  const date = toDate(value);
  if (!date) return '—';

  const seconds = (date.getTime() - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30]
  ];

  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  let value_ = seconds;

  for (const [unit, step] of units) {
    if (Math.abs(value_) < step) return rtf.format(Math.round(value_), unit);
    value_ /= step;
  }

  return formatDate(date);
};

/** Truncate for table cells and card titles, on a word boundary where possible. */
export const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};
