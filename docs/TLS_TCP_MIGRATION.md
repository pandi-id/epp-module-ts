# EPP Client TLS/TCP Transport Migration Guide

## Overview

EPP Client telah diupdate untuk menggunakan **TLS/TCP transport** sesuai RFC 5734 (EPP Transport over TCP), menggantikan HTTP/HTTPS transport yang sebelumnya.

## Mengapa TLS/TCP?

### RFC 5734 Specification

EPP protocol dirancang untuk menggunakan **TCP connection dengan TLS encryption**, bukan HTTP:

> "EPP is represented in XML 1.0, transported over TCP, and secured using Transport Layer Security (TLS) as described in RFC 2246 or its successors." - RFC 5734

### Keuntungan TLS/TCP vs HTTP/HTTPS:

1. **Sesuai Standard**: RFC 5734 mendefinisikan TCP sebagai transport layer untuk EPP
2. **Persistent Connection**: Connection tetap terbuka untuk multiple commands
3. **Lower Latency**: Tidak ada overhead HTTP headers
4. **Proper Framing**: 4-byte header untuk data framing (RFC 5734 Section 4)
5. **Better Performance**: Direct TCP connection tanpa HTTP intermediaries
6. **Registry Compatibility**: Semua EPP registries menggunakan TCP port 700

## Breaking Changes

### Sebelum (HTTP/HTTPS):

```typescript
const client = new EppClient({
  server: 'https://epp.registry.example',  // ❌ HTTP URL
  username: 'registrar-id',
  password: 'password'
});

// Auto-connect via HTTP
await client.login();
```

### Sesudah (TLS/TCP):

```typescript
const client = new EppClient({
  host: 'epp.registry.example',  // ✅ Hostname
  port: 700,                     // ✅ TCP port (default: 700)
  username: 'registrar-id',
  password: 'password'
});

// Explicit connect required
await client.connect();  // ✅ Establish TLS/TCP connection
await client.login();    // ✅ Authenticate

// Operations...

await client.logout();
await client.disconnect();  // ✅ Close connection
```

## Configuration Changes

### Old Configuration (HTTP):

```typescript
interface EppConfig {
  server: string;        // HTTP(S) URL
  username: string;
  password: string;
  lang?: string;
  version?: string;
  timeout?: number;
  debug?: boolean;
  clientCert?: string;   // Not properly used
  clientKey?: string;
}
```

### New Configuration (TLS/TCP):

```typescript
interface EppConfig {
  host: string;          // ✅ Hostname saja
  port?: number;         // ✅ TCP port (default: 700)
  username: string;
  password: string;
  lang?: string;
  version?: string;
  timeout?: number;
  debug?: boolean;
  
  // ✅ Proper mutual TLS support
  clientCert?: string | Buffer;
  clientKey?: string | Buffer;
  ca?: string | Buffer | Array<string | Buffer>;
  rejectUnauthorized?: boolean;  // ✅ Certificate validation
}
```

## Migration Steps

### Step 1: Update Configuration

**Sebelum:**
```typescript
const config = {
  server: 'https://epp.registry.example/epp',
  username: 'user',
  password: 'pass'
};
```

**Sesudah:**
```typescript
const config = {
  host: 'epp.registry.example',  // Remove https:// dan path
  port: 700,                      // Add port
  username: 'user',
  password: 'pass'
};
```

### Step 2: Add Explicit Connection Management

**Sebelum:**
```typescript
const client = new EppClient(config);
await client.login();  // Auto-connect
// ... operations
await client.logout();
```

**Sesudah:**
```typescript
const client = new EppClient(config);
await client.connect();  // ✅ Explicit connect
await client.login();
// ... operations
await client.logout();
await client.disconnect();  // ✅ Explicit disconnect
```

### Step 3: Update Error Handling

**Sebelum:**
```typescript
try {
  await client.login();
} catch (error) {
  // HTTP errors
  if (error.message.includes('Network Error')) {
    // Handle network error
  }
}
```

**Sesudah:**
```typescript
try {
  await client.connect();
  await client.login();
} catch (error) {
  // TCP/TLS errors
  if (error.message.includes('ECONNREFUSED')) {
    console.error('Server refused connection');
  } else if (error.message.includes('ETIMEDOUT')) {
    console.error('Connection timeout');
  } else if (error.message.includes('CERT_')) {
    console.error('Certificate validation failed');
  } else if (error.code === 2200) {
    console.error('Authentication failed');
  }
  
  // Cleanup
  if (client.isConnected()) {
    await client.disconnect();
  }
}
```

### Step 4: Implement Mutual TLS (Optional)

Jika registry Anda require client certificates:

```typescript
import * as fs from 'fs';

const client = new EppClient({
  host: 'epp.registry.example',
  port: 700,
  username: 'user',
  password: 'pass',
  
  // Mutual TLS
  clientCert: fs.readFileSync('./certs/client-cert.pem'),
  clientKey: fs.readFileSync('./certs/client-key.pem'),
  ca: fs.readFileSync('./certs/ca-cert.pem'),
  rejectUnauthorized: true  // Always true for production!
});
```

## Complete Example

### Basic Usage:

```typescript
import { EppClient } from 'epp-client';

async function exampleUsage() {
  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'password',
    timeout: 30000,
    debug: true
  });

  try {
    // Connect
    await client.connect();
    console.log('Connected via TLS/TCP');
    
    // Get server greeting
    const greeting = client.getGreeting();
    console.log('Server:', greeting.svID);
    
    // Login
    await client.login();
    console.log('Authenticated');
    
    // Check domains
    const result = await client.domainCheck(['example.com']);
    console.log('Available:', result.data[0].available);
    
    // Logout
    await client.logout();
    console.log('Logged out');
    
    // Disconnect
    await client.disconnect();
    console.log('Disconnected');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Always cleanup
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

exampleUsage();
```

### With Mutual TLS:

```typescript
import { EppClient } from 'epp-client';
import * as fs from 'fs';

const client = new EppClient({
  host: 'epp.registry.example',
  port: 700,
  username: 'registrar-id',
  password: 'password',
  
  // Client certificates
  clientCert: fs.readFileSync('/path/to/client-cert.pem'),
  clientKey: fs.readFileSync('/path/to/client-key.pem'),
  ca: fs.readFileSync('/path/to/ca-cert.pem'),
  
  rejectUnauthorized: true,
  debug: true
});

try {
  await client.connect();
  
  // Check connection info
  const connInfo = client.getConnectionInfo();
  console.log('TLS Protocol:', connInfo?.protocol);
  console.log('Cipher:', connInfo?.cipher?.name);
  
  await client.login();
  // ... operations
  await client.logout();
  await client.disconnect();
  
} catch (error) {
  console.error('Mutual TLS failed:', error.message);
  if (client.isConnected()) {
    await client.disconnect();
  }
}
```

## Technical Details

### EPP Frame Format (RFC 5734 Section 4)

EPP menggunakan frame-based protocol:

```
+----------------------------------+
| 4-byte header (big-endian)       |  = Total frame size (including header)
+----------------------------------+
| XML data (UTF-8 encoded)         |
+----------------------------------+
```

**Example:**
- XML size: 256 bytes
- Header value: 260 (256 + 4)
- Frame total: 260 bytes

### Connection Flow

1. **TCP Connection**: Client connects ke server:port
2. **TLS Handshake**: Negotiate TLS encryption
3. **Server Greeting**: Server sends greeting message
4. **Login**: Client authenticates
5. **Operations**: Execute EPP commands
6. **Logout**: End session
7. **Disconnect**: Close TCP connection

### Port Configuration

- **Standard Port**: 700 (RFC 5734 Section 3)
- **Alternative**: Beberapa registries use custom ports
- **Always check** dengan registry documentation

### TLS Requirements

- **Minimum Version**: TLS 1.2 (enforced)
- **Recommended**: TLS 1.3
- **Certificate Validation**: Always enabled (production)
- **Mutual TLS**: Optional (registry-dependent)

## Testing

### Test dengan Self-Signed Certificate (Development Only):

```typescript
const client = new EppClient({
  host: 'localhost',
  port: 700,
  username: 'test',
  password: 'test',
  rejectUnauthorized: false,  // ⚠️ ONLY for testing!
  debug: true
});
```

**⚠️ WARNING:** NEVER use `rejectUnauthorized: false` in production!

### Connection Testing:

```bash
# Test TCP connection
telnet epp.registry.example 700

# Test TLS handshake
openssl s_client -connect epp.registry.example:700

# Test dengan client certificate
openssl s_client -connect epp.registry.example:700 \
  -cert client-cert.pem \
  -key client-key.pem \
  -CAfile ca-cert.pem
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED
```

**Solutions:**
- Check server hostname dan port
- Verify firewall rules
- Confirm server is running

### Timeout

```
Error: connect ETIMEDOUT
```

**Solutions:**
- Check network connectivity
- Verify firewall tidak blocking port 700
- Increase timeout value

### Certificate Errors

```
Error: CERT_HAS_EXPIRED
Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

**Solutions:**
- Check server certificate validity
- Verify CA certificate is correct
- For testing only: set `rejectUnauthorized: false`

### Authentication Failed

```
EPP Error 2200: Authentication error
```

**Solutions:**
- Verify username dan password
- Check credentials dengan registry
- Ensure account is active

## Benefits Summary

### For Developers:
- ✅ Standard-compliant implementation (RFC 5734)
- ✅ Better debugging dengan frame-level visibility
- ✅ Proper connection state management
- ✅ Mutual TLS support untuk enhanced security

### For Operations:
- ✅ Lower latency (no HTTP overhead)
- ✅ Better performance (persistent connections)
- ✅ Easier monitoring (TCP metrics)
- ✅ Compatible dengan all EPP registries

### For Security:
- ✅ TLS 1.2+ encryption enforced
- ✅ Certificate validation by default
- ✅ Mutual TLS authentication support
- ✅ No HTTP intermediaries

## References

- [RFC 5730](https://www.rfc-editor.org/rfc/rfc5730.html) - EPP Core Protocol
- [RFC 5734](https://www.rfc-editor.org/rfc/rfc5734.html) - EPP Transport over TCP
- [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html) - TLS 1.3
- [RFC 5246](https://www.rfc-editor.org/rfc/rfc5246.html) - TLS 1.2

## Support

Jika Anda mengalami masalah dengan migration:

1. Check [examples/tls-tcp-connection.ts](./examples/tls-tcp-connection.ts)
2. Review [RFC_DOCUMENTATION.md](./RFC_DOCUMENTATION.md)
3. Test connection dengan `openssl s_client`
4. Enable debug mode untuk detailed logging
5. Contact registry support untuk server configuration

---

**Migration completed!** 🎉

EPP Client sekarang fully compliant dengan RFC 5734 dan menggunakan proper TLS/TCP transport.
