/**
 * Basic usage: the server greeting, a domain check and info, a contact
 * check, and a poll request. Every command here is read-only.
 *
 * Run: npm run example:basic -- [domain] [contactId]
 */

import { EppClient, EppCommandError, EppResultCode } from '../src';
import { run } from './config';

const domain = process.argv[2] ?? 'example.com';
const contactId = process.argv[3] ?? 'sh8013';

async function main(client: EppClient): Promise<void> {
  // The greeting arrives right after the TLS handshake (RFC 5730 Section 2.4).
  const greeting = client.getGreeting();
  if (greeting) {
    console.log('\nGreeting');
    console.log(`  server:     ${greeting.svID} (${greeting.svDate})`);
    console.log(`  versions:   ${greeting.versions.join(', ')}; languages: ${greeting.languages.join(', ')}`);
    console.log(`  objects:    ${greeting.objURIs.join(', ')}`);
    console.log(`  extensions: ${greeting.extURIs.join(', ') || 'none'}`);
  }
  // Login announces the services both sides support (RFC 5730 Section 2.9.1.1).
  console.log(`  announced:  ${client.getServices()?.extURIs.join(', ') || 'no extensions'}`);

  // Domain check (RFC 5731 Section 3.1.1): several names in one command.
  console.log('\nDomain check');
  const check = await client.domainCheck([domain, 'example.tld']);
  for (const result of check.data ?? []) {
    const reason = result.reason ? ` (${result.reason})` : '';
    console.log(`  ${result.name}: ${result.available ? 'available' : `not available${reason}`}`);
  }

  // Domain info (RFC 5731 Section 3.1.2). Full data, including authInfo, is
  // returned only to the sponsoring registrar.
  console.log('\nDomain info');
  try {
    const { data: info } = await client.domainInfo(domain);
    if (info) {
      console.log(`  ${info.name} (${info.roid}), sponsored by ${info.clID}`);
      console.log(`  status:  ${info.status.join(', ')}`);
      console.log(`  created: ${info.crDate ?? '-'}; expires: ${info.exDate ?? '-'}`);
      // Host objects or host attributes, depending on the registry (RFC 5731 Section 1.1).
      const nameServers = info.ns?.hostObj ?? info.ns?.hostAttr?.map((host) => host.hostName) ?? [];
      console.log(`  name servers: ${nameServers.join(', ') || 'none'}`);
    }
  } catch (error) {
    // A rejected command leaves the session usable.
    if (!(error instanceof EppCommandError && error.code === EppResultCode.OBJECT_DOES_NOT_EXIST)) throw error;
    console.log(`  ${domain} does not exist (2303)`);
  }

  // Contact check (RFC 5733 Section 3.1.1).
  console.log('\nContact check');
  const contacts = await client.contactCheck(contactId);
  for (const result of contacts.data ?? []) {
    console.log(`  ${result.id}: ${result.available ? 'available' : `in use${result.reason ? ` (${result.reason})` : ''}`}`);
  }

  // Poll request (RFC 5730 Section 2.9.2.3). "req" leaves the message in
  // the queue; poll-queue.ts shows how to acknowledge messages.
  console.log('\nPoll');
  const poll = await client.poll('req');
  if (poll.code === EppResultCode.SUCCESS_NO_MESSAGES || !poll.msgQ) {
    console.log('  no messages');
  } else {
    console.log(`  ${poll.msgQ.count} message(s); oldest ${poll.msgQ.id} from ${poll.msgQ.qDate ?? '-'}: ${poll.msgQ.message ?? ''}`);
  }
}

void run(main);
