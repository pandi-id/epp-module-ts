/**
 * EPP Types Index
 * 
 * Mengexport semua TypeScript types untuk EPP Client
 * Berdasarkan RFC 5730-5734 (EPP Protocol Standards)
 */

// Common Types (RFC 5730)
export type {
  EppConfig,
  EppResponse,
  EppError,
  SessionOptions,
  FeeCheckRequest,
  Period,
  AuthInfo,
  PollRequest,
  PollMessage,
  PollResponse
} from './Common';

// Domain Types (RFC 5731)
export type {
  DomainCheckRequest,
  DomainCheckResult,
  DomainCreateRequest,
  DomainUpdateRequest,
  DomainRenewRequest,
  DomainTransferRequest,
  DomainInfo,
  DomainContact,
  NameServer,
  IpAddress
} from './Domain';

// Contact Types (RFC 5733)
export type {
  ContactCreateRequest,
  ContactUpdateRequest,
  ContactCheckResult,
  ContactTransferRequest,
  ContactInfo,
  ContactPostalInfo,
  ContactAddress,
  ContactDisclose,
  PostalInfoType
} from './Contact';

// Host Types (RFC 5732)
export type {
  HostCreateRequest,
  HostUpdateRequest,
  HostCheckRequest,
  HostCheckResult,
  HostInfo,
  HostAddress
} from './Host';

// DNSSEC Types (RFC 5910)
export type {
  DsData,
  KeyData,
  DnssecCreate,
  DnssecUpdate,
  DnssecInfo
} from './Dnssec';

export {
  DNSSEC_ALGORITHMS,
  DNSSEC_DIGEST_TYPES,
  validateDsData,
  validateKeyData
} from './Dnssec';

// EPP Launch Extension (RFC 8334)
export type {
  LaunchPhase,
  LaunchStatus,
  LaunchNotice,
  SignedMarkData,
  LaunchCreateRequest,
  LaunchCheckRequest,
  LaunchCheckResult,
  LaunchInfo,
  LaunchUpdateRequest,
  LaunchDeleteRequest,
  TradeMark
} from './Launch';

export {
  LAUNCH_NAMESPACE,
  isValidLaunchPhase,
  isValidLaunchStatus
} from './Launch';

// EPP TMCH Extension
export type {
  TmchMarkType,
  TmchMark,
  TmchHolder,
  TmchContact,
  TmchClaimsNotice,
  TmchSMD,
  TmchValidationResult
} from './Tmch';

export {
  TMCH_NAMESPACE,
  isValidSMDFormat,
  isValidNoticeID,
  isTmchMarkExpired,
  isValidNiceClass
} from './Tmch';

// EPP Fee Extension (RFC 8748)
export type {
  FeeCommand,
  Fee,
  FeeCheckRequest as FeeExtCheckRequest,
  FeeCheckResult as FeeExtCheckResult,
  FeeInfo,
  FeeCreateRequest,
  FeeRenewRequest,
  FeeTransferRequest,
  FeeUpdateRequest,
  FeeRestoreRequest,
  FeeDeleteResponse,
  FeeCredit,
  FeeBalance
} from './Fee';

export {
  FEE_NAMESPACE,
  FEE_NAMESPACE_0_11,
  isValidCurrencyCode,
  parseFeeAmount,
  formatFeeAmount,
  calculateTotalFees,
  parseGracePeriod
} from './Fee';

// EPP RGP Extension (RFC 3915)
export type {
  RgpStatus,
  RgpRequestType,
  RgpReportType,
  RgpStatusInfo,
  RgpUpdateRequest,
  RgpRestoreReport,
  RgpStatement,
  RgpInfo,
  RgpPollMessage,
  GracePeriodConfig
} from './Rgp';

export {
  RGP_NAMESPACE,
  DEFAULT_GRACE_PERIODS,
  isInGracePeriod,
  isInRedemption,
  isPendingDelete,
  canRestore,
  calculateGracePeriodEnd,
  isWithinGracePeriod,
  getRemainingGracePeriodDays,
  validateRestoreReport
} from './Rgp';
