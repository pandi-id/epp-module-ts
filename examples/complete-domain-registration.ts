/**
 * Complete Domain Registration Example
 * 
 * Contoh lengkap registrasi domain menggunakan EPP Client
 * dengan referensi RFC di setiap step.
 */

import { EppClient } from '../src/core/EppClient';
import { 
  ContactCreateRequest, 
  DomainCreateRequest,
  HostCreateRequest 
} from '../src/types';

/**
 * Main function untuk demonstrasi domain registration flow
 */
async function completeDomainRegistration() {
  // Initialize EPP Client
  // Referensi: RFC 5730 Section 2 - Transport Considerations
  const client = new EppClient({
    server: 'https://epp.registry.example',
    username: 'registrar-id',
    password: 'secure-password',
    lang: 'en',
    version: '1.0',
    timeout: 30000,
    debug: true // Enable debug untuk melihat XML requests/responses
  });

  try {
    // ========================================================================
    // STEP 1: LOGIN
    // Referensi: RFC 5730 Section 2.9.1.1 - <login> Command
    // ========================================================================
    console.log('\n📝 Step 1: Login to EPP server');
    const loginResult = await client.login();
    console.log(`✅ Login successful - Code: ${loginResult.code}`);
    console.log(`   Transaction ID: ${loginResult.svTRID}`);

    // ========================================================================
    // STEP 2: CHECK DOMAIN AVAILABILITY
    // Referensi: RFC 5731 Section 3.1.1 - EPP <check> Command
    // ========================================================================
    console.log('\n📝 Step 2: Check domain availability');
    const domains = ['example.com', 'example.net', 'example.org'];
    const checkResult = await client.domainCheck(domains);
    
    console.log('✅ Domain check results:');
    checkResult.data.forEach((domain: any) => {
      const status = domain.available ? '✅ Available' : '❌ Not available';
      console.log(`   ${domain.name}: ${status}`);
      if (domain.reason) {
        console.log(`      Reason: ${domain.reason}`);
      }
    });

    // Pilih domain yang available
    const availableDomain = checkResult.data.find((d: any) => d.available);
    if (!availableDomain) {
      throw new Error('No available domains found');
    }
    const domainName = availableDomain.name;
    console.log(`\n🎯 Selected domain: ${domainName}`);

    // ========================================================================
    // STEP 3: CHECK FEE (OPTIONAL)
    // Referensi: RFC 8748 - EPP Fee Extension
    // ========================================================================
    console.log('\n📝 Step 3: Check domain registration fee');
    try {
      const feeResult = await client.feeCheck({
        domain: domainName,
        command: 'create',
        period: { value: 1, unit: 'y' },
        currency: 'USD'
      });
      console.log('✅ Fee information:');
      console.log(`   ${JSON.stringify(feeResult.data, null, 2)}`);
    } catch (error: any) {
      console.log('⚠️  Fee check not supported or failed');
    }

    // ========================================================================
    // STEP 4: CREATE REGISTRANT CONTACT
    // Referensi: RFC 5733 Section 3.2.1 - EPP <create> Command
    // ========================================================================
    console.log('\n📝 Step 4: Create registrant contact');
    
    // Contact dengan International postal info (7-bit ASCII)
    // Referensi: RFC 5733 Section 2.2 - Contact Postal Information
    const registrantContact: ContactCreateRequest = {
      id: 'reg-001',
      postalInfo: {
        type: 'int', // International format
        name: 'John Doe',
        org: 'Example Corporation',
        addr: {
          street: [
            '123 Example Street',
            'Suite 100'
          ],
          city: 'Jakarta',
          sp: 'DKI Jakarta',
          pc: '12345',
          cc: 'ID' // ISO 3166-1 country code
        }
      },
      // Phone format: +[country].[area][number] x[extension]
      // Referensi: RFC 5733 Section 3.2.1
      voice: '+62.2112345678',
      fax: '+62.2112345679',
      email: 'registrant@example.com',
      authInfo: {
        pw: 'registrant-auth-2024' // Authorization untuk future transfers
      },
      // Privacy settings - Referensi: RFC 5733 Section 2.9
      disclose: {
        flag: 0, // 0 = Hide specified fields dari WHOIS
        name: { type: 'int' },
        org: { type: 'int' },
        addr: { type: 'int' },
        voice: true,
        email: true
      }
    };

    const regResult = await client.contactCreate(registrantContact);
    console.log(`✅ Registrant contact created - ID: ${registrantContact.id}`);

    // ========================================================================
    // STEP 5: CREATE ADMIN CONTACT
    // Referensi: RFC 5733 Section 3.2.1
    // ========================================================================
    console.log('\n📝 Step 5: Create admin contact');
    
    const adminContact: ContactCreateRequest = {
      id: 'admin-001',
      postalInfo: {
        type: 'int',
        name: 'Jane Smith',
        org: 'Example Corporation',
        addr: {
          street: ['456 Admin Street'],
          city: 'Jakarta',
          sp: 'DKI Jakarta',
          pc: '12345',
          cc: 'ID'
        }
      },
      voice: '+62.2198765432',
      email: 'admin@example.com',
      authInfo: {
        pw: 'admin-auth-2024'
      }
    };

    await client.contactCreate(adminContact);
    console.log(`✅ Admin contact created - ID: ${adminContact.id}`);

    // ========================================================================
    // STEP 6: CREATE TECH CONTACT
    // Referensi: RFC 5733 Section 3.2.1
    // ========================================================================
    console.log('\n📝 Step 6: Create tech contact');
    
    const techContact: ContactCreateRequest = {
      id: 'tech-001',
      postalInfo: {
        type: 'int',
        name: 'Bob Johnson',
        org: 'Example IT Services',
        addr: {
          street: ['789 Tech Boulevard'],
          city: 'Jakarta',
          cc: 'ID'
        }
      },
      voice: '+62.2155555555',
      email: 'tech@example.com',
      authInfo: {
        pw: 'tech-auth-2024'
      }
    };

    await client.contactCreate(techContact);
    console.log(`✅ Tech contact created - ID: ${techContact.id}`);

    // ========================================================================
    // STEP 7: CREATE NAMESERVERS (GLUE RECORDS)
    // Referensi: RFC 5732 Section 3.2.1 - EPP <create> Command
    // ========================================================================
    console.log('\n📝 Step 7: Create nameservers (subordinate hosts)');
    
    // Subordinate host (in-bailiwick) MUST have IP addresses
    // Referensi: RFC 5732 Section 2.2 - Host Address
    const ns1: HostCreateRequest = {
      name: `ns1.${domainName}`,
      addr: [
        { ip: '192.0.2.1', type: 'v4' },   // IPv4
        { ip: '2001:db8::1', type: 'v6' }  // IPv6
      ]
    };

    const ns2: HostCreateRequest = {
      name: `ns2.${domainName}`,
      addr: [
        { ip: '192.0.2.2', type: 'v4' },
        { ip: '2001:db8::2', type: 'v6' }
      ]
    };

    await client.hostCreate(ns1);
    console.log(`✅ Nameserver created - ${ns1.name}`);
    
    await client.hostCreate(ns2);
    console.log(`✅ Nameserver created - ${ns2.name}`);

    // ========================================================================
    // STEP 8: REGISTER DOMAIN
    // Referensi: RFC 5731 Section 3.2.1 - EPP <create> Command
    // ========================================================================
    console.log('\n📝 Step 8: Register domain');
    
    const domainData: DomainCreateRequest = {
      name: domainName,
      // Period - Referensi: RFC 5731 Section 2.2
      period: {
        value: 1,
        unit: 'y' // 'y' = years, 'm' = months
      },
      // Registrant - REQUIRED
      registrant: registrantContact.id,
      // Contacts - Most registries require admin dan tech
      // Referensi: RFC 5731 Section 2.2
      contacts: [
        { type: 'admin', id: adminContact.id },
        { type: 'tech', id: techContact.id }
      ],
      // Nameservers - Menggunakan hostObj untuk subordinate hosts
      // Referensi: RFC 5731 Section 1.1
      ns: {
        hostObj: [ns1.name, ns2.name]
      },
      // Authorization info untuk future transfers
      // Referensi: RFC 5731 Section 2.2
      authInfo: {
        pw: 'domain-auth-code-2024'
      }
    };

    const createResult = await client.domainCreate(domainData);
    console.log('✅ Domain registered successfully!');
    console.log(`   Domain: ${domainName}`);
    console.log(`   Transaction ID: ${createResult.svTRID}`);

    // ========================================================================
    // STEP 9: VERIFY DOMAIN INFORMATION
    // Referensi: RFC 5731 Section 3.1.2 - EPP <info> Command
    // ========================================================================
    console.log('\n📝 Step 9: Verify domain information');
    
    const infoResult = await client.domainInfo(domainName);
    console.log('✅ Domain information retrieved:');
    console.log(`   Name: ${infoResult.data.name}`);
    console.log(`   ROID: ${infoResult.data.roid}`);
    console.log(`   Status: ${infoResult.data.status.join(', ')}`);
    console.log(`   Registrant: ${infoResult.data.registrant}`);
    console.log(`   Created: ${infoResult.data.crDate}`);
    console.log(`   Expires: ${infoResult.data.exDate}`);

    // ========================================================================
    // STEP 10: UPDATE DOMAIN (ADD STATUS)
    // Referensi: RFC 5731 Section 3.2.5 - EPP <update> Command
    // ========================================================================
    console.log('\n📝 Step 10: Update domain (add client status)');
    
    await client.domainUpdate({
      name: domainName,
      add: {
        // Add client statuses untuk protect domain
        // Referensi: RFC 5731 Section 2.3
        status: [
          'clientTransferProhibited', // Prevent unauthorized transfers
          'clientUpdateProhibited'     // Prevent unauthorized updates
        ]
      }
    });
    console.log('✅ Domain status updated');

    // ========================================================================
    // STEP 11: VERIFY UPDATE
    // ========================================================================
    console.log('\n📝 Step 11: Verify domain status update');
    
    const updatedInfo = await client.domainInfo(domainName);
    console.log('✅ Updated domain status:');
    console.log(`   ${updatedInfo.data.status.join(', ')}`);

    // ========================================================================
    // STEP 12: LOGOUT
    // Referensi: RFC 5730 Section 2.9.1.2 - <logout> Command
    // ========================================================================
    console.log('\n📝 Step 12: Logout from EPP server');
    
    await client.logout();
    console.log('✅ Logout successful');
    console.log('\n🎉 Complete domain registration flow finished successfully!');

  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    console.error(`   Message: ${error.message}`);
    
    if (error.code) {
      console.error(`   EPP Error Code: ${error.code}`);
      
      // Interpret common error codes
      // Referensi: RFC 5730 Section 3 - Result Codes
      switch (error.code) {
        case 2200:
          console.error('   → Authentication failed');
          break;
        case 2302:
          console.error('   → Object already exists');
          break;
        case 2303:
          console.error('   → Object does not exist');
          break;
        case 2304:
          console.error('   → Object status prohibits operation');
          break;
        case 2306:
          console.error('   → Parameter value policy error');
          break;
        default:
          console.error('   → See RFC 5730 Section 3 for error code details');
      }
    }

    // Always try to logout
    try {
      if (client.isConnected()) {
        await client.logout();
        console.log('✅ Cleanup: Logged out successfully');
      }
    } catch (logoutError) {
      console.error('⚠️  Cleanup: Logout failed');
    }
  }
}

// Run the example
if (require.main === module) {
  completeDomainRegistration()
    .then(() => {
      console.log('\n✨ Example completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { completeDomainRegistration };
