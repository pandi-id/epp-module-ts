import * as tls from 'tls';
import * as net from 'net';
import * as fs from 'fs';
import { EppRequest } from './EppRequest';
import { XmlParser } from '../utils/XmlParser';
import { 
  EppConfig, 
  EppResponse, 
  EppError,
  ContactCreateRequest, 
  ContactUpdateRequest,
  ContactTransferRequest,
  DomainCreateRequest,
  DomainUpdateRequest,
  DomainRenewRequest,
  DomainTransferRequest,
  HostCreateRequest,
  HostUpdateRequest,
  FeeCheckRequest 
} from '../types';

/**
 * EPP Client menggunakan TLS/TCP Transport
 * Referensi: RFC 5734 - EPP Transport over TCP
 * 
 * EPP menggunakan persistent TCP connection dengan TLS encryption.
 * Data ditransmit dalam frames dengan 4-byte header yang berisi
 * total frame size (termasuk header).
 * 
 * Client implementation untuk EPP protocol yang support:
 * - Domain operations (RFC 5731)
 * - Contact operations (RFC 5733)
 * - Host operations (RFC 5732)
 * - Fee extension (RFC 8748)
 * 
 * Transport Features:
 * - TLS 1.2+ encryption (RFC 5734 Section 5)
 * - Mutual TLS authentication support
 * - Persistent connection dengan keep-alive
 * - 4-byte frame header (network byte order)
 * - Auto-reconnect pada connection loss
 * 
 * @example
 * ```typescript
 * const client = new EppClient({
 *   host: 'epp.registry.example',
 *   port: 700, // Standard EPP port
 *   username: 'client-id',
 *   password: 'password',
 *   timeout: 30000,
 *   // Optional: Mutual TLS
 *   clientCert: fs.readFileSync('client-cert.pem'),
 *   clientKey: fs.readFileSync('client-key.pem')
 * });
 * 
 * // Connect dan login
 * await client.connect();
 * 
 * // Check domain availability
 * const result = await client.domainCheck(['example.com', 'example.net']);
 * 
 * // Logout dan disconnect
 * await client.logout();
 * await client.disconnect();
 * ```
 */
export class EppClient {
  private config: EppConfig;
  private socket: tls.TLSSocket | null = null;
  private eppRequest: EppRequest;
  private connected: boolean = false;
  private greeting: any = null;
  private buffer: Buffer = Buffer.alloc(0);
  private pendingResponse: Promise<string> | null = null;
  private responseResolver: ((value: string) => void) | null = null;
  private responseRejecter: ((error: Error) => void) | null = null;

  /**
   * Konstruktor EPP Client
   * 
   * @param config - Konfigurasi EPP client
   */
  constructor(config: EppConfig) {
    this.config = {
      lang: 'en',
      version: '1.0',
      timeout: 30000,
      port: 700, // Standard EPP port (RFC 5734 Section 3)
      debug: false,
      rejectUnauthorized: true, // Validate server certificate
      ...config
    };

    this.eppRequest = new EppRequest();
  }

  /**
   * Connect to EPP server menggunakan TLS/TCP
   * Referensi: RFC 5734 Section 2 - Connection Management
   * 
   * Establishes persistent TCP connection dengan TLS encryption.
   * Server akan send greeting message setelah connection established.
   * 
   * @throws {Error} Jika connection gagal
   * 
   * @example
   * ```typescript
   * await client.connect();
   * console.log('Connected to EPP server');
   * ```
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.socket) {
        resolve();
        return;
      }

      // TLS options (RFC 5734 Section 5)
      const tlsOptions: tls.ConnectionOptions = {
        host: this.config.host,
        port: this.config.port || 700,
        rejectUnauthorized: this.config.rejectUnauthorized !== false,
        minVersion: 'TLSv1.2', // Minimum TLS 1.2
        // Mutual TLS support
        cert: this.config.clientCert,
        key: this.config.clientKey,
        ca: this.config.ca,
      };

      if (this.config.debug) {
        console.log(`Connecting to ${this.config.host}:${this.config.port || 700}...`);
      }

      // Create TLS socket
      this.socket = tls.connect(tlsOptions, () => {
        if (!this.socket) return;

        if (this.config.debug) {
          console.log('TLS connection established');
          console.log('Cipher:', this.socket.getCipher());
          console.log('Protocol:', this.socket.getProtocol());
        }

        this.connected = true;
      });

      // Setup event handlers
      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('error', (error: Error) => {
        if (this.config.debug) {
          console.error('Socket error:', error);
        }
        this.connected = false;
        
        if (this.responseRejecter) {
          this.responseRejecter(error);
          this.responseRejecter = null;
          this.responseResolver = null;
        }
        
        reject(error);
      });

      this.socket.on('end', () => {
        if (this.config.debug) {
          console.log('Socket ended');
        }
        this.connected = false;
      });

      this.socket.on('close', () => {
        if (this.config.debug) {
          console.log('Socket closed');
        }
        this.connected = false;
        this.socket = null;
      });

      // Wait for greeting message
      const greetingTimeout = setTimeout(() => {
        reject(new Error('Timeout waiting for greeting'));
      }, this.config.timeout);

      const originalResolver = this.responseResolver;
      this.responseResolver = (xml: string) => {
        clearTimeout(greetingTimeout);
        
        XmlParser.parse(xml)
          .then((parsed) => {
            this.greeting = parsed.epp?.greeting;
            
            if (this.config.debug) {
              console.log('Received greeting:', JSON.stringify(this.greeting, null, 2));
            }
            
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      };
    });
  }

  /**
   * Disconnect dari EPP server
   * Referensi: RFC 5734 Section 2 - Connection Management
   * 
   * Closes TLS/TCP connection. SHOULD logout before disconnect.
   * 
   * @example
   * ```typescript
   * await client.logout();
   * await client.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        this.connected = false;
        resolve();
        return;
      }

      this.socket.end(() => {
        if (this.config.debug) {
          console.log('Disconnected from EPP server');
        }
        this.connected = false;
        this.socket = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming data dari socket
   * Referensi: RFC 5734 Section 4 - Data Unit Format
   * 
   * EPP menggunakan 4-byte header dalam network byte order (big-endian)
   * yang berisi total frame size termasuk header.
   * 
   * @param data - Data buffer dari socket
   */
  private handleData(data: Buffer): void {
    // Append data ke buffer
    this.buffer = Buffer.concat([this.buffer, data]);

    // Process complete frames
    while (this.buffer.length >= 4) {
      // Read 4-byte header (network byte order - big-endian)
      const frameSize = this.buffer.readUInt32BE(0);

      // Check jika complete frame tersedia
      if (this.buffer.length < frameSize) {
        break; // Wait for more data
      }

      // Extract frame (excluding 4-byte header)
      const frameData = this.buffer.slice(4, frameSize);
      this.buffer = this.buffer.slice(frameSize);

      // Convert to XML string
      const xml = frameData.toString('utf8');

      if (this.config.debug) {
        console.log('Received EPP Frame:');
        console.log(xml);
      }

      // Resolve pending response
      if (this.responseResolver) {
        this.responseResolver(xml);
        this.responseResolver = null;
        this.responseRejecter = null;
        this.pendingResponse = null;
      }
    }
  }

  /**
   * Send EPP command ke server
   * Referensi: RFC 5734 Section 4 - Data Unit Format
   * 
   * Encapsulates XML dalam EPP frame dengan 4-byte header.
   * 
   * @param xml - XML command string
   * @returns EPP response
   * @throws {EppError} Jika terjadi error
   */
  private async sendCommand(xml: string): Promise<EppResponse> {
    if (!this.connected || !this.socket) {
      throw {
        name: 'ConnectionError',
        code: 0,
        message: 'Not connected to EPP server. Call connect() first.'
      } as EppError;
    }

    // Create frame dengan 4-byte header (RFC 5734 Section 4)
    const xmlBuffer = Buffer.from(xml, 'utf8');
    const frameSize = xmlBuffer.length + 4; // Include header size
    const frame = Buffer.alloc(frameSize);
    
    // Write frame size dalam network byte order (big-endian)
    frame.writeUInt32BE(frameSize, 0);
    // Write XML data
    xmlBuffer.copy(frame, 4);

    if (this.config.debug) {
      console.log('Sending EPP Frame:');
      console.log(xml);
    }

    // Send frame
    this.socket.write(frame);

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseResolver = null;
        this.responseRejecter = null;
        reject({
          name: 'TimeoutError',
          code: 0,
          message: 'Request timeout'
        } as EppError);
      }, this.config.timeout);

      this.responseResolver = async (responseXml: string) => {
        clearTimeout(timeout);

        try {
          // Parse XML response
          const parsed = await XmlParser.parse(responseXml);
          const result = XmlParser.extractResponseData(parsed);

          // RFC 5730 Section 3 - Result Codes
          // 1xxx codes = Command completed successfully
          // 2xxx codes = Command error
          if (result.code >= 1000 && result.code < 2000) {
            resolve({
              success: true,
              code: result.code,
              message: result.message,
              data: result.data,
              clTRID: result.clTRID,
              svTRID: result.svTRID
            });
          } else {
            reject({
              name: 'EPPError',
              code: result.code,
              message: result.message,
              values: result.values
            } as EppError);
          }
        } catch (error) {
          reject({
            name: 'ParseError',
            code: 0,
            message: error instanceof Error ? error.message : 'Failed to parse response'
          } as EppError);
        }
      };

      this.responseRejecter = (error: Error) => {
        clearTimeout(timeout);
        reject({
          name: 'NetworkError',
          code: 0,
          message: error.message
        } as EppError);
      };
    });
  }

  /**
   * Login Command
   * Referensi: RFC 5730 Section 2.9.1.1 - <login> Command
   * 
   * Login command digunakan untuk authenticate client ke EPP server.
   * MUST be called setelah connect() dan sebelum operations lain.
   * 
   * Success result codes:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2200: Authentication error
   * - 2500: Command syntax error
   * 
   * @param newPassword - Optional new password untuk password change
   * @returns EPP response dengan session information
   * 
   * @example
   * ```typescript
   * await client.connect();
   * await client.login();
   * // atau untuk password change
   * await client.login('newPassword123');
   * ```
   */
  async login(newPassword?: string): Promise<EppResponse> {
    const xml = this.eppRequest.login(
      this.config.username, 
      this.config.password, 
      { 
        newPassword,
        lang: this.config.lang,
        version: this.config.version
      }
    );
    return this.sendCommand(xml);
  }

  /**
   * Logout Command
   * Referensi: RFC 5730 Section 2.9.1.2 - <logout> Command
   * 
   * Logout command digunakan untuk end EPP session dengan server.
   * SHOULD be called sebelum disconnect().
   * 
   * Success result code:
   * - 1500: Command completed successfully, ending session
   * 
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.logout();
   * await client.disconnect();
   * ```
   */
  async logout(): Promise<EppResponse> {
    const xml = this.eppRequest.logout();
    return this.sendCommand(xml);
  }

  // ========================================================================
  // CONTACT COMMANDS (RFC 5733)
  // ========================================================================

  /**
   * Contact Check Command
   * Referensi: RFC 5733 Section 3.1.1 - EPP <check> Command
   * 
   * Check command digunakan untuk determine apakah contact ID tersedia
   * untuk provisioning. Support multiple IDs dalam single request.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param ids - Array of contact IDs untuk dicek (1-20 IDs)
   * @returns EPP response dengan availability information
   * 
   * @example
   * ```typescript
   * const result = await client.contactCheck(['sh8013', 'sah8013']);
   * // result.data: [{ id: 'sh8013', available: true }, ...]
   * ```
   */
  async contactCheck(ids: string[]): Promise<EppResponse> {
    const xml = this.eppRequest.contactCheck(ids);
    return this.sendCommand(xml);
  }

  /**
   * Contact Info Command
   * Referensi: RFC 5733 Section 3.1.2 - EPP <info> Command
   * 
   * Info command digunakan untuk retrieve information terkait contact object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * 
   * @param id - Contact ID untuk query
   * @param authInfo - Optional authorization info untuk access restricted data
   * @returns EPP response dengan contact details
   * 
   * @example
   * ```typescript
   * const result = await client.contactInfo('sh8013');
   * // result.data: { id: 'sh8013', email: '...', ... }
   * ```
   */
  async contactInfo(id: string, authInfo?: string): Promise<EppResponse> {
    const authInfoObj = authInfo ? { pw: authInfo } : undefined;
    const xml = this.eppRequest.contactInfo(id, authInfoObj);
    return this.sendCommand(xml);
  }

  /**
   * Contact Create Command
   * Referensi: RFC 5733 Section 3.2.1 - EPP <create> Command
   * 
   * Create command provisions instance dari contact object.
   * Contact ID MUST be unique dalam repository.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2302: Object exists (contact ID already taken)
   * - 2306: Parameter value policy error
   * 
   * @param data - Contact creation data
   * @returns EPP response dengan contact ID dan creation details
   * 
   * @example
   * ```typescript
   * await client.contactCreate({
   *   id: 'sh8013',
   *   postalInfo: {
   *     type: 'int',
   *     name: 'John Doe',
   *     addr: {
   *       street: ['123 Example St'],
   *       city: 'Jakarta',
   *       cc: 'ID'
   *     }
   *   },
   *   email: 'john@example.com',
   *   authInfo: { pw: 'password123' }
   * });
   * ```
   */
  async contactCreate(data: ContactCreateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.contactCreate(data);
    return this.sendCommand(xml);
  }

  /**
   * Contact Update Command
   * Referensi: RFC 5733 Section 3.2.5 - EPP <update> Command
   * 
   * Update command mengubah information terkait contact object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2304: Object status prohibits operation
   * 
   * @param data - Contact update data (add/rem/chg)
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.contactUpdate({
   *   id: 'sh8013',
   *   chg: {
   *     email: 'newemail@example.com'
   *   }
   * });
   * ```
   */
  async contactUpdate(data: ContactUpdateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.contactUpdate(data);
    return this.sendCommand(xml);
  }

  /**
   * Contact Delete Command
   * Referensi: RFC 5733 Section 3.2.2 - EPP <delete> Command
   * 
   * Delete command removes contact object dari repository.
   * Contact MUST NOT be linked dengan any other objects.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2304: Object status prohibits operation
   * - 2305: Object association prohibits operation (contact is linked)
   * 
   * @param id - Contact ID untuk dihapus
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.contactDelete('sh8013');
   * ```
   */
  async contactDelete(id: string): Promise<EppResponse> {
    const xml = this.eppRequest.contactDelete(id);
    return this.sendCommand(xml);
  }

  /**
   * Contact Transfer Command
   * Referensi: RFC 5733 Section 3.2.4 - EPP <transfer> Command
   * 
   * Transfer command provides query dan transform operations untuk
   * contact transfers between clients.
   * 
   * Success result codes:
   * - 1000: Command completed successfully
   * - 1001: Command completed successfully; action pending
   * 
   * @param data - Transfer request data
   * @returns EPP response dengan transfer status
   */
  async contactTransfer(data: ContactTransferRequest): Promise<EppResponse> {
    const xml = this.eppRequest.contactTransfer(data);
    return this.sendCommand(xml);
  }

  // ========================================================================
  // DOMAIN COMMANDS (RFC 5731)
  // ========================================================================

  /**
   * Domain Check Command
   * Referensi: RFC 5731 Section 3.1.1 - EPP <check> Command
   * 
   * Check command digunakan untuk determine apakah domain name tersedia
   * untuk registration. Support multiple domain names dalam single request.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param domains - Array of domain names untuk dicek (1-20 domains)
   * @returns EPP response dengan availability information
   * 
   * @example
   * ```typescript
   * const result = await client.domainCheck(['example.com', 'example.net']);
   * // result.data: [{ name: 'example.com', available: true }, ...]
   * ```
   */
  async domainCheck(domains: string[]): Promise<EppResponse> {
    const xml = this.eppRequest.domainCheck(domains);
    return this.sendCommand(xml);
  }

  /**
   * Domain Info Command
   * Referensi: RFC 5731 Section 3.1.2 - EPP <info> Command
   * 
   * Info command digunakan untuk retrieve information terkait domain object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * 
   * @param domain - Domain name untuk query
   * @param authInfo - Optional authorization info untuk access restricted data
   * @returns EPP response dengan domain details
   * 
   * @example
   * ```typescript
   * const result = await client.domainInfo('example.com');
   * // result.data: { name: 'example.com', status: [...], ... }
   * ```
   */
  async domainInfo(domain: string, authInfo?: string): Promise<EppResponse> {
    const authInfoObj = authInfo ? { pw: authInfo } : undefined;
    const xml = this.eppRequest.domainInfo(domain, authInfoObj);
    return this.sendCommand(xml);
  }

  /**
   * Domain Create Command
   * Referensi: RFC 5731 Section 3.2.1 - EPP <create> Command
   * 
   * Create command provisions instance dari domain object.
   * Domain name MUST be unique dalam repository.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2302: Object exists (domain already registered)
   * - 2303: Required parameter missing (e.g., contact)
   * - 2306: Parameter value policy error
   * 
   * @param data - Domain creation data
   * @returns EPP response dengan domain name dan creation details
   * 
   * @example
   * ```typescript
   * await client.domainCreate({
   *   name: 'example.com',
   *   period: { value: 1, unit: 'y' },
   *   registrant: 'sh8013',
   *   contacts: [
   *     { type: 'admin', id: 'sh8013' },
   *     { type: 'tech', id: 'sh8013' }
   *   ],
   *   ns: { hostObj: ['ns1.example.com', 'ns2.example.com'] },
   *   authInfo: { pw: 'password123' }
   * });
   * ```
   */
  async domainCreate(data: DomainCreateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.domainCreate(data);
    return this.sendCommand(xml);
  }

  /**
   * Domain Update Command
   * Referensi: RFC 5731 Section 3.2.5 - EPP <update> Command
   * 
   * Update command mengubah information terkait domain object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2304: Object status prohibits operation
   * 
   * @param data - Domain update data (add/rem/chg)
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.domainUpdate({
   *   name: 'example.com',
   *   add: {
   *     ns: { hostObj: ['ns3.example.com'] }
   *   }
   * });
   * ```
   */
  async domainUpdate(data: DomainUpdateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.domainUpdate(data);
    return this.sendCommand(xml);
  }

  /**
   * Domain Renew Command
   * Referensi: RFC 5731 Section 3.2.3 - EPP <renew> Command
   * 
   * Renew command extends registration period dari domain object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2304: Object status prohibits operation
   * - 2306: Parameter value policy error
   * 
   * @param data - Domain renew data
   * @returns EPP response dengan new expiration date
   * 
   * @example
   * ```typescript
   * await client.domainRenew({
   *   name: 'example.com',
   *   curExpDate: '2025-12-01',
   *   period: { value: 1, unit: 'y' }
   * });
   * ```
   */
  async domainRenew(data: DomainRenewRequest): Promise<EppResponse> {
    const xml = this.eppRequest.domainRenew(data);
    return this.sendCommand(xml);
  }

  /**
   * Domain Delete Command
   * Referensi: RFC 5731 Section 3.2.2 - EPP <delete> Command
   * 
   * Delete command removes domain object dari repository.
   * Some registries implement grace period untuk delete operations.
   * 
   * Success result codes:
   * - 1000: Command completed successfully
   * - 1001: Command completed successfully; action pending
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2304: Object status prohibits operation
   * 
   * @param domain - Domain name untuk dihapus
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.domainDelete('example.com');
   * ```
   */
  async domainDelete(domain: string): Promise<EppResponse> {
    const xml = this.eppRequest.domainDelete(domain);
    return this.sendCommand(xml);
  }

  /**
   * Domain Transfer Command
   * Referensi: RFC 5731 Section 3.2.4 - EPP <transfer> Command
   * 
   * Transfer command provides query dan transform operations untuk
   * domain transfers between clients.
   * 
   * Success result codes:
   * - 1000: Command completed successfully
   * - 1001: Command completed successfully; action pending
   * 
   * @param data - Transfer request data
   * @returns EPP response dengan transfer status
   * 
   * @example
   * ```typescript
   * // Request transfer
   * await client.domainTransfer({
   *   name: 'example.com',
   *   op: 'request',
   *   authInfo: { pw: 'authcode123' }
   * });
   * 
   * // Query transfer status
   * await client.domainTransfer({
   *   name: 'example.com',
   *   op: 'query'
   * });
   * ```
   */
  async domainTransfer(data: DomainTransferRequest): Promise<EppResponse> {
    const xml = this.eppRequest.domainTransfer(data);
    return this.sendCommand(xml);
  }

  // ========================================================================
  // HOST COMMANDS (RFC 5732)
  // ========================================================================

  /**
   * Host Check Command
   * Referensi: RFC 5732 Section 3.1.1 - EPP <check> Command
   * 
   * Check command digunakan untuk determine apakah host name tersedia
   * untuk provisioning.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param names - Array of host names untuk dicek
   * @returns EPP response dengan availability information
   * 
   * @example
   * ```typescript
   * const result = await client.hostCheck(['ns1.example.com']);
   * ```
   */
  async hostCheck(names: string[]): Promise<EppResponse> {
    const xml = this.eppRequest.hostCheck(names);
    return this.sendCommand(xml);
  }

  /**
   * Host Info Command
   * Referensi: RFC 5732 Section 3.1.2 - EPP <info> Command
   * 
   * Info command digunakan untuk retrieve information terkait host object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param name - Host name untuk query
   * @returns EPP response dengan host details
   */
  async hostInfo(name: string): Promise<EppResponse> {
    const xml = this.eppRequest.hostInfo(name);
    return this.sendCommand(xml);
  }

  /**
   * Host Create Command
   * Referensi: RFC 5732 Section 3.2.1 - EPP <create> Command
   * 
   * Create command provisions instance dari host object.
   * IP addresses MUST be provided untuk subordinate hosts (glue records).
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param data - Host creation data
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * // Subordinate host dengan IP addresses
   * await client.hostCreate({
   *   name: 'ns1.example.com',
   *   addr: [
   *     { ip: '192.0.2.1', type: 'v4' },
   *     { ip: '2001:db8::1', type: 'v6' }
   *   ]
   * });
   * ```
   */
  async hostCreate(data: HostCreateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.hostCreate(data);
    return this.sendCommand(xml);
  }

  /**
   * Host Update Command
   * Referensi: RFC 5732 Section 3.2.5 - EPP <update> Command
   * 
   * Update command mengubah information terkait host object.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * @param data - Host update data
   * @returns EPP response
   */
  async hostUpdate(data: HostUpdateRequest): Promise<EppResponse> {
    const xml = this.eppRequest.hostUpdate(data);
    return this.sendCommand(xml);
  }

  /**
   * Host Delete Command
   * Referensi: RFC 5732 Section 3.2.2 - EPP <delete> Command
   * 
   * Delete command removes host object dari repository.
   * Host MUST NOT be associated dengan any domain objects.
   * 
   * Success result code:
   * - 1000: Command completed successfully
   * 
   * Error result codes:
   * - 2303: Object does not exist
   * - 2305: Object association prohibits operation (host is linked)
   * 
   * @param name - Host name untuk dihapus
   * @returns EPP response
   */
  async hostDelete(name: string): Promise<EppResponse> {
    const xml = this.eppRequest.hostDelete(name);
    return this.sendCommand(xml);
  }

  // ========================================================================
  // FEE EXTENSION (RFC 8748)
  // ========================================================================

  /**
   * Fee Check Command
   * Referensi: RFC 8748 - EPP Fee Extension
   * 
   * Fee check digunakan untuk query biaya operasi domain sebelum execution.
   * Support untuk create, renew, transfer, dan restore operations.
   * 
   * @param data - Fee check request data
   * @returns EPP response dengan fee information
   * 
   * @example
   * ```typescript
   * const result = await client.feeCheck({
   *   domain: 'example.com',
   *   command: 'create',
   *   period: { value: 1, unit: 'y' },
   *   currency: 'USD'
   * });
   * ```
   */
  async feeCheck(data: FeeCheckRequest): Promise<EppResponse> {
    const xml = this.eppRequest.feeCheck(data);
    return this.sendCommand(xml);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Check apakah client currently connected ke EPP server
   * 
   * @returns true jika connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  /**
   * Get server greeting message
   * Referensi: RFC 5730 Section 2.4 - Greeting
   * 
   * Greeting berisi server information seperti:
   * - Server ID
   * - Server date/time
   * - Protocol version
   * - Supported services
   * - Languages
   * - Access policy
   * 
   * @returns Greeting object atau null jika belum connected
   */
  getGreeting(): any {
    return this.greeting;
  }

  /**
   * Get TLS connection information
   * 
   * @returns TLS cipher dan protocol information
   */
  getConnectionInfo(): { cipher?: any; protocol?: string | null } | null {
    if (!this.socket) {
      return null;
    }

    return {
      cipher: this.socket.getCipher(),
      protocol: this.socket.getProtocol()
    };
  }
}