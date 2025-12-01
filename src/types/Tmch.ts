/**
 * EPP TMCH (Trademark Clearinghouse) Extension Types
 * Referensi: ICANN TMCH Functional Specifications
 * 
 * TMCH extension untuk validasi trademark claims dan sunrise applications.
 */

/**
 * TMCH Mark Type
 */
export type TmchMarkType = 
  | 'trademark'           // Registered trademark
  | 'treatyOrStatute'     // Treaty or statute protection
  | 'court';              // Court-validated mark

/**
 * TMCH Document Type
 */
export type TmchDocumentType =
  | 'tmLaw'              // Trademark law
  | 'tmOther'            // Other trademark document
  | 'declaration'        // Declaration
  | 'other';             // Other document type

/**
 * TMCH Contact Type
 */
export type TmchContactType =
  | 'owner'              // Trademark owner
  | 'agent'              // Agent/representative
  | 'thirdparty';        // Third party

/**
 * TMCH Trademark Data
 * Referensi: TMCH Functional Specs Section 3
 */
export interface TmchMark {
  /**
   * Mark identifier (SMD ID)
   */
  id: string;
  
  /**
   * Mark type
   */
  markType: TmchMarkType;
  
  /**
   * Mark name/text
   */
  markName: string;
  
  /**
   * Trademark holder information
   */
  holder: TmchHolder[];
  
  /**
   * Contact information
   */
  contact?: TmchContact[];
  
  /**
   * Jurisdiction (country code)
   * ISO 3166-1 alpha-2
   */
  jurisdiction?: string;
  
  /**
   * Nice classification classes
   */
  class?: number[];
  
  /**
   * Trademark labels
   */
  label?: string[];
  
  /**
   * Goods and services
   */
  goodsAndServices?: string;
  
  /**
   * Application/registration number
   */
  regNum?: string;
  
  /**
   * Application date
   */
  apDate?: string;
  
  /**
   * Registration date
   */
  regDate?: string;
  
  /**
   * Expiration date
   */
  exDate?: string;
}

/**
 * TMCH Holder Information
 */
export interface TmchHolder {
  /**
   * Holder name
   */
  name?: string;
  
  /**
   * Organization name
   */
  org?: string;
  
  /**
   * Address information
   */
  addr?: {
    street?: string[];
    city?: string;
    sp?: string;        // State/province
    pc?: string;        // Postal code
    cc: string;         // Country code
  };
  
  /**
   * Voice phone
   */
  voice?: string;
  
  /**
   * Fax number
   */
  fax?: string;
  
  /**
   * Email address
   */
  email?: string;
  
  /**
   * Entitlement (individual, organization, etc.)
   */
  entitlement?: string;
}

/**
 * TMCH Contact Information
 */
export interface TmchContact {
  /**
   * Contact type
   */
  type: TmchContactType;
  
  /**
   * Contact name
   */
  name: string;
  
  /**
   * Organization
   */
  org?: string;
  
  /**
   * Address
   */
  addr?: {
    street?: string[];
    city?: string;
    sp?: string;
    pc?: string;
    cc: string;
  };
  
  /**
   * Voice phone
   */
  voice?: string;
  
  /**
   * Fax
   */
  fax?: string;
  
  /**
   * Email
   */
  email: string;
}

/**
 * TMCH Document
 */
export interface TmchDocument {
  /**
   * Document type
   */
  docType: TmchDocumentType;
  
  /**
   * File name
   */
  fileName: string;
  
  /**
   * File type/MIME type
   */
  fileType: string;
  
  /**
   * Base64-encoded file content
   */
  fileContent: string;
}

/**
 * TMCH Claims Notice
 * Referensi: TMCH Functional Specs Section 5
 */
export interface TmchClaimsNotice {
  /**
   * Notice ID
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ-xxxxxxxx
   */
  id: string;
  
  /**
   * Notice expiration timestamp
   * ISO 8601 format
   */
  notAfter: string;
  
  /**
   * Notice acceptance timestamp
   * ISO 8601 format
   */
  acceptedDate: string;
  
  /**
   * Label that triggered the notice
   */
  label: string;
  
  /**
   * Trademark claims
   */
  claims?: TmchClaim[];
}

/**
 * TMCH Claim
 */
export interface TmchClaim {
  /**
   * Mark identifier
   */
  markName: string;
  
  /**
   * Jurisdiction
   */
  jurisdiction: string;
  
  /**
   * Goods and services
   */
  goodsAndServices?: string;
  
  /**
   * Holder name
   */
  holderName?: string;
  
  /**
   * Contact email
   */
  holderEmail?: string;
}

/**
 * SMD (Signed Mark Data) File
 * Referensi: TMCH Functional Specs Section 4
 */
export interface TmchSMD {
  /**
   * SMD ID
   */
  id: string;
  
  /**
   * Issuer (TMCH provider)
   */
  issuer: string;
  
  /**
   * Not before timestamp
   */
  notBefore: string;
  
  /**
   * Not after timestamp
   */
  notAfter: string;
  
  /**
   * Base64-encoded signed mark data
   */
  encodedSignedMark: string;
}

/**
 * TMCH Sunrise Application
 */
export interface TmchSunriseApplication {
  /**
   * Domain name being applied for
   */
  name: string;
  
  /**
   * SMD file(s)
   */
  smd: TmchSMD[];
  
  /**
   * Application ID (assigned by registry)
   */
  applicationID?: string;
}

/**
 * TMCH Claims Check Request
 */
export interface TmchClaimsCheckRequest {
  /**
   * Domain names to check for claims
   */
  names: string[];
}

/**
 * TMCH Claims Check Result
 */
export interface TmchClaimsCheckResult {
  /**
   * Domain name checked
   */
  name: string;
  
  /**
   * Whether claims exist
   */
  claimsExist: boolean;
  
  /**
   * Claim key for retrieving notice
   */
  claimKey?: string;
}

/**
 * TMCH Validation Result
 */
export interface TmchValidationResult {
  /**
   * Whether SMD is valid
   */
  valid: boolean;
  
  /**
   * Validation code
   */
  code?: string;
  
  /**
   * Validation message
   */
  message?: string;
  
  /**
   * Mark details (if valid)
   */
  mark?: TmchMark;
}

/**
 * TMCH namespace
 */
export const TMCH_NAMESPACE = 'urn:ietf:params:xml:ns:tmch-1.0';

/**
 * Validate SMD format
 */
export function isValidSMDFormat(smdId: string): boolean {
  // SMD ID format: YYYYMMDD-XXXXXX-XXXX
  const smdPattern = /^\d{8}-[A-Z0-9]{6}-\d{4}$/;
  return smdPattern.test(smdId);
}

/**
 * Validate Notice ID format
 */
export function isValidNoticeID(noticeId: string): boolean {
  // Notice ID format: YYYY-MM-DDTHH:mm:ss.sssZ-xxxxxxxx
  const noticePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-f0-9]{8}$/;
  return noticePattern.test(noticeId);
}

/**
 * Check if trademark is expired
 */
export function isTmchMarkExpired(exDate: string): boolean {
  return new Date(exDate) < new Date();
}

/**
 * Validate Nice Classification class
 */
export function isValidNiceClass(classNumber: number): boolean {
  return classNumber >= 1 && classNumber <= 45;
}
