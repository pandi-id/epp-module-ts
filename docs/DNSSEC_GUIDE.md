# DNSSEC guide

epp-ts supports the DNSSEC extension for EPP, RFC 5910 (`urn:ietf:params:xml:ns:secDNS-1.1`):
DNSSEC data on domain create and update, and the data the registry holds on domain info. This
guide covers the registrar's part: giving the registry what it needs to publish DS records for a
signed zone. Signing the zone itself is the DNS operator's job.

The examples assume a logged-in `client`, as in the [README quick start](../README.md#quick-start).

- [Concepts](#concepts)
- [Create a domain with DNSSEC](#create-a-domain-with-dnssec)
- [Add and remove records](#add-and-remove-records)
- [Key rollover in one update](#key-rollover-in-one-update)
- [Change the maximum signature lifetime](#change-the-maximum-signature-lifetime)
- [Remove all DNSSEC data](#remove-all-dnssec-data)
- [Read DNSSEC data](#read-dnssec-data)
- [Validation helpers and constants](#validation-helpers-and-constants)
- [Compute DS records from DNSKEY records](#compute-ds-records-from-dnskey-records)
- [Troubleshooting](#troubleshooting)

## Concepts

A signed zone publishes its public keys in DNSKEY records. Resolvers authenticate the zone's
key-signing key (KSK, flags 257) through a DS record in the parent zone, which holds a digest of
that key. The registry publishes DS records in the TLD zone, built from data the registrar sends
over EPP.

RFC 5910 Section 4 defines two ways to send that data. A registry uses one of them for all
commands (it may accept both during a transition period) and answers 2306 to a command that uses
the other. The greeting does not say which one a registry uses, so check its documentation.

| | DS Data Interface (Section 4.1) | Key Data Interface (Section 4.2) |
|---|---|---|
| The client sends | `dsData`: key tag, algorithm, digest type, digest | `keyData`: flags, protocol, algorithm, public key |
| The DS record is computed by | the registrar or DNS operator | the registry |
| `domainInfo()` returns | `dsData` | `keyData` |

A `dsData` entry may also carry the DNSKEY it was computed from, in its `keyData` field, for
registries that check DS data against the key (Section 4.1).

The maximum signature lifetime (`maxSigLife`, Section 3.3) is optional. It is the child's
preferred lifetime, in seconds, for the registry's signature over the DS records. When it is
omitted, the registry's default applies. A registry that does not support it answers 2102.

The request and response types are exported from `epp-ts`:

| Where | Type | Fields |
|-------|------|--------|
| `dnssec` on `domainCreate()` | `DnssecCreate` | `maxSigLife?`, `dsData?`, `keyData?` |
| `dnssec` on `domainUpdate()` | `DnssecUpdate` | `urgent?`, `rem?: { all?, dsData?, keyData? }`, `add?: { dsData?, keyData? }`, `chg?: { maxSigLife? }` |
| `info.extensions.secDNS` | `DnssecInfo` | `maxSigLife?`, `dsData?`, `keyData?` |
| Records | `DsData`, `KeyData` | `{ keyTag, alg, digestType, digest, keyData? }`, `{ flags, protocol, alg, pubKey }` |

The client checks these rules before sending anything, and throws an `EppValidationError` when a
request breaks one:

- `dnssec` on create, `add`, and `rem` without `all` each need at least one record, either
  `dsData` or `keyData` but not both.
- `rem.all` cannot be combined with records.
- An update needs at least one of `rem`, `add` and `chg`.
- `maxSigLife` is an integer from 1 to 2147483647.
- Every record passes [`validateDsData()` or `validateKeyData()`](#validation-helpers-and-constants).

DNSSEC data can only be sent when the registry offers secDNS-1.1 in its greeting, because the
client announces only extensions the server lists
([how extensions are negotiated](EPP_EXTENSIONS.md#how-extensions-are-negotiated)). To check:

```typescript
import { NS } from 'epp-ts';

const dnssecAvailable = client.getServices()?.extURIs.includes(NS.secDNS) ?? false;
```

## Create a domain with DNSSEC

With the DS Data Interface, send the DS record of the zone's KSK
([how to compute it](#compute-ds-records-from-dnskey-records)):

```typescript
import { generateAuthInfo } from 'epp-ts';
import type { DsData } from 'epp-ts';

const ds: DsData = {
  keyTag: 8563,
  alg: 13,          // ECDSA P-256 with SHA-256
  digestType: 2,    // SHA-256
  digest: '4E80FF8AF6B19D6162C2683D7B5186B500BD4D0A9606515ADA854BD34DFEC7C6',
};

await client.domainCreate({
  name: 'example.com',
  period: 1,
  registrant: 'reg-001',
  contacts: [{ type: 'admin', id: 'adm-001' }, { type: 'tech', id: 'tech-001' }],
  ns: ['ns1.example.net', 'ns2.example.net'],
  authInfo: { pw: generateAuthInfo() },
  dnssec: { dsData: [ds] },   // maxSigLife can go here too, see below
});
```

With the Key Data Interface, send the KSK itself and the registry computes the DS record:

```typescript
import { generateAuthInfo } from 'epp-ts';

await client.domainCreate({
  name: 'example.com',
  authInfo: { pw: generateAuthInfo() },
  dnssec: {
    keyData: [{
      flags: 257,
      protocol: 3,
      alg: 13,
      pubKey: '4CDqGwmbAW/wKMFkjJ9gwR05b6iEjMb+67sApUIfGD0kAV6QvOK+FQ950WUbFRg/G4mysYjtcFgVAMAOqF0zWw==',
    }],
  },
});
```

## Add and remove records

`ds` is the record from the previous example.

```typescript
// Add a DS record to the domain's set
await client.domainUpdate({ name: 'example.com', dnssec: { add: { dsData: [ds] } } });

// Remove one
await client.domainUpdate({ name: 'example.com', dnssec: { rem: { dsData: [ds] } } });
```

The registry identifies a record to remove by all four of its fields (RFC 5910 Section 5.2.5),
so copy them from [`domainInfo()`](#read-dnssec-data) rather than retyping them. With the Key
Data Interface, removing one key can remove more than one DS record at the registry.

You can send `dnssec` on its own, or together with the domain's own `add`, `rem` and `chg` in
the same update.

## Key rollover in one update

To replace a KSK, first publish the new key in the zone next to the old one, sign the DNSKEY
records with both, and wait until resolvers have the new DNSKEY set (its TTL). Then replace the
DS record at the registry in a single update:

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: {
    rem: { dsData: [{ keyTag: 8563, alg: 13, digestType: 2, digest: '4E80FF8AF6B19D6162C2683D7B5186B500BD4D0A9606515ADA854BD34DFEC7C6' }] },
    add: { dsData: [{ keyTag: 63520, alg: 13, digestType: 2, digest: 'F799527F6F390792BE22CBBFAB84CE988E93E9F4C55B5DD13DAF0D32B9FC924C' }] },
  },
});
```

RFC 5910 Section 5.2.5 requires the server to remove records before it adds new ones. The client
always sends `rem`, `add` and `chg` in that order, whatever the order of the properties in your
object. During the change, resolvers that still cache the old DS record and resolvers that fetch
the new one can both validate the zone, because it publishes both keys. Remove the old key from
the zone once the old DS record has expired from caches (the TTL of the DS record in the parent
zone). This is the double-signature KSK rollover of RFC 6781 Section 4.1.2. A rollover that
changes the algorithm needs more steps (RFC 6781 Section 4.1.4), and RFC 7583 covers the timing.

To replace the whole set, combine `rem: { all: true }` with `add`. While a registry accepts both
interfaces, this is also how a domain moves from one interface to the other (RFC 5910 Section 4).

## Change the maximum signature lifetime

```typescript
await client.domainUpdate({ name: 'example.com', dnssec: { chg: { maxSigLife: 1209600 } } });   // 14 days
```

On create, `maxSigLife` goes next to the records in `dnssec`. In an update it goes in `chg`:
`add` and `rem` carry records only. A registry that does not support `maxSigLife` answers 2102
(RFC 5910 Sections 5.2.1 and 5.2.5).

## Remove all DNSSEC data

```typescript
await client.domainUpdate({
  name: 'example.com',
  dnssec: { urgent: true, rem: { all: true } },
});
```

Removing all DNSSEC data makes the delegation insecure. Do it before you move the zone to a DNS
operator that cannot take over its keys, or when the zone has stopped signing or its keys are
lost or compromised (RFC 5910 Section 9). While the registry publishes a DS record that matches
no key in the zone, validating resolvers cannot resolve the domain.

`urgent: true` asks the registry to apply the change with high priority (Section 5.2.5). A
registry that does not support `urgent` answers 2102. One that supports it but cannot complete
the update with high priority answers 2306. Leave `urgent` out of routine changes.

## Read DNSSEC data

DNSSEC data arrives in `extensions.secDNS` of the info response. `data` holds only the RFC 5731
domain data.

```typescript
import { DNSSEC_ALGORITHMS } from 'epp-ts';

const info = await client.domainInfo('example.com');
const secDNS = info.extensions.secDNS;   // undefined when the domain has no DNSSEC data

for (const ds of secDNS?.dsData ?? []) {
  const algorithm = (DNSSEC_ALGORITHMS as Record<number, string>)[ds.alg] ?? `algorithm ${ds.alg}`;
  console.log(ds.keyTag, algorithm, ds.digestType, ds.digest);
  // 8563 ECDSA Curve P-256 with SHA-256 2 4E80FF8AF6B19D61...
}
console.log(secDNS?.keyData, secDNS?.maxSigLife);
```

The registry includes `<secDNS:infData>` when the domain has DNSSEC data, subject to its policy
(RFC 5910 Section 5.1.2).

## Validation helpers and constants

The client checks every record before sending it. Call the same helpers to validate input early,
for example in a form:

```typescript
import { validateDsData, validateKeyData } from 'epp-ts';

validateDsData({ keyTag: 8563, alg: 13, digestType: 2, digest: '4E80FF8AF6B19D6162C2683D7B5186B500BD4D0A9606515ADA854BD34DFEC7C6' });   // true
validateDsData({ keyTag: 8563, alg: 13, digestType: 2, digest: '4E80FF8AF6B19D61' });   // false: a SHA-256 digest has 64 hex digits
validateKeyData({ flags: 257, protocol: 3, alg: 13, pubKey: '4CDqGwmbAW/wKMFkjJ9gwR05b6iEjMb+67sApUIfGD0kAV6QvOK+FQ950WUbFRg/G4mysYjtcFgVAMAOqF0zWw==' });   // true
```

| Helper | Checks |
|--------|--------|
| `validateDsData(ds)` | `keyTag` 0-65535. `alg` and `digestType` 0-255. `digest` is hexadecimal with an even number of digits, and has exactly 40, 64 or 96 digits for digest types 1 (SHA-1), 2 (SHA-256) and 4 (SHA-384). A nested `keyData` passes `validateKeyData()`. |
| `validateKeyData(key)` | `flags` 0-65535 with the Zone Key bit (256) set: 257 for a KSK, 256 for a ZSK. `protocol` is 3. `alg` 0-255. `pubKey` is base64 without whitespace. |

The helpers check the format, not the cryptography: a well-formed DS record for the wrong key
passes. Registries may compare DS data with the DNSKEY records published at the zone apex
(RFC 5910 Section 4.1).

`DNSSEC_ALGORITHMS` maps algorithm numbers to names:

| `alg` | Name |
|-------|------|
| 5 | RSA/SHA-1 |
| 7 | RSASHA1-NSEC3-SHA1 |
| 8 | RSA/SHA-256 |
| 10 | RSA/SHA-512 |
| 13 | ECDSA Curve P-256 with SHA-256 |
| 14 | ECDSA Curve P-384 with SHA-384 |
| 15 | Ed25519 |
| 16 | Ed448 |

`DNSSEC_DIGEST_TYPES` maps digest types: 1 is SHA-1, 2 is SHA-256 and 4 is SHA-384.

The constants are for display. The validators accept any algorithm number from 0 to 255, and
the registry decides which algorithms it accepts. For new keys, algorithm 13 (or 8) with digest
type 2 is widely supported. Avoid the SHA-1 based algorithms 5 and 7, and digest type 1
(RFC 8624).

## Compute DS records from DNSKEY records

DNS operators usually show the DS record for the registrar to submit. To compute it yourself, use
`dnssec-dsfromkey` (BIND) or `ldns-key2ds` (ldns):

```bash
# From the key file written by dnssec-keygen or ldns-keygen
dnssec-dsfromkey -2 Kexample.com.+013+08563.key
ldns-key2ds -n -2 Kexample.com.+013+08563.key

# From the DNSKEY records the zone publishes. Only keys with the SEP flag (KSKs)
# are converted, unless -A is given.
dig @ns1.example.net example.com DNSKEY +noall +answer | dnssec-dsfromkey -2 -f - example.com
```

`-2` selects SHA-256 (digest type 2). `-n` makes `ldns-key2ds` print the record instead of
writing a `.ds` file. The output is a DS record:

```text
example.com. IN DS 8563 13 2 4E80FF8AF6B19D6162C2683D7B5186B500BD4D0A9606515ADA854BD34DFEC7C6
```

The four fields after `DS` are, in order, `keyTag`, `alg`, `digestType` and `digest`. For the Key
Data Interface, take `flags`, `protocol`, `alg` and `pubKey` from the DNSKEY record
(`257 3 13 4CDqGwmb...`) in the same way.

`dig` splits long digests and keys into space-separated chunks. Join them, or use `dig +nosplit`,
because the validators reject whitespace.

## Troubleshooting

The client throws server errors as `EppCommandError`. Its `results` carry the registry's
reasons:

```typescript
import { EppCommandError } from 'epp-ts';

try {
  await client.domainUpdate({ name: 'example.com', dnssec: { add: { dsData: [ds] } } });
} catch (error) {
  if (error instanceof EppCommandError) {
    console.error(error.code, error.message);
    for (const { value, reason } of error.results.flatMap((result) => result.extValues)) {
      console.error(reason, value);   // the registry's explanation and the element it refers to
    }
  }
  throw error;
}
```

| Error | Likely cause |
|-------|--------------|
| `EppValidationError` | The client rejected the request without sending it. The message names the rule, for example `DNSSEC add: use either dsData or keyData, not both` or `Invalid DS data for key tag 8563`. |
| `EppValidationError`: `Extension urn:ietf:params:xml:ns:secDNS-1.1 was not announced at login` | The server's greeting does not offer secDNS-1.1, or your `extURIs` setting leaves it out. |
| 2306 Parameter value policy error | The command uses the interface the registry does not support (RFC 5910 Section 4), the registry cannot complete an `urgent` update with high priority (Section 5.2.5), or its policy rejects the data: for example the algorithm, the digest type, the number of records, or a DS record that matches no DNSKEY in the zone. |
| 2005 Parameter value syntax error | The registry rejected the format of a value. The client already checks the schema types and the digest length for digest types 1, 2 and 4, so read the reason in `extValues`. It often concerns a value the registry checks more strictly than the schema, such as a public key that is not valid for its algorithm. |
| 2102 Unimplemented option | The registry does not support `maxSigLife` or `urgent` (Sections 5.2.1 and 5.2.5). Leave it out. |
| 2304 Object status prohibits operation | The domain has `clientUpdateProhibited`, `serverUpdateProhibited` or a pending status. Remove `clientUpdateProhibited` in a separate update first. |
| Resolvers fail after the update | The DS record does not match a KSK the zone publishes and signs with. Compare `domainInfo()` with `dig example.com DNSKEY`, and recompute the DS record. If the zone is no longer signed, [remove all DNSSEC data](#remove-all-dnssec-data). `delv example.com` and [DNSViz](https://dnsviz.net/) show where validation fails. |

## References

- [RFC 5910](https://www.rfc-editor.org/rfc/rfc5910): DNSSEC extension for EPP
- [RFC 4034](https://www.rfc-editor.org/rfc/rfc4034): DNSKEY and DS records, key tags
- [RFC 8624](https://www.rfc-editor.org/rfc/rfc8624): DNSSEC algorithm recommendations
- [RFC 6781](https://www.rfc-editor.org/rfc/rfc6781) and [RFC 7583](https://www.rfc-editor.org/rfc/rfc7583): DNSSEC operational practices and key rollover timing
- [EPP_EXTENSIONS.md](EPP_EXTENSIONS.md) for the other extensions, and [examples/](../examples/) for complete workflows
