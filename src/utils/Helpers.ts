/**
 * Utility functions for EPP client
 */

/**
 * Validates an email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a domain name
 */
export function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * Validates a hostname
 */
export function validateHostname(hostname: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname) && hostname.length <= 253;
}

/**
 * Validates a contact ID
 */
export function validateContactId(contactId: string): boolean {
  const contactIdRegex = /^[A-Z0-9_-]+$/i;
  return contactIdRegex.test(contactId) && contactId.length <= 16;
}

/**
 * Validates an IPv4 address
 */
export function validateIPv4(ip: string): boolean {
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validates an IPv6 address
 */
export function validateIPv6(ip: string): boolean {
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
  return ipv6Regex.test(ip);
}

/**
 * Validates a phone number in EPP format
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+\d{1,3}\.\d{1,14}(x\d{1,6})?$/;
  return phoneRegex.test(phone);
}

/**
 * Formats a phone number to EPP format
 */
export function formatPhone(phone: string): string {
  // Remove all non-digit characters except + and x
  let formatted = phone.replace(/[^\d+x]/gi, '');
  
  // If it doesn't start with +, add default +1. for US numbers
  if (!formatted.startsWith('+')) {
    formatted = '+1.' + formatted;
  } else {
    // Replace + with + and insert . after country code
    const countryCode = formatted.match(/^\+\d+/)?.[0] || '+1';
    const rest = formatted.slice(countryCode.length);
    formatted = countryCode + '.' + rest;
  }
  
  return formatted;
}

/**
 * Normalizes domain name (lowercase, remove www, etc.)
 */
export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Generates a random password
 */
export function generatePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  
  return password;
}

/**
 * Converts object to XML attributes format
 */
export function objectToAttributes(obj: Record<string, any>): Record<string, any> {
  const attributes: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    attributes['$'] = attributes['$'] || {};
    attributes['$'][key] = value;
  }
  
  return attributes;
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = deepClone(target);
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (sourceValue !== undefined && isObject(sourceValue) && isObject(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue as any);
      } else if (sourceValue !== undefined) {
        result[key] = deepClone(sourceValue) as any;
      }
    }
  }
  
  return result;
}

/**
 * Check if value is an object
 */
export function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convert string to boolean based on EPP conventions
 */
export function eppStringToBoolean(value: string): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Convert boolean to EPP string format
 */
export function booleanToEppString(value: boolean): string {
  return value ? '1' : '0';
}

/**
 * Validate country code (ISO 3166-1 alpha-2)
 */
export function validateCountryCode(code: string): boolean {
  const countryCodeRegex = /^[A-Z]{2}$/;
  return countryCodeRegex.test(code);
}

/**
 * Validate currency code (ISO 4217)
 */
export function validateCurrencyCode(code: string): boolean {
  const currencyCodeRegex = /^[A-Z]{3}$/;
  return currencyCodeRegex.test(code);
}

/**
 * Format date to EPP format (YYYY-MM-DD)
 */
export function formatEppDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse EPP date string to Date object
 */
export function parseEppDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00Z');
}

/**
 * Escape XML special characters
 */
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Unescape XML special characters
 */
export function unescapeXml(safe: string): string {
  return safe.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&apos;/g, '\'')
            .replace(/&quot;/g, '"');
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(prefix: string = 'CLTRID'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate transaction ID format
 */
export function validateTransactionId(trid: string): boolean {
  const tridRegex = /^[A-Z0-9]+-\d+-[A-Z0-9]+$/i;
  return tridRegex.test(trid);
}

/**
 * Check if response code indicates success
 */
export function isEppSuccessCode(code: number): boolean {
  return code >= 1000 && code < 2000;
}

/**
 * Check if response code indicates command error
 */
export function isEppErrorCode(code: number): boolean {
  return code >= 2000 && code < 3000;
}

/**
 * Get EPP response code category
 */
export function getEppCodeCategory(code: number): string {
  if (code >= 1000 && code < 2000) return 'success';
  if (code >= 2000 && code < 3000) return 'error';
  if (code >= 3000 && code < 4000) return 'pending';
  if (code >= 4000 && code < 5000) return 'security';
  return 'unknown';
}

/**
 * Common EPP status values
 */
export const EppStatus = {
  OK: 'ok',
  LOCKED: 'clientLock',
  SERVER_LOCKED: 'serverLock',
  PENDING_CREATE: 'pendingCreate',
  PENDING_DELETE: 'pendingDelete',
  PENDING_TRANSFER: 'pendingTransfer',
  PENDING_UPDATE: 'pendingUpdate',
  LINKED: 'linked',
  DELETE_PROHIBITED: 'deleteProhibited',
  TRANSFER_PROHIBITED: 'transferProhibited',
  UPDATE_PROHIBITED: 'updateProhibited',
} as const;

/**
 * Common EPP result codes
 */
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

/**
 * Get descriptive message for EPP result code
 */
export function getEppResultMessage(code: number): string {
  const messages: Record<number, string> = {
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

  return messages[code] || `Unknown result code: ${code}`;
}

export default {
  validateEmail,
  validateDomain,
  validateHostname,
  validateContactId,
  validateIPv4,
  validateIPv6,
  validatePhone,
  formatPhone,
  normalizeDomain,
  generatePassword,
  objectToAttributes,
  sleep,
  retryWithBackoff,
  deepClone,
  deepMerge,
  isObject,
  eppStringToBoolean,
  booleanToEppString,
  validateCountryCode,
  validateCurrencyCode,
  formatEppDate,
  parseEppDate,
  escapeXml,
  unescapeXml,
  generateTransactionId,
  validateTransactionId,
  isEppSuccessCode,
  isEppErrorCode,
  getEppCodeCategory,
  EppStatus,
  EppResultCode,
  getEppResultMessage,
};