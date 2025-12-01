# DNSSEC Extension Guide for EPP Client

## Overview

This guide covers the implementation of DNSSEC (Domain Name System Security Extensions) support in the EPP Client, following **RFC 5910** - "Domain Name System (DNS) Security Extensions Mapping for EPP".

## Table of Contents

- [What is DNSSEC?](#what-is-dnssec)
- [Supported Operations](#supported-operations)
- [Data Structures](#data-structures)
- [Usage Examples](#usage-examples)
- [Algorithm Support](#algorithm-support)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## What is DNSSEC?

DNSSEC provides:
- **Authentication**: Verifies DNS data originates from authorized sources
- **Data Integrity**: Ensures DNS data hasn't been modified in transit
- **Authenticated Denial of Existence**: Proves that a domain name or record doesn't exist

### Key Components

1. **DS Records (Delegation Signer)**
   - Published in parent zone
   - Links parent zone to child zone
   - Contains hash of child zone's DNSKEY

2. **DNSKEY Records**
   - Published in child zone
   - Contains public keys for zone signing
   - Two types: ZSK (Zone Signing Key) and KSK (Key Signing Key)

3. **RRSIG Records**
   - Signatures over DNS records
   - Created with private keys
   - Verified with public keys in DNSKEY records

## Supported Operations

### 1. Domain Create with DNSSEC

Add DNSSEC data when creating a new domain:

```typescript
await client.domainCreate({
  name: 'example.com',
  period: { value: 1, unit: 'y' },
  registrant: 'CONTACT-001',
  authInfo: { pw: 'secure-password' },
  // DNSSEC Extension
  dnssec: {
    maxSigLife: 604800, // 7 days in seconds (optional)
    dsData: [{
      keyTag: 12345,
      alg: 8, // RSA/SHA-256
      digestType: 2, // SHA-256
      digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
    }]
  }
});
```

### 2. Domain Update - Add DNSSEC Data

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    add: {
      dsData: [{
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
      }],
      maxSigLife: 604800
    },
    urgent: false // Set to true for urgent updates
  }
});
```

### 3. Domain Update - Remove Specific DNSSEC Data

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: {
      dsData: [{
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
      }]
    }
  }
});
```

### 4. Domain Update - Remove All DNSSEC Data

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: {
      all: true // Removes all DNSSEC data
    }
  }
});
```

### 5. Domain Update - Change maxSigLife

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    chg: {
      maxSigLife: 1209600 // 14 days in seconds
    }
  }
});
```

### 6. Complex Update (Add, Remove, Change)

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    add: {
      dsData: [{
        keyTag: 54321,
        alg: 13, // ECDSA P-256
        digestType: 4, // SHA-384
        digest: '2BB183AF5F22588179A53B0A98631FAD1A292118'
      }]
    },
    rem: {
      dsData: [{
        keyTag: 12345,
        alg: 8,
        digestType: 2,
        digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
      }]
    },
    chg: {
      maxSigLife: 1209600
    },
    urgent: true
  }
});
```

## Data Structures

### DS Data (Delegation Signer)

```typescript
interface DsData {
  keyTag: number;       // 0-65535: Key identifier
  alg: number;          // Algorithm number (see table below)
  digestType: number;   // Digest algorithm (1=SHA-1, 2=SHA-256, 4=SHA-384)
  digest: string;       // Hex-encoded digest of DNSKEY
  keyData?: KeyData;    // Optional: Associated key data
}
```

### Key Data (DNSKEY)

```typescript
interface KeyData {
  flags: number;        // 256=ZSK, 257=KSK
  protocol: number;     // Always 3 for DNSSEC
  alg: number;          // Algorithm number
  pubKey: string;       // Base64-encoded public key
}
```

### DNSSEC Create

```typescript
interface DnssecCreate {
  maxSigLife?: number;  // Maximum signature lifetime (seconds)
  dsData?: DsData[];    // DS records
  keyData?: KeyData[];  // DNSKEY records
}
```

### DNSSEC Update

```typescript
interface DnssecUpdate {
  add?: {
    dsData?: DsData[];
    keyData?: KeyData[];
    maxSigLife?: number;
  };
  rem?: {
    all?: boolean;      // Remove all DNSSEC data
    dsData?: DsData[];
    keyData?: KeyData[];
  };
  chg?: {
    maxSigLife?: number;
  };
  urgent?: boolean;     // Urgent flag for immediate propagation
}
```

## Algorithm Support

### DNSSEC Algorithms (RFC 8624)

| Algorithm | Number | Description | Status |
|-----------|--------|-------------|--------|
| RSA/SHA-1 | 5 | RSA with SHA-1 | NOT RECOMMENDED |
| RSASHA1-NSEC3-SHA1 | 7 | RSA/SHA-1 with NSEC3 | NOT RECOMMENDED |
| **RSA/SHA-256** | **8** | RSA with SHA-256 | **RECOMMENDED** |
| RSA/SHA-512 | 10 | RSA with SHA-512 | RECOMMENDED |
| **ECDSA P-256** | **13** | ECDSA Curve P-256 with SHA-256 | **RECOMMENDED** |
| **ECDSA P-384** | **14** | ECDSA Curve P-384 with SHA-384 | **RECOMMENDED** |
| Ed25519 | 15 | EdDSA using Curve25519 | RECOMMENDED |
| Ed448 | 16 | EdDSA using Curve448 | RECOMMENDED |

### Digest Types

| Digest Type | Number | Description | Status |
|-------------|--------|-------------|--------|
| SHA-1 | 1 | SHA-1 hash | NOT RECOMMENDED |
| **SHA-256** | **2** | SHA-256 hash | **MANDATORY** |
| **SHA-384** | **4** | SHA-384 hash | **RECOMMENDED** |

## Usage Examples

### Example 1: Create Domain with DS Data

```typescript
import { EppClient } from 'epp-client';
import { validateDsData } from 'epp-client/types/Dnssec';

const client = new EppClient(config);
await client.connect();

// Validate DS data before sending
const dsData = {
  keyTag: 12345,
  alg: 8,
  digestType: 2,
  digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
};

if (validateDsData(dsData)) {
  const result = await client.domainCreate({
    name: 'secure-example.com',
    period: { value: 1, unit: 'y' },
    registrant: 'CONTACT-001',
    authInfo: { pw: 'password' },
    dnssec: {
      dsData: [dsData]
    }
  });
  console.log('Domain created with DNSSEC:', result);
}
```

### Example 2: Key Rollover

```typescript
// Step 1: Add new DS record alongside old one
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    add: {
      dsData: [{
        keyTag: 54321, // New key
        alg: 13,
        digestType: 2,
        digest: 'NEW_DIGEST_HERE'
      }]
    }
  }
});

// Step 2: Wait for TTL to expire (typically 24-48 hours)
// ...

// Step 3: Remove old DS record
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: {
      dsData: [{
        keyTag: 12345, // Old key
        alg: 8,
        digestType: 2,
        digest: 'OLD_DIGEST_HERE'
      }]
    }
  }
});
```

### Example 3: Emergency DNSSEC Removal

```typescript
// Use urgent flag for immediate propagation
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: {
      all: true
    },
    urgent: true // Registry should process immediately
  }
});
```

## Best Practices

### 1. Algorithm Selection

- **Use Algorithm 8 (RSA/SHA-256)** for broad compatibility
- **Use Algorithm 13 (ECDSA P-256)** for better performance and smaller records
- Avoid algorithms 5 and 7 (SHA-1 based)

### 2. Key Management

- Use **separate keys** for KSK (Key Signing Key) and ZSK (Zone Signing Key)
- KSK flags = 257 (longer lifetime, signs DNSKEY records)
- ZSK flags = 256 (shorter lifetime, signs zone data)

### 3. Key Rollover

1. **Pre-publish** new DS record alongside old one
2. Wait for **parent zone TTL** to expire
3. **Activate** new key in your DNS
4. Wait for **zone TTL** to expire
5. **Remove** old DS record

### 4. Signature Lifetime (maxSigLife)

- **Recommended**: 7-14 days (604800-1209600 seconds)
- Too short: Increases signing load
- Too long: Increases vulnerability window

### 5. Validation

Always validate DNSSEC data before sending:

```typescript
import { validateDsData, validateKeyData } from 'epp-client/types/Dnssec';

const dsValid = validateDsData(dsData);
const keyValid = validateKeyData(keyData);
```

### 6. Monitoring

Monitor DNSSEC status:

```typescript
const info = await client.domainInfo('example.com');
if (info.dnssec) {
  console.log('DNSSEC enabled');
  console.log('DS Records:', info.dnssec.dsData?.length);
  console.log('Max Sig Life:', info.dnssec.maxSigLife);
}
```

## Troubleshooting

### Common Issues

#### 1. Invalid Digest Length

**Problem**: DS record rejected due to invalid digest length

**Solution**: 
- SHA-1 digest: 40 hex characters (20 bytes)
- SHA-256 digest: 64 hex characters (32 bytes)
- SHA-384 digest: 96 hex characters (48 bytes)

#### 2. Key Tag Mismatch

**Problem**: DS record doesn't match DNSKEY

**Solution**: Calculate key tag correctly using RFC 4034 algorithm

```bash
# Calculate key tag from DNSKEY using dig
dig +short DNSKEY example.com | dnssec-dsfromkey -f - example.com
```

#### 3. Validation Failures

**Problem**: DNSSEC validation fails after update

**Causes**:
- Clock skew between authoritative and validating resolvers
- Signature not yet valid or already expired
- Incorrect DS record in parent zone

**Solution**:
- Ensure time synchronization (NTP)
- Check signature validity period
- Verify DS record matches DNSKEY

#### 4. Urgent Updates Not Processed

**Problem**: Urgent flag not respected by registry

**Solution**: Contact registry support; not all registries support urgent updates

### Validation Tools

Test DNSSEC configuration:

```bash
# Test DNSSEC validation
dig +dnssec example.com

# Check DS records in parent zone
dig +short DS example.com

# Verify DNSSEC chain
drill -TD example.com

# Online validator
# https://dnssec-debugger.verisignlabs.com/
```

## References

- **RFC 5910**: Domain Name System (DNS) Security Extensions Mapping for EPP
- **RFC 4033**: DNS Security Introduction and Requirements
- **RFC 4034**: Resource Records for DNS Security Extensions
- **RFC 4035**: Protocol Modifications for DNS Security Extensions
- **RFC 8624**: Algorithm Implementation Requirements and Usage Guidance for DNSSEC

## Support

For issues or questions:
1. Check the [examples/dnssec-operations.ts](../examples/dnssec-operations.ts) file
2. Consult your EPP registry's DNSSEC documentation
3. Review RFC 5910 for protocol details

## Version History

- **1.0.0** (2024): Initial DNSSEC support implementation
  - DS Data support
  - Key Data support
  - Create/Update/Info operations
  - Validation helpers
