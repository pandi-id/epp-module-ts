# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`epp-ts`: a TypeScript EPP client (RFC 5730-5734) with the extensions ICANN gTLD registries use (secDNS-1.1, rgp-1.0, launch-1.0 + RFC 7848 marks, epp:fee-1.0, epp:loginSec-1.0, changePoll-1.0, allocationToken-1.0) and TMCH helpers (RFC 9361). CommonJS build in `dist/`; the only runtime dependency is `sax`. Node >= 18 (`@types/node` is pinned to 18 so newer APIs fail type-checking).

## Commands

```bash
npm run build          # clean + tsc -p tsconfig.build.json (src/ -> dist/)
npm run typecheck      # tsc -p tsconfig.json: src, test and examples
npm test               # Jest; no network needed
npx jest test/commands.test.ts               # one file
npx jest test/client.test.ts -t "autoReconnect"   # tests whose name matches
npm run test:coverage
npm run lint           # src, test, examples
npm pack --dry-run     # check the published file list
```

Examples (`npm run example:*`) need a real server; `examples/config.ts` reads `EPP_HOST`, `EPP_PORT`, `EPP_USERNAME`, `EPP_PASSWORD`, `EPP_CA`, `EPP_CERT`, `EPP_KEY`, `EPP_DEBUG`.

## Architecture

```
src/xml/        XmlWriter (el(), serializeXml(): order-preserving builder)
                XmlReader (sax with xmlns: XmlNode matched by namespace URI)
src/mapping/    one module per RFC object: build*() and parse*()
                Envelope (wraps commands), Response (envelope, extensions, poll), Session, Shared
src/extensions/ one module per EPP extension: builders and parsers
src/core/       EppClient (transport + session), Framing, Errors, Namespaces (NS), Redact, Version
src/types/      public request/response types, plus helper functions (validators, TMCH, RGP, fee)
src/utils/      Helpers: validators, IDN, generateAuthInfo, result codes
```

Command path: an `EppClient` method calls a `build*()` function that returns `CommandParts` (`{ command, extensions }`) → `checkExtensions()` rejects extension elements whose `xmlns:` URI was not announced at login → `buildCommandXml()` writes `<epp><command>…<extension>…</extension><clTRID/>` → `exchange()` queues it → `encodeFrame()` → socket.

Response path: `FrameDecoder` (validates lengths) → the single pending resolver → `parseEppDocument()` → `parseResponse()` → clTRID check → `resData(ns, name, parser)` picks the typed data → `toEppResponse()`; result codes ≥ 2000 throw `EppCommandError`.

Invariants worth knowing before changing `EppClient`:
- One pending-response slot plus a promise-chain queue: commands never overlap on the wire.
- A timeout, a clTRID mismatch or a bad frame destroys the socket, because a late or stray frame would otherwise be taken as the next command's response. Socket close fails the pending command immediately.
- `connect()` resolves only after the greeting. `login()` announces `DEFAULT_OBJECT_URIS`/`SUPPORTED_EXTENSION_URIS` intersected with the greeting unless `objURIs`/`extURIs` are configured, and uses loginSec for passwords over 16 characters.
- `autoReconnect` only applies after a successful login and is cleared by `logout()`/`disconnect()`. Keep-alive is rescheduled after every exchange.

## Rules for protocol code

- Builders must emit children in the XSD `<sequence>` order and declare the namespace on the object or extension root (`xmlns:domain`, `xmlns:secDNS`, ...). `checkExtensions()` reads that declaration.
- Parsers match elements with `XmlNode.child(ns, name)` / `all(ns, name)`, never by prefix; servers may use any prefix. Parsers are lenient: missing elements become `undefined`, they do not throw.
- Throw `EppValidationError` for anything the schema or RFC forbids, before sending.
- Adding an extension or command: builder (+ parser) in `src/extensions/` or `src/mapping/`, wire it into the request type and the mapping builder, dispatch response data in `Response.parseExtensions()`, add the URI to `SUPPORTED_EXTENSION_URIS` if login should announce it, add its XSD to `test/schemas/` and `epp-all.xsd`, then test it in `test/commands.test.ts` with `expectSchemaValid()` and add a response fixture.

## Tests

- `test/commands.test.ts` validates every generated command against the official XSDs in `test/schemas/` via `xmllint-wasm` (`test/helpers/xsd.ts`). Keep it that way for new builders.
- `test/fixtures/responses/*.xml` follow RFC examples and are themselves schema-validated by `test/responses.test.ts` (except `unknown-extension.xml`).
- `test/client.test.ts` runs the client against `test/helpers/mockServer.ts` (in-process TLS with the test-only certificates in `test/fixtures/tls/`). `fixtureFor()` rewrites a fixture's clTRID to the request's, since the client rejects mismatches.

## Conventions

- JSDoc in English, citing the RFC section (`RFC 5731 Section 3.2.1`). Section numbers have been checked against the RFC texts; check new ones too.
- `src/core/Version.ts` must equal the `package.json` version (a test enforces it). Record user-visible changes in `CHANGELOG.md` (Keep a Changelog).
- `README.md` and `docs/` document the public API; update them with API changes.
