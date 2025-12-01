/**
 * EPP RGP (Registry Grace Period) Extension Types
 * Referensi: RFC 3915 - Domain Registry Grace Period Mapping for EPP
 * 
 * RGP extension mendukung grace period operations untuk domain lifecycle:
 * - Add Grace Period (AGP)
 * - Renew Grace Period (RGP)
 * - Auto Renew Grace Period
 * - Transfer Grace Period (TGP)
 * - Redemption Grace Period
 * - Pending Delete
 */

/**
 * RGP Status Types
 * Referensi: RFC 3915 Section 2
 */
export type RgpStatus = 
  | 'addPeriod'           // Add Grace Period (typically 5 days)
  | 'autoRenewPeriod'     // Auto-Renew Grace Period
  | 'renewPeriod'         // Renew Grace Period
  | 'transferPeriod'      // Transfer Grace Period
  | 'redemptionPeriod'    // Redemption Grace Period (30 days)
  | 'pendingRestore'      // Pending restore
  | 'pendingDelete';      // Pending delete (5 days)

/**
 * RGP Request Types
 * Referensi: RFC 3915 Section 3.2
 */
export type RgpRequestType = 
  | 'request'             // Request restore
  | 'report';             // Submit restore report

/**
 * RGP Report Types
 */
export type RgpReportType = 
  | 'preData'             // Pre-delete data
  | 'postData';           // Post-restore data

/**
 * RGP Status Information
 * Referensi: RFC 3915 Section 2.1
 */
export interface RgpStatusInfo {
  /**
   * RGP status
   */
  s: RgpStatus;
  
  /**
   * Optional language
   */
  lang?: string;
  
  /**
   * Optional status message
   */
  message?: string;
}

/**
 * RGP Update Request
 * Referensi: RFC 3915 Section 3.2
 */
export interface RgpUpdateRequest {
  /**
   * Restore operation
   */
  restore: {
    /**
     * Operation type
     */
    op: RgpRequestType;
    
    /**
     * Restore report (required for op='report')
     */
    report?: RgpRestoreReport;
  };
}

/**
 * RGP Restore Report
 * Referensi: RFC 3915 Section 3.2.2
 */
export interface RgpRestoreReport {
  /**
   * Pre-delete registration date
   */
  preData: string;
  
  /**
   * Post-restore registration date
   */
  postData: string;
  
  /**
   * Deleted date
   */
  delTime: string;
  
  /**
   * Restore request date
   */
  resTime: string;
  
  /**
   * Reason for restore
   */
  resReason: string;
  
  /**
   * Statement describing restoration
   */
  statement: RgpStatement[];
  
  /**
   * Other relevant information
   */
  other?: string;
}

/**
 * RGP Statement
 * Referensi: RFC 3915 Section 3.2.2
 */
export interface RgpStatement {
  /**
   * Statement text
   */
  text: string;
  
  /**
   * Language (default: 'en')
   */
  lang?: string;
}

/**
 * RGP Info Response
 * Referensi: RFC 3915 Section 3.1
 */
export interface RgpInfo {
  /**
   * RGP status(es)
   */
  rgpStatus: RgpStatusInfo[];
}

/**
 * RGP Poll Message
 * For pending delete/restore notifications
 */
export interface RgpPollMessage {
  /**
   * Domain name
   */
  name: string;
  
  /**
   * RGP status
   */
  rgpStatus: RgpStatus;
  
  /**
   * Request date
   */
  reqDate?: string;
  
  /**
   * Report due date
   */
  reportDueDate?: string;
}

/**
 * Grace Period Configuration
 */
export interface GracePeriodConfig {
  /**
   * Add Grace Period duration (days)
   * Typical: 5 days
   */
  addPeriod: number;
  
  /**
   * Renew Grace Period duration (days)
   * Typical: 5 days
   */
  renewPeriod: number;
  
  /**
   * Auto-Renew Grace Period duration (days)
   * Typical: 45 days
   */
  autoRenewPeriod: number;
  
  /**
   * Transfer Grace Period duration (days)
   * Typical: 5 days
   */
  transferPeriod: number;
  
  /**
   * Redemption Grace Period duration (days)
   * Typical: 30 days
   */
  redemptionPeriod: number;
  
  /**
   * Pending Delete duration (days)
   * Typical: 5 days
   */
  pendingDelete: number;
}

/**
 * Default Grace Period Configuration
 * Based on ICANN consensus policy
 */
export const DEFAULT_GRACE_PERIODS: GracePeriodConfig = {
  addPeriod: 5,
  renewPeriod: 5,
  autoRenewPeriod: 45,
  transferPeriod: 5,
  redemptionPeriod: 30,
  pendingDelete: 5
};

/**
 * RGP namespace
 */
export const RGP_NAMESPACE = 'urn:ietf:params:xml:ns:rgp-1.0';

/**
 * Check if domain is in grace period
 */
export function isInGracePeriod(status: RgpStatus): boolean {
  return [
    'addPeriod',
    'autoRenewPeriod',
    'renewPeriod',
    'transferPeriod'
  ].includes(status);
}

/**
 * Check if domain is in redemption
 */
export function isInRedemption(status: RgpStatus): boolean {
  return status === 'redemptionPeriod' || status === 'pendingRestore';
}

/**
 * Check if domain is pending delete
 */
export function isPendingDelete(status: RgpStatus): boolean {
  return status === 'pendingDelete';
}

/**
 * Check if restore is allowed
 */
export function canRestore(status: RgpStatus): boolean {
  return status === 'redemptionPeriod';
}

/**
 * Calculate grace period end date
 */
export function calculateGracePeriodEnd(
  startDate: Date,
  gracePeriodDays: number
): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + gracePeriodDays);
  return endDate;
}

/**
 * Check if date is within grace period
 */
export function isWithinGracePeriod(
  startDate: Date,
  currentDate: Date,
  gracePeriodDays: number
): boolean {
  const endDate = calculateGracePeriodEnd(startDate, gracePeriodDays);
  return currentDate <= endDate;
}

/**
 * Get remaining grace period days
 */
export function getRemainingGracePeriodDays(
  startDate: Date,
  currentDate: Date,
  gracePeriodDays: number
): number {
  const endDate = calculateGracePeriodEnd(startDate, gracePeriodDays);
  const remainingMs = endDate.getTime() - currentDate.getTime();
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  return Math.max(0, remainingDays);
}

/**
 * Validate restore report
 */
export function validateRestoreReport(report: RgpRestoreReport): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check required dates
  if (!report.preData) errors.push('preData is required');
  if (!report.postData) errors.push('postData is required');
  if (!report.delTime) errors.push('delTime is required');
  if (!report.resTime) errors.push('resTime is required');
  
  // Check reason
  if (!report.resReason || report.resReason.trim().length === 0) {
    errors.push('resReason is required');
  }
  
  // Check statements
  if (!report.statement || report.statement.length === 0) {
    errors.push('At least one statement is required');
  } else {
    report.statement.forEach((stmt, index) => {
      if (!stmt.text || stmt.text.trim().length === 0) {
        errors.push(`Statement ${index + 1} text is required`);
      }
    });
  }
  
  // Validate date order
  try {
    const preDate = new Date(report.preData);
    const delDate = new Date(report.delTime);
    const resDate = new Date(report.resTime);
    const postDate = new Date(report.postData);
    
    if (delDate < preDate) {
      errors.push('delTime must be after preData');
    }
    if (resDate < delDate) {
      errors.push('resTime must be after delTime');
    }
    if (postDate < resDate) {
      errors.push('postData must be after resTime');
    }
  } catch (e) {
    errors.push('Invalid date format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
