# EPP Client Examples

Direktori ini berisi berbagai contoh penggunaan EPP Client TypeScript yang lengkap dan siap digunakan.

## 📋 Daftar Examples

### 1. Basic Usage (`basic-usage.ts`)
Demonstrasi operasi EPP dasar:
- Login dan logout
- Domain check
- Contact check dan create
- Domain create
- Fee check

**Menjalankan:**
```bash
npm run example:basic
# atau
ts-node examples/basic-usage.ts
```

### 2. TLS/TCP Connection (`tls-tcp-connection.ts`)
Demonstrasi koneksi TLS/TCP sesuai RFC 5734:
- Basic TLS connection
- Mutual TLS authentication
- Self-signed certificate handling (testing)
- Connection error handling
- Best practices

**Menjalankan:**
```bash
npm run example:tls
# atau
ts-node examples/tls-tcp-connection.ts
```

### 3. SSL Configurations (`ssl-configurations.ts`)
Berbagai contoh konfigurasi SSL/TLS:
- Basic TLS (production)
- Mutual TLS dengan client certificates
- Encrypted key dengan passphrase
- Custom cipher suites
- SNI (Server Name Indication)
- Testing dengan self-signed certificates
- Complete error handling example

**Menjalankan:**
```bash
npm run example:ssl
# atau
ts-node examples/ssl-configurations.ts
```

### 4. Complete Domain Registration (`complete-domain-registration.ts`)
Flow lengkap registrasi domain:
- Check domain availability
- Fee check (optional)
- Create registrant contact
- Create admin contact
- Create tech contact
- Create nameservers (glue records)
- Register domain
- Verify domain info
- Update domain status

**Menjalankan:**
```bash
npm run example:domain
# atau
ts-node examples/complete-domain-registration.ts
```

### 5. Domain Transfer (`domain-transfer.ts`)
Proses domain transfer operations:
- Gaining registrar: request transfer
- Gaining registrar: query transfer status
- Gaining registrar: cancel transfer
- Losing registrar: approve transfer
- Losing registrar: reject transfer
- Complete transfer flow scenarios

**Menjalankan:**
```bash
npm run example:transfer
# atau
ts-node examples/domain-transfer.ts
```

### 6. NextJS API Route (`nextjs-api-route.ts`)
Contoh integrasi dengan Next.js API routes:
- Domain check endpoint
- Contact create endpoint
- Error handling dalam API context

**Implementasi:**
Copy kode ke Next.js project Anda di `app/api/` folder.

## 🚀 Menjalankan Examples

### Menjalankan Satu Example
```bash
# Pilih salah satu
npm run example:basic
npm run example:tls
npm run example:ssl
npm run example:domain
npm run example:transfer
```

### Menjalankan Semua Examples
```bash
# Menjalankan basic, tls, dan ssl examples
npm run example:all

# Atau gunakan script helper
ts-node examples/run-all-examples.ts
```

## ⚙️ Konfigurasi

Sebelum menjalankan examples, pastikan Anda sudah:

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Project
```bash
npm run build
```

### 3. Konfigurasi EPP Server
Edit file example yang ingin Anda jalankan dan update konfigurasi:

```typescript
const client = new EppClient({
  host: 'epp.your-registry.com',  // Ganti dengan EPP server Anda
  port: 700,                        // Default EPP port
  username: 'your-username',        // Credentials Anda
  password: 'your-password',
  
  // SSL/TLS Configuration
  rejectUnauthorized: true,         // Set false untuk testing
  minVersion: 'TLSv1.2',
  
  // Optional: Client certificates untuk mutual TLS
  clientCert: fs.readFileSync('./certs/client-cert.pem'),
  clientKey: fs.readFileSync('./certs/client-key.pem'),
  ca: fs.readFileSync('./certs/ca-bundle.pem'),
  
  debug: true                       // Enable debug logging
});
```

## 🔒 SSL/TLS Configuration

### Production Environment
```typescript
{
  host: 'epp.registry.com',
  port: 700,
  rejectUnauthorized: true,    // MUST be true!
  minVersion: 'TLSv1.2',       // Minimum TLS 1.2
  maxVersion: 'TLSv1.3',       // Prefer TLS 1.3
  clientCert: cert,            // Client certificate
  clientKey: key,              // Client key
  ca: caBundle                 // CA bundle
}
```

### Testing Environment
```typescript
{
  host: 'epp-test.registry.com',
  port: 700,
  rejectUnauthorized: false,   // ⚠️ Only for testing!
  debug: true
}
```

## 📝 Notes

### Expected Behavior
- Kebanyakan examples akan **gagal** jika tidak ada EPP server yang aktual
- Examples ini untuk menunjukkan **correct usage patterns**
- Adapt sesuai dengan requirement registry Anda

### Connection Errors
Jika Anda mendapat error seperti:
- `ECONNREFUSED`: EPP server tidak running
- `ETIMEDOUT`: Network connectivity issues
- `DEPTH_ZERO_SELF_SIGNED_CERT`: Self-signed certificate (set `rejectUnauthorized: false` untuk testing)
- `CERT_HAS_EXPIRED`: Server certificate expired
- `ERR_TLS_CERT_ALTNAME_INVALID`: Certificate hostname mismatch

### Debugging
Enable debug mode untuk melihat detail komunikasi:
```typescript
const client = new EppClient({
  // ... other config
  debug: true  // Shows connection details, TLS info, XML requests/responses
});
```

## 🔗 References

- **RFC 5730**: Extensible Provisioning Protocol (EPP)
- **RFC 5731**: EPP Domain Name Mapping
- **RFC 5732**: EPP Host Mapping
- **RFC 5733**: EPP Contact Mapping
- **RFC 5734**: EPP Transport over TCP
- **RFC 8748**: EPP Fee Extension

## 📚 Additional Resources

### EPP Documentation
- [Main Documentation](../README.md)
- [TLS/TCP Implementation](../docs/TLS_TCP_IMPLEMENTATION.md)
- [RFC Documentation](../docs/RFC_DOCUMENTATION.md)

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Building
```bash
# Build TypeScript to JavaScript
npm run build

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## ❓ Need Help?

Jika Anda mengalami masalah atau punya pertanyaan:
1. Check dokumentasi di `/docs` folder
2. Review examples untuk usage patterns
3. Enable debug mode untuk troubleshooting
4. Consult RFC specifications untuk protocol details

## 📄 License

MIT License - see LICENSE file for details
