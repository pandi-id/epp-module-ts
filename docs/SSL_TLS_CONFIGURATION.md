# SSL/TLS Configuration Guide

Panduan lengkap untuk mengkonfigurasi SSL/TLS pada EPP Client TypeScript sesuai RFC 5734 Section 5 - Security Considerations.

## 📋 Daftar Isi

- [Overview](#overview)
- [SSL/TLS Options](#ssltls-options)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Security Compliance](#security-compliance)

## Overview

EPP (Extensible Provisioning Protocol) **HARUS** menggunakan TLS (Transport Layer Security) untuk encrypt semua komunikasi antara client dan server. RFC 5734 mensyaratkan:

- **Minimum TLS Version**: TLS 1.2 atau lebih tinggi
- **Default Port**: 700 (untuk EPP over TCP)
- **Certificate Validation**: HARUS diaktifkan di production
- **Mutual TLS**: OPTIONAL tapi strongly recommended

## SSL/TLS Options

### Basic Options

```typescript
interface EppConfig {
  // Connection
  host: string;                    // EPP server hostname
  port?: number;                   // Default: 700
  
  // Authentication
  username: string;
  password: string;
  
  // SSL/TLS Basic
  rejectUnauthorized?: boolean;    // Default: true (MUST be true in production)
  minVersion?: string;             // Default: 'TLSv1.2'
  maxVersion?: string;             // Default: 'TLSv1.3'
}
```

### Advanced SSL Options

```typescript
interface EppConfig {
  // ... basic options ...
  
  // Client Certificate (Mutual TLS)
  clientCert?: string | Buffer;    // Client certificate (PEM format)
  clientKey?: string | Buffer;     // Client private key (PEM format)
  ca?: string | Buffer | Array<string | Buffer>; // CA bundle
  passphrase?: string;             // Passphrase for encrypted private key
  
  // Cipher Configuration
  ciphers?: string;                // Allowed cipher suites
  
  // SNI (Server Name Indication)
  servername?: string;             // Server name for SNI
  checkServerIdentity?: boolean;   // Default: true
}
```

## Configuration Examples

### 1. Production Environment (Recommended)

Konfigurasi paling aman untuk production:

```typescript
import { EppClient } from 'epp-client';

const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // SSL/TLS Configuration
  rejectUnauthorized: true,        // MUST be true!
  minVersion: 'TLSv1.2',           // Minimum version
  maxVersion: 'TLSv1.3',           // Prefer latest
  
  timeout: 30000,
  debug: false                      // Disable debug in production
});

try {
  await client.connect();
  // ... operations ...
  await client.disconnect();
} catch (error) {
  console.error('Connection failed:', error);
}
```

### 2. Mutual TLS (Client Certificate Authentication)

Untuk enhanced security dengan client certificates:

```typescript
import { EppClient } from 'epp-client';
import * as fs from 'fs';

// Load certificates
const clientCert = fs.readFileSync('./certs/client-cert.pem');
const clientKey = fs.readFileSync('./certs/client-key.pem');
const ca = fs.readFileSync('./certs/ca-bundle.pem');

const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // Mutual TLS
  clientCert: clientCert,
  clientKey: clientKey,
  ca: ca,
  
  // SSL Configuration
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
  
  timeout: 30000
});

try {
  await client.connect();
  console.log('Connected with mutual TLS authentication');
  // ... operations ...
} catch (error) {
  console.error('Mutual TLS failed:', error);
}
```

### 3. Encrypted Private Key with Passphrase

Jika private key Anda encrypted:

```typescript
import { EppClient } from 'epp-client';
import * as fs from 'fs';

const clientCert = fs.readFileSync('./certs/client-cert.pem');
const clientKey = fs.readFileSync('./certs/encrypted-key.pem');
const ca = fs.readFileSync('./certs/ca-bundle.pem');

const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // Encrypted Key Configuration
  clientCert: clientCert,
  clientKey: clientKey,
  passphrase: process.env.KEY_PASSPHRASE!, // Passphrase to decrypt key
  ca: ca,
  
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});
```

### 4. Custom Cipher Suites

Untuk specify cipher suites yang diperbolehkan:

```typescript
const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // Custom Ciphers (only strong ciphers)
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256'
  ].join(':'),
  
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});
```

### 5. SNI (Server Name Indication)

Untuk servers yang host multiple domains:

```typescript
const client = new EppClient({
  host: '192.168.1.100',          // IP address
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // SNI Configuration
  servername: 'epp.registry.com', // Actual hostname for SNI
  
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});
```

### 6. Testing Environment (Self-Signed Certificate)

⚠️ **WARNING**: HANYA untuk testing! JANGAN gunakan di production!

```typescript
const client = new EppClient({
  host: 'epp-test.registry.com',
  port: 700,
  username: 'test-user',
  password: 'test-password',
  
  // ⚠️ DANGEROUS: Skip certificate validation
  rejectUnauthorized: false,
  checkServerIdentity: false,
  
  timeout: 30000,
  debug: true
});
```

## Best Practices

### 🔒 Certificate Validation

**DO:**
- ✅ ALWAYS set `rejectUnauthorized: true` in production
- ✅ Use valid, CA-signed certificates
- ✅ Keep certificates up to date
- ✅ Monitor certificate expiry dates
- ✅ Verify certificate hostname matches server

**DON'T:**
- ❌ NEVER disable certificate validation in production
- ❌ Don't use expired certificates
- ❌ Don't use self-signed certificates in production

### 🔐 TLS Versions

**DO:**
- ✅ Use TLS 1.2 or higher (`minVersion: 'TLSv1.2'`)
- ✅ Prefer TLS 1.3 when available (`maxVersion: 'TLSv1.3'`)
- ✅ Test with latest TLS versions

**DON'T:**
- ❌ NEVER use TLS 1.0 or 1.1 (deprecated, insecure)
- ❌ Don't use SSL 2.0 or SSL 3.0 (broken)

### 🔑 Cipher Suites

**Recommended Ciphers (Strong):**
```
TLS_AES_256_GCM_SHA384
TLS_AES_128_GCM_SHA256
TLS_CHACHA20_POLY1305_SHA256
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-RSA-AES128-GCM-SHA256
```

**Avoid (Weak/Broken):**
```
RC4, DES, 3DES, MD5
Export-grade ciphers
NULL ciphers
Anonymous ciphers
```

### 🗝️ Key Management

**DO:**
- ✅ Store private keys securely (not in code!)
- ✅ Use environment variables or secure vaults
- ✅ Encrypt keys at rest
- ✅ Use strong passphrases (min 16 characters)
- ✅ Rotate certificates regularly (annually)
- ✅ Use Hardware Security Module (HSM) for production

**DON'T:**
- ❌ NEVER commit keys to version control
- ❌ Don't share private keys
- ❌ Don't store keys in plain text
- ❌ Don't use weak passphrases

### 🔍 Monitoring & Logging

**DO:**
- ✅ Log all connections (without sensitive data)
- ✅ Monitor certificate expiry
- ✅ Alert on TLS version downgrades
- ✅ Track failed authentication attempts
- ✅ Enable audit logging

**DON'T:**
- ❌ Don't log private keys
- ❌ Don't log passphrases
- ❌ Don't log full credentials in production

## Troubleshooting

### Common SSL/TLS Errors

#### 1. `DEPTH_ZERO_SELF_SIGNED_CERT`

**Problem**: Server menggunakan self-signed certificate

**Solution:**
```typescript
// For testing only:
rejectUnauthorized: false

// For production, add CA to trust store:
ca: fs.readFileSync('./certs/ca-cert.pem')
```

#### 2. `CERT_HAS_EXPIRED`

**Problem**: Server certificate sudah expired

**Solution:**
- Request certificate renewal dari registry
- Update certificate sebelum expiry

#### 3. `ERR_TLS_CERT_ALTNAME_INVALID`

**Problem**: Certificate hostname tidak match dengan server

**Solution:**
```typescript
// Ensure hostname matches certificate:
host: 'epp.registry.com',  // Must match certificate CN/SAN

// Or use servername for SNI:
servername: 'epp.registry.com'
```

#### 4. `EPROTO: wrong version number`

**Problem**: TLS version mismatch

**Solution:**
```typescript
// Try different TLS versions:
minVersion: 'TLSv1.2',  // or 'TLSv1.1'
maxVersion: 'TLSv1.3'
```

#### 5. `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**Problem**: CA certificate tidak ditemukan atau invalid

**Solution:**
```typescript
// Add CA bundle:
ca: [
  fs.readFileSync('./certs/root-ca.pem'),
  fs.readFileSync('./certs/intermediate-ca.pem')
]
```

#### 6. `ERR_SSL_WRONG_VERSION_NUMBER`

**Problem**: Server tidak support TLS version yang diminta

**Solution:**
```typescript
// Lower minimum version (if safe):
minVersion: 'TLSv1.1'  // Not recommended for production
```

### Debugging SSL Issues

Enable debug mode untuk detailed SSL information:

```typescript
const client = new EppClient({
  // ... config ...
  debug: true  // Shows TLS handshake, cipher, protocol details
});

await client.connect();

// Get connection info:
const connInfo = client.getConnectionInfo();
console.log('Protocol:', connInfo?.protocol);
console.log('Cipher:', connInfo?.cipher);
```

### Testing SSL Configuration

```bash
# Test TLS connection with OpenSSL:
openssl s_client -connect epp.registry.com:700 -tls1_2

# Show certificate details:
openssl s_client -connect epp.registry.com:700 -showcerts

# Test with client certificate:
openssl s_client -connect epp.registry.com:700 \
  -cert client-cert.pem \
  -key client-key.pem \
  -CAfile ca-bundle.pem
```

## Security Compliance

### PCI DSS Requirements

- **TLS Version**: Minimum TLS 1.2
- **Ciphers**: Only strong ciphers (no weak or NULL)
- **Certificates**: Valid, unexpired, properly configured
- **Key Management**: Secure storage, regular rotation

### HIPAA Requirements

- **Encryption**: TLS for data in transit
- **Authentication**: Strong authentication mechanisms
- **Audit**: Logging and monitoring
- **Access Control**: Proper key management

### GDPR Requirements

- **Data Protection**: Encryption in transit and at rest
- **Security Measures**: Appropriate technical measures
- **Breach Notification**: Detection and alerting systems

### RFC 5734 Requirements

- **Transport**: EPP over TCP (port 700)
- **Security**: TLS mandatory
- **Certificate**: Valid server certificate required
- **Mutual TLS**: OPTIONAL but recommended

## Examples

Lihat folder `/examples` untuk contoh lengkap:

- `ssl-configurations.ts` - Various SSL/TLS configurations
- `tls-tcp-connection.ts` - TLS connection examples
- `basic-usage.ts` - Basic EPP operations with TLS

## References

- **RFC 5734**: EPP Transport over TCP
- **RFC 8446**: The Transport Layer Security (TLS) Protocol Version 1.3
- **RFC 5246**: The Transport Layer Security (TLS) Protocol Version 1.2
- **RFC 5280**: Internet X.509 Public Key Infrastructure Certificate
- **NIST SP 800-52**: Guidelines for TLS Implementations

## Support

Untuk pertanyaan atau issues terkait SSL/TLS configuration:

1. Check examples di `/examples/ssl-configurations.ts`
2. Enable debug mode untuk troubleshooting
3. Review error messages dan consult troubleshooting section
4. Consult dengan EPP registry administrator Anda

---

**Last Updated**: December 2025  
**Version**: 1.0.0
