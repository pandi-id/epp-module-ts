/**
 * Public types and helpers of the EPP mappings (RFC 5730-5733) and
 * extensions (RFC 3915, 5910, 7848, 8334, 8495, 8590, 8748, 8807, 9361).
 */

export type {
  AuthInfo,
  ChangePollData,
  CommandOptions,
  DataCollectionPolicy,
  EppConfig,
  EppLogger,
  EppResponse,
  EppResult,
  Greeting,
  LoginOptions,
  LoginSecEvent,
  MessageQueue,
  ObjectStatus,
  PendingActionResult,
  Period,
  PeriodInput,
  PollMessageData,
  ResponseExtensions,
  StatusInput,
  TransactionIds,
  TransferOp,
  TransferStatus,
  UserAgent,
} from './Common';

export type {
  DomainAddRemove,
  DomainCheckOptions,
  DomainCheckResult,
  DomainContact,
  DomainCreateRequest,
  DomainCreateResult,
  DomainDeleteOptions,
  DomainInfo,
  DomainInfoOptions,
  DomainRenewRequest,
  DomainRenewResult,
  DomainRestoreOptions,
  DomainTransferRequest,
  DomainTransferResult,
  DomainUpdateRequest,
  HostAttr,
  IpAddress,
  NameServer,
  NameServerInput,
} from './Domain';

export type {
  ContactAddress,
  ContactCheckResult,
  ContactCreateRequest,
  ContactCreateResult,
  ContactDisclose,
  ContactDiscloseInfo,
  ContactInfo,
  ContactInfoOptions,
  ContactPhone,
  ContactPostalInfo,
  ContactPostalInfoChange,
  ContactTransferRequest,
  ContactTransferResult,
  ContactUpdateRequest,
  DiscloseTypes,
  PostalInfoType,
} from './Contact';

export type {
  HostAddRemove,
  HostAddress,
  HostCheckResult,
  HostCreateRequest,
  HostCreateResult,
  HostInfo,
  HostUpdateRequest,
} from './Host';

export type { DnssecCreate, DnssecInfo, DnssecUpdate, DsData, KeyData } from './Dnssec';
export { DNSSEC_ALGORITHMS, DNSSEC_DIGEST_TYPES, validateDsData, validateKeyData } from './Dnssec';

export type {
  LaunchCheck,
  LaunchCheckData,
  LaunchCheckResult,
  LaunchClaimKey,
  LaunchCodeMark,
  LaunchCreate,
  LaunchCreateData,
  LaunchIdContainer,
  LaunchInfoData,
  LaunchInfoRequest,
  LaunchNotice,
  LaunchPhase,
  LaunchStatus,
} from './Launch';
export { isValidLaunchPhase, isValidLaunchStatus, LAUNCH_NAMESPACE } from './Launch';

export type {
  SmdFile,
  TmchClaim,
  TmchClaimsCheckRequest,
  TmchClaimsCheckResult,
  TmchClaimsNotice,
  TmchContact,
  TmchContactType,
  TmchDocument,
  TmchDocumentType,
  TmchHolder,
  TmchMark,
  TmchMarkType,
  TmchSMD,
  TmchSunriseApplication,
  TmchValidationResult,
} from './Tmch';
export {
  computeTcnChecksum,
  extractEncodedSmd,
  isTmchMarkExpired,
  isValidNiceClass,
  isValidNoticeID,
  isValidSMDFormat,
  MARK_NAMESPACE,
  parseSmdFile,
  SIGNED_MARK_NAMESPACE,
  verifyTcnId,
} from './Tmch';

export type {
  Fee,
  FeeCheckCommand,
  FeeCheckData,
  FeeCheckExtension,
  FeeCheckItem,
  FeeCheckRequest,
  FeeCommand,
  FeeCommandName,
  FeeCommandResult,
  FeeCredit,
  FeeCurrency,
  FeePeriod,
  FeeSubmission,
  FeeTransformData,
} from './Fee';
export { calculateTotalFees, FEE_NAMESPACE, formatFeeAmount, isValidCurrencyCode, parseFeeAmount, parseGracePeriod, sumFeeAmounts } from './Fee';

export type { GracePeriodConfig, RgpInfo, RgpRequestType, RgpRestoreReport, RgpStatement, RgpStatus, RgpStatusInfo } from './Rgp';
export {
  calculateGracePeriodEnd,
  canRestore,
  DEFAULT_GRACE_PERIODS,
  getRemainingGracePeriodDays,
  isInGracePeriod,
  isInRedemption,
  isPendingDelete,
  isWithinGracePeriod,
  RGP_NAMESPACE,
  validateRestoreReport,
} from './Rgp';
