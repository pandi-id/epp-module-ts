/**
 * RGP (Registry Grace Period) Extension Tests (RFC 3915)
 */

import {
  RgpStatus,
  RgpRestoreReport,
  GracePeriodConfig,
  DEFAULT_GRACE_PERIODS,
  isInGracePeriod,
  isInRedemption,
  isPendingDelete,
  canRestore,
  calculateGracePeriodEnd,
  isWithinGracePeriod,
  getRemainingGracePeriodDays,
  validateRestoreReport,
  RGP_NAMESPACE
} from '../src/types/Rgp';

describe('RGP Extension', () => {
  describe('Grace Period Status Checks', () => {
    test('should identify grace period statuses', () => {
      expect(isInGracePeriod('addPeriod')).toBe(true);
      expect(isInGracePeriod('renewPeriod')).toBe(true);
      expect(isInGracePeriod('autoRenewPeriod')).toBe(true);
      expect(isInGracePeriod('transferPeriod')).toBe(true);
      expect(isInGracePeriod('redemptionPeriod')).toBe(false);
      expect(isInGracePeriod('pendingDelete')).toBe(false);
    });

    test('should identify redemption statuses', () => {
      expect(isInRedemption('redemptionPeriod')).toBe(true);
      expect(isInRedemption('pendingRestore')).toBe(true);
      expect(isInRedemption('addPeriod')).toBe(false);
      expect(isInRedemption('pendingDelete')).toBe(false);
    });

    test('should identify pending delete status', () => {
      expect(isPendingDelete('pendingDelete')).toBe(true);
      expect(isPendingDelete('redemptionPeriod')).toBe(false);
      expect(isPendingDelete('addPeriod')).toBe(false);
    });

    test('should check if restore is allowed', () => {
      expect(canRestore('redemptionPeriod')).toBe(true);
      expect(canRestore('pendingRestore')).toBe(false);
      expect(canRestore('pendingDelete')).toBe(false);
      expect(canRestore('addPeriod')).toBe(false);
    });
  });

  describe('Grace Period Date Calculations', () => {
    test('should calculate grace period end date', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const graceDays = 5;

      const endDate = calculateGracePeriodEnd(startDate, graceDays);
      
      expect(endDate.getDate()).toBe(20); // 15 + 5 = 20
      expect(endDate.getMonth()).toBe(0); // January
      expect(endDate.getFullYear()).toBe(2024);
    });

    test('should handle month boundary', () => {
      const startDate = new Date('2024-01-30T10:00:00Z');
      const graceDays = 5;

      const endDate = calculateGracePeriodEnd(startDate, graceDays);
      
      expect(endDate.getDate()).toBe(4); // 30 + 5 = 4 Feb
      expect(endDate.getMonth()).toBe(1); // February
    });

    test('should handle year boundary', () => {
      const startDate = new Date('2024-12-30T10:00:00Z');
      const graceDays = 5;

      const endDate = calculateGracePeriodEnd(startDate, graceDays);
      
      expect(endDate.getDate()).toBe(4); // 30 + 5 = 4 Jan
      expect(endDate.getMonth()).toBe(0); // January
      expect(endDate.getFullYear()).toBe(2025);
    });
  });

  describe('Within Grace Period Checks', () => {
    test('should check if within grace period', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-17T10:00:00Z'); // 2 days later
      const graceDays = 5;

      expect(isWithinGracePeriod(startDate, currentDate, graceDays)).toBe(true);
    });

    test('should detect expired grace period', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-25T10:00:00Z'); // 10 days later
      const graceDays = 5;

      expect(isWithinGracePeriod(startDate, currentDate, graceDays)).toBe(false);
    });

    test('should handle exact end date', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-20T10:00:00Z'); // Exactly 5 days
      const graceDays = 5;

      expect(isWithinGracePeriod(startDate, currentDate, graceDays)).toBe(true);
    });
  });

  describe('Remaining Grace Period Days', () => {
    test('should calculate remaining days', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-17T10:00:00Z'); // 2 days later
      const graceDays = 5;

      const remaining = getRemainingGracePeriodDays(startDate, currentDate, graceDays);
      expect(remaining).toBe(3); // 5 - 2 = 3 days remaining
    });

    test('should return 0 for expired period', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-25T10:00:00Z'); // 10 days later
      const graceDays = 5;

      const remaining = getRemainingGracePeriodDays(startDate, currentDate, graceDays);
      expect(remaining).toBe(0);
    });

    test('should return full period at start', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const currentDate = new Date('2024-01-15T10:00:00Z'); // Same time
      const graceDays = 5;

      const remaining = getRemainingGracePeriodDays(startDate, currentDate, graceDays);
      expect(remaining).toBe(5);
    });
  });

  describe('Restore Report Validation', () => {
    test('should validate complete restore report', () => {
      const report: RgpRestoreReport = {
        preData: 'Registration data of the domain before it was deleted.',
        postData: 'Registration data of the domain after it was restored.',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: 'Domain was deleted by mistake. Need to restore for business continuity.',
        statement: [
          {
            text: 'We have implemented new procedures to prevent accidental deletions.',
            lang: 'en'
          },
          {
            text: 'The domain is critical for our business operations.',
            lang: 'en'
          }
        ],
        other: 'Domain hosts primary business website and email services.'
      };

      const result = validateRestoreReport(report);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should require preData', () => {
      const report = {
        postData: '2024-01-15T10:00:00Z',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: 'Need to restore',
        statement: [{ text: 'Statement' }]
      };

      const result = validateRestoreReport(report as RgpRestoreReport);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('preData is required');
    });

    test('should require postData', () => {
      const report = {
        preData: '2024-01-01T00:00:00Z',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: 'Need to restore',
        statement: [{ text: 'Statement' }]
      };

      const result = validateRestoreReport(report as RgpRestoreReport);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('postData is required');
    });

    test('should require resReason', () => {
      const report = {
        preData: '2024-01-01T00:00:00Z',
        postData: '2024-01-15T10:00:00Z',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: '',
        statement: [{ text: 'Statement' }]
      };

      const result = validateRestoreReport(report as RgpRestoreReport);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resReason is required');
    });

    test('should require the two RFC 3915 statements', () => {
      const report: RgpRestoreReport = {
        preData: 'Registration data before deletion',
        postData: 'Registration data after restore',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: 'Need to restore',
        statement: [{ text: 'Only one statement' }]
      };

      const result = validateRestoreReport(report);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Exactly two statements are required (RFC 3915 Section 4.2.5)');
      expect(validateRestoreReport({ ...report, statement: [] }).valid).toBe(false);
    });

    test('should validate statement text', () => {
      const report: RgpRestoreReport = {
        preData: '2024-01-01T00:00:00Z',
        postData: '2024-01-15T10:00:00Z',
        delTime: '2024-01-10T00:00:00Z',
        resTime: '2024-01-12T00:00:00Z',
        resReason: 'Need to restore',
        statement: [
          { text: '' }
        ]
      };

      const result = validateRestoreReport(report);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Statement 1 text is required');
    });

    test('should validate date order', () => {
      const report: RgpRestoreReport = {
        preData: 'Registration data before deletion',
        postData: 'Registration data after restore',
        delTime: '2024-01-12T00:00:00Z',
        resTime: '2024-01-10T00:00:00Z', // Before delTime - invalid!
        resReason: 'Need to restore',
        statement: [{ text: 'Statement one' }, { text: 'Statement two' }]
      };

      const result = validateRestoreReport(report);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resTime must not be before delTime');
    });

    test('should treat preData and postData as registration data, not dates', () => {
      const report: RgpRestoreReport = {
        preData: '<domain:name>example.com</domain:name> registrant jd1234',
        postData: '<domain:name>example.com</domain:name> registrant jd1234',
        delTime: new Date('2024-01-10T00:00:00Z'),
        resTime: '2024-01-12T00:00:00Z',
        resReason: { text: 'Registrant error.', lang: 'en' },
        statement: ['Statement one', { text: 'Statement two', lang: 'en' }]
      };

      expect(validateRestoreReport(report)).toEqual({ valid: true, errors: [] });
      expect(validateRestoreReport({ ...report, delTime: 'not a date' }).errors).toContain('delTime must be a valid date-time');
    });
  });

  describe('Default Grace Period Configuration', () => {
    test('should have ICANN standard grace periods', () => {
      expect(DEFAULT_GRACE_PERIODS.addPeriod).toBe(5);
      expect(DEFAULT_GRACE_PERIODS.renewPeriod).toBe(5);
      expect(DEFAULT_GRACE_PERIODS.autoRenewPeriod).toBe(45);
      expect(DEFAULT_GRACE_PERIODS.transferPeriod).toBe(5);
      expect(DEFAULT_GRACE_PERIODS.redemptionPeriod).toBe(30);
      expect(DEFAULT_GRACE_PERIODS.pendingDelete).toBe(5);
    });
  });

  describe('Namespace', () => {
    test('should have correct namespace URI', () => {
      expect(RGP_NAMESPACE).toBe('urn:ietf:params:xml:ns:rgp-1.0');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete domain lifecycle', () => {
      // Domain created
      const createDate = new Date('2024-01-15T10:00:00Z');
      
      // Check add grace period (5 days)
      const addGraceEnd = calculateGracePeriodEnd(createDate, 5);
      expect(addGraceEnd.getDate()).toBe(20);

      // After 3 days, check remaining
      const day3 = new Date('2024-01-18T10:00:00Z');
      const remaining = getRemainingGracePeriodDays(createDate, day3, 5);
      expect(remaining).toBe(2);

      // Domain deleted on day 100
      const deleteDate = new Date('2024-04-24T10:00:00Z');
      
      // Redemption period (30 days)
      const redemptionEnd = calculateGracePeriodEnd(deleteDate, 30);
      expect(redemptionEnd.toISOString()).toBe('2024-05-24T10:00:00.000Z');
      
      // Check if can restore during redemption
      expect(canRestore('redemptionPeriod')).toBe(true);
      
      // Pending delete (5 days after redemption)
      expect(canRestore('pendingDelete')).toBe(false);
    });

    test('should validate restore workflow', () => {
      // Domain in redemption
      const status: RgpStatus = 'redemptionPeriod';
      
      // Check if restore is allowed
      expect(isInRedemption(status)).toBe(true);
      expect(canRestore(status)).toBe(true);

      // Create restore report
      const report: RgpRestoreReport = {
        preData: 'Registration data of the domain before it was deleted.',
        postData: 'Registration data of the domain after it was restored.',
        delTime: '2024-01-20T00:00:00Z',
        resTime: '2024-01-22T00:00:00Z',
        resReason: 'Domain deleted by mistake, need for business operations.',
        statement: [
          {
            text: 'This registrar has not restored the domain to assume the rights to use or sell it.',
            lang: 'en'
          },
          {
            text: 'The information in this report is true to the best of this registrar\'s knowledge.',
            lang: 'en'
          }
        ]
      };

      // Validate report
      const validation = validateRestoreReport(report);
      expect(validation.valid).toBe(true);
    });

    test('should calculate all grace period dates', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const config: GracePeriodConfig = DEFAULT_GRACE_PERIODS;

      const addEnd = calculateGracePeriodEnd(startDate, config.addPeriod);
      const renewEnd = calculateGracePeriodEnd(startDate, config.renewPeriod);
      const transferEnd = calculateGracePeriodEnd(startDate, config.transferPeriod);
      const redemptionEnd = calculateGracePeriodEnd(startDate, config.redemptionPeriod);

      expect(addEnd.getDate()).toBe(20);        // +5 days
      expect(renewEnd.getDate()).toBe(20);      // +5 days
      expect(transferEnd.getDate()).toBe(20);   // +5 days
      expect(redemptionEnd.getDate()).toBe(14); // +30 days = Feb 14
      expect(redemptionEnd.getMonth()).toBe(1); // February
    });
  });

  describe('Edge Cases', () => {
    test('should handle leap year', () => {
      const startDate = new Date('2024-02-28T10:00:00Z'); // 2024 is leap year
      const endDate = calculateGracePeriodEnd(startDate, 2);

      expect(endDate.getDate()).toBe(1); // March 1
      expect(endDate.getMonth()).toBe(2); // March
    });

    test('should handle long grace periods', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = calculateGracePeriodEnd(startDate, 365);

      // 2024 is a leap year, so 365 days from Jan 1 is Dec 31, 2024
      expect(endDate.getFullYear()).toBe(2024);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getDate()).toBe(31);
    });

    test('should handle zero grace period', () => {
      const startDate = new Date('2024-01-15T10:00:00Z');
      const endDate = calculateGracePeriodEnd(startDate, 0);

      expect(endDate.getTime()).toBe(startDate.getTime());
    });
  });
});
