# Quick Start Guide - EPP Client with SSL/TLS

Panduan cepat untuk mulai menggunakan EPP Client TypeScript dengan SSL/TLS configuration.

## 📦 Installation

```bash
npm install epp-client
# or
yarn add epp-client
# or
pnpm add epp-client
```

## 🚀 5-Minute Quick Start

### 1. Basic Connection (Testing)

```typescript
import { EppClient } from 'epp-client';

const client = new EppClient({
  host: 'epp-test.registry.com',
  port: 700,
  username: 'test-user',
  password: 'test-password',
  rejectUnauthorized: false, // ⚠️ Only for testing!
  debug: true
});

async function quickStart() {
  try {
    // Connect
    await client.connect();
    console.log('✅ Connected');
    
    // Login
    await client.login();
    console.log('✅ Logged in');
    
    // Check domain
    const result = await client.domainCheck(['example.com']);
    console.log('Domain availability:', result.data);
    
    // Logout
    await client.logout();
    console.log('✅ Logged out');
    
    // Disconnect
    await client.disconnect();
    console.log('✅ Disconnected');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

quickStart();
```

### 2. Production Configuration

```typescript
import { EppClient } from 'epp-client';
import * as fs from 'fs';

const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // Production SSL Configuration
  rejectUnauthorized: true,    // MUST be true!
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  
  timeout: 30000,
  debug: false
});
```

### 3. With Client Certificates (Mutual TLS)

```typescript
import { EppClient } from 'epp-client';
import * as fs from 'fs';

const client = new EppClient({
  host: 'epp.registry.com',
  port: 700,
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  
  // Mutual TLS
  clientCert: fs.readFileSync('./certs/client-cert.pem'),
  clientKey: fs.readFileSync('./certs/client-key.pem'),
  ca: fs.readFileSync('./certs/ca-bundle.pem'),
  
  // Optional: If key is encrypted
  passphrase: process.env.KEY_PASSPHRASE,
  
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});
```

## 📖 Common Operations

### Domain Check
```typescript
const result = await client.domainCheck([
  'example.com',
  'example.net',
  'example.org'
]);

result.data.forEach(domain => {
  console.log(`${domain.name}: ${domain.available ? 'Available' : 'Not available'}`);
});
```

### Domain Info
```typescript
const info = await client.domainInfo('example.com');
console.log('Domain:', info.data.name);
console.log('Status:', info.data.status);
console.log('Registrant:', info.data.registrant);
console.log('Expires:', info.data.exDate);
```

### Domain Create
```typescript
const result = await client.domainCreate({
  name: 'example.com',
  period: { value: 1, unit: 'y' },
  registrant: 'CONTACT-ID',
  contacts: [
    { type: 'admin', id: 'ADMIN-ID' },
    { type: 'tech', id: 'TECH-ID' }
  ],
  ns: {
    hostObj: ['ns1.example.com', 'ns2.example.com']
  },
  authInfo: { pw: 'strong-auth-code' }
});

console.log('Domain created:', result.data.name);
```

### Contact Create
```typescript
const result = await client.contactCreate({
  id: 'CONTACT-001',
  postalInfo: {
    type: 'int',
    name: 'John Doe',
    org: 'Example Inc.',
    addr: {
      street: ['123 Main Street'],
      city: 'New York',
      sp: 'NY',
      pc: '10001',
      cc: 'US'
    }
  },
  voice: '+1.2125551234',
  email: 'john@example.com',
  authInfo: { pw: 'contact-auth-code' }
});

console.log('Contact created:', result.data.id);
```

## 🔒 SSL/TLS Configuration Options

### All Available Options

```typescript
interface EppConfig {
  // Connection (Required)
  host: string;                     // EPP server hostname
  port?: number;                    // Default: 700
  username: string;                 // Client ID
  password: string;                 // Password
  
  // Basic SSL/TLS
  rejectUnauthorized?: boolean;     // Default: true
  minVersion?: string;              // Default: 'TLSv1.2'
  maxVersion?: string;              // Default: 'TLSv1.3'
  
  // Mutual TLS (Optional)
  clientCert?: string | Buffer;     // Client certificate
  clientKey?: string | Buffer;      // Client private key
  ca?: string | Buffer | Array;     // CA bundle
  passphrase?: string;              // Key passphrase
  
  // Advanced (Optional)
  ciphers?: string;                 // Cipher suites
  servername?: string;              // SNI server name
  checkServerIdentity?: boolean;    // Default: true
  
  // Client Options
  lang?: string;                    // Default: 'en'
  version?: string;                 // Default: '1.0'
  timeout?: number;                 // Default: 30000ms
  debug?: boolean;                  // Default: false
}
```

## 🛠️ Environment Setup

### 1. Create `.env` file
```bash
EPP_HOST=epp.registry.com
EPP_PORT=700
EPP_USERNAME=your-username
EPP_PASSWORD=your-password
KEY_PASSPHRASE=your-key-passphrase
```

### 2. Load Environment Variables
```typescript
import * as dotenv from 'dotenv';
dotenv.config();

const client = new EppClient({
  host: process.env.EPP_HOST!,
  port: parseInt(process.env.EPP_PORT || '700'),
  username: process.env.EPP_USERNAME!,
  password: process.env.EPP_PASSWORD!,
  passphrase: process.env.KEY_PASSPHRASE
});
```

## 📝 Error Handling

### Basic Error Handling
```typescript
try {
  await client.connect();
  await client.login();
  
  // Your operations here
  
  await client.logout();
  await client.disconnect();
  
} catch (error: any) {
  console.error('EPP Error:', error.code, error.message);
  
  // Cleanup
  if (client.isConnected()) {
    try {
      await client.disconnect();
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }
  }
}
```

### SSL-Specific Error Handling
```typescript
try {
  await client.connect();
} catch (error: any) {
  if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    console.error('Self-signed certificate detected');
    console.error('For testing: set rejectUnauthorized: false');
    console.error('For production: add CA to trust store');
  } else if (error.code === 'CERT_HAS_EXPIRED') {
    console.error('Certificate has expired');
  } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    console.error('Certificate hostname mismatch');
  } else {
    console.error('Connection error:', error.message);
  }
}
```

## 🎯 Common Use Cases

### 1. Check Multiple Domains
```typescript
async function checkDomains(domains: string[]) {
  await client.connect();
  await client.login();
  
  const result = await client.domainCheck(domains);
  
  await client.logout();
  await client.disconnect();
  
  return result.data;
}
```

### 2. Register Domain (Complete Flow)
```typescript
async function registerDomain(domainName: string) {
  await client.connect();
  await client.login();
  
  // 1. Check availability
  const check = await client.domainCheck([domainName]);
  if (!check.data[0].available) {
    throw new Error('Domain not available');
  }
  
  // 2. Create contacts
  const registrant = await client.contactCreate({
    id: 'REG-001',
    // ... contact details
  });
  
  // 3. Create domain
  const domain = await client.domainCreate({
    name: domainName,
    period: { value: 1, unit: 'y' },
    registrant: registrant.data.id,
    // ... other details
  });
  
  await client.logout();
  await client.disconnect();
  
  return domain.data;
}
```

### 3. Transfer Domain
```typescript
async function transferDomain(domainName: string, authCode: string) {
  await client.connect();
  await client.login();
  
  const result = await client.domainTransfer({
    name: domainName,
    op: 'request',
    authInfo: { pw: authCode },
    period: { value: 1, unit: 'y' }
  });
  
  await client.logout();
  await client.disconnect();
  
  return result;
}
```

## 🧪 Testing

### Run Examples
```bash
# Basic usage
npm run example:basic

# TLS/TCP connection
npm run example:tls

# SSL configurations
npm run example:ssl

# Complete domain registration
npm run example:domain

# Domain transfer
npm run example:transfer

# Run all examples
npm run example:all
```

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📚 Next Steps

1. **Read Documentation**
   - [SSL/TLS Configuration Guide](../docs/SSL_TLS_CONFIGURATION.md)
   - [RFC Documentation](../docs/RFC_DOCUMENTATION.md)
   - [TLS/TCP Implementation](../docs/TLS_TCP_IMPLEMENTATION.md)

2. **Explore Examples**
   - Check `/examples` folder
   - Run examples dengan `npm run example:*`
   - Read [Examples README](../examples/README.md)

3. **Configuration**
   - Set up certificates for mutual TLS
   - Configure environment variables
   - Test in development environment

4. **Production Deployment**
   - Use proper CA-signed certificates
   - Enable certificate validation
   - Set up monitoring and logging
   - Follow security best practices

## 🔗 Resources

- **Repository**: [github.com/al0fayz/epp-ts](https://github.com/al0fayz/epp-ts)
- **RFC 5730**: EPP Core Protocol
- **RFC 5731**: EPP Domain Mapping
- **RFC 5734**: EPP Transport over TCP

## ❓ Need Help?

1. Check [Troubleshooting Guide](../docs/SSL_TLS_CONFIGURATION.md#troubleshooting)
2. Review [Examples](../examples/)
3. Enable debug mode: `debug: true`
4. Read error messages carefully
5. Consult RFC documentation

## 📄 License

MIT License - see LICENSE file for details

---

**Version**: 1.0.0  
**Last Updated**: December 2025
