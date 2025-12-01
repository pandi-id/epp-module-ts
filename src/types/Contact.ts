/**
 * Postal Information Type
 * Referensi: RFC 5733 Section 2.2 - Contact Postal Information
 * 
 * Contact postal info MUST be provided in salah satu atau kedua forms:
 * - 'loc': Local format (using local character set)
 * - 'int': Internationalized format (using 7-bit ASCII)
 */
export type PostalInfoType = 'loc' | 'int';

/**
 * Contact Address
 * Referensi: RFC 5733 Section 2.2 - Contact Address
 */
export interface ContactAddress {
  /** 
   * Street address lines (RFC 5733 Section 2.2)
   * MUST contain 1-3 street address lines
   * Maximum 255 characters per line
   */
  street: string[];
  
  /** 
   * City (RFC 5733 Section 2.2)
   * REQUIRED - Maximum 255 characters
   */
  city: string;
  
  /** 
   * State/Province (RFC 5733 Section 2.2)
   * OPTIONAL - Maximum 255 characters
   * 2-character state/province code atau full name
   */
  sp?: string;
  
  /** 
   * Postal code (RFC 5733 Section 2.2)
   * OPTIONAL - Maximum 16 characters
   */
  pc?: string;
  
  /** 
   * Country code (RFC 5733 Section 2.2)
   * REQUIRED - MUST be 2-character ISO 3166-1 code (e.g., 'ID', 'US', 'GB')
   */
  cc: string;
}

/**
 * Contact Postal Information
 * Referensi: RFC 5733 Section 2.2 - Contact Postal Information
 * 
 * At least one form of postal info MUST be provided (loc or int).
 * Beberapa registries require both formats.
 */
export interface ContactPostalInfo {
  /** 
   * Postal info type (RFC 5733 Section 2.2)
   * 'loc' = Local character representation (e.g., UTF-8)
   * 'int' = International representation (7-bit ASCII)
   */
  type: PostalInfoType;
  
  /** 
   * Contact name (RFC 5733 Section 2.2)
   * REQUIRED - Maximum 255 characters
   * Individual name atau organization name
   */
  name: string;
  
  /** 
   * Organization name (RFC 5733 Section 2.2)
   * OPTIONAL - Maximum 255 characters
   */
  org?: string;
  
  /** 
   * Postal address (RFC 5733 Section 2.2)
   * REQUIRED
   */
  addr: ContactAddress;
}

/**
 * Contact Disclosure Preferences
 * Referensi: RFC 5733 Section 2.9 - Data Collection Policy
 * 
 * Mengatur visibility dari contact information dalam WHOIS/RDAP queries.
 */
export interface ContactDisclose {
  /** 
   * Disclosure flag (RFC 5733 Section 2.9)
   * 0 = Data SHOULD NOT be disclosed (hide specified fields)
   * 1 = Data MAY be disclosed (show specified fields)
   */
  flag: 0 | 1;
  
  /** Disclose/hide name field */
  name?: {
    type: PostalInfoType;
  };
  
  /** Disclose/hide organization field */
  org?: {
    type: PostalInfoType;
  };
  
  /** Disclose/hide address field */
  addr?: {
    type: PostalInfoType;
  };
  
  /** Disclose/hide voice telephone field */
  voice?: boolean;
  
  /** Disclose/hide fax number field */
  fax?: boolean;
  
  /** Disclose/hide email field */
  email?: boolean;
}

/**
 * Contact Create Request
 * Referensi: RFC 5733 Section 3.2.1 - EPP <create> Command
 * 
 * Create command provisions instance dari contact object.
 * Contact objects digunakan untuk associate individuals/organizations
 * dengan other objects (domains, hosts).
 */
export interface ContactCreateRequest {
  /** 
   * Contact identifier (RFC 5733 Section 3.2.1)
   * REQUIRED - Server-unique identifier chosen by client
   * MUST conform to: 3-16 chars, alphanumeric + hyphen
   * Cannot start/end with hyphen
   */
  id: string;
  
  /** 
   * Postal information (RFC 5733 Section 3.2.1)
   * REQUIRED - At least one form MUST be provided
   * Some registries require both 'loc' and 'int' forms
   */
  postalInfo: ContactPostalInfo | ContactPostalInfo[];
  
  /** 
   * Voice telephone number (RFC 5733 Section 3.2.1)
   * OPTIONAL - Format: +[country code].[area code][number] x[extension]
   * Example: +1.5551234567 atau +62.2112345678
   * Maximum 17 characters (excluding extension)
   */
  voice?: string;
  
  /** 
   * Fax number (RFC 5733 Section 3.2.1)
   * OPTIONAL - Same format as voice
   * Maximum 17 characters (excluding extension)
   */
  fax?: string;
  
  /** 
   * Email address (RFC 5733 Section 3.2.1)
   * REQUIRED - MUST be valid email format
   * Maximum 255 characters
   */
  email: string;
  
  /** 
   * Authorization information (RFC 5733 Section 3.2.1)
   * REQUIRED - Used untuk transfer authorization
   */
  authInfo: {
    pw: string;
  };
  
  /** 
   * Disclosure preferences (RFC 5733 Section 3.2.1)
   * OPTIONAL - Controls data disclosure policy
   */
  disclose?: ContactDisclose;
}

/**
 * Contact Update Request
 * Referensi: RFC 5733 Section 3.2.5 - EPP <update> Command
 * 
 * Update command mengubah information terkait contact object.
 */
export interface ContactUpdateRequest {
  /** 
   * Contact identifier untuk diupdate (RFC 5733 Section 3.2.5)
   */
  id: string;
  
  /** 
   * Elements untuk ditambahkan (RFC 5733 Section 3.2.5)
   * OPTIONAL <add> element
   */
  add?: {
    /** 
     * Status values untuk ditambahkan (RFC 5733 Section 2.3)
     * Values: 'clientDeleteProhibited', 'clientTransferProhibited',
     *         'clientUpdateProhibited'
     */
    status?: string[];
  };
  
  /** 
   * Elements untuk dihapus (RFC 5733 Section 3.2.5)
   * OPTIONAL <rem> element
   */
  rem?: {
    /** Status values untuk dihapus */
    status?: string[];
  };
  
  /** 
   * Elements untuk diubah (RFC 5733 Section 3.2.5)
   * OPTIONAL <chg> element
   */
  chg?: {
    /** New postal information */
    postalInfo?: ContactPostalInfo | ContactPostalInfo[];
    /** New voice telephone */
    voice?: string;
    /** New fax number */
    fax?: string;
    /** New email address */
    email?: string;
    /** New authorization information */
    authInfo?: {
      pw: string;
    };
    /** New disclosure preferences */
    disclose?: ContactDisclose;
  };
}

/**
 * Contact Check Result
 * Referensi: RFC 5733 Section 3.1.1 - EPP <check> Response
 */
export interface ContactCheckResult {
  /** Contact identifier */
  id: string;
  
  /** 
   * Availability status (RFC 5733 Section 3.1.1)
   * true = contact ID available untuk creation
   * false = contact ID already exists
   */
  available: boolean;
  
  /** Optional: Reason jika ID tidak available */
  reason?: string;
}

/**
 * Contact Transfer Request
 * Referensi: RFC 5733 Section 3.2.4 - EPP <transfer> Command
 * 
 * Transfer command provides query dan transform operations untuk contact transfers.
 */
export interface ContactTransferRequest {
  /** Contact identifier untuk ditransfer */
  id: string;
  
  /** 
   * Transfer operation (RFC 5733 Section 3.2.4)
   * 'query' = Query transfer status
   * 'request' = Request transfer
   * 'cancel' = Cancel pending transfer
   * 'approve' = Approve transfer request
   * 'reject' = Reject transfer request
   */
  op: 'query' | 'request' | 'cancel' | 'approve' | 'reject';
  
  /** 
   * Authorization information (RFC 5733 Section 3.2.4)
   * REQUIRED untuk 'request' operation
   */
  authInfo?: {
    pw: string;
    roid?: string;
  };
}

/**
 * Contact Information Response
 * Referensi: RFC 5733 Section 3.1.2 - EPP <info> Response
 * 
 * Info response berisi detailed information tentang contact object.
 */
export interface ContactInfo {
  /** Contact identifier (RFC 5733 Section 3.1.2) */
  id: string;
  
  /** 
   * Repository Object IDentifier (RFC 5733 Section 3.1.2)
   * Unique identifier assigned by server
   */
  roid: string;
  
  /** 
   * Contact status codes (RFC 5733 Section 2.3)
   * Possible values:
   * - 'clientDeleteProhibited', 'clientTransferProhibited', 'clientUpdateProhibited'
   * - 'serverDeleteProhibited', 'serverTransferProhibited', 'serverUpdateProhibited'
   * - 'linked', 'ok', 'pendingCreate', 'pendingDelete', 'pendingTransfer', 'pendingUpdate'
   */
  status: string[];
  
  /** Postal information (RFC 5733 Section 3.1.2) */
  postalInfo: ContactPostalInfo | ContactPostalInfo[];
  
  /** Voice telephone (RFC 5733 Section 3.1.2) */
  voice?: string;
  
  /** Fax number (RFC 5733 Section 3.1.2) */
  fax?: string;
  
  /** Email address (RFC 5733 Section 3.1.2) */
  email: string;
  
  /** Sponsoring client identifier (RFC 5733 Section 3.1.2) */
  clID: string;
  
  /** Creating client identifier (RFC 5733 Section 3.1.2) */
  crID: string;
  
  /** Creation date (RFC 5733 Section 3.1.2) - ISO 8601 format */
  crDate: string;
  
  /** Last updating client identifier (RFC 5733 Section 3.1.2) */
  upID?: string;
  
  /** Last update date (RFC 5733 Section 3.1.2) - ISO 8601 format */
  upDate?: string;
  
  /** Last transfer date (RFC 5733 Section 3.1.2) - ISO 8601 format */
  trDate?: string;
  
  /** Authorization information (RFC 5733 Section 3.1.2) */
  authInfo?: {
    pw: string;
  };
  
  /** Disclosure preferences (RFC 5733 Section 3.1.2) */
  disclose?: ContactDisclose;
}