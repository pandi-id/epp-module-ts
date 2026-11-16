import type { Period, PeriodInput } from './Common';

/**
 * Registry Fee extension types and helpers (RFC 8748, namespace
 * urn:ietf:params:xml:ns:epp:fee-1.0).
 */

/** Commands that can carry a fee. */
export type FeeCommand = 'create' | 'renew' | 'transfer' | 'restore' | 'update';

/** Command names accepted in a fee check (RFC 8748 Section 3.1). */
export type FeeCommandName = FeeCommand | 'delete' | 'custom';

export type FeeCurrency = string;

export interface FeePeriod {
  value: number;
  unit: 'y' | 'm';
}

/** A fee (RFC 8748 Section 3.4). */
export interface Fee {
  /** Amount, as a decimal string. */
  fee: string;
  description?: string;
  lang?: string;
  refundable?: boolean;
  /** Grace period as an xs:duration, e.g. "P5D". */
  gracePeriod?: string;
  applied?: 'immediate' | 'delayed';
}

/** A credit: a negative amount (RFC 8748 Section 3.4). */
export interface FeeCredit {
  amount: string;
  description?: string;
  lang?: string;
}

/** A command to price in a fee check. */
export interface FeeCheckCommand {
  name: FeeCommandName;
  /** Name of a custom command, when `name` is "custom". */
  customName?: string;
  phase?: string;
  subphase?: string;
  period?: PeriodInput;
}

/** Fee check data added to a domain check (RFC 8748 Section 5.1.1). */
export interface FeeCheckExtension {
  currency?: FeeCurrency;
  commands: Array<FeeCommandName | FeeCheckCommand>;
}

/** Request for `EppClient.feeCheck()`. */
export interface FeeCheckRequest {
  /** Domain name(s) to price. */
  domain: string | string[];
  /** Command(s) to price. Defaults to "create". */
  command?: FeeCommandName | FeeCheckCommand | Array<FeeCommandName | FeeCheckCommand>;
  /** Period applied to commands given by name. */
  period?: PeriodInput;
  currency?: FeeCurrency;
}

/** Fee the client agrees to pay for a transform command (RFC 8748 Section 5.2). */
export interface FeeSubmission {
  currency?: FeeCurrency;
  /** Total amount, written as a single `<fee:fee>` element. */
  amount?: string | number;
  /** Individual fees, instead of `amount`. */
  fees?: Fee[];
}

/** Price of one command for one object. */
export interface FeeCommandResult {
  name: FeeCommandName;
  customName?: string;
  phase?: string;
  subphase?: string;
  /** Whether this is the standard (non-premium) price. */
  standard: boolean;
  period?: Period;
  fees: Fee[];
  credits: FeeCredit[];
  reason?: string;
}

/** Fee information for one object in a fee check response. */
export interface FeeCheckItem {
  objID: string;
  /** False when the server cannot price the object; see `reason`. */
  available: boolean;
  /** Fee class, e.g. "premium". */
  class?: string;
  commands: FeeCommandResult[];
  reason?: string;
}

/** Fee check response (`<fee:chkData>`). */
export interface FeeCheckData {
  currency: FeeCurrency;
  items: FeeCheckItem[];
}

/** Fee data returned by a transform command (`<fee:creData>` and similar). */
export interface FeeTransformData {
  currency?: FeeCurrency;
  period?: Period;
  fees: Fee[];
  credits: FeeCredit[];
  balance?: string;
  creditLimit?: string;
}

export const FEE_NAMESPACE = 'urn:ietf:params:xml:ns:epp:fee-1.0';

/** Whether the code is three uppercase letters, the ISO 4217 format. */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export function parseFeeAmount(amount: string): number {
  return parseFloat(amount);
}

export function formatFeeAmount(amount: number, decimals = 2): string {
  return amount.toFixed(decimals);
}

/**
 * Sum of the given fees. The sum is computed in exact decimal arithmetic and
 * converted to a number at the end; use {@link sumFeeAmounts} to keep it
 * exact.
 */
export function calculateTotalFees(fees: Fee[]): number {
  const exact = sumFeeAmounts(fees);
  return exact === undefined ? fees.reduce((total, fee) => total + parseFeeAmount(fee.fee), 0) : Number(exact);
}

/**
 * Exact decimal sum of the given fees, e.g. "10.30" for "10.10" and "0.20".
 * Returns undefined when an amount is not a decimal number.
 */
export function sumFeeAmounts(fees: Array<Pick<Fee, 'fee'>>): string | undefined {
  const parsed: Array<{ negative: boolean; digits: string; scale: number }> = [];
  for (const { fee } of fees) {
    const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(fee.trim());
    if (!match || (match[2] === '' && !match[3])) return undefined;
    parsed.push({ negative: match[1] === '-', digits: `${match[2]}${match[3] ?? ''}` || '0', scale: (match[3] ?? '').length });
  }
  const scale = Math.max(0, ...parsed.map((p) => p.scale));
  let total = BigInt(0);
  for (const p of parsed) {
    const value = BigInt(p.digits) * BigInt(10) ** BigInt(scale - p.scale);
    total += p.negative ? -value : value;
  }
  const negative = total < BigInt(0);
  const digits = (negative ? -total : total).toString().padStart(scale + 1, '0');
  const result = scale > 0 ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return negative ? `-${result}` : result;
}

/**
 * Convert a simple xs:duration ("P5D", "P2W", "P1M", "P1Y") to days. Months
 * count as 30 days and years as 365. Returns 0 for other formats.
 */
export function parseGracePeriod(duration: string): number {
  const match = duration.match(/^P(\d+)([YMWD])$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'D': return value;
    case 'W': return value * 7;
    case 'M': return value * 30;
    case 'Y': return value * 365;
    default: return 0;
  }
}
