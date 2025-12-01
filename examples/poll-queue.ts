/**
 * EPP Poll Queue Management Example
 * Referensi: RFC 5730 Section 2.9.2.3 - Poll Command
 * 
 * Poll command digunakan untuk retrieve dan acknowledge messages
 * dari server message queue. Messages berisi notifications tentang:
 * - Domain transfer requests/approvals
 * - Domain expiration warnings
 * - Contact/host updates
 * - Registry policy changes
 * - Billing notifications
 * 
 * Message Queue Behavior:
 * - FIFO (First In, First Out) order
 * - 'req' operation retrieves message tanpa menghapus dari queue
 * - 'ack' operation menghapus message dari queue
 * - Server may limit queue size dan retention period
 */

import { EppClient } from '../src/core/EppClient';

async function pollQueueExample() {
  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'password',
    timeout: 30000,
    debug: true
  });

  try {
    // Connect dan login
    await client.connect();
    console.log('✓ Connected to EPP server');
    
    await client.login();
    console.log('✓ Logged in successfully');
    console.log('');

    // ========================================================================
    // Example 1: Request First Message dari Queue
    // ========================================================================
    console.log('1. Requesting first message from queue...');
    const pollReq = await client.poll('req');
    
    if (pollReq.code === 1300) {
      console.log('✓ No messages in queue (code 1300)');
    } else if (pollReq.code === 1301 && pollReq.data?.msgQ) {
      const msg = pollReq.data.msgQ;
      console.log('✓ Message received:');
      console.log(`  - Message ID: ${msg.id}`);
      console.log(`  - Queue Date: ${msg.qDate}`);
      console.log(`  - Type: ${msg.type || 'N/A'}`);
      console.log(`  - Messages Remaining: ${msg.count || 0}`);
      console.log(`  - Content:`, msg.msg);
      
      // ========================================================================
      // Example 2: Acknowledge Message (Remove from Queue)
      // ========================================================================
      console.log('');
      console.log('2. Acknowledging message...');
      const pollAck = await client.poll('ack', msg.id);
      
      if (pollAck.code === 1000) {
        console.log('✓ Message acknowledged successfully');
        console.log(`  - ${pollAck.data?.msgQ?.count || 0} messages remaining`);
      }
    }

    // ========================================================================
    // Example 3: Process All Messages in Queue
    // ========================================================================
    console.log('');
    console.log('3. Processing all messages in queue...');
    
    let hasMessages = true;
    let processedCount = 0;
    
    while (hasMessages) {
      const result = await client.poll('req');
      
      if (result.code === 1300) {
        // No more messages
        console.log(`✓ Queue empty. Processed ${processedCount} messages.`);
        hasMessages = false;
      } else if (result.code === 1301 && result.data?.msgQ) {
        const msg = result.data.msgQ;
        processedCount++;
        
        console.log(`\nMessage ${processedCount}:`);
        console.log(`  - ID: ${msg.id}`);
        console.log(`  - Date: ${msg.qDate}`);
        console.log(`  - Type: ${msg.type || 'Unknown'}`);
        
        // Process message based on type
        if (msg.type === 'domain:trnData') {
          console.log('  → Domain Transfer Notification');
          console.log(`    - Domain: ${msg.msg?.name || 'N/A'}`);
          console.log(`    - Transfer Status: ${msg.msg?.trStatus || 'N/A'}`);
        } else if (msg.type === 'domain:panData') {
          console.log('  → Domain Pending Action Notification');
        } else {
          console.log('  → Other notification type');
        }
        
        // Acknowledge message
        await client.poll('ack', msg.id);
        console.log('  ✓ Acknowledged');
        
        // Optional: Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // ========================================================================
    // Example 4: Handling Different Message Types
    // ========================================================================
    console.log('');
    console.log('4. Message type handling example...');
    
    const checkResult = await client.poll('req');
    
    if (checkResult.code === 1301 && checkResult.data?.msgQ) {
      const msg = checkResult.data.msgQ;
      
      switch (msg.type) {
        case 'domain:trnData':
          console.log('Domain Transfer Message:');
          console.log('  - Handle transfer approval/rejection');
          console.log('  - Update internal records');
          console.log('  - Notify domain owner');
          break;
          
        case 'domain:panData':
          console.log('Domain Pending Action Message:');
          console.log('  - Review pending operation');
          console.log('  - Take required action');
          break;
          
        case 'contact:panData':
          console.log('Contact Pending Action Message:');
          console.log('  - Review contact changes');
          break;
          
        default:
          console.log(`Unknown message type: ${msg.type}`);
          console.log('  - Log for review');
          console.log('  - Contact registry support if needed');
      }
      
      // Always acknowledge after processing
      await client.poll('ack', msg.id);
    } else {
      console.log('No messages to demonstrate type handling');
    }

    // ========================================================================
    // Best Practices
    // ========================================================================
    console.log('');
    console.log('📋 Best Practices for Poll Queue Management:');
    console.log('');
    console.log('1. Regular Polling:');
    console.log('   - Poll queue regularly (e.g., every 5-15 minutes)');
    console.log('   - Don\'t let messages accumulate');
    console.log('   - Server may have queue size limits');
    console.log('');
    console.log('2. Message Processing:');
    console.log('   - Always acknowledge messages after processing');
    console.log('   - Handle different message types appropriately');
    console.log('   - Log all messages for audit trail');
    console.log('');
    console.log('3. Error Handling:');
    console.log('   - Implement retry logic for failed processing');
    console.log('   - Don\'t acknowledge if processing fails');
    console.log('   - Monitor for stuck messages');
    console.log('');
    console.log('4. Performance:');
    console.log('   - Process messages in batches');
    console.log('   - Add delays to avoid rate limiting');
    console.log('   - Use background jobs for queue processing');
    console.log('');

    // Logout dan disconnect
    await client.logout();
    console.log('✓ Logged out');
    
    await client.disconnect();
    console.log('✓ Disconnected');

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('EPP Error Code:', error.code);
    }
    
    // Cleanup
    if (client.isConnected()) {
      try {
        await client.logout();
        await client.disconnect();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
}

/**
 * Scheduled Poll Queue Processor
 * 
 * Example implementation untuk automated queue processing
 */
async function scheduledPollProcessor() {
  const client = new EppClient({
    host: 'epp.registry.example',
    port: 700,
    username: 'registrar-id',
    password: 'password',
    timeout: 30000
  });

  console.log('Starting scheduled poll processor...');
  console.log('Processing queue every 5 minutes...');
  console.log('');

  const processQueue = async () => {
    try {
      await client.connect();
      await client.login();
      
      let hasMessages = true;
      let count = 0;
      
      while (hasMessages) {
        const result = await client.poll('req');
        
        if (result.code === 1300) {
          hasMessages = false;
        } else if (result.code === 1301 && result.data?.msgQ) {
          count++;
          const msg = result.data.msgQ;
          
          // Process message
          console.log(`[${new Date().toISOString()}] Message ${count}: ${msg.type}`);
          
          // Your processing logic here
          // - Update database
          // - Send notifications
          // - Trigger workflows
          
          // Acknowledge
          await client.poll('ack', msg.id);
        }
      }
      
      if (count > 0) {
        console.log(`Processed ${count} messages at ${new Date().toISOString()}`);
      }
      
      await client.logout();
      await client.disconnect();
      
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error:`, error.message);
      
      if (client.isConnected()) {
        try {
          await client.logout();
          await client.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  };

  // Run every 5 minutes
  const interval = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Initial run
  await processQueue();
  
  // Schedule subsequent runs
  setInterval(processQueue, interval);
}

// Run example
if (require.main === module) {
  pollQueueExample().catch(console.error);
  
  // Uncomment to run scheduled processor
  // scheduledPollProcessor().catch(console.error);
}

export { pollQueueExample, scheduledPollProcessor };
