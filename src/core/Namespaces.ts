/**
 * XML namespace URIs of the EPP mappings and extensions this client speaks,
 * as registered in the IANA XML registry.
 */
export const NS = {
  /** RFC 5730 - EPP core. */
  epp: 'urn:ietf:params:xml:ns:epp-1.0',
  /** RFC 5730 - EPP common types. */
  eppcom: 'urn:ietf:params:xml:ns:eppcom-1.0',
  /** RFC 5731 - Domain name mapping. */
  domain: 'urn:ietf:params:xml:ns:domain-1.0',
  /** RFC 5732 - Host mapping. */
  host: 'urn:ietf:params:xml:ns:host-1.0',
  /** RFC 5733 - Contact mapping. */
  contact: 'urn:ietf:params:xml:ns:contact-1.0',
  /** RFC 5910 - DNSSEC extension. */
  secDNS: 'urn:ietf:params:xml:ns:secDNS-1.1',
  /** RFC 3915 - Registry Grace Period extension. */
  rgp: 'urn:ietf:params:xml:ns:rgp-1.0',
  /** RFC 8334 - Launch Phase extension. */
  launch: 'urn:ietf:params:xml:ns:launch-1.0',
  /** RFC 7848 - Mark objects. */
  mark: 'urn:ietf:params:xml:ns:mark-1.0',
  /** RFC 7848 - Signed mark objects. */
  signedMark: 'urn:ietf:params:xml:ns:signedMark-1.0',
  /** RFC 8748 - Registry Fee extension. */
  fee: 'urn:ietf:params:xml:ns:epp:fee-1.0',
  /** RFC 8807 - Login Security extension. */
  loginSec: 'urn:ietf:params:xml:ns:epp:loginSec-1.0',
  /** RFC 8590 - Change Poll extension. */
  changePoll: 'urn:ietf:params:xml:ns:changePoll-1.0',
  /** RFC 8495 - Allocation Token extension. */
  allocationToken: 'urn:ietf:params:xml:ns:allocationToken-1.0',
} as const;

/** Object services announced at login when the server offers them. */
export const DEFAULT_OBJECT_URIS: readonly string[] = [NS.domain, NS.contact, NS.host];

/** Extension services this client implements, announced at login when the server offers them. */
export const SUPPORTED_EXTENSION_URIS: readonly string[] = [
  NS.secDNS,
  NS.rgp,
  NS.launch,
  NS.fee,
  NS.loginSec,
  NS.changePoll,
  NS.allocationToken,
];
