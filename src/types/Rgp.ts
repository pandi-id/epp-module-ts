/**
 * Registry Grace Period extension types and helpers (RFC 3915, namespace rgp-1.0).
 */

/** RGP status values (RFC 3915 Section 3.1). */
export type RgpStatus =
  | 'addPeriod'
  | 'autoRenewPeriod'
  | 'renewPeriod'
  | 'transferPeriod'
  | 'redemptionPeriod'
  | 'pendingRestore'
  | 'pendingDelete';

/** Restore operation: request a restore, or submit the restore report. */
export type RgpRequestType = 'request' | 'report';

/** An RGP status as returned by the server. */
export interface RgpStatusInfo {
  s: RgpStatus;
  lang?: string;
  message?: string;
}

/** RGP data returned by domain info (`<rgp:infData>`) and update (`<rgp:upData>`). */
export interface RgpInfo {
  rgpStatus: RgpStatusInfo[];
}

/** Text with an optional language tag. */
export interface RgpStatement {
  text: string;
  lang?: string;
}

/**
 * Restore report (RFC 3915 Section 4.2.5), submitted after a restore request
 * succeeded.
 */
export interface RgpRestoreReport {
  /** Copy of the registration data before the domain was deleted. */
  preData: string;
  /** Copy of the registration data after the domain was restored. */
  postData: string;
  /** When the domain was deleted. */
  delTime: string | Date;
  /** When the domain was restored. */
  resTime: string | Date;
  /** Why the domain was restored. */
  resReason: string | RgpStatement;
  /**
   * The two statements RFC 3915 requires: first, that the domain was not
   * restored to assume the rights to use or sell it; second, that the
   * report is factual to the best of the client's knowledge.
   */
  statement: Array<string | RgpStatement>;
  /** Supporting information. */
  other?: string;
}

/** Grace period lengths in days. */
export interface GracePeriodConfig {
  addPeriod: number;
  renewPeriod: number;
  autoRenewPeriod: number;
  transferPeriod: number;
  redemptionPeriod: number;
  pendingDelete: number;
}

/** Grace periods used by ICANN gTLD registry agreements. Registries may differ. */
export const DEFAULT_GRACE_PERIODS: GracePeriodConfig = {
  addPeriod: 5,
  renewPeriod: 5,
  autoRenewPeriod: 45,
  transferPeriod: 5,
  redemptionPeriod: 30,
  pendingDelete: 5,
};

export const RGP_NAMESPACE = 'urn:ietf:params:xml:ns:rgp-1.0';

/** Whether the status is one of the add, auto-renew, renew or transfer grace periods. */
export function isInGracePeriod(status: RgpStatus): boolean {
  return ['addPeriod', 'autoRenewPeriod', 'renewPeriod', 'transferPeriod'].includes(status);
}

/** Whether the domain is in the redemption period or awaiting a restore report. */
export function isInRedemption(status: RgpStatus): boolean {
  return status === 'redemptionPeriod' || status === 'pendingRestore';
}

export function isPendingDelete(status: RgpStatus): boolean {
  return status === 'pendingDelete';
}

/** Whether a restore may be requested: only during the redemption period. */
export function canRestore(status: RgpStatus): boolean {
  return status === 'redemptionPeriod';
}

export function calculateGracePeriodEnd(startDate: Date, gracePeriodDays: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + gracePeriodDays);
  return endDate;
}

export function isWithinGracePeriod(startDate: Date, currentDate: Date, gracePeriodDays: number): boolean {
  return currentDate <= calculateGracePeriodEnd(startDate, gracePeriodDays);
}

export function getRemainingGracePeriodDays(startDate: Date, currentDate: Date, gracePeriodDays: number): number {
  const remainingMs = calculateGracePeriodEnd(startDate, gracePeriodDays).getTime() - currentDate.getTime();
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check a restore report against RFC 3915 Section 4.2.5: all elements
 * present, valid timestamps with the deletion before the restore, and the
 * two required statements.
 */
export function validateRestoreReport(report: RgpRestoreReport): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!report.preData || report.preData.trim() === '') errors.push('preData is required');
  if (!report.postData || report.postData.trim() === '') errors.push('postData is required');

  const delTime = toDate(report.delTime);
  const resTime = toDate(report.resTime);
  if (!report.delTime) errors.push('delTime is required');
  else if (!delTime) errors.push('delTime must be a valid date-time');
  if (!report.resTime) errors.push('resTime is required');
  else if (!resTime) errors.push('resTime must be a valid date-time');
  if (delTime && resTime && resTime < delTime) errors.push('resTime must not be before delTime');

  const reason = typeof report.resReason === 'string' ? report.resReason : report.resReason?.text;
  if (!reason || reason.trim() === '') errors.push('resReason is required');

  const statements = report.statement ?? [];
  if (statements.length !== 2) {
    errors.push('Exactly two statements are required (RFC 3915 Section 4.2.5)');
  }
  statements.forEach((statement, index) => {
    const text = typeof statement === 'string' ? statement : statement?.text;
    if (!text || text.trim() === '') errors.push(`Statement ${index + 1} text is required`);
  });

  return { valid: errors.length === 0, errors };
}

function toDate(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
