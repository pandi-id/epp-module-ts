# EPP Extensions Documentation

Complete guide untuk EPP Extensions yang tersedia di EPP Client TypeScript.

## Table of Contents

- [Launch Extension (RFC 8334)](#launch-extension-rfc-8334)
- [TMCH Extension](#tmch-extension)
- [Fee Extension (RFC 8748)](#fee-extension-rfc-8748)
- [RGP Extension (RFC 3915)](#rgp-extension-rfc-3915)

---

## Launch Extension (RFC 8334)

Launch Extension menyediakan support untuk launch phases dalam new gTLD programs.

### Launch Phases

```typescript
type LaunchPhase = 
  | 'sunrise'      // Trademark holders priority period
  | 'landrush'     // Limited availability period
  | 'claims'       // Claims notice period
  | 'open'         // General availability
  | 'custom';      // Registry-specific custom phase
```

### Sunrise Registration

Sunrise period memungkinkan trademark holders untuk mendaftar domain sebelum general availability.

**Requirements:**
- Valid Signed Mark Data (SMD) dari TMCH
- Trademark validation
- Application ID

**Example:**

```typescript
import { LaunchCreateRequest, SignedMarkData } from 'epp-client';

// SMD dari TMCH
const smd: SignedMarkData = {
  encodedSignedMark: 'PD94bW...', // Base64 encoded SMD
};

const launchCreate: LaunchCreateRequest = {
  phase: { name: 'sunrise' },
  applicationId: 'sunrise-app-12345',
  smd: smd
};

// Create domain dengan launch extension
await client.domainCreate({
  name: 'trademark-domain.com',
  period: { unit: 'y', value: 1 },
  registrant: 'contact-id',
  contacts: [
    { type: 'admin', id: 'admin-contact' },
    { type: 'tech', id: 'tech-contact' }
  ],
  authInfo: { pw: 'auth-code' }
  // Launch extension akan ditambahkan
});
```

### Claims Registration

Claims period memerlukan acknowledgment dari claims notice.

**Requirements:**
- Claims notice ID
- Notice acceptance date
- Notice expiration date

**Example:**

```typescript
import { LaunchNotice } from 'epp-client';

// Claims notice dari TMCH lookup
const notice: LaunchNotice = {
  noticeID: 'claim-notice-12345',
  notAfter: '2024-12-31T23:59:59Z',
  acceptedDate: '2024-01-15T10:30:00Z'
};

const launchCreate: LaunchCreateRequest = {
  phase: { name: 'claims' },
  notice: notice
};

await client.domainCreate({
  name: 'example.com',
  period: { unit: 'y', value: 1 },
  registrant: 'contact-id',
  contacts: [
    { type: 'admin', id: 'admin-contact' }
  ],
  authInfo: { pw: 'auth-code' }
});
```

### Landrush Registration

Landrush adalah first-come, first-served registration dengan limited availability.

```typescript
const launchCreate: LaunchCreateRequest = {
  phase: { name: 'landrush' },
  applicationId: 'landrush-app-67890'
};
```

### Launch Check

Check domain availability dalam specific launch phase:

```typescript
import { LaunchCheckRequest } from 'epp-client';

const checkRequest: LaunchCheckRequest = {
  phase: { name: 'sunrise' },
  names: ['example.com', 'example.net']
};

// Check akan return availability per phase
```

### Launch Info

Retrieve launch phase information dari domain:

```typescript
// Domain info akan include launch extension data jika applicable
const info = await client.domainInfo('example.com');

// Launch info structure:
// - phase: Current launch phase
// - applicationId: Application tracking ID
// - status: Application status
```

---

## TMCH Extension

Trademark Clearinghouse (TMCH) extension untuk trademark protection dan validation.

### TMCH Components

#### Signed Mark Data (SMD)

SMD adalah digitally signed trademark data dari TMCH.

```typescript
interface TmchSMD {
  id: string;                    // SMD ID (format: YYYYMMDD-XXXXXX-XXXX)
  encodedSignedMark: string;     // Base64 encoded SMD
  notBefore?: string;            // Validity start date
  notAfter?: string;             // Expiration date
}
```

**SMD Validation:**

```typescript
import { isValidSMDFormat, isTmchMarkExpired } from 'epp-client';

// Validate SMD format
if (!isValidSMDFormat('20240115-000001-0001')) {
  console.error('Invalid SMD format');
}

// Check expiration
if (isTmchMarkExpired('2024-01-01T00:00:00Z')) {
  console.error('SMD has expired');
}
```

#### Trademark Mark

```typescript
interface TmchMark {
  markName: string;              // Trademark name
  id: string;                    // Mark identifier
  type: TmchMarkType;            // trademark | treatyOrStatute | court
  registrationNumber?: string;   // Registration number
  registrationDate?: string;     // Registration date
  expirationDate?: string;       // Expiration date
  jurisdiction?: string;         // ISO 3166-1 country code
  goodsAndServices?: string[];   // Nice classification classes
}
```

**Mark Types:**

```typescript
type TmchMarkType = 
  | 'trademark'        // Registered trademark
  | 'treatyOrStatute'  // Protected by treaty/statute
  | 'court';           // Court-validated mark
```

#### Claims Notice

Claims notice dikirim ketika domain name matches trademark dalam TMCH database.

```typescript
interface TmchClaimsNotice {
  id: string;                    // Notice ID
  notAfter: string;              // Notice expiration
  acceptedDate?: string;         // User acceptance date
  claims?: TmchClaim[];          // List of matching claims
}

interface TmchClaim {
  markName: string;              // Trademark name
  jurisdiction: string;          // Jurisdiction
  goodsAndServices: string[];    // Goods/services covered
  claimKey?: string;             // Claim verification key
}
```

**Claims Processing:**

```typescript
import { isValidNoticeID } from 'epp-client';

// Validate notice ID format
if (!isValidNoticeID('claim-notice-12345')) {
  console.error('Invalid notice ID');
}

// Display claims to user for acknowledgment
claimsNotice.claims?.forEach(claim => {
  console.log(`Trademark: ${claim.markName}`);
  console.log(`Jurisdiction: ${claim.jurisdiction}`);
  console.log(`Covers: ${claim.goodsAndServices.join(', ')}`);
});
```

### Nice Classification

TMCH menggunakan Nice Classification untuk categorize goods/services (classes 1-45).

```typescript
import { isValidNiceClass } from 'epp-client';

// Validate Nice class number
if (isValidNiceClass(35)) {
  console.log('Valid Nice class: Advertising; Business management');
}

if (!isValidNiceClass(46)) {
  console.error('Invalid Nice class (valid: 1-45)');
}
```

---

## Fee Extension (RFC 8748)

Fee Extension menyediakan standardized way untuk query dan communicate fee information.

### Fee Commands

```typescript
type FeeCommand = 
  | 'create'       // Domain creation fee
  | 'renew'        // Renewal fee
  | 'transfer'     // Transfer fee
  | 'restore'      // Restore fee (from redemption)
  | 'update';      // Update fee
```

### Fee Structure

```typescript
interface Fee {
  fee: string;                   // Fee amount (decimal string)
  description?: string;          // Fee description
  refundable?: boolean;          // Is fee refundable?
  gracePeriod?: string;          // ISO 8601 duration (e.g., 'P5D' = 5 days)
  applied?: 'immediate' | 'delayed'; // When fee is applied
}
```

### Check Domain Fees

Query fees sebelum perform operation:

```typescript
import { FeeExtCheckRequest } from 'epp-client';

// Check create fees
const feeCheck: FeeExtCheckRequest = {
  domain: 'example.com',
  command: 'create',
  period: { unit: 'y', value: 1 },
  currency: 'USD'
};

// Result will include:
// - Fee breakdown
// - Total amount
// - Currency
// - Refundable status
```

### Fee Breakdown Example

```typescript
import { calculateTotalFees } from 'epp-client';

const fees: Fee[] = [
  {
    fee: '10.00',
    description: 'Registration',
    refundable: false
  },
  {
    fee: '0.18',
    description: 'ICANN Fee',
    refundable: false
  },
  {
    fee: '5.00',
    description: 'Setup Fee',
    refundable: true,
    gracePeriod: 'P5D' // Refundable within 5 days
  }
];

// Calculate total
const total = calculateTotalFees(fees); // 15.18
```

### Currency Support

Fee Extension support multi-currency pricing:

```typescript
import { isValidCurrencyCode } from 'epp-client';

// Validate ISO 4217 currency code
if (isValidCurrencyCode('USD')) {
  console.log('Valid currency: US Dollar');
}

if (isValidCurrencyCode('EUR')) {
  console.log('Valid currency: Euro');
}

if (!isValidCurrencyCode('XXX')) {
  console.error('Invalid currency code');
}
```

### Fee Operations

#### Create with Fees

```typescript
import { FeeCreateRequest } from 'epp-client';

const feeCreate: FeeCreateRequest = {
  currency: 'USD',
  fee: [
    { fee: '10.00', description: 'Registration' },
    { fee: '0.18', description: 'ICANN Fee' }
  ]
};
```

#### Renew with Fees

```typescript
import { FeeRenewRequest } from 'epp-client';

const feeRenew: FeeRenewRequest = {
  currency: 'USD',
  period: { unit: 'y', value: 2 },
  fee: [
    { fee: '24.00', description: '2 Year Renewal' }
  ]
};
```

#### Transfer with Fees

```typescript
import { FeeTransferRequest } from 'epp-client';

const feeTransfer: FeeTransferRequest = {
  currency: 'USD',
  period: { unit: 'y', value: 1 }, // Additional year
  fee: [
    { fee: '12.00', description: 'Transfer + 1 Year' }
  ]
};
```

#### Restore with Fees

Restore dari redemption period:

```typescript
import { FeeRestoreRequest } from 'epp-client';

const feeRestore: FeeRestoreRequest = {
  currency: 'USD',
  fee: [
    { fee: '80.00', description: 'Redemption Restore' },
    { fee: '12.00', description: '1 Year Renewal' }
  ]
};
```

### Grace Period Parsing

```typescript
import { parseGracePeriod } from 'epp-client';

// Parse ISO 8601 duration
const days = parseGracePeriod('P5D');   // 5 days
const hours = parseGracePeriod('PT1H'); // 1 hour (converted to days)
```

### Fee Amount Formatting

```typescript
import { parseFeeAmount, formatFeeAmount } from 'epp-client';

// Parse fee amount
const amount = parseFeeAmount('10.50'); // 10.5

// Format fee amount
const formatted = formatFeeAmount(10.5); // "10.50"
```

---

## RGP Extension (RFC 3915)

Registry Grace Period (RGP) extension untuk manage domain lifecycle grace periods.

### RGP Status Types

```typescript
type RgpStatus = 
  | 'addPeriod'           // Add Grace Period (typically 5 days after creation)
  | 'autoRenewPeriod'     // Auto-Renew Grace Period (typically 45 days)
  | 'renewPeriod'         // Renew Grace Period (typically 5 days after renewal)
  | 'transferPeriod'      // Transfer Grace Period (typically 5 days after transfer)
  | 'redemptionPeriod'    // Redemption Grace Period (30 days after deletion)
  | 'pendingRestore'      // Pending restore (restore requested)
  | 'pendingDelete';      // Pending delete (5 days before final deletion)
```

### Grace Period Timeline

```
Domain Created
    ↓
┌───────────────────────────────────────────────┐
│ Add Grace Period (5 days)                     │
│ - Can delete domain with full refund          │
└───────────────────────────────────────────────┘
    ↓
Active Registration
    ↓
Domain Deleted
    ↓
┌───────────────────────────────────────────────┐
│ Redemption Grace Period (30 days)             │
│ - Domain can be restored (with fee)           │
│ - Must submit restore request + report        │
└───────────────────────────────────────────────┘
    ↓
┌───────────────────────────────────────────────┐
│ Pending Delete (5 days)                       │
│ - Final deletion pending                       │
│ - Cannot be restored                           │
└───────────────────────────────────────────────┘
    ↓
Permanently Deleted
```

### Grace Period Configuration

```typescript
import { GracePeriodConfig, DEFAULT_GRACE_PERIODS } from 'epp-client';

// Default ICANN grace periods
const config: GracePeriodConfig = {
  addPeriod: 5,           // 5 days
  renewPeriod: 5,         // 5 days
  autoRenewPeriod: 45,    // 45 days
  transferPeriod: 5,      // 5 days
  redemptionPeriod: 30,   // 30 days
  pendingDelete: 5        // 5 days
};
```

### Check Grace Period Status

```typescript
import { 
  isInGracePeriod,
  isInRedemption,
  isPendingDelete,
  canRestore 
} from 'epp-client';

// Check if in any grace period
if (isInGracePeriod('addPeriod')) {
  console.log('Domain is in Add Grace Period');
  console.log('Can delete with full refund');
}

// Check if in redemption
if (isInRedemption('redemptionPeriod')) {
  console.log('Domain can be restored');
}

// Check if restore is allowed
if (canRestore('redemptionPeriod')) {
  console.log('Submit restore request');
}

// Check if pending delete
if (isPendingDelete('pendingDelete')) {
  console.log('⚠️  Final deletion imminent - cannot restore');
}
```

### Calculate Grace Period Dates

```typescript
import { 
  calculateGracePeriodEnd,
  isWithinGracePeriod,
  getRemainingGracePeriodDays 
} from 'epp-client';

const createDate = new Date('2024-01-15T10:00:00Z');
const currentDate = new Date();

// Calculate end date
const endDate = calculateGracePeriodEnd(createDate, 5);
console.log(`Add Grace Period ends: ${endDate.toISOString()}`);

// Check if still within grace period
if (isWithinGracePeriod(createDate, currentDate, 5)) {
  console.log('Still within grace period');
  
  // Get remaining days
  const remaining = getRemainingGracePeriodDays(createDate, currentDate, 5);
  console.log(`${remaining} days remaining`);
}
```

### Domain Restore

Domain dalam redemption period dapat di-restore dengan submit restore request dan report.

#### Step 1: Submit Restore Request

```typescript
import { RgpUpdateRequest } from 'epp-client';

const restoreRequest: RgpUpdateRequest = {
  restore: {
    op: 'request'
  }
};

await client.domainUpdate('example.com', restoreRequest);
```

#### Step 2: Submit Restore Report

Setelah request approved, submit restore report:

```typescript
import { RgpRestoreReport, validateRestoreReport } from 'epp-client';

const report: RgpRestoreReport = {
  preData: '2024-01-01T00:00:00Z',     // Pre-delete registration date
  postData: '2024-01-15T10:00:00Z',    // Post-restore registration date
  delTime: '2024-01-10T00:00:00Z',     // Deletion date
  resTime: '2024-01-12T00:00:00Z',     // Restore request date
  
  resReason: 'Domain was deleted by mistake. The registrant needs to maintain their online presence for business operations.',
  
  statement: [
    {
      text: 'This domain was accidentally deleted. We have implemented new procedures to prevent similar incidents.',
      lang: 'en'
    },
    {
      text: 'The registrant has confirmed they want to restore the domain and continue using it.',
      lang: 'en'
    }
  ],
  
  other: 'The domain hosts the registrant\'s primary business website with active email services.'
};

// Validate report before submission
const validation = validateRestoreReport(report);
if (!validation.valid) {
  console.error('Report validation failed:');
  validation.errors.forEach(error => console.error('-', error));
} else {
  // Submit report
  const reportRequest: RgpUpdateRequest = {
    restore: {
      op: 'report',
      report: report
    }
  };
  
  await client.domainUpdate('example.com', reportRequest);
}
```

### Restore Report Requirements

Required fields dalam restore report:

1. **preData**: Registration date before deletion
2. **postData**: Expected registration date after restore
3. **delTime**: When domain was deleted
4. **resTime**: When restore was requested
5. **resReason**: Detailed reason for restore (minimum length)
6. **statement**: At least one statement explaining circumstances

Optional fields:
- **other**: Additional relevant information

### RGP Info Response

Domain info dapat include RGP status:

```typescript
interface RgpInfo {
  rgpStatus: RgpStatusInfo[];
}

interface RgpStatusInfo {
  s: RgpStatus;              // RGP status type
  lang?: string;             // Language
  message?: string;          // Optional status message
}
```

### RGP Poll Messages

Registry dapat send poll messages untuk RGP events:

```typescript
interface RgpPollMessage {
  name: string;              // Domain name
  rgpStatus: RgpStatus;      // Current RGP status
  reqDate?: string;          // Request date
  reportDueDate?: string;    // Report submission deadline
}
```

---

## Extension Namespaces

XML namespaces untuk each extension:

```typescript
// Launch Extension
LAUNCH_NAMESPACE = 'urn:ietf:params:xml:ns:launch-1.0'

// TMCH Extension
TMCH_NAMESPACE = 'urn:ietf:params:xml:ns:tmch-1.0'

// Fee Extension
FEE_NAMESPACE = 'urn:ietf:params:xml:ns:epp:fee-1.0'
FEE_NAMESPACE_0_11 = 'urn:ietf:params:xml:ns:epp:fee-0.11'

// RGP Extension
RGP_NAMESPACE = 'urn:ietf:params:xml:ns:rgp-1.0'
```

---

## Best Practices

### 1. Sunrise Registration

- ✅ Validate SMD format dan expiration sebelum submission
- ✅ Keep SMD files secure
- ✅ Track application IDs
- ✅ Handle priority conflicts gracefully

### 2. Claims Processing

- ✅ Display claims notice to users completely
- ✅ Require explicit user acknowledgment
- ✅ Respect notice expiration dates
- ✅ Keep claims notice records

### 3. Fee Management

- ✅ Always check fees before operations
- ✅ Display fee breakdowns to users
- ✅ Handle multi-currency scenarios
- ✅ Track refundable fees dan grace periods

### 4. Grace Period Management

- ✅ Monitor grace period expiration dates
- ✅ Set up automated reminders
- ✅ Prepare restore reports in advance if needed
- ✅ Track grace period fee implications

### 5. Error Handling

```typescript
try {
  await client.domainCreate({
    name: 'example.com',
    // ... with extensions
  });
} catch (error) {
  if (error.code === 2302) {
    console.error('Domain already exists');
  } else if (error.code === 2304) {
    console.error('Operation prohibited by status');
  } else {
    console.error('Operation failed:', error.message);
  }
}
```

---

## RFC References

- **RFC 8334**: Launch Phase Mapping for EPP
- **RFC 8748**: EPP Fee Extension
- **RFC 3915**: Domain Registry Grace Period Mapping for EPP
- **RFC 5730**: EPP Core Protocol
- **RFC 5731**: EPP Domain Mapping

## See Also

- [RFC Documentation](./RFC_DOCUMENTATION.md)
- [Extension Examples](../examples/epp-extensions.ts)
- [Complete Domain Registration](../examples/complete-domain-registration.ts)
