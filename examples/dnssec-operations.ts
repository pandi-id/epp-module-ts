/**
 * DNSSEC Operations Examples
 * 
 * This example demonstrates how to use DNSSEC (Domain Name System Security Extensions)
 * with the EPP client according to RFC 5910.
 * 
 * DNSSEC provides cryptographic authentication of DNS data, authenticated denial of existence,
 * and data integrity. This example shows how to:
 * - Create a domain with DNSSEC data
 * - Add DS (Delegation Signer) records
 * - Add DNSKEY records
 * - Update DNSSEC configuration
 * - Remove DNSSEC data
 * 
 * Reference: RFC 5910 - Domain Name System (DNS) Security Extensions Mapping for EPP
 */

import { EppClient } from '../src/core/EppClient';
import { EppConfig } from '../src/types/Common';
import {
  DNSSEC_ALGORITHMS,
  DNSSEC_DIGEST_TYPES,
  validateDsData,
  validateKeyData
} from '../src/types/Dnssec';

// Configuration
const config: EppConfig = {
  host: 'epp.example.com',
  port: 700,
  username: 'your-username',
  password: 'your-password',
  // SSL/TLS Configuration
  rejectUnauthorized: false, // Set to true in production with valid certificates
};

async function example1_CreateDomainWithDsData() {
  console.log('\n=== Example 1: Create Domain with DS Data ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    // DS Record Data
    // These values would come from your DNS hosting provider
    const dsData = {
      keyTag: 12345,
      alg: 8, // DNSSEC_ALGORITHMS[8] = RSA/SHA-256
      digestType: 2, // DNSSEC_DIGEST_TYPES[2] = SHA-256
      digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE' // Hex digest
    };

    // Validate DS data before sending
    const dsValidation = validateDsData(dsData);
    if (!dsValidation) {
      console.error('DS Data validation failed');
      return;
    }

    console.log('Creating domain with DNSSEC DS data...');
    const result = await client.domainCreate({
      name: 'example-dnssec.com',
      period: { value: 1, unit: 'y' },
      registrant: 'CONTACT-001',
      contacts: [
        { type: 'admin', id: 'CONTACT-002' },
        { type: 'tech', id: 'CONTACT-003' }
      ],
      authInfo: { pw: 'example-auth-2024' },
      // DNSSEC Extension
      dnssec: {
        maxSigLife: 604800, // 7 days in seconds (optional)
        dsData: [dsData]
      }
    });

    console.log('Domain created successfully with DNSSEC!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example2_CreateDomainWithKeyData() {
  console.log('\n=== Example 2: Create Domain with DNSKEY Data ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    // DNSKEY Record Data
    const keyData = {
      flags: 257, // 256 = ZSK (Zone Signing Key), 257 = KSK (Key Signing Key)
      protocol: 3, // Always 3 for DNSSEC
      alg: 8, // DNSSEC_ALGORITHMS[8] = RSA/SHA-256
      pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz==' // Base64 encoded public key
    };

    // Validate key data
    const keyValidation = validateKeyData(keyData);
    if (!keyValidation) {
      console.error('Key Data validation failed');
      return;
    }

    console.log('Creating domain with DNSSEC key data...');
    const result = await client.domainCreate({
      name: 'example-key.com',
      period: { value: 1, unit: 'y' },
      registrant: 'CONTACT-001',
      contacts: [
        { type: 'admin', id: 'CONTACT-002' }
      ],
      authInfo: { pw: 'example-auth-2024' },
      // DNSSEC Extension with key data
      dnssec: {
        keyData: [keyData]
      }
    });

    console.log('Domain created with DNSKEY record!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example3_CreateDomainWithBothDsAndKey() {
  console.log('\n=== Example 3: Create Domain with Both DS and DNSKEY ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Creating domain with both DS and DNSKEY data...');
    const result = await client.domainCreate({
      name: 'example-complete.com',
      period: { value: 2, unit: 'y' },
      registrant: 'CONTACT-001',
      contacts: [
        { type: 'admin', id: 'CONTACT-002' },
        { type: 'tech', id: 'CONTACT-003' }
      ],
      authInfo: { pw: 'secure-password-2024' },
      // Complete DNSSEC configuration
      dnssec: {
        maxSigLife: 604800, // 7 days
        // DS Records (recommended approach)
        dsData: [
          {
            keyTag: 12345,
            alg: 8, // RSA/SHA-256
            digestType: 2, // SHA-256
            digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
          },
          {
            keyTag: 54321,
            alg: 13, // ECDSA Curve P-256 with SHA-256
            digestType: 4, // SHA-384
            digest: '2BB183AF5F22588179A53B0A98631FAD1A292118'
          }
        ],
        // DNSKEY Records (alternative approach)
        keyData: [
          {
            flags: 257, // KSK
            protocol: 3,
            alg: 8, // RSA/SHA-256
            pubKey: 'AwEAAa1234567890abcdefghijklmnopqrstuvwxyz=='
          }
        ]
      }
    });

    console.log('Domain created with complete DNSSEC configuration!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example4_AddDnssecData() {
  console.log('\n=== Example 4: Add DNSSEC Data to Existing Domain ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Adding DNSSEC DS records to existing domain...');
    const result = await client.domainUpdate({
      name: 'existing-domain.com',
      // DNSSEC Extension - Add operation
      dnssec: {
        add: {
          dsData: [
            {
              keyTag: 12345,
              alg: 8, // RSA/SHA-256
              digestType: 2, // SHA-256
              digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
            }
          ],
          maxSigLife: 604800
        },
        urgent: false // Set to true for urgent updates
      }
    });

    console.log('DNSSEC data added successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example5_RemoveSpecificDnssecData() {
  console.log('\n=== Example 5: Remove Specific DNSSEC DS Record ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Removing specific DS record...');
    const result = await client.domainUpdate({
      name: 'example-dnssec.com',
      // DNSSEC Extension - Remove specific DS record
      dnssec: {
        rem: {
          dsData: [
            {
              keyTag: 12345,
              alg: 8, // RSA/SHA-256
              digestType: 2, // SHA-256
              digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
            }
          ]
        },
        urgent: true // Mark as urgent
      }
    });

    console.log('DS record removed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example6_RemoveAllDnssecData() {
  console.log('\n=== Example 6: Remove All DNSSEC Data ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Removing all DNSSEC data from domain...');
    const result = await client.domainUpdate({
      name: 'example-dnssec.com',
      // DNSSEC Extension - Remove all
      dnssec: {
        rem: {
          all: true // Remove all DNSSEC data
        }
      }
    });

    console.log('All DNSSEC data removed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example7_UpdateMaxSigLife() {
  console.log('\n=== Example 7: Update maxSigLife ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Updating maxSigLife value...');
    const result = await client.domainUpdate({
      name: 'example-dnssec.com',
      // DNSSEC Extension - Change maxSigLife
      dnssec: {
        chg: {
          maxSigLife: 1209600 // 14 days in seconds
        }
      }
    });

    console.log('maxSigLife updated successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example8_ComplexDnssecUpdate() {
  console.log('\n=== Example 8: Complex DNSSEC Update (Add, Remove, Change) ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Performing complex DNSSEC update...');
    const result = await client.domainUpdate({
      name: 'example-dnssec.com',
      // Complex DNSSEC update with add, remove, and change
      dnssec: {
        // Add new DS record
        add: {
          dsData: [
            {
              keyTag: 54321,
              alg: 13, // ECDSA Curve P-256 with SHA-256
              digestType: 4, // SHA-384
              digest: '2BB183AF5F22588179A53B0A98631FAD1A292118'
            }
          ]
        },
        // Remove old DS record
        rem: {
          dsData: [
            {
              keyTag: 12345,
              alg: 8, // RSA/SHA-256
              digestType: 2, // SHA-256
              digest: '49FD46E6C4B45C55D4AC69CBD3CD34AC1AFE51DE'
            }
          ]
        },
        // Update maxSigLife
        chg: {
          maxSigLife: 1209600 // 14 days
        },
        urgent: true // Mark as urgent update
      }
    });

    console.log('Complex DNSSEC update completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

async function example9_CheckDomainDnssecInfo() {
  console.log('\n=== Example 9: Check Domain DNSSEC Info ===\n');
  
  const client = new EppClient(config);
  
  try {
    await client.connect();
    
    console.log('Retrieving domain info with DNSSEC data...');
    const result = await client.domainInfo('example-dnssec.com');

    // Note: The actual domain info would be in result.data
    // This example shows the structure of what would be returned
    console.log('Domain Info Response:', JSON.stringify(result, null, 2));
    
    // In a real implementation, you would access:
    // const domainData = result.data as DomainInfo;
    // if (domainData.dnssec) {
    //   console.log('DNSSEC Configuration:');
    //   console.log('- Max Signature Life:', domainData.dnssec.maxSigLife, 'seconds');
    //   
    //   if (domainData.dnssec.dsData && domainData.dnssec.dsData.length > 0) {
    //     console.log('\nDS Records:');
    //     domainData.dnssec.dsData.forEach((ds, index) => {
    //       console.log(`  DS Record ${index + 1}:`);
    //       console.log(`  - Key Tag: ${ds.keyTag}`);
    //       console.log(`  - Algorithm: ${ds.alg}`);
    //       console.log(`  - Digest Type: ${ds.digestType}`);
    //       console.log(`  - Digest: ${ds.digest}`);
    //     });
    //   }
    // }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

// Main execution
async function main() {
  console.log('='.repeat(70));
  console.log('EPP Client - DNSSEC Operations Examples');
  console.log('RFC 5910 - DNSSEC Extension for EPP');
  console.log('='.repeat(70));

  // Uncomment the examples you want to run:
  
  // await example1_CreateDomainWithDsData();
  // await example2_CreateDomainWithKeyData();
  // await example3_CreateDomainWithBothDsAndKey();
  // await example4_AddDnssecData();
  // await example5_RemoveSpecificDnssecData();
  // await example6_RemoveAllDnssecData();
  // await example7_UpdateMaxSigLife();
  // await example8_ComplexDnssecUpdate();
  // await example9_CheckDomainDnssecInfo();

  console.log('\n' + '='.repeat(70));
  console.log('Examples completed!');
  console.log('='.repeat(70));
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_CreateDomainWithDsData,
  example2_CreateDomainWithKeyData,
  example3_CreateDomainWithBothDsAndKey,
  example4_AddDnssecData,
  example5_RemoveSpecificDnssecData,
  example6_RemoveAllDnssecData,
  example7_UpdateMaxSigLife,
  example8_ComplexDnssecUpdate,
  example9_CheckDomainDnssecInfo
};
