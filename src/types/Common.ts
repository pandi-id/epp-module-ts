/**
 * EPP Client Configuration
 * Referensi: RFC 5734 - EPP Transport over TCP
 * 
 * EPP menggunakan persistent TCP connection dengan TLS encryption.
 * Default port adalah 700 untuk EPP over TCP (RFC 5734 Section 3).
 */
export interface EppConfig {
  /** 
   * EPP server hostname (RFC 5734 Section 2)
   * Example: 'epp.registry.example'
   */
  host: string;
  
  /** 
   * EPP server port (RFC 5734 Section 3)
   * Default: 700 (standard EPP port)
   */
  port?: number;
  
  /** 
   * Client identifier untuk autentikasi (RFC 5730 Section 2.9.1.1)
   */
  username: string;
  
  /** 
   * Password untuk autentikasi - MUST be encrypted in transit (RFC 5730)
   */
  password: string;
  
  /** 
   * Language preference (RFC 5730 Section 2.9.1.1) - Default: 'en'
   */
  lang?: string;
  
  /** 
   * EPP protocol version (RFC 5730 Section 2.9.1.1) - Default: '1.0'
   */
  version?: string;
  
  /** 
   * Request timeout dalam milliseconds - Default: 30000
   */
  timeout?: number;
  
  /** 
   * Enable debug logging untuk development
   */
  debug?: boolean;
  
  /** 
   * Client certificate untuk mutual TLS (RFC 5734 Section 5)
   * Dapat berupa string (PEM format) atau Buffer
   */
  clientCert?: string | Buffer;
  
  /** 
   * Client certificate key
   * Dapat berupa string (PEM format) atau Buffer
   */
  clientKey?: string | Buffer;
  
  /** 
   * Certificate Authority certificates untuk verify server
   * Dapat berupa string, Buffer, atau array of strings/Buffers
   */
  ca?: string | Buffer | Array<string | Buffer>;
  
  /** 
   * Reject unauthorized certificates
   * Default: true (recommended untuk production)
   * Set false hanya untuk testing dengan self-signed certificates
   */
  rejectUnauthorized?: boolean;
  
  /** 
   * SSL/TLS cipher suites
   * Default: Uses Node.js default cipher list
   * Example: 'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256'
   */
  ciphers?: string;
  
  /** 
   * Minimum TLS version
   * Default: 'TLSv1.2'
   * Options: 'TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'
   */
  minVersion?: string;
  
  /** 
   * Maximum TLS version
   * Default: 'TLSv1.3'
   */
  maxVersion?: string;
  
  /** 
   * Passphrase untuk encrypted client key
   */
  passphrase?: string;
  
  /** 
   * Server name untuk SNI (Server Name Indication)
   * Default: sama dengan host
   */
  servername?: string;
  
  /** 
   * Check server identity
   * Default: true
   */
  checkServerIdentity?: boolean;
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

/**
 * Poll Request
 * Referensi: RFC 5730 Section 2.9.2.3 - Poll Command
 * 
 * Poll command digunakan untuk retrieve dan acknowledge messages
 * dari server message queue.
 */
export interface PollRequest {
  /**
   * Poll operation type (RFC 5730 Section 2.9.2.3)
   * - 'req': Request first message from queue
   * - 'ack': Acknowledge receipt of message
   */
  op: 'req' | 'ack';
  
  /**
   * Message ID untuk acknowledge operation
   * REQUIRED when op='ack'
   * Format: server-specific message identifier
   */
  msgID?: string;
}

/**
 * Poll Message
 * Referensi: RFC 5730 Section 2.9.2.3 - Poll Command Response
 * 
 * Server message dari queue yang berisi notifications tentang
 * events (transfers, domain expiry, etc.)
 */
export interface PollMessage {
  /**
   * Message identifier
   * Used untuk acknowledge message dengan poll ack
   */
  id: string;
  
  /**
   * Queue date - when message was enqueued
   * ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
   */
  qDate: string;
  
  /**
   * Message type/category
   * Examples: 'domain:trnData', 'domain:panData', etc.
   */
  type?: string;
  
  /**
   * Message content
   * Structure depends on message type
   */
  msg?: any;
  
  /**
   * Number of messages remaining in queue
   */
  count?: number;
}

/**
 * Poll Response
 * Referensi: RFC 5730 Section 2.9.2.3
 * 
 * Response dari poll command berisi message data dan queue count.
 */
export interface PollResponse extends EppResponse {
  /**
   * Poll message data (if op='req' and messages exist)
   */
  msgQ?: PollMessage;
  
  /**
   * Message count in queue
   */
  count?: number;
}