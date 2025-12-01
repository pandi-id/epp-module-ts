/**
 * EPP Fee Extension Types
 * Referensi: RFC 8748 - EPP Fee Extension
 * 
 * Fee extension memungkinkan clients untuk query dan receive information
 * tentang fees yang terkait dengan EPP commands.
 */

/**
 * Fee Command Types
 * Referensi: RFC 8748 Section 3.1
 */
export type FeeCommand = 
  | 'create'
  | 'renew'
  | 'transfer'
  | 'restore'
  | 'update';

/**
 * Fee Currency Codes
 * ISO 4217 3-letter currency codes
 */
export type FeeCurrency = string; // 'USD', 'EUR', 'IDR', etc.

/**
 * Fee Period
 * Referensi: RFC 8748 Section 3.2
 */
export interface FeePeriod {
  /**
   * Number of units
   */
  value: number;
  
  /**
   * Unit type: years or months
   */
  unit: 'y' | 'm';
}

/**
 * Fee Structure
 * Referensi: RFC 8748 Section 3.3
 */
export interface Fee {
  /**
   * Fee amount
   * Decimal string (e.g., "10.00")
   */
  fee: string;
  
  /**
   * Fee description/name
   */
  description?: string;
  
  /**
   * Whether fee is refundable
   */
  refundable?: boolean;
  
  /**
   * Grace period for refund (in format like "P5D" for 5 days)
   */
  gracePeriod?: string;
  
  /**
   * Applied status
   * - immediate: Fee charged immediately
   * - delayed: Fee charged later
   */
  applied?: 'immediate' | 'delayed';
}

/**
 * Fee Check Request
 * Referensi: RFC 8748 Section 4.1
 */
export interface FeeCheckRequest {
  /**
   * Domain name(s) to check
   */
  domain?: string | string[];
  
  /**
   * Command type
   */
  command: FeeCommand;
  
  /**
   * Period for the operation
   */
  period?: FeePeriod;
  
  /**
   * Currency code
   */
  currency?: FeeCurrency;
  
  /**
   * Fee class (for tiered pricing)
   */
  class?: string;
}

/**
 * Fee Check Result
 * Referensi: RFC 8748 Section 4.1
 */
export interface FeeCheckResult {
  /**
   * Domain name
   */
  domain: string;
  
  /**
   * Command type
   */
  command: FeeCommand;
  
  /**
   * Period
   */
  period?: FeePeriod;
  
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
  
  /**
   * Whether domain is available at this price
   */
  avail?: boolean;
  
  /**
   * Reason if not available
   */
  reason?: string;
}

/**
 * Fee Info Response
 * Referensi: RFC 8748 Section 4.2
 */
export interface FeeInfo {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Period
   */
  period?: FeePeriod;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Create Request
 * Referensi: RFC 8748 Section 4.3
 */
export interface FeeCreateRequest {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Renew Request
 * Referensi: RFC 8748 Section 4.4
 */
export interface FeeRenewRequest {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Transfer Request
 * Referensi: RFC 8748 Section 4.5
 */
export interface FeeTransferRequest {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Period
   */
  period?: FeePeriod;
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Update Request
 * Referensi: RFC 8748 Section 4.6
 */
export interface FeeUpdateRequest {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Restore Request
 */
export interface FeeRestoreRequest {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Fee details
   */
  fee: Fee[];
  
  /**
   * Fee class
   */
  class?: string;
}

/**
 * Fee Delete Response
 * Referensi: RFC 8748 Section 4.7
 */
export interface FeeDeleteResponse {
  /**
   * Currency code
   */
  currency: FeeCurrency;
  
  /**
   * Credit amount (if any)
   */
  credit?: string;
  
  /**
   * Credit description
   */
  creditDescription?: string;
  
  /**
   * Balance after delete
   */
  balance?: string;
}

/**
 * Fee Credit
 * For refunds or credits
 */
export interface FeeCredit {
  /**
   * Credit amount
   */
  amount: string;
  
  /**
   * Description
   */
  description?: string;
  
  /**
   * Currency
   */
  currency: FeeCurrency;
}

/**
 * Fee Balance
 * Account balance information
 */
export interface FeeBalance {
  /**
   * Current balance
   */
  amount: string;
  
  /**
   * Currency
   */
  currency: FeeCurrency;
  
  /**
   * Credit limit (if any)
   */
  creditLimit?: string;
  
  /**
   * Available credit
   */
  availableCredit?: string;
}

/**
 * Fee namespace
 */
export const FEE_NAMESPACE = 'urn:ietf:params:xml:ns:epp:fee-1.0';
export const FEE_NAMESPACE_0_11 = 'urn:ietf:params:xml:ns:fee-0.11';

/**
 * Validate currency code (ISO 4217)
 */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Parse fee amount to number
 */
export function parseFeeAmount(amount: string): number {
  return parseFloat(amount);
}

/**
 * Format fee amount
 */
export function formatFeeAmount(amount: number, decimals: number = 2): string {
  return amount.toFixed(decimals);
}

/**
 * Calculate total fees
 */
export function calculateTotalFees(fees: Fee[]): number {
  return fees.reduce((total, fee) => total + parseFeeAmount(fee.fee), 0);
}

/**
 * Parse grace period duration
 * Format: ISO 8601 duration (e.g., "P5D" for 5 days)
 */
export function parseGracePeriod(duration: string): number {
  const match = duration.match(/P(\d+)([YMWD])/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'D': return value; // days
    case 'W': return value * 7; // weeks to days
    case 'M': return value * 30; // approximate months to days
    case 'Y': return value * 365; // approximate years to days
    default: return 0;
  }
}
