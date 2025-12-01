import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
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
 * EPP Client
 * Referensi: RFC 5730 - Extensible Provisioning Protocol (EPP)
 * 
 * Client implementation untuk EPP protocol yang support:
 * - Domain operations (RFC 5731)
 * - Contact operations (RFC 5733)
 * - Host operations (RFC 5732)
 * - Fee extension (RFC 8748)
 * 
 * EPP adalah protokol untuk provisioning dan management dari objects
 * dalam shared central repository. Primary application adalah
 * management dari objects dalam domain name registries.
 * 
 * @example
 * ```typescript
 * const client = new EppClient({
 *   server: 'https://epp.example.com',
 *   username: 'client-id',
 *   password: 'password',
 *   timeout: 30000
 * });
 * 
 * // Login
 * await client.login();
 * 
 * // Check domain availability
 * const result = await client.domainCheck(['example.com', 'example.net']);
 * 
 * // Logout
 * await client.logout();
 * ```
 */
export class EppClient {
  private config: EppConfig;
  private httpClient: AxiosInstance;
  private eppRequest: EppRequest;
  private sessionId?: string;

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
      debug: false,
      ...config
    };

    // Setup HTTP client dengan SSL/TLS (RFC 5734)
    this.httpClient = axios.create({
      baseURL: this.config.server,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/epp+xml', // RFC 5734 Section 4
        'Accept': 'application/epp+xml'
      }
    });

    this.eppRequest = new EppRequest();

    // Add debug interceptor untuk development
    if (this.config.debug) {
      this.httpClient.interceptors.request.use(request => {
        console.log('EPP Request:', request.data);
        return request;
      });

      this.httpClient.interceptors.response.use(response => {
        console.log('EPP Response:', response.data);
        return response;
      });
    }
  }

  /**
   * Send EPP request ke server
   * Referensi: RFC 5730 Section 2 - Transport Mapping
   * 
   * @param xml - XML request string
   * @returns EPP response
   * @throws {EppError} Jika terjadi error
   */
  private async sendRequest(xml: string): Promise<EppResponse> {
    try {
      const config: AxiosRequestConfig = {};
      
      // Include session cookie jika sudah login (stateful session)
      if (this.sessionId) {
        config.headers = {
          'Cookie': `session=${this.sessionId}`
        };
      }

      const response = await this.httpClient.post('', xml, config);

      // Extract session ID dari response headers
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const sessionMatch = setCookie[0].match(/session=([^;]+)/);
        if (sessionMatch) {
          this.sessionId = sessionMatch[1];
        }
      }

      // Parse XML response
      const parsed = await XmlParser.parse(response.data);
      const result = XmlParser.extractResponseData(parsed);

      // RFC 5730 Section 3 - Result Codes
      // 1xxx codes = Command completed successfully
      // 2xxx codes = Command error
      if (result.code >= 1000 && result.code < 2000) {
        return {
          success: true,
          code: result.code,
          message: result.message,
          data: result.data,
          clTRID: result.clTRID,
          svTRID: result.svTRID
        };
      } else {
        throw {
          name: 'EPPError',
          code: result.code,
          message: result.message,
          values: result.values
        } as EppError;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw {
          name: 'NetworkError',
          code: 0,
          message: error.message
        } as EppError;
      }
      throw error;
    }
  }

  /**
   * Login Command
   * Referensi: RFC 5730 Section 2.9.1.1 - <login> Command
   * 
   * Login command digunakan untuk establish EPP session dengan server.
   * Client MUST send login command untuk begin session.
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
    return this.sendRequest(xml);
  }

  /**
   * Logout Command
   * Referensi: RFC 5730 Section 2.9.1.2 - <logout> Command
   * 
   * Logout command digunakan untuk end EPP session dengan server.
   * Server akan close connection setelah logout completed.
   * 
   * Success result code:
   * - 1500: Command completed successfully, ending session
   * 
   * @returns EPP response
   * 
   * @example
   * ```typescript
   * await client.logout();
   * ```
   */
  async logout(): Promise<EppResponse> {
    const xml = this.eppRequest.logout();
    const response = await this.sendRequest(xml);
    this.sessionId = undefined;
    return response;
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
    return this.sendRequest(xml);
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
    const xml = this.eppRequest.contactInfo(id, authInfo);
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    const xml = this.eppRequest.domainInfo(domain, authInfo);
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
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
    return this.sendRequest(xml);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Check apakah client currently connected dengan active session
   * 
   * @returns true jika session active, false otherwise
   */
  isConnected(): boolean {
    return !!this.sessionId;
  }

  /**
   * Get current session ID
   * 
   * @returns Session ID atau undefined jika tidak connected
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
}