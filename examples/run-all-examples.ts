#!/usr/bin/env ts-node
/**
 * Run All Examples Script
 * 
 * Script untuk menjalankan semua example files secara berurutan
 * dengan delay untuk memudahkan observasi.
 */

import { spawn } from 'child_process';
import * as path from 'path';

interface Example {
  name: string;
  file: string;
  description: string;
}

const examples: Example[] = [
  {
    name: 'Basic Usage',
    file: 'basic-usage.ts',
    description: 'Demonstrasi basic EPP operations'
  },
  {
    name: 'TLS/TCP Connection',
    file: 'tls-tcp-connection.ts',
    description: 'Demonstrasi TLS/TCP connection sesuai RFC 5734'
  },
  {
    name: 'SSL Configurations',
    file: 'ssl-configurations.ts',
    description: 'Berbagai contoh konfigurasi SSL/TLS'
  },
  {
    name: 'Complete Domain Registration',
    file: 'complete-domain-registration.ts',
    description: 'Flow lengkap registrasi domain'
  },
  {
    name: 'Domain Transfer',
    file: 'domain-transfer.ts',
    description: 'Proses domain transfer operations'
  }
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runExample(example: Example): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(70));
    console.log(`📝 Running: ${example.name}`);
    console.log(`   File: ${example.file}`);
    console.log(`   ${example.description}`);
    console.log('='.repeat(70) + '\n');

    const examplePath = path.join(__dirname, example.file);
    const proc = spawn('ts-node', [examplePath], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${example.name} completed successfully\n`);
        resolve(true);
      } else {
        console.error(`\n❌ ${example.name} failed with code ${code}\n`);
        resolve(false);
      }
    });

    proc.on('error', (error) => {
      console.error(`\n❌ Failed to run ${example.name}:`, error.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  EPP CLIENT - RUN ALL EXAMPLES                 ║');
  console.log('║                                                                ║');
  console.log('║  This script will run all example files sequentially          ║');
  console.log('║  Note: Most examples will fail without actual EPP server      ║');
  console.log('║        but they demonstrate the correct usage patterns        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📋 Examples to run:');
  examples.forEach((example, index) => {
    console.log(`   ${index + 1}. ${example.name}`);
  });
  console.log();

  await sleep(2000);

  let successCount = 0;
  let failCount = 0;

  for (const example of examples) {
    const success = await runExample(example);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Add delay between examples for readability
    if (example !== examples[examples.length - 1]) {
      console.log('⏳ Waiting 3 seconds before next example...\n');
      await sleep(3000);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('                         SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total examples: ${examples.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('='.repeat(70) + '\n');

  console.log('💡 Note: Examples may fail if there\'s no actual EPP server running.');
  console.log('   The examples demonstrate correct usage patterns and can be adapted');
  console.log('   for your specific EPP registry implementation.\n');

  process.exit(failCount > 0 ? 1 : 0);
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Script interrupted by user');
  process.exit(130);
});

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
}
