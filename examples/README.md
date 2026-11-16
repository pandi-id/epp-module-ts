# Examples

Runnable examples for epp-ts 1.0. They import the library from `../src`, so no build step is needed: run them with the npm scripts below (ts-node).

> **Use your registry's OT&E or test environment, never production.** The registration, transfer, DNSSEC, extension and poll examples create, transfer, restore or change objects and acknowledge poll messages, and registry operations can be billable. Even the read-only examples log in with real credentials.

## Configuration

All examples read the connection settings from environment variables (see [`config.ts`](config.ts)):

| Variable | Required | Description |
| --- | --- | --- |
| `EPP_HOST` | yes | EPP server host name |
| `EPP_PORT` | no | TCP port, default `700` |
| `EPP_USERNAME` | yes | Client ID issued by the registry |
| `EPP_PASSWORD` | yes | Password |
| `EPP_CA` | no | Path to a PEM CA bundle that issued the server certificate (private or test CAs) |
| `EPP_CERT` | no | Path to a PEM client certificate, for registries that require mutual TLS |
| `EPP_KEY` | no | Path to the PEM private key of `EPP_CERT` (set both or neither) |
| `EPP_DEBUG` | no | `1` logs every EPP frame; passwords and authorization codes are redacted |

`ssl-configurations.ts` also reads `EPP_KEY_PASSPHRASE`, `EPP_PFX` and `EPP_SERVERNAME`.

```bash
export EPP_HOST=epp.ote.example.tld
export EPP_USERNAME=registrar1
export EPP_PASSWORD='...'
export EPP_CA=./certs/registry-ca.pem      # if the server uses a private CA
npm run example:basic
```

A missing required variable prints what to set and exits with code 1.

## npm scripts

| Script | File | What it does |
| --- | --- | --- |
| `example:basic` | [`basic-usage.ts`](basic-usage.ts) | Greeting, domain check and info, contact check, poll request (read-only) |
| `example:tls` | [`tls-tcp-connection.ts`](tls-tcp-connection.ts) | Connection lifecycle: events, TLS details, keep-alive, reconnect settings, errors by class (read-only) |
| `example:ssl` | [`ssl-configurations.ts`](ssl-configurations.ts) | TLS configuration variants; lists them, or connects with the one you name (no login) |
| `example:domain` | [`complete-domain-registration.ts`](complete-domain-registration.ts) | Full registration: availability, price, contacts, domain, glue hosts, delegation |
| `example:transfer` | [`domain-transfer.ts`](domain-transfer.ts) | Transfer request, query, approve, reject, cancel, and transfer poll messages |
| `example:dnssec` | [`dnssec-operations.ts`](dnssec-operations.ts) | DS records: create, add, key rollover, maxSigLife, remove all, info |
| `example:extensions` | [`epp-extensions.ts`](epp-extensions.ts) | ICANN workflows: fees and premium names, claims, sunrise, RGP restore, registry-specific extensions |
| `example:poll` | [`poll-queue.ts`](poll-queue.ts) | Reads and acknowledges every message in the poll queue |
| `example:all` | [`run-all-examples.ts`](run-all-examples.ts) | Runs the read-only examples (`basic-usage`, `tls-tcp-connection`) in sequence |

Two files have no script:

- [`config.ts`](config.ts) is the shared helper: `loadConfig()` builds the `EppConfig`, and `run()` connects, logs in, runs an example, logs out and disconnects, and prints server errors with their reasons.
- [`nextjs-api-route.ts`](nextjs-api-route.ts) shows one shared, lazily logged-in client for a web server (Next.js, Express, ...). Try it with `npx ts-node examples/nextjs-api-route.ts example.com example.tld`.

## Arguments

Pass arguments after `--`. The examples with several scenarios run one per invocation and print their usage for a missing or unknown argument.

```bash
npm run example:basic -- example.com sh8013                 # [domain] [contactId]
npm run example:domain -- example.tld                       # <domain>, required

npm run example:transfer                                    # query example.tld (default)
npm run example:transfer -- request example.tld 'AUTH-CODE' 1
npm run example:transfer -- approve example.tld             # also: reject, cancel
npm run example:transfer -- poll

npm run example:dnssec -- info example.tld                  # default
npm run example:dnssec -- create example.tld contact-id     # also: add, rollover, maxsiglife, remove

npm run example:extensions -- fee example.tld               # default; add a contact ID to register
npm run example:extensions -- claims example.tld
npm run example:extensions -- sunrise ./mark.smd example.tld contact-id
npm run example:extensions -- restore example.tld
npm run example:extensions -- registry-ext example.tld

npm run example:poll -- 20                                  # stop after 20 messages
npm run example:ssl -- mutual-tls                           # see the list for other variants
```

The placeholder values in the examples (domains, DS records, contact details, the registry extension namespace) only illustrate the API. Replace them with values your registry accepts.
