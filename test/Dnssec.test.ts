/**
 * DNSSEC Validation Tests
 * Testing DNSSEC types and validation functions according to RFC 5910
 */

import {
  DsData,
  KeyData,
  validateDsData,
  validateKeyData,
  DNSSEC_ALGORITHMS,
  DNSSEC_DIGEST_TYPES
} from '../src/types/Dnssec';

describe('DNSSEC Validation (RFC 5910)', () => {
  
  describe('DS Data Validation', () => {
    it('should validate correct DS data', () => {
      const validDsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB' // 64 hex chars for SHA-256
      };

      expect(validateDsData(validDsData)).toBe(true);
    });

    it('should reject keyTag < 0', () => {
      const invalidDsData: DsData = {
        keyTag: -1,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(invalidDsData)).toBe(false);
    });

    it('should reject keyTag > 65535', () => {
      const invalidDsData: DsData = {
        keyTag: 65536,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(invalidDsData)).toBe(false);
    });

    it('should reject invalid algorithm', () => {
      const invalidDsData: DsData = {
        keyTag: 12345,
        alg: 256, // Out of range
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(invalidDsData)).toBe(false);
    });

    it('should reject invalid digest type', () => {
      const invalidDsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 256, // Out of range
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(invalidDsData)).toBe(false);
    });

    it('should reject empty digest', () => {
      const invalidDsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: ''
      };

      expect(validateDsData(invalidDsData)).toBe(false);
    });

    it('should accept DS data with keyData', () => {
      const validDsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB', // 64 hex chars
        keyData: {
          flags: 257,
          protocol: 3,
          alg: 8,
          pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
        }
      };

      expect(validateDsData(validDsData)).toBe(true);
    });
  });

  describe('Key Data Validation', () => {
    it('should validate correct key data', () => {
      const validKeyData: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(validKeyData)).toBe(true);
    });

    it('should accept ZSK flag (256)', () => {
      const zskData: KeyData = {
        flags: 256,
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(zskData)).toBe(true);
    });

    it('should accept KSK flag (257)', () => {
      const kskData: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(kskData)).toBe(true);
    });

    it('should reject invalid flags', () => {
      const invalidKeyData: KeyData = {
        flags: 100, // Invalid flag
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(invalidKeyData)).toBe(false);
    });

    it('should reject protocol != 3', () => {
      const invalidKeyData: KeyData = {
        flags: 257,
        protocol: 2, // Must be 3 for DNSSEC
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(invalidKeyData)).toBe(false);
    });

    it('should reject invalid algorithm', () => {
      const invalidKeyData: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 256, // Out of range
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
      };

      expect(validateKeyData(invalidKeyData)).toBe(false);
    });

    it('should reject empty public key', () => {
      const invalidKeyData: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 8,
        pubKey: ''
      };

      expect(validateKeyData(invalidKeyData)).toBe(false);
    });
  });

  describe('DNSSEC Algorithm Constants', () => {
    it('should have correct algorithm mappings', () => {
      expect(DNSSEC_ALGORITHMS[5]).toBe('RSA/SHA-1');
      expect(DNSSEC_ALGORITHMS[7]).toBe('RSASHA1-NSEC3-SHA1');
      expect(DNSSEC_ALGORITHMS[8]).toBe('RSA/SHA-256');
      expect(DNSSEC_ALGORITHMS[10]).toBe('RSA/SHA-512');
      expect(DNSSEC_ALGORITHMS[13]).toBe('ECDSA Curve P-256 with SHA-256');
      expect(DNSSEC_ALGORITHMS[14]).toBe('ECDSA Curve P-384 with SHA-384');
      expect(DNSSEC_ALGORITHMS[15]).toBe('Ed25519');
      expect(DNSSEC_ALGORITHMS[16]).toBe('Ed448');
    });

    it('should have all recommended algorithms', () => {
      // Recommended algorithms per RFC 8624
      expect(DNSSEC_ALGORITHMS[8]).toBeDefined(); // RSA/SHA-256
      expect(DNSSEC_ALGORITHMS[13]).toBeDefined(); // ECDSA P-256
      expect(DNSSEC_ALGORITHMS[14]).toBeDefined(); // ECDSA P-384
      expect(DNSSEC_ALGORITHMS[15]).toBeDefined(); // Ed25519
    });
  });

  describe('DNSSEC Digest Type Constants', () => {
    it('should have correct digest type mappings', () => {
      expect(DNSSEC_DIGEST_TYPES[1]).toBe('SHA-1');
      expect(DNSSEC_DIGEST_TYPES[2]).toBe('SHA-256');
      expect(DNSSEC_DIGEST_TYPES[4]).toBe('SHA-384');
    });

    it('should have mandatory and recommended digest types', () => {
      expect(DNSSEC_DIGEST_TYPES[2]).toBeDefined(); // SHA-256 (mandatory)
      expect(DNSSEC_DIGEST_TYPES[4]).toBeDefined(); // SHA-384 (recommended)
    });
  });

  describe('Complex DNSSEC Scenarios', () => {
    it('should validate multiple DS records', () => {
      const dsRecords: DsData[] = [
        {
          keyTag: 12345,
          alg: 8,
          digestType: 2,
          digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB' // SHA-256 (64 chars)
        },
        {
          keyTag: 54321,
          alg: 13,
          digestType: 4,
          digest: '2BB183AF5F22588179A53B0A98631FAD1A2921182BB183AF5F22588179A53B0A98631FAD1A2921182BB183AF5F225881' // SHA-384 (96 chars)
        }
      ];

      dsRecords.forEach(ds => {
        expect(validateDsData(ds)).toBe(true);
      });
    });

    it('should validate key rollover scenario', () => {
      // Old key
      const oldKey: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890OLD=='
      };

      // New key
      const newKey: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 13, // Different algorithm
        pubKey: 'AwEAAa1234567890NEW=='
      };

      expect(validateKeyData(oldKey)).toBe(true);
      expect(validateKeyData(newKey)).toBe(true);
    });

    it('should validate ZSK and KSK together', () => {
      const zsk: KeyData = {
        flags: 256, // Zone Signing Key
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAAZSK123=='
      };

      const ksk: KeyData = {
        flags: 257, // Key Signing Key
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAAKSK456=='
      };

      expect(validateKeyData(zsk)).toBe(true);
      expect(validateKeyData(ksk)).toBe(true);
    });

    it('should validate DS with different algorithms', () => {
      const algorithms = [5, 7, 8, 10, 13, 14, 15, 16];
      
      algorithms.forEach(alg => {
        const dsData: DsData = {
          keyTag: 12345,
          alg: alg,
          digestType: 2,
          digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB' // SHA-256
        };

        expect(validateDsData(dsData)).toBe(true);
      });
    });

    it('should validate DS with different digest types', () => {
      const testCases = [
        { digestType: 1, digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE' }, // SHA-1 (40 chars)
        { digestType: 2, digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB' }, // SHA-256 (64 chars)
        { digestType: 4, digest: '2BB183AF5F22588179A53B0A98631FAD1A2921182BB183AF5F22588179A53B0A98631FAD1A2921182BB183AF5F225881' } // SHA-384 (96 chars)
      ];
      
      testCases.forEach(({ digestType, digest }) => {
        const dsData: DsData = {
          keyTag: 12345,
          alg: 8,
          digestType: digestType,
          digest: digest
        };

        expect(validateDsData(dsData)).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should validate keyTag at boundary (0)', () => {
      const dsData: DsData = {
        keyTag: 0,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(dsData)).toBe(true);
    });

    it('should validate keyTag at boundary (65535)', () => {
      const dsData: DsData = {
        keyTag: 65535,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE49FD46E6C4B45C55D4AC69CB'
      };

      expect(validateDsData(dsData)).toBe(true);
    });

    it('should reject incorrect digest length', () => {
      const dsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55' // Too short for SHA-256
      };

      expect(validateDsData(dsData)).toBe(false);
    });

    it('should validate very long public key', () => {
      const keyData: KeyData = {
        flags: 257,
        protocol: 3,
        alg: 8,
        pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10) + '=='
      };

      expect(validateKeyData(keyData)).toBe(true);
    });
  });

  describe('RFC 5910 Compliance', () => {
    it('should support all required DS data elements', () => {
      const dsData: DsData = {
        keyTag: 12345,    // REQUIRED
        alg: 8,           // REQUIRED
        digestType: 2,    // REQUIRED
        digest: '49FD'    // REQUIRED
      };

      // All required fields present
      expect(dsData.keyTag).toBeDefined();
      expect(dsData.alg).toBeDefined();
      expect(dsData.digestType).toBeDefined();
      expect(dsData.digest).toBeDefined();
    });

    it('should support optional keyData in DS data', () => {
      const dsData: DsData = {
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD',
        keyData: {        // OPTIONAL per RFC 5910
          flags: 257,
          protocol: 3,
          alg: 8,
          pubKey: 'AwEAAa=='
        }
      };

      expect(dsData.keyData).toBeDefined();
      expect(dsData.keyData?.flags).toBe(257);
    });

    it('should support all required key data elements', () => {
      const keyData: KeyData = {
        flags: 257,       // REQUIRED
        protocol: 3,      // REQUIRED
        alg: 8,           // REQUIRED
        pubKey: 'AwEAAa==' // REQUIRED
      };

      // All required fields present
      expect(keyData.flags).toBeDefined();
      expect(keyData.protocol).toBeDefined();
      expect(keyData.alg).toBeDefined();
      expect(keyData.pubKey).toBeDefined();
    });
  });
});
