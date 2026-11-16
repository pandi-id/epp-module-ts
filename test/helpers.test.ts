import { readFileSync } from 'fs';
import * as path from 'path';
import { VERSION } from '../src/core/Version';
import {
  EppResultCode,
  EppStatus,
  formatEppDate,
  generateAuthInfo,
  getEppCodeCategory,
  getEppResultMessage,
  isEppErrorCode,
  isEppSuccessCode,
  normalizeDomain,
  parseEppDate,
  toAsciiDomain,
  toUnicodeDomain,
  validateContactId,
  validateDomain,
  validateEmail,
  validateIPv4,
  validateIPv6,
  validatePhone,
  validateTransactionId,
} from '../src/utils/Helpers';

describe('validation helpers', () => {
  it('domain and host names', () => {
    expect(validateDomain('example.com')).toBe(true);
    expect(validateDomain('xn--bcher-kva.example')).toBe(true);
    expect(validateDomain('-bad.example')).toBe(false);
    expect(validateDomain(`${'a'.repeat(64)}.com`)).toBe(false);
  });

  it('contact IDs follow clIDType (3-16 characters)', () => {
    expect(validateContactId('sh8013')).toBe(true);
    expect(validateContactId('ab')).toBe(false);
    expect(validateContactId('a'.repeat(17))).toBe(false);
    expect(validateContactId('has space')).toBe(false);
  });

  it('IP addresses, phone numbers, email and transaction IDs', () => {
    expect(validateIPv4('192.0.2.1')).toBe(true);
    expect(validateIPv4('256.0.0.1')).toBe(false);
    expect(validateIPv6('2001:db8::1')).toBe(true);
    expect(validateIPv6('192.0.2.1')).toBe(false);
    expect(validatePhone('+1.7035555555')).toBe(true);
    expect(validatePhone('+62.215551234')).toBe(true);
    expect(validatePhone('7035555555')).toBe(false);
    expect(validateEmail('jdoe@example.com')).toBe(true);
    expect(validateTransactionId('ABC-12345')).toBe(true);
    expect(validateTransactionId('ab')).toBe(false);
  });
});

describe('IDN helpers', () => {
  it('converts between U-labels and A-labels', () => {
    expect(toAsciiDomain('bücher.example')).toBe('xn--bcher-kva.example');
    expect(toUnicodeDomain('xn--bcher-kva.example')).toBe('bücher.example');
    expect(normalizeDomain(' Example.COM. ')).toBe('example.com');
    expect(() => toAsciiDomain('')).toThrow();
  });
});

describe('generateAuthInfo', () => {
  it('produces random codes with every character class', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateAuthInfo()));
    expect(codes.size).toBe(50);
    for (const code of codes) {
      expect(code).toHaveLength(16);
      expect(code).toMatch(/[A-Z]/);
      expect(code).toMatch(/[a-z]/);
      expect(code).toMatch(/[0-9]/);
      expect(code).toMatch(/[!@#$%^&*]/);
    }
    expect(generateAuthInfo(32)).toHaveLength(32);
    expect(() => generateAuthInfo(4)).toThrow();
  });
});

describe('result codes and statuses', () => {
  it('categorizes result codes per RFC 5730 Section 3', () => {
    expect(isEppSuccessCode(1301)).toBe(true);
    expect(isEppErrorCode(2303)).toBe(true);
    expect(getEppCodeCategory(1000)).toBe('protocolSyntax');
    expect(getEppCodeCategory(2103)).toBe('implementationSpecific');
    expect(getEppCodeCategory(2201)).toBe('security');
    expect(getEppCodeCategory(2302)).toBe('dataManagement');
    expect(getEppCodeCategory(2400)).toBe('serverSystem');
    expect(getEppCodeCategory(2502)).toBe('connectionManagement');
    expect(getEppCodeCategory(999)).toBe('unknown');
    expect(getEppResultMessage(EppResultCode.OBJECT_EXISTS)).toBe('Object exists');
  });

  it('only lists status values defined by RFC 5731-5733', () => {
    const schemaStatuses = ['domain-1.0.xsd', 'host-1.0.xsd', 'contact-1.0.xsd'].flatMap((file) => {
      const xsd = readFileSync(path.join(__dirname, 'schemas', file), 'utf8');
      const block = xsd.slice(xsd.indexOf('name="statusValueType"'));
      return [...block.slice(0, block.indexOf('</simpleType>')).matchAll(/enumeration value="(\w+)"/g)].map((m) => m[1]);
    });
    for (const status of Object.values(EppStatus)) expect(schemaStatuses).toContain(status);
  });
});

describe('dates and version', () => {
  it('formats EPP dates in UTC', () => {
    expect(formatEppDate(new Date('2026-11-16T23:30:00-05:00'))).toBe('2026-11-17');
    expect(parseEppDate('2026-11-16').toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  it('VERSION matches package.json', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(VERSION).toBe(pkg.version);
  });
});
