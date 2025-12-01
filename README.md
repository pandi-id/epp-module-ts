# EPP Client

A professional TypeScript EPP (Extensible Provisioning Protocol) client for domain registry operations.

## Installation

```bash
npm install epp-client
# or
yarn add epp-client

```
## Usage
```typescript
import { EppClient } from 'epp-client';

// Initialize client
const client = new EppClient({
  server: 'https://registry.example.com/epp',
  username: 'your-username',
  password: 'your-password',
  debug: true
});

// Login
await client.login();

// Check domain availability
const result = await client.domainCheck(['example.com', 'test.com']);
console.log(result.data); // Array of domain availability

// Create contact
const contact = await client.contactCreate({
  id: 'CONTACT123',
  postalInfo: {
    type: 'int',
    name: 'John Doe',
    addr: {
      street: ['123 Main St'],
      city: 'New York',
      sp: 'NY',
      pc: '10001',
      cc: 'US'
    }
  },
  email: 'john@example.com',
  authInfo: {
    pw: 'contact-password'
  }
});

// Logout
await client.logout();
```

## Features
- ✅ Full EPP protocol support
- ✅ TypeScript definitions
- ✅ Contact operations (check, info, create, update, delete)
- ✅ Domain operations (check, info, create, update, renew, delete)
- ✅ Host operations (check, info, create, update, delete)
- ✅ Fee extension support
- ✅ Session management
- ✅ Error handling
- ✅ Debug mode