/**
 * Domain Transfer Example
 * 
 * Demonstrasi lengkap proses domain transfer menggunakan EPP Client
 * Referensi: RFC 5731 Section 3.2.4 - EPP <transfer> Command
 */

import { EppClient } from '../src/index';
import { DomainTransferRequest } from '../src/types';

/**
 * GAINING REGISTRAR: Request domain transfer
 * 
 * Referensi: RFC 5731 Section 3.2.4
 * - Transfer request initiates transfer proses
 * - Requires authorization code dari losing registrar
 * - Optional renewal period
 */
async function gainingRegistrarRequestTransfer() {
  const client = new EppClient({
    host: 'epp.gaining-registrar.example', port: 700,
    username: 'gaining-registrar-id',
    password: 'password',
    debug: true
  });

  try {
    console.log('\n=== GAINING REGISTRAR: REQUEST TRANSFER ===\n');

    // Login
    await client.login();
    console.log('✅ Logged in as gaining registrar');

    // Domain yang akan ditransfer
    const domainName = 'example.com';
    
    // Authorization code dari losing registrar
    // Referensi: RFC 5731 Section 2.2 - Authorization Information
    const authCode = 'auth-code-from-losing-registrar-2024';

    // Request transfer
    // Referensi: RFC 5731 Section 3.2.4.1
    const transferRequest: DomainTransferRequest = {
      name: domainName,
      op: 'request', // Initiate transfer
      authInfo: {
        pw: authCode
      },
      // Optional: Add renewal period
      // Some registries require renewal on transfer
      period: {
        value: 1,
        unit: 'y'
      }
    };

    const result = await client.domainTransfer(transferRequest);
    
    console.log('✅ Transfer requested successfully!');
    console.log(`   Domain: ${domainName}`);
    console.log(`   Status: ${result.code === 1001 ? 'Pending' : 'Completed'}`);
    console.log(`   Transaction ID: ${result.svTRID}`);
    
    if (result.data) {
      console.log('\n   Transfer Details:');
      console.log(`   - Transfer Status: ${result.data.trStatus}`);
      console.log(`   - Request Date: ${result.data.reDate}`);
      console.log(`   - Request Client: ${result.data.reID}`);
      if (result.data.acDate) {
        console.log(`   - Action Date: ${result.data.acDate}`);
      }
    }

    // Logout
    await client.logout();
    console.log('\n✅ Logged out');

  } catch (error: any) {
    console.error('\n❌ Transfer request failed:', error.message);
    if (error.code === 2202) {
      console.error('   → Invalid authorization code');
    } else if (error.code === 2304) {
      console.error('   → Domain status prohibits transfer');
      console.error('   → Check: clientTransferProhibited, serverTransferProhibited');
    }
  }
}

/**
 * GAINING REGISTRAR: Query transfer status
 * 
 * Referensi: RFC 5731 Section 3.2.4.2
 */
async function gainingRegistrarQueryTransfer() {
  const client = new EppClient({
    host: 'epp.gaining-registrar.example', port: 700,
    username: 'gaining-registrar-id',
    password: 'password'
  });

  try {
    console.log('\n=== GAINING REGISTRAR: QUERY TRANSFER STATUS ===\n');

    await client.login();
    console.log('✅ Logged in');

    const domainName = 'example.com';

    // Query transfer status
    const queryRequest: DomainTransferRequest = {
      name: domainName,
      op: 'query' // Query current transfer status
    };

    const result = await client.domainTransfer(queryRequest);
    
    console.log('✅ Transfer status retrieved:');
    console.log(`   Domain: ${domainName}`);
    
    if (result.data) {
      console.log(`   Transfer Status: ${result.data.trStatus}`);
      console.log(`   Requested by: ${result.data.reID}`);
      console.log(`   Request Date: ${result.data.reDate}`);
      
      // Possible transfer statuses (RFC 5731 Section 3.2.4):
      // - pending: Transfer awaiting action
      // - clientApproved: Approved by client
      // - clientRejected: Rejected by client
      // - clientCancelled: Cancelled by client
      // - serverApproved: Auto-approved by server (timeout)
      // - serverCancelled: Cancelled by server
      
      switch (result.data.trStatus) {
        case 'pending':
          console.log('   → Transfer is pending approval/rejection');
          console.log('   → Auto-approval after 5 days (typical)');
          break;
        case 'clientApproved':
          console.log('   → Transfer approved by losing registrar');
          break;
        case 'clientRejected':
          console.log('   → Transfer rejected by losing registrar');
          break;
      }
    }

    await client.logout();

  } catch (error: any) {
    console.error('\n❌ Query failed:', error.message);
  }
}

/**
 * GAINING REGISTRAR: Cancel transfer request
 * 
 * Referensi: RFC 5731 Section 3.2.4.3
 * Gaining registrar dapat cancel pending transfer
 */
async function gainingRegistrarCancelTransfer() {
  const client = new EppClient({
    host: 'epp.gaining-registrar.example', port: 700,
    username: 'gaining-registrar-id',
    password: 'password'
  });

  try {
    console.log('\n=== GAINING REGISTRAR: CANCEL TRANSFER ===\n');

    await client.login();
    console.log('✅ Logged in');

    const domainName = 'example.com';

    // Cancel transfer request
    const cancelRequest: DomainTransferRequest = {
      name: domainName,
      op: 'cancel' // Cancel pending transfer
    };

    const result = await client.domainTransfer(cancelRequest);
    
    console.log('✅ Transfer cancelled successfully');
    console.log(`   Domain: ${domainName}`);
    console.log(`   Transaction ID: ${result.svTRID}`);

    await client.logout();

  } catch (error: any) {
    console.error('\n❌ Cancel failed:', error.message);
    if (error.code === 2301) {
      console.error('   → No pending transfer to cancel');
    }
  }
}

/**
 * LOSING REGISTRAR: Approve transfer
 * 
 * Referensi: RFC 5731 Section 3.2.4.4
 * Losing registrar dapat approve transfer untuk expedite process
 */
async function losingRegistrarApproveTransfer() {
  const client = new EppClient({
    host: 'epp.losing-registrar.example', port: 700,
    username: 'losing-registrar-id',
    password: 'password'
  });

  try {
    console.log('\n=== LOSING REGISTRAR: APPROVE TRANSFER ===\n');

    await client.login();
    console.log('✅ Logged in as losing registrar');

    const domainName = 'example.com';

    // Approve transfer
    const approveRequest: DomainTransferRequest = {
      name: domainName,
      op: 'approve' // Approve pending transfer
    };

    const result = await client.domainTransfer(approveRequest);
    
    console.log('✅ Transfer approved successfully');
    console.log(`   Domain: ${domainName}`);
    console.log('   → Transfer will complete immediately');
    console.log(`   Transaction ID: ${result.svTRID}`);

    await client.logout();

  } catch (error: any) {
    console.error('\n❌ Approve failed:', error.message);
    if (error.code === 2301) {
      console.error('   → No pending transfer to approve');
    }
  }
}

/**
 * LOSING REGISTRAR: Reject transfer
 * 
 * Referensi: RFC 5731 Section 3.2.4.5
 * Losing registrar dapat reject transfer (biasanya pada customer request)
 */
async function losingRegistrarRejectTransfer() {
  const client = new EppClient({
    host: 'epp.losing-registrar.example', port: 700,
    username: 'losing-registrar-id',
    password: 'password'
  });

  try {
    console.log('\n=== LOSING REGISTRAR: REJECT TRANSFER ===\n');

    await client.login();
    console.log('✅ Logged in as losing registrar');

    const domainName = 'example.com';

    // Reject transfer
    const rejectRequest: DomainTransferRequest = {
      name: domainName,
      op: 'reject' // Reject pending transfer
    };

    const result = await client.domainTransfer(rejectRequest);
    
    console.log('✅ Transfer rejected successfully');
    console.log(`   Domain: ${domainName}`);
    console.log('   → Domain remains with losing registrar');
    console.log(`   Transaction ID: ${result.svTRID}`);

    await client.logout();

  } catch (error: any) {
    console.error('\n❌ Reject failed:', error.message);
    if (error.code === 2301) {
      console.error('   → No pending transfer to reject');
    }
  }
}

/**
 * Complete transfer flow demonstration
 */
async function completeTransferFlow() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       DOMAIN TRANSFER COMPLETE FLOW EXAMPLE            ║');
  console.log('║       RFC 5731 Section 3.2.4 - Transfer Command        ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // SCENARIO 1: Successful transfer dengan auto-approval
  console.log('\n📋 SCENARIO 1: Request Transfer (Auto-Approval)');
  console.log('─'.repeat(60));
  await gainingRegistrarRequestTransfer();
  
  await sleep(2000); // Simulate time passing
  
  console.log('\n📋 Check Transfer Status');
  console.log('─'.repeat(60));
  await gainingRegistrarQueryTransfer();

  // SCENARIO 2: Transfer dengan explicit approval
  console.log('\n\n📋 SCENARIO 2: Transfer dengan Losing Registrar Approval');
  console.log('─'.repeat(60));
  await gainingRegistrarRequestTransfer();
  
  await sleep(1000);
  
  console.log('\n📋 Losing Registrar Approves Transfer');
  console.log('─'.repeat(60));
  await losingRegistrarApproveTransfer();

  // SCENARIO 3: Transfer rejection
  console.log('\n\n📋 SCENARIO 3: Transfer Rejection');
  console.log('─'.repeat(60));
  await gainingRegistrarRequestTransfer();
  
  await sleep(1000);
  
  console.log('\n📋 Losing Registrar Rejects Transfer');
  console.log('─'.repeat(60));
  await losingRegistrarRejectTransfer();

  // SCENARIO 4: Transfer cancellation
  console.log('\n\n📋 SCENARIO 4: Transfer Cancellation');
  console.log('─'.repeat(60));
  await gainingRegistrarRequestTransfer();
  
  await sleep(1000);
  
  console.log('\n📋 Gaining Registrar Cancels Transfer');
  console.log('─'.repeat(60));
  await gainingRegistrarCancelTransfer();

  console.log('\n\n╔════════════════════════════════════════════════════════╗');
  console.log('║             TRANSFER FLOW DEMONSTRATION COMPLETE       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Transfer Best Practices dan Notes
 */
function printTransferBestPractices() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║          DOMAIN TRANSFER BEST PRACTICES                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('📌 BEFORE INITIATING TRANSFER:\n');
  console.log('   1. Verify domain tidak memiliki transfer prohibit status:');
  console.log('      - clientTransferProhibited');
  console.log('      - serverTransferProhibited');
  console.log('   2. Obtain valid authorization code dari losing registrar');
  console.log('   3. Unlock domain (remove clientTransferProhibited)');
  console.log('   4. Ensure domain tidak dalam redemption period');
  console.log('   5. Check domain belum expired\n');

  console.log('📌 TRANSFER TIMELINE (RFC 5731):\n');
  console.log('   - Day 0: Transfer request submitted');
  console.log('   - Day 0-5: Pending approval period');
  console.log('   - Day 5: Auto-approval (jika tidak ada action)');
  console.log('   - Transfer dapat approved/rejected sewaktu-waktu');
  console.log('   - Gaining registrar dapat cancel before approval\n');

  console.log('📌 TRANSFER RESULT CODES:\n');
  console.log('   - 1000: Transfer query successful');
  console.log('   - 1001: Transfer command pending');
  console.log('   - 2002: Invalid authorization information');
  console.log('   - 2201: Authorization error');
  console.log('   - 2300: Object pending transfer (duplicate request)');
  console.log('   - 2301: Object not pending transfer');
  console.log('   - 2304: Object status prohibits operation\n');

  console.log('📌 AUTHORIZATION CODE SECURITY:\n');
  console.log('   - Keep auth codes confidential');
  console.log('   - Use strong, random auth codes');
  console.log('   - Minimum 8 characters recommended');
  console.log('   - Change auth code after transfer');
  console.log('   - Transmit only via secure channels\n');

  console.log('📌 REGISTRY-SPECIFIC POLICIES:\n');
  console.log('   - Some registries auto-approve after 5 days');
  console.log('   - Some require explicit approval');
  console.log('   - Transfer may add 1 year to registration');
  console.log('   - Check registry transfer policy documentation\n');
}

// Export functions untuk testing
export {
  gainingRegistrarRequestTransfer,
  gainingRegistrarQueryTransfer,
  gainingRegistrarCancelTransfer,
  losingRegistrarApproveTransfer,
  losingRegistrarRejectTransfer,
  completeTransferFlow,
  printTransferBestPractices
};

// Run jika dijalankan directly
if (typeof require !== 'undefined' && require.main === module) {
  printTransferBestPractices();
  
  completeTransferFlow()
    .then(() => {
      console.log('✨ Transfer examples completed\n');
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
    });
}
