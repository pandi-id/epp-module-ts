# Dokumentasi RFC untuk EPP Client TypeScript

## Overview

EPP Client ini telah diperbaiki dan didokumentasikan sesuai dengan standar RFC berikut:

- **RFC 5730**: Extensible Provisioning Protocol (EPP) - Protokol inti
- **RFC 5731**: EPP Domain Name Mapping - Operasi domain
- **RFC 5732**: EPP Host Mapping - Operasi host (nameserver)
- **RFC 5733**: EPP Contact Mapping - Operasi contact
- **RFC 5734**: EPP Transport over TCP - Transport layer
- **RFC 8748**: EPP Fee Extension - Extension untuk fee checking

## Perbaikan yang Dilakukan

### 1. Types dengan Dokumentasi RFC Lengkap

#### Common Types (`src/types/Common.ts`)

**EppConfig**
- Referensi: RFC 5730 Section 2 - Transport Considerations
- Mendefinisikan konfigurasi koneksi EPP client
- Support untuk mutual TLS (RFC 5734 Section 5)
- Timeout dan debug options

**EppResponse**
- Referensi: RFC 5730 Section 2.6 - Response Format
- Structure standar untuk EPP responses
- Result codes mengikuti RFC 5730 Section 3:
  - 1000-1999: Command completed successfully
  - 2000-2999: Command error
  - 3000-3999: Client error
  - 4000-4999: Server error
  - 5000-5999: Connection error

**EppError**
- Referensi: RFC 5730 Section 3 - Result Codes
- Extended error handling dengan error values
- Support untuk detailed error reasons

**SessionOptions**
- Referensi: RFC 5730 Section 2.9.1.1 - Login Command
- Options untuk login command
- Support password change operation
- Configurable language dan protocol version

**Period**
- Referensi: RFC 5731 Section 2.2 - Common Elements
- Standarisasi unit waktu (years/months)
- Validasi positive integer values

**AuthInfo**
- Referensi: RFC 5731 Section 2.2, RFC 5733 Section 2.2
- Authorization information untuk transfer operations
- Support ROID untuk object-specific authorization

#### Domain Types (`src/types/Domain.ts`)

**DomainCreateRequest**
- Referensi: RFC 5731 Section 3.2.1 - Create Command
- Period dengan proper unit (years/months)
- Nameserver support (hostObj dan hostAttr)
- Required contacts (admin, tech, billing)
- Authorization info untuk future transfers

**DomainUpdateRequest**
- Referensi: RFC 5731 Section 3.2.5 - Update Command
- Add/Remove/Change operations
- Status management
- Nameserver dan contact management

**DomainRenewRequest**
- Referensi: RFC 5731 Section 3.2.3 - Renew Command
- Current expiration date verification
- Period extension dengan proper units

**DomainTransferRequest**
- Referensi: RFC 5731 Section 3.2.4 - Transfer Command
- Support untuk semua transfer operations:
  - query: Query transfer status
  - request: Request transfer
  - cancel: Cancel pending transfer
  - approve: Approve transfer (gaining registrar)
  - reject: Reject transfer (losing registrar)

**DomainInfo**
- Referensi: RFC 5731 Section 3.1.2 - Info Response
- Complete domain status codes
- ROID (Repository Object Identifier)
- Creation, update, expiration dates
- Client identifiers (sponsoring, creating)

**NameServer**
- Support untuk hostObj (external nameservers)
- Support untuk hostAttr (glue records dengan IP addresses)

**IpAddress**
- IPv4 dan IPv6 support
- Type-safe IP version

**DomainContact**
- Type-safe contact types (admin, tech, billing)
- Contact identifier reference

#### Contact Types (`src/types/Contact.ts`)

**ContactCreateRequest**
- Referensi: RFC 5733 Section 3.2.1 - Create Command
- Postal info dengan loc/int types (RFC 5733 Section 2.2)
- Support untuk multiple postal info formats
- Phone format: +[country].[area][number] x[ext]
- Disclosure preferences untuk privacy

**ContactPostalInfo**
- Type-safe postal info types (loc = local, int = international)
- Street address (1-3 lines, max 255 chars each)
- Required city dan country code (ISO 3166-1)
- Optional state/province dan postal code

**ContactAddress**
- Structured address format
- ISO 3166-1 country codes
- Max length validations

**ContactDisclose**
- Referensi: RFC 5733 Section 2.9 - Data Collection Policy
- WHOIS/RDAP data disclosure control
- Flag: 0 = hide specified fields, 1 = show specified fields
- Granular control per field

**ContactUpdateRequest**
- Referensi: RFC 5733 Section 3.2.5 - Update Command
- Status management
- Postal info updates
- Contact details updates

**ContactTransferRequest**
- Referensi: RFC 5733 Section 3.2.4 - Transfer Command
- All transfer operations supported

#### Host Types (`src/types/Host.ts`)

**HostCreateRequest**
- Referensi: RFC 5732 Section 3.2.1 - Create Command
- Dua tipe hosts:
  - Subordinate hosts (glue records): MUST have IP addresses
  - External hosts: NO IP addresses
- IPv4 dan IPv6 support

**HostAddress**
- Referensi: RFC 5732 Section 2.2 - Host Address
- Dotted-decimal untuk IPv4
- Colon-hexadecimal untuk IPv6

**HostUpdateRequest**
- Referensi: RFC 5732 Section 3.2.5 - Update Command
- IP address management
- Host name changes (dengan restrictions)
- Status management

**HostInfo**
- Referensi: RFC 5732 Section 3.1.2 - Info Response
- 'linked' status indicates host digunakan sebagai nameserver
- Complete status codes
- Creation dan update tracking

### 2. EppClient dengan Dokumentasi Method Lengkap

#### Session Management

**login(newPassword?: string)**
- Referensi: RFC 5730 Section 2.9.1.1
- Establish EPP session
- Optional password change
- Success code: 1000
- Error code: 2200 (Authentication error)

**logout()**
- Referensi: RFC 5730 Section 2.9.1.2
- End EPP session
- Success code: 1500
- Server closes connection after logout

#### Contact Commands (RFC 5733)

**contactCheck(ids: string[])**
- Check availability dari contact IDs
- Support 1-20 IDs per request
- Success code: 1000

**contactInfo(id: string, authInfo?: string)**
- Retrieve contact details
- Optional authInfo untuk restricted data
- Success code: 1000
- Error code: 2303 (Object does not exist)

**contactCreate(data: ContactCreateRequest)**
- Provision new contact object
- ID MUST be unique
- Success code: 1000
- Error codes: 2302 (exists), 2306 (policy error)

**contactUpdate(data: ContactUpdateRequest)**
- Modify contact information
- Add/Remove/Change operations
- Success code: 1000
- Error codes: 2303 (not exist), 2304 (status prohibits)

**contactDelete(id: string)**
- Remove contact object
- MUST NOT be linked dengan objects lain
- Success code: 1000
- Error code: 2305 (association prohibits)

**contactTransfer(data: ContactTransferRequest)**
- Transfer operations
- Success codes: 1000, 1001 (pending)

#### Domain Commands (RFC 5731)

**domainCheck(domains: string[])**
- Check availability dari domain names
- Support 1-20 domains per request
- Success code: 1000

**domainInfo(domain: string, authInfo?: string)**
- Retrieve domain details
- Optional authInfo untuk restricted data
- Success code: 1000
- Error code: 2303 (not exist)

**domainCreate(data: DomainCreateRequest)**
- Register new domain
- MUST provide registrant, contacts, authInfo
- Optional nameservers
- Success code: 1000
- Error codes: 2302 (exists), 2303 (missing param), 2306 (policy error)

**domainUpdate(data: DomainUpdateRequest)**
- Modify domain information
- Nameserver management
- Contact management
- Status management
- Success code: 1000
- Error codes: 2303, 2304

**domainRenew(data: DomainRenewRequest)**
- Extend registration period
- MUST provide current expiration date
- Success code: 1000
- Error codes: 2303, 2304, 2306

**domainDelete(domain: string)**
- Remove domain
- May have grace period (registry-dependent)
- Success codes: 1000, 1001 (pending)
- Error codes: 2303, 2304

**domainTransfer(data: DomainTransferRequest)**
- Transfer operations
- Support: query, request, cancel, approve, reject
- Success codes: 1000, 1001 (pending)

#### Host Commands (RFC 5732)

**hostCheck(names: string[])**
- Check availability dari host names
- Success code: 1000

**hostInfo(name: string)**
- Retrieve host details
- Success code: 1000

**hostCreate(data: HostCreateRequest)**
- Create nameserver object
- IP addresses REQUIRED untuk subordinate hosts
- Success code: 1000

**hostUpdate(data: HostUpdateRequest)**
- Modify host information
- IP address management
- Name changes (dengan restrictions)
- Success code: 1000

**hostDelete(name: string)**
- Remove host object
- MUST NOT be linked dengan domains
- Success code: 1000
- Error code: 2305 (association prohibits)

#### Fee Extension (RFC 8748)

**feeCheck(data: FeeCheckRequest)**
- Query biaya operasi domain
- Support: create, renew, transfer, restore
- Currency dalam ISO 4217 format

### 3. Result Codes (RFC 5730 Section 3)

#### Success Codes (1xxx)
- **1000**: Command completed successfully
- **1001**: Command completed successfully; action pending
- **1300**: Command completed successfully; no messages
- **1301**: Command completed successfully; ack to dequeue
- **1500**: Command completed successfully; ending session

#### Command Error Codes (2xxx)
- **2000**: Unknown command
- **2001**: Command syntax error
- **2002**: Command use error
- **2003**: Required parameter missing
- **2004**: Parameter value range error
- **2005**: Parameter value syntax error

#### Protocol Error Codes (2xxx)
- **2100**: Unimplemented protocol version
- **2101**: Unimplemented command
- **2102**: Unimplemented option
- **2103**: Unimplemented extension
- **2104**: Billing failure
- **2105**: Object is not eligible for renewal
- **2106**: Object is not eligible for transfer

#### Implementation Error Codes (2xxx)
- **2200**: Authentication error
- **2201**: Authorization error
- **2202**: Invalid authorization information

#### Object Management Codes (23xx)
- **2300**: Object pending transfer
- **2301**: Object not pending transfer
- **2302**: Object exists
- **2303**: Object does not exist
- **2304**: Object status prohibits operation
- **2305**: Object association prohibits operation
- **2306**: Parameter value policy error
- **2307**: Unimplemented object service
- **2308**: Data management policy violation

## Best Practices

### 1. Session Management
```typescript
const client = new EppClient({
  server: 'https://epp.registry.example',
  username: 'client-id',
  password: 'password',
  timeout: 30000,
  debug: true // untuk development
});

try {
  // Login
  await client.login();
  
  // Perform operations
  await client.domainCheck(['example.com']);
  
  // Always logout
  await client.logout();
} catch (error) {
  if (error.code) {
    console.error(`EPP Error ${error.code}: ${error.message}`);
  }
}
```

### 2. Error Handling
```typescript
try {
  await client.domainCreate(data);
} catch (error) {
  switch (error.code) {
    case 2302:
      console.log('Domain already exists');
      break;
    case 2303:
      console.log('Required parameter missing');
      break;
    case 2306:
      console.log('Policy violation');
      break;
    default:
      console.error('Unexpected error:', error);
  }
}
```

### 3. Domain Registration Flow
```typescript
// 1. Check availability
const checkResult = await client.domainCheck(['example.com']);
if (!checkResult.data[0].available) {
  throw new Error('Domain not available');
}

// 2. Create contacts (jika belum ada)
await client.contactCreate({
  id: 'contact123',
  postalInfo: {
    type: 'int',
    name: 'John Doe',
    addr: {
      street: ['123 Example St'],
      city: 'Jakarta',
      cc: 'ID'
    }
  },
  email: 'john@example.com',
  authInfo: { pw: 'contact-password' }
});

// 3. Create nameservers (untuk subordinate hosts)
await client.hostCreate({
  name: 'ns1.example.com',
  addr: [
    { ip: '192.0.2.1', type: 'v4' }
  ]
});

// 4. Register domain
await client.domainCreate({
  name: 'example.com',
  period: { value: 1, unit: 'y' },
  registrant: 'contact123',
  contacts: [
    { type: 'admin', id: 'contact123' },
    { type: 'tech', id: 'contact123' }
  ],
  ns: {
    hostObj: ['ns1.example.com', 'ns2.example.com']
  },
  authInfo: { pw: 'domain-password' }
});
```

### 4. Domain Transfer Flow
```typescript
// Losing registrar: Prepare domain untuk transfer
// (Domain MUST NOT have clientTransferProhibited status)

// Gaining registrar: Request transfer
await client.domainTransfer({
  name: 'example.com',
  op: 'request',
  authInfo: { pw: 'auth-code-from-losing-registrar' },
  period: { value: 1, unit: 'y' } // optional renewal
});

// Query transfer status
const status = await client.domainTransfer({
  name: 'example.com',
  op: 'query'
});

// Losing registrar: Approve atau reject
await client.domainTransfer({
  name: 'example.com',
  op: 'approve' // atau 'reject'
});
```

### 5. Contact Privacy dengan Disclosure
```typescript
await client.contactCreate({
  id: 'private-contact',
  postalInfo: {
    type: 'int',
    name: 'John Doe',
    addr: { /* ... */ }
  },
  email: 'john@example.com',
  voice: '+1.5551234567',
  authInfo: { pw: 'password' },
  disclose: {
    flag: 0, // Hide specified fields
    name: { type: 'int' },
    addr: { type: 'int' },
    email: true,
    voice: true
  }
});
```

## Transport Considerations

### HTTP/HTTPS Transport (RFC 5734)
- Content-Type: `application/epp+xml`
- MUST use HTTPS dengan valid certificate
- Support untuk mutual TLS (client certificates)
- Session management via cookies atau custom headers

### TCP Transport (RFC 5734)
- Port 700 (standard EPP port)
- TLS encryption REQUIRED
- 4-byte header dengan frame length
- Persistent connection

## Security Considerations (RFC 5730 Section 8)

1. **Authentication**: Username/password MUST be encrypted in transit
2. **Authorization**: Proper access control untuk operations
3. **Data Privacy**: Contact disclosure preferences
4. **Transport Security**: TLS/HTTPS REQUIRED
5. **Password Storage**: Never store passwords in plain text
6. **Session Management**: Proper session timeout dan cleanup

## Compliance Checklist

- ✅ RFC 5730: EPP Core Protocol
- ✅ RFC 5731: Domain Name Mapping
- ✅ RFC 5732: Host Mapping
- ✅ RFC 5733: Contact Mapping
- ✅ RFC 5734: Transport Mapping (HTTPS)
- ✅ RFC 8748: Fee Extension
- ✅ Proper TypeScript typing
- ✅ Comprehensive documentation
- ✅ Error handling
- ✅ Example usage patterns

## Referensi

- [RFC 5730 - EPP](https://www.rfc-editor.org/rfc/rfc5730.html)
- [RFC 5731 - EPP Domain Mapping](https://www.rfc-editor.org/rfc/rfc5731.html)
- [RFC 5732 - EPP Host Mapping](https://www.rfc-editor.org/rfc/rfc5732.html)
- [RFC 5733 - EPP Contact Mapping](https://www.rfc-editor.org/rfc/rfc5733.html)
- [RFC 5734 - EPP TCP Transport](https://www.rfc-editor.org/rfc/rfc5734.html)
- [RFC 8748 - EPP Fee Extension](https://www.rfc-editor.org/rfc/rfc8748.html)

## Changelog

### Version 1.0.0 (December 2025)
- ✅ Complete RFC documentation untuk semua types
- ✅ Proper TypeScript interfaces dengan RFC references
- ✅ Enhanced error handling dengan detailed error codes
- ✅ Complete method documentation di EppClient
- ✅ Implementation semua EPP commands (create, update, delete, transfer)
- ✅ Support untuk Fee Extension (RFC 8748)
- ✅ Proper Period type dengan unit validation
- ✅ Contact disclosure preferences
- ✅ Transfer operations untuk domain dan contact
- ✅ Glue record support untuk subordinate hosts
- ✅ Multiple postal info support untuk contacts
