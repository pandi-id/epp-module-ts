/**
 * DNSSEC Extension Types for EPP
 * Referensi: RFC 5910 - Domain Name System (DNS) Security Extensions Mapping for EPP
 * 
 * DNSSEC provides cryptographic authentication of DNS data.
 * This extension allows registrars to manage DS (Delegation Signer) records
 * dan key data dalam EPP protocol.
 */

/**
 * DS (Delegation Signer) Record Data
 * Referensi: RFC 5910 Section 2.1 - DS Data
 * 
 * DS record berisi hash dari DNSKEY record dan used untuk establish
 * chain of trust dalam DNSSEC hierarchy.
 */
export interface DsData {
  /**
   * Key Tag (RFC 5910 Section 2.1)
   * 16-bit integer yang identifies the DNSKEY record
   * Range: 0-65535
   */
  keyTag: number;

  /**
   * Algorithm (RFC 5910 Section 2.1)
   * DNSSEC algorithm number (IANA registry)
   * Common values:
   * - 5: RSA/SHA-1
   * - 7: RSASHA1-NSEC3-SHA1
   * - 8: RSA/SHA-256
   * - 10: RSA/SHA-512
   * - 13: ECDSA Curve P-256 with SHA-256
   * - 14: ECDSA Curve P-384 with SHA-384
   * - 15: Ed25519
   * - 16: Ed448
   */
  alg: number;

  /**
   * Digest Type (RFC 5910 Section 2.1)
   * Algorithm used to construct the digest
   * Common values:
   * - 1: SHA-1 (not recommended)
   * - 2: SHA-256 (recommended)
   * - 4: SHA-384
   */
  digestType: number;

  /**
   * Digest (RFC 5910 Section 2.1)
   * Hexadecimal representation of the hash
   * Case-insensitive hex string (no spaces or colons)
   */
  digest: string;

  /**
   * Key Data (OPTIONAL - RFC 5910 Section 2.2)
   * If present, provides the actual DNSKEY record data
   */
  keyData?: KeyData;
}

/**
 * Key Data
 * Referensi: RFC 5910 Section 2.2 - Key Data
 * 
 * Represents DNSKEY record data yang dapat be stored
 * as alternative atau complement ke DS data.
 */
export interface KeyData {
  /**
   * Flags (RFC 5910 Section 2.2)
   * 16-bit flags field
   * Bit 7 (Zone Key flag): must be 1
   * Bit 15 (Secure Entry Point): 1 for KSK, 0 for ZSK
   * Common values:
   * - 256: Zone Signing Key (ZSK)
   * - 257: Key Signing Key (KSK)
   */
  flags: number;

  /**
   * Protocol (RFC 5910 Section 2.2)
   * MUST be 3 for DNSSEC
   */
  protocol: number;

  /**
   * Algorithm (RFC 5910 Section 2.2)
   * Same algorithm values as DS record
   */
  alg: number;

  /**
   * Public Key (RFC 5910 Section 2.2)
   * Base64-encoded public key data
   */
  pubKey: string;
}

/**
 * DNSSEC Extension for Domain Create
 * Referensi: RFC 5910 Section 3.1 - EPP <create> Command
 */
export interface DnssecCreate {
  /**
   * Maximum signature lifetime (OPTIONAL)
   * Referensi: RFC 5910 Section 2.3
   * 
   * Indicates the maximum signature lifetime in seconds
   * that the client wishes for DNSSEC signatures.
   */
  maxSigLife?: number;

  /**
   * DS Data records (OPTIONAL)
   * Referensi: RFC 5910 Section 2.1
   * 
   * Array of DS records untuk domain.
   * Either dsData or keyData MUST be present if DNSSEC is used.
   */
  dsData?: DsData[];

  /**
   * Key Data records (OPTIONAL)
   * Referensi: RFC 5910 Section 2.2
   * 
   * Array of DNSKEY records untuk domain.
   * Either dsData or keyData MUST be present if DNSSEC is used.
   */
  keyData?: KeyData[];
}

/**
 * DNSSEC Extension for Domain Update
 * Referensi: RFC 5910 Section 3.2 - EPP <update> Command
 */
export interface DnssecUpdate {
  /**
   * Add DNSSEC data
   * Referensi: RFC 5910 Section 3.2.1
   */
  add?: {
    /** DS records to add */
    dsData?: DsData[];
    /** Key data to add */
    keyData?: KeyData[];
    /** Maximum signature lifetime to add */
    maxSigLife?: number;
  };

  /**
   * Remove DNSSEC data
   * Referensi: RFC 5910 Section 3.2.2
   * 
   * To remove all DNSSEC data: { all: true }
   * To remove specific records: provide dsData or keyData
   */
  rem?: {
    /** Remove all DNSSEC data */
    all?: boolean;
    /** DS records to remove (match by keyTag, alg, digestType, digest) */
    dsData?: DsData[];
    /** Key data to remove (match by flags, protocol, alg, pubKey) */
    keyData?: KeyData[];
  };

  /**
   * Change DNSSEC data
   * Referensi: RFC 5910 Section 3.2.3
   * 
   * Used to replace maxSigLife value
   */
  chg?: {
    /** New maximum signature lifetime */
    maxSigLife?: number;
  };

  /**
   * Urgent flag (OPTIONAL)
   * Referensi: RFC 5910 Section 2.4
   * 
   * When true, indicates that the DNSSEC information
   * SHOULD be published as soon as possible.
   * Default: false
   */
  urgent?: boolean;
}

/**
 * DNSSEC Extension for Domain Info Response
 * Referensi: RFC 5910 Section 3.3 - EPP <info> Command
 */
export interface DnssecInfo {
  /**
   * Maximum signature lifetime in seconds
   * Referensi: RFC 5910 Section 2.3
   */
  maxSigLife?: number;

  /**
   * DS Data records
   * Referensi: RFC 5910 Section 2.1
   */
  dsData?: DsData[];

  /**
   * Key Data records
   * Referensi: RFC 5910 Section 2.2
   */
  keyData?: KeyData[];
}

/**
 * DNSSEC Algorithm Names
 * For reference and validation
 */
export const DNSSEC_ALGORITHMS = {
  5: 'RSA/SHA-1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSA/SHA-256',
  10: 'RSA/SHA-512',
  13: 'ECDSA Curve P-256 with SHA-256',
  14: 'ECDSA Curve P-384 with SHA-384',
  15: 'Ed25519',
  16: 'Ed448'
} as const;

/**
 * DNSSEC Digest Types
 * For reference and validation
 */
export const DNSSEC_DIGEST_TYPES = {
  1: 'SHA-1',
  2: 'SHA-256',
  4: 'SHA-384'
} as const;

/**
 * Helper function to validate DS Data
 * Referensi: RFC 5910 Section 2.1
 */
export function validateDsData(dsData: DsData): boolean {
  // Key tag must be 0-65535
  if (dsData.keyTag < 0 || dsData.keyTag > 65535) {
    return false;
  }

  // Algorithm must be valid
  if (dsData.alg < 0 || dsData.alg > 255) {
    return false;
  }

  // Digest type must be valid
  if (dsData.digestType < 0 || dsData.digestType > 255) {
    return false;
  }

  // Digest must be hex string
  if (!/^[0-9A-Fa-f]+$/.test(dsData.digest)) {
    return false;
  }

  // Digest length depends on digest type
  const expectedLengths: Record<number, number> = {
    1: 40,  // SHA-1: 160 bits = 40 hex chars
    2: 64,  // SHA-256: 256 bits = 64 hex chars
    4: 96   // SHA-384: 384 bits = 96 hex chars
  };

  const expectedLength = expectedLengths[dsData.digestType];
  if (expectedLength && dsData.digest.length !== expectedLength) {
    return false;
  }

  return true;
}

/**
 * Helper function to validate Key Data
 * Referensi: RFC 5910 Section 2.2
 */
export function validateKeyData(keyData: KeyData): boolean {
  // Flags must be 16-bit
  if (keyData.flags < 0 || keyData.flags > 65535) {
    return false;
  }

  // Zone Key flag (bit 7) must be set
  if ((keyData.flags & 0x0100) === 0) {
    return false;
  }

  // Protocol must be 3
  if (keyData.protocol !== 3) {
    return false;
  }

  // Algorithm must be valid
  if (keyData.alg < 0 || keyData.alg > 255) {
    return false;
  }

  // Public key must be base64
  if (!/^[A-Za-z0-9+/]+=*$/.test(keyData.pubKey)) {
    return false;
  }

  return true;
}
