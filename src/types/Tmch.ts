import { EppValidationError } from '../core/Errors';

/**
 * Trademark Clearinghouse (TMCH) types and helpers for ICANN sunrise and
 * claims processing: mark objects (RFC 7848), Signed Mark Data files and
 * Trademark Claims Notice identifiers (RFC 9361).
 */

/** Kind of mark (RFC 7848 Section 2.2). */
export type TmchMarkType = 'trademark' | 'treatyOrStatute' | 'court';

export type TmchDocumentType = 'tmLaw' | 'tmOther' | 'declaration' | 'other';

/** Contact role (RFC 7848 Section 2.2.1). */
export type TmchContactType = 'owner' | 'agent' | 'thirdparty';

/** A mark (RFC 7848 Section 2.2). */
export interface TmchMark {
  /** Mark identifier, e.g. "00052013734689731373681096-65535". */
  id: string;
  markType: TmchMarkType;
  markName: string;
  holder: TmchHolder[];
  contact?: TmchContact[];
  /** Two-letter jurisdiction code. */
  jurisdiction?: string;
  /** Nice classification classes (1-45). */
  class?: number[];
  /** DNS labels covered by the mark. */
  label?: string[];
  goodsAndServices?: string;
  regNum?: string;
  apDate?: string;
  regDate?: string;
  exDate?: string;
}

/** Mark holder (RFC 7848 Section 2.2.1). */
export interface TmchHolder {
  name?: string;
  org?: string;
  addr?: {
    street?: string[];
    city?: string;
    sp?: string;
    pc?: string;
    cc: string;
  };
  voice?: string;
  fax?: string;
  email?: string;
  /** "owner", "assignee" or "licensee". */
  entitlement?: string;
}

/** Mark contact (RFC 7848 Section 2.2.1). */
export interface TmchContact {
  type: TmchContactType;
  name: string;
  org?: string;
  addr?: {
    street?: string[];
    city?: string;
    sp?: string;
    pc?: string;
    cc: string;
  };
  voice?: string;
  fax?: string;
  email: string;
}

export interface TmchDocument {
  docType: TmchDocumentType;
  fileName: string;
  fileType: string;
  fileContent: string;
}

/** Trademark Claims Notice (RFC 9361 Section 6.5). */
export interface TmchClaimsNotice {
  /** TCNID. */
  id: string;
  notAfter: string;
  acceptedDate: string;
  label: string;
  claims?: TmchClaim[];
}

export interface TmchClaim {
  markName: string;
  jurisdiction: string;
  goodsAndServices?: string;
  holderName?: string;
  holderEmail?: string;
}

/** Signed Mark Data. */
export interface TmchSMD {
  id: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  encodedSignedMark: string;
}

export interface TmchSunriseApplication {
  name: string;
  smd: TmchSMD[];
  applicationID?: string;
}

export interface TmchClaimsCheckRequest {
  names: string[];
}

export interface TmchClaimsCheckResult {
  name: string;
  claimsExist: boolean;
  claimKey?: string;
}

export interface TmchValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
  mark?: TmchMark;
}

/** Contents of an SMD file (RFC 9361 Section 6.4). */
export interface SmdFile {
  marks: string;
  smdID: string;
  uLabels: string[];
  notBefore: string;
  notAfter: string;
  /** Base64 encoded signed mark from between the boundaries, whitespace removed. */
  encodedSignedMark: string;
}

/** RFC 7848 mark namespace. */
export const MARK_NAMESPACE = 'urn:ietf:params:xml:ns:mark-1.0';
/** RFC 7848 signed mark namespace. */
export const SIGNED_MARK_NAMESPACE = 'urn:ietf:params:xml:ns:signedMark-1.0';

/**
 * Whether the value has the RFC 7848 identifier format used by marks and
 * SMDs: digits, a hyphen, digits (for example "1-2").
 */
export function isValidSMDFormat(smdId: string): boolean {
  return /^\d+-\d+$/.test(smdId);
}

/**
 * Whether the value has the TCNID format of RFC 9361 Section 6.5: an
 * 8-character hexadecimal checksum followed by a 19-digit TMDB notice
 * identifier, e.g. "370d0b7c9223372036854775807".
 */
export function isValidNoticeID(noticeId: string): boolean {
  return /^[0-9a-fA-F]{8}\d{19}$/.test(noticeId);
}

/**
 * Compute a TCN checksum (RFC 9361 Section 6.5): the CRC32 of the label, the
 * notice expiry as Unix time, and the TMDB notice identifier, as 8 lowercase
 * hex digits.
 */
export function computeTcnChecksum(label: string, notAfter: string | Date, tmdbNoticeId: string): string {
  const unixTime = Math.floor(toDate(notAfter, 'notAfter').getTime() / 1000);
  return crc32(`${label}${unixTime}${tmdbNoticeId}`).toString(16).padStart(8, '0');
}

/**
 * Verify a TCNID against the domain being registered and the notice expiry,
 * as registries do (RFC 9361 Section 5.3.2). `domainOrLabel` may be the full
 * domain name; its leftmost label (in A-label form) is used.
 */
export function verifyTcnId(tcnId: string, domainOrLabel: string, notAfter: string | Date): boolean {
  if (!isValidNoticeID(tcnId)) return false;
  const label = domainOrLabel.split('.')[0].toLowerCase();
  return computeTcnChecksum(label, notAfter, tcnId.slice(8)) === tcnId.slice(0, 8).toLowerCase();
}

/** Whether the mark's expiration date has passed. */
export function isTmchMarkExpired(exDate: string): boolean {
  return new Date(exDate) < new Date();
}

/** Whether the number is a Nice classification class (1-45). */
export function isValidNiceClass(classNumber: number): boolean {
  return Number.isInteger(classNumber) && classNumber >= 1 && classNumber <= 45;
}

const SMD_BEGIN = '-----BEGIN ENCODED SMD-----';
const SMD_END = '-----END ENCODED SMD-----';

/**
 * Return the base64 encoded signed mark from an SMD file, ready for
 * `launch.encodedSignedMark`. Only the data between the encapsulation
 * boundaries is used (RFC 9361 Section 6.4). Plain base64 input is returned
 * with whitespace removed.
 *
 * @throws {EppValidationError} when no encoded SMD is found.
 */
export function extractEncodedSmd(content: string): string {
  const begin = content.indexOf(SMD_BEGIN);
  if (begin === -1) {
    const compact = content.replace(/\s+/g, '');
    if (compact && /^[A-Za-z0-9+/]+=*$/.test(compact)) return compact;
    throw new EppValidationError('No "-----BEGIN ENCODED SMD-----" boundary found in SMD file');
  }
  const end = content.indexOf(SMD_END, begin);
  if (end === -1) throw new EppValidationError('No "-----END ENCODED SMD-----" boundary found in SMD file');
  const encoded = content.slice(begin + SMD_BEGIN.length, end).replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new EppValidationError('SMD file does not contain valid base64 between its boundaries');
  }
  return encoded;
}

/**
 * Parse an SMD file (RFC 9361 Section 6.4): the header lines and the
 * encoded signed mark.
 *
 * @throws {EppValidationError} when a required line or the encoded SMD is missing.
 */
export function parseSmdFile(content: string): SmdFile {
  const header = content.slice(0, Math.max(0, content.indexOf(SMD_BEGIN)));
  const field = (name: string): string => {
    const match = header.match(new RegExp(`^\\s*${name}:[ \\t]*(.*)$`, 'm'));
    if (!match) throw new EppValidationError(`SMD file is missing the "${name}:" line`);
    return match[1].trim();
  };
  return {
    marks: field('Marks'),
    smdID: field('smdID'),
    uLabels: field('U-labels').split(',').map((label) => label.trim()).filter(Boolean),
    notBefore: field('notBefore'),
    notAfter: field('notAfter'),
    encodedSignedMark: extractEncodedSmd(content),
  };
}

function toDate(value: string | Date, name: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new EppValidationError(`${name} is not a valid date`);
  return date;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(input: string): number {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
