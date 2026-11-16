# EPP extensions

epp-ts implements the EPP extensions most registries use. This guide shows how to use each one.
For the protocol core (domains, contacts, hosts, poll) see the [README](../README.md).

## How extensions are negotiated

The server lists the extensions it supports in its greeting. At login the client announces the
ones it implements that the server also lists:

```typescript
const greeting = await client.connect();
console.log(greeting.extURIs);             // what the server offers

await client.login();
console.log(client.getServices()?.extURIs); // what was announced
```

RFC 5730 Section 2.9.1.1 forbids using an extension that was not announced, so passing extension
data for one (for example `dnssec` when the server does not offer secDNS) throws an
`EppValidationError` without sending anything. `additionalExtURIs` (in the client configuration
or `login()` options) adds registry-specific extensions the server offers; `extURIs` replaces the
negotiated list altogether.

Extension data from responses is parsed into `response.extensions`:

| Key | Element | Extension |
|-----|---------|-----------|
| `secDNS` | `<secDNS:infData>` | DNSSEC |
| `rgp` | `<rgp:infData>`, `<rgp:upData>` | Registry Grace Period |
| `launchCheck`, `launchInfo`, `launchCreate` | `<launch:chkData>`, `<launch:infData>`, `<launch:creData>` | Launch Phase |
| `feeCheck`, `fee` | `<fee:chkData>`; `<fee:creData>` and the other transform results | Fee |
| `loginSec` | `<loginSec:loginSecData>` | Login Security |
| `changePoll` | `<changePoll:changeData>` | Change Poll |
| `allocationToken` | `<allocationToken:allocationToken>` | Allocation Token |
| `unknown` | anything else, as XML | |

## DNSSEC (RFC 5910)

DS or key data on create, update and info. See [DNSSEC_GUIDE.md](DNSSEC_GUIDE.md).

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: { dsData: [oldDs] },   // removed before additions are applied
    add: { dsData: [newDs] },
  },
});
```

## Registry Grace Period (RFC 3915)

`domainInfo()` reports the grace period a domain is in:

```typescript
const info = await client.domainInfo('example.com');
const status = info.extensions.rgp?.rgpStatus[0]?.s;   // 'addPeriod', 'redemptionPeriod', ...

if (status && canRestore(status)) {
  await client.domainRestore('example.com');            // restore request
  await client.domainRestore('example.com', { report }); // restore report
}
```

The restore report must contain the registration data before deletion and after restore, the
deletion and restore times, the reason, and two statements: that the registrar did not restore
the name to use or sell it itself, and that the report is factual. `validateRestoreReport(report)`
returns the problems it finds; `domainRestore()` runs it and refuses to send an invalid report.

Helpers: `isInGracePeriod()`, `isInRedemption()`, `isPendingDelete()`, `canRestore()`,
`calculateGracePeriodEnd()`, `getRemainingGracePeriodDays()`, `DEFAULT_GRACE_PERIODS` (the
lengths used in ICANN gTLD agreements).

## Launch Phase and the Trademark Clearinghouse (RFC 8334, RFC 7848, RFC 9361)

New gTLDs open with a sunrise period for trademark holders and a claims period during which
registrants must acknowledge matching trademarks.

### Sunrise

The mark holder receives a Signed Mark Data (SMD) file from the TMCH. Submit its encoded signed
mark with the create:

```typescript
import { parseSmdFile } from 'epp-ts';

const smd = parseSmdFile(fs.readFileSync('mark.smd', 'utf8'));
// smd.smdID, smd.uLabels, smd.notAfter, smd.encodedSignedMark

const res = await client.domainCreate({
  name: 'example.tld',
  authInfo: { pw: generateAuthInfo() },
  launch: { phase: 'sunrise', type: 'application', encodedSignedMark: smd.encodedSignedMark },
});
console.log(res.extensions.launchCreate?.applicationID);
```

Registries that validate marks themselves may accept codes instead:
`launch: { phase: 'sunrise', codeMark: { code: '...', validatorID: '...' } }`.

### Claims

```typescript
// 1. Find names with claims
const check = await client.domainCheck(['example.tld'], { launch: { type: 'claims', phase: 'claims' } });
const result = check.extensions.launchCheck!.results[0];
// result.exists, result.claimKeys[i].key, result.claimKeys[i].validatorID

// 2. Fetch the claims notice from the TMCH with the claim key, show it to the registrant,
//    and record when they accept it.

// 3. Register with the acceptance
if (verifyTcnId(notice.id, 'example.tld', notice.notAfter)) {
  await client.domainCreate({
    name: 'example.tld',
    authInfo: { pw: generateAuthInfo() },
    launch: {
      phase: 'claims',
      notice: { noticeID: notice.id, validatorID: 'tmch', notAfter: notice.notAfter, acceptedDate: acceptedAt },
    },
  });
}
```

`verifyTcnId()` recomputes the notice checksum from the domain's leftmost label and the notice
expiry, which is the check registries perform (RFC 9361 Section 5.3.2).

### Other forms

```typescript
// Availability within a phase
await client.domainCheck(['example.tld'], { launch: { type: 'avail', phase: 'sunrise' } });

// Applications
await client.domainInfo('example.tld', { launch: { phase: 'sunrise', applicationID: 'abc123', includeMark: true } });
await client.domainUpdate({ name: 'example.tld', add: { status: ['clientHold'] }, launch: { phase: 'sunrise', applicationID: 'abc123' } });
await client.domainDelete('example.tld', { launch: { phase: 'sunrise', applicationID: 'abc123' } });

// Registry-defined phases
await client.domainCreate({ name: 'example.tld', authInfo, launch: { phase: 'custom', subPhase: 'landrush-premium' } });
```

`launchInfo.marks` holds any `<mark:mark>` returned by the registry as XML.

Helpers: `isValidSMDFormat()` (RFC 7848 identifiers such as `1-2`), `isValidNoticeID()`,
`computeTcnChecksum()`, `extractEncodedSmd()`, `isValidNiceClass()`, `isTmchMarkExpired()`.

## Registry Fee (RFC 8748)

```typescript
// Price several commands for several names
const quote = await client.feeCheck({
  domain: ['example.com', 'premium.example'],
  command: ['create', 'renew', { name: 'transfer' }, { name: 'restore' }],
  period: 1,
  currency: 'USD',
});
for (const item of quote.data!.items) {
  console.log(item.objID, item.available, item.class, item.commands.map((c) => [c.name, c.fees, c.standard]));
}

// The same through domainCheck, keeping availability in data
const check = await client.domainCheck(['premium.example'], { fee: { currency: 'USD', commands: ['create'] } });

// Confirm the price on transform commands
await client.domainCreate({ name: 'premium.example', authInfo, fee: { currency: 'USD', amount: '100.00' } });
await client.domainRenew({ name: 'premium.example', curExpDate, fee: { amount: '100.00' } });
await client.domainTransfer({ name: 'premium.example', op: 'request', authInfo, fee: { amount: '100.00' } });
await client.domainRestore('premium.example', { fee: { amount: '40.00' } });

// Itemised fees
await client.domainCreate({
  name: 'premium.example',
  authInfo,
  fee: { currency: 'USD', fees: [{ fee: '90.00', description: 'Registration' }, { fee: '10.00', description: 'Premium' }] },
});
```

Transform responses report what was charged in `response.extensions.fee`: `fees`, `credits`,
`balance` and `creditLimit`.

Helpers: `sumFeeAmounts()` (exact decimal sum, e.g. to submit the total of quoted fees),
`calculateTotalFees()`, `parseFeeAmount()`, `formatFeeAmount()`, `isValidCurrencyCode()`,
`parseGracePeriod()`.

## Login Security (RFC 8807)

RFC 5730 limits passwords to 16 characters. When the server offers loginSec, longer passwords are
sent through it automatically, along with a user agent (`epp-ts <version>` and the Node.js version
by default):

```typescript
const client = new EppClient({ ...config, password: 'a passphrase longer than sixteen characters' });
const res = await client.login();
for (const event of res.extensions.loginSec ?? []) {
  console.log(event.type, event.level, event.exDate, event.message);   // e.g. password expiry warnings
}
```

Set `userAgent` in the configuration to describe your application, or `false` to send none.

## Change Poll (RFC 8590)

Registries use change poll messages to report changes made to your objects by the registry itself
(for example a URS lock). The object's data is in `data`, the change in `extensions.changePoll`:

```typescript
const msg = await client.poll('req');
if (msg.extensions.changePoll) {
  const { operation, who, reason, caseId } = msg.extensions.changePoll;
}
```

## Allocation Token (RFC 8495)

```typescript
await client.domainCheck(['reserved.example'], { allocationToken: 'abc123' });
await client.domainCreate({ name: 'reserved.example', authInfo, allocationToken: 'abc123' });
await client.domainTransfer({ name: 'reserved.example', op: 'request', authInfo, allocationToken: 'abc123' });
const info = await client.domainInfo('reserved.example', { allocationToken: true });
console.log(info.extensions.allocationToken);
```

Allocation tokens are redacted from debug logs.

## Registry-specific extensions

Many registries define their own extensions. Build the elements with `el()` and pass them in the
`extensions` option of any command. List the namespace in `additionalExtURIs` so it is announced at
login when the server offers it:

```typescript
import { el } from 'epp-ts';

const client = new EppClient({ ...config, additionalExtURIs: ['urn:example:idn-1.0'] });

await client.domainCreate({
  name: 'xn--bcher-kva.example',
  authInfo,
  extensions: [el('idn:data', { 'xmlns:idn': 'urn:example:idn-1.0' }, [el('idn:table', null, 'de')])],
});
```

The element's own `xmlns` declaration identifies its extension; an element without one is rejected
before sending, since the XML would not be well-formed. Response data from such extensions
is returned as XML in `response.extensions.unknown`:

```typescript
import { parseXml } from 'epp-ts';

for (const xml of res.extensions.unknown ?? []) {
  const node = parseXml(xml);
  if (node.is('urn:example:idn-1.0', 'infData')) console.log(node.childText('urn:example:idn-1.0', 'table'));
}
```

For commands the client does not model at all, `client.sendRaw(xml)` sends a complete EPP document
and parses the response.
