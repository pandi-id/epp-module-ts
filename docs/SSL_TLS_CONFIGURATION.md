# TLS configuration

EPP runs over TLS on TCP port 700 (RFC 5734). epp-ts always uses TLS; there is no plaintext mode.
This guide lists the TLS options, shows configurations for production and for test environments,
and explains the errors to expect when a connection fails.

- [What RFC 5734 requires](#what-rfc-5734-requires)
- [TLS options](#tls-options)
- [Production configuration](#production-configuration)
- [Mutual TLS](#mutual-tls)
- [Custom CA](#custom-ca)
- [Server name, SNI and IP addresses](#server-name-sni-and-ip-addresses)
- [TLS versions and ciphers](#tls-versions-and-ciphers)
- [Other tls.connect() options](#other-tlsconnect-options)
- [Inspecting the connection](#inspecting-the-connection)
- [Testing against an OT&E server with a self-signed certificate](#testing-against-an-ote-server-with-a-self-signed-certificate)
- [Troubleshooting with openssl s_client](#troubleshooting-with-openssl-s_client)
- [Errors to expect](#errors-to-expect)

## What RFC 5734 requires

RFC 5734 Section 9 (TLS Usage Profile) sets these rules:

- Mutual client and server authentication is required, which is why registries usually require
  a client certificate.
- Both certificates are validated: the complete certification path, the validity period and the
  names.
- The client checks the server name or IP address against the server certificate. It may skip
  the name check when it knows in advance which certificate the server will present, and should
  then accept as few certificates as possible.
- The client sends the first EPP message after the TLS handshake has finished.

Section 8 adds that the client and server use the latest TLS version both support.

epp-ts follows these rules by default:

- It verifies the server's certificate chain against Node's bundled root certificates, or `ca`,
  and checks the certificate against `servername`, which defaults to `host`.
- It sends your client certificate when `clientCert` and `clientKey` are set.
- It requires TLS 1.2 or later, and Node negotiates TLS 1.3 when the server supports it.
- It sends nothing before the handshake has completed and the server's greeting has arrived.
  `connect()` resolves with the greeting, and `login()` connects first when needed.

## TLS options

| Option | Default | Description |
|--------|---------|-------------|
| `host` | required | Server to connect to. Also the default `servername`, unless it is an IP address. |
| `port` | `700` | The port IANA assigned to EPP (RFC 5734 Section 7). |
| `connectTimeout` | `timeout` (30000 ms) | Time allowed for the TCP connection, the TLS handshake and the greeting together. |
| `clientCert` | | Client certificate in PEM (string or Buffer), followed by any intermediate certificates. |
| `clientKey` | | Private key of `clientCert`, in PEM. |
| `passphrase` | | Passphrase of an encrypted `clientKey`, or of a `pfx` passed in `tlsOptions`. |
| `ca` | Node's bundled root certificates | CA certificates trusted for the server certificate. Setting it replaces the bundled roots. |
| `rejectUnauthorized` | `true` | `false` turns off every server certificate check, chain and name. |
| `checkServerIdentity` | `true` | `false` turns off only the name check. The chain is still verified. |
| `servername` | `host`, or none when `host` is an IP address | Name sent with SNI and matched against the certificate. |
| `minVersion` | `'TLSv1.2'` | Lowest TLS version, typed as `tls.SecureVersion`. |
| `maxVersion` | unset (Node's default, `'TLSv1.3'`) | Highest TLS version, typed as `tls.SecureVersion`. |
| `ciphers` | Node's default list | OpenSSL cipher list. |
| `tlsOptions` | | Any other `tls.connect()` options. Applied last, so they override everything above. |

## Production configuration

```typescript
import { readFileSync } from 'fs';
import { EppClient } from 'epp-ts';

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
  clientCert: readFileSync('/etc/epp/client.pem'),
  clientKey: readFileSync('/etc/epp/client-key.pem'),
  passphrase: process.env.EPP_KEY_PASSPHRASE,   // only for an encrypted key
});
```

Everything else stays at its default: the server certificate is verified against Node's root
certificates and checked against `host`, TLS 1.2 is the minimum, and SNI carries `host`. Set `ca`
only when the registry's
server certificate is not issued by a public CA. Keep keys and passwords out of source control.

## Mutual TLS

Pass the certificate the registry issued or approved as `clientCert` and its key as
`clientKey`, as in the production example above. If the registry needs the intermediate
certificates, append them to the same PEM file after your certificate. `passphrase` decrypts an
encrypted key.

A PKCS#12 bundle (`.p12` or `.pfx`) works through `tlsOptions`, and `passphrase` applies to it:

```typescript
import { readFileSync } from 'fs';
import { EppClient } from 'epp-ts';

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
  passphrase: process.env.EPP_P12_PASSPHRASE,
  tlsOptions: { pfx: readFileSync('/etc/epp/client.p12') },
});
```

Check the files before connecting:

```bash
# Subject, issuer and validity
openssl x509 -in client.pem -noout -subject -issuer -dates

# The key belongs to the certificate when both commands print the same hash
openssl x509 -in client.pem -noout -pubkey | openssl sha256
openssl pkey -in client-key.pem -pubout | openssl sha256
```

Node.js reads the certificate and key before it opens a connection. If the key does not match
the certificate, the passphrase is wrong or missing, or a file is not PEM, `connect()` rejects
with an `EppConnectionError` whose message starts with `Invalid TLS configuration`, without
contacting the server. Node's error is in `error.cause` (for example
`ERR_OSSL_X509_KEY_VALUES_MISMATCH` or `ERR_OSSL_BAD_DECRYPT` in `cause.code`). A certificate the
server does not accept ends the handshake instead; see [Errors to expect](#errors-to-expect).

## Custom CA

When the registry's server certificate is issued by a private CA, trust that CA with `ca`:

```typescript
import { readFileSync } from 'fs';
import { EppClient } from 'epp-ts';

const registryCa = readFileSync('/etc/epp/registry-ca.pem');

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
  clientCert: readFileSync('/etc/epp/client.pem'),
  clientKey: readFileSync('/etc/epp/client-key.pem'),
  ca: registryCa,   // trusts only this CA
});
```

`ca` replaces Node's bundled roots. To trust the registry's CA in addition to them, pass
`[...tls.rootCertificates, registryCa]`, or set the `NODE_EXTRA_CA_CERTS` environment variable to
the PEM file, which extends the roots for the whole process and is read only at startup.

Node does not download missing intermediate certificates. If the server does not send its
intermediate, verification fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`: put the intermediate and
its root in `ca`, and ask the registry to fix the chain it sends.

## Server name, SNI and IP addresses

`servername` defaults to `host`. The client sends it with SNI and checks the certificate against
it. When `host` is an IP address, the client sends no SNI, because SNI cannot carry an IP address
(RFC 6066), and checks the certificate against the IP address, so the certificate must list that
address (RFC 5734 Section 9).

To connect to an IP address and still check the certificate's DNS name, set `servername`:

```typescript
import { EppClient } from 'epp-ts';

const client = new EppClient({
  host: '192.0.2.10',                  // one node of a cluster, or before DNS is in place
  servername: 'epp.registry.example',  // sent with SNI and matched against the certificate
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
});
```

`checkServerIdentity: false` skips only the name check; the chain is still verified against the
trusted CAs. RFC 5734 Section 9 allows this when the client knows which certificate the server
will present, and asks that the client then accept as few certificates as possible. So combine it
with a `ca` that holds only the registry's own certificate or CA, as in the
[OT&E example](#testing-against-an-ote-server-with-a-self-signed-certificate), never with Node's
full root store.

## TLS versions and ciphers

```typescript
import { EppClient } from 'epp-ts';

const client = new EppClient({
  ...config,                       // host, username, password, certificates
  minVersion: 'TLSv1.3',
  ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
});
```

- `minVersion` defaults to `'TLSv1.2'`. `maxVersion` is unset, so Node offers up to TLS 1.3. TLS
  1.0 and 1.1 are deprecated (RFC 8996); do not lower the minimum below TLS 1.2.
- Both are typed as `tls.SecureVersion` (`'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'`). A
  value read from an environment variable needs checking and a type assertion.
- `ciphers` is an OpenSSL cipher list. TLS 1.3 suite names (those starting with `TLS_`) and TLS
  1.2 cipher names can be mixed in one colon-separated string. Node's default list already
  excludes weak ciphers, so set `ciphers` only when your security policy or the registry requires
  a specific list.

## Other tls.connect() options

`tlsOptions` passes options that `EppConfig` does not expose straight to `tls.connect()`. They are
applied last, so they override the options above, including `rejectUnauthorized`, `servername` and
`checkServerIdentity`.

For example, to pin the server certificate in addition to the normal checks:

```typescript
import { checkServerIdentity, PeerCertificate } from 'tls';
import { EppClient } from 'epp-ts';

// openssl x509 -in server.pem -noout -fingerprint -sha256
const PINNED_SHA256 = 'DE:9F:BC:5B:FD:5A:2F:A8:87:98:D5:6D:52:A7:1F:31:60:5F:75:1D:BA:54:8A:51:DA:60:8A:C8:0D:32:9C:F9';

const client = new EppClient({
  ...config,                       // host, username, password, certificates
  tlsOptions: {
    checkServerIdentity: (hostname: string, cert: PeerCertificate) => {
      const error = checkServerIdentity(hostname, cert);   // keep Node's name check
      if (error) return error;
      if (cert.fingerprint256 !== PINNED_SHA256) return new Error(`Unexpected server certificate ${cert.fingerprint256}`);
      return undefined;
    },
  },
});
```

A pinned fingerprint changes whenever the registry renews its certificate, so keep it in
configuration and plan for the renewal.

## Inspecting the connection

```typescript
await client.connect();
console.log(client.getConnectionInfo());
// {
//   protocol: 'TLSv1.3',
//   cipher: { name: 'TLS_AES_256_GCM_SHA384', standardName: 'TLS_AES_256_GCM_SHA384', version: 'TLSv1.3' },
//   authorized: true
// }
```

`getConnectionInfo()` returns `null` when there is no connection. `authorized` is `false` only when
the server certificate failed verification and `rejectUnauthorized: false` let the connection
through. With `debug: true`, the client also logs the negotiated version and cipher:

```text
[epp] Connecting to epp.registry.example:700
[epp] TLS established: TLSv1.3 TLS_AES_256_GCM_SHA384
```

## Testing against an OT&E server with a self-signed certificate

Registry test (OT&E) servers sometimes use a self-signed certificate. Trust that certificate with
`ca` instead of turning verification off.

1. Get the certificate from the registry, or save the one the server presents and compare its
   fingerprint with the one the registry publishes:

   ```bash
   openssl s_client -connect ote.registry.example:700 -servername ote.registry.example -showcerts </dev/null 2>/dev/null \
     | openssl x509 -outform PEM > ote-server.pem
   openssl x509 -in ote-server.pem -noout -subject -enddate -fingerprint -sha256
   ```

   This saves the first certificate the server sends, which is its own. If the server
   certificate is issued by a private test CA, trust that CA's certificate instead (the last one
   `-showcerts` prints, or the one the registry provides).

2. Pass it as `ca`:

   ```typescript
   import { readFileSync } from 'fs';
   import { EppClient } from 'epp-ts';

   const client = new EppClient({
     host: 'ote.registry.example',
     username: 'registrar-id',
     password: process.env.EPP_OTE_PASSWORD!,
     clientCert: readFileSync('ote-client.pem'),
     clientKey: readFileSync('ote-client-key.pem'),
     ca: readFileSync('ote-server.pem'),   // trust exactly this certificate
     // checkServerIdentity: false,        // only if the certificate's name does not match the host
   });
   ```

`rejectUnauthorized: false` is the last resort. It turns off chain and name checks, so anyone on
the network path can impersonate the server and capture your password. The client logs the
warning `TLS certificate verification is disabled (rejectUnauthorized: false)` on every
connection. Never use it in production. The client always passes `rejectUnauthorized` to Node
explicitly, so the `NODE_TLS_REJECT_UNAUTHORIZED` environment variable has no effect on it.

## Troubleshooting with openssl s_client

`openssl s_client` shows what happens during the handshake, independently of Node:

```bash
# Protocol, cipher and the certificates the server sends
openssl s_client -connect epp.registry.example:700 -servername epp.registry.example -showcerts </dev/null

# Verify the chain and the name as the client does; expect "Verify return code: 0 (ok)"
openssl s_client -connect epp.registry.example:700 -servername epp.registry.example \
  -CAfile registry-ca.pem -verify_hostname epp.registry.example -verify_return_error </dev/null

# Offer your client certificate. Leave stdin open: after the handshake the server's
# <greeting> XML appears (after 4 bytes of length header). Press Ctrl+C to quit.
openssl s_client -connect epp.registry.example:700 -servername epp.registry.example \
  -cert client.pem -key client-key.pem

# Check that the server accepts a specific TLS version
openssl s_client -connect epp.registry.example:700 -servername epp.registry.example -tls1_2 </dev/null
```

Without `-CAfile`, `s_client` uses OpenSSL's default CA store, which can differ from the roots
bundled with Node.

| `s_client` output | Meaning |
|-------------------|---------|
| `Verify return code: 0 (ok)` | Chain and name are valid for the CA file and name you gave. |
| `18 (self-signed certificate)`, `19 (self-signed certificate in certificate chain)`, `20 (unable to get local issuer certificate)`, `21 (unable to verify the first certificate)` | The server certificate is not trusted: set `ca` to the right CA, or add the missing intermediate. |
| `10 (certificate has expired)` | The server certificate has expired, or your clock is wrong. |
| `62 (hostname mismatch)` | Set `servername` to a name the certificate lists. |
| `alert certificate required` | The server requires a client certificate and none was sent. |
| `wrong version number` | The port is not speaking TLS: check the host and port. |

If the greeting appears with `s_client` but not with epp-ts, compare your `ca`, `servername` and
certificate files with the ones you passed to `s_client`. If the greeting appears with both, the
remaining problem is in the EPP session, for example a login error.

## Errors to expect

TCP and TLS failures reject `connect()` (or the first command that connects) with an
`EppConnectionError`. Its `code` is `0`, because there is no EPP result code. Node's original
error, with its own code, is in `error.cause`:

```typescript
import { EppConnectionError, EppTimeoutError } from 'epp-ts';

try {
  await client.connect();
} catch (error) {
  if (error instanceof EppConnectionError) {
    const code = (error.cause as NodeJS.ErrnoException | undefined)?.code;
    console.error(`Connection failed: ${error.message} (${code ?? 'no code'})`);
  } else if (error instanceof EppTimeoutError) {
    console.error('No TLS handshake or greeting within connectTimeout');
  }
  throw error;
}
```

| Situation | Error | Code |
|-----------|-------|------|
| Host name does not resolve | `EppConnectionError` | `cause.code`: `ENOTFOUND` |
| Port closed, or connection refused by a firewall or IP allow list | `EppConnectionError` | `cause.code`: `ECONNREFUSED`, `ECONNRESET` |
| Server certificate not trusted | `EppConnectionError` | `cause.code`: `DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` |
| Server certificate expired or not yet valid (check the clock) | `EppConnectionError` | `cause.code`: `CERT_HAS_EXPIRED`, `CERT_NOT_YET_VALID` |
| Certificate does not match `servername` | `EppConnectionError` | `cause.code`: `ERR_TLS_CERT_ALTNAME_INVALID` |
| No client certificate sent, or the server rejects it | `EppConnectionError` | `cause.code`: `ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED` or another TLS alert; sometimes only the message `Connection closed` |
| No TLS version in common | `EppConnectionError` | `cause.code`: `ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION` |
| The port is not speaking TLS | `EppConnectionError` | `cause.code`: `ERR_SSL_WRONG_VERSION_NUMBER` |
| No handshake or greeting within `connectTimeout`, for example when a firewall drops the packets | `EppTimeoutError` | |
| The server sent something other than an EPP greeting | `EppProtocolError` | |
| Your certificate or key cannot be loaded | `EppConnectionError` (`Invalid TLS configuration: ...`) | `cause.code`: `ERR_OSSL_X509_KEY_VALUES_MISMATCH`, `ERR_OSSL_BAD_DECRYPT`, `ERR_OSSL_PEM_NO_START_LINE` |

After a timeout or protocol error the client closes the connection. Once a session is open, a
dropped connection fails the pending command with `EppConnectionError` (`Connection closed`) and
emits `close`. Servers may close idle connections (RFC 5734 Section 9); `keepAliveInterval` and
`autoReconnect` handle that, as shown in [QUICKSTART.md](../QUICKSTART.md#long-running-services).

## References

- [RFC 5734](https://www.rfc-editor.org/rfc/rfc5734): EPP transport over TCP; Section 8 (Security Considerations) and Section 9 (TLS Usage Profile)
- [RFC 6066](https://www.rfc-editor.org/rfc/rfc6066): TLS extensions, including SNI
- [RFC 8996](https://www.rfc-editor.org/rfc/rfc8996): deprecation of TLS 1.0 and 1.1
- [Node.js `tls` documentation](https://nodejs.org/api/tls.html), for the options accepted by `tlsOptions`
- [README configuration table](../README.md#configuration) for the non-TLS options
