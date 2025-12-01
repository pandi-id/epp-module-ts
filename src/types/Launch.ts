/**
 * EPP Launch Extension Types
 * Referensi: RFC 8334 - Launch Phase Mapping for EPP
 * 
 * Launch extension mendukung operasi domain registry selama launch phases,
 * termasuk sunrise periods, landrush, dan general availability.
 */

/**
 * Launch Phase Types
 * Referensi: RFC 8334 Section 2.1
 */
export type LaunchPhase = 
  | 'sunrise'        // Trademark holder priority period
  | 'landrush'       // Limited registration period
  | 'claims'         // Claims notification period
  | 'open'           // General availability
  | 'custom';        // Registry-defined phase

/**
 * Launch Application Status
 * Referensi: RFC 8334 Section 3.2.1
 */
export type LaunchStatus = 
  | 'pendingValidation'    // Application received, pending validation
  | 'validated'            // Application validated
  | 'invalid'              // Application invalid
  | 'pendingAllocation'    // Pending allocation decision
  | 'allocated'            // Successfully allocated
  | 'rejected'             // Application rejected
  | 'custom';              // Registry-defined status

/**
 * Launch Notice Structure
 * Referensi: RFC 8334 Section 2.2 - Claims Notice
 * 
 * Notice yang diberikan kepada applicants tentang existing trademark
 * rights untuk domain yang diminta.
 */
export interface LaunchNotice {
  /**
   * Notice identifier dari TMCH
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ-xxxxxxxx
   */
  noticeID: string;
  
  /**
   * Timestamp when notice was generated
   * ISO 8601 format
   */
  notAfter: string;
  
  /**
   * Timestamp when notice was accepted by applicant
   * ISO 8601 format
   */
  acceptedDate: string;
}

/**
 * Signed Mark Data (SMD)
 * Referensi: RFC 8334 Section 2.3
 * 
 * Digitally signed trademark information dari TMCH.
 */
export interface SignedMarkData {
  /**
   * Base64-encoded signed mark data
   * Obtained from TMCH system
   */
  encodedSignedMark: string;
}

/**
 * Launch Create Request
 * Referensi: RFC 8334 Section 3.1.1
 * 
 * Extension data untuk domain create selama launch phase.
 */
export interface LaunchCreateRequest {
  /**
   * Launch phase identifier
   */
  phase: {
    name: LaunchPhase;
    /**
     * Optional sub-phase or custom phase name
     */
    subPhase?: string;
  };
  
  /**
   * Application type
   * - application: Create application (not immediate registration)
   * - registration: Direct registration
   */
  type?: 'application' | 'registration';
  
  /**
   * Claims notice (required for claims phase)
   */
  notice?: LaunchNotice;
  
  /**
   * Signed mark data (required for sunrise)
   */
  signedMark?: SignedMarkData;
  
  /**
   * Marks for encoding mark information
   * Alternative to signedMark for some registries
   */
  mark?: TradeMark[];
}

/**
 * Launch Check Request
 * Referensi: RFC 8334 Section 3.1.2
 */
export interface LaunchCheckRequest {
  /**
   * Launch phase for check
   */
  phase: {
    name: LaunchPhase;
    subPhase?: string;
  };
  
  /**
   * Check type
   * - avail: Standard availability check
   * - claims: Claims check
   * - trademark: Trademark check
   */
  type?: 'avail' | 'claims' | 'trademark';
}

/**
 * Launch Check Result
 * Referensi: RFC 8334 Section 3.1.2
 */
export interface LaunchCheckResult {
  /**
   * Domain name checked
   */
  name: string;
  
  /**
   * Launch phase
   */
  phase: {
    name: LaunchPhase;
    subPhase?: string;
  };
  
  /**
   * Whether name is available
   */
  available?: boolean;
  
  /**
   * Claims check result
   */
  claimKey?: {
    /**
     * Claim key for retrieving notice
     */
    key: string;
  }[];
}

/**
 * Launch Info Response
 * Referensi: RFC 8334 Section 3.1.3
 */
export interface LaunchInfo {
  /**
   * Launch phase
   */
  phase: {
    name: LaunchPhase;
    subPhase?: string;
  };
  
  /**
   * Application ID (if type=application)
   */
  applicationID?: string;
  
  /**
   * Application status
   */
  status?: {
    s: LaunchStatus;
    /**
     * Optional status message
     */
    message?: string;
  };
  
  /**
   * Mark information
   */
  mark?: TradeMark[];
}

/**
 * Launch Update Request
 * Referensi: RFC 8334 Section 3.1.4
 */
export interface LaunchUpdateRequest {
  /**
   * Launch phase
   */
  phase: {
    name: LaunchPhase;
    subPhase?: string;
  };
  
  /**
   * Application ID to update
   */
  applicationID?: string;
}

/**
 * Launch Delete Request
 * Referensi: RFC 8334 Section 3.1.5
 */
export interface LaunchDeleteRequest {
  /**
   * Launch phase
   */
  phase: {
    name: LaunchPhase;
    subPhase?: string;
  };
  
  /**
   * Application ID to delete
   */
  applicationID?: string;
}

/**
 * Trademark Information
 * Referensi: RFC 8334 Section 2.3
 */
export interface TradeMark {
  /**
   * Trademark name
   */
  name: string;
  
  /**
   * Trademark identifier
   */
  id?: string;
  
  /**
   * Issuing authority
   */
  issuerInfo?: {
    /**
     * Organization name
     */
    org: string;
    
    /**
     * Country code (ISO 3166-1 alpha-2)
     */
    cc: string;
  };
  
  /**
   * Registration/application number
   */
  number?: string;
  
  /**
   * Registration date
   */
  regDate?: string;
  
  /**
   * Expiration date
   */
  exDate?: string;
  
  /**
   * Trademark class(es)
   * Nice Classification
   */
  class?: number[];
  
  /**
   * Trademark labels
   */
  label?: string[];
  
  /**
   * Goods and services description
   */
  goodsAndServices?: string;
}

/**
 * Launch Extension namespace
 */
export const LAUNCH_NAMESPACE = 'urn:ietf:params:xml:ns:launch-1.0';

/**
 * Launch Phase Validation
 */
export function isValidLaunchPhase(phase: string): phase is LaunchPhase {
  return ['sunrise', 'landrush', 'claims', 'open', 'custom'].includes(phase);
}

/**
 * Launch Status Validation
 */
export function isValidLaunchStatus(status: string): status is LaunchStatus {
  return [
    'pendingValidation',
    'validated', 
    'invalid',
    'pendingAllocation',
    'allocated',
    'rejected',
    'custom'
  ].includes(status);
}
