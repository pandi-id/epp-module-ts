import { EppClient } from '../src';

async function main() {
  // Initialize client with TLS/TCP configuration
  const client = new EppClient({
    host: 'epp.testregistry.com',
    port: 700, // Standard EPP port
    username: 'test-registrar',
    password: 'test-password',
    debug: true
  });

  try {
    console.log('=== EPP Client Demo ===\n');

    // 1. Login
    console.log('1. Logging in...');
    const loginResult = await client.login();
    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.message}`);
    }
    console.log('✓ Login successful\n');

    // 2. Check domain availability
    console.log('2. Checking domain availability...');
    const domainCheck = await client.domainCheck(['example.com', 'test-domain-123.com']);
    console.log('Domain check results:');
    domainCheck.data.forEach((result: any) => {
      console.log(`  - ${result.name}: ${result.available ? 'Available' : 'Taken'}`);
    });
    console.log();

    // 3. Check contact
    console.log('3. Checking contact...');
    const contactCheck = await client.contactCheck(['CONTACT123']);
    console.log('Contact check results:');
    contactCheck.data.forEach((result: any) => {
      console.log(`  - ${result.id}: ${result.available ? 'Available' : 'Taken'}`);
    });
    console.log();

    // 4. Create contact
    console.log('4. Creating contact...');
    const contactCreate = await client.contactCreate({
      id: 'CONTACT123',
      postalInfo: {
        type: 'int',
        name: 'John Doe',
        org: 'Example Inc.',
        addr: {
          street: ['123 Main Street', 'Suite 100'],
          city: 'New York',
          sp: 'NY',
          pc: '10001',
          cc: 'US'
        }
      },
      voice: '+1.2125551234',
      email: 'john.doe@example.com',
      authInfo: {
        pw: 'contact-password-123'
      }
    });
    console.log(`✓ Contact created: ${contactCreate.data.id}\n`);

    // 5. Create domain
    console.log('5. Creating domain...');
    const domainCreate = await client.domainCreate({
      name: 'test-domain-123.com',
      period: { value: 1, unit: 'y' },
      registrant: 'CONTACT123',
      contacts: [
        { type: 'admin', id: 'CONTACT123' },
        { type: 'tech', id: 'CONTACT123' }
      ],
      authInfo: {
        pw: 'domain-password-123'
      }
    });
    console.log(`✓ Domain created: ${domainCreate.data.name}\n`);

    // 6. Check fees
    console.log('6. Checking fees...');
    const feeCheck = await client.feeCheck({
      command: 'create',
      domain: 'test-domain-123.com',
      period: { value: 1, unit: 'y' },
      currency: 'USD'
    });
    console.log('Fee check results:');
    if (feeCheck.data) {
      console.log(`  Fee: ${JSON.stringify(feeCheck.data)}`);
    }
    console.log();

    // 7. Logout
    console.log('7. Logging out...');
    await client.logout();
    console.log('✓ Logout successful\n');

    console.log('=== Demo completed successfully ===');

  } catch (error) {
    console.error('Error:', error);
    
    // Ensure logout on error
    try {
      await client.logout();
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    }
  }
}

// Run demo
main().catch(console.error);