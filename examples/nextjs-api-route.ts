/**
 * One shared EPP session for a web server: Next.js route handlers, Express,
 * Fastify, and so on. No framework types are needed.
 *
 * Registries limit concurrent sessions and logins are slow, so keep one
 * logged-in client per server process instead of logging in per request.
 * The client queues commands internally and sends them one at a time over
 * its connection, so concurrent requests can share it safely.
 *
 * Copy this module into your app, e.g. as lib/epp.ts together with
 * configFromEnv() from config.ts, and call it from a route handler such as
 * app/api/domains/check/route.ts in the Next.js App Router:
 *
 *   import { checkDomains } from '@/lib/epp';
 *
 *   export const runtime = 'nodejs'; // EPP needs TCP sockets; the Edge runtime has none
 *
 *   export async function POST(request: Request) {
 *     const { domains } = await request.json();
 *     const { status, body } = await checkDomains(domains);
 *     return Response.json(body, { status });
 *   }
 *
 * This suits long-running servers. In development, Next.js reloads modules
 * on change; keep the session on globalThis there to avoid a new login per reload.
 *
 * Try it from the command line: npx ts-node examples/nextjs-api-route.ts example.com example.tld
 */

import { EppClient, EppCommandError, EppValidationError, normalizeDomain, validateDomain } from '../src';
import type { DomainCheckResult } from '../src';
import { configFromEnv } from './config';

/** Registries cap the names per check command; stay below your registry's limit. */
const MAX_NAMES = 10;

export interface CheckDomainsResponse {
  /** HTTP status to answer with. */
  status: number;
  body: { results: DomainCheckResult[] } | { error: string; code?: number };
}

let session: Promise<EppClient> | null = null;

async function openSession(): Promise<EppClient> {
  const client = new EppClient(
    configFromEnv({
      // After the registry closes an idle or broken connection, the next
      // command reconnects and logs in again by itself.
      autoReconnect: true,
      // Below the registry's idle timeout; check its documentation.
      keepAliveInterval: 5 * 60 * 1000,
    }),
  );
  await client.connect();
  await client.login();
  return client;
}

/**
 * The shared client, connected and logged in on first use. Concurrent first
 * requests wait for the same promise, so there is a single login.
 */
function getClient(): Promise<EppClient> {
  if (!session) {
    const attempt = openSession();
    session = attempt;
    // When the first connect or login fails, let the next request try again.
    attempt.catch(() => {
      if (session === attempt) session = null;
    });
  }
  return session;
}

/** Check domain availability for an API request, as JSON-serializable data. */
export async function checkDomains(names: string[]): Promise<CheckDomainsResponse> {
  if (!Array.isArray(names) || names.length === 0 || names.length > MAX_NAMES || !names.every((n) => typeof n === 'string')) {
    return { status: 400, body: { error: `Send 1 to ${MAX_NAMES} domain names` } };
  }
  try {
    // A-label form (IDNs as xn--), lowercase, no duplicates.
    const domains = [...new Set(names.map(normalizeDomain))];
    const invalid = domains.filter((name) => !validateDomain(name) || !name.includes('.'));
    if (invalid.length > 0) return { status: 400, body: { error: `Invalid domain names: ${invalid.join(', ')}` } };

    const client = await getClient();
    const { data } = await client.domainCheck(domains);
    return { status: 200, body: { results: data ?? [] } };
  } catch (error) {
    if (error instanceof EppValidationError) {
      return { status: 400, body: { error: error.message } };
    }
    if (error instanceof EppCommandError) {
      // The registry rejected the command, e.g. 2306 for a TLD it does not serve.
      return { status: 502, body: { error: error.response.message, code: error.code } };
    }
    // Configuration, connection, timeout or protocol errors: log the details, answer generically.
    console.error('EPP request failed:', error);
    return { status: 503, body: { error: 'The registry service is unavailable; try again later' } };
  }
}

/** Log out and close the shared session, e.g. when the server shuts down. */
export async function closeEppClient(): Promise<void> {
  const pending = session;
  session = null;
  const client = await pending?.catch(() => null);
  if (!client) return;
  if (client.isLoggedIn()) await client.logout().catch(() => undefined);
  await client.disconnect();
}

// Command-line demo: each name is checked as a separate, concurrent request,
// sharing one session.
if (require.main === module) {
  const names = process.argv.length > 2 ? process.argv.slice(2) : ['example.com', 'example.tld'];
  void Promise.all(names.map((name) => checkDomains([name])))
    .then((responses) => console.log(JSON.stringify(responses, null, 2)))
    .finally(() => closeEppClient());
}
