/**
 * Domain transfer between registrars (RFC 5731 Section 3.2.4).
 *
 * The gaining registrar requests the transfer with the domain's authInfo;
 * the losing (sponsoring) registrar approves or rejects it, or the server
 * approves it automatically when the pending period ends. Both sides learn
 * the outcome from the poll queue.
 *
 * Each scenario runs one step, so nothing happens unless you ask for it.
 * Use your registry's OT&E environment.
 */

import { EppClient, EppCommandError, EppResultCode, EppStatus } from '../src';
import type { DomainTransferResult } from '../src';
import { exitWithUsage, run, Scenario } from './config';

const USAGE = `Usage: npm run example:transfer -- <scenario> [arguments]

  query   [domain] [authInfo]           Transfer status, for either registrar (default)
  request <domain> <authInfo> [years]   Gaining registrar: check the domain, then request the transfer
  approve <domain>                      Losing registrar: approve a pending transfer
  reject  <domain>                      Losing registrar: reject a pending transfer
  cancel  <domain>                      Gaining registrar: withdraw its pending request
  poll                                  Show and acknowledge transfer messages from the poll queue`;

/** Statuses that make a transfer request fail (RFC 5731 Section 2.3). */
const BLOCKING_STATUSES: string[] = [
  EppStatus.CLIENT_TRANSFER_PROHIBITED,
  EppStatus.SERVER_TRANSFER_PROHIBITED,
  EppStatus.PENDING_TRANSFER,
  EppStatus.PENDING_DELETE,
];

/** Print transfer data (RFC 5731 Section 3.1.3). */
function printTransfer(transfer: DomainTransferResult | undefined): void {
  if (!transfer) return;
  const pending = transfer.trStatus === 'pending';
  console.log(`  ${transfer.name}: ${transfer.trStatus}`);
  console.log(`  requested by ${transfer.reID} on ${transfer.reDate}`);
  // For a pending transfer, acDate is the deadline before the server acts on its own.
  console.log(`  ${pending ? 'awaiting' : 'completed by'} ${transfer.acID} ${pending ? 'until' : 'on'} ${transfer.acDate}`);
  if (transfer.exDate) console.log(`  expiry date after the transfer: ${transfer.exDate}`);
}

/**
 * Gaining registrar: look at the domain with the authInfo the registrant
 * provided (RFC 5731 Section 3.1.2), then request the transfer. The server
 * answers 1001: the request is pending until the losing registrar or the
 * server acts on it.
 */
async function request(client: EppClient, domain: string, authInfo: string, years: number): Promise<void> {
  const { data: info } = await client.domainInfo(domain, { authInfo });
  if (info) {
    console.log(`${info.name}: sponsored by ${info.clID}, expires ${info.exDate ?? '-'}, status ${info.status.join(', ')}`);
    const blocking = info.status.filter((status) => BLOCKING_STATUSES.includes(status));
    if (blocking.length > 0) {
      console.log(`Not transferable now: ${blocking.join(', ')}`);
      return;
    }
  }
  // The period is added to the registration on completion; registry policy
  // may also refuse recently created or transferred domains (2304 or 2106).
  const res = await client.domainTransfer({ name: domain, op: 'request', period: years, authInfo: { pw: authInfo } });
  console.log(`Transfer requested: ${res.code} ${res.message}`);
  printTransfer(res.data);
}

/** Either registrar: the status of the latest transfer of the domain. */
async function query(client: EppClient, domain: string, authInfo?: string): Promise<void> {
  try {
    const res = await client.domainTransfer({ name: domain, op: 'query', authInfo: authInfo ? { pw: authInfo } : undefined });
    printTransfer(res.data);
  } catch (error) {
    if (!(error instanceof EppCommandError && error.code === EppResultCode.OBJECT_NOT_PENDING_TRANSFER)) throw error;
    console.log(`No transfer of ${domain} on record (2301)`);
  }
}

/**
 * The losing registrar approves or rejects a pending transfer; the gaining
 * registrar can cancel its own request. 2301 means nothing is pending.
 */
async function respond(client: EppClient, domain: string, op: 'approve' | 'reject' | 'cancel'): Promise<void> {
  const res = await client.domainTransfer({ name: domain, op });
  console.log(`Transfer ${op}: ${res.code} ${res.message}`);
  printTransfer(res.data);
}

/**
 * Read transfer notifications (RFC 5730 Section 2.9.2.3). The losing
 * registrar gets "pending" when a transfer is requested; both sides get the
 * final status. Stops at the first other kind of message, which
 * poll-queue.ts handles, so no message is acknowledged unread.
 */
async function transferMessages(client: EppClient): Promise<void> {
  let previousId: string | undefined;
  for (;;) {
    const res = await client.poll('req');
    if (!res.msgQ) {
      console.log('No more messages');
      return;
    }
    if (res.msgQ.id === previousId) throw new Error(`Message ${previousId} is still queued after its acknowledgement`);
    previousId = res.msgQ.id;
    if (res.data?.type !== 'domain:trnData') {
      console.log(`Message ${res.msgQ.id} is not a domain transfer notification; run poll-queue.ts to process it`);
      return;
    }
    console.log(`\nMessage ${res.msgQ.id} (${res.msgQ.count} queued): ${res.msgQ.message ?? ''}`);
    printTransfer(res.data.value);
    if (res.data.value.trStatus === 'pending') {
      console.log('  -> as the losing registrar, approve or reject before the deadline, or the server approves it');
    }
    await client.poll('ack', res.msgQ.id);
  }
}

function need(value: string | undefined, what: string): string {
  return value ?? exitWithUsage(USAGE, `Missing ${what}.`);
}

/** Parse the command line before connecting, so usage errors cost no session. */
function selectScenario(): Scenario {
  const [name = 'query', domain, authInfo, years = '1'] = process.argv.slice(2);
  switch (name) {
    case 'query':
      return (client) => query(client, domain ?? 'example.tld', authInfo);
    case 'request': {
      const target = need(domain, 'domain');
      const code = need(authInfo, 'authInfo');
      const period = Number(years);
      if (!Number.isInteger(period) || period < 1 || period > 10) exitWithUsage(USAGE, 'years must be a whole number from 1 to 10.');
      return (client) => request(client, target, code, period);
    }
    case 'approve':
    case 'reject':
    case 'cancel': {
      const target = need(domain, 'domain');
      return (client) => respond(client, target, name);
    }
    case 'poll':
      return transferMessages;
    default:
      return exitWithUsage(USAGE, `Unknown scenario "${name}".`);
  }
}

void run(selectScenario());
