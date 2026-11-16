/**
 * Launch Phase extension types (RFC 8334, namespace launch-1.0), used for
 * ICANN sunrise and trademark claims periods.
 */

/** Launch phase (RFC 8334 Section 2.3). */
export type LaunchPhase = 'sunrise' | 'landrush' | 'claims' | 'open' | 'custom';

/** Application status (RFC 8334 Section 2.4). */
export type LaunchStatus =
  | 'pendingValidation'
  | 'validated'
  | 'invalid'
  | 'pendingAllocation'
  | 'allocated'
  | 'rejected'
  | 'custom';

/**
 * Acceptance of a trademark claims notice (RFC 8334 Section 3.3.2), required
 * when registering a name that matches a mark during the claims period.
 */
export interface LaunchNotice {
  /** Notice identifier; for TMCH notices, the TCNID (RFC 9361). */
  noticeID: string;
  /** Who issued the notice; "tmch" for the ICANN Trademark Clearinghouse. */
  validatorID?: string;
  /** Expiry of the notice. */
  notAfter: string | Date;
  /** When the registrant accepted the notice. */
  acceptedDate: string | Date;
}

/** Mark validation code (RFC 8334 Section 2.6.1). */
export interface LaunchCodeMark {
  code: string;
  validatorID?: string;
}

/** Launch data for a domain create (RFC 8334 Section 3.3). */
export interface LaunchCreate {
  phase: LaunchPhase;
  /** Sub-phase name, required when `phase` is "custom". */
  subPhase?: string;
  /** Create an application, or register directly. Server default when omitted. */
  type?: 'application' | 'registration';
  /**
   * Base64 encoded signed mark(s) (RFC 7848) for sunrise. Pass the base64
   * block of an SMD file; see `extractEncodedSmd()`.
   */
  encodedSignedMark?: string | string[];
  /** Mark validation codes, as an alternative to signed marks. */
  codeMark?: LaunchCodeMark | LaunchCodeMark[];
  /** Accepted claims notice(s). */
  notice?: LaunchNotice | LaunchNotice[];
}

/** Launch check form (RFC 8334 Section 3.1). */
export interface LaunchCheck {
  /** "claims" (default), "avail" or "trademark". */
  type?: 'claims' | 'avail' | 'trademark';
  phase?: LaunchPhase;
  subPhase?: string;
}

/** Claim key used to fetch a claims notice from the validator. */
export interface LaunchClaimKey {
  key: string;
  validatorID?: string;
}

/** Per-name result of a claims check. */
export interface LaunchCheckResult {
  name: string;
  /** Whether a trademark claim exists for the name. */
  exists: boolean;
  claimKeys: LaunchClaimKey[];
}

/** Claims check response (`<launch:chkData>`). */
export interface LaunchCheckData {
  phase?: LaunchPhase;
  subPhase?: string;
  results: LaunchCheckResult[];
}

/** Launch info request (RFC 8334 Section 3.2). */
export interface LaunchInfoRequest {
  phase: LaunchPhase;
  subPhase?: string;
  applicationID?: string;
  /** Ask for the mark data to be included. */
  includeMark?: boolean;
}

/** Launch info response (`<launch:infData>`). */
export interface LaunchInfoData {
  phase: LaunchPhase;
  subPhase?: string;
  applicationID?: string;
  status?: { s: LaunchStatus; name?: string; lang?: string; message?: string };
  /** Outer XML of each returned mark (RFC 7848 `<mark:mark>`). */
  marks: string[];
}

/** Identifies a launch application, for update and delete (RFC 8334 Section 3.4-3.5). */
export interface LaunchIdContainer {
  phase: LaunchPhase;
  subPhase?: string;
  applicationID: string;
}

/** Launch create response (`<launch:creData>`). */
export interface LaunchCreateData {
  phase: LaunchPhase;
  subPhase?: string;
  applicationID?: string;
}

export const LAUNCH_NAMESPACE = 'urn:ietf:params:xml:ns:launch-1.0';

export function isValidLaunchPhase(phase: string): phase is LaunchPhase {
  return ['sunrise', 'landrush', 'claims', 'open', 'custom'].includes(phase);
}

export function isValidLaunchStatus(status: string): status is LaunchStatus {
  return ['pendingValidation', 'validated', 'invalid', 'pendingAllocation', 'allocated', 'rejected', 'custom'].includes(
    status,
  );
}
