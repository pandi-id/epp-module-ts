# epp-ts

[![npm](https://img.shields.io/npm/v/epp-ts.svg)](https://www.npmjs.com/package/epp-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A TypeScript client for the Extensible Provisioning Protocol (EPP), for registrars and registry tooling on Node.js.

- Speaks EPP over TLS (RFC 5734) with the domain, contact and host mappings (RFC 5730-5733).
- Supports the extensions ICANN gTLD registries rely on: DNSSEC, grace-period restores, sunrise and claims through the Trademark Clearinghouse, and registry fees.
- The test suite validates every command the client can generate against the official IANA XML schemas, so the XML is checked by the same rules a strict registry server applies.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Supported standards](#supported-standards)
- [Configuration](#configuration)
- [Usage](#usage)
- [Error handling](#error-handling)
- [Logging](#logging)
- [Registry-specific extensions](#registry-specific-extensions)
- [Helpers](#helpers)
- [Development](#development)
- [License](#license)

## Installation

```bash
npm install epp-ts
```

Requires Node.js 18 or later. The only runtime dependency is [`sax`](https://www.npmjs.com/package/sax).

## Quick start

```typescript
import { EppClient, EppCommandError } from 'epp-ts';

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
});

try {
  await client.connect();   // TLS handshake and server greeting
  await client.login();     // announces the services both sides support

  const { data } = await client.domainCheck(['example.com', 'example.net']);
  console.log(data);        // [{ name: 'example.com', available: true }, ...]

  await client.logout();
} catch (error) {
  if (error instanceof EppCommandError) {
    console.error(error.code, error.message);   // e.g. 2302 "EPP 2302: Object exists"
  }
  throw error;
} finally {
  await client.disconnect();
}
```

## Supported standards

| Specification | Namespace | Coverage |
|---------------|-----------|----------|
| RFC 5730 EPP | `epp-1.0` | Greeting, hello, login (with password change), logout, poll req/ack, all result codes |
| RFC 5731 Domain | `domain-1.0` | check, info, create, update, renew, delete, transfer (request, query, approve, reject, cancel) |
| RFC 5732 Host | `host-1.0` | check, info, create, update, delete |
| RFC 5733 Contact | `contact-1.0` | check, info, create, update, delete, transfer, disclosure preferences |
| RFC 5734 Transport | | TLS 1.2+, mutual TLS, framing with length validation |
| RFC 5910 DNSSEC | `secDNS-1.1` | DS and key data on create, update (rem/add/chg, urgent) and info |
| RFC 3915 Grace Period | `rgp-1.0` | Status on info, restore request, restore report |
| RFC 8334 Launch Phase | `launch-1.0` | Claims/availability/trademark checks, sunrise (encoded SMD, mark codes), claims notice acceptance, application info/update/delete |
| RFC 7848 Marks | `mark-1.0`, `signedMark-1.0` | Encoded signed marks; marks returned by launch info |
| RFC 8748 Fees | `epp:fee-1.0` | Fee check; fees on create, renew, transfer, update and restore; balances and credits |
| RFC 8807 Login Security | `epp:loginSec-1.0` | Passwords longer than 16 characters, user agent, security events |
| RFC 8590 Change Poll | `changePoll-1.0` | Parsed from poll messages |
| RFC 8495 Allocation Token | `allocationToken-1.0` | Tokens on check, create, transfer and update; token info |
| RFC 9361 TMCH | | TCNID verification, SMD file parsing |

At login the client announces only the object and extension services it implements that the server also lists in its greeting (RFC 5730 Section 2.9.1.1). Using an extension that was not announced raises an `EppValidationError` before anything is sent.

[docs/COMPLIANCE.md](docs/COMPLIANCE.md) maps these standards and the ICANN gTLD requirements to the client's features.

## Configuration

```typescript
const client = new EppClient({
  host: 'epp.registry.example',
  port: 700,                       // default, the IANA-assigned EPP port
  username: 'registrar-id',
  password: 'secret',
  timeout: 30000,                  // ms to wait for each response
  clientCert: fs.readFileSync('client.pem'),   // mutual TLS
  clientKey: fs.readFileSync('client-key.pem'),
  keepAliveInterval: 5 * 60 * 1000,             // send <hello> when idle
  autoReconnect: true,
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `host` | required | Server hostname. |
| `port` | `700` | Server port. |
| `username`, `password` | required | Client ID (3-16 characters) and password. Passwords longer than 16 characters need a server that supports loginSec. |
| `lang`, `version` | `'en'`, `'1.0'` | Language and protocol version requested at login. |
| `timeout` | `30000` | Milliseconds to wait for a response. A timed-out connection is closed, because a late response would otherwise be read as the reply to the next command. |
| `connectTimeout` | `timeout` | Milliseconds to wait for the TLS handshake and greeting. |
| `clientCert`, `clientKey`, `passphrase` | | Client certificate for mutual TLS. |
| `ca` | Node's root store | CA certificates trusted for the server. |
| `rejectUnauthorized` | `true` | Verify the server certificate chain. |
| `checkServerIdentity` | `true` | Verify that the certificate matches `servername`. |
| `servername` | `host` | Name used for SNI and certificate checks. |
| `minVersion`, `maxVersion` | `'TLSv1.2'`, unset | TLS version range. |
| `ciphers` | Node's default | OpenSSL cipher list. |
| `tlsOptions` | | Extra options for `tls.connect()`, applied last. |
| `objURIs`, `extURIs` | negotiated | Services to announce at login, overriding negotiation. |
| `additionalExtURIs` | | Registry-specific extensions to announce as well, when the server offers them. |
| `userAgent` | library and Node.js version | User agent sent through loginSec; `false` sends none. |
| `keepAliveInterval` | `0` (off) | Send `<hello>` after this many idle milliseconds. |
| `autoReconnect` | `false` | Reconnect and log in again before the next command after the connection drops. A command that was in flight is not retried. |
| `maxFrameSize` | 10 MiB | Largest data unit accepted from the server. |
| `clTRIDPrefix`, `generateClTRID` | `'EPPTS'` | Client transaction ID format. |
| `debug`, `logger` | off | Debug logging; see [Logging](#logging). |

See [docs/SSL_TLS_CONFIGURATION.md](docs/SSL_TLS_CONFIGURATION.md) for TLS details.

## Usage

Every command resolves with an `EppResponse` for 1xxx result codes:

```typescript
interface EppResponse<T> {
  success: boolean;
  code: number;              // first result code, e.g. 1000 or 1001
  message: string;
  results: EppResult[];      // every <result>, with <value>/<extValue> details
  data?: T;                  // typed <resData>
  extensions: ResponseExtensions;   // secDNS, rgp, launchCheck, feeCheck, fee, loginSec, changePoll, ...
  msgQ?: MessageQueue;       // when the server has queued messages
  clTRID?: string;
  svTRID?: string;
  xml: string;               // raw response
}
```

Commands are sent one at a time on the connection. Calls made while a command is in flight are queued, so concurrent callers each receive their own response.

### Domains

```typescript
// Check, with prices for premium names (RFC 8748)
const check = await client.domainCheck(['example.com'], {
  fee: { currency: 'USD', commands: [{ name: 'create', period: 1 }, 'renew'] },
});
console.log(check.data, check.extensions.feeCheck);

// Info; DNSSEC and grace-period data arrive in extensions
const info = await client.domainInfo('example.com', { authInfo: 'auth-code', hosts: 'all' });
console.log(info.data?.status, info.data?.exDate, info.extensions.secDNS, info.extensions.rgp);

// Create. RFC 5731 only requires name and authInfo; registry policy decides the rest.
await client.domainCreate({
  name: 'example.com',
  period: 1,                                   // years, or { value: 6, unit: 'm' }
  ns: ['ns1.example.net', 'ns2.example.net'],  // or { hostAttr: [...] }
  registrant: 'reg-001',
  contacts: [{ type: 'admin', id: 'adm-001' }, { type: 'tech', id: 'tech-001' }],
  authInfo: { pw: generateAuthInfo() },
  dnssec: { dsData: [{ keyTag: 12345, alg: 13, digestType: 2, digest: '...' }] },
});

// Update
await client.domainUpdate({
  name: 'example.com',
  add: { ns: ['ns3.example.net'], status: [{ s: 'clientTransferProhibited' }] },
  rem: { ns: ['ns1.example.net'] },
  chg: { authInfo: { pw: 'new-auth-code' } },
});

// Renew; curExpDate accepts the exDate returned by info
await client.domainRenew({ name: 'example.com', curExpDate: info.data!.exDate!, period: 1 });

// Transfer: request, query, approve, reject or cancel
await client.domainTransfer({ name: 'example.com', op: 'request', authInfo: { pw: 'auth-code' } });

await client.domainDelete('example.com');
```

### Grace-period restore (RFC 3915)

ICANN gTLD registries restore a deleted domain in two steps: a restore request, then a restore report.

```typescript
await client.domainRestore('example.com');            // request

await client.domainRestore('example.com', {           // report
  report: {
    preData: 'Registration data before deletion',
    postData: 'Registration data after restore',
    delTime: '2026-11-01T10:00:00Z',
    resTime: '2026-11-10T08:00:00Z',
    resReason: 'Registrant error.',
    statement: [
      'This registrar has not restored the Registered Name in order to assume the rights to use or sell the Registered Name for itself or for any third party.',
      'The information in this report is true to best of this registrar\'s knowledge.',
    ],
  },
});
```

The report is checked with `validateRestoreReport()` before it is sent: both RFC 3915 statements are required.

### Sunrise and claims (RFC 8334, TMCH)

```typescript
import { parseSmdFile, verifyTcnId } from 'epp-ts';

// Sunrise with the Signed Mark Data file issued by the TMCH
const smd = parseSmdFile(fs.readFileSync('mark.smd', 'utf8'));
await client.domainCreate({
  name: 'example.tld',
  authInfo: { pw: generateAuthInfo() },
  launch: { phase: 'sunrise', encodedSignedMark: smd.encodedSignedMark },
});

// Claims: find names with trademark claims, show the notice, record acceptance
const claims = await client.domainCheck(['example.tld'], { launch: { type: 'claims', phase: 'claims' } });
const { exists, claimKeys } = claims.extensions.launchCheck!.results[0];

// After the registrant accepts the notice fetched with the claim key:
if (verifyTcnId(noticeId, 'example.tld', noticeNotAfter)) {
  await client.domainCreate({
    name: 'example.tld',
    authInfo: { pw: generateAuthInfo() },
    launch: {
      phase: 'claims',
      notice: { noticeID: noticeId, validatorID: 'tmch', notAfter: noticeNotAfter, acceptedDate: new Date() },
    },
  });
}
```

### Fees (RFC 8748)

```typescript
const quote = await client.feeCheck({ domain: 'premium.example', command: ['create', 'renew'], period: 1, currency: 'USD' });
const fee = quote.data?.items[0];   // { objID, available, class: 'premium', commands: [{ name, fees, ... }] }

await client.domainCreate({
  name: 'premium.example',
  authInfo: { pw: generateAuthInfo() },
  fee: { currency: 'USD', amount: '100.00' },   // the price the registrar agrees to pay
});
```

### Contacts and hosts

```typescript
await client.contactCreate({
  id: 'reg-001',
  postalInfo: { type: 'int', name: 'Jane Doe', addr: { street: ['1 Main St'], city: 'Jakarta', cc: 'ID' } },
  voice: '+62.215551234',
  email: 'jane@example.com',
  authInfo: { pw: generateAuthInfo() },
  disclose: { flag: false, voice: true, email: true },   // ask the registry not to publish these
});

await client.hostCreate({ name: 'ns1.example.com', addr: ['192.0.2.1', '2001:db8::1'] });   // IP versions are detected
await client.hostUpdate({ name: 'ns1.example.com', add: { addr: ['192.0.2.2'] } });
```

### Poll queue

```typescript
for (;;) {
  const message = await client.poll('req');
  if (message.code === 1300) break;              // queue empty

  console.log(message.msgQ?.message);
  switch (message.data?.type) {
    case 'domain:trnData': console.log('transfer', message.data.value.trStatus); break;
    case 'domain:panData': console.log('pending action', message.data.value.paResult); break;
  }
  await client.poll('ack', message.msgQ!.id);
}
```

### Session

```typescript
client.on('close', () => console.log('connection closed'));
client.on('reconnect', () => console.log('reconnected and logged in again'));

const greeting = await client.hello();         // also keeps an idle session alive
console.log(client.getServices());            // services announced at login
await client.login({ newPassword: 'new-pass-123' });   // change the password at login
```

## Error handling

All errors extend `EppError`, which extends `Error` and has a numeric `code`:

| Class | When |
|-------|------|
| `EppCommandError` | The server answered with a 2xxx code. `code`, `results` (with `extValues` reasons) and the full `response` are available. |
| `EppConnectionError` | Connecting failed, or the connection closed. Pending commands fail at once. |
| `EppTimeoutError` | No greeting or response in time. The connection is closed. |
| `EppProtocolError` | Malformed frame or XML, or a response whose clTRID does not match. The connection is closed. |
| `EppValidationError` | The request breaks a schema or RFC rule and was not sent. |

```typescript
try {
  await client.domainCreate(request);
} catch (error) {
  if (error instanceof EppCommandError && error.code === EppResultCode.OBJECT_EXISTS) {
    // name taken
  }
}
```

## Logging

`debug: true` logs connection events and every frame to the console; `logger` sends them anywhere else:

```typescript
new EppClient({ ...config, logger: { debug: (m) => log.debug(m), warn: (m) => log.warn(m) } });
```

Passwords (`<pw>`, `<newPW>`, loginSec), authorization info and allocation tokens are replaced with `***` in logged XML. `redactXml()` applies the same redaction to your own logs.

## Registry-specific extensions

Build extension elements with `el()`, declaring their namespace, and pass them in `extensions`. List the namespace in `additionalExtURIs` so it is announced at login whenever the server offers it:

```typescript
import { el } from 'epp-ts';

const client = new EppClient({ ...config, additionalExtURIs: ['urn:example:idn-1.0'] });

await client.domainCreate({
  name: 'xn--example.example',
  authInfo: { pw: generateAuthInfo() },
  extensions: [el('idn:data', { 'xmlns:idn': 'urn:example:idn-1.0' }, el('idn:table', null, 'de'))],
});
```

Extension data the client does not interpret is returned as XML in `response.extensions.unknown`; `parseXml()` turns it into a tree you can query by namespace (`node.child(ns, name)`, `node.text`). For commands the client does not model, `client.sendRaw(xml)` sends a complete EPP document and parses the response.

## Helpers

| Helper | Purpose |
|--------|---------|
| `generateAuthInfo(length?)` | Cryptographically random authorization code |
| `toAsciiDomain()`, `toUnicodeDomain()`, `normalizeDomain()` | IDN conversion; registries expect A-labels |
| `validateDomain()`, `validateContactId()`, `validatePhone()`, `validateIPv4()`, `validateIPv6()` | Input checks matching the EPP schemas |
| `validateDsData()`, `validateKeyData()` | DNSSEC record checks |
| `validateRestoreReport()`, `canRestore()`, `DEFAULT_GRACE_PERIODS` | Grace period helpers |
| `sumFeeAmounts()`, `calculateTotalFees()` | Exact sums of fee amounts |
| `parseSmdFile()`, `extractEncodedSmd()`, `verifyTcnId()`, `computeTcnChecksum()` | TMCH files and notices (RFC 9361) |
| `EppResultCode`, `EppStatus`, `getEppResultMessage()` | Result codes and status values |
| `NS` | Namespace URIs |

## Development

```bash
npm install
npm test            # unit, schema-validation and TLS integration tests
npm run lint
npm run typecheck   # src, tests and examples
npm run build       # dist/
```

The tests need no network access: commands are validated against the schemas in [test/schemas](test/schemas), and the client runs against an in-process TLS server. [examples/](examples) shows complete workflows against a real server; use your registry's test (OT&E) environment.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE) © 2025-2026 Ahmad Ropai
