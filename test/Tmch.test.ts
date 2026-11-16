/**
 * TMCH helpers: RFC 7848 identifiers, RFC 9361 TCNIDs and SMD files.
 */

import { EppValidationError } from '../src/core/Errors';
import {
  computeTcnChecksum,
  extractEncodedSmd,
  isTmchMarkExpired,
  isValidNiceClass,
  isValidNoticeID,
  isValidSMDFormat,
  MARK_NAMESPACE,
  parseSmdFile,
  SIGNED_MARK_NAMESPACE,
  TmchClaimsNotice,
  TmchMark,
  TmchSMD,
  verifyTcnId,
} from '../src/types/Tmch';

const SMD_BASE64 = [
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHNtZDpzaWdu',
  'ZWRNYXJrIHhtbG5zOnNtZD0idXJuOmlldGY6cGFyYW1zOnhtbDpuczpzaWduZWRN',
  'dXJlPgo8L3NtZDpzaWduZWRNYXJrPgo=',
];

// The example SMD file of RFC 9361 Section 6.4, with a shortened base64 body.
const SMD_FILE = [
  'Marks: Example One',
  'smdID: 1-2',
  'U-labels: example-one, exampleone',
  'notBefore: 2011-08-16 09:00',
  'notAfter: 2012-08-16 09:00',
  '-----BEGIN ENCODED SMD-----',
  ...SMD_BASE64,
  '-----END ENCODED SMD-----',
  '',
].join('\n');

const inOneYear = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

describe('TMCH helpers', () => {
  describe('mark and SMD identifiers (RFC 7848)', () => {
    test('accept the digits-hyphen-digits format', () => {
      expect(isValidSMDFormat('1-2')).toBe(true);
      expect(isValidSMDFormat('0000001751376056503931-65535')).toBe(true);
      expect(isValidSMDFormat('00052013734689731373681096-65535')).toBe(true);
    });

    test('reject anything else', () => {
      expect(isValidSMDFormat('20240115-000001-0001')).toBe(false);
      expect(isValidSMDFormat('abc-1')).toBe(false);
      expect(isValidSMDFormat('1-')).toBe(false);
      expect(isValidSMDFormat('-1')).toBe(false);
      expect(isValidSMDFormat('')).toBe(false);
    });
  });

  describe('claims notice identifiers (RFC 9361 Section 6.5)', () => {
    test('accept an 8-digit hex checksum followed by a 19-digit notice identifier', () => {
      expect(isValidNoticeID('370d0b7c9223372036854775807')).toBe(true);
      expect(isValidNoticeID('ABCDEF019223372036854775807')).toBe(true);
      expect(isValidNoticeID('000000000000000000000000001')).toBe(true);
    });

    test('reject other formats', () => {
      expect(isValidNoticeID('')).toBe(false);
      expect(isValidNoticeID('   ')).toBe(false);
      expect(isValidNoticeID('2024-01-15T10:30:45.123Z-abc12345')).toBe(false);
      expect(isValidNoticeID('claim-notice-12345')).toBe(false);
      expect(isValidNoticeID('370d0b7c922')).toBe(false);
      expect(isValidNoticeID('zzzzzzzz9223372036854775807')).toBe(false);
    });

    test('compute the TCN checksum of the RFC 9361 example', () => {
      expect(computeTcnChecksum('example-one', '2010-08-16T09:00:00.0Z', '9223372036854775807')).toBe('370d0b7c');
      expect(computeTcnChecksum('example-one', new Date('2010-08-16T09:00:00Z'), '9223372036854775807')).toBe('370d0b7c');
    });

    test('verify a TCNID against the domain and notice expiry', () => {
      expect(verifyTcnId('370d0b7c9223372036854775807', 'example-one.tld', '2010-08-16T09:00:00.0Z')).toBe(true);
      expect(verifyTcnId('370D0B7C9223372036854775807', 'Example-One', '2010-08-16T09:00:00.0Z')).toBe(true);
      expect(verifyTcnId('370d0b7c9223372036854775807', 'example-two.tld', '2010-08-16T09:00:00.0Z')).toBe(false);
      expect(verifyTcnId('370d0b7c9223372036854775807', 'example-one.tld', '2010-08-16T09:00:01.0Z')).toBe(false);
      expect(verifyTcnId('not-a-tcnid', 'example-one.tld', '2010-08-16T09:00:00.0Z')).toBe(false);
      expect(() => computeTcnChecksum('example-one', 'never', '1')).toThrow(EppValidationError);
    });
  });

  describe('SMD files (RFC 9361 Section 6.4)', () => {
    test('parse the header lines and the encoded SMD', () => {
      expect(parseSmdFile(SMD_FILE)).toEqual({
        marks: 'Example One',
        smdID: '1-2',
        uLabels: ['example-one', 'exampleone'],
        notBefore: '2011-08-16 09:00',
        notAfter: '2012-08-16 09:00',
        encodedSignedMark: SMD_BASE64.join(''),
      });
    });

    test('extract only the data between the boundaries', () => {
      expect(extractEncodedSmd(`ignored preamble\n${SMD_FILE}trailing text`)).toBe(SMD_BASE64.join(''));
      expect(extractEncodedSmd(SMD_BASE64.join('\n'))).toBe(SMD_BASE64.join(''));
    });

    test('reject files without an encoded SMD or header lines', () => {
      expect(() => extractEncodedSmd('Marks: Example One\nno data here!')).toThrow(EppValidationError);
      expect(() => extractEncodedSmd('-----BEGIN ENCODED SMD-----\nAAAA')).toThrow(/END ENCODED SMD/);
      expect(() => extractEncodedSmd('-----BEGIN ENCODED SMD-----\n***\n-----END ENCODED SMD-----')).toThrow(/base64/);
      expect(() => parseSmdFile(SMD_FILE.replace('smdID: 1-2\n', ''))).toThrow(/smdID/);
    });
  });

  describe('expiration and Nice classes', () => {
    test('detect expired and current marks', () => {
      expect(isTmchMarkExpired('2020-01-01T00:00:00Z')).toBe(true);
      expect(isTmchMarkExpired(inOneYear())).toBe(false);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isTmchMarkExpired(yesterday.toISOString())).toBe(true);
    });

    test('accept Nice classes 1-45 only', () => {
      for (const valid of [1, 35, 42, 45]) expect(isValidNiceClass(valid)).toBe(true);
      for (const invalid of [0, 46, -1, 100, 1.5]) expect(isValidNiceClass(invalid)).toBe(false);
    });
  });

  describe('namespaces', () => {
    test('match RFC 7848', () => {
      expect(MARK_NAMESPACE).toBe('urn:ietf:params:xml:ns:mark-1.0');
      expect(SIGNED_MARK_NAMESPACE).toBe('urn:ietf:params:xml:ns:signedMark-1.0');
    });
  });

  describe('types', () => {
    test('describe marks of every kind', () => {
      const marks: TmchMark[] = [
        {
          id: '00052013734689731373681096-65535',
          markType: 'trademark',
          markName: 'EXAMPLE',
          holder: [{ org: 'Example Corporation', addr: { street: ['123 Main St'], city: 'New York', pc: '10001', cc: 'US' }, entitlement: 'owner' }],
          jurisdiction: 'US',
          class: [35, 42],
          regNum: '1234567',
          regDate: '2020-01-15',
        },
        { id: '1-2', markType: 'treatyOrStatute', markName: 'PROTECTED', holder: [{ name: 'Protected Corp', addr: { cc: 'FR' } }] },
        { id: '3-4', markType: 'court', markName: 'COURTMARK', holder: [{ name: 'Court Holder', addr: { cc: 'GB' } }], jurisdiction: 'GB' },
      ];
      expect(marks.every((mark) => isValidSMDFormat(mark.id))).toBe(true);
      expect(marks[0].class!.every(isValidNiceClass)).toBe(true);
    });

    test('describe an SMD and a claims notice', () => {
      const smd: TmchSMD = { id: '1-2', issuer: 'TMCH', encodedSignedMark: SMD_BASE64.join(''), notBefore: '2024-01-15T00:00:00Z', notAfter: inOneYear() };
      expect(isValidSMDFormat(smd.id)).toBe(true);
      expect(isTmchMarkExpired(smd.notAfter)).toBe(false);

      const notice: TmchClaimsNotice = {
        id: '370d0b7c9223372036854775807',
        notAfter: '2010-08-16T09:00:00.0Z',
        acceptedDate: '2010-08-15T09:00:00.0Z',
        label: 'example-one',
        claims: [{ markName: 'Example One', jurisdiction: 'US', goodsAndServices: 'Class 35' }],
      };
      expect(verifyTcnId(notice.id, notice.label, notice.notAfter)).toBe(true);
    });
  });
});
