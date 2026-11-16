# Standards and ICANN compliance

This document lists the specifications epp-ts implements, how that is verified, and how the
features map to the EPP requirements ICANN places on gTLD registries and registrars.

ICANN accredits registrars and contracts registries; it does not certify client libraries.
What a library can do is implement the protocol requirements correctly, so that a registrar
building on it can meet its obligations. Registry policies (required contacts, period limits,
premium pricing, IDN tables) still apply and are enforced by each registry's server.

## How conformance is verified

- **Schema validation.** The test suite generates every command the client supports, in every
  variant it can produce, and validates the XML with libxml2 against the official schemas from
  the IANA XML registry ([test/schemas](../test/schemas)). The schemas check element order,
  namespaces, cardinality and value types, as a strict server does.
- **RFC examples.** Response parsing is tested on fixtures modelled on the RFC examples, and the
  fixtures themselves are validated against the same schemas.
- **Transport.** Integration tests run the client against an in-process TLS server using RFC
  5734 framing, covering mutual TLS, certificate checks, timeouts, malformed frames and
  connection loss.

Run them with `npm test`.

## Specifications

| Specification | Implemented | Notes |
|---------------|-------------|-------|
| RFC 5730, EPP | Greeting, hello, login, logout, poll, result codes, message queue | Login negotiates services from the greeting (Section 2.9.1.1). Every `<result>`, `<value>` and `<extValue>` is returned. |
| RFC 5731, Domain mapping | check, info, create, update, renew, delete, transfer | Host objects and host attributes; `hosts` info filter; empty registrant and `<domain:null/>` authInfo in updates. |
| RFC 5732, Host mapping | check, info, create, update, delete | IPv4 and IPv6 glue; IP version detected from the address. |
| RFC 5733, Contact mapping | check, info, create, update, delete, transfer | `int` and `loc` postal info; disclosure preferences; E.164 phone numbers with extensions. |
| RFC 5734, Transport over TCP | Yes | TLS 1.2 or later by default, server certificate and name verification, mutual TLS, frame length validation. |
| RFC 5910, DNSSEC | `secDNS-1.1` | DS and key data interfaces; `rem`/`add`/`chg` in schema order; `urgent`. |
| RFC 3915, Grace Period | `rgp-1.0` | Status parsing; restore request; restore report with the required statements. |
| RFC 8334, Launch Phase | `launch-1.0` | Claims, availability and trademark checks; sunrise with encoded SMDs or codes; claims notices; application info, update, delete. |
| RFC 7848, Mark and Signed Mark | Encoded signed marks | Mark objects in launch info are returned as XML. |
| RFC 8748, Registry Fee | `epp:fee-1.0` | Check, transform commands, credits, balance. |
| RFC 8807, Login Security | `epp:loginSec-1.0` | Long passwords, user agent, security events. |
| RFC 8590, Change Poll | `changePoll-1.0` | Parsed from poll messages. |
| RFC 8495, Allocation Token | `allocationToken-1.0` | Check, create, transfer, update, info. |
| RFC 9154, Secure Authorization Information | Partly | Unset authInfo with `<domain:null/>`; `generateAuthInfo()` uses a secure random generator. Policy such as authInfo time limits is the registry's. |
| RFC 9361, TMCH Functional Specifications | Helpers | TCNID checksum verification; SMD file parsing. |

## ICANN gTLD requirements

### EPP standards (Registry Agreement, Specification 6)

The base gTLD Registry Agreement requires registries to implement EPP according to RFCs 5730,
5731, 5732 (when using host objects), 5733 and 5734, RFC 5910 for DNSSEC, and RFC 3915 when they
offer grace periods. epp-ts implements all of these on the client side, so it works with any
registry that follows the agreement. Registry-specific extensions, which the agreement requires
registries to document, can be sent with the `extensions` option.

### DNSSEC

Registries must accept DNSSEC data from registrars. `domainCreate()` and `domainUpdate()` carry
DS or key data (whichever interface the registry uses), and `domainInfo()` returns what the
registry holds. See [DNSSEC_GUIDE.md](DNSSEC_GUIDE.md).

### Grace periods and restores

gTLD registries handle the domain life cycle with the RFC 3915 grace periods: add, renew,
auto-renew, transfer, redemption and pending delete. The redemption period is what lets a
registrant recover a deleted name, as ICANN's expired-registration policies expect. `domainInfo()` reports
the current RGP status, and `domainRestore()` performs the two-step restore (request, then
report). `validateRestoreReport()` checks that the report contains every element and both
statements before it is sent.

### Rights protection: sunrise and claims

ICANN's Rights Protection Mechanism Requirements oblige new gTLDs to run a sunrise period and a
trademark claims period using the Trademark Clearinghouse:

- **Sunrise.** Registrars submit the Signed Mark Data (SMD) a mark holder received from the TMCH.
  `parseSmdFile()` extracts it from the SMD file exactly as RFC 9361 Section 6.4 prescribes, and
  `domainCreate({ launch: { phase: 'sunrise', encodedSignedMark } })` submits it.
- **Claims.** Registrars must check whether a name matches a mark, show the claims notice, and
  record the registrant's acceptance. `domainCheck(..., { launch: { type: 'claims' } })` returns
  the claim keys, `verifyTcnId()` checks the notice identifier against the domain and expiry as
  registries do (RFC 9361 Section 5.3.2), and `domainCreate({ launch: { notice } })` sends the
  notice ID, expiry and acceptance time.

### Transfers

The Transfer Policy relies on authorization codes and the EPP transfer commands. `domainTransfer()`
supports all five operations, poll messages deliver transfer notifications (`domain:trnData`), and
`generateAuthInfo()` creates random codes.

### Registration data

ICANN's Registration Data Policy limits the contact data registrars collect and transfer. RFC 5731
makes the registrant and contacts optional on domain create, and epp-ts does not require them, so
the registrar can send exactly what the registry's policy asks for. Contact disclosure preferences
(RFC 5733 Section 2.9) are supported.

### Internationalized domain names

Registries expect IDNs in A-label form. `toAsciiDomain()` converts U-labels to A-labels and
`toUnicodeDomain()` converts back. IDN table or language tags are registry-specific extensions;
send them with the `extensions` option.

### Premium names

Most gTLD registries price premium names through RFC 8748. `feeCheck()` returns the price and fee
class, and the `fee` option on create, renew, transfer and restore confirms the amount the
registrar accepts.

## Not implemented

- EPP extensions not listed above, such as the organization mapping (RFC 8543) and the older
  secDNS-1.0 and fee drafts. Registry-specific extensions can be sent with `extensions`, and
  `sendRaw()` sends any document.
- Building `<mark:mark>` objects for mark-code sunrise registrations (codes and encoded signed
  marks are supported).
- Several simultaneous sessions from one client. Create one `EppClient` per session.
