/**
 * TLS configurations for EppClient (RFC 5734 Section 9). Each function
 * returns an EppConfig; nothing connects unless you name a variant:
 *
 *   npm run example:ssl                 list the variants
 *   npm run example:ssl -- <variant>    connect with one, show the TLS session, disconnect
 *
 * Besides the variables in config.ts, the variants read:
 *   EPP_KEY_PASSPHRASE  passphrase of an encrypted EPP_KEY or EPP_PFX
 *   EPP_PFX             PKCS#12 (.p12/.pfx) file with the client certificate and key
 *   EPP_SERVERNAME      certificate name to expect when EPP_HOST is an IP address or alias
 *
 * WARNING, testing only: `rejectUnauthorized: false` turns off certificate
 * verification and `checkServerIdentity: false` turns off the host name
 * check. With either one, anyone on the network path can impersonate the
 * registry and capture your EPP password. Never use them in production. To
 * test against a server with a self-signed certificate, trust that
 * certificate with `ca` instead (see customCa).
 */

import { readFileSync } from 'fs';
import { EppClient } from '../src';
import type { EppConfig } from '../src';
import { exitWithUsage, loadConfig, printError } from './config';

/** Connection settings shared by every variant. */
type Credentials = Pick<EppConfig, 'host' | 'port' | 'username' | 'password'>;

/** 1. Default: verify the server against Node's bundled CA roots; TLS 1.2 or newer. */
export function defaultVerification(credentials: Credentials): EppConfig {
  return { ...credentials };
}

/** 2. Trust a specific CA, e.g. the private CA of a registry's OT&E environment. */
export function customCa(credentials: Credentials, caFile: string): EppConfig {
  return { ...credentials, ca: readFileSync(caFile) };
}

/** 3. Mutual TLS: many registries authenticate registrars by client certificate. */
export function mutualTls(credentials: Credentials, certFile: string, keyFile: string): EppConfig {
  return { ...credentials, clientCert: readFileSync(certFile), clientKey: readFileSync(keyFile) };
}

/** 4. Mutual TLS with an encrypted private key. */
export function encryptedKey(credentials: Credentials, certFile: string, keyFile: string, passphrase: string): EppConfig {
  return { ...mutualTls(credentials, certFile, keyFile), passphrase };
}

/** 5. Refuse anything older than TLS 1.3. */
export function tls13Only(credentials: Credentials): EppConfig {
  return { ...credentials, minVersion: 'TLSv1.3' };
}

/**
 * 6. Restrict the cipher suites (OpenSSL format), e.g. for a compliance
 * policy. Suites starting with "TLS_" are for TLS 1.3, the others for TLS 1.2.
 */
export function restrictedCiphers(credentials: Credentials): EppConfig {
  return {
    ...credentials,
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
    ].join(':'),
  };
}

/**
 * 7. The server name for SNI and the certificate check. It defaults to
 * `host`; set it when connecting by IP address or through an alias.
 */
export function withServerName(credentials: Credentials, servername: string): EppConfig {
  return { ...credentials, servername };
}

/**
 * 8. Any other tls.connect() option goes in `tlsOptions`, applied last.
 * Here: a PKCS#12 bundle, the format some registries issue client certificates in.
 */
export function pkcs12(credentials: Credentials, pfxFile: string, passphrase?: string): EppConfig {
  return { ...credentials, tlsOptions: { pfx: readFileSync(pfxFile), passphrase } };
}

const USAGE = 'Usage: npm run example:ssl -- [variant]';

function env(name: string): string {
  const value = process.env[name];
  if (!value) exitWithUsage(USAGE, `This variant needs ${name}.`);
  return value;
}

/**
 * Configurations compose with spread. Every variant except "default" also
 * trusts EPP_CA when it is set, as test environments often use a private CA.
 */
function withEnvCa(config: EppConfig): EppConfig {
  const caFile = process.env.EPP_CA;
  return caFile ? { ...config, ca: readFileSync(caFile) } : config;
}

const variants: Record<string, { description: string; build: (credentials: Credentials) => EppConfig }> = {
  default: { description: "Node's CA roots, TLS 1.2 or newer", build: defaultVerification },
  'custom-ca': { description: 'trust the CA in EPP_CA', build: (c) => customCa(c, env('EPP_CA')) },
  'mutual-tls': {
    description: 'client certificate EPP_CERT with key EPP_KEY',
    build: (c) => withEnvCa(mutualTls(c, env('EPP_CERT'), env('EPP_KEY'))),
  },
  'encrypted-key': {
    description: 'mutual-tls with an encrypted key, EPP_KEY_PASSPHRASE',
    build: (c) => withEnvCa(encryptedKey(c, env('EPP_CERT'), env('EPP_KEY'), env('EPP_KEY_PASSPHRASE'))),
  },
  tls13: { description: 'TLS 1.3 only', build: (c) => withEnvCa(tls13Only(c)) },
  ciphers: { description: 'restricted cipher suites', build: (c) => withEnvCa(restrictedCiphers(c)) },
  sni: {
    description: 'expect the certificate name EPP_SERVERNAME',
    build: (c) => withEnvCa(withServerName(c, env('EPP_SERVERNAME'))),
  },
  pkcs12: {
    description: 'client certificate from the PKCS#12 file EPP_PFX (tlsOptions)',
    build: (c) => withEnvCa(pkcs12(c, env('EPP_PFX'), process.env.EPP_KEY_PASSPHRASE)),
  },
};

/** Connect, show the TLS session and the greeting, then disconnect. No login is needed to test TLS. */
async function tryConnect(config: EppConfig): Promise<void> {
  const client = new EppClient(config);
  try {
    const greeting = await client.connect();
    console.log(`Connected to ${greeting.svID}`);
    const info = client.getConnectionInfo();
    if (info) console.log(`  ${info.protocol ?? '?'} with ${info.cipher.name}; certificate verified: ${info.authorized}`);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
  }
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name) {
    console.log(`${USAGE}\n\nVariants (all but "default" also trust EPP_CA when it is set):`);
    for (const [key, variant] of Object.entries(variants)) console.log(`  ${key.padEnd(14)} ${variant.description}`);
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(variants, name)) exitWithUsage(USAGE, `Unknown variant "${name}".`);
  const { host, port, username, password } = loadConfig();
  let config: EppConfig;
  try {
    config = variants[name].build({ host, port, username, password });
  } catch (error) {
    return exitWithUsage(USAGE, `Cannot build the "${name}" configuration: ${(error as Error).message}`);
  }
  await tryConnect(config);
}

void main();
