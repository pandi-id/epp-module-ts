/**
 * TMCH (Trademark Clearinghouse) Extension Tests
 */

import {
  TmchMarkType,
  TmchMark,
  TmchSMD,
  TmchClaimsNotice,
  isValidSMDFormat,
  isValidNoticeID,
  isTmchMarkExpired,
  isValidNiceClass,
  TMCH_NAMESPACE
} from '../src/types/Tmch';

describe('TMCH Extension', () => {
  describe('SMD Format Validation', () => {
    test('should validate correct SMD format', () => {
      expect(isValidSMDFormat('20240115-000001-0001')).toBe(true);
      expect(isValidSMDFormat('20231201-123456-9999')).toBe(true);
      expect(isValidSMDFormat('20250630-999999-0000')).toBe(true);
    });

    test('should reject invalid SMD format', () => {
      expect(isValidSMDFormat('2024-01-15-000001-0001')).toBe(false);
      expect(isValidSMDFormat('20240115-0001-0001')).toBe(false);
      expect(isValidSMDFormat('20240115-000001')).toBe(false);
      expect(isValidSMDFormat('invalid-format')).toBe(false);
      expect(isValidSMDFormat('')).toBe(false);
    });
  });

  describe('Notice ID Validation', () => {
    test('should validate correct notice ID format', () => {
      // Format: YYYY-MM-DDTHH:mm:ss.sssZ-xxxxxxxx
      expect(isValidNoticeID('2024-01-15T10:30:45.123Z-abc12345')).toBe(true);
      expect(isValidNoticeID('2025-12-31T23:59:59.999Z-12345678')).toBe(true);
      expect(isValidNoticeID('2024-06-15T00:00:00.000Z-ffffffff')).toBe(true);
    });

    test('should reject invalid notice ID', () => {
      expect(isValidNoticeID('')).toBe(false);
      expect(isValidNoticeID('   ')).toBe(false);
      expect(isValidNoticeID('claim-notice-12345')).toBe(false); // Wrong format
      expect(isValidNoticeID('2024-01-15-abc12345')).toBe(false); // Missing time
    });
  });

  describe('Trademark Expiration Check', () => {
    test('should detect expired trademarks', () => {
      const pastDate = '2020-01-01T00:00:00Z';
      expect(isTmchMarkExpired(pastDate)).toBe(true);
    });

    test('should detect non-expired trademarks', () => {
      const futureDate = '2030-12-31T23:59:59Z';
      expect(isTmchMarkExpired(futureDate)).toBe(false);
    });

    test('should handle date in the past', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isTmchMarkExpired(yesterday.toISOString())).toBe(true);
    });
  });

  describe('Nice Classification Validation', () => {
    test('should validate valid Nice classes', () => {
      expect(isValidNiceClass(1)).toBe(true);
      expect(isValidNiceClass(35)).toBe(true);
      expect(isValidNiceClass(42)).toBe(true);
      expect(isValidNiceClass(45)).toBe(true);
    });

    test('should reject invalid Nice classes', () => {
      expect(isValidNiceClass(0)).toBe(false);
      expect(isValidNiceClass(46)).toBe(false);
      expect(isValidNiceClass(-1)).toBe(false);
      expect(isValidNiceClass(100)).toBe(false);
    });
  });

  describe('TmchMark Structure', () => {
    test('should create complete trademark mark', () => {
      const mark: TmchMark = {
        id: 'mark-12345',
        markType: 'trademark',
        markName: 'EXAMPLE',
        holder: [
          {
            name: 'Example Corp',
            org: 'Example Corporation',
            addr: {
              street: ['123 Main St'],
              city: 'New York',
              pc: '10001',
              cc: 'US'
            },
            email: 'contact@example.com'
          }
        ],
        jurisdiction: 'US',
        class: [35, 42],
        regNum: '1234567',
        regDate: '2020-01-15',
        exDate: '2030-01-15'
      };

      expect(mark.markType).toBe('trademark');
      expect(mark.markName).toBe('EXAMPLE');
      expect(mark.class).toHaveLength(2);
      expect(isValidNiceClass(mark.class![0])).toBe(true);
    });

    test('should support treaty or statute type', () => {
      const mark: TmchMark = {
        id: 'mark-67890',
        markType: 'treatyOrStatute',
        markName: 'PROTECTED',
        holder: [
          {
            name: 'Protected Corp',
            addr: { cc: 'EU' }
          }
        ],
        jurisdiction: 'EU'
      };

      expect(mark.markType).toBe('treatyOrStatute');
      expect(mark.holder).toHaveLength(1);
    });

    test('should support court type', () => {
      const mark: TmchMark = {
        id: 'court-12345',
        markType: 'court',
        markName: 'COURTMARK',
        holder: [
          {
            name: 'Court Holder',
            addr: { cc: 'GB' }
          }
        ],
        jurisdiction: 'GB'
      };

      expect(mark.markType).toBe('court');
      expect(mark.jurisdiction).toBe('GB');
    });
  });

  describe('TmchSMD Structure', () => {
    test('should create valid SMD', () => {
      const smd: TmchSMD = {
        id: '20240115-000001-0001',
        issuer: 'TMCH',
        encodedSignedMark: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4=',
        notBefore: '2024-01-15T00:00:00Z',
        notAfter: '2030-01-15T00:00:00Z'  // Future date
      };

      expect(isValidSMDFormat(smd.id)).toBe(true);
      expect(isTmchMarkExpired(smd.notAfter)).toBe(false);
    });

    test('should detect expired SMD', () => {
      const smd: TmchSMD = {
        id: '20200115-000001-0001',
        issuer: 'TMCH',
        encodedSignedMark: 'base64data',
        notBefore: '2020-01-15T00:00:00Z',
        notAfter: '2021-01-15T00:00:00Z'
      };

      expect(isTmchMarkExpired(smd.notAfter)).toBe(true);
    });
  });

  describe('TmchClaimsNotice Structure', () => {
    test('should create valid claims notice', () => {
      const notice: TmchClaimsNotice = {
        id: '2024-01-15T10:30:45.123Z-abc12345',
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:00:00Z',
        label: 'example',
        claims: [
          {
            markName: 'EXAMPLE',
            jurisdiction: 'US',
            goodsAndServices: 'Class 35: Advertising services'
          }
        ]
      };

      expect(isValidNoticeID(notice.id)).toBe(true);
      expect(notice.claims).toHaveLength(1);
      expect(notice.claims![0].markName).toBe('EXAMPLE');
    });

    test('should support multiple claims', () => {
      const notice: TmchClaimsNotice = {
        id: '2024-01-15T10:30:45.123Z-12345678',
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:00:00Z',
        label: 'trademark',
        claims: [
          {
            markName: 'TRADEMARK',
            jurisdiction: 'US',
            goodsAndServices: 'Class 35'
          },
          {
            markName: 'TRADEMARK',
            jurisdiction: 'EU',
            goodsAndServices: 'Class 42'
          }
        ]
      };

      expect(notice.claims).toHaveLength(2);
    });
  });

  describe('TmchHolder and TmchContact', () => {
    test('should create trademark holder', () => {
      const holder = {
        name: 'Example Corporation',
        org: 'Example Corp',
        addr: {
          street: ['123 Main St'],
          city: 'New York',
          pc: '10001',
          cc: 'US'
        },
        voice: '+1.2125551234',
        email: 'legal@example.com'
      };

      expect(holder.name).toBe('Example Corporation');
      expect(holder.addr.cc).toBe('US');
    });

    test('should create contact with optional fields', () => {
      const contact = {
        name: 'John Doe',
        org: 'Law Firm LLP',
        addr: {
          street: ['456 Legal Ave', 'Suite 100'],
          city: 'London',
          pc: 'SW1A 1AA',
          cc: 'GB'
        },
        email: 'john@lawfirm.com'
      };

      expect(contact.addr.street).toHaveLength(2);
      expect(contact.addr.cc).toBe('GB');
    });
  });

  describe('Namespace', () => {
    test('should have correct namespace URI', () => {
      expect(TMCH_NAMESPACE).toBe('urn:ietf:params:xml:ns:tmch-1.0');
    });
  });

  describe('Integration Tests', () => {
    test('should validate complete SMD workflow', () => {
      const smdId = '20240115-000001-0001';
      const expirationDate = '2025-12-31T23:59:59Z';

      // Validate format
      expect(isValidSMDFormat(smdId)).toBe(true);

      // Check expiration
      expect(isTmchMarkExpired(expirationDate)).toBe(false);

      // Create SMD
      const smd: TmchSMD = {
        id: smdId,
        issuer: 'TMCH',
        encodedSignedMark: 'encoded_data_here',
        notBefore: '2024-01-15T00:00:00Z',
        notAfter: expirationDate
      };

      expect(smd.id).toBe(smdId);
      expect(smd.notAfter).toBe(expirationDate);
    });

    test('should validate claims notice workflow', () => {
      const noticeId = '2024-01-15T10:30:45.123Z-12345678';

      // Validate notice ID
      expect(isValidNoticeID(noticeId)).toBe(true);

      // Create notice with valid Nice classes
      const notice: TmchClaimsNotice = {
        id: noticeId,
        notAfter: '2024-12-31T23:59:59Z',
        acceptedDate: '2024-01-15T10:00:00Z',
        label: 'example',
        claims: [
          {
            markName: 'EXAMPLE',
            jurisdiction: 'US',
            goodsAndServices: 'Class 35, Class 42'
          }
        ]
      };

      expect(notice.id).toBe(noticeId);
      expect(isValidNiceClass(35)).toBe(true);
      expect(isValidNiceClass(42)).toBe(true);
    });
  });
});
