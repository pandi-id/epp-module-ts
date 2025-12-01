/**
 * Domain Check Request
 * Referensi: RFC 5731 Section 3.1.1 - EPP <check> Command
 * 
 * Check command digunakan untuk menentukan apakah object dapat di-provisioned
 * dengan server. Mendukung pengecekan multiple domain names dalam satu command.
 */
export interface DomainCheckRequest {
  /** 
   * Array of domain names untuk dicek (RFC 5731 Section 3.1.1)
   * MUST be fully qualified domain names (FQDNs)
   * Maximum biasanya 10-20 domains per request (server-dependent)
   */
  domains: string[];
}

/**
 * Domain Check Result
 * Referensi: RFC 5731 Section 3.1.1 - EPP <check> Response
 */
export interface DomainCheckResult {
  /** Fully qualified domain name */
  name: string;
  
  /** 
   * Availability status (RFC 5731 Section 3.1.1)
   * true = domain available untuk registration
   * false = domain sudah terdaftar atau reserved
   */
  available: boolean;
  
  /** Optional: Reason jika domain tidak available */
  reason?: string;
}

/**
 * IP Address Information
 * Referensi: RFC 5732 Section 2.2 - Host Address
 */
export interface IpAddress {
  /** IP address value */
  ip: string;
  
  /** 
   * IP version (RFC 5732 Section 2.2)
   * 'v4' = IPv4 address (e.g., "192.0.2.1")
   * 'v6' = IPv6 address (e.g., "2001:db8::1")
   */
  type: 'v4' | 'v6';
}

/**
 * Host Object or Attributes
 * Referensi: RFC 5731 Section 1.1 - Relationship to Other Protocols
 * 
 * Domain dapat menggunakan:
 * - Host objects (subordinate or external hosts by name)
 * - Host attributes (subordinate hosts dengan IP addresses)
 */
export interface NameServer {
  /** 
   * Host objects - Array of host names (RFC 5731 Section 1.1)
   * Digunakan untuk external nameservers atau subordinate hosts tanpa IP
   * Example: ['ns1.example.com', 'ns2.example.com']
   */
  hostObj?: string[];
  
  /** 
   * Host attributes - Subordinate hosts dengan IP addresses (RFC 5731 Section 1.1)
   * Digunakan untuk glue records (subordinate nameservers)
   */
  hostAttr?: Array<{
    /** Fully qualified host name */
    hostName: string;
    /** Array of IP addresses untuk host ini */
    hostAddr: IpAddress[];
  }>;
}

/**
 * Domain Contact
 * Referensi: RFC 5731 Section 2.2 - Contact and Client Identifiers
 * 
 * Domain MUST memiliki at least one contact. Contact types:
 * - admin: Administrative contact
 * - tech: Technical contact  
 * - billing: Billing contact (optional, server-dependent)
 */
export interface DomainContact {
  /** 
   * Contact type (RFC 5731 Section 2.2)
   * 'admin' = Administrative contact (REQUIRED oleh beberapa registries)
   * 'tech' = Technical contact (REQUIRED oleh beberapa registries)
   * 'billing' = Billing contact (OPTIONAL)
   */
  type: 'admin' | 'tech' | 'billing';
  
  /** Contact object identifier */
  id: string;
}

/**
 * Domain Create Request
 * Referensi: RFC 5731 Section 3.2.1 - EPP <create> Command
 * 
 * Create command digunakan untuk provision instance dari domain object.
 * Semua required attributes MUST disediakan pada saat creation.
 */
export interface DomainCreateRequest {
  /** 
   * Fully qualified domain name (RFC 5731 Section 3.2.1)
   * MUST conform to host name syntax (RFC 952, RFC 1123)
   * Example: 'example.com'
   */
  name: string;
  
  /** 
   * Registration period (RFC 5731 Section 3.2.1)
   * MUST be specified in years or months
   * Server MAY limit min/max period
   */
  period: {
    value: number;
    unit: 'y' | 'm';
  };
  
  /** 
   * Nameservers for the domain (RFC 5731 Section 1.1)
   * OPTIONAL - Can be added later via update command
   * Most registries REQUIRE at least 2 nameservers
   */
  ns?: NameServer;
  
  /** 
   * Registrant contact identifier (RFC 5731 Section 3.2.1)
   * REQUIRED - Contact object yang owns the domain
   */
  registrant: string;
  
  /** 
   * Additional contacts (RFC 5731 Section 3.2.1)
   * REQUIRED by most registries - At least admin dan tech contacts
   */
  contacts: DomainContact[];
  
  /** 
   * Authorization information (RFC 5731 Section 3.2.1)
   * REQUIRED - Used untuk transfer authorization
   */
  authInfo: {
    pw: string;
  };

  /**
   * DNSSEC Extension (RFC 5910)
   * OPTIONAL - DNSSEC delegation signer (DS) data atau key data
   * Used untuk secure the domain dengan DNSSEC
   */
  dnssec?: {
    maxSigLife?: number;
    dsData?: Array<{
      keyTag: number;
      alg: number;
      digestType: number;
      digest: string;
    }>;
    keyData?: Array<{
      flags: number;
      protocol: number;
      alg: number;
      pubKey: string;
    }>;
  };
}

/**
 * Domain Update Request
 * Referensi: RFC 5731 Section 3.2.5 - EPP <update> Command
 * 
 * Update command mengubah information terkait domain object.
 * Elements dapat di-add, removed, atau changed.
 */
export interface DomainUpdateRequest {
  /** Domain name untuk diupdate (RFC 5731 Section 3.2.5) */
  name: string;
  
  /** 
   * Elements untuk ditambahkan (RFC 5731 Section 3.2.5)
   * OPTIONAL <add> element
   */
  add?: {
    /** Nameservers untuk ditambahkan */
    ns?: NameServer;
    /** Contacts untuk ditambahkan */
    contacts?: DomainContact[];
    /** 
     * Status values untuk ditambahkan (RFC 5731 Section 2.3)
     * Values: 'clientDeleteProhibited', 'clientHold', 'clientRenewProhibited',
     *         'clientTransferProhibited', 'clientUpdateProhibited'
     */
    status?: string[];
  };
  
  /** 
   * Elements untuk dihapus (RFC 5731 Section 3.2.5)
   * OPTIONAL <rem> element
   */
  rem?: {
    /** Nameservers untuk dihapus */
    ns?: NameServer;
    /** Contacts untuk dihapus */
    contacts?: DomainContact[];
    /** Status values untuk dihapus */
    status?: string[];
  };
  
  /** 
   * Elements untuk diubah (RFC 5731 Section 3.2.5)
   * OPTIONAL <chg> element
   */
  chg?: {
    /** New registrant contact */
    registrant?: string;
    /** New authorization information */
    authInfo?: {
      pw: string;
    };
  };

  /**
   * DNSSEC Extension (RFC 5910)
   * OPTIONAL - Add, remove, atau change DNSSEC data
   */
  dnssec?: {
    add?: {
      dsData?: Array<{
        keyTag: number;
        alg: number;
        digestType: number;
        digest: string;
      }>;
      keyData?: Array<{
        flags: number;
        protocol: number;
        alg: number;
        pubKey: string;
      }>;
      maxSigLife?: number;
    };
    rem?: {
      all?: boolean;
      dsData?: Array<{
        keyTag: number;
        alg: number;
        digestType: number;
        digest: string;
      }>;
      keyData?: Array<{
        flags: number;
        protocol: number;
        alg: number;
        pubKey: string;
      }>;
    };
    chg?: {
      maxSigLife?: number;
    };
    urgent?: boolean;
  };
}

/**
 * Domain Renew Request
 * Referensi: RFC 5731 Section 3.2.3 - EPP <renew> Command
 * 
 * Renew command extends registration period dari domain object.
 */
export interface DomainRenewRequest {
  /** Domain name untuk direnew */
  name: string;
  
  /** 
   * Current expiration date (RFC 5731 Section 3.2.3)
   * REQUIRED - Format: YYYY-MM-DD
   * Server menggunakan ini untuk verify current state
   */
  curExpDate: string;
  
  /** 
   * Renewal period (RFC 5731 Section 3.2.3)
   * Number of years or months untuk extend registration
   */
  period: {
    value: number;
    unit: 'y' | 'm';
  };
}

/**
 * Domain Transfer Request
 * Referensi: RFC 5731 Section 3.2.4 - EPP <transfer> Command
 * 
 * Transfer command provides query dan transform operations untuk domain transfers.
 */
export interface DomainTransferRequest {
  /** Domain name untuk ditransfer */
  name: string;
  
  /** 
   * Transfer operation (RFC 5731 Section 3.2.4)
   * 'query' = Query transfer status
   * 'request' = Request transfer
   * 'cancel' = Cancel pending transfer
   * 'approve' = Approve transfer request
   * 'reject' = Reject transfer request
   */
  op: 'query' | 'request' | 'cancel' | 'approve' | 'reject';
  
  /** 
   * Optional: Registration period untuk transfer (RFC 5731 Section 3.2.4)
   * REQUIRED untuk 'request' operation jika server requires renewal on transfer
   */
  period?: {
    value: number;
    unit: 'y' | 'm';
  };
  
  /** 
   * Authorization information (RFC 5731 Section 3.2.4)
   * REQUIRED untuk 'request' operation
   */
  authInfo?: {
    pw: string;
    roid?: string;
  };
}

/**
 * Domain Information Response
 * Referensi: RFC 5731 Section 3.1.2 - EPP <info> Response
 * 
 * Info response berisi detailed information tentang domain object.
 */
export interface DomainInfo {
  /** Fully qualified domain name (RFC 5731 Section 3.1.2) */
  name: string;
  
  /** 
   * Repository Object IDentifier (RFC 5731 Section 3.1.2)
   * Unique identifier assigned by server
   */
  roid: string;
  
  /** 
   * Domain status codes (RFC 5731 Section 2.3)
   * Possible values:
   * - 'clientDeleteProhibited', 'clientHold', 'clientRenewProhibited',
   * - 'clientTransferProhibited', 'clientUpdateProhibited'
   * - 'serverDeleteProhibited', 'serverHold', 'serverRenewProhibited',
   * - 'serverTransferProhibited', 'serverUpdateProhibited'
   * - 'inactive', 'ok', 'pendingCreate', 'pendingDelete',
   * - 'pendingRenew', 'pendingTransfer', 'pendingUpdate'
   */
  status: string[];
  
  /** Registrant contact identifier (RFC 5731 Section 3.1.2) */
  registrant: string;
  
  /** Additional contacts (RFC 5731 Section 3.1.2) */
  contacts: DomainContact[];
  
  /** Nameservers (RFC 5731 Section 3.1.2) */
  ns?: NameServer;
  
  /** Sponsoring client identifier (RFC 5731 Section 3.1.2) */
  clID: string;
  
  /** Creating client identifier (RFC 5731 Section 3.1.2) */
  crID: string;
  
  /** Creation date (RFC 5731 Section 3.1.2) - ISO 8601 format */
  crDate: string;
  
  /** Last updating client identifier (RFC 5731 Section 3.1.2) */
  upID?: string;
  
  /** Last update date (RFC 5731 Section 3.1.2) - ISO 8601 format */
  upDate?: string;
  
  /** Expiration date (RFC 5731 Section 3.1.2) - ISO 8601 format */
  exDate: string;
  
  /** Last transfer date (RFC 5731 Section 3.1.2) - ISO 8601 format */
  trDate?: string;
  
  /** Authorization information (RFC 5731 Section 3.1.2) */
  authInfo?: {
    pw: string;
  };

  /**
   * DNSSEC Extension (RFC 5910)
   * OPTIONAL - DNSSEC delegation signer information
   */
  dnssec?: {
    maxSigLife?: number;
    dsData?: Array<{
      keyTag: number;
      alg: number;
      digestType: number;
      digest: string;
      keyData?: {
        flags: number;
        protocol: number;
        alg: number;
        pubKey: string;
      };
    }>;
    keyData?: Array<{
      flags: number;
      protocol: number;
      alg: number;
      pubKey: string;
    }>;
  };
}