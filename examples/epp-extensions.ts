/**
 * EPP Extensions Example
 * 
 * Contoh penggunaan EPP Extensions:
 * - Launch Extension (RFC 8334)
 * - TMCH Extension
 * - Fee Extension (RFC 8748)
 * - RGP Extension (RFC 3915)
 * 
 * Note: This is a demonstration file showing type usage.
 * Actual EPP client integration would require additional implementation.
 */

import {
  // Launch Extension
  LaunchPhase,
  LaunchCreateRequest,
  SignedMarkData,
  LaunchNotice,
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
  Fee,
  FeeCommand,
  FEE_NAMESPACE,
  isValidCurrencyCode,
  calculateTotalFees,
  formatFeeAmount,
  
  // RGP Extension
  RgpStatus,
  RgpUpdateRequest,
  RgpRestoreReport,
  RGP_NAMESPACE,
  isInRedemption,
  canRestore,
  validateRestoreReport,
  getRemainingGracePeriodDays,
  calculateGracePeriodEnd
} from '../src/types';

/**
 * =================================================================
 * LAUNCH EXTENSION EXAMPLES (RFC 8334)
 * =================================================================
 */

/**
 * Example 1: Sunrise Registration dengan SMD
 */
function sunriseRegistrationExample() {
  console.log('=== Sunrise Registration ===');
  
  // Validate phase
  if (!isValidLaunchPhase('sunrise')) {
    console.error('Invalid launch phase');
    return;
  }
  
  // SMD dari TMCH
  const smd: SignedMarkData = {
    encodedSignedMark: 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4...'
  };
  
  const launchCreate: LaunchCreateRequest = {
    phase: { name: 'sunrise' },
    signedMark: smd,
    type: 'application'
  };
  
  console.log('Launch phase:', launchCreate.phase.name);
  console.log('Type:', launchCreate.type);
  console.log('✓ Sunrise registration request prepared');
}

/**
 * Example 2: Claims Registration dengan Notice
 */
function claimsRegistrationExample() {
  console.log('\n=== Claims Registration ===');
  
  // Claims notice dari TMCH
  const notice: LaunchNotice = {
    noticeID: 'claim-notice-12345',
    notAfter: '2024-12-31T23:59:59Z',
    acceptedDate: '2024-01-15T10:30:00Z'
  };
  
  const launchCreate: LaunchCreateRequest = {
    phase: { name: 'claims' },
    notice: notice
  };
  
  console.log('Notice ID:', notice.noticeID);
  console.log('Expires:', notice.notAfter);
  console.log('✓ Claims registration request prepared');
}

/**
 * Example 3: Landrush Registration
 */
function landrushRegistrationExample() {
  console.log('\n=== Landrush Registration ===');
  
  const launchCreate: LaunchCreateRequest = {
    phase: { name: 'landrush' },
    type: 'registration'
  };
  
  console.log('Phase:', launchCreate.phase.name);
  console.log('✓ Landrush registration request prepared');
}

/**
 * =================================================================
 * TMCH EXTENSION EXAMPLES
 * =================================================================
 */

/**
 * Example 4: Validate TMCH SMD
 */
function validateTmchSmdExample() {
  console.log('\n=== TMCH SMD Validation ===');
  
  const smd: TmchSMD = {
    id: '20240115-000001-0001',
    issuer: 'TMCH',
    encodedSignedMark: 'base64_encoded_smd...',
    notBefore: '2024-01-15T00:00:00Z',
    notAfter: '2030-01-15T00:00:00Z'
  };
  
  // Validate format
  if (!isValidSMDFormat(smd.id)) {
    console.error('❌ Invalid SMD format');
    return;
  }
  console.log('✓ Valid SMD format:', smd.id);
  
  // Check expiration
  if (isTmchMarkExpired(smd.notAfter)) {
    console.error('❌ SMD has expired');
    return;
  }
  console.log('✓ SMD not expired');
}

/**
 * Example 5: Process TMCH Claims Notice
 */
function processTmchClaimsNoticeExample() {
  console.log('\n=== TMCH Claims Notice Processing ===');
  
  const claimsNotice: TmchClaimsNotice = {
    id: '2024-01-15T10:30:45.123Z-abc12345',
    notAfter: '2024-12-31T23:59:59Z',
    acceptedDate: '2024-01-15T10:00:00Z',
    label: 'example',
    claims: [
      {
        markName: 'EXAMPLE',
        jurisdiction: 'US',
        goodsAndServices: 'Class 35: Advertising services'
      }
    ]
  };
  
  console.log('Notice ID:', claimsNotice.id);
  console.log('Expires:', claimsNotice.notAfter);
  console.log('Claims:', claimsNotice.claims?.length || 0);
  
  claimsNotice.claims?.forEach((claim, index) => {
    console.log(`  Claim ${index + 1}: ${claim.markName} (${claim.jurisdiction})`);
  });
  
  console.log('✓ Claims notice processed');
}

/**
 * Example 6: Validate Nice Classification
 */
function validateNiceClassExample() {
  console.log('\n=== Nice Classification Validation ===');
  
  const classes = [35, 42, 100]; // 100 is invalid
  
  classes.forEach(cls => {
    if (isValidNiceClass(cls)) {
      console.log(`✓ Class ${cls} is valid`);
    } else {
      console.log(`❌ Class ${cls} is invalid (valid: 1-45)`);
    }
  });
}

/**
 * =================================================================
 * FEE EXTENSION EXAMPLES (RFC 8748)
 * =================================================================
 */

/**
 * Example 7: Check Domain Fees
 */
function checkDomainFeesExample() {
  console.log('\n=== Domain Fees Check ===');
  
  // Validate currency
  if (!isValidCurrencyCode('USD')) {
    console.error('Invalid currency code');
    return;
  }
  
  const fees: Fee[] = [
    { fee: '10.00', description: 'Registration' },
    { fee: '0.18', description: 'ICANN Fee' },
    { fee: '5.00', description: 'Setup Fee', refundable: true, gracePeriod: 'P5D' }
  ];
  
  const total = calculateTotalFees(fees);
  
  console.log('Fee breakdown:');
  fees.forEach(fee => {
    const refundable = fee.refundable ? ' (refundable)' : '';
    console.log(`  - ${fee.description}: $${fee.fee}${refundable}`);
  });
  
  console.log(`Total: $${formatFeeAmount(total)} USD`);
  console.log('✓ Fees calculated');
}

/**
 * Example 8: Multi-Currency Fees
 */
function multiCurrencyExample() {
  console.log('\n=== Multi-Currency Fees ===');
  
  const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
  
  currencies.forEach(currency => {
    if (isValidCurrencyCode(currency)) {
      console.log(`✓ ${currency} is valid currency`);
    } else {
      console.log(`❌ ${currency} is invalid currency`);
    }
  });
}

/**
 * =================================================================
 * RGP EXTENSION EXAMPLES (RFC 3915)
 * =================================================================
 */

/**
 * Example 9: Check RGP Status
 */
function checkRgpStatusExample() {
  console.log('\n=== RGP Status Check ===');
  
  const statuses: RgpStatus[] = [
    'addPeriod',
    'redemptionPeriod',
    'pendingDelete'
  ];
  
  statuses.forEach(status => {
    console.log(`\nStatus: ${status}`);
    
    if (isInRedemption(status)) {
      console.log('  ⚠️  Domain in redemption period');
      if (canRestore(status)) {
        console.log('  ✓ Can be restored');
      }
    } else {
      console.log('  ℹ️  Not in redemption');
    }
  });
}

/**
 * Example 10: Calculate Grace Period
 */
function calculateGracePeriodExample() {
  console.log('\n=== Grace Period Calculation ===');
  
  const createDate = new Date('2024-01-15T10:00:00Z');
  const currentDate = new Date('2024-01-17T10:00:00Z');
  const graceDays = 5;
  
  const endDate = calculateGracePeriodEnd(createDate, graceDays);
  const remaining = getRemainingGracePeriodDays(createDate, currentDate, graceDays);
  
  console.log('Created:', createDate.toISOString());
  console.log('Grace period ends:', endDate.toISOString());
  console.log('Days remaining:', remaining);
  console.log('✓ Grace period calculated');
}

/**
 * Example 11: Validate Restore Report
 */
function validateRestoreReportExample() {
  console.log('\n=== Restore Report Validation ===');
  
  const report: RgpRestoreReport = {
    preData: '2024-01-01T00:00:00Z',
    postData: '2024-01-15T10:00:00Z',
    delTime: '2024-01-10T00:00:00Z',
    resTime: '2024-01-12T00:00:00Z',
    resReason: 'Domain was deleted by mistake. The registrant needs to maintain their online presence.',
    statement: [
      {
        text: 'We have implemented new procedures to prevent similar incidents.',
        lang: 'en'
      }
    ]
  };
  
  const validation = validateRestoreReport(report);
  
  if (validation.valid) {
    console.log('✓ Restore report is valid');
  } else {
    console.log('❌ Restore report validation failed:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }
}

/**
 * =================================================================
 * COMBINED EXAMPLES
 * =================================================================
 */

/**
 * Example 12: Complete Sunrise Registration Workflow
 */
function completeSunriseWorkflow() {
  console.log('\n=== Complete Sunrise Registration Workflow ===');
  
  // Step 1: Validate SMD
  console.log('\n1. Validating SMD...');
  const smdId = '20240115-000001-0001';
  if (!isValidSMDFormat(smdId)) {
    console.error('Invalid SMD format');
    return;
  }
  console.log('✓ SMD format valid');
  
  // Step 2: Check expiration
  console.log('\n2. Checking expiration...');
  const expirationDate = '2030-12-31T23:59:59Z';
  if (isTmchMarkExpired(expirationDate)) {
    console.error('SMD expired');
    return;
  }
  console.log('✓ SMD not expired');
  
  // Step 3: Calculate fees
  console.log('\n3. Calculating fees...');
  if (!isValidCurrencyCode('USD')) {
    console.error('Invalid currency');
    return;
  }
  
  const fees: Fee[] = [
    { fee: '150.00', description: 'Sunrise Registration' },
    { fee: '0.18', description: 'ICANN Fee' }
  ];
  
  const total = calculateTotalFees(fees);
  console.log(`Total: $${formatFeeAmount(total)} USD`);
  
  // Step 4: Create launch request
  console.log('\n4. Preparing launch request...');
  const launchCreate: LaunchCreateRequest = {
    phase: { name: 'sunrise' },
    signedMark: {
      encodedSignedMark: 'base64_smd_data...'
    },
    type: 'application'
  };
  
  console.log('✓ Launch request prepared');
  
  // Step 5: Calculate grace periods
  console.log('\n5. Grace period information:');
  const createDate = new Date();
  const addGraceEnd = calculateGracePeriodEnd(createDate, 5);
  console.log(`Add Grace Period ends: ${addGraceEnd.toISOString()}`);
  
  console.log('\n✓ Complete workflow validated successfully');
}

/**
 * =================================================================
 * MAIN FUNCTION
 * =================================================================
 */

function main() {
  console.log('='.repeat(60));
  console.log('EPP EXTENSIONS EXAMPLES');
  console.log('='.repeat(60));
  
  // Launch Extension
  sunriseRegistrationExample();
  claimsRegistrationExample();
  landrushRegistrationExample();
  
  // TMCH Extension
  validateTmchSmdExample();
  processTmchClaimsNoticeExample();
  validateNiceClassExample();
  
  // Fee Extension
  checkDomainFeesExample();
  multiCurrencyExample();
  
  // RGP Extension
  checkRgpStatusExample();
  calculateGracePeriodExample();
  validateRestoreReportExample();
  
  // Combined Example
  completeSunriseWorkflow();
  
  console.log('\n' + '='.repeat(60));
  console.log('All examples completed successfully!');
  console.log('='.repeat(60));
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  sunriseRegistrationExample,
  claimsRegistrationExample,
  landrushRegistrationExample,
  validateTmchSmdExample,
  processTmchClaimsNoticeExample,
  validateNiceClassExample,
  checkDomainFeesExample,
  multiCurrencyExample,
  checkRgpStatusExample,
  calculateGracePeriodExample,
  validateRestoreReportExample,
  completeSunriseWorkflow
};
