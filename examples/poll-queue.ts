/**
 * Process the poll message queue (RFC 5730 Section 2.9.2.3).
 *
 * poll('req') returns the oldest message (1301) without removing it, or
 * 1300 when the queue is empty; poll('ack', id) removes it. The server
 * keeps returning the same message until it is acknowledged, so a consumer
 * handles each message, then acknowledges it.
 *
 * This example acknowledges every message it prints. Use a test account.
 *
 * Run: npm run example:poll -- [max-messages]
 */

import { EppClient, EppResultCode } from '../src';
import type { EppResponse, PollMessageData } from '../src';
import { exitWithUsage, run } from './config';

const limit = Number(process.argv[2] ?? 100);
if (!Number.isInteger(limit) || limit < 1) {
  exitWithUsage('Usage: npm run example:poll -- [max-messages]', 'max-messages must be a positive whole number.');
}

/** Print the payload of a message: `res.data` is typed by its `type`. */
function describe(res: EppResponse<PollMessageData>): void {
  const data = res.data;
  switch (data?.type) {
    case 'domain:trnData': {
      // Transfer notifications (RFC 5731 Section 3.1.3): "pending" goes to the
      // losing registrar; the final status goes to both registrars.
      const transfer = data.value;
      console.log(`  domain transfer ${transfer.name}: ${transfer.trStatus}, requested by ${transfer.reID}, action by ${transfer.acID} (${transfer.acDate})`);
      break;
    }
    case 'contact:trnData':
      console.log(`  contact transfer ${data.value.id}: ${data.value.trStatus}, requested by ${data.value.reID}`);
      break;
    case 'domain:panData':
    case 'contact:panData':
    case 'host:panData': {
      // The outcome of a command that was answered 1001 (RFC 5731 Section 3.3).
      const action = data.value;
      const trid = `clTRID ${action.paTRID.clTRID ?? '-'}, svTRID ${action.paTRID.svTRID ?? '-'}`;
      console.log(`  pending action on ${action.name} ${action.paResult ? 'succeeded' : 'failed'} on ${action.paDate} (${trid})`);
      break;
    }
    case 'domain:infData':
      // Registries send object data with server-side changes, often with change poll data below.
      console.log(`  domain ${data.value.name}: status ${data.value.status.join(', ')}, expires ${data.value.exDate ?? '-'}`);
      break;
    case 'unknown':
      // Registry-specific payloads keep their raw XML.
      console.log(`  <${data.element}> in ${data.namespace}: ${data.xml}`);
      break;
    default:
      console.log(data ? `  ${data.type} payload` : '  no payload (text-only message)');
  }

  // RFC 8590: what changed the object, who changed it, and why.
  const change = res.extensions.changePoll;
  if (change) {
    const operation = change.op ? `${change.operation} (${change.op})` : change.operation;
    const caseId = change.caseId ? `, ${change.caseId.type} case ${change.caseId.id}` : '';
    console.log(`  change: ${operation} by ${change.who} on ${change.date}, data ${change.state} the change${caseId}`);
    if (change.reason) console.log(`  reason: ${change.reason}`);
  }
}

async function main(client: EppClient): Promise<void> {
  let previousId: string | undefined;
  for (let handled = 0; handled < limit; handled++) {
    const res = await client.poll('req');
    if (res.code === EppResultCode.SUCCESS_NO_MESSAGES || !res.msgQ) {
      console.log(handled === 0 ? 'The queue is empty' : `\nDone: ${handled} message(s) handled; the queue is empty`);
      return;
    }
    const msgQ = res.msgQ;
    if (msgQ.id === previousId) throw new Error(`Message ${msgQ.id} is still queued after its acknowledgement`);
    previousId = msgQ.id;

    console.log(`\nMessage ${msgQ.id} (${msgQ.count} in queue, enqueued ${msgQ.qDate ?? '-'}): ${msgQ.message ?? ''}`);
    if (msgQ.messageXml) console.log(`  message XML: ${msgQ.messageXml}`);
    describe(res);

    // Acknowledge only once the message is handled (stored, acted on): an
    // acknowledged message cannot be fetched again.
    await client.poll('ack', msgQ.id);
  }
  console.log(`\nStopped after ${limit} messages; run again to continue`);
}

void run(main);
