# Quick start

Connect to a registry, register a domain and handle errors with epp-ts in five minutes. The
[README](README.md) covers the full API.

## Before you start

- Node.js 18 or later.
- From your registry: the EPP host name and port (usually 700), your client ID and password, and
  usually a client certificate and key. Many registries also accept connections only from IP
  addresses you have registered with them.
- Develop against the registry's test environment (OT&E), not production.

## Install

```bash
npm install epp-ts
```

## Connect, check and log out

```typescript
import { readFileSync } from 'fs';
import { EppClient } from 'epp-ts';

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
  clientCert: readFileSync('client.pem'),      // mutual TLS, when the registry requires it
  clientKey: readFileSync('client-key.pem'),
});

async function main() {
  try {
    const greeting = await client.connect();   // TLS handshake, then the server greeting
    console.log('Connected to', greeting.svID);

    await client.login();                       // announces the services both sides support

    const { data } = await client.domainCheck(['example.com', 'example.net']);
    for (const result of data ?? []) {
      console.log(result.name, result.available ? 'available' : `taken (${result.reason ?? 'no reason given'})`);
    }

    await client.logout();
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

The client verifies the server certificate and requires TLS 1.2 or later. If your registry's test
server uses a self-signed certificate, see
[TLS configuration](docs/SSL_TLS_CONFIGURATION.md#testing-against-an-ote-server-with-a-self-signed-certificate)
instead of turning verification off.

The remaining snippets assume a logged-in `client` and run inside an async function.

## Register a domain

A domain's contacts must exist before the domain, and so must its name servers at registries that
use host objects:

```typescript
import { generateAuthInfo } from 'epp-ts';

// 1. A contact, used here as registrant, admin and tech contact
await client.contactCreate({
  id: 'jdoe-001',                      // 3-16 characters, unique in the registry
  postalInfo: {
    type: 'int',
    name: 'Jane Doe',
    addr: { street: ['1 Main St'], city: 'Jakarta', pc: '10110', cc: 'ID' },
  },
  voice: '+62.215551234',              // +country code, a dot, then the number
  email: 'jane@example.com',
  authInfo: { pw: generateAuthInfo() },
});

// 2. Host objects for the name servers. Hosts outside the registry's zones need no addresses.
const nameServers = ['ns1.dns-provider.example', 'ns2.dns-provider.example'];
for (const name of nameServers) {
  const { data } = await client.hostCheck(name);
  if (data?.[0]?.available) await client.hostCreate({ name });   // skip hosts that already exist
}

// 3. The domain
const { data: domain } = await client.domainCreate({
  name: 'example.com',
  period: 1,                           // years
  registrant: 'jdoe-001',
  contacts: [{ type: 'admin', id: 'jdoe-001' }, { type: 'tech', id: 'jdoe-001' }],
  ns: nameServers,
  authInfo: { pw: generateAuthInfo() },
});
console.log(domain?.name, 'expires', domain?.exDate);
```

Each registry decides which contacts and fields it requires. Some take name servers as
attributes instead of host objects (`ns: { hostAttr: [...] }`) and need no `hostCreate`.

A name server inside the new domain, such as `ns1.example.com`, needs IP addresses (glue) and can
only be created once the domain exists:

```typescript
await client.hostCreate({ name: 'ns1.example.com', addr: ['192.0.2.1', '2001:db8::1'] });
await client.domainUpdate({ name: 'example.com', add: { ns: ['ns1.example.com'] } });
```

## Handle errors

The client's errors are subclasses of `EppError`; check for the specific classes. A client
certificate or key that cannot be loaded is reported as an `EppConnectionError` whose message
starts with `Invalid TLS configuration` ([details](docs/SSL_TLS_CONFIGURATION.md#mutual-tls)).

```typescript
import { EppCommandError, EppConnectionError, EppResultCode, EppTimeoutError, EppValidationError, generateAuthInfo } from 'epp-ts';

try {
  await client.domainCreate({ name: 'example.com', authInfo: { pw: generateAuthInfo() } });
} catch (error) {
  if (error instanceof EppCommandError) {
    // The server answered with a 2xxx result code
    if (error.code === EppResultCode.OBJECT_EXISTS) console.log('example.com is taken');
    else console.error(error.message, error.results.flatMap((result) => result.extValues.map((v) => v.reason)));
  } else if (error instanceof EppValidationError) {
    // The client rejected the request; nothing was sent
    console.error('Invalid request:', error.message);
  } else if (error instanceof EppConnectionError || error instanceof EppTimeoutError) {
    // The connection failed or was closed
    console.error('Connection problem:', error.message);
  } else {
    throw error;
  }
}
```

- `EppCommandError` has the result `code`, a message such as `EPP 2302: Object exists`, and
  `results` with the registry's reasons. The session stays open, except after codes 2500-2502,
  when the server closes the connection.
- `EppValidationError` means the request breaks a schema or RFC rule. Nothing was sent.
- `EppConnectionError` and `EppTimeoutError` mean the connection failed or was closed. A create,
  renew, transfer, update or delete may still have reached the registry before the response was
  lost, so check with an info command before you retry it.
- `EppProtocolError` means the server sent a malformed frame or document, or a response for
  another transaction; the client closes the connection.

See [Error handling in the README](README.md#error-handling) for details.

## Long-running services

A service that stays connected should keep its session alive and recover from dropped
connections:

```typescript
import { readFileSync } from 'fs';
import { EppClient } from 'epp-ts';

const client = new EppClient({
  host: 'epp.registry.example',
  username: 'registrar-id',
  password: process.env.EPP_PASSWORD!,
  clientCert: readFileSync('client.pem'),
  clientKey: readFileSync('client-key.pem'),
  keepAliveInterval: 5 * 60 * 1000,    // send <hello> after 5 idle minutes
  autoReconnect: true,                 // reconnect and log in again before the next command
});

client.on('close', () => console.warn('EPP connection closed'));
client.on('reconnect', () => console.info('EPP session restored'));

await client.login();                  // connects first

process.once('SIGTERM', async () => {
  await client.logout().catch(() => undefined);
  await client.disconnect();
});
```

- Registries close idle sessions after a time they choose (RFC 5734 Section 9 allows it). Set
  `keepAliveInterval` below that limit. The keep-alive timer does not keep the Node.js process
  running by itself.
- `autoReconnect` applies after a successful `login()` and stops after `logout()` or
  `disconnect()`. It reconnects before the next command, not as soon as the connection drops. The
  command that was in flight when the connection dropped fails and is not retried.
- A client sends one command at a time. Concurrent calls are queued and each gets its own
  response. For several sessions, create one `EppClient` per session, within the registry's
  session limit.

## Debug logging

`debug: true` logs connection events and every frame to the console:

```typescript
import { EppClient } from 'epp-ts';

const client = new EppClient({ ...config, debug: true });
```

```text
[epp] Connecting to epp.registry.example:700
[epp] TLS established: TLSv1.3 TLS_AES_256_GCM_SHA384
[epp] << <?xml version="1.0" encoding="UTF-8" standalone="no"?><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><greeting>...
[epp] >> <?xml version="1.0" encoding="UTF-8" standalone="no"?><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><command><login><clID>registrar-id</clID><pw>***</pw>...
```

To send the output to your own logger (`log` below), pass `logger`. Setting it turns logging on:

```typescript
import { EppClient } from 'epp-ts';

const client = new EppClient({
  ...config,
  logger: {
    debug: (message) => log.debug(message),
    warn: (message) => log.warn(message),   // disabled certificate checks, failed keep-alives, login security events
  },
});
```

Logged frames have passwords (`<pw>`, `<newPW>` and their loginSec equivalents), authorization
info (`<domain:pw>`, `<contact:pw>`) and allocation tokens replaced with `***`. `response.xml` is
the raw response and is not redacted. Pass it through `redactXml()` before you log it yourself:

```typescript
import { redactXml } from 'epp-ts';

const info = await client.domainInfo('example.com', { authInfo: 'domain-auth-code' });
log.info(redactXml(info.xml));         // <domain:pw>***</domain:pw>
```

## Next steps

- [README](README.md): every configuration option and command, the poll queue, fees, sunrise and
  claims.
- [docs/SSL_TLS_CONFIGURATION.md](docs/SSL_TLS_CONFIGURATION.md): certificates, custom CAs, test
  servers and TLS errors.
- [docs/DNSSEC_GUIDE.md](docs/DNSSEC_GUIDE.md): DS and key data, key rollovers.
- [docs/EPP_EXTENSIONS.md](docs/EPP_EXTENSIONS.md): grace-period restores, launch phases, fees and
  the other extensions.
- [docs/COMPLIANCE.md](docs/COMPLIANCE.md): the standards epp-ts implements and how they map to
  ICANN requirements.
- [examples/](examples/): complete workflows to run against your registry's OT&E environment.
