/**
 * EPP Client dengan TLS/TCP Connection Example
 * 
 * Demonstrasi koneksi EPP menggunakan TLS/TCP sesuai RFC 5734
 * bukan HTTP/HTTPS.
 * 
 * Referensi: RFC 5734 - EPP Transport over TCP
 */

import { EppClient } from '../src/index';
import * as fs from 'fs';

/**
 * Basic TLS/TCP Connection
 * 
 * EPP standard menggunakan TCP port 700 dengan TLS encryption.
 * Connection adalah persistent dan stateful.
 */
async function basicTlsConnection() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     EPP TLS/TCP CONNECTION EXAMPLE (RFC 5734)          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Initialize client dengan TLS/TCP configuration
  const client = new EppClient({
    host: 'epp.registry.example',  // EPP server hostname
    port: 700,                      // Standard EPP port (RFC 5734 Section 3)
    username: 'registrar-id',
    password: 'password',
    timeout: 30000,
    rejectUnauthorized: true,       // Validate server certificate
    debug: true                     // Enable debug untuk melihat TLS handshake
  });

  try {
    // ========================================================================
    // STEP 1: CONNECT ke EPP server
    // Referensi: RFC 5734 Section 2 - Connection Management
    // ========================================================================
    console.log('📝 Step 1: Establishing TLS/TCP connection...');
    await client.connect();
    console.log('✅ Connected to EPP server');

    // Display connection info
    const connInfo = client.getConnectionInfo();
    if (connInfo) {
      console.log('\n🔒 TLS Connection Information:');
      console.log(`   Protocol: ${connInfo.protocol}`);
      console.log(`   Cipher: ${connInfo.cipher?.name}`);
      console.log(`   Version: ${connInfo.cipher?.version}`);
    }

    // Display greeting
    const greeting = client.getGreeting();
    if (greeting) {
      console.log('\n📨 Server Greeting:');
      console.log(`   Server ID: ${greeting.svID}`);
      console.log(`   Server Date: ${greeting.svDate}`);
      console.log(`   Protocol Version: ${greeting.svcMenu?.version || 'N/A'}`);
      console.log(`   Languages: ${greeting.svcMenu?.lang?.join(', ') || 'N/A'}`);
    }

    // ========================================================================
    // STEP 2: LOGIN
    // Referensi: RFC 5730 Section 2.9.1.1 - <login> Command
    // ========================================================================
    console.log('\n📝 Step 2: Authenticating...');
    const loginResult = await client.login();
    console.log(`✅ Login successful - Code: ${loginResult.code}`);
    console.log(`   Message: ${loginResult.message}`);
    console.log(`   Server Transaction ID: ${loginResult.svTRID}`);

    // ========================================================================
    // STEP 3: PERFORM OPERATIONS
    // ========================================================================
    console.log('\n📝 Step 3: Checking domain availability...');
    const checkResult = await client.domainCheck(['example.com', 'example.net']);
    console.log('✅ Domain check completed:');
    checkResult.data.forEach((domain: any) => {
      const status = domain.available ? '✅ Available' : '❌ Not available';
      console.log(`   ${domain.name}: ${status}`);
    });

    // ========================================================================
    // STEP 4: LOGOUT
    // Referensi: RFC 5730 Section 2.9.1.2 - <logout> Command
    // ========================================================================
    console.log('\n📝 Step 4: Logging out...');
    const logoutResult = await client.logout();
    console.log(`✅ Logout successful - Code: ${logoutResult.code}`);

    // ========================================================================
    // STEP 5: DISCONNECT
    // Referensi: RFC 5734 Section 2 - Connection Management
    // ========================================================================
    console.log('\n📝 Step 5: Closing connection...');
    await client.disconnect();
    console.log('✅ Disconnected from EPP server');

    console.log('\n🎉 Complete TLS/TCP flow finished successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    console.error(`   ${error.message}`);
    
    if (error.code) {
      console.error(`   EPP Error Code: ${error.code}`);
    }

    // Always try to disconnect
    if (client.isConnected()) {
      await client.disconnect();
      console.log('✅ Cleanup: Disconnected');
    }
  }
}

/**
 * Mutual TLS Authentication
 * 
 * Beberapa registries require client certificate authentication
 * untuk additional security.
 * 
 * Referensi: RFC 5734 Section 5 - Security Considerations
 */
async function mutualTlsConnection() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       MUTUAL TLS AUTHENTICATION EXAMPLE                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Load client certificates
  // NOTE: Update paths sesuai dengan lokasi certificates Anda
  const clientCert = fs.readFileSync('/path/to/client-cert.pem');
  const clientKey = fs.readFileSync('/path/to/client-key.pem');
  const ca = fs.readFileSync('/path/to/ca-cert.pem');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'password',
    // Mutual TLS configuration
    clientCert: clientCert,
    clientKey: clientKey,
    ca: ca,
    rejectUnauthorized: true,
    debug: true
  });

  try {
    console.log('📝 Establishing mutual TLS connection...');
    await client.connect();
    console.log('✅ Mutual TLS connection established');

    const connInfo = client.getConnectionInfo();
    console.log('\n🔒 Mutual TLS Information:');
    console.log(`   Client authenticated: Yes`);
    console.log(`   Protocol: ${connInfo?.protocol}`);
    console.log(`   Cipher: ${connInfo?.cipher?.name}`);

    // Perform operations...
    await client.login();
    console.log('✅ Authenticated with mutual TLS');

    await client.logout();
    await client.disconnect();
    console.log('✅ Session closed\n');

  } catch (error: any) {
    console.error('\n❌ Mutual TLS failed:', error.message);
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Connection with Self-Signed Certificate (Testing Only)
 * 
 * PERINGATAN: Hanya untuk testing environment!
 * NEVER use rejectUnauthorized: false di production.
 */
async function testingWithSelfSigned() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║    SELF-SIGNED CERTIFICATE (TESTING ONLY)             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  WARNING: This configuration is ONLY for testing!');
  console.log('⚠️  NEVER use in production environment!\n');

  const client = new EppClient({
    host: 'epp-test.registry.example',
    port: 700,
    username: 'test-user',
    password: 'test-password',
    rejectUnauthorized: false,  // ⚠️ DANGEROUS: Skip certificate validation
    debug: true
  });

  try {
    console.log('📝 Connecting to test server (accepting self-signed cert)...');
    await client.connect();
    console.log('✅ Connected (INSECURE MODE)');

    await client.login();
    console.log('✅ Logged in');

    // Test operations...
    const result = await client.domainCheck(['test.com']);
    console.log('✅ Test operation successful');

    await client.logout();
    await client.disconnect();
    console.log('✅ Test session closed\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Connection Error Handling
 */
async function connectionErrorHandling() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         CONNECTION ERROR HANDLING EXAMPLE              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'password',
    timeout: 10000,  // 10 second timeout
    debug: false
  });

  try {
    console.log('📝 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected');

    console.log('📝 Attempting to login...');
    await client.login();
    console.log('✅ Logged in');

  } catch (error: any) {
    console.error('\n❌ Connection/Authentication Failed:');

    // Handle different error types
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   → Server refused connection');
      console.error('   → Check if server is running dan port is correct');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('   → Connection timeout');
      console.error('   → Check network connectivity dan firewall');
    } else if (error.message.includes('CERT_')) {
      console.error('   → Certificate validation failed');
      console.error('   → Check server certificate validity');
    } else if (error.code === 2200) {
      console.error('   → Authentication failed');
      console.error('   → Check username dan password');
    } else {
      console.error(`   → ${error.message}`);
    }

    // Cleanup
    if (client.isConnected()) {
      try {
        await client.disconnect();
        console.log('✅ Cleaned up connection');
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup connection');
      }
    }
  }
}

/**
 * Best Practices untuk TLS/TCP Connection
 */
function printBestPractices() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       TLS/TCP CONNECTION BEST PRACTICES                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('📌 SECURITY:\n');
  console.log('   1. ALWAYS validate server certificates (rejectUnauthorized: true)');
  console.log('   2. Use TLS 1.2 or higher (enforced by default)');
  console.log('   3. Store certificates securely (use environment variables)');
  console.log('   4. Rotate client certificates regularly');
  console.log('   5. Use strong passwords dan store encrypted\n');

  console.log('📌 CONNECTION MANAGEMENT:\n');
  console.log('   1. Always call connect() before login()');
  console.log('   2. Always call logout() before disconnect()');
  console.log('   3. Implement proper error handling');
  console.log('   4. Set reasonable timeout (30 seconds recommended)');
  console.log('   5. Handle connection drops gracefully\n');

  console.log('📌 EPP PROTOCOL:\n');
  console.log('   1. Wait for greeting setelah connect');
  console.log('   2. Send login command sebelum operations lain');
  console.log('   3. Process responses sequentially (EPP is synchronous)');
  console.log('   4. Handle all result codes properly');
  console.log('   5. Monitor transaction IDs untuk debugging\n');

  console.log('📌 PRODUCTION DEPLOYMENT:\n');
  console.log('   1. Use connection pooling untuk multiple operations');
  console.log('   2. Implement automatic reconnection');
  console.log('   3. Log all transactions untuk audit');
  console.log('   4. Monitor connection health');
  console.log('   5. Have fallback servers configured\n');

  console.log('📌 RFC COMPLIANCE:\n');
  console.log('   - RFC 5730: EPP Core Protocol');
  console.log('   - RFC 5734: EPP Transport over TCP');
  console.log('   - RFC 5246: TLS 1.2 (minimum)');
  console.log('   - RFC 8446: TLS 1.3 (recommended)\n');
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  EPP CLIENT - TLS/TCP TRANSPORT EXAMPLES');
  console.log('  RFC 5734 - EPP Transport over TCP');
  console.log('='.repeat(60));

  // Print best practices first
  printBestPractices();

  // Run examples
  try {
    // Basic connection
    await basicTlsConnection();

    // Uncomment untuk try other examples:
    // await mutualTlsConnection();
    // await testingWithSelfSigned();
    // await connectionErrorHandling();

  } catch (error) {
    console.error('Fatal error in main:', error);
  }
}

// Run jika executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ All examples completed\n');
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export {
  basicTlsConnection,
  mutualTlsConnection,
  testingWithSelfSigned,
  connectionErrorHandling,
  printBestPractices
};
