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
