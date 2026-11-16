# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-16

First public release, published to npm as `epp-ts`.

1.0.0 replaces the unpublished pre-release code that was previously in this repository. That
code generated XML that registries reject for most write commands and could not parse server
responses (see [Fixed](#fixed)). Code written against it needs the changes listed under
[Changed](#changed).

### Added

- Full client for EPP over TLS: RFC 5730 (session, poll, result handling), RFC 5731 (domain),
  RFC 5732 (host), RFC 5733 (contact) and RFC 5734 (transport).
- Extensions:
  - DNSSEC, RFC 5910 (`secDNS-1.1`): DS or key data on create, update (`rem`, `add`, `chg`,
    `urgent`) and info.
  - Registry Grace Period, RFC 3915 (`rgp-1.0`): status on info and update, and the new
    `domainRestore()` for restore requests and restore reports.
  - Launch Phase, RFC 8334 (`launch-1.0`) with RFC 7848 marks: claims, availability and
    trademark checks; sunrise creates with encoded signed marks or mark codes; claims notice
    acceptance; application info, update and delete.
  - Registry Fee, RFC 8748 (`epp:fee-1.0`): fee checks; fees on create, renew, transfer, update
    and restore; balance, credit and credit limit in responses.
  - Login Security, RFC 8807 (`epp:loginSec-1.0`): passwords longer than 16 characters, user
    agent, and security events in the login response.
  - Change Poll, RFC 8590 (`changePoll-1.0`): parsed from poll messages.
  - Allocation Token, RFC 8495 (`allocationToken-1.0`): tokens on check, create, transfer and
    update, and token info.
- Service negotiation: login announces the object and extension services the client implements
  that the server lists in its greeting. `additionalExtURIs` adds registry-specific extensions
  the server offers; `objURIs` and `extURIs` replace the negotiated lists. Using an extension
  that was not announced fails before sending.
- Typed response data for every command and for poll messages (`PollMessageData`); all
  `<result>` elements with `<value>` and `<extValue>`; message queue details; parsed extension
  data; the raw response XML.
- Error classes extending `Error`: `EppError`, `EppCommandError`, `EppConnectionError`,
  `EppTimeoutError`, `EppProtocolError` and `EppValidationError`.
- Transport: commands are queued so concurrent calls each receive their own response; responses
  are matched by clTRID; `connectTimeout`; `maxFrameSize`; `keepAliveInterval` (sends
  `<hello>`); `autoReconnect`; `tlsOptions`; `greeting`, `close` and `reconnect` events.
- `hello()`, `sendRaw()`, `isLoggedIn()` and `getServices()`.
- Registry-specific extensions through the `extensions` option and the `el()` element builder;
  elements must declare their namespace. Unknown extension data is returned in
  `response.extensions.unknown` and can be read with `parseXml()`.
- Debug logging through `debug` or a custom `logger`, with secrets redacted; `redactXml()`.
- TMCH helpers per RFC 9361: `verifyTcnId()`, `computeTcnChecksum()`, `parseSmdFile()` and
  `extractEncodedSmd()`.
- Helpers: `generateAuthInfo()`, `toAsciiDomain()`, `toUnicodeDomain()`, `normalizeDomain()`,
  `sumFeeAmounts()`, input validators, `EppResultCode`, `EppStatus`, `getEppResultMessage()`,
  `NS`.
- Tests: every command the client generates and every response fixture is validated against
  the official IANA XML schemas; response fixtures follow the RFC examples; integration tests
  run the client against an in-process TLS server, including mutual TLS.
- CI on Node.js 18, 20, 22 and 24; `CHANGELOG.md` and `docs/COMPLIANCE.md`.

### Changed

These changes affect code written against the pre-release API.

- The package is named `epp-ts` (`epp-client` is taken on npm) and exposes only its main
  entry point through `exports`.
- `connect()` resolves with the server greeting.
- Errors are `EppError` subclasses (real `Error` instances with stack traces) instead of plain
  objects. `error.code` keeps its meaning: the EPP result code, or 0 for client-side errors.
  Connection and TLS setup failures, including unusable key material, are `EppConnectionError`
  with Node's error in `cause`.
- `calculateTotalFees()` adds amounts in exact decimal arithmetic.
- `DNSSEC_ALGORITHMS` and `DNSSEC_DIGEST_TYPES` are typed as number-indexed records.
- `EppResponse.data` contains typed objects instead of raw parser output. Extension data is in
  `response.extensions`; for example DNSSEC info moved from `data.dnssec` to
  `extensions.secDNS`.
- `DomainCreateRequest`: `period`, `registrant` and `contacts` are optional, as in RFC 5731.
  `period` also accepts a number of years and `ns` a list of host names.
- `DnssecUpdate`: `add.maxSigLife` was removed because RFC 5910 changes it through
  `chg.maxSigLife`; the update is sent in the schema order `rem`, `add`, `chg`.
- `feeCheck()` uses RFC 8748 instead of the fee-0.11 draft. `FeeCheckRequest` takes `domain`,
  `command` (one or more), `period` and `currency`.
- Launch types were restructured around the RFC elements: `LaunchCreate`, `LaunchCheck`,
  `LaunchInfoRequest`, `LaunchIdContainer` and their response types.
- Contact info always returns `postalInfo` as an array. Requests accept `disclose.flag` as a
  boolean and phone numbers as `{ number, ext }`.
- `isValidSMDFormat()` checks the RFC 7848 identifier format (for example `1-2`), and
  `isValidNoticeID()` checks the RFC 9361 TCNID format.
- `validateRestoreReport()` treats `preData` and `postData` as registration data rather than
  dates, requires the two statements RFC 3915 asks for, and checks that `delTime` is not after
  `resTime`.
- `getEppCodeCategory()` returns the RFC 5730 categories (`protocolSyntax`, `security`,
  `dataManagement`, ...), and `EppStatus` lists the RFC 5731-5733 status values.
- TypeScript is no longer a peer dependency.

### Fixed

- Every response failed to parse, so each command, including `login()`, rejected even when the
  server reported success.
- Create, update and renew commands and fee checks sent unprefixed child elements in a structure
  that does not match the RFC schemas, and DNSSEC data leaked into `<domain:create>`.
- `<extension>` was written after `<clTRID>`; the schema requires it before.
- Check responses with a single result failed to parse, and poll responses never returned the
  message queue.
- A data unit announcing a length of 0 made the client loop forever; incoming frames had no
  size limit.
- Concurrent commands could receive each other's responses, and a command whose connection was
  closed waited for the full timeout.
- Login always announced fee-0.11 and secDNS-1.1, which registries that do not offer them
  reject.
- SNI was sent for IP-address hosts.
- `npm run lint` failed on a configuration error, and one test depended on the current date.

### Removed

- The `axios` and `xml2js` dependencies; `sax` is the only runtime dependency.
- Internal pre-release modules: `EppRequest`, `XmlBuilder`, `XmlParser`, the `EppResponse`
  placeholder class and the unused builders in `src/commands/`.
- `FEE_NAMESPACE_0_11`, and `TMCH_NAMESPACE`, which was not an IETF namespace (use
  `MARK_NAMESPACE` and `SIGNED_MARK_NAMESPACE`).
- Type definitions with no protocol counterpart, such as `RgpPollMessage` and the fee-0.11
  request types.
- Outdated implementation notes from `docs/`.

### Security

- Debug logs replace passwords, authorization info and allocation tokens with `***`.
- `generateAuthInfo()` uses a cryptographically secure random generator.
- The XML parser rejects DOCTYPE declarations, ruling out entity-expansion attacks.
- Frames above `maxFrameSize` close the connection instead of being buffered.

[1.0.0]: https://github.com/al0fayz/epp-ts/releases/tag/v1.0.0
