# EPP Client TypeScript

<div align="center">

[![RFC 5730](https://img.shields.io/badge/RFC-5730-blue.svg)](https://www.rfc-editor.org/rfc/rfc5730.html)
[![RFC 5731](https://img.shields.io/badge/RFC-5731-blue.svg)](https://www.rfc-editor.org/rfc/rfc5731.html)
[![RFC 5732](https://img.shields.io/badge/RFC-5732-blue.svg)](https://www.rfc-editor.org/rfc/rfc5732.html)
[![RFC 5733](https://img.shields.io/badge/RFC-5733-blue.svg)](https://www.rfc-editor.org/rfc/rfc5733.html)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Professional TypeScript EPP (Extensible Provisioning Protocol) Client**

Fully documented dengan referensi RFC lengkap untuk domain registry operations.

[Documentation](#documentation) • [Features](#features) • [Examples](#examples) • [RFC Compliance](#rfc-compliance)

</div>

---

## 🎯 Overview

EPP Client TypeScript adalah implementasi lengkap dari EPP Protocol (RFC 5730-5734) dengan dokumentasi komprehensif yang mengacu pada RFC di setiap type dan function. Client ini dirancang untuk production-ready domain registry operations.

### Mengapa EPP Client Ini?

- ✅ **RFC Compliant**: Setiap function dan type didokumentasikan dengan RFC reference yang spesifik
- ✅ **Type-Safe**: Full TypeScript support dengan comprehensive type definitions
- ✅ **Production Ready**: Error handling, session management, dan best practices
- ✅ **Well Documented**: Setiap method dilengkapi dengan penjelasan, parameters, result codes, dan examples
- ✅ **Complete**: Support untuk semua EPP operations (domain, contact, host, transfer)

## 📦 Installation

```bash
npm install epp-client
# or
yarn add epp-client
# or
pnpm add epp-client
```

## 🚀 Quick Start

```typescript
import { EppClient } from 'epp-client';

// Initialize client dengan TLS/TCP
const client = new EppClient({
  host: 'epp.registry.example',  // EPP server hostname
  port: 700,                      // Standard EPP port (RFC 5734)
  username: 'registrar-id',
  password: 'password',
  timeout: 30000,
  debug: true // Enable untuk development
});

try {
  // Connect via TLS/TCP (RFC 5734)
  await client.connect();
  console.log('Connected via TLS/TCP');
  
  // Login - RFC 5730 Section 2.9.1.1
  await client.login();
  console.log('Authenticated');
  
  // Check domain availability - RFC 5731 Section 3.1.1
  const result = await client.domainCheck(['example.com', 'example.net']);
  console.log(result.data);
  // Output: [{ name: 'example.com', available: true }, ...]
  
  // Create domain - RFC 5731 Section 3.2.1
  await client.domainCreate({
    name: 'example.com',
    period: { value: 1, unit: 'y' },
    registrant: 'contact-id',
    contacts: [
      { type: 'admin', id: 'contact-id' },
      { type: 'tech', id: 'contact-id' }
    ],
    ns: { hostObj: ['ns1.example.com', 'ns2.example.com'] },
    authInfo: { pw: 'auth-code' }
  });
  
  // Logout - RFC 5730 Section 2.9.1.2
  await client.logout();
  console.log('Logged out');
  
  // Disconnect
  await client.disconnect();
  console.log('Disconnected');
  
} catch (error) {
  console.error(`EPP Error ${error.code}: ${error.message}`);
  
  // Always cleanup
  if (client.isConnected()) {
    await client.disconnect();
  }
}
```

## ✨ Features

### Transport Layer (RFC 5734)
- ✅ **TLS/TCP Connection**: Native TCP socket dengan TLS encryption
- ✅ **Standard Port 700**: EPP-compliant port configuration
- ✅ **4-byte Framing**: Proper EPP frame format implementation
- ✅ **Persistent Connection**: Stateful session management
- ✅ **TLS 1.2+**: Minimum TLS 1.2 enforced
- ✅ **Mutual TLS**: Client certificate authentication support

### Core Protocol (RFC 5730)
- ✅ **Session Management**: Connect/disconnect, login/logout
- ✅ **Result Codes**: Comprehensive error handling dengan RFC-compliant codes
- ✅ **Transaction IDs**: Client dan server transaction tracking
- ✅ **Server Greeting**: Automatic greeting message processing

### Domain Operations (RFC 5731)
- ✅ **Check**: Verify domain availability (bulk support)
- ✅ **Info**: Retrieve domain details
- ✅ **Create**: Register new domains
- ✅ **Update**: Modify domain information (NS, contacts, status)
- ✅ **Renew**: Extend registration period
- ✅ **Delete**: Remove domains (grace period support)
- ✅ **Transfer**: Full transfer operations (request, query, approve, reject, cancel)

### Contact Operations (RFC 5733)
- ✅ **Check**: Verify contact ID availability
- ✅ **Info**: Retrieve contact details
- ✅ **Create**: Create contact objects dengan postal info (loc/int)
- ✅ **Update**: Modify contact information
- ✅ **Delete**: Remove contact objects
- ✅ **Transfer**: Transfer contact ownership
- ✅ **Privacy**: Disclosure preferences untuk WHOIS/RDAP

### Host Operations (RFC 5732)
- ✅ **Check**: Verify host name availability
- ✅ **Info**: Retrieve host details
- ✅ **Create**: Create nameserver objects (glue record support)
- ✅ **Update**: Modify host information (IP addresses, name changes)
- ✅ **Delete**: Remove host objects

### Extensions
- ✅ **Fee Extension (RFC 8748)**: Query operation costs
- ✅ **Multiple Postal Info**: Support untuk loc dan int formats
- ✅ **IPv6 Support**: Full IPv4 dan IPv6 support untuk glue records

### Developer Experience
- ✅ **TypeScript**: Full type safety dengan comprehensive interfaces
- ✅ **Documentation**: JSDoc dengan RFC references di setiap method
- ✅ **Examples**: Complete examples untuk common scenarios
- ✅ **Error Messages**: Descriptive error messages dengan context
- ✅ **Debug Mode**: XML request/response logging

## 📖 Documentation

### Complete Guides

- **[RFC Documentation](./RFC_DOCUMENTATION.md)**: Complete RFC reference guide
  - Detailed type documentation dengan RFC sections
  - Method documentation dengan result codes
  - Best practices dan security considerations
  - Complete examples

- **[Perbaikan Summary](./PERBAIKAN_SUMMARY.md)**: Summary of improvements
  - What was fixed dan improved
  - RFC compliance details
  - Technical improvements

### Examples

- **[Complete Domain Registration](./examples/complete-domain-registration.ts)**
  - Full flow dari check sampai registration
  - Contact creation
  - Nameserver setup
  - Domain verification

- **[Domain Transfer](./examples/domain-transfer.ts)**
  - Transfer request (gaining registrar)
  - Transfer approval/rejection (losing registrar)
  - Transfer query dan cancellation
  - Transfer best practices

## 🎓 Core Concepts

### 1. EPP Sessions

EPP menggunakan persistent, stateful sessions:

```typescript
// Login required before any operations
await client.login();

// Perform operations
await client.domainCheck(['example.com']);

// Always logout to end session
await client.logout();
```

### 2. Object Model

EPP menggunakan hierarchical object model:

- **Domains**: Primary objects (registrations)
- **Contacts**: Associated dengan domains (registrant, admin, tech, billing)
- **Hosts**: Nameservers untuk domains (subordinate atau external)

### 3. Result Codes (RFC 5730 Section 3)

```typescript
// Success codes (1xxx)
1000  // Command completed successfully
1001  // Command completed successfully; action pending
1500  // Command completed successfully; ending session

// Error codes (2xxx)
2200  // Authentication error
2302  // Object exists
2303  // Object does not exist
2304  // Object status prohibits operation
```

### 4. Authorization Info

Authorization codes digunakan untuk:
- Domain transfers
- Access restricted information
- Contact transfers

```typescript
// Create dengan authInfo
await client.domainCreate({
  // ...
  authInfo: { pw: 'strong-auth-code-2024' }
});

// Transfer dengan authInfo
await client.domainTransfer({
  name: 'example.com',
  op: 'request',
  authInfo: { pw: 'auth-code-from-current-registrar' }
});
```

### 5. Nameserver Types

**Subordinate Hosts (Glue Records)**:
```typescript
// ns1.example.com untuk domain example.com
// MUST have IP addresses
await client.hostCreate({
  name: 'ns1.example.com',
  addr: [
    { ip: '192.0.2.1', type: 'v4' },
    { ip: '2001:db8::1', type: 'v6' }
  ]
});
```

**External Hosts**:
```typescript
// ns1.otherdomain.com untuk domain example.com
// NO IP addresses needed
await client.domainCreate({
  name: 'example.com',
  ns: { hostObj: ['ns1.otherdomain.com'] }
  // ...
});
```

## 🔒 Security

### Best Practices

1. **Always use HTTPS/TLS** untuk EPP connections
2. **Store credentials securely** - Never hardcode passwords
3. **Use strong auth codes** - Minimum 8 characters, random
4. **Implement timeout** - Default 30 seconds recommended
5. **Logout properly** - Always end sessions
6. **Validate inputs** - Check domain names, contact IDs
7. **Handle errors** - Implement proper error handling

### Contact Privacy

```typescript
// Privacy control dengan disclosure preferences
await client.contactCreate({
  id: 'contact-123',
  // ...
  disclose: {
    flag: 0, // 0 = Hide, 1 = Show
    name: { type: 'int' },
    addr: { type: 'int' },
    email: true
  }
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests dengan coverage
npm run test:coverage

# Run tests dalam watch mode
npm run test:watch
```

## 📝 Examples

### Domain Registration Flow

```typescript
// 1. Check availability
const check = await client.domainCheck(['example.com']);

// 2. Create contacts
await client.contactCreate({
  id: 'reg-001',
  postalInfo: { type: 'int', name: 'John Doe', /* ... */ },
  email: 'john@example.com',
  authInfo: { pw: 'password' }
});

// 3. Create nameservers
await client.hostCreate({
  name: 'ns1.example.com',
  addr: [{ ip: '192.0.2.1', type: 'v4' }]
});

// 4. Register domain
await client.domainCreate({
  name: 'example.com',
  period: { value: 1, unit: 'y' },
  registrant: 'reg-001',
  contacts: [{ type: 'admin', id: 'reg-001' }],
  ns: { hostObj: ['ns1.example.com'] },
  authInfo: { pw: 'auth-code' }
});
```

### Domain Transfer

```typescript
// Gaining registrar: Request transfer
await client.domainTransfer({
  name: 'example.com',
  op: 'request',
  authInfo: { pw: 'auth-from-losing-registrar' },
  period: { value: 1, unit: 'y' } // Optional renewal
});

// Query transfer status
await client.domainTransfer({
  name: 'example.com',
  op: 'query'
});

// Losing registrar: Approve transfer
await client.domainTransfer({
  name: 'example.com',
  op: 'approve'
});
```

## 🔧 RFC Compliance

This client implements the following RFCs:

| RFC | Title | Status |
|-----|-------|--------|
| [RFC 5730](https://www.rfc-editor.org/rfc/rfc5730.html) | Extensible Provisioning Protocol (EPP) | ✅ Implemented |
| [RFC 5731](https://www.rfc-editor.org/rfc/rfc5731.html) | EPP Domain Name Mapping | ✅ Implemented |
| [RFC 5732](https://www.rfc-editor.org/rfc/rfc5732.html) | EPP Host Mapping | ✅ Implemented |
| [RFC 5733](https://www.rfc-editor.org/rfc/rfc5733.html) | EPP Contact Mapping | ✅ Implemented |
| [RFC 5734](https://www.rfc-editor.org/rfc/rfc5734.html) | EPP Transport over TCP | ✅ Implemented |
| [RFC 8748](https://www.rfc-editor.org/rfc/rfc8748.html) | EPP Fee Extension | ✅ Implemented |

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- IETF untuk EPP protocol specifications
- Domain registry community untuk best practices
- TypeScript team untuk excellent tooling

## 📞 Support

- 📖 Documentation: [RFC_DOCUMENTATION.md](./RFC_DOCUMENTATION.md)
- 💬 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 📧 Email: support@example.com

---

<div align="center">

**Built with ❤️ for the domain registry community**

Fully compliant dengan RFC 5730-5734 | TypeScript | Production Ready

</div>