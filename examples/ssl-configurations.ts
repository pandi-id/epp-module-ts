/**
 * SSL/TLS Configuration Examples
 * 
 * Berbagai contoh konfigurasi SSL/TLS untuk EPP Client
 * sesuai RFC 5734 Section 5 - Security Considerations
 */

import { EppClient } from '../src/index';
import * as fs from 'fs';

/**
 * 1. Basic TLS Connection (Production)
 * 
 * Konfigurasi dasar untuk production dengan validasi certificate.
 * Ini adalah konfigurasi paling aman dan HARUS digunakan di production.
 */
export async function basicTlsProduction() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       BASIC TLS CONNECTION (PRODUCTION)                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // SSL/TLS Configuration
    rejectUnauthorized: true, // MUST be true in production!
    minVersion: 'TLSv1.2',     // Minimum TLS 1.2
    maxVersion: 'TLSv1.3',     // Prefer TLS 1.3
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected with secure TLS');
    
    const connInfo = client.getConnectionInfo();
    console.log(`   Protocol: ${connInfo?.protocol}`);
    console.log(`   Cipher: ${connInfo?.cipher?.name}\n`);
    
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
  }
}

/**
 * 2. Mutual TLS (Client Certificate Authentication)
 * 
 * Untuk registries yang require client certificate authentication.
 * Memberikan security layer tambahan.
 */
export async function mutualTlsAuthentication() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       MUTUAL TLS AUTHENTICATION                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Load certificates
  // NOTE: Update paths dengan lokasi certificates Anda
  const clientCert = fs.readFileSync('./certs/client-cert.pem');
  const clientKey = fs.readFileSync('./certs/client-key.pem');
  const ca = fs.readFileSync('./certs/ca-bundle.pem');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // Mutual TLS Configuration
    clientCert: clientCert,
    clientKey: clientKey,
    ca: ca,
    rejectUnauthorized: true,
    
    // TLS version
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected with mutual TLS authentication');
    
    const connInfo = client.getConnectionInfo();
    console.log(`   Client authenticated: Yes`);
    console.log(`   Protocol: ${connInfo?.protocol}`);
    console.log(`   Cipher: ${connInfo?.cipher?.name}\n`);
    
    await client.login();
    console.log('✅ Logged in successfully\n');
    
    await client.logout();
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 3. Encrypted Client Key with Passphrase
 * 
 * Jika client key Anda encrypted dengan passphrase.
 */
export async function encryptedKeyWithPassphrase() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       ENCRYPTED CLIENT KEY WITH PASSPHRASE               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const clientCert = fs.readFileSync('./certs/client-cert.pem');
  const clientKey = fs.readFileSync('./certs/encrypted-client-key.pem');
  const ca = fs.readFileSync('./certs/ca-bundle.pem');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // Encrypted key configuration
    clientCert: clientCert,
    clientKey: clientKey,
    passphrase: 'your-key-passphrase', // Passphrase untuk decrypt key
    ca: ca,
    rejectUnauthorized: true,
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected with encrypted client key\n');
    
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 4. Custom Cipher Suites
 * 
 * Untuk specify cipher suites yang diperbolehkan.
 * Berguna untuk compliance requirements.
 */
export async function customCipherSuites() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       CUSTOM CIPHER SUITES                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // Custom cipher configuration
    // Only allow strong ciphers
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_AES_128_GCM_SHA256',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256'
    ].join(':'),
    
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected with custom cipher suites');
    
    const connInfo = client.getConnectionInfo();
    console.log(`   Cipher used: ${connInfo?.cipher?.name}`);
    console.log(`   Cipher version: ${connInfo?.cipher?.version}\n`);
    
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 5. SNI (Server Name Indication) Configuration
 * 
 * Untuk servers yang host multiple domains.
 */
export async function sniConfiguration() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       SNI (SERVER NAME INDICATION)                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new EppClient({
    host: '192.168.1.100', // IP address
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // SNI configuration
    servername: 'epp.registry.example', // Actual hostname for SNI
    rejectUnauthorized: true,
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected with SNI support\n');
    
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 6. Testing Environment (Self-Signed Certificate)
 * 
 * ⚠️ WARNING: HANYA UNTUK TESTING!
 * JANGAN GUNAKAN DI PRODUCTION!
 */
export async function testingWithSelfSigned() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       TESTING WITH SELF-SIGNED CERTIFICATE               ║');
  console.log('║       ⚠️  FOR TESTING ONLY - NOT PRODUCTION!            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  WARNING: Certificate validation disabled!');
  console.log('⚠️  This is INSECURE and should ONLY be used for testing!\n');

  const client = new EppClient({
    host: 'epp-test.registry.example',
    port: 700,
    username: 'test-user',
    password: 'test-password',
    
    // ⚠️ DANGEROUS: Skip certificate validation
    rejectUnauthorized: false,
    checkServerIdentity: false,
    
    timeout: 30000,
    debug: true
  });

  try {
    await client.connect();
    console.log('✅ Connected (INSECURE MODE)\n');
    
    await client.disconnect();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * 7. Complete Example with Error Handling
 */
export async function completeExampleWithErrorHandling() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       COMPLETE EXAMPLE WITH ERROR HANDLING               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'secure-password',
    
    // Production SSL configuration
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    
    timeout: 30000,
    debug: false // Disable debug in production
  });

  try {
    // Connect
    console.log('📝 Step 1: Connecting...');
    await client.connect();
    console.log('✅ Connected\n');
    
    // Login
    console.log('📝 Step 2: Logging in...');
    const loginResult = await client.login();
    console.log(`✅ Logged in - Code: ${loginResult.code}\n`);
    
    // Perform operations
    console.log('📝 Step 3: Checking domains...');
    const checkResult = await client.domainCheck(['example.com', 'test.com']);
    console.log('✅ Domain check completed:');
    checkResult.data.forEach((domain: any) => {
      console.log(`   ${domain.name}: ${domain.available ? 'Available' : 'Not available'}`);
    });
    console.log();
    
    // Logout
    console.log('📝 Step 4: Logging out...');
    await client.logout();
    console.log('✅ Logged out\n');
    
    // Disconnect
    console.log('📝 Step 5: Disconnecting...');
    await client.disconnect();
    console.log('✅ Disconnected\n');
    
    console.log('🎉 All operations completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    
    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Connection refused. Check if server is running.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   → Connection timeout. Check network connectivity.');
    } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      console.error('   → Self-signed certificate. Use rejectUnauthorized: false for testing only!');
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      console.error('   → Server certificate has expired.');
    } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      console.error('   → Certificate hostname mismatch.');
    } else {
      console.error(`   → ${error.message}`);
    }
    
    // Always cleanup
    if (client.isConnected()) {
      try {
        await client.disconnect();
        console.log('\n✅ Connection cleaned up');
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup connection');
      }
    }
  }
}

/**
 * SSL/TLS Best Practices
 */
export function printSSLBestPractices() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       SSL/TLS CONFIGURATION BEST PRACTICES               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📌 CERTIFICATE VALIDATION:\n');
  console.log('   ✓ ALWAYS set rejectUnauthorized: true in production');
  console.log('   ✓ Use valid, trusted CA-signed certificates');
  console.log('   ✓ Keep certificates up to date (monitor expiry)');
  console.log('   ✓ Verify certificate hostname matches server');
  console.log('   ✗ NEVER disable validation in production\n');

  console.log('📌 TLS VERSIONS:\n');
  console.log('   ✓ Use TLS 1.2 or higher (minVersion: "TLSv1.2")');
  console.log('   ✓ Prefer TLS 1.3 when available (maxVersion: "TLSv1.3")');
  console.log('   ✗ NEVER use TLS 1.0 or 1.1 (deprecated and insecure)\n');

  console.log('📌 CIPHER SUITES:\n');
  console.log('   ✓ Use strong, modern ciphers (AES-GCM, ChaCha20)');
  console.log('   ✓ Prioritize AEAD ciphers');
  console.log('   ✗ Avoid weak ciphers (RC4, DES, 3DES)');
  console.log('   ✗ Avoid export-grade ciphers\n');

  console.log('📌 MUTUAL TLS:\n');
  console.log('   ✓ Use client certificates for additional security');
  console.log('   ✓ Store private keys securely (encrypted)');
  console.log('   ✓ Use strong passphrases for encrypted keys');
  console.log('   ✓ Rotate certificates regularly\n');

  console.log('📌 KEY MANAGEMENT:\n');
  console.log('   ✓ Store keys in secure location (not in code)');
  console.log('   ✓ Use environment variables or secure key stores');
  console.log('   ✓ Encrypt keys at rest');
  console.log('   ✓ Use HSM for production environments');
  console.log('   ✗ NEVER commit keys to version control\n');

  console.log('📌 TESTING VS PRODUCTION:\n');
  console.log('   Testing:');
  console.log('   - Can use self-signed certificates');
  console.log('   - Can disable rejectUnauthorized (temporarily)');
  console.log('   - Should still test with valid certificates\n');
  console.log('   Production:');
  console.log('   - MUST use valid, CA-signed certificates');
  console.log('   - MUST enable certificate validation');
  console.log('   - MUST use TLS 1.2 or higher');
  console.log('   - MUST monitor certificate expiry\n');

  console.log('📌 COMPLIANCE:\n');
  console.log('   - PCI DSS: Requires TLS 1.2+ with strong ciphers');
  console.log('   - HIPAA: Requires encryption in transit');
  console.log('   - GDPR: Requires appropriate security measures');
  console.log('   - RFC 5734: EPP-specific security requirements\n');
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(62));
  console.log('  EPP CLIENT - SSL/TLS CONFIGURATION EXAMPLES');
  console.log('  Comprehensive Security Configuration Guide');
  console.log('='.repeat(62));

  // Print best practices first
  printSSLBestPractices();

  // Run examples (uncomment to try)
  try {
    // await basicTlsProduction();
    // await mutualTlsAuthentication();
    // await encryptedKeyWithPassphrase();
    // await customCipherSuites();
    // await sniConfiguration();
    // await testingWithSelfSigned();
    await completeExampleWithErrorHandling();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ SSL/TLS examples completed\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}
