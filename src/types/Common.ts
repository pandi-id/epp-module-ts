/**
 * EPP Client Configuration
 * Referensi: RFC 5730 Section 2 - Transport Considerations
 * 
 * EPP menggunakan koneksi persistent dan session-oriented.
 * Konfigurasi ini mendefinisikan parameter untuk koneksi EPP.
 */
export interface EppConfig {
  /** EPP server URL - MUST use HTTPS (RFC 5734) atau EPP over TCP (RFC 5734) */
  server: string;
  
  /** Client identifier untuk autentikasi (RFC 5730 Section 2.9.1.1) */
  username: string;
  
  /** Password untuk autentikasi - MUST be encrypted in transit (RFC 5730) */
  password: string;
  
  /** Language preference (RFC 5730 Section 2.9.1.1) - Default: 'en' */
  lang?: string;
  
  /** EPP protocol version (RFC 5730 Section 2.9.1.1) - Default: '1.0' */
  version?: string;
  
  /** Request timeout dalam milliseconds - Default: 30000 */
  timeout?: number;
  
  /** Enable debug logging untuk development */
  debug?: boolean;
  
  /** Optional: Client certificate untuk mutual TLS (RFC 5734 Section 5) */
  clientCert?: string;
  
  /** Optional: Client certificate key */
  clientKey?: string;
}

/**
 * EPP Response Structure
 * Referensi: RFC 5730 Section 2.6 - Response Format
 * 
 * Setiap EPP response berisi result code, message, dan optional data.
 * Result codes berkisar:
 * - 1xxx: Success (command completed)
 * - 2xxx: Success with no messages (command completed, no action pending)
 */
export interface EppResponse {
  /** Indicates whether the operation succeeded */
  success: boolean;
  
  /** 
   * EPP result code (RFC 5730 Section 3)
   * - 1000-1999: Command completed successfully
   * - 2000-2999: Command completed successfully, ending session
   * - 3xxx: Client error
   * - 4xxx: Server error
   * - 5xxx: Connection management error
   */
  code: number;
  
  /** Human-readable result message (RFC 5730 Section 2.6) */
  message: string;
  
  /** Optional response data specific to command type */
  data?: any;
  
  /** Client transaction identifier (RFC 5730 Section 2.8) */
  clTRID?: string;
  
  /** Server transaction identifier (RFC 5730 Section 2.8) */
  svTRID?: string;
  
  /** Optional: Result reason for additional context */
  reason?: string;
}

/**
 * EPP Error Structure
 * Referensi: RFC 5730 Section 3 - Result Codes
 * 
 * EPP mendefinisikan result codes standar untuk error handling.
 */
export interface EppError extends Error {
  /** 
   * EPP error code:
   * - 2000-2005: Command completed successfully
   * - 2100-2106: Command completed successfully, action pending
   * - 2200-2202: Command completed successfully, no messages
   * - 2300-2308: Command completed successfully, ending session
   * - 2400-2500: Client errors
   */
  code: number;
  
  /** Error message description */
  message: string;
  
  /** Optional: Detailed reason for the error */
  reason?: string;
  
  /** Optional: Array of error values (RFC 5730 Section 2.6) */
  values?: Array<{
    value: string;
    reason?: string;
  }>;
}

/**
 * Session Options for Login Command
 * Referensi: RFC 5730 Section 2.9.1.1 - <login> Command
 * 
 * EPP sessions dimulai dengan login command yang mengidentifikasi
 * client dan mengotentikasi client ke server.
 */
export interface SessionOptions {
  /** 
   * New password untuk password change operation
   * (RFC 5730 Section 2.9.1.1) - Optional <newPW> element
   */
  newPassword?: string;
  
  /** 
   * Preferred language (RFC 5730 Section 2.9.1.1)
   * MUST be 'en' or language supported by server
   */
  lang?: string;
  
  /** 
   * EPP protocol version (RFC 5730 Section 2.9.1.1)
   * MUST match server's supported version
   */
  version?: string;
  
  /**
   * Service URIs untuk object extensions
   * (RFC 5730 Section 2.9.1.1) - <svcs> element
   */
  services?: {
    /** Object URIs yang diperlukan */
    objURI?: string[];
    /** Extension URIs (optional) */
    extURI?: string[];
  };
}

/**
 * Fee Check Request
 * Referensi: RFC 8748 - EPP Fee Extension
 * 
 * Extension untuk query biaya operasi domain (create, renew, transfer, restore).
 */
export interface FeeCheckRequest {
  /** Domain name untuk fee check */
  domain?: string;
  
  /** 
   * EPP command type (RFC 8748 Section 3.1)
   * Values: 'create', 'renew', 'transfer', 'restore', 'update'
   */
  command: 'create' | 'renew' | 'transfer' | 'restore' | 'update';
  
  /** 
   * Period untuk operasi (RFC 8748 Section 3.1)
   * Number of units (combined with period unit: y=years, m=months)
   */
  period?: {
    value: number;
    unit: 'y' | 'm';
  };
  
  /** 
   * Currency code (RFC 8748 Section 3.1)
   * MUST be 3-character ISO 4217 currency code (e.g., 'USD', 'EUR', 'IDR')
   */
  currency?: string;
  
  /** Optional: Fee applied to check */
  fee?: string;
  
  /** Optional: Fee class for tiered pricing */
  class?: string;
}

/**
 * Period Definition
 * Referensi: RFC 5731 Section 2.2 - Common Elements
 * 
 * Mendefinisikan periode waktu untuk operasi domain.
 */
export interface Period {
  /** 
   * Number of units
   * MUST be positive integer
   */
  value: number;
  
  /** 
   * Unit of time (RFC 5731 Section 2.2)
   * 'y' = years, 'm' = months
   */
  unit: 'y' | 'm';
}

/**
 * AuthInfo Structure
 * Referensi: RFC 5731 Section 2.2, RFC 5733 Section 2.2
 * 
 * Authorization information untuk transfer operations.
 */
export interface AuthInfo {
  /** 
   * Authorization password (RFC 5731 Section 2.2)
   * Plain text password atau token untuk authorization
   */
  pw: string;
  
  /** 
   * Optional: ROID (Repository Object IDentifier) untuk specific object
   * Digunakan jika authorization specific ke object tertentu
   */
  roid?: string;
}