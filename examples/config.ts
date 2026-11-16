/**
 * Shared setup for the examples: an EppConfig built from environment
 * variables, and a runner that opens and closes the EPP session.
 *
 *   EPP_HOST      EPP server host name (required)
 *   EPP_PORT      TCP port (default 700, RFC 5734 Section 7)
 *   EPP_USERNAME  Client ID issued by the registry (required)
 *   EPP_PASSWORD  Password (required)
 *   EPP_CA        PEM file with the CA certificate(s) that issued the server certificate
 *   EPP_CERT      PEM client certificate, for registries that require mutual TLS
 *   EPP_KEY       PEM private key of EPP_CERT
 *   EPP_DEBUG=1   Log every frame (passwords and authorization codes are redacted)
 */

import { readFileSync } from 'fs';
import { EppClient, EppCommandError, EppConnectionError, EppValidationError } from '../src';
import type { EppConfig } from '../src';

/** An example body: runs with a connected, logged-in client. */
export type Scenario = (client: EppClient) => Promise<void>;

const HELP = `Set these environment variables to run the examples:

  EPP_HOST      EPP server host name (required)
  EPP_PORT      TCP port (default 700)
  EPP_USERNAME  Client ID issued by the registry (required)
  EPP_PASSWORD  Password (required)
  EPP_CA        Path to a PEM CA bundle that issued the server certificate
  EPP_CERT      Path to a PEM client certificate (mutual TLS)
  EPP_KEY       Path to the PEM private key of EPP_CERT
  EPP_DEBUG=1   Log every EPP frame, with secrets redacted

Example:
  EPP_HOST=epp.example.tld EPP_USERNAME=registrar1 EPP_PASSWORD='...' npm run example:basic

Use your registry's OT&E or test environment, never production.`;

/**
 * Build an EppConfig from the environment. Throws an Error naming the
 * missing variables; for servers and other code that must not exit.
 */
export function configFromEnv(overrides: Partial<EppConfig> = {}): EppConfig {
  const { EPP_HOST: host, EPP_USERNAME: username, EPP_PASSWORD: password, EPP_PORT, EPP_CERT, EPP_KEY } = process.env;
  if (!host || !username || !password) {
    const missing = Object.entries({ EPP_HOST: host, EPP_USERNAME: username, EPP_PASSWORD: password })
      .filter(([, value]) => !value)
      .map(([name]) => name);
    throw new Error(`Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }
  const port = EPP_PORT ? Number(EPP_PORT) : 700;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`EPP_PORT must be a TCP port number, got "${EPP_PORT}"`);
  }
  if (Boolean(EPP_CERT) !== Boolean(EPP_KEY)) {
    throw new Error('Set EPP_CERT and EPP_KEY together: mutual TLS needs both the certificate and its key');
  }
  return {
    host,
    port,
    username,
    password,
    ca: readFileFromEnv('EPP_CA'),
    clientCert: readFileFromEnv('EPP_CERT'),
    clientKey: readFileFromEnv('EPP_KEY'),
    debug: process.env.EPP_DEBUG === '1',
    ...overrides,
  };
}

/** Contents of the file named by an environment variable, or undefined when it is not set. */
function readFileFromEnv(name: string): Buffer | undefined {
  const file = process.env[name];
  if (!file) return undefined;
  try {
    return readFileSync(file);
  } catch (error) {
    throw new Error(`Cannot read ${name} (${file}): ${(error as Error).message}`);
  }
}

/**
 * Build an EppConfig from the environment for a command-line example. When
 * a variable is missing or a file cannot be read, print what to set and
 * exit with code 1.
 */
export function loadConfig(overrides: Partial<EppConfig> = {}): EppConfig {
  try {
    return configFromEnv(overrides);
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${HELP}`);
    process.exit(1);
  }
}

/**
 * Connect, log in, run `main`, then log out and disconnect, whatever
 * happened. Errors are printed and set the exit code to 1.
 */
export async function run(main: Scenario, overrides: Partial<EppConfig> = {}): Promise<void> {
  const client = new EppClient(loadConfig(overrides));
  try {
    const greeting = await client.connect();
    console.log(`Connected to ${greeting.svID}`);
    await client.login();
    await main(client);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  } finally {
    if (client.isLoggedIn()) {
      await client.logout().catch((error: Error) => console.error(`Logout failed: ${error.message}`));
    }
    await client.disconnect();
  }
}

/**
 * Print an error. For a command the server rejected (2xxx), list every
 * result with the offending values and the server's reasons (RFC 5730 Section 2.6).
 */
export function printError(error: unknown): void {
  if (error instanceof EppCommandError) {
    console.error(`\nCommand failed with ${error.code}: ${error.response.message}`);
    error.results.forEach((result, index) => {
      // The first result is the headline; servers may add more (RFC 5730 Section 2.6).
      if (index > 0) console.error(`  also ${result.code}: ${result.message}`);
      for (const value of result.values) console.error(`    value: ${value}`);
      for (const extValue of result.extValues) {
        console.error(`    reason: ${extValue.reason}${extValue.value ? ` (value: ${extValue.value})` : ''}`);
      }
    });
    if (error.svTRID) console.error(`  svTRID: ${error.svTRID}`);
  } else if (error instanceof EppConnectionError) {
    // The socket or TLS error code (ECONNREFUSED, CERT_HAS_EXPIRED, ...) says the most.
    const code = (error.cause as NodeJS.ErrnoException | undefined)?.code;
    console.error(`\n${error.name}: ${error.message}${code ? ` [${code}]` : ''}`);
  } else if (error instanceof Error) {
    // EppTimeoutError, EppProtocolError, EppValidationError, or a local error.
    console.error(`\n${error.name}: ${error.message}`);
  } else {
    console.error('\nUnexpected error:', error);
  }
}

/**
 * Fail early when an extension was not announced at login. The client
 * refuses to send extensions the session did not negotiate (RFC 5730
 * Section 2.9.1.1), and by default it announces only what the greeting offers.
 */
export function requireExtension(client: EppClient, uri: string, name: string): void {
  if (!client.getServices()?.extURIs.includes(uri)) {
    throw new EppValidationError(`${name} (${uri}) was not announced at login: the server's greeting does not offer it`);
  }
}

/** Print a problem and the usage text, then exit with code 1. */
export function exitWithUsage(usage: string, problem?: string): never {
  if (problem) console.error(`${problem}\n`);
  console.error(usage);
  process.exit(1);
}
