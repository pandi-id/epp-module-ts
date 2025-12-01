# EPP Extensions Quick Reference

Quick reference guide untuk EPP Extensions di EPP Client TypeScript.

## 📦 Import Extensions

```typescript
import {
  // Launch Extension
  LaunchPhase,
  LaunchCreateRequest,
  LaunchNotice,
  SignedMarkData,
  LAUNCH_NAMESPACE,
  isValidLaunchPhase,
  
  // TMCH Extension
  TmchMark,
  TmchSMD,
  TmchClaimsNotice,
  TMCH_NAMESPACE,
  isValidSMDFormat,
  isTmchMarkExpired,
  isValidNiceClass,
  
  // Fee Extension
  FeeExtCheckRequest,
  FeeCreateRequest,
  Fee,
  FEE_NAMESPACE,
  isValidCurrencyCode,
  calculateTotalFees,
  
  // RGP Extension
  RgpStatus,
  RgpUpdateRequest,
  RgpRestoreReport,
  RGP_NAMESPACE,
  isInRedemption,
  canRestore,
  validateRestoreReport,
  getRemainingGracePeriodDays
} from 'epp-client';
```

---

## 🚀 Launch Extension (RFC 8334)

### Sunrise Registration

```typescript
// SMD dari TMCH
const smd: SignedMarkData = {
  encodedSignedMark: 'PD94bW...' // Base64 encoded SMD
};

const launchCreate: LaunchCreateRequest = {
  phase: { name: 'sunrise' },
  applicationId: 'sunrise-12345',
  smd: smd
};

// Validate phase
if (isValidLaunchPhase('sunrise')) {
  // Create domain dengan launch extension
}
```

### Claims Registration

```typescript
const notice: LaunchNotice = {
  noticeID: 'claim-12345',
  notAfter: '2024-12-31T23:59:59Z',
  acceptedDate: '2024-01-15T10:30:00Z'
};

const launchCreate: LaunchCreateRequest = {
  phase: { name: 'claims' },
  notice: notice
};
```

### Landrush Registration

```typescript
const launchCreate: LaunchCreateRequest = {
  phase: { name: 'landrush' },
  applicationId: 'landrush-67890'
};
```

---

## 🏷️ TMCH Extension

### Validate SMD

```typescript
const smd: TmchSMD = {
  id: '20240115-000001-0001',
  encodedSignedMark: 'base64...',
  notAfter: '2025-01-01T00:00:00Z'
};

// Check format
if (isValidSMDFormat(smd.id)) {
  console.log('✓ Valid SMD format');
}

// Check expiration
if (!isTmchMarkExpired(smd.notAfter)) {
  console.log('✓ SMD not expired');
}
```

### Process Claims Notice

```typescript
const claimsNotice: TmchClaimsNotice = {
  id: 'notice-12345',
  notAfter: '2024-12-31T23:59:59Z',
  claims: [
    {
      markName: 'EXAMPLE',
      jurisdiction: 'US',
      goodsAndServices: ['Class 35', 'Class 42']
    }
  ]
};

// Display to user and get acknowledgment
```

### Validate Nice Class

```typescript
if (isValidNiceClass(35)) {
  console.log('✓ Valid Nice class');
}
```

---

## 💰 Fee Extension (RFC 8748)

### Check Fees

```typescript
const feeCheck: FeeExtCheckRequest = {
  domain: 'example.com',
  command: 'create',
  period: { unit: 'y', value: 1 },
  currency: 'USD'
};

// Validate currency
if (isValidCurrencyCode('USD')) {
  // Proceed with fee check
}
```

### Calculate Total Fees

```typescript
const fees: Fee[] = [
  { fee: '10.00', description: 'Registration' },
  { fee: '0.18', description: 'ICANN Fee' },
  { fee: '5.00', description: 'Setup', refundable: true }
];

const total = calculateTotalFees(fees);
console.log(`Total: $${total.toFixed(2)}`);
```

### Create with Fees

```typescript
const feeCreate: FeeCreateRequest = {
  currency: 'USD',
  fee: [
    { fee: '10.00', description: 'Registration' }
  ]
};
```

### Renew with Fees

```typescript
const feeRenew: FeeRenewRequest = {
  currency: 'USD',
  period: { unit: 'y', value: 2 },
  fee: [
    { fee: '24.00', description: '2 Year Renewal' }
  ]
};
```

---

## ⏰ RGP Extension (RFC 3915)

### Check Grace Period Status

```typescript
const status: RgpStatus = 'redemptionPeriod';

// Check if in redemption
if (isInRedemption(status)) {
  console.log('⚠️  Domain in redemption period');
  
  // Check if can restore
  if (canRestore(status)) {
    console.log('✓ Domain can be restored');
  }
}

// Check if in any grace period
if (isInGracePeriod(status)) {
  console.log('Domain in grace period');
}

// Check if pending delete
if (isPendingDelete(status)) {
  console.log('❌ Pending delete - cannot restore');
}
```

### Calculate Grace Period

```typescript
const createDate = new Date('2024-01-15');
const currentDate = new Date();
const graceDays = 5;

// Get remaining days
const remaining = getRemainingGracePeriodDays(
  createDate,
  currentDate,
  graceDays
);

console.log(`${remaining} days remaining`);

// Calculate end date
const endDate = calculateGracePeriodEnd(createDate, graceDays);
console.log(`Grace period ends: ${endDate.toISOString()}`);

// Check if within period
if (isWithinGracePeriod(createDate, currentDate, graceDays)) {
  console.log('✓ Still within grace period');
}
```

### Submit Restore Request

```typescript
// Step 1: Request restore
const restoreRequest: RgpUpdateRequest = {
  restore: { op: 'request' }
};

// Step 2: Submit restore report
const report: RgpRestoreReport = {
  preData: '2024-01-01T00:00:00Z',
  postData: '2024-01-15T10:00:00Z',
  delTime: '2024-01-10T00:00:00Z',
  resTime: '2024-01-12T00:00:00Z',
  resReason: 'Domain was deleted by mistake...',
  statement: [
    {
      text: 'We have implemented new procedures...',
      lang: 'en'
    }
  ]
};

// Validate report
const validation = validateRestoreReport(report);
if (validation.valid) {
  // Submit report
  const reportRequest: RgpUpdateRequest = {
    restore: {
      op: 'report',
      report: report
    }
  };
  console.log('✓ Report validated');
} else {
  console.error('Validation errors:', validation.errors);
}
```

---

## 📊 Common Patterns

### Combined Extension Usage

```typescript
// Check fees first
const fees = await checkDomainFees(client, 'example.com');
const total = calculateTotalFees(fees);

// Validate SMD
if (isValidSMDFormat(smd.id) && !isTmchMarkExpired(smd.notAfter)) {
  // Create sunrise registration
  const result = await client.domainCreate({
    name: 'example.com',
    period: { unit: 'y', value: 1 },
    registrant: 'contact-id',
    contacts: [
      { type: 'admin', id: 'admin-id' }
    ],
    authInfo: { pw: 'auth-code' }
  });
  
  // Monitor grace period
  const createDate = new Date();
  const remaining = getRemainingGracePeriodDays(
    createDate,
    new Date(),
    5
  );
  console.log(`Add grace period: ${remaining} days remaining`);
}
```

---

## 🎯 Quick Validation Checklist

### Sunrise Registration
- [ ] SMD format valid (`isValidSMDFormat()`)
- [ ] SMD not expired (`!isTmchMarkExpired()`)
- [ ] Application ID provided
- [ ] Phase is 'sunrise'

### Claims Registration
- [ ] Notice ID valid (`isValidNoticeID()`)
- [ ] Notice not expired
- [ ] User acknowledged claims
- [ ] Accepted date recorded

### Fee Operations
- [ ] Currency code valid (`isValidCurrencyCode()`)
- [ ] Fees calculated (`calculateTotalFees()`)
- [ ] Refundable status clear
- [ ] Grace period noted

### Domain Restore
- [ ] Status is 'redemptionPeriod'
- [ ] Can restore (`canRestore()`)
- [ ] Report validated (`validateRestoreReport()`)
- [ ] All required fields present
- [ ] Date order correct

---

## 📝 Status Codes Reference

### Launch Status
- `received` - Application received
- `pendingValidation` - Pending trademark validation
- `validated` - Validation successful
- `invalid` - Validation failed
- `pendingAllocation` - Pending domain allocation
- `allocated` - Domain allocated
- `rejected` - Application rejected
- `custom` - Registry-specific status

### RGP Status
- `addPeriod` - 5 days after creation
- `renewPeriod` - 5 days after renewal
- `autoRenewPeriod` - 45 days after auto-renew
- `transferPeriod` - 5 days after transfer
- `redemptionPeriod` - 30 days after deletion
- `pendingRestore` - Restore requested
- `pendingDelete` - 5 days before final deletion

---

## 🔗 Grace Period Timeline

```
Created → Add GP (5d) → Active
Renewed → Renew GP (5d) → Active
Auto-Renewed → Auto-Renew GP (45d) → Active
Transferred → Transfer GP (5d) → Active
Deleted → Redemption GP (30d) → Pending Delete (5d) → Purged
```

---

## 📚 Documentation Links

- **[Complete Extensions Guide](./EPP_EXTENSIONS.md)**: Comprehensive documentation
- **[Extension Examples](../examples/epp-extensions.ts)**: Practical examples
- **[Implementation Summary](./EXTENSIONS_IMPLEMENTATION_SUMMARY.md)**: Technical details
- **[RFC Documentation](./RFC_DOCUMENTATION.md)**: RFC references

---

## 🔥 Common Use Cases

### 1. Premium Sunrise Domain

```typescript
// 1. Validate SMD
if (isValidSMDFormat(smd.id) && !isTmchMarkExpired(smd.notAfter)) {
  // 2. Check fees
  const fees = calculateTotalFees([...]);
  
  // 3. Register
  await client.domainCreate({...});
  
  // 4. Monitor grace period
  const remaining = getRemainingGracePeriodDays(...);
}
```

### 2. Claims Domain with Fees

```typescript
// 1. Get claims notice
const notice = {...};

// 2. Check fees
const feeCheck: FeeExtCheckRequest = {...};

// 3. User acknowledges claims
// 4. Register with fees
const launchCreate: LaunchCreateRequest = {
  phase: { name: 'claims' },
  notice: notice
};
```

### 3. Restore Deleted Domain

```typescript
// 1. Check status
if (isInRedemption(status) && canRestore(status)) {
  // 2. Check restore fees
  const fees = calculateTotalFees([...]);
  
  // 3. Request restore
  await client.domainUpdate(domain, {
    restore: { op: 'request' }
  });
  
  // 4. Submit report
  const report: RgpRestoreReport = {...};
  if (validateRestoreReport(report).valid) {
    await client.domainUpdate(domain, {
      restore: { op: 'report', report }
    });
  }
}
```

---

## ⚠️ Important Notes

1. **SMD Security**: Keep SMD files secure, they contain cryptographic signatures
2. **Claims Acknowledgment**: Always display full claims notice to users
3. **Fee Currency**: Validate currency codes before operations
4. **Grace Periods**: Monitor expiration dates to avoid data loss
5. **Restore Reports**: Maintain comprehensive records for restore operations
6. **Nice Classification**: Valid classes are 1-45 only
7. **Notice Expiration**: Check notice expiration before submission
8. **Date Formats**: Use ISO 8601 format for all dates

---

## 🆘 Troubleshooting

### SMD Validation Fails
```typescript
if (!isValidSMDFormat(smd.id)) {
  // Check format: YYYYMMDD-XXXXXX-XXXX
  // Example: 20240115-000001-0001
}
```

### Currency Not Valid
```typescript
if (!isValidCurrencyCode(code)) {
  // Use ISO 4217 codes: USD, EUR, GBP, etc.
}
```

### Restore Report Invalid
```typescript
const validation = validateRestoreReport(report);
if (!validation.valid) {
  validation.errors.forEach(error => {
    console.error('-', error);
  });
}
```

### Grace Period Expired
```typescript
const remaining = getRemainingGracePeriodDays(...);
if (remaining <= 0) {
  console.error('Grace period has expired');
}
```

---

## 📞 Support

For detailed information, refer to:
- RFC 8334 (Launch Extension)
- RFC 8748 (Fee Extension)
- RFC 3915 (RGP Extension)
- ICANN TMCH Documentation
