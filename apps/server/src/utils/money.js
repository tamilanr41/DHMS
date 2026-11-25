/**
 * Exact money arithmetic.
 *
 * All amounts are handled as integer paise (BigInt) so no financial value ever
 * passes through IEEE-754 floating point. Decimal strings from PostgreSQL NUMERIC
 * are parsed directly; JSON numbers are only rounded once, at the boundary.
 */

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;

function decimalText(value, label) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} is not a valid number`);
    return value.toFixed(6);
  }
  const text = String(value).trim();
  if (!DECIMAL_RE.test(text)) throw new Error(`${label} is not a valid decimal value`);
  return text;
}

function toScaled(value, decimals, label) {
  if (value === null || value === undefined || value === '') return 0n;
  if (typeof value === 'bigint') return value;
  const text = decimalText(value, label);
  const negative = text.startsWith('-');
  const [whole, fractionRaw = ''] = text.replace('-', '').split('.');
  const digits = (fractionRaw + '0'.repeat(decimals + 2)).slice(0, decimals + 1);
  const factor = 10n ** BigInt(decimals);
  let scaled = BigInt(whole) * factor + BigInt(digits.slice(0, decimals) || '0');
  if (Number(digits[decimals]) >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
}

function fromScaled(value, decimals) {
  const scaled = BigInt(value);
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const factor = 10n ** BigInt(decimals);
  const whole = abs / factor;
  const fraction = String(abs % factor).padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}${decimals ? `.${fraction}` : ''}`;
}

/** Converts a rupee amount to integer paise, rounding half-up. */
export function toPaise(value, label = 'Amount') {
  return toScaled(value, 2, label);
}

/** Converts integer paise back to a two-decimal string. */
export function fromPaise(value) {
  return fromScaled(value, 2);
}

export function toQuantity(value) {
  return toScaled(value, 3, 'Quantity');
}

export function formatDecimal(value, decimals = 2, label = 'Value') {
  return fromScaled(toScaled(value, decimals, label), decimals);
}

function divideRounded(numerator, denominator) {
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  let quotient = abs / denominator;
  const remainder = abs % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  return negative ? -quotient : quotient;
}

/** unit price (paise) × quantity, rounded to the nearest paisa. */
export function multiplyMoney(unitPaise, quantity) {
  return divideRounded(BigInt(unitPaise) * toQuantity(quantity), 1000n);
}

/** percentage (e.g. 18 or 18.5) of an amount in paise, rounded to the nearest paisa. */
export function percentageOf(paise, percent) {
  return divideRounded(BigInt(paise) * toScaled(percent || 0, 2, 'Percentage'), 10000n);
}

export function sumMoney(values) {
  return values.reduce((total, value) => total + toPaise(value), 0n);
}

export function maxMoney(a, b) {
  return a > b ? a : b;
}

export function clampNonNegative(value) {
  return value < 0n ? 0n : value;
}

/** Groups a decimal string in the Indian numbering system, e.g. 1234567.5 → 12,34,567.50. */
export function formatIndian(value, decimals = 2) {
  const scaled = toScaled(value, decimals, 'Amount');
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const factor = 10n ** BigInt(decimals);
  const whole = String(abs / factor);
  const fraction = String(abs % factor).padStart(decimals, '0');
  const lastThree = whole.length > 3 ? whole.slice(-3) : whole;
  let rest = whole.length > 3 ? whole.slice(0, -3) : '';
  const groups = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  const grouped = groups.length ? `${groups.join(',')},${lastThree}` : lastThree;
  return `${negative ? '-' : ''}${grouped}${decimals ? `.${fraction}` : ''}`;
}
