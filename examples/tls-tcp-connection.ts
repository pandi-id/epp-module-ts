/**
 * The EPP connection lifecycle over TLS/TCP (RFC 5734): events, the TLS
 * session, keep-alive, automatic reconnection, and errors by class.
 * Everything here is read-only.
 *
 * Run: npm run example:tls
 */

import {
  EppClient,
  EppCommandError,
  EppConnectionError,
  EppProtocolError,
  EppTimeoutError,
  EppValidationError,
} from '../src';
import type { Greeting } from '../src';
import { loadConfig } from './config';

/** Demo value so the keep-alive fires during the run. Use a few minutes, below the server's idle timeout. */
const KEEP_ALIVE_MS = 2000;

const time = () => new Date().toISOString().slice(11, 23);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Hints for common causes of EppConnectionError, keyed by the socket or TLS error code. */
const CONNECTION_HINTS: Record<string, string> = {
  ECONNREFUSED: 'nothing accepts connections on that host and port',
  ENOTFOUND: 'the host name does not resolve',
  ETIMEDOUT: 'the server is unreachable (firewall, or an IP address the registry has not allowed)',
  ECONNRESET: 'the server dropped the connection, often because it requires a client certificate',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'the server certificate is self-signed: trust it with EPP_CA',
  SELF_SIGNED_CERT_IN_CHAIN: 'the server certificate comes from a private CA: set EPP_CA to its bundle',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'the issuing CA is unknown: set EPP_CA to the CA bundle',
  CERT_HAS_EXPIRED: 'the server certificate has expired',
  ERR_TLS_CERT_ALTNAME_INVALID: 'the certificate does not match the host name: connect by that name or set servername',
};

/**
 * Errors are classes, so handle them with instanceof. Check the subclasses
 * first; all of them extend EppError.
 */
function describeError(error: unknown): void {
  if (error instanceof EppCommandError) {
    // The server answered 2xxx. The session stays open, except after 2500-2502.
    console.log(`  EppCommandError ${error.code}: ${error.response.message} (svTRID ${error.svTRID ?? '-'})`);
  } else if (error instanceof EppValidationError) {
    console.log(`  EppValidationError: ${error.message} (nothing was sent)`);
  } else if (error instanceof EppTimeoutError) {
    // No greeting or response in time; the client closed the connection.
    console.log(`  EppTimeoutError: ${error.message}`);
  } else if (error instanceof EppProtocolError) {
    // Malformed frame or document; error.xml holds what the server sent.
    console.log(`  EppProtocolError: ${error.message}`);
  } else if (error instanceof EppConnectionError) {
    // error.cause is the underlying socket or TLS error. Its code says more
    // than its message, which is empty when every address of the host failed.
    const code = (error.cause as NodeJS.ErrnoException | undefined)?.code;
    const hint = code && CONNECTION_HINTS[code] ? ` -> ${CONNECTION_HINTS[code]}` : '';
    console.log(`  EppConnectionError: ${error.message}${code ? ` [${code}]` : ''}${hint}`);
  } else {
    throw error;
  }
}

async function main(): Promise<void> {
  const client = new EppClient(
    loadConfig({
      connectTimeout: 10000, // TLS handshake plus greeting
      timeout: 30000, // each command
      // Send <hello> after this much idle time to keep the session open.
      keepAliveInterval: KEEP_ALIVE_MS,
      // After a dropped connection, reconnect and log in again before the next
      // command. A command in flight when the connection dropped is not retried.
      autoReconnect: true,
      // Route the client's log lines into your own logger. Debug lines are the
      // redacted XML frames; warnings include keep-alive failures and loginSec notices.
      logger: {
        debug: (message) => {
          if (process.env.EPP_DEBUG === '1') console.log(`  [epp ${time()}] ${message}`);
        },
        warn: (message) => console.warn(`  [epp ${time()}] warning: ${message}`),
      },
    }),
  );

  client.on('greeting', (greeting: Greeting) => console.log(`  [event ${time()}] greeting from ${greeting.svID}`));
  client.on('close', () => console.log(`  [event ${time()}] connection closed`));
  client.on('reconnect', () => console.log(`  [event ${time()}] reconnected and logged in again`));

  try {
    // 1. TCP connection, TLS handshake, then the server greeting (RFC 5734 Section 2).
    console.log('1. Connecting');
    const greeting = await client.connect();
    console.log(`   connected: ${client.isConnected()}; server date ${greeting.svDate}`);

    // 2. The TLS session.
    const tls = client.getConnectionInfo();
    if (tls) {
      console.log(`2. TLS ${tls.protocol ?? '?'} with ${tls.cipher.name}; certificate verified: ${tls.authorized}`);
    }

    // 3. Login (RFC 5730 Section 2.9.1.1).
    const login = await client.login();
    console.log(`3. Logged in (${login.code}): ${client.isLoggedIn()}`);
    console.log(`   objects:    ${client.getServices()?.objURIs.join(', ')}`);
    console.log(`   extensions: ${client.getServices()?.extURIs.join(', ') || 'none'}`);

    // 4. Keep-alive: after KEEP_ALIVE_MS of idle time the client sends <hello>,
    // which shows up as a greeting event. Commands reset the idle timer.
    console.log(`4. Idle for ${KEEP_ALIVE_MS + 500} ms`);
    await sleep(KEEP_ALIVE_MS + 500);

    // 5. An explicit <hello> (RFC 5730 Section 2.3) returns a fresh greeting.
    const fresh = await client.hello();
    console.log(`5. hello: server date now ${fresh.svDate}`);

    // 6. Errors by class. A rejected command leaves the session usable.
    console.log('6. Errors');
    try {
      // Rejected by the client before sending: the domain schema allows periods of 1 to 99.
      await client.domainRenew({ name: 'example.tld', curExpDate: '2030-01-01', period: 100 });
    } catch (error) {
      describeError(error);
    }
    try {
      // Rejected by the server: a contact ID that does not exist (2303).
      await client.contactInfo(`nx-${Date.now().toString(36)}`);
    } catch (error) {
      describeError(error);
    }
    console.log(`   still logged in: ${client.isLoggedIn()}`);

    // 7. Logout (RFC 5730 Section 2.9.1.2): the server answers 1500 and closes the connection.
    const logout = await client.logout();
    console.log(`7. Logged out (${logout.code})`);
  } catch (error) {
    describeError(error);
    process.exitCode = 1;
  } finally {
    if (client.isLoggedIn()) await client.logout().catch(() => undefined);
    // Safe to call in any state; pending commands fail with EppConnectionError.
    await client.disconnect();
    console.log(`8. Disconnected: connected ${client.isConnected()}, logged in ${client.isLoggedIn()}`);
  }
}

void main();
