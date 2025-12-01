/**
 * Fee Extension Tests (RFC 8748)
 */

import {
  Fee,
  FeeCommand,
  isValidCurrencyCode,
  parseFeeAmount,
  formatFeeAmount,
  calculateTotalFees,
  parseGracePeriod,
  FEE_NAMESPACE,
  FEE_NAMESPACE_0_11
} from '../src/types/Fee';

describe('Fee Extension', () => {
  describe('Currency Code Validation', () => {
    test('should validate common currency codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('GBP')).toBe(true);
      expect(isValidCurrencyCode('JPY')).toBe(true);
      expect(isValidCurrencyCode('CNY')).toBe(true);
      expect(isValidCurrencyCode('AUD')).toBe(true);
      expect(isValidCurrencyCode('CAD')).toBe(true);
    });

    test('should reject invalid currency codes', () => {
      expect(isValidCurrencyCode('US')).toBe(false);        // Too short
      expect(isValidCurrencyCode('USDD')).toBe(false);      // Too long
      expect(isValidCurrencyCode('usd')).toBe(false);       // Lowercase
      expect(isValidCurrencyCode('')).toBe(false);
      expect(isValidCurrencyCode('123')).toBe(false);
    });
  });

  describe('Fee Amount Parsing', () => {
    test('should parse valid fee amounts', () => {
      expect(parseFeeAmount('10.00')).toBe(10.0);
      expect(parseFeeAmount('0.18')).toBe(0.18);
      expect(parseFeeAmount('100')).toBe(100.0);
      expect(parseFeeAmount('1234.56')).toBe(1234.56);
    });

    test('should handle decimal places', () => {
      expect(parseFeeAmount('10.5')).toBe(10.5);
      expect(parseFeeAmount('10.555')).toBeCloseTo(10.555, 3);
    });

    test('should handle edge cases', () => {
      expect(parseFeeAmount('0')).toBe(0);
      expect(parseFeeAmount('0.00')).toBe(0);
    });
  });

  describe('Fee Amount Formatting', () => {
    test('should format amounts with two decimal places', () => {
      expect(formatFeeAmount(10)).toBe('10.00');
      expect(formatFeeAmount(10.5)).toBe('10.50');
      expect(formatFeeAmount(10.18)).toBe('10.18');
      expect(formatFeeAmount(1234.56)).toBe('1234.56');
    });

    test('should round to two decimal places', () => {
      // JavaScript rounds .555 down to .55, not up to .56
      expect(formatFeeAmount(10.555)).toBe('10.55');
      expect(formatFeeAmount(10.554)).toBe('10.55');
      expect(formatFeeAmount(10.556)).toBe('10.56');
    });

    test('should handle zero', () => {
      expect(formatFeeAmount(0)).toBe('0.00');
    });
  });

  describe('Total Fees Calculation', () => {
    test('should calculate total of multiple fees', () => {
      const fees: Fee[] = [
        { fee: '10.00', description: 'Registration' },
        { fee: '0.18', description: 'ICANN Fee' },
        { fee: '5.00', description: 'Setup' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBeCloseTo(15.18, 2);
    });

    test('should handle single fee', () => {
      const fees: Fee[] = [
        { fee: '10.00', description: 'Registration' }
      ];

      expect(calculateTotalFees(fees)).toBe(10.0);
    });

    test('should handle empty array', () => {
      expect(calculateTotalFees([])).toBe(0);
    });

    test('should ignore refundable status in calculation', () => {
      const fees: Fee[] = [
        { fee: '10.00', description: 'Registration', refundable: false },
        { fee: '5.00', description: 'Setup', refundable: true }
      ];

      expect(calculateTotalFees(fees)).toBe(15.0);
    });
  });

  describe('Grace Period Parsing', () => {
    test('should parse days duration', () => {
      expect(parseGracePeriod('P5D')).toBe(5);
      expect(parseGracePeriod('P1D')).toBe(1);
      expect(parseGracePeriod('P30D')).toBe(30);
    });

    test('should parse weeks to days', () => {
      expect(parseGracePeriod('P1W')).toBe(7);
      expect(parseGracePeriod('P2W')).toBe(14);
    });

    test('should handle invalid format', () => {
      expect(parseGracePeriod('invalid')).toBe(0);
      expect(parseGracePeriod('')).toBe(0);
      expect(parseGracePeriod('P')).toBe(0);
      expect(parseGracePeriod('PT24H')).toBe(0); // Hours not supported by this parser
    });
  });

  describe('Fee Structure', () => {
    test('should create basic fee', () => {
      const fee: Fee = {
        fee: '10.00',
        description: 'Domain Registration'
      };

      expect(fee.fee).toBe('10.00');
      expect(fee.description).toBe('Domain Registration');
    });

    test('should support refundable fees', () => {
      const fee: Fee = {
        fee: '5.00',
        description: 'Setup Fee',
        refundable: true,
        gracePeriod: 'P5D'
      };

      expect(fee.refundable).toBe(true);
      expect(fee.gracePeriod).toBe('P5D');
      expect(parseGracePeriod(fee.gracePeriod!)).toBe(5);
    });

    test('should support applied timing', () => {
      const fee: Fee = {
        fee: '10.00',
        description: 'Registration',
        applied: 'immediate'
      };

      expect(fee.applied).toBe('immediate');
    });

    test('should support delayed fees', () => {
      const fee: Fee = {
        fee: '12.00',
        description: 'Renewal',
        applied: 'delayed'
      };

      expect(fee.applied).toBe('delayed');
    });
  });

  describe('Fee Commands', () => {
    test('should support all fee command types', () => {
      const commands: FeeCommand[] = ['create', 'renew', 'transfer', 'restore', 'update'];
      
      commands.forEach(cmd => {
        expect(['create', 'renew', 'transfer', 'restore', 'update']).toContain(cmd);
      });
    });
  });

  describe('Namespaces', () => {
    test('should have correct namespace URIs', () => {
      expect(FEE_NAMESPACE).toBe('urn:ietf:params:xml:ns:epp:fee-1.0');
      expect(FEE_NAMESPACE_0_11).toBe('urn:ietf:params:xml:ns:fee-0.11');
    });
  });

  describe('Integration Tests', () => {
    test('should calculate premium domain fees', () => {
      const fees: Fee[] = [
        { fee: '1000.00', description: 'Premium Registration' },
        { fee: '0.18', description: 'ICANN Fee' },
        { fee: '50.00', description: 'Premium Processing', refundable: true, gracePeriod: 'P5D' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBeCloseTo(1050.18, 2);
      expect(formatFeeAmount(total)).toBe('1050.18');
    });

    test('should handle multi-year renewal fees', () => {
      const yearlyFee = 12.00;
      const years = 3;
      const icannFee = 0.18 * years;

      const fees: Fee[] = [
        { fee: formatFeeAmount(yearlyFee * years), description: `${years} Year Renewal` },
        { fee: formatFeeAmount(icannFee), description: 'ICANN Fees' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBeCloseTo(36.54, 2);
    });

    test('should handle transfer fees with currency', () => {
      if (!isValidCurrencyCode('EUR')) {
        fail('EUR should be valid currency');
      }

      const fees: Fee[] = [
        { fee: '8.50', description: 'Transfer Fee' },
        { fee: '10.00', description: '1 Year Extension' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBe(18.50);
    });

    test('should calculate restore fees', () => {
      const fees: Fee[] = [
        { fee: '80.00', description: 'Redemption Restore', refundable: false },
        { fee: '12.00', description: '1 Year Renewal', refundable: false }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBe(92.00);

      // Check grace period
      const gracePeriod = 'P5D';
      expect(parseGracePeriod(gracePeriod)).toBe(5);
    });

    test('should handle fractional fees', () => {
      const fees: Fee[] = [
        { fee: '10.33', description: 'Fee 1' },
        { fee: '5.67', description: 'Fee 2' },
        { fee: '0.99', description: 'Fee 3' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBeCloseTo(16.99, 2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large amounts', () => {
      const amount = 999999.99;
      expect(formatFeeAmount(amount)).toBe('999999.99');
      expect(parseFeeAmount('999999.99')).toBe(999999.99);
    });

    test('should handle very small amounts', () => {
      const amount = 0.01;
      expect(formatFeeAmount(amount)).toBe('0.01');
      expect(parseFeeAmount('0.01')).toBe(0.01);
    });

    test('should handle fees with many decimal places', () => {
      const fees: Fee[] = [
        { fee: '10.123456', description: 'Precise Fee' }
      ];

      const total = calculateTotalFees(fees);
      expect(total).toBeCloseTo(10.123456, 6);
    });
  });
});
