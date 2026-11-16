import type { CommandOptions, ObjectStatus, StatusInput } from './Common';

/** Host IP address. `type` is detected from the address when omitted. */
export interface HostAddress {
  ip: string;
  type?: 'v4' | 'v6';
}

/** Result of a host check (RFC 5732 Section 3.1.1). */
export interface HostCheckResult {
  name: string;
  available: boolean;
  reason?: string;
}

/** Host data returned by an info command (RFC 5732 Section 3.1.2). */
export interface HostInfo {
  name: string;
  roid: string;
  status: string[];
  statusDetails: ObjectStatus[];
  addr: Array<{ ip: string; type: 'v4' | 'v6' }>;
  clID: string;
  crID: string;
  crDate: string;
  upID?: string;
  upDate?: string;
  trDate?: string;
}

/**
 * Host create (RFC 5732 Section 3.2.1). Addresses are required for hosts
 * subordinate to a domain in the same registry (glue) and should be omitted
 * for external hosts.
 */
export interface HostCreateRequest extends CommandOptions {
  name: string;
  addr?: Array<HostAddress | string>;
}

/** Result of a host create. */
export interface HostCreateResult {
  name: string;
  crDate: string;
}

/** Addresses and statuses added to or removed from a host. */
export interface HostAddRemove {
  addr?: Array<HostAddress | string>;
  /** Up to 7 status values. */
  status?: StatusInput[];
}

/** Host update (RFC 5732 Section 3.2.5). */
export interface HostUpdateRequest extends CommandOptions {
  name: string;
  add?: HostAddRemove;
  rem?: HostAddRemove;
  /** Rename the host. */
  chg?: { name: string };
}
