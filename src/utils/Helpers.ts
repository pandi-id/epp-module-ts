import { randomInt } from 'crypto';
import { isIPv4, isIPv6 } from 'net';
import { domainToASCII, domainToUnicode } from 'url';
import { EppValidationError } from '../core/Errors';

/**
 * Validation and formatting helpers for EPP data.
 */

const LDH_NAME = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Whether the name is a syntactically valid domain name in LDH form (IDNs
 * as A-labels, e.g. "xn--bcher-kva.example"), at most 253 characters.
 */
export function validateDomain(domain: string): boolean {
  return domain.length <= 253 && LDH_NAME.test(domain);
}

/** Whether the name is a syntactically valid host name (RFC 952, RFC 1123). */
export function validateHostname(hostname: string): boolean {
  return validateDomain(hostname);
}

/** Whether the ID fits the EPP client identifier type: 3-16 characters, no whitespace. */
export function validateContactId(contactId: string): boolean {
  return /^\S{3,16}$/.test(contactId);
}

export function validateIPv4(ip: string): boolean {
  return isIPv4(ip);
}

export function validateIPv6(ip: string): boolean {
  return isIPv6(ip);
}

/** Whether the number has the EPP E.164 format "+CC.NUMBER" (RFC 5733 Section 2.5). */
export function validatePhone(phone: string): boolean {
  return phone.length <= 17 && /^\+\d{1,3}\.\d{1,14}$/.test(phone);
}

export function validateCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

export function validateCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Whether the value is a valid client transaction ID: 3-64 characters, no whitespace (RFC 5730). */
export function validateTransactionId(trid: string): boolean {
  return /^\S{3,64}$/.test(trid);
}

/**
 * Convert a domain name to its A-label (ASCII) form, as registries expect
 * for IDNs. "bücher.example" becomes "xn--bcher-kva.example".
 *
 * @throws {EppValidationError} when the name cannot be converted.
 */
export function toAsciiDomain(domain: string): string {
  const ascii = domainToASCII(domain.trim());
  if (!ascii) throw new EppValidationError(`Not a valid domain name: ${JSON.stringify(domain)}`);
  return ascii;
}

/** Convert a domain name's A-labels to Unicode U-labels. */
export function toUnicodeDomain(domain: string): string {
  return domainToUnicode(domain.trim()) || domain;
}

/** Lowercase A-label form without surrounding whitespace or a trailing dot. */
export function normalizeDomain(domain: string): string {
  return toAsciiDomain(domain.trim().replace(/\.$/, '')).toLowerCase();
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*';

/**
 * Generate a random authorization code with a cryptographically secure
 * generator, containing at least one uppercase letter, lowercase letter,
 * digit and symbol. 16 characters fit most registry limits; use more where
 * the registry allows (RFC 9154 recommends 128 bits of entropy).
 */
export function generateAuthInfo(length = 16): string {
  if (!Number.isInteger(length) || length < 8) throw new EppValidationError('Authorization codes must be at least 8 characters');
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [UPPER, LOWER, DIGITS, SYMBOLS].map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** @deprecated Use {@link generateAuthInfo}. */
export const generatePassword = generateAuthInfo;

/** Format a Date as an EPP date (YYYY-MM-DD, UTC). */
export function formatEppDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse an EPP date (YYYY-MM-DD) as midnight UTC. */
export function parseEppDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00Z`);
}

export function isEppSuccessCode(code: number): boolean {
  return code >= 1000 && code < 2000;
}

export function isEppErrorCode(code: number): boolean {
  return code >= 2000 && code < 3000;
}

/**
 * Category of a result code, from its second digit (RFC 5730 Section 3):
 * protocol syntax, implementation-specific rules, security, data
 * management, server system, or connection management.
 */
export function getEppCodeCategory(
  code: number,
):
  | 'protocolSyntax'
  | 'implementationSpecific'
  | 'security'
  | 'dataManagement'
  | 'serverSystem'
  | 'connectionManagement'
  | 'unknown' {
  if (code < 1000 || code >= 3000) return 'unknown';
  const categories = ['protocolSyntax', 'implementationSpecific', 'security', 'dataManagement', 'serverSystem', 'connectionManagement'] as const;
  return categories[Math.floor((code % 1000) / 100)] ?? 'unknown';
}

/** Status values of the domain, host and contact mappings (RFC 5731-5733). */
export const EppStatus = {
  OK: 'ok',
  INACTIVE: 'inactive',
  LINKED: 'linked',
  CLIENT_DELETE_PROHIBITED: 'clientDeleteProhibited',
  CLIENT_HOLD: 'clientHold',
  CLIENT_RENEW_PROHIBITED: 'clientRenewProhibited',
  CLIENT_TRANSFER_PROHIBITED: 'clientTransferProhibited',
  CLIENT_UPDATE_PROHIBITED: 'clientUpdateProhibited',
  PENDING_CREATE: 'pendingCreate',
  PENDING_DELETE: 'pendingDelete',
  PENDING_RENEW: 'pendingRenew',
  PENDING_TRANSFER: 'pendingTransfer',
  PENDING_UPDATE: 'pendingUpdate',
  SERVER_DELETE_PROHIBITED: 'serverDeleteProhibited',
  SERVER_HOLD: 'serverHold',
  SERVER_RENEW_PROHIBITED: 'serverRenewProhibited',
  SERVER_TRANSFER_PROHIBITED: 'serverTransferProhibited',
  SERVER_UPDATE_PROHIBITED: 'serverUpdateProhibited',
} as const;

/** EPP result codes (RFC 5730 Section 3). */
export const EppResultCode = {
  SUCCESS: 1000,
  SUCCESS_ACTION_PENDING: 1001,
  SUCCESS_NO_MESSAGES: 1300,
  SUCCESS_ACK_TO_DEQUEUE: 1301,
  SUCCESS_ENDING_SESSION: 1500,
  UNKNOWN_COMMAND: 2000,
  SYNTAX_ERROR: 2001,
  USE_ERROR: 2002,
  MISSING_PARAMETER: 2003,
  PARAMETER_VALUE_RANGE_ERROR: 2004,
  PARAMETER_VALUE_SYNTAX_ERROR: 2005,
  UNIMPLEMENTED_PROTOCOL_VERSION: 2100,
  UNIMPLEMENTED_COMMAND: 2101,
  UNIMPLEMENTED_OPTION: 2102,
  UNIMPLEMENTED_EXTENSION: 2103,
  BILLING_FAILURE: 2104,
  OBJECT_IS_NOT_ELIGIBLE_FOR_RENEWAL: 2105,
  OBJECT_IS_NOT_ELIGIBLE_FOR_TRANSFER: 2106,
  AUTHENTICATION_ERROR: 2200,
  AUTHORIZATION_ERROR: 2201,
  INVALID_AUTHORIZATION_INFO: 2202,
  OBJECT_PENDING_TRANSFER: 2300,
  OBJECT_NOT_PENDING_TRANSFER: 2301,
  OBJECT_EXISTS: 2302,
  OBJECT_DOES_NOT_EXIST: 2303,
  OBJECT_STATUS_PROHIBITS_OPERATION: 2304,
  OBJECT_ASSOCIATION_PROHIBITS_OPERATION: 2305,
  PARAMETER_VALUE_POLICY_ERROR: 2306,
  UNIMPLEMENTED_OBJECT_SERVICE: 2307,
  DATA_MANAGEMENT_POLICY_VIOLATION: 2308,
  COMMAND_FAILED: 2400,
  COMMAND_FAILED_SERVER_CLOSING: 2500,
  AUTHENTICATION_ERROR_SERVER_CLOSING: 2501,
  SESSION_LIMIT_EXCEEDED_SERVER_CLOSING: 2502,
} as const;

const RESULT_MESSAGES: Record<number, string> = {
  1000: 'Command completed successfully',
  1001: 'Command completed successfully; action pending',
  1300: 'Command completed successfully; no messages',
  1301: 'Command completed successfully; ack to dequeue',
  1500: 'Command completed successfully; ending session',
  2000: 'Unknown command',
  2001: 'Command syntax error',
  2002: 'Command use error',
  2003: 'Required parameter missing',
  2004: 'Parameter value range error',
  2005: 'Parameter value syntax error',
  2100: 'Unimplemented protocol version',
  2101: 'Unimplemented command',
  2102: 'Unimplemented option',
  2103: 'Unimplemented extension',
  2104: 'Billing failure',
  2105: 'Object is not eligible for renewal',
  2106: 'Object is not eligible for transfer',
  2200: 'Authentication error',
  2201: 'Authorization error',
  2202: 'Invalid authorization information',
  2300: 'Object pending transfer',
  2301: 'Object not pending transfer',
  2302: 'Object exists',
  2303: 'Object does not exist',
  2304: 'Object status prohibits operation',
  2305: 'Object association prohibits operation',
  2306: 'Parameter value policy error',
  2307: 'Unimplemented object service',
  2308: 'Data management policy violation',
  2400: 'Command failed',
  2500: 'Command failed; server closing connection',
  2501: 'Authentication error; server closing connection',
  2502: 'Session limit exceeded; server closing connection',
};

/** The standard message of a result code (RFC 5730 Section 3). */
export function getEppResultMessage(code: number): string {
  return RESULT_MESSAGES[code] ?? 'Unknown result code';
}
