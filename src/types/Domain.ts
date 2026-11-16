import type {
  AuthInfo,
  CommandOptions,
  ObjectStatus,
  PeriodInput,
  StatusInput,
  TransferOp,
  TransferStatus,
} from './Common';
import type { DnssecCreate, DnssecUpdate } from './Dnssec';
import type { FeeCheckExtension, FeeSubmission } from './Fee';
import type { LaunchCheck, LaunchCreate, LaunchIdContainer, LaunchInfoRequest } from './Launch';
import type { RgpRestoreReport } from './Rgp';

/** IP address of a name server. `type` is detected from the address when omitted. */
export interface IpAddress {
  ip: string;
  type?: 'v4' | 'v6';
}

/** Name server given as attributes rather than a host object (RFC 5731 Section 1.1). */
export interface HostAttr {
  hostName: string;
  hostAddr?: Array<IpAddress | string>;
}

/**
 * Name servers of a domain (RFC 5731 Section 1.1): host object names, or
 * host attributes, depending on the registry's host model.
 */
export interface NameServer {
  hostObj?: string[];
  hostAttr?: HostAttr[];
}

/** Name servers, or a plain list of host object names. */
export type NameServerInput = NameServer | string[];

/** A contact linked to a domain. */
export interface DomainContact {
  type: 'admin' | 'tech' | 'billing';
  id: string;
}

/** Result of a domain check (RFC 5731 Section 3.1.1). */
export interface DomainCheckResult {
  name: string;
  available: boolean;
  reason?: string;
}

/** Options for a domain check. */
export interface DomainCheckOptions extends CommandOptions {
  /** RFC 8748 fee check. */
  fee?: FeeCheckExtension;
  /** RFC 8334 claims, availability or trademark check. */
  launch?: LaunchCheck;
  /** RFC 8495 allocation token. */
  allocationToken?: string;
}

/** Options for a domain info command (RFC 5731 Section 3.1.2). */
export interface DomainInfoOptions extends CommandOptions {
  /** Authorization info, needed to see full data of a domain sponsored by another registrar. */
  authInfo?: string | AuthInfo;
  /** Which hosts to return: all (default), delegated, subordinate or none. */
  hosts?: 'all' | 'del' | 'sub' | 'none';
  /** RFC 8334 launch application or registration info. */
  launch?: LaunchInfoRequest;
  /** RFC 8495: ask the server to return the domain's allocation token. */
  allocationToken?: boolean;
}

/** Domain data returned by an info command (RFC 5731 Section 3.1.2). */
export interface DomainInfo {
  name: string;
  roid: string;
  /** Status values, e.g. ["ok"] or ["clientHold", "serverTransferProhibited"]. */
  status: string[];
  /** Status values with their language and reason text. */
  statusDetails: ObjectStatus[];
  registrant?: string;
  contacts: DomainContact[];
  ns?: NameServer;
  /** Subordinate host names. */
  hosts: string[];
  clID: string;
  crID?: string;
  crDate?: string;
  upID?: string;
  upDate?: string;
  exDate?: string;
  trDate?: string;
  /** Returned only to the sponsoring registrar, or with valid authorization info. */
  authInfo?: AuthInfo;
}

/**
 * Domain create (RFC 5731 Section 3.2.1). Only `name` and `authInfo` are
 * required by the protocol; registry policy decides what else is needed.
 */
export interface DomainCreateRequest extends CommandOptions {
  name: string;
  period?: PeriodInput;
  ns?: NameServerInput;
  registrant?: string;
  contacts?: DomainContact[];
  authInfo: AuthInfo;
  /** RFC 5910 DNSSEC data. */
  dnssec?: DnssecCreate;
  /** RFC 8334 launch phase data: sunrise SMD, claims notice acceptance, and so on. */
  launch?: LaunchCreate;
  /** RFC 8748 fee the client agrees to pay. */
  fee?: FeeSubmission;
  /** RFC 8495 allocation token. */
  allocationToken?: string;
}

/** Result of a domain create. */
export interface DomainCreateResult {
  name: string;
  crDate: string;
  exDate?: string;
}

/** Elements added to or removed from a domain. */
export interface DomainAddRemove {
  ns?: NameServerInput;
  contacts?: DomainContact[];
  /** Up to 11 status values. Clients may only set the client* statuses. */
  status?: StatusInput[];
}

/** Domain update (RFC 5731 Section 3.2.5). */
export interface DomainUpdateRequest extends CommandOptions {
  name: string;
  add?: DomainAddRemove;
  rem?: DomainAddRemove;
  chg?: {
    /** New registrant. An empty string removes the registrant. */
    registrant?: string;
    /** New authorization info, or `{ null: true }` to remove it (RFC 9154). */
    authInfo?: AuthInfo | { null: true };
  };
  /** RFC 5910 DNSSEC changes. */
  dnssec?: DnssecUpdate;
  /** RFC 8334: update a launch application. */
  launch?: LaunchIdContainer;
  /** RFC 8748 fee the client agrees to pay. */
  fee?: FeeSubmission;
  /** RFC 8495 allocation token. */
  allocationToken?: string;
}

/** Domain renew (RFC 5731 Section 3.2.3). */
export interface DomainRenewRequest extends CommandOptions {
  name: string;
  /**
   * Current expiration date, as a date (YYYY-MM-DD), a dateTime (the date
   * part in UTC is used), or a Date.
   */
  curExpDate: string | Date;
  period?: PeriodInput;
  /** RFC 8748 fee the client agrees to pay. */
  fee?: FeeSubmission;
}

/** Result of a domain renew. */
export interface DomainRenewResult {
  name: string;
  exDate?: string;
}

/** Domain transfer (RFC 5731 Section 3.2.4). */
export interface DomainTransferRequest extends CommandOptions {
  name: string;
  op: TransferOp;
  /** Period added to the registration on a transfer request. */
  period?: PeriodInput;
  authInfo?: AuthInfo;
  /** RFC 8748 fee the client agrees to pay (transfer request). */
  fee?: FeeSubmission;
  /** RFC 8495 allocation token. */
  allocationToken?: string;
}

/** Transfer data returned for a domain (RFC 5731 Section 3.1.3). */
export interface DomainTransferResult {
  name: string;
  trStatus: TransferStatus;
  /** Requesting client. */
  reID: string;
  reDate: string;
  /** Client that must act on the request. */
  acID: string;
  acDate: string;
  exDate?: string;
}

/** Options for a domain delete (RFC 5731 Section 3.2.2). */
export interface DomainDeleteOptions extends CommandOptions {
  /** RFC 8334: delete a launch application. */
  launch?: LaunchIdContainer;
}

/**
 * Options for a domain restore (RFC 3915 Section 4.2.5). Without `report`
 * this sends a restore request; with it, the restore report.
 */
export interface DomainRestoreOptions extends CommandOptions {
  report?: RgpRestoreReport;
  /** RFC 8748 fee the client agrees to pay for the restore. */
  fee?: FeeSubmission;
}
