import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { isIP } from 'net';
import * as tls from 'tls';
import type {
  CommandOptions,
  EppConfig,
  EppLogger,
  EppResponse,
  Greeting,
  LoginOptions,
  PollMessageData,
  UserAgent,
} from '../types/Common';
import type {
  ContactCheckResult,
  ContactCreateRequest,
  ContactCreateResult,
  ContactInfo,
  ContactInfoOptions,
  ContactTransferRequest,
  ContactTransferResult,
  ContactUpdateRequest,
} from '../types/Contact';
import type {
  DomainCheckOptions,
  DomainCheckResult,
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
} from '../types/Domain';
import type { FeeCheckCommand, FeeCheckData, FeeCheckRequest } from '../types/Fee';
import type { HostCheckResult, HostCreateRequest, HostCreateResult, HostInfo, HostUpdateRequest } from '../types/Host';
import type { XmlNode } from '../xml/XmlReader';
import type { XmlElement } from '../xml/XmlWriter';
import {
  buildContactCheck,
  buildContactCreate,
  buildContactDelete,
  buildContactInfo,
  buildContactTransfer,
  buildContactUpdate,
  parseContactCheck,
  parseContactCreate,
  parseContactInfo,
  parseContactTransfer,
} from '../mapping/Contact';
import {
  buildDomainCheck,
  buildDomainCreate,
  buildDomainDelete,
  buildDomainInfo,
  buildDomainRenew,
  buildDomainRestore,
  buildDomainTransfer,
  buildDomainUpdate,
  parseDomainCheck,
  parseDomainCreate,
  parseDomainInfo,
  parseDomainRenew,
  parseDomainTransfer,
} from '../mapping/Domain';
import { buildCommandXml, buildHelloXml } from '../mapping/Envelope';
import {
  buildHostCheck,
  buildHostCreate,
  buildHostDelete,
  buildHostInfo,
  buildHostUpdate,
  parseHostCheck,
  parseHostCreate,
  parseHostInfo,
} from '../mapping/Host';
import { ParsedResponse, parseEppDocument, parsePollData, parseResponse, toEppResponse } from '../mapping/Response';
import { buildLogin, buildLogout, buildPoll, parseGreeting } from '../mapping/Session';
import { asArray, CommandParts } from '../mapping/Shared';
import { EppCommandError, EppConnectionError, EppProtocolError, EppTimeoutError, EppValidationError } from './Errors';
import { DEFAULT_MAX_FRAME_SIZE, encodeFrame, FrameDecoder } from './Framing';
import { DEFAULT_OBJECT_URIS, NS, SUPPORTED_EXTENSION_URIS } from './Namespaces';
import { redactXml } from './Redact';
import { VERSION } from './Version';

interface Pending {
  resolve(xml: string): void;
  reject(error: Error): void;
}

interface ResolvedConfig extends EppConfig {
  port: number;
  lang: string;
  version: string;
  timeout: number;
  maxFrameSize: number;
  clTRIDPrefix: string;
}

/** Result codes after which the server ends the session (RFC 5730 Section 3). */
const SESSION_ENDING_CODES = [1500, 2500, 2501, 2502];

/**
 * EPP client over TLS/TCP (RFC 5730, RFC 5734).
 *
 * Commands are sent one at a time over a single connection; calls made
 * while another command is in flight are queued. Each command resolves with
 * an {@link EppResponse} for 1xxx result codes and rejects with an
 * {@link EppCommandError} for 2xxx codes.
 *
 * Events:
 * - `greeting` (greeting: Greeting): a greeting was received.
 * - `close` (): the connection closed.
 * - `reconnect` (): the client reconnected and logged in again (`autoReconnect`).
 *
 * @example
 * ```typescript
 * const client = new EppClient({
 *   host: 'epp.registry.example',
 *   username: 'registrar-id',
 *   password: 'secret',
 * });
 * await client.connect();
 * await client.login();
 * const { data } = await client.domainCheck(['example.com']);
 * await client.logout();
 * await client.disconnect();
 * ```
 */
export class EppClient extends EventEmitter {
  private readonly config: ResolvedConfig;
  private readonly logger: EppLogger | null;
  private socket: tls.TLSSocket | null = null;
  private decoder: FrameDecoder;
  private connected = false;
  private loggedIn = false;
  private greeting: Greeting | null = null;
  private services: { objURIs: string[]; extURIs: string[] } | null = null;
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private connecting: Promise<Greeting> | null = null;
  private reconnecting: Promise<void> | null = null;
  private lastLogin: LoginOptions | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private clTRIDCounter = 0;

  constructor(config: EppConfig) {
    super();
    if (!config || !config.host) throw new EppValidationError('config.host is required');
    if (!config.username) throw new EppValidationError('config.username is required');
    if (typeof config.password !== 'string') throw new EppValidationError('config.password is required');
    this.config = {
      ...config,
      port: config.port ?? 700,
      lang: config.lang ?? 'en',
      version: config.version ?? '1.0',
      timeout: config.timeout ?? 30000,
      maxFrameSize: config.maxFrameSize ?? DEFAULT_MAX_FRAME_SIZE,
      clTRIDPrefix: config.clTRIDPrefix ?? 'EPPTS',
    };
    if (!(this.config.timeout > 0)) throw new EppValidationError('config.timeout must be a positive number of milliseconds');
    if (!/^\S{1,32}$/.test(this.config.clTRIDPrefix)) {
      throw new EppValidationError('config.clTRIDPrefix must be 1-32 characters without spaces');
    }
    this.logger = config.logger ?? (config.debug ? consoleLogger : null);
    this.decoder = new FrameDecoder(this.config.maxFrameSize);
  }

  // ==========================================================================
  // Session (RFC 5730 Section 2.9.1, RFC 5734)
  // ==========================================================================

  /**
   * Open the TLS connection and wait for the server greeting (RFC 5734
   * Section 2). Resolves immediately when already connected.
   *
   * @throws {EppConnectionError} when the connection fails.
   * @throws {EppTimeoutError} when no greeting arrives within `connectTimeout`.
   */
  async connect(): Promise<Greeting> {
    if (this.connected && this.socket && this.greeting) return this.greeting;
    if (!this.connecting) {
      this.connecting = this.openConnection().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  /**
   * Log in (RFC 5730 Section 2.9.1.1), connecting first if needed.
   *
   * The object and extension services announced are those this client
   * supports that the server lists in its greeting, unless overridden by
   * `objURIs`/`extURIs`; `additionalExtURIs` adds registry-specific
   * extensions the server offers. Passwords longer than 16 characters are
   * sent with the loginSec extension (RFC 8807).
   *
   * Result codes: 1000 on success; 2200 authentication error, 2501
   * authentication error with the server closing the connection, 2307 an
   * announced service is not implemented.
   */
  async login(options: LoginOptions = {}): Promise<EppResponse> {
    const greeting = await this.connect();
    const offered = (uri: string) => greeting.extURIs.includes(uri);
    const objURIs = options.objURIs ?? this.config.objURIs ?? DEFAULT_OBJECT_URIS.filter((uri) => greeting.objURIs.includes(uri));
    const baseExtURIs = options.extURIs ?? this.config.extURIs ?? SUPPORTED_EXTENSION_URIS.filter(offered);
    const additional = [...(this.config.additionalExtURIs ?? []), ...(options.additionalExtURIs ?? [])].filter(
      (uri) => offered(uri) && !baseExtURIs.includes(uri),
    );
    const extURIs = [...baseExtURIs, ...new Set(additional)];
    if (objURIs.length === 0) {
      throw new EppValidationError(
        `The server offers none of the object services ${DEFAULT_OBJECT_URIS.join(', ')}; set objURIs to announce others`,
      );
    }
    const parts = buildLogin({
      clID: this.config.username,
      pw: this.config.password,
      newPW: options.newPassword,
      version: this.config.version,
      lang: this.config.lang,
      objURIs,
      extURIs,
      userAgent: this.userAgent(),
    });
    const response = await this.command(parts, undefined, { requireSession: false });
    this.loggedIn = true;
    this.services = { objURIs: [...objURIs], extURIs: [...extURIs] };
    if (options.newPassword !== undefined) this.config.password = options.newPassword;
    this.lastLogin = { objURIs: options.objURIs, extURIs: options.extURIs, additionalExtURIs: options.additionalExtURIs };
    for (const event of response.extensions.loginSec ?? []) {
      this.warn(`Login security ${event.level} (${event.type}${event.exDate ? `, expires ${event.exDate}` : ''})${event.message ? `: ${event.message}` : ''}`);
    }
    this.scheduleKeepAlive();
    return response;
  }

  /**
   * End the session (RFC 5730 Section 2.9.1.2). The server answers 1500 and
   * closes the connection.
   */
  async logout(): Promise<EppResponse> {
    this.lastLogin = null;
    const response = await this.command(buildLogout(), undefined, { requireSession: false });
    this.loggedIn = false;
    this.services = null;
    this.stopKeepAlive();
    return response;
  }

  /** Close the connection. Pending and queued commands fail with {@link EppConnectionError}. */
  async disconnect(): Promise<void> {
    this.stopKeepAlive();
    this.lastLogin = null;
    const socket = this.socket;
    if (!socket) {
      this.connected = false;
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => socket.destroy(), 5000);
      socket.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.end();
    });
  }

  /**
   * Send `<hello>` (RFC 5730 Section 2.3) and return the fresh greeting.
   * Also keeps an idle session alive.
   */
  async hello(): Promise<Greeting> {
    const raw = await this.exchange(buildHelloXml());
    const greeting = this.readGreeting(raw);
    this.greeting = greeting;
    this.emit('greeting', greeting);
    return greeting;
  }

  /**
   * Poll the message queue (RFC 5730 Section 2.9.2.3).
   *
   * `req` returns the oldest message: 1301 with `msgQ` and the message
   * payload in `data`, or 1300 when the queue is empty. `ack` removes the
   * message with the given ID.
   *
   * @example
   * ```typescript
   * const res = await client.poll('req');
   * if (res.code === 1301 && res.msgQ) {
   *   console.log(res.msgQ.message, res.data?.type);
   *   await client.poll('ack', res.msgQ.id);
   * }
   * ```
   */
  async poll(op: 'req' | 'ack' = 'req', msgID?: string): Promise<EppResponse<PollMessageData>> {
    return this.command(buildPoll(op, msgID), (parsed) => (parsed.resData ? parsePollData(parsed.resData) : undefined));
  }

  // ==========================================================================
  // Domain (RFC 5731)
  // ==========================================================================

  /**
   * Check domain availability (RFC 5731 Section 3.1.1). Supports the fee
   * (RFC 8748), launch claims (RFC 8334) and allocation token (RFC 8495)
   * extensions through `options`.
   */
  async domainCheck(names: string | string[], options: DomainCheckOptions = {}): Promise<EppResponse<DomainCheckResult[]>> {
    return this.command(buildDomainCheck(asArray(names), options), resData(NS.domain, 'chkData', parseDomainCheck));
  }

  /**
   * Retrieve domain data (RFC 5731 Section 3.1.2). DNSSEC, RGP and launch
   * data appear in `extensions`. Error 2303: object does not exist.
   *
   * @param options Info options, or the domain's authorization password.
   */
  async domainInfo(name: string, options: DomainInfoOptions | string = {}): Promise<EppResponse<DomainInfo>> {
    const opts = typeof options === 'string' ? { authInfo: options } : options;
    return this.command(buildDomainInfo(name, opts), resData(NS.domain, 'infData', parseDomainInfo));
  }

  /**
   * Create a domain (RFC 5731 Section 3.2.1), optionally with DNSSEC data,
   * launch phase data (sunrise SMD, claims notice), a fee and an allocation
   * token. Errors: 2302 object exists, 2306 parameter value policy error.
   */
  async domainCreate(request: DomainCreateRequest): Promise<EppResponse<DomainCreateResult>> {
    return this.command(buildDomainCreate(request), resData(NS.domain, 'creData', parseDomainCreate));
  }

  /**
   * Update a domain (RFC 5731 Section 3.2.5): name servers, contacts,
   * statuses, registrant, authorization info, and DNSSEC data.
   * Error 2304: object status prohibits operation.
   */
  async domainUpdate(request: DomainUpdateRequest): Promise<EppResponse> {
    return this.command(buildDomainUpdate(request));
  }

  /**
   * Renew a domain (RFC 5731 Section 3.2.3). `curExpDate` must match the
   * current expiration date. Error 2105: object is not eligible for renewal.
   */
  async domainRenew(request: DomainRenewRequest): Promise<EppResponse<DomainRenewResult>> {
    return this.command(buildDomainRenew(request), resData(NS.domain, 'renData', parseDomainRenew));
  }

  /**
   * Delete a domain (RFC 5731 Section 3.2.2). Registries with grace periods
   * answer 1001 and move the domain to redemption (RFC 3915).
   */
  async domainDelete(name: string, options: DomainDeleteOptions = {}): Promise<EppResponse> {
    return this.command(buildDomainDelete(name, options));
  }

  /**
   * Request, query, approve, reject or cancel a domain transfer (RFC 5731
   * Section 3.2.4). A request answers 1001 (action pending).
   */
  async domainTransfer(request: DomainTransferRequest): Promise<EppResponse<DomainTransferResult>> {
    return this.command(buildDomainTransfer(request), resData(NS.domain, 'trnData', parseDomainTransfer));
  }

  /**
   * Restore a domain in its redemption period (RFC 3915 Section 4.2.5).
   * Call without a report to request the restore; call again with `report`
   * to submit the restore report, as ICANN gTLD registries require.
   */
  async domainRestore(name: string, options: DomainRestoreOptions = {}): Promise<EppResponse> {
    return this.command(buildDomainRestore(name, options));
  }

  /**
   * Price domain commands with the fee extension (RFC 8748): a domain check
   * whose `data` is the fee information.
   *
   * @example
   * ```typescript
   * const { data } = await client.feeCheck({ domain: 'example.com', command: ['create', 'renew'], period: 1, currency: 'USD' });
   * ```
   */
  async feeCheck(request: FeeCheckRequest): Promise<EppResponse<FeeCheckData>> {
    const commands: FeeCheckCommand[] = asArray(request.command ?? 'create').map((command) => {
      const value: FeeCheckCommand = typeof command === 'string' ? { name: command } : { ...command };
      if (value.period === undefined && request.period !== undefined && ['create', 'renew', 'transfer'].includes(value.name)) {
        value.period = request.period;
      }
      return value;
    });
    const response = await this.domainCheck(asArray(request.domain), { fee: { currency: request.currency, commands } });
    return { ...response, data: response.extensions.feeCheck };
  }

  // ==========================================================================
  // Contact (RFC 5733)
  // ==========================================================================

  /** Check contact ID availability (RFC 5733 Section 3.1.1). */
  async contactCheck(ids: string | string[], options: CommandOptions = {}): Promise<EppResponse<ContactCheckResult[]>> {
    return this.command(buildContactCheck(asArray(ids), options.extensions), resData(NS.contact, 'chkData', parseContactCheck));
  }

  /**
   * Retrieve contact data (RFC 5733 Section 3.1.2).
   *
   * @param options Info options, or the contact's authorization password.
   */
  async contactInfo(id: string, options: ContactInfoOptions | string = {}): Promise<EppResponse<ContactInfo>> {
    const opts = typeof options === 'string' ? { authInfo: options } : options;
    return this.command(buildContactInfo(id, opts), resData(NS.contact, 'infData', parseContactInfo));
  }

  /** Create a contact (RFC 5733 Section 3.2.1). Error 2302: object exists. */
  async contactCreate(request: ContactCreateRequest): Promise<EppResponse<ContactCreateResult>> {
    return this.command(buildContactCreate(request), resData(NS.contact, 'creData', parseContactCreate));
  }

  /** Update a contact (RFC 5733 Section 3.2.5). */
  async contactUpdate(request: ContactUpdateRequest): Promise<EppResponse> {
    return this.command(buildContactUpdate(request));
  }

  /** Delete a contact (RFC 5733 Section 3.2.2). Error 2305: the contact is linked to a domain. */
  async contactDelete(id: string, options: CommandOptions = {}): Promise<EppResponse> {
    return this.command(buildContactDelete(id, options.extensions));
  }

  /** Request, query, approve, reject or cancel a contact transfer (RFC 5733 Section 3.2.4). */
  async contactTransfer(request: ContactTransferRequest): Promise<EppResponse<ContactTransferResult>> {
    return this.command(buildContactTransfer(request), resData(NS.contact, 'trnData', parseContactTransfer));
  }

  // ==========================================================================
  // Host (RFC 5732)
  // ==========================================================================

  /** Check host name availability (RFC 5732 Section 3.1.1). */
  async hostCheck(names: string | string[], options: CommandOptions = {}): Promise<EppResponse<HostCheckResult[]>> {
    return this.command(buildHostCheck(asArray(names), options.extensions), resData(NS.host, 'chkData', parseHostCheck));
  }

  /** Retrieve host data (RFC 5732 Section 3.1.2). */
  async hostInfo(name: string, options: CommandOptions = {}): Promise<EppResponse<HostInfo>> {
    return this.command(buildHostInfo(name, options.extensions), resData(NS.host, 'infData', parseHostInfo));
  }

  /**
   * Create a host (RFC 5732 Section 3.2.1). Glue addresses are required for
   * hosts under a domain in the same registry; IP versions are detected.
   */
  async hostCreate(request: HostCreateRequest): Promise<EppResponse<HostCreateResult>> {
    return this.command(buildHostCreate(request), resData(NS.host, 'creData', parseHostCreate));
  }

  /** Update a host's addresses, statuses or name (RFC 5732 Section 3.2.5). */
  async hostUpdate(request: HostUpdateRequest): Promise<EppResponse> {
    return this.command(buildHostUpdate(request));
  }

  /** Delete a host (RFC 5732 Section 3.2.2). Error 2305: the host is used by a domain. */
  async hostDelete(name: string, options: CommandOptions = {}): Promise<EppResponse> {
    return this.command(buildHostDelete(name, options.extensions));
  }

  // ==========================================================================
  // Raw access and state
  // ==========================================================================

  /**
   * Send a complete EPP command document and return the parsed response,
   * for commands this client does not model. Frames are queued like any
   * other command; the clTRID is not checked.
   */
  async sendRaw(xml: string): Promise<EppResponse> {
    await this.ensureSession();
    const raw = await this.exchange(xml);
    const response = toEppResponse(parseResponse(parseEppDocument(raw), raw), raw, undefined);
    if (!response.success) throw new EppCommandError(response);
    return response;
  }

  /** Whether the connection is open and the greeting was received. */
  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  /** Whether a login succeeded on the current connection. */
  isLoggedIn(): boolean {
    return this.loggedIn && this.isConnected();
  }

  /** The most recent server greeting (RFC 5730 Section 2.4), or null before connecting. */
  getGreeting(): Greeting | null {
    return this.greeting;
  }

  /** Object and extension URIs announced at login, or null when not logged in. */
  getServices(): { objURIs: string[]; extURIs: string[] } | null {
    return this.services ? { objURIs: [...this.services.objURIs], extURIs: [...this.services.extURIs] } : null;
  }

  /** TLS details of the open connection, or null. */
  getConnectionInfo(): { protocol: string | null; cipher: tls.CipherNameAndProtocol; authorized: boolean } | null {
    if (!this.socket) return null;
    return { protocol: this.socket.getProtocol(), cipher: this.socket.getCipher(), authorized: this.socket.authorized };
  }

  // ==========================================================================
  // Internals
  // ==========================================================================

  private openConnection(): Promise<Greeting> {
    const config = this.config;
    const connectTimeout = config.connectTimeout ?? config.timeout;
    return new Promise<Greeting>((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        host: config.host,
        port: config.port,
        servername: config.servername ?? (isIP(config.host) ? undefined : config.host),
        rejectUnauthorized: config.rejectUnauthorized !== false,
        minVersion: config.minVersion ?? 'TLSv1.2',
        maxVersion: config.maxVersion,
        cert: config.clientCert,
        key: config.clientKey,
        passphrase: config.passphrase,
        ca: config.ca,
        ciphers: config.ciphers,
        ...(config.checkServerIdentity === false ? { checkServerIdentity: () => undefined } : {}),
        ...config.tlsOptions,
      };
      if (options.rejectUnauthorized === false) this.warn('TLS certificate verification is disabled (rejectUnauthorized: false)');

      this.decoder = new FrameDecoder(config.maxFrameSize);
      this.debug(`Connecting to ${config.host}:${config.port}`);
      let socket: tls.TLSSocket;
      try {
        socket = tls.connect(options);
      } catch (error) {
        // Unusable key material (wrong passphrase, mismatched or malformed key) throws synchronously.
        reject(new EppConnectionError(`Invalid TLS configuration: ${describeError(error as Error)}`, error as Error));
        return;
      }
      this.socket = socket;
      socket.setNoDelay(true);

      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.pending === greetingWaiter) this.pending = null;
        socket.destroy();
        reject(error);
      };
      const timer = setTimeout(
        () => fail(new EppTimeoutError(`No greeting from ${config.host}:${config.port} within ${connectTimeout} ms`)),
        connectTimeout,
      );
      const greetingWaiter: Pending = {
        resolve: (xml) => {
          try {
            const greeting = this.readGreeting(xml);
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.greeting = greeting;
            this.connected = true;
            this.emit('greeting', greeting);
            resolve(greeting);
          } catch (error) {
            fail(error as Error);
          }
        },
        reject: fail,
      };
      this.pending = greetingWaiter;

      socket.on('secureConnect', () => {
        const cipher = socket.getCipher();
        this.debug(`TLS established: ${socket.getProtocol()} ${cipher?.name ?? ''}`);
      });
      socket.on('data', (chunk: Buffer) => this.onData(chunk));
      socket.on('error', (error: Error) => {
        const description = describeError(error);
        this.debug(`Socket error: ${description}`);
        this.failPending(new EppConnectionError(`Connection error: ${description}`, error));
      });
      socket.on('close', () => this.onClose(socket));
    });
  }

  private onData(chunk: Buffer): void {
    let frames: string[];
    try {
      frames = this.decoder.push(chunk);
    } catch (error) {
      const protocolError = new EppProtocolError((error as Error).message);
      this.warn(`Closing connection: ${protocolError.message}`);
      this.failPending(protocolError);
      this.socket?.destroy();
      return;
    }
    for (const xml of frames) {
      this.debug(`<< ${redactXml(xml)}`);
      const pending = this.pending;
      if (!pending) {
        this.warn('Ignoring a frame the server sent without a pending command');
        continue;
      }
      this.pending = null;
      pending.resolve(xml);
    }
  }

  private onClose(socket: tls.TLSSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.connected = false;
    this.loggedIn = false;
    this.services = null;
    this.stopKeepAlive();
    this.decoder.reset();
    this.failPending(new EppConnectionError('Connection closed'));
    this.debug('Connection closed');
    this.emit('close');
  }

  private failPending(error: Error): void {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(error);
  }

  /** Queue a frame and resolve with the next frame received. */
  private exchange(xml: string): Promise<string> {
    const run = this.queue.then(() => this.send(xml));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private send(xml: string): Promise<string> {
    const socket = this.socket;
    if (!socket || !this.connected) {
      return Promise.reject(new EppConnectionError('Not connected to an EPP server. Call connect() and login() first.'));
    }
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending !== waiter) return;
        this.pending = null;
        reject(new EppTimeoutError(`No response within ${this.config.timeout} ms; closing the connection`));
        // A late response would otherwise be taken as the answer to the next command.
        socket.destroy();
      }, this.config.timeout);
      const waiter: Pending = {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.pending = waiter;
      this.debug(`>> ${redactXml(xml)}`);
      socket.write(encodeFrame(xml));
    }).finally(() => this.scheduleKeepAlive());
  }

  private async command<T = undefined>(
    parts: CommandParts,
    parse?: (parsed: ParsedResponse) => T | undefined,
    options: { requireSession?: boolean } = {},
  ): Promise<EppResponse<T>> {
    if (options.requireSession !== false) await this.ensureSession();
    this.checkExtensions(parts.extensions);
    const clTRID = this.nextClTRID();
    const raw = await this.exchange(buildCommandXml(parts, clTRID));
    const parsed = parseResponse(parseEppDocument(raw), raw);
    if (parsed.clTRID !== undefined && parsed.clTRID !== clTRID) {
      this.socket?.destroy();
      throw new EppProtocolError(`Response clTRID ${parsed.clTRID} does not match ${clTRID}; closing the connection`, raw);
    }
    const code = parsed.results[0].code;
    if (SESSION_ENDING_CODES.includes(code)) this.loggedIn = false;
    let data: T | undefined;
    if (parse && code < 2000) {
      try {
        data = parse(parsed);
      } catch (error) {
        throw new EppProtocolError(`Could not interpret response data: ${(error as Error).message}`, raw);
      }
    }
    const response = toEppResponse(parsed, raw, data);
    if (!response.success) throw new EppCommandError(response);
    return response;
  }

  private async ensureSession(): Promise<void> {
    if (this.connected) return;
    if (this.config.autoReconnect && this.lastLogin) {
      const login = this.lastLogin;
      if (!this.reconnecting) {
        this.reconnecting = (async () => {
          this.debug('Connection lost; reconnecting');
          await this.connect();
          await this.login(login);
          this.emit('reconnect');
        })().finally(() => {
          this.reconnecting = null;
        });
      }
      await this.reconnecting;
      return;
    }
    throw new EppConnectionError('Not connected to an EPP server. Call connect() and login() first.');
  }

  /**
   * Require each extension element to declare its namespace, and reject
   * extensions that were not announced at login (RFC 5730 Section 2.9.1.1).
   */
  private checkExtensions(extensions: XmlElement[]): void {
    for (const extension of extensions) {
      const prefix = extension.name.includes(':') ? extension.name.split(':')[0] : '';
      const attribute = prefix ? `xmlns:${prefix}` : 'xmlns';
      const uri = extension.attrs[attribute];
      if (!uri) {
        throw new EppValidationError(`Extension element <${extension.name}> must declare its namespace with a ${attribute} attribute`);
      }
      if (this.services && !this.services.extURIs.includes(uri)) {
        throw new EppValidationError(
          `Extension ${uri} was not announced at login (announced: ${this.services.extURIs.join(', ') || 'none'})`,
        );
      }
    }
  }

  private readGreeting(xml: string): Greeting {
    const greeting = parseEppDocument(xml).child(NS.epp, 'greeting');
    if (!greeting) throw new EppProtocolError('Expected an EPP <greeting>', xml);
    return parseGreeting(greeting);
  }

  private nextClTRID(): string {
    if (this.config.generateClTRID) {
      const id = this.config.generateClTRID();
      if (typeof id !== 'string' || id.length < 3 || id.length > 64 || /\s/.test(id)) {
        throw new EppValidationError('generateClTRID must return 3-64 characters without spaces (RFC 5730 trIDStringType)');
      }
      return id;
    }
    this.clTRIDCounter = (this.clTRIDCounter + 1) % 0x7fffffff;
    return `${this.config.clTRIDPrefix}-${Date.now().toString(36)}-${this.clTRIDCounter.toString(36)}-${randomBytes(3).toString('hex')}`;
  }

  private userAgent(): UserAgent | undefined {
    if (this.config.userAgent === false) return undefined;
    return this.config.userAgent ?? { app: `epp-ts ${VERSION}`, tech: `Node.js ${process.version}` };
  }

  private scheduleKeepAlive(): void {
    this.stopKeepAlive();
    const interval = this.config.keepAliveInterval;
    if (!interval || interval <= 0 || !this.loggedIn || !this.connected) return;
    this.keepAliveTimer = setTimeout(() => {
      this.keepAliveTimer = null;
      this.hello().catch((error: Error) => this.warn(`Keep-alive <hello> failed: ${error.message}`));
    }, interval);
    this.keepAliveTimer.unref();
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private debug(message: string): void {
    this.logger?.debug(message);
  }

  private warn(message: string): void {
    if (this.logger?.warn) this.logger.warn(message);
    else this.logger?.debug(message);
  }
}

const consoleLogger: EppLogger = {
  debug: (message) => console.debug(`[epp] ${message}`),
  warn: (message) => console.warn(`[epp] ${message}`),
};

function resData<T>(ns: string, name: string, parse: (node: XmlNode) => T): (parsed: ParsedResponse) => T | undefined {
  return (parsed) => (parsed.resData?.is(ns, name) ? parse(parsed.resData) : undefined);
}

/**
 * Message for a Node.js error, including its code. Connection attempts to
 * several addresses fail with an AggregateError whose own message is empty.
 */
function describeError(error: Error): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (error.message) return code && !error.message.includes(code) ? `${error.message} (${code})` : error.message;
  const inner = (error as Error & { errors?: unknown[] }).errors;
  if (Array.isArray(inner) && inner.length > 0) return inner.map((e) => describeError(e as Error)).join('; ');
  return code ?? error.name;
}
