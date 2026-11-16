import type { AuthInfo, CommandOptions, ObjectStatus, StatusInput, TransferOp, TransferStatus } from './Common';

/** Internationalized ("int", 7-bit ASCII) or localized ("loc") postal info (RFC 5733 Section 2.4). */
export type PostalInfoType = 'int' | 'loc';

/** Postal address (RFC 5733 Section 2.4). */
export interface ContactAddress {
  /** Up to three street lines. */
  street?: string[];
  city: string;
  /** State or province. */
  sp?: string;
  /** Postal code. */
  pc?: string;
  /** Two-letter ISO 3166-1 country code. */
  cc: string;
}

/** Postal information (RFC 5733 Section 2.4). */
export interface ContactPostalInfo {
  type: PostalInfoType;
  name: string;
  org?: string;
  addr: ContactAddress;
}

/** Postal information change: every field except `type` is optional. */
export interface ContactPostalInfoChange {
  type: PostalInfoType;
  name?: string;
  org?: string;
  addr?: ContactAddress;
}

/**
 * Telephone number in E.164 format ("+1.7035555555"), optionally with an
 * extension. An empty string clears the number in an update.
 */
export type ContactPhone = string | { number: string; ext?: string };

/** Postal info types a disclose preference applies to. */
export type DiscloseTypes = PostalInfoType | PostalInfoType[] | { type: PostalInfoType };

/**
 * Disclosure preference (RFC 5733 Section 2.9). `flag` 0/false asks the
 * server not to disclose the listed elements; 1/true asks it to disclose them.
 */
export interface ContactDisclose {
  flag: boolean | 0 | 1;
  name?: DiscloseTypes;
  org?: DiscloseTypes;
  addr?: DiscloseTypes;
  voice?: boolean;
  fax?: boolean;
  email?: boolean;
}

/** Disclosure preference as returned by the server. */
export interface ContactDiscloseInfo {
  flag: boolean;
  name: PostalInfoType[];
  org: PostalInfoType[];
  addr: PostalInfoType[];
  voice: boolean;
  fax: boolean;
  email: boolean;
}

/** Result of a contact check (RFC 5733 Section 3.1.1). */
export interface ContactCheckResult {
  id: string;
  available: boolean;
  reason?: string;
}

/** Options for a contact info command (RFC 5733 Section 3.1.2). */
export interface ContactInfoOptions extends CommandOptions {
  authInfo?: string | AuthInfo;
}

/** Contact data returned by an info command (RFC 5733 Section 3.1.2). */
export interface ContactInfo {
  id: string;
  roid: string;
  status: string[];
  statusDetails: ObjectStatus[];
  postalInfo: ContactPostalInfo[];
  voice?: string;
  voiceExt?: string;
  fax?: string;
  faxExt?: string;
  email: string;
  clID: string;
  crID: string;
  crDate: string;
  upID?: string;
  upDate?: string;
  trDate?: string;
  authInfo?: AuthInfo;
  disclose?: ContactDiscloseInfo;
}

/** Contact create (RFC 5733 Section 3.2.1). */
export interface ContactCreateRequest extends CommandOptions {
  /** Contact ID, 3-16 characters. */
  id: string;
  /** One or two postal info elements (one "int" and/or one "loc"). */
  postalInfo: ContactPostalInfo | ContactPostalInfo[];
  voice?: ContactPhone;
  fax?: ContactPhone;
  email: string;
  authInfo: AuthInfo;
  disclose?: ContactDisclose;
}

/** Result of a contact create. */
export interface ContactCreateResult {
  id: string;
  crDate: string;
}

/** Contact update (RFC 5733 Section 3.2.5). */
export interface ContactUpdateRequest extends CommandOptions {
  id: string;
  add?: { status: StatusInput[] };
  rem?: { status: StatusInput[] };
  chg?: {
    postalInfo?: ContactPostalInfoChange | ContactPostalInfoChange[];
    voice?: ContactPhone;
    fax?: ContactPhone;
    email?: string;
    authInfo?: AuthInfo;
    disclose?: ContactDisclose;
  };
}

/** Contact transfer (RFC 5733 Section 3.2.4). */
export interface ContactTransferRequest extends CommandOptions {
  id: string;
  op: TransferOp;
  authInfo?: AuthInfo;
}

/** Transfer data returned for a contact (RFC 5733 Section 3.1.3). */
export interface ContactTransferResult {
  id: string;
  trStatus: TransferStatus;
  reID: string;
  reDate: string;
  acID: string;
  acDate: string;
}
