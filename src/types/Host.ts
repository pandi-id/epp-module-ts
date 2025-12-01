/**
 * IP Address for Host
 * Referensi: RFC 5732 Section 2.2 - Host Address
 * 
 * Host dapat memiliki one atau more IP addresses.
 * IP addresses MUST be specified jika host adalah subordinate host (glue record).
 */
export interface HostAddress {
  /** 
   * IP address value (RFC 5732 Section 2.2)
   * MUST be dotted-decimal notation untuk IPv4 atau
   * colon-hexadecimal notation untuk IPv6
   */
  ip: string;
  
  /** 
   * IP version (RFC 5732 Section 2.2)
   * 'v4' = IPv4 address (e.g., "192.0.2.1")
   * 'v6' = IPv6 address (e.g., "2001:db8::1")
   */
  type: 'v4' | 'v6';
}

/**
 * Host Check Request
 * Referensi: RFC 5732 Section 3.1.1 - EPP <check> Command
 * 
 * Check command digunakan untuk determine apakah host object
 * dapat di-provisioned dengan server.
 */
export interface HostCheckRequest {
  /** 
   * Array of host names untuk dicek (RFC 5732 Section 3.1.1)
   * MUST be fully qualified host names
   * Maximum biasanya 10-20 hosts per request (server-dependent)
   */
  names: string[];
}

/**
 * Host Check Result
 * Referensi: RFC 5732 Section 3.1.1 - EPP <check> Response
 */
export interface HostCheckResult {
  /** Fully qualified host name */
  name: string;
  
  /** 
   * Availability status (RFC 5732 Section 3.1.1)
   * true = host name available untuk creation
   * false = host name already exists
   */
  available: boolean;
  
  /** Optional: Reason jika host tidak available */
  reason?: string;
}

/**
 * Host Create Request
 * Referensi: RFC 5732 Section 3.2.1 - EPP <create> Command
 * 
 * Create command provisions instance dari host object.
 * Host objects digunakan sebagai nameservers untuk domains.
 * 
 * Dua tipe hosts:
 * 1. Subordinate hosts (glue records) - MUST have IP addresses
 *    Example: ns1.example.com untuk domain example.com
 * 2. External hosts - NO IP addresses needed
 *    Example: ns1.otherdomain.com untuk domain example.com
 */
export interface HostCreateRequest {
  /** 
   * Fully qualified host name (RFC 5732 Section 3.2.1)
   * REQUIRED - MUST conform to host name syntax (RFC 952, RFC 1123)
   * Maximum 255 characters
   * Example: 'ns1.example.com'
   */
  name: string;
  
  /** 
   * IP addresses (RFC 5732 Section 3.2.1)
   * OPTIONAL - MUST be provided jika host adalah subordinate
   * (host name berada di bawah domain yang di-host)
   * 
   * Contoh subordinate: ns1.example.com untuk domain example.com
   * Contoh external: ns1.otherdomain.com untuk domain example.com
   */
  addr?: HostAddress[];
}

/**
 * Host Update Request
 * Referensi: RFC 5732 Section 3.2.5 - EPP <update> Command
 * 
 * Update command mengubah information terkait host object.
 * Elements dapat di-add, removed, atau changed.
 */
export interface HostUpdateRequest {
  /** 
   * Host name untuk diupdate (RFC 5732 Section 3.2.5)
   * REQUIRED
   */
  name: string;
  
  /** 
   * Elements untuk ditambahkan (RFC 5732 Section 3.2.5)
   * OPTIONAL <add> element
   */
  add?: {
    /** 
     * IP addresses untuk ditambahkan (RFC 5732 Section 3.2.5)
     * Hanya applicable untuk subordinate hosts
     */
    addr?: HostAddress[];
    
    /** 
     * Status values untuk ditambahkan (RFC 5732 Section 2.3)
     * Values: 'clientDeleteProhibited', 'clientUpdateProhibited'
     */
    status?: string[];
  };
  
  /** 
   * Elements untuk dihapus (RFC 5732 Section 3.2.5)
   * OPTIONAL <rem> element
   */
  rem?: {
    /** IP addresses untuk dihapus */
    addr?: HostAddress[];
    /** Status values untuk dihapus */
    status?: string[];
  };
  
  /** 
   * Elements untuk diubah (RFC 5732 Section 3.2.5)
   * OPTIONAL <chg> element
   */
  chg?: {
    /** 
     * New host name (RFC 5732 Section 3.2.5)
     * MUST be within same domain or both old dan new names
     * MUST be subordinate atau both MUST be external
     */
    name?: string;
  };
}

/**
 * Host Information Response
 * Referensi: RFC 5732 Section 3.1.2 - EPP <info> Response
 * 
 * Info response berisi detailed information tentang host object.
 */
export interface HostInfo {
  /** 
   * Fully qualified host name (RFC 5732 Section 3.1.2)
   */
  name: string;
  
  /** 
   * Repository Object IDentifier (RFC 5732 Section 3.1.2)
   * Unique identifier assigned by server
   */
  roid: string;
  
  /** 
   * Host status codes (RFC 5732 Section 2.3)
   * Possible values:
   * - 'clientDeleteProhibited', 'clientUpdateProhibited'
   * - 'serverDeleteProhibited', 'serverUpdateProhibited'
   * - 'linked', 'ok', 'pendingCreate', 'pendingDelete',
   * - 'pendingTransfer', 'pendingUpdate'
   * 
   * Note: 'linked' status indicates host digunakan sebagai nameserver
   * oleh at least one domain
   */
  status: string[];
  
  /** 
   * IP addresses (RFC 5732 Section 3.1.2)
   * Present hanya jika host adalah subordinate host
   */
  addr?: HostAddress[];
  
  /** 
   * Sponsoring client identifier (RFC 5732 Section 3.1.2)
   * Client yang currently sponsors host object
   */
  clID: string;
  
  /** 
   * Creating client identifier (RFC 5732 Section 3.1.2)
   * Client yang originally created host object
   */
  crID: string;
  
  /** 
   * Creation date (RFC 5732 Section 3.1.2)
   * ISO 8601 format: YYYY-MM-DDThh:mm:ss.sssZ
   */
  crDate: string;
  
  /** 
   * Last updating client identifier (RFC 5732 Section 3.1.2)
   * OPTIONAL - Present jika host pernah diupdate
   */
  upID?: string;
  
  /** 
   * Last update date (RFC 5732 Section 3.1.2)
   * OPTIONAL - ISO 8601 format
   * Present jika host pernah diupdate
   */
  upDate?: string;
  
  /** 
   * Last transfer date (RFC 5732 Section 3.1.2)
   * OPTIONAL - ISO 8601 format
   * Present jika host pernah ditransfer
   */
  trDate?: string;
}