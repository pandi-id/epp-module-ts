import type { ConnectionOptions, SecureVersion } from 'tls';
import type { XmlElement } from '../xml/XmlWriter';
import type { ContactInfo, ContactTransferResult } from './Contact';
import type { DnssecInfo } from './Dnssec';
import type { DomainCreateResult, DomainInfo, DomainRenewResult, DomainTransferResult } from './Domain';
import type { FeeCheckData, FeeTransformData } from './Fee';
import type { HostInfo } from './Host';
import type { LaunchCheckData, LaunchCreateData, LaunchInfoData } from './Launch';
import type { RgpInfo } from './Rgp';

/**
 * Receives debug output. XML passed to it has passwords and authorization
 * codes replaced with `***`.
 */
export interface EppLogger {
  debug(message: string): void;
  warn?(message: string): void;
}

/** Client software description sent with the loginSec extension (RFC 8807 Section 4.1). */
export interface UserAgent {
  /** Client application, e.g. "my-registrar-backend 2.3.1". */
  app?: string;
  /** Technology used, e.g. "Node.js v22.16.0". */
  tech?: string;
  /** Operating system, e.g. "Linux 6.8". */
  os?: string;
}

/** EPP client configuration. */
export interface EppConfig {
  /** EPP server hostname (RFC 5734 Section 2). */
  host: string;
  /** TCP port. Defaults to 700, the port IANA assigned to EPP (RFC 5734 Section 7). */
  port?: number;
  /** Client identifier sent as `<clID>` (3-16 characters, RFC 5730 Section 2.9.1.1). */
  username: string;
  /**
   * Password. RFC 5730 limits `<pw>` to 6-16 characters; a longer password is
   * sent through the loginSec extension (RFC 8807) when the server offers it.
   */
  password: string;
  /** Response language requested at login. Defaults to "en". */
  lang?: string;
  /** Protocol version requested at login. Defaults to "1.0". */
  version?: string;
  /** Milliseconds to wait for each response. Defaults to 30000. */
  timeout?: number;
  /** Milliseconds to wait for the TLS handshake and server greeting. Defaults to `timeout`. */
  connectTimeout?: number;
  /** Log redacted frames and connection events to the console (or `logger`). */
  debug?: boolean;
  /** Destination for debug output. Setting it enables debug logging. */
  logger?: EppLogger;

  /** Client certificate for mutual TLS (RFC 5734 Section 9). */
  clientCert?: string | Buffer;
  /** Private key of the client certificate. */
  clientKey?: string | Buffer;
  /** Passphrase of an encrypted private key. */
  passphrase?: string;
  /** CA certificates trusted for the server certificate. Defaults to Node's bundled roots. */
  ca?: string | Buffer | Array<string | Buffer>;
  /** Verify the server certificate chain. Defaults to true; keep it true in production. */
  rejectUnauthorized?: boolean;
  /** Verify that the certificate matches `servername`. Defaults to true. */
  checkServerIdentity?: boolean;
  /** Server name for SNI and certificate checks. Defaults to `host`. */
  servername?: string;
  /** Minimum TLS version. Defaults to "TLSv1.2". */
  minVersion?: SecureVersion;
  /** Maximum TLS version. */
  maxVersion?: SecureVersion;
  /** OpenSSL cipher list. */
  ciphers?: string;
  /** Extra options passed to `tls.connect()`, applied last. */
  tlsOptions?: ConnectionOptions;

  /**
   * Object URIs to announce at login. Defaults to the domain, contact and host
   * mappings that the server lists in its greeting.
   */
  objURIs?: string[];
  /**
   * Extension URIs to announce at login, replacing negotiation. Defaults to
   * the extensions this client implements that the server lists in its
   * greeting.
   */
  extURIs?: string[];
  /**
   * Further extension URIs, such as registry-specific extensions sent with
   * the `extensions` command option, announced at login in addition to the
   * negotiated ones when the server's greeting lists them.
   */
  additionalExtURIs?: string[];
  /**
   * User agent sent with loginSec when the server supports it. Defaults to
   * this library and the Node.js version; `false` sends none.
   */
  userAgent?: UserAgent | false;
  /**
   * Send `<hello>` after this many idle milliseconds to keep the session
   * open. 0 (the default) disables keep-alive.
   */
  keepAliveInterval?: number;
  /**
   * Reconnect and log in again before the next command when the connection
   * was lost after a successful login. A command that was in flight when the
   * connection dropped is not retried. Defaults to false.
   */
  autoReconnect?: boolean;
  /** Largest data unit accepted from the server, in bytes. Defaults to 10 MiB. */
  maxFrameSize?: number;
  /** Prefix of generated client transaction IDs. Defaults to "EPPTS". */
  clTRIDPrefix?: string;
  /** Custom `<clTRID>` generator. Values must be 3-64 characters. */
  generateClTRID?: () => string;
}

/** Options for {@link EppClient.login}. */
export interface LoginOptions {
  /** Change the password as part of login (`<newPW>`). */
  newPassword?: string;
  /** Object URIs to announce, overriding the negotiated defaults. */
  objURIs?: string[];
  /** Extension URIs to announce, overriding the negotiated defaults. */
  extURIs?: string[];
  /** Further extension URIs to announce when the server offers them. */
  additionalExtURIs?: string[];
}

/** Options accepted by every command. */
export interface CommandOptions {
  /**
   * Extra extension elements for registry-specific extensions, appended to
   * the command's `<extension>`. Build them with `el()`. Each element must
   * declare its namespace (for example `{ 'xmlns:ext': 'urn:example:ext-1.0' }`),
   * and that namespace must have been announced at login, which
   * `additionalExtURIs` arranges.
   */
  extensions?: XmlElement[];
}

/** One `<result>` of a response (RFC 5730 Section 2.6). */
export interface EppResult {
  code: number;
  message: string;
  lang?: string;
  /** Inner XML of each `<value>` element: the client data that caused an error. */
  values: string[];
  /** Each `<extValue>`: offending client data plus the server's reason. */
  extValues: Array<{ value: string; reason: string; lang?: string }>;
}

/** Message queue information of a response (RFC 5730 Section 2.6). */
export interface MessageQueue {
  /** Message identifier, used to acknowledge the message. */
  id: string;
  /** Number of messages in the queue. */
  count: number;
  /** Date the message was enqueued. */
  qDate?: string;
  /** Message text. */
  message?: string;
  /** Inner XML of `<msg>` when it contains elements. */
  messageXml?: string;
  lang?: string;
}

/** Extension data parsed from a response's `<extension>` element. */
export interface ResponseExtensions {
  /** RFC 5910 `<secDNS:infData>`. */
  secDNS?: DnssecInfo;
  /** RFC 3915 `<rgp:infData>` or `<rgp:upData>`. */
  rgp?: RgpInfo;
  /** RFC 8334 `<launch:chkData>`. */
  launchCheck?: LaunchCheckData;
  /** RFC 8334 `<launch:infData>`. */
  launchInfo?: LaunchInfoData;
  /** RFC 8334 `<launch:creData>`. */
  launchCreate?: LaunchCreateData;
  /** RFC 8748 `<fee:chkData>`. */
  feeCheck?: FeeCheckData;
  /** RFC 8748 `<fee:creData>`, `<fee:renData>`, `<fee:trnData>`, `<fee:updData>` or `<fee:delData>`. */
  fee?: FeeTransformData;
  /** RFC 8807 `<loginSec:loginSecData>` events. */
  loginSec?: LoginSecEvent[];
  /** RFC 8590 `<changePoll:changeData>`. */
  changePoll?: ChangePollData;
  /** RFC 8495 allocation token returned by an info command. */
  allocationToken?: string;
  /** Outer XML of extension elements this client does not interpret. */
  unknown?: string[];
}

/** A parsed EPP response. */
export interface EppResponse<T = undefined> {
  /** True when the (first) result code is 1xxx. */
  success: boolean;
  /** Code of the first result. */
  code: number;
  /** Message of the first result. */
  message: string;
  /** All results. Errors may carry several (RFC 5730 Section 2.6). */
  results: EppResult[];
  /** Command-specific data parsed from `<resData>`. */
  data?: T;
  /** Parsed extension data. */
  extensions: ResponseExtensions;
  /** Present when the server has queued messages (RFC 5730 Section 2.6). */
  msgQ?: MessageQueue;
  clTRID?: string;
  svTRID?: string;
  /** The raw response document, unredacted. */
  xml: string;
}

/** Server greeting (RFC 5730 Section 2.4). */
export interface Greeting {
  svID: string;
  svDate: string;
  versions: string[];
  languages: string[];
  objURIs: string[];
  extURIs: string[];
  dcp?: DataCollectionPolicy;
}

/** Data collection policy announced in the greeting (RFC 5730 Section 2.4). */
export interface DataCollectionPolicy {
  access: string;
  statements: Array<{ purpose: string[]; recipient: string[]; retention: string }>;
  expiry?: { absolute?: string; relative?: string };
}

/** Registration period (RFC 5731 Section 3.2.1). */
export interface Period {
  /** 1-99. */
  value: number;
  /** Years or months. */
  unit: 'y' | 'm';
}

/** A period object, or a number of years. */
export type PeriodInput = Period | number;

/** Password-based authorization information. */
export interface AuthInfo {
  pw: string;
  /** Repository object ID of the contact whose authorization info is given. */
  roid?: string;
}

/** An object status with its optional language and reason text. */
export interface ObjectStatus {
  s: string;
  lang?: string;
  reason?: string;
}

/** A status value, or a status with a reason. */
export type StatusInput = string | ObjectStatus;

/** Transfer operation (RFC 5730 Section 2.9.3.4). */
export type TransferOp = 'request' | 'query' | 'approve' | 'reject' | 'cancel';

/** Transfer status (RFC 5730 eppcom:trStatusType). */
export type TransferStatus =
  | 'clientApproved'
  | 'clientCancelled'
  | 'clientRejected'
  | 'pending'
  | 'serverApproved'
  | 'serverCancelled';

/** Client and server transaction identifiers. */
export interface TransactionIds {
  clTRID?: string;
  svTRID?: string;
}

/**
 * Pending action notification (`<panData>`), delivered through the poll
 * queue when an action that returned 1001 completes.
 */
export interface PendingActionResult {
  /** Domain name, host name or contact ID. */
  name: string;
  /** Whether the pending action succeeded. */
  paResult: boolean;
  /** Transaction IDs of the command that started the action. */
  paTRID: TransactionIds;
  paDate: string;
}

/** RFC 8807 security event reported at login. */
export interface LoginSecEvent {
  type: 'password' | 'certificate' | 'cipher' | 'tlsProtocol' | 'newPW' | 'stat' | 'custom' | string;
  level: 'warning' | 'error' | string;
  name?: string;
  exDate?: string;
  value?: string;
  duration?: string;
  lang?: string;
  message?: string;
}

/** RFC 8590 change poll data: what changed an object, and why. */
export interface ChangePollData {
  state: 'before' | 'after';
  operation: string;
  /** Sub-operation, for example "purge" for a custom operation. */
  op?: string;
  date: string;
  svTRID: string;
  who: string;
  caseId?: { id: string; type: 'udrp' | 'urs' | 'custom' | string; name?: string };
  reason?: string;
}

/** Message payload of a poll response, keyed by the `<resData>` element. */
export type PollMessageData =
  | { type: 'domain:trnData'; value: DomainTransferResult }
  | { type: 'domain:panData'; value: PendingActionResult }
  | { type: 'domain:infData'; value: DomainInfo }
  | { type: 'domain:creData'; value: DomainCreateResult }
  | { type: 'domain:renData'; value: DomainRenewResult }
  | { type: 'contact:trnData'; value: ContactTransferResult }
  | { type: 'contact:panData'; value: PendingActionResult }
  | { type: 'contact:infData'; value: ContactInfo }
  | { type: 'host:panData'; value: PendingActionResult }
  | { type: 'host:infData'; value: HostInfo }
  | { type: 'unknown'; namespace: string; element: string; xml: string };
