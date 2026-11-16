/**
 * DNSSEC extension types (RFC 5910, namespace secDNS-1.1).
 */

/** Delegation Signer record data (RFC 5910 Section 4.1). */
export interface DsData {
  /** Key tag, 0-65535. */
  keyTag: number;
  /** DNSSEC algorithm number (IANA "DNS Security Algorithm Numbers"). */
  alg: number;
  /** Digest type (IANA "Delegation Signer Digest Algorithms"). */
  digestType: number;
  /** Digest, hexadecimal. */
  digest: string;
  /** Optional DNSKEY data the DS record was computed from. */
  keyData?: KeyData;
}

/** DNSKEY record data (RFC 5910 Section 4.2). */
export interface KeyData {
  /** Flags: 256 for a zone key, 257 for a zone key with the SEP bit (KSK). */
  flags: number;
  /** Protocol, always 3. */
  protocol: number;
  alg: number;
  /** Public key, base64. */
  pubKey: string;
}

/**
 * DNSSEC data for a domain create (RFC 5910 Section 5.2.1). Supply either
 * `dsData` or `keyData`, matching the interface the registry supports.
 */
export interface DnssecCreate {
  /** Maximum signature lifetime in seconds. */
  maxSigLife?: number;
  dsData?: DsData[];
  keyData?: KeyData[];
}

/** DNSSEC changes for a domain update (RFC 5910 Section 5.2.5). */
export interface DnssecUpdate {
  /** Ask the server to apply the change as soon as possible. */
  urgent?: boolean;
  /** Data to remove; `all: true` removes all DNSSEC data. Processed before `add`. */
  rem?: {
    all?: boolean;
    dsData?: DsData[];
    keyData?: KeyData[];
  };
  /** Data to add. */
  add?: {
    dsData?: DsData[];
    keyData?: KeyData[];
  };
  /** Change the maximum signature lifetime. */
  chg?: {
    maxSigLife?: number;
  };
}

/** DNSSEC data returned by a domain info command (RFC 5910 Section 5.1.2). */
export interface DnssecInfo {
  maxSigLife?: number;
  dsData?: DsData[];
  keyData?: KeyData[];
}

/** Common DNSSEC algorithm numbers (IANA "DNS Security Algorithm Numbers"). */
export const DNSSEC_ALGORITHMS: Readonly<Record<number, string>> = {
  5: 'RSA/SHA-1',
  7: 'RSASHA1-NSEC3-SHA1',
  8: 'RSA/SHA-256',
  10: 'RSA/SHA-512',
  13: 'ECDSA Curve P-256 with SHA-256',
  14: 'ECDSA Curve P-384 with SHA-384',
  15: 'Ed25519',
  16: 'Ed448',
};

/** DS digest types (IANA "Delegation Signer Digest Algorithms"). */
export const DNSSEC_DIGEST_TYPES: Readonly<Record<number, string>> = {
  1: 'SHA-1',
  2: 'SHA-256',
  4: 'SHA-384',
};

const DIGEST_HEX_LENGTHS: Record<number, number> = { 1: 40, 2: 64, 4: 96 };

/**
 * Check DS data against the RFC 5910 schema types, and the digest length
 * against the digest type when the type is known.
 */
export function validateDsData(dsData: DsData): boolean {
  if (!isInteger(dsData.keyTag, 0, 65535)) return false;
  if (!isInteger(dsData.alg, 0, 255)) return false;
  if (!isInteger(dsData.digestType, 0, 255)) return false;
  if (!/^[0-9A-Fa-f]+$/.test(dsData.digest) || dsData.digest.length % 2 !== 0) return false;
  const expected = DIGEST_HEX_LENGTHS[dsData.digestType];
  if (expected && dsData.digest.length !== expected) return false;
  if (dsData.keyData && !validateKeyData(dsData.keyData)) return false;
  return true;
}

/**
 * Check DNSKEY data: 16-bit flags with the Zone Key bit set, protocol 3,
 * an 8-bit algorithm and a base64 public key.
 */
export function validateKeyData(keyData: KeyData): boolean {
  if (!isInteger(keyData.flags, 0, 65535)) return false;
  if ((keyData.flags & 0x0100) === 0) return false;
  if (keyData.protocol !== 3) return false;
  if (!isInteger(keyData.alg, 0, 255)) return false;
  if (!/^[A-Za-z0-9+/]+=*$/.test(keyData.pubKey)) return false;
  return true;
}

function isInteger(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
